import React, { useState, useRef } from 'react';
import {
  FileCode,
  Upload,
  Layers,
  Check,
  X,
  AlertCircle,
  Maximize2,
  Minimize2,
  Ruler,
  DoorOpen,
  AppWindow,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { CadProject, Wall, WallOpening } from '../../types/cad';
import { parseDxfFile, DxfParseResult, DxfLayerSummary } from '../../utils/dxfImporter';

interface DxfImportModalProps {
  project: CadProject;
  onImportWalls: (newWalls: Wall[], newOpenings: WallOpening[], replace: boolean) => void;
  onClose: () => void;
}

export const DxfImportModal: React.FC<DxfImportModalProps> = ({
  project,
  onImportWalls,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rawDxfText, setRawDxfText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<DxfParseResult | null>(null);

  // Import options
  const [forcedUnit, setForcedUnit] = useState<'auto' | 'mm' | 'cm' | 'm'>('auto');
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawDxfText(text);

      const result = parseDxfFile(text, { forcedUnit: 'auto' });
      setParseResult(result);

      // Auto-select suggested wall layers or all
      const suggested = result.layers
        .filter((l) => l.isSuggestedWall || l.lineCount + l.polylineCount > 0)
        .map((l) => l.name);
      setSelectedLayers(suggested.length > 0 ? suggested : result.layers.map((l) => l.name));
      setIsLoading(false);
    };
    reader.readAsText(file);
  };

  const handleUnitChange = (unit: 'auto' | 'mm' | 'cm' | 'm') => {
    setForcedUnit(unit);
    if (rawDxfText) {
      const res = parseDxfFile(rawDxfText, {
        forcedUnit: unit,
        selectedLayers: selectedLayers.length > 0 ? selectedLayers : undefined,
      });
      setParseResult(res);
    }
  };

  const toggleLayer = (layerName: string) => {
    const updated = selectedLayers.includes(layerName)
      ? selectedLayers.filter((l) => l !== layerName)
      : [...selectedLayers, layerName];
    setSelectedLayers(updated);

    if (rawDxfText) {
      const res = parseDxfFile(rawDxfText, {
        forcedUnit,
        selectedLayers: updated,
      });
      setParseResult(res);
    }
  };

  const handleConfirmImport = () => {
    if (!parseResult || parseResult.walls.length === 0) return;
    onImportWalls(parseResult.walls, parseResult.openings, importMode === 'replace');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Імпорт архітектурного креслення DXF
              </h2>
              <p className="text-xs text-neutral-400">
                Розпізнавання стін, перегородок, дверей та вікон з файлів AutoCAD / NanoCAD
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-neutral-300">
          {/* File Picker or Drag Zone */}
          {!parseResult ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-700 hover:border-sky-500 bg-neutral-950/60 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".dxf"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-neutral-200">
                  Оберіть або перетягніть файл .DXF архітектора
                </div>
                <div className="text-[11px] text-neutral-400 mt-1">
                  Підтримуються креслення AutoCAD (ASCII R12, 2000, 2004, 2018), ArchiCAD, Revit
                </div>
              </div>
              <button
                type="button"
                className="mt-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg text-xs flex items-center gap-2 shadow-sm"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Обрати файл на комп'ютері</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileCode className="w-5 h-5 text-sky-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-neutral-100">{fileName}</div>
                    <div className="text-[11px] text-neutral-400">
                      Розпізнано: {parseResult.stats.recognizedWalls} стін, {parseResult.stats.recognizedOpenings} отворів ({parseResult.layers.length} шарів)
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 text-[11px] flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Інший файл</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".dxf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Units & Dimensions Card */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                  <div className="text-[11px] text-neutral-400 font-medium flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5 text-amber-400" />
                    <span>Габарити плану приміщення:</span>
                  </div>
                  <div className="font-mono text-sm font-bold text-neutral-100">
                    {(parseResult.extents.widthMm / 1000).toFixed(2)} м × {(parseResult.extents.heightMm / 1000).toFixed(2)} м
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    Визначена одиниця креслення: <strong className="text-amber-300 uppercase">{parseResult.detectedUnit}</strong>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-1.5">
                  <div className="text-[11px] text-neutral-400 font-medium">Одиниця вимірювання DXF:</div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['auto', 'mm', 'cm', 'm'] as const).map((unit) => (
                      <button
                        key={unit}
                        onClick={() => handleUnitChange(unit)}
                        className={`py-1 text-[11px] font-mono rounded border transition-colors ${
                          forcedUnit === unit
                            ? 'bg-sky-950 border-sky-500 text-sky-300 font-bold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {unit.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    Автоматично або примусово для коректного масштабу
                  </div>
                </div>
              </div>

              {/* Layers Selection */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>Вибір шарів CAD для імпорту стін:</span>
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    Обрано {selectedLayers.length} з {parseResult.layers.length}
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {parseResult.layers.map((layer) => {
                    const isSelected = selectedLayers.includes(layer.name);
                    const totalPrimitives = layer.lineCount + layer.polylineCount + layer.insertCount;
                    if (totalPrimitives === 0) return null;

                    return (
                      <label
                        key={layer.name}
                        className={`flex items-center justify-between p-1.5 rounded cursor-pointer border transition-colors ${
                          isSelected
                            ? 'bg-sky-950/40 border-sky-700/60 text-neutral-200'
                            : 'bg-neutral-900/40 border-neutral-800/60 text-neutral-400 hover:text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLayer(layer.name)}
                            className="rounded border-neutral-700 bg-neutral-900 text-sky-500 focus:ring-sky-500 w-3.5 h-3.5"
                          />
                          <span className="font-mono text-[11px] truncate font-medium">
                            {layer.name}
                          </span>
                          {layer.isSuggestedWall && (
                            <span className="px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 text-[9px] border border-emerald-800">
                              Стіни
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-neutral-400 shrink-0">
                          {layer.lineCount > 0 && `${layer.lineCount} ліній`}
                          {layer.polylineCount > 0 && ` ${layer.polylineCount} поліліній`}
                          {layer.insertCount > 0 && ` ${layer.insertCount} блоків`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Import Mode: Replace vs Merge */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-2">
                <div className="font-semibold text-neutral-200">Дія зі стінами проєкту:</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setImportMode('replace')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      importMode === 'replace'
                        ? 'bg-sky-950/70 border-sky-500 text-sky-200'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-0.5">Замінити поточні стіни</div>
                    <div className="text-[10px] text-neutral-400">
                      Видаляє попередні стіни та імпортує новий архітектурний план
                    </div>
                  </button>

                  <button
                    onClick={() => setImportMode('merge')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      importMode === 'merge'
                        ? 'bg-sky-950/70 border-sky-500 text-sky-200'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-0.5">Додати до наявних</div>
                    <div className="text-[10px] text-neutral-400">
                      Зберігає поточні стіни й додає нові ділянки або прибудови
                    </div>
                  </button>
                </div>
              </div>

              {/* Mini Preview Box */}
              <div className="p-2.5 bg-sky-950/20 border border-sky-900/40 rounded-lg text-neutral-300 text-[11px] flex items-center justify-between">
                <span>
                  Буде створено: <strong>{parseResult.walls.length}</strong> стін (несучі та перегородки) та{' '}
                  <strong>{parseResult.openings.length}</strong> дверей і вікон.
                </span>
                <span className="text-sky-400 font-semibold">Готово до імпорту</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors text-xs"
          >
            Скасувати
          </button>

          {parseResult && (
            <button
              onClick={handleConfirmImport}
              disabled={parseResult.walls.length === 0}
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold transition-colors text-xs flex items-center gap-2 shadow-lg shadow-sky-950/50"
            >
              <Check className="w-4 h-4" />
              <span>Імпортувати у проєкт ({parseResult.walls.length} стін)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
