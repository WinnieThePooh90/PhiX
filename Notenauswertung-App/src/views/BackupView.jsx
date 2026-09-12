import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  Upload,
  Server,
  HardDrive,
  Save,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FolderOpen,
  Trash2,
  FileText,
  Usb,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useDialog } from '../components/PhixDialog';
import { apiFetch } from '../utils/apiBase';
import { userHasAdminRights } from '../utils/userAdmin';
import { applyCryptoHeader } from '../utils/cryptoSession';

const RESTORE_CONFIRM = 'WIEDERHERSTELLEN';

function actingHeaders() {
  return applyCryptoHeader(new Headers());
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

async function downloadBackup(path, _username, fallbackName) {
  const res = await apiFetch(path, { headers: actingHeaders() });
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

async function restoreBackup(path, _username, parsed) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: (() => {
      const h = actingHeaders();
      h.set('Content-Type', 'application/json');
      return h;
    })(),
    body: JSON.stringify(parsed),
  });
  if (!res.ok) {
    let msg = `Wiederherstellung fehlgeschlagen (Status ${res.status}).`;
    if (res.status === 413) {
      msg = 'Die Backup-Datei ist zu groß für die Übertragung (HTTP 413 Payload Too Large).';
    } else {
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {
        /* ignore */
      }
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
  onRestoreSuccess,
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
      if (typeof onRestoreSuccess === 'function') {
        await onRestoreSuccess();
      } else {
        onFeedback('ok', 'Restore erfolgreich. Bitte erneut anmelden.');
        window.setTimeout(() => window.location.reload(), 1200);
      }
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
  const { currentUser, usersList, logout } = useAuth();
  const { showConfirm, showAlert } = useDialog();
  const isAdminUser = userHasAdminRights(currentUser);
  const username = currentUser?.username;

  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [meBusy, setMeBusy] = useState(null);
  const [fullBusy, setFullBusy] = useState(null);
  const [userBusy, setUserBusy] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  const [selectedAdminUser, setSelectedAdminUser] = useState('');

  const handleRestoreSuccess = async () => {
    try {
      sessionStorage.setItem('phix_login_notice', 'Restore erfolgreich. Bitte erneut anmelden.');
    } catch {
      /* ignore */
    }
    onFeedback('ok', 'Restore erfolgreich. Bitte erneut anmelden.');
    window.setTimeout(async () => {
      await logout();
      window.location.reload();
    }, 1200);
  };

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
          onRestoreSuccess={handleRestoreSuccess}
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
              onRestoreSuccess={handleRestoreSuccess}
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
                  onRestoreSuccess={handleRestoreSuccess}
                  showConfirm={showConfirm}
                />
              </BackupSubsection>
            </BackupSection>

            <AutoBackupAdminSection
              expanded={isSectionOpen('auto-backup')}
              onToggle={() => toggleSection('auto-backup')}
              onFeedback={onFeedback}
              showConfirm={showConfirm}
            />
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

function AdminUserRestorePanel({
  selectedAdminUser,
  actingUsername,
  busy,
  setBusy,
  onFeedback,
  onRestoreSuccess,
  showConfirm,
}) {
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
      if (typeof onRestoreSuccess === 'function') {
        await onRestoreSuccess();
      } else {
        onFeedback('ok', `Backup für „${selectedAdminUser}“ aufgespielt. Seite wird neu geladen …`);
        window.setTimeout(() => window.location.reload(), 1200);
      }
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

function AutoBackupAdminSection({ expanded, onToggle, onFeedback, showConfirm }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState(false);

  const [showFiles, setShowFiles] = useState(false);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [availableDrives, setAvailableDrives] = useState([]);
  const [loadingDrives, setLoadingDrives] = useState(false);

  const [form, setForm] = useState({
    enabled: false,
    localPath: 'Autobackups',
    retentionCount: 10,
    usbEnabled: false,
    usbPath: '',
    remoteEnabled: false,
    remoteProtocol: 'sftp',
    remoteHost: '',
    remotePort: 22,
    remoteUser: '',
    remotePassword: '',
    remotePath: '/backups',
    lastRunAt: null,
    lastStatusLocal: '',
    lastStatusUsb: '',
    lastStatusRemote: '',
    lastErrorMessage: null,
  });

  const loadDrives = async () => {
    setLoadingDrives(true);
    try {
      const res = await apiFetch('/api/backup/auto/drives', { headers: actingHeaders() });
      if (!res.ok) throw new Error('Laufwerke konnten nicht geladen werden.');
      const data = await res.json();
      setAvailableDrives(data?.drives || []);
    } catch (err) {
      console.warn('[auto-backup] Fehler beim Erkennen von USB-Laufwerken:', err);
    } finally {
      setLoadingDrives(false);
    }
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/backup/auto/config', { headers: actingHeaders() });
      if (!res.ok) throw new Error('Konfiguration konnte nicht geladen werden.');
      const data = await res.json();
      if (data?.config) {
        setForm((prev) => ({
          ...prev,
          ...data.config,
          remotePassword: '', // Aus Sicherheitsgründen nicht im Klartext zurückgeben
        }));
      }
    } catch (err) {
      onFeedback('err', err?.message || 'Fehler beim Laden der Auto-Backup-Konfiguration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) {
      loadConfig();
      loadDrives();
    }
  }, [expanded]);

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    onFeedback('', '');
    try {
      const payload = {
        enabled: form.enabled,
        localPath: form.localPath,
        retentionCount: Number(form.retentionCount) || 10,
        usbEnabled: form.usbEnabled,
        usbPath: form.usbPath,
        remoteEnabled: form.remoteEnabled,
        remoteProtocol: form.remoteProtocol,
        remoteHost: form.remoteHost,
        remotePort: Number(form.remotePort) || (form.remoteProtocol === 'ftps' ? 21 : 22),
        remoteUser: form.remoteUser,
        remotePath: form.remotePath,
      };
      if (form.remotePassword) {
        payload.remotePassword = form.remotePassword;
      }

      const res = await apiFetch('/api/backup/auto/config', {
        method: 'PUT',
        headers: (() => {
          const h = actingHeaders();
          h.set('Content-Type', 'application/json');
          return h;
        })(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Speichern fehlgeschlagen.');
      }
      onFeedback('ok', 'Auto-Backup-Einstellungen erfolgreich gespeichert.');
      await loadConfig();
    } catch (err) {
      onFeedback('err', err?.message || 'Fehler beim Speichern der Einstellungen.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestRemote = async () => {
    setTesting(true);
    onFeedback('', '');
    try {
      const payload = {
        remoteProtocol: form.remoteProtocol,
        remoteHost: form.remoteHost,
        remotePort: Number(form.remotePort) || (form.remoteProtocol === 'ftps' ? 21 : 22),
        remoteUser: form.remoteUser,
        remotePath: form.remotePath,
      };
      if (form.remotePassword) {
        payload.remotePassword = form.remotePassword;
      }

      const res = await apiFetch('/api/backup/auto/test', {
        method: 'POST',
        headers: (() => {
          const h = actingHeaders();
          h.set('Content-Type', 'application/json');
          return h;
        })(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Verbindungstest fehlgeschlagen.');
      }
      onFeedback('ok', data.message || 'Verbindung zum Remote-Server erfolgreich!');
    } catch (err) {
      onFeedback('err', `Remote-Test fehlgeschlagen: ${err?.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleRunNow = async () => {
    const ok = await showConfirm(
      'Möchten Sie jetzt sofort ein automatisches Backup (lokal und ggf. USB / Remote) ausführen?',
      { title: 'Auto-Backup sofort starten', danger: false },
    );
    if (!ok) return;

    setRunning(true);
    onFeedback('', '');
    try {
      const payload = {
        enabled: form.enabled,
        localPath: form.localPath,
        retentionCount: Number(form.retentionCount) || 10,
        usbEnabled: form.usbEnabled,
        usbPath: form.usbPath,
        remoteEnabled: form.remoteEnabled,
        remoteProtocol: form.remoteProtocol,
        remoteHost: form.remoteHost,
        remotePort: Number(form.remotePort) || (form.remoteProtocol === 'ftps' ? 21 : 22),
        remoteUser: form.remoteUser,
        remotePath: form.remotePath,
      };
      if (form.remotePassword) {
        payload.remotePassword = form.remotePassword;
      }

      const res = await apiFetch('/api/backup/auto/run-now', {
        method: 'POST',
        headers: (() => {
          const h = actingHeaders();
          h.set('Content-Type', 'application/json');
          return h;
        })(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Backup fehlgeschlagen.');
      }
      let msg = `Auto-Backup erfolgreich erstellt: ${data.filename}`;
      const savedPlaces = ['Lokal'];
      if (data.lastStatusUsb === 'success') savedPlaces.push('USB');
      if (data.lastStatusRemote === 'success') savedPlaces.push('Remote');
      msg += ` (${savedPlaces.join(' & ')} gespeichert)`;

      if (data.lastStatusUsb === 'error') {
        msg += ` | USB-Fehler: ${data.lastErrorMessage || 'Fehler beim Schreiben auf USB'}`;
      }
      if (data.lastStatusRemote === 'error') {
        msg += ` | Remote-Fehler: ${data.lastErrorMessage || 'Upload fehlgeschlagen'}`;
      }
      const hasErrors = data.lastStatusUsb === 'error' || data.lastStatusRemote === 'error';
      onFeedback(hasErrors ? 'err' : 'ok', msg);
      await loadConfig();
    } catch (err) {
      onFeedback('err', `Fehler beim Ausführen des Backups: ${err?.message}`);
    } finally {
      setRunning(false);
    }
  };

  const loadFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await apiFetch('/api/backup/auto/list', { headers: actingHeaders() });
      if (!res.ok) throw new Error('Dateiliste konnte nicht geladen werden.');
      const data = await res.json();
      setFiles(data?.files || []);
    } catch (err) {
      onFeedback('err', err?.message || 'Fehler beim Laden der Backup-Dateien.');
    } finally {
      setLoadingFiles(false);
    }
  };

  const toggleFiles = () => {
    if (!showFiles) {
      loadFiles();
    }
    setShowFiles((prev) => !prev);
  };

  const handleDownloadFile = async (filename) => {
    try {
      const res = await apiFetch(`/api/backup/auto/download/${encodeURIComponent(filename)}`, {
        headers: actingHeaders(),
      });
      if (!res.ok) throw new Error('Download fehlgeschlagen.');
      const blob = await res.blob();
      downloadBlob(blob, filename);
    } catch (e) {
      onFeedback('err', e?.message || 'Fehler beim Herunterladen.');
    }
  };

  const handleDeleteFile = async (filename) => {
    const ok = await showConfirm(`Möchten Sie das Backup „${filename}“ wirklich unwiderruflich löschen?`, {
      title: 'Auto-Backup löschen',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await apiFetch(`/api/backup/auto/delete/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: actingHeaders(),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Löschen fehlgeschlagen.');
      }
      onFeedback('ok', `Backup „${filename}“ wurde gelöscht.`);
      await loadFiles();
    } catch (err) {
      onFeedback('err', err?.message || 'Fehler beim Löschen der Datei.');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const formatLastRun = (isoStr) => {
    if (!isoStr) return 'Noch nie ausgeführt';
    try {
      const d = new Date(isoStr);
      return Number.isNaN(d.getTime()) ? isoStr : d.toLocaleString('de-DE');
    } catch {
      return isoStr;
    }
  };

  return (
    <BackupSection
      sectionId="auto-backup"
      title="Automatisches Backup"
      expanded={expanded}
      onToggle={onToggle}
    >
      <p className="program-view-panel-text text-muted" style={{ marginTop: 0 }}>
        Erstellt jeden Sonntag um 00:00 Uhr automatisch ein vollständiges Backup der Datenbank.
        Falls der Rechner sonntags ausgeschaltet war, wird das Backup beim nächsten Start automatisch nachgeholt.
      </p>

      {loading ? (
        <p className="program-view-panel-text text-muted">Lade Einstellungen …</p>
      ) : (
        <form onSubmit={handleSave}>
          {/* Status Panel */}
          <div className="auto-backup-status-panel">
            <div className="auto-backup-status-row">
              <span><strong>Letzte Ausführung:</strong> {formatLastRun(form.lastRunAt)}</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {form.lastStatusLocal === 'success' && (
                  <span className="auto-backup-badge auto-backup-badge--success" title="Lokales Backup erfolgreich">
                    <CheckCircle2 size={13} /> Lokal: OK
                  </span>
                )}
                {form.lastStatusLocal === 'error' && (
                  <span className="auto-backup-badge auto-backup-badge--error" title="Lokales Backup fehlgeschlagen">
                    <XCircle size={13} /> Lokal: Fehler
                  </span>
                )}
                {form.lastStatusUsb === 'success' && (
                  <span className="auto-backup-badge auto-backup-badge--success" title="USB-Backup erfolgreich">
                    <CheckCircle2 size={13} /> USB: OK
                  </span>
                )}
                {form.lastStatusUsb === 'error' && (
                  <span className="auto-backup-badge auto-backup-badge--error" title="USB-Backup fehlgeschlagen">
                    <AlertTriangle size={13} /> USB: Fehler
                  </span>
                )}
                {form.lastStatusUsb === 'skipped' && (
                  <span className="auto-backup-badge auto-backup-badge--skipped" title="USB-Backup deaktiviert">
                    USB: Aus
                  </span>
                )}
                {form.lastStatusRemote === 'success' && (
                  <span className="auto-backup-badge auto-backup-badge--success" title="Remote-Upload erfolgreich">
                    <CheckCircle2 size={13} /> Remote: OK
                  </span>
                )}
                {form.lastStatusRemote === 'error' && (
                  <span className="auto-backup-badge auto-backup-badge--error" title="Remote-Upload fehlgeschlagen">
                    <AlertTriangle size={13} /> Remote: Fehler
                  </span>
                )}
                {form.lastStatusRemote === 'skipped' && (
                  <span className="auto-backup-badge auto-backup-badge--skipped" title="Remote deaktiviert">
                    Remote: Aus
                  </span>
                )}
              </div>
            </div>
            {form.lastErrorMessage ? (
              <div style={{ color: '#f87171', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                <strong>Fehlerdetails:</strong> {form.lastErrorMessage}
              </div>
            ) : null}
          </div>

          {/* Lokale Konfiguration */}
          <div className="auto-backup-card" style={{ marginTop: '1rem' }}>
            <label className="auto-backup-toggle-row">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
              />
              <span className="auto-backup-toggle-label">
                Automatisches wöchentliches Backup aktivieren
              </span>
            </label>
            <p className="program-view-panel-text text-muted" style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem' }}>
              Speicherort: Ordner <code>Autobackups/</code> direkt im Verzeichnis der PhiX-Installation.
            </p>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="auto-backup-field" style={{ minWidth: '220px' }}>
                <label>Anzahl vorzuhaltender Backups (Rotation)</label>
                <input
                  type="number"
                  min={2}
                  max={52}
                  className="program-user-mgmt-input"
                  value={form.retentionCount}
                  onChange={(e) => setForm((p) => ({ ...p, retentionCount: e.target.value }))}
                />
              </div>
              <button
                type="button"
                className="tab secondary backup-action-btn"
                style={{ height: '38px', margin: 0 }}
                onClick={toggleFiles}
              >
                <FolderOpen size={16} aria-hidden />
                {showFiles ? 'Backups ausblenden' : 'Backups anzeigen'}
              </button>
            </div>

            {showFiles ? (
              <div className="auto-backup-file-panel">
                <div className="auto-backup-file-panel__header">
                  <span>Gespeicherte lokale Backups ({files.length})</span>
                  <button
                    type="button"
                    className="auto-backup-icon-btn"
                    title="Liste aktualisieren"
                    onClick={loadFiles}
                    disabled={loadingFiles}
                  >
                    <RefreshCw size={13} className={loadingFiles ? 'spin' : ''} />
                  </button>
                </div>

                {loadingFiles ? (
                  <p className="program-view-panel-text text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    Lade Dateien …
                  </p>
                ) : files.length === 0 ? (
                  <p className="program-view-panel-text text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    Keine Backups im Verzeichnis Autobackups/ vorhanden.
                  </p>
                ) : (
                  <div className="auto-backup-file-list">
                    {files.map((f) => (
                      <div key={f.filename} className="auto-backup-file-item">
                        <div className="auto-backup-file-item__info">
                          <span className="auto-backup-file-item__name">{f.filename}</span>
                          <span className="auto-backup-file-item__meta">
                            <span>{formatFileSize(f.sizeBytes)}</span>
                            {f.mtime ? (
                              <span>• {new Date(f.mtime).toLocaleString('de-DE')}</span>
                            ) : null}
                          </span>
                        </div>
                        <div className="auto-backup-file-item__actions">
                          <button
                            type="button"
                            className="auto-backup-icon-btn"
                            title="Backup herunterladen"
                            onClick={() => handleDownloadFile(f.filename)}
                          >
                            <Download size={14} />
                          </button>
                          <button
                            type="button"
                            className="auto-backup-icon-btn auto-backup-icon-btn--danger"
                            title="Backup löschen"
                            onClick={() => handleDeleteFile(f.filename)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Dritter Speicherort: USB-Speichermedium */}
          <div className="auto-backup-card">
            <label className="auto-backup-toggle-row">
              <input
                type="checkbox"
                checked={form.usbEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm((p) => ({ ...p, usbEnabled: checked }));
                  if (checked && availableDrives.length === 0) {
                    loadDrives();
                  }
                }}
              />
              <span className="auto-backup-toggle-label">
                Dritten Speicherort aktivieren (USB-Speichermedium)
              </span>
            </label>
            <p className="program-view-panel-text text-muted" style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>
              Legt nach jedem Backup eine Kopie direkt und ohne Unterverzeichnis in das Hauptverzeichnis des ausgewählten USB-Speichermediums ab.
            </p>

            {form.usbEnabled ? (
              <div className="auto-backup-grid">
                <div className="auto-backup-field" style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ margin: 0 }}>Erkanntes USB-Laufwerk auswählen</label>
                    <button
                      type="button"
                      className="tab secondary backup-action-btn"
                      title="Laufwerke erneut scannen"
                      onClick={loadDrives}
                      disabled={loadingDrives}
                      style={{ padding: '3px 8px', height: '28px', fontSize: '0.78rem', margin: 0 }}
                    >
                      <RefreshCw size={12} className={loadingDrives ? 'spin' : ''} />
                      <span style={{ marginLeft: '4px' }}>Laufwerke suchen</span>
                    </button>
                  </div>
                  <select
                    className="program-user-mgmt-input"
                    value={form.usbPath}
                    onChange={(e) => setForm((p) => ({ ...p, usbPath: e.target.value }))}
                  >
                    <option value="">— Bitte USB-Laufwerk auswählen —</option>
                    {availableDrives.map((d) => (
                      <option key={d.path} value={d.path}>
                        {d.label}
                      </option>
                    ))}
                    {form.usbPath && !availableDrives.some((d) => d.path === form.usbPath) && (
                      <option value={form.usbPath}>
                        {form.usbPath} (Benutzerdefinierter Pfad)
                      </option>
                    )}
                  </select>
                </div>

                <div className="auto-backup-field" style={{ gridColumn: 'span 2' }}>
                  <label>Pfad zum USB-Hauptverzeichnis (oder manuell anpassen)</label>
                  <input
                    type="text"
                    className="program-user-mgmt-input"
                    value={form.usbPath}
                    onChange={(e) => setForm((p) => ({ ...p, usbPath: e.target.value }))}
                    placeholder="z. B. E:\ (Windows) oder /media/benutzer/STICK (Linux)"
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginTop: '0.25rem', display: 'block' }}>
                    Backups werden direkt als <code>phix-autobackup-*.json</code> in dieses Hauptverzeichnis abgelegt.
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Remote (S)FTP Konfiguration */}
          <div className="auto-backup-card">
            <label className="auto-backup-toggle-row">
              <input
                type="checkbox"
                checked={form.remoteEnabled}
                onChange={(e) => setForm((p) => ({ ...p, remoteEnabled: e.target.checked }))}
              />
              <span className="auto-backup-toggle-label">
                Zweiten Speicherort aktivieren (SFTP)
              </span>
            </label>
            <p className="program-view-panel-text text-muted" style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>
              Lädt nach jedem erfolgreichen lokalen Backup eine Kopie verschlüsselt auf einen entfernten Server hoch.
            </p>

            {form.remoteEnabled ? (
              <div className="auto-backup-grid">
                <div className="auto-backup-field">
                  <label>Protokoll</label>
                  <select
                    className="program-user-mgmt-input"
                    value={form.remoteProtocol}
                    onChange={(e) => {
                      const proto = e.target.value;
                      setForm((p) => ({
                        ...p,
                        remoteProtocol: proto,
                        remotePort: proto === 'ftps' ? (p.remotePort === 22 ? 21 : p.remotePort) : (p.remotePort === 21 ? 22 : p.remotePort),
                      }));
                    }}
                  >
                    <option value="sftp">SFTP (SSH Port 22 – Empfohlen)</option>
                    <option value="ftps">FTPS (FTP over TLS/SSL Port 21/990)</option>
                  </select>
                </div>

                <div className="auto-backup-field">
                  <label>Server / Host-Adresse</label>
                  <input
                    type="text"
                    className="program-user-mgmt-input"
                    value={form.remoteHost}
                    onChange={(e) => setForm((p) => ({ ...p, remoteHost: e.target.value }))}
                    placeholder="backup.meineschule.de oder IP"
                  />
                </div>

                <div className="auto-backup-field">
                  <label>Port</label>
                  <input
                    type="number"
                    className="program-user-mgmt-input"
                    value={form.remotePort}
                    onChange={(e) => setForm((p) => ({ ...p, remotePort: e.target.value }))}
                  />
                </div>

                <div className="auto-backup-field">
                  <label>Benutzername</label>
                  <input
                    type="text"
                    className="program-user-mgmt-input"
                    value={form.remoteUser}
                    onChange={(e) => setForm((p) => ({ ...p, remoteUser: e.target.value }))}
                    placeholder="sftp-user"
                  />
                </div>

                <div className="auto-backup-field">
                  <label>Passwort</label>
                  <input
                    type="password"
                    className="program-user-mgmt-input"
                    value={form.remotePassword}
                    onChange={(e) => setForm((p) => ({ ...p, remotePassword: e.target.value }))}
                    placeholder="Neues Passwort eingeben oder leer lassen"
                    autoComplete="new-password"
                  />
                </div>

                <div className="auto-backup-field">
                  <label>Zielverzeichnis auf Server</label>
                  <input
                    type="text"
                    className="program-user-mgmt-input"
                    value={form.remotePath}
                    onChange={(e) => setForm((p) => ({ ...p, remotePath: e.target.value }))}
                    placeholder="/backups/phix"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Aktionsschaltflächen */}
          <div className="auto-backup-actions-row">
            <button
              type="submit"
              className="tab primary backup-action-btn"
              disabled={saving || testing || running}
            >
              <Save size={16} aria-hidden />
              {saving ? 'Speichert …' : 'Einstellungen speichern'}
            </button>

            {form.remoteEnabled ? (
              <button
                type="button"
                className="tab secondary backup-action-btn"
                disabled={saving || testing || running || !form.remoteHost || !form.remoteUser}
                onClick={handleTestRemote}
              >
                <Server size={16} aria-hidden />
                {testing ? 'Verbindung wird getestet …' : 'Remote-Verbindung testen'}
              </button>
            ) : null}

            <button
              type="button"
              className="tab secondary backup-action-btn"
              disabled={saving || testing || running}
              onClick={handleRunNow}
            >
              <Play size={16} aria-hidden />
              {running ? 'Backup wird ausgeführt …' : 'Backup jetzt sofort ausführen'}
            </button>
          </div>
        </form>
      )}
    </BackupSection>
  );
}

