; PhiX – Einzelnes Setup.exe aus dem Portable-Release
; Vorher: installer\build-windows-release.ps1 ausfuehren
; Dann diese Datei in Inno Setup kompilieren -> PhiX-Setup.exe

#define MyAppName "PhiX"
#define MyAppVersion "1.0.0"
#define MyReleaseDir "..\release\PhiX-Windows-x64"

#define MyAppIcon "phix.ico"

[Setup]
SetupIconFile={#MyAppIcon}
AppId={{B2E4F8A1-3C5D-4E7F-9A2B-6D8E0F1C4A39}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppName}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=output
OutputBaseFilename=PhiX-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
DisableDirPage=no

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Verknuepfung auf dem Desktop"; GroupDescription: "Symbole:"; Flags: checked

[Files]
Source: "{#MyReleaseDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\PhiX.cmd"; WorkingDir: "{app}"; IconFilename: "{#MyAppIcon}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\PhiX.cmd"; WorkingDir: "{app}"; Tasks: desktopicon; IconFilename: "{#MyAppIcon}"

[Run]
Filename: "{app}\PhiX.cmd"; Description: "{#MyAppName} jetzt starten"; Flags: nowait postinstall skipifsilent unchecked

[UninstallDelete]
Type: filesandordirs; Name: "{app}\data"
Type: filesandordirs; Name: "{app}\logs"
