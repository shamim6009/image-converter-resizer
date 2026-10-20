import type { FormatCapabilities, OutputFormatId, ProcessSettings } from '../types/image';
import { encodeBmp } from './bmp';
import { canvasToBlob, createCanvas, get2dContext, releaseCanvas } from './canvas';
import { normalizeHexColor } from './color';
import { ImageProcessingError } from './errors';
import { getOutputFormat, validateEncodedBlob } from './formats';
import { buildIco } from './ico';

export interface EncodedOutput {
  blob: Blob;
  width: number;
  height: number;
  format: OutputFormatId;
  mime: string;
}

function qualityFraction(quality: number): number {
  return Math.min(1, Math.max(0.01, quality / 100));
}

async function encodeAvif(
  canvas: HTMLCanvasElement,
  settings: ProcessSettings,
  capabilities: FormatCapabilities,
): Promise<Blob> {
  if (!capabilities.avif) {
    throw new ImageProcessingError(
      'ENCODER_UNAVAILABLE',
      'AVIF export is not available in this browser.',
    );
  }

  if (capabilities.avifNative) {
    try {
      const nativeBlob = await canvasToBlob(canvas, 'image/avif', qualityFraction(settings.quality));
      if (nativeBlob.type === 'image/avif' && nativeBlob.size > 0) {
        return nativeBlob;
      }
    } catch {
      // The native encoder is optional; the bundled WebAssembly encoder is the fallback.
    }
  }

  try {
    const context = get2dContext(canvas);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const { encode } = await import('@jsquash/avif');
    const buffer = await encode(imageData, {
      quality: Math.min(100, Math.max(1, Math.round(settings.quality))),
      speed: 6,
    });
    return new Blob([buffer], { type: 'image/avif' });
  } catch {
    throw new ImageProcessingError(
      'ENCODE_FAILED',
      'AVIF encoding failed in this browser.',
      'Try WebP or JPEG instead, or reload the page to retry the AVIF encoder.',
    );
  }
}

async function encodeIco(
  sourceCanvas: HTMLCanvasElement,
  settings: ProcessSettings,
): Promise<{ blob: Blob; width: number; height: number }> {
  const iconSize = Math.min(256, Math.max(1, Math.max(sourceCanvas.width, sourceCanvas.height)));
  const iconCanvas = createCanvas(iconSize, iconSize);

  try {
    const context = get2dContext(iconCanvas);
    context.clearRect(0, 0, iconSize, iconSize);
    if (!settings.transparentBackground) {
      context.fillStyle = normalizeHexColor(settings.background) ?? '#FFFFFF';
      context.fillRect(0, 0, iconSize, iconSize);
    }

    const scale = Math.min(iconSize / sourceCanvas.width, iconSize / sourceCanvas.height);
    const drawWidth = Math.max(1, Math.round(sourceCanvas.width * scale));
    const drawHeight = Math.max(1, Math.round(sourceCanvas.height * scale));
    context.drawImage(
      sourceCanvas,
      Math.round((iconSize - drawWidth) / 2),
      Math.round((iconSize - drawHeight) / 2),
      drawWidth,
      drawHeight,
    );

    const png = await canvasToBlob(iconCanvas, 'image/png');
    if (png.type !== 'image/png') {
      throw new Error('PNG encoder unavailable for ICO generation.');
    }
    const pngBytes = new Uint8Array(await png.arrayBuffer());
    const icoBytes = buildIco([{ size: iconSize, png: pngBytes }]);
    return {
      blob: new Blob([icoBytes], { type: 'image/x-icon' }),
      width: iconSize,
      height: iconSize,
    };
  } finally {
    releaseCanvas(iconCanvas);
  }
}

export async function encodeComposition(
  canvas: HTMLCanvasElement,
  settings: ProcessSettings,
  capabilities: FormatCapabilities,
): Promise<EncodedOutput> {
  const format = getOutputFormat(settings.format);

  try {
    let blob: Blob;
    let width = canvas.width;
    let height = canvas.height;

    switch (format.id) {
      case 'jpeg':
        blob = await canvasToBlob(canvas, 'image/jpeg', qualityFraction(settings.quality));
        break;
      case 'png':
        blob = await canvasToBlob(canvas, 'image/png');
        break;
      case 'webp':
        if (!capabilities.webp) {
          throw new ImageProcessingError(
            'ENCODER_UNAVAILABLE',
            'WebP export is not supported by this browser.',
            'Choose JPEG or PNG instead.',
          );
        }
        blob = await canvasToBlob(canvas, 'image/webp', qualityFraction(settings.quality));
        break;
      case 'avif':
        blob = await encodeAvif(canvas, settings, capabilities);
        break;
      case 'bmp': {
        const context = get2dContext(canvas);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        blob = encodeBmp(canvas.width, canvas.height, imageData.data);
        break;
      }
      case 'ico': {
        const icon = await encodeIco(canvas, settings);
        blob = icon.blob;
        width = icon.width;
        height = icon.height;
        break;
      }
      default:
        throw new ImageProcessingError('UNSUPPORTED_FORMAT', 'Unknown output format.');
    }

    await validateEncodedBlob(blob, format.id);

    return {
      blob,
      width,
      height,
      format: format.id,
      mime: format.mime,
    };
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    if (error instanceof Error && error.message.includes('valid')) {
      throw new ImageProcessingError(
        'OUTPUT_VALIDATION_FAILED',
        `The ${format.label} encoder did not produce a valid file. ${error.message}`,
      );
    }
    throw new ImageProcessingError(
      'ENCODE_FAILED',
      `The image could not be encoded as ${format.label}. Try a smaller size or another format.`,
    );
  }
}
