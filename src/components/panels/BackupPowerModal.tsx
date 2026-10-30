import React, { useState } from 'react';
import { BatteryCharging, Zap, ShieldCheck, Clock, Sliders, Check, RefreshCw, Power } from 'lucide-react';
import { CadProject, BackupSystemConfig, ElectricalElement, CircuitGroup } from '../../types/cad';

interface BackupPowerModalProps {
  project: CadProject;
  onUpdateBackupConfig: (config: BackupSystemConfig) => void;
  onUpdateProjectElements: (elements: ElectricalElement[], circuits: CircuitGroup[]) => void;
  onClose: () => void;
}

const DEFAULT_BACKUP_CONFIG: BackupSystemConfig = {
  enabled: true,
  type: 'hybrid_inverter',
  inverterPowerW: 5000,
  batteryCapacityWh: 5120, // 5.12 kWh (48V 100Ah LiFePO4)
  batteryChemistry: 'lifepo4',
  batteryVoltageV: 51.2,
  depthOfDischargePercent: 90,
  inverterEfficiencyPercent: 93,
  atsTransferTimeMs: 10,
  generatorPowerW: 5500,
  mode: 'standard',
};

export const BackupPowerModal: React.FC<BackupPowerModalProps> = ({
  project,
  onUpdateBackupConfig,
  onUpdateProjectElements,
  onClose,
}) => {
  const [config, setConfig] = useState<BackupSystemConfig>(
    project.backupSystem || DEFAULT_BACKUP_CONFIG
  );
  const [elements, setElements] = useState<ElectricalElement[]>(project.elements);
  const [circuits, setCircuits] = useState<CircuitGroup[]>(project.circuits);
  const [simulationMode, setSimulationMode] = useState<'standard' | 'economy' | 'peak'>('standard');

  // Calculate connected priority loads
  const priorityElements = elements.filter(
    (el) => el.isBackupPriority || circuits.find((c) => c.id === el.circuitId)?.isBackupPriority
  );

  const totalPriorityNominalW = priorityElements.reduce((sum, el) => sum + (el.powerWatts || 150), 0);

  // Duty cycles for realistic energy calculations:
  // - Refrigerator: runs ~35% of time
  // - Boiler/Heater: runs ~40% of time in winter
  // - Router/ONU/Server: runs 100%
  // - LED lighting: ~50% in standard, 20% in economy
  // - TV/Laptop: ~50%
  const calculateAverageWatts = (mode: 'standard' | 'economy' | 'peak') => {
    if (mode === 'peak') {
      return totalPriorityNominalW * 0.95; // almost everything active
    }

    return priorityElements.reduce((sum, el) => {
      const p = el.powerWatts || 150;
      let duty = 0.5;

      if (el.name.toLowerCase().includes('холодильник')) duty = 0.35;
      else if (el.name.toLowerCase().includes('бойлер') || el.name.toLowerCase().includes('котел')) duty = mode === 'economy' ? 0.25 : 0.45;
      else if (el.name.toLowerCase().includes('інтернет') || el.name.toLowerCase().includes('роутер')) duty = 1.0;
      else if (el.category === 'light') duty = mode === 'economy' ? 0.2 : 0.45;
      else if (el.category === 'socket') duty = mode === 'economy' ? 0.3 : 0.5;

      return sum + p * duty;
    }, 0);
  };

  const avgWatts = Math.max(calculateAverageWatts(simulationMode), 40); // minimum 40W baseline (inverter self-consumption + standby)

  // Usable battery energy in Wh
  const usableWh =
    config.batteryCapacityWh *
    (config.depthOfDischargePercent / 100) *
    (config.inverterEfficiencyPercent / 100);

  // Runtime in hours
  const runtimeHours = usableWh / avgWatts;
  const runtimeWholeHours = Math.floor(runtimeHours);
  const runtimeMinutes = Math.round((runtimeHours - runtimeWholeHours) * 60);

  // Toggle individual element priority
  const handleToggleElementPriority = (elId: string) => {
    const updated = elements.map((el) => {
      if (el.id === elId) {
        return { ...el, isBackupPriority: !el.isBackupPriority };
      }
      return el;
    });
    setElements(updated);
  };

  // Toggle whole circuit priority
  const handleToggleCircuitPriority = (circuitId: string) => {
    const updatedCircuits = circuits.map((c) => {
      if (c.id === circuitId) {
        return { ...c, isBackupPriority: !c.isBackupPriority };
      }
      return c;
    });
    setCircuits(updatedCircuits);
  };

  // Preset: Recommended Blackout Emergency Essentials
  const applyRecommendedBlackoutKit = () => {
    const updated = elements.map((el) => {
      const name = el.name.toLowerCase();
      const isEssential =
        name.includes('холодильник') ||
        name.includes('котел') ||
        name.includes('бойлер') ||
        name.includes('інтернет') ||
        name.includes('роутер') ||
        name.includes('rj45') ||
        name.includes('насос') ||
        (el.category === 'light' && (name.includes('коридор') || name.includes('кухн') || name.includes('санвуз')));
      return { ...el, isBackupPriority: isEssential };
    });
    setElements(updated);
  };

  // Save changes
  const handleSave = () => {
    onUpdateBackupConfig(config);
    onUpdateProjectElements(elements, circuits);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BatteryCharging className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-display">
                  Резервне живлення та автономність (ДБЖ / Блекаут)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LiFePO4 + Інвертор
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Розрахунок автономного часу роботи, підбір ємності АКБ та конфігурація пріоритетної лінії
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 cols): Equipment & Battery Parameters */}
          <div className="lg:col-span-5 space-y-5">
            {/* System Type Selector */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
              <label className="text-xs font-bold text-neutral-200 block">Тип системи резервування</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: 'hybrid_inverter',
                    name: 'Гібридний інвертор',
                    desc: 'Deye/Growatt (UPS 10мс)',
                    badge: 'Повний дім',
                  },
                  {
                    id: 'power_station',
                    name: 'Зарядна станція',
                    desc: 'EcoFlow / Bluetti',
                    badge: 'Мобільна',
                  },
                  {
                    id: 'ats_generator',
                    name: 'АВР + Генератор',
                    desc: 'Автозапуск 5.5 кВт',
                    badge: 'Паливо',
                  },
                  {
                    id: 'manual_switch',
                    name: 'Перемикач I-0-II',
                    desc: 'Ручний ввод резерву',
                    badge: 'Економ',
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setConfig({ ...config, type: item.id as any })}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      config.type === item.id
                        ? 'bg-emerald-950/40 border-emerald-500/80 text-neutral-100 shadow-sm'
                        : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-200">{item.name}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-800 text-neutral-400">
                        {item.badge}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-1">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Battery Specs */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Параметри акумуляторної батареї
                </label>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  {(config.batteryCapacityWh / 1000).toFixed(2)} кВт·год
                </span>
              </div>

              {/* Quick Capacity Presets */}
              <div>
                <label className="text-[11px] text-neutral-400 block mb-1.5">Ємність батарейного блоку</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '2.56 кВт·г', wh: 2560 },
                    { label: '5.12 кВт·г', wh: 5120 },
                    { label: '10.24 кВт·г', wh: 10240 },
                    { label: '15.36 кВт·г', wh: 15360 },
                  ].map((p) => (
                    <button
                      key={p.wh}
                      onClick={() => setConfig({ ...config, batteryCapacityWh: p.wh })}
                      className={`py-1.5 text-xs rounded border font-mono transition-colors ${
                        config.batteryCapacityWh === p.wh
                          ? 'bg-emerald-950/70 border-emerald-500 text-emerald-400 font-bold'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chemistry & Inverter Power */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Хімія акумулятора</label>
                  <select
                    value={config.batteryChemistry}
                    onChange={(e) => {
                      const chem = e.target.value as any;
                      const dod = chem === 'lifepo4' ? 90 : chem === 'li_ion' ? 80 : 50;
                      setConfig({ ...config, batteryChemistry: chem, depthOfDischargePercent: dod });
                    }}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-200 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="lifepo4">LiFePO4 (90% розряд, 6000 ц)</option>
                    <option value="li_ion">Li-ion NMC (80% розряд)</option>
                    <option value="agm_gel">AGM / GEL свинцевий (50%)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Потужність інвертора</label>
                  <select
                    value={config.inverterPowerW}
                    onChange={(e) => setConfig({ ...config, inverterPowerW: Number(e.target.value) })}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value={3000}>3.0 кВт (1-фазний)</option>
                    <option value={5000}>5.0 кВт (Стандарт)</option>
                    <option value={6000}>6.0 кВт (Deye 6K)</option>
                    <option value={8000}>8.0 кВт (Потужний)</option>
                    <option value={12000}>12.0 кВт (3-фазний)</option>
                  </select>
                </div>
              </div>

              {/* Technical Efficiency & Safety Margins */}
              <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-2 gap-3 text-[11px]">
                <div className="text-neutral-400">
                  Глибина розряду (DoD):{' '}
                  <span className="text-neutral-200 font-mono font-semibold">
                    {config.depthOfDischargePercent}%
                  </span>
                </div>
                <div className="text-neutral-400">
                  ККД інвертора (η):{' '}
                  <span className="text-neutral-200 font-mono font-semibold">
                    {config.inverterEfficiencyPercent}%
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Backup Single-Line Path */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
              <span className="text-xs font-bold text-neutral-200 block mb-2.5">
                Архітектура резервної лінії в щиті (ВРП)
              </span>
              <div className="space-y-1.5 text-[11px] font-mono">
                <div className="p-2 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-between text-neutral-300">
                  <span>1. Ввідна міська мережа (230В)</span>
                  <span className="text-sky-400">Ввід 32A / 40A</span>
                </div>
                <div className="flex justify-center text-neutral-600">↓</div>
                <div className="p-2 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-between text-neutral-300">
                  <span>2. Реле контролю напруги (ZUBR / Новатек)</span>
                  <span className="text-amber-400">Захист 175-255В</span>
                </div>
                <div className="flex justify-center text-neutral-600">↓</div>
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between text-emerald-300">
                  <span>3. Інвертор 5 кВт + АКБ LiFePO4</span>
                  <span className="text-emerald-400 font-bold">ДБЖ / UPS</span>
                </div>
                <div className="flex justify-center text-emerald-600">↓</div>
                <div className="p-2 rounded bg-emerald-900/30 border border-emerald-700/50 flex items-center justify-between text-neutral-100">
                  <span>4. Гарантована шина споживачів (Блекаут)</span>
                  <span className="text-emerald-300 font-bold">{priorityElements.length} приладів</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Autonomy Simulation & Priority Consumers */}
          <div className="lg:col-span-7 space-y-5">
            {/* Top Autonomy Hero Card */}
            <div className="bg-gradient-to-br from-emerald-950/40 via-neutral-900 to-neutral-950 border border-emerald-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Розрахунковий час автономної роботи
                  </div>
                  <div className="text-4xl font-extrabold text-white font-mono mt-2 tracking-tight">
                    {runtimeWholeHours} <span className="text-lg font-normal text-neutral-400">год</span>{' '}
                    {runtimeMinutes} <span className="text-lg font-normal text-neutral-400">хв</span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    При середньому навантаженні пріоритетної лінії:{' '}
                    <span className="text-neutral-100 font-bold font-mono">{Math.round(avgWatts)} Вт</span> (
                    {Math.round(totalPriorityNominalW)} Вт пікове підключене)
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-neutral-400">Корисна ємність АКБ</div>
                  <div className="text-lg font-mono font-bold text-emerald-300">
                    {(usableWh / 1000).toFixed(2)} кВт·г
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    з урахуванням ККД 93% та 90% DoD
                  </div>
                </div>
              </div>

              {/* Simulation Mode Toggle */}
              <div className="mt-4 pt-4 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                <span className="text-xs text-neutral-400">Профіль споживання:</span>
                <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                  <button
                    onClick={() => setSimulationMode('economy')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      simulationMode === 'economy'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Економний (черговий)
                  </button>
                  <button
                    onClick={() => setSimulationMode('standard')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      simulationMode === 'standard'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Стандартний (комфорт)
                  </button>
                  <button
                    onClick={() => setSimulationMode('peak')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      simulationMode === 'peak'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Піковий
                  </button>
                </div>
              </div>
            </div>

            {/* Circuit & Priority Consumer Manager */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col h-[400px]">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
                <div>
                  <h3 className="text-xs font-bold text-neutral-200">
                    Вибір пріоритетних споживачів (Гарантоване живлення)
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Обрано {priorityElements.length} з {elements.length} приладів
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={applyRecommendedBlackoutKit}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Набір для блекауту
                  </button>
                  <button
                    onClick={() => {
                      const cleared = elements.map((e) => ({ ...e, isBackupPriority: false }));
                      setElements(cleared);
                    }}
                    className="px-2 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 text-xs transition-colors"
                  >
                    Зняти всі
                  </button>
                </div>
              </div>

              {/* Priority Groups Toggle */}
              <div className="py-2.5 border-b border-neutral-800/80 shrink-0">
                <span className="text-[11px] text-neutral-400 block mb-1.5 font-medium">
                  Групи автоматів щита (резервування всієї лінії):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {circuits.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleToggleCircuitPriority(c.id)}
                      className={`px-2.5 py-1 rounded text-xs border flex items-center gap-1.5 transition-colors ${
                        c.isBackupPriority
                          ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <span>Гр.{c.number}: {c.name}</span>
                      {c.isBackupPriority && <span className="text-emerald-400">⚡</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Elements List with Checkboxes */}
              <div className="flex-1 overflow-y-auto divide-y divide-neutral-900 mt-1">
                {elements.map((el) => {
                  const circuit = circuits.find((c) => c.id === el.circuitId);
                  const isChecked = Boolean(el.isBackupPriority || circuit?.isBackupPriority);
                  const isInherited = Boolean(circuit?.isBackupPriority);

                  return (
                    <div
                      key={el.id}
                      className="py-2 px-1 flex items-center justify-between hover:bg-neutral-900/50 rounded transition-colors group"
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isInherited}
                          onChange={() => handleToggleElementPriority(el.id)}
                          className="rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-neutral-200">{el.name}</span>
                            {isChecked && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">
                                ⚡ ДБЖ
                              </span>
                            )}
                            {isInherited && (
                              <span className="text-[10px] text-neutral-500">
                                (від Гр.{circuit?.number})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {circuit ? `Гр.${circuit.number} (${circuit.name})` : 'Без групи'} · h=+
                            {el.mountingHeightMm} мм
                          </div>
                        </div>
                      </label>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono text-neutral-300 font-semibold">
                          {el.powerWatts || 150} Вт
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Конфігурація автоматично оновлює розрахунок навантаження щита та кошторис обладнання
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
            >
              Скасувати
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-lg text-xs transition-colors shadow-sm shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Зберегти налаштування ДБЖ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
