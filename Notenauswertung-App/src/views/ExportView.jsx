import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useData } from '../store/DataContext';
import { buildSummaryOverviewExportData } from '../utils/summaryOverviewExport';
import {
  examExportFilename,
  oralExportFilename,
  summaryOverviewExportFilename,
  testExportFilename,
} from '../utils/exportFilenames';
import { buildExamTableExportAoa, examExportSheetName } from '../utils/examTableExport';
import { buildOralStandardTableExportData, oralExportSheetName } from '../utils/oralTableExport';
import { buildTestTableExportAoa, testExportSheetName } from '../utils/testTableExport';
import { downloadAoaXlsx, downloadSheetDataXlsx } from '../utils/phixXlsxExport';

function courseLabel(course) {
  if (!course) return '';
  return [course.subject, course.className, course.year].filter(Boolean).join(' · ');
}

function ExportItemButton({ label, sublabel, disabled, busy, onClick }) {
  return (
    <button
      type="button"
      className="tab secondary export-item-btn"
      disabled={disabled}
      onClick={onClick}
    >
      <Download size={16} strokeWidth={2} aria-hidden />
      <span className="export-item-btn__text">
        <span className="export-item-btn__label">{busy ? 'Export …' : label}</span>
        {sublabel ? <span className="export-item-btn__sublabel text-muted">{sublabel}</span> : null}
      </span>
    </button>
  );
}

export default function ExportView() {
  const { config, students, exams, orals, tests, gfsEntries } = useData();
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

  const onExportSummary = () =>
    runExport('summary', async () => {
      const sheetData = buildSummaryOverviewExportData({
        students,
        exams,
        orals,
        tests,
        gfsEntries,
        config,
      });
      const filename = summaryOverviewExportFilename(config);
      downloadSheetDataXlsx(sheetData, 'Übersicht', filename);
      return filename;
    });

  const onExportExam = (examId) =>
    runExport(`exam-${examId}`, async () => {
      const exam = exams[examId];
      if (!exam) throw new Error('missing exam');
      const aoa = buildExamTableExportAoa({ exam, examId, students, config });
      const filename = examExportFilename(config, examId);
      downloadAoaXlsx(aoa, examExportSheetName(examId), filename);
      return filename;
    });

  const onExportTest = (testId) =>
    runExport(`test-${testId}`, async () => {
      const test = tests[testId];
      if (!test) throw new Error('missing test');
      const aoa = buildTestTableExportAoa({ test, testId, students, config });
      const filename = testExportFilename(config, testId, test.name);
      downloadAoaXlsx(aoa, testExportSheetName(testId, test.name), filename);
      return filename;
    });

  const onExportOral = (oralId) =>
    runExport(`oral-${oralId}`, async () => {
      const oral = orals[oralId];
      const sheetData = buildOralStandardTableExportData({ oral, students, config });
      if (!sheetData) {
        setErr('Erweiterte mündliche Bereiche können nicht im Standardformat exportiert werden.');
        return null;
      }
      const filename = oralExportFilename(config, oralId, oral?.name);
      downloadSheetDataXlsx(sheetData, oralExportSheetName(oralId, oral?.name), filename);
      return filename;
    });

  const anyBusy = busyKey !== null;

  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Export</h3>
      <p className="program-view-intro">
        Daten des aktuellen Kurses als Excel-kompatible Dateien (.xlsx) herunterladen.
        {courseTitle ? (
          <>
            {' '}
            Aktueller Kurs: <strong>{courseTitle}</strong>
          </>
        ) : null}
      </p>

      <div className="program-view-stack">
        <section className="program-view-panel glass-panel" aria-labelledby="export-summary-heading">
          <h4 id="export-summary-heading" className="program-view-panel-heading">
            Übersicht (Gesamtübersicht)
          </h4>
          <p className="program-view-panel-text text-muted">
            Tabelle aus dem Reiter <strong>Übersicht</strong> (Schriftlich, Mündlich, Tests, Endnoten).
          </p>
          <ExportItemButton
            label="Übersicht als Excel exportieren"
            disabled={anyBusy || !config}
            busy={busyKey === 'summary'}
            onClick={onExportSummary}
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
                  <ExportItemButton
                    key={id}
                    label={`KA ${id} exportieren`}
                    sublabel={
                      inactive
                        ? 'inaktiv'
                        : [exam?.halbjahr ? `HJ ${exam.halbjahr}` : null, exam?.date].filter(Boolean).join(' · ') ||
                          undefined
                    }
                    disabled={anyBusy || !config}
                    busy={busyKey === `exam-${id}`}
                    onClick={() => onExportExam(id)}
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
                  <ExportItemButton
                    key={id}
                    label={test?.name?.trim() ? `${test.name} exportieren` : `Test ${id} exportieren`}
                    sublabel={
                      inactive
                        ? 'inaktiv'
                        : [test?.halbjahr ? `HJ ${test.halbjahr}` : null].filter(Boolean).join(' · ') ||
                          undefined
                    }
                    disabled={anyBusy || !config}
                    busy={busyKey === `test-${id}`}
                    onClick={() => onExportTest(id)}
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
                  <ExportItemButton
                    key={id}
                    label={
                      oral?.name?.trim()
                        ? `${oral.name} exportieren`
                        : `Mündlich ${id} exportieren`
                    }
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
                    busy={busyKey === `oral-${id}`}
                    onClick={() => onExportOral(id)}
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
