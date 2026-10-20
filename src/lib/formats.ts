import type {
  FormatCapabilities,
  InputFormatId,
  InputFormatInfo,
  OutputFormatId,
  OutputFormatInfo,
  ProcessSettings,
} from '../types/image';

export const MAX_FILE_SIZE = 75 * 1024 * 1024;
export const MAX_FILES = 40;
export const MAX_SOURCE_PIXELS = 100_000_000;
export const MAX_SOURCE_DIMENSION = 20_000;

const INPUT_FORMATS: Record<InputFormatId, InputFormatInfo> = {
  jpeg: { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', extension: 'jpg', vector: false },
  png: { id: 'png', label: 'PNG', mime: 'image/png', extension: 'png', vector: false },
  webp: { id: 'webp', label: 'WebP', mime: 'image/webp', extension: 'webp', vector: false },
  avif: { id: 'avif', label: 'AVIF', mime: 'image/avif', extension: 'avif', vector: false },
  gif: { id: 'gif', label: 'GIF', mime: 'image/gif', extension: 'gif', vector: false },
  bmp: { id: 'bmp', label: 'BMP', mime: 'image/bmp', extension: 'bmp', vector: false },
  svg: { id: 'svg', label: 'SVG', mime: 'image/svg+xml', extension: 'svg', vector: true },
  ico: { id: 'ico', label: 'ICO', mime: 'image/x-icon', extension: 'ico', vector: false },
  tiff: { id: 'tiff', label: 'TIFF', mime: 'image/tiff', extension: 'tiff', vector: false },
  heic: { id: 'heic', label: 'HEIC / HEIF', mime: 'image/heic', extension: 'heic', vector: false },
};

const OUTPUT_FORMATS: Record<OutputFormatId, OutputFormatInfo> = {
  jpeg: {
    id: 'jpeg',
    label: 'JPEG',
    mime: 'image/jpeg',
    extension: 'jpg',
    lossy: true,
    transparency: false,
    description: 'Small photos, broad compatibility',
  },
  png: {
    id: 'png',
    label: 'PNG',
    mime: 'image/png',
    extension: 'png',
    lossy: false,
    transparency: true,
    description: 'Lossless with transparency',
  },
  webp: {
    id: 'webp',
    label: 'WebP',
    mime: 'image/webp',
    extension: 'webp',
    lossy: true,
    transparency: true,
    description: 'Modern, small and transparent',
  },
  avif: {
    id: 'avif',
    label: 'AVIF',
    mime: 'image/avif',
    extension: 'avif',
    lossy: true,
    transparency: true,
    description: 'Next-gen compression',
  },
  bmp: {
    id: 'bmp',
    label: 'BMP',
    mime: 'image/bmp',
    extension: 'bmp',
    lossy: false,
    transparency: false,
    description: 'Uncompressed bitmap',
  },
  ico: {
    id: 'ico',
    label: 'ICO',
    mime: 'image/x-icon',
    extension: 'ico',
    lossy: false,
    transparency: true,
    description: 'Square icon, max 256 px',
    maxDimension: 256,
  },
};

export const OUTPUT_FORMAT_ORDER: OutputFormatId[] = ['jpeg', 'png', 'webp', 'avif', 'bmp', 'ico'];
export const INPUT_ACCEPT =
  '.jpg,.jpeg,.png,.webp,.avif,.gif,.bmp,.svg,.ico,.tif,.tiff,.heic,.heif,image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/svg+xml,image/x-icon,image/tiff,image/heic,image/heif';

export function getInputFormat(id: InputFormatId): InputFormatInfo {
  return INPUT_FORMATS[id];
}

export function getOutputFormat(id: OutputFormatId): OutputFormatInfo {
  return OUTPUT_FORMATS[id];
}

export function outputFormatsFor(capabilities: FormatCapabilities): OutputFormatInfo[] {
  return OUTPUT_FORMAT_ORDER.map(getOutputFormat).filter((format) => {
    if (format.id === 'webp') return capabilities.webp;
    if (format.id === 'avif') return capabilities.avif;
    return true;
  });
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let result = '';
  const end = Math.min(bytes.length, start + length);
  for (let index = start; index < end; index += 1) {
    result += String.fromCharCode(bytes[index]);
  }
  return result;
}

function detectIsoBmff(bytes: Uint8Array): InputFormatId | null {
  if (ascii(bytes, 4, 4) !== 'ftyp') return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let boxSize = bytes.length >= 4 ? view.getUint32(0, false) : bytes.length;
  if (boxSize < 12 || boxSize > bytes.length) boxSize = Math.min(bytes.length, 128);
  const brands: string[] = [];
  for (let offset = 8; offset + 4 <= Math.min(boxSize, 96); offset += 4) {
    brands.push(ascii(bytes, offset, 4));
  }

  if (brands.some((brand) => brand === 'avif' || brand === 'avis')) return 'avif';
  if (
    brands.some((brand) =>
      ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'heif', 'mif1', 'msf1'].includes(
        brand,
      ),
    )
  ) {
    return 'heic';
  }
  return null;
}

/**
 * Detects a format from file bytes instead of trusting the filename extension.
 * Only signatures that can be handled by a decoder are accepted.
 */
export function detectInputFormat(bytes: Uint8Array): InputFormatId | null {
  if (bytes.length === 0) return null;

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
    return 'gif';
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if (startsWith(bytes, [0x42, 0x4d])) return 'bmp';
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return 'tiff';
  }
  if (startsWith(bytes, [0x49, 0x49, 0x2b, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2b])) {
    return 'tiff';
  }
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return 'ico';

  const iso = detectIsoBmff(bytes);
  if (iso) return iso;

  const prefixBytes = bytes.subarray(0, Math.min(bytes.length, 4096));
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: false }).decode(prefixBytes).replace(/^\uFEFF/, '').trimStart();
  } catch {
    text = '';
  }
  if (text.startsWith('<') && /<svg[\s>]/i.test(text)) return 'svg';

  return null;
}

export async function sniffFileFormat(file: File): Promise<InputFormatId | null> {
  const header = await file.slice(0, 8192).arrayBuffer();
  return detectInputFormat(new Uint8Array(header));
}

export function isAnimatedSignature(format: InputFormatId, bytes: Uint8Array): boolean {
  if (format === 'gif') {
    // GIFs with more than one image descriptor are animated. A single-frame GIF is safe either way,
    // but the UI still explains that GIF output is static.
    let descriptors = 0;
    for (let index = 0; index < bytes.length - 1; index += 1) {
      if (bytes[index] === 0x2c) descriptors += 1;
      if (descriptors > 1) return true;
    }
    return false;
  }
  if (format === 'webp') {
    return ascii(bytes, 0, Math.min(bytes.length, 4096)).includes('ANIM');
  }
  if (format === 'png') {
    return ascii(bytes, 0, Math.min(bytes.length, 4096)).includes('acTL');
  }
  if (format === 'avif') {
    return ascii(bytes, 0, 32).includes('avis');
  }
  return false;
}

export function frameNoticeFor(format: InputFormatId): string | undefined {
  if (format === 'gif') {
    return 'GIF input is processed as a static first frame. Animation is not preserved.';
  }
  return undefined;
}

export function recommendedFormatForInput(
  format: InputFormatId,
  capabilities: FormatCapabilities,
): OutputFormatId {
  switch (format) {
    case 'jpeg':
      return 'jpeg';
    case 'png':
      return 'png';
    case 'webp':
      return capabilities.webp ? 'webp' : 'png';
    case 'avif':
      return capabilities.avif ? 'avif' : 'webp';
    case 'bmp':
      return 'bmp';
    case 'ico':
      return 'png';
    case 'svg':
    case 'tiff':
      return 'png';
    case 'heic':
    case 'gif':
    default:
      return 'jpeg';
  }
}

export function sanitizeBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const raw = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  const cleaned = raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .replace(/-+/g, '-')
    .trim();

  if (!cleaned) return 'image';
  return cleaned.slice(0, 100);
}

export function outputFilename(baseName: string, format: OutputFormatId): string {
  return `${sanitizeBaseName(baseName)}.${getOutputFormat(format).extension}`;
}

export function createUniqueFilename(filename: string, used: Set<string>): string {
  const lower = filename.toLowerCase();
  if (!used.has(lower)) {
    used.add(lower);
    return filename;
  }

  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : '';
  let counter = 2;
  let candidate = `${base}-${counter}${extension}`;
  while (used.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${base}-${counter}${extension}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const decimals = value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

export function formatDimensions(width: number, height: number): string {
  return `${width.toLocaleString()} × ${height.toLocaleString()}`;
}

export function sizeChangePercent(originalSize: number, outputSize: number): number | null {
  if (!Number.isFinite(originalSize) || originalSize <= 0) return null;
  return ((outputSize - originalSize) / originalSize) * 100;
}

export function settingsSignature(
  settings: ProcessSettings,
  capabilities: FormatCapabilities,
): string {
  return JSON.stringify({
    ...settings,
    customWidth: settings.customWidth ?? null,
    customHeight: settings.customHeight ?? null,
    encoder: settings.format === 'avif' ? (capabilities.avifNative ? 'native' : 'wasm') : 'native',
  });
}

function matchesSignature(bytes: Uint8Array, format: OutputFormatId): boolean {
  switch (format) {
    case 'jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'webp':
      return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP';
    case 'avif': {
      if (ascii(bytes, 4, 4) !== 'ftyp') return false;
      for (let offset = 8; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
        const brand = ascii(bytes, offset, 4);
        if (brand === 'avif' || brand === 'avis' || brand === 'mif1' || brand === 'msf1') return true;
      }
      return false;
    }
    case 'bmp':
      return startsWith(bytes, [0x42, 0x4d]);
    case 'ico':
      return startsWith(bytes, [0x00, 0x00, 0x01, 0x00]);
    default:
      return false;
  }
}

/**
 * Checks the encoded bytes themselves, not just the Blob's claimed MIME type.
 */
export async function validateEncodedBlob(blob: Blob, format: OutputFormatId): Promise<void> {
  const expected = getOutputFormat(format);
  if (blob.size === 0) {
    throw new Error('Encoder returned an empty file.');
  }
  if (blob.type && blob.type !== expected.mime && !(format === 'ico' && blob.type === 'image/vnd.microsoft.icon')) {
    throw new Error(`Encoder returned ${blob.type} instead of ${expected.mime}.`);
  }
  const header = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
  if (!matchesSignature(header, format)) {
    throw new Error(`Encoded bytes are not a valid ${expected.label} file.`);
  }
}
