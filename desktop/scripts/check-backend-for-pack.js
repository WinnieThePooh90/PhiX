/**
 * Vor `npm run dist`: gestagtes Backend (Pack-Quelle) + Frontend prüfen.
 */
const fs = require('fs');
const path = require('path');

const desktopRoot = path.join(__dirname, '..');
const repoRoot = path.join(desktopRoot, '..');
const markerFile = path.join(desktopRoot, '.pack-backend-from.json');
const fallbackBackend = path.join(repoRoot, 'backend');
const distIndex = path.join(repoRoot, 'Notenauswertung-App', 'dist', 'index.html');

function resolvePackBackendDir() {
  if (fs.existsSync(markerFile)) {
    try {
      const { path: staged } = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
      if (staged && fs.existsSync(path.join(staged, 'package.json'))) {
        return staged;
      }
    } catch {
      /* Fallback */
    }
  }
  return fallbackBackend;
}

const backendDir = resolvePackBackendDir();
const prismaCli = path.join(backendDir, 'phix_deps', 'prisma', 'build', 'index.js');
const sqliteClient = path.join(backendDir, 'generated', 'prisma-sqlite', 'index.js');

if (!fs.existsSync(markerFile) || backendDir === fallbackBackend) {
  console.error(
    '[desktop/pack] Kein gestagtes Backend. Bitte zuerst ausführen:\n' +
      '  cd desktop && npm run stage-backend',
  );
  process.exit(1);
}

if (!fs.existsSync(prismaCli)) {
  console.error('[desktop/pack] Prisma CLI fehlt im Staging:', prismaCli);
  process.exit(1);
}

const prismaSize = fs.statSync(prismaCli).size;
if (prismaSize < 1000) {
  console.error(
    '[desktop/pack] Prisma CLI im Staging zu klein (' +
      prismaSize +
      ' Bytes) — vermutlich unvollständiger Sync/Kopie. Erneut: npm run stage-backend',
  );
  process.exit(1);
}

if (!fs.existsSync(sqliteClient)) {
  console.error(
    '[desktop/pack] SQLite-Prisma-Client fehlt im Staging. Bitte:\n' +
      '  cd backend && npm run prisma:generate-all\n' +
      '  cd desktop && npm run stage-backend',
  );
  process.exit(1);
}

if (!fs.existsSync(distIndex)) {
  console.error(
    '[desktop/pack] Frontend-Build fehlt (Notenauswertung-App/dist/index.html).\n' +
      '  cd desktop && npm run prepare-pack',
  );
  process.exit(1);
}

console.log('[desktop/pack] Pack-Backend OK:', backendDir);
console.log('[desktop/pack] Prisma CLI:', prismaCli, '(' + prismaSize + ' Bytes)');
console.log('[desktop/pack] Frontend OK:', path.dirname(distIndex));
