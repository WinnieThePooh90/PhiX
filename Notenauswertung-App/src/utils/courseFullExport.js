import { buildSummaryOverviewExportData } from './summaryOverviewExport';
import { buildExamTableExport, examExportSheetName } from './examTableExport';
import { buildTestTableExportAoa, testExportSheetName } from './testTableExport';
import { buildOralStandardTableExportData, oralExportSheetName } from './oralTableExport';
import { buildGfsTableExportData, gfsExportSheetName } from './gfsTableExport';

/**
 * @typedef {{ name: string, aoa: (string|number)[][] }} ExportSheet
 */

/**
 * Alle Tabellenblätter für den Export des aktuellen Kurses.
 * @returns {ExportSheet[]}
 */
export function buildCourseFullExportSheets({
  students,
  exams,
  orals,
  tests,
  projects = {},
  gfsEntries,
  config,
}) {
  /** @type {ExportSheet[]} */
  const sheets = [];

  const summary = buildSummaryOverviewExportData({
    students,
    exams,
    orals,
    tests,
    projects,
    gfsEntries,
    config,
  });
  sheets.push({
    name: 'Übersicht',
    aoa: [summary.headers, ...summary.rows],
  });

  const examIds = Object.keys(exams ?? {}).sort((a, b) => Number(a) - Number(b));
  for (const id of examIds) {
    const exam = exams[id];
    if (!exam || exam.active === false) continue;
    sheets.push({
      name: examExportSheetName(id),
      ...buildExamTableExport({ exam, examId: id, students, config }),
    });
  }

  const testIds = Object.keys(tests ?? {}).sort((a, b) => Number(a) - Number(b));
  for (const id of testIds) {
    const test = tests[id];
    if (!test || test.active === false) continue;
    sheets.push({
      name: testExportSheetName(id, test.name),
      aoa: buildTestTableExportAoa({ test, testId: id, students, config }),
    });
  }

  const oralIds = Object.keys(orals ?? {}).sort((a, b) => Number(a) - Number(b));
  for (const id of oralIds) {
    const oral = orals[id];
    if (!oral || oral.extended || oral.active === false) continue;
    const oralData = buildOralStandardTableExportData({ oral, students, config });
    if (!oralData) continue;
    sheets.push({
      name: oralExportSheetName(id, oral.name),
      aoa: [oralData.headers, ...oralData.rows],
    });
  }

  const gfsData = buildGfsTableExportData({ gfsEntries, students, config });
  sheets.push({
    name: gfsExportSheetName(),
    aoa: [gfsData.headers, ...gfsData.rows],
  });

  return sheets;
}
