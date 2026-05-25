import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const DialogContext = createContext(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog nur innerhalb von DialogProvider verwenden');
  return ctx;
}

export function DialogProvider({ children }) {
  const [dialogs, setDialogs] = useState([]);
  const idRef = useRef(0);

  const showConfirm = useCallback((message, { title = 'Bestätigung', confirmLabel = 'OK', cancelLabel = 'Abbrechen', danger = false } = {}) => {
    return new Promise((resolve) => {
      const id = ++idRef.current;
      setDialogs((prev) => [...prev, { id, type: 'confirm', title, message, confirmLabel, cancelLabel, danger, resolve }]);
    });
  }, []);

  const showAlert = useCallback((message, { title = 'Hinweis', confirmLabel = 'OK' } = {}) => {
    return new Promise((resolve) => {
      const id = ++idRef.current;
      setDialogs((prev) => [...prev, { id, type: 'alert', title, message, confirmLabel, resolve }]);
    });
  }, []);

  const dismiss = useCallback((id, result) => {
    setDialogs((prev) => {
      const d = prev.find((x) => x.id === id);
      if (d) d.resolve(result);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  return (
    <DialogContext.Provider value={{ showConfirm, showAlert }}>
      {children}
      {dialogs.map((d) => (
        <DialogModal key={d.id} dialog={d} onDismiss={dismiss} />
      ))}
    </DialogContext.Provider>
  );
}

function DialogModal({ dialog, onDismiss }) {
  const { id, type, title, message, confirmLabel, cancelLabel, danger } = dialog;
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onDismiss(id, type === 'confirm' ? false : undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, type, onDismiss]);

  return createPortal(
    <div className="modal-overlay phix-dialog-overlay" onClick={() => onDismiss(id, type === 'confirm' ? false : undefined)}>
      <div className="modal-card phix-dialog-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="phix-dialog-title">{title}</h2>
        <p className="phix-dialog-message">{message}</p>
        <div className="phix-dialog-actions">
          {type === 'confirm' && (
            <button
              type="button"
              className="btn phix-dialog-btn phix-dialog-btn--cancel"
              onClick={() => onDismiss(id, false)}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            className={`btn phix-dialog-btn phix-dialog-btn--confirm${danger ? ' phix-dialog-btn--danger' : ''}`}
            onClick={() => onDismiss(id, type === 'confirm' ? true : undefined)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
