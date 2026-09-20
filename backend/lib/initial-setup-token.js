/**
 * Einmal-Token für Erstpasswort neuer Benutzer (vom Admin ausgegeben).
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { BCRYPT_ROUNDS } = require('./app-user-password');

const DEFAULT_SETUP_TOKEN_LENGTH = 10;

async function createInitialSetupToken(length = DEFAULT_SETUP_TOKEN_LENGTH) {
  const token = crypto.randomBytes(Math.ceil((length * 3) / 4) + 2)
    .toString('base64url')
    .slice(0, length);
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
