/**
 * Minimaler CI-Smoke: Prisma-Verbindung + einfache Abfrage.
 * DATABASE_URL muss gesetzt sein (Postgres oder SQLite file:).
 */
require('dotenv').config();
const { createPrismaClient } = require('../lib/prisma-factory');

async function main() {
  if (!String(process.env.DATABASE_URL || '').trim()) {
    console.error('ci-smoke: DATABASE_URL fehlt');
    process.exit(1);
  }
  const prisma = createPrismaClient();
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.appUser.count();
    console.log('ci-smoke: ok');
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error('ci-smoke:', err);
  process.exit(1);
});
