const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  needsSetupWizard,
  canCreateWorkUser,
} = require('../lib/setup-wizard');

describe('setup-wizard', () => {
  it('needsSetupWizard ist true ohne konfigurierten Benutzer', async () => {
    const prisma = {
      appUser: {
        count: async ({ where }) => (where?.mustSetPassword === false ? 0 : 1),
      },
    };
    assert.equal(await needsSetupWizard(prisma), true);
  });

  it('canCreateWorkUser nur mit einem fertigen Benutzer', async () => {
    const prisma = {
      appUser: {
        count: async ({ where } = {}) => {
          if (where?.mustSetPassword === false) return 1;
          return 1;
        },
      },
    };
    assert.equal(await canCreateWorkUser(prisma), true);
  });
});
