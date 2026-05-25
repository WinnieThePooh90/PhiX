/**
 * Feldkatalog: alle String/Json-Felder pro Modell, die mit dem Benutzer-DEK verschlüsselt werden.
 */

const ENCRYPTED_FIELDS = {
  Course: ['year', 'className', 'subject', 'gradeSystem', 'weighting', 'customGradingKeys'],
  Student: ['firstName', 'lastName', 'summaryEndNote', 'summaryHJ1Note', 'frontendId'],
  SchoolRosterYear: ['label'],
  SchoolRosterStudent: ['firstName', 'lastName'],
  Exam: ['name', 'date', 'halbjahr', 'keyType', 'fieldMaxPoints', 'scores'],
  Test: ['name', 'date', 'halbjahr', 'keyType', 'scores'],
  Oral: ['name', 'date', 'halbjahr', 'grades'],
  GfsEntry: ['thema', 'art', 'date', 'halbjahr', 'note'],
  MoneyList: ['subject', 'notes', 'dueDate'],
  MoneyListEntry: ['externalFirstName', 'externalLastName'],
  AttendanceList: ['subject', 'notes', 'sessionDate'],
  AttendanceListEntry: ['externalFirstName', 'externalLastName'],
  CollectionList: ['subject', 'notes', 'sessionDate'],
  CollectionListEntry: ['externalFirstName', 'externalLastName'],
  NotesList: ['subject', 'notes', 'sessionDate'],
  NotesListEntry: ['externalFirstName', 'externalLastName', 'remark'],
  Config: ['year', 'className', 'subject', 'weighting'],
};

const JSON_FIELDS = new Set([
  'weighting',
  'customGradingKeys',
  'fieldMaxPoints',
  'scores',
  'grades',
]);

const DATE_STRING_FIELDS = new Set(['dueDate', 'sessionDate']);

function getEncryptedFields(modelName) {
  return ENCRYPTED_FIELDS[modelName] || null;
}

function isJsonField(field) {
  return JSON_FIELDS.has(field);
}

function isDateStringField(field) {
  return DATE_STRING_FIELDS.has(field);
}

module.exports = {
  ENCRYPTED_FIELDS,
  getEncryptedFields,
  isJsonField,
  isDateStringField,
};
