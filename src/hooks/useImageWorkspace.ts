import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BatchProgress,
  FormatCapabilities,
  ImageStatus,
  ImportIssue,
  OutputFormatId,
  ProcessedResult,
  ProcessSettings,
  SourceAsset,
  ZipProgress,
} from '../types/image';
import type { ToastType } from './useToasts';
import { detectFormatCapabilities } from '../lib/capabilities';
import { analyzeImageFile } from '../lib/decoder';
import { downloadBlob, triggerDownload } from '../lib/download';
import { ImageProcessingError, toUserMessage } from '../lib/errors';
import {
  MAX_FILE_SIZE,
  MAX_FILES,
  formatBytes,
  outputFormatsFor,
  recommendedFormatForInput,
  sanitizeBaseName,
} from '../lib/formats';
import { processImage } from '../lib/processing';
import { DEFAULT_SETTINGS } from '../lib/settings';
import { createResultsZip } from '../lib/zip';

type Notify = (message: string, type?: ToastType) => void;

export interface ImportProgress {
  done: number;
  total: number;
  currentName: string;
}

type ProcessOutcome = {
  completed: number;
  failed: number;
  canceled: boolean;
};

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

const EMPTY_BATCH: BatchProgress = {
  running: false,
  done: 0,
  total: 0,
  succeeded: 0,
  failed: 0,
  canceled: false,
};

const EMPTY_ZIP: ZipProgress = {
  running: false,
  percent: 0,
  stage: 'preparing',
};

export function useImageWorkspace(notify: Notify) {
  const [sources, setSourcesState] = useState<SourceAsset[]>([]);
  const [settings, setSettingsState] = useState<ProcessSettings>(DEFAULT_SETTINGS);
  const [results, setResultsState] = useState<Record<string, ProcessedResult>>({});
  const [statuses, setStatuses] = useState<Record<string, ImageStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [selectedIds, setSelectedIdsState] = useState<Set<string>>(new Set());
  const [importIssues, setImportIssues] = useState<ImportIssue[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [capabilities, setCapabilities] = useState<FormatCapabilities>({
    webp: true,
    avif: true,
    avifNative: false,
    webAssembly: true,
  });
  const [capabilitiesReady, setCapabilitiesReady] = useState(false);
  const [batch, setBatch] = useState<BatchProgress>(EMPTY_BATCH);
  const [zip, setZip] = useState<ZipProgress>(EMPTY_ZIP);

  const sourcesRef = useRef<SourceAsset[]>([]);
  const settingsRef = useRef<ProcessSettings>(DEFAULT_SETTINGS);
  const resultsRef = useRef<Record<string, ProcessedResult>>({});
  const activeRef = useRef<string | null>(null);
  const selectedRef = useRef<Set<string>>(new Set());
  const capabilitiesRef = useRef(capabilities);
  const formatManualRef = useRef(false);
  const generationRef = useRef(0);
  const batchAbortRef = useRef(false);
  const batchRunIdRef = useRef(0);
  const batchIdsRef = useRef<string[]>([]);
  const autoTimerRef = useRef<number | null>(null);
  const importChainRef = useRef<Promise<void>>(Promise.resolve());
  const importCountRef = useRef(0);
  const seenFingerprintsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  const setSources = useCallback((next: SourceAsset[]) => {
    sourcesRef.current = next;
    setSourcesState(next);
  }, []);

  const setActive = useCallback((id: string | null) => {
    activeRef.current = id;
    setActiveIdState(id);
  }, []);

  const setSelection = useCallback((next: Set<string>) => {
    selectedRef.current = next;
    setSelectedIdsState(next);
  }, []);

  const setStatus = useCallback((id: string, status: ImageStatus) => {
    setStatuses((current) => ({ ...current, [id]: status }));
  }, []);

  const removeStatus = useCallback((id: string) => {
    setStatuses((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const setError = useCallback((id: string, message: string | null) => {
    setErrors((current) => {
      const next = { ...current };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }, []);

  const storeResult = useCallback((id: string, result: ProcessedResult) => {
    const previous = resultsRef.current[id];
    if (previous) URL.revokeObjectURL(previous.url);
    const next = { ...resultsRef.current, [id]: result };
    resultsRef.current = next;
    setResultsState(next);
  }, []);

  const removeResult = useCallback((id: string) => {
    const previous = resultsRef.current[id];
    if (!previous) return;
    URL.revokeObjectURL(previous.url);
    const next = { ...resultsRef.current };
    delete next[id];
    resultsRef.current = next;
    setResultsState(next);
  }, []);

  const clearAllResults = useCallback(() => {
    Object.values(resultsRef.current).forEach((result) => URL.revokeObjectURL(result.url));
    resultsRef.current = {};
    setResultsState({});
  }, []);

  const cancelAutoTimer = useCallback(() => {
    if (autoTimerRef.current !== null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const sourceExists = useCallback((id: string) => {
    return sourcesRef.current.some((source) => source.id === id);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<ProcessSettings>) => {
      if (Object.prototype.hasOwnProperty.call(patch, 'format')) {
        formatManualRef.current = true;
      }

      generationRef.current += 1;
      batchAbortRef.current = true;
      batchRunIdRef.current += 1;
      batchIdsRef.current = [];
      cancelAutoTimer();
      clearAllResults();
      setErrors({});
      setStatuses(() => {
        const next: Record<string, ImageStatus> = {};
        sourcesRef.current.forEach((source) => {
          next[source.id] = 'ready';
        });
        return next;
      });
      setBatch(EMPTY_BATCH);

      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setSettingsState(next);
    },
    [cancelAutoTimer, clearAllResults],
  );

  const resetSettings = useCallback(() => {
    formatManualRef.current = false;
    updateSettings(DEFAULT_SETTINGS);
  }, [updateSettings]);

  useEffect(() => {
    let alive = true;
    detectFormatCapabilities()
      .then((detected) => {
        if (!alive) return;
        capabilitiesRef.current = detected;
        setCapabilities(detected);
        setCapabilitiesReady(true);

        const available = outputFormatsFor(detected).some(
          (format) => format.id === settingsRef.current.format,
        );
        if (!available) {
          const fallback: OutputFormatId = detected.webp ? 'webp' : 'jpeg';
          const next: ProcessSettings = { ...settingsRef.current, format: fallback };
          settingsRef.current = next;
          setSettingsState(next);
        }
      })
      .catch(() => {
        if (alive) setCapabilitiesReady(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      batchAbortRef.current = true;
      batchRunIdRef.current += 1;
      if (autoTimerRef.current !== null) window.clearTimeout(autoTimerRef.current);
      Object.values(resultsRef.current).forEach((result) => URL.revokeObjectURL(result.url));
      sourcesRef.current.forEach((source) => URL.revokeObjectURL(source.thumbnailUrl));
    };
  }, []);

  const runSinglePreview = useCallback(
    async (asset: SourceAsset, snapshot: ProcessSettings, generation: number) => {
      if (generation !== generationRef.current || !sourceExists(asset.id)) return;

      setStatus(asset.id, 'processing');
      setError(asset.id, null);

      try {
        const result = await processImage(asset, snapshot, capabilitiesRef.current);
        if (generation !== generationRef.current || !sourceExists(asset.id)) {
          URL.revokeObjectURL(result.url);
          return;
        }
        storeResult(asset.id, result);
        setStatus(asset.id, 'completed');
      } catch (error) {
        if (generation !== generationRef.current || !sourceExists(asset.id)) return;
        setStatus(asset.id, 'failed');
        setError(asset.id, toUserMessage(error));
      }
    },
    [setError, setStatus, sourceExists, storeResult],
  );

  useEffect(() => {
    if (!capabilitiesReady) return;
    const asset = sources.find((source) => source.id === activeId);
    if (!asset) return;
    if (batch.running && selectedRef.current.has(asset.id)) return;
    if (resultsRef.current[asset.id]) return;

    const currentStatus = statuses[asset.id];
    if (currentStatus && currentStatus !== 'ready') return;

    const generation = generationRef.current;
    const timer = window.setTimeout(() => {
      autoTimerRef.current = null;
      void runSinglePreview(asset, settings, generation);
    }, 420);
    autoTimerRef.current = timer;

    return () => {
      window.clearTimeout(timer);
      if (autoTimerRef.current === timer) autoTimerRef.current = null;
    };
  }, [activeId, batch.running, capabilitiesReady, runSinglePreview, settings, sources, statuses]);

  const addImportIssues = useCallback((items: Array<{ filename: string; message: string }>) => {
    if (!items.length) return;
    setImportIssues((current) => {
      const additions = items.map((item) => ({
        id: createId('issue'),
        filename: item.filename,
        message: item.message,
      }));
      return [...current, ...additions].slice(-20);
    });
  }, []);

  const importFilesNow = useCallback(
    async (files: File[]) => {
      const remaining = Math.max(0, MAX_FILES - sourcesRef.current.length);
      if (remaining === 0) {
        addImportIssues([
          {
            filename: files[0]?.name ?? 'Files',
            message: `The upload limit is ${MAX_FILES} images. Remove some images before adding more.`,
          },
        ]);
        notify(`The upload limit is ${MAX_FILES} images.`, 'warning');
        return;
      }

      const allowed = files.slice(0, remaining);
      const excess = files.slice(remaining);
      if (excess.length) {
        addImportIssues(
          excess.map((file) => ({
            filename: file.name,
            message: `Skipped because the upload limit is ${MAX_FILES} images.`,
          })),
        );
      }

      let done = 0;
      let succeeded = 0;
      let failed = 0;
      const issues: Array<{ filename: string; message: string }> = [];

      setImportProgress({ done: 0, total: allowed.length, currentName: allowed[0]?.name ?? '' });

      await mapWithConcurrency(allowed, 2, async (file) => {
        setImportProgress((current) => ({
          done: current?.done ?? done,
          total: allowed.length,
          currentName: file.name,
        }));

        if (file.size === 0) {
          issues.push({ filename: file.name, message: 'This file is empty.' });
          failed += 1;
          done += 1;
          setImportProgress({ done, total: allowed.length, currentName: file.name });
          return;
        }
        if (file.size > MAX_FILE_SIZE) {
          issues.push({
            filename: file.name,
            message: `File is larger than ${formatBytes(MAX_FILE_SIZE)}.`,
          });
          failed += 1;
          done += 1;
          setImportProgress({ done, total: allowed.length, currentName: file.name });
          return;
        }

        const key = fingerprint(file);
        if (seenFingerprintsRef.current.has(key)) {
          issues.push({ filename: file.name, message: 'This image has already been added.' });
          failed += 1;
          done += 1;
          setImportProgress({ done, total: allowed.length, currentName: file.name });
          return;
        }
        seenFingerprintsRef.current.add(key);

        try {
          const analyzed = await analyzeImageFile(file);
          if (!mountedRef.current) {
            seenFingerprintsRef.current.delete(key);
            return;
          }

          if (sourcesRef.current.length === 0 && !formatManualRef.current) {
            const recommended = recommendedFormatForInput(analyzed.format.id, capabilitiesRef.current);
            const nextSettings = { ...settingsRef.current, format: recommended };
            settingsRef.current = nextSettings;
            setSettingsState(nextSettings);
          }

          const thumbnailUrl = URL.createObjectURL(analyzed.thumbnailBlob);
          const asset: SourceAsset = {
            id: createId('image'),
            file,
            name: file.name,
            baseName: sanitizeBaseName(file.name),
            format: analyzed.format,
            width: analyzed.width,
            height: analyzed.height,
            size: file.size,
            thumbnailUrl,
            frameNotice: analyzed.frameNotice,
            importedAt: Date.now(),
          };

          setSources([...sourcesRef.current, asset]);
          setStatus(asset.id, 'ready');
          const nextSelection = new Set(selectedRef.current);
          nextSelection.add(asset.id);
          setSelection(nextSelection);
          if (!activeRef.current) setActive(asset.id);

          succeeded += 1;
          done += 1;
          setImportProgress({ done, total: allowed.length, currentName: file.name });
        } catch (error) {
          seenFingerprintsRef.current.delete(key);
          issues.push({
            filename: file.name,
            message: error instanceof ImageProcessingError ? error.message : toUserMessage(error),
          });
          failed += 1;
          done += 1;
          setImportProgress({ done, total: allowed.length, currentName: file.name });
        }
      });

      if (issues.length) addImportIssues(issues);
      if (succeeded > 0) {
        notify(`${succeeded} image${succeeded === 1 ? '' : 's'} ready to edit.`, 'success');
      }
      if (failed > 0) {
        notify(
          `${failed} file${failed === 1 ? '' : 's'} could not be added. See the upload details.`,
          'warning',
        );
      }
    },
    [addImportIssues, notify, setActive, setSelection, setSources, setStatus],
  );

  const addFiles = useCallback(
    (input: FileList | File[]) => {
      const files = Array.from(input);
      if (files.length === 0) return;

      importCountRef.current += 1;
      setIsImporting(true);

      const run = async () => {
        try {
          await importFilesNow(files);
        } finally {
          importCountRef.current = Math.max(0, importCountRef.current - 1);
          if (importCountRef.current === 0) {
            setIsImporting(false);
            setImportProgress(null);
          }
        }
      };

      importChainRef.current = importChainRef.current.then(run, run);
    },
    [importFilesNow],
  );

  const removeSource = useCallback(
    (id: string) => {
      const asset = sourcesRef.current.find((source) => source.id === id);
      if (!asset) return;
      URL.revokeObjectURL(asset.thumbnailUrl);
      seenFingerprintsRef.current.delete(fingerprint(asset.file));
      removeResult(id);
      removeStatus(id);
      setError(id, null);

      const nextSources = sourcesRef.current.filter((source) => source.id !== id);
      setSources(nextSources);

      const nextSelection = new Set(selectedRef.current);
      nextSelection.delete(id);
      setSelection(nextSelection);

      if (activeRef.current === id) {
        setActive(nextSources[0]?.id ?? null);
      }
    },
    [removeResult, removeStatus, setActive, setError, setSelection, setSources],
  );

  const clearAll = useCallback(() => {
    if (importCountRef.current > 0) {
      notify('Please wait for the current upload to finish before clearing.', 'info');
      return;
    }

    generationRef.current += 1;
    batchAbortRef.current = true;
    batchRunIdRef.current += 1;
    batchIdsRef.current = [];
    cancelAutoTimer();
    clearAllResults();
    sourcesRef.current.forEach((source) => URL.revokeObjectURL(source.thumbnailUrl));
    seenFingerprintsRef.current.clear();
    setSources([]);
    setStatuses({});
    setErrors({});
    setSelection(new Set());
    setActive(null);
    setImportIssues([]);
    setBatch(EMPTY_BATCH);
    notify('All images removed.', 'info');
  }, [cancelAutoTimer, clearAllResults, notify, setActive, setSelection, setSources]);

  const toggleSelected = useCallback(
    (id: string) => {
      const next = new Set(selectedRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelection(next);
    },
    [setSelection],
  );

  const selectAll = useCallback(() => {
    setSelection(new Set(sourcesRef.current.map((source) => source.id)));
  }, [setSelection]);

  const selectNone = useCallback(() => {
    setSelection(new Set());
  }, [setSelection]);

  const markOrphanedProcessingReady = useCallback((exclude: Set<string>) => {
    setStatuses((current) => {
      let changed = false;
      const next = { ...current };
      sourcesRef.current.forEach((source) => {
        if (!exclude.has(source.id) && next[source.id] === 'processing') {
          next[source.id] = 'ready';
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, []);

  const processMany = useCallback(
    async (ids: string[], options: { silent?: boolean } = {}): Promise<ProcessOutcome> => {
      const unique = Array.from(new Set(ids)).filter((id) => sourceExists(id));
      if (unique.length === 0) {
        if (!options.silent) notify('There are no images to process.', 'info');
        return { completed: 0, failed: 0, canceled: false };
      }

      batchAbortRef.current = false;
      generationRef.current += 1;
      batchRunIdRef.current += 1;
      const runId = batchRunIdRef.current;
      const generation = generationRef.current;
      const uniqueSet = new Set(unique);
      batchIdsRef.current = unique;
      cancelAutoTimer();

      unique.forEach((id) => removeResult(id));
      unique.forEach((id) => setError(id, null));
      markOrphanedProcessingReady(uniqueSet);

      setStatuses((current) => {
        const next = { ...current };
        unique.forEach((id) => {
          next[id] = 'ready';
        });
        return next;
      });
      setBatch({
        running: true,
        done: 0,
        total: unique.length,
        succeeded: 0,
        failed: 0,
        canceled: false,
      });

      let done = 0;
      let succeeded = 0;
      let failed = 0;
      let nextIndex = 0;

      const isCurrent = () =>
        generationRef.current === generation && batchRunIdRef.current === runId;

      const worker = async () => {
        while (nextIndex < unique.length) {
          if (!isCurrent() || batchAbortRef.current) return;
          const id = unique[nextIndex];
          nextIndex += 1;
          const asset = sourcesRef.current.find((source) => source.id === id);
          if (!asset) continue;

          if (!isCurrent() || batchAbortRef.current) return;
          setStatus(id, 'processing');
          setError(id, null);

          try {
            const result = await processImage(asset, settingsRef.current, capabilitiesRef.current);
            if (!isCurrent() || batchAbortRef.current || !sourceExists(id)) {
              URL.revokeObjectURL(result.url);
              return;
            }
            storeResult(id, result);
            setStatus(id, 'completed');
            succeeded += 1;
          } catch (error) {
            if (!isCurrent() || batchAbortRef.current || !sourceExists(id)) return;
            setStatus(id, 'failed');
            setError(id, toUserMessage(error));
            failed += 1;
          } finally {
            done += 1;
            if (isCurrent()) {
              setBatch({
                running: true,
                done,
                total: unique.length,
                succeeded,
                failed,
                canceled: false,
              });
            }
            await yieldToBrowser();
          }
        }
      };

      await Promise.all([worker(), worker()]);

      if (batchRunIdRef.current !== runId) {
        return { completed: succeeded, failed, canceled: true };
      }

      const canceled = batchAbortRef.current;
      batchIdsRef.current = [];
      if (canceled) {
        setStatuses((current) => {
          const next = { ...current };
          unique.forEach((id) => {
            if (next[id] !== 'completed' && next[id] !== 'failed') next[id] = 'canceled';
          });
          return next;
        });
      }

      setBatch({
        running: false,
        done,
        total: unique.length,
        succeeded,
        failed,
        canceled,
      });

      if (!options.silent) {
        if (canceled) {
          notify('Bulk processing canceled. Completed images remain available.', 'info');
        } else if (failed > 0) {
          notify(
            `${succeeded} processed, ${failed} failed. Check the image cards for details.`,
            succeeded > 0 ? 'warning' : 'error',
          );
        } else {
          notify(`${succeeded} image${succeeded === 1 ? '' : 's'} processed.`, 'success');
        }
      }

      return { completed: succeeded, failed, canceled };
    },
    [
      cancelAutoTimer,
      markOrphanedProcessingReady,
      notify,
      removeResult,
      setError,
      setStatus,
      sourceExists,
      storeResult,
    ],
  );

  const processAll = useCallback(() => {
    if (batch.running || zip.running) return;
    const ids = sourcesRef.current.map((source) => source.id);
    if (!ids.length) {
      notify('Upload an image first.', 'info');
      return;
    }
    void processMany(ids);
  }, [batch.running, notify, processMany, zip.running]);

  const processSelected = useCallback(() => {
    if (batch.running || zip.running) return;
    const ids = Array.from(selectedRef.current);
    if (!ids.length) {
      notify('Select at least one image first.', 'info');
      return;
    }
    void processMany(ids);
  }, [batch.running, notify, processMany, zip.running]);

  const cancelBatch = useCallback(() => {
    if (!batch.running) return;
    const ids = batchIdsRef.current;
    batchAbortRef.current = true;
    batchRunIdRef.current += 1;
    generationRef.current += 1;
    batchIdsRef.current = [];
    cancelAutoTimer();

    setStatuses((current) => {
      const next = { ...current };
      sourcesRef.current.forEach((source) => {
        if (!resultsRef.current[source.id] && ids.includes(source.id)) {
          if (next[source.id] !== 'failed') next[source.id] = 'canceled';
        } else if (!ids.includes(source.id) && next[source.id] === 'processing') {
          next[source.id] = 'ready';
        }
      });
      return next;
    });

    setBatch((current) => ({ ...current, running: false, canceled: true }));
    notify('Bulk processing canceled. Completed images remain available.', 'info');
  }, [batch.running, cancelAutoTimer, notify]);

  const retryFailed = useCallback(() => {
    const ids = sourcesRef.current
      .filter((source) => statuses[source.id] === 'failed')
      .map((source) => source.id);
    if (!ids.length) {
      notify('There are no failed images to retry.', 'info');
      return;
    }
    void processMany(ids);
  }, [notify, processMany, statuses]);

  const reprocessActive = useCallback(() => {
    if (batch.running) return;
    const asset = sourcesRef.current.find((source) => source.id === activeRef.current);
    if (!asset) return;

    generationRef.current += 1;
    cancelAutoTimer();
    removeResult(asset.id);
    setError(asset.id, null);
    markOrphanedProcessingReady(new Set([asset.id]));
    setStatus(asset.id, 'ready');
    void runSinglePreview(asset, settingsRef.current, generationRef.current);
  }, [batch.running, cancelAutoTimer, markOrphanedProcessingReady, removeResult, runSinglePreview, setError, setStatus]);

  const downloadAllAsZip = useCallback(async () => {
    if (zip.running || batch.running) return;

    const selected = selectedRef.current;
    const targetIds = sourcesRef.current
      .filter((source) => selected.size === 0 || selected.has(source.id))
      .map((source) => source.id);

    if (targetIds.length === 0) {
      notify('Upload at least one image before creating a ZIP.', 'info');
      return;
    }

    setZip({ running: true, percent: 0, stage: 'preparing' });

    try {
      const missing = targetIds.filter((id) => !resultsRef.current[id]);
      if (missing.length > 0) {
        const outcome = await processMany(missing, { silent: true });
        if (outcome.canceled) {
          notify('ZIP creation canceled because processing was stopped.', 'info');
          return;
        }
      }

      const processed = targetIds
        .map((id) => resultsRef.current[id])
        .filter((result): result is ProcessedResult => Boolean(result));

      if (processed.length === 0) {
        throw new ImageProcessingError(
          'ZIP_FAILED',
          'No processed images are available. Check the errors on the image cards and try again.',
        );
      }

      setZip({ running: true, percent: 0, stage: 'packaging' });
      const blob = await createResultsZip(processed, (percent) => {
        setZip((current) =>
          current.running
            ? { ...current, stage: 'packaging', percent: Math.min(100, Math.round(percent)) }
            : current,
        );
      });

      downloadBlob(blob, 'converted-images.zip');
      const skipped = targetIds.length - processed.length;
      notify(
        `ZIP ready with ${processed.length} image${processed.length === 1 ? '' : 's'}${
          skipped > 0 ? `. ${skipped} failed image${skipped === 1 ? ' was' : 's were'} skipped.` : '.'
        }`,
        skipped > 0 ? 'warning' : 'success',
      );
    } catch (error) {
      notify(toUserMessage(error), 'error');
    } finally {
      setZip((current) => ({ ...current, running: false }));
    }
  }, [batch.running, notify, processMany, zip.running]);

  const downloadResult = useCallback((result: ProcessedResult) => {
    triggerDownload(result.url, result.filename);
  }, []);

  const dismissImportIssue = useCallback((id: string) => {
    setImportIssues((current) => current.filter((issue) => issue.id !== id));
  }, []);

  const clearImportIssues = useCallback(() => setImportIssues([]), []);

  const activeSource = sources.find((source) => source.id === activeId) ?? null;
  const activeResult = activeSource ? results[activeSource.id] ?? null : null;
  const activeStatus = activeSource ? statuses[activeSource.id] ?? 'ready' : 'ready';
  const activeError = activeSource ? errors[activeSource.id] ?? null : null;
  const allSelected = sources.length > 0 && selectedIds.size === sources.length;

  useEffect(() => {
    if (sources.length === 0 && activeRef.current !== null) {
      setActive(null);
    }
  }, [setActive, sources.length]);

  return {
    sources,
    settings,
    results,
    statuses,
    errors,
    activeId,
    activeSource,
    activeResult,
    activeStatus,
    activeError,
    selectedIds,
    allSelected,
    importIssues,
    importProgress,
    isImporting,
    capabilities,
    capabilitiesReady,
    batch,
    zip,
    updateSettings,
    resetSettings,
    addFiles,
    removeSource,
    clearAll,
    setActive,
    toggleSelected,
    selectAll,
    selectNone,
    processAll,
    processSelected,
    cancelBatch,
    retryFailed,
    reprocessActive,
    downloadAllAsZip,
    downloadResult,
    dismissImportIssue,
    clearImportIssues,
  };
}
