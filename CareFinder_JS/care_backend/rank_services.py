"""
Query-time ranking over the outputs of llm_preprocess.py.

Each step follows a published method (no hand-tuned weights):
  1. Hard filter : all essential slots confirmed (dictionary essentials; all-or-nothing as in
                   WHO EmONC signal-function classification) + within radius
  2. Readiness   : WHO SARA service-specific readiness: items scored present/absent, unweighted
                   mean within domain, then across domains. Domains from the resource kind.
  3. Certainty   : GRADE-style four levels (high/moderate/low/very low). Start from the evidence
                   type, rate down one level per concern; concerns follow WHO Data Quality Review
                   dimensions (internal consistency, timeliness). Overall = lowest across essential
                   slots. Kept separate from readiness.
  4. Counts      : SARA scores presence. A count only matters where a standard gives a minimum:
                   item = min(1, n / minimum) for resources listed in UNIT_MIN.
  Ranks          : distance_rank, relevance_rank (readiness, then certainty),
                   fused_rank = reciprocal rank fusion (Cormack, Clarke & Buttcher, SIGIR 2009),
                   k = 60; optional weight w (0.5 = standard RRF ordering).

Performance:
  Startup (once): everything that does not depend on the user's location is precomputed per
                  service: readiness, certainty, authority checks, and a BallTree (haversine)
                  over that service's candidate facilities. Evidence and facilities are hashed.
  Query         : O(1) service lookup + O(log n + k) radius search + O(k log k) ranking,
                  where k = facilities inside the radius. Explanations built for the top results only.

Usage:
  python rank_services.py --service dialysis --lat 18.5204 --lon 73.8567 --radius 15 --w 0.5
"""
import argparse, json, time
from collections import defaultdict

import numpy as np
import pandas as pd
import yaml
from sklearn.neighbors import BallTree

# ============================ CONFIG ============================
import os, glob
HERE = os.path.dirname(os.path.abspath(__file__))

def _find(env, patterns):
    if os.getenv(env):
        return os.getenv(env)
    for p in patterns:
        hits = sorted(glob.glob(os.path.join(HERE, p)))
        if hits:
            return hits[0]
    raise FileNotFoundError(f"No file for {env}: put one matching {patterns} next to this script, or set {env}")

FACILITIES_CSV = _find("DATA_FILE", ["facilities_final*.csv", "facilities_final*.parquet"])
DICT_YAML      = _find("DICT_FILE", ["*service-dictionary*.yaml", "*service_dictionary*.yaml"])
LLM_DIR        = os.getenv("OUT_DIR", os.path.join(HERE, "llm_out"))

COL = dict(id="unique_id", name="name", lat="latitude", lon="longitude",
           addr=["address_line1", "address_line2", "address_city", "address_stateOrRegion"],
           city="address_city", state="address_stateOrRegion",
           updated=["recency_of_page_update", "post_metrics_most_recent_social_media_post_date"],
           urls=["officialWebsite", "facebookLink"])

EARTH_KM     = 6371.0
UPSTREAM_GEO_FLAGS = {"remaining_issue_flags": ["coordinate_pin_distance_over_100km"],
                      "postal_coord_issue_note": ["facility_coord_far_from_postal_gt100km"]}
RRF_K        = 60       # Cormack et al. 2009 default
MIN_RESULTS  = 5        # if fewer confirmed facilities, add "unverified" claims as a fallback tier
MAX_EVIDENCE = 4
STALE_BEFORE = "2025-01-01"
UNIT_MIN     = {}       # resource -> minimum from a published standard, e.g. {"dialysis_machine": N}
                        # only fill with a number you can cite; otherwise presence-only (SARA)
LEVELS       = ["very low", "low", "moderate", "high"]
START_LEVEL  = {"admin_verified": 3, "explicit_count": 3, "corroborated": 3, "single_text": 2, "tag_only": 1}
DOMAIN_OF_KIND = {"staff": "staff", "equipment": "equipment", "infrastructure": "equipment",
                  "service": "diagnostics_and_support"}
CLAIM_TEXT   = {"admin_verified": "confirmed by an administrator after a user report",
                "explicitly_offered_at_branch": "explicitly offered at this facility",
                "listed_on_branch_service_menu": "listed in this facility's services"}
TIER_TEXT    = {"admin_verified": "verified by an administrator", "explicit_count": "with a stated count", "corroborated": "in multiple fields",
                "single_text": "in one field", "tag_only": "only as a specialty tag"}
UNVERIFIED   = {"equipment_only", "specialty_only", "mention_without_service_claim"}
# ================================================================


def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp, dl = p2 - p1, np.radians(lon2 - lon1)
    return 2 * EARTH_KM * np.arcsin(np.sqrt(np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2))


class ServiceIndex:
    """Precomputed, location-independent data for one service + spatial index over its candidates."""
    def __init__(self, rows):
        self.rows = rows
        coords = np.radians([[r["lat"], r["lon"]] for r in rows])
        self.tree = BallTree(coords, metric="haversine")
        self.tier = np.array([0 if r["capability_tier"] == "confirmed" else 1 for r in rows])
        self.rd = np.array([r["readiness"] if r["assessed"] else 0.0 for r in rows])
        self.lv = np.array([r["level"] for r in rows])
        self.geo = np.array([r["geo_flag"] for r in rows], dtype=int)


class Ranker:
    def __init__(self, corrections=()):
        t0 = time.time()
        d = yaml.safe_load(open(DICT_YAML))
        self.R, self.S = d["resources"], d["services"]
        claims = pd.read_csv(f"{LLM_DIR}/service_claims.csv")
        slots = pd.read_csv(f"{LLM_DIR}/slot_status.csv")
        ev = pd.read_csv(f"{LLM_DIR}/evidence.csv")

        self.fac = self._load_facilities()                                       # facility_id -> dict
        self.slot_idx = {(r.facility_id, r.resource): r for r in slots.itertuples(index=False)}
        self.ev_idx = defaultdict(list)                                          # (facility, slot) -> rows
        for r in ev[ev.status == "confirmed"].itertuples(index=False):
            self.ev_idx[(r.facility_id, r.slot)].append(r)
        self._profiles = {}
        claims = self._apply_corrections(claims, corrections)
        self.claims = claims
        self.index = self._build_service_indexes(claims)                         # service_id -> ServiceIndex
        self.build_seconds = round(time.time() - t0, 2)

    # ---------- facility table + quality flags (hashed by id) ----------
    def _load_facilities(self):
        f = (pd.read_parquet(FACILITIES_CSV) if FACILITIES_CSV.endswith(".parquet")
             else pd.read_csv(FACILITIES_CSV, low_memory=False)).drop_duplicates(COL["id"]).set_index(COL["id"])
        f["lat"] = pd.to_numeric(f[COL["lat"]], errors="coerce")
        f["lon"] = pd.to_numeric(f[COL["lon"]], errors="coerce")
        st = f.groupby(COL["state"])[["lat", "lon"]].transform("median")
        ct = f.groupby(COL["city"])[["lat", "lon"]].transform("median")
        f["geo_flag"] = (haversine(f.lat, f.lon, st.lat, st.lon) > 300) | (haversine(f.lat, f.lon, ct.lat, ct.lon) > 50)
        # upstream location flags (cleaning team): coordinates far from the facility's postcode
        for col, bad in UPSTREAM_GEO_FLAGS.items():
            if col in f.columns:
                f["geo_flag"] |= f[col].astype(str).str.contains("|".join(bad), na=False)
        dates = pd.concat([pd.to_datetime(f[c], errors="coerce", utc=True) for c in COL["updated"]], axis=1)
        f["last_updated"] = dates.max(axis=1)
        f["stale"] = f.last_updated < pd.Timestamp(STALE_BEFORE, tz="UTC")
        f = f[f.lat.notna() & f.lon.notna()]
        f["location_note"] = None
        keep = ["lat", "lon", "geo_flag", "last_updated", "stale", "location_note", COL["name"]] + \
               [c for c in COL["addr"] + COL["urls"] if c in f.columns]
        return f[keep].to_dict("index")

    # ---------- admin corrections (explicit, audited edits applied over the base tables) ----------
    def _apply_corrections(self, claims, corrections):
        from types import SimpleNamespace
        for c in corrections:
            fid, ch, rid = c["facility_id"], c["change"], c["report_id"]
            kind = ch.get("kind")
            if fid not in self.fac and kind != "none":
                continue
            if kind == "set_location":
                self.fac[fid].update(lat=float(ch["latitude"]), lon=float(ch["longitude"]), geo_flag=False,
                                     location_note=f"Coordinates corrected by an administrator (report {rid})")
            elif kind == "set_details":
                for k, v in ch.get("fields", {}).items():
                    self.fac[fid][k] = v
            elif kind == "edit":
                claims = self._apply_edit(claims, fid, c["service_id"], ch, rid)
            elif kind == "set_service":
                sid = c["service_id"]
                claims = claims[~((claims.facility_id == fid) & (claims.service_id == sid))]
                if ch.get("offered"):
                    note = ch.get("note", "").strip() or "Verified by an administrator."
                    row = dict(facility_id=fid, service_id=sid, claim_type="admin_verified", status="confirmed",
                               method="admin", modality=None, branch_identity_ok=True, gate_pass=True,
                               tier="admin_verified", conf=1.0, best_field="admin_correction",
                               best_quote=note, record_id=rid)
                    claims = pd.concat([claims, pd.DataFrame([row])], ignore_index=True)
                    self.ev_idx[(fid, f"{sid}_offered")].insert(
                        0, SimpleNamespace(field="admin_correction", quote=note, record_id=rid))
        return claims

    def _apply_edit(self, claims, fid, sid, ch, rid):
        """Generic admin edit: a list of explicit operations on one facility."""
        from types import SimpleNamespace
        note = (ch.get("note") or "").strip() or "Verified by an administrator."
        for op in ch.get("ops", []):
            kind = op.get("op")
            if kind == "details":
                self.fac[fid].update(op["fields"])
            elif kind == "location":
                self.fac[fid].update(lat=float(op["latitude"]), lon=float(op["longitude"]), geo_flag=False,
                                     location_note=f"Coordinates corrected by an administrator (report {rid})")
            elif kind == "service":
                claims = self._apply_corrections(claims, [dict(facility_id=fid, service_id=sid, report_id=rid,
                    change={"kind": "set_service", "offered": op["offered"], "note": note})])
            elif kind == "remove_quote":
                key = (fid, op["slot"])
                self.ev_idx[key] = [e for e in self.ev_idx.get(key, []) if e.quote != op["quote"]]
                row = self.slot_idx.get((fid, op["slot"]))
                if row is not None and not self.ev_idx[key] and getattr(row, "tier", None) != "admin_verified":
                    self.slot_idx.pop((fid, op["slot"]), None)          # no evidence left -> unknown
            elif kind == "resource":
                r, status = op["resource"], op["status"]
                if status == "unknown":
                    self.slot_idx.pop((fid, r), None)
                    continue
                self.slot_idx[(fid, r)] = SimpleNamespace(
                    facility_id=fid, resource=r, status="confirmed" if status == "present" else "contradicted",
                    tier="admin_verified", conf=1.0, count=op.get("count"), n_fields=1,
                    best_field="admin_correction", best_quote=note, record_id=rid)
                if status == "present":
                    self.ev_idx[(fid, r)].insert(0, SimpleNamespace(field="admin_correction", quote=note, record_id=rid))
        return claims

    # ---------- step 3: certainty (GRADE-style levels, DQR rate-down reasons) ----------
    @staticmethod
    def certainty(tier, fac):
        if tier not in START_LEVEL:
            return 0, ["no positive evidence"]
        if tier == "admin_verified":
            return 3, [TIER_TEXT[tier]]
        level, why, concerns = START_LEVEL[tier], [f"evidence {TIER_TEXT[tier]}"], []
        if fac["geo_flag"]:
            concerns.append("internal inconsistency: coordinates vs stated city/state")
        if fac["stale"]:
            concerns.append(f"timeliness: last updated {fac['last_updated'].date()}")
        return max(0, level - len(concerns)), why + [f"rated down: {c}" for c in concerns]

    # ---------- step 2: profile from the dictionary (cached per service x modality) ----------
    def profile(self, sid, modality):
        key = (sid, modality)
        if key in self._profiles:
            return self._profiles[key]
        s = self.S[sid]

        def usable(slots):
            out = []
            for slot in slots or []:
                alts = [r for r in slot.split("|") if r in self.R and self.R[r]["kind"] in DOMAIN_OF_KIND]
                if alts:
                    out.append(alts)
            return out

        slots = usable(s.get("supporting"))
        mp = (s.get("modality_profiles") or {}).get(modality)
        if mp:
            slots += [a for a in usable(mp.get("supporting")) if a not in slots]
        auth = []
        for a in s.get("authority_readiness") or []:
            if s.get("modality_profiles") and not mp:
                continue                    # modality-specific authority: only when modality is stated
            auth.append(dict(ref=a["authority_ref"], essential=usable(a.get("essential"))))
        self._profiles[key] = (slots, auth)
        return slots, auth

    # ---------- steps 2 + 4: SARA item score ----------
    def slot_score(self, fid, alts):
        best = (0.0, None, "unknown", None)        # score, resource, status, row
        for r in alts:
            row = self.slot_idx.get((fid, r))
            if row is None:
                continue
            if row.status != "confirmed":
                if best[2] == "unknown":
                    best = (0.0, r, row.status, row)
                continue
            score = min(1.0, row.count / UNIT_MIN[r]) if r in UNIT_MIN and pd.notna(row.count) else 1.0
            if score > best[0] or best[2] != "confirmed":
                best = (score, r, "confirmed", row)
        return best

    def readiness(self, fid, slots):
        if not slots:
            return None, {}, []
        domains, detail = defaultdict(list), []
        for alts in slots:
            score, r, status, row = self.slot_score(fid, alts)
            domains[DOMAIN_OF_KIND[self.R[alts[0]]["kind"]]].append(score)
            detail.append(dict(slot="|".join(alts), resource=r, status=status,
                               tier=getattr(row, "tier", None) if status == "confirmed" else None,
                               count=getattr(row, "count", None)))
        dom_means = {k: float(np.mean(v)) for k, v in domains.items()}
        return float(np.mean(list(dom_means.values()))), dom_means, detail

    # ---------- startup: precompute everything location-independent, per service ----------
    def _build_service_indexes(self, claims):
        claims = claims[claims.facility_id.isin(self.fac.keys())]
        keep = claims[(claims.gate_pass == True) |
                      (claims.claim_type.isin(UNVERIFIED) & (claims.branch_identity_ok == True))]
        index = {}
        for sid, grp in keep.groupby("service_id"):
            if sid not in self.S:
                continue
            rows = []
            for c in grp.itertuples(index=False):
                fac = self.fac[c.facility_id]
                slots, auth = self.profile(sid, c.modality if isinstance(c.modality, str) else None)
                rd, dom, detail = self.readiness(c.facility_id, slots)
                auth_res = []
                for a in auth:
                    miss = [" or ".join(self.name_of(r) for r in alts) for alts in a["essential"]
                            if self.slot_score(c.facility_id, alts)[2] != "confirmed"]
                    auth_res.append(dict(ref=a["ref"], met=len(a["essential"]) - len(miss),
                                         total=len(a["essential"]), missing=miss))
                level, why = self.certainty(c.tier if isinstance(c.tier, str) else None, fac)
                rows.append(dict(claim=c, facility_id=c.facility_id, lat=fac["lat"], lon=fac["lon"],
                                 geo_flag=bool(fac["geo_flag"]),
                                 capability_tier="confirmed" if c.gate_pass == True else "unverified",
                                 readiness=rd, domains=dom, detail=detail, auth=auth_res,
                                 level=level, why=why, assessed=rd is not None))
            index[sid] = ServiceIndex(rows)
        return index

    # ---------- explanation (built for returned results only) ----------
    def name_of(self, r):
        return (self.R[r].get("synonyms") or [r])[0].lower()

    def explain(self, sid, row, fac):
        c = row["claim"]
        parts = [f"{self.S[sid]['display_name']} is {CLAIM_TEXT.get(c.claim_type, c.claim_type.replace('_', ' '))}"
                 f" ({TIER_TEXT.get(c.tier, 'unverified')})."]
        conf = [self.name_of(d["resource"]) + (f" ({int(d['count'])})" if pd.notna(d["count"]) and d["count"] else "")
                for d in row["detail"] if d["status"] == "confirmed"]
        if conf:
            parts.append("Supporting evidence: " + ", ".join(conf) + ".")
        unc = []
        if not row["assessed"]:
            unc.append("Readiness not assessed: the service profile has no staff/equipment requirements.")
        for d in row["detail"]:
            label = " or ".join(self.name_of(r) for r in d["slot"].split("|"))
            if d["status"] == "unknown":
                unc.append(f"No evidence of {label}.")
            elif d["status"] in ("contradicted", "conflicting"):
                unc.append(f"Record {d['status']} on {label}.")
            elif d["tier"] == "tag_only":
                unc.append(f"{label.capitalize()} appears only as a specialty tag.")
        for a in row["auth"]:
            if a["missing"]:
                unc.append(f"{a['ref']} checklist items not documented: {', '.join(a['missing'])}.")
        if fac["geo_flag"]:
            unc.append("Coordinates are inconsistent with the stated city/state; location may be inaccurate.")
        if pd.isna(fac["last_updated"]):
            unc.append("No update date available for this record.")
        elif fac["stale"]:
            unc.append(f"Record last updated {fac['last_updated'].date()}; information may be outdated.")
        return " ".join(parts), unc

    def evidence_for(self, fid, sid, detail):
        out, seen = [], set()
        keys = [(fid, f"{sid}_offered")] + [(fid, d["resource"]) for d in detail if d["status"] == "confirmed"]
        for k in keys:
            for r in self.ev_idx.get(k, [])[:1]:
                if (r.field, r.quote) not in seen:
                    seen.add((r.field, r.quote))
                    out.append(dict(field=r.field, quote=r.quote, record_id=r.record_id))
        return out[:MAX_EVIDENCE]

    # ---------- query ----------
    def rank(self, sid, lat, lon, radius_km, w=0.5, top=10):
        empty = dict(service_id=sid, radius_km=radius_km, distance_method="straight_line", results=[])
        idx = self.index.get(sid)                                       # O(1)
        if idx is None:
            return empty

        ids, dist = idx.tree.query_radius(np.radians([[lat, lon]]), r=radius_km / EARTH_KM,
                                          return_distance=True)        # O(log n + k)
        ids, d = ids[0], dist[0] * EARTH_KM
        if len(ids) == 0:
            return empty

        # step 1: hard filter; unverified tier only as a fallback
        tier = idx.tier[ids]
        if (tier == 0).sum() >= MIN_RESULTS:
            m = tier == 0
            ids, d, tier = ids[m], d[m], tier[m]
        rd, lv, geo = idx.rd[ids], idx.lv[ids], idx.geo[ids]
        n = len(ids)

        # distance rank: unreliable coordinates go last
        order = np.lexsort((d, geo))
        dist_rank = np.empty(n, int); dist_rank[order] = np.arange(1, n + 1)
        # relevance rank: tier > readiness (SARA) > certainty (GRADE) > distance
        order = np.lexsort((d, -lv, -rd, tier))
        rel_rank = np.empty(n, int); rel_rank[order] = np.arange(1, n + 1)
        # fused: weighted RRF; confirmed always before unverified
        rrf = w / (RRF_K + rel_rank) + (1 - w) / (RRF_K + dist_rank)
        order = np.lexsort((rel_rank, -rrf, tier))

        results = []
        for pos, j in enumerate(order[:top], 1):
            row = idx.rows[ids[j]]
            fac = self.fac[row["facility_id"]]
            reason, unc = self.explain(sid, row, fac)
            results.append(dict(
                facility_id=row["facility_id"], facility_name=fac[COL["name"]],
                latitude=round(float(fac["lat"]), 5), longitude=round(float(fac["lon"]), 5),
                address=", ".join(str(fac[k]) for k in COL["addr"] if isinstance(fac.get(k), str)),
                location_basis=fac.get("location_note") or
                               ("Facility coordinates from the dataset" + (" (flagged)" if fac["geo_flag"] else "")),
                distance_km=round(float(d[j]), 2),
                distance_rank=int(dist_rank[j]), relevance_rank=int(rel_rank[j]), fused_rank=pos,
                capability_tier=row["capability_tier"],
                confidence=LEVELS[row["level"]], confidence_basis=row["why"],
                readiness=None if row["readiness"] is None else round(row["readiness"], 3),
                readiness_domains={k: round(v, 3) for k, v in row["domains"].items()},
                authority_checks=row["auth"],
                items_documented=[" or ".join(self.name_of(r) for r in d["slot"].split("|")) if d["status"] != "confirmed"
                                  else self.name_of(d["resource"]) for d in row["detail"] if d["status"] == "confirmed"],
                items_missing=[" or ".join(self.name_of(r) for r in d["slot"].split("|"))
                               for d in row["detail"] if d["status"] != "confirmed"],
                relevance_reason=reason,
                evidence=self.evidence_for(row["facility_id"], sid, row["detail"]),
                record_source_urls=[fac[k] for k in COL["urls"] if isinstance(fac.get(k), str)],
                uncertainties=unc))
        return dict(service_id=sid, radius_km=radius_km, distance_method="straight_line",
                    ranking=dict(fused="weighted_rrf", rrf_k=RRF_K, w_relevance=w),
                    n_candidates=n, results=results)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--service", required=True)
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--radius", type=float, default=30)
    ap.add_argument("--w", type=float, default=0.5, help="weight on relevance in RRF (0..1)")
    ap.add_argument("--top", type=int, default=10)
    a = ap.parse_args()
    print(json.dumps(Ranker().rank(a.service, a.lat, a.lon, a.radius, a.w, a.top), indent=2, default=str))
