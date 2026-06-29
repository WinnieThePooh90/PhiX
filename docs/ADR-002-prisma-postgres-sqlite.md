# ADR-002: Prisma — PostgreSQL (Docker-Server) und SQLite (Desktop)

## Status

Akzeptiert und **umgesetzt** (Backend: dualer Prisma-Client, SQLite-Schema, Start-`db push`, Electron-Standard-DB). Offen: optionaler Import Postgres→SQLite, CI-Smokes.

## Kontext

- **Docker-Server:** PostgreSQL ist die Produktions-Datenbank (Container `db` in `docker-compose.yml`).
- **Electron-Desktop:** **Eingebettete SQLite-Datei** unter dem Benutzerdatenordner (kein separater DB-Server).

Es gibt keine dritte Datenbank-Variante für einen eigenständigen Web-App-Release.

Prisma erlaubt pro `schema.prisma` genau **einen** `datasource`-Provider.

## Entscheidung

1. **Zwei Prisma-Projekte im gleichen Repo** (zwei Schema-Einstiegspunkte), die **dieselben Modelle** abbilden (manuell synchron zu halten):
   - `backend/prisma/schema.prisma` — **PostgreSQL** (bestehende Migrationen).
   - `backend/prisma/sqlite/schema.prisma` — **SQLite**; **`prisma db push`** beim Desktop-Start.

   - `backend/generated/prisma-sqlite/` — Output des zweiten `generator` (nicht unter `@prisma/client`).

2. **Backend wählt Client zur Laufzeit** anhand von `DATABASE_URL` (Präfix `file:` oder `sqlite:` → SQLite-Client aus `generated/prisma-sqlite`).

## Alternativen (verworfen)

- **Ein Schema, Provider per Env:** von Prisma so nicht unterstützt.
- **Nur SQLite für alles:** verworfen — Docker-Server soll Postgres behalten.
- **Eigenständige Web-App ohne Docker:** verworfen — nur Docker-Server und Electron-Desktop.

## Risiken / Regeln

- **Schema-Drift:** Jede Modelländerung muss in **beiden** Schemas nachgezogen werden.
- **CI:** Zwei Jobs (`prisma migrate` Postgres + `prisma db push`/migrate SQLite Smoke) — siehe [`docs/SMOKE_WEB_BASELINE.md`](SMOKE_WEB_BASELINE.md).

## Nächste Schritte (optional)

- Import Postgres → SQLite + Validierung ([`docs/SQLITE_IMPORT.md`](SQLITE_IMPORT.md)).
- CI-Jobs für Postgres- und SQLite-Smoke.

## Referenzen

- [`docs/SQLITE_DESKTOP.md`](SQLITE_DESKTOP.md)
- [`docs/BUILD_VERSIONEN.md`](BUILD_VERSIONEN.md)
- Cursor-Regel [`.cursor/rules/prisma-dual-schema.mdc`](../.cursor/rules/prisma-dual-schema.mdc)
