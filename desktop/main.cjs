/**
 * Electron-Main: startet das Backend (backend/server.js) und öffnet ein Fenster.
 */
const { app, BrowserWindow, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const APP_ICON = path.join(__dirname, 'build', 'icon.png');

/** Verzeichnis der gestarteten PhiX.exe (ZIP entpackt / Portable) — Daten bleiben auf dem Stick. */
function resolveInstallRoot() {
  return path.dirname(process.execPath);
}

function resolvePhiXUserDataDir() {
  const fromEnv = String(process.env.PHI_X_USERDATA_DIR || '').trim();
  if (fromEnv) return fromEnv;
  if (app.isPackaged) {
    return path.join(resolveInstallRoot(), 'data');
  }
  return path.join(app.getPath('appData'), 'PhiX');
}

let PHI_X_USERDATA;
let LOG_DIR;
/** @type {Error | null} */
let userDataInitError = null;

function initPhiXUserDataPaths() {
  PHI_X_USERDATA = resolvePhiXUserDataDir();
  LOG_DIR = path.join(PHI_X_USERDATA, 'logs');
  try {
    fs.mkdirSync(PHI_X_USERDATA, { recursive: true });
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const probe = path.join(PHI_X_USERDATA, '.write-test');
    fs.writeFileSync(probe, '', 'utf8');
    fs.unlinkSync(probe);
    app.setPath('userData', PHI_X_USERDATA);
  } catch (err) {
    userDataInitError = err instanceof Error ? err : new Error(String(err));
  }
}

initPhiXUserDataPaths();

function formatUserDataInitError(err) {
  const dir = PHI_X_USERDATA || resolvePhiXUserDataDir();
  const detail = err?.message || String(err);
  const portableHint = app.isPackaged
    ? '\n\nPhiX bitte in einen beschreibbaren Ordner entpacken (z. B. USB-Stick, Desktop) — nicht unter „Program Files“.'
    : '';
  return `Datenordner nicht nutzbar:\n${dir}\n\n${detail}${portableHint}`;
}

function resolveBackendDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend');
  }
  return path.join(__dirname, '..', 'backend');
}

const BACKEND_DIR = resolveBackendDir();

let backendProc = null;
let mainWindow = null;
let backendLogFd = null;
let appReady = false;

function logPath(name) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(LOG_DIR, `${name}-${stamp}.log`);
}

function writeDesktopLog(line) {
  try {
    const p = path.join(LOG_DIR, 'desktop.log');
    fs.appendFileSync(p, `${new Date().toISOString()} ${line}\n`, 'utf8');
  } catch (err) {
    try {
      const fallback = path.join(PHI_X_USERDATA, 'desktop-fallback.log');
      fs.appendFileSync(
        fallback,
        `${new Date().toISOString()} [desktop.log nicht schreibbar: ${err?.message || err}]\n${line}\n`,
        'utf8',
      );
    } catch {
      /* ignorieren */
    }
  }
}

/** Eigene Datei pro Startfehler — auch wenn nur der Log-Ordner geöffnet wird. */
function writeStartupErrorLog(title, message, extra = '') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(LOG_DIR, `startup-error-${stamp}.log`);
  const body = [
    title,
    new Date().toISOString(),
    '',
    message,
    extra ? `\n${extra}` : '',
    '',
    `Backend: ${BACKEND_DIR}`,
    `Log-Ordner: ${LOG_DIR}`,
    `desktop.log: ${path.join(LOG_DIR, 'desktop.log')}`,
  ].join('\n');
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(file, body, 'utf8');
    writeDesktopLog(`${title}: ${message}`);
    return file;
  } catch (err) {
    writeDesktopLog(`${title}: ${message} (startup-error nicht schreibbar: ${err?.message || err})`);
    return null;
  }
}

function showFatal(title, message, startupLogFile = null) {
  const logHint = startupLogFile
    ? `Details: ${startupLogFile}\nAuch: ${path.join(LOG_DIR, 'desktop.log')}`
    : `desktop.log: ${path.join(LOG_DIR, 'desktop.log')}\nOrdner: ${LOG_DIR}`;
  writeDesktopLog(`${title}: ${message}`);
  try {
    if (app.isReady()) {
      dialog.showErrorBox(title, `${message}\n\n${logHint}`);
    }
  } catch {
    /* vor app.ready */
  }
}

function backendPort() {
  return String(process.env.PORT || '3000').trim() || '3000';
}

function preparePackagedBackendModules() {
  if (!app.isPackaged) return;
  const { ensureBackendModuleLink } = require(path.join(BACKEND_DIR, 'lib', 'deps-root'));
  const r = ensureBackendModuleLink(BACKEND_DIR);
  if (!r.ok) {
    throw new Error(
      `node_modules-Verknuepfung zu phix_deps fehlgeschlagen: ${r.error?.message || r.error}`,
    );
  }
  writeDesktopLog(`Backend-Module: ${path.join(BACKEND_DIR, 'node_modules')} -> phix_deps`);
}

function backendDepsRoot() {
  const { resolveDepsRoot } = require(path.join(BACKEND_DIR, 'lib', 'deps-root'));
  return resolveDepsRoot(BACKEND_DIR);
}

function buildBackendEnv() {
  const env = {
    ...process.env,
    PORT: backendPort(),
    PHI_X_USERDATA_DIR: PHI_X_USERDATA,
  };
  const depsRoot = backendDepsRoot();
  if (fs.existsSync(depsRoot)) {
    const sep = path.delimiter;
    env.NODE_PATH = env.NODE_PATH ? `${depsRoot}${sep}${env.NODE_PATH}` : depsRoot;
  }
  if (!String(env.DATABASE_URL || '').trim()) {
    const dbPath = path.join(PHI_X_USERDATA, 'phix.db');
    const { toSqliteDatabaseUrl } = require(path.join(BACKEND_DIR, 'lib', 'sqlite-database-url'));
    env.DATABASE_URL = toSqliteDatabaseUrl(dbPath);
    writeDesktopLog(`DATABASE_URL (SQLite): ${env.DATABASE_URL}`);
  }
  if (app.isPackaged) {
    env.PHIX_STANDALONE = '1';
    env.PHIX_SKIP_DB_PUSH = '1';
    const frontendDist = path.join(process.resourcesPath, 'frontend-dist');
    if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
      env.PHIX_FRONTEND_DIST = frontendDist;
    }
  }
  return env;
}

/** Prisma db push vor server.js — vermeidet doppelten Push und nutzt dieselbe Node/Electron-Startart. */
function ensureDbSchema() {
  const launch = resolveBackendLaunch();
  const baseEnv = buildBackendEnv();
  const { runDbSync } = require(path.join(BACKEND_DIR, 'lib', 'db-push'));

  const { resolvePrismaCli } = require(path.join(BACKEND_DIR, 'lib', 'deps-root'));
  const prismaCli = resolvePrismaCli(BACKEND_DIR);
  const depsRoot = backendDepsRoot();
  writeDesktopLog(`Prisma db push … (${launch.cmd}) backend=${BACKEND_DIR} deps=${depsRoot}`);

  if (!fs.existsSync(prismaCli)) {
    const msg = `[db-push] Prisma CLI fehlt: ${prismaCli}`;
    throw new Error(
      `${msg}\nHinweis: cd desktop && npm run dist (stage-backend erzeugt phix_deps; electron-builder kopiert kein node_modules).`,
    );
  }

  const r = runDbSync({
    backendRoot: BACKEND_DIR,
    nodeCmd: launch.cmd,
    extraEnv: { ...baseEnv, ...launch.extraEnv },
    electronAsNode: Boolean(launch.extraEnv.ELECTRON_RUN_AS_NODE),
    stdio: 'pipe',
  });

  if (r.stdout && r.stdout.length) {
    writeDesktopLog(`[db-push stdout]\n${r.stdout.toString().slice(-3000)}`);
  }
  if (r.stderr && r.stderr.length) {
    writeDesktopLog(`[db-push stderr]\n${r.stderr.toString().slice(-3000)}`);
  }
  if (r.error) {
    throw new Error(`prisma db push: ${r.error.message}`);
  }
  if (r.status !== 0 && r.status != null) {
    const tail = (r.stderr && r.stderr.length ? r.stderr : r.stdout || Buffer.alloc(0)).toString().slice(-2000);
    throw new Error(
      `prisma db push fehlgeschlagen (Exit-Code ${r.status}).${tail ? `\n${tail}` : ''}`,
    );
  }
  writeDesktopLog('Prisma db push OK');
}

function readLatestBackendLogTail(maxChars = 2800) {
  try {
    const files = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.startsWith('backend-') && f.endsWith('.log'))
      .sort();
    if (!files.length) return '';
    const text = fs.readFileSync(path.join(LOG_DIR, files[files.length - 1]), 'utf8');
    return text.length > maxChars ? text.slice(-maxChars) : text;
  } catch {
    return '';
  }
}

/** Gepackt: Electron als Node (kein separates node.exe nötig), sonst node.exe oder PATH-node. */
function resolveBackendLaunch() {
  const serverJs = path.join(BACKEND_DIR, 'server.js');
  if (!fs.existsSync(serverJs)) {
    throw new Error(`Backend fehlt im Paket: ${serverJs}`);
  }

  const bundledWin = path.join(process.resourcesPath, 'node', 'node.exe');
  const bundledNix = path.join(process.resourcesPath, 'node', 'bin', 'node');

  if (app.isPackaged && process.platform === 'win32' && fs.existsSync(bundledWin)) {
    return { cmd: bundledWin, args: [serverJs], extraEnv: {} };
  }
  if (app.isPackaged && fs.existsSync(bundledNix)) {
    return { cmd: bundledNix, args: [serverJs], extraEnv: {} };
  }
  if (app.isPackaged) {
    return {
      cmd: process.execPath,
      args: [serverJs],
      extraEnv: { ELECTRON_RUN_AS_NODE: '1' },
    };
  }
  return { cmd: process.platform === 'win32' ? 'node' : 'node', args: ['server.js'], extraEnv: {} };
}

function openBackendLogFd() {
  try {
    const file = logPath('backend');
    writeDesktopLog(`Backend-Log: ${file}`);
    return fs.openSync(file, 'a');
  } catch (err) {
    writeDesktopLog(`Backend-Log nicht öffnenbar: ${err?.message || err}`);
    return null;
  }
}

function closeBackendLogFd() {
  if (backendLogFd == null) return;
  try {
    fs.closeSync(backendLogFd);
  } catch {
    /* ignorieren */
  }
  backendLogFd = null;
}

function startBackend() {
  const { cmd, args, extraEnv } = resolveBackendLaunch();
  const env = { ...buildBackendEnv(), ...extraEnv };

  writeDesktopLog(`Backend start: ${cmd} ${args.join(' ')} cwd=${BACKEND_DIR}`);

  closeBackendLogFd();
  if (app.isPackaged) {
    backendLogFd = openBackendLogFd();
  }

  /** spawn erlaubt keine WriteStream-Objekte — nur fd-Zahl, Pipe oder 'ignore'/'inherit'. */
  const stdio =
    app.isPackaged && backendLogFd != null
      ? ['ignore', backendLogFd, backendLogFd]
      : app.isPackaged
        ? 'ignore'
        : 'inherit';

  backendProc = spawn(cmd, args, {
    cwd: BACKEND_DIR,
    env,
    stdio,
    windowsHide: app.isPackaged,
    shell: false,
  });

  backendProc.on('error', (err) => {
    const msg = `Backend-Prozess konnte nicht gestartet werden (${cmd}): ${err.message}`;
    writeDesktopLog(msg);
    if (!mainWindow) {
      showFatal('PhiX - Startfehler', msg);
      app.quit();
    }
  });

  backendProc.on('exit', (code, signal) => {
    backendProc = null;
    closeBackendLogFd();
    const msg = `Backend beendet (code=${code}, signal=${signal || '—'})`;
    writeDesktopLog(msg);
    if (code != null && code !== 0) {
      const tail = readLatestBackendLogTail();
      const detail = tail ? `\n\n--- Backend-Log (Auszug) ---\n${tail}` : `\n\nLog-Ordner: ${LOG_DIR}`;
      showFatal('PhiX - Backend abgestuerzt', `${msg}${detail}`);
      app.quit();
    }
  });
}

async function waitForBackend(baseUrl, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  const ping = `${baseUrl.replace(/\/+$/, '')}/api/auth/session`;
  while (Date.now() < deadline) {
    if (!backendProc) {
      throw new Error('Backend-Prozess ist vorzeitig beendet worden.');
    }
    try {
      const r = await fetch(ping, { method: 'GET', headers: { 'X-Acting-User': '__electron_ping__' } });
      if (r.status === 401 || r.status === 200) return;
    } catch {
      /* noch nicht erreichbar */
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Backend unter ${baseUrl} nicht erreichbar (Timeout ${timeoutMs / 1000}s). Log: ${LOG_DIR}`);
}

function killBackend() {
  if (!backendProc || backendProc.killed) return;
  try {
    if (process.platform === 'win32') {
      backendProc.kill();
    } else {
      backendProc.kill('SIGTERM');
    }
  } catch (err) {
    console.warn('[desktop] Backend stop:', err?.message || err);
  }
  backendProc = null;
  closeBackendLogFd();
}

async function createWindow() {
  const port = backendPort();
  const apiBase = `http://127.0.0.1:${port}`;
  if (app.isPackaged) {
    preparePackagedBackendModules();
    ensureDbSchema();
  }
  startBackend();
  await waitForBackend(apiBase);

  const devServer = String(process.env.ELECTRON_DEV_SERVER || '').trim();
  const loadURL = devServer || apiBase;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    autoHideMenuBar: true,
    ...(fs.existsSync(APP_ICON) ? { icon: APP_ICON } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  // Keine File/Edit/View/Window-Leiste (Windows/Linux); unter macOS kein App-Menü in der Menüleiste.
  Menu.setApplicationMenu(null);
  mainWindow.setMenu(null);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(loadURL);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (userDataInitError) {
    showFatal('PhiX - Datenordner', formatUserDataInitError(userDataInitError));
    app.quit();
    return;
  }
  appReady = true;
  createWindow().catch((err) => {
    const msg = err?.message || String(err);
    const stack = err?.stack ? `\n${err.stack}` : '';
    const startupLog = writeStartupErrorLog('PhiX - Startfehler', msg, stack);
    showFatal('PhiX - Startfehler', msg, startupLog);
    killBackend();
    app.quit();
  });
});

app.on('window-all-closed', () => {
  killBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  killBackend();
});
