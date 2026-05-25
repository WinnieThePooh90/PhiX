const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { isSqliteUrl } = require('./prisma-factory');
const { resolvePrismaCli } = require('./deps-root');

/**
 * Prüft ob die _prisma_migrations-Tabelle in der PostgreSQL-DB existiert.
 * Falls nicht (weil die DB bisher mit `db push` verwaltet wurde), werden alle
 * vorhandenen Migrationen als "bereits angewandt" markiert (Baseline).
 */
function baselineIfNeeded(opts) {
  const { backendRoot, prismaCli, schemaAbs, nodeCmd, env, stdio } = opts;
  const migrationsDir = path.join(backendRoot, 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const r = spawnSync(nodeCmd, [prismaCli, 'migrate', 'status', `--schema=${schemaAbs}`], {
    stdio: 'pipe',
    cwd: backendRoot,
    env,
    shell: false,
    windowsHide: true,
  });

  const output = [r.stdout, r.stderr].filter(Boolean).map((b) => b.toString()).join('\n');

  const needsBaseline =
    output.includes('Database schema is not empty') ||
    output.includes('no migration table') ||
    output.includes('_prisma_migrations') && output.includes('does not exist');

  if (!needsBaseline) return;

  console.log('[db-sync] Baseline: DB existiert bereits ohne Migration-Tracking. Markiere vorhandene Migrationen…');

  const dirs = fs.readdirSync(migrationsDir).filter((d) => {
    return fs.statSync(path.join(migrationsDir, d)).isDirectory();
  }).sort();

  for (const migName of dirs) {
    const resolveResult = spawnSync(
      nodeCmd,
      [prismaCli, 'migrate', 'resolve', '--applied', migName, `--schema=${schemaAbs}`],
      { stdio, cwd: backendRoot, env, shell: false, windowsHide: true },
    );
    if (resolveResult.status !== 0) {
      console.error(`[db-sync] Baseline-Fehler bei Migration ${migName}`);
    }
  }
  console.log('[db-sync] Baseline abgeschlossen.');
}

/**
 * Synchronisiert das Datenbankschema beim Serverstart:
 * - PostgreSQL: `prisma migrate deploy` (inkrementelle Migrations, kein Datenverlust)
 * - SQLite:     `prisma db push` (kein _prisma_migrations-Tracking bei SQLite)
 *
 * @param {object} [opts]
 * @param {string} [opts.backendRoot]
 * @param {string} [opts.nodeCmd]
 * @param {object} [opts.extraEnv]
 * @param {'inherit'|'pipe'|object} [opts.stdio]
 * @returns {import('child_process').SpawnSyncReturns<string>}
 */
function runDbSync(opts = {}) {
  const backendRoot = opts.backendRoot || path.join(__dirname, '..');
  const url = String((opts.extraEnv && opts.extraEnv.DATABASE_URL) || process.env.DATABASE_URL || '');
  const sqlite = isSqliteUrl(url);

  const schemaAbs = sqlite
    ? path.join(backendRoot, 'prisma', 'sqlite', 'schema.prisma')
    : path.join(backendRoot, 'prisma', 'schema.prisma');
  const prismaCli = resolvePrismaCli(backendRoot);

  if (!fs.existsSync(prismaCli)) {
    const err = new Error(`[db-sync] Prisma CLI fehlt: ${prismaCli}`);
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

  if (sqlite) {
    console.log('[db-sync] db push (SQLite)');
    return spawnSync(nodeCmd, [prismaCli, 'db', 'push', `--schema=${schemaAbs}`], {
      stdio,
      cwd: backendRoot,
      env,
      shell: false,
      windowsHide: true,
    });
  }

  baselineIfNeeded({ backendRoot, prismaCli, schemaAbs, nodeCmd, env, stdio });

  console.log('[db-sync] migrate deploy (PostgreSQL)');
  return spawnSync(nodeCmd, [prismaCli, 'migrate', 'deploy', `--schema=${schemaAbs}`], {
    stdio,
    cwd: backendRoot,
    env,
    shell: false,
    windowsHide: true,
  });
}

/** Rückwärtskompatibel: SQLite-spezifischer Push (für Desktop/Electron). */
function runDbPush(opts = {}) {
  return runDbSync(opts);
}

/**
 * Wie runDbSync, beendet den Prozess bei Fehler (Server-Start).
 */
function runDbSyncOrExit(opts = {}) {
  const r = runDbSync(opts);
  if (r.error) {
    console.error('[db-sync]', r.error);
    process.exit(1);
  }
  if (r.status !== 0 && r.status != null) {
    if (r.stdout) console.error('[db-sync stdout]', r.stdout.toString());
    if (r.stderr) console.error('[db-sync stderr]', r.stderr.toString());
    process.exit(r.status);
  }
}

/** @deprecated Verwende runDbSyncOrExit */
function runDbPushOrExit(opts = {}) {
  return runDbSyncOrExit(opts);
}

module.exports = { runDbPush, runDbPushOrExit, runDbSync, runDbSyncOrExit };
