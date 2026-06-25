# Web-Baseline & Smoke-Tests (Server-Version)

Festhalten, wie die Referenz-Installation (Browser + Backend + Postgres) läuft und was vor jedem Release kurz geprüft werden sollte.

## Typische Start-/Build-Pfade

| Szenario | Kurzbeschreibung | Wo dokumentiert |
|----------|------------------|-----------------|
| Docker (alles) | `docker compose` → Frontend-Port (z. B. 1990) | `WINDOWS.md`, `docker-compose.yml`, `.env.example` |
| Web-Dev (Vite) | Backend Port 3000, Vite leitet `/api` weiter | `README.md`, `Notenauswertung-App/vite.config.js` |
| Electron Desktop | `cd desktop && npm run dist` | `desktop/README.md`, `docs/BUILD_VERSIONEN.md` |

## Smoke-Checkliste (manuell, ~10–15 Min.)

Vor einem Release oder nach größeren Infra-Änderungen abhaken:

1. **Login** – Anmeldung mit bestehendem Benutzer; Session bleibt nach Reload.
2. **Kurs** – Kurs anlegen oder wechseln; Favorit optional.
3. **Schüler** – Schüler hinzufügen, Namen ändern, löschen; Klassenlehrer/Geldliste zeigt aktuelle Liste (falls genutzt).
4. **Klausur** – Eine Klausur öffnen, Note eintragen, speichern / Reload.
5. **Mündlich / Tests** – Kurz öffnen, eine Eingabe, Reload.
6. **GFS** – Zeile anlegen, Checkbox „gehalten“, Reload.
7. **Export** – falls vorhanden: ein Export durchklicken ohne Fehler.
8. **Herunterfahren** – Menü „Herunterfahren“ (oder `/api/shutdown`): sauberer Stop erwartetes Verhalten (je nach Setup: nur Backend oder Compose).

## Bekannte Risiken / technische Schulden

- **API-URLs:** Zentral über `src/utils/apiBase.js` (`apiFetch`, `apiUrl`); Desktop kann `VITE_API_BASE_URL` setzen.
- **Vite vs. Standalone:** Dev nutzt Proxy auf Backend; Electron nutzt gebündeltes Frontend unter `PHIX_STANDALONE` / `PHIX_FRONTEND_DIST` (siehe Backend `setupStandaloneFrontend`).
- **Datenbank:** Prisma mit **PostgreSQL** für Docker; **SQLite** mit `DATABASE_URL=file:…` für Electron — siehe `docs/SQLITE_DESKTOP.md`.
- **Shutdown:** Verhalten hängt von `PHIX_DOCKER_SHUTDOWN`, `PHIX_COMPOSE_DIR` ab — siehe `backend/lib/phix-shutdown.js`.

## Frontend-Konfiguration (API-Basis)

| Variable | Bedeutung |
|----------|-----------|
| `VITE_API_BASE_URL` | Optional. Leer = relative URLs (Standard Web). Gesetzt = z. B. `http://127.0.0.1:3000` für Desktop-Dev oder getrennte Hosts. |

Siehe `Notenauswertung-App/src/utils/apiBase.js`.

## Backend-Konfiguration (Profile)

| Variable | Bedeutung |
|----------|-----------|
| `APP_MODE` | `web` (Standard) oder `desktop` — Logging/Verzweigung. |
| `DATABASE_URL` | PostgreSQL (Docker) oder `file:` (Electron/SQLite). |
| `PORT` | HTTP-Port des Backends (Standard 3000). |
| `PHIX_FRONTEND_DIST` | Pfad zum gebauten Frontend (`dist` mit `index.html`). |
| `PHIX_STANDALONE` | `1` = Backend liefert statisches Frontend aus (Electron). |

Siehe `backend/.env.example`.

## CI / gleiche Pruefungen lokal (ohne GitHub-Workflow)

Es liegt **kein** `.github/workflows/ci.yml` im Repository. Die folgenden Schritte koennen **manuell** ausgefuehrt werden:

- **Backend Postgres:** im Ordner `backend/`: `npm ci`, `npm test`, `npx prisma migrate deploy`, `npm run ci:smoke` mit `DATABASE_URL=postgresql://…`.
- **Backend SQLite:** im Ordner `backend/`: `npm ci`, `npm test`, `npx prisma db push --schema=prisma/sqlite/schema.prisma`, `npm run ci:smoke` mit z. B. `DATABASE_URL=file:./ci-smoke.sqlite`.
- **Frontend:** im Ordner `Notenauswertung-App/`: `npm ci` und `npm run build`.

Immer im Backend: `npm test` (ohne Datenbank) und bei gesetztem `DATABASE_URL`: `npm run ci:smoke`.
