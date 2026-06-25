# PhiX Desktop (Electron)

Siehe **ADR:** `docs/ADR-001-desktop-electron.md`.

## Benutzerdaten (mutable Daten)

| Kontext | Ordner (Windows) |
|---------|------------------|
| **Gepackte App** (ZIP / Portable nach `npm run dist`) | `<Ordner von PhiX.exe>\data\` — darin `phix.db`, `logs/`, Electron-Profil (localStorage) |
| **Entwicklung** (`npm run dev`) | `%APPDATA%\PhiX` |
| **Override** | Umgebungsvariable **`PHI_X_USERDATA_DIR`** |

Die SQLite-Datei liegt bei Release unter **`data\phix.db`** (ohne eigene `DATABASE_URL`). **USB:** gesamten entpackten App-Ordner kopieren (inkl. `data\`). Ordner muss beschreibbar sein (nicht unter schreibgeschütztem `Program Files`).

Ältere Releases nutzten `%APPDATA%\PhiX\phix.db` — keine automatische Migration; siehe `docs/SQLITE_DESKTOP.md` und `docs/BUILD_VERSIONEN.md`.

## Voraussetzungen

- **Node.js** (wie für das Backend) — im PATH; gepackte App nutzt **Electron als Node** (`ELECTRON_RUN_AS_NODE`).
- Backend-Abhängigkeiten: im Ordner `backend/` einmal `npm install` (führt `postinstall` → beide Prisma-Clients aus).
- Datenbank: **PostgreSQL** mit `DATABASE_URL=postgresql://…`, oder **SQLite** (Electron setzt bei fehlender URL automatisch `file:…/phix.db` — siehe `docs/SQLITE_DESKTOP.md`).

## Einmalig

**Projektordner liegt in Dropbox (oder anderer Sync-Software)?** Dann können bei `npm install` **EBUSY**-Meldungen und `cleanup Failed to remove` vorkommen (Electron entpackt große Binaries unter `node_modules`). Empfohlen:

- **`install-deps.bat`** im Ordner `desktop/` per Doppelklick oder in der **Eingabeaufforderung (cmd)** ausführen — legt `ELECTRON_CACHE` und `npm`-Cache unter **`%LOCALAPPDATA%\PhiX\`** ab (außerhalb von Dropbox), danach `npm install`.
- Oder plattformübergreifend: `cd desktop` und **`npm run install-deps`** (nutzt `scripts/install-deps.js` mit demselben Prinzip).

Sonst / zusätzlich: Dropbox-Sync für den Projektordner **kurz pausieren**, dann `npm install` erneut.

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

1. `cd backend && npm install`
2. `cd Notenauswertung-App && npm run build` (oder von `npm run dist` automatisch)
3. `cd desktop && npm run dist`

Ergebnis liegt unter **`desktop/dist-pack/`** (u. a. **ZIP** und **portable .exe**).

- **`npm run dist`** baut **nur unter Windows** zuverlässig die Win-Targets (`--win zip portable`). Auf Linux/macOS zum Testen des Layouts: `npm run dist:dir` (entpackte App unter `dist-pack/`).

### `.env` im gepackten Backend

`electron-builder` kopiert **`backend/`** ohne `.env`-Dateien. Ohne `DATABASE_URL` setzt Electron automatisch SQLite (`phix.db` im Datenordner) — siehe `docs/SQLITE_DESKTOP.md`.

## Hinweise

- Beim Schließen des Fensters wird der Backend-Prozess beendet.
- **Gepackte App:** Backend startet über **`ELECTRON_RUN_AS_NODE`** (kein separates `node.exe` nötig). Logs: **`<Installationsordner>\data\logs\`**. Bei Startfehlern erscheint ein **Fehlerdialog** mit Hinweis auf die Log-Datei.
- Ports: Backend standard **3000**, Vite standard **5173** — bei Konflikten `PORT` setzen.

## Abhängigkeiten & Sicherheit

Stand im Repo: **Electron 42**, **electron-builder 26**, **`overrides`** für **`tar`**, **`rimraf`**, **`glob`** (aktuellere transitive Versionen, weniger Deprecation-Warnungen). Nach `npm install` sollte **`npm audit`** **0 vulnerabilities** melden.

**`npm audit fix --force`** ist nicht nötig, solange `package-lock.json` zum Projektstand passt. Nach einem Pull: `cd desktop` und `npm install` (bei Dropbox: `install-deps.bat`).
