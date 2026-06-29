/**
 * Kopiert desktop/build/icon.png aus Notenauswertung-App/public.
 * electron-builder wandelt die PNG für Windows in .ico um.
 */
const fs = require('fs');
const path = require('path');

const srcPng = path.resolve(__dirname, '../../Notenauswertung-App/public/android-chrome-512x512.png');
const outDir = path.resolve(__dirname, '../build');
const outPng = path.join(outDir, 'icon.png');

if (!fs.existsSync(srcPng)) {
  console.error('PhiX-Icon fehlt:', srcPng);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(srcPng, outPng);
console.log('Icon erzeugt:', outPng);
