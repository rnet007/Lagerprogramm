# Excel-Kontrollliste

Hinweis zur Datenhaltung: Aussagen zur lokalen Browser-Speicherung betreffen die Offline-Demo. In der zentralen Version werden bestätigte Lagerdaten und SAP-Arbeitsfälle auf dem Server gespeichert und durch Benutzerrechte geschützt; siehe [BENUTZERKONTEN.md](BENUTZERKONTEN.md). Excel-/CSV-Dateien werden weiterhin lokal eingelesen und erst nach Bestätigung übernommen.

Unter **Lager bearbeiten** sind **Kontrollliste exportieren** und **Kontrollliste importieren** hinzugekommen. Der kombinierte Kontrollexport enthält sowohl die lesbare Liste als auch die bisherigen Strukturblätter. Der reine Struktur- und der Materialimport bleiben zusätzlich verfügbar.

## Aufbau des Exports

Jedes Regal erhält ein eigenes Tabellenblatt mit genau sieben sichtbaren Spalten:

1. Nr.
2. Materialnummer
3. Materialbezeichnung
4. Alter Lagerplatz
5. Neuer Lagerplatz
6. Geprüft
7. Bemerkung

Jedes vorhandene Fach erscheint, einschließlich leerer Fächer. Mehrere Materialzuordnungen oder unterschiedliche vorhandene Prüfzeilen ergeben mehrere Zeilen zum selben Fach. Materialnummern sind als Text gespeichert, nicht als Zahlen. Filter, eingefrorene Überschriften, breite Textspalten, Zeilenumbruch und ein Drucklayout im Querformat erleichtern die Kontrolle. Blatttitel werden für Excel bereinigt, auf 31 Zeichen begrenzt und bei Namenskollisionen eindeutig ergänzt.

**Noch kein Lagerplatz** enthält Materialien ohne bestätigte Zuordnung sowie gespeicherte Vorschläge ohne Fachverweis. Ohne hinterlegten Vorschlag bleibt **Neuer Lagerplatz** leer. Unbestätigte Vorschläge aus einer Kontrollliste bleiben als solche erhalten, auch wenn der Prüfstatus **Stimmt** lautet. Vorschläge mit bekanntem Regalbezug können auch im betreffenden Regalblatt stehen. Bestehende Bestände oder mengenlose Zuordnungen bestimmen die tatsächlichen Fachbelegungen.

Die Blätter **Regale**, **Bereiche und Segmente** und **Lagerplätze** enthalten die vollständige Regalstruktur einschließlich interner IDs. **Kontrollzuordnung** verknüpft Blattname und Nr. mit internen Kontroll-, Regal-, Fach- und Material-IDs. **Anleitung** erklärt die Struktur. **Lagerplan** enthält weiterhin Hallen-/Bauteil-Snapshots zur Übersicht; vollständige Hallen- und Bauteilwiederherstellung erfolgt über die JSON-Gesamtsicherung.

Technische IDs und Verweisblätter möglichst unverändert lassen. Im selben Kontrollblatt keine Nr. doppelt vergeben. Beim Sortieren immer die ganze Kontrollzeile einschließlich Nr. verschieben. Bei unverändertem kombinierten Rückimport im selben Lager bleiben vorhandene Materialzuordnungen und Mengen erhalten. In einem leeren Lager sind Zuordnungen ausdrücklich zu bestätigen; Mengen werden nicht aus der Liste erfunden.

## Bestehende Kontrollliste einlesen

1. **Kontrollliste importieren** öffnen und die XLSX-Datei auswählen. Die Datei wird ausschließlich lokal gelesen und nicht verändert.
2. Jedes Blatt wird unabhängig nach einer passenden Kopfzeile durchsucht. Die Kopfzeile darf je Blatt an einer anderen Stelle stehen. Erkannt werden auch gebräuchliche abweichende Spaltennamen. Nicht erkannte Blätter können aufgeklappt, aktiviert und manuell zugeordnet werden. Strukturblätter nicht als Kontrollblätter aktivieren.
3. **Kontrollabgleich anzeigen** öffnen. Das Ziellager steht deutlich über der Vorschau. Bei einer kombinierten Datei werden die Strukturänderungen separat je Regal auswählbar angezeigt. Nicht auflösbare Strukturkonflikte blockieren die Übernahme; die Struktur kann bewusst abgewählt werden, um nur gegen das vorhandene Lager abzugleichen.
4. Die Vorschau nennt die Kontrollzeilen, die eindeutig erkannten vorhandenen Regale/Fächer, vorhandene Materialien, neue Zuordnungen, neue Fächer, Vorschläge und Zeilen mit offenen Fehlern. Sie zeigt Quellblatt und Zeilennummer, alten/neuen Platz, Prüfwert und Bemerkung. Abweichende vorhandene Prüfwerte und Bemerkungen werden angezeigt.
5. Einzelne Zeilen lassen sich ausschließen. Nummern aus unsicheren numerischen Excel-Zellen erfordern eine manuelle Prüfung und Bestätigung als Text. Fehlende Materialnummern bei einer Materialzeile müssen korrigiert oder ausgeschlossen werden. Zeilen ohne Materialnummer sind für leere beziehungsweise separat geprüfte Fächer zulässig, wenn das Fach eindeutig existiert oder bewusst angelegt wird.
6. Erst **Import bestätigen** speichert Struktur und Kontrollabgleich gemeinsam. **Abbrechen**, Escape oder Schließen verändern nichts. Das Ergebnis lässt sich als JSON-Prüfbericht herunterladen.

## Entscheidung über den neuen Platz

- **Kein neuer Platz:** Material ohne Zuordnung übernehmen. Es wird kein Fach vorgeschlagen.
- **Eindeutiger vorhandener Code:** zunächst als Vorschlag übernehmen. **Zuordnung ausdrücklich bestätigen** anklicken, wenn tatsächlich zugeordnet werden soll. Ein schon im Lager bestehender Material-/Fachbezug bleibt beim Rückimport bestehen.
- **Fach bereits belegt:** Die anderen Materialien werden vorab gezeigt. Zusätzlich ist **Zusätzliche Belegung bestätigen** erforderlich. Keine vorhandene Belegung wird entfernt oder überschrieben.
- **Unbekannter Code:** als Vorschlag speichern oder ein konkretes Zielregal und einen Bereich auswählen. Die Neuanlage ist eine ausdrückliche Entscheidung und bestätigt zugleich die Zuordnung. Das erste freie Rasterfach wird genutzt; wenn nötig entsteht eine weitere Ebene bis maximal 20. Der eingegebene Code wird als individuelle Fachbeschriftung gespeichert. Andere Fächer werden nicht umbenannt. Die Vorschau nennt das neue Fach; es erscheint nach Übernahme in 2D und 3D.
- **Mehrdeutiger Code / widersprüchliche IDs:** nicht raten. Datei beziehungsweise Zuordnung korrigieren oder die Zeile ausschließen.

**Geprüft** und **Bemerkung** sind eigene Daten. `Stimmt` ist kein Befehl, einen Platz zu bestätigen. `Noch offen` bleibt erhalten; ein fehlender Prüfwert bleibt leer. Vorschläge und bestätigte Fachzuordnungen werden getrennt gespeichert. Neue Zuordnungen ergänzen bestehende Verknüpfungen. Materialbewegungen mit Mengen sind weiterhin ein separater Vorgang.

Gleiche Materialnummern werden zu einem Material zusammengeführt. Bei mehreren Namen für ein neues Material muss die Hauptbezeichnung ausdrücklich ausgewählt werden. Abweichende Namen bleiben als Alternativen und als ursprünglicher Text der Prüfzeile erhalten. Weitere alte Plätze werden ergänzt. Vorhandene Material-IDs, Namen und Mengen werden nicht stillschweigend ersetzt.

## Speicherung und Grenzen

Prüfwerte, Bemerkungen, alte Plätze, Zeilentexte, Vorschläge und bestätigte Fachverweise bleiben nach Neuladen erhalten und sind in der JSON-Gesamtsicherung enthalten. Wiederholter Import einer unveränderten Liste erzeugt keine doppelten Materialien oder Fächer. Technische Kontroll-IDs beziehungsweise eindeutige Quellenverweise verhindern doppelte Prüfzeilen desselben unveränderten Imports. Werden externe Listen ohne technische IDs umnummeriert und umsortiert, können sie neue Prüfzeilen darstellen; der Abgleich muss dann bewusst geprüft werden.

Dateilimit: 15 MB, höchstens 10.000 Datenzeilen und 200 Spalten pro Blatt. Die bestehende Struktur nutzt ein gleichmäßiges Raster je Bereich; sieben oder zehn Ebenen sind pro Bereich möglich. Zusätzliche unbekannte Fächer erfordern ein vorhandenes oder über die Struktur mitimportiertes Regal mit mindestens einem Bereich. Aus einem unbekannten Code werden keine Abmessungen oder neuen Regale geraten.

Browserdaten sind an die jeweilige Adresse gebunden. Vor einem Wechsel der Vorschauadresse eine JSON-Gesamtsicherung erstellen und am neuen Ort wiederherstellen.

## Tatsächlich verwendete Testdatei

Bei diesem Auftrag war keine Excel-Datei als Anhang verfügbar. Der vom Nutzer gewünschte konkrete Vorlagenaufbau konnte deshalb nicht geprüft werden. Die Tests erzeugen eine eigene Datei mit drei Kontrollblättern, Kopfzeilen in Zeile 1, 3 und 6, führenden Nullen, alten Plätzen, bekannten/unbekannten neuen Codes, Prüfwerten, Bemerkungen, fehlender Nummer und unsicherem numerischen Wert. Diese Datei ist fiktiv und enthält keine echten Unternehmensdaten.

Tests: `npm test`, `node scripts/check-checklist.mjs`. Für die einzelne HTML-Datei: `CHECK_STANDALONE=1 OUTPUT_DIR=/tmp/lagerraum-kontroll-html node scripts/check-checklist.mjs`. Zusätzlich werden Materialimport, Strukturimport und bisherige Lagerfunktionen mit den bestehenden Browser-Skripten geprüft.
