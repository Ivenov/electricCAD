import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Lock,
  Unlock,
  Trash2,
  Crosshair,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  FileText,
  Ruler,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { CadProject, BackgroundBlueprint, Point } from '../../types/cad';
import { mmToPx } from '../../utils/cadMath';
import { convertDisplayUnitToMm, getUnitLabel } from '../../utils/projectAggregator';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface BlueprintUploadModalProps {
  project: CadProject;
  onUpdateBlueprint: (blueprint: BackgroundBlueprint | undefined) => void;
  onClose: () => void;
}

export const BlueprintUploadModal: React.FC<BlueprintUploadModalProps> = ({
  project,
  onUpdateBlueprint,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentBg = project.backgroundImage;
  const displayUnit = project.displayUnit || 'mm';
  const unitLabel = getUnitLabel(displayUnit);

  const [opacity, setOpacity] = useState(currentBg?.opacity ?? 0.45);
  const [scaleX, setScaleX] = useState(currentBg?.scaleX ?? currentBg?.scale ?? 1.0);
  const [scaleY, setScaleY] = useState(currentBg?.scaleY ?? currentBg?.scale ?? 1.0);
  const [posX, setPosX] = useState(currentBg?.x ?? 0);
  const [posY, setPosY] = useState(currentBg?.y ?? 0);
  const [locked, setLocked] = useState(currentBg?.locked ?? false);
  const [syncScale, setSyncScale] = useState(true);

  // PDF State
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [pdfNumPages, setPdfNumPages] = useState<number>(0);
  const [pdfPage, setPdfPage] = useState<number>(1);
  const [pdfDpi, setPdfDpi] = useState<150 | 200 | 300>(200);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Interactive 2-point scale calibration state (natural image pixels)
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [calPointA, setCalPointA] = useState<Point | null>(null);
  const [calPointB, setCalPointB] = useState<Point | null>(null);
  const [calDistanceInput, setCalDistanceInput] = useState<string>(
    displayUnit === 'm' ? '5' : displayUnit === 'cm' ? '500' : '5000'
  );
  const [calNotice, setCalNotice] = useState<string | null>(null);
  const previewImgRef = useRef<HTMLImageElement>(null);

  // Measure natural image dimensions when blueprint dataUrl changes
  useEffect(() => {
    if (!currentBg?.dataUrl) {
      setNaturalSize(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = currentBg.dataUrl;
  }, [currentBg?.dataUrl]);

  const renderPdfPageToBlueprint = useCallback(
    async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number, dpi: 150 | 200 | 300, fileName: string) => {
      setIsRenderingPdf(true);
      setUploadError(null);
      try {
        const page = await doc.getPage(pageNum);
        // PDF base resolution is 72 DPI
        const renderScale = dpi / 72;
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Не вдалося створити 2D-контекст для рендеру PDF.');
        }

        // Fill white background for clean CAD overlay visibility
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        const dataUrl = canvas.toDataURL('image/png');

        // Sensible initial scale so large high-DPI PDFs fit reasonably into viewport
        const initialScale = Number((72 / dpi).toFixed(3));
        const newBg: BackgroundBlueprint = {
          dataUrl,
          name: `${fileName} (стор. ${pageNum}/${doc.numPages}, ${dpi} DPI)`,
          x: 0,
          y: 0,
          scale: initialScale,
          scaleX: initialScale,
          scaleY: initialScale,
          opacity,
          locked: false,
        };
        onUpdateBlueprint(newBg);
        setPosX(0);
        setPosY(0);
        setScaleX(initialScale);
        setScaleY(initialScale);
        setLocked(false);
        setCalPointA(null);
        setCalPointB(null);
        setCalNotice(null);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Помилка рендеру сторінки PDF');
      } finally {
        setIsRenderingPdf(false);
      }
    },
    [onUpdateBlueprint, opacity]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setCalNotice(null);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      setIsRenderingPdf(true);
      try {
        const buffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setPdfFileName(file.name);
        setPdfNumPages(doc.numPages);
        setPdfPage(1);
        await renderPdfPageToBlueprint(doc, 1, pdfDpi, file.name);
      } catch (err) {
        setUploadError(
          err instanceof Error
            ? `Не вдалося відкрити PDF-файл: ${err.message}`
            : 'Не вдалося відкрити PDF-файл.'
        );
        setIsRenderingPdf(false);
      }
      return;
    }

    // Standard raster/SVG image
    setPdfDoc(null);
    setPdfNumPages(0);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newBg: BackgroundBlueprint = {
        dataUrl,
        name: file.name,
        x: 0,
        y: 0,
        scale: 1.0,
        scaleX: 1.0,
        scaleY: 1.0,
        opacity,
        locked: false,
      };
      onUpdateBlueprint(newBg);
      setPosX(0);
      setPosY(0);
      setScaleX(1.0);
      setScaleY(1.0);
      setLocked(false);
      setCalPointA(null);
      setCalPointB(null);
    };
    reader.readAsDataURL(file);
  };

  const handleChangePdfPage = async (nextPage: number) => {
    if (!pdfDoc || nextPage < 1 || nextPage > pdfNumPages) return;
    setPdfPage(nextPage);
    await renderPdfPageToBlueprint(pdfDoc, nextPage, pdfDpi, pdfFileName);
  };

  const handleChangePdfDpi = async (nextDpi: 150 | 200 | 300) => {
    setPdfDpi(nextDpi);
    if (pdfDoc) {
      await renderPdfPageToBlueprint(pdfDoc, pdfPage, nextDpi, pdfFileName);
    }
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    if (currentBg) {
      onUpdateBlueprint({ ...currentBg, opacity: val });
    }
  };

  const handleScaleXChange = (val: number) => {
    const safe = Math.max(0.02, val || 0.02);
    setScaleX(safe);
    if (syncScale) setScaleY(safe);
    if (currentBg) {
      onUpdateBlueprint({
        ...currentBg,
        scale: safe,
        scaleX: safe,
        scaleY: syncScale ? safe : scaleY,
      });
    }
  };

  const handleScaleYChange = (val: number) => {
    const safe = Math.max(0.02, val || 0.02);
    setScaleY(safe);
    if (syncScale) setScaleX(safe);
    if (currentBg) {
      onUpdateBlueprint({
        ...currentBg,
        scale: syncScale ? safe : currentBg.scale,
        scaleX: syncScale ? safe : scaleX,
        scaleY: safe,
      });
    }
  };

  const handleShiftPosition = (dx: number, dy: number) => {
    const newX = posX + dx;
    const newY = posY + dy;
    setPosX(newX);
    setPosY(newY);
    if (currentBg) {
      onUpdateBlueprint({
        ...currentBg,
        x: newX,
        y: newY,
      });
    }
  };

  const handleToggleLock = () => {
    const newLock = !locked;
    setLocked(newLock);
    if (currentBg) {
      onUpdateBlueprint({ ...currentBg, locked: newLock });
    }
  };

  const handleRemove = () => {
    setPdfDoc(null);
    setPdfNumPages(0);
    setCalPointA(null);
    setCalPointB(null);
    onUpdateBlueprint(undefined);
  };

  // Interactive preview click to pick point A and point B in natural pixel coords
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewImgRef.current || !naturalSize) return;
    const rect = previewImgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const clickX = ((e.clientX - rect.left) / rect.width) * naturalSize.w;
    const clickY = ((e.clientY - rect.top) / rect.height) * naturalSize.h;

    if (!calPointA || (calPointA && calPointB)) {
      setCalPointA({ x: clickX, y: clickY });
      setCalPointB(null);
      setCalNotice(null);
    } else {
      setCalPointB({ x: clickX, y: clickY });
      setCalNotice(null);
    }
  };

  const calImagePixelDist =
    calPointA && calPointB
      ? Math.hypot(calPointB.x - calPointA.x, calPointB.y - calPointA.y)
      : 0;

  const handleApplyTwoPointCalibration = () => {
    if (!currentBg || !calPointA || !calPointB || calImagePixelDist < 5) {
      setUploadError('Позначте 2 точки на плані з відстанню не менше 5 пікселів.');
      return;
    }
    const enteredVal = Number(calDistanceInput);
    if (!Number.isFinite(enteredVal) || enteredVal <= 0) {
      setUploadError('Введіть коректну відому відстань більше 0.');
      return;
    }

    const realMm = convertDisplayUnitToMm(enteredVal, displayUnit);
    // Canvas world unit: 1 px = 10 mm -> targetWorldPx = mmToPx(realMm)
    const targetWorldPx = mmToPx(realMm);
    const calibratedScale = Number((targetWorldPx / calImagePixelDist).toFixed(4));

    setUploadError(null);
    setScaleX(calibratedScale);
    setScaleY(calibratedScale);
    setSyncScale(true);
    onUpdateBlueprint({
      ...currentBg,
      scale: calibratedScale,
      scaleX: calibratedScale,
      scaleY: calibratedScale,
    });
    setCalNotice(
      `Масштаб відкалібровано: ${enteredVal} ${unitLabel} (${realMm} мм) = ${Math.round(calImagePixelDist)} px підкладки -> масштаб ${calibratedScale.toFixed(4)}x`
    );
  };

  // Preset 1: Clean cropped BTI Blueprint fitted 100% to axes and walls
  const handleApplyBtiBlueprint = () => {
    setPdfDoc(null);
    setPdfNumPages(0);
    const btiBg: BackgroundBlueprint = {
      dataUrl: '/assets/aistudio/photo_bti_clean.png',
      name: 'Архітектурний план БТІ поверху (підігнано за осями 1-3 та E-A)',
      x: -12,
      y: -108,
      scale: 2.957,
      scaleX: 2.957,
      scaleY: 3.128,
      opacity: 0.45,
      locked: true,
    };
    setPosX(-12);
    setPosY(-108);
    setScaleX(2.957);
    setScaleY(3.128);
    setSyncScale(false);
    setOpacity(0.45);
    setLocked(true);
    onUpdateBlueprint(btiBg);
  };

  // Preset 2: High-res electrical scheme with red runs
  const handleApplyElectricalScheme = () => {
    setPdfDoc(null);
    setPdfNumPages(0);
    const elBg: BackgroundBlueprint = {
      dataUrl: '/assets/aistudio/photo_2026-10-14_13-48-26_428bb88d.jpg',
      name: 'Електротехнічна схема будинку (з червоними магістралями)',
      x: -8,
      y: -35,
      scale: 1.57,
      scaleX: 1.57,
      scaleY: 1.57,
      opacity: 0.45,
      locked: true,
    };
    setPosX(-8);
    setPosY(-35);
    setScaleX(1.57);
    setScaleY(1.57);
    setSyncScale(true);
    setOpacity(0.45);
    setLocked(true);
    onUpdateBlueprint(elBg);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Імпорт підкладки та калібрування масштабу (PDF / PNG / JPG)
              </h2>
              <p className="text-xs text-neutral-400">
                Підтримує багатосторінкові PDF-креслення БТІ, вибір DPI та точне калібрування за двома точками
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
          />

          {uploadError && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Upload Custom File (PDF / Image) */}
          <div
            onClick={() => !isRenderingPdf && fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-700 hover:border-sky-500/70 bg-neutral-950/60 hover:bg-neutral-950 rounded-xl p-5 text-center cursor-pointer transition-colors group flex flex-col items-center justify-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
              {isRenderingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-200 block mb-0.5">
                {isRenderingPdf ? 'Рендеринг сторінки PDF...' : 'Завантажити план приміщення (PDF, PNG, JPG, SVG)'}
              </span>
              <span className="text-[11px] text-neutral-500">
                PDF-креслення обробляються локально у браузері з вибором сторінки та роздільності DPI
              </span>
            </div>
          </div>

          {/* PDF Page & DPI Controls */}
          {pdfDoc && pdfNumPages > 0 && (
            <div className="p-3.5 bg-sky-950/20 border border-sky-500/40 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>PDF-документ: {pdfFileName}</span>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">
                  Сторінок: {pdfNumPages}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Page selector */}
                <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] text-neutral-400">Сторінка плану:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isRenderingPdf || pdfPage <= 1}
                      onClick={() => handleChangePdfPage(pdfPage - 1)}
                      className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs text-neutral-200"
                    >
                      ◀
                    </button>
                    <span className="font-mono text-xs text-sky-400 font-bold min-w-[44px] text-center">
                      {pdfPage} / {pdfNumPages}
                    </span>
                    <button
                      type="button"
                      disabled={isRenderingPdf || pdfPage >= pdfNumPages}
                      onClick={() => handleChangePdfPage(pdfPage + 1)}
                      className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs text-neutral-200"
                    >
                      ▶
                    </button>
                  </div>
                </div>

                {/* DPI selector */}
                <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] text-neutral-400">Якість DPI:</span>
                  <div className="flex items-center gap-1">
                    {([150, 200, 300] as const).map((dpi) => (
                      <button
                        key={dpi}
                        type="button"
                        disabled={isRenderingPdf}
                        onClick={() => handleChangePdfDpi(dpi)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                          pdfDpi === dpi
                            ? 'bg-sky-500 text-neutral-950 font-bold'
                            : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                        }`}
                      >
                        {dpi}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Preset Selector Buttons */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-neutral-300 block">
              Швидкі шаблони підкладок (із заводською підгонкою):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={handleApplyBtiBlueprint}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  currentBg?.dataUrl === '/assets/aistudio/photo_bti_clean.png'
                    ? 'bg-sky-950/40 border-sky-500 text-sky-300 shadow-md shadow-sky-950/40'
                    : 'bg-neutral-950/80 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                    План БТІ поверху (185 м²)
                  </span>
                  {currentBg?.dataUrl === '/assets/aistudio/photo_bti_clean.png' && (
                    <span className="w-4 h-4 rounded-full bg-sky-500 text-neutral-950 flex items-center justify-center text-[10px] font-bold">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-neutral-400">
                  Підігнано 1:1 під осі 1-3, Д, Г, Б, А та меблювання
                </span>
              </button>

              <button
                onClick={handleApplyElectricalScheme}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  currentBg?.dataUrl === '/assets/aistudio/photo_2026-10-14_13-48-26_428bb88d.jpg'
                    ? 'bg-sky-950/40 border-sky-500 text-sky-300 shadow-md shadow-sky-950/40'
                    : 'bg-neutral-950/80 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    Схема з червоними трасами
                  </span>
                  {currentBg?.dataUrl === '/assets/aistudio/photo_2026-10-14_13-48-26_428bb88d.jpg' && (
                    <span className="w-4 h-4 rounded-full bg-sky-500 text-neutral-950 flex items-center justify-center text-[10px] font-bold">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-neutral-400">
                  Креслення з вимикачами, коробками та лінією Гр.1
                </span>
              </button>
            </div>
          </div>

          {currentBg && (
            <div className="space-y-4 pt-2 border-t border-neutral-800">
              {/* Active Blueprint Status Card */}
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-neutral-800 overflow-hidden border border-neutral-700 flex items-center justify-center shrink-0">
                    <img
                      src={currentBg.dataUrl}
                      alt="План підкладка"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-neutral-200 block truncate max-w-[260px]">
                      {currentBg.name}
                    </span>
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1.5 font-mono">
                      <span>X: {posX} px</span>
                      <span>·</span>
                      <span>Y: {posY} px</span>
                      <span>·</span>
                      <span>Масштаб: {scaleX.toFixed(3)}x / {scaleY.toFixed(3)}x</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setCalibrationOpen((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      calibrationOpen
                        ? 'bg-emerald-500 text-neutral-950 border-emerald-400'
                        : 'bg-emerald-950/40 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900/50'
                    }`}
                    title="Встановити точний масштаб 1:1 за відомою відстанню на кресленні"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Калібрування</span>
                  </button>
                  <button
                    onClick={handleToggleLock}
                    className={`p-2 rounded-lg border text-xs transition-colors ${
                      locked
                        ? 'bg-neutral-800 text-sky-400 border-neutral-700'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                    }`}
                    title={locked ? 'Підкладку заблоковано (не зсунеться мишкою)' : 'Підкладку розблоковано (можна перетягувати на полотні)'}
                  >
                    {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={handleRemove}
                    className="p-2 rounded-lg border border-neutral-800 bg-neutral-950 text-rose-400 hover:bg-rose-950/40 hover:border-rose-800 transition-colors"
                    title="Видалити підкладку з полотна"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Interactive 2-Point Scale Calibration Tool */}
              {calibrationOpen && (
                <div className="p-4 bg-emerald-950/15 border border-emerald-600/40 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                      <Ruler className="w-4 h-4 text-emerald-400" />
                      <span>Калібрування масштабу за двома точками (A ➔ B)</span>
                    </div>
                    {calPointA && (
                      <button
                        type="button"
                        onClick={() => {
                          setCalPointA(null);
                          setCalPointB(null);
                          setCalNotice(null);
                        }}
                        className="text-[11px] text-neutral-400 hover:text-neutral-200"
                      >
                        Скинути точки
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Клікніть послідовно на дві контрольні точки вздовж відомої стіни чи розмірної лінії на зображенні нижче, введіть реальну довжину та натисніть «Застосувати масштаб».
                  </p>

                  {/* Interactive Image Preview with SVG calibration overlay */}
                  <div
                    onClick={handlePreviewClick}
                    className="relative bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden cursor-crosshair select-none max-h-[300px] flex items-center justify-center"
                  >
                    <img
                      ref={previewImgRef}
                      src={currentBg.dataUrl}
                      alt="Калібрування масштабу"
                      className="max-h-[290px] w-auto object-contain block pointer-events-none"
                    />
                    {naturalSize && (
                      <svg
                        viewBox={`0 0 ${naturalSize.w} ${naturalSize.h}`}
                        preserveAspectRatio="xMidYMid meet"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      >
                        {calPointA && calPointB && (
                          <line
                            x1={calPointA.x}
                            y1={calPointA.y}
                            x2={calPointB.x}
                            y2={calPointB.y}
                            stroke="#10b981"
                            strokeWidth={Math.max(2, naturalSize.w / 250)}
                            strokeDasharray={`${Math.max(6, naturalSize.w / 100)} ${Math.max(4, naturalSize.w / 150)}`}
                          />
                        )}
                        {calPointA && (
                          <g>
                            <circle
                              cx={calPointA.x}
                              cy={calPointA.y}
                              r={Math.max(6, naturalSize.w / 120)}
                              fill="#10b981"
                              stroke="#020617"
                              strokeWidth={Math.max(2, naturalSize.w / 400)}
                            />
                          </g>
                        )}
                        {calPointB && (
                          <g>
                            <circle
                              cx={calPointB.x}
                              cy={calPointB.y}
                              r={Math.max(6, naturalSize.w / 120)}
                              fill="#38bdf8"
                              stroke="#020617"
                              strokeWidth={Math.max(2, naturalSize.w / 400)}
                            />
                          </g>
                        )}
                      </svg>
                    )}
                  </div>

                  {/* Calibration distance inputs */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-[11px] font-mono text-neutral-400">
                      {!calPointA
                        ? 'Крок 1: Вкажіть точку A на кресленні'
                        : !calPointB
                        ? 'Крок 2: Вкажіть точку B на кресленні'
                        : `Відрізок на зображенні: ${Math.round(calImagePixelDist)} px`}
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-neutral-300">Реальна відстань:</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={calDistanceInput}
                          onChange={(e) => setCalDistanceInput(e.target.value)}
                          className="w-28 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs font-mono text-emerald-300 font-bold pr-8 focus:outline-none focus:border-emerald-500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 font-mono">
                          {unitLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={!calPointA || !calPointB}
                        onClick={handleApplyTwoPointCalibration}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-neutral-950 font-bold text-xs transition-colors"
                      >
                        Застосувати масштаб
                      </button>
                    </div>
                  </div>

                  {calNotice && (
                    <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-[11px] font-mono">
                      ✓ {calNotice}
                    </div>
                  )}
                </div>
              )}

              {/* Opacity slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-neutral-400">Прозорість шару креслення:</span>
                  <span className="font-mono text-sky-400 font-semibold">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Fine Calibration: Position Controls (X and Y offset) */}
              <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-200">
                    Тонке зміщення та центрування (пікселі):
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-neutral-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncScale}
                      onChange={(e) => setSyncScale(e.target.checked)}
                      className="accent-sky-400"
                    />
                    <span>Пропорційно X=Y</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* X Offset */}
                  <div className="flex items-center justify-between bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-800">
                    <span className="text-xs text-neutral-400 font-mono">X: {posX}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleShiftPosition(-10, 0)}
                        className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono px-1.5"
                        title="-10 px"
                      >
                        -10
                      </button>
                      <button
                        onClick={() => handleShiftPosition(-1, 0)}
                        className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                        title="-1 px"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleShiftPosition(1, 0)}
                        className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                        title="+1 px"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleShiftPosition(10, 0)}
                        className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono px-1.5"
                        title="+10 px"
                      >
                        +10
                      </button>
                    </div>
                  </div>

                  {/* Y Offset */}
                  <div className="flex items-center justify-between bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-800">
                    <span className="text-xs text-neutral-400 font-mono">Y: {posY}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleShiftPosition(0, -10)}
                        className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono px-1.5"
                        title="-10 px"
                      >
                        -10
                      </button>
                      <button
                        onClick={() => handleShiftPosition(0, -1)}
                        className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                        title="-1 px"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleShiftPosition(0, 1)}
                        className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                        title="+1 px"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleShiftPosition(0, 10)}
                        className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono px-1.5"
                        title="+10 px"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scale X and Scale Y */}
                <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Масштаб X (по ширині):</span>
                    <input
                      type="number"
                      min="0.05"
                      max="10"
                      step="0.005"
                      value={Number(scaleX.toFixed(4))}
                      onChange={(e) => handleScaleXChange(parseFloat(e.target.value))}
                      className="w-24 bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-right font-mono text-sky-400 font-semibold focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="6.0"
                    step="0.005"
                    value={Math.min(6.0, scaleX)}
                    onChange={(e) => handleScaleXChange(parseFloat(e.target.value))}
                    className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-neutral-400">Масштаб Y (по висоті):</span>
                    <input
                      type="number"
                      min="0.05"
                      max="10"
                      step="0.005"
                      value={Number(scaleY.toFixed(4))}
                      onChange={(e) => handleScaleYChange(parseFloat(e.target.value))}
                      className="w-24 bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-right font-mono text-sky-400 font-semibold focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="6.0"
                    step="0.005"
                    value={Math.min(6.0, scaleY)}
                    onChange={(e) => handleScaleYChange(parseFloat(e.target.value))}
                    className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between">
          <button
            onClick={handleApplyBtiBlueprint}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sky-300 font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors border border-neutral-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Шаблон БТІ</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold rounded-lg text-xs transition-colors shadow-sm"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
