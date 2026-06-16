#!/usr/bin/env node
/**
 * Schreibt src/data/phixLicenseText.js aus der Repo-root LICENSE-Datei.
 * Ausführen nach Änderungen an ../../LICENSE:
 *   node scripts/sync-phix-license.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const licensePath = path.resolve(appRoot, '..', 'LICENSE');
const outPath = path.join(appRoot, 'src', 'data', 'phixLicenseText.js');

const text = fs.readFileSync(licensePath, 'utf8').trim();
const body = `/** Automatisch aus ../../LICENSE — scripts/sync-phix-license.mjs (nicht von Hand ändern). */
export const PHIX_APACHE_LICENSE_TEXT = ${JSON.stringify(text)};
`;

fs.writeFileSync(outPath, body, 'utf8');
console.log(`[sync-phix-license] ${outPath}`);
