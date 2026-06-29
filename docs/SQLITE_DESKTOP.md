# SQLite (Desktop)

SQLite ist die Datenbank der **Electron-Desktop-Variante**. Der **Docker-Server** nutzt **PostgreSQL** — siehe [`BUILD_VERSIONEN.md`](BUILD_VERSIONEN.md).

| Stand | Wert |
|-------|------|
| Letzte inhaltliche Aktualisierung | 2026-06-28 |

---

## Wo liegt die Datei?

| Kontext | Standard |
|---------|----------|
| **Electron Release** (ZIP / Portable, gepackt) | Wenn `DATABASE_URL` nicht gesetzt: `<Ordner von PhiX.exe>/data/phix.db` (portabel mit dem App-Ordner, z. B. USB) |
| **Electron Entwicklung** (`desktop/npm run dev`) | `%APPDATA%\PhiX\phix.db` (Windows) |
| **Manuell (nur Entwicklung)** | In `backend/.env`, z. B. `DATABASE_URL="file:./phix-dev.sqlite"` — nur für Backend-Tests, **kein** Produkt-Release |

URL-Format unter Windows: `file:C:/…/phix.db` via `backend/lib/sqlite-database-url.js`. Override des Datenordners: `PHI_X_USERDATA_DIR`.

Schema und Client: `backend/prisma/sqlite/schema.prisma` → generiert nach `backend/generated/prisma-sqlite/`.

---

## Backup & Rollback

- **Backup:** App beenden, Datei `phix.db` (bzw. Ihre `*.sqlite`) kopieren — z. B. `phix-backup-20260628.db`.
- **Rollback:** App beenden, fehlerhafte DB ersetzen oder Backup-Datei zurückspielen.
- Vor **App-Updates** (wenn sich das Schema ändert): immer ein Backup anlegen; `prisma db push` kann bei SQLite Schema-Anpassungen erzwingen.

---

## Postgres vs. SQLite

| Variante | Datenbank |
|----------|-----------|
| **Docker Compose (Server)** | `DATABASE_URL=postgresql://…` |
| **Electron Release** | SQLite `data/phix.db` (ohne eigene URL) |
| **Electron Dev** | SQLite unter `%APPDATA%\PhiX\` |

Verschlüsselung und Backup-Format gelten für **beide** Varianten — siehe [`ENCRYPTION.md`](ENCRYPTION.md).

---

## Generieren beider Prisma-Clients

Im Ordner `backend/`:

```bash
node scripts/prisma-generate-all.js
```

(läuft automatisch als `npm install` → `postinstall`.)

Bei Schema-Änderungen **beide** Dateien pflegen: `prisma/schema.prisma` (Postgres) und `prisma/sqlite/schema.prisma` — siehe [`ADR-002-prisma-postgres-sqlite.md`](ADR-002-prisma-postgres-sqlite.md).

---

## Optional: Daten von Postgres übernehmen

Siehe [`SQLITE_IMPORT.md`](SQLITE_IMPORT.md) (Rahmen, kein automatischer Ein-Klick-Import).
