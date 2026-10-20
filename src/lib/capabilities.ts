import type { FormatCapabilities } from '../types/image';
import { canvasToBlob, createCanvas, get2dContext, releaseCanvas } from './canvas';

let cached: Promise<FormatCapabilities> | null = null;

async function probeEncoder(type: string): Promise<boolean> {
  const canvas = createCanvas(8, 8);
  try {
    const context = get2dContext(canvas);
    context.fillStyle = '#4F46E5';
    context.fillRect(0, 0, 8, 8);
    const blob = await canvasToBlob(canvas, type, 0.8);
    return blob.type === type && blob.size > 0;
  } catch {
    return false;
  } finally {
    releaseCanvas(canvas);
  }
}

export function detectFormatCapabilities(): Promise<FormatCapabilities> {
  if (cached) return cached;

  cached = (async () => {
    const [webp, avifNative] = await Promise.all([
      probeEncoder('image/webp'),
      probeEncoder('image/avif'),
    ]);
    const webAssembly =
      typeof WebAssembly === 'object' &&
      typeof WebAssembly.instantiateStreaming === 'function' &&
      typeof WebAssembly.instantiate === 'function';

    return {
      webp,
      avifNative,
      avif: avifNative || webAssembly,
      webAssembly,
    };
  })();

  return cached;
}
