# Hilfsfunktionen: Node + PostgreSQL (Windows) fuer Release-Build
param()

$Script:WebUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PhiX-Build/1.0'

function Get-PostgresMajorMinor([string]$PostgresVersion) {
    if ($PostgresVersion -match '^(\d+\.\d+)') { return $Matches[1] }
    throw "PostgresVersion muss mit major.minor beginnen (z. B. 16.14-1), erhalten: $PostgresVersion"
}

function Get-PostgresWindowsDownloadUrl([string]$PostgresVersion) {
    # Nur PowerShell (kein Python): Windows-Store-Alias "python3" wirft sonst Fehler.
    $majorMinor = Get-PostgresMajorMinor $PostgresVersion

    $page = Invoke-WebRequest -Uri 'https://www.enterprisedb.com/download-postgresql-binaries' `
        -UseBasicParsing -Headers @{ 'User-Agent' = $Script:WebUserAgent }
    $html = $page.Content
    $sectionPat = "Version\s*(?:<!--\s*-->)?\s*$([regex]::Escape($majorMinor))\b.*?(?=Version\s*(?:<!--\s*-->)?\s*\d+\.\d+|$)"
    if ($html -notmatch $sectionPat) {
        throw "PostgreSQL-Version $majorMinor nicht auf der EDB-Seite gefunden."
    }
    $chunk = $Matches[0]
    $linkPat = 'href="(https://sbp\.enterprisedb\.com/getfile\.jsp\?fileid=\d+)"[^>]*>\s*<img[^>]*alt="([^"]+)"'
    $linkMatches = [regex]::Matches($chunk, $linkPat, 'IgnoreCase')
    foreach ($m in $linkMatches) {
        $alt = $m.Groups[2].Value.ToLower()
        if ($alt -like '*windows*' -and $alt -like '*x86-64*') {
            return $m.Groups[1].Value
        }
    }
    throw "Kein Windows-x64-Download fuer PostgreSQL $majorMinor gefunden."
}

function Save-WebFile([string]$Url, [string]$Dest) {
    Ensure-Dir (Split-Path $Dest -Parent)
    try {
        Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing `
            -Headers @{ 'User-Agent' = $Script:WebUserAgent }
    } catch {
        # curl.exe ist auf Windows 10+ oft verfuegbar und umgeht 403-Probleme
        $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
        if ($curl) {
            & curl.exe -fsSL -A $Script:WebUserAgent -o $Dest $Url
            if ($LASTEXITCODE -ne 0) { throw }
            return
        }
        throw
    }
}

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

function Remove-DirRetry([string]$Path, [int]$Retries = 5) {
    if (-not (Test-Path $Path)) { return }
    for ($i = 0; $i -lt $Retries; $i++) {
        try {
            Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
            return
        } catch {
            if ($i -eq $Retries - 1) { throw }
            Start-Sleep -Seconds 2
        }
    }
}

function Copy-TreeRobust([string]$Source, [string]$Dest) {
    if (Test-Path $Dest) { Remove-DirRetry $Dest }
    Ensure-Dir $Dest
    if (Get-Command robocopy.exe -ErrorAction SilentlyContinue) {
        & robocopy.exe $Source $Dest /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
        if ($LASTEXITCODE -ge 8) {
            throw "robocopy fehlgeschlagen (Code $LASTEXITCODE): $Source -> $Dest"
        }
        return
    }
    Copy-Item -LiteralPath (Join-Path $Source '*') -Destination $Dest -Recurse -Force
}

function Expand-ZipContentsTo([string]$ZipPath, [string]$DestDir, [string]$InnerFolderName = '') {
    $temp = Join-Path $env:TEMP ("phix-extract-" + [guid]::NewGuid().ToString('n').Substring(0, 8))
    try {
        Ensure-Dir $temp
        Expand-Archive -LiteralPath $ZipPath -DestinationPath $temp -Force
        if ($InnerFolderName) {
            $source = Join-Path $temp $InnerFolderName
            if (-not (Test-Path $source)) { throw "Ordner '$InnerFolderName' fehlt in $ZipPath" }
        } else {
            $source = (Get-ChildItem -LiteralPath $temp -Directory | Select-Object -First 1).FullName
            if (-not $source) { throw "ZIP enthaelt keinen Unterordner: $ZipPath" }
        }
        Copy-TreeRobust $source $DestDir
    } finally {
        Remove-DirRetry $temp
    }
}

function Download-NodeWinZip([string]$NodeVersion, [string]$Dest) {
    if (Test-Path $Dest) {
        Write-Host "  Cache: $Dest"
        return
    }
    $url = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
    Write-Host "  Lade herunter: $url"
    Save-WebFile $url $Dest
}

function Download-PostgresWinZip {
    param(
        [string]$PostgresVersion,
        [string]$Dest,
        [string]$PostgresZipPath = ''
    )

    if ($PostgresZipPath) {
        if (-not (Test-Path $PostgresZipPath)) {
            throw "PostgresZipPath nicht gefunden: $PostgresZipPath"
        }
        Write-Host "  Kopiere: $PostgresZipPath"
        Ensure-Dir (Split-Path $Dest -Parent)
        Copy-Item -LiteralPath $PostgresZipPath -Destination $Dest -Force
        return
    }

    if (Test-Path $Dest) {
        Write-Host "  Cache: $Dest"
        return
    }

    $url = Get-PostgresWindowsDownloadUrl $PostgresVersion
    Write-Host "  Lade herunter (EDB): PostgreSQL $PostgresVersion"
    Write-Host "  URL: $url"
    Save-WebFile $url $Dest

    if (-not (Test-Path $Dest) -or (Get-Item $Dest).Length -lt 1MB) {
        throw "Download ungueltig (Datei fehlt oder zu klein): $Dest"
    }
}
