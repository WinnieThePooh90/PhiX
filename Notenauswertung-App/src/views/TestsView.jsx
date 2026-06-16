import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import { ABI_BAWUE_2026_120_BE_KEY, isAbiBaWue2026KeyFamilyId, LEGACY_BUILTIN_ABI_KEY_TYPE } from '../data/kmBwAbiPhysik2026GradingKey';
import { isAbiBaWue2026Mathematik100BeFamilyId } from '../data/abiBaWu2026Mathematik100BeGradingKey';
import { buildVorlage1Bands, isVorlage1KeyFamilyId } from '../data/vorlage1GradingKey';
import {
  getBuiltinGradingKeyTitle,
  getBuiltinGradingKeyShortDesc,
  getFormulaKeyHelpText,
  getPlateauKeyShortDesc,
  isPlateauGradingKeyType,
} from '../data/gradingKeyDisplay';
import {
  formatGrade,
  computeTestClassAverage,
  formatExamClassAverageDisplay,
  isGradeWorseThan4,
  getGradeCellBackground,
  getGradeTextColor,
  getNormalizedTestScore,
  normalizeCourseGradeSystem,
  getCustomKeyDefinition,
  getTestGradeForStudent,
  getEffectiveTestMaxPoints,
  isExamManualGradeActive,
  getExamManualGradeStoredValue,
  classicGradeToStoredString,
} from '../utils/calculator';
import { abiTemplateSimulatedMaxMismatchTooltip } from '../utils/abiTemplateSimulatedMaxWarning';
import GradingKeyTable from '../components/GradingKeyTable';
import MaximizableTableSection, { TableMaximizeToggle } from '../components/MaximizableTableSection';
import ExamChartsPanels from '../components/ExamChartsPanels';
import {
  createScoreTaskTabHandler,
  focusScoreTaskInput,
  scoreTaskInputDataAttr,
} from '../utils/scoreTaskTabNavigation';

const TEST_INDEX_COL_PX = 52;
const TEST_DETAIL_COL_SPAN = 5;

function isTestPointsOutOfRange(rawValue, maxPts) {
  if (rawValue === '' || rawValue === undefined || rawValue === null) return false;
  const n = parseFloat(String(rawValue).replace(',', '.'));
  if (!Number.isFinite(n)) return false;
  if (n < 0) return true;
  const max = Number(maxPts);
  if (!Number.isFinite(max) || max <= 0) return false;
  return n > max;
}

/** variant: 'nach' = Nachschreiber (gelb), 'absent' = nicht teilgenommen / „Teilgenommen“ aus (rot) — wie Klausuren */
function TestRowBookmark({ variant }) {
  const absent = variant === 'absent';
  return (
    <svg
      width="9"
      height="12"
      viewBox="0 0 10 14"
      aria-hidden
      style={{
        display: 'block',
        filter: absent
          ? 'drop-shadow(0 1px 1px rgba(185, 28, 28, 0.35))'
          : 'drop-shadow(0 1px 1px rgba(202, 138, 4, 0.35))',
      }}
    >
      <path
        d="M1.25 1C1.25 0.72 1.47 0.5 1.75 0.5H8.25C8.53 0.5 8.75 0.72 8.75 1V9.35L5 12.15L1.25 9.35V1Z"
        fill={absent ? '#fee2e2' : '#fef9c3'}
        stroke={absent ? '#dc2626' : '#ca8a04'}
        strokeWidth="0.65"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TestsView({ studentIdFilterSet = null }) {
  const {
    tests,
    updateTestScore,
    updateTestCounted,
    updateTestStudentNachschreiber,
    updateTestNachschreiberMaxPoints,
    updateTestStudentManualGrade,
    updateTestStudentManualGradeValue,
    updateTest,
    students,
    addTest,
    config,
  } = useData();

  const displayStudents = useMemo(() => {
    if (studentIdFilterSet == null) return students;
    return students.filter((s) => studentIdFilterSet.has(s.id));
  }, [students, studentIdFilterSet]);

  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const testNumbers = Object.keys(tests).sort((a, b) => Number(a) - Number(b));
  const [activeTest, setActiveTest] = useState(testNumbers.length > 0 ? testNumbers[0] : null);
  const [showKey, setShowKey] = useState(false);
  const [chartsModalOpen, setChartsModalOpen] = useState(false);
  const [tooltipGrade, setTooltipGrade] = useState(null);
  const [pieTooltip, setPieTooltip] = useState(null);
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [testIndexTooltip, setTestIndexTooltip] = useState(null);
  const [tableMaximized, setTableMaximized] = useState(false);

  const test = tests[activeTest];

  useEffect(() => {
    setChartsModalOpen(false);
    setTooltipGrade(null);
    setPieTooltip(null);
    setShowKey(false);
    setExpandedStudentId(null);
    setTableMaximized(false);
  }, [activeTest]);

  useEffect(() => {
    if (!chartsModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setChartsModalOpen(false);
        setTooltipGrade(null);
        setPieTooltip(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chartsModalOpen]);

  useEffect(() => {
    if (!test?.active) {
      setChartsModalOpen(false);
      setTooltipGrade(null);
      setPieTooltip(null);
    }
  }, [test?.active]);

  useEffect(() => {
    if (!testIndexTooltip) return undefined;
    const hide = () => setTestIndexTooltip(null);
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, { capture: true });
      window.removeEventListener('resize', hide);
    };
  }, [testIndexTooltip]);

  const customKeysList = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const testRowStats = useCallback(
    (studentId) => {
      if (!test) return { counted: false, grade: null, value: '', isManual: false, manualGradeInput: '' };
      const map = test.scores ?? test.errors;
      const raw = map?.[studentId];
      const { value, counted } = getNormalizedTestScore(raw);
      const isManual = isExamManualGradeActive(raw);
      const grade = counted ? getTestGradeForStudent(test, studentId, customKeysList, gradeSys) : null;
      const manualGradeInput = getExamManualGradeStoredValue(raw);
      return { counted, grade, value, isManual, manualGradeInput };
    },
    [test, customKeysList, gradeSys],
  );

  const examStubForCharts = useMemo(() => ({ fieldMaxPoints: {} }), []);

  const testClassAverage = useMemo(
    () => (test ? computeTestClassAverage(test, displayStudents, customKeysList, gradeSys) : null),
    [test, displayStudents, customKeysList, gradeSys],
  );

  useEffect(() => {
    if (testNumbers.length === 0) return;
    if (!tests[activeTest]) {
      setActiveTest(testNumbers[0]);
    }
  }, [testNumbers, activeTest, tests]);

  if (!test) {
    return (
      <div className="text-center mt-8 text-muted">
        Keine Tests vorhanden. Bitte füge einen Test hinzu.
        <br />
        <button
          type="button"
          className="mt-4"
          onClick={async () => {
            const newNum = await addTest();
            if (newNum) setActiveTest(newNum.toString());
          }}
        >
          + Ersten Test anlegen
        </button>
      </div>
    );
  }

  const sidebarCustomDef = getCustomKeyDefinition(customKeysList, test.keyType || '1');
  const maxPtsDisplay = Number.isFinite(parseFloat(test.maxPoints)) && parseFloat(test.maxPoints) > 0 ? parseFloat(test.maxPoints) : 10;
  const scoreInputScope = `test-${activeTest}`;

  const toggleStudentRow = (studentId) => {
    setExpandedStudentId((prev) => (prev === studentId ? null : studentId));
  };

  const handlePointsChange = (studentId, value) => {
    updateTestScore(activeTest, studentId, value);
  };

  const handleMaxPointsChange = (e) => {
    const v = parseFloat(String(e.target.value).replace(',', '.'));
    updateTest(activeTest, 'maxPoints', Number.isFinite(v) && v > 0 ? v : 10);
  };

  return (
    <div className="view-page-scroll">
      <div className="view-toolbar-block tests-toolbar">
        <div className="flex justify-between items-center mb-4 pt-2 view-page-nav">
          <h2 style={{ margin: 0 }}>Tests</h2>
          <div className="flex gap-2" style={{ overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
            {testNumbers.map((num) => (
              <button
                key={num}
                type="button"
                className={`tab ${activeTest === num.toString() ? 'active' : 'secondary'}`}
                onClick={() => setActiveTest(num.toString())}
              >
                Test {num}
              </button>
            ))}
            <button
              type="button"
              className="tab secondary"
              onClick={async () => {
                const newNum = await addTest();
                if (newNum) setActiveTest(newNum.toString());
              }}
              title="Weiteren Test hinzufügen"
              style={{ fontWeight: 'bold' }}
            >
              +
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 course-meta-settings-row">
          <div className="course-meta-field">
            <span className="course-meta-field__label">Aktiv</span>
            <div className="course-meta-field__row">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={test.active}
                  onChange={(e) => updateTest(activeTest, 'active', e.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
          </div>
          {test.active && (
            <>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`test-date-${activeTest}`}>
                  Datum
                </label>
                <input
                  id={`test-date-${activeTest}`}
                  className="course-meta-control"
                  type="date"
                  value={test.date || ''}
                  onChange={(e) => updateTest(activeTest, 'date', e.target.value)}
                />
              </div>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`test-hj-${activeTest}`}>
                  Halbjahr
                </label>
                <select
                  id={`test-hj-${activeTest}`}
                  className="course-meta-control"
                  value={test.halbjahr || '1'}
                  onChange={(e) => updateTest(activeTest, 'halbjahr', e.target.value)}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`test-max-${activeTest}`}>
                  Maximalpunktzahl
                </label>
                <input
                  id={`test-max-${activeTest}`}
                  className="course-meta-control"
                  type="number"
                  min="1"
                  step="0.5"
                  title="Obergrenze für die Summe der erreichbaren Punkte in der Tabelle (wie Klausur-Maximum)."
                  value={maxPtsDisplay}
                  onChange={handleMaxPointsChange}
                  style={{ width: '88px' }}
                />
              </div>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`test-key-${activeTest}`}>
                  Notenschlüssel
                </label>
                <select
                  id={`test-key-${activeTest}`}
                  className="course-meta-control"
                  value={test.keyType || '1'}
                  onChange={(e) => updateTest(activeTest, 'keyType', e.target.value)}
                >
                  <option value="1">Plateau 1</option>
                  <option value="2">Plateau 2</option>
                  <option value="3">Plateau 3</option>
                  <option value="4">Linear 1</option>
                  <option value="5">Linear 2</option>
                  <option value="6">Linear 3</option>
                  {test.keyType === LEGACY_BUILTIN_ABI_KEY_TYPE ? (
                    <option value={LEGACY_BUILTIN_ABI_KEY_TYPE}>ABI BaWü 2026 120 BE</option>
                  ) : null}
                  {customKeysList.map((k) => (
                    <option key={k.id} value={`custom:${k.id}`}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="course-meta-field">
                <span className="course-meta-field__label">Auswertung</span>
                <div className="course-meta-field__row">
                  <button
                    type="button"
                    className="tab secondary course-meta-inline-btn"
                    onClick={() => setChartsModalOpen(true)}
                    title="Auswertungsdiagramme anzeigen"
                  >
                    Analyse
                  </button>
                </div>
              </div>
              <div className="view-toolbar-actions">
                <div className="course-meta-field">
                  <span className="course-meta-field__label">Schlüssel zeigen</span>
                  <div className="course-meta-field__row">
                    <label className="switch">
                      <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} />
                      <span className="slider" />
                    </label>
                  </div>
                </div>
                <TableMaximizeToggle
                  maximized={tableMaximized}
                  onClick={() => setTableMaximized((m) => !m)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {test.active ? (
        <div className={`exams-active-body ${showKey ? 'sidebar-layout' : ''}`}>
          <div className={`exams-main-stack ${showKey ? 'main-content' : ''}`}>
            <div className="exams-body-scroll view-table-scroll exam-table-scroll">
              <MaximizableTableSection
                title={`Test ${activeTest}`}
                maximized={tableMaximized}
                onMaximizedChange={setTableMaximized}
                embeddedToggle
              >
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th
                          className="exam-th-sticky-left exam-th-r1"
                          style={{
                            width: `${TEST_INDEX_COL_PX}px`,
                            minWidth: `${TEST_INDEX_COL_PX}px`,
                            left: 0,
                          }}
                        >
                          #
                        </th>
                        <th
                          className="exam-th-sticky-left exam-th-r1"
                          style={{ left: `${TEST_INDEX_COL_PX}px` }}
                        >
                          NAME
                        </th>
                        <th className="text-center exam-th-r1 test-points-col" style={{ width: '88px', minWidth: '80px' }}>
                          PUNKTE
                        </th>
                        <th
                          className="text-center exam-th-r1 test-gesamt-col"
                          style={{
                            width: '100px',
                            minWidth: '100px',
                            position: 'sticky',
                            right: '100px',
                            top: 'calc(var(--header-height) + 105px)',
                            zIndex: 61,
                            background: 'var(--surface-muted)',
                            borderLeft: '1px solid var(--border)',
                            borderRight: '1px solid var(--border)',
                          }}
                        >
                          GESAMT
                        </th>
                        <th
                          className="text-center exam-th-r1"
                          style={{
                            width: '100px',
                            minWidth: '100px',
                            position: 'sticky',
                            right: 0,
                            top: 'calc(var(--header-height) + 105px)',
                            zIndex: 61,
                            background: 'var(--surface-muted)',
                            borderLeft: '1px solid var(--border)',
                          }}
                        >
                          NOTE
                        </th>
                      </tr>
                      <tr className="exam-thead-max-row" style={{ background: 'var(--bg-color)', fontWeight: 'bold' }}>
                        <th
                          className="exam-th-sticky-left exam-th-r2"
                          style={{ left: 0, textTransform: 'none' }}
                        >
                          Max
                        </th>
                        <th
                          className="exam-th-sticky-left exam-th-r2"
                          style={{ left: `${TEST_INDEX_COL_PX}px`, textTransform: 'none' }}
                        >
                          Maximalpunkte
                        </th>
                        <th className="text-center exam-th-r2" style={{ textTransform: 'none' }} />
                        <th
                          className="text-center exam-th-r2 test-gesamt-col"
                          style={{
                            width: '100px',
                            minWidth: '100px',
                            position: 'sticky',
                            right: '100px',
                            top: 'calc(var(--header-height) + 146px)',
                            zIndex: 61,
                            background: 'var(--surface-muted)',
                            borderLeft: '1px solid var(--border)',
                            borderRight: '1px solid var(--border)',
                            textTransform: 'none',
                          }}
                        >
                          {maxPtsDisplay}
                        </th>
                        <th
                          style={{
                            position: 'sticky',
                            right: 0,
                            top: 'calc(var(--header-height) + 146px)',
                            zIndex: 61,
                            background: 'var(--surface-muted)',
                            borderLeft: '1px solid var(--border)',
                            textTransform: 'none',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                          }}
                        >
                          <span title="Klassenschnitt">Ø</span>
                          {testClassAverage !== null && (
                            <div
                              style={{
                                fontSize: '0.85rem',
                                marginTop: '0.15rem',
                                fontVariantNumeric: 'tabular-nums',
                                color: isGradeWorseThan4(testClassAverage, gradeSys, gradeSys === 'points' ? { inputScale: 'notenpunkte' } : undefined) ? 'var(--danger)' : 'var(--foreground)',
                              }}
                            >
                              {formatExamClassAverageDisplay(testClassAverage, gradeSys)}
                            </div>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayStudents.length === 0 && students.length > 0 && (
                        <tr>
                          <td
                            colSpan={TEST_DETAIL_COL_SPAN}
                            className="text-center text-muted"
                            style={{ padding: '2rem' }}
                          >
                            Kein Schüler entspricht der Suche.
                          </td>
                        </tr>
                      )}
                      {displayStudents.map((s, idx) => {
                        const scoreMap = test.scores ?? test.errors;
                        const rawSc = scoreMap?.[s.id];
                        const {
                          value: pointsStr,
                          counted,
                          grade,
                          isManual,
                          manualGradeInput,
                        } = testRowStats(s.id);
                        const isNach = typeof rawSc === 'object' && rawSc !== null && rawSc._nachschreiber === true;
                        const showAbsentFlag = !counted;
                        const showNachFlag = counted && isNach;
                        const showIndexFlag = showAbsentFlag || showNachFlag;
                        const isExpanded = expandedStudentId === s.id;
                        const effectiveMax = getEffectiveTestMaxPoints(test, rawSc);
                        const pointsOut = isTestPointsOutOfRange(pointsStr, effectiveMax);
                        const ptsNum = parseFloat(String(pointsStr).replace(',', '.'));
                        const gesamtDisplay =
                          pointsStr !== '' && Number.isFinite(ptsNum) ? (
                            <>
                              {ptsNum}
                              <span className="text-muted" style={{ fontWeight: 'normal', fontSize: '0.8rem' }}>
                                {' '}
                                / {effectiveMax}
                              </span>
                            </>
                          ) : (
                            '—'
                          );

                        return (
                          <React.Fragment key={s.id}>
                            <tr
                              style={{
                                transition: 'background 0.2s',
                                background: isExpanded ? 'rgba(79, 70, 229, 0.05)' : '',
                              }}
                            >
                              <td
                                style={{
                                  position: 'sticky',
                                  left: 0,
                                  zIndex: 1,
                                  background: 'var(--surface)',
                                  borderRight: '1px solid var(--border)',
                                  width: `${TEST_INDEX_COL_PX}px`,
                                  minWidth: `${TEST_INDEX_COL_PX}px`,
                                  verticalAlign: 'middle',
                                  textAlign: 'center',
                                  padding: 0,
                                }}
                              >
                                <div
                                  style={{
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: showIndexFlag ? 34 : undefined,
                                    paddingTop: showIndexFlag ? 2 : 0,
                                  }}
                                >
                                  {showIndexFlag && (
                                    <span
                                      className="exam-index-flag"
                                      role="img"
                                      aria-label={showAbsentFlag ? 'Nicht teilgenommen' : 'Nachschreiber'}
                                      onMouseEnter={(e) => {
                                        const r = e.currentTarget.getBoundingClientRect();
                                        const text = showAbsentFlag ? 'Nicht teilgenommen' : 'Nachschreiber';
                                        const pad = 12;
                                        const cx = r.left + r.width / 2;
                                        setTestIndexTooltip({
                                          text,
                                          left: Math.min(window.innerWidth - pad, Math.max(pad, cx)),
                                          top: r.bottom + 8,
                                        });
                                      }}
                                      onMouseLeave={() => setTestIndexTooltip(null)}
                                    >
                                      <TestRowBookmark variant={showAbsentFlag ? 'absent' : 'nach'} />
                                    </span>
                                  )}
                                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</span>
                                </div>
                              </td>
                              <td
                                role="button"
                                tabIndex={-1}
                                onClick={() => toggleStudentRow(s.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleStudentRow(s.id);
                                  }
                                }}
                                style={{
                                  position: 'sticky',
                                  left: `${TEST_INDEX_COL_PX}px`,
                                  zIndex: 1,
                                  background: 'var(--surface)',
                                  borderRight: '1px solid var(--border)',
                                  cursor: 'pointer',
                                }}
                                title="Klicken für Teilnahme / Nachschreiber"
                              >
                                {s.lastName}, {s.firstName}
                              </td>
                              <td className="text-center test-points-col" style={{ verticalAlign: 'middle' }}>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  data-score-task-input={scoreTaskInputDataAttr(scoreInputScope, s.id, 0)}
                                  value={pointsStr === undefined ? '' : pointsStr}
                                  onChange={(e) => handlePointsChange(s.id, e.target.value)}
                                  onKeyDown={createScoreTaskTabHandler({
                                    scopeKey: scoreInputScope,
                                    rowKey: s.id,
                                    fieldIndex: 0,
                                    effectiveFieldCount: 1,
                                    onTabForwardFromLastField: () => {
                                      const rowIdx = displayStudents.findIndex((st) => st.id === s.id);
                                      const nextStudent = displayStudents[rowIdx + 1];
                                      if (nextStudent) {
                                        focusScoreTaskInput(scoreInputScope, nextStudent.id, 0);
                                      }
                                    },
                                    onShiftTabFromFirstField: () => {
                                      const rowIdx = displayStudents.findIndex((st) => st.id === s.id);
                                      const prevStudent = displayStudents[rowIdx - 1];
                                      if (prevStudent) {
                                        focusScoreTaskInput(scoreInputScope, prevStudent.id, 0);
                                      }
                                    },
                                  })}
                                  placeholder="0"
                                  className={pointsOut ? 'exam-score-input--out-of-range' : undefined}
                                  title={
                                    pointsOut
                                      ? 'Wert muss zwischen 0 und der Maximalpunktzahl liegen.'
                                      : undefined
                                  }
                                  style={{ textAlign: 'center', width: '80px', minWidth: 'auto', borderRadius: 0 }}
                                />
                              </td>
                              <td
                                className="text-center test-gesamt-col"
                                style={{
                                  width: '100px',
                                  minWidth: '100px',
                                  position: 'sticky',
                                  right: '100px',
                                  zIndex: 1,
                                  background: 'var(--surface)',
                                  fontWeight: 'bold',
                                  borderLeft: '1px solid var(--border)',
                                  borderRight: '1px solid var(--border)',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {gesamtDisplay}
                              </td>
                              <td
                                className="text-center"
                                style={{
                                  width: '100px',
                                  minWidth: '100px',
                                  position: 'sticky',
                                  right: 0,
                                  zIndex: 1,
                                  background:
                                    counted && grade !== null
                                      ? (getGradeCellBackground(grade, gradeSys) ?? 'var(--surface)')
                                      : 'var(--surface)',
                                  color: counted && grade !== null ? getGradeTextColor(grade, gradeSys) : undefined,
                                  borderLeft: '1px solid var(--border)',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {counted && isManual ? (
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    className="exam-manual-grade-input"
                                    value={manualGradeInput}
                                    onChange={(e) =>
                                      updateTestStudentManualGradeValue(activeTest, s.id, e.target.value)
                                    }
                                    placeholder={gradeSys === 'points' ? 'NP' : 'Note'}
                                    title="Manuelle Note (Berechnung wird ignoriert)"
                                    aria-label={`Manuelle Note für ${s.lastName}, ${s.firstName}`}
                                    style={{
                                      textAlign: 'center',
                                      width: '4.5rem',
                                      minWidth: 'auto',
                                      fontWeight: 'bold',
                                      borderRadius: 0,
                                    }}
                                  />
                                ) : counted && grade !== null ? (
                                  <span
                                    style={{
                                      fontWeight: 'bold',
                                      color: isGradeWorseThan4(grade, gradeSys) ? 'var(--danger)' : 'var(--foreground)',
                                    }}
                                  >
                                    {formatGrade(grade, gradeSys)}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr style={{ background: 'rgba(15, 23, 42, 0.015)' }}>
                                <td
                                  colSpan={TEST_DETAIL_COL_SPAN}
                                  style={{
                                    padding: 0,
                                    borderBottom: '1px solid var(--border)',
                                    verticalAlign: 'middle',
                                  }}
                                >
                                  <div
                                    style={{
                                      position: 'sticky',
                                      left: 0,
                                      zIndex: 4,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.65rem',
                                      flexWrap: 'wrap',
                                      padding: '0.75rem 1rem',
                                      background: 'var(--surface)',
                                      boxShadow: '4px 0 14px rgba(0, 0, 0, 0.08)',
                                    }}
                                  >
                                    <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                                      Teilgenommen:
                                    </span>
                                    <label className="switch switch--table-row" title="In Gesamtergebnis einbeziehen">
                                      <input
                                        type="checkbox"
                                        checked={counted}
                                        onChange={(e) => updateTestCounted(activeTest, s.id, e.target.checked)}
                                        aria-label="Teilnahme am Ergebnis"
                                      />
                                      <span className="slider" />
                                    </label>
                                    <span className="text-muted" style={{ fontSize: '0.875rem', marginLeft: '0.75rem' }}>
                                      Nachschreiber:
                                    </span>
                                    <label className="switch switch--table-row" title="Kennzeichnung wie bei Klausuren">
                                      <input
                                        type="checkbox"
                                        checked={isNach}
                                        onChange={(e) =>
                                          updateTestStudentNachschreiber(activeTest, s.id, e.target.checked)
                                        }
                                        aria-label="Nachschreiber"
                                      />
                                      <span className="slider" />
                                    </label>
                                    {isNach ? (
                                      <>
                                        <span
                                          className="text-muted"
                                          style={{ fontSize: '0.875rem', marginLeft: '0.75rem' }}
                                        >
                                          Max. Punkte (Nachschreiber):
                                        </span>
                                        <input
                                          type="number"
                                          min="1"
                                          step="0.5"
                                          className="course-meta-control"
                                          style={{
                                            width: '84px',
                                            height: 'var(--course-meta-control-height)',
                                            minHeight: 'var(--course-meta-control-height)',
                                            boxSizing: 'border-box',
                                          }}
                                          value={effectiveMax}
                                          onChange={(e) =>
                                            updateTestNachschreiberMaxPoints(activeTest, s.id, e.target.value)
                                          }
                                          title="Nur für diesen Schüler — Note aus erreichte Punkte geteilt durch dieses Maximum und dem gewählten Schlüssel."
                                        />
                                      </>
                                    ) : null}
                                    <span className="text-muted" style={{ fontSize: '0.875rem', marginLeft: '0.75rem' }}>
                                      Manuelle Note:
                                    </span>
                                    <label className="switch switch--table-row" title="Note manuell setzen (Berechnung ignorieren)">
                                      <input
                                        type="checkbox"
                                        checked={isManual}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          if (!checked) {
                                            updateTestStudentManualGrade(activeTest, s.id, false);
                                            return;
                                          }
                                          const stored = getExamManualGradeStoredValue(rawSc);
                                          if (stored.trim() !== '') {
                                            updateTestStudentManualGrade(activeTest, s.id, true);
                                            return;
                                          }
                                          const { grade: calcGrade } = testRowStats(s.id);
                                          const seed =
                                            calcGrade != null ? classicGradeToStoredString(calcGrade, gradeSys) : '';
                                          updateTestStudentManualGrade(activeTest, s.id, true, seed);
                                        }}
                                        aria-label="Manuelle Note"
                                      />
                                      <span className="slider" />
                                    </label>
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
            </div>
          </div>
          {showKey && (
            <div className="sidebar exams-key-sidebar">
              <GradingKeyTable
                type={sidebarCustomDef ? '1' : test.keyType || '1'}
                maxPoints={maxPtsDisplay}
                title={
                  sidebarCustomDef
                    ? sidebarCustomDef.name
                    : getBuiltinGradingKeyTitle(test.keyType) || 'Aktueller Schlüssel'
                }
                desc={
                  sidebarCustomDef
                    ? (isVorlage1KeyFamilyId(sidebarCustomDef.id)
                        ? getPlateauKeyShortDesc('1', maxPtsDisplay)
                        : sidebarCustomDef.name)
                    : test.keyType === 'abi'
                      ? 'ABI BaWü 2026 120 BE'
                      : getBuiltinGradingKeyShortDesc(test.keyType, maxPtsDisplay) || `Schlüssel ${test.keyType || '1'}`
                }
                titleHelpText={
                  sidebarCustomDef
                    ? (isVorlage1KeyFamilyId(sidebarCustomDef.id) ? getFormulaKeyHelpText('1') : null)
                    : (isPlateauGradingKeyType(test.keyType) ? getFormulaKeyHelpText(test.keyType) : null)
                }
                customBands={
                  sidebarCustomDef
                    ? (isVorlage1KeyFamilyId(sidebarCustomDef.id)
                        ? buildVorlage1Bands(maxPtsDisplay)
                        : sidebarCustomDef.bands)
                    : (test.keyType === 'abi' ? ABI_BAWUE_2026_120_BE_KEY.bands : undefined)
                }
                pktIntegerDisplay={
                  !!sidebarCustomDef?.pktIntegerDisplay ||
                  test.keyType === 'abi' ||
                  (sidebarCustomDef?.id &&
                    (isAbiBaWue2026KeyFamilyId(sidebarCustomDef.id) ||
                      isAbiBaWue2026Mathematik100BeFamilyId(sidebarCustomDef.id)))
                }
                titleWarningTooltip={abiTemplateSimulatedMaxMismatchTooltip(sidebarCustomDef?.id, maxPtsDisplay)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="text-muted mt-8" style={{ textAlign: 'center' }}>
          Test {activeTest} ist derzeit deaktiviert. Aktiviere den Test, um Punkte einzutragen.
        </div>
      )}

      {chartsModalOpen && test.active
        ? createPortal(
            <div
              className="exam-charts-modal-backdrop"
              role="presentation"
              onClick={() => {
                setChartsModalOpen(false);
                setTooltipGrade(null);
                setPieTooltip(null);
              }}
            >
              <div
                className="exam-charts-modal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="test-charts-modal-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="exam-charts-modal-header">
                  <h2 id="test-charts-modal-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                    Analyse · Test {activeTest}
                  </h2>
                  <button
                    type="button"
                    className="tab secondary"
                    onClick={() => {
                      setChartsModalOpen(false);
                      setTooltipGrade(null);
                      setPieTooltip(null);
                    }}
                  >
                    Schließen
                  </button>
                </div>
                <div className="exam-charts-modal-body exam-charts-modal-body--charts">
                  <ExamChartsPanels
                    students={displayStudents}
                    exam={examStubForCharts}
                    examRowStats={testRowStats}
                    tooltipGrade={tooltipGrade}
                    setTooltipGrade={setTooltipGrade}
                    pieTooltip={pieTooltip}
                    setPieTooltip={setPieTooltip}
                    displayFieldCount={0}
                    gradeSystem={gradeSys}
                    showTaskAnalysis={false}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {testIndexTooltip
        ? createPortal(
            <div
              className="exam-index-tooltip-portal"
              role="tooltip"
              style={{
                position: 'fixed',
                left: testIndexTooltip.left,
                top: testIndexTooltip.top,
                transform: 'translate(-50%, 0)',
                zIndex: 10050,
              }}
            >
              {testIndexTooltip.text}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
