import { describe, it, expect } from 'vitest';
import { generateCableSchedule } from '../cableSchedule';
import { CadProject } from '../../types/cad';

describe('cableSchedule', () => {
  it('aggregates wires across all floors, adds riser feeders, and computes termination reserve + ceiling procurement length', () => {
    const project: CadProject = {
      id: 'proj_cables',
      title: 'Тест кабельного журналу',
      author: 'Інженер',
      date: '2026',
      scale: 0.1,
      ceilingHeightMm: 2700,
      gridStepMm: 100,
      supplyPhase: '3-phase',
      groundingSystem: 'TN-C-S',
      mainBreakerRatingA: 40,
      circuits: [
        {
          id: 'c_sock',
          number: 1,
          name: 'Розетки 1 поверх',
          breakerRatingA: 16,
          breakerCurve: 'C',
          rcdType: 'rcd_30ma',
          cableType: 'VVGng_3x2.5',
          phase: 'L1',
          color: '#38bdf8',
        },
        {
          id: 'c_light',
          number: 2,
          name: 'Освітлення 2 поверх',
          breakerRatingA: 10,
          breakerCurve: 'C',
          rcdType: 'none',
          cableType: 'VVGng_3x1.5',
          phase: 'L2',
          color: '#f59e0b',
        },
      ],
      rooms: [],
      walls: [],
      openings: [],
      elements: [
        {
          id: 'p1',
          category: 'panel',
          type: 'panel_cu',
          name: 'ВРП / ЩР-1',
          position: { x: 100, y: 100 },
          rotation: 0,
          mountingHeightMm: 1500,
          powerWatts: 0,
          ipRating: 'IP44',
        },
        {
          id: 's1',
          category: 'socket',
          type: 'socket_double',
          name: 'Розетка вітальні',
          position: { x: 500, y: 100 },
          rotation: 0,
          mountingHeightMm: 300,
          powerWatts: 1200,
          circuitId: 'c_sock',
          ipRating: 'IP20',
        },
      ],
      wires: [
        {
          id: 'w1',
          fromId: 'p1',
          toId: 's1',
          mode: 'ortho',
          conduit: 'ceiling',
          cableType: 'VVGng_3x2.5',
          circuitId: 'c_sock',
          cableTag: 'W1-01',
          calculatedLengthM: 5.0,
        },
      ],
      furniture: [],
      activeFloorId: 'floor_1',
      floors: [
        {
          id: 'floor_1',
          name: 'Поверх 1',
          levelNumber: 1,
          elevationMm: 0,
          ceilingHeightMm: 2700,
          distributionBoardName: 'ВРП',
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
          elevationMm: 3200,
          ceilingHeightMm: 2700,
          distributionBoardName: 'ЩР-2',
          rooms: [],
          walls: [],
          openings: [],
          elements: [
            {
              id: 'p2',
              category: 'panel',
              type: 'panel_cu',
              name: 'ЩР-2',
              position: { x: 100, y: 100 },
              rotation: 0,
              mountingHeightMm: 1500,
              powerWatts: 0,
              ipRating: 'IP44',
            },
            {
              id: 'l2',
              category: 'light',
              type: 'light_spot',
              name: 'Спот спальні',
              position: { x: 400, y: 100 },
              rotation: 0,
              mountingHeightMm: 2700,
              powerWatts: 15,
              circuitId: 'c_light',
              ipRating: 'IP20',
            },
          ],
          wires: [
            {
              id: 'w2',
              fromId: 'p2',
              toId: 'l2',
              mode: 'ortho',
              conduit: 'ceiling',
              cableType: 'VVGng_3x1.5',
              circuitId: 'c_light',
              cableTag: 'W2-01',
              calculatedLengthM: 4.0,
            },
          ],
          furniture: [],
        },
      ],
    };

    const schedule = generateCableSchedule(project);

    // 1 riser (M0-01) + 1 wire on floor 1 + 1 wire on floor 2 = 3 entries
    expect(schedule.entries.length).toBe(3);
    expect(schedule.entries[0].cableTag).toBe('M0-01');
    expect(schedule.entries.some((e) => e.cableTag === 'W1-01')).toBe(true);
    expect(schedule.entries.some((e) => e.cableTag === 'W2-01')).toBe(true);

    // W1-01: horiz=5.0m, vert=(2.7-1.5)+(2.7-0.3)=3.6m, base=8.6m, +12%=1.0m -> 9.6m -> ceil=10m
    const w1Entry = schedule.entries.find((e) => e.cableTag === 'W1-01')!;
    expect(w1Entry.horizontalLengthM).toBe(5.0);
    expect(w1Entry.verticalDropsM).toBe(3.6);
    expect(w1Entry.totalDesignLengthM).toBe(9.6);
    expect(w1Entry.procurementLengthM).toBe(10);

    expect(schedule.byCableType.length).toBeGreaterThanOrEqual(2);
    expect(schedule.totalLengthM).toBeGreaterThan(20);
  });
});
