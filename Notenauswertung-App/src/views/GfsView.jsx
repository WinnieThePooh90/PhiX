import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../store/DataContext';
import {
  getGradeCellBackground,
  getGradeTextColor,
  isGradeWorseThan4,
  storedGradeStringToClassic,
  normalizeCourseGradeSystem,
} from '../utils/calculator';
import MaximizableTableSection, { TableMaximizeToggle } from '../components/MaximizableTableSection';

/** Punktesystem: in der DB liegen die Notenpunkte als Text (0–15). */
function gfsNotePointsDisplay(note) {
  if (note == null || note === '') return '';
  return String(note).trim();
}

export default function GfsView() {
  const { students, gfsEntries, addGfsEntry, updateGfsEntry, removeGfsEntry, config } = useData();
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gfsNoteEditingId, setGfsNoteEditingId] = useState(null);
  const [gfsNoteDraft, setGfsNoteDraft] = useState('');
  const [tableMaximized, setTableMaximized] = useState(false);
  const wrapRef = useRef(null);

  const usedStudentIds = new Set(gfsEntries.map((e) => e.studentId));
  const availableStudents = students.filter((s) => !usedStudentIds.has(s.id));

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const onDown = (e) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (wrapRef.current?.contains(t)) return;
      setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  const handlePickStudent = async (studentId) => {
    await addGfsEntry(studentId);
    setPickerOpen(false);
  };

  /** Anzeige und Speicherung: Dezimaltrenner immer Punkt (Komma wird ersetzt). */
  const gfsNoteDisplay = (note) => (note == null || note === '' ? '' : String(note).replace(/,/g, '.'));
  const handleGfsNoteChange = (entryId, raw) => {
    updateGfsEntry(entryId, 'note', raw.replace(/,/g, '.'));
  };

  return (
    <div className="view-generic-scroll view-generic-scroll--gfs">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4 view-page-chrome">
        <div>
          <h2 style={{ margin: 0 }}>GFS</h2>
        </div>
        <div className="view-toolbar-actions">
        <div ref={wrapRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="tab secondary"
            onClick={() => setPickerOpen((o) => !o)}
            title="Schüler hinzufügen"
            aria-label="Schüler hinzufügen"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2.5rem',
              height: '2.5rem',
              padding: 0,
              borderRadius: '50%',
              fontWeight: 'bold',
            }}
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
          >
            <Plus size={22} strokeWidth={2} aria-hidden />
          </button>
          {pickerOpen && (
            <div
              role="listbox"
              aria-label="Schüler auswählen"
              style={{
                position: 'absolute',
                left: 0,
                top: 'calc(100% + 6px)',
                minWidth: '220px',
                maxHeight: '280px',
                overflowY: 'auto',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
                zIndex: 60,
              }}
            >
              {availableStudents.length === 0 ? (
                <div className="text-muted" style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  {students.length === 0
                    ? 'Keine Schüler angelegt. Lege zuerst in den Einstellungen Schüler an.'
                    : 'Alle Schüler sind bereits in der Tabelle.'}
                </div>
              ) : (
                availableStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    className="secondary"
                    onClick={() => handlePickStudent(s.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: 0,
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      background: 'transparent',
                      padding: '0.65rem 1rem',
                      cursor: 'pointer',
                    }}
                  >
                    {s.lastName}, {s.firstName}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <TableMaximizeToggle
          maximized={tableMaximized}
          onClick={() => setTableMaximized((m) => !m)}
        />
        </div>
      </div>

      <div className="view-table-scroll gfs-table-scroll" style={{ marginTop: '1rem' }}>
      <MaximizableTableSection
        title="GFS-Einträge"
        maximized={tableMaximized}
        onMaximizedChange={setTableMaximized}
        embeddedToggle
      >
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '72px' }}>Nr.</th>
                <th>Name</th>
                <th>Thema</th>
                <th>Art</th>
                <th style={{ width: '160px' }}>Datum</th>
                <th style={{ width: '88px' }} className="text-center" title="Nur wenn angehakt und Note gesetzt zählt die Leistung in der Übersicht">
                  Gehalten
                </th>
                <th style={{ width: '100px' }}>Halbjahr</th>
                <th style={{ width: '120px' }}>Note</th>
                <th style={{ width: '88px' }} className="text-right">
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody>
              {gfsEntries.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center text-muted" style={{ padding: '2rem' }}>
                    Noch keine Einträge. Klicke auf den Plus-Button, um einen Schüler auszuwählen.
                  </td>
                </tr>
              )}
              {gfsEntries.map((row, idx) => {
                const st = students.find((s) => s.id === row.studentId);
                const name = st ? `${st.lastName}, ${st.firstName}` : `Schüler #${row.studentId}`;
                const gehalten = row.gehalten === true;
                const noteNum = storedGradeStringToClassic(row.note, gradeSys);
                const hasParsedNote = noteNum !== null;
                const noteBad = hasParsedNote && isGradeWorseThan4(noteNum);
                return (
                  <tr key={row.id}>
                    <td className="text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {idx + 1}
                    </td>
                    <td>{name}</td>
                    <td>
                      <input
                        type="text"
                        value={row.thema ?? ''}
                        onChange={(e) => updateGfsEntry(row.id, 'thema', e.target.value)}
                        placeholder="Thema"
                        aria-label={`Thema für ${name}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.art ?? ''}
                        onChange={(e) => updateGfsEntry(row.id, 'art', e.target.value)}
                        placeholder="z. B. Referat, Präsentation"
                        aria-label={`Art für ${name}`}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={row.date ?? ''}
                        onChange={(e) => updateGfsEntry(row.id, 'date', e.target.value)}
                        aria-label={`Datum für ${name}`}
                      />
                    </td>
                    <td
                      className={`text-center gfs-gehalten-td ${gehalten ? 'gfs-gehalten-td--checked' : 'gfs-gehalten-td--unchecked'}`}
                      style={{ verticalAlign: 'middle' }}
                      title={gehalten ? 'Gehalten' : 'Noch nicht gehalten'}
                    >
                      <label className="gfs-gehalten-label">
                        <input
                          type="checkbox"
                          className="gfs-gehalten-checkbox"
                          checked={gehalten}
                          onChange={(e) => updateGfsEntry(row.id, 'gehalten', e.target.checked)}
                          aria-label={`GFS gehalten für ${name}`}
                        />
                      </label>
                    </td>
                    <td>
                      <select
                        value={row.halbjahr === '2' ? '2' : '1'}
                        onChange={(e) => updateGfsEntry(row.id, 'halbjahr', e.target.value)}
                        aria-label={`Halbjahr für ${name}`}
                        style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                      >
                        <option value="1">HJ 1</option>
                        <option value="2">HJ 2</option>
                      </select>
                    </td>
                    <td
                      style={{
                        verticalAlign: 'middle',
                        background: hasParsedNote ? (getGradeCellBackground(noteNum) ?? undefined) : undefined,
                        color: hasParsedNote ? getGradeTextColor(noteNum) : undefined,
                      }}
                    >
                      <input
                        type="text"
                        inputMode={gradeSys === 'points' ? 'numeric' : 'decimal'}
                        value={
                          gradeSys === 'points'
                            ? gfsNoteEditingId === row.id
                              ? gfsNoteDraft
                              : gfsNotePointsDisplay(row.note)
                            : gfsNoteDisplay(row.note)
                        }
                        onFocus={() => {
                          if (gradeSys === 'points') {
                            setGfsNoteEditingId(row.id);
                            setGfsNoteDraft(gfsNotePointsDisplay(row.note));
                          }
                        }}
                        onChange={(e) => {
                          if (gradeSys === 'points') {
                            if (gfsNoteEditingId === row.id) setGfsNoteDraft(e.target.value);
                          } else {
                            handleGfsNoteChange(row.id, e.target.value);
                          }
                        }}
                        onBlur={() => {
                          if (gradeSys !== 'points' || gfsNoteEditingId !== row.id) return;
                          const t = gfsNoteDraft.trim().replace(',', '.');
                          if (t === '') {
                            updateGfsEntry(row.id, 'note', '');
                          } else {
                            const np = Math.round(parseFloat(t));
                            if (!Number.isFinite(np) || np < 0 || np > 15) {
                              /* bleibt unverändert */
                            } else {
                              updateGfsEntry(row.id, 'note', String(np));
                            }
                          }
                          setGfsNoteEditingId(null);
                          setGfsNoteDraft('');
                        }}
                        placeholder={gradeSys === 'points' ? '0–15' : 'z. B. 2.25'}
                        aria-label={`Note GFS für ${name}`}
                        className={noteBad ? 'gfs-note-input gfs-note-input--worse-than-4' : 'gfs-note-input'}
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="danger secondary"
                        onClick={() => removeGfsEntry(row.id)}
                        title="Eintrag entfernen"
                        aria-label={`GFS-Eintrag entfernen (${name})`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.35rem 0.45rem',
                          minWidth: '2.25rem',
                        }}
                      >
                        <Trash2 size={18} strokeWidth={2} aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </MaximizableTableSection>
      </div>
    </div>
  );
}
