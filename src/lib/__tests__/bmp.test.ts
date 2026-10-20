import { describe, expect, it } from 'vitest';
import { encodeBmpRgba } from '../bmp';

describe('encodeBmpRgba', () => {
  it('writes a valid BMP header', () => {
    const rgba = new Uint8ClampedArray(2 * 1 * 4);
    const bmp = encodeBmpRgba(2, 1, rgba);
    expect(bmp[0]).toBe(0x42);
    expect(bmp[1]).toBe(0x4d);

    const view = new DataView(bmp.buffer);
    const rowStride = Math.ceil((2 * 3) / 4) * 4;
    expect(view.getUint32(2, true)).toBe(54 + rowStride);
    expect(view.getUint32(10, true)).toBe(54);
    expect(view.getInt32(18, true)).toBe(2);
    expect(view.getInt32(22, true)).toBe(1);
    expect(view.getUint16(28, true)).toBe(24);
  });

  it('stores pixels as bottom-up BGR', () => {
    const rgba = new Uint8ClampedArray([
      10, 20, 30, 255,
      40, 50, 60, 255,
    ]);
    const bmp = encodeBmpRgba(2, 1, rgba);
    expect(bmp[54]).toBe(30);
    expect(bmp[55]).toBe(20);
    expect(bmp[56]).toBe(10);
    expect(bmp[57]).toBe(60);
    expect(bmp[58]).toBe(50);
    expect(bmp[59]).toBe(40);
  });

  it('rejects invalid dimensions', () => {
    expect(() => encodeBmpRgba(0, 10, new Uint8ClampedArray(40))).toThrowError(/positive integers/i);
  });

  it('rejects a short pixel buffer', () => {
    expect(() => encodeBmpRgba(4, 4, new Uint8ClampedArray(4))).toThrowError(/smaller than the image/i);
  });
});
