# Online-Testversion: Supabase + Cloudflare Pages

Für die gewünschte kostenlose Online-Version siehe **[SUPABASE-CLOUDFLARE.md](SUPABASE-CLOUDFLARE.md)**. Tatsächlich durchgeführte Prüfungen: [SUPABASE-PRUEFBERICHT.md](SUPABASE-PRUEFBERICHT.md). Sie verwendet ein separates Supabase-Projekt, Supabase Auth/PostgreSQL mit Datenbankrechten und Cloudflare Pages Functions. Cloudflare: Build `npm run build`, Output `dist`, Node 24. Anmeldung und zentrale Daten benötigen die dort dokumentierte SQL-Migration und drei geschützte Laufzeit-Bindings. Keine Zugangsdaten in Git oder `VITE_*`. Nur ausdrücklich erzeugte Beispieldaten; kein automatischer Upload lokaler Daten.

Die nachstehende Node-/SQLite-Anleitung beschreibt weiterhin die lokale Alternative. Statisches Vercel-Hosting bietet nur die Offline-Demo.

# Lagerraum

Lagerverwaltung mit React, TypeScript, React Three Fiber und optionalem zentralem Node-Server mit Better Auth und SQLite. Vollständig deutsche Oberfläche, getrennte Lager, offene schematische 3D-Regale sowie synchroner Lagerplan und 2D-Regalansicht. Sämtliche mitgelieferten Materialien sind fiktive Beispieldaten.

## Visueller Baumodus

Der Tab **Bauen** bietet 28 platzierbare Bauteiltypen, Hallen mit echten Wandöffnungen, Grundriss-/3D-Bearbeitung, Mehrfachauswahl, Sperren, Rückgängig/Wiederholen und zoomabhängige Beschriftungen. **Beispielhalle · Bauen** ist ein separates Lager. Bestehende Daten werden erhalten und vor dem ersten Ergänzen gesichert.

Die vollständige Bedienungs- und Prüfungsbeschreibung steht in [BAUMODUS.md](./BAUMODUS.md).

## Start und Prüfungen

Node.js 24 und npm verwenden:

```sh
bash start-lagerraum.sh
```

Das Startskript installiert Abhängigkeiten, baut die Anwendung und fragt bei der ersten Einrichtung nach einer eigenen Administratorkennung und einem verdeckt eingegebenen Passwort. Danach **http://localhost:5176** öffnen. Einzelheiten: [BENUTZERKONTEN.md](BENUTZERKONTEN.md).

Nur lokale Offline-Entwicklung ohne zentrale Konten:

```sh
npm ci
npm run dev -- --port 5173
# http://localhost:5173?local=1 öffnen
```

```sh
npm test
npm run build
npm run check:server
node scripts/check-accounts.mjs
BASE_URL='http://127.0.0.1:5173?local=1' node scripts/check-browser.mjs
BASE_URL='http://127.0.0.1:5173?local=1' node scripts/check-builder.mjs
BASE_URL='http://127.0.0.1:5173?local=1' node scripts/check-builder-library.mjs
```

Der Browsertest erwartet den laufenden Entwicklungsserver und Chromium unter `/usr/bin/chromium` (alternativ `CHROMIUM_PATH`). Er verwendet isolierte Browserprofile und verändert keine Nutzerdaten. Die Ergebnisse werden unter `/workspace/shared/lagerraum-tests` abgelegt.

## Bedienung

- **Mein Lager** oben links öffnet die Lagerverwaltung: auswählen, hinzufügen und umbenennen. Daten, Gebäude und Materialien sind je Lager getrennt.
- **3D:** Linke Maustaste dreht, Mausrad zoomt, rechte Maustaste verschiebt. Kameratasten zeigen Übersicht, vorne, seitlich und oben. Regalbeschriftungen und Rahmen fokussieren das Regal; Fächer öffnen Details. Bereiche lassen sich einzeln ausblenden und auseinanderziehen. Lagerkästen sind optional. Die Konstruktion ist schematisch, nicht vermessen.
- **Suche:** Materialnummer, Bezeichnung oder Lagerplatzcode eingeben. Ein Suchtreffer fokussiert das Fach und blendet andere Bereiche desselben Regals vorübergehend aus, damit der Treffer sichtbar bleibt. Diese lassen sich über „Bereiche ein-/ausblenden“ wieder aktivieren.
- **Lager bearbeiten:** Im Lagerplan Regale ziehen oder am orangefarbenen Griff drehen; alternativ Pfeiltasten zum Verschieben um 0,1 m (Umschalt: 1 m), `[` / `]` zum Drehen um 15°. Position und Drehung werden beim Loslassen gespeichert. Die Planansicht passt sich der tatsächlichen Lagerausdehnung an.
- **Regal bearbeiten:** Direkte 2D-/3D-Vorschau für Maße, Spalten, Ebenen und Bereiche. Fächer in der Vorschau anklicken, Codes ändern oder leere Fächer aus dem Entwurf entfernen. Erst „Regal speichern“ übernimmt Änderungen; „Abbrechen“ verwirft sie. Belegte Fächer sind geschützt.
- **Materialien und Bestände:** Materialien erstellen und bearbeiten, mehreren Fächern zuordnen, Bestände teilweise oder vollständig umlagern. Führende Nullen bleiben erhalten.
- **JSON:** Gesamtexport mit allen Lagern (Version 2). Import alter Version-1-Dateien nur in das aktive Lager. Vor jedem Ersetzen wird bestätigt. Beispieldaten zurücksetzen wirkt ausschließlich auf das aktive Lager.

## Datenhaltung

Bestehende Daten unter `lagerraum-v1` werden unverändert „Mein Lager“ zugeordnet und in `lagerraum-v2` migriert. Der alte Speichereintrag bleibt als Sicherung erhalten. Vor der ersten Baumodus-Migration wird außerdem eine vorhandene Version-2-Lagerverwaltung unter `lagerraum-v2-vor-baumodus` gesichert. Hallen und Bauteile werden innerhalb der jeweiligen Lagerdaten gespeichert und vollständig exportiert. Das zuletzt ausgewählte Lager bleibt nach Neuladen geöffnet. Bei beschädigten Speicherdaten wird nicht überschrieben; Änderungen werden gesperrt und die Originaldaten können gesichert werden.

In der lokalen Demo liegen Daten ausschließlich im Browser. Die zentrale Version speichert sie getrennt pro freigegebenem Lager in SQLite und erzwingt Zugriffsrechte serverseitig. Lokale Daten werden nicht automatisch übertragen; der bestätigte Migrationsweg ist in [BENUTZERKONTEN.md](BENUTZERKONTEN.md) beschrieben. Regelmäßig JSON beziehungsweise die zentrale Datenbank sichern. Bei einer neuen Webadresse zuerst mit Beispieldaten testen; der Browser übernimmt Daten nicht automatisch zwischen Domains. Eigene Daten sind kein Teil des veröffentlichten Builds.

## Veröffentlichung

Die Veröffentlichung ist in [VERCEL.md](./VERCEL.md) erklärt. `vercel.json` veröffentlicht ausschließlich die gekennzeichnete Offline-Demo. Die zentrale Version benötigt einen Node-24-Host mit persistentem Speicher, HTTPS und eigenem Auth-Secret; siehe [BENUTZERKONTEN.md](BENUTZERKONTEN.md).

Eine eigenständige HTML-Datei kann zusätzlich gebaut werden:

```sh
npm run build:standalone
```

Ausgabe: `standalone/index.html`. Sie enthält alle Assets. Direktes Öffnen über `file:` wird von manchen administrativ verwalteten Browsern blockiert; der Browsertest prüft die Datei über einen statischen HTTP-Server.

## Grenzen

Schematische Geometrie ohne Kollisions-, Traglast- oder Sicherheitsprüfung. Bis zu 50 lokale Lager, 100 Regale je Lager und 20 × 20 Rasterplätze je Bereich. Kein Mehrbenutzerbetrieb, Etikettendruck, Scanner oder Benutzerrechte. 3D benötigt WebGL. Bei großen Lagern kann die Darstellung langsamer werden.

## Excel-/CSV-Import

Unter Materialien ist ein lokaler Import mit Blatt-/Spaltenwahl, Vorschau, expliziter Konfliktentscheidung und dauerhafter Prüfliste verfügbar. Details und Bedienung: [EXCEL-IMPORT.md](EXCEL-IMPORT.md). Bestehende Daten bleiben erhalten; neue Fachzuordnungen erfinden keine Bestandsmenge.

## Excel für die Lagerstruktur

Unter **Lager bearbeiten** sind XLSX-Export, eine markierte Vorlage und der Strukturimport mit Vorschau verfügbar. Anleitung, Bearbeitungsregeln und Grenzen: [STRUKTUR-EXCEL.md](STRUKTUR-EXCEL.md). Materialien und Bestände werden dabei nicht verändert.

## Excel-Kontrollliste

Unter **Lager bearbeiten** bietet der kombinierte Kontrollexport ein Blatt je Regal und **Noch kein Lagerplatz** mit sieben lesbaren Spalten. Struktur und Kontrollwerte können gemeinsam mit Vorschau importiert werden. Details: [KONTROLLLISTE.md](KONTROLLLISTE.md). Unbestätigte Vorschläge und tatsächliche Fachzuordnungen bleiben getrennt; Prüfwerte und Bemerkungen werden lokal und in JSON-Sicherungen erhalten.

## Einräum-Modus

Eine eigene Arbeitsansicht mit Scanner-/Tastatureingabe, alten Lagerplätzen, großen 2D-Fächern, derselben 3D-Geometrie, automatischer Fachfolge, expliziter Zusatzzuordnung/Umlagerung und direktem Rückgängig. Bedienung und Mengensemantik: [EINRAEUMEN.md](EINRAEUMEN.md).

## Manueller SAP-Abgleich

Der Tab **SAP-Abgleich** sammelt neue Einräum-Zuordnungen und bewusst markierte bestehende Zuordnungen pro Lager. Offene/erledigte Fälle, unveränderliche Verlaufssnapshots, kopierbare Angaben und ein XLSX-Export unterstützen die manuelle Prüfung. Keine SAP-Verbindung oder automatische SAP-Änderung. Bedienung: [SAP-ABGLEICH.md](SAP-ABGLEICH.md).

## Benutzerkonten und zentraler Server

Die zentrale Version verwendet Better Auth und eine persistente SQLite-Datenbank. Sicherer Start mit Node.js 24: `bash start-lagerraum.sh` (fragt den ersten Administrator samt verdecktem eigenen Passwort ab), danach **http://localhost:5176**. Kein Standardpasswort, keine öffentliche Registrierung und kein automatischer Import lokaler Daten. Details zu Rollen, Bootstrap, Passwort-Reset, Datenübernahme und öffentlichem Betrieb: [BENUTZERKONTEN.md](BENUTZERKONTEN.md).

Die einzelne HTML-Datei bleibt eine ausdrücklich lokale Demo ohne zentrale Benutzerrechte. Der normale Build benötigt den Node-Server; reine statische Vercel-Veröffentlichung reicht für die zentrale Version nicht mehr aus.
