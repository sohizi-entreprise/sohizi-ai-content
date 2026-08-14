#!/usr/bin/env bash
# Renders a one-second text composition inside the container image and checks
# that a playable MP4 comes back. Run after `pnpm container:build`.
set -euo pipefail

IMAGE="${IMAGE:-sohizi-remotion-renderer}"
PORT="${PORT:-8788}"
TOKEN="${TOKEN:-smoke-token}"
JOB_ID="smoke-$(date +%s)"
CONTAINER_NAME="sohizi-render-smoke-$$"
OUTPUT="${OUTPUT:-$(mktemp -d)/smoke.mp4}"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> starting $IMAGE on :$PORT"
docker run -d --rm \
  --name "$CONTAINER_NAME" \
  -p "$PORT:8080" \
  -e "RENDER_TOKEN=$TOKEN" \
  -e RENDER_CONCURRENCY=2 \
  "$IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/health"
echo

echo "==> submitting render $JOB_ID"
curl -fsS -X POST "http://127.0.0.1:$PORT/renders" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d @- <<JSON >/dev/null
{
  "jobId": "$JOB_ID",
  "projectId": "00000000-0000-4000-8000-000000000000",
  "compositionId": "00000000-0000-4000-8000-000000000001",
  "composition": {
    "fps": 30,
    "width": 640,
    "height": 360,
    "durationInFrames": 30,
    "tracks": [
      {
        "id": "track-1",
        "type": "text",
        "name": "Text",
        "muted": false,
        "hidden": false,
        "clips": [
          {
            "id": "clip-1",
            "trackId": "track-1",
            "type": "text",
            "startFrame": 0,
            "endFrame": 30,
            "sourceStartFrame": 0,
            "sourceDurationInFrames": 30,
            "text": "Smoke test",
            "fontSize": 64,
            "color": "#ffffff",
            "fontFamily": "sans-serif",
            "fontWeight": "bold",
            "align": "center",
            "opacity": 1,
            "xRatio": 0,
            "yRatio": 0,
            "widthRatio": 1,
            "heightRatio": 1
          }
        ]
      }
    ]
  }
}
JSON

echo "==> waiting for the render"
STATE="running"
for _ in $(seq 1 300); do
  STATUS=$(curl -fsS "http://127.0.0.1:$PORT/renders/$JOB_ID" -H "Authorization: Bearer $TOKEN")
  STATE=$(printf '%s' "$STATUS" | sed -n 's/.*"state":"\([a-z]*\)".*/\1/p')
  [ "$STATE" = "running" ] || break
  sleep 1
done
echo "$STATUS"

if [ "$STATE" != "completed" ]; then
  echo "==> render did not complete (state=$STATE)" >&2
  docker logs "$CONTAINER_NAME" >&2 || true
  exit 1
fi

echo "==> downloading output to $OUTPUT"
curl -fsS "http://127.0.0.1:$PORT/renders/$JOB_ID/output" \
  -H "Authorization: Bearer $TOKEN" -o "$OUTPUT"
curl -fsS -X DELETE "http://127.0.0.1:$PORT/renders/$JOB_ID" \
  -H "Authorization: Bearer $TOKEN" >/dev/null

SIZE=$(wc -c <"$OUTPUT" | tr -d ' ')
if [ "$SIZE" -lt 1000 ]; then
  echo "==> output is suspiciously small ($SIZE bytes)" >&2
  exit 1
fi

echo "==> smoke test passed ($SIZE bytes)"
