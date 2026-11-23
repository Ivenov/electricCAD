/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Модальне вікно світлотехнічного розрахунку та авторозстановки освітлення (ДБН В.2.5-28:2018)
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Lightbulb,
  Sun,
  Sparkles,
  Sliders,
  Check,
  AlertTriangle,
  Layers,
  Info,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react';
import { CadProject, Room, ElectricalElement, WireRoute } from '../../types/cad';
import {
  calculateRoomLighting,
  generateLightingLayout,
  FIXTURE_PRESETS,
  DBN_LIGHTING_NORMS,
  FixturePreset,
  LightingLayoutScheme,
} from '../../utils/lightingCalculations';
import { sanitizeProject } from '../../utils/storage';

interface AutoLightingPlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: CadProject;
  onApplyLighting: (updatedProject: CadProject, message: string) => void;
}

export const AutoLightingPlacementModal: React.FC<AutoLightingPlacementModalProps> = ({
  isOpen,
  onClose,
  project,
  onApplyLighting,
}) => {
  // Выбранные комнаты (по умолчанию все)
  const allRoomIds = useMemo(() => project.rooms.map((r) => r.id), [project.rooms]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(allRoomIds);

  // Выбранный пресет светильника
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>(FIXTURE_PRESETS[0].id);
  const fixture = useMemo(
    () => FIXTURE_PRESETS.find((f) => f.id === selectedFixtureId) || FIXTURE_PRESETS[0],
    [selectedFixtureId]
  );

  // Схема компоновки
  const [layoutScheme, setLayoutScheme] = useState<LightingLayoutScheme>('grid_spots');

  // Флаги настроек
  const [placeSwitches, setPlaceSwitches] = useState<boolean>(true);
  const [generateWires, setGenerateWires] = useState<boolean>(true);
  const [clearExisting, setClearExisting] = useState<boolean>(false);
  const [customLuxOverride, setCustomLuxOverride] = useState<number | undefined>(undefined);

  if (!isOpen) return null;

  const toggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  // Розрахунок світлотехніки для всіх вибраних приміщень
  const roomCalculations = useMemo(() => {
    return project.rooms
      .filter((r) => selectedRoomIds.includes(r.id))
      .map((room) => {
        const calc = calculateRoomLighting(
          room,
          fixture,
          project.ceilingHeightMm || 2700,
          customLuxOverride
        );
        return { room, calc };
      });
  }, [project.rooms, selectedRoomIds, fixture, project.ceilingHeightMm, customLuxOverride]);

  const totalFixturesToCreate = roomCalculations.reduce(
    (sum, r) => sum + r.calc.recommendedFixturesCount,
    0
  );
  const totalPowerToCreate = roomCalculations.reduce(
    (sum, r) => sum + r.calc.totalPowerWatts,
    0
  );

  // Застосування розстановки
  const handleApply = () => {
    if (selectedRoomIds.length === 0) return;

    let updatedElements = [...project.elements];
    let updatedWires = [...project.wires];

    if (clearExisting) {
      // Видаляємо наявні світильники та вимикачі у вибраних кімнатах
      const selectedRooms = project.rooms.filter((r) => selectedRoomIds.includes(r.id));
      const removedElementIds = new Set<string>();

      updatedElements = updatedElements.filter((el) => {
        if (el.category !== 'light' && el.category !== 'switch') return true;
        // Перевіряємо, чи належить точка полігону якоїсь із вибраних кімнат
        const isInside = selectedRooms.some((r) => {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const pt of r.points) {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
          }
          return (
            el.position.x >= minX - 10 &&
            el.position.x <= maxX + 10 &&
            el.position.y >= minY - 10 &&
            el.position.y <= maxY + 10
          );
        });
        if (isInside) {
          removedElementIds.add(el.id);
          return false;
        }
        return true;
      });

      // Видаляємо траси, прив'язані до видалених елементів
      updatedWires = updatedWires.filter(
        (w) => !removedElementIds.has(w.fromId) && !removedElementIds.has(w.toId)
      );
    }

    let createdLightsCount = 0;
    let createdSwitchesCount = 0;

    project.rooms
      .filter((r) => selectedRoomIds.includes(r.id))
      .forEach((room) => {
        const calc = calculateRoomLighting(
          room,
          fixture,
          project.ceilingHeightMm || 2700,
          customLuxOverride
        );
        const layout = generateLightingLayout(
          room,
          fixture,
          layoutScheme,
          calc.recommendedFixturesCount,
          project.walls,
          project.openings,
          project.ceilingHeightMm || 2700
        );

        updatedElements.push(...layout.fixtures);
        createdLightsCount += layout.fixtures.length;

        if (placeSwitches && layout.switchElement) {
          updatedElements.push(layout.switchElement);
          createdSwitchesCount += 1;
        }

        if (generateWires && layout.wireRoutes.length > 0) {
          updatedWires.push(...layout.wireRoutes);
        }
      });

    const updatedProject: CadProject = sanitizeProject({
      ...project,
      elements: updatedElements,
      wires: updatedWires,
    });

    const msg = `Встановлено ${createdLightsCount} світильників та ${createdSwitchesCount} вимикачів у ${selectedRoomIds.length} приміщеннях за нормами ДБН В.2.5-28:2018.`;
    onApplyLighting(updatedProject, msg);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
              <Lightbulb className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Світлотехнічний розрахунок & Авторозстановка
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                  ДБН В.2.5-28:2018
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Розрахунок необхідного світлового потоку методом коефіцієнта використання (КВ) та розміщення світильників
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          
          {/* Top row: Layout scheme & Fixture selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. Схема розміщення */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-xs tracking-wider text-amber-400 uppercase flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Схема компоновки світильників
              </h3>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setLayoutScheme('grid_spots')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    layoutScheme === 'grid_spots'
                      ? 'border-amber-500 bg-amber-500/15 text-white shadow-sm'
                      : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <div className="font-bold text-xs mb-1">Матриця спотів</div>
                  <div className="text-[11px] text-slate-400 leading-tight">
                    Рівномірна сітка 2×2, 2×3 з відступом від стін ≥600мм
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayoutScheme('chandelier_with_perimeter')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    layoutScheme === 'chandelier_with_perimeter'
                      ? 'border-amber-500 bg-amber-500/15 text-white shadow-sm'
                      : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <div className="font-bold text-xs mb-1">Люстра + споти</div>
                  <div className="text-[11px] text-slate-400 leading-tight">
                    Центральна люстра + кутові акцентні світильники
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayoutScheme('linear_tracks')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    layoutScheme === 'linear_tracks'
                      ? 'border-amber-500 bg-amber-500/15 text-white shadow-sm'
                      : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <div className="font-bold text-xs mb-1">Трекова лінія</div>
                  <div className="text-[11px] text-slate-400 leading-tight">
                    Лінійне шинне розміщення вздовж осі кімнати
                  </div>
                </button>
              </div>

              {/* Toggles */}
              <div className="pt-2 border-t border-slate-700/60 space-y-2">
                <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                  <span className="text-slate-300">
                    Автоустановка вимикача (+900 мм біля дверей за ПУЕ §7.1.50)
                  </span>
                  <input
                    type="checkbox"
                    checked={placeSwitches}
                    onChange={(e) => setPlaceSwitches(e.target.checked)}
                    className="accent-amber-500 w-4 h-4 rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                  <span className="text-slate-300">
                    З'єднати лінією освітлення ВВГнгд 3х1.5 (Switch Group)
                  </span>
                  <input
                    type="checkbox"
                    checked={generateWires}
                    onChange={(e) => setGenerateWires(e.target.checked)}
                    className="accent-amber-500 w-4 h-4 rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer select-none text-rose-300">
                  <span>Очистити наявні світильники у вибраних кімнатах</span>
                  <input
                    type="checkbox"
                    checked={clearExisting}
                    onChange={(e) => setClearExisting(e.target.checked)}
                    className="accent-rose-500 w-4 h-4 rounded"
                  />
                </label>
              </div>
            </div>

            {/* 2. Джерело світла */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-xs tracking-wider text-amber-400 uppercase flex items-center gap-2">
                <Sun className="w-4 h-4" />
                Вибір типу світильника (LED)
              </h3>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {FIXTURE_PRESETS.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFixtureId(f.id)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                      selectedFixtureId === f.id
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-slate-700/70 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">{f.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {f.powerWatts}W • {f.luminousFluxLm} лм • {f.colorTempK}K • кут {f.beamAngleDeg}°
                      </div>
                    </div>
                    {selectedFixtureId === f.id && (
                      <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-slate-950">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Room selection & live DBN calculations table */}
          <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs tracking-wider text-amber-400 uppercase flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Приміщення та результати розрахунку (КВ метод)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRoomIds(allRoomIds)}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Вибрати всі
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedRoomIds([])}
                  className="text-xs text-slate-400 hover:underline"
                >
                  Зняти всі
                </button>
              </div>
            </div>

            {project.rooms.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                У проєкті ще немає визначених приміщень. Намалюйте кімнати інструментом «Кімната» або «Стіна».
              </div>
            ) : (
              <div className="border border-slate-700/80 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-400 border-b border-slate-700/80">
                    <tr>
                      <th className="py-2.5 px-3 w-8"></th>
                      <th className="py-2.5 px-3">Приміщення</th>
                      <th className="py-2.5 px-3 text-right">Площа, м²</th>
                      <th className="py-2.5 px-3 text-right">Норма ДБН, лк</th>
                      <th className="py-2.5 px-3 text-right">Потік, лм</th>
                      <th className="py-2.5 px-3 text-center">Світильників</th>
                      <th className="py-2.5 px-3 text-right">Факт лк</th>
                      <th className="py-2.5 px-3 text-right">Потужність</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {project.rooms.map((room) => {
                      const isSelected = selectedRoomIds.includes(room.id);
                      const calc = calculateRoomLighting(
                        room,
                        fixture,
                        project.ceilingHeightMm || 2700,
                        customLuxOverride
                      );
                      const norm = DBN_LIGHTING_NORMS[room.type] || DBN_LIGHTING_NORMS.default;

                      return (
                        <tr
                          key={room.id}
                          onClick={() => toggleRoom(room.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-slate-800/40 text-slate-500'
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="accent-amber-500 rounded"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-200">
                            {room.name}
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {norm.description.split('(')[0]}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300 font-mono">
                            {room.areaM2.toFixed(1)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-300 font-semibold font-mono">
                            {calc.targetLux} лк
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                            {calc.totalRequiredLumens.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-white">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-400 font-mono">
                              {calc.recommendedFixturesCount} шт
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-400">
                            {calc.achievedLux} лк
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {calc.totalPowerWatts} Вт
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Formula explanation note */}
            <div className="flex items-start gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-300">Формула світлотехнічного розрахунку: </span>
                <span className="font-mono text-amber-300">Φ_сум = (E · S · k · z) / η</span>. Де <span className="text-slate-300">E</span> — нормована освітленість (лк), <span className="text-slate-300">S</span> — площа кімнати (м²), <span className="text-slate-300">k=1.3</span> — коефіцієнт експлуатаційного запасу LED, <span className="text-slate-300">z=1.15</span> — нерівномірність, <span className="text-slate-300">η</span> — коефіцієнт використання за індексом кімнати <span className="font-mono text-slate-300">i = S / [hp·(a+b)]</span>.
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <div className="text-xs text-slate-400">
            Разом до встановлення: <span className="font-bold text-amber-300">{totalFixturesToCreate} світильників</span> (сумарна потужність <span className="font-bold text-white">{totalPowerToCreate} Вт</span>)
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Скасувати
            </button>
            <button
              type="button"
              disabled={selectedRoomIds.length === 0}
              onClick={handleApply}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Застосувати розстановку освітлення
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
