/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Модуль Smart Gang Grouping (Розумні монтажні пости та багатопостові рамки)
 * Стандарт міжосьової відстані DIN 49073 / ДСТУ: 71 мм між центрами підрозетників.
 * Автоматично об'єднує суміжні розетки, вимикачі, термостати та слабкострумові модулі
 * у монтажні пости від 1 до 5 модулів та розраховує відповідні рамки.
 */

import { ElectricalElement, GangBlock, Point, Wall } from '../types/cad';
import { distance, mmToPx, pxToMm, MM_PER_PX } from './cadMath';

export const GANG_PITCH_MM = 71; // Стандартний крок 71 мм
export const GANG_PITCH_PX = GANG_PITCH_MM / MM_PER_PX; // 7.1 px за замовчуванням

/**
 * Перевіряє, чи є елемент настінним установочним механізмом під стандартну рамку
 */
export function isGangableElement(el: ElectricalElement): boolean {
  if (el.category === 'panel' || el.category === 'junction') return false;
  if (el.type.startsWith('light_') && el.type !== 'light_sconce') return false;
  if (el.type.startsWith('backup_')) return false;

  const validTypes = [
    'socket_single',
    'socket_double',
    'socket_triple',
    'socket_quad',
    'socket_ip44',
    'socket_outdoor',
    'socket_cooker',
    'socket_3phase',
    'socket_rj45',
    'socket_tv',
    'socket_usb',
    'switch_1g',
    'switch_2g',
    'switch_3g',
    'switch_pass',
    'switch_cross',
    'switch_dimmer',
    'switch_impulse',
    'switch_card',
    'switch_master',
    'thermostat',
    'cable_outlet',
    'motion_sensor',
    'leak_sensor',
    'intercom',
  ];

  return validTypes.includes(el.type) || el.category === 'socket' || el.category === 'switch';
}

/**
 * Автоматично детектує групи елементів, змонтованих впритул (до 130 мм між центрами),
 * та формує з них монтажні пости від 1 до 5 модулів з єдиною декоративною рамкою.
 */
export function detectGangBlocks(elements: ElectricalElement[]): GangBlock[] {
  const gangable = elements.filter(isGangableElement);
  if (gangable.length === 0) return [];

  const visited = new Set<string>();
  const clusters: ElectricalElement[][] = [];

  // 1. Пошук просторових кластерів за відстанню (поріг 13px ~ 130 мм)
  const MAX_CLUSTER_DIST_PX = 13.5;

  gangable.forEach((el) => {
    if (visited.has(el.id)) return;

    const cluster: ElectricalElement[] = [el];
    visited.add(el.id);

    // BFS / DFS для знаходження всіх суміжних елементів блоку
    const queue: ElectricalElement[] = [el];
    while (queue.length > 0) {
      const current = queue.shift()!;
      gangable.forEach((other) => {
        if (visited.has(other.id)) return;

        // Повинні мати сумісну висоту монтажу (різниця не більше 80 мм)
        const heightDiff = Math.abs((current.mountingHeightMm || 300) - (other.mountingHeightMm || 300));
        if (heightDiff > 80) return;

        const d = distance(current.position, other.position);
        if (d <= MAX_CLUSTER_DIST_PX) {
          visited.add(other.id);
          cluster.push(other);
          queue.push(other);
        }
      });
    }

    clusters.push(cluster);
  });

  // 2. Формування об'єктів GangBlock (із розбиттям, якщо в пості понад 5 елементів)
  const gangBlocks: GangBlock[] = [];

  clusters.forEach((rawCluster, cIdx) => {
    // Якщо елементів більше 5, розбиваємо на блоки по максимум 5
    const chunks: ElectricalElement[][] = [];
    for (let i = 0; i < rawCluster.length; i += 5) {
      chunks.push(rawCluster.slice(i, i + 5));
    }

    chunks.forEach((cluster, chunkIdx) => {
      // Сортуємо елементи в пості зліва направо або зверху вниз
      const minX = Math.min(...cluster.map((e) => e.position.x));
      const maxX = Math.max(...cluster.map((e) => e.position.x));
      const minY = Math.min(...cluster.map((e) => e.position.y));
      const maxY = Math.max(...cluster.map((e) => e.position.y));

      const isHorizontal = maxX - minX >= maxY - minY;
      cluster.sort((a, b) =>
        isHorizontal ? a.position.x - b.position.x : a.position.y - b.position.y
      );

      const count = cluster.length;
      const centerPos: Point = {
        x: Math.round(((minX + maxX) / 2) * 10) / 10,
        y: Math.round(((minY + maxY) / 2) * 10) / 10,
      };

      const primary = cluster[0];
      const gangId = primary.blockStampId || `gang_${primary.id}_${cIdx}_${chunkIdx}`;

      // Bounding box для рамки (з полями по 5px)
      const padding = 6;
      const bbox = {
        x: minX - padding,
        y: minY - padding,
        width: Math.max(16, maxX - minX + padding * 2),
        height: Math.max(16, maxY - minY + padding * 2),
      };

      gangBlocks.push({
        id: gangId,
        elementIds: cluster.map((e) => e.id),
        wallId: primary.wallId,
        position: centerPos,
        rotation: primary.rotation || 0,
        count,
        mountingHeightMm: primary.mountingHeightMm || 300,
        orientation: isHorizontal ? 'horizontal' : 'vertical',
        bbox,
      });
    });
  });

  return gangBlocks;
}

/**
 * Розраховує специфікацію декоративних рамок (1..5 постів) та підрозетників
 */
export interface FrameQuantities {
  gang1: number;
  gang2: number;
  gang3: number;
  gang4: number;
  gang5: number;
  totalFrames: number;
  totalFlushBoxes: number;
  totalMechanisms: number;
}

export function calculateFrameQuantities(elements: ElectricalElement[]): FrameQuantities {
  const blocks = detectGangBlocks(elements);
  const gangable = elements.filter(isGangableElement);

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalFlushBoxes = 0;
  let totalMechanisms = 0;

  // Рахуємо елементи з блоків
  blocks.forEach((b) => {
    const clamped = Math.max(1, Math.min(5, b.count));
    counts[clamped] = (counts[clamped] || 0) + 1;
  });

  // Рахуємо загальну кількість механізмів та підрозетників
  gangable.forEach((el) => {
    let multiplier = 1;
    if (el.type === 'socket_double') multiplier = 2;
    else if (el.type === 'socket_triple') multiplier = 3;
    else if (el.type === 'socket_quad') multiplier = 4;

    totalMechanisms += multiplier;
    totalFlushBoxes += multiplier;
  });

  return {
    gang1: counts[1] || 0,
    gang2: counts[2] || 0,
    gang3: counts[3] || 0,
    gang4: counts[4] || 0,
    gang5: counts[5] || 0,
    totalFrames: (counts[1] || 0) + (counts[2] || 0) + (counts[3] || 0) + (counts[4] || 0) + (counts[5] || 0),
    totalFlushBoxes,
    totalMechanisms,
  };
}

/**
 * Розумний магнітний snap до найближчого монтажного поста (71 мм між центрами підрозетників)
 */
export function snapToGangPitch(
  point: Point,
  existingElements: ElectricalElement[],
  wall?: Wall,
  snapThresholdPx: number = 18
): {
  snappedPoint: Point;
  targetElement: ElectricalElement;
  direction: 'left' | 'right' | 'up' | 'down';
  pitchPx: number;
} | null {
  const candidates = existingElements.filter(isGangableElement);
  if (candidates.length === 0) return null;

  let closest: ElectricalElement | null = null;
  let minDist = Infinity;

  for (const el of candidates) {
    const d = distance(point, el.position);
    if (d < minDist && d <= snapThresholdPx) {
      minDist = d;
      closest = el;
    }
  }

  if (!closest) return null;

  // Визначаємо вектор зміщення вздовж стіни або вздовж осей X/Y
  let ux = 1;
  let uy = 0;

  if (wall) {
    const wdx = wall.end.x - wall.start.x;
    const wdy = wall.end.y - wall.start.y;
    const wLen = Math.hypot(wdx, wdy) || 1;
    ux = wdx / wLen;
    uy = wdy / wLen;
  } else {
    // За орієнтацією елемента
    const rad = ((closest.rotation || 0) * Math.PI) / 180;
    ux = Math.cos(rad);
    uy = Math.sin(rad);
  }

  const pitchPx = GANG_PITCH_PX; // 7.1px = 71mm

  // Проектуємо точку на дотичну лінію
  const deltaX = point.x - closest.position.x;
  const deltaY = point.y - closest.position.y;
  const dot = deltaX * ux + deltaY * uy;

  // Якщо курсор праворуч/вперед від елемента — крок +pitch, інакше -pitch
  const sign = dot >= 0 ? 1 : -1;

  const snappedPoint: Point = {
    x: Math.round((closest.position.x + ux * pitchPx * sign) * 10) / 10,
    y: Math.round((closest.position.y + uy * pitchPx * sign) * 10) / 10,
  };

  let direction: 'left' | 'right' | 'up' | 'down' = 'right';
  if (Math.abs(ux) >= Math.abs(uy)) {
    direction = sign * ux >= 0 ? 'right' : 'left';
  } else {
    direction = sign * uy >= 0 ? 'down' : 'up';
  }

  return {
    snappedPoint,
    targetElement: closest,
    direction,
    pitchPx,
  };
}
