# Optional: Daten von PostgreSQL nach SQLite (C3)

Die App unterstützt **zwei getrennte Datenbanken** (Postgres für Server, SQLite für Desktop). Es gibt **keinen** eingebauten Ein-Klick-Import im Produktivumfang — typischerweise startet die Desktop-Version mit einer **leeren** SQLite-Datei.

## Empfohlene Vorgehensweise

1. **Neuinstallation Desktop:** SQLite leer lassen; Kurse und Daten neu anlegen oder aus Exporten (wenn vorhanden) importieren.
2. **Nur Backup von Postgres:** `pg_dump` / Docker-Volume sichern — weiterhin mit Postgres wiederherstellbar.

## Wenn Sie migrieren müssen (fortgeschritten)

- Tabellen und Fremdschlüssel müssen in **sinnvoller Reihenfolge** übertragen werden (z. B. `AppUser` → `Course` → `Student` → …).
- JSON-Felder und `BigInt` (`frontendId`) müssen in beiden Welten konsistent bleiben.
- **Prüfung:** Stichproben (Kursanzahl, Schüler, eine Klausur) und Vergleich der Summen.

### Mögliche technische Wege (extern / späteres Skript)

| Ansatz | Hinweis |
|--------|---------|
| Eigenes Node-Skript mit zwei Prisma-Clients (`@prisma/client` + `generated/prisma-sqlite`) | Lesen aus Postgres, Schreiben in SQLite; einmalig ausführen, nicht in der regulären App. |
| Export über App-API (falls ergänzt) | JSON-Backup und Re-Import — noch nicht implementiert. |
| Drittanbieter-Tools | Postgres → SQLite Konverter sind fehleranfällig bei JSON/BigInt — nur mit Tests. |

## Konkrete nächste Schritte (wenn gewünscht)

1. Anforderungen festlegen (nur Stammdaten vs. komplette Historie).
2. Skript im Repo unter `backend/scripts/` mit Dry-Run und Log.
3. Dokumentierte Rollback-Anleitung (Backup der Ziel-`phix.db` vor Import).

Siehe auch `docs/SQLITE_DESKTOP.md` (Backup/Rollback der SQLite-Datei).
