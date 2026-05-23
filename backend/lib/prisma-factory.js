const path = require('path');
const fs = require('fs');

function isSqliteUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  return u.startsWith('file:') || u.startsWith('sqlite:');
}

/**
 * PrismaClient für Postgres (@prisma/client) oder SQLite (generiert unter generated/prisma-sqlite).
 */
function createPrismaClient() {
  const url = process.env.DATABASE_URL || '';
  if (isSqliteUrl(url)) {
    const clientDir = path.join(__dirname, '..', 'generated', 'prisma-sqlite');
    const indexJs = path.join(clientDir, 'index.js');
    if (!fs.existsSync(indexJs)) {
      console.error(
        '[prisma] SQLite-Client fehlt. Aus backend/: npx prisma generate --schema=prisma/sqlite/schema.prisma',
      );
      process.exit(1);
    }
    const { PrismaClient } = require(clientDir);
    const base = new PrismaClient();
    const { createPrismaWithCrypto } = require('./prisma-crypto-extension');
    return createPrismaWithCrypto(base);
  }
  const { PrismaClient } = require('@prisma/client');
  const base = new PrismaClient();
  const { createPrismaWithCrypto } = require('./prisma-crypto-extension');
  return createPrismaWithCrypto(base);
}

module.exports = { createPrismaClient, isSqliteUrl };
