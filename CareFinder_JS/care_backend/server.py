"""
CareFinder data backend: ranking + issue-report inbox.

  POST /rank      {"service_id", "origin": {"latitude", "longitude", "label"}, "radius_km"}
                  -> ranking JSON in the frontend's contract (+ fusion_method)
  POST /reports   report event from the frontend (Idempotency-Key header == report_id)
                  -> {"report_id": ..., "status": "pending"}   (201 new, 200 duplicate, 409 conflict)
  GET  /reports?status=pending&limit=100   pending reports for the admin review
  GET  /health

Run:  python care_backend/server.py      (port CARE_BACKEND_PORT, default 8001)
"""
import hmac
import json
import math
import threading
import os
import sqlite3
import sys
from contextlib import closing
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

HERE = Path(__file__).resolve().parent
DATA = Path(os.getenv("CARE_DATA_DIR", HERE / "data"))
os.environ.setdefault("DATA_FILE", str(DATA / "facilities_slim.csv") if (DATA / "facilities_slim.csv").exists()
                      else str(DATA / "facilities_final_9989.csv"))
os.environ.setdefault("DICT_FILE", str(DATA / "datathon-service-dictionary.yaml"))
os.environ.setdefault("OUT_DIR", str(DATA / "llm_out_all"))
sys.path.insert(0, str(HERE))

import rank_services  # noqa: E402

TOP_PER_LIST = int(os.getenv("CARE_TOP_PER_LIST", "25"))   # top-K of each of the three rankings
FUSION_TEXT = (
    "How we decide. (1) Eligibility: a facility is shown only if its own record states it provides this "
    "service. Each of ~10,000 records was read by an LLM and every claim is tied to a verbatim quote; "
    "referrals, planned services, other branches, equipment-only and passing mentions are excluded. "
    "Facilities outside your straight-line radius are excluded. "
    "(2) Best Match ranks by readiness: the share of the service's required staff, equipment and "
    "diagnostics that the record documents (WHO SARA method; requirements from our service dictionary, "
    "e.g. the national dialysis programme checklist for dialysis). Ties are broken by evidence certainty "
    "(GRADE-style: stated count or several fields > one field > specialty tag only; rated down for "
    "location conflicts or outdated records). "
    "(3) Nearest ranks by straight-line distance; facilities with suspect coordinates go last. "
    "(4) Balanced combines the Best Match and Nearest ranks with reciprocal rank fusion (k=60), weighting "
    "readiness and closeness equally. Trade-off: a closer facility with thinner documentation can outrank "
    "a better-documented one farther away; use Best Match when capability matters more than distance. "
    "Readiness reflects what the record documents, not an inspection: missing evidence is reported as "
    "unknown, never as absent.")
import yaml  # noqa: E402
AUTHORITY_TITLES = {k: v.get("title", k) for k, v in
                    (yaml.safe_load(open(os.environ["DICT_FILE"])).get("authorities") or {}).items()}
REPORTS_DB = Path(os.getenv("CARE_REPORTS_DB", DATA / "reports.sqlite3"))
ISSUES = {"service", "location", "facility_details", "evidence", "other"}
REPORT_KEYS = ("report_id", "facility_id", "service_id", "record_id", "issue_type",
               "suggested_change", "source_url", "data_mode", "status")

RANKER = None
RANKER_LOCK = threading.Lock()


def connect():
    REPORTS_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(REPORTS_DB, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("""CREATE TABLE IF NOT EXISTS facility_reports (
        report_id TEXT PRIMARY KEY, facility_id TEXT, service_id TEXT NOT NULL, record_id TEXT,
        issue_type TEXT NOT NULL, suggested_change TEXT NOT NULL, source_url TEXT,
        data_mode TEXT NOT NULL, status TEXT NOT NULL, received_at TEXT NOT NULL)""")
    cols = {r[1] for r in conn.execute("PRAGMA table_info(facility_reports)")}
    for col in ("decided_at", "decision"):
        if col not in cols:
            conn.execute(f"ALTER TABLE facility_reports ADD COLUMN {col} TEXT")
    conn.execute("""CREATE TABLE IF NOT EXISTS data_corrections (
        correction_id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT UNIQUE NOT NULL,
        facility_id TEXT, service_id TEXT, kind TEXT NOT NULL, change TEXT NOT NULL,
        old_value TEXT, applied_at TEXT NOT NULL)""")
    return conn


def load_corrections():
    with closing(connect()) as conn:
        rows = conn.execute("SELECT * FROM data_corrections ORDER BY correction_id").fetchall()
    return [dict(report_id=r["report_id"], facility_id=r["facility_id"], service_id=r["service_id"],
                 change=json.loads(r["change"])) for r in rows]


def rebuild_ranker():
    """Build a new ranker with all corrections applied, then swap it in (searches keep working)."""
    global RANKER
    with RANKER_LOCK:
        new = rank_services.Ranker(corrections=load_corrections())
        RANKER = new
    return new


print("Loading ranking data ...", flush=True)
rebuild_ranker()
from suggest import Suggester  # noqa: E402
SUGGESTER = Suggester(DATA / "district_health_nfhs5.csv", DATA / "district_centroids.csv", RANKER.S.keys())
print(f"Ranker ready: {len(RANKER.index)} services ({RANKER.build_seconds}s)", flush=True)


# ------------------------------ ranking ------------------------------
def clean(obj):
    """JSON-safe: NaN/inf -> None, numpy scalars -> Python."""
    if isinstance(obj, dict):
        return {k: clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean(v) for v in obj]
    if hasattr(obj, "item") and not isinstance(obj, (str, bytes)):
        obj = obj.item()
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    return obj


def search(payload):
    sid = payload["service_id"]
    lat, lon = float(payload["origin"]["latitude"]), float(payload["origin"]["longitude"])
    radius = payload["radius_km"]
    out = RANKER.rank(sid, lat, lon, float(radius), w=0.5, top=10 ** 9)
    n = out.get("n_candidates", 0)
    keep = [r for r in out["results"]
            if min(r["fused_rank"], r["distance_rank"], r["relevance_rank"]) <= TOP_PER_LIST]
    for r in keep:                                   # frontend rejects distance > radius
        r["distance_km"] = min(r["distance_km"], float(radius))
        explain(r, n)
    return clean(dict(service_id=sid, radius_km=radius, distance_method="straight_line",
                      results=keep, fusion_method=FUSION_TEXT,
                      n_candidates=out.get("n_candidates", 0)))


def explain(r, n):
    """Put WHY into the fields the UI displays: relevance_reason and uncertainties."""
    why = [r["relevance_reason"]]                                   # claim + evidence tier
    basis = r.get("confidence_basis", [])
    why.append(f"Evidence certainty: {r['confidence']}" + (f" ({'; '.join(basis)})." if basis else "."))
    docs, miss = r.get("items_documented", []), r.get("items_missing", [])
    if r.get("readiness") is None:
        why.append("Readiness: not assessed (this service has no staff/equipment requirement profile).")
    else:
        total = len(docs) + len(miss)
        why.append(f"Readiness {r['readiness']:.2f} (averaged over staff, equipment and diagnostics): "
                   f"{len(docs)} of {total} required items documented"
                   + (f" ({', '.join(docs)})" if docs else "") + ".")
    for a in r.get("authority_checks", []):
        why.append(f"{AUTHORITY_TITLES.get(a['ref'], a['ref'])}: {a['met']} of {a['total']} essential items documented.")
    why.append(f"Why this position: Balanced #{r['fused_rank']} of {n} combines Nearest #{r['distance_rank']} "
               f"({r['distance_km']:.1f} km) and Best Match #{r['relevance_rank']}.")
    r["relevance_reason"] = "\n".join(why)                         # one point per line in the UI
    if r["confidence"] in ("low", "very low"):
        r["uncertainties"] = [f"Evidence for this service is {r['confidence']} certainty; confirm with the "
                              "facility before travelling."] + r["uncertainties"]


# ------------------------------ reports ------------------------------
class BadReport(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def validate_report(body, key):
    if not isinstance(body, dict) or set(body) - set(REPORT_KEYS):
        raise BadReport(400, "Unexpected report fields.")
    try:
        rid = str(UUID(str(body.get("report_id"))))
    except ValueError:
        raise BadReport(400, "report_id must be a UUID.") from None
    if key != body.get("report_id"):
        raise BadReport(400, "Idempotency-Key header must equal report_id.")
    ev = {k: body.get(k) for k in REPORT_KEYS}
    ev["report_id"] = rid
    if ev["issue_type"] not in ISSUES:
        raise BadReport(400, "issue_type must be one of " + ", ".join(sorted(ISSUES)))
    if ev["data_mode"] not in ("demo", "live") or ev["status"] != "pending":
        raise BadReport(400, "data_mode must be demo|live and status must be pending.")
    for k, limit, required in (("service_id", 80, True), ("suggested_change", 2000, True),
                               ("facility_id", 256, False), ("record_id", 256, False),
                               ("source_url", 2048, False)):
        v = ev[k]
        if v is None and not required:
            continue
        if not isinstance(v, str) or not v.strip() or len(v) > limit:
            raise BadReport(400, f"Check the {k} field.")
    return ev


def store_report(ev):
    with closing(connect()) as conn, conn:
        cur = conn.execute(
            """INSERT INTO facility_reports (report_id, facility_id, service_id, record_id, issue_type,
               suggested_change, source_url, data_mode, status, received_at)
               VALUES (:report_id,:facility_id,:service_id,:record_id,
               :issue_type,:suggested_change,:source_url,:data_mode,:status,:received_at)
               ON CONFLICT(report_id) DO NOTHING""",
            {**ev, "received_at": datetime.now(timezone.utc).isoformat(timespec="seconds")})
        if cur.rowcount == 1:
            return 201
        saved = dict(conn.execute("SELECT * FROM facility_reports WHERE report_id=?", (ev["report_id"],)).fetchone())
        if any(saved[k] != ev[k] for k in REPORT_KEYS if k != "status"):
            raise BadReport(409, "That report_id already belongs to a different report.")
        return 200                                    # same report retried: idempotent


def list_reports(status, limit):
    with closing(connect()) as conn:
        q = "SELECT * FROM facility_reports" + (" WHERE status=?" if status else "") + \
            " ORDER BY received_at DESC LIMIT ?"
        rows = conn.execute(q, ((status, limit) if status else (limit,))).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["change"] = json.loads(d.pop("decision") or "null")
        out.append(d)
    return out


# ------------------------------ admin ------------------------------
ADMIN_KEY = os.getenv("CARE_ADMIN_KEY", "")
DETAIL_FIELDS = {"name": 256, "address_line1": 256, "address_line2": 256, "address_city": 128,
                 "address_stateOrRegion": 128}


def with_names(rep):
    """Add human-readable facility and service names for the admin page."""
    f = RANKER.fac.get(rep.get("facility_id")) if rep.get("facility_id") else None
    rep["facility_name"] = f.get("name") if f else None
    rep["facility_address"] = ", ".join(str(f[k]) for k in ("address_line1", "address_city", "address_stateOrRegion")
                                        if f and isinstance(f.get(k), str)) or None
    svc = RANKER.S.get(rep.get("service_id")) or {}
    rep["service_name"] = svc.get("display_name", rep.get("service_id"))
    return clean(rep)


def admin_ok(header):
    if not ADMIN_KEY:
        raise BadReport(503, "Admin access is not configured (set CARE_ADMIN_KEY).")
    if not hmac.compare_digest((header or "").encode(), ("Bearer " + ADMIN_KEY).encode()):
        raise BadReport(401, "Wrong administrator key.")


def facility_snapshot(fid, sid):
    """Current values the admin sees before editing (from the live, corrected ranker)."""
    r = RANKER
    f = r.fac.get(fid)
    if f is None:
        raise BadReport(404, "Unknown facility.")
    c = r.claims[(r.claims.facility_id == fid) & (r.claims.service_id == sid)] if sid else r.claims.iloc[0:0]
    offered = bool(len(c) and c.gate_pass.astype(bool).any())
    quotes = [dict(field=e.field, quote=e.quote) for e in r.ev_idx.get((fid, f"{sid}_offered"), [])[:3]]
    modality = c.modality.iloc[0] if len(c) and isinstance(c.modality.iloc[0], str) else None
    resources = []
    if sid and sid in r.S:
        slots, _ = r.profile(sid, modality)
        for res in dict.fromkeys(x for alts in slots for x in alts):
            row = r.slot_idx.get((fid, res))
            st = getattr(row, "status", None)
            resources.append(dict(resource=res, label=r.name_of(res), kind=r.R[res]["kind"],
                                  status={"confirmed": "present", "contradicted": "absent"}.get(st, "unknown"),
                                  count=getattr(row, "count", None),
                                  quotes=[dict(field=e.field, quote=e.quote) for e in r.ev_idx.get((fid, res), [])[:6]]))
    return clean(dict(facility_id=fid, service_id=sid,
                      **{k: f.get(k) for k in DETAIL_FIELDS}, latitude=f["lat"], longitude=f["lon"],
                      location_flagged=bool(f["geo_flag"]), location_note=f.get("location_note"),
                      service_offered=offered, service_claim=(c.claim_type.iloc[0] if len(c) else None),
                      service_quotes=quotes, resources=resources))


def validate_change(report, change):
    if not isinstance(change, dict):
        raise BadReport(400, "Accepting a report needs an explicit data change.")
    kind = change.get("kind")
    fid = report["facility_id"]
    if kind == "none":
        return {"kind": "none", "note": str(change.get("note", ""))[:1000]}
    if not fid:
        raise BadReport(400, "This report is not about a facility; only 'no data change' is possible.")
    if kind == "edit":
        ops, out = change.get("ops"), []
        note = change.get("note")
        if not isinstance(ops, list) or not ops:
            raise BadReport(400, "Change at least one value, or accept without a data change.")
        if not isinstance(note, str) or len(note.strip()) < 5:
            raise BadReport(400, "Say how the change was verified (at least 5 characters).")
        for op in ops:
            k = op.get("op") if isinstance(op, dict) else None
            if k == "details":
                out.append({"op": k, **validate_change(report, {"kind": "set_details", "fields": op.get("fields")})}); out[-1].pop("kind")
            elif k == "location":
                v = validate_change(report, {"kind": "set_location", "latitude": op.get("latitude"), "longitude": op.get("longitude")})
                out.append({"op": k, "latitude": v["latitude"], "longitude": v["longitude"]})
            elif k == "service" and isinstance(op.get("offered"), bool):
                out.append({"op": k, "offered": op["offered"]})
            elif k == "resource" and op.get("status") in ("present", "absent", "unknown") and isinstance(op.get("resource"), str):
                cnt = op.get("count")
                if cnt is not None and not (isinstance(cnt, int) and 0 <= cnt <= 100000):
                    raise BadReport(400, "Counts must be whole numbers.")
                out.append({"op": k, "resource": op["resource"], "status": op["status"], "count": cnt})
            elif k == "remove_quote" and isinstance(op.get("slot"), str) and isinstance(op.get("quote"), str):
                out.append({"op": k, "slot": op["slot"], "quote": op["quote"]})
            else:
                raise BadReport(400, "Unrecognised edit.")
        return {"kind": "edit", "ops": out, "note": note.strip()[:1000]}
    if kind == "set_location":
        lat, lon = change.get("latitude"), change.get("longitude")
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (lat, lon)) \
                or not (6 <= lat <= 37.5 and 68 <= lon <= 97.5):
            raise BadReport(400, "Enter coordinates inside India.")
        return {"kind": kind, "latitude": float(lat), "longitude": float(lon)}
    if kind == "set_details":
        fields = change.get("fields")
        if not isinstance(fields, dict) or not fields or set(fields) - set(DETAIL_FIELDS):
            raise BadReport(400, "Choose facility details to change.")
        for k, v in fields.items():
            if not isinstance(v, str) or not v.strip() or len(v) > DETAIL_FIELDS[k]:
                raise BadReport(400, f"Check the {k} value.")
        return {"kind": kind, "fields": {k: v.strip() for k, v in fields.items()}}
    if kind == "set_service":
        note = change.get("note")
        if not isinstance(change.get("offered"), bool) or not isinstance(note, str) or len(note.strip()) < 5:
            raise BadReport(400, "Say whether the service is offered and how it was verified (min. 5 characters).")
        return {"kind": kind, "offered": change["offered"], "note": note.strip()[:1000]}
    raise BadReport(400, "Unknown change kind.")


def decide(body):
    if not isinstance(body, dict) or body.get("status") not in ("accepted", "rejected"):
        raise BadReport(400, "Send report_id and status accepted|rejected.")
    rid, status = str(body.get("report_id")), body["status"]
    with closing(connect()) as conn, conn:
        rep = conn.execute("SELECT * FROM facility_reports WHERE report_id=?", (rid,)).fetchone()
        if rep is None:
            raise BadReport(404, "Unknown report.")
        rep = dict(rep)
        change = validate_change(rep, body.get("change")) if status == "accepted" else None
        if rep["status"] != "pending":                       # idempotent retry vs conflicting decision
            if rep["status"] == status and json.loads(rep["decision"] or "null") == change:
                return {"report_id": rid, "status": status, "change": change, "data_updated": False}
            raise BadReport(409, f"This report was already {rep['status']}.")
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        if change and change["kind"] != "none":
            old = facility_snapshot(rep["facility_id"], rep["service_id"])
            conn.execute("""INSERT INTO data_corrections (report_id, facility_id, service_id, kind, change, old_value, applied_at)
                            VALUES (?,?,?,?,?,?,?)""", (rid, rep["facility_id"], rep["service_id"], change["kind"],
                                                        json.dumps(change), json.dumps(old), now))
        conn.execute("UPDATE facility_reports SET status=?, decided_at=?, decision=? WHERE report_id=?",
                     (status, now, json.dumps(change) if change else None, rid))
    updated = bool(change and change["kind"] != "none")
    if updated:
        rebuild_ranker()                                      # search results reflect the change now
    return {"report_id": rid, "status": status, "change": change, "data_updated": updated}


# ------------------------------ HTTP ------------------------------
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def reply(self, code, obj):
        data = json.dumps(obj, allow_nan=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == "/health":
            return self.reply(200, {"ok": True, "services": len(RANKER.index)})  # noqa
        if url.path == "/reports":
            q = parse_qs(url.query)
            return self.reply(200, list_reports(q.get("status", ["pending"])[0],
                                                min(int(q.get("limit", ["100"])[0]), 1000)))
        if url.path in ("/admin/reports", "/admin/facility", "/admin/corrections"):
            try:
                admin_ok(self.headers.get("Authorization"))
                q = parse_qs(url.query)
                if url.path == "/admin/reports":
                    return self.reply(200, [with_names(r) for r in list_reports(None, 1000)])
                if url.path == "/admin/facility":
                    return self.reply(200, facility_snapshot(q.get("facility_id", [""])[0],
                                                             q.get("service_id", [None])[0]))
                with closing(connect()) as conn:
                    return self.reply(200, [dict(r) for r in conn.execute(
                        "SELECT * FROM data_corrections ORDER BY correction_id DESC")])
            except BadReport as e:
                return self.reply(e.status, {"error": str(e)})
        self.reply(404, {"error": "not found"})

    def do_POST(self):
        path = urlsplit(self.path).path
        try:
            size = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(size)) if 0 < size <= 65536 else None
        except (ValueError, UnicodeError):
            body = None
        if path == "/rank":
            try:
                return self.reply(200, search(body))
            except (KeyError, TypeError, ValueError):
                return self.reply(400, {"error": "Check service_id, origin and radius_km."})
        if path == "/suggestions":
            try:
                loc = body["location"]
                return self.reply(200, SUGGESTER.suggest(float(loc["latitude"]), float(loc["longitude"])))
            except (KeyError, TypeError, ValueError):
                return self.reply(400, {"error": "Send {location: {latitude, longitude}}."})
        if path == "/admin/reports":
            try:
                admin_ok(self.headers.get("Authorization"))
                return self.reply(200, decide(body))
            except BadReport as e:
                return self.reply(e.status, {"error": str(e)})
        if path == "/reports":
            try:
                ev = validate_report(body, self.headers.get("Idempotency-Key"))
                code = store_report(ev)
                return self.reply(code, {"report_id": ev["report_id"], "status": "pending"})
            except BadReport as e:
                return self.reply(e.status, {"error": str(e)})
        self.reply(404, {"error": "not found"})


if __name__ == "__main__":
    port = int(os.getenv("CARE_BACKEND_PORT", "8001"))
    print(f"CareFinder backend on 127.0.0.1:{port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
