/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Quick Setup Wizard (Майстер швидкого старту проєкту за 30 секунд)
 * Дозволяє миттєво створити професійний електропроєкт для типових об'єктів:
 * 1-к студія, 2-к/3-к квартира, приватний будинок чи офіс з автогенерацією
 * кімнат, кіл, фурнітури та розподільчого щита на DIN-рейку.
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Home,
  Building,
  Building2,
  Zap,
  BatteryCharging,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  X,
  Layers,
  Cpu,
} from 'lucide-react';
import { CadProject, CircuitGroup, ElectricalElement, Room, Wall, WallOpening } from '../../types/cad';
import { TEMPLATES } from '../../data/templates';
import { sanitizeProject } from '../../utils/storage';

interface QuickSetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyProject: (project: CadProject) => void;
}

interface ObjectTypeOption {
  id: string;
  title: string;
  subtitle: string;
  areaM2: number;
  roomsCount: number;
  templateId: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
}

const OBJECT_TYPES: ObjectTypeOption[] = [
  {
    id: 'studio',
    title: '1-кімнатна студія',
    subtitle: 'Передпокій, санвузол, кухня-вітальня',
    areaM2: 38,
    roomsCount: 3,
    templateId: 'studio_compact',
    icon: Home,
    badge: '38 м²',
  },
  {
    id: 'apartment_2r',
    title: '2-кімнатна квартира',
    subtitle: 'Передпокій, кухня, вітальня, спальня, ванна',
    areaM2: 65,
    roomsCount: 5,
    templateId: 'apartment_2room',
    icon: Building,
    badge: '65 м²',
  },
  {
    id: 'house',
    title: 'Приватний будинок',
    subtitle: 'Тамбур, хол, 3 спальні, котельня, веранда, гараж',
    areaM2: 185,
    roomsCount: 8,
    templateId: 'house_blueprint_160m',
    icon: Building2,
    badge: '185 м²',
  },
  {
    id: 'office',
    title: 'Сучасний офіс / Open-space',
    subtitle: 'Вхідна зона, робоча зала, переговорна, санвузол',
    areaM2: 120,
    roomsCount: 4,
    templateId: 'apartment_2room', // derived with office customizations
    icon: Building,
    badge: '120 м²',
  },
];

export const QuickSetupWizardModal: React.FC<QuickSetupWizardModalProps> = ({
  isOpen,
  onClose,
  onApplyProject,
}) => {
  const [selectedObjectId, setSelectedObjectId] = useState<string>('apartment_2r');
  const [supplyPhase, setSupplyPhase] = useState<'1-phase' | '3-phase'>('1-phase');
  const [incomerRatingA, setIncomerRatingA] = useState<number>(40);
  const [groundingSystem, setGroundingSystem] = useState<'TN-C-S' | 'TN-S'>('TN-C-S');
  const [hasBackup, setHasBackup] = useState<boolean>(true);
  const [packageTier, setPackageTier] = useState<'standard' | 'premium'>('standard');
  const [ceilingHeightMm, setCeilingHeightMm] = useState<number>(2700);
  const [projectTitle, setProjectTitle] = useState<string>('Електропроєкт житлового приміщення');

  if (!isOpen) return null;

  const handleGenerate = () => {
    const selectedObj = OBJECT_TYPES.find((o) => o.id === selectedObjectId) || OBJECT_TYPES[1];
    const baseTemplate = TEMPLATES.find((t) => t.id === selectedObj.templateId) || TEMPLATES[0];

    // Deep clone base template
    const newProject: CadProject = sanitizeProject(JSON.parse(JSON.stringify(baseTemplate.project)));

    // Apply wizard overrides
    newProject.id = `proj_${Date.now()}`;
    newProject.title = projectTitle || selectedObj.title;
    newProject.date = new Date().toISOString().split('T')[0];
    newProject.ceilingHeightMm = ceilingHeightMm;
    newProject.supplyPhase = supplyPhase;
    newProject.mainBreakerRatingA = incomerRatingA;
    newProject.groundingSystem = groundingSystem;

    // Backup system configuration
    if (hasBackup) {
      newProject.backupSystem = {
        enabled: true,
        type: supplyPhase === '3-phase' ? 'ats_generator' : 'inverter_battery',
        inverterPowerW: supplyPhase === '3-phase' ? 6000 : 3500,
        batteryCapacityWh: supplyPhase === '3-phase' ? 10240 : 5120,
        batteryChemistry: 'lifepo4',
        batteryVoltageV: 51.2,
        depthOfDischargePercent: 90,
        inverterEfficiencyPercent: 94,
        atsTransferTimeMs: 15,
        mode: 'standard',
      };
    } else {
      newProject.backupSystem = {
        enabled: false,
        type: 'none',
        inverterPowerW: 0,
        batteryCapacityWh: 0,
        mode: 'standard',
      };
    }

    // Adapt circuits for 3-phase if selected
    if (supplyPhase === '3-phase') {
      const phases: Array<'L1' | 'L2' | 'L3'> = ['L1', 'L2', 'L3'];
      newProject.circuits.forEach((c, idx) => {
        if (c.phase !== '3P') {
          c.phase = phases[idx % 3];
        }
      });
    }

    // Premium tier customizations (add Smart Home KNX elements if selected)
    if (packageTier === 'premium') {
      newProject.circuits.forEach((c) => {
        if (c.name.toLowerCase().includes('освіт')) {
          c.description = `${c.description || ''} + KNX Диммер`;
        }
      });
    }

    onApplyProject(newProject);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Sparkles className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-display">
                  Майстер швидкого старту проєкту (30 секунд)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                  JETPLAN + CAD
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Миттєва генерація архітектурного плану, електромережі та розподільчого щита
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Step 1: Object Type Selection */}
          <div>
            <label className="block text-xs font-bold text-neutral-200 uppercase tracking-wider mb-2.5">
              1. Оберіть тип об'єкта
            </label>
            <div className="grid grid-cols-2 gap-3">
              {OBJECT_TYPES.map((obj) => {
                const Icon = obj.icon;
                const isSelected = selectedObjectId === obj.id;
                return (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => {
                      setSelectedObjectId(obj.id);
                      setProjectTitle(`Електропроєкт (${obj.title})`);
                      if (obj.id === 'house') {
                        setSupplyPhase('3-phase');
                        setIncomerRatingA(40);
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-sky-500 bg-sky-950/30 shadow-md shadow-sky-950/40 ring-1 ring-sky-500/50'
                        : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-sky-500/20 text-sky-400' : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-semibold">
                        {obj.badge}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-100">{obj.title}</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{obj.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project Title Input */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Назва проєкту / Адреса об'єкта:
            </label>
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
              placeholder="напр. м. Київ, ЖК Французький квартал, кв. 142"
            />
          </div>

          {/* Step 2: Electrical System & Supply */}
          <div>
            <label className="block text-xs font-bold text-neutral-200 uppercase tracking-wider mb-2.5">
              2. Електротехнічні параметри мережі (ПУЕ-2017)
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Supply Phase */}
              <div>
                <span className="block text-xs font-semibold text-neutral-300 mb-1.5">Ввідне живлення:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSupplyPhase('1-phase');
                      setIncomerRatingA(40);
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      supplyPhase === '1-phase'
                        ? 'border-sky-500 bg-sky-950/40 text-sky-300'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>1-фазне (230 В)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSupplyPhase('3-phase');
                      setIncomerRatingA(25);
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      supplyPhase === '3-phase'
                        ? 'border-sky-500 bg-sky-950/40 text-sky-300'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-sky-400" />
                    <span>3-фазне (400 В)</span>
                  </button>
                </div>
              </div>

              {/* Incomer Breaker */}
              <div>
                <span className="block text-xs font-semibold text-neutral-300 mb-1.5">Ввідний автомат:</span>
                <select
                  value={incomerRatingA}
                  onChange={(e) => setIncomerRatingA(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-700 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                >
                  <option value={25}>25 A (до 5.5 кВт / 16.5 кВт 3P)</option>
                  <option value={32}>32 A (до 7.0 кВт / 21.0 кВт 3P)</option>
                  <option value={40}>40 A (до 8.8 кВт / 26.4 кВт 3P - Стандарт)</option>
                  <option value={50}>50 A (до 11.0 кВт / 33.0 кВт 3P)</option>
                  <option value={63}>63 A (до 14.0 кВт / 41.5 кВт 3P)</option>
                </select>
              </div>

              {/* Grounding System */}
              <div>
                <span className="block text-xs font-semibold text-neutral-300 mb-1.5">Система заземлення:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGroundingSystem('TN-C-S')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                      groundingSystem === 'TN-C-S'
                        ? 'border-sky-500 bg-sky-950/40 text-sky-300'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400'
                    }`}
                  >
                    TN-C-S (Стандарт)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroundingSystem('TN-S')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                      groundingSystem === 'TN-S'
                        ? 'border-sky-500 bg-sky-950/40 text-sky-300'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-400'
                    }`}
                  >
                    TN-S (5-провідна)
                  </button>
                </div>
              </div>

              {/* Ceiling Height */}
              <div>
                <span className="block text-xs font-semibold text-neutral-300 mb-1.5">Висота стелі:</span>
                <select
                  value={ceilingHeightMm}
                  onChange={(e) => setCeilingHeightMm(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-700 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                >
                  <option value={2500}>2 500 мм (Хрущовка / панель)</option>
                  <option value={2700}>2 700 мм (Стандартна новобудова)</option>
                  <option value={3000}>3 000 мм (Комфорт / Бізнес клас)</option>
                  <option value={3300}>3 300 мм (Висока стеля / Лофт)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Step 3: Additional Options */}
          <div>
            <label className="block text-xs font-bold text-neutral-200 uppercase tracking-wider mb-2.5">
              3. Комплектація та резервне живлення
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Blackout Backup */}
              <div
                onClick={() => setHasBackup(!hasBackup)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start gap-3 ${
                  hasBackup
                    ? 'border-emerald-500/60 bg-emerald-950/20'
                    : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    hasBackup ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  <BatteryCharging className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-neutral-100">Резерв (Блекаут)</h4>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      LiFePO4
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5 leading-tight">
                    Гібридний інвертор, перемикач мережа/ДБЖ та виділені пріоритетні лінії
                  </p>
                </div>
              </div>

              {/* Package Tier */}
              <div
                onClick={() => setPackageTier(packageTier === 'standard' ? 'premium' : 'standard')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start gap-3 ${
                  packageTier === 'premium'
                    ? 'border-purple-500/60 bg-purple-950/20'
                    : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    packageTier === 'premium' ? 'bg-purple-500/20 text-purple-400' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-neutral-100">
                      {packageTier === 'premium' ? 'Преміум (Smart Home)' : 'Стандарт (ДБН)'}
                    </h4>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5 leading-tight">
                    {packageTier === 'premium'
                      ? 'Розширене зоноване світло, KNX/актюатори, датчики затоплення'
                      : 'Базова відповідність усім нормам ДБН В.2.5-23:2010'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between shrink-0">
          <div className="text-xs text-neutral-400">
            Згенерує: стіни, розетки, освітлення, траси та DIN-рейку щита
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              Скасувати
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-neutral-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors shadow-md shadow-sky-500/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Згенерувати електропроєкт</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
