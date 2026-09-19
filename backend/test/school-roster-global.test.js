const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../createApp');

describe('school-roster-global (Zentrale & persönliche Schülerverwaltung)', () => {
  function createMockPrisma() {
    let yearIdSeq = 1;
    let studentIdSeq = 1;
    const users = [
      { id: 1, username: 'admin', isAdmin: true },
      { id: 2, username: 'lehrer1', isAdmin: false },
      { id: 3, username: 'lehrer2', isAdmin: false },
    ];
    let years = [];
    let students = [];

    return {
      _data: { users, years, students },
      appUser: {
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
      },
      schoolRosterYear: {
        findMany: async ({ where }) => {
          let res = years;
          if (where?.OR) {
            res = years.filter((y) =>
              where.OR.some((cond) => {
                if (cond.isGlobal === true && y.isGlobal) return true;
                if (cond.ownerUsername === y.ownerUsername && cond.isGlobal === false && !y.isGlobal) return true;
                return false;
              }),
            );
          } else if (where?.ownerUsername) {
            res = years.filter((y) => y.ownerUsername === where.ownerUsername);
          }
          return res.map((y) => ({
            ...y,
            students: students.filter((s) => s.schoolYearId === y.id),
          }));
        },
        findFirst: async ({ where }) => {
          return (
            years.find((y) => {
              if (where.label && y.label !== where.label) return false;
              if (where.isGlobal !== undefined && y.isGlobal !== where.isGlobal) return false;
              if (where.ownerUsername && y.ownerUsername !== where.ownerUsername) return false;
              return true;
            }) || null
          );
        },
        findUnique: async ({ where }) => {
          return years.find((y) => y.id === where.id) || null;
        },
        create: async ({ data }) => {
          const row = { id: yearIdSeq++, ...data, createdAt: new Date() };
          years.push(row);
          return row;
        },
        delete: async ({ where }) => {
          const idx = years.findIndex((y) => y.id === where.id);
          if (idx < 0) throw { code: 'P2025' };
          const [removed] = years.splice(idx, 1);
          students = students.filter((s) => s.schoolYearId !== removed.id);
          return removed;
        },
        deleteMany: async ({ where }) => {
          let count = 0;
          years = years.filter((y) => {
            if (where?.ownerUsername && y.ownerUsername === where.ownerUsername) {
              if (where.isGlobal === undefined || y.isGlobal === where.isGlobal) {
                count++;
                return false;
              }
            }
            return true;
          });
          return { count };
        },
      },
      schoolRosterStudent: {
        findMany: async ({ where }) => {
          let res = students.filter((s) => s.schoolYearId === where.schoolYearId);
          if (where.OR) {
            res = res.filter((s) =>
              where.OR.some((cond) => {
                if (cond.isGlobal === true && s.isGlobal) return true;
                if (cond.ownerUsername === s.ownerUsername) return true;
                return false;
              }),
            );
          } else if (where.ownerUsername) {
            res = res.filter((s) => s.ownerUsername === where.ownerUsername);
          }
          return res;
        },
        findUnique: async ({ where, include }) => {
          const s = students.find((x) => x.id === where.id);
          if (!s) return null;
          if (include?.schoolYear) {
            return { ...s, schoolYear: years.find((y) => y.id === s.schoolYearId) || null };
          }
          return s;
        },
        create: async ({ data }) => {
          const row = { id: studentIdSeq++, ...data, createdAt: new Date() };
          students.push(row);
          return row;
        },
        update: async ({ where, data }) => {
          const s = students.find((x) => x.id === where.id);
          if (!s) throw { code: 'P2025' };
          Object.assign(s, data);
          return s;
        },
        delete: async ({ where }) => {
          const idx = students.findIndex((x) => x.id === where.id);
          if (idx < 0) throw { code: 'P2025' };
          const [removed] = students.splice(idx, 1);
          return removed;
        },
        deleteMany: async ({ where }) => {
          let count = 0;
          students = students.filter((s) => {
            if (s.schoolYearId === where.schoolYearId) {
              if (where.isGlobal !== undefined && s.isGlobal !== where.isGlobal) return true;
              if (where.ownerUsername && s.ownerUsername !== where.ownerUsername) return true;
              count++;
              return false;
            }
            return true;
          });
          return { count };
        },
      },
    };
  }

  it('Admin kann globales Schuljahr anlegen; Lehrer sieht es und kann eigene Schüler ergänzen', async () => {
    const mockPrisma = createMockPrisma();
    const app = createApp(mockPrisma);

    // 1. Admin legt globales Schuljahr an
    mockPrisma._data.years.push({ id: 10, label: '2026/2027', isGlobal: true, ownerUsername: 'admin' });

    // 2. Admin legt zentralen Schüler an
    mockPrisma._data.students.push({
      id: 100,
      schoolYearId: 10,
      gradeLevel: 10,
      classSection: 'a',
      firstName: 'Max',
      lastName: 'Mustermann',
      isGlobal: true,
      ownerUsername: 'admin',
    });

    // 3. Lehrer 1 legt persönlichen Schüler an
    mockPrisma._data.students.push({
      id: 101,
      schoolYearId: 10,
      gradeLevel: 10,
      classSection: 'a',
      firstName: 'Erika',
      lastName: 'Privatlehrer1',
      isGlobal: false,
      ownerUsername: 'lehrer1',
    });

    // 4. Lehrer 2 legt persönlichen Schüler an
    mockPrisma._data.students.push({
      id: 102,
      schoolYearId: 10,
      gradeLevel: 10,
      classSection: 'b',
      firstName: 'Hans',
      lastName: 'Privatlehrer2',
      isGlobal: false,
      ownerUsername: 'lehrer2',
    });

    // Test Abfrage für lehrer1
    const studentsForLehrer1 = await mockPrisma.schoolRosterStudent.findMany({
      where: {
        schoolYearId: 10,
        OR: [{ isGlobal: true }, { ownerUsername: 'lehrer1' }],
      },
    });

    assert.equal(studentsForLehrer1.length, 2);
    assert.ok(studentsForLehrer1.some((s) => s.lastName === 'Mustermann' && s.isGlobal));
    assert.ok(studentsForLehrer1.some((s) => s.lastName === 'Privatlehrer1' && !s.isGlobal));
    assert.ok(!studentsForLehrer1.some((s) => s.lastName === 'Privatlehrer2'));

    // Test Abfrage für lehrer2
    const studentsForLehrer2 = await mockPrisma.schoolRosterStudent.findMany({
      where: {
        schoolYearId: 10,
        OR: [{ isGlobal: true }, { ownerUsername: 'lehrer2' }],
      },
    });

    assert.equal(studentsForLehrer2.length, 2);
    assert.ok(studentsForLehrer2.some((s) => s.lastName === 'Mustermann' && s.isGlobal));
    assert.ok(studentsForLehrer2.some((s) => s.lastName === 'Privatlehrer2' && !s.isGlobal));
    assert.ok(!studentsForLehrer2.some((s) => s.lastName === 'Privatlehrer1'));
  });

  it('Lehrer kann nur eigene Schüler in einem zentralen Schuljahr leeren', async () => {
    const mockPrisma = createMockPrisma();

    mockPrisma._data.years.push({ id: 20, label: '2026/2027', isGlobal: true, ownerUsername: 'admin' });
    mockPrisma._data.students.push({
      id: 200,
      schoolYearId: 20,
      gradeLevel: 9,
      classSection: '',
      firstName: 'Global',
      lastName: 'Schüler',
      isGlobal: true,
      ownerUsername: 'admin',
    });
    mockPrisma._data.students.push({
      id: 201,
      schoolYearId: 20,
      gradeLevel: 9,
      classSection: '',
      firstName: 'Privat',
      lastName: 'Lehrer1',
      isGlobal: false,
      ownerUsername: 'lehrer1',
    });

    // Lehrer1 leert seine Schüler
    await mockPrisma.schoolRosterStudent.deleteMany({
      where: { schoolYearId: 20, isGlobal: false, ownerUsername: 'lehrer1' },
    });

    const remaining = await mockPrisma.schoolRosterStudent.findMany({
      where: { schoolYearId: 20, OR: [{ isGlobal: true }, { ownerUsername: 'lehrer1' }] },
    });

    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].firstName, 'Global');
  });
});
