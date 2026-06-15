#!/usr/bin/env node
/**
 * Liest LICENSE-Dateien aus node_modules und schreibt src/data/dependencyPackageLicenses.js.
 * Ausführen nach npm install (Frontend + Backend), wenn sich Abhängigkeiten ändern:
 *   node scripts/extract-dependency-licenses.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import appPkg from '../package.json' with { type: 'json' };
import backendPkg from '../src/data/backend-package.snapshot.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const feModules = path.join(appRoot, 'node_modules');
const beModules = path.join(repoRoot, 'backend', 'node_modules');

const PACKAGE_NAMES = [
  ...Object.keys(appPkg.dependencies ?? {}),
  ...Object.keys(appPkg.devDependencies ?? {}),
  ...Object.keys(backendPkg.dependencies ?? {}),
  ...Object.keys(backendPkg.devDependencies ?? {}),
].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

function resolvePkgDir(name) {
  for (const root of [feModules, beModules]) {
    const dir = path.join(root, name);
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  }
  return null;
}

function readLicenseFile(dir) {
  const candidates = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'License'];
  for (const file of candidates) {
    const full = path.join(dir, file);
    if (fs.existsSync(full)) return { file, text: fs.readFileSync(full, 'utf8').trim() };
  }
  return null;
}

function trimViteCoreLicense(text) {
  const marker = '\n# Licenses of bundled dependencies';
  const idx = text.indexOf(marker);
  if (idx >= 0) return text.slice(0, idx).trim();
  return text.trim();
}

function extractLicenseText(name, dir) {
  const raw = readLicenseFile(dir);
  if (!raw) return null;
  if (name === 'vite') return trimViteCoreLicense(raw.text);
  return raw.text;
}

async function fetchUnpkgLicense(name) {
  let version = 'latest';
  for (const root of [feModules, beModules]) {
    try {
      const pkgJson = JSON.parse(await fs.promises.readFile(path.join(root, name, 'package.json'), 'utf8'));
      if (pkgJson.version) {
        version = pkgJson.version;
        break;
      }
    } catch {
      /* try next root */
    }
  }
  if (version === 'latest') {
    try {
      const res = await fetch(`https://registry.npmjs.org/${name}/latest`);
      if (res.ok) version = (await res.json()).version;
    } catch {
      /* ignore */
    }
  }
  const enc = encodeURIComponent(name);
  for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license']) {
    try {
      const res = await fetch(`https://unpkg.com/${enc}@${version}/${file}`);
      if (res.ok) {
        let text = (await res.text()).trim();
        if (name === 'vite') text = trimViteCoreLicense(text);
        return text;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function main() {
const texts = {};
const missing = [];

for (const name of PACKAGE_NAMES) {
  const dir = resolvePkgDir(name);
  let text = dir ? extractLicenseText(name, dir) : null;
  if (!text) text = await fetchUnpkgLicense(name);
  if (!text) {
    missing.push(name);
    continue;
  }
  texts[name] = text;
}

if (missing.length) {
  console.warn('[extract-dependency-licenses] Keine LICENSE-Datei gefunden für:', missing.join(', '));
}

const outPath = path.join(appRoot, 'src/data/dependencyPackageLicenses.js');
const body = `/** Automatisch aus node_modules/LICENSE extrahiert — scripts/extract-dependency-licenses.mjs */\nexport const PACKAGE_LICENSE_TEXTS = ${JSON.stringify(texts, null, 2)};\n\nexport function getPackageLicenseText(packageName) {\n  const key = String(packageName ?? '').trim();\n  if (!key) return null;\n  return PACKAGE_LICENSE_TEXTS[key] ?? null;\n}\n`;

fs.writeFileSync(outPath, body, 'utf8');
console.log(`[extract-dependency-licenses] ${Object.keys(texts).length} Pakete → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
