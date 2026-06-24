import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GFS_AUSWERTUNG_CRITERIA,
  GFS_AUSWERTUNG_POINT_LEVELS,
  GFS_AUSWERTUNG_POINTS_TO_GRADE,
  buildGfsCriterionRowCells,
  parseGfsAuswertungHilfe,
  sumGfsAuswertungScores,
  countGfsAuswertungFilled,
  suggestGradeFromGfsAuswertungPoints,
} from '../utils/gfsAuswertungConfig';

export default function GfsAuswertungDialog({
  open,
  onClose,
  studentName,
  auswertungHilfe,
  onSave,
}) {
  const initial = useMemo(() => parseGfsAuswertungHilfe(auswertungHilfe), [auswertungHilfe, open]);
  const [scores, setScores] = useState(initial.scores);
  const [bemerkungen, setBemerkungen] = useState(initial.bemerkungen);

  useEffect(() => {
    if (!open) return;
    const parsed = parseGfsAuswertungHilfe(auswertungHilfe);
    setScores(parsed.scores);
    setBemerkungen(parsed.bemerkungen);
  }, [open, auswertungHilfe]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const filled = countGfsAuswertungFilled(scores);
  const total = sumGfsAuswertungScores(scores);
  const suggestedGrade = filled > 0 ? suggestGradeFromGfsAuswertungPoints(total) : null;

  const persist = (nextScores, nextBemerkungen) => {
    onSave({
      scores: nextScores,
      bemerkungen: nextBemerkungen,
    });
  };

  const handleSelect = (criterionId, points) => {
    const next = { ...scores, [criterionId]: points };
    setScores(next);
    persist(next, bemerkungen);
  };

  const handleBemerkungenBlur = () => {
    persist(scores, bemerkungen);
  };

  return createPortal(
    <div className="oral-formula-modal-backdrop gfs-auswertung-backdrop" role="presentation" onClick={onClose}>
      <div
        className="oral-formula-modal-dialog gfs-auswertung-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gfs-auswertung-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="oral-formula-modal-header">
          <h2 id="gfs-auswertung-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            GFS-Auswertung — {studentName}
          </h2>
          <button type="button" className="tab secondary" onClick={onClose} aria-label="Schließen">
            Schließen
          </button>
        </div>
        <div className="oral-formula-modal-body gfs-auswertung-body">
          <div className="gfs-auswertung-table-wrap">
            <table className="gfs-auswertung-table">
              <thead>
                <tr>
                  <th className="gfs-auswertung-th-criterion">Kriterium</th>
                  {GFS_AUSWERTUNG_POINT_LEVELS.map((p) => (
                    <th key={p} className="gfs-auswertung-th-points text-center">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GFS_AUSWERTUNG_CRITERIA.map((criterion) => (
                  <tr key={criterion.id}>
                    <th scope="row" className="gfs-auswertung-criterion-label">
                      {criterion.label}
                    </th>
                    {buildGfsCriterionRowCells(criterion).map((cell) => {
                      if (cell.type === 'empty') {
                        return (
                          <td
                            key={`${criterion.id}-empty-${cell.gridPoint}`}
                            className="gfs-auswertung-td gfs-auswertung-td--empty"
                            aria-hidden="true"
                          />
                        );
                      }
                      const { pointValue, description } = cell;
                      const selected = scores[criterion.id] === pointValue;
                      return (
                        <td key={`${criterion.id}-${pointValue}`} className="gfs-auswertung-td">
                          <button
                            type="button"
                            className={`gfs-auswertung-cell${selected ? ' gfs-auswertung-cell--selected' : ''}`}
                            onClick={() => handleSelect(criterion.id, pointValue)}
                            aria-pressed={selected}
                            aria-label={`${criterion.label}: ${pointValue} Punkte — ${description}`}
                            title={`${pointValue} Punkte: ${description}`}
                          >
                            <span className="gfs-auswertung-cell-points">{pointValue}</span>
                            <span className="gfs-auswertung-cell-desc">{description}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="gfs-auswertung-footer">
            <div className="gfs-auswertung-sum-row">
              <span>
                <strong>Summe:</strong>
                {' '}
                {filled > 0 ? `${total} Punkte` : '—'}
                {filled > 0 && filled < GFS_AUSWERTUNG_CRITERIA.length ? (
                  <span className="text-muted" style={{ marginLeft: '0.5rem', fontWeight: 'normal' }}>
                    ({filled} von {GFS_AUSWERTUNG_CRITERIA.length} Kriterien)
                  </span>
                ) : null}
              </span>
              {suggestedGrade ? (
                <span>
                  <strong>Vorgeschlagene Note:</strong>
                  {' '}
                  {suggestedGrade}
                </span>
              ) : null}
            </div>

            <details className="gfs-auswertung-grade-table">
              <summary>Punkte-Noten-Tabelle</summary>
              <div className="gfs-auswertung-grade-table-grid">
                {GFS_AUSWERTUNG_POINTS_TO_GRADE.map((row) => (
                  <span key={row.points} className={total === row.points ? 'gfs-auswertung-grade-hit' : ''}>
                    <strong>{row.points}</strong>
                    {' → '}
                    {row.grade}
                  </span>
                ))}
              </div>
            </details>

            <label className="gfs-auswertung-bemerkungen-label">
              Bemerkungen
              <textarea
                className="gfs-auswertung-bemerkungen"
                value={bemerkungen}
                onChange={(e) => setBemerkungen(e.target.value)}
                onBlur={handleBemerkungenBlur}
                rows={3}
                placeholder="Verlaufsprotokoll / Notizen …"
              />
            </label>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
