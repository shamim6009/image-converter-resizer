import type { ProcessSettings, TargetGeometry } from '../types/image';
import { createCanvas, get2dContext } from './canvas';
import { normalizeHexColor } from './color';
import { ImageProcessingError } from './errors';
import { getOutputFormat } from './formats';
import { resolveGeometry } from './geometry';

export interface Composition {
  canvas: HTMLCanvasElement;
  geometry: TargetGeometry;
}

export function composeCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  settings: ProcessSettings,
): Composition {
  const geometry = resolveGeometry(sourceWidth, sourceHeight, settings);
  const outputFormat = getOutputFormat(settings.format);
  const canvas = createCanvas(geometry.outputWidth, geometry.outputHeight);
  const context = get2dContext(canvas);

  try {
    const needsBackground = !outputFormat.transparency || !settings.transparentBackground;
    context.clearRect(0, 0, geometry.outputWidth, geometry.outputHeight);
    if (needsBackground) {
      context.fillStyle = normalizeHexColor(settings.background) ?? '#FFFFFF';
      context.fillRect(0, 0, geometry.outputWidth, geometry.outputHeight);
    }

    context.drawImage(
      source,
      geometry.sourceX,
      geometry.sourceY,
      geometry.sourceWidth,
      geometry.sourceHeight,
      geometry.drawX,
      geometry.drawY,
      geometry.drawWidth,
      geometry.drawHeight,
    );

    return { canvas, geometry };
  } catch (error) {
    canvas.width = 0;
    canvas.height = 0;
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError(
      'CANVAS_FAILED',
      'The image could not be drawn at this size. Try a smaller output resolution.',
    );
  }
}
