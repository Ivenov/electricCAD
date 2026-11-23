/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Модальне вікно інтелектуальної авторозстановки розеток за ДБН В.2.5-23:2010 та ПУЕ-2017
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Zap,
  ShieldCheck,
  Check,
  AlertTriangle,
  Sofa,
  Sliders,
  RotateCcw,
  Info,
  CheckSquare,
  Square as SquareIcon,
  HelpCircle,
} from 'lucide-react';
import { CadProject } from '../../types/cad';
import {
  calculateAutoSocketPlacement,
  getDensityPresetConfig,
  SocketDensityPreset,
  AutoSocketPlacementOptions,
} from '../../utils/autoSocketPlacement';

interface AutoSocketsPlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: CadProject;
  onApplySockets: (updatedProject: CadProject, message: string) => void;
}

export const AutoSocketsPlacementModal: React.FC<AutoSocketsPlacementModalProps> = ({
  isOpen,
  onClose,
  project,
  onApplySockets,
}) => {
  // Preset state
  const [preset, setPreset] = useState<SocketDensityPreset>('comfort');

  // Selected rooms: defaults to all room IDs
  const allRoomIds = useMemo(() => project.rooms.map((r) => r.id), [project.rooms]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(allRoomIds);

  // Custom Options state
  const defaultStep = useMemo(() => getDensityPresetConfig(preset).wallStepM, [preset]);
  const [wallStepM, setWallStepM] = useState<number>(defaultStep);
  const [enableFurniture, setEnableFurniture] = useState<boolean>(true);
  const [enableBathroomSafety, setEnableBathroomSafety] = useState<boolean>(true);
  const [avoidDuplicates, setAvoidDuplicates] = useState<boolean>(true);
  const [clearExisting, setClearExisting] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Heights configuration
  const [generalHeightMm, setGeneralHeightMm] = useState<number>(300);
  const [kitchenHeightMm, setKitchenHeightMm] = useState<number>(1050);
  const [bathroomHeightMm, setBathroomHeightMm] = useState<number>(1000);
  const [bedsideHeightMm, setBedsideHeightMm] = useState<number>(650);

  // Update step when preset changes
  const handleSelectPreset = (newPreset: SocketDensityPreset) => {
    setPreset(newPreset);
    setWallStepM(getDensityPresetConfig(newPreset).wallStepM);
  };

  // Toggle single room selection
  const handleToggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const handleSelectAllRooms = () => {
    setSelectedRoomIds(allRoomIds);
  };

  const handleDeselectAllRooms = () => {
    setSelectedRoomIds([]);
  };

  // Assemble options
  const placementOptions: AutoSocketPlacementOptions = useMemo(
    () => ({
      densityPreset: preset,
      selectedRoomIds,
      wallStepM,
      enableFurnitureProximity: enableFurniture,
      enableBathroomSafetyZones: enableBathroomSafety,
      clearExistingSocketsInSelectedRooms: clearExisting,
      avoidDuplicateDistanceMm: avoidDuplicates ? 1200 : 0,
      defaultHeightsMm: {
        general: generalHeightMm,
        kitchenCounter: kitchenHeightMm,
        bathroom: bathroomHeightMm,
        bed: bedsideHeightMm,
      },
    }),
    [
      preset,
      selectedRoomIds,
      wallStepM,
      enableFurniture,
      enableBathroomSafety,
      clearExisting,
      avoidDuplicates,
      generalHeightMm,
      kitchenHeightMm,
      bathroomHeightMm,
      bedsideHeightMm,
    ]
  );

  // Live preview calculation
  const previewResult = useMemo(() => {
    if (!isOpen) return null;
    return calculateAutoSocketPlacement(project, placementOptions);
  }, [isOpen, project, placementOptions]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!previewResult) return;
    const msg = `⚡ Встановлено ${previewResult.totalSocketsGenerated} розеток у ${previewResult.statsByRoom.filter((s) => s.addedCount > 0).length} приміщеннях за нормами ДБН В.2.5-23:2010 (+${(previewResult.totalPowerAddedW / 1000).toFixed(1)} кВт)`;
    onApplySockets(previewResult.updatedProject, msg);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Авторозстановка розеток за ДБН</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                  ДБН В.2.5-23:2010 & ПУЕ
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Автоматичне проектування точок по периметру стін та біля меблів з дотриманням зон електробезпеки
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Presets Grid */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Оберіть нормативний пресет насиченості</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  id: 'economy' as SocketDensityPreset,
                  title: 'Базовий ДБН',
                  step: '3.2 м',
                  desc: '1 розетка на 6 м², мінімальний бюджет за нормами',
                  badge: 'Економ',
                },
                {
                  id: 'standard' as SocketDensityPreset,
                  title: 'Стандарт',
                  step: '2.8 м',
                  desc: 'Збалансований розподіл, виділені точки в кімнатах',
                  badge: 'ДБН В.2.5-23',
                },
                {
                  id: 'comfort' as SocketDensityPreset,
                  title: 'Комфорт',
                  step: '2.4 м',
                  desc: 'Подвійні блоки, кухонний фартух +1050мм, точки біля меблів',
                  badge: 'Рекомендовано',
                  highlight: true,
                },
                {
                  id: 'premium' as SocketDensityPreset,
                  title: 'Smart Home',
                  step: '2.0 м',
                  desc: 'Максимальна насиченість, мультимедійні групи ТВ та ПК',
                  badge: 'Преміум',
                },
              ].map((card) => {
                const isSelected = preset === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleSelectPreset(card.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="font-bold text-xs text-white flex items-center gap-1.5">
                          {card.title}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                            card.highlight
                              ? 'bg-amber-400 text-neutral-950 font-bold'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          {card.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 leading-snug">{card.desc}</div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-neutral-500">Крок по стінах:</span>
                      <span className="text-amber-400 font-bold">~{card.step}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Room Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Приміщення для розстановки ({selectedRoomIds.length}/{project.rooms.length})</span>
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllRooms}
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Всі</span>
                </button>
                <span className="text-neutral-600">·</span>
                <button
                  type="button"
                  onClick={handleDeselectAllRooms}
                  className="text-neutral-500 hover:text-neutral-300 flex items-center gap-1 transition-colors"
                >
                  <SquareIcon className="w-3.5 h-3.5" />
                  <span>Зняти всі</span>
                </button>
              </div>
            </div>

            {project.rooms.length === 0 ? (
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-center text-xs text-neutral-500">
                У проекті поки немає позначених кімнат. Додайте приміщення через інструмент «Кімната» (R) або розставте стіни.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {project.rooms.map((room) => {
                  const isChecked = selectedRoomIds.includes(room.id);
                  const roomStat = previewResult?.statsByRoom.find((s) => s.roomId === room.id);

                  return (
                    <label
                      key={room.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-neutral-800/70 border-sky-500/50 text-white'
                          : 'bg-neutral-950/40 border-neutral-800/70 text-neutral-400 hover:bg-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRoom(room.id)}
                          className="w-4 h-4 rounded border-neutral-700 text-sky-500 focus:ring-0 focus:ring-offset-0 bg-neutral-900"
                        />
                        <div className="truncate">
                          <div className="text-xs font-semibold truncate text-neutral-200">{room.name}</div>
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {room.areaM2} м² · периметр ~{roomStat?.wallPerimeterM ?? 0}м
                          </div>
                        </div>
                      </div>

                      {isChecked && roomStat && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0 ml-2">
                          +{roomStat.addedCount} шт.
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Core Intelligence Parameters */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Правила безпеки та інтелектуальні алгоритми</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAdvanced ? 'Приховати налаштування' : 'Точні параметри'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Furniture check */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 cursor-pointer hover:bg-neutral-900 transition-colors">
                <input
                  type="checkbox"
                  checked={enableFurniture}
                  onChange={(e) => setEnableFurniture(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-neutral-700 text-amber-500 focus:ring-0 bg-neutral-950"
                />
                <div>
                  <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Sofa className="w-3.5 h-3.5 text-amber-400" />
                    <span>Прив'язка до меблів</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Автоматичне встановлення розеткових груп біля ліжок (узголів'я +650мм), робочих столів (+300/+750мм), диванів та ТБ-зон.
                  </div>
                </div>
              </label>

              {/* Bathroom safety */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 cursor-pointer hover:bg-neutral-900 transition-colors">
                <input
                  type="checkbox"
                  checked={enableBathroomSafety}
                  onChange={(e) => setEnableBathroomSafety(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-neutral-700 text-emerald-500 focus:ring-0 bg-neutral-950"
                />
                <div>
                  <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Зони електробезпеки санвузлів (ПУЕ §7.1.47)</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Тільки ступінь захисту IP44, відступ &gt;600 мм від раковини/ванни/душа, висота +1000 мм.
                  </div>
                </div>
              </label>

              {/* Avoid duplicates */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 cursor-pointer hover:bg-neutral-900 transition-colors">
                <input
                  type="checkbox"
                  checked={avoidDuplicates}
                  onChange={(e) => setAvoidDuplicates(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-neutral-700 text-sky-500 focus:ring-0 bg-neutral-950"
                />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">Захист від дублювання (&lt; 1.2 м)</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Не додавати розетку, якщо на цій ділянці стіни вже встановлено розетку на відстані менше 1200 мм.
                  </div>
                </div>
              </label>

              {/* Clear existing */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 cursor-pointer hover:bg-neutral-900 transition-colors">
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-neutral-700 text-red-500 focus:ring-0 bg-neutral-950"
                />
                <div>
                  <div className="text-xs font-semibold text-red-300">Очистити наявні розетки в обраних кімнатах</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Повністю перегенерувати схему розеток з нуля, видаливши попередньо розставлені точки.
                  </div>
                </div>
              </label>
            </div>

            {/* Advanced slider & heights */}
            {showAdvanced && (
              <div className="pt-3 border-t border-neutral-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Крок по стінах: <strong className="text-amber-400 font-mono">{wallStepM.toFixed(1)} м</strong>
                    </label>
                    <input
                      type="range"
                      min="1.5"
                      max="4.0"
                      step="0.1"
                      value={wallStepM}
                      onChange={(e) => setWallStepM(parseFloat(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Загальна висота (мм)</label>
                    <input
                      type="number"
                      min="150"
                      max="1200"
                      step="50"
                      value={generalHeightMm}
                      onChange={(e) => setGeneralHeightMm(Number(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Кухонний фартух (мм)</label>
                    <input
                      type="number"
                      min="900"
                      max="1300"
                      step="50"
                      value={kitchenHeightMm}
                      onChange={(e) => setKitchenHeightMm(Number(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">Санвузол / Дзеркало (мм)</label>
                    <input
                      type="number"
                      min="800"
                      max="1500"
                      step="50"
                      value={bathroomHeightMm}
                      onChange={(e) => setBathroomHeightMm(Number(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Live Preview Summary & Normative Footnote */}
          {previewResult && (
            <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-sky-400" />
                  <span>Попередній розрахунок результатів авторозстановки:</span>
                </div>
                <div className="text-[11px] text-neutral-300 flex flex-wrap items-center gap-3 font-mono">
                  <span>
                    Додано точок: <strong className="text-emerald-400 font-bold">+{previewResult.totalSocketsGenerated} шт.</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Розрахункова потужність: <strong className="text-amber-400 font-bold">+{(previewResult.totalPowerAddedW / 1000).toFixed(2)} кВт</strong>
                  </span>
                  {clearExisting && previewResult.removedElementsCount > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-red-400">Видалено старих: -{previewResult.removedElementsCount}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-neutral-400 max-w-xs text-right leading-tight hidden sm:inline">
                  Всі точки автоматично орієнтовані обличчям всередину приміщення та зміщені від дверних отворів.
                </span>
              </div>
            </div>
          )}

          {/* Safety Notes if any */}
          {previewResult && previewResult.safetyNotes.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
              <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Нормативні рекомендації ПУЕ / ДБН:</span>
              </div>
              {previewResult.safetyNotes.slice(0, 3).map((note, idx) => (
                <div key={idx} className="text-[10px] text-neutral-300 leading-tight">
                  • {note}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            Скасувати
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={!previewResult || previewResult.totalSocketsGenerated === 0}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {previewResult && previewResult.totalSocketsGenerated > 0
                ? `⚡ Застосувати розстановку (${previewResult.totalSocketsGenerated} розеток)`
                : 'Застосувати розстановку'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
