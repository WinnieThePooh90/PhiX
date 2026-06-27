import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Wrench } from 'lucide-react';
import { useData } from '../store/DataContext';
import { usesTestsAsHalfExam, usesTestsAsOral, showTestsInWeightingRatio, includeTestsInFinalWeight, resolveCourseWeighting, effectiveReferatEntriesForGrading, effectiveReferatEntriesForOralGrading, effectiveReferatEntriesForPartialWrittenGrading, effectiveReferatEntriesForPartialOralGrading, effectiveReferatEntriesForFinalPercentGrading, getReferatWrittenUnitWeight, getReferatOralUnitWeight, getReferatFinalPercent, usesReferatAsExam, usesReferatAsOral, usesReferatWrittenPercent, usesReferatOralPercent, usesReferatFinalPercent } from '../utils/courseWeightingOptions';
import {
  calculateStudentGrades,
  getStudentGradeCalculationBreakdown,
  formatGrade,
  formatCalculatedGradeValue,
  formatOverviewCalculatedGrade,
  calculatedGradeDisplayOpts,
  isGradeWorseThan4,
  getGradeCellBackground,
  getGradeTextColor,
  storedGradeStringToClassic,
  normalizeCourseGradeSystem,
} from '../utils/calculator';
import MaximizableTableSection, { TableMaximizeToggle } from '../components/MaximizableTableSection';
import StudentGradesOverviewPanel from '../components/StudentGradesOverviewPanel';
import StudentSummaryNotesModal from '../components/StudentSummaryNotesModal';
import { focusAdjacentSummaryGradeInput, isEnterAsTabKey } from '../utils/tableEnterAsTab';
import { getCourseGradingKeysLookup } from '../utils/courseArchive';

function hasSummaryNotes(student) {
  return String(student?.summaryNotes ?? '').trim() !== '';
}

/** Blaues Fähnchen — Notiz in der Gesamtübersicht (analog zu Klausur-Fähnchen) */
function SummaryNotesBookmark() {
  return (
    <svg
      width="9"
      height="12"
      viewBox="0 0 10 14"
      aria-hidden
      style={{
        display: 'block',
        filter: 'drop-shadow(0 1px 1px rgba(37, 99, 235, 0.35))',
      }}
    >
      <path
        d="M1.25 1C1.25 0.72 1.47 0.5 1.75 0.5H8.25C8.53 0.5 8.75 0.72 8.75 1V9.35L5 12.15L1.25 9.35V1Z"
        fill="#dbeafe"
        stroke="#2563eb"
        strokeWidth="0.65"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Rotes Fähnchen — GFS/Referat angelegt, aber noch nicht gehalten */
function PendingLeistungBookmark() {
  return (
    <svg
      width="9"
      height="12"
      viewBox="0 0 10 14"
      aria-hidden
      style={{
        display: 'block',
        filter: 'drop-shadow(0 1px 1px rgba(185, 28, 28, 0.35))',
      }}
    >
      <path
        d="M1.25 1C1.25 0.72 1.47 0.5 1.75 0.5H8.25C8.53 0.5 8.75 0.72 8.75 1V9.35L5 12.15L1.25 9.35V1Z"
        fill="#fee2e2"
        stroke="#dc2626"
        strokeWidth="0.65"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function studentHasPendingLeistung(entries, studentId) {
  if (!Array.isArray(entries) || !studentId) return false;
  return entries.some((e) => e.studentId === studentId && e.gehalten !== true);
}

function SummaryLeistungFlag({ label, title, onClick }) {
  return (
    <button
      type="button"
      className="summary-leistung-flag"
      aria-label={label}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <PendingLeistungBookmark />
    </button>
  );
}

/** Anzeige im Eingabefeld: gespeicherten Wert mit Komma */
function summaryEndNoteInputDisplay(raw) {
  if (raw === undefined || raw === null || raw === '') return '';
  const s = String(raw).trim();
  const n = parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n)) return s;
  return s.includes(',') ? s : String(s).replace('.', ',');
}

function summaryEndNoteDraftFromStored(stored, gradeSystem) {
  if (stored === undefined || stored === null || stored === '') return '';
  if (gradeSystem === 'points') return String(stored).trim();
  return summaryEndNoteInputDisplay(stored);
}

function resolveSummaryWeighting(weighting) {
  const rawWritten = Number(weighting?.written);
  const rawOral = Number(weighting?.oral);
  const rawTests = Number(weighting?.tests);
  const hasAnyValidWeight = Number.isFinite(rawWritten) || Number.isFinite(rawOral) || Number.isFinite(rawTests);
  return {
    written: Number.isFinite(rawWritten) ? rawWritten : (hasAnyValidWeight ? 0 : 2),
    oral: Number.isFinite(rawOral) ? rawOral : (hasAnyValidWeight ? 0 : 1),
    tests: Number.isFinite(rawTests) ? rawTests : (hasAnyValidWeight ? 0 : 1),
    hasAnyValidWeight,
  };
}

function getActivePercentProjects(projects) {
  return Object.entries(projects || {})
    .filter(([_, p]) => p.active && p.weightingMode === 'percent' && Number(p.weightPercent) > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, p]) => ({
      id,
      name: p.name || `Projekt ${id}`,
      percent: Number(p.weightPercent),
    }));
}

function SummaryFormulaModal({ open, onClose, config, projects, gradeSys, exams, tests }) {
  if (!open) return null;

  const weights = resolveSummaryWeighting(resolveCourseWeighting(config?.weighting, config, exams, tests));
  const testsWritten = config?.testsWritten !== false;
  const testsAsHalfExam = usesTestsAsHalfExam(config);
  const testsAsOral = usesTestsAsOral(config);
  const showTestsInFinal = includeTestsInFinalWeight(config);
  const percentProjects = getActivePercentProjects(projects);
  const totalPercent = percentProjects.reduce((s, p) => s + p.percent, 0);
  const remainingFactor = Math.max(0, (100 - totalPercent) / 100);
  const wSum = weights.written + weights.oral + (showTestsInFinal ? weights.tests : 0);

  const weightLine = showTestsInFinal
    ? <>Gewichte (Einstellungen): <strong>w<sub>S</sub> = {weights.written}</strong>, <strong>w<sub>M</sub> = {weights.oral}</strong>, <strong>w<sub>T</sub> = {weights.tests}</strong></>
    : <>Gewichte (Einstellungen): <strong>w<sub>S</sub> = {weights.written}</strong>, <strong>w<sub>M</sub> = {weights.oral}</strong></>;

  const standardClassicNumerator = showTestsInFinal
    ? <>w<sub>S</sub>·S + w<sub>M</sub>·M + w<sub>T</sub>·T</>
    : <>w<sub>S</sub>·S + w<sub>M</sub>·M</>;

  const standardClassicDenom = showTestsInFinal
    ? <>w<sub>S</sub> + w<sub>M</sub> + w<sub>T</sub></>
    : <>w<sub>S</sub> + w<sub>M</sub></>;

  const standardNpNumerator = showTestsInFinal
    ? <>w<sub>S</sub>·NP(S) + w<sub>M</sub>·NP(M) + w<sub>T</sub>·NP(T)</>
    : <>w<sub>S</sub>·NP(S) + w<sub>M</sub>·NP(M)</>;

  return createPortal(
    <div
      className="oral-formula-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="oral-formula-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-formula-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 'min(36rem, calc(100vw - 2rem))' }}
      >
        <div className="oral-formula-modal-header">
          <h2 id="summary-formula-modal-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            Berechnungsvorschrift — Gesamtübersicht
          </h2>
          <button type="button" className="tab secondary" onClick={onClose}>
            Schließen
          </button>
        </div>
        <div className="oral-formula-modal-body text-muted" style={{ fontSize: '0.875rem', lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 0.75rem', color: 'var(--text-main)' }}>
            Die Spalte <strong>Endnote (Exakt)</strong> ist das gewichtete Mittel der Teildurchschnitte Schriftlich, Mündlich und Tests
            {percentProjects.length > 0 ? ' sowie prozentualer Projektanteile' : ''}.
          </p>

          <p style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontWeight: 600 }}>Teildurchschnitte</p>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
            <li style={{ marginBottom: '0.45rem' }}>
              <strong>S</strong> (Schriftlich): arithmetisches Mittel aller zählenden Klausur-Noten, gehaltener GFS-Noten
              (jede GFS zählt wie eine Klausur) und aktiver Projekte mit Gewichtung „zu schriftlich“
              {testsAsHalfExam ? '; jeder Test zählt mit 50 % (wie eine halbe Klausur)' : ''}.
            </li>
            <li style={{ marginBottom: '0.45rem' }}>
              <strong>M</strong> (Mündlich): arithmetisches Mittel aller aktiven mündlichen Bereiche und Projekte mit Gewichtung „zu mündlich“
              {testsAsOral ? '; jeder Test zählt wie eine mündliche Note' : ''}.
            </li>
            {showTestsInFinal && (
              <li style={{ marginBottom: '0.45rem' }}>
                <strong>T</strong> (Tests): arithmetisches Mittel aller aktiven, zählenden Test-Noten.
              </li>
            )}
            {percentProjects.length > 0 && (
              <li>
                <strong>g<sub>i</sub></strong>, <strong>p<sub>i</sub></strong>: Note bzw. Prozentanteil (0–100) pro aktivem Projekt mit Gewichtung „prozentual“
                {percentProjects.map((p) => (
                  <span key={p.id}>
                    {' '}
                    (<em>{p.name}</em>: p = {p.percent} %)
                  </span>
                ))}.
              </li>
            )}
          </ul>

          <p style={{ margin: '0 0 0.35rem', color: 'var(--text-main)', fontWeight: 600 }}>{weightLine}</p>
          {percentProjects.length > 0 && (
            <p style={{ margin: '0 0 0.75rem' }}>
              Restfaktor für die drei Säulen:{' '}
              <strong>
                f = (100 − Σp<sub>i</sub>) / 100 = {remainingFactor.toLocaleString('de-DE', { maximumFractionDigits: 4 })}
              </strong>
              {totalPercent > 100 && (
                <span style={{ color: 'var(--danger)' }}> (Summe der Prozentanteile &gt; 100 % — f wird auf 0 begrenzt)</span>
              )}
            </p>
          )}

          <p style={{ margin: '0 0 0.5rem', color: 'var(--text-main)', fontWeight: 600 }}>Gesamtformel</p>
          <p style={{ margin: '0 0 0.65rem', fontSize: '0.82rem' }}>
            Fehlt ein Teildurchschnitt (keine zählenden Noten), entfällt die jeweilige Säule im Zähler und Nenner.
          </p>

          {gradeSys === 'points' ? (
            <>
              <div className="summary-formula-math-block">
                {percentProjects.length > 0 ? (
                  <>
                    NP<sub>end</sub> = round{' '}
                    <span className="summary-formula-math-fraction">
                      <span>f · ({standardNpNumerator})</span>
                      <span>{standardClassicDenom}</span>
                    </span>
                    {' '}+ Σ (NP(g<sub>i</sub>) · p<sub>i</sub> / 100)
                  </>
                ) : (
                  <>
                    NP<sub>end</sub> = round{' '}
                    <span className="summary-formula-math-fraction">
                      <span>{standardNpNumerator}</span>
                      <span>{standardClassicDenom}</span>
                    </span>
                  </>
                )}
              </div>
              <p style={{ margin: '0.75rem 0 0' }}>
                <strong>NP(·)</strong> bildet den angezeigten Teildurchschnitt auf Notenpunkte 0–15 ab;{' '}
                <strong>round</strong> rundet auf ganze Notenpunkte. Die <strong>Endnote (Exakt)</strong> ist die zugehörige Schulnote
                (Abitur-Zuordnungstabelle).
              </p>
            </>
          ) : (
            <>
              <div className="summary-formula-math-block">
                {percentProjects.length > 0 ? (
                  <>
                    Endnote = f ·{' '}
                    <span className="summary-formula-math-fraction">
                      <span>{standardClassicNumerator}</span>
                      <span>{standardClassicDenom}</span>
                    </span>
                    {' '}+ Σ (g<sub>i</sub> · p<sub>i</sub> / 100)
                  </>
                ) : wSum > 0 ? (
                  <>
                    Endnote ={' '}
                    <span className="summary-formula-math-fraction">
                      <span>{standardClassicNumerator}</span>
                      <span>{standardClassicDenom}</span>
                    </span>
                  </>
                ) : (
                  <>Endnote = Σ (g<sub>i</sub> · p<sub>i</sub> / 100)</>
                )}
              </div>
              <p style={{ margin: '0.75rem 0 0' }}>
                Noten liegen kontinuierlich auf der Skala 1–6 (wie in den Spalten Schriftlich/Mündlich/Tests angezeigt).
                Gibt es nur prozentuale Projektanteile ohne die drei Säulen, ist die Endnote allein die Summe Σ(g<sub>i</sub>·p<sub>i</sub>/100).
              </p>
            </>
          )}

          {wSum > 0 && (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem' }}>
              Mit den aktuellen Gewichten{percentProjects.length > 0 ? ' und f' : ''} numerisch:{' '}
              {gradeSys === 'points' ? (
                percentProjects.length > 0 ? (
                  <>
                    NP<sub>end</sub> = round(f · ({weights.written}·NP(S) + {weights.oral}·NP(M)
                    {showTestsInFinal ? ` + ${weights.tests}·NP(T)` : ''}) / {wSum}
                    {percentProjects.map((p) => ` + ${p.percent}%·NP(g${p.id})`).join('')})
                  </>
                ) : (
                  <>
                    NP<sub>end</sub> = round(({weights.written}·NP(S) + {weights.oral}·NP(M)
                    {showTestsInFinal ? ` + ${weights.tests}·NP(T)` : ''}) / {wSum})
                  </>
                )
              ) : percentProjects.length > 0 ? (
                <>
                  Endnote = {remainingFactor.toLocaleString('de-DE', { maximumFractionDigits: 4 })} · ({weights.written}·S + {weights.oral}·M
                  {showTestsInFinal ? ` + ${weights.tests}·T` : ''}) / {wSum}
                  {percentProjects.map((p) => ` + ${(p.percent / 100).toLocaleString('de-DE', { maximumFractionDigits: 4 })}·g${p.id}`).join('')}
                </>
              ) : (
                <>
                  Endnote = ({weights.written}·S + {weights.oral}·M
                  {showTestsInFinal ? ` + ${weights.tests}·T` : ''}) / {wSum}
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const CALCULATION_CATEGORIES = [
  { key: '1', label: 'Halbjahr 1' },
  { key: '2', label: 'Halbjahr 2' },
  { key: 'all', label: 'Gesamt' },
];

function MathFraction({ numerator, denominator }) {
  return (
    <span className="summary-formula-math-fraction">
      <span>{numerator}</span>
      <span>{denominator}</span>
    </span>
  );
}

function WeightSymbol({ pillarKey }) {
  return <>w<sub>{pillarKey}</sub></>;
}

function PillarTerm({ pillar, useNp = false }) {
  return (
    <>
      <WeightSymbol pillarKey={pillar.key} />
      ·{useNp ? <>NP({pillar.key})</> : pillar.key}
    </>
  );
}

function PercentProjectTerm({ project, useNp = false }) {
  const symbol = useNp ? <>NP(g<sub>{project.id}</sub>)</> : <>g<sub>{project.id}</sub></>;
  return (
    <>
      {symbol} · <MathFraction numerator={<>p<sub>{project.id}</sub></>} denominator="100" />
    </>
  );
}

function GeneralFinalFormulaContent({ generalFormula }) {
  if (!generalFormula || generalFormula.mode === 'none') return null;

  const { pillars, percentProjects, mode } = generalFormula;
  const useNp = mode.startsWith('points');

  const renderPillarNum = () => pillars.map((pillar, idx) => (
    <span key={`num-${pillar.key}`}>
      {idx > 0 ? ' + ' : ''}
      <PillarTerm pillar={pillar} useNp={useNp} />
    </span>
  ));
  const renderPillarDen = () => pillars.map((pillar, idx) => (
    <span key={`den-${pillar.key}`}>
      {idx > 0 ? ' + ' : ''}
      <WeightSymbol pillarKey={pillar.key} />
    </span>
  ));
  const renderPercentSum = () => percentProjects.map((project, idx) => (
    <span key={`pct-${project.id}`}>
      {idx > 0 ? ' + ' : ''}
      <PercentProjectTerm project={project} useNp={useNp} />
    </span>
  ));

  const renderFormula = () => {
    switch (mode) {
      case 'classic_pillars':
        return <MathFraction numerator={renderPillarNum()} denominator={renderPillarDen()} />;
      case 'classic_pillars_percent':
        return (
          <>
            f · <MathFraction numerator={renderPillarNum()} denominator={renderPillarDen()} />
            {' + '}
            {renderPercentSum()}
          </>
        );
      case 'classic_percent_only':
        return renderPercentSum();
      case 'points_pillars':
        return (
          <>
            round(<MathFraction numerator={renderPillarNum()} denominator={renderPillarDen()} />)
          </>
        );
      case 'points_pillars_percent':
        return (
          <>
            round(f · <MathFraction numerator={renderPillarNum()} denominator={renderPillarDen()} />
            {' + '}
            {renderPercentSum()})
          </>
        );
      case 'points_percent_only':
        return <>round({renderPercentSum()})</>;
      default:
        return null;
    }
  };

  return (
    <span className="calc-step-math">
      <strong>Endnote (Exakt)</strong> = {renderFormula()}
      {useNp && (
        <span className="calc-step-hint"> (Zuordnung aus NP<sub>end</sub> gerundet)</span>
      )}
    </span>
  );
}

function CalculationStepLine({ step }) {
  switch (step.type) {
    case 'sources':
      return (
        <>
          {step.label} ({step.key}) aus:{' '}
          {step.items.map((item, idx) => (
            <span key={`${item.label}-${idx}`}>
              {idx > 0 ? ', ' : ''}
              {item.label}: <strong>{item.grade}</strong>
            </span>
          ))}
        </>
      );
    case 'fraction':
      return (
        <span className="calc-step-math">
          {step.label != null && step.label !== '' && <>{step.label} = </>}
          <MathFraction numerator={step.numerator} denominator={step.denominator} />
          {step.factor != null && <> · {step.factor}</>}
          {step.result != null && (
            <>
              {' '}
              = <strong>{step.result}</strong>
            </>
          )}
        </span>
      );
    case 'mulFraction':
      return (
        <span className="calc-step-math">
          {step.prefix}: {step.left} · <MathFraction numerator={step.percent} denominator="100" /> = <strong>{step.result}</strong>
        </span>
      );
    case 'restFactor':
      return (
        <span className="calc-step-math">
          Restfaktor f = <MathFraction numerator={`100 − ${step.totalPercent} %`} denominator="100" /> = <strong>{step.result}</strong>
        </span>
      );
    case 'sum':
      return (
        <span className="calc-step-math">
          {step.label} = {step.parts.join(' + ')} = <strong>{step.result}</strong>
        </span>
      );
    case 'npNote':
      return (
        <span className="calc-step-math">
          NP({step.key}) = <strong>{step.np}</strong> (aus {step.key} = {step.from})
        </span>
      );
    case 'mapping':
      return (
        <span className="calc-step-math">
          {step.label} = Zuordnung {step.from} → <strong>{step.to}</strong>
        </span>
      );
    case 'generalFinal':
      return <GeneralFinalFormulaContent generalFormula={step.generalFormula} />;
    case 'text':
    default:
      return <span>{step.text}</span>;
  }
}

function SummaryStudentCalculationModal({
  open,
  onClose,
  student,
  config,
  exams,
  orals,
  tests,
  projects,
  gfsEntries,
  referatEntries,
  oralReferatEntries = [],
  partialWrittenReferatEntries = [],
  referatWrittenUnitWeight = 0,
  partialOralReferatEntries = [],
  referatOralUnitWeight = 0,
  finalPercentReferatEntries = [],
  referatFinalPercent = 0,
  customGradingKeys,
  gradeSys,
}) {
  const [categoryKey, setCategoryKey] = useState('all');

  useEffect(() => {
    if (open) setCategoryKey('all');
  }, [open, student?.id]);

  if (!open || !student) return null;

  const halbjahrFilter = categoryKey === 'all' ? null : categoryKey;
  const categoryLabel = CALCULATION_CATEGORIES.find((cat) => cat.key === categoryKey)?.label ?? 'Gesamt';
  const testsAsHalfExam = usesTestsAsHalfExam(config);
  const testsAsOral = usesTestsAsOral(config);
  const resolvedWeighting = resolveCourseWeighting(config?.weighting, config, exams, tests);
  const breakdown = getStudentGradeCalculationBreakdown(
    student.id,
    exams,
    orals,
    tests,
    resolvedWeighting,
    halbjahrFilter,
    gfsEntries,
    customGradingKeys,
    gradeSys,
    config?.testsWritten !== false,
    projects,
    testsAsHalfExam,
    testsAsOral,
    referatEntries,
    oralReferatEntries,
    partialWrittenReferatEntries,
    referatWrittenUnitWeight,
    partialOralReferatEntries,
    referatOralUnitWeight,
    finalPercentReferatEntries,
    referatFinalPercent,
  );
  const gfmtOverview = (g) => formatOverviewCalculatedGrade(g, gradeSys, breakdown.valuesAreNotenpunkte);
  const calcOpts = calculatedGradeDisplayOpts(breakdown.valuesAreNotenpunkte, gradeSys);
  const gfmt = (g) => formatGrade(g, gradeSys);

  return createPortal(
    <div className="oral-formula-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="oral-formula-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-student-calc-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 'min(40rem, calc(100vw - 2rem))' }}
      >
        <div className="oral-formula-modal-header">
          <h2 id="summary-student-calc-modal-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            Berechnung — {student.lastName}, {student.firstName}
          </h2>
          <button type="button" className="tab secondary" onClick={onClose}>
            Schließen
          </button>
        </div>
        <div className="oral-formula-modal-body text-muted" style={{ fontSize: '0.875rem', lineHeight: 1.55 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
            {CALCULATION_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={`tab${categoryKey === cat.key ? '' : ' secondary'}`}
                onClick={() => setCategoryKey(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <section className="calc-modal-section">
            <h3 className="calc-modal-section-title">
              Berechnung — {categoryLabel}
            </h3>

            {breakdown.steps.length === 0 ? (
              <p style={{ margin: 0 }}>Keine zählenden Noten für diese Auswahl.</p>
            ) : (
              <ol className="calc-step-list">
                {breakdown.steps.map((step, idx) => (
                  <li
                    key={idx}
                    className={
                      step.type === 'text'
                        ? 'calc-step-list__plain'
                        : 'calc-step-list__math'
                    }
                  >
                    <CalculationStepLine step={step} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="calc-modal-section calc-modal-section--result">
            <h3 className="calc-modal-section-title">Ergebnis</h3>
            <p className="calc-modal-result">
              Endnote (Exakt):{' '}
              <span style={{ color: isGradeWorseThan4(breakdown.finalGrade, gradeSys, calcOpts) ? 'var(--danger)' : 'var(--primary)' }}>
                {gfmtOverview(breakdown.finalGrade)}
              </span>
            </p>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SummaryGradeInputCell({ student, field, updateStudentConfig, gradeSystem, label }) {
  const stored = student[field] ?? '';
  const [draft, setDraft] = useState(() => summaryEndNoteDraftFromStored(stored, gradeSystem));

  useEffect(() => {
    setDraft(summaryEndNoteDraftFromStored(student[field] ?? '', gradeSystem));
  }, [student.id, student[field], gradeSystem]);

  const manualNum = storedGradeStringToClassic(stored, gradeSystem);

  const commit = () => {
    const t = draft.trim();
    if (t === '') {
      updateStudentConfig(student.id, field, '');
      setDraft('');
      return;
    }
    if (gradeSystem === 'points') {
      const np = Math.round(parseFloat(t.replace(/\s/g, '').replace(',', '.')));
      if (!Number.isFinite(np) || np < 0 || np > 15) {
        setDraft(summaryEndNoteDraftFromStored(stored, gradeSystem));
        return;
      }
      updateStudentConfig(student.id, field, String(np));
      setDraft(String(np));
      return;
    }
    const dec = t.replace(',', '.');
    const n = parseFloat(dec);
    if (!Number.isFinite(n)) {
      setDraft(summaryEndNoteInputDisplay(stored));
      return;
    }
    const clamped = Math.min(6, Math.max(1, n));
    updateStudentConfig(student.id, field, clamped.toFixed(2));
    setDraft(summaryEndNoteInputDisplay(clamped.toFixed(2)));
  };

  const navigateToAdjacentRow = (el, reverse) => {
    commit();
    requestAnimationFrame(() => focusAdjacentSummaryGradeInput(el, reverse));
  };

  return (
    <input
      type="text"
      inputMode={gradeSystem === 'points' ? 'numeric' : 'decimal'}
      data-summary-grade-input={field}
      aria-label={`${label} für ${student.firstName} ${student.lastName}`}
      value={draft}
      placeholder="-"
      title={
        gradeSystem === 'points'
          ? 'Notenpunkte 0–15 (werden so in der Datenbank gespeichert)'
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          navigateToAdjacentRow(e.currentTarget, e.shiftKey);
          return;
        }
        if (!isEnterAsTabKey(e)) return;
        e.preventDefault();
        navigateToAdjacentRow(e.currentTarget, false);
      }}
      style={{
        width: '5.25rem',
        padding: '0.35rem 0.4rem',
        textAlign: 'center',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        background: 'var(--background)',
        color: manualNum !== null && isGradeWorseThan4(manualNum, gradeSystem) ? 'var(--danger)' : 'var(--foreground)',
        fontWeight: 600,
      }}
    />
  );
}

export default function SummaryView({
  studentIdFilterSet = null,
  onOpenAnalysis,
  onOpenGfs,
  onOpenReferate,
}) {
  const { students, exams, orals, tests, projects, gfsEntries, referatEntries, config, setConfig, updateStudentConfig, courseArchived } = useData();

  const displayStudents = useMemo(() => {
    if (studentIdFilterSet == null) return students;
    return students.filter((s) => studentIdFilterSet.has(s.id));
  }, [students, studentIdFilterSet]);

  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [calculationStudent, setCalculationStudent] = useState(null);
  const [notesModalStudent, setNotesModalStudent] = useState(null);
  const [overviewMaximized, setOverviewMaximized] = useState(false);
  const isKursstufe = config?.kursstufe === true;
  const showHJ1FromConfig = config?.summaryShowHJ1 !== false;
  const [showHJ1Local, setShowHJ1Local] = useState(showHJ1FromConfig);
  useEffect(() => {
    setShowHJ1Local(showHJ1FromConfig);
  }, [config?.id, showHJ1FromConfig]);
  const showHJ1 = !isKursstufe && (courseArchived ? showHJ1Local : showHJ1FromConfig);
  const showTests = config?.testsWritten !== false;
  const testsAsHalfExam = usesTestsAsHalfExam(config);
  const testsAsOral = usesTestsAsOral(config);
  const showTestsInWeighting = showTestsInWeightingRatio(config);
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
  const customGradingKeys = getCourseGradingKeysLookup(config);
  const hasValidWeighting =
    Number.isFinite(Number(weighting?.written)) &&
    Number.isFinite(Number(weighting?.oral)) &&
    (!showTestsInWeighting || Number.isFinite(Number(weighting?.tests)));
  const showGfs = config?.gfsAccepted !== false;
  const showReferate = config?.referateAccepted === true;
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const gfmt = (g) => formatGrade(g, gradeSys);
  const gfmtCalc = (g, valuesAreNotenpunkte) =>
    formatCalculatedGradeValue(g, gradeSys, valuesAreNotenpunkte);
  const gfmtOverview = (g, valuesAreNotenpunkte) =>
    formatOverviewCalculatedGrade(g, gradeSys, valuesAreNotenpunkte);

  const toggleRow = (id) => {
    setExpandedStudentId(prev => prev === id ? null : id);
  };

  if (!config) {
    return (
      <div className="view-generic-scroll summary-overview">
        <p className="text-muted" style={{ padding: '1.5rem' }}>
          Kein Kurs ausgewählt oder Daten werden geladen.
        </p>
      </div>
    );
  }

  const colCount = 6 + (showTests ? 1 : 0) + (showHJ1 ? 1 : 0) + 1;

  return (
    <div className="view-generic-scroll summary-overview">
      <div
        className="flex flex-wrap gap-4 course-meta-settings-row"
        style={{ marginBottom: '0.75rem', width: '100%', justifyContent: 'space-between', alignItems: 'flex-end' }}
      >
        {!isKursstufe && (
          <div className="course-meta-field">
            <span className="course-meta-field__label">Halbjahresnote anzeigen</span>
            <div className="course-meta-field__row">
              <label className="switch" title="Spalte &#x201E;Note HJ1&#x201C; ein-/ausblenden">
                <input
                  type="checkbox"
                  data-archived-allow
                  checked={showHJ1}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (courseArchived) {
                      setShowHJ1Local(checked);
                    } else {
                      setConfig((c) => ({ ...c, summaryShowHJ1: checked }));
                    }
                  }}
                />
                <span className="slider" />
              </label>
            </div>
          </div>
        )}
        <div className="view-toolbar-actions">
          <button
            type="button"
            className="tab secondary course-meta-inline-btn"
            onClick={() => onOpenAnalysis?.()}
            title="Klassenanalyse (Notenverteilung, Klassendurchschnitt, Gefährdete Schüler)"
          >
            Analyse
          </button>
          <button
            type="button"
            className="tab secondary course-meta-inline-btn"
            onClick={() => setFormulaModalOpen(true)}
            title="Berechnungsvorschrift und Erläuterungen zur Endnote"
          >
            Info
          </button>
          <TableMaximizeToggle
            maximized={overviewMaximized}
            onClick={() => setOverviewMaximized((m) => !m)}
            matchAdjacent
          />
        </div>
      </div>
      <MaximizableTableSection
        title="Gesamtübersicht"
        maximized={overviewMaximized}
        onMaximizedChange={setOverviewMaximized}
        embeddedToggle
      >
      {!hasValidWeighting && (
        <div
          role="status"
          style={{
            marginBottom: '0.75rem',
            padding: '0.6rem 0.75rem',
            border: '1px solid #fbbf24',
            background: '#fffbeb',
            color: '#92400e',
            borderRadius: '8px',
            fontSize: '0.9rem',
          }}
        >
          Die Gewichtung ist unvollständig oder ungültig. Es werden Fallback-Werte verwendet (Schriftlich 2 : Mündlich 1 : Tests 1), bis die Werte in den Einstellungen korrigiert sind.
        </div>
      )}
      <div className="table-container table-container--opaque-thead">
        <table>
          <thead>
            <tr>
              <th style={{ width: '50px' }}>#</th>
              <th>Name</th>
              <th>Vorname</th>
              <th
                className="text-center"
                style={{ width: '120px' }}
                title={`Klausur-Noten inkl. gehaltener GFS (jede GFS-Note zählt wie eine Klausur im Durchschnitt, Gewicht „Schriftlich“)${gradeSys === 'points' ? ' — Anzeige Notenpunkte 0–15' : ''}`}
              >
                Schriftlich
              </th>
              <th className="text-center" style={{ width: '120px' }} title={`Nur mündliche Bereiche (Gewicht „Mündlich“)${gradeSys === 'points' ? ' — Anzeige Notenpunkte 0–15' : ''}`}>
                Mündlich
              </th>
              {showTests && (
                <th className="text-center" style={{ width: '120px' }} title={gradeSys === 'points' ? 'Anzeige Notenpunkte 0–15' : undefined}>
                  Tests
                </th>
              )}
              <th className="text-center" style={{ width: '120px' }} title={gradeSys === 'points' ? 'Gewichteter Mittelwert — Anzeige Notenpunkte 0–15' : undefined}>
                Endnote (Exakt)
              </th>
              {showHJ1 && (
                <th className="text-center" style={{ width: '120px' }} title={gradeSys === 'points' ? 'Manuell — Note Halbjahr 1 als Notenpunkte 0–15' : 'Manuell eintragbare Note Halbjahr 1'}>
                  Note HJ1
                </th>
              )}
              <th className="text-center" style={{ width: '120px' }} title={gradeSys === 'points' ? 'Manuell — Speicherung als Notenpunkte 0–15' : 'Manuell eintragbare Endnote (z. B. 4,25)'}>
                Endnote
              </th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr>
                <td colSpan={colCount} className="text-center text-muted" style={{ padding: '2rem' }}>
                  Keine Schüler angelegt. Wechsle in die Einstellungen.
                </td>
              </tr>
            )}
            {students.length > 0 && displayStudents.length === 0 && (
              <tr>
                <td colSpan={colCount} className="text-center text-muted" style={{ padding: '2rem' }}>
                  Kein Schüler entspricht der Suche.
                </td>
              </tr>
            )}
            {displayStudents.map((s, idx) => {
              const { examAvg, oralAvg, testAvg, finalGrade, valuesAreNotenpunkte } = calculateStudentGrades(
                s.id,
                exams,
                orals,
                tests,
                weighting,
                null,
                gfsEntries,
                customGradingKeys,
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
              const calcOpts = calculatedGradeDisplayOpts(valuesAreNotenpunkte, gradeSys);
              const manualEndNum = storedGradeStringToClassic(s.summaryEndNote, gradeSys);
              const isExpanded = expandedStudentId === s.id;
              const pendingGfs = showGfs && studentHasPendingLeistung(gfsEntries, s.id);
              const pendingReferat = showReferate && studentHasPendingLeistung(referatEntries, s.id);
              
              return (
                <React.Fragment key={s.id}>
                  <tr 
                    style={{ cursor: 'pointer', transition: 'background 0.2s', background: isExpanded ? 'rgba(79, 70, 229, 0.05)' : '' }}
                    onClick={() => toggleRow(s.id)}
                    title="Klicken für Details"
                  >
                    <td style={{ position: 'relative', verticalAlign: 'middle' }}>
                      {(pendingGfs || pendingReferat) && (
                        <span
                          className="summary-leistung-flags"
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: 2,
                            zIndex: 5,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            lineHeight: 0,
                          }}
                        >
                          {pendingGfs && (
                            <SummaryLeistungFlag
                              label="GFS noch nicht gehalten"
                              title="GFS noch nicht gehalten"
                              onClick={() => onOpenGfs?.(s.id)}
                            />
                          )}
                          {pendingReferat && (
                            <SummaryLeistungFlag
                              label="Referat noch nicht gehalten"
                              title="Referat noch nicht gehalten"
                              onClick={() => onOpenReferate?.(s.id)}
                            />
                          )}
                        </span>
                      )}
                      {hasSummaryNotes(s) && (
                        <span
                          role="img"
                          aria-label="Notiz vorhanden"
                          title="Notiz vorhanden"
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            zIndex: 5,
                            lineHeight: 0,
                            pointerEvents: 'none',
                          }}
                        >
                          <SummaryNotesBookmark />
                        </span>
                      )}
                      <span
                        style={{
                          display: 'block',
                          textAlign: 'center',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {s.studentNumber ?? idx + 1}
                      </span>
                    </td>
                    <td>{s.lastName}</td>
                    <td>{s.firstName}</td>
                    <td className="text-center" style={{ background: getGradeCellBackground(examAvg, gradeSys, calcOpts) }}>
                      <span style={{ color: isGradeWorseThan4(examAvg, gradeSys, calcOpts) ? 'var(--danger)' : (getGradeTextColor(examAvg, gradeSys, calcOpts) || 'var(--foreground)') }}>{gfmtOverview(examAvg, valuesAreNotenpunkte)}</span>
                    </td>
                    <td className="text-center" style={{ background: getGradeCellBackground(oralAvg, gradeSys, calcOpts) }}>
                      <span style={{ color: isGradeWorseThan4(oralAvg, gradeSys, calcOpts) ? 'var(--danger)' : (getGradeTextColor(oralAvg, gradeSys, calcOpts) || 'var(--foreground)') }}>{gfmtOverview(oralAvg, valuesAreNotenpunkte)}</span>
                    </td>
                    {showTests && (
                      <td className="text-center" style={{ background: getGradeCellBackground(testAvg, gradeSys, calcOpts) }}>
                        <span style={{ color: isGradeWorseThan4(testAvg, gradeSys, calcOpts) ? 'var(--danger)' : (getGradeTextColor(testAvg, gradeSys, calcOpts) || 'var(--foreground)') }}>{gfmtCalc(testAvg, valuesAreNotenpunkte)}</span>
                      </td>
                    )}
                    <td
                      className="text-center"
                      style={{
                        background: getGradeCellBackground(finalGrade, gradeSys, calcOpts) ?? (document.documentElement.getAttribute('data-theme') === 'dark' ? 'var(--surface)' : '#f8fafc'),
                        fontWeight: 'bold',
                      }}
                    >
                       <span style={{ color: isGradeWorseThan4(finalGrade, gradeSys, calcOpts) ? 'var(--danger)' : (getGradeTextColor(finalGrade, gradeSys, calcOpts) || 'var(--foreground)') }}>
                         {gfmtOverview(finalGrade, valuesAreNotenpunkte)}
                       </span>
                    </td>
                    {showHJ1 && (() => {
                      const hj1Num = storedGradeStringToClassic(s.summaryHJ1Note, gradeSys);
                      return (
                        <td
                          className="text-center"
                          style={{
                            background: hj1Num !== null ? getGradeCellBackground(hj1Num, gradeSys) : undefined,
                            color: hj1Num !== null ? getGradeTextColor(hj1Num, gradeSys) : undefined,
                            verticalAlign: 'middle',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SummaryGradeInputCell student={s} field="summaryHJ1Note" updateStudentConfig={updateStudentConfig} gradeSystem={gradeSys} label="Note HJ1" />
                        </td>
                      );
                    })()}
                    <td
                      className="text-center"
                      style={{
                        background: manualEndNum !== null ? getGradeCellBackground(manualEndNum, gradeSys) : undefined,
                        color: manualEndNum !== null ? getGradeTextColor(manualEndNum, gradeSys) : undefined,
                        verticalAlign: 'middle',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SummaryGradeInputCell student={s} field="summaryEndNote" updateStudentConfig={updateStudentConfig} gradeSystem={gradeSys} label="Endnote" />
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr style={{ background: 'rgba(15, 23, 42, 0.015)' }}>
                      <td colSpan={colCount} style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
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
                          referatWrittenPercent={config?.referatWrittenPercent ?? 100}
                          referatCountsAsPartialOral={referatCountsAsPartialOral}
                          referatOralPercent={config?.referatOralPercent ?? 100}
                          referatCountsAsFinalPercent={referatCountsAsFinalPercent}
                          referatFinalPercent={config?.referatFinalPercent ?? 100}
                          showGfs={showGfs}
                          showReferate={showReferate}
                          weighting={weighting}
                          customGradingKeys={customGradingKeys}
                          gradeSys={gradeSys}
                          testsWritten={config.testsWritten !== false}
                          testsAsHalfExam={testsAsHalfExam}
                          testsAsOral={testsAsOral}
                          kursstufe={isKursstufe}
                        />
                        {hasSummaryNotes(s) && (
                          <div
                            style={{
                              marginTop: '1rem',
                              padding: '0.75rem 1rem',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              background: 'hsl(var(--muted) / 0.15)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  textTransform: 'uppercase',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                Notiz
                              </span>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="tab secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNotesModalStudent(s);
                                  }}
                                  title="Notiz bearbeiten"
                                  aria-label={`Notiz bearbeiten: ${s.lastName}, ${s.firstName}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '1.65rem',
                                    height: '1.65rem',
                                    minWidth: '1.65rem',
                                    padding: 0,
                                  }}
                                >
                                  <Wrench size={16} strokeWidth={2.25} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className="danger secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStudentConfig(s.id, 'summaryNotes', '');
                                  }}
                                  title="Notiz löschen"
                                  aria-label={`Notiz löschen: ${s.lastName}, ${s.firstName}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '1.65rem',
                                    height: '1.65rem',
                                    minWidth: '1.65rem',
                                    padding: 0,
                                  }}
                                >
                                  <Trash2 size={16} strokeWidth={2.25} aria-hidden />
                                </button>
                              </div>
                            </div>
                            <p
                              style={{
                                margin: '0.5rem 0 0',
                                fontSize: '0.875rem',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                color: 'var(--foreground)',
                              }}
                            >
                              {String(s.summaryNotes ?? '').trim()}
                            </p>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                          {!hasSummaryNotes(s) && (
                            <button
                              type="button"
                              className="tab secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNotesModalStudent(s);
                              }}
                              title="Notiz für diesen Schüler erfassen"
                            >
                              Notizen hinzufügen
                            </button>
                          )}
                          <button
                            type="button"
                            className="tab secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCalculationStudent(s);
                            }}
                            title="Konkrete Berechnung der Endnote mit eingesetzten Zahlen"
                          >
                            Berechnung
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </MaximizableTableSection>

      <SummaryFormulaModal
        open={formulaModalOpen}
        onClose={() => setFormulaModalOpen(false)}
        config={config}
        projects={projects}
        gradeSys={gradeSys}
        exams={exams}
        tests={tests}
      />
      <SummaryStudentCalculationModal
        open={calculationStudent !== null}
        onClose={() => setCalculationStudent(null)}
        student={calculationStudent}
        config={config}
        exams={exams}
        orals={orals}
        tests={tests}
        projects={projects}
        gfsEntries={gfsEntries}
        referatEntries={gradingReferatEntries}
        oralReferatEntries={gradingOralReferatEntries}
        partialWrittenReferatEntries={gradingPartialWrittenReferatEntries}
        referatWrittenUnitWeight={referatWrittenUnitWeight}
        partialOralReferatEntries={gradingPartialOralReferatEntries}
        referatOralUnitWeight={referatOralUnitWeight}
        finalPercentReferatEntries={gradingFinalPercentReferatEntries}
        referatFinalPercent={referatFinalPercent}
        customGradingKeys={customGradingKeys}
        gradeSys={gradeSys}
      />
      <StudentSummaryNotesModal
        open={notesModalStudent !== null}
        onClose={() => setNotesModalStudent(null)}
        student={notesModalStudent}
        initialText={notesModalStudent?.summaryNotes ?? ''}
        onSave={(text) => {
          if (!notesModalStudent) return;
          updateStudentConfig(notesModalStudent.id, 'summaryNotes', text);
        }}
      />
    </div>
  );
}
