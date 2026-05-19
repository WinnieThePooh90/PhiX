# PhiX Windows-Installer

## Für Endanwender

1. **Node.js LTS** von https://nodejs.org/ installieren (falls noch nicht vorhanden).
2. Optional: **Docker Desktop** für den Docker-Startmodus.
3. **`Installieren.bat`** im Projektroot per Doppelklick ausführen.
4. Installationsordner wählen (Standard: `%LOCALAPPDATA%\Programs\PhiX`).
5. Nach Abschluss: Desktop-Verknüpfung **PhiX** zum Starten nutzen.

Deinstallation: Startmenü → PhiX → „PhiX deinstallieren“, oder Windows „Apps installiert“ (bei Installation per PowerShell-Installer).

## Setup.exe bauen (optional)

Auf einem Windows-PC mit [Inno Setup](https://jrsoftware.org/isinfo.php):

1. `PhiX-Setup.iss` öffnen.
2. **Kompilieren** → `installer\output\PhiX-Setup.exe`
3. Diese `.exe` kann an andere Rechner verteilt werden.
