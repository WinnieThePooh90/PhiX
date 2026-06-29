# Optional: Daten von PostgreSQL nach SQLite

Die App unterstützt **zwei getrennte Produktvarianten** mit jeweils eigener Datenbank:

| Variante | Datenbank |
|----------|-----------|
| **Docker-Server** | PostgreSQL |
| **Electron-Desktop** | SQLite |

Es gibt **keinen** eingebauten Ein-Klick-Import im Produktivumfang — typischerweise startet die Desktop-Version mit einer **leeren** SQLite-Datei.

| Stand | Wert |
|-------|------|
| Letzte inhaltliche Aktualisierung | 2026-06-28 |

---

## Empfohlene Vorgehensweise

1. **Neuinstallation Desktop:** SQLite leer lassen; Kurse und Daten neu anlegen oder aus **App-Backups** (verschlüsselt oder Klartext) wiederherstellen — siehe [`ENCRYPTION.md`](ENCRYPTION.md).
2. **Nur Backup von Postgres:** `pg_dump` / Docker-Volume sichern — weiterhin mit Docker/Postgres wiederherstellbar.

---

## Wenn Sie migrieren müssen (fortgeschritten)

- Tabellen und Fremdschlüssel müssen in **sinnvoller Reihenfolge** übertragen werden (z. B. `AppUser` → `Course` → `Student` → …).
- JSON-Felder und `BigInt` (`frontendId`) müssen in beiden Welten konsistent bleiben.
- **Prüfung:** Stichproben (Kursanzahl, Schüler, eine Klausur) und Vergleich der Summen.

### Mögliche technische Wege (extern / späteres Skript)

| Ansatz | Hinweis |
|--------|---------|
| Eigenes Node-Skript mit zwei Prisma-Clients (`@prisma/client` + `generated/prisma-sqlite`) | Lesen aus Postgres, Schreiben in SQLite; einmalig ausführen, nicht in der regulären App. |
| Export über App-API (falls ergänzt) | JSON-Backup und Re-Import — Backup/Restore in der App vorhanden, kein dedizierter Postgres→SQLite-Wizard. |
| Drittanbieter-Tools | Postgres → SQLite Konverter sind fehleranfällig bei JSON/BigInt — nur mit Tests. |

---

## Konkrete nächste Schritte (wenn gewünscht)

1. Anforderungen festlegen (nur Stammdaten vs. komplette Historie).
2. Skript im Repo unter `backend/scripts/` mit Dry-Run und Log.
3. Dokumentierte Rollback-Anleitung (Backup der Ziel-`phix.db` vor Import).

Siehe auch [`SQLITE_DESKTOP.md`](SQLITE_DESKTOP.md) (Backup/Rollback der SQLite-Datei) und [`ADR-002-prisma-postgres-sqlite.md`](ADR-002-prisma-postgres-sqlite.md).
