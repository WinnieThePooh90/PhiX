import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useData } from '../store/DataContext';
import {
  buildSummaryOverviewExportData,
  summaryOverviewExportFilename,
} from '../utils/summaryOverviewExport';
import { downloadSummaryOverviewXlsx } from '../utils/summaryOverviewXlsxExport';

function courseLabel(course) {
  if (!course) return '';
  return [course.subject, course.className, course.year].filter(Boolean).join(' · ');
}

export default function ExportView() {
  const { config, students, exams, orals, tests, gfsEntries } = useData();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const courseTitle = useMemo(() => courseLabel(config), [config]);

  const onExportSummary = () => {
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
    setBusy(true);
    try {
      const sheetData = buildSummaryOverviewExportData({
        students,
        exams,
        orals,
        tests,
        gfsEntries,
        config,
      });
      const filename = summaryOverviewExportFilename(config);
      downloadSummaryOverviewXlsx(sheetData, filename);
      setOk(`Datei „${filename}“ wurde heruntergeladen.`);
    } catch {
      setErr('Export fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Export</h3>
      <p className="program-view-intro">
        Daten des aktuellen Kurses als Excel-kompatible Datei (.xlsx) herunterladen.
      </p>

      <div className="program-view-stack">
        <section className="program-view-panel glass-panel" aria-labelledby="export-summary-heading">
          <h4 id="export-summary-heading" className="program-view-panel-heading">
            Übersicht (Gesamtübersicht)
          </h4>
          <p className="program-view-panel-text text-muted">
            Exportiert die Tabelle aus dem Reiter <strong>Übersicht</strong> mit allen Schülern und den
            Spalten Schriftlich, Mündlich, Tests, Endnote (Exakt) und manueller Endnote.
            {courseTitle ? (
              <>
                {' '}
                Aktueller Kurs: <strong>{courseTitle}</strong>
              </>
            ) : null}
          </p>
          <button
            type="button"
            className="tab primary program-view-panel-cta backup-action-btn"
            disabled={busy || !config}
            onClick={onExportSummary}
          >
            <Download size={18} strokeWidth={2} aria-hidden />
            {busy ? 'Export wird erstellt …' : 'Übersicht als Excel exportieren'}
          </button>
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
        </section>
      </div>
    </div>
  );
}
