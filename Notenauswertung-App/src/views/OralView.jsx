import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import { useDialog } from '../components/PhixDialog';
import {
  isGradeWorseThan4,
  gradeCellColorsFromResolved,
  resolveStoredGradeForCellColor,
  getNormalizedOralGrade,
  getNormalizedOralWeekPointsArray,
  getOralTotalWeekPoints,
  getOralWeekColumnLabel,
  formatOralWeekPointDisplay,
  formatGrade,
  classicGradeToStoredString,
  normalizeCourseGradeSystem,
  ORAL_BEST_NOTE_ALPHA_OPTIONS,
  normalizeOralBestNoteAlpha,
  normalizeOralSpreadBeta,
  normalizeOralWorstNote,
  ORAL_WORST_NOTE_OPTIONS,
  ORAL_POINTS_BEST_OPTIONS,
  ORAL_POINTS_WORST_OPTIONS,
  normalizeOralBestNotePoints,
  normalizeOralWorstNotePoints,
  computeOralExtendedCalculatedGrade,
  computeOralExtendedGradesAverage,
  roundOralNoteToQuarter,
  getNormalizedOralWeekGradesArray,
  formatStoredOralWeekGradeDisplay,
  oralExtendedCalculatedFormatOpts,
} from '../utils/calculator';
import {
  createOralWeekTabHandler,
  oralWeekInputDataAttr,
} from '../utils/oralWeekTabNavigation';
import {
  getOralExtendedMode,
  getOralExtendedModeLabel,
  isOralExtendedActive,
  isOralExtendedGrades,
  isOralExtendedPoints,
} from '../utils/oralExtendedMode';
import OralExtendedModeSwitch from '../components/OralExtendedModeSwitch';
import MaximizableTableSection, { TableMaximizeToggle } from '../components/MaximizableTableSection';

const ORAL_WEEK_COL_CAP = 24;
const ORAL_INDEX_COL_PX = 52;
/** Feste Namensspalte, damit `left` für Sticky zuverlässig passt */
const ORAL_NAME_COL_PX = 180;
const ORAL_GESAMT_COL_PX = 88;
/** Zwischen Gesamt und Note (sticky) */
const ORAL_BERECHNET_COL_PX = 124;
const ORAL_NOTE_COL_PX = 112;

const ORAL_RIGHT_STICKY_OFFSET = ORAL_NOTE_COL_PX + ORAL_BERECHNET_COL_PX;

function OralRowBookmark() {
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

function formatOralDeDecimal(v, fractionDigits) {
  return v.toFixed(fractionDigits).replace('.', ',');
}

export default function OralView({ studentIdFilterSet = null }) {
  const { orals, updateOral, removeOral, updateOralGrade, updateOralCounted, updateOralWeekPoints, updateOralWeekGrade, updateOralWeekLabel, addOralWeekColumn, removeOralWeekColumn, students, addOral, config, courseArchived } = useData();
  const { showConfirm } = useDialog();

  const displayStudents = useMemo(() => {
    if (studentIdFilterSet == null) return students;
    return students.filter((s) => studentIdFilterSet.has(s.id));
  }, [students, studentIdFilterSet]);

  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const oralNumbers = Object.keys(orals).sort((a, b) => Number(a) - Number(b));
  const [activeOral, setActiveOral] = useState(oralNumbers.length > 0 ? oralNumbers[0] : null);
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [oralNoteEditingId, setOralNoteEditingId] = useState(null);
  const [oralNoteDraft, setOralNoteDraft] = useState('');
  const [oralFormulaModalOpen, setOralFormulaModalOpen] = useState(false);
  const [tableMaximized, setTableMaximized] = useState(false);
  const [oralIndexTooltip, setOralIndexTooltip] = useState(null);
  const [oralWeekLabelEditing, setOralWeekLabelEditing] = useState(null);
  const [oralWeekLabelDraft, setOralWeekLabelDraft] = useState('');
  const [oralWeekEditingKey, setOralWeekEditingKey] = useState(null);
  const [oralWeekDraft, setOralWeekDraft] = useState('');
  const [oralWeekGradeEditingKey, setOralWeekGradeEditingKey] = useState(null);
  const [oralWeekGradeDraft, setOralWeekGradeDraft] = useState('');

  /** Refs für manuelle „Note“-Felder — Tab springt direkt zur nächsten/vorherigen Zeile */
  const oralManualNoteRefs = useRef({});

  const focusOralManualNoteAt = useCallback(
    (index) => {
      if (index < 0 || index >= displayStudents.length) return;
      const id = displayStudents[index].id;
      oralManualNoteRefs.current[id]?.focus();
    },
    [displayStudents],
  );

  const handleOralManualNoteTab = useCallback(
    (e, rowIndex) => {
      const isTab = e.key === 'Tab';
      const isEnterNav = e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (!isTab && !isEnterNav) return;
      const reverse = isTab && e.shiftKey;
      const next = reverse ? rowIndex - 1 : rowIndex + 1;
      if (next < 0 || next >= displayStudents.length) return;
      e.preventDefault();
      requestAnimationFrame(() => focusOralManualNoteAt(next));
    },
    [displayStudents.length, focusOralManualNoteAt],
  );

  useLayoutEffect(() => {
    if (!oralWeekEditingKey) return;
    const sep = oralWeekEditingKey.lastIndexOf(':');
    if (sep < 0) return;
    const studentId = oralWeekEditingKey.slice(0, sep);
    const weekIndex = oralWeekEditingKey.slice(sep + 1);
    const el = document.querySelector(
      `[data-oral-week-input="${oralWeekInputDataAttr(activeOral, studentId, weekIndex)}"]`,
    );
    el?.select();
  }, [oralWeekEditingKey, activeOral]);

  const record = orals[activeOral];

  useEffect(() => {
    setExpandedStudentId(null);
    setOralNoteEditingId(null);
    setOralNoteDraft('');
    setTableMaximized(false);
    setOralIndexTooltip(null);
    setOralWeekLabelEditing(null);
    setOralWeekLabelDraft('');
    setOralWeekEditingKey(null);
    setOralWeekDraft('');
    setOralWeekGradeEditingKey(null);
    setOralWeekGradeDraft('');
  }, [activeOral]);

  useEffect(() => {
    if (!oralIndexTooltip) return undefined;
    const hide = () => setOralIndexTooltip(null);
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, { capture: true });
      window.removeEventListener('resize', hide);
    };
  }, [oralIndexTooltip]);

  useEffect(() => {
    if (!oralFormulaModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOralFormulaModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [oralFormulaModalOpen]);

  useEffect(() => {
    if (record && record.active === false) setOralFormulaModalOpen(false);
  }, [record?.active, record]);

  useEffect(() => {
    if (oralNumbers.length === 0) return;
    if (!orals[activeOral]) {
      setActiveOral(oralNumbers[0]);
    }
  }, [oralNumbers, activeOral, orals]);

  if (!record) {
    return (
      <div className="text-center mt-8 text-muted">
        Keine mündlichen Noten vorhanden. Bitte füge einen Bereich hinzu.
        <br />
        <button className="mt-4" onClick={async () => {
          const newNum = await addOral();
          if (newNum) setActiveOral(newNum.toString());
        }}>
          + Erste mündliche Note anlegen
        </button>
      </div>
    );
  }

  const oralIsActive = record.active !== false;

  const handleDeleteOral = async () => {
    const ok = await showConfirm(
      'Diese mündliche Note wirklich endgültig löschen? Alle eingetragenen Werte und Einstellungen zu diesem Bereich gehen verloren.',
      { title: 'Mündliche Note löschen', danger: true },
    );
    if (!ok) return;
    const id = activeOral;
    const remaining = oralNumbers.filter((n) => n !== id);
    const nextActive = remaining[0] ?? null;
    if (nextActive) setActiveOral(nextActive);
    await removeOral(id);
  };

  const toggleStudentRow = (studentId) => {
    setExpandedStudentId((prev) => (prev === studentId ? null : studentId));
  };

  const extendedMode = getOralExtendedMode(record);
  const isExtendedPointsMode = isOralExtendedPoints(record);
  const isExtendedGradesMode = isOralExtendedGrades(record);
  const isExtendedActive = isExtendedPointsMode || isExtendedGradesMode;
  const weekCount = record.weekCount || 0;
  const useAbiNotenpunkte = record.notenpunkteAbi === true;
  const extendedCalcFormatOpts = oralExtendedCalculatedFormatOpts(gradeSys, {
    useAbiNotenpunkte,
    extendedGradesMode: isExtendedGradesMode,
    extendedPointsMode: isExtendedPointsMode,
  });
  const bestNoteValue = normalizeOralBestNoteAlpha(record.bestNote);
  const worstNoteValue = normalizeOralWorstNote(record.worstNote ?? 6);
  const bestNoteValuePoints = normalizeOralBestNotePoints(record.bestNote);
  const worstNoteValuePoints = normalizeOralWorstNotePoints(record.worstNote);
  const weekSpreadValue = normalizeOralSpreadBeta(record.weekSpread);
  const weekTotals = displayStudents.map((st) => getOralTotalWeekPoints(record.grades[st.id], weekCount));
  const classWeekMin = weekTotals.length ? Math.min(...weekTotals) : 0;
  const classWeekMax = weekTotals.length ? Math.max(...weekTotals) : 0;
  const maxWeekSumAll = Math.max(1, classWeekMax);
  const detailColSpan = isExtendedPointsMode ? 5 + weekCount : isExtendedGradesMode ? 4 + weekCount : 3;

  const applyBerechnetToAllNotes = () => {
    if (!isExtendedActive || useAbiNotenpunkte) return;
    for (const s of displayStudents) {
      const gradeRaw = record.grades[s.id];
      const { counted } = getNormalizedOralGrade(gradeRaw);
      const calculatedGrade = isExtendedGradesMode
        ? computeOralExtendedGradesAverage(gradeRaw, weekCount, gradeSys, counted)
        : computeOralExtendedCalculatedGrade({
            studentSumWeekPoints: getOralTotalWeekPoints(gradeRaw, weekCount),
            weekCount,
            maxSumWeekPointsInClass: maxWeekSumAll,
            classMinWeekSum: classWeekMin,
            classMaxWeekSum: classWeekMax,
            bestNoteAlpha: record.bestNote,
            weekSpread: weekSpreadValue,
            worstNote: record.worstNote,
            counted,
            useAbiNotenpunkte,
            gradeSystem: gradeSys,
          });
      if (calculatedGrade !== null && counted) {
        if (gradeSys === 'points') {
          updateOralGrade(activeOral, s.id, String(Math.round(calculatedGrade)));
        } else {
          const q = roundOralNoteToQuarter(calculatedGrade);
          if (q !== null) updateOralGrade(activeOral, s.id, classicGradeToStoredString(q, gradeSys));
        }
      }
    }
  };

  return (
    <div className="view-page-scroll">
      <div className="view-toolbar-block oral-toolbar">
      <div className="flex justify-between items-center mb-4 pt-2 view-page-nav">
        <h2 style={{ margin: 0 }}>Mündliche Noten</h2>
        <div className="flex gap-2" style={{ overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
          {oralNumbers.map(num => (
            <button 
              key={num}
              className={`tab ${activeOral === num.toString() ? 'active' : 'secondary'}`}
              onClick={() => setActiveOral(num.toString())}
            >
              Mündlich {num}
            </button>
          ))}
          <button 
            className="tab secondary"
            onClick={async () => {
              const newNum = await addOral();
              if (newNum) setActiveOral(newNum.toString());
            }}
            title="Weitere mündliche Note hinzufügen"
            style={{ fontWeight: 'bold' }}
          >
            +
          </button>
        </div>
      </div>

      <div
        className="flex gap-4 flex-wrap oral-meta-panel course-meta-settings-row"
        style={{
          background: 'var(--surface)',
          padding: '1rem',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div className="course-meta-field">
          <span className="course-meta-field__label">Aktiv</span>
          <div className="course-meta-field__row">
            <label className="switch" title="Mündliche Noten eintragen und ins Gesamtergebnis einbeziehen">
              <input
                type="checkbox"
                checked={oralIsActive}
                disabled={courseArchived}
                onChange={(e) => updateOral(activeOral, 'active', e.target.checked)}
              />
              <span className="slider" />
            </label>
            {!oralIsActive && (
              <button
                type="button"
                className="tab secondary course-meta-inline-btn"
                onClick={handleDeleteOral}
                title="Mündlichen Bereich dauerhaft aus diesem Kurs entfernen"
              >
                Note löschen
              </button>
            )}
          </div>
        </div>
        {oralIsActive && (
          <>
        <div className="flex items-end gap-4 flex-wrap" style={{ flex: '0 1 auto' }}>
          <div className="course-meta-field">
            <label className="course-meta-field__label" htmlFor={`oral-date-${activeOral}`}>
              Datum
            </label>
            <input
              id={`oral-date-${activeOral}`}
              className="course-meta-control"
              type="date"
              value={record.date || ''}
              onChange={(e) => updateOral(activeOral, 'date', e.target.value)}
            />
          </div>
          {!config?.kursstufe && (
            <div className="course-meta-field">
              <label className="course-meta-field__label" htmlFor={`oral-hj-${activeOral}`}>
                Halbjahr
              </label>
              <select
                id={`oral-hj-${activeOral}`}
                className="course-meta-control"
                value={record.halbjahr || '1'}
                onChange={(e) => updateOral(activeOral, 'halbjahr', e.target.value)}
              >
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>
          )}
        </div>
        <div
          className="oral-extended-controls-rail"
          style={{
            marginLeft: 'auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.65rem 1rem',
            flex: '1 1 12rem',
            minWidth: 0,
            textAlign: 'right',
          }}
        >
          <div className="course-meta-field" style={{ alignItems: 'flex-end' }}>
            <span className="course-meta-field__label">{getOralExtendedModeLabel(extendedMode)}</span>
            <div className="course-meta-field__row" style={{ justifyContent: 'flex-end' }}>
              <OralExtendedModeSwitch
                mode={extendedMode}
                onChange={(next) => updateOral(activeOral, 'extendedMode', next)}
              />
            </div>
          </div>
          {isExtendedActive && (
            <div
              className="flex items-center flex-wrap oral-extended-controls-extended"
              style={{
                justifyContent: 'flex-end',
                width: '100%',
                columnGap: '1.125rem',
                rowGap: '0.65rem',
              }}
            >
              <div className="course-meta-field__row" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="tab secondary course-meta-inline-btn"
                  onClick={() => addOralWeekColumn(activeOral)}
                  disabled={weekCount >= ORAL_WEEK_COL_CAP}
                  title="Woche hinzufügen"
                  style={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Woche
                </button>
                <button
                  type="button"
                  className="tab secondary course-meta-inline-btn"
                  onClick={() => removeOralWeekColumn(activeOral)}
                  disabled={weekCount <= 0}
                  title="Letzte Woche entfernen"
                  style={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  - Woche
                </button>
              </div>
              {isExtendedGradesMode ? (
                <div className="course-meta-field__row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="tab secondary course-meta-inline-btn"
                    onClick={() => setOralFormulaModalOpen(true)}
                    title="Berechnungsvorschrift und Erläuterungen"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Info
                  </button>
                </div>
              ) : null}
              {isExtendedPointsMode ? (
                <>
              <div className="course-meta-field__row" style={{ flexWrap: 'nowrap' }}>
                <span className="course-meta-field__label" style={{ whiteSpace: 'nowrap' }}>
                  {gradeSys === 'points' ? 'Beste NP' : 'Beste Note'}
                </span>
                {gradeSys === 'points' ? (
                  <select
                    className="course-meta-control"
                    value={String(bestNoteValuePoints)}
                    onChange={(e) => updateOral(activeOral, 'bestNote', parseInt(e.target.value, 10))}
                    style={{
                      width: 'calc(4.85rem + 1px)',
                      minWidth: 'calc(4.85rem + 1px)',
                      maxWidth: 'calc(4.85rem + 1px)',
                      textAlign: 'left',
                    }}
                    title="Notenpunkte für die beste Klassensumme (Wochenpunkte)"
                  >
                    {ORAL_POINTS_BEST_OPTIONS.map((v) => (
                      <option key={v} value={String(v)}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className="course-meta-control"
                    value={String(bestNoteValue)}
                    onChange={(e) => updateOral(activeOral, 'bestNote', parseFloat(e.target.value, 10))}
                    style={{
                      width: 'calc(4.85rem + 1px)',
                      minWidth: 'calc(4.85rem + 1px)',
                      maxWidth: 'calc(4.85rem + 1px)',
                      textAlign: 'left',
                    }}
                  >
                    {ORAL_BEST_NOTE_ALPHA_OPTIONS.map((v) => (
                      <option key={v} value={String(v)}>
                        {formatOralDeDecimal(v, 2)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="course-meta-field__row" style={{ flexWrap: 'nowrap' }}>
                <span className="course-meta-field__label" style={{ whiteSpace: 'nowrap' }}>
                  {gradeSys === 'points' ? 'Schlechteste NP' : 'Schlechteste Note'}
                </span>
                {gradeSys === 'points' ? (
                  <select
                    className="course-meta-control"
                    value={String(worstNoteValuePoints)}
                    onChange={(e) => updateOral(activeOral, 'worstNote', parseInt(e.target.value, 10))}
                    style={{
                      width: 'calc(4.85rem + 8px)',
                      minWidth: 'calc(4.85rem + 8px)',
                      maxWidth: 'calc(4.85rem + 8px)',
                      textAlign: 'left',
                    }}
                    title="Notenpunkte für die schlechteste Klassensumme (Wochenpunkte)"
                  >
                    {ORAL_POINTS_WORST_OPTIONS.map((v) => (
                      <option key={v} value={String(v)}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className="course-meta-control"
                    value={String(worstNoteValue)}
                    onChange={(e) => updateOral(activeOral, 'worstNote', parseFloat(e.target.value, 10))}
                    style={{
                      width: 'calc(4.85rem + 8px)',
                      minWidth: 'calc(4.85rem + 8px)',
                      maxWidth: 'calc(4.85rem + 8px)',
                      textAlign: 'left',
                    }}
                    title="Obergrenze der berechneten Note (4,00 … 6,00 in 0,25-Schritten)"
                  >
                    {ORAL_WORST_NOTE_OPTIONS.map((v) => (
                      <option key={v} value={String(v)}>
                        {formatOralDeDecimal(v, 2)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="course-meta-field__row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <span className="course-meta-field__label" style={{ whiteSpace: 'nowrap' }}>
                  Streuung
                </span>
                <select
                  className="course-meta-control"
                  value={String(weekSpreadValue)}
                  onChange={(e) => updateOral(activeOral, 'weekSpread', normalizeOralSpreadBeta(e.target.value))}
                  style={{
                    width: 'calc(4.85rem + 1px)',
                    minWidth: 'calc(4.85rem + 1px)',
                    maxWidth: 'calc(4.85rem + 1px)',
                    textAlign: 'left',
                  }}
                  title="Wert zwischen 0 und 1 (Schritt 0,1)"
                >
                  {Array.from({ length: 11 }, (_, i) => {
                    const v = i / 10;
                    return (
                      <option key={v} value={String(v)}>
                        {formatOralDeDecimal(v, 1)}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  className="tab secondary course-meta-inline-btn"
                  onClick={() => setOralFormulaModalOpen(true)}
                  title="Berechnungsvorschrift und Erläuterungen"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Info
                </button>
              </div>
                </>
              ) : null}
            </div>
          )}
        </div>
        <div className="course-meta-field projects-meta-maximize-field">
          <span className="course-meta-field__label" aria-hidden="true">
            &nbsp;
          </span>
          <div className="course-meta-field__row">
            <TableMaximizeToggle
              maximized={tableMaximized}
              onClick={() => setTableMaximized((m) => !m)}
            />
          </div>
        </div>
          </>
        )}
      </div>
      </div>

      {oralIsActive ? (
      <div className="view-table-scroll oral-table-scroll">
        <MaximizableTableSection
          title="Mündliche Noten"
          maximized={tableMaximized}
          onMaximizedChange={setTableMaximized}
          embeddedToggle
        >
        <div className="table-container">
        <table>
          <thead>
            <tr>
              <th
                className="oral-th-sticky-left"
                style={{
                  position: 'sticky',
                  left: 0,
                  width: `${ORAL_INDEX_COL_PX}px`,
                  minWidth: `${ORAL_INDEX_COL_PX}px`,
                  textAlign: 'center',
                }}
              >
                #
              </th>
              <th
                className="oral-th-sticky-left"
                style={{
                  position: 'sticky',
                  left: `${ORAL_INDEX_COL_PX}px`,
                  width: `${ORAL_NAME_COL_PX}px`,
                  minWidth: `${ORAL_NAME_COL_PX}px`,
                  maxWidth: `${ORAL_NAME_COL_PX}px`,
                }}
              >
                Name
              </th>
              {isExtendedActive && (
                <>
                  {Array.from({ length: weekCount }, (_, wi) => {
                    const label = getOralWeekColumnLabel(record.weekDates, wi);
                    return (
                      <th key={wi} className="text-center" style={{ minWidth: '100px', verticalAlign: 'bottom' }}>
                        <input
                          type="text"
                          className="oral-week-label-input"
                          aria-label={`Bezeichnung Woche ${wi + 1}`}
                          value={oralWeekLabelEditing === wi ? oralWeekLabelDraft : label}
                          onFocus={() => {
                            setOralWeekLabelEditing(wi);
                            setOralWeekLabelDraft(label);
                          }}
                          onChange={(e) => {
                            if (oralWeekLabelEditing !== wi) return;
                            setOralWeekLabelDraft(e.target.value);
                          }}
                          onBlur={() => {
                            if (oralWeekLabelEditing !== wi) return;
                            updateOralWeekLabel(activeOral, wi, oralWeekLabelDraft.trim());
                            setOralWeekLabelEditing(null);
                            setOralWeekLabelDraft('');
                          }}
                          style={{
                            width: '100%',
                            minWidth: '4.5rem',
                            maxWidth: '7.5rem',
                            textAlign: 'center',
                            fontWeight: 600,
                            fontSize: 'inherit',
                            padding: '0.2rem 0.35rem',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            background: 'var(--surface)',
                          }}
                        />
                      </th>
                    );
                  })}
                  {isExtendedPointsMode ? (
                  <th
                    className="oral-th-sticky-right oral-gesamt-col text-center"
                    title="Gesamtpunktzahl (alle Wochen)"
                    style={{
                      position: 'sticky',
                      right: `${ORAL_RIGHT_STICKY_OFFSET}px`,
                      width: `${ORAL_GESAMT_COL_PX}px`,
                      minWidth: `${ORAL_GESAMT_COL_PX}px`,
                      borderRight: '1px solid var(--border)',
                    }}
                  >
                    Gesamt
                  </th>
                  ) : null}
                  <th
                    className="oral-th-sticky-right text-center"
                    title={
                      isExtendedGradesMode
                        ? 'Arithmetischer Mittelwert der Wochennoten'
                        : useAbiNotenpunkte
                        ? 'Abitur-Notenpunkte nach Vorlage PA: 15·H^β mit H = Summe/(max. Summe in der Klasse·BY(α))'
                        : gradeSys === 'points'
                          ? 'Notenpunkte aus Wochensummen: Normierung über Min/Max der Klasse; beste/schlechteste NP und Streuung wie eingestellt'
                          : 'Note aus Wochenpunkten: Min/Max = kleinste bzw. größte Summe in der Klasse; q, t, Formel wie eingestellt, gerundet auf ¼'
                    }
                    style={{
                      position: 'sticky',
                      right: `${ORAL_NOTE_COL_PX}px`,
                      width: `${ORAL_BERECHNET_COL_PX}px`,
                      minWidth: `${ORAL_BERECHNET_COL_PX}px`,
                      borderRight: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>Berechnet</span>
                      {!useAbiNotenpunkte && (
                        <button
                          type="button"
                          className="tab secondary"
                          title={
                            isExtendedGradesMode
                              ? 'Für alle Schüler: berechneten Mittelwert in „Note“ übernehmen'
                              : gradeSys === 'points'
                              ? 'Für alle Schüler: berechnete Notenpunkte in „Note“ übernehmen'
                              : 'Für alle Schüler: gerundete Endnote (¼) in „Note“ übernehmen'
                          }
                          aria-label="Berechnete Note für alle Schüler in die Note-Spalte übernehmen"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyBerechnetToAllNotes();
                          }}
                          style={{
                            padding: '0.08rem 0.4rem',
                            minWidth: 'auto',
                            lineHeight: 1.1,
                            fontSize: '0.95rem',
                            fontWeight: 700,
                          }}
                        >
                          →
                        </button>
                      )}
                    </div>
                  </th>
                </>
              )}
              <th
                className="oral-th-sticky-right oral-note-col text-center"
                style={{
                  position: 'sticky',
                  right: 0,
                  width: `${ORAL_NOTE_COL_PX}px`,
                  minWidth: `${ORAL_NOTE_COL_PX}px`,
                }}
              >
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {displayStudents.length === 0 && students.length > 0 && (
              <tr>
                <td colSpan={99} className="text-center text-muted" style={{ padding: '2rem' }}>
                  Kein Schüler entspricht der Suche.
                </td>
              </tr>
            )}
            {displayStudents.map((s, idx) => {
              const gradeRaw = record.grades[s.id];
              const { value: gradeInput, counted } = getNormalizedOralGrade(gradeRaw);
              const weekPointsArr = getNormalizedOralWeekPointsArray(gradeRaw, weekCount);
              const weekGradesArr = getNormalizedOralWeekGradesArray(gradeRaw, weekCount);
              const totalWeekPts = getOralTotalWeekPoints(gradeRaw, weekCount);
              const calculatedGrade = isExtendedGradesMode
                ? computeOralExtendedGradesAverage(gradeRaw, weekCount, gradeSys, counted)
                : isExtendedPointsMode
                  ? computeOralExtendedCalculatedGrade({
                      studentSumWeekPoints: totalWeekPts,
                      weekCount,
                      maxSumWeekPointsInClass: maxWeekSumAll,
                      classMinWeekSum: classWeekMin,
                      classMaxWeekSum: classWeekMax,
                      bestNoteAlpha: record.bestNote,
                      weekSpread: weekSpreadValue,
                      worstNote: record.worstNote,
                      counted,
                      useAbiNotenpunkte,
                      gradeSystem: gradeSys,
                    })
                  : null;
              const manualNoteColorResolved =
                counted ? resolveStoredGradeForCellColor(String(gradeInput ?? ''), gradeSys) : null;
              const manualNoteCellColors = gradeCellColorsFromResolved(manualNoteColorResolved, gradeSys);
              const calcColorResolved = (() => {
                if (calculatedGrade === null) return null;
                if (useAbiNotenpunkte) {
                  return { value: calculatedGrade, opts: { inputScale: 'notenpunkte' } };
                }
                if (gradeSys === 'points' && (isExtendedPointsMode || isExtendedGradesMode)) {
                  return { value: calculatedGrade, opts: { inputScale: 'notenpunkte' } };
                }
                if (gradeSys === 'points') {
                  return { value: calculatedGrade, opts: { inputScale: 'notenpunkte' } };
                }
                return { value: calculatedGrade, opts: undefined };
              })();
              const calcCellColors = gradeCellColorsFromResolved(calcColorResolved, gradeSys);
              const calcRed =
                calculatedGrade !== null &&
                (useAbiNotenpunkte
                  ? calculatedGrade < 5
                  : isGradeWorseThan4(calcColorResolved?.value ?? null, gradeSys, calcColorResolved?.opts));
              const isExpanded = expandedStudentId === s.id;
              const showNotCountedFlag = !counted;

              return (
                <React.Fragment key={s.id}>
                  <tr style={{ transition: 'background 0.2s', background: isExpanded ? 'rgba(79, 70, 229, 0.05)' : '' }}>
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        width: `${ORAL_INDEX_COL_PX}px`,
                        minWidth: `${ORAL_INDEX_COL_PX}px`,
                        verticalAlign: 'middle',
                        textAlign: 'center',
                        background: 'var(--surface)',
                        borderRight: '1px solid var(--border)',
                        boxShadow: '2px 0 6px rgba(0, 0, 0, 0.04)',
                        padding: 0,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: showNotCountedFlag ? 34 : undefined,
                          paddingTop: showNotCountedFlag ? 2 : 0,
                        }}
                      >
                        {showNotCountedFlag && (
                          <span
                            className="exam-index-flag"
                            role="img"
                            aria-label="Mündlich werten aus"
                            onMouseEnter={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              const pad = 12;
                              const cx = r.left + r.width / 2;
                              setOralIndexTooltip({
                                text: 'Mündlich werten aus',
                                left: Math.min(window.innerWidth - pad, Math.max(pad, cx)),
                                top: r.bottom + 8,
                              });
                            }}
                            onMouseLeave={() => setOralIndexTooltip(null)}
                          >
                            <OralRowBookmark />
                          </span>
                        )}
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</span>
                      </div>
                    </td>
                    <td
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleStudentRow(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleStudentRow(s.id);
                        }
                      }}
                      style={{
                        position: 'sticky',
                        left: `${ORAL_INDEX_COL_PX}px`,
                        zIndex: 2,
                        width: `${ORAL_NAME_COL_PX}px`,
                        minWidth: `${ORAL_NAME_COL_PX}px`,
                        maxWidth: `${ORAL_NAME_COL_PX}px`,
                        cursor: 'pointer',
                        background: 'var(--surface)',
                        borderRight: '1px solid var(--border)',
                        boxShadow: '2px 0 6px rgba(0, 0, 0, 0.04)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title="Klicken für Mündlich werten"
                    >
                      {s.lastName}, {s.firstName}
                    </td>
                    {isExtendedActive && (
                      <>
                        {isExtendedGradesMode
                          ? weekGradesArr.map((wg, wi) => {
                              const weekEditKey = `${s.id}:${wi}`;
                              const isWeekEditing = oralWeekGradeEditingKey === weekEditKey;
                              const weekGradeColorResolved =
                                String(wg ?? '').trim() !== ''
                                  ? resolveStoredGradeForCellColor(String(wg), gradeSys)
                                  : null;
                              const weekGradeCellColors = gradeCellColorsFromResolved(weekGradeColorResolved, gradeSys);
                              const displayVal = (() => {
                                if (isWeekEditing) return oralWeekGradeDraft;
                                return formatStoredOralWeekGradeDisplay(wg, gradeSys);
                              })();
                              return (
                                <td
                                  key={wi}
                                  className="text-center"
                                  style={{
                                    verticalAlign: 'middle',
                                    background: weekGradeColorResolved
                                      ? (weekGradeCellColors.background ?? 'var(--surface)')
                                      : undefined,
                                  }}
                                >
                                  <input
                                    type="text"
                                    inputMode={gradeSys === 'points' ? 'numeric' : 'decimal'}
                                    lang="en"
                                    autoComplete="off"
                                    placeholder="-"
                                    data-oral-week-input={oralWeekInputDataAttr(activeOral, s.id, wi)}
                                    aria-label={`${getOralWeekColumnLabel(record.weekDates, wi)}, ${s.lastName}, ${s.firstName}`}
                                    value={displayVal}
                                    onFocus={() => {
                                      setOralWeekGradeEditingKey(weekEditKey);
                                      if (gradeSys === 'points') {
                                        setOralWeekGradeDraft(String(wg ?? '').trim());
                                      } else {
                                        setOralWeekGradeDraft(String(wg ?? '').replace(',', '.'));
                                      }
                                    }}
                                    onChange={(e) => {
                                      if (!isWeekEditing) return;
                                      setOralWeekGradeDraft(e.target.value);
                                    }}
                                    onKeyDown={createOralWeekTabHandler({
                                      oralId: activeOral,
                                      rowIndex: idx,
                                      weekIndex: wi,
                                      displayStudents,
                                    })}
                                    onBlur={() => {
                                      if (!isWeekEditing) return;
                                      const t = oralWeekGradeDraft.trim().replace(',', '.');
                                      if (t === '') {
                                        updateOralWeekGrade(activeOral, s.id, wi, '');
                                      } else if (gradeSys === 'points') {
                                        const np = Math.round(parseFloat(t));
                                        if (Number.isFinite(np) && np >= 0 && np <= 15) {
                                          updateOralWeekGrade(activeOral, s.id, wi, String(np));
                                        }
                                      } else {
                                        const n = parseFloat(t);
                                        if (!Number.isNaN(n)) {
                                          updateOralWeekGrade(activeOral, s.id, wi, n.toFixed(2));
                                        }
                                      }
                                      setOralWeekGradeEditingKey(null);
                                      setOralWeekGradeDraft('');
                                    }}
                                    style={{
                                      textAlign: 'center',
                                      width: '4.5rem',
                                      minWidth: '4.5rem',
                                      maxWidth: '100%',
                                      padding: '0.35rem 0.25rem',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border)',
                                      fontVariantNumeric: 'tabular-nums',
                                      color: weekGradeColorResolved
                                        ? weekGradeCellColors.color
                                        : 'var(--foreground)',
                                      background: 'transparent',
                                    }}
                                  />
                                </td>
                              );
                            })
                          : weekPointsArr.map((wp, wi) => {
                          const weekEditKey = `${s.id}:${wi}`;
                          const isWeekEditing = oralWeekEditingKey === weekEditKey;
                          return (
                          <td key={wi} className="text-center" style={{ verticalAlign: 'middle' }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              data-oral-week-input={oralWeekInputDataAttr(activeOral, s.id, wi)}
                              aria-label={`${getOralWeekColumnLabel(record.weekDates, wi)}, ${s.lastName}, ${s.firstName}`}
                              value={isWeekEditing ? oralWeekDraft : formatOralWeekPointDisplay(wp)}
                              onFocus={() => {
                                setOralWeekEditingKey(weekEditKey);
                                setOralWeekDraft(String(wp));
                              }}
                              onChange={(e) => {
                                if (!isWeekEditing) return;
                                setOralWeekDraft(e.target.value);
                              }}
                              onKeyDown={createOralWeekTabHandler({
                                oralId: activeOral,
                                rowIndex: idx,
                                weekIndex: wi,
                                displayStudents,
                              })}
                              onBlur={() => {
                                if (!isWeekEditing) return;
                                const t = oralWeekDraft.trim().replace(/^\+/, '');
                                if (t === '') {
                                  updateOralWeekPoints(activeOral, s.id, wi, '0');
                                } else {
                                  const n = parseInt(t, 10);
                                  if (Number.isFinite(n)) {
                                    updateOralWeekPoints(activeOral, s.id, wi, String(n));
                                  }
                                }
                                setOralWeekEditingKey(null);
                                setOralWeekDraft('');
                              }}
                              style={{
                                textAlign: 'center',
                                width: '4rem',
                                minWidth: '4rem',
                                maxWidth: '100%',
                                padding: '0.35rem 0.25rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            />
                          </td>
                          );
                        })}
                        {isExtendedPointsMode ? (
                        <td
                          className="text-center oral-gesamt-col"
                          style={{
                            position: 'sticky',
                            right: `${ORAL_RIGHT_STICKY_OFFSET}px`,
                            zIndex: 2,
                            width: `${ORAL_GESAMT_COL_PX}px`,
                            minWidth: `${ORAL_GESAMT_COL_PX}px`,
                            verticalAlign: 'middle',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            background: 'var(--surface)',
                            borderLeft: '1px solid var(--border)',
                            borderRight: '1px solid var(--border)',
                            boxShadow: '-2px 0 6px rgba(0, 0, 0, 0.04)',
                          }}
                          title="Gesamtpunktzahl"
                        >
                          {totalWeekPts > 0 ? `+${totalWeekPts}` : String(totalWeekPts)}
                        </td>
                        ) : null}
                        <td
                          className="text-center"
                          style={{
                            position: 'sticky',
                            right: `${ORAL_NOTE_COL_PX}px`,
                            zIndex: 2,
                            width: `${ORAL_BERECHNET_COL_PX}px`,
                            minWidth: `${ORAL_BERECHNET_COL_PX}px`,
                            verticalAlign: 'middle',
                            fontWeight: 'bold',
                            fontVariantNumeric: 'tabular-nums',
                            background: calcColorResolved ? (calcCellColors.background ?? 'var(--surface)') : 'var(--surface)',
                            borderLeft: '1px solid var(--border)',
                            borderRight: '1px solid var(--border)',
                            boxShadow: '-2px 0 6px rgba(0, 0, 0, 0.04)',
                            color: useAbiNotenpunkte && calcRed ? 'var(--danger)' : calcCellColors.color,
                          }}
                          title={
                            isExtendedGradesMode
                              ? 'Mittelwert der eingetragenen Wochennoten'
                              : useAbiNotenpunkte
                              ? 'Abitur-Notenpunkte (Vorlage PA): 15·H^β'
                              : gradeSys === 'points'
                                ? 'Berechnete Notenpunkte: Normierung über Min/Max der Klasse, Streuung wie eingestellt'
                                : 'Berechnete Note: Normierung über Min/Max der Klassensummen, t^(1+Streuung), ¼-Schritte'
                          }
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              flexWrap: 'nowrap',
                            }}
                          >
                            <span>
                              {calculatedGrade !== null
                                ? formatGrade(calculatedGrade, gradeSys, extendedCalcFormatOpts)
                                : '—'}
                            </span>
                            {calculatedGrade !== null && counted && !useAbiNotenpunkte && (
                              <button
                                type="button"
                                className="tab secondary"
                                title={
                                  isExtendedGradesMode
                                    ? 'Berechneten Mittelwert in „Note“ übernehmen'
                                    : gradeSys === 'points'
                                    ? 'Berechnete Notenpunkte in „Note“ übernehmen'
                                    : 'Gerundete Endnote (¼) in „Note“ übernehmen'
                                }
                                aria-label="Berechnete Note in Note-Spalte übernehmen"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (gradeSys === 'points') {
                                    updateOralGrade(activeOral, s.id, String(Math.round(calculatedGrade)));
                                  } else {
                                    const q = roundOralNoteToQuarter(calculatedGrade);
                                    if (q === null) return;
                                    updateOralGrade(activeOral, s.id, classicGradeToStoredString(q, gradeSys));
                                  }
                                }}
                                style={{
                                  padding: '0.08rem 0.4rem',
                                  minWidth: 'auto',
                                  lineHeight: 1.1,
                                  fontSize: '0.95rem',
                                  fontWeight: 700,
                                }}
                              >
                                →
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                    <td
                      className="text-center oral-note-col"
                      style={{
                        position: 'sticky',
                        right: 0,
                        zIndex: 2,
                        width: `${ORAL_NOTE_COL_PX}px`,
                        minWidth: `${ORAL_NOTE_COL_PX}px`,
                        verticalAlign: 'middle',
                        background: manualNoteColorResolved
                          ? (manualNoteCellColors.background ?? 'var(--surface)')
                          : 'var(--surface)',
                        borderLeft: '1px solid var(--border)',
                        boxShadow: '-2px 0 6px rgba(0, 0, 0, 0.04)',
                      }}
                    >
                      <input
                        ref={(el) => {
                          if (el) oralManualNoteRefs.current[s.id] = el;
                          else delete oralManualNoteRefs.current[s.id];
                        }}
                        type="text"
                        inputMode={gradeSys === 'points' ? 'numeric' : 'decimal'}
                        lang="en"
                        autoComplete="off"
                        aria-label={`Note (manuell), ${s.lastName}, ${s.firstName}`}
                        value={
                          oralNoteEditingId === s.id
                            ? oralNoteDraft
                            : (() => {
                                if (gradeInput === '' || gradeInput === undefined || gradeInput === null) return '';
                                return formatStoredOralWeekGradeDisplay(gradeInput, gradeSys);
                              })()
                        }
                        onFocus={() => {
                          setOralNoteEditingId(s.id);
                          if (gradeSys === 'points') {
                            setOralNoteDraft(String(gradeInput ?? '').trim());
                          } else {
                            setOralNoteDraft(String(gradeInput ?? '').replace(',', '.'));
                          }
                        }}
                        onChange={(e) => {
                          if (oralNoteEditingId !== s.id) return;
                          setOralNoteDraft(e.target.value);
                        }}
                        onKeyDown={(e) => handleOralManualNoteTab(e, idx)}
                        onBlur={() => {
                          if (oralNoteEditingId !== s.id) return;
                          const t = oralNoteDraft.trim().replace(',', '.');
                          if (t === '') {
                            updateOralGrade(activeOral, s.id, '');
                          } else if (gradeSys === 'points') {
                            const np = Math.round(parseFloat(t));
                            if (!Number.isFinite(np) || np < 0 || np > 15) {
                              /* ungültig — gespeicherter Wert bleibt */
                            } else {
                              updateOralGrade(activeOral, s.id, String(np));
                            }
                          } else {
                            const n = parseFloat(t);
                            if (!Number.isNaN(n)) {
                              updateOralGrade(activeOral, s.id, n.toFixed(2));
                            }
                          }
                          setOralNoteEditingId(null);
                          setOralNoteDraft('');
                        }}
                        placeholder="-"
                        style={{
                          fontWeight: 'bold',
                          color: manualNoteColorResolved ? manualNoteCellColors.color : 'var(--foreground)',
                          background: 'transparent',
                          border: '1px solid transparent',
                          width: '5.25rem',
                          maxWidth: '100%',
                          textAlign: 'center',
                          margin: '0 auto',
                          display: 'block',
                        }}
                      />
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
                          <span className="text-muted" style={{ fontSize: '0.875rem' }}>Mündlich werten:</span>
                          <label className="switch switch--table-row" title="In Gesamtergebnis einbeziehen">
                            <input
                              type="checkbox"
                              checked={counted}
                              disabled={courseArchived}
                              onChange={e => updateOralCounted(activeOral, s.id, e.target.checked)}
                              aria-label="Mündlich werten"
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
      ) : (
        <div className="text-muted mt-8" style={{ textAlign: 'center' }}>
          Diese mündliche Note ist derzeit deaktiviert. Setze den Haken bei „Aktiv“, um Noten einzutragen.
        </div>
      )}

      {oralFormulaModalOpen && oralIsActive &&
        createPortal(
          <div
            className="oral-formula-modal-backdrop"
            role="presentation"
            onClick={() => setOralFormulaModalOpen(false)}
          >
            <div
              className="oral-formula-modal-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="oral-formula-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="oral-formula-modal-header">
                <h2 id="oral-formula-modal-title" style={{ margin: 0, fontSize: '1.05rem' }}>
                  Berechnungsvorschrift
                </h2>
                <button type="button" className="tab secondary" onClick={() => setOralFormulaModalOpen(false)}>
                  Schließen
                </button>
              </div>
              <div className="oral-formula-modal-body text-muted" style={{ fontSize: '0.875rem', lineHeight: 1.55 }}>
                {isExtendedGradesMode ? (
                  gradeSys === 'points' ? (
                    <>
                      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-main)' }}>
                        Im Modus <strong>Erweitert: Noten</strong> trägst du pro Woche{' '}
                        <strong>Notenpunkte (0–15)</strong> ein. Leere Wochen werden bei der Berechnung nicht
                        berücksichtigt.
                      </p>
                      <ol style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem' }}>
                        <li style={{ marginBottom: '0.5rem' }}>
                          Pro Woche eine Note <strong>NP<sub>i</sub></strong> (ganze Zahl 0 … 15), leere Felder zählen
                          nicht.
                        </li>
                        <li style={{ marginBottom: '0.5rem' }}>
                          <strong>Berechnet</strong> = arithmetischer Mittelwert aller eingetragenen Wochennoten:{' '}
                          <strong>(NP<sub>1</sub> + … + NP<sub>n</sub>) / n</strong>, anschließend{' '}
                          <strong>Rundung auf ganze Notenpunkte</strong>.
                        </li>
                        <li>
                          Die Spalte <strong>„Note“</strong> bleibt die manuelle Endnote; der Pfeil übernimmt den
                          berechneten Mittelwert (gerundet).
                        </li>
                      </ol>
                      <p style={{ margin: 0 }}>
                        Die Hintergrundfarben der Notenfelder folgen der Notenpunkte-Skala (grün ab 8, gelb 5–7 wie
                        klassisch 3,25–4, rot 0–4).
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-main)' }}>
                        Im Modus <strong>Erweitert: Noten</strong> trägst du pro Woche{' '}
                        <strong>klassische Noten</strong> (1,0–6,0, Viertelnoten möglich) ein. Leere Wochen werden bei
                        der Berechnung nicht berücksichtigt.
                      </p>
                      <ol style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem' }}>
                        <li style={{ marginBottom: '0.5rem' }}>
                          Pro Woche eine Note <strong>N<sub>i</sub></strong> (1,0 … 6,0), leere Felder zählen nicht.
                        </li>
                        <li style={{ marginBottom: '0.5rem' }}>
                          <strong>Berechnet</strong> = arithmetischer Mittelwert aller eingetragenen Wochennoten:{' '}
                          <strong>(N<sub>1</sub> + … + N<sub>n</sub>) / n</strong> (ohne zusätzliche Rundung in der
                          Anzeige).
                        </li>
                        <li>
                          Die Spalte <strong>„Note“</strong> bleibt die manuelle Endnote; der Pfeil übernimmt den
                          Mittelwert <strong>gerundet auf Viertelnoten</strong>.
                        </li>
                      </ol>
                      <p style={{ margin: 0 }}>
                        Die Hintergrundfarben der Notenfelder folgen der klassischen Notenskala (grün bis 2, gelb 3–4,
                        rot ab 4,5).
                      </p>
                    </>
                  )
                ) : useAbiNotenpunkte ? (
                  <>
                    <p style={{ margin: '0 0 0.75rem', color: 'var(--text-main)' }}>
                      Es gilt die <strong>Abitur-Notenpunkte</strong>-Skala (Vorlage PA, erweiterter Modus).
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>I</strong> = Summe der Wochenpunkte des Schülers (je Woche beliebige ganze Zahl).
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>F</strong> = größte Summe <strong>I</strong> in der Klasse (mindestens 1).
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>BY(α)</strong> = Faktor aus der gewählten „Besten Note“ α (wie in der Vorlage).
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>H</strong> = I / (F · BY), auf den Bereich 0 … 1 begrenzt.
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>Streuung</strong> entspricht dem Exponenten <strong>β</strong> in der Potenz.
                      </li>
                      <li>
                        Angezeigter Wert: <strong>G = 15 · H<sup>β</sup></strong> (Notenpunkte, 0 … 15).
                      </li>
                    </ul>
                  </>
                ) : gradeSys === 'points' ? (
                  <>
                    <p style={{ margin: '0 0 0.75rem', color: 'var(--text-main)' }}>
                      Im <strong>Punktesystem</strong> mappt die Spalte <strong>„Berechnet“</strong> die Wochensummen auf{' '}
                      <strong>Notenpunkte (0–15)</strong> mit <strong>Beste NP</strong> (11–15), <strong>Schlechteste NP</strong> (0–5) und{' '}
                      <strong>Streuung</strong> (0 … 1).
                    </p>
                    <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>I</strong> = Summe der Wochenpunkte (beliebige ganze Zahl pro Woche).
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>P<sub>min</sub></strong> / <strong>P<sub>max</sub></strong> = kleinste bzw. größte Summe <strong>I</strong> in der Klasse.
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>q = (I − P<sub>min</sub>) / (P<sub>max</sub> − P<sub>min</sub>)</strong> (0 … 1),{' '}
                        <strong>t = 1 − q</strong> (hohe Summe → kleines <strong>t</strong> → hohe NP).
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        NP-Rohwert:{' '}
                        <strong>
                          Beste NP + (Schlechteste NP − Beste NP) · t<sup>(1 + Streuung)</sup>
                        </strong>
                        , anschließend <strong>Rundung auf ganze Notenpunkte</strong> und Begrenzung auf 0 … 15.
                      </li>
                      <li>
                        Wenn <strong>P<sub>max</sub> = P<sub>min</sub></strong>, wird der Mittelwert aus bester und schlechtester NP (gerundet)
                        verwendet.
                      </li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p style={{ margin: '0 0 0.75rem', color: 'var(--text-main)' }}>
                      Die Spalte <strong>„Berechnet“</strong> verwendet die gewählte <strong>Beste Note</strong>,{' '}
                      <strong>Schlechteste Note</strong> und <strong>Streuung</strong> (0 … 1).
                    </p>
                    <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      <li style={{ marginBottom: '0.5rem' }}>
                        <strong>I</strong> = Summe der Wochenpunkte (beliebige ganze Zahl pro Woche).
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        Über alle Schüler: <strong>P<sub>min</sub></strong> = kleinste Summe <strong>I</strong>,{' '}
                        <strong>P<sub>max</sub></strong> = größte Summe <strong>I</strong>. Damit hat mindestens ein Schüler die beste
                        und mindestens einer die schlechteste Ausgangslage auf der Punktskala.
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        Normierung: <strong>q = (I − P<sub>min</sub>) / (P<sub>max</sub> − P<sub>min</sub>)</strong>, Wert auf 0 … 1
                        begrenzt (<strong>0</strong> = schlechteste Klasse, <strong>1</strong> = beste Klasse).
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        Umkehr für die Note: <strong>t = 1 − q</strong> (viele Punkte → kleines <strong>t</strong> → gute Note).
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        Rohnote:{' '}
                        <strong>
                          Beste Note + (Schlechteste Note − Beste Note) · t<sup>(1 + Streuung)</sup>
                        </strong>
                        . Mit <strong>Streuung = 0</strong> ist der Verlauf in <strong>t</strong> linear; mit größerer Streuung wird
                        die Kurve stärker gekrümmt (Enden betont).
                      </li>
                      <li style={{ marginBottom: '0.5rem' }}>
                        Anschließend Rundung auf <strong>Viertelnoten</strong>:{' '}
                        <code style={{ fontSize: '0.82em' }}>Math.round(Note · 4) / 4</code>, dann auf den Bereich{' '}
                        <strong>1,00 … 6,00</strong> begrenzt.
                      </li>
                      <li>
                        Wenn alle Schüler dieselbe Summe <strong>I</strong> haben, ist <strong>P<sub>max</sub> = P<sub>min</sub></strong>
                        : dann wird die Note aus dem <strong>Mittelwert</strong> aus bester und schlechtester Note (¼-gerundet) gesetzt.
                      </li>
                    </ol>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
      {oralIndexTooltip
        ? createPortal(
            <div
              className="exam-index-tooltip-portal"
              role="tooltip"
              style={{
                position: 'fixed',
                left: oralIndexTooltip.left,
                top: oralIndexTooltip.top,
                transform: 'translate(-50%, 0)',
                zIndex: 10050,
              }}
            >
              {oralIndexTooltip.text}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
