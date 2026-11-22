"""Serve the JavaScript UI and pass its ranking JSON through unchanged."""
import gzip
import json
import math
import mimetypes
import os
import re
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from backend import SERVICES, SERVICE_NAMES, search, source_mode, suggested_services, suggestions_mode
from reports import ReportError, receive_report, report_mode

ROOT = Path(__file__).resolve().parent
mimetypes.add_type("font/woff2", ".woff2")
PUBLIC = {"index.html", "leaflet.css", "leaflet.js", "styles.css", "atlas.js", "report-form.js",
          "carefinder.js", "demo.js", "Leaflet-LICENSE.txt", "places.js", "india-geography.js",
          "service-suggestions.js", "font-atkinson-400.woff2", "font-atkinson-700.woff2", "font-bricolage.woff2", "geography.js", "streets-data.js", "streets.js", "GEOGRAPHY-SOURCES.txt", "STREETS-SOURCES.txt"}


@lru_cache(maxsize=1)
def service_menu():
    """<option> list for every service; dialysis stays the default selection."""
    from html import escape
    opts = "".join(f'<option value="{escape(k)}"{" selected" if k == "dialysis" else ""}>{escape(v)}</option>'
                   for k, v in sorted(SERVICE_NAMES.items(), key=lambda kv: kv[1].lower()))
    return f'<select id="service">{opts}</select>'.encode()


@lru_cache(maxsize=5)
def compressed_asset(name, modified):
    """Cache by modification time so a redeployment serves the new map."""
    return gzip.compress((ROOT / name).read_bytes(), compresslevel=2, mtime=0)


def number_in(value, lo, hi):
    return type(value) in (int, float) and lo <= value <= hi and math.isfinite(value)


def valid_location(p):
    return (isinstance(p, dict) and number_in(p.get("latitude"), -90, 90)
            and number_in(p.get("longitude"), -180, 180) and isinstance(p.get("label"), str))


def valid(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("origin"), dict):
        return False
    p = payload["origin"]
    return (payload.get("service_id") in SERVICES
            and valid_location(p)
            and number_in(payload.get("radius_km"), 0.001, 20040))


BACKEND = os.environ.get("CARE_BACKEND_URL", "http://127.0.0.1:8001")


def admin_proxy(handler, method):
    """Forward /api/admin/* to the data backend; the backend checks the administrator key."""
    from urllib.error import HTTPError, URLError
    from urllib.request import Request, urlopen
    url = urlsplit(handler.path)
    target = BACKEND + url.path[len("/api"):] + (("?" + url.query) if url.query else "")
    data = None
    if method == "POST":
        size = int(handler.headers.get("Content-Length", "0"))
        data = handler.rfile.read(size) if 0 < size <= 65536 else b"{}"
    req = Request(target, data=data, method=method, headers={
        "Content-Type": "application/json", "Authorization": handler.headers.get("Authorization", "")})
    try:
        with urlopen(req, timeout=90) as res:
            handler.send_bytes(res.status, "application/json; charset=utf-8", res.read())
    except HTTPError as e:
        handler.send_bytes(e.code, "application/json; charset=utf-8", e.read())
    except URLError:
        handler.send_json(502, {"error": "The data backend is not reachable."})


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # Searches include location data; no per-request log is required.

    def send_bytes(self, code, kind, data, *, headers=None):
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store" if kind.startswith(("text/html", "application/json")) else "no-cache")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_json(self, code, obj):
        self.send_bytes(code, "application/json; charset=utf-8", json.dumps(obj, allow_nan=False).encode())

    def do_GET(self):
        if urlsplit(self.path).path in ("/admin", "/admin/", "/admin.html"):
            self.send_bytes(200, "text/html; charset=utf-8", (ROOT / "admin.html").read_bytes())
            return
        if urlsplit(self.path).path.startswith("/api/admin/"):
            admin_proxy(self, "GET")
            return
        if urlsplit(self.path).path.startswith("/api/streets/"):
            from street_proxy import serve_street_tile
            if serve_street_tile(self):
                return
        name = urlsplit(self.path).path.lstrip("/") or "index.html"
        if name not in PUBLIC or not (ROOT / name).is_file():
            self.send_error(404)
            return
        path = ROOT / name
        headers = {}
        if name != "index.html" and path.stat().st_size >= 65536:
            modified = path.stat().st_mtime_ns
            tag = f'W/"{modified:x}-{path.stat().st_size:x}"'
            headers = {"ETag": tag, "Vary": "Accept-Encoding"}
            if self.headers.get("If-None-Match") == tag:
                self.send_response(304)
                for key, value in headers.items():
                    self.send_header(key, value)
                self.end_headers()
                return
            if "gzip" in self.headers.get("Accept-Encoding", "").lower():
                headers["Content-Encoding"] = "gzip"
                data = compressed_asset(name, modified)
            else:
                data = path.read_bytes()
        else:
            data = path.read_bytes()
        if name == "index.html":
            data = data.replace(b'name="care-mode" content="standalone"',
                                f'name="care-mode" content="{source_mode()}"'.encode())
            data = data.replace(b'name="care-suggestions" content="demo"',
                                f'name="care-suggestions" content="{suggestions_mode()}"'.encode())
            data = re.sub(rb'<select id="service">.*?</select>', lambda m: service_menu(), data, count=1, flags=re.S)
            data = data.replace(b'name="care-reports" content="preview"',
                                f'name="care-reports" content="{report_mode()}"'.encode())
        self.send_bytes(200, mimetypes.guess_type(name)[0] or "application/octet-stream", data, headers=headers)

    def do_POST(self):
        path = urlsplit(self.path).path
        if path.startswith("/api/admin/"):
            admin_proxy(self, "POST")
            return
        if path not in ("/api/rank", "/api/reports", "/api/service-suggestions"):
            self.send_error(404)
            return
        if path != "/api/rank" and self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "Send application/json."})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 16384:
                raise ValueError
            payload = json.loads(self.rfile.read(size))
            if path == "/api/service-suggestions" and not (isinstance(payload, dict) and valid_location(payload.get("location"))):
                raise ValueError
            if path == "/api/rank" and not valid(payload):
                raise ValueError
        except (ValueError, TypeError, UnicodeError):
            self.send_json(400, {"error": "Check the service, coordinates and radius." if path == "/api/rank" else "Invalid JSON or request fields."})
            return
        if path == "/api/service-suggestions":
            try:
                self.send_json(200, suggested_services(payload["location"]))
            except Exception:
                self.send_json(502, {"error": "Regional search statistics are unavailable."})
            return
        if path == "/api/reports":
            try:
                receipt = receive_report(payload, self.headers.get("Idempotency-Key"), SERVICES, source_mode())
                self.send_json(202, receipt)
            except ReportError as error:
                self.send_json(error.status, {"error": str(error)})
            return
        try:
            result = search(payload)
            self.send_json(200, result)
        except TimeoutError:
            self.send_json(504, {"error": "The ranking service timed out."})
        except Exception:
            self.send_json(502, {"error": "Could not retrieve a valid ranking response."})


if __name__ == "__main__":
    port = int(os.environ.get("DATABRICKS_APP_PORT") or os.environ.get("PORT") or 8000)
    print(f"CareFinder listening on port {port} ({source_mode()})", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
