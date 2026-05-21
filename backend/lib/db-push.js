const { spawnSync } = require('child_process');
const path = require('path');
const { isSqliteUrl } = require('./prisma-factory');
const { resolvePrismaCli } = require('./deps-root');

/**
 * Führt `prisma db push` für das passende Schema aus (Postgres vs. SQLite).
 * @param {object} [opts]
 * @param {string} [opts.backendRoot]
 * @param {string} [opts.nodeCmd] — Standard: process.execPath (bei Electron: PhiX.exe + ELECTRON_RUN_AS_NODE)
 * @param {object} [opts.extraEnv]
 * @param {'inherit'|'pipe'|object} [opts.stdio]
 * @returns {import('child_process').SpawnSyncReturns<string>}
 */
function runDbPush(opts = {}) {
  const backendRoot = opts.backendRoot || path.join(__dirname, '..');
  const url = String((opts.extraEnv && opts.extraEnv.DATABASE_URL) || process.env.DATABASE_URL || '');
  const schemaAbs = isSqliteUrl(url)
    ? path.join(backendRoot, 'prisma', 'sqlite', 'schema.prisma')
    : path.join(backendRoot, 'prisma', 'schema.prisma');
  const prismaCli = resolvePrismaCli(backendRoot);

  if (!require('fs').existsSync(prismaCli)) {
    const err = new Error(`[db-push] Prisma CLI fehlt: ${prismaCli}`);
    err.code = 'ENOENT';
    return { error: err, status: null, signal: null, stdout: null, stderr: null };
  }

  const env = { ...process.env, ...(opts.extraEnv || {}) };
  const useElectronAsNode =
    opts.electronAsNode === true ||
    env.ELECTRON_RUN_AS_NODE === '1' ||
    Boolean(process.versions && process.versions.electron);
  if (useElectronAsNode) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  const nodeCmd = opts.nodeCmd || process.execPath;
  const stdio = opts.stdio ?? 'inherit';

  return spawnSync(nodeCmd, [prismaCli, 'db', 'push', `--schema=${schemaAbs}`], {
    stdio,
    cwd: backendRoot,
    env,
    shell: false,
    windowsHide: true,
  });
}

/**
 * Wie runDbPush, beendet den Prozess bei Fehler (Server-Start).
 */
function runDbPushOrExit(opts = {}) {
  const r = runDbPush(opts);
  if (r.error) {
    console.error('[db-push]', r.error);
    process.exit(1);
  }
  if (r.status !== 0 && r.status != null) {
    if (r.stdout) console.error('[db-push stdout]', r.stdout.toString());
    if (r.stderr) console.error('[db-push stderr]', r.stderr.toString());
    process.exit(r.status);
  }
}

module.exports = { runDbPush, runDbPushOrExit };
