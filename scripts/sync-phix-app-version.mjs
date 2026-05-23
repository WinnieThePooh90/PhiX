#!/usr/bin/env node
/** Wrapper für Monorepo-Root → Notenauswertung-App/scripts/sync-app-version.mjs */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'Notenauswertung-App/scripts/sync-app-version.mjs');
const r = spawnSync(process.execPath, [script], { stdio: 'inherit', cwd: root });
process.exit(r.status ?? 1);
