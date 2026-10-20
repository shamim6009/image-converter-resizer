export type InputFormatId =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'avif'
  | 'gif'
  | 'bmp'
  | 'svg'
  | 'ico'
  | 'tiff'
  | 'heic';

export type OutputFormatId = 'jpeg' | 'png' | 'webp' | 'avif' | 'bmp' | 'ico';

export type ResizeMode = 'original' | 'auto' | 'custom' | 'percentage';
export type AutoResizeBy = 'width' | 'height' | 'longest' | 'max';
export type FitMode = 'contain' | 'cover' | 'stretch' | 'fit-within';
export type WorkflowTab = 'convert' | 'resize' | 'bulk' | 'compress';
export type ImageStatus = 'ready' | 'processing' | 'completed' | 'failed' | 'canceled';

export interface InputFormatInfo {
  id: InputFormatId;
  label: string;
  mime: string;
  extension: string;
  vector: boolean;
}

export interface OutputFormatInfo {
  id: OutputFormatId;
  label: string;
  mime: string;
  extension: string;
  lossy: boolean;
  transparency: boolean;
  description: string;
  maxDimension?: number;
}

export interface FormatCapabilities {
  webp: boolean;
  avif: boolean;
  avifNative: boolean;
  webAssembly: boolean;
}

export interface SourceAsset {
  id: string;
  file: File;
  name: string;
  baseName: string;
  format: InputFormatInfo;
  width: number;
  height: number;
  size: number;
  thumbnailUrl: string;
  frameNotice?: string;
  importedAt: number;
}

export interface ProcessSettings {
  format: OutputFormatId;
  quality: number;
  resizeMode: ResizeMode;
  autoBy: AutoResizeBy;
  autoValue: number;
  maxWidth: number;
  maxHeight: number;
  customWidth: number | null;
  customHeight: number | null;
  preserveAspect: boolean;
  fitMode: FitMode;
  percentage: number;
  background: string;
  transparentBackground: boolean;
}

export interface ProcessedResult {
  sourceId: string;
  blob: Blob;
  url: string;
  previewUrl: string;
  previewUsesFallback: boolean;
  filename: string;
  format: OutputFormatId;
  mime: string;
  width: number;
  height: number;
  size: number;
  originalSize: number;
  processingMs: number;
  settingsSignature: string;
}

export interface TargetGeometry {
  outputWidth: number;
  outputHeight: number;
  drawWidth: number;
  drawHeight: number;
  drawX: number;
  drawY: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  upscaled: boolean;
  notes: string[];
}

export interface ImportIssue {
  id: string;
  filename: string;
  message: string;
}

export interface BatchProgress {
  running: boolean;
  done: number;
  total: number;
  succeeded: number;
  failed: number;
  canceled: boolean;
}

export interface ZipProgress {
  running: boolean;
  percent: number;
  stage: 'preparing' | 'packaging';
}

export interface FormatEncoderProbe {
  webp: boolean;
  avifNative: boolean;
}
