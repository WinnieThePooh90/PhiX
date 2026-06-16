import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { useData } from '../store/DataContext';
import { ABI_BAWUE_2026_120_BE_KEY, isAbiBaWue2026KeyFamilyId, LEGACY_BUILTIN_ABI_KEY_TYPE } from '../data/kmBwAbiPhysik2026GradingKey';
import { isAbiBaWue2026Mathematik100BeFamilyId } from '../data/abiBaWu2026Mathematik100BeGradingKey';
import { buildVorlage1Bands, isVorlage1KeyFamilyId } from '../data/vorlage1GradingKey';
import {
  getBuiltinGradingKeyTitle,
  getBuiltinGradingKeyShortDesc,
  getFormulaKeyHelpText,
  getPlateauKeyShortDesc,
  isPlateauGradingKeyType,
} from '../data/gradingKeyDisplay';
import {
  formatGrade,
  isGradeWorseThan4,
  getGradeCellBackground,
  getGradeTextColor,
  getNormalizedExamScore,
  isProjectManualGradeMode,
  getProjectDisplayFieldCount,
  getProjectNumFields,
  isProjectGroupGradeMode,
  getProjectGroups,
  getProjectGradeForScoreKey,
  getProjectEffectiveFieldCountForScoreKey,
  getProjectMaxPointsForScoreKey,
  EXAM_ABS_MAX_FIELDS,
  getCustomKeyDefinition,
  normalizeCourseGradeSystem,
  isExamManualGradeActive,
  getExamManualGradeStoredValue,
  classicGradeToStoredString,
} from '../utils/calculator';
import GradingKeyTable from '../components/GradingKeyTable';
import MaximizableTableSection, { TableMaximizeToggle } from '../components/MaximizableTableSection';
import { useDialog } from '../components/PhixDialog';
import {
  createScoreTaskTabHandler,
  focusScoreTaskInput,
  scoreTaskInputDataAttr,
} from '../utils/scoreTaskTabNavigation';
import { handleTableEnterAsTab } from '../utils/tableEnterAsTab';

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
  gradeScope: 'individual',
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
    updateProjectStudentManualGrade,
    updateProjectStudentManualGradeValue,
    students,
    addProject,
    config,
    setConfig,
  } = useData();
  const { showConfirm } = useDialog();

  const displayStudents = useMemo(() => {
    if (studentIdFilterSet == null) return students;
    return students.filter((s) => studentIdFilterSet.has(s.id));
  }, [students, studentIdFilterSet]);

  const gradeSys = normalizeCourseGradeSystem(config?.gradeSystem);
  const projectsAllowed = config?.projectsAccepted === true;
  const projectNumbers = Object.keys(projects).sort((a, b) => Number(a) - Number(b));
  const [activeProject, setActiveProject] = useState(projectNumbers.length > 0 ? projectNumbers[0] : null);
  const [showKey, setShowKey] = useState(false);
  const [expandedScoreKey, setExpandedScoreKey] = useState(null);
  const [projectIndexTooltip, setProjectIndexTooltip] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [groupSetupOpen, setGroupSetupOpen] = useState(false);
  const [pendingProject, setPendingProject] = useState(null);
  const [tableMaximized, setTableMaximized] = useState(false);
  const metaBarHidden = config?.projectsMetaBarHidden === true;
  const setMetaBarHidden = (hidden) => {
    setConfig((c) => ({ ...c, projectsMetaBarHidden: hidden }));
  };

  const project = activeProject ? projects[activeProject] : null;
  const projectManualGradeMode = project ? isProjectManualGradeMode(project) : false;
  const isGroupMode = project ? isProjectGroupGradeMode(project) : false;

  const studentById = useMemo(() => {
    const map = new Map();
    students.forEach((s) => map.set(Number(s.id), s));
    return map;
  }, [students]);

  const scoreRows = useMemo(() => {
    if (!project) return [];
    if (isGroupMode) {
      const rows = Object.entries(getProjectGroups(project))
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([gid, grp]) => {
          const memberIds = Array.isArray(grp?.studentIds) ? grp.studentIds : [];
          const members = memberIds.map((sid) => studentById.get(Number(sid))).filter(Boolean);
          return {
            scoreKey: gid,
            label: grp?.name || `Gruppe ${gid}`,
            members,
            memberLine: members.map((s) => `${s.lastName}, ${s.firstName}`).join(' · '),
          };
        });
      if (studentIdFilterSet == null) return rows;
      return rows.filter((row) => row.members.some((s) => studentIdFilterSet.has(s.id)));
    }
    return displayStudents.map((s) => ({
      scoreKey: s.id,
      label: `${s.lastName}, ${s.firstName}`,
      members: [s],
      memberLine: null,
    }));
  }, [project, isGroupMode, displayStudents, studentById, studentIdFilterSet]);

  useEffect(() => {
    if (activeProject && projects[activeProject]) return;
    setActiveProject(projectNumbers.length > 0 ? projectNumbers[0] : null);
  }, [projectNumbers.join(','), activeProject, projects]);

  useEffect(() => {
    setExpandedScoreKey(null);
    setTableMaximized(false);
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

  const buildProjectCreatePayload = (form) => ({
    name: form.name.trim(),
    description: form.description,
    weightingMode: form.weightingMode,
    weightPercent: form.weightingMode === 'percent'
      ? parseFloat(String(form.weightPercent).replace(',', '.')) || 0
      : 0,
    gradeMode: form.gradeMode === 'manual' ? 'manual' : 'key',
    gradeScope: form.gradeScope === 'group' ? 'group' : 'individual',
  });

  const handleCreateProject = async () => {
    if (createSubmitting) return;
    const name = createForm.name.trim();
    if (!name) return;
    if (createForm.gradeScope === 'group') {
      setPendingProject(buildProjectCreatePayload(createForm));
      setCreateOpen(false);
      setGroupSetupOpen(true);
      return;
    }
    setCreateSubmitting(true);
    try {
      const newNum = await addProject(buildProjectCreatePayload(createForm));
      setCreateOpen(false);
      if (newNum) setActiveProject(String(newNum));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleFinalizeGroupProject = async (groups) => {
    if (createSubmitting || !pendingProject) return;
    setCreateSubmitting(true);
    try {
      const newNum = await addProject({ ...pendingProject, groups });
      setGroupSetupOpen(false);
      setPendingProject(null);
      if (newNum) setActiveProject(String(newNum));
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (!projectsAllowed) {
    return (
      <div className="text-center mt-8 text-muted">
        Für dieses Fach sind keine Projekte vorgesehen.
        <br />
        Aktiviere unter Einstellungen die Option „Projekte werden durchgeführt“, um Projekte anzulegen.
      </div>
    );
  }

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
        {groupSetupOpen && pendingProject && createPortal(
          <GroupSetupModal
            projectName={pendingProject.name}
            students={students}
            onClose={() => {
              setGroupSetupOpen(false);
              setPendingProject(null);
            }}
            onCreate={handleFinalizeGroupProject}
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

  const projectScoreRowStats = (scoreKey) => {
    const rawSc = project.scores?.[scoreKey];
    const effN = getProjectEffectiveFieldCountForScoreKey(project, scoreKey);
    const { fields, counted, total } = getNormalizedExamScore(rawSc, effN);
    const maxPts = getProjectMaxPointsForScoreKey(project, scoreKey);
    const isManual = projectManualGradeMode || isExamManualGradeActive(rawSc);
    const grade = counted ? getProjectGradeForScoreKey(project, scoreKey, customKeysList, gradeSys) : null;
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
    if (nextActive) setActiveProject(nextActive);
    await removeProject(id);
  };

  return (
    <>
      <div className="view-page-scroll">
        {metaBarHidden ? (
          <div className="view-toolbar-actions" style={{ marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="tab secondary course-meta-inline-btn"
              onClick={() => setMetaBarHidden(false)}
            >
              Menüleiste zeigen
            </button>
            {project.active ? (
              <TableMaximizeToggle
                maximized={tableMaximized}
                onClick={() => setTableMaximized((m) => !m)}
              />
            ) : null}
          </div>
        ) : (
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
                {project.active ? (
                  <div className="course-meta-field projects-meta-maximize-field">
                    <span className="course-meta-field__label" aria-hidden="true">
                      &nbsp;
                    </span>
                    <div className="course-meta-field__row">
                      <TableMaximizeToggle
                        maximized={tableMaximized}
                        onClick={() => setTableMaximized((m) => !m)}
                      />
                    </div>
                  </div>
                ) : null}
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
                        <option value="1">Plateau 1</option>
                        <option value="2">Plateau 2</option>
                        <option value="3">Plateau 3</option>
                        <option value="4">Linear 1</option>
                        <option value="5">Linear 2</option>
                        <option value="6">Linear 3</option>
                        {project.keyType === LEGACY_BUILTIN_ABI_KEY_TYPE ? (
                          <option value={LEGACY_BUILTIN_ABI_KEY_TYPE}>ABI BaWü 2026 120 BE</option>
                        ) : null}
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
                  <div className="course-meta-field__row" style={{ gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="tab secondary course-meta-inline-btn"
                      onClick={() => setMetaBarHidden(true)}
                    >
                      Menüleiste verbergen
                    </button>
                    <button
                      type="button"
                      className="danger course-meta-inline-btn"
                      onClick={handleDeleteProject}
                      title="Projekt löschen"
                      aria-label="Projekt löschen"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 0.45rem',
                        minWidth: 'var(--course-meta-control-height)',
                        width: 'var(--course-meta-control-height)',
                      }}
                    >
                      <Trash2 size={18} strokeWidth={2} aria-hidden />
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
        )}

        {project.active ? (
          <div className={`exams-active-body ${showKey && !metaBarHidden ? 'sidebar-layout' : ''}`}>
            <div className={`exams-main-stack ${showKey ? 'main-content' : ''}`}>
              <div className="exams-body-scroll view-table-scroll exam-table-scroll">
                {isGroupMode ? (
                  <MaximizableTableSection
                    title={project.name || `Projekt P${activeProject}`}
                    maximized={tableMaximized}
                    onMaximizedChange={setTableMaximized}
                    embeddedToggle
                  >
                    <div className="projects-group-tables-stack">
                      {scoreRows.map((row) => (
                        <div key={row.scoreKey} className="projects-group-table-block">
                          {row.memberLine && (
                            <p className="text-muted projects-group-table-block__members">
                              {row.memberLine}
                            </p>
                          )}
                          <ProjectScoresTable
                            project={project}
                            activeProject={activeProject}
                            rows={[row]}
                            numFields={numFields}
                            displayFieldCount={displayFieldCount}
                            projectManualGradeMode={projectManualGradeMode}
                            gradeSys={gradeSys}
                            expandedScoreKey={expandedScoreKey}
                            setExpandedScoreKey={setExpandedScoreKey}
                            setProjectIndexTooltip={setProjectIndexTooltip}
                            projectScoreRowStats={projectScoreRowStats}
                            updateProjectFieldNames={updateProjectFieldNames}
                            updateProjectFieldMaxPoints={updateProjectFieldMaxPoints}
                            updateProjectScore={updateProjectScore}
                            updateProjectCounted={updateProjectCounted}
                            updateProjectStudentManualGrade={updateProjectStudentManualGrade}
                            updateProjectStudentManualGradeValue={updateProjectStudentManualGradeValue}
                            nameColumnLabel="GRUPPE"
                            showEmptyFilterHint={false}
                          />
                        </div>
                      ))}
                    </div>
                  </MaximizableTableSection>
                ) : (
                  <MaximizableTableSection
                    title={project.name || `Projekt P${activeProject}`}
                    maximized={tableMaximized}
                    onMaximizedChange={setTableMaximized}
                    embeddedToggle
                  >
                    <ProjectScoresTable
                      project={project}
                      activeProject={activeProject}
                      rows={scoreRows}
                      numFields={numFields}
                      displayFieldCount={displayFieldCount}
                      projectManualGradeMode={projectManualGradeMode}
                      gradeSys={gradeSys}
                      expandedScoreKey={expandedScoreKey}
                      setExpandedScoreKey={setExpandedScoreKey}
                      setProjectIndexTooltip={setProjectIndexTooltip}
                      projectScoreRowStats={projectScoreRowStats}
                      updateProjectFieldNames={updateProjectFieldNames}
                      updateProjectFieldMaxPoints={updateProjectFieldMaxPoints}
                      updateProjectScore={updateProjectScore}
                      updateProjectCounted={updateProjectCounted}
                      updateProjectStudentManualGrade={updateProjectStudentManualGrade}
                      updateProjectStudentManualGradeValue={updateProjectStudentManualGradeValue}
                      nameColumnLabel="NAME"
                      showEmptyFilterHint={displayStudents.length === 0 && students.length > 0}
                    />
                  </MaximizableTableSection>
                )}
              </div>
            </div>
            {showKey && !metaBarHidden && !projectManualGradeMode && (
              <aside className="exams-sidebar">
                <GradingKeyTable
                  type={sidebarCustomDef ? '1' : (project.keyType || '1')}
                  maxPoints={project.maxPoints}
                  title={
                    sidebarCustomDef
                      ? sidebarCustomDef.name
                      : getBuiltinGradingKeyTitle(project.keyType) || 'Aktueller Schlüssel'
                  }
                  desc={
                    sidebarCustomDef
                      ? (isVorlage1KeyFamilyId(sidebarCustomDef.id)
                          ? getPlateauKeyShortDesc('1', project.maxPoints)
                          : sidebarCustomDef.name)
                      : project.keyType === 'abi'
                        ? 'ABI BaWü 2026 120 BE'
                        : getBuiltinGradingKeyShortDesc(project.keyType, project.maxPoints) || `Schlüssel ${project.keyType || '1'}`
                  }
                  titleHelpText={
                    sidebarCustomDef
                      ? (isVorlage1KeyFamilyId(sidebarCustomDef.id) ? getFormulaKeyHelpText('1') : null)
                      : (isPlateauGradingKeyType(project.keyType) ? getFormulaKeyHelpText(project.keyType) : null)
                  }
                  customBands={
                    sidebarCustomDef
                      ? (isVorlage1KeyFamilyId(sidebarCustomDef.id)
                          ? buildVorlage1Bands(project.maxPoints)
                          : sidebarCustomDef.bands)
                      : (project.keyType === 'abi' ? ABI_BAWUE_2026_120_BE_KEY.bands : undefined)
                  }
                  pktIntegerDisplay={
                    !!sidebarCustomDef?.pktIntegerDisplay ||
                    project.keyType === 'abi' ||
                    (sidebarCustomDef?.id &&
                      (isAbiBaWue2026KeyFamilyId(sidebarCustomDef.id) ||
                        isAbiBaWue2026Mathematik100BeFamilyId(sidebarCustomDef.id)))
                  }
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

      {groupSetupOpen && pendingProject && createPortal(
        <GroupSetupModal
          projectName={pendingProject.name}
          students={students}
          onClose={() => {
            setGroupSetupOpen(false);
            setPendingProject(null);
          }}
          onCreate={handleFinalizeGroupProject}
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
          <div>
            <label className="course-meta-field__label" htmlFor="create-project-grade-scope" style={fieldLabelStyle}>
              Notenvergabe
            </label>
            <select
              id="create-project-grade-scope"
              className="course-meta-control"
              value={form.gradeScope}
              onChange={(e) => setForm((f) => ({ ...f, gradeScope: e.target.value }))}
              style={fieldControlStyle}
            >
              <option value="individual">Einzelnoten</option>
              <option value="group">Gruppennoten</option>
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
            {form.gradeScope === 'group' ? 'Weiter' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectScoresTable({
  project,
  activeProject,
  rows,
  numFields,
  displayFieldCount,
  projectManualGradeMode,
  gradeSys,
  expandedScoreKey,
  setExpandedScoreKey,
  setProjectIndexTooltip,
  projectScoreRowStats,
  updateProjectFieldNames,
  updateProjectFieldMaxPoints,
  updateProjectScore,
  updateProjectCounted,
  updateProjectStudentManualGrade,
  updateProjectStudentManualGradeValue,
  nameColumnLabel,
  showEmptyFilterHint,
}) {
  const detailColSpan = 4 + displayFieldCount;
  const scoreInputScope = `project-${activeProject}`;

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th className="exam-th-sticky-left exam-th-r1" style={{ width: `${PROJECT_INDEX_COL_PX}px`, minWidth: `${PROJECT_INDEX_COL_PX}px`, left: 0 }}>#</th>
            <th className="exam-th-sticky-left exam-th-r1" style={{ left: `${PROJECT_INDEX_COL_PX}px` }}>{nameColumnLabel}</th>
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
                  onChange={(e) => updateProjectFieldMaxPoints(activeProject, i, e.target.value)}
                  onKeyDown={handleTableEnterAsTab}
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
          {showEmptyFilterHint && (
            <tr>
              <td colSpan={detailColSpan} className="text-center text-muted" style={{ padding: '2rem' }}>
                Kein Schüler entspricht der Suche.
              </td>
            </tr>
          )}
          {rows.map((row, idx) => {
            const scoreKey = row.scoreKey;
            const {
              effN,
              fields,
              counted,
              total: totalPoints,
              maxPts,
              grade,
              isManual,
              manualGradeInput,
            } = projectScoreRowStats(scoreKey);
            const rawSc = project.scores?.[scoreKey];
            const showAbsentFlag = !counted;
            const showIndexFlag = showAbsentFlag;
            const isExpanded = expandedScoreKey === scoreKey;

            return (
              <React.Fragment key={String(scoreKey)}>
                <tr style={{ transition: 'background 0.2s', background: isExpanded ? 'rgba(79, 70, 229, 0.05)' : '' }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)', borderRight: '1px solid var(--border)', width: `${PROJECT_INDEX_COL_PX}px`, minWidth: `${PROJECT_INDEX_COL_PX}px`, verticalAlign: 'middle', textAlign: 'center', padding: 0 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: showIndexFlag ? 34 : undefined, paddingTop: showIndexFlag ? 2 : 0 }}>
                      {showIndexFlag && (
                        <span
                          className="exam-index-flag"
                          role="img"
                          aria-label="Note ausgesetzt"
                          onMouseEnter={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setProjectIndexTooltip({
                              text: 'Note ausgesetzt',
                              left: Math.min(window.innerWidth - 12, Math.max(12, r.left + r.width / 2)),
                              top: r.bottom + 8,
                            });
                          }}
                          onMouseLeave={() => setProjectIndexTooltip(null)}
                        >
                          <ProjectRowBookmark variant="absent" />
                        </span>
                      )}
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</span>
                    </div>
                  </td>
                  <td
                    role="button"
                    tabIndex={-1}
                    onClick={() => setExpandedScoreKey((prev) => (prev === scoreKey ? null : scoreKey))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedScoreKey((prev) => (prev === scoreKey ? null : scoreKey));
                      }
                    }}
                    style={{ position: 'sticky', left: `${PROJECT_INDEX_COL_PX}px`, zIndex: 1, background: 'var(--surface)', borderRight: '1px solid var(--border)', cursor: 'pointer' }}
                    title="Klicken für Note aussetzen / Details"
                  >
                    {row.label}
                  </td>
                  {[...Array(displayFieldCount)].map((_, fieldIndex) => {
                    const beyond = fieldIndex >= effN;
                    const val = fields[fieldIndex] !== undefined ? fields[fieldIndex] : '';
                    const maxRule = getExamTaskMaxRule(project, fieldIndex);
                    const scoreOutOfRange = !beyond && isExamScoreFieldOutOfRange(val, maxRule);
                    return (
                      <td key={fieldIndex} className="text-center exam-task-col" style={{ opacity: beyond ? 0.45 : 1, verticalAlign: 'middle' }}>
                        {beyond ? (
                          <span className="text-muted" title="Nicht gewertet">—</span>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            data-score-task-input={scoreTaskInputDataAttr(scoreInputScope, scoreKey, fieldIndex)}
                            value={val}
                            onChange={(e) => updateProjectScore(activeProject, scoreKey, fieldIndex, e.target.value)}
                            onKeyDown={createScoreTaskTabHandler({
                              scopeKey: scoreInputScope,
                              rowKey: scoreKey,
                              fieldIndex,
                              effectiveFieldCount: effN,
                              onTabForwardFromLastField: () => {
                                const rowIdx = rows.findIndex((row) => row.scoreKey === scoreKey);
                                const nextRow = rows[rowIdx + 1];
                                if (!nextRow) return;
                                const nextEffN = getProjectEffectiveFieldCountForScoreKey(project, nextRow.scoreKey);
                                if (nextEffN > 0) {
                                  focusScoreTaskInput(scoreInputScope, nextRow.scoreKey, 0);
                                }
                              },
                              onShiftTabFromFirstField: () => {
                                const rowIdx = rows.findIndex((row) => row.scoreKey === scoreKey);
                                const prevRow = rows[rowIdx - 1];
                                if (!prevRow) return;
                                const prevEffN = getProjectEffectiveFieldCountForScoreKey(project, prevRow.scoreKey);
                                if (prevEffN > 0) {
                                  focusScoreTaskInput(scoreInputScope, prevRow.scoreKey, prevEffN - 1);
                                }
                              },
                            })}
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
                      background: counted && grade !== null ? (getGradeCellBackground(grade, gradeSys) ?? 'var(--surface)') : 'var(--surface)',
                      color: counted && grade !== null ? getGradeTextColor(grade, gradeSys) : undefined,
                      borderLeft: '1px solid var(--border)',
                    }}
                  >
                    {counted && isManual ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="exam-manual-grade-input"
                        value={manualGradeInput}
                        onChange={(e) => updateProjectStudentManualGradeValue(activeProject, scoreKey, e.target.value)}
                        placeholder={gradeSys === 'points' ? 'NP' : 'Note'}
                        style={{ textAlign: 'center', width: '4.5rem', minWidth: 'auto', fontWeight: 'bold', borderRadius: 0 }}
                      />
                    ) : counted && grade !== null ? (
                      <span style={{ fontWeight: 'bold', color: isGradeWorseThan4(grade, gradeSys) ? 'var(--danger)' : 'var(--foreground)' }}>
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
                        <span className="text-muted" style={{ fontSize: '0.875rem' }}>Note aussetzen:</span>
                        <label className="switch switch--table-row">
                          <input
                            type="checkbox"
                            checked={!counted}
                            onChange={(e) => updateProjectCounted(activeProject, scoreKey, !e.target.checked)}
                            aria-label="Note aussetzen"
                          />
                          <span className="slider" />
                        </label>
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
                                    updateProjectStudentManualGrade(activeProject, scoreKey, false);
                                    return;
                                  }
                                  const stored = getExamManualGradeStoredValue(rawSc);
                                  if (stored.trim() !== '') {
                                    updateProjectStudentManualGrade(activeProject, scoreKey, true);
                                    return;
                                  }
                                  const { grade: calcGrade } = projectScoreRowStats(scoreKey);
                                  const seed = calcGrade != null ? classicGradeToStoredString(calcGrade, gradeSys) : '';
                                  updateProjectStudentManualGrade(activeProject, scoreKey, true, seed);
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
  );
}

function GroupSetupModal({ projectName, students, onClose, onCreate, submitting }) {
  const [groups, setGroups] = useState([{ id: '1', name: 'Gruppe 1' }]);
  const [assignments, setAssignments] = useState(() => {
    const init = {};
    students.forEach((s) => { init[s.id] = ''; });
    return init;
  });

  const nextGroupId = () => {
    const nums = groups.map((g) => Number(g.id)).filter((n) => Number.isFinite(n));
    return String((nums.length > 0 ? Math.max(...nums) : 0) + 1);
  };

  const addGroup = () => {
    const id = nextGroupId();
    setGroups((prev) => [...prev, { id, name: `Gruppe ${id}` }]);
  };

  const removeGroup = (id) => {
    if (groups.length <= 1) return;
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((sid) => {
        if (next[sid] === id) next[sid] = '';
      });
      return next;
    });
  };

  const updateGroupName = (id, name) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));
  };

  const assignedCount = students.filter((s) => assignments[s.id] && groups.some((g) => g.id === assignments[s.id])).length;
  const allAssigned = students.length > 0 && assignedCount === students.length;
  const allGroupNamesValid = groups.every((g) => g.name.trim().length > 0);
  const canCreate = allAssigned && allGroupNamesValid && !submitting;

  const handleCreate = () => {
    if (!canCreate) return;
    const groupsPayload = {};
    groups.forEach((g) => {
      const studentIds = students
        .filter((s) => assignments[s.id] === g.id)
        .map((s) => s.id);
      if (studentIds.length > 0) {
        groupsPayload[g.id] = { name: g.name.trim(), studentIds };
      }
    });
    onCreate(groupsPayload);
  };

  const fieldLabelStyle = { display: 'block', marginBottom: '0.35rem' };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-setup-title"
        style={{ maxWidth: '640px', width: 'calc(100% - 2rem)', maxHeight: 'min(90vh, 720px)', overflow: 'auto' }}
      >
        <h2 id="group-setup-title" style={{ marginTop: 0 }}>Gruppen einteilen</h2>
        <p className="text-muted" style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
          Projekt: <strong>{projectName}</strong>
        </p>

        <div style={{ marginTop: '1.25rem' }}>
          <div className="flex flex-wrap gap-2" style={{ alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Gruppen</span>
            <button type="button" className="secondary" onClick={addGroup} disabled={submitting}>
              + Gruppe
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {groups.map((g) => (
              <div key={g.id} className="flex gap-2" style={{ alignItems: 'center' }}>
                <input
                  className="course-meta-control"
                  type="text"
                  value={g.name}
                  onChange={(e) => updateGroupName(g.id, e.target.value)}
                  placeholder="Gruppenname"
                  style={{ flex: 1 }}
                />
                {groups.length > 1 && (
                  <button type="button" className="secondary" onClick={() => removeGroup(g.id)} disabled={submitting} title="Gruppe entfernen">
                    Entfernen
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Schüler zuordnen</span>
          {students.length === 0 ? (
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>Keine Schüler im Kurs.</p>
          ) : (
            <div className="table-container" style={{ marginTop: '0.5rem', maxHeight: '280px', overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Schüler</th>
                    <th style={{ width: '200px' }}>Gruppe</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>{s.lastName}, {s.firstName}</td>
                      <td>
                        <select
                          className="course-meta-control"
                          value={assignments[s.id] || ''}
                          onChange={(e) => setAssignments((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          style={{ width: '100%' }}
                        >
                          <option value="">— nicht zugeordnet —</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name || `Gruppe ${g.id}`}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {students.length > 0 && !allAssigned && (
            <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Noch {students.length - assignedCount} Schüler ohne Gruppe.
            </p>
          )}
        </div>

        <div className="flex gap-2" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
            Abbrechen
          </button>
          <button type="button" onClick={handleCreate} disabled={!canCreate}>
            Erstellen
          </button>
        </div>
      </div>
    </div>
  );
}
