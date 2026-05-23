import * as XLSX from 'xlsx';

/**
 * @param {{ headers: string[], rows: (string|number)[][] }} sheetData
 * @param {string} filename
 */
export function downloadSummaryOverviewXlsx(sheetData, filename) {
  const aoa = [sheetData.headers, ...(sheetData.rows ?? [])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Übersicht');
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
