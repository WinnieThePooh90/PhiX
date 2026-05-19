const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function pgCtlPath(pgBin) {
  return path.join(pgBin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
}

function dockerCmd() {
  return process.platform === 'win32' ? 'docker.exe' : 'docker';
}

function composeProjectName() {
  return process.env.COMPOSE_PROJECT_NAME || process.env.PHIX_COMPOSE_PROJECT_NAME || 'phix';
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

function composeBaseArgs(composeFile) {
  const args = ['compose', '-p', composeProjectName(), '-f', composeFile];
  return args;
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
  const cmd = dockerCmd();

  try {
    await execFileAsync(cmd, [...composeBaseArgs(composeFile), 'stop', 'db'], {
      cwd: composeDir,
      timeout: 60000,
      env: process.env,
    });
    console.log('[shutdown] PostgreSQL-Container (docker compose db) gestoppt.');
  } catch (err) {
    console.warn('[shutdown] docker compose stop db:', err.message || err);
  }
}

/**
 * Stack per Docker Compose beenden.
 * „down“ darf nicht synchron im Backend-Container laufen: Compose stoppt dabei
 * zuerst den Backend-Container und bricht ab – oft bleibt nur phix-db-1 laufen.
 */
async function stopDockerComposeStack() {
  const composeDir = resolveComposeDir();
  if (!composeDir) {
    console.warn('[shutdown] Kein docker-compose.yml – Docker-Stack nicht gestoppt.');
    return false;
  }

  const composeFile = path.join(composeDir, 'docker-compose.yml');
  const cmd = dockerCmd();
  const base = composeBaseArgs(composeFile).join(' ');
  const downLine = `${cmd} ${base} down --remove-orphans`;

  // DB und Frontend zuerst (dieser Prozess läuft noch im Backend-Container).
  try {
    await execFileAsync(
      cmd,
      [...composeBaseArgs(composeFile), 'stop', 'db', 'frontend'],
      { cwd: composeDir, timeout: 60000, env: process.env },
    );
    console.log('[shutdown] db und frontend gestoppt.');
  } catch (err) {
    console.warn('[shutdown] docker compose stop db frontend:', err.message || err);
  }

  // Backend im Hintergrund mit stoppen/down (dieser Prozess darf nicht synchron „down“ ausführen).
  const shellScript =
    `sleep 1 && ${cmd} ${base} stop backend db frontend 2>/dev/null; ${downLine}`;

  return new Promise((resolve) => {
    try {
      const child = spawn('sh', ['-c', shellScript], {
        detached: true,
        stdio: 'ignore',
        cwd: composeDir,
        env: process.env,
      });
      child.unref();
      console.log('[shutdown] docker compose down (Hintergrund) gestartet.');
      resolve(true);
    } catch (err) {
      console.warn('[shutdown] Hintergrund-down:', err.message || err);
      resolve(false);
    }
  });
}

/** Verhindert Restart-Schleife, falls der Service noch restart: unless-stopped hat. */
async function preventBackendRestartLoop() {
  const containerId = process.env.HOSTNAME;
  if (!containerId) return;
  try {
    await execFileAsync(dockerCmd(), ['update', '--restart=no', containerId], {
      timeout: 10000,
    });
    console.log('[shutdown] Auto-Restart für Backend deaktiviert.');
  } catch (err) {
    console.warn('[shutdown] docker update --restart=no:', err.message || err);
  }
}

/** Container sauber stoppen statt nur process.exit (sonst startet Docker ihn neu). */
async function stopOwnContainer() {
  const containerId = process.env.HOSTNAME;
  if (!containerId) {
    setTimeout(() => process.exit(0), 300);
    return;
  }
  try {
    await execFileAsync(dockerCmd(), ['stop', '-t', '3', containerId], { timeout: 20000 });
  } catch (err) {
    console.warn('[shutdown] docker stop (self):', err.message || err);
    setTimeout(() => process.exit(0), 300);
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

  await stopEmbeddedPostgres();

  let composeDownOk = true;
  if (fullDockerShutdown) {
    composeDownOk = await stopDockerComposeStack();
  } else {
    await stopDockerComposeDb();
  }

  if (fullDockerShutdown) {
    if (!composeDownOk) {
      console.error('[shutdown] Hintergrund-down nicht gestartet – stoppe Backend trotzdem.');
    }
    await preventBackendRestartLoop();
    await stopOwnContainer();
    return;
  }

  setTimeout(() => process.exit(0), 300);
}

module.exports = { shutdownPhix };
