/**
 * Einmal-Token für Erstpasswort neuer Benutzer (vom Admin ausgegeben).
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { BCRYPT_ROUNDS } = require('./app-user-password');

async function createInitialSetupToken() {
  const token = crypto.randomBytes(24).toString('base64url');
  const hash = await bcrypt.hash(token, BCRYPT_ROUNDS);
  return { token, hash };
}

/** null hash = Bootstrap-Konto ohne Token-Pflicht (z. B. erster „admin“). */
async function verifyInitialSetupToken(token, hash) {
  if (!hash) return true;
  const raw = String(token ?? '').trim();
  if (!raw) return false;
  return bcrypt.compare(raw, hash);
}

module.exports = {
  createInitialSetupToken,
  verifyInitialSetupToken,
};
