import { CheckSquare, Square } from 'lucide-react';
import type {
  ImageStatus,
  OutputFormatInfo,
  ProcessedResult,
  SourceAsset,
} from '../types/image';
import { ImageCard } from './ImageCard';

interface ImageGridProps {
  sources: SourceAsset[];
  results: Record<string, ProcessedResult>;
  statuses: Record<string, ImageStatus>;
  errors: Record<string, string>;
  activeId: string | null;
  selectedIds: Set<string>;
  targetFormat: OutputFormatInfo;
  allSelected: boolean;
  locked: boolean;
  onActivate: (id: string) => void;
  onToggleSelected: (id: string) => void;
  onRemove: (id: string) => void;
  onDownload: (result: ProcessedResult) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

export function ImageGrid({
  sources,
  results,
  statuses,
  errors,
  activeId,
  selectedIds,
  targetFormat,
  allSelected,
  locked,
  onActivate,
  onToggleSelected,
  onRemove,
  onDownload,
  onSelectAll,
  onSelectNone,
}: ImageGridProps) {
  if (sources.length === 0) return null;

  return (
    <section className="image-grid-section" aria-labelledby="image-grid-title">
      <div className="grid-head">
        <div>
          <span className="section-kicker">Workspace</span>
          <h2 id="image-grid-title">
            Your images <span className="count-badge">{sources.length}</span>
          </h2>
        </div>
        <div className="grid-head-actions">
          <span className="selection-count">
            {selectedIds.size} of {sources.length} selected
          </span>
          <button
            type="button"
            className="text-button"
            onClick={allSelected ? onSelectNone : onSelectAll}
            disabled={locked}
          >
            {allSelected ? <Square size={15} aria-hidden="true" /> : <CheckSquare size={15} aria-hidden="true" />}
            {allSelected ? 'Clear selection' : 'Select all'}
          </button>
        </div>
      </div>

      <div className="image-grid">
        {sources.map((source) => (
          <ImageCard
            key={source.id}
            source={source}
            result={results[source.id] ?? null}
            status={statuses[source.id] ?? 'ready'}
            error={errors[source.id] ?? null}
            targetFormat={targetFormat}
            active={activeId === source.id}
            selected={selectedIds.has(source.id)}
            locked={locked}
            onActivate={() => onActivate(source.id)}
            onToggleSelected={() => onToggleSelected(source.id)}
            onRemove={() => onRemove(source.id)}
            onDownload={onDownload}
          />
        ))}
      </div>
    </section>
  );
}
