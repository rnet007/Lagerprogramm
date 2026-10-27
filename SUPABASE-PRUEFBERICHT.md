# Prüfung: Supabase und Cloudflare Pages

Stand: 27.10.2026. Nur fiktive Lager-/Materialdaten und zufällig erzeugte temporäre Testzugänge verwendet. Kein externes Projekt verändert und kein kostenpflichtiger Dienst gebucht.

## Tatsächlich bestanden

- **73 Unit-Tests** in 9 Dateien für die bestehenden Lager-, Builder-, Import-/Export-, Einräum- und SAP-Funktionen.
- **TypeScript-Prüfungen** der Cloudflare Functions und des bisherigen Node-Servers.
- **Produktionsbuild und Cloudflare-Functions-Build** mit Wrangler.
- **7 Browser-/Integrationstestgruppen** gegen echte lokale PostgreSQL-16-, Supabase-GoTrue- und PostgREST-Container sowie Cloudflare workerd:
  1. Sichere erste Admin-Einrichtung über das mitgelieferte SQL, zweite Ersteinrichtung abgewiesen; Anmeldung, HttpOnly-/SameSite-Cookies, Admin-Dashboard ohne Lager; öffentliche Registrierung in Anwendung und Auth-Dienst blockiert.
  2. Zwei Beispiele nur auf ausdrückliche Aktion erzeugt, wiederholte Aktion ohne Duplikate; Nutzer mit Lagerzuweisung angelegt, Startpasswortwechsel vor Datenzugriff erzwungen. Fremdes Lager und Schreiben als Leser abgewiesen.
  3. Direkte Supabase-Anmeldung ohne zugelassene Anwendungssitzung ohne Lagerzugriff. Für eine gültige Lesersitzung: RLS zeigt nur zugewiesenes Lager, direkte RPC-Schreibversuche, Profilbeförderung und Admin-RPC werden abgewiesen.
  4. Mitarbeiter kann Bestand/Zuordnungen speichern, aber keine Regalstruktur ändern.
  5. Zwei voneinander getrennte Chromium-Browser-Kontexte: Material im Bearbeitungsdialog in A geändert und gespeichert, automatisch in B angezeigt. Führende Nullen (`00007045210`), Bestand und Neuladen erhalten. Gleichzeitige Änderungen verursachen einen sofortigen 409-Konflikt; offene Formulare und Eingaben bleiben erhalten und können nach Abbruch mit aktuellem Stand erneut bearbeitet werden.
  6. Passwort-Reset ersetzt Passwort, sperrt vorherige Sitzungen und erzwingt den erneuten Wechsel. Deaktivierung sperrt Zugriff und Anmeldung.
  7. Abmeldung sperrt Datenzugriff. Keine unbehandelten Browserfehler.

Reproduzierbar: `npm test`, `npm run check:cloudflare`, `npm run check:server`, `npm run build:cloudflare`, anschließend mit Docker und Chromium `node scripts/check-supabase-cloudflare.mjs`. Der Test zieht bei Bedarf die im Skript benannten Container-Images; alle Container werden danach entfernt. Es handelt sich um reale lokale Dienste, nicht um simulierte Auth-Antworten.

## Noch nicht durchgeführt / Voraussetzung fehlt

**Keine Bereitstellung in einem gehosteten Supabase-Projekt oder einem Cloudflare-Konto durchgeführt. Keine öffentliche Pages-URL veröffentlicht und kein Online-Zweisitzungstest bestanden gemeldet.** Dafür fehlen das vom Nutzer zu erstellende eigene Free-Projekt, dessen Migration/Admin-Einrichtung sowie die geschützten Runtime-Bindings und Git-Verbindung im Cloudflare-Pages-Projekt. Für diese Konten stehen hier weder Connector noch verwertbare Kontozugangsdaten bereit. Secrets dürfen nicht im Chat oder im Repository abgelegt werden.

HTTPS-/Secure-Cookie-Verhalten und Free-Quoten des tatsächlichen öffentlichen Deployments müssen dort abschließend geprüft werden. Lokale Tests laufen per HTTP auf Loopback und bestätigen HttpOnly/SameSite, nicht öffentliches HTTPS. E-Mail-Versand, MFA, automatisches Backup/Restore, echte Unternehmensdateien, eine direkte SAP-Verbindung und Lasttests sind nicht Bestandteil dieser Prüfung.

Die Anwendung synchronisiert durch Polling etwa alle 15 Sekunden bzw. bei Fokuswechsel, nicht über Supabase Realtime. Speichern verwendet derzeit synchrone API-Anfragen der vorhandenen Editoren; bei langsamer Verbindung kann die Oberfläche kurz blockieren. Ein Revisionskonflikt wird abgelehnt, nicht automatisch zusammengeführt. Free-Ressourcen sind begrenzt; die Testversion enthält keine automatische Tarifumstellung.

Die nächsten konkreten Schritte stehen in [SUPABASE-CLOUDFLARE.md](SUPABASE-CLOUDFLARE.md).
