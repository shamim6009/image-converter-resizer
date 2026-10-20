import { Gauge, Images, Layers3, LockKeyhole, Scaling, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import type { WorkflowTab } from '../types/image';

interface HeroProps {
  activeTab: WorkflowTab;
  onTabChange: (tab: WorkflowTab) => void;
}

const TAB_META: Record<WorkflowTab, { label: string; icon: typeof Images }> = {
  convert: { label: 'Convert', icon: Images },
  resize: { label: 'Resize', icon: Scaling },
  bulk: { label: 'Bulk studio', icon: Layers3 },
  compress: { label: 'Compress', icon: Gauge },
};

const COPY: Record<WorkflowTab, { eyebrow: string; description: string }> = {
  convert: {
    eyebrow: 'All-in-one converter',
    description:
      'Convert photos between JPG, PNG, WebP, AVIF, BMP and ICO. Real format conversion, real previews, no uploads.',
  },
  resize: {
    eyebrow: 'Precision photo resizer',
    description:
      'Resize by width, height, percentage or exact dimensions. Lock the aspect ratio, crop with cover or pad with contain.',
  },
  bulk: {
    eyebrow: 'Bulk image studio',
    description:
      'Batch-convert and resize mixed image formats in one pass, then download every successful result as a ZIP.',
  },
  compress: {
    eyebrow: 'Image compression',
    description:
      'Fine-tune quality for JPEG, WebP and AVIF and see the actual byte-size difference before you download.',
  },
};

export function Hero({ activeTab, onTabChange }: HeroProps) {
  const copy = COPY[activeTab];

  return (
    <section className="hero" aria-labelledby="page-title">
      <div className="hero-glow hero-glow-one" aria-hidden="true" />
      <div className="hero-glow hero-glow-two" aria-hidden="true" />
      <div className="hero-content">
        <div className="hero-badge">
          <Sparkles size={14} aria-hidden="true" />
          <span>{copy.eyebrow}</span>
          <span className="hero-badge-divider" aria-hidden="true" />
          <span>No sign-up</span>
        </div>

        <h1 id="page-title">
          Image Converter &amp; <span className="text-gradient">Photo Resizer</span> Online
        </h1>
        <p className="hero-description">{copy.description}</p>

        <div className="hero-benefits" aria-label="Application benefits">
          <span>
            <ShieldCheck size={16} aria-hidden="true" /> 100% local processing
          </span>
          <span>
            <Zap size={16} aria-hidden="true" /> Instant live preview
          </span>
          <span>
            <LockKeyhole size={16} aria-hidden="true" /> Files stay on your device
          </span>
        </div>

        <div className="workflow-tabs" role="tablist" aria-label="Choose a workflow">
          {(Object.keys(TAB_META) as WorkflowTab[]).map((tab) => {
            const Icon = TAB_META[tab].icon;
            const selected = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="workspace"
                tabIndex={selected ? 0 : -1}
                className={`workflow-tab ${selected ? 'is-active' : ''}`}
                onClick={() => onTabChange(tab)}
                onKeyDown={(event) => {
                  const tabs = Object.keys(TAB_META) as WorkflowTab[];
                  const index = tabs.indexOf(tab);
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    const direction = event.key === 'ArrowRight' ? 1 : -1;
                    const next = tabs[(index + direction + tabs.length) % tabs.length];
                    onTabChange(next);
                    const target = document.querySelector<HTMLButtonElement>(
                      `.workflow-tab[data-tab="${next}"]`,
                    );
                    target?.focus();
                  }
                }}
                data-tab={tab}
              >
                <Icon size={17} aria-hidden="true" />
                {TAB_META[tab].label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
