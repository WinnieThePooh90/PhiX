import { buildSummaryOverviewExportData } from './summaryOverviewExport';
import { buildExamTableExport, examExportSheetName } from './examTableExport';
import { buildTestTableExportAoa, testExportSheetName } from './testTableExport';
import { buildOralStandardTableExportData, oralExportSheetName } from './oralTableExport';
import { buildGfsTableExportData, gfsExportSheetName } from './gfsTableExport';
import { isOralExtendedActive } from './oralExtendedMode';

/**
 * @typedef {{ name: string, aoa: (string|number)[][], layout?: { colWidths?: number[], centerColumnIndexes?: number[], nameColumnIndex?: number }, gradingKey?: { title?: string, desc?: string, aoa?: (string|number)[][] } }} ExportSheet
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
    layout: summary.layout,
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
    if (!oral || isOralExtendedActive(oral) || oral.active === false) continue;
    const oralData = buildOralStandardTableExportData({ oral, students, config });
    if (!oralData) continue;
    sheets.push({
      name: oralExportSheetName(id, oral.name),
      aoa: [oralData.headers, ...oralData.rows],
      layout: oralData.layout,
    });
  }

  const gfsData = buildGfsTableExportData({ gfsEntries, students, config });
  sheets.push({
    name: gfsExportSheetName(),
    aoa: [gfsData.headers, ...gfsData.rows],
  });

  return sheets;
}
