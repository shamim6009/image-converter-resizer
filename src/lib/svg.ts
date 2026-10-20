import { ImageProcessingError } from './errors';

const BLOCKED_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'canvas',
  'link',
  'meta',
  'style',
  'base',
]);

const BLOCKED_ATTRIBUTES = new Set([
  'externalresourcesrequired',
  'xml:base',
  'src',
]);

const MAX_SVG_BYTES = 15 * 1024 * 1024;
const MAX_SVG_RASTER = 8192;

export interface SanitizedSvg {
  blob: Blob;
  width: number;
  height: number;
}

function parseLength(value: string | null): number | null {
  if (!value) return null;
  const match = /^\s*([\d.]+)\s*(?:px)?\s*$/i.exec(value);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseViewBox(value: string | null): [number, number, number, number] | null {
  if (!value) return null;
  const parts = value.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  if (parts[2] <= 0 || parts[3] <= 0) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
}

function isSafeReference(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith('#')) return true;
  return /^data:image\/(png|jpe?g|webp|gif);base64,/.test(normalized);
}

function sanitizeStyle(value: string): string | null {
  const normalized = value.toLowerCase();
  if (
    normalized.includes('url(') ||
    normalized.includes('@import') ||
    normalized.includes('expression(') ||
    normalized.includes('behavior:') ||
    normalized.includes('javascript:')
  ) {
    return null;
  }
  return value;
}

/**
 * SVG is parsed as XML, stripped of active content and external references,
 * then rasterized through an <img> element. Markup is never inserted into the DOM.
 */
export function sanitizeSvg(source: string): SanitizedSvg {
  if (source.length > MAX_SVG_BYTES) {
    throw new ImageProcessingError(
      'FILE_TOO_LARGE',
      'This SVG file is too large to process safely (15 MB maximum).',
    );
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;

  if (
    !root ||
    root.nodeName.toLowerCase() === 'parsererror' ||
    document.getElementsByTagName('parsererror').length > 0
  ) {
    throw new ImageProcessingError('CORRUPT_IMAGE', 'This SVG file contains invalid XML.');
  }
  if (root.localName.toLowerCase() !== 'svg') {
    throw new ImageProcessingError('UNSUPPORTED_FORMAT', 'The file does not contain an SVG root element.');
  }

  if (document.doctype) {
    document.removeChild(document.doctype);
  }

  const elements = Array.from(document.querySelectorAll('*'));
  for (const element of elements) {
    const tag = element.localName.toLowerCase();
    if (BLOCKED_ELEMENTS.has(tag)) {
      element.remove();
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      if (name.startsWith('on') || BLOCKED_ATTRIBUTES.has(name)) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === 'href' || name === 'xlink:href') {
        if (!isSafeReference(value)) {
          element.removeAttribute(attribute.name);
        }
        continue;
      }

      if (name === 'style') {
        const safe = sanitizeStyle(value);
        if (safe === null) element.removeAttribute(attribute.name);
        else element.setAttribute(attribute.name, safe);
        continue;
      }

      if (/^\s*(javascript|vbscript|data:text\/html)/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  const viewBox = parseViewBox(root.getAttribute('viewBox'));
  let width = parseLength(root.getAttribute('width'));
  let height = parseLength(root.getAttribute('height'));

  if (viewBox) {
    if (width && !height) height = (width * viewBox[3]) / viewBox[2];
    if (height && !width) width = (height * viewBox[2]) / viewBox[3];
    if (!width && !height) {
      width = viewBox[2];
      height = viewBox[3];
    }
  }

  if (!width && !height) {
    width = 1024;
    height = 1024;
  }

  width = width ?? height ?? 1024;
  height = height ?? width;

  const scale = Math.min(1, MAX_SVG_RASTER / width, MAX_SVG_RASTER / height);
  const rasterWidth = Math.max(1, Math.round(width * scale));
  const rasterHeight = Math.max(1, Math.round(height * scale));

  root.setAttribute('width', String(rasterWidth));
  root.setAttribute('height', String(rasterHeight));
  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const serialized = new XMLSerializer().serializeToString(root);
  return {
    blob: new Blob([serialized], { type: 'image/svg+xml' }),
    width: rasterWidth,
    height: rasterHeight,
  };
}
