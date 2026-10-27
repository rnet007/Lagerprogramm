# Lagerraum: visueller Baumodus

Der Tab **Bauen** ergänzt den vorhandenen Prototyp. Die Bibliothek enthält 28 funktionierende Typen. Die Geometrie entsteht aus den gespeicherten Daten, ohne Bildkulissen oder fremde Bildbestandteile.

## Einstieg

1. Oben links die Lagerverwaltung öffnen und **Beispielhalle · Bauen** auswählen. Sie ist separat angelegt; vorhandene Lager werden nicht ersetzt.
2. **Bauen** öffnen. Links stehen Bauteile, in der Mitte Grundriss/3D und rechts Eigenschaften. Die Halle wird beim Öffnen eingepasst.
3. Für ein eigenes Lager in der Lagerverwaltung ein neues Lager anlegen. Unter Bauen **Halle erstellen** wählen. Name, Gebäude, Breite, Tiefe und Höhe eingeben. Außenwände können direkt mit angelegt werden.
4. Ein Bauteil aus der Bibliothek wählen. Auf dem Boden erscheint eine Vorschau. Mit einem Klick platzieren; **Escape** bricht ohne Speicherung ab.

## Platzieren und bearbeiten

- **Auswahl:** Objekt anklicken. Shift-Klick oder die Objektliste rechts erweitert die Auswahl.
- **Verschieben:** Im Grundriss am Objekt ziehen. In 3D die farbigen Greifer verwenden. X/Z sind Bodenkoordinaten, Y bleibt fix.
- **Drehen:** Werkzeug Drehen für Mausbedienung; zusätzlich 90°-Schritte in der Leiste und freie Winkeleingabe rechts.
- **Raster:** Ein-/ausschalten, Schrittweite zwischen 0,05 und 5 m einstellen. Die Vorschau und Mausbewegung verwenden den gewählten Schritt. Koordinaten lassen sich auch genau eingeben.
- **Eigenschaften übernehmen:** Name, Farbe, Maße, Koordinaten und Hallenzuordnung bearbeiten. Änderungen im Formular werden erst beim Übernehmen gespeichert.
- **Duplizieren:** Neue IDs und bei Regalen neue eindeutige Lagerplatzcodes; keine Bestände in der Kopie.
- **Sperren:** Fertige Objekte gegen Bearbeitung und Verschieben sichern. Rechts können sie wieder entsperrt werden.
- **Löschen:** Nach Bestätigung. Belegte Lagerplätze werden nicht gelöscht; zuerst umlagern. Gesperrte Objekte zuerst entsperren. Das Löschen einer Wand entfernt ihre verknüpften Öffnungen. Eine Halle mit Bauteilen kann nicht versehentlich mitsamt Inhalt gelöscht werden.
- **Rückgängig/Wiederholen:** Schaltflächen oder Strg/Cmd+Z, Strg/Cmd+Umschalt+Z bzw. Strg+Y. Strg/Cmd+D dupliziert; Entf öffnet die Löschbestätigung. In Eingabefeldern bleiben die üblichen Texteingabefunktionen erhalten.

Position, Maße, Farben, Beschriftungen, Sperren und Hallenzuordnung bleiben nach Neuladen erhalten. Der Undo-Verlauf gilt für die aktuelle Sitzung im Baumodus, nicht über einen Seitenwechsel oder Neuladen hinweg.

## Wände, Türen und Tore

Die Bibliothek bietet eine frei platzierbare Wand für Außen- und Trennwände. Türen, Personenausgänge, Notausgänge und Hallentore werden in der Nähe einer Wand platziert und mit ihr verbunden. Breite, Höhe, zugehörige Wand und Versatz sind rechts einstellbar. Position und Drehung folgen der Wand. Zum Drehen einer Öffnung die Wand drehen.

Die Wand wird geometrisch in Teilstücke aufgeteilt; unter dem Sturz bleibt die Öffnung tatsächlich frei. Türblätter stehen schematisch offen, Hallentore sind als offene Durchfahrt mit oberem Rollkasten dargestellt.

**Wanddarstellung** bietet offene Ansicht, alle Wände und ausgeblendete Wände. Die offene Ansicht blendet vordere Außenwände abhängig von der Kamera aus. Es gibt kein Dach. Räume werden durch Wände und frei benannte Flächen manuell aufgebaut, nicht automatisch erkannt.

## Lagersysteme und Materialien

- Palettenregal mit Stützen, Traversen und Palettenplätzen.
- Fachbodenregal mit Ebenen und Spalten.
- Kleinteileregal mit leeren bzw. belegten Kästen.
- Schieberegal mit separat konfigurierten Bereichen.
- Lagerschrank mit geöffneten Türen und inneren Fachböden.
- Bodenlagerplatz mit eigener Fach-ID.

**Fächer & Struktur bearbeiten** öffnet die bestehende 2D-/3D-Vorschau. Spalten, Ebenen und Bereiche sind bearbeitbar. Speichern übernimmt den Entwurf, Abbrechen verwirft ihn. Umbenennen erhält interne Fach-IDs; belegte Fächer sind vor Strukturverlust geschützt.

Ein Fach in 3D auswählen und **Materialien am Lagerplatz öffnen** wählen. Im normalen Lagermodus öffnet ein Fach direkt die Materialdetails. Die zentrale Suche fokussiert den wirklichen Lagerplatz. Objektklicks und Kamerabewegungen im normalen Lagermodus verschieben keine Bauteile.

## Schieberegal

Die Beispielhalle enthält 10 × 10 Fächer Hinten und 10 × 7 jeweils in Mitte und Vorne. Alle drei Bereiche sind im Regaleditor frei konfigurierbar.

Rechts beim ausgewählten Schieberegal:

- Bewegungsrichtung X oder Z unter Eigenschaften einstellen und übernehmen.
- Segmente über ihre Schieberegler einzeln zur Ansicht versetzen.
- Auseinanderziehen aktivieren oder Bereiche einzeln ausblenden.
- Mit Segmentansicht zurücksetzen zur Ausgangsansicht zurückkehren.

Die Ansicht verändert weder Fachcodes noch Materialzuordnungen. Schienen und Rollen sind schematisch; eine echte mechanische Anlage wird nicht simuliert. Die visuellen Verschiebungen und Sichtbarkeitseinstellungen werden nicht als physische Layoutänderungen gespeichert.

## Wege und Markierungen

Fußweg und Staplerfahrweg bestehen aus bearbeitbaren lokalen X/Z-Stützpunkten. Punkte hinzufügen, entfernen und Wegbreite einstellen; nach Übernehmen entstehen entsprechend viele 3D-Segmente. Markierte Querung, Pfeile, Sperrflächen, Stell- und Ladeplätze, Wareneingang/-ausgang und benannte Flächen haben eigene Farbe, Maße und Beschriftung.

Planungshinweise berücksichtigen Objekttypen: Ein Stapler darf auf seinem Stell-/Ladeplatz oder Fahrweg stehen. Regale auf Fußwegen, feste Überschneidungen und Objekte außerhalb der Halle werden gewarnt. Eine Warnung verhindert die Platzierung nicht. Wandöffnungen werden nach Durchfahrtshöhe berücksichtigt.

## Beschriftungen und Kamera

Die Standardperspektive ist schräg von oben. In 3D linke Maustaste drehen, Mausrad zoomen, rechte Maustaste verschieben. Im Grundriss zoomt ebenfalls das Mausrad. Die Kamera kann über das Augensymbol zurückgesetzt werden.

In der Gesamtübersicht bleiben Hallen-/Bereichsnamen, bei Annäherung erscheinen Regalnamen. Fachcodes erscheinen bei Auswahl oder Hover. Weiche Übergänge und unterschiedliche Ein-/Ausblendschwellen vermeiden Flackern. Sichtbare Schilder werden nach Priorität angeordnet, damit sie sich nicht überdecken. Wandtiefe und Verdeckung werden berücksichtigt. Der Beschriftungsschalter blendet auch die ausgewählten Beschriftungen aus.

## Speicherung und Migration

Alles bleibt lokal im Browser und dem jeweils ausgewählten Lager zugeordnet. `lagerraum-v1` bleibt als alte Sicherung unverändert. Beim ersten Laden einer bisherigen Version-2-Lagerverwaltung wird zusätzlich **lagerraum-v2-vor-baumodus** gesichert, bevor die separate Beispielhalle ergänzt wird. Vorhandene Lager, IDs und Bestände bleiben erhalten.

Der JSON-Gesamtexport enthält Hallen, Wege, Ausstattung, Regale, Materialien und Belegungen aller Lager. Alte Version-1-Exporte bleiben importierbar. Ein Import wird validiert und muss bestätigt werden. Die neue Beispielhalle enthält ausschließlich fiktive Materialien.

## Tatsächliche Prüfungen

```sh
npm test
npm run build
node scripts/check-builder.mjs
node scripts/check-builder-library.mjs
node scripts/check-browser.mjs
```

Die Browserprüfungen erwarten den laufenden Server auf Port 5173 und Chromium unter `/usr/bin/chromium`; alternativ `BASE_URL` und `CHROMIUM_PATH` setzen. Alle verwenden frische Browserprofile und verändern keine Nutzerdaten. Für die eigenständige HTML-Datei zusätzlich `npm run build:standalone` ausführen und `CHECK_STANDALONE=1 node scripts/check-browser.mjs` verwenden.

Die Prüfergebnisse liegen unter `/workspace/shared/lagerraum-baumodus-tests` und `/workspace/shared/lagerraum-tests`. Berichtet werden nur aktuell erfolgreich abgeschlossene Läufe.

## Grenzen

Rechteckige, achsparallele Hallenböden; Wände und einzelne Bauteile sind frei drehbar. Keine beliebigen Bodenpolygone, automatischen Raumerkennung, CAD-Genauigkeit, Traglast- oder verbindlichen Sicherheitsprüfung. Kollisionshinweise beruhen auf vereinfachten Grundrisskörpern und Öffnungshöhen. Keine Mehrbenutzer-Synchronisierung, externe Datenbank oder physikalische Fahrzeug-/Schiebemechanik. Desktop-Bedienung ist der Schwerpunkt.

Die drei im Anforderungstext erwähnten Referenzbilder waren nicht mitgeliefert. Die Gestaltung folgt daher der textlich beschriebenen offenen Hallenansicht, ohne eine bildgenaue Umsetzung zu behaupten.
