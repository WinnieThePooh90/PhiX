export function isReservedAdminUsername(username) {
  return String(username ?? '').toLowerCase() === 'admin';
}

/** Effektive Admin-Rechte (System-„admin“ oder gesetztes isAdmin). */
export function userHasAdminRights(user) {
  if (!user) return false;
  if (isReservedAdminUsername(user.username)) return true;
  return user.isAdmin === true;
}

export function mapAppUserFromApi(body) {
  if (!body || body.id == null || !body.username) return null;
  const user = {
    id: String(body.id),
    username: body.username,
    isAdmin: body.isAdmin === true,
  };
  if (isReservedAdminUsername(user.username)) {
    user.isAdmin = true;
  }
  return user;
}
