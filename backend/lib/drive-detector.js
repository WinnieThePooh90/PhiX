/**
 * Drive Detector: Erkennt angeschlossene USB- und Wechselmedien
 * unter Linux, Windows und macOS.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Listet alle potenziellen USB- / Wechselmedien und externen Mount-Punkte auf.
 * @returns {Array<{ path: string, label: string, isRemovable: boolean }>}
 */
function listAvailableDrives() {
  const platform = process.platform;
  const results = [];
  const seenPaths = new Set();

  const addDrive = (drivePath, label, isRemovable = true) => {
    if (!drivePath) return;
    const normalized = path.resolve(drivePath);
    if (seenPaths.has(normalized)) return;
    try {
      if (fs.existsSync(normalized)) {
        const stat = fs.statSync(normalized);
        if (stat.isDirectory()) {
          seenPaths.add(normalized);
          results.push({
            path: normalized,
            label: label || normalized,
            isRemovable,
          });
        }
      }
    } catch {
      /* ignore inaccessible drives */
    }
  };

  if (platform === 'win32') {
    // 1. Windows: Versuch via PowerShell Win32_LogicalDisk
    try {
      const psOutput = execSync(
        'powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, DriveType, VolumeName | ConvertTo-Json"',
        { encoding: 'utf8', timeout: 3000, windowsHide: true },
      );
      const parsed = JSON.parse(psOutput);
      const disks = Array.isArray(parsed) ? parsed : [parsed];
      for (const d of disks) {
        if (!d || !d.DeviceID) continue;
        const driveLetter = d.DeviceID.toUpperCase().endsWith('\\') ? d.DeviceID.toUpperCase() : `${d.DeviceID.toUpperCase()}\\`;
        const driveType = Number(d.DriveType);
        // DriveType 2 = Removable, 3 = Fixed, 4 = Network, 5 = CD-ROM
        const isRemovable = driveType === 2;
        const volName = d.VolumeName ? ` (${d.VolumeName})` : '';
        const typeLabel = isRemovable ? ' [USB/Wechseldatenträger]' : '';
        // Priorisiere Removable oder Nicht-C-Laufwerke
        if (driveLetter !== 'C:\\' || isRemovable) {
          addDrive(driveLetter, `${driveLetter}${volName}${typeLabel}`, isRemovable);
        }
      }
    } catch {
      // Fallback Windows: Drive Letters D: bis Z: scannen
      const letters = 'DEFGHIJKLMNOPQRSTUVWXYZ';
      for (const char of letters) {
        const root = `${char}:\\`;
        addDrive(root, `${root} [Laufwerk]`, true);
      }
    }
  } else if (platform === 'linux') {
    // 1. /media und /run/media scannen
    const scanDirs = ['/media', '/run/media', '/mnt'];
    for (const base of scanDirs) {
      if (!fs.existsSync(base)) continue;
      try {
        const entries = fs.readdirSync(base, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const subPath = path.join(base, entry.name);
          // Unter /media/<user>/... oder /run/media/<user>/... tiefer scannen
          if (base === '/media' || base === '/run/media') {
            try {
              const subEntries = fs.readdirSync(subPath, { withFileTypes: true });
              for (const sub of subEntries) {
                if (sub.isDirectory()) {
                  const mediaPath = path.join(subPath, sub.name);
                  addDrive(mediaPath, `${sub.name} (${mediaPath}) [USB/Medium]`, true);
                }
              }
            } catch {
              /* ignore */
            }
          }
          addDrive(subPath, `${entry.name} (${subPath}) [Eingehängt]`, true);
        }
      } catch {
        /* ignore */
      }
    }

    // 2. /proc/mounts analysieren für eingehängte Datenträger (z. B. vfat, exfat, ntfs, ext4 auf /dev/sd* oder /dev/nvme*)
    try {
      if (fs.existsSync('/proc/mounts')) {
        const content = fs.readFileSync('/proc/mounts', 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            const dev = parts[0];
            const mountPoint = parts[1].replace(/\\040/g, ' '); // Leerzeichen unescapen
            // Nur relevante Speichergeräte (sd*, mmcblk*, nvme*, mapper* gemountet unter /media, /mnt, /run/media)
            if (
              (dev.startsWith('/dev/sd') || dev.startsWith('/dev/mmcblk') || dev.startsWith('/dev/nvme')) &&
              (mountPoint.startsWith('/media') || mountPoint.startsWith('/run/media') || mountPoint.startsWith('/mnt'))
            ) {
              const name = path.basename(mountPoint);
              addDrive(mountPoint, `${name} (${mountPoint}) [Gemountetes USB-Laufwerk]`, true);
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  } else if (platform === 'darwin') {
    // macOS: /Volumes scannen
    const base = '/Volumes';
    if (fs.existsSync(base)) {
      try {
        const entries = fs.readdirSync(base, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name !== 'Macintosh HD') {
            const volPath = path.join(base, entry.name);
            addDrive(volPath, `${entry.name} (${volPath}) [USB/Volume]`, true);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  return results;
}

module.exports = {
  listAvailableDrives,
};
