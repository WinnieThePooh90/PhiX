import * as XLSX from 'xlsx';

function normalizeHeaderCell(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Erkennt Spalten anhand typischer Überschriften (erste Zeile). */
function resolveColumnIndices(headerCells) {
  const headers = headerCells.map(normalizeHeaderCell);
  const pick = (candidates) => {
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      if (!h) continue;
      if (candidates.has(h)) return j;
    }
    return -1;
  };
  const klasse = pick(
    new Set(['klasse', 'klassenstufe', 'stufe', 'jahrgang', 'jahrgangsstufe', 'jgst', 'jg']),
  );
  const vorname = pick(new Set(['vorname', 'vornamen']));
  const nachname = pick(new Set(['nachname', 'nachnamen', 'familienname', 'zuname']));
  return { klasse, vorname, nachname };
}

export function parseGradeFromClassCell(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw);
    if (n >= 5 && n <= 13) return n;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/(\d{1,2})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n >= 5 && n <= 13) return n;
  return null;
}

function cellString(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * Liest die erste Tabelle einer Excel-Datei. Erste Zeile = Überschriften (Klasse, Vorname, Nachname).
 * @param {ArrayBuffer} arrayBuffer
 * @returns {{ rows: { gradeLevel: number, firstName: string, lastName: string, _sheetRow: number }[], error?: string, headerIssue?: string }}
 */
export function parseSchoolRosterXlsx(arrayBuffer) {
  let wb;
  try {
    wb = XLSX.read(arrayBuffer, { type: 'array' });
  } catch {
    return { rows: [], error: 'Die Datei konnte nicht als Excel gelesen werden.' };
  }
  if (!wb.SheetNames?.length) return { rows: [], error: 'Die Arbeitsmappe enthält keine Tabellenblätter.' };
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  if (!matrix.length) return { rows: [], error: 'Die Datei enthält keine Zeilen.' };

  const headerRow = matrix[0];
  const { klasse, vorname, nachname } = resolveColumnIndices(headerRow);
  const missing = [];
  if (klasse < 0) missing.push('Klasse');
  if (vorname < 0) missing.push('Vorname');
  if (nachname < 0) missing.push('Nachname');
  if (missing.length) {
    return {
      rows: [],
      error: `Pflicht-Spalten nicht gefunden: ${missing.join(', ')}. Erwartet in der ersten Zeile z. B. „Klasse“, „Vorname“, „Nachname“.`,
    };
  }

  const rows = [];
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i];
    const ln = cellString(line[nachname]);
    const fn = cellString(line[vorname]);
    const gradeRaw = line[klasse];
    const gradeLevel = parseGradeFromClassCell(gradeRaw);
    const sheetRow = i + 1;
    if (!ln && !fn && (gradeRaw === '' || gradeRaw === null || gradeRaw === undefined)) continue;
    if (!ln || !fn) {
      rows.push({ _skip: true, _sheetRow: sheetRow, _reason: !ln && !fn ? 'leer' : 'Vor- oder Nachname fehlt' });
      continue;
    }
    if (gradeLevel == null) {
      rows.push({
        _skip: true,
        _sheetRow: sheetRow,
        _reason: `Klasse „${cellString(gradeRaw)}“ ist keine Stufe 5–13`,
      });
      continue;
    }
    rows.push({ gradeLevel, firstName: fn, lastName: ln, _sheetRow: sheetRow });
  }

  const toImport = rows.filter((r) => !r._skip);
  const skipped = rows.filter((r) => r._skip);
  if (!toImport.length) {
    const msg = skipped.length
      ? 'Keine gültige Schülerzeile: alle Zeilen sind leer oder enthalten Fehler.'
      : 'Nach der Überschriftenzeile wurden keine Datenzeilen gefunden.';
    return { rows: [], skipped, error: msg };
  }
  return { rows: toImport, skipped };
}

/** Hilfetext für den Excel-Import (Schülerverwaltung). */
export const SCHOOL_ROSTER_IMPORT_HELP = [
  'Format: Excel-Datei (.xlsx oder .xls), erstes Tabellenblatt.',
  '',
  'Zeile 1 = Überschriften mit genau diesen Pflicht-Spalten:',
  '• Klasse — auch: Klassenstufe, Stufe, Jahrgang, Jahrgangsstufe, Jgst, JG',
  '• Vorname — auch: Vornamen',
  '• Nachname — auch: Nachnamen, Familienname, Zuname',
  '',
  'Ab Zeile 2: je Schüler eine Zeile. Klasse = Jahrgangsstufe 5–13 (Zahl oder Text mit Zahl, z. B. „7“ oder „Klasse 7“).',
  'Leere Zeilen werden übersprungen. Vor- und Nachname müssen gesetzt sein.',
  '',
  'Der Import gilt für das aktuell gewählte Schuljahr.',
].join('\n');
