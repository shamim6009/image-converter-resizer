/**
 * Encodes RGBA pixels as a 24-bit, bottom-up Windows BMP.
 * Transparency must be flattened before this step.
 */
export function encodeBmpRgba(width: number, height: number, rgba: Uint8ClampedArray): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('BMP dimensions must be positive integers.');
  }
  if (rgba.length < width * height * 4) {
    throw new Error('BMP pixel buffer is smaller than the image.');
  }

  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowStride * height;
  const fileSize = 54 + pixelBytes;
  const buffer = new ArrayBuffer(fileSize);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54, true);

  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelBytes, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  for (let y = 0; y < height; y += 1) {
    const sourceRow = (height - 1 - y) * width * 4;
    const targetRow = 54 + y * rowStride;
    for (let x = 0; x < width; x += 1) {
      const source = sourceRow + x * 4;
      const target = targetRow + x * 3;
      bytes[target] = rgba[source + 2];
      bytes[target + 1] = rgba[source + 1];
      bytes[target + 2] = rgba[source];
    }
  }

  return bytes;
}

export function encodeBmp(width: number, height: number, rgba: Uint8ClampedArray): Blob {
  return new Blob([encodeBmpRgba(width, height, rgba)], { type: 'image/bmp' });
}
