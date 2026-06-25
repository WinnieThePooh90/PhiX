# ADR-002: Prisma — PostgreSQL (Web/Server) und SQLite (Desktop)

## Status

Akzeptiert und **umgesetzt** (Backend: dualer Prisma-Client, SQLite-Schema, Start-`db push`, Electron-Standard-DB). Offen: optionaler Import Postgres→SQLite, CI-Smokes.

## Kontext

- **Web/Server (Docker):** PostgreSQL ist die Produktions-Datenbank.
- **Desktop (Electron):** **Eingebettete SQLite-Datei** unter dem Benutzerdatenordner (kein separater DB-Server).

Prisma erlaubt pro `schema.prisma` genau **einen** `datasource`-Provider.

## Entscheidung

1. **Zwei Prisma-Projekte im gleichen Repo** (zwei Schema-Einstiegspunkte), die **dieselben Modelle** abbilden (manuell synchron zu halten):
   - `backend/prisma/schema.prisma` — **PostgreSQL** (bestehende Migrationen).
   - `backend/prisma/sqlite/schema.prisma` — **SQLite**; **`prisma db push`** beim Desktop-Start.

   - `backend/generated/prisma-sqlite/` — Output des zweiten `generator` (nicht unter `@prisma/client`).

2. **Backend wählt Client zur Laufzeit** anhand von `DATABASE_URL` (Präfix `file:` oder `sqlite:` → SQLite-Client aus `generated/prisma-sqlite`).

## Alternativen (verworfen)

- **Ein Schema, Provider per Env:** von Prisma so nicht unterstützt.
- **Nur SQLite für alles:** verworfen — Server-Version soll Postgres behalten.

## Risiken / Regeln

- **Schema-Drift:** Jede Modelländerung muss in **beiden** Schemas nachgezogen werden.
- **CI:** Zwei Jobs (`prisma migrate` Postgres + `prisma db push`/migrate SQLite Smoke) — siehe `docs/SMOKE_WEB_BASELINE.md`.

## Nächste Schritte (optional)

- Import Postgres → SQLite + Validierung (`docs/SQLITE_IMPORT.md`).
- CI-Jobs für Postgres- und SQLite-Smoke.

## Referenzen

- `docs/SQLITE_DESKTOP.md`
- Cursor-Regel `.cursor/rules/prisma-dual-schema.mdc`
