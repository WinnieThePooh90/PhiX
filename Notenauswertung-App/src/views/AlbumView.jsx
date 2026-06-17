import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/DataContext';
import { useDialog } from '../components/PhixDialog';

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/gif,image/webp';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function photoSrc(photo) {
  if (!photo?.imageData) return '';
  const mime = photo.mimeType || 'image/jpeg';
  if (String(photo.imageData).startsWith('data:')) return photo.imageData;
  return `data:${mime};base64,${photo.imageData}`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const match = /^data:[^;]+;base64,(.+)$/i.exec(result);
      resolve(match ? match[1] : result);
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

function AlbumUploadModal({ open, onClose, onUpload, uploading }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setFile(null);
    setFileError('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !uploading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, uploading]);

  if (!open) return null;

  const handleFileChange = (e) => {
    const next = e.target.files?.[0] ?? null;
    setFileError('');
    if (!next) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.split(',').includes(next.type)) {
      setFile(null);
      setFileError('Nur JPEG, PNG, GIF oder WebP.');
      return;
    }
    if (next.size > MAX_IMAGE_BYTES) {
      setFile(null);
      setFileError('Datei zu groß (max. 8 MB).');
      return;
    }
    setFile(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setFileError('Bitte einen Titel eingeben.');
      return;
    }
    if (!file) {
      setFileError('Bitte eine Bilddatei wählen.');
      return;
    }
    try {
      const imageData = await readFileAsBase64(file);
      await onUpload({
        title: title.trim(),
        description: description.trim(),
        mimeType: file.type,
        imageData,
      });
      onClose();
    } catch (err) {
      setFileError(err?.message || 'Upload fehlgeschlagen.');
    }
  };

  return createPortal(
    <div className="oral-formula-modal-backdrop" role="presentation" onClick={uploading ? undefined : onClose}>
      <div
        className="oral-formula-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-upload-modal-title"
        onClick={(ev) => ev.stopPropagation()}
        style={{ maxWidth: 'min(28rem, calc(100vw - 2rem))' }}
      >
        <div className="oral-formula-modal-header">
          <h2 id="album-upload-modal-title" style={{ margin: 0 }}>
            Foto hochladen
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="oral-formula-modal-body" style={{ display: 'grid', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Titel</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              autoFocus
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Datei</span>
            <input
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Beschreibung</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
            />
          </label>
          {fileError ? (
            <p style={{ margin: 0, color: 'var(--danger)' }} role="alert">
              {fileError}
            </p>
          ) : null}
          <div className="oral-formula-modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={uploading}>
              Abbrechen
            </button>
            <button type="submit" disabled={uploading}>
              {uploading ? 'Wird hochgeladen…' : 'Hochladen'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function AlbumView() {
  const { albumPhotos, addAlbumPhoto, removeAlbumPhoto } = useData();
  const { showAlert, showConfirm } = useDialog();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (payload) => {
    setUploading(true);
    try {
      const created = await addAlbumPhoto(payload);
      if (!created?.id) {
        await showAlert('Das Foto konnte nicht gespeichert werden.');
      }
    } catch (err) {
      await showAlert(err?.message || 'Upload fehlgeschlagen.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (photo) => {
    if (!photo?.id) return;
    const ok = await showConfirm(`„${photo.title || 'Foto'}“ aus dem Album entfernen?`, {
      title: 'Foto entfernen',
      confirmLabel: 'Entfernen',
      danger: true,
    });
    if (!ok) return;
    await removeAlbumPhoto(photo.id);
  };

  return (
    <div className="album-view">
      <div className="album-view-header">
        <h1 style={{ margin: 0 }}>Album</h1>
        <button type="button" onClick={() => setUploadOpen(true)}>
          Hochladen
        </button>
      </div>

      {albumPhotos.length === 0 ? (
        <p className="album-view-empty">Noch keine Fotos im Album. Klicke auf „Hochladen“, um ein Foto hinzuzufügen.</p>
      ) : (
        <div className="album-photo-grid">
          {albumPhotos.map((photo) => (
            <article key={photo.id} className="album-photo-card">
              <div className="album-photo-card-head">
                <h2 className="album-photo-title">{photo.title || 'Ohne Titel'}</h2>
                <button
                  type="button"
                  className="album-photo-remove danger"
                  onClick={() => handleRemove(photo)}
                  title="Foto entfernen"
                  aria-label="Foto entfernen"
                >
                  Entfernen
                </button>
              </div>
              <div className="album-photo-image-wrap">
                <img src={photoSrc(photo)} alt={photo.title || 'Albumfoto'} loading="lazy" />
              </div>
              {photo.description ? (
                <p className="album-photo-description">{photo.description}</p>
              ) : (
                <p className="album-photo-description album-photo-description--empty">Keine Beschreibung</p>
              )}
            </article>
          ))}
        </div>
      )}

      <AlbumUploadModal
        open={uploadOpen}
        onClose={() => !uploading && setUploadOpen(false)}
        onUpload={handleUpload}
        uploading={uploading}
      />
    </div>
  );
}
