/**
 * Electron-Main: startet das Backend (backend/server.js) und öffnet ein Fenster.
 *
 * Dev: Vite separat starten (Port 5173), dann `npm run dev` hier — lädt ELECTRON_DEV_SERVER.
 * Ohne Dev-URL: lädt http://127.0.0.1:<PORT> (Backend muss gebautes Frontend ausliefern, z. B. PHIX_STANDALONE=1).
 *
 * Gepackt (npm run pack): Backend liegt unter process.resourcesPath/backend/; Node optional
 * unter process.resourcesPath/node/ (siehe README).
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

/** %APPDATA%/PhiX (Windows) — Logs, später SQLite-Datei; vor app.ready setzen */
const PHI_X_USERDATA = path.join(app.getPath('appData'), 'PhiX');
try {
  if (!fs.existsSync(PHI_X_USERDATA)) {
    fs.mkdirSync(PHI_X_USERDATA, { recursive: true });
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

function resolveNodeExecutable() {
  const bundledWin = path.join(process.resourcesPath, 'node', 'node.exe');
  const bundledNix = path.join(process.resourcesPath, 'node', 'bin', 'node');
  if (process.platform === 'win32' && fs.existsSync(bundledWin)) {
    return bundledWin;
  }
  if (fs.existsSync(bundledNix)) {
    return bundledNix;
  }
  return process.platform === 'win32' ? 'node' : 'node';
}

const BACKEND_DIR = resolveBackendDir();

let backendProc = null;
let mainWindow = null;

function backendPort() {
  return String(process.env.PORT || '3000').trim() || '3000';
}

function startBackend() {
  const nodeCmd = resolveNodeExecutable();
  const env = {
    ...process.env,
    APP_MODE: 'desktop',
    PORT: backendPort(),
    /** Log-Datei optional im User-Data-Ordner (Backend kann später nutzen) */
    PHI_X_USERDATA_DIR: PHI_X_USERDATA,
  };
  if (!String(env.DATABASE_URL || '').trim()) {
    const dbPath = path.join(PHI_X_USERDATA, 'phix.db');
    env.DATABASE_URL = pathToFileURL(dbPath).href;
  }
  backendProc = spawn(nodeCmd, ['server.js'], {
    cwd: BACKEND_DIR,
    env,
    stdio: 'inherit',
    windowsHide: false,
  });
  backendProc.on('exit', (code, signal) => {
    backendProc = null;
    if (code != null && code !== 0) {
      console.error(`[desktop] Backend beendet mit Code ${code}`);
    }
    if (signal) {
      console.error(`[desktop] Backend beendet durch Signal ${signal}`);
    }
  });
}

async function waitForBackend(baseUrl, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  const ping = `${baseUrl.replace(/\/+$/, '')}/api/auth/session`;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(ping, { method: 'GET', headers: { 'X-Acting-User': '__electron_ping__' } });
      if (r.status === 401 || r.status === 200) return;
    } catch {
      /* noch nicht erreichbar */
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Backend unter ${baseUrl} nicht erreichbar (Timeout ${timeoutMs} ms).`);
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  await mainWindow.loadURL(loadURL);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error('[desktop]', err);
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
