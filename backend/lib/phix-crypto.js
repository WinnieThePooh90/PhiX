/**
 * PhiX Nutzer-Verschlüsselung: DEK, Argon2id-KDF, AES-256-GCM, Envelope (Passwort + Recovery).
 */
const crypto = require('crypto');
const argon2 = require('argon2');

const ENC_PREFIX = 'enc:v1:';
const DEK_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const CRYPTO_VERSION = 1;

/** Argon2id-Parameter (dokumentiert in docs/ENCRYPTION.md). */
const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

function randomBytes(n) {
  return crypto.randomBytes(n);
}

function toB64(buf) {
  return Buffer.from(buf).toString('base64');
}

function fromB64(str) {
  return Buffer.from(String(str), 'base64');
}

function generateDek() {
  return randomBytes(DEK_BYTES);
}

function generateRecoveryKey() {
  const raw = randomBytes(32);
  const b32 = raw
    .toString('base64')
    .replace(/\+/g, '2')
    .replace(/\//g, '7')
    .replace(/=+$/, '')
    .slice(0, 26)
    .toUpperCase();
  return `${b32.slice(0, 5)}-${b32.slice(5, 10)}-${b32.slice(10, 15)}-${b32.slice(15, 20)}-${b32.slice(20, 26)}`;
}

function normalizeRecoveryKey(input) {
  return String(input ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
}

async function deriveKey(password, saltB64) {
  const salt = fromB64(saltB64);
  const hash = await argon2.hash(password, { ...ARGON2_OPTS, salt, raw: true });
  return Buffer.from(hash);
}

async function wrapDek(dek, password, saltB64) {
  const kek = await deriveKey(password, saltB64);
  return aesGcmEncrypt(kek, dek);
}

async function unwrapDek(wrappedB64, password, saltB64) {
  const kek = await deriveKey(password, saltB64);
  return aesGcmDecrypt(kek, wrappedB64);
}

function aesGcmEncrypt(key, plaintext) {
  const iv = randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const pt = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext);
  const enc = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return toB64(Buffer.concat([iv, tag, enc]));
}

function aesGcmDecrypt(key, wrappedB64) {
  const buf = fromB64(wrappedB64);
  if (buf.length < IV_BYTES + AUTH_TAG_BYTES + 1) {
    throw new Error('Ungültiges Wrap-Format');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const enc = buf.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

function encryptField(dek, value) {
  if (value == null) return value;
  let plain;
  if (Buffer.isBuffer(value)) {
    plain = value;
  } else if (typeof value === 'object') {
    plain = Buffer.from(JSON.stringify(value), 'utf8');
  } else {
    plain = Buffer.from(String(value), 'utf8');
  }
  const payload = aesGcmEncrypt(dek, plain);
  return `${ENC_PREFIX}${payload}`;
}

function decryptField(dek, value) {
  if (value == null || value === '') return value;
  const s = String(value);
  if (!s.startsWith(ENC_PREFIX)) return value;
  const payload = s.slice(ENC_PREFIX.length);
  const plain = aesGcmDecrypt(dek, payload);
  const text = plain.toString('utf8');
  return text;
}

function isEncryptedValue(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

async function createUserCryptoWraps(password) {
  const dek = generateDek();
  const saltPw = toB64(randomBytes(16));
  const saltRec = toB64(randomBytes(16));
  const recoveryKeyDisplay = generateRecoveryKey();
  const recoveryNorm = normalizeRecoveryKey(recoveryKeyDisplay);
  const dekWrappedPassword = await wrapDek(dek, password, saltPw);
  const dekWrappedRecovery = await wrapDek(dek, recoveryNorm, saltRec);
  return {
    dek,
    cryptoVersion: CRYPTO_VERSION,
    kdfSaltPassword: saltPw,
    kdfSaltRecovery: saltRec,
    dekWrappedPassword,
    dekWrappedRecovery,
    recoveryKeyDisplay,
  };
}

async function unwrapDekFromPassword(userCrypto, password) {
  return unwrapDek(userCrypto.dekWrappedPassword, password, userCrypto.kdfSaltPassword);
}

async function unwrapDekFromRecovery(userCrypto, recoveryKey) {
  const norm = normalizeRecoveryKey(recoveryKey);
  return unwrapDek(userCrypto.dekWrappedRecovery, norm, userCrypto.kdfSaltRecovery);
}

async function rewrapPassword(userCrypto, dek, newPassword) {
  const saltPw = toB64(randomBytes(16));
  const dekWrappedPassword = await wrapDek(dek, newPassword, saltPw);
  return { kdfSaltPassword: saltPw, dekWrappedPassword };
}

module.exports = {
  ENC_PREFIX,
  CRYPTO_VERSION,
  ARGON2_OPTS,
  generateDek,
  generateRecoveryKey,
  normalizeRecoveryKey,
  wrapDek,
  unwrapDek,
  encryptField,
  decryptField,
  isEncryptedValue,
  createUserCryptoWraps,
  unwrapDekFromPassword,
  unwrapDekFromRecovery,
  rewrapPassword,
  toB64,
  fromB64,
};
