import React from 'react';
import {
  calculateStudentGrades,
  formatGrade,
  formatCalculatedGradeValue,
  formatOverviewCalculatedGrade,
  calculatedGradeDisplayOpts,
  isGradeWorseThan4,
  getExamGradeForStudent,
  getTestGradeForStudent,
  getNormalizedExamScore,
  getStudentEffectiveExamFieldCount,
  getNormalizedOralGrade,
  getNormalizedTestScore,
  getProjectGradeForStudent,
  getProjectScoreKeyForStudent,
  getStudentEffectiveProjectFieldCount,
  storedGradeStringToClassic,
} from '../utils/calculator';

const GRADE_OVERVIEW_CATEGORIES = [
  { label: 'Halbjahr 1', filter: '1' },
  { label: 'Halbjahr 2', filter: '2' },
  { label: 'Gesamt (Durchschnitt)', filter: null },
];

function isProjectScoreCounted(project, studentId) {
  if (!project?.active) return false;
  const scoreKey = getProjectScoreKeyForStudent(project, studentId);
  if (scoreKey == null) return false;
  const raw = project.scores?.[scoreKey];
  if (raw && typeof raw === 'object' && raw._counted === false) return false;
  const { counted } = getNormalizedExamScore(raw, getStudentEffectiveProjectFieldCount(project, studentId));
  return counted;
}

function filterProjectsForSummary(projects, weightingMode, halbjahrFilter) {
  return Object.entries(projects || {})
    .filter(([_, p]) => p.active && (p.weightingMode || 'written') === weightingMode && (!halbjahrFilter || p.halbjahr === halbjahrFilter))
    .sort(([a], [b]) => Number(a) - Number(b));
}

function renderProjectListItems(projectEntries, studentId, customGradingKeys, gradeSys, gfmt, showPercent = false, listFontSize = '0.85rem') {
  return projectEntries.map(([id, p]) => {
    const counted = isProjectScoreCounted(p, studentId);
    const gr = getProjectGradeForStudent(p, studentId, customGradingKeys, gradeSys);
    const pct =
      showPercent && Number.isFinite(Number(p.weightPercent)) && Number(p.weightPercent) > 0
        ? ` (${p.weightPercent}%)`
        : '';
    const label = `${p.name || `Projekt ${id}`}${pct}`;
    return (
      <li key={`proj-${id}`} className="text-muted" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: listFontSize }}>
        <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>{label}:</span>
        <strong style={{ color: !counted ? 'var(--text-muted)' : (isGradeWorseThan4(gr, gradeSys) ? 'var(--danger)' : 'var(--foreground)') }}>
          {counted && gr !== null ? gfmt(gr) : '-'}
        </strong>
      </li>
    );
  });
}

function gradeListItemStyle(fontSize) {
  return { display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize };
}

function sectionTitleStyle() {
  return {
    color: 'var(--text-main)',
    marginBottom: '0.5rem',
    fontSize: '0.9rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };
}

/**
 * Notenübersicht je Halbjahr und gesamt (wie aufklappbare Zeile in der Übersicht).
 */
export default function StudentGradesOverviewPanel({
  student,
  exams,
  orals,
  tests,
  projects,
  gfsEntries,
  weighting,
  customGradingKeys,
  gradeSys,
  testsWritten = true,
  testsAsHalfExam = false,
  testsAsOral = false,
  kursstufe = false,
  compact = false,
}) {
  if (!student) return null;

  const categories = kursstufe
    ? [{ label: 'Gesamt (Durchschnitt)', filter: null }]
    : GRADE_OVERVIEW_CATEGORIES;

  const gfmt = (g) => formatGrade(g, gradeSys);
  const panelPadding = compact ? '1rem' : '1.5rem';
  const listFontSize = compact ? '0.8rem' : '0.85rem';
  const titleSize = compact ? '1rem' : '1.1rem';
  const finalSize = compact ? '1.15rem' : '1.3rem';

  return (
    <div
      className="grid-3 gap-6 student-grades-overview-panel"
      style={{
        backgroundColor: 'var(--surface)',
        padding: panelPadding,
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      }}
    >
      {categories.map((cat, catIdx) => {
        const { examAvg, oralAvg, testAvg, finalGrade, valuesAreNotenpunkte } = calculateStudentGrades(
          student.id,
          exams,
          orals,
          tests,
          weighting,
          cat.filter,
          gfsEntries,
          customGradingKeys,
          gradeSys,
          testsWritten,
          projects,
          testsAsHalfExam,
          testsAsOral,
        );
        const calcOpts = calculatedGradeDisplayOpts(valuesAreNotenpunkte, gradeSys);
        const gfmtCalc = (g) => formatCalculatedGradeValue(g, gradeSys, valuesAreNotenpunkte);
        const gfmtOverview = (g) => formatOverviewCalculatedGrade(g, gradeSys, valuesAreNotenpunkte);
        const rounded = finalGrade !== null ? Math.round(finalGrade) : null;
        const writtenProjects = filterProjectsForSummary(projects, 'written', cat.filter);
        const oralProjects = filterProjectsForSummary(projects, 'oral', cat.filter);
        const percentProjects = filterProjectsForSummary(projects, 'percent', cat.filter);
        const isLastCategory = catIdx === categories.length - 1;

        return (
          <div
            key={cat.label}
            style={{
              borderRight: !isLastCategory ? '1px solid var(--border)' : 'none',
              paddingRight: !isLastCategory ? '1.5rem' : 0,
            }}
          >
            <div style={{ marginBottom: compact ? '1rem' : '1.25rem', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem' }}>
              <h3 style={{ fontSize: titleSize, margin: 0 }}>{cat.label}</h3>
              <div style={{ fontSize: finalSize, fontWeight: 'bold', marginTop: '0.25rem' }}>
                <span style={{ color: isGradeWorseThan4(finalGrade, gradeSys, calcOpts) ? 'var(--danger)' : 'var(--foreground)' }}>{gfmtOverview(finalGrade)}</span>
                {' '}
                <span
                  style={{
                    fontSize: compact ? '0.82rem' : '0.9rem',
                    fontWeight: 'normal',
                    color: rounded !== null && isGradeWorseThan4(rounded, gradeSys, calcOpts) ? 'var(--danger)' : 'var(--text-muted)',
                  }}
                >
                  ({rounded !== null ? gfmtCalc(rounded) : '-'})
                </span>
              </div>
            </div>

            <div className="mb-4">
              <h4 style={sectionTitleStyle()}>Schriftlich ({gfmtOverview(examAvg)})</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {Object.entries(exams)
                  .filter(([_, e]) => e.active && (!cat.filter || e.halbjahr === cat.filter))
                  .map(([id, e]) => {
                    const { counted } = getNormalizedExamScore(
                      e.scores?.[student.id],
                      getStudentEffectiveExamFieldCount(e, student.id),
                    );
                    const gr = getExamGradeForStudent(e, student.id, customGradingKeys);
                    return (
                      <li key={id} className="text-muted" style={gradeListItemStyle(listFontSize)}>
                        <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>KA {id}:</span>
                        <strong style={{ color: !counted ? 'var(--text-muted)' : (isGradeWorseThan4(gr, gradeSys) ? 'var(--danger)' : 'var(--foreground)') }}>
                          {counted && gr !== null ? gfmt(gr) : '-'}
                        </strong>
                      </li>
                    );
                  })}
                {gfsEntries
                  .filter((e) => e.studentId === student.id && (!cat.filter || e.halbjahr === cat.filter))
                  .map((e) => {
                    const label = [e.thema, e.art].filter(Boolean).join(' · ') || 'GFS';
                    const gNum = storedGradeStringToClassic(e.note, gradeSys);
                    const counted = e.gehalten === true && gNum !== null;
                    return (
                      <li key={`gfs-${e.id}`} className="text-muted" style={gradeListItemStyle(listFontSize)}>
                        <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>GFS {label}:</span>
                        <strong style={{ color: !counted ? 'var(--text-muted)' : (isGradeWorseThan4(gNum, gradeSys) ? 'var(--danger)' : 'var(--foreground)') }}>
                          {counted ? gfmt(gNum) : '-'}
                        </strong>
                      </li>
                    );
                  })}
                {renderProjectListItems(writtenProjects, student.id, customGradingKeys, gradeSys, gfmt, false, listFontSize)}
              </ul>
            </div>

            <div className="mb-4">
              <h4 style={sectionTitleStyle()}>Mündlich ({gfmtOverview(oralAvg)})</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {Object.entries(orals)
                  .filter(([_, o]) => o.active !== false && (!cat.filter || o.halbjahr === cat.filter))
                  .map(([id, o]) => {
                    const { value, counted } = getNormalizedOralGrade(o.grades[student.id]);
                    const oralG = counted && value ? storedGradeStringToClassic(String(value), gradeSys) : null;
                    return (
                      <li key={id} className="text-muted" style={gradeListItemStyle(listFontSize)}>
                        <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>{o.name}:</span>
                        <strong style={{ color: !counted ? 'var(--text-muted)' : (oralG !== null && isGradeWorseThan4(oralG, gradeSys) ? 'var(--danger)' : 'var(--foreground)') }}>
                          {counted && oralG !== null ? gfmt(oralG) : '-'}
                        </strong>
                      </li>
                    );
                  })}
                {renderProjectListItems(oralProjects, student.id, customGradingKeys, gradeSys, gfmt, false, listFontSize)}
              </ul>
            </div>

            {testsWritten && (
              <div>
                <h4 style={sectionTitleStyle()}>Tests ({gfmtCalc(testAvg)})</h4>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {Object.entries(tests)
                    .filter(([_, t]) => t.active && (!cat.filter || t.halbjahr === cat.filter))
                    .map(([id, t]) => {
                      const sm = t.scores ?? t.errors;
                      const { counted } = getNormalizedTestScore(sm?.[student.id]);
                      const gr = counted ? getTestGradeForStudent(t, student.id, customGradingKeys, gradeSys) : null;
                      return (
                        <li key={id} className="text-muted" style={gradeListItemStyle(listFontSize)}>
                          <span style={{ textDecoration: !counted ? 'line-through' : 'none' }}>{t.name}:</span>
                          <strong style={{ color: !counted ? 'var(--text-muted)' : (isGradeWorseThan4(gr, gradeSys) ? 'var(--danger)' : 'var(--foreground)') }}>
                            {counted && gr !== null ? gfmt(gr) : '-'}
                          </strong>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}

            {percentProjects.length > 0 && (
              <div>
                <h4 style={{ ...sectionTitleStyle(), marginTop: testsWritten ? '1rem' : 0 }}>Projekte (prozentual)</h4>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {renderProjectListItems(percentProjects, student.id, customGradingKeys, gradeSys, gfmt, true, listFontSize)}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
