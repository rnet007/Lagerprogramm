# Zentrale Benutzerkonten und Administration

**Online mit Supabase und Cloudflare:** Die aktuelle Anleitung steht in [SUPABASE-CLOUDFLARE.md](SUPABASE-CLOUDFLARE.md). Die folgende Anleitung beschreibt die weiterhin nutzbare lokale Node-/SQLite-Alternative.

Der SAP-Abgleich ist fertig und bleibt erhalten. Diese Erweiterung fügt einen echten Node-Server mit **Better Auth** und **SQLite** hinzu. Benutzerrechte werden im Server geprüft, nicht nur in der Oberfläche. Die bisherige lokale Anwendung bleibt als ausdrücklich gekennzeichnete Offline-Demo nutzbar.

## Lokal mit echten Konten starten

Voraussetzungen: Node.js 24, ein Terminal, das vorhandene Repository mit dem aktuellen Quellcode. SQLite liegt standardmäßig in `server-data/lagerraum.sqlite`. Das Verzeichnis und die Entwicklungs-Signaturdatei sind von Git ausgeschlossen; es gibt kein Standardkonto und kein festes Passwort.

```bash
npm ci
npm run build
```

Ersten Administrator einmalig sicher anlegen (Bash, Passwort wird verdeckt eingelesen und ausschließlich über Standardeingabe übergeben):

```bash
export LAGERRAUM_ADMIN_LOGIN='meine-administration'
export LAGERRAUM_ADMIN_NAME='Meine Administration'
read -r -s -p 'Eigenes Adminpasswort (12–128 Zeichen): ' lagerraum_admin_password
printf '\n'
printf '%s\n' "$lagerraum_admin_password" | npm run admin:init --silent
unset lagerraum_admin_password
npm start
```

Anschließend **http://localhost:5176** öffnen und mit der gewählten Kennung und dem eigenen Passwort anmelden. Dieser Link ist nach dem Start auf dem eigenen Rechner erreichbar; er ist kein öffentlich bereitgestellter Cloud-Link. Der Bootstrap legt **keinen Lagerzugriff** an. Besteht bereits ein Administrator, verweigert der Befehl eine weitere Ersteinrichtung.

PowerShell-Alternative für die Ersteinrichtung:

```powershell
$env:LAGERRAUM_ADMIN_LOGIN = 'meine-administration'
$env:LAGERRAUM_ADMIN_NAME = 'Meine Administration'
$securePassword = Read-Host 'Eigenes Adminpasswort (12–128 Zeichen)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $plainPassword | npm run admin:init --silent
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  Remove-Variable plainPassword -ErrorAction SilentlyContinue
}
npm start
```

Passwörter werden von Better Auth als Passwort-Hashes gespeichert. Sitzungen verwenden signierte HttpOnly-Cookies mit SameSite=Lax. Im öffentlichen HTTPS-Betrieb werden Secure-Cookies verwendet. Zugangsdaten gehören nicht in Quellcode, Git, Startskripte oder Shell-Befehlsargumente.

## Nutzer, Lager und Rechte einrichten

1. Als Administrator erscheint direkt das Verwaltungs-Dashboard, auch ohne eigenes Lager.
2. **Nutzer anlegen** öffnen, Namen, Benutzername/E-Mail und Rolle wählen. Benutzerkennungen bestehen aus 3–120 ASCII-Zeichen (Buchstaben, Zahlen und `._@+-`); Namen können Umlaute enthalten. Die Kennung ist nach der Anlage in dieser Oberfläche fest; Name, Status, Rolle, Rechte und Lager sind bearbeitbar.
3. Für das erste Lager einen **Lagerverwalter** ohne zugewiesene Lager anlegen. Das zufällige Startpasswort erscheint einmalig. Sicher weitergeben, dann ausblenden.
4. Der Lagerverwalter meldet sich an, ändert zwingend das Startpasswort und legt im Willkommensbildschirm ein **leeres zentrales Lager** an. Dieses wird ihm ausdrücklich zugewiesen. Es werden weder lokale Browserdaten noch Unternehmensdaten automatisch übertragen.
5. Die Administration kann anschließend Mitarbeiter, Nur-Lese-Konten und weitere Verwalter anlegen und Lager ausdrücklich zuweisen. Der Zuweisungskatalog zeigt Administratoren Lagernamen/IDs, aber keine Lagerinhalte. Inhalte und Suche erfordern auch für Administratoren eine eigene Zuweisung und ein Leserecht.

Rollen:

| Rolle | Standardrechte |
| --- | --- |
| Administrator | Benutzerverwaltung; kein pauschaler Lagerzugriff. Bei Zuweisung zunächst Leserecht. Weitere Lagerrechte müssen ausdrücklich vergeben werden. |
| Lagerverwalter | Zugewiesene Lager, Struktur und Materialien verwalten, zuordnen, SAP-Arbeitsliste bearbeiten; leere eigene Lager anlegen. |
| Mitarbeiter | Zugewiesene Lager ansehen, Material-/Mengenzuordnungen und SAP-Arbeitsliste bearbeiten; keine Struktur-/Stammdatenänderung. |
| Nur lesen | Ausschließlich zugewiesene Lager und Materialien ansehen/exportieren. Direkte Schreibanfragen werden abgewiesen. |

Berechtigungen sind erweiterbare benannte Werte. Sie gelten pro Profil für alle zugewiesenen Lager, nicht unterschiedlich pro einzelnem Lager. Die Oberfläche koppelt Zuordnungs- und SAP-Bearbeitungsrecht, damit automatisch entstehende SAP-Arbeitsfälle gespeichert werden können. Leserecht ist Grundlage der übrigen Lagerrechte. Ein neues leeres Lager erfordert ein separates Erstellrecht.

Änderungen an Aktivierung, Rolle oder Zuweisungen beenden vorhandene Sitzungen des Nutzers. Der Server prüft Aktivierung und Rechte bei jeder Anfrage; die Oberfläche kontrolliert Sitzungen zusätzlich spätestens alle 15 Sekunden beziehungsweise bei Fokuswechsel. Der letzte aktive Administrator darf nicht deaktiviert oder herabgestuft werden.

## Passwort ändern und zurücksetzen

- **Mein Profil** erlaubt eine eigene Passwortänderung mit aktuellem Passwort. Andere Sitzungen werden beendet.
- **Passwort zurücksetzen** im Dashboard erzeugt ein zufälliges neues Startpasswort, ersetzt den Hash, beendet Sitzungen und erzwingt erneut einen Passwortwechsel. Das Startpasswort gilt eine Stunde und wird nach dem Wechsel ungültig.
- Vorhandene Passwörter werden nie angezeigt. Das einmalige neue Startpasswort wird nur in der aktuellen Antwort angezeigt, nicht gespeichert oder erneut abrufbar gemacht. Kein E-Mail-Versand ist eingerichtet.
- Für das eigene laufende Konto die normale Passwortänderung nutzen. Ist der einzige Administrator ausgesperrt, kann ausschließlich der vertrauenswürdige Serverbetreiber lokal `LAGERRAUM_RESET_LOGIN='kennung' npm run admin:reset` ausführen. Dabei erscheint ein neues temporäres Passwort einmalig im privaten Terminal; nicht in öffentliche CI-Logs schreiben.

## Dashboard und Profil

Das Dashboard zeigt Nutzer gesamt, aktiviert/deaktiviert, erfolgreiche Anmeldungen in den letzten 7/30 Tagen, letzte Anmeldung je Nutzer und zentrale Lageranzahl. „Aktiv“ im Zeitfenster bedeutet mindestens eine erfolgreiche Anmeldung; ein inzwischen deaktivierter Nutzer kann historisch aktiv gewesen sein.

Jeder Nutzer sieht Rolle, Rechte und zugewiesene Lager im Profil. Favorit kann für ein zugängliches Lager gesetzt/entfernt werden. Beim Start gilt Favorit, sonst zuletzt genutztes zugängliches Lager, sonst erstes verfügbares Lager. Nicht mehr zugewiesene Favoriten und letzte Lager werden bei Rechteänderungen entfernt. Administratoren starten weiterhin auf ihrem Dashboard.

## Startanimation und Fallback

Logo-Sequenz und kurze echte 3D-Lageransicht sind überspringbar. Das 3D-Lager verwendet die Daten des ausgewählten zugänglichen Favoriten/letzten Lagers. Nach Laden der Szene dreht sich die Kamera langsam. Die Geräteeinstellung für reduzierte Bewegung überspringt Animationen. Ohne WebGL oder bei Ladefehlern bleibt die Anmeldung gültig; die Sequenz kann übersprungen werden und besitzt eine zeitliche Obergrenze. Nutzer ohne zugängliches Lager erhalten einen Willkommensbildschirm, Administratoren ihr Dashboard.

## Lokale Testdaten bewusst übernehmen

Lokale Browserdaten werden nicht hochgeladen und nicht überschrieben. Die HTML-Offlinedemo und die Entwicklungsansicht `?local=1` am Vite-Vorschauserver arbeiten ausschließlich mit lokalen Prototypdaten und bieten **keine zentralen Benutzerrechte**. Der zentrale Node-Server leitet diesen lokalen Demo-Parameter zurück zur Anmeldung. Das ist kein Weg zu zentralen Lagerdaten: alle zentralen APIs erfordern weiterhin eine gültige Sitzung und Berechtigung.

1. In der bisherigen lokalen Version JSON exportieren. Die bestehenden Daten und SAP-Verläufe bleiben in dieser Datei erhalten.
2. Zentral als berechtigter Verwalter anmelden und ein freigegebenes leeres Ziellager auswählen.
3. **JSON importieren** öffnet die Migrationsvorschau: Datei wählen, Quelllager auswählen, Regale/Materialien/SAP-Fälle prüfen, Ziel auswählen.
4. Namen des Ziellagers ausdrücklich eintippen und **Daten in freigegebenes Lager übernehmen** bestätigen. Nur dieses Lager wird ersetzt; andere Lager bleiben erhalten.

Zentrale Schreibzugriffe prüfen eine Revisionsnummer und weisen veraltete Änderungen mit Konflikt zurück. Die UI übernimmt Daten erst nach der Serverantwort. Der bisherige Editor verwendet dafür aktuell synchrone gleichursprüngliche Speicheranfragen; auf langsamen Verbindungen kann die Oberfläche kurz blockieren. Eine asynchrone Speicherschlange und ein komfortabler Konfliktdialog sind spätere Verbesserungen. Leser können nicht durch direkte Anfragen schreiben. Mitarbeiter dürfen weder Regale verändern noch Materialien anlegen/umbenennen.

## Öffentlicher Betrieb: noch einzurichten

Die zentrale Version benötigt einen dauerhaft laufenden Node-24-Server mit persistentem Datenträger. Die bisherige reine Vercel-/Static-Hosting-Konfiguration reicht dafür **nicht** aus. In dieser Sitzung wurde kein Hostingkonto verbunden und keine öffentliche URL veröffentlicht.

Erforderliche Konfiguration:

```text
NODE_ENV=production
PUBLIC_BASE_URL=https://lagerraum.example.org
BETTER_AUTH_SECRET=<eigener zufälliger stabiler Wert mit mindestens 32 Zeichen>
LAGERRAUM_DATA_DIR=/var/lib/lagerraum
PORT=5176
```

Den Wert für `BETTER_AUTH_SECRET` beispielsweise privat mit `openssl rand -base64 48` erzeugen und im Secret-Speicher des Hosts hinterlegen. HTTPS-Domain und Reverse Proxy auf Port 5176 einrichten; `PUBLIC_BASE_URL` muss exakt dem öffentlichen Ursprung entsprechen. Das Datenverzeichnis darf nicht öffentlich ausgeliefert werden. SQLite-Datei, Signatur-Secret, Benutzerkonten und Sicherungen benötigen dauerhaft geschützten Speicher sowie ein geprüftes Sicherungs-/Wiederherstellungsverfahren.

Ein Dockerfile für Node 24 ist vorbereitet. Ein persistentes Volume muss auf `/var/lib/lagerraum` gemountet werden; Secret und Domain als Umgebungswerte setzen. Der erste Administrator wird einmalig im Container mit demselben Datenvolume und denselben Umgebungswerten über `admin:init` und sichere Standardeingabe angelegt. Der Docker-Build selbst ist nur dann als geprüft zu betrachten, wenn er im Prüfbericht ausdrücklich genannt wird; der Node-Server wird separat tatsächlich getestet.

Für Vercel wäre vor der zentralen Veröffentlichung eine externe persistente Datenbank samt passendem Auth-Adapter nötig. Diese Anbindung wurde nicht implementiert. Kein E-Mail-Dienst, keine MFA und keine Mehrinstanz-/Cluster-Konfiguration eingerichtet. SQLite ist für einen einzelnen Serverprozess vorgesehen.

## Prüfung

`npm test`, `npm run check:server`, `npm run build`.

`node scripts/check-accounts.mjs` startet einen echten Server mit isolierter temporärer SQLite-Datei, richtet einen zufälligen Testadministrator über denselben Bootstrap ein und prüft Anmeldung, Rollen, direkte verbotene Anfragen, Passwortwechsel/Reset, Lagertrennung, Migration, Startablauf und SAP-Abgleich. Alle Daten und Kennwörter sind fiktiv beziehungsweise zufällig; keine echten Unternehmensdaten werden importiert.

Die alten Browser-Prüfungen lassen sich gegen die explizite lokale Demo ausführen, beispielsweise `BASE_URL='http://127.0.0.1:5174?local=1' node scripts/check-browser.mjs`. Die einzelne HTML-Datei ist nur die lokale Demo und kein Ersatz für den zentralen Authentifizierungsserver.
