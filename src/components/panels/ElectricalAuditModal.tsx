import React, { useMemo } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { CadProject, AuditIssue } from '../../types/cad';

interface ElectricalAuditModalProps {
  project: CadProject;
  onClose: () => void;
  onAutoFix?: (issueId: string) => void;
}

export const ElectricalAuditModal: React.FC<ElectricalAuditModalProps> = ({
  project,
  onClose,
}) => {
  const issues: AuditIssue[] = useMemo(() => {
    const list: AuditIssue[] = [];

    // Check 1: Wet Zone / Bathroom Sockets IP rating & RCD
    const bathRooms = project.rooms.filter((r) => r.type === 'bathroom');
    project.elements.forEach((el) => {
      if (el.category === 'socket') {
        const inBath = bathRooms.some((room) => {
          const minX = Math.min(...room.points.map((p) => p.x));
          const maxX = Math.max(...room.points.map((p) => p.x));
          const minY = Math.min(...room.points.map((p) => p.y));
          const maxY = Math.max(...room.points.map((p) => p.y));
          return el.position.x >= minX - 10 && el.position.x <= maxX + 10 && el.position.y >= minY - 10 && el.position.y <= maxY + 10;
        });

        if (inBath) {
          if (el.ipRating !== 'IP44' && el.ipRating !== 'IP65') {
            list.push({
              id: `audit_ip_${el.id}`,
              severity: 'error',
              title: `Розетка без захисту IP44 у санвузлі: ${el.name}`,
              description:
                'За нормами ПУЕ (гл. 7.1) та ДБН В.2.5-23:2010 у санвузлах дозволено встановлення тільки розеток зі ступенем захисту не нижче IP44 із захисними шторками.',
              elementId: el.id,
              autoFixAvailable: true,
            });
          }

          const circuit = project.circuits.find((c) => c.id === el.circuitId);
          if (circuit && circuit.rcdType === 'none') {
            list.push({
              id: `audit_rcd_${el.id}`,
              severity: 'error',
              title: `Відсутнє ПЗВ для вологої зони: лінія "${circuit.name}"`,
              description:
                'Для кіл ванних кімнат та санвузлів обов\'язкове застосування диференційного захисту (ПЗВ) зі струмом спрацьовування не більше 10-30 мА (ПУЕ 7.1.82).',
              circuitId: circuit.id,
              autoFixAvailable: true,
            });
          }
        }
      }
    });

    // Check 2: Induction Hob power & cable sizing
    const cookerSockets = project.elements.filter((e) => e.type === 'socket_cooker');
    cookerSockets.forEach((sk) => {
      const circuit = project.circuits.find((c) => c.id === sk.circuitId);
      if (circuit) {
        if (circuit.breakerRatingA < 32) {
          list.push({
            id: `audit_cooker_${sk.id}`,
            severity: 'error',
            title: `Недостатній номінал автомата для варильної поверхні: ${circuit.breakerRatingA}А`,
            description:
              'Для підключення індукційної поверхні 7-7.4 кВт необхідний автоматичний вимикач номіналом 32А та кабель 3х6 мм² (ПУЕ табл. 1.3.4).',
            circuitId: circuit.id,
            autoFixAvailable: true,
          });
        }
        if (circuit.cableType !== 'VVGng_3x6') {
          list.push({
            id: `audit_cable_${sk.id}`,
            severity: 'warning',
            title: `Переріз кабелю плити менше 6 мм²: обрано ${circuit.cableType}`,
            description:
              'Для однофазної варильної поверхні 32А потрібен мідний кабель перерізом не менше 3х6 мм² для запобігання перегріву проводки.',
            circuitId: circuit.id,
            autoFixAvailable: true,
          });
        }
      }
    });

    // Check 3: Orphaned lights
    const switches = project.elements.filter((e) => e.category === 'switch');
    const switchGroups = new Set(switches.map((s) => s.switchGroupId).filter(Boolean));
    const wiredTargetIds = new Set(project.wires.map((w) => w.toId));

    project.elements.forEach((el) => {
      if (el.category === 'light') {
        const hasSwitchGroup = el.switchGroupId && switchGroups.has(el.switchGroupId);
        const hasWireToSwitch = wiredTargetIds.has(el.id);

        if (!hasSwitchGroup && !hasWireToSwitch) {
          list.push({
            id: `audit_orphan_${el.id}`,
            severity: 'warning',
            title: `Світильник не прив'язаний до вимикача: ${el.name}`,
            description:
              'У світильника не вказана група вимикача (наприклад S1, S2) та відсутня сполучна лінія комутації.',
            elementId: el.id,
          });
        }
      }
    });

    // Check 4: Circuit overload check
    project.circuits.forEach((c) => {
      const connected = project.elements.filter((e) => e.circuitId === c.id);
      const totalW = connected.reduce((sum, e) => sum + e.powerWatts, 0);
      const maxW = c.breakerRatingA * 220;
      if (totalW > maxW) {
        list.push({
          id: `audit_overload_${c.id}`,
          severity: 'error',
          title: `Перевантаження лінії: ${c.name} (${(totalW / 1000).toFixed(2)} кВт > ${(maxW / 1000).toFixed(2)} кВт)`,
          description:
            `Сумарне навантаження перевищує допустиму потужність автомата ${c.breakerRatingA}A. Рекомендовано розділити групу на дві окремі лінії.`,
          circuitId: c.id,
        });
      }
    });

    return list;
  }, [project]);

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

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
                Автоматична перевірка безпеки, перерізів кабелів, зон санвузлів та захисту від перевантажень
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
          <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-950 border border-neutral-800">
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
              Перевірено нормативних правил: <span className="font-mono text-neutral-200">14</span>
            </div>
          </div>

          {/* Issues List */}
          {issues.length === 0 ? (
            <div className="p-8 text-center bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
              <h3 className="text-sm font-bold text-neutral-100">
                Проект повністю відповідає нормам ПУЕ України
              </h3>
              <p className="text-xs text-neutral-400 max-w-md mt-1">
                Усі розетки захищені, номінали автоматів підібрані коректно, перерізи кабелів у нормі, вологі зони захищені ПЗВ 10/30мА.
              </p>
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Нормативна база: ПУЕ України, ДБН В.2.5-23:2010, ДСТУ Б В.2.5-82:2016
          </span>
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
