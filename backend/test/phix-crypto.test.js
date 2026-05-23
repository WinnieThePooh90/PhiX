const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  encryptField,
  decryptField,
  generateRecoveryKey,
  normalizeRecoveryKey,
  wrapDek,
  unwrapDek,
  toB64,
} = require('../lib/phix-crypto');

describe('phix-crypto', () => {
  it('encryptField/decryptField roundtrip', () => {
    const dek = Buffer.alloc(32, 7);
    const enc = encryptField(dek, 'Max Mustermann');
    assert.ok(String(enc).startsWith('enc:v1:'));
    assert.equal(decryptField(dek, enc), 'Max Mustermann');
  });

  it('recovery key normalizes dashes', () => {
    const k = generateRecoveryKey();
    const norm = normalizeRecoveryKey(k);
    assert.ok(norm.length >= 20);
    assert.equal(normalizeRecoveryKey(k.toLowerCase()), norm);
  });

  it('wrapDek/unwrapDek roundtrip', async () => {
    const dek = Buffer.alloc(32, 3);
    const salt = toB64(Buffer.alloc(16, 1));
    const wrapped = await wrapDek(dek, 'test-password', salt);
    const out = await unwrapDek(wrapped, 'test-password', salt);
    assert.equal(Buffer.compare(out, dek), 0);
  });
});
