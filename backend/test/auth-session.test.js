const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  createAuthSession,
  getAuthSession,
  destroyAuthSession,
} = require('../lib/auth-session');

describe('auth-session', () => {
  it('create/get/destroy roundtrip', () => {
    const token = createAuthSession(7, 'lehrer');
    const row = getAuthSession(token);
    assert.ok(row);
    assert.equal(row.userId, 7);
    assert.equal(row.username, 'lehrer');
    destroyAuthSession(token);
    assert.equal(getAuthSession(token), null);
  });
});
