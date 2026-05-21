const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

/**
 * SQLite-URL für Prisma (Schema Engine). Unter Windows verträgt die Engine
 * file:///… von pathToFileURL oft nicht (os error 161) — stattdessen file:C:/…
 * @param {string} filePath — absoluter oder relativer Pfad zur .db-Datei
 * @returns {string}
 */
function toSqliteDatabaseUrl(filePath) {
  const abs = path.resolve(filePath);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (process.platform === 'win32') {
    return `file:${abs.replace(/\\/g, '/')}`;
  }
  return pathToFileURL(abs).href;
}

module.exports = { toSqliteDatabaseUrl };
