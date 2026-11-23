/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileSpreadsheet, Upload, Download, Check, AlertTriangle, X, Plus, Sparkles } from 'lucide-react';
import { CircuitGroup } from '../../types/cad';
import { parseCircuitsCsv, getSampleCircuitsCsvTemplate, downloadCsvFile } from '../../utils/excelCsvUtils';

interface ImportCircuitsModalProps {
  existingCircuits: CircuitGroup[];
  onImport: (newCircuits: CircuitGroup[], mode: 'replace' | 'append') => void;
  onClose: () => void;
}

export const ImportCircuitsModal: React.FC<ImportCircuitsModalProps> = ({
  existingCircuits,
  onImport,
  onClose,
}) => {
  const [rawText, setRawText] = useState<string>('');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [parsedResult, setParsedResult] = useState<ReturnType<typeof parseCircuitsCsv> | null>(null);

  const handleParse = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setParsedResult(null);
      return;
    }
    const res = parseCircuitsCsv(text);
    setParsedResult(res);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleParse(content);
      }
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    if (!parsedResult || parsedResult.circuits.length === 0) return;
    onImport(parsedResult.circuits, importMode);
    onClose();
  };

  const handleDownloadTemplate = () => {
    const csvContent = getSampleCircuitsCsvTemplate(';');
    downloadCsvFile('electroplan_circuits_template.csv', csvContent);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 border-b border-neutral-800 px-6 flex items-center justify-between shrink-0 bg-neutral-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Імпорт електричних кіл з Excel / CSV</h2>
              <p className="text-[11px] text-neutral-400">
                Завантажте файл таблиці або скопіюйте комірки з Excel/Google Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Action cards: Download sample & File upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleDownloadTemplate}
              className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-sky-500/50 hover:bg-neutral-900 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-neutral-200 block">Завантажити зразок Excel</span>
                  <span className="text-[10px] text-neutral-500 block">Шаблон із правильними колонками (.csv)</span>
                </div>
              </div>
            </button>

            <label className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-emerald-500/50 hover:bg-neutral-900 transition-all text-left flex items-center justify-between group cursor-pointer">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-neutral-200 block">Вибрати файл .csv / .xlsx</span>
                  <span className="text-[10px] text-neutral-500 block">Автоматичний аналіз колонок</span>
                </div>
              </div>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Paste area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-neutral-300">
                Або вставте скопійовані рядки з таблиці (Paste Ctrl+V):
              </label>
              {rawText && (
                <button
                  onClick={() => handleParse('')}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Очистити
                </button>
              )}
            </div>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => handleParse(e.target.value)}
              placeholder="Номер;Назва групи;Потужність;Фаза;Кабель;Автомат;Крива;ПЗВ&#10;1;Освітлення коридор;350;L1;ВВГнгд 3х1.5;10;B;none&#10;2;Розетки кухня;3500;L1;ВВГнгд 3х2.5;16;C;rcd_30ma"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 font-mono text-[11px] text-neutral-200 focus:outline-none focus:border-emerald-500/70 placeholder:text-neutral-600 transition-colors"
            />
          </div>

          {/* Parsed Preview Table */}
          {parsedResult && parsedResult.circuits.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white text-xs">
                    Розпізнано груп: {parsedResult.circuits.length}
                  </span>
                </div>

                {/* Import Mode: Replace vs Append */}
                <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      importMode === 'replace'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Замінити всі ({existingCircuits.length} наявних)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('append')}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      importMode === 'append'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Додати до наявних
                  </button>
                </div>
              </div>

              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 text-[10px] font-semibold">
                      <th className="py-2 px-3 w-12 text-center">№</th>
                      <th className="py-2 px-3">Назва лінії</th>
                      <th className="py-2 px-3 w-16 text-center">Фаза</th>
                      <th className="py-2 px-3">Кабель</th>
                      <th className="py-2 px-3 w-20 text-center">Автомат</th>
                      <th className="py-2 px-3">ПЗВ / Диф</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                    {parsedResult.circuits.slice(0, 10).map((c) => (
                      <tr key={c.id} className="hover:bg-neutral-900/40 transition-colors">
                        <td className="py-1.5 px-3 text-center font-bold text-sky-400">
                          {c.number}
                        </td>
                        <td className="py-1.5 px-3 font-sans text-neutral-200 font-medium truncate max-w-[220px]">
                          {c.name}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                            c.phase === 'L1' ? 'bg-amber-950/60 text-amber-300' :
                            c.phase === 'L2' ? 'bg-sky-950/60 text-sky-300' :
                            'bg-emerald-950/60 text-emerald-300'
                          }`}>
                            {c.phase}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-neutral-300 text-[10px]">
                          {c.cableType.replace('VVGng_', 'ВВГнгд ').replace('x', '×')}
                        </td>
                        <td className="py-1.5 px-3 text-center text-amber-400 font-bold">
                          {c.breakerCurve}{c.breakerRatingA}A
                        </td>
                        <td className="py-1.5 px-3 text-[10px] text-neutral-400 truncate max-w-[140px]">
                          {c.rcdType !== 'none' ? c.rcdType.toUpperCase() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedResult.circuits.length > 10 && (
                  <div className="py-1.5 px-3 text-[10px] text-neutral-500 bg-neutral-900/40 text-center border-t border-neutral-800/60">
                    ...та ще {parsedResult.circuits.length - 10} груп
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-16 border-t border-neutral-800 px-6 flex items-center justify-between shrink-0 bg-neutral-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors font-medium text-xs"
          >
            Скасувати
          </button>

          <button
            onClick={handleApply}
            disabled={!parsedResult || parsedResult.circuits.length === 0}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>
              {parsedResult && parsedResult.circuits.length > 0
                ? `Імпортувати ${parsedResult.circuits.length} груп`
                : 'Імпортувати в щит'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
