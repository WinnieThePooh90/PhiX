# PhiX – Build-Varianten und Artefakte (Windows)

**Pflege:** Diese Datei bei Änderungen an Build-Skripten, Ausgabeorten, Zielplattformen oder Artefakt-Typen mit aktualisieren. Quellen im Repo sind maßgeblich (siehe Verweise unten).

| Stand | Wert |
|-------|------|
| Zuletzt abgestimmt mit Repo | Build-Doku, `desktop/package.json`, `installer/RELEASE.md` |
| Letzte inhaltliche Aktualisierung | 2026-05-28 |

---

## Kurzüberblick: drei Windows-Builds

| # | Build-Befehl | Haupt-Artefakt | Variante (siehe `docs/INSTALL_SERVER_UND_DESKTOP_WINDOWS.md`) |
|---|--------------|----------------|----------------------------------------------------------------|
| **1** | `Build-Release.bat` (Projektroot) | `release/PhiX-Windows-x64.zip` | **A – Portable-Release** |
| **2** | `cd desktop` → `npm run dist` | `desktop/dist-pack/PhiX-Desktop-<version>-win-x64.zip` | **B – Electron** |
| **3** | dasselbe `npm run dist` | `desktop/dist-pack/PhiX-Desktop-<version>-win-x64.exe` (portable) | **B – Electron** |

**2 und 3** = dieselbe Electron-App, nur unterschiedlich verpackt.  
**1** = anderes Produkt (kein Electron, PostgreSQL portable, Start über `PhiX.cmd`).

Zusätzlich (nicht automatisch mit `Build-Release.bat`): **PhiX-Setup.exe** via Inno Setup (`installer/PhiX-Portable.iss`) — Installer um dieselbe Struktur wie **1**.

---

## Vergleichstabelle

| Kriterium | **1 – Build-Release** | **2 – Electron ZIP** | **3 – Electron Portable** |
|-----------|----------------------|----------------------|---------------------------|
| **Was ist das?** | Ordner-ZIP mit Node + PostgreSQL + Backend + Frontend | ZIP mit entpackter Electron-App | Eine Portable-`.exe` (electron-builder) |
| **Ausgabeort** | `release/PhiX-Windows-x64.zip` | `desktop/dist-pack/` | `desktop/dist-pack/` |
| **Stammordner nach Entpacken** | `PhiX-Windows-x64/` | z. B. Inhalt der ZIP / `win-unpacked`-Struktur | keine Entpackung nötig |
| **Start für Nutzer** | `PhiX.cmd` → `Start-PhiX.ps1` | `PhiX.exe` im entpackten Ordner | Doppelklick auf die Portable-`.exe` |
| **Oberfläche** | **System-Browser** | **Eigenes Fenster** (Electron) | wie ZIP |
| **URL / UI** | `http://127.0.0.1:3000` im Browser | Fenster lädt Web-UI vom Backend | wie ZIP |
| **Datenbank (Standard)** | **PostgreSQL** (portable im Paket) | **SQLite** `<Installationsordner>/data/phix.db` | wie ZIP |
| **Datenpfad** | Installationsordner: `data/postgres/` | Installationsordner: `data/` (DB + Electron-Profil) | wie ZIP |
| **Backend-Prozess** | eingebettetes `node.exe` + `server.js` | Child: Electron als Node oder gebündeltes `node` | wie ZIP |
| **Frontend** | `app/frontend-dist/` | `resources/frontend-dist/` | wie ZIP |
| **Größe (ca.)** | ~250–350 MB | kleiner (kein Postgres-Bundle) | ähnlich ZIP, eine Datei |
| **Build-Rechner** | Windows (`Build-Release.bat`) oder Linux/macOS (`installer/build-windows-release.sh`) | **Windows** empfohlen | wie ZIP |
| **Build-Kette** | Runtimes laden → App bauen → Starter kopieren → ZIP | siehe Abschnitt „Electron-Build“ | derselbe Lauf wie ZIP |
| **Prisma / Schema** | `prisma generate` + `db push` gegen **Postgres** beim Start | SQLite, `db push` vor Start in Electron | wie ZIP |
| **Konsole sichtbar** | ja (PowerShell, Strg+C) | typisch nur Electron-Fenster | wie ZIP |
| **Logs** | `logs/` im Installationsordner | `<Installationsordner>/data/logs/` | wie ZIP |
| **Ports (Standard)** | HTTP 3000, Postgres 5432 (intern) | HTTP 3000 | wie ZIP |
| **Zielgruppe** | ZIP für Schul-PCs, volle DB ohne Docker | Desktop-Feeling, SQLite, USB-tauglich | eine Datei zum Verteilen |

---

## Datenpfade (Schüler, Noten, Benutzer, …)

| Variante | DB-Typ | Speicherort (Windows, Standard) |
|----------|--------|----------------------------------|
| **1 – Build-Release** | PostgreSQL | `<PhiX-Ordner>/data/postgres/` (Cluster; DB-Name `notenauswertung`) |
| **2 + 3 – Electron (Release)** | SQLite | `<Ordner von PhiX.exe>/data/phix.db` |
| **2 + 3 – Electron** | UI-Zustand (localStorage) | ebenfalls unter `<Ordner von PhiX.exe>/data/` (Electron `userData`) |
| **Electron `npm run dev`** | SQLite | `%APPDATA%\PhiX\phix.db` (unverändert) |
| **Docker Compose** | PostgreSQL | Docker-Volume `phix_pgdata` (nicht im Projektordner) |
| **Override** | — | Umgebungsvariable `PHI_X_USERDATA_DIR` |

**USB / portable:** Electron-ZIP oder -Ordner **komplett kopieren** (inkl. Unterordner `data/`) — dann sind DB und lokale UI-Daten auf dem anderen Rechner dabei. Ordner muss **beschreibbar** sein (nicht nur lesendes Medium / `Program Files`).

**Hinweis:** Ältere Electron-Builds legten `phix.db` unter `%APPDATA%\PhiX\` ab; nach der Umstellung bleiben diese Dateien dort (keine automatische Migration).

---

## Paketinhalt

| Komponente | **1 – Build-Release** | **2 + 3 – Electron** |
|------------|----------------------|-------------------------|
| Electron-Runtime | nein | ja |
| Node.js (eigen) | ja (`runtime/node/`) | optional / oft `ELECTRON_RUN_AS_NODE` |
| PostgreSQL | ja (`runtime/postgresql/`) | nein |
| Backend | `app/backend/` + `node_modules` | `resources/backend/` + `phix_deps` |
| Web-UI (gebaut) | `app/frontend-dist/` | `resources/frontend-dist/` |
| Starter | `PhiX.cmd`, `Start-PhiX.ps1`, `Initialize-Postgres.ps1`, `phix-config.json` | `PhiX.exe` (+ DLLs/Ressourcen) |

---

## Electron: ZIP vs. Portable (2 vs. 3)

| | **ZIP** | **Portable .exe** |
|--|---------|-------------------|
| App-Inhalt | identisch | identisch |
| Verteilung | Ordner in ZIP | eine EXE |
| Nutzeraktion | entpacken → `PhiX.exe` | EXE starten |
| Installer (Inno) | nein | nein |

Konfiguration: `desktop/package.json` → `build.win.target`: `zip`, `portable`.  
Befehl: `electron-builder --config electron-builder.config.cjs --win zip portable`.

---

## Build-Befehle (Referenz)

### Variante A – Portable-Release (`Build-Release.bat`)

| Schritt | Aktion |
|---------|--------|
| Windows | Projektroot: `Build-Release.bat` → ruft `installer/build-windows-release.ps1` auf |
| Linux/macOS | `./installer/build-windows-release.sh` |
| Ergebnis | `release/PhiX-Windows-x64.zip` |
| Optional | Inno Setup: `installer/PhiX-Portable.iss` → `installer/output/PhiX-Setup.exe` |

Details: `installer/RELEASE.md`, Starter: `portable/Start-PhiX.ps1`, `portable/PhiX.cmd`.

### Variante B – Electron (`npm run dist`)

Definiert in `desktop/package.json`:

```text
npm run dist
  → npm run build-icon
  → npm run prepare-pack      (Frontend-Build falls nötig)
  → npm run stage-backend     (Backend nach %LOCALAPPDATA%\PhiX\pack-backend, phix_deps)
  → npm run check-backend
  → electron-builder --config electron-builder.config.cjs --win zip portable
```

| Befehl | Zweck |
|--------|--------|
| `npm run dist` | Windows-ZIP + Portable-EXE unter `desktop/dist-pack/` |
| `npm run dist:dir` | Entpackte App (Strukturtest; auch Linux/macOS) |
| `npm run verify-pack` | Prisma/Backend im Paket prüfen |

Voraussetzungen und Fehlerbehebung: `docs/INSTALL_SERVER_UND_DESKTOP_WINDOWS.md` (Teil B), `desktop/README.md`.

**Hinweis:** Auf Linux/macOS erzeugt `npm run dist` **keine** zuverlässigen Windows-Installer-Ziele; für Strukturtests `dist:dir`. Ein **Linux-Desktop-Paket** ist derzeit **nicht** vorkonfiguriert.

### Manueller Test (Release, USB-Simulation)

1. `npm run dist` → ZIP aus `desktop/dist-pack/` auf beschreibbaren Pfad entpacken.
2. `PhiX.exe` starten, anmelden, Testdaten anlegen.
3. Prüfen: `data/phix.db` neben `PhiX.exe`.
4. Gesamten Ordner kopieren → an anderem Ort erneut `PhiX.exe` → gleiche Daten sichtbar.
5. `npm run dev`: Daten weiter unter `%APPDATA%\PhiX\` (getrennt vom Release).

---

## Weitere Varianten (kein separates Desktop-ZIP)

| Variante | Build / Start | Artefakt / Zugriff |
|----------|---------------|---------------------|
| **Docker-Server** | `docker compose up -d --build` (Projektroot) | Browser → `http://localhost:1990` (Frontend), Postgres im Container |
| **Entwicklung** | `backend`: `npm run dev`; `Notenauswertung-App`: `npm run dev`; optional `desktop`: `npm run dev` | lokal, keine Release-ZIP |

---

## Empfehlung nach Anforderung

| Anforderung | Build |
|-------------|--------|
| PostgreSQL, Daten im Programmordner, Browser reicht | **1** – `Build-Release.bat` |
| Desktop-Fenster, SQLite, Daten im App-Ordner (USB) | **2** oder **3** – `desktop/npm run dist` |
| Eine Datei ohne Entpacken (Electron) | **3** – Portable-EXE |
| IT: Ordner + Verknüpfung auf `PhiX.exe` | **2** – Electron-ZIP |
| Server im Netz / mehrere Clients | Docker Compose |

---

## Verwandte Dokumentation

| Thema | Datei |
|-------|--------|
| Installation Windows (Schritt-für-Schritt) | `docs/INSTALL_SERVER_UND_DESKTOP_WINDOWS.md` |
| Portable-Release Detail | `installer/RELEASE.md` |
| Electron Desktop | `desktop/README.md` |
| SQLite Desktop-Pfad / Backup | `docs/SQLITE_DESKTOP.md` |
| Windows-Übersicht | `WINDOWS.md` |

---

*Bei Abweichungen im Fork gelten die genannten Skripte und `package.json`-Einträge.*
