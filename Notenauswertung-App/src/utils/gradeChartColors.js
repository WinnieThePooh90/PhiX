import {
  barColorForNotenpunkte,
  classicGradeColorTier,
  normalizeQuarterGrade,
} from './calculator';

/** Farbe für NP-Säule (drei Stufen). */
export function barColorForNpBucket(np) {
  return barColorForNotenpunkte(np);
}

/** Klassische Ganzzahl-Note (Verteilung Analyse, Buckets 1–6). */
export function barColorForClassicDistributionGrade(grade) {
  if (grade === 4) return '#f59e0b';
  if (grade >= 5) return 'var(--danger)';
  return 'hsl(var(--success-hsl))';
}

/** Klassische Viertelnote (Klausur-/Test-Diagramme). */
export function barColorForClassicQuarterGrade(grade) {
  const tier = classicGradeColorTier(normalizeQuarterGrade(grade));
  if (tier === 'red') return 'var(--danger)';
  if (tier === 'orange') return '#facc15';
  return 'hsl(var(--success-hsl))';
}
