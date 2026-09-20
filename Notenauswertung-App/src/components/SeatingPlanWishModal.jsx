import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Trash2, Users, GripVertical } from 'lucide-react';
import { solveSeatingPlanWishes } from '../utils/seatingPlanSolver';

/**
 * Modal zur Eingabe von Wunschnachbarn und automatischer Generierung der Sitzordnung.
 */
export default function SeatingPlanWishModal({
  isOpen,
  onClose,
  students = [],
  rows = 8,
  cols = 3,
  initialWishes = {},
  onApplyWishes,
  onUpdateWishes,
  formatStudentDisplayName,
}) {
  const [wishes, setWishes] = useState(() => (initialWishes && typeof initialWishes === 'object' ? { ...initialWishes } : {}));
  const [draggedStudentId, setDraggedStudentId] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null); // format: `${studentId}_${slotIndex}`
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // Initialisiere Wünsche beim Öffnen
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setWishes(initialWishes && typeof initialWishes === 'object' ? { ...initialWishes } : {});
      setDraggedStudentId(null);
      setDragOverCell(null);
    }
  }

  // Esc-Taste zum Schließen
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const studentsMap = useMemo(() => {
    const map = new Map();
    (students || []).forEach((s) => map.set(Number(s.id), s));
    return map;
  }, [students]);

  // Schüler sortieren für konsistente Anzeige
  const sortedStudents = useMemo(() => {
    return [...(students || [])].sort((a, b) => {
      const fnA = String(a?.firstName || '').trim();
      const fnB = String(b?.firstName || '').trim();
      const fnComp = fnA.localeCompare(fnB, 'de', { sensitivity: 'base' });
      if (fnComp !== 0) return fnComp;
      const lnA = String(a?.lastName || '').trim();
      const lnB = String(b?.lastName || '').trim();
      return lnA.localeCompare(lnB, 'de', { sensitivity: 'base' });
    });
  }, [students]);

  // Drag & Drop Handler
  const handleDragStart = (e, studentId) => {
    setDraggedStudentId(studentId);
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'student_wish', studentId }));
  };

  const handleDragOver = (e, cellKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dragOverCell !== cellKey) {
      setDragOverCell(cellKey);
    }
  };

  const handleDragLeave = (cellKey) => {
    if (dragOverCell === cellKey) {
      setDragOverCell(null);
    }
  };

  const handleDrop = (e, targetStudentId, slotIndex) => {
    e.preventDefault();
    setDragOverCell(null);

    let incomingId = draggedStudentId;
    if (!incomingId) {
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.studentId) incomingId = Number(parsed.studentId);
        }
      } catch {
        // Ungültige Payload ignorieren
      }
    }

    if (!incomingId) return;
    if (Number(incomingId) === Number(targetStudentId)) {
      // Schüler kann sich nicht selbst als Wunschnachbarn wählen
      return;
    }

    const current = wishes[targetStudentId] || {};
    const slotKey = slotIndex === 1 ? 'wish1' : 'wish2';
    const nextWishes = {
      ...wishes,
      [targetStudentId]: {
        ...current,
        [slotKey]: Number(incomingId),
      },
    };
    setWishes(nextWishes);
    if (onUpdateWishes) onUpdateWishes(nextWishes);
    setDraggedStudentId(null);
  };

  const handleRemoveWish = (targetStudentId, slotIndex) => {
    const current = wishes[targetStudentId] || {};
    const slotKey = slotIndex === 1 ? 'wish1' : 'wish2';
    const updated = { ...current };
    delete updated[slotKey];
    const nextWishes = {
      ...wishes,
      [targetStudentId]: updated,
    };
    if (!updated.wish1 && !updated.wish2) {
      delete nextWishes[targetStudentId];
    }
    setWishes(nextWishes);
    if (onUpdateWishes) onUpdateWishes(nextWishes);
  };

  const handleSelectWish = (targetStudentId, slotIndex, value) => {
    const chosenId = value ? Number(value) : null;
    const current = wishes[targetStudentId] || {};
    const slotKey = slotIndex === 1 ? 'wish1' : 'wish2';
    const updated = { ...current };
    if (chosenId) {
      updated[slotKey] = chosenId;
    } else {
      delete updated[slotKey];
    }
    const nextWishes = {
      ...wishes,
      [targetStudentId]: updated,
    };
    if (!updated.wish1 && !updated.wish2) {
      delete nextWishes[targetStudentId];
    }
    setWishes(nextWishes);
    if (onUpdateWishes) onUpdateWishes(nextWishes);
  };

  const handleClearAllWishes = () => {
    setWishes({});
    if (onUpdateWishes) onUpdateWishes({});
  };

  const handleGenerate = () => {
    const result = solveSeatingPlanWishes(students, rows, cols, wishes);
    if (onApplyWishes) {
      onApplyWishes(result.assignments, wishes, result);
    }
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="dependency-license-modal-backdrop"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="seating-plan-wish-modal-dialog glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wish-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="seating-plan-wish-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="seating-plan-wish-header-icon">
              <Users size={20} strokeWidth={2.2} aria-hidden />
            </div>
            <div>
              <h2 id="wish-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Wunschnachbarn für Sitzplan
              </h2>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.8125rem' }}>
                Ziehe Schüler aus der Schülerliste in die Spalten Wunschnachbar 1 und 2. Mehrfachnennungen sind erlaubt.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="seating-plan-remove-btn"
            onClick={onClose}
            title="Schließen (Esc)"
            aria-label="Schließen"
            style={{ width: '2rem', height: '2rem' }}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="seating-plan-wish-modal-body">
          <div className="seating-plan-wish-table-wrap">
            <table className="seating-plan-wish-table">
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>Nr.</th>
                  <th style={{ minWidth: '170px' }}>Schülerliste</th>
                  <th style={{ minWidth: '180px' }}>Wunschnachbar 1</th>
                  <th style={{ minWidth: '180px' }}>Wunschnachbar 2</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((s, idx) => {
                  const sId = Number(s.id);
                  const displayName = formatStudentDisplayName ? formatStudentDisplayName(s, students) : `${s.firstName} ${s.lastName}`;
                  const rowWishes = wishes[sId] || {};
                  const wish1Id = rowWishes.wish1 != null ? Number(rowWishes.wish1) : null;
                  const wish2Id = rowWishes.wish2 != null ? Number(rowWishes.wish2) : null;
                  const wish1Student = wish1Id ? studentsMap.get(wish1Id) : null;
                  const wish2Student = wish2Id ? studentsMap.get(wish2Id) : null;

                  const cell1Key = `${sId}_1`;
                  const cell2Key = `${sId}_2`;
                  const isDragOver1 = dragOverCell === cell1Key;
                  const isDragOver2 = dragOverCell === cell2Key;

                  return (
                    <tr key={sId}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {idx + 1}
                      </td>

                      {/* Schülerliste Spalte */}
                      <td>
                        <div
                          className="seating-plan-wish-student-chip"
                          draggable
                          onDragStart={(e) => handleDragStart(e, sId)}
                          title={`${s.firstName} ${s.lastName} (ziehen, um als Wunschnachbar einzutragen)`}
                        >
                          <GripVertical size={14} className="seating-plan-wish-grip text-muted" aria-hidden />
                          <span className="seating-plan-wish-chip-text">{displayName}</span>
                        </div>
                      </td>

                      {/* Wunschnachbar 1 Spalte */}
                      <td>
                        <div
                          className={`seating-plan-wish-slot${isDragOver1 ? ' seating-plan-wish-slot--over' : ''}${
                            wish1Student ? ' seating-plan-wish-slot--filled' : ' seating-plan-wish-slot--empty'
                          }`}
                          onDragOver={(e) => handleDragOver(e, cell1Key)}
                          onDragLeave={() => handleDragLeave(cell1Key)}
                          onDrop={(e) => handleDrop(e, sId, 1)}
                        >
                          {wish1Student ? (
                            <div className="seating-plan-wish-filled-chip">
                              <span className="seating-plan-wish-chip-text">
                                {formatStudentDisplayName ? formatStudentDisplayName(wish1Student, students) : `${wish1Student.firstName} ${wish1Student.lastName}`}
                              </span>
                              <button
                                type="button"
                                className="seating-plan-wish-clear-btn"
                                onClick={() => handleRemoveWish(sId, 1)}
                                title="Wunsch entfernen"
                                aria-label="Wunsch entfernen"
                              >
                                <X size={12} strokeWidth={2.5} aria-hidden />
                              </button>
                            </div>
                          ) : (
                            <div className="seating-plan-wish-empty-target">
                              <span className="seating-plan-wish-placeholder">Hierher ziehen</span>
                              <select
                                className="seating-plan-wish-select-quick"
                                value=""
                                onChange={(e) => handleSelectWish(sId, 1, e.target.value)}
                                title="Oder Schüler aus Liste wählen"
                                aria-label={`Wunschnachbar 1 für ${displayName} auswählen`}
                              >
                                <option value="">Auswählen…</option>
                                {sortedStudents
                                  .filter((other) => Number(other.id) !== sId)
                                  .map((other) => (
                                    <option key={other.id} value={other.id}>
                                      {formatStudentDisplayName ? formatStudentDisplayName(other, students) : `${other.firstName} ${other.lastName}`}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Wunschnachbar 2 Spalte */}
                      <td>
                        <div
                          className={`seating-plan-wish-slot${isDragOver2 ? ' seating-plan-wish-slot--over' : ''}${
                            wish2Student ? ' seating-plan-wish-slot--filled' : ' seating-plan-wish-slot--empty'
                          }`}
                          onDragOver={(e) => handleDragOver(e, cell2Key)}
                          onDragLeave={() => handleDragLeave(cell2Key)}
                          onDrop={(e) => handleDrop(e, sId, 2)}
                        >
                          {wish2Student ? (
                            <div className="seating-plan-wish-filled-chip">
                              <span className="seating-plan-wish-chip-text">
                                {formatStudentDisplayName ? formatStudentDisplayName(wish2Student, students) : `${wish2Student.firstName} ${wish2Student.lastName}`}
                              </span>
                              <button
                                type="button"
                                className="seating-plan-wish-clear-btn"
                                onClick={() => handleRemoveWish(sId, 2)}
                                title="Wunsch entfernen"
                                aria-label="Wunsch entfernen"
                              >
                                <X size={12} strokeWidth={2.5} aria-hidden />
                              </button>
                            </div>
                          ) : (
                            <div className="seating-plan-wish-empty-target">
                              <span className="seating-plan-wish-placeholder">Hierher ziehen</span>
                              <select
                                className="seating-plan-wish-select-quick"
                                value=""
                                onChange={(e) => handleSelectWish(sId, 2, e.target.value)}
                                title="Oder Schüler aus Liste wählen"
                                aria-label={`Wunschnachbar 2 für ${displayName} auswählen`}
                              >
                                <option value="">Auswählen…</option>
                                {sortedStudents
                                  .filter((other) => Number(other.id) !== sId)
                                  .map((other) => (
                                    <option key={other.id} value={other.id}>
                                      {formatStudentDisplayName ? formatStudentDisplayName(other, students) : `${other.firstName} ${other.lastName}`}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="seating-plan-wish-modal-footer">
          <button
            type="button"
            className="tab secondary seating-plan-action-btn"
            onClick={handleClearAllWishes}
            title="Alle eingetragenen Wünsche leeren"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Trash2 size={16} strokeWidth={2} aria-hidden />
            Wünsche leeren
          </button>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" className="tab secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button
              type="button"
              className="tab seating-plan-generate-btn"
              onClick={handleGenerate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              <Sparkles size={16} strokeWidth={2} aria-hidden />
              Generieren
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
