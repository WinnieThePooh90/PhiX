# SQLite (Desktop)

## Wo liegt die Datei?

| Kontext | Standard |
|---------|----------|
| **Electron** (`desktop/main.cjs`) | Wenn `DATABASE_URL` nicht gesetzt: `%APPDATA%\PhiX\phix.db` (Windows) bzw. entsprechend `app.getPath('appData')/PhiX` — als `file:`-URL |
| **Manuell / Entwicklung** | In `backend/.env`, z. B. `DATABASE_URL="file:./phix-dev.sqlite"` (relativ zum `backend/`-Arbeitsverzeichnis) |

Schema und Client: `prisma/sqlite/schema.prisma` → generiert nach `generated/prisma-sqlite/`.

## Backup & Rollback

- **Backup:** App beenden, Datei `phix.db` (bzw. Ihre `*.sqlite`) kopieren — z. B. `phix-backup-20260520.db`.
- **Rollback:** App beenden, fehlerhafte DB ersetzen oder Backup-Datei zurückspielen.
- Vor **App-Updates** (wenn sich das Schema ändert): immer ein Backup anlegen; `prisma db push` kann bei SQLite Schema-Anpassungen erzwingen (wie bei der Entwicklung üblich).

## Postgres vs. SQLite

- **Server / Docker / Portable mit Postgres:** weiter `DATABASE_URL=postgresql://…`.
- **Desktop ohne eigene URL:** SQLite unter UserData (siehe oben).

## Generieren beider Clients

Im Ordner `backend/`:

```bash
node scripts/prisma-generate-all.js
```

(läuft automatisch als `npm install` → `postinstall`.)

## Optional: Daten von Postgres übernehmen

Siehe **`docs/SQLITE_IMPORT.md`** (Rahmen, kein automatischer Ein-Klick-Import).
