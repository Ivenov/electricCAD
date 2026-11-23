/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Модуль «Розгортка стін та схема штроблення» (Wall Elevation & Chasing View)
 * Проекція електроточок на стіну, вертикальні опусти штроб та розмірні ланцюжки за ПУЕ §2.1 та ДСТУ
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Layers,
  Ruler,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Zap,
  Sliders,
} from 'lucide-react';
import { CadProject, Wall, WallOpening, ElectricalElement, Point } from '../../types/cad';

interface WallElevationModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: CadProject;
  initialWallId?: string;
}

interface ProjectedElement {
  element: ElectricalElement;
  distanceAlongWallMm: number; // від початку стіни (0 .. length)
  heightFromFloorMm: number;   // висота монтажу від підлоги (0 .. ceilingHeight)
  gangIndex?: number;
  totalGangs?: number;
}

export const WallElevationModal: React.FC<WallElevationModalProps> = ({
  isOpen,
  onClose,
  project,
  initialWallId,
}) => {
  // Список стін
  const walls = project.walls;
  const [selectedWallId, setSelectedWallId] = useState<string>(
    initialWallId || (walls.length > 0 ? walls[0].id : '')
  );

  // Параметри відображення
  const [showChases, setShowChases] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [showCableTags, setShowCableTags] = useState<boolean>(true);

  const svgRef = useRef<SVGSVGElement>(null);

  if (!isOpen || walls.length === 0) return null;

  const currentWallIndex = walls.findIndex((w) => w.id === selectedWallId);
  const selectedWall = walls[currentWallIndex] || walls[0];

  // Довжина поточної стіни у мм
  const wallDx = selectedWall.end.x - selectedWall.start.x;
  const wallDy = selectedWall.end.y - selectedWall.start.y;
  const wallPixelLen = Math.hypot(wallDx, wallDy);
  const wallLengthMm = Math.round(wallPixelLen * 100); // 1px = 10mm -> 100 multiplier for real mm (scale 0.1)
  const ceilingHeightMm = project.ceilingHeightMm || 2700;

  // Отвори на вибраній стіні
  const openingsOnWall = project.openings.filter((op) => op.wallId === selectedWall.id);

  // Електроприлади на цій стіні: перевіряємо як wallId, так і відстань до відрізка
  const projectedElements: ProjectedElement[] = useMemo(() => {
    const list: ProjectedElement[] = [];
    const len = wallPixelLen;
    if (len === 0) return [];

    const ux = wallDx / len;
    const uy = wallDy / len;

    project.elements.forEach((el) => {
      // Вектор від start стіни до елемента
      const vx = el.position.x - selectedWall.start.x;
      const vy = el.position.y - selectedWall.start.y;

      // Проекція вздовж стіни t
      const t = vx * ux + vy * uy;
      // Відстань від прямої
      const distToLine = Math.abs(vx * -uy + vy * ux);

      // Якщо елемент явно прив'язаний до цієї стіни або знаходиться в межах 150 мм від неї
      const isAttached = el.wallId === selectedWall.id;
      const isNearby = distToLine <= 18 && t >= -10 && t <= len + 10;

      if (isAttached || isNearby) {
        const distMm = Math.max(0, Math.min(wallLengthMm, Math.round(t * 100)));
        list.push({
          element: el,
          distanceAlongWallMm: distMm,
          heightFromFloorMm: el.mountingHeightMm || 300,
        });
      }
    });

    // Сортуємо за відстанню вздовж стіни
    list.sort((a, b) => a.distanceAlongWallMm - b.distanceAlongWallMm);

    // Кластеризація постів (рамки на 2-5 гнізд)
    for (let i = 0; i < list.length; i++) {
      const cluster = [list[i]];
      for (let j = i + 1; j < list.length; j++) {
        if (
          Math.abs(list[j].distanceAlongWallMm - list[i].distanceAlongWallMm) <= 250 &&
          Math.abs(list[j].heightFromFloorMm - list[i].heightFromFloorMm) <= 100
        ) {
          cluster.push(list[j]);
        }
      }
      if (cluster.length > 1) {
        cluster.forEach((item, idx) => {
          item.gangIndex = idx;
          item.totalGangs = cluster.length;
        });
      }
    }

    return list;
  }, [project.elements, selectedWall, wallDx, wallDy, wallPixelLen, wallLengthMm]);

  // Навігація між стінами
  const handlePrevWall = () => {
    const nextIdx = (currentWallIndex - 1 + walls.length) % walls.length;
    setSelectedWallId(walls[nextIdx].id);
  };

  const handleNextWall = () => {
    const nextIdx = (currentWallIndex + 1) % walls.length;
    setSelectedWallId(walls[nextIdx].id);
  };

  // Експорт розгортки в SVG файл
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Розгортка_${selectedWall.id}_${wallLengthMm}мм.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Геометрія SVG полотна
  const svgWidth = 900;
  const svgHeight = 480;
  const marginX = 80;
  const marginY = 80;
  const drawWidth = svgWidth - marginX * 2;
  const drawHeight = svgHeight - marginY * 2;

  const scaleX = drawWidth / Math.max(1000, wallLengthMm);
  const scaleY = drawHeight / Math.max(2000, ceilingHeightMm);

  // Функції перетворення координат (чистова підлога знизу, стеля зверху)
  const toSvgX = (mm: number) => marginX + mm * scaleX;
  const toSvgY = (mm: number) => marginY + drawHeight - mm * scaleY;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col text-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Розгортка стіни & Схема штроблення
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
                  ПУЕ §2.1 & ДСТУ 21.608
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Вертикальна проекція електроточок, розмірні прив’язки та нормативні траси штроблення
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSvg}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              SVG Креслення
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Wall Selector */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Вибрана стіна:</span>
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                onClick={handlePrevWall}
                className="p-1 hover:bg-slate-700 rounded text-slate-300"
                title="Попередня стіна"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedWallId}
                onChange={(e) => setSelectedWallId(e.target.value)}
                className="bg-transparent text-white font-semibold px-2 py-0.5 outline-none cursor-pointer text-xs"
              >
                {walls.map((w, idx) => {
                  const lenMm = Math.round(Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y) * 100);
                  const count = project.elements.filter(
                    (el) => el.wallId === w.id || Math.hypot(el.position.x - w.start.x, el.position.y - w.start.y) < 100
                  ).length;
                  return (
                    <option key={w.id} value={w.id} className="bg-slate-900 text-slate-100">
                      Стіна #{idx + 1} ({lenMm} мм, {count} точок)
                    </option>
                  );
                })}
              </select>
              <button
                onClick={handleNextWall}
                className="p-1 hover:bg-slate-700 rounded text-slate-300"
                title="Наступна стіна"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono">
              L = <span className="text-amber-400 font-bold">{wallLengthMm}</span> мм • H = <span className="text-blue-400 font-bold">{ceilingHeightMm}</span> мм
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={showChases}
                onChange={(e) => setShowChases(e.target.checked)}
                className="accent-blue-500 rounded"
              />
              Штроби (ПУЕ)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={showDimensions}
                onChange={(e) => setShowDimensions(e.target.checked)}
                className="accent-blue-500 rounded"
              />
              Розмірні ланцюжки
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={showCableTags}
                onChange={(e) => setShowCableTags(e.target.checked)}
                className="accent-blue-500 rounded"
              />
              Маркування ліній
            </label>
          </div>
        </div>

        {/* CAD Canvas Area with SVG Elevation */}
        <div className="flex-1 p-6 overflow-auto bg-slate-950 flex items-center justify-center min-h-[460px]">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl relative">
            <svg
              ref={svgRef}
              width={svgWidth}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="select-none font-sans"
            >
              <defs>
                {/* Штриховка підлоги (бетонне перекриття) */}
                <pattern id="concreteHatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="10" stroke="#334155" strokeWidth="1" />
                </pattern>
                {/* Стрілка для розмірних ліній */}
                <marker id="dimArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 2 L 10 5 L 0 8 z" fill="#94a3b8" />
                </marker>
              </defs>

              {/* 1. Плита перекриття підлоги (нижня зона) */}
              <rect
                x={marginX}
                y={toSvgY(0)}
                width={drawWidth}
                height={marginY - 10}
                fill="url(#concreteHatch)"
                stroke="#475569"
                strokeWidth="1.5"
              />
              <text x={marginX + 10} y={toSvgY(0) + 20} fill="#94a3b8" fontSize="11" fontWeight="bold">
                ±0.000 Рівень чистової підлоги
              </text>

              {/* 2. Стеля (верхня зона) */}
              <rect
                x={marginX}
                y={marginY - 25}
                width={drawWidth}
                height={25}
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="1.5"
              />
              <text x={marginX + 10} y={marginY - 8} fill="#94a3b8" fontSize="11" fontWeight="bold">
                +{ceilingHeightMm} мм Чистова стеля (перекриття)
              </text>

              {/* 3. Головний контур стіни */}
              <rect
                x={marginX}
                y={toSvgY(ceilingHeightMm)}
                width={drawWidth}
                height={drawHeight}
                fill="#0f172a"
                stroke="#64748b"
                strokeWidth="2"
              />

              {/* 4. Магістральна зона штроблення за ПУЕ: 150 мм нижче стелі */}
              {showChases && (
                <g opacity="0.85">
                  <line
                    x1={marginX}
                    y1={toSvgY(ceilingHeightMm - 150)}
                    x2={marginX + drawWidth}
                    y2={toSvgY(ceilingHeightMm - 150)}
                    stroke="#f97316"
                    strokeWidth="2"
                    strokeDasharray="6,4"
                  />
                  <text
                    x={marginX + drawWidth - 190}
                    y={toSvgY(ceilingHeightMm - 150) - 6}
                    fill="#f97316"
                    fontSize="10"
                    fontWeight="600"
                  >
                    Магістраль у гофрі (-150 мм від стелі)
                  </text>
                </g>
              )}

              {/* 5. Дверні та віконні отвори на стіні */}
              {openingsOnWall.map((op) => {
                const opCenterMm = Math.round(op.positionRatio * wallLengthMm);
                const opWidthMm = op.width || 800;
                const opLeftMm = Math.max(0, opCenterMm - opWidthMm / 2);
                const opRightMm = Math.min(wallLengthMm, opCenterMm + opWidthMm / 2);

                const isDoor = op.type === 'door';
                const bottomMm = isDoor ? 0 : 900;
                const heightMm = isDoor ? 2100 : 1400;

                const x = toSvgX(opLeftMm);
                const y = toSvgY(bottomMm + heightMm);
                const w = (opRightMm - opLeftMm) * scaleX;
                const h = heightMm * scaleY;

                return (
                  <g key={op.id}>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill="#1e293b"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray={isDoor ? 'none' : '4,2'}
                    />
                    <text
                      x={x + w / 2}
                      y={y + h / 2}
                      fill="#cbd5e1"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {isDoor ? 'Двері' : 'Вікно'} ({opWidthMm} мм)
                    </text>
                  </g>
                );
              })}

              {/* 6. Вертикальні штроби опусків за ПУЕ §2.1 (суворо вертикально від стелі до точки) */}
              {showChases &&
                projectedElements.map((pe, idx) => {
                  const x = toSvgX(pe.distanceAlongWallMm);
                  const yStart = toSvgY(ceilingHeightMm - 150);
                  const yEnd = toSvgY(pe.heightFromFloorMm);

                  return (
                    <g key={`chase_${idx}`}>
                      <line
                        x1={x}
                        y1={yStart}
                        x2={x}
                        y2={yEnd}
                        stroke="#f97316"
                        strokeWidth="2.5"
                      />
                    </g>
                  );
                })}

              {/* 7. Електромонтажні точки (підрозетники, вимикачі, прилади) */}
              {projectedElements.map((pe, idx) => {
                const x = toSvgX(pe.distanceAlongWallMm);
                const y = toSvgY(pe.heightFromFloorMm);

                const isSwitch = pe.element.category === 'switch';
                const isSocket = pe.element.category === 'socket';
                const isLight = pe.element.category === 'light';

                const boxColor = isSwitch ? '#eab308' : isSocket ? '#38bdf8' : isLight ? '#fbbf24' : '#a855f7';

                return (
                  <g key={`elem_${pe.element.id}_${idx}`} className="group cursor-pointer">
                    {/* Підрозетник (кругла монтажна коробка D=68мм) */}
                    <circle
                      cx={x}
                      cy={y}
                      r="10"
                      fill={boxColor}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />

                    {/* Позначка висоти монтажу */}
                    <text
                      x={x}
                      y={y + 18}
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      +{pe.heightFromFloorMm}
                    </text>

                    {/* Назва та маркування */}
                    {showCableTags && (
                      <text
                        x={x}
                        y={y - 14}
                        fill="#94a3b8"
                        fontSize="9"
                        textAnchor="middle"
                      >
                        {pe.element.label || pe.element.name}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* 8. Розмірні ланцюжки (ДСТУ) */}
              {showDimensions && (
                <g>
                  {/* Горизонтальний розмірний ланцюжок від лівого краю до першої точки та між точками */}
                  <line
                    x1={marginX}
                    y1={svgHeight - 25}
                    x2={marginX + drawWidth}
                    y2={svgHeight - 25}
                    stroke="#94a3b8"
                    strokeWidth="1"
                  />
                  {/* Зарубки лівого та правого країв */}
                  <line x1={marginX} y1={svgHeight - 32} x2={marginX} y2={svgHeight - 18} stroke="#94a3b8" strokeWidth="1.5" />
                  <line x1={marginX + drawWidth} y1={svgHeight - 32} x2={marginX + drawWidth} y2={svgHeight - 18} stroke="#94a3b8" strokeWidth="1.5" />
                  <text
                    x={marginX + drawWidth / 2}
                    y={svgHeight - 30}
                    fill="#f1f5f9"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {wallLengthMm} мм
                  </text>

                  {/* Вертикальна шкала висоти зліва */}
                  <line x1={35} y1={toSvgY(0)} x2={35} y2={toSvgY(ceilingHeightMm)} stroke="#94a3b8" strokeWidth="1" />
                  <line x1={28} y1={toSvgY(0)} x2={42} y2={toSvgY(0)} stroke="#94a3b8" strokeWidth="1.5" />
                  <line x1={28} y1={toSvgY(ceilingHeightMm)} x2={42} y2={toSvgY(ceilingHeightMm)} stroke="#94a3b8" strokeWidth="1.5" />
                  <text x={30} y={toSvgY(ceilingHeightMm / 2)} fill="#94a3b8" fontSize="10" fontWeight="bold" transform={`rotate(-90 30 ${toSvgY(ceilingHeightMm / 2)})`} textAnchor="middle">
                    H = {ceilingHeightMm} мм
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Footer info banner */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Вимоги ПУЕ §2.1.20: Штроби виконуються <strong className="text-white">суворо вертикально</strong> до розеток і вимикачів. Горизонтальне штроблення допускається лише в зоні <strong className="text-white">150 мм нижче стелі</strong>. Діагональні штроби суворо заборонені.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              Закрити
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
