import { downloadSheetDataXlsx } from './phixXlsxExport';

/** @deprecated Nutze downloadSheetDataXlsx — Alias für Übersicht-Export. */
export function downloadSummaryOverviewXlsx(sheetData, filename) {
  downloadSheetDataXlsx(sheetData, 'Übersicht', filename);
}

export { downloadAoaXlsx, downloadSheetDataXlsx } from './phixXlsxExport';
