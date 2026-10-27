# Veröffentlichung von Lagerraum

## Zentrale Version mit Benutzerkonten

Die neue zentrale Version benötigt Better Auth, SQLite und einen dauerhaften Node-24-Prozess mit persistentem Datenträger. Eine reine Vercel-Vite-Veröffentlichung stellt **keine** zentralen Konten, Sitzungen oder serverseitigen Lagerrechte bereit.

Für diese Version die Schritte in [BENUTZERKONTEN.md](BENUTZERKONTEN.md) verwenden: eigener stabiler Auth-Secret, HTTPS-Domain, persistentes Datenvolume, Node-Server und sichere Ersteinrichtung des Administrators. Dockerfile ist vorbereitet. Ein geeignetes Node-/Docker-Hosting mit persistentem Volume ist erforderlich. Für Vercel müsste vorher eine externe Datenbank mit passendem Auth-Adapter eingerichtet werden; diese Integration besteht derzeit nicht.

## Vorhandenes GitHub-Repository

Der vollständige aktuelle Quellcode muss zunächst in `rnet007/Lagerprogramm` liegen. Die Dateien aus `Lagerraum-Quellcode.zip` in das Repository-Hauptverzeichnis übernehmen, prüfen und nach `main` übernehmen. In dieser Sitzung wurden die Änderungen nicht gepusht.

Niemals `server-data`, SQLite-Dateien, `.env`-Dateien, echte Unternehmensdaten oder Zugangsdaten hochladen. Diese Pfade sind von Git und Docker-Buildkontext ausgeschlossen.

## Nur Offline-Prototyp als statische Demo

Eine statische Demo enthält ausschließlich lokale Browserdaten, **keine** echten zentralen Benutzerrechte. Dafür `npm ci` und `npm run build:standalone` ausführen und `standalone/index.html` verwenden. Ein konfigurierter Static-Host kann diesen Ordner veröffentlichen. Die mitgelieferte `vercel.json` baut ausdrücklich diese Offline-Demo (`build:standalone`, Ausgabe `standalone`). Der normale zentrale Build benötigt den Authentifizierungsserver und ist nicht als statische Konten-Version zu veröffentlichen.

Die bereitgestellte einzelne HTML-Vorschau ist ausdrücklich als lokaler Prototyp gekennzeichnet. Vor einem Wechsel der Adresse bestehende Daten als JSON sichern und am neuen Ort wiederherstellen.
