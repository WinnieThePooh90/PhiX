import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import {
  calculateStudentGrades,
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
  storedGradeStringToClassic,
  normalizeCourseGradeSystem,
} from '../utils/calculator';
import MaximizableTableSection from '../components/MaximizableTableSection';

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

export default function SummaryView({ studentIdFilterSet = null }) {
  const { students, exams, orals, tests, gfsEntries, config, updateStudentConfig } = useData();

  const displayStudents = useMemo(() => {
    if (studentIdFilterSet == null) return students;
    return students.filter((s) => studentIdFilterSet.has(s.id));
  }, [students, studentIdFilterSet]);

  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [showHJ1, setShowHJ1] = useState(true);
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

  const colCount = 7 + (showHJ1 ? 1 : 0) + 1;

  return (
    <div className="view-generic-scroll summary-overview">
      <div className="flex flex-wrap gap-4 course-meta-settings-row" style={{ marginBottom: '0.75rem' }}>
        <div className="course-meta-field">
          <span className="course-meta-field__label">Halbjahresnote anzeigen</span>
          <div className="course-meta-field__row">
            <label className="switch" title="Spalte &#x201E;Note HJ1&#x201C; ein-/ausblenden">
              <input
                type="checkbox"
                checked={showHJ1}
                onChange={(e) => setShowHJ1(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>
        </div>
      </div>
      <MaximizableTableSection title="Gesamtübersicht">
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
              <th className="text-center" style={{ width: '120px' }} title={gradeSys === 'points' ? 'Anzeige Notenpunkte 0–15' : undefined}>
                Tests{npSuffix}
              </th>
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
              const { examAvg, oralAvg, testAvg, finalGrade } = calculateStudentGrades(s.id, exams, orals, tests, config.weighting, null, gfsEntries, customGradingKeys, gradeSys);
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
                    <td className="text-center" style={{ background: getGradeCellBackground(testAvg) }}>
                      <span style={{ color: isGradeWorseThan4(testAvg) ? 'var(--danger)' : (getGradeTextColor(testAvg) || 'var(--foreground)') }}>{gfmt(testAvg)}</span>
                    </td>
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
                            const { examAvg, oralAvg, testAvg, finalGrade } = calculateStudentGrades(s.id, exams, orals, tests, config.weighting, cat.filter, gfsEntries, customGradingKeys, gradeSys);
                            const rounded = finalGrade !== null ? Math.round(finalGrade) : null;
                            
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
                                    <span style={{ fontWeight: 'normal', fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>Klausuren + GFS</span>
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
                                  </ul>
                                </div>

                                <div className="mb-4">
                                  <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mündlich ({gfmt(oralAvg)})</h4>
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
                                  </ul>
                                </div>

                                <div>
                                  <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tests ({gfmt(testAvg)})</h4>
                                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {Object.entries(tests).filter(([_, t]) => t.active && (!cat.filter || t.halbjahr === cat.filter)).map(([id, t]) => {
                                      const sm = t.scores ?? t.errors;
                                      const { counted } = getNormalizedTestScore(sm?.[s.id]);
                                      const gr = counted ? getTestGradeForStudent(t, s.id, customGradingKeys, gradeSys) : null;
                                      return (
                                        <li key={id} className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                                          <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>{t.name}:</span>
                                          <strong style={{ color: !counted ? 'var(--text-muted)' : (isGradeWorseThan4(gr) ? 'var(--danger)' : 'var(--foreground)') }}>{counted && gr !== null ? gfmt(gr) : '-'}</strong>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              </div>
                            );
                          })}
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
  );
}
