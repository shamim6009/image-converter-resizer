import { describe, expect, it } from 'vitest';
import type { ProcessSettings } from '../../types/image';
import {
  DEFAULT_SETTINGS,
  RESIZE_PRESETS,
  applyPreset,
  dimensionsForMode,
  isPresetActive,
} from '../settings';

function makeSettings(patch: Partial<ProcessSettings>): ProcessSettings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe('applyPreset', () => {
  it('switches to custom mode with exact dimensions unlocked', () => {
    const preset = RESIZE_PRESETS[0];
    const next = applyPreset(DEFAULT_SETTINGS, preset);
    expect(next.resizeMode).toBe('custom');
    expect(next.customWidth).toBe(preset.width);
    expect(next.customHeight).toBe(preset.height);
    expect(next.preserveAspect).toBe(false);
  });
});

describe('isPresetActive', () => {
  it('matches only the active preset dimensions', () => {
    const preset = RESIZE_PRESETS[1];
    const active = applyPreset(DEFAULT_SETTINGS, preset);
    expect(isPresetActive(active, preset)).toBe(true);
    expect(isPresetActive(active, RESIZE_PRESETS[0])).toBe(false);
  });
});

describe('dimensionsForMode', () => {
  it('returns the source size for original mode', () => {
    expect(dimensionsForMode(DEFAULT_SETTINGS, 1000, 500)).toEqual({ width: 1000, height: 500 });
  });

  it('scales for percentage mode', () => {
    expect(
      dimensionsForMode(makeSettings({ resizeMode: 'percentage', percentage: 25 }), 1000, 800),
    ).toEqual({ width: 250, height: 200 });
  });

  it('computes proportional height for auto width', () => {
    expect(
      dimensionsForMode(makeSettings({ resizeMode: 'auto', autoBy: 'width', autoValue: 500 }), 1000, 500),
    ).toEqual({ width: 500, height: 250 });
  });

  it('derives the locked dimension for custom aspect mode', () => {
    expect(
      dimensionsForMode(
        makeSettings({
          resizeMode: 'custom',
          customWidth: 400,
          customHeight: null,
          preserveAspect: true,
        }),
        800,
        400,
      ),
    ).toEqual({ width: 400, height: 200 });
  });

  it('returns null when custom dimensions are incomplete', () => {
    expect(
      dimensionsForMode(
        makeSettings({
          resizeMode: 'custom',
          customWidth: null,
          customHeight: null,
          preserveAspect: true,
        }),
        800,
        400,
      ),
    ).toBe(null);
  });
});
