# Roadmap: Server stabil halten + Desktop-Standalone mit SQLite

**Issue-Pakete (GitHub-Issues / Karten):** siehe `ISSUE_PACKAGES_SERVER_DESKTOP_SQLITE.md`

Ziel: Die bestehende Server-Version bleibt stabil und produktiv nutzbar, waehrend parallel eine Standalone-Desktop-Version aufgebaut wird.  
Leitprinzip: **Ein gemeinsamer Codekern**, zwei Laufzeitprofile (`web`, `desktop`), minimale Verzweigung.

---

## 0) Leitplanken (einmalig festlegen)

- Server-Version bleibt Referenz und darf nicht regressieren.
- Fachlogik, API, Frontend-Komponenten bleiben gemeinsam.
- Desktop-spezifischer Code nur in klaren Shell-/Infra-Schichten.
- Jede Aenderung muss in beiden Profilen pruefbar sein.

**Definition of Done pro Feature:**
- Web: Start + Basis-Smoke-Test ok
- Desktop: Start + Basis-Smoke-Test ok
- Datenmodell-Aenderungen: Migrationspfad fuer Postgres (web) und SQLite (desktop) dokumentiert

---

## 1) Phase A - Bestand absichern (Web bleibt stabil)

### A1. Baseline erfassen
- [x] Aktuellen Start-/Build-Prozess fuer Web dokumentieren.
- [x] Kritische User-Flows als Smoke-Checkliste festhalten (Login, Kurs anlegen, Schueler, Klausur, Export, Klassenlehrer/Geldliste).
- [x] Bekannte Risiken/Schulden notieren (z. B. hardcodierte API-URLs, DB-Annahmen).

### A2. Technische Guardrails
- [x] Einheitliche Config-Variablen definieren: `APP_MODE`, `DATABASE_URL`, `PORT`, `PHIX_FRONTEND_DIST`.
- [x] Frontend API-Basis zentralisieren (eine Stelle fuer Base-URL).
- [x] Backend-Start in zwei Schichten splitten: `createApp()` und `startServer()`.

**Abnahme Phase A:**
- Web funktioniert unveraendert wie bisher.
- Kein Feature-Verlust, keine geaenderte Bedienung im Browserbetrieb.

---

## 2) Phase B - Dual-Mode Infrastruktur (noch ohne SQLite)

### B1. Laufzeitprofile einfuehren
- [x] Profil `web`: heutiges Verhalten.
- [x] Profil `desktop`: lokales Backend + lokales Frontend-Asset (APP_MODE + Portable-Skript).
- [x] Profilumschaltung nur via Environment/Startskript, nicht ueber verstreute `if`-Logik.

### B2. Desktop-Huelle aufsetzen (Electron oder Tauri)
- [x] `desktop/`-Projekt anlegen (Electron, siehe `docs/ADR-001-desktop-electron.md`).
- [x] Desktop startet Backend-Prozess kontrolliert (Start/Stop, Port, Logs).
- [x] App-Fenster statt externem Browser oeffnen.
- [x] Dev-Workflow: Hot-Reload fuer Frontend + lokales Backend (`desktop/README.md`).

### B3. Packaging vorbereiten
- [x] Windows-Build erzeugt lauffaehiges Desktop-Artefakt (`desktop`: `npm run dist` / `dist-pack`, siehe `desktop/README.md`).
- [x] Datenpfade in benutzerschreibbaren Ordnern (`%APPDATA%\PhiX` / `PHI_X_USERDATA_DIR`, keine mutable Daten unter Program Files).

**Abnahme Phase B:**
- Web weiter stabil.
- Desktop startet zuverlaessig als Programmfenster mit bestehender Postgres-Variante.

---

## 3) Phase C - SQLite-Migration fuer Desktop (parallel zu Postgres-Web)

## Zielbild Datenbank
- Web-Profil: Postgres bleibt Standard.
- Desktop-Profil: SQLite wird Standard.
- Prisma-Schema unterstuetzt beide Provider mit klarer Trennung.

### C1. Migrationsstrategie festlegen
- [x] Entscheidung: ein gemeinsames Prisma-Schema mit provider-Switch oder getrennte Schema-Dateien. → **Zwei Schema-/Prisma-Projekte** (`docs/ADR-002-prisma-postgres-sqlite.md`).
- [x] Namenskonvention fuer Migrationsordner und Provider-spezifische DDL festlegen. → **`prisma/sqlite/schema.prisma`**, vorerst **`db push`** beim Start; Postgres bleibt unter `prisma/schema.prisma` + `prisma/migrations/`.
- [x] Backup-/Rollback-Strategie fuer Desktop-Daten definieren. → **`docs/SQLITE_DESKTOP.md`**

### C2. Prisma/DB-Layer umstellen
- [x] SQLite-Connection-Handling einbauen (`file:`-URL, Datenpfad pro Benutzer).
- [x] Potenziell inkompatible Typen/Default-Werte pruefen und anpassen. (Schema gespiegelt; Postgres bleibt Referenz.)
- [ ] Indizes/Constraints fuer SQLite verifizieren (Smoke + ggf. CI).

### C3. Datenuebernahme (optional, aber empfohlen)
- [x] Einmaliger Importpfad Postgres -> SQLite fuer bestehende Desktop-Nutzer. → **Dokumentiert** (`docs/SQLITE_IMPORT.md`); automatisches Skript optional später.
- [ ] Validierungsbericht nach Migration (Datensaetze, Summen, Stichproben) — bei Bedarf mit eigenem Import-Skript.

---

## 4) Phase D - Testmatrix & CI fuer Parallelbetrieb

### D1. Automatisierte Pruefungen
- [ ] Unit/Integration fuer geteilte Fachlogik.
- [x] API-Smoketests fuer beide Profile (`backend/scripts/ci-smoke.js`, GitHub Actions).
- [ ] UI-Smoke (mindestens Login + Kernflow) fuer Web und Desktop.

### D2. CI-Matrix
- [x] Job `backend-postgres` (`.github/workflows/ci.yml`).
- [x] Job `backend-sqlite` (`.github/workflows/ci.yml`).
- [x] Job `frontend-build` (Vite `npm run build`).
- [ ] Artefakte + Logs pro Job speichern (optional, z. B. bei Fehlern).

**Abnahme Phase D:**
- Jeder Merge prueft beide Betriebsarten.
- Fehler sind eindeutig einem Profil zuordenbar.

---

## 5) Phase E - Release, Betrieb, Rueckfalloption

### E1. Release-Prozess trennen, Codebasis gemeinsam
- [ ] Zwei Release-Artefakte: `web` (wie bisher), `desktop` (Installer/Portable).
- [ ] Gemeinsame Versionierung + Changelog mit Profilhinweisen.

### E2. Monitoring & Support
- [ ] Desktop-Fehlerlogs zentral auffindbar machen.
- [ ] Migrations-/DB-Fehler mit klaren Endnutzer-Hinweisen.

### E3. Rollback-Plan
- [ ] Desktop-Fallback auf vorherige Version dokumentieren.
- [ ] Datenbank-Backup vor jeder Desktop-Migration erzwingen.

**Abnahme Phase E:**
- Release ist reproduzierbar.
- Support kann Web- und Desktop-Probleme getrennt analysieren.

---

## Konkrete Arbeitsreihenfolge (kurz, operativ)

1. **A1/A2** abschliessen (Baseline + Guardrails) ✅  
2. **B1/B2** umsetzen (Dual-Mode + Desktop-Shell) ✅  
3. **B3** Packaging stabilisieren ✅  
4. **C1** SQLite-Migrationsdesign finalisieren (ADR ✅, Ordner-/Backup-Konvention ✅)  
5. **C2** Prisma/DB-Layer fuer SQLite implementieren ✅ (Verifikation/CI: `ci:smoke` + Workflow)  
6. **C3** Datenuebernahme + Validierung — Konzept/Doku ✅ (`docs/SQLITE_IMPORT.md`); Import-Skript + Stichproben offen  
7. **D1/D2** Testmatrix und CI absichern — CI Postgres/SQLite + Frontend-Build + `npm test` (Node, `test/*.test.js`) ✅; weitere Integration/UI-Smoke + Artefakte (D2) offen  
8. **E1-E3** Releaseprozess + Rollback + Betriebsdoku

---

## Offene Entscheidungen (frueh klaeren)

- ~~Desktop-Framework: Electron oder Tauri?~~ **Electron** (`docs/ADR-001-desktop-electron.md`).
- ~~Prisma-Setup: ein Schema oder zwei Schema-Dateien?~~ **Zwei Prisma-Projekte** (`docs/ADR-002-prisma-postgres-sqlite.md`); SQLite unter `prisma/sqlite/`.
- ~~Desktop-Datenpfad und Backup-Format?~~ **`%APPDATA%\PhiX\phix.db`** (Electron), Backup: **`docs/SQLITE_DESKTOP.md`**
- Migrationspolitik: automatische Migration beim Start oder expliziter Migrationsschritt? → vorerst **`prisma db push`** beim Serverstart (wie bisher Postgres); SQLite identisch.

---

## Mindestumfang fuer ersten nutzbaren Meilenstein (MVP)

- Desktop-Fenster startet App lokal.
- Login, Kursverwaltung, Notenansicht funktionieren.
- SQLite als lokale DB aktiv.
- Web-Version weiterhin unveraendert nutzbar.
- Einfache Build-Anleitung fuer beide Varianten vorhanden.

