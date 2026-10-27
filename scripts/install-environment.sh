#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Lagerprogramm
if [ ! -f package-lock.json ] || [ ! -f src/main.tsx ]; then
  echo 'Lagerraum-Quelldateien fehlen. Den vorbereiteten Snapshot oder das gesicherte Quellarchiv wiederherstellen; der Git-Initialstand allein enthält keine Anwendung.' >&2
  exit 1
fi
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run build
npm test
npm run build:standalone
mkdir -p /workspace/shared
cp standalone/index.html /workspace/shared/Lagerraum-Vorschau.html
