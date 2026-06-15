import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

/**
 * @param {(string|number)[][]} aoa - inkl. Kopfzeile
 * @param {string} [sectionTitle]
 * @param {import('jspdf').jsPDF} [doc] - bestehendes Dokument
 * @param {{ isFirstPage?: boolean }} [opts]
 * @returns {import('jspdf').jsPDF}
 */
function renderAoaTable(doc, aoa, sectionTitle, opts = {}) {
  const { head, body } = aoaToHeadBody(aoa);
  const colCount = head[0]?.length ?? 1;
  let startY = opts.startY ?? 14;
  if (sectionTitle) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(sectionTitle, 14, startY - 4);
    doc.setFont('helvetica', 'normal');
    startY += 4;
  }
  autoTable(doc, {
    head,
    body,
    startY,
    styles: { fontSize: colCount > 10 ? 6 : 8, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
    tableWidth: 'auto',
  });
  return doc;
}

function renderGradingKeyBlock(doc, gradingKey, startY) {
  if (!gradingKey?.aoa?.length) return doc;

  let y = startY;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Notenschlüssel: ${gradingKey.title || 'Aktueller Schlüssel'}`, 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (gradingKey.desc) {
    const descLines = doc.splitTextToSize(String(gradingKey.desc), 186);
    doc.text(descLines, 14, y);
    y += descLines.length * 4 + 2;
  }

  autoTable(doc, {
    head: [gradingKey.aoa[0].map(cellStr)],
    body: gradingKey.aoa.slice(1).map((row) => row.map(cellStr)),
    startY: y,
    styles: { fontSize: 8, cellPadding: 1.2, halign: 'center' },
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    tableWidth: 'wrap',
  });
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
  const doc = new jsPDF({
    orientation: pickOrientation(colCount),
    unit: 'mm',
    format: 'a4',
  });
  renderAoaTable(doc, aoa, sectionTitle);
  if (opts.gradingKey?.aoa?.length) {
    const startY = (doc.lastAutoTable?.finalY ?? 14) + 8;
    renderGradingKeyBlock(doc, opts.gradingKey, startY);
  }
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
  const doc = new jsPDF({
    orientation: pickOrientation(maxCols),
    unit: 'mm',
    format: 'a4',
  });

  list.forEach((section, index) => {
    if (index > 0) {
      doc.addPage('a4', pickOrientation(section.aoa?.[0]?.length ?? 1));
    }
    let startY = 14;
    if (index === 0 && documentTitle) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(documentTitle, 14, 14);
      doc.setFont('helvetica', 'normal');
      startY = 22;
    }
    renderAoaTable(doc, section.aoa, section.name, { startY });
    if (section.gradingKey?.aoa?.length) {
      const keyStartY = (doc.lastAutoTable?.finalY ?? startY) + 8;
      renderGradingKeyBlock(doc, section.gradingKey, keyStartY);
    }
  });

  doc.save(ensurePdfFilename(filename));
}
