import { CadProject, ElectricalElement, Point, WireRoute } from '../types/cad';
import { calculateCableLengthM, checkChaseIntersectsOpening } from './cadMath';

/**
 * PUE Ukraine (Правила улаштування електроустановок):
 * - Всі траси прокладаються суворо під прямими кутами 90° (вертикально або горизонтально).
 * - Відступ від стелі для магістральних трас: 150–200 мм.
 * - Опуски до розеток та вимикачів здійснюються суворо вертикально над центром підрозетника.
 * - Запас кабелю на оброблення та підключення в щиті та підрозетниках: +15%.
 * - Заборонено прокладати штроби крізь дверні та віконні отвори (ПУЕ §2.1.52).
 */

export interface AutoRouteResult {
  newWires: WireRoute[];
  totalLengthM: number;
  routedElementsCount: number;
}

/**
/**
 * Helper to remove redundant collinear points from a polyline.
 */
function simplifyOrthogonalPolyline(pts: Point[]): Point[] {
  if (pts.length <= 2) return pts;
  const result: Point[] = [pts[0]];

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    // Skip duplicate point
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
 * Computes an orthogonal 90-degree rectilinear path between two points,
 * favoring wall alignment, Manhattan corridors, and strictly avoiding door/window openings
 * according to Ukrainian PUE §2.1.52.
 */
export function computeOrthogonalPath(
  start: Point,
  end: Point,
  walls: CadProject['walls'] = [],
  openings: CadProject['openings'] = []
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
    // If the straight segment passes through an opening (e.g. across a window),
    // it MUST NOT be returned directly; fall through to detour routing below!
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

  // 2. Both simple paths collide with openings (or collinear segment collides).
  // Generate multi-candidate bypass detours around the opening(s) (ПУЕ §2.1.52).
  const wallMap = new Map<string, CadProject['walls'][0]>();
  walls.forEach((w) => wallMap.set(w.id, w));

  const candidateDetours: Point[][] = [];

  // Generate specific geometry-based bypasses for any opening that was hit
  const hitOpenings = [collA.opening, collB.opening].filter(Boolean);
  hitOpenings.forEach((op) => {
    if (!op) return;
    const wall = wallMap.get(op.wallId);
    if (!wall) return;

    const wdx = wall.end.x - wall.start.x;
    const wdy = wall.end.y - wall.start.y;
    const isWallHorizontal = Math.abs(wdx) >= Math.abs(wdy);
    const wallLen = Math.hypot(wdx, wdy) || 1;
    const halfWidthPx = (op.width / 20) / 2 + 15; // 20mm/px scale conversion + safety clearance
    const cx = wall.start.x + wdx * op.positionRatio;
    const cy = wall.start.y + wdy * op.positionRatio;

    if (isWallHorizontal) {
      // Bypass left of window
      const xLeft = cx - halfWidthPx - 25;
      candidateDetours.push(simplifyOrthogonalPolyline([start, { x: xLeft, y: start.y }, { x: xLeft, y: end.y }, end]));
      // Bypass right of window
      const xRight = cx + halfWidthPx + 25;
      candidateDetours.push(simplifyOrthogonalPolyline([start, { x: xRight, y: start.y }, { x: xRight, y: end.y }, end]));
    } else {
      // Bypass above window
      const yTop = cy - halfWidthPx - 25;
      candidateDetours.push(simplifyOrthogonalPolyline([start, { x: start.x, y: yTop }, { x: end.x, y: yDetour(yTop) }, end]));
      // Bypass below window
      const yBottom = cy + halfWidthPx + 25;
      candidateDetours.push(simplifyOrthogonalPolyline([start, { x: start.x, y: yBottom }, { x: end.x, y: yBottom }, end]));
    }
  });

  function yDetour(val: number) {
    return val;
  }

  // Standard progressive corridor offsets: ±30, ±50, ±80, ±120, ±160 px
  const standardOffsets = [35, -35, 55, -55, 85, -85, 120, -120];
  standardOffsets.forEach((offset) => {
    // Detour A: offset along X
    candidateDetours.push(
      simplifyOrthogonalPolyline([
        start,
        { x: start.x + offset, y: start.y },
        { x: start.x + offset, y: end.y },
        end,
      ])
    );
    // Detour B: offset along Y
    candidateDetours.push(
      simplifyOrthogonalPolyline([
        start,
        { x: start.x, y: start.y + offset },
        { x: end.x, y: start.y + offset },
        end,
      ])
    );
    // Detour C: offset at middle coordinate
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

  // Evaluate candidate detours: find the first collision-free detour
  for (const cand of candidateDetours) {
    const testColl = checkChaseIntersectsOpening(cand, walls, openings);
    if (!testColl.hasCollision) {
      return cand;
    }
  }

  // If no tested candidate is 100% collision-free, pick the candidate with minimum collision
  return dx > dy ? pathA : pathB;
}

/**
 * Automatically routes cables from distribution panels (ВРП / ЩРН)
 * to all sockets, switches, and appliances grouped by circuit.
 */
export interface AutoRouteResult {
  newWires: WireRoute[];
  newElements?: ElectricalElement[];
  totalLengthM: number;
  routedElementsCount: number;
}

/**
 * Automatically routes cables from distribution panels (ВРП / ЩРН)
 * to all sockets, switches, junction boxes, and appliances grouped by circuit.
 * Adheres strictly to PUE Ukraine & DBN V.2.5-23:2010.
 */
export function autoRouteProjectCables(
  project: CadProject,
  targetCircuitId?: string
): AutoRouteResult {
  // Respect user toggle: if auto-routing is disabled, do not modify wires
  if (project.autoRoutingEnabled === false) {
    const totalLen = project.wires.reduce((sum, w) => sum + w.calculatedLengthM, 0);
    return {
      newWires: project.wires,
      newElements: project.elements,
      totalLengthM: Math.round(totalLen * 10) / 10,
      routedElementsCount: 0,
    };
  }

  // Preserve all manual wires (isManual: true) and wires from untouched circuits
  const targetCircuits = targetCircuitId
    ? project.circuits.filter((c) => c.id === targetCircuitId)
    : project.circuits;

  const targetCircuitIdSet = new Set(targetCircuits.map((c) => c.id));

  // Keep existing wires that are manual OR belong to circuits not being processed
  // STRICT PUE RULE: Clean up any invalid wires that connect a socket directly to a switch
  const newWires: WireRoute[] = project.wires.filter((w) => {
    const fromEl = project.elements.find((e) => e.id === w.fromId);
    const toEl = project.elements.find((e) => e.id === w.toId);
    if (fromEl && toEl) {
      const isSocketToSwitch =
        (fromEl.category === 'socket' && toEl.category === 'switch') ||
        (fromEl.category === 'switch' && toEl.category === 'socket');
      if (isSocketToSwitch) return false;
    }
    return w.isManual || (w.circuitId && !targetCircuitIdSet.has(w.circuitId));
  });

  const newElements: ElectricalElement[] = [...project.elements];
  let routedCount = 0;

  // Find primary electrical panel (panel_cu)
  const primaryPanel =
    newElements.find((el) => el.type === 'panel_cu' || el.category === 'panel') ||
    newElements[0];

  if (!primaryPanel) {
    return { newWires, newElements, totalLengthM: 0, routedElementsCount: 0 };
  }

  // Helper to test if a circuit is a lighting circuit (UKR / RUS / ENG keywords & electrical ratings)
  const isLightingCircuitSpec = (c: { cableType: string; breakerRatingA: number; name: string }) => {
    const nameLower = c.name.toLowerCase();
    return (
      c.cableType === 'VVGng_3x1.5' ||
      c.breakerRatingA <= 10 ||
      nameLower.includes('освіт') ||
      nameLower.includes('світл') ||
      nameLower.includes('освещ') ||
      nameLower.includes('свет') ||
      nameLower.includes('light')
    );
  };

  // Sanity check: Ensure strict separation between lighting and sockets.
  // Switches and luminaires must NEVER be in socket/power circuits (16A, 2.5mm²).
  let lightingCircuit = project.circuits.find(isLightingCircuitSpec);
  const generalSocketCircuit = project.circuits.find(
    (c) => c.breakerRatingA >= 16 && c.cableType !== 'VVGng_3x1.5'
  );

  // If lighting circuit doesn't exist but project has switches/lights, automatically create one
  if (!lightingCircuit && newElements.some((el) => el.category === 'switch' || el.category === 'light')) {
    lightingCircuit = {
      id: `c_auto_light_${Date.now()}`,
      number: project.circuits.length + 1,
      name: 'Освітлення (10А, ВВГнгд 3х1.5)',
      breakerRatingA: 10,
      breakerCurve: 'C',
      rcdType: 'none',
      cableType: 'VVGng_3x1.5',
      phase: 'L1',
      color: '#f59e0b',
      description: 'Автоматично виділена група освітлення за ПУЕ',
    };
    project.circuits.push(lightingCircuit);
  }

  newElements.forEach((el) => {
    if (el.category === 'switch' || el.category === 'light') {
      const c = project.circuits.find((item) => item.id === el.circuitId);
      if (!c || c.breakerRatingA >= 16 || c.cableType === 'VVGng_3x2.5' || c.cableType === 'VVGng_3x4' || c.cableType === 'VVGng_3x6') {
        // Re-assign switch to lighting circuit
        if (lightingCircuit) el.circuitId = lightingCircuit.id;
      }
    } else if (el.category === 'socket') {
      const c = project.circuits.find((item) => item.id === el.circuitId);
      if (c && isLightingCircuitSpec(c)) {
        // Re-assign socket to socket circuit
        if (generalSocketCircuit) el.circuitId = generalSocketCircuit.id;
      }
    }
  });

  targetCircuits.forEach((circuit) => {
    // Elements belonging to this circuit (excluding the main panel)
    const circuitElements = newElements.filter(
      (el) => el.circuitId === circuit.id && el.id !== primaryPanel.id
    );

    if (circuitElements.length === 0) return;

    // Check if this circuit is lighting
    const isLighting =
      isLightingCircuitSpec(circuit) ||
      circuitElements.every(
        (el) =>
          el.category === 'light' ||
          el.category === 'switch' ||
          el.category === 'junction' ||
          el.type.startsWith('junction_box')
      );

    if (isLighting) {
      // =========================================================================
      // LIGHTING ROUTING: Panel -> Junction Box (РК) -> Switch drop & Luminaires
      // =========================================================================
      const switches = circuitElements.filter((el) => el.category === 'switch');
      const lights = circuitElements.filter((el) => el.category === 'light');
      let junctionBoxes = circuitElements.filter(
        (el) => el.category === 'junction' || el.type.startsWith('junction_box')
      );

      // If no junction box exists for this lighting circuit, automatically place one
      let primaryJb: ElectricalElement;
      if (junctionBoxes.length > 0) {
        primaryJb = junctionBoxes[0];
      } else {
        // Place junction box above the first switch or between panel and first luminaire
        let jbPos: Point;
        if (switches.length > 0) {
          const sw = switches[0];
          jbPos = { x: sw.position.x, y: sw.position.y - 25 };
        } else if (lights.length > 0) {
          const lt = lights[0];
          jbPos = {
            x: Math.round((primaryPanel.position.x + lt.position.x) / 2),
            y: Math.round((primaryPanel.position.y + lt.position.y) / 2),
          };
        } else {
          jbPos = { x: primaryPanel.position.x + 40, y: primaryPanel.position.y };
        }

        const autoJb: ElectricalElement = {
          id: `el_jb_light_${circuit.id}_${Date.now()}`,
          category: 'junction',
          type: 'junction_box_light',
          name: `РК Освітлення (${circuit.name})`,
          position: jbPos,
          rotation: 0,
          mountingHeightMm: 2500, // Ceiling level (ПУЕ: 200мм від стелі)
          powerWatts: 0,
          ipRating: 'IP20',
          circuitId: circuit.id,
          label: 'РК-L',
        };

        newElements.push(autoJb);
        junctionBoxes.push(autoJb);
        primaryJb = autoJb;
      }

      // 1. Connect Panel to Junction Box (Supply Line: L + N + PE)
      const hasPanelToJb = newWires.some(
        (w) =>
          (w.fromId === primaryPanel.id && w.toId === primaryJb.id) ||
          (w.fromId === primaryJb.id && w.toId === primaryPanel.id)
      );

      if (!hasPanelToJb) {
        const path = computeOrthogonalPath(
          primaryPanel.position,
          primaryJb.position,
          project.walls,
          project.openings
        );
        const wireLength = calculateCableLengthM(
          primaryPanel,
          primaryJb,
          project.ceilingHeightMm,
          'ceiling',
          path
        );

        newWires.push({
          id: `wire_auto_${Date.now()}_jb_${Math.random().toString(36).substr(2, 6)}`,
          fromId: primaryPanel.id,
          toId: primaryJb.id,
          points: path,
          mode: 'ortho',
          conduit: 'ceiling',
          cableType: circuit.cableType || 'VVGng_3x1.5',
          circuitId: circuit.id,
          cableTag: `W${circuit.number}-01`,
          calculatedLengthM: wireLength,
        });
        routedCount++;
      }

      // 2. Connect Junction Box to each Switch (Vertical Drop: Phase L + Switched Phase L')
      switches.forEach((sw, sIdx) => {
        const hasSwitchWire = newWires.some(
          (w) =>
            (w.fromId === primaryJb.id && w.toId === sw.id) ||
            (w.fromId === sw.id && w.toId === primaryJb.id)
        );

        if (!hasSwitchWire) {
          const path = computeOrthogonalPath(
            primaryJb.position,
            sw.position,
            project.walls,
            project.openings
          );
          const wireLength = calculateCableLengthM(
            primaryJb,
            sw,
            project.ceilingHeightMm,
            'wall_chase',
            path
          );

          newWires.push({
            id: `wire_auto_${Date.now()}_sw_${sIdx}_${Math.random().toString(36).substr(2, 6)}`,
            fromId: primaryJb.id,
            toId: sw.id,
            points: path,
            mode: 'ortho',
            conduit: 'wall_chase', // Vertically routed drop in wall chase
            cableType: 'VVGng_3x1.5',
            circuitId: circuit.id,
            switchGroupId: sw.switchGroupId,
            cableTag: `W${circuit.number}-SW${sIdx + 1}`,
            calculatedLengthM: wireLength,
          });
          routedCount++;
        }
      });

      // 3. Connect Junction Box to Luminaires (Switched Line: L' + N + PE)
      // Group lights by switchGroupId or daisy-chain
      const lightsByGroup = new Map<string, ElectricalElement[]>();
      lights.forEach((lt) => {
        const gId = lt.switchGroupId || 'default';
        if (!lightsByGroup.has(gId)) {
          lightsByGroup.set(gId, []);
        }
        lightsByGroup.get(gId)!.push(lt);
      });

      lightsByGroup.forEach((groupLights, gKey) => {
        // Sort group lights by distance from junction box
        const sortedGroup = [...groupLights].sort((a, b) => {
          const dA = Math.hypot(a.position.x - primaryJb.position.x, a.position.y - primaryJb.position.y);
          const dB = Math.hypot(b.position.x - primaryJb.position.x, b.position.y - primaryJb.position.y);
          return dA - dB;
        });

        if (sortedGroup.length === 0) return;

        // Line 3a: Junction Box to First Luminaire
        const firstLight = sortedGroup[0];
        const hasJbToLight = newWires.some(
          (w) =>
            (w.fromId === primaryJb.id && w.toId === firstLight.id) ||
            (w.fromId === firstLight.id && w.toId === primaryJb.id)
        );

        if (!hasJbToLight) {
          const wireLength = calculateCableLengthM(
            primaryJb,
            firstLight,
            project.ceilingHeightMm,
            'ceiling'
          );

          newWires.push({
            id: `wire_auto_${Date.now()}_lt0_${Math.random().toString(36).substr(2, 6)}`,
            fromId: primaryJb.id,
            toId: firstLight.id,
            mode: 'curve',
            conduit: 'ceiling',
            cableType: circuit.cableType || 'VVGng_3x1.5',
            circuitId: circuit.id,
            switchGroupId: gKey !== 'default' ? gKey : undefined,
            cableTag: `W${circuit.number}-L1`,
            calculatedLengthM: wireLength,
          });
          routedCount++;
        }

        // Line 3b: Daisy-chain First Luminaire -> Subsequent Luminaires in the group
        for (let i = 1; i < sortedGroup.length; i++) {
          const prevLt = sortedGroup[i - 1];
          const currLt = sortedGroup[i];

          const hasChainWire = newWires.some(
            (w) =>
              (w.fromId === prevLt.id && w.toId === currLt.id) ||
              (w.fromId === currLt.id && w.toId === prevLt.id)
          );

          if (!hasChainWire) {
            const wireLength = calculateCableLengthM(
              prevLt,
              currLt,
              project.ceilingHeightMm,
              'ceiling'
            );

            newWires.push({
              id: `wire_auto_${Date.now()}_lt_${i}_${Math.random().toString(36).substr(2, 6)}`,
              fromId: prevLt.id,
              toId: currLt.id,
              mode: 'curve',
              conduit: 'ceiling',
              cableType: circuit.cableType || 'VVGng_3x1.5',
              circuitId: circuit.id,
              switchGroupId: gKey !== 'default' ? gKey : undefined,
              cableTag: `W${circuit.number}-L${i + 1}`,
              calculatedLengthM: wireLength,
            });
            routedCount++;
          }
        }
      });
    } else {
      // =========================================================================
      // POWER / SOCKETS ROUTING (No duplicate routes, clean wall/ceiling daisy chains)
      // =========================================================================
      // Keep track of elements that already have a power feed in this circuit
      const connectedElementIds = new Set<string>();
      connectedElementIds.add(primaryPanel.id);

      // Pre-populate elements already wired in newWires for this circuit
      newWires.forEach((w) => {
        if (w.circuitId === circuit.id) {
          connectedElementIds.add(w.fromId);
          connectedElementIds.add(w.toId);
        }
      });

      // STRICT ПУЕ: Sockets and power loads ONLY! Never route switches or luminaires here!
      const powerElements = circuitElements.filter(
        (el) =>
          el.category !== 'switch' &&
          el.category !== 'light' &&
          el.type !== 'junction_box_light'
      );

      // 1. Heavy radial load appliances (cooker, water heater, AC, oven, or power >= 2500W)
      // Must be routed directly from electrical panel on a dedicated line
      const heavyElements = powerElements.filter(
        (el) =>
          el.type === 'socket_cooker' ||
          el.type === 'water_heater' ||
          el.type === 'ac_indoor' ||
          el.type === 'electric_boiler' ||
          el.powerWatts >= 2500
      );

      heavyElements.forEach((el) => {
        const alreadyWired = newWires.some(
          (w) =>
            (w.fromId === primaryPanel.id && w.toId === el.id) ||
            (w.fromId === el.id && w.toId === primaryPanel.id)
        );

        if (!alreadyWired) {
          const path = computeOrthogonalPath(
            primaryPanel.position,
            el.position,
            project.walls,
            project.openings
          );
          const wireLength = calculateCableLengthM(
            primaryPanel,
            el,
            project.ceilingHeightMm,
            'ceiling',
            path
          );

          newWires.push({
            id: `wire_auto_${Date.now()}_heavy_${Math.random().toString(36).substr(2, 6)}`,
            fromId: primaryPanel.id,
            toId: el.id,
            points: path,
            mode: 'ortho',
            conduit: 'ceiling',
            cableType: circuit.cableType || (el.powerWatts > 5000 ? 'VVGng_3x6' : 'VVGng_3x2.5'),
            circuitId: circuit.id,
            calculatedLengthM: wireLength,
          });
          connectedElementIds.add(el.id);
          routedCount++;
        }
      });

      // 2. General Sockets: Daisy-chain along walls (max 4-5 sockets per chain)
      const remainingSockets = powerElements.filter(
        (el) =>
          (el.category === 'socket' || el.category === 'appliance' || el.category === 'backup' || el.type.startsWith('socket_')) &&
          !heavyElements.includes(el) &&
          !connectedElementIds.has(el.id)
      );

      if (remainingSockets.length > 0) {
        // Sort remaining sockets using Nearest Neighbor heuristic starting from primaryPanel
        let currentSource: ElectricalElement = primaryPanel;
        const unvisited = [...remainingSockets];

        while (unvisited.length > 0) {
          // Find the nearest unvisited socket to currentSource
          let nearestIdx = 0;
          let minDistance = Infinity;

          for (let i = 0; i < unvisited.length; i++) {
            const dist = Math.hypot(
              unvisited[i].position.x - currentSource.position.x,
              unvisited[i].position.y - currentSource.position.y
            );
            if (dist < minDistance) {
              minDistance = dist;
              nearestIdx = i;
            }
          }

          const targetSocket = unvisited.splice(nearestIdx, 1)[0];

          // Check whether a wire already connects source and target
          const alreadyExists = newWires.some(
            (w) =>
              (w.fromId === currentSource.id && w.toId === targetSocket.id) ||
              (w.fromId === targetSocket.id && w.toId === currentSource.id)
          );

          if (!alreadyExists) {
            const path = computeOrthogonalPath(
              currentSource.position,
              targetSocket.position,
              project.walls,
              project.openings
            );
            const wireLength = calculateCableLengthM(
              currentSource,
              targetSocket,
              project.ceilingHeightMm,
              'ceiling',
              path
            );

            newWires.push({
              id: `wire_auto_${Date.now()}_sock_${Math.random().toString(36).substr(2, 6)}`,
              fromId: currentSource.id,
              toId: targetSocket.id,
              points: path,
              mode: 'ortho',
              conduit: 'ceiling',
              cableType: circuit.cableType || 'VVGng_3x2.5',
              circuitId: circuit.id,
              calculatedLengthM: wireLength,
            });
            routedCount++;
          }

          connectedElementIds.add(targetSocket.id);
          currentSource = targetSocket; // Continue daisy chain to next socket
        }
      }
    }
  });

  const totalLengthM = newWires.reduce((sum, w) => sum + w.calculatedLengthM, 0);

  return {
    newWires,
    newElements,
    totalLengthM: Math.round(totalLengthM * 10) / 10,
    routedElementsCount: routedCount,
  };
}

/**
 * Systematic Automatic Numbering of Circuits and Cables according to DSTU / PUE:
 * - Circuits re-numbered sequentially: Гр.1 (QF1), Гр.2 (QF2)...
 * - Cables tagged systematically: W{circuit.number}-{01, 02, 03...}
 */
export function autoNumberCircuitsAndCables(project: CadProject): CadProject {
  // 1. Sort and renumber circuits
  const updatedCircuits = project.circuits.map((c, idx) => ({
    ...c,
    number: idx + 1,
  }));

  const circuitNumMap = new Map<string, number>();
  updatedCircuits.forEach((c) => circuitNumMap.set(c.id, c.number));

  // 2. Walk wires grouped by circuit and assign systematic tags W{circuit}-{idx}
  const circuitWireCounters: Record<string, number> = {};
  let unassignedCounter = 1;

  const updatedWires: WireRoute[] = project.wires.map((w) => {
    const cNum = w.circuitId ? circuitNumMap.get(w.circuitId) : undefined;
    let tag = '';

    if (cNum !== undefined) {
      circuitWireCounters[w.circuitId!] = (circuitWireCounters[w.circuitId!] || 0) + 1;
      const count = circuitWireCounters[w.circuitId!];
      const pad = count < 10 ? `0${count}` : `${count}`;
      tag = `W${cNum}-${pad}`;
    } else {
      const pad = unassignedCounter < 10 ? `0${unassignedCounter}` : `${unassignedCounter}`;
      tag = `W0-${pad}`;
      unassignedCounter++;
    }

    return {
      ...w,
      cableTag: tag,
    };
  });

  return {
    ...project,
    circuits: updatedCircuits,
    wires: updatedWires,
  };
}

/**
 * Intelligent Standard Circuit Assigner (ПУЕ та ДБН В.2.5-23:2010):
 * Automatically creates standard groups and assigns elements:
 * - Lighting: 10A, ВВГнгд 3×1.5
 * - General Sockets: 16A, ВВГнгд 3×2.5 (grouped by rooms, max 4-5 per line)
 * - Heavy radial loads:
 *   - Electric Cooker / Hob: 32A, ВВГнгд 3×6
 *   - Oven: 16A, ВВГнгд 3×2.5
 *   - Water Heater / Boiler: 16A, ВВГнгд 3×2.5, RCD 10mA
 *   - Washing Machine: 16A, ВВГнгд 3×2.5, RCD 30mA
 *   - Air Conditioning: 16A, ВВГнгд 3×2.5
 */
export function autoAssignProjectCircuitsAndCables(project: CadProject): {
  project: CadProject;
  message: string;
} {
  const panel =
    project.elements.find((el) => el.type === 'panel_cu' || el.category === 'panel') ||
    project.elements[0];

  // Standard engineering circuit definitions
  const standardCircuits: CadProject['circuits'] = [
    {
      id: 'c_light_living',
      number: 1,
      name: 'Освітлення житлових кімнат',
      breakerRatingA: 10,
      breakerCurve: 'C',
      rcdType: 'none',
      cableType: 'VVGng_3x1.5',
      phase: 'L1',
      color: '#f59e0b',
      description: 'Люстри та споти спальні, вітальні, кабінету',
    },
    {
      id: 'c_light_utility',
      number: 2,
      name: 'Освітлення кухні, санвузлів, коридору',
      breakerRatingA: 10,
      breakerCurve: 'C',
      rcdType: 'rcd_30ma',
      cableType: 'VVGng_3x1.5',
      phase: 'L2',
      color: '#fbbf24',
      description: 'Освітлення зон з підвищеними вимогами електробезпеки',
    },
    {
      id: 'c_sock_living',
      number: 3,
      name: 'Розетки вітальні та спальні 1',
      breakerRatingA: 16,
      breakerCurve: 'C',
      rcdType: 'rcd_30ma',
      cableType: 'VVGng_3x2.5',
      phase: 'L1',
      color: '#38bdf8',
      description: 'Побутова розеточна група спальні та відпочинку',
    },
    {
      id: 'c_sock_bed2',
      number: 4,
      name: 'Розетки дитячої та кабінету',
      breakerRatingA: 16,
      breakerCurve: 'C',
      rcdType: 'rcd_30ma',
      cableType: 'VVGng_3x2.5',
      phase: 'L2',
      color: '#0ea5e9',
      description: 'Робочі місця та ПК, дитяча зона',
    },
    {
      id: 'c_sock_kitchen',
      number: 5,
      name: 'Розетки робочої зони кухні',
      breakerRatingA: 16,
      breakerCurve: 'C',
      rcdType: 'rcd_30ma',
      cableType: 'VVGng_3x2.5',
      phase: 'L3',
      color: '#06b6d4',
      description: 'Фартух кухні: чайник, кавоварка, мікрохвильова',
    },
    {
      id: 'c_cooker',
      number: 6,
      name: 'Варильна поверхня / Електроплита',
      breakerRatingA: 32,
      breakerCurve: 'C',
      rcdType: 'rcd_30ma',
      cableType: 'VVGng_3x6',
      phase: 'L1',
      color: '#ef4444',
      description: 'Окрема виділена радіальна лінія великої потужності (7.2 кВт)',
      isBackupPriority: false,
    },
    {
      id: 'c_oven',
      number: 7,
      name: 'Духова шафа (окрема лінія)',
      breakerRatingA: 16,
      breakerCurve: 'C',
      rcdType: 'rcd_30ma',
      cableType: 'VVGng_3x2.5',
      phase: 'L2',
      color: '#f97316',
      description: 'Окремий вивід для вбудованої духовки (до 3.5 кВт)',
    },
    {
      id: 'c_boiler',
      number: 8,
      name: 'Водонагрівач / Бойлер санвузла',
      breakerRatingA: 16,
      breakerCurve: 'C',
      rcdType: 'rcd_10ma',
      cableType: 'VVGng_3x2.5',
      phase: 'L3',
      color: '#10b981',
      description: 'Підвищена чутливість захисту ПЗВ 10 мА для мокрої зони',
      isBackupPriority: true,
    },
    {
      id: 'c_wash',
      number: 9,
      name: 'Пральна та сушильна машини',
      breakerRatingA: 16,
      breakerCurve: 'C',
      rcdType: 'rcbo_30ma',
      cableType: 'VVGng_3x2.5',
      phase: 'L1',
      color: '#8b5cf6',
      description: 'Диференційний автомат лінії пральні',
    },
    {
      id: 'c_ac',
      number: 10,
      name: 'Кондиціонери (спліт-системи)',
      breakerRatingA: 16,
      breakerCurve: 'C',
      rcdType: 'rcd_30ma',
      cableType: 'VVGng_3x2.5',
      phase: 'L2',
      color: '#6366f1',
      description: 'Кліматичне обладнання та блоки охолодження',
    },
  ];

  // Map elements to their dedicated circuits
  let assignedCount = 0;
  const updatedElements = project.elements.map((el) => {
    if (el.category === 'panel') return el;

    let targetCircuitId: string | undefined = undefined;

    // 1. Lighting & Switches
    if (el.category === 'light' || el.category === 'switch') {
      const isWetOrUtility =
        el.name.toLowerCase().includes('ванн') ||
        el.name.toLowerCase().includes('санвуз') ||
        el.name.toLowerCase().includes('кухн') ||
        el.name.toLowerCase().includes('коридор') ||
        el.name.toLowerCase().includes('веранд');

      targetCircuitId = isWetOrUtility ? 'c_light_utility' : 'c_light_living';
      assignedCount++;
    }
    // 2. Heavy Dedicated Appliances
    else if (el.type === 'socket_cooker' || el.name.toLowerCase().includes('плит') || el.name.toLowerCase().includes('варильн')) {
      targetCircuitId = 'c_cooker';
      assignedCount++;
    } else if (el.name.toLowerCase().includes('духов') || el.name.toLowerCase().includes('духовка')) {
      targetCircuitId = 'c_oven';
      assignedCount++;
    } else if (
      el.name.toLowerCase().includes('бойлер') ||
      el.name.toLowerCase().includes('водонагрів') ||
      el.type === 'water_heater' ||
      (el.ipRating === 'IP44' && el.name.toLowerCase().includes('ванн'))
    ) {
      targetCircuitId = 'c_boiler';
      assignedCount++;
    } else if (el.name.toLowerCase().includes('пральн') || el.name.toLowerCase().includes('сушил')) {
      targetCircuitId = 'c_wash';
      assignedCount++;
    } else if (el.type === 'ac_indoor' || el.name.toLowerCase().includes('кондиц') || el.name.toLowerCase().includes('спліт')) {
      targetCircuitId = 'c_ac';
      assignedCount++;
    }
    // 3. Kitchen Worktop Sockets
    else if (el.name.toLowerCase().includes('кухн') || el.name.toLowerCase().includes('фартух') || el.mountingHeightMm === 1050) {
      targetCircuitId = 'c_sock_kitchen';
      assignedCount++;
    }
    // 4. Other living vs bedroom sockets (by coordinates / zones)
    else if (el.category === 'socket') {
      targetCircuitId = el.position.x < 550 ? 'c_sock_living' : 'c_sock_bed2';
      assignedCount++;
    }

    if (targetCircuitId) {
      return {
        ...el,
        circuitId: targetCircuitId,
      };
    }
    return el;
  });

  // Re-route project cables with clean orthogonal paths and daisy-chains
  const projectWithAssignedElements: CadProject = {
    ...project,
    circuits: standardCircuits,
    elements: updatedElements,
    wires: [], // Clear old wires and re-route afresh
  };

  const routeResult = autoRouteProjectCables(projectWithAssignedElements);
  projectWithAssignedElements.wires = routeResult.newWires;
  if (routeResult.newElements) {
    projectWithAssignedElements.elements = routeResult.newElements;
  }

  // Number circuits and cables systematically
  const finalProject = autoNumberCircuitsAndCables(projectWithAssignedElements);

  return {
    project: finalProject,
    message: `Призначено ${assignedCount} точок до ${standardCircuits.length} інженерних груп. Прокладено ${routeResult.routedElementsCount} кабельних трас (${routeResult.totalLengthM} м) з автонумерацією W1..W10.`,
  };
}

/**
 * Binds a switch to an array of luminaires:
 * - Assigns matching switchGroupId (e.g. 'a', 'b', 'S1')
 * - Generates curved wiring lines with VVGng 3x1.5
 */
export function linkSwitchToLuminaires(
  project: CadProject,
  switchId: string,
  lightIds: string[],
  customGroupId?: string
): CadProject {
  const sw = project.elements.find((e) => e.id === switchId);
  if (!sw) return project;

  const groupId = customGroupId || sw.switchGroupId || `S_${sw.id.slice(-3)}`;

  // Update switch
  const updatedElements = project.elements.map((el) => {
    if (el.id === switchId) {
      return { ...el, switchGroupId: groupId };
    }
    if (lightIds.includes(el.id)) {
      return { ...el, switchGroupId: groupId };
    }
    return el;
  });

  // Create wires
  const newWires: WireRoute[] = [...project.wires];

  lightIds.forEach((lightId, idx) => {
    const light = project.elements.find((e) => e.id === lightId);
    if (!light) return;

    // Check if wire already exists
    const exists = newWires.some(
      (w) => (w.fromId === switchId && w.toId === lightId) || (w.fromId === lightId && w.toId === switchId)
    );

    if (!exists) {
      const lengthM = calculateCableLengthM(sw, light, project.ceilingHeightMm, 'ceiling');
      newWires.push({
        id: `wire_sw_${Date.now()}_${idx}`,
        fromId: switchId,
        toId: lightId,
        mode: 'curve',
        conduit: 'ceiling',
        cableType: 'VVGng_3x1.5',
        circuitId: sw.circuitId || light.circuitId,
        switchGroupId: groupId,
        calculatedLengthM: lengthM,
        cableTag: `W-L${groupId}.${idx + 1}`,
      });
    }
  });

  return {
    ...project,
    elements: updatedElements,
    wires: newWires,
  };
}

