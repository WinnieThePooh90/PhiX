import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { useDialog } from './PhixDialog';
import {
  AUSWERTUNGSHILFE_ACCEPT,
  fetchUserAuswertungshilfeMeta,
  openOrDownloadUserAuswertungshilfe,
  subscribeUserAuswertungshilfe,
  uploadUserAuswertungshilfe,
} from '../utils/userAuswertungshilfeApi';

export default function UserAuswertungshilfeButton() {
  const { currentUser } = useAuth();
  const { showAlert } = useDialog();
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

  const handleClick = async (e) => {
    if (busy || meta.loading || !currentUser?.username) return;
    if (!meta.uploaded || e.shiftKey) {
      inputRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      await openOrDownloadUserAuswertungshilfe(currentUser.username, meta.fileName);
    } catch (err) {
      await showAlert(err?.message || 'Datei konnte nicht geöffnet werden.');
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
  const title = meta.uploaded
    ? 'Auswertungshilfe öffnen (Umschalttaste + Klick: neue Datei hochladen)'
    : 'Auswertungshilfe hochladen (PDF, DOC, DOCX, TXT, RTF, ODT)';

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
      <button
        type="button"
        className="tab secondary user-auswertungshilfe-btn"
        onClick={handleClick}
        disabled={busy || meta.loading}
        title={title}
      >
        {busy ? 'Bitte warten…' : label}
      </button>
    </>
  );
}
