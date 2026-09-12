# PhiX — Changelog

Kurzbeschreibung der wesentlichen Änderungen pro **Build** (`PHIX_BUILD` in [`APP_VERSION.md`](APP_VERSION.md)). Neueste Einträge zuerst.

Ältere Builds (vor 434): siehe Git-Historie (`git log --oneline`).

---

## Build 511 (2026-09-12)

Verwaltung lokaler Auto-Backups: Neuer Button „Backups anzeigen“ neben der Vorhalteanzahl in `BackupView`, Anzeige aller vorhandenen Dateien im `Autobackups/`-Ordner inkl. Dateigröße, Zeitstempel, Download- und Löschfunktion; entsprechende Backend-Endpunkte (`/api/backup/auto/list`, `/api/backup/auto/download/:filename`, `/api/backup/auto/delete/:filename`) implementiert.

## Build 510 (2026-09-12)

Benennung der Auto-Backup-Dateien an die Zeitzone Berlin (`Europe/Berlin`) angepasst (`formatBerlinTimestamp`), sodass die Dateinamen (z. B. `phix-autobackup-2026-09-12T22-12-00.json`) exakt der lokalen Uhrzeit entsprechen.

## Build 509 (2026-09-12)

Lokales Auto-Backup-Verzeichnis fest auf `Autobackups/` im PhiX-Wurzelverzeichnis fixiert: Host-Volume-Mount in `docker-compose.yml` (`./Autobackups:/app/Autobackups`) hinzugefügt, automatische Pfadauflösung im Backend für Desktop und Server angepasst und das Formular in `BackupView` vereinfacht.

## Build 508 (2026-09-12)

Fehlerbehebung in `exportPhixDatabase`: Die Variable `autoBackupConfig` wurde im Destructuring-Array des `Promise.all`-Aufrufs nachgetragen, um einen `ReferenceError` beim Zusammenstellen des Backup-Payloads zu beheben.

## Build 507 (2026-09-12)

Fehlerbehebung bei der Auto-Backup-Erstellung: Der Datenbank-Export (`exportPhixDatabase`) im Hintergrunddienst wird nun mit `runWithCryptoContext({ bypassCrypto: true })` ausgeführt, um fehlerhafte Entschlüsselungsversuche (`Unsupported state or unable to authenticate data`) bei Fremddaten anderer Benutzer zu verhindern; Auto-Backup-Endpunkte in `isCryptoExempt` ergänzt.

## Build 506 (2026-09-12)

Automatisches Backup-System implementiert: Wöchentlicher Scheduler (sonntags 00:00 Uhr) mit Catch-up-Prüfung beim Start, Speicherung im konfigurierbaren lokalen Ordner mit automatischer Rotation (Standard: 10 Backups) sowie optionaler Offsite-Upload via SFTP (SSH Port 22) oder FTPS (TLS Port 21/990). Administrationsoberfläche in `BackupView` mit Statusübersicht, Verbindungstest und manueller Sofortausführung ergänzt.

## Build 505 (2026-09-12)

Sichtbarkeit des Buttons „Registrierung löschen“ unter **Info** (`AppInfoView`) auf Benutzer mit Administratorrechten (`userHasAdminRights`) beschränkt.

## Build 504 (2026-09-12)

Sichtbarkeit des Buttons „Herunterfahren“ im Benutzermenü (`HeaderUserMenu`) auf Benutzer mit Administratorrechten (`userHasAdminRights`) beschränkt.

## Build 503 (2026-09-12)

„Danger-Zone“ in den Einstellungen hinzugefügt, um PhiX vollständig auf den Werkszustand zurückzusetzen (inkl. modalem Bestätigungsdialog mit Sicherheits-Checkbox, Löschen aller Datenbanktabellen, Re-Initialisierung des Bootstrap-Admins und automatischem Start des Einrichtungsassistenten).

## Build 502 (2026-09-12)

Nach erfolgreichem Einspielen eines Backups wird der Benutzer automatisch abgemeldet und zur Anmeldemaske weitergeleitet mit dem Hinweis: „Restore erfolgreich. Bitte erneut anmelden.“

## Build 501 (2026-09-12)

Nginx-Reverse-Proxy-Konfiguration (`nginx.conf`) mit `client_max_body_size 64M` versehen, um HTTP 413 (Payload Too Large) beim Wiederherstellen größerer Backups (insb. mit Album-Fotos) zu beheben; Fehleranzeige im Frontend bei HTTP 413 präzisiert.

## Build 500 (2026-09-12)

Vollständige Datenbank-Wiederherstellung (`/api/backup/full/restore`) korrigiert: Befreiung von der Krypto-Session-Prüfung in der Middleware (ermöglicht Wiederherstellung vor Krypto-Einrichtung auf Neusystemen) und Datums-Konvertierung für `UserCrypto.createdAt` beim Datenbank-Import ergänzt.

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
