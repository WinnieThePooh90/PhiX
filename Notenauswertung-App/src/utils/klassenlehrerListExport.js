const TYPE_LABELS = {
  money: 'Geldliste',
  attendance: 'Anwesenheitsliste',
  collection: 'Sammelliste',
  notes: 'Notizenliste',
};

const STATUS_COLUMNS = {
  money: { header: 'Bezahlt', key: 'paid' },
  attendance: { header: 'Anwesend', key: 'present' },
  collection: { header: 'Eingesammelt', key: 'collected' },
};

function entryNr(row) {
  if (row.isExternal) return 'ext.';
  return row.studentNumber ?? '—';
}

function yesNo(value) {
  return value === true ? 'Ja' : 'Nein';
}

/**
 * Klassenlehrer-Liste als Tabellendaten für PDF/Excel.
 * @returns {{ headers: string[], rows: (string|number)[][], sectionTitle: string, layout: { colWidths: number[], centerColumnIndexes: number[], nameColumnIndex: number } }}
 */
export function buildKlassenlehrerListExportData({ list, type }) {
  const entries = list?.entries ?? [];
  const sectionTitle = list?.subject?.trim() || TYPE_LABELS[type] || 'Liste';

  if (type === 'notes') {
    const headers = ['Nr.', 'Name', 'Vorname', 'Bemerkungen'];
    const rows = entries.map((row) => [
      entryNr(row),
      row.lastName || '—',
      row.firstName || '—',
      String(row.remark ?? '').trim(),
    ]);
    return {
      headers,
      rows,
      sectionTitle,
      layout: { colWidths: [8, 28, 28, 50], centerColumnIndexes: [0], nameColumnIndex: 1 },
    };
  }

  const statusCol = STATUS_COLUMNS[type];
  const headers = ['Nr.', 'Name', 'Vorname', statusCol?.header ?? 'Status'];
  const rows = entries.map((row) => [
    entryNr(row),
    row.lastName || '—',
    row.firstName || '—',
    yesNo(row[statusCol?.key]),
  ]);
  return {
    headers,
    rows,
    sectionTitle,
    layout: { colWidths: [8, 32, 32, 14], centerColumnIndexes: [0, 3], nameColumnIndex: 1 },
  };
}
