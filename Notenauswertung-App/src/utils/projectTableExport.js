import {
  formatGrade,
  getExamManualGradeStoredValue,
  getNormalizedExamScore,
  getProjectDisplayFieldCount,
  getProjectEffectiveFieldCountForScoreKey,
  getProjectGradeForScoreKey,
  getProjectGradeForStudent,
  getProjectGroupScoreData,
  getProjectGroups,
  getProjectMaxPointsForScoreKey,
  getProjectMemberManualGradeStoredValue,
  getProjectGroupMemberOverride,
  gradingKeyResultDisplayOpts,
  isExamManualGradeActive,
  isProjectGroupGradeMode,
  isProjectGroupMemberCounted,
  isProjectGroupMemberManualGradeActive,
  isProjectManualGradeMode,
  normalizeCourseGradeSystem,
} from './calculator';
import { buildExamTableExportLayout } from './examTableExport';
import { resolveExamGradingKeyForExport } from './gradingKeyExport';
import { expandRowsWithStudentNotes } from './studentNotesExport';

function studentNameCell(s) {
  return `${s.lastName ?? ''}, ${s.firstName ?? ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '—';
}

function getProjectFieldName(project, fieldIndex) {
  const names = project?.fieldNames;
  if (!names || typeof names !== 'object') return `Thema ${fieldIndex + 1}`;
  const keyStr = String(fieldIndex);
  const raw = names[fieldIndex] ?? names[keyStr];
  if (raw === undefined || raw === null || String(raw).trim() === '') return `Thema ${fieldIndex + 1}`;
  return String(raw);
}

function formatProjectNote({
  counted,
  isManual,
  rawScoreData,
  grade,
  gradeSys,
}) {
  if (!counted) return '-';
  if (isManual) {
    const stored = getExamManualGradeStoredValue(rawScoreData);
    return stored.trim() !== '' ? stored : '-';
  }
  if (grade !== null) {
    return formatGrade(grade, gradeSys, gradingKeyResultDisplayOpts(gradeSys));
  }
  return '-';
}

function buildProjectScoreRowCells({
  project,
  scoreKey,
  displayFieldCount,
  customGradingKeys,
  gradeSys,
  projectManualGradeMode,
}) {
  const rawSc = project.scores?.[scoreKey];
  const effN = getProjectEffectiveFieldCountForScoreKey(project, scoreKey);
  const { fields, counted, total } = getNormalizedExamScore(rawSc, effN);
  const maxPts = getProjectMaxPointsForScoreKey(project, scoreKey);
  const isManual = projectManualGradeMode || isExamManualGradeActive(rawSc);
  const grade = counted ? getProjectGradeForScoreKey(project, scoreKey, customGradingKeys, gradeSys) : null;

  const taskCells = Array.from({ length: displayFieldCount }, (_, fieldIndex) => {
    if (fieldIndex >= effN) return '—';
    const val = fields[fieldIndex];
    return val !== undefined && val !== null && val !== '' ? val : '';
  });

  const gesamt = counted ? `${total} / ${maxPts}` : '—';
  const note = formatProjectNote({
    counted,
    isManual,
    rawScoreData: rawSc,
    grade,
    gradeSys,
  });

  return { taskCells, gesamt, note };
}

/**
 * Projekt-Tabelle (Einzel- oder Gruppenmodus) als AOA.
 * @returns {{ aoa: (string|number)[][], layout: ReturnType<typeof buildExamTableExportLayout>, gradingKey: ReturnType<typeof resolveExamGradingKeyForExport> | null }}
 */
export function buildProjectTableExport({ project, projectId, students, config }) {
  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const customGradingKeys = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const projectManualGradeMode = isProjectManualGradeMode(project);
  const displayFieldCount = getProjectDisplayFieldCount(project, students);
  const isGroupMode = isProjectGroupGradeMode(project);
  const nameColLabel = isGroupMode ? 'GRUPPE' : 'NAME';

  const header1 = [
    '#',
    nameColLabel,
    ...Array.from({ length: displayFieldCount }, (_, i) => getProjectFieldName(project, i)),
    'GESAMT',
    'NOTE',
  ];

  const maxRow = [
    isGroupMode ? '' : 'Max',
    'Maximalpunkte',
    ...Array.from({ length: displayFieldCount }, (_, i) => {
      const v = project?.fieldMaxPoints?.[i];
      return v !== undefined && v !== null && v !== '' ? v : '';
    }),
    project?.maxPoints ?? '',
    'Ø',
  ];

  /** @type {(string|number)[][]} */
  const dataRows = [];

  if (isGroupMode) {
    const groups = Object.entries(getProjectGroups(project)).sort(([a], [b]) => Number(a) - Number(b));
    for (const [gid, grp] of groups) {
      const groupLabel = grp?.name?.trim() ? grp.name : `Gruppe ${gid}`;
      const { taskCells, gesamt, note } = buildProjectScoreRowCells({
        project,
        scoreKey: gid,
        displayFieldCount,
        customGradingKeys,
        gradeSys,
        projectManualGradeMode,
      });
      dataRows.push(['', groupLabel, ...taskCells, gesamt, note]);

      const memberIds = Array.isArray(grp?.studentIds) ? grp.studentIds : [];
      for (const sid of memberIds) {
        const st = (students ?? []).find((s) => Number(s.id) === Number(sid));
        const rawGroupScore = getProjectGroupScoreData(project, gid);
        const memberOv = getProjectGroupMemberOverride(rawGroupScore, sid);
        const memberCounted = isProjectGroupMemberCounted(project, gid, sid);
        const memberManualActive = isProjectGroupMemberManualGradeActive(rawGroupScore, sid);
        const memberIsManual = projectManualGradeMode || memberManualActive;
        const memberGrade = memberCounted
          ? getProjectGradeForStudent(project, sid, customGradingKeys, gradeSys)
          : null;
        let memberNote = '-';
        if (memberCounted) {
          if (memberIsManual) {
            const input = projectManualGradeMode
              ? getProjectMemberManualGradeStoredValue(rawGroupScore, sid)
              : getExamManualGradeStoredValue(memberOv);
            memberNote = input.trim() !== '' ? input : '-';
          } else if (memberGrade !== null) {
            memberNote = formatGrade(memberGrade, gradeSys, gradingKeyResultDisplayOpts(gradeSys));
          }
        }
        dataRows.push([
          st?.studentNumber ?? '',
          st ? `  ${studentNameCell(st)}` : '',
          ...Array.from({ length: displayFieldCount }, () => ''),
          '',
          memberNote,
        ]);
      }
    }
  } else {
    dataRows.push(
      ...expandRowsWithStudentNotes(
        students,
        (s, idx) => {
          const { taskCells, gesamt, note } = buildProjectScoreRowCells({
            project,
            scoreKey: s.id,
            displayFieldCount,
            customGradingKeys,
            gradeSys,
            projectManualGradeMode,
          });
          return [s.studentNumber ?? idx + 1, studentNameCell(s), ...taskCells, gesamt, note];
        },
        header1.length,
        { textColumnIndex: 1 },
      ),
    );
  }

  const gradingKey = projectManualGradeMode ? null : resolveExamGradingKeyForExport(project, config);

  return {
    aoa: [header1, maxRow, ...dataRows],
    layout: buildExamTableExportLayout(displayFieldCount),
    gradingKey,
  };
}

export function projectExportSheetName(projectId, projectName) {
  const n = projectName?.trim();
  if (n) return n.length <= 31 ? n : n.slice(0, 31);
  return `Projekt P${projectId}`;
}
