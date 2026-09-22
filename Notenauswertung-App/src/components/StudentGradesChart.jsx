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
} from '../utils/calculator';

const LEGEND_ITEMS = [
  { key: 'exam', label: 'Klausuren', color: '#f97316' },
  { key: 'oral', label: 'Mündliche Noten', color: '#3b82f6' },
  { key: 'test', label: 'Tests', color: '#22c55e' },
  { key: 'gfs_referat', label: 'GFS und Referate', color: '#d97706' },
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

  const gradePoints = useMemo(() => {
    if (!student) return [];
    const list = [];

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
          list.push({
            id: `exam-${id}`,
            type: 'exam',
            category: 'Klausur',
            name: e.name ? `${e.name}` : `KA ${id}`,
            grade: gr,
            color: '#f97316',
            halbjahr: e.halbjahr || '1',
            orderKey: (e.halbjahr === '2' ? 200 : 100) + Number(id),
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
            list.push({
              id: `test-${id}`,
              type: 'test',
              category: 'Test',
              name: t.name ? `${t.name}` : `Test ${id}`,
              grade: gr,
              color: '#22c55e',
              halbjahr: t.halbjahr || '1',
              orderKey: (t.halbjahr === '2' ? 200 : 100) + 20 + Number(id),
            });
          }
        });
    }

    // Mündlich
    Object.entries(orals || {})
      .filter(([_, o]) => o && o.active !== false)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([id, o]) => {
        const { value, counted } = getNormalizedOralGrade(o.grades?.[student.id]);
        const oralG = counted && value ? storedGradeStringToClassic(String(value), gradeSys) : null;
        if (counted && oralG !== null && Number.isFinite(oralG)) {
          list.push({
            id: `oral-${id}`,
            type: 'oral',
            category: 'Mündlich',
            name: o.name ? `${o.name}` : `Mündlich ${id}`,
            grade: oralG,
            color: '#3b82f6',
            halbjahr: o.halbjahr || '1',
            orderKey: (o.halbjahr === '2' ? 200 : 100) + 40 + Number(id),
          });
        }
      });

    // GFS
    if (showGfs && Array.isArray(gfsEntries)) {
      gfsEntries
        .filter((e) => e && e.studentId === student.id)
        .forEach((e) => {
          const gNum = storedGradeStringToClassic(e.note, gradeSys);
          const counted = e.gehalten === true && gNum !== null && Number.isFinite(gNum);
          if (counted) {
            const thema = String(e.thema ?? '').trim();
            list.push({
              id: `gfs-${e.id}`,
              type: 'gfs_referat',
              category: 'GFS',
              name: thema ? `GFS: ${thema}` : 'GFS',
              grade: gNum,
              color: '#d97706',
              halbjahr: e.halbjahr || '1',
              orderKey: (e.halbjahr === '2' ? 200 : 100) + 60,
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
          const gNum = storedGradeStringToClassic(e.note, gradeSys);
          const counted = e.gehalten === true && gNum !== null && Number.isFinite(gNum);
          if (counted) {
            const thema = String(e.thema ?? '').trim();
            list.push({
              id: `referat-${e.id}`,
              type: 'gfs_referat',
              category: 'Referat',
              name: thema ? `Referat: ${thema}` : 'Referat',
              grade: gNum,
              color: '#d97706',
              halbjahr: e.halbjahr || '1',
              orderKey: (e.halbjahr === '2' ? 200 : 100) + 70,
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
          list.push({
            id: `proj-${id}`,
            type: 'project',
            category: 'Projekt',
            name: p.name ? `${p.name}` : `Projekt ${id}`,
            grade: gr,
            color: '#a855f7',
            halbjahr: p.halbjahr || '1',
            orderKey: (p.halbjahr === '2' ? 200 : 100) + 80 + Number(id),
          });
        }
      });

    list.sort((a, b) => a.orderKey - b.orderKey);
    return list;
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

  // Y-Skala
  // Bei Noten (1-6): 1 ist oben (padTop), 6 ist unten (padTop + plotH)
  // Bei Notenpunkten (0-15): 15 ist oben (padTop), 0 ist unten (padTop + plotH)
  const getY = (grade) => {
    if (isPoints) {
      const clamped = Math.max(0, Math.min(15, grade));
      return padTop + ((15 - clamped) / 15) * plotH;
    }
    const clamped = Math.max(1, Math.min(6, grade));
    return padTop + ((clamped - 1) / 5) * plotH;
  };

  const yTicks = isPoints
    ? [15, 12, 9, 6, 3, 0]
    : [1, 2, 3, 4, 5, 6];

  const count = gradePoints.length;

  // X-Koordinaten berechnen
  const getX = (idx) => {
    if (count <= 1) {
      return padLeft + plotW / 2;
    }
    const step = plotW / (count + 1);
    return padLeft + (idx + 1) * step;
  };

  const pointsWithCoords = gradePoints.map((item, idx) => ({
    ...item,
    xIndex: idx + 1,
    x: getX(idx),
    y: getY(item.grade),
    formattedGrade: formatGrade(item.grade, gradeSys),
  }));

  const polylinePoints = pointsWithCoords.map((p) => `${p.x},${p.y}`).join(' ');

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
          Notenverlauf ({count} {count === 1 ? 'Note' : 'Noten'})
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

            {/* Horizontale Y-Grid-Linien & Beschriftung */}
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

            {/* Vertikale X-Grid-Linien & Beschriftung (Note 1..N) */}
            {pointsWithCoords.map((p) => (
              <g key={`xtick-${p.id}`}>
                <line
                  x1={p.x}
                  x2={p.x}
                  y1={padTop}
                  y2={padTop + plotH}
                  stroke="hsl(var(--foreground) / 0.06)"
                  strokeWidth="1"
                />
                <text
                  x={p.x}
                  y={padTop + plotH + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--text-muted)"
                >
                  {p.xIndex}
                </text>
              </g>
            ))}

            {/* Verbindungslinie */}
            {count > 1 && (
              <polyline
                fill="none"
                stroke="hsl(var(--foreground) / 0.25)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylinePoints}
              />
            )}

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
                  <title>{`${p.name}: ${p.formattedGrade} (${p.category}, HJ ${p.halbjahr})`}</title>
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
                    y={p.y - 10}
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
            {count === 0 && (
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
              Anzahl Noten →
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
                ({hoveredPoint.category}, HJ {hoveredPoint.halbjahr})
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
          {LEGEND_ITEMS.map((item) => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.825rem',
                color: 'var(--foreground)',
              }}
            >
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
          ))}
        </div>
      </div>
    </div>
  );
}
