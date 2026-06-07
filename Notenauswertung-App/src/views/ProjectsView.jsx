import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import {
  formatGrade,
  isGradeWorseThan4,
  getGradeCellBackground,
  getGradeTextColor,
  getNormalizedExamScore,
  getStudentEffectiveProjectFieldCount,
  getStudentProjectMaxPointsForGrade,
  getProjectGradeForStudent,
  isProjectManualGradeMode,
  getProjectDisplayFieldCount,
  getProjectNumFields,
  EXAM_ABS_MAX_FIELDS,
  getCustomKeyDefinition,
  normalizeCourseGradeSystem,
  isExamManualGradeActive,
  getExamManualGradeStoredValue,
  classicGradeToStoredString,
} from '../utils/calculator';
import GradingKeyTable from '../components/GradingKeyTable';
import MaximizableTableSection from '../components/MaximizableTableSection';
import { useDialog } from '../components/PhixDialog';

const PROJECT_INDEX_COL_PX = 52;

function getProjectFieldNameStored(project, fieldIndex) {
  const names = project?.fieldNames;
  if (!names || typeof names !== 'object') return '';
  const keyStr = String(fieldIndex);
  const raw = names[fieldIndex] ?? names[keyStr];
  if (raw === undefined || raw === null) return '';
  return String(raw);
}

function getProjectFieldNamePlaceholder(fieldIndex) {
  return `Thema ${fieldIndex + 1}`;
}

function getExamTaskMaxRule(exam, fieldIndex) {
  const fmp = exam.fieldMaxPoints;
  if (!fmp || typeof fmp !== 'object') {
    return { configured: false, max: null };
  }
  const keyStr = String(fieldIndex);
  const has =
    Object.prototype.hasOwnProperty.call(fmp, fieldIndex) ||
    Object.prototype.hasOwnProperty.call(fmp, keyStr);
  if (!has) {
    return { configured: false, max: null };
  }
  const raw = fmp[fieldIndex] ?? fmp[keyStr];
  if (raw === '' || raw === undefined || raw === null) {
    return { configured: false, max: null };
  }
  const maxN = parseFloat(String(raw).replace(',', '.'));
  if (Number.isNaN(maxN)) {
    return { configured: false, max: null };
  }
  return { configured: true, max: maxN };
}

function isExamScoreFieldOutOfRange(rawValue, rule) {
  if (rawValue === '' || rawValue === undefined || rawValue === null) return false;
  const n = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue).replace(',', '.'));
  if (Number.isNaN(n)) return false;
  if (n < 0) return true;
  if (!rule.configured) return n !== 0;
  return n > rule.max;
}

function ProjectRowBookmark({ variant }) {
  const absent = variant === 'absent';
  return (
    <svg
      width="9"
      height="12"
      viewBox="0 0 10 14"
      aria-hidden
      style={{
        display: 'block',
        filter: absent
          ? 'drop-shadow(0 1px 1px rgba(185, 28, 28, 0.35))'
          : 'drop-shadow(0 1px 1px rgba(202, 138, 4, 0.35))',
      }}
    >
      <path
        d="M1.25 1C1.25 0.72 1.47 0.5 1.75 0.5H8.25C8.53 0.5 8.75 0.72 8.75 1V9.35L5 12.15L1.25 9.35V1Z"
        fill={absent ? '#fee2e2' : '#fef9c3'}
        stroke={absent ? '#dc2626' : '#ca8a04'}
        strokeWidth="0.65"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const EMPTY_CREATE_FORM = {
  name: '',
  description: '',
  weightingMode: 'written',
  weightPercent: '20',
  gradeMode: 'key',
};

export default function ProjectsView({ studentIdFilterSet = null }) {
  const {
    projects,
    updateProject,
    updateProjectFields,
    removeProject,
    updateProjectScore,
    updateProjectFieldNames,
    updateProjectFieldMaxPoints,
    updateProjectCounted,
    updateProjectStudentNachschreiber,
    updateProjectStudentNachschreiberFields,
    updateProjectStudentManualGrade,
    updateProjectStudentManualGradeValue,
    students,
    addProject,
    config,
  } = useData();
  const { showConfirm } = useDialog();

  const displayStudents = useMemo(() => {
    if (studentIdFilterSet == null) return students;
    return students.filter((s) => studentIdFilterSet.has(s.id));
  }, [students, studentIdFilterSet]);

  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const projectNumbers = Object.keys(projects).sort((a, b) => Number(a) - Number(b));
  const [activeProject, setActiveProject] = useState(projectNumbers.length > 0 ? projectNumbers[0] : null);
  const [showKey, setShowKey] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [projectIndexTooltip, setProjectIndexTooltip] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const project = activeProject ? projects[activeProject] : null;
  const projectManualGradeMode = project ? isProjectManualGradeMode(project) : false;

  useEffect(() => {
    if (activeProject && projects[activeProject]) return;
    setActiveProject(projectNumbers.length > 0 ? projectNumbers[0] : null);
  }, [projectNumbers.join(','), activeProject, projects]);

  useEffect(() => {
    setExpandedStudentId(null);
  }, [activeProject]);

  useEffect(() => {
    if (projectManualGradeMode) setShowKey(false);
  }, [projectManualGradeMode, activeProject]);

  useEffect(() => {
    if (!createOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setCreateOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createOpen]);

  const openCreateModal = useCallback(() => {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateOpen(true);
  }, []);

  const handleCreateProject = async () => {
    if (createSubmitting) return;
    const name = createForm.name.trim();
    if (!name) return;
    setCreateSubmitting(true);
    try {
      const newNum = await addProject({
        name,
        description: createForm.description,
        weightingMode: createForm.weightingMode,
        weightPercent: createForm.weightingMode === 'percent'
          ? parseFloat(String(createForm.weightPercent).replace(',', '.')) || 0
          : 0,
        gradeMode: createForm.gradeMode === 'manual' ? 'manual' : 'key',
      });
      setCreateOpen(false);
      if (newNum) setActiveProject(String(newNum));
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (!project) {
    return (
      <>
        <div className="text-center mt-8 text-muted">
          Noch keine Projekte vorhanden.
          <br />
          <button type="button" className="mt-4" onClick={openCreateModal}>
            + Erstes Projekt anlegen
          </button>
        </div>
        {createOpen && createPortal(
          <CreateProjectModal
            form={createForm}
            setForm={setCreateForm}
            onClose={() => setCreateOpen(false)}
            onCreate={handleCreateProject}
            submitting={createSubmitting}
          />,
          document.body,
        )}
      </>
    );
  }

  const numFields = getProjectNumFields(project);
  const displayFieldCount = getProjectDisplayFieldCount(project, displayStudents);
  const customKeysList = Array.isArray(config?.customGradingKeys) ? config.customGradingKeys : [];
  const sidebarCustomDef = getCustomKeyDefinition(customKeysList, project.keyType || '1');

  const projectRowStats = (studentId) => {
    const rawSc = project.scores?.[studentId];
    const effN = getStudentEffectiveProjectFieldCount(project, studentId);
    const { fields, counted, total } = getNormalizedExamScore(rawSc, effN);
    const maxPts = getStudentProjectMaxPointsForGrade(project, studentId);
    const isManual = projectManualGradeMode || isExamManualGradeActive(rawSc);
    const grade = counted ? getProjectGradeForStudent(project, studentId, customKeysList, gradeSys) : null;
    const manualGradeInput = getExamManualGradeStoredValue(rawSc);
    return { effN, fields, counted, total, maxPts, grade, isManual, manualGradeInput };
  };

  const handleDeleteProject = async () => {
    const ok = await showConfirm(
      'Dieses Projekt wirklich endgültig löschen? Alle eingetragenen Punktwerte und Einstellungen gehen verloren.',
      { title: 'Projekt löschen', danger: true },
    );
    if (!ok) return;
    const id = activeProject;
    const remaining = projectNumbers.filter((n) => n !== id);
    const nextActive = remaining[0] ?? null;
    await removeProject(id);
    setActiveProject(nextActive);
  };

  return (
    <>
      <div className="view-page-scroll">
        <div className="view-toolbar-block exams-toolbar">
          <div className="flex justify-between items-center mb-4 pt-2 view-page-nav">
            <h2 style={{ margin: 0 }}>Projekte</h2>
            <div className="flex gap-2" style={{ overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
              {projectNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`tab ${activeProject === num ? 'active' : 'secondary'}`}
                  onClick={() => setActiveProject(num)}
                  title={projects[num]?.name || `Projekt ${num}`}
                >
                  P{num}
                </button>
              ))}
              <button
                type="button"
                className="tab secondary"
                onClick={openCreateModal}
                title="Neues Projekt hinzufügen"
                style={{ fontWeight: 'bold' }}
              >
                +
              </button>
            </div>
          </div>

          <div className="projects-meta-settings course-meta-settings-row">
            <div className="projects-meta-settings__row projects-meta-settings__row--split">
              <div className="projects-meta-settings__group">
                <div className="course-meta-field">
                  <span className="course-meta-field__label">Aktiv</span>
                  <div className="course-meta-field__row">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={project.active}
                        onChange={(e) => updateProject(activeProject, 'active', e.target.checked)}
                      />
                      <span className="slider" />
                    </label>
                  </div>
                </div>
                <div className="course-meta-field" style={{ minWidth: '180px', flex: '1 1 180px' }}>
                  <label className="course-meta-field__label" htmlFor={`project-name-${activeProject}`}>
                    Name
                  </label>
                  <input
                    id={`project-name-${activeProject}`}
                    className="course-meta-control"
                    type="text"
                    value={project.name || ''}
                    onChange={(e) => updateProject(activeProject, 'name', e.target.value)}
                  />
                </div>
              </div>
              <div className="projects-meta-settings__group projects-meta-settings__group--end">
                <div className="course-meta-field">
                  <label className="course-meta-field__label" htmlFor={`project-grade-mode-${activeProject}`}>
                    Notenermittlung
                  </label>
                  <select
                    id={`project-grade-mode-${activeProject}`}
                    className="course-meta-control"
                    value={project.gradeMode === 'manual' ? 'manual' : 'key'}
                    onChange={(e) => {
                      const mode = e.target.value === 'manual' ? 'manual' : 'key';
                      updateProject(activeProject, 'gradeMode', mode);
                      if (mode === 'manual') setShowKey(false);
                    }}
                  >
                    <option value="key">Notenschlüssel</option>
                    <option value="manual">Manuell</option>
                  </select>
                </div>
                {!projectManualGradeMode && (
                  <>
                    <div className="course-meta-field">
                      <label className="course-meta-field__label" htmlFor={`project-key-${activeProject}`}>
                        Notenschlüssel
                      </label>
                      <select
                        id={`project-key-${activeProject}`}
                        className="course-meta-control"
                        value={project.keyType || '1'}
                        onChange={(e) => updateProject(activeProject, 'keyType', e.target.value)}
                      >
                        <option value="1">Schlüssel 1</option>
                        <option value="2">Schlüssel 2</option>
                        <option value="3">Schlüssel 3</option>
                        <option value="4">Schlüssel 4 (Plateaus)</option>
                        <option value="5">Schlüssel 5 (Plateaus)</option>
                        <option value="6">Schlüssel 6 (Plateaus)</option>
                        <option value="abi">ABI BaWü 2026 120 BE</option>
                        {customKeysList.map((k) => (
                          <option key={k.id} value={`custom:${k.id}`}>
                            {k.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="course-meta-field">
                      <span className="course-meta-field__label">Schlüssel zeigen</span>
                      <div className="course-meta-field__row">
                        <label className="switch">
                          <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} />
                          <span className="slider" />
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="projects-meta-settings__row projects-meta-settings__row--split">
              <div className="projects-meta-settings__group">
              <div className="course-meta-field" style={{ minWidth: '220px' }}>
                <label className="course-meta-field__label" htmlFor={`project-weighting-${activeProject}`}>
                  Gewichtung
                </label>
                <select
                  id={`project-weighting-${activeProject}`}
                  className="course-meta-control"
                  value={project.weightingMode || 'written'}
                  onChange={(e) => {
                    const mode = e.target.value;
                    if (mode === 'percent') {
                      updateProjectFields(activeProject, {
                        weightingMode: mode,
                        weightPercent: Number(project.weightPercent) > 0 ? project.weightPercent : 20,
                      });
                    } else {
                      updateProjectFields(activeProject, { weightingMode: mode, weightPercent: 0 });
                    }
                  }}
                >
                  <option value="written">Zu schriftlich</option>
                  <option value="oral">Zu mündlich</option>
                  <option value="percent">Prozentual (Anteil an der Endnote)</option>
                </select>
              </div>
              {project.weightingMode === 'percent' && (
                <div className="course-meta-field">
                  <label className="course-meta-field__label" htmlFor={`project-percent-${activeProject}`}>
                    Prozentanteil
                  </label>
                  <input
                    id={`project-percent-${activeProject}`}
                    className="course-meta-control"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={project.weightPercent ?? 0}
                    onChange={(e) => {
                      const v = parseFloat(String(e.target.value).replace(',', '.'));
                      updateProject(activeProject, 'weightPercent', Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0);
                    }}
                    style={{ width: '5rem' }}
                  />
                </div>
              )}
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`project-hj-${activeProject}`}>
                  Halbjahr
                </label>
                <select
                  id={`project-hj-${activeProject}`}
                  className="course-meta-control"
                  value={project.halbjahr || '1'}
                  onChange={(e) => updateProject(activeProject, 'halbjahr', e.target.value)}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`project-date-${activeProject}`}>
                  Datum
                </label>
                <input
                  id={`project-date-${activeProject}`}
                  className="course-meta-control"
                  type="date"
                  value={project.date || ''}
                  onChange={(e) => updateProject(activeProject, 'date', e.target.value)}
                />
              </div>
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`project-numfields-${activeProject}`}>
                  Themenfelder
                </label>
                <input
                  id={`project-numfields-${activeProject}`}
                  className="course-meta-control"
                  type="number"
                  min="0"
                  max={EXAM_ABS_MAX_FIELDS}
                  value={numFields}
                  onChange={(e) => {
                    const fields = parseInt(e.target.value, 10);
                    if (!Number.isNaN(fields) && fields >= 0 && fields <= EXAM_ABS_MAX_FIELDS) {
                      updateProject(activeProject, 'numFields', fields);
                    }
                  }}
                  style={{ width: '70px' }}
                />
              </div>
              </div>
              <div className="projects-meta-settings__group projects-meta-settings__group--end">
                <div className="course-meta-field">
                  <span className="course-meta-field__label">Aktion</span>
                  <div className="course-meta-field__row">
                    <button
                      type="button"
                      className="tab secondary course-meta-inline-btn"
                      onClick={handleDeleteProject}
                      title="Projekt dauerhaft aus diesem Kurs entfernen"
                    >
                      Projekt löschen
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="projects-meta-settings__row projects-meta-settings__row--description">
              <div className="course-meta-field">
                <label className="course-meta-field__label" htmlFor={`project-desc-${activeProject}`}>
                  Beschreibung
                </label>
                <input
                  id={`project-desc-${activeProject}`}
                  className="course-meta-control"
                  type="text"
                  value={project.description || ''}
                  onChange={(e) => updateProject(activeProject, 'description', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {project.active ? (
          <div className={`exams-active-body ${showKey ? 'sidebar-layout' : ''}`}>
            <div className={`exams-main-stack ${showKey ? 'main-content' : ''}`}>
              <div className="exams-body-scroll view-table-scroll exam-table-scroll">
                <MaximizableTableSection title={project.name || `Projekt P${activeProject}`}>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th className="exam-th-sticky-left exam-th-r1" style={{ width: `${PROJECT_INDEX_COL_PX}px`, minWidth: `${PROJECT_INDEX_COL_PX}px`, left: 0 }}>#</th>
                          <th className="exam-th-sticky-left exam-th-r1" style={{ left: `${PROJECT_INDEX_COL_PX}px` }}>NAME</th>
                          {[...Array(displayFieldCount)].map((_, i) => (
                            <th
                              key={i}
                              className="text-center exam-th-r1 exam-task-col"
                              style={{
                                width: '100px',
                                minWidth: '100px',
                                textTransform: 'none',
                                background: i >= numFields ? 'hsl(var(--brand-hsl) / 0.04)' : undefined,
                                verticalAlign: 'bottom',
                                padding: '0.35rem 0.25rem',
                              }}
                            >
                              <input
                                type="text"
                                value={getProjectFieldNameStored(project, i)}
                                onChange={(e) => updateProjectFieldNames(activeProject, i, e.target.value)}
                                placeholder={getProjectFieldNamePlaceholder(i)}
                                title="Spaltenname des Themenfelds bearbeiten"
                                aria-label={`Name Themenfeld ${i + 1}`}
                                style={{
                                  textAlign: 'center',
                                  width: '100%',
                                  minWidth: '72px',
                                  borderRadius: 0,
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  background: i >= numFields ? 'var(--surface-muted)' : 'var(--surface)',
                                }}
                              />
                            </th>
                          ))}
                          <th className="text-center" style={{ width: '100px', minWidth: '100px', position: 'sticky', right: '100px', top: 'calc(var(--header-height) + 105px)', zIndex: 61, background: 'var(--surface-muted)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>GESAMT</th>
                          <th className="text-center" style={{ width: '100px', minWidth: '100px', position: 'sticky', right: 0, top: 'calc(var(--header-height) + 105px)', zIndex: 61, background: 'var(--surface-muted)', borderLeft: '1px solid var(--border)' }}>NOTE</th>
                        </tr>
                        <tr className="exam-thead-max-row" style={{ background: 'var(--bg-color)', fontWeight: 'bold' }}>
                          <th className="exam-th-sticky-left exam-th-r2" style={{ left: 0, textTransform: 'none' }}>Max</th>
                          <th className="exam-th-sticky-left exam-th-r2" style={{ left: `${PROJECT_INDEX_COL_PX}px`, textTransform: 'none' }}>Maximalpunkte</th>
                          {[...Array(displayFieldCount)].map((_, i) => (
                            <th key={i} className="text-center exam-th-r2 exam-task-col" style={{ textTransform: 'none', background: i >= numFields ? 'hsl(var(--brand-hsl) / 0.06)' : undefined }}>
                              <input
                                type="number"
                                value={project.fieldMaxPoints?.[i] ?? ''}
                                onChange={(e) => updateProjectFieldMaxPoints(activeProject, i, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                style={{ textAlign: 'center', width: '70px', minWidth: 'auto', borderRadius: 0, fontWeight: 'bold', background: i >= numFields ? 'var(--surface-muted)' : 'var(--surface)' }}
                              />
                            </th>
                          ))}
                          <th className="text-center" style={{ width: '100px', minWidth: '100px', position: 'sticky', right: '100px', top: 'calc(var(--header-height) + 146px)', zIndex: 61, background: 'var(--surface-muted)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', textTransform: 'none' }}>
                            {project.maxPoints}
                          </th>
                          <th style={{ position: 'sticky', right: 0, top: 'calc(var(--header-height) + 146px)', zIndex: 61, background: 'var(--surface-muted)', borderLeft: '1px solid var(--border)' }} />
                        </tr>
                      </thead>
                      <tbody>
                        {displayStudents.length === 0 && students.length > 0 && (
                          <tr>
                            <td colSpan={4 + displayFieldCount} className="text-center text-muted" style={{ padding: '2rem' }}>
                              Kein Schüler entspricht der Suche.
                            </td>
                          </tr>
                        )}
                        {displayStudents.map((s, idx) => {
                          const {
                            effN,
                            fields,
                            counted,
                            total: totalPoints,
                            maxPts,
                            grade,
                            isManual,
                            manualGradeInput,
                          } = projectRowStats(s.id);
                          const rawSc = project.scores?.[s.id];
                          const isNach = typeof rawSc === 'object' && rawSc !== null && !!rawSc._nachschreiber;
                          const showAbsentFlag = !counted;
                          const showNachFlag = counted && isNach;
                          const showIndexFlag = showAbsentFlag || showNachFlag;
                          const isExpanded = expandedStudentId === s.id;
                          const detailColSpan = 4 + displayFieldCount;

                          return (
                            <React.Fragment key={s.id}>
                              <tr style={{ transition: 'background 0.2s', background: isExpanded ? 'rgba(79, 70, 229, 0.05)' : '' }}>
                                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)', borderRight: '1px solid var(--border)', width: `${PROJECT_INDEX_COL_PX}px`, minWidth: `${PROJECT_INDEX_COL_PX}px`, verticalAlign: 'middle', textAlign: 'center', padding: 0 }}>
                                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: showIndexFlag ? 34 : undefined, paddingTop: showIndexFlag ? 2 : 0 }}>
                                    {showIndexFlag && (
                                      <span
                                        className="exam-index-flag"
                                        role="img"
                                        aria-label={showAbsentFlag ? 'Nicht teilgenommen' : 'Nachschreiber'}
                                        onMouseEnter={(e) => {
                                          const r = e.currentTarget.getBoundingClientRect();
                                          setProjectIndexTooltip({
                                            text: showAbsentFlag ? 'Nicht teilgenommen' : 'Nachschreiber',
                                            left: Math.min(window.innerWidth - 12, Math.max(12, r.left + r.width / 2)),
                                            top: r.bottom + 8,
                                          });
                                        }}
                                        onMouseLeave={() => setProjectIndexTooltip(null)}
                                      >
                                        <ProjectRowBookmark variant={showAbsentFlag ? 'absent' : 'nach'} />
                                      </span>
                                    )}
                                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</span>
                                  </div>
                                </td>
                                <td
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setExpandedStudentId((prev) => (prev === s.id ? null : s.id))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setExpandedStudentId((prev) => (prev === s.id ? null : s.id));
                                    }
                                  }}
                                  style={{ position: 'sticky', left: `${PROJECT_INDEX_COL_PX}px`, zIndex: 1, background: 'var(--surface)', borderRight: '1px solid var(--border)', cursor: 'pointer' }}
                                  title="Klicken für Teilnahme / Details"
                                >
                                  {s.lastName}, {s.firstName}
                                </td>
                                {[...Array(displayFieldCount)].map((_, fieldIndex) => {
                                  const beyond = fieldIndex >= effN;
                                  const val = fields[fieldIndex] !== undefined ? fields[fieldIndex] : '';
                                  const maxRule = getExamTaskMaxRule(project, fieldIndex);
                                  const scoreOutOfRange = !beyond && isExamScoreFieldOutOfRange(val, maxRule);
                                  return (
                                    <td key={fieldIndex} className="text-center exam-task-col" style={{ opacity: beyond ? 0.45 : 1, verticalAlign: 'middle' }}>
                                      {beyond ? (
                                        <span className="text-muted" title="Für diesen Schüler nicht gewertet">—</span>
                                      ) : (
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={val}
                                          onChange={(e) => updateProjectScore(activeProject, s.id, fieldIndex, e.target.value)}
                                          placeholder="0"
                                          className={scoreOutOfRange ? 'exam-score-input--out-of-range' : undefined}
                                          style={{ textAlign: 'center', width: '70px', minWidth: 'auto', borderRadius: 0 }}
                                        />
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="text-center" style={{ width: '100px', minWidth: '100px', position: 'sticky', right: '100px', zIndex: 1, background: 'var(--surface)', fontWeight: 'bold', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                                  {totalPoints}
                                  <span className="text-muted" style={{ fontWeight: 'normal', fontSize: '0.8rem' }}> / {maxPts}</span>
                                </td>
                                <td
                                  className="text-center"
                                  style={{
                                    width: '100px',
                                    minWidth: '100px',
                                    position: 'sticky',
                                    right: 0,
                                    zIndex: 1,
                                    background: counted && grade !== null ? (getGradeCellBackground(grade) ?? 'var(--surface)') : 'var(--surface)',
                                    color: counted && grade !== null ? getGradeTextColor(grade) : undefined,
                                    borderLeft: '1px solid var(--border)',
                                  }}
                                >
                                  {counted && isManual ? (
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      className="exam-manual-grade-input"
                                      value={manualGradeInput}
                                      onChange={(e) => updateProjectStudentManualGradeValue(activeProject, s.id, e.target.value)}
                                      placeholder={gradeSys === 'points' ? 'NP' : 'Note'}
                                      style={{ textAlign: 'center', width: '4.5rem', minWidth: 'auto', fontWeight: 'bold', borderRadius: 0 }}
                                    />
                                  ) : counted && grade !== null ? (
                                    <span style={{ fontWeight: 'bold', color: isGradeWorseThan4(grade) ? 'var(--danger)' : 'var(--foreground)' }}>
                                      {formatGrade(grade, gradeSys)}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr style={{ background: 'rgba(15, 23, 42, 0.015)' }}>
                                  <td colSpan={detailColSpan} style={{ padding: 0, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                                    <div style={{ position: 'sticky', left: 0, zIndex: 4, display: 'inline-flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', padding: '0.75rem 1rem', background: 'var(--surface)', boxShadow: '4px 0 14px rgba(0, 0, 0, 0.08)' }}>
                                      <span className="text-muted" style={{ fontSize: '0.875rem' }}>Teilgenommen:</span>
                                      <label className="switch switch--table-row">
                                        <input type="checkbox" checked={counted} onChange={(e) => updateProjectCounted(activeProject, s.id, e.target.checked)} />
                                        <span className="slider" />
                                      </label>
                                      <span className="text-muted" style={{ fontSize: '0.875rem', marginLeft: '0.75rem' }}>Nachschreiber:</span>
                                      <label className="switch switch--table-row">
                                        <input type="checkbox" checked={isNach} onChange={(e) => updateProjectStudentNachschreiber(activeProject, s.id, e.target.checked)} />
                                        <span className="slider" />
                                      </label>
                                      {isNach && (
                                        <>
                                          <span className="text-muted" style={{ fontSize: '0.875rem' }}>Themenfelder:</span>
                                          <input
                                            type="number"
                                            min={1}
                                            max={EXAM_ABS_MAX_FIELDS}
                                            value={effN}
                                            onChange={(e) => updateProjectStudentNachschreiberFields(activeProject, s.id, e.target.value)}
                                            style={{ width: '56px', textAlign: 'center', padding: '0.2rem' }}
                                          />
                                        </>
                                      )}
                                      {!projectManualGradeMode && (
                                        <>
                                          <span className="text-muted" style={{ fontSize: '0.875rem', marginLeft: '0.75rem' }}>Manuelle Note:</span>
                                          <label className="switch switch--table-row">
                                            <input
                                              type="checkbox"
                                              checked={isManual}
                                              onChange={(e) => {
                                                const checked = e.target.checked;
                                                if (!checked) {
                                                  updateProjectStudentManualGrade(activeProject, s.id, false);
                                                  return;
                                                }
                                                const stored = getExamManualGradeStoredValue(rawSc);
                                                if (stored.trim() !== '') {
                                                  updateProjectStudentManualGrade(activeProject, s.id, true);
                                                  return;
                                                }
                                                const { grade: calcGrade } = projectRowStats(s.id);
                                                const seed = calcGrade != null ? classicGradeToStoredString(calcGrade, gradeSys) : '';
                                                updateProjectStudentManualGrade(activeProject, s.id, true, seed);
                                              }}
                                            />
                                            <span className="slider" />
                                          </label>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </MaximizableTableSection>
              </div>
            </div>
            {showKey && !projectManualGradeMode && (
              <aside className="exams-sidebar">
                <GradingKeyTable
                  keyType={project.keyType || '1'}
                  maxPoints={project.maxPoints}
                  customDef={sidebarCustomDef}
                  gradeSystem={gradeSys}
                />
              </aside>
            )}
          </div>
        ) : (
          <p className="text-muted" style={{ marginTop: '1rem' }}>Dieses Projekt ist deaktiviert.</p>
        )}
      </div>

      {createOpen && createPortal(
        <CreateProjectModal
          form={createForm}
          setForm={setCreateForm}
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreateProject}
          submitting={createSubmitting}
        />,
        document.body,
      )}

      {projectIndexTooltip && createPortal(
        <div
          className="exam-index-tooltip"
          style={{ position: 'fixed', left: projectIndexTooltip.left, top: projectIndexTooltip.top, transform: 'translateX(-50%)', zIndex: 10000 }}
        >
          {projectIndexTooltip.text}
        </div>,
        document.body,
      )}
    </>
  );
}

function CreateProjectModal({ form, setForm, onClose, onCreate, submitting }) {
  const fieldLabelStyle = { display: 'block', marginBottom: '0.35rem' };
  const fieldControlStyle = { width: '100%', boxSizing: 'border-box' };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        style={{ maxWidth: '480px', width: 'calc(100% - 2rem)' }}
      >
        <h2 id="create-project-title" style={{ marginTop: 0 }}>Neues Projekt</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label className="course-meta-field__label" htmlFor="create-project-name" style={fieldLabelStyle}>
              Name
            </label>
            <input
              id="create-project-name"
              className="course-meta-control"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="z. B. Versuchsprotokoll"
              style={fieldControlStyle}
              autoFocus
            />
          </div>
          <div>
            <label className="course-meta-field__label" htmlFor="create-project-description" style={fieldLabelStyle}>
              Beschreibung
            </label>
            <textarea
              id="create-project-description"
              className="course-meta-control"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Kurzbeschreibung des Projekts"
              style={{ ...fieldControlStyle, resize: 'vertical' }}
            />
          </div>
          <div>
            <label className="course-meta-field__label" htmlFor="create-project-weighting" style={fieldLabelStyle}>
              Gewichtung
            </label>
            <select
              id="create-project-weighting"
              className="course-meta-control"
              value={form.weightingMode}
              onChange={(e) => setForm((f) => ({ ...f, weightingMode: e.target.value }))}
              style={fieldControlStyle}
            >
              <option value="written">Zu schriftlich</option>
              <option value="oral">Zu mündlich</option>
              <option value="percent">Prozentual (Anteil an der Endnote)</option>
            </select>
          </div>
          {form.weightingMode === 'percent' && (
            <div>
              <label className="course-meta-field__label" htmlFor="create-project-percent" style={fieldLabelStyle}>
                Prozentanteil an der Endnote
              </label>
              <input
                id="create-project-percent"
                className="course-meta-control"
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.weightPercent}
                onChange={(e) => setForm((f) => ({ ...f, weightPercent: e.target.value }))}
                style={{ width: '8rem' }}
              />
            </div>
          )}
          <div>
            <label className="course-meta-field__label" htmlFor="create-project-grade-mode" style={fieldLabelStyle}>
              Notenermittlung
            </label>
            <select
              id="create-project-grade-mode"
              className="course-meta-control"
              value={form.gradeMode}
              onChange={(e) => setForm((f) => ({ ...f, gradeMode: e.target.value }))}
              style={fieldControlStyle}
            >
              <option value="key">Notenschlüssel</option>
              <option value="manual">Manuell</option>
            </select>
          </div>
        </div>
        <div
          className="flex gap-2"
          style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}
        >
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={submitting || !form.name.trim()}
          >
            Erstellen
          </button>
        </div>
      </div>
    </div>
  );
}
