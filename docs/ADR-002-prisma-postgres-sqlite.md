# ADR-002: Prisma — PostgreSQL (Web/Server) und SQLite (Desktop)

## Status

Akzeptiert und **umgesetzt** (Backend: dualer Prisma-Client, SQLite-Schema, Start-`db push`, Electron-Standard-DB). Offen: **C3** Import Postgres→SQLite, **D** CI-Smokes.

## Kontext

- **Web/Server:** PostgreSQL bleibt die referenzierte Produktions-Datenbank (Docker, nativ, Portable mit Postgres).
- **Desktop:** Ziel ist eine **eingebettete SQLite-Datei** unter dem Benutzerdatenordner (kein separater DB-Server).

Prisma erlaubt pro `schema.prisma` genau **einen** `datasource`-Provider.

## Entscheidung

1. **Zwei Prisma-Projekte im gleichen Repo** (zwei Schema-Einstiegspunkte), die **dieselben Modelle** abbilden (manuell synchron zu halten, bis ggf. Codegen/Scripting):
   - `backend/prisma/schema.prisma` — unverändert **PostgreSQL** (bestehende Migrationen).
   - `backend/prisma/sqlite/schema.prisma` — **SQLite**; vorerst **`prisma db push`** (kein separates `migrations/`-Verzeichnis nötig). Optionale spätere Migrationen unter `prisma/sqlite/migrations/`.

   - `backend/generated/prisma-sqlite/` — Output des zweiten `generator` (nicht unter `@prisma/client`).

3. **Backend wählt Client zur Laufzeit** anhand von `DATABASE_URL` (Präfix `file:` oder `sqlite:` → SQLite-Client aus `generated/prisma-sqlite`).

## Alternativen (verworfen für v1)

- **Ein Schema, Provider per Env:** von Prisma so nicht unterstützt.
- **Nur SQLite für alles:** verworfen — Server-Version soll Postgres behalten.

## Risiken / Regeln

- **Schema-Drift:** Jede Modelländerung muss in **beiden** Schemas nachgezogen werden, bis ein Generator-Skript existiert.
- **CI:** Zwei Jobs (`prisma migrate` Postgres + `prisma db push`/migrate SQLite Smoke).

## Nächste Schritte (nachgelagert)

- **C3:** Optionaler Import Postgres → SQLite + Validierung.
- **D:** CI-Jobs für Postgres- und SQLite-Smoke.
- **Schema-Drift:** Prüfskript oder Checkliste bei jedem Modell-PR (beide `schema.prisma` anfassen).

## Referenzen

- `ROADMAP_SERVER_DESKTOP_SQLITE.md` Phase C  
- `ISSUE_PACKAGES_SERVER_DESKTOP_SQLITE.md` Paket C-1 … C-3
