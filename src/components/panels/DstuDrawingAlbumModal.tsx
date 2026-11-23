import React, { useMemo, useState } from 'react';
import { Download, FileCode, CheckCircle2, FileText, Zap, Loader2, AlertCircle } from 'lucide-react';
import { CadProject } from '../../types/cad';
import { downloadDxfFile } from '../../utils/dxfExport';
import { getCableDisplayName } from '../../utils/cadMath';
import { analyzeCircuit, calculateProjectElectricalSummary } from '../../utils/electricalCalculations';
import { generateCableSchedule } from '../../utils/cableSchedule';
import { getAggregatedProjectData } from '../../utils/projectAggregator';
import { generateCadProjectSvg, SvgSheetMode } from '../../utils/svgExport';
import { DSTU_ALBUM_SHEETS, exportDstuAlbumToPdf } from '../../utils/pdfExport';
import { SingleLineSchematicSvg } from '../cad/SingleLineSchematicSvg';

interface DstuDrawingAlbumModalProps {
  project: CadProject;
  onClose: () => void;
}

export const DstuDrawingAlbumModal: React.FC<DstuDrawingAlbumModalProps> = ({
  project,
  onClose,
}) => {
  const [activeSheet, setActiveSheet] = useState<number>(1);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ sheet: number; total: number } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const agg = useMemo(() => getAggregatedProjectData(project), [project]);
  const summary = useMemo(() => calculateProjectElectricalSummary(project), [project]);
  const cableSchedule = useMemo(() => generateCableSchedule(project).entries, [project]);

  const groundingSystem = project.groundingSystem || 'TN-C-S';
  const totalInstalledWatts = summary.installedPowerWatts;
  const demandFactor = summary.demandFactor;
  const calculatedWatts = summary.designPowerWatts;
  const calculatedAmps = summary.mainCurrentA;

  // Backup priority load across all floors
  const backupElements = useMemo(
    () =>
      agg.allElements.filter(
        (el) => el.isBackupPriority || project.circuits.find((c) => c.id === el.circuitId)?.isBackupPriority
      ),
    [agg.allElements, project.circuits]
  );
  const backupWatts = backupElements.reduce((sum, el) => sum + (el.powerWatts || 0), 0);

  // Full circuit analyses across all floors
  const circuitAnalyses = useMemo(
    () =>
      project.circuits.map((c) =>
        analyzeCircuit(c, agg.allElements, agg.allWires, project.supplyPhase, groundingSystem)
      ),
    [project.circuits, agg.allElements, agg.allWires, project.supplyPhase, groundingSystem]
  );

  // Vector SVG previews for sheets 2..7
  const sheetSvgDataUrl = useMemo(() => {
    const modeMap: Record<number, SvgSheetMode> = {
      2: 'general',
      3: 'lighting',
      4: 'sockets',
      5: 'power',
      6: 'wiring',
      7: 'low_voltage',
    };
    const mode = modeMap[activeSheet];
    if (!mode) return null;
    const svgMarkup = generateCadProjectSvg(project, {
      mode,
      showDimensions: activeSheet === 2 || activeSheet === 4 || activeSheet === 6,
      showFurniture: activeSheet === 2 || activeSheet === 3 || activeSheet === 4,
      showCircuitBadges: activeSheet !== 2,
      showCableTags: activeSheet === 6,
    });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  }, [project, activeSheet]);

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    setPdfError(null);
    setPdfProgress({ sheet: 1, total: DSTU_ALBUM_SHEETS.length });
    try {
      await exportDstuAlbumToPdf(project, (sheet, total) => {
        setPdfProgress({ sheet, total });
      });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Помилка експорту PDF альбому.');
    } finally {
      setIsExportingPdf(false);
      setPdfProgress(null);
    }
  };

  const handleExportDxf = () => {
    downloadDxfFile(project);
  };

  // Dynamic DSTU Stamp Component (Форма 3 за ДСТУ Б А.2.4-4:2009)
  const renderDstuStamp = (sheetNum: number, sheetTitle: string) => {
    const authorName = project.author || 'Інженер-проєктувальник';
    const checkerName = project.contractorProfile?.expertEngineer || 'Гол. спеціаліст';
    const gipName = project.contractorProfile?.contractorName || authorName;
    const orgName = project.contractorProfile?.companyName || 'ElectroPlan CAD UA';

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
              <div className="truncate">{authorName}</div>
              <div>{project.date || '2026'}</div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-neutral-900 py-0.5 px-1 text-[10px]">
              <div className="font-semibold">Перевірив</div>
              <div className="truncate">{checkerName}</div>
              <div>{project.date || '2026'}</div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-neutral-900 py-0.5 px-1 text-[10px]">
              <div className="font-semibold">ГІП</div>
              <div className="truncate">{gipName}</div>
              <div>{project.date || '2026'}</div>
            </div>
          </div>

          {/* Middle Title Block */}
          <div className="col-span-5 p-2 flex flex-col justify-between">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wide">
              Об&apos;єкт / Система заземлення: {groundingSystem}
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
                <div className="font-bold text-xs">{DSTU_ALBUM_SHEETS.length}</div>
              </div>
            </div>
            <div className="p-2 text-center bg-neutral-50 flex-1 flex items-center justify-center font-bold text-xs tracking-wider uppercase truncate">
              {orgName}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const currentSheetMeta = DSTU_ALBUM_SHEETS.find((s) => s.num === activeSheet) || DSTU_ALBUM_SHEETS[0];

  const socketElements = agg.allElements.filter((e) => e.category === 'socket');
  const powerElements = agg.allElements.filter(
    (e) => e.category === 'appliance' || e.type === 'socket_3phase' || e.powerWatts >= 1500
  );
  const lowVoltageElements = agg.allElements.filter(
    (e) =>
      e.type === 'socket_rj45' ||
      e.type === 'socket_tv' ||
      e.type === 'wifi_ap' ||
      e.type === 'cctv_camera' ||
      e.type === 'intercom' ||
      e.type === 'motion_sensor' ||
      e.type === 'light_sensor' ||
      e.type === 'leak_sensor' ||
      e.type === 'water_leak_valve' ||
      e.type === 'thermostat' ||
      e.type === 'knx_actuator' ||
      e.type === 'knx_power_supply'
  );

  // Aggregate cables by mark for Sheet 10
  const bomCableTotals = useMemo(() => {
    const map = new Map<string, { calc: number; proc: number }>();
    cableSchedule.forEach((row) => {
      const prev = map.get(row.cableSpec) || { calc: 0, proc: 0 };
      map.set(row.cableSpec, {
        calc: prev.calc + row.totalDesignLengthM,
        proc: prev.proc + row.procurementLengthM,
      });
    });
    return Array.from(map.entries());
  }, [cableSchedule]);

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white font-display">
                  Альбом креслень ДСТУ Б А.2.4-4:2009 (10 аркушів)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Формат А3 / PDF
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Повний комплект робочої документації ЕОМ по {agg.syncedFloors.length} поверхах ({agg.allElements.length} приладів, {cableSchedule.length} кабельних ліній)
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
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm shadow-sky-500/20"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    PDF {pdfProgress ? `${pdfProgress.sheet}/${pdfProgress.total}` : '...'}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Завантажити альбом (.PDF)</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-100 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="px-6 py-2 bg-rose-950/60 border-b border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{pdfError}</span>
          </div>
        )}

        {/* 10 Sheet Tabs Bar */}
        <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-950/70 flex items-center gap-1 overflow-x-auto shrink-0 text-[11px]">
          {DSTU_ALBUM_SHEETS.map((sheet) => (
            <button
              key={sheet.num}
              onClick={() => setActiveSheet(sheet.num)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeSheet === sheet.num
                  ? 'bg-neutral-800 text-sky-400 font-semibold border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-neutral-700/60 flex items-center justify-center text-[10px] font-mono">
                {sheet.num}
              </span>
              <span>{sheet.shortTitle}</span>
            </button>
          ))}
        </div>

        {/* Sheet Content Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-neutral-950 flex justify-center">
          <div className="w-full max-w-5xl bg-white text-neutral-900 rounded-lg shadow-2xl p-7 border-4 border-neutral-900 flex flex-col justify-between min-h-[660px] font-sans">
            {/* Sheet 1: General Notes, Index & Legend */}
            {activeSheet === 1 && (
              <div className="space-y-5 flex-1">
                <div className="border-b-2 border-neutral-900 pb-2.5">
                  <h1 className="text-xl font-bold uppercase tracking-wide">
                    Загальні дані. Пояснювальна записка марки ЕОМ
                  </h1>
                  <p className="text-xs text-neutral-600 mt-1">
                    Об&apos;єкт: «{project.title}» | Система заземлення: {groundingSystem} | Поверхів: {agg.syncedFloors.length}
                  </p>
                </div>

                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                    1. Відомість робочих креслень основного комплекту (10 аркушів)
                  </h2>
                  <table className="w-full border-collapse border border-neutral-900 text-xs">
                    <thead>
                      <tr className="bg-neutral-100 border-b border-neutral-900 text-left">
                        <th className="border-r border-neutral-900 p-1.5 w-14 text-center">Арк.</th>
                        <th className="border-r border-neutral-900 p-1.5">Найменування креслення</th>
                        <th className="p-1.5 w-28">Норматив</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {DSTU_ALBUM_SHEETS.map((s) => (
                        <tr key={s.num}>
                          <td className="border-r border-neutral-900 p-1 text-center font-mono">{s.num}</td>
                          <td className="border-r border-neutral-900 p-1 font-medium">{s.fullTitle}</td>
                          <td className="p-1 text-neutral-600 font-mono text-[11px]">{s.normRef}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-neutral-900 p-3 bg-neutral-50">
                    <h3 className="text-xs font-bold uppercase mb-2">Основні техніко-економічні показники</h3>
                    <ul className="space-y-1 text-xs">
                      <li>• Напруга живлення: <span className="font-bold">{project.supplyPhase === '3-phase' ? '3N~ 400 В, 50 Гц' : '1N~ 230 В, 50 Гц'}</span></li>
                      <li>• Система заземлення: <span className="font-bold">{groundingSystem}</span></li>
                      <li>• Встановлена потужність (Pвст): <span className="font-bold">{(totalInstalledWatts / 1000).toFixed(2)} кВт</span></li>
                      <li>• Розрахункова потужність (Pрозр, Kп={demandFactor}): <span className="font-bold">{(calculatedWatts / 1000).toFixed(2)} кВт</span></li>
                      <li>• Розрахунковий струм навантаження (Iрозр): <span className="font-bold">{calculatedAmps} А</span></li>
                      <li>• Ввідний автомат: <span className="font-bold">C{project.mainBreakerRatingA || 40} А</span></li>
                    </ul>
                  </div>

                  <div className="border border-neutral-900 p-3 bg-emerald-50/50">
                    <h3 className="text-xs font-bold uppercase text-emerald-950 mb-2 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-700" /> Гарантоване живлення та легенда позначень
                    </h3>
                    <ul className="space-y-1 text-xs text-neutral-800">
                      <li>• Пріоритетна лінія ДБЖ: <span className="font-bold">{backupWatts} Вт</span> ({backupElements.length} точок)</li>
                      <li>• Загальна площа об&apos;єкта: <span className="font-bold">{agg.totalAreaM2} м²</span></li>
                      <li>• Умовні позначення: півколо з рискою — розетка; коло з відводом — вимикач; коло з × — світильник; прямокутник із діагоналлю — електрощит.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Sheets 2..7: Vector CAD SVG Plan + Dedicated Schedule */}
            {activeSheet >= 2 && activeSheet <= 7 && (
              <div className="space-y-4 flex-1">
                <div className="border-b-2 border-neutral-900 pb-2 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold uppercase">{currentSheetMeta.fullTitle}</h1>
                    <p className="text-xs text-neutral-600">
                      {project.title} | Система: {groundingSystem} | Стандарт: {currentSheetMeta.normRef}
                    </p>
                  </div>
                  <div className="text-xs font-mono font-bold border border-neutral-900 px-2.5 py-1 bg-neutral-100">
                    {activeSheet === 2 && `Приміщень: ${agg.allRooms.length} (${agg.totalAreaM2} м²)`}
                    {activeSheet === 3 && `Світильників: ${agg.allElements.filter((e) => e.category === 'light').length} шт`}
                    {activeSheet === 4 && `Розеток: ${socketElements.length} шт`}
                    {activeSheet === 5 && `Силових споживачів: ${powerElements.length} шт`}
                    {activeSheet === 6 && `Трас: ${cableSchedule.length} ліній`}
                    {activeSheet === 7 && `Слабкострумових точок: ${lowVoltageElements.length} шт`}
                  </div>
                </div>

                {/* Real Vector SVG Floor Plan */}
                {sheetSvgDataUrl && (
                  <div className="border border-neutral-900 bg-white rounded p-2 flex items-center justify-center max-h-[380px] overflow-hidden">
                    <img
                      src={sheetSvgDataUrl}
                      alt={currentSheetMeta.fullTitle}
                      className="max-h-[360px] w-auto object-contain"
                    />
                  </div>
                )}

                {/* Sheet-specific full schedule table (NO .slice truncation) */}
                {activeSheet === 2 && (
                  <div className="border border-neutral-900 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-100 border-b border-neutral-900 text-[11px] font-bold">
                        <tr>
                          <th className="p-1.5 border-r border-neutral-900 w-10">№</th>
                          <th className="p-1.5 border-r border-neutral-900">Приміщення</th>
                          <th className="p-1.5 border-r border-neutral-900">Тип</th>
                          <th className="p-1.5 border-r border-neutral-900">Площа</th>
                          <th className="p-1.5">Поверх</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 text-[11px]">
                        {agg.allRooms.map((r, idx) => (
                          <tr key={`${r.id}_${idx}`}>
                            <td className="p-1.5 border-r border-neutral-900 font-mono">{idx + 1}</td>
                            <td className="p-1.5 border-r border-neutral-900 font-semibold">{r.name}</td>
                            <td className="p-1.5 border-r border-neutral-900">{r.type}</td>
                            <td className="p-1.5 border-r border-neutral-900 font-mono">{r.areaM2} м²</td>
                            <td className="p-1.5">{r.floorName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeSheet === 3 && (
                  <div className="border border-neutral-900 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-100 border-b border-neutral-900 text-[11px] font-bold">
                        <tr>
                          <th className="p-1.5 border-r border-neutral-900">Група світла</th>
                          <th className="p-1.5 border-r border-neutral-900">Світильники</th>
                          <th className="p-1.5 border-r border-neutral-900">Керуючий вимикач</th>
                          <th className="p-1.5 border-r border-neutral-900">Висота</th>
                          <th className="p-1.5">Поверх</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 text-[11px]">
                        {agg.allElements
                          .filter((e) => e.category === 'switch')
                          .map((sw) => {
                            const matchedLights = agg.allElements.filter(
                              (l) => l.category === 'light' && l.switchGroupId === sw.switchGroupId
                            );
                            return (
                              <tr key={sw.id}>
                                <td className="p-1.5 border-r border-neutral-900 font-bold font-mono">{sw.switchGroupId || 'S1'}</td>
                                <td className="p-1.5 border-r border-neutral-900">
                                  {matchedLights.length > 0 ? matchedLights.map((l) => l.name).join(', ') : 'Стельові світильники'}
                                </td>
                                <td className="p-1.5 border-r border-neutral-900 font-medium">{sw.name}</td>
                                <td className="p-1.5 border-r border-neutral-900 font-mono">+{sw.mountingHeightMm} мм</td>
                                <td className="p-1.5">{sw.floorName}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeSheet === 4 && (
                  <div className="border border-neutral-900 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-100 border-b border-neutral-900 text-[11px] font-bold">
                        <tr>
                          <th className="p-1.5 border-r border-neutral-900">Найменування</th>
                          <th className="p-1.5 border-r border-neutral-900">Висота</th>
                          <th className="p-1.5 border-r border-neutral-900">Група</th>
                          <th className="p-1.5 border-r border-neutral-900">IP</th>
                          <th className="p-1.5 border-r border-neutral-900">Поверх</th>
                          <th className="p-1.5">Резерв ДБЖ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 text-[11px]">
                        {socketElements.map((el) => {
                          const circuit = project.circuits.find((c) => c.id === el.circuitId);
                          const isBackup = Boolean(el.isBackupPriority || circuit?.isBackupPriority);
                          return (
                            <tr key={el.id}>
                              <td className="p-1.5 border-r border-neutral-900 font-medium">{el.name}</td>
                              <td className="p-1.5 border-r border-neutral-900 font-mono">+{el.mountingHeightMm} мм</td>
                              <td className="p-1.5 border-r border-neutral-900">
                                {circuit ? `Гр.${circuit.number} (${circuit.name})` : '—'}
                              </td>
                              <td className="p-1.5 border-r border-neutral-900 font-mono">{el.ipRating}</td>
                              <td className="p-1.5 border-r border-neutral-900">{el.floorName}</td>
                              <td className="p-1.5 font-bold">{isBackup ? '⚡ ДБЖ' : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeSheet === 5 && (
                  <div className="border border-neutral-900 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-100 border-b border-neutral-900 text-[11px] font-bold">
                        <tr>
                          <th className="p-1.5 border-r border-neutral-900">Споживач</th>
                          <th className="p-1.5 border-r border-neutral-900">Потужність</th>
                          <th className="p-1.5 border-r border-neutral-900">Група та автомат</th>
                          <th className="p-1.5 border-r border-neutral-900">Кабель</th>
                          <th className="p-1.5">Поверх</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 text-[11px]">
                        {powerElements.map((el) => {
                          const c = project.circuits.find((cr) => cr.id === el.circuitId);
                          return (
                            <tr key={el.id}>
                              <td className="p-1.5 border-r border-neutral-900 font-semibold">{el.name}</td>
                              <td className="p-1.5 border-r border-neutral-900 font-mono">{el.powerWatts} Вт</td>
                              <td className="p-1.5 border-r border-neutral-900">
                                {c ? `Гр.${c.number} · ${c.breakerCurve}${c.breakerRatingA}А (${c.phase})` : 'Не призначено'}
                              </td>
                              <td className="p-1.5 border-r border-neutral-900 font-mono">
                                {c ? getCableDisplayName(c.cableType) : '—'}
                              </td>
                              <td className="p-1.5">{el.floorName}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeSheet === 6 && (
                  <div className="p-3 bg-neutral-100 border border-neutral-900 text-xs space-y-1">
                    <div>
                      <span className="font-bold">Способи прокладання трас:</span> по стелі у гофротрубі ПВХ (штрихова лінія), у штробах стін під кутом 90° (суцільна лінія), у стяжці підлоги (пунктирна лінія).
                    </div>
                    <div className="font-mono">
                      Всього кабельних ліній: {cableSchedule.length} | Сумарна розрахункова довжина: {cableSchedule.reduce((s, r) => s + r.totalDesignLengthM, 0).toFixed(1)} м | До закупівлі (+12%): {cableSchedule.reduce((s, r) => s + r.procurementLengthM, 0).toFixed(1)} м
                    </div>
                  </div>
                )}

                {activeSheet === 7 && (
                  <div className="border border-neutral-900 text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-100 border-b border-neutral-900 text-[11px] font-bold">
                        <tr>
                          <th className="p-1.5 border-r border-neutral-900">Найменування СКС / СБ</th>
                          <th className="p-1.5 border-r border-neutral-900">Тип</th>
                          <th className="p-1.5 border-r border-neutral-900">Висота</th>
                          <th className="p-1.5">Поверх</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 text-[11px]">
                        {lowVoltageElements.map((el) => (
                          <tr key={el.id}>
                            <td className="p-1.5 border-r border-neutral-900 font-semibold">{el.name}</td>
                            <td className="p-1.5 border-r border-neutral-900 font-mono">{el.type}</td>
                            <td className="p-1.5 border-r border-neutral-900 font-mono">+{el.mountingHeightMm} мм</td>
                            <td className="p-1.5">{el.floorName}</td>
                          </tr>
                        ))}
                        {lowVoltageElements.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-3 text-center text-neutral-500">
                              Слабкострумові елементи та датчики на плані відсутні
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sheet 8: Single-Line Schematic */}
            {activeSheet === 8 && (
              <div className="space-y-4 flex-1">
                <div className="border-b-2 border-neutral-900 pb-2 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold uppercase">
                      Принципова однолінійна розрахункова схема щита (ВРП / ЩР)
                    </h1>
                    <p className="text-xs text-neutral-600">
                      Векторна схема: ввідний автомат, реле напруги, шини L/N/PE, ПЗВ/дифавтомати та групові лінії
                    </p>
                  </div>
                  <div className="text-xs font-mono font-bold border border-neutral-900 px-2 py-1 bg-neutral-100">
                    Ввід: {project.supplyPhase === '3-phase' ? '3N~ 400 В' : '1N~ 230 В'} / {groundingSystem}
                  </div>
                </div>

                <SingleLineSchematicSvg project={project} demandFactor={demandFactor} />
              </div>
            )}

            {/* Sheet 9: Circuits Table & Full Multi-Floor Cable Schedule */}
            {activeSheet === 9 && (
              <div className="space-y-4 flex-1">
                <div className="border-b-2 border-neutral-900 pb-2 flex items-center justify-between">
                  <h1 className="text-lg font-bold uppercase">Таблиця електричних груп та кабельний журнал</h1>
                  <div className="text-xs font-mono font-bold border border-neutral-900 px-2 py-1 bg-neutral-100">
                    ДСТУ 21.608 · Усі поверхи ({agg.syncedFloors.length})
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase mb-1">1. Розрахункова таблиця електричних груп</h3>
                  <table className="w-full border border-neutral-900 text-[11px] text-left">
                    <thead className="bg-neutral-100 border-b border-neutral-900">
                      <tr>
                        <th className="p-1.5 border-r border-neutral-900">Група</th>
                        <th className="p-1.5 border-r border-neutral-900">Фаза</th>
                        <th className="p-1.5 border-r border-neutral-900">Апарат</th>
                        <th className="p-1.5 border-r border-neutral-900">Кабель</th>
                        <th className="p-1.5 border-r border-neutral-900">Pрозр / Iрозр</th>
                        <th className="p-1.5">ΔU% / Ідд.еф</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {circuitAnalyses.map((an) => (
                        <tr key={an.circuit.id}>
                          <td className="p-1.5 border-r border-neutral-900 font-semibold">Гр.{an.circuit.number} {an.circuit.name}</td>
                          <td className="p-1.5 border-r border-neutral-900 font-mono">{an.circuit.phase}</td>
                          <td className="p-1.5 border-r border-neutral-900 font-mono">{an.circuit.breakerCurve}{an.circuit.breakerRatingA}А</td>
                          <td className="p-1.5 border-r border-neutral-900 font-mono">{getCableDisplayName(an.circuit.cableType)}</td>
                          <td className="p-1.5 border-r border-neutral-900 font-mono">
                            {an.overallStatus === 'uncalculated' ? 'Не розраховано' : `${an.totalInstalledWatts} Вт / ${an.calculatedCurrentA} А`}
                          </td>
                          <td className="p-1.5 font-mono">
                            {an.overallStatus === 'uncalculated' ? 'Не розраховано' : `${an.voltageDrop.deltaPercent}% / ${an.cableAmpacityA} А`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase mb-1">2. Кабельний журнал (з міжповерховими стояками)</h3>
                  <table className="w-full border border-neutral-900 text-[11px] text-left">
                    <thead className="bg-neutral-100 border-b border-neutral-900">
                      <tr>
                        <th className="p-1.5 border-r border-neutral-900">Маркер</th>
                        <th className="p-1.5 border-r border-neutral-900">Початок ➔ Кінець</th>
                        <th className="p-1.5 border-r border-neutral-900">Марка кабелю</th>
                        <th className="p-1.5 border-r border-neutral-900">Розрах. (м)</th>
                        <th className="p-1.5">З запасом (м)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {cableSchedule.map((row) => (
                        <tr key={row.id}>
                          <td className="p-1.5 border-r border-neutral-900 font-mono font-bold">{row.cableTag}</td>
                          <td className="p-1.5 border-r border-neutral-900">{row.sourceName} ➔ {row.destinationName}</td>
                          <td className="p-1.5 border-r border-neutral-900 font-mono">{row.cableSpec}</td>
                          <td className="p-1.5 border-r border-neutral-900 font-mono">{row.totalDesignLengthM} м</td>
                          <td className="p-1.5 font-mono font-bold">{row.procurementLengthM} м</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sheet 10: Bill of Materials (BOM) */}
            {activeSheet === 10 && (
              <div className="space-y-4 flex-1">
                <div className="border-b-2 border-neutral-900 pb-2 flex items-center justify-between">
                  <h1 className="text-lg font-bold uppercase">Специфікація обладнання та матеріалів</h1>
                  <div className="text-xs font-mono font-bold border border-neutral-900 px-2 py-1 bg-neutral-100">
                    ДСТУ Б В.2.5-82:2016
                  </div>
                </div>

                <table className="w-full border border-neutral-900 text-xs text-left">
                  <thead className="bg-neutral-100 border-b border-neutral-900">
                    <tr>
                      <th className="p-2 border-r border-neutral-900">Найменування кабельно-провідникової продукції / виробів</th>
                      <th className="p-2 border-r border-neutral-900">Од.</th>
                      <th className="p-2 border-r border-neutral-900">Розрахунково</th>
                      <th className="p-2">До закупівлі</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900 text-[11px]">
                    {bomCableTotals.map(([mark, len]) => (
                      <tr key={mark}>
                        <td className="p-1.5 border-r border-neutral-900 font-semibold">Кабель {mark}</td>
                        <td className="p-1.5 border-r border-neutral-900">м</td>
                        <td className="p-1.5 border-r border-neutral-900 font-mono">{len.calc.toFixed(1)}</td>
                        <td className="p-1.5 font-mono font-bold">{Math.ceil(len.proc)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="p-1.5 border-r border-neutral-900">Розетки 230В та силові (всі модифікації)</td>
                      <td className="p-1.5 border-r border-neutral-900">шт</td>
                      <td className="p-1.5 border-r border-neutral-900 font-mono">{socketElements.length}</td>
                      <td className="p-1.5 font-mono font-bold">{socketElements.length}</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border-r border-neutral-900">Вимикачі світла</td>
                      <td className="p-1.5 border-r border-neutral-900">шт</td>
                      <td className="p-1.5 border-r border-neutral-900 font-mono">{agg.allElements.filter((e) => e.category === 'switch').length}</td>
                      <td className="p-1.5 font-mono font-bold">{agg.allElements.filter((e) => e.category === 'switch').length}</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border-r border-neutral-900">Світильники / люстри / споти</td>
                      <td className="p-1.5 border-r border-neutral-900">шт</td>
                      <td className="p-1.5 border-r border-neutral-900 font-mono">{agg.allElements.filter((e) => e.category === 'light').length}</td>
                      <td className="p-1.5 font-mono font-bold">{agg.allElements.filter((e) => e.category === 'light').length}</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border-r border-neutral-900">Підрозетники (коробки установочні Ø68)</td>
                      <td className="p-1.5 border-r border-neutral-900">шт</td>
                      <td className="p-1.5 border-r border-neutral-900 font-mono">{agg.allElements.filter((e) => e.category === 'socket' || e.category === 'switch').length}</td>
                      <td className="p-1.5 font-mono font-bold">{agg.allElements.filter((e) => e.category === 'socket' || e.category === 'switch').length}</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border-r border-neutral-900">Щити розподільчі (поверхові + ВРП)</td>
                      <td className="p-1.5 border-r border-neutral-900">шт</td>
                      <td className="p-1.5 border-r border-neutral-900 font-mono">{Math.max(1, agg.syncedFloors.length)}</td>
                      <td className="p-1.5 font-mono font-bold">{Math.max(1, agg.syncedFloors.length)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* DSTU Standard Corner Stamp */}
            {renderDstuStamp(activeSheet, currentSheetMeta.fullTitle)}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between shrink-0 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Документація відповідає стандартам України ПУЕ:2017, ДБН В.2.5-23:2010 та ДСТУ Б А.2.4-4:2009</span>
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
