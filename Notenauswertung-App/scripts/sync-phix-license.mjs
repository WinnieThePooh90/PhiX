#!/usr/bin/env node
/**
 * Schreibt src/data/phixLicenseText.js aus der LICENSE-Datei.
 * Quelle (Priorität): Repo-Root ../LICENSE, sonst ./LICENSE im App-Ordner (Docker-Build).
 * Bei Monorepo-Build wird ./LICENSE aus dem Repo-Root gespiegelt.
 *
 *   node scripts/sync-phix-license.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const outPath = path.join(appRoot, 'src', 'data', 'phixLicenseText.js');
const appLicensePath = path.join(appRoot, 'LICENSE');
const repoLicensePath = path.join(repoRoot, 'LICENSE');

function resolveLicenseSource() {
  if (fs.existsSync(repoLicensePath)) {
    return { path: repoLicensePath, source: 'LICENSE (Repo-Root)' };
  }
  if (fs.existsSync(appLicensePath)) {
    return { path: appLicensePath, source: 'LICENSE (App-Ordner)' };
  }
  return null;
}

const resolved = resolveLicenseSource();
if (!resolved) {
  if (fs.existsSync(outPath)) {
    console.warn(
      '[sync-phix-license] Keine LICENSE gefunden — vorhandene phixLicenseText.js bleibt unverändert (Docker-Fallback).',
    );
    process.exit(0);
  }
  console.error(
    '[sync-phix-license] LICENSE fehlt (weder Repo-Root noch App-Ordner) und phixLicenseText.js ist nicht vorhanden.',
  );
  process.exit(1);
}

const text = fs.readFileSync(resolved.path, 'utf8').trim();

if (resolved.path === repoLicensePath) {
  fs.writeFileSync(appLicensePath, `${text}\n`, 'utf8');
}

const body = `/** Automatisch aus LICENSE — scripts/sync-phix-license.mjs (nicht von Hand ändern). Quelle: ${resolved.source} */
export const PHIX_APACHE_LICENSE_TEXT = ${JSON.stringify(text)};
`;

fs.writeFileSync(outPath, body, 'utf8');
console.log(`[sync-phix-license] ${outPath} ← ${resolved.source}`);
