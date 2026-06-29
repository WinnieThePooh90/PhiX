const { usernameWhere } = require('./username-filter');

const RESERVED_ADMIN_USERNAME = 'admin';

function isReservedAdminUsername(username) {
  return String(username || '').toLowerCase() === RESERVED_ADMIN_USERNAME;
}

/** Effektive Admin-Rechte (System-„admin“ oder gesetztes isAdmin-Flag). */
function hasAdminRights(userRow) {
  if (!userRow) return false;
  if (isReservedAdminUsername(userRow.username)) return true;
  return userRow.isAdmin === true;
}

async function resolveAdminRights(prisma, username) {
  if (isReservedAdminUsername(username)) return true;
  const row = await prisma.appUser.findFirst({
    where: usernameWhere(username),
    select: { isAdmin: true, username: true },
  });
  return hasAdminRights(row);
}

function toPublicAppUser(userRow) {
  if (!userRow) return null;
  return {
    id: String(userRow.id),
    username: userRow.username,
    isAdmin: hasAdminRights(userRow),
  };
}

module.exports = {
  RESERVED_ADMIN_USERNAME,
  isReservedAdminUsername,
  hasAdminRights,
  resolveAdminRights,
  toPublicAppUser,
};
