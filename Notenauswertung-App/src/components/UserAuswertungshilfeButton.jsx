import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useDialog } from './PhixDialog';
import {
  AUSWERTUNGSHILFE_ACCEPT,
  deleteUserAuswertungshilfe,
  downloadUserAuswertungshilfe,
  fetchUserAuswertungshilfeMeta,
  subscribeUserAuswertungshilfe,
  uploadUserAuswertungshilfe,
} from '../utils/userAuswertungshilfeApi';

export default function UserAuswertungshilfeButton({ courseArchived = false }) {
  const { currentUser } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const inputRef = useRef(null);
  const [meta, setMeta] = useState({ uploaded: false, loading: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const username = currentUser?.username;
    if (!username) {
      setMeta({ uploaded: false, loading: false });
      return undefined;
    }
    let cancelled = false;
    fetchUserAuswertungshilfeMeta(username).catch(() => {
      if (!cancelled) setMeta({ uploaded: false, loading: false });
    });
    const unsub = subscribeUserAuswertungshilfe((next) => {
      if (!cancelled) setMeta({ ...next, loading: false });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [currentUser?.username]);

  const handleDownload = async () => {
    if (busy || meta.loading || !currentUser?.username || !meta.uploaded) return;
    setBusy(true);
    try {
      await downloadUserAuswertungshilfe(currentUser.username, meta.fileName);
    } catch (err) {
      await showAlert(err?.message || 'Datei konnte nicht heruntergeladen werden.');
    } finally {
      setBusy(false);
    }
  };

  const handleClick = async (e) => {
    if (busy || meta.loading || !currentUser?.username) return;
    if (courseArchived) {
      if (!meta.uploaded) return;
      await handleDownload();
      return;
    }
    if (!meta.uploaded || e.shiftKey) {
      inputRef.current?.click();
      return;
    }
    await handleDownload();
  };

  const handleDelete = async () => {
    if (busy || !currentUser?.username || !meta.uploaded || courseArchived) return;
    const ok = await showConfirm(
      'Die hinterlegte Auswertungshilfe wirklich entfernen?',
      { title: 'Auswertungshilfe löschen', confirmLabel: 'Löschen', danger: true },
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteUserAuswertungshilfe(currentUser.username);
    } catch (err) {
      await showAlert(err?.message || 'Löschen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file || !currentUser?.username) return;
    setBusy(true);
    try {
      await uploadUserAuswertungshilfe(currentUser.username, file);
    } catch (err) {
      await showAlert(err?.message || 'Upload fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const label = meta.uploaded ? 'Eigene Auswertungshilfe' : 'Eigene Auswertungshilfe hochladen';
  const title = courseArchived && meta.uploaded
    ? 'Auswertungshilfe herunterladen'
    : meta.uploaded
    ? 'Auswertungshilfe herunterladen (Umschalttaste + Klick: neue Datei hochladen)'
    : 'Auswertungshilfe hochladen (PDF, DOC, DOCX, TXT, RTF, ODT)';

  if (courseArchived && !meta.loading && !meta.uploaded) {
    return null;
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={AUSWERTUNGSHILFE_ACCEPT}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden
        tabIndex={-1}
      />
      <div className="user-auswertungshilfe-actions">
        <button
          type="button"
          className="tab secondary user-auswertungshilfe-btn"
          onClick={handleClick}
          disabled={busy || meta.loading}
          title={title}
        >
          {busy ? 'Bitte warten…' : label}
        </button>
        {meta.uploaded && !courseArchived ? (
          <button
            type="button"
            className="danger secondary user-auswertungshilfe-delete-btn"
            onClick={handleDelete}
            disabled={busy || meta.loading}
            title="Hinterlegte Auswertungshilfe entfernen"
            aria-label="Hinterlegte Auswertungshilfe entfernen"
          >
            <Trash2 size={16} strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
      </div>
    </>
  );
}
