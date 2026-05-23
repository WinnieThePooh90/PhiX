#!/usr/bin/env node
/**
 * Schreibt Notenauswertung-App/src/config/appVersion.js aus docs/APP_VERSION.md
 * (Anzeige unter Einstellungen → Info).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mdPath = path.join(root, 'docs/APP_VERSION.md');
const outPath = path.join(root, 'Notenauswertung-App/src/config/appVersion.js');

const md = fs.readFileSync(mdPath, 'utf8');
const buildMatch = md.match(/^PHIX_BUILD=(\d+)/m);
const dateMatch = md.match(/^PHIX_LETZTE_AENDERUNG=(\d{4}-\d{2}-\d{2})/m);

if (!buildMatch) {
  console.error('sync-phix-app-version: PHIX_BUILD fehlt in docs/APP_VERSION.md');
  process.exit(1);
}

const build = Number(buildMatch[1]);
const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
const buildAt = `${date}T12:00:00.000Z`;

const contents = `/** Automatisch aus docs/APP_VERSION.md — scripts/sync-phix-app-version.mjs (nicht von Hand ändern). */
export const APP_VERSION = ${build};
export const APP_BUILD_AT = '${buildAt}';
`;

fs.writeFileSync(outPath, contents, 'utf8');
console.log(`[sync-phix-app-version] Info: Build ${build}, Datum ${date}`);
