"""Receive facility corrections for review, separately from facility search."""
import io
import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from uuid import UUID

ISSUES = {"service", "location", "facility_details", "evidence", "other"}
FIELDS = ("facility_id", "service_id", "record_id", "issue_type", "suggested_change", "source_url")


class ReportError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def report_mode():
    if os.getenv("REPORT_API_URL"):
        return "webhook"
    if os.getenv("REPORTS_VOLUME"):
        return "volume"
    if os.getenv("DATABRICKS_APP_NAME") or os.getenv("DATABRICKS_APP_PORT"):
        return "unconfigured"
    return "local"


def _clean(value, key, limit, required=True):
    raw = value.get(key)
    if not required and raw in (None, ""):
        return None
    if not isinstance(raw, str) or len(raw.strip()) > limit or not raw.strip():
        raise ReportError(400, "Please check the " + key.replace("_", " ") + " field.")
    return raw.strip()


def normalize_report(payload, key, services, data_mode):
    if not isinstance(payload, dict) or set(payload) - set(FIELDS):
        raise ReportError(400, "Unexpected report fields.")
    try:
        uid = UUID(str(key))
        if uid.version != 4:
            raise ValueError
    except (ValueError, TypeError):
        raise ReportError(400, "Send a UUID v4 in the Idempotency-Key header.") from None

    event = dict(report_id=str(uid), facility_id=_clean(payload, "facility_id", 256, False),
                 service_id=_clean(payload, "service_id", 80), record_id=_clean(payload, "record_id", 256, False),
                 issue_type=_clean(payload, "issue_type", 48), suggested_change=_clean(payload, "suggested_change", 2000),
                 source_url=_clean(payload, "source_url", 2048, False), data_mode=data_mode, status="pending")
    if event["service_id"] not in services or event["issue_type"] not in ISSUES:
        raise ReportError(400, "Choose a supported service and issue type.")
    if event["facility_id"] is None and (event["record_id"] or event["issue_type"] not in ("location", "other")):
        raise ReportError(400, "Choose a facility for this issue type.")
    if event["source_url"]:
        try:
            url = urlsplit(event["source_url"])
            if url.scheme not in ("https", "http") or not url.hostname or url.username or url.password or any(c.isspace() for c in event["source_url"]):
                raise ValueError
            _ = url.port
        except ValueError:
            raise ReportError(400, "Enter a valid http or https source link.") from None
    return event


def _timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _match(event, saved):
    if any(event[k] != saved.get(k) for k in (*FIELDS, "data_mode", "report_id")):
        raise ReportError(409, "That submission ID already belongs to a different report.")


def _local(event):
    default = Path.home() / ".local" / "state" / "carefinder" / "reports.sqlite3"
    db = Path(os.getenv("REPORT_DB_PATH") or default)
    db.parent.mkdir(exist_ok=True, parents=True)
    with closing(sqlite3.connect(db, timeout=10)) as conn, conn:
        conn.row_factory = sqlite3.Row
        conn.execute("""CREATE TABLE IF NOT EXISTS facility_reports (
            report_id TEXT PRIMARY KEY, facility_id TEXT, service_id TEXT NOT NULL, record_id TEXT,
            issue_type TEXT NOT NULL, suggested_change TEXT NOT NULL, source_url TEXT, data_mode TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending', received_at TEXT NOT NULL)""")
        conn.execute("""INSERT INTO facility_reports
            (report_id, facility_id, service_id, record_id, issue_type, suggested_change, source_url, data_mode, status, received_at)
            VALUES(:report_id,:facility_id,:service_id,:record_id,:issue_type,:suggested_change,:source_url,:data_mode,:status,:received_at)
            ON CONFLICT(report_id) DO NOTHING""", {**event, "received_at": _timestamp()})
        saved = dict(conn.execute("SELECT * FROM facility_reports WHERE report_id=?", (event["report_id"],)).fetchone())
        _match(event, saved)


@lru_cache(maxsize=1)
def _workspace():
    from databricks.sdk import WorkspaceClient
    return WorkspaceClient()


def _volume(event):
    from databricks.sdk.errors import ResourceConflict
    spec = os.environ["REPORTS_VOLUME"].strip().rstrip("/")
    if spec.startswith("/Volumes/"):
        parts = spec[len("/Volumes/"):].split("/")
    else:
        parts = spec.split(".")
    if len(parts) != 3 or any(not p or p in (".", "..") or "/" in p for p in parts):
        raise ReportError(503, "The report inbox is not configured correctly.")
    directory = "/Volumes/" + "/".join(parts) + "/carefinder-inbox"
    path = directory + "/" + event["report_id"] + ".json"
    files = _workspace().files
    files.create_directory(directory)
    data = json.dumps({**event, "received_at": _timestamp()}, ensure_ascii=False).encode()
    try:
        files.upload(path, io.BytesIO(data), overwrite=False)
    except ResourceConflict:
        with closing(files.download(path).contents) as stream:
            _match(event, json.load(stream))


def _forward(event):
    headers = {"Content-Type": "application/json", "Accept": "application/json", "Idempotency-Key": event["report_id"]}
    if os.getenv("REPORT_API_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["REPORT_API_TOKEN"]
    request = Request(os.environ["REPORT_API_URL"], method="POST", headers=headers, data=json.dumps(event).encode())
    try:
        with urlopen(request, timeout=12) as response:
            receipt = json.loads(response.read(16_384))
    except HTTPError as exc:
        if exc.code == 409:
            raise ReportError(409, "That submission ID already belongs to a different report.") from exc
        raise
    if not isinstance(receipt, dict) or receipt.get("report_id") != event["report_id"] or receipt.get("status") != "pending":
        raise ReportError(502, "The review service did not confirm receipt. You can retry this report.")


def receive_report(payload, key, services, data_mode):
    event = normalize_report(payload, key, services, data_mode)
    mode = report_mode()
    if mode == "unconfigured":
        raise ReportError(503, "The review inbox has not been connected to this app.")
    try:
        {"local": _local, "volume": _volume, "webhook": _forward}[mode](event)
    except ReportError:
        raise
    except Exception as exc:
        raise ReportError(503, "Could not confirm receipt. Your draft is still here. Please retry.") from exc
    return {"report_id": event["report_id"], "status": "pending"}
