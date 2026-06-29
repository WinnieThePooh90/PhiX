# PhiX / Notenauswertung unter Windows

PhiX wird unter Windows in **zwei Varianten** betrieben:

| Variante | Typisch für | Start |
|----------|-------------|--------|
| **Docker Compose** | Schulserver, mehrere Clients im Browser | `start_docker.bat` → Browser :1990 |
| **Electron Desktop** | Einzelplatz, USB-tauglich | `PhiX.exe` aus `desktop/dist-pack/` |

Ausführliche Build-Anleitungen: **`docs/INSTALL_SERVER_UND_DESKTOP_WINDOWS.md`**, **`docs/BUILD_VERSIONEN.md`**.

---

## Voraussetzungen

| Variante | Benötigt |
|----------|-----------|
| **Docker** | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **Electron (Build)** | [Node.js](https://nodejs.org/) LTS (20+) |
| **Entwicklung** | Node.js LTS; optional Docker Desktop |

---

## Variante 1: Docker Compose

1. `.env` im Projektroot aus `.env.example` anlegen (Ports anpassen falls nötig).
2. **`start_docker.bat`** doppelklicken (oder `docker compose up -d --build` im Projektroot).
3. Browser: **http://localhost:1990**

Stoppen: **`stop_docker.bat`**, Menü **„Herunterfahren“** in der App, oder `docker compose down`.

Ports in `.env` (Vorlage: `.env.example`):

- `FRONTEND_PORT` (Standard 1990)
- `BACKEND_PORT` (Standard 3000)
- `DB_PORT` (Standard 5432) – nur der **Host**-Port; im Docker-Netz bleibt die DB intern auf 5432

**Fehler `Bind for 0.0.0.0:5432 failed: port is already allocated`:** Port 5432 ist belegt (alter Container, lokale PostgreSQL). Lösung: `stop_docker.bat`, Container in Docker Desktop stoppen, oder in `.env` z. B. `DB_PORT=5433` setzen und erneut `docker compose up -d`.

Nach Änderungen am Shutdown: einmal `docker compose build backend` und `docker compose up -d` (fester Projektname `phix` in `docker-compose.yml`).

---

## Variante 2: Electron Desktop

Release bauen (Windows, mit Node.js):

```bat
cd backend
npm install
cd ..\Notenauswertung-App
npm install
npm run build
cd ..\desktop
npm install
npm run dist
```

Ergebnis: **`desktop\dist-pack\`** (ZIP und/oder Portable-EXE).

Nutzer: ZIP entpacken oder Portable-EXE starten → **`PhiX.exe`**. SQLite-Datenbank unter **`<Installationsordner>\data\phix.db`**.

Details: **`desktop/README.md`**, **`docs/SQLITE_DESKTOP.md`**.

---

## Entwicklung (mit Node.js)

Smoke-Tests: **`docs/SMOKE_WEB_BASELINE.md`**

### Docker (empfohlen für Server-Test)

```bash
docker compose up -d --build
```

### Web-Frontend + Backend (Vite)

```bash
cd backend && npm install && npm run dev
cd Notenauswertung-App && npm install && npm run dev
```

Browser: **http://localhost:5173** (Vite leitet `/api` an Port 3000 weiter). PostgreSQL per Docker Compose oder eigene `DATABASE_URL` in `backend/.env`.

### Electron-Desktop (Dev)

Zusätzlich drittes Terminal: `cd desktop && npm run dev` — siehe **`desktop/README.md`**.

---

## Erster Login

Bei leerer Datenbank legt das Backend automatisch den Benutzer **admin** an.

- Beim ersten Start: Benutzer `admin` anlegen lassen, dann auf der Anmeldeseite **„Erstes Passwort festlegen“** — kein Standardpasswort, kein npm-Skript.

Passwort ändern (nur eigenes Konto): in der App unter **Benutzerverwaltung** nach Anmeldung.

---

## Skripte (Projektroot)

| Datei | Zweck |
|-------|--------|
| `start_docker.bat` | Gesamte App per Docker Compose |
| `stop_docker.bat` | Container stoppen |
| `clean-build.bat` | `node_modules`, `dist`, `dist-pack` entfernen |
