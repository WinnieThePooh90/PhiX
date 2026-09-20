const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../createApp');
const { createAuthSession } = require('../lib/auth-session');

describe('User deletion (DELETE /api/users/:id)', () => {
  function createMockPrisma() {
    let users = [
      { id: 1, username: 'admin', isAdmin: true },
      { id: 2, username: 'lehrer1', isAdmin: false },
      { id: 3, username: 'lehrer2', isAdmin: false },
    ];
    let courses = [
      { id: 101, ownerUsername: 'lehrer1', name: 'Mathe 5a' },
      { id: 102, ownerUsername: 'lehrer2', name: 'Deutsch 6b' },
    ];
    let schoolYears = [
      { id: 201, ownerUsername: 'lehrer1', isGlobal: false, label: '2026/2027' },
      { id: 202, ownerUsername: 'admin', isGlobal: true, label: '2026/2027' },
    ];
    let schoolStudents = [
      { id: 301, ownerUsername: 'lehrer1', isGlobal: false, schoolYearId: 201, firstName: 'Max', lastName: 'Mustermann' },
      { id: 302, ownerUsername: null, isGlobal: true, schoolYearId: 202, firstName: 'Erika', lastName: 'Muster' },
    ];

    return {
      _data: { users, courses, schoolYears, schoolStudents },
      appUser: {
        count: async () => users.length,
        findFirst: async ({ where }) => {
          if (where?.username) {
            const u = String(where.username).toLowerCase();
            return users.find((x) => x.username.toLowerCase() === u) || null;
          }
          return null;
        },
        findUnique: async ({ where }) => {
          if (where?.id != null) return users.find((x) => x.id === where.id) || null;
          if (where?.username != null) return users.find((x) => x.username === where.username) || null;
          return null;
        },
        delete: async ({ where }) => {
          const idx = users.findIndex((x) => x.id === where.id);
          if (idx !== -1) users.splice(idx, 1);
        },
      },
      course: {
        findMany: async ({ where }) => {
          if (where?.ownerUsername) {
            return courses.filter((c) => c.ownerUsername === where.ownerUsername);
          }
          return courses;
        },
        deleteMany: async ({ where }) => {
          if (where?.id?.in) {
            courses = courses.filter((c) => !where.id.in.includes(c.id));
          } else if (where?.ownerUsername) {
            courses = courses.filter((c) => c.ownerUsername !== where.ownerUsername);
          }
        },
      },
      schoolRosterYear: {
        deleteMany: async ({ where }) => {
          if (where?.ownerUsername) {
            schoolYears = schoolYears.filter((y) => !(y.ownerUsername === where.ownerUsername && y.isGlobal === false));
          }
        },
      },
      schoolRosterStudent: {
        deleteMany: async ({ where }) => {
          if (where?.ownerUsername) {
            schoolStudents = schoolStudents.filter((s) => !(s.ownerUsername === where.ownerUsername && s.isGlobal === false));
          }
        },
      },
    };
  }

  async function withServer(prisma, fn) {
    const app = createApp(prisma);
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    try {
      await fn(`http://127.0.0.1:${port}`);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  it('admin can delete another user and their owned courses and personal roster data', async () => {
    const mockPrisma = createMockPrisma();
    await withServer(mockPrisma, async (baseUrl) => {
      const adminToken = createAuthSession(1, 'admin');

      const res = await fetch(`${baseUrl}/api/users/2`, {
        method: 'DELETE',
        headers: {
          'x-phix-auth-token': adminToken,
        },
      });

      assert.equal(res.status, 204);
      assert.equal(mockPrisma._data.users.some((u) => u.id === 2), false);
      assert.equal(mockPrisma._data.courses.some((c) => c.ownerUsername === 'lehrer1'), false);
      assert.equal(mockPrisma._data.courses.some((c) => c.ownerUsername === 'lehrer2'), true);
      assert.equal(mockPrisma._data.schoolYears.some((y) => y.ownerUsername === 'lehrer1'), false);
      assert.equal(mockPrisma._data.schoolStudents.some((s) => s.ownerUsername === 'lehrer1'), false);
      assert.equal(mockPrisma._data.schoolYears.some((y) => y.isGlobal), true);
    });
  });

  it('cannot delete the reserved admin user', async () => {
    const mockPrisma = createMockPrisma();
    await withServer(mockPrisma, async (baseUrl) => {
      const adminToken = createAuthSession(1, 'admin');

      const res = await fetch(`${baseUrl}/api/users/1`, {
        method: 'DELETE',
        headers: {
          'x-phix-auth-token': adminToken,
        },
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /admin.*nicht gelöscht werden/i);
      assert.equal(mockPrisma._data.users.some((u) => u.id === 1), true);
    });
  });

  it('non-admin cannot delete another user', async () => {
    const mockPrisma = createMockPrisma();
    await withServer(mockPrisma, async (baseUrl) => {
      const lehrerToken = createAuthSession(2, 'lehrer1');

      const res = await fetch(`${baseUrl}/api/users/3`, {
        method: 'DELETE',
        headers: {
          'x-phix-auth-token': lehrerToken,
        },
      });

      assert.equal(res.status, 403);
      assert.equal(mockPrisma._data.users.some((u) => u.id === 3), true);
    });
  });

  it('cannot delete the last remaining user', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma._data.users = [{ id: 1, username: 'admin', isAdmin: true }];
    await withServer(mockPrisma, async (baseUrl) => {
      const adminToken = createAuthSession(1, 'admin');

      const res = await fetch(`${baseUrl}/api/users/1`, {
        method: 'DELETE',
        headers: {
          'x-phix-auth-token': adminToken,
        },
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /letzte Benutzer/i);
    });
  });
});
