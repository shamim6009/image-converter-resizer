import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  ImageOff,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import type { ImageStatus, ProcessSettings, ProcessedResult, SourceAsset } from '../types/image';
import {
  formatBytes,
  formatDimensions,
  getOutputFormat,
  sizeChangePercent,
} from '../lib/formats';
import { CompareSlider } from './CompareSlider';

interface ComparisonPanelProps {
  source: SourceAsset | null;
  result: ProcessedResult | null;
  status: ImageStatus;
  error: string | null;
  settings: ProcessSettings;
  batchRunning: boolean;
  onDownload: (result: ProcessedResult) => void;
  onRetry: () => void;
}

function StatusPill({ status }: { status: ImageStatus }) {
  const label =
    status === 'processing'
      ? 'Processing'
      : status === 'completed'
        ? 'Completed'
        : status === 'failed'
          ? 'Failed'
          : status === 'canceled'
            ? 'Canceled'
            : 'Ready';
  return <span className={`status-pill status-${status}`}>{label}</span>;
}

function SizeBadge({ originalSize, outputSize }: { originalSize: number; outputSize: number }) {
  const change = sizeChangePercent(originalSize, outputSize);
  if (change === null) return null;
  const absolute = Math.abs(change);
  const rounded = absolute < 0.05 ? 0 : absolute;
  if (rounded === 0) {
    return <span className="size-badge neutral">Same size</span>;
  }
  const smaller = change < 0;
  return (
    <span className={`size-badge ${smaller ? 'smaller' : 'larger'}`}>
      {smaller ? null : <ArrowUpRight size={13} aria-hidden="true" />}
      {rounded.toFixed(1)}% {smaller ? 'smaller' : 'larger'}
    </span>
  );
}

export function ComparisonPanel({
  source,
  result,
  status,
  error,
  settings,
  batchRunning,
  onDownload,
  onRetry,
}: ComparisonPanelProps) {
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [result?.previewUrl]);

  if (!source) {
    return (
      <section className="comparison-panel empty-preview" aria-labelledby="preview-title">
        <div className="empty-visual" aria-hidden="true">
          <span className="empty-icon-large">
            <UploadCloud size={34} />
          </span>
          <span className="empty-float empty-float-one" />
          <span className="empty-float empty-float-two" />
        </div>
        <h2 id="preview-title">Your live preview appears here</h2>
        <p>
          Upload an image above to compare the original with the real processed output. Choose a format,
          resize, and download when it looks right.
        </p>
        <ul className="empty-points">
          <li>
            <ShieldCheck size={15} aria-hidden="true" /> Real encoded preview
          </li>
          <li>
            <Sparkles size={15} aria-hidden="true" /> Live settings updates
          </li>
          <li>
            <CheckCircle2 size={15} aria-hidden="true" /> Download-ready output
          </li>
        </ul>
      </section>
    );
  }

  const targetFormat = getOutputFormat(result?.format ?? settings.format);
  const previewLabel = targetFormat.label;

  return (
    <section className="comparison-panel" aria-labelledby="preview-title">
      <div className="comparison-head">
        <div>
          <span className="section-kicker">Real output preview</span>
          <h2 id="preview-title">Original vs. processed</h2>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="comparison-grid">
        <article className="image-panel original-panel" aria-labelledby="original-heading">
          <div className="image-panel-top">
            <span className="panel-tag">Original</span>
            <span className="format-badge">{source.format.label}</span>
          </div>
          <div className="image-frame checkerboard">
            <img src={source.thumbnailUrl} alt={`Original preview of ${source.name}`} loading="lazy" />
          </div>
          <div className="image-meta">
            <h3 id="original-heading" title={source.name}>
              {source.name}
            </h3>
            <dl>
              <div>
                <dt>Format</dt>
                <dd>{source.format.label}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(source.size)}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>{formatDimensions(source.width, source.height)}</dd>
              </div>
            </dl>
          </div>
          {source.frameNotice ? (
            <div className="frame-notice">
              <Info size={15} aria-hidden="true" />
              {source.frameNotice}
            </div>
          ) : null}
        </article>

        <article className="image-panel processed-panel" aria-labelledby="processed-heading">
          <div className="image-panel-top">
            <span className="panel-tag accent">Processed</span>
            <span className="format-badge accent">{previewLabel}</span>
          </div>

          <div className="image-frame checkerboard">
            {status === 'processing' ? (
              <div className="preview-loading" role="status">
                <Loader2 className="spin" size={27} aria-hidden="true" />
                <span>Encoding {previewLabel}…</span>
              </div>
            ) : result && !previewFailed ? (
              <img
                key={result.previewUrl}
                src={result.previewUrl}
                alt={`Processed preview as ${previewLabel}`}
                onError={() => setPreviewFailed(true)}
              />
            ) : result && previewFailed ? (
              <div className="preview-error">
                <ImageOff size={28} aria-hidden="true" />
                <strong>Preview unavailable</strong>
                <span>
                  Your browser cannot display this format inline, but the file was encoded successfully
                  and can still be downloaded.
                </span>
              </div>
            ) : status === 'failed' ? (
              <div className="preview-error">
                <ImageOff size={28} aria-hidden="true" />
                <strong>Could not process this image</strong>
                <span>{error ?? 'The conversion failed. Try different settings.'}</span>
                <button type="button" className="button button-secondary small" onClick={onRetry}>
                  <RefreshCw size={15} aria-hidden="true" />
                  Retry
                </button>
              </div>
            ) : status === 'canceled' ? (
              <div className="preview-idle">
                <Info size={26} aria-hidden="true" />
                <strong>Processing canceled</strong>
                <span>Change a setting or retry to create a fresh preview.</span>
                <button type="button" className="button button-secondary small" onClick={onRetry}>
                  <RefreshCw size={15} aria-hidden="true" />
                  Retry
                </button>
              </div>
            ) : (
              <div className="preview-idle">
                <Loader2 size={25} aria-hidden="true" />
                <strong>Preparing preview</strong>
                <span>Your processed image will appear here automatically.</span>
              </div>
            )}
          </div>

          <div className="image-meta">
            <h3 id="processed-heading" title={result?.filename ?? `Output .${targetFormat.extension}`}>
              {result?.filename ?? `${source.baseName}.${targetFormat.extension}`}
            </h3>
            <dl>
              <div>
                <dt>Format</dt>
                <dd>{previewLabel}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{result ? formatBytes(result.size) : '—'}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>{result ? formatDimensions(result.width, result.height) : '—'}</dd>
              </div>
            </dl>
            {result ? <SizeBadge originalSize={source.size} outputSize={result.size} /> : null}
          </div>

          <div className="processed-actions">
            <button
              type="button"
              className="button button-primary download-button"
              disabled={!result}
              onClick={() => result && onDownload(result)}
            >
              <Download size={17} aria-hidden="true" />
              {result ? `Download ${previewLabel}` : 'Waiting for output'}
            </button>
            <span className="output-note">
              <ShieldCheck size={14} aria-hidden="true" />
              Preview and download use the same encoded file.
            </span>
          </div>
        </article>
      </div>

      {result && !previewFailed ? (
        <div className="compare-block">
          <div className="compare-heading">
            <div>
              <h3>Before / after slider</h3>
              <p>Drag the handle to inspect the processed result against the original.</p>
            </div>
            <span className="compare-hint">Drag to compare</span>
          </div>
          <CompareSlider
            originalUrl={source.thumbnailUrl}
            processedUrl={result.previewUrl}
            originalAlt={`Original ${source.name}`}
            processedAlt={`Processed ${result.filename}`}
          />
        </div>
      ) : null}

      {error && status === 'failed' && !batchRunning ? (
        <p className="comparison-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
