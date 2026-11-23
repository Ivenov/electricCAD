/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Модуль інтелектуальної автоматичної розстановки розеток за ДБН та ПУЕ:
 * - ДБН В.2.5-23:2010 «Проектування електрообладнання об'єктів цивільного призначення»
 * - ДБН В.2.2-15:2019 «Житлові будинки. Основні положення»
 * - ПУЕ-2017 Розділ 7.1 «Електроустановки житлових, громадських, адміністративних та побутових будинків»
 * 
 * Можливості:
 * 1. Розміщення розеток по периметру стін з регульованим кроком (2.0 - 3.5 м).
 * 2. Інтелектуальна прив'язка до меблів (робочий стіл, узголів'я ліжка, диван, ТБ-зона, кухонний фартух).
 * 3. Суворе дотримання зон електробезпеки санвузлів (ПУЕ §7.1.47: >600 мм від мокрих зон, клас IP44).
 * 4. Захист від попадання в дверні та віконні отвори (відступ ≥150 мм від укосу).
 * 5. Запобігання дублюванню з уже встановленими розетками на відстані < 1.2 м.
 * 6. Автоматичне орієнтування кута повороту обличчям всередину кімнати.
 */

import {
  CadProject,
  ElectricalElement,
  Room,
  Wall,
  WallOpening,
  FurnitureItem,
  Point,
} from '../types/cad';
import { distance, pxToMm, mmToPx, getRotationForInwardNormal } from './cadMath';
import { isPointInPolygon } from './roomGeometry';

export type SocketDensityPreset = 'economy' | 'standard' | 'comfort' | 'premium';

export interface AutoSocketPlacementOptions {
  densityPreset: SocketDensityPreset;
  selectedRoomIds: string[]; // empty or includes 'all' means all rooms
  wallStepM: number; // Step along walls in meters (e.g. 2.5)
  enableFurnitureProximity: boolean;
  enableBathroomSafetyZones: boolean;
  clearExistingSocketsInSelectedRooms: boolean;
  avoidDuplicateDistanceMm: number; // default 1200 mm
  defaultHeightsMm?: {
    general?: number; // default 300
    kitchenCounter?: number; // default 1050
    bathroom?: number; // default 1000
    desk?: number; // default 750 or 300
    bed?: number; // default 650
    tv?: number; // default 1100
  };
}

export interface RoomSocketStats {
  roomId: string;
  roomName: string;
  roomType: Room['type'];
  areaM2: number;
  wallPerimeterM: number;
  existingCount: number;
  addedCount: number;
  addedPowerW: number;
  standardClause: string;
}

export interface AutoSocketPlacementResult {
  updatedProject: CadProject;
  newElements: ElectricalElement[];
  removedElementsCount: number;
  totalSocketsGenerated: number;
  totalPowerAddedW: number;
  statsByRoom: RoomSocketStats[];
  safetyNotes: string[];
}

/**
 * Returns preset configuration
 */
export function getDensityPresetConfig(preset: SocketDensityPreset): {
  wallStepM: number;
  generalType: 'socket_single' | 'socket_double';
  kitchenCounterType: 'socket_double' | 'socket_triple';
  bedsideType: 'socket_single' | 'socket_double';
  workstationType: 'socket_double' | 'socket_triple';
  descriptionUk: string;
  normClause: string;
} {
  switch (preset) {
    case 'economy':
      return {
        wallStepM: 3.2,
        generalType: 'socket_single',
        kitchenCounterType: 'socket_double',
        bedsideType: 'socket_single',
        workstationType: 'socket_double',
        descriptionUk: 'Базовий норматив ДБН (1 розетка на 6 м², крок по стінах ~3.2 м, одинарні блоки)',
        normClause: 'ДБН В.2.5-23:2010 п. 4.28',
      };
    case 'standard':
      return {
        wallStepM: 2.8,
        generalType: 'socket_single',
        kitchenCounterType: 'socket_double',
        bedsideType: 'socket_double',
        workstationType: 'socket_double',
        descriptionUk: 'Оптимальний стандарт (крок ~2.8 м, виділені точки біля ліжок та робочих зон)',
        normClause: 'ДБН В.2.5-23:2010 п. 4.28, ПУЕ §7.1',
      };
    case 'premium':
      return {
        wallStepM: 2.0,
        generalType: 'socket_double',
        kitchenCounterType: 'socket_triple',
        bedsideType: 'socket_double',
        workstationType: 'socket_triple',
        descriptionUk: 'Максимальна насиченість Smart Home (крок ~2.0 м, потрійні мультимедіа та кухонні блоки)',
        normClause: 'ДБН В.2.2-15:2019, ПУЕ §7.1.72',
      };
    case 'comfort':
    default:
      return {
        wallStepM: 2.4,
        generalType: 'socket_double',
        kitchenCounterType: 'socket_double',
        bedsideType: 'socket_double',
        workstationType: 'socket_double',
        descriptionUk: 'Комфортний сучасний ремонт (крок 2.4 м, подвійні блоки, розширений кухонний фартух)',
        normClause: 'ДБН В.2.5-23:2010 п. 4.28 & ДБН В.2.2-15',
      };
  }
}

/**
 * Normal vector pointing inside a polygon from an edge [p1 -> p2]
 */
function getInwardNormal(p1: Point, p2: Point, polygon: Point[]): { nx: number; ny: number } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { nx: 0, ny: 0 };

  // Two candidate normals: (-dy/len, dx/len) and (dy/len, -dx/len)
  const n1x = -dy / len;
  const n1y = dx / len;

  // Test point shifted slightly inward along candidate 1
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const testP1 = { x: midX + n1x * 8, y: midY + n1y * 8 };

  if (isPointInPolygon(testP1, polygon)) {
    return { nx: n1x, ny: n1y };
  } else {
    return { nx: -n1x, ny: -n1y };
  }
}

/**
 * Checks if a candidate position on a wall falls into a door/window opening or is too close to its jamb
 */
function isPositionBlockedByOpening(
  pos: Point,
  wall: Wall,
  openings: WallOpening[],
  minClearanceMm: number = 150
): boolean {
  const wallDx = wall.end.x - wall.start.x;
  const wallDy = wall.end.y - wall.start.y;
  const wallLen = Math.hypot(wallDx, wallDy);
  if (wallLen === 0) return false;

  const wallOpenings = openings.filter((op) => op.wallId === wall.id);
  const minClearancePx = mmToPx(minClearanceMm);

  for (const op of wallOpenings) {
    const opCenterPx = op.positionRatio * wallLen;
    const opHalfWidthPx = mmToPx(op.width) / 2;

    // Distance from wall.start to pos projected onto wall vector
    const toPosDx = pos.x - wall.start.x;
    const toPosDy = pos.y - wall.start.y;
    const projDistPx = (toPosDx * wallDx + toPosDy * wallDy) / wallLen;

    const distFromOpCenter = Math.abs(projDistPx - opCenterPx);
    if (distFromOpCenter < opHalfWidthPx + minClearancePx) {
      return true; // Blocked by door or window opening
    }
  }

  return false;
}

/**
 * Checks if a candidate point is too close to any already existing socket
 */
function isTooCloseToExistingSocket(
  pos: Point,
  existingSockets: ElectricalElement[],
  thresholdMm: number
): boolean {
  const thresholdPx = mmToPx(thresholdMm);
  for (const el of existingSockets) {
    if (el.category === 'socket') {
      if (distance(pos, el.position) < thresholdPx) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Finds closest wall segment that matches an edge between room points
 */
function findMatchingWallForSegment(
  p1: Point,
  p2: Point,
  walls: Wall[],
  maxDistPx: number = 30
): Wall | null {
  const midEdge = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

  let bestWall: Wall | null = null;
  let minDist = Infinity;

  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;

    // Project midEdge to wall
    let t = ((midEdge.x - wall.start.x) * dx + (midEdge.y - wall.start.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: wall.start.x + t * dx, y: wall.start.y + t * dy };
    const d = distance(midEdge, proj);

    if (d < minDist && d <= maxDistPx) {
      minDist = d;
      bestWall = wall;
    }
  }

  return bestWall;
}

/**
 * Determines closest circuit in the project for sockets
 */
function findPreferredSocketCircuitId(
  project: CadProject,
  roomType: Room['type'],
  isWetArea: boolean
): string | undefined {
  if (isWetArea) {
    // Prefer bathroom dedicated RCD circuit (10mA or 30mA)
    const bathCirc = project.circuits.find(
      (c) =>
        c.name.toLowerCase().includes('ванн') ||
        c.name.toLowerCase().includes('санвуз') ||
        c.rcdType === 'rcbo_10ma' ||
        c.rcdType === 'rcd_10ma'
    );
    if (bathCirc) return bathCirc.id;
  }

  if (roomType === 'kitchen') {
    const kitchenCirc = project.circuits.find(
      (c) => c.name.toLowerCase().includes('кухн') && (c.breakerRatingA === 16 || c.breakerRatingA === 20)
    );
    if (kitchenCirc) return kitchenCirc.id;
  }

  // General socket circuit (16A, C curve)
  const generalSocketCirc = project.circuits.find(
    (c) =>
      c.breakerRatingA === 16 &&
      (c.name.toLowerCase().includes('розет') || c.cableType === 'VVGng_3x2.5')
  );

  return generalSocketCirc?.id || project.circuits[0]?.id;
}

/**
 * Core placement algorithm according to DBN & PUE
 */
export function calculateAutoSocketPlacement(
  project: CadProject,
  options: AutoSocketPlacementOptions
): AutoSocketPlacementResult {
  const presetConfig = getDensityPresetConfig(options.densityPreset);
  const effectiveStepM = options.wallStepM > 0 ? options.wallStepM : presetConfig.wallStepM;
  const effectiveStepPx = mmToPx(effectiveStepM * 1000);

  const defaultHeights = {
    general: options.defaultHeightsMm?.general ?? 300,
    kitchenCounter: options.defaultHeightsMm?.kitchenCounter ?? 1050,
    bathroom: options.defaultHeightsMm?.bathroom ?? 1000,
    desk: options.defaultHeightsMm?.desk ?? 300,
    bed: options.defaultHeightsMm?.bed ?? 650,
    tv: options.defaultHeightsMm?.tv ?? 1100,
  };

  const avoidDupDistMm = options.avoidDuplicateDistanceMm || 1200;

  // Determine active rooms
  const targetRooms = project.rooms.filter((room) => {
    if (!options.selectedRoomIds || options.selectedRoomIds.length === 0) return true;
    if (options.selectedRoomIds.includes('all')) return true;
    return options.selectedRoomIds.includes(room.id);
  });

  const safetyNotes: string[] = [];
  const generatedElements: ElectricalElement[] = [];
  const statsByRoom: RoomSocketStats[] = [];

  let elementsPool = [...project.elements];
  let removedCount = 0;

  // 1. Optional purge of existing sockets in targeted rooms
  if (options.clearExistingSocketsInSelectedRooms) {
    const remainingElements = elementsPool.filter((el) => {
      if (el.category !== 'socket') return true;
      const inTargetRoom = targetRooms.some((rm) => isPointInPolygon(el.position, rm.points));
      if (inTargetRoom) {
        removedCount++;
        return false;
      }
      return true;
    });
    elementsPool = remainingElements;
  }

  // 2. Iterate each targeted room
  targetRooms.forEach((room) => {
    let roomAddedCount = 0;
    let roomAddedPowerW = 0;
    let perimeterPx = 0;

    const existingInRoom = elementsPool.filter(
      (el) => el.category === 'socket' && isPointInPolygon(el.position, room.points)
    );

    const isBathroom = room.type === 'bathroom';
    const isKitchen = room.type === 'kitchen';
    const circuitId = findPreferredSocketCircuitId(project, room.type, isBathroom);

    // Get furniture items that belong to or are near this room
    const roomFurniture = (project.furniture || []).filter((furn) => {
      return (
        isPointInPolygon(furn.position, room.points) ||
        distance(furn.position, {
          x: room.points.reduce((s, p) => s + p.x, 0) / room.points.length,
          y: room.points.reduce((s, p) => s + p.y, 0) / room.points.length,
        }) < 200
      );
    });

    // Helper to create & push a socket element
    const createSocket = (params: {
      type: 'socket_single' | 'socket_double' | 'socket_triple' | 'socket_ip44';
      pos: Point;
      rotation: number;
      wallId?: string;
      mountingHeightMm: number;
      powerWatts: number;
      name: string;
      notes: string;
      isBackup?: boolean;
    }) => {
      // Avoid duplicates against existing + already generated in this run
      const allSockets = [...elementsPool, ...generatedElements];
      if (isTooCloseToExistingSocket(params.pos, allSockets, avoidDupDistMm)) {
        return;
      }

      const newEl: ElectricalElement = {
        id: `el_auto_sock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        category: 'socket',
        type: isBathroom ? 'socket_ip44' : params.type,
        name: params.name,
        position: params.pos,
        rotation: params.rotation,
        wallId: params.wallId,
        mountingHeightMm: params.mountingHeightMm,
        powerWatts: params.powerWatts,
        circuitId,
        ipRating: isBathroom ? 'IP44' : 'IP20',
        phase: 'L1',
        notes: params.notes,
        isBackupPriority: params.isBackup,
      };

      generatedElements.push(newEl);
      roomAddedCount++;
      roomAddedPowerW += params.powerWatts;
    };

    // -------------------------------------------------------------
    // PHASE A: Smart Furniture-Aware Placement (if enabled)
    // -------------------------------------------------------------
    if (options.enableFurnitureProximity && roomFurniture.length > 0) {
      roomFurniture.forEach((furn) => {
        const fType = furn.type.toLowerCase();

        // 1. Bed / Ліжко: Placement on left and right sides of headboard
        if (fType === 'bed') {
          // Standard bed: width ~1800mm, depth ~2000mm. Rotation indicates orientation.
          const bedWidthPx = mmToPx(furn.width || 1800);
          const bedDepthPx = mmToPx(furn.height || 2000);
          const rad = (furn.rotation * Math.PI) / 180;

          // Headboard vector and side vectors
          const rightVec = { x: Math.cos(rad), y: Math.sin(rad) };
          const forwardVec = { x: -Math.sin(rad), y: Math.cos(rad) };

          // Offset to left and right nightstands
          const sideOffsetPx = bedWidthPx / 2 + mmToPx(200);
          const headOffsetPx = -bedDepthPx / 2 + mmToPx(100);

          const leftPos = {
            x: furn.position.x - rightVec.x * sideOffsetPx + forwardVec.x * headOffsetPx,
            y: furn.position.y - rightVec.y * sideOffsetPx + forwardVec.y * headOffsetPx,
          };
          const rightPos = {
            x: furn.position.x + rightVec.x * sideOffsetPx + forwardVec.x * headOffsetPx,
            y: furn.position.y + rightVec.y * sideOffsetPx + forwardVec.y * headOffsetPx,
          };

          const matchedWall = findMatchingWallForSegment(leftPos, rightPos, project.walls, 50);

          createSocket({
            type: presetConfig.bedsideType,
            pos: leftPos,
            rotation: (furn.rotation + 180) % 360,
            wallId: matchedWall?.id,
            mountingHeightMm: defaultHeights.bed,
            powerWatts: 400,
            name: `${furn.name} (Ліва тумба)`,
            notes: 'Розетка над приліжковою тумбою (+650 мм) для лампи та зарядки смартфонів',
          });

          createSocket({
            type: presetConfig.bedsideType,
            pos: rightPos,
            rotation: (furn.rotation + 180) % 360,
            wallId: matchedWall?.id,
            mountingHeightMm: defaultHeights.bed,
            powerWatts: 400,
            name: `${furn.name} (Права тумба)`,
            notes: 'Розетка над приліжковою тумбою (+650 мм) для лампи та зарядки смартфонів',
          });
        }

        // 2. Desk / Робочий комп'ютерний стіл
        else if (fType === 'desk') {
          const matchedWall = findMatchingWallForSegment(
            furn.position,
            { x: furn.position.x + 50, y: furn.position.y },
            project.walls,
            80
          );

          // Workstation group: Under-desk (+300) + On-desk (+750)
          createSocket({
            type: presetConfig.workstationType,
            pos: { x: furn.position.x, y: furn.position.y },
            rotation: furn.rotation,
            wallId: matchedWall?.id,
            mountingHeightMm: defaultHeights.desk,
            powerWatts: 800,
            name: `Робоче місце (${furn.name})`,
            notes: 'Блок живлення ПК / монітора та оргтехніки. ПУЕ §7.1',
            isBackup: true,
          });
        }

        // 3. Sofa / Диван: Sockets near armrests
        else if (fType === 'sofa') {
          const sofaWidthPx = mmToPx(furn.width || 2200);
          const rad = (furn.rotation * Math.PI) / 180;
          const rightVec = { x: Math.cos(rad), y: Math.sin(rad) };

          const leftPos = {
            x: furn.position.x - rightVec.x * (sofaWidthPx / 2 + mmToPx(150)),
            y: furn.position.y - rightVec.y * (sofaWidthPx / 2 + mmToPx(150)),
          };
          const rightPos = {
            x: furn.position.x + rightVec.x * (sofaWidthPx / 2 + mmToPx(150)),
            y: furn.position.y + rightVec.y * (sofaWidthPx / 2 + mmToPx(150)),
          };

          const matchedWall = findMatchingWallForSegment(leftPos, rightPos, project.walls, 50);

          createSocket({
            type: 'socket_single',
            pos: leftPos,
            rotation: furn.rotation,
            wallId: matchedWall?.id,
            mountingHeightMm: defaultHeights.general,
            powerWatts: 300,
            name: `${furn.name} (Підлокітник лівий)`,
            notes: 'Розетка для торшера / зарядки мобільних біля зони відпочинку',
          });

          createSocket({
            type: 'socket_single',
            pos: rightPos,
            rotation: furn.rotation,
            wallId: matchedWall?.id,
            mountingHeightMm: defaultHeights.general,
            powerWatts: 300,
            name: `${furn.name} (Підлокітник правий)`,
            notes: 'Розетка для торшера / зарядки мобільних біля зони відпочинку',
          });
        }

        // 4. TV Cabinet / Зона телевізора
        else if (fType === 'tv_cabinet' || fType === 'tv') {
          const matchedWall = findMatchingWallForSegment(
            furn.position,
            { x: furn.position.x + 30, y: furn.position.y },
            project.walls,
            60
          );

          createSocket({
            type: 'socket_triple',
            pos: furn.position,
            rotation: furn.rotation,
            wallId: matchedWall?.id,
            mountingHeightMm: defaultHeights.tv,
            powerWatts: 600,
            name: `ТВ Мультимедіа (${furn.name})`,
            notes: 'Блок розеток ТВ + приставка/саундбар. Резервоване живлення ДБЖ',
            isBackup: true,
          });
        }

        // 6. Wash Basin / Умивальник: Smart IP44 socket for mirror/shaver
        else if (fType === 'wash_basin') {
          const basinWidthPx = mmToPx(furn.width || 600);
          const rad = (furn.rotation * Math.PI) / 180;
          const rightVec = { x: Math.cos(rad), y: Math.sin(rad) };

          const sidePos = {
            x: Math.round(furn.position.x + rightVec.x * (basinWidthPx / 2 + mmToPx(200))),
            y: Math.round(furn.position.y + rightVec.y * (basinWidthPx / 2 + mmToPx(200))),
          };

          const matchedWall = findMatchingWallForSegment(
            furn.position,
            sidePos,
            project.walls,
            60
          );

          createSocket({
            type: 'socket_ip44',
            pos: sidePos,
            rotation: furn.rotation,
            wallId: matchedWall?.id,
            mountingHeightMm: defaultHeights.bathroom,
            powerWatts: 500,
            name: 'Розетка біля дзеркала IP44 (+1000мм)',
            notes: 'ПУЕ §7.1.47: Зона 3 (для фена/бритви), захист ПЗВ 10/30мА',
          });
        }
      });
    }

    // -------------------------------------------------------------
    // PHASE B: Perimeter Wall-Step Placement
    // -------------------------------------------------------------
    const pts = room.points;
    const n = pts.length;

    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];

      const edgeDx = p2.x - p1.x;
      const edgeDy = p2.y - p1.y;
      const edgeLenPx = Math.hypot(edgeDx, edgeDy);
      const edgeLenMm = pxToMm(edgeLenPx);
      perimeterPx += edgeLenPx;

      // Skip tiny decorative segments (< 800 mm)
      if (edgeLenMm < 800) continue;

      const matchingWall = findMatchingWallForSegment(p1, p2, project.walls, 40);
      const { nx, ny } = getInwardNormal(p1, p2, pts);

      // Rotation facing inside the room
      const rotationDeg = getRotationForInwardNormal({ x: nx, y: ny }, true);

      // Wall thickness offset (typically 75 mm from centerline towards inside)
      const wallHalfThickPx = mmToPx(matchingWall?.thickness || 150) / 2;
      const offsetPx = wallHalfThickPx + mmToPx(15); // just on inner plaster surface

      // Calculate number of sockets for this wall segment
      const numSocketsOnWall = Math.max(1, Math.floor(edgeLenPx / effectiveStepPx));
      const intervalPx = edgeLenPx / (numSocketsOnWall + 1);

      for (let s = 1; s <= numSocketsOnWall; s++) {
        const t = (s * intervalPx) / edgeLenPx;
        const basePx = {
          x: p1.x + t * edgeDx,
          y: p1.y + t * edgeDy,
        };

        // Shift onto inner face of room
        const socketPos: Point = {
          x: Math.round(basePx.x + nx * offsetPx),
          y: Math.round(basePx.y + ny * offsetPx),
        };

        // Verify inside room polygon
        if (!isPointInPolygon(socketPos, pts)) {
          // Adjust if slightly outside due to offset
          socketPos.x = Math.round(basePx.x + nx * 5);
          socketPos.y = Math.round(basePx.y + ny * 5);
        }

        // Check door and window openings
        if (matchingWall) {
          if (isPositionBlockedByOpening(socketPos, matchingWall, project.openings || [], 150)) {
            continue; // Skip placement inside door or window opening
          }
        }

        // Bathroom safety check: Distance > 600 mm from bath or shower (ПУЕ §7.1.47)
        if (isBathroom && options.enableBathroomSafetyZones) {
          let wetSourceNear = false;
          for (const furn of roomFurniture) {
            const wetTypes = ['bath', 'shower'];
            if (wetTypes.includes(furn.type.toLowerCase())) {
              if (distance(socketPos, furn.position) < mmToPx(600)) {
                wetSourceNear = true;
                break;
              }
            }
          }
          if (wetSourceNear) {
            // Cannot place inside zone 2 (under 600mm from bath/shower)
            continue;
          }
        }

        // Determine socket type and mounting height based on room type
        let sType: 'socket_single' | 'socket_double' | 'socket_ip44' = presetConfig.generalType;
        let sHeightMm = defaultHeights.general;
        let sPowerW = sType === 'socket_double' ? 500 : 350;
        let sName = `${room.name} — Розетка ${sHeightMm}мм`;
        let sNotes = `ДБН В.2.5-23:2010. Крок по стіні ~${effectiveStepM.toFixed(1)}м`;

        if (isBathroom) {
          sType = 'socket_ip44';
          sHeightMm = defaultHeights.bathroom;
          sPowerW = 500;
          sName = `Розетка вологозахищена IP44 (+${sHeightMm}мм)`;
          sNotes = 'ПУЕ §7.1.47: Зона 3 (відступ >600мм від чаші), обов’язковий дифзахист ПЗВ 10/30мА';
        } else if (isKitchen) {
          // If in kitchen, alternating between general (+300) and kitchen counter (+1050)
          if (s % 2 === 1) {
            sType = presetConfig.kitchenCounterType as any;
            sHeightMm = defaultHeights.kitchenCounter;
            sPowerW = 800;
            sName = `Кухонний фартух (+${sHeightMm}мм)`;
            sNotes = 'ДБН В.2.5-23:2010 п. 4.28: Розетки дрібної побутової техніки стільниці';
          }
        }

        createSocket({
          type: sType,
          pos: socketPos,
          rotation: (rotationDeg + 360) % 360,
          wallId: matchingWall?.id,
          mountingHeightMm: sHeightMm,
          powerWatts: sPowerW,
          name: sName,
          notes: sNotes,
        });
      }
    }

    // -------------------------------------------------------------
    // PHASE C: Room Normative Check (Minimum count per m²)
    // -------------------------------------------------------------
    // ДБН: In living rooms, minimum 1 socket per 6 m²
    const requiredMinCount = Math.max(2, Math.ceil(room.areaM2 / 6));
    const totalInRoomNow = existingInRoom.length + roomAddedCount;

    if (totalInRoomNow < requiredMinCount && !isBathroom) {
      safetyNotes.push(
        `Приміщення «${room.name}» (${room.areaM2} м²): згенеровано ${totalInRoomNow} розеток при нормативному мінімумі ${requiredMinCount} (ДБН В.2.5-23:2010 п. 4.28).`
      );
    }

    statsByRoom.push({
      roomId: room.id,
      roomName: room.name,
      roomType: room.type,
      areaM2: room.areaM2,
      wallPerimeterM: Number((pxToMm(perimeterPx) / 1000).toFixed(1)),
      existingCount: existingInRoom.length,
      addedCount: roomAddedCount,
      addedPowerW: roomAddedPowerW,
      standardClause: presetConfig.normClause,
    });
  });

  const updatedProject: CadProject = {
    ...project,
    elements: [...elementsPool, ...generatedElements],
  };

  const totalSocketsGenerated = generatedElements.length;
  const totalPowerAddedW = generatedElements.reduce((sum, el) => sum + el.powerWatts, 0);

  return {
    updatedProject,
    newElements: generatedElements,
    removedElementsCount: removedCount,
    totalSocketsGenerated,
    totalPowerAddedW,
    statsByRoom,
    safetyNotes,
  };
}
