import { describe, expect, it } from 'vitest';
import {
  createUniqueFilename,
  detectInputFormat,
  formatBytes,
  formatDimensions,
  outputFilename,
  recommendedFormatForInput,
  sanitizeBaseName,
  sizeChangePercent,
} from '../formats';

function bytes(values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function asciiBytes(text: string, padTo = 0): Uint8Array {
  const out = new Uint8Array(Math.max(text.length, padTo));
  for (let index = 0; index < text.length; index += 1) out[index] = text.charCodeAt(index);
  return out;
}

describe('detectInputFormat', () => {
  it('detects JPEG', () => {
    expect(detectInputFormat(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
  });

  it('detects PNG', () => {
    expect(detectInputFormat(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
  });

  it('detects GIF', () => {
    expect(detectInputFormat(asciiBytes('GIF89a' + '....'))).toBe('gif');
  });

  it('detects WebP via RIFF container', () => {
    const data = asciiBytes('RIFF????WEBP', 12);
    expect(detectInputFormat(data)).toBe('webp');
  });

  it('detects BMP', () => {
    expect(detectInputFormat(bytes([0x42, 0x4d, 0x00, 0x00]))).toBe('bmp');
  });

  it('detects TIFF little and big endian', () => {
    expect(detectInputFormat(bytes([0x49, 0x49, 0x2a, 0x00]))).toBe('tiff');
    expect(detectInputFormat(bytes([0x4d, 0x4d, 0x00, 0x2a]))).toBe('tiff');
  });

  it('detects ICO', () => {
    expect(detectInputFormat(bytes([0x00, 0x00, 0x01, 0x00]))).toBe('ico');
  });

  it('detects AVIF from the ISO-BMFF brand', () => {
    const data = new Uint8Array(24);
    for (let index = 0; index < 4; index += 1) data[index] = 0;
    data[3] = 24;
    const write = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i += 1) data[offset + i] = text.charCodeAt(i);
    };
    write(4, 'ftyp');
    write(8, 'avif');
    expect(detectInputFormat(data)).toBe('avif');
  });

  it('detects SVG from text content', () => {
    const data = asciiBytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectInputFormat(data)).toBe('svg');
  });

  it('returns null for unknown bytes', () => {
    expect(detectInputFormat(bytes([1, 2, 3, 4, 5, 6]))).toBe(null);
  });

  it('returns null for empty input', () => {
    expect(detectInputFormat(new Uint8Array(0))).toBe(null);
  });
});

describe('formatBytes', () => {
  it('formats small byte counts', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('handles invalid input', () => {
    expect(formatBytes(-10)).toBe('—');
  });
});

describe('formatDimensions', () => {
  it('formats width by height', () => {
    expect(formatDimensions(1920, 1080)).toContain('1,920');
  });
});

describe('sizeChangePercent', () => {
  it('reports a reduction as a negative number', () => {
    expect(sizeChangePercent(1000, 400)).toBeCloseTo(-60);
  });

  it('returns null for unusable originals', () => {
    expect(sizeChangePercent(0, 100)).toBe(null);
  });
});

describe('sanitizeBaseName', () => {
  it('strips the extension and unsafe characters', () => {
    expect(sanitizeBaseName('my photo?.png')).toBe('my photo-');
  });

  it('falls back to image when empty', () => {
    expect(sanitizeBaseName('...')).toBe('image');
  });
});

describe('outputFilename', () => {
  it('uses the target extension, never the original', () => {
    expect(outputFilename('holiday.png', 'webp')).toBe('holiday.webp');
  });
});

describe('createUniqueFilename', () => {
  it('appends a counter for duplicates', () => {
    const used = new Set<string>();
    expect(createUniqueFilename('a.png', used)).toBe('a.png');
    expect(createUniqueFilename('a.png', used)).toBe('a-2.png');
    expect(createUniqueFilename('a.png', used)).toBe('a-3.png');
  });
});

describe('recommendedFormatForInput', () => {
  const capabilities = { webp: true, avif: true, avifNative: false, webAssembly: true };

  it('keeps PNG as PNG', () => {
    expect(recommendedFormatForInput('png', capabilities)).toBe('png');
  });

  it('falls back to PNG when WebP is unavailable', () => {
    expect(recommendedFormatForInput('webp', { ...capabilities, webp: false })).toBe('png');
  });

  it('maps HEIC to JPEG', () => {
    expect(recommendedFormatForInput('heic', capabilities)).toBe('jpeg');
  });
});
