#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/serve.sh [port]
PORT="${1:-6789}"

cd "$(dirname "$0")/.."

if [ ! -f "dist/server/entry.mjs" ]; then
  echo "No SSR build found. Installing dependencies and building Clawspace..."
  npm install
  vp run build
fi

if [ -f "/claw/workspace/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "/claw/workspace/.env"
  set +a
fi

HOST=0.0.0.0 PORT="$PORT" node dist/server/entry.mjs
