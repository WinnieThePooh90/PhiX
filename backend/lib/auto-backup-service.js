/**
 * Auto-Backup Service: Wöchentlicher Scheduler, Catch-up beim App-Start,
 * lokales Speichern mit Rotation und optionaler (S)FTP-Upload.
 */

const fs = require('fs');
const path = require('path');
const { exportPhixDatabase, serializeBackupPayload } = require('./phix-backup');
const { runWithCryptoContext } = require('./crypto-context');
const { testRemoteConnection, uploadRemoteBackup, rotateRemoteBackups } = require('./ftp-transport');

const FILENAME_PREFIX = 'phix-autobackup-';
let schedulerInterval = null;
let isBackupRunning = false;

/**
 * Erzeugt einen Zeitstempel formatiert in der Zeitzone Europe/Berlin (YYYY-MM-DDTHH-mm-ss).
 */
function formatBerlinTimestamp(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const get = (type) => parts.find((p) => p.type === type)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}-${get('minute')}-${get('second')}`;
  } catch {
    return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }
}

/**
 * Ermittelt den absoluten Pfad zum lokalen Backup-Ordner (fest "Autobackups" im PhiX-Verzeichnis).
 */
function resolveLocalBackupDir() {
  const folderName = 'Autobackups';

  // 1. Electron Desktop: Datenordner ist bekannt
  if (process.env.PHI_X_USERDATA_DIR) {
    const parentDir = path.dirname(process.env.PHI_X_USERDATA_DIR);
    if (path.basename(process.env.PHI_X_USERDATA_DIR).toLowerCase() === 'data') {
      return path.join(parentDir, folderName);
    }
    return path.join(process.env.PHI_X_USERDATA_DIR, folderName);
  }

  // 2. Explizit konfigurierter Datenpfad
  if (process.env.PHIX_DATA_DIR) {
    return path.join(process.env.PHIX_DATA_DIR, folderName);
  }

  // 3. Monorepo-Entwicklung (falls Node im backend/ Ordner gestartet wurde)
  const repoParent = path.resolve(process.cwd(), '..');
  if (
    fs.existsSync(path.join(repoParent, 'Notenauswertung-App')) &&
    fs.existsSync(path.join(repoParent, 'backend'))
  ) {
    return path.join(repoParent, folderName);
  }

  // 4. Docker / Standard-Arbeitsverzeichnis
  return path.resolve(process.cwd(), folderName);
}

/**
 * Listet alle lokalen Backups im Autobackups-Verzeichnis auf.
 */
function listLocalBackups() {
  const dirPath = resolveLocalBackupDir();
  if (!fs.existsSync(dirPath)) return [];
  try {
    const files = fs.readdirSync(dirPath)
      .filter((f) => f.startsWith(FILENAME_PREFIX) && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // Neueste zuerst

    return files.map((filename) => {
      const fullPath = path.join(dirPath, filename);
      try {
        const stat = fs.statSync(fullPath);
        return {
          filename,
          sizeBytes: stat.size,
          mtime: stat.mtime.toISOString(),
        };
      } catch {
        return {
          filename,
          sizeBytes: 0,
          mtime: null,
        };
      }
    });
  } catch (err) {
    console.error('[auto-backup] Fehler beim Auflisten lokaler Backups:', err.message);
    return [];
  }
}

/**
 * Validiert den Dateinamen und gibt den absoluten Pfad zur Backup-Datei zurück (oder null).
 */
function getLocalBackupFilePath(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const base = path.basename(filename);
  if (base !== filename || !filename.endsWith('.json') || filename.includes('..')) {
    return null;
  }
  const dirPath = resolveLocalBackupDir();
  const fullPath = path.join(dirPath, filename);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fullPath;
  }
  return null;
}

/**
 * Löscht eine lokale Backup-Datei.
 */
function deleteLocalBackup(filename) {
  const fullPath = getLocalBackupFilePath(filename);
  if (!fullPath) {
    throw new Error('Datei nicht gefunden oder ungültiger Dateiname.');
  }
  fs.unlinkSync(fullPath);
  return { ok: true, filename };
}

/**
 * Bereinigt alte lokale Backups, sodass maximal retentionCount Dateien übrig bleiben.
 */
function rotateLocalBackups(dirPath, retentionCount) {
  if (retentionCount <= 0 || !fs.existsSync(dirPath)) return 0;
  try {
    const files = fs.readdirSync(dirPath)
      .filter((f) => f.startsWith(FILENAME_PREFIX) && f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // Neueste zuerst

    let deleted = 0;
    if (files.length > retentionCount) {
      const toDelete = files.slice(retentionCount);
      for (const file of toDelete) {
        try {
          fs.unlinkSync(path.join(dirPath, file));
          deleted++;
        } catch (e) {
          console.warn('[auto-backup] Konnte altes lokales Backup nicht löschen:', file, e.message);
        }
      }
    }
    return deleted;
  } catch (err) {
    console.error('[auto-backup] Fehler bei lokaler Rotation:', err.message);
    return 0;
  }
}

/**
 * Prüft, ob seit dem letzten Sonntag 00:00 Uhr bereits ein Backup gelaufen ist.
 */
function isSundayBackupDue(lastRunAt) {
  if (!lastRunAt) return true;

  const lastRun = new Date(lastRunAt);
  if (Number.isNaN(lastRun.getTime())) return true;

  const now = new Date();
  
  // Wenn mehr als 7 Tage vergangen sind: auf jeden Fall fällig
  if (now.getTime() - lastRun.getTime() >= 7 * 24 * 60 * 60 * 1000) {
    return true;
  }

  // Finde den letzten vergangenen Sonntag 00:00:00
  const lastSunday = new Date(now);
  const dayOfWeek = now.getDay(); // 0 = Sonntag, 1 = Montag, ...
  lastSunday.setDate(now.getDate() - dayOfWeek);
  lastSunday.setHours(0, 0, 0, 0);

  // Wenn der letzte Sonntag nach dem lastRun-Zeitpunkt liegt, ist das Wochenbackup fällig
  return lastRun < lastSunday;
}

/**
 * Lädt oder initialisiert die AutoBackupConfig-Tabelle.
 */
async function getOrCreateConfig(prisma) {
  let row = await prisma.autoBackupConfig.findUnique({ where: { id: 1 } });
  if (!row) {
    row = await prisma.autoBackupConfig.create({
      data: {
        id: 1,
        enabled: false,
        localPath: 'Autobackups',
        retentionCount: 10,
        remoteEnabled: false,
        remoteProtocol: 'sftp',
        remotePort: 22,
      },
    });
  }
  return row;
}

/**
 * Führt ein vollständiges automatisches Backup durch (lokal + optional remote).
 */
async function executeAutoBackup(prisma, trigger = 'scheduled') {
  if (isBackupRunning) {
    return { ok: false, message: 'Ein Backup-Vorgang läuft bereits.' };
  }

  isBackupRunning = true;
  let config = null;

  try {
    config = await getOrCreateConfig(prisma);

    if (!config.enabled && trigger !== 'manual') {
      return { ok: true, skipped: true, message: 'Auto-Backup ist deaktiviert.' };
    }

    console.log(`[auto-backup] Starte Backup (Trigger: ${trigger})…`);

    // 1. JSON-Backup erstellen (mit bypassCrypto: true für rohen Export verschlüsselter Daten)
    const payload = await runWithCryptoContext({ bypassCrypto: true }, () =>
      exportPhixDatabase(prisma, {
        source: 'auto-backup',
        trigger,
        createdAt: new Date().toISOString(),
      }),
    );
    const jsonStr = serializeBackupPayload(payload);

    // 2. Lokalen Speicherordner vorbereiten
    const localDir = resolveLocalBackupDir();
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    const stamp = formatBerlinTimestamp(new Date());
    const filename = `${FILENAME_PREFIX}${stamp}.json`;
    const localFilePath = path.join(localDir, filename);
    const tempFilePath = `${localFilePath}.tmp`;

    // Atomares Schreiben
    fs.writeFileSync(tempFilePath, jsonStr, 'utf8');
    fs.renameSync(tempFilePath, localFilePath);

    // Lokale Rotation
    const localDeleted = rotateLocalBackups(localDir, config.retentionCount);
    console.log(`[auto-backup] Lokal gespeichert: ${localFilePath} (Alte gelöscht: ${localDeleted})`);

    let lastStatusLocal = 'success';
    let lastStatusRemote = 'skipped';
    let lastErrorMessage = null;

    // 3. Remote-Upload via (S)FTP (falls aktiviert)
    if (config.remoteEnabled) {
      try {
        console.log(`[auto-backup] Lade auf Remote-Server (${config.remoteProtocol}://${config.remoteHost}) hoch…`);
        await uploadRemoteBackup(config, localFilePath, filename);
        const remoteRotated = await rotateRemoteBackups(config, FILENAME_PREFIX, config.retentionCount);
        lastStatusRemote = 'success';
        console.log(`[auto-backup] Remote-Upload erfolgreich. Remote bereinigt: ${remoteRotated.deletedCount}`);
      } catch (remoteErr) {
        lastStatusRemote = 'error';
        lastErrorMessage = `Remote-Fehler: ${remoteErr.message}`;
        console.error('[auto-backup] Fehler beim Remote-Upload:', remoteErr.message);
      }
    }

    // 4. Status in DB aktualisieren
    await prisma.autoBackupConfig.update({
      where: { id: 1 },
      data: {
        lastRunAt: new Date(),
        lastStatusLocal,
        lastStatusRemote,
        lastErrorMessage,
      },
    });

    return {
      ok: true,
      filename,
      localPath: localFilePath,
      lastStatusLocal,
      lastStatusRemote,
      lastErrorMessage,
    };
  } catch (err) {
    console.error('[auto-backup] Kritischer Fehler bei Backup-Erstellung:', err);
    if (config) {
      try {
        await prisma.autoBackupConfig.update({
          where: { id: 1 },
          data: {
            lastRunAt: new Date(),
            lastStatusLocal: 'error',
            lastStatusRemote: config.remoteEnabled ? 'error' : 'skipped',
            lastErrorMessage: `Lokal-Fehler: ${err.message}`,
          },
        });
      } catch {
        /* ignore */
      }
    }
    return { ok: false, error: err.message };
  } finally {
    isBackupRunning = false;
  }
}

/**
 * Startet den periodischen Scheduler und führt die Startprüfung (Catch-up) durch.
 */
function initAutoBackupScheduler(prisma) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  // Startprüfung nach kurzer Verzögerung (damit DB und Server vollständig bereit sind)
  setTimeout(async () => {
    try {
      const config = await getOrCreateConfig(prisma);
      if (config.enabled && isSundayBackupDue(config.lastRunAt)) {
        console.log('[auto-backup] Nachhol-Bedarf festgestellt (Catch-up). Starte Auto-Backup…');
        await executeAutoBackup(prisma, 'startup-catchup');
      }
    } catch (err) {
      console.warn('[auto-backup] Fehler bei Startprüfung:', err.message);
    }
  }, 5000);

  // Stündliche Prüfung, ob Sonntag erreicht wurde
  schedulerInterval = setInterval(async () => {
    try {
      const config = await getOrCreateConfig(prisma);
      if (config.enabled && isSundayBackupDue(config.lastRunAt)) {
        console.log('[auto-backup] Fälliges Sonntags-Backup wird ausgeführt…');
        await executeAutoBackup(prisma, 'scheduled');
      }
    } catch (err) {
      console.warn('[auto-backup] Fehler im Scheduler-Intervall:', err.message);
    }
  }, 15 * 60 * 1000); // alle 15 Minuten prüfen
}

module.exports = {
  resolveLocalBackupDir,
  listLocalBackups,
  getLocalBackupFilePath,
  deleteLocalBackup,
  rotateLocalBackups,
  isSundayBackupDue,
  getOrCreateConfig,
  executeAutoBackup,
  initAutoBackupScheduler,
  testRemoteConnection,
};
