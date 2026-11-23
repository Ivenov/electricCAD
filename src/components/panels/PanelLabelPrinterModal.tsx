/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Генератор маркувальних наліпок на модульний електрощит (DIN-Rail Label Strip Maker)
 * Самоклейні смужки на пластрон щита з піктограмами, номіналами та фазним кодуванням (18 мм / TE)
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Tag,
  Printer,
  Download,
  Sliders,
  Check,
  Edit2,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import { CadProject, CircuitGroup } from '../../types/cad';

interface PanelLabelPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: CadProject;
}

interface LabelSlot {
  id: string;
  slotIndex: number;
  widthTe: number; // 1, 2, 3 or 4 modules (18mm each)
  circuitNumber?: number;
  title: string;
  subtitle: string;
  icon: string;
  ratingText: string;
  phase: 'L1' | 'L2' | 'L3' | '3P' | '1P+N';
  color: string;
}

const CONSUMER_ICONS: { label: string; icon: string }[] = [
  { label: 'Розетки', icon: '⚡' },
  { label: 'Освітлення', icon: '💡' },
  { label: 'Варильна поверхня', icon: '🍳' },
  { label: 'Духова шафа', icon: '🔥' },
  { label: 'Холодильник', icon: '❄️' },
  { label: 'Пральна машина', icon: '🧺' },
  { label: 'Сушильна машина', icon: '👕' },
  { label: 'Посудомийна', icon: '🍽️' },
  { label: 'Бойлер / Водонагрівач', icon: '🚿' },
  { label: 'Кондиціонер', icon: '❄️' },
  { label: 'Тепла підлога', icon: '♨️' },
  { label: 'Сервер / Wi-Fi', icon: '🌐' },
  { label: 'Ввідний автомат', icon: '🔌' },
  { label: 'Реле напруги', icon: '⚡' },
  { label: 'ПЗВ / Дифавтомат', icon: '🛡️' },
  { label: 'Резерв', icon: '⚪' },
];

export const PanelLabelPrinterModal: React.FC<PanelLabelPrinterModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  // Конфігурація шафи
  const [cabinetSizeTe, setCabinetSizeTe] = useState<number>(36); // 12, 24, 36, 48, 72
  const [rowCapacityTe, setRowCapacityTe] = useState<number>(12); // 12 or 18 per row
  const [boardTitle, setBoardTitle] = useState<string>('Щит розподільчий ЩР-1');

  // Ініціалізація слотів із груп проекту
  const initialSlots: LabelSlot[] = useMemo(() => {
    const slots: LabelSlot[] = [];

    // Ввідний автомат
    slots.push({
      id: 'main_mcb',
      slotIndex: 0,
      widthTe: project.supplyPhase === '3-phase' ? 3 : 2,
      title: 'Головний ввід',
      subtitle: project.supplyPhase === '3-phase' ? '3P Ввід' : '1P+N Ввід',
      icon: '🔌',
      ratingText: `${project.mainBreakerRatingA || 25}A`,
      phase: project.supplyPhase === '3-phase' ? '3P' : '1P+N',
      color: '#ef4444',
    });

    // Реле напруги
    slots.push({
      id: 'v_relay',
      slotIndex: 1,
      widthTe: project.supplyPhase === '3-phase' ? 3 : 2,
      title: 'Реле напруги',
      subtitle: 'Захист 220В',
      icon: '⚡',
      ratingText: 'УЗМ / ZUBR',
      phase: project.supplyPhase === '3-phase' ? '3P' : 'L1',
      color: '#f97316',
    });

    // Групи споживачів проекту
    project.circuits.forEach((circuit, idx) => {
      let icon = '⚡';
      const nameLower = circuit.name.toLowerCase();
      if (nameLower.includes('освітл') || nameLower.includes('світл')) icon = '💡';
      else if (nameLower.includes('варильн') || nameLower.includes('плит')) icon = '🍳';
      else if (nameLower.includes('холод')) icon = '❄️';
      else if (nameLower.includes('пральн')) icon = '🧺';
      else if (nameLower.includes('посуд')) icon = '🍽️';
      else if (nameLower.includes('бойлер') || nameLower.includes('санвуз')) icon = '🚿';
      else if (nameLower.includes('кондиц')) icon = '❄️';
      else if (nameLower.includes('тепл') || nameLower.includes('підлог')) icon = '♨️';
      else if (nameLower.includes('інтернет') || nameLower.includes('wifi')) icon = '🌐';

      const rcdDesc = circuit.rcdType !== 'none' ? '+ПЗВ' : '';
      const rating = `${circuit.breakerCurve || 'C'}${circuit.breakerRatingA || 16}A ${rcdDesc}`.trim();

      slots.push({
        id: circuit.id || `circ_${idx}`,
        slotIndex: slots.length,
        widthTe: circuit.rcdType.includes('rcbo') ? 2 : 1,
        circuitNumber: circuit.number,
        title: `Гр.${circuit.number} ${circuit.name}`,
        subtitle: circuit.cableType.replace('VVGng_', 'ВВГнгд '),
        icon,
        ratingText: rating,
        phase: circuit.phase || 'L1',
        color: circuit.color || '#38bdf8',
      });
    });

    return slots;
  }, [project]);

  const [slots, setSlots] = useState<LabelSlot[]>(initialSlots);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalUsedTe = slots.reduce((s, slot) => s + slot.widthTe, 0);
  const totalRows = Math.ceil(cabinetSizeTe / rowCapacityTe);

  // Оновлення полів слота
  const updateSlot = (slotId: string, updates: Partial<LabelSlot>) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, ...updates } : s))
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col text-slate-100 overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Header - Hidden during print */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Маркувальні наліпки на електрощит
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                  DIN-рейка 18 мм (TE)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Конструктор самоклейних смужок на пластрон для шаф Hager Volta, Schneider Resi9, IEK
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Друк 1:1 (А4)
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar - Controls - Hidden during print */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Назва щита:</span>
              <input
                type="text"
                value={boardTitle}
                onChange={(e) => setBoardTitle(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-medium outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Ємність шафи:</span>
              <select
                value={cabinetSizeTe}
                onChange={(e) => setCabinetSizeTe(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 outline-none"
              >
                <option value={12}>12 модулів (1 ряд)</option>
                <option value={24}>24 модулі (2 ряди)</option>
                <option value={36}>36 модулів (3 ряди)</option>
                <option value={48}>48 модулів (4 ряди)</option>
                <option value={54}>54 модулі (3 ряди x 18)</option>
                <option value={72}>72 модулі (4 ряди x 18)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">У ряду:</span>
              <select
                value={rowCapacityTe}
                onChange={(e) => setRowCapacityTe(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 outline-none"
              >
                <option value={12}>12 TE (стандарт)</option>
                <option value={18}>18 TE (широка)</option>
              </select>
            </div>
          </div>

          <div className="px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 font-mono">
            Зайнято: <span className="text-amber-400 font-bold">{totalUsedTe}</span> / {cabinetSizeTe} TE
          </div>
        </div>

        {/* Printable Preview Sheet */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950 flex flex-col items-center justify-start print:p-0 print:bg-white print:overflow-visible">
          
          <div className="w-full max-w-[850px] bg-white text-slate-900 rounded-xl p-8 shadow-2xl border border-slate-300 print:border-none print:shadow-none print:p-4 print:max-w-none">
            
            {/* Sheet Title for Technician */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-6">
              <div>
                <h1 className="text-base font-black uppercase tracking-wider text-slate-900">
                  {boardTitle} — Маркувальні смужки пластрона
                </h1>
                <p className="text-[10px] text-slate-600">
                  Масштаб друку: 100% (1:1). 1 модуль = 18.0 мм. Вирізати по лінії штрихів для встановлення у тримач.
                </p>
              </div>
              <div className="text-right text-[10px] text-slate-500 font-mono">
                {project.title || 'ElectroPlan CAD'} • {new Date().toLocaleDateString('uk-UA')}
              </div>
            </div>

            {/* Rows of DIN rail labels */}
            <div className="space-y-6">
              {Array.from({ length: totalRows }).map((_, rowIndex) => {
                const startIdx = rowIndex * rowCapacityTe;
                let currentTe = 0;
                const rowSlots: LabelSlot[] = [];

                for (const slot of slots) {
                  if (currentTe >= startIdx && currentTe < startIdx + rowCapacityTe) {
                    rowSlots.push(slot);
                  }
                  currentTe += slot.widthTe;
                }

                return (
                  <div key={rowIndex} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase px-1">
                      <span>Ряд {rowIndex + 1} (DIN-рейка №{rowIndex + 1})</span>
                      <span>18 мм x {rowCapacityTe} = {rowCapacityTe * 18} мм</span>
                    </div>

                    {/* Strip container with border and cut guides */}
                    <div className="flex border-2 border-slate-900 h-20 rounded-xs overflow-hidden bg-white shadow-xs">
                      {rowSlots.map((slot) => {
                        const widthPercent = (slot.widthTe / rowCapacityTe) * 100;
                        const phaseColor =
                          slot.phase === 'L1'
                            ? '#ca8a04' // жовтий/коричневий
                            : slot.phase === 'L2'
                            ? '#16a34a' // зелений/чорний
                            : slot.phase === 'L3'
                            ? '#dc2626' // червоний
                            : slot.phase === '3P'
                            ? '#7c3aed' // фіолетовий 3P
                            : '#2563eb'; // синій 1P+N

                        return (
                          <div
                            key={slot.id}
                            style={{ width: `${widthPercent}%` }}
                            className="border-r border-slate-400 last:border-r-0 relative flex flex-col justify-between p-1 hover:bg-amber-50/50 cursor-pointer transition-colors group"
                            onClick={() => setEditingSlotId(slot.id)}
                          >
                            {/* Phase color top indicator bar */}
                            <div
                              style={{ backgroundColor: phaseColor }}
                              className="h-1.5 w-full rounded-xs shrink-0"
                              title={`Фаза ${slot.phase}`}
                            />

                            {/* Center content */}
                            <div className="flex-1 flex flex-col items-center justify-center text-center my-0.5 overflow-hidden">
                              <span className="text-base leading-none select-none">
                                {slot.icon}
                              </span>
                              <div className="font-bold text-[10px] text-slate-900 leading-tight truncate w-full mt-0.5">
                                {slot.title}
                              </div>
                              <div className="text-[8px] text-slate-600 truncate w-full">
                                {slot.subtitle}
                              </div>
                            </div>

                            {/* Bottom rating tag */}
                            <div className="flex items-center justify-between text-[8px] font-mono font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded-xs border-t border-slate-200">
                              <span>{slot.phase}</span>
                              <span className="text-slate-900">{slot.ratingText}</span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Fill empty remaining modules if row is not full */}
                      {rowSlots.reduce((s, slot) => s + slot.widthTe, 0) < rowCapacityTe && (
                        <div
                          style={{
                            width: `${
                              ((rowCapacityTe -
                                rowSlots.reduce((s, slot) => s + slot.widthTe, 0)) /
                                rowCapacityTe) *
                              100
                            }%`,
                          }}
                          className="bg-slate-50 border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400 font-mono"
                        >
                          РЕЗЕРВ ({rowCapacityTe - rowSlots.reduce((s, slot) => s + slot.widthTe, 0)} TE)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend and Cut instructions */}
            <div className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#ca8a04]"></span> L1 (Фаза А)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#16a34a]"></span> L2 (Фаза B)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#dc2626]"></span> L3 (Фаза C)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#2563eb]"></span> N (Нейтраль)
                </span>
              </div>
              <div>ПУЕ-2017 • Кодування споживачів ДБН В.2.5-23:2010</div>
            </div>

          </div>

          {/* Quick slot editor drawer when clicked */}
          {editingSlotId && (
            <div className="w-full max-w-[850px] mt-4 p-4 rounded-xl bg-slate-800 border border-slate-700 text-xs flex flex-wrap items-center justify-between gap-3 print:hidden animate-in fade-in">
              {(() => {
                const editing = slots.find((s) => s.id === editingSlotId);
                if (!editing) return null;
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="text-slate-400 font-medium">
                        Редагування наліпки: <strong className="text-white">{editing.title}</strong>
                      </div>
                      <select
                        value={editing.icon}
                        onChange={(e) => updateSlot(editing.id, { icon: e.target.value })}
                        className="bg-slate-700 text-white rounded px-2 py-1 outline-none text-base"
                      >
                        {CONSUMER_ICONS.map((i) => (
                          <option key={i.label} value={i.icon}>
                            {i.icon} {i.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editing.title}
                        onChange={(e) => updateSlot(editing.id, { title: e.target.value })}
                        placeholder="Назва лінії"
                        className="bg-slate-700 text-white rounded px-2.5 py-1 outline-none w-44"
                      />
                      <input
                        type="text"
                        value={editing.ratingText}
                        onChange={(e) => updateSlot(editing.id, { ratingText: e.target.value })}
                        placeholder="Номінал (C16A)"
                        className="bg-slate-700 text-white rounded px-2.5 py-1 outline-none w-24"
                      />
                    </div>
                    <button
                      onClick={() => setEditingSlotId(null)}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg"
                    >
                      Готово
                    </button>
                  </>
                );
              })()}
            </div>
          )}

        </div>

        {/* Footer info - Hidden during print */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400 print:hidden">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Порада: Для друку на самоклейному папері виберіть у налаштуваннях принтера «Масштаб 100%» (без підгонки під сторінку), щоб зберегти точний розмір 18.0 мм на модуль.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Закрити
          </button>
        </div>

      </div>
    </div>
  );
};
