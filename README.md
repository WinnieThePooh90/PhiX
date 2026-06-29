# PhiX

**Notenauswertung für Lehrkräfte** — Klausuren, Tests, mündliche Noten, Projekte, GFS, Referate und Gesamtübersicht in einer Anwendung. Entwickelt für den Schulalltag (insbesondere Gymnasium in Baden-Württemberg), als Docker-Server oder Windows-Desktop nutzbar.

| | |
|---|---|
| **Aktueller Build** | siehe [`docs/APP_VERSION.md`](docs/APP_VERSION.md) |
| **Lizenz** | [Apache License 2.0](LICENSE) |
| **Autor** | Karsten Paulokat |

---

## Inhalt

- [Funktionen](#funktionen)
- [Technologie](#technologie)
- [Projektstruktur](#projektstruktur)
- [Schnellstart (Entwicklung)](#schnellstart-entwicklung)
- [Betrieb & Builds](#betrieb--builds)
- [Versionierung](#versionierung)
- [Lizenz & Drittanbieter](#lizenz--drittanbieter)
- [Dokumentation](#dokumentation)
- [Kontakt](#kontakt)

---

## Funktionen

### Noten & Leistungen

- **Klausuren** — Aufgabenfelder, Notenschlüssel (Plateau/Linear, eigene Schlüssel, ABI-Vorlagen), Nachschreiber, manuelle Noten, Auswertungsdiagramme
- **Tests** — analog zu Klausuren, optional pro Kurs (ein-/ausschaltbar in den Kurseinstellungen)
- **Mündlich** — einfache und erweiterte Erfassung (Wochenpunkte mit Berücksichtigung der gesamten Klassenleistung oder Wochennoten pro Schüler)
- **Projekte** — schriftlich/mündlich/prozentual gewichtet, Einzel- oder Gruppennoten
- **GFS** — Gleichwertige Feststellung von Schülerleistungen (Pflicht in Baden-Württemberg) mit Thema, Art, Halbjahr und Note; **Auswertungshilfe** pro Schüler (Kriterienbogen mit Punktesumme und Notenvorschlag)
- **Referate** — Thema, Art, Halbjahr, Note; optional als Klausur- oder mündliche Leistung gewichtet; gleiche **Auswertungshilfe** wie bei GFS
- **Übersicht** — Gesamtnote, Schriftlich/Mündlich, optional Halbjahresnote; nachvollziehbare Berechnung pro Schüler

### Notensysteme

- **Klassisches Notensystem** (1–6, Viertelnoten)
- **Notenpunktesystem** (0–15) inkl. Umrechnung und Kursstufen-Modus
- **Kursstufe** — Punktesystem, angepasste Standardwerte (Klausuren, mündliche Bereiche), vereinfachte Halbjahres-UI
- **Notenschlüssel** — eingebaute und benutzerdefinierte Schlüssel, Simulation, Diagramme; Anzeige als klassische Note oder Notenpunkte
- **Erweiterte Gewichtung** — feinere Steuerung von Klausur-/Test-/mündlichen Anteilen (optional pro Kurs)

### Organisation & Auswertung

- Mehrere **Kurse** pro Benutzer, Favoriten, Archivierung, Kurs-Einstellungen (Gewichtung, Tests/Projekte/GFS/Referate/Klassenlehrer/Album)
- **Schülerverwaltung** pro Kurs und zentral (Schuljahre, Klassenstufen)
- **Analyse** — Notenverteilung, Einzelübersichten
- **Export** — Excel (.xlsx) und PDF für Übersicht (mit/ohne Details), einzelne Klausuren, Tests, mündliche Leistungen, Projekte, GFS, Referate, Notenschlüssel sowie **Gesamtexport des Kurses** (mehrere Tabellenblätter in einer Datei)
- **Klassenlehrer** — Geldlisten, Anwesenheitslisten, Sammellisten, Notizenlisten (optional externe Personen); **PDF-Export** je Liste inkl. Kopfzeilen
- **Album** — Klassenfotos pro Kurs (optional), Vorschau und Verwaltung
- **Auswertungshilfe** — eigener Auswertungsbogen (Dokument) pro Benutzer für GFS und Referate; pro Schüler Kriterien, Notenvorschlag und Bemerkungen, **PDF-Export** aus dem Dialog

### Sicherheit & Verwaltung

- Verschlüsselte Speicherung sensibler Daten (**AES-256-GCM**), siehe [`docs/ENCRYPTION.md`](docs/ENCRYPTION.md)
- Benutzerkonten mit **Recovery-Key** bei Passwortverlust
- **Backup/Import** — verschlüsseltes Backup inkl. Kurse, Noten, Klassenlehrer-Listen, Album-Fotos, Auswertungshilfe und persönlicher Anzeige-Einstellungen
- Benutzerverwaltung (Admin)
- In-App: Hilfe/FAQ, Lizenz- und Abhängigkeitsübersicht (Open Source)

PhiX ist **kostenlos** nutzbar (keine Werbung, keine versteckten Kosten). Eine freiwillige Registrierung/Spende schaltet optionale Farbschemas frei — Kernfunktionen bleiben für alle verfügbar.

---

## Technologie

| Schicht | Stack |
|--------|--------|
| Frontend | React 19, Vite, React Router |
| Backend | Node.js, Express 5, Prisma |
| Datenbank | **PostgreSQL** (Docker/Server) · **SQLite** (Electron-Desktop) |
| Desktop | Electron (Windows) |
| Deployment | Docker Compose (nginx + API + Postgres) |
| Export | ExcelJS, SheetJS (xlsx), jsPDF + jspdf-autotable |

Prisma nutzt **zwei Schema-Dateien** (PostgreSQL und SQLite), die manuell synchron gehalten werden — siehe [`docs/ADR-002-prisma-postgres-sqlite.md`](docs/ADR-002-prisma-postgres-sqlite.md).

---

## Projektstruktur

| Ordner | Beschreibung |
|--------|----------------|
| [`Notenauswertung-App/`](Notenauswertung-App/) | React/Vite-Frontend (Docker + Desktop) |
| [`backend/`](backend/) | Node.js/Express-API, Prisma, Verschlüsselung |
| [`desktop/`](desktop/) | Electron-Desktop-Hülle (Windows) |
| [`docs/`](docs/) | Installation, Builds, ADRs, Version |

---

## Schnellstart (Entwicklung)

### Voraussetzungen

- [Node.js](https://nodejs.org/) LTS (20+) für Desktop-Entwicklung und -Builds
- [Docker](https://www.docker.com/) für die Server-Variante (empfohlen)

### Abhängigkeiten & Prisma

```bash
cd backend && npm install
cd ../Notenauswertung-App && npm install
```

`npm install` im Backend erzeugt per `postinstall` beide Prisma-Clients (`npm run prisma:generate-all`).

### Variante A — Docker (empfohlen für Server-Test)

Im Projektroot `.env` aus `.env.example` anlegen, dann:

```bash
docker compose up -d --build
```

Browser: **http://localhost:1990** (Frontend; API intern auf Port 3000).

Unter Windows alternativ: `start_docker.bat` / `stop_docker.bat`.

### Variante B — Electron-Desktop (Dev)

```bash
cd Notenauswertung-App && npm run dev   # Terminal 1 — Vite
cd desktop && npm run dev               # Terminal 2 — Backend + Electron-Fenster
```

Details: [`desktop/README.md`](desktop/README.md), [`docs/INSTALL_SERVER_UND_DESKTOP_WINDOWS.md`](docs/INSTALL_SERVER_UND_DESKTOP_WINDOWS.md).

---

## Betrieb & Builds

PhiX kann auf unterschiedliche Weise verteilt werden. Ausführliche Tabellen: [`docs/BUILD_VERSIONEN.md`](docs/BUILD_VERSIONEN.md).

| Variante | Typisch für | Datenbank | Start |
|----------|-------------|-----------|--------|
| **Docker Compose** | Schulserver, mehrere Clients im Browser | PostgreSQL (Volume) | Browser → Port 1990 |
| **Electron Desktop** | Einzelplatz, USB-tauglich | SQLite neben `PhiX.exe` | `PhiX.exe` (ZIP oder Portable-EXE) |

Es gibt **keinen** eigenständigen Web-App-Release (Frontend + Backend ohne Docker oder Electron).

### Build-Befehle (Kurzreferenz)

| Ziel | Befehl | Artefakt |
|------|--------|----------|
| Docker-Stack | `docker compose up -d --build` | Container-Images |
| Windows Electron | `cd desktop && npm run dist` | `desktop/dist-pack/*.zip` und `*.exe` |

**Plattformen:** Windows ist für Desktop-Builds vorgesehen. Ein fertiges **Linux-/macOS-Desktop-Paket** ist derzeit nicht vorkonfiguriert. Apple-Geräte (Mac/iPad) werden nicht unterstützt.

**Datenpfade (Desktop-Release):** SQLite unter `<Installationsordner>/data/phix.db` — Ordner komplett kopieren für USB/Backup. Siehe [`docs/SQLITE_DESKTOP.md`](docs/SQLITE_DESKTOP.md).

---

## Versionierung

Die sichtbare **Build-Nummer** ist eine fortlaufende Ganzzahl (`PHIX_BUILD` in [`docs/APP_VERSION.md`](docs/APP_VERSION.md)).

In `package.json` der drei Hauptpakete steht sie als SemVer **`"<BUILD>.0.0"`** (z. B. `378.0.0`), weil npm und electron-builder eine SemVer-Zeichenkette erwarten — die **Major-Komponente** entspricht dem Build.

Die App zeigt die Build-Nummer unter **Info**; synchronisiert über `Notenauswertung-App/scripts/sync-app-version.mjs`.

---

## Lizenz & Drittanbieter

PhiX ist **Open Source** unter der **[Apache License 2.0](LICENSE)**.

```
Copyright 2026 Karsten Paulokat
```

Sie dürfen den Quellcode nutzen, verändern und weitergeben, sofern Sie die Bedingungen der Apache-2.0-Lizenz einhalten (u. a. Lizenztext und Copyright-Hinweis beibehalten).

- Volltext: [`LICENSE`](LICENSE)
- Kurzattribution wichtiger Bibliotheken: [`NOTICE`](NOTICE)
- Drittanbieter-Lizenzen in der App: Menü **Lizenz** / **Dependencies** (Admin)

Hauptabhängigkeiten (Auszug): React (MIT), Express (MIT), Prisma (Apache-2.0), ExcelJS (MIT), SheetJS/xlsx (Apache-2.0), jsPDF (MIT), jspdf-autotable (MIT), Electron (MIT, Desktop-Builds), Lucide Icons (ISC).

---

## Dokumentation

| Thema | Datei |
|-------|--------|
| **Übersicht (`docs/`)** | [`docs/README.md`](docs/README.md) |
| Windows Installation (Docker + Desktop) | [`docs/INSTALL_SERVER_UND_DESKTOP_WINDOWS.md`](docs/INSTALL_SERVER_UND_DESKTOP_WINDOWS.md) |
| Build-Varianten & Artefakte | [`docs/BUILD_VERSIONEN.md`](docs/BUILD_VERSIONEN.md) |
| Smoke-Tests | [`docs/SMOKE_WEB_BASELINE.md`](docs/SMOKE_WEB_BASELINE.md) |
| Windows-Übersicht | [`WINDOWS.md`](WINDOWS.md) |
| Electron Desktop | [`desktop/README.md`](desktop/README.md) |
| SQLite Desktop / Backup | [`docs/SQLITE_DESKTOP.md`](docs/SQLITE_DESKTOP.md) |
| Verschlüsselung | [`docs/ENCRYPTION.md`](docs/ENCRYPTION.md) |
| Prisma Dual-Schema (ADR) | [`docs/ADR-002-prisma-postgres-sqlite.md`](docs/ADR-002-prisma-postgres-sqlite.md) |
| Aktueller Build | [`docs/APP_VERSION.md`](docs/APP_VERSION.md) |

---

## Kontakt

**Karsten Paulokat** — [karsten@paulokat.de](mailto:karsten@paulokat.de)

Fehler, Fragen oder Hinweise zur Notenberechnung sind willkommen. Für den Einsatz als **Schulserver** bitte vorab Schulleitung und Datenschutz klären (siehe auch FAQ in der App).
