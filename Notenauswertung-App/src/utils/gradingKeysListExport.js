import { buildCourseGradingKeysExportList } from './gradingKeyExport';
import { gradingKeyExportFilename, gradingKeysAllExportFilename } from './exportFilenames';
import { rasterizeGradingKeyChartPngDataUrl } from './gradingKeyChartRaster';
import { downloadGradingKeyXlsx, downloadGradingKeysMultiSheetXlsx } from './gradingKeyXlsxExport';
import { downloadGradingKeyPdf, downloadGradingKeysMultiPagePdf } from './phixPdfExport';

export { buildCourseGradingKeysExportList };

async function rasterizeChartsForEntries(entries) {
  const chartPngByEntryId = new Map();
  await Promise.all(
    (entries ?? []).map(async (entry) => {
      const chartPng = entry?.gradingKey?.chart
        ? await rasterizeGradingKeyChartPngDataUrl(entry.gradingKey.chart)
        : null;
      chartPngByEntryId.set(entry.id, chartPng);
    }),
  );
  return chartPngByEntryId;
}

export async function exportSingleGradingKey(config, entry, format) {
  const filename = gradingKeyExportFilename(config, entry.name, format);
  const chartPng = entry?.gradingKey?.chart
    ? await rasterizeGradingKeyChartPngDataUrl(entry.gradingKey.chart)
    : null;
  if (format === 'pdf') {
    downloadGradingKeyPdf(entry.gradingKey, filename, chartPng);
  } else {
    await downloadGradingKeyXlsx(entry, chartPng, filename);
  }
  return filename;
}

export async function exportAllGradingKeys(config, format) {
  const entries = buildCourseGradingKeysExportList(config);
  const filename = gradingKeysAllExportFilename(config, format);
  const chartPngByEntryId = await rasterizeChartsForEntries(entries);
  if (format === 'pdf') {
    downloadGradingKeysMultiPagePdf(entries, filename, chartPngByEntryId);
  } else {
    await downloadGradingKeysMultiSheetXlsx(entries, chartPngByEntryId, filename);
  }
  return filename;
}
