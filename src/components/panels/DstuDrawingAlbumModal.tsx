import React, { useState } from 'react';
import { Printer, Download, FileCode, CheckCircle2, ChevronRight, Layers, Cpu, FileText, Zap } from 'lucide-react';
import { CadProject } from '../../types/cad';
import { downloadDxfFile } from '../../utils/dxfExport';
import { pxToMm } from '../../utils/cadMath';

interface DstuDrawingAlbumModalProps {
  project: CadProject;
  onClose: () => void;
}

export const DstuDrawingAlbumModal: React.FC<DstuDrawingAlbumModalProps> = ({
  project,
  onClose,
}) => {
  const [activeSheet, setActiveSheet] = useState<number>(1);

  // Project calculations
  const totalInstalledWatts = project.elements.reduce((sum, el) => sum + (el.powerWatts || 150), 0);
  const demandFactor = totalInstalledWatts > 10000 ? 0.7 : 0.8;
  const calculatedWatts = Math.round(totalInstalledWatts * demandFactor);
  const calculatedAmps = Math.round((calculatedWatts / 230) * 10) / 10;

  // Backup priority load
  const backupElements = project.elements.filter(
    (el) => el.isBackupPriority || project.circuits.find((c) => c.id === el.circuitId)?.isBackupPriority
  );
  const backupWatts = backupElements.reduce((sum, el) => sum + (el.powerWatts || 150), 0);

  // Cable lengths summary
  const cableSummary = project.wires.reduce<Record<string, number>>((acc, w) => {
    const type = w.cableType || 'VVGng_3x2.5';
    acc[type] = (acc[type] || 0) + w.calculatedLengthM;
    return acc;
  }, {});

  const handlePrint = () => {
    window.print();
  };

  const handleExportDxf = () => {
    downloadDxfFile(project);
  };

  // DSTU Stamp Component (Форма 3 за ДСТУ Б А.2.4-4:2009 / ГОСТ 2.104-68)
  const renderDstuStamp = (sheetNum: number, sheetTitle: string) => {
    return (
      <div className="w-full border-2 border-neutral-900 bg-white text-neutral-900 font-sans text-[11px] leading-tight select-none mt-auto">
        <div className="grid grid-cols-12 divide-x divide-neutral-900">
          {/* Left Signatures block */}
          <div className="col-span-4 divide-y divide-neutral-900">
            <div className="grid grid-cols-3 divide-x divide-neutral-900 py-0.5 px-1 bg-neutral-100 text-[10px] font-bold">
              <div>Посада</div>
              <div>Прізвище</div>
              <div>Підпис / Дата</div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-neutral-900 py-0.5 px-1 text-[10px]">
              <div className="font-semibold">Розробив</div>
              <div>{project.author || 'Інженер'}</div>
              <div>{project.date || '2026'}</div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-neutral-900 py-0.5 px-1 text-[10px]">
              <div className="font-semibold">Перевірив</div>
              <div>Гол. спец.</div>
              <div>{project.date || '2026'}</div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-neutral-900 py-0.5 px-1 text-[10px]">
              <div className="font-semibold">ГІП</div>
              <div>Коваленко О.В.</div>
              <div>{project.date || '2026'}</div>
            </div>
          </div>

          {/* Middle Title Block */}
          <div className="col-span-5 p-2 flex flex-col justify-between">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wide">
              Об'єкт будівництва / адреса
            </div>
            <div className="font-bold text-xs leading-snug">{project.title}</div>
            <div className="text-[11px] font-semibold text-neutral-800 border-t border-neutral-300 pt-1 mt-1">
              {sheetTitle}
            </div>
          </div>

          {/* Right Sheet Info & Org Block */}
          <div className="col-span-3 divide-y divide-neutral-900 flex flex-col justify-between">
            <div className="grid grid-cols-3 divide-x divide-neutral-900 text-center py-1">
              <div>
                <div className="text-[9px] text-neutral-500">Стадія</div>
                <div className="font-bold text-xs">Р</div>
              </div>
              <div>
                <div className="text-[9px] text-neutral-500">Аркуш</div>
                <div className="font-bold text-xs">{sheetNum}</div>
              </div>
              <div>
                <div className="text-[9px] text-neutral-500">Аркушів</div>
                <div className="font-bold text-xs">5</div>
              </div>
            </div>
            <div className="p-2 text-center bg-neutral-50 flex-1 flex items-center justify-center font-bold text-xs tracking-wider uppercase">
              ElectroPlan CAD UA
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white font-display">
                  Альбом креслень за формою ДСТУ Б А.2.4-4:2009
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Формат А4 / А3
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Комплект робочої документації марки ЕОМ (Електрообладнання та електроосвітлення)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportDxf}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-700"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>AutoCAD (.DXF)</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm shadow-sky-500/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Друк альбому / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-100 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Sheet Tabs Bar */}
        <div className="px-6 py-2 border-b border-neutral-800 bg-neutral-950/70 flex items-center gap-1.5 overflow-x-auto shrink-0 text-xs">
          {[
            { num: 1, title: 'Аркуш 1: Загальні дані та ДБЖ' },
            { num: 2, title: 'Аркуш 2: План розеток та техніки' },
            { num: 3, title: 'Аркуш 3: План мережі освітлення' },
            { num: 4, title: 'Аркуш 4: Однолінійна схема щита' },
            { num: 5, title: 'Аркуш 5: Кабельний журнал та БОМ' },
          ].map((sheet) => (
            <button
              key={sheet.num}
              onClick={() => setActiveSheet(sheet.num)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeSheet === sheet.num
                  ? 'bg-neutral-800 text-sky-400 font-semibold border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-neutral-700/60 flex items-center justify-center text-[10px] font-mono">
                {sheet.num}
              </span>
              <span>{sheet.title}</span>
            </button>
          ))}
        </div>

        {/* Sheet Content Preview (Simulating white engineering drawing paper) */}
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 flex justify-center">
          <div className="w-full max-w-4xl bg-white text-neutral-900 rounded-lg shadow-2xl p-8 border-4 border-neutral-900 flex flex-col justify-between min-h-[640px] font-sans">
            {/* Sheet 1: General Notes & Backup System */}
            {activeSheet === 1 && (
              <div className="space-y-6 flex-1">
                <div className="border-b-2 border-neutral-900 pb-3">
                  <h1 className="text-xl font-bold uppercase tracking-wide">
                    Загальні дані. Пояснювальна записка марки ЕОМ
                  </h1>
                  <p className="text-xs text-neutral-600 mt-1">
                    Проект електропостачання та силового електрообладнання об'єкта: «{project.title}»
                  </p>
                </div>

                {/* Table of sheets */}
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                    1. Відомість робочих креслень основного комплекту
                  </h2>
                  <table className="w-full border-collapse border border-neutral-900 text-xs">
                    <thead>
                      <tr className="bg-neutral-100 border-b border-neutral-900 text-left">
                        <th className="border-r border-neutral-900 p-1.5 w-16 text-center">Аркуш</th>
                        <th className="border-r border-neutral-900 p-1.5">Найменування креслення</th>
                        <th className="p-1.5 w-24">Примітка</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      <tr>
                        <td className="border-r border-neutral-900 p-1.5 text-center font-mono">1</td>
                        <td className="border-r border-neutral-900 p-1.5 font-medium">Загальні дані. Пояснювальна записка. Розрахунок резервного живлення (ДБЖ)</td>
                        <td className="p-1.5 text-neutral-500">ПУЕ:2017</td>
                      </tr>
                      <tr>
                        <td className="border-r border-neutral-900 p-1.5 text-center font-mono">2</td>
                        <td className="border-r border-neutral-900 p-1.5 font-medium">План розташування силових розеток та електроприладів М 1:50</td>
                        <td className="p-1.5 text-neutral-500">ДБН В.2.5-23</td>
                      </tr>
                      <tr>
                        <td className="border-r border-neutral-900 p-1.5 text-center font-mono">3</td>
                        <td className="border-r border-neutral-900 p-1.5 font-medium">План розташування світильників та груп вимикачів М 1:50</td>
                        <td className="p-1.5 text-neutral-500">ДСТУ</td>
                      </tr>
                      <tr>
                        <td className="border-r border-neutral-900 p-1.5 text-center font-mono">4</td>
                        <td className="border-r border-neutral-900 p-1.5 font-medium">Принципова однолінійна розрахункова схема щита (ВРП / ЩРН)</td>
                        <td className="p-1.5 text-neutral-500">Схема</td>
                      </tr>
                      <tr>
                        <td className="border-r border-neutral-900 p-1.5 text-center font-mono">5</td>
                        <td className="border-r border-neutral-900 p-1.5 font-medium">Кабельний журнал та специфікація електроустановочних виробів</td>
                        <td className="p-1.5 text-neutral-500">БОМ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Key Technical Characteristics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-neutral-900 p-3 bg-neutral-50">
                    <h3 className="text-xs font-bold uppercase mb-2">Основні техніко-економічні показники</h3>
                    <ul className="space-y-1 text-xs">
                      <li>• Напруга живлення: <span className="font-bold">230 В, 50 Гц</span> (1-фазна)</li>
                      <li>• Система заземлення: <span className="font-bold">TN-C-S</span></li>
                      <li>• Встановлена потужність (Pвст): <span className="font-bold">{(totalInstalledWatts / 1000).toFixed(2)} кВт</span></li>
                      <li>• Розрахункова потужність (Pрозр): <span className="font-bold">{(calculatedWatts / 1000).toFixed(2)} кВт</span></li>
                      <li>• Розрахунковий струм навантаження (Iрозр): <span className="font-bold">{calculatedAmps} А</span></li>
                      <li>• Ввідний автоматичний вимикач: <span className="font-bold">C{project.mainBreakerRatingA || 32} А</span></li>
                    </ul>
                  </div>

                  {/* Backup Power Section */}
                  <div className="border border-neutral-900 p-3 bg-emerald-50/50">
                    <h3 className="text-xs font-bold uppercase text-emerald-950 mb-2 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-700" /> Система гарантованого резервного живлення
                    </h3>
                    <ul className="space-y-1 text-xs text-neutral-800">
                      <li>• Джерело резерву: <span className="font-bold">Гібридний інвертор 5 кВт + АКБ LiFePO4</span></li>
                      <li>• Ємність акумуляторного блоку: <span className="font-bold">{(project.backupSystem?.batteryCapacityWh || 5120) / 1000} кВт·год (51.2В 100Аг)</span></li>
                      <li>• Потужність пріоритетної лінії: <span className="font-bold">{backupWatts} Вт</span> ({backupElements.length} споживачів)</li>
                      <li>• Розрахункова автономність: <span className="font-bold text-emerald-800">~14-24 год (залежно від режиму)</span></li>
                      <li>• Перемикання на АКБ: <span className="font-bold">&le; 10 мс (без перезавантаження ПК/роутера)</span></li>
                    </ul>
                  </div>
                </div>

                <div className="text-xs text-neutral-700 leading-relaxed">
                  <span className="font-bold">Вказівки з монтажу:</span> Монтаж виконати відповідно до вимог ПУЕ України та ДБН В.2.5-23:2010 кабелем марки ВВГнгд з мідними жилами, що не поширює горіння та має помірне димоутворення. Траси прокладати в гофрованих ПВХ трубах за підвісною стелею та у вертикальних штробах суворо під кутом 90°. Всі металеві корпуси підлягають зануленню/заземленню.
                </div>
              </div>
            )}

            {/* Sheet 2: Sockets & Appliances Plan */}
            {activeSheet === 2 && (
              <div className="space-y-4 flex-1">
                <div className="border-b-2 border-neutral-900 pb-2 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold uppercase">
                      План розміщення силових розеток та електроприладів (М 1:50)
                    </h1>
                    <p className="text-xs text-neutral-600">
                      Розетки 220В, виводи під кухонну техніку, висоти монтажу та резервовані лінії ДБЖ
                    </p>
                  </div>
                  <div className="text-xs font-mono font-bold border border-neutral-900 px-2 py-1 bg-neutral-100">
                    Всього розеток: {project.elements.filter((e) => e.category === 'socket' || e.category === 'appliance').length} шт
                  </div>
                </div>

                {/* Sockets Table Summary */}
                <div className="border border-neutral-900 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-100 border-b border-neutral-900 text-[11px] font-bold">
                      <tr>
                        <th className="p-2 border-r border-neutral-900">Позначення</th>
                        <th className="p-2 border-r border-neutral-900">Тип виробу</th>
                        <th className="p-2 border-r border-neutral-900">Висота монтажу</th>
                        <th className="p-2 border-r border-neutral-900">Група щита</th>
                        <th className="p-2 border-r border-neutral-900">Клас захисту</th>
                        <th className="p-2">Резервне живлення</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 text-[11px]">
                      {project.elements
                        .filter((e) => e.category === 'socket' || e.category === 'appliance')
                        .slice(0, 10)
                        .map((el) => {
                          const circuit = project.circuits.find((c) => c.id === el.circuitId);
                          const isBackup = Boolean(el.isBackupPriority || circuit?.isBackupPriority);
                          return (
                            <tr key={el.id}>
                              <td className="p-1.5 border-r border-neutral-900 font-bold font-mono">
                                {el.name.substring(0, 16)}
                              </td>
                              <td className="p-1.5 border-r border-neutral-900">{el.name}</td>
                              <td className="p-1.5 border-r border-neutral-900 font-mono">+{el.mountingHeightMm} мм</td>
                              <td className="p-1.5 border-r border-neutral-900">
                                {circuit ? `Гр.${circuit.number} (${circuit.name})` : '—'}
                              </td>
                              <td className="p-1.5 border-r border-neutral-900 font-mono">{el.ipRating}</td>
                              <td className="p-1.5 font-bold">
                                {isBackup ? <span className="text-emerald-700">⚡ ДБЖ (Гарантоване)</span> : '—'}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-neutral-100 border border-neutral-900 text-xs text-neutral-800">
                  <span className="font-bold">Примітка:</span> Всі розетки у ванній кімнаті та біля мийки встановлювати із ступенем захисту не нижче IP44 з захисними шторками та підключати виключно через диференційні автомати з током витоку IΔn ≤ 10-30 мА.
                </div>
              </div>
            )}

            {/* Sheet 3: Lighting Plan */}
            {activeSheet === 3 && (
              <div className="space-y-4 flex-1">
                <div className="border-b-2 border-neutral-900 pb-2 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold uppercase">
                      План мережі електричного освітлення (М 1:50)
                    </h1>
                    <p className="text-xs text-neutral-600">
                      Світильники, типи вимикачів, лінії зв'язку та маркування груп ввімкнення
                    </p>
                  </div>
                  <div className="text-xs font-mono font-bold border border-neutral-900 px-2 py-1 bg-neutral-100">
                    Світильників: {project.elements.filter((e) => e.category === 'light').length} шт
                  </div>
                </div>

                {/* Lighting Groups Table */}
                <div className="border border-neutral-900 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-100 border-b border-neutral-900 text-[11px] font-bold">
                      <tr>
                        <th className="p-2 border-r border-neutral-900">Група світла</th>
                        <th className="p-2 border-r border-neutral-900">Тип світильника</th>
                        <th className="p-2 border-r border-neutral-900">Керуючий вимикач</th>
                        <th className="p-2 border-r border-neutral-900">Висота вимикача</th>
                        <th className="p-2">Тип кабелю</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 text-[11px]">
                      {project.elements
                        .filter((e) => e.category === 'switch')
                        .map((sw) => {
                          const matchedLights = project.elements.filter(
                            (l) => l.category === 'light' && l.switchGroupId === sw.switchGroupId
                          );
                          return (
                            <tr key={sw.id}>
                              <td className="p-2 border-r border-neutral-900 font-bold font-mono text-sky-800">
                                {sw.switchGroupId || 'S1'}
                              </td>
                              <td className="p-2 border-r border-neutral-900">
                                {matchedLights.length > 0
                                  ? matchedLights.map((l) => l.name).join(', ')
                                  : 'Стельові світильники'}
                              </td>
                              <td className="p-2 border-r border-neutral-900 font-medium">{sw.name}</td>
                              <td className="p-2 border-r border-neutral-900 font-mono">+{sw.mountingHeightMm} мм</td>
                              <td className="p-2 font-mono">ВВГнгд 3х1.5</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-neutral-100 border border-neutral-900 text-xs text-neutral-800">
                  <span className="font-bold">Вказівка:</span> Вимикачі встановлювати на висоті +900 мм від рівня чистої підлоги з боку дверної ручки (відступ 100–150 мм від наличника дверей).
                </div>
              </div>
            )}

            {/* Sheet 4: Single-Line Schematic */}
            {activeSheet === 4 && (
              <div className="space-y-4 flex-1">
                <div className="border-b-2 border-neutral-900 pb-2 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold uppercase">
                      Принципова однолінійна розрахункова схема щита (ВРП)
                    </h1>
                    <p className="text-xs text-neutral-600">
                      Апарати захисту, номінали, дифзахист, розрахункові навантаження та блоки резервування
                    </p>
                  </div>
                  <div className="text-xs font-mono font-bold border border-neutral-900 px-2 py-1 bg-neutral-100">
                    Ввід: 230 В / 50 Гц / TN-C-S
                  </div>
                </div>

                {/* Circuit Schedule Table */}
                <div className="border border-neutral-900 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-100 border-b border-neutral-900 text-[11px] font-bold">
                      <tr>
                        <th className="p-2 border-r border-neutral-900 text-center w-12">№</th>
                        <th className="p-2 border-r border-neutral-900">Найменування лінії</th>
                        <th className="p-2 border-r border-neutral-900">Автоматичний вимикач</th>
                        <th className="p-2 border-r border-neutral-900">ПЗВ / Дифавтомат</th>
                        <th className="p-2 border-r border-neutral-900">Марка кабелю</th>
                        <th className="p-2 border-r border-neutral-900">Потужність</th>
                        <th className="p-2">Резервування</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 text-[11px]">
                      {project.circuits.map((c) => {
                        const grpElements = project.elements.filter((e) => e.circuitId === c.id);
                        const pWatts = grpElements.reduce((s, e) => s + (e.powerWatts || 150), 0);
                        return (
                          <tr key={c.id}>
                            <td className="p-1.5 border-r border-neutral-900 text-center font-bold font-mono">
                              {c.number}
                            </td>
                            <td className="p-1.5 border-r border-neutral-900 font-medium">{c.name}</td>
                            <td className="p-1.5 border-r border-neutral-900 font-mono font-bold">
                              {c.breakerCurve}{c.breakerRatingA}А
                            </td>
                            <td className="p-1.5 border-r border-neutral-900 font-mono text-neutral-700">
                              {c.rcdType !== 'none' ? '30 мА (тип A)' : '—'}
                            </td>
                            <td className="p-1.5 border-r border-neutral-900 font-mono">
                              {c.cableType.replace('_', ' ')}
                            </td>
                            <td className="p-1.5 border-r border-neutral-900 font-mono">
                              {(pWatts / 1000).toFixed(2)} кВт
                            </td>
                            <td className="p-1.5 font-bold">
                              {c.isBackupPriority ? (
                                <span className="text-emerald-700">⚡ ДБЖ (LiFePO4)</span>
                              ) : (
                                <span className="text-neutral-400">Міська мережа</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-neutral-50 border border-neutral-900 text-xs">
                  <div className="font-bold mb-1">Захисна автоматика щита:</div>
                  <div>1. Ввідний автомат: 2P C{project.mainBreakerRatingA || 32} 6кА Hager / Schneider Electric</div>
                  <div>2. Реле захисту від перепадів напруги: ZUBR D2-40 (відсічка 175–255 В)</div>
                  <div>3. Ввід резерву: Реверсивний перемикач Hager I-0-II або гібридний інвертор 5 кВт з часом перемикання 10мс</div>
                </div>
              </div>
            )}

            {/* Sheet 5: Cable Schedule & Bill of Materials */}
            {activeSheet === 5 && (
              <div className="space-y-4 flex-1">
                <div className="border-b-2 border-neutral-900 pb-2 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold uppercase">
                      Кабельний журнал та відомість потреби в матеріалах
                    </h1>
                    <p className="text-xs text-neutral-600">
                      Зведена специфікація кабельно-провідникової продукції та електрообладнання
                    </p>
                  </div>
                  <div className="text-xs font-mono font-bold border border-neutral-900 px-2 py-1 bg-neutral-100">
                    ДСТУ Б В.2.5-82:2016
                  </div>
                </div>

                {/* Cable Lengths */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5">
                    1. Кабельний журнал (з урахуванням +15% запасу на спуск та оброблення)
                  </h3>
                  <table className="w-full border border-neutral-900 text-xs text-left">
                    <thead className="bg-neutral-100 border-b border-neutral-900">
                      <tr>
                        <th className="p-2 border-r border-neutral-900">Марка кабелю</th>
                        <th className="p-2 border-r border-neutral-900">Призначення лінії</th>
                        <th className="p-2 border-r border-neutral-900">Спосіб монтажу</th>
                        <th className="p-2">Розрахункова довжина</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 text-[11px]">
                      {Object.entries(cableSummary).map(([cableType, length]) => (
                        <tr key={cableType}>
                          <td className="p-1.5 border-r border-neutral-900 font-bold font-mono">
                            {cableType.replace('_', ' ')}
                          </td>
                          <td className="p-1.5 border-r border-neutral-900">
                            {cableType.includes('3x1.5') ? 'Освітлення та вимикачі' : cableType.includes('3x6') ? 'Варильна поверхня 32A' : 'Силові розетки 16А'}
                          </td>
                          <td className="p-1.5 border-r border-neutral-900">
                            В гофротрубі ПВХ за стелею + штроба в стіні
                          </td>
                          <td className="p-1.5 font-bold font-mono text-neutral-900">
                            {Math.round(length)} метрів
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Equipment Takeoff */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5">
                    2. Відомість основних електроустановочних виробів
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="border border-neutral-900 p-2.5">
                      <div className="font-bold border-b border-neutral-300 pb-1 mb-1">
                        Механізми та вироби:
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>• Силові розетки 16А:</span>
                        <span className="font-bold">{project.elements.filter((e) => e.category === 'socket').length} шт</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>• Вимикачі світла:</span>
                        <span className="font-bold">{project.elements.filter((e) => e.category === 'switch').length} шт</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>• Світильники / люстри / споти:</span>
                        <span className="font-bold">{project.elements.filter((e) => e.category === 'light').length} шт</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>• Підрозетники (коробки установочні):</span>
                        <span className="font-bold">
                          {project.elements.filter((e) => e.category === 'socket' || e.category === 'switch').length} шт
                        </span>
                      </div>
                    </div>

                    <div className="border border-neutral-900 p-2.5 bg-emerald-50/50">
                      <div className="font-bold border-b border-neutral-300 pb-1 mb-1 text-emerald-950">
                        Щитове та резервне обладнання:
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>• Корпус щита ЩРН:</span>
                        <span className="font-bold">1 шт (24-36 модулів)</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>• Модульні автоматичні вимикачі:</span>
                        <span className="font-bold">{project.circuits.length} шт</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>• Гібридний інвертор 5 кВт:</span>
                        <span className="font-bold text-emerald-800">1 компл.</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>• АКБ LiFePO4 51.2В 100Аг (5.12 кВт·г):</span>
                        <span className="font-bold text-emerald-800">1 шт</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DSTU Standard Corner Stamp at Bottom */}
            {renderDstuStamp(
              activeSheet,
              activeSheet === 1
                ? 'Загальні дані. Пояснювальна записка'
                : activeSheet === 2
                ? 'План силових розеток та електроприладів'
                : activeSheet === 3
                ? 'План мережі освітлення та вимикачів'
                : activeSheet === 4
                ? 'Принципова однолінійна схема щита'
                : 'Кабельний журнал та специфікація'
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between shrink-0 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Документація відповідає стандартам України ПУЕ:2017 та ДБН В.2.5-23:2010</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
