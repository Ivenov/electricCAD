/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Модуль калібрування масштабу (Scale Calibration Tool)
 * Дозволяє виміряти відомий відрізок на підкладці БТІ або плані (наприклад дверний отвір 800-900 мм
 * або довжину стіни) та точно відкалібрувати масштаб підкладки або всього проєкту.
 */

import React, { useState } from 'react';
import { Ruler, Check, X, Info, Layers, Maximize } from 'lucide-react';
import { Point, ScaleCalibrationData } from '../../types/cad';
import { distance } from '../../utils/cadMath';

interface ScaleCalibrationModalProps {
  pointA: Point;
  pointB: Point;
  pixelDistance: number;
  initialTarget?: 'blueprint' | 'project';
  onConfirm: (data: ScaleCalibrationData) => void;
  onClose: () => void;
}

export const ScaleCalibrationModal: React.FC<ScaleCalibrationModalProps> = ({
  pointA,
  pointB,
  pixelDistance,
  initialTarget = 'blueprint',
  onConfirm,
  onClose,
}) => {
  const [realValue, setRealValue] = useState<string>('3000');
  const [unit, setUnit] = useState<'mm' | 'cm' | 'm'>('mm');
  const [target, setTarget] = useState<'blueprint' | 'project'>(initialTarget);
  const [error, setError] = useState<string | null>(null);

  // Convert input value to millimeters
  const parsedValue = parseFloat(realValue.replace(',', '.'));
  let realDistanceMm = 0;
  if (!isNaN(parsedValue) && parsedValue > 0) {
    if (unit === 'm') realDistanceMm = parsedValue * 1000;
    else if (unit === 'cm') realDistanceMm = parsedValue * 10;
    else realDistanceMm = parsedValue;
  }

  // Calculated scale ratio: mm per pixel
  const mmPerPixel = pixelDistance > 0 && realDistanceMm > 0 ? realDistanceMm / pixelDistance : 10;

  const handleApply = () => {
    if (isNaN(parsedValue) || parsedValue <= 0) {
      setError('Будь ласка, введіть додатне числове значення довжини');
      return;
    }
    if (realDistanceMm < 100 || realDistanceMm > 100000) {
      setError('Реальна довжина повинна бути в діапазоні від 100 мм (10 см) до 100 000 мм (100 м)');
      return;
    }

    onConfirm({
      pointA,
      pointB,
      pixelDistance,
      realDistanceMm: Math.round(realDistanceMm),
      calibratedAt: new Date().toISOString(),
      target,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Ruler className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display">Калібрування масштабу</h3>
              <p className="text-xs text-neutral-400">Точна прив'язка пікселів до реальних розмірів</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Measured screen distance */}
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Виміряна відстань на екрані:</span>
            <span className="text-xs font-mono font-bold text-sky-400">
              {Math.round(pixelDistance * 10) / 10} px
            </span>
          </div>

          {/* Real distance input */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Вкажіть реальну довжину відрізка між точками:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={realValue}
                onChange={(e) => {
                  setRealValue(e.target.value);
                  setError(null);
                }}
                placeholder="напр. 3000 або 3.0"
                className="flex-1 bg-neutral-950 border border-neutral-700 focus:border-sky-500 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApply();
                }}
              />
              <div className="flex rounded-lg border border-neutral-700 bg-neutral-950 p-0.5 text-xs font-semibold">
                {(['mm', 'cm', 'm'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`px-2.5 py-1.5 rounded-md transition-colors ${
                      unit === u ? 'bg-sky-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {u === 'mm' ? 'мм' : u === 'cm' ? 'см' : 'м'}
                  </button>
                ))}
              </div>
            </div>
            {realDistanceMm > 0 && (
              <p className="text-[11px] text-neutral-400 mt-1">
                = <span className="font-mono text-neutral-200">{realDistanceMm.toLocaleString('uk-UA')} мм</span>{' '}
                ({(realDistanceMm / 1000).toFixed(2)} м)
              </p>
            )}
          </div>

          {/* Target choice */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Об'єкт калібрування:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTarget('blueprint')}
                className={`p-3 rounded-lg border text-left transition-colors flex flex-col gap-1 ${
                  target === 'blueprint'
                    ? 'border-sky-500 bg-sky-950/30 text-sky-200'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>Підкладка БТІ</span>
                </div>
                <span className="text-[10px] text-neutral-400 leading-tight">
                  Масштабує креслення-підкладку PDF/Image під розмір сітки CAD
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTarget('project')}
                className={`p-3 rounded-lg border text-left transition-colors flex flex-col gap-1 ${
                  target === 'project'
                    ? 'border-sky-500 bg-sky-950/30 text-sky-200'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Maximize className="w-3.5 h-3.5 text-amber-400" />
                  <span>Масштаб проєкту</span>
                </div>
                <span className="text-[10px] text-neutral-400 leading-tight">
                  Перераховує внутрішній масштаб розрахунків креслення
                </span>
              </button>
            </div>
          </div>

          {/* Calculated Scale summary */}
          {realDistanceMm > 0 && (
            <div className="p-3 rounded-lg bg-sky-950/20 border border-sky-500/30 text-xs text-sky-300 space-y-1">
              <div className="flex items-center justify-between">
                <span>Розрахований крок:</span>
                <span className="font-mono font-bold">1 px = {mmPerPixel.toFixed(2)} мм</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>Масштабний коефіцієнт:</span>
                <span className="font-mono">1 : {Math.round(mmPerPixel * 10)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-sm shadow-sky-500/20"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Застосувати масштаб</span>
          </button>
        </div>
      </div>
    </div>
  );
};
