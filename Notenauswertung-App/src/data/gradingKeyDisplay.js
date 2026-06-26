import {
  getFormulaKeyIntercept,
  formulaLeftBoundary,
  formatFormulaInterceptDe,
} from './formulaGradingKey';
import { getThresholds } from '../utils/calculator';

export const PLATEAU_KEY_TYPES = ['1', '2', '3'];
export const LINEAR_KEY_TYPES = ['4', '5', '6'];

export function isBuiltinGradingKeyType(type) {
  const t = String(type ?? '');
  return PLATEAU_KEY_TYPES.includes(t) || LINEAR_KEY_TYPES.includes(t);
}

export function isPlateauGradingKeyType(type) {
  return PLATEAU_KEY_TYPES.includes(String(type ?? ''));
}

export function isLinearGradingKeyType(type) {
  return LINEAR_KEY_TYPES.includes(String(type ?? ''));
}

export function getBuiltinGradingKeyTitle(type) {
  const t = String(type ?? '');
  if (t === '1') return 'Plateau 1';
  if (t === '2') return 'Plateau 2';
  if (t === '3') return 'Plateau 3';
  if (t === '4') return 'Linear 1';
  if (t === '5') return 'Linear 2';
  if (t === '6') return 'Linear 3';
  return null;
}

function formatPercentDe(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n)) return '–';
  const rounded = Math.round(n * 10) / 10;
  if (Math.abs(rounded % 1) < 1e-9) return String(Math.round(rounded));
  return rounded.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function getPlateauKeyShortDesc(type, maxPoints) {
  const k = getFormulaKeyIntercept(type);
  const max = Number(maxPoints);
  if (k == null || !Number.isFinite(max) || max <= 0) return '';
  const p2 = (formulaLeftBoundary(2, max, k) / max) * 100;
  const p4 = (formulaLeftBoundary(4, max, k) / max) * 100;
  return `Note 2 ab ${formatPercentDe(p2)}% der Punkte, Note 4 ab ${formatPercentDe(p4)}% der Punkte`;
}

export function getLinearKeyShortDesc(type) {
  const th = getThresholds(type);
  return `Note 2 ab ${formatPercentDe(th.percent2)}% der Punkte, Note 4 ab ${formatPercentDe(th.percent4)}% der Punkte`;
}

export function getBuiltinGradingKeyShortDesc(type, maxPoints) {
  if (isPlateauGradingKeyType(type)) return getPlateauKeyShortDesc(type, maxPoints);
  if (isLinearGradingKeyType(type)) return getLinearKeyShortDesc(type);
  return '';
}

export function getFormulaKeyHelpText(type) {
  const k = getFormulaKeyIntercept(type);
  if (k == null) return '';
  return (
    `Linke Punktgrenze je Note g (1,0 … 6,0 in 0,25er-Schritten): ` +
    `RUNDEN(2·(−0,15·Note+${formatFormulaInterceptDe(k)})·Max)/2 ` +
    `(RUNDEN ergibt 0,5er-Punkte). Rechte Grenze: bei Note 1,0 = Maximalpunktzahl; ` +
    `sonst linke Grenze der vorigen Note minus 0,5 Punkte.`
  );
}
