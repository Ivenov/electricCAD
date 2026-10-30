import React from 'react';
import { Trash2, Copy, RotateCw, DoorOpen, AppWindow, ArrowLeftRight } from 'lucide-react';
import { CadProject, ElectricalElement, Wall, WallOpening } from '../../types/cad';
import { pxToMm, distance } from '../../utils/cadMath';

interface PropertyInspectorProps {
  project: CadProject;
  selectedElementId: string | null;
  selectedWallId: string | null;
  selectedOpeningId?: string | null;
  onUpdateElement: (updated: ElectricalElement) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onUpdateWall: (updated: Wall) => void;
  onDeleteWall: (id: string) => void;
  onUpdateOpening?: (updated: WallOpening) => void;
  onDeleteOpening?: (id: string) => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  project,
  selectedElementId,
  selectedWallId,
  selectedOpeningId,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onUpdateWall,
  onDeleteWall,
  onUpdateOpening,
  onDeleteOpening,
}) => {
  const selectedElement = project.elements.find((el) => el.id === selectedElementId);
  const selectedWall = project.walls.find((w) => w.id === selectedWallId);
  const selectedOpening = project.openings.find((op) => op.id === selectedOpeningId);
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

            {/* Switch Group ID (for lights and switches) */}
            {(selectedElement.category === 'light' || selectedElement.category === 'switch') && (
              <div>
                <label className="text-[11px] text-neutral-500 block mb-1">
                  Група ввімкнення / Клавіша
                </label>
                <input
                  type="text"
                  placeholder="Наприклад: S1, S2"
                  value={selectedElement.switchGroupId || ''}
                  onChange={(e) =>
                    onUpdateElement({
                      ...selectedElement,
                      switchGroupId: e.target.value || undefined,
                    })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 font-mono uppercase focus:outline-none focus:border-sky-500"
                />
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
        ) : selectedWall ? (
          /* CASE 2: WALL SELECTED */
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
          /* CASE 3: OPENING (DOOR OR WINDOW) SELECTED */
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
          /* CASE 4: NO SELECTION - SUMMARY OF PROJECT */
          <div className="space-y-5 text-neutral-400">
            <div>
              <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wide mb-1">
                {project.title}
              </h3>
              <p className="text-[11px] text-neutral-500">
                Клікніть на елемент або стіну на плані для перегляду та редагування властивостей.
              </p>
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
                <span>Трас кабелів:</span>
                <span className="font-mono text-neutral-200 font-semibold tabular-nums">
                  {project.wires.length} шт
                </span>
              </div>
            </div>

            {/* Quick Filter Segmented Buttons */}
            <div className="border-t border-neutral-800 pt-3">
              <span className="text-[11px] text-neutral-500 block mb-2 font-medium">
                Швидкі клавіші:
              </span>
              <ul className="text-[11px] space-y-1.5 text-neutral-400">
                <li>• <strong className="text-neutral-200">S, K, L</strong> — швидкий вибір розеток, вимикачів, світла</li>
                <li>• <strong className="text-neutral-200">W</strong> — креслення стін</li>
                <li>• <strong className="text-neutral-200">C</strong> — трасування кабелю від точки до точки</li>
                <li>• <strong className="text-neutral-200">Коліщатко</strong> — зум до курсору</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
