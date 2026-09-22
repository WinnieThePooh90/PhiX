import { jsPDF } from 'jspdf';
import { triggerPdfDownload } from './phixPdfExport';
import { studentOverviewExportFilename, summaryOverviewDetailsExportFilename } from './exportFilenames';
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
} from './courseWeightingOptions';

const GRADE_OVERVIEW_CATEGORIES = [
  { label: 'Halbjahr 1', filter: '1' },
  { label: 'Halbjahr 2', filter: '2' },
  { label: 'Gesamt (Durchschnitt)', filter: null },
];

const COLORS = {
  exam: [249, 115, 22],        // Orange #f97316
  oral: [59, 130, 246],        // Blau #3b82f6
  test: [34, 197, 94],         // Grün #22c55e
  gfs_referat: [234, 179, 8],  // Gelb #eab308
  project: [168, 85, 247],     // Lila #a855f7
  textDark: [30, 41, 59],      // #1e293b
  textMuted: [100, 116, 139],  // #64748b
  border: [226, 232, 240],     // #e2e8f0
  bgMuted: [248, 250, 252],    // #f8fafc
  headerBg: [241, 245, 249],   // #f1f5f9
};

/**
 * Rendert genau 1 DIN A4 Querformat Seite für einen Schüler auf das gegebene jsPDF Dokument.
 */
export function renderStudentOverviewPage(doc, {
  student,
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
}) {
  if (!student) return;

  const pw = 297;
  const ph = 210;
  const margin = 12;
  const contentW = pw - margin * 2; // 273mm

  const isPoints = normalizeCourseGradeSystem(gradeSys) === 'points';

  // --- 1. HEADER ---
  let y = margin + 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.textDark);
  doc.text(`Schülerübersicht: ${student.lastName || ''}, ${student.firstName || ''}`, margin, y);

  // Meta-Daten rechts
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.textMuted);

  const metaParts = [];
  if (config?.className) metaParts.push(`Klasse: ${config.className}`);
  if (config?.subject) metaParts.push(`Fach: ${config.subject}`);
  if (config?.year) metaParts.push(`Schuljahr: ${config.year}`);
  metaParts.push(`Stand: ${new Date().toLocaleDateString('de-DE')}`);

  doc.text(metaParts.join('   |   '), pw - margin, y, { align: 'right' });

  y += 3.5;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pw - margin, y);
  y += 4;

  // --- 2. NOTENÜBERSICHT (3 Spalten: HJ1, HJ2, Gesamt) ---
  const categories = kursstufe
    ? [{ label: 'Gesamt (Durchschnitt)', filter: null }]
    : GRADE_OVERVIEW_CATEGORIES;

  const numCols = categories.length;
  const gapCols = 4;
  const colW = (contentW - (numCols - 1) * gapCols) / numCols;
  const tableStartY = y;
  const tableH = 76; // Höhe der Tabellenboxen

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

  categories.forEach((cat, colIdx) => {
    const colX = margin + colIdx * (colW + gapCols);

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

    // Kasten-Hintergrund & Rahmen
    doc.setFillColor(...COLORS.bgMuted);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(colX, tableStartY, colW, tableH, 1.5, 1.5, 'FD');

    // Header-Balken
    doc.setFillColor(...COLORS.headerBg);
    doc.roundedRect(colX, tableStartY, colW, 9, 1.5, 1.5, 'F');
    doc.rect(colX, tableStartY + 5, colW, 4, 'F');
    doc.line(colX, tableStartY + 9, colX + colW, tableStartY + 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.textDark);
    doc.text(cat.label, colX + 2.5, tableStartY + 6);

    const finalGradeStr = `${gfmtOverview(finalGrade)} (${rounded !== null ? gfmtCalc(rounded) : '-'})`;
    doc.text(finalGradeStr, colX + colW - 2.5, tableStartY + 6, { align: 'right' });

    // Inhalt der Spalte
    let curY = tableStartY + 12.5;
    const lineHeight = 3.3;

    // 1. Schriftlich
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`SCHRIFTLICH (${gfmtOverview(examAvg)})`, colX + 2.5, curY);
    curY += lineHeight;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.textMuted);

    // Klausuren
    Object.entries(exams)
      .filter(([_, e]) => e.active && (!cat.filter || e.halbjahr === cat.filter))
      .forEach(([id, e]) => {
        const { counted } = getNormalizedExamScore(
          e.scores?.[student.id],
          getStudentEffectiveExamFieldCount(e, student.id)
        );
        const gr = getExamGradeForStudent(e, student.id, customGradingKeys, gradeSys);
        const name = e.name ? e.name : `KA ${id}`;
        const valStr = counted && gr !== null ? gfmtItem(gr) : '-';
        doc.text(name + (counted ? ':' : ' (n. gew.):'), colX + 3.5, curY);
        doc.text(valStr, colX + colW - 3.5, curY, { align: 'right' });
        curY += lineHeight;
      });

    // GFS
    if (showGfs) {
      gfsEntries
        .filter((e) => e.studentId === student.id && (!cat.filter || e.halbjahr === cat.filter))
        .forEach((e) => {
          const gNum = isPoints
            ? storedGradeStringToNotenpunkte(e.note, 'points')
            : storedGradeStringToClassic(e.note, 'classic');
          const counted = e.gehalten === true && gNum !== null;
          const valStr = counted ? gfmtItem(gNum) : '-';
          doc.text(`GFS: ${e.thema || '—'}`, colX + 3.5, curY);
          doc.text(valStr, colX + colW - 3.5, curY, { align: 'right' });
          curY += lineHeight;
        });
    }

    // Referate (Schriftlich)
    if (showReferate && (referatCountsAsExam || referatCountsAsPartialWritten)) {
      referatEntries
        .filter((e) => e.studentId === student.id && (!cat.filter || e.halbjahr === cat.filter))
        .forEach((e) => {
          const gNum = isPoints
            ? storedGradeStringToNotenpunkte(e.note, 'points')
            : storedGradeStringToClassic(e.note, 'classic');
          const counted = e.gehalten === true && gNum !== null;
          const valStr = counted ? gfmtItem(gNum) : '-';
          doc.text(`Ref: ${e.thema || '—'}`, colX + 3.5, curY);
          doc.text(valStr, colX + colW - 3.5, curY, { align: 'right' });
          curY += lineHeight;
        });
    }

    // Projekte (Schriftlich)
    Object.entries(projects || {})
      .filter(([_, p]) => p.active && (p.weightingMode || 'written') === 'written' && (!cat.filter || p.halbjahr === cat.filter))
      .forEach(([id, p]) => {
        const counted = isProjectScoreCountedForStudent(p, student.id);
        const gr = getProjectGradeForStudent(p, student.id, customGradingKeys, gradeSys);
        const valStr = counted && gr !== null ? gfmtItem(gr) : '-';
        doc.text(`Proj: ${p.name || id}`, colX + 3.5, curY);
        doc.text(valStr, colX + colW - 3.5, curY, { align: 'right' });
        curY += lineHeight;
      });

    curY += 1;

    // 2. Mündlich
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`MÜNDLICH (${gfmtOverview(oralAvg)})`, colX + 2.5, curY);
    curY += lineHeight;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.textMuted);

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
        const valStr = counted && oralG !== null ? gfmtItem(oralG) : '-';
        doc.text((o.name || `Mündl. ${id}`) + (counted ? ':' : ' (n. gew.):'), colX + 3.5, curY);
        doc.text(valStr, colX + colW - 3.5, curY, { align: 'right' });
        curY += lineHeight;
      });

    curY += 1;

    // 3. Tests
    if (testsWritten) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(`TESTS (${gfmtCalc(testAvg)})`, colX + 2.5, curY);
      curY += lineHeight;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(...COLORS.textMuted);

      Object.entries(tests)
        .filter(([_, t]) => t.active && (!cat.filter || t.halbjahr === cat.filter))
        .forEach(([id, t]) => {
          const sm = t.scores ?? t.errors;
          const { counted } = getNormalizedTestScore(sm?.[student.id]);
          const gr = counted ? getTestGradeForStudent(t, student.id, customGradingKeys, gradeSys) : null;
          const valStr = counted && gr !== null ? gfmtItem(gr) : '-';
          doc.text((t.name || `Test ${id}`) + (counted ? ':' : ' (n. gew.):'), colX + 3.5, curY);
          doc.text(valStr, colX + colW - 3.5, curY, { align: 'right' });
          curY += lineHeight;
        });
    }
  });

  y = tableStartY + tableH + 4;

  // --- 3. DIAGRAMM & NOTIZEN (UNTEN) ---
  const hasNotes = String(student?.summaryNotes ?? '').trim() !== '';
  const bottomH = ph - margin - y - 1; // ca. 75mm

  const chartW = hasNotes ? contentW * 0.65 : contentW;
  const notesW = hasNotes ? contentW - chartW - 4 : 0;
  const chartX = margin;
  const notesX = chartX + chartW + 4;

  // --- A. NOTENVERLAUF-DIAGRAMM ---
  doc.setFillColor(...COLORS.bgMuted);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(chartX, y, chartW, bottomH, 1.5, 1.5, 'FD');

  // Titel Diagramm
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textDark);
  doc.text('NOTENVERLAUF (NACH NR.)', chartX + 3, y + 5);

  // Diagramm-Rechteck
  const diagPadL = 12;
  const diagPadR = hasNotes ? 38 : 48; // Platz für Legende rechts im Diagrammfeld
  const diagPadT = 9;
  const diagPadB = 10;
  const plotX = chartX + diagPadL;
  const plotY = y + diagPadT;
  const plotW = chartW - diagPadL - diagPadR;
  const plotH = bottomH - diagPadT - diagPadB;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(plotX, plotY, plotW, plotH, 1, 1, 'FD');

  // Datenpunkte sammeln
  const examList = [];
  const testList = [];
  const oralList = [];
  const gfsReferatList = [];
  const projectList = [];

  Object.entries(exams || {})
    .filter(([_, e]) => e && e.active)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([id, e]) => {
      const { counted } = getNormalizedExamScore(e.scores?.[student.id], getStudentEffectiveExamFieldCount(e, student.id));
      const gr = getExamGradeForStudent(e, student.id, customGradingKeys, gradeSys);
      if (counted && gr !== null && Number.isFinite(gr)) {
        examList.push({ id: `exam-${id}`, type: 'exam', xIndex: examList.length + 1, grade: gr, color: COLORS.exam });
      }
    });

  if (testsWritten) {
    Object.entries(tests || {})
      .filter(([_, t]) => t && t.active)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([id, t]) => {
        const sm = t.scores ?? t.errors;
        const { counted } = getNormalizedTestScore(sm?.[student.id]);
        const gr = counted ? getTestGradeForStudent(t, student.id, customGradingKeys, gradeSys) : null;
        if (counted && gr !== null && Number.isFinite(gr)) {
          testList.push({ id: `test-${id}`, type: 'test', xIndex: testList.length + 1, grade: gr, color: COLORS.test });
        }
      });
  }

  Object.entries(orals || {})
    .filter(([_, o]) => o && o.active !== false)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([id, o]) => {
      const { value, counted } = getNormalizedOralGrade(o.grades?.[student.id]);
      const oralG =
        counted && value !== undefined && value !== null && value !== ''
          ? isPoints
            ? storedGradeStringToNotenpunkte(String(value), 'points')
            : storedGradeStringToClassic(String(value), 'classic')
          : null;
      if (counted && oralG !== null && Number.isFinite(oralG)) {
        oralList.push({ id: `oral-${id}`, type: 'oral', xIndex: oralList.length + 1, grade: oralG, color: COLORS.oral });
      }
    });

  if (showGfs && Array.isArray(gfsEntries)) {
    gfsEntries
      .filter((e) => e && e.studentId === student.id)
      .forEach((e) => {
        const gNum = isPoints ? storedGradeStringToNotenpunkte(e.note, 'points') : storedGradeStringToClassic(e.note, 'classic');
        if (e.gehalten === true && gNum !== null && Number.isFinite(gNum)) {
          gfsReferatList.push({ id: `gfs-${e.id}`, type: 'gfs_referat', xIndex: gfsReferatList.length + 1, grade: gNum, color: COLORS.gfs_referat });
        }
      });
  }

  if (showReferate && Array.isArray(referatEntries)) {
    referatEntries
      .filter((e) => e && e.studentId === student.id)
      .forEach((e) => {
        const gNum = isPoints ? storedGradeStringToNotenpunkte(e.note, 'points') : storedGradeStringToClassic(e.note, 'classic');
        if (e.gehalten === true && gNum !== null && Number.isFinite(gNum)) {
          gfsReferatList.push({ id: `ref-${e.id}`, type: 'gfs_referat', xIndex: gfsReferatList.length + 1, grade: gNum, color: COLORS.gfs_referat });
        }
      });
  }

  Object.entries(projects || {})
    .filter(([_, p]) => p && p.active)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([id, p]) => {
      const counted = isProjectScoreCountedForStudent(p, student.id);
      const gr = getProjectGradeForStudent(p, student.id, customGradingKeys, gradeSys);
      if (counted && gr !== null && Number.isFinite(gr)) {
        projectList.push({ id: `proj-${id}`, type: 'project', xIndex: projectList.length + 1, grade: gr, color: COLORS.project });
      }
    });

  const maxX = Math.max(1, examList.length, testList.length, oralList.length, gfsReferatList.length, projectList.length);

  // Y-Skalierungsfunktion (1..6 unten nach oben, bzw. 0..15 unten nach oben)
  const getPdfY = (val) => {
    if (isPoints) {
      const clamped = Math.max(0, Math.min(15, val));
      return plotY + plotH - (clamped / 15) * plotH;
    }
    const clamped = Math.max(1, Math.min(6, val));
    return plotY + plotH - ((clamped - 1) / 5) * plotH;
  };

  const getPdfX = (xIdx) => {
    const step = plotW / (maxX + 1);
    return plotX + xIdx * step;
  };

  // Horizontale Grid-Linien
  const yTicks = isPoints ? [0, 3, 6, 9, 12, 15] : [1, 2, 3, 4, 5, 6];
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.textMuted);
  doc.setLineWidth(0.15);

  yTicks.forEach((tickVal) => {
    const py = getPdfY(tickVal);
    doc.setDrawColor(241, 245, 249);
    doc.line(plotX, py, plotX + plotW, py);
    doc.text(String(tickVal), plotX - 1.5, py + 0.8, { align: 'right' });
  });

  // Vertikale Grid-Linien
  for (let i = 1; i <= maxX; i++) {
    const px = getPdfX(i);
    doc.setDrawColor(241, 245, 249);
    doc.line(px, plotY, px, plotY + plotH);
    doc.text(String(i), px, plotY + plotH + 3.5, { align: 'center' });
  }

  // Achsenbeschriftungen
  doc.setFontSize(5.5);
  doc.text('Note Nr. (x)', plotX + plotW, plotY + plotH + 3.5, { align: 'right' });
  doc.text(isPoints ? 'Notenpunkte' : 'Note', plotX - 1.5, plotY - 1.5, { align: 'left' });

  // Alle Punkte zusammenfassen mit Cluster-Offset
  const allPdfPoints = [...examList, ...testList, ...oralList, ...gfsReferatList, ...projectList];
  const byX = new Map();
  allPdfPoints.forEach((p) => {
    if (!byX.has(p.xIndex)) byX.set(p.xIndex, []);
    byX.get(p.xIndex).push(p);
  });

  const pdfPointsWithCoords = [];
  const Y_COLLISION_THRESHOLD_MM = 3.5;

  byX.forEach((itemsAtX) => {
    const sorted = [...itemsAtX].sort((a, b) => getPdfY(a.grade) - getPdfY(b.grade));
    const clusters = [];
    let curCluster = [];
    sorted.forEach((item) => {
      if (curCluster.length === 0) {
        curCluster.push(item);
      } else {
        const last = curCluster[curCluster.length - 1];
        if (Math.abs(getPdfY(item.grade) - getPdfY(last.grade)) < Y_COLLISION_THRESHOLD_MM) {
          curCluster.push(item);
        } else {
          clusters.push(curCluster);
          curCluster = [item];
        }
      }
    });
    if (curCluster.length > 0) clusters.push(curCluster);

    clusters.forEach((cluster) => {
      const m = cluster.length;
      cluster.forEach((item, idx) => {
        let xOffset = 0;
        if (m === 2) xOffset = idx === 0 ? -1.8 : 1.8;
        else if (m === 3) xOffset = (idx - 1) * 2;
        else if (m >= 4) xOffset = (idx - (m - 1) / 2) * 2;

        pdfPointsWithCoords.push({
          ...item,
          x: getPdfX(item.xIndex) + xOffset,
          y: getPdfY(item.grade),
          formattedGrade: formatGrade(item.grade, gradeSys, isPoints ? { inputScale: 'notenpunkte' } : undefined),
        });
      });
    });
  });

  // Verbindungslinien pro Notentyp
  const seriesGroups = [
    { items: examList, color: COLORS.exam },
    { items: oralList, color: COLORS.oral },
    { items: testList, color: COLORS.test },
    { items: gfsReferatList, color: COLORS.gfs_referat },
    { items: projectList, color: COLORS.project },
  ];

  doc.setLineWidth(0.35);
  seriesGroups.forEach((sg) => {
    if (sg.items.length > 1) {
      doc.setDrawColor(...sg.color);
      for (let i = 0; i < sg.items.length - 1; i++) {
        const p1 = pdfPointsWithCoords.find((p) => p.id === sg.items[i].id);
        const p2 = pdfPointsWithCoords.find((p) => p.id === sg.items[i + 1].id);
        if (p1 && p2) {
          doc.line(p1.x, p1.y, p2.x, p2.y);
        }
      }
    }
  });

  // Punkte zeichnen
  pdfPointsWithCoords.forEach((p) => {
    doc.setFillColor(...p.color);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.circle(p.x, p.y, 1.4, 'FD');

    // Noten-Text am Punkt
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...p.color);
    doc.text(p.formattedGrade, p.x, p.y - 1.8, { align: 'center' });
  });

  // Legende rechts neben dem Diagramm
  const legX = plotX + plotW + 3.5;
  let legY = plotY + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.textDark);
  doc.text('LEGENDE', legX, legY);
  legY += 4.5;

  const legItems = [
    { label: 'Klausuren', color: COLORS.exam, count: examList.length },
    { label: 'Mündlich', color: COLORS.oral, count: oralList.length },
    { label: 'Tests', color: COLORS.test, count: testList.length },
    { label: 'GFS & Ref.', color: COLORS.gfs_referat, count: gfsReferatList.length },
    { label: 'Projekte', color: COLORS.project, count: projectList.length },
  ];

  legItems.forEach((li) => {
    doc.setFillColor(...li.color);
    doc.setDrawColor(255, 255, 255);
    doc.circle(legX + 1.5, legY - 0.7, 1.3, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...COLORS.textDark);
    doc.text(`${li.label} (${li.count})`, legX + 4.5, legY);
    legY += 3.8;
  });

  // --- B. NOTIZEN-BEREICH (NUR WENN VORHANDEN) ---
  if (hasNotes) {
    doc.setFillColor(...COLORS.bgMuted);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(notesX, y, notesW, bottomH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textDark);
    doc.text('NOTIZEN', notesX + 3.5, y + 5);

    const notesText = String(student?.summaryNotes ?? '').trim();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textDark);

    const textLines = doc.splitTextToSize(notesText, notesW - 7);
    doc.text(textLines, notesX + 3.5, y + 10);
  }
}

/**
 * Exportiert eine detaillierte Schülerübersicht als DIN A4 PDF im Querformat auf genau 1 Seite für einen Einzelschüler.
 */
export function exportStudentOverviewPdf(options) {
  const { student, config, filename } = options;
  if (!student) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  renderStudentOverviewPage(doc, options);

  const outFilename = filename || studentOverviewExportFilename(config, student, 'pdf');
  triggerPdfDownload(doc, outFilename);
}

/**
 * Exportiert die detaillierte Schülerübersicht für ALLE Schüler in ein einziges PDF-Dokument (1 Seite pro Schüler).
 */
export function exportAllStudentsOverviewPdf({
  students = [],
  config,
  exams = {},
  orals = {},
  tests = {},
  projects = {},
  gfsEntries = [],
  referatEntries = [],
  referatCountsAsExam,
  referatCountsAsOral,
  referatCountsAsPartialWritten,
  referatWrittenPercent,
  referatCountsAsPartialOral,
  referatOralPercent,
  referatCountsAsFinalPercent,
  referatFinalPercent,
  showGfs,
  showReferate,
  weighting,
  customGradingKeys,
  gradeSys,
  testsWritten,
  testsAsHalfExam,
  testsAsOral,
  kursstufe,
  filename,
}) {
  const sortedStudents = [...students].sort((a, b) =>
    (a.lastName || '').localeCompare(b.lastName || '', 'de') ||
    (a.firstName || '').localeCompare(b.firstName || '', 'de')
  );

  if (sortedStudents.length === 0) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const resolvedGradeSys = gradeSys || normalizeCourseGradeSystem(config?.gradeSystem);
  const resolvedCustomKeys = customGradingKeys || getCourseGradingKeysLookup(config?.customGradingKeys);
  const resolvedWeighting = weighting || config?.weighting;
  const resolvedTestsWritten = testsWritten !== undefined ? testsWritten : config?.testsWritten !== false;
  const resolvedTestsAsHalfExam = testsAsHalfExam !== undefined ? testsAsHalfExam : usesTestsAsHalfExam(config);
  const resolvedTestsAsOral = testsAsOral !== undefined ? testsAsOral : usesTestsAsOral(config);
  const resolvedShowGfs = showGfs !== undefined ? showGfs : config?.gfsAccepted !== false;
  const resolvedShowReferate = showReferate !== undefined ? showReferate : config?.referateAccepted === true;
  const resolvedReferatCountsAsExam = referatCountsAsExam !== undefined ? referatCountsAsExam : usesReferatAsExam(config);
  const resolvedReferatCountsAsOral = referatCountsAsOral !== undefined ? referatCountsAsOral : usesReferatAsOral(config);
  const resolvedReferatCountsAsPartialWritten = referatCountsAsPartialWritten !== undefined ? referatCountsAsPartialWritten : usesReferatWrittenPercent(config);
  const resolvedReferatWrittenPercent = referatWrittenPercent ?? config?.referatWrittenPercent ?? 100;
  const resolvedReferatCountsAsPartialOral = referatCountsAsPartialOral !== undefined ? referatCountsAsPartialOral : usesReferatOralPercent(config);
  const resolvedReferatOralPercent = referatOralPercent ?? config?.referatOralPercent ?? 100;
  const resolvedReferatCountsAsFinalPercent = referatCountsAsFinalPercent !== undefined ? referatCountsAsFinalPercent : usesReferatFinalPercent(config);
  const resolvedReferatFinalPercent = referatFinalPercent ?? config?.referatFinalPercent ?? 100;
  const resolvedKursstufe = kursstufe !== undefined ? kursstufe : config?.kursstufe === true;

  sortedStudents.forEach((student, index) => {
    if (index > 0) {
      doc.addPage('a4', 'landscape');
    }
    renderStudentOverviewPage(doc, {
      student,
      config,
      exams,
      orals,
      tests,
      projects,
      gfsEntries,
      referatEntries,
      referatCountsAsExam: resolvedReferatCountsAsExam,
      referatCountsAsOral: resolvedReferatCountsAsOral,
      referatCountsAsPartialWritten: resolvedReferatCountsAsPartialWritten,
      referatWrittenPercent: resolvedReferatWrittenPercent,
      referatCountsAsPartialOral: resolvedReferatCountsAsPartialOral,
      referatOralPercent: resolvedReferatOralPercent,
      referatCountsAsFinalPercent: resolvedReferatCountsAsFinalPercent,
      referatFinalPercent: resolvedReferatFinalPercent,
      showGfs: resolvedShowGfs,
      showReferate: resolvedShowReferate,
      weighting: resolvedWeighting,
      customGradingKeys: resolvedCustomKeys,
      gradeSys: resolvedGradeSys,
      testsWritten: resolvedTestsWritten,
      testsAsHalfExam: resolvedTestsAsHalfExam,
      testsAsOral: resolvedTestsAsOral,
      kursstufe: resolvedKursstufe,
    });
  });

  const outFilename = filename || summaryOverviewDetailsExportFilename(config, 'pdf');
  triggerPdfDownload(doc, outFilename);
}
