import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { TEMPLATES } from '../../data/templates';
import { CadProject } from '../../types/cad';

interface TemplatesModalProps {
  onSelectTemplate: (project: CadProject) => void;
  onClose: () => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({ onSelectTemplate, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Бібліотека типових проектів
              </h2>
              <p className="text-xs text-neutral-400">
                Оберіть готовий проект із розведеною електрикою або почніть із чистого аркуша
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => {
                onSelectTemplate(JSON.parse(JSON.stringify(tmpl.project)));
                onClose();
              }}
              className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-900/80 hover:border-sky-500/60 cursor-pointer transition-all duration-150 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-neutral-100 group-hover:text-sky-400 transition-colors flex items-center gap-1.5">
                    {tmpl.id === 'house_blueprint_160m' && (
                      <span className="text-xs">📐</span>
                    )}
                    {tmpl.id === 'house_one_story' && (
                      <span className="text-xs">🏡</span>
                    )}
                    {tmpl.name}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                    {tmpl.area}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {tmpl.id === 'house_blueprint_160m' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                      <span>📐</span> За планом-схемою
                    </span>
                  )}
                  {tmpl.project.backupSystem?.enabled && (
                    <>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <span>⚡</span> Інвертор {tmpl.project.backupSystem.inverterPowerW / 1000} кВт
                      </span>
                      {tmpl.project.backupSystem.generatorPowerW && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <span>⛽</span> Генератор {tmpl.project.backupSystem.generatorPowerW / 1000} кВт
                        </span>
                      )}
                    </>
                  )}
                  {tmpl.id === 'house_blueprint_160m' && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                      <span>🚗</span> Гараж + Веранда 10.6м
                    </span>
                  )}
                  {tmpl.id === 'house_one_story' && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                      <span>💡</span> Фасадне IP65
                    </span>
                  )}
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  {tmpl.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-500">
                <span>
                  {tmpl.project.elements.length > 0
                    ? `Точок: ${tmpl.project.elements.length} · Груп: ${tmpl.project.circuits.length}`
                    : 'Чистий аркуш'}
                </span>
                <span className="text-sky-400 font-semibold group-hover:underline">
                  Завантажити проект →
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
};
