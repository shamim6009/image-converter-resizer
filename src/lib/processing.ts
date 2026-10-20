import type {
  FormatCapabilities,
  ProcessedResult,
  ProcessSettings,
  SourceAsset,
} from '../types/image';
import { decodeForProcessing } from './decoder';
import { encodeComposition } from './encoder';
import { outputFilename, settingsSignature } from './formats';
import { composeCanvas } from './render';

export async function processImage(
  asset: SourceAsset,
  settings: ProcessSettings,
  capabilities: FormatCapabilities,
): Promise<ProcessedResult> {
  const startedAt = performance.now();
  const decoded = await decodeForProcessing(asset.file, asset.format.id);

  try {
    const composition = composeCanvas(
      decoded.source,
      decoded.width,
      decoded.height,
      settings,
    );

    try {
      const encoded = await encodeComposition(composition.canvas, settings, capabilities);
      const url = URL.createObjectURL(encoded.blob);
      return {
        sourceId: asset.id,
        blob: encoded.blob,
        url,
        previewUrl: url,
        previewUsesFallback: false,
        filename: outputFilename(asset.baseName, encoded.format),
        format: encoded.format,
        mime: encoded.mime,
        width: encoded.width,
        height: encoded.height,
        size: encoded.blob.size,
        originalSize: asset.size,
        processingMs: Math.max(1, Math.round(performance.now() - startedAt)),
        settingsSignature: settingsSignature(settings, capabilities),
      };
    } finally {
      composition.canvas.width = 0;
      composition.canvas.height = 0;
    }
  } finally {
    decoded.dispose();
  }
}
