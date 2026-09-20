/**
 * 2 cm in Punkt (pt) für Excel-Zeilenhöhe:
 * 1 Zoll = 72 pt = 2,54 cm  =>  1 cm ≈ 28,3465 pt  =>  2 cm ≈ 56,6929 pt.
 */
export const ROW_HEIGHT_2CM_PT = 56.7;

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

/**
 * Exportiert eine Liste von Benutzernamen und Einrichtungs-Tokens als formatierte Excel-Datei (.xlsx).
 * - Spalte 1: Benutzername
 * - Spalte 2: Token
 * - Jede Zeile ist genau 2 cm hoch (~56,7 pt, optimal zum Zerschneiden in Übergabestreifen)
 * - Drucklayout: DIN A4 Hochformat, angepasst auf 1 DIN A4-Seite (fitToWidth: 1, fitToHeight: 1, fitToPage: true)
 *
 * @param {Array<{ username: string, setupToken: string }>} users
 * @param {string} [filename]
 */
export async function exportUserTokensXlsx(users, filename) {
  if (!Array.isArray(users) || users.length === 0) return;

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet('Tokens', {
    pageSetup: {
      paperSize: 9, // DIN A4 (210 x 297 mm)
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
  });

  // Spaltenbreiten passend für DIN A4 Hochformat
  ws.columns = [
    { header: 'Benutzername', key: 'username', width: 28 },
    { header: 'Token', key: 'token', width: 24 },
  ];

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  };

  // Kopfzeile formatieren
  const headerRow = ws.getRow(1);
  headerRow.height = ROW_HEIGHT_2CM_PT;

  const headCell1 = headerRow.getCell(1);
  headCell1.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF111827' } };
  headCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  headCell1.alignment = { vertical: 'middle', horizontal: 'left' };
  headCell1.border = thinBorder;

  const headCell2 = headerRow.getCell(2);
  headCell2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF111827' } };
  headCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  headCell2.alignment = { vertical: 'middle', horizontal: 'center' };
  headCell2.border = thinBorder;

  // Datenzeilen hinzufügen
  users.forEach((u) => {
    const row = ws.addRow({
      username: String(u?.username ?? '').trim(),
      token: String(u?.setupToken ?? '').trim(),
    });
    row.height = ROW_HEIGHT_2CM_PT;

    const cellUser = row.getCell(1);
    cellUser.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1F2937' } };
    cellUser.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cellUser.border = thinBorder;

    const cellToken = row.getCell(2);
    cellToken.font = { name: 'Courier New', size: 11, color: { argb: 'FF1F2937' } };
    cellToken.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cellToken.border = thinBorder;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const todayStr = new Date().toISOString().slice(0, 10);
  const outFilename = filename || `Benutzer_Tokens_${todayStr}.xlsx`;
  triggerBlobDownload(buffer, outFilename);
}
