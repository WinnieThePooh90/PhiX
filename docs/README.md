# PhiX — Dokumentation

Übersicht der technischen und betrieblichen Dokumentation im Ordner `docs/`.

**Produktvarianten:** PhiX gibt es nur als **Docker-Server** (Browser + PostgreSQL) und **Windows-Desktop** (Electron + SQLite). Es gibt **keinen** eigenständigen Web-App-Release (Frontend + Backend ohne Docker oder Electron).

| Stand | Wert |
|-------|------|
| Letzte inhaltliche Aktualisierung | 2026-07-02 |
| Aktueller Build | **452** — [`APP_VERSION.md`](APP_VERSION.md) |

---

## Installation & Betrieb

| Thema | Datei |
|-------|--------|
| Windows: Docker-Server und Desktop-Build | [`INSTALL_SERVER_UND_DESKTOP_WINDOWS.md`](INSTALL_SERVER_UND_DESKTOP_WINDOWS.md) |
| Build-Varianten, Artefakte, Datenpfade | [`BUILD_VERSIONEN.md`](BUILD_VERSIONEN.md) |
| Windows-Kurzübersicht (Root) | [`../WINDOWS.md`](../WINDOWS.md) |
| Electron Desktop (Details) | [`../desktop/README.md`](../desktop/README.md) |
| Smoke-Tests vor Release | [`SMOKE_WEB_BASELINE.md`](SMOKE_WEB_BASELINE.md) |

---

## Datenbank

| Thema | Datei |
|-------|--------|
| SQLite im Desktop (Pfad, Backup) | [`SQLITE_DESKTOP.md`](SQLITE_DESKTOP.md) |
| Optional: Postgres → SQLite (Rahmen) | [`SQLITE_IMPORT.md`](SQLITE_IMPORT.md) |
| Prisma Dual-Schema (ADR) | [`ADR-002-prisma-postgres-sqlite.md`](ADR-002-prisma-postgres-sqlite.md) |
| Cursor-Regel Schema-Sync | [`../.cursor/rules/prisma-dual-schema.mdc`](../.cursor/rules/prisma-dual-schema.mdc) |

---

## Architektur & Sicherheit

| Thema | Datei |
|-------|--------|
| **Sicherheit & Datenschutz (Übersicht, Audit)** | [`SECURITY.md`](SECURITY.md) |
| **Interne HTTP-API** (keine Public API) | [`INTERNAL_API.md`](INTERNAL_API.md) |
| Desktop-Hülle mit Electron (ADR) | [`ADR-001-desktop-electron.md`](ADR-001-desktop-electron.md) |
| Verschlüsselung (AES-256-GCM, Backup) | [`ENCRYPTION.md`](ENCRYPTION.md) |

---

## Version

| Thema | Datei |
|-------|--------|
| Build-Nummer und Datum | [`APP_VERSION.md`](APP_VERSION.md) |
| Changelog (Kernänderungen pro Build) | [`CHANGELOG.md`](CHANGELOG.md) |

---

## Schnellreferenz: Start & Build

| Ziel | Befehl (Projektroot bzw. Ordner) |
|------|----------------------------------|
| **Server (Docker)** | `docker compose up -d --build` → Browser `http://localhost:1990` |
| **Erste Einrichtung** | Einrichtungsassistent (frische DB); Start-Tipps unter **Einstellungen → Hilfe** |
| **Desktop Release** | `cd desktop && npm run dist` → `desktop/dist-pack/` (nur Windows-ZIP/EXE zuverlässig) |
| **Desktop Entwicklung** | `Notenauswertung-App`: `npm run dev`; `desktop`: `npm run dev` |
| **Build-Artefakte löschen** | `clean-build.bat` (Windows) / `./clean-build.sh` (Linux, macOS) |

Unter Windows für Docker: `start_docker.bat` / `stop_docker.bat` im Projektroot.
