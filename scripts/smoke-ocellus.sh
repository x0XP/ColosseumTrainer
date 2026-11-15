#!/usr/bin/env bash
set -euo pipefail

# Minimal browser smoke test: no additional npm dependencies.
# Confirms that React mounted the Ocellus UI with the full generated bundle.
BROWSER="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || true)"
if [[ -z "$BROWSER" ]]; then
  echo "Chrome or Chromium is required for the Ocellus smoke test" >&2
  exit 1
fi

python3 -m http.server 8765 --bind 127.0.0.1 --directory dist > /tmp/ocellus-smoke-http.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for i in $(seq 1 50); do
  if curl -fsS http://127.0.0.1:8765/index.html >/dev/null; then break; fi
  sleep 0.1
done
curl -fsS http://127.0.0.1:8765/osrs-assets/manifest.json >/dev/null

# Do not hide the stderr log when something goes wrong.
timeout 50 "$BROWSER" \
  --headless=new --no-sandbox --disable-dev-shm-usage \
  --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader \
  --disable-background-networking --no-first-run \
  --window-size=1280,850 --virtual-time-budget=12000 \
  --dump-dom http://127.0.0.1:8765/ \
  > /tmp/ocellus-smoke-dom.html 2> /tmp/ocellus-smoke-browser.log || {
    echo "Browser startup failed"; tail -80 /tmp/ocellus-smoke-browser.log; exit 1;
  }

if ! grep -q 'id="right_panel"' /tmp/ocellus-smoke-dom.html || \
   ! grep -q 'THE FRACTURED ARCHIVE' /tmp/ocellus-smoke-dom.html || \
   ! grep -q 'ocellus-fight-status' /tmp/ocellus-smoke-dom.html; then
  echo "Ocellus React UI did not render" >&2
  head -c 9000 /tmp/ocellus-smoke-dom.html >&2
  tail -80 /tmp/ocellus-smoke-browser.log >&2
  exit 1
fi
echo "Ocellus browser smoke check: React sidebar and status panel rendered."
