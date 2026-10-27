# Manueller SAP-Abgleich

Hinweis zur Datenhaltung: Aussagen zur lokalen Browser-Speicherung betreffen die Offline-Demo. In der zentralen Version werden bestätigte Lagerdaten und SAP-Arbeitsfälle auf dem Server gespeichert und durch Benutzerrechte geschützt; siehe [BENUTZERKONTEN.md](BENUTZERKONTEN.md). Excel-/CSV-Dateien werden weiterhin lokal eingelesen und erst nach Bestätigung übernommen.

Der Tab **SAP-Abgleich** ist eine lokale Arbeitsliste für das aktuell ausgewählte Lager. Er hat **keine Verbindung zu SAP** und kennt keine tatsächlichen SAP-Daten. **Erledigt** bedeutet ausschließlich, dass Sie die Prüfung beziehungsweise Übertragung manuell bestätigt haben.

## Offene Einträge abarbeiten

Die Liste enthält Materialnummer als Text, Bezeichnung, alten/neuen Lagerplatz, Zeitpunkt der Zuordnung, Erstellzeit, Status und **Erledigt**. Die drei wichtigsten Werte sind groß dargestellt, einzeln kopierbar und auch ohne Zwischenablage-API über fokussierte Textfelder mit Strg+C kopierbar. Führende Nullen werden nicht entfernt.

Offene Einträge erscheinen standardmäßig mit der ältesten Erstellung zuerst. Die Suche findet Materialnummer, Bezeichnung sowie alte/neue Plätze. Oben stehen die aktuellen Anzahlen offen/erledigt und offene Klärhinweise; frühere Erledigungen zählen weiterhin zum Verlauf, nicht zur aktuellen Erledigt-Anzahl eines wieder geöffneten Eintrags.

**Erledigt** entfernt einen Eintrag sofort aus der offenen Liste. Unter **Erledigte Einträge** lässt er sich wieder öffnen. **Verlauf** enthält unveränderliche Momentaufnahmen mit Zeitpunkt, Aktion, vorherigen/nachherigen Angaben und Begründung. Die Suche berücksichtigt dort auch frühere Werte. Zeitangaben in der Oberfläche werden für Berlin dargestellt; gespeichert werden ISO-Zeitangaben in UTC.

## Automatische und bewusste Aufnahme

Eine **neue Material-/Fachzuordnung im Einräum-Modus** erzeugt automatisch einen offenen Eintrag. Mehrere Fachzuordnungen desselben Materials haben getrennte Einträge. Dieselbe offene Zuordnung wird nicht mehrfach angelegt. Eine bloße wiederholte Bestätigung derselben Zuordnung oder Mengenänderung ist kein neuer Zuordnungsfall.

Vorhandene Zuordnungen werden beim Öffnen oder Aktualisieren nicht automatisch klassifiziert. Über **Bestehende Zuordnung markieren** wählen Sie Material und konkretes Fach bewusst aus und geben den alten Platz an. Bei solchen älteren Zuordnungen bleibt der tatsächliche ursprüngliche Zuordnungszeitpunkt **unbekannt**. Die neue Erstellzeit bezeichnet nur das Markieren für diese Arbeitsliste. Materialien ohne Fach können ausdrücklich als Klärfall markiert werden.

Ein eindeutiger offener Klärfall ohne Ziel wird bei einer späteren Einräum-Zuordnung mit dem tatsächlichen Ziel verknüpft, statt einen zweiten gleichartigen Fall zu erzeugen.

## Änderungen, fehlende Angaben und Löschungen

Ändern sich nach einer Erledigung Materialangaben, verknüpfter Fachcode oder eindeutig zugehöriger alter Platz, wird der betroffene Eintrag erneut offen. Die bisherigen Erledigungen und alten Werte bleiben im Verlauf. Neue alte Platzangaben werden nur bei eindeutiger Quelle übernommen; andernfalls bleibt die Angabe zur Klärung offen.

Eine eindeutige vollständige Umlagerung kann als Änderung desselben Eintrags nachvollzogen werden, einschließlich altem/neuem Ziel. Bei mehreren nicht eindeutig zuordenbaren Änderungen bleiben historische Angaben mit einem Klärhinweis erhalten. Neue Einräum-Ziele werden zusätzlich als eigener Vorgang aufgenommen. Es werden daraus keine tatsächlichen SAP-Änderungen abgeleitet.

Wird eine Zuordnung, ein Fach oder ein Material entfernt, bleiben Nummer, Namen und letzte bekannte Codes als Momentaufnahme erhalten. Die Liste kennzeichnet ausdrücklich, dass die Zuordnung entfernt oder der Code historisch ist. Sie zeigt diese Daten nicht als weiterhin gültigen Lagerbestand an. Ein bisher erledigter Fall wird wieder offen. Der Verlauf wird durch gewöhnliche Lageränderungen nicht gelöscht.

Fehlt ein alter oder neuer Platz, ist **Erledigt** zunächst gesperrt. Über **Angaben klären** lassen sich die Angaben bewusst korrigieren. Eine vorhandene Materialzuordnung kann verknüpft werden; alternativ ist eine ausdrücklich manuelle neue Platzangabe möglich. Diese bearbeitet nur die Arbeitsliste und erzeugt keine Lagerbelegung. Ein fehlender Lagerbezug bleibt als Hinweis sichtbar. Wenn beide Angaben vorhanden sind, kann die manuelle Bearbeitung bestätigt werden – weiterhin ohne Aussage über tatsächliche SAP-Daten.

Die Korrektur eines erledigten Eintrags öffnet ihn erneut und schreibt einen Änderungsverlauf. Eine bereits anderweitig erfasste Material-/Fachkombination wird nicht noch einmal angelegt.

## Rückgängig im Einräum-Modus

Rückgängig stellt Lagerzuordnungen und Mengen wieder her. Bereits entstandene SAP-Arbeitslisteneinträge und ihr Verlauf werden dabei erhalten und als entfernt, geändert oder erneut offen erläutert. Das verhindert, dass ein möglicherweise schon bearbeiteter manueller SAP-Vorgang unbemerkt aus der Arbeitsliste verschwindet.

## Excel und Sicherung

**Offene Liste als Excel herunterladen** exportiert alle offenen Einträge des ausgewählten Lagers – unabhängig vom aktuellen Suchfilter. Enthalten sind die fünf Pflichtspalten sowie Zeitangaben und Klärhinweise. Materialnummern sind sowohl als Zeichenketten als auch mit Excel-Textformat `@` gespeichert. Filter und eingefrorene Überschriften erleichtern die Arbeit.

Offene Einträge, erledigte Einträge und der Verlauf liegen im jeweiligen Lagerdatensatz und bleiben nach Neuladen erhalten. Die bestehende JSON-Sicherung und Wiederherstellung enthalten sie vollständig. Bei einer bewusst bestätigten vollständigen Wiederherstellung ist der Stand der ausgewählten Sicherungsdatei maßgeblich; eine ältere Sicherung enthält entsprechend nur den damaligen Verlauf.

Die Funktion bleibt lokal im Browser. Kein SAP-Login, keine API, keine automatische Übertragung und keine Mehrbenutzer-Synchronisierung. Vor einem Wechsel der Vorschauadresse JSON sichern und am neuen Ort wiederherstellen.

## Tatsächliche Prüfung

Datentests: `npm test`. Browserprüfung: `node scripts/check-sap.mjs`. Einzelne HTML-Datei über HTTP: `CHECK_STANDALONE=1 OUTPUT_DIR=/tmp/lagerraum-sap-html node scripts/check-sap.mjs`.

Die Tests verwenden ausschließlich fiktive Lager-/Materialdaten und frische Browserprofile. Sie prüfen keine tatsächlichen SAP-Daten und keine Verbindung zu einem SAP-System. XLSX-Dateien werden nach dem Download mit ExcelJS wieder geöffnet und auf Textwerte sowie führende Nullen geprüft; eine Microsoft-Excel-Desktopanwendung wurde nicht gestartet.
