'use strict';

const path = require('path');
const fs = require('fs');

function packBackendDir() {
  const marker = path.join(__dirname, '.pack-backend-from.json');
  if (fs.existsSync(marker)) {
    const { path: staged } = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (staged && fs.existsSync(path.join(staged, 'phix_deps', 'prisma', 'build', 'index.js'))) {
      return staged;
    }
    console.warn('[electron-builder] Staging-Marker ungültig — Fallback ../backend');
  } else {
    console.warn('[electron-builder] Kein Staging — bitte zuerst: npm run stage-backend');
  }
  return path.join(__dirname, '..', 'backend');
}

const packBackend = packBackendDir();

/** @type {import('electron-builder').Configuration} */
module.exports = {
  ...require('./package.json').build,
  extraResources: [
    {
      from: packBackend,
      to: 'backend',
      filter: ['**/*', '!.env', '!**/.env', '!node_modules/**', '!node_modules'],
    },
    {
      from: path.join(__dirname, '..', 'Notenauswertung-App', 'dist'),
      to: 'frontend-dist',
      filter: ['**/*'],
    },
  ],
};
