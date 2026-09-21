import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Trash2, Wrench } from 'lucide-react';
import { useData } from '../store/DataContext';
import { useDialog } from '../components/PhixDialog';

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/gif,image/webp';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const PREVIEW_MIN_ZOOM = 1;
const PREVIEW_MAX_ZOOM = 4;
const PREVIEW_ZOOM_STEP = 0.25;

function clampPreviewZoom(value) {
  return Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, value));
}

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

function AlbumPhotoPreviewModal({ photo, onClose }) {
  const { fetchAlbumPhotoImage, photoImageCache } = useData();
  const [zoom, setZoom] = useState(PREVIEW_MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgData, setImgData] = useState(photo?.imageData || photoImageCache[photo?.id]?.imageData || '');
  const [mimeType, setMimeType] = useState(photo?.mimeType || photoImageCache[photo?.id]?.mimeType || 'image/jpeg');
  const [loading, setLoading] = useState(!photo?.imageData && !photoImageCache[photo?.id]?.imageData);
  const dragRef = useRef(null);
  const viewportRef = useRef(null);

  const resetView = useCallback(() => {
    setZoom(PREVIEW_MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!photo) return;
    resetView();
    if (photo.imageData) {
      setImgData(photo.imageData);
      setMimeType(photo.mimeType || 'image/jpeg');
      setLoading(false);
      return;
    }
    const cached = photoImageCache[photo.id];
    if (cached?.imageData) {
      setImgData(cached.imageData);
      setMimeType(cached.mimeType || photo.mimeType || 'image/jpeg');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchAlbumPhotoImage(photo.id).then((res) => {
      if (cancelled) return;
      if (res?.imageData) {
        setImgData(res.imageData);
        setMimeType(res.mimeType || photo.mimeType || 'image/jpeg');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [photo, photoImageCache, fetchAlbumPhotoImage, resetView]);

  useEffect(() => {
    if (!photo) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [photo, onClose]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!photo || !viewport) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      setZoom((prev) => {
        const next = clampPreviewZoom(prev + direction * PREVIEW_ZOOM_STEP);
        if (next <= PREVIEW_MIN_ZOOM) setOffset({ x: 0, y: 0 });
        return next;
      });
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [photo]);

  if (!photo) return null;

  const src = photoSrc({ imageData: imgData, mimeType });
  const canPan = zoom > PREVIEW_MIN_ZOOM;

  const handlePointerDown = (e) => {
    if (!canPan || e.button !== 0) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    });
  };

  const handlePointerEnd = (e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const zoomIn = () => {
    setZoom((prev) => clampPreviewZoom(prev + PREVIEW_ZOOM_STEP));
  };

  const zoomOut = () => {
    setZoom((prev) => {
      const next = clampPreviewZoom(prev - PREVIEW_ZOOM_STEP);
      if (next <= PREVIEW_MIN_ZOOM) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  return createPortal(
    <div
      className="album-preview-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="album-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="album-preview-header">
          <div className="album-preview-header-text">
            <h2 id="album-preview-title" className="album-preview-title">
              {photo.title || 'Ohne Titel'}
            </h2>
            {photo.description ? (
              <p className="album-preview-description">{photo.description}</p>
            ) : null}
          </div>
          <div className="album-preview-toolbar">
            <button type="button" className="tab secondary" onClick={zoomOut} disabled={zoom <= PREVIEW_MIN_ZOOM} aria-label="Verkleinern">
              −
            </button>
            <span className="album-preview-zoom-label" aria-live="polite">
              {Math.round(zoom * 100)} %
            </span>
            <button type="button" className="tab secondary" onClick={zoomIn} disabled={zoom >= PREVIEW_MAX_ZOOM} aria-label="Vergrößern">
              +
            </button>
            <button type="button" className="tab secondary" onClick={resetView} disabled={zoom <= PREVIEW_MIN_ZOOM && offset.x === 0 && offset.y === 0}>
              Zurücksetzen
            </button>
            <button type="button" className="tab secondary" onClick={onClose}>
              Schließen
            </button>
          </div>
        </div>
        <div
          ref={viewportRef}
          className={`album-preview-viewport${canPan ? ' album-preview-viewport--pannable' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {loading ? (
            <div style={{ color: '#fff', padding: '2rem', textAlign: 'center' }}>
              Bild wird geladen…
            </div>
          ) : (
            <img
              src={src}
              alt={photo.title || 'Albumfoto'}
              className="album-preview-image"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              }}
              draggable={false}
            />
          )}
        </div>
        <p className="album-preview-hint">Mausrad zum Zoomen · bei Vergrößerung ziehen zum Verschieben</p>
      </div>
    </div>,
    document.body,
  );
}

function AlbumPhotoCard({
  photo,
  courseArchived,
  onEdit,
  onRemove,
  onPreview,
  fetchAlbumPhotoImage,
  photoImageCache,
}) {
  const cached = photoImageCache[photo.id];
  const [loading, setLoading] = useState(!photo.imageData && !cached?.imageData);
  const [imgData, setImgData] = useState(photo.imageData || cached?.imageData || '');
  const [mimeType, setMimeType] = useState(photo.mimeType || cached?.mimeType || 'image/jpeg');

  useEffect(() => {
    if (photo.imageData) {
      setImgData(photo.imageData);
      setMimeType(photo.mimeType || 'image/jpeg');
      setLoading(false);
      return;
    }
    if (cached?.imageData) {
      setImgData(cached.imageData);
      setMimeType(cached.mimeType || photo.mimeType || 'image/jpeg');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchAlbumPhotoImage(photo.id).then((res) => {
      if (cancelled) return;
      if (res?.imageData) {
        setImgData(res.imageData);
        setMimeType(res.mimeType || photo.mimeType || 'image/jpeg');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [photo.id, photo.imageData, photo.mimeType, cached, fetchAlbumPhotoImage]);

  const fullPhoto = { ...photo, imageData: imgData, mimeType };

  return (
    <article className="album-photo-card">
      <div className="album-photo-card-head">
        <h2 className="album-photo-title">{photo.title || 'Ohne Titel'}</h2>
        {!courseArchived ? (
          <div className="album-photo-actions">
            <button
              type="button"
              className="tab secondary album-photo-icon-btn"
              onClick={() => onEdit(fullPhoto)}
              title="Titel und Beschreibung bearbeiten"
              aria-label={`Bearbeiten: ${photo.title || 'Albumfoto'}`}
            >
              <Wrench size={16} strokeWidth={2.25} aria-hidden />
            </button>
            <button
              type="button"
              className="danger secondary album-photo-icon-btn"
              onClick={() => onRemove(photo)}
              title="Foto entfernen"
              aria-label={`Foto entfernen: ${photo.title || 'Albumfoto'}`}
            >
              <Trash2 size={16} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="album-photo-image-wrap course-archived-allow"
        onClick={() => onPreview(fullPhoto)}
        aria-label={`${photo.title || 'Albumfoto'} vergrößern`}
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '140px', color: 'var(--text-muted, #888)', fontSize: '0.9rem' }}>
            Lädt…
          </div>
        ) : (
          <img src={photoSrc(fullPhoto)} alt="" loading="lazy" />
        )}
      </button>
      {photo.description ? (
        <p className="album-photo-description">{photo.description}</p>
      ) : (
        <p className="album-photo-description album-photo-description--empty">Keine Beschreibung</p>
      )}
    </article>
  );
}

function AlbumPhotoEditModal({ photo, open, onClose, onSave, saving }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !photo) return;
    setTitle(photo.title ?? '');
    setDescription(photo.description ?? '');
    setError('');
  }, [open, photo]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, saving]);

  if (!open || !photo) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Bitte einen Titel eingeben.');
      return;
    }
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Speichern fehlgeschlagen.');
    }
  };

  return createPortal(
    <div className="oral-formula-modal-backdrop" role="presentation" onClick={saving ? undefined : onClose}>
      <div
        className="oral-formula-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="album-edit-modal-title"
        onClick={(ev) => ev.stopPropagation()}
        style={{ maxWidth: 'min(28rem, calc(100vw - 2rem))' }}
      >
        <div className="oral-formula-modal-header">
          <h2 id="album-edit-modal-title" style={{ margin: 0 }}>
            Foto bearbeiten
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="oral-formula-modal-body" style={{ display: 'grid', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Titel</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Beschreibung</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </label>
          {error ? (
            <p style={{ margin: 0, color: 'var(--danger)' }} role="alert">
              {error}
            </p>
          ) : null}
          <div className="oral-formula-modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={saving}>
              Abbrechen
            </button>
            <button type="submit" disabled={saving}>
              {saving ? 'Wird gespeichert…' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
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
  const {
    albumPhotos,
    albumPhotosLoading,
    loadAlbumPhotos,
    fetchAlbumPhotoImage,
    photoImageCache,
    addAlbumPhoto,
    updateAlbumPhoto,
    removeAlbumPhoto,
    courseArchived,
    activeCourseId,
  } = useData();
  const { showAlert, showConfirm } = useDialog();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photosVisible, setPhotosVisible] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [editPhoto, setEditPhoto] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadAlbumPhotos(activeCourseId);
  }, [activeCourseId, loadAlbumPhotos]);

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
    if (previewPhoto?.id === photo.id) setPreviewPhoto(null);
    if (editPhoto?.id === photo.id) setEditPhoto(null);
  };

  const handleEditSave = async (payload) => {
    if (!editPhoto?.id) return;
    setSavingEdit(true);
    try {
      const updated = await updateAlbumPhoto(editPhoto.id, payload);
      if (!updated?.id) {
        await showAlert('Die Änderungen konnten nicht gespeichert werden.');
        return;
      }
      if (previewPhoto?.id === editPhoto.id) {
        setPreviewPhoto((prev) => (prev ? { ...prev, ...updated } : null));
      }
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    if (albumPhotos.length === 0) {
      setPhotosVisible(false);
    }
  }, [albumPhotos.length]);

  const hasPhotos = albumPhotos.length > 0;

  return (
    <div className="album-view view-generic-scroll">
      <div className="album-view-header">
        <h1 style={{ margin: 0 }}>Album</h1>
        <div className="album-view-actions">
          <button type="button" onClick={() => setUploadOpen(true)}>
            Hochladen
          </button>
          {hasPhotos ? (
            <button
              type="button"
              className="tab secondary album-visibility-btn"
              onClick={() => setPhotosVisible((prev) => !prev)}
              title={photosVisible ? 'Bilder ausblenden' : 'Bilder anzeigen'}
              aria-label={photosVisible ? 'Bilder ausblenden' : 'Bilder anzeigen'}
            >
              {photosVisible ? <EyeOff size={16} strokeWidth={2.2} aria-hidden /> : <Eye size={16} strokeWidth={2.2} aria-hidden />}
            </button>
          ) : null}
        </div>
      </div>

      {albumPhotosLoading && albumPhotos.length === 0 ? (
        <p className="album-view-empty">Album wird geladen…</p>
      ) : !hasPhotos ? (
        <p className="album-view-empty">Noch keine Fotos im Album. Klicke auf „Hochladen“, um ein Foto hinzuzufügen.</p>
      ) : !photosVisible ? (
        <div className="album-photo-placeholder" role="status" aria-live="polite">
          <EyeOff size={36} strokeWidth={2.1} aria-hidden />
        </div>
      ) : (
        <div className="album-photo-grid">
          {albumPhotos.map((photo) => (
            <AlbumPhotoCard
              key={photo.id}
              photo={photo}
              courseArchived={courseArchived}
              onEdit={(p) => setEditPhoto(p)}
              onRemove={handleRemove}
              onPreview={(p) => setPreviewPhoto(p)}
              fetchAlbumPhotoImage={fetchAlbumPhotoImage}
              photoImageCache={photoImageCache}
            />
          ))}
        </div>
      )}

      <AlbumUploadModal
        open={uploadOpen}
        onClose={() => !uploading && setUploadOpen(false)}
        onUpload={handleUpload}
        uploading={uploading}
      />

      <AlbumPhotoPreviewModal
        photo={previewPhoto}
        onClose={() => setPreviewPhoto(null)}
      />

      <AlbumPhotoEditModal
        photo={editPhoto}
        open={Boolean(editPhoto)}
        onClose={() => !savingEdit && setEditPhoto(null)}
        onSave={handleEditSave}
        saving={savingEdit}
      />
    </div>
  );
}
