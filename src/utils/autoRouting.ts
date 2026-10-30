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

