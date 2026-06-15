import React, { useMemo } from 'react';
import { Trash2, Wrench } from 'lucide-react';
import GradingKeyChart from './GradingKeyChart';
import WarningMarkWithTooltip from './WarningMarkWithTooltip';
import GradingKeyHelpButton from './GradingKeyHelpButton';
import { ABI_BAWUE_2026_120_BE_KEY } from '../data/kmBwAbiPhysik2026GradingKey';
import {
  resolveGradingThresholds,
  pointsFromPercentHalfStep,
  displayPointIntervalsHalfSteps,
  normalizeQuarterGrade,
} from '../utils/calculator';
import { buildFormulaBands, getFormulaKeyIntercept } from '../data/formulaGradingKey';

function formatPointsHalfStepDisplay(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '–';
  const s = Math.abs(x % 1) < 1e-9 ? String(Math.round(x)) : x.toFixed(1);
  return s.replace('.', ',');
}

export default function GradingKeyTable({
  type,
  maxPoints,
  title,
  desc,
  thresholdsOverride,
  customBands,
  pktIntegerDisplay = false,
  titleWarningTooltip = null,
  titleHelpText = null,
  onEdit = null,
  onDelete = null,
}) {
  const t = useMemo(() => resolveGradingThresholds(type, thresholdsOverride), [type, thresholdsOverride]);
  const max = parseFloat(maxPoints) || 0;

  const formulaIntercept = getFormulaKeyIntercept(type);

  const effectiveBands = useMemo(() => {
    if (customBands?.length) return customBands;
    if (formulaIntercept != null && max > 0) return buildFormulaBands(max, formulaIntercept);
    if (type === 'abi') return ABI_BAWUE_2026_120_BE_KEY.bands;
    return null;
  }, [customBands, type, formulaIntercept, max]);

  const pktInt = pktIntegerDisplay || type === 'abi';

  const customPktByGrade = useMemo(() => {
    if (!effectiveBands?.length || max <= 0 || pktInt) return new Map();
    const rows = displayPointIntervalsHalfSteps(max, effectiveBands);
    const m = new Map();
    for (const r of rows) {
      m.set(normalizeQuarterGrade(r.g), r);
    }
    return m;
  }, [effectiveBands, max, pktInt]);

  const isAnchorRow = (grade) => {
    const g = parseFloat(grade);
    return g === 1.0 || g === 2.0 || g === 4.0;
  };

  const anchorRowStyle = { fontWeight: 'bold' };

  const renderRows = () => {
    if (effectiveBands?.length) {
      const sorted = [...effectiveBands].sort((a, b) => Number(a.g) - Number(b.g));
      return sorted.map((s) => {
        const anchor = isAnchorRow(s.g);
        const lo = Number(s.lo);
        const hi = Number(s.hi);
        const pctCell = `${Math.round(lo)}–${Math.round(hi)}%`;
        const gq = normalizeQuarterGrade(s.g);
        const part = customPktByGrade.get(gq);
        let pktCell = '–';
        if (max > 0) {
          if (pktInt) {
            const pktLoInt = Math.max(0, Math.min(max, Math.ceil((max * lo) / 100 - 1e-9)));
            const pktHiInt = Math.max(0, Math.min(max, Math.floor((max * hi) / 100 + 1e-9)));
            pktCell = pktLoInt === pktHiInt ? String(pktLoInt) : `${pktLoInt}–${pktHiInt}`;
          } else if (part) {
            const { pktLo, pktHi } = part;
            pktCell =
              pktLo === pktHi
                ? formatPointsHalfStepDisplay(pktLo)
                : `${formatPointsHalfStepDisplay(pktLo)}–${formatPointsHalfStepDisplay(pktHi)}`;
          } else {
            const rawLo = pointsFromPercentHalfStep(max, lo);
            const rawHi = pointsFromPercentHalfStep(max, hi);
            const pkLo = Math.min(rawLo, rawHi);
            const pkHi = Math.max(rawLo, rawHi);
            pktCell =
              pkLo === pkHi ? formatPointsHalfStepDisplay(pkLo) : `${formatPointsHalfStepDisplay(pkLo)}–${formatPointsHalfStepDisplay(pkHi)}`;
          }
        }
        const gStr = parseFloat(String(s.g)).toFixed(2).replace('.00', '.0');
        return (
          <tr key={String(s.g)} style={anchor ? anchorRowStyle : {}}>
            <td className="text-center" style={{ padding: '0.4rem 0.5rem' }}>{pktCell}</td>
            <td style={{ padding: '0.4rem 0.5rem' }} className="text-center">{gStr}</td>
            <td className="text-center text-muted" style={{ padding: '0.4rem 0.5rem' }}>{pctCell}</td>
          </tr>
        );
      });
    }

    const { percent1, percent2, percent4 } = t;
    const grades = [];

    // 1.0 to 2.0
    const step1to2 = (percent1 - percent2) / 4;
    grades.push({ g: '1.0', p: percent1 });
    grades.push({ g: '1.25', p: percent1 - step1to2 * 1 });
    grades.push({ g: '1.5', p: percent1 - step1to2 * 2 });
    grades.push({ g: '1.75', p: percent1 - step1to2 * 3 });
    grades.push({ g: '2.0', p: percent2 });

    // 2.0 to 4.0
    const step2to4 = (percent2 - percent4) / 8;
    for (let i = 1; i <= 8; i++) {
      grades.push({ g: (2.0 + i * 0.25).toFixed(2), p: percent2 - step2to4 * i });
    }

    // 4.0 to 6.0
    const step4to6 = percent4 / 8;
    for (let i = 1; i <= 8; i++) {
      grades.push({ g: (4.0 + i * 0.25).toFixed(2), p: Math.max(0, percent4 - step4to6 * i) });
    }

    if (t.goodPlateauMin != null && t.badPlateauMax != null) {
      grades[0] = {
        ...grades[0],
        pLabel: `≥ ${t.goodPlateauMin}% … 100%`,
      };
      grades[grades.length - 1] = {
        ...grades[grades.length - 1],
        pLabel: `0% … ≤ ${t.badPlateauMax}%`,
      };
    }

    return grades.map((s) => {
      const anchor = isAnchorRow(s.g);
      const pctCell = s.pLabel ?? `${s.p.toFixed(1)}%`;
      let pktCell = Math.ceil(max * s.p / 100);
      if (s.pLabel && t.goodPlateauMin != null && s.g === '1.0') {
        pktCell = `${Math.ceil((max * t.goodPlateauMin) / 100)}+`;
      } else if (s.pLabel && t.badPlateauMax != null && parseFloat(s.g) === 6) {
        pktCell = `≤ ${Math.ceil((max * t.badPlateauMax) / 100)}`;
      }
      return (
        <tr key={s.g} style={anchor ? anchorRowStyle : {}}>
          <td className="text-center" style={{ padding: '0.4rem 0.5rem' }}>
            {pktCell}
          </td>
          <td style={{ padding: '0.4rem 0.5rem' }} className="text-center">{parseFloat(s.g).toFixed(2).replace('.00', '.0')}</td>
          <td className="text-center text-muted" style={{ padding: '0.4rem 0.5rem', fontSize: s.pLabel ? '0.72rem' : undefined }}>
            {pctCell}
          </td>
        </tr>
      );
    });
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: 0,
        height: 'fit-content',
        border: '1px solid var(--border)',
      }}
    >
      <div className="grading-key-table__header" style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.1rem',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.35rem',
              flexWrap: 'wrap',
              flex: '1 1 auto',
              minWidth: 0,
            }}
          >
            <span>{title}</span>
            {titleWarningTooltip ? <WarningMarkWithTooltip text={titleWarningTooltip} /> : null}
          </h3>
          {titleHelpText || onEdit || onDelete ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                flexShrink: 0,
              }}
            >
              {titleHelpText ? <GradingKeyHelpButton text={titleHelpText} /> : null}
              {onEdit ? (
                <button
                  type="button"
                  className="tab secondary"
                  onClick={onEdit}
                  title="Notenschlüssel bearbeiten"
                  aria-label={`Notenschlüssel bearbeiten: ${title}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '1.65rem',
                    height: '1.65rem',
                    minWidth: '1.65rem',
                    padding: 0,
                  }}
                >
                  <Wrench size={16} strokeWidth={2.25} aria-hidden />
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  className="danger secondary"
                  onClick={onDelete}
                  title="Notenschlüssel löschen"
                  aria-label={`Notenschlüssel löschen: ${title}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '1.65rem',
                    height: '1.65rem',
                    minWidth: '1.65rem',
                    padding: 0,
                  }}
                >
                  <Trash2 size={16} strokeWidth={2.25} aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {desc && <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', fontWeight: 'normal' }}>{desc}</p>}
      </div>
      <table style={{ margin: 0, fontSize: '0.85rem', width: '100%', borderCollapse: 'collapse' }}>
        <thead className="grading-key-table__thead" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
          <tr>
            <th style={{ textAlign: 'center', padding: '0.5rem' }}>PKT</th>
            <th style={{ textAlign: 'center', padding: '0.5rem' }}>Note</th>
            <th style={{ textAlign: 'center', padding: '0.5rem' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {renderRows()}
        </tbody>
      </table>
      <div className="grading-key-table__chart" style={{ padding: '0.75rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
        <GradingKeyChart
          type={type}
          maxPoints={maxPoints}
          thresholdsOverride={thresholdsOverride}
          customBands={effectiveBands ?? undefined}
        />
      </div>
    </div>
  );
}
