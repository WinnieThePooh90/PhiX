/**
 * Zeilenweise Ent-/Verschlüsselung gemäß encryption-registry.js.
 */
const { encryptField, decryptField, isEncryptedValue } = require('./phix-crypto');
const {
  getEncryptedFields,
  isJsonField,
  isDateStringField,
} = require('./encryption-registry');

function serializeFieldValue(field, value) {
  if (value == null) return null;
  if (field === 'frontendId') {
    if (typeof value === 'bigint') return value.toString();
    if (value === '') return '';
    return String(value);
  }
  if (isJsonField(field)) {
    if (typeof value === 'string' && isEncryptedValue(value)) return value;
    return JSON.stringify(value);
  }
  if (isDateStringField(field)) {
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
  return String(value);
}

function deserializeFieldValue(field, plain) {
  if (plain == null || plain === '') return plain;
  if (field === 'frontendId') {
    if (plain === '') return null;
    try {
      return BigInt(plain);
    } catch {
      return null;
    }
  }
  if (isJsonField(field)) {
    try {
      return JSON.parse(plain);
    } catch {
      return plain;
    }
  }
  if (isDateStringField(field)) {
    const d = new Date(plain);
    return Number.isNaN(d.getTime()) ? plain : d;
  }
  return plain;
}

function encryptRow(dek, modelName, row, { partial = false } = {}) {
  if (!dek || !row || typeof row !== 'object') return row;
  const fields = getEncryptedFields(modelName);
  if (!fields) return row;
  const out = { ...row };
  for (const field of fields) {
    if (partial && !(field in out)) continue;
    const val = out[field];
    if (val == null || val === '') continue;
    if (typeof val === 'string' && isEncryptedValue(val)) continue;
    const serialized = serializeFieldValue(field, val);
    if (serialized == null || serialized === '') continue;
    out[field] = encryptField(dek, serialized);
  }
  return out;
}

function decryptRow(dek, modelName, row) {
  if (!dek || !row || typeof row !== 'object') return row;
  const fields = getEncryptedFields(modelName);
  if (!fields) return row;
  const out = { ...row };
  for (const field of fields) {
    const val = out[field];
    if (val == null || val === '') continue;
    if (typeof val === 'string' && !isEncryptedValue(val)) continue;
    const plain = decryptField(dek, val);
    out[field] = deserializeFieldValue(field, plain);
  }
  return out;
}

function encryptRows(dek, modelName, rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((r) => encryptRow(dek, modelName, r));
}

/** Listen-Einträge (Klassenlehrer): Eintrag + verknüpfter Schüler (Prisma-Include wird nicht auto-entschlüsselt). */
function decryptKlassenlehrerListEntry(dek, entry, entryModelName) {
  if (!entry || typeof entry !== 'object') return entry;
  if (!dek) return entry;
  const decrypted = decryptRow(dek, entryModelName, { ...entry });
  if (decrypted.student) {
    decrypted.student = decryptRow(dek, 'Student', { ...decrypted.student });
  }
  return decrypted;
}

module.exports = {
  encryptRow,
  decryptRow,
  encryptRows,
  decryptKlassenlehrerListEntry,
  serializeFieldValue,
  deserializeFieldValue,
};
