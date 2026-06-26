import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import { calculateStudentGrades, formatGrade, formatCalculatedGradeValue, normalizeCourseGradeSystem, barColorForNotenpunkte, storedGradeStringToClassic, storedGradeStringToNotenpunkte } from '../utils/calculator';
import { usesTestsAsHalfExam, usesTestsAsOral, resolveCourseWeighting, effectiveReferatEntriesForGrading, effectiveReferatEntriesForOralGrading, effectiveReferatEntriesForPartialWrittenGrading, effectiveReferatEntriesForPartialOralGrading, effectiveReferatEntriesForFinalPercentGrading, getReferatWrittenUnitWeight, getReferatOralUnitWeight, getReferatFinalPercent, usesReferatAsExam, usesReferatAsOral, usesReferatWrittenPercent, usesReferatOralPercent, usesReferatFinalPercent } from '../utils/courseWeightingOptions';
import StudentGradesOverviewPanel from '../components/StudentGradesOverviewPanel';

/** Balkenfarbe NP (Verteilung) — gleiche Logik wie Klausur-Diagramme */
function barColorForNpBucket(np) {
  return barColorForNotenpunkte(np);
}

function distributionBucket(finalGrade, gradeSys) {
  if (finalGrade === null || Number.isNaN(Number(finalGrade))) return null;
  if (gradeSys === 'points') {
    return Math.round(Math.min(15, Math.max(0, Number(finalGrade))));
  }
  return Math.min(6, Math.max(1, Math.round(Number(finalGrade))));
}

/** Analyse: manuelle Endnote, sonst Note HJ1, sonst berechnete Gesamtnote (Verteilung + Klassendurchschnitt). */
function resolveAnalysisGrade(student, calculatedFinalGrade, gradeSys) {
  if (gradeSys === 'points') {
    const manualEnd = storedGradeStringToNotenpunkte(student.summaryEndNote, gradeSys);
    if (manualEnd !== null) return manualEnd;
    const manualHj1 = storedGradeStringToNotenpunkte(student.summaryHJ1Note, gradeSys);
    if (manualHj1 !== null) return manualHj1;
    if (calculatedFinalGrade === null || Number.isNaN(Number(calculatedFinalGrade))) return null;
    return Math.round(Number(calculatedFinalGrade));
  }
  const manualEnd = storedGradeStringToClassic(student.summaryEndNote, gradeSys);
  if (manualEnd !== null) return manualEnd;
  const manualHj1 = storedGradeStringToClassic(student.summaryHJ1Note, gradeSys);
  if (manualHj1 !== null) return manualHj1;
  if (calculatedFinalGrade === null || Number.isNaN(Number(calculatedFinalGrade))) return null;
  return Number(calculatedFinalGrade);
}

/** Klassisch: ≥ 4,5 stark gefährdet; Punktesystem: NP &lt; 4 */
const STARK_GEFAEHRDET_NP_EXCLUSIVE_MAX = 4;
/** Klassisch: 4,0–4,5 gefährdet; Punktesystem: NP 4 oder 5 */
const GEFAEHRDET_NP_A = 4;
const GEFAEHRDET_NP_B = 5;
const STARK_GEFAEHRDET_MIN = 4.5;
const GEFAEHRDET_MIN = 4.0;
const GEFAEHRDET_MAX_EXCLUSIVE = 4.5;

function barColorForClassicGrade(grade) {
  if (grade === 4) return '#f59e0b';
  if (grade >= 5) return 'var(--danger)';
  return 'hsl(var(--success-hsl))';
}

function sortStudentsByName(a, b) {
  return (
    String(a.lastName ?? '').localeCompare(String(b.lastName ?? ''), 'de') ||
    String(a.firstName ?? '').localeCompare(String(b.firstName ?? ''), 'de')
  );
}

function classAverageBorderColor(avg, gradeSys) {
  if (avg === null || Number.isNaN(Number(avg))) return 'var(--border)';
  const g = Number(avg);
  if (gradeSys === 'points') {
    if (g >= 8) return 'hsl(var(--success-hsl))';
    if (g >= 5) return '#f59e0b';
    return 'var(--danger)';
  }
  if (g <= 3.0) return 'hsl(var(--success-hsl))';
  if (g <= 3.5) return '#f59e0b';
  return 'var(--danger)';
}

function RiskStudentsTable({
  rows,
  gradeColor,
  gradeSystem,
  expandedStudentId,
  onToggleStudent,
  exams,
  orals,
  tests,
  projects,
  gfsEntries,
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
  testsWritten,
  testsAsHalfExam = false,
  testsAsOral = false,
  kursstufe = false,
}) {
  const npMode = gradeSystem === 'points';
  return (
    <div className="table-container" style={{ margin: 0 }}>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Vorname</th>
            <th className="text-right">{npMode ? 'Gesamt (NP)' : 'Gesamtnote (Ø)'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student: s, finalGrade }) => {
            const isExpanded = expandedStudentId === s.id;
            return (
              <React.Fragment key={s.id}>
                <tr
                  onClick={() => onToggleStudent(s.id)}
                  title="Klicken für Notenübersicht"
                  style={{
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    background: isExpanded ? 'rgba(79, 70, 229, 0.05)' : undefined,
                  }}
                >
                  <td>{s.lastName}</td>
                  <td>{s.firstName}</td>
                  <td className="text-right" style={{ fontWeight: 600, color: gradeColor }}>
                    {formatCalculatedGradeValue(finalGrade, gradeSystem, gradeSystem === 'points')}
                  </td>
                </tr>
                {isExpanded && (
                  <tr style={{ background: 'rgba(15, 23, 42, 0.015)' }}>
                    <td colSpan={3} style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                      <StudentGradesOverviewPanel
                        student={s}
                        exams={exams}
                        orals={orals}
                        tests={tests}
                        projects={projects}
                        gfsEntries={gfsEntries}
                        referatEntries={referatEntries}
                        referatCountsAsExam={referatCountsAsExam}
                        referatCountsAsOral={referatCountsAsOral}
                        referatCountsAsPartialWritten={referatCountsAsPartialWritten}
                        referatWrittenPercent={referatWrittenPercent}
                        referatCountsAsPartialOral={referatCountsAsPartialOral}
                        referatOralPercent={referatOralPercent}
                        referatCountsAsFinalPercent={referatCountsAsFinalPercent}
                        referatFinalPercent={referatFinalPercent}
                        showGfs={showGfs}
                        showReferate={showReferate}
                        weighting={weighting}
                        customGradingKeys={customGradingKeys}
                        gradeSys={gradeSystem}
                        testsWritten={testsWritten}
                        testsAsHalfExam={testsAsHalfExam}
                        testsAsOral={testsAsOral}
                        kursstufe={kursstufe}
                        compact
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalysisView() {
  const { students, exams, orals, tests, projects, gfsEntries, referatEntries, config } = useData();
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const customGradingKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const testsWritten = config?.testsWritten !== false;
  const testsAsHalfExam = usesTestsAsHalfExam(config);
  const testsAsOral = usesTestsAsOral(config);
  const weighting = useMemo(
    () => resolveCourseWeighting(config?.weighting, config, exams, tests),
    [config, exams, tests],
  );
  const gradingReferatEntries = useMemo(
    () => effectiveReferatEntriesForGrading(config, referatEntries),
    [config, referatEntries],
  );
  const gradingOralReferatEntries = useMemo(
    () => effectiveReferatEntriesForOralGrading(config, referatEntries),
    [config, referatEntries],
  );
  const gradingPartialWrittenReferatEntries = useMemo(
    () => effectiveReferatEntriesForPartialWrittenGrading(config, referatEntries),
    [config, referatEntries],
  );
  const gradingPartialOralReferatEntries = useMemo(
    () => effectiveReferatEntriesForPartialOralGrading(config, referatEntries),
    [config, referatEntries],
  );
  const referatWrittenUnitWeight = getReferatWrittenUnitWeight(config);
  const referatOralUnitWeight = getReferatOralUnitWeight(config);
  const gradingFinalPercentReferatEntries = useMemo(
    () => effectiveReferatEntriesForFinalPercentGrading(config, referatEntries),
    [config, referatEntries],
  );
  const referatFinalPercent = getReferatFinalPercent(config);
  const referatCountsAsExam = usesReferatAsExam(config);
  const referatCountsAsOral = usesReferatAsOral(config);
  const referatCountsAsPartialWritten = usesReferatWrittenPercent(config);
  const referatCountsAsPartialOral = usesReferatOralPercent(config);
  const referatCountsAsFinalPercent = usesReferatFinalPercent(config);
  const showGfs = config?.gfsAccepted !== false;
  const showReferate = config?.referateAccepted === true;
  const [expandedRiskStudentId, setExpandedRiskStudentId] = useState(null);
  const [distributionTooltipBucket, setDistributionTooltipBucket] = useState(null);
  const [barPopoverGeom, setBarPopoverGeom] = useState(null);

  const toggleRiskStudent = (id) => {
    setExpandedRiskStudentId((prev) => (prev === id ? null : id));
  };

  const riskTableProps = {
    expandedStudentId: expandedRiskStudentId,
    onToggleStudent: toggleRiskStudent,
    exams,
    orals,
    tests,
    projects,
    gfsEntries,
    referatEntries,
    referatCountsAsExam,
    referatCountsAsOral,
    referatCountsAsPartialWritten,
    referatWrittenPercent: config?.referatWrittenPercent ?? 100,
    referatCountsAsPartialOral,
    referatOralPercent: config?.referatOralPercent ?? 100,
    referatCountsAsFinalPercent,
    referatFinalPercent: config?.referatFinalPercent ?? 100,
    showGfs,
    showReferate,
    weighting,
    customGradingKeys,
    testsWritten,
    testsAsHalfExam,
    testsAsOral,
    kursstufe: config?.kursstufe === true,
  };

  const { starkGefaehrdet, gefaehrdet } = useMemo(() => {
    if (!weighting) return { starkGefaehrdet: [], gefaehrdet: [] };
    const withGrade = students
      .map((s) => {
        const { finalGrade } = calculateStudentGrades(
          s.id,
          exams,
          orals,
          tests,
          weighting,
          null,
          gfsEntries,
          Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [],
          gradeSys,
          config.testsWritten !== false,
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
          referatFinalPercent,
        );
        return { student: s, finalGrade };
      })
      .filter(({ finalGrade }) => finalGrade !== null && !Number.isNaN(Number(finalGrade)));

    const sortWorstFirst = gradeSys === 'points'
      ? (a, b) => (a.finalGrade ?? 16) - (b.finalGrade ?? 16)
      : (a, b) => (b.finalGrade ?? 0) - (a.finalGrade ?? 0);

    const stark = withGrade
      .filter(({ finalGrade }) => {
        const g = Number(finalGrade);
        if (gradeSys === 'points') return Math.round(g) < STARK_GEFAEHRDET_NP_EXCLUSIVE_MAX;
        return g >= STARK_GEFAEHRDET_MIN;
      })
      .sort(sortWorstFirst);

    const gef = withGrade
      .filter(({ finalGrade }) => {
        const g = Number(finalGrade);
        if (gradeSys === 'points') {
          const np = Math.round(g);
          return np === GEFAEHRDET_NP_A || np === GEFAEHRDET_NP_B;
        }
        return g >= GEFAEHRDET_MIN && g < GEFAEHRDET_MAX_EXCLUSIVE;
      })
      .sort(sortWorstFirst);

    return { starkGefaehrdet: stark, gefaehrdet: gef };
  }, [students, exams, orals, tests, projects, gfsEntries, gradingReferatEntries, gradingOralReferatEntries, gradingPartialWrittenReferatEntries, referatWrittenUnitWeight, gradingPartialOralReferatEntries, referatOralUnitWeight, gradingFinalPercentReferatEntries, referatFinalPercent, config, gradeSys, weighting, testsAsHalfExam, testsAsOral]);

  const { gradeCounts, maxCount, classAverage, studentsWithGrade, distributionKeys, studentsByBucket } = useMemo(() => {
    const isPoints = gradeSys === 'points';
    const emptyCounts = () => (isPoints ? Array(16).fill(0) : [0, 0, 0, 0, 0, 0]);
    const emptyBuckets = () => {
      const map = {};
      const keys = isPoints ? Array.from({ length: 16 }, (_, i) => i) : [1, 2, 3, 4, 5, 6];
      keys.forEach((k) => {
        map[k] = [];
      });
      return map;
    };
    if (!weighting) {
      return {
        gradeCounts: emptyCounts(),
        maxCount: 1,
        classAverage: null,
        studentsWithGrade: 0,
        distributionKeys: isPoints ? Array.from({ length: 16 }, (_, i) => i) : [1, 2, 3, 4, 5, 6],
        studentsByBucket: emptyBuckets(),
      };
    }
    const counts = emptyCounts();
    const buckets = emptyBuckets();
    const rawGrades = [];
    students.forEach((s) => {
      const { finalGrade } = calculateStudentGrades(
        s.id,
        exams,
        orals,
        tests,
        weighting,
        null,
        gfsEntries,
        Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [],
        gradeSys,
        config.testsWritten !== false,
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
        referatFinalPercent,
      );
      const analysisGrade = resolveAnalysisGrade(s, finalGrade, gradeSys);
      if (analysisGrade === null || Number.isNaN(analysisGrade)) return;
      rawGrades.push(analysisGrade);
      const b = distributionBucket(analysisGrade, gradeSys);
      if (b === null) return;
      buckets[b].push(s);
      if (isPoints) counts[b] += 1;
      else counts[b - 1] += 1;
    });
    const maxC = Math.max(1, ...counts);
    const classAvg =
      rawGrades.length > 0 ? rawGrades.reduce((a, g) => a + g, 0) / rawGrades.length : null;
    return {
      gradeCounts: counts,
      maxCount: maxC,
      classAverage: classAvg,
      studentsWithGrade: rawGrades.length,
      distributionKeys: isPoints ? Array.from({ length: 16 }, (_, i) => i) : [1, 2, 3, 4, 5, 6],
      studentsByBucket: buckets,
    };
  }, [students, exams, orals, tests, projects, gfsEntries, gradingReferatEntries, gradingOralReferatEntries, gradingPartialWrittenReferatEntries, referatWrittenUnitWeight, gradingPartialOralReferatEntries, referatOralUnitWeight, gradingFinalPercentReferatEntries, referatFinalPercent, config, gradeSys, weighting, testsAsHalfExam, testsAsOral]);

  const barPopoverStudents = useMemo(() => {
    if (distributionTooltipBucket === null || distributionTooltipBucket === undefined) return [];
    const list = studentsByBucket[distributionTooltipBucket] ?? [];
    return [...list].sort(sortStudentsByName);
  }, [distributionTooltipBucket, studentsByBucket]);

  useLayoutEffect(() => {
    if (distributionTooltipBucket === null || distributionTooltipBucket === undefined || barPopoverStudents.length === 0) {
      setBarPopoverGeom(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(`[data-analysis-distribution-anchor="${distributionTooltipBucket}"]`);
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
  }, [distributionTooltipBucket, barPopoverStudents.length]);

  useEffect(() => {
    if (distributionTooltipBucket === null || distributionTooltipBucket === undefined) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setDistributionTooltipBucket(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [distributionTooltipBucket]);

  const showBarPortal =
    distributionTooltipBucket !== null &&
    distributionTooltipBucket !== undefined &&
    barPopoverStudents.length > 0 &&
    barPopoverGeom;

  const barPortalBorder = showBarPortal
    ? gradeSys === 'points'
      ? barColorForNpBucket(distributionTooltipBucket)
      : barColorForClassicGrade(distributionTooltipBucket)
    : '';
  const barPortalTitle = showBarPortal
    ? gradeSys === 'points'
      ? `NP ${distributionTooltipBucket}`
      : `Note ${distributionTooltipBucket}`
    : '';
  const barListMaxH = barPopoverGeom
    ? Math.max(120, Math.min(360, window.innerHeight - barPopoverGeom.top - 110))
    : 200;

  const distributionPopoverPortal = showBarPortal
    ? createPortal(
        <>
          <div
            className="exam-charts-popover-backdrop"
            aria-hidden
            onClick={() => setDistributionTooltipBucket(null)}
          />
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
              onClick={() => setDistributionTooltipBucket(null)}
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
        </>,
        document.body,
      )
    : null;

  return (
    <div className="view-generic-scroll" style={{ padding: '0 0 2rem' }}>
      {distributionPopoverPortal}
      <h2 style={{ marginBottom: '1.5rem' }}>Analyse</h2>

      <div
        className="analysis-page-stack"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          width: '100%',
          maxWidth: '100%',
          alignItems: 'stretch',
        }}
      >
      <div className="glass-panel" style={{ borderTop: '4px solid hsl(var(--danger-hsl))', minWidth: 0, width: '100%' }}>
        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem' }}>Gefährdete Schüler</h3>

        {students.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>Noch keine Schüler angelegt.</p>
        ) : (
          <>
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem', fontWeight: 700 }}>Stark gefährdet</h4>
            <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>
              {gradeSys === 'points'
                ? 'Schüler mit berechneter Gesamtnote < 4 NP.'
                : 'Schüler mit berechneter Gesamtnote ≥ 4,5.'}
            </p>
            {starkGefaehrdet.length === 0 && gefaehrdet.length === 0 ? null : starkGefaehrdet.length > 0 ? (
              <RiskStudentsTable rows={starkGefaehrdet} gradeColor="var(--danger)" gradeSystem={gradeSys} {...riskTableProps} />
            ) : (
              <p className="text-muted" style={{ margin: '0 0 1.25rem', fontSize: '0.875rem' }}>Keine Schüler in dieser Kategorie.</p>
            )}

            <h4 style={{ margin: '1.25rem 0 0.35rem', fontSize: '0.95rem', fontWeight: 700 }}>Gefährdet</h4>
            <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>
              {gradeSys === 'points'
                ? 'Schüler mit berechneter Gesamtnote 4 NP oder 5 NP.'
                : 'Schüler mit berechneter Gesamtnote ≥ 4,0 und < 4,5.'}
            </p>
            {starkGefaehrdet.length === 0 && gefaehrdet.length === 0 ? null : gefaehrdet.length > 0 ? (
              <RiskStudentsTable rows={gefaehrdet} gradeColor="hsl(28 78% 32%)" gradeSystem={gradeSys} {...riskTableProps} />
            ) : (
              <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>Keine Schüler in dieser Kategorie.</p>
            )}

            {starkGefaehrdet.length === 0 && gefaehrdet.length === 0 && (
              <p style={{ margin: '1rem 0 0', color: 'hsl(var(--success-hsl))', fontWeight: 500 }}>
                In beiden Kategorien ist aktuell niemand erfasst — nach diesen Kriterien kein besonderer Hinweis auf Förderbedarf.
              </p>
            )}
          </>
        )}
      </div>

      <div className="glass-panel analysis-grade-panel" style={{ borderTop: '4px solid var(--primary)', minWidth: 0, width: '100%' }}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>Klassendurchschnitt</h3>
        <p className="text-muted" style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
          Arithmetischer Mittelwert je Schüler: manuelle Endnote aus der Übersicht, sonst Note HJ1, sonst berechnete Gesamtnote ({studentsWithGrade} von {students.length} Schülern mit auswertbarer Note).
        </p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '7rem',
              padding: '0.85rem 1.5rem',
              border: `2px solid ${classAverageBorderColor(classAverage, gradeSys)}`,
              borderRadius: '10px',
              background: 'hsl(var(--background) / 0.6)',
            }}
            aria-live="polite"
          >
            <span
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
                color: 'var(--foreground)',
                lineHeight: 1.1,
              }}
            >
              {classAverage === null ? '—' : formatCalculatedGradeValue(classAverage, gradeSys, gradeSys === 'points')}
            </span>
          </div>
        </div>

        <h3 style={{ margin: '1.5rem 0 0.75rem', fontSize: '1.05rem' }}>Notenverteilung</h3>
        {gradeSys === 'points' ? (
          <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>
            Je Schüler: manuelle Endnote bzw. Note HJ1 aus der Übersicht, sonst berechnete Gesamtnote (als Notenpunkte 0–15). Klick auf einen Balken zeigt die zugehörigen Schüler.
          </p>
        ) : (
          <p className="text-muted" style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>
            Je Schüler: manuelle Endnote bzw. Note HJ1 aus der Übersicht, sonst berechnete Gesamtnote. Klick auf einen Balken zeigt die Schüler mit dieser Note.
          </p>
        )}

        {studentsWithGrade === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>Noch keine auswertbaren Gesamtnoten — Noten für Klausuren, Mündlich und Tests erfassen.</p>
        ) : (
          <div className="analysis-grade-chart" style={{ marginTop: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: gradeSys === 'points' ? '0.12rem' : '0.5rem',
                height: 'min(300px, min(42dvh, 360px))',
                padding: '0.35rem 0.25rem 0',
                marginTop: '0.25rem',
                overflowX: gradeSys === 'points' ? 'auto' : undefined,
                overflowY: 'visible',
              }}
              role="img"
              aria-label={
                gradeSys === 'points'
                  ? `Notenpunkte-Verteilung: ${distributionKeys.map((k) => `NP ${k}: ${gradeCounts[k]}`).join(', ')}`
                  : `Notenverteilung: Note 1 ${gradeCounts[0]} Schüler, Note 2 ${gradeCounts[1]}, Note 3 ${gradeCounts[2]}, Note 4 ${gradeCounts[3]}, Note 5 ${gradeCounts[4]}, Note 6 ${gradeCounts[5]}`
              }
            >
              {distributionKeys.map((bucketKey) => {
                const counts =
                  gradeSys === 'points' ? gradeCounts[bucketKey] : gradeCounts[bucketKey - 1];
                const heightPercent = counts > 0 ? (counts / maxCount) * 94 : 0;
                const barColor =
                  gradeSys === 'points' ? barColorForNpBucket(bucketKey) : barColorForClassicGrade(bucketKey);
                const isTooltipActive = distributionTooltipBucket === bucketKey;
                return (
                  <div
                    key={bucketKey}
                    data-analysis-distribution-anchor={String(bucketKey)}
                    style={{
                      flex: gradeSys === 'points' ? '0 0 auto' : 1,
                      minWidth: gradeSys === 'points' ? '1rem' : 0,
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
                        onClick={() =>
                          counts > 0 &&
                          setDistributionTooltipBucket(isTooltipActive ? null : bucketKey)
                        }
                        style={{
                          width: gradeSys === 'points' ? '72%' : '78%',
                          height: counts > 0 ? `${heightPercent}%` : '4px',
                          minHeight: counts > 0 ? '6px' : undefined,
                          background: counts > 0 ? barColor : 'hsl(var(--muted))',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.25s ease, opacity 0.2s',
                          position: 'relative',
                          cursor: counts > 0 ? 'pointer' : 'default',
                          opacity:
                            distributionTooltipBucket !== null &&
                            distributionTooltipBucket !== undefined &&
                            !isTooltipActive
                              ? 0.3
                              : 1,
                          boxShadow: isTooltipActive ? `0 0 0 3px white, 0 0 0 5px ${barColor}` : 'none',
                          zIndex: isTooltipActive ? 10 : 1,
                        }}
                      >
                        {counts > 0 && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '-1.35rem',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {counts}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: '0.65rem',
                        fontWeight: 600,
                        fontSize: gradeSys === 'points' ? '0.62rem' : '0.8rem',
                        borderTop: '2px solid var(--border)',
                        width: '100%',
                        textAlign: 'center',
                        paddingTop: '0.45rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {bucketKey}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
