import { FabricImage, filters } from 'fabric';

export interface Adjustments {
  preset: string;
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  hue: number;
  blur: number;
  noise: number;
  pixelate: number;
  sharpen: boolean;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  preset: 'none',
  brightness: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  hue: 0,
  blur: 0,
  noise: 0,
  pixelate: 0,
  sharpen: false,
};

export const FILTER_PRESETS: Array<{ id: string; label: string; swatch: string }> = [
  { id: 'none', label: 'Original', swatch: 'linear-gradient(135deg,#f97316,#6366f1,#22c55e)' },
  { id: 'grayscale', label: 'Grayscale', swatch: 'linear-gradient(135deg,#f5f5f5,#525252)' },
  { id: 'blackwhite', label: 'B&W', swatch: 'linear-gradient(135deg,#ffffff 50%,#111111 50%)' },
  { id: 'sepia', label: 'Sepia', swatch: 'linear-gradient(135deg,#f3e2c0,#8a5a2b)' },
  { id: 'vintage', label: 'Vintage', swatch: 'linear-gradient(135deg,#e9c46a,#7f5539)' },
  { id: 'kodachrome', label: 'Kodachrome', swatch: 'linear-gradient(135deg,#ffb703,#d00000,#3a0ca3)' },
  { id: 'technicolor', label: 'Technicolor', swatch: 'linear-gradient(135deg,#ff006e,#3a86ff,#06d6a0)' },
  { id: 'polaroid', label: 'Polaroid', swatch: 'linear-gradient(135deg,#fdf0d5,#669bbc)' },
  { id: 'brownie', label: 'Brownie', swatch: 'linear-gradient(135deg,#bc6c25,#283618)' },
  { id: 'warm', label: 'Warm', swatch: 'linear-gradient(135deg,#ffd6a5,#ff7b00)' },
  { id: 'cool', label: 'Cool', swatch: 'linear-gradient(135deg,#caf0f8,#0077b6)' },
  { id: 'invert', label: 'Invert', swatch: 'linear-gradient(135deg,#0ea5e9,#111827,#facc15)' },
];

export function buildFilters(adj: Adjustments): FabricImage['filters'] {
  const list: FabricImage['filters'] = [];

  switch (adj.preset) {
    case 'grayscale':
      list.push(new filters.Grayscale());
      break;
    case 'blackwhite':
      list.push(new filters.BlackWhite());
      break;
    case 'sepia':
      list.push(new filters.Sepia());
      break;
    case 'vintage':
      list.push(new filters.Vintage());
      break;
    case 'kodachrome':
      list.push(new filters.Kodachrome());
      break;
    case 'technicolor':
      list.push(new filters.Technicolor());
      break;
    case 'polaroid':
      list.push(new filters.Polaroid());
      break;
    case 'brownie':
      list.push(new filters.Brownie());
      break;
    case 'warm':
      list.push(new filters.BlendColor({ color: '#ff8a00', mode: 'tint', alpha: 0.16 }));
      break;
    case 'cool':
      list.push(new filters.BlendColor({ color: '#0090ff', mode: 'tint', alpha: 0.16 }));
      break;
    case 'invert':
      list.push(new filters.Invert());
      break;
    default:
      break;
  }

  if (adj.brightness) list.push(new filters.Brightness({ brightness: adj.brightness / 200 }));
  if (adj.contrast) list.push(new filters.Contrast({ contrast: adj.contrast / 150 }));
  if (adj.saturation) list.push(new filters.Saturation({ saturation: adj.saturation / 100 }));
  if (adj.vibrance) list.push(new filters.Vibrance({ vibrance: adj.vibrance / 100 }));
  if (adj.hue) list.push(new filters.HueRotation({ rotation: adj.hue / 180 }));
  if (adj.sharpen) list.push(new filters.Convolute({ matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0] }));
  if (adj.blur) list.push(new filters.Blur({ blur: adj.blur / 200 }));
  if (adj.noise) list.push(new filters.Noise({ noise: adj.noise * 2 }));
  if (adj.pixelate >= 2) list.push(new filters.Pixelate({ blocksize: adj.pixelate }));

  return list;
}

export const FONT_FAMILIES = [
  'Inter, Segoe UI, sans-serif',
  'Arial, sans-serif',
  'Verdana, sans-serif',
  'Trebuchet MS, sans-serif',
  'Georgia, serif',
  'Times New Roman, serif',
  'Courier New, monospace',
  'Impact, fantasy',
  'Comic Sans MS, cursive',
  'Brush Script MT, cursive',
];

export const STICKERS = [
  '😀', '😍', '😎', '🥳', '😂', '🤩', '😇', '🤔',
  '❤️', '🔥', '⭐', '✨', '🎉', '👍', '👏', '💯',
  '🌈', '☀️', '🌙', '⚡', '🌸', '🍀', '🎁', '🎈',
  '📷', '🎵', '🏆', '👑', '💎', '🚀', '🐱', '🐶',
];

export const CANVAS_PRESETS: Array<{ label: string; width: number; height: number }> = [
  { label: 'Square post', width: 1080, height: 1080 },
  { label: 'Portrait post', width: 1080, height: 1350 },
  { label: 'Story / Reel', width: 1080, height: 1920 },
  { label: 'YouTube thumbnail', width: 1280, height: 720 },
  { label: 'Facebook post', width: 1200, height: 630 },
  { label: 'Full HD', width: 1920, height: 1080 },
];

export const CROP_RATIOS: Array<{ id: string; label: string; ratio: number | null }> = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '2:3', label: '2:3', ratio: 2 / 3 },
];

export const SWATCHES = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
];
