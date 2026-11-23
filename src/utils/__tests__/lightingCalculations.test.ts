import { describe, it, expect } from 'vitest';
import {
  DBN_LIGHTING_NORMS,
  FIXTURE_PRESETS,
  calculateRoomIndex,
  estimateUtilizationFactor,
  calculateRoomLighting,
  generateLightingLayout,
} from '../lightingCalculations';
import { Room, Wall, WallOpening } from '../../types/cad';

describe('lightingCalculations', () => {
  it('exposes DBN V.2.5-28:2018 target illuminance norms', () => {
    expect(DBN_LIGHTING_NORMS.living.minLux).toBe(150);
    expect(DBN_LIGHTING_NORMS.office.minLux).toBe(300);
    expect(DBN_LIGHTING_NORMS.hallway.minLux).toBe(100);
  });

  it('computes room index and utilization factor correctly', () => {
    // 4m x 5m room, 2.8m ceiling, 0.8m working plane -> hp = 2.0m -> i = 20 / (2 * 9) = 1.111
    const roomIdx = calculateRoomIndex(4, 5, 2.8, 0.8);
    expect(roomIdx).toBeCloseTo(1.11, 2);
    expect(estimateUtilizationFactor(roomIdx)).toBe(0.52);
  });

  it('calculates required luminous flux and fixture count using utilization factor method', () => {
    const officeRoom: Room = {
      id: 'rm_office',
      name: 'Кабінет',
      type: 'office',
      areaM2: 16,
      points: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 400 },
        { x: 0, y: 400 },
      ],
    };
    const spot = FIXTURE_PRESETS[0]; // 7W, 650 lm
    const result = calculateRoomLighting(officeRoom, spot, 2800, 300, 1.3, 1.1);

    expect(result.roomAreaM2).toBe(16);
    expect(result.targetLux).toBe(300);
    expect(result.recommendedFixturesCount).toBeGreaterThanOrEqual(10);
    expect(result.totalPowerWatts).toBe(result.recommendedFixturesCount * spot.powerWatts);
    expect(result.achievedLux).toBeGreaterThan(250);
  });

  it('generates lighting layout with unique fixture and wire IDs (no React duplicate keys)', () => {
    const room: Room = {
      id: 'rm_living_1',
      name: 'Вітальня',
      type: 'living',
      areaM2: 20,
      points: [
        { x: 100, y: 100 },
        { x: 600, y: 100 },
        { x: 600, y: 500 },
        { x: 100, y: 500 },
      ],
    };
    const walls: Wall[] = [
      { id: 'w1', start: { x: 100, y: 100 }, end: { x: 600, y: 100 }, thickness: 150 },
      { id: 'w2', start: { x: 600, y: 100 }, end: { x: 600, y: 500 }, thickness: 150 },
      { id: 'w3', start: { x: 600, y: 500 }, end: { x: 100, y: 500 }, thickness: 150 },
      { id: 'w4', start: { x: 100, y: 500 }, end: { x: 100, y: 100 }, thickness: 150 },
    ];
    const openings: WallOpening[] = [
      { id: 'door_1', wallId: 'w1', type: 'door', positionRatio: 0.3, width: 900 },
    ];

    const layout = generateLightingLayout(
      room,
      FIXTURE_PRESETS[0],
      'grid_spots',
      6,
      walls,
      openings,
      2700
    );

    expect(layout.fixtures.length).toBe(6);
    expect(layout.switchElement).toBeDefined();
    expect(layout.wireRoutes.length).toBe(6); // 1 switch->light + 5 daisy-chain light->light

    const allIds = [
      ...layout.fixtures.map((f) => f.id),
      ...(layout.switchElement ? [layout.switchElement.id] : []),
      ...layout.wireRoutes.map((w) => w.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
