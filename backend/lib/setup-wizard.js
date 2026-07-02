const { placeholderPasswordHash, BCRYPT_ROUNDS } = require('./app-user-password');
const bcrypt = require('bcryptjs');
const { usernameWhere } = require('./username-filter');

/** Frische Installation: noch kein Benutzer mit festgelegtem Passwort. */
async function needsSetupWizard(prisma) {
  const configured = await prisma.appUser.count({ where: { mustSetPassword: false } });
  return configured === 0;
}

async function ensureBootstrapAdmin(prisma) {
  const n = await prisma.appUser.count();
  if (n > 0) return;
  const passwordHash = await placeholderPasswordHash();
  await prisma.appUser.create({
    data: { username: 'admin', passwordHash, isAdmin: true, mustSetPassword: true },
  });
}

/** Arbeit-Benutzer nur, wenn admin-Passwort gesetzt ist und noch kein zweiter Account existiert. */
async function canCreateWorkUser(prisma) {
  const configured = await prisma.appUser.count({ where: { mustSetPassword: false } });
  const total = await prisma.appUser.count();
  return configured >= 1 && total === 1;
}

async function createWorkUser(prisma, { username, password, isAdmin }) {
  const name = String(username ?? '').trim();
  const pass = String(password ?? '');
  if (!name || !pass) {
    return { error: 'Benutzername und Passwort eingeben.', status: 400 };
  }
  if (name.toLowerCase() === 'admin') {
    return { error: 'Der Name „admin“ ist für den Standard-Administrator reserviert.', status: 400 };
  }
  if (!(await canCreateWorkUser(prisma))) {
    return { error: 'Ein Arbeitskonto kann derzeit nicht angelegt werden.', status: 403 };
  }
  const clash = await prisma.appUser.findFirst({ where: usernameWhere(name) });
  if (clash) {
    return { error: 'Dieser Benutzername ist bereits vergeben.', status: 409 };
  }
  const passwordHash = await bcrypt.hash(pass, BCRYPT_ROUNDS);
  const user = await prisma.appUser.create({
    data: {
      username: name,
      passwordHash,
      mustSetPassword: false,
      isAdmin: isAdmin === true,
      initialSetupTokenHash: null,
    },
    select: { id: true, username: true, isAdmin: true },
  });
  return { user, status: 201 };
}

module.exports = {
  needsSetupWizard,
  ensureBootstrapAdmin,
  canCreateWorkUser,
  createWorkUser,
};
