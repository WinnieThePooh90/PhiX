import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  buildBandsFromAnchorThresholds,
  normalizeGradeKeyThresholds,
  displayPointIntervalsHalfSteps,
  normalizeQuarterGrade,
} from '../utils/calculator';
import GradingKeyChart from './GradingKeyChart';
import { isAbiBaWue2026KeyFamilyId } from '../data/kmBwAbiPhysik2026GradingKey';
import { isAbiBaWue2026Mathematik100BeFamilyId } from '../data/abiBaWu2026Mathematik100BeGradingKey';

function formatPointsHalfStepDisplay(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '–';
  const s = Math.abs(x % 1) < 1e-9 ? String(Math.round(x)) : x.toFixed(1);
  return s.replace('.', ',');
}

function cloneBands(bands) {
  return (bands || []).map((row) => ({
    g: Number(row.g),
    lo: Number(row.lo),
    hi: Number(row.hi),
  }));
}

/** Prozentgrenzen für Anzeige und Speicherung auf ganze Zahlen */
function normalizeBandPercentsWhole(bandList) {
  return (bandList || []).map((row) => ({
    g: Number(row.g),
    lo: Math.round(Number(row.lo)),
    hi: Math.round(Number(row.hi)),
  }));
}

function validateBands(bands) {
  if (!bands?.length) return 'Mindestens ein Intervall erforderlich.';
  const rows = cloneBands(bands);
  for (const r of rows) {
    if (!Number.isFinite(r.g) || !Number.isFinite(r.lo) || !Number.isFinite(r.hi)) return 'Alle Felder müssen gültige Zahlen sein.';
    if (r.lo > r.hi) return 'Bei jeder Note muss die untere Prozentgrenze ≤ der oberen sein.';
  }
  const sorted = [...rows].sort((a, b) => a.lo - b.lo);
  if (sorted[0].lo > 0.15) return 'Die Intervalle sollten bei 0 % beginnen (erste Note ab 0 %).';
  if (sorted[sorted.length - 1].hi < 99.85) return 'Die Intervalle sollten bis 100 % reichen.';
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i].lo - sorted[i - 1].hi;
    if (gap > 0.2) return 'Zwischen den Intervallen darf keine große Lücke sein.';
    if (gap < -0.05) return 'Intervalle dürfen sich nicht widersprüchlich überlappen.';
  }
  return null;
}

export default function CustomGradingKeyModal({ open, onClose, initialKey, onSave }) {
  const [name, setName] = useState('');
  const [refMax, setRefMax] = useState(50);
  const [bands, setBands] = useState([]);
  const [anchorP1, setAnchorP1] = useState('95');
  const [anchorP2, setAnchorP2] = useState('75');
  const [anchorP4, setAnchorP4] = useState('45');
  const [anchorGood, setAnchorGood] = useState('');
  const [anchorBad, setAnchorBad] = useState('');
  const [error, setError] = useState(null);
  const [pktIntegerDisplay, setPktIntegerDisplay] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initialKey?.bands?.length) {
      setName(initialKey.name || '');
      setRefMax(Number(initialKey.referenceMaxPoints) > 0 ? Number(initialKey.referenceMaxPoints) : 50);
      setBands(normalizeBandPercentsWhole(cloneBands(initialKey.bands)));
      setPktIntegerDisplay(
        !!initialKey.pktIntegerDisplay ||
          isAbiBaWue2026KeyFamilyId(initialKey.id) ||
          isAbiBaWue2026Mathematik100BeFamilyId(initialKey.id),
      );
      setAnchorP1('95');
      setAnchorP2('75');
      setAnchorP4('45');
      setAnchorGood('');
      setAnchorBad('');
    } else {
      setName('');
      setRefMax(50);
      setPktIntegerDisplay(false);
      const built = buildBandsFromAnchorThresholds(
        { percent1: '95', percent2: '75', percent4: '45' },
        50,
        8000,
      );
      setBands(normalizeBandPercentsWhole(built || []));
      setAnchorP1('95');
      setAnchorP2('75');
      setAnchorP4('45');
      setAnchorGood('');
      setAnchorBad('');
    }
  }, [open, initialKey?.id]);

  const applyAnchors = () => {
    setError(null);
    const raw = {
      percent1: anchorP1,
      percent2: anchorP2,
      percent4: anchorP4,
      goodPlateauMin: anchorGood.trim() === '' ? undefined : anchorGood,
      badPlateauMax: anchorBad.trim() === '' ? undefined : anchorBad,
    };
    const norm = normalizeGradeKeyThresholds(raw);
    if (!norm) {
      setError('Anker: bitte drei gültige Prozentwerte eingeben.');
      return;
    }
    const ref = Math.max(1, Number(refMax) || 50);
    const built = buildBandsFromAnchorThresholds(raw, ref, 8000);
    if (!built?.length) {
      setError('Intervalle konnten nicht berechnet werden.');
      return;
    }
    setBands(normalizeBandPercentsWhole([...built].sort((a, b) => Number(a.g) - Number(b.g))));
  };

  const updateBandField = (gradeVal, key, raw) => {
    setBands((prev) => prev.map((b) => (Number(b.g) === Number(gradeVal) ? { ...b, [key]: raw } : b)));
  };

  const commitBandNumber = (gradeVal, key, raw) => {
    const n = parseFloat(String(raw).replace(',', '.'));
    setBands((prev) =>
      prev.map((b) => {
        if (Number(b.g) !== Number(gradeVal)) return b;
        if (!Number.isFinite(n)) return b;
        const v = key === 'lo' || key === 'hi' ? Math.round(n) : n;
        return { ...b, [key]: v };
      }),
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Bitte einen Namen für den Notenschlüssel eingeben.');
      return;
    }
    const msg = validateBands(bands);
    if (msg) {
      setError(msg);
      return;
    }
    const sorted = normalizeBandPercentsWhole(cloneBands(bands).sort((a, b) => a.lo - b.lo));
    onSave({
      id: initialKey?.id || `ck_${Date.now()}`,
      name: trimmed,
      referenceMaxPoints: Math.max(1, Number(refMax) || 50),
      bands: sorted,
      ...(pktIntegerDisplay ? { pktIntegerDisplay: true } : {}),
    });
    onClose();
  };

  const ref = Math.max(1, Number(refMax) || 50);
  const pktByGrade = useMemo(() => {
    if (pktIntegerDisplay || !bands?.length || ref <= 0) return new Map();
    const m = new Map();
    for (const r of displayPointIntervalsHalfSteps(ref, bands)) {
      m.set(normalizeQuarterGrade(r.g), r);
    }
    return m;
  }, [bands, ref, pktIntegerDisplay]);

  if (!open) return null;

  const rowsByGrade = [...bands].sort((a, b) => Number(a.g) - Number(b.g));

  return createPortal(
    <div
      className="modal-overlay"
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-key-modal-title"
        style={{
          maxWidth: 'min(52rem, 100%)',
          maxHeight: 'min(90vh, 100%)',
          overflow: 'auto',
          padding: '1.25rem',
          width: '100%',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="custom-key-modal-title" style={{ marginTop: 0 }}>
          {initialKey ? 'Notenschlüssel bearbeiten' : 'Neuen Notenschlüssel erstellen'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', maxWidth: '28rem', padding: '0.4rem' }}
              placeholder="z. B. Klassenarbeit Maßstab"
            />
          </div>

          <div className="flex flex-wrap gap-4 mb-4" style={{ alignItems: 'flex-end' }}>
            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.25rem' }}>
                Referenz-Maximalpunkte (für Punkt-Spalte)
              </label>
              <input
                type="number"
                min={1}
                value={refMax}
                onChange={(e) => setRefMax(parseFloat(e.target.value) || 50)}
                style={{ width: '5rem', padding: '0.35rem' }}
              />
            </div>
          </div>

          <fieldset className="mb-4" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem' }}>
            <legend className="text-muted" style={{ fontSize: '0.85rem' }}>
              Schnellfüllung aus Ankern (wie Schlüssel 1–6)
            </legend>
            <div className="flex flex-wrap gap-3 mb-2" style={{ alignItems: 'flex-end' }}>
              <div>
                <label className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>1,0 ab %</label>
                <input value={anchorP1} onChange={(e) => setAnchorP1(e.target.value)} style={{ width: '4.5rem', padding: '0.3rem' }} />
              </div>
              <div>
                <label className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>2,0 ab %</label>
                <input value={anchorP2} onChange={(e) => setAnchorP2(e.target.value)} style={{ width: '4.5rem', padding: '0.3rem' }} />
              </div>
              <div>
                <label className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>4,0 ab %</label>
                <input value={anchorP4} onChange={(e) => setAnchorP4(e.target.value)} style={{ width: '4.5rem', padding: '0.3rem' }} />
              </div>
              <div>
                <label className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Plateau 1,0 ab %</label>
                <input value={anchorGood} onChange={(e) => setAnchorGood(e.target.value)} placeholder="opt." style={{ width: '4.5rem', padding: '0.3rem' }} />
              </div>
              <div>
                <label className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Plateau 6,0 bis %</label>
                <input value={anchorBad} onChange={(e) => setAnchorBad(e.target.value)} placeholder="opt." style={{ width: '4.5rem', padding: '0.3rem' }} />
              </div>
              <button type="button" className="tab secondary" onClick={applyAnchors}>
                Intervalle aus Ankern berechnen
              </button>
            </div>
          </fieldset>

          <p className="text-muted mb-2" style={{ fontSize: '0.82rem', margin: 0 }}>
            Prozent- und Punktgrenzen je Note (Referenz-Maximalpunkte). Spalten: Min/Max Pkt, Note, Min/Max %. Prozent: 0–100 % lückenlos. Min/Max Pkt: lückenloses 0,5-Punkte-Raster gemäß Notenzuordnung (keine doppelte Grenze zwischen zwei Noten).
          </p>

          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface)' }}>
                  <th style={{ padding: '0.4rem' }}>Min Pkt</th>
                  <th style={{ padding: '0.4rem' }}>Max Pkt</th>
                  <th style={{ padding: '0.4rem', textAlign: 'left' }}>Note</th>
                  <th style={{ padding: '0.4rem' }}>Min %</th>
                  <th style={{ padding: '0.4rem' }}>Max %</th>
                </tr>
              </thead>
              <tbody>
                {rowsByGrade.map((b) => {
                  const row = bands.find((x) => Number(x.g) === Number(b.g)) || b;
                  const part = pktByGrade.get(normalizeQuarterGrade(b.g));
                  const gLabel = Number.isInteger(b.g) ? `${b.g},0` : String(b.g).replace('.', ',');
                  const loN = Number(row.lo);
                  const hiN = Number(row.hi);
                  let minPkt = '–';
                  let maxPkt = '–';
                  if (ref > 0 && Number.isFinite(loN) && Number.isFinite(hiN)) {
                    if (pktIntegerDisplay) {
                      const a = Math.max(0, Math.min(ref, Math.ceil((ref * loN) / 100 - 1e-9)));
                      const c = Math.max(0, Math.min(ref, Math.floor((ref * hiN) / 100 + 1e-9)));
                      minPkt = String(a);
                      maxPkt = String(c);
                    } else if (part) {
                      minPkt = formatPointsHalfStepDisplay(part.pktLo);
                      maxPkt = formatPointsHalfStepDisplay(part.pktHi);
                    }
                  }
                  return (
                    <tr key={`g-${b.g}`} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="text-muted" style={{ padding: '0.35rem' }}>
                        {minPkt}
                      </td>
                      <td className="text-muted" style={{ padding: '0.35rem' }}>
                        {maxPkt}
                      </td>
                      <td style={{ padding: '0.35rem' }}>{gLabel}</td>
                      <td style={{ padding: '0.35rem' }}>
                        <input
                          value={row.lo}
                          onChange={(e) => updateBandField(b.g, 'lo', e.target.value)}
                          onBlur={(e) => commitBandNumber(b.g, 'lo', e.target.value)}
                          style={{ width: '4.5rem', padding: '0.25rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.35rem' }}>
                        <input
                          value={row.hi}
                          onChange={(e) => updateBandField(b.g, 'hi', e.target.value)}
                          onBlur={(e) => commitBandNumber(b.g, 'hi', e.target.value)}
                          style={{ width: '4.5rem', padding: '0.25rem' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'hsl(var(--muted) / 0.2)',
            }}
          >
            <p className="text-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
              Diagramm des eingestellten Schlüssels (Referenz: {ref} Maximalpunkte)
            </p>
            {bands?.length > 0 && ref > 0 ? (
              <GradingKeyChart type="1" maxPoints={ref} customBands={bands} />
            ) : (
              <p className="text-muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                Sobald Intervalle vorhanden sind, erscheint hier der Verlauf Punkte → Note.
              </p>
            )}
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.88rem', marginBottom: '0.75rem' }} role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 flex-wrap" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="tab secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="tab">
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
