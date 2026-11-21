import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActiveSelection,
  Canvas,
  Ellipse,
  FabricImage,
  FabricObject,
  IText,
  Line,
  Path,
  PencilBrush,
  Point,
  Polygon,
  Rect,
  Shadow,
  Triangle,
} from 'fabric';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpToLine,
  Bold,
  Check,
  Circle,
  Copy,
  Crop,
  Download,
  Eraser,
  FilePlus2,
  FlipHorizontal2,
  FlipVertical2,
  Heart,
  ImagePlus,
  Italic,
  Loader2,
  Maximize,
  Minus,
  PaintBucket,
  Pencil,
  Redo2,
  RotateCcw,
  RotateCw,
  Send,
  Shapes,
  SlidersHorizontal,
  Square,
  Star,
  Trash2,
  Triangle as TriangleIcon,
  Type,
  Underline,
  Undo2,
  UploadCloud,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  drawableToPngBlob,
  fileToPngBlob,
  removeImageBackground,
} from '../lib/backgroundRemoval';
import { canvasToBlob } from '../lib/canvas';
import { downloadBlob } from '../lib/download';
import { toUserMessage } from '../lib/errors';
import { INPUT_ACCEPT, sanitizeBaseName } from '../lib/formats';
import type { ToastType } from '../hooks/useToasts';
import {
  CANVAS_PRESETS,
  CROP_RATIOS,
  DEFAULT_ADJUSTMENTS,
  FILTER_PRESETS,
  FONT_FAMILIES,
  STICKERS,
  SWATCHES,
  buildFilters,
  type Adjustments,
} from './presets';

FabricObject.customProperties = ['isBase', 'adj', 'perPixelTargetFind'];

type EditorObject = FabricObject & { isBase?: boolean; adj?: Adjustments };
type ToolId = 'adjust' | 'filters' | 'crop' | 'text' | 'elements' | 'draw' | 'background' | 'export';
type ExportFormat = 'png' | 'jpeg' | 'webp';

interface EditorPageProps {
  /** A file handed over from the converter workspace. */
  initialFile: File | null;
  onInitialFileConsumed: () => void;
  onSendToConverter: (file: File) => void;
  notify: (message: string, type?: ToastType) => void;
}

interface Selection {
  kind: 'text' | 'image' | 'shape' | 'multi';
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  shadow: boolean;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: string;
}

interface Snapshot {
  json: string;
  w: number;
  h: number;
}

const MAX_IMAGE_DIMENSION = 4096;
const MAX_DOC_DIMENSION = 8000;
const HISTORY_LIMIT = 40;

const TOOLS: Array<{ id: ToolId; label: string; icon: typeof Crop }> = [
  { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
  { id: 'filters', label: 'Filters', icon: Wand2 },
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'elements', label: 'Elements', icon: Shapes },
  { id: 'draw', label: 'Draw', icon: Pencil },
  { id: 'background', label: 'Background', icon: PaintBucket },
  { id: 'export', label: 'Export', icon: Download },
];

function hexOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value === '' || value === 'transparent') return null;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return '#000000';
}

function styleObject(object: EditorObject): void {
  object.set({
    cornerColor: '#6366f1',
    cornerStrokeColor: '#ffffff',
    borderColor: '#6366f1',
    cornerStyle: 'circle',
    transparentCorners: false,
    cornerSize: 12,
    borderScaleFactor: 1.5,
  });
  const interactive = !object.isBase;
  object.selectable = interactive;
  object.evented = interactive;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="ed-slider">
      <span className="ed-slider-head">
        <span>{label}</span>
        <output>{value}</output>
      </span>
      <input
        className="range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={() => onChange(Math.min(max, Math.max(min, 0)))}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ed-color-field">
      <span className="ed-label">{label}</span>
      <div className="ed-swatches">
        <label className="ed-color-input" title="Custom colour">
          <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        </label>
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={`ed-swatch ${swatch === value ? 'is-active' : ''}`}
            style={{ background: swatch }}
            onClick={() => onChange(swatch)}
            aria-label={`Use colour ${swatch}`}
          />
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ed-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export default function EditorPage({
  initialFile,
  onInitialFileConsumed,
  onSendToConverter,
  notify,
}: EditorPageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const openInputRef = useRef<HTMLInputElement>(null);
  const layerInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const docRef = useRef({ w: 1080, h: 1080 });
  const zoomRef = useRef(1);
  const autoFitRef = useRef(true);
  const historyRef = useRef<Snapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const restoringRef = useRef(false);
  const commitTimerRef = useRef<number | null>(null);
  const cropRectRef = useRef<Rect | null>(null);
  const urlsRef = useRef<string[]>([]);
  const toolRef = useRef<ToolId>('adjust');
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const [ready, setReady] = useState(false);
  const [hasDoc, setHasDoc] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [tool, setToolState] = useState<ToolId>('adjust');
  const [docSize, setDocSize] = useState({ w: 1080, h: 1080 });
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [hasTargetImage, setHasTargetImage] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [background, setBackground] = useState<string | null>(null);
  const [cropRatio, setCropRatio] = useState('free');
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(12);
  const [borderSize, setBorderSize] = useState(40);
  const [borderColor, setBorderColor] = useState('#ffffff');
  const [resizeWidth, setResizeWidth] = useState(1080);
  const [customSize, setCustomSize] = useState({ w: 1200, h: 800 });
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportQuality, setExportQuality] = useState(92);
  const [fileName, setFileName] = useState('edited-image');

  /* ---------- canvas helpers ---------- */

  const objects = useCallback((): EditorObject[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    return (canvas.getObjects() as EditorObject[]).filter((object) => object !== cropRectRef.current);
  }, []);

  const targetImage = useCallback((): (FabricImage & EditorObject) | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const active = canvas.getActiveObject();
    if (active instanceof FabricImage) return active as FabricImage & EditorObject;
    const base = objects().find((object) => object.isBase && object instanceof FabricImage);
    return (base as (FabricImage & EditorObject) | undefined) ?? null;
  }, [objects]);

  const syncSelection = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject() as EditorObject | undefined;
    const image = targetImage();
    setHasTargetImage(Boolean(image));
    setAdjustments(image?.adj ? { ...DEFAULT_ADJUSTMENTS, ...image.adj } : DEFAULT_ADJUSTMENTS);

    if (!active || active === cropRectRef.current) {
      setSelection(null);
      return;
    }

    const text = active instanceof IText ? active : null;
    setSelection({
      kind:
        active instanceof ActiveSelection
          ? 'multi'
          : text
            ? 'text'
            : active instanceof FabricImage
              ? 'image'
              : 'shape',
      fill: hexOrNull(active.fill),
      stroke: hexOrNull(active.stroke),
      strokeWidth: Math.round(active.strokeWidth ?? 0),
      opacity: Math.round((active.opacity ?? 1) * 100),
      shadow: Boolean(active.shadow),
      fontFamily: text?.fontFamily ?? FONT_FAMILIES[0],
      fontSize: Math.round(text?.fontSize ?? 40),
      bold: text ? text.fontWeight === 'bold' || Number(text.fontWeight) >= 600 : false,
      italic: text?.fontStyle === 'italic',
      underline: Boolean(text?.underline),
      align: text?.textAlign ?? 'left',
    });
  }, [targetImage]);

  const applyZoom = useCallback((value: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const next = Math.min(4, Math.max(0.03, value));
    const { w, h } = docRef.current;
    zoomRef.current = next;
    canvas.setDimensions({ width: Math.max(1, Math.round(w * next)), height: Math.max(1, Math.round(h * next)) });
    canvas.setZoom(next);
    canvas.requestRenderAll();
    setZoom(next);
  }, []);

  const fitToStage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { w, h } = docRef.current;
    const availableWidth = Math.max(120, stage.clientWidth - 56);
    const availableHeight = Math.max(120, stage.clientHeight - 56);
    autoFitRef.current = true;
    applyZoom(Math.min(1, availableWidth / w, availableHeight / h));
  }, [applyZoom]);

  const setDoc = useCallback(
    (w: number, h: number, refit = true) => {
      docRef.current = { w, h };
      setDocSize({ w, h });
      setResizeWidth(w);
      if (refit) fitToStage();
      else applyZoom(zoomRef.current);
    },
    [applyZoom, fitToStage],
  );

  const updateHistoryFlags = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const commit = useCallback(() => {
    const canvas = canvasRef.current;
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (!canvas || restoringRef.current || cropRectRef.current) return;
    const snapshot: Snapshot = {
      json: JSON.stringify(canvas.toObject()),
      w: docRef.current.w,
      h: docRef.current.h,
    };
    const current = historyRef.current[historyIndexRef.current];
    if (current && current.json === snapshot.json && current.w === snapshot.w && current.h === snapshot.h) {
      return;
    }
    const next = historyRef.current.slice(0, historyIndexRef.current + 1);
    next.push(snapshot);
    while (next.length > HISTORY_LIMIT) next.shift();
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    updateHistoryFlags();
  }, [updateHistoryFlags]);

  const scheduleCommit = useCallback(() => {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = null;
      commit();
    }, 350);
  }, [commit]);

  const restore = useCallback(
    async (index: number) => {
      const canvas = canvasRef.current;
      const snapshot = historyRef.current[index];
      if (!canvas || !snapshot || restoringRef.current) return;
      restoringRef.current = true;
      try {
        if (commitTimerRef.current !== null) {
          window.clearTimeout(commitTimerRef.current);
          commitTimerRef.current = null;
        }
        canvas.discardActiveObject();
        await canvas.loadFromJSON(snapshot.json);
        (canvas.getObjects() as EditorObject[]).forEach(styleObject);
        historyIndexRef.current = index;
        const sizeChanged = snapshot.w !== docRef.current.w || snapshot.h !== docRef.current.h;
        setDoc(snapshot.w, snapshot.h, sizeChanged && autoFitRef.current);
        setBackground(hexOrNull(canvas.backgroundColor));
        canvas.requestRenderAll();
      } finally {
        restoringRef.current = false;
        updateHistoryFlags();
        syncSelection();
      }
    },
    [setDoc, syncSelection, updateHistoryFlags],
  );

  const undo = useCallback(() => {
    commit();
    if (historyIndexRef.current > 0) void restore(historyIndexRef.current - 1);
  }, [commit, restore]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      void restore(historyIndexRef.current + 1);
    }
  }, [restore]);

  const trackUrl = useCallback((blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.push(url);
    return url;
  }, []);

  /* ---------- crop mode ---------- */

  const endCrop = useCallback(() => {
    const canvas = canvasRef.current;
    const rect = cropRectRef.current;
    if (!canvas || !rect) return;
    cropRectRef.current = null;
    canvas.remove(rect);
    canvas.uniformScaling = true;
    objects().forEach(styleObject);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [objects]);

  const startCrop = useCallback(
    (ratioId: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (cropRectRef.current) {
        const previous = cropRectRef.current;
        cropRectRef.current = null;
        canvas.remove(previous);
      }
      commit();

      const { w, h } = docRef.current;
      const ratio = CROP_RATIOS.find((item) => item.id === ratioId)?.ratio ?? null;
      let width = w * 0.8;
      let height = h * 0.8;
      if (ratio) {
        width = Math.min(w, h * ratio) * 0.9;
        height = width / ratio;
      }

      const rect = new Rect({
        left: (w - width) / 2,
        top: (h - height) / 2,
        width,
        height,
        fill: 'rgba(99, 102, 241, 0.22)',
        strokeWidth: 0,
        lockRotation: true,
        excludeFromExport: true,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#4f46e5',
        borderColor: '#ffffff',
        cornerStyle: 'circle',
        transparentCorners: false,
        cornerSize: 14,
        borderScaleFactor: 2,
        borderDashArray: [6, 4],
      });
      rect.setControlsVisibility({
        mtr: false,
        ml: !ratio,
        mr: !ratio,
        mt: !ratio,
        mb: !ratio,
      });

      canvas.isDrawingMode = false;
      canvas.uniformScaling = Boolean(ratio);
      objects().forEach((object) => {
        object.evented = false;
        object.selectable = false;
      });
      cropRectRef.current = rect;
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.requestRenderAll();
      setSelection(null);
    },
    [commit, objects],
  );

  const applyCrop = useCallback(() => {
    const rect = cropRectRef.current;
    if (!rect) return;
    const { w, h } = docRef.current;
    const left = Math.max(0, Math.round(rect.left));
    const top = Math.max(0, Math.round(rect.top));
    const right = Math.min(w, Math.round(rect.left + rect.getScaledWidth()));
    const bottom = Math.min(h, Math.round(rect.top + rect.getScaledHeight()));
    endCrop();
    if (right - left < 4 || bottom - top < 4) {
      notifyRef.current('The crop area is too small.', 'warning');
      startCrop(cropRatio);
      return;
    }
    objects().forEach((object) => {
      object.set({ left: object.left - left, top: object.top - top });
      object.setCoords();
    });
    setDoc(right - left, bottom - top);
    commit();
    startCrop(cropRatio);
  }, [commit, cropRatio, endCrop, objects, setDoc, startCrop]);

  const setTool = useCallback(
    (next: ToolId) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (toolRef.current === 'crop' && next !== 'crop') endCrop();
      toolRef.current = next;
      setToolState(next);
      canvas.isDrawingMode = next === 'draw';
      if (next === 'draw') canvas.discardActiveObject();
      if (next === 'crop') startCrop(cropRatio);
      canvas.requestRenderAll();
    },
    [cropRatio, endCrop, startCrop],
  );

  /* ---------- document lifecycle ---------- */

  const resetHistory = useCallback(() => {
    historyRef.current = [];
    historyIndexRef.current = -1;
    commit();
  }, [commit]);

  const prepareNewDocument = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    endCrop();
    if (toolRef.current === 'crop') {
      toolRef.current = 'adjust';
      setToolState('adjust');
    }
    canvas.isDrawingMode = toolRef.current === 'draw';
    canvas.discardActiveObject();
    canvas.remove(...canvas.getObjects());
    return canvas;
  }, [endCrop]);

  const newBlankDocument = useCallback(
    (width: number, height: number) => {
      const canvas = prepareNewDocument();
      if (!canvas) return;
      const w = Math.min(MAX_DOC_DIMENSION, Math.max(16, Math.round(width)));
      const h = Math.min(MAX_DOC_DIMENSION, Math.max(16, Math.round(height)));
      canvas.backgroundColor = '#ffffff';
      setBackground('#ffffff');
      setHasDoc(true);
      setShowStart(false);
      setFileName('my-design');
      setDoc(w, h);
      resetHistory();
      syncSelection();
    },
    [prepareNewDocument, resetHistory, setDoc, syncSelection],
  );

  const loadImage = useCallback(
    async (file: File): Promise<FabricImage & EditorObject> => {
      const png = await fileToPngBlob(file, MAX_IMAGE_DIMENSION);
      const image = (await FabricImage.fromURL(trackUrl(png))) as FabricImage & EditorObject;
      image.adj = { ...DEFAULT_ADJUSTMENTS };
      return image;
    },
    [trackUrl],
  );

  const openImageAsDocument = useCallback(
    async (file: File) => {
      setBusy('Opening image…');
      try {
        const image = await loadImage(file);
        const canvas = prepareNewDocument();
        if (!canvas) return;
        image.set({ left: 0, top: 0 });
        image.isBase = true;
        styleObject(image);
        canvas.backgroundColor = '';
        setBackground(null);
        canvas.add(image);
        setHasDoc(true);
        setShowStart(false);
        setFileName(`${sanitizeBaseName(file.name)}-edited`);
        setDoc(image.width, image.height);
        resetHistory();
        syncSelection();
      } catch (error) {
        notifyRef.current(toUserMessage(error), 'error');
      } finally {
        setBusy(null);
      }
    },
    [loadImage, prepareNewDocument, resetHistory, setDoc, syncSelection],
  );

  const addObject = useCallback(
    (object: EditorObject, select = true) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (cropRectRef.current) endCrop();
      if (toolRef.current === 'crop' || toolRef.current === 'draw') {
        toolRef.current = 'elements';
        setToolState('elements');
        canvas.isDrawingMode = false;
      }
      styleObject(object);
      const { w, h } = docRef.current;
      object.setPositionByOrigin(new Point(w / 2, h / 2), 'center', 'center');
      object.setCoords();
      canvas.add(object);
      if (select) canvas.setActiveObject(object);
      canvas.requestRenderAll();
      commit();
      syncSelection();
    },
    [commit, endCrop, syncSelection],
  );

  const addImageLayer = useCallback(
    async (file: File) => {
      setBusy('Adding image…');
      try {
        const image = await loadImage(file);
        const { w, h } = docRef.current;
        const scale = Math.min(1, (w * 0.7) / image.width, (h * 0.7) / image.height);
        image.scale(scale);
        addObject(image);
      } catch (error) {
        notifyRef.current(toUserMessage(error), 'error');
      } finally {
        setBusy(null);
      }
    },
    [addObject, loadImage],
  );

  const handleIncomingFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      let rest = files;
      if (!hasDoc || showStart) {
        await openImageAsDocument(files[0]);
        rest = files.slice(1);
      }
      for (const file of rest) {
        await addImageLayer(file);
      }
    },
    [addImageLayer, hasDoc, openImageAsDocument, showStart],
  );

  /* ---------- canvas setup ---------- */

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const element = document.createElement('canvas');
    host.appendChild(element);
    const canvas = new Canvas(element, {
      preserveObjectStacking: true,
      backgroundColor: '#ffffff',
      width: 300,
      height: 300,
    });
    canvasRef.current = canvas;
    const brush = new PencilBrush(canvas);
    brush.color = '#ef4444';
    brush.width = 12;
    canvas.freeDrawingBrush = brush;
    setReady(true);

    return () => {
      canvasRef.current = null;
      setReady(false);
      void canvas.dispose().finally(() => {
        element.remove();
        host.replaceChildren();
      });
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;

    const onSelection = () => syncSelection();
    const onCleared = () => {
      if (cropRectRef.current) {
        canvas.setActiveObject(cropRectRef.current);
        canvas.requestRenderAll();
        return;
      }
      syncSelection();
    };
    const onModified = () => {
      scheduleCommit();
      syncSelection();
    };
    const onPath = (event: { path: FabricObject }) => {
      styleObject(event.path as EditorObject);
      commit();
    };

    canvas.on('selection:created', onSelection);
    canvas.on('selection:updated', onSelection);
    canvas.on('selection:cleared', onCleared);
    canvas.on('object:modified', onModified);
    canvas.on('text:changed', scheduleCommit);
    canvas.on('path:created', onPath);

    return () => {
      canvas.off('selection:created', onSelection);
      canvas.off('selection:updated', onSelection);
      canvas.off('selection:cleared', onCleared);
      canvas.off('object:modified', onModified);
      canvas.off('text:changed', scheduleCommit);
      canvas.off('path:created', onPath);
    };
  }, [commit, ready, scheduleCommit, syncSelection]);

  useEffect(() => {
    const onResize = () => {
      if (autoFitRef.current) fitToStage();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitToStage]);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current);
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!ready || !initialFile) return;
    onInitialFileConsumed();
    void openImageAsDocument(initialFile);
  }, [initialFile, onInitialFileConsumed, openImageAsDocument, ready]);

  useEffect(() => {
    const brush = canvasRef.current?.freeDrawingBrush;
    if (!brush) return;
    brush.color = brushColor;
    brush.width = brushSize;
  }, [brushColor, brushSize, ready]);

  /* ---------- object actions ---------- */

  const activeObjects = useCallback((): EditorObject[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    return (canvas.getActiveObjects() as EditorObject[]).filter(
      (object) => object !== cropRectRef.current,
    );
  }, []);

  const updateSelected = useCallback(
    (patch: Record<string, unknown>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      activeObjects().forEach((object) => {
        object.set(patch);
        object.setCoords();
      });
      canvas.requestRenderAll();
      scheduleCommit();
      syncSelection();
    },
    [activeObjects, scheduleCommit, syncSelection],
  );

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || cropRectRef.current) return;
    const targets = activeObjects();
    if (targets.length === 0) return;
    canvas.discardActiveObject();
    canvas.remove(...targets);
    canvas.requestRenderAll();
    commit();
    syncSelection();
  }, [activeObjects, commit, syncSelection]);

  const duplicateSelected = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || cropRectRef.current) return;
    const active = canvas.getActiveObject() as EditorObject | undefined;
    if (!active || active instanceof ActiveSelection) return;
    const clone = (await active.clone()) as EditorObject;
    clone.isBase = false;
    const offset = Math.max(12, Math.round(docRef.current.w / 40));
    clone.set({ left: active.left + offset, top: active.top + offset });
    styleObject(clone);
    clone.setCoords();
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    commit();
    syncSelection();
  }, [commit, syncSelection]);

  const reorderSelected = useCallback(
    (direction: 'front' | 'back') => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      activeObjects().forEach((object) => {
        if (direction === 'front') {
          canvas.bringObjectToFront(object);
        } else {
          canvas.sendObjectToBack(object);
          // The base photo always stays underneath everything else.
          const base = objects().find((item) => item.isBase);
          if (base) canvas.sendObjectToBack(base);
        }
      });
      canvas.requestRenderAll();
      commit();
    },
    [activeObjects, commit, objects],
  );

  const flipSelected = useCallback(
    (axis: 'flipX' | 'flipY') => {
      activeObjects().forEach((object) => object.set(axis, !object[axis]));
      updateSelected({});
    },
    [activeObjects, updateSelected],
  );

  const toggleShadow = useCallback(() => {
    const size = Math.max(6, Math.round(Math.min(docRef.current.w, docRef.current.h) / 60));
    const enabled = activeObjects().some((object) => object.shadow);
    updateSelected({
      shadow: enabled
        ? null
        : new Shadow({ color: 'rgba(0,0,0,0.5)', blur: size * 1.5, offsetX: size / 2, offsetY: size / 2 }),
    });
  }, [activeObjects, updateSelected]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || isTypingTarget(event.target)) return;
      const active = canvas.getActiveObject();
      if (active instanceof IText && active.isEditing) return;

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (modifier && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (modifier && key === 'y') {
        event.preventDefault();
        redo();
      } else if (modifier && key === 'd') {
        event.preventDefault();
        void duplicateSelected();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (active && active !== cropRectRef.current) {
          event.preventDefault();
          deleteSelected();
        }
      } else if (event.key === 'Enter' && cropRectRef.current) {
        event.preventDefault();
        applyCrop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyCrop, deleteSelected, duplicateSelected, redo, undo]);

  /* ---------- image adjustments ---------- */

  const changeAdjustments = useCallback(
    (patch: Partial<Adjustments>) => {
      const canvas = canvasRef.current;
      const image = targetImage();
      if (!canvas || !image) return;
      const next = { ...DEFAULT_ADJUSTMENTS, ...image.adj, ...patch };
      image.adj = next;
      image.filters = buildFilters(next);
      image.applyFilters();
      canvas.requestRenderAll();
      setAdjustments(next);
      scheduleCommit();
    },
    [scheduleCommit, targetImage],
  );

  const removeBackground = useCallback(async () => {
    const canvas = canvasRef.current;
    const image = targetImage();
    if (!canvas || !image) return;
    setBusy('Removing background…');
    try {
      const element = ((image as unknown as { _originalElement?: CanvasImageSource })._originalElement ??
        image.getElement()) as HTMLImageElement | HTMLCanvasElement;
      const width = 'naturalWidth' in element ? element.naturalWidth || element.width : element.width;
      const height = 'naturalHeight' in element ? element.naturalHeight || element.height : element.height;
      const png = await drawableToPngBlob(element, width, height, MAX_IMAGE_DIMENSION);
      const cutout = await removeImageBackground(png, (stage, percent) => {
        setBusy(
          stage === 'model'
            ? `Downloading the AI model… ${percent}%`
            : 'Removing background…',
        );
      });
      await image.setSrc(trackUrl(cutout));
      image.setCoords();
      canvas.requestRenderAll();
      commit();
      notifyRef.current('Background removed.', 'success');
    } catch (error) {
      notifyRef.current(toUserMessage(error), 'error');
    } finally {
      setBusy(null);
    }
  }, [commit, targetImage, trackUrl]);

  /* ---------- whole-document transforms ---------- */

  const transformDocument = useCallback(
    (kind: 'cw' | 'ccw' | 'flipX' | 'flipY') => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const wasCropping = Boolean(cropRectRef.current);
      endCrop();
      const { w, h } = docRef.current;
      objects().forEach((object) => {
        const center = object.getCenterPoint();
        let next = center;
        if (kind === 'cw') {
          next = new Point(h - center.y, center.x);
          object.set('angle', (object.angle + 90) % 360);
        } else if (kind === 'ccw') {
          next = new Point(center.y, w - center.x);
          object.set('angle', (object.angle + 270) % 360);
        } else if (kind === 'flipX') {
          next = new Point(w - center.x, center.y);
          object.set({ flipX: !object.flipX, angle: (360 - object.angle) % 360 });
        } else {
          next = new Point(center.x, h - center.y);
          object.set({ flipY: !object.flipY, angle: (360 - object.angle) % 360 });
        }
        object.setPositionByOrigin(next, 'center', 'center');
        object.setCoords();
      });
      if (kind === 'cw' || kind === 'ccw') setDoc(h, w);
      canvas.requestRenderAll();
      commit();
      if (wasCropping) startCrop(cropRatio);
    },
    [commit, cropRatio, endCrop, objects, setDoc, startCrop],
  );

  const resizeDocument = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = docRef.current;
    const width = Math.min(MAX_DOC_DIMENSION, Math.max(16, Math.round(resizeWidth) || w));
    const factor = width / w;
    const height = Math.max(1, Math.round(h * factor));
    if (width === w) return;
    if (height > MAX_DOC_DIMENSION) {
      notifyRef.current(`The canvas can be at most ${MAX_DOC_DIMENSION}px on each side.`, 'warning');
      return;
    }
    const wasCropping = Boolean(cropRectRef.current);
    endCrop();
    objects().forEach((object) => {
      object.set({
        left: object.left * factor,
        top: object.top * factor,
        scaleX: object.scaleX * factor,
        scaleY: object.scaleY * factor,
      });
      object.setCoords();
    });
    setDoc(width, height);
    commit();
    if (wasCropping) startCrop(cropRatio);
    notifyRef.current(`Canvas resized to ${width} × ${height}px.`, 'success');
  }, [commit, cropRatio, endCrop, objects, resizeWidth, setDoc, startCrop]);

  const changeBackground = useCallback(
    (color: string | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.backgroundColor = color ?? '';
      canvas.requestRenderAll();
      setBackground(color);
      scheduleCommit();
    },
    [scheduleCommit],
  );

  const addBorder = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = Math.max(1, Math.round(borderSize));
    const { w, h } = docRef.current;
    if (w + size * 2 > MAX_DOC_DIMENSION || h + size * 2 > MAX_DOC_DIMENSION) {
      notifyRef.current('That border would make the canvas too large.', 'warning');
      return;
    }
    objects().forEach((object) => {
      object.set({ left: object.left + size, top: object.top + size });
      object.setCoords();
    });
    // A hollow frame on top, so photo edges that overflow the canvas stay hidden.
    const frame = new Rect({
      left: 0,
      top: 0,
      width: w + size,
      height: h + size,
      fill: '',
      stroke: borderColor,
      strokeWidth: size,
      perPixelTargetFind: true,
    }) as EditorObject;
    styleObject(frame);
    canvas.add(frame);
    setDoc(w + size * 2, h + size * 2);
    canvas.requestRenderAll();
    commit();
  }, [borderColor, borderSize, commit, objects, setDoc]);

  /* ---------- adding content ---------- */

  const unit = () => Math.min(docRef.current.w, docRef.current.h);

  const addText = (preset: 'heading' | 'subheading' | 'body') => {
    const size = preset === 'heading' ? unit() / 9 : preset === 'subheading' ? unit() / 15 : unit() / 24;
    const text = new IText(
      preset === 'heading' ? 'Add a heading' : preset === 'subheading' ? 'Add a subheading' : 'Add body text',
      {
        fontFamily: FONT_FAMILIES[0],
        fontSize: Math.max(12, Math.round(size)),
        fontWeight: preset === 'body' ? 'normal' : 'bold',
        fill: '#111827',
        textAlign: 'center',
      },
    );
    addObject(text);
  };

  const addShape = (shape: string) => {
    const size = unit() * 0.3;
    const fill = '#6366f1';
    let object: FabricObject;
    switch (shape) {
      case 'rounded':
        object = new Rect({ width: size * 1.3, height: size, rx: size * 0.14, ry: size * 0.14, fill });
        break;
      case 'circle':
        object = new Ellipse({ rx: size / 2, ry: size / 2, fill });
        break;
      case 'triangle':
        object = new Triangle({ width: size, height: size * 0.9, fill });
        break;
      case 'line':
        object = new Line([0, 0, size * 1.6, 0], {
          stroke: fill,
          strokeWidth: Math.max(3, Math.round(size / 28)),
          strokeLineCap: 'round',
        });
        break;
      case 'star': {
        const points = Array.from({ length: 10 }, (_, index) => {
          const radius = index % 2 === 0 ? size / 2 : size / 4.6;
          const angle = (Math.PI / 5) * index - Math.PI / 2;
          return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
        });
        object = new Polygon(points, { fill: '#facc15' });
        break;
      }
      case 'heart':
        object = new Path(
          'M 50 90 C 20 65 0 45 0 25 C 0 10 12 0 25 0 C 37 0 46 7 50 16 C 54 7 63 0 75 0 C 88 0 100 10 100 25 C 100 45 80 65 50 90 Z',
          { fill: '#ef4444', scaleX: size / 100, scaleY: size / 100 },
        );
        break;
      case 'arrow':
        object = new Path('M 0 35 L 110 35 L 110 10 L 180 50 L 110 90 L 110 65 L 0 65 Z', {
          fill,
          scaleX: size / 120,
          scaleY: size / 120,
        });
        break;
      default:
        object = new Rect({ width: size * 1.3, height: size, fill });
        break;
    }
    addObject(object as EditorObject);
  };

  const addSticker = (emoji: string) => {
    addObject(
      new IText(emoji, {
        fontSize: Math.max(24, Math.round(unit() / 5)),
        fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif',
      }),
    );
  };

  /* ---------- export ---------- */

  const renderBlob = useCallback(
    async (format: ExportFormat, quality: number): Promise<Blob> => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('The editor is not ready.');
      endCrop();
      if (toolRef.current === 'crop') {
        toolRef.current = 'export';
        setToolState('export');
      }
      canvas.discardActiveObject();
      const { w, h } = docRef.current;
      const previousZoom = zoomRef.current;
      const previousBackground = canvas.backgroundColor;
      let output: HTMLCanvasElement;
      try {
        if (format === 'jpeg' && !previousBackground) canvas.backgroundColor = '#ffffff';
        canvas.setDimensions({ width: w, height: h });
        canvas.setZoom(1);
        output = canvas.toCanvasElement(1);
      } finally {
        canvas.backgroundColor = previousBackground;
        applyZoom(previousZoom);
      }
      try {
        return await canvasToBlob(output, `image/${format}`, format === 'png' ? undefined : quality / 100);
      } finally {
        output.width = 0;
        output.height = 0;
      }
    },
    [applyZoom, endCrop],
  );

  const safeName = () => sanitizeBaseName(fileName.trim() || 'edited-image');

  const download = async () => {
    setBusy('Exporting…');
    try {
      const blob = await renderBlob(exportFormat, exportQuality);
      downloadBlob(blob, `${safeName()}.${exportFormat === 'jpeg' ? 'jpg' : exportFormat}`);
      notifyRef.current('Image downloaded.', 'success');
    } catch (error) {
      notifyRef.current(toUserMessage(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  const sendToConverter = async () => {
    setBusy('Preparing image…');
    try {
      const blob = await renderBlob('png', 100);
      onSendToConverter(
        new File([blob], `${safeName()}.png`, { type: 'image/png', lastModified: Date.now() }),
      );
    } catch (error) {
      notifyRef.current(toUserMessage(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  /* ---------- panels ---------- */

  const noImageHint = (
    <p className="ed-hint">Open a photo or select an image layer to use these controls.</p>
  );

  const selectionPanel = selection ? (
    <Section title={selection.kind === 'multi' ? 'Selected objects' : `Selected ${selection.kind}`}>
      <div className="ed-icon-row">
        <button type="button" className="ed-icon-btn" onClick={() => void duplicateSelected()} title="Duplicate (Ctrl+D)" disabled={selection.kind === 'multi'}>
          <Copy size={16} />
        </button>
        <button type="button" className="ed-icon-btn" onClick={() => reorderSelected('front')} title="Bring to front">
          <ArrowUpToLine size={16} />
        </button>
        <button type="button" className="ed-icon-btn" onClick={() => reorderSelected('back')} title="Send to back">
          <ArrowDownToLine size={16} />
        </button>
        <button
          type="button"
          className="ed-icon-btn"
          onClick={() => flipSelected('flipX')}
          title="Flip horizontally"
        >
          <FlipHorizontal2 size={16} />
        </button>
        <button
          type="button"
          className="ed-icon-btn"
          onClick={() => flipSelected('flipY')}
          title="Flip vertically"
        >
          <FlipVertical2 size={16} />
        </button>
        <button type="button" className="ed-icon-btn danger" onClick={deleteSelected} title="Delete (Del)">
          <Trash2 size={16} />
        </button>
      </div>

      {selection.kind === 'text' ? (
        <>
          <label className="ed-field">
            <span className="ed-label">Font</span>
            <select
              value={selection.fontFamily}
              onChange={(event) => updateSelected({ fontFamily: event.target.value })}
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font.split(',')[0]}
                </option>
              ))}
            </select>
          </label>
          <Slider
            label="Font size"
            value={selection.fontSize}
            min={8}
            max={Math.max(400, Math.round(Math.max(docSize.w, docSize.h) / 2))}
            onChange={(value) => updateSelected({ fontSize: Math.max(8, value) })}
          />
          <div className="ed-icon-row">
            <button type="button" className={`ed-icon-btn ${selection.bold ? 'is-active' : ''}`} onClick={() => updateSelected({ fontWeight: selection.bold ? 'normal' : 'bold' })} title="Bold">
              <Bold size={16} />
            </button>
            <button type="button" className={`ed-icon-btn ${selection.italic ? 'is-active' : ''}`} onClick={() => updateSelected({ fontStyle: selection.italic ? 'normal' : 'italic' })} title="Italic">
              <Italic size={16} />
            </button>
            <button type="button" className={`ed-icon-btn ${selection.underline ? 'is-active' : ''}`} onClick={() => updateSelected({ underline: !selection.underline })} title="Underline">
              <Underline size={16} />
            </button>
            <button type="button" className={`ed-icon-btn ${selection.align === 'left' ? 'is-active' : ''}`} onClick={() => updateSelected({ textAlign: 'left' })} title="Align left">
              <AlignLeft size={16} />
            </button>
            <button type="button" className={`ed-icon-btn ${selection.align === 'center' ? 'is-active' : ''}`} onClick={() => updateSelected({ textAlign: 'center' })} title="Align centre">
              <AlignCenter size={16} />
            </button>
            <button type="button" className={`ed-icon-btn ${selection.align === 'right' ? 'is-active' : ''}`} onClick={() => updateSelected({ textAlign: 'right' })} title="Align right">
              <AlignRight size={16} />
            </button>
          </div>
        </>
      ) : null}

      {selection.kind !== 'image' && selection.fill !== null ? (
        <ColorField label="Fill colour" value={selection.fill} onChange={(value) => updateSelected({ fill: value })} />
      ) : null}

      {selection.kind !== 'image' ? (
        <>
          <ColorField
            label="Outline colour"
            value={selection.stroke ?? '#000000'}
            onChange={(value) =>
              updateSelected({
                stroke: value,
                strokeWidth: selection.strokeWidth || Math.max(2, Math.round(unit() / 200)),
              })
            }
          />
          <Slider
            label="Outline width"
            value={selection.strokeWidth}
            min={0}
            max={Math.max(40, Math.round(unit() / 12))}
            onChange={(value) =>
              updateSelected({ strokeWidth: value, stroke: selection.stroke ?? '#000000' })
            }
          />
        </>
      ) : null}

      <Slider label="Opacity" value={selection.opacity} min={5} max={100} onChange={(value) => updateSelected({ opacity: value / 100 })} />
      <label className="ed-check">
        <input type="checkbox" checked={selection.shadow} onChange={toggleShadow} />
        Drop shadow
      </label>
      {selection.kind === 'text' ? <p className="ed-hint">Double-click the text on the canvas to edit it.</p> : null}
    </Section>
  ) : null;

  let toolPanel: ReactNode = null;

  if (tool === 'adjust') {
    toolPanel = (
      <Section title="Adjust">
        {hasTargetImage ? (
          <>
            <Slider label="Brightness" value={adjustments.brightness} min={-100} max={100} onChange={(value) => changeAdjustments({ brightness: value })} />
            <Slider label="Contrast" value={adjustments.contrast} min={-100} max={100} onChange={(value) => changeAdjustments({ contrast: value })} />
            <Slider label="Saturation" value={adjustments.saturation} min={-100} max={100} onChange={(value) => changeAdjustments({ saturation: value })} />
            <Slider label="Vibrance" value={adjustments.vibrance} min={-100} max={100} onChange={(value) => changeAdjustments({ vibrance: value })} />
            <Slider label="Hue" value={adjustments.hue} min={-180} max={180} onChange={(value) => changeAdjustments({ hue: value })} />
            <Slider label="Blur" value={adjustments.blur} min={0} max={100} onChange={(value) => changeAdjustments({ blur: value })} />
            <Slider label="Grain" value={adjustments.noise} min={0} max={100} onChange={(value) => changeAdjustments({ noise: value })} />
            <Slider label="Pixelate" value={adjustments.pixelate} min={0} max={60} onChange={(value) => changeAdjustments({ pixelate: value })} />
            <label className="ed-check">
              <input type="checkbox" checked={adjustments.sharpen} onChange={(event) => changeAdjustments({ sharpen: event.target.checked })} />
              Sharpen
            </label>
            <button type="button" className="button button-secondary small ed-full" onClick={() => changeAdjustments({ ...DEFAULT_ADJUSTMENTS, preset: adjustments.preset })}>
              <RotateCcw size={15} /> Reset adjustments
            </button>
            <p className="ed-hint">Adjustments apply to the selected image layer, or to the main photo when nothing is selected.</p>
          </>
        ) : (
          noImageHint
        )}
      </Section>
    );
  } else if (tool === 'filters') {
    toolPanel = (
      <Section title="Filters">
        {hasTargetImage ? (
          <div className="ed-preset-grid">
            {FILTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`ed-preset ${adjustments.preset === preset.id ? 'is-active' : ''}`}
                onClick={() => changeAdjustments({ preset: preset.id })}
              >
                <span className="ed-preset-swatch" style={{ background: preset.swatch }} />
                {preset.label}
              </button>
            ))}
          </div>
        ) : (
          noImageHint
        )}
      </Section>
    );
  } else if (tool === 'crop') {
    toolPanel = (
      <>
        <Section title="Crop">
          <div className="ed-chip-grid">
            {CROP_RATIOS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ed-chip ${cropRatio === item.id ? 'is-active' : ''}`}
                onClick={() => {
                  setCropRatio(item.id);
                  startCrop(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="button button-primary ed-full" onClick={applyCrop}>
            <Check size={16} /> Apply crop
          </button>
          <p className="ed-hint">Drag the highlighted box on the canvas, then press Apply (or Enter).</p>
        </Section>
        <Section title="Rotate & flip">
          <div className="ed-icon-row">
            <button type="button" className="ed-icon-btn" onClick={() => transformDocument('ccw')} title="Rotate left">
              <RotateCcw size={16} />
            </button>
            <button type="button" className="ed-icon-btn" onClick={() => transformDocument('cw')} title="Rotate right">
              <RotateCw size={16} />
            </button>
            <button type="button" className="ed-icon-btn" onClick={() => transformDocument('flipX')} title="Flip horizontally">
              <FlipHorizontal2 size={16} />
            </button>
            <button type="button" className="ed-icon-btn" onClick={() => transformDocument('flipY')} title="Flip vertically">
              <FlipVertical2 size={16} />
            </button>
          </div>
        </Section>
        <Section title="Resize">
          <div className="ed-inline">
            <label className="ed-field">
              <span className="ed-label">Width (px)</span>
              <input type="number" min={16} max={MAX_DOC_DIMENSION} value={resizeWidth} onChange={(event) => setResizeWidth(Number(event.target.value))} />
            </label>
            <label className="ed-field">
              <span className="ed-label">Height (px)</span>
              <input type="number" value={Math.max(1, Math.round((docSize.h * (resizeWidth || docSize.w)) / docSize.w))} readOnly />
            </label>
          </div>
          <button type="button" className="button button-secondary small ed-full" onClick={resizeDocument}>
            <Maximize size={15} /> Resize canvas
          </button>
        </Section>
      </>
    );
  } else if (tool === 'text') {
    toolPanel = (
      <Section title="Add text">
        <button type="button" className="ed-text-add heading" onClick={() => addText('heading')}>Add a heading</button>
        <button type="button" className="ed-text-add subheading" onClick={() => addText('subheading')}>Add a subheading</button>
        <button type="button" className="ed-text-add" onClick={() => addText('body')}>Add body text</button>
        <p className="ed-hint">Click a text layer to style it. Double-click to change the words.</p>
      </Section>
    );
  } else if (tool === 'elements') {
    toolPanel = (
      <>
        <Section title="Shapes">
          <div className="ed-shape-grid">
            <button type="button" onClick={() => addShape('rect')} title="Rectangle"><Square size={22} /></button>
            <button type="button" onClick={() => addShape('rounded')} title="Rounded rectangle"><Square size={22} style={{ borderRadius: 6 }} strokeLinejoin="round" /></button>
            <button type="button" onClick={() => addShape('circle')} title="Circle"><Circle size={22} /></button>
            <button type="button" onClick={() => addShape('triangle')} title="Triangle"><TriangleIcon size={22} /></button>
            <button type="button" onClick={() => addShape('star')} title="Star"><Star size={22} /></button>
            <button type="button" onClick={() => addShape('heart')} title="Heart"><Heart size={22} /></button>
            <button type="button" onClick={() => addShape('arrow')} title="Arrow"><ArrowRight size={22} /></button>
            <button type="button" onClick={() => addShape('line')} title="Line"><Minus size={22} /></button>
          </div>
        </Section>
        <Section title="Stickers">
          <div className="ed-sticker-grid">
            {STICKERS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => addSticker(emoji)} aria-label={`Add ${emoji} sticker`}>
                {emoji}
              </button>
            ))}
          </div>
        </Section>
        <Section title="Photos">
          <button type="button" className="button button-secondary small ed-full" onClick={() => layerInputRef.current?.click()}>
            <ImagePlus size={15} /> Add image layer
          </button>
          <p className="ed-hint">You can also drag photos straight onto the canvas.</p>
        </Section>
      </>
    );
  } else if (tool === 'draw') {
    toolPanel = (
      <Section title="Draw">
        <ColorField label="Brush colour" value={brushColor} onChange={setBrushColor} />
        <Slider label="Brush size" value={brushSize} min={1} max={120} onChange={setBrushSize} />
        <p className="ed-hint">Draw on the canvas with the mouse or your finger. Pick another tool to move or resize strokes.</p>
      </Section>
    );
  } else if (tool === 'background') {
    toolPanel = (
      <>
        <Section title="Remove background">
          <button type="button" className="button button-primary ed-full" disabled={!hasTargetImage || Boolean(busy)} onClick={() => void removeBackground()}>
            <Eraser size={16} /> Remove background
          </button>
          <p className="ed-hint">
            AI cut-out of the selected image layer (or the main photo). Runs in your browser; the first use downloads the model.
          </p>
        </Section>
        <Section title="Canvas background">
          <ColorField label="Colour" value={background ?? '#ffffff'} onChange={changeBackground} />
          <button type="button" className={`ed-chip ${background === null ? 'is-active' : ''}`} onClick={() => changeBackground(null)}>
            Transparent
          </button>
        </Section>
        <Section title="Border">
          <ColorField label="Border colour" value={borderColor} onChange={setBorderColor} />
          <Slider label="Border size (px)" value={borderSize} min={2} max={400} onChange={setBorderSize} />
          <button type="button" className="button button-secondary small ed-full" onClick={addBorder}>
            <Square size={15} /> Add border
          </button>
        </Section>
      </>
    );
  } else {
    toolPanel = (
      <Section title="Export">
        <label className="ed-field">
          <span className="ed-label">File name</span>
          <input type="text" value={fileName} maxLength={80} onChange={(event) => setFileName(event.target.value)} />
        </label>
        <span className="ed-label">Format</span>
        <div className="ed-chip-grid three">
          {(['png', 'jpeg', 'webp'] as ExportFormat[]).map((format) => (
            <button key={format} type="button" className={`ed-chip ${exportFormat === format ? 'is-active' : ''}`} onClick={() => setExportFormat(format)}>
              {format === 'jpeg' ? 'JPG' : format.toUpperCase()}
            </button>
          ))}
        </div>
        {exportFormat !== 'png' ? (
          <Slider label="Quality" value={exportQuality} min={10} max={100} onChange={setExportQuality} />
        ) : null}
        <p className="ed-hint">
          {docSize.w} × {docSize.h}px
          {exportFormat === 'jpeg' ? ' · JPG has no transparency; empty areas become white.' : ''}
        </p>
        <button type="button" className="button button-primary ed-full" onClick={() => void download()} disabled={Boolean(busy)}>
          <Download size={16} /> Download image
        </button>
        <button type="button" className="button button-secondary small ed-full" onClick={() => void sendToConverter()} disabled={Boolean(busy)}>
          <Send size={15} /> Send to converter &amp; resizer
        </button>
      </Section>
    );
  }

  const fileInputHandler = (handler: (files: File[]) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length) handler(files);
  };

  return (
    <div className="editor" aria-label="Photo editor">
      <input ref={openInputRef} className="sr-only" type="file" accept={INPUT_ACCEPT} tabIndex={-1} onChange={fileInputHandler((files) => void openImageAsDocument(files[0]))} />
      <input ref={layerInputRef} className="sr-only" type="file" accept={INPUT_ACCEPT} multiple tabIndex={-1} onChange={fileInputHandler((files) => { void (async () => { for (const file of files) await addImageLayer(file); })(); })} />

      <div className="editor-topbar">
        <div className="editor-topbar-group">
          <button type="button" className="button button-secondary small" onClick={() => setShowStart(true)}>
            <FilePlus2 size={15} /> New
          </button>
          <button type="button" className="ed-icon-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Undo2 size={17} />
          </button>
          <button type="button" className="ed-icon-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
            <Redo2 size={17} />
          </button>
        </div>
        <div className="editor-topbar-group">
          <button type="button" className="ed-icon-btn" onClick={() => { autoFitRef.current = false; applyZoom(zoomRef.current / 1.25); }} title="Zoom out" aria-label="Zoom out">
            <ZoomOut size={17} />
          </button>
          <button type="button" className="ed-zoom" onClick={fitToStage} title="Fit to screen">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" className="ed-icon-btn" onClick={() => { autoFitRef.current = false; applyZoom(zoomRef.current * 1.25); }} title="Zoom in" aria-label="Zoom in">
            <ZoomIn size={17} />
          </button>
          <span className="ed-doc-size">{docSize.w} × {docSize.h}px</span>
        </div>
        <div className="editor-topbar-group">
          <button type="button" className="button button-primary small" onClick={() => setTool('export')} disabled={!hasDoc}>
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      <nav className="editor-rail" aria-label="Editor tools">
        {TOOLS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`editor-rail-btn ${tool === item.id ? 'is-active' : ''}`}
              onClick={() => setTool(item.id)}
              disabled={!hasDoc}
              aria-pressed={tool === item.id}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <aside className="editor-panel">
        {hasDoc ? (
          <>
            {selectionPanel}
            {toolPanel}
          </>
        ) : (
          <Section title="Photo editor">
            <p className="ed-hint">Open a photo or start with a blank canvas to begin editing.</p>
          </Section>
        )}
      </aside>

      <div
        ref={stageRef}
        className={`editor-stage ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(event) => {
          if (!Array.from(event.dataTransfer.types).includes('Files')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleIncomingFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <div className={`editor-canvas-frame checkerboard ${hasDoc ? '' : 'is-hidden'}`} ref={hostRef} />

        {showStart ? (
          <div className="editor-start">
            <div className="editor-start-card">
              {hasDoc ? (
                <button type="button" className="ed-icon-btn editor-start-close" onClick={() => setShowStart(false)} aria-label="Back to the current project">
                  <X size={17} />
                </button>
              ) : null}
              <h2>Photo Editor</h2>
              <p>Crop, adjust, add text, shapes and stickers, draw, remove backgrounds and export — all in your browser.</p>
              <button type="button" className="editor-start-drop" onClick={() => openInputRef.current?.click()}>
                <UploadCloud size={30} aria-hidden="true" />
                <strong>Open a photo</strong>
                <span>or drag and drop an image here</span>
              </button>
              <h3>Or start with a blank canvas</h3>
              <div className="editor-start-presets">
                {CANVAS_PRESETS.map((preset) => (
                  <button key={preset.label} type="button" onClick={() => newBlankDocument(preset.width, preset.height)}>
                    <strong>{preset.label}</strong>
                    <span>{preset.width} × {preset.height}</span>
                  </button>
                ))}
              </div>
              <div className="editor-start-custom">
                <input type="number" min={16} max={MAX_DOC_DIMENSION} value={customSize.w} aria-label="Custom width" onChange={(event) => setCustomSize((current) => ({ ...current, w: Number(event.target.value) }))} />
                <span>×</span>
                <input type="number" min={16} max={MAX_DOC_DIMENSION} value={customSize.h} aria-label="Custom height" onChange={(event) => setCustomSize((current) => ({ ...current, h: Number(event.target.value) }))} />
                <button type="button" className="button button-secondary small" onClick={() => newBlankDocument(customSize.w || 1200, customSize.h || 800)}>
                  Create
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {busy ? (
          <div className="editor-busy" role="status" aria-live="polite">
            <Loader2 className="spin" size={20} aria-hidden="true" />
            {busy}
          </div>
        ) : null}
      </div>
    </div>
  );
}
