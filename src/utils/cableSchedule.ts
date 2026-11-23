import { CadProject, CircuitGroup } from '../types/cad';
import { getAggregatedProjectData, FloorTaggedElement } from './projectAggregator';

export interface CableScheduleEntry {
  id: string;
  cableTag: string; // e.g. "W1-01"
  circuitNumber: number;
  circuitName: string;
  sourceName: string; // e.g. "ЩР-1, QF1 (16A)"
  destinationName: string; // e.g. "Кухня, Блок розеток"
  roomName: string;
  floorName?: string;
  cableSpec: string; // "ВВГнгд 3х2.5"
  coresAndSize: string; // "3 × 2.5 мм²"
  conduitType: string; // "Гофра ПВХ D=20мм (стеля)"
  horizontalLengthM: number;
  verticalDropsM: number;
  terminationReserveM: number;
  totalDesignLengthM: number;
  procurementLengthM: number;
}

export interface CableScheduleSummary {
  entries: CableScheduleEntry[];
  totalLengthM: number;
  byCableType: {
    spec: string;
    totalLengthM: number;
    procurementM: number;
  }[];
  byConduitType: {
    type: string;
    totalM: number;
  }[];
}

function resolveCableSpecDisplay(cableType: string): { spec: string; coresAndSize: string } {
  switch (cableType) {
    case 'VVGng_3x1.5':
      return { spec: 'ВВГнгд 3х1.5', coresAndSize: '3 × 1.5 мм²' };
    case 'VVGng_3x4':
      return { spec: 'ВВГнгд 3х4', coresAndSize: '3 × 4.0 мм²' };
    case 'VVGng_3x6':
      return { spec: 'ВВГнгд 3х6', coresAndSize: '3 × 6.0 мм²' };
    case 'VVGng_5x2.5':
      return { spec: 'ВВГнгд 5х2.5', coresAndSize: '5 × 2.5 мм²' };
    case 'VVGng_5x4':
      return { spec: 'ВВГнгд 5х4', coresAndSize: '5 × 4.0 мм²' };
    case 'VVGng_5x6':
      return { spec: 'ВВГнгд 5х6', coresAndSize: '5 × 6.0 мм²' };
    case 'VVGng_5x10':
      return { spec: 'ВВГнгд 5х10', coresAndSize: '5 × 10.0 мм²' };
    case 'FTP_Cat5e':
      return { spec: 'FTP Cat5e 4x2x0.51', coresAndSize: '4 × 2 × 0.51 мм' };
    case 'KNX_Bus':
      return { spec: 'KNX Bus EIB-Y(St)Y', coresAndSize: '2 × 2 × 0.8 мм' };
    default:
      return { spec: 'ВВГнгд 3х2.5', coresAndSize: '3 × 2.5 мм²' };
  }
}

export function generateCableSchedule(project: CadProject): CableScheduleSummary {
  const entries: CableScheduleEntry[] = [];
  const aggregated = getAggregatedProjectData(project);

  // Карта елементів для швидкого пошуку по всіх поверхах
  const elementMap = new Map<string, FloorTaggedElement>();
  aggregated.allElements.forEach((el) => elementMap.set(el.id, el));

  // Карта груп щита
  const circuitMap = new Map<string, CircuitGroup>();
  project.circuits.forEach((c) => circuitMap.set(c.id, c));

  let routeCounter = 1;

  // 1. Міжповерхові стояки живлення (ВРП -> ЩР-2, ЩР-3...)
  aggregated.riserFeeders.forEach((riser, idx) => {
    const { spec, coresAndSize } = resolveCableSpecDisplay(riser.cableType);
    const reserveM = Math.round(riser.lengthM * 0.12 * 10) / 10;
    const totalDesignLengthM = Math.round((riser.lengthM + reserveM) * 10) / 10;
    const targetFloor = aggregated.syncedFloors.find((f) => f.id === riser.floorId);

    entries.push({
      id: riser.id,
      cableTag: `M0-${(idx + 1).toString().padStart(2, '0')}`,
      circuitNumber: 0,
      circuitName: `Магістральний стояк (${riser.fromBoard} ➔ ${riser.toBoard})`,
      sourceName: `${riser.fromBoard}, QF-M${idx + 1} (${riser.breakerRatingA}A)`,
      destinationName: `Поверховий щит ${riser.toBoard}`,
      roomName: targetFloor?.name || 'Коридор / Шахта',
      floorName: targetFloor?.name,
      cableSpec: spec,
      coresAndSize,
      conduitType: 'Гофротруба важка ПНД d=32мм у стояку',
      horizontalLengthM: 2.0,
      verticalDropsM: Math.max(0.5, Number((riser.lengthM - 2.0).toFixed(1))),
      terminationReserveM: reserveM,
      totalDesignLengthM,
      procurementLengthM: Math.ceil(totalDesignLengthM),
    });
  });

  // 2. Внутрішні кабельні траси по всіх поверхах
  aggregated.allWires.forEach((wire) => {
    const fromEl = elementMap.get(wire.fromId);
    const toEl = elementMap.get(wire.toId);
    const floorObj = aggregated.syncedFloors.find((f) => f.id === wire.floorId);
    const ceilingHeightM = ((floorObj?.ceilingHeightMm || project.ceilingHeightMm || 2700)) / 1000;

    const circuit = wire.circuitId
      ? circuitMap.get(wire.circuitId)
      : fromEl?.circuitId
      ? circuitMap.get(fromEl.circuitId)
      : undefined;

    const circuitNumber = circuit ? circuit.number : 1;
    const circuitName = circuit ? circuit.name : 'Група ' + circuitNumber;

    // Джерело (From)
    let sourceName = `${wire.boardName || 'ЩР'}`;
    if (fromEl) {
      if (fromEl.type.includes('panel')) {
        sourceName = `${fromEl.name} (QF${circuitNumber})`;
      } else {
        sourceName = fromEl.name;
      }
    }

    // Призначення (To)
    let destinationName = 'Споживач';
    let roomName = wire.floorName || 'Приміщення';
    if (toEl) {
      destinationName = toEl.name;
      const floorRooms = aggregated.allRooms.filter((rm) => rm.floorId === wire.floorId);
      const r = floorRooms.find((rm) => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const pt of rm.points) {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
        return (
          toEl.position.x >= minX - 10 &&
          toEl.position.x <= maxX + 10 &&
          toEl.position.y >= minY - 10 &&
          toEl.position.y <= maxY + 10
        );
      });
      if (r) {
        roomName = aggregated.syncedFloors.length > 1 ? `${wire.floorName} · ${r.name}` : r.name;
      }
    }

    const { spec: cableSpec, coresAndSize } = resolveCableSpecDisplay(wire.cableType);

    // Спосіб прокладання
    let conduitType = 'Гофротруба ПВХ d=20мм по стелі';
    if (wire.conduit === 'wall_chase') {
      conduitType = 'У штробі стіни під штукатурку';
    } else if (wire.conduit === 'floor') {
      conduitType = 'Труба ПНД важка d=25мм у стяжці';
    }

    // Довжина по горизонталі (м)
    const horizM = wire.calculatedLengthM > 0
      ? wire.calculatedLengthM
      : fromEl && toEl
      ? Math.round(Math.hypot(toEl.position.x - fromEl.position.x, toEl.position.y - fromEl.position.y) * 0.01 * 10) / 10
      : 3.5;

    // Вертикальні опусти/підйоми (м)
    const fromHeightM = (fromEl?.mountingHeightMm || 1500) / 1000;
    const toHeightM = (toEl?.mountingHeightMm || 300) / 1000;
    const vertM = Math.round((Math.max(0, ceilingHeightM - fromHeightM) + Math.max(0, ceilingHeightM - toHeightM)) * 10) / 10;

    // Технологічний запас (+12% на оброблення у підрозетнику/щиті)
    const baseLength = horizM + vertM;
    const reserveM = Math.round(baseLength * 0.12 * 10) / 10;
    const totalDesignLengthM = Math.round((baseLength + reserveM) * 10) / 10;
    const procurementLengthM = Math.ceil(totalDesignLengthM);

    const cableTag = wire.cableTag || `W${circuitNumber}-${routeCounter.toString().padStart(2, '0')}`;
    routeCounter++;

    entries.push({
      id: wire.id,
      cableTag,
      circuitNumber,
      circuitName,
      sourceName,
      destinationName,
      roomName,
      floorName: wire.floorName,
      cableSpec,
      coresAndSize,
      conduitType,
      horizontalLengthM: horizM,
      verticalDropsM: vertM,
      terminationReserveM: reserveM,
      totalDesignLengthM,
      procurementLengthM,
    });
  });

  // Якщо прокладених трас немає — формуємо журнал за елементами з усіх поверхів
  if (aggregated.allWires.length === 0) {
    aggregated.allElements.forEach((el, idx) => {
      if (el.category === 'panel') return;
      const floorObj = aggregated.syncedFloors.find((f) => f.id === el.floorId);
      const ceilingHeightM = ((floorObj?.ceilingHeightMm || project.ceilingHeightMm || 2700)) / 1000;
      const circuit = el.circuitId ? circuitMap.get(el.circuitId) : undefined;
      const circuitNumber = circuit ? circuit.number : 1;
      const circuitName = circuit ? circuit.name : 'Група ' + circuitNumber;

      const defaultCableType = circuit?.cableType || (el.category === 'light' || el.category === 'switch' ? 'VVGng_3x1.5' : 'VVGng_3x2.5');
      const { spec: cableSpec, coresAndSize } = resolveCableSpecDisplay(defaultCableType);

      const horizM = 4.5 + (idx % 5);
      const vertM = Math.round((ceilingHeightM - (el.mountingHeightMm || 300) / 1000 + 1.2) * 10) / 10;
      const reserveM = Math.round((horizM + vertM) * 0.12 * 10) / 10;
      const totalDesignLengthM = Math.round((horizM + vertM + reserveM) * 10) / 10;

      entries.push({
        id: `gen_cable_${el.id}_${idx}`,
        cableTag: `W${circuitNumber}-${(idx + 1).toString().padStart(2, '0')}`,
        circuitNumber,
        circuitName,
        sourceName: `${el.boardName} (QF${circuitNumber})`,
        destinationName: el.name,
        roomName: el.floorName || 'Приміщення',
        floorName: el.floorName,
        cableSpec,
        coresAndSize,
        conduitType: 'Гофротруба ПВХ d=20мм по стелі',
        horizontalLengthM: horizM,
        verticalDropsM: vertM,
        terminationReserveM: reserveM,
        totalDesignLengthM,
        procurementLengthM: Math.ceil(totalDesignLengthM),
      });
    });
  }

  // Зведені дані
  const totalLengthM = entries.reduce((s, e) => s + e.totalDesignLengthM, 0);

  const byCableMap = new Map<string, { total: number; proc: number }>();
  const byConduitMap = new Map<string, number>();

  entries.forEach((e) => {
    const prevC = byCableMap.get(e.cableSpec) || { total: 0, proc: 0 };
    byCableMap.set(e.cableSpec, {
      total: prevC.total + e.totalDesignLengthM,
      proc: prevC.proc + e.procurementLengthM,
    });

    const prevCond = byConduitMap.get(e.conduitType) || 0;
    byConduitMap.set(e.conduitType, prevCond + e.totalDesignLengthM);
  });

  const byCableType = Array.from(byCableMap.entries()).map(([spec, data]) => ({
    spec,
    totalLengthM: Math.round(data.total * 10) / 10,
    procurementM: data.proc,
  }));

  const byConduitType = Array.from(byConduitMap.entries()).map(([type, totalM]) => ({
    type,
    totalM: Math.round(totalM * 10) / 10,
  }));

  return {
    entries,
    totalLengthM: Math.round(totalLengthM * 10) / 10,
    byCableType,
    byConduitType,
  };
}

