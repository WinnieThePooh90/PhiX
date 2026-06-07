import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
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
import { buildExamTableExportAoa, examExportSheetName } from '../utils/examTableExport';
import { buildOralStandardTableExportData, oralExportSheetName } from '../utils/oralTableExport';
import { buildTestTableExportAoa, testExportSheetName } from '../utils/testTableExport';
import { downloadAoaXlsx, downloadMultiSheetXlsx, downloadSheetDataXlsx } from '../utils/phixXlsxExport';
import { downloadAoaPdf, downloadMultiSectionPdf, downloadSheetDataPdf } from '../utils/phixPdfExport';

function courseLabel(course) {
  if (!course) return '';
  return [course.subject, course.className, course.year].filter(Boolean).join(' · ');
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
      const sheetData = buildSummaryOverviewExportData({
        students,
        exams,
        orals,
        tests,
        projects,
        gfsEntries,
        config,
      });
      const filename = summaryOverviewExportFilename(config, format);
      if (format === 'pdf') {
        downloadSheetDataPdf(sheetData, 'Übersicht', filename);
      } else {
        downloadSheetDataXlsx(sheetData, 'Übersicht', filename);
      }
      return filename;
    });

  const exportExam = (examId, format) =>
    runExport(`exam-${examId}-${format}`, async () => {
      const exam = exams[examId];
      if (!exam) throw new Error('missing exam');
      const aoa = buildExamTableExportAoa({ exam, examId, students, config });
      const sheetName = examExportSheetName(examId);
      const filename = examExportFilename(config, examId, format);
      if (format === 'pdf') {
        downloadAoaPdf(aoa, sheetName, filename);
      } else {
        downloadAoaXlsx(aoa, sheetName, filename);
      }
      return filename;
    });

  const exportTest = (testId, format) =>
    runExport(`test-${testId}-${format}`, async () => {
      const test = tests[testId];
      if (!test) throw new Error('missing test');
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
      const sheetData = buildOralStandardTableExportData({ oral, students, config });
      if (!sheetData) {
        setErr('Erweiterte mündliche Bereiche können nicht im Standardformat exportiert werden.');
        return null;
      }
      const sheetName = oralExportSheetName(oralId, oral?.name);
      const filename = oralExportFilename(config, oralId, oral?.name, format);
      if (format === 'pdf') {
        downloadSheetDataPdf(sheetData, sheetName, filename);
      } else {
        downloadSheetDataXlsx(sheetData, sheetName, filename);
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
        <section
          className="program-view-panel glass-panel export-course-full-panel"
          aria-labelledby="export-course-full-heading"
        >
          <h4 id="export-course-full-heading" className="program-view-panel-heading">
            Gesamter Kurs
          </h4>
          <p className="program-view-panel-text text-muted">
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
        </section>

        <section className="program-view-panel glass-panel" aria-labelledby="export-summary-heading">
          <h4 id="export-summary-heading" className="program-view-panel-heading">
            Übersicht (Gesamtübersicht)
          </h4>
          <p className="program-view-panel-text text-muted">
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
        </section>

        <section className="program-view-panel glass-panel" aria-labelledby="export-exams-heading">
          <h4 id="export-exams-heading" className="program-view-panel-heading">
            Klausuren
          </h4>
          <p className="program-view-panel-text text-muted">
            Je Klausur eine Datei mit der Standardtabelle (#, Name, Aufgaben, Gesamt, Note) inkl.
            Maximalpunkte-Zeile.
          </p>
          {examNumbers.length === 0 ? (
            <p className="program-view-panel-text text-muted">Keine Klausuren angelegt.</p>
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
                    disabled={anyBusy || !config}
                    busyKey={busyKey}
                    exportKey={`exam-${id}`}
                    onExcel={() => exportExam(id, 'xlsx')}
                    onPdf={() => exportExam(id, 'pdf')}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="program-view-panel glass-panel" aria-labelledby="export-tests-heading">
          <h4 id="export-tests-heading" className="program-view-panel-heading">
            Tests
          </h4>
          <p className="program-view-panel-text text-muted">
            Je Test eine Datei (#, Name, Punkte, Gesamt, Note) inkl. Maximalpunkte-Zeile.
          </p>
          {testNumbers.length === 0 ? (
            <p className="program-view-panel-text text-muted">Keine Tests angelegt.</p>
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
                    disabled={anyBusy || !config}
                    busyKey={busyKey}
                    exportKey={`test-${id}`}
                    onExcel={() => exportTest(id, 'xlsx')}
                    onPdf={() => exportTest(id, 'pdf')}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="program-view-panel glass-panel" aria-labelledby="export-oral-heading">
          <h4 id="export-oral-heading" className="program-view-panel-heading">
            Mündliche Noten
          </h4>
          <p className="program-view-panel-text text-muted">
            Nur die <strong>Standardtabelle</strong> (#, Name, Note) — Bereiche im Modus „Erweitert“
            sind hier nicht enthalten.
          </p>
          {oralNumbers.length === 0 ? (
            <p className="program-view-panel-text text-muted">Keine mündlichen Bereiche angelegt.</p>
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
                    disabled={anyBusy || !config || extended}
                    busyKey={busyKey}
                    exportKey={`oral-${id}`}
                    onExcel={() => exportOral(id, 'xlsx')}
                    onPdf={() => exportOral(id, 'pdf')}
                  />
                );
              })}
            </div>
          )}
        </section>

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
