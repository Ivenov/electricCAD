import { describe, it, expect } from 'vitest';
import {
  pxToMm,
  mmToPx,
  calculatePolygonAreaM2,
  calculateWallLengthMm,
  setWallLengthMm,
  alignWallOrtho,
  calculateCableLengthM,
  checkChaseIntersectsOpening,
} from '../cadMath';
import { computeOrthogonalPath } from '../autoRouting';
import { ElectricalElement, Wall, WallOpening } from '../../types/cad';

describe('cadMath & autoRouting', () => {
  it('converts px to mm and computes Shoelace room area in m²', () => {
    expect(pxToMm(100)).toBe(1000);
    expect(mmToPx(2500)).toBe(250);

    // 4m x 5m room -> 400px x 500px -> 20.0 m²
    const area = calculatePolygonAreaM2([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 500 },
      { x: 0, y: 500 },
    ]);
    expect(area).toBe(20);
  });

  it('resizes walls using start, center, and end anchors and snaps to orthogonal angles', () => {
    const wall: Wall = {
      id: 'w1',
      start: { x: 100, y: 100 },
      end: { x: 400, y: 105 },
      thickness: 150,
    };

    const ortho = alignWallOrtho(wall);
    expect(ortho.end.y).toBe(100);

    const resizedStart = setWallLengthMm(ortho, 5000, 'start');
    expect(calculateWallLengthMm(resizedStart)).toBe(5000);
    expect(resizedStart.start).toEqual({ x: 100, y: 100 });
    expect(resizedStart.end).toEqual({ x: 600, y: 100 });

    const resizedCenter = setWallLengthMm(resizedStart, 3000, 'center');
    expect(calculateWallLengthMm(resizedCenter)).toBe(3000);
    expect((resizedCenter.start.x + resizedCenter.end.x) / 2).toBe(350);
  });

  it('calculates 3D cable length including ceiling drops and 15% slack', () => {
    const elFrom: ElectricalElement = {
      id: 'p1',
      category: 'panel',
      type: 'panel_cu',
      name: 'ЩР',
      position: { x: 100, y: 100 },
      rotation: 0,
      mountingHeightMm: 1500,
      powerWatts: 0,
      ipRating: 'IP44',
    };
    const elTo: ElectricalElement = {
      id: 's1',
      category: 'socket',
      type: 'socket_single',
      name: 'Розетка',
      position: { x: 500, y: 100 }, // 400px = 4000mm
      rotation: 0,
      mountingHeightMm: 300,
      powerWatts: 500,
      ipRating: 'IP20',
    };

    // horiz=4000mm, dropFrom=2700-1500=1200mm, dropTo=2700-300=2400mm -> raw=7600mm * 1.15 = 8.74m -> 8.7m
    const len = calculateCableLengthM(elFrom, elTo, 2700, 'ceiling');
    expect(len).toBe(8.7);
  });

  it('detours orthogonal routes around door/window openings per ПУЕ §2.1.52', () => {
    const wall: Wall = {
      id: 'w_front',
      start: { x: 100, y: 200 },
      end: { x: 700, y: 200 },
      thickness: 150,
    };
    const windowOpening: WallOpening = {
      id: 'win_1',
      wallId: 'w_front',
      type: 'window',
      positionRatio: 0.5, // center at x=400, y=200
      width: 1400,
    };

    const start = { x: 250, y: 200 };
    const end = { x: 550, y: 200 };

    const directCollision = checkChaseIntersectsOpening([start, end], [wall], [windowOpening]);
    expect(directCollision.hasCollision).toBe(true);

    const routedPath = computeOrthogonalPath(start, end, [wall], [windowOpening]);
    expect(routedPath.length).toBeGreaterThan(2);
    const routedCollision = checkChaseIntersectsOpening(routedPath, [wall], [windowOpening]);
    expect(routedCollision.hasCollision).toBe(false);
  });
});
