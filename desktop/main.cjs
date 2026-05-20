/**
 * Electron-Main: startet das Backend (backend/server.js) und öffnet ein Fenster.
 */
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

const PHI_X_USERDATA = path.join(app.getPath('appData'), 'PhiX');
const LOG_DIR = path.join(PHI_X_USERDATA, 'logs');

try {
  if (!fs.existsSync(PHI_X_USERDATA)) {
    fs.mkdirSync(PHI_X_USERDATA, { recursive: true });
  }
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch {
  /* ignorieren */
}
app.setPath('userData', PHI_X_USERDATA);

function resolveBackendDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend');
  }
  return path.join(__dirname, '..', 'backend');
}

const BACKEND_DIR = resolveBackendDir();

let backendProc = null;
let mainWindow = null;
let backendLogStream = null;
let appReady = false;

function logPath(name) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(LOG_DIR, `${name}-${stamp}.log`);
}

function writeDesktopLog(line) {
  try {
    const p = path.join(LOG_DIR, 'desktop.log');
    fs.appendFileSync(p, `${new Date().toISOString()} ${line}\n`, 'utf8');
  } catch {
    /* ignorieren */
  }
}

function showFatal(title, message) {
  writeDesktopLog(`${title}: ${message}`);
  try {
    if (app.isReady()) {
      dialog.showErrorBox(title, `${message}\n\nLog: ${LOG_DIR}`);
    }
  } catch {
    /* vor app.ready */
  }
}

function backendPort() {
  return String(process.env.PORT || '3000').trim() || '3000';
}

function buildBackendEnv() {
  const env = {
    ...process.env,
    APP_MODE: 'desktop',
    PORT: backendPort(),
    PHI_X_USERDATA_DIR: PHI_X_USERDATA,
  };
  if (!String(env.DATABASE_URL || '').trim()) {
    const dbPath = path.join(PHI_X_USERDATA, 'phix.db');
    env.DATABASE_URL = pathToFileURL(dbPath).href;
  }
  if (app.isPackaged) {
    env.PHIX_STANDALONE = '1';
    const frontendDist = path.join(process.resourcesPath, 'frontend-dist');
    if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
      env.PHIX_FRONTEND_DIST = frontendDist;
    }
  }
  return env;
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

function startBackend() {
  const { cmd, args, extraEnv } = resolveBackendLaunch();
  const env = { ...buildBackendEnv(), ...extraEnv };

  writeDesktopLog(`Backend start: ${cmd} ${args.join(' ')} cwd=${BACKEND_DIR}`);

  try {
    backendLogStream = fs.createWriteStream(logPath('backend'), { flags: 'a' });
  } catch {
    backendLogStream = null;
  }

  const stdio = app.isPackaged
    ? ['ignore', backendLogStream || 'ignore', backendLogStream || 'ignore']
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
      showFatal('PhiX – Startfehler', msg);
      app.quit();
    }
  });

  backendProc.on('exit', (code, signal) => {
    backendProc = null;
    if (backendLogStream) {
      backendLogStream.end();
      backendLogStream = null;
    }
    const msg = `Backend beendet (code=${code}, signal=${signal || '—'})`;
    writeDesktopLog(msg);
    if (code != null && code !== 0 && !mainWindow) {
      showFatal(
        'PhiX – Backend abgestürzt',
        `${msg}\nDetails: ${path.join(LOG_DIR, 'backend-*.log')} (neueste Datei)`,
      );
      app.quit();
    } else if (mainWindow && code != null && code !== 0) {
      showFatal('PhiX – Backend beendet', msg);
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
}

async function createWindow() {
  const port = backendPort();
  const apiBase = `http://127.0.0.1:${port}`;
  startBackend();
  await waitForBackend(apiBase);

  const devServer = String(process.env.ELECTRON_DEV_SERVER || '').trim();
  const loadURL = devServer || apiBase;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(loadURL);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  appReady = true;
  createWindow().catch((err) => {
    const msg = err?.message || String(err);
    writeDesktopLog(`createWindow: ${msg}`);
    showFatal('PhiX – Startfehler', msg);
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
