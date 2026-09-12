#!/usr/bin/env node
/**
 * Schreibt src/config/appVersion.js für die Info-Seite und Login-Seite.
 * - Monorepo: liest docs/APP_VERSION.md (ein Verzeichnis über dem App-Root) und synchronisiert package.json
 * - Docker / Container: Nutzt vorhandenes src/config/appVersion.js bzw. Fallback auf package.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..');
const mdPath = path.join(repoRoot, 'docs/APP_VERSION.md');
const pkgPath = path.join(appRoot, 'package.json');
const outPath = path.join(appRoot, 'src/config/appVersion.js');

function syncPackageJson(filePath, semver) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const updated = content.replace(/"version":\s*"[^"]+"/, `"version": "${semver}"`);
    if (updated !== content) {
      fs.writeFileSync(filePath, updated, 'utf8');
    }
  } catch (err) {
    console.warn(`[sync-app-version] Warnung: Konnte ${filePath} nicht aktualisieren:`, err.message);
  }
}

function readFromAppVersionMd() {
  if (!fs.existsSync(mdPath)) return null;
  const md = fs.readFileSync(mdPath, 'utf8');
  const buildMatch = md.match(/^PHIX_BUILD=(\d+)/m);
  const dateMatch = md.match(/^PHIX_LETZTE_AENDERUNG=([^\r\n]+)/m);
  if (!buildMatch) return null;
  const build = Number(buildMatch[1]);
  const semver = `${build}.0.0`;

  // Synchronisiere package.json-Dateien
  syncPackageJson(pkgPath, semver);
  syncPackageJson(path.join(repoRoot, 'backend/package.json'), semver);
  syncPackageJson(path.join(repoRoot, 'desktop/package.json'), semver);

  return {
    build,
    date: dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10),
    source: 'docs/APP_VERSION.md',
  };
}

function readFromExistingAppVersionJs() {
  if (!fs.existsSync(outPath)) return null;
  try {
    const code = fs.readFileSync(outPath, 'utf8');
    const match = code.match(/APP_VERSION\s*=\s*(\d+)/);
    if (!match) return null;
    const build = Number(match[1]);
    if (!Number.isFinite(build) || build <= 0) return null;
    return {
      build,
      date: new Date().toISOString().slice(0, 10),
      source: 'src/config/appVersion.js (bestehend)',
    };
  } catch {
    return null;
  }
}

function readFromPackageJson() {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const major = parseInt(String(pkg.version ?? '0').split('.')[0], 10);
    return {
      build: Number.isFinite(major) ? major : 0,
      date: new Date().toISOString().slice(0, 10),
      source: 'package.json',
    };
  } catch {
    return {
      build: 0,
      date: new Date().toISOString().slice(0, 10),
      source: 'fallback',
    };
  }
}

const info = readFromAppVersionMd() ?? readFromExistingAppVersionJs() ?? readFromPackageJson();
const buildAt = new Date().toISOString();

const contents = `/** Automatisch — scripts/sync-app-version.mjs (nicht von Hand ändern). Quelle: ${info.source} */
export const APP_VERSION = ${info.build};
export const APP_BUILD_AT = '${buildAt}';
`;

fs.writeFileSync(outPath, contents, 'utf8');
console.log(`[sync-app-version] Info: Build ${info.build}, Datum ${info.date} (${info.source})`);
