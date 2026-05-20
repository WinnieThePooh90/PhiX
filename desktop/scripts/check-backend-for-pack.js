/**
 * Vor `npm run pack`: prüft, ob ../backend/node_modules existiert (nach `npm install` im Backend).
 */
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..', '..', 'backend');
const nm = path.join(backendDir, 'node_modules', '@prisma', 'client');
const sqliteClient = path.join(backendDir, 'generated', 'prisma-sqlite', 'index.js');

if (!fs.existsSync(nm)) {
  console.error(
    '[desktop/pack] Backend-Abhängigkeiten fehlen. Bitte zuerst ausführen:\n' +
      '  cd backend && npm install && npm run prisma:generate-all',
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

console.log('[desktop/pack] Backend OK:', backendDir);
