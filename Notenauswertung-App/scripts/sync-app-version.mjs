#!/usr/bin/env node
/**
 * Schreibt src/config/appVersion.js für die Info-Seite.
 * - Monorepo: liest docs/APP_VERSION.md (ein Verzeichnis über dem App-Root)
 * - Docker / nur App-Ordner: Fallback auf package.json "version" (Major = PHIX_BUILD)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..');
const mdPath = path.join(repoRoot, 'docs/APP_VERSION.md');
const pkgPath = path.join(appRoot, 'package.json');
const outPath = path.join(appRoot, 'src/config/appVersion.js');

function readFromAppVersionMd() {
  if (!fs.existsSync(mdPath)) return null;
  const md = fs.readFileSync(mdPath, 'utf8');
  const buildMatch = md.match(/^PHIX_BUILD=(\d+)/m);
  const dateMatch = md.match(/^PHIX_LETZTE_AENDERUNG=(\d{4}-\d{2}-\d{2})/m);
  if (!buildMatch) return null;
  return {
    build: Number(buildMatch[1]),
    date: dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10),
    source: 'docs/APP_VERSION.md',
  };
}

function readFromPackageJson() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const major = parseInt(String(pkg.version ?? '0').split('.')[0], 10);
  return {
    build: Number.isFinite(major) ? major : 0,
    date: new Date().toISOString().slice(0, 10),
    source: 'package.json',
  };
}

const info = readFromAppVersionMd() ?? readFromPackageJson();
const buildAt = new Date().toISOString();

const contents = `/** Automatisch — scripts/sync-app-version.mjs (nicht von Hand ändern). Quelle: ${info.source} */
export const APP_VERSION = ${info.build};
export const APP_BUILD_AT = '${buildAt}';
`;

fs.writeFileSync(outPath, contents, 'utf8');
console.log(`[sync-app-version] Info: Build ${info.build}, Datum ${info.date} (${info.source})`);
