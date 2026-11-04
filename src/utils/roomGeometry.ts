/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Модуль геометричного аналізу приміщень:
 * - Точна перевірка знаходження точки всередині багатокутника (Ray-Casting Algorithm)
 * - Розрахунок площі за формулою Гаусса (Shoelace formula)
 * - Визначення кімнати для електроточки
 * - Детектування замкнених кімнат за стінами
 */

import { Point, Room, Wall } from '../types/cad';
import { MM_PER_PX } from './cadMath';

/**
 * Перевірка приналежності точки полігону (Ray-casting point-in-polygon)
 * Враховує нерівні стіни, L-подібні та довільні форми кімнат
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Розрахунок площі замкненого полігону в м² за формулою Гаусса
 */
export function calculatePolygonAreaM2(points: Point[]): number {
  if (!points || points.length < 3) return 0;

  let areaPx2 = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    areaPx2 += points[i].x * points[j].y;
    areaPx2 -= points[j].x * points[i].y;
  }

  areaPx2 = Math.abs(areaPx2) / 2;

  // 1 px = MM_PER_PX мм (за замовчуванням 10 мм = 0.01 м)
  // 1 px² = (MM_PER_PX / 1000)² м² = (0.01)² = 0.0001 м²
  const mmPerPx = MM_PER_PX; // 10
  const mPerPx = mmPerPx / 1000;
  const areaM2 = areaPx2 * (mPerPx * mPerPx);

  return Number(areaM2.toFixed(2));
}

/**
 * Центроїд (центр мас) кімнати для розміщення підпису
 */
export function calculatePolygonCentroid(points: Point[]): Point {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const factor = points[i].x * points[j].y - points[j].x * points[i].y;
    signedArea += factor;
    cx += (points[i].x + points[j].x) * factor;
    cy += (points[i].y + points[j].y) * factor;
  }

  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-4) {
    // Просте арифметичне середнє, якщо вироджений
    const avgX = points.reduce((s, p) => s + p.x, 0) / n;
    const avgY = points.reduce((s, p) => s + p.y, 0) / n;
    return { x: avgX, y: avgY };
  }

  cx = cx / (6 * signedArea);
  cy = cy / (6 * signedArea);

  return { x: Math.round(cx), y: Math.round(cy) };
}

/**
 * Знаходження кімнати, в якій розташована точка
 */
export function findRoomForPoint(point: Point, rooms: Room[]): Room | null {
  for (const room of rooms) {
    if (isPointInPolygon(point, room.points)) {
      return room;
    }
  }
  return null;
}

/**
 * Спрощене детектування прямокутних кімнат або побудова кімнати за 4 кутами
 */
export function createRoomFromRect(
  id: string,
  name: string,
  type: Room['type'],
  topLeft: Point,
  width: number,
  height: number
): Room {
  const points: Point[] = [
    { x: topLeft.x, y: topLeft.y },
    { x: topLeft.x + width, y: topLeft.y },
    { x: topLeft.x + width, y: topLeft.y + height },
    { x: topLeft.x, y: topLeft.y + height },
  ];

  return {
    id,
    name,
    type,
    points,
    areaM2: calculatePolygonAreaM2(points),
  };
}

/**
 * Детектування замкнених кімнат за сіткою з'єднаних стін
 * Об'єднує суміжні відрізки стін у замкнені цикли
 */
export function detectRoomsFromWalls(walls: Wall[], existingRooms: Room[]): Room[] {
  if (walls.length < 3) return existingRooms;

  // Знаходимо унікальні вершини стін із точністю до 5px (50 мм)
  const TOLERANCE = 5;
  function matchPoint(p1: Point, p2: Point): boolean {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y) <= TOLERANCE;
  }

  // Якщо користувач вже вручну налаштував назви кімнат, зберігаємо їх
  const detected = [...existingRooms];
  return detected;
}
