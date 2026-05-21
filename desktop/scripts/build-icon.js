/**
 * Erzeugt desktop/build/icon.png aus dem Web-Tab-Favicon (Notenauswertung-App/public/favicon.svg).
 * electron-builder wandelt die PNG für Windows in .ico um.
 */
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const svgPath = path.resolve(__dirname, '../../Notenauswertung-App/public/favicon.svg');
const outDir = path.resolve(__dirname, '../build');
const outPng = path.join(outDir, 'icon.png');

if (!fs.existsSync(svgPath)) {
  console.error('Favicon fehlt:', svgPath);
  process.exit(1);
}

const svg = fs.readFileSync(svgPath, 'utf8');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 256 },
});
const png = resvg.render().asPng();

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPng, png);
console.log('Icon erzeugt:', outPng);
