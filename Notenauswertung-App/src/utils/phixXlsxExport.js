import * as XLSX from 'xlsx-js-style';

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
 * @typedef {{ colWidths?: number[], centerColumnIndexes?: number[], nameColumnIndex?: number }} XlsxSheetLayout
 */

/**
 * @param {import('xlsx-js-style').WorkSheet} ws
 * @param {(string|number)[][]} aoa
 * @param {XlsxSheetLayout} [layout]
 */
function applyWorksheetLayout(ws, aoa, layout) {
  if (!layout || !aoa?.length) return;

  const colCount = Math.max(...aoa.map((row) => row.length), 1);

  if (Array.isArray(layout.colWidths)) {
    ws['!cols'] = Array.from({ length: colCount }, (_, i) => ({
      wch: layout.colWidths[i] ?? 10,
    }));
  }

  const centerCols = new Set(layout.centerColumnIndexes ?? []);
  const nameCol = layout.nameColumnIndex;

  for (let r = 0; r < aoa.length; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      const isNameCol = nameCol === c;
      const isCenterCol = centerCols.has(c);
      const wrapText = typeof cell.v === 'string' && cell.v.includes('\n');

      cell.s = {
        alignment: {
          horizontal: isNameCol ? 'left' : isCenterCol ? 'center' : 'left',
          vertical: 'center',
          wrapText,
        },
      };
    }
  }
}

/**
 * @param {{ name: string, aoa: (string|number)[][], layout?: XlsxSheetLayout }[]} sheets
 * @param {string} filename
 */
export function downloadMultiSheetXlsx(sheets, filename) {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  for (const sheet of sheets ?? []) {
    const aoa = sheet.aoa ?? [];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    applyWorksheetLayout(ws, aoa, sheet.layout);
    XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName(sheet.name, used));
  }
  const out = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
}

/**
 * @param {(string|number)[][]} aoa - inkl. Kopfzeile(n)
 * @param {string} sheetName
 * @param {string} filename
 * @param {XlsxSheetLayout} [layout]
 */
export function downloadAoaXlsx(aoa, sheetName, filename, layout) {
  downloadMultiSheetXlsx([{ name: sheetName, aoa, layout }], filename);
}

/**
 * @param {{ headers: string[], rows: (string|number)[][] }} sheetData
 * @param {string} sheetName
 * @param {string} filename
 * @param {XlsxSheetLayout} [layout]
 */
export function downloadSheetDataXlsx(sheetData, sheetName, filename, layout) {
  const aoa = [sheetData.headers, ...(sheetData.rows ?? [])];
  downloadAoaXlsx(aoa, sheetName, filename, layout);
}
