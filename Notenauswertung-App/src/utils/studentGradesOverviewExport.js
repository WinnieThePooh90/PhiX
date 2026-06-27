import {
  calculateStudentGrades,
  formatCalculatedGradeValue,
  formatGrade,
  formatOverviewCalculatedGrade,
  getExamGradeForStudent,
  getTestGradeForStudent,
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  getNormalizedOralGrade,
  getNormalizedTestScore,
  getProjectGradeForStudent,
  getProjectScoreKeyForStudent,
  getStudentEffectiveProjectFieldCount,
  getProjectPillarWeightPercent,
  isProjectScoreCountedForStudent,
  storedGradeStringToClassic,
} from './calculator';
import {
  usesTestsAsHalfExam,
  usesTestsAsOral,
  usesReferatAsExam,
  usesReferatAsOral,
  usesReferatWrittenPercent,
  usesReferatOralPercent,
  usesReferatFinalPercent,
} from './courseWeightingOptions';

const GRADE_OVERVIEW_CATEGORIES = [
  { label: 'Halbjahr 1', filter: '1' },
  { label: 'Halbjahr 2', filter: '2' },
  { label: 'Gesamt (Durchschnitt)', filter: null },
];

function filterProjectsForSummary(projects, weightingMode, halbjahrFilter) {
  return Object.entries(projects || {})
    .filter(([_, p]) => p.active && (p.weightingMode || 'written') === weightingMode && (!halbjahrFilter || p.halbjahr === halbjahrFilter))
    .sort(([a], [b]) => Number(a) - Number(b));
}

function formatGradeDisplay(grade, gradeSys, valuesAreNotenpunkte = false) {
  if (grade === null || grade === undefined) return '-';
  return formatGrade(grade, gradeSys, valuesAreNotenpunkte ? { inputScale: 'notenpunkte' } : undefined);
}

function formatOverviewDisplay(grade, gradeSys, valuesAreNotenpunkte = false) {
  if (grade === null || grade === undefined) return '-';
  return formatOverviewCalculatedGrade(grade, gradeSys, valuesAreNotenpunkte);
}

function formatCalcDisplay(grade, gradeSys, valuesAreNotenpunkte = false) {
  if (grade === null || grade === undefined) return '-';
  return formatCalculatedGradeValue(grade, gradeSys, valuesAreNotenpunkte);
}

function buildReferatItems({
  entries,
  studentId,
  halbjahrFilter,
  gradeSys,
  active,
  suffix = '',
}) {
  if (!active) return [];
  return entries
    .filter((e) => e.studentId === studentId && (!halbjahrFilter || e.halbjahr === halbjahrFilter))
    .map((e) => {
      const thema = String(e.thema ?? '').trim() || '—';
      const gNum = storedGradeStringToClassic(e.note, gradeSys);
      const counted = e.gehalten === true && gNum !== null;
      return {
        label: `Referat: ${thema}${suffix}`,
        grade: counted ? formatGradeDisplay(gNum, gradeSys) : '-',
        counted,
      };
    });
}

function buildProjectItems(projectEntries, studentId, customGradingKeys, gradeSys) {
  return projectEntries.map(([id, p]) => {
    const counted = isProjectScoreCountedForStudent(p, studentId);
    const gr = getProjectGradeForStudent(p, studentId, customGradingKeys, gradeSys);
    let pct = '';
    if (p.weightingMode === 'percent' && Number.isFinite(Number(p.weightPercent)) && Number(p.weightPercent) > 0) {
      pct = ` (${p.weightPercent}%)`;
    } else if (p.weightingMode === 'written' || p.weightingMode === 'oral') {
      const pillarPct = getProjectPillarWeightPercent(p);
      if (pillarPct < 100) pct = ` (${pillarPct} %)`;
    }
    return {
      label: `${p.name || `Projekt ${id}`}${pct}`,
      grade: counted && gr !== null ? formatGradeDisplay(gr, gradeSys, gradeSys === 'points') : '-',
      counted,
    };
  });
}

function buildOverviewCategories(kursstufe) {
  return kursstufe
    ? [{ label: 'Gesamt (Durchschnitt)', filter: null }]
    : GRADE_OVERVIEW_CATEGORIES;
}

/**
 * Strukturierte Detaildaten je Halbjahr/Gesamt — analog zur aufklappbaren Übersicht.
 */
export function buildStudentGradesOverviewDetailSections(student, ctx) {
  const {
    exams,
    orals,
    tests,
    projects,
    gfsEntries,
    referatEntries,
    gradeSys,
    weighting,
    customGradingKeys,
    testsWritten,
    testsAsHalfExam,
    testsAsOral,
    showGfs,
    showReferate,
    referatCountsAsExam,
    referatCountsAsOral,
    referatCountsAsPartialWritten,
    referatWrittenPercent,
    referatCountsAsPartialOral,
    referatOralPercent,
    referatCountsAsFinalPercent,
    referatFinalPercent,
    kursstufe,
  } = ctx;

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

  return buildOverviewCategories(kursstufe).map((cat) => {
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
    const rounded = finalGrade !== null ? Math.round(finalGrade) : null;
    const writtenProjects = filterProjectsForSummary(projects, 'written', cat.filter);
    const oralProjects = filterProjectsForSummary(projects, 'oral', cat.filter);
    const percentProjects = filterProjectsForSummary(projects, 'percent', cat.filter);

    const writtenItems = [
      ...Object.entries(exams)
        .filter(([_, e]) => e.active && (!cat.filter || e.halbjahr === cat.filter))
        .map(([id, e]) => {
          const { counted } = getNormalizedExamScore(
            e.scores?.[student.id],
            getStudentEffectiveExamFieldCount(e, student.id),
          );
          const gr = getExamGradeForStudent(e, student.id, customGradingKeys, gradeSys);
          return {
            label: `KA ${id}`,
            grade: counted && gr !== null ? formatGradeDisplay(gr, gradeSys, gradeSys === 'points') : '-',
            counted,
          };
        }),
      ...(showGfs
        ? gfsEntries
          .filter((e) => e.studentId === student.id && (!cat.filter || e.halbjahr === cat.filter))
          .map((e) => {
            const thema = String(e.thema ?? '').trim() || '—';
            const gNum = storedGradeStringToClassic(e.note, gradeSys);
            const counted = e.gehalten === true && gNum !== null;
            return {
              label: `GFS: ${thema}`,
              grade: counted ? formatGradeDisplay(gNum, gradeSys) : '-',
              counted,
            };
          })
        : []),
      ...buildReferatItems({
        entries: referatEntries,
        studentId: student.id,
        halbjahrFilter: cat.filter,
        gradeSys,
        active: showReferate && referatCountsAsExam,
      }),
      ...buildReferatItems({
        entries: referatEntries,
        studentId: student.id,
        halbjahrFilter: cat.filter,
        gradeSys,
        active: showReferate && referatCountsAsPartialWritten,
        suffix: referatCountsAsPartialWritten ? ` (${Math.round(referatWrittenPercent)} %)` : '',
      }),
      ...buildProjectItems(writtenProjects, student.id, customGradingKeys, gradeSys),
    ];

    const oralItems = [
      ...Object.entries(orals)
        .filter(([_, o]) => o.active !== false && (!cat.filter || o.halbjahr === cat.filter))
        .map(([id, o]) => {
          const { value, counted } = getNormalizedOralGrade(o.grades[student.id]);
          const oralG = counted && value ? storedGradeStringToClassic(String(value), gradeSys) : null;
          return {
            label: o.name || `Mündlich ${id}`,
            grade: counted && oralG !== null ? formatGradeDisplay(oralG, gradeSys) : '-',
            counted,
          };
        }),
      ...buildReferatItems({
        entries: referatEntries,
        studentId: student.id,
        halbjahrFilter: cat.filter,
        gradeSys,
        active: showReferate && referatCountsAsOral,
      }),
      ...buildReferatItems({
        entries: referatEntries,
        studentId: student.id,
        halbjahrFilter: cat.filter,
        gradeSys,
        active: showReferate && referatCountsAsPartialOral,
        suffix: referatCountsAsPartialOral ? ` (${Math.round(referatOralPercent)} %)` : '',
      }),
      ...buildProjectItems(oralProjects, student.id, customGradingKeys, gradeSys),
    ];

    const testItems = testsWritten
      ? Object.entries(tests)
        .filter(([_, t]) => t.active && (!cat.filter || t.halbjahr === cat.filter))
        .map(([id, t]) => {
          const sm = t.scores ?? t.errors;
          const { counted } = getNormalizedTestScore(sm?.[student.id]);
          const gr = counted ? getTestGradeForStudent(t, student.id, customGradingKeys, gradeSys) : null;
          return {
            label: t.name || `Test ${id}`,
            grade: counted && gr !== null ? formatGradeDisplay(gr, gradeSys, gradeSys === 'points') : '-',
            counted,
          };
        })
      : [];

    const percentItems = [
      ...buildProjectItems(percentProjects, student.id, customGradingKeys, gradeSys),
      ...buildReferatItems({
        entries: referatEntries,
        studentId: student.id,
        halbjahrFilter: cat.filter,
        gradeSys,
        active: showReferate && referatCountsAsFinalPercent,
        suffix: referatCountsAsFinalPercent ? ` (${Math.round(referatFinalPercent)} %)` : '',
      }),
    ];

    return {
      label: cat.label,
      finalGrade: formatOverviewDisplay(finalGrade, gradeSys, valuesAreNotenpunkte),
      finalRounded: formatCalcDisplay(rounded, gradeSys, valuesAreNotenpunkte),
      written: {
        average: formatOverviewDisplay(examAvg, gradeSys, valuesAreNotenpunkte),
        items: writtenItems,
      },
      oral: {
        average: formatOverviewDisplay(oralAvg, gradeSys, valuesAreNotenpunkte),
        items: oralItems,
      },
      tests: {
        average: formatCalcDisplay(testAvg, gradeSys, valuesAreNotenpunkte),
        items: testItems,
      },
      percent: {
        items: percentItems,
        title: percentProjects.length > 0 ? 'Projekte (prozentual)' : 'Gesamtnote (prozentual)',
      },
    };
  });
}

function detailRow(colCount, label, value = '') {
  const row = Array(colCount).fill('');
  row[1] = label;
  if (value !== '') row[colCount - 1] = value;
  return row;
}

function itemRow(colCount, item) {
  const prefix = item.counted === false ? '  ' : '  ';
  const label = item.counted === false ? `${prefix}${item.label} (nicht gewertet)` : `${prefix}${item.label}`;
  return detailRow(colCount, label, item.grade);
}

/**
 * @param {object} student
 * @param {ReturnType<typeof buildStudentGradesOverviewDetailSections>} sections
 * @param {number} colCount
 */
export function buildStudentGradesOverviewDetailExportRows(student, sections, colCount) {
  const name = `${student.lastName ?? ''}, ${student.firstName ?? ''}`.trim();
  const rows = [detailRow(colCount, `Details — ${name}`)];

  for (const section of sections) {
    rows.push(detailRow(colCount, section.label, `${section.finalGrade} (${section.finalRounded})`));
    rows.push(detailRow(colCount, `Schriftlich (${section.written.average})`));
    for (const item of section.written.items) rows.push(itemRow(colCount, item));
    rows.push(detailRow(colCount, `Mündlich (${section.oral.average})`));
    for (const item of section.oral.items) rows.push(itemRow(colCount, item));
    if (section.tests.items.length > 0) {
      rows.push(detailRow(colCount, `Tests (${section.tests.average})`));
      for (const item of section.tests.items) rows.push(itemRow(colCount, item));
    }
    if (section.percent.items.length > 0) {
      rows.push(detailRow(colCount, section.percent.title));
      for (const item of section.percent.items) rows.push(itemRow(colCount, item));
    }
    rows.push(detailRow(colCount, ''));
  }

  return rows;
}

export function buildSummaryOverviewDetailContext({
  exams,
  orals,
  tests,
  projects,
  gfsEntries,
  referatEntries,
  config,
  gradeSys,
  weighting,
  customGradingKeys,
}) {
  return {
    exams,
    orals,
    tests,
    projects,
    gfsEntries,
    referatEntries,
    gradeSys,
    weighting,
    customGradingKeys,
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
}
