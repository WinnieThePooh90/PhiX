/**
 * Generiert beide Prisma-Clients (Postgres + SQLite).
 * SQLite-Schema verlangt zur CLI-Zeit eine `file:`-DATABASE_URL — daher kurz Dummy-Datei.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const backendRoot = path.join(__dirname, '..');
const dummySqlite = path.join(backendRoot, '.prisma-generate-dummy.sqlite');

try {
  fs.closeSync(fs.openSync(dummySqlite, 'a'));
} catch {
  /* ignore */
}

const dummyUrl = pathToFileURL(dummySqlite).href;
const envPg = { ...process.env };
const envSql = { ...process.env, DATABASE_URL: dummyUrl };

execSync('npx prisma generate', { cwd: backendRoot, stdio: 'inherit', env: envPg });
execSync('npx prisma generate --schema=prisma/sqlite/schema.prisma', {
  cwd: backendRoot,
  stdio: 'inherit',
  env: envSql,
});
