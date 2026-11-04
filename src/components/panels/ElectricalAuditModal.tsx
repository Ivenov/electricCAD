/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Info, Wrench, Sparkles, BookOpen } from 'lucide-react';
import { CadProject, AuditIssue } from '../../types/cad';
import { runPueAudit, NORMATIVE_RULES_REGISTRY } from '../../utils/pueRulesRegistry';

interface ElectricalAuditModalProps {
  project: CadProject;
  onClose: () => void;
  onAutoFix?: (issueId: string) => void;
  onAutoFixAll?: () => void;
}

export const ElectricalAuditModal: React.FC<ElectricalAuditModalProps> = ({
  project,
  onClose,
  onAutoFix,
  onAutoFixAll,
}) => {
  const auditResult = useMemo(() => {
    return runPueAudit(project);
  }, [project]);

  const { issues, checkedRulesCount, errorCount, warningCount } = auditResult;
  const fixableCount = issues.filter((i) => i.autoFixAvailable).length;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Аудит норм ПУЕ та перевірка помилок (DRC)
              </h2>
              <p className="text-xs text-neutral-400">
                Автоматична перевірка безпеки, перерізів кабелів, вологих зон та захисту від перевантажень
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Status banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-neutral-950 border border-neutral-800">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-xs font-semibold text-neutral-200">
                  Критичних порушень: <span className="font-mono text-rose-400">{errorCount}</span>
                </span>
              </div>
              <span className="text-neutral-700">|</span>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold text-neutral-200">
                  Попереджень: <span className="font-mono text-amber-400">{warningCount}</span>
                </span>
              </div>
              <span className="text-neutral-700">|</span>
              <div className="text-xs text-neutral-400">
                Перевірено правил: <span className="font-mono text-neutral-200">{checkedRulesCount}</span>
              </div>
            </div>

            {fixableCount > 0 && onAutoFixAll && (
              <button
                onClick={onAutoFixAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs transition-colors shadow-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Автовиправлення ({fixableCount})</span>
              </button>
            )}
          </div>

          {/* Issues List */}
          {issues.length === 0 ? (
            <div className="p-8 text-center bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
              <h3 className="text-sm font-bold text-neutral-100">
                Зауважень за {checkedRulesCount} перевіреними критеріями не виявлено
              </h3>
              <p className="text-xs text-neutral-400 max-w-lg mt-1.5 leading-relaxed">
                Вологі зони перевірені за геометрією полігонів кімнат, номінали автоматів відповідають допустимим струмам кабелів, розрахункові навантаження в нормі.
              </p>
              <div className="text-[11px] text-neutral-500 mt-3 border-t border-neutral-800 pt-2">
                Примітка: автоматичний аудит DRC є інструментом інженерного контролю та не замінює державну експертизу проекту.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-4 rounded-xl border flex items-start gap-3.5 transition-colors ${
                    issue.severity === 'error'
                      ? 'bg-rose-950/20 border-rose-800/60'
                      : 'bg-amber-950/20 border-amber-800/60'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {issue.severity === 'error' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Info className="w-4 h-4 text-amber-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4
                        className={`text-xs font-bold ${
                          issue.severity === 'error' ? 'text-rose-200' : 'text-amber-200'
                        }`}
                      >
                        {issue.title}
                      </h4>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                          issue.severity === 'error'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {issue.severity === 'error' ? 'ПОМИЛКА ПУЕ' : 'УВАГА'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                      {issue.description}
                    </p>

                    {issue.autoFixAvailable && onAutoFix && (
                      <div className="mt-2.5">
                        <button
                          onClick={() => onAutoFix(issue.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 hover:text-sky-200 text-[11px] font-semibold transition-colors"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Виправити автоматично</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>Нормативна база: ПУЕ-2017 (гл. 1.3, 6.1, 7.1), ДБН В.2.5-23:2010, ДСТУ Б В.2.5-82:2016</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold rounded-lg text-xs transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
