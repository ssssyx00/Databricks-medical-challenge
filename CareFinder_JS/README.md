# CareFinder Application

This folder contains the facility-search interface, Python servers and prepared data used by CareFinder. For the project overview, see the [main README](../README.md). For evidence extraction, scoring methods and evaluation, see [CareFinder.ipynb](../CareFinder.ipynb).

## File Guide

Paths below are relative to this folder.

| Group | Files | Purpose |
|---|---|---|
| Pages and styling | `index.html`, `admin.html`, `styles.css` | Public facility search, administrator report review and page styling. |
| Search and evidence UI | `carefinder.js`, `service-suggestions.js` | Search controls, three ranked result lists, facility selection, evidence panels and regional service suggestions. |
| User reports | `report-form.js` | Report drafts, submission and confirmation messages. |
| Map behavior | `atlas.js`, `geography.js`, `streets.js` | Map interactions, geographic layers and street detail. |
| Geographic assets | `places.js`, `india-geography.js`, `streets-data.js` | Place-search information and bundled geographic and street data. |
| Map library and fonts | `leaflet.js`, `leaflet.css`, `font-bricolage.woff2`, `font-atkinson-400.woff2`, `font-atkinson-700.woff2` | Bundled Leaflet library and interface fonts. |
| Service menu and preview | `services.json`, `service-examples.json`, `demo.js` | Service labels, sample regional suggestions and fictional preview results. |
| Web server and integration | `app.py`, `backend.py` | Serve the interface and connect search and suggestion requests to the data backend; provide a sample-search fallback when no ranking backend is configured. |
| Report and street adapters | `reports.py`, `street_proxy.py` | Validate and route reports to configured storage or an API, and proxy street-data requests. |
| Data API | `care_backend/server.py` | Ranking and suggestion endpoints, report storage, administrator review and audited corrections. |
| Ranking and local needs | `care_backend/rank_services.py`, `care_backend/suggest.py` | Service eligibility, readiness, evidence certainty, geographic ranking and NFHS-5-based suggestions. |
| Startup and dependencies | `start.sh`, `app.yaml`, `requirements.txt` | Start both servers, configure the Databricks Apps entry point and list Python dependencies. |
| Attribution | `GEOGRAPHY-SOURCES.txt`, `STREETS-SOURCES.txt`, `Leaflet-LICENSE.txt` | Geographic-data sources, street-data attribution and Leaflet license. |

## Prepared Data

These files are in `care_backend/data/`.

| Files | Purpose |
|---|---|
| `facilities_slim.csv` | Compact facility information used by the runtime. |
| `datathon-service-dictionary.yaml` | Service definitions, resource requirements and authority references. |
| `district_health_nfhs5.csv`, `district_centroids.csv` | District health indicators and district-center coordinates used for regional suggestions. |
| `llm_out_all/service_claims.csv` | Extracted facility-service claims and eligibility information. |
| `llm_out_all/slot_status.csv` | Resource-level evidence status, counts and supporting information. |
| `llm_out_all/evidence.csv` | Extracted quotations and their record/field provenance. This differs from the external citation log in [`../data_citations.csv`](../data_citations.csv). |
| `reports.sqlite3` | Local report-review database; the backend also stores correction history here. |

Files ending in `.orig` are previous source snapshots. The two `__pycache__/` directories contain generated Python bytecode, and `.DS_Store` is macOS folder metadata. These are not application entry points.

## Run Locally

From this folder, in a Python environment:

```bash
python -m pip install -r requirements.txt
bash start.sh
```

Open `http://localhost:8000` for search. To use `http://localhost:8000/admin`, configure `CARE_ADMIN_KEY` in the environment before starting the servers. The data backend defaults to port `8001`.

For a standalone sample interface, open `index.html` locally. Connected search, report persistence and administrator review require the servers. Regional suggestions in the connected application reflect NFHS-5 indicators, not measured search popularity.

The administrator can accept a report without changing data, or submit an explicit correction with a verification note. Applied corrections retain previous values and report IDs. Keep the report database on persistent storage when deploying the application.
