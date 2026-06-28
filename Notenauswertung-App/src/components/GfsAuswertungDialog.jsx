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
import { downloadGfsAuswertungPdf, gfsAuswertungPdfFilename } from '../utils/gfsAuswertungPdfExport';
import { useDialog } from './PhixDialog';

export default function GfsAuswertungDialog({
  open,
  onClose,
  studentName,
  titleLabel = 'GFS-Auswertung',
  gradeSystem = 'classic',
  auswertungHilfe,
  onSave,
}) {
  const { showConfirm, showAlert } = useDialog();
  const [exportBusy, setExportBusy] = useState(false);
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
  const suggestedGrade = suggestGradeFromGfsAuswertungPoints(total, gradeSystem);
  const isPointsMode = gradeSystem === 'points';

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

  const handleReset = async () => {
    const ok = await showConfirm(
      'Alle ausgewählten Kriterien und Bemerkungen werden gelöscht.',
      {
        title: 'Reset durchführen',
        confirmLabel: 'Reset durchführen',
        cancelLabel: 'Abbrechen',
        danger: true,
      },
    );
    if (!ok) return;
    setScores({});
    setBemerkungen('');
    persist({ scores: {}, bemerkungen: '' });
  };

  const handleExportPdf = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      downloadGfsAuswertungPdf({
        titleLabel,
        studentName,
        gradeSystem,
        scores,
        bemerkungen,
        filename: gfsAuswertungPdfFilename(titleLabel, studentName),
      });
    } catch (err) {
      await showAlert(err?.message || 'PDF-Export fehlgeschlagen.', { title: 'Export' });
    } finally {
      setExportBusy(false);
    }
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
        <div className="oral-formula-modal-header gfs-auswertung-header">
          <h2 id="gfs-auswertung-title" style={{ margin: 0, fontSize: '1.05rem' }}>
            {titleLabel} — {studentName}
          </h2>
          <div className="gfs-auswertung-header-actions">
            <button type="button" className="tab secondary danger" onClick={handleReset}>
              Reset
            </button>
            <button
              type="button"
              className="tab secondary"
              onClick={handleExportPdf}
              disabled={exportBusy}
            >
              {exportBusy ? 'Export …' : 'Export als PDF'}
            </button>
            <button type="button" className="tab secondary" onClick={onClose} aria-label="Schließen">
              Schließen
            </button>
          </div>
        </div>
        <div className="oral-formula-modal-body gfs-auswertung-body">
          <div className="gfs-auswertung-table-wrap">
            <table className="gfs-auswertung-table">
              <colgroup>
                <col className="gfs-auswertung-col-criterion" />
                {GFS_AUSWERTUNG_POINT_LEVELS.map((p) => (
                  <col key={p} className="gfs-auswertung-col-points" />
                ))}
              </colgroup>
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
                      const { gridPoint, description } = cell;
                      const selected = scores[criterion.id] === gridPoint;
                      return (
                        <td key={`${criterion.id}-${gridPoint}`} className="gfs-auswertung-td">
                          <button
                            type="button"
                            className={`gfs-auswertung-cell${selected ? ' gfs-auswertung-cell--selected' : ''}`}
                            onClick={() => handleSelect(criterion.id, gridPoint)}
                            aria-pressed={selected}
                            aria-label={`${criterion.label}: ${gridPoint} Punkte — ${description}`}
                            title={description}
                          >
                            {description}
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
              <span className="gfs-auswertung-sum-total">
                <strong>Summe:</strong>
                {' '}
                {total} Punkte
                {filled > 0 && filled < GFS_AUSWERTUNG_CRITERIA.length ? (
                  <span className="text-muted" style={{ marginLeft: '0.5rem', fontWeight: 'normal' }}>
                    ({filled} von {GFS_AUSWERTUNG_CRITERIA.length} Kriterien)
                  </span>
                ) : null}
              </span>
              <span className="gfs-auswertung-sum-grade">
                <strong>Vorgeschlagene Note:</strong>
                {' '}
                {isPointsMode ? `${suggestedGrade} NP` : suggestedGrade}
              </span>
            </div>

            <details className="gfs-auswertung-grade-table">
              <summary>{isPointsMode ? 'Punkte-Notenpunkte-Tabelle' : 'Punkte-Noten-Tabelle'}</summary>
              <div className="gfs-auswertung-grade-table-grid">
                {GFS_AUSWERTUNG_POINTS_TO_GRADE.map((row) => {
                  const gradeLabel = isPointsMode
                    ? suggestGradeFromGfsAuswertungPoints(row.points, 'points')
                    : row.grade;
                  return (
                    <span key={row.points} className={total === row.points ? 'gfs-auswertung-grade-hit' : ''}>
                      <strong>{row.points}</strong>
                      {' → '}
                      {isPointsMode ? `${gradeLabel} NP` : gradeLabel}
                    </span>
                  );
                })}
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
