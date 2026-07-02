# Smoke-Tests (Docker-Server & Desktop)

Festhalten, wie die Referenz-Installationen laufen und was vor jedem Release kurz geprüft werden sollte.

| Stand | Wert |
|-------|------|
| Letzte inhaltliche Aktualisierung | 2026-07-02 |

---

## Unterstützte Produktvarianten

| Szenario | Kurzbeschreibung | Wo dokumentiert |
|----------|------------------|-----------------|
| **Docker (Server)** | `docker compose` → Frontend-Port (z. B. 1990) | [`WINDOWS.md`](../WINDOWS.md), `docker-compose.yml`, `.env.example` |
| **Electron Desktop (Release)** | `cd desktop && npm run dist` | [`desktop/README.md`](../desktop/README.md), [`BUILD_VERSIONEN.md`](BUILD_VERSIONEN.md) |
| **Electron Desktop (Dev)** | `Notenauswertung-App`: `npm run dev`; `desktop`: `npm run dev` | [`desktop/README.md`](../desktop/README.md) |

**Nicht vorgesehen:** eigenständiger Web-App-Betrieb (Browser + Backend ohne Docker oder Electron).

---

## Smoke-Checkliste (manuell, ~10–15 Min.)

Vor einem Release oder nach größeren Infra-Änderungen — **je Variante**, die Sie ausliefern:

### Docker-Server

0. **Health** – `curl -s http://localhost:1990/api/health` → `{"ok":true,"needsWizard":…}` (kein 502).
1. **Ersteinrichtung** (frische DB) – Einrichtungsassistent: admin-Passwort, optional Arbeitskonto, Start-Tipps; danach Anmeldung.
2. **Login** – Anmeldung; Session bleibt nach Reload.
3. **Kurs** – Kurs anlegen oder wechseln.
4. **Schüler** – Schüler hinzufügen, Namen ändern.
5. **Klausur** – Note eintragen, speichern, Reload.
6. **Hilfe** – **Einstellungen → Hilfe**: Start-Tipps sichtbar.
7. **Export** – ein Export ohne Fehler.
8. **Herunterfahren** – Menü „Herunterfahren“ / `docker compose down` wie erwartet.

### Electron-Desktop

1. **Start** – `PhiX.exe` oder Dev (`desktop/npm run dev`).
2. **Ersteinrichtung** (leere DB) – Einrichtungsassistent wie oben.
3. **Login** – wie oben.
4. **Kurs / Schüler / Klausur** – Kurztest mit Reload.
5. **SQLite** – Datei unter `data/phix.db` (Release) bzw. `%APPDATA%\PhiX` (Dev) wächst bei Speichern.
6. **Schließen** – Backend-Prozess endet; erneuter Start lädt Daten.

---

## Bekannte Risiken / technische Schulden

- **API-URLs:** Zentral über `Notenauswertung-App/src/utils/apiBase.js` (`apiFetch`, `apiUrl`); Electron-Dev kann `VITE_API_BASE_URL` setzen.
- **Frontend-Auslieferung:** Docker nutzt **nginx**; Electron-Release nutzt gebündeltes Frontend unter `PHIX_STANDALONE` / `PHIX_FRONTEND_DIST` (siehe `backend/createApp.js` → `setupStandaloneFrontend`).
- **Datenbank:** Prisma mit **PostgreSQL** für Docker; **SQLite** mit `DATABASE_URL=file:…` für Electron — siehe [`SQLITE_DESKTOP.md`](SQLITE_DESKTOP.md).
- **Shutdown:** Verhalten hängt von `PHIX_DOCKER_SHUTDOWN`, `PHIX_COMPOSE_DIR` ab — siehe `backend/lib/phix-shutdown.js`.
- **Schema:** Zwei Prisma-Schemas manuell synchron — siehe [`ADR-002-prisma-postgres-sqlite.md`](ADR-002-prisma-postgres-sqlite.md).

---

## Frontend-Konfiguration (API-Basis)

| Variable | Bedeutung |
|----------|-----------|
| `VITE_API_BASE_URL` | Optional. Leer = relative URLs (Docker, Electron-Release). Gesetzt = z. B. `http://127.0.0.1:3000` für Electron-Dev. |

Siehe `Notenauswertung-App/src/utils/apiBase.js` und `Notenauswertung-App/.env.example`.

---

## Backend-Konfiguration (Profile)

| Variable | Bedeutung |
|----------|-----------|
| `DATABASE_URL` | PostgreSQL (Docker) oder `file:` (Electron/SQLite). |
| `PORT` | HTTP-Port des Backends (Standard 3000). |
| `PHIX_FRONTEND_DIST` | Pfad zum gebauten Frontend (`dist` mit `index.html`) — **nur Electron**. |
| `PHIX_STANDALONE` | `1` = Backend liefert statisches Frontend aus — **nur Electron-Desktop**. |
| `PHIX_DOCKER_SHUTDOWN` | `1` = „Herunterfahren“ stoppt Docker-Stack (Backend-Container). |

Siehe `backend/.env.example`.

---

## CI / gleiche Prüfungen lokal (ohne GitHub-Workflow)

Es liegt **kein** `.github/workflows/ci.yml` im Repository. Die folgenden Schritte können **manuell** ausgeführt werden:

- **Backend Postgres:** im Ordner `backend/`: `npm ci`, `npm test`, `npx prisma migrate deploy`, `npm run ci:smoke` mit `DATABASE_URL=postgresql://…`.
- **Backend SQLite:** im Ordner `backend/`: `npm ci`, `npm test`, `npx prisma db push --schema=prisma/sqlite/schema.prisma`, `npm run ci:smoke` mit z. B. `DATABASE_URL=file:./ci-smoke.sqlite`.
- **Frontend-Build (Docker/Desktop):** im Ordner `Notenauswertung-App/`: `npm ci` und `npm run build`.

Immer im Backend: `npm test` (ohne Datenbank) und bei gesetztem `DATABASE_URL`: `npm run ci:smoke`.
