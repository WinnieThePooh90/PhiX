# PhiX / Notenauswertung unter Windows

## Eine Datei zum Herunterladen (empfohlen fuer Endanwender)

**Ja, das ist moeglich.** Sie bauen ein Release und verteilen **eine ZIP** oder **eine Setup.exe** – ohne dass Nutzer Node.js, Docker oder PostgreSQL separat installieren.

| Schritt (Sie) | Ergebnis fuer Nutzer |
|---------------|----------------------|
| `Build-Release.bat` ausfuehren | `release/PhiX-Windows-x64.zip` |
| Optional: `installer/PhiX-Portable.iss` kompilieren | `PhiX-Setup.exe` |

Nutzer: ZIP entpacken → **`PhiX.cmd`** starten **oder** Setup.exe installieren → Desktop-Verknuepfung **PhiX**.

Alles Weitere: **`installer/RELEASE.md`**

---

## Installation fuer Entwickler (mit Node.js)

1. [Node.js LTS](https://nodejs.org/) installieren.
2. Optional: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (fuer Docker-Modus).
3. **`Installieren.bat`** doppelklicken und den Anweisungen folgen.
4. Nach der Installation: Desktop-Verknuepfung **PhiX** startet die App.

Der Installer kopiert die Anwendung nach `%LOCALAPPDATA%\Programs\PhiX` (oder einen gewaehlten Ordner), installiert npm-Abhaengigkeiten und legt Verknuepfungen auf dem Desktop und im Startmenue an.

Deinstallation: `Deinstallieren.bat` im Installationsordner oder Startmenue → PhiX deinstallieren.

Details: `installer/README.md`. Fuer eine verteilbare **PhiX-Setup.exe** (ohne gebündelte Runtimes): Inno Setup mit `installer/PhiX-Setup.iss` kompilieren.

---

Docker Compose bleibt die empfohlene Variante (unveraendert). Zusaetzlich koennen Sie die App nativ unter Windows starten.

## Voraussetzungen

| Variante | Benoetigt |
|----------|-----------|
| **Docker (komplett)** | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **Nativ** | [Node.js](https://nodejs.org/) LTS (20+) und PostgreSQL |

## Variante 1: Docker Compose (wie bisher)

1. `install_windows.bat` einmal ausfuehren (optional, beschleunigt den ersten Build)
2. `start_docker.bat` doppelklicken  
3. Browser: **http://localhost:1990**

Stoppen: `stop_docker.bat`, **Herunterfahren** im Benutzermenü (rechts oben) oder `docker compose down`

Nach Aenderungen am Shutdown: einmal `docker compose build backend` und `docker compose up -d` (fester Projektname `phix` in `docker-compose.yml`).

Ports in `.env` (Vorlage: `.env.example`):

- `FRONTEND_PORT` (Standard 1990)
- `BACKEND_PORT` (Standard 3000)
- `DB_PORT` (Standard 5432) – nur der **Host**-Port; im Docker-Netz bleibt die DB intern auf 5432

**Fehler `Bind for 0.0.0.0:5432 failed: port is already allocated`:** Port 5432 ist auf dem PC schon belegt (alter `phix-db`-Container, `start_db_docker.bat`, oder lokale PostgreSQL). Lösung: `stop_docker.bat`, in Docker Desktop alle Postgres-Container stoppen, oder in `.env` z. B. `DB_PORT=5433` setzen und erneut `docker compose up -d`.

## Variante 2: Nativ mit Datenbank in Docker

Gut fuer Entwicklung: App laeuft direkt in Node, nur PostgreSQL im Container.

1. `install_windows.bat`
2. `start_db_docker.bat` (PostgreSQL starten)
3. `backend\.env` aus `backend\.env.example` (wird beim ersten Start ggf. automatisch angelegt)
4. `start_notenauswertung.bat`
5. Browser: **http://localhost:5173** (Vite leitet `/api` an Port 3000 weiter)

## Variante 3: Komplett nativ

PostgreSQL unter Windows installieren und Datenbank anlegen:

- Datenbank: `notenauswertung`
- Benutzer: `noten_user` / Passwort: `noten_password`  
  (oder eigene Werte in `backend\.env` eintragen)

Dann wie Variante 2, aber ohne `start_db_docker.bat`.

## Erster Login

Bei leerer Datenbank legt das Backend automatisch den Benutzer **admin** an.

- Standardpasswort: `admin`
- Eigenes Passwort beim ersten Start: `BOOTSTRAP_ADMIN_PASSWORD` in `backend\.env` setzen

Passwort spaeter aendern:

```bat
cd backend
npm run set-admin-password -- admin IhrNeuesPasswort
```

## Skripte

| Datei | Zweck |
|-------|--------|
| `Installieren.bat` | **Windows-Installer** (Kopie, npm, Desktop-Verknuepfung) |
| `PhiX-start.bat` | Start ueber Desktop-Verknuepfung (ohne Installer-Fenster) |
| `install_windows.bat` | `npm install` fuer Backend und Frontend, Prisma Client |
| `start_docker.bat` | Gesamte App per Docker Compose |
| `stop_docker.bat` | Container stoppen |
| `start_db_docker.bat` | Nur PostgreSQL-Container |
| `start_notenauswertung.bat` | Backend + Frontend nativ |
