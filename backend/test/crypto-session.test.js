const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  createCryptoSession,
  getCryptoSession,
  peekCryptoSession,
  touchCryptoSession,
  updateSessionTtl,
  destroyCryptoSession,
} = require('../lib/crypto-session');

describe('crypto-session', () => {
  it('peek does not extend expiresAt while touch extends expiresAt', async () => {
    const dummyDek = Buffer.from('12345678901234567890123456789012');
    const token = createCryptoSession(42, dummyDek, 1000);

    const initial = peekCryptoSession(token);
    assert.ok(initial);
    assert.equal(initial.userId, 42);
    const initialExpiresAt = initial.expiresAt;

    // Warte kurz
    await new Promise((r) => setTimeout(r, 20));

    // peek darf expiresAt nicht ändern
    const peeked = peekCryptoSession(token);
    assert.ok(peeked);
    assert.equal(peeked.expiresAt, initialExpiresAt);

    // touch muss expiresAt aktualisieren
    const touched = touchCryptoSession(token);
    assert.ok(touched);
    assert.ok(touched.expiresAt > initialExpiresAt);

    destroyCryptoSession(token);
    assert.equal(peekCryptoSession(token), null);
    assert.equal(touchCryptoSession(token), null);
  });

  it('expires properly after TTL', async () => {
    const dummyDek = Buffer.from('12345678901234567890123456789012');
    const token = createCryptoSession(99, dummyDek, 30);

    assert.ok(peekCryptoSession(token));

    await new Promise((r) => setTimeout(r, 45));

    // Nach Ablauf der TTL liefert peek/touch null
    assert.equal(peekCryptoSession(token), null);
    assert.equal(touchCryptoSession(token), null);
  });
});
