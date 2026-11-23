import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Copy,
  RotateCw,
  DoorOpen,
  AppWindow,
  Link2,
  Cable,
  Zap,
  Hash,
  Sparkles,
  Flame,
  ShieldCheck,
  Check,
  Layers,
  Sofa,
  Ruler,
  ArrowRightLeft,
  Compass,
  Move,
  Split,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { CadProject, ElectricalElement, Wall, WallOpening, WireRoute, FurnitureItem } from '../../types/cad';
import {
  pxToMm,
  mmToPx,
  distance,
  getCableDisplayName,
  getCableCrossSection,
  calculateCableLengthM,
  calculateWallLengthMm,
  calculateWallAngleDeg,
  setWallLengthMm,
  setWallAngleDeg,
  alignWallOrtho,
  reverseWall,
  analyzeElementWallDatum,
  positionElementByWallDatum,
} from '../../utils/cadMath';
import { computeOrthogonalPath } from '../../utils/autoRouting';
import {
  formatDimensionValue,
  getUnitLabel,
  convertDisplayUnitToMm,
  convertMmToDisplayUnit,
} from '../../utils/projectAggregator';

interface PropertyInspectorProps {
  project: CadProject;
  selectedElementId: string | null;
  selectedWallId: string | null;
  selectedOpeningId?: string | null;
  selectedWireId?: string | null;
  selectedFurnitureId?: string | null;
  onUpdateElement: (updated: ElectricalElement) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onUpdateWall: (updated: Wall) => void;
  onDeleteWall: (id: string) => void;
  onUpdateOpening?: (updated: WallOpening) => void;
  onDeleteOpening?: (id: string) => void;
  onSelectWire?: (id: string | null) => void;
  onUpdateWire?: (updated: WireRoute) => void;
  onDeleteWire?: (id: string) => void;
  onUpdateFurniture?: (updated: FurnitureItem) => void;
  onDeleteFurniture?: (id: string) => void;
  onDuplicateFurniture?: (id: string) => void;
  onOpenSwitchWiringDiagram?: (sw?: ElectricalElement) => void;
  linkingSwitchId?: string | null;
  onStartSwitchLinking?: (switchId: string) => void;
  onCancelSwitchLinking?: () => void;
  onAutoAssignCircuits?: () => void;
  onAutoNumberCables?: () => void;
  autoRoutingEnabled?: boolean;
  onToggleAutoRouting?: () => void;
  onOptimizeParallelWires?: () => void;
  onOpenAutoSocketsModal?: () => void;
  onOpenWallElevation?: (wallId?: string) => void;
  multiSelectedElementIds?: string[];
  onClearMultiSelection?: () => void;
  onBulkUpdateElements?: (
    ids: string[],
    patch: Partial<Pick<ElectricalElement, 'circuitId' | 'mountingHeightMm' | 'ipRating' | 'isBackupPriority'>>
  ) => void;
  onAlignElements?: (ids: string[], mode: 'align_x' | 'align_y' | 'pitch_71_h' | 'pitch_71_v') => void;
  onDeleteElementsBatch?: (ids: string[]) => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  project,
  selectedElementId,
  selectedWallId,
  selectedOpeningId,
  selectedWireId,
  selectedFurnitureId,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onUpdateWall,
  onDeleteWall,
  onUpdateOpening,
  onDeleteOpening,
  onSelectWire,
  onUpdateWire,
  onDeleteWire,
  onUpdateFurniture,
  onDeleteFurniture,
  onDuplicateFurniture,
  onOpenSwitchWiringDiagram,
  linkingSwitchId,
  onStartSwitchLinking,
  onCancelSwitchLinking,
  onAutoAssignCircuits,
  onAutoNumberCables,
  autoRoutingEnabled = true,
  onToggleAutoRouting,
  onOptimizeParallelWires,
  onOpenAutoSocketsModal,
  onOpenWallElevation,
  multiSelectedElementIds = [],
  onClearMultiSelection,
  onBulkUpdateElements,
  onAlignElements,
  onDeleteElementsBatch,
}) => {
  const [wallAnchor, setWallAnchor] = useState<'start' | 'center' | 'end'>('start');
  const [bulkCircuitId, setBulkCircuitId] = useState<string>('');
  const [bulkHeightInput, setBulkHeightInput] = useState<string>('300');
  const displayUnit = project.displayUnit || 'mm';
  const unitLabel = getUnitLabel(displayUnit);

  const selectedElement = project.elements.find((el) => el.id === selectedElementId);
  const multiSelectedElements = useMemo(
    () => project.elements.filter((el) => multiSelectedElementIds.includes(el.id)),
    [project.elements, multiSelectedElementIds]
  );
  const isMultiSelected = multiSelectedElements.length > 1;
  const selectedWall = project.walls.find((w) => w.id === selectedWallId);
  const selectedOpening = project.openings.find((op) => op.id === selectedOpeningId);
  const selectedWire = project.wires.find((w) => w.id === selectedWireId);
  const selectedFurniture = project.furniture?.find((f) => f.id === selectedFurnitureId);
  const openingWall = selectedOpening ? project.walls.find((w) => w.id === selectedOpening.wallId) : null;

  // Geometric Datum Analysis (Centerline, Plaster Faces, and Door Jambs like Electro-Planner)
  const wallDatum = useMemo(() => {
    if (!selectedElement) return null;
    return analyzeElementWallDatum(selectedElement.position, project.walls, project.openings || []);
  }, [selectedElement, project.walls, project.openings]);

  // Common mounting height quick picks in mm
  const HEIGHT_PRESETS = [
    { label: '+300 (Стандарт підлога)', value: 300 },
    { label: '+750 (Письмовий стіл)', value: 750 },
    { label: '+900 (Вимикач)', value: 900 },
    { label: '+1050 (Фартух кухні)', value: 1050 },
    { label: '+1100 (ТВ зона)', value: 1100 },
    { label: '+1600 (Бра / Щит)', value: 1600 },
    { label: '+2200 (Кондиціонер)', value: 2200 },
    { label: '+2700 (Стеля)', value: 2700 },
  ];

  // Heavy appliance presets for dedicated lines (ПУЕ)
  const HEAVY_APPLIANCE_PRESETS = [
    {
      title: 'Варильна поверхня',
      power: 7200,
      breakerRatingA: 32,
      cableType: 'VVGng_3x6' as const,
      desc: '32A · ВВГнгд 3×6 мм²',
      backup: false,
    },
    {
      title: 'Духова шафа',
      power: 3200,
      breakerRatingA: 16,
      cableType: 'VVGng_3x2.5' as const,
      desc: '16A · ВВГнгд 3×2.5 мм²',
      backup: false,
    },
    {
      title: 'Бойлер / Водонагрівач',
      power: 2000,
      breakerRatingA: 16,
      cableType: 'VVGng_3x2.5' as const,
      desc: '16A + ПЗВ 10мА · 3×2.5',
      backup: true,
    },
    {
      title: 'Пральна машина',
      power: 2200,
      breakerRatingA: 16,
      cableType: 'VVGng_3x2.5' as const,
      desc: '16A + ПЗВ · 3×2.5',
      backup: false,
    },
    {
      title: 'Посудомийна машина',
      power: 2000,
      breakerRatingA: 16,
      cableType: 'VVGng_3x2.5' as const,
      desc: '16A · ВВГнгд 3×2.5 мм²',
      backup: false,
    },
    {
      title: 'Кондиціонер (спліт)',
      power: 1500,
      breakerRatingA: 16,
      cableType: 'VVGng_3x2.5' as const,
      desc: '16A · ВВГнгд 3×2.5 мм²',
      backup: false,
    },
    {
      title: 'Газовий котел / Насоси',
      power: 300,
      breakerRatingA: 10,
      cableType: 'VVGng_3x1.5' as const,
      desc: '10A + АКБ резерв · 3×1.5',
      backup: true,
    },
  ];

  // Helper for applying heavy appliance preset
  const handleApplyAppliancePreset = (preset: typeof HEAVY_APPLIANCE_PRESETS[0]) => {
    if (!selectedElement) return;

    // Find existing circuit with matching name or create / assign
    let matchingCircuit = project.circuits.find(
      (c) => c.name.toLowerCase().includes(preset.title.toLowerCase())
    );

    onUpdateElement({
      ...selectedElement,
      name: preset.title,
      powerWatts: preset.power,
      isBackupPriority: preset.backup,
      circuitId: matchingCircuit?.id || selectedElement.circuitId,
      notes: `Виділена лінія: ${preset.desc}`,
    });
  };

  // Find linked lights for switch
  const linkedLights = selectedElement && selectedElement.category === 'switch'
    ? project.elements.filter(
        (el) =>
          el.category === 'light' &&
          selectedElement.switchGroupId &&
          el.switchGroupId === selectedElement.switchGroupId
      )
    : [];

  const wireFromEl = selectedWire ? project.elements.find((e) => e.id === selectedWire.fromId) : null;
  const wireToEl = selectedWire ? project.elements.find((e) => e.id === selectedWire.toId) : null;

  return (
    <aside className="w-80 bg-neutral-900 border-l border-neutral-800 flex flex-col h-full shrink-0 select-none z-20">
      {/* Panel Header */}
      <div className="h-12 border-b border-neutral-800 px-4 flex items-center justify-between">
        <span className="text-xs font-bold tracking-wide uppercase text-neutral-300">
          {isMultiSelected ? `Група (${multiSelectedElements.length} елементів)` : "Властивості об'єкта"}
        </span>
        {isMultiSelected && onDeleteElementsBatch && (
          <div className="flex items-center gap-1">
            {onClearMultiSelection && (
              <button
                onClick={onClearMultiSelection}
                title="Зняти групове виділення"
                className="px-2 py-1 text-[10px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
              >
                Скинути
              </button>
            )}
            <button
              onClick={() => onDeleteElementsBatch(multiSelectedElements.map((e) => e.id))}
              title="Видалити всі виділені елементи (Del)"
              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {!isMultiSelected && selectedElement && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onDuplicateElement(selectedElement.id)}
              title="Дублювати (Ctrl+D)"
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDeleteElement(selectedElement.id)}
              title="Видалити (Del)"
              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {selectedWall && (
          <button
            onClick={() => onDeleteWall(selectedWall.id)}
            title="Видалити стіну"
            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {selectedOpening && (
          <button
            onClick={() => onDeleteOpening?.(selectedOpening.id)}
            title={selectedOpening.type === 'door' ? 'Видалити двері' : 'Видалити вікно'}
            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {selectedWire && (
          <button
            onClick={() => onDeleteWire?.(selectedWire.id)}
            title="Видалити кабельну трасу (Del)"
            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {selectedFurniture && (
          <div className="flex items-center gap-1">
            {onDuplicateFurniture && (
              <button
                onClick={() => onDuplicateFurniture(selectedFurniture.id)}
                title="Дублювати меблі"
                className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
              </button>
            )}
            {onDeleteFurniture && (
              <button
                onClick={() => onDeleteFurniture(selectedFurniture.id)}
                title="Видалити меблі (Del)"
                className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* CASE 0: FURNITURE SELECTED */}
        {selectedFurniture && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-neutral-950/70 border border-sky-500/30 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold">
                <Sofa className="w-5 h-5 text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-sky-400 font-mono font-bold uppercase tracking-wider block">
                  Архітектурні меблі
                </span>
                <span className="text-sm font-bold text-white truncate block">
                  {selectedFurniture.name}
                </span>
              </div>
            </div>

            {/* Name input */}
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1">Назва об'єкта</label>
              <input
                type="text"
                value={selectedFurniture.name}
                onChange={(e) => onUpdateFurniture?.({ ...selectedFurniture, name: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-sky-500 font-medium"
              />
            </div>

            {/* Dimensions: Width mm & Depth mm */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Ширина (мм)</label>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="50"
                  value={selectedFurniture.width}
                  onChange={(e) => onUpdateFurniture?.({ ...selectedFurniture, width: Number(e.target.value) || 100 })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 font-mono text-neutral-100 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Глибина (мм)</label>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="50"
                  value={selectedFurniture.height}
                  onChange={(e) => onUpdateFurniture?.({ ...selectedFurniture, height: Number(e.target.value) || 100 })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 font-mono text-neutral-100 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Coordinates & Rotation */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">X ({unitLabel})</label>
                <div className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 font-mono text-neutral-300">
                  {formatDimensionValue(pxToMm(selectedFurniture.position.x), displayUnit, false)}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Y ({unitLabel})</label>
                <div className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 font-mono text-neutral-300">
                  {formatDimensionValue(pxToMm(selectedFurniture.position.y), displayUnit, false)}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">Кут</label>
                <button
                  onClick={() =>
                    onUpdateFurniture?.({
                      ...selectedFurniture,
                      rotation: ((selectedFurniture.rotation || 0) + 90) % 360,
                    })
                  }
                  className="w-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded px-2 py-1.5 flex items-center justify-center gap-1 font-mono text-neutral-200 transition-colors"
                  title="Повернути на +90°"
                >
                  <RotateCw className="w-3 h-3 text-sky-400" />
                  <span>{selectedFurniture.rotation || 0}°</span>
                </button>
              </div>
            </div>

            {/* Quick Rotation Angle Buttons */}
            <div>
              <label className="text-[11px] text-neutral-400 block mb-1.5">Швидкий поворот</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => onUpdateFurniture?.({ ...selectedFurniture, rotation: deg })}
                    className={`py-1 rounded text-xs font-mono font-semibold border transition-colors ${
                      (selectedFurniture.rotation || 0) === deg
                        ? 'bg-sky-500 text-neutral-950 border-sky-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>

            {/* Electrical Proximity Recommendations Box */}
            <div className="p-3 rounded-xl bg-neutral-950/80 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wide">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Рекомендації електрики:</span>
              </div>
              {selectedFurniture.electricalHints && selectedFurniture.electricalHints.length > 0 ? (
                <div className="space-y-1 text-[11px] text-neutral-300">
                  {selectedFurniture.electricalHints.map((hint, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-400">•</span>
                      <span>{hint}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400">
                  Рекомендовано передбачити розетки загального призначення на відстані не менше 300 мм від підлоги або за спинкою.
                </p>
              )}
            </div>

            {/* Delete / Duplicate buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
              {onDuplicateFurniture && (
                <button
                  onClick={() => onDuplicateFurniture(selectedFurniture.id)}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span>Дублювати</span>
                </button>
              )}
              {onDeleteFurniture && (
                <button
                  onClick={() => onDeleteFurniture(selectedFurniture.id)}
                  className="py-1.5 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Видалити</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* CASE 0.5: MULTI-SELECTION BULK EDITOR */}
        {isMultiSelected ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  Мультивиділення ({multiSelectedElements.length} шт.)
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  {multiSelectedElements.reduce((s, e) => s + (e.powerWatts || 0), 0)} Вт
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Перетягуйте будь-який виділений елемент на полотні для синхронного переміщення групи. Ctrl+C / Ctrl+V для копіювання.
              </p>
            </div>

            {/* Alignment & 71mm Modular Pitch */}
            {onAlignElements && (
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <label className="text-[11px] font-bold text-neutral-300 block uppercase tracking-wide">
                  Вирівнювання та крок 71 мм
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onAlignElements(multiSelectedElements.map((e) => e.id), 'align_x')}
                    className="py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded text-[11px] text-neutral-200 font-medium transition-colors"
                  >
                    Вирівняти по X
                  </button>
                  <button
                    type="button"
                    onClick={() => onAlignElements(multiSelectedElements.map((e) => e.id), 'align_y')}
                    className="py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded text-[11px] text-neutral-200 font-medium transition-colors"
                  >
                    Вирівняти по Y
                  </button>
                  <button
                    type="button"
                    onClick={() => onAlignElements(multiSelectedElements.map((e) => e.id), 'pitch_71_h')}
                    className="py-1.5 px-2 bg-sky-950/50 hover:bg-sky-900/60 border border-sky-700/60 rounded text-[11px] text-sky-300 font-semibold transition-colors"
                    title="Згрупувати в горизонтальний блок механізмів з міжосьовим кроком 71 мм"
                  >
                    Крок 71 мм (Гориз.)
                  </button>
                  <button
                    type="button"
                    onClick={() => onAlignElements(multiSelectedElements.map((e) => e.id), 'pitch_71_v')}
                    className="py-1.5 px-2 bg-sky-950/50 hover:bg-sky-900/60 border border-sky-700/60 rounded text-[11px] text-sky-300 font-semibold transition-colors"
                    title="Згрупувати у вертикальний блок механізмів з міжосьовим кроком 71 мм"
                  >
                    Крок 71 мм (Верт.)
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Group Assignment */}
            {onBulkUpdateElements && (
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5">
                <label className="text-[11px] font-bold text-neutral-300 block uppercase tracking-wide">
                  Групове призначення параметрів
                </label>

                <div>
                  <span className="text-[10px] text-neutral-400 block mb-1">Електрична група щита:</span>
                  <div className="flex gap-1.5">
                    <select
                      value={bulkCircuitId}
                      onChange={(e) => setBulkCircuitId(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="">— Оберіть групу —</option>
                      {project.circuits.map((c) => (
                        <option key={c.id} value={c.id}>
                          Гр.{c.number} · {c.name} ({c.breakerRatingA}A)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!bulkCircuitId}
                      onClick={() =>
                        onBulkUpdateElements(
                          multiSelectedElements.map((e) => e.id),
                          { circuitId: bulkCircuitId }
                        )
                      }
                      className="px-2.5 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-neutral-950 font-bold rounded text-[11px] transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-400 block mb-1">
                    Висота монтажу (мм від чистої підлоги):
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={project.ceilingHeightMm}
                      step={50}
                      value={bulkHeightInput}
                      onChange={(e) => setBulkHeightInput(e.target.value)}
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 font-mono text-xs text-neutral-100 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const h = Math.max(0, Number(bulkHeightInput) || 0);
                        onBulkUpdateElements(
                          multiSelectedElements.map((e) => e.id),
                          { mountingHeightMm: h }
                        );
                      }}
                      className="px-2.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold rounded text-[11px] transition-colors"
                    >
                      Задати
                    </button>
                  </div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {[300, 900, 1050, 2200, 2700].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          setBulkHeightInput(String(h));
                          onBulkUpdateElements(
                            multiSelectedElements.map((e) => e.id),
                            { mountingHeightMm: h }
                          );
                        }}
                        className="px-1.5 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-[10px] font-mono text-neutral-300"
                      >
                        +{h}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-400 block mb-1">Ступінь захисту (IP):</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['IP20', 'IP44', 'IP65'] as const).map((ip) => (
                      <button
                        key={ip}
                        type="button"
                        onClick={() =>
                          onBulkUpdateElements(
                            multiSelectedElements.map((e) => e.id),
                            { ipRating: ip }
                          )
                        }
                        className="py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded text-[10px] font-mono text-neutral-200"
                      >
                        {ip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* List of selected elements */}
            <div className="border border-neutral-800 rounded-xl bg-neutral-950 overflow-hidden">
              <div className="px-3 py-2 border-b border-neutral-800 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Обрані об'єкти ({multiSelectedElements.length})
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-neutral-800/60">
                {multiSelectedElements.map((el) => (
                  <div key={el.id} className="px-3 py-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-200 truncate">{el.name}</span>
                    <span className="font-mono text-[10px] text-neutral-500 shrink-0 ml-2">
                      +{el.mountingHeightMm} мм
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {onDeleteElementsBatch && (
              <button
                type="button"
                onClick={() => onDeleteElementsBatch(multiSelectedElements.map((e) => e.id))}
                className="w-full py-2 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/50 text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Видалити всі ({multiSelectedElements.length})</span>
              </button>
            )}
          </div>
        ) : /* CASE 1: ELECTRICAL ELEMENT SELECTED */
        selectedElement ? (
          <div className="space-y-4">
            {/* Element Title & Type */}
            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">Найменування</label>
              <input
                type="text"
                value={selectedElement.name}
                onChange={(e) => onUpdateElement({ ...selectedElement, name: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-sky-500 font-medium"
              />
            </div>

            {/* Coordinates and Rotation */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1">X ({unitLabel})</label>
                <div className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 font-mono text-neutral-300 tabular-nums">
                  {formatDimensionValue(pxToMm(selectedElement.position.x), displayUnit, false)}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1">Y ({unitLabel})</label>
                <div className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 font-mono text-neutral-300 tabular-nums">
                  {formatDimensionValue(pxToMm(selectedElement.position.y), displayUnit, false)}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1">Кут</label>
                <button
                  onClick={() =>
                    onUpdateElement({
                      ...selectedElement,
                      rotation: (selectedElement.rotation + 90) % 360,
                    })
                  }
                  className="w-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded px-2 py-1.5 flex items-center justify-center gap-1 font-mono text-neutral-200 transition-colors"
                  title="Повернути на 90 градусів"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>{selectedElement.rotation}°</span>
                </button>
              </div>
            </div>

            {/* Mounting Height Setting */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-neutral-500">Висота монтажу ({unitLabel})</label>
                <span className="font-mono text-sky-400 font-semibold tabular-nums">
                  +{formatDimensionValue(selectedElement.mountingHeightMm, displayUnit, true)}
                </span>
              </div>
              <input
                type="number"
                step={displayUnit === 'm' ? '0.05' : displayUnit === 'cm' ? '5' : '50'}
                min="0"
                max={convertMmToDisplayUnit(project.ceilingHeightMm, displayUnit)}
                value={convertMmToDisplayUnit(selectedElement.mountingHeightMm, displayUnit)}
                onChange={(e) =>
                  onUpdateElement({
                    ...selectedElement,
                    mountingHeightMm: convertDisplayUnitToMm(Number(e.target.value) || 0, displayUnit),
                  })
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 font-mono focus:outline-none focus:border-sky-500"
              />

              {/* Height presets quick selection */}
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {HEIGHT_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() =>
                      onUpdateElement({
                        ...selectedElement,
                        mountingHeightMm: p.value,
                      })
                    }
                    className={`px-2 py-1 text-[10px] rounded border transition-colors truncate text-left ${
                      selectedElement.mountingHeightMm === p.value
                        ? 'bg-sky-950/60 border-sky-600 text-sky-300 font-semibold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* WALL & DOOR DATUM (ELECTRO-PLANNER STYLE: CENTERLINE, INNER PLASTER FACE, DOOR JAMB) */}
            {wallDatum ? (
              <div className="bg-neutral-950/80 border border-sky-500/30 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5 uppercase tracking-wide">
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span>Прив'язка до стіни та укосу</span>
                  </label>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                    Стіна {wallDatum.wallThicknessMm} мм
                  </span>
                </div>

                {/* Reference selector: Centerline, Inner Face A, Outer Face B */}
                <div>
                  <span className="text-[10px] text-neutral-400 block mb-1.5">
                    База відліку (Reference Datum):
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {/* 1. Centerline */}
                    <button
                      type="button"
                      onClick={() => {
                        const { newPos, newRotation } = positionElementByWallDatum(
                          selectedElement.position,
                          wallDatum.wall,
                          {
                            reference: 'centerline',
                            targetFace: 'centerline',
                          }
                        );
                        onUpdateElement({
                          ...selectedElement,
                          position: newPos,
                          rotation: newRotation,
                          wallId: wallDatum.wall.id,
                          datumBinding: {
                            wallId: wallDatum.wall.id,
                            reference: 'centerline',
                            offsetFromWallMm: 0,
                          },
                        });
                      }}
                      className={`px-1.5 py-1.5 text-[10px] font-medium rounded-lg border transition-colors flex flex-col items-center gap-0.5 text-center ${
                        wallDatum.distanceToCenterlineMm < 20
                          ? 'bg-sky-600 text-white font-bold border-sky-400 shadow-md'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
                      }`}
                      title="Осьова лінія стіни (0 мм від осі)"
                    >
                      <span className="font-semibold">☲ Осьова лінія</span>
                      <span className="text-[9px] font-mono opacity-80">
                        {wallDatum.distanceToCenterlineMm === 0
                          ? '0 мм'
                          : `${wallDatum.offsetFromCenterMm > 0 ? '+' : ''}${wallDatum.offsetFromCenterMm} мм`}
                      </span>
                    </button>

                    {/* 2. Inner Plaster Face A */}
                    <button
                      type="button"
                      onClick={() => {
                        const { newPos, newRotation } = positionElementByWallDatum(
                          selectedElement.position,
                          wallDatum.wall,
                          {
                            reference: 'face_inner',
                            targetFace: 'face_inner',
                          }
                        );
                        onUpdateElement({
                          ...selectedElement,
                          position: newPos,
                          rotation: newRotation,
                          wallId: wallDatum.wall.id,
                          datumBinding: {
                            wallId: wallDatum.wall.id,
                            reference: 'face_inner',
                            offsetFromWallMm: Math.round(wallDatum.wallThicknessMm / 2),
                          },
                        });
                      }}
                      className={`px-1.5 py-1.5 text-[10px] font-medium rounded-lg border transition-colors flex flex-col items-center gap-0.5 text-center ${
                        wallDatum.distanceToInnerFaceMm < 20
                          ? 'bg-emerald-600 text-white font-bold border-emerald-400 shadow-md'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
                      }`}
                      title={`Внутрішня чистова грань (штукатурка +${Math.round(wallDatum.wallThicknessMm / 2)} мм від осі)`}
                    >
                      <span className="font-semibold">◧ Грань А (чистова)</span>
                      <span className="text-[9px] font-mono opacity-80">
                        +{Math.round(wallDatum.wallThicknessMm / 2)} мм
                      </span>
                    </button>

                    {/* 3. Outer Plaster Face B */}
                    <button
                      type="button"
                      onClick={() => {
                        const { newPos, newRotation } = positionElementByWallDatum(
                          selectedElement.position,
                          wallDatum.wall,
                          {
                            reference: 'face_outer',
                            targetFace: 'face_outer',
                          }
                        );
                        onUpdateElement({
                          ...selectedElement,
                          position: newPos,
                          rotation: newRotation,
                          wallId: wallDatum.wall.id,
                          datumBinding: {
                            wallId: wallDatum.wall.id,
                            reference: 'face_outer',
                            offsetFromWallMm: -Math.round(wallDatum.wallThicknessMm / 2),
                          },
                        });
                      }}
                      className={`px-1.5 py-1.5 text-[10px] font-medium rounded-lg border transition-colors flex flex-col items-center gap-0.5 text-center ${
                        wallDatum.distanceToOuterFaceMm < 20
                          ? 'bg-emerald-600 text-white font-bold border-emerald-400 shadow-md'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
                      }`}
                      title={`Зовнішня чистова грань (штукатурка -${Math.round(wallDatum.wallThicknessMm / 2)} мм від осі)`}
                    >
                      <span className="font-semibold">◨ Грань Б (чистова)</span>
                      <span className="text-[9px] font-mono opacity-80">
                        -{Math.round(wallDatum.wallThicknessMm / 2)} мм
                      </span>
                    </button>
                  </div>
                </div>

                {/* Door Jamb Datum (Offset from Door/Opening Edge) */}
                {wallDatum.closestOpening ? (
                  <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-300 font-medium flex items-center gap-1.5">
                        <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          Від укосу {wallDatum.closestOpening.opening.type === 'door' ? 'дверей' : 'вікна'}:
                        </span>
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          wallDatum.closestOpening.isPueCompliantSwitchZone
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                            : wallDatum.closestOpening.isTooCloseToJamb
                            ? 'bg-rose-950 text-rose-300 border border-rose-600'
                            : 'bg-neutral-900 text-neutral-300 border border-neutral-800'
                        }`}
                      >
                        {wallDatum.closestOpening.distanceFromClosestJambMm} мм (
                        {wallDatum.closestOpening.closestJamb === 'left' ? 'лівий' : 'правий'})
                      </span>
                    </div>

                    {/* PUE/DBN Notice */}
                    {wallDatum.closestOpening.isPueCompliantSwitchZone && (
                      <div className="p-2 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-[10px] text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>✓ Норматив ДБН В.2.5-23:2010 (100–150 мм від укосу з боку ручки дверей).</span>
                      </div>
                    )}
                    {wallDatum.closestOpening.isTooCloseToJamb && (
                      <div className="p-2 bg-rose-950/40 border border-rose-800/60 rounded-lg text-[10px] text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span>⚠️ Увага: &lt; 80 мм від укосу! Ризик потрапляння під наличник дверної коробки.</span>
                      </div>
                    )}

                    {/* Presets from Door Jamb */}
                    <div>
                      <span className="text-[9.5px] text-neutral-400 block mb-1">
                        Швидка нормативна фіксація від дверного укосу:
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { dist: 100, label: '100 мм ★' },
                          { dist: 150, label: '150 мм ★' },
                          { dist: 200, label: '200 мм' },
                          { dist: 250, label: '250 мм' },
                        ].map((preset) => (
                          <button
                            key={preset.dist}
                            type="button"
                            onClick={() => {
                              const { newPos, newRotation } = positionElementByWallDatum(
                                selectedElement.position,
                                wallDatum.wall,
                                {
                                  reference: 'door_jamb',
                                  doorOpening: wallDatum.closestOpening!.opening,
                                  jambSide: wallDatum.closestOpening!.closestJamb,
                                  distanceFromJambMm: preset.dist,
                                  targetFace: wallDatum.closestFace,
                                }
                              );
                              onUpdateElement({
                                ...selectedElement,
                                position: newPos,
                                rotation: newRotation,
                                wallId: wallDatum.wall.id,
                                datumBinding: {
                                  wallId: wallDatum.wall.id,
                                  reference: 'door_jamb',
                                  doorOpeningId: wallDatum.closestOpening!.opening.id,
                                  doorJambSide: wallDatum.closestOpening!.closestJamb,
                                  distanceFromJambMm: preset.dist,
                                  offsetFromWallMm: wallDatum.offsetFromCenterMm,
                                },
                              });
                            }}
                            className={`px-1 py-1 text-[10px] font-mono rounded border transition-colors ${
                              wallDatum.closestOpening!.distanceFromClosestJambMm === preset.dist
                                ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Direct numeric input for exact custom distance (e.g. 250 мм від лівого укосу) */}
                    <div className="pt-1.5 border-t border-neutral-800/60 flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[9.5px] text-neutral-400 block mb-0.5">
                          Точний відступ від укосу (мм):
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="10"
                            max="3000"
                            step="10"
                            value={wallDatum.closestOpening.distanceFromClosestJambMm}
                            onChange={(e) => {
                              const newDist = Math.max(10, Number(e.target.value) || 0);
                              const { newPos, newRotation } = positionElementByWallDatum(
                                selectedElement.position,
                                wallDatum.wall,
                                {
                                  reference: 'door_jamb',
                                  doorOpening: wallDatum.closestOpening!.opening,
                                  jambSide: wallDatum.closestOpening!.closestJamb,
                                  distanceFromJambMm: newDist,
                                  targetFace: wallDatum.closestFace,
                                }
                              );
                              onUpdateElement({
                                ...selectedElement,
                                position: newPos,
                                rotation: newRotation,
                                wallId: wallDatum.wall.id,
                                datumBinding: {
                                  wallId: wallDatum.wall.id,
                                  reference: 'door_jamb',
                                  doorOpeningId: wallDatum.closestOpening!.opening.id,
                                  doorJambSide: wallDatum.closestOpening!.closestJamb,
                                  distanceFromJambMm: newDist,
                                  offsetFromWallMm: wallDatum.offsetFromCenterMm,
                                },
                              });
                            }}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 font-mono pointer-events-none">
                            мм
                          </span>
                        </div>
                      </div>

                      {/* Jamb side switch: Left / Right */}
                      <div className="shrink-0">
                        <label className="text-[9.5px] text-neutral-400 block mb-0.5">Укіс:</label>
                        <div className="flex rounded border border-neutral-700 overflow-hidden text-[10px] font-mono">
                          <button
                            type="button"
                            onClick={() => {
                              const { newPos, newRotation } = positionElementByWallDatum(
                                selectedElement.position,
                                wallDatum.wall,
                                {
                                  reference: 'door_jamb',
                                  doorOpening: wallDatum.closestOpening!.opening,
                                  jambSide: 'left',
                                  distanceFromJambMm: wallDatum.closestOpening!.distanceFromClosestJambMm,
                                  targetFace: wallDatum.closestFace,
                                }
                              );
                              onUpdateElement({
                                ...selectedElement,
                                position: newPos,
                                rotation: newRotation,
                                wallId: wallDatum.wall.id,
                                datumBinding: {
                                  wallId: wallDatum.wall.id,
                                  reference: 'door_jamb',
                                  doorOpeningId: wallDatum.closestOpening!.opening.id,
                                  doorJambSide: 'left',
                                  distanceFromJambMm: wallDatum.closestOpening!.distanceFromClosestJambMm,
                                  offsetFromWallMm: wallDatum.offsetFromCenterMm,
                                },
                              });
                            }}
                            className={`px-2 py-1 ${
                              wallDatum.closestOpening.closestJamb === 'left'
                                ? 'bg-amber-500 text-neutral-950 font-bold'
                                : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            Лівий
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const { newPos, newRotation } = positionElementByWallDatum(
                                selectedElement.position,
                                wallDatum.wall,
                                {
                                  reference: 'door_jamb',
                                  doorOpening: wallDatum.closestOpening!.opening,
                                  jambSide: 'right',
                                  distanceFromJambMm: wallDatum.closestOpening!.distanceFromClosestJambMm,
                                  targetFace: wallDatum.closestFace,
                                }
                              );
                              onUpdateElement({
                                ...selectedElement,
                                position: newPos,
                                rotation: newRotation,
                                wallId: wallDatum.wall.id,
                                datumBinding: {
                                  wallId: wallDatum.wall.id,
                                  reference: 'door_jamb',
                                  doorOpeningId: wallDatum.closestOpening!.opening.id,
                                  doorJambSide: 'right',
                                  distanceFromJambMm: wallDatum.closestOpening!.distanceFromClosestJambMm,
                                  offsetFromWallMm: wallDatum.offsetFromCenterMm,
                                },
                              });
                            }}
                            className={`px-2 py-1 ${
                              wallDatum.closestOpening.closestJamb === 'right'
                                ? 'bg-amber-500 text-neutral-950 font-bold'
                                : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            Правий
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-neutral-800/80 text-[10px] text-neutral-500">
                    На цій стіні немає дверного отвору для прив'язки укосу.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 bg-neutral-950/60 border border-neutral-800 rounded-xl text-[10px] text-neutral-500 flex items-center gap-2">
                <Compass className="w-4 h-4 text-neutral-600 shrink-0" />
                <span>
                  Прилад у вільному полі. Перетягніть його до стіни для прив'язки до штукатурки чи дверей.
                </span>
              </div>
            )}

            {/* Circuit Breaker Group Assignment */}
            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">
                Група в щитку (Автоматичний вимикач)
              </label>
              <select
                value={selectedElement.circuitId || ''}
                onChange={(e) =>
                  onUpdateElement({
                    ...selectedElement,
                    circuitId: e.target.value || undefined,
                  })
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-sky-500"
              >
                <option value="">(Без прив'язки до групи)</option>
                {project.circuits.map((c) => (
                  <option key={c.id} value={c.id}>
                    Гр.{c.number}: {c.name} ({c.breakerRatingA}A)
                  </option>
                ))}
              </select>
              {(selectedElement.category === 'switch' || selectedElement.category === 'light') && (() => {
                const c = project.circuits.find((item) => item.id === selectedElement.circuitId);
                if (c && c.breakerRatingA >= 16) {
                  return (
                    <p className="mt-1.5 text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded px-2 py-1">
                      ⚠️ ПУЕ: Вимикач/освітлення призначено на силову групу {c.breakerRatingA}А. Має бути окрема лінія освітлення 10А (ВВГнгд 3×1.5).
                    </p>
                  );
                }
                return null;
              })()}
              {selectedElement.category === 'socket' && (() => {
                const c = project.circuits.find((item) => item.id === selectedElement.circuitId);
                if (c && c.breakerRatingA <= 10) {
                  return (
                    <p className="mt-1.5 text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded px-2 py-1">
                      ⚠️ ПУЕ: Розетка призначена на групу освітлення {c.breakerRatingA}А. Побутові розетки потребують групу 16А (ВВГнгд 3×2.5).
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            {/* Switch Linking & Key Management (for lights and switches) */}
            {(selectedElement.category === 'light' || selectedElement.category === 'switch') && (
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Зв'язування: Група / Клавіша</span>
                  </label>
                  {selectedElement.switchGroupId && (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {selectedElement.switchGroupId}
                    </span>
                  )}
                </div>

                {/* Quick key chips */}
                <div>
                  <div className="text-[10px] text-neutral-500 mb-1">Швидкий вибір позначення (ПУЕ/ДСТУ):</div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {['a', 'b', 'c', 'd', 'S1', 'S2', 'S1.1', 'S1.2'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          onUpdateElement({
                            ...selectedElement,
                            switchGroupId: selectedElement.switchGroupId === tag ? undefined : tag,
                          })
                        }
                        className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors ${
                          selectedElement.switchGroupId === tag
                            ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Free input */}
                <div>
                  <input
                    type="text"
                    placeholder="Введіть код клавіші (a, b, S1, S2)..."
                    value={selectedElement.switchGroupId || ''}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        switchGroupId: e.target.value || undefined,
                      })
                    }
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-neutral-100 font-mono uppercase focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>

                {/* Switch specific: Interactive Linking button & Linked lights counter */}
                {selectedElement.category === 'switch' && (
                  <div className="space-y-2 pt-1 border-t border-neutral-800/80">
                    <button
                      onClick={() => {
                        if (linkingSwitchId === selectedElement.id) {
                          onCancelSwitchLinking?.();
                        } else {
                          onStartSwitchLinking?.(selectedElement.id);
                        }
                      }}
                      className={`w-full py-1.5 px-2 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        linkingSwitchId === selectedElement.id
                          ? 'bg-amber-500 text-neutral-950 font-bold shadow-lg shadow-amber-500/20 animate-pulse'
                          : 'bg-amber-950/40 border border-amber-600/40 text-amber-300 hover:bg-amber-900/40'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>
                        {linkingSwitchId === selectedElement.id
                          ? "Клікніть на світильник (або Esc)"
                          : "🔗 Зв'язати зі світильником на плані"}
                      </span>
                    </button>

                    {/* Linked lights list */}
                    {linkedLights.length > 0 ? (
                      <div className="space-y-1">
                        <div className="text-[10px] text-neutral-400 flex items-center justify-between">
                          <span>Підключені світильники ({linkedLights.length}):</span>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {linkedLights.map((light) => (
                            <div
                              key={light.id}
                              className="flex items-center justify-between bg-neutral-900/80 border border-neutral-800/80 rounded px-2 py-1 text-[11px]"
                            >
                              <span className="text-neutral-300 truncate font-medium">
                                💡 {light.name}
                              </span>
                              <button
                                onClick={() =>
                                  onUpdateElement({
                                    ...light,
                                    switchGroupId: undefined,
                                  })
                                }
                                title="Відв'язати світильник"
                                className="text-neutral-500 hover:text-rose-400 p-0.5"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-neutral-500 leading-tight">
                        Немає прив'язаних світильників. Натисніть кнопку вище і клацніть світильник на плані для утворення групи керування.
                      </p>
                    )}
                  </div>
                )}

                {/* Interactive Switch Wiring Schematic Dialog Button */}
                <button
                  onClick={() => onOpenSwitchWiringDiagram?.(selectedElement)}
                  className="w-full py-2 px-3 rounded-lg bg-amber-950/40 border border-amber-500/50 text-amber-300 hover:bg-amber-900/50 flex items-center justify-center gap-2 font-semibold text-xs transition-colors shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>⚡ Схема комутації вимикача (L ➔ SW ➔ L')</span>
                </button>
              </div>
            )}

            {/* Power (Watts) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-neutral-500">Споживана потужність</label>
                <span className="font-mono text-neutral-400 tabular-nums">
                  {(selectedElement.powerWatts / 1000).toFixed(2)} кВт
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={selectedElement.powerWatts}
                  onChange={(e) =>
                    onUpdateElement({
                      ...selectedElement,
                      powerWatts: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 font-mono pr-8 focus:outline-none focus:border-sky-500"
                />
                <span className="absolute right-2.5 top-1.5 text-neutral-500 text-[11px]">Вт</span>
              </div>
            </div>

            {/* IP Protection Rating */}
            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">Ступінь захисту (IP)</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['IP20', 'IP44', 'IP65'] as const).map((ip) => (
                  <button
                    key={ip}
                    onClick={() => onUpdateElement({ ...selectedElement, ipRating: ip })}
                    className={`py-1 text-xs rounded border font-mono transition-colors ${
                      selectedElement.ipRating === ip
                        ? 'bg-sky-950/60 border-sky-500 text-sky-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    {ip}
                  </button>
                ))}
              </div>
            </div>

            {/* Backup Priority Toggle */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-200 flex items-center gap-1.5">
                  <span className="text-emerald-400">⚡</span> Гарантоване живлення (АКБ)
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(selectedElement.isBackupPriority)}
                  onChange={(e) =>
                    onUpdateElement({
                      ...selectedElement,
                      isBackupPriority: e.target.checked,
                    })
                  }
                  className="rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-neutral-400 leading-tight">
                Підключення до пріоритетної шини резервного інвертора / станції під час блекауту
              </p>
            </div>

            {/* Heavy Appliances & Dedicated Lines Quick Presets */}
            {(selectedElement.category === 'socket' || selectedElement.category === 'appliance') && (
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span>Потужні споживачі (ПУЕ)</span>
                  </span>
                  <span className="text-[10px] text-neutral-500">Швидке призначення</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {HEAVY_APPLIANCE_PRESETS.map((preset) => (
                    <button
                      key={preset.title}
                      onClick={() => handleApplyAppliancePreset(preset)}
                      className="p-1.5 rounded border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 hover:border-neutral-700 text-left transition-colors flex items-center justify-between group"
                    >
                      <div className="truncate">
                        <div className="text-[11px] font-medium text-neutral-200 group-hover:text-sky-300">
                          {preset.title}
                        </div>
                        <div className="text-[10px] font-mono text-neutral-400">{preset.desc}</div>
                      </div>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                        {(preset.power / 1000).toFixed(1)} кВт
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">
                Примітка для монтажника
              </label>
              <textarea
                rows={2}
                placeholder="Прив'язка за місцем, колір рамки, серія тощо"
                value={selectedElement.notes || ''}
                onChange={(e) => onUpdateElement({ ...selectedElement, notes: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 rounded p-2 text-neutral-200 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        ) : selectedWire ? (
          /* CASE 2: WIRE ROUTE SELECTED */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-400 font-semibold">
                <Cable className="w-4 h-4 text-sky-400" />
                <span>Кабельна лінія {selectedWire.cableTag ? `[${selectedWire.cableTag}]` : ''}</span>
              </div>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                {selectedWire.calculatedLengthM} м
              </span>
            </div>

            {/* Cable Tag Label */}
            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">
                Маркування кабелю (ДСТУ / ПУЕ)
              </label>
              <input
                type="text"
                placeholder="Наприклад: W1-01, W2-03"
                value={selectedWire.cableTag || ''}
                onChange={(e) =>
                  onUpdateWire?.({
                    ...selectedWire,
                    cableTag: e.target.value || undefined,
                  })
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 font-mono uppercase focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Endpoints Info */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs space-y-1.5">
              <div className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">
                З'єднані точки
              </div>
              <div className="flex items-center justify-between text-neutral-300">
                <span className="text-neutral-400">Від:</span>
                <span className="font-medium truncate max-w-[170px]">
                  {wireFromEl ? wireFromEl.name : selectedWire.fromId}
                </span>
              </div>
              <div className="flex items-center justify-between text-neutral-300">
                <span className="text-neutral-400">До:</span>
                <span className="font-medium truncate max-w-[170px]">
                  {wireToEl ? wireToEl.name : selectedWire.toId}
                </span>
              </div>
            </div>

            {/* Auto vs Manual Routing Toggle for this specific wire */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-400">Режим цієї траси:</span>
                <span
                  className={`font-semibold ${
                    selectedWire.isManual ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {selectedWire.isManual ? '🔒 Ручна (зафіксовано)' : '⚡ Авто ПУЕ (90°)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    onUpdateWire?.({
                      ...selectedWire,
                      isManual: false,
                    })
                  }
                  className={`py-1.5 px-2 rounded text-center border text-[11px] transition-colors ${
                    !selectedWire.isManual
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-semibold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  ⚡ Авто ПУЕ
                </button>
                <button
                  onClick={() =>
                    onUpdateWire?.({
                      ...selectedWire,
                      isManual: true,
                    })
                  }
                  className={`py-1.5 px-2 rounded text-center border text-[11px] transition-colors ${
                    selectedWire.isManual
                      ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-semibold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  🔒 Зафіксувати
                </button>
              </div>
              <p className="text-[10px] text-neutral-500 leading-tight">
                {selectedWire.isManual
                  ? 'Вузли та геометрія захищені від перезапису автоматичним трасуванням.'
                  : 'Траса автоматично оптимізується за ортогональною сіткою ПУЕ.'}
              </p>
            </div>

            {/* Optimal Orthogonal Path Button & Parallel Lane Tuning */}
            {selectedWire.mode !== 'curve' && (
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-300 font-semibold flex items-center gap-1.5">
                    <Split className="w-3.5 h-3.5 text-sky-400" />
                    <span>Паралельне та оптимальне трасування</span>
                  </span>
                </div>

                {/* Recalculate along optimal path */}
                <button
                  onClick={() => {
                    if (!wireFromEl || !wireToEl) return;
                    const optimal = computeOrthogonalPath(
                      wireFromEl.position,
                      wireToEl.position,
                      project.walls,
                      project.openings
                    );
                    const newLen = calculateCableLengthM(
                      wireFromEl,
                      wireToEl,
                      project.ceilingHeightMm,
                      selectedWire.conduit,
                      optimal
                    );
                    onUpdateWire?.({
                      ...selectedWire,
                      points: optimal,
                      mode: 'ortho',
                      isManual: false,
                      calculatedLengthM: newLen,
                    });
                  }}
                  className="w-full py-1.5 px-2 bg-sky-950/50 hover:bg-sky-900/60 border border-sky-500/50 text-sky-200 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                  <span>⚡ Прокласти за найкоротшим оптимальним шляхом</span>
                </button>

                {/* Optimize all parallel wires in project */}
                {onOptimizeParallelWires && (
                  <button
                    onClick={onOptimizeParallelWires}
                    className="w-full py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-neutral-300 hover:text-sky-300 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Split className="w-3.5 h-3.5 text-sky-400" />
                    <span>Оптимізувати всі траси паралельними пучками</span>
                  </button>
                )}
              </div>
            )}

            {/* Circuit Group Selector */}
            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">
                Група в щитку (Автоматичний вимикач)
              </label>
              <select
                value={selectedWire.circuitId || ''}
                onChange={(e) =>
                  onUpdateWire?.({
                    ...selectedWire,
                    circuitId: e.target.value || undefined,
                  })
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-sky-500 font-medium"
              >
                <option value="">(Без прив'язки до групи)</option>
                {project.circuits.map((c) => (
                  <option key={c.id} value={c.id}>
                    Гр.{c.number}: {c.name} ({c.breakerRatingA}A)
                  </option>
                ))}
              </select>
            </div>

            {/* Cable Cross-Section Selector */}
            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">
                Тип та переріз кабелю
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'VVGng_3x1.5', label: 'ВВГнгд 3×1.5', note: '10A · Світло' },
                  { id: 'VVGng_3x2.5', label: 'ВВГнгд 3×2.5', note: '16A · Розетки' },
                  { id: 'VVGng_3x4', label: 'ВВГнгд 3×4.0', note: '25A · Варильна' },
                  { id: 'VVGng_3x6', label: 'ВВГнгд 3×6.0', note: '32A · Плита' },
                ].map((cab) => (
                  <button
                    key={cab.id}
                    onClick={() => {
                      if (!wireFromEl || !wireToEl) return;
                      const newLen = calculateCableLengthM(
                        wireFromEl,
                        wireToEl,
                        project.ceilingHeightMm,
                        selectedWire.conduit
                      );
                      onUpdateWire?.({
                        ...selectedWire,
                        cableType: cab.id as any,
                        calculatedLengthM: newLen,
                      });
                    }}
                    className={`p-2 rounded text-left border transition-colors ${
                      selectedWire.cableType === cab.id
                        ? 'bg-sky-950/60 border-sky-500 text-sky-300 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-[11px]">{cab.label}</div>
                    <div className="text-[9px] text-neutral-500">{cab.note}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Routing Mode */}
            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">
                Геометрія траси (ПУЕ / Проект)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'ortho', label: 'Кути 90°' },
                  { id: 'curve', label: 'Дуга' },
                  { id: 'direct', label: 'Пряма' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      onUpdateWire?.({
                        ...selectedWire,
                        mode: m.id as any,
                      })
                    }
                    className={`py-1.5 px-2 rounded text-center border text-[11px] transition-colors ${
                      selectedWire.mode === m.id
                        ? 'bg-sky-950/60 border-sky-500 text-sky-300 font-semibold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Intermediate Waypoints Info & Insertion */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Кути повороту:</span>
                <span className="font-mono text-neutral-200 font-semibold">
                  {selectedWire.points?.length ? `${selectedWire.points.length} точок` : 'Авто ПУЕ (90°)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    if (!wireFromEl || !wireToEl) return;
                    const curPoints = selectedWire.points && selectedWire.points.length >= 2
                      ? selectedWire.points
                      : [wireFromEl.position, wireToEl.position];
                    const midX = (curPoints[0].x + curPoints[curPoints.length - 1].x) / 2;
                    const midY = (curPoints[0].y + curPoints[curPoints.length - 1].y) / 2;
                    const midIdx = Math.floor(curPoints.length / 2);
                    const updated = [
                      ...curPoints.slice(0, midIdx),
                      { x: midX, y: midY },
                      ...curPoints.slice(midIdx),
                    ];
                    const newLen = calculateCableLengthM(
                      wireFromEl,
                      wireToEl,
                      project.ceilingHeightMm,
                      selectedWire.conduit,
                      updated
                    );
                    onUpdateWire?.({
                      ...selectedWire,
                      points: updated,
                      isManual: true,
                      calculatedLengthM: newLen,
                    });
                  }}
                  className="flex-1 py-1.5 text-[11px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-950/40 border border-sky-800/60 rounded hover:border-sky-700 transition-colors"
                >
                  + Додати точку у трасу
                </button>
                {selectedWire.points && selectedWire.points.length > 0 && (
                  <button
                    onClick={() =>
                      onUpdateWire?.({
                        ...selectedWire,
                        points: undefined,
                      })
                    }
                    className="py-1.5 px-2 text-[11px] text-neutral-400 hover:text-neutral-200 bg-neutral-900 border border-neutral-800 rounded hover:border-neutral-700 transition-colors"
                    title="Скинути до стандартного кута"
                  >
                    Скинути
                  </button>
                )}
              </div>
              <p className="text-[10px] text-neutral-500 leading-tight">
                Ви також можете клацнути будь-де на обраній лінії на полотні або перетягувати маркери для точного коригування.
              </p>
            </div>

            {/* Switch connection phase status (L ➔ SW ➔ L') */}
            {((wireFromEl?.category === 'switch' || wireToEl?.category === 'switch') ||
              (wireFromEl?.category === 'light' || wireToEl?.category === 'light')) && (
              <div className="bg-amber-950/30 border border-amber-600/40 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px]">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {wireToEl?.category === 'switch' || wireFromEl?.category === 'switch'
                      ? (wireFromEl?.category === 'light' || wireToEl?.category === 'light'
                        ? "⚡ Комутована лінія L' (Вимикач ➔ Світильник)"
                        : "⚡ Живильна лінія L (Фаза на вимикач за ПУЕ §6.1.14)")
                      : "⚡ Лінія освітлення"}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 leading-tight">
                  Фазний провід L заводиться безпосередньо у вимикач. Комутована фаза L' прямує до світильника. Нуль (N) та захисне заземлення (PE) підключаються безпосередньо до світильника.
                </p>
                <button
                  onClick={() => {
                    const sw = wireFromEl?.category === 'switch' ? wireFromEl : wireToEl?.category === 'switch' ? wireToEl : undefined;
                    onOpenSwitchWiringDiagram?.(sw);
                  }}
                  className="w-full mt-1 py-1.5 px-2 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-500/40 rounded text-amber-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>⚡ Схема підключення вимикача (L ➔ SW ➔ L')</span>
                </button>
              </div>
            )}

            {/* Conduit / Installation Mode */}
            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">
                Спосіб прокладання
              </label>
              <select
                value={selectedWire.conduit}
                onChange={(e) => {
                  const newConduit = e.target.value as any;
                  if (!wireFromEl || !wireToEl) return;
                  const newLen = calculateCableLengthM(
                    wireFromEl,
                    wireToEl,
                    project.ceilingHeightMm,
                    newConduit
                  );
                  onUpdateWire?.({
                    ...selectedWire,
                    conduit: newConduit,
                    calculatedLengthM: newLen,
                  });
                }}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-sky-500"
              >
                <option value="ceiling">По чорновій стелі у гофротрубі (Опуск/підйом)</option>
                <option value="floor">У стяжці підлоги (Гофра)</option>
                <option value="wall_chase">Штроба у стіні (Безпосередньо)</option>
              </select>
            </div>

            {/* Length Breakdown Card */}
            <div className="bg-sky-950/20 border border-sky-900/50 rounded-lg p-2.5 text-[11px] text-neutral-300 space-y-1">
              <div className="font-semibold text-sky-300 flex items-center justify-between">
                <span>Розрахункова довжина:</span>
                <span className="font-mono text-sm font-bold text-sky-400">
                  {selectedWire.calculatedLengthM} м
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 leading-tight">
                Враховано трасу на плані + вертикальні спуски/підйоми до точок (висота стелі {project.ceilingHeightMm} мм) + нормативний запас 15% на обробку та підключення за ПУЕ.
              </p>
            </div>

            {/* Delete Wire Action Button */}
            <button
              onClick={() => {
                onDeleteWire?.(selectedWire.id);
                onSelectWire?.(null);
              }}
              className="w-full py-2 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/50 text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Видалити цю кабельну трасу (Delete)</span>
            </button>
          </div>
        ) : selectedWall ? (
          /* CASE 3: WALL SELECTED (Повний контроль розмірів, довжини, кута та координат стіни) */
          (() => {
            const currentLengthMm = calculateWallLengthMm(selectedWall);
            const currentAngleDeg = calculateWallAngleDeg(selectedWall);
            const hostedOpenings = project.openings.filter((op) => op.wallId === selectedWall.id);

            return (
              <div className="space-y-4">
                {/* Header & Quick Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                    <Ruler className="w-4 h-4 text-sky-400" />
                    <span>Стіна #{selectedWall.id.slice(-6)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateWall(reverseWall(selectedWall))}
                      title="Поміняти початок і кінець місцями (⇄)"
                      className="p-1 text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 rounded transition-colors"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onUpdateWall(alignWallOrtho(selectedWall))}
                      title="Вирівняти суворо під 90° (Орто)"
                      className="p-1 text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 rounded transition-colors font-mono text-xs font-bold"
                    >
                      ⊥
                    </button>
                    <button
                      onClick={() => onDeleteWall(selectedWall.id)}
                      title="Видалити стіну (Del)"
                      className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Wall Elevation & Chasing button */}
                {onOpenWallElevation && (
                  <button
                    onClick={() => onOpenWallElevation(selectedWall.id)}
                    className="w-full py-2 px-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-950/30"
                  >
                    <Layers className="w-4 h-4 text-blue-400" />
                    <span>📐 Відкрити розгортку стіни & Штроби (ПУЕ)</span>
                  </button>
                )}

                {/* 1. WALL LENGTH (Розмір стіни у вибраних одиницях) */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-sky-400" />
                      <span>Розмір (Довжина) стіни</span>
                    </label>
                    <span className="font-mono text-xs font-bold text-sky-400 tabular-nums">
                      {formatDimensionValue(currentLengthMm, displayUnit, true)}
                    </span>
                  </div>

                  {/* Main Length Input */}
                  <div className="relative">
                    <input
                      type="number"
                      step={displayUnit === 'm' ? '0.05' : displayUnit === 'cm' ? '5' : '50'}
                      min={displayUnit === 'm' ? '0.1' : displayUnit === 'cm' ? '10' : '100'}
                      value={convertMmToDisplayUnit(currentLengthMm, displayUnit)}
                      onChange={(e) => {
                        const rawVal = Number(e.target.value);
                        const valMm = convertDisplayUnitToMm(rawVal, displayUnit);
                        if (valMm > 0) {
                          onUpdateWall(setWallLengthMm(selectedWall, valMm, wallAnchor));
                        }
                      }}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-neutral-100 font-mono text-base font-bold pr-12 focus:outline-none focus:border-sky-500 shadow-inner"
                    />
                    <span className="absolute right-3 top-2.5 text-neutral-400 text-xs font-mono font-medium">
                      {unitLabel}
                    </span>
                  </div>

                  {/* Secondary Units Indicator */}
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono px-0.5">
                    <span>{(currentLengthMm / 10).toFixed(1)} см</span>
                    <span>{(currentLengthMm / 1000).toFixed(2)} м</span>
                  </div>

                  {/* Anchor Point Selector */}
                  <div className="pt-1.5 border-t border-neutral-800/80">
                    <div className="text-[10px] text-neutral-400 mb-1 flex items-center justify-between">
                      <span>Точка фіксації при зміні довжини:</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'start' as const, label: 'Початок' },
                        { id: 'center' as const, label: 'Центр' },
                        { id: 'end' as const, label: 'Кінець' },
                      ].map((anc) => (
                        <button
                          key={anc.id}
                          onClick={() => setWallAnchor(anc.id)}
                          className={`py-1 text-[10px] rounded border transition-colors ${
                            wallAnchor === anc.id
                              ? 'bg-sky-950/60 border-sky-500 text-sky-300 font-bold'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          {anc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick delta adjustment buttons */}
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[-500, -100, 100, 500].map((delta) => (
                      <button
                        key={delta}
                        onClick={() =>
                          onUpdateWall(
                            setWallLengthMm(selectedWall, currentLengthMm + delta, wallAnchor)
                          )
                        }
                        className="py-1 px-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-[10px] font-mono text-neutral-300 transition-colors"
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>

                  {/* Standard Architectural Presets */}
                  <div className="flex items-center gap-1 flex-wrap pt-1">
                    {[1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000].map((presetMm) => (
                      <button
                        key={presetMm}
                        onClick={() =>
                          onUpdateWall(setWallLengthMm(selectedWall, presetMm, wallAnchor))
                        }
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                          currentLengthMm === presetMm
                            ? 'bg-sky-900/60 border-sky-400 text-sky-200 font-bold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                        }`}
                      >
                        {presetMm}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. WALL THICKNESS & TYPE */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-neutral-400 font-semibold">
                      Товщина стіни
                    </label>
                    <span className="font-mono text-xs text-sky-400 font-bold">
                      {selectedWall.thickness} мм
                    </span>
                  </div>

                  <input
                    type="number"
                    step="10"
                    min="50"
                    max="1000"
                    value={selectedWall.thickness}
                    onChange={(e) =>
                      onUpdateWall({
                        ...selectedWall,
                        thickness: Number(e.target.value) || 100,
                      })
                    }
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 font-mono text-xs focus:outline-none focus:border-sky-500"
                  />

                  {/* Thickness quick presets */}
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { val: 100, label: '100 (ГКЛ)' },
                      { val: 150, label: '150 (Блок)' },
                      { val: 200, label: '200 (Кв.)' },
                      { val: 250, label: '250 (1 цегла)' },
                      { val: 380, label: '380 (1.5 цегли)' },
                      { val: 510, label: '510 (2 цегли)' },
                    ].map((th) => (
                      <button
                        key={th.val}
                        onClick={() =>
                          onUpdateWall({
                            ...selectedWall,
                            thickness: th.val,
                          })
                        }
                        className={`py-1 px-1 rounded text-[10px] font-mono border transition-colors ${
                          selectedWall.thickness === th.val
                            ? 'bg-sky-950/60 border-sky-500 text-sky-300 font-bold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {th.label}
                      </button>
                    ))}
                  </div>

                  {/* Wall Classification Type */}
                  <div className="pt-1.5 border-t border-neutral-800/80">
                    <label className="text-[10px] text-neutral-400 block mb-1">
                      Конструктивний тип стіни
                    </label>
                    <select
                      value={selectedWall.type || 'partition'}
                      onChange={(e) =>
                        onUpdateWall({
                          ...selectedWall,
                          type: e.target.value as 'bearing' | 'partition',
                        })
                      }
                      className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="bearing">Несуча стіна (Залізобетон / Цегла)</option>
                      <option value="partition">Міжкімнатна перегородка (ГКЛ / Газоблок)</option>
                    </select>
                  </div>
                </div>

                {/* 3. WALL ORIENTATION & ANGLE */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400 font-semibold flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-sky-400" />
                      <span>Кут нахилу стіни</span>
                    </span>
                    <span className="font-mono text-xs font-bold text-sky-400">
                      {currentAngleDeg}°
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1">
                    {[0, 45, 90, 180, 270].map((deg) => (
                      <button
                        key={deg}
                        onClick={() => onUpdateWall(setWallAngleDeg(selectedWall, deg, 'start'))}
                        className={`py-1 text-[10px] font-mono rounded border transition-colors ${
                          Math.abs(currentAngleDeg - deg) < 0.5
                            ? 'bg-sky-950/60 border-sky-500 text-sky-300 font-bold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {deg}°
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => onUpdateWall(alignWallOrtho(selectedWall))}
                    className="w-full py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded text-sky-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>⊥ Вирівняти по ортогоналі (0° / 90° / 180°)</span>
                  </button>
                </div>

                {/* 4. EXACT ENDPOINT COORDINATES (X1, Y1, X2, Y2) */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-2 text-xs">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Move className="w-3 h-3 text-sky-400" />
                    <span>Координати вершин (мм)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-500 block mb-0.5">Початок P1:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-neutral-500">X:</span>
                        <input
                          type="number"
                          value={pxToMm(selectedWall.start.x)}
                          onChange={(e) =>
                            onUpdateWall({
                              ...selectedWall,
                              start: {
                                ...selectedWall.start,
                                x: mmToPx(Number(e.target.value) || 0),
                              },
                            })
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-200 font-mono text-[11px]"
                        />
                        <span className="text-[10px] text-neutral-500">Y:</span>
                        <input
                          type="number"
                          value={pxToMm(selectedWall.start.y)}
                          onChange={(e) =>
                            onUpdateWall({
                              ...selectedWall,
                              start: {
                                ...selectedWall.start,
                                y: mmToPx(Number(e.target.value) || 0),
                              },
                            })
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-200 font-mono text-[11px]"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-500 block mb-0.5">Кінець P2:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-neutral-500">X:</span>
                        <input
                          type="number"
                          value={pxToMm(selectedWall.end.x)}
                          onChange={(e) =>
                            onUpdateWall({
                              ...selectedWall,
                              end: {
                                ...selectedWall.end,
                                x: mmToPx(Number(e.target.value) || 0),
                              },
                            })
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-200 font-mono text-[11px]"
                        />
                        <span className="text-[10px] text-neutral-500">Y:</span>
                        <input
                          type="number"
                          value={pxToMm(selectedWall.end.y)}
                          onChange={(e) =>
                            onUpdateWall({
                              ...selectedWall,
                              end: {
                                ...selectedWall.end,
                                y: mmToPx(Number(e.target.value) || 0),
                              },
                            })
                          }
                          className="w-full bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-200 font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. HOSTED OPENINGS (Двері та вікна на стіні) */}
                {hostedOpenings.length > 0 && (
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-1.5">
                    <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                      <span>Отвори на стіні ({hostedOpenings.length})</span>
                    </div>
                    <div className="space-y-1">
                      {hostedOpenings.map((op) => (
                        <div
                          key={op.id}
                          className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-[11px]"
                        >
                          <span className="text-neutral-300 flex items-center gap-1.5">
                            {op.type === 'door' ? (
                              <DoorOpen className="w-3.5 h-3.5 text-sky-400" />
                            ) : (
                              <AppWindow className="w-3.5 h-3.5 text-sky-400" />
                            )}
                            <span>{op.type === 'door' ? 'Двері' : 'Вікно'}</span>
                            <span className="font-mono text-neutral-400">({op.width} мм)</span>
                          </span>
                          <span className="font-mono text-[10px] text-neutral-500">
                            {Math.round(op.positionRatio * 100)}% довжини
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        ) : selectedOpening ? (
          /* CASE 4: OPENING (DOOR OR WINDOW) SELECTED */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sky-400 font-semibold">
              {selectedOpening.type === 'door' ? (
                <DoorOpen className="w-4 h-4 text-sky-400" />
              ) : (
                <AppWindow className="w-4 h-4 text-sky-400" />
              )}
              <span>
                {selectedOpening.type === 'door' ? 'Двері' : 'Вікно'} ({selectedOpening.width} мм)
              </span>
            </div>

            {/* Wall Context */}
            {openingWall && (
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-[11px] space-y-1">
                <div className="text-neutral-400">Розташування на стіні:</div>
                <div className="text-neutral-200 font-medium">
                  {openingWall.type === 'bearing' ? 'Несуча стіна' : 'Перегородка'} (довжина{' '}
                  <span className="font-mono text-sky-400">
                    {pxToMm(distance(openingWall.start, openingWall.end))} мм
                  </span>
                  , товщина {openingWall.thickness} мм)
                </div>
              </div>
            )}

            {/* Width Input & Presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-neutral-500">Ширина отвору (мм)</label>
                <span className="font-mono text-sky-400 font-semibold">{selectedOpening.width} мм</span>
              </div>
              <input
                type="number"
                step="50"
                value={selectedOpening.width}
                onChange={(e) =>
                  onUpdateOpening?.({
                    ...selectedOpening,
                    width: Math.max(300, Number(e.target.value) || 800),
                  })
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 font-mono"
              />
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {(selectedOpening.type === 'door'
                  ? [700, 800, 900, 1000, 1400, 1800, 2800]
                  : [800, 1000, 1200, 1400, 1800, 2400]
                ).map((w) => (
                  <button
                    key={w}
                    onClick={() =>
                      onUpdateOpening?.({
                        ...selectedOpening,
                        width: w,
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                      selectedOpening.width === w
                        ? 'bg-sky-500 text-neutral-950 font-bold border-sky-400'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Position Ratio Slider along Wall */}
            <div>
              <div className="flex items-center justify-between mb-1 text-[11px]">
                <span className="text-neutral-500">Позиція вздовж стіни:</span>
                <span className="font-mono text-neutral-300">
                  {Math.round(selectedOpening.positionRatio * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.95"
                step="0.01"
                value={selectedOpening.positionRatio}
                onChange={(e) =>
                  onUpdateOpening?.({
                    ...selectedOpening,
                    positionRatio: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-sky-400 h-1.5 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            {/* Door Swing Direction */}
            {selectedOpening.type === 'door' && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] text-neutral-500 block">Напрямок відкривання стулок</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'in', label: 'Всередину (in)' },
                      { id: 'out', label: 'Назовні (out)' },
                      { id: 'left', label: 'Вліво (left)' },
                      { id: 'right', label: 'Вправо (right)' },
                    ] as const
                  ).map((dir) => (
                    <button
                      key={dir.id}
                      onClick={() =>
                        onUpdateOpening?.({
                          ...selectedOpening,
                          swingDirection: dir.id,
                        })
                      }
                      className={`p-2 rounded text-[11px] border text-center transition-colors ${
                        (selectedOpening.swingDirection || 'in') === dir.id
                          ? 'bg-sky-950/60 border-sky-500 text-sky-300 font-semibold'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                      }`}
                    >
                      {dir.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* CASE 5: NO SELECTION - SUMMARY OF PROJECT & BULK ACTIONS */
          <div className="space-y-4 text-neutral-400">
            <div>
              <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wide mb-1">
                {project.title}
              </h3>
              <p className="text-[11px] text-neutral-500">
                Виберіть елемент, кабельну трасу або стіну на плані для редагування параметрів.
              </p>
            </div>

            {/* Global Project Auto-Routing Toggle Card */}
            {onToggleAutoRouting && (
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300 font-medium">Автотрасування проекту:</span>
                  <span
                    className={`font-semibold ${
                      autoRoutingEnabled ? 'text-emerald-400' : 'text-neutral-400'
                    }`}
                  >
                    {autoRoutingEnabled ? '⚡ УВІМКНЕНО' : '🔒 ВИМКНЕНО'}
                  </span>
                </div>
                <button
                  onClick={onToggleAutoRouting}
                  className={`w-full py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                    autoRoutingEnabled
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40'
                      : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      autoRoutingEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                    }`}
                  />
                  <span>
                    {autoRoutingEnabled
                      ? 'Вимкнути автотрасування (перейти в ручний режим)'
                      : 'Увімкнути автоматичне трасування ПУЕ'}
                  </span>
                </button>
                <p className="text-[10px] text-neutral-500 leading-tight">
                  {autoRoutingEnabled
                    ? 'Автоматичне прокладання за сіткою ПУЕ під кутами 90° через розподільчі коробки РК.'
                    : 'Ручний режим: всі створені та відредаговані вузли кабелів зафіксовані.'}
                </p>
              </div>
            )}

            {/* Bulk Project Engineering Actions */}
            <div className="space-y-2 border-t border-neutral-800 pt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                Інженерні інструменти ПУЕ / ДСТУ
              </div>

              {/* 1. Auto Circuit & Appliance Assignment */}
              <button
                onClick={onAutoAssignCircuits}
                className="w-full p-2.5 rounded-lg border border-sky-600/50 bg-gradient-to-r from-sky-950/70 to-blue-950/40 hover:from-sky-900/80 hover:to-blue-900/50 text-left transition-all shadow-sm group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1 rounded bg-sky-500 text-neutral-950 font-bold group-hover:scale-105 transition-transform">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-sky-200">
                    ⚡ Авторозподіл ліній та навантажень
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 leading-tight">
                  Розподіляє варильну (32A), бойлер, духовку, освітлення (10A) та розетки (16A) з підбором перерізів кабелів за ПУЕ.
                </p>
              </button>

              {/* 2. Auto Numbering DSTU */}
              <button
                onClick={onAutoNumberCables}
                className="w-full p-2.5 rounded-lg border border-amber-600/40 bg-gradient-to-r from-amber-950/60 to-yellow-950/30 hover:from-amber-900/70 hover:to-yellow-900/40 text-left transition-all shadow-sm group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1 rounded bg-amber-500 text-neutral-950 font-bold group-hover:scale-105 transition-transform">
                    <Hash className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-amber-200">
                    🔢 Автонумерація кіл та кабелів
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 leading-tight">
                  Присвоює систематичні номери групам щита (Гр.1..N [QF1..N]) та маркування кабелям (W1-01, W2-01) за ДСТУ.
                </p>
              </button>

              {/* 3. Auto Sockets Placement according to DBN */}
              {onOpenAutoSocketsModal && (
                <button
                  onClick={onOpenAutoSocketsModal}
                  className="w-full p-2.5 rounded-lg border border-amber-500/50 bg-gradient-to-r from-amber-950/70 to-orange-950/40 hover:from-amber-900/80 hover:to-orange-900/50 text-left transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 rounded bg-amber-500 text-neutral-950 font-bold group-hover:scale-105 transition-transform">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-amber-200">
                      ⚡ Авторозстановка розеток за ДБН
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    Розрахунок за площею (1 шт/6м²), розміщення по периметру стін та біля меблів з нормативними відступами.
                  </p>
                </button>
              )}
            </div>

            <div className="space-y-2 border-t border-neutral-800 pt-3">
              <div className="flex items-center justify-between">
                <span>Площа приміщень:</span>
                <span className="font-mono text-neutral-200 font-semibold tabular-nums">
                  {project.rooms.reduce((sum, r) => sum + r.areaM2, 0).toFixed(1)} м²
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Електроточок на плані:</span>
                <span className="font-mono text-neutral-200 font-semibold tabular-nums">
                  {project.elements.length} шт
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Груп у щитку:</span>
                <span className="font-mono text-neutral-200 font-semibold tabular-nums">
                  {project.circuits.length} шт
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Кабельних ліній:</span>
                <span className="font-mono text-neutral-200 font-semibold tabular-nums">
                  {project.wires.length} шт
                </span>
              </div>
            </div>

            {/* Quick Filter Segmented Buttons */}
            <div className="border-t border-neutral-800 pt-3">
              <span className="text-[11px] text-neutral-500 block mb-2 font-medium">
                Швидкі клавіші креслення:
              </span>
              <ul className="text-[11px] space-y-1.5 text-neutral-400">
                <li>• <strong className="text-neutral-200">S, K, L</strong> — розетки, вимикачі, світильники</li>
                <li>• <strong className="text-neutral-200">C</strong> — трасування кабелів із поворотами (клік по полю = кут)</li>
                <li>• <strong className="text-neutral-200">W</strong> — креслення стін з ортогональною прив'язкою</li>
                <li>• <strong className="text-neutral-200">D, O</strong> — вставка дверей та вікон на стіни</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
