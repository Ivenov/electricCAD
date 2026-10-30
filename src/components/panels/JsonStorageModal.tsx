import React, { useState } from 'react';
import { Copy, Check, Download, Code2, Table, RefreshCw } from 'lucide-react';
import { CadProject } from '../../types/cad';
import { pxToMm } from '../../utils/cadMath';

interface JsonStorageModalProps {
  project: CadProject;
  onApplyJson: (project: CadProject) => void;
  onClose: () => void;
}

export const JsonStorageModal: React.FC<JsonStorageModalProps> = ({
  project,
  onApplyJson,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'json' | 'table'>('json');
  const [copied, setCopied] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(project, null, 2));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Copy JSON
  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download JSON
  const handleDownload = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonText);
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `${project.title.replace(/\s+/g, '_')}_Coordinates.json`;
    link.click();
    link.remove();
  };

  // Apply edited JSON
  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.elements || !parsed.circuits) {
        setErrorMessage('Некоректна структура проекту: відсутні обов\'язкові масиви elements або circuits.');
        return;
      }
      onApplyJson(parsed);
      setErrorMessage(null);
      onClose();
    } catch (err: any) {
      setErrorMessage(`Синтаксична помилка JSON: ${err?.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                База даних проекту та координатна сітка (JSON)
              </h2>
              <p className="text-xs text-neutral-400">
                Структуроване збереження координат (X, Y), типів обладнання, фаз, груп та довжин кабелів
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-0.5 bg-neutral-950 rounded-lg border border-neutral-800 mr-2">
              <button
                onClick={() => setActiveTab('json')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'json'
                    ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'table'
                    ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Сітка координат</span>
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 rounded-lg transition-colors border border-neutral-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопійовано!' : 'Копіювати'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 rounded-lg transition-colors border border-neutral-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Завантажити .json</span>
            </button>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-100 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error notification if JSON is invalid */}
        {errorMessage && (
          <div className="bg-rose-950/40 border-b border-rose-800/80 px-6 py-2.5 text-xs text-rose-300 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-neutral-950 font-mono text-xs">
          {activeTab === 'json' ? (
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="w-full h-full min-h-[480px] bg-transparent text-emerald-400 font-mono text-xs leading-relaxed focus:outline-none resize-none selection:bg-sky-900"
              spellCheck={false}
            />
          ) : (
            <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950 text-[11px] text-neutral-400">
                    <th className="py-2 px-3 font-medium">ID</th>
                    <th className="py-2 px-3 font-medium">Елемент</th>
                    <th className="py-2 px-3 font-medium text-right">X (мм)</th>
                    <th className="py-2 px-3 font-medium text-right">Y (мм)</th>
                    <th className="py-2 px-3 font-medium text-right">Висота Z</th>
                    <th className="py-2 px-3 font-medium text-center">Кут</th>
                    <th className="py-2 px-3 font-medium text-center">Фаза</th>
                    <th className="py-2 px-3 font-medium">Група / Щит</th>
                    <th className="py-2 px-3 font-medium text-right">Потужність</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-sans">
                  {project.elements.map((el) => {
                    const circuit = project.circuits.find((c) => c.id === el.circuitId);
                    return (
                      <tr key={el.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-2 px-3 font-mono text-[11px] text-neutral-400">{el.id}</td>
                        <td className="py-2 px-3 font-medium text-neutral-200">
                          {el.name}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-neutral-300 tabular-nums">
                          {pxToMm(el.position.x)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-neutral-300 tabular-nums">
                          {pxToMm(el.position.y)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-sky-400 tabular-nums">
                          +{el.mountingHeightMm} мм
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-neutral-400">
                          {el.rotation}°
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-amber-400">
                          {circuit?.phase || el.phase || 'L1'}
                        </td>
                        <td className="py-2 px-3">
                          {circuit ? (
                            <span className="text-[11px] font-semibold text-neutral-200">
                              Гр.{circuit.number} ({circuit.breakerRatingA}A)
                            </span>
                          ) : (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-neutral-300 tabular-nums">
                          {el.powerWatts > 0 ? `${el.powerWatts} Вт` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between">
          <div className="text-xs text-neutral-400 flex items-center gap-2">
            <span>Елементів у базі: <strong className="text-neutral-200 font-mono">{project.elements.length}</strong></span>
            <span>·</span>
            <span>Трас кабелів: <strong className="text-neutral-200 font-mono">{project.wires.length}</strong></span>
            <span>·</span>
            <span>Сумарна довжина трас: <strong className="text-sky-400 font-mono">{project.wires.reduce((s, w) => s + w.calculatedLengthM, 0).toFixed(1)} м</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setJsonText(JSON.stringify(project, null, 2))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Скинути до поточного</span>
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold rounded-lg text-xs transition-colors"
            >
              Застосувати зміни у проект
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
