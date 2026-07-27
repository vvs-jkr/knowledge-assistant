#!/bin/sh
set -eu

SOURCE_REPOSITORY="${SOURCE_REPOSITORY:-https://github.com/vvs-jkr/knowledge-assistant.git}"
SOURCE_BRANCH="${SOURCE_BRANCH:-main}"
SOURCE_COMMIT="${SOURCE_COMMIT:-}"
if [ -z "$SOURCE_COMMIT" ] || [ "$SOURCE_COMMIT" = "unknown" ]; then
  SOURCE_COMMIT="$(git ls-remote "$SOURCE_REPOSITORY" "refs/heads/$SOURCE_BRANCH" 2>/dev/null | awk 'NR == 1 { print $1 }')"
fi
if [ -z "$SOURCE_COMMIT" ]; then
  echo "Cannot determine the source commit for this build." >&2
  exit 1
fi

export SOURCE_COMMIT

docker compose --env-file /artifacts/build-time.env -f docker-compose.prod.yml build --pull
docker push ghcr.io/vvs-jkr/knowledge-assistant-api:latest
docker push ghcr.io/vvs-jkr/knowledge-assistant-web:latest
