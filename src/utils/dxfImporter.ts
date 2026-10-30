import { Wall, WallOpening, Point } from '../types/cad';
import { distance } from './cadMath';

export interface DxfLayerSummary {
  name: string;
  color?: number;
  lineCount: number;
  polylineCount: number;
  insertCount: number;
  isSuggestedWall: boolean;
  isSuggestedOpening: boolean;
}

export interface DxfParseResult {
  success: boolean;
  error?: string;
  walls: Wall[];
  openings: WallOpening[];
  layers: DxfLayerSummary[];
  detectedUnit: 'mm' | 'cm' | 'm';
  extents: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    widthMm: number;
    heightMm: number;
  };
  stats: {
    totalEntities: number;
    rawLinesCount: number;
    rawPolylinesCount: number;
    recognizedWalls: number;
    recognizedOpenings: number;
  };
}

interface RawDxfLine {
  layer: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface RawDxfPolyline {
  layer: string;
  vertices: Point[];
  closed: boolean;
}

interface RawDxfInsert {
  name: string;
  layer: string;
  x: number;
  y: number;
  rotation?: number;
}

/**
 * Robust ASCII DXF Parser for Architectural drawings (AutoCAD R12 through 2024).
 * Extracts lines, polylines and blocks, and intelligently reconstructs CAD Walls and Openings.
 */
export function parseDxfFile(
  dxfContent: string,
  options?: {
    forcedUnit?: 'auto' | 'mm' | 'cm' | 'm';
    selectedLayers?: string[];
    defaultThicknessMm?: number;
    targetCenter?: Point;
  }
): DxfParseResult {
  const lines = dxfContent.split(/\r?\n/);
  let idx = 0;

  const rawLines: RawDxfLine[] = [];
  const rawPolylines: RawDxfPolyline[] = [];
  const rawInserts: RawDxfInsert[] = [];
  const layerStatsMap = new Map<string, DxfLayerSummary>();

  let insUnits = 4; // 4 = mm default
  let currentSection = '';

  const getOrInitLayer = (layerName: string): DxfLayerSummary => {
    const key = (layerName || '0').trim();
    if (!layerStatsMap.has(key)) {
      const lower = key.toLowerCase();
      const isSuggestedWall =
        lower.includes('wall') ||
        lower.includes('стін') ||
        lower.includes('стен') ||
        lower.includes('перегород') ||
        lower.includes('bearing') ||
        lower.includes('partit') ||
        lower.includes('a-wall') ||
        lower.includes('ar-wall') ||
        lower === '0';
      const isSuggestedOpening =
        lower.includes('door') ||
        lower.includes('двер') ||
        lower.includes('win') ||
        lower.includes('вікн') ||
        lower.includes('окн') ||
        lower.includes('opening');

      layerStatsMap.set(key, {
        name: key,
        lineCount: 0,
        polylineCount: 0,
        insertCount: 0,
        isSuggestedWall,
        isSuggestedOpening,
      });
    }
    return layerStatsMap.get(key)!;
  };

  // 1. FAST STREAMING PARSER OF GROUP CODES
  while (idx < lines.length - 1) {
    const codeStr = lines[idx].trim();
    const valStr = lines[idx + 1].trim();
    idx += 2;

    const code = parseInt(codeStr, 10);
    if (isNaN(code)) continue;

    // Section transitions
    if (code === 0 && valStr === 'SECTION') {
      if (idx < lines.length - 1 && lines[idx].trim() === '2') {
        currentSection = lines[idx + 1].trim();
        idx += 2;
      }
      continue;
    }
    if (code === 0 && valStr === 'ENDSEC') {
      currentSection = '';
      continue;
    }

    // Header units detection
    if (currentSection === 'HEADER') {
      if (code === 9 && valStr === '$INSUNITS') {
        if (idx < lines.length - 1 && lines[idx].trim() === '70') {
          insUnits = parseInt(lines[idx + 1].trim(), 10) || 4;
          idx += 2;
        }
      }
      continue;
    }

    // Entities processing
    if (currentSection === 'ENTITIES' && code === 0) {
      if (valStr === 'LINE') {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
        let layer = '0';

        while (idx < lines.length - 1) {
          const c = parseInt(lines[idx].trim(), 10);
          const v = lines[idx + 1].trim();
          if (c === 0) break; // Next entity
          idx += 2;

          if (c === 8) layer = v;
          else if (c === 10) x1 = parseFloat(v);
          else if (c === 20) y1 = parseFloat(v);
          else if (c === 11) x2 = parseFloat(v);
          else if (c === 21) y2 = parseFloat(v);
        }

        const lEntry = getOrInitLayer(layer);
        lEntry.lineCount++;
        rawLines.push({ layer, x1, y1, x2, y2 });
      } else if (valStr === 'LWPOLYLINE' || valStr === 'POLYLINE') {
        let layer = '0';
        let closed = false;
        const vertices: Point[] = [];
        let curX = 0, curY = 0;
        let hasX = false;

        while (idx < lines.length - 1) {
          const c = parseInt(lines[idx].trim(), 10);
          const v = lines[idx + 1].trim();
          if (c === 0) break;
          idx += 2;

          if (c === 8) layer = v;
          else if (c === 70) {
            const flag = parseInt(v, 10);
            closed = (flag & 1) === 1;
          } else if (c === 10) {
            curX = parseFloat(v);
            hasX = true;
          } else if (c === 20 && hasX) {
            curY = parseFloat(v);
            vertices.push({ x: curX, y: curY });
            hasX = false;
          }
        }

        const lEntry = getOrInitLayer(layer);
        lEntry.polylineCount++;
        if (vertices.length >= 2) {
          rawPolylines.push({ layer, vertices, closed });
        }
      } else if (valStr === 'INSERT') {
        let name = '';
        let layer = '0';
        let x = 0, y = 0, rot = 0;

        while (idx < lines.length - 1) {
          const c = parseInt(lines[idx].trim(), 10);
          const v = lines[idx + 1].trim();
          if (c === 0) break;
          idx += 2;

          if (c === 2) name = v;
          else if (c === 8) layer = v;
          else if (c === 10) x = parseFloat(v);
          else if (c === 20) y = parseFloat(v);
          else if (c === 50) rot = parseFloat(v);
        }

        const lEntry = getOrInitLayer(layer);
        lEntry.insertCount++;
        rawInserts.push({ name, layer, x, y, rotation: rot });
      }
    }
  }

  // 2. COORDINATE BOUNDING BOX & UNIT ESTIMATION
  let minRawX = Infinity, maxRawX = -Infinity;
  let minRawY = Infinity, maxRawY = -Infinity;

  rawLines.forEach((l) => {
    minRawX = Math.min(minRawX, l.x1, l.x2);
    maxRawX = Math.max(maxRawX, l.x1, l.x2);
    minRawY = Math.min(minRawY, l.y1, l.y2);
    maxRawY = Math.max(maxRawY, l.y1, l.y2);
  });

  rawPolylines.forEach((p) => {
    p.vertices.forEach((v) => {
      minRawX = Math.min(minRawX, v.x);
      maxRawX = Math.max(maxRawX, v.x);
      minRawY = Math.min(minRawY, v.y);
      maxRawY = Math.max(maxRawY, v.y);
    });
  });

  if (!isFinite(minRawX) || !isFinite(maxRawX)) {
    return {
      success: false,
      error: 'Файл DXF не містить ліній креслення (LINE або LWPOLYLINE)',
      walls: [],
      openings: [],
      layers: [],
      detectedUnit: 'mm',
      extents: { minX: 0, maxX: 0, minY: 0, maxY: 0, widthMm: 0, heightMm: 0 },
      stats: { totalEntities: 0, rawLinesCount: 0, rawPolylinesCount: 0, recognizedWalls: 0, recognizedOpenings: 0 },
    };
  }

  const spanX = maxRawX - minRawX;
  const spanY = maxRawY - minRawY;
  const maxSpan = Math.max(spanX, spanY);

  // Auto unit detection:
  // If span is 5..100 -> likely meters (e.g. 15.0m x 10.0m)
  // If span is 500..5000 -> likely cm (e.g. 1500cm x 1000cm)
  // If span is 5000..100000 -> likely mm (e.g. 15000mm x 10000mm)
  let detectedUnit: 'mm' | 'cm' | 'm' = 'mm';
  if (options?.forcedUnit && options.forcedUnit !== 'auto') {
    detectedUnit = options.forcedUnit;
  } else if (insUnits === 6 || maxSpan <= 150) {
    detectedUnit = 'm';
  } else if (insUnits === 5 || (maxSpan > 150 && maxSpan <= 3500)) {
    detectedUnit = 'cm';
  } else {
    detectedUnit = 'mm';
  }

  // Multiplier to convert raw DXF units to Millimeters (mm)
  let unitToMm = 1.0;
  if (detectedUnit === 'm') unitToMm = 1000.0;
  else if (detectedUnit === 'cm') unitToMm = 10.0;
  else unitToMm = 1.0;

  // Standard CAD display scale: 100px = 1000mm (1mm = 0.1px)
  const mmToCadPx = 0.1;
  const toCadCoord = (rawX: number, rawY: number): Point => {
    // In DXF, Y axis goes Up (+Y). In Web Canvas, Y axis goes Down (+Y).
    const xMm = (rawX - minRawX) * unitToMm;
    const yMm = (maxRawY - rawY) * unitToMm;
    return {
      x: Math.round(xMm * mmToCadPx * 10) / 10 + 60,
      y: Math.round(yMm * mmToCadPx * 10) / 10 + 60,
    };
  };

  // 3. LAYER FILTERING
  const allowedLayers = options?.selectedLayers && options.selectedLayers.length > 0
    ? new Set(options.selectedLayers)
    : null;

  // If user hasn't specified layers, pick all suggested wall layers or fallback to all layers
  const hasSuggestedWallLayer = Array.from(layerStatsMap.values()).some((l) => l.isSuggestedWall && (l.lineCount + l.polylineCount > 0));

  const isLayerAccepted = (layer: string): boolean => {
    if (allowedLayers) return allowedLayers.has(layer);
    if (!hasSuggestedWallLayer) return true; // Accept all if no clear wall layer
    const l = layerStatsMap.get(layer);
    return Boolean(l?.isSuggestedWall || l?.name === '0');
  };

  // 4. CONVERT DXF LINES & POLYLINES TO CANDIDATE SEGMENTS
  interface CandidateWallSeg {
    start: Point;
    end: Point;
    lengthMm: number;
    layer: string;
  }

  const candidateSegments: CandidateWallSeg[] = [];

  rawLines.forEach((l) => {
    if (!isLayerAccepted(l.layer)) return;
    const p1 = toCadCoord(l.x1, l.y1);
    const p2 = toCadCoord(l.x2, l.y2);
    const lenPx = distance(p1, p2);
    const lenMm = lenPx / mmToCadPx;

    // Filter out micro-segments (< 200mm) such as dimension ticks, hatches, crosshairs
    if (lenMm >= 220) {
      candidateSegments.push({ start: p1, end: p2, lengthMm: lenMm, layer: l.layer });
    }
  });

  rawPolylines.forEach((poly) => {
    if (!isLayerAccepted(poly.layer)) return;
    const vCount = poly.vertices.length;
    for (let i = 0; i < (poly.closed ? vCount : vCount - 1); i++) {
      const v1 = poly.vertices[i];
      const v2 = poly.vertices[(i + 1) % vCount];
      const p1 = toCadCoord(v1.x, v1.y);
      const p2 = toCadCoord(v2.x, v2.y);
      const lenPx = distance(p1, p2);
      const lenMm = lenPx / mmToCadPx;
      if (lenMm >= 220) {
        candidateSegments.push({ start: p1, end: p2, lengthMm: lenMm, layer: poly.layer });
      }
    }
  });

  // 5. MERGE CO-LINEAR SEGMENTS & REMOVE DUPLICATES
  const generatedWalls: Wall[] = [];
  const processedSegs = new Set<number>();

  candidateSegments.forEach((seg, i) => {
    if (processedSegs.has(i)) return;
    processedSegs.add(i);

    // Snap to 90 degrees if very close (e.g. angle within 2 degrees of horizontal/vertical)
    let p1 = { ...seg.start };
    let p2 = { ...seg.end };

    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    if (dy < 6 && dx > 20) {
      p2.y = p1.y; // Snap horizontal
    } else if (dx < 6 && dy > 20) {
      p2.x = p1.x; // Snap vertical
    }

    const wallThickness = seg.lengthMm > 4000 ? 250 : (options?.defaultThicknessMm || 150);
    const wallType = wallThickness >= 200 ? 'bearing' : 'partition';

    generatedWalls.push({
      id: `w_dxf_${Date.now()}_${i}`,
      start: p1,
      end: p2,
      thickness: wallThickness,
      type: wallType,
    });
  });

  // 6. IDENTIFY OPENINGS (DOORS / WINDOWS)
  const generatedOpenings: WallOpening[] = [];

  rawInserts.forEach((ins, idx) => {
    const lowerName = ins.name.toLowerCase();
    const isDoor = lowerName.includes('door') || lowerName.includes('двер') || lowerName.includes('dr');
    const isWin = lowerName.includes('win') || lowerName.includes('вікн') || lowerName.includes('окн') || lowerName.includes('wn');

    if (isDoor || isWin) {
      const insPos = toCadCoord(ins.x, ins.y);
      // Find nearest wall to attach opening
      let closestWall: Wall | null = null;
      let closestDist = Infinity;
      let bestRatio = 0.5;

      generatedWalls.forEach((w) => {
        const wdx = w.end.x - w.start.x;
        const wdy = w.end.y - w.start.y;
        const wlenSq = wdx * wdx + wdy * wdy;
        if (wlenSq === 0) return;

        const t = Math.max(0.1, Math.min(0.9, ((insPos.x - w.start.x) * wdx + (insPos.y - w.start.y) * wdy) / wlenSq));
        const projX = w.start.x + t * wdx;
        const projY = w.start.y + t * wdy;
        const d = Math.hypot(insPos.x - projX, insPos.y - projY);

        if (d < closestDist && d < 40) { // within 400mm of wall
          closestDist = d;
          closestWall = w;
          bestRatio = t;
        }
      });

      if (closestWall) {
        generatedOpenings.push({
          id: `op_dxf_${Date.now()}_${idx}`,
          wallId: (closestWall as Wall).id,
          type: isDoor ? 'door' : 'window',
          width: isDoor ? 900 : 1200,
          positionRatio: bestRatio,
          swingDirection: 'right',
        });
      }
    }
  });

  return {
    success: generatedWalls.length > 0,
    walls: generatedWalls,
    openings: generatedOpenings,
    layers: Array.from(layerStatsMap.values()),
    detectedUnit,
    extents: {
      minX: minRawX,
      maxX: maxRawX,
      minY: minRawY,
      maxY: maxRawY,
      widthMm: Math.round(spanX * unitToMm),
      heightMm: Math.round(spanY * unitToMm),
    },
    stats: {
      totalEntities: rawLines.length + rawPolylines.length + rawInserts.length,
      rawLinesCount: rawLines.length,
      rawPolylinesCount: rawPolylines.length,
      recognizedWalls: generatedWalls.length,
      recognizedOpenings: generatedOpenings.length,
    },
  };
}
