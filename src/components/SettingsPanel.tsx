import {
  Check,
  Crop,
  Gauge,
  Image,
  Info,
  Link2,
  Lock,
  Maximize,
  Minus,
  Move,
  Palette,
  RefreshCw,
  Scaling,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Unlink2,
} from 'lucide-react';
import type {
  AutoResizeBy,
  FitMode,
  FormatCapabilities,
  OutputFormatId,
  ProcessSettings,
  ResizeMode,
  SourceAsset,
  WorkflowTab,
} from '../types/image';
import {
  OUTPUT_FORMAT_ORDER,
  formatDimensions,
  getOutputFormat,
} from '../lib/formats';
import { normalizeHexColor } from '../lib/color';
import { resolveGeometry } from '../lib/geometry';
import {
  RESIZE_MODE_LABELS,
  RESIZE_PRESETS,
  applyPreset,
  dimensionsForMode,
  isPresetActive,
} from '../lib/settings';
import { NumberInput } from './NumberInput';

interface SettingsPanelProps {
  settings: ProcessSettings;
  onChange: (patch: Partial<ProcessSettings>) => void;
  onReset: () => void;
  onApplyAll: () => void;
  activeSource: SourceAsset | null;
  sourceCount: number;
  selectedCount: number;
  capabilities: FormatCapabilities;
  activeTab: WorkflowTab;
  locked: boolean;
  batchRunning: boolean;
}

const RESIZE_MODES: ResizeMode[] = ['original', 'auto', 'custom', 'percentage'];

const AUTO_OPTIONS: Array<{ id: AutoResizeBy; label: string }> = [
  { id: 'width', label: 'Width' },
  { id: 'height', label: 'Height' },
  { id: 'longest', label: 'Longest side' },
  { id: 'max', label: 'Max dimensions' },
];

const FIT_OPTIONS: Array<{ id: FitMode; label: string; description: string; icon: typeof Crop }> = [
  { id: 'contain', label: 'Contain', description: 'Fit all content; pad empty space', icon: Maximize },
  { id: 'cover', label: 'Cover', description: 'Fill the frame; crop overflow', icon: Crop },
  { id: 'stretch', label: 'Stretch', description: 'Force exact width and height', icon: Move },
  { id: 'fit-within', label: 'Fit within', description: 'Shrink to fit; never upscale', icon: Minus },
];

const SECTION_ORDER: Record<WorkflowTab, Record<'format' | 'resize' | 'quality' | 'background', number>> = {
  convert: { format: 1, resize: 2, quality: 3, background: 4 },
  resize: { resize: 1, format: 2, quality: 3, background: 4 },
  bulk: { format: 1, resize: 2, quality: 3, background: 4 },
  compress: { quality: 1, format: 2, resize: 3, background: 4 },
};

export function SettingsPanel({
  settings,
  onChange,
  onReset,
  onApplyAll,
  activeSource,
  sourceCount,
  selectedCount,
  capabilities,
  activeTab,
  locked,
  batchRunning,
}: SettingsPanelProps) {
  const formatInfo = getOutputFormat(settings.format);
  const order = SECTION_ORDER[activeTab];
  const normalizedBackground = normalizeHexColor(settings.background) ?? '#FFFFFF';
  const transparentAllowed = formatInfo.transparency;

  const target = (() => {
    if (!activeSource) return null;
    try {
      return resolveGeometry(activeSource.width, activeSource.height, settings);
    } catch {
      return null;
    }
  })();

  const autoDimensions = (() => {
    if (!activeSource) return null;
    return dimensionsForMode(settings, activeSource.width, activeSource.height);
  })();

  const availableFormats = OUTPUT_FORMAT_ORDER.map((id) => {
    const info = getOutputFormat(id);
    const available = id === 'webp' ? capabilities.webp : id === 'avif' ? capabilities.avif : true;
    return { info, available };
  });

  const setResizeMode = (mode: ResizeMode) => {
    const patch: Partial<ProcessSettings> = { resizeMode: mode };
    if (mode === 'custom' && activeSource && settings.customWidth === null && settings.customHeight === null) {
      patch.customWidth = activeSource.width;
      patch.customHeight = activeSource.height;
    }
    onChange(patch);
  };

  const updateCustomWidth = (width: number | null) => {
    if (settings.preserveAspect && width && activeSource) {
      onChange({
        customWidth: width,
        customHeight: Math.max(1, Math.round((width * activeSource.height) / activeSource.width)),
      });
    } else {
      onChange({ customWidth: width });
    }
  };

  const updateCustomHeight = (height: number | null) => {
    if (settings.preserveAspect && height && activeSource) {
      onChange({
        customHeight: height,
        customWidth: Math.max(1, Math.round((height * activeSource.width) / activeSource.height)),
      });
    } else {
      onChange({ customHeight: height });
    }
  };

  const toggleAspectLock = () => {
    const nextLocked = !settings.preserveAspect;
    if (nextLocked && settings.customWidth && activeSource) {
      onChange({
        preserveAspect: true,
        customHeight: Math.max(
          1,
          Math.round((settings.customWidth * activeSource.height) / activeSource.width),
        ),
      });
    } else {
      onChange({ preserveAspect: nextLocked });
    }
  };

  return (
    <aside className="settings-panel" aria-labelledby="settings-title">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Processing setup</span>
          <h2 id="settings-title">
            <SlidersHorizontal size={19} aria-hidden="true" />
            Settings
          </h2>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={onReset}
          disabled={locked}
          title="Reset all settings"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Reset
        </button>
      </div>

      {locked ? (
        <div className="inline-note">
          <Info size={16} aria-hidden="true" />
          A bulk job is running. Settings are locked until it finishes or you cancel it.
        </div>
      ) : null}

      <fieldset className="settings-fields" disabled={locked}>
        <legend className="sr-only">Image processing settings</legend>

        <section className="settings-section" style={{ order: order.format }}>
          <div className="settings-section-head">
            <h3>
              <Image size={17} aria-hidden="true" />
              Output format
            </h3>
            <span className="section-hint">Target file type</span>
          </div>

          <div className="format-grid" role="radiogroup" aria-label="Output format">
            {availableFormats.map(({ info, available }) => {
              const selected = settings.format === info.id;
              return (
                <label
                  key={info.id}
                  className={`format-option ${selected ? 'is-selected' : ''} ${
                    available ? '' : 'is-unavailable'
                  }`}
                  title={available ? info.description : 'This output format is not supported by your browser.'}
                >
                  <input
                    type="radio"
                    name="output-format"
                    value={info.id}
                    checked={selected}
                    disabled={!available}
                    onChange={() => onChange({ format: info.id as OutputFormatId })}
                  />
                  <span className="format-radio" aria-hidden="true">
                    {selected ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                  <span className="format-name">{info.label}</span>
                  <span className="format-ext">.{info.extension}</span>
                  <span className="format-description">
                    {available ? info.description : 'Unavailable in this browser'}
                  </span>
                </label>
              );
            })}
          </div>

          {settings.format === 'ico' ? (
            <div className="inline-note subtle">
              <Info size={15} aria-hidden="true" />
              ICO export creates a square icon capped at 256 × 256 px.
            </div>
          ) : null}
          {settings.format === 'avif' && !capabilities.avifNative && capabilities.avif ? (
            <div className="inline-note subtle">
              <Sparkles size={15} aria-hidden="true" />
              AVIF is encoded with a bundled WebAssembly encoder. The first export may take a little longer.
            </div>
          ) : null}
        </section>

        <section className="settings-section" style={{ order: order.resize }}>
          <div className="settings-section-head">
            <h3>
              <Scaling size={17} aria-hidden="true" />
              Resize
            </h3>
            <span className="section-hint">
              {activeSource ? formatDimensions(activeSource.width, activeSource.height) : 'Upload to resize'}
            </span>
          </div>

          <div className="segmented" role="radiogroup" aria-label="Resize mode">
            {RESIZE_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={settings.resizeMode === mode}
                className={settings.resizeMode === mode ? 'is-active' : ''}
                onClick={() => setResizeMode(mode)}
              >
                {RESIZE_MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          {settings.resizeMode === 'original' ? (
            <div className="mode-body">
              <div className="mode-summary">
                <span>
                  <Square size={15} aria-hidden="true" /> Keep the original resolution
                </span>
                <span className="muted">
                  {activeSource
                    ? `${formatDimensions(activeSource.width, activeSource.height)} → ${formatDimensions(
                        activeSource.width,
                        activeSource.height,
                      )}`
                    : 'No image selected'}
                </span>
              </div>
            </div>
          ) : null}

          {settings.resizeMode === 'auto' ? (
            <div className="mode-body">
              <div className="mini-options" role="radiogroup" aria-label="Auto resize by">
                {AUTO_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={settings.autoBy === option.id}
                    className={settings.autoBy === option.id ? 'is-active' : ''}
                    onClick={() => onChange({ autoBy: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {settings.autoBy === 'max' ? (
                <div className="field-row">
                  <NumberInput
                    id="max-width"
                    label="Max width"
                    value={settings.maxWidth}
                    min={1}
                    max={16384}
                    onChange={(value) => onChange({ maxWidth: value ?? 1 })}
                  />
                  <NumberInput
                    id="max-height"
                    label="Max height"
                    value={settings.maxHeight}
                    min={1}
                    max={16384}
                    onChange={(value) => onChange({ maxHeight: value ?? 1 })}
                  />
                </div>
              ) : (
                <NumberInput
                  id="auto-size"
                  label={
                    settings.autoBy === 'longest'
                      ? 'Longest side'
                      : settings.autoBy === 'width'
                        ? 'New width'
                        : 'New height'
                  }
                  value={settings.autoValue}
                  min={1}
                  max={16384}
                  onChange={(value) => onChange({ autoValue: value ?? 1 })}
                  hint="The other dimension is calculated automatically to preserve proportions."
                />
              )}

              {autoDimensions ? (
                <div className="result-pill">
                  <span>Calculated</span>
                  <strong>
                    {autoDimensions.width} × {autoDimensions.height} px
                  </strong>
                </div>
              ) : null}
            </div>
          ) : null}

          {settings.resizeMode === 'custom' ? (
            <div className="mode-body">
              <div className="dimension-row">
                <NumberInput
                  id="custom-width"
                  label="Width"
                  value={settings.customWidth}
                  min={1}
                  max={16384}
                  allowEmpty
                  onChange={updateCustomWidth}
                />
                <button
                  type="button"
                  className={`aspect-lock ${settings.preserveAspect ? 'is-locked' : ''}`}
                  onClick={toggleAspectLock}
                  aria-pressed={settings.preserveAspect}
                  aria-label={settings.preserveAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                  title={settings.preserveAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                >
                  {settings.preserveAspect ? <Link2 size={18} /> : <Unlink2 size={18} />}
                </button>
                <NumberInput
                  id="custom-height"
                  label="Height"
                  value={settings.customHeight}
                  min={1}
                  max={16384}
                  allowEmpty
                  onChange={updateCustomHeight}
                />
              </div>
              <p className="field-hint">
                {settings.preserveAspect
                  ? 'Aspect ratio locked. Edit either field to update the other.'
                  : 'Aspect ratio unlocked. Width and height can be set independently.'}
              </p>

              <div className="fit-grid" role="radiogroup" aria-label="Resize fit mode">
                {FIT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={settings.fitMode === option.id}
                      className={`fit-option ${settings.fitMode === option.id ? 'is-active' : ''}`}
                      onClick={() => onChange({ fitMode: option.id })}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="preset-block">
                <div className="preset-head">
                  <h4>Social &amp; web presets</h4>
                  <span>Applies exact dimensions</span>
                </div>
                <div className="preset-grid">
                  {RESIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-button ${isPresetActive(settings, preset) ? 'is-active' : ''}`}
                      onClick={() => onChange(applyPreset(settings, preset))}
                    >
                      <span>{preset.label}</span>
                      <small>
                        {preset.width} × {preset.height}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {settings.resizeMode === 'percentage' ? (
            <div className="mode-body">
              <div className="percentage-head">
                <label htmlFor="percentage-range">Scale by percentage</label>
                <span className="slider-value">{settings.percentage}%</span>
              </div>
              <input
                id="percentage-range"
                className="range-input"
                type="range"
                min={1}
                max={300}
                step={1}
                value={settings.percentage}
                onChange={(event) => onChange({ percentage: Number(event.target.value) })}
              />
              <div className="field-row">
                <NumberInput
                  id="percentage-value"
                  label="Percentage"
                  value={settings.percentage}
                  min={1}
                  max={300}
                  suffix="%"
                  onChange={(value) => onChange({ percentage: value ?? 100 })}
                />
                {activeSource && autoDimensions ? (
                  <div className="calculated-box">
                    <span>New size</span>
                    <strong>
                      {autoDimensions.width} × {autoDimensions.height} px
                    </strong>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {target ? (
            <div className="target-summary">
              <span>
                <Settings2 size={14} aria-hidden="true" /> Target output
              </span>
              <strong>{formatDimensions(target.outputWidth, target.outputHeight)}</strong>
              <span className="target-format">{formatInfo.label}</span>
            </div>
          ) : null}
          {target?.notes.map((note) => (
            <p key={note} className="field-hint">
              {note}
            </p>
          ))}
        </section>

        <section className="settings-section" style={{ order: order.quality }}>
          <div className="settings-section-head">
            <h3>
              <Gauge size={17} aria-hidden="true" />
              Quality &amp; compression
            </h3>
            <span className="section-hint">{formatInfo.label}</span>
          </div>

          {formatInfo.lossy ? (
            <div className="quality-block">
              <div className="percentage-head">
                <label htmlFor="quality-range">Image quality</label>
                <span className="slider-value">{settings.quality}%</span>
              </div>
              <input
                id="quality-range"
                className="range-input"
                type="range"
                min={1}
                max={100}
                step={1}
                value={settings.quality}
                onChange={(event) => onChange({ quality: Number(event.target.value) })}
                aria-describedby="quality-hint"
              />
              <div className="range-scale" aria-hidden="true">
                <span>Smaller file</span>
                <span>Best quality</span>
              </div>
              <p id="quality-hint" className="field-hint">
                Lower quality creates smaller files. Actual savings depend on the image.
              </p>
            </div>
          ) : (
            <div className="lossless-note">
              <Lock size={17} aria-hidden="true" />
              <div>
                <strong>Quality is not adjustable for {formatInfo.label}.</strong>
                <span>
                  This format is {settings.format === 'bmp' ? 'uncompressed' : 'lossless'}, so the quality
                  slider has no effect on the output.
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="settings-section" style={{ order: order.background }}>
          <div className="settings-section-head">
            <h3>
              <Palette size={17} aria-hidden="true" />
              Background &amp; transparency
            </h3>
            <span className="section-hint">Padding and flattening</span>
          </div>

          <div className="background-row">
            <label className="color-control">
              <span>Background</span>
              <span className="color-input-wrap">
                <input
                  type="color"
                  value={normalizedBackground}
                  onChange={(event) => onChange({ background: event.target.value.toUpperCase() })}
                  aria-label="Background color"
                />
                <code>{normalizedBackground}</code>
              </span>
            </label>
            <div className="swatches" aria-label="Background color presets">
              {['#FFFFFF', '#0F172A', '#4F46E5', '#E2E8F0', '#FDE68A'].map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`swatch ${normalizedBackground === color ? 'is-active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => onChange({ background: color })}
                  aria-label={`Use ${color} as background`}
                  title={color}
                />
              ))}
            </div>
          </div>

          <label className={`toggle-row ${transparentAllowed ? '' : 'is-disabled'}`}>
            <span>
              <strong>Keep transparent areas</strong>
              <small>
                {transparentAllowed
                  ? 'Transparency is preserved when the output format supports it.'
                  : `${formatInfo.label} does not support transparency. The background color is used instead.`}
              </small>
            </span>
            <input
              type="checkbox"
              checked={settings.transparentBackground && transparentAllowed}
              disabled={!transparentAllowed}
              onChange={(event) => onChange({ transparentBackground: event.target.checked })}
            />
            <span className="toggle-track" aria-hidden="true">
              <span />
            </span>
          </label>

          {!transparentAllowed ? (
            <p className="field-hint">
              Transparent input pixels will be flattened onto {normalizedBackground} when converting to{' '}
              {formatInfo.label}.
            </p>
          ) : null}
        </section>
      </fieldset>

      <div className="settings-apply">
        <button
          type="button"
          className="button button-primary apply-button"
          onClick={onApplyAll}
          disabled={sourceCount === 0 || locked}
        >
          <Sparkles size={18} aria-hidden="true" />
          {batchRunning ? 'Processing all images…' : 'Apply to all images'}
        </button>
        <div className="apply-meta">
          <span>
            {sourceCount} image{sourceCount === 1 ? '' : 's'} in workspace
            {selectedCount !== sourceCount ? ` · ${selectedCount} selected` : ''}
          </span>
          <span>Preview updates automatically</span>
        </div>
      </div>
    </aside>
  );
}
