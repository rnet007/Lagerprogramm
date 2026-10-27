# Lagerraum online: Supabase Free + Cloudflare Pages Free

Diese Variante verwendet **Supabase Auth + PostgreSQL** und **Cloudflare Pages mit Pages Functions**. Der vorherige lokale Node-/SQLite-Server bleibt als Alternative erhalten, wird aber bei Cloudflare nicht gestartet. Alle Unternehmensdaten und vorhandenen lokalen Sicherungen bleiben unberührt. Es werden weder andere Supabase-Projekte verändert noch Tarife oder automatische Upgrades gebucht.

## 1. Eigenes kostenloses Supabase-Projekt

1. Bei https://supabase.com/dashboard anmelden. In einer **Free-Organisation mit freiem Projektplatz** ein neues Projekt **lagerraum-test** anlegen. Falls die vorhandene Organisation bezahlt ist oder kein Free-Projektplatz frei ist: nicht auf Upgrade klicken; zuerst eine geeignete Free-Organisation bzw. einen freien Platz wählen. Andere Projekte nicht löschen, um Platz zu schaffen.
2. Eigenes starkes Datenbankpasswort im Passwortmanager speichern, Region wählen und auf die Bereitstellung warten. Dieses Passwort gehört weder in GitHub noch in den Chat und wird für die Anwendung nicht benötigt.
3. Prüfen, dass ausdrücklich **Free** ausgewählt ist; keine Bezahloptionen oder automatischen Upgrades einschalten. Aktuelle Quoten im Dashboard prüfen. Supabase-Free-Projekte können bei Inaktivität pausieren und müssen dann im Dashboard wieder gestartet werden.
4. Im **SQL Editor ausschließlich dieses neuen Projekts** den gesamten Inhalt von `supabase/migrations/202610270001_lagerraum.sql` ausführen. Nur einmal ausführen. Bei einem Fehler die Meldung prüfen; nicht wahllos erneut oder in einem anderen Projekt starten. Das Skript legt nur `lr_*`-Tabellen/Funktionen und einen Auth-Profiltrigger an und enthält keine Unternehmensdaten.
5. Unter **Authentication → Sign In / Providers** (Bezeichnung kann variieren) **Allow new users to sign up** deaktivieren; anonyme Anmeldungen deaktiviert lassen. E-Mail-/Passwort-Anmeldung aktiv lassen. Die Lagerraum-Oberfläche bietet keine Registrierung, aber die Supabase-Einstellung ist für den direkten Auth-Endpunkt ebenfalls notwendig.
6. Unter **Authentication → Users → Add user → Create new user** die eigene Admin-E-Mail und ein selbst gewähltes Passwort mit mindestens 12 Zeichen verwenden. Den Nutzer als bestätigt anlegen (Auto Confirm User). Keine Zugangsdaten in Quellcode/SQL eintragen.
7. `supabase/first-admin.sql` öffnen, dort **nur** `HIER-EIGENE-ADMIN-EMAIL-EINTRAGEN` durch diese E-Mail ersetzen und im SQL Editor desselben Projekts ausführen. Der erste Administrator hat Verwaltungsrechte, aber noch keinen Zugriff auf fremde Lager. Das Skript verweigert eine zweite Ersteinrichtung.
8. Unter **Project Settings → API / API Keys** die Projekt-URL und die beiden klassischen Projekt-API-Schlüssel bereithalten: `anon` und `service_role` (ggf. Register „Legacy anon, service_role API keys“). **service_role ist geheim und umgeht RLS**: nur als verschlüsseltes Cloudflare-Secret verwenden, nie als `VITE_*`, in GitHub, HTML oder im Chat. Die Projekt-URL ist keine Zugangsinformation.

## 2. Code in rnet007/Lagerprogramm

Der aktuelle Quellcode einschließlich `functions/`, `supabase/`, `cloudflare/`, `public/`, `wrangler.jsonc`, `package.json` und `package-lock.json` muss im Repository liegen. `dist/`, `node_modules/`, `.dev.vars`, `.env`, Datenbanken und Schlüssel gehören nicht ins Repository.

Falls ein Quellcodepaket geliefert wurde, weil ein Push nicht möglich war: Paket in den vorhandenen lokalen Checkout entpacken und Änderungen prüfen. Dann beispielsweise:

```bash
git status
git add README.md SUPABASE-CLOUDFLARE.md package.json package-lock.json wrangler.jsonc functions supabase cloudflare public src scripts .gitignore
git diff --cached --stat
git commit -m "Add Supabase authentication and Cloudflare Pages deployment"
git push origin main
```

Vorhandene Änderungen nicht verwerfen. In dieser Anleitung stehen keine Tokens oder festen Benutzerkennwörter.

## 3. Cloudflare Pages Free verbinden

1. Unter https://dash.cloudflare.com anmelden und beim **Free-Plan** bleiben. Keine Workers-Paid-Option und keine kostenpflichtigen Zusatzdienste aktivieren. Pages Functions teilen sich die Workers-Free-Quoten; bei Erreichen der Grenzen wird nicht von dieser Anwendung automatisch ein kostenpflichtiger Tarif aktiviert.
2. **Workers & Pages → Create application → Pages → Connect to Git** wählen. Es muss ein **Pages**-Projekt sein, keine Worker-Vorlage. Cloudflare bei GitHub ausschließlich für das benötigte Repository `rnet007/Lagerprogramm` autorisieren.
3. Repository und Produktionsbranch **main** wählen. Projektname z. B. **lagerraum-test** (muss verfügbar sein).
4. Framework **None**, Build-Befehl **`npm run build`**, Ausgabeverzeichnis **`dist`**, Stammverzeichnis leer/Repository-Root. Node-Version **24** verwenden (`.nvmrc`, ggf. zusätzlich Build-Variable `NODE_VERSION=24`). Den vorhandenen Vercel-Befehl `build:standalone` hier **nicht** verwenden: er erzeugt nur die lokale Demo.
5. Unter **Settings → Variables and Secrets** für **Production**, Typ Secret/Encrypt, diese Werte hinzufügen:

| Name | Wert |
| --- | --- |
| `SUPABASE_URL` | URL des NEUEN Lagerraum-Projekts, `https://…supabase.co` |
| `SUPABASE_ANON_KEY` | `anon`-API-Key desselben Projekts |
| `SUPABASE_SERVICE_ROLE_KEY` | geheimer `service_role`-Key desselben Projekts |

**Keine `VITE_`-Präfixe verwenden.** `LAGERRAUM_TEST_MODE` ist ausschließlich für isolierte lokale Tests bestimmt und wird online nicht gesetzt. Diese Werte sind Laufzeit-Bindings der Pages Functions; neue/änderte Werte erfordern ein neues Deployment. Fremde Forks/Preview-Deployments erhalten keine Production-Secrets. Preview zunächst ohne Secrets lassen oder für eine bewusst freigegebene Vorschau nur eigene Testprojekt-Schlüssel setzen.
6. Deployment starten bzw. unter **Deployments → Retry deployment** neu bauen. Cloudflare erkennt `functions/api/[[path]].ts` im Repository-Root automatisch. `wrangler.jsonc` aktiviert Node-Kompatibilität; `_routes.json` begrenzt Function-Aufrufe auf `/api/*`. Die statischen Dateien gehen nicht durch die Datenbankfunktion.
7. Die tatsächliche von Cloudflare angezeigte **`https://<projekt>.pages.dev`**-URL öffnen. Sie wird erst nach erfolgreichem Deployment zu einem funktionierenden Link. Der Name hier in der Anleitung ist kein bereits veröffentlichter Link.
8. Im neuen Supabase-Projekt unter **Authentication → URL Configuration** die echte Pages-URL als **Site URL** eintragen. Für diese E-Mail-/Passwort-Anmeldung sind keine OAuth-Redirect-Wildcards nötig. Falls später passwortlose/E-Mail-Flows hinzukommen, nur die benötigten konkreten Redirect-URLs freigeben.

## 4. Erste Anmeldung und reine Beispieldaten

1. An der Pages-URL mit der eigenen Admin-E-Mail und dem selbst gewählten Passwort anmelden. Es gibt kein Standardkonto. Der Administrator sieht zuerst die Benutzerverwaltung, auch ohne Lager.
2. **Zugewiesene Lager öffnen** wählen. Im Willkommensbildschirm **Zwei reine Beispiellager anlegen** drücken. Das geschieht nur auf ausdrücklichen Wunsch. Beide Lager heißen **BEISPIEL · Testlager A/B**, enthalten fiktive Regale und Materialien; eines hat die Text-Materialnummer `00007045210`. Erneutes Drücken erzeugt keine Duplikate und überschreibt keine vorhandenen Beispiele.
3. Unter **Administration → Nutzer anlegen** einen Testnutzer anlegen. Z. B. Rolle Nur lesen und nur Testlager A zuweisen. Das zufällige Startpasswort erscheint einmal, gilt eine Stunde und muss beim ersten Login geändert werden. Es wird nicht im Klartext in der Datenbank gespeichert. Weitergabe privat, nicht per Chat/öffentlichem Log.
4. Echte lokale Browserdaten werden niemals automatisch übernommen. Der bisherige JSON-Export bleibt erhalten. Für diese erste Online-Version ausschließlich Beispieldaten verwenden. Der ausdrücklich bestätigte JSON-Migrationsdialog steht später weiterhin bereit, wenn die Freigabe für echte Daten geklärt ist.

## 5. Zwei unabhängige Sitzungen tatsächlich prüfen

1. Sitzung A in einem normalen Browserfenster als Admin öffnen. Sitzung B in einem privaten Fenster oder in einem zweiten Browser öffnen (ein zweiter Tab mit denselben Cookies reicht nicht). Dort den Testnutzer anmelden und das Startpasswort ändern.
2. B darf nur Testlager A sehen; Testlager B und die Benutzerverwaltung dürfen nicht zugänglich sein. Mit Nur-Lese-Rolle gibt es keine schreibenden Aktionen. Datenbank-RPCs und direkte Tabellenzugriffe sind ebenfalls durch Rechte abgesichert.
3. In A Testlager A → Materialien öffnen und den Namen des Beispielmaterials ändern. In B die Materialliste offen lassen. Spätestens nach rund **15 Sekunden** oder beim erneuten Fokussieren werden die zentralen Änderungen geladen. Die Anwendung verwendet bewusste periodische Synchronisierung, **keinen Realtime-Kanal**.
4. B neu laden: Materialnummer samt führenden Nullen und neuer Name müssen erhalten bleiben. In A einen offenen SAP-Fall erzeugen; beim berechtigten Mitarbeiter in B muss derselbe zentrale Zustand erscheinen.
5. Einen alten Datenstand gleichzeitig zu speichern versuchen: Die Datenbank lehnt eine veraltete Revision ab, statt unbemerkt andere Änderungen zu überschreiben. Die Meldung verlangt Neuladen. Ein geöffneter Bearbeitungsdialog wird durch fremde Änderungen nicht geschlossen. Die Eingabe bleibt erhalten; ein veraltetes Speichern wird abgelehnt. Eingabe gegebenenfalls kopieren, abbrechen und mit dem aktualisierten Stand erneut bearbeiten. Außerhalb von Bearbeitungsdialogen werden alte Fachdetails geschlossen.
6. Den Testnutzer in A deaktivieren. B verliert den Datenzugriff; erneut anmelden ist nicht möglich. Nach Reaktivierung einen Reset auslösen und den neuen erzwungenen Passwortwechsel prüfen.
7. Abmelden und im privaten Fenster neu öffnen: keine Lagerdaten ohne Anmeldung.

Dieser Online-Test gilt erst dann als bestanden, wenn er an der tatsächlichen Pages-URL mit dem verbundenen Projekt durchgeführt wurde. Lokale Tests ersetzen nicht den Test der bereitgestellten Online-Konfiguration.

## Technische Rechte und Speicherung

- Passwörter/Identitäten verwaltet ausschließlich Supabase Auth. Keine Passwörter in Lagerraum-Profilen. Zugriff und Refresh-Token liegen in HttpOnly-/SameSite-Cookies der Pages-Domain; bei HTTPS mit Secure. JavaScript und localStorage erhalten keine Auth-Token oder Kopie zentraler Lagerdaten.
- Jede API-Anfrage prüft das Auth-Token bei Supabase und die aktuelle aktive Profilsitzung. Passwort-Reset, Deaktivierung und Rechteänderung löschen die zugelassenen Datenbanksitzungen und sperren somit auch noch nicht abgelaufene JWTs. Direkte Auth-Anmeldung allein gewährt keinen Zugriff auf Lagerdaten.
- Alle `lr_*`-Tabellen haben Row Level Security. Browserrollen haben keine direkten Schreibrechte. Geprüfte Datenbankfunktionen erzwingen Lagerzuweisung, Rolle, Revisionsabgleich und erlaubte Felder, auch bei direktem RPC-Aufruf. Der geheime Service-Key darf daher ausschließlich in vertrauenswürdigen Pages Functions liegen.
- Administratoren erhalten für Zuweisungen einen Katalog von Lagernamen/IDs. Lagerinhalte verlangen auch bei ihnen ausdrückliche Mitgliedschaft und Leserecht.
- Die bestehende Struktur inkl. SAP-Verlauf, alternativer Materialbezeichnungen, alter Plätze und JSON-Sicherungen bleibt als versionierter JSONB-Datensatz je Lager erhalten. Bei erfolgreicher Änderung steigt dessen Revision; der Commit ist eine PostgreSQL-Transaktion.
- Die alten Bearbeitungsdialoge warten aktuell mit synchronen gleichursprünglichen Speicheranfragen auf die zentrale Antwort. Bei langsamen Netzen kann das kurz blockieren. Es gibt keine Offline-Schreibwarteschlange und kein automatisches Zusammenführen gleichzeitiger Änderungen.
- Keine E-Mail-Resets, MFA, kostenpflichtigen Funktionen oder Anbindung an tatsächliche SAP-Daten eingerichtet. Kostenlose Ressourcen sind begrenzt und besitzen keine garantierte Verfügbarkeit. Vor echtem Betrieb Datenschutz, Backups und Wiederherstellung gesondert prüfen. Lokale SQLite-Konten werden nicht automatisch nach Supabase kopiert; Nutzer werden im eigenen Projekt neu angelegt.

## Fehler gezielt eingrenzen

| Verhalten | Prüfen |
| --- | --- |
| „Supabase ist noch nicht verbunden“ | Drei Secret-Bindings für die richtige Pages-Umgebung, anschließend neu deployen. |
| `/api/me` liefert HTML statt JSON | `functions/` im Root fehlt, falsches Build-Verzeichnis oder nur statischer Upload ohne Functions. Git-Deployment und Functions-Build prüfen. |
| Login scheitert | Free-Projekt pausiert? Benutzer bestätigt/aktiv? SQL-Migration ausgeführt? Admin-E-Mail korrekt? Temporäres Passwort abgelaufen? URL und beide Keys vom selben neuen Projekt? |
| „Zuerst Startpasswort ändern“ | Erzwungenen Wechsel durchführen; das ist vor Datenzugriff beabsichtigt. |
| Kein Lager sichtbar | Explizite Zuweisung erforderlich; Admin hat keinen pauschalen Zugriff. Beispiele nur ausdrücklich erzeugen. |
| Keine Synchronisierung | B wirklich unabhängige Sitzung? Gleiches Projekt? 15 Sekunden abwarten/fokussieren, Fehler in Network und Function-Logs prüfen, keine Secrets aus Logs teilen. |
| „Lager inzwischen geändert“ | Revisionskonflikt: Eingaben sichern, Daten neu laden und Änderung erneut vornehmen. |
| Free-Limit erreicht | Quoten/Pause im jeweiligen Dashboard prüfen; keinen kostenpflichtigen Plan aktivieren. |

## Lokale technische Prüfung

```bash
npm ci
npm test
npm run check:cloudflare
npm run build:cloudflare
```

`node scripts/check-supabase-cloudflare.mjs` benötigt Docker und Chromium. Es startet isolierte Container für PostgreSQL, Supabase GoTrue und PostgREST und führt die Functions im echten Cloudflare-workerd-Runtime aus. Alle Kennwörter/Schlüssel werden zufällig im Speicher erzeugt. Diese Prüfung verwendet keine Online-Projekte. Der Prüfbericht unterscheidet ausdrücklich lokale Integration und noch ausstehenden Online-Test.
