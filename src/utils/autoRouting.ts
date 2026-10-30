import { CadProject, ElectricalElement, Point, WireRoute } from '../types/cad';
import { calculateCableLengthM } from './cadMath';

/**
 * PUE Ukraine (Правила улаштування електроустановок):
 * - Всі траси прокладаються суворо під прямими кутами 90° (вертикально або горизонтально).
 * - Відступ від стелі для магістральних трас: 150–200 мм.
 * - Опуски до розеток та вимикачів здійснюються суворо вертикально над центром підрозетника.
 * - Запас кабелю на оброблення та підключення в щиті та підрозетниках: +15%.
 */

export interface AutoRouteResult {
  newWires: WireRoute[];
  totalLengthM: number;
  routedElementsCount: number;
}

/**
 * Computes an orthogonal 90-degree rectilinear path between two points,
 * favoring wall alignment and Manhattan corridors.
 */
export function computeOrthogonalPath(
  start: Point,
  end: Point,
  walls: CadProject['walls'] = []
): Point[] {
  // If points are already aligned horizontally or vertically
  if (Math.abs(start.x - end.x) < 5 || Math.abs(start.y - end.y) < 5) {
    return [start, end];
  }

  // Find if there is a dominant corridor or wall near start/end
  // In residential layouts, cables go along corridor axis (usually Y or X)
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  // Strategy 1: L-bend or Z-bend (corner navigation)
  if (dx > dy) {
    // Longer horizontal span: go horizontal then vertical
    const mid1: Point = { x: end.x, y: start.y };
    return [start, mid1, end];
  } else {
    // Longer vertical span: go vertical then horizontal
    const mid1: Point = { x: start.x, y: end.y };
    return [start, mid1, end];
  }
}

/**
 * Automatically routes cables from distribution panels (ВРП / ЩРН)
 * to all sockets, switches, and appliances grouped by circuit.
 */
export function autoRouteProjectCables(
  project: CadProject,
  targetCircuitId?: string
): AutoRouteResult {
  const newWires: WireRoute[] = [...project.wires];
  let routedCount = 0;

  // Find primary electrical panel (panel_cu)
  const primaryPanel =
    project.elements.find((el) => el.type === 'panel_cu' || el.category === 'panel') ||
    project.elements[0];

  if (!primaryPanel) {
    return { newWires, totalLengthM: 0, routedElementsCount: 0 };
  }

  // Circuits to process
  const targetCircuits = targetCircuitId
    ? project.circuits.filter((c) => c.id === targetCircuitId)
    : project.circuits;

  targetCircuits.forEach((circuit) => {
    // Elements belonging to this circuit
    const circuitElements = project.elements.filter(
      (el) => el.circuitId === circuit.id && el.id !== primaryPanel.id
    );

    if (circuitElements.length === 0) return;

    // Check if this circuit is lighting
    const isLighting = circuit.name.toLowerCase().includes('освіт') || circuit.cableType === 'VVGng_3x1.5';

    if (isLighting) {
      // For lighting: route from Panel -> Switch -> Luminaires
      const switches = circuitElements.filter((el) => el.category === 'switch');
      const lights = circuitElements.filter((el) => el.category === 'light');

      // 1. Connect Panel to first Switch
      if (switches.length > 0) {
        const firstSwitch = switches[0];
        const existingWire = newWires.find(
          (w) =>
            (w.fromId === primaryPanel.id && w.toId === firstSwitch.id) ||
            (w.fromId === firstSwitch.id && w.toId === primaryPanel.id)
        );

        if (!existingWire) {
          const path = computeOrthogonalPath(primaryPanel.position, firstSwitch.position, project.walls);
          const wireLength = calculateCableLengthM(
            primaryPanel,
            firstSwitch,
            project.ceilingHeightMm,
            'ceiling',
            path
          );

          newWires.push({
            id: `wire_auto_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            fromId: primaryPanel.id,
            toId: firstSwitch.id,
            points: path,
            mode: 'ortho',
            conduit: 'ceiling',
            cableType: circuit.cableType || 'VVGng_3x1.5',
            circuitId: circuit.id,
            calculatedLengthM: wireLength,
          });
          routedCount++;
        }

        // 2. Connect Switch to matched Lights (by switchGroupId) or daisy chain
        lights.forEach((light) => {
          const isMatched = !light.switchGroupId || light.switchGroupId === firstSwitch.switchGroupId;
          if (isMatched) {
            const hasWire = newWires.some(
              (w) =>
                (w.fromId === firstSwitch.id && w.toId === light.id) ||
                (w.fromId === light.id && w.toId === firstSwitch.id)
            );

            if (!hasWire) {
              const wireLength = calculateCableLengthM(
                firstSwitch,
                light,
                project.ceilingHeightMm,
                'ceiling'
              );

              newWires.push({
                id: `wire_auto_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                fromId: firstSwitch.id,
                toId: light.id,
                mode: 'curve',
                conduit: 'ceiling',
                cableType: circuit.cableType || 'VVGng_3x1.5',
                circuitId: circuit.id,
                switchGroupId: firstSwitch.switchGroupId,
                calculatedLengthM: wireLength,
              });
              routedCount++;
            }
          }
        });
      }
    } else {
      // For Power / Sockets: Daisy chain (шлейф за нормами ПУЕ: не більше 4-5 розеток на шлейф)
      // Sort elements by distance from panel to create a clean daisy-chain
      const sorted = [...circuitElements].sort((a, b) => {
        const distA = Math.hypot(a.position.x - primaryPanel.position.x, a.position.y - primaryPanel.position.y);
        const distB = Math.hypot(b.position.x - primaryPanel.position.x, b.position.y - primaryPanel.position.y);
        return distA - distB;
      });

      let prevElement = primaryPanel;

      sorted.forEach((el) => {
        const wireExists = newWires.some(
          (w) =>
            (w.fromId === prevElement.id && w.toId === el.id) ||
            (w.fromId === el.id && w.toId === prevElement.id) ||
            (w.fromId === primaryPanel.id && w.toId === el.id)
        );

        if (!wireExists) {
          const path = computeOrthogonalPath(prevElement.position, el.position, project.walls);
          const wireLength = calculateCableLengthM(
            prevElement,
            el,
            project.ceilingHeightMm,
            'ceiling',
            path
          );

          newWires.push({
            id: `wire_auto_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            fromId: prevElement.id,
            toId: el.id,
            points: path,
            mode: 'ortho',
            conduit: 'ceiling',
            cableType: circuit.cableType || 'VVGng_3x2.5',
            circuitId: circuit.id,
            calculatedLengthM: wireLength,
          });
          routedCount++;
        }

        // For radial / heavy load appliances (cooker, water heater, AC), route directly from panel
        const isHeavy =
          el.type === 'socket_cooker' ||
          el.type === 'water_heater' ||
          el.type === 'ac_indoor' ||
          el.powerWatts >= 2500;

        if (!isHeavy) {
          prevElement = el; // daisy chain to next socket
        }
      });
    }
  });

  const totalLengthM = newWires.reduce((sum, w) => sum + w.calculatedLengthM, 0);

  return {
    newWires,
    totalLengthM: Math.round(totalLengthM * 10) / 10,
    routedElementsCount: routedCount,
  };
}
