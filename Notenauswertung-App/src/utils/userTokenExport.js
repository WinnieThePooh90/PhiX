import * as XLSX from 'xlsx-js-style';

/**
 * 2 cm in Punkt (pt) für Excel-Zeilenhöhe:
 * 1 Zoll = 72 pt = 2,54 cm  =>  1 cm ≈ 28,3465 pt  =>  2 cm ≈ 56,6929 pt.
 */
export const ROW_HEIGHT_2CM_PT = 56.7;

/**
 * Exportiert eine Liste von Benutzernamen und Einrichtungs-Tokens als formatierte Excel-Datei (.xlsx).
 * - Spalte 1: Benutzername
 * - Spalte 2: Token
 * - Jede Zeile ist 2 cm hoch (ideal zum Ausdrucken und Zerschneiden in Übergabestreifen)
 *
 * @param {Array<{ username: string, setupToken: string }>} users
 * @param {string} [filename]
 */
export function exportUserTokensXlsx(users, filename) {
  if (!Array.isArray(users) || users.length === 0) return;

  const wb = XLSX.utils.book_new();

  const headerRow = ['Benutzername', 'Token'];
  const dataRows = users.map((u) => [
    String(u?.username ?? '').trim(),
    String(u?.setupToken ?? '').trim(),
  ]);

  const aoa = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Spaltenbreiten (Benutzername & Token mit ausreichend Platz)
  ws['!cols'] = [
    { wch: 30 },
    { wch: 40 },
  ];

  // Jede Zeile genau 2 cm hoch
  ws['!rows'] = aoa.map(() => ({ hpt: ROW_HEIGHT_2CM_PT }));

  const border = {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  };

  const totalRows = aoa.length;
  const totalCols = 2;

  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      if (r === 0) {
        // Kopfzeile
        cell.s = {
          font: { bold: true, sz: 12, color: { rgb: '111827' } },
          fill: { fgColor: { rgb: 'F3F4F6' } },
          alignment: {
            horizontal: c === 0 ? 'left' : 'center',
            vertical: 'center',
          },
          border,
        };
      } else {
        // Datenzeile
        cell.s = {
          font: {
            bold: c === 0,
            sz: 11,
            color: { rgb: '1F2937' },
            name: c === 1 ? 'Courier New' : undefined,
          },
          alignment: {
            horizontal: c === 0 ? 'left' : 'center',
            vertical: 'center',
          },
          border,
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Tokens');

  const todayStr = new Date().toISOString().slice(0, 10);
  const outFilename = filename || `Benutzer_Tokens_${todayStr}.xlsx`;
  XLSX.writeFile(wb, outFilename);
}
