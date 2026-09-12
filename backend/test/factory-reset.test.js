const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { clearAllPhixData } = require('../lib/phix-backup');

describe('factory-reset & clearAllPhixData', () => {
  it('clearAllPhixData ruft deleteMany auf allen Tabellen auf', async () => {
    const deletedTables = [];
    const createMockTable = (name) => ({
      deleteMany: async () => {
        deletedTables.push(name);
        return { count: 0 };
      },
    });

    const tx = {
      notesListEntry: createMockTable('notesListEntry'),
      notesList: createMockTable('notesList'),
      homeworkListEntry: createMockTable('homeworkListEntry'),
      homeworkList: createMockTable('homeworkList'),
      collectionListEntry: createMockTable('collectionListEntry'),
      collectionList: createMockTable('collectionList'),
      attendanceListEntry: createMockTable('attendanceListEntry'),
      attendanceList: createMockTable('attendanceList'),
      moneyListEntry: createMockTable('moneyListEntry'),
      moneyList: createMockTable('moneyList'),
      gfsEntry: createMockTable('gfsEntry'),
      referatEntry: createMockTable('referatEntry'),
      albumPhoto: createMockTable('albumPhoto'),
      userAuswertungshilfe: createMockTable('userAuswertungshilfe'),
      test: createMockTable('test'),
      project: createMockTable('project'),
      oral: createMockTable('oral'),
      exam: createMockTable('exam'),
      student: createMockTable('student'),
      course: createMockTable('course'),
      schoolRosterStudent: createMockTable('schoolRosterStudent'),
      schoolRosterYear: createMockTable('schoolRosterYear'),
      userSettings: createMockTable('userSettings'),
      userCrypto: createMockTable('userCrypto'),
      appRegistration: createMockTable('appRegistration'),
      appUser: createMockTable('appUser'),
    };

    await clearAllPhixData(tx);

    assert.equal(deletedTables.length, 26);
    assert.equal(deletedTables[deletedTables.length - 1], 'appUser');
  });
});
