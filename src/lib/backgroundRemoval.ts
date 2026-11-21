import { canvasToBlob, createCanvas, get2dContext, releaseCanvas } from './canvas';
import { decodeForProcessing } from './decoder';
import { ImageProcessingError } from './errors';
import { sniffFileFormat } from './formats';

export type BackgroundRemovalStage = 'model' | 'processing';

export type BackgroundRemovalProgress = (stage: BackgroundRemovalStage, percent: number) => void;

/** Longest side sent to the segmentation model. Larger images are scaled down first. */
const MAX_REMOVAL_DIMENSION = 4096;

/**
 * Removes the background from an image blob entirely in the browser.
 * The AI model is downloaded once (and cached by the browser); the image
 * itself is never uploaded.
 */
export async function removeImageBackground(
  input: Blob,
  onProgress?: BackgroundRemovalProgress,
): Promise<Blob> {
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    return await removeBackground(input, {
      output: { format: 'image/png' },
      progress: (key, current, total) => {
        if (!onProgress) return;
        const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
        onProgress(key.startsWith('fetch') ? 'model' : 'processing', percent);
      },
    });
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError(
      'CANVAS_FAILED',
      'The background could not be removed from this image.',
      'Check your internet connection (the AI model is downloaded on first use) and try again.',
    );
  }
}

/** Draws any drawable to a PNG blob, scaled down to a safe size when needed. */
export async function drawableToPngBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxDimension = MAX_REMOVAL_DIMENSION,
): Promise<Blob> {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = createCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  try {
    const context = get2dContext(canvas);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return await canvasToBlob(canvas, 'image/png');
  } finally {
    releaseCanvas(canvas);
  }
}

/** Decodes any supported input file (including HEIC, TIFF and SVG) into a PNG blob. */
export async function fileToPngBlob(file: File, maxDimension = MAX_REMOVAL_DIMENSION): Promise<Blob> {
  const formatId = await sniffFileFormat(file);
  if (!formatId) {
    throw new ImageProcessingError(
      'UNSUPPORTED_FORMAT',
      'This file is not a supported image or its contents could not be recognized.',
    );
  }
  const decoded = await decodeForProcessing(file, formatId);
  try {
    return await drawableToPngBlob(decoded.source, decoded.width, decoded.height, maxDimension);
  } finally {
    decoded.dispose();
  }
}

export async function removeBackgroundFromFile(
  file: File,
  onProgress?: BackgroundRemovalProgress,
): Promise<Blob> {
  const png = await fileToPngBlob(file);
  return removeImageBackground(png, onProgress);
}
