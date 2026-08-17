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
  - Ohne Spalte "Reihe" & ohne Kopfzeile "Platz 1, Platz 2, ..."
  - Zentrierte Texte (horizontal & vertikal) in jeder Zelle
  - Vergrößerte Spaltenbreiten (24 ch) und Zeilenhöhen (38 pt) für ALLE Sitzreihen
  - Zusammengefasste Lehrerpult-Zeile über die volle Zeilenbreite ganz unten
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
  const emptyRow = [''];

  const tableRows = [];
  for (let r = 0; r < rowsCount; r++) {
    const rowData = [];
    for (let c = 0; c < colsCount; c++) {
      const cellKey = `${r}_${c}`;
      const studentId = assignments[cellKey] != null ? Number(assignments[cellKey]) : null;
      const student = studentId != null ? studentsMap.get(studentId) : null;
      const name = student ? formatStudentDisplayName(student, students) : '(Frei)';
      rowData.push(name);
    }
    tableRows.push(rowData);
  }

  // Tafel / Lehrerpult Zeile als ganze Zeile am Ende
  const teacherDeskRow = ['TAFEL / LEHRERPULT'];
  for (let c = 1; c < colsCount; c++) {
    teacherDeskRow.push('');
  }

  const aoa = [titleRow, emptyRow, ...tableRows, emptyRow, teacherDeskRow];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Spaltenbreite: Alle Sitzplatz-Spalten = 24 ch (zentriert & vergrößert)
  ws['!cols'] = Array.from({ length: colsCount }, () => ({
    wch: 24,
  }));

  const dataStartRowIdx = 2; // Erste Datenzeile (Index 2: 0=Titel, 1=Empty)
  const dataEndRowIdx = 2 + tableRows.length - 1; // Letzte Datenzeile
  const teacherDeskRowIdx = aoa.length - 1; // Lehrerpult-Zeile

  // Zeilenhöhen: Titel (26 pt), Alle Datenzeilen (38 pt), Lehrerpult (32 pt)
  const totalRows = aoa.length;
  const rowHeights = [];
  for (let r = 0; r < totalRows; r++) {
    if (r === 0) rowHeights.push({ hpt: 26 });
    else if (r >= dataStartRowIdx && r <= dataEndRowIdx) rowHeights.push({ hpt: 38 });
    else if (r === teacherDeskRowIdx) rowHeights.push({ hpt: 32 });
    else rowHeights.push({ hpt: 12 });
  }
  ws['!rows'] = rowHeights;

  // Tafel / Lehrerpult über die gesamte Zeilenbreite verbinden
  ws['!merges'] = [
    { s: { r: teacherDeskRowIdx, c: 0 }, e: { r: teacherDeskRowIdx, c: colsCount - 1 } },
  ];

  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  };

  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < colsCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      let cell = ws[addr];
      if (!cell && r === teacherDeskRowIdx) {
        // Leere Zellen der zusammengefassten Lehrerpult-Zeile erzeugen für konsistente Ränder & Hintergrund
        ws[addr] = { v: '', t: 's' };
        cell = ws[addr];
      }
      if (!cell) continue;

      if (r === 0) {
        // Titel
        cell.s = {
          font: { bold: true, sz: 14, color: { rgb: '333333' } },
          alignment: { horizontal: 'left', vertical: 'center' },
        };
      } else if (r >= dataStartRowIdx && r <= dataEndRowIdx) {
        // Sitzplatz-Rasterzellen
        const isOccupied = cell.v && cell.v !== '(Frei)';
        cell.s = {
          font: {
            bold: isOccupied,
            sz: 11,
            color: { rgb: isOccupied ? '1F2937' : '9CA3AF' },
          },
          fill: {
            fgColor: { rgb: isOccupied ? 'EEF2FF' : 'FAFAFA' },
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center',
            wrapText: true,
          },
          border: thinBorder,
        };
      } else if (r === teacherDeskRowIdx) {
        // Lehrerpult (volle Zeilenbreite)
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
  - Ohne Kopfzeile "Platz 1, Platz 2, ..."
  - Tafel / Lehrerpult als zusammengefasste ganze Zeile über die volle Breite am Ende
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

  // Überschrift
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(31, 41, 55);
  const title = `Sitzplan – ${config?.subject || ''} ${config?.className || ''} ${config?.year ? `(${config.year})` : ''}`.trim();
  doc.text(title, 14, 15);

  // Tabellenzeilen (ohne Kopfzeile "Platz 1", "Platz 2", ...)
  const body = [];
  for (let r = 0; r < rowsCount; r++) {
    const rowData = [];
    for (let c = 0; c < colsCount; c++) {
      const cellKey = `${r}_${c}`;
      const studentId = assignments[cellKey] != null ? Number(assignments[cellKey]) : null;
      const student = studentId != null ? studentsMap.get(studentId) : null;
      const name = student ? formatStudentDisplayName(student, students) : '(Frei)';
      rowData.push(name);
    }
    body.push(rowData);
  }

  // Lehrerpult-Zeile am Ende als ganze Zeile über die volle Breite (colSpan)
  const teacherDeskRow = [
    {
      content: 'TAFEL / LEHRERPULT',
      colSpan: colsCount,
      styles: {
        halign: 'center',
        valign: 'middle',
        fillColor: [224, 231, 255],
        textColor: [79, 70, 229],
        fontStyle: 'bold',
        fontSize: 11,
        cellPadding: 5,
      },
    },
  ];
  body.push(teacherDeskRow);

  autoTable(doc, {
    startY: 20,
    margin: { left: 14, right: 14 },
    body,
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 5,
      halign: 'center',
      valign: 'middle',
      overflow: 'linebreak',
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index < rowsCount) {
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
