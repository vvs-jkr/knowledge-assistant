#!/bin/sh
set -eu

EXPECTED_COMMIT="${SOURCE_COMMIT:?Coolify must expose SOURCE_COMMIT during deployment}"
TIMEOUT_SECONDS="${IMAGE_WAIT_TIMEOUT_SECONDS:-900}"
POLL_SECONDS="${IMAGE_WAIT_POLL_SECONDS:-10}"

API_IMAGE="ghcr.io/vvs-jkr/knowledge-assistant-api:latest"
WEB_IMAGE="ghcr.io/vvs-jkr/knowledge-assistant-web:latest"
STARTED_AT="$(date +%s)"

image_revision() {
  docker image inspect "$1" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' 2>/dev/null || true
}

while :; do
  docker pull "$API_IMAGE" >/dev/null 2>&1 || true
  docker pull "$WEB_IMAGE" >/dev/null 2>&1 || true

  API_REVISION="$(image_revision "$API_IMAGE")"
  WEB_REVISION="$(image_revision "$WEB_IMAGE")"

  if [ "$API_REVISION" = "$EXPECTED_COMMIT" ] && [ "$WEB_REVISION" = "$EXPECTED_COMMIT" ]; then
    echo "Images for commit $EXPECTED_COMMIT are ready."
    exit 0
  fi

  NOW="$(date +%s)"
  ELAPSED="$((NOW - STARTED_AT))"
  if [ "$ELAPSED" -ge "$TIMEOUT_SECONDS" ]; then
    echo "Timed out waiting for images for commit $EXPECTED_COMMIT." >&2
    echo "API revision: ${API_REVISION:-missing}" >&2
    echo "Web revision: ${WEB_REVISION:-missing}" >&2
    exit 1
  fi

  echo "Waiting for commit $EXPECTED_COMMIT (api=${API_REVISION:-missing}, web=${WEB_REVISION:-missing})..."
  sleep "$POLL_SECONDS"
done
