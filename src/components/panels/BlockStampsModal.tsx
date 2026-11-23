/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Модальне вікно бібліотеки готових постів та штампів блоків розеток (Block Stamps)
 */

import React, { useState } from 'react';
import {
  X,
  Stamp,
  Layers,
  Sparkles,
  Plus,
  Tv,
  Monitor,
  Flame,
  DoorOpen,
  Check,
  Info,
} from 'lucide-react';
import { CadProject, Point } from '../../types/cad';
import { BLOCK_STAMP_TEMPLATES, BlockStampTemplate, generateBlockStampElements } from '../../utils/blockStamps';
import { getWallInwardNormal, getRotationForInwardNormal } from '../../utils/cadMath';

interface BlockStampsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: CadProject;
  onApplyStamp: (updatedProject: CadProject, message: string) => void;
}

export const BlockStampsModal: React.FC<BlockStampsModalProps> = ({
  isOpen,
  onClose,
  project,
  onApplyStamp,
}) => {
  const [selectedStampId, setSelectedStampId] = useState<string>(BLOCK_STAMP_TEMPLATES[0].id);
  const [selectedWallId, setSelectedWallId] = useState<string>(
    project.walls.length > 0 ? project.walls[0].id : ''
  );
  const [rotationDeg, setRotationDeg] = useState<number>(0);

  if (!isOpen) return null;

  const selectedStamp =
    BLOCK_STAMP_TEMPLATES.find((s) => s.id === selectedStampId) || BLOCK_STAMP_TEMPLATES[0];

  const handleInsertStamp = () => {
    let targetPos: Point = { x: 300, y: 300 };
    let angle = rotationDeg;

    // Якщо вибрана стіна - ставимо по центру стіни з кутом стіни
    if (selectedWallId) {
      const wall = project.walls.find((w) => w.id === selectedWallId);
      if (wall) {
        targetPos = {
          x: Math.round((wall.start.x + wall.end.x) / 2),
          y: Math.round((wall.start.y + wall.end.y) / 2),
        };
        const inwardNormal = getWallInwardNormal(wall, targetPos, project.rooms);
        angle = getRotationForInwardNormal(inwardNormal, true);
      }
    }

    const newElements = generateBlockStampElements(
      selectedStamp,
      targetPos,
      angle,
      selectedWallId || undefined
    );

    const updatedProject: CadProject = {
      ...project,
      elements: [...project.elements, ...newElements],
    };

    onApplyStamp(
      updatedProject,
      `Встановлено блок «${selectedStamp.name}» (${newElements.length} постів з міжосьовою відстанню 71 мм).`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col text-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Stamp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Штампи готових блоків електроточок
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                  Крок 71 мм (DIN)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Типові комплексні пости (медіа, робоче місце, кухонний фартух, вхід) в один клік
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          
          {/* Templates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BLOCK_STAMP_TEMPLATES.map((stamp) => {
              const isSelected = stamp.id === selectedStampId;
              return (
                <div
                  key={stamp.id}
                  onClick={() => setSelectedStampId(stamp.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-500/15 shadow-md shadow-purple-500/10'
                      : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl p-1.5 rounded-lg bg-slate-800 border border-slate-700/60">
                        {stamp.icon}
                      </span>
                      <div>
                        <h3 className="font-bold text-white text-sm">{stamp.name}</h3>
                        <span className="text-[11px] text-purple-400 font-medium">
                          {stamp.items.length} постів у рамці (71 мм)
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-purple-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                    {stamp.description}
                  </p>

                  {/* Badges of items inside */}
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-700/50">
                    {stamp.items.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-[10px] text-slate-300 font-mono"
                      >
                        {item.label} (+{item.mountingHeightMm})
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Placement Options */}
          <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-xs tracking-wider text-purple-400 uppercase flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Прив'язка до стіни проєкту
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Стіна встановлення:</label>
                <select
                  value={selectedWallId}
                  onChange={(e) => setSelectedWallId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-purple-500"
                >
                  <option value="">Без прив'язки (у центр креслення)</option>
                  {project.walls.map((w, idx) => {
                    const lenMm = Math.round(
                      Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y) * 100
                    );
                    return (
                      <option key={w.id} value={w.id}>
                        Стіна #{idx + 1} ({lenMm} мм)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Кут повороту:</label>
                <div className="flex items-center gap-2">
                  {[0, 90, 180, 270].map((ang) => (
                    <button
                      key={ang}
                      type="button"
                      onClick={() => setRotationDeg(ang)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold font-mono transition-all ${
                        rotationDeg === ang
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-750'
                      }`}
                    >
                      {ang}°
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Стандартний міжосьовий крок багатопостових рамок: 71.0 мм (ДСТУ EN 60669).</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Скасувати
            </button>
            <button
              onClick={handleInsertStamp}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Вставити блок на креслення
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
