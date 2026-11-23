/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Єдиний інженерний розрахунковий модуль електропостачання
 * згідно з ПУЕ України (2017), ДБН В.2.5-23:2010 та ДСТУ Б В.2.5-82:2016.
 */

import { CadProject, CircuitGroup, ElectricalElement, WireRoute } from '../types/cad';
import { getAggregatedProjectData } from './projectAggregator';

// Стандартні номінальні напруги в Україні та ЄС
export const VOLTAGE_1PH = 230; // В (фазна напруга)
export const VOLTAGE_3PH = 400; // В (лінійна напруга)

// Питома електропровідність міді при робочій температурі житлових кабелів (м / (Ом · мм²))
// γ = 56 м/(Ом·мм²) при 20°C; при тривалому нагріві до 65-70°C розрахункова провідність ~48-50
export const COPPER_CONDUCTIVITY = 50.0;

/**
 * Таблиця допустимих тривалих струмових навантажень мідних кабелів (ВВГнгд)
 * у повітрі / гофрованій трубі / штробі згідно з ПУЕ Табл. 1.3.4
 */
export interface CableSpec {
  crossSectionMm2: number;
  ampacityA: number; // Допустимий тривалий струм I_dd (A)
  maxBreakerRatingA: number; // Максимально дозволений номінал автоматичного вимикача
  recommendedBreakerA: number; // Рекомендований номінал
  typicalApplication: string;
}

export const CABLE_SPECS: Record<string, CableSpec> = {
  'VVGng_3x1.5': {
    crossSectionMm2: 1.5,
    ampacityA: 19,
    maxBreakerRatingA: 16,
    recommendedBreakerA: 10,
    typicalApplication: 'Освітлення та слабкострумові лінії',
  },
  'VVGng_3x2.5': {
    crossSectionMm2: 2.5,
    ampacityA: 27,
    maxBreakerRatingA: 20,
    recommendedBreakerA: 16,
    typicalApplication: 'Побутові розетки, кондиціонери, пральні машини',
  },
  'VVGng_3x4': {
    crossSectionMm2: 4.0,
    ampacityA: 38,
    maxBreakerRatingA: 25,
    recommendedBreakerA: 25,
    typicalApplication: 'Проточні водонагрівачі 6-8 кВт, печі, гаражні розетки',
  },
  'VVGng_3x6': {
    crossSectionMm2: 6.0,
    ampacityA: 46,
    maxBreakerRatingA: 32,
    recommendedBreakerA: 32,
    typicalApplication: 'Індукційні варильні поверхні 7-8.5 кВт, ввідні лінії',
  },
  'VVGng_5x2.5': {
    crossSectionMm2: 2.5,
    ampacityA: 25,
    maxBreakerRatingA: 16,
    recommendedBreakerA: 16,
    typicalApplication: 'Трифазні розетки 400В 16А, трифазні кондиціонери',
  },
  'VVGng_5x4': {
    crossSectionMm2: 4.0,
    ampacityA: 35,
    maxBreakerRatingA: 25,
    recommendedBreakerA: 25,
    typicalApplication: 'Трифазні котли 9-12 кВт',
  },
  'VVGng_5x6': {
    crossSectionMm2: 6.0,
    ampacityA: 42,
    maxBreakerRatingA: 32,
    recommendedBreakerA: 32,
    typicalApplication: 'Трифазні котли 14-18 кВт, ввідний кабель квартири 3-фазний',
  },
  'VVGng_5x10': {
    crossSectionMm2: 10.0,
    ampacityA: 55,
    maxBreakerRatingA: 50,
    recommendedBreakerA: 40,
    typicalApplication: 'Магістральний стояк до поверхових щитів 3-фазний (до 25-30 кВт)',
  },
  'KNX_Bus': {
    crossSectionMm2: 0.8, // JY(St)Y 2x2x0.8
    ampacityA: 2.5,
    maxBreakerRatingA: 2,
    recommendedBreakerA: 1,
    typicalApplication: 'Слабострумова шина автоматизації KNX/EIB 29-30V DC (зелена вита пара JY(St)Y)',
  },
};

export function getInstallationMethodFactor(
  method: CircuitGroup['installationMethod'] = 'flush_plaster'
): { factor: number; labelUk: string } {
  switch (method) {
    case 'open_air':
      return { factor: 1.0, labelUk: 'Відкрито у повітрі / на лотку (K=1.0)' };
    case 'conduit_wall':
      return { factor: 0.88, labelUk: 'У ПВХ-гофрі в стіні / за стелею (K=0.88)' };
    case 'conduit_insulation':
      return { factor: 0.72, labelUk: 'У гофрі в теплоізоляції / мінваті (K=0.72)' };
    case 'flush_plaster':
    default:
      return { factor: 0.95, labelUk: 'У штробі під штукатуркою (K=0.95)' };
  }
}

export function getTemperatureFactor(ambientTempC = 25): number {
  if (ambientTempC <= 20) return 1.05;
  if (ambientTempC <= 25) return 1.0;
  if (ambientTempC <= 30) return 0.94;
  if (ambientTempC <= 35) return 0.88;
  if (ambientTempC <= 40) return 0.82;
  return 0.75;
}

export function getCableTitleUk(cableType: string): string {
  switch (cableType) {
    case 'VVGng_3x1.5': return 'ВВГнгд 3х1.5';
    case 'VVGng_3x2.5': return 'ВВГнгд 3х2.5';
    case 'VVGng_3x4': return 'ВВГнгд 3х4';
    case 'VVGng_3x6': return 'ВВГнгд 3х6';
    case 'VVGng_5x2.5': return 'ВВГнгд 5х2.5';
    case 'VVGng_5x4': return 'ВВГнгд 5х4';
    case 'VVGng_5x6': return 'ВВГнгд 5х6';
    case 'VVGng_5x10': return 'ВВГнгд 5х10';
    case 'FTP_Cat5e': return 'FTP Cat5e 4x2x0.51';
    case 'KNX_Bus': return 'KNX Bus JY(St)Y 2x2x0.8';
    default: return cableType;
  }
}

/**
 * Коефіцієнт потужності cos φ за типами навантаження згідно з ДБН В.2.5-23:2010
 */
export function getElementCosPhi(element: ElectricalElement): number {
  switch (element.category) {
    case 'light':
      // LED світильники з якісними драйверами
      return 0.95;
    case 'switch':
      return 1.0;
    case 'socket': {
      if (element.type === 'socket_cooker' || element.type === 'socket_floor') {
        return 0.98; // Варильна поверхня, тепла підлога - переважно активне
      }
      return 0.92; // Загальні побутові прилади
    }
    case 'appliance': {
      if (element.type === 'hob_induction') return 0.95;
      if (element.type === 'oven_electric' || element.type === 'water_heater' || element.type === 'electric_boiler') {
        return 1.0; // ТЕНи - чисто активне навантаження
      }
      if (element.type === 'ac_indoor' || element.type === 'washing_machine' || element.type === 'dryer_machine' || element.type === 'dishwasher') {
        return 0.85; // Інверторні двигуни та компресори
      }
      return 0.9;
    }
    case 'backup':
      return 0.95;
    default:
      return 0.92;
  }
}

/**
 * Розрахунок струму лінії
 * 1-фазна: I = P / (230 * cos φ)
 * 3-фазна: I = P / (sqrt(3) * 400 * cos φ)
 */
export function calculateLineCurrent(
  powerWatts: number,
  isThreePhase: boolean = false,
  cosPhi: number = 0.92
): number {
  if (powerWatts <= 0) return 0;
  const safeCosPhi = Math.max(0.6, Math.min(1.0, cosPhi));
  if (isThreePhase) {
    return Number((powerWatts / (Math.sqrt(3) * VOLTAGE_3PH * safeCosPhi)).toFixed(2));
  }
  return Number((powerWatts / (VOLTAGE_1PH * safeCosPhi)).toFixed(2));
}

/**
 * Розрахунок падіння напруги в кабелі (ΔU)
 * 1-фазна лінія: ΔU = (2 * L * I * cos φ) / (γ * S)
 * 3-фазна симетрична лінія: ΔU = (sqrt(3) * L * I * cos φ) / (γ * S)
 * Відносне падіння: ΔU% = (ΔU / Un) * 100%
 */
export interface VoltageDropResult {
  deltaVolts: number;
  deltaPercent: number;
  isAcceptable: boolean; // <= 4% за ДБН В.2.5-23:2010 (норма для розеток і світла)
  cableLengthM: number;
  crossSectionMm2: number;
}

export function calculateVoltageDrop(
  currentA: number,
  cableLengthM: number,
  crossSectionMm2: number,
  isThreePhase: boolean = false,
  cosPhi: number = 0.92
): VoltageDropResult {
  const S = Math.max(1.0, crossSectionMm2);
  const L = Math.max(0.5, cableLengthM);
  const nominalU = isThreePhase ? VOLTAGE_3PH : VOLTAGE_1PH;

  let deltaVolts: number;
  if (isThreePhase) {
    deltaVolts = (Math.sqrt(3) * L * currentA * cosPhi) / (COPPER_CONDUCTIVITY * S);
  } else {
    deltaVolts = (2 * L * currentA * cosPhi) / (COPPER_CONDUCTIVITY * S);
  }

  const deltaPercent = Number(((deltaVolts / nominalU) * 100).toFixed(2));
  const roundedVolts = Number(deltaVolts.toFixed(2));

  return {
    deltaVolts: roundedVolts,
    deltaPercent,
    isAcceptable: deltaPercent <= 4.0,
    cableLengthM: L,
    crossSectionMm2: S,
  };
}

/**
 * Перевірка струму однофазного короткого замикання Ikz(1)
 * та чутливості електромагнітного розчіплювача за ПУЕ §1.7.79 (t <= 0.4 с)
 */
export interface ShortCircuitCheckResult {
  loopImpedanceOhm: number;      // Опір петлі "фаза-нуль" Zs (Ом)
  ikzCurrentA: number;           // Струм однофазного КЗ Ikz (А)
  tripCurrentThresholdA: number; // Струм миттєвого спрацювання розчіплювача Iinst (B: 5*In, C: 10*In, D: 20*In)
  requiredIkzA: number;          // Необхідний струм за ПУЕ §1.7.79 (1.1 * Iinst)
  isTrippingAssured: boolean;    // Ikz >= requiredIkzA
  safetyMargin: number;          // Співвідношення Ikz / requiredIkzA
  recommendation?: string;
}

export function calculateShortCircuitCheck(
  cableLengthM: number,
  crossSectionMm2: number,
  breakerRatingA: number,
  breakerCurve: 'B' | 'C' | 'D' = 'C'
): ShortCircuitCheckResult {
  const S = Math.max(1.0, crossSectionMm2);
  const L = Math.max(1.0, cableLengthM);

  // Питомий опір петлі кабелю (мідь при робочій температурі нагріву КЗ gamma = 50 м/(Ом*мм2))
  const rCable = (2 * L) / (COPPER_CONDUCTIVITY * S);
  // Внутрішній повний опір живильної мережі до щита (ТП 10/0.4кВ + кабель вводу)
  const zSource = 0.08;
  // Перехідний опір контактів апаратів і з'єднань
  const rContacts = 0.02;

  const zLoop = Number((zSource + rContacts + rCable).toFixed(3));
  const ikzCurrentA = Math.round(VOLTAGE_1PH / zLoop);

  // Множник миттєвого електромагнітного розчіплювача автомата
  let curveMultiplier = 10;
  if (breakerCurve === 'B') curveMultiplier = 5;
  else if (breakerCurve === 'D') curveMultiplier = 20;

  const tripCurrentThresholdA = breakerRatingA * curveMultiplier;
  const requiredIkzA = Math.round(tripCurrentThresholdA * 1.1); // Коефіцієнт надійності 1.1 за ПУЕ §1.7.79
  const isTrippingAssured = ikzCurrentA >= requiredIkzA;
  const safetyMargin = Number((ikzCurrentA / Math.max(1, requiredIkzA)).toFixed(2));

  let recommendation: string | undefined;
  if (!isTrippingAssured) {
    if (breakerCurve === 'C') {
      recommendation = `Замініть характеристику відключення на криву "B" (B${breakerRatingA}) або збільшіть переріз кабелю для гарантованого відключення КЗ за ≤ 0.4 с (ПУЕ §1.7.79)`;
    } else {
      recommendation = `Збільшіть переріз кабелю або скоротіть довжину лінії для гарантованого відключення КЗ за час ≤ 0.4 с (ПУЕ §1.7.79)`;
    }
  }

  return {
    loopImpedanceOhm: zLoop,
    ikzCurrentA,
    tripCurrentThresholdA,
    requiredIkzA,
    isTrippingAssured,
    safetyMargin,
    recommendation,
  };
}

/**
 * Детальний розрахунок по кожній групі щита
 */
export interface CircuitCalculationDetails {
  status: 'calculated' | 'insufficient_data';
  inputs: string[];
  formulas: string[];
  assumptions: string[];
  resultSummary: string;
}

export interface CircuitAnalysis {
  circuit: CircuitGroup;
  connectedElements: ElectricalElement[];
  totalInstalledWatts: number;
  averageCosPhi: number;
  isThreePhaseLine: boolean;
  calculatedCurrentA: number; // Розрахунковий струм Ib
  breakerRatingA: number;
  baseCableAmpacityA: number; // Табличний Idd кабелю
  cableAmpacityA: number; // Скоригований допустимий струм Idd_eff = Idd * K_m * K_g * K_t
  deratingFactorTotal: number;
  totalCableLengthM: number;
  isLengthEstimated: boolean;
  voltageDrop: VoltageDropResult;
  shortCircuit: ShortCircuitCheckResult; // Перевірка КЗ та швидкодії за ПУЕ §1.7.79
  // Координація за ПУЕ: Ib <= In <= Idd_eff
  isBreakerOverloaded: boolean; // Ib > In
  isCableProtectedByBreaker: boolean; // In <= Idd_eff
  isVoltageDropExceeded: boolean; // ΔU% > 4%
  isShortCircuitTrippingUnsafe: boolean; // Ikz < 1.1 * Iinst
  isGroundingProtectionMissing: boolean; // TT без ПЗВ
  overallStatus: 'ok' | 'warning' | 'error' | 'uncalculated';
  statusMessage: string;
  calculationDetails: CircuitCalculationDetails;
}

export function analyzeCircuit(
  circuit: CircuitGroup,
  elements: ElectricalElement[],
  wires: WireRoute[],
  supplyPhase: '1-phase' | '3-phase' = '1-phase',
  groundingSystem: 'TN-C-S' | 'TN-S' | 'TT' = 'TN-C-S'
): CircuitAnalysis {
  const connected = elements.filter((el) => el.circuitId === circuit.id);
  const totalWatts = connected.reduce((sum, el) => sum + (el.powerWatts || 0), 0);

  // Середньозважений cos φ
  let weightedCosSum = 0;
  connected.forEach((el) => {
    weightedCosSum += (el.powerWatts || 100) * getElementCosPhi(el);
  });
  const avgCosPhi = totalWatts > 0 ? Number((weightedCosSum / totalWatts).toFixed(2)) : 0.95;

  // Коректне визначення 3-фазної лінії (5-жильний кабель, фаза 3P, або 3-фазна силова розетка)
  const isThreePhase =
    supplyPhase === '3-phase' &&
    (circuit.phase === '3P' ||
      circuit.cableType?.startsWith('VVGng_5x') ||
      connected.some((el) => el.type === 'socket_3phase'));

  const currentA = calculateLineCurrent(totalWatts, isThreePhase, avgCosPhi);

  const specKey = circuit.cableType || 'VVGng_3x2.5';
  const cableSpec = CABLE_SPECS[specKey] || CABLE_SPECS['VVGng_3x2.5'];

  // Поправочні коефіцієнти прокладання за ПУЕ Табл. 1.3.4 / 1.3.26
  const methodInfo = getInstallationMethodFactor(circuit.installationMethod);
  const kGroup = Math.max(0.5, Math.min(1.0, circuit.groupingFactorKg ?? 1.0));
  const ambientTempC = circuit.ambientTempC ?? 25;
  const kTemp = getTemperatureFactor(ambientTempC);
  const deratingFactorTotal = Number((methodInfo.factor * kGroup * kTemp).toFixed(2));
  const effectiveAmpacityA = Number((cableSpec.ampacityA * deratingFactorTotal).toFixed(1));

  // Довжина кабелю групи (сума фактичних трас або позначка оцінки)
  const circuitWires = wires.filter((w) => w.circuitId === circuit.id);
  let totalLengthM = circuitWires.reduce((sum, w) => sum + (w.calculatedLengthM || 0), 0);
  let isLengthEstimated = false;
  if (totalLengthM === 0 && connected.length > 0) {
    isLengthEstimated = true;
    totalLengthM = Math.max(12, connected.length * 4.5);
  }

  const vDrop = calculateVoltageDrop(currentA, totalLengthM, cableSpec.crossSectionMm2, isThreePhase, avgCosPhi);
  const shortCircuit = calculateShortCircuitCheck(
    totalLengthM,
    cableSpec.crossSectionMm2,
    circuit.breakerRatingA,
    circuit.breakerCurve || 'C'
  );

  const hasInsufficientData = connected.length === 0 || totalWatts <= 0;
  const isBreakerOverloaded = !hasInsufficientData && currentA > circuit.breakerRatingA;
  const isCableProtected = circuit.breakerRatingA <= effectiveAmpacityA;
  const isVoltageDropExceeded = !hasInsufficientData && !vDrop.isAcceptable;
  const isShortCircuitTrippingUnsafe = !shortCircuit.isTrippingAssured;
  const isGroundingProtectionMissing = groundingSystem === 'TT' && circuit.rcdType === 'none';

  let overallStatus: CircuitAnalysis['overallStatus'] = 'ok';
  let statusMessage = 'Параметри лінії відповідають нормам ПУЕ';

  if (hasInsufficientData) {
    overallStatus = 'uncalculated';
    statusMessage = 'Не розраховано: до групи не прив’язано споживачів або потужність = 0 Вт';
  } else if (isGroundingProtectionMissing) {
    overallStatus = 'error';
    statusMessage = `Система заземлення TT вимагає обов’язкового ПЗВ (≤30 мА) для кожної лінії (ПУЕ §1.7.59)`;
  } else if (isBreakerOverloaded) {
    overallStatus = 'error';
    statusMessage = `Перевантаження: струм навантаження (${currentA} А) перевищує номінал автомата (${circuit.breakerRatingA} А)`;
  } else if (!isCableProtected) {
    overallStatus = 'error';
    statusMessage = `Порушення захисту кабелю: автомат ${circuit.breakerRatingA} А > скоригованого Idd кабелю (${effectiveAmpacityA} А з коеф. ${deratingFactorTotal})`;
  } else if (isShortCircuitTrippingUnsafe) {
    overallStatus = 'warning';
    statusMessage = `Чутливість КЗ знижена: Ikz=${shortCircuit.ikzCurrentA}A < 1.1·Iinst (${shortCircuit.requiredIkzA}A). Час спрацювання > 0.4с`;
  } else if (isVoltageDropExceeded) {
    overallStatus = 'warning';
    statusMessage = `Підвищене падіння напруги: ${vDrop.deltaPercent}% (допустимо до 4%)`;
  }

  const calculationDetails: CircuitCalculationDetails = {
    status: hasInsufficientData ? 'insufficient_data' : 'calculated',
    inputs: [
      `Pвст = ${totalWatts} Вт (${connected.length} точок), cos φ = ${avgCosPhi}`,
      `Мережа = ${isThreePhase ? '3-фазна 400 В' : '1-фазна 230 В'}, Система заземлення = ${groundingSystem}`,
      `Кабель = ${getCableTitleUk(specKey)} (S=${cableSpec.crossSectionMm2} мм², Idd_табл=${cableSpec.ampacityA} А)`,
      `Умови прокладання: ${methodInfo.labelUk}; Kg=${kGroup}; T=${ambientTempC}°C (Kt=${kTemp})`,
      `Довжина лінії L = ${Math.round(totalLengthM * 10) / 10} м (${isLengthEstimated ? 'оцінка без трас' : 'за трасами на плані'})`,
    ],
    formulas: [
      isThreePhase
        ? `Ib = P / (√3 · Uл · cos φ) = ${totalWatts} / (1.732 · 400 · ${avgCosPhi}) = ${currentA} А`
        : `Ib = P / (Uф · cos φ) = ${totalWatts} / (230 · ${avgCosPhi}) = ${currentA} А`,
      `Idd_еф = Idd_табл · Km · Kg · Kt = ${cableSpec.ampacityA} · ${methodInfo.factor} · ${kGroup} · ${kTemp} = ${effectiveAmpacityA} А`,
      isThreePhase
        ? `ΔU% = (√3 · L · Ib · cos φ / (γ · S)) / 400 · 100% = ${vDrop.deltaPercent}% (γ=50 м/(Ом·мм²))`
        : `ΔU% = (2 · L · Ib · cos φ / (γ · S)) / 230 · 100% = ${vDrop.deltaPercent}% (γ=50 м/(Ом·мм²))`,
      `Ikz(1) = Uф / (Zджерела + Rконт + 2L/(γ·S)) = 230 / ${shortCircuit.loopImpedanceOhm} = ${shortCircuit.ikzCurrentA} А (поріг 1.1·Iinst = ${shortCircuit.requiredIkzA} А)`,
    ],
    assumptions: [
      'Питома провідність міді при нагріві γ = 50 м/(Ом·мм²).',
      'Імпеданс зовнішньої мережі до щита Zджерела + Rконт = 0.10 Ом (вимагає заміру петлі фаза-нуль при здачі).',
      isLengthEstimated
        ? 'УВАГА: Траси ще не прокладені на плані — використано попередню оцінку 4.5 м на точку.'
        : 'Довжина кабелю врахована за фактичною ортогональною геометрією трас.',
      'Остаточну безпеку схеми та селективність повинен підтвердити сертифікований інженер-електрик.',
    ],
    resultSummary: hasInsufficientData
      ? 'Не розраховано — додайте споживачів до групи.'
      : `Ib=${currentA}А ≤ In=${circuit.breakerRatingA}А ≤ Idd_еф=${effectiveAmpacityA}А | ΔU=${vDrop.deltaPercent}% | Ikz=${shortCircuit.ikzCurrentA}А`,
  };

  return {
    circuit,
    connectedElements: connected,
    totalInstalledWatts: totalWatts,
    averageCosPhi: avgCosPhi,
    isThreePhaseLine: isThreePhase,
    calculatedCurrentA: currentA,
    breakerRatingA: circuit.breakerRatingA,
    baseCableAmpacityA: cableSpec.ampacityA,
    cableAmpacityA: effectiveAmpacityA,
    deratingFactorTotal,
    totalCableLengthM: Math.round(totalLengthM * 10) / 10,
    isLengthEstimated,
    voltageDrop: vDrop,
    shortCircuit,
    isBreakerOverloaded,
    isCableProtectedByBreaker: isCableProtected,
    isVoltageDropExceeded,
    isShortCircuitTrippingUnsafe,
    isGroundingProtectionMissing,
    overallStatus,
    statusMessage,
    calculationDetails,
  };
}

/**
 * Розрахунок балансу фаз для 3-фазних щитів
 */
export interface PhaseBalanceResult {
  l1Watts: number;
  l2Watts: number;
  l3Watts: number;
  l1CurrentA: number;
  l2CurrentA: number;
  l3CurrentA: number;
  maxPhaseWatts: number;
  minPhaseWatts: number;
  unbalancePercent: number; // (Pmax - Pmin) / Pavg * 100%
  isBalanced: boolean; // unbalance <= 15%
}

export function calculatePhaseBalance(
  circuits: CircuitGroup[],
  elements: ElectricalElement[]
): PhaseBalanceResult {
  let l1 = 0;
  let l2 = 0;
  let l3 = 0;

  circuits.forEach((c) => {
    const connected = elements.filter((e) => e.circuitId === c.id);
    const watts = connected.reduce((sum, e) => sum + (e.powerWatts || 0), 0);
    const phase = c.phase || 'L1';
    if (phase === '3P') {
      l1 += watts / 3;
      l2 += watts / 3;
      l3 += watts / 3;
    } else if (phase === 'L1') l1 += watts;
    else if (phase === 'L2') l2 += watts;
    else if (phase === 'L3') l3 += watts;
  });

  const l1A = calculateLineCurrent(l1, false, 0.95);
  const l2A = calculateLineCurrent(l2, false, 0.95);
  const l3A = calculateLineCurrent(l3, false, 0.95);

  const maxP = Math.max(l1, l2, l3);
  const minP = Math.min(l1, l2, l3);
  const avgP = (l1 + l2 + l3) / 3;

  let unbalancePercent = 0;
  if (avgP > 0) {
    unbalancePercent = Number((((maxP - minP) / avgP) * 100).toFixed(1));
  }

  return {
    l1Watts: Math.round(l1),
    l2Watts: Math.round(l2),
    l3Watts: Math.round(l3),
    l1CurrentA: l1A,
    l2CurrentA: l2A,
    l3CurrentA: l3A,
    maxPhaseWatts: Math.round(maxP),
    minPhaseWatts: Math.round(minP),
    unbalancePercent,
    isBalanced: unbalancePercent <= 15.0,
  };
}

/**
 * Оптимізація балансу фаз (LPT Partitioning) за вимогами ДБН В.2.5-23:2010 п. 3.7
 * Автоматично перерозподіляє однофазні лінії між фазами L1, L2, L3
 */
export interface AutoBalanceResult {
  balancedCircuits: CircuitGroup[];
  initialUnbalancePercent: number;
  finalUnbalancePercent: number;
  initialBalance: PhaseBalanceResult;
  finalBalance: PhaseBalanceResult;
  movedCount: number;
}

export function autoBalancePhases(
  circuits: CircuitGroup[],
  elements: ElectricalElement[]
): AutoBalanceResult {
  const initialBalance = calculatePhaseBalance(circuits, elements);

  // Обчислюємо підключену потужність для кожної групи (трифазні 3P лінії залишаємо без зміни фази)
  const circuitLoads = circuits
    .filter((c) => c.phase !== '3P')
    .map((c) => {
      const p = elements
        .filter((e) => e.circuitId === c.id)
        .reduce((sum, e) => sum + (e.powerWatts || 0), 0);
      return { circuit: c, watts: p };
    });

  // Сортуємо лінії за спаданням потужності (класичний евристичний LPT підхід)
  circuitLoads.sort((a, b) => b.watts - a.watts);

  const phaseLoads: Record<'L1' | 'L2' | 'L3', number> = { L1: 0, L2: 0, L3: 0 };
  const newPhases: Record<string, 'L1' | 'L2' | 'L3'> = {};

  circuitLoads.forEach(({ circuit, watts }) => {
    const phases: Array<'L1' | 'L2' | 'L3'> = ['L1', 'L2', 'L3'];
    const minPhase = phases.reduce((best, curr) =>
      phaseLoads[curr] < phaseLoads[best] ? curr : best, 'L1'
    );
    newPhases[circuit.id] = minPhase;
    phaseLoads[minPhase] += watts;
  });

  let movedCount = 0;
  const balancedCircuits = circuits.map((c) => {
    if (c.phase === '3P') return c;
    const assignedPhase = newPhases[c.id] || c.phase || 'L1';
    if (assignedPhase !== c.phase) {
      movedCount++;
    }
    return { ...c, phase: assignedPhase };
  });

  const finalBalance = calculatePhaseBalance(balancedCircuits, elements);

  return {
    balancedCircuits,
    initialUnbalancePercent: initialBalance.unbalancePercent,
    finalUnbalancePercent: finalBalance.unbalancePercent,
    initialBalance,
    finalBalance,
    movedCount,
  };
}

/**
 * Розрахунок загального навантаження всього багатоповерхового проекту
 */
export interface ProjectElectricalSummary {
  installedPowerWatts: number;
  installedPowerKw: number;
  demandFactor: number;
  designPowerWatts: number;
  designPowerKw: number;
  mainCurrentA: number;
  mainBreakerRatingA: number;
  isMainBreakerOverloaded: boolean;
  floorsCount: number;
  phaseBalance?: PhaseBalanceResult;
}

export function calculateProjectElectricalSummary(
  project: CadProject,
  customDemandFactor?: number
): ProjectElectricalSummary {
  const aggregated = getAggregatedProjectData(project);
  const allElements = aggregated.allElements;

  // Розрахунок суми потужностей всіх дійсних елементів по всіх поверхах
  const installedWatts = allElements.reduce((sum, el) => sum + (el.powerWatts || 0), 0);

  // Коефіцієнт попиту за ДБН В.2.5-23:2010 (Табл. 3.1 для квартир/будинків)
  const demandFactor =
    customDemandFactor !== undefined
      ? customDemandFactor
      : installedWatts > 10000
      ? 0.7
      : 0.8;

  const designWatts = Math.round(installedWatts * demandFactor);
  const is3Ph = project.supplyPhase === '3-phase';
  const mainCurrent = calculateLineCurrent(designWatts, is3Ph, 0.95);

  const phaseBalance = is3Ph ? calculatePhaseBalance(project.circuits, allElements) : undefined;
  const isMainOverloaded = mainCurrent > project.mainBreakerRatingA;

  return {
    installedPowerWatts: installedWatts,
    installedPowerKw: Number((installedWatts / 1000).toFixed(2)),
    demandFactor,
    designPowerWatts: designWatts,
    designPowerKw: Number((designWatts / 1000).toFixed(2)),
    mainCurrentA: mainCurrent,
    mainBreakerRatingA: project.mainBreakerRatingA,
    isMainBreakerOverloaded: isMainOverloaded,
    floorsCount: aggregated.syncedFloors.length,
    phaseBalance,
  };
}
