# PhiX – Einzeldatei für Windows (voll lauffähig)

Endanwender laden **eine Datei** herunter und können PhiX ohne Node.js, Docker oder PostgreSQL-Installation nutzen.

## Was wird verteilt?

| Datei | Beschreibung | Größe (ca.) |
|-------|----------------|-------------|
| **PhiX-Windows-x64.zip** | Archiv – entpacken, `PhiX.cmd` starten | ~250–350 MB |
| **PhiX-Setup.exe** | Installer (Inno Setup), optional | ähnlich |

Enthalten sind:

- Node.js (Windows x64)
- PostgreSQL (Portable-Binaries)
- gebautes Frontend + Backend inkl. Abhängigkeiten
- Erstinitialisierung der Datenbank beim ersten Start

Nach dem Start: **http://127.0.0.1:3000** – Login **admin** / **admin** (bei leerer DB).

## Release bauen (Entwickler)

### Auf Windows

```bat
Build-Release.bat
```

Es wird **kein Python** benoetigt (nur PowerShell und Internet).

Der Build nutzt `%TEMP%` als Arbeitsordner (nicht Dropbox), damit das Entpacken von Node.js nicht an gesperrte Dateien scheitert.

**Node.js auf dem PC ist nicht noetig** – Frontend und Backend werden mit der heruntergeladenen Node-Runtime gebaut.

Ergebnis: `release\PhiX-Windows-x64.zip`

### Auf Linux/macOS

```bash
chmod +x installer/build-windows-release.sh
./installer/build-windows-release.sh
```

Internetverbindung nötig (lädt Node von nodejs.org und PostgreSQL von der EDB-Downloadseite).

Bei Download-Fehlern: ZIP manuell von https://www.enterprisedb.com/download-postgresql-binaries
nach `release/_cache/postgresql-16.14-1-windows-x64-binaries.zip` legen und Build erneut starten.

### Optional: Setup.exe

1. `Build-Release.bat` ausführen
2. [Inno Setup](https://jrsoftware.org/isinfo.php) installieren
3. `installer\PhiX-Portable.iss` kompilieren
4. Ergebnis: `installer\output\PhiX-Setup.exe`

## Endanwender-Anleitung (kurz)

**ZIP:** Ordner entpacken (im ZIP heißt der Stammordner **`PhiX-Windows-x64`**) → **`PhiX.cmd`** doppelklicken → Browser öffnet sich.

**Setup.exe:** Installation durchklicken → Verknüpfung **PhiX** auf dem Desktop.

Daten liegen im Installationsordner unter `data\postgres` (bei Deinstallation mit Setup.exe optional löschbar).

## Hinweise

- Nur **Windows 64-bit**
- Port **3000** (HTTP) und **5432** (interne DB) sollten frei sein
- Erster Start kann 1–2 Minuten dauern (DB-Initialisierung + Schema)
