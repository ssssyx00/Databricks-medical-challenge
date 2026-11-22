"""Existing search(payload) contract. Select a live adapter via server environment."""
import importlib
import json
import math
import os
from urllib.request import Request, urlopen

def _load_services():
    """All services from services.json (generated from the service dictionary)."""
    from pathlib import Path
    path = Path(__file__).with_name("services.json")
    if path.exists():
        return {s["id"]: s["name"] for s in json.loads(path.read_text(encoding="utf-8"))}
    return {k: k for k in ("dialysis", "emergency_c_section", "nicu", "cardiac_surgery", "mri", "burn_care")}


SERVICE_NAMES = _load_services()
SERVICES = tuple(SERVICE_NAMES)


def source_mode():
    return "live" if os.getenv("RANK_API_URL") or os.getenv("CARE_RANK_MODULE") else "demo"


def distance_km(a, b, lat, lon):
    phi, psi = map(math.radians, [a, lat])
    h = (math.sin((psi - phi) / 2) ** 2
         + math.cos(phi) * math.cos(psi) * math.sin(math.radians(lon - b) / 2) ** 2)
    return 6371.0088 * 2 * math.asin(math.sqrt(min(1, h)))


def demo_search(payload):
    origin = payload["origin"]
    rows = []
    samples = [
        ("a", 26.9304, "This unit provides on-site haemodialysis.",
         "The record explicitly lists on-site haemodialysis.", ["Staffing details are not documented."]),
        ("b", 26.9844, "Our dedicated haemodialysis unit is staffed by dialysis nurses.",
         "The record describes a dedicated haemodialysis unit and identifies its nursing staff.", []),
    ]
    for key, lat, quote, reason, unknown in samples:
        d = distance_km(origin["latitude"], origin["longitude"], lat, 75.7873)
        if payload["service_id"] != "dialysis" or d > payload["radius_km"]:
            continue
        rows.append(dict(facility_id=f"demo_{key}", facility_name=f"Demo Hospital {key.upper()}",
                         latitude=lat, longitude=75.7873, address=f"Demo address {key.upper()}, Jaipur",
                         location_basis="Facility coordinates from the sample dataset",
                         distance_km=d, relevance_reason=reason, uncertainties=unknown,
                         evidence=[dict(field="description", quote=quote, record_id=f"demo_record_{key}")],
                         record_source_urls=[f"https://example.org/demo-{key}"]))
    for i, row in enumerate(sorted(rows, key=lambda r: (r["distance_km"], r["facility_id"])), 1):
        row["distance_rank"] = i
    for i, row in enumerate(sorted(rows, key=lambda r: r["facility_id"], reverse=True), 1):
        row["relevance_rank"] = i
    for i, row in enumerate(sorted(rows, key=lambda r: (r["distance_rank"] + r["relevance_rank"],
                                                        r["relevance_rank"])), 1):
        row["fused_rank"] = i
    return dict(service_id=payload["service_id"], radius_km=payload["radius_km"],
                distance_method="straight_line", results=rows,
                fusion_method="Demo rule: add distance and relevance ranks. The smaller sum wins. Ties favor the better relevance rank.")


def search(payload):
    url = os.getenv("RANK_API_URL")
    if url:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if os.getenv("RANK_API_TOKEN"):
            headers["Authorization"] = "Bearer " + os.environ["RANK_API_TOKEN"]
        req = Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urlopen(req, timeout=25) as response:
            return json.load(response)
    if os.getenv("CARE_RANK_MODULE"):
        return importlib.import_module(os.environ["CARE_RANK_MODULE"]).search(payload)
    return demo_search(payload)


def suggestions_mode():
    if os.getenv("SERVICE_SUGGESTIONS_API_URL"):
        return "live"
    return "demo" if source_mode() == "demo" else "off"


def suggested_services(location):
    mode = suggestions_mode()
    if mode == "off":
        return []
    if mode == "demo":
        from pathlib import Path
        areas = json.loads(Path(__file__).with_name("service-examples.json").read_text())
        for area in areas:
            if (abs(location["latitude"] - area["latitude"]) < 0.25 and
                    abs(location["longitude"] - area["longitude"]) < 0.25):
                return area["services"]
        return []
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if os.getenv("SERVICE_SUGGESTIONS_API_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["SERVICE_SUGGESTIONS_API_TOKEN"]
    fields = {k: location[k] for k in ("latitude", "longitude", "label")}
    req = Request(os.environ["SERVICE_SUGGESTIONS_API_URL"], method="POST", headers=headers,
                  data=json.dumps({"location": fields}).encode())
    with urlopen(req, timeout=6) as res:
        ids = json.loads(res.read(65537))
    if not isinstance(ids, list):
        raise ValueError("Expected an ordered array of service IDs")
    out, seen = [], set()
    for item in ids:                     # plain IDs or {"id": ..., "reason": ...}
        sid = item.get("id") if isinstance(item, dict) else item
        if isinstance(sid, str) and sid in SERVICES and sid not in seen:
            seen.add(sid)
            reason = item.get("reason") if isinstance(item, dict) else None
            out.append({"id": sid, "reason": reason} if isinstance(reason, str) else sid)
    return out[:5]
