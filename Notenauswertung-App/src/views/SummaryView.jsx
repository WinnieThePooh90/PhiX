import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import {
  calculateStudentGrades,
  getStudentGradeCalculationBreakdown,
  formatGrade,
  isGradeWorseThan4,
  getGradeCellBackground,
  getGradeTextColor,
  getExamGradeForStudent,
  getTestGradeForStudent,
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  getNormalizedOralGrade,
  getNormalizedTestScore,
  getCustomKeyDefinition,
  getProjectGradeForStudent,
  getProjectScoreKeyForStudent,
  getStudentEffectiveProjectFieldCount,
  storedGradeStringToClassic,
  normalizeCourseGradeSystem,
} from '../utils/calculator';
import MaximizableTableSection, { TableMaximizeToggle } from '../components/MaximizableTableSection';

function isProjectScoreCounted(project, studentId) {
  if (!project?.active) return false;
  const scoreKey = getProjectScoreKeyForStudent(project, studentId);
  if (scoreKey == null) return false;
  const raw = project.scores?.[scoreKey];
  if (raw && typeof raw === 'object' && raw._counted === false) return false;
  const { counted } = getNormalizedExamScore(raw, getStudentEffectiveProjectFieldCount(project, studentId));
  return counted;
}

function filterProjectsForSummary(projects, weightingMode, halbjahrFilter) {
  return Object.entries(projects || {})
    .filter(([_, p]) => p.active && (p.weightingMode || 'written') === weightingMode && (!halbjahrFilter || p.halbjahr === halbjahrFilter))
    .sort(([a], [b]) => Number(a) - Number(b));
}

function renderProjectListItems(projectEntries, studentId, customGradingKeys, gradeSys, gfmt, showPercent = false) {
  return projectEntries.map(([id, p]) => {
    const counted = isProjectScoreCounted(p, studentId);
    const gr = getProjectGradeForStudent(p, studentId, customGradingKeys, gradeSys);
    const pct =
      showPercent && Number.isFinite(Number(p.weightPercent)) && Number(p.weightPercent) > 0
        ? ` (${p.weightPercent}%)`
        : '';
    const label = `${p.name || `Projekt ${id}`}${pct}`;
    return (
      <li key={`proj-${id}`} className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
        <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>{label}:</span>
        <strong style={{ color: !counted ? 'var(--text-muted)' : (isGradeWorseThan4(gr) ? 'var(--danger)' : 'var(--foreground)') }}>
          {counted && gr !== null ? gfmt(gr) : '-'}
        </strong>
      </li>
    );
  });
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

function SummaryFormulaModal({ open, onClose, config, projects, gradeSys }) {
  if (!open) return null;

  const weights = resolveSummaryWeighting(config?.weighting);
  const testsWritten = config?.testsWritten !== false;
  const percentProjects = getActivePercentProjects(projects);
  const totalPercent = percentProjects.reduce((s, p) => s + p.percent, 0);
  const remainingFactor = Math.max(0, (100 - totalPercent) / 100);
  const wSum = weights.written + weights.oral + (testsWritten ? weights.tests : 0);

  const weightLine = testsWritten
    ? <>Gewichte (Einstellungen): <strong>w<sub>S</sub> = {weights.written}</strong>, <strong>w<sub>M</sub> = {weights.oral}</strong>, <strong>w<sub>T</sub> = {weights.tests}</strong></>
    : <>Gewichte (Einstellungen): <strong>w<sub>S</sub> = {weights.written}</strong>, <strong>w<sub>M</sub> = {weights.oral}</strong></>;

  const standardClassicNumerator = testsWritten
    ? <>w<sub>S</sub>·S + w<sub>M</sub>·M + w<sub>T</sub>·T</>
    : <>w<sub>S</sub>·S + w<sub>M</sub>·M</>;

  const standardClassicDenom = testsWritten
    ? <>w<sub>S</sub> + w<sub>M</sub> + w<sub>T</sub></>
    : <>w<sub>S</sub> + w<sub>M</sub></>;

  const standardNpNumerator = testsWritten
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
              (jede GFS zählt wie eine Klausur) und aktiver Projekte mit Gewichtung „zu schriftlich“.
            </li>
            <li style={{ marginBottom: '0.45rem' }}>
              <strong>M</strong> (Mündlich): arithmetisches Mittel aller aktiven mündlichen Bereiche und Projekte mit Gewichtung „zu mündlich“.
            </li>
            {testsWritten && (
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
                    {testsWritten ? ` + ${weights.tests}·NP(T)` : ''}) / {wSum}
                    {percentProjects.map((p) => ` + ${p.percent}%·NP(g${p.id})`).join('')})
                  </>
                ) : (
                  <>
                    NP<sub>end</sub> = round(({weights.written}·NP(S) + {weights.oral}·NP(M)
                    {testsWritten ? ` + ${weights.tests}·NP(T)` : ''}) / {wSum})
                  </>
                )
              ) : percentProjects.length > 0 ? (
                <>
                  Endnote = {remainingFactor.toLocaleString('de-DE', { maximumFractionDigits: 4 })} · ({weights.written}·S + {weights.oral}·M
                  {testsWritten ? ` + ${weights.tests}·T` : ''}) / {wSum}
                  {percentProjects.map((p) => ` + ${(p.percent / 100).toLocaleString('de-DE', { maximumFractionDigits: 4 })}·g${p.id}`).join('')}
                </>
              ) : (
                <>
                  Endnote = ({weights.written}·S + {weights.oral}·M
                  {testsWritten ? ` + ${weights.tests}·T` : ''}) / {wSum}
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
  const breakdown = getStudentGradeCalculationBreakdown(
    student.id,
    exams,
    orals,
    tests,
    config?.weighting,
    halbjahrFilter,
    gfsEntries,
    customGradingKeys,
    gradeSys,
    config?.testsWritten !== false,
    projects,
  );
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
              <span style={{ color: isGradeWorseThan4(breakdown.finalGrade) ? 'var(--danger)' : 'var(--primary)' }}>
                {gfmt(breakdown.finalGrade)}
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

  return (
    <input
      type="text"
      inputMode={gradeSystem === 'points' ? 'numeric' : 'decimal'}
      aria-label={`${label} für ${student.firstName} ${student.lastName}`}
      value={draft}
      placeholder={gradeSystem === 'points' ? '0–15' : '—'}
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
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      style={{
        width: '5.25rem',
        padding: '0.35rem 0.4rem',
        textAlign: 'center',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        background: 'var(--background)',
        color: manualNum !== null && isGradeWorseThan4(manualNum) ? 'var(--danger)' : 'var(--foreground)',
        fontWeight: 600,
      }}
    />
  );
}

export default function SummaryView({ studentIdFilterSet = null, onOpenAnalysis }) {
  const { students, exams, orals, tests, projects, gfsEntries, config, setConfig, updateStudentConfig } = useData();

  const displayStudents = useMemo(() => {
    if (studentIdFilterSet == null) return students;
    return students.filter((s) => studentIdFilterSet.has(s.id));
  }, [students, studentIdFilterSet]);

  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [calculationStudent, setCalculationStudent] = useState(null);
  const [overviewMaximized, setOverviewMaximized] = useState(false);
  const showHJ1 = config?.summaryShowHJ1 !== false;
  const showTests = config?.testsWritten !== false;
  const weighting = config?.weighting;
  const customGradingKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const hasValidWeighting =
    Number.isFinite(Number(weighting?.written)) &&
    Number.isFinite(Number(weighting?.oral)) &&
    Number.isFinite(Number(weighting?.tests));
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const gfmt = (g) => formatGrade(g, gradeSys);
  const npSuffix = gradeSys === 'points' ? ' (NP)' : '';

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
        <div className="course-meta-field">
          <span className="course-meta-field__label">Halbjahresnote anzeigen</span>
          <div className="course-meta-field__row">
            <label className="switch" title="Spalte &#x201E;Note HJ1&#x201C; ein-/ausblenden">
              <input
                type="checkbox"
                checked={showHJ1}
                onChange={(e) => setConfig((c) => ({ ...c, summaryShowHJ1: e.target.checked }))}
              />
              <span className="slider" />
            </label>
          </div>
        </div>
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
      <div className="table-container">
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
                Schriftlich{npSuffix}
              </th>
              <th className="text-center" style={{ width: '120px' }} title={`Nur mündliche Bereiche (Gewicht „Mündlich“)${gradeSys === 'points' ? ' — Anzeige Notenpunkte 0–15' : ''}`}>
                Mündlich{npSuffix}
              </th>
              {showTests && (
                <th className="text-center" style={{ width: '120px' }} title={gradeSys === 'points' ? 'Anzeige Notenpunkte 0–15' : undefined}>
                  Tests{npSuffix}
                </th>
              )}
              <th className="text-center" style={{ width: '120px' }} title={gradeSys === 'points' ? 'Gewichteter Mittelwert — Anzeige Notenpunkte 0–15' : undefined}>
                Endnote (Exakt){npSuffix}
              </th>
              {showHJ1 && (
                <th className="text-center" style={{ width: '120px' }} title={gradeSys === 'points' ? 'Manuell — Note Halbjahr 1 als Notenpunkte 0–15' : 'Manuell eintragbare Note Halbjahr 1'}>
                  Note HJ1{npSuffix}
                </th>
              )}
              <th className="text-center" style={{ width: '120px' }} title={gradeSys === 'points' ? 'Manuell — Speicherung als Notenpunkte 0–15' : 'Manuell eintragbare Endnote (z. B. 4,25)'}>
                Endnote{npSuffix}
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
              const { examAvg, oralAvg, testAvg, finalGrade } = calculateStudentGrades(
                s.id,
                exams,
                orals,
                tests,
                config.weighting,
                null,
                gfsEntries,
                customGradingKeys,
                gradeSys,
                config.testsWritten !== false,
                projects,
              );
              const manualEndNum = storedGradeStringToClassic(s.summaryEndNote, gradeSys);
              const isExpanded = expandedStudentId === s.id;
              
              return (
                <React.Fragment key={s.id}>
                  <tr 
                    style={{ cursor: 'pointer', transition: 'background 0.2s', background: isExpanded ? 'rgba(79, 70, 229, 0.05)' : '' }}
                    onClick={() => toggleRow(s.id)}
                    title="Klicken für Details"
                  >
                    <td>{s.studentNumber ?? (idx + 1)}</td>
                    <td>{s.lastName}</td>
                    <td>{s.firstName}</td>
                    <td className="text-center" style={{ background: getGradeCellBackground(examAvg) }}>
                      <span style={{ color: isGradeWorseThan4(examAvg) ? 'var(--danger)' : (getGradeTextColor(examAvg) || 'var(--foreground)') }}>{gfmt(examAvg)}</span>
                    </td>
                    <td className="text-center" style={{ background: getGradeCellBackground(oralAvg) }}>
                      <span style={{ color: isGradeWorseThan4(oralAvg) ? 'var(--danger)' : (getGradeTextColor(oralAvg) || 'var(--foreground)') }}>{gfmt(oralAvg)}</span>
                    </td>
                    {showTests && (
                      <td className="text-center" style={{ background: getGradeCellBackground(testAvg) }}>
                        <span style={{ color: isGradeWorseThan4(testAvg) ? 'var(--danger)' : (getGradeTextColor(testAvg) || 'var(--foreground)') }}>{gfmt(testAvg)}</span>
                      </td>
                    )}
                    <td
                      className="text-center"
                      style={{
                        background: getGradeCellBackground(finalGrade) ?? (document.documentElement.getAttribute('data-theme') === 'dark' ? 'var(--surface)' : '#f8fafc'),
                        fontWeight: 'bold',
                      }}
                    >
                       <span style={{ color: isGradeWorseThan4(finalGrade) ? 'var(--danger)' : (getGradeTextColor(finalGrade) || 'var(--foreground)') }}>
                         {gfmt(finalGrade)}
                       </span>
                    </td>
                    {showHJ1 && (() => {
                      const hj1Num = storedGradeStringToClassic(s.summaryHJ1Note, gradeSys);
                      return (
                        <td
                          className="text-center"
                          style={{
                            background: hj1Num !== null ? getGradeCellBackground(hj1Num) : undefined,
                            color: hj1Num !== null ? getGradeTextColor(hj1Num) : undefined,
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
                        background: manualEndNum !== null ? getGradeCellBackground(manualEndNum) : undefined,
                        color: manualEndNum !== null ? getGradeTextColor(manualEndNum) : undefined,
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
                        <div className="grid-3 gap-6" style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          {[
                            { label: 'Halbjahr 1', filter: '1' },
                            { label: 'Halbjahr 2', filter: '2' },
                            { label: 'Gesamt (Durchschnitt)', filter: null }
                          ].map((cat, catIdx) => {
                            const { examAvg, oralAvg, testAvg, finalGrade } = calculateStudentGrades(
                              s.id,
                              exams,
                              orals,
                              tests,
                              config.weighting,
                              cat.filter,
                              gfsEntries,
                              customGradingKeys,
                              gradeSys,
                              config.testsWritten !== false,
                              projects,
                            );
                            const rounded = finalGrade !== null ? Math.round(finalGrade) : null;
                            const writtenProjects = filterProjectsForSummary(projects, 'written', cat.filter);
                            const oralProjects = filterProjectsForSummary(projects, 'oral', cat.filter);
                            const percentProjects = filterProjectsForSummary(projects, 'percent', cat.filter);

                            return (
                              <div key={catIdx} style={{ borderRight: catIdx < 2 ? '1px solid var(--border)' : 'none', paddingRight: catIdx < 2 ? '1.5rem' : 0 }}>
                                <div style={{ marginBottom: '1.25rem', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem' }}>
                                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{cat.label}</h3>
                                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', marginTop: '0.25rem' }}>
                                    <span style={{ color: isGradeWorseThan4(finalGrade) ? 'var(--danger)' : 'var(--foreground)' }}>{gfmt(finalGrade)}</span>
                                    {' '}
                                    <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: rounded !== null && isGradeWorseThan4(rounded) ? 'var(--danger)' : 'var(--text-muted)' }}>({rounded !== null ? gfmt(rounded) : '-'})</span>
                                  </div>
                                </div>

                                <div className="mb-4">
                                  <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Schriftlich ({gfmt(examAvg)})
                                  </h4>
                                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {Object.entries(exams).filter(([_, e]) => e.active && (!cat.filter || e.halbjahr === cat.filter)).map(([id, e]) => {
                                      const { counted } = getNormalizedExamScore(
                                        e.scores?.[s.id],
                                        getStudentEffectiveExamFieldCount(e, s.id),
                                      );
                                      const gr = getExamGradeForStudent(e, s.id, customGradingKeys);
                                      return (
                                        <li key={id} className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                          <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>KA {id}:</span>
                                          <strong style={{ color: !counted ? 'var(--text-muted)' : (isGradeWorseThan4(gr) ? 'var(--danger)' : 'var(--foreground)') }}>{counted && gr !== null ? gfmt(gr) : '-'}</strong>
                                        </li>
                                      );
                                    })}
                                    {gfsEntries
                                      .filter((e) => e.studentId === s.id && (!cat.filter || e.halbjahr === cat.filter))
                                      .map((e) => {
                                        const label = [e.thema, e.art].filter(Boolean).join(' · ') || 'GFS';
                                        const gNum = storedGradeStringToClassic(e.note, gradeSys);
                                        const counted = e.gehalten === true && gNum !== null;
                                        return (
                                          <li key={`gfs-${e.id}`} className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                            <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>GFS {label}:</span>
                                            <strong style={{ color: !counted ? 'var(--text-muted)' : (isGradeWorseThan4(gNum) ? 'var(--danger)' : 'var(--foreground)') }}>{counted ? gfmt(gNum) : '-'}</strong>
                                          </li>
                                        );
                                      })}
                                    {renderProjectListItems(writtenProjects, s.id, customGradingKeys, gradeSys, gfmt)}
                                  </ul>
                                </div>

                                <div className="mb-4">
                                  <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Mündlich ({gfmt(oralAvg)})
                                  </h4>
                                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {Object.entries(orals).filter(([_, o]) => o.active !== false && (!cat.filter || o.halbjahr === cat.filter)).map(([id, o]) => {
                                      const { value, counted } = getNormalizedOralGrade(o.grades[s.id]);
                                      const oralG = counted && value ? storedGradeStringToClassic(String(value), gradeSys) : null;
                                      return (
                                        <li key={id} className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                          <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>{o.name}:</span>
                                          <strong style={{ color: !counted ? 'var(--text-muted)' : (oralG !== null && isGradeWorseThan4(oralG) ? 'var(--danger)' : 'var(--foreground)') }}>{counted && oralG !== null ? gfmt(oralG) : '-'}</strong>
                                        </li>
                                      );
                                    })}
                                    {renderProjectListItems(oralProjects, s.id, customGradingKeys, gradeSys, gfmt)}
                                  </ul>
                                </div>

                                {config.testsWritten !== false && (
                                  <div>
                                    <h4
                                      style={{
                                        color: 'var(--text-main)',
                                        marginBottom: '0.5rem',
                                        fontSize: '0.9rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                      }}
                                    >
                                      Tests ({gfmt(testAvg)})
                                    </h4>
                                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                      {Object.entries(tests)
                                        .filter(([_, t]) => t.active && (!cat.filter || t.halbjahr === cat.filter))
                                        .map(([id, t]) => {
                                          const sm = t.scores ?? t.errors;
                                          const { counted } = getNormalizedTestScore(sm?.[s.id]);
                                          const gr = counted ? getTestGradeForStudent(t, s.id, customGradingKeys, gradeSys) : null;
                                          return (
                                            <li key={id} className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                              <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>{t.name}:</span>
                                              <strong style={{ color: !counted ? 'var(--text-muted)' : (isGradeWorseThan4(gr) ? 'var(--danger)' : 'var(--foreground)') }}>
                                                {counted && gr !== null ? gfmt(gr) : '-'}
                                              </strong>
                                            </li>
                                          );
                                        })}
                                    </ul>
                                  </div>
                                )}

                                {percentProjects.length > 0 && (
                                  <div>
                                    <h4
                                      style={{
                                        color: 'var(--text-main)',
                                        marginBottom: '0.5rem',
                                        fontSize: '0.9rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        marginTop: config.testsWritten !== false ? '1rem' : 0,
                                      }}
                                    >
                                      Projekte (prozentual)
                                    </h4>
                                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                      {renderProjectListItems(percentProjects, s.id, customGradingKeys, gradeSys, gfmt, true)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
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
        customGradingKeys={customGradingKeys}
        gradeSys={gradeSys}
      />
    </div>
  );
}
