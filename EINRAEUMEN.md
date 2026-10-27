# Schnell am Regal einräumen

Hinweis zur Datenhaltung: Aussagen zur lokalen Browser-Speicherung betreffen die Offline-Demo. In der zentralen Version werden bestätigte Lagerdaten und SAP-Arbeitsfälle auf dem Server gespeichert und durch Benutzerrechte geschützt; siehe [BENUTZERKONTEN.md](BENUTZERKONTEN.md). Excel-/CSV-Dateien werden weiterhin lokal eingelesen und erst nach Bestätigung übernommen.

Öffnen über **Einräum-Modus** in der Seitenleiste oder **Einräum-Modus öffnen** in der Lagerübersicht. Oben Lager, Regal, Bereich und Arbeitsrichtung wählen. Bestehende Lagerdaten bleiben erhalten. Der Modus verwendet dieselben Materialien, Fächer, Belegungen und Bestandsmengen wie die anderen Ansichten.

## Fach für Fach

1. Fach in der großen 2D-Ansicht oder in 3D anklicken. Der Cursor steht unmittelbar im Feld **Alter Lagerplatz**.
2. Alten Platz tippen oder mit einem Scanner eingeben, der als Tastatur arbeitet.
3. Bei genau einem **exakten**, gegebenenfalls normalisierten Treffer mit Enter bestätigen. Mehrere Treffer müssen bewusst angeklickt werden; es wird keiner vorausgewählt. Auch ein einzelner Teiltreffer ist vor der Übernahme bewusst auszuwählen.
4. Wenn das Fach andere Materialien enthält, deren Belegung ausdrücklich bestätigen. Vorhandene Materialien werden nicht ersetzt.
5. Die Bestätigung speichert sofort, wählt das nächste Fach und setzt den Cursor wieder in die leere Eingabe. Beim letzten Fach stoppt die automatische Auswahl; es beginnt keine unbemerkte neue Runde.

`55.533.024` und `55 533 024` werden als gleiche alte Schreibweise erkannt. Punkte, Leerzeichen, Bindestriche, Unterstriche und Schrägstriche werden für den Vergleich vereinheitlicht, führende Nullen bleiben erhalten. Mehrere passende Materialien werden trotzdem einzeln gezeigt. Gesucht wird in importierten alten Plätzen und vorhandenen Kontrolllistenwerten.

Materialnummer, Hauptname, alternative Namen, alte Plätze und der neue Code bleiben sichtbar. Bei einem nicht gefundenen alten Platz zu **Stattdessen Material suchen** wechseln und Nummer, Namen oder alternative Bezeichnung eingeben. Der Modus erfindet keine Materialien.

Für die mitgelieferten JSON-Beispieldaten zuerst ein **neues leeres Testlager** anlegen und dieses auswählen. Dann dort die Beispiel-JSON importieren und das Ersetzen **nur dieses Testlagers** bestätigen. Die Werte `55.533.024` (ein Material), `55.533.025` (zwei Materialien) und `55.533.026` (Material mit bestehenden Plätzen/Mengen) demonstrieren die Abläufe. Nicht in ein Lager mit eigenen Daten importieren.

Alternativ zum Ausprobieren in einem Lager ohne importierte alte Plätze zunächst unter **Materialien → bearbeiten → Alte Lagerplätze** einen fiktiven Platz eintragen. Danach im Einräum-Modus ein freies Fach wählen und diesen Platz eingeben.

## Reihenfolge und Darstellung

Die 2D-Anordnung bleibt die gespeicherte physische Fachanordnung: hohe Ebenen oben, niedrige unten, Spalten an ihrer tatsächlichen Position. Absichtlich fehlende Fächer hinterlassen eine Lücke. Die Auswahl scrollt bei Bedarf innerhalb der Fachansicht zum aktiven Fach.

Die Arbeitsrichtung legt getrennt davon die nächste Auswahl fest: zeilenweise von unten oder oben, jeweils links/rechts, oder spaltenweise von unten nach oben. **Vorheriges Fach**, **Nächstes Fach** und **Fach überspringen** ändern keine Materialdaten. Tastatur: **Alt + ←/→** wechselt das Fach; **Alt + ↓** überspringt es.

Die Legende kennzeichnet frei, belegt und ausgewählt. Mengenlose bestätigte Materialzuordnungen gelten ebenfalls als belegt, auch in 3D. Fortschritt bedeutet ausdrücklich **belegte Fächer im gewählten Bereich**; zusätzlich wird die Zahl der Bestätigungen dieser Sitzung angezeigt. Bereits vorhandene Belegungen zählen zur Belegung, übersprungene Fächer nicht als erledigt.

Regal, Bereich, Fach und Arbeitsrichtung werden je Lager lokal als Ansichtseinstellung für das Neuladen gespeichert. Eingabe und Kandidat werden beim Fach-/Lagerwechsel geleert. Beim Lagerwechsel bleiben keine Artikel-/Fachdetails des vorherigen Lagers sichtbar.

## Vorne, Mitte, Hinten

Bereiche und Fachzahlen stammen aus der gespeicherten Regalstruktur. **Nur Vorne**, **Nur Mitte** oder **Nur Hinten** wählen jeweils einen Arbeitsbereich. Andere Bereichsnamen werden ebenfalls unterstützt. Sieben oder zehn Ebenen und andere Spaltenzahlen werden daraus direkt dargestellt.

Über **Bereiche ein-/ausblenden und verschieben** lassen sich Ansichtsteile steuern. Auseinanderziehen und Verschieben ändern ausschließlich die Ansicht. In 3D bleiben vor der aktiven Arbeitsebene liegende Bereiche ausgeblendet, damit sie die Arbeit nicht verdecken. Für einen anderen Arbeitsbereich dessen **Nur …**-Schaltfläche wählen. Der aktive Arbeitsbereich bleibt sichtbar. Mit **Ansicht zurücksetzen** kann die 3D-Kamera erneut auf die aktuelle Auswahl ausgerichtet werden.

## Bestehende Zuordnungen und Mengen

Liegt das Material schon an anderen neuen Plätzen, muss zwischen zwei Aktionen entschieden werden:

- **Zusätzlich zuordnen:** Bestehende Plätze und Bestände bleiben erhalten. Ohne Menge wird nur eine weitere Fachzuordnung gespeichert.
- **Umlagern:** Ohne Mengenangabe werden alle anderen bestätigten Fachzuordnungen dieses Materials aufgehoben und sämtliche dort gebuchten Mengen ins Zielfach übertragen. Vorhandene Zielmengen werden addiert. Andere Materialien bleiben unverändert.

Eine eingegebene Menge bedeutet beim zusätzlichen Zuordnen eine **zusätzliche Einbuchung**, beim Umlagern eine **Teilumlagerung** aus gebuchten Quellen. Teilumlagerungen werden in der gespeicherten Reihenfolge der Quellbuchungen entnommen; eine einzelne Quelle lässt sich in diesem Schnellmodus nicht gesondert auswählen. Die verfügbare gebuchte Quellsumme wird vorher angezeigt. Eine Teilmenge darf diese Summe nicht überschreiten. Reine mengenlose Quellzuordnungen bleiben bei einer Teilumlagerung erhalten; ohne Menge kann die vollständige Zuordnung umgelagert werden. Es werden keine unbekannten Mengen angenommen.

Eine identische Zuordnung ohne zusätzliche Menge erzeugt keine doppelte Belegung. Bestehende Prüfwerte und Bemerkungen bleiben erhalten; eine Einräumaktion setzt den Prüfstatus nicht automatisch auf „Stimmt“.

## Korrektur, Sicherung und Grenzen

**Letzte Zuordnung rückgängig** stellt den vollständigen Zustand vor der letzten Bestätigung wieder her, einschließlich Mengen und Quellen, und wählt das ursprüngliche Fach. Die Funktion gilt für die letzte Bestätigung dieser Sitzung und ist nach Neuladen beziehungsweise Lagerwechsel nicht verfügbar. Falls danach andere Datenänderungen erkannt wurden, verhindert sie ein Überschreiben dieser Änderungen.

Jede erfolgreiche Bestätigung wird sofort lokal gespeichert. Schlägt das Speichern fehl, wird nicht automatisch weitergeschaltet. Materialdaten und Zuordnungen bleiben Teil der bestehenden JSON-Gesamtsicherung und Excel-Kontrolllisten. Vor einem Wechsel der Vorschauadresse JSON sichern und am neuen Ort wiederherstellen.

Die Browserprüfung simuliert Scanner-Eingaben mit Tastatureingabe und Enter. Es wurde kein physischer USB-/Bluetooth-Scanner getestet. Scanner müssen einen normalen Textwert und Enter senden; besondere Herstellerprotokolle sind nicht implementiert. Kein Backend, keine Mehrbenutzer-Synchronisierung; Laptop/Querformat ist die bevorzugte Arbeitsgröße.

Tests: `npm test`, `node scripts/check-putaway.mjs`. Einzeldatei-Vorschau: `CHECK_STANDALONE=1 OUTPUT_DIR=/tmp/lagerraum-einraeumen-html node scripts/check-putaway.mjs`. Die Tests verwenden ausschließlich fiktive Daten und frische Browserprofile.

## Manueller SAP-Abgleich

Neue Zuordnungen werden automatisch als offene manuelle SAP-Arbeitsfälle erfasst. Bereits vorhandene Zuordnungen werden nicht pauschal markiert. Beim Rückgängig bleiben bereits entstandene Arbeitsfälle und der Änderungsverlauf erhalten; Lagerzuordnungen und Mengen werden dennoch zurückgesetzt. Details: [SAP-ABGLEICH.md](SAP-ABGLEICH.md).
