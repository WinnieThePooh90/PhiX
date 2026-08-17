import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../store/DataContext';
import { useDialog } from '../components/PhixDialog';
import { FileSpreadsheet, Grid, RotateCcw, Users, Armchair, Maximize2, Minimize2 } from 'lucide-react';
import MaximizableTableSection from '../components/MaximizableTableSection';

const PRESET_LAYOUTS = [
  { label: '8 × 3 (24 Plätze)', rows: 8, cols: 3 },
  { label: '4 × 3 (12 Plätze)', rows: 4, cols: 3 },
  { label: '4 × 4 (16 Plätze)', rows: 4, cols: 4 },
  { label: '5 × 4 (20 Plätze)', rows: 5, cols: 4 },
  { label: '5 × 5 (25 Plätze)', rows: 5, cols: 5 },
  { label: '6 × 4 (24 Plätze)', rows: 6, cols: 4 },
  { label: '6 × 5 (30 Plätze)', rows: 6, cols: 5 },
  { label: '8 × 2 (16 Plätze)', rows: 8, cols: 2 },
  { label: '10 × 2 (20 Plätze)', rows: 10, cols: 2 },
  { label: 'Benutzerdefiniert', rows: 0, cols: 0 },
];

/** Ermittelt den Vornamen. Bei gleichen Vornamen wird der Nachnamens-Initial angehängt. */
function formatStudentDisplayName(student, allStudents) {
  if (!student) return '';
  const firstName = String(student.firstName || '').trim();
  const sameFirstNameCount = (allStudents || []).filter(
    (s) => s && String(s.firstName || '').trim().toLowerCase() === firstName.toLowerCase(),
  ).length;

  if (sameFirstNameCount > 1 && student.lastName) {
    const initial = String(student.lastName).trim()[0] || '';
    return `${firstName} ${initial.toUpperCase()}.`;
  }
  return firstName || `${student.lastName || 'Schüler'}`;
}

/** Sortiert Schüler alphabetisch nach Vorname, dann Nachname. */
function sortStudentsAlphabetically(studentsList) {
  return [...(studentsList || [])].sort((a, b) => {
    const fnA = String(a?.firstName || '').trim();
    const fnB = String(b?.firstName || '').trim();
    const fnComp = fnA.localeCompare(fnB, 'de', { sensitivity: 'base' });
    if (fnComp !== 0) return fnComp;
    const lnA = String(a?.lastName || '').trim();
    const lnB = String(b?.lastName || '').trim();
    return lnA.localeCompare(lnB, 'de', { sensitivity: 'base' });
  });
}

export default function SeatingPlanView({ onOpenExport }) {
  const { config, activeCourseId, students, setConfig, updateConfig: updateConfigCtx, courseArchived } = useData();
  const updateConfig = setConfig || updateConfigCtx;
  const { showConfirm, showAlert } = useDialog();

  const savedSeatingPlan = config?.seatingPlan || null;

  const [rowsInput, setRowsInput] = useState(() => Number(savedSeatingPlan?.rows) || 8);
  const [colsInput, setColsInput] = useState(() => Number(savedSeatingPlan?.cols) || 3);
  const [presetValue, setPresetValue] = useState(() => {
    const r = Number(savedSeatingPlan?.rows) || 8;
    const c = Number(savedSeatingPlan?.cols) || 3;
    const found = PRESET_LAYOUTS.find((p) => p.rows === r && p.cols === c);
    return found ? `${r}x${c}` : 'custom';
  });

  const [isMaximized, setIsMaximized] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverCellKey, setDragOverCellKey] = useState(null);

  const studentsMap = useMemo(() => {
    const map = new Map();
    (students || []).forEach((s) => map.set(Number(s.id), s));
    return map;
  }, [students]);

  // Bestehende Belegungs-Zuordnung laden
  const rawAssignments = useMemo(() => {
    if (savedSeatingPlan?.assignments && typeof savedSeatingPlan.assignments === 'object') {
      return { ...savedSeatingPlan.assignments };
    }
    return null;
  }, [savedSeatingPlan]);

  /** Erzeugt eine automatische alphabetische Belegung von links unten nach rechts oben. */
  const buildAlphabeticalAssignments = useCallback(
    (targetRows, targetCols) => {
      const sorted = sortStudentsAlphabetically(students || []);
      const newAssignments = {};
      let idx = 0;
      // Zeilen von unten (targetRows - 1) bis oben (0)
      for (let r = targetRows - 1; r >= 0; r--) {
        // Spalten von links (0) bis rechts (targetCols - 1)
        for (let c = 0; c < targetCols; c++) {
          if (idx < sorted.length) {
            newAssignments[`${r}_${c}`] = Number(sorted[idx].id);
            idx++;
          }
        }
      }
      return newAssignments;
    },
    [students],
  );

  // Initialisierung: Falls noch kein Sitzplan gespeichert ist, alphabetisch vorbelegen (8x3)
  useEffect(() => {
    if (!savedSeatingPlan && activeCourseId && students?.length > 0) {
      const initAssignments = buildAlphabeticalAssignments(8, 3);
      updateConfig({
        seatingPlan: {
          rows: 8,
          cols: 3,
          assignments: initAssignments,
        },
      });
    }
  }, [savedSeatingPlan, activeCourseId, students, buildAlphabeticalAssignments, updateConfig]);

  const rows = Number(savedSeatingPlan?.rows) || rowsInput || 8;
  const cols = Number(savedSeatingPlan?.cols) || colsInput || 3;
  const assignments = useMemo(() => {
    return savedSeatingPlan?.assignments || rawAssignments || buildAlphabeticalAssignments(rows, cols);
  }, [savedSeatingPlan?.assignments, rawAssignments, buildAlphabeticalAssignments, rows, cols]);

  // Liste der im Grid platzierten Schüler-IDs
  const assignedStudentIds = useMemo(() => {
    const set = new Set();
    Object.values(assignments).forEach((id) => {
      if (id != null) set.add(Number(id));
    });
    return set;
  }, [assignments]);

  // Liste aller unplatzierten Schüler
  const unassignedStudents = useMemo(() => {
    return (students || []).filter((s) => !assignedStudentIds.has(Number(s.id)));
  }, [students, assignedStudentIds]);

  const handlePresetChange = (e) => {
    const val = e.target.value;
    setPresetValue(val);
    if (val === 'custom') return;
    const [rStr, cStr] = val.split('x');
    const newR = Number(rStr);
    const newC = Number(cStr);
    setRowsInput(newR);
    setColsInput(newC);

    updateConfig({
      seatingPlan: {
        rows: newR,
        cols: newC,
        assignments: assignments || buildAlphabeticalAssignments(newR, newC),
      },
    });
  };

  const handleCustomDimensionChange = (newR, newC) => {
    const validR = Math.max(1, Math.min(12, Number(newR) || 1));
    const validC = Math.max(1, Math.min(12, Number(newC) || 1));
    setRowsInput(validR);
    setColsInput(validC);
    setPresetValue('custom');

    updateConfig({
      seatingPlan: {
        rows: validR,
        cols: validC,
        assignments: assignments || buildAlphabeticalAssignments(validR, validC),
      },
    });
  };

  const handleResetAlphabetical = async () => {
    const ok = await showConfirm(
      'Möchtest du den Sitzplan wirklich zurücksetzen?\n\nAlle Schüler werden neu alphabetisch von unten links nach oben rechts in das Raster einsortiert.',
      { title: 'Sitzplan alphabetisch anordnen', danger: false },
    );
    if (!ok) return;

    const newAssignments = buildAlphabeticalAssignments(rows, cols);
    updateConfig({
      seatingPlan: {
        rows,
        cols,
        assignments: newAssignments,
      },
    });
  };

  const handleClearSeatingPlan = async () => {
    const ok = await showConfirm(
      'Möchtest du alle Sitzplätze leeren?\n\nAlle Schüler werden aus dem Sitzplan entfernt.',
      { title: 'Sitzplan leeren', danger: true },
    );
    if (!ok) return;

    updateConfig({
      seatingPlan: {
        rows,
        cols,
        assignments: {},
      },
    });
  };

  // --- Drag & Drop Handlers ---

  const handleDragStartCell = (e, cellKey, studentId) => {
    if (courseArchived) return;
    setDraggedItem({ type: 'cell', cellKey, studentId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'cell', cellKey, studentId }));
  };

  const handleDragStartUnassigned = (e, studentId) => {
    if (courseArchived) return;
    setDraggedItem({ type: 'unassigned', studentId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'unassigned', studentId }));
  };

  const handleDragOverCell = (e, cellKey) => {
    if (courseArchived) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCellKey !== cellKey) {
      setDragOverCellKey(cellKey);
    }
  };

  const handleDragLeaveCell = (cellKey) => {
    if (dragOverCellKey === cellKey) {
      setDragOverCellKey(null);
    }
  };

  const handleDropOnCell = (e, targetCellKey) => {
    if (courseArchived) return;
    e.preventDefault();
    setDragOverCellKey(null);

    let dragData = draggedItem;
    if (!dragData) {
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) dragData = JSON.parse(raw);
      } catch {}
    }
    if (!dragData) return;

    const nextAssignments = { ...assignments };
    const targetStudentId = nextAssignments[targetCellKey] || null;

    if (dragData.type === 'cell') {
      const sourceCellKey = dragData.cellKey;
      if (sourceCellKey === targetCellKey) return;

      if (targetStudentId != null) {
        nextAssignments[sourceCellKey] = targetStudentId;
        nextAssignments[targetCellKey] = dragData.studentId;
      } else {
        delete nextAssignments[sourceCellKey];
        nextAssignments[targetCellKey] = dragData.studentId;
      }
    } else if (dragData.type === 'unassigned') {
      const studentId = dragData.studentId;
      nextAssignments[targetCellKey] = studentId;
    }

    updateConfig({
      seatingPlan: {
        rows,
        cols,
        assignments: nextAssignments,
      },
    });
    setDraggedItem(null);
  };

  const handleDropOnUnassignedTray = (e) => {
    if (courseArchived) return;
    e.preventDefault();
    setDragOverCellKey(null);

    let dragData = draggedItem;
    if (!dragData) {
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) dragData = JSON.parse(raw);
      } catch {}
    }
    if (!dragData || dragData.type !== 'cell') return;

    const nextAssignments = { ...assignments };
    delete nextAssignments[dragData.cellKey];

    updateConfig({
      seatingPlan: {
        rows,
        cols,
        assignments: nextAssignments,
      },
    });
    setDraggedItem(null);
  };

  if (!config) {
    return (
      <div className="view-generic-scroll program-view">
        <h3 className="program-view-title">Sitzplan</h3>
        <p className="program-view-intro text-muted">Bitte wählen Sie zuerst ein Fach aus.</p>
      </div>
    );
  }

  return (
    <div className="view-generic-scroll program-view seating-plan-view">
      <div className="seating-plan-header">
        <div className="seating-plan-title-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 className="program-view-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Armchair size={24} strokeWidth={2.25} aria-hidden />
              Sitzplan für {config.subject} {config.className}
            </h3>
            <p className="program-view-intro text-muted" style={{ margin: 0 }}>
              Ziehe einfach die Schülernamen per Drag & Drop auf die Sitzplätze. Bei Platzierung auf einem besetzten Platz werden die Namen vertauscht.
            </p>
          </div>

          {onOpenExport && (
            <button
              type="button"
              className="tab secondary seating-plan-action-btn"
              onClick={onOpenExport}
              title="Sitzplan-Export aufrufen (PDF / Excel)"
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <FileSpreadsheet size={16} strokeWidth={2} aria-hidden />
              Exportieren
            </button>
          )}
        </div>

        <div className="seating-plan-toolbar">
          <div className="seating-plan-control-group">
            <label className="seating-plan-label">
              <Grid size={16} strokeWidth={2} aria-hidden />
              <span>Form (Zeilen × Spalten):</span>
            </label>
            <select
              className="program-user-mgmt-input seating-plan-select"
              value={presetValue}
              onChange={handlePresetChange}
              disabled={courseArchived}
            >
              {PRESET_LAYOUTS.map((p) => (
                <option key={p.label} value={p.rows ? `${p.rows}x${p.cols}` : 'custom'}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {presetValue === 'custom' && (
            <div className="seating-plan-custom-inputs">
              <label className="seating-plan-sublabel">
                Zeilen:
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="program-user-mgmt-input seating-plan-num-input"
                  value={rowsInput}
                  onChange={(e) => handleCustomDimensionChange(e.target.value, colsInput)}
                  disabled={courseArchived}
                />
              </label>
              <label className="seating-plan-sublabel">
                Spalten:
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="program-user-mgmt-input seating-plan-num-input"
                  value={colsInput}
                  onChange={(e) => handleCustomDimensionChange(rowsInput, e.target.value)}
                  disabled={courseArchived}
                />
              </label>
            </div>
          )}

          <div className="seating-plan-actions">
            <button
              type="button"
              className="tab secondary seating-plan-action-btn"
              onClick={handleResetAlphabetical}
              disabled={courseArchived}
              title="Schüler alphabetisch von unten links nach oben rechts einordnen"
            >
              <RotateCcw size={16} strokeWidth={2} aria-hidden />
              Alphabetisch anordnen
            </button>
            <button
              type="button"
              className="tab secondary seating-plan-action-btn"
              onClick={handleClearSeatingPlan}
              disabled={courseArchived}
              title="Alle Plätze leeren"
            >
              Plätze leeren
            </button>
            <button
              type="button"
              className="tab secondary seating-plan-action-btn"
              onClick={() => setIsMaximized((m) => !m)}
              title={isMaximized ? 'Sitzplan verkleinern (Esc oder M)' : 'Sitzplan maximieren (M)'}
            >
              {isMaximized ? (
                <Minimize2 size={16} strokeWidth={2} aria-hidden />
              ) : (
                <Maximize2 size={16} strokeWidth={2} aria-hidden />
              )}
              {isMaximized ? 'Verkleinern' : 'Maximieren'}
            </button>
          </div>
        </div>
      </div>

      <MaximizableTableSection
        title={`Sitzplan (${config.subject} ${config.className})`}
        maximized={isMaximized}
        onMaximizedChange={setIsMaximized}
        embeddedToggle
      >
        {/* Unplatzierte Schüler (falls vorhanden) */}
        {unassignedStudents.length > 0 && (
          <div
            className="seating-plan-unassigned-section glass-panel"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnUnassignedTray}
          >
            <div className="seating-plan-unassigned-header">
              <Users size={18} strokeWidth={2} aria-hidden />
              <strong>Unplatzierte Schüler ({unassignedStudents.length})</strong>
              <span className="text-muted" style={{ fontSize: '0.8125rem', marginLeft: '0.5rem' }}>
                (Hierher ziehen, um Schüler aus dem Sitzplan zu entfernen)
              </span>
            </div>
            <div className="seating-plan-unassigned-list">
              {unassignedStudents.map((s) => {
                const displayName = formatStudentDisplayName(s, students || []);
                return (
                  <div
                    key={s.id}
                    className="seating-plan-chip seating-plan-chip--unassigned"
                    draggable={!courseArchived}
                    onDragStart={(e) => handleDragStartUnassigned(e, Number(s.id))}
                    title={`${s.firstName} ${s.lastName}`}
                  >
                    <span className="seating-plan-chip-name">{displayName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SITZPLAN GRID CONTAINER */}
        <div className="seating-plan-room-container glass-panel">
          <div className="seating-plan-room-header-hint text-muted">
            <span>▲ Hinterste Reihe (Klassenzimmer hinten) ▲</span>
          </div>

          {/* Die Sitzplan-Tabelle (Zeilen 0 bis rows-1) */}
          <div
            className="seating-plan-grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(100px, 1fr))`,
            }}
          >
            {Array.from({ length: rows }).map((_, r) => {
              const displayRow = rows - r;
              return (
                <React.Fragment key={`row-${r}`}>
                  {Array.from({ length: cols }).map((_, c) => {
                    const cellKey = `${r}_${c}`;
                    const studentId = assignments[cellKey] != null ? Number(assignments[cellKey]) : null;
                    const student = studentId != null ? studentsMap.get(studentId) : null;
                    const displayName = student ? formatStudentDisplayName(student, students || []) : '';
                    const isDragOver = dragOverCellKey === cellKey;

                    return (
                      <div
                        key={cellKey}
                        className={`seating-plan-cell${isDragOver ? ' seating-plan-cell--drag-over' : ''}${
                          student ? ' seating-plan-cell--occupied' : ' seating-plan-cell--empty'
                        }`}
                        onDragOver={(e) => handleDragOverCell(e, cellKey)}
                        onDragLeave={() => handleDragLeaveCell(cellKey)}
                        onDrop={(e) => handleDropOnCell(e, cellKey)}
                      >
                        <div className="seating-plan-cell-coords" title={`Reihe ${displayRow}, Platz ${c + 1}`}>
                          R{displayRow}:{c + 1}
                        </div>

                        {student ? (
                          <div
                            className="seating-plan-seat-card"
                            draggable={!courseArchived}
                            onDragStart={(e) => handleDragStartCell(e, cellKey, studentId)}
                            title={`${student.firstName} ${student.lastName} (Reihe ${displayRow}, Platz ${c + 1})`}
                          >
                            <span className="seating-plan-seat-name">{displayName}</span>
                          </div>
                        ) : (
                          <div className="seating-plan-seat-empty">
                            <span className="seating-plan-empty-label">Frei</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>

          <div className="seating-plan-room-footer-hint text-muted">
            <span>▼ Vorderste Reihe (Klassenzimmer vorne) ▼</span>
          </div>

          {/* LEHRERPULT / TAFEL UNTERHALB DES SITZPLANS */}
          <div className="seating-plan-teacher-desk" role="region" aria-label="Lehrerpult und Tafel">
            <div className="seating-plan-teacher-desk-bar">
              <span className="seating-plan-teacher-desk-title">TAFEL / LEHRERPULT</span>
            </div>
          </div>
        </div>
      </MaximizableTableSection>
    </div>
  );
}
