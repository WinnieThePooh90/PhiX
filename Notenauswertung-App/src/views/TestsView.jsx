import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import { ABI_BAWUE_2026_120_BE_KEY, isAbiBaWue2026KeyFamilyId } from '../data/kmBwAbiPhysik2026GradingKey';
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
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  getStudentExamMaxPointsForGrade,
  getExamDisplayFieldCount,
  parseScorePointsValue,
  getExamTaskMaxRuleForStudent,
  isExamScoreFieldOutOfRange,
  getNachschreiberFieldMaxPoints,
  EXAM_ABS_MAX_FIELDS,
  normalizeCourseGradeSystem,
  isPointsBasedGradeSystem,
  getCustomKeyDefinition,
  getTestGradeForStudent,
  isExamManualGradeActive,
  getExamManualGradeStoredValue,
  gradingKeyResultDisplayOpts,
  gradingKeyResultToStoredString,
} from '../utils/calculator';
import { abiTemplateSimulatedMaxMismatchTooltip } from '../utils/abiTemplateSimulatedMaxWarning';
import { getCourseGradingKeysLookup } from '../utils/courseArchive';
import GradingKeyTable from '../components/GradingKeyTable';
import GradingKeySelect from '../components/GradingKeySelect';
import MaximizableTableSection, { TableMaximizeToggle } from '../components/MaximizableTableSection';
import ExamChartsPanels from '../components/ExamChartsPanels';
import {
  createScoreTaskTabHandler,
  focusScoreTaskInput,
  scoreTaskInputDataAttr,
} from '../utils/scoreTaskTabNavigation';
import DeferredNumberInput from '../components/DeferredNumberInput';
import { useDialog } from '../components/PhixDialog';
import { handleTableEnterAsTab } from '../utils/tableEnterAsTab';

const TEST_INDEX_COL_PX = 52;

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
    addTest,
    removeTest,
    updateTest,
    updateTestScore,
    updateTestFieldMaxPoints,
    updateTestCounted,
    updateTestStudentNachschreiber,
    updateTestStudentNachschreiberFields,
    updateTestStudentNachschreiberFieldMaxPoints,
    updateTestStudentManualGrade,
    updateTestStudentManualGradeValue,
    students,
    config,
    courseArchived,
  } = useData();

  const { showConfirm } = useDialog();

  const displayStudents = useMemo(() => {
    if (studentIdFilterSet == null) return students;
    return students.filter((s) => studentIdFilterSet.has(s.id));
  }, [students, studentIdFilterSet]);

  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const keyGradeOpts = gradingKeyResultDisplayOpts(gradeSys);
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

  const customKeysList = getCourseGradingKeysLookup(config);
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
        Keine Tests vorhanden.
        {!courseArchived ? (
          <>
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
          </>
        ) : null}
      </div>
    );
  }

  const numFields = test.numFields || 1;
  const displayFieldCount = getExamDisplayFieldCount(test, displayStudents);
  const sidebarCustomDef = getCustomKeyDefinition(customKeysList, test.keyType || '1');
  const scoreInputScope = `test-${activeTest}`;

  const testRowStats = useCallback(
    (studentId) => {
      const rawSc = test.scores?.[studentId] ?? test.errors?.[studentId];
      const effN = getStudentEffectiveExamFieldCount(test, studentId);
      const { fields, counted, total, value } = getNormalizedExamScore(rawSc, effN);
      const maxPts = getStudentExamMaxPointsForGrade(test, studentId);
      const isManual = isExamManualGradeActive(rawSc);
      const grade = counted ? getTestGradeForStudent(test, studentId, customKeysList, gradeSys) : null;
      const manualGradeInput = getExamManualGradeStoredValue(rawSc);
      return { effN, fields, counted, total, maxPts, grade, isManual, manualGradeInput, value };
    },
    [test, customKeysList, gradeSys],
  );

  const toggleStudentRow = (studentId) => {
    setExpandedStudentId((prev) => (prev === studentId ? null : studentId));
  };

  const handleScoreChange = (studentId, fieldIndex, value) => {
    updateTestScore(activeTest, studentId, fieldIndex, value);
  };

  const handleMaxPointsChange = (fieldIndex, value) => {
    updateTestFieldMaxPoints(activeTest, fieldIndex, value);
  };

  const handleDeleteTest = async () => {
    const ok = await showConfirm(
      'Diesen Test wirklich endgültig löschen? Alle eingetragenen Punktwerte und Einstellungen zu diesem Test gehen verloren.',
      { title: 'Test löschen', danger: true },
    );
    if (!ok) return;
    const id = activeTest;
    const remaining = testNumbers.filter((n) => n !== id);
    const nextActive = remaining[0] ?? null;
    if (nextActive) setActiveTest(nextActive);
    await removeTest(id);
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
            {!courseArchived ? (
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
            ) : null}
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
                  disabled={courseArchived}
                  onChange={(e) => updateTest(activeTest, 'active', e.target.checked)}
                />
                <span className="slider" />
              </label>
              {!test.active && (
                <button
                  type="button"
                  className="tab secondary course-meta-inline-btn"
                  onClick={handleDeleteTest}
                  title="Test dauerhaft aus diesem Kurs entfernen"
                >
                  Test löschen
                </button>
              )}
            </div>
          </div>
          {test.active && (
            <>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`test-numfields-${activeTest}`}>
                  Aufgabenfelder
                </label>
                <DeferredNumberInput
                  id={`test-numfields-${activeTest}`}
                  className="course-meta-control"
                  integer
                  min={1}
                  max={EXAM_ABS_MAX_FIELDS}
                  defaultValue={1}
                  value={numFields}
                  onChange={(n) => updateTest(activeTest, 'numFields', n)}
                  style={{ width: '70px' }}
                />
              </div>
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
              {!config?.kursstufe && (
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
              )}
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`test-key-${activeTest}`}>
                  Notenschlüssel
                </label>
                <GradingKeySelect
                  id={`test-key-${activeTest}`}
                  className="course-meta-control"
                  value={test.keyType || '1'}
                  onChange={(v) => updateTest(activeTest, 'keyType', v)}
                  course={config}
                  maxPoints={test.maxPoints}
                  showNotenpunkte={isPointsBasedGradeSystem(gradeSys)}
                />
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
                      <input type="checkbox" checked={showKey} disabled={courseArchived} onChange={(e) => setShowKey(e.target.checked)} />
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
                        {[...Array(displayFieldCount)].map((_, i) => (
                          <th key={i} className="text-center exam-th-r1 exam-task-col" style={{ width: '80px', minWidth: '80px' }}>
                            A{i + 1}
                          </th>
                        ))}
                        <th
                          className="text-center"
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
                          className="text-center"
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
                        {[...Array(displayFieldCount)].map((_, i) => (
                          <th
                            key={i}
                            className="text-center exam-th-r2 exam-task-col"
                            style={{ textTransform: 'none', background: i >= numFields ? 'hsl(var(--brand-hsl) / 0.06)' : undefined }}
                            title={i >= numFields ? 'Maximalpunkte bei Nachschreibern in der jeweiligen Schülerzeile' : undefined}
                          >
                            {i < numFields ? (
                              <DeferredNumberInput
                                value={parseScorePointsValue(test.fieldMaxPoints?.[i] ?? (numFields === 1 && test.maxPoints ? test.maxPoints : ''))}
                                defaultValue={0}
                                onChange={(n) => handleMaxPointsChange(i, n)}
                                onKeyDown={handleTableEnterAsTab}
                                placeholder="0"
                                style={{ textAlign: 'center', width: '70px', minWidth: 'auto', borderRadius: 0, fontWeight: 'bold', background: 'var(--surface)' }}
                              />
                            ) : (
                              <span className="text-muted" aria-hidden="true">—</span>
                            )}
                          </th>
                        ))}
                        <th
                          className="text-center"
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
                          {test.maxPoints}
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
                                color: isGradeWorseThan4(testClassAverage, gradeSys, isPointsBasedGradeSystem(gradeSys) ? { inputScale: 'notenpunkte' } : undefined) ? 'var(--danger)' : 'var(--foreground)',
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
                            colSpan={4 + displayFieldCount}
                            className="text-center text-muted"
                            style={{ padding: '2rem' }}
                          >
                            Kein Schüler entspricht der Suche.
                          </td>
                        </tr>
                      )}
                      {displayStudents.map((s, idx) => {
                        const rawSc = test.scores?.[s.id] ?? test.errors?.[s.id];
                        const {
                          effN,
                          fields,
                          counted,
                          total: totalPoints,
                          maxPts,
                          grade,
                          isManual,
                          manualGradeInput,
                        } = testRowStats(s.id);
                        const isNach = typeof rawSc === 'object' && rawSc !== null && !!rawSc._nachschreiber;
                        const showAbsentFlag = !counted;
                        const showNachFlag = counted && isNach;
                        const showIndexFlag = showAbsentFlag || showNachFlag;
                        const isExpanded = expandedStudentId === s.id;
                        const detailColSpan = 4 + displayFieldCount;

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
                              {[...Array(displayFieldCount)].map((_, fieldIndex) => {
                                const beyond = fieldIndex >= effN;
                                const val = fields[fieldIndex] !== undefined ? fields[fieldIndex] : '';
                                const maxRule = getExamTaskMaxRuleForStudent(test, s.id, fieldIndex);
                                const scoreOutOfRange = !beyond && isExamScoreFieldOutOfRange(val, maxRule);
                                const nachFieldMax = getNachschreiberFieldMaxPoints(rawSc);
                                const nachMaxKeyStr = String(fieldIndex);
                                const hasNachMaxKey =
                                  Object.prototype.hasOwnProperty.call(nachFieldMax, fieldIndex) ||
                                  Object.prototype.hasOwnProperty.call(nachFieldMax, nachMaxKeyStr);
                                const nachMaxVal = parseScorePointsValue(
                                  hasNachMaxKey
                                    ? nachFieldMax[fieldIndex] ?? nachFieldMax[nachMaxKeyStr]
                                    : test.fieldMaxPoints?.[fieldIndex] ?? test.fieldMaxPoints?.[nachMaxKeyStr] ?? (numFields === 1 && test.maxPoints ? test.maxPoints : ''),
                                );
                                return (
                                  <td key={fieldIndex} className="text-center exam-task-col" style={{ opacity: beyond ? 0.45 : 1, verticalAlign: 'middle' }}>
                                    {beyond ? (
                                      <span className="text-muted" title="Für diesen Schüler nicht gewertet">—</span>
                                    ) : isNach ? (
                                      <div className="exam-nach-task-cell">
                                        <DeferredNumberInput
                                          defaultValue={0}
                                          value={nachMaxVal}
                                          disabled={courseArchived}
                                          onChange={(n) =>
                                            updateTestStudentNachschreiberFieldMaxPoints(
                                              activeTest,
                                              s.id,
                                              fieldIndex,
                                              n,
                                            )
                                          }
                                          onKeyDown={handleTableEnterAsTab}
                                          style={{
                                            width: '70px',
                                            textAlign: 'center',
                                            padding: '0.15rem',
                                            fontSize: '0.75rem',
                                            borderRadius: 0,
                                            marginBottom: '0.2rem',
                                          }}
                                          title={`Maximalpunkte A${fieldIndex + 1} (Nachschreiber)`}
                                          aria-label={`Maximalpunkte A${fieldIndex + 1} für ${s.lastName}, ${s.firstName}`}
                                        />
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          data-score-task-input={scoreTaskInputDataAttr(scoreInputScope, s.id, fieldIndex)}
                                          value={val}
                                          onChange={e => handleScoreChange(s.id, fieldIndex, e.target.value)}
                                          onKeyDown={createScoreTaskTabHandler({
                                            scopeKey: scoreInputScope,
                                            rowKey: s.id,
                                            fieldIndex,
                                            effectiveFieldCount: effN,
                                            onTabForwardFromLastField: () => {
                                              const rowIdx = displayStudents.findIndex((st) => st.id === s.id);
                                              const nextStudent = displayStudents[rowIdx + 1];
                                              if (!nextStudent) return;
                                              const nextEffN = getStudentEffectiveExamFieldCount(test, nextStudent.id);
                                              if (nextEffN > 0) {
                                                focusScoreTaskInput(scoreInputScope, nextStudent.id, 0);
                                              }
                                            },
                                            onShiftTabFromFirstField: () => {
                                              const rowIdx = displayStudents.findIndex((st) => st.id === s.id);
                                              const prevStudent = displayStudents[rowIdx - 1];
                                              if (!prevStudent) return;
                                              const prevEffN = getStudentEffectiveExamFieldCount(test, prevStudent.id);
                                              if (prevEffN > 0) {
                                                focusScoreTaskInput(scoreInputScope, prevStudent.id, prevEffN - 1);
                                              }
                                            },
                                          })}
                                          placeholder="0"
                                          className={scoreOutOfRange ? 'exam-score-input--out-of-range' : undefined}
                                          title={
                                            scoreOutOfRange
                                              ? maxRule.configured
                                                ? 'Wert muss zwischen 0 und den Maximalpunkten dieser Aufgabe liegen.'
                                                : 'Bitte zuerst Maximalpunkte eintragen oder hier 0 Punkte eintragen.'
                                              : undefined
                                          }
                                          style={{ textAlign: 'center', width: '70px', minWidth: 'auto', borderRadius: 0 }}
                                        />
                                      </div>
                                    ) : (
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        data-score-task-input={scoreTaskInputDataAttr(scoreInputScope, s.id, fieldIndex)}
                                        value={val}
                                        onChange={e => handleScoreChange(s.id, fieldIndex, e.target.value)}
                                        onKeyDown={createScoreTaskTabHandler({
                                          scopeKey: scoreInputScope,
                                          rowKey: s.id,
                                          fieldIndex,
                                          effectiveFieldCount: effN,
                                          onTabForwardFromLastField: () => {
                                            const rowIdx = displayStudents.findIndex((st) => st.id === s.id);
                                            const nextStudent = displayStudents[rowIdx + 1];
                                            if (!nextStudent) return;
                                            const nextEffN = getStudentEffectiveExamFieldCount(test, nextStudent.id);
                                            if (nextEffN > 0) {
                                              focusScoreTaskInput(scoreInputScope, nextStudent.id, 0);
                                            }
                                          },
                                          onShiftTabFromFirstField: () => {
                                            const rowIdx = displayStudents.findIndex((st) => st.id === s.id);
                                            const prevStudent = displayStudents[rowIdx - 1];
                                            if (!prevStudent) return;
                                            const prevEffN = getStudentEffectiveExamFieldCount(test, prevStudent.id);
                                            if (prevEffN > 0) {
                                              focusScoreTaskInput(scoreInputScope, prevStudent.id, prevEffN - 1);
                                            }
                                          },
                                        })}
                                        placeholder="0"
                                        className={scoreOutOfRange ? 'exam-score-input--out-of-range' : undefined}
                                        title={
                                          scoreOutOfRange
                                            ? maxRule.configured
                                              ? 'Wert muss zwischen 0 und den Maximalpunkten dieser Aufgabe liegen.'
                                              : 'Bitte zuerst Maximalpunkte eintragen oder hier 0 Punkte eintragen.'
                                            : undefined
                                        }
                                        style={{ textAlign: 'center', width: '70px', minWidth: 'auto', borderRadius: 0 }}
                                      />
                                    )}
                                  </td>
                                );
                              })}
                              <td
                                className="text-center"
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
                                {totalPoints}
                                <span className="text-muted" style={{ fontWeight: 'normal', fontSize: '0.8rem' }}> / {maxPts}</span>
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
                                      ? (getGradeCellBackground(grade, gradeSys, keyGradeOpts) ?? 'var(--surface)')
                                      : 'var(--surface)',
                                  color: counted && grade !== null ? getGradeTextColor(grade, gradeSys, keyGradeOpts) : undefined,
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
                                    placeholder="-"
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
                                      color: isGradeWorseThan4(grade, gradeSys, keyGradeOpts) ? 'var(--danger)' : 'var(--foreground)',
                                    }}
                                  >
                                    {formatGrade(grade, gradeSys, keyGradeOpts)}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr style={{ background: 'rgba(15, 23, 42, 0.015)' }}>
                                <td
                                  colSpan={detailColSpan}
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
                                        disabled={courseArchived}
                                        onChange={(e) => updateTestCounted(activeTest, s.id, e.target.checked)}
                                        aria-label="Teilnahme am Ergebnis"
                                      />
                                      <span className="slider" />
                                    </label>
                                    <span className="text-muted" style={{ fontSize: '0.875rem', marginLeft: '0.75rem' }}>
                                      Nachschreiber:
                                    </span>
                                    <label className="switch switch--table-row" title="Eigene Aufgabenfelder-Anzahl für diesen Schüler (auch mehr als der Test)">
                                      <input
                                        type="checkbox"
                                        checked={isNach}
                                        disabled={courseArchived}
                                        onChange={(e) =>
                                          updateTestStudentNachschreiber(activeTest, s.id, e.target.checked)
                                        }
                                        aria-label="Nachschreiber"
                                      />
                                      <span className="slider" />
                                    </label>
                                    {isNach && (
                                      <>
                                        <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                                          Aufgabenfelder (dieser Schüler):
                                        </span>
                                        <DeferredNumberInput
                                          integer
                                          min={1}
                                          max={EXAM_ABS_MAX_FIELDS}
                                          defaultValue={numFields}
                                          value={effN}
                                          onChange={(n) => updateTestStudentNachschreiberFields(activeTest, s.id, n)}
                                          style={{ width: '56px', textAlign: 'center', padding: '0.2rem' }}
                                          title={`1–${EXAM_ABS_MAX_FIELDS}; Standard ist der Test (${numFields} Felder). Maximalpunkte pro Aufgabe in der Zeile darüber eintragen.`}
                                        />
                                      </>
                                    )}
                                    <span className="text-muted" style={{ fontSize: '0.875rem', marginLeft: '0.75rem' }}>
                                      Manuelle Note:
                                    </span>
                                    <label className="switch switch--table-row" title="Note manuell setzen (Berechnung ignorieren)">
                                      <input
                                        type="checkbox"
                                        checked={isManual}
                                        disabled={courseArchived}
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
                                            calcGrade != null ? gradingKeyResultToStoredString(calcGrade, gradeSys) : '';
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
                maxPoints={test.maxPoints}
                title={
                  sidebarCustomDef
                    ? sidebarCustomDef.name
                    : getBuiltinGradingKeyTitle(test.keyType) || 'Aktueller Schlüssel'
                }
                desc={
                  sidebarCustomDef
                    ? (isVorlage1KeyFamilyId(sidebarCustomDef.id)
                        ? getPlateauKeyShortDesc('1', test.maxPoints)
                        : sidebarCustomDef.name)
                    : test.keyType === 'abi'
                      ? 'ABI BaWü 2026 120 BE'
                      : getBuiltinGradingKeyShortDesc(test.keyType, test.maxPoints) || `Schlüssel ${test.keyType || '1'}`
                }
                titleHelpText={
                  sidebarCustomDef
                    ? (isVorlage1KeyFamilyId(sidebarCustomDef.id) ? getFormulaKeyHelpText('1') : null)
                    : (isPlateauGradingKeyType(test.keyType) ? getFormulaKeyHelpText(test.keyType) : null)
                }
                customBands={
                  sidebarCustomDef
                    ? (isVorlage1KeyFamilyId(sidebarCustomDef.id)
                        ? buildVorlage1Bands(test.maxPoints)
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
                titleWarningTooltip={abiTemplateSimulatedMaxMismatchTooltip(sidebarCustomDef?.id, test.maxPoints)}
                showNotenpunkte={isPointsBasedGradeSystem(gradeSys)}
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
                    exam={test}
                    examRowStats={testRowStats}
                    tooltipGrade={tooltipGrade}
                    setTooltipGrade={setTooltipGrade}
                    pieTooltip={pieTooltip}
                    setPieTooltip={setPieTooltip}
                    displayFieldCount={displayFieldCount}
                    gradeSystem={gradeSys}
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
