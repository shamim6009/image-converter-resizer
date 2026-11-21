import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { FileImage, FolderOpen, Loader2, Plus, UploadCloud, X } from 'lucide-react';
import { INPUT_ACCEPT, MAX_FILES, MAX_FILE_SIZE, formatBytes } from '../lib/formats';
import type { ImportProgress } from '../hooks/useImageWorkspace';
import type { SourceAsset } from '../types/image';

interface UploadZoneProps {
  onFiles: (files: FileList | File[]) => void;
  isImporting: boolean;
  importProgress: ImportProgress | null;
  sources: SourceAsset[];
  activeId: string | null;
  locked: boolean;
  onActivate: (id: string) => void;
  onRemove: (id: string) => void;
}

function hasFiles(event: { dataTransfer: DataTransfer | null }): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

export function UploadZone({
  onFiles,
  isImporting,
  importProgress,
  sources,
  activeId,
  locked,
  onActivate,
  onRemove,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onFilesRef = useRef(onFiles);
  const [dragging, setDragging] = useState(false);
  const hasImages = sources.length > 0;

  onFilesRef.current = onFiles;

  // Files can be dropped anywhere on the page, not only on the upload box.
  useEffect(() => {
    let depth = 0;

    const onDragEnter = (event: globalThis.DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onDragOver = (event: globalThis.DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (event: globalThis.DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: globalThis.DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) onFilesRef.current(files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const openPicker = () => inputRef.current?.click();

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  // The window listeners above do the work; this only shows the copy cursor.
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const percent =
    importProgress && importProgress.total > 0
      ? Math.round((importProgress.done / importProgress.total) * 100)
      : 0;

  return (
    <section className="upload-section" aria-labelledby="upload-title">
      <div
        className={`upload-zone ${dragging ? 'is-dragging' : ''} ${hasImages ? 'has-images' : ''}`}
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        aria-label="Upload images. Drag and drop files here or press Enter to browse."
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept={INPUT_ACCEPT}
          multiple
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            if (event.target.files?.length) onFiles(event.target.files);
            event.target.value = '';
          }}
          tabIndex={-1}
        />

        <div className="upload-main">
          <div className="upload-visual" aria-hidden="true">
            {isImporting ? (
              <Loader2 className="spin" size={30} />
            ) : hasImages ? (
              <Plus size={30} />
            ) : (
              <UploadCloud size={32} />
            )}
          </div>

          <div className="upload-copy">
            <h2 id="upload-title">
              {isImporting
                ? 'Adding your images…'
                : dragging
                  ? 'Drop images to add them'
                  : hasImages
                    ? 'Add more images'
                    : 'Drop images here or click to browse'}
            </h2>
            <p>
              {hasImages
                ? 'Drag and drop anywhere on the page, or browse. Your current settings are kept.'
                : 'Upload one image or a whole batch. Files are decoded and processed locally.'}
            </p>
            <div className="upload-actions">
              <span className="fake-button">
                <FolderOpen size={17} aria-hidden="true" />
                Browse files
              </span>
              <span className="upload-limit">
                <FileImage size={15} aria-hidden="true" />
                Up to {MAX_FILES} images · {formatBytes(MAX_FILE_SIZE)} each
              </span>
            </div>
            <p className="format-support">
              JPG · PNG · WebP · AVIF · GIF · BMP · SVG · ICO · TIFF · HEIC/HEIF
            </p>
          </div>
        </div>

        {hasImages ? (
          <div className="upload-previews" onClick={(event) => event.stopPropagation()}>
            <div className="upload-previews-head">
              <span>
                Uploaded images <strong>{sources.length}</strong>
              </span>
              <span className="upload-previews-hint">Click a photo to preview it · × removes it</span>
            </div>
            <ul className="upload-preview-list">
              {sources.map((source) => (
                <li
                  key={source.id}
                  className={`upload-preview ${source.id === activeId ? 'is-active' : ''}`}
                >
                  <button
                    type="button"
                    className="upload-preview-thumb checkerboard"
                    onClick={() => onActivate(source.id)}
                    aria-label={`Preview ${source.name}`}
                    title={source.name}
                  >
                    <img src={source.thumbnailUrl} alt="" loading="lazy" />
                  </button>
                  <button
                    type="button"
                    className="upload-preview-remove"
                    onClick={() => onRemove(source.id)}
                    disabled={locked}
                    aria-label={`Remove ${source.name}`}
                    title="Remove image"
                  >
                    <X size={13} strokeWidth={3} aria-hidden="true" />
                  </button>
                  <span className="upload-preview-name">{source.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {isImporting && importProgress ? (
          <div className="upload-progress" aria-live="polite">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.max(4, percent)}%` }} />
            </div>
            <span>
              {importProgress.done} of {importProgress.total}
              {importProgress.currentName ? ` · ${importProgress.currentName}` : ''}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
