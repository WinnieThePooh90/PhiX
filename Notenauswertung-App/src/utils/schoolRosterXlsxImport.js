import * as XLSX from 'xlsx';
import { parseClassSectionFromClassCell } from './schoolRosterClass';

const COL_KLASSE = 0;
const COL_VORNAME = 1;
const COL_NACHNAME = 2;

function normalizeHeaderCell(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function detectCsvDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const sc = (firstLine.match(/;/g) || []).length;
  const cc = (firstLine.match(/,/g) || []).length;
  return sc >= cc ? ';' : ',';
}

function isHeaderRow(cells) {
  const klasse = normalizeHeaderCell(cells[COL_KLASSE]);
  const vorname = normalizeHeaderCell(cells[COL_VORNAME]);
  const nachname = normalizeHeaderCell(cells[COL_NACHNAME]);
  if (
    klasse.includes('klasse') ||
    klasse.includes('stufe') ||
    klasse.includes('jahrgang') ||
    klasse === 'jgst' ||
    klasse === 'jg'
  ) {
    return true;
  }
  if (vorname === 'vorname' || vorname === 'vornamen') return true;
  if (
    nachname === 'nachname' ||
    nachname === 'nachnamen' ||
    nachname === 'familienname' ||
    nachname === 'zuname'
  ) {
    return true;
  }
  return false;
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

function readSchoolRosterMatrix(arrayBuffer, filename = '') {
  const lower = String(filename).toLowerCase();
  const isCsv = lower.endsWith('.csv');
  try {
    if (isCsv) {
      const text = new TextDecoder('utf-8').decode(arrayBuffer);
      const wb = XLSX.read(text, { type: 'string', FS: detectCsvDelimiter(text), raw: false });
      if (!wb.SheetNames?.length) return { matrix: [], error: 'Die CSV-Datei enthält keine Daten.' };
      const sheet = wb.Sheets[wb.SheetNames[0]];
      return { matrix: XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) };
    }
    const wb = XLSX.read(arrayBuffer, { type: 'array', raw: false });
    if (!wb.SheetNames?.length) {
      return { matrix: [], error: 'Die Arbeitsmappe enthält keine Tabellenblätter.' };
    }
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return { matrix: XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) };
  } catch {
    return {
      matrix: [],
      error: isCsv
        ? 'Die Datei konnte nicht als CSV gelesen werden.'
        : 'Die Datei konnte nicht als Excel gelesen werden.',
    };
  }
}

/**
 * Spalten 1–3: Klasse (inkl. Teilklasse), Vorname, Nachname; weitere Spalten werden ignoriert.
 * @param {unknown[][]} matrix
 */
export function parseSchoolRosterMatrix(matrix) {
  if (!matrix.length) return { rows: [], error: 'Die Datei enthält keine Zeilen.' };

  let startRow = 0;
  if (isHeaderRow(matrix[0])) startRow = 1;

  const rows = [];
  for (let i = startRow; i < matrix.length; i++) {
    const line = matrix[i];
    const ln = cellString(line[COL_NACHNAME]);
    const fn = cellString(line[COL_VORNAME]);
    const gradeRaw = line[COL_KLASSE];
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
    rows.push({
      gradeLevel,
      classSection: parseClassSectionFromClassCell(gradeRaw),
      firstName: fn,
      lastName: ln,
      _sheetRow: sheetRow,
    });
  }

  const toImport = rows.filter((r) => !r._skip);
  const skipped = rows.filter((r) => r._skip);
  if (!toImport.length) {
    const msg = skipped.length
      ? 'Keine gültige Schülerzeile: alle Zeilen sind leer oder enthalten Fehler.'
      : startRow >= matrix.length
        ? 'Nach der optionalen Überschriftenzeile wurden keine Datenzeilen gefunden.'
        : 'Es wurden keine Datenzeilen gefunden.';
    return { rows: [], skipped, error: msg };
  }
  return { rows: toImport, skipped };
}

/**
 * Liest CSV (.csv) oder Excel (.xlsx/.xls). Erste drei Spalten: Klasse, Vorname, Nachname.
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} [filename]
 */
export function parseSchoolRosterImportFile(arrayBuffer, filename = '') {
  const { matrix, error } = readSchoolRosterMatrix(arrayBuffer, filename);
  if (error) return { rows: [], error };
  return parseSchoolRosterMatrix(matrix);
}

/** Hilfetext für den Datei-Import (Schülerverwaltung). */
export const SCHOOL_ROSTER_IMPORT_HELP = [
  'Format: CSV (.csv) oder Excel (.xlsx / .xls), erstes Tabellenblatt bzw. die gesamte CSV.',
  '',
  'Die ersten drei Spalten (weitere Spalten werden ignoriert):',
  '• Spalte 1 — Klasse inkl. Teilklasse, z. B. „10a“ oder „Klasse 10a“',
  '• Spalte 2 — Vorname',
  '• Spalte 3 — Nachname',
  '',
  'Optional kann Zeile 1 eine Überschriftenzeile sein (z. B. Klasse, Vorname, Nachname); sie wird dann übersprungen.',
  'Aus der Klasse werden Jahrgangsstufe 5–13 und Teilklasse ermittelt (z. B. „10a“ → Stufe 10, Teilklasse a).',
  'Leere Zeilen werden übersprungen. Vor- und Nachname müssen gesetzt sein.',
  '',
  'Der Import gilt für das aktuell gewählte Schuljahr.',
].join('\n');
