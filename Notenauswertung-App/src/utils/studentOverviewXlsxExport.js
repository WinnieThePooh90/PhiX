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
import { uniqueSheetName } from './phixXlsxExport';
import { buildStudentGradesChartSvg, STUDENT_CHART_WIDTH, STUDENT_CHART_HEIGHT } from './studentGradesChartSvg';
import { rasterizeSvgStringToPngDataUrl, pngDataUrlToBase64 } from './gradingKeyChartRaster';

const GRADE_OVERVIEW_CATEGORIES = [
  { label: 'Halbjahr 1', filter: '1' },
  { label: 'Halbjahr 2', filter: '2' },
  { label: 'Gesamt (Durchschnitt)', filter: null },
];

async function createWorkbook() {
  const ExcelJS = (await import('exceljs')).default;
  return new ExcelJS.Workbook();
}

function triggerBlobDownload(buffer, filename) {
  const out = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = out;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Erstellt die Zeilen für einen Einzelschüler.
 */
function getStudentCategoryLines(student, ctx) {
  const {
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

  return categories.map((cat) => {
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
      referatFinalPercentValue
    );

    const gfmtOverview = (g) => formatOverviewCalculatedGrade(g, gradeSys, valuesAreNotenpunkte);
    const gfmtCalc = (g) => formatCalculatedGradeValue(g, gradeSys, valuesAreNotenpunkte);
    const gfmtItem = (g) => formatGrade(g, gradeSys, isPoints ? { inputScale: 'notenpunkte' } : undefined);
    const rounded = finalGrade !== null ? Math.round(finalGrade) : null;

    const lines = [];
    lines.push({
      label: cat.label.toUpperCase(),
      value: `${gfmtOverview(finalGrade)} (${rounded !== null ? gfmtCalc(rounded) : '-'})`,
      isHeader: true,
    });
    lines.push({ label: '', value: '' });

    // 1. Schriftlich
    lines.push({ label: `SCHRIFTLICH (${gfmtOverview(examAvg)})`, value: '', isSection: true });
    Object.entries(exams)
      .filter(([_, e]) => e.active && (!cat.filter || e.halbjahr === cat.filter))
      .sort(([a], [b]) => Number(a) - Number(b))
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
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([id, p]) => {
        const counted = isProjectScoreCountedForStudent(p, student.id);
        const gr = getProjectGradeForStudent(p, student.id, customGradingKeys, gradeSys);
        lines.push({ label: `  Proj: ${p.name || id}`, value: counted && gr !== null ? gfmtItem(gr) : '-' });
      });

    lines.push({ label: '', value: '' });

    // 2. Mündlich
    lines.push({ label: `MÜNDLICH (${gfmtOverview(oralAvg)})`, value: '', isSection: true });
    Object.entries(orals)
      .filter(([_, o]) => o.active !== false && (!cat.filter || o.halbjahr === cat.filter))
      .sort(([a], [b]) => Number(a) - Number(b))
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
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([id, p]) => {
        const counted = isProjectScoreCountedForStudent(p, student.id);
        const gr = getProjectGradeForStudent(p, student.id, customGradingKeys, gradeSys);
        lines.push({ label: `  Proj: ${p.name || id}`, value: counted && gr !== null ? gfmtItem(gr) : '-' });
      });

    lines.push({ label: '', value: '' });

    // 3. Tests
    if (testsWritten) {
      lines.push({ label: `TESTS (${gfmtCalc(testAvg)})`, value: '', isSection: true });
      Object.entries(tests)
        .filter(([_, t]) => t.active && (!cat.filter || t.halbjahr === cat.filter))
        .sort(([a], [b]) => Number(a) - Number(b))
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
}

/**
 * Fügt ein Schüler-Arbeitsblatt mit Noten, Notizen und eingebettetem Diagramm zum ExcelJS-Workbook hinzu.
 */
async function appendStudentWorksheet(wb, student, ctx, usedNames) {
  const rawName = `${student.lastName || ''}, ${student.firstName || ''}`.trim() || 'Schüler';
  const sheetName = uniqueSheetName(rawName, usedNames);
  const ws = wb.addWorksheet(sheetName);

  const { config } = ctx;

  // 1. Titel & Metadaten
  const titleRow = ws.addRow([`Schülerübersicht: ${student.lastName || ''}, ${student.firstName || ''}`]);
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } };
  titleRow.height = 24;

  const metaParts = [];
  if (config?.className) metaParts.push(`Klasse: ${config.className}`);
  if (config?.subject) metaParts.push(`Fach: ${config.subject}`);
  if (config?.year) metaParts.push(`Schuljahr: ${config.year}`);
  metaParts.push(`Stand: ${new Date().toLocaleDateString('de-DE')}`);

  const metaRow = ws.addRow([metaParts.join('   |   ')]);
  metaRow.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF64748B' } };
  metaRow.height = 18;

  ws.addRow([]); // Leerzeile

  // 2. Noten-Tabellenzeilen
  const catColumns = getStudentCategoryLines(student, ctx);
  const maxRows = Math.max(...catColumns.map((c) => c.length), 0);

  const tableStartRowNum = ws.rowCount + 1;

  for (let r = 0; r < maxRows; r++) {
    const rowCells = [];
    catColumns.forEach((col, cIdx) => {
      if (cIdx > 0) rowCells.push(''); // Leerspalte als Trenner
      const item = col[r] || { label: '', value: '' };
      rowCells.push(item.label);
      rowCells.push(item.value);
    });

    const row = ws.addRow(rowCells);
    row.height = 18;

    // Styling
    catColumns.forEach((col, cIdx) => {
      const item = col[r] || { label: '', value: '' };
      const colOffset = cIdx * 3; // 2 Daten-Spalten + 1 Trenner-Spalte
      const labelCell = row.getCell(colOffset + 1);
      const valueCell = row.getCell(colOffset + 2);

      if (item.isHeader) {
        labelCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        valueCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
        valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (item.isSection) {
        labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      } else if (item.label) {
        labelCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
        valueCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  }

  // 3. Notizen
  const hasNotes = String(student?.summaryNotes ?? '').trim() !== '';
  if (hasNotes) {
    ws.addRow([]);
    const nHeader = ws.addRow(['NOTIZEN:']);
    nHeader.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
    const nText = ws.addRow([String(student.summaryNotes).trim()]);
    nText.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
  }

  // 4. Spaltenbreiten einstellen
  const cols = [];
  catColumns.forEach((_, cIdx) => {
    if (cIdx > 0) cols.push({ width: 4 }); // Trenner
    cols.push({ width: 28 }); // Label
    cols.push({ width: 12 }); // Note
  });
  ws.columns = cols;

  // 5. Diagramm generieren, rasterisieren und einbetten
  try {
    const svgString = buildStudentGradesChartSvg({
      ...ctx,
      student,
      width: STUDENT_CHART_WIDTH,
      height: STUDENT_CHART_HEIGHT,
    });
    const pngDataUrl = await rasterizeSvgStringToPngDataUrl(svgString, STUDENT_CHART_WIDTH, STUDENT_CHART_HEIGHT);
    const chartBase64 = pngDataUrlToBase64(pngDataUrl);

    if (chartBase64) {
      const imageId = wb.addImage({
        base64: chartBase64,
        extension: 'png',
      });

      ws.addRow([]); // Leerzeile vor Diagramm
      const chartStartRow = ws.rowCount;

      ws.addImage(imageId, {
        tl: { col: 0, row: chartStartRow },
        ext: { width: 680, height: 255 },
      });

      // Zeilenhöhe für das Diagramm reservieren (~13 Zeilen à 20pt)
      for (let i = 0; i < 14; i++) {
        const r = ws.addRow([]);
        r.height = 18;
      }
    }
  } catch (err) {
    console.error(`Fehler beim Erstellen des Diagramms für ${rawName}:`, err);
  }
}

/**
 * Exportiert die Gesamtübersicht mit Details als Excel-Arbeitsmappe (Blatt 1: Übersicht, gefolgt von je 1 Blatt pro Schüler inkl. Diagramm).
 */
export async function exportAllStudentsOverviewXlsx({
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

  const wb = await createWorkbook();
  const usedNames = new Set();

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

  for (const student of sortedStudents) {
    await appendStudentWorksheet(wb, student, detailCtx, usedNames);
  }

  const outFilename = filename || summaryOverviewDetailsExportFilename(config, 'xlsx');
  const buffer = await wb.xlsx.writeBuffer();
  triggerBlobDownload(buffer, outFilename);
}

/**
 * Exportiert die Übersicht eines einzelnen Schülers als Excel-Datei inkl. Notentabelle, Notizen und Diagramm.
 */
export async function exportStudentOverviewXlsx({
  student,
  config,
  exams = {},
  orals = {},
  tests = {},
  projects = {},
  gfsEntries = [],
  referatEntries = [],
  filename,
}) {
  if (!student) return;
  const wb = await createWorkbook();
  const usedNames = new Set();

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

  await appendStudentWorksheet(wb, student, detailCtx, usedNames);

  const outFilename = filename || `${student.lastName || 'Schueler'}_${student.firstName || ''}_Uebersicht.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  triggerBlobDownload(buffer, outFilename);
}

