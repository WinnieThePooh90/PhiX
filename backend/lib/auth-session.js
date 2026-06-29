/**
 * Serverseitige Login-Sessions (HttpOnly-Cookie, In-Memory).
 */
const crypto = require('crypto');
const cookie = require('cookie');

const COOKIE_NAME = 'phix_session';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function cookieSecureFlag() {
  return process.env.PHIX_COOKIE_SECURE === '1' || process.env.NODE_ENV === 'production';
}

function createAuthSession(userId, username, ttlMs = DEFAULT_TTL_MS) {
  const token = newToken();
  const now = Date.now();
  sessions.set(token, {
    userId: Number(userId),
    username: String(username),
    ttlMs,
    expiresAt: now + ttlMs,
    lastAccess: now,
  });
  return token;
}

function getAuthSession(token) {
  if (!token) return null;
  const row = sessions.get(String(token));
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    sessions.delete(String(token));
    return null;
  }
  row.lastAccess = Date.now();
  row.expiresAt = Date.now() + row.ttlMs;
  return row;
}

function destroyAuthSession(token) {
  if (token) sessions.delete(String(token));
}

function readSessionTokenFromRequest(req) {
  const raw = req?.headers?.cookie;
  if (!raw) return null;
  const parsed = cookie.parse(raw);
  return parsed[COOKIE_NAME] || null;
}

function getActingUserFromRequest(req) {
  const token = readSessionTokenFromRequest(req);
  const session = getAuthSession(token);
  return session?.username || null;
}

function getAuthUserIdFromRequest(req) {
  const token = readSessionTokenFromRequest(req);
  const session = getAuthSession(token);
  return session?.userId ?? null;
}

function setAuthSessionCookie(res, token, ttlMs = DEFAULT_TTL_MS) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(ttlMs / 1000),
      secure: cookieSecureFlag(),
    }),
  );
}

function clearAuthSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      secure: cookieSecureFlag(),
    }),
  );
}

function attachAuthSession(req, _res, next) {
  const token = readSessionTokenFromRequest(req);
  const session = getAuthSession(token);
  if (session) {
    req.phixAuth = { userId: session.userId, username: session.username, token };
  }
  next();
}

module.exports = {
  COOKIE_NAME,
  DEFAULT_TTL_MS,
  attachAuthSession,
  createAuthSession,
  getAuthSession,
  destroyAuthSession,
  readSessionTokenFromRequest,
  getActingUserFromRequest,
  getAuthUserIdFromRequest,
  setAuthSessionCookie,
  clearAuthSessionCookie,
};
