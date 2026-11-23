/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Модуль «Кабельний журнал за формою ДСТУ 21.608 / ДСТУ 21.614»
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Info,
  CheckCircle,
} from 'lucide-react';
import { CadProject } from '../../types/cad';
import { generateCableSchedule, CableScheduleEntry } from '../../utils/cableSchedule';

interface CableScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: CadProject;
}

export const CableScheduleModal: React.FC<CableScheduleModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCircuit, setSelectedCircuit] = useState<string>('all');
  const [selectedCableType, setSelectedCableType] = useState<string>('all');

  const schedule = useMemo(() => generateCableSchedule(project), [project]);

  if (!isOpen) return null;

  // Фільтрація записів
  const filteredEntries = schedule.entries.filter((entry) => {
    const matchesSearch =
      entry.cableTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.sourceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.destinationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.roomName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCircuit =
      selectedCircuit === 'all' || entry.circuitNumber.toString() === selectedCircuit;

    const matchesCable =
      selectedCableType === 'all' || entry.cableSpec === selectedCableType;

    return matchesSearch && matchesCircuit && matchesCable;
  });

  // Експорт у CSV
  const handleExportCsv = () => {
    const headers = [
      'Маркування кабелю',
      'Група щита',
      'Звідки (Джерело)',
      'Куди (Призначення)',
      'Приміщення',
      'Марка кабелю',
      'Переріз',
      'Спосіб прокладання',
      'Гориз. ділянка (м)',
      'Вертик. опусти (м)',
      'Запас +12% (м)',
      'Разом розрахункова (м)',
      'Закупівельна (м)',
    ];

    const rows = filteredEntries.map((e) => [
      `"${e.cableTag}"`,
      `"Гр.${e.circuitNumber}"`,
      `"${e.sourceName}"`,
      `"${e.destinationName}"`,
      `"${e.roomName}"`,
      `"${e.cableSpec}"`,
      `"${e.coresAndSize}"`,
      `"${e.conduitType}"`,
      e.horizontalLengthM.toFixed(1),
      e.verticalDropsM.toFixed(1),
      e.terminationReserveM.toFixed(1),
      e.totalDesignLengthM.toFixed(1),
      e.procurementLengthM,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Кабельний_журнал_ДСТУ_${project.title || 'ElectroPlan'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col text-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Кабельний журнал & Відомість ліній
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  ДСТУ 21.608 / ДСТУ 21.614
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Повний перелік кабельних трас, вертикальних опусків та запасу на підключення у щитах
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Експорт CSV / Excel
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Друк
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="p-6 pb-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 font-medium">Сумарна довжина кабелів</div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
              {schedule.totalLengthM.toFixed(1)} м
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Враховано запас +12%</div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 font-medium">Кількість трас / ліній</div>
            <div className="text-xl font-bold text-white font-mono mt-1">
              {schedule.entries.length} ліній
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Марковані за ДСТУ</div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 font-medium">Силовий кабель (3х2.5)</div>
            <div className="text-xl font-bold text-cyan-400 font-mono mt-1">
              {(schedule.byCableType.find((c) => c.spec.includes('3х2.5'))?.totalLengthM || 0).toFixed(1)} м
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Розеткові групи 16A</div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 font-medium">Освітлення (3х1.5)</div>
            <div className="text-xl font-bold text-amber-400 font-mono mt-1">
              {(schedule.byCableType.find((c) => c.spec.includes('3х1.5'))?.totalLengthM || 0).toFixed(1)} м
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Групи освітлення 10A</div>
          </div>
        </div>

        {/* Filters and search toolbar */}
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Пошук за біркою, джерелом чи приміщенням..."
                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Група:</span>
              <select
                value={selectedCircuit}
                onChange={(e) => setSelectedCircuit(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
              >
                <option value="all">Усі групи щита</option>
                {project.circuits.map((c) => (
                  <option key={c.id} value={c.number.toString()}>
                    Гр.{c.number} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Марка:</span>
              <select
                value={selectedCableType}
                onChange={(e) => setSelectedCableType(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
              >
                <option value="all">Усі типи кабелів</option>
                {schedule.byCableType.map((c) => (
                  <option key={c.spec} value={c.spec}>
                    {c.spec}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 px-6 pb-6 overflow-y-auto">
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-inner">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-800/90 text-slate-400 border-b border-slate-700 font-medium sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="py-2.5 px-3">Бірка кабелю</th>
                  <th className="py-2.5 px-3">Траса (Звідки ➔ Куди)</th>
                  <th className="py-2.5 px-3">Марка кабелю</th>
                  <th className="py-2.5 px-3">Спосіб монтажу</th>
                  <th className="py-2.5 px-3 text-right">Гориз, м</th>
                  <th className="py-2.5 px-3 text-right">Опусти, м</th>
                  <th className="py-2.5 px-3 text-right">+12% зап.</th>
                  <th className="py-2.5 px-3 text-right font-bold text-white">Разом (м)</th>
                  <th className="py-2.5 px-3 text-center">Закуп.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredEntries.map((e, idx) => (
                  <tr key={e.id || idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-semibold text-emerald-400">
                      {e.cableTag}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-white flex items-center gap-1.5">
                        <span>{e.sourceName}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{e.destinationName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {e.roomName} • {e.circuitName}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono">
                      <span className="font-semibold text-slate-200">{e.cableSpec}</span>
                      <span className="block text-[11px] text-slate-500">{e.coresAndSize}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      {e.conduitType}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-400">
                      {e.horizontalLengthM.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-400">
                      {e.verticalDropsM.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-amber-400/90">
                      +{e.terminationReserveM.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-white">
                      {e.totalDesignLengthM.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-300 font-mono font-semibold">
                        {e.procurementLengthM} м
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Складено відповідно до форми 1 ДСТУ 21.608 та ДСТУ 21.614. Розрахункова довжина включає 12% запас на оброблення кінців кабелів та вигини.
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
