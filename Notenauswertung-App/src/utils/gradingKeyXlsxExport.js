import { uniqueSheetName } from './phixXlsxExport';
import { buildGradingKeySheetAoa } from './gradingKeyExport';
import { pngDataUrlToBase64 } from './gradingKeyChartRaster';
import { GRADING_KEY_CHART_EXPORT_HEIGHT, GRADING_KEY_CHART_EXPORT_WIDTH } from './gradingKeyChartSvg';

async function createWorkbook() {
  const ExcelJS = (await import('exceljs')).default;
  return new ExcelJS.Workbook();
}

function triggerBlobDownload(buffer, filename) {
  const out = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = out;
  anchor.click();
  URL.revokeObjectURL(url);
}

function applyGradingKeySheetLayout(ws, aoa) {
  ws.columns = [
    { width: 14 },
    { width: 10 },
    { width: 14 },
  ];
  for (let r = 0; r < aoa.length; r += 1) {
    const row = ws.getRow(r + 1);
    for (let c = 1; c <= 3; c += 1) {
      const cell = row.getCell(c);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
  }
}

/**
 * @param {{ name: string, gradingKey: object }} entry
 * @param {string|null} chartPngDataUrl
 */
async function appendGradingKeySheet(wb, entry, chartPngDataUrl, usedNames) {
  const sheetName = uniqueSheetName(entry.name, usedNames);
  const ws = wb.addWorksheet(sheetName);
  const aoa = buildGradingKeySheetAoa(entry);
  aoa.forEach((cells) => ws.addRow(cells));
  applyGradingKeySheetLayout(ws, aoa);

  const chartBase64 = pngDataUrlToBase64(chartPngDataUrl);
  if (chartBase64) {
    const imageId = wb.addImage({
      base64: chartBase64,
      extension: 'png',
    });
    const chartRow = aoa.length + 1;
    ws.addImage(imageId, {
      tl: { col: 0, row: chartRow },
      ext: { width: GRADING_KEY_CHART_EXPORT_WIDTH, height: GRADING_KEY_CHART_EXPORT_HEIGHT },
    });
    ws.getRow(chartRow).height = GRADING_KEY_CHART_EXPORT_HEIGHT / 4;
  }
}

/**
 * @param {{ name: string, gradingKey: object }} entry
 * @param {string|null} chartPngDataUrl
 * @param {string} filename
 */
export async function downloadGradingKeyXlsx(entry, chartPngDataUrl, filename) {
  const wb = await createWorkbook();
  const used = new Set();
  await appendGradingKeySheet(wb, entry, chartPngDataUrl, used);
  const buffer = await wb.xlsx.writeBuffer();
  triggerBlobDownload(buffer, filename);
}

/**
 * @param {{ name: string, gradingKey: object }[]} entries
 * @param {Map<string, string|null>|Record<string, string|null>} chartPngByEntryId
 * @param {string} filename
 */
export async function downloadGradingKeysMultiSheetXlsx(entries, chartPngByEntryId, filename) {
  const wb = await createWorkbook();
  const used = new Set();
  for (const entry of entries ?? []) {
    const chartPng = chartPngByEntryId instanceof Map
      ? chartPngByEntryId.get(entry.id)
      : chartPngByEntryId?.[entry.id];
    await appendGradingKeySheet(wb, entry, chartPng ?? null, used);
  }
  const buffer = await wb.xlsx.writeBuffer();
  triggerBlobDownload(buffer, filename);
}
