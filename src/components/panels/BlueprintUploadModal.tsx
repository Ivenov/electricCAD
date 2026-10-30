import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Lock, Unlock, Trash2, Crosshair, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, RotateCcw, Check } from 'lucide-react';
import { CadProject, BackgroundBlueprint } from '../../types/cad';

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

  const [opacity, setOpacity] = useState(currentBg?.opacity ?? 0.45);
  const [scaleX, setScaleX] = useState(currentBg?.scaleX ?? currentBg?.scale ?? 2.957);
  const [scaleY, setScaleY] = useState(currentBg?.scaleY ?? currentBg?.scale ?? 3.128);
  const [posX, setPosX] = useState(currentBg?.x ?? -12);
  const [posY, setPosY] = useState(currentBg?.y ?? -108);
  const [locked, setLocked] = useState(currentBg?.locked ?? true);
  const [syncScale, setSyncScale] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    };
    reader.readAsDataURL(file);
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    if (currentBg) {
      onUpdateBlueprint({ ...currentBg, opacity: val });
    }
  };

  const handleScaleXChange = (val: number) => {
    setScaleX(val);
    if (syncScale) setScaleY(val);
    if (currentBg) {
      onUpdateBlueprint({
        ...currentBg,
        scale: val,
        scaleX: val,
        scaleY: syncScale ? val : scaleY,
      });
    }
  };

  const handleScaleYChange = (val: number) => {
    setScaleY(val);
    if (syncScale) setScaleX(val);
    if (currentBg) {
      onUpdateBlueprint({
        ...currentBg,
        scale: syncScale ? val : currentBg.scale,
        scaleX: syncScale ? val : scaleX,
        scaleY: val,
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
    onUpdateBlueprint(undefined);
  };

  // Preset 1: Clean cropped BTI Blueprint fitted 100% to axes and walls
  const handleApplyBtiBlueprint = () => {
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
    setOpacity(0.45);
    setLocked(true);
    onUpdateBlueprint(btiBg);
  };

  // Preset 2: High-res electrical scheme with red runs
  const handleApplyElectricalScheme = () => {
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
    setOpacity(0.45);
    setLocked(true);
    onUpdateBlueprint(elBg);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Підгонка плану під підкладку БТІ
              </h2>
              <p className="text-xs text-neutral-400">
                Точне суміщення векторних стін CAD з архітектурним планом БТІ або електротехнічною схемою
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
            accept="image/png, image/jpeg, image/webp, image/svg+xml"
            className="hidden"
          />

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
                    <span className="text-xs font-semibold text-neutral-200 block truncate max-w-[240px]">
                      {currentBg.name}
                    </span>
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
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
                  <button
                    onClick={handleApplyBtiBlueprint}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                    title="Скинути до точного центрування за осями БТІ"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Скинути до осей</span>
                  </button>
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
                    <span className="font-mono text-sky-400 font-semibold">{scaleX.toFixed(3)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.005"
                    value={scaleX}
                    onChange={(e) => handleScaleXChange(parseFloat(e.target.value))}
                    className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-neutral-400">Масштаб Y (по висоті):</span>
                    <span className="font-mono text-sky-400 font-semibold">{scaleY.toFixed(3)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.005"
                    value={scaleY}
                    onChange={(e) => handleScaleYChange(parseFloat(e.target.value))}
                    className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 p-3 bg-neutral-950 rounded-lg border border-neutral-800 flex items-start gap-2">
                <span className="text-sky-400 text-base leading-none">💡</span>
                <span>
                  План автоматично підігнано за основними осями 1, 2, 3 та A, Б, Г, Д, E. За бажанням розблокуйте замок для ручного перетягування плану мишкою прямо по полотну.
                </span>
              </div>
            </div>
          )}

          {/* Upload Custom File */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-neutral-700 hover:border-sky-500/70 bg-neutral-950/60 hover:bg-neutral-950 rounded-xl p-6 text-center cursor-pointer transition-colors group flex flex-col items-center justify-center gap-2.5"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-200 block mb-0.5">
                Завантажити власний файл плану БТІ
              </span>
              <span className="text-[11px] text-neutral-500">
                Формати PNG, JPG, WebP або SVG креслення
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between">
          <button
            onClick={handleApplyBtiBlueprint}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sky-300 font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors border border-neutral-700"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Авто-підгонка під БТІ</span>
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
