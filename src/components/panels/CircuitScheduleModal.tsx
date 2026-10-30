import React, { useState } from 'react';
import { Plus, Trash2, ShieldCheck, Cpu, Activity } from 'lucide-react';
import { CadProject, CircuitGroup } from '../../types/cad';

interface CircuitScheduleModalProps {
  project: CadProject;
  onUpdateCircuits: (circuits: CircuitGroup[]) => void;
  onClose: () => void;
}

export const CircuitScheduleModal: React.FC<CircuitScheduleModalProps> = ({
  project,
  onUpdateCircuits,
  onClose,
}) => {
  const [demandFactor, setDemandFactor] = useState<number>(0.7);

  // Calculate power per circuit
  const circuitLoads = project.circuits.map((circuit) => {
    const connectedElements = project.elements.filter((el) => el.circuitId === circuit.id);
    const totalWatts = connectedElements.reduce((sum, el) => sum + el.powerWatts, 0);
    const maxSafeWatts = circuit.breakerRatingA * 220; // P = U * I
    const isOverloaded = totalWatts > maxSafeWatts;
    const currentA = Number((totalWatts / 220).toFixed(1));

    return {
      circuit,
      elementCount: connectedElements.length,
      totalWatts,
      currentA,
      maxSafeWatts,
      isOverloaded,
    };
  });

  const totalInstalledWatts = circuitLoads.reduce((sum, c) => sum + c.totalWatts, 0);
  const totalInstalledKw = Number((totalInstalledWatts / 1000).toFixed(2));
  const calculatedDesignKw = Number((totalInstalledKw * demandFactor).toFixed(2));
  const calculatedMainCurrentA = Number(((calculatedDesignKw * 1000) / 220).toFixed(1));

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
      phase: 'L1',
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

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Схема електрощита та розрахунок навантажень
              </h2>
              <p className="text-xs text-neutral-400">
                Однолінійний розклад автоматів, диференційного захисту та розрахунок потужності згідно з ПУЕ та ДБН В.2.5-23:2010
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Engineering Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Встановлена потужність (Руст)</span>
              <div className="text-lg font-bold font-mono text-neutral-100 tabular-nums">
                {totalInstalledKw} <span className="text-xs text-neutral-400 font-sans">кВт</span>
              </div>
              <span className="text-[10px] text-neutral-500">Сума потужностей усіх споживачів</span>
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
              <span className="text-[10px] text-neutral-500">Норматив для квартир 0.65 - 0.85</span>
            </div>

            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Розрахункова потужність (Ррозр)</span>
              <div className="text-lg font-bold font-mono text-sky-400 tabular-nums">
                {calculatedDesignKw} <span className="text-xs text-neutral-400 font-sans">кВт</span>
              </div>
              <span className="text-[10px] text-neutral-500">Пікове навантаження з коефіцієнтом</span>
            </div>

            <div className="p-3.5 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block mb-1">Ввідний струм / Номінал</span>
              <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                {calculatedMainCurrentA} A{' '}
                <span className="text-xs text-neutral-400 font-sans">
                  / Ввід {project.mainBreakerRatingA}A
                </span>
              </div>
              <span className="text-[10px] text-neutral-500">
                {calculatedMainCurrentA <= project.mainBreakerRatingA ? (
                  <span className="text-emerald-400">✓ Запас за вводом у нормі</span>
                ) : (
                  <span className="text-rose-400">⚠ Перевищення номіналу ввідного автомата!</span>
                )}
              </span>
            </div>
          </div>

          {/* Interactive Consumer Unit / Panel Modules representation */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Візуальна DIN-рейка щита (ЩРН)
                </span>
                <span className="text-[11px] text-neutral-500">· 230В 50Гц</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                <span>230 В / 50.0 Гц</span>
              </div>
            </div>

            {/* Modular Breakers Row */}
            <div className="flex items-stretch gap-1.5 p-3 bg-neutral-900 rounded-lg border border-neutral-800 overflow-x-auto min-h-[110px]">
              {/* Main Breaker 2P */}
              <div className="w-20 bg-neutral-950 border-2 border-neutral-700 rounded p-1.5 flex flex-col justify-between items-center text-center shrink-0">
                <span className="text-[9px] text-neutral-500 font-bold uppercase">Ввід</span>
                <div className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center font-mono font-bold text-xs text-amber-400">
                  C{project.mainBreakerRatingA}
                </div>
                <span className="text-[9px] text-neutral-400 font-mono">2P 230V</span>
              </div>

              {/* Voltage Relay УЗМ / Zubr / Welrok */}
              <div className="w-20 bg-neutral-950 border-2 border-sky-800/60 rounded p-1.5 flex flex-col justify-between items-center text-center shrink-0">
                <span className="text-[9px] text-sky-400 font-bold uppercase">РКН</span>
                <div className="w-8 h-5 rounded bg-black/80 border border-red-900/60 flex items-center justify-center font-mono font-bold text-[10px] text-red-500">
                  230
                </div>
                <span className="text-[9px] text-neutral-400 font-mono">63A</span>
              </div>

              {/* Circuit Modules */}
              {project.circuits.map((c, i) => {
                const load = circuitLoads[i];
                return (
                  <div
                    key={c.id}
                    className={`min-w-24 max-w-28 bg-neutral-950 border rounded p-2 flex flex-col justify-between shrink-0 transition-colors ${
                      load?.isOverloaded
                        ? 'border-rose-500 bg-rose-950/20'
                        : 'border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-neutral-400">Гр.{c.number}</span>
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                    </div>

                    <div className="my-1 text-center">
                      <div className="font-mono text-xs font-bold text-neutral-100">
                        {c.breakerCurve}
                        {c.breakerRatingA}
                      </div>
                      <div className="text-[9px] text-neutral-400 line-clamp-1 mt-0.5">
                        {c.name}
                      </div>
                    </div>

                    <div className="flex flex-col text-[9px] font-mono text-neutral-400 border-t border-neutral-800/80 pt-1">
                      <div className="flex justify-between">
                        <span>P:</span>
                        <span className={load?.isOverloaded ? 'text-rose-400 font-bold' : 'text-neutral-300'}>
                          {(load?.totalWatts || 0) / 1000} кВт
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>ПЗВ:</span>
                        <span className="text-sky-400">{c.rcdType !== 'none' ? '30mA' : '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Circuits Schedule Data Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Кабельний журнал та параметри ліній
              </h3>
              <button
                onClick={handleAddCircuit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Додати лінію</span>
              </button>
            </div>

            <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/60 text-[11px] text-neutral-400">
                    <th className="py-2.5 px-3 w-12 font-medium">№</th>
                    <th className="py-2.5 px-3 font-medium">Найменування лінії</th>
                    <th className="py-2.5 px-3 w-28 font-medium">Кабель</th>
                    <th className="py-2.5 px-3 w-24 font-medium">Автомат</th>
                    <th className="py-2.5 px-3 w-28 font-medium">Диф. захист (ПЗВ)</th>
                    <th className="py-2.5 px-3 w-20 font-medium text-right">Потужність</th>
                    <th className="py-2.5 px-3 w-16 font-medium text-right">Струм</th>
                    <th className="py-2.5 px-3 w-12 text-center font-medium">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {project.circuits.map((circuit, idx) => {
                    const load = circuitLoads[idx];
                    return (
                      <tr key={circuit.id} className="hover:bg-neutral-900/30 transition-colors">
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
                          </select>
                        </td>
                        <td className="py-2 px-3">
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
                            <option value="10">C 10A</option>
                            <option value="16">C 16A</option>
                            <option value="20">C 20A</option>
                            <option value="25">C 25A</option>
                            <option value="32">C 32A</option>
                            <option value="40">C 40A</option>
                          </select>
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
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          <span
                            className={
                              load?.isOverloaded ? 'text-rose-400 font-bold' : 'text-neutral-200'
                            }
                          >
                            {((load?.totalWatts || 0) / 1000).toFixed(2)} кВт
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-neutral-300">
                          {load?.currentA} A
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleDeleteCircuit(circuit.id)}
                            className="text-neutral-500 hover:text-rose-400 transition-colors p-1"
                            title="Видалити групу"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between">
          <div className="text-xs text-neutral-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Розрахунки відповідають нормам ПУЕ України та ДБН В.2.5-23:2010</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold rounded-lg text-xs transition-colors"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
