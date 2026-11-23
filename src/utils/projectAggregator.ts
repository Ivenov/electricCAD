/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Агрегатор даних багатоповерхових об'єктів та утиліти одиниць вимірювання.
 * Об'єднує активний поверх із неактивними поверхами (project.floors),
 * синтезує міжповерхові стояки живлення (ВРП -> ЩР-1, ЩР-2)
 * та забезпечує єдине джерело правди для розрахунків, специфікацій і кошторисів.
 */

import {
  CadProject,
  ElectricalElement,
  FloorLevel,
  FurnitureItem,
  RiserFeeder,
  Room,
  Wall,
  WallOpening,
  WireRoute,
} from '../types/cad';

export interface FloorTaggedElement extends ElectricalElement {
  floorId: string;
  floorName: string;
  boardName: string;
}

export interface FloorTaggedWire extends WireRoute {
  floorId: string;
  floorName: string;
  boardName: string;
}

export interface AggregatedFloorSummary {
  floorId: string;
  floorName: string;
  levelNumber: number;
  elevationMm: number;
  boardName: string;
  elementsCount: number;
  wiresCount: number;
  installedWatts: number;
  areaM2: number;
  cableLengthM: number;
}

export interface AggregatedProjectData {
  syncedFloors: FloorLevel[];
  allElements: FloorTaggedElement[];
  allWires: FloorTaggedWire[];
  allRooms: Array<Room & { floorId: string; floorName: string }>;
  allWalls: Wall[];
  allOpenings: WallOpening[];
  allFurniture: FurnitureItem[];
  riserFeeders: RiserFeeder[];
  floorSummaries: AggregatedFloorSummary[];
  totalAreaM2: number;
}

/**
 * Повертає синхронізований зріз усіх поверхів проєкту,
 * підставляючи актуальний стан активного полотна у відповідний поверх.
 */
export function getAggregatedProjectData(project: CadProject): AggregatedProjectData {
  const existingFloors = project.floors && project.floors.length > 0 ? project.floors : [];
  const activeId = project.activeFloorId || existingFloors[0]?.id || 'floor_1';

  let syncedFloors: FloorLevel[];
  if (existingFloors.length === 0) {
    syncedFloors = [
      {
        id: activeId,
        name: 'Поверх 1',
        levelNumber: 1,
        elevationMm: 0,
        ceilingHeightMm: project.ceilingHeightMm || 2700,
        distributionBoardName: 'ВРП / ЩР-1',
        backgroundImage: project.backgroundImage,
        rooms: project.rooms || [],
        walls: project.walls || [],
        openings: project.openings || [],
        elements: project.elements || [],
        wires: project.wires || [],
        furniture: project.furniture || [],
      },
    ];
  } else {
    syncedFloors = existingFloors.map((fl) =>
      fl.id === activeId
        ? {
            ...fl,
            ceilingHeightMm: project.ceilingHeightMm || fl.ceilingHeightMm || 2700,
            backgroundImage: project.backgroundImage,
            rooms: project.rooms || [],
            walls: project.walls || [],
            openings: project.openings || [],
            elements: project.elements || [],
            wires: project.wires || [],
            furniture: project.furniture || [],
          }
        : fl
    );
  }

  const allElements: FloorTaggedElement[] = [];
  const allWires: FloorTaggedWire[] = [];
  const allRooms: Array<Room & { floorId: string; floorName: string }> = [];
  const allWalls: Wall[] = [];
  const allOpenings: WallOpening[] = [];
  const allFurniture: FurnitureItem[] = [];
  const floorSummaries: AggregatedFloorSummary[] = [];

  syncedFloors.forEach((fl, idx) => {
    const boardName = fl.distributionBoardName || (idx === 0 ? 'ВРП / ЩР-1' : `ЩР-${idx + 1}`);
    const flElements = fl.elements || [];
    const flWires = fl.wires || [];
    const flRooms = fl.rooms || [];

    flElements.forEach((el) => {
      allElements.push({
        ...el,
        floorId: fl.id,
        floorName: fl.name,
        boardName,
      });
    });

    flWires.forEach((w) => {
      allWires.push({
        ...w,
        floorId: fl.id,
        floorName: fl.name,
        boardName,
      });
    });

    flRooms.forEach((r) => {
      allRooms.push({
        ...r,
        floorId: fl.id,
        floorName: fl.name,
      });
    });

    allWalls.push(...(fl.walls || []));
    allOpenings.push(...(fl.openings || []));
    allFurniture.push(...(fl.furniture || []));

    const installedWatts = flElements.reduce((s, e) => s + (e.powerWatts || 0), 0);
    const areaM2 = Number(flRooms.reduce((s, r) => s + (r.areaM2 || 0), 0).toFixed(1));
    const cableLengthM = Number(flWires.reduce((s, w) => s + (w.calculatedLengthM || 0), 0).toFixed(1));

    floorSummaries.push({
      floorId: fl.id,
      floorName: fl.name,
      levelNumber: fl.levelNumber,
      elevationMm: fl.elevationMm,
      boardName,
      elementsCount: flElements.length,
      wiresCount: flWires.length,
      installedWatts,
      areaM2,
      cableLengthM,
    });
  });

  // Автоматичний розрахунок магістральних стояків від ВРП до поверхових щитків (якщо > 1 поверху)
  const mainFloor = syncedFloors[0];
  const mainBoard = mainFloor?.distributionBoardName || 'ВРП';
  const mainElevMm = mainFloor?.elevationMm || 0;

  const autoRisers: RiserFeeder[] = syncedFloors.slice(1).map((fl, idx) => {
    const existingRiser = project.riserFeeders?.find((r) => r.floorId === fl.id);
    if (existingRiser) return existingRiser;

    const verticalDiffM = Math.abs((fl.elevationMm || 0) - mainElevMm) / 1000;
    const riserLenM = Number((verticalDiffM + 4.5).toFixed(1)); // вертикальний підйом + заведення у два щити
    const floorWatts = (fl.elements || []).reduce((s, e) => s + (e.powerWatts || 0), 0);
    const is3Ph = project.supplyPhase === '3-phase';

    const cableType: RiserFeeder['cableType'] = is3Ph
      ? floorWatts > 12000
        ? 'VVGng_5x10'
        : floorWatts > 7000
        ? 'VVGng_5x6'
        : 'VVGng_5x4'
      : 'VVGng_3x6';

    const breakerRatingA = floorWatts > 12000 ? 40 : floorWatts > 7000 ? 32 : 25;

    return {
      id: `riser_${fl.id}_${idx}`,
      fromBoard: mainBoard,
      toBoard: fl.distributionBoardName || `ЩР-${idx + 2}`,
      floorId: fl.id,
      cableType,
      breakerRatingA,
      lengthM: riserLenM,
    };
  });

  const totalAreaM2 = Number(allRooms.reduce((s, r) => s + (r.areaM2 || 0), 0).toFixed(1));

  return {
    syncedFloors,
    allElements,
    allWires,
    allRooms,
    allWalls,
    allOpenings,
    allFurniture,
    riserFeeders: autoRisers,
    floorSummaries,
    totalAreaM2,
  };
}

/**
 * Форматує значення з міліметрів у вибрані одиниці проєкту (мм, см, м).
 */
export function formatDimensionValue(mm: number, unit: 'mm' | 'cm' | 'm' = 'mm', includeUnit = true): string {
  if (!Number.isFinite(mm)) return includeUnit ? `0 ${getUnitLabel(unit)}` : '0';
  let formatted: string;
  if (unit === 'cm') {
    formatted = (mm / 10).toFixed(1).replace(/\.0$/, '');
  } else if (unit === 'm') {
    formatted = (mm / 1000).toFixed(2).replace(/\.00$/, '');
  } else {
    formatted = Math.round(mm).toString();
  }
  return includeUnit ? `${formatted} ${getUnitLabel(unit)}` : formatted;
}

export function getUnitLabel(unit: 'mm' | 'cm' | 'm' = 'mm'): string {
  switch (unit) {
    case 'cm':
      return 'см';
    case 'm':
      return 'м';
    default:
      return 'мм';
  }
}

export function convertDisplayUnitToMm(value: number, unit: 'mm' | 'cm' | 'm' = 'mm'): number {
  if (!Number.isFinite(value)) return 0;
  if (unit === 'cm') return Math.round(value * 10);
  if (unit === 'm') return Math.round(value * 1000);
  return Math.round(value);
}

export function convertMmToDisplayUnit(mm: number, unit: 'mm' | 'cm' | 'm' = 'mm'): number {
  if (!Number.isFinite(mm)) return 0;
  if (unit === 'cm') return Number((mm / 10).toFixed(1));
  if (unit === 'm') return Number((mm / 1000).toFixed(3));
  return Math.round(mm);
}
