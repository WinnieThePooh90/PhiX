# PhiX unter Windows: Docker-Server und Electron-Desktop

Diese Anleitung beschreibt, wie Sie

1. die **Server-Variante mit Docker Compose** installieren und starten, und  
2. eine **Electron-Standalone-Version** erzeugen und **testweise wie ein Endbenutzer** ausprobieren.

Weitere Übersicht: `WINDOWS.md`, `docs/BUILD_VERSIONEN.md`.

---

## Inhalt

- [Teil 1: Server mit Docker Compose](#teil-1-server-mit-docker-compose)
- [Teil 2: Electron-Desktop-App](#teil-2-electron-desktop-app)
- [Erster Login (Kurzreferenz)](#erster-login-kurzreferenz)
- [Weiterführende Dokumentation](#weiterführende-dokumentation)

---

## Teil 1: Server mit Docker Compose

### 1.1 Was Sie bekommen

Docker Compose startet drei Dienste (siehe `docker-compose.yml` im Projektroot, Compose-Projektname **`phix`**):

| Dienst    | Rolle                         | Host-Port (Standard) |
|-----------|-------------------------------|----------------------|
| `frontend` | gebautes Web-UI (nginx o. Ä.) | **1990** → Container 80 |
| `backend`  | Node-API (Prisma/Postgres)    | **3000** → Container 3000 |
| `db`       | PostgreSQL 15                 | **5432** → Container 5432 |

Die Web-Oberfläche erreichen Sie im Browser über **`http://localhost:1990`** (oder den von Ihnen gewählten `FRONTEND_PORT`).

### 1.2 Voraussetzungen

- **Windows** mit [Docker Desktop](https://www.docker.com/products/docker-desktop/) installiert.
- Docker Desktop **gestartet** (Warten, bis die Engine bereit ist).
- Das **PhiX-Repository** liegt lokal vor (Ordner mit `docker-compose.yml`).

### 1.3 Konfiguration: `.env` im Projektroot

1. Öffnen Sie den **Projektroot** (der Ordner mit `docker-compose.yml`).
2. Legen Sie eine Datei **`.env`** an, falls noch keine existiert.  
   **Vorlage:** kopieren Sie `.env.example` nach `.env` (oder benennen Sie die Vorlage um).

Typischer Inhalt (Ports auf **Ihrem Windows-Rechner**):

```env
FRONTEND_PORT=1990
BACKEND_PORT=3000
DB_PORT=5432
```

- **`DB_PORT`** ist nur der **Host-Port**. Im Docker-Netz spricht das Backend weiterhin den Dienst `db` auf Port **5432** an.
- Wenn Windows meldet, dass **5432** schon belegt ist (lokale PostgreSQL, alter Container): setzen Sie z. B. `DB_PORT=5433`, speichern Sie `.env`, stoppen Sie alte Stacks und starten Sie Compose neu.

### 1.4 Installation und Start (empfohlen: `start_docker.bat`)

1. Docker Desktop starten.
2. Im Projektroot **`start_docker.bat`** per Doppelklick ausführen.

Das Skript:

- prüft, ob `docker` im PATH liegt,
- erzeugt bei Bedarf `.env` aus `.env.example`,
- prüft, ob der in `.env` eingetragene **DB-Host-Port** frei ist,
- führt **`docker compose up -d --build`** aus,
- öffnet den Browser mit **`http://localhost:1990`** (bzw. Ihrem `FRONTEND_PORT`).

**Erster Build:** kann einige Minuten dauern (Images bauen, Abhängigkeiten).

### 1.5 Manueller Start über die Kommandozeile

Eingabeaufforderung oder PowerShell im **Projektroot**:

```bat
docker compose up -d --build
```

Browser: **`http://localhost:<FRONTEND_PORT>`** (Standard **1990**).

### 1.6 Stoppen

Eine der folgenden Optionen:

- **`stop_docker.bat`** im Projektroot, oder  
- In der Web-App: Menü **„Herunterfahren“** (das Backend im Container kann dabei `docker compose down` auslösen — Details `WINDOWS.md`), oder  
- Manuell im Projektroot: `docker compose down`

**Hinweis:** Im `docker-compose.yml` hat der **Backend**-Service `restart: "no"`, damit nach einem kontrollierten Herunterfahren nicht sofort ein neuer Container hochfährt. Datenbank und Frontend können weiter `unless-stopped` nutzen — bei Bedarf separat stoppen (`docker compose stop` / Docker Desktop).

### 1.7 Fehlerbehebung (kurz)

| Problem | Vorgehen |
|---------|----------|
| Port **5432** belegt | `.env`: `DB_PORT` ändern; alte `phix`-Container oder lokale Postgres stoppen. |
| `docker` nicht gefunden | Docker Desktop installieren und PATH prüfen; neues Terminal öffnen. |
| Seite lädt, API-Fehler | `docker compose logs backend` im Projektroot prüfen; `BACKEND_PORT` und Firewall beachten. |

---

## Teil 2: Electron-Desktop-App

**Ziel:** Eine **Desktop-Anwendung** (Electron), die das **Node-Backend** als eigenen Prozess startet und die Web-Oberfläche im **Programmfenster** anzeigt. **SQLite** unter `<Installationsordner>/data/phix.db` — ohne separaten Postgres auf dem Zielrechner.

**Doku:** `desktop/README.md`, `desktop/main.cjs`, SQLite: `docs/SQLITE_DESKTOP.md`

### 2.1 Voraussetzungen zum Bauen

- **Windows** (laut `desktop/README.md` baut **`npm run dist`** die Windows-Ziele zuverlässig **unter Windows**).
- **Node.js** (LTS, z. B. 20+) im PATH — in der **Eingabeaufforderung (cmd)** ausführen, wenn PowerShell `npm` wegen Execution Policy blockiert.
- **Internet** für `npm install` (u. a. Electron-Download).
- Build **nicht** in Dropbox/Sync-Ordnern (siehe **2.4**).

### 2.2 Build-Reihenfolge

| Schritt | Ordner | Befehl | Zweck |
|--------|--------|--------|--------|
| 1 | **`backend\`** | `npm install` | API-Abhängigkeiten; **`postinstall`** → `prisma:generate-all` |
| 2 | **`Notenauswertung-App\`** | `npm install` | Frontend-Abhängigkeiten |
| 3 | **`Notenauswertung-App\`** | `npm run build` | Erzeugt **`dist\`** |
| 4 | **`desktop\`** | `npm install` | Electron + electron-builder |
| 5 | **`desktop\`** | `npm run dist` | Packt alles (siehe **2.3**) |

**Schema-Änderungen:** immer **beide** Prisma-Schemas pflegen — `backend/prisma/schema.prisma` (PostgreSQL) **und** `backend/prisma/sqlite/schema.prisma` (SQLite). Details: `docs/ADR-002-prisma-postgres-sqlite.md`.

**Kurz als Batch** (Pfade anpassen):

```bat
cd /d "E:\Pfad\zum\PhiX"

cd backend
npm install
cd ..

cd Notenauswertung-App
npm install
npm run build
cd ..

cd desktop
npm install
npm run dist
```

### 2.3 Was passiert beim Packen? (`npm run dist`)

```text
npm run dist
  →  npm run build-icon
  →  npm run prepare-pack
  →  npm run stage-backend
  →  npm run check-backend
  →  electron-builder --win zip portable
```

**Ausgabe:** alles unter **`desktop\dist-pack\`** (ZIP und portable `.exe`).

**Kurzablauf zur Laufzeit** (siehe `desktop/main.cjs`):

1. **Release:** User-Data und SQLite unter **`<Installationsordner>\data\`**. **Dev (`npm run dev`):** `%APPDATA%\PhiX`.
2. Backend startet mit **`ELECTRON_RUN_AS_NODE`** und `server.js`, Arbeitsverzeichnis = `resources\backend`.
3. Ohne `DATABASE_URL` → **`file:…/phix.db`** (SQLite). Ordner muss beschreibbar sein.
4. Fenster lädt **`http://127.0.0.1:3000`** (oder Vite im Dev-Modus).

### 2.4 Befehle zum Packen / Fehlerbehebung

**Dropbox / EBUSY:** `desktop\install-deps.bat` oder `npm run install-deps` im Ordner `desktop\`.

**Sauberer Neustart:** `clean-build.bat` im Projektroot, danach komplette Reihenfolge aus **2.2**.

**Logs:** `<Installationsordner>\data\logs\` (Release) bzw. `%APPDATA%\PhiX\logs\` (Dev).

**Prüfen:** `cd desktop` → `npm run verify-pack`.

**Linux/macOS:** Strukturtest mit `npm run dist:dir` (kein vollständiges Windows-Release).

### 2.5 Testweise als Benutzer

1. ZIP aus **`desktop\dist-pack\`** entpacken **oder** die portable **`.exe`** starten.
2. App-Fenster öffnet sich; SQLite unter **`<Installationsordner>\data\phix.db`**.
3. **USB:** gesamten App-Ordner inkl. `data\` kopieren.

### 2.6 Entwicklung statt Installer-Paket

Drei Terminals: `backend` → `npm run dev`; `Notenauswertung-App` → `npm run dev`; `desktop` → `npm run dev` — siehe `desktop/README.md`.

---

## Erster Login (Kurzreferenz)

| Szenario | Vorgehen |
|----------|----------|
| Docker Compose / frische DB | Benutzer `admin` wird automatisch angelegt; auf der Anmeldeseite **„Erstes Passwort festlegen“** |
| Electron Desktop (leere DB) | wie oben |
| Weitere Benutzer | Admin legt nur den **Benutzernamen** an; Passwort setzt jeder Nutzer selbst beim ersten Login |

Passwörter anderer Benutzer können weder in der App noch per npm gesetzt werden (Datenschutz). Eigenes Passwort später ändern: **Benutzerverwaltung** in der App.

---

## Weiterführende Dokumentation

| Thema | Datei |
|-------|--------|
| Windows-Übersicht | `WINDOWS.md` |
| Build-Varianten & Artefakte | `docs/BUILD_VERSIONEN.md` |
| Manuelle Smoke-Checkliste | `docs/SMOKE_WEB_BASELINE.md` |
| SQLite-Pfad, Backup | `docs/SQLITE_DESKTOP.md` |
| Optional Postgres → SQLite | `docs/SQLITE_IMPORT.md` |
| Electron Desktop | `desktop/README.md` |
| Compose-Ports (Vorlage) | `.env.example` |

---

*Diese Datei beschreibt den intendierten Ablauf laut Repository.*
