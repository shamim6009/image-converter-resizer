import { describe, expect, it } from 'vitest';
import { buildIco } from '../ico';

describe('buildIco', () => {
  it('wraps PNG payloads in a valid ICO container', () => {
    const png = new Uint8Array([1, 2, 3, 4]);
    const ico = buildIco([{ size: 16, png }]);
    const view = new DataView(ico.buffer);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(1);

    expect(ico[6]).toBe(16);
    expect(ico[7]).toBe(16);
    expect(view.getUint16(10, true)).toBe(1);
    expect(view.getUint16(12, true)).toBe(32);
    expect(view.getUint32(14, true)).toBe(png.length);
    expect(view.getUint32(18, true)).toBe(22);
    expect(Array.from(ico.slice(22))).toEqual([1, 2, 3, 4]);
  });

  it('encodes a 256px entry as a zero byte', () => {
    const ico = buildIco([{ size: 256, png: new Uint8Array([9]) }]);
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });

  it('supports multiple entries', () => {
    const ico = buildIco([
      { size: 16, png: new Uint8Array([1]) },
      { size: 32, png: new Uint8Array([2]) },
    ]);
    const view = new DataView(ico.buffer);
    expect(view.getUint16(4, true)).toBe(2);
  });

  it('rejects an empty icon', () => {
    expect(() => buildIco([])).toThrowError(/between 1 and 255/i);
  });

  it('rejects out-of-range dimensions', () => {
    expect(() => buildIco([{ size: 300, png: new Uint8Array([1]) }])).toThrowError(/between 1 and 256/i);
  });
});
