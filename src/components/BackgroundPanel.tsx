import { Eraser, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import type { BackgroundJob, SourceAsset } from '../types/image';

interface BackgroundPanelProps {
  sources: SourceAsset[];
  activeSource: SourceAsset | null;
  selectedIds: Set<string>;
  job: BackgroundJob;
  disabled: boolean;
  onRemove: (ids: string[]) => void;
  onCancel: () => void;
}

export function BackgroundPanel({
  sources,
  activeSource,
  selectedIds,
  job,
  disabled,
  onRemove,
  onCancel,
}: BackgroundPanelProps) {
  const pending = sources.filter((source) => !source.backgroundRemoved);
  const pendingSelected = pending.filter((source) => selectedIds.has(source.id));
  const activePending = activeSource && !activeSource.backgroundRemoved ? activeSource : null;
  const overall =
    job.total > 0 ? Math.round(((job.done + job.percent / 100) / job.total) * 100) : 0;

  return (
    <section className="background-panel" aria-labelledby="background-title">
      <div className="bulk-head">
        <div>
          <span className="section-kicker">AI cut-out</span>
          <h2 id="background-title">
            <Eraser size={19} aria-hidden="true" />
            Background Remover
          </h2>
        </div>
        <span className="background-privacy">
          <ShieldCheck size={15} aria-hidden="true" />
          Runs on your device
        </span>
      </div>

      {job.running ? (
        <div className="job-progress" aria-live="polite">
          <div className="job-progress-text">
            <span>
              <Loader2 className="spin" size={16} aria-hidden="true" />
              {job.stage === 'model'
                ? `Downloading the AI model… ${job.percent}%`
                : `Removing background ${Math.min(job.done + 1, job.total)} of ${job.total}`}
            </span>
            <span>{job.currentName}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(4, overall)}%` }} />
          </div>
          {job.total > 1 ? (
            <div className="job-actions">
              <button type="button" className="button button-secondary small" onClick={onCancel}>
                <XCircle size={16} aria-hidden="true" />
                Stop after this image
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="bulk-actions">
        <button
          type="button"
          className="button button-primary"
          disabled={disabled || !activePending}
          onClick={() => activePending && onRemove([activePending.id])}
        >
          <Eraser size={17} aria-hidden="true" />
          Remove from previewed image
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={disabled || pendingSelected.length === 0}
          onClick={() => onRemove(pendingSelected.map((source) => source.id))}
        >
          Remove from selected ({pendingSelected.length})
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={disabled || pending.length === 0}
          onClick={() => onRemove(pending.map((source) => source.id))}
        >
          Remove from all ({pending.length})
        </button>
      </div>

      <p className="bulk-hint">
        {sources.length === 0
          ? 'Upload an image above, then remove its background in one click.'
          : 'The cut-out replaces the original as a transparent PNG. Pick a background colour in the settings, or keep it transparent with PNG, WebP or AVIF output. The first run downloads the AI model (about 40 MB), so it takes longer.'}
      </p>
    </section>
  );
}
