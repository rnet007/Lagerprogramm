#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null || ! node -e 'if(Number(process.versions.node.split(".")[0])!==24)process.exit(1)'; then
  echo 'Bitte zuerst Node.js 24 installieren.' >&2
  exit 1
fi
npm ci
npm run build
lagerraum_admin_count=$(node --import tsx --input-type=module -e "const {db}=await import('./server/auth.ts');console.log(db.prepare(\"SELECT COUNT(*) n FROM app_profile WHERE role='admin'\").get().n);db.close();")
if [ "$lagerraum_admin_count" = "0" ]; then
  read -r -p 'Kennung des ersten Administrators: ' LAGERRAUM_ADMIN_LOGIN
  read -r -p 'Anzeigename: ' LAGERRAUM_ADMIN_NAME
  export LAGERRAUM_ADMIN_LOGIN LAGERRAUM_ADMIN_NAME
  read -r -s -p 'Eigenes Passwort (12–128 Zeichen): ' lagerraum_initial_password
  printf '\n'
  printf '%s\n' "$lagerraum_initial_password" | npm run admin:init --silent
  unset lagerraum_initial_password
fi
printf 'Lagerraum wird gestartet. Lokaler Vorschau-Link: %s\n' "${PUBLIC_BASE_URL:-http://localhost:5176}"
exec npm start
