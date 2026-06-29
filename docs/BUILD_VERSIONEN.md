# PhiX – Build-Varianten und Artefakte

**Pflege:** Diese Datei bei Änderungen an Build-Skripten, Ausgabeorten, Zielplattformen oder Artefakt-Typen mit aktualisieren.

| Stand | Wert |
|-------|------|
| Zuletzt abgestimmt mit Repo | `desktop/package.json`, `docker-compose.yml`, `backend/createApp.js` |
| Letzte inhaltliche Aktualisierung | 2026-06-28 |

---

## Kurzüberblick: zwei Produktvarianten

PhiX wird **nur** in diesen beiden Formen verteilt:

| Variante | Build-Befehl | Haupt-Artefakt | Datenbank |
|----------|--------------|----------------|-----------|
| **Docker Compose** | `docker compose up -d --build` | Container-Images, Browser :1990 | PostgreSQL (Volume `phix_pgdata`) |
| **Electron Desktop** | `cd desktop && npm run dist` | `desktop/dist-pack/` (ZIP + Portable-EXE) | SQLite `<Installationsordner>/data/phix.db` |

**Nicht vorgesehen:** eigenständiger Web-App-Betrieb (gebautes Frontend + `npm start` im Backend ohne Docker). Das Frontend wird intern nur für das **Docker-Image** (nginx) und das **Electron-Paket** gebaut (`Notenauswertung-App/npm run build`).

**Electron:** `npm run dist` erzeugt **ZIP** und **Portable-EXE** (electron-builder-Target `portable`) — dieselbe App, unterschiedlich verpackt.

---

## Vergleichstabelle

| Kriterium | **Docker Compose** | **Electron (ZIP + Portable-EXE)** |
|-----------|-------------------|-----------------------------------|
| **Oberfläche** | System-Browser | Eigenes Fenster (Electron) |
| **URL / UI** | `http://localhost:1990` (Standard) | Release: lokales Backend :3000; Dev: Vite :5173 im Electron-Fenster |
| **Datenbank** | PostgreSQL im Docker-Volume | SQLite `data/phix.db` neben `PhiX.exe` |
| **Datenpfad** | Docker-Volume (nicht im Projektordner) | Installationsordner `data/` (USB-tauglich) |
| **Backend** | Container | Child-Prozess (Electron als Node) |
| **Frontend** | Container (nginx) | `resources/frontend-dist/` im Paket |
| **Frontend-Auslieferung (Backend)** | nein (nginx) | ja, `PHIX_STANDALONE=1` (nur Electron) |
| **Build-Rechner** | Windows, Linux, macOS (Docker) | **Windows** empfohlen für Release |
| **Prisma / Schema** | `prisma migrate deploy` (Postgres) | SQLite, `db push` vor Start in Electron |
| **Zielgruppe** | Schulserver, mehrere Clients | Einzelplatz, USB, ohne Docker |

---

## Datenpfade (Schüler, Noten, Benutzer, …)

| Variante | DB-Typ | Speicherort (Standard) |
|----------|--------|-------------------------|
| **Docker Compose** | PostgreSQL | Docker-Volume `phix_pgdata` |
| **Electron (Release)** | SQLite | `<Ordner von PhiX.exe>/data/phix.db` |
| **Electron (Release)** | UI-Zustand (localStorage) | ebenfalls unter `data/` (Electron `userData`) |
| **Electron `npm run dev`** | SQLite | `%APPDATA%\PhiX\phix.db` (Windows) |
| **Override** | — | Umgebungsvariable `PHI_X_USERDATA_DIR` |

**USB / portable:** Electron-ZIP oder -Ordner **komplett kopieren** (inkl. Unterordner `data/`). Ordner muss **beschreibbar** sein.

---

## Electron: ZIP vs. Portable-EXE

| | **ZIP** | **Portable .exe** |
|--|---------|-------------------|
| App-Inhalt | identisch | identisch |
| Verteilung | Ordner in ZIP | eine EXE |
| Nutzeraktion | entpacken → `PhiX.exe` | EXE starten |

Konfiguration: `desktop/package.json` → `build.win.target`: `zip`, `portable`.  
Befehl: `electron-builder --config electron-builder.config.cjs --win zip portable`.

---

## Build-Befehle (Referenz)

### Docker Compose

```bash
# Projektroot: .env aus .env.example anlegen
docker compose up -d --build
```

Browser: **http://localhost:1990** (oder `FRONTEND_PORT` aus `.env`).

Unter Windows: `start_docker.bat` / `stop_docker.bat`.

Services: `frontend` (nginx), `backend` (API), `db` (PostgreSQL 15) — siehe `docker-compose.yml`.

### Electron (`npm run dist`)

```text
npm run dist
  → npm run build-icon
  → npm run prepare-pack      (inkl. Notenauswertung-App/npm run build)
  → npm run stage-backend
  → npm run check-backend
  → electron-builder --config electron-builder.config.cjs --win zip portable
```

| Befehl | Zweck |
|--------|--------|
| `npm run dist` | Windows-ZIP + Portable-EXE unter `desktop/dist-pack/` |
| `npm run dist:dir` | Entpackte App (Strukturtest; auch Linux/macOS) |
| `npm run verify-pack` | Prisma/Backend im Paket prüfen |

Voraussetzungen: `docs/INSTALL_SERVER_UND_DESKTOP_WINDOWS.md` (Teil 2), `desktop/README.md`.

**Hinweis:** Auf Linux/macOS erzeugt `npm run dist` **keine** zuverlässigen Windows-Installer-Ziele; für Strukturtests `dist:dir`. Ein **Linux-Desktop-Paket** ist derzeit **nicht** vorkonfiguriert.

---

## Entwicklung (keine Release-ZIP)

| Szenario | Start |
|----------|--------|
| Docker (Server) | `docker compose up -d --build` → Browser :1990 |
| Electron-Dev | `Notenauswertung-App`: `npm run dev`; `desktop`: `npm run dev` (Backend startet Electron) |

`npm run dev` im Frontend allein (Browser auf Port 5173 **ohne** Electron) ist **kein** unterstützter Produktweg.

---

## Verwandte Dokumentation

| Thema | Datei |
|-------|--------|
| Dokumentations-Übersicht | `docs/README.md` |
| Installation Windows (Schritt-für-Schritt) | `docs/INSTALL_SERVER_UND_DESKTOP_WINDOWS.md` |
| Electron Desktop | `desktop/README.md` |
| SQLite Desktop-Pfad / Backup | `docs/SQLITE_DESKTOP.md` |
| Smoke-Tests | `docs/SMOKE_WEB_BASELINE.md` |
| Windows-Übersicht | `WINDOWS.md` |

---

*Bei Abweichungen im Fork gelten die genannten Skripte und `package.json`-Einträge.*
