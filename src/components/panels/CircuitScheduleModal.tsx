/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ShieldCheck,
  Cpu,
  Activity,
  BarChart3,
  GitFork,
  AlertTriangle,
  Zap,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  HelpCircle,
  Layers,
  Boxes,
  Upload,
  ChevronDown,
  ChevronUp,
  Building2,
} from 'lucide-react';
import { CadProject, CircuitGroup } from '../../types/cad';
import {
  calculateProjectElectricalSummary,
  analyzeCircuit,
  autoBalancePhases,
  CABLE_SPECS,
  getCableTitleUk,
} from '../../utils/electricalCalculations';
import { getAggregatedProjectData } from '../../utils/projectAggregator';
import { generateCableSchedule } from '../../utils/cableSchedule';
import { SingleLineSchematicSvg } from '../cad/SingleLineSchematicSvg';
import { EnclosureBuilderModal } from './EnclosureBuilderModal';
import { ImportCircuitsModal } from './ImportCircuitsModal';
import { exportCircuitsToCsv, downloadCsvFile } from '../../utils/excelCsvUtils';

interface CircuitScheduleModalProps {
  project: CadProject;
  onUpdateCircuits: (circuits: CircuitGroup[]) => void;
  onUpdateProject?: (updated: CadProject) => void;
  onClose: () => void;
}

export const CircuitScheduleModal: React.FC<CircuitScheduleModalProps> = ({
  project,
  onUpdateCircuits,
  onUpdateProject,
  onClose,
}) => {
  const aggregated = React.useMemo(() => getAggregatedProjectData(project), [project]);
  const groundingSystem = project.groundingSystem || 'TN-C-S';

  const [demandFactor, setDemandFactor] = useState<number>(() => {
    const totalW = aggregated.allElements.reduce((sum, el) => sum + (el.powerWatts || 0), 0);
    return totalW > 10000 ? 0.7 : 0.8;
  });
  const [activeTab, setActiveTab] = useState<'table' | 'cable-schedule' | 'enclosure' | 'schematic'>('table');
  const [balanceNotification, setBalanceNotification] = useState<string | null>(null);
  const [expandedCircuitId, setExpandedCircuitId] = useState<string | null>(null);

  const summary = calculateProjectElectricalSummary(project, demandFactor);
  const is3Ph = project.supplyPhase === '3-phase';

  // Analyze each circuit across ALL floors with PUE derating & grounding checks
  const circuitLoads = project.circuits.map((circuit) =>
    analyzeCircuit(circuit, aggregated.allElements, aggregated.allWires, project.supplyPhase, groundingSystem)
  );

  // Add new circuit handler
  const handleAddCircuit = () => {
    const newNumber = project.circuits.length + 1;
    const newCircuit: CircuitGroup = {
      id: 'c_' + Date.now(),
      number: newNumber,
      name: `Група ${newNumber} (Розетки)`,
      breakerRatingA: 16,
      breakerCurve: 'C',
      rcdType: 'rcd_30ma',
      cableType: 'VVGng_3x2.5',
      phase: is3Ph ? ((newNumber % 3 === 1 ? 'L1' : newNumber % 3 === 2 ? 'L2' : 'L3') as any) : 'L1',
      color: '#38bdf8',
    };
    onUpdateCircuits([...project.circuits, newCircuit]);
  };

  const handleUpdateCircuit = (index: number, updated: CircuitGroup) => {
    const clone = [...project.circuits];
    clone[index] = updated;
    onUpdateCircuits(clone);
  };

  const handleDeleteCircuit = (id: string) => {
    onUpdateCircuits(project.circuits.filter((c) => c.id !== id));
  };

  // 1-Click Auto-Balance Phases optimization across ALL floors per DBN & PUE
  const handleAutoBalance = () => {
    const result = autoBalancePhases(project.circuits, aggregated.allElements);
    onUpdateCircuits(result.balancedCircuits);
    setBalanceNotification(
      `✓ Фази оптимізовано! Асиметрію знижено з ${result.initialUnbalancePercent}% до ${result.finalUnbalancePercent}% (перепризначено ${result.movedCount} ліній).`
    );
    setTimeout(() => {
      setBalanceNotification(null);
    }, 7000);
  };

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleExportCircuitsCsv = () => {
    const csv = exportCircuitsToCsv(project);
    downloadCsvFile(`electroplan_circuits_${project.id || 'project'}.csv`, csv);
  };

  const handleApplyImportedCircuits = (imported: CircuitGroup[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      onUpdateCircuits(imported);
    } else {
      const startNum = project.circuits.length;
      const adjusted = imported.map((c, i) => ({
        ...c,
        number: startNum + i + 1,
      }));
      onUpdateCircuits([...project.circuits, ...adjusted]);
    }
  };

  // Generate Cable Schedule across ALL floors + riser feeders (ДСТУ Б А.2.4-4:2009)
  const fullCableSchedule = React.useMemo(() => generateCableSchedule(project), [project]);

  const cableScheduleRows = React.useMemo(() => {
    return fullCableSchedule.entries.map((entry) => {
      const matchedCircuit = project.circuits.find((c) => c.number === entry.circuitNumber);
      const analysis = matchedCircuit
        ? circuitLoads.find((cl) => cl.circuit.id === matchedCircuit.id)
        : undefined;

      return {
        tag: entry.cableTag,
        circuitNumber: entry.circuitNumber,
        circuitName: entry.circuitName,
        fromNode: entry.sourceName,
        toNode: `${entry.destinationName}${entry.roomName && entry.roomName !== 'Загальна зона' ? ` (${entry.roomName})` : ''}`,
        cableType: entry.cableSpec,
        cableTitle: `${entry.cableSpec} ${entry.coresAndSize}`,
        conduitType: entry.conduitType,
        lengthM: Number((entry.horizontalLengthM + entry.verticalDropsM).toFixed(1)),
        totalLengthMWithMargin: Number(entry.totalDesignLengthM.toFixed(1)),
        currentA: analysis ? analysis.calculatedCurrentA : 0,
        vDropPercent: analysis ? analysis.voltageDrop.deltaPercent : 0,
        ikzA: analysis ? analysis.shortCircuit.ikzCurrentA : 0,
        isTrippingSafe: analysis ? analysis.shortCircuit.isTrippingAssured : true,
      };
    });
  }, [fullCableSchedule, project.circuits, circuitLoads]);

  // Cable lengths summary by type
  const cableTotalsByType = React.useMemo(() => {
    const totals: Record<string, number> = {};
    fullCableSchedule.byCableType.forEach((b) => {
      totals[b.spec] = b.totalLengthM;
    });
    return totals;
  }, [fullCableSchedule]);

  // CSV export function for Cable Schedule
  const handleExportCableScheduleCsv = () => {
    const headers = [
      'Марка кабелю за планом',
      'Група щита',
      'Початок траси (Звідки)',
      'Кінець траси (Куди)',
      'Марка та переріз',
      'Спосіб прокладання',
      'Довжина за планом, м',
      'Довжина із запасом +10%, м',
      'Струм навантаження Ib, А',
      'Падіння напруги ΔU, %',
      'Струм КЗ Ikz, А',
      'Відключення КЗ (ПУЕ §1.7.79)',
    ];

    const csvContent = [
      headers.join(';'),
      ...cableScheduleRows.map((r) =>
        [
          r.tag,
          `Гр. ${r.circuitNumber} (${r.circuitName})`,
          `"${r.fromNode.replace(/"/g, '""')}"`,
          `"${r.toNode.replace(/"/g, '""')}"`,
          r.cableTitle,
          r.conduitType,
          r.lengthM,
          r.totalLengthMWithMargin,
          r.currentA,
          r.vDropPercent,
          r.ikzA,
          r.isTrippingSafe ? 'Відповідає (t <= 0.4с)' : 'Потрібна перевірка',
        ].join(';')
      ),
      '',
      'ПІДСУМОК МАТЕРІАЛІВ (ІЗ ЗАПАСОМ 10% ЗА ДСТУ)',
      ...Object.entries(cableTotalsByType).map(([title, len]) => `${title};${Math.round(len)} м`),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${project.title || 'electroplan'}_kabelny_zhurnal_dstu.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white font-display">
                  Схема електрощита, розрахунок навантажень та кабельний журнал
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                  {is3Ph ? '400В 3-фазний' : '230В 1-фазний'}
                </span>
                {onUpdateProject && (
                  <select
                    value={groundingSystem}
                    onChange={(e) => onUpdateProject({ ...project, groundingSystem: e.target.value as any })}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-semibold outline-none cursor-pointer"
                    title="Система заземлення проєкту (ПУЕ §1.7)"
                  >
                    <option value="TN-C-S">Заземлення: TN-C-S</option>
                    <option value="TN-S">Заземлення: TN-S</option>
                    <option value="TT">Заземлення: TT (обов’язк. ПЗВ)</option>
                  </select>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                Координація апаратів за ПУЕ §1.3.4 (Km·Kg·Kt), падіння напруги ΔU, струми КЗ §1.7.79 та баланс фаз ДБН В.2.5-23:2010
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Switcher */}
            <div className="flex items-center bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
              <button
                onClick={() => setActiveTab('table')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  activeTab === 'table'
                    ? 'bg-sky-500 text-neutral-950 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Відомість ліній
              </button>
              <button
                onClick={() => setActiveTab('cable-schedule')}
                className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                  activeTab === 'cable-schedule'
                    ? 'bg-sky-500 text-neutral-950 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Кабельний журнал (ДСТУ)</span>
              </button>
              <button
                onClick={() => setActiveTab('enclosure')}
                className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                  activeTab === 'enclosure'
                    ? 'bg-sky-500 text-neutral-950 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Компоновка DIN-рейки</span>
              </button>
              <button
                onClick={() => setActiveTab('schematic')}
                className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                  activeTab === 'schematic'
                    ? 'bg-sky-500 text-neutral-950 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>Схема SVG</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-100 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Engineering Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Встановлена потужність (Руст)</span>
              <div className="text-lg font-bold font-mono text-neutral-100 tabular-nums">
                {summary.installedPowerKw} <span className="text-xs text-neutral-400 font-sans">кВт</span>
              </div>
              <span className="text-[10px] text-neutral-500">Точна сума споживачів проекту</span>
            </div>

            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-neutral-400">Коеф. попиту (Кп)</span>
                <span className="font-mono text-sky-400 text-xs font-semibold">{demandFactor}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={demandFactor}
                onChange={(e) => setDemandFactor(parseFloat(e.target.value))}
                className="w-full accent-sky-400 h-1 bg-neutral-800 rounded-lg cursor-pointer my-1.5"
              />
              <span className="text-[10px] text-neutral-500">ДБН В.2.5-23:2010 (Табл. 3.1)</span>
            </div>

            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Розрахункова потужність (Ррозр)</span>
              <div className="text-lg font-bold font-mono text-sky-400 tabular-nums">
                {summary.designPowerKw} <span className="text-xs text-neutral-400 font-sans">кВт</span>
              </div>
              <span className="text-[10px] text-neutral-500">Пікове навантаження з Kп={demandFactor}</span>
            </div>

            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Ввідний струм / Номінал</span>
              <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                {summary.mainCurrentA} A{' '}
                <span className="text-xs text-neutral-400 font-sans">
                  / Ввід {project.mainBreakerRatingA}A
                </span>
              </div>
              <span className="text-[10px] text-neutral-500">
                {!summary.isMainBreakerOverloaded ? (
                  <span className="text-emerald-400">✓ Запас за вводом у нормі (230/400 В)</span>
                ) : (
                  <span className="text-rose-400 font-semibold">⚠ Перевищення номіналу ввідного автомата!</span>
                )}
              </span>
            </div>
          </div>

          {/* Phase balance info if 3-phase */}
          {is3Ph && summary.phaseBalance && (
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-200">
                    Баланс фазного навантаження (ДБН В.2.5-23:2010 п. 3.7)
                  </span>
                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                      summary.phaseBalance.isBalanced
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    Несиметрія: {summary.phaseBalance.unbalancePercent}% (норма ≤ 15%)
                  </span>
                </div>

                <button
                  onClick={handleAutoBalance}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] shadow-sm cursor-pointer"
                  title="Автоматичний LPT-розподіл ліній між L1, L2, L3 для усунення несиметрії навантаження"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>⚡ Оптимізувати баланс фаз (ПУЕ)</span>
                </button>
              </div>

              {balanceNotification && (
                <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{balanceNotification}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                  <div className="text-neutral-400 text-[10px]">Фаза L1</div>
                  <div className="text-sm font-bold text-neutral-100">
                    {(summary.phaseBalance.l1Watts / 1000).toFixed(2)} кВт / {summary.phaseBalance.l1CurrentA} А
                  </div>
                </div>
                <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                  <div className="text-neutral-400 text-[10px]">Фаза L2</div>
                  <div className="text-sm font-bold text-neutral-100">
                    {(summary.phaseBalance.l2Watts / 1000).toFixed(2)} кВт / {summary.phaseBalance.l2CurrentA} А
                  </div>
                </div>
                <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800">
                  <div className="text-neutral-400 text-[10px]">Фаза L3</div>
                  <div className="text-sm font-bold text-neutral-100">
                    {(summary.phaseBalance.l3Watts / 1000).toFixed(2)} кВт / {summary.phaseBalance.l3CurrentA} А
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Multi-floor & Riser Summary Bar */}
          {aggregated.syncedFloors.length > 1 && (
            <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-sky-300 font-semibold">
                <Building2 className="w-4 h-4 text-sky-400" />
                <span>Багатоповерховий розрахунок ({aggregated.syncedFloors.length} поверхи):</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {aggregated.floorSummaries.map((fl) => (
                  <span key={fl.floorId} className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-200">
                    {fl.boardName} ({fl.floorName}): {(fl.installedWatts / 1000).toFixed(2)} кВт · {fl.cableLengthM}м
                  </span>
                ))}
                {aggregated.riserFeeders.map((r) => (
                  <span key={r.id} className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-300">
                    Стояк {r.fromBoard}➔{r.toBoard}: {getCableTitleUk(r.cableType)} ({r.lengthM}м, {r.breakerRatingA}А)
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'enclosure' ? (
            <EnclosureBuilderModal project={project} onUpdateProject={onUpdateProject} embedded={true} />
          ) : activeTab === 'schematic' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Векторне креслення принципової однолінійної схеми щита
                </span>
                <span className="text-xs text-neutral-400">
                  Згенеровано за дійсними параметрами проекту
                </span>
              </div>
              <SingleLineSchematicSvg project={project} demandFactor={demandFactor} />
            </div>
          ) : activeTab === 'cable-schedule' ? (
            /* Cable Schedule View */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                    Кабельний журнал проекту (Форма за ДСТУ Б А.2.4-4:2009)
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Повний перелік кабельних відрізків, маркування, трас, способів монтажу та розрахункових параметрів
                  </p>
                </div>

                <button
                  onClick={handleExportCableScheduleCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Експорт у CSV / Excel</span>
                </button>
              </div>

              {/* Cable summary pill cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {Object.entries(cableTotalsByType).map(([title, length]) => (
                  <div key={title} className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs">
                    <span className="text-[10px] text-neutral-400 block truncate">{title}</span>
                    <span className="text-sm font-bold font-mono text-sky-400">
                      {Math.round(length)} <span className="text-[10px] text-neutral-400 font-sans">м</span>
                    </span>
                    <span className="text-[9px] text-neutral-500 block">+10% запас ДСТУ</span>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-neutral-900 border-b border-neutral-800 text-[11px] text-neutral-400">
                      <tr>
                        <th className="py-2 px-3 font-medium">Марка</th>
                        <th className="py-2 px-3 font-medium">Група</th>
                        <th className="py-2 px-3 font-medium">Початок траси</th>
                        <th className="py-2 px-3 font-medium">Кінець траси</th>
                        <th className="py-2 px-3 font-medium">Тип кабелю</th>
                        <th className="py-2 px-3 font-medium">Спосіб прокладання</th>
                        <th className="py-2 px-3 text-right font-medium">Довжина, м</th>
                        <th className="py-2 px-3 text-right font-medium">З запасом (+10%)</th>
                        <th className="py-2 px-3 text-right font-medium">Струм Ib</th>
                        <th className="py-2 px-3 text-right font-medium">ΔU (%)</th>
                        <th className="py-2 px-3 text-right font-medium">Струм КЗ / ПУЕ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                      {cableScheduleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-neutral-900/40 transition-colors">
                          <td className="py-1.5 px-3 font-bold text-sky-400">{row.tag}</td>
                          <td className="py-1.5 px-3 text-neutral-300 font-sans">Гр. {row.circuitNumber}</td>
                          <td className="py-1.5 px-3 text-neutral-300 font-sans truncate max-w-[150px]" title={row.fromNode}>
                            {row.fromNode}
                          </td>
                          <td className="py-1.5 px-3 text-neutral-200 font-sans truncate max-w-[180px]" title={row.toNode}>
                            {row.toNode}
                          </td>
                          <td className="py-1.5 px-3 text-neutral-300">{row.cableTitle}</td>
                          <td className="py-1.5 px-3 text-neutral-400 font-sans">{row.conduitType}</td>
                          <td className="py-1.5 px-3 text-right text-neutral-400 tabular-nums">{row.lengthM}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-neutral-100 tabular-nums">
                            {row.totalLengthMWithMargin} м
                          </td>
                          <td className="py-1.5 px-3 text-right text-neutral-300 tabular-nums">{row.currentA} А</td>
                          <td className="py-1.5 px-3 text-right tabular-nums">
                            <span className={row.vDropPercent <= 4 ? 'text-neutral-300' : 'text-amber-400 font-bold'}>
                              {row.vDropPercent}%
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right tabular-nums">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                row.isTrippingSafe
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                              title={`Струм КЗ ${row.ikzA} А. ${row.isTrippingSafe ? 'Відповідає ПУЕ §1.7.79 (t <= 0.4с)' : 'Чутливість знижена'}`}
                            >
                              {row.ikzA} А {row.isTrippingSafe ? '✓' : '⚠'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Circuit Schedule Table */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Відомість ліній та захисної автоматики
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    ({project.circuits.length} ліній)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 rounded-lg text-xs font-medium transition-colors"
                    title="Імпорт таблиці груп з Excel або CSV файлу"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Імпорт з Excel</span>
                  </button>
                  <button
                    onClick={handleExportCircuitsCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
                    title="Експорт таблиці груп у формат CSV / Excel (UTF-8 BOM)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Експорт .csv</span>
                  </button>
                  <button
                    onClick={handleAddCircuit}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Додати лінію</span>
                  </button>
                </div>
              </div>

              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 bg-neutral-900/60 text-[11px] text-neutral-400">
                      <th className="py-2.5 px-3 w-12 font-medium">№</th>
                      <th className="py-2.5 px-3 font-medium">Найменування лінії</th>
                      <th className="py-2.5 px-3 w-28 font-medium">Кабель</th>
                      <th className="py-2.5 px-3 w-32 font-medium">Автомат (Крива + In)</th>
                      <th className="py-2.5 px-3 w-28 font-medium">Диф. захист (ПЗВ)</th>
                      {is3Ph && <th className="py-2.5 px-3 w-16 font-medium">Фаза</th>}
                      <th className="py-2.5 px-3 w-20 font-medium text-right">Потужність</th>
                      <th className="py-2.5 px-3 w-16 font-medium text-right">Струм Ib</th>
                      <th className="py-2.5 px-3 w-20 font-medium text-right">Падіння ΔU</th>
                      <th className="py-2.5 px-3 w-24 font-medium text-right">Струм КЗ (ПУЕ)</th>
                      <th className="py-2.5 px-3 w-12 text-center font-medium">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {project.circuits.map((circuit, idx) => {
                      const analysis = circuitLoads[idx];
                      const isExpanded = expandedCircuitId === circuit.id;
                      return (
                        <React.Fragment key={circuit.id}>
                        <tr className="hover:bg-neutral-900/30 transition-colors">
                          <td className="py-2 px-3 font-mono font-semibold text-neutral-400">
                            {circuit.number}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={circuit.name}
                              onChange={(e) =>
                                handleUpdateCircuit(idx, { ...circuit, name: e.target.value })
                              }
                              className="w-full bg-transparent border-0 text-neutral-100 focus:outline-none focus:bg-neutral-900 px-1 py-0.5 rounded"
                            />
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {analysis.overallStatus === 'uncalculated' ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 font-semibold">
                                  Не розраховано
                                </span>
                              ) : analysis.overallStatus === 'error' ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                                  Помилка ПУЕ
                                </span>
                              ) : analysis.overallStatus === 'warning' ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                                  Попередження
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                                  ПУЕ OK
                                </span>
                              )}
                              {analysis.deratingFactorTotal < 1 && (
                                <span className="text-[9px] font-mono text-neutral-500" title="Сумарний поправковий коефіцієнт кабелю Km·Kg·Kt">
                                  K={analysis.deratingFactorTotal} (Idd={analysis.cableAmpacityA}A)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={circuit.cableType}
                              onChange={(e) =>
                                handleUpdateCircuit(idx, {
                                  ...circuit,
                                  cableType: e.target.value as any,
                                })
                              }
                              className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-1 text-[11px] text-neutral-200"
                            >
                              <option value="VVGng_3x1.5">ВВГнгд 3x1.5</option>
                              <option value="VVGng_3x2.5">ВВГнгд 3x2.5</option>
                              <option value="VVGng_3x4">ВВГнгд 3x4</option>
                              <option value="VVGng_3x6">ВВГнгд 3x6</option>
                              <option value="VVGng_5x2.5">ВВГнгд 5x2.5 (3P)</option>
                              <option value="VVGng_5x4">ВВГнгд 5x4 (3P)</option>
                              <option value="VVGng_5x6">ВВГнгд 5x6 (3P)</option>
                              <option value="VVGng_5x10">ВВГнгд 5x10 (3P)</option>
                              <option value="FTP_Cat5e">FTP Cat5e</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1">
                              <select
                                value={circuit.breakerCurve || 'C'}
                                onChange={(e) =>
                                  handleUpdateCircuit(idx, {
                                    ...circuit,
                                    breakerCurve: e.target.value as any,
                                  })
                                }
                                className="bg-neutral-900 border border-neutral-800 rounded px-1 py-1 text-[11px] text-neutral-200 font-mono"
                                title="Характеристика спрацювання електромагнітного розчіплювача"
                              >
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                              </select>
                              <select
                                value={circuit.breakerRatingA}
                                onChange={(e) =>
                                  handleUpdateCircuit(idx, {
                                    ...circuit,
                                    breakerRatingA: Number(e.target.value) as any,
                                  })
                                }
                                className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-1 text-[11px] text-neutral-200 font-mono"
                              >
                                <option value="6">6A</option>
                                <option value="10">10A</option>
                                <option value="16">16A</option>
                                <option value="20">20A</option>
                                <option value="25">25A</option>
                                <option value="32">32A</option>
                                <option value="40">40A</option>
                                <option value="50">50A</option>
                                <option value="63">63A</option>
                              </select>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={circuit.rcdType}
                              onChange={(e) =>
                                handleUpdateCircuit(idx, {
                                  ...circuit,
                                  rcdType: e.target.value as any,
                                })
                              }
                              className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-1 text-[11px] text-neutral-200"
                            >
                              <option value="none">Ні</option>
                              <option value="rcd_30ma">ПЗВ 30мА</option>
                              <option value="rcd_10ma">ПЗВ 10мА (волога)</option>
                              <option value="rcbo_30ma">Дифавтомат 30мА</option>
                              <option value="rcbo_10ma">Дифавтомат 10мА</option>
                            </select>
                          </td>
                          {is3Ph && (
                            <td className="py-2 px-3">
                              <select
                                value={circuit.phase || 'L1'}
                                onChange={(e) =>
                                  handleUpdateCircuit(idx, {
                                    ...circuit,
                                    phase: e.target.value as any,
                                  })
                                }
                                className="bg-neutral-900 border border-neutral-800 rounded px-1 py-0.5 text-[11px] text-neutral-200 font-mono"
                              >
                                <option value="L1">L1</option>
                                <option value="L2">L2</option>
                                <option value="L3">L3</option>
                                <option value="3P">3P</option>
                              </select>
                            </td>
                          )}
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {analysis.overallStatus === 'uncalculated' ? (
                              <span className="text-neutral-500 text-[11px]">—</span>
                            ) : (
                              <span
                                className={
                                  analysis.isBreakerOverloaded
                                    ? 'text-rose-400 font-bold'
                                    : 'text-neutral-200'
                                }
                              >
                                {(analysis.totalInstalledWatts / 1000).toFixed(2)} кВт
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-neutral-300">
                            {analysis.overallStatus === 'uncalculated' ? '—' : `${analysis.calculatedCurrentA} A`}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {analysis.overallStatus === 'uncalculated' ? (
                              <span className="text-neutral-500">—</span>
                            ) : (
                              <span
                                className={
                                  analysis.voltageDrop.isAcceptable
                                    ? 'text-neutral-300'
                                    : 'text-amber-400 font-bold'
                                }
                              >
                                {analysis.voltageDrop.deltaPercent}%
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            <div className="flex flex-col items-end">
                              <span className="text-neutral-200 text-xs">
                                {analysis.shortCircuit.ikzCurrentA} A
                              </span>
                              <span
                                className={`text-[10px] ${
                                  analysis.shortCircuit.isTrippingAssured
                                    ? 'text-emerald-400'
                                    : 'text-amber-400 font-semibold'
                                }`}
                                title={`Струм КЗ ${analysis.shortCircuit.ikzCurrentA}A, поріг розчіплювача 1.1·Iinst = ${analysis.shortCircuit.requiredIkzA}A`}
                              >
                                {analysis.shortCircuit.isTrippingAssured ? '✓ ≤ 0.4с' : '⚠ повільно'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setExpandedCircuitId(isExpanded ? null : circuit.id)}
                                className={`p-1 rounded transition-colors ${isExpanded ? 'bg-sky-500/20 text-sky-400' : 'text-neutral-400 hover:text-sky-300'}`}
                                title="Формули, коефіцієнти прокладання та прозорість розрахунку"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDeleteCircuit(circuit.id)}
                                className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                                title="Видалити групу"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-neutral-900/60">
                            <td colSpan={is3Ph ? 11 : 10} className="p-4 border-t border-neutral-800/80">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-[11px]">
                                {/* Column 1: Editable Derating Factors */}
                                <div className="space-y-2.5 p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                                  <div className="font-bold text-sky-400 uppercase tracking-wider text-[10px]">
                                    Умови прокладання кабелю (ПУЕ Табл. 1.3.4 / 1.3.26)
                                  </div>
                                  <div>
                                    <label className="text-neutral-400 block mb-1">Спосіб прокладання (Km):</label>
                                    <select
                                      value={circuit.installationMethod || 'flush_plaster'}
                                      onChange={(e) =>
                                        handleUpdateCircuit(idx, { ...circuit, installationMethod: e.target.value as any })
                                      }
                                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
                                    >
                                      <option value="open_air">Відкрито у повітрі (Km=1.00)</option>
                                      <option value="flush_plaster">У штробі під штукатуркою (Km=0.95)</option>
                                      <option value="conduit_wall">У ПВХ-гофрі за стелею/в стіні (Km=0.88)</option>
                                      <option value="conduit_insulation">У гофрі в теплоізоляції/мінваті (Km=0.72)</option>
                                    </select>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-neutral-400 block mb-1">Коеф. пучка (Kg):</label>
                                      <input
                                        type="number"
                                        step="0.05"
                                        min="0.5"
                                        max="1.0"
                                        value={circuit.groupingFactorKg ?? 1.0}
                                        onChange={(e) =>
                                          handleUpdateCircuit(idx, { ...circuit, groupingFactorKg: Math.min(1, Math.max(0.5, Number(e.target.value) || 1)) })
                                        }
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-200 font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-neutral-400 block mb-1">Темп. °C (Kt):</label>
                                      <input
                                        type="number"
                                        step="5"
                                        min="15"
                                        max="50"
                                        value={circuit.ambientTempC ?? 25}
                                        onChange={(e) =>
                                          handleUpdateCircuit(idx, { ...circuit, ambientTempC: Number(e.target.value) || 25 })
                                        }
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-200 font-mono"
                                      />
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-neutral-400 pt-1 border-t border-neutral-800">
                                    Статус: <strong className="text-neutral-200">{analysis.statusMessage}</strong>
                                  </div>
                                </div>

                                {/* Column 2: Inputs & Formulas */}
                                <div className="space-y-2 p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                                  <div className="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">
                                    Вхідні дані та формули розрахунку
                                  </div>
                                  <ul className="space-y-1 text-neutral-300 font-mono text-[10px]">
                                    {analysis.calculationDetails.inputs.map((inp, i) => (
                                      <li key={i}>• {inp}</li>
                                    ))}
                                  </ul>
                                  <div className="pt-1.5 border-t border-neutral-800 space-y-1 text-sky-300 font-mono text-[10px]">
                                    {analysis.calculationDetails.formulas.map((f, i) => (
                                      <div key={i}>{f}</div>
                                    ))}
                                  </div>
                                </div>

                                {/* Column 3: Assumptions & Result */}
                                <div className="space-y-2 p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                                  <div className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                                    Припущення та підсумок
                                  </div>
                                  <ul className="space-y-1 text-neutral-400 text-[10px] leading-relaxed">
                                    {analysis.calculationDetails.assumptions.map((a, i) => (
                                      <li key={i}>— {a}</li>
                                    ))}
                                  </ul>
                                  <div className="mt-2 p-2 rounded bg-neutral-900 border border-neutral-700 font-mono text-[10.5px] text-neutral-100">
                                    {analysis.calculationDetails.resultSummary}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between">
          <div className="text-xs text-neutral-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Розрахунки базуються на 230 В / 400 В (ПУЕ-2017 Табл. 1.3.4, §1.7.79, ДБН В.2.5-23:2010, ДСТУ Б А.2.4-4:2009)
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold rounded-lg text-xs transition-colors"
          >
            Готово
          </button>
        </div>

        {/* Modal for Excel/CSV Import */}
        {isImportModalOpen && (
          <ImportCircuitsModal
            existingCircuits={project.circuits}
            onImport={handleApplyImportedCircuits}
            onClose={() => setIsImportModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
};
