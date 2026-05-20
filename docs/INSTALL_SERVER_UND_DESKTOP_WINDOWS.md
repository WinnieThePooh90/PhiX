# PhiX unter Windows: Docker-Server und Standalone-Pakete

Diese Anleitung ist **eigenständig** gedacht: Sie beschreibt, wie Sie

1. die **Server-Variante mit Docker Compose** installieren und starten, und  
2. eine **Standalone-Windows-Version** erzeugen und **testweise wie ein Endbenutzer** ausprobieren.

Technische Hintergründe und Alternativen (nativ, SQLite, Roadmap): `WINDOWS.md`, `ROADMAP_SERVER_DESKTOP_SQLITE.md`.

---

## Inhalt

- [Teil 1: Server mit Docker Compose](#teil-1-server-mit-docker-compose)
- [Teil 2: Standalone unter Windows](#teil-2-standalone-unter-windows)
  - [Variante A: Portable-Release (ZIP / optional Setup.exe)](#variante-a-portable-release-zip--optional-setupexe)
  - [Variante B: Electron-Desktop-App](#variante-b-electron-desktop-app)
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

### 1.6 Optional: `install_windows.bat`

**Nur für native Entwicklung** (Node + Vite ohne vollständigen Docker-Stack) relevant. Für den **reinen Docker-Betrieb** ist dieses Skript **nicht** nötig. Wenn Sie es trotzdem ausführen: Es installiert u. a. npm-Abhängigkeiten für `backend/` und `Notenauswertung-App/`.

### 1.7 Stoppen

Eine der folgenden Optionen:

- **`stop_docker.bat`** im Projektroot, oder  
- In der Web-App: Menü **„Herunterfahren“** (das Backend im Container kann dabei `docker compose down` auslösen — Details `WINDOWS.md`), oder  
- Manuell im Projektroot: `docker compose down`

**Hinweis:** Im `docker-compose.yml` hat der **Backend**-Service `restart: "no"`, damit nach einem kontrollierten Herunterfahren nicht sofort ein neuer Container hochfährt. Datenbank und Frontend können weiter `unless-stopped` nutzen — bei Bedarf separat stoppen (`docker compose stop` / Docker Desktop).

### 1.8 Fehlerbehebung (kurz)

| Problem | Vorgehen |
|---------|----------|
| Port **5432** belegt | `.env`: `DB_PORT` ändern; alte `phix`-Container oder lokale Postgres stoppen. |
| `docker` nicht gefunden | Docker Desktop installieren und PATH prüfen; neues Terminal öffnen. |
| Seite lädt, API-Fehler | `docker compose logs backend` im Projektroot prüfen; `BACKEND_PORT` und Firewall beachten. |

---

## Teil 2: Standalone unter Windows

„Standalone“ meint hier: **Kein separates Installieren von Node.js, Docker oder PostgreSQL durch den Endbenutzer** — abhängig von der gewählten Variante.

Es gibt **zwei** im Repository vorgesehene Wege:

| Variante | Typisch für | Oberfläche nach Start | Datenbank (Standard) |
|----------|-------------|------------------------|----------------------|
| **A: Portable-Release** | Endanwender, eine ZIP/eine Setup-Datei | **Browser** → `http://127.0.0.1:3000` | **PostgreSQL** (portable, im Paket) |
| **B: Electron-Desktop** | App-Fenster („Desktop-Hülle“) | **Eigenes Fenster** (lädt die Web-UI) | oft **SQLite** unter `%APPDATA%\PhiX\phix.db` ohne `DATABASE_URL` |

---

### Variante A: Portable-Release (ZIP / optional Setup.exe)

**Ziel:** Ein Testbenutzer entpackt eine ZIP oder installiert eine EXE und startet **PhiX.cmd** bzw. die Verknüpfung — ohne vorher Node oder Postgres zu installieren.

**Ausführliche Release-Doku:** `installer/RELEASE.md`  
**Kurzüberblick Windows:** `WINDOWS.md` (Abschnitt „Eine Datei zum Herunterladen“)

#### A.1 Release auf dem Build-Rechner erstellen (Windows)

1. Repository auf einen **Windows-64-Bit**-Rechner mit **Internetzugang** kopieren.
2. Im **Projektroot** die Datei **`Build-Release.bat`** ausführen.

Wichtige Hinweise aus der Projektdoku:

- Es wird **kein Python** benötigt (PowerShell und Internet reichen).
- Der Build nutzt **`%TEMP%`** als Arbeitsbereich, damit Entpackvorgänge nicht an **Dropbox-Sperren** im Projektordner scheitern.
- **Node.js auf dem Build-PC ist nicht zwingend nötig** — das Skript lädt eine Node-Runtime zum Bauen herunter (siehe `installer/RELEASE.md`).

**Ergebnis (typisch):** Ordner **`release\`** mit **`PhiX-Windows-x64.zip`**.

**Build unter Linux/macOS:** siehe `installer/build-windows-release.sh` in `installer/RELEASE.md`.

#### A.2 Optional: Inno-Setup-Installer (`PhiX-Setup.exe`)

1. Zuerst wie in A.1 die ZIP bauen.
2. [Inno Setup](https://jrsoftware.org/isinfo.php) installieren.
3. Im Projekt die Datei **`installer\PhiX-Portable.iss`** öffnen und **kompilieren**.
4. Ergebnis typischerweise unter **`installer\output\`** (z. B. `PhiX-Setup.exe` — genaue Namen je nach `.iss`).

#### A.3 Testweise als Endbenutzer: ZIP

1. **`PhiX-Windows-x64.zip`** auf einen **Test-PC** kopieren (zweites Benutzerkonto, VM oder Kollegenrechner simuliert „fremde“ Umgebung gut).
2. ZIP **entpacken**. Im Archiv liegt der Stammordner typischerweise **`PhiX-Windows-x64`** (siehe `installer/RELEASE.md`).
3. **`PhiX.cmd`** per Doppelklick starten.
4. Der Browser sollte **`http://127.0.0.1:3000`** öffnen — falls nicht, diese Adresse manuell aufrufen.
5. **Erster Start:** kann **1–2 Minuten** dauern (Datenbank-Initialisierung und Schema).
6. **Datenablage:** laut Release-Doku im Installations- bzw. Entpackordner unter **`data\postgres`**.

#### A.4 Testweise als Endbenutzer: Setup.exe

1. **`PhiX-Setup.exe`** auf dem Test-PC ausführen und den Assistenten durchklicken.
2. Desktop-Verknüpfung **PhiX** starten (wie in der Projektdoku beschrieben).
3. Browser und Login wie bei A.3 prüfen.

#### A.5 Ports und Einschränkungen (Variante A)

- **Windows 64-bit** vorausgesetzt.
- Host-Port **3000** sollte für den HTTP-Server frei sein; intern nutzt das Paket u. a. **5432** für Postgres (siehe `installer/RELEASE.md`).
- **Login** bei leerer Datenbank: **`admin`** / **`admin`** (sofern Sie nichts anderes bootstrapen).

---

### Variante B: Electron-Desktop-App

**Ziel:** Eine **Desktop-Anwendung** (Electron), die das **Node-Backend** startet und die Web-Oberfläche im **Programmfenster** zeigt — sinnvoll für „echte“ Desktop-Nutzung und SQLite im Benutzerprofil.

**Doku:** `desktop/README.md`, SQLite: `docs/SQLITE_DESKTOP.md`

#### B.1 Voraussetzungen zum Bauen

- **Windows** (laut `desktop/README.md` baut **`npm run dist`** die Windows-Ziele zuverlässig unter Windows).
- **Node.js** (LTS, z. B. 20+) im PATH.
- Im Ordner **`backend/`** mindestens einmal **`npm install`** ausgeführt (Postinstall generiert u. a. Postgres- und SQLite-Prisma-Clients).

#### B.2 Packen

In der Eingabeaufforderung:

```bat
cd desktop
npm install
npm run dist
```

**Artefakte:** typischerweise unter **`desktop\dist-pack\`** (laut `desktop/package.json` u. a. **ZIP** und **portable .exe**; Dateinamen enthalten u. a. `PhiX-Desktop` und Version).

**Hinweis:** Auf **Linux/macOS** können Sie für Layout-Tests **`npm run dist:dir`** nutzen; vollständige Windows-Installer-Ziele sind dort nicht das Hauptziel.

#### B.3 Testweise als Benutzer

1. ZIP entpacken oder die portable **`.exe`** starten.
2. App-Fenster öffnet sich; Backend startet mit.
3. **SQLite:** Wenn **keine** `DATABASE_URL` gesetzt ist, legt Electron typischerweise **`phix.db`** unter **`%APPDATA%\PhiX`** an (als `file:`-URL). Details und Backup: `docs/SQLITE_DESKTOP.md`.
4. **Hinweis zum gepackten Backend:** `electron-builder` kopiert **`backend/`** ohne **`.env`**-Dateien. Postgres-Betrieb im Paket erfordert daher eine **eigene** Konfiguration der `DATABASE_URL` für Ihre Verteilung; für den üblichen **SQLite-Desktop-Fall** ist das oft nicht nötig.

#### B.4 Entwicklung statt Installer-Paket

Wenn Sie nur **lokal testen** wollen (zwei Terminals): Frontend `npm run dev` in `Notenauswertung-App/`, danach `npm run dev` in `desktop/` — siehe `desktop/README.md`.

---

## Erster Login (Kurzreferenz)

| Szenario | Typischer Benutzer | Typisches Passwort |
|----------|--------------------|--------------------|
| Docker Compose / frische DB | `admin` | `admin` |
| Portable ZIP / Setup (leere DB) | `admin` | `admin` |
| Eigenes Admin-Passwort beim ersten Start | `admin` | Über Umgebungsvariable **`BOOTSTRAP_ADMIN_PASSWORD`** (siehe Kommentar in `docker-compose.yml` beim Service `backend` bzw. Backend-`.env` bei nativer Installation) |

Passwort später ändern (nativ, mit installiertem Node im `backend/`-Ordner):  
`npm run set-admin-password -- admin IhrNeuesPasswort`  
(siehe `WINDOWS.md`).

---

## Weiterführende Dokumentation

| Thema | Datei |
|-------|--------|
| Windows-Übersicht, Skripte, native Varianten | `WINDOWS.md` |
| Manuelle Smoke-Checkliste (Web) | `docs/SMOKE_WEB_BASELINE.md` |
| SQLite-Pfad, Backup | `docs/SQLITE_DESKTOP.md` |
| Optional Postgres → SQLite (Konzept) | `docs/SQLITE_IMPORT.md` |
| Portable-Release im Detail | `installer/RELEASE.md` |
| Windows-Installer (Node auf dem Zielrechner) | `installer/README.md` |
| Electron Desktop | `desktop/README.md` |
| Compose-Ports (Vorlage) | `.env.example` |

---

*Diese Datei beschreibt den intendierten Ablauf laut Repository. Bei Abweichungen in Ihrem Fork gelten die genannten Quelldateien und Skripte.*
