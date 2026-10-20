export type ErrorCode =
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'DECODE_FAILED'
  | 'CORRUPT_IMAGE'
  | 'SOURCE_TOO_LARGE'
  | 'INVALID_DIMENSIONS'
  | 'DIMENSIONS_TOO_LARGE'
  | 'CANVAS_FAILED'
  | 'ENCODER_UNAVAILABLE'
  | 'ENCODE_FAILED'
  | 'OUTPUT_VALIDATION_FAILED'
  | 'CANCELED'
  | 'ZIP_FAILED'
  | 'UNKNOWN';

export class ImageProcessingError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;

  constructor(code: ErrorCode, message: string, hint?: string) {
    super(message);
    this.name = 'ImageProcessingError';
    this.code = code;
    this.hint = hint;
  }
}

const FRIENDLY_FALLBACK = 'Something went wrong while processing this image. Please try another file.';

export function toUserMessage(error: unknown): string {
  if (error instanceof ImageProcessingError) {
    return error.message;
  }

  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError') {
      return 'The browser ran out of memory while processing this image. Try a smaller output size.';
    }
    if (error.name === 'NotSupportedError') {
      return 'This image or output format is not supported by your browser.';
    }
  }

  if (error instanceof Error && error.message) {
    const message = error.message.toLowerCase();
    if (message.includes('memory') || message.includes('allocation')) {
      return 'The browser ran out of memory. Try a smaller output size.';
    }
    if (message.includes('canvas') || message.includes('image data')) {
      return 'The image is too large for this browser to render. Try a smaller output size or another image.';
    }
    if (message.includes('decode') || message.includes('heic') || message.includes('tiff')) {
      return 'This image could not be decoded. It may be corrupted or use an unsupported variant.';
    }
  }

  return FRIENDLY_FALLBACK;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof ImageProcessingError && error.code === 'CANCELED';
}
