#!/usr/bin/env bash
# Starts the data backend (ranking + report inbox) on localhost, then the CareFinder web app.
set -e
cd "$(dirname "$0")"
export CARE_BACKEND_PORT=${CARE_BACKEND_PORT:-8001}
python care_backend/server.py &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null' EXIT
python - <<PY
import time, urllib.request
for _ in range(120):
    try:
        urllib.request.urlopen("http://127.0.0.1:${CARE_BACKEND_PORT}/health", timeout=2); break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("backend did not start")
PY
export RANK_API_URL=${RANK_API_URL:-http://127.0.0.1:$CARE_BACKEND_PORT/rank}
export CARE_BACKEND_URL=http://127.0.0.1:$CARE_BACKEND_PORT
export SERVICE_SUGGESTIONS_API_URL=${SERVICE_SUGGESTIONS_API_URL:-http://127.0.0.1:$CARE_BACKEND_PORT/suggestions}
export REPORT_API_URL=${REPORT_API_URL:-http://127.0.0.1:$CARE_BACKEND_PORT/reports}
python app.py
