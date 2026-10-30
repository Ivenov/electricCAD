import { Point, Wall, ElectricalElement, WireRoute } from '../types/cad';

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
 * Finds if a point is close to any wall, and returns snap info including wall angle
 */
export function snapToNearestWall(
  point: Point,
  walls: Wall[],
  thresholdPx: number = 25
): { snappedPoint: Point; rotation: number; wallId: string } | null {
  let closestWall: Wall | null = null;
  let minDistance = Infinity;
  let bestPoint = point;
  let bestAngle = 0;

  for (const wall of walls) {
    const { point: projPoint, dist } = closestPointOnSegment(point, wall.start, wall.end);
    if (dist < minDistance && dist <= thresholdPx) {
      minDistance = dist;
      closestWall = wall;
      bestPoint = projPoint;

      // Calculate wall angle in degrees
      const angleRad = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
      let angleDeg = (angleRad * 180) / Math.PI;

      // Wall normal angle (pointing away from wall)
      const normalAngle = angleDeg + 90;
      bestAngle = (normalAngle + 360) % 360;
    }
  }

  if (closestWall) {
    return {
      snappedPoint: bestPoint,
      rotation: Math.round(bestAngle / 90) * 90, // Snap to 90 deg steps or exact
      wallId: closestWall.id,
    };
  }

  return null;
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
