import React, { useMemo, useState } from 'react';
import { ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useData } from '../store/DataContext';
import { buildSummaryOverviewExportData, buildSummaryOverviewWithDetailsExportData } from '../utils/summaryOverviewExport';
import {
  courseFullExportFilename,
  examExportFilename,
  gfsExportFilename,
  oralExportFilename,
  oralExtendedExportFilename,
  projectExportFilename,
  referatExportFilename,
  summaryOverviewExportFilename,
  summaryOverviewDetailsExportFilename,
  testExportFilename,
  gradingKeyExportFilename,
  gradingKeysAllExportFilename,
} from '../utils/exportFilenames';
import { buildCourseFullExportSheets } from '../utils/courseFullExport';
import { buildExamTableExport, examExportSheetName } from '../utils/examTableExport';
import { buildGfsTableExportData, gfsExportSheetName } from '../utils/gfsTableExport';
import {
  buildOralExtendedTableExportData,
  buildOralStandardTableExportData,
  oralExportSheetName,
  oralExtendedExportSheetName,
} from '../utils/oralTableExport';
import { buildProjectTableExport, projectExportSheetName } from '../utils/projectTableExport';
import { buildReferatTableExportData, referatExportSheetName } from '../utils/referatTableExport';
import { isOralExtendedActive } from '../utils/oralExtendedMode';
import { buildTestTableExportAoa, testExportSheetName } from '../utils/testTableExport';
import { downloadAoaXlsx, downloadMultiSheetXlsx, downloadSheetDataXlsx } from '../utils/phixXlsxExport';
import { downloadAoaPdf, downloadMultiSectionPdf, downloadSheetDataPdf } from '../utils/phixPdfExport';
import {
  buildCourseGradingKeysExportList,
  exportAllGradingKeys,
  exportSingleGradingKey,
} from '../utils/gradingKeysListExport';

function courseLabel(course) {
  if (!course) return '';
  return [course.subject, course.className, course.year].filter(Boolean).join(' · ');
}

function ExportSection({ sectionId, title, expanded, onToggle, className = '', children }) {
  const headingId = `export-${sectionId}-heading`;
  const contentId = `export-${sectionId}-content`;

  return (
    <section
      className={`program-view-panel glass-panel export-section${expanded ? ' export-section--open' : ''}${className ? ` ${className}` : ''}`}
      aria-labelledby={headingId}
    >
      <button
        type="button"
        className="export-section__toggle"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
        id={headingId}
      >
        <h4 className="program-view-panel-heading export-section__title">{title}</h4>
        <ChevronDown size={18} strokeWidth={2.25} className="export-section__chevron" aria-hidden />
      </button>
      {expanded ? (
        <div id={contentId} className="export-section__body" role="region" aria-labelledby={headingId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function ExportFormatButtons({ label, sublabel, disabled, busyKey, exportKey, onExcel, onPdf }) {
  const busyExcel = busyKey === `${exportKey}-xlsx`;
  const busyPdf = busyKey === `${exportKey}-pdf`;
  const anyBusy = busyExcel || busyPdf;

  return (
    <div className="export-item-row">
      <div className="export-item-row__meta">
        <span className="export-item-btn__label">{label}</span>
        {sublabel ? <span className="export-item-btn__sublabel text-muted">{sublabel}</span> : null}
      </div>
      <div className="export-item-row__actions">
        <button
          type="button"
          className="tab secondary export-format-btn"
          disabled={disabled || (anyBusy && !busyExcel)}
          onClick={onExcel}
          title="Als Excel (.xlsx)"
        >
          <FileSpreadsheet size={15} strokeWidth={2} aria-hidden />
          {busyExcel ? '…' : 'Excel'}
        </button>
        <button
          type="button"
          className="tab secondary export-format-btn"
          disabled={disabled || (anyBusy && !busyPdf)}
          onClick={onPdf}
          title="Als PDF"
        >
          <FileText size={15} strokeWidth={2} aria-hidden />
          {busyPdf ? '…' : 'PDF'}
        </button>
      </div>
    </div>
  );
}

export default function ExportView() {
  const { config, students, exams, orals, tests, projects, gfsEntries, referatEntries } = useData();
  const [busyKey, setBusyKey] = useState(null);
  const [expandedSections, setExpandedSections] = useState(() => new Set());

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const isSectionOpen = (sectionId) => expandedSections.has(sectionId);

  const courseTitle = useMemo(() => courseLabel(config), [config]);

  const examNumbers = useMemo(
    () => Object.keys(exams ?? {}).sort((a, b) => Number(a) - Number(b)),
    [exams],
  );
  const testNumbers = useMemo(
    () => Object.keys(tests ?? {}).sort((a, b) => Number(a) - Number(b)),
    [tests],
  );
  const oralNumbers = useMemo(
    () => Object.keys(orals ?? {}).sort((a, b) => Number(a) - Number(b)),
    [orals],
  );
  const oralStandardNumbers = useMemo(
    () => oralNumbers.filter((id) => !isOralExtendedActive(orals[id])),
    [oralNumbers, orals],
  );
  const oralExtendedNumbers = useMemo(
    () => oralNumbers.filter((id) => isOralExtendedActive(orals[id])),
    [oralNumbers, orals],
  );
  const projectNumbers = useMemo(
    () => Object.keys(projects ?? {}).sort((a, b) => Number(a) - Number(b)),
    [projects],
  );

  const gradingKeyEntries = useMemo(
    () => buildCourseGradingKeysExportList(config),
    [config],
  );

  const runExport = async (key, fn, { requireStudents = true } = {}) => {
    if (!config) return;
    if (requireStudents && !students.length) return;
    setBusyKey(key);
    try {
      await fn();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyKey(null);
    }
  };

  const exportFullCourse = (format) =>
    runExport(`course-full-${format}`, async () => {
      const sheets = buildCourseFullExportSheets({
        students,
        exams,
        orals,
        tests,
        projects,
        gfsEntries,
        referatEntries,
        config,
      });
      const filename = courseFullExportFilename(config, format);
      if (format === 'pdf') {
        downloadMultiSectionPdf(sheets, filename, courseTitle || 'Kursexport');
      } else {
        downloadMultiSheetXlsx(sheets, filename);
      }
      return filename;
    });

  const exportSummary = (format, withDetails = false) =>
    runExport(`summary${withDetails ? '-details' : ''}-${format}`, async () => {
      const buildData = withDetails ? buildSummaryOverviewWithDetailsExportData : buildSummaryOverviewExportData;
      const { headers, rows, layout } = buildData({
        students,
        exams,
        orals,
        tests,
        projects,
        gfsEntries,
        referatEntries,
        config,
      });
      const sheetData = { headers, rows };
      const filename = withDetails
        ? summaryOverviewDetailsExportFilename(config, format)
        : summaryOverviewExportFilename(config, format);
      if (format === 'pdf') {
        downloadSheetDataPdf(sheetData, 'Übersicht', filename);
      } else {
        downloadSheetDataXlsx(sheetData, 'Übersicht', filename, layout);
      }
      return filename;
    });

  const exportExam = (examId, format) =>
    runExport(`exam-${examId}-${format}`, async () => {
      const exam = exams[examId];
      if (!exam) throw new Error('missing exam');
      if (exam.active === false) return null;
      const { aoa, layout, gradingKey } = buildExamTableExport({ exam, examId, students, config });
      const sheetName = examExportSheetName(examId);
      const filename = examExportFilename(config, examId, format);
      if (format === 'pdf') {
        downloadAoaPdf(aoa, sheetName, filename, { gradingKey });
      } else {
        downloadAoaXlsx(aoa, sheetName, filename, layout, gradingKey);
      }
      return filename;
    });

  const exportTest = (testId, format) =>
    runExport(`test-${testId}-${format}`, async () => {
      const test = tests[testId];
      if (!test) throw new Error('missing test');
      if (test.active === false) return null;
      const aoa = buildTestTableExportAoa({ test, testId, students, config });
      const sheetName = testExportSheetName(testId, test.name);
      const filename = testExportFilename(config, testId, test.name, format);
      if (format === 'pdf') {
        downloadAoaPdf(aoa, sheetName, filename);
      } else {
        downloadAoaXlsx(aoa, sheetName, filename);
      }
      return filename;
    });

  const exportOral = (oralId, format) =>
    runExport(`oral-${oralId}-${format}`, async () => {
      const oral = orals[oralId];
      if (oral?.active === false) return null;
      const sheetData = buildOralStandardTableExportData({ oral, students, config });
      if (!sheetData) return null;
      const { headers, rows, layout } = sheetData;
      const sheetName = oralExportSheetName(oralId, oral?.name);
      const filename = oralExportFilename(config, oralId, oral?.name, format);
      if (format === 'pdf') {
        downloadSheetDataPdf({ headers, rows }, sheetName, filename);
      } else {
        downloadSheetDataXlsx({ headers, rows }, sheetName, filename, layout);
      }
      return filename;
    });

  const exportOralExtended = (oralId, format) =>
    runExport(`oral-ext-${oralId}-${format}`, async () => {
      const oral = orals[oralId];
      if (oral?.active === false) return null;
      const sheetData = buildOralExtendedTableExportData({ oral, students, config });
      if (!sheetData) return null;
      const { headers, rows, layout } = sheetData;
      const sheetName = oralExtendedExportSheetName(oralId, oral?.name);
      const filename = oralExtendedExportFilename(config, oralId, oral?.name, format);
      if (format === 'pdf') {
        downloadSheetDataPdf({ headers, rows }, sheetName, filename);
      } else {
        downloadSheetDataXlsx({ headers, rows }, sheetName, filename, layout);
      }
      return filename;
    });

  const exportGfs = (format) =>
    runExport(`gfs-${format}`, async () => {
      const { headers, rows, layout } = buildGfsTableExportData({ gfsEntries, students, config });
      const sheetName = gfsExportSheetName();
      const filename = gfsExportFilename(config, format);
      if (format === 'pdf') {
        downloadSheetDataPdf({ headers, rows }, sheetName, filename);
      } else {
        downloadSheetDataXlsx({ headers, rows }, sheetName, filename, layout);
      }
      return filename;
    });

  const exportReferat = (format) =>
    runExport(`referat-${format}`, async () => {
      const { headers, rows, layout } = buildReferatTableExportData({ referatEntries, students, config });
      const sheetName = referatExportSheetName();
      const filename = referatExportFilename(config, format);
      if (format === 'pdf') {
        downloadSheetDataPdf({ headers, rows }, sheetName, filename);
      } else {
        downloadSheetDataXlsx({ headers, rows }, sheetName, filename, layout);
      }
      return filename;
    });

  const exportProject = (projectId, format) =>
    runExport(`project-${projectId}-${format}`, async () => {
      const project = projects[projectId];
      if (!project) throw new Error('missing project');
      if (project.active === false) return null;
      const { aoa, layout, gradingKey } = buildProjectTableExport({
        project,
        projectId,
        students,
        config,
      });
      const sheetName = projectExportSheetName(projectId, project.name);
      const filename = projectExportFilename(config, projectId, project.name, format);
      if (format === 'pdf') {
        downloadAoaPdf(aoa, sheetName, filename, { gradingKey });
      } else {
        downloadAoaXlsx(aoa, sheetName, filename, layout, gradingKey);
      }
      return filename;
    });

  const exportGradingKey = (entry, format) =>
    runExport(`grading-key-${entry.id}-${format}`, async () => {
      await exportSingleGradingKey(config, entry, format);
      return gradingKeyExportFilename(config, entry.name, format);
    }, { requireStudents: false });

  const exportAllGradingKeysBundle = (format) =>
    runExport(`grading-keys-all-${format}`, async () => {
      await exportAllGradingKeys(config, format);
      return gradingKeysAllExportFilename(config, format);
    }, { requireStudents: false });

  const anyBusy = busyKey !== null;

  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Export</h3>
      <p className="program-view-intro">
        Daten des aktuellen Kurses als Excel (.xlsx) oder PDF herunterladen.
        {courseTitle ? (
          <>
            {' '}
            Aktueller Kurs: <strong>{courseTitle}</strong>
          </>
        ) : null}
      </p>

      <div className="program-view-stack">
        <ExportSection
          sectionId="course-full"
          title="Gesamter Kurs"
          expanded={isSectionOpen('course-full')}
          onToggle={() => toggleSection('course-full')}
          className="export-course-full-panel"
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            Alle Tabellen des aktuellen Kurses: <strong>Übersicht</strong>, alle aktiven <strong>Klausuren</strong>{' '}
            und <strong>Tests</strong>, mündliche Bereiche im <strong>Standardmodus</strong> (ohne Erweitert),
            aktive <strong>Projekte</strong> sowie — falls vorhanden — <strong>GFS</strong> und <strong>Referate</strong>.
          </p>
          <div className="export-item-row__actions export-course-full-actions">
            <button
              type="button"
              className="tab secondary export-format-btn"
              disabled={anyBusy || !config}
              onClick={() => exportFullCourse('xlsx')}
            >
              <FileSpreadsheet size={16} strokeWidth={2} aria-hidden />
              {busyKey === 'course-full-xlsx' ? 'Export …' : 'Gesamten Kurs als Excel'}
            </button>
            <button
              type="button"
              className="tab secondary export-format-btn"
              disabled={anyBusy || !config}
              onClick={() => exportFullCourse('pdf')}
            >
              <FileText size={16} strokeWidth={2} aria-hidden />
              {busyKey === 'course-full-pdf' ? 'Export …' : 'Gesamten Kurs als PDF'}
            </button>
          </div>
        </ExportSection>

        <ExportSection
          sectionId="summary"
          title="Übersicht"
          expanded={isSectionOpen('summary')}
          onToggle={() => toggleSection('summary')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            Tabelle aus dem Reiter <strong>Übersicht</strong> (Schriftlich, Mündlich, Tests, Endnoten).
            Mit Details: je Schüler die Aufschlüsselung nach Halbjahr 1, Halbjahr 2 und Gesamt.
          </p>
          <div className="export-item-list">
            <ExportFormatButtons
              label="Übersicht exportieren"
              disabled={anyBusy || !config}
              busyKey={busyKey}
              exportKey="summary"
              onExcel={() => exportSummary('xlsx')}
              onPdf={() => exportSummary('pdf')}
            />
            <ExportFormatButtons
              label="Übersicht mit Details exportieren"
              disabled={anyBusy || !config}
              busyKey={busyKey}
              exportKey="summary-details"
              onExcel={() => exportSummary('xlsx', true)}
              onPdf={() => exportSummary('pdf', true)}
            />
          </div>
        </ExportSection>

        <ExportSection
          sectionId="exams"
          title="Klausuren"
          expanded={isSectionOpen('exams')}
          onToggle={() => toggleSection('exams')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            Je Klausur eine Datei mit der Standardtabelle (#, Name, Aufgaben, Gesamt, Note) inkl.
            Maximalpunkte-Zeile und genutzter Notenschlüssel.
          </p>
          {examNumbers.length === 0 ? (
            <p className="program-view-panel-text text-muted" style={{ margin: '0.75rem 0 0' }}>
              Keine Klausuren angelegt.
            </p>
          ) : (
            <div className="export-item-list">
              {examNumbers.map((id) => {
                const exam = exams[id];
                const inactive = exam?.active === false;
                return (
                  <ExportFormatButtons
                    key={id}
                    label={`KA ${id}`}
                    sublabel={
                      inactive
                        ? 'inaktiv'
                        : [exam?.halbjahr ? `HJ ${exam.halbjahr}` : null, exam?.date]
                            .filter(Boolean)
                            .join(' · ') || undefined
                    }
                    disabled={anyBusy || !config || inactive}
                    busyKey={busyKey}
                    exportKey={`exam-${id}`}
                    onExcel={() => exportExam(id, 'xlsx')}
                    onPdf={() => exportExam(id, 'pdf')}
                  />
                );
              })}
            </div>
          )}
        </ExportSection>

        <ExportSection
          sectionId="tests"
          title="Tests"
          expanded={isSectionOpen('tests')}
          onToggle={() => toggleSection('tests')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            Je Test eine Datei (#, Name, Punkte, Gesamt, Note) inkl. Maximalpunkte-Zeile.
          </p>
          {testNumbers.length === 0 ? (
            <p className="program-view-panel-text text-muted" style={{ margin: '0.75rem 0 0' }}>
              Keine Tests angelegt.
            </p>
          ) : (
            <div className="export-item-list">
              {testNumbers.map((id) => {
                const test = tests[id];
                const inactive = test?.active === false;
                return (
                  <ExportFormatButtons
                    key={id}
                    label={test?.name?.trim() ? test.name : `Test ${id}`}
                    sublabel={
                      inactive
                        ? 'inaktiv'
                        : [test?.halbjahr ? `HJ ${test.halbjahr}` : null].filter(Boolean).join(' · ') ||
                          undefined
                    }
                    disabled={anyBusy || !config || inactive}
                    busyKey={busyKey}
                    exportKey={`test-${id}`}
                    onExcel={() => exportTest(id, 'xlsx')}
                    onPdf={() => exportTest(id, 'pdf')}
                  />
                );
              })}
            </div>
          )}
        </ExportSection>

        <ExportSection
          sectionId="oral"
          title="Mündliche Noten"
          expanded={isSectionOpen('oral')}
          onToggle={() => toggleSection('oral')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            <strong>Standardtabelle</strong> (#, Name, Note) für mündliche Bereiche ohne Erweitert-Modus.
          </p>
          {oralStandardNumbers.length === 0 ? (
            <p className="program-view-panel-text text-muted" style={{ margin: '0.75rem 0 0' }}>
              Keine mündlichen Bereiche im Standardmodus.
            </p>
          ) : (
            <div className="export-item-list">
              {oralStandardNumbers.map((id) => {
                const oral = orals[id];
                const inactive = oral?.active === false;
                return (
                  <ExportFormatButtons
                    key={id}
                    label={oral?.name?.trim() ? oral.name : `Mündlich ${id}`}
                    sublabel={
                      inactive
                        ? 'inaktiv'
                        : [oral?.halbjahr ? `HJ ${oral.halbjahr}` : null, oral?.date]
                            .filter(Boolean)
                            .join(' · ') || undefined
                    }
                    disabled={anyBusy || !config || inactive}
                    busyKey={busyKey}
                    exportKey={`oral-${id}`}
                    onExcel={() => exportOral(id, 'xlsx')}
                    onPdf={() => exportOral(id, 'pdf')}
                  />
                );
              })}
            </div>
          )}
        </ExportSection>

        <ExportSection
          sectionId="oral-extended"
          title="Erweiterte mündliche Noten"
          expanded={isSectionOpen('oral-extended')}
          onToggle={() => toggleSection('oral-extended')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            <strong>Erweiterte Tabelle</strong> (#, Name, Wochenpunkte oder Wochennoten, Berechnet, Note) für Bereiche
            im erweiterten Modus (Punkte oder Noten).
          </p>
          {oralExtendedNumbers.length === 0 ? (
            <p className="program-view-panel-text text-muted" style={{ margin: '0.75rem 0 0' }}>
              Keine mündlichen Bereiche im Erweitert-Modus.
            </p>
          ) : (
            <div className="export-item-list">
              {oralExtendedNumbers.map((id) => {
                const oral = orals[id];
                const inactive = oral?.active === false;
                return (
                  <ExportFormatButtons
                    key={id}
                    label={oral?.name?.trim() ? oral.name : `Mündlich ${id}`}
                    sublabel={
                      inactive
                        ? 'inaktiv'
                        : [oral?.halbjahr ? `HJ ${oral.halbjahr}` : null, oral?.date]
                            .filter(Boolean)
                            .join(' · ') || undefined
                    }
                    disabled={anyBusy || !config || inactive}
                    busyKey={busyKey}
                    exportKey={`oral-ext-${id}`}
                    onExcel={() => exportOralExtended(id, 'xlsx')}
                    onPdf={() => exportOralExtended(id, 'pdf')}
                  />
                );
              })}
            </div>
          )}
        </ExportSection>

        <ExportSection
          sectionId="gfs"
          title="GFS"
          expanded={isSectionOpen('gfs')}
          onToggle={() => toggleSection('gfs')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            Tabelle aus dem Reiter <strong>GFS</strong> (Nr., Name, Thema, Art, Datum, Gehalten, Halbjahr, Note).
          </p>
          <div className="export-item-list">
            <ExportFormatButtons
              label="GFS exportieren"
              disabled={anyBusy || !config}
              busyKey={busyKey}
              exportKey="gfs"
              onExcel={() => exportGfs('xlsx')}
              onPdf={() => exportGfs('pdf')}
            />
          </div>
        </ExportSection>

        <ExportSection
          sectionId="referate"
          title="Referate"
          expanded={isSectionOpen('referate')}
          onToggle={() => toggleSection('referate')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            Tabelle aus dem Reiter <strong>Referate</strong> (ohne Aktion-Spalte).
          </p>
          <div className="export-item-list">
            <ExportFormatButtons
              label="Referate exportieren"
              disabled={anyBusy || !config || config?.referateAccepted !== true}
              busyKey={busyKey}
              exportKey="referat"
              onExcel={() => exportReferat('xlsx')}
              onPdf={() => exportReferat('pdf')}
              sublabel={config?.referateAccepted !== true ? 'Referate im Kurs nicht aktiviert' : undefined}
            />
          </div>
        </ExportSection>

        <ExportSection
          sectionId="projects"
          title="Projekte"
          expanded={isSectionOpen('projects')}
          onToggle={() => toggleSection('projects')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            Je Projekt eine Datei mit Themenfeldern, Gesamt- und Notenspalte inkl. Maximalpunkte-Zeile.
            Im Gruppenmodus mit Gruppenzeilen und Mitgliedern.
          </p>
          {projectNumbers.length === 0 ? (
            <p className="program-view-panel-text text-muted" style={{ margin: '0.75rem 0 0' }}>
              Keine Projekte angelegt.
            </p>
          ) : (
            <div className="export-item-list">
              {projectNumbers.map((id) => {
                const project = projects[id];
                const inactive = project?.active === false;
                return (
                  <ExportFormatButtons
                    key={id}
                    label={project?.name?.trim() ? project.name : `Projekt P${id}`}
                    sublabel={
                      inactive
                        ? 'inaktiv'
                        : [
                            project?.gradeScope === 'group' ? 'Gruppennoten' : null,
                            project?.halbjahr ? `HJ ${project.halbjahr}` : null,
                            project?.date,
                          ]
                            .filter(Boolean)
                            .join(' · ') || undefined
                    }
                    disabled={anyBusy || !config || inactive}
                    busyKey={busyKey}
                    exportKey={`project-${id}`}
                    onExcel={() => exportProject(id, 'xlsx')}
                    onPdf={() => exportProject(id, 'pdf')}
                  />
                );
              })}
            </div>
          )}
        </ExportSection>

        <ExportSection
          sectionId="grading-keys"
          title="Notenschlüssel"
          expanded={isSectionOpen('grading-keys')}
          onToggle={() => toggleSection('grading-keys')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            Voreingestellte Schlüssel (Plateau/Linear) und eigene Vorlagen aus dem Reiter{' '}
            <strong>Notenschlüssel</strong> (PKT, Note, % und Diagramm). Voreingestellte Schlüssel werden mit 50 Maximalpunkten
            exportiert; eigene Schlüssel mit ihrem Referenzwert.
          </p>
          <div className="export-item-row__actions export-course-full-actions" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="tab secondary export-format-btn"
              disabled={anyBusy || !config}
              onClick={() => exportAllGradingKeysBundle('xlsx')}
            >
              <FileSpreadsheet size={16} strokeWidth={2} aria-hidden />
              {busyKey === 'grading-keys-all-xlsx' ? 'Export …' : 'Alle Notenschlüssel als Excel'}
            </button>
            <button
              type="button"
              className="tab secondary export-format-btn"
              disabled={anyBusy || !config}
              onClick={() => exportAllGradingKeysBundle('pdf')}
            >
              <FileText size={16} strokeWidth={2} aria-hidden />
              {busyKey === 'grading-keys-all-pdf' ? 'Export …' : 'Alle Notenschlüssel als PDF'}
            </button>
          </div>
          <div className="export-item-list">
            {gradingKeyEntries.map((entry) => (
              <ExportFormatButtons
                key={entry.id}
                label={entry.name}
                sublabel={
                  [entry.preset ? 'Voreingestellt' : null, entry.maxPoints > 0 ? `${entry.maxPoints} Maximalpunkte` : null]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
                disabled={anyBusy || !config}
                busyKey={busyKey}
                exportKey={`grading-key-${entry.id}`}
                onExcel={() => exportGradingKey(entry, 'xlsx')}
                onPdf={() => exportGradingKey(entry, 'pdf')}
              />
            ))}
          </div>
        </ExportSection>
      </div>
    </div>
  );
}
