const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

/** Unbekanntes Platzhalter-Passwort — nur bis zum ersten Login des Benutzers. */
async function placeholderPasswordHash() {
  const secret = crypto.randomBytes(48).toString('hex');
  return bcrypt.hash(secret, BCRYPT_ROUNDS);
}

module.exports = {
  BCRYPT_ROUNDS,
  placeholderPasswordHash,
};
