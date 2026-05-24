/**
 * In-Memory Krypto-Sessions (DEK im RAM, TTL).
 */
const crypto = require('crypto');

/** Inaktivität: keine API-Nutzung mit Krypto-Token → Session ungültig (Sliding Refresh bei Zugriff). */
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const sessions = new Map();

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createCryptoSession(userId, dek, ttlMs = DEFAULT_TTL_MS) {
  const token = newToken();
  const now = Date.now();
  sessions.set(token, {
    userId: Number(userId),
    dek: Buffer.isBuffer(dek) ? dek : Buffer.from(dek),
    expiresAt: now + ttlMs,
    lastAccess: now,
  });
  return token;
}

function getCryptoSession(token) {
  if (!token) return null;
  const row = sessions.get(String(token));
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    sessions.delete(String(token));
    return null;
  }
  row.lastAccess = Date.now();
  row.expiresAt = Date.now() + DEFAULT_TTL_MS;
  return row;
}

function destroyCryptoSession(token) {
  if (token) sessions.delete(String(token));
}

function destroySessionsForUser(userId) {
  const uid = Number(userId);
  for (const [tok, row] of sessions) {
    if (row.userId === uid) sessions.delete(tok);
  }
}

module.exports = {
  DEFAULT_TTL_MS,
  createCryptoSession,
  getCryptoSession,
  destroyCryptoSession,
  destroySessionsForUser,
};
