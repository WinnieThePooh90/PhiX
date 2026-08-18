# PhiX — Changelog

Kurzbeschreibung der wesentlichen Änderungen pro **Build** (`PHIX_BUILD` in [`APP_VERSION.md`](APP_VERSION.md)). Neueste Einträge zuerst.

Ältere Builds (vor 434): siehe Git-Historie (`git log --oneline`).

---

## Build 499 (2026-08-18)

Fehler behoben, bei dem die Checkboxen in Hausaufgabenlisten nach Abmeldung/Neustart nicht geladen wurden (fehlende Entschlüsselung der verschlüsselten `HomeworkListEntry.checks` in `serializeHomeworkList`).

## Build 478 (2026-08-17)

Schuljahres-Überschriften mit Trennlinien (`2024/2025 ────`) zur Gruppierung der Fächer/Klassen in der Navigationsleiste (Filteransicht & Archiv) ergänzt.

## Build 477 (2026-08-17)

Filter-Option „Archiv“ im Schuljahre-Dropdown der linken Navigationsleiste hinzugefügt. Bei Auswahl werden alle archivierten Klassen in der Hauptliste der Navigationsleiste angezeigt.

## Build 452 (2026-07-02)

Start-Tipps des Einrichtungsassistenten (Schritt 5: Verweis auf **Einstellungen → Hilfe**); dieselben Tipps oben auf der Hilfe-Seite (`setupStartTips.js`). README und Installations-/API-Dokumentation auf den aktuellen Stand gebracht; dieses Changelog angelegt.

## Build 451 (2026-07-02)

Automatische P3009-Recovery für die fehlgeschlagene Migration `referat_auswertung_hilfe` beim PostgreSQL-`migrate deploy` (Serverstart).

## Build 450 (2026-07-02)

Migration `referat_auswertung_hilfe` korrigiert (Spalte erst nach Anlegen von `ReferatEntry`); Hilfsskript `resolve-referat-migration.js`; `docker-compose.yml` ohne veraltetes `version`-Feld.

## Build 449 (2026-06-28)

Kein Einrichtungsassistent mehr bei API-Fehlern (z. B. nginx 502): nur gültige JSON-Antworten zählen als erreichbares Backend; Fehlermeldung statt Login oder Assistent.

## Build 448 (2026-06-28)

Keine Mindestlänge mehr für Passwörter im Einrichtungsassistenten (freie Wahl, z. B. kurze PINs).

## Build 447 (2026-06-28)

`/api/health` liefert `needsWizard`; robustere Bootstrap-Erkennung mit Retries; Meldung bei nicht erreichbarem Backend statt stillem Login-Fallback.

## Build 446 (2026-06-28)

`needsWizard` in der Session-Antwort (401); Wizard-Status ohne separaten Fehlerfall über Session abrufbar.

## Build 445 (2026-06-28)

`ensureAppUsers` vor `app.listen`; parallele Wizard-Abfrage; Assistent erscheint zuverlässiger bei frischer Installation.

## Build 444 (2026-06-30)

**Einrichtungsassistent** bei frischer Installation: admin-Passwort, optional Arbeitskonto, Start-Tipps; API `wizard-status` / `work-user`.

## Build 443 (2026-06-30)

Dokumentation und Build-Metadaten; diverse Repo-Pflege (u. a. README, SQLite-Doku).

## Build 442 (2026-06-30)

Build-Metadaten-Sync.

## Build 441 (2026-06-30)

Dependency-Overrides (npm audit) in Desktop- und App-`package.json`.

## Build 439 (2026-06-30)

Desktop: `prisma db push --accept-data-loss` vor Serverstart (`db-push.js`).

## Build 438 (2026-06-30)

FAQ-Texte bereinigt (kein institutioneller Schulserver-Betrieb mehr).

## Build 437 (2026-06-30)

Vorlage „Plateau 1“ aus Notenschlüssel-Ansicht entfernt.

## Build 436 (2026-06-30)

Development-Login-Button entfernt; Registrierungsschlüssel-Validierung (Marker PHIX) angepasst.

## Build 434 (2026-06-30)

Schul-IT-/Schulnetz-Doku aus Installationsanleitung entfernt; E2E- und Sicherheitstexte in `SECURITY.md` gebündelt; README/Docs bereinigt.
