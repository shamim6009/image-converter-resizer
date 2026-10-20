import type { ProcessSettings, ResizeMode } from '../types/image';

export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  hint: string;
}

export const RESIZE_PRESETS: SizePreset[] = [
  { id: 'ig-square', label: 'Instagram Square', width: 1080, height: 1080, hint: '1:1 post' },
  { id: 'ig-portrait', label: 'Instagram Portrait', width: 1080, height: 1350, hint: '4:5 post' },
  { id: 'ig-story', label: 'Instagram Story', width: 1080, height: 1920, hint: '9:16 story' },
  { id: 'youtube', label: 'YouTube Thumbnail', width: 1280, height: 720, hint: '16:9 thumbnail' },
  { id: 'facebook', label: 'Facebook Post', width: 1200, height: 630, hint: 'Link preview' },
  { id: 'banner', label: 'Website Banner', width: 1920, height: 600, hint: 'Wide banner' },
  { id: 'profile', label: 'Profile Picture', width: 512, height: 512, hint: 'Square avatar' },
  { id: 'hd', label: 'HD', width: 1280, height: 720, hint: '720p' },
  { id: 'full-hd', label: 'Full HD', width: 1920, height: 1080, hint: '1080p' },
];

export const RESIZE_MODE_LABELS: Record<ResizeMode, string> = {
  original: 'Original',
  auto: 'Auto',
  custom: 'Custom',
  percentage: 'Percent',
};

export const DEFAULT_SETTINGS: ProcessSettings = {
  format: 'webp',
  quality: 85,
  resizeMode: 'original',
  autoBy: 'width',
  autoValue: 1200,
  maxWidth: 1920,
  maxHeight: 1080,
  customWidth: null,
  customHeight: null,
  preserveAspect: true,
  fitMode: 'contain',
  percentage: 100,
  background: '#FFFFFF',
  transparentBackground: true,
};

export function applyPreset(settings: ProcessSettings, preset: SizePreset): ProcessSettings {
  return {
    ...settings,
    resizeMode: 'custom',
    customWidth: preset.width,
    customHeight: preset.height,
    preserveAspect: false,
  };
}

export function isPresetActive(settings: ProcessSettings, preset: SizePreset): boolean {
  return (
    settings.resizeMode === 'custom' &&
    settings.customWidth === preset.width &&
    settings.customHeight === preset.height
  );
}

export function dimensionsForMode(
  settings: ProcessSettings,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } | null {
  if (settings.resizeMode === 'original') {
    return { width: sourceWidth, height: sourceHeight };
  }
  if (settings.resizeMode === 'percentage') {
    return {
      width: Math.max(1, Math.round((sourceWidth * settings.percentage) / 100)),
      height: Math.max(1, Math.round((sourceHeight * settings.percentage) / 100)),
    };
  }
  if (settings.resizeMode === 'auto') {
    if (settings.autoBy === 'width') {
      return {
        width: settings.autoValue,
        height: Math.max(1, Math.round((settings.autoValue * sourceHeight) / sourceWidth)),
      };
    }
    if (settings.autoBy === 'height') {
      return {
        width: Math.max(1, Math.round((settings.autoValue * sourceWidth) / sourceHeight)),
        height: settings.autoValue,
      };
    }
    if (settings.autoBy === 'longest') {
      const scale = settings.autoValue / Math.max(sourceWidth, sourceHeight);
      return {
        width: Math.max(1, Math.round(sourceWidth * scale)),
        height: Math.max(1, Math.round(sourceHeight * scale)),
      };
    }
    const scale = Math.min(1, settings.maxWidth / sourceWidth, settings.maxHeight / sourceHeight);
    return {
      width: Math.max(1, Math.round(sourceWidth * scale)),
      height: Math.max(1, Math.round(sourceHeight * scale)),
    };
  }

  const width = settings.customWidth;
  const height = settings.customHeight;
  if (settings.preserveAspect) {
    if (width && !height) {
      return {
        width,
        height: Math.max(1, Math.round((width * sourceHeight) / sourceWidth)),
      };
    }
    if (height && !width) {
      return {
        width: Math.max(1, Math.round((height * sourceWidth) / sourceHeight)),
        height,
      };
    }
  }
  if (width && height) return { width, height };
  return null;
}
