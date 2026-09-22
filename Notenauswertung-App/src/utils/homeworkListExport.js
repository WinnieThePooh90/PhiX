import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { triggerPdfDownload } from './phixPdfExport';
import { homeworkListExportFilename } from './exportFilenames';

/**
 * Exportiert eine Hausaufgabenliste als PDF im Querformat auf genau 1 DIN A4-Seite.
 *
 * @param {Object} options
 * @param {Object} options.list - Die Hausaufgabenliste (Titel, Spalten, Einträge)
 * @param {Array} options.students - Sortierte Schülerliste entsprechend der aktuellen Sortierung
 * @param {Object} [options.config] - Kurskonfiguration (Fach, Klasse, Schuljahr)
 * @param {string} [options.sortMode] - 'seatingPlan' | 'alphabetical'
 * @param {string} [options.filename] - Optionaler individueller Dateiname
 */
export function exportHomeworkListPdf({ list, students = [], config, sortMode = 'seatingPlan', filename }) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pw = doc.internal.pageSize.getWidth();
  const pageMargin = 10;
  const contentWidth = pw - pageMargin * 2;

  // Titel & Kursdaten
  const listTitle = list?.title?.trim() || 'Hausaufgabenliste';
  const subject = config?.subject?.trim() || '';
  const className = config?.className?.trim() || '';
  const year = config?.year?.trim() || '';

  const subtitleParts = [];
  if (subject) subtitleParts.push(`Fach: ${subject}`);
  if (className) subtitleParts.push(`Klasse: ${className}`);
  if (year) subtitleParts.push(`Schuljahr: ${year}`);
  subtitleParts.push(`Sortierung: ${sortMode === 'alphabetical' ? 'Alphabetisch' : 'Nach Sitzplan'}`);

  let y = 12;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(listTitle, pageMargin, y);
  y += 5.5;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(subtitleParts.join('   ·   '), pageMargin, y);
  y += 4.5;

  // Spalten aufbereiten
  const columns = list?.columns && list.columns.length > 0
    ? list.columns
    : [{ id: 'col_1', label: 'Stunde 1', date: null }];

  const headRow = [
    'Vorname / Name',
    ...columns.map((col, idx) => {
      const label = col.label || `Stunde ${idx + 1}`;
      return col.date ? `${label}\n${col.date}` : label;
    }),
    'Gesamt',
  ];

  // Eintrags-Map für schnellen Lookup
  const entriesMap = new Map();
  (list?.entries || []).forEach((e) => {
    entriesMap.set(Number(e.studentId), e);
  });

  // Tabellenzeilen
  const bodyRows = students.map((student) => {
    const entry = entriesMap.get(Number(student.id));
    const checks = entry?.checks || {};
    const studentName = student.lastName
      ? `${student.firstName} ${student.lastName}`
      : (student.firstName || '—');

    let totalChecked = 0;
    const colCells = columns.map((col) => {
      const isChecked = Boolean(checks[col.id]);
      if (isChecked) {
        totalChecked += 1;
        return 'x';
      }
      return '';
    });

    return [studentName, ...colCells, String(totalChecked)];
  });

  // Dynamische Skalierung für 1 DIN A4-Seite
  const studentCount = students.length;
  const totalRows = Math.max(1, studentCount + 1);

  let fontSize = 9;
  let headFontSize = 8.5;
  let cellPadding = 1.8;

  if (totalRows > 35) {
    fontSize = 6.5;
    headFontSize = 7;
    cellPadding = 0.5;
  } else if (totalRows > 28) {
    fontSize = 7.2;
    headFontSize = 7.5;
    cellPadding = 0.8;
  } else if (totalRows > 22) {
    fontSize = 8;
    headFontSize = 8;
    cellPadding = 1.1;
  } else if (totalRows > 15) {
    fontSize = 8.5;
    headFontSize = 8.5;
    cellPadding = 1.4;
  }

  // Spaltenstile
  const columnStyles = {
    0: { halign: 'left', fontStyle: 'normal', cellWidth: 'auto' },
  };

  for (let i = 1; i <= columns.length; i++) {
    columnStyles[i] = { halign: 'center', fontStyle: 'bold' };
  }
  columnStyles[columns.length + 1] = { halign: 'center', fontStyle: 'bold', cellWidth: 18 };

  autoTable(doc, {
    head: [headRow],
    body: bodyRows,
    startY: y,
    margin: { left: pageMargin, right: pageMargin, top: pageMargin, bottom: 8 },
    tableWidth: contentWidth,
    pageBreak: 'avoid',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize,
      cellPadding,
      valign: 'middle',
      overflow: 'linebreak',
      textColor: [31, 41, 55],
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: headFontSize,
      cellPadding: Math.max(1, cellPadding),
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles,
    didParseCell: (data) => {
      // Name-Spalte im Header linksbündig
      if (data.section === 'head' && data.column.index === 0) {
        data.cell.styles.halign = 'left';
      }
    },
  });

  const outFilename = filename || homeworkListExportFilename(config, listTitle, 'pdf');
  triggerPdfDownload(doc, outFilename);
}
