#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Clawspace runtime build (SSR only)
npx astro check
npx astro build

echo "✅ Clawspace build complete (dist/server/entry.mjs)"
