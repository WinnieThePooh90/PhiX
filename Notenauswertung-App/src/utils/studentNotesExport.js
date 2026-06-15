/** Nicht-leere Zeilen aus der Übersichts-Notiz eines Schülers. */
export function getStudentNoteLines(student) {
  const raw = String(student?.summaryNotes ?? '').trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Zusatzzeilen für Export direkt unter einem Schüler (je Notizzeile eine Zeile).
 * @param {string[]} noteLines
 * @param {number} colCount
 * @param {{ textColumnIndex?: number }} [opts]
 * @returns {(string|number)[][]}
 */
export function buildStudentNoteExportRows(noteLines, colCount, opts = {}) {
  const textCol = opts.textColumnIndex ?? 1;
  return noteLines.map((line, index) => {
    const row = Array(colCount).fill('');
    row[textCol] = index === 0 ? `Notiz: ${line}` : line;
    return row;
  });
}

/**
 * @param {object[]} students
 * @param {(student: object, index: number) => (string|number)[]} buildRow
 * @param {number} colCount
 * @param {{ textColumnIndex?: number }} [noteOpts]
 */
export function expandRowsWithStudentNotes(students, buildRow, colCount, noteOpts) {
  const rows = [];
  for (let idx = 0; idx < (students ?? []).length; idx += 1) {
    const student = students[idx];
    rows.push(buildRow(student, idx));
    const noteLines = getStudentNoteLines(student);
    if (noteLines.length) {
      rows.push(...buildStudentNoteExportRows(noteLines, colCount, noteOpts));
    }
  }
  return rows;
}
