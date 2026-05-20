# Web-Baseline & Smoke-Tests (Server-Version)

Diese Datei ist Teil der Roadmap **Phase A** (`ROADMAP_SERVER_DESKTOP_SQLITE.md`):  
festhalten, wie die Referenz-Installation (Browser + Backend + Postgres) läuft und was vor jedem Release kurz geprüft werden sollte.

## Typische Start-/Build-Pfade

| Szenario | Kurzbeschreibung | Wo dokumentiert |
|----------|------------------|-----------------|
| Docker (alles) | `docker compose` → Frontend-Port (z. B. 1990) | `WINDOWS.md`, `docker-compose.yml`, `.env.example` |
| Nativ + Vite | Backend Port 3000, Vite leitet `/api` weiter | `WINDOWS.md`, `Notenauswertung-App/vite.config.js` |
| Portable Windows | Node + Postgres + gebautes Frontend | `installer/RELEASE.md`, `portable/Start-PhiX.ps1` |

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

## Bekannte Risiken / technische Schulden (Stand Roadmap-Start)

- **API-URLs:** Historisch viele `fetch('/api/...')`. Zentral über `src/utils/apiBase.js` (`apiFetch`, `apiUrl`); Desktop kann später `VITE_API_BASE_URL` setzen.
- **Vite vs. Standalone:** Dev nutzt Proxy auf Backend; Portable nutzt oft ein gebündeltes Frontend unter `PHIX_STANDALONE` / `PHIX_FRONTEND_DIST` (siehe Backend `setupStandaloneFrontend`).
- **Datenbank:** Prisma mit **PostgreSQL** (`DATABASE_URL=postgresql://…`) für Server/Docker; **SQLite** mit `DATABASE_URL=file:…` und zweitem Schema unter `prisma/sqlite/` für Desktop — siehe `docs/SQLITE_DESKTOP.md`.
- **Shutdown:** Verhalten hängt von `PHIX_DOCKER_SHUTDOWN`, `PHIX_COMPOSE_DIR`, eingebetteter Postgres (`PHIX_PGDATA` / `PHIX_PGBIN`) ab — siehe `backend/lib/phix-shutdown.js`.

## Frontend-Konfiguration (API-Basis)

| Variable | Bedeutung |
|----------|-----------|
| `VITE_API_BASE_URL` | Optional. Leer = relative URLs (Standard Web). Gesetzt = z. B. `http://127.0.0.1:3000` für Desktop-Dev oder getrennte Hosts. |

Siehe `Notenauswertung-App/src/utils/apiBase.js`.

## Backend-Konfiguration (Profile)

| Variable | Bedeutung |
|----------|-----------|
| `APP_MODE` | `web` (Standard) oder `desktop` — Logging/ spätere Verzweigung; unbekannte Werte werden wie `web` behandelt. |
| `DATABASE_URL` | PostgreSQL-Verbindung (Pflicht für aktuelle Web-Version). |
| `PORT` | HTTP-Port des Backends (Standard 3000). |
| `PHIX_FRONTEND_DIST` | Pfad zum gebauten Frontend (`dist` mit `index.html`). |
| `PHIX_STANDALONE` | `1` = Backend liefert statisches Frontend aus (Portable). |

Siehe `backend/.env.example`.

## CI (GitHub Actions)

Workflow `.github/workflows/ci.yml` (manuell auch per **Actions → CI → Run workflow**):

- **backend-postgres:** `npm ci`, `npm test` (Node eingebauter Testrunner), `prisma migrate deploy`, `npm run ci:smoke` gegen den Postgres-Service.
- **backend-sqlite:** `npm ci`, `npm test`, `prisma db push` mit `prisma/sqlite/schema.prisma`, `npm run ci:smoke` mit `DATABASE_URL=file:./ci-smoke.sqlite`.
- **frontend-build:** `npm ci` und `npm run build` im Ordner `Notenauswertung-App`.

Lokal im Backend: `npm test` (ohne Datenbank) und bei gesetztem `DATABASE_URL`: `npm run ci:smoke`.
