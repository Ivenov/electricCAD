import { Point, Wall, ElectricalElement, WireRoute, WallOpening } from '../types/cad';

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
 * Checks if a 2D line segment (u1, v1) to (u2, v2) intersects an axis-aligned box [-hw, hw] x [-ht, ht].
 */
function segmentIntersectsBox2D(u1: number, v1: number, u2: number, v2: number, hw: number, ht: number): boolean {
  // Check if either endpoint is inside the box
  if (Math.abs(u1) <= hw && Math.abs(v1) <= ht) return true;
  if (Math.abs(u2) <= hw && Math.abs(v2) <= ht) return true;

  // If both endpoints are on the same side outside the box, no intersection
  if ((u1 < -hw && u2 < -hw) || (u1 > hw && u2 > hw)) return false;
  if ((v1 < -ht && v2 < -ht) || (v1 > ht && v2 > ht)) return false;

  const du = u2 - u1;
  const dv = v2 - v1;
  if (Math.abs(du) < 1e-6 && Math.abs(dv) < 1e-6) {
    return Math.abs(u1) <= hw && Math.abs(v1) <= ht;
  }

  // Parameter t in [0, 1] for crossing u = -hw or u = +hw
  if (Math.abs(du) > 1e-6) {
    const tLeft = (-hw - u1) / du;
    if (tLeft >= 0 && tLeft <= 1) {
      const v = v1 + tLeft * dv;
      if (v >= -ht && v <= ht) return true;
    }
    const tRight = (hw - u1) / du;
    if (tRight >= 0 && tRight <= 1) {
      const v = v1 + tRight * du;
      if (v >= -ht && v <= ht) return true;
    }
  }

  // Parameter t in [0, 1] for crossing v = -ht or v = +ht
  if (Math.abs(dv) > 1e-6) {
    const tBottom = (-ht - v1) / dv;
    if (tBottom >= 0 && tBottom <= 1) {
      const u = u1 + tBottom * du;
      if (u >= -hw && u <= hw) return true;
    }
    const tTop = (ht - v1) / dv;
    if (tTop >= 0 && tTop <= 1) {
      const u = u1 + tTop * du;
      if (u >= -hw && u <= hw) return true;
    }
  }

  return false;
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
 * Resolves overlapping parallel wire segments.
 * When multiple cables traverse the same wall corridor or segment, applies a perpendicular
 * lateral shift (spacing 6px) so all cables in the bundle run visibly side-by-side.
 * Strictly verifies that shifted traces never penetrate window or door openings.
 */
export function computeParallelBundleOffsets(
  wires: WireRoute[],
  elements: ElectricalElement[],
  walls: Wall[] = [],
  openings: WallOpening[] = []
): Map<string, Point[]> {
  const result = new Map<string, Point[]>();
  const elMap = new Map<string, ElectricalElement>();
  elements.forEach((e) => elMap.set(e.id, e));

  // 1. Get raw points for all wires
  const wirePoints = new Map<string, Point[]>();
  wires.forEach((wire) => {
    if (wire.points && wire.points.length >= 2) {
      wirePoints.set(wire.id, [...wire.points]);
    } else {
      const fromEl = elMap.get(wire.fromId);
      const toEl = elMap.get(wire.toId);
      if (fromEl && toEl) {
        const dx = Math.abs(toEl.position.x - fromEl.position.x);
        const dy = Math.abs(toEl.position.y - fromEl.position.y);
        let path: Point[];
        if (dx < 5 || dy < 5) {
          path = [fromEl.position, toEl.position];
        } else if (dx > dy) {
          path = [fromEl.position, { x: toEl.position.x, y: fromEl.position.y }, toEl.position];
        } else {
          path = [fromEl.position, { x: fromEl.position.x, y: toEl.position.y }, toEl.position];
        }
        wirePoints.set(wire.id, path);
      }
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

      if (dy < 4) {
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
      } else if (dx < 4) {
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
        Math.abs(ref.coord - seg.coord) <= 6 &&
        seg.spanMax > ref.spanMin + 15 &&
        seg.spanMin < ref.spanMax - 15
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
        const lateralOffset = (idx - (count - 1) / 2) * 6; // 6px perpendicular spacing
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
        const isHoriz = Math.abs(pts[i + 1].y - pts[i].y) < 4;
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

