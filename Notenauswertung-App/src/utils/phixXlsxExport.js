import * as XLSX from 'xlsx';

/** Excel-Tabellenname: max. 31 Zeichen, keine Duplikate. */
export function uniqueSheetName(base, usedNames) {
  const forbidden = /[\\/?*[\]:]/g;
  let name = String(base || 'Export')
    .replace(forbidden, ' ')
    .trim()
    .slice(0, 31);
  if (!name) name = 'Export';
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }
  let n = 2;
  while (n < 100) {
    const suffix = ` (${n})`;
    const candidate = `${String(base).replace(forbidden, ' ').trim().slice(0, 31 - suffix.length)}${suffix}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    n += 1;
  }
  const fallback = `Blatt ${usedNames.size + 1}`;
  usedNames.add(fallback);
  return fallback;
}

/**
 * @param {{ name: string, aoa: (string|number)[][] }[]} sheets
 * @param {string} filename
 */
export function downloadMultiSheetXlsx(sheets, filename) {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  for (const sheet of sheets ?? []) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.aoa ?? []);
    XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName(sheet.name, used));
  }
  const out = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
}

/**
 * @param {(string|number)[][]} aoa - inkl. Kopfzeile(n)
 * @param {string} sheetName
 * @param {string} filename
 */
export function downloadAoaXlsx(aoa, sheetName, filename) {
  downloadMultiSheetXlsx([{ name: sheetName, aoa }], filename);
}

/**
 * @param {{ headers: string[], rows: (string|number)[][] }} sheetData
 * @param {string} sheetName
 * @param {string} filename
 */
export function downloadSheetDataXlsx(sheetData, sheetName, filename) {
  const aoa = [sheetData.headers, ...(sheetData.rows ?? [])];
  downloadAoaXlsx(aoa, sheetName, filename);
}
