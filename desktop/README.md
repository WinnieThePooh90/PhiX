# PhiX Desktop (Electron)

Siehe **ADR:** `docs/ADR-001-desktop-electron.md`.

## Benutzerdaten (mutable Daten)

Electron setzt `userData` auf:

| Plattform | Ordner |
|-----------|--------|
| Windows | `%APPDATA%\PhiX` (z. B. `C:\Users\<Benutzer>\AppData\Roaming\PhiX`) |
| Linux | `~/.config/PhiX` (bzw. `XDG_CONFIG_HOME`) |
| macOS | `~/Library/Application Support/PhiX` |

Die Umgebungsvariable **`PHI_X_USERDATA_DIR`** wird beim Start des Backends gesetzt (u. a. SQLite-Datei `phix.db`, wenn keine `DATABASE_URL` gesetzt ist).  
**Keine** schreibbaren App-Daten unter „Program Files“ — Konfiguration/DB gehören in diesen Ordner.

## Voraussetzungen

- **Node.js** (wie für das Backend) — im PATH, außer Sie binden eine portable `node`-Runtime ein (siehe unten).
- Backend-Abhängigkeiten: im Ordner `backend/` einmal `npm install` (führt `postinstall` → beide Prisma-Clients aus).
- Datenbank: **PostgreSQL** mit `DATABASE_URL=postgresql://…`, oder **SQLite** (Electron setzt bei fehlender URL automatisch `file:…/phix.db` — siehe `docs/SQLITE_DESKTOP.md`).

## Einmalig

```bash
cd desktop
npm install
```

## Entwicklung (Vite + Electron)

Zwei Terminals:

1. **Frontend (Vite)** — Proxy leitet `/api` an Port 3000 weiter:

   ```bash
   cd Notenauswertung-App
   npm run dev
   ```

2. **Desktop** — startet das Backend und öffnet `http://127.0.0.1:5173`:

   ```bash
   cd desktop
   npm run dev
   ```

`npm run dev` setzt `ELECTRON_DEV_SERVER=http://127.0.0.1:5173`. Bei anderem Vite-Port anpassen:

```bash
cross-env ELECTRON_DEV_SERVER=http://127.0.0.1:5174 electron .
```

## Nur Electron (ohne Vite)

Wenn das Backend **statisches Frontend** ausliefert (`PHIX_STANDALONE=1` + `PHIX_FRONTEND_DIST` / gebautes `dist`):

```bash
cd desktop
npm start
```

Das Fenster lädt dann `http://127.0.0.1:3000` (oder `PORT`).

## Datenbank: PostgreSQL vs. SQLite

- **PostgreSQL** (Standard Server/Docker): `DATABASE_URL=postgresql://…` in `backend/.env`.
- **SQLite** (Desktop ohne URL oder manuell): siehe **`docs/SQLITE_DESKTOP.md`**. Electron setzt bei fehlender `DATABASE_URL` automatisch **`file:`** auf `phix.db` im PhiX-UserData-Ordner.

## Packaging (Windows-Artefakte)

Vor dem Packen:

1. `cd backend && npm install && npx prisma generate`
2. Optional: gebautes Frontend in `Notenauswertung-App/dist` und `PHIX_STANDALONE=1` testen (siehe Portable-Doku).
3. `cd desktop && npm run dist`

Ergebnis liegt unter **`desktop/dist-pack/`** (u. a. **ZIP** und **portable .exe**).

- **`npm run dist`** baut **nur unter Windows** zuverlässig die Win-Targets (`--win zip portable`). Auf Linux/macOS zum Testen des Layouts: `npm run dist:dir` (entpackte App unter `dist-pack/`).

### `.env` im gepackten Backend

`electron-builder` kopiert **`backend/`** ohne `.env`-Dateien (Filter). Für eine **verteilbare** Desktop-Version müssen Endnutzer oder Ihr Installer eine `DATABASE_URL` setzen — z. B. durch Kopieren von `backend/.env.example` nach `%APPDATA%\PhiX\backend.env` (noch nicht automatisch geladen; Roadmap Phase C mit SQLite vereinfacht das).

### Optionale portable Node-Runtime

Legt beim Packen zusätzlich unter **`resources/node/`** die gleiche Struktur wie im PhiX-Portable-Release ab (Windows: `node.exe`), erkennt `main.cjs` diese automatisch und startet das Backend damit statt mit globalem `node`.

## Hinweise

- Beim Schließen des Fensters wird der Backend-Prozess beendet.
- Ports: Backend standard **3000**, Vite standard **5173** — bei Konflikten `PORT` setzen.
