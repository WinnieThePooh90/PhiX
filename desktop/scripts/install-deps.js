/**
 * npm install mit Cache außerhalb des Projektordners (hilft bei Dropbox: EBUSY / gesperrte .electron-*).
 * Aufruf: npm run install-deps   oder   node scripts/install-deps.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const desktopRoot = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const local = process.env.LOCALAPPDATA;
const cacheBase =
  isWin && local
    ? path.join(local, 'PhiX')
    : path.join(os.homedir(), '.cache', 'phix');

const electronCache = path.join(cacheBase, 'electron-cache');
const npmCache = path.join(cacheBase, 'npm-cache');
fs.mkdirSync(electronCache, { recursive: true });
fs.mkdirSync(npmCache, { recursive: true });

if (!process.env.ELECTRON_CACHE) process.env.ELECTRON_CACHE = electronCache;
if (!process.env.npm_config_cache) process.env.npm_config_cache = npmCache;

console.log('[desktop/install-deps] ELECTRON_CACHE=' + process.env.ELECTRON_CACHE);
console.log('[desktop/install-deps] npm_config_cache=' + process.env.npm_config_cache);

const extra = process.argv.slice(2);
const args = ['install', ...extra];
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const r = spawnSync(npmCmd, args, {
  cwd: desktopRoot,
  stdio: 'inherit',
  env: process.env,
  shell: isWin,
});
process.exit(r.status === null ? 1 : r.status);
