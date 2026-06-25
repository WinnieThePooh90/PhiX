# SQLite (Desktop)

## Wo liegt die Datei?

| Kontext | Standard |
|---------|----------|
| **Electron Release** (ZIP / Portable, gepackt) | Wenn `DATABASE_URL` nicht gesetzt: `<Ordner von PhiX.exe>/data/phix.db` (portabel mit dem App-Ordner, z. B. USB) |
| **Electron Entwicklung** (`npm run dev`) | `%APPDATA%\PhiX\phix.db` (Windows) |
| **Manuell / Backend-Dev** | In `backend/.env`, z. B. `DATABASE_URL="file:./phix-dev.sqlite"` (relativ zum `backend/`-Arbeitsverzeichnis) |

URL-Format unter Windows: `file:C:/…/phix.db` via `backend/lib/sqlite-database-url.js`. Override: `PHI_X_USERDATA_DIR`.

Schema und Client: `prisma/sqlite/schema.prisma` → generiert nach `generated/prisma-sqlite/`.

## Backup & Rollback

- **Backup:** App beenden, Datei `phix.db` (bzw. Ihre `*.sqlite`) kopieren — z. B. `phix-backup-20260520.db`.
- **Rollback:** App beenden, fehlerhafte DB ersetzen oder Backup-Datei zurückspielen.
- Vor **App-Updates** (wenn sich das Schema ändert): immer ein Backup anlegen; `prisma db push` kann bei SQLite Schema-Anpassungen erzwingen (wie bei der Entwicklung üblich).

## Postgres vs. SQLite

- **Server / Docker:** `DATABASE_URL=postgresql://…`.
- **Desktop Release ohne eigene URL:** SQLite im Installationsordner `data/phix.db` (siehe oben).
- **Desktop Dev:** SQLite unter `%APPDATA%\PhiX\` (siehe oben).

## Generieren beider Clients

Im Ordner `backend/`:

```bash
node scripts/prisma-generate-all.js
```

(läuft automatisch als `npm install` → `postinstall`.)

## Optional: Daten von Postgres übernehmen

Siehe **`docs/SQLITE_IMPORT.md`** (Rahmen, kein automatischer Ein-Klick-Import).
