# Lagerstruktur mit Excel bearbeiten

Hinweis zur Datenhaltung: Aussagen zur lokalen Browser-Speicherung betreffen die Offline-Demo. In der zentralen Version werden bestätigte Lagerdaten und SAP-Arbeitsfälle auf dem Server gespeichert und durch Benutzerrechte geschützt; siehe [BENUTZERKONTEN.md](BENUTZERKONTEN.md). Excel-/CSV-Dateien werden weiterhin lokal eingelesen und erst nach Bestätigung übernommen.

Unter **Lager bearbeiten** stehen drei neue Schaltflächen zur Verfügung:

- **Lagerstruktur exportieren**: aktuell ausgewähltes Lager als XLSX herunterladen.
- **Vorlage für neue Regale herunterladen**: kommentierte Beispielstruktur herunterladen.
- **Regalstruktur importieren**: XLSX lokal lesen, Zuordnung und Vorschau prüfen, Regale auswählen, ausdrücklich bestätigen.

Dateigrenzen: 15 MB, höchstens 10.000 Datenzeilen und 200 Spalten je Tabellenblatt. Größere Strukturen müssen auf mehrere Dateien mit vollständigen Regalgruppen verteilt werden. Die JSON-Gesamtsicherung bleibt für größere vollständige Sicherungen verfügbar.

Der Materialimport unter **Materialien** bleibt eine eigene Funktion. Dieser Strukturimport legt keine Materialien an, verändert keine Mengen und importiert keine Materialzuordnungen aus den Übersichtsspalten.

## Export und Spalten

**Regale** enthält stabile interne IDs, Verweisschlüssel, Gebäude, Nummer, Name, Typ, Breite/Höhe/Tiefe in Metern, X-/Z-Position in Metern, Drehung in Grad, Hallen-ID sowie optionale Farbe, Sperre und Schieberichtung.

**Bereiche und Segmente** enthält Bereich-ID/-schlüssel, Regalverweis, Bereichsname und Präfix, Segmentanzahl (Spalten), Fächer je Segment (Ebenen) sowie optionale Segmentnamen, getrennt durch `|`.

Ein Segment entspricht im bestehenden Modell einer senkrechten Spalte. Die Fachnummer läuft zeilenweise von unten: `(Ebene − 1) × Spalten + Segmentnummer`. Vorne, Mitte und Hinten bilden getrennte Bereiche hintereinander in der Tiefe. Beispielsweise kann Vorne zwei Spalten mit je sieben Fächern und Hinten zwei Spalten mit je zehn Fächern haben. Unterschiedliche Fachzahlen innerhalb desselben Bereichs werden nicht unterstützt; hierfür getrennte Bereiche verwenden.

**Lagerplätze** enthält Fach-ID, Regal-/Bereichsverweise, Fachnummer, Lagerplatzcode, Segmentnummer/-name, Ebene, Belegungsstatus und zugeordnete Materialnummern/-namen. Fachnummer, IDs, Verweise und Lagerplatzcode sind beim Import maßgeblich. Segmentnummer, Segmentname, Ebene und die wiederholten Namen in diesem Blatt dienen der Übersicht; Segmentnamen werden im Bereichsblatt bearbeitet.

**Anleitung** erklärt die Bearbeitung auch direkt in Excel. **Lagerplan** enthält außerdem JSON-Snapshots aller Hallen und Bauteile zur Übersicht. Diese Snapshots werden beim Regalimport nicht angewendet. Die vollständige Wiederherstellung einschließlich Hallen, Geräten und Materialien erfolgt weiterhin über die JSON-Gesamtsicherung.

## Neue Regale vorbereiten

1. Vorlage öffnen. Alle Beispielzeilen tragen `JA` in der Spalte **Beispiel** und werden unverändert immer übersprungen.
2. Eigene Zeilen ergänzen oder Beispielwerte bewusst ersetzen. Für eigene Daten den Beispielmarker in **allen zugehörigen** Regal-, Bereichs- und Fachzeilen entfernen.
3. Neue interne IDs leer lassen. Einen eindeutigen **Regalschlüssel** vergeben, zum Beispiel `NEU-P1`, und in den Bereichs-/Fachzeilen wiederverwenden.
4. Für neue Bereiche eigene **Bereichsschlüssel** vergeben. Pflichtangaben: Bereich, Präfix, Spalten und Ebenen. Ein neues Regal benötigt mindestens einen Bereich.
5. Neue Fächer werden automatisch aus Spalten × Ebenen erzeugt. Einzelne neue Fachzeilen sind nur nötig, wenn eigene Lagerplatzcodes vorbereitet werden sollen. Dann Fach-ID leer lassen, Bereichsschlüssel und Fachnummer angeben.
6. Zahlen in Metern/Grad angeben, Dezimalkomma wird akzeptiert. Maximal 20 Spalten und 20 Ebenen pro Bereich; höchstens 100 Regale im Lager.

Die Vorlage enthält ein Palettenregal und ein Schieberegal mit Vorne/Mitte/Hinten, zwei Segmenten je Bereich und sieben/sieben/zehn Fächern je Segment.

## Bestehende Struktur ändern

Interne IDs unbedingt unverändert lassen. Sie bestimmen die Zuordnung, nicht Regalname oder Code. Verweisschlüssel ebenfalls beibehalten. Bei fehlenden IDs wird eine Zuordnung zu bestehenden Objekten nicht geraten. Doppelte IDs, widersprüchliche Verweise, ungültige Maße und doppelte Fachcodes erzeugen Fehler.

Fehlende Regal-, Bereichs- oder Fachzeilen löschen nichts. Auch absichtlich entfernte Einzelfächer werden bei unverändertem Rückimport nicht wieder ergänzt. Eine ausdrücklich kleinere Spalten-/Ebenenzahl kann unbesetzte Randfächer entfernen; dazu nicht mehr passende Fachzeilen ebenfalls aus der Datei entfernen. Jede Verkleinerung, die Bestände oder mengenlose Materialzuordnungen entfernen würde, wird blockiert. Gesperrte Regale zuerst im Baumodus entsperren.

Ein neuer Code in einer bestehenden Fachzeile ändert dessen Beschriftung; interne ID und Materialverknüpfung bleiben erhalten. Automatisch erzeugte Codes folgen Änderungen an Gebäude, Nummer oder Präfix. Bereits individuelle Codes bleiben individuell. Eine leere Codezelle setzt einen vorhandenen individuellen Code nicht zurück. Verschiebungen auf bereits vorhandene Fachpositionen werden vorsichtshalber als Konflikt abgewiesen.

## Vorschau und Ergebnis

Das Ziellager wird deutlich angezeigt. Die Vorschau zeigt neue/geänderte/unveränderte Regale, neue/geänderte/entfallende Fächer, Quellzeilen und konkrete Fehler. Über **Fächer und Lagerplatzcodes prüfen** sind IDs und alte/neue Codes einsehbar.

Die Auswahl erfolgt je Regal einschließlich seiner Bereiche und Fächer. Fehlerhafte Regalgruppen werden gesperrt; unabhängige gültige Regale können übernommen werden. Nicht auflösbare Zeilenverweise oder Konflikte innerhalb der gemeinsamen Auswahl blockieren die Bestätigung, bis Datei oder Auswahl korrigiert wurden. Bestehende Material- und Bestandsdaten werden auch bei geänderten Materialspalten im Export unverändert erhalten.

Erst **Import bestätigen** speichert. **Abbrechen**, Escape oder Schließen verändern nichts. Das Ergebnis nennt angelegte/geänderte/unveränderte Regale, neue/geänderte/entfernte Fächer und ausgelassene Regalgruppen mit Quellzeilen und Fehlern. Der Ergebnisbericht lässt sich herunterladen. Neue Daten erscheinen unmittelbar in Lagerübersicht, 2D und 3D und bleiben nach Neuladen erhalten.

## Sicherung und Vorschau

Vor einem Wechsel der Vorschauadresse oder einer Veröffentlichung die JSON-Gesamtsicherung herunterladen und am neuen Ort wiederherstellen. Lokale Browserdaten sind an die jeweilige Adresse gebunden. Die Excel-Datei wird ausschließlich lokal gelesen und bleibt unverändert; bis zur Bestätigung wird nichts im Lager gespeichert.

Tests: `npm test`, `node scripts/check-structure.mjs`; optionale Einzeldatei-Prüfung mit `CHECK_STANDALONE=1 OUTPUT_DIR=/tmp/lagerraum-struktur-html node scripts/check-structure.mjs`. Die Browsertests verwenden frische Profile und ausschließlich fiktive Daten.
