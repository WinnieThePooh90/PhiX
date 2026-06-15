import React, { useMemo, useState } from 'react';
import { ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useData } from '../store/DataContext';
import { buildSummaryOverviewExportData } from '../utils/summaryOverviewExport';
import {
  courseFullExportFilename,
  examExportFilename,
  oralExportFilename,
  summaryOverviewExportFilename,
  testExportFilename,
} from '../utils/exportFilenames';
import { buildCourseFullExportSheets } from '../utils/courseFullExport';
import { buildExamTableExport, examExportSheetName } from '../utils/examTableExport';
import { buildOralStandardTableExportData, oralExportSheetName } from '../utils/oralTableExport';
import { buildTestTableExportAoa, testExportSheetName } from '../utils/testTableExport';
import { downloadAoaXlsx, downloadMultiSheetXlsx, downloadSheetDataXlsx } from '../utils/phixXlsxExport';
import { downloadAoaPdf, downloadMultiSectionPdf, downloadSheetDataPdf } from '../utils/phixPdfExport';

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
  const { config, students, exams, orals, tests, projects, gfsEntries } = useData();
  const [busyKey, setBusyKey] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
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

  const runExport = async (key, fn) => {
    setErr('');
    setOk('');
    if (!config) {
      setErr('Kein Kurs ausgewählt.');
      return;
    }
    if (!students.length) {
      setErr('Keine Schüler im aktuellen Kurs — nichts zu exportieren.');
      return;
    }
    setBusyKey(key);
    try {
      const filename = await fn();
      if (filename) setOk(`Datei „${filename}“ wurde heruntergeladen.`);
    } catch {
      setErr('Export fehlgeschlagen.');
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

  const exportSummary = (format) =>
    runExport(`summary-${format}`, async () => {
      const { headers, rows, layout } = buildSummaryOverviewExportData({
        students,
        exams,
        orals,
        tests,
        projects,
        gfsEntries,
        config,
      });
      const sheetData = { headers, rows };
      const filename = summaryOverviewExportFilename(config, format);
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
      if (exam.active === false) {
        setErr('Inaktive Klausuren werden nicht exportiert.');
        return null;
      }
      const { aoa, layout } = buildExamTableExport({ exam, examId, students, config });
      const sheetName = examExportSheetName(examId);
      const filename = examExportFilename(config, examId, format);
      if (format === 'pdf') {
        downloadAoaPdf(aoa, sheetName, filename);
      } else {
        downloadAoaXlsx(aoa, sheetName, filename, layout);
      }
      return filename;
    });

  const exportTest = (testId, format) =>
    runExport(`test-${testId}-${format}`, async () => {
      const test = tests[testId];
      if (!test) throw new Error('missing test');
      if (test.active === false) {
        setErr('Inaktive Tests werden nicht exportiert.');
        return null;
      }
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
      if (oral?.active === false) {
        setErr('Inaktive mündliche Bereiche werden nicht exportiert.');
        return null;
      }
      const sheetData = buildOralStandardTableExportData({ oral, students, config });
      if (!sheetData) {
        setErr('Erweiterte mündliche Bereiche können nicht im Standardformat exportiert werden.');
        return null;
      }
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
            Alle Tabellen des aktuellen Kurses: <strong>Übersicht</strong>, alle <strong>Klausuren</strong>{' '}
            und <strong>Tests</strong>, mündliche Bereiche im <strong>Standardmodus</strong> (ohne Erweitert)
            sowie <strong>GFS</strong>. Excel: ein Tabellenblatt pro Bereich; PDF: je Bereich eine Seite.
          </p>
          <div className="export-item-row__actions export-course-full-actions">
            <button
              type="button"
              className="tab primary export-format-btn"
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
          title="Übersicht (Gesamtübersicht)"
          expanded={isSectionOpen('summary')}
          onToggle={() => toggleSection('summary')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            Tabelle aus dem Reiter <strong>Übersicht</strong> (Schriftlich, Mündlich, Tests, Endnoten).
          </p>
          <ExportFormatButtons
            label="Übersicht exportieren"
            disabled={anyBusy || !config}
            busyKey={busyKey}
            exportKey="summary"
            onExcel={() => exportSummary('xlsx')}
            onPdf={() => exportSummary('pdf')}
          />
        </ExportSection>

        <ExportSection
          sectionId="exams"
          title="Klausuren"
          expanded={isSectionOpen('exams')}
          onToggle={() => toggleSection('exams')}
        >
          <p className="program-view-panel-text text-muted" style={{ margin: 0 }}>
            Je Klausur eine Datei mit der Standardtabelle (#, Name, Aufgaben, Gesamt, Note) inkl.
            Maximalpunkte-Zeile.
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
            Nur die <strong>Standardtabelle</strong> (#, Name, Note) — Bereiche im Modus „Erweitert“
            sind hier nicht enthalten.
          </p>
          {oralNumbers.length === 0 ? (
            <p className="program-view-panel-text text-muted" style={{ margin: '0.75rem 0 0' }}>
              Keine mündlichen Bereiche angelegt.
            </p>
          ) : (
            <div className="export-item-list">
              {oralNumbers.map((id) => {
                const oral = orals[id];
                const extended = !!oral?.extended;
                const inactive = oral?.active === false;
                return (
                  <ExportFormatButtons
                    key={id}
                    label={oral?.name?.trim() ? oral.name : `Mündlich ${id}`}
                    sublabel={
                      extended
                        ? 'nur Standard — Erweitert aktiv'
                        : inactive
                          ? 'inaktiv'
                          : [oral?.halbjahr ? `HJ ${oral.halbjahr}` : null, oral?.date]
                              .filter(Boolean)
                              .join(' · ') || undefined
                    }
                    disabled={anyBusy || !config || extended || inactive}
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

        {err ? (
          <p className="backup-feedback backup-feedback--error" role="alert">
            {err}
          </p>
        ) : null}
        {ok ? (
          <p className="backup-feedback backup-feedback--ok" role="status">
            {ok}
          </p>
        ) : null}
      </div>
    </div>
  );
}
