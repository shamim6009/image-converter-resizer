import type { ProcessSettings, TargetGeometry } from '../types/image';
import { ImageProcessingError } from './errors';

export const MAX_OUTPUT_DIMENSION = 16_384;
export const MAX_OUTPUT_PIXELS = 80_000_000;

interface Box {
  width: number;
  height: number;
  fit: boolean;
}

function assertSourceDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new ImageProcessingError('INVALID_DIMENSIONS', 'The source image has invalid dimensions.');
  }
}

function checkedDimension(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 1) {
    throw new ImageProcessingError('INVALID_DIMENSIONS', `${label} must be at least 1 pixel.`);
  }
  const rounded = Math.round(value);
  if (rounded > MAX_OUTPUT_DIMENSION) {
    throw new ImageProcessingError(
      'DIMENSIONS_TOO_LARGE',
      `${label} is too large. The maximum supported dimension is ${MAX_OUTPUT_DIMENSION.toLocaleString()} px.`,
    );
  }
  return Math.max(1, rounded);
}

function assertSafeOutput(width: number, height: number): void {
  if (width > MAX_OUTPUT_DIMENSION || height > MAX_OUTPUT_DIMENSION) {
    throw new ImageProcessingError(
      'DIMENSIONS_TOO_LARGE',
      `The output size ${width.toLocaleString()} × ${height.toLocaleString()} exceeds the ${MAX_OUTPUT_DIMENSION.toLocaleString()} px browser-safe limit.`,
    );
  }
  if (width * height > MAX_OUTPUT_PIXELS) {
    throw new ImageProcessingError(
      'DIMENSIONS_TOO_LARGE',
      `The output contains too many pixels (${(width * height / 1_000_000).toFixed(1)} MP). Please use a smaller size.`,
    );
  }
}

function proportionalSize(
  sourceWidth: number,
  sourceHeight: number,
  width?: number,
  height?: number,
): { width: number; height: number } {
  const ratio = sourceWidth / sourceHeight;
  if (width && width > 0) {
    return { width, height: Math.max(1, Math.round(width / ratio)) };
  }
  if (height && height > 0) {
    return { width: Math.max(1, Math.round(height * ratio)), height };
  }
  throw new ImageProcessingError(
    'INVALID_DIMENSIONS',
    'Enter at least one width or height value for automatic resizing.',
  );
}

function resolveBox(
  sourceWidth: number,
  sourceHeight: number,
  settings: ProcessSettings,
): Box {
  switch (settings.resizeMode) {
    case 'original':
      return { width: sourceWidth, height: sourceHeight, fit: false };

    case 'percentage': {
      if (!Number.isFinite(settings.percentage) || settings.percentage < 1 || settings.percentage > 1000) {
        throw new ImageProcessingError('INVALID_DIMENSIONS', 'Percentage must be between 1% and 1000%.');
      }
      const scale = settings.percentage / 100;
      return {
        width: checkedDimension(sourceWidth * scale, 'Output width'),
        height: checkedDimension(sourceHeight * scale, 'Output height'),
        fit: false,
      };
    }

    case 'auto': {
      if (settings.autoBy === 'width') {
        const width = checkedDimension(settings.autoValue, 'Width');
        const size = proportionalSize(sourceWidth, sourceHeight, width);
        return { ...size, fit: false };
      }
      if (settings.autoBy === 'height') {
        const height = checkedDimension(settings.autoValue, 'Height');
        const size = proportionalSize(sourceWidth, sourceHeight, undefined, height);
        return { ...size, fit: false };
      }
      if (settings.autoBy === 'longest') {
        const longest = checkedDimension(settings.autoValue, 'Longest side');
        const scale = longest / Math.max(sourceWidth, sourceHeight);
        return {
          width: checkedDimension(sourceWidth * scale, 'Output width'),
          height: checkedDimension(sourceHeight * scale, 'Output height'),
          fit: false,
        };
      }
      const maxWidth = checkedDimension(settings.maxWidth, 'Maximum width');
      const maxHeight = checkedDimension(settings.maxHeight, 'Maximum height');
      const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
      return {
        width: Math.max(1, Math.round(sourceWidth * scale)),
        height: Math.max(1, Math.round(sourceHeight * scale)),
        fit: true,
      };
    }

    case 'custom': {
      const hasWidth = settings.customWidth !== null && Number.isFinite(settings.customWidth);
      const hasHeight = settings.customHeight !== null && Number.isFinite(settings.customHeight);

      if (!hasWidth && !hasHeight) {
        throw new ImageProcessingError('INVALID_DIMENSIONS', 'Enter a width or height for custom resizing.');
      }

      if (settings.preserveAspect && (!hasWidth || !hasHeight)) {
        const size = proportionalSize(
          sourceWidth,
          sourceHeight,
          hasWidth ? (settings.customWidth as number) : undefined,
          hasHeight ? (settings.customHeight as number) : undefined,
        );
        return {
          width: checkedDimension(size.width, 'Output width'),
          height: checkedDimension(size.height, 'Output height'),
          fit: false,
        };
      }

      if (!hasWidth || !hasHeight) {
        throw new ImageProcessingError(
          'INVALID_DIMENSIONS',
          'Unlock the aspect ratio or provide both width and height.',
        );
      }

      const width = checkedDimension(settings.customWidth as number, 'Width');
      const height = checkedDimension(settings.customHeight as number, 'Height');

      if (settings.fitMode === 'fit-within') {
        const scale = Math.min(1, width / sourceWidth, height / sourceHeight);
        return {
          width: Math.max(1, Math.round(sourceWidth * scale)),
          height: Math.max(1, Math.round(sourceHeight * scale)),
          fit: false,
        };
      }

      return { width, height, fit: true };
    }

    default:
      throw new ImageProcessingError('INVALID_DIMENSIONS', 'Unknown resize mode.');
  }
}

/**
 * Resolves the final canvas size and the source rectangle used for fitting.
 * Cover mode intentionally draws beyond the canvas, where the canvas clips it.
 */
export function resolveGeometry(
  sourceWidth: number,
  sourceHeight: number,
  settings: ProcessSettings,
): TargetGeometry {
  assertSourceDimensions(sourceWidth, sourceHeight);

  const box = resolveBox(sourceWidth, sourceHeight, settings);
  assertSafeOutput(box.width, box.height);

  const notes: string[] = [];
  const isCustomFit = box.fit && settings.resizeMode === 'custom';
  let drawWidth = box.width;
  let drawHeight = box.height;
  let drawX = 0;
  let drawY = 0;

  if (isCustomFit && settings.fitMode === 'contain') {
    const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight);
    drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    drawX = Math.round((box.width - drawWidth) / 2);
    drawY = Math.round((box.height - drawHeight) / 2);
  } else if (isCustomFit && settings.fitMode === 'cover') {
    const scale = Math.max(box.width / sourceWidth, box.height / sourceHeight);
    drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    drawX = Math.round((box.width - drawWidth) / 2);
    drawY = Math.round((box.height - drawHeight) / 2);
    notes.push('Cover mode crops the edges to fill the exact output size.');
  }

  if (settings.format === 'ico') {
    notes.push('ICO files are exported as a square icon with a maximum size of 256 px.');
  }

  assertSafeOutput(drawWidth, drawHeight);

  return {
    outputWidth: box.width,
    outputHeight: box.height,
    drawWidth,
    drawHeight,
    drawX,
    drawY,
    sourceX: 0,
    sourceY: 0,
    sourceWidth,
    sourceHeight,
    upscaled: drawWidth > sourceWidth || drawHeight > sourceHeight,
    notes,
  };
}

export function roundedDownToEven(value: number): number {
  const rounded = Math.floor(value);
  return rounded % 2 === 0 ? rounded : rounded - 1;
}
