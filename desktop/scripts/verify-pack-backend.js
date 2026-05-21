/**
 * Nach electron-builder: Prisma CLI im gepackten resources/backend/phix_deps prüfen.
 * Aufruf: node scripts/verify-pack-backend.js [Pfad zu win-unpacked oder portable Ordner]
 */
const fs = require('fs');
const path = require('path');

const desktopRoot = path.join(__dirname, '..');
const defaultCandidates = [
  path.join(desktopRoot, 'dist-pack', 'win-unpacked', 'resources', 'backend'),
  path.join(desktopRoot, 'dist-pack', 'win-unpacked'),
];

function findBackendRoot(start) {
  const direct = path.join(start, 'resources', 'backend');
  if (fs.existsSync(path.join(direct, 'phix_deps', 'prisma', 'build', 'index.js'))) {
    return direct;
  }
  if (fs.existsSync(path.join(start, 'phix_deps', 'prisma', 'build', 'index.js'))) {
    return start;
  }
  return null;
}

const arg = process.argv[2];
const roots = arg ? [arg] : defaultCandidates;

let backendRoot = null;
for (const r of roots) {
  if (!fs.existsSync(r)) continue;
  backendRoot = findBackendRoot(r);
  if (backendRoot) break;
}

if (!backendRoot) {
  console.error(
    '[verify-pack] Kein gepacktes Backend gefunden. Nutzung:\n' +
      '  node scripts/verify-pack-backend.js "C:\\Pfad\\PhiX-Desktop-17.0.0-win-x64"',
  );
  process.exit(1);
}

const prismaCli = path.join(backendRoot, 'phix_deps', 'prisma', 'build', 'index.js');
if (!fs.existsSync(prismaCli)) {
  console.error('[verify-pack] FEHLER — Prisma CLI fehlt:', prismaCli);
  console.error('[verify-pack] Inhalt backend:', fs.readdirSync(backendRoot));
  process.exit(1);
}

console.log('[verify-pack] OK —', prismaCli, '(' + fs.statSync(prismaCli).size + ' Bytes)');
