/**
 * In-Memory Krypto-Sessions (DEK im RAM, TTL).
 */
const crypto = require('crypto');

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
    ttlMs,
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
  row.expiresAt = Date.now() + row.ttlMs;
  return row;
}

/** Prüft Gültigkeit ohne TTL zu verlängern (Heartbeat / Status-Endpoint). */
function peekCryptoSession(token) {
  if (!token) return null;
  const row = sessions.get(String(token));
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    sessions.delete(String(token));
    return null;
  }
  return row;
}

function updateSessionTtl(token, ttlMs) {
  if (!token) return;
  const row = sessions.get(String(token));
  if (!row) return;
  row.ttlMs = ttlMs;
  row.expiresAt = row.lastAccess + ttlMs;
}

function destroyCryptoSession(token) {
  if (token) sessions.delete(String(token));
}

module.exports = {
  DEFAULT_TTL_MS,
  createCryptoSession,
  getCryptoSession,
  peekCryptoSession,
  updateSessionTtl,
  destroyCryptoSession,
};
