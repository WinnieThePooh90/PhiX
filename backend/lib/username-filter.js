const { isSqliteUrl } = require('./prisma-factory');

/**
 * Prisma-Where für Benutzername (Postgres: mode insensitive; SQLite: nur equals).
 * @param {string} username
 * @param {{ useInsensitive?: boolean }} [opts]
 */
function usernameWhere(username, opts = {}) {
  const u = String(username || '').trim();
  const useInsensitive =
    opts.useInsensitive !== undefined
      ? opts.useInsensitive
      : !isSqliteUrl(process.env.DATABASE_URL || '');
  if (useInsensitive) {
    return { username: { equals: u, mode: 'insensitive' } };
  }
  return { username: u };
}

module.exports = { usernameWhere };
