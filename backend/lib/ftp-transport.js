/**
 * Transport-Modul für Offsite-Backups via SFTP (SSH) und FTPS (FTP over TLS).
 */

const path = require('path');

const TIMEOUT_MS = 15000;

function normalizeRemotePath(basePath, filename = '') {
  const cleanBase = (basePath || '/').trim().replace(/\\/g, '/');
  if (!filename) return cleanBase.endsWith('/') ? cleanBase : `${cleanBase}/`;
  const joined = path.posix.join(cleanBase, filename);
  return joined.startsWith('/') ? joined : `/${joined}`;
}

/**
 * Lädt ssh2-sftp-client dynamisch, um Laufzeitfehler bei fehlender Dependency abzufangen.
 */
function getSftpClient() {
  try {
    const Client = require('ssh2-sftp-client');
    return new Client();
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      throw new Error("Das Paket 'ssh2-sftp-client' ist nicht installiert. Bitte 'npm install' im Backend ausführen.");
    }
    throw err;
  }
}

/**
 * Lädt basic-ftp dynamisch, um Laufzeitfehler bei fehlender Dependency abzufangen.
 */
function getFtpClient() {
  try {
    const ftp = require('basic-ftp');
    return new ftp.Client(TIMEOUT_MS);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      throw new Error("Das Paket 'basic-ftp' ist nicht installiert. Bitte 'npm install' im Backend ausführen.");
    }
    throw err;
  }
}

/**
 * Testet die Verbindung zum konfigurierten Remote-Server.
 */
async function testRemoteConnection(config) {
  const protocol = (config.remoteProtocol || 'sftp').toLowerCase();
  const host = (config.remoteHost || '').trim();
  const port = Number(config.remotePort) || (protocol === 'sftp' ? 22 : 21);
  const user = (config.remoteUser || '').trim();
  const password = config.remotePassword ?? '';
  const remoteDir = (config.remotePath || '/').trim();

  if (!host) {
    throw new Error('Host/Server-Adresse darf nicht leer sein.');
  }
  if (!user) {
    throw new Error('Benutzername darf nicht leer sein.');
  }

  if (protocol === 'sftp') {
    const sftp = getSftpClient();
    try {
      await sftp.connect({
        host,
        port,
        username: user,
        password,
        readyTimeout: TIMEOUT_MS,
      });

      const targetDir = normalizeRemotePath(remoteDir);
      const exists = await sftp.exists(targetDir);
      if (!exists) {
        await sftp.mkdir(targetDir, true);
      }

      return {
        ok: true,
        protocol: 'sftp',
        message: `SFTP-Verbindung zu ${host}:${port} erfolgreich. Zielordner: ${targetDir}`,
      };
    } finally {
      try {
        await sftp.end();
      } catch {
        /* ignore */
      }
    }
  }

  if (protocol === 'ftps') {
    const client = getFtpClient();
    try {
      await client.access({
        host,
        port,
        user,
        password,
        secure: true,
        secureOptions: {
          rejectUnauthorized: false,
        },
      });

      const targetDir = normalizeRemotePath(remoteDir);
      await client.ensureDir(targetDir);

      return {
        ok: true,
        protocol: 'ftps',
        message: `FTPS-Verbindung zu ${host}:${port} erfolgreich. Zielordner: ${targetDir}`,
      };
    } finally {
      client.close();
    }
  }

  throw new Error(`Nicht unterstütztes Protokoll: '${protocol}'. Erlaubt sind 'sftp' und 'ftps'.`);
}

/**
 * Lädt eine lokale Datei auf den Remote-Server hoch.
 */
async function uploadRemoteBackup(config, localFilePath, remoteFilename) {
  const protocol = (config.remoteProtocol || 'sftp').toLowerCase();
  const host = (config.remoteHost || '').trim();
  const port = Number(config.remotePort) || (protocol === 'sftp' ? 22 : 21);
  const user = (config.remoteUser || '').trim();
  const password = config.remotePassword ?? '';
  const remoteDir = (config.remotePath || '/').trim();

  if (protocol === 'sftp') {
    const sftp = getSftpClient();
    try {
      await sftp.connect({
        host,
        port,
        username: user,
        password,
        readyTimeout: TIMEOUT_MS,
      });

      const targetDir = normalizeRemotePath(remoteDir);
      const exists = await sftp.exists(targetDir);
      if (!exists) {
        await sftp.mkdir(targetDir, true);
      }

      const destPath = normalizeRemotePath(targetDir, remoteFilename);
      await sftp.fastPut(localFilePath, destPath);
      return { ok: true, remotePath: destPath };
    } finally {
      try {
        await sftp.end();
      } catch {
        /* ignore */
      }
    }
  }

  if (protocol === 'ftps') {
    const client = getFtpClient();
    try {
      await client.access({
        host,
        port,
        user,
        password,
        secure: true,
        secureOptions: {
          rejectUnauthorized: false,
        },
      });

      const targetDir = normalizeRemotePath(remoteDir);
      await client.ensureDir(targetDir);
      await client.uploadFrom(localFilePath, remoteFilename);
      return { ok: true, remotePath: normalizeRemotePath(targetDir, remoteFilename) };
    } finally {
      client.close();
    }
  }

  throw new Error(`Nicht unterstütztes Protokoll: '${protocol}'.`);
}

/**
 * Löscht veraltete Auto-Backup-Dateien auf dem Remote-Server gemäß retentionCount.
 */
async function rotateRemoteBackups(config, filenamePrefix, retentionCount) {
  if (retentionCount <= 0) return { deletedCount: 0 };
  const protocol = (config.remoteProtocol || 'sftp').toLowerCase();
  const host = (config.remoteHost || '').trim();
  const port = Number(config.remotePort) || (protocol === 'sftp' ? 22 : 21);
  const user = (config.remoteUser || '').trim();
  const password = config.remotePassword ?? '';
  const remoteDir = (config.remotePath || '/').trim();

  let deletedCount = 0;

  if (protocol === 'sftp') {
    const sftp = getSftpClient();
    try {
      await sftp.connect({
        host,
        port,
        username: user,
        password,
        readyTimeout: TIMEOUT_MS,
      });

      const targetDir = normalizeRemotePath(remoteDir);
      if (!(await sftp.exists(targetDir))) return { deletedCount: 0 };

      const list = await sftp.list(targetDir);
      const backupFiles = list
        .filter((item) => item.type === '-' && item.name.startsWith(filenamePrefix) && item.name.endsWith('.json'))
        .sort((a, b) => b.name.localeCompare(a.name)); // Neueste zuerst

      if (backupFiles.length > retentionCount) {
        const toDelete = backupFiles.slice(retentionCount);
        for (const item of toDelete) {
          const itemPath = normalizeRemotePath(targetDir, item.name);
          try {
            await sftp.delete(itemPath);
            deletedCount++;
          } catch (err) {
            console.warn(`[auto-backup-sftp] Konnte alte Datei ${itemPath} nicht löschen:`, err.message);
          }
        }
      }
      return { deletedCount };
    } finally {
      try {
        await sftp.end();
      } catch {
        /* ignore */
      }
    }
  }

  if (protocol === 'ftps') {
    const client = getFtpClient();
    try {
      await client.access({
        host,
        port,
        user,
        password,
        secure: true,
        secureOptions: {
          rejectUnauthorized: false,
        },
      });

      const targetDir = normalizeRemotePath(remoteDir);
      await client.ensureDir(targetDir);
      const list = await client.list();
      const backupFiles = list
        .filter((item) => item.isFile && item.name.startsWith(filenamePrefix) && item.name.endsWith('.json'))
        .sort((a, b) => b.name.localeCompare(a.name)); // Neueste zuerst

      if (backupFiles.length > retentionCount) {
        const toDelete = backupFiles.slice(retentionCount);
        for (const item of toDelete) {
          try {
            await client.remove(item.name);
            deletedCount++;
          } catch (err) {
            console.warn(`[auto-backup-ftps] Konnte alte Datei ${item.name} nicht löschen:`, err.message);
          }
        }
      }
      return { deletedCount };
    } finally {
      client.close();
    }
  }

  return { deletedCount: 0 };
}

module.exports = {
  testRemoteConnection,
  uploadRemoteBackup,
  rotateRemoteBackups,
};
