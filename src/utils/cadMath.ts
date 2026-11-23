import { Point, Wall, ElectricalElement, WireRoute, WallOpening, WallDatumReference, ElementDatumInfo, CircuitGroup, Room } from '../types/cad';

export const MM_PER_PX = 10; // 1 pixel in viewport = 10 millimeters in world (100px = 1 meter)

export function pxToMm(px: number): number {
  return Math.round(px * MM_PER_PX);
}

export function mmToPx(mm: number): number {
  return mm / MM_PER_PX;
}

export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function snapToGrid(val: number, gridStep: number = 10): number {
  return Math.round(val / gridStep) * gridStep;
}

export function snapPointToGrid(p: Point, gridStep: number = 10): Point {
  return {
    x: snapToGrid(p.x, gridStep),
    y: snapToGrid(p.y, gridStep),
  };
}

/**
 * Calculates polygon area in square meters using Shoelace formula
 */
export function calculatePolygonAreaM2(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  const areaPx2 = Math.abs(area) / 2;
  // 1px = 10mm = 0.01m, so 1px^2 = 0.0001 m^2
  const areaM2 = areaPx2 * 0.0001;
  return Number(areaM2.toFixed(1));
}

/**
 * Finds the closest point on a wall line segment to a given point
 */
export function closestPointOnSegment(point: Point, start: Point, end: Point): { point: Point; t: number; dist: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    const d = distance(point, start);
    return { point: { ...start }, t: 0, dist: d };
  }

  // Projection scalar t
  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  const projPoint = { x: projX, y: projY };

  return {
    point: projPoint,
    t,
    dist: distance(point, projPoint),
  };
}

/**
 * Robust Point-in-Polygon check (Ray-Casting Algorithm)
 */
export function isPointInsidePolygon(point: Point, polygon: Point[]): boolean {
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
 * Calculates the unit inward normal vector pointing into the room from a wall segment.
 * If the wall is between rooms or no room contains either side, selects the side facing
 * the reference point (e.g. cursor location), or the canonical perpendicular.
 */
export function getWallInwardNormal(
  wall: Wall,
  projPoint: Point,
  rooms: Room[] = [],
  referencePoint?: Point
): Point {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return { x: 0, y: -1 };

  const ux = dx / len;
  const uy = dy / len;

  // Two candidate unit normals perpendicular to wall
  const n1 = { x: -uy, y: ux };
  const n2 = { x: uy, y: -ux };

  if (rooms && rooms.length > 0) {
    const sampleDist = 20; // ~200mm into the room
    const p1 = { x: projPoint.x + n1.x * sampleDist, y: projPoint.y + n1.y * sampleDist };
    const p2 = { x: projPoint.x + n2.x * sampleDist, y: projPoint.y + n2.y * sampleDist };

    const inRoom1 = rooms.some((r) => isPointInsidePolygon(p1, r.points));
    const inRoom2 = rooms.some((r) => isPointInsidePolygon(p2, r.points));

    if (inRoom1 && !inRoom2) return n1;
    if (inRoom2 && !inRoom1) return n2;
  }

  // If both or neither in rooms, fallback to cursor side if referencePoint provided
  if (referencePoint) {
    const vx = referencePoint.x - projPoint.x;
    const vy = referencePoint.y - projPoint.y;
    const dot1 = vx * n1.x + vy * n1.y;
    return dot1 >= 0 ? n1 : n2;
  }

  return n1;
}

/**
 * Calculates standard symbol rotation (in degrees, 0..360) so that the symbol's face
 * (semicircle/switch toggle pointing in local -Y direction) points in the direction
 * of the inward normal vector into the room.
 */
export function getRotationForInwardNormal(normal: Point, isOrthogonal: boolean = true): number {
  const rawDeg = (Math.atan2(normal.x, -normal.y) * 180) / Math.PI;
  const normDeg = ((rawDeg % 360) + 360) % 360;
  return isOrthogonal ? (Math.round(normDeg / 90) * 90) % 360 : Math.round(normDeg);
}

/**
 * Finds if a point is close to any wall, and returns snap info with inward rotation into the room
 */
export function snapToNearestWall(
  point: Point,
  walls: Wall[],
  thresholdPx: number = 25,
  rooms: Room[] = []
): { snappedPoint: Point; rotation: number; wallId: string; inwardNormal: Point } | null {
  let closestWall: Wall | null = null;
  let minDistance = Infinity;
  let bestPoint = point;

  for (const wall of walls) {
    const { point: projPoint, dist } = closestPointOnSegment(point, wall.start, wall.end);
    if (dist < minDistance && dist <= thresholdPx) {
      minDistance = dist;
      closestWall = wall;
      bestPoint = projPoint;
    }
  }

  if (closestWall) {
    const inwardNormal = getWallInwardNormal(closestWall, bestPoint, rooms, point);
    const isOrtho =
      Math.abs(closestWall.end.x - closestWall.start.x) < 2 ||
      Math.abs(closestWall.end.y - closestWall.start.y) < 2;
    const rotation = getRotationForInwardNormal(inwardNormal, isOrtho);

    return {
      snappedPoint: bestPoint,
      rotation,
      wallId: closestWall.id,
      inwardNormal,
    };
  }

  return null;
}

/**
 * Calculates real-world wall length in millimeters
 */
export function calculateWallLengthMm(wall: Wall): number {
  return pxToMm(distance(wall.start, wall.end));
}

/**
 * Calculates wall orientation angle in degrees (0..360)
 */
export function calculateWallAngleDeg(wall: Wall): number {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;
  return Math.round(((angleDeg % 360) + 360) % 360 * 10) / 10;
}

/**
 * Resizes a wall to an exact target length in millimeters.
 * Supports anchor point:
 * - 'start': start point stays fixed, end point moves along current angle
 * - 'end': end point stays fixed, start point moves
 * - 'center': wall expands/shrinks symmetrically around its midpoint
 */
export function setWallLengthMm(
  wall: Wall,
  targetLengthMm: number,
  anchor: 'start' | 'center' | 'end' = 'start'
): Wall {
  const targetPx = mmToPx(Math.max(100, targetLengthMm)); // Minimum 100mm
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const currentLen = Math.hypot(dx, dy);

  // If wall has zero length, default to horizontal right direction
  let ux = 1;
  let uy = 0;
  if (currentLen > 0.001) {
    ux = dx / currentLen;
    uy = dy / currentLen;
  }

  let newStart = { ...wall.start };
  let newEnd = { ...wall.end };

  if (anchor === 'start') {
    newEnd = {
      x: Math.round((newStart.x + ux * targetPx) * 10) / 10,
      y: Math.round((newStart.y + uy * targetPx) * 10) / 10,
    };
  } else if (anchor === 'end') {
    newStart = {
      x: Math.round((newEnd.x - ux * targetPx) * 10) / 10,
      y: Math.round((newEnd.y - uy * targetPx) * 10) / 10,
    };
  } else {
    // center anchor
    const midX = (wall.start.x + wall.end.x) / 2;
    const midY = (wall.start.y + wall.end.y) / 2;
    const halfLen = targetPx / 2;
    newStart = {
      x: Math.round((midX - ux * halfLen) * 10) / 10,
      y: Math.round((midY - uy * halfLen) * 10) / 10,
    };
    newEnd = {
      x: Math.round((midX + ux * halfLen) * 10) / 10,
      y: Math.round((midY + uy * halfLen) * 10) / 10,
    };
  }

  return {
    ...wall,
    start: newStart,
    end: newEnd,
  };
}

/**
 * Sets wall angle in degrees while preserving its current length.
 */
export function setWallAngleDeg(
  wall: Wall,
  targetAngleDeg: number,
  anchor: 'start' | 'center' = 'start'
): Wall {
  const lenPx = distance(wall.start, wall.end) || mmToPx(3000);
  const rad = (targetAngleDeg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);

  if (anchor === 'center') {
    const midX = (wall.start.x + wall.end.x) / 2;
    const midY = (wall.start.y + wall.end.y) / 2;
    const halfLen = lenPx / 2;
    return {
      ...wall,
      start: {
        x: Math.round((midX - ux * halfLen) * 10) / 10,
        y: Math.round((midY - uy * halfLen) * 10) / 10,
      },
      end: {
        x: Math.round((midX + ux * halfLen) * 10) / 10,
        y: Math.round((midY + uy * halfLen) * 10) / 10,
      },
    };
  }

  return {
    ...wall,
    end: {
      x: Math.round((wall.start.x + ux * lenPx) * 10) / 10,
      y: Math.round((wall.start.y + uy * lenPx) * 10) / 10,
    },
  };
}

/**
 * Snaps a wall to the nearest strict orthogonal angle (0°, 90°, 180°, 270°)
 */
export function alignWallOrtho(wall: Wall): Wall {
  const currentAngle = calculateWallAngleDeg(wall);
  const nearestAngle = Math.round(currentAngle / 90) * 90;
  return setWallAngleDeg(wall, nearestAngle, 'start');
}

/**
 * Reverses wall direction (swaps start and end points)
 */
export function reverseWall(wall: Wall): Wall {
  return {
    ...wall,
    start: { ...wall.end },
    end: { ...wall.start },
  };
}

/**
 * Calculates 3D real cable length:
 * Planar horizontal distance + vertical drops/rises to mounting heights + 15% slack
 */
export function calculateCableLengthM(
  fromElement: ElectricalElement,
  toElement: ElectricalElement,
  ceilingHeightMm: number = 2700,
  conduit: 'ceiling' | 'floor' | 'wall_chase' = 'ceiling',
  customPoints?: Point[]
): number {
  let horizontalPx = 0;

  if (customPoints && customPoints.length > 1) {
    for (let i = 0; i < customPoints.length - 1; i++) {
      horizontalPx += distance(customPoints[i], customPoints[i + 1]);
    }
  } else {
    // Orthogonal Manhattan distance for architectural runs
    const dx = Math.abs(toElement.position.x - fromElement.position.x);
    const dy = Math.abs(toElement.position.y - fromElement.position.y);
    horizontalPx = dx + dy;
  }

  const horizontalMm = pxToMm(horizontalPx);

  // Vertical drops
  let verticalMm = 0;
  if (conduit === 'ceiling') {
    // Cable runs on ceiling: drops from ceiling to each element
    const dropFrom = Math.max(0, ceilingHeightMm - fromElement.mountingHeightMm);
    const dropTo = Math.max(0, ceilingHeightMm - toElement.mountingHeightMm);
    verticalMm = dropFrom + dropTo;
  } else if (conduit === 'floor') {
    // Cable runs in floor: rises from floor (0) to element height
    verticalMm = fromElement.mountingHeightMm + toElement.mountingHeightMm;
  } else {
    // Wall chase direct height difference
    verticalMm = Math.abs(fromElement.mountingHeightMm - toElement.mountingHeightMm);
  }

  const totalRawMm = horizontalMm + verticalMm;
  // Add 15% margin for junction striping, bending radius, and box terminations
  const totalWithMarginM = (totalRawMm * 1.15) / 1000;
  return Number(totalWithMarginM.toFixed(1));
}

/**
 * Generates curved quadratic bezier SVG path data between two points
 */
export function generateCurvedWirePath(p1: Point, p2: Point, curvature: number = 0.25): string {
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);

  // Normal vector perpendicular to chord
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);

  const offset = dist * curvature;
  const ctrlX = midX + nx * offset;
  const ctrlY = midY + ny * offset;

  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}

/**
 * Generates orthogonal 90-degree step path data
 */
export function generateOrthoWirePath(p1: Point, p2: Point): string {
  const midX = p1.x + (p2.x - p1.x) / 2;
  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${midX.toFixed(1)} ${p1.y.toFixed(1)} L ${midX.toFixed(1)} ${p2.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}

/**
 * Generates SVG path data through a list of custom waypoint vertices
 */
export function generatePolylineWirePath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ` + points.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/**
 * Ukrainian cable notation display (ДСТУ / ПУЕ)
 */
export function getCableDisplayName(cableType?: string): string {
  switch (cableType) {
    case 'VVGng_3x1.5':
      return 'ВВГнгд 3×1.5';
    case 'VVGng_3x2.5':
      return 'ВВГнгд 3×2.5';
    case 'VVGng_3x4':
      return 'ВВГнгд 3×4';
    case 'VVGng_3x6':
      return 'ВВГнгд 3×6';
    case 'FTP_Cat5e':
      return 'FTP 4×2×0.51';
    case 'KNX_Bus':
      return 'KNX JY(St)Y 2×2×0.8';
    default:
      return cableType || 'ВВГнгд 3×2.5';
  }
}

/**
 * Returns short cross section specification: "3×1.5", "3×2.5", "3×4", "3×6"
 */
export function getCableCrossSection(cableType?: string): string {
  switch (cableType) {
    case 'VVGng_3x1.5':
      return '3×1.5 мм²';
    case 'VVGng_3x2.5':
      return '3×2.5 мм²';
    case 'VVGng_3x4':
      return '3×4 мм²';
    case 'VVGng_3x6':
      return '3×6 мм²';
    case 'FTP_Cat5e':
      return 'Cat5e';
    case 'KNX_Bus':
      return 'KNX 2×2×0.8';
    default:
      return '3×2.5 мм²';
  }
}

export interface WallSnapResult {
  point: Point;
  snappedPoint: Point;
  snapType: 'endpoint' | 'midpoint' | 'edge';
  wall: Wall;
  label: string;
  t?: number;
}

/**
 * Snaps a point to wall geometry (endpoints/corners, midpoints, or edges for T-junctions)
 */
export function snapToWallGeometry(
  point: Point,
  walls: Wall[],
  thresholdPx: number = 25,
  excludeWallId?: string
): WallSnapResult | null {
  const activeWalls = excludeWallId ? walls.filter((w) => w.id !== excludeWallId) : walls;

  // 1. Highest Priority: Endpoints / Corners of walls
  let bestCorner: { point: Point; dist: number; wall: Wall } | null = null;
  for (const wall of activeWalls) {
    const dStart = distance(point, wall.start);
    if (dStart <= thresholdPx && (!bestCorner || dStart < bestCorner.dist)) {
      bestCorner = { point: { ...wall.start }, dist: dStart, wall };
    }
    const dEnd = distance(point, wall.end);
    if (dEnd <= thresholdPx && (!bestCorner || dEnd < bestCorner.dist)) {
      bestCorner = { point: { ...wall.end }, dist: dEnd, wall };
    }
  }

  if (bestCorner) {
    return {
      point: bestCorner.point,
      snappedPoint: bestCorner.point,
      snapType: 'endpoint',
      wall: bestCorner.wall,
      label: "Кут / З'єднання стін",
    };
  }

  // 2. Second Priority: Midpoint of a wall
  let bestMid: { point: Point; dist: number; wall: Wall } | null = null;
  for (const wall of activeWalls) {
    const midPoint = {
      x: (wall.start.x + wall.end.x) / 2,
      y: (wall.start.y + wall.end.y) / 2,
    };
    const dMid = distance(point, midPoint);
    if (dMid <= thresholdPx && (!bestMid || dMid < bestMid.dist)) {
      bestMid = { point: midPoint, dist: dMid, wall };
    }
  }

  if (bestMid) {
    return {
      point: bestMid.point,
      snappedPoint: bestMid.point,
      snapType: 'midpoint',
      wall: bestMid.wall,
      label: "Середина стіни",
    };
  }

  // 3. Third Priority: T-junction edge snap (anywhere along the wall line segment)
  let bestEdge: { point: Point; dist: number; wall: Wall; t: number } | null = null;
  for (const wall of activeWalls) {
    const { point: projPoint, dist, t } = closestPointOnSegment(point, wall.start, wall.end);
    if (dist <= thresholdPx && (!bestEdge || dist < bestEdge.dist)) {
      bestEdge = { point: projPoint, dist, wall, t };
    }
  }

  if (bestEdge) {
    return {
      point: bestEdge.point,
      snappedPoint: bestEdge.point,
      snapType: 'edge',
      wall: bestEdge.wall,
      t: bestEdge.t,
      label: "Примикання до стіни (Т-вузол)",
    };
  }

  return null;
}

/**
 * Snaps angle to standard CAD increments (0°, 45°, 90°, 135°, 180°, etc.)
 */
export function snapAngleOrtho(
  start: Point,
  current: Point,
  stepDeg: number = 45,
  snapToleranceDeg: number = 7
): { point: Point; angleDeg: number; isSnapped: boolean } {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const len = Math.hypot(dx, dy);

  if (len < 10) {
    return { point: current, angleDeg: 0, isSnapped: false };
  }

  let angleRad = Math.atan2(dy, dx);
  let angleDeg = (angleRad * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  // Find nearest step
  const nearestStep = Math.round(angleDeg / stepDeg) * stepDeg;
  const diff = Math.abs(angleDeg - nearestStep);

  if (diff <= snapToleranceDeg || Math.abs(diff - 360) <= snapToleranceDeg) {
    const targetDeg = nearestStep % 360;
    const targetRad = (targetDeg * Math.PI) / 180;
    return {
      point: {
        x: Math.round(start.x + len * Math.cos(targetRad)),
        y: Math.round(start.y + len * Math.sin(targetRad)),
      },
      angleDeg: targetDeg,
      isSnapped: true,
    };
  }

  return { point: current, angleDeg: Math.round(angleDeg), isSnapped: false };
}

/**
 * Finds wall opening placement: determines which wall the cursor is hovering over
 * and clamps opening position so it doesn't exceed wall boundaries.
 */
export function findWallOpeningPlacement(
  point: Point,
  walls: Wall[],
  openingWidthMm: number,
  thresholdPx: number = 35
): {
  wall: Wall;
  wallId: string;
  positionRatio: number;
  snappedPoint: Point;
  position: Point;
  rotation: number;
  angleDeg: number;
  wallThickness: number;
  wallLengthMm: number;
  distanceToStartMm: number;
  distanceToEndMm: number;
} | null {
  let closestWall: Wall | null = null;
  let minDistance = Infinity;
  let bestRatio = 0.5;

  for (const wall of walls) {
    const { dist, t } = closestPointOnSegment(point, wall.start, wall.end);
    if (dist < minDistance && dist <= thresholdPx) {
      minDistance = dist;
      closestWall = wall;
      bestRatio = t;
    }
  }

  if (!closestWall) return null;

  const dx = closestWall.end.x - closestWall.start.x;
  const dy = closestWall.end.y - closestWall.start.y;
  const wallLenPx = Math.hypot(dx, dy);
  const wallLengthMm = pxToMm(wallLenPx);

  if (wallLenPx === 0) return null;

  // Keep at least half the opening width inside the wall
  const halfOpPx = mmToPx(openingWidthMm) / 2;
  const marginRatio = Math.min(0.45, (halfOpPx + 2) / wallLenPx);
  const clampedRatio = Math.max(marginRatio, Math.min(1 - marginRatio, bestRatio));

  const snappedPoint: Point = {
    x: Math.round(closestWall.start.x + dx * clampedRatio),
    y: Math.round(closestWall.start.y + dy * clampedRatio),
  };

  const angleRad = Math.atan2(dy, dx);
  let angleDeg = (angleRad * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  const distToStartPx = distance(closestWall.start, snappedPoint);
  const distToEndPx = distance(snappedPoint, closestWall.end);
  const roundAngle = Math.round(angleDeg);

  return {
    wall: closestWall,
    wallId: closestWall.id,
    positionRatio: Number(clampedRatio.toFixed(3)),
    snappedPoint,
    position: snappedPoint,
    rotation: roundAngle,
    angleDeg: roundAngle,
    wallThickness: closestWall.thickness,
    wallLengthMm,
    distanceToStartMm: pxToMm(distToStartPx),
    distanceToEndMm: pxToMm(distToEndPx),
  };
}

/**
 * Checks if two 2D line segments (p1-p2 and p3-p4) intersect
 */
export function doLineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const ccw = (a: Point, b: Point, c: Point) => {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  };
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/**
 * Checks if a 2D line segment (u1, v1) to (u2, v2) intersects an axis-aligned box [-hw, hw] x [-ht, ht]
 * using the Liang-Barsky parametric line-clipping algorithm.
 */
export function segmentIntersectsBox2D(
  u1: number,
  v1: number,
  u2: number,
  v2: number,
  hw: number,
  ht: number
): boolean {
  // 1. Quick check: if either endpoint is inside the box
  if (Math.abs(u1) <= hw && Math.abs(v1) <= ht) return true;
  if (Math.abs(u2) <= hw && Math.abs(v2) <= ht) return true;

  // 2. Liang-Barsky parametric line clipping
  const du = u2 - u1;
  const dv = v2 - v1;

  let t0 = 0.0;
  let t1 = 1.0;

  // 4 boundaries: Left, Right, Bottom, Top
  const p = [-du, du, -dv, dv];
  const q = [u1 + hw, hw - u1, v1 + ht, ht - v1];

  for (let i = 0; i < 4; i++) {
    const pi = p[i];
    const qi = q[i];

    if (Math.abs(pi) < 1e-9) {
      // Parallel to this boundary
      if (qi < 0) return false; // Parallel and outside
    } else {
      const t = qi / pi;
      if (pi < 0) {
        // Line entering boundary
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        // Line leaving boundary
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }

  return t0 <= t1;
}

/**
 * Checks if a wire route intersects any door or window opening.
 * Under Ukrainian PUE §2.1.52 & DBN V.2.5-23:2010, wall chases (штроби)
 * cannot pass through doors (empty openings) or windows.
 * Uses exact 2D oriented bounding volume test along the wall plane.
 */
export function checkChaseIntersectsOpening(
  points: Point[],
  walls: Wall[],
  openings: WallOpening[]
): { hasCollision: boolean; opening?: WallOpening; wall?: Wall } {
  if (points.length < 2 || walls.length === 0 || openings.length === 0) {
    return { hasCollision: false };
  }

  const wallMap = new Map<string, Wall>();
  walls.forEach((w) => wallMap.set(w.id, w));

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    for (const op of openings) {
      const wall = wallMap.get(op.wallId);
      if (!wall) continue;

      const wdx = wall.end.x - wall.start.x;
      const wdy = wall.end.y - wall.start.y;
      const wallLen = Math.hypot(wdx, wdy);
      if (wallLen < 1e-4) continue;

      // Unit vector along wall and unit normal
      const ux = wdx / wallLen;
      const uy = wdy / wallLen;
      const nx = -uy;
      const ny = ux;

      // Center of the opening in 2D world coordinates
      const cx = wall.start.x + wdx * op.positionRatio;
      const cy = wall.start.y + wdy * op.positionRatio;

      // Half-dimensions: width along wall + thickness across wall (+6px clearance margin)
      const halfW = mmToPx(op.width) / 2 + 6;
      const halfT = wall.thickness / (2 * MM_PER_PX) + 8;

      // Transform segment endpoints into local opening coordinate frame (u, v)
      const u1 = (p1.x - cx) * ux + (p1.y - cy) * uy;
      const v1 = (p1.x - cx) * nx + (p1.y - cy) * ny;
      const u2 = (p2.x - cx) * ux + (p2.y - cy) * uy;
      const v2 = (p2.x - cx) * nx + (p2.y - cy) * ny;

      if (segmentIntersectsBox2D(u1, v1, u2, v2, halfW, halfT)) {
        return { hasCollision: true, opening: op, wall };
      }
    }
  }

  return { hasCollision: false };
}

/**
 * Finds the midpoint and orientation of the longest straight segment in a polyline.
 * Used for placing cable tags and callout badges with optimal readability.
 */
export function getLongestSegmentMidpoint(points: Point[]): {
  midpoint: Point;
  angleDeg: number;
  length: number;
  segmentIndex: number;
} {
  if (points.length < 2) {
    return {
      midpoint: points[0] || { x: 0, y: 0 },
      angleDeg: 0,
      length: 0,
      segmentIndex: 0,
    };
  }

  let maxLen = -1;
  let bestMid: Point = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  let bestAngle = 0;
  let bestIdx = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len > maxLen) {
      maxLen = len;
      bestMid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      // Flip upside down text
      if (angle > 90 || angle < -90) {
        angle += 180;
      }
      bestAngle = angle;
      bestIdx = i;
    }
  }

  return {
    midpoint: bestMid,
    angleDeg: bestAngle,
    length: maxLen,
    segmentIndex: bestIdx,
  };
}

/**
 * Helper to remove redundant collinear points from a polyline.
 */
export function simplifyOrthogonalPolyline(pts: Point[]): Point[] {
  if (pts.length <= 2) return pts;
  const result: Point[] = [pts[0]];

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    // Skip duplicate points
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) < 1) continue;

    // Check if curr is collinear between prev and next
    const isCollinearH = Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1;
    const isCollinearV = Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1;

    if (!isCollinearH && !isCollinearV) {
      result.push(curr);
    }
  }

  const last = pts[pts.length - 1];
  if (Math.hypot(last.x - result[result.length - 1].x, last.y - result[result.length - 1].y) > 0.5) {
    result.push(last);
  }

  return result;
}

/**
 * Calculates polyline length in pixels
 */
export function calculatePolylineLengthPx(pts: Point[]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return len;
}

/**
 * Computes an orthogonal 90-degree rectilinear path between two points,
 * favoring wall alignment, Manhattan corridors, and strictly avoiding door/window openings
 * according to Ukrainian PUE §2.1.52.
 */
export function computeOrthogonalPath(
  start: Point,
  end: Point,
  walls: Wall[] = [],
  openings: WallOpening[] = []
): Point[] {
  // If no walls or openings are provided, return simple orthogonal path
  if (!walls || walls.length === 0 || !openings || openings.length === 0) {
    if (Math.abs(start.x - end.x) < 5 || Math.abs(start.y - end.y) < 5) {
      return [start, end];
    }
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    return dx > dy
      ? [start, { x: end.x, y: start.y }, end]
      : [start, { x: start.x, y: end.y }, end];
  }

  // 1. Direct straight path check (when points are horizontally or vertically aligned)
  const isCollinear = Math.abs(start.x - end.x) < 5 || Math.abs(start.y - end.y) < 5;
  if (isCollinear) {
    const directPath = [start, end];
    const directColl = checkChaseIntersectsOpening(directPath, walls, openings);
    if (!directColl.hasCollision) {
      return directPath;
    }
  }

  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  // Strategy A: Horizontal then Vertical
  const midA: Point = { x: end.x, y: start.y };
  const pathA = simplifyOrthogonalPolyline([start, midA, end]);

  // Strategy B: Vertical then Horizontal
  const midB: Point = { x: start.x, y: end.y };
  const pathB = simplifyOrthogonalPolyline([start, midB, end]);

  const collA = checkChaseIntersectsOpening(pathA, walls, openings);
  const collB = checkChaseIntersectsOpening(pathB, walls, openings);

  if (!collA.hasCollision && collB.hasCollision) {
    return pathA;
  }
  if (collA.hasCollision && !collB.hasCollision) {
    return pathB;
  }
  if (!collA.hasCollision && !collB.hasCollision && !isCollinear) {
    return dx > dy ? pathA : pathB;
  }

  // 2. Simple paths collide with openings (or collinear segment collides).
  // Generate multi-candidate bypass detours around the opening(s) (ПУЕ §2.1.52).
  const wallMap = new Map<string, Wall>();
  walls.forEach((w) => wallMap.set(w.id, w));

  const candidateDetours: Point[][] = [];

  // Generate specific geometry-based bypasses for any opening that was hit
  const hitOpenings = [collA.opening, collB.opening].filter(
    (op): op is WallOpening => Boolean(op)
  );

  // Also include any opening close to the bounding box of start/end
  const minX = Math.min(start.x, end.x) - 40;
  const maxX = Math.max(start.x, end.x) + 40;
  const minY = Math.min(start.y, end.y) - 40;
  const maxY = Math.max(start.y, end.y) + 40;

  openings.forEach((op) => {
    if (hitOpenings.some((h) => h.id === op.id)) return;
    const wall = wallMap.get(op.wallId);
    if (!wall) return;
    const cx = wall.start.x + (wall.end.x - wall.start.x) * op.positionRatio;
    const cy = wall.start.y + (wall.end.y - wall.start.y) * op.positionRatio;
    if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
      hitOpenings.push(op);
    }
  });

  hitOpenings.forEach((op) => {
    const wall = wallMap.get(op.wallId);
    if (!wall) return;

    const wdx = wall.end.x - wall.start.x;
    const wdy = wall.end.y - wall.start.y;
    const isWallHorizontal = Math.abs(wdx) >= Math.abs(wdy);
    const halfWidthPx = mmToPx(op.width) / 2 + 15; // opening half width + clearance
    const halfThickPx = mmToPx(wall.thickness || 150) / 2 + 10;
    const cx = wall.start.x + wdx * op.positionRatio;
    const cy = wall.start.y + wdy * op.positionRatio;

    if (isWallHorizontal) {
      // For horizontal walls, detour perpendicular in Y (above or below the opening)
      const yOffsets = [
        halfThickPx + 20,
        -(halfThickPx + 20),
        halfThickPx + 45,
        -(halfThickPx + 45),
        halfThickPx + 70,
        -(halfThickPx + 70),
      ];
      yOffsets.forEach((yOff) => {
        const detourY = cy + yOff;
        if (start.x < end.x) {
          candidateDetours.push(
            simplifyOrthogonalPolyline([
              start,
              { x: cx - halfWidthPx - 15, y: start.y },
              { x: cx - halfWidthPx - 15, y: detourY },
              { x: cx + halfWidthPx + 15, y: detourY },
              { x: cx + halfWidthPx + 15, y: end.y },
              end,
            ])
          );
        } else {
          candidateDetours.push(
            simplifyOrthogonalPolyline([
              start,
              { x: cx + halfWidthPx + 15, y: start.y },
              { x: cx + halfWidthPx + 15, y: detourY },
              { x: cx - halfWidthPx - 15, y: detourY },
              { x: cx - halfWidthPx - 15, y: end.y },
              end,
            ])
          );
        }
        candidateDetours.push(
          simplifyOrthogonalPolyline([
            start,
            { x: start.x, y: detourY },
            { x: end.x, y: detourY },
            end,
          ])
        );
      });

      // When wire crosses the wall across the opening, step along X past jambs
      const xOffsets = [halfWidthPx + 20, -(halfWidthPx + 20), halfWidthPx + 45, -(halfWidthPx + 45)];
      xOffsets.forEach((xOff) => {
        const detourX = cx + xOff;
        candidateDetours.push(
          simplifyOrthogonalPolyline([
            start,
            { x: detourX, y: start.y },
            { x: detourX, y: end.y },
            end,
          ])
        );
      });
    } else {
      // For vertical walls, detour perpendicular in X (left or right of opening)
      const xOffsets = [
        halfThickPx + 20,
        -(halfThickPx + 20),
        halfThickPx + 45,
        -(halfThickPx + 45),
        halfThickPx + 70,
        -(halfThickPx + 70),
      ];
      xOffsets.forEach((xOff) => {
        const detourX = cx + xOff;
        if (start.y < end.y) {
          candidateDetours.push(
            simplifyOrthogonalPolyline([
              start,
              { x: start.x, y: cy - halfWidthPx - 15 },
              { x: detourX, y: cy - halfWidthPx - 15 },
              { x: detourX, y: cy + halfWidthPx + 15 },
              { x: end.x, y: cy + halfWidthPx + 15 },
              end,
            ])
          );
        } else {
          candidateDetours.push(
            simplifyOrthogonalPolyline([
              start,
              { x: start.x, y: cy + halfWidthPx + 15 },
              { x: detourX, y: cy + halfWidthPx + 15 },
              { x: detourX, y: cy - halfWidthPx - 15 },
              { x: end.x, y: cy - halfWidthPx - 15 },
              end,
            ])
          );
        }
        candidateDetours.push(
          simplifyOrthogonalPolyline([
            start,
            { x: detourX, y: start.y },
            { x: detourX, y: end.y },
            end,
          ])
        );
      });

      // When wire crosses the wall across opening, step along Y past jambs
      const yOffsets = [halfWidthPx + 20, -(halfWidthPx + 20), halfWidthPx + 45, -(halfWidthPx + 45)];
      yOffsets.forEach((yOff) => {
        const detourY = cy + yOff;
        candidateDetours.push(
          simplifyOrthogonalPolyline([
            start,
            { x: start.x, y: detourY },
            { x: end.x, y: detourY },
            end,
          ])
        );
      });
    }
  });

  // Standard progressive corridor offsets
  const standardOffsets = [35, -35, 55, -55, 85, -85, 120, -120];
  standardOffsets.forEach((offset) => {
    candidateDetours.push(
      simplifyOrthogonalPolyline([
        start,
        { x: start.x + offset, y: start.y },
        { x: start.x + offset, y: end.y },
        end,
      ])
    );
    candidateDetours.push(
      simplifyOrthogonalPolyline([
        start,
        { x: start.x, y: start.y + offset },
        { x: end.x, y: start.y + offset },
        end,
      ])
    );
    candidateDetours.push(
      simplifyOrthogonalPolyline([
        start,
        { x: (start.x + end.x) / 2 + offset, y: start.y },
        { x: (start.x + end.x) / 2 + offset, y: end.y },
        end,
      ])
    );
    candidateDetours.push(
      simplifyOrthogonalPolyline([
        start,
        { x: start.x, y: (start.y + end.y) / 2 + offset },
        { x: end.x, y: (start.y + end.y) / 2 + offset },
        end,
      ])
    );
  });

  // Evaluate candidate detours: find all collision-free detours and pick the shortest
  let bestCandidate: Point[] | null = null;
  let minLength = Infinity;

  for (const cand of candidateDetours) {
    const testColl = checkChaseIntersectsOpening(cand, walls, openings);
    if (!testColl.hasCollision) {
      const len = calculatePolylineLengthPx(cand);
      if (len < minLength) {
        minLength = len;
        bestCandidate = cand;
      }
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  return dx > dy ? pathA : pathB;
}

/**
 * Resolves overlapping parallel wire segments.
 * When multiple cables traverse the same wall corridor or segment, applies a perpendicular
 * lateral shift (spacing 6px) so all cables in the bundle run visibly side-by-side.
 * Strictly verifies that shifted traces never penetrate window or door openings.
 */
export function computeParallelBundleOffsets(
  wires: WireRoute[],
  elements: ElectricalElement[],
  walls: Wall[] = [],
  openings: WallOpening[] = [],
  bundleSpacingPx: number = 8
): Map<string, Point[]> {
  const result = new Map<string, Point[]>();
  const elMap = new Map<string, ElectricalElement>();
  elements.forEach((e) => elMap.set(e.id, e));

  // 1. Get raw points for all wires (re-route any non-manual wires that collide with openings)
  const wirePoints = new Map<string, Point[]>();
  wires.forEach((wire) => {
    const fromEl = elMap.get(wire.fromId);
    const toEl = elMap.get(wire.toId);

    let pts: Point[] | undefined = undefined;
    if (wire.points && wire.points.length >= 2) {
      if (wire.isManual || !checkChaseIntersectsOpening(wire.points, walls, openings).hasCollision) {
        pts = [...wire.points];
      }
    }

    if (!pts && fromEl && toEl) {
      pts = computeOrthogonalPath(fromEl.position, toEl.position, walls, openings);
    }

    if (pts && pts.length >= 2) {
      wirePoints.set(wire.id, pts);
    }
  });

  interface SegmentRef {
    wireId: string;
    segIndex: number;
    p1: Point;
    p2: Point;
    isHoriz: boolean;
    coord: number;
    spanMin: number;
    spanMax: number;
  }

  const allSegments: SegmentRef[] = [];
  wires.forEach((w) => {
    if (w.mode === 'curve') return;
    const pts = wirePoints.get(w.id);
    if (!pts || pts.length < 2) return;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);

      if (dy < 6) {
        allSegments.push({
          wireId: w.id,
          segIndex: i,
          p1,
          p2,
          isHoriz: true,
          coord: (p1.y + p2.y) / 2,
          spanMin: Math.min(p1.x, p2.x),
          spanMax: Math.max(p1.x, p2.x),
        });
      } else if (dx < 6) {
        allSegments.push({
          wireId: w.id,
          segIndex: i,
          p1,
          p2,
          isHoriz: false,
          coord: (p1.x + p2.x) / 2,
          spanMin: Math.min(p1.y, p2.y),
          spanMax: Math.max(p1.y, p2.y),
        });
      }
    }
  });

  const horizClusters: SegmentRef[][] = [];
  const vertClusters: SegmentRef[][] = [];

  allSegments.forEach((seg) => {
    const list = seg.isHoriz ? horizClusters : vertClusters;
    let found = false;
    for (const cluster of list) {
      const ref = cluster[0];
      if (
        Math.abs(ref.coord - seg.coord) <= 8 &&
        seg.spanMax > ref.spanMin + 12 &&
        seg.spanMin < ref.spanMax - 12
      ) {
        cluster.push(seg);
        found = true;
        break;
      }
    }
    if (!found) {
      list.push([seg]);
    }
  });

  const segOffsets = new Map<string, number>();
  const processClusters = (clusters: SegmentRef[][]) => {
    clusters.forEach((cluster) => {
      if (cluster.length <= 1) return;
      const count = cluster.length;
      cluster.forEach((seg, idx) => {
        const lateralOffset = Math.round((idx - (count - 1) / 2) * bundleSpacingPx);
        segOffsets.set(`${seg.wireId}_${seg.segIndex}`, lateralOffset);
      });
    });
  };

  processClusters(horizClusters);
  processClusters(vertClusters);

  wires.forEach((w) => {
    const pts = wirePoints.get(w.id);
    if (!pts || pts.length < 2) return;

    if (w.mode === 'curve') {
      result.set(w.id, pts);
      return;
    }

    const newPts: Point[] = pts.map((p) => ({ ...p }));
    for (let i = 0; i < pts.length - 1; i++) {
      const offset = segOffsets.get(`${w.id}_${i}`);
      if (offset && Math.abs(offset) > 0.1) {
        const isHoriz = Math.abs(pts[i + 1].y - pts[i].y) < 6;
        if (isHoriz) {
          if (i > 0) newPts[i].y += offset;
          if (i + 1 < pts.length - 1) newPts[i + 1].y += offset;
        } else {
          if (i > 0) newPts[i].x += offset;
          if (i + 1 < pts.length - 1) newPts[i + 1].x += offset;
        }
      }
    }

    // STRICT PUE VERIFICATION: If shifted polyline penetrates any opening, revert to original safe pts!
    if (walls.length > 0 && openings.length > 0) {
      const coll = checkChaseIntersectsOpening(newPts, walls, openings);
      if (coll.hasCollision) {
        result.set(w.id, pts);
        return;
      }
    }

    result.set(w.id, newPts);
  });

  return result;
}

// ============================================================================
// WALL & DOOR JAMB DATUM (CENTERLINE / FACE / JAMB REFERENCE LIKE ELECTRO-PLANNER)
// ============================================================================

export interface WallDatumAnalysis {
  wall: Wall;
  wallLengthMm: number;
  wallThicknessMm: number;
  distanceToCenterlineMm: number;
  offsetFromCenterMm: number; // signed: + on normal side, - on opposite side
  distanceToInnerFaceMm: number; // distance to face 1 (+halfThick)
  distanceToOuterFaceMm: number; // distance to face 2 (-halfThick)
  closestFace: 'face_inner' | 'face_outer' | 'centerline';
  normalAngleDeg: number;
  openingsOnWall: {
    opening: WallOpening;
    distanceFromLeftJambMm: number;
    distanceFromRightJambMm: number;
    closestJamb: 'left' | 'right';
    distanceFromClosestJambMm: number;
    isInsideOpening: boolean;
    isPueCompliantSwitchZone: boolean; // 100-150 mm
    isTooCloseToJamb: boolean; // < 80 mm (architrave risk)
  }[];
  closestOpening?: {
    opening: WallOpening;
    distanceFromLeftJambMm: number;
    distanceFromRightJambMm: number;
    closestJamb: 'left' | 'right';
    distanceFromClosestJambMm: number;
    isInsideOpening: boolean;
    isPueCompliantSwitchZone: boolean;
    isTooCloseToJamb: boolean;
  };
}

/**
 * Evaluates the geometric datum relationship of an electrical point relative to walls and doors.
 * Computes exact distances to centerline, inner/outer plaster faces, and door jambs.
 */
export function analyzeElementWallDatum(
  elementPos: Point,
  walls: Wall[],
  openings: WallOpening[] = [],
  maxDistancePx: number = 85
): WallDatumAnalysis | null {
  if (walls.length === 0) return null;

  let bestWall: Wall | null = null;
  let bestDist = Infinity;
  let bestProj: Point = elementPos;

  for (const wall of walls) {
    const { point: proj, dist } = closestPointOnSegment(elementPos, wall.start, wall.end);
    if (dist < bestDist && dist <= maxDistancePx) {
      bestDist = dist;
      bestWall = wall;
      bestProj = proj;
    }
  }

  if (!bestWall) return null;

  const dx = bestWall.end.x - bestWall.start.x;
  const dy = bestWall.end.y - bestWall.start.y;
  const wallLenPx = Math.hypot(dx, dy) || 1;
  const ux = dx / wallLenPx;
  const uy = dy / wallLenPx;
  // Normal pointing to side 1
  const nx = -uy;
  const ny = ux;

  // Signed normal distance from centerline
  const deltaX = elementPos.x - bestProj.x;
  const deltaY = elementPos.y - bestProj.y;
  const signedDistPx = deltaX * nx + deltaY * ny;
  const offsetFromCenterMm = Math.round(pxToMm(signedDistPx));
  const distanceToCenterlineMm = Math.abs(offsetFromCenterMm);

  const wallThicknessMm = bestWall.thickness || 150;
  const halfThickMm = Math.round(wallThicknessMm / 2);

  const distanceToInnerFaceMm = Math.round(Math.abs(offsetFromCenterMm - halfThickMm));
  const distanceToOuterFaceMm = Math.round(Math.abs(offsetFromCenterMm - -halfThickMm));

  let closestFace: 'face_inner' | 'face_outer' | 'centerline' = 'centerline';
  if (distanceToCenterlineMm < 20) {
    closestFace = 'centerline';
  } else if (distanceToInnerFaceMm <= distanceToOuterFaceMm) {
    closestFace = 'face_inner';
  } else {
    closestFace = 'face_outer';
  }

  const normalAngleDeg = Math.round(((Math.atan2(ny, nx) * 180) / Math.PI + 360) % 360);

  // Analyze openings on this wall
  const wallOpenings = openings.filter((o) => o.wallId === bestWall!.id);
  const analyzedOpenings = wallOpenings.map((op) => {
    const opCenterPx: Point = {
      x: bestWall!.start.x + op.positionRatio * dx,
      y: bestWall!.start.y + op.positionRatio * dy,
    };
    const halfWidthPx = mmToPx(op.width || (op.type === 'door' ? 900 : 1200)) / 2;
    const leftJambPx: Point = {
      x: opCenterPx.x - ux * halfWidthPx,
      y: opCenterPx.y - uy * halfWidthPx,
    };
    const rightJambPx: Point = {
      x: opCenterPx.x + ux * halfWidthPx,
      y: opCenterPx.y + uy * halfWidthPx,
    };

    // Vector from left jamb to element along wall direction
    const fromLeftPx = (bestProj.x - leftJambPx.x) * ux + (bestProj.y - leftJambPx.y) * uy;
    // Vector from right jamb to element along wall direction
    const fromRightPx = (bestProj.x - rightJambPx.x) * ux + (bestProj.y - rightJambPx.y) * uy;

    const isInsideOpening = fromLeftPx >= -1 && fromRightPx <= 1;

    const distLeftMm = Math.round(pxToMm(Math.abs(fromLeftPx)));
    const distRightMm = Math.round(pxToMm(Math.abs(fromRightPx)));

    const closestJamb: 'left' | 'right' = distLeftMm <= distRightMm ? 'left' : 'right';
    const distClosestMm = Math.min(distLeftMm, distRightMm);

    const isPueCompliantSwitchZone = distClosestMm >= 90 && distClosestMm <= 200 && !isInsideOpening;
    const isTooCloseToJamb = distClosestMm < 80 || isInsideOpening;

    return {
      opening: op,
      distanceFromLeftJambMm: distLeftMm,
      distanceFromRightJambMm: distRightMm,
      closestJamb,
      distanceFromClosestJambMm: distClosestMm,
      isInsideOpening,
      isPueCompliantSwitchZone,
      isTooCloseToJamb,
    };
  });

  // Sort by closest distance
  analyzedOpenings.sort((a, b) => a.distanceFromClosestJambMm - b.distanceFromClosestJambMm);
  const closestOpening = analyzedOpenings[0];

  return {
    wall: bestWall,
    wallLengthMm: Math.round(pxToMm(wallLenPx)),
    wallThicknessMm,
    distanceToCenterlineMm,
    offsetFromCenterMm,
    distanceToInnerFaceMm,
    distanceToOuterFaceMm,
    closestFace,
    normalAngleDeg,
    openingsOnWall: analyzedOpenings,
    closestOpening,
  };
}

/**
 * Calculates the exact new coordinates and orientation for an element placed according
 * to wall datum options (Centerline, Plaster Face, or Door Jamb offset).
 */
export function positionElementByWallDatum(
  currentPos: Point,
  wall: Wall,
  options: {
    reference: 'centerline' | 'face_inner' | 'face_outer' | 'door_jamb';
    customOffsetMm?: number;
    doorOpening?: WallOpening;
    jambSide?: 'left' | 'right';
    distanceFromJambMm?: number;
    targetFace?: 'face_inner' | 'face_outer' | 'centerline';
  }
): { newPos: Point; newRotation: number } {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const wallLenPx = Math.hypot(dx, dy) || 1;
  const ux = dx / wallLenPx;
  const uy = dy / wallLenPx;
  const nx = -uy;
  const ny = ux;

  const wallThicknessMm = wall.thickness || 150;
  const halfThickPx = mmToPx(wallThicknessMm / 2);

  let targetAlongWallPx: Point;
  const targetFace =
    options.targetFace ||
    (options.reference === 'face_outer'
      ? 'face_outer'
      : options.reference === 'face_inner'
      ? 'face_inner'
      : 'centerline');

  if (options.reference === 'door_jamb' && options.doorOpening) {
    const op = options.doorOpening;
    const opCenterPx: Point = {
      x: wall.start.x + op.positionRatio * dx,
      y: wall.start.y + op.positionRatio * dy,
    };
    const halfWidthPx = mmToPx(op.width || 900) / 2;
    const jambSide = options.jambSide || 'right';
    const distMm = options.distanceFromJambMm ?? 150;
    const distPx = mmToPx(distMm);

    const jambPx: Point =
      jambSide === 'left'
        ? { x: opCenterPx.x - ux * halfWidthPx, y: opCenterPx.y - uy * halfWidthPx }
        : { x: opCenterPx.x + ux * halfWidthPx, y: opCenterPx.y + uy * halfWidthPx };

    // Step away from door: if left jamb, go towards wall.start (-u), if right jamb go towards wall.end (+u)
    const stepDir = jambSide === 'left' ? -1 : 1;
    targetAlongWallPx = {
      x: jambPx.x + ux * stepDir * distPx,
      y: jambPx.y + uy * stepDir * distPx,
    };
  } else {
    // Keep current projection along wall
    const { point: proj } = closestPointOnSegment(currentPos, wall.start, wall.end);
    targetAlongWallPx = proj;
  }

  // Calculate face offset
  let normalShiftPx = 0;
  if (targetFace === 'face_inner') {
    normalShiftPx = halfThickPx;
  } else if (targetFace === 'face_outer') {
    normalShiftPx = -halfThickPx;
  }

  if (options.customOffsetMm) {
    normalShiftPx += mmToPx(options.customOffsetMm);
  }

  const newPos: Point = {
    x: Math.round((targetAlongWallPx.x + nx * normalShiftPx) * 10) / 10,
    y: Math.round((targetAlongWallPx.y + ny * normalShiftPx) * 10) / 10,
  };

  // Rotation: perpendicular to wall facing room
  let angleDeg = Math.round(((Math.atan2(ny, nx) * 180) / Math.PI + 360) % 360);
  if (targetFace === 'face_outer') {
    angleDeg = (angleDeg + 180) % 360;
  }

  return { newPos, newRotation: angleDeg };
}

export interface JambSnapResult {
  snappedPoint: Point;
  rotation: number;
  wallId: string;
  doorOpeningId: string;
  distanceFromJambMm: number;
  jambSide: 'left' | 'right';
  guideLine: [number, number, number, number];
  badgeLabel: string;
  isPueCompliant: boolean;
}

/**
 * Intelligent magnetic snap to PUE/DBN door jamb zones (100mm & 150mm from door opening edges).
 * Triggers when dragging or placing switches / wall sockets near doors.
 */
export function snapElementToDoorJambPue(
  point: Point,
  walls: Wall[],
  openings: WallOpening[],
  magnetThresholdPx: number = 24,
  rooms: Room[] = []
): JambSnapResult | null {
  const doors = openings.filter((o) => o.type === 'door');
  if (doors.length === 0 || walls.length === 0) return null;

  for (const door of doors) {
    const wall = walls.find((w) => w.id === door.wallId);
    if (!wall) continue;

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const wallLenPx = Math.hypot(dx, dy) || 1;
    const ux = dx / wallLenPx;
    const uy = dy / wallLenPx;

    const opCenterPx: Point = {
      x: wall.start.x + door.positionRatio * dx,
      y: wall.start.y + door.positionRatio * dy,
    };
    const halfWidthPx = mmToPx(door.width || 900) / 2;

    const leftJambPx: Point = {
      x: opCenterPx.x - ux * halfWidthPx,
      y: opCenterPx.y - uy * halfWidthPx,
    };
    const rightJambPx: Point = {
      x: opCenterPx.x + ux * halfWidthPx,
      y: opCenterPx.y + uy * halfWidthPx,
    };

    // Candidates: 100mm and 150mm away from left jamb and right jamb
    const candidates: { distMm: number; jambSide: 'left' | 'right'; jambPt: Point; pos: Point }[] = [];
    [100, 150].forEach((dMm) => {
      const dPx = mmToPx(dMm);
      // Left jamb: step -u
      candidates.push({
        distMm: dMm,
        jambSide: 'left',
        jambPt: leftJambPx,
        pos: { x: leftJambPx.x - ux * dPx, y: leftJambPx.y - uy * dPx },
      });
      // Right jamb: step +u
      candidates.push({
        distMm: dMm,
        jambSide: 'right',
        jambPt: rightJambPx,
        pos: { x: rightJambPx.x + ux * dPx, y: rightJambPx.y + uy * dPx },
      });
    });

    for (const cand of candidates) {
      // Check distance from cursor to candidate point along wall
      const d = distance(point, cand.pos);
      if (d <= magnetThresholdPx) {
        // Project onto inner surface of room wall
        const inwardNormal = getWallInwardNormal(wall, cand.pos, rooms, point);
        const halfThickPx = mmToPx((wall.thickness || 150) / 2);

        const finalSnappedPoint: Point = {
          x: Math.round((cand.pos.x + inwardNormal.x * halfThickPx) * 10) / 10,
          y: Math.round((cand.pos.y + inwardNormal.y * halfThickPx) * 10) / 10,
        };

        const rotation = getRotationForInwardNormal(inwardNormal, true);

        return {
          snappedPoint: finalSnappedPoint,
          rotation,
          wallId: wall.id,
          doorOpeningId: door.id,
          distanceFromJambMm: cand.distMm,
          jambSide: cand.jambSide,
          guideLine: [cand.jambPt.x, cand.jambPt.y, finalSnappedPoint.x, finalSnappedPoint.y],
          badgeLabel: `🚪 ${cand.distMm} мм від укосу дверей (Норматив ПУЕ/ДБН)`,
          isPueCompliant: true,
        };
      }
    }
  }

  return null;
}

// ============================================================================
// CIRCUIT BADGES & LEADERS (ANTI-COLLISION LAYOUT FOR ELECTRICIANS)
// ============================================================================

export interface CircuitBadgeLayout {
  elementId: string;
  circuitId?: string;
  circuitNumber?: number;
  circuitColor: string;
  badgeText: string;
  breakerText: string;
  elementPos: Point;
  badgePos: Point;
  badgeWidth: number;
  badgeHeight: number;
  leaderPoints: number[]; // [startX, startY, elbowX, elbowY, endX, endY]
  hasLeader: boolean;
}

/**
 * Computes non-overlapping circuit badges with leader lines for electrical elements.
 * Groups tight clusters (e.g. 2-5 sockets in one wall block) and fans out leader lines.
 */
export function computeCircuitBadgesLayout(
  elements: ElectricalElement[],
  circuits: CircuitGroup[],
  compactMode: boolean = false
): CircuitBadgeLayout[] {
  const circuitMap = new Map<string, CircuitGroup>();
  circuits.forEach((c) => circuitMap.set(c.id, c));

  // Only label elements that have an assigned circuit or switch group ID
  const targetElements = elements.filter(
    (el) => el.circuitId || el.switchGroupId
  );

  if (targetElements.length === 0) return [];

  // Group elements into spatial clusters (within 38px of each other) to prevent badge collision
  const clusters: ElectricalElement[][] = [];
  const visited = new Set<string>();

  targetElements.forEach((el) => {
    if (visited.has(el.id)) return;
    const cluster: ElectricalElement[] = [el];
    visited.add(el.id);

    targetElements.forEach((other) => {
      if (visited.has(other.id)) return;
      if (distance(el.position, other.position) < 38) {
        cluster.push(other);
        visited.add(other.id);
      }
    });

    // Sort cluster elements horizontally or vertically
    cluster.sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
    clusters.push(cluster);
  });

  const layouts: CircuitBadgeLayout[] = [];

  clusters.forEach((cluster) => {
    const isClustered = cluster.length > 1;

    cluster.forEach((el, idx) => {
      const c = el.circuitId ? circuitMap.get(el.circuitId) : undefined;
      const circuitColor = c?.color || '#38bdf8';
      const switchKey = el.switchGroupId ? `[${el.switchGroupId}]` : '';

      let badgeText = '';
      if (c) {
        badgeText = `ЩР/Гр.${c.number}${switchKey ? ` ${switchKey}` : ''}`;
      } else if (switchKey) {
        badgeText = `Клавіша ${switchKey}`;
      }

      const breakerText = c ? `${c.breakerRatingA}A` : '';

      // Estimate width based on text
      const charCount = badgeText.length;
      const badgeWidth = compactMode ? Math.max(48, charCount * 6.5 + 10) : Math.max(56, charCount * 7.5 + 12);
      const badgeHeight = compactMode ? 16 : 19;

      let offsetX = 18;
      let offsetY = -24;

      if (isClustered) {
        // Fan out badges in cluster to avoid overlapping
        const total = cluster.length;
        const centerIndex = (total - 1) / 2;
        const spreadOffset = (idx - centerIndex) * 32;
        const verticalStagger = idx % 2 === 0 ? 0 : 16;

        offsetX = spreadOffset;
        offsetY = -34 - verticalStagger;
      }

      const badgeCenter: Point = {
        x: Math.round(el.position.x + offsetX),
        y: Math.round(el.position.y + offsetY),
      };

      // Leader line from element to badge bottom center
      const startX = el.position.x;
      const startY = el.position.y;
      const endX = badgeCenter.x;
      const endY = badgeCenter.y + badgeHeight / 2;

      // Elbow point for crisp CAD drafting look
      const elbowX = Math.round((startX + endX) / 2);
      const elbowY = Math.round((startY + endY) / 2);

      const leaderPoints = [startX, startY, elbowX, elbowY, endX, endY];

      layouts.push({
        elementId: el.id,
        circuitId: el.circuitId,
        circuitNumber: c?.number,
        circuitColor,
        badgeText,
        breakerText,
        elementPos: el.position,
        badgePos: badgeCenter,
        badgeWidth: Math.round(badgeWidth),
        badgeHeight,
        leaderPoints,
        hasLeader: Math.hypot(offsetX, offsetY) > 16,
      });
    });
  });

  return layouts;
}



