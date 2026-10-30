import React from 'react';
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
} from 'lucide-react';
import { CadProject, ElectricalElement, Wall, WallOpening, WireRoute } from '../../types/cad';
import { pxToMm, distance, getCableDisplayName, getCableCrossSection, calculateCableLengthM } from '../../utils/cadMath';

interface PropertyInspectorProps {
  project: CadProject;
  selectedElementId: string | null;
  selectedWallId: string | null;
  selectedOpeningId?: string | null;
  selectedWireId?: string | null;
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
  linkingSwitchId?: string | null;
  onStartSwitchLinking?: (switchId: string) => void;
  onCancelSwitchLinking?: () => void;
  onAutoAssignCircuits?: () => void;
  onAutoNumberCables?: () => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  project,
  selectedElementId,
  selectedWallId,
  selectedOpeningId,
  selectedWireId,
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
  linkingSwitchId,
  onStartSwitchLinking,
  onCancelSwitchLinking,
  onAutoAssignCircuits,
  onAutoNumberCables,
}) => {
  const selectedElement = project.elements.find((el) => el.id === selectedElementId);
  const selectedWall = project.walls.find((w) => w.id === selectedWallId);
  const selectedOpening = project.openings.find((op) => op.id === selectedOpeningId);
  const selectedWire = project.wires.find((w) => w.id === selectedWireId);
  const openingWall = selectedOpening ? project.walls.find((w) => w.id === selectedOpening.wallId) : null;

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
          Властивості об'єкта
        </span>
        {selectedElement && (
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
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* CASE 1: ELECTRICAL ELEMENT SELECTED */}
        {selectedElement ? (
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
                <label className="text-[11px] text-neutral-500 block mb-1">X (мм)</label>
                <div className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 font-mono text-neutral-300 tabular-nums">
                  {pxToMm(selectedElement.position.x)}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1">Y (мм)</label>
                <div className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 font-mono text-neutral-300 tabular-nums">
                  {pxToMm(selectedElement.position.y)}
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
                <label className="text-[11px] text-neutral-500">Висота монтажу (мм)</label>
                <span className="font-mono text-sky-400 font-semibold tabular-nums">
                  +{selectedElement.mountingHeightMm} мм
                </span>
              </div>
              <input
                type="number"
                step="50"
                min="0"
                max={project.ceilingHeightMm}
                value={selectedElement.mountingHeightMm}
                onChange={(e) =>
                  onUpdateElement({
                    ...selectedElement,
                    mountingHeightMm: Number(e.target.value) || 0,
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

            {/* Intermediate Waypoints Info */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Кути повороту:</span>
                <span className="font-mono text-neutral-200 font-semibold">
                  {selectedWire.points?.length ? `${selectedWire.points.length} точок` : 'Авто ПУЕ (90°)'}
                </span>
              </div>
              {selectedWire.points && selectedWire.points.length > 0 && (
                <button
                  onClick={() =>
                    onUpdateWire?.({
                      ...selectedWire,
                      points: undefined,
                    })
                  }
                  className="w-full py-1 text-[11px] text-neutral-400 hover:text-neutral-200 bg-neutral-900 border border-neutral-800 rounded hover:border-neutral-700"
                >
                  Скинути до стандартного прямого кута
                </button>
              )}
            </div>

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
          </div>
        ) : selectedWall ? (
          /* CASE 3: WALL SELECTED */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sky-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>Обрана стіна #{selectedWall.id}</span>
            </div>

            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">Тип стіни</label>
              <select
                value={selectedWall.type || 'partition'}
                onChange={(e) =>
                  onUpdateWall({
                    ...selectedWall,
                    type: e.target.value as 'bearing' | 'partition',
                  })
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100"
              >
                <option value="bearing">Несуча стіна (Бетон / Цегла)</option>
                <option value="partition">Міжкімнатна перегородка (ГКЛ / Газоблок)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">Товщина стіни (мм)</label>
              <input
                type="number"
                step="10"
                value={selectedWall.thickness}
                onChange={(e) =>
                  onUpdateWall({
                    ...selectedWall,
                    thickness: Number(e.target.value) || 100,
                  })
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 font-mono"
              />
            </div>
          </div>
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
