import React, { useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, Upload } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useDialog } from '../components/PhixDialog';
import { apiFetch } from '../utils/apiBase';
import { applyCryptoHeader } from '../utils/cryptoSession';

const RESTORE_CONFIRM = 'WIEDERHERSTELLEN';

function actingHeaders(username) {
  const h = new Headers();
  if (username) h.set('X-Acting-User', username);
  return applyCryptoHeader(h);
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

async function downloadBackup(path, username, fallbackName) {
  const res = await apiFetch(path, { headers: actingHeaders(username) });
  if (!res.ok) {
    let msg = 'Backup konnte nicht erstellt werden.';
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const filename =
    parseFilenameFromDisposition(res.headers.get('Content-Disposition')) || fallbackName;
  downloadBlob(blob, filename);
}

async function restoreBackup(path, username, parsed) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: (() => {
      const h = actingHeaders(username);
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
    throw new Error(msg);
  }
}

function BackupSection({ sectionId, title, expanded, onToggle, children }) {
  const headingId = `backup-${sectionId}-heading`;
  const contentId = `backup-${sectionId}-content`;

  return (
    <section
      className={`program-view-panel glass-panel export-section${expanded ? ' export-section--open' : ''}`}
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

function BackupSubsection({ title, children }) {
  return (
    <div className="backup-subsection">
      <h5 className="backup-subsection__title">{title}</h5>
      {children}
    </div>
  );
}

function BackupRestoreBlock({
  sectionId,
  title,
  description,
  warning,
  downloadLabel,
  downloadPath,
  restorePath,
  actingUsername,
  downloadFallback,
  restoreConfirmMessage,
  busy,
  setBusy,
  onFeedback,
  showConfirm,
  expanded,
  onToggle,
}) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  const onDownload = async () => {
    onFeedback('', '');
    setBusy('download');
    try {
      await downloadBackup(downloadPath, actingUsername, downloadFallback);
    } catch (e) {
      onFeedback('err', e?.message || 'Export fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  };

  const onPickFile = (e) => {
    onFeedback('', '');
    setSelectedFile(e.target.files?.[0] ?? null);
    setConfirmText('');
  };

  const onRestore = async () => {
    onFeedback('', '');
    if (!selectedFile) {
      onFeedback('err', 'Bitte zuerst eine Backup-Datei auswählen.');
      return;
    }
    if (confirmText.trim() !== RESTORE_CONFIRM) {
      onFeedback('err', `Zur Bestätigung bitte exakt „${RESTORE_CONFIRM}“ eingeben.`);
      return;
    }
    const confirmOk = await showConfirm(restoreConfirmMessage, { title: 'Backup wiederherstellen', danger: true });
    if (!confirmOk) return;

    setBusy('restore');
    try {
      let parsed;
      try {
        parsed = JSON.parse(await selectedFile.text());
      } catch {
        onFeedback('err', 'Die Datei ist keine gültige PhiX-Backup-JSON-Datei.');
        return;
      }
      await restoreBackup(restorePath, actingUsername, parsed);
      onFeedback('ok', 'Backup wurde aufgespielt. Die Anwendung wird neu geladen …');
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      onFeedback('err', e?.message || 'Wiederherstellung fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  };

  const isBusy = busy != null;

  return (
    <BackupSection sectionId={sectionId} title={title} expanded={expanded} onToggle={onToggle}>
      <p className="program-view-panel-text text-muted" style={{ marginTop: 0 }}>
        {description}
      </p>

      <BackupSubsection title="Backup erstellen">
        <button
          type="button"
          className="tab primary program-view-panel-cta backup-action-btn"
          disabled={isBusy}
          onClick={onDownload}
        >
          <Download size={18} strokeWidth={2} aria-hidden />
          {busy === 'download' ? 'Backup wird erstellt …' : downloadLabel}
        </button>
      </BackupSubsection>

      <BackupSubsection title="Backup wiederherstellen">
        <p className="program-view-panel-text text-muted backup-restore-warning">{warning}</p>

        <label className="backup-file-label">
          <span className="backup-file-label-text">Backup-Datei (.json)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="backup-file-input"
            onChange={onPickFile}
            disabled={isBusy}
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
            disabled={isBusy}
            placeholder={RESTORE_CONFIRM}
          />
        </label>

        <button
          type="button"
          className="tab secondary program-view-panel-cta backup-action-btn backup-action-btn--danger"
          disabled={isBusy || !selectedFile || confirmText.trim() !== RESTORE_CONFIRM}
          onClick={onRestore}
        >
          <Upload size={18} strokeWidth={2} aria-hidden />
          {busy === 'restore' ? 'Wird aufgespielt …' : 'Backup aufspielen'}
        </button>
      </BackupSubsection>
    </BackupSection>
  );
}

export default function BackupView() {
  const { currentUser, usersList } = useAuth();
  const { showConfirm, showAlert } = useDialog();
  const isAdminUser = currentUser?.username?.toLowerCase() === 'admin';
  const username = currentUser?.username;

  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [meBusy, setMeBusy] = useState(null);
  const [fullBusy, setFullBusy] = useState(null);
  const [userBusy, setUserBusy] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  const [selectedAdminUser, setSelectedAdminUser] = useState('');

  const sortedUsers = useMemo(
    () => [...usersList].sort((a, b) => a.username.localeCompare(b.username, 'de', { sensitivity: 'base' })),
    [usersList],
  );

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const isSectionOpen = (sectionId) => expandedSections.has(sectionId);

  const onFeedback = (type, msg) => setFeedback({ type, msg });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const showBackupLimitations = () => {
    showAlert(
      'Die Backups sind zwischen Standalone-Versionen und Serverversionen nicht zwingend kompatibel. Beachte also: Wenn du ein Backup auf einem Server erstellst (PostgreSQL), dann ist es mit einer weiteren Serverversion uneingeschränkt kompatibel, aber ein Aufspielen auf eine Standalone-Version (SQLite) ist nicht empfohlen. Das selbe gilt auch andersherum.',
      { title: 'Einschränkungen' },
    );
  };

  return (
    <div className="view-generic-scroll program-view">
      <div className="backup-page-header">
        <h3 className="program-view-title">Backup</h3>
        <button type="button" className="tab secondary" onClick={showBackupLimitations}>
          Einschränkungen
        </button>
      </div>
      <p className="program-view-intro">
        Sichern und Wiederherstellen von Notendaten. Normale Benutzer verwalten nur die eigenen Kurse; der
        Administrator kann zusätzlich die gesamte Datenbank oder einzelne Benutzer sichern.
      </p>

      <div className="program-view-stack">
        <BackupRestoreBlock
          sectionId="me"
          title="Mein Backup"
          description="Verschlüsseltes Backup mit allen Ihren Kursen, Schülern, Noten (Klausuren, Tests, Mündlich, Projekte, GFS, Referate), Klassenlehrer-Listen, Album-Fotos, Auswertungshilfe und Schülerverwaltung. Persönliche Anzeige-Einstellungen (Dark Mode, Farbschema) sind enthalten. Keine anderen Benutzer, keine Passwörter."
          warning={
            <>
              <strong>Achtung:</strong> Beim Aufspielen werden <strong>alle Ihre Kurse</strong> gelöscht und
              durch den Backup-Inhalt ersetzt. Andere Benutzer bleiben unberührt; Ihre Schülerverwaltung wird mit
              ersetzt.
            </>
          }
          downloadLabel="Verschlüsseltes Backup erstellen"
          downloadPath="/api/backup/me/download?mode=raw"
          restorePath="/api/backup/me/restore"
          actingUsername={username}
          downloadFallback={`phix-user-backup-${username || 'benutzer'}-${stamp}Z.json`}
          restoreConfirmMessage="Alle Ihre Kurse und Noten werden durch dieses Backup ersetzt. Fortfahren?"
          busy={meBusy}
          setBusy={setMeBusy}
          onFeedback={onFeedback}
          showConfirm={showConfirm}
          expanded={isSectionOpen('me')}
          onToggle={() => toggleSection('me')}
        />

        {isAdminUser ? (
          <>
            <BackupRestoreBlock
              sectionId="full"
              title="Vollständiges Datenbank-Backup"
              description="Gesamte Installation als verschlüsseltes Backup (wie in der Datenbank): alle Benutzer, Kurse, Noten inkl. Projekte, GFS, Referate und Album, Klassenlehrer-Listen sowie UserCrypto-Hüllen. Klartext fremder Nutzer ist ohne deren Passwort/Recovery nicht lesbar."
              warning={
                <>
                  <strong>Achtung:</strong> Ersetzt die <strong>komplette Datenbank</strong> aller Benutzer.
                  Zuerst ein aktuelles Voll-Backup erstellen.
                </>
              }
              downloadLabel="Voll-Backup erstellen"
              downloadPath="/api/backup/full/download"
              restorePath="/api/backup/full/restore"
              actingUsername={username}
              downloadFallback={`phix-full-backup-${stamp}Z.json`}
              restoreConfirmMessage="Die gesamte Datenbank wird unwiderruflich ersetzt. Fortfahren?"
              busy={fullBusy}
              setBusy={setFullBusy}
              onFeedback={onFeedback}
              showConfirm={showConfirm}
              expanded={isSectionOpen('full')}
              onToggle={() => toggleSection('full')}
            />

            <BackupSection
              sectionId="admin-user"
              title="Backup eines Benutzers (Administrator)"
              expanded={isSectionOpen('admin-user')}
              onToggle={() => toggleSection('admin-user')}
            >
              <p className="program-view-panel-text text-muted" style={{ marginTop: 0 }}>
                Sicherung oder Wiederherstellung der Kurse und Noten eines bestimmten Benutzers — ohne andere
                Konten zu verändern (außer beim Aufspielen: nur die Kurse dieses Benutzers werden ersetzt).
              </p>

              <label className="program-user-mgmt-label backup-user-select-wrap">
                <span>Benutzer</span>
                <select
                  className="program-user-mgmt-input backup-user-select"
                  value={selectedAdminUser}
                  onChange={(e) => {
                    setSelectedAdminUser(e.target.value);
                    onFeedback('', '');
                  }}
                  disabled={userBusy != null}
                >
                  <option value="">— Benutzer wählen —</option>
                  {sortedUsers.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </label>

              <BackupSubsection title="Backup erstellen">
                <button
                  type="button"
                  className="tab secondary backup-action-btn"
                  disabled={!selectedAdminUser || userBusy != null}
                  onClick={async () => {
                    onFeedback('', '');
                    setUserBusy('download');
                    try {
                      const enc = encodeURIComponent(selectedAdminUser);
                      await downloadBackup(
                        `/api/backup/users/${enc}/download`,
                        username,
                        `phix-user-backup-${selectedAdminUser}-${stamp}Z.json`,
                      );
                    } catch (e) {
                      onFeedback('err', e?.message || 'Export fehlgeschlagen.');
                    } finally {
                      setUserBusy(null);
                    }
                  }}
                >
                  <Download size={18} strokeWidth={2} aria-hidden />
                  {userBusy === 'download' ? 'Export …' : 'Verschlüsseltes Backup erstellen'}
                </button>
              </BackupSubsection>

              <BackupSubsection title="Backup wiederherstellen">
                <p className="program-view-panel-text text-muted backup-restore-warning">
                  <strong>Achtung:</strong> JSON-Datei muss ein Benutzer-Backup (
                  <code>scope: &quot;user&quot;</code>) für genau den gewählten Benutzernamen sein.
                </p>

                <AdminUserRestorePanel
                  selectedAdminUser={selectedAdminUser}
                  actingUsername={username}
                  busy={userBusy}
                  setBusy={setUserBusy}
                  onFeedback={onFeedback}
                  showConfirm={showConfirm}
                />
              </BackupSubsection>
            </BackupSection>
          </>
        ) : null}

        {feedback.msg ? (
          <p
            className={`backup-feedback backup-feedback--${feedback.type === 'err' ? 'error' : 'ok'}`}
            role={feedback.type === 'err' ? 'alert' : 'status'}
          >
            {feedback.msg}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AdminUserRestorePanel({ selectedAdminUser, actingUsername, busy, setBusy, onFeedback, showConfirm }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  const onRestore = async () => {
    onFeedback('', '');
    if (!selectedAdminUser) {
      onFeedback('err', 'Bitte zuerst einen Benutzer wählen.');
      return;
    }
    if (!selectedFile) {
      onFeedback('err', 'Bitte eine Backup-Datei auswählen.');
      return;
    }
    if (confirmText.trim() !== RESTORE_CONFIRM) {
      onFeedback('err', `Zur Bestätigung bitte exakt „${RESTORE_CONFIRM}“ eingeben.`);
      return;
    }
    const adminOk = await showConfirm(
      `Alle Kurse von „${selectedAdminUser}“ werden durch das Backup ersetzt. Fortfahren?`,
      { title: 'Admin-Restore', danger: true },
    );
    if (!adminOk) return;

    setBusy('restore');
    try {
      const parsed = JSON.parse(await selectedFile.text());
      const enc = encodeURIComponent(selectedAdminUser);
      await restoreBackup(`/api/backup/users/${enc}/restore`, actingUsername, parsed);
      onFeedback('ok', `Backup für „${selectedAdminUser}“ aufgespielt. Seite wird neu geladen …`);
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      onFeedback('err', e?.message || 'Wiederherstellung fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <label className="backup-file-label">
        <span className="backup-file-label-text">Backup-Datei (.json)</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="backup-file-input"
          onChange={(e) => {
            onFeedback('', '');
            setSelectedFile(e.target.files?.[0] ?? null);
            setConfirmText('');
          }}
          disabled={busy != null}
        />
      </label>
      {selectedFile ? (
        <p className="program-view-panel-text text-muted backup-selected-file">
          Ausgewählt: {selectedFile.name}
        </p>
      ) : null}
      <label className="backup-confirm-label">
        <span className="backup-confirm-label-text">Zur Bestätigung „{RESTORE_CONFIRM}“ eingeben</span>
        <input
          type="text"
          className="backup-confirm-input"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={busy != null}
        />
      </label>
      <button
        type="button"
        className="tab secondary program-view-panel-cta backup-action-btn backup-action-btn--danger"
        disabled={
          busy != null ||
          !selectedAdminUser ||
          !selectedFile ||
          confirmText.trim() !== RESTORE_CONFIRM
        }
        onClick={onRestore}
      >
        <Upload size={18} strokeWidth={2} aria-hidden />
        {busy === 'restore' ? 'Wird aufgespielt …' : 'Backup für Benutzer aufspielen'}
      </button>
    </>
  );
}
