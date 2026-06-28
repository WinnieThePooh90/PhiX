import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { buildExportFilename } from './exportFilenames';
import { triggerPdfDownload } from './phixPdfExport';
import {
  GFS_AUSWERTUNG_CRITERIA,
  GFS_AUSWERTUNG_POINT_LEVELS,
  buildGfsCriterionRowCells,
} from './gfsAuswertungConfig';

const PAGE_MARGIN = 10;
const SELECTED_FILL = [191, 219, 254];

export function gfsAuswertungPdfFilename(titleLabel, studentName) {
  return buildExportFilename([titleLabel, studentName], 'pdf');
}

function formatEntryDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).trim();
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** Erste Zeile nach der Überschrift: GFS/Referat, Art und Datum. */
function buildKindArtDateLine({ entryKind, art, date }) {
  const parts = [];
  const kind = String(entryKind ?? '').trim();
  if (kind) parts.push(kind);
  if (String(art ?? '').trim()) parts.push(`Art: ${String(art).trim()}`);
  const dateLabel = formatEntryDate(date);
  if (dateLabel) parts.push(`Datum: ${dateLabel}`);
  return parts.join(' · ');
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

/**
 * PDF-Export des Auswertungshilfe-Popups (GFS und Referate) auf einem A4-Blatt im Hochformat.
 */
export function downloadGfsAuswertungPdf({
  titleLabel,
  studentName,
  entryKind = '',
  thema = '',
  art = '',
  date = '',
  scores = {},
  bemerkungen = '',
  filename,
}) {
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

  const kindArtDateLine = buildKindArtDateLine({ entryKind, art, date });
  const themaLine = String(thema ?? '').trim() ? `Thema: ${String(thema).trim()}` : '';

  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  if (kindArtDateLine) {
    const wrapped = doc.splitTextToSize(kindArtDateLine, contentWidth);
    doc.text(wrapped, PAGE_MARGIN, y);
    y += wrapped.length * 4 + 1;
  }
  if (themaLine) {
    const wrapped = doc.splitTextToSize(themaLine, contentWidth);
    doc.text(wrapped, PAGE_MARGIN, y);
    y += wrapped.length * 4 + 1;
  }
  doc.setTextColor(0, 0, 0);
  y += 4;

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

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Bemerkungen', PAGE_MARGIN, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  const notesText = String(bemerkungen ?? '').trim() || '—';
  const maxNotesBottom = pageH - PAGE_MARGIN;
  const lineHeight = 3.2;
  const maxLines = Math.max(1, Math.floor((maxNotesBottom - y) / lineHeight));
  let notesLines = doc.splitTextToSize(notesText, contentWidth);
  if (notesLines.length > maxLines) {
    notesLines = notesLines.slice(0, maxLines);
    const last = notesLines[maxLines - 1];
    notesLines[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : '…';
  }
  doc.text(notesLines, PAGE_MARGIN, y);

  triggerPdfDownload(doc, filename);
}
