import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { apiFetch } from '../utils/apiBase';

const RESTORE_CONFIRM = 'WIEDERHERSTELLEN';

function actingHeaders(username) {
  const h = new Headers();
  if (username) h.set('X-Acting-User', username);
  return h;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseFilenameFromDisposition(header) {
  if (!header) return null;
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/"/g, '').trim());
  } catch {
    return m[1].replace(/"/g, '').trim();
  }
}

export default function BackupView() {
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);

  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadErr, setDownloadErr] = useState('');
  const [downloadOk, setDownloadOk] = useState('');

  const [selectedFile, setSelectedFile] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreErr, setRestoreErr] = useState('');
  const [restoreOk, setRestoreOk] = useState('');

  const onCreateDownload = async () => {
    setDownloadErr('');
    setDownloadOk('');
    setDownloadBusy(true);
    try {
      const res = await apiFetch('/api/backup/download', {
        headers: actingHeaders(currentUser?.username),
      });
      if (!res.ok) {
        let msg = 'Backup konnte nicht erstellt werden.';
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        setDownloadErr(msg);
        return;
      }
      const blob = await res.blob();
      const filename =
        parseFilenameFromDisposition(res.headers.get('Content-Disposition')) ||
        `phix-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}Z.json`;
      downloadBlob(blob, filename);
      setDownloadOk('Backup wurde erstellt und heruntergeladen.');
    } catch {
      setDownloadErr('Verbindung zum Server fehlgeschlagen.');
    } finally {
      setDownloadBusy(false);
    }
  };

  const onPickFile = (e) => {
    setRestoreErr('');
    setRestoreOk('');
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setConfirmText('');
  };

  const onRestore = async () => {
    setRestoreErr('');
    setRestoreOk('');
    if (!selectedFile) {
      setRestoreErr('Bitte zuerst eine Backup-Datei auswählen.');
      return;
    }
    if (confirmText.trim() !== RESTORE_CONFIRM) {
      setRestoreErr(`Zur Bestätigung bitte exakt „${RESTORE_CONFIRM}“ eingeben.`);
      return;
    }
    if (
      !window.confirm(
        'Alle aktuellen Daten in der Datenbank werden unwiderruflich durch das Backup ersetzt. Fortfahren?',
      )
    ) {
      return;
    }

    setRestoreBusy(true);
    try {
      let parsed;
      try {
        const text = await selectedFile.text();
        parsed = JSON.parse(text);
      } catch {
        setRestoreErr('Die Datei ist keine gültige PhiX-Backup-JSON-Datei.');
        return;
      }

      const res = await apiFetch('/api/backup/restore', {
        method: 'POST',
        headers: (() => {
          const h = actingHeaders(currentUser?.username);
          h.set('Content-Type', 'application/json');
          return h;
        })(),
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        let msg = 'Wiederherstellung fehlgeschlagen.';
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        setRestoreErr(msg);
        return;
      }

      setRestoreOk('Backup wurde aufgespielt. Die Anwendung wird neu geladen …');
      window.setTimeout(() => window.location.reload(), 1200);
    } catch {
      setRestoreErr('Verbindung zum Server fehlgeschlagen.');
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <div className="view-generic-scroll program-view">
      <h3 className="program-view-title">Backup</h3>
      <p className="program-view-intro">
        Vollständige Sicherung und Wiederherstellung der PhiX-Datenbank: alle Kurse, Schüler, Noten,
        Benutzer, Schülerverwaltung und Klassenlehrer-Listen.
      </p>

      <div className="program-view-stack">
        <section className="program-view-panel glass-panel" aria-labelledby="backup-export-heading">
          <h4 id="backup-export-heading" className="program-view-panel-heading">
            Backup erstellen
          </h4>
          <p className="program-view-panel-text text-muted">
            Erzeugt eine JSON-Datei mit dem kompletten Datenbestand und lädt sie in den Browser herunter.
            Bewahren Sie die Datei sicher auf (enthält auch Passwort-Hashes).
          </p>
          <button
            type="button"
            className="tab primary program-view-panel-cta backup-action-btn"
            disabled={downloadBusy}
            onClick={onCreateDownload}
          >
            <Download size={18} strokeWidth={2} aria-hidden />
            {downloadBusy ? 'Backup wird erstellt …' : 'Backup erstellen und herunterladen'}
          </button>
          {downloadErr ? (
            <p className="backup-feedback backup-feedback--error" role="alert">
              {downloadErr}
            </p>
          ) : null}
          {downloadOk ? (
            <p className="backup-feedback backup-feedback--ok" role="status">
              {downloadOk}
            </p>
          ) : null}
        </section>

        <section className="program-view-panel glass-panel" aria-labelledby="backup-restore-heading">
          <h4 id="backup-restore-heading" className="program-view-panel-heading">
            Backup aufspielen
          </h4>
          <p className="program-view-panel-text text-muted backup-restore-warning">
            <strong>Achtung:</strong> Alle vorhandenen Daten werden gelöscht und durch den Inhalt der
            Backup-Datei ersetzt. Erstellen Sie vorher ein aktuelles Backup.
          </p>

          <label className="backup-file-label">
            <span className="backup-file-label-text">Backup-Datei (.json)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="backup-file-input"
              onChange={onPickFile}
              disabled={restoreBusy}
            />
          </label>
          {selectedFile ? (
            <p className="program-view-panel-text text-muted backup-selected-file">
              Ausgewählt: {selectedFile.name}
            </p>
          ) : null}

          <label className="backup-confirm-label">
            <span className="backup-confirm-label-text">
              Zur Bestätigung „{RESTORE_CONFIRM}“ eingeben
            </span>
            <input
              type="text"
              className="backup-confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={restoreBusy}
              placeholder={RESTORE_CONFIRM}
            />
          </label>

          <button
            type="button"
            className="tab secondary program-view-panel-cta backup-action-btn backup-action-btn--danger"
            disabled={restoreBusy || !selectedFile || confirmText.trim() !== RESTORE_CONFIRM}
            onClick={onRestore}
          >
            <Upload size={18} strokeWidth={2} aria-hidden />
            {restoreBusy ? 'Wird aufgespielt …' : 'Backup aufspielen'}
          </button>

          {restoreErr ? (
            <p className="backup-feedback backup-feedback--error" role="alert">
              {restoreErr}
            </p>
          ) : null}
          {restoreOk ? (
            <p className="backup-feedback backup-feedback--ok" role="status">
              {restoreOk}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
