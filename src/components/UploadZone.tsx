import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { FileImage, FolderOpen, Loader2, Plus, UploadCloud } from 'lucide-react';
import { INPUT_ACCEPT, MAX_FILES, MAX_FILE_SIZE, formatBytes } from '../lib/formats';
import type { ImportProgress } from '../hooks/useImageWorkspace';

interface UploadZoneProps {
  onFiles: (files: FileList | File[]) => void;
  isImporting: boolean;
  importProgress: ImportProgress | null;
  hasImages: boolean;
}

export function UploadZone({ onFiles, isImporting, importProgress, hasImages }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    setDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (event.dataTransfer.files.length > 0) {
      onFiles(event.dataTransfer.files);
    }
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
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label="Upload images. Drag and drop files here or press Enter to browse."
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept={INPUT_ACCEPT}
          multiple
          onChange={(event) => {
            if (event.target.files?.length) onFiles(event.target.files);
            event.target.value = '';
          }}
          tabIndex={-1}
        />

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
              ? 'Keep your current settings, then add more files to the batch.'
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
