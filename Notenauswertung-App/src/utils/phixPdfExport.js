import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PAGE_MARGIN = 10;
const KEY_GAP = 2;
/** Anteil der Seitenbreite für den Notenschlüssel (schmaler Rand rechts). */
const KEY_WIDTH_RATIO = 0.13;
const KEY_WIDTH_MIN = 26;
const KEY_WIDTH_MAX = 36;

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

function keyPanelWidth(doc) {
  const w = pageWidth(doc);
  return Math.min(KEY_WIDTH_MAX, Math.max(KEY_WIDTH_MIN, w * KEY_WIDTH_RATIO));
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
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Notenschlüssel', startX, y);
  y += 3.2;
  const titleLines = doc.splitTextToSize(gradingKey.title || 'Aktueller Schlüssel', panelWidth);
  doc.text(titleLines, startX, y);
  y += titleLines.length * 2.8 + 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  if (gradingKey.desc) {
    const descLines = doc.splitTextToSize(String(gradingKey.desc), panelWidth);
    doc.text(descLines, startX, y);
    y += descLines.length * 2.6 + 1;
  }

  autoTable(doc, {
    head: [gradingKey.aoa[0].map(cellStr)],
    body: gradingKey.aoa.slice(1).map((row) => row.map(cellStr)),
    startY: y,
    styles: { fontSize: 6, cellPadding: 0.6, halign: 'center', overflow: 'linebreak' },
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6,
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
  const pw = pageWidth(doc);

  if (sectionTitle) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(sectionTitle, PAGE_MARGIN, startY - 4);
    doc.setFont('helvetica', 'normal');
    startY += 4;
  }

  const tableStartY = startY;
  const sectionStartPage = doc.internal.getCurrentPageInfo().pageNumber;

  let marginRight = PAGE_MARGIN;
  let tableWidth = pw - PAGE_MARGIN * 2;

  if (hasKey) {
    const kw = keyPanelWidth(doc);
    marginRight = PAGE_MARGIN + kw + KEY_GAP;
    tableWidth = pw - PAGE_MARGIN - marginRight;
  }

  autoTable(doc, {
    head,
    body,
    startY,
    styles: { fontSize: colCount > 10 ? 6 : 8, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: PAGE_MARGIN, right: marginRight },
    tableWidth,
  });

  if (hasKey) {
    const tableEndPage = doc.internal.getCurrentPageInfo().pageNumber;
    const kw = keyPanelWidth(doc);
    const keyX = pw - PAGE_MARGIN - kw;
    doc.setPage(sectionStartPage);
    renderGradingKeyBeside(doc, gradingKey, keyX, tableStartY, kw);
    doc.setPage(tableEndPage);
  }

  return doc;
}

function sectionOrientation(section) {
  const cols = section.aoa?.[0]?.length ?? 1;
  if (section.gradingKey?.aoa?.length) return 'landscape';
  return pickOrientation(cols);
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
    orientation: hasKey ? 'landscape' : pickOrientation(colCount),
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

  const doc = new jsPDF({
    orientation: sectionOrientation(list[0]),
    unit: 'mm',
    format: 'a4',
  });

  list.forEach((section, index) => {
    if (index > 0) {
      doc.addPage('a4', sectionOrientation(section));
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

/**
 * Notenschlüssel als eigene PDF-Seite (Titel, Beschreibung, Tabelle).
 * @param {{ title?: string, desc?: string, maxPoints?: number, aoa?: (string|number)[][] }} gradingKey
 * @param {string} filename
 */
export function downloadGradingKeyPdf(gradingKey, filename) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  renderGradingKeyFullPage(doc, gradingKey);
  doc.save(ensurePdfFilename(filename));
}

/**
 * @param {{ gradingKey: { title?: string, desc?: string, maxPoints?: number, aoa?: (string|number)[][] } }[]} entries
 * @param {string} filename
 */
export function downloadGradingKeysMultiPagePdf(entries, filename) {
  const list = entries ?? [];
  if (!list.length) {
    const doc = new jsPDF();
    doc.text('Keine Notenschlüssel', 14, 20);
    doc.save(ensurePdfFilename(filename));
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  list.forEach((entry, index) => {
    if (index > 0) doc.addPage('a4', 'portrait');
    renderGradingKeyFullPage(doc, entry.gradingKey);
  });
  doc.save(ensurePdfFilename(filename));
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {{ title?: string, desc?: string, maxPoints?: number, aoa?: (string|number)[][] }} gradingKey
 */
function renderGradingKeyFullPage(doc, gradingKey) {
  if (!gradingKey?.aoa?.length) return;

  const pw = pageWidth(doc);
  const contentWidth = pw - PAGE_MARGIN * 2;
  let y = 18;

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(gradingKey.title || 'Notenschlüssel', contentWidth);
  doc.text(titleLines, PAGE_MARGIN, y);
  y += titleLines.length * 6 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (gradingKey.desc) {
    const descLines = doc.splitTextToSize(String(gradingKey.desc), contentWidth);
    doc.text(descLines, PAGE_MARGIN, y);
    y += descLines.length * 4.5 + 2;
  }

  const maxPts = Number(gradingKey.maxPoints);
  if (Number.isFinite(maxPts) && maxPts > 0) {
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Maximalpunkte: ${maxPts}`, PAGE_MARGIN, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  autoTable(doc, {
    head: [gradingKey.aoa[0].map(cellStr)],
    body: gradingKey.aoa.slice(1).map((row) => row.map(cellStr)),
    startY: y + 2,
    styles: { fontSize: 9, cellPadding: 1.4, halign: 'center', overflow: 'linebreak' },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    tableWidth: Math.min(90, contentWidth),
  });
}
