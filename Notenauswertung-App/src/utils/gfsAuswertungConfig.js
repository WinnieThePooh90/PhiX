/** Kriterien aus GFS-Auswertungsbogen (Paulokat) – Spalten 4 bis 0. */
export const GFS_AUSWERTUNG_POINT_LEVELS = [4, 3, 2, 1, 0];

export const GFS_AUSWERTUNG_CRITERIA = [
  {
    id: 'fachlicheRichtigkeit',
    label: 'Fachliche Richtigkeit',
    descriptions: {
      4: 'Alles richtig',
      3: 'Wenige Fehler, unbedeutend',
      2: 'Mehrfache Fehler, aber im Ganzen noch verwertbar',
      1: 'Häufige Fehler, nur in Teilen verwertbar',
      0: 'Viele Fehler, nicht verwertbar',
    },
  },
  {
    id: 'vollstaendigkeit',
    label: 'Vollständigkeit',
    descriptions: {
      4: 'Vollständig',
      3: 'Geringe Lücken, unbedeutend',
      2: 'Mehrfache Lücken',
      1: 'Viele Lücken',
      0: '',
    },
  },
  {
    id: 'gliederung',
    label: 'Gliederung',
    descriptions: {
      4: 'Klar, durchschaubar',
      3: 'Linie soeben erkennbar',
      2: 'Unsystematisch, unklar',
      1: '',
      0: '',
    },
  },
  {
    id: 'vortragSprechweise',
    label: 'Vortrags- und Sprechweise',
    descriptions: {
      4: 'Sicher, flüssig',
      3: 'Manchmal unsicher, zu schnell',
      2: 'Häufig unsicher, viel zu schnell',
      1: 'Unsicher, stockend, nur vorgelesen',
      0: '',
    },
  },
  {
    id: 'fachsprache',
    label: 'Fachsprache',
    descriptions: {
      4: 'Immer korrekt',
      3: '',
      2: 'Nicht immer korrekt',
      1: '',
      0: '',
    },
  },
  {
    id: 'interaktion',
    label: 'Interaktion mit Zuhörern',
    descriptions: {
      4: 'Guter, ständiger Kontakt',
      3: '',
      2: 'Nur teilweise bzw. unsicherer Kontakt',
      1: '',
      0: 'Kein Kontakt',
    },
  },
  {
    id: 'medieneinsatz',
    label: 'Medieneinsatz',
    descriptions: {
      4: 'Angemessen, hilfreich, sicher im Umgang',
      3: '',
      2: 'Manchmal nicht angemessen und unsicher',
      1: '',
      0: 'Nicht hilfreich, unsicher, nicht angemessen',
    },
  },
  {
    id: 'vorbereitung',
    label: 'Vorbereitung',
    descriptions: {
      4: 'Selbstständig, pünktlich',
      3: 'durchschnittlich',
      2: 'Unselbstständig, unpünktlich',
      1: '',
      0: '',
    },
  },
  {
    id: 'schriftlichePraesentation',
    label: 'Schriftliche Präsentation (PowerPoint, Tafel, etc.)',
    descriptions: {
      4: 'Vollständig, gute Gestaltung, mit Quellen',
      3: 'Teilweise Lücken, mittelmäßige Gestaltung',
      2: 'Gerade ausreichend',
      1: 'Große Lücken, mangelhafte Gestaltung, ohne Quellen',
      0: '',
    },
  },
  {
    id: 'abschliessendeFragen',
    label: 'Abschließende Fragen',
    descriptions: {
      4: 'Zum größten Teil richtig beantwortet',
      3: '',
      2: 'Mit mehreren Fehlern beantwortet',
      1: '',
      0: 'Nicht oder zum Großteil falsch beantwortet',
    },
  },
];

/** Stufen mit Beschreibungstext (absteigend: 4 → 0). */
export function getGfsCriterionActiveLevels(criterion) {
  return GFS_AUSWERTUNG_POINT_LEVELS.filter(
    (p) => (criterion.descriptions[p] ?? '').trim() !== '',
  );
}

/**
 * Tabellenzeile je Kriterium: befüllte Zellen rechtsbündig, leere Platzhalter immer links.
 * Gewertete Punkte = Spaltenüberschrift (4 … 0); Beschreibungstexte der Stufen von hoch nach tief.
 */
export function buildGfsCriterionRowCells(criterion) {
  const activeLevels = getGfsCriterionActiveLevels(criterion);
  const emptyLeft = GFS_AUSWERTUNG_POINT_LEVELS.length - activeLevels.length;

  return GFS_AUSWERTUNG_POINT_LEVELS.map((gridPoint, colIndex) => {
    const slot = colIndex - emptyLeft;
    if (slot < 0) {
      return { type: 'empty', gridPoint };
    }
    const rubricPoint = activeLevels[slot];
    return {
      type: 'active',
      gridPoint,
      pointValue: gridPoint,
      description: (criterion.descriptions[rubricPoint] ?? '').trim(),
    };
  });
}

/** Punkte → Note laut Auswertungsbogen (absteigend). */
export const GFS_AUSWERTUNG_POINTS_TO_GRADE = [
  { points: 24, grade: '1' },
  { points: 23, grade: '1' },
  { points: 22, grade: '1' },
  { points: 21, grade: '1-' },
  { points: 20, grade: '1,5' },
  { points: 19, grade: '2+' },
  { points: 18, grade: '2' },
  { points: 17, grade: '2-' },
  { points: 16, grade: '2,5' },
  { points: 15, grade: '3+' },
  { points: 14, grade: '3' },
  { points: 13, grade: '3-' },
  { points: 12, grade: '3,5' },
  { points: 11, grade: '4+' },
  { points: 10, grade: '4' },
  { points: 9, grade: '4-' },
  { points: 8, grade: '4,5' },
  { points: 7, grade: '5+' },
  { points: 6, grade: '5' },
  { points: 5, grade: '5-' },
  { points: 4, grade: '5,5' },
  { points: 3, grade: '6+' },
  { points: 2, grade: '6' },
];

export function parseGfsAuswertungHilfe(raw) {
  const empty = { scores: {}, bemerkungen: '' };
  if (raw == null || raw === '') return empty;
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return empty;
    }
  }
  if (typeof data !== 'object' || Array.isArray(data)) return empty;
  const scores = {};
  if (data.scores && typeof data.scores === 'object' && !Array.isArray(data.scores)) {
    for (const c of GFS_AUSWERTUNG_CRITERIA) {
      const v = data.scores[c.id];
      if (v === '' || v == null) continue;
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 4) scores[c.id] = n;
    }
  }
  return {
    scores,
    bemerkungen: String(data.bemerkungen ?? ''),
  };
}

export function countGfsAuswertungFilled(scores) {
  return GFS_AUSWERTUNG_CRITERIA.filter((c) => scores[c.id] != null).length;
}

export function sumGfsAuswertungScores(scores) {
  return GFS_AUSWERTUNG_CRITERIA.reduce((sum, c) => {
    const v = scores[c.id];
    if (v == null) return sum;
    return sum + Number(v);
  }, 0);
}

export function suggestGradeFromGfsAuswertungPoints(totalPoints) {
  const p = Math.round(Number(totalPoints));
  if (!Number.isFinite(p) || p < 0) return '6';
  for (const row of GFS_AUSWERTUNG_POINTS_TO_GRADE) {
    if (p >= row.points) return row.grade;
  }
  return '6';
}

export function formatGfsAuswertungSummary(scores) {
  const filled = countGfsAuswertungFilled(scores);
  if (filled === 0) return null;
  const sum = sumGfsAuswertungScores(scores);
  const grade = suggestGradeFromGfsAuswertungPoints(sum);
  return { filled, sum, grade };
}
