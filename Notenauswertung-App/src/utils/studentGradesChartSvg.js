import {
  formatGrade,
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  getExamGradeForStudent,
  getNormalizedOralGrade,
  getNormalizedTestScore,
  getTestGradeForStudent,
  getProjectGradeForStudent,
  isProjectScoreCountedForStudent,
  storedGradeStringToClassic,
  storedGradeStringToNotenpunkte,
  normalizeCourseGradeSystem,
} from './calculator';

export const STUDENT_CHART_WIDTH = 800;
export const STUDENT_CHART_HEIGHT = 300;

const LEGEND_DEFS = [
  { key: 'exam', label: 'Klausuren (KA)', color: '#f97316' },
  { key: 'oral', label: 'Mündliche Noten', color: '#3b82f6' },
  { key: 'test', label: 'Tests', color: '#22c55e' },
  { key: 'gfs_referat', label: 'GFS und Referate', color: '#eab308' },
  { key: 'project', label: 'Projekte', color: '#a855f7' },
];

/**
 * Erstellt die Rohdaten für alle Serien des Schülers.
 */
export function extractStudentSeriesData({
  student,
  exams = {},
  orals = {},
  tests = {},
  projects = {},
  gfsEntries = [],
  referatEntries = [],
  referatCountsAsExam = false,
  referatCountsAsOral = false,
  referatCountsAsPartialWritten = false,
  referatCountsAsPartialOral = false,
  referatCountsAsFinalPercent = false,
  showGfs = true,
  showReferate = false,
  customGradingKeys,
  gradeSys = 'decimal',
  testsWritten = true,
}) {
  if (!student) {
    return {
      exam: [],
      oral: [],
      test: [],
      gfs_referat: [],
      project: [],
    };
  }

  const isPoints = normalizeCourseGradeSystem(gradeSys) === 'points';
  const examList = [];
  const testList = [];
  const oralList = [];
  const gfsReferatList = [];
  const projectList = [];

  // Klausuren
  Object.entries(exams || {})
    .filter(([_, e]) => e && e.active)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([id, e]) => {
      const { counted } = getNormalizedExamScore(
        e.scores?.[student.id],
        getStudentEffectiveExamFieldCount(e, student.id)
      );
      const gr = getExamGradeForStudent(e, student.id, customGradingKeys, gradeSys);
      if (counted && gr !== null && Number.isFinite(gr)) {
        const xIndex = examList.length + 1;
        examList.push({
          id: `exam-${id}`,
          type: 'exam',
          category: 'Klausur',
          name: e.name ? `${e.name}` : `KA ${id}`,
          shortLabel: `KA${xIndex}`,
          xIndex,
          grade: gr,
          color: '#f97316',
          halbjahr: e.halbjahr || '1',
        });
      }
    });

  // Tests
  if (testsWritten !== false) {
    Object.entries(tests || {})
      .filter(([_, t]) => t && t.active)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([id, t]) => {
        const sm = t.scores ?? t.errors;
        const { counted } = getNormalizedTestScore(sm?.[student.id]);
        const gr = counted ? getTestGradeForStudent(t, student.id, customGradingKeys, gradeSys) : null;
        if (counted && gr !== null && Number.isFinite(gr)) {
          const xIndex = testList.length + 1;
          testList.push({
            id: `test-${id}`,
            type: 'test',
            category: 'Test',
            name: t.name ? `${t.name}` : `Test ${id}`,
            shortLabel: `Test${xIndex}`,
            xIndex,
            grade: gr,
            color: '#22c55e',
            halbjahr: t.halbjahr || '1',
          });
        }
      });
  }

  // Mündliche Noten
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
        const xIndex = oralList.length + 1;
        oralList.push({
          id: `oral-${id}`,
          type: 'oral',
          category: 'Mündlich',
          name: o.name ? `${o.name}` : `Mündlich ${id}`,
          shortLabel: `Mündl.${xIndex}`,
          xIndex,
          grade: oralG,
          color: '#3b82f6',
          halbjahr: o.halbjahr || '1',
        });
      }
    });

  // GFS
  if (showGfs && Array.isArray(gfsEntries)) {
    gfsEntries
      .filter((e) => e && e.studentId === student.id)
      .forEach((e) => {
        const gNum = isPoints
          ? storedGradeStringToNotenpunkte(e.note, 'points')
          : storedGradeStringToClassic(e.note, 'classic');
        const counted = e.gehalten === true && gNum !== null && Number.isFinite(gNum);
        if (counted) {
          const xIndex = gfsReferatList.length + 1;
          const thema = String(e.thema ?? '').trim();
          gfsReferatList.push({
            id: `gfs-${e.id}`,
            type: 'gfs_referat',
            category: 'GFS',
            name: thema ? `GFS: ${thema}` : 'GFS',
            shortLabel: `GFS${xIndex}`,
            xIndex,
            grade: gNum,
            color: '#eab308',
            halbjahr: e.halbjahr || '1',
          });
        }
      });
  }

  // Referate
  if (
    showReferate &&
    (referatCountsAsExam ||
      referatCountsAsOral ||
      referatCountsAsPartialWritten ||
      referatCountsAsPartialOral ||
      referatCountsAsFinalPercent) &&
    Array.isArray(referatEntries)
  ) {
    referatEntries
      .filter((e) => e && e.studentId === student.id)
      .forEach((e) => {
        const gNum = isPoints
          ? storedGradeStringToNotenpunkte(e.note, 'points')
          : storedGradeStringToClassic(e.note, 'classic');
        const counted = e.gehalten === true && gNum !== null && Number.isFinite(gNum);
        if (counted) {
          const xIndex = gfsReferatList.length + 1;
          const thema = String(e.thema ?? '').trim();
          gfsReferatList.push({
            id: `referat-${e.id}`,
            type: 'gfs_referat',
            category: 'Referat',
            name: thema ? `Referat: ${thema}` : 'Referat',
            shortLabel: `Ref.${xIndex}`,
            xIndex,
            grade: gNum,
            color: '#eab308',
            halbjahr: e.halbjahr || '1',
          });
        }
      });
  }

  // Projekte
  Object.entries(projects || {})
    .filter(([_, p]) => p && p.active)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([id, p]) => {
      const counted = isProjectScoreCountedForStudent(p, student.id);
      const gr = getProjectGradeForStudent(p, student.id, customGradingKeys, gradeSys);
      if (counted && gr !== null && Number.isFinite(gr)) {
        const xIndex = projectList.length + 1;
        projectList.push({
          id: `proj-${id}`,
          type: 'project',
          category: 'Projekt',
          name: p.name ? `${p.name}` : `Projekt ${id}`,
          shortLabel: `Proj.${xIndex}`,
          xIndex,
          grade: gr,
          color: '#a855f7',
          halbjahr: p.halbjahr || '1',
        });
      }
    });

  return {
    exam: examList,
    oral: oralList,
    test: testList,
    gfs_referat: gfsReferatList,
    project: projectList,
  };
}

/**
 * Erzeugt einen vollständigen SVG-String für das Schüler-Notendiagramm (inkl. Legende).
 */
export function buildStudentGradesChartSvg(ctx) {
  const {
    student,
    gradeSys = 'decimal',
    width = STUDENT_CHART_WIDTH,
    height = STUDENT_CHART_HEIGHT,
  } = ctx;

  const isPoints = normalizeCourseGradeSystem(gradeSys) === 'points';
  const seriesData = extractStudentSeriesData(ctx);

  const padLeft = 45;
  const padTop = 35;
  const padBottom = 40;
  const legendWidth = 190;
  const legendGap = 20;

  const plotW = width - padLeft - legendWidth - legendGap - 20;
  const plotH = height - padTop - padBottom;

  const maxX = Math.max(
    1,
    seriesData.exam.length,
    seriesData.oral.length,
    seriesData.test.length,
    seriesData.gfs_referat.length,
    seriesData.project.length
  );

  const totalPointsCount =
    seriesData.exam.length +
    seriesData.oral.length +
    seriesData.test.length +
    seriesData.gfs_referat.length +
    seriesData.project.length;

  const getY = (grade) => {
    if (isPoints) {
      const clamped = Math.max(0, Math.min(15, grade));
      return padTop + plotH - (clamped / 15) * plotH;
    }
    const clamped = Math.max(1, Math.min(6, grade));
    return padTop + plotH - ((clamped - 1) / 5) * plotH;
  };

  const getX = (xIndex) => {
    const step = plotW / (maxX + 1);
    return padLeft + xIndex * step;
  };

  const yTicks = isPoints ? [0, 3, 6, 9, 12, 15] : [1, 2, 3, 4, 5, 6];
  const xTicks = [];
  for (let i = 1; i <= maxX; i++) xTicks.push(i);

  // Cluster & Offsets
  const allPoints = [
    ...seriesData.exam,
    ...seriesData.test,
    ...seriesData.oral,
    ...seriesData.gfs_referat,
    ...seriesData.project,
  ];

  const byXIndex = new Map();
  allPoints.forEach((p) => {
    if (!byXIndex.has(p.xIndex)) byXIndex.set(p.xIndex, []);
    byXIndex.get(p.xIndex).push(p);
  });

  const pointsWithCoords = [];
  const Y_COLLISION_THRESHOLD = 16;

  byXIndex.forEach((itemsAtX) => {
    const sorted = [...itemsAtX].sort((a, b) => getY(a.grade) - getY(b.grade));
    const clusters = [];
    let currentCluster = [];

    sorted.forEach((item) => {
      if (currentCluster.length === 0) {
        currentCluster.push(item);
      } else {
        const lastItem = currentCluster[currentCluster.length - 1];
        const dist = Math.abs(getY(item.grade) - getY(lastItem.grade));
        if (dist < Y_COLLISION_THRESHOLD) {
          currentCluster.push(item);
        } else {
          clusters.push(currentCluster);
          currentCluster = [item];
        }
      }
    });
    if (currentCluster.length > 0) clusters.push(currentCluster);

    clusters.forEach((cluster) => {
      const m = cluster.length;
      cluster.forEach((item, idx) => {
        let xOffset = 0;
        if (m === 2) {
          xOffset = idx === 0 ? -7 : 7;
        } else if (m === 3) {
          xOffset = (idx - 1) * 8;
        } else if (m >= 4) {
          xOffset = (idx - (m - 1) / 2) * 8;
        }

        pointsWithCoords.push({
          ...item,
          baseX: getX(item.xIndex),
          x: getX(item.xIndex) + xOffset,
          y: getY(item.grade),
          formattedGrade: formatGrade(
            item.grade,
            gradeSys,
            isPoints ? { inputScale: 'notenpunkte' } : undefined
          ),
        });
      });
    });
  });

  // Linien
  const categoriesDef = [
    { key: 'exam', items: seriesData.exam, color: '#f97316' },
    { key: 'oral', items: seriesData.oral, color: '#3b82f6' },
    { key: 'test', items: seriesData.test, color: '#22c55e' },
    { key: 'gfs_referat', items: seriesData.gfs_referat, color: '#eab308' },
    { key: 'project', items: seriesData.project, color: '#a855f7' },
  ];

  const seriesLines = categoriesDef
    .filter((cat) => cat.items.length > 1)
    .map((cat) => {
      const pointsStr = cat.items
        .map((item) => {
          const found = pointsWithCoords.find((p) => p.id === item.id);
          const x = found ? found.x : getX(item.xIndex);
          const y = found ? found.y : getY(item.grade);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
      return { key: cat.key, color: cat.color, pointsStr };
    });

  // SVG-Erstellung
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">`
  );

  // Hintergrund
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff" />`);

  // Titel
  parts.push(
    `<text x="${padLeft}" y="20" font-size="12" font-weight="bold" fill="#1e293b" letter-spacing="0.5">NOTENVERLAUF NACH NR. (${totalPointsCount} ${totalPointsCount === 1 ? 'Note' : 'Noten'})</text>`
  );

  // Plot-Hintergrund
  parts.push(
    `<rect x="${padLeft}" y="${padTop}" width="${plotW}" height="${plotH}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" rx="4" />`
  );

  // Y-Grid
  yTicks.forEach((val) => {
    const y = getY(val);
    const isMajor = val % (isPoints ? 3 : 1) === 0;
    parts.push(
      `<line x1="${padLeft}" x2="${padLeft + plotW}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" ${isMajor ? '' : 'stroke-dasharray="2 2"'} />`
    );
    parts.push(
      `<text x="${padLeft - 8}" y="${(y + 4).toFixed(1)}" font-size="11" font-weight="500" fill="#64748b" text-anchor="end">${val}</text>`
    );
  });

  // X-Grid
  xTicks.forEach((tickVal) => {
    const x = getX(tickVal);
    parts.push(
      `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${padTop}" y2="${padTop + plotH}" stroke="#e2e8f0" stroke-width="1" />`
    );
    parts.push(
      `<text x="${x.toFixed(1)}" y="${padTop + plotH + 18}" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">${tickVal}</text>`
    );
  });

  // Verbindungslinien
  seriesLines.forEach((l) => {
    parts.push(
      `<polyline fill="none" stroke="${l.color}" stroke-width="1.75" stroke-opacity="0.45" stroke-dasharray="3 3" stroke-linecap="round" stroke-linejoin="round" points="${l.pointsStr}" />`
    );
  });

  // Datenpunkte
  pointsWithCoords.forEach((p) => {
    parts.push(
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="${p.color}" stroke="#ffffff" stroke-width="2" />`
    );
    parts.push(
      `<text x="${p.x.toFixed(1)}" y="${(p.y - 9).toFixed(1)}" font-size="10.5" font-weight="bold" fill="${p.color}" text-anchor="middle">${p.formattedGrade}</text>`
    );
  });

  if (totalPointsCount === 0) {
    parts.push(
      `<text x="${padLeft + plotW / 2}" y="${padTop + plotH / 2 + 5}" font-size="13" fill="#64748b" text-anchor="middle">Keine Einzelnoten vorhanden</text>`
    );
  }

  // Achsenbeschriftungen
  parts.push(
    `<text x="${padLeft + plotW}" y="${padTop + plotH + 34}" font-size="10" font-weight="600" fill="#64748b" text-anchor="end">Note Nr. (x) →</text>`
  );
  parts.push(
    `<text x="${padLeft}" y="${padTop - 8}" font-size="10" font-weight="600" fill="#64748b" text-anchor="start">${isPoints ? 'Notenpunkte' : 'Note'}</text>`
  );

  // Legende rechts
  const legendX = padLeft + plotW + legendGap;
  const legendY = padTop;
  const legendH = plotH;

  parts.push(
    `<rect x="${legendX}" y="${legendY}" width="${legendWidth}" height="${legendH}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" rx="6" />`
  );
  parts.push(
    `<text x="${legendX + 12}" y="${legendY + 22}" font-size="10" font-weight="bold" fill="#64748b" letter-spacing="0.5">LEGENDE</text>`
  );

  let legItemY = legendY + 45;
  LEGEND_DEFS.forEach((item) => {
    const count = seriesData[item.key]?.length || 0;
    parts.push(
      `<circle cx="${legendX + 18}" cy="${legItemY - 3}" r="5" fill="${item.color}" />`
    );
    parts.push(
      `<text x="${legendX + 30}" y="${legItemY}" font-size="11" fill="#1e293b">${item.label}</text>`
    );
    if (count > 0) {
      parts.push(
        `<text x="${legendX + legendWidth - 12}" y="${legItemY}" font-size="10.5" font-weight="bold" fill="#64748b" text-anchor="end">(${count})</text>`
      );
    }
    legItemY += 30;
  });

  parts.push('</svg>');
  return parts.join('\n');
}
