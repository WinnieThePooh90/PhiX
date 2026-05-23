import * as XLSX from 'xlsx';

/**
 * @param {(string|number)[][]} aoa - inkl. Kopfzeile(n)
 * @param {string} sheetName
 * @param {string} filename
 */
export function downloadAoaXlsx(aoa, sheetName, filename) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  const safeSheet = String(sheetName || 'Export').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);
  const out = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
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
