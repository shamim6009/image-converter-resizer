import type { InputFormatId, InputFormatInfo } from '../types/image';
import { createCanvas, canvasToBlob, get2dContext, releaseCanvas } from './canvas';
import { ImageProcessingError, toUserMessage } from './errors';
import {
  MAX_SOURCE_DIMENSION,
  MAX_SOURCE_PIXELS,
  frameNoticeFor,
  getInputFormat,
  sniffFileFormat,
} from './formats';
import { sanitizeSvg } from './svg';

export interface DecodedDrawable {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

export interface AnalyzedImage {
  format: InputFormatInfo;
  width: number;
  height: number;
  thumbnailBlob: Blob;
  frameNotice?: string;
}

const THUMBNAIL_MAX = 1200;

function assertSourceSize(width: number, height: number): void {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_SOURCE_DIMENSION ||
    height > MAX_SOURCE_DIMENSION ||
    width * height > MAX_SOURCE_PIXELS
  ) {
    throw new ImageProcessingError(
      'SOURCE_TOO_LARGE',
      `This image is too large to process safely (${width.toLocaleString()} × ${height.toLocaleString()}).`,
      'Reduce the image dimensions before uploading, or choose a source image under 100 megapixels.',
    );
  }
}

function canvasFromImageData(imageData: ImageData): DecodedDrawable {
  const canvas = createCanvas(imageData.width, imageData.height);
  const context = get2dContext(canvas);
  context.putImageData(imageData, 0, 0);
  return {
    source: canvas,
    width: imageData.width,
    height: imageData.height,
    dispose: () => releaseCanvas(canvas),
  };
}

function imageElementFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The browser rejected this image while decoding it.'));
    image.src = url;
  });
}

async function decodeBlobInBrowser(
  blob: Blob,
  options: { preferImage?: boolean } = {},
): Promise<DecodedDrawable> {
  if (!options.preferImage && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      if (bitmap.width > 0 && bitmap.height > 0) {
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          dispose: () => bitmap.close(),
        };
      }
      bitmap.close();
    } catch {
      // Fall back to an <img> decoder, which also respects EXIF orientation.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = await imageElementFromUrl(url);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) throw new Error('The decoded image has no dimensions.');
    return {
      source: image,
      width,
      height,
      dispose: () => {
        image.src = '';
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function orientationFromTiff(ifd: Record<string, unknown>): number {
  const orientation = ifd.t274;
  if (Array.isArray(orientation) && typeof orientation[0] === 'number') {
    return orientation[0];
  }
  if (orientation instanceof Uint16Array || orientation instanceof Uint32Array) {
    return orientation[0] ?? 1;
  }
  return 1;
}

/**
 * TIFF pixels arrive without EXIF orientation applied, so orientation is
 * applied exactly once here.
 */
function tiffToDrawable(
  rgba: Uint8Array,
  width: number,
  height: number,
  orientation: number,
): DecodedDrawable {
  assertSourceSize(width, height);

  const sourceCanvas = createCanvas(width, height);
  const sourceContext = get2dContext(sourceCanvas);
  const pixels = new Uint8ClampedArray(rgba.length);
  pixels.set(rgba);
  sourceContext.putImageData(new ImageData(pixels, width, height), 0, 0);

  const normalized = orientation >= 1 && orientation <= 8 ? orientation : 1;
  if (normalized === 1) {
    return {
      source: sourceCanvas,
      width,
      height,
      dispose: () => releaseCanvas(sourceCanvas),
    };
  }

  const swapped = normalized >= 5;
  const outputCanvas = createCanvas(swapped ? height : width, swapped ? width : height);
  const context = get2dContext(outputCanvas);

  switch (normalized) {
    case 2:
      context.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      context.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      context.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      context.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      context.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      context.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      context.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      break;
  }

  context.drawImage(sourceCanvas, 0, 0);
  releaseCanvas(sourceCanvas);

  return {
    source: outputCanvas,
    width: outputCanvas.width,
    height: outputCanvas.height,
    dispose: () => releaseCanvas(outputCanvas),
  };
}

async function decodeTiff(file: File): Promise<DecodedDrawable> {
  try {
    const { default: UTIF } = await import('utif');
    const buffer = await file.arrayBuffer();
    const ifds = UTIF.decode(buffer);
    if (!ifds.length) throw new Error('No TIFF pages were found in this file.');
    const page = ifds[0];
    UTIF.decodeImage(buffer, page, ifds);
    const width = Number(page.width);
    const height = Number(page.height);
    if (!width || !height || !page.data) throw new Error('The first TIFF page is empty.');
    const rgba = UTIF.toRGBA8(page);
    return tiffToDrawable(rgba, width, height, orientationFromTiff(page));
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError(
      'DECODE_FAILED',
      'This TIFF file could not be decoded.',
      'Only standard TIFF files are supported. Multi-page TIFFs use the first page.',
    );
  }
}

async function decodeHeic(file: File): Promise<DecodedDrawable> {
  try {
    const module = await import('heic2any');
    const heic2any = module.default;
    const converted = await heic2any({
      blob: file,
      toType: 'image/png',
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!blob) throw new Error('HEIC decoder returned no image.');
    return decodeBlobInBrowser(blob);
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError(
      'DECODE_FAILED',
      'This HEIC/HEIF image could not be decoded.',
      'Try exporting it as JPG from your phone or photo app, then upload the JPG.',
    );
  }
}

async function decodeSvg(file: File): Promise<DecodedDrawable> {
  const text = await file.text();
  const sanitized = sanitizeSvg(text);
  const decoded = await decodeBlobInBrowser(sanitized.blob, { preferImage: true });
  if (decoded.width < 1 || decoded.height < 1) {
    decoded.dispose();
    throw new ImageProcessingError('CORRUPT_IMAGE', 'The SVG has no usable dimensions.');
  }
  return decoded;
}

async function decodeAvif(file: File): Promise<DecodedDrawable> {
  try {
    return await decodeBlobInBrowser(file);
  } catch {
    try {
      const { decode } = await import('@jsquash/avif');
      const imageData = await decode(await file.arrayBuffer());
      if (!imageData) throw new Error('AVIF decoder returned no image data.');
      return canvasFromImageData(imageData);
    } catch {
      throw new ImageProcessingError(
        'DECODE_FAILED',
        'This AVIF image could not be decoded.',
        'Your browser may not support this AVIF variant. Try converting it with another app first.',
      );
    }
  }
}

async function decodeToDrawable(file: File, format: InputFormatId): Promise<DecodedDrawable> {
  switch (format) {
    case 'tiff':
      return decodeTiff(file);
    case 'heic':
      return decodeHeic(file);
    case 'svg':
      return decodeSvg(file);
    case 'avif':
      return decodeAvif(file);
    default:
      return decodeBlobInBrowser(file, { preferImage: format === 'ico' });
  }
}

async function createThumbnailBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Blob> {
  const scale = Math.min(1, THUMBNAIL_MAX / Math.max(width, height));
  const thumbWidth = Math.max(1, Math.round(width * scale));
  const thumbHeight = Math.max(1, Math.round(height * scale));
  const canvas = createCanvas(thumbWidth, thumbHeight);

  try {
    const context = get2dContext(canvas);
    context.clearRect(0, 0, thumbWidth, thumbHeight);
    context.drawImage(source, 0, 0, thumbWidth, thumbHeight);

    let blob = await canvasToBlob(canvas, 'image/webp', 0.86);
    if (blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/png');
    }
    return blob;
  } finally {
    releaseCanvas(canvas);
  }
}

export async function analyzeImageFile(file: File): Promise<AnalyzedImage> {
  const formatId = await sniffFileFormat(file);
  if (!formatId) {
    throw new ImageProcessingError(
      'UNSUPPORTED_FORMAT',
      'This file is not a supported image or its contents could not be recognized.',
      'Supported inputs: JPG, PNG, WebP, AVIF, GIF, BMP, SVG, ICO, TIFF and HEIC/HEIF.',
    );
  }

  const format = getInputFormat(formatId);
  let decoded: DecodedDrawable | null = null;

  try {
    decoded = await decodeToDrawable(file, formatId);
    assertSourceSize(decoded.width, decoded.height);
    const thumbnailBlob = await createThumbnailBlob(decoded.source, decoded.width, decoded.height);
    return {
      format,
      width: decoded.width,
      height: decoded.height,
      thumbnailBlob,
      frameNotice: frameNoticeFor(formatId),
    };
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError('DECODE_FAILED', toUserMessage(error));
  } finally {
    decoded?.dispose();
  }
}

export async function decodeForProcessing(file: File, format: InputFormatId): Promise<DecodedDrawable> {
  try {
    const decoded = await decodeToDrawable(file, format);
    assertSourceSize(decoded.width, decoded.height);
    return decoded;
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError('DECODE_FAILED', toUserMessage(error));
  }
}
