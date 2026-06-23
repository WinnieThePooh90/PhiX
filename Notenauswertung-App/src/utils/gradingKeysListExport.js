import { buildCourseGradingKeysExportList, buildGradingKeySheetAoa } from './gradingKeyExport';
import { gradingKeyExportFilename, gradingKeysAllExportFilename } from './exportFilenames';
import { downloadMultiSheetXlsx } from './phixXlsxExport';
import { downloadGradingKeyPdf, downloadGradingKeysMultiPagePdf } from './phixPdfExport';

export { buildCourseGradingKeysExportList };

export function buildGradingKeyExportSheets(config) {
  return buildCourseGradingKeysExportList(config).map((entry) => ({
    name: entry.name,
    aoa: buildGradingKeySheetAoa(entry),
    layout: {
      colWidths: [14, 10, 14],
      centerColumnIndexes: [0, 1, 2],
    },
  }));
}

export function exportSingleGradingKey(config, entry, format) {
  const filename = gradingKeyExportFilename(config, entry.name, format);
  if (format === 'pdf') {
    downloadGradingKeyPdf(entry.gradingKey, filename);
  } else {
    downloadMultiSheetXlsx(
      [{ name: entry.name, aoa: buildGradingKeySheetAoa(entry), layout: { colWidths: [14, 10, 14], centerColumnIndexes: [0, 1, 2] } }],
      filename,
    );
  }
  return filename;
}

export function exportAllGradingKeys(config, format) {
  const entries = buildCourseGradingKeysExportList(config);
  const filename = gradingKeysAllExportFilename(config, format);
  if (format === 'pdf') {
    downloadGradingKeysMultiPagePdf(entries, filename);
  } else {
    downloadMultiSheetXlsx(buildGradingKeyExportSheets(config), filename);
  }
  return filename;
}
