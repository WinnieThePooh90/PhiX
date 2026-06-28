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

function formatEuro(amount) {
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatListDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function entryNr(row) {
  if (row.isExternal) return 'ext.';
  return row.studentNumber ?? '—';
}

function yesNo(value) {
  return value === true ? 'Ja' : 'Nein';
}

/** Kopfzeilen-Infos für PDF (entspricht der Anzeige über der Tabelle in der App). */
export function buildKlassenlehrerListExportMetaLines({ list, type }) {
  const entries = list?.entries ?? [];
  const totalCount = entries.length;
  /** @type {string[]} */
  const lines = [];

  if (type === 'money') {
    const amountPerStudent = Number(list.amountPerStudent);
    if (Number.isFinite(amountPerStudent)) {
      lines.push(`${formatEuro(amountPerStudent)} pro Schüler`);
    }
    if (list.notes?.trim()) {
      lines.push(String(list.notes).trim());
    }
    const paidCount = entries.filter((e) => e.paid).length;
    lines.push(`${paidCount} / ${totalCount} bezahlt`);
    const dueLabel = formatListDate(list.dueDate);
    if (dueLabel) lines.push(`Fällig: ${dueLabel}`);
    if (Number.isFinite(amountPerStudent)) {
      const paidAmount = paidCount * amountPerStudent;
      const totalAmount = totalCount * amountPerStudent;
      lines.push(`${formatEuro(paidAmount)} / ${formatEuro(totalAmount)}`);
    }
  } else if (type === 'attendance') {
    if (list.notes?.trim()) lines.push(String(list.notes).trim());
    const presentCount = entries.filter((e) => e.present).length;
    lines.push(`${presentCount} / ${totalCount} anwesend`);
    const dateLabel = formatListDate(list.sessionDate);
    if (dateLabel) lines.push(`Datum: ${dateLabel}`);
  } else if (type === 'collection') {
    if (list.notes?.trim()) lines.push(String(list.notes).trim());
    const collectedCount = entries.filter((e) => e.collected).length;
    lines.push(`${collectedCount} / ${totalCount} eingesammelt`);
    const dateLabel = formatListDate(list.sessionDate);
    if (dateLabel) lines.push(`Datum: ${dateLabel}`);
  } else if (type === 'notes') {
    if (list.notes?.trim()) lines.push(String(list.notes).trim());
    const remarkCount = entries.filter((e) => Boolean(String(e.remark ?? '').trim())).length;
    lines.push(`${remarkCount} / ${totalCount} mit Bemerkung`);
    const dateLabel = formatListDate(list.sessionDate);
    if (dateLabel) lines.push(`Datum: ${dateLabel}`);
  }

  return lines;
}

/**
 * Klassenlehrer-Liste als Tabellendaten für PDF/Excel.
 * @returns {{ headers: string[], rows: (string|number)[][], sectionTitle: string, metaLines: string[], layout: { colWidths: number[], centerColumnIndexes: number[], nameColumnIndex: number } }}
 */
export function buildKlassenlehrerListExportData({ list, type }) {
  const entries = list?.entries ?? [];
  const sectionTitle = list?.subject?.trim() || TYPE_LABELS[type] || 'Liste';
  const metaLines = buildKlassenlehrerListExportMetaLines({ list, type });

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
      metaLines,
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
    metaLines,
    layout: { colWidths: [8, 32, 32, 14], centerColumnIndexes: [0, 3], nameColumnIndex: 1 },
  };
}
