import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { buildExportFilename } from './exportFilenames';
import { triggerPdfDownload } from './phixPdfExport';
import {
  GFS_AUSWERTUNG_CRITERIA,
  GFS_AUSWERTUNG_POINT_LEVELS,
  GFS_AUSWERTUNG_POINTS_TO_GRADE,
  buildGfsCriterionRowCells,
  countGfsAuswertungFilled,
  sumGfsAuswertungScores,
  suggestGradeFromGfsAuswertungPoints,
} from './gfsAuswertungConfig';

const PAGE_MARGIN = 10;
const SELECTED_FILL = [191, 219, 254];
const GRADE_HIT_FILL = [254, 243, 199];

export function gfsAuswertungPdfFilename(titleLabel, studentName) {
  return buildExportFilename([titleLabel, studentName], 'pdf');
}

function buildGradePairs(gradeSystem) {
  const isPointsMode = gradeSystem === 'points';
  return GFS_AUSWERTUNG_POINTS_TO_GRADE.map((row) => ({
    points: row.points,
    label: isPointsMode
      ? `${suggestGradeFromGfsAuswertungPoints(row.points, 'points')} NP`
      : row.grade,
  }));
}

function buildGradeTableMultiColumn(pairs, columns = 3) {
  const head = [];
  for (let c = 0; c < columns; c += 1) {
    head.push('Pkt.', 'Note');
  }
  const body = [];
  for (let i = 0; i < pairs.length; i += columns) {
    const row = [];
    for (let c = 0; c < columns; c += 1) {
      const item = pairs[i + c];
      row.push(item ? String(item.points) : '', item ? item.label : '');
    }
    body.push(row);
  }
  return { head: [head], body };
}

function highlightSelectedCriteriaCells(data, scores) {
  if (data.section !== 'body' || data.column.index === 0 || !data.cell?.styles) return;
  const colIdx = data.column.index - 1;
  if (colIdx < 0 || colIdx >= GFS_AUSWERTUNG_POINT_LEVELS.length) return;
  const criterion = GFS_AUSWERTUNG_CRITERIA[data.row.index];
  if (!criterion) return;
  const gridPoint = GFS_AUSWERTUNG_POINT_LEVELS[colIdx];
  if (scores[criterion.id] === gridPoint) {
    data.cell.styles.fillColor = SELECTED_FILL;
    data.cell.styles.fontStyle = 'bold';
  }
}

function highlightGradeHitCells(data, gradePairs, total, columns) {
  if (data.section !== 'body' || !data.cell?.styles) return;
  const colPair = Math.floor(data.column.index / 2);
  const pairIdx = data.row.index * columns + colPair;
  const pair = gradePairs[pairIdx];
  if (pair && pair.points === total) {
    data.cell.styles.fillColor = GRADE_HIT_FILL;
    data.cell.styles.fontStyle = 'bold';
  }
}

/**
 * PDF-Export des Auswertungshilfe-Popups (GFS und Referate) auf einem A4-Blatt im Hochformat.
 */
export function downloadGfsAuswertungPdf({
  titleLabel,
  studentName,
  gradeSystem = 'classic',
  scores = {},
  bemerkungen = '',
  filename,
}) {
  const isPointsMode = gradeSystem === 'points';
  const filled = countGfsAuswertungFilled(scores);
  const total = sumGfsAuswertungScores(scores);
  const suggestedGrade = suggestGradeFromGfsAuswertungPoints(total, gradeSystem);
  const sectionTitle = `${titleLabel} — ${studentName}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentWidth = pw - PAGE_MARGIN * 2;
  let y = 14;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(sectionTitle, contentWidth);
  doc.text(titleLines, PAGE_MARGIN, y);
  y += titleLines.length * 5 + 2;
  doc.setFont('helvetica', 'normal');

  const sumLine = `Summe: ${total} Punkte${
    filled > 0 && filled < GFS_AUSWERTUNG_CRITERIA.length
      ? ` (${filled} von ${GFS_AUSWERTUNG_CRITERIA.length} Kriterien)`
      : ''
  }`;
  const gradeLine = `Vorgeschlagene Note: ${isPointsMode ? `${suggestedGrade} NP` : suggestedGrade}`;

  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text(sumLine, PAGE_MARGIN, y);
  y += 4.5;
  doc.text(gradeLine, PAGE_MARGIN, y);
  doc.setTextColor(0, 0, 0);
  y += 6;

  const criteriaHead = [['Kriterium', ...GFS_AUSWERTUNG_POINT_LEVELS.map(String)]];
  const criteriaBody = GFS_AUSWERTUNG_CRITERIA.map((criterion) => {
    const row = [criterion.label];
    for (const cell of buildGfsCriterionRowCells(criterion)) {
      row.push(cell.type === 'empty' ? '' : cell.description);
    }
    return row;
  });

  autoTable(doc, {
    head: criteriaHead,
    body: criteriaBody,
    startY: y,
    styles: {
      fontSize: 5.5,
      cellPadding: 0.7,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6,
    },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: 'bold', fillColor: [241, 245, 249] },
    },
    didParseCell: (data) => highlightSelectedCriteriaCells(data, scores),
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    tableWidth: contentWidth,
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 5;

  const gradeTableTitle = isPointsMode ? 'Punkte-Notenpunkte-Tabelle' : 'Punkte-Noten-Tabelle';
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(gradeTableTitle, PAGE_MARGIN, y);
  y += 4;
  doc.setFont('helvetica', 'normal');

  const gradePairs = buildGradePairs(gradeSystem);
  const gradeColumns = 3;
  const { head: gradeHead, body: gradeBody } = buildGradeTableMultiColumn(gradePairs, gradeColumns);
  const gradeTableWidth = contentWidth * 0.55;

  autoTable(doc, {
    head: gradeHead,
    body: gradeBody,
    startY: y,
    styles: { fontSize: 5.5, cellPadding: 0.5, halign: 'center', overflow: 'linebreak' },
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 5.5,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => highlightGradeHitCells(data, gradePairs, total, gradeColumns),
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    tableWidth: gradeTableWidth,
  });

  const notesX = PAGE_MARGIN + gradeTableWidth + 4;
  const notesWidth = Math.max(40, contentWidth - gradeTableWidth - 4);
  const notesY = y;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Bemerkungen', notesX, notesY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  const notesText = String(bemerkungen ?? '').trim() || '—';
  const maxNotesBottom = pageH - PAGE_MARGIN;
  const lineHeight = 3.2;
  const maxLines = Math.max(1, Math.floor((maxNotesBottom - (notesY + 4)) / lineHeight));
  let notesLines = doc.splitTextToSize(notesText, notesWidth);
  if (notesLines.length > maxLines) {
    notesLines = notesLines.slice(0, maxLines);
    const last = notesLines[maxLines - 1];
    notesLines[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : '…';
  }
  doc.text(notesLines, notesX, notesY + 4);

  triggerPdfDownload(doc, filename);
}
