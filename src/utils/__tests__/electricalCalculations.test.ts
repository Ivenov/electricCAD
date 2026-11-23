import { describe, it, expect } from 'vitest';
import {
  calculateLineCurrent,
  calculateVoltageDrop,
  calculateShortCircuitCheck,
  analyzeCircuit,
  calculatePhaseBalance,
  autoBalancePhases,
  calculateProjectElectricalSummary,
  getInstallationMethodFactor,
  getTemperatureFactor,
} from '../electricalCalculations';
import { CadProject, CircuitGroup, ElectricalElement, WireRoute } from '../../types/cad';

function makeElement(overrides: Partial<ElectricalElement> = {}): ElectricalElement {
  return {
    id: overrides.id || 'el_1',
    category: overrides.category || 'socket',
    type: overrides.type || 'socket_double',
    name: overrides.name || 'Розетка 230В',
    position: overrides.position || { x: 200, y: 200 },
    rotation: 0,
    mountingHeightMm: 300,
    powerWatts: overrides.powerWatts ?? 1000,
    ipRating: 'IP20',
    ...overrides,
  };
}

function makeCircuit(overrides: Partial<CircuitGroup> = {}): CircuitGroup {
  return {
    id: overrides.id || 'c_1',
    number: overrides.number ?? 1,
    name: overrides.name || 'Розетки вітальні',
    breakerRatingA: overrides.breakerRatingA ?? 16,
    breakerCurve: overrides.breakerCurve ?? 'C',
    rcdType: overrides.rcdType ?? 'rcd_30ma',
    cableType: overrides.cableType ?? 'VVGng_3x2.5',
    phase: overrides.phase ?? 'L1',
    color: '#38bdf8',
    ...overrides,
  };
}

describe('electricalCalculations', () => {
  it('calculates single-phase and three-phase line currents accurately', () => {
    expect(calculateLineCurrent(0, false, 0.95)).toBe(0);
    // 1-phase: 3680 / (230 * 1.0) = 16 A
    expect(calculateLineCurrent(3680, false, 1.0)).toBe(16);
    // 3-phase: 12000 / (sqrt(3) * 400 * 0.95) ≈ 18.23 A
    expect(calculateLineCurrent(12000, true, 0.95)).toBeCloseTo(18.23, 2);
  });

  it('calculates voltage drop for 1-phase and 3-phase lines per ПУЕ / ДБН', () => {
    // 1-phase: (2 * 25 * 16 * 1.0) / (50 * 2.5) = 6.4V -> 2.78%
    const v1 = calculateVoltageDrop(16, 25, 2.5, false, 1.0);
    expect(v1.deltaVolts).toBe(6.4);
    expect(v1.deltaPercent).toBe(2.78);
    expect(v1.isAcceptable).toBe(true);

    // 3-phase: (sqrt(3) * 30 * 18.23 * 0.95) / (50 * 4) ≈ 4.5V -> 1.13%
    const v3 = calculateVoltageDrop(18.23, 30, 4.0, true, 0.95);
    expect(v3.deltaPercent).toBeLessThan(1.5);
    expect(v3.isAcceptable).toBe(true);
  });

  it('detects 3-phase circuits via phase="3P" or 5-core cable and uses 400V formula', () => {
    const circuit = makeCircuit({
      id: 'c_3p',
      cableType: 'VVGng_5x4',
      breakerRatingA: 25,
      phase: '3P',
    });
    const elements = [
      makeElement({
        id: 'el_boiler_3p',
        category: 'appliance',
        type: 'electric_boiler',
        powerWatts: 12000,
        circuitId: 'c_3p',
      }),
    ];
    const wires: WireRoute[] = [
      {
        id: 'w_3p',
        fromId: 'panel',
        toId: 'el_boiler_3p',
        mode: 'ortho',
        conduit: 'ceiling',
        cableType: 'VVGng_5x4',
        circuitId: 'c_3p',
        calculatedLengthM: 20,
      },
    ];

    const analysis = analyzeCircuit(circuit, elements, wires, '3-phase', 'TN-C-S');
    expect(analysis.isThreePhaseLine).toBe(true);
    expect(analysis.calculatedCurrentA).toBeCloseTo(17.32, 1);
    expect(analysis.isBreakerOverloaded).toBe(false);
    expect(analysis.overallStatus).toBe('ok');
    expect(analysis.calculationDetails.status).toBe('calculated');
  });

  it('applies PUE installation method, grouping Kg, and temperature Kt derating factors', () => {
    expect(getInstallationMethodFactor('conduit_insulation').factor).toBe(0.72);
    expect(getTemperatureFactor(35)).toBe(0.88);

    const circuit = makeCircuit({
      id: 'c_derate',
      cableType: 'VVGng_3x2.5', // base Idd = 27A
      breakerRatingA: 16,
      installationMethod: 'conduit_insulation', // 0.72
      groupingFactorKg: 0.8,
      ambientTempC: 35, // 0.88
    });
    const elements = [makeElement({ id: 'el_d1', powerWatts: 2000, circuitId: 'c_derate' })];

    const analysis = analyzeCircuit(circuit, elements, [], '1-phase', 'TN-S');
    // 0.72 * 0.8 * 0.88 = 0.50688 -> 0.51; 27 * 0.51 = 13.77 -> 13.8 A < 16 A breaker!
    expect(analysis.deratingFactorTotal).toBe(0.51);
    expect(analysis.cableAmpacityA).toBeLessThan(16);
    expect(analysis.isCableProtectedByBreaker).toBe(false);
    expect(analysis.overallStatus).toBe('error');
  });

  it('enforces mandatory RCD on TT grounding system per ПУЕ §1.7.59', () => {
    const circuit = makeCircuit({ id: 'c_tt', rcdType: 'none', breakerRatingA: 16 });
    const elements = [makeElement({ id: 'el_tt', powerWatts: 1000, circuitId: 'c_tt' })];

    const analysis = analyzeCircuit(circuit, elements, [], '1-phase', 'TT');
    expect(analysis.isGroundingProtectionMissing).toBe(true);
    expect(analysis.overallStatus).toBe('error');
  });

  it('returns "uncalculated" status when circuit has no connected loads', () => {
    const circuit = makeCircuit({ id: 'c_empty' });
    const analysis = analyzeCircuit(circuit, [], [], '1-phase', 'TN-C-S');

    expect(analysis.overallStatus).toBe('uncalculated');
    expect(analysis.calculationDetails.status).toBe('insufficient_data');
  });

  it('evaluates short-circuit loop check per ПУЕ §1.7.79', () => {
    const okCheck = calculateShortCircuitCheck(15, 2.5, 16, 'C');
    expect(okCheck.isTrippingAssured).toBe(true);

    const longRunCheck = calculateShortCircuitCheck(120, 1.5, 25, 'D');
    expect(longRunCheck.isTrippingAssured).toBe(false);
    expect(longRunCheck.recommendation).toBeTruthy();
  });

  it('aggregates multi-floor loads and optimizes 3-phase balance via LPT', () => {
    const circuits: CircuitGroup[] = [
      makeCircuit({ id: 'c1', number: 1, phase: 'L1' }),
      makeCircuit({ id: 'c2', number: 2, phase: 'L1' }),
      makeCircuit({ id: 'c3', number: 3, phase: 'L1' }),
    ];
    const elements: ElectricalElement[] = [
      makeElement({ id: 'e1', circuitId: 'c1', powerWatts: 3000 }),
      makeElement({ id: 'e2', circuitId: 'c2', powerWatts: 3000 }),
      makeElement({ id: 'e3', circuitId: 'c3', powerWatts: 3000 }),
    ];

    const initial = calculatePhaseBalance(circuits, elements);
    expect(initial.isBalanced).toBe(false);

    const balanced = autoBalancePhases(circuits, elements);
    expect(balanced.finalBalance.isBalanced).toBe(true);
    expect(balanced.finalBalance.unbalancePercent).toBe(0);

    const multiFloorProject: CadProject = {
      id: 'p_multi',
      title: 'Двоповерховий котедж',
      author: 'Тест',
      date: '2026',
      scale: 0.1,
      ceilingHeightMm: 2800,
      gridStepMm: 100,
      supplyPhase: '3-phase',
      groundingSystem: 'TN-C-S',
      mainBreakerRatingA: 40,
      rooms: [],
      walls: [],
      openings: [],
      elements: [makeElement({ id: 'f1_e1', circuitId: 'c1', powerWatts: 5000 })],
      wires: [],
      circuits,
      furniture: [],
      activeFloorId: 'floor_1',
      floors: [
        {
          id: 'floor_1',
          name: 'Поверх 1',
          levelNumber: 1,
          elevationMm: 0,
          ceilingHeightMm: 2800,
          rooms: [],
          walls: [],
          openings: [],
          elements: [],
          wires: [],
          furniture: [],
        },
        {
          id: 'floor_2',
          name: 'Поверх 2',
          levelNumber: 2,
          elevationMm: 3000,
          ceilingHeightMm: 2700,
          rooms: [],
          walls: [],
          openings: [],
          elements: [makeElement({ id: 'f2_e1', circuitId: 'c2', powerWatts: 7000 })],
          wires: [],
          furniture: [],
        },
      ],
    };

    const summary = calculateProjectElectricalSummary(multiFloorProject);
    expect(summary.floorsCount).toBe(2);
    expect(summary.installedPowerWatts).toBe(12000);
    expect(summary.installedPowerKw).toBe(12);
    expect(summary.demandFactor).toBe(0.7); // > 10 kW
    expect(summary.designPowerWatts).toBe(8400);
  });
});
