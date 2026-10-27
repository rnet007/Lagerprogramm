> Für die Online-Testversion mit Supabase Free und Cloudflare Pages Free gilt [SUPABASE-CLOUDFLARE.md](SUPABASE-CLOUDFLARE.md). Die folgenden lokalen/SQLite-Anweisungen bleiben als Alternative erhalten.

# Cloud-Betrieb von Lagerraum

Der visuelle Baumodus ist in [BAUMODUS.md](./BAUMODUS.md) beschrieben. Die bisherige Bedienung und Datenmigration sind in [README.md](./README.md) beschrieben. Die genaue Veröffentlichungsanleitung für `rnet007/Lagerprogramm` steht in [VERCEL.md](./VERCEL.md).

## Vorhandene Umgebung nutzen

Die Cloud-Aufgabe ist bereits isoliert. Im vorhandenen Checkout `/workspace/Lagerprogramm` weiterarbeiten; keinen Git-Worktree anlegen, sofern dies nicht ausdrücklich verlangt wird. Bestehende Quelländerungen und Nutzerdaten erhalten.

Mit Node.js 24:

```sh
cd /workspace/Lagerprogramm
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run build
npm start
```

Die zentrale Version startet einen Node-Server auf Port 5176. Der erste Administrator wird separat und ohne Standardpasswort eingerichtet; siehe [BENUTZERKONTEN.md](BENUTZERKONTEN.md). Für reine lokale Prototyp-Entwicklung `npm run dev -- --port 5173` starten und `http://localhost:5173?local=1` öffnen. Der Vite-Server bindet an `0.0.0.0` und verwendet `strictPort`. Ein bereits laufender Server kann weiterverwendet werden. Keine fremden Prozesse beenden. Die interne Bereitschaft kann mit einer HTTP-Anfrage auf den Server und dem vorhandenen Browsertest geprüft werden. Ein offener Port ist keine öffentlich erreichbare Vorschau.

## Prüfung und Sicherung

```sh
npm test
npm run build
npm run build:standalone
npm run check:server
node scripts/check-accounts.mjs
BASE_URL='http://127.0.0.1:5173?local=1' CHECK_STANDALONE=1 node scripts/check-browser.mjs
BASE_URL='http://127.0.0.1:5173?local=1' node scripts/check-builder.mjs
BASE_URL='http://127.0.0.1:5173?local=1' node scripts/check-builder-library.mjs
```

Der Browsertest verwendet ein frisches Profil und fiktive Daten. Seine Ergebnisdateien und Screenshots liegen unter `/workspace/shared/lagerraum-tests`. Der Standalone-Test stellt die einzelne HTML-Datei über einen kurzlebigen lokalen HTTP-Server bereit und prüft, dass keine externen Assets nachgeladen werden. Direkte `file:`-Navigation ist in der administrativ verwalteten Chromium-Instanz blockiert.

Browserbestände gehören nicht in Repository oder Build. Sie liegen unter `lagerraum-v2`; der alte Schlüssel `lagerraum-v1` bleibt unverändert als Migrationssicherung erhalten. Daten vor einem Wechsel der Webadresse per JSON exportieren. Ein voller JSON-Export enthält alle Lager. Aus dem Entwicklungsserver oder einer HTML-Datei werden keine Bestände an Vercel übertragen.

## Umgebungsentwurf und Veröffentlichung

Der tatsächliche Repository-Mount lautet `Lagerprogramm`. Ein leerer Mount-Pfad im früheren Entwurf wurde korrigiert. Ein gespeicherter Konfigurationsentwurf führt weder Skripte aus noch veröffentlicht er einen Snapshot. Die allgemeine frühere Fehlermeldung des Dienstes nannte keine überprüfbare Ursache; die erfolgreiche spätere Veröffentlichung wurde nicht bestätigt.

In dieser Sitzung existiert kein integriertes Vorschau-/Hosting-Werkzeug. Für einen echten Web-Link ist ein Deployment erforderlich. Die Vercel-Konfiguration ist ausschließlich für die Offline-Demo vorbereitet. Die zentrale Version benötigt einen persistenten Node-Host und eine HTTPS-Domain, keine reine statische Vite-Veröffentlichung. Keine Zugangsschlüssel in Chat, Repository oder Skripten speichern.

Die lokalen Anwendungsänderungen wurden nicht automatisch nach GitHub gepusht. Das Quellarchiv enthält deshalb den vollständigen Code samt Lockfile und Deployment-Konfiguration. Vor erneutem Umgebungswechsel herunterladen oder in GitHub übernehmen. Erst eine erfolgreiche Veröffentlichung bzw. ein getesteter neuer Task belegt die Wiederherstellung.
