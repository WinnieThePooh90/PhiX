#!/usr/bin/env node
/**
 * Markiert die fehlgeschlagene Migration 20260622170000_referat_auswertung_hilfe
 * als zurückgerollt, damit migrate deploy sie mit der korrigierten SQL erneut anwenden kann.
 *
 * Aufruf im Projektroot (Docker):
 *   docker compose run --rm backend node scripts/resolve-referat-migration.js
 */
const { spawnSync } = require('child_process');
const path = require('path');
const { resolvePrismaCli } = require('../lib/deps-root');

const MIGRATION = '20260622170000_referat_auswertung_hilfe';
const backendRoot = path.join(__dirname, '..');
const prismaCli = resolvePrismaCli(backendRoot);
const schemaAbs = path.join(backendRoot, 'prisma', 'schema.prisma');

const r = spawnSync(
  process.execPath,
  [prismaCli, 'migrate', 'resolve', '--rolled-back', MIGRATION, `--schema=${schemaAbs}`],
  { stdio: 'inherit', cwd: backendRoot, env: process.env },
);

if (r.status !== 0) {
  process.exit(r.status ?? 1);
}

console.log(`[resolve-referat-migration] ${MIGRATION} als rolled-back markiert.`);
console.log('Nächster Schritt: docker compose up -d --build');
