export const ORAL_EXTENDED_OFF = 'off';
export const ORAL_EXTENDED_POINTS = 'points';
export const ORAL_EXTENDED_GRADES = 'grades';

export const ORAL_EXTENDED_MODE_ORDER = [
  ORAL_EXTENDED_OFF,
  ORAL_EXTENDED_POINTS,
  ORAL_EXTENDED_GRADES,
];

/** @returns {'off' | 'points' | 'grades'} */
export function normalizeOralExtendedMode(raw, legacyExtended) {
  const s = String(raw ?? '').toLowerCase();
  if (s === ORAL_EXTENDED_POINTS || s === ORAL_EXTENDED_GRADES || s === ORAL_EXTENDED_OFF) return s;
  if (legacyExtended === true || raw === true) return ORAL_EXTENDED_POINTS;
  return ORAL_EXTENDED_OFF;
}

/** @returns {'off' | 'points' | 'grades'} */
export function getOralExtendedMode(oral) {
  return normalizeOralExtendedMode(oral?.extendedMode, oral?.extended);
}

export function isOralExtendedPoints(oral) {
  return getOralExtendedMode(oral) === ORAL_EXTENDED_POINTS;
}

export function isOralExtendedGrades(oral) {
  return getOralExtendedMode(oral) === ORAL_EXTENDED_GRADES;
}

export function isOralExtendedActive(oral) {
  const mode = getOralExtendedMode(oral);
  return mode === ORAL_EXTENDED_POINTS || mode === ORAL_EXTENDED_GRADES;
}

export function getOralExtendedModeLabel(mode) {
  const m = normalizeOralExtendedMode(mode);
  if (m === ORAL_EXTENDED_POINTS) return 'Erweitert: Punkte';
  if (m === ORAL_EXTENDED_GRADES) return 'Erweitert: Noten';
  return 'Erweitert';
}

export function cycleOralExtendedMode(current) {
  const m = normalizeOralExtendedMode(current);
  if (m === ORAL_EXTENDED_OFF) return ORAL_EXTENDED_POINTS;
  if (m === ORAL_EXTENDED_POINTS) return ORAL_EXTENDED_GRADES;
  return ORAL_EXTENDED_OFF;
}
