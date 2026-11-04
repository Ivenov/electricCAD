/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Інтерактивна схема підключення вимикачів за ПУЕ України (§6.1.14, §7.1.50)
 * Візуалізація: Фаза (L) обов'язково йде спочатку на вимикач,
 * а комутована фаза (L') — від вимикача до світильника.
 */

import React, { useState } from 'react';
import { X, Zap, Lightbulb, ToggleLeft, ArrowRight, ShieldCheck, CheckCircle2, Info } from 'lucide-react';
import { ElectricalElement, CircuitGroup, CadProject } from '../../types/cad';

interface SwitchWiringDiagramModalProps {
  onClose: () => void;
  selectedSwitch?: ElectricalElement | null;
  circuit?: CircuitGroup | null;
  project?: CadProject | null;
}

export const SwitchWiringDiagramModal: React.FC<SwitchWiringDiagramModalProps> = ({
  onClose,
  selectedSwitch,
  circuit,
}) => {
  const [switchType, setSwitchType] = useState<'1g' | '2g' | 'pass'>(
    selectedSwitch?.type === 'switch_2g' ? '2g' : '1g'
  );
  const [isSwitchClosed, setIsSwitchClosed] = useState(true); // Interactive switch on/off state

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <span>Схема підключення вимикача за ПУЕ України</span>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60">
                  ПУЕ §6.1.14 · L ➔ SW ➔ L' ➔ LAMP
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Фаза <span className="text-amber-400 font-semibold font-mono">L</span> завжди подається спочатку на вимикач, комутована фаза <span className="text-yellow-400 font-semibold font-mono">L'</span> — на світильник, а нуль <span className="text-sky-400 font-semibold font-mono">N</span> та земля <span className="text-emerald-400 font-semibold font-mono">PE</span> йдуть напряму.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Switch type tabs & interactive switch simulation */}
        <div className="px-6 py-3 border-b border-neutral-800/80 bg-neutral-950/40 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium">Тип схеми:</span>
            <div className="flex p-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
              <button
                onClick={() => setSwitchType('1g')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  switchType === '1g'
                    ? 'bg-neutral-800 text-amber-400 font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                1-клавішний
              </button>
              <button
                onClick={() => setSwitchType('2g')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  switchType === '2g'
                    ? 'bg-neutral-800 text-amber-400 font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                2-клавішний (дві групи)
              </button>
              <button
                onClick={() => setSwitchType('pass')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  switchType === 'pass'
                    ? 'bg-neutral-800 text-amber-400 font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Прохідний (з двох місць)
              </button>
            </div>
          </div>

          <button
            onClick={() => setIsSwitchClosed(!isSwitchClosed)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all ${
              isSwitchClosed
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200'
            }`}
          >
            <ToggleLeft className={`w-4 h-4 transition-transform ${isSwitchClosed ? 'rotate-180 text-amber-400' : ''}`} />
            <span>Клавіша: {isSwitchClosed ? 'УВІМКНЕНО (Коло замкнено)' : 'ВИМКНЕНО (Коло розімкнено)'}</span>
          </button>
        </div>

        {/* Interactive Schematic Diagram SVG Canvas */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-[#0d0f12]">
          <div className="w-full max-w-3xl bg-[#13161c] border border-neutral-800 rounded-xl p-5 shadow-inner">
            <svg viewBox="0 0 740 340" className="w-full h-auto select-none">
              <defs>
                {/* Arrow markers */}
                <marker id="arrowL" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#d97706" />
                </marker>
                <marker id="arrowLPrime" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#facc15" />
                </marker>
                <marker id="arrowN" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
                </marker>
                <marker id="arrowPE" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#4ade80" />
                </marker>
              </defs>

              {/* 1. Electrical Panel (Щит QF 10A) */}
              <g transform="translate(30, 40)">
                <rect width="90" height="150" rx="6" fill="#1e2430" stroke="#475569" strokeWidth="2" />
                <rect x="15" y="12" width="60" height="20" rx="3" fill="#0f172a" stroke="#64748b" strokeWidth="1" />
                <text x="45" y="26" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold" fontFamily="monospace">ЩИТ ВРП</text>
                
                {/* Breaker symbol */}
                <rect x="25" y="44" width="40" height="50" rx="4" fill="#090d16" stroke="#f59e0b" strokeWidth="1.5" />
                <text x="45" y="66" textAnchor="middle" fill="#f59e0b" fontSize="11" fontWeight="bold" fontFamily="monospace">QF1</text>
                <text x="45" y="82" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontFamily="monospace">10A / 1.5</text>

                {/* Terminals */}
                <circle cx="90" cy="55" r="4" fill="#d97706" />
                <text x="75" y="58" fill="#d97706" fontSize="9" fontWeight="bold" fontFamily="monospace">L</text>

                <circle cx="90" cy="110" r="4" fill="#38bdf8" />
                <text x="75" y="113" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">N</text>

                <circle cx="90" cy="150" r="4" fill="#4ade80" />
                <text x="75" y="153" fill="#4ade80" fontSize="9" fontWeight="bold" fontFamily="monospace">PE</text>
              </g>

              {/* 2. Junction Box (Розподільча коробка РК-L під стелею) */}
              <g transform="translate(240, 25)">
                <circle cx="65" cy="85" r="55" fill="#18202f" stroke="#0284c7" strokeWidth="2.5" />
                <text x="65" y="24" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="bold">
                  РОЗПОДІЛЬЧА КОРОБКА (РК-L)
                </text>
                <text x="65" y="37" textAnchor="middle" fill="#94a3b8" fontSize="9">
                  (Встановлюється 200 мм від стелі)
                </text>

                {/* WAGO Clamps inside Box */}
                {/* Clamp 1: Incoming Phase L to Switch Drop */}
                <rect x="25" y="55" width="22" height="16" rx="2" fill="#78350f" stroke="#f59e0b" strokeWidth="1" />
                <text x="36" y="67" textAnchor="middle" fill="#fef08a" fontSize="8" fontWeight="bold">W1</text>

                {/* Clamp 2: Neutral N to Lamp */}
                <rect x="54" y="80" width="22" height="16" rx="2" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="1" />
                <text x="65" y="92" textAnchor="middle" fill="#e0f2fe" fontSize="8" fontWeight="bold">WN</text>

                {/* Clamp 3: Switched Phase L' from switch to lamp */}
                <rect x="25" y="105" width="22" height="16" rx="2" fill="#713f12" stroke="#eab308" strokeWidth="1" />
                <text x="36" y="117" textAnchor="middle" fill="#fef9c3" fontSize="8" fontWeight="bold">W2</text>

                {/* Clamp 4: PE Ground */}
                <rect x="85" y="105" width="22" height="16" rx="2" fill="#14532d" stroke="#4ade80" strokeWidth="1" />
                <text x="96" y="117" textAnchor="middle" fill="#dcfce7" fontSize="8" fontWeight="bold">WPE</text>
              </g>

              {/* 3. Wall Switch (Вимикач на висоті 900 мм) */}
              <g transform="translate(245, 210)">
                <rect width="120" height="105" rx="8" fill="#1c1917" stroke="#f59e0b" strokeWidth="2" />
                <text x="60" y="-8" textAnchor="middle" fill="#fbbf24" fontSize="11" fontWeight="bold">
                  ВИМИКАЧ (h = +900 мм)
                </text>

                {/* Switch mechanism drawing */}
                <circle cx="28" cy="35" r="4.5" fill="#d97706" />
                <text x="28" y="24" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="bold">L (Вхід)</text>

                <circle cx="92" cy="35" r="4.5" fill="#facc15" />
                <text x="92" y="24" textAnchor="middle" fill="#facc15" fontSize="9" fontWeight="bold">1 (Вихід L')</text>

                {/* Rocker Contact line */}
                {isSwitchClosed ? (
                  <line x1="28" y1="35" x2="92" y2="35" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
                ) : (
                  <line x1="28" y1="35" x2="80" y2="18" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                )}

                <text x="60" y="65" textAnchor="middle" fill={isSwitchClosed ? '#4ade80' : '#ef4444'} fontSize="10" fontWeight="bold">
                  {isSwitchClosed ? '● КОНТАКТ ЗАМКНУТО' : '○ КОНТАКТ РОЗІМКНУТО'}
                </text>
                <text x="60" y="85" textAnchor="middle" fill="#a8a29e" fontSize="8.5">
                  Розриває ТІЛЬКИ фазний провід L
                </text>
              </g>

              {/* 4. Luminaire / Lamp (Світильник на стелі) */}
              <g transform="translate(560, 50)">
                <circle cx="70" cy="70" r="48" fill={isSwitchClosed ? '#422006' : '#1c1917'} stroke={isSwitchClosed ? '#facc15' : '#78716c'} strokeWidth="2.5" />
                {isSwitchClosed && (
                  <circle cx="70" cy="70" r="62" fill="none" stroke="#fde047" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
                )}
                
                {/* Lamp bulb icon */}
                <path
                  d="M 60 55 C 60 45, 80 45, 80 55 C 80 62, 75 66, 75 72 L 65 72 C 65 66, 60 62, 60 55 Z"
                  fill={isSwitchClosed ? '#fef08a' : '#78716c'}
                  stroke={isSwitchClosed ? '#ca8a04' : '#44403c'}
                  strokeWidth="1.5"
                />
                <rect x="66" y="73" width="8" height="5" fill="#a8a29e" />
                <rect x="68" y="78" width="4" height="2" fill="#78716c" />

                <text x="70" y="105" textAnchor="middle" fill={isSwitchClosed ? '#fef08a' : '#a8a29e'} fontSize="11" fontWeight="bold">
                  СВІТИЛЬНИК
                </text>
                <text x="70" y="120" textAnchor="middle" fill={isSwitchClosed ? '#4ade80' : '#f87171'} fontSize="9" fontWeight="bold">
                  {isSwitchClosed ? 'СВІТИТЬСЯ (L + N)' : 'НЕ СВІТИТЬСЯ (0В)'}
                </text>
              </g>

              {/* ======================================================== */}
              {/* WIRES / CABLE RUNS WITH FLOW DIRECTION ARROWS            */}
              {/* ======================================================== */}

              {/* WIRE 1: Panel -> Junction Box (Phase L: Brown) */}
              <path
                d="M 120 95 L 265 95"
                fill="none"
                stroke="#d97706"
                strokeWidth="3.5"
                markerEnd="url(#arrowL)"
              />
              <rect x="145" y="78" width="85" height="15" rx="3" fill="#1c1917" stroke="#d97706" strokeWidth="0.8" />
              <text x="187" y="89" textAnchor="middle" fill="#fbbf24" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                Ввід Фази (L)
              </text>

              {/* WIRE 2: Panel -> Junction Box (Neutral N: Blue) */}
              <path
                d="M 120 150 L 195 150 L 195 110 L 294 110"
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                strokeDasharray="6 3"
              />

              {/* WIRE 3: Panel -> Junction Box (PE Ground: Green/Yellow) */}
              <path
                d="M 120 190 L 215 190 L 215 130 L 325 130"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeDasharray="4 4"
              />

              {/* WIRE 4: Vertical Drop: Junction Box -> Switch (Phase L: Brown) */}
              <path
                d="M 276 95 L 273 245"
                fill="none"
                stroke="#d97706"
                strokeWidth="3.5"
                markerEnd="url(#arrowL)"
              />
              <rect x="282" y="150" width="102" height="24" rx="3" fill="#090d16" stroke="#f59e0b" strokeWidth="1" />
              <text x="333" y="162" textAnchor="middle" fill="#fde68a" fontSize="8.5" fontWeight="bold">
                ↓ ОПУСК ФАЗИ (L)
              </text>
              <text x="333" y="171" textAnchor="middle" fill="#94a3b8" fontSize="7.5">
                (Штроба у стіні 90°)
              </text>

              {/* WIRE 5: Return: Switch -> Junction Box (Switched Phase L': Yellow) */}
              <path
                d="M 337 245 L 337 145 L 276 145"
                fill="none"
                stroke={isSwitchClosed ? '#eab308' : '#78716c'}
                strokeWidth="3"
                strokeDasharray={isSwitchClosed ? undefined : '5 4'}
                markerEnd="url(#arrowLPrime)"
              />
              <rect x="345" y="180" width="112" height="24" rx="3" fill="#090d16" stroke="#eab308" strokeWidth="1" />
              <text x="401" y="192" textAnchor="middle" fill="#facc15" fontSize="8.5" fontWeight="bold">
                ↑ КОМУТОВАНА (L')
              </text>
              <text x="401" y="201" textAnchor="middle" fill="#94a3b8" fontSize="7.5">
                (Підйом фази до РК)
              </text>

              {/* WIRE 6: Junction Box -> Luminaire (Switched Phase L': Yellow) */}
              <path
                d="M 285 145 L 490 145 L 490 100 L 560 100"
                fill="none"
                stroke={isSwitchClosed ? '#eab308' : '#78716c'}
                strokeWidth="3.5"
                markerEnd="url(#arrowLPrime)"
              />
              <rect x="420" y="80" width="105" height="16" rx="3" fill="#090d16" stroke="#eab308" strokeWidth="1" />
              <text x="472" y="92" textAnchor="middle" fill="#facc15" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                Фаза L' ➔ Патрон
              </text>

              {/* WIRE 7: Junction Box -> Luminaire (Neutral N: Blue direct) */}
              <path
                d="M 315 105 L 560 120"
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                markerEnd="url(#arrowN)"
              />
              <rect x="400" y="112" width="75" height="14" rx="3" fill="#090d16" stroke="#0284c7" strokeWidth="0.8" />
              <text x="437" y="122" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold" fontFamily="monospace">
                Нуль N (Прямо)
              </text>

              {/* WIRE 8: Junction Box -> Luminaire (PE Ground: Green direct) */}
              <path
                d="M 345 130 L 560 140"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeDasharray="4 4"
                markerEnd="url(#arrowPE)"
              />
            </svg>
          </div>

          {/* Standards explanation and installer rules table */}
          <div className="w-full max-w-3xl mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
              <div className="font-semibold text-neutral-200 flex items-center gap-2 text-amber-400">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Вимога ПУЕ України (§6.1.14):</span>
              </div>
              <p className="text-neutral-400 leading-relaxed text-[11px]">
                В апаратах керування освітленням (вимикачах) <strong>обов'язково повинен розриватися фазний провідник L</strong>. Забороняється розривати нульовий провідник N, залишаючи патрон світильника під постійною напругою 230 В.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
              <div className="font-semibold text-neutral-200 flex items-center gap-2 text-sky-400">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Кольорове маркування жил кабелю:</span>
              </div>
              <ul className="text-neutral-400 text-[11px] space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" />
                  <span><strong>Коричневий (L)</strong>: Постійна фаза від щита до вимикача</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
                  <span><strong>Чорний/Білий (L')</strong>: Комутована фаза до світильника</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
                  <span><strong>Синій (N)</strong>: Робочий нуль напряму від РК до патрона</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>На плані креслення траса від РК до вимикача автоматично маркується як <strong>«Опуск L + L'»</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
          >
            Зрозуміло / Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
