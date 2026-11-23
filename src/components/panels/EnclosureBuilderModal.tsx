/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Visual DIN-Rail Enclosure Builder (Компоновка електрощита на DIN-рейку)
 * Hager Volta, Schneider Resi9, ABB Mistral enclosure models with Fork/Pin Busbars.
 */

import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Layers,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Download,
  ShieldCheck,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { CadProject, CircuitGroup, DinModuleItem, DinRailRow, EnclosureConfig } from '../../types/cad';
import { getAggregatedProjectData } from '../../utils/projectAggregator';

interface EnclosureBuilderModalProps {
  project: CadProject;
  onUpdateProject?: (updated: CadProject) => void;
  onClose?: () => void;
  embedded?: boolean; // If true, renders inside tab without outer fixed backdrop
}

export const ENCLOSURE_PRESETS: Array<{
  id: string;
  brand: EnclosureConfig['brand'];
  model: string;
  rows: number;
  rowCapacityTe: number;
  description: string;
}> = [
  {
    id: 'hager_volta_36',
    brand: 'Hager',
    model: 'Hager Volta VU36NE (36 TE)',
    rows: 3,
    rowCapacityTe: 12,
    description: '3 ряди по 12 модулів (розширюється до 42 TE). Стандарт для 2-3 кімнатних квартир',
  },
  {
    id: 'hager_volta_24',
    brand: 'Hager',
    model: 'Hager Volta VU24NE (24 TE)',
    rows: 2,
    rowCapacityTe: 12,
    description: '2 ряди по 12 модулів (24 TE). Компактний навісний або вбудований щит для 1-2 кімнатних квартир',
  },
  {
    id: 'schneider_resi9_36',
    brand: 'Schneider',
    model: 'Schneider Electric Resi9 36M (36 TE)',
    rows: 2,
    rowCapacityTe: 18,
    description: '2 широких ряди по 18 модулів. Зручно для встановлення довгих 3-фазних гребінок',
  },
  {
    id: 'hager_volta_48',
    brand: 'Hager',
    model: 'Hager Volta VU48NE (48 TE)',
    rows: 4,
    rowCapacityTe: 12,
    description: '4 ряди по 12 модулів (48 TE). Преміум серія Hager з додатковим простором для кабелів',
  },
  {
    id: 'schneider_resi9_54',
    brand: 'Schneider',
    model: 'Schneider Electric Resi9 54M (54 TE)',
    rows: 3,
    rowCapacityTe: 18,
    description: '3 ряди по 18 модулів (54 TE). Для будинків та котеджів з резервним живленням',
  },
  {
    id: 'iek_titan_72',
    brand: 'IEK',
    model: 'IEK TITAN 72M / ABB Mistral 72 (72 TE)',
    rows: 4,
    rowCapacityTe: 18,
    description: '4 широких ряди по 18 модулів (72 TE). Повнорозмірна шафа для великих приватних будинків та розумного дому',
  },
  {
    id: 'hager_golf_18',
    brand: 'Hager',
    model: 'Hager Golf VS118 (18 TE)',
    rows: 1,
    rowCapacityTe: 18,
    description: '1 ряд на 18 модулів. Для компактних 1-кімнатних квартир або щитів освітлення',
  },
  {
    id: 'schneider_mini_12',
    brand: 'Schneider',
    model: 'Schneider Mini Pragma (12 TE)',
    rows: 1,
    rowCapacityTe: 12,
    description: '1 ряд на 12 модулів. Малий локальний щиток гаража, майстерні чи котельні',
  },
];

/**
 * Automatically builds default realistic DIN module arrangement from project circuits
 */
function buildDefaultEnclosureRows(project: CadProject, rowCount: number, capacityTe: number): DinRailRow[] {
  const is3Ph = project.supplyPhase === '3-phase';

  // 1. INCOMING ROW (Row 1): Main Breaker + Surge Protector SPD + Voltage Relay
  const row1Modules: DinModuleItem[] = [];

  // Main Incomer MCB
  row1Modules.push({
    id: 'mod_main_incomer',
    type: 'main_mcb',
    name: is3Ph ? `Ввідний 3P ${project.mainBreakerRatingA}A` : `Ввідний 2P ${project.mainBreakerRatingA}A`,
    subtitle: is3Ph ? '400V 3P+N' : '230V 1P+N',
    widthTe: is3Ph ? 3 : 2,
    phase: is3Ph ? '3P' : '1P+N',
    ratingA: project.mainBreakerRatingA,
    curve: 'C',
    color: '#0284c7',
  });

  // Surge Protection Device (SPD T2)
  row1Modules.push({
    id: 'mod_spd',
    type: 'spd',
    name: is3Ph ? 'ПЗІП T2 (3P+N)' : 'ПЗІП T2 (1P+N)',
    subtitle: 'Захист 20кА (ПУЕ)',
    widthTe: is3Ph ? 4 : 2,
    phase: is3Ph ? '3P' : '1P+N',
    color: '#059669',
  });

  // Digital Voltage Relay (ZUBR / Welrok)
  row1Modules.push({
    id: 'mod_voltage_relay',
    type: 'voltage_relay',
    name: is3Ph ? 'Реле напруги ZUBR 3P' : 'Реле напруги ZUBR D2',
    subtitle: 'TrueRMS 230V LED',
    widthTe: is3Ph ? 3 : 2,
    phase: is3Ph ? '3P' : 'L1',
    ratingA: 63,
    color: '#d97706',
  });

  // Add ATS/Generator selector if backup system enabled
  if (project.backupSystem?.enabled) {
    row1Modules.push({
      id: 'mod_backup_switch',
      type: 'contactor',
      name: 'Перемикач Мережа/ДБЖ',
      subtitle: 'I-0-II Реверсивний',
      widthTe: 2,
      phase: 'L1',
      ratingA: 40,
      color: '#10b981',
    });
  }

  // Check for KNX actuators in project elements
  const hasKnxElements = project.elements.some((e) => e.type === 'knx_actuator' || e.type === 'knx_power_supply');
  if (hasKnxElements) {
    row1Modules.push({
      id: 'mod_knx_psu',
      type: 'knx_psu',
      name: 'KNX PSU 30V DC',
      subtitle: 'Джерело 640мА',
      widthTe: 4,
      phase: 'L1',
      color: '#10b981',
    });
  }

  // 2. SUBSEQUENT ROWS: Circuit Breakers, RCDs, RCBOs
  const rows: DinRailRow[] = [
    {
      id: 'row_1',
      index: 1,
      name: 'Ряд 1: Ввідний апарат, ПЗІП та реле захисту напруги',
      capacityTe,
      modules: row1Modules,
      hasBusbar: false,
    },
  ];

  // Distribute remaining circuit groups across Row 2, Row 3, etc.
  const circuitModules: DinModuleItem[] = [];

  // Group circuits by RCD if present
  project.circuits.forEach((c) => {
    const isRcbo = c.rcdType === 'rcbo_30ma' || c.rcdType === 'rcbo_10ma';
    const isRcd = c.rcdType === 'rcd_30ma' || c.rcdType === 'rcd_10ma';

    if (isRcbo) {
      circuitModules.push({
        id: `mod_c_${c.id}`,
        type: 'rcbo',
        name: `Дифавтомат ${c.breakerCurve || 'C'}${c.breakerRatingA}А`,
        subtitle: `Гр.${c.number} (${c.name})`,
        widthTe: 2, // 1P+N or 2P
        phase: c.phase || 'L1',
        ratingA: c.breakerRatingA,
        curve: c.breakerCurve || 'C',
        rcdCurrentMa: c.rcdType === 'rcbo_10ma' ? 10 : 30,
        circuitId: c.id,
        color: c.color || '#38bdf8',
        busbarConnection: c.phase === '3P' ? 'L1' : (c.phase || 'L1'),
      });
    } else {
      circuitModules.push({
        id: `mod_c_${c.id}`,
        type: 'mcb',
        name: `Автомат ${c.breakerCurve || 'C'}${c.breakerRatingA}А`,
        subtitle: `Гр.${c.number} (${c.name})`,
        widthTe: 1, // standard 1P MCB = 18mm = 1 TE
        phase: c.phase || 'L1',
        ratingA: c.breakerRatingA,
        curve: c.breakerCurve || 'C',
        circuitId: c.id,
        color: c.color || '#38bdf8',
        busbarConnection: c.phase === '3P' ? 'L1' : (c.phase || 'L1'),
      });
    }
  });

  // If project has KNX actuators, add actuator module
  if (hasKnxElements) {
    circuitModules.push({
      id: 'mod_knx_actuator_1',
      type: 'knx_actuator',
      name: 'KNX Актюатор 4x16A',
      subtitle: 'Релейний блок світла',
      widthTe: 4,
      phase: 'L1',
      color: '#10b981',
    });
  }

  // Populate into remaining available rows
  for (let r = 2; r <= Math.max(2, rowCount); r++) {
    const availableTe = capacityTe;
    let accumulated = 0;
    const currentModules: DinModuleItem[] = [];

    // Add group RCD at start of row if not all are RCBOs
    if (r === 2 && !circuitModules.every((m) => m.type === 'rcbo')) {
      const rcdMod: DinModuleItem = {
        id: `mod_rcd_group_${r}`,
        type: 'rcd',
        name: is3Ph ? 'ПЗВ 4P 40A 30мА' : 'ПЗВ 2P 40A 30мА',
        subtitle: 'Груповий дифзахист',
        widthTe: is3Ph ? 4 : 2,
        phase: is3Ph ? '3P' : '1P+N',
        ratingA: 40,
        rcdCurrentMa: 30,
        color: '#8b5cf6',
      };
      currentModules.push(rcdMod);
      accumulated += rcdMod.widthTe;
    }

    while (circuitModules.length > 0 && accumulated + circuitModules[0].widthTe <= availableTe) {
      const nextMod = circuitModules.shift()!;
      currentModules.push(nextMod);
      accumulated += nextMod.widthTe;
    }

    rows.push({
      id: `row_${r}`,
      index: r,
      name: `Ряд ${r}: Групові апарати та лінійні автоматичні вимикачі`,
      capacityTe,
      modules: currentModules,
      hasBusbar: true,
      busbarType: is3Ph ? '3P' : '1P',
    });
  }

  // If some circuit modules still remain, append to last row
  if (circuitModules.length > 0) {
    const lastRow = rows[rows.length - 1];
    lastRow.modules.push(...circuitModules);
  }

  return rows;
}

export const EnclosureBuilderModal: React.FC<EnclosureBuilderModalProps> = ({
  project,
  onUpdateProject,
  onClose,
  embedded = false,
}) => {
  const aggregated = useMemo(() => getAggregatedProjectData(project), [project]);
  const [selectedBoardKey, setSelectedBoardKey] = useState<string>(() => aggregated.syncedFloors[0]?.id || 'main');

  const savedConfig: EnclosureConfig | undefined = project.enclosureConfigs?.[selectedBoardKey];

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    if (savedConfig?.model) {
      return ENCLOSURE_PRESETS.find((p) => p.model === savedConfig.model)?.id || 'hager_volta_36';
    }
    return 'hager_volta_36';
  });
  const selectedPreset = ENCLOSURE_PRESETS.find((p) => p.id === selectedPresetId) || ENCLOSURE_PRESETS[0];

  const [rows, setRows] = useState<DinRailRow[]>(() =>
    savedConfig?.rows && savedConfig.rows.length > 0
      ? savedConfig.rows
      : buildDefaultEnclosureRows(project, selectedPreset.rows, selectedPreset.rowCapacityTe)
  );

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [railError, setRailError] = useState<string | null>(null);

  const persistEnclosure = (nextPresetId: string, nextRows: DinRailRow[]) => {
    if (!onUpdateProject) return;
    const preset = ENCLOSURE_PRESETS.find((p) => p.id === nextPresetId) || ENCLOSURE_PRESETS[0];
    const totalTe = nextRows.reduce((s, r) => s + r.capacityTe, 0);
    const nextConfig: EnclosureConfig = {
      brand: preset.brand,
      model: preset.model,
      totalRows: nextRows.length,
      rowCapacityTe: preset.rowCapacityTe,
      totalTe,
      mounting: savedConfig?.mounting || 'flush',
      rows: nextRows,
    };
    onUpdateProject({
      ...project,
      enclosureConfigs: {
        ...(project.enclosureConfigs || {}),
        [selectedBoardKey]: nextConfig,
      },
    });
  };

  const handleSelectBoard = (boardKey: string) => {
    setSelectedBoardKey(boardKey);
    const existing = project.enclosureConfigs?.[boardKey];
    if (existing?.rows && existing.rows.length > 0) {
      const matchedPreset = ENCLOSURE_PRESETS.find((p) => p.model === existing.model)?.id || 'hager_volta_36';
      setSelectedPresetId(matchedPreset);
      setRows(existing.rows);
    } else {
      const preset = ENCLOSURE_PRESETS.find((p) => p.id === selectedPresetId) || ENCLOSURE_PRESETS[0];
      setRows(buildDefaultEnclosureRows(project, preset.rows, preset.rowCapacityTe));
    }
    setActiveModuleId(null);
    setRailError(null);
  };

  // When changing preset, recalculate rows & persist
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = ENCLOSURE_PRESETS.find((p) => p.id === presetId) || ENCLOSURE_PRESETS[0];
    const nextRows = buildDefaultEnclosureRows(project, preset.rows, preset.rowCapacityTe);
    setRows(nextRows);
    setActiveModuleId(null);
    setRailError(null);
    persistEnclosure(presetId, nextRows);
  };

  // Enclosure metrics
  const totalCapacityTe = rows.reduce((sum, r) => sum + r.capacityTe, 0);
  const totalOccupiedTe = rows.reduce(
    (sum, r) => sum + r.modules.reduce((mSum, m) => mSum + m.widthTe, 0),
    0
  );
  const reserveTe = totalCapacityTe - totalOccupiedTe;
  const reservePercent = totalCapacityTe > 0 ? Math.round((reserveTe / totalCapacityTe) * 100) : 0;
  const isReserveAdequate = reservePercent >= 20;

  // Move module Left / Right within row
  const handleMoveModuleHoriz = (rowIdx: number, modIdx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? modIdx - 1 : modIdx + 1;
    const row = rows[rowIdx];
    if (targetIdx < 0 || targetIdx >= row.modules.length) return;

    const cloneRows = [...rows];
    const newMods = [...row.modules];
    const [moved] = newMods.splice(modIdx, 1);
    newMods.splice(targetIdx, 0, moved);
    cloneRows[rowIdx] = { ...row, modules: newMods };
    setRows(cloneRows);
    setRailError(null);
    persistEnclosure(selectedPresetId, cloneRows);
  };

  // Move module to row Above / Below
  const handleMoveModuleVert = (fromRowIdx: number, modIdx: number, direction: 'up' | 'down') => {
    const targetRowIdx = direction === 'up' ? fromRowIdx - 1 : fromRowIdx + 1;
    if (targetRowIdx < 0 || targetRowIdx >= rows.length) return;

    const fromRow = rows[fromRowIdx];
    const toRow = rows[targetRowIdx];
    const mod = fromRow.modules[modIdx];

    // Check capacity
    const currentToOccupied = toRow.modules.reduce((sum, m) => sum + m.widthTe, 0);
    if (currentToOccupied + mod.widthTe > toRow.capacityTe + 4) {
      setRailError(`Недостатньо місця на DIN-рейці Ряду ${targetRowIdx + 1} (${toRow.capacityTe} TE)`);
      setTimeout(() => setRailError(null), 4000);
      return;
    }

    const cloneRows = [...rows];
    const newFromMods = [...fromRow.modules];
    newFromMods.splice(modIdx, 1);

    const newToMods = [...toRow.modules, mod];

    cloneRows[fromRowIdx] = { ...fromRow, modules: newFromMods };
    cloneRows[targetRowIdx] = { ...toRow, modules: newToMods };
    setRows(cloneRows);
    setRailError(null);
    persistEnclosure(selectedPresetId, cloneRows);
  };

  // Add blank spacer / modular socket
  const handleAddModularItem = (rowIdx: number, type: 'blank' | 'schuko_socket' | 'bell_transformer') => {
    const row = rows[rowIdx];
    const newItem: DinModuleItem =
      type === 'schuko_socket'
        ? {
            id: `mod_schuko_${Date.now()}`,
            type: 'terminal_block',
            name: 'Розетка на DIN-рейку 16A',
            subtitle: 'Модульна Schuko',
            widthTe: 2.5,
            phase: 'L1',
            color: '#64748b',
          }
        : type === 'bell_transformer'
        ? {
            id: `mod_trans_${Date.now()}`,
            type: 'terminal_block',
            name: 'Трансформатор дзвінка 12V',
            subtitle: '230V -> 12V AC',
            widthTe: 2,
            phase: 'L1',
            color: '#0284c7',
          }
        : {
            id: `mod_blank_${Date.now()}`,
            type: 'blank',
            name: 'Заглушка Hager S35S',
            subtitle: 'Резервний модуль',
            widthTe: 1,
            color: '#334155',
          };

    const cloneRows = [...rows];
    cloneRows[rowIdx] = { ...row, modules: [...row.modules, newItem] };
    setRows(cloneRows);
    persistEnclosure(selectedPresetId, cloneRows);
  };

  // Delete module
  const handleDeleteModule = (rowIdx: number, modId: string) => {
    const cloneRows = [...rows];
    cloneRows[rowIdx] = {
      ...cloneRows[rowIdx],
      modules: cloneRows[rowIdx].modules.filter((m) => m.id !== modId),
    };
    setRows(cloneRows);
    if (activeModuleId === modId) setActiveModuleId(null);
    persistEnclosure(selectedPresetId, cloneRows);
  };

  // Export Enclosure BOM CSV
  const handleExportEnclosureCsv = () => {
    const headers = ['Позиція', 'Ряд щита', 'Модуль', 'Тип апарата', 'Ширина TE (18мм)', 'Фаза', 'Номінал', 'Характеристика / IΔn'];
    const lines: string[] = [headers.join(';')];

    let pos = 1;
    rows.forEach((r) => {
      r.modules.forEach((m) => {
        lines.push(
          [
            pos++,
            `Ряд ${r.index}`,
            `"${m.name}"`,
            m.type,
            m.widthTe,
            m.phase || '-',
            m.ratingA ? `${m.ratingA}A` : '-',
            m.curve ? `Крива ${m.curve}` : m.rcdCurrentMa ? `${m.rcdCurrentMa}мА` : '-',
          ].join(';')
        );
      });
    });

    lines.push('');
    lines.push(`КОРПУС ЩИТА:;${selectedPreset.model}`);
    lines.push(`ЗАГАЛЬНА МІСТКІСТЬ:;${totalCapacityTe} TE`);
    lines.push(`ЗАЙНЯТО:;${totalOccupiedTe} TE (${Math.round((totalOccupiedTe / totalCapacityTe) * 100)}%)`);
    lines.push(`РЕЗЕРВНИЙ ЗАПАС:;${reserveTe} TE (${reservePercent}%) - ${isReserveAdequate ? 'Норма ПУЕ дотримана' : 'Рекомендовано збільшити корпус'}`);

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title || 'electroplan'}_enclosure_din_layout.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const content = (
    <div className="space-y-5">
      {/* Multi-floor board selector if > 1 floor */}
      {aggregated.syncedFloors.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
          <span className="text-[11px] font-semibold text-neutral-400 mr-1">Щит об’єкта:</span>
          {aggregated.syncedFloors.map((fl, idx) => (
            <button
              key={fl.id}
              onClick={() => handleSelectBoard(fl.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                selectedBoardKey === fl.id
                  ? 'bg-sky-500 text-neutral-950 font-semibold'
                  : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {fl.distributionBoardName || (idx === 0 ? 'ВРП' : `ЩР-${idx + 1}`)} ({fl.name})
            </button>
          ))}
        </div>
      )}

      {railError && (
        <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{railError}</span>
        </div>
      )}

      {/* Top Toolbar: Enclosure Selector & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Enclosure Model Selector */}
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">
            Модель електричного щита
          </span>
          <select
            value={selectedPresetId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100 font-semibold focus:outline-none focus:border-sky-500"
          >
            {ENCLOSURE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.model}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-neutral-500 block truncate">{selectedPreset.description}</span>
        </div>

        {/* Capacity & Reserve Indicator */}
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
              Заповнення DIN-рейки
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                isReserveAdequate
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              Резерв: {reservePercent}% ({reserveTe} TE)
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xl font-bold font-mono text-neutral-100">
                {totalOccupiedTe} <span className="text-xs text-neutral-400 font-sans">/ {totalCapacityTe} TE</span>
              </span>
              <span className="text-xs text-neutral-400">
                ({Math.round((totalOccupiedTe / totalCapacityTe) * 100)}%)
              </span>
            </div>
            {/* Visual capacity progress bar */}
            <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden flex">
              <div
                className={`h-full transition-all duration-300 ${
                  isReserveAdequate ? 'bg-sky-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, Math.round((totalOccupiedTe / totalCapacityTe) * 100))}%` }}
              />
            </div>
          </div>
          <span className="text-[9.5px] text-neutral-500 mt-1">
            {isReserveAdequate
              ? '✓ Норма ПУЕ / ДБН В.2.5-23 (резерв ≥ 20%) дотримана'
              : '⚠ Резерв менше 20%. Рекомендовано обрати щит більшого типорозміру'}
          </span>
        </div>

        {/* Actions: Export & Reset */}
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">
            Експорт специфікації та інструменти
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportEnclosureCsv}
              className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Експорт BOM (.CSV)</span>
            </button>
            <button
              onClick={() => handleSelectPreset(selectedPresetId)}
              className="py-1.5 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              title="Скинути до стандартного розташування"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[10px] text-neutral-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Сумісно з шинами Hager KD363, Schneider A9XPH324</span>
          </div>
        </div>
      </div>

      {/* Visual DIN Rails Container */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-6 shadow-inner">
        {/* N / PE Terminal Bars at the top */}
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center text-[8px] font-bold text-neutral-950">
              N
            </span>
            <span className="text-neutral-300 font-semibold text-[11px]">Шина N (Нуль):</span>
            <span className="text-neutral-500 text-[10px]">Клемник Hager KN18N (18 гнізд 1.5–16 мм²)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 flex items-center justify-center text-[8px] font-bold text-neutral-950">
              PE
            </span>
            <span className="text-neutral-300 font-semibold text-[11px]">Шина PE (Заземлення):</span>
            <span className="text-neutral-500 text-[10px]">Клемник Hager KN18PE (18 гнізд 1.5–16 мм²)</span>
          </div>
        </div>

        {/* Rows on DIN Rails */}
        {rows.map((row, rIdx) => {
          const rowOccupiedTe = row.modules.reduce((sum, m) => sum + m.widthTe, 0);
          const rowReserveTe = row.capacityTe - rowOccupiedTe;

          return (
            <div key={row.id} className="space-y-2">
              {/* Row Header */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-neutral-200">{row.name}</span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    ({rowOccupiedTe} / {row.capacityTe} TE)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddModularItem(rIdx, 'blank')}
                    className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center gap-1 transition-colors"
                    title="Додати пластикову заглушку 1TE"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Заглушка 1TE</span>
                  </button>
                  <button
                    onClick={() => handleAddModularItem(rIdx, 'schuko_socket')}
                    className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center gap-1 transition-colors"
                    title="Додати модульну розетку на DIN-рейку Schuko"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Розетка DIN</span>
                  </button>
                </div>
              </div>

              {/* Physical DIN Rail with modules */}
              <div className="relative pt-3 pb-4 px-3 bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-x-auto">
                {/* 1. Metal DIN Rail Bar Background (35mm Steel profile) */}
                <div className="absolute top-1/2 left-3 right-3 -translate-y-1/2 h-7 bg-gradient-to-r from-neutral-700 via-neutral-600 to-neutral-700 border-y border-neutral-500/80 rounded-sm shadow-inner pointer-events-none" />

                {/* 2. Copper Fork/Pin Busbar Indicator at top/bottom terminals */}
                {row.hasBusbar && (
                  <div className="absolute bottom-2 left-6 right-6 h-1.5 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 rounded-sm opacity-90 shadow-sm pointer-events-none flex items-center justify-around">
                    <span className="text-[7px] text-amber-950 font-bold px-1 bg-yellow-400 rounded">
                      Гребінчаста шина 3P/1P (Fork Busbar)
                    </span>
                  </div>
                )}

                {/* 3. Physical Modules Container */}
                <div className="relative z-10 flex items-stretch gap-1.5 min-h-[145px]">
                  {row.modules.map((mod, mIdx) => {
                    const isSelected = activeModuleId === mod.id;
                    // Width proportional to TE (1 TE = 48px)
                    const widthPx = Math.max(48, mod.widthTe * 48);

                    return (
                      <div
                        key={mod.id}
                        onClick={() => setActiveModuleId(mod.id)}
                        style={{ width: `${widthPx}px` }}
                        className={`group relative flex flex-col justify-between p-2 rounded-lg border transition-all cursor-pointer select-none shrink-0 ${
                          isSelected
                            ? 'bg-neutral-800 border-sky-400 shadow-lg shadow-sky-500/20 scale-[1.02]'
                            : mod.type === 'blank'
                            ? 'bg-neutral-900/60 border-dashed border-neutral-800 text-neutral-500 hover:border-neutral-700'
                            : 'bg-neutral-900 border-neutral-700 hover:border-neutral-500 hover:shadow-md'
                        }`}
                      >
                        {/* Terminal screws at the top */}
                        <div className="flex items-center justify-around mb-1">
                          {Array.from({ length: Math.max(1, Math.round(mod.widthTe)) }).map((_, sIdx) => (
                            <div
                              key={sIdx}
                              className="w-2.5 h-2.5 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center text-[6px] text-neutral-400"
                              title="Ввідний затискач клеми"
                            >
                              +
                            </div>
                          ))}
                        </div>

                        {/* Module Body Content */}
                        <div className="flex-1 flex flex-col justify-center text-center">
                          {/* Phase tag badge */}
                          {mod.phase && (
                            <span
                              className={`text-[8.5px] font-mono font-bold px-1 rounded inline-block self-center mb-0.5 ${
                                mod.phase === 'L1'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : mod.phase === 'L2'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : mod.phase === 'L3'
                                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                  : 'bg-neutral-700 text-neutral-200'
                              }`}
                            >
                              {mod.phase}
                            </span>
                          )}

                          {/* Digital LED Display for Voltage Relay */}
                          {mod.type === 'voltage_relay' && (
                            <div className="bg-neutral-950 border border-red-950 rounded px-1 py-0.5 my-0.5 text-center">
                              <span className="text-[11px] font-mono font-bold text-red-500 tracking-wider">
                                231 V
                              </span>
                            </div>
                          )}

                          {/* Toggle switch lever handle */}
                          {mod.type !== 'blank' && mod.type !== 'terminal_block' && (
                            <div className="w-3.5 h-5 mx-auto my-1 rounded bg-neutral-950 border border-neutral-600 flex flex-col justify-start p-0.5 shadow-sm">
                              <div
                                className={`w-full h-2 rounded-sm ${
                                  mod.type === 'mcb' || mod.type === 'main_mcb'
                                    ? 'bg-sky-500'
                                    : mod.type === 'rcd'
                                    ? 'bg-purple-500'
                                    : mod.type === 'rcbo'
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500'
                                }`}
                              />
                            </div>
                          )}

                          {/* Name & Subtitle */}
                          <div className="text-[10px] font-bold text-neutral-200 truncate leading-tight">
                            {mod.name}
                          </div>
                          {mod.subtitle && (
                            <div className="text-[8.5px] text-neutral-400 truncate leading-tight mt-0.5">
                              {mod.subtitle}
                            </div>
                          )}
                        </div>

                        {/* Bottom: rating & width TE */}
                        <div className="pt-1 mt-1 border-t border-neutral-800 flex items-center justify-between text-[8px] font-mono text-neutral-400">
                          <span>{mod.widthTe} TE</span>
                          {mod.ratingA && <span className="font-bold text-neutral-200">{mod.ratingA}A</span>}
                        </div>

                        {/* Interactive floating control buttons on hover / selected */}
                        {isSelected && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neutral-950 border border-sky-500/60 rounded-md p-0.5 flex items-center gap-1 shadow-lg z-20 animate-in fade-in zoom-in-90">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveModuleHoriz(rIdx, mIdx, 'left');
                              }}
                              disabled={mIdx === 0}
                              className="p-1 hover:bg-neutral-800 disabled:opacity-30 rounded text-neutral-300"
                              title="Зсунути ліворуч"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveModuleHoriz(rIdx, mIdx, 'right');
                              }}
                              disabled={mIdx === row.modules.length - 1}
                              className="p-1 hover:bg-neutral-800 disabled:opacity-30 rounded text-neutral-300"
                              title="Зсунути праворуч"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                            {rIdx > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveModuleVert(rIdx, mIdx, 'up');
                                }}
                                className="p-1 hover:bg-neutral-800 rounded text-neutral-300"
                                title="Перемістити на ряд вище"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                            )}
                            {rIdx < rows.length - 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveModuleVert(rIdx, mIdx, 'down');
                                }}
                                className="p-1 hover:bg-neutral-800 rounded text-neutral-300"
                                title="Перемістити на ряд нижче"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteModule(rIdx, mod.id);
                              }}
                              className="p-1 hover:bg-rose-950/80 rounded text-rose-400"
                              title="Видалити модуль"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Empty rail capacity placeholder */}
                  {rowReserveTe > 0 && (
                    <div
                      style={{ width: `${Math.max(48, rowReserveTe * 48)}px` }}
                      className="border border-dashed border-neutral-800 rounded-lg flex items-center justify-center text-[10px] text-neutral-600 font-mono select-none"
                    >
                      +{rowReserveTe} TE вільно
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Візуальна компоновка електрощита на DIN-рейку (Enclosure Builder)
              </h2>
              <p className="text-xs text-neutral-400">
                Моделі Hager Volta / Schneider Resi9, розташування модулів 18мм (TE) та гребінчастих шин
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-100 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">{content}</div>
      </div>
    </div>
  );
};
