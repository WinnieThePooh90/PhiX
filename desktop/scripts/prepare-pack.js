/**
 * Vor electron-builder: Frontend bauen (falls nötig) und Pack-Voraussetzungen prüfen.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const desktopRoot = path.join(__dirname, '..');
const repoRoot = path.join(desktopRoot, '..');
const appDir = path.join(repoRoot, 'Notenauswertung-App');
const distIndex = path.join(appDir, 'dist', 'index.html');

function run(cmd, cwd) {
  console.log(`[prepare-pack] ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
}

if (!fs.existsSync(distIndex)) {
  console.log('[prepare-pack] Frontend dist fehlt — baue Notenauswertung-App …');
  if (!fs.existsSync(path.join(appDir, 'node_modules'))) {
    run('npm ci', appDir);
  }
  run('npm run build', appDir);
}

if (!fs.existsSync(distIndex)) {
  console.error('[prepare-pack] FEHLER: dist/index.html fehlt nach build.');
  process.exit(1);
}

console.log('[prepare-pack] Frontend OK:', path.join(appDir, 'dist'));
