# Materialien aus Excel oder CSV importieren

Hinweis zur Datenhaltung: Aussagen zur lokalen Browser-Speicherung betreffen die Offline-Demo. In der zentralen Version werden bestätigte Lagerdaten und SAP-Arbeitsfälle auf dem Server gespeichert und durch Benutzerrechte geschützt; siehe [BENUTZERKONTEN.md](BENUTZERKONTEN.md). Excel-/CSV-Dateien werden weiterhin lokal eingelesen und erst nach Bestätigung übernommen.

Unter **Materialien → Excel importieren** eine `.xlsx`- oder `.csv`-Datei auswählen. Die Datei wird lokal gelesen und nicht verändert oder übertragen. Größenlimit: 15 MB, 10.000 Datenzeilen und 200 Spalten je Blatt. XLSX-Blätter und Kopfzeile sind auswählbar. CSV unterstützt Semikolon, Komma oder Tabulator, Anführungszeichen, UTF-8, UTF-16 mit BOM und Windows-1252.

Die Spalten `Material`, `Materialkurztext` und `Platz` werden automatisch erkannt. Weitere gebräuchliche Überschriften ebenfalls; abweichende Spalten lassen sich manuell zuordnen. `Platz`/`Lagerplatz` bedeutet immer **alter Lagerplatz**. Neue Fachcodes benötigen eine eigene Spalte, etwa `Neuer Lagerplatz`.

## Vorschau und Bestätigung

- Materialnummern bleiben Text. Textzellen und CSV behalten führende Nullen. Bei numerischen XLSX-Zellen werden einfache, eindeutige Nullmasken wie `00000000000` verwendet. Andere Zahlenformate, unsichere Zahlen, Formeln und Datumszellen verlangen eine manuelle Prüfung. Excel kann bereits gerundete Nummern nicht wiederherstellen.
- **Einzelne Quelldaten prüfen oder ausschließen** öffnet die Zeilenansicht. Nummern lassen sich als Text berichtigen und über **Nummer geprüft** freigeben. Fehlende Nummern bleiben zur Prüfung zurückgestellt. Auch einzelne Zeilen können ausgeschlossen werden.
- Exakt gleiche Materialnummern werden zusammengefasst. Bei mehreren Bezeichnungen ist eine Hauptbezeichnung auszuwählen; es wird keine Sprache geraten. Weitere Namen und alle unterschiedlichen alten Platzangaben bleiben erhalten.
- Bei bestehenden Nummern muss ausdrücklich zwischen Ergänzen, Hauptnamen ändern, unverändert lassen oder Zurückstellen entschieden werden. Ergänzen behält den bisherigen Hauptnamen; ein geänderter Hauptname löscht den alten Namen nicht, sondern erhält ihn als Alternative.
- Neue Fachcodes werden exakt im ausgewählten Lager geprüft. Nur ein eindeutiger Treffer kann angehakt und bestätigt werden. Alte Plätze werden niemals automatisch zu neuen Fächern umgeschlüsselt. Unbekannte oder unbestätigte neue Codes bleiben am Material als offene Angaben erhalten.
- Ohne Zuordnung erscheint **Noch nicht zugeordnet**. Fachzuordnungen enthalten zunächst keine Menge. Der Import erhöht oder verändert keine vorhandenen Bestände.
- Erst **Import bestätigen** speichert. **Abbrechen**, Escape und Schließen verändern nichts.

Das Ergebnis zeigt angelegte, ergänzte/geänderte, unveränderte, ausgeschlossene und zurückgestellte Positionen. Offene Platzprüfungen können zusätzlich zu einem angelegten/ergänzten Material gezählt werden; Zeilen ohne brauchbare Nummer werden einzeln gezählt. Die Werte sind daher keine disjunkte Gesamtsumme.

Zurückgestellte Zeilen bleiben im aktuell ausgewählten Lager unter **Importprüfung öffnen** gespeichert, auch nach Neuladen. Dort können sie berichtigt, übernommen oder ausgeschlossen werden. Die optionale Prüfdatei enthält zusätzlich die Quelldaten und Entscheidungen dieses Vorgangs. Die Quelldatei selbst bleibt unverändert.

## Danach

Die zentrale Suche findet Materialnummer, Hauptnamen, alternative Namen und alte Plätze – auch bei Materialien ohne Fach. In der Materialliste öffnet **Fach zuordnen** die Zuordnung ohne Mengenangabe; über **Bestand zuordnen** werden tatsächliche Mengen erfasst. Bestehende Fachzuordnungen lassen sich dort entfernen. Unbekannte historische Zielcodes bleiben als Prüfhinweis erhalten, bis sie in einem späteren Import eindeutig bestätigt werden; sie werden durch eine manuelle Wahl eines anderen Fachs nicht stillschweigend gelöscht.

Gesamtsicherung und Wiederherstellung als JSON erhalten alternative Namen, alte und offene Plätze, bestätigte Fachreferenzen und die Prüfliste. Der Import ergänzt nur das ausgewählte Lager. Bestehende Material-IDs, Bestandsmengen, Regale und andere Lager bleiben erhalten. Ein erneuter Import legt bei identischer Nummer keine Duplikate an.

## Prüfung

Automatisierte Daten-/Geometrietests: `npm test`.
Browserprüfung des Imports: `node scripts/check-import.mjs` gegen die laufende Vorschau (optional `BASE_URL=...`). Der Test erstellt ausschließlich fiktive XLSX-/CSV-Daten und ein frisches Browserprofil.

Für diesen Auftrag war keine Excel-Datei angehängt. Die getestete XLSX-Beispieldatei wird vom Testskript erzeugt; sie ist keine vom Nutzer gelieferte Unternehmensdatei. Eine eigene Datei lässt sich anschließend mit derselben Vorschau prüfen.
