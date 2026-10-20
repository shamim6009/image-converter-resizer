import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Download,
  Eye,
  ImageOff,
  Loader2,
  Trash2,
} from 'lucide-react';
import type {
  ImageStatus,
  OutputFormatInfo,
  ProcessedResult,
  SourceAsset,
} from '../types/image';
import { formatBytes, formatDimensions, sizeChangePercent } from '../lib/formats';

interface ImageCardProps {
  source: SourceAsset;
  result: ProcessedResult | null;
  status: ImageStatus;
  error: string | null;
  targetFormat: OutputFormatInfo;
  active: boolean;
  selected: boolean;
  locked: boolean;
  onActivate: () => void;
  onToggleSelected: () => void;
  onRemove: () => void;
  onDownload: (result: ProcessedResult) => void;
}

const STATUS_LABELS: Record<ImageStatus, string> = {
  ready: 'Ready',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  canceled: 'Canceled',
};

export function ImageCard({
  source,
  result,
  status,
  error,
  targetFormat,
  active,
  selected,
  locked,
  onActivate,
  onToggleSelected,
  onRemove,
  onDownload,
}: ImageCardProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const previewUrl = result?.previewUrl ?? source.thumbnailUrl;

  useEffect(() => {
    setThumbnailFailed(false);
  }, [previewUrl]);

  const change = result ? sizeChangePercent(source.size, result.size) : null;

  return (
    <article
      className={`image-card ${active ? 'is-active' : ''} status-card-${status}`}
      aria-labelledby={`${source.id}-title`}
    >
      <div className="card-selection">
        <label className="checkbox-label" title={selected ? 'Deselect image' : 'Select image'}>
          <input
            type="checkbox"
            checked={selected}
            disabled={locked}
            onChange={onToggleSelected}
            aria-label={`Select ${source.name}`}
          />
          <span aria-hidden="true">{selected ? <Check size={12} strokeWidth={3} /> : null}</span>
        </label>
      </div>

      <button
        type="button"
        className="card-thumb-button"
        onClick={onActivate}
        aria-label={`Preview ${source.name}`}
        aria-pressed={active}
      >
        <span className="card-thumb checkerboard">
          {thumbnailFailed ? (
            <span className="thumb-fallback">
              <ImageOff size={25} aria-hidden="true" />
              {source.format.label}
            </span>
          ) : (
            <img
              src={previewUrl}
              alt=""
              loading="lazy"
              onError={() => setThumbnailFailed(true)}
            />
          )}
          {status === 'processing' ? (
            <span className="thumb-overlay">
              <Loader2 className="spin" size={22} aria-hidden="true" />
            </span>
          ) : null}
          {active ? (
            <span className="active-marker">
              <Eye size={13} aria-hidden="true" />
              Previewing
            </span>
          ) : null}
        </span>
      </button>

      <div className="card-body">
        <div className="card-title-row">
          <h3 id={`${source.id}-title`} title={source.name}>
            {source.name}
          </h3>
          <span className={`format-chip ${result ? 'is-output' : ''}`}>
            {result ? targetFormat.label : source.format.label}
          </span>
        </div>

        <div className="card-facts">
          <div>
            <span>Original</span>
            <strong>
              {formatDimensions(source.width, source.height)} · {formatBytes(source.size)}
            </strong>
          </div>
          <div>
            <span>{result ? 'Output' : 'Target'}</span>
            <strong>
              {result
                ? `${formatDimensions(result.width, result.height)} · ${formatBytes(result.size)}`
                : `${targetFormat.label} · .${targetFormat.extension}`}
            </strong>
          </div>
        </div>

        <div className="card-status-row">
          <span className={`status-pill status-${status}`}>
            {status === 'processing' ? <Loader2 className="spin" size={11} aria-hidden="true" /> : null}
            {STATUS_LABELS[status]}
          </span>
          {change !== null ? (
            <span className={`mini-size-change ${change <= 0 ? 'smaller' : 'larger'}`}>
              {Math.abs(change).toFixed(1)}% {change <= 0 ? 'smaller' : 'larger'}
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="card-error" title={error}>
            <AlertCircle size={13} aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </div>

      <div className="card-actions">
        <button
          type="button"
          className="card-action download"
          disabled={!result}
          onClick={() => result && onDownload(result)}
          aria-label={result ? `Download ${result.filename}` : `No download available for ${source.name}`}
          title={result ? `Download ${result.filename}` : 'Process the image to enable download'}
        >
          <Download size={15} aria-hidden="true" />
          <span>Download</span>
        </button>
        <button
          type="button"
          className="card-action remove"
          onClick={onRemove}
          disabled={locked}
          aria-label={`Remove ${source.name}`}
          title="Remove image"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
