/**
 * Vor `npm run dist`: Backend + Frontend für gepackte Desktop-App prüfen.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const backendDir = path.join(repoRoot, 'backend');
const nm = path.join(backendDir, 'node_modules', '@prisma', 'client');
const sqliteClient = path.join(backendDir, 'generated', 'prisma-sqlite', 'index.js');
const distIndex = path.join(repoRoot, 'Notenauswertung-App', 'dist', 'index.html');

if (!fs.existsSync(nm)) {
  console.error(
    '[desktop/pack] Backend-Abhängigkeiten fehlen. Bitte zuerst ausführen:\n' +
      '  cd backend && npm install',
  );
  process.exit(1);
}

if (!fs.existsSync(sqliteClient)) {
  console.error(
    '[desktop/pack] SQLite-Prisma-Client fehlt. Bitte ausführen:\n' +
      '  cd backend && npm run prisma:generate-all',
  );
  process.exit(1);
}

if (!fs.existsSync(distIndex)) {
  console.error(
    '[desktop/pack] Frontend-Build fehlt (Notenauswertung-App/dist/index.html).\n' +
      '  cd desktop && npm run prepare-pack\n' +
      '  oder: cd Notenauswertung-App && npm run build',
  );
  process.exit(1);
}

console.log('[desktop/pack] Backend OK:', backendDir);
console.log('[desktop/pack] Frontend OK:', path.dirname(distIndex));
