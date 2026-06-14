import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import { ABI_BAWUE_2026_120_BE_KEY, isAbiBaWue2026KeyFamilyId } from '../data/kmBwAbiPhysik2026GradingKey';
import { isAbiBaWue2026Mathematik100BeFamilyId } from '../data/abiBaWu2026Mathematik100BeGradingKey';
import {
  formatGrade,
  isGradeWorseThan4,
  getGradeCellBackground,
  getGradeTextColor,
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  getStudentExamMaxPointsForGrade,
  getExamGradeForStudent,
  getExamDisplayFieldCount,
  EXAM_ABS_MAX_FIELDS,
  getCustomKeyDefinition,
  normalizeCourseGradeSystem,
  isExamManualGradeActive,
  getExamManualGradeStoredValue,
  classicGradeToStoredString,
  parseScorePointsValue,
} from '../utils/calculator';
import { abiTemplateSimulatedMaxMismatchTooltip } from '../utils/abiTemplateSimulatedMaxWarning';
import GradingKeyTable from '../components/GradingKeyTable';
import MaximizableTableSection, { TableMaximizeToggle } from '../components/MaximizableTableSection';
import ExamChartsPanels from '../components/ExamChartsPanels';
import { useDialog } from '../components/PhixDialog';
import {
  createScoreTaskTabHandler,
  focusScoreTaskInput,
  scoreTaskInputDataAttr,
} from '../utils/scoreTaskTabNavigation';

// Hilfsfunktion: Berechnet die Summe aller Felder, falls die Scores ein Objekt sind.
const getSum = (scoreData) => {
  if (!scoreData) return 0;
  if (typeof scoreData === 'object') {
    return Object.entries(scoreData)
      .filter(([k]) => /^\d+$/.test(String(k)))
      .reduce((sum, [, v]) => sum + parseScorePointsValue(v), 0);
  }
  return parseScorePointsValue(scoreData);
};

/** Breite der #-Spalte; NAME klebt bei `left` gleich diesem Wert */
const EXAM_INDEX_COL_PX = 52;

/**
 * Regel für Schülerpunkte pro Task-Spalte:
 * - `configured`: in `fieldMaxPoints` existiert ein gültiger Max-Wert (auch 0).
 * - `max`: nur relevant wenn `configured`; sonst `null`.
 * Ohne konfiguriertes Maximum: im Schülerfeld nur 0 erlaubt (sonst rot).
 */
function getExamTaskMaxRule(exam, fieldIndex) {
  const fmp = exam.fieldMaxPoints;
  if (!fmp || typeof fmp !== 'object') {
    return { configured: false, max: null };
  }
  const keyStr = String(fieldIndex);
  const has =
    Object.prototype.hasOwnProperty.call(fmp, fieldIndex) ||
    Object.prototype.hasOwnProperty.call(fmp, keyStr);
  if (!has) {
    return { configured: false, max: null };
  }
  const raw = fmp[fieldIndex] ?? fmp[keyStr];
  if (raw === '' || raw === undefined || raw === null) {
    return { configured: false, max: null };
  }
  const maxN = parseFloat(String(raw).replace(',', '.'));
  if (Number.isNaN(maxN)) {
    return { configured: false, max: null };
  }
  return { configured: true, max: maxN };
}

/** Eingabe rot: kleiner 0; ohne Task-Max nur 0; mit Task-Max über eingetragenem Maximum. */
function isExamScoreFieldOutOfRange(rawValue, rule) {
  if (rawValue === '' || rawValue === undefined || rawValue === null) return false;
  const n = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue).replace(',', '.'));
  if (Number.isNaN(n)) return false;
  if (n < 0) return true;
  if (!rule.configured) return n !== 0;
  return n > rule.max;
}

/** variant: 'nach' = Nachschreiber (gelb), 'absent' = nicht teilgenommen / „Teilgenommen“ aus (rot) */
function ExamRowBookmark({ variant }) {
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

export default function ExamsView({ studentIdFilterSet = null }) {
  const {
    exams,
    updateExam,
    removeExam,
    updateExamScore,
    updateExamFieldMaxPoints,
    updateExamCounted,
    updateExamStudentNachschreiber,
    updateExamStudentNachschreiberFields,
    updateExamStudentManualGrade,
    updateExamStudentManualGradeValue,
    students,
    addExam,
    config,
  } = useData();
  const { showConfirm } = useDialog();

  const displayStudents = useMemo(() => {
    if (studentIdFilterSet == null) return students;
    return students.filter((s) => studentIdFilterSet.has(s.id));
  }, [students, studentIdFilterSet]);

  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const examNumbers = Object.keys(exams).sort((a, b) => Number(a) - Number(b));
  
  const [activeKlausur, setActiveKlausur] = useState(examNumbers.length > 0 ? examNumbers[0] : '1');
  const [showKey, setShowKey] = useState(false);
  const [tooltipGrade, setTooltipGrade] = useState(null);
  const [pieTooltip, setPieTooltip] = useState(null); // 'good' or 'bad'
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  /** Fähnchen-Tooltip per Portal (sonst Abschneiden durch Tabellen-Scroll-Container) */
  const [examIndexTooltip, setExamIndexTooltip] = useState(null);
  const [chartsModalOpen, setChartsModalOpen] = useState(false);
  const [tableMaximized, setTableMaximized] = useState(false);

  useEffect(() => {
    setExpandedStudentId(null);
    setChartsModalOpen(false);
    setTooltipGrade(null);
    setPieTooltip(null);
    setTableMaximized(false);
  }, [activeKlausur]);

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

  const exam = exams[activeKlausur];

  useEffect(() => {
    if (!exam?.active) {
      setChartsModalOpen(false);
      setTooltipGrade(null);
      setPieTooltip(null);
    }
  }, [exam?.active]);

  useEffect(() => {
    if (!examIndexTooltip) return undefined;
    const hide = () => setExamIndexTooltip(null);
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, { capture: true });
      window.removeEventListener('resize', hide);
    };
  }, [examIndexTooltip]);

  if (!exam) {
    return (
      <div className="text-center mt-8 text-muted">
        Keine Klausuren vorhanden. Bitte füge eine neue Klausur hinzu.
        <br />
        <button className="mt-4" onClick={async () => {
          const newNum = await addExam();
          if (newNum) setActiveKlausur(newNum.toString());
        }}>
          + Erste Klausur anlegen
        </button>
      </div>
    );
  }
  
  const numFields = exam.numFields || 1;
  const displayFieldCount = getExamDisplayFieldCount(exam, displayStudents);
  const scoreInputScope = `exam-${activeKlausur}`;

  const customKeysList = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const sidebarCustomDef = getCustomKeyDefinition(customKeysList, exam.keyType || '1');

  const examRowStats = (studentId) => {
    const rawSc = exam.scores?.[studentId];
    const effN = getStudentEffectiveExamFieldCount(exam, studentId);
    const { fields, counted, total } = getNormalizedExamScore(rawSc, effN);
    const maxPts = getStudentExamMaxPointsForGrade(exam, studentId);
    const isManual = isExamManualGradeActive(rawSc);
    const grade = counted ? getExamGradeForStudent(exam, studentId, customKeysList) : null;
    const manualGradeInput = getExamManualGradeStoredValue(rawSc);
    return { effN, fields, counted, total, maxPts, grade, isManual, manualGradeInput };
  };

  const handleScoreChange = (studentId, fieldIndex, value) => {
    updateExamScore(activeKlausur, studentId, fieldIndex, value);
  };

  const handleMaxPointsChange = (fieldIndex, value) => {
    updateExamFieldMaxPoints(activeKlausur, fieldIndex, value);
  };

  const handleNumFieldsChange = (e) => {
    const fields = parseInt(e.target.value, 10);
    if (fields >= 1 && fields <= EXAM_ABS_MAX_FIELDS) {
      updateExam(activeKlausur, 'numFields', fields);
    }
  };

  const toggleStudentRow = (studentId) => {
    setExpandedStudentId((prev) => (prev === studentId ? null : studentId));
  };

  const handleDeleteExam = async () => {
    const ok = await showConfirm(
      'Diese Klausur wirklich endgültig löschen? Alle eingetragenen Punktwerte und Einstellungen zu dieser Klausur gehen verloren.',
      { title: 'Klausur löschen', danger: true },
    );
    if (!ok) return;
    const id = activeKlausur;
    const remaining = examNumbers.filter((n) => n !== id);
    const nextActive = remaining[0] ?? null;
    await removeExam(id);
    if (nextActive) setActiveKlausur(nextActive);
  };

  return (
    <>
    <div className="view-page-scroll">
      <div className="view-toolbar-block exams-toolbar">
        <div className="flex justify-between items-center mb-4 pt-2 view-page-nav">
          <h2 style={{ margin: 0 }}>Schriftliche Noten (Klausuren)</h2>
          <div className="flex gap-2" style={{ overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
            {examNumbers.map(num => (
              <button 
                key={num}
                className={`tab ${activeKlausur === num.toString() ? 'active' : 'secondary'}`}
                onClick={() => setActiveKlausur(num.toString())}
              >
                KA {num}
              </button>
            ))}
            <button 
              className="tab secondary"
              onClick={async () => {
                const newNum = await addExam();
                if (newNum) setActiveKlausur(newNum.toString());
              }}
              title="Weitere Klausur hinzufügen"
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
                  checked={exam.active}
                  onChange={(e) => updateExam(activeKlausur, 'active', e.target.checked)}
                />
                <span className="slider" />
              </label>
              {!exam.active && (
                <button
                  type="button"
                  className="tab secondary course-meta-inline-btn"
                  onClick={handleDeleteExam}
                  title="Klausur dauerhaft aus diesem Kurs entfernen"
                >
                  Klausur löschen
                </button>
              )}
            </div>
          </div>
          {exam.active && (
            <>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`exam-numfields-${activeKlausur}`}>
                  Aufgabenfelder
                </label>
                <input
                  id={`exam-numfields-${activeKlausur}`}
                  className="course-meta-control"
                  type="number"
                  min="1"
                  max={EXAM_ABS_MAX_FIELDS}
                  value={numFields}
                  onChange={handleNumFieldsChange}
                  style={{ width: '70px' }}
                />
              </div>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`exam-date-${activeKlausur}`}>
                  Datum
                </label>
                <input
                  id={`exam-date-${activeKlausur}`}
                  className="course-meta-control"
                  type="date"
                  value={exam.date || ''}
                  onChange={(e) => updateExam(activeKlausur, 'date', e.target.value)}
                />
              </div>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`exam-hj-${activeKlausur}`}>
                  Halbjahr
                </label>
                <select
                  id={`exam-hj-${activeKlausur}`}
                  className="course-meta-control"
                  value={exam.halbjahr || '1'}
                  onChange={(e) => updateExam(activeKlausur, 'halbjahr', e.target.value)}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`exam-key-${activeKlausur}`}>
                  Notenschlüssel
                </label>
                <select
                  id={`exam-key-${activeKlausur}`}
                  className="course-meta-control"
                  value={exam.keyType || '1'}
                  onChange={(e) => updateExam(activeKlausur, 'keyType', e.target.value)}
                >
                  <option value="1">Schlüssel 1</option>
                  <option value="2">Schlüssel 2</option>
                  <option value="3">Schlüssel 3</option>
                  <option value="4">Schlüssel 4 (Plateaus)</option>
                  <option value="5">Schlüssel 5 (Plateaus)</option>
                  <option value="6">Schlüssel 6 (Plateaus)</option>
                  <option value="abi">ABI BaWü 2026 120 BE</option>
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

      {exam.active ? (
        <div className={`exams-active-body ${showKey ? 'sidebar-layout' : ''}`}>
          <div className={`exams-main-stack ${showKey ? 'main-content' : ''}`}>
            <div className="exams-body-scroll view-table-scroll exam-table-scroll">
              <MaximizableTableSection
                title={`Klausur KA ${activeKlausur}`}
                maximized={tableMaximized}
                onMaximizedChange={setTableMaximized}
                embeddedToggle
              >
              <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th className="exam-th-sticky-left exam-th-r1" style={{ width: `${EXAM_INDEX_COL_PX}px`, minWidth: `${EXAM_INDEX_COL_PX}px`, left: 0 }}>#</th>
                    <th className="exam-th-sticky-left exam-th-r1" style={{ left: `${EXAM_INDEX_COL_PX}px` }}>NAME</th>
                    {[...Array(displayFieldCount)].map((_, i) => (
                      <th key={i} className="text-center exam-th-r1 exam-task-col" style={{ width: '80px', minWidth: '80px' }}>A{i + 1}</th>
                    ))}
                    <th className="text-center" style={{ width: '100px', minWidth: '100px', position: 'sticky', right: '100px', top: 'calc(var(--header-height) + 105px)', zIndex: 61, background: 'var(--surface-muted)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>GESAMT</th>
                    <th className="text-center" style={{ width: '100px', minWidth: '100px', position: 'sticky', right: 0, top: 'calc(var(--header-height) + 105px)', zIndex: 61, background: 'var(--surface-muted)', borderLeft: '1px solid var(--border)' }}>NOTE</th>
                  </tr>
                  <tr className="exam-thead-max-row" style={{ background: 'var(--bg-color)', fontWeight: 'bold' }}>
                    <th className="exam-th-sticky-left exam-th-r2" style={{ left: 0, textTransform: 'none' }}>Max</th>
                    <th className="exam-th-sticky-left exam-th-r2" style={{ left: `${EXAM_INDEX_COL_PX}px`, textTransform: 'none' }}>Maximalpunkte</th>
                    {[...Array(displayFieldCount)].map((_, i) => (
                      <th key={i} className="text-center exam-th-r2 exam-task-col" style={{ textTransform: 'none', background: i >= numFields ? 'hsl(var(--brand-hsl) / 0.06)' : undefined }} title={i >= numFields ? 'Max-Punkte für Zusatzaufgaben (z. B. Nachschreiber)' : undefined}>
                        <input 
                          type="number" 
                          value={exam.fieldMaxPoints?.[i] ?? ''}
                          onChange={e => handleMaxPointsChange(i, e.target.value)}
                          placeholder="0"
                          style={{ textAlign: 'center', width: '70px', minWidth: 'auto', borderRadius: 0, fontWeight: 'bold', background: i >= numFields ? 'var(--surface-muted)' : 'var(--surface)' }}
                        />
                      </th>
                    ))}
                    <th className="text-center" style={{ width: '100px', minWidth: '100px', position: 'sticky', right: '100px', top: 'calc(var(--header-height) + 146px)', zIndex: 61, background: 'var(--surface-muted)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', textTransform: 'none' }}>
                      {exam.maxPoints}
                    </th>
                    <th style={{ position: 'sticky', right: 0, top: 'calc(var(--header-height) + 146px)', zIndex: 61, background: 'var(--surface-muted)', borderLeft: '1px solid var(--border)' }}></th>
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
                    const {
                      effN,
                      fields,
                      counted,
                      total: totalPoints,
                      maxPts,
                      grade,
                      isManual,
                      manualGradeInput,
                    } = examRowStats(s.id);
                    const rawSc = exam.scores?.[s.id];
                    const isNach = typeof rawSc === 'object' && rawSc !== null && !!rawSc._nachschreiber;
                    const showAbsentFlag = !counted;
                    const showNachFlag = counted && isNach;
                    const showIndexFlag = showAbsentFlag || showNachFlag;
                    const isExpanded = expandedStudentId === s.id;
                    const detailColSpan = 4 + displayFieldCount;

                    return (
                      <React.Fragment key={s.id}>
                        <tr style={{ transition: 'background 0.2s', background: isExpanded ? 'rgba(79, 70, 229, 0.05)' : '' }}>
                          <td
                            style={{
                              position: 'sticky',
                              left: 0,
                              zIndex: 1,
                              background: 'var(--surface)',
                              borderRight: '1px solid var(--border)',
                              width: `${EXAM_INDEX_COL_PX}px`,
                              minWidth: `${EXAM_INDEX_COL_PX}px`,
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
                                    setExamIndexTooltip({
                                      text,
                                      left: Math.min(window.innerWidth - pad, Math.max(pad, cx)),
                                      top: r.bottom + 8,
                                    });
                                  }}
                                  onMouseLeave={() => setExamIndexTooltip(null)}
                                >
                                  <ExamRowBookmark variant={showAbsentFlag ? 'absent' : 'nach'} />
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
                              left: `${EXAM_INDEX_COL_PX}px`,
                              zIndex: 1,
                              background: 'var(--surface)',
                              borderRight: '1px solid var(--border)',
                              cursor: 'pointer',
                            }}
                            title="Klicken für Teilnahme / Details"
                          >
                            {s.lastName}, {s.firstName}
                          </td>
                          {[...Array(displayFieldCount)].map((_, fieldIndex) => {
                            const beyond = fieldIndex >= effN;
                            const val = fields[fieldIndex] !== undefined ? fields[fieldIndex] : '';
                            const maxRule = getExamTaskMaxRule(exam, fieldIndex);
                            const scoreOutOfRange = !beyond && isExamScoreFieldOutOfRange(val, maxRule);
                            return (
                              <td key={fieldIndex} className="text-center exam-task-col" style={{ opacity: beyond ? 0.45 : 1, verticalAlign: 'middle' }}>
                                {beyond ? (
                                  <span className="text-muted" title="Für diesen Schüler nicht gewertet">—</span>
                                ) : (
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    data-score-task-input={scoreTaskInputDataAttr(scoreInputScope, s.id, fieldIndex)}
                                    value={val}
                                    onChange={e => handleScoreChange(s.id, fieldIndex, e.target.value)}
                                    onKeyDown={createScoreTaskTabHandler({
                                      fieldIndex,
                                      effectiveFieldCount: effN,
                                      onTabForwardFromLastField: () => {
                                        const rowIdx = displayStudents.findIndex((st) => st.id === s.id);
                                        const nextStudent = displayStudents[rowIdx + 1];
                                        if (!nextStudent) return;
                                        const nextEffN = getStudentEffectiveExamFieldCount(exam, nextStudent.id);
                                        if (nextEffN > 0) {
                                          focusScoreTaskInput(scoreInputScope, nextStudent.id, 0);
                                        }
                                      },
                                      onShiftTabFromFirstField: () => {
                                        const rowIdx = displayStudents.findIndex((st) => st.id === s.id);
                                        const prevStudent = displayStudents[rowIdx - 1];
                                        if (!prevStudent) return;
                                        const prevEffN = getStudentEffectiveExamFieldCount(exam, prevStudent.id);
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
                          <td className="text-center" style={{ width: '100px', minWidth: '100px', position: 'sticky', right: '100px', zIndex: 1, background: 'var(--surface)', fontWeight: 'bold', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
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
                              background: counted && grade !== null
                                ? (getGradeCellBackground(grade) ?? 'var(--surface)')
                                : 'var(--surface)',
                              color: counted && grade !== null ? getGradeTextColor(grade) : undefined,
                              borderLeft: '1px solid var(--border)',
                            }}
                          >
                            {counted && isManual ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                className="exam-manual-grade-input"
                                value={manualGradeInput}
                                onChange={(e) =>
                                  updateExamStudentManualGradeValue(activeKlausur, s.id, e.target.value)
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
                              <span style={{ fontWeight: 'bold', color: isGradeWorseThan4(grade) ? 'var(--danger)' : 'var(--foreground)' }}>
                                {formatGrade(grade, gradeSys)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: 'rgba(15, 23, 42, 0.015)' }}>
                            <td colSpan={detailColSpan} style={{ padding: 0, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
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
                                <span className="text-muted" style={{ fontSize: '0.875rem' }}>Teilgenommen:</span>
                                <label className="switch switch--table-row" title="In Gesamtergebnis einbeziehen">
                                  <input
                                    type="checkbox"
                                    checked={counted}
                                    onChange={e => updateExamCounted(activeKlausur, s.id, e.target.checked)}
                                    aria-label="Teilnahme am Ergebnis"
                                  />
                                  <span className="slider" />
                                </label>
                                <span className="text-muted" style={{ fontSize: '0.875rem', marginLeft: '0.75rem' }}>Nachschreiber:</span>
                                <label className="switch switch--table-row" title="Eigene Aufgabenfelder-Anzahl für diesen Schüler (auch mehr als die Klausur)">
                                  <input
                                    type="checkbox"
                                    checked={isNach}
                                    onChange={e => updateExamStudentNachschreiber(activeKlausur, s.id, e.target.checked)}
                                    aria-label="Nachschreiber"
                                  />
                                  <span className="slider" />
                                </label>
                                {isNach && (
                                  <>
                                    <span className="text-muted" style={{ fontSize: '0.875rem' }}>Aufgabenfelder (dieser Schüler):</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={EXAM_ABS_MAX_FIELDS}
                                      value={effN}
                                      onChange={e => updateExamStudentNachschreiberFields(activeKlausur, s.id, e.target.value)}
                                      style={{ width: '56px', textAlign: 'center', padding: '0.2rem' }}
                                      title={`1–${EXAM_ABS_MAX_FIELDS}; Standard ist die Klausur (${numFields} Felder). Zusatzspalten: Max-Punkte oben in den violett markierten Spalten eintragen.`}
                                    />
                                  </>
                                )}
                                <span className="text-muted" style={{ fontSize: '0.875rem', marginLeft: '0.75rem' }}>Manuelle Note:</span>
                                <label className="switch switch--table-row" title="Note manuell setzen (Berechnung ignorieren)">
                                  <input
                                    type="checkbox"
                                    checked={isManual}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      if (!checked) {
                                        updateExamStudentManualGrade(activeKlausur, s.id, false);
                                        return;
                                      }
                                      const stored = getExamManualGradeStoredValue(rawSc);
                                      if (stored.trim() !== '') {
                                        updateExamStudentManualGrade(activeKlausur, s.id, true);
                                        return;
                                      }
                                      const { grade: calcGrade } = examRowStats(s.id);
                                      const seed =
                                        calcGrade != null ? classicGradeToStoredString(calcGrade, gradeSys) : '';
                                      updateExamStudentManualGrade(activeKlausur, s.id, true, seed);
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
                type={sidebarCustomDef ? '1' : (exam.keyType || '1')}
                maxPoints={exam.maxPoints}
                title="Aktueller Schlüssel"
                desc={
                  sidebarCustomDef
                    ? sidebarCustomDef.name
                    : exam.keyType === 'abi'
                      ? 'ABI BaWü 2026 120 BE'
                      : ['4', '5', '6'].includes(exam.keyType || '')
                        ? `Schlüssel ${exam.keyType || '1'} (Plateaus)`
                        : `Schlüssel ${exam.keyType || '1'}`
                }
                customBands={sidebarCustomDef?.bands ?? (exam.keyType === 'abi' ? ABI_BAWUE_2026_120_BE_KEY.bands : undefined)}
                pktIntegerDisplay={
                  !!sidebarCustomDef?.pktIntegerDisplay ||
                  exam.keyType === 'abi' ||
                  (sidebarCustomDef?.id &&
                    (isAbiBaWue2026KeyFamilyId(sidebarCustomDef.id) ||
                      isAbiBaWue2026Mathematik100BeFamilyId(sidebarCustomDef.id)))
                }
                titleWarningTooltip={abiTemplateSimulatedMaxMismatchTooltip(sidebarCustomDef?.id, exam.maxPoints)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="text-muted mt-8" style={{ textAlign: 'center' }}>
          Diese Klausur ist derzeit deaktiviert. Setze den Haken auf "Aktivieren", um Noten einzutragen.
        </div>
      )}
    </div>
    {chartsModalOpen && exam.active
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
              aria-labelledby="exam-charts-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="exam-charts-modal-header">
                <h2 id="exam-charts-modal-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                  Analyse · KA {activeKlausur}
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
                  exam={exam}
                  examRowStats={examRowStats}
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
    {examIndexTooltip
      ? createPortal(
          <div
            className="exam-index-tooltip-portal"
            role="tooltip"
            style={{
              position: 'fixed',
              left: examIndexTooltip.left,
              top: examIndexTooltip.top,
              transform: 'translate(-50%, 0)',
              zIndex: 10050,
            }}
          >
            {examIndexTooltip.text}
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
