; Inno Setup – PhiX als Windows-Setup.exe bauen
; Auf Windows: Inno Setup installieren, diese Datei oeffnen, "Kompilieren".
; Ergebnis: installer\output\PhiX-Setup.exe

#define MyAppName "PhiX"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "PhiX"
#define MyAppURL "https://nodejs.org/"
#define MySourceDir ".."

[Setup]
AppId={{A8F3C2E1-9B4D-4F6A-8E2C-1D5B7A9E3F40}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=no
OutputDir=output
OutputBaseFilename=PhiX-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Verknuepfung auf dem Desktop erstellen"; GroupDescription: "Zusaetzliche Symbole:"; Flags: checkedonce

[Files]
Source: "{#MySourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,backend\node_modules\*,Notenauswertung-App\node_modules\*,Notenauswertung-App\dist\*,.git\*,.cursor\*,installer\output\*"
Source: "{#MySourceDir}\installer\*"; DestDir: "{app}\installer"; Flags: ignoreversion recursesubdirs; Excludes: "output\*"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\PhiX-start.bat"; WorkingDir: "{app}"; IconFilename: "{sys}\imageres.dll"; IconIndex: 109
Name: "{group}\PhiX deinstallieren"; Filename: "{app}\Deinstallieren.bat"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\PhiX-start.bat"; WorkingDir: "{app}"; Tasks: desktopicon; IconFilename: "{sys}\imageres.dll"; IconIndex: 109

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\installer\install-dependencies.ps1"" -InstallRoot ""{app}"""; StatusMsg: "Abhaengigkeiten werden installiert (npm)..."; Flags: runhidden waituntilterminated
Filename: "{app}\PhiX-start.bat"; Description: "{#MyAppName} jetzt starten"; Flags: nowait postinstall skipifsilent unchecked

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\installer\Uninstall-PhiX.ps1"" -InstallRoot ""{app}"" -ShortcutsOnly"; Flags: runhidden

[Code]
var
  RunModePage: TInputOptionWizardPage;

procedure InitializeWizard;
begin
  RunModePage := CreateInputOptionPage(wpSelectTasks,
    'Startmodus', 'Wie soll PhiX nach der Installation gestartet werden?',
    'Docker ist empfohlen, wenn Docker Desktop installiert ist.', True, False);
  RunModePage.Add('Docker Compose (Port 1990, empfohlen mit Docker Desktop)');
  RunModePage.Add('Nativ mit Node.js (Port 5173, Datenbank separat)');
  RunModePage.SelectedValueIndex := 0;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  FlagDocker, FlagNative: String;
begin
  if CurStep = ssPostInstall then
  begin
    FlagDocker := ExpandConstant('{app}\USE_DOCKER.flag');
    FlagNative := ExpandConstant('{app}\USE_NATIVE.flag');
    if RunModePage.SelectedValueIndex = 0 then
    begin
      SaveStringToFile(FlagDocker, '', False);
      if FileExists(FlagNative) then
        DeleteFile(FlagNative);
    end
    else
    begin
      SaveStringToFile(FlagNative, '', False);
      if FileExists(FlagDocker) then
        DeleteFile(FlagDocker);
    end;
  end;
end;

