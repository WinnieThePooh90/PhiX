const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function pgCtlPath(pgBin) {
  return path.join(pgBin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
}

/** Repository-Root mit docker-compose.yml (Backend läuft aus …/backend). */
function defaultComposeDir() {
  const candidate = path.resolve(__dirname, '..', '..');
  const composeFile = path.join(candidate, 'docker-compose.yml');
  return fs.existsSync(composeFile) ? candidate : null;
}

function resolveComposeDir() {
  const fromEnv = process.env.PHIX_COMPOSE_DIR;
  if (fromEnv && fs.existsSync(path.join(fromEnv, 'docker-compose.yml'))) {
    return fromEnv;
  }
  return defaultComposeDir();
}

/** Portable Windows: mitgelieferte PostgreSQL-Instanz stoppen. */
async function stopEmbeddedPostgres() {
  const pgData = process.env.PHIX_PGDATA;
  const pgBin = process.env.PHIX_PGBIN;
  if (!pgData || !pgBin) return;

  const pgCtl = pgCtlPath(pgBin);
  try {
    await execFileAsync(pgCtl, ['-D', pgData, '-w', 'stop'], { timeout: 20000 });
    console.log('[shutdown] PostgreSQL (eingebettet) gestoppt.');
  } catch (err) {
    console.warn('[shutdown] PostgreSQL (eingebettet) stop:', err.message || err);
  }
}

/** Nur den db-Service stoppen (z. B. start_db_docker.bat / nativer Dev). */
async function stopDockerComposeDb() {
  const composeDir = resolveComposeDir();
  if (!composeDir) return;

  const composeFile = path.join(composeDir, 'docker-compose.yml');
  const dockerCmd = process.platform === 'win32' ? 'docker.exe' : 'docker';

  try {
    await execFileAsync(
      dockerCmd,
      ['compose', '-f', composeFile, 'stop', 'db'],
      { cwd: composeDir, timeout: 60000 },
    );
    console.log('[shutdown] PostgreSQL-Container (docker compose db) gestoppt.');
  } catch (err) {
    console.warn('[shutdown] docker compose stop db:', err.message || err);
  }
}

/** Docker Compose: gesamten Stack stoppen (Backend-Container mit Socket). */
async function stopDockerComposeStack() {
  const composeDir = resolveComposeDir();
  if (!composeDir) {
    console.warn('[shutdown] Kein docker-compose.yml – Docker-Stack nicht gestoppt.');
    return false;
  }

  const composeFile = path.join(composeDir, 'docker-compose.yml');
  const dockerCmd = process.platform === 'win32' ? 'docker.exe' : 'docker';
  const projectFromEnv = process.env.COMPOSE_PROJECT_NAME || process.env.PHIX_COMPOSE_PROJECT_NAME;
  const downArgs = ['compose'];
  if (projectFromEnv) {
    downArgs.push('-p', projectFromEnv);
  }
  downArgs.push('-f', composeFile, 'down', '--remove-orphans');

  try {
    await execFileAsync(dockerCmd, downArgs, {
      cwd: composeDir,
      timeout: 120000,
      env: process.env,
    });
    console.log('[shutdown] Docker Compose gestoppt.');
    return true;
  } catch (err) {
    console.warn('[shutdown] docker compose down:', err.message || err);
    return false;
  }
}

/**
 * @param {{ prisma?: import('@prisma/client').PrismaClient, server?: import('http').Server }} deps
 */
async function shutdownPhix(deps = {}) {
  const { prisma, server } = deps;
  const fullDockerShutdown = process.env.PHIX_DOCKER_SHUTDOWN === '1';

  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.warn('[shutdown] Prisma disconnect:', err.message || err);
    }
  }

  if (server) {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  // PostgreSQL: immer bestmöglich beenden (eingebettet +/oder Docker-DB).
  await stopEmbeddedPostgres();
  let composeDownOk = true;
  if (fullDockerShutdown) {
    composeDownOk = await stopDockerComposeStack();
  } else {
    await stopDockerComposeDb();
  }

  // Bei Docker-Shutdown: compose down muss greifen. Sonst beendet sich nur Node,
  // und restart:unless-stopped startet den Backend-Container sofort wieder.
  if (fullDockerShutdown && !composeDownOk) {
    console.error('[shutdown] Abbruch: Stack nicht gestoppt (siehe Logs oben).');
    process.exit(1);
    return;
  }

  setTimeout(() => process.exit(0), 200);
}

module.exports = { shutdownPhix };
