const { spawnSync } = require('child_process');
const path = require('path');
const { isSqliteUrl } = require('./prisma-factory');

/**
 * Führt `prisma db push` für das passende Schema aus (Postgres vs. SQLite).
 */
function runDbPush() {
  const backendRoot = path.join(__dirname, '..');
  const url = process.env.DATABASE_URL || '';
  const schemaAbs = isSqliteUrl(url)
    ? path.join(backendRoot, 'prisma', 'sqlite', 'schema.prisma')
    : path.join(backendRoot, 'prisma', 'schema.prisma');
  const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
  const r = spawnSync(process.execPath, [prismaCli, 'db', 'push', `--schema=${schemaAbs}`], {
    stdio: 'inherit',
    cwd: backendRoot,
    env: process.env,
  });
  if (r.status !== 0 && r.status != null) {
    process.exit(r.status);
  }
  if (r.error) {
    console.error('[db-push]', r.error);
    process.exit(1);
  }
}

module.exports = { runDbPush };
