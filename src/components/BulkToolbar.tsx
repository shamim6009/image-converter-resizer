import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  Layers3,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { BatchProgress, ZipProgress } from '../types/image';

interface BulkToolbarProps {
  sourceCount: number;
  selectedCount: number;
  processedCount: number;
  failedCount: number;
  batch: BatchProgress;
  zip: ZipProgress;
  importing: boolean;
  onProcessSelected: () => void;
  onCancel: () => void;
  onRetryFailed: () => void;
  onDownloadZip: () => void;
  onClearAll: () => void;
}

export function BulkToolbar({
  sourceCount,
  selectedCount,
  processedCount,
  failedCount,
  batch,
  zip,
  importing,
  onProcessSelected,
  onCancel,
  onRetryFailed,
  onDownloadZip,
  onClearAll,
}: BulkToolbarProps) {
  if (sourceCount === 0) return null;

  const busy = batch.running || zip.running;
  const batchPercent = batch.total > 0 ? Math.round((batch.done / batch.total) * 100) : 0;

  return (
    <section className="bulk-toolbar" aria-labelledby="bulk-title">
      <div className="bulk-head">
        <div>
          <span className="section-kicker">Export &amp; batch</span>
          <h2 id="bulk-title">
            <Layers3 size={19} aria-hidden="true" />
            Bulk processing
          </h2>
        </div>
        <div className="bulk-stats">
          <span className="stat success">
            <CheckCircle2 size={15} aria-hidden="true" />
            {processedCount} ready
          </span>
          <span className={`stat ${failedCount > 0 ? 'danger' : 'muted'}`}>
            <AlertTriangle size={15} aria-hidden="true" />
            {failedCount} failed
          </span>
          <span className="stat muted">
            <Layers3 size={15} aria-hidden="true" />
            {selectedCount} selected
          </span>
        </div>
      </div>

      {batch.running ? (
        <div className="job-progress" aria-live="polite">
          <div className="job-progress-text">
            <span>
              <Loader2 className="spin" size={16} aria-hidden="true" />
              Processing {batch.done} of {batch.total}
            </span>
            <span>
              {batch.succeeded} done · {batch.failed} failed
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(3, batchPercent)}%` }} />
          </div>
          <div className="job-actions">
            <button type="button" className="button button-secondary small" onClick={onCancel}>
              <XCircle size={16} aria-hidden="true" />
              Cancel job
            </button>
            <span className="job-note">Completed images stay available if you cancel.</span>
          </div>
        </div>
      ) : null}

      {zip.running ? (
        <div className="job-progress" aria-live="polite">
          <div className="job-progress-text">
            <span>
              <Loader2 className="spin" size={16} aria-hidden="true" />
              {zip.stage === 'preparing' ? 'Preparing images for the ZIP…' : 'Packaging ZIP archive…'}
            </span>
            {zip.stage === 'packaging' ? <span>{zip.percent}%</span> : null}
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${zip.stage === 'packaging' ? Math.max(4, zip.percent) : 6}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="bulk-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onProcessSelected}
          disabled={busy || importing || selectedCount === 0}
        >
          <Play size={17} aria-hidden="true" />
          Process selected ({selectedCount})
        </button>

        <button
          type="button"
          className="button button-secondary"
          onClick={onRetryFailed}
          disabled={busy || importing || failedCount === 0}
        >
          <RefreshCw size={17} aria-hidden="true" />
          Retry failed ({failedCount})
        </button>

        <button
          type="button"
          className="button button-primary zip-button"
          onClick={onDownloadZip}
          disabled={busy || importing}
        >
          <Archive size={18} aria-hidden="true" />
          <Download size={17} aria-hidden="true" />
          Download all as ZIP
        </button>

        <button
          type="button"
          className="button button-ghost danger"
          onClick={onClearAll}
          disabled={busy || importing}
        >
          <Trash2 size={17} aria-hidden="true" />
          Remove all
        </button>
      </div>

      <p className="bulk-hint">
        The ZIP contains every successfully processed image. Missing outputs are processed first, and failed
        files are skipped automatically.
      </p>
    </section>
  );
}
