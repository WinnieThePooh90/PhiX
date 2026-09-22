import { downloadMultiSheetXlsx } from './phixXlsxExport';
import { summaryOverviewDetailsExportFilename } from './exportFilenames';
import {
  calculateStudentGrades,
  formatGrade,
  formatCalculatedGradeValue,
  formatOverviewCalculatedGrade,
  getExamGradeForStudent,
  getTestGradeForStudent,
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  getNormalizedOralGrade,
  getNormalizedTestScore,
  getProjectGradeForStudent,
  isProjectScoreCountedForStudent,
  storedGradeStringToClassic,
  storedGradeStringToNotenpunkte,
  normalizeCourseGradeSystem,
} from './calculator';
import { getCourseGradingKeysLookup } from './courseArchive';
import {
  usesTestsAsHalfExam,
  usesTestsAsOral,
  usesReferatAsExam,
  usesReferatAsOral,
  usesReferatWrittenPercent,
  usesReferatOralPercent,
  usesReferatFinalPercent,
  resolveCourseWeighting,
} from './courseWeightingOptions';
import { buildSummaryOverviewExportData } from './summaryOverviewExport';

const GRADE_OVERVIEW_CATEGORIES = [
  { label: 'Halbjahr 1', filter: '1' },
  { label: 'Halbjahr 2', filter: '2' },
  { label: 'Gesamt (Durchschnitt)', filter: null },
];

/**
 * Erstellt die Tabellendaten für einen Einzelschüler im Excel-Format mit Spalten für HJ1, HJ2 und Gesamt.
 */
export function buildStudentOverviewXlsxSheet(student, ctx) {
  const {
    config,
    exams = {},
    orals = {},
    tests = {},
    projects = {},
    gfsEntries = [],
    referatEntries = [],
    referatCountsAsExam = false,
    referatCountsAsOral = false,
    referatCountsAsPartialWritten = false,
    referatWrittenPercent = 100,
    referatCountsAsPartialOral = false,
    referatOralPercent = 100,
    referatCountsAsFinalPercent = false,
    referatFinalPercent = 100,
    showGfs = true,
    showReferate = false,
    weighting,
    customGradingKeys,
    gradeSys = 'decimal',
    testsWritten = true,
    testsAsHalfExam = false,
    testsAsOral = false,
    kursstufe = false,
  } = ctx;

  const isPoints = normalizeCourseGradeSystem(gradeSys) === 'points';
  const categories = kursstufe
    ? [{ label: 'Gesamt (Durchschnitt)', filter: null }]
    : GRADE_OVERVIEW_CATEGORIES;

  const gradingReferatEntries = referatCountsAsExam ? referatEntries : [];
  const gradingOralReferatEntries = referatCountsAsOral ? referatEntries : [];
  const gradingPartialWrittenReferatEntries = referatCountsAsPartialWritten ? referatEntries : [];
  const gradingPartialOralReferatEntries = referatCountsAsPartialOral ? referatEntries : [];
  const referatWrittenUnitWeight = referatCountsAsPartialWritten
    ? Math.min(100, Math.max(0, Math.round(Number(referatWrittenPercent) || 0))) / 100
    : 0;
  const referatOralUnitWeight = referatCountsAsPartialOral
    ? Math.min(100, Math.max(0, Math.round(Number(referatOralPercent) || 0))) / 100
    : 0;
  const gradingFinalPercentReferatEntries = referatCountsAsFinalPercent ? referatEntries : [];
  const referatFinalPercentValue = referatCountsAsFinalPercent
    ? Math.min(100, Math.max(0, Math.round(Number(referatFinalPercent) || 0)))
    : 0;

  // Strukturierte Zeilen für jede Kategorie (Spalte)
  const catColumns = categories.map((cat) => {
    const { examAvg, oralAvg, testAvg, finalGrade, valuesAreNotenpunkte } = calculateStudentGrades(
      student.id,
      exams,
      orals,
      tests,
      weighting,
      cat.filter,
      gfsEntries,
      customGradingKeys,
      gradeSys,
      testsWritten,
      projects,
      testsAsHalfExam,
      testsAsOral,
      gradingReferatEntries,
      gradingOralReferatEntries,
      gradingPartialWrittenReferatEntries,
      referatWrittenUnitWeight,
      gradingPartialOralReferatEntries,
      referatOralUnitWeight,
      gradingFinalPercentReferatEntries,
      referatFinalPercentValue,
    );

    const gfmtOverview = (g) => formatOverviewCalculatedGrade(g, gradeSys, valuesAreNotenpunkte);
    const gfmtCalc = (g) => formatCalculatedGradeValue(g, gradeSys, valuesAreNotenpunkte);
    const gfmtItem = (g) => formatGrade(g, gradeSys, isPoints ? { inputScale: 'notenpunkte' } : undefined);
    const rounded = finalGrade !== null ? Math.round(finalGrade) : null;

    const lines = [];
    lines.push({ label: cat.label, value: `${gfmtOverview(finalGrade)} (${rounded !== null ? gfmtCalc(rounded) : '-'})` });
    lines.push({ label: '', value: '' });

    // 1. Schriftlich
    lines.push({ label: `SCHRIFTLICH (${gfmtOverview(examAvg)})`, value: '' });
    Object.entries(exams)
      .filter(([_, e]) => e.active && (!cat.filter || e.halbjahr === cat.filter))
      .forEach(([id, e]) => {
        const { counted } = getNormalizedExamScore(e.scores?.[student.id], getStudentEffectiveExamFieldCount(e, student.id));
        const gr = getExamGradeForStudent(e, student.id, customGradingKeys, gradeSys);
        const name = e.name ? e.name : `KA ${id}`;
        lines.push({ label: `  ${name}${counted ? '' : ' (n. gew.)'}`, value: counted && gr !== null ? gfmtItem(gr) : '-' });
      });

    if (showGfs) {
      gfsEntries
        .filter((e) => e.studentId === student.id && (!cat.filter || e.halbjahr === cat.filter))
        .forEach((e) => {
          const gNum = isPoints ? storedGradeStringToNotenpunkte(e.note, 'points') : storedGradeStringToClassic(e.note, 'classic');
          const counted = e.gehalten === true && gNum !== null;
          lines.push({ label: `  GFS: ${e.thema || '—'}`, value: counted ? gfmtItem(gNum) : '-' });
        });
    }

    if (showReferate && (referatCountsAsExam || referatCountsAsPartialWritten)) {
      referatEntries
        .filter((e) => e.studentId === student.id && (!cat.filter || e.halbjahr === cat.filter))
        .forEach((e) => {
          const gNum = isPoints ? storedGradeStringToNotenpunkte(e.note, 'points') : storedGradeStringToClassic(e.note, 'classic');
          const counted = e.gehalten === true && gNum !== null;
          lines.push({ label: `  Ref: ${e.thema || '—'}`, value: counted ? gfmtItem(gNum) : '-' });
        });
    }

    Object.entries(projects || {})
      .filter(([_, p]) => p.active && (p.weightingMode || 'written') === 'written' && (!cat.filter || p.halbjahr === cat.filter))
      .forEach(([id, p]) => {
        const counted = isProjectScoreCountedForStudent(p, student.id);
        const gr = getProjectGradeForStudent(p, student.id, customGradingKeys, gradeSys);
        lines.push({ label: `  Proj: ${p.name || id}`, value: counted && gr !== null ? gfmtItem(gr) : '-' });
      });

    lines.push({ label: '', value: '' });

    // 2. Mündlich
    lines.push({ label: `MÜNDLICH (${gfmtOverview(oralAvg)})`, value: '' });
    Object.entries(orals)
      .filter(([_, o]) => o.active !== false && (!cat.filter || o.halbjahr === cat.filter))
      .forEach(([id, o]) => {
        const { value, counted } = getNormalizedOralGrade(o.grades?.[student.id]);
        const oralG =
          counted && value !== undefined && value !== null && value !== ''
            ? isPoints
              ? storedGradeStringToNotenpunkte(String(value), 'points')
              : storedGradeStringToClassic(String(value), 'classic')
            : null;
        lines.push({ label: `  ${o.name || `Mündl. ${id}`}${counted ? '' : ' (n. gew.)'}`, value: counted && oralG !== null ? gfmtItem(oralG) : '-' });
      });

    if (showReferate && (referatCountsAsOral || referatCountsAsPartialOral)) {
      referatEntries
        .filter((e) => e.studentId === student.id && (!cat.filter || e.halbjahr === cat.filter))
        .forEach((e) => {
          const gNum = isPoints ? storedGradeStringToNotenpunkte(e.note, 'points') : storedGradeStringToClassic(e.note, 'classic');
          const counted = e.gehalten === true && gNum !== null;
          lines.push({ label: `  Ref: ${e.thema || '—'}`, value: counted ? gfmtItem(gNum) : '-' });
        });
    }

    Object.entries(projects || {})
      .filter(([_, p]) => p.active && (p.weightingMode || 'written') === 'oral' && (!cat.filter || p.halbjahr === cat.filter))
      .forEach(([id, p]) => {
        const counted = isProjectScoreCountedForStudent(p, student.id);
        const gr = getProjectGradeForStudent(p, student.id, customGradingKeys, gradeSys);
        lines.push({ label: `  Proj: ${p.name || id}`, value: counted && gr !== null ? gfmtItem(gr) : '-' });
      });

    lines.push({ label: '', value: '' });

    // 3. Tests
    if (testsWritten) {
      lines.push({ label: `TESTS (${gfmtCalc(testAvg)})`, value: '' });
      Object.entries(tests)
        .filter(([_, t]) => t.active && (!cat.filter || t.halbjahr === cat.filter))
        .forEach(([id, t]) => {
          const sm = t.scores ?? t.errors;
          const { counted } = getNormalizedTestScore(sm?.[student.id]);
          const gr = counted ? getTestGradeForStudent(t, student.id, customGradingKeys, gradeSys) : null;
          lines.push({ label: `  ${t.name || `Test ${id}`}${counted ? '' : ' (n. gew.)'}`, value: counted && gr !== null ? gfmtItem(gr) : '-' });
        });
      lines.push({ label: '', value: '' });
    }

    return lines;
  });

  // AOA aufbauen
  const aoa = [];
  aoa.push([`Schülerübersicht: ${student.lastName || ''}, ${student.firstName || ''}`]);

  const metaParts = [];
  if (config?.className) metaParts.push(`Klasse: ${config.className}`);
  if (config?.subject) metaParts.push(`Fach: ${config.subject}`);
  if (config?.year) metaParts.push(`Schuljahr: ${config.year}`);
  metaParts.push(`Stand: ${new Date().toLocaleDateString('de-DE')}`);
  aoa.push([metaParts.join('   |   ')]);
  aoa.push([]);

  // Maximale Zeilenanzahl ermitteln
  const maxRows = Math.max(...catColumns.map((c) => c.length), 0);

  for (let r = 0; r < maxRows; r++) {
    const row = [];
    catColumns.forEach((col, cIdx) => {
      if (cIdx > 0) row.push(''); // Leerspalte als Trenner
      const item = col[r] || { label: '', value: '' };
      row.push(item.label);
      row.push(item.value);
    });
    aoa.push(row);
  }

  // Notizen
  const hasNotes = String(student?.summaryNotes ?? '').trim() !== '';
  if (hasNotes) {
    aoa.push([]);
    aoa.push(['NOTIZEN:']);
    aoa.push([String(student.summaryNotes).trim()]);
  }

  // Layout für Excel
  const colWidths = [];
  const centerColumnIndexes = [];
  catColumns.forEach((_, cIdx) => {
    if (cIdx > 0) colWidths.push(4);
    colWidths.push(26); // Label
    const valCol = colWidths.length;
    colWidths.push(12); // Note/Wert
    centerColumnIndexes.push(valCol);
  });

  const rawName = `${student.lastName || ''}, ${student.firstName || ''}`.trim() || 'Schüler';
  return {
    name: rawName,
    aoa,
    layout: { colWidths, centerColumnIndexes },
  };
}

/**
 * Exportiert die Gesamtübersicht mit Details als Excel-Arbeitsmappe (Blatt 1: Übersicht, gefolgt von je 1 Blatt pro Schüler).
 */
export function exportAllStudentsOverviewXlsx({
  students = [],
  config,
  exams = {},
  orals = {},
  tests = {},
  projects = {},
  gfsEntries = [],
  referatEntries = [],
  filename,
}) {
  const sortedStudents = [...students].sort((a, b) =>
    (a.lastName || '').localeCompare(b.lastName || '', 'de') ||
    (a.firstName || '').localeCompare(b.firstName || '', 'de')
  );

  const sheets = [];

  // 1. Erstes Blatt: Komplette Klassenübersicht
  const overviewData = buildSummaryOverviewExportData({
    students: sortedStudents,
    exams,
    orals,
    tests,
    projects,
    gfsEntries,
    referatEntries,
    config,
  });
  sheets.push({
    name: 'Übersicht',
    aoa: [overviewData.headers, ...overviewData.rows],
    layout: overviewData.layout,
  });

  // 2. Weitere Blätter: Für jeden Schüler ein eigenes Tabellenblatt
  const resolvedGradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const resolvedCustomKeys = getCourseGradingKeysLookup(config?.customGradingKeys);
  const resolvedWeighting = resolveCourseWeighting(config?.weighting, config, exams, tests);

  const detailCtx = {
    config,
    exams,
    orals,
    tests,
    projects,
    gfsEntries,
    referatEntries,
    gradeSys: resolvedGradeSys,
    weighting: resolvedWeighting,
    customGradingKeys: resolvedCustomKeys,
    testsWritten: config?.testsWritten !== false,
    testsAsHalfExam: usesTestsAsHalfExam(config),
    testsAsOral: usesTestsAsOral(config),
    showGfs: config?.gfsAccepted !== false,
    showReferate: config?.referateAccepted === true,
    referatCountsAsExam: usesReferatAsExam(config),
    referatCountsAsOral: usesReferatAsOral(config),
    referatCountsAsPartialWritten: usesReferatWrittenPercent(config),
    referatWrittenPercent: config?.referatWrittenPercent ?? 100,
    referatCountsAsPartialOral: usesReferatOralPercent(config),
    referatOralPercent: config?.referatOralPercent ?? 100,
    referatCountsAsFinalPercent: usesReferatFinalPercent(config),
    referatFinalPercent: config?.referatFinalPercent ?? 100,
    kursstufe: config?.kursstufe === true,
  };

  sortedStudents.forEach((student) => {
    sheets.push(buildStudentOverviewXlsxSheet(student, detailCtx));
  });

  const outFilename = filename || summaryOverviewDetailsExportFilename(config, 'xlsx');
  downloadMultiSheetXlsx(sheets, outFilename);
}
