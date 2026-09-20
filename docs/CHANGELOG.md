# PhiX — Changelog

Kurzbeschreibung der wesentlichen Änderungen pro **Build** (`PHIX_BUILD` in [`APP_VERSION.md`](APP_VERSION.md)). Neueste Einträge zuerst.

Ältere Builds (vor 434): siehe Git-Historie (`git log --oneline`).

---

## Build 534 (2026-09-20)

Excel-Export für Einrichtungs-Tokens in der Benutzerverwaltung:
- Neuer Button „Liste exportieren“ im Dialog nach der Benutzererstellung hinzugefügt.
- Exportiert die generierten Einrichtungs-Tokens als formatierte `.xlsx`-Datei mit Spalte 1 (Benutzername) und Spalte 2 (Token).
- Jede Tabellenzeile ist auf 2 cm Höhe (~56,7 pt) skaliert und vertikal zentriert formatiert (optimal zum Ausdrucken und Zerschneiden in Übergabestreifen).

## Build 529 (2026-09-20)

Fix Initialisierung der Schülerverwaltung:
- Behebt einen `ReferenceError: hasSchoolYears is not defined` beim Rendern der Schülerverwaltung.

## Build 528 (2026-09-19)

Fix State-Deklaration in der Schülerverwaltung:
- Behebt einen `ReferenceError: importProgress is not defined` beim Laden der Schülerverwaltungs-Ansicht.

## Build 527 (2026-09-19)

Krypto-Authentifizierung beim Leeren der Schülerliste korrigiert:
- Behebt ein Problem, bei dem der Aufruf zum Löschen der Schülerliste eines Schuljahres ohne Authentifizierungs-Token an das Backend gesendet wurde und dadurch fälschlicherweise ein Krypto-Session-Verlust („Sitzung abgelaufen“) mit Logout ausgelöst wurde.

## Build 526 (2026-09-19)

Fortschritts-Overlay für den Schülerlisten-Import:
- Beim Datei-Import von Schülerlisten (CSV/Excel) wird ein zentriertes Fortschritts-Overlay mit Lade-Animation, Fortschrittsbalken in Prozent, Zähler (`X von Y`) und Name des aktuell verarbeiteten Schülers angezeigt.

## Build 525 (2026-09-19)

Layout-Optimierung des Dialogs zur Schuljahres-Anlage:
- Maximale Breite des Dialogs „Neues Schuljahr anlegen“ vergrößert und Zeilenumbruch der Beschriftung („Zentrales Schuljahr“) flexibilisiert, um horizontales Scrollen zu vermeiden.

## Build 524 (2026-09-19)

Automatische Entschlüsselung & Migration bestehender Schuljahre und Stammschüler:
- Beim Laden von Schuljahren und Stammschülern werden bestehende, verschlüsselte Einträge (`enc:v1:...`) transparent mit dem DEK der Krypto-Session entschlüsselt und automatisch in Klartext überführt.
- Verhindert kryptische Darstellungen von Schuljahres-Labels und Schülernamen aus vorherigen Versionen.

## Build 523 (2026-09-19)

Zentrale Schülerverwaltung für Administratoren & persönliche Schüler-Ergänzungen:
- **Zentrale Stammliste**: Administratoren können zentrale Schuljahre und Stammschüler für die gesamte Schule pflegen (auch per Excel-/CSV-Import).
- **Schulweiter Zugriff**: Alle angemeldeten Benutzer (Lehrkräfte) haben Lesezugriff auf zentrale Schuljahre und können Schüler direkt in ihre Fächer/Kurse übernehmen.
- **Persönliche Schüler**: Jede Lehrkraft kann in zentralen oder eigenen Schuljahren weiterhin eigene persönliche Schüler ergänzen (nur für den jeweiligen Benutzer sichtbar).
- **Visuelle Kennzeichnung**: Klare Unterscheidung von zentralen Stammschülern und persönlichen Schülern über Badges („Zentral“ / „Eigener Schüler“) in der Schülerverwaltung und den Kurseinstellungen.
- **Berechtigungen**: Zentrale Schuljahre und Stammschüler können ausschließlich von Administratoren bearbeitet oder gelöscht werden; persönliche Schüler bleiben durch den jeweiligen Benutzer editierbar.

## Build 522 (2026-09-16)

Kontrastverbesserung im Wunschnachbarn-Dialog:
- Schriftfarbe der ausgewählten Wunschnachbarn in den Chips (`.seating-plan-wish-filled-chip`) auf Schwarz (`#000000`, Schriftstärke 600) angepasst, um optimale Lesbarkeit auf dem hellen Hintergrund zu gewährleisten.
- Design des Löschen-Buttons (`.seating-plan-wish-clear-btn`) für bessere Sichtbarkeit auf dunklen Text und dezenten Hintergrund abgestimmt.

## Build 521 (2026-09-16)

Wunschnachbarn-Generator für den Sitzplan:
- Neuer Button „Wunschnachbarn“ links neben „Zufällig verteilen“ in der Sitzplan-Toolbar.
- Modaler Dialog mit übersichtlicher Tabelle: Spalte 1 (Nr.), Spalte 2 (Schülerliste als ziehbare Elemente), Spalten 3 & 4 (Wunschnachbar 1 und Wunschnachbar 2).
- Drag & Drop-Zuweisung von Schülernamen aus Spalte 2 in die Wunschspalten (mit Unterstützung für Mehrfachnennungen sowie Schnellauswahl per Dropdown und Einzel-Löschung).
- Intelligenter Optimierungsalgorithmus (Simulated Annealing): Berechnet beim Klick auf „Generieren“ eine optimale Sitzordnung, die ein Maximum der Wunschnachbarschaften (direkte Tischnachbarn sowie Vorder-/Hinter-/Diagonalnachbarn) lückenlos ab Reihe 1 Platz 1 (unten links) erfüllt.

## Build 520 (2026-09-16)

Sitzplan-Erweiterungen:
- Neuer Button „Zufällig verteilen“ ergänzt: Verteilt alle Schüler des aktuellen Kurses per Zufallsauswahl lückenlos auf die eingestellte Sitzordnung, beginnend ab Reihe 1 Platz 1 (unten links).
- Toolbar-Layout im Sitzplan überarbeitet: Die Aktionen sind nun zweizeilig angeordnet. „Sitzplan leeren“ befindet sich in der zweiten Zeile unter „Maximieren“, links daneben der neue Button „Zufällig verteilen“.

## Build 519 (2026-09-13)

Automatisches Speichern im Auto-Backup-Bereich: Alle Änderungen an Einstellungen (Schalter, Dropdowns, Text- und Zahleneingaben) werden nun unmittelbar und debounced im Hintergrund gespeichert. Der manuelle Button „Einstellungen speichern“ wurde durch eine dezente Statusanzeige („Änderungen werden automatisch gespeichert“ / „Automatisch gespeichert“) ersetzt.

## Build 518 (2026-09-13)

Fehlerbehebung in `BackupView`: Die Hilfsfunktion `isSectionOpen` zur Bestimmung des Aufklappzustands der Backup-Bereiche wurde wiederhergestellt.

## Build 517 (2026-09-13)

Feedback-Meldungen als modales Popup: Erfolgs- und Fehlermeldungen (z. B. nach Ausführen des Auto-Backups, Speichern der Einstellungen, Verbindungstests oder Löschen von Sicherungen) in `BackupView` werden nun über ein modales Dialog-Popup (`showAlert`) mit OK-Button und Klick-außerhalb-Schließen angezeigt.

## Build 516 (2026-09-13)

Verbesserte Lesbarkeit der Status-Badges: Schriftfarbe in den grünen Erfolgs-Badges (`.auto-backup-badge--success`) im Bereich „Letzte Ausführung“ der Auto-Backup-Verwaltung auf Schwarz (`#000000`) gesetzt.

## Build 515 (2026-09-13)

USB- und Wechselmedien-Mounts für Docker bereitgestellt: Host-Mounts für `/media`, `/run/media` und `/mnt` im `backend`-Dienst in [`docker-compose.yml`](../docker-compose.yml) ergänzt, sodass am Host angeschlossene USB-Speichermedien (z. B. `/media/karsten/USBFORPI`) auch innerhalb des Docker-Containers erkannt und für das Auto-Backup genutzt werden können.

## Build 514 (2026-09-12)

Fehlerbehebung beim Ausführen des USB-Auto-Backups: 
1. Beim Sofort-Ausführen (`POST /api/backup/auto/run-now`) wird der aktuelle Formularzustand (inkl. USB-Aktivierung und USB-Pfad) automatisch vorab übergeben und gespeichert, sodass Änderungen nicht durch den nachfolgenden Konfigurations-Reload überschrieben/gelöscht werden.
2. `ensureAutoBackupSchema` in `auto-backup-service.js` prüft und ergänzt fehlende Tabellenspalten (`usbEnabled`, `usbPath`, `lastStatusUsb`) dynamisch auch bei bestehenden Datenbankinstanzen.

## Build 513 (2026-09-12)

Korrektur und Absicherung der Build-Versionssynchronisation: Das Synchronisationsskript `sync-app-version.mjs` aktualisiert bei vorhandener `APP_VERSION.md` automatisch alle `package.json`-Dateien (`Notenauswertung-App`, `backend`, `desktop`) und greift in isolierten Docker-Build-Kontexten primär auf die bestehende `appVersion.js` zurück, wodurch ein Zurücksetzen der Versionsanzeige auf veraltete `package.json`-Stände (wie Build 479) auf der Login- und Info-Seite zuverlässig verhindert wird.

## Build 512 (2026-09-12)

Erweiterung des Auto-Backup-Systems um einen dritten Speicherort (USB-Speichermedium): Automatische Erkennung angeschlossener USB- und Wechsellaufwerke unter Linux, Windows und macOS (`listAvailableDrives` in `drive-detector.js`), direkte Speicherung der Backup-Dateien im Hauptverzeichnis des ausgewählten USB-Laufwerks (ohne Unterordner) inkl. automatischer Rotation und robuster Fehlerbehandlung (Trennen des USB-Sticks bricht lokale Sicherung und SFTP-Upload nicht ab). Konfigurationsoberfläche in `BackupView` mit Dropdown-Auswahl, Suchbutton für Laufwerke und separater Statusanzeige (`USB: OK`, `USB: Fehler`, `USB: Aus`).

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
