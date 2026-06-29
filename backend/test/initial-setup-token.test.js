const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const {
  createInitialSetupToken,
  verifyInitialSetupToken,
} = require('../lib/initial-setup-token');

describe('initial-setup-token', () => {
  it('createInitialSetupToken liefert verifizierbaren Token', async () => {
    const { token, hash } = await createInitialSetupToken();
    assert.ok(token.length >= 20);
    assert.ok(hash.startsWith('$2'));
    assert.equal(await verifyInitialSetupToken(token, hash), true);
    assert.equal(await verifyInitialSetupToken('falsch', hash), false);
  });

  it('null hash erlaubt Bootstrap ohne Token', async () => {
    assert.equal(await verifyInitialSetupToken('', null), true);
    assert.equal(await verifyInitialSetupToken('egal', null), true);
  });

  it('mit hash ist Token Pflicht', async () => {
    const hash = await bcrypt.hash('secret', 4);
    assert.equal(await verifyInitialSetupToken('', hash), false);
    assert.equal(await verifyInitialSetupToken('secret', hash), true);
  });
});
