import React, { useMemo, useState } from 'react';
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
} from '../utils/calculator';

const LEGEND_ITEMS = [
  { key: 'exam', label: 'Klausuren (KA)', color: '#f97316' },
  { key: 'oral', label: 'Mündliche Noten', color: '#3b82f6' },
  { key: 'test', label: 'Tests', color: '#22c55e' },
  { key: 'gfs_referat', label: 'GFS und Referate', color: '#eab308' },
  { key: 'project', label: 'Projekte', color: '#a855f7' },
];

export default function StudentGradesChart({
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
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const isPoints = gradeSys === 'points';

  const seriesData = useMemo(() => {
    if (!student) {
      return {
        exam: [],
        oral: [],
        test: [],
        gfs_referat: [],
        project: [],
      };
    }

    const examList = [];
    const testList = [];
    const oralList = [];
    const gfsReferatList = [];
    const projectList = [];

    // Klausuren: gezählt von 1 aufwärts (liefert bereits Notenpunkte wenn gradeSys === 'points')
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

    // Tests: gezählt von 1 aufwärts (liefert bereits Notenpunkte wenn gradeSys === 'points')
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

    // Mündliche Noten: gezählt von 1 aufwärts
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

    // GFS: gezählt von 1 aufwärts
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

    // Referate: gezählt von 1 aufwärts
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

    // Projekte: gezählt von 1 aufwärts
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
  }, [
    student,
    exams,
    orals,
    tests,
    projects,
    gfsEntries,
    referatEntries,
    referatCountsAsExam,
    referatCountsAsOral,
    referatCountsAsPartialWritten,
    referatCountsAsPartialOral,
    referatCountsAsFinalPercent,
    showGfs,
    showReferate,
    customGradingKeys,
    gradeSys,
    isPoints,
    testsWritten,
  ]);

  // Diagramm-Layout
  const vbWidth = 600;
  const vbHeight = 220;
  const padLeft = 40;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 35;
  const plotW = vbWidth - padLeft - padRight;
  const plotH = vbHeight - padTop - padBottom;

  // Maximaler X-Index
  const maxX = useMemo(() => {
    const counts = [
      seriesData.exam.length,
      seriesData.oral.length,
      seriesData.test.length,
      seriesData.gfs_referat.length,
      seriesData.project.length,
    ];
    return Math.max(1, ...counts);
  }, [seriesData]);

  const totalPointsCount = useMemo(() => {
    return (
      seriesData.exam.length +
      seriesData.oral.length +
      seriesData.test.length +
      seriesData.gfs_referat.length +
      seriesData.project.length
    );
  }, [seriesData]);

  // Y-Skala: Von unten nach oben
  // Bei Noten (1-6): 1 ist ganz unten (padTop + plotH), 6 ist ganz oben (padTop)
  // Bei Notenpunkten (0-15): 0 ist ganz unten (padTop + plotH), 15 ist ganz oben (padTop)
  const getY = (grade) => {
    if (isPoints) {
      const clamped = Math.max(0, Math.min(15, grade));
      return padTop + plotH - (clamped / 15) * plotH;
    }
    const clamped = Math.max(1, Math.min(6, grade));
    return padTop + plotH - ((clamped - 1) / 5) * plotH;
  };

  const yTicks = isPoints
    ? [0, 3, 6, 9, 12, 15]
    : [1, 2, 3, 4, 5, 6];

  // X-Koordinate für xIndex (1, 2, ...)
  const getX = (xIndex) => {
    const step = plotW / (maxX + 1);
    return padLeft + xIndex * step;
  };

  // Liste aller Ticks auf der X-Achse
  const xTicks = useMemo(() => {
    const ticks = [];
    for (let i = 1; i <= maxX; i++) {
      ticks.push(i);
    }
    return ticks;
  }, [maxX]);

  // Alle Punkte mit Koordinaten und dynamischem Überlappungs-Offset (Cluster-Erkennung bei dicht beieinander liegenden Noten)
  const pointsWithCoords = useMemo(() => {
    const all = [
      ...seriesData.exam,
      ...seriesData.test,
      ...seriesData.oral,
      ...seriesData.gfs_referat,
      ...seriesData.project,
    ];

    // Gruppierung nach xIndex
    const byXIndex = new Map();
    all.forEach((p) => {
      if (!byXIndex.has(p.xIndex)) byXIndex.set(p.xIndex, []);
      byXIndex.get(p.xIndex).push(p);
    });

    const result = [];
    const Y_COLLISION_THRESHOLD = 16; // Pixel-Abstand, unter dem Noten als dicht beieinander gelten

    byXIndex.forEach((itemsAtX) => {
      // Nach Y-Position sortieren
      const sorted = [...itemsAtX].sort((a, b) => getY(a.grade) - getY(b.grade));

      // Cluster von dicht beieinander liegenden Punkten bilden
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
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }

      // Für jedes Cluster horizontale Offsets (links / rechts) zuweisen
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

          result.push({
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

    return result;
  }, [seriesData, maxX, gradeSys, isPoints]);

  // Serien-Linien (jeder Notentyp bekommt seine eigene Linie über x=1, x=2, etc.)
  const seriesLines = useMemo(() => {
    const categories = [
      { key: 'exam', items: seriesData.exam, color: '#f97316' },
      { key: 'oral', items: seriesData.oral, color: '#3b82f6' },
      { key: 'test', items: seriesData.test, color: '#22c55e' },
      { key: 'gfs_referat', items: seriesData.gfs_referat, color: '#eab308' },
      { key: 'project', items: seriesData.project, color: '#a855f7' },
    ];

    return categories
      .filter((cat) => cat.items.length > 1)
      .map((cat) => {
        const pointsStr = cat.items
          .map((item) => {
            const found = pointsWithCoords.find((p) => p.id === item.id);
            const x = found ? found.x : getX(item.xIndex);
            const y = found ? found.y : getY(item.grade);
            return `${x},${y}`;
          })
          .join(' ');
        return {
          key: cat.key,
          color: cat.color,
          pointsStr,
        };
      });
  }, [seriesData, pointsWithCoords, maxX, isPoints]);

  return (
    <div
      style={{
        marginTop: '1rem',
        backgroundColor: 'var(--surface)',
        padding: '1.25rem',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h4
          style={{
            margin: 0,
            fontSize: '0.9rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-main)',
          }}
        >
          Notenverlauf nach Nr. ({totalPointsCount} {totalPointsCount === 1 ? 'Note' : 'Noten'})
        </h4>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Diagramm */}
        <div style={{ flex: '1 1 380px', minWidth: '280px', position: 'relative' }}>
          <svg
            viewBox={`0 0 ${vbWidth} ${vbHeight}`}
            width="100%"
            height="auto"
            style={{ display: 'block', maxHeight: '240px', overflow: 'visible' }}
            role="img"
            aria-label="Einzelnoten-Diagramm des Schülers"
          >
            {/* Hintergrund Plot-Bereich */}
            <rect
              x={padLeft}
              y={padTop}
              width={plotW}
              height={plotH}
              fill="hsl(var(--muted) / 0.08)"
              stroke="var(--border)"
              strokeWidth="1"
              rx="4"
            />

            {/* Horizontale Y-Grid-Linien & Beschriftung (1 unten ... 6 oben bzw. 0 unten ... 15 oben) */}
            {yTicks.map((val) => {
              const y = getY(val);
              return (
                <g key={`ytick-${val}`}>
                  <line
                    x1={padLeft}
                    x2={padLeft + plotW}
                    y1={y}
                    y2={y}
                    stroke="hsl(var(--foreground) / 0.08)"
                    strokeWidth="1"
                    strokeDasharray={val % (isPoints ? 3 : 1) === 0 ? undefined : '2 2'}
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="500"
                    fill="var(--text-muted)"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Vertikale X-Grid-Linien & Beschriftung (x = 1, 2, 3...) */}
            {xTicks.map((tickVal) => {
              const x = getX(tickVal);
              return (
                <g key={`xtick-${tickVal}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={padTop}
                    y2={padTop + plotH}
                    stroke="hsl(var(--foreground) / 0.06)"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={padTop + plotH + 18}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--text-muted)"
                  >
                    {tickVal}
                  </text>
                </g>
              );
            })}

            {/* Kategorien-Verbindungslinien */}
            {seriesLines.map((line) => (
              <polyline
                key={`line-${line.key}`}
                fill="none"
                stroke={line.color}
                strokeWidth="1.75"
                strokeOpacity="0.45"
                strokeDasharray="3 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={line.pointsStr}
              />
            ))}

            {/* Datenpunkte */}
            {pointsWithCoords.map((p) => {
              const isHovered = hoveredPoint?.id === p.id;
              return (
                <g
                  key={p.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <title>{`${p.name}: ${p.formattedGrade} (${p.category} ${p.xIndex}, HJ ${p.halbjahr})`}</title>
                  {isHovered && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="10"
                      fill={p.color}
                      opacity="0.25"
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 7 : 5.5}
                    fill={p.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                    style={{ transition: 'all 0.15s ease' }}
                  />
                  {/* Note über/unter dem Punkt */}
                  <text
                    x={p.x}
                    y={p.y - 9}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill={p.color}
                  >
                    {p.formattedGrade}
                  </text>
                </g>
              );
            })}

            {/* Leerer Zustand */}
            {totalPointsCount === 0 && (
              <text
                x={padLeft + plotW / 2}
                y={padTop + plotH / 2 + 4}
                textAnchor="middle"
                fontSize="13"
                fill="var(--text-muted)"
              >
                Keine Einzelnoten vorhanden
              </text>
            )}

            {/* X-Achsenbeschriftung */}
            <text
              x={padLeft + plotW}
              y={vbHeight - 4}
              textAnchor="end"
              fontSize="10"
              fontWeight="600"
              fill="var(--text-muted)"
            >
              Note Nr. (x) →
            </text>
            <text
              x={padLeft - 2}
              y={padTop - 6}
              textAnchor="start"
              fontSize="10"
              fontWeight="600"
              fill="var(--text-muted)"
            >
              {isPoints ? 'Notenpunkte' : 'Note'}
            </text>
          </svg>

          {/* Hover-Detail-Badge */}
          {hoveredPoint && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                background: 'var(--background)',
                border: `1px solid ${hoveredPoint.color}`,
                borderRadius: '6px',
                padding: '0.25rem 0.6rem',
                fontSize: '0.8rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: hoveredPoint.color,
                  display: 'inline-block',
                }}
              />
              <strong>{hoveredPoint.name}:</strong>
              <span>{hoveredPoint.formattedGrade}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                (x={hoveredPoint.xIndex}, {hoveredPoint.category}, HJ {hoveredPoint.halbjahr})
              </span>
            </div>
          )}
        </div>

        {/* Legende */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            minWidth: '170px',
            padding: '0.85rem 1rem',
            background: 'hsl(var(--muted) / 0.12)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '0.25rem',
              letterSpacing: '0.05em',
            }}
          >
            Legende
          </div>
          {LEGEND_ITEMS.map((item) => {
            const count = seriesData[item.key]?.length || 0;
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  fontSize: '0.825rem',
                  color: 'var(--foreground)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: item.color,
                      display: 'inline-block',
                      flexShrink: 0,
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <span>{item.label}</span>
                </div>
                {count > 0 && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    ({count})
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
