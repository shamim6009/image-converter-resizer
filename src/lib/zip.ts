import type { ProcessedResult } from '../types/image';
import { ImageProcessingError } from './errors';
import { createUniqueFilename } from './formats';

export async function createResultsZip(
  results: ProcessedResult[],
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  if (results.length === 0) {
    throw new ImageProcessingError('ZIP_FAILED', 'There are no processed images to add to the ZIP.');
  }

  try {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (const result of results) {
      const filename = createUniqueFilename(result.filename, usedNames);
      zip.file(filename, result.blob);
    }

    return await zip.generateAsync(
      {
        type: 'blob',
        compression: 'STORE',
        platform: 'DOS',
      },
      (metadata) => onProgress?.(metadata.percent),
    );
  } catch (error) {
    if (error instanceof ImageProcessingError) throw error;
    throw new ImageProcessingError(
      'ZIP_FAILED',
      'The ZIP archive could not be generated. Try downloading the images individually.',
    );
  }
}
