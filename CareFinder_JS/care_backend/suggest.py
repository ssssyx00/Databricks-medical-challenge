"""
"Suggested for your area": services ranked by LOCAL HEALTH NEED (NFHS-5 district indicators).

There is no search-log data, so we do not claim "most searched". Instead, for the district at the
user's location, each indicator is ranked against all ~700 districts; services linked to indicators
where the district is in the worst quarter nationally are suggested, each with a cited reason.
"""
import math
import re
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree

# indicator column -> (plain-language label, higher_is_worse, services it points to)
INDICATORS = {
    "adult_high_sugar": ("adults with high blood sugar", True, ["diabetes_care", "dialysis", "diabetic_retinopathy_care"]),
    "adult_high_bp": ("adults with high blood pressure", True, ["electrocardiogram_ecg", "echocardiography"]),
    "all_w15_49_who_are_anaemic_pct": ("women aged 15-49 who are anaemic", True, ["blood_bank", "blood_transfusion"]),
    "births_delivered_by_csection_5y_pct": ("births delivered by C-section", True, ["c_section", "emergency_c_section"]),
    "institutional_birth_5y_pct": ("births in a health facility", False, ["vaginal_delivery", "antenatal_prenatal_care"]),
    "mothers_who_had_at_least_4_anc_visits_lb5y_pct": ("mothers with 4+ antenatal visits", False, ["antenatal_prenatal_care"]),
    "child_12_23m_fully_vaccinated_based_on_information_from_eit_pct": ("children aged 12-23 months fully vaccinated", False, ["vaccination_and_immunization"]),
    "women_age_30_49_years_ever_undergone_a_cervical_screen_pct": ("women aged 30-49 ever screened for cervical cancer", False, ["cervical_screening_pap_smear"]),
    "women_age_30_49_years_ever_undergone_a_breast_exam_pct": ("women aged 30-49 ever given a breast exam", False, ["mammography"]),
    "m15_plus_who_use_any_kind_of_tobacco_pct": ("men aged 15+ who use tobacco", True, ["cancer_screening"]),
    "fp_unmet_total_cm_w15_49_7_pct": ("women with unmet need for family planning", True, ["family_planning"]),
}
WORST_SHARE = 0.5           # suggest when the district is worse than the national median
MAX_KM = 75                 # farther than this from any district centre -> no suggestion


STATE_ALIASES = {"maharastra": "maharashtra", "nctofdelhi": "delhi"}   # NFHS spellings


def canon_state(s):
    s = re.sub(r"[^a-z]", "", str(s).lower()).replace("and", "")
    return STATE_ALIASES.get(s, s)


def key(state, district):
    return canon_state(state) + "|" + re.sub(r"[^a-z]", "", str(district).lower())


def num(v):
    """NFHS cells: '12.3', '(12.3)' = based on few cases, '*' = suppressed."""
    if isinstance(v, (int, float)):
        return (float(v), False) if math.isfinite(v) else (None, False)
    s = str(v).strip()
    if not s or s == "*":
        return None, False
    few = s.startswith("(")
    try:
        return float(s.strip("() ")), few
    except ValueError:
        return None, False


class Suggester:
    def __init__(self, health_csv, centroids_csv, valid_services):
        h = pd.read_csv(health_csv, low_memory=False)
        h["key"] = [key(s, d) for s, d in zip(h.state_ut, h.district_name)]
        h = h.drop_duplicates("key").set_index("key")
        cols = {}
        for c in [c for c in INDICATORS if c in h.columns] + [
                "w15_plus_with_high_or_very_high_gt_140_mg_dl_blood_sugar_or_pct", "m15_plus_with_high_or_very_high_gt_140_mg_dl_blood_sugar_or_pct",
                "w15_plus_with_high_bp_sys_gte_140_mmhg_and_or_dia_gte_90_mm_pct", "m15_plus_with_high_bp_sys_gte_140_mmhg_and_or_dia_gte_90_mm_pct"]:
            parsed = h[c].map(num)
            cols[c] = parsed.map(lambda t: t[0]); cols[c + "__few"] = parsed.map(lambda t: t[1])
        v = pd.DataFrame(cols, index=h.index)
        v["adult_high_sugar"] = v[["w15_plus_with_high_or_very_high_gt_140_mg_dl_blood_sugar_or_pct",
                                   "m15_plus_with_high_or_very_high_gt_140_mg_dl_blood_sugar_or_pct"]].mean(axis=1)
        v["adult_high_bp"] = v[["w15_plus_with_high_bp_sys_gte_140_mmhg_and_or_dia_gte_90_mm_pct",
                                "m15_plus_with_high_bp_sys_gte_140_mmhg_and_or_dia_gte_90_mm_pct"]].mean(axis=1)
        v["adult_high_sugar__few"] = v["adult_high_bp__few"] = False
        self.values = v
        # share of districts this district is worse than (0..1), per indicator
        self.worse_than = pd.DataFrame({c: (v[c].rank(pct=True) if hi else (-v[c]).rank(pct=True))
                                        for c, (_, hi, _) in INDICATORS.items()}, index=v.index)
        fix = {"Maharastra": "Maharashtra"}
        self.names = {k: f"{d.strip()}, {fix.get(s.strip(), s.strip())}" for k, d, s in zip(h.index, h.district_name, h.state_ut)}
        cen = pd.read_csv(centroids_csv)
        cen["key"] = [key(*k.split("|", 1)) for k in cen.key]
        cen = cen.groupby("key", as_index=False).agg(lat=("lat", "median"), lon=("lon", "median"))
        self.coverage = (int(cen.key.isin(self.values.index).sum()), len(cen))
        cen = cen[cen.key.isin(self.values.index)]
        self.cen_keys = cen.key.tolist()
        self.tree = BallTree(np.radians(cen[["lat", "lon"]].values), metric="haversine")
        self.valid = set(valid_services)

    def suggest(self, lat, lon, limit=5):
        d, i = self.tree.query(np.radians([[lat, lon]]), k=1)
        if d[0][0] * 6371 > MAX_KM:
            return []
        k = self.cen_keys[i[0][0]]
        out = {}
        for c, (label, hi, services) in INDICATORS.items():
            share, val = self.worse_than.at[k, c], self.values.at[k, c]
            if pd.isna(share) or pd.isna(val) or share < 1 - WORST_SHARE:
                continue
            few = bool(self.values.at[k, c + "__few"])
            reason = (f"{self.names[k]}: {val:.1f}% {label}, worse than {share * 100:.0f}% of districts "
                      f"(NFHS-5{', small sample' if few else ''}).")
            for s in services:
                if s in self.valid and (s not in out or share > out[s][0]):
                    out[s] = (share, reason)
        ranked = sorted(out.items(), key=lambda kv: -kv[1][0])[:limit]
        return [{"id": s, "reason": r} for s, (_, r) in ranked]
