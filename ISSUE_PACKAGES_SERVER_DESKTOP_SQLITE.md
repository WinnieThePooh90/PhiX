# Issue-Pakete: Server stabil + Desktop-Standalone (SQLite)

Diese Pakete ergänzen die Roadmap in `ROADMAP_SERVER_DESKTOP_SQLITE.md`.  
Jedes Paket ist so geschnitten, dass es **ein eigenes GitHub-Issue** (oder eine Projekt-Karte) sein kann.

**Legende**

- **Blockiert durch:** vorher abgeschlossen
- **Labels (Vorschlag):** `phase:A|B|C|D|E`, `area:web|desktop|shared`, `type:docs|infra|db|frontend|release`

---

## Epic 0 – Rahmen (Meta, ein Issue)

| Feld | Inhalt |
|------|--------|
| **Titel** | `[Epic] Parallelbetrieb Web (Postgres) + Desktop (SQLite)` |
| **Ziel** | Gemeinsamer Kern, zwei Laufzeitprofile, keine Regression der Server-Version. |
| **Blockiert durch** | — |
| **Tasks** | Roadmap verlinken; DoD für Features festhalten; Release-Namen klären. |
| **Abnahme** | Epic-Beschreibung + Link zu Smoke-Checkliste in Repo-Doku. |

---

## Phase A – Bestand & Guardrails

### A-1 – Smoke-Checkliste & Baseline-Doku

| Feld | Inhalt |
|------|--------|
| **Titel** | `[A] Smoke-Checkliste und Web-Baseline dokumentieren` |
| **Ziel** | Reproduzierbare Mindesttests für die Server-Version. |
| **Blockiert durch** | Epic 0 |
| **Tasks** | Start/Build Web dokumentieren; User-Flows als Checkliste (Login, Kurs, Schüler, Klausur/Tests/Mündlich, Export, Klassenlehrer/Geldliste); Risiken (URLs, Ports, DB) notieren. |
| **Abnahme** | Neue oder erweiterte Doku-Datei + Checkliste abhakbar. |

### A-2 – Zentrale API-Basis im Frontend

| Feld | Inhalt |
|------|--------|
| **Titel** | `[A] Frontend: zentrale API-Base-URL (Vorbereitung Desktop)` |
| **Ziel** | Kein verstreutes `fetch('/api/...')` ohne gemeinsame Basis. |
| **Blockiert durch** | A-1 |
| **Tasks** | Modul z. B. `apiBase.js` / Hook; alle relevanten Aufrufe migrieren; Vite-Proxy für Dev unverändert lassen. |
| **Abnahme** | Web-Dev und Web-Prod unverändert nutzbar; ESLint/Review: keine neuen direkten Root-API-Aufrufe ohne Basis. |

### A-3 – Backend: `createApp` / `startServer` trennen

| Feld | Inhalt |
|------|--------|
| **Titel** | `[A] Backend: Express-App von Server-Start entkoppeln` |
| **Ziel** | Backend embeddable (Desktop startet gleichen Code). |
| **Blockiert durch** | A-1 |
| **Tasks** | `createApp()` exportieren; `startServer()` / `server.js` Entry; bestehende Docker/npm-Starts prüfen. |
| **Abnahme** | `npm start` / Docker: gleiches Verhalten; keine neuen Endpoints nötig. |

### A-4 – Konfiguration: `APP_MODE` und Env-Doku

| Feld | Inhalt |
|------|--------|
| **Titel** | `[A] Konfiguration: APP_MODE + .env.example / WINDOWS.md ergänzen` |
| **Ziel** | Klare Schalter für `web` vs. `desktop` (auch wenn Desktop noch Postgres nutzt). |
| **Blockiert durch** | A-3 |
| **Tasks** | `APP_MODE` auswerten wo nötig; `.env.example` + kurze Doku; Default = heutiges Web-Verhalten. |
| **Abnahme** | Ohne gesetztes `APP_MODE` verhält sich die App wie bisher. |

---

## Phase B – Desktop-Hülle (zuerst noch Postgres wie portable)

### B-1 – Entscheidung: Electron vs. Tauri

| Feld | Inhalt |
|------|--------|
| **Titel** | `[B] ADR: Desktop-Framework (Electron vs. Tauri)` |
| **Ziel** | Eine Richtung für alle folgenden Desktop-Pakete. |
| **Blockiert durch** | A-4 |
| **Tasks** | Kriterien: Größe, Build, Team-Kenntnis, Auto-Update, Code-Signing; kurzes ADR in `docs/` oder Repo-Root. |
| **Abnahme** | ADR gemerged; Issue B-2/B-3 verweist darauf. |

### B-2 – Monorepo-Ordner `desktop/` + Dev-Start

| Feld | Inhalt |
|------|--------|
| **Titel** | `[B] Desktop-Shell: Projekt anlegen und Dev-Workflow` |
| **Ziel** | Fenster öffnet lokale App; Entwickler können parallel Web entwickeln. |
| **Blockiert durch** | B-1, A-2, A-3 |
| **Tasks** | `desktop/package.json`; Main-Prozess startet `node backend/server.js` (oder gebündeltes Binary) mit Env; Child-Prozess-Lifecycle (exit/crash); optional: Dev-URL zu Vite. |
| **Abnahme** | `npm run dev` (o.ä.) im Desktop-Ordner: Fenster + funktionierende UI gegen lokales Backend. |

### B-3 – Backend-Prozess: Port, Logs, sauberes Beenden

| Feld | Inhalt |
|------|--------|
| **Titel** | `[B] Desktop: Backend-Lifecycle (Port, Logs, Shutdown)` |
| **Ziel** | Keine Zombie-Prozesse; reproduzierbare Logs. |
| **Blockiert durch** | B-2 |
| **Tasks** | Freier Port oder konfigurierbar; Log-Pfad; on `before-quit` Backend beenden; Doppelstart vermeiden. |
| **Abnahme** | App schließen beendet Backend; erneuter Start funktioniert. |

### B-4 – Packaging Windows (Desktop-Artefakt)

| Feld | Inhalt |
|------|--------|
| **Titel** | `[B] Windows-Build für Desktop-Artefakt` |
| **Ziel** | Installierbares oder ZIP-ähnliches Paket nur für Desktop-Spur. |
| **Blockiert durch** | B-3 |
| **Tasks** | Build-Skript; User-Daten unter `%APPDATA%` o.ä.; README „Desktop bauen“. |
| **Abnahme** | Frischer PC-Test: entpacken/starten ohne manuelle Node-Installation (oder wie im ADR festgelegt). |

### B-5 – Postgres-Desktop optional behalten (Übergang)

| Feld | Inhalt |
|------|--------|
| **Titel** | `[B] Optional: bestehende portable Postgres weiter unterstützen bis SQLite live` |
| **Ziel** | Risikoarme Übergangsphase für Beta-Tester. |
| **Blockiert durch** | B-4 |
| **Tasks** | `DATABASE_URL` weiter Postgres; Doku „Legacy Desktop“ vs. „SQLite Desktop“. |
| **Abnahme** | Dokumentiertes Profil `desktop+postgres` vs. später `desktop+sqlite`. |

---

## Phase C – SQLite für Desktop

### C-1 – ADR: Prisma-Strategie (ein Schema vs. zwei)

| Feld | Inhalt |
|------|--------|
| **Titel** | `[C] ADR: Prisma für Postgres (Web) + SQLite (Desktop)` |
| **Ziel** | Klare Migrations- und Build-Story. |
| **Blockiert durch** | B-1 (kann parallel zu B-2 starten, ideal nach A-4) |
| **Tasks** | Schema-Duplikat vs. `multiSchema`/zwei `schema.prisma`; wie `prisma generate` in CI; Naming der Migrations. |
| **Abnahme** | ADR mit gewählter Variante + Konsequenzen für Entwickler. |

### C-2 – SQLite-Schema & `prisma db push` / Migrate für Desktop

| Feld | Inhalt |
|------|--------|
| **Titel** | `[C] SQLite: Schema bereitstellen und Desktop-DB-Pfad` |
| **Ziel** | Desktop nutzt `file:`-SQLite unter Benutzerdaten. |
| **Blockiert durch** | C-1, A-3 |
| **Tasks** | Provider SQLite; Typen/JSON/Enums prüfen; Desktop setzt `DATABASE_URL` beim Start; erste Migration oder `db push` Policy festlegen. |
| **Abnahme** | Desktop-Profil startet mit leerer SQLite; Admin-Login + Minimal-Flow wie Smoke-Liste. |

### C-3 – Postgres-Migrationen vs. SQLite: Prozess abstimmen

| Feld | Inhalt |
|------|--------|
| **Titel** | `[C] Doppel-Migration: Änderungen an Modellen für beide DBs` |
| **Ziel** | Kein Modell-Drift zwischen Web und Desktop. |
| **Blockiert durch** | C-2 |
| **Tasks** | Checkliste für jedes Schema-PR (Postgres-Migration + SQLite-Schritt); CI-Job der beide validiert. |
| **Abnahme** | Dokumentierte PR-Checkliste; CI grün für beide. |

### C-4 – Optional: Import Postgres → SQLite (Desktop)

| Feld | Inhalt |
|------|--------|
| **Titel** | `[C] Optional: Einmaliger Datenimport für Desktop-Umsteiger` |
| **Ziel** | Bestehende Nutzer können Daten mitnehmen. |
| **Blockiert durch** | C-2 |
| **Tasks** | Exportformat oder Tool; Validierung (Counts, Stichproben); Doku. |
| **Abnahme** | Dokumentierter Importpfad + Test auf Beispiel-Dump. |

---

## Phase D – Qualität & CI

### D-1 – CI: Job `web-postgres`

| Feld | Inhalt |
|------|--------|
| **Titel** | `[D] CI: Web-Stack (Build + minimaler API-Smoke)` |
| **Ziel** | Jeder Merge schützt die Server-Version. |
| **Blockiert durch** | A-3 |
| **Tasks** | Backend starten, Health/migrate, ein paar `curl`/Playwright-Schritte optional. |
| **Abnahme** | CI grün auf Default-Branch. |

### D-2 – CI: Job `desktop-sqlite`

| Feld | Inhalt |
|------|--------|
| **Titel** | `[D] CI: Desktop-Profil mit SQLite (Smoke)` |
| **Ziel** | Desktop-Regression früh erkennen. |
| **Blockiert durch** | C-2, B-2 |
| **Tasks** | Headless oder kurzer Start-Test; SQLite in Temp-Dir. |
| **Abnahme** | CI-Job stabil grün. |

### D-3 – E2E-Light (optional)

| Feld | Inhalt |
|------|--------|
| **Titel** | `[D] Optional: E2E (Playwright) für Web und/oder Desktop` |
| **Ziel** | Kritische Flows automatisiert. |
| **Blockiert durch** | D-1 |
| **Tasks** | 1–3 Szenarien; nur wenn Aufwand gerechtfertigt. |
| **Abnahme** | Dokumentierter Lauf in CI oder lokal. |

---

## Phase E – Release & Betrieb

### E-1 – Getrennte Release-Artefakte

| Feld | Inhalt |
|------|--------|
| **Titel** | `[E] Release: Web vs. Desktop versionieren und bauen` |
| **Ziel** | Zwei Artefaktlinien aus einem Commit. |
| **Blockiert durch** | B-4, C-2 |
| **Tasks** | Tags/Changelog-Sektionen; Build-Pipeline-Split. |
| **Abnahme** | Zwei reproduzierbare Build-Kommandos dokumentiert. |

### E-2 – Backup & Rollback Desktop-DB

| Feld | Inhalt |
|------|--------|
| **Titel** | `[E] Desktop: SQLite-Backup vor Migration + Rollback-Hinweise` |
| **Ziel** | Nutzerdaten bei Updates geschützt. |
| **Blockiert durch** | C-2 |
| **Tasks** | Kopie `*.db` vor Migration; Doku für Support. |
| **Abnahme** | Update-Doku + manueller Test. |

### E-3 – Nutzerdoku: zwei Installationswege

| Feld | Inhalt |
|------|--------|
| **Titel** | `[E] Doku: Server/Web vs. Desktop-Standalone` |
| **Ziel** | Verwechslungen vermeiden. |
| **Blockiert durch** | E-1 |
| **Tasks** | Kurz-FAQ; Ports; wo liegen Daten; was ist nicht kompatibel (z. B. nur Desktop-SQLite). |
| **Abnahme** | README oder Wiki-Eintrag verlinkt von `WINDOWS.md` / Haupt-README. |

---

## Abhängigkeitsgraph (vereinfacht)

```
Epic 0
  → A-1 → A-2
       → A-3 → A-4
              → B-1 → B-2 → B-3 → B-4 → B-5 (optional)
              → C-1 → C-2 → C-3 → C-4 (optional)
A-3 + C-2 + B-2 → D-2
A-3 → D-1
E-1/E-2/E-3 nach stabilem Desktop+SQLite
```

---

## Empfohlene Issue-Reihenfolge (Backlog-Nummern)

1. Epic 0  
2. A-1 → A-2, A-3 (parallel möglich nach A-1)  
3. A-4  
4. B-1 → B-2 → B-3 → B-4  
5. C-1 → C-2 → C-3  
6. D-1 → D-2 (D-3 optional)  
7. E-1 → E-2 → E-3  
8. B-5 und C-4 nach Bedarf einreihen

---

## Kurz für Copy-Paste (GitHub Issue Body Template)

```markdown
## Paket
<ID> <Titel>

## Ziel


## Tasks
- [ ] 
- [ ] 

## Abnahme


## Blockiert durch
- 

## Labels
phase: | area: | type:
```
