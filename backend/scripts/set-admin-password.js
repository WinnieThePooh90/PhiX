/**
 * Setzt (oder legt) das Passwort für einen App-Benutzer — z. B. nach leerem Docker-Volume.
 *
 * Nutzung (im Ordner backend, DATABASE_URL in .env):
 *   node scripts/set-admin-password.js <neues-passwort> [benutzername]
 *
 * Beispiel:
 *   node scripts/set-admin-password.js meinSicheresPasswort admin
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createPrismaClient } = require('../lib/prisma-factory');

const BCRYPT_ROUNDS = 10;

async function main() {
  const password = String(process.argv[2] ?? '').trim();
  const username = String(process.argv[3] ?? 'admin').trim() || 'admin';
  if (!password) {
    console.error('Aufruf: node scripts/set-admin-password.js <neues-passwort> [benutzername]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL fehlt (z. B. in backend/.env).');
    process.exit(1);
  }

  const prisma = createPrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.appUser.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, passwordHash },
    });
    console.log(`Passwort für "${user.username}" wurde gesetzt (${user.id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
