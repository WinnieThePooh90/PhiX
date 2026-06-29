import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatGrade,
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  gradeToNotenpunkte,
  normalizeCourseGradeSystem,
  normalizeQuarterGrade,
  parseScorePointsValue,
} from '../utils/calculator';
import { barColorForClassicQuarterGrade, barColorForNpBucket } from '../utils/gradeChartColors';

function formatQuarterAxisLabel(g) {
  return Number(g).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Mittelpunkt eines Kreissegments (Prozent auf dem Ring) — Winkel wie SVG stroke nach rotate(-90deg). */
function pieSegmentLabelPos(startPercent, sweepPercent) {
  const midDeg = -90 + ((startPercent + sweepPercent / 2) / 100) * 360;
  const rad = (midDeg * Math.PI) / 180;
  return {
    left: `${50 + 40 * Math.cos(rad)}%`,
    top: `${50 + 40 * Math.sin(rad)}%`,
  };
}

const CLASSIC_QUARTER_BUCKETS = Array.from({ length: 21 }, (_, i) => Math.round((1 + i * 0.25) * 4) / 4);

/** Bestehensquote: klassisch ≤ 3,0; Punktesystem NP ≥ 5. */
function isPassingForBestehensquote(grade, gradeSystem) {
  if (grade === null || grade === undefined) return false;
  if (normalizeCourseGradeSystem(gradeSystem) === 'points') {
    const np = gradeToNotenpunkte(grade);
    return np !== null && np >= 5;
  }
  return grade <= 3.0;
}

/**
 * Klausur-Diagramme: Notenverteilung, Bestehensquote, Aufgabenanalyse.
 * `examRowStats(studentId)` liefert effN, fields, counted, total, maxPts, grade.
 */
export default function ExamChartsPanels({
  students,
  exam,
  examRowStats,
  tooltipGrade,
  setTooltipGrade,
  pieTooltip,
  setPieTooltip,
  displayFieldCount,
  gradeSystem = 'classic',
  showTaskAnalysis = true,
}) {
  const gs = normalizeCourseGradeSystem(gradeSystem);
  const npBuckets = Array.from({ length: 16 }, (_, i) => i);

  const distributionKeys = gs === 'points' ? npBuckets : CLASSIC_QUARTER_BUCKETS;

  const countForBucket = (key) =>
    students.reduce((acc, s) => {
      const { counted, grade: g } = examRowStats(s.id);
      if (!counted || g === null) return acc;
      if (gs === 'points') {
        const np = gradeToNotenpunkte(g);
        return np === key ? acc + 1 : acc;
      }
      return normalizeQuarterGrade(g) === key ? acc + 1 : acc;
    }, 0);

  const classAverage = useMemo(() => {
    let sum = 0;
    let count = 0;
    students.forEach((s) => {
      const { counted, grade: g } = examRowStats(s.id);
      if (counted && g !== null) {
        sum += g;
        count += 1;
      }
    });
    return count > 0 ? sum / count : null;
  }, [students, examRowStats]);

  const maxCount = Math.max(...distributionKeys.map((k) => countForBucket(k)), 1);

  /** Einheitliche Diagrammhöhe in allen Analyse-Karten */
  const chartAreaHeight = 'min(300px, min(42dvh, 360px))';

  const taskAnalysisData = useMemo(() => {
    if (!showTaskAnalysis || displayFieldCount <= 0) return [];
    return [...Array(displayFieldCount)].map((_, i) => {
      const maxForTask = parseScorePointsValue(exam.fieldMaxPoints[i]);
      const totalAchieved = students.reduce((acc, s) => {
        const effN = getStudentEffectiveExamFieldCount(exam, s.id);
        if (i >= effN) return acc;
        const { counted, fields } = getNormalizedExamScore(exam.scores?.[s.id], effN);
        if (counted) return acc + parseScorePointsValue(fields[i]);
        return acc;
      }, 0);

      const countedStudents = students.filter((s) => {
        const effN = getStudentEffectiveExamFieldCount(exam, s.id);
        if (i >= effN) return false;
        return getNormalizedExamScore(exam.scores?.[s.id], effN).counted;
      }).length;
      const maxPossible = maxForTask * countedStudents;
      const successPercent = maxPossible > 0 ? (totalAchieved / maxPossible) * 100 : 0;
      const avgAchieved = countedStudents > 0 ? totalAchieved / countedStudents : null;
      const barColor = successPercent >= 75 ? 'var(--success)' : successPercent >= 50 ? '#f59e0b' : 'var(--danger)';

      return {
        index: i,
        maxForTask,
        successPercent,
        avgAchieved,
        barColor,
      };
    });
  }, [showTaskAnalysis, displayFieldCount, exam, students]);

  const barPopoverStudents = useMemo(() => {
    if (tooltipGrade === null || tooltipGrade === undefined) return [];
    return students.filter((s) => {
      const { counted, grade: g } = examRowStats(s.id);
      if (!counted || g === null) return false;
      if (gs === 'points') return gradeToNotenpunkte(g) === tooltipGrade;
      return normalizeQuarterGrade(g) === tooltipGrade;
    });
  }, [tooltipGrade, students, examRowStats, gs]);

  const studentsGood = useMemo(
    () =>
      students.filter((s) => {
        const { counted, grade: g } = examRowStats(s.id);
        return counted && g !== null && isPassingForBestehensquote(g, gs);
      }),
    [students, examRowStats, gs],
  );

  const studentsBad = useMemo(
    () =>
      students.filter((s) => {
        const { counted, grade: g } = examRowStats(s.id);
        return counted && g !== null && !isPassingForBestehensquote(g, gs);
      }),
    [students, examRowStats, gs],
  );

  const [barPopoverGeom, setBarPopoverGeom] = useState(null);
  const [piePopoverGeom, setPiePopoverGeom] = useState(null);

  useLayoutEffect(() => {
    if (tooltipGrade === null || tooltipGrade === undefined || barPopoverStudents.length === 0) {
      setBarPopoverGeom(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(`[data-exam-distribution-anchor="${tooltipGrade}"]`);
      if (!el) {
        setBarPopoverGeom(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const panelW = Math.min(260, window.innerWidth - 16);
      const cx = r.left + r.width / 2;
      const approxH = Math.min(320, 140 + barPopoverStudents.length * 22);
      const margin = 12;
      let top = r.bottom + 8;
      if (top + approxH > window.innerHeight - margin) {
        top = Math.max(margin, r.top - approxH - 8);
      }
      setBarPopoverGeom({ cx, top, width: panelW });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [tooltipGrade, barPopoverStudents.length]);

  useLayoutEffect(() => {
    if (!pieTooltip) {
      setPiePopoverGeom(null);
      return;
    }
    const update = () => {
      const el = document.querySelector('[data-exam-pie-anchor]');
      if (!el) {
        setPiePopoverGeom(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const listLen = (pieTooltip === 'good' ? studentsGood : studentsBad).length;
      const approxH = Math.min(320, 140 + listLen * 22);
      const margin = 12;
      let top = r.bottom + 10;
      if (top + approxH > window.innerHeight - margin) {
        top = Math.max(margin, r.top - approxH - 10);
      }
      setPiePopoverGeom({ cx: r.left + r.width / 2, top, width: Math.min(260, window.innerWidth - 16) });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [pieTooltip, studentsGood.length, studentsBad.length]);

  useEffect(() => {
    const open = (tooltipGrade !== null && tooltipGrade !== undefined) || pieTooltip;
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setTooltipGrade(null);
        setPieTooltip(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tooltipGrade, pieTooltip, setTooltipGrade, setPieTooltip]);

  const closePopovers = () => {
    setTooltipGrade(null);
    setPieTooltip(null);
  };

  const goodLabelShort = gs === 'points' ? 'NP ≥ 5' : '≤ 3.0';
  const badLabelShort = gs === 'points' ? 'NP < 5' : '> 3.0';
  const goodTooltipTitle = gs === 'points' ? 'Notenpunkte mindestens 5' : 'Besser/Gleich 3.0';
  const badTooltipTitle = gs === 'points' ? 'Notenpunkte unter 5' : 'Schlechter als 3.0';

  const showBarPortal =
    tooltipGrade !== null && tooltipGrade !== undefined && barPopoverStudents.length > 0 && barPopoverGeom;
  const pieList = pieTooltip === 'good' ? studentsGood : studentsBad;
  const showPiePortal = Boolean(pieTooltip && piePopoverGeom && pieList.length > 0);

  const barPortalBorder = showBarPortal
    ? gs === 'points'
      ? barColorForNpBucket(tooltipGrade)
      : barColorForClassicQuarterGrade(tooltipGrade)
    : '';
  const barPortalTitle = showBarPortal
    ? gs === 'points'
      ? `NP ${tooltipGrade}`
      : `Note ${formatQuarterAxisLabel(tooltipGrade)}`
    : '';
  const barListMaxH = barPopoverGeom
    ? Math.max(120, Math.min(360, window.innerHeight - barPopoverGeom.top - 110))
    : 200;
  const pieListMaxH = piePopoverGeom
    ? Math.max(120, Math.min(360, window.innerHeight - piePopoverGeom.top - 110))
    : 200;
  const pieBorder = showPiePortal ? (pieTooltip === 'good' ? 'var(--success)' : 'var(--danger)') : '';
  const pieTitle = showPiePortal ? (pieTooltip === 'good' ? goodTooltipTitle : badTooltipTitle) : '';

  const popoverPortal =
    showBarPortal || showPiePortal
      ? createPortal(
          <>
            <div className="exam-charts-popover-backdrop" aria-hidden onClick={closePopovers} />
            {showBarPortal && (
              <div
                className="exam-charts-popover-panel"
                role="dialog"
                aria-label={barPortalTitle}
                style={{
                  left: barPopoverGeom.cx,
                  top: barPopoverGeom.top,
                  transform: 'translateX(-50%)',
                  width: barPopoverGeom.width,
                  borderColor: barPortalBorder,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    color: barPortalBorder,
                    marginBottom: '0.5rem',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '0.25rem',
                  }}
                >
                  {barPortalTitle}
                </div>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    fontSize: '0.85rem',
                    maxHeight: barListMaxH,
                    overflowY: 'auto',
                  }}
                >
                  {barPopoverStudents.map((s) => (
                    <li key={s.id} style={{ padding: '0.1rem 0' }}>
                      {s.lastName}, {s.firstName}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setTooltipGrade(null)}
                  style={{
                    marginTop: '0.5rem',
                    width: '100%',
                    fontSize: '0.7rem',
                    padding: '0.35rem',
                    background: 'hsl(var(--muted))',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Schließen
                </button>
              </div>
            )}
            {showPiePortal && (
              <div
                className="exam-charts-popover-panel"
                role="dialog"
                aria-label={pieTitle}
                style={{
                  left: piePopoverGeom.cx,
                  top: piePopoverGeom.top,
                  transform: 'translateX(-50%)',
                  width: piePopoverGeom.width,
                  borderColor: pieBorder,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    color: pieBorder,
                    marginBottom: '0.5rem',
                  }}
                >
                  {pieTitle}
                </div>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    fontSize: '0.85rem',
                    maxHeight: pieListMaxH,
                    overflowY: 'auto',
                  }}
                >
                  {pieList.map((s) => (
                    <li key={s.id} style={{ padding: '0.1rem 0' }}>
                      {s.lastName}, {s.firstName}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setPieTooltip(null)}
                  style={{
                    marginTop: '0.5rem',
                    width: '100%',
                    fontSize: '0.7rem',
                    padding: '0.35rem',
                    background: 'hsl(var(--muted))',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Schließen
                </button>
              </div>
            )}
          </>,
          document.body,
        )
      : null;

  return (
    <>
      {popoverPortal}
      <div className="exam-charts-class-average" aria-live="polite">
        <span className="exam-charts-class-average-label">Klassenschnitt</span>
        <span className="exam-charts-class-average-value">
          {classAverage === null ? '—' : formatGrade(classAverage, gs)}
        </span>
      </div>
      <div className={`${showTaskAnalysis ? 'grid-3' : 'grid-2'} gap-8 exam-charts-grid`}>
        <div className="glass-panel exam-charts-panel" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 className="mb-6">Notenverteilung</h3>
          <div className="exam-charts-panel__body">
          <div
            className="exam-charts-panel__chart"
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: chartAreaHeight,
              gap: gs === 'points' ? '0.15rem' : '0.12rem',
              padding: '0.35rem 0.25rem 0',
              marginTop: '0.25rem',
              overflowX: 'auto',
              overflowY: 'visible',
            }}
          >
            {distributionKeys.map((bucketKey) => {
              const counts = countForBucket(bucketKey);
              const heightPercent = counts > 0 ? (counts / maxCount) * 94 : 0;
              const barColor =
                gs === 'points' ? barColorForNpBucket(bucketKey) : barColorForClassicQuarterGrade(bucketKey);
              const isTooltipActive = tooltipGrade === bucketKey;

              const axisLabel = gs === 'points' ? String(bucketKey) : formatQuarterAxisLabel(bucketKey);

              return (
                <div
                  key={bucketKey}
                  data-exam-distribution-anchor={String(bucketKey)}
                  style={{
                    flex: '0 0 auto',
                    minWidth: gs === 'points' ? '1.1rem' : '1.35rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      width: '100%',
                      minHeight: 0,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      paddingTop: '1.1rem',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div
                      onClick={() => setTooltipGrade(isTooltipActive ? null : bucketKey)}
                      style={{
                        width: gs === 'points' ? '70%' : '75%',
                        height: heightPercent > 0 ? `${heightPercent}%` : '4px',
                        background: counts > 0 ? barColor : '#eee',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease, opacity 0.2s',
                        position: 'relative',
                        cursor: counts > 0 ? 'pointer' : 'default',
                        opacity:
                          tooltipGrade !== null && tooltipGrade !== undefined && !isTooltipActive ? 0.3 : 1,
                        boxShadow: isTooltipActive ? `0 0 0 3px white, 0 0 0 5px ${barColor}` : 'none',
                        zIndex: isTooltipActive ? 10 : 1,
                      }}
                    >
                      {counts > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-25px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                          }}
                        >
                          {counts}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '0.75rem',
                      fontWeight: 'bold',
                      borderTop: '2px solid #eee',
                      width: '100%',
                      textAlign: 'center',
                      paddingTop: '0.5rem',
                      fontSize: gs === 'points' ? '0.65rem' : '0.55rem',
                    }}
                  >
                    {axisLabel}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        <div className="glass-panel exam-charts-panel" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 className="mb-6">Bestehensquote</h3>
          <div className="exam-charts-panel__body exam-charts-panel__body--centered">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              width: '100%',
            }}
          >
            {(() => {
              let goodCount = 0;
              let badCount = 0;
              students.forEach((s) => {
                const { counted, grade: g } = examRowStats(s.id);
                if (counted && g !== null) {
                  if (isPassingForBestehensquote(g, gs)) goodCount++;
                  else badCount++;
                }
              });
              const total = goodCount + badCount;
              const goodPercent = total > 0 ? (goodCount / total) * 100 : 0;
              const badPercent = total > 0 ? 100 - goodPercent : 0;
              const goodLabelPos = pieSegmentLabelPos(0, goodPercent);
              const badLabelPos = pieSegmentLabelPos(goodPercent, badPercent);

              return (
                <>
                  <div data-exam-pie-anchor style={{ position: 'relative', flexShrink: 0, width: 140, height: 140 }}>
                    <svg width="140" height="140" viewBox="0 0 100 100" style={{ cursor: 'pointer', transform: 'rotate(-90deg)' }}>
                      {total > 0 ? (
                        <>
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="transparent"
                            stroke="var(--danger)"
                            strokeWidth="20"
                            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                            onClick={() => setPieTooltip(pieTooltip === 'bad' ? null : 'bad')}
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="transparent"
                            stroke="var(--success)"
                            strokeWidth="20"
                            strokeDasharray={`${goodPercent * 2.513} 251.3`}
                            style={{ transition: 'stroke-dasharray 0.3s ease', pointerEvents: 'stroke', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPieTooltip(pieTooltip === 'good' ? null : 'good');
                            }}
                          />
                        </>
                      ) : (
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#eee" strokeWidth="20" />
                      )}
                    </svg>

                    {total > 0 && goodPercent > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          left: goodLabelPos.left,
                          top: goodLabelPos.top,
                          transform: 'translate(-50%, -50%)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#fff',
                          pointerEvents: 'none',
                          textShadow: '0 0 3px rgba(0,0,0,0.45)',
                        }}
                      >
                        {Math.round(goodPercent)}%
                      </span>
                    )}
                    {total > 0 && badPercent > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          left: badLabelPos.left,
                          top: badLabelPos.top,
                          transform: 'translate(-50%, -50%)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#fff',
                          pointerEvents: 'none',
                          textShadow: '0 0 3px rgba(0,0,0,0.45)',
                        }}
                      >
                        {Math.round(badPercent)}%
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div
                      onClick={() => setPieTooltip('good')}
                      style={{
                        cursor: 'pointer',
                        opacity: pieTooltip === 'bad' ? 0.4 : 1,
                        transition: '0.2s',
                        padding: '4px',
                        borderRadius: '4px',
                        background: pieTooltip === 'good' ? '#f0fff0' : 'transparent',
                      }}
                    >
                      <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{goodCount}</span> {goodLabelShort}
                    </div>
                    <div
                      onClick={() => setPieTooltip('bad')}
                      style={{
                        cursor: 'pointer',
                        opacity: pieTooltip === 'good' ? 0.4 : 1,
                        transition: '0.2s',
                        padding: '4px',
                        borderRadius: '4px',
                        background: pieTooltip === 'bad' ? '#fff5f5' : 'transparent',
                      }}
                    >
                      <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{badCount}</span> {badLabelShort}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          </div>
        </div>

        {showTaskAnalysis ? (
        <div className="glass-panel exam-charts-panel" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 className="mb-6">Aufgabenanalyse</h3>
          <div className="exam-charts-panel__body">
          <div className="exam-task-analysis">
            <div
              className="exam-task-analysis__bars exam-charts-panel__chart"
              style={{ height: chartAreaHeight }}
            >
              <div className="exam-task-analysis__row-gutter" aria-hidden="true" />
              {taskAnalysisData.map(({ index, successPercent, barColor }) => (
                <div key={index} className="exam-task-analysis__bar-col">
                  <div
                    className="exam-task-analysis__bar"
                    title={`Durchschnittlicher Erfolg: ${successPercent.toFixed(1)}%`}
                    style={{
                      height: `${Math.max(successPercent, 2)}%`,
                      background: barColor,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="exam-task-analysis__labels">
              <div className="exam-task-analysis__labels-row">
                <div className="exam-task-analysis__row-gutter" aria-hidden="true" />
                {taskAnalysisData.map(({ index }) => (
                  <div key={index} className="exam-task-analysis__label-cell exam-task-analysis__label-title">
                    A{index + 1}
                  </div>
                ))}
              </div>
              <div className="exam-task-analysis__labels-row">
                <div className="exam-task-analysis__row-gutter" aria-hidden="true" />
                {taskAnalysisData.map(({ index, successPercent }) => (
                  <div
                    key={index}
                    className="exam-task-analysis__label-cell exam-task-analysis__label-line exam-task-analysis__label-line--pct"
                  >
                    {Math.round(successPercent)}%
                  </div>
                ))}
              </div>
              <div className="exam-task-analysis__labels-row">
                <div className="exam-task-analysis__row-gutter exam-task-analysis__label-line">max.</div>
                {taskAnalysisData.map(({ index, maxForTask }) => (
                  <div key={index} className="exam-task-analysis__label-cell exam-task-analysis__label-line">
                    {maxForTask > 0
                      ? maxForTask.toLocaleString('de-DE', { maximumFractionDigits: 2 })
                      : '—'}
                  </div>
                ))}
              </div>
              <div className="exam-task-analysis__labels-row">
                <div className="exam-task-analysis__row-gutter exam-task-analysis__label-line">Ø</div>
                {taskAnalysisData.map(({ index, avgAchieved }) => (
                  <div key={index} className="exam-task-analysis__label-cell exam-task-analysis__label-line">
                    {avgAchieved !== null
                      ? avgAchieved.toLocaleString('de-DE', { maximumFractionDigits: 2 })
                      : '—'}
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>
        ) : null}
      </div>
    </>
  );
}
