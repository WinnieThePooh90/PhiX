import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { triggerPdfDownload } from './phixPdfExport';

/** Erstellt einen Dateinamen für den Sitzplan-Export. */
export function seatingPlanExportFilename(config, format) {
  const subject = String(config?.subject || 'Fach').trim();
  const className = String(config?.className || 'Klasse').trim();
  const sanitize = (s) => s.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
  const base = `Sitzplan_${sanitize(subject)}_${sanitize(className)}`;
  const ext = format === 'pdf' ? '.pdf' : '.xlsx';
  return `${base}${ext}`;
}

/** Hilfsfunktion zum sicheren Lesen des seatingPlan Objekts */
function getSeatingPlanObj(config) {
  if (!config?.seatingPlan) return {};
  if (typeof config.seatingPlan === 'object' && config.seatingPlan !== null) return config.seatingPlan;
  if (typeof config.seatingPlan === 'string') {
    try {
      const parsed = JSON.parse(config.seatingPlan);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Formatiert Schülernamen (Vorname, bei Namensgleichheit mit Nachnamens-Initial). */
function formatStudentDisplayName(student, allStudents) {
  if (!student) return '';
  const firstName = String(student.firstName || '').trim();
  const sameFirstNameCount = (allStudents || []).filter(
    (s) => s && String(s.firstName || '').trim().toLowerCase() === firstName.toLowerCase(),
  ).length;

  if (sameFirstNameCount > 1 && student.lastName) {
    const initial = String(student.lastName).trim()[0] || '';
    return `${firstName} ${initial.toUpperCase()}.`;
  }
  return firstName || `${student.lastName || 'Schüler'}`;
}

/**
  Exportiert den Sitzplan als Excel-Datei (.xlsx)
  - Zentrierte Texte (horizontal & vertikal) in jeder Zelle
  - Vergrößerte Spaltenbreiten (24 ch) und Zeilenhöhen (36 pt)
 */
export function exportSeatingPlanXlsx({ config, students, filename }) {
  const seatingPlan = getSeatingPlanObj(config);
  const rowsCount = Number(seatingPlan.rows) || 8;
  const colsCount = Number(seatingPlan.cols) || 3;
  const rawAssignments = seatingPlan.assignments;
  const assignments = typeof rawAssignments === 'object' && rawAssignments !== null
    ? rawAssignments
    : (typeof rawAssignments === 'string' ? (JSON.parse(rawAssignments) || {}) : {});

  const studentsMap = new Map();
  (students || []).forEach((s) => studentsMap.set(Number(s.id), s));

  const outFilename = filename || seatingPlanExportFilename(config, 'xlsx');

  const wb = XLSX.utils.book_new();

  const titleRow = [`Sitzplan – ${config?.subject || ''} ${config?.className || ''} ${config?.year ? `(${config.year})` : ''}`.trim()];
  const subtitleRow = ['Orientierung: Lehrerpult / Tafel befindet sich unterhalb des Sitzplans (unterste Zeile = vorderste Reihe).'];
  const emptyRow = [''];

  // Header Zeile: ["Reihe", "Platz 1", "Platz 2", ...]
  const headerRow = ['Reihe'];
  for (let c = 1; c <= colsCount; c++) {
    headerRow.push(`Platz ${c}`);
  }

  const tableRows = [];
  for (let r = 0; r < rowsCount; r++) {
    const displayRow = rowsCount - r;
    const rowLabel = `Reihe ${displayRow}${r === rowsCount - 1 ? ' (Vorne / R1)' : r === 0 ? ' (Hinten)' : ''}`;
    const rowData = [rowLabel];

    for (let c = 0; c < colsCount; c++) {
      const cellKey = `${r}_${c}`;
      const studentId = assignments[cellKey] != null ? Number(assignments[cellKey]) : null;
      const student = studentId != null ? studentsMap.get(studentId) : null;
      const name = student ? formatStudentDisplayName(student, students) : '(Frei)';
      rowData.push(name);
    }
    tableRows.push(rowData);
  }

  // Tafel / Lehrerpult Zeile am Ende
  const teacherDeskRow = ['TAFEL / LEHRERPULT'];
  for (let c = 1; c <= colsCount; c++) {
    teacherDeskRow.push('');
  }

  const aoa = [titleRow, subtitleRow, emptyRow, headerRow, ...tableRows, emptyRow, teacherDeskRow];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Vergrößerte Spaltenbreite: Spalte A = 18 ch, Sitzplatz-Spalten = 24 ch (deutlich größer als Standard 8.43)
  ws['!cols'] = Array.from({ length: colsCount + 1 }, (_, i) => ({
    wch: i === 0 ? 18 : 24,
  }));

  // Vergrößerte Zeilenhöhe: 36 pt (deutlich größer als Standard 15 pt)
  const totalRows = aoa.length;
  const rowHeights = [];
  for (let r = 0; r < totalRows; r++) {
    if (r === 0) rowHeights.push({ hpt: 26 });
    else if (r >= 3 && r < 3 + tableRows.length) rowHeights.push({ hpt: 38 });
    else rowHeights.push({ hpt: 20 });
  }
  ws['!rows'] = rowHeights;

  // Zell-Formatierungen anwenden
  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  };

  const startRowIdx = 3; // Header-Zeile ist AOA Index 3
  const endRowIdx = 3 + tableRows.length; // Letzte Datenzeile

  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c <= colsCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      if (r === 0) {
        // Titel
        cell.s = {
          font: { bold: true, sz: 14, color: { rgb: '333333' } },
          alignment: { horizontal: 'left', vertical: 'center' },
        };
      } else if (r === 1) {
        // Untertitel
        cell.s = {
          font: { italic: true, sz: 10, color: { rgb: '666666' } },
          alignment: { horizontal: 'left', vertical: 'center' },
        };
      } else if (r === startRowIdx) {
        // Tabellen-Kopfzeile
        cell.s = {
          font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '4F46E5' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thinBorder,
        };
      } else if (r > startRowIdx && r <= endRowIdx) {
        // Sitzplatz-Rasterzellen
        const isFirstCol = c === 0;
        const isOccupied = cell.v && cell.v !== '(Frei)';
        cell.s = {
          font: {
            bold: isFirstCol || isOccupied,
            sz: 11,
            color: { rgb: isOccupied ? '1F2937' : '9CA3AF' },
          },
          fill: {
            fgColor: { rgb: isFirstCol ? 'F3F4F6' : isOccupied ? 'EEF2FF' : 'FAFAFA' },
          },
          alignment: {
            horizontal: 'center', // Zentrierte Namen in jeder Zelle!
            vertical: 'center',   // Zentrierte vertikale Ausrichtung!
            wrapText: true,
          },
          border: thinBorder,
        };
      } else if (r === totalRows - 1 && c === 0) {
        // Lehrerpult
        cell.s = {
          font: { bold: true, sz: 11, color: { rgb: '4F46E5' } },
          fill: { fgColor: { rgb: 'E0E7FF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thinBorder,
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Sitzplan');
  XLSX.writeFile(wb, outFilename);
}

/**
  Exportiert den Sitzplan als PDF-Datei im Querformat (.pdf)
 */
export function exportSeatingPlanPdf({ config, students, filename }) {
  const seatingPlan = getSeatingPlanObj(config);
  const rowsCount = Number(seatingPlan.rows) || 8;
  const colsCount = Number(seatingPlan.cols) || 3;
  const rawAssignments = seatingPlan.assignments;
  const assignments = typeof rawAssignments === 'object' && rawAssignments !== null
    ? rawAssignments
    : (typeof rawAssignments === 'string' ? (JSON.parse(rawAssignments) || {}) : {});

  const studentsMap = new Map();
  (students || []).forEach((s) => studentsMap.set(Number(s.id), s));

  const outFilename = filename || seatingPlanExportFilename(config, 'pdf');

  // PDF im Querformat (landscape)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Überschrift
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(31, 41, 55);
  const title = `Sitzplan – ${config?.subject || ''} ${config?.className || ''} ${config?.year ? `(${config.year})` : ''}`.trim();
  doc.text(title, 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Stand: ${new Date().toLocaleDateString('de-DE')} · Ausrichtung: Tafel / Lehrerpult unten`, 14, 21);

  // Tabellenkopf
  const head = [['Reihe']];
  for (let c = 1; c <= colsCount; c++) {
    head[0].push(`Platz ${c}`);
  }

  // Tabellenzeilen
  const body = [];
  for (let r = 0; r < rowsCount; r++) {
    const displayRow = rowsCount - r;
    const rowLabel = `Reihe ${displayRow}${r === rowsCount - 1 ? ' (Vorne / R1)' : r === 0 ? ' (Hinten)' : ''}`;
    const rowData = [rowLabel];

    for (let c = 0; c < colsCount; c++) {
      const cellKey = `${r}_${c}`;
      const studentId = assignments[cellKey] != null ? Number(assignments[cellKey]) : null;
      const student = studentId != null ? studentsMap.get(studentId) : null;
      const name = student ? formatStudentDisplayName(student, students) : '(Frei)';
      rowData.push(name);
    }
    body.push(rowData);
  }

  // Lehrerpult-Zeile am Ende
  const teacherDeskRow = ['TAFEL / LEHRERPULT'];
  for (let c = 1; c <= colsCount; c++) {
    teacherDeskRow.push('');
  }
  body.push(teacherDeskRow);

  autoTable(doc, {
    startY: 25,
    margin: { left: 14, right: 14 },
    head,
    body,
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 4,
      halign: 'center',
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: {
        halign: 'left',
        fontStyle: 'bold',
        fillColor: [243, 244, 246],
        cellWidth: 32,
      },
    },
    didParseCell: (data) => {
      // Lehrerpult-Zeile speziell hervorheben
      if (data.row.index === body.length - 1) {
        if (data.column.index === 0) {
          data.cell.styles.fillColor = [224, 231, 255];
          data.cell.styles.textColor = [79, 70, 229];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.halign = 'center';
        } else {
          data.cell.styles.fillColor = [224, 231, 255];
        }
      } else if (data.section === 'body' && data.column.index > 0) {
        // Leere Plätze ausgegraut darstellen
        if (data.cell.raw === '(Frei)') {
          data.cell.styles.textColor = [156, 163, 175];
        } else {
          data.cell.styles.textColor = [31, 41, 55];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  triggerPdfDownload(doc, outFilename);
}
