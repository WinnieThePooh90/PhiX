import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PAGE_MARGIN = 10;
const KEY_PANEL_W = 38;
const KEY_GAP = 2;

function ensurePdfFilename(filename) {
  const name = String(filename || 'Export.pdf');
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}

function cellStr(value) {
  if (value == null) return '';
  return String(value);
}

function aoaToHeadBody(aoa) {
  const rows = aoa ?? [];
  if (!rows.length) {
    return { head: [['']], body: [] };
  }
  return {
    head: [rows[0].map(cellStr)],
    body: rows.slice(1).map((row) => row.map(cellStr)),
  };
}

function pickOrientation(columnCount) {
  return columnCount > 7 ? 'landscape' : 'portrait';
}

function pageWidth(doc) {
  return doc.internal.pageSize.getWidth();
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {{ title?: string, desc?: string, aoa?: (string|number)[][] }} gradingKey
 * @param {number} startX
 * @param {number} startY
 * @param {number} panelWidth
 */
function renderGradingKeyBeside(doc, gradingKey, startX, startY, panelWidth) {
  if (!gradingKey?.aoa?.length) return;

  let y = startY;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(
    `Notenschlüssel: ${gradingKey.title || 'Aktueller Schlüssel'}`,
    panelWidth,
  );
  doc.text(titleLines, startX, y);
  y += titleLines.length * 3.2 + 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  if (gradingKey.desc) {
    const descLines = doc.splitTextToSize(String(gradingKey.desc), panelWidth);
    doc.text(descLines, startX, y);
    y += descLines.length * 2.8 + 1;
  }

  autoTable(doc, {
    head: [gradingKey.aoa[0].map(cellStr)],
    body: gradingKey.aoa.slice(1).map((row) => row.map(cellStr)),
    startY: y,
    styles: { fontSize: 6.5, cellPadding: 0.8, halign: 'center', overflow: 'linebreak' },
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6.5,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: startX, right: pageWidth(doc) - startX - panelWidth },
    tableWidth: panelWidth,
  });
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {(string|number)[][]} aoa
 * @param {string} [sectionTitle]
 * @param {{ title?: string, desc?: string, aoa?: (string|number)[][] }} [gradingKey]
 * @param {{ startY?: number }} [opts]
 */
function renderAoaTable(doc, aoa, sectionTitle, gradingKey, opts = {}) {
  const { head, body } = aoaToHeadBody(aoa);
  const colCount = head[0]?.length ?? 1;
  let startY = opts.startY ?? 14;
  const hasKey = !!gradingKey?.aoa?.length;
  const keyReserved = hasKey ? KEY_PANEL_W + KEY_GAP + PAGE_MARGIN : PAGE_MARGIN;

  if (sectionTitle) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(sectionTitle, PAGE_MARGIN, startY - 4);
    doc.setFont('helvetica', 'normal');
    startY += 4;
  }

  const tableStartY = startY;

  autoTable(doc, {
    head,
    body,
    startY,
    styles: { fontSize: colCount > 10 ? 6 : 8, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: PAGE_MARGIN, right: keyReserved },
    tableWidth: 'wrap',
  });

  if (hasKey) {
    const pageAtEnd = doc.internal.getCurrentPageInfo().pageNumber;
    doc.setPage(1);
    const keyX = pageWidth(doc) - PAGE_MARGIN - KEY_PANEL_W;
    renderGradingKeyBeside(doc, gradingKey, keyX, tableStartY, KEY_PANEL_W);
    doc.setPage(pageAtEnd);
  }

  return doc;
}

/**
 * @param {(string|number)[][]} aoa
 * @param {string} sectionTitle
 * @param {string} filename
 * @param {{ gradingKey?: { title?: string, desc?: string, aoa?: (string|number)[][] } }} [opts]
 */
export function downloadAoaPdf(aoa, sectionTitle, filename, opts = {}) {
  const colCount = aoa?.[0]?.length ?? 1;
  const hasKey = !!opts.gradingKey?.aoa?.length;
  const doc = new jsPDF({
    orientation: hasKey || colCount > 7 ? 'landscape' : pickOrientation(colCount),
    unit: 'mm',
    format: 'a4',
  });
  renderAoaTable(doc, aoa, sectionTitle, opts.gradingKey);
  doc.save(ensurePdfFilename(filename));
}

/**
 * @param {{ headers: string[], rows: (string|number)[][] }} sheetData
 * @param {string} sectionTitle
 * @param {string} filename
 */
export function downloadSheetDataPdf(sheetData, sectionTitle, filename) {
  const aoa = [sheetData.headers, ...(sheetData.rows ?? [])];
  downloadAoaPdf(aoa, sectionTitle, filename);
}

/**
 * @param {{ name: string, aoa: (string|number)[][], gradingKey?: { title?: string, desc?: string, aoa?: (string|number)[][] } }[]} sections
 * @param {string} filename
 * @param {string} [documentTitle]
 */
export function downloadMultiSectionPdf(sections, filename, documentTitle) {
  const list = sections ?? [];
  if (!list.length) {
    const doc = new jsPDF();
    doc.text('Keine Daten', 14, 20);
    doc.save(ensurePdfFilename(filename));
    return;
  }

  const maxCols = Math.max(...list.map((s) => s.aoa?.[0]?.length ?? 1));
  const hasAnyKey = list.some((s) => s.gradingKey?.aoa?.length);
  const doc = new jsPDF({
    orientation: hasAnyKey || maxCols > 7 ? 'landscape' : pickOrientation(maxCols),
    unit: 'mm',
    format: 'a4',
  });

  list.forEach((section, index) => {
    if (index > 0) {
      const colCount = section.aoa?.[0]?.length ?? 1;
      doc.addPage(
        'a4',
        section.gradingKey?.aoa?.length || colCount > 7 ? 'landscape' : pickOrientation(colCount),
      );
    }
    let startY = 14;
    if (index === 0 && documentTitle) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(documentTitle, PAGE_MARGIN, 14);
      doc.setFont('helvetica', 'normal');
      startY = 22;
    }
    renderAoaTable(doc, section.aoa, section.name, section.gradingKey, { startY });
  });

  doc.save(ensurePdfFilename(filename));
}
