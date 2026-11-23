import { Room, Point, ElectricalElement, Wall, WallOpening, WireRoute } from '../types/cad';
import { isPointInPolygon } from './roomGeometry';
import { getRotationForInwardNormal } from './cadMath';

/**
 * Норми освітленості за ДБН В.2.5-28:2018 «Природне і штучне освітлення»
 * Таблиця 4.1, Таблиця Л.1 (Житлові та громадські будівлі)
 */
export interface LightingNorm {
  minLux: number;
  recommendedLux: number;
  description: string;
  planeHeightMm: number; // площина нормування (0 для підлоги, 800 для столу)
}

export const DBN_LIGHTING_NORMS: Record<Room['type'] | 'default', LightingNorm> = {
  living: {
    minLux: 150,
    recommendedLux: 200,
    description: 'Житлова кімната, вітальня (ДБН В.2.5-28:2018, Табл. Л.1)',
    planeHeightMm: 800,
  },
  bedroom: {
    minLux: 150,
    recommendedLux: 150,
    description: 'Спальня (загальне розсіяне світло)',
    planeHeightMm: 800,
  },
  kitchen: {
    minLux: 150,
    recommendedLux: 250,
    description: 'Кухня (загальне 150 лк, робоча стільниця 300 лк)',
    planeHeightMm: 850,
  },
  bathroom: {
    minLux: 150,
    recommendedLux: 200,
    description: 'Ванна кімната / санвузол (біля дзеркала 300 лк)',
    planeHeightMm: 800,
  },
  office: {
    minLux: 300,
    recommendedLux: 400,
    description: 'Робочий кабінет, стіл школяра/студента (ДБН 300 лк)',
    planeHeightMm: 800,
  },
  hallway: {
    minLux: 100,
    recommendedLux: 150,
    description: 'Коридор, передпокій, гардероб (підлога)',
    planeHeightMm: 0,
  },
  utility: {
    minLux: 100,
    recommendedLux: 150,
    description: 'Комора, пральня, технічне приміщення',
    planeHeightMm: 0,
  },
  balcony: {
    minLux: 100,
    recommendedLux: 100,
    description: 'Балкон, лоджія, тераса',
    planeHeightMm: 0,
  },
  outdoor: {
    minLux: 50,
    recommendedLux: 75,
    description: 'Вхідна група, ганок, фасад',
    planeHeightMm: 0,
  },
  other: {
    minLux: 150,
    recommendedLux: 150,
    description: 'Універсальне приміщення',
    planeHeightMm: 800,
  },
  default: {
    minLux: 150,
    recommendedLux: 200,
    description: 'Стандартне приміщення',
    planeHeightMm: 800,
  },
};

/**
 * Типові джерела світла та їх характеристики
 */
export interface FixturePreset {
  id: string;
  name: string;
  type: 'light_spot' | 'light_pendant' | 'light_track' | 'light_led_strip';
  powerWatts: number;
  luminousFluxLm: number;
  colorTempK: 3000 | 4000;
  cri: number;
  beamAngleDeg: number;
  description: string;
}

export const FIXTURE_PRESETS: FixturePreset[] = [
  {
    id: 'spot_7w_4000k',
    name: 'Врізний LED спот 7W (4000K)',
    type: 'light_spot',
    powerWatts: 7,
    luminousFluxLm: 650,
    colorTempK: 4000,
    cri: 85,
    beamAngleDeg: 60,
    description: 'Компактний врізний світильник для гіпсокартону/натяжної стелі',
  },
  {
    id: 'spot_10w_3000k',
    name: 'Врізний LED спот 10W (3000K)',
    type: 'light_spot',
    powerWatts: 10,
    luminousFluxLm: 950,
    colorTempK: 3000,
    cri: 90,
    beamAngleDeg: 75,
    description: 'Яскравий спот із м’яким теплим світлом',
  },
  {
    id: 'downlight_15w_4000k',
    name: 'LED Downlight панель 15W',
    type: 'light_spot',
    powerWatts: 15,
    luminousFluxLm: 1400,
    colorTempK: 4000,
    cri: 82,
    beamAngleDeg: 110,
    description: 'Ширококутна розсіювальна панель',
  },
  {
    id: 'pendant_chandelier_45w',
    name: 'Центральна люстра 45W',
    type: 'light_pendant',
    powerWatts: 45,
    luminousFluxLm: 4200,
    colorTempK: 3000,
    cri: 92,
    beamAngleDeg: 160,
    description: 'Основне декоративне освітлення центру кімнати',
  },
  {
    id: 'track_light_20w',
    name: 'Трековий світильник 20W',
    type: 'light_track',
    powerWatts: 20,
    luminousFluxLm: 1850,
    colorTempK: 4000,
    cri: 90,
    beamAngleDeg: 38,
    description: 'Акцентне та зональне освітлення на шинопроводі',
  },
];

/**
 * Розрахунок коефіцієнта використання (КВ) методом індексу приміщення
 * i = (a * b) / (h_p * (a + b))
 */
export function calculateRoomIndex(widthM: number, lengthM: number, mountingHeightM: number, planeHeightM = 0.8): number {
  const hp = Math.max(0.5, mountingHeightM - planeHeightM);
  if (widthM <= 0 || lengthM <= 0) return 1.0;
  return (widthM * lengthM) / (hp * (widthM + lengthM));
}

/**
 * Оцінка коефіцієнта використання світлового потоку eta (КВ)
 * для типових поверхонь житлових приміщень (стеля 70%, стіни 50%, підлога 20%)
 */
export function estimateUtilizationFactor(roomIndex: number): number {
  if (roomIndex <= 0.6) return 0.32;
  if (roomIndex <= 0.8) return 0.39;
  if (roomIndex <= 1.0) return 0.46;
  if (roomIndex <= 1.25) return 0.52;
  if (roomIndex <= 1.5) return 0.56;
  if (roomIndex <= 2.0) return 0.62;
  if (roomIndex <= 3.0) return 0.68;
  return 0.73;
}

export interface LightingCalculationResult {
  roomAreaM2: number;
  targetLux: number;
  totalRequiredLumens: number;
  recommendedFixturesCount: number;
  totalPowerWatts: number;
  achievedLux: number;
  utilizationFactor: number;
  roomIndex: number;
  normReference: string;
}

/**
 * Розрахунок необхідної кількості світильників методом КВ за ДБН
 */
export function calculateRoomLighting(
  room: Room,
  fixture: FixturePreset,
  ceilingHeightMm = 2700,
  customTargetLux?: number,
  safetyFactorK = 1.3, // Коефіцієнт запасу (ДБН В.2.5-28:2018 табл. 4.3 для LED)
  uniformityZ = 1.15  // Коефіцієнт нерівномірності
): LightingCalculationResult {
  const norm = DBN_LIGHTING_NORMS[room.type] || DBN_LIGHTING_NORMS.default;
  const targetLux = customTargetLux || norm.recommendedLux;

  // Оцінка габаритів приміщення з полігону
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pt of room.points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  const widthM = Math.max(1, (maxX - minX) / 100); // 10px = 100mm -> 1px = 10mm
  const lengthM = Math.max(1, (maxY - minY) / 100);
  const ceilingM = ceilingHeightMm / 1000;
  const planeM = norm.planeHeightMm / 1000;

  const roomIndex = calculateRoomIndex(widthM, lengthM, ceilingM, planeM);
  const eta = estimateUtilizationFactor(roomIndex);

  // Формула: Phi_total = (E * S * k * z) / eta
  const area = Math.max(1, room.areaM2);
  const totalRequiredLumens = Math.round((targetLux * area * safetyFactorK * uniformityZ) / eta);

  const rawCount = totalRequiredLumens / fixture.luminousFluxLm;
  const recommendedFixturesCount = Math.max(1, Math.round(rawCount));

  const totalLumens = recommendedFixturesCount * fixture.luminousFluxLm;
  const achievedLux = Math.round((totalLumens * eta) / (area * safetyFactorK * uniformityZ));
  const totalPowerWatts = recommendedFixturesCount * fixture.powerWatts;

  return {
    roomAreaM2: area,
    targetLux,
    totalRequiredLumens,
    recommendedFixturesCount,
    totalPowerWatts,
    achievedLux,
    utilizationFactor: Math.round(eta * 100) / 100,
    roomIndex: Math.round(roomIndex * 100) / 100,
    normReference: norm.description,
  };
}

export type LightingLayoutScheme = 'grid_spots' | 'chandelier_with_perimeter' | 'linear_tracks';

export interface GeneratedLightingLayout {
  fixtures: ElectricalElement[];
  switchElement?: ElectricalElement;
  wireRoutes: WireRoute[];
}

/**
 * Авторозстановка світильників та прив'язка до настінного вимикача
 */
export function generateLightingLayout(
  room: Room,
  fixture: FixturePreset,
  scheme: LightingLayoutScheme,
  fixturesCount: number,
  allWalls: Wall[],
  allOpenings: WallOpening[],
  ceilingHeightMm = 2700
): GeneratedLightingLayout {
  // 1. Обчислення меж полігону кімнати
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let sumX = 0, sumY = 0;
  for (const pt of room.points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
    sumX += pt.x;
    sumY += pt.y;
  }
  const centroid: Point = {
    x: Math.round(sumX / room.points.length),
    y: Math.round(sumY / room.points.length),
  };

  const fixtures: ElectricalElement[] = [];
  const switchGroupId = `L_${room.id.slice(-4)}`;
  const roomKey = room.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6) || 'rm';
  const genId = (prefix: string, sub: string | number) =>
    `${prefix}_${roomKey}_${Date.now()}_${sub}_${Math.random().toString(36).substring(2, 7)}`;

  if (scheme === 'chandelier_with_perimeter' && fixturesCount > 1) {
    // Центральна люстра
    const chandelierId = genId('light', 'ch_0');
    fixtures.push({
      id: chandelierId,
      category: 'light',
      type: 'light_pendant',
      name: `Люстра (${room.name})`,
      position: centroid,
      rotation: 0,
      mountingHeightMm: ceilingHeightMm - 400,
      powerWatts: 45,
      switchGroupId,
      ipRating: room.type === 'bathroom' ? 'IP44' : 'IP20',
      label: `Гр.Осв [${switchGroupId}]`,
    });

    // Периметральні споти по 4 кутах із відступом 600 мм
    const perimeterCount = Math.max(2, fixturesCount - 1);
    const margin = 60; // 600 mm в координатах CAD (scale 0.1, 10mm = 1px)
    const candidates: Point[] = [
      { x: minX + margin, y: minY + margin },
      { x: maxX - margin, y: minY + margin },
      { x: maxX - margin, y: maxY - margin },
      { x: minX + margin, y: maxY - margin },
    ];

    candidates.slice(0, perimeterCount).forEach((pt, idx) => {
      if (isPointInPolygon(pt, room.points)) {
        fixtures.push({
          id: genId('light', `spot_${idx + 1}`),
          category: 'light',
          type: 'light_spot',
          name: `Спот кутовий ${idx + 1}`,
          position: pt,
          rotation: 0,
          mountingHeightMm: ceilingHeightMm,
          powerWatts: fixture.powerWatts,
          switchGroupId,
          ipRating: room.type === 'bathroom' ? 'IP44' : 'IP20',
          label: `Гр.Осв [${switchGroupId}]`,
        });
      }
    });
  } else if (scheme === 'linear_tracks') {
    // Лінійна трекова система вздовж довшої осі приміщення
    const dx = maxX - minX;
    const dy = maxY - minY;
    const count = Math.max(2, fixturesCount);
    const isHorizontal = dx >= dy;

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const pt: Point = isHorizontal
        ? { x: Math.round(minX + 40 + t * (dx - 80)), y: centroid.y }
        : { x: centroid.x, y: Math.round(minY + 40 + t * (dy - 80)) };

      if (isPointInPolygon(pt, room.points)) {
        fixtures.push({
          id: genId('light', `trk_${i + 1}`),
          category: 'light',
          type: 'light_track',
          name: `Трековий світильник ${i + 1}`,
          position: pt,
          rotation: isHorizontal ? 0 : 90,
          mountingHeightMm: ceilingHeightMm,
          powerWatts: fixture.powerWatts,
          switchGroupId,
          ipRating: room.type === 'bathroom' ? 'IP44' : 'IP20',
          label: `Гр.Осв [${switchGroupId}]`,
        });
      }
    }
  } else {
    // Рівномірна прямокутна матриця спотів (grid_spots)
    // Визначення Nx та Ny
    const dx = Math.max(10, maxX - minX);
    const dy = Math.max(10, maxY - minY);
    const aspect = dx / dy;

    let nx = Math.max(1, Math.round(Math.sqrt(fixturesCount * aspect)));
    let ny = Math.max(1, Math.round(fixturesCount / nx));
    if (nx * ny < fixturesCount) nx += 1;

    let placed = 0;
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        if (placed >= fixturesCount) break;
        const posX = Math.round(minX + ((ix + 0.5) / nx) * dx);
        const posY = Math.round(minY + ((iy + 0.5) / ny) * dy);
        const pt = { x: posX, y: posY };

        // Перевірка знаходження всередині кімнати
        if (isPointInPolygon(pt, room.points)) {
          fixtures.push({
            id: genId('light', `grid_${placed + 1}`),
            category: 'light',
            type: fixture.type,
            name: `${fixture.name} #${placed + 1}`,
            position: pt,
            rotation: 0,
            mountingHeightMm: ceilingHeightMm,
            powerWatts: fixture.powerWatts,
            switchGroupId,
            ipRating: room.type === 'bathroom' ? 'IP44' : 'IP20',
            label: `Гр.Осв [${switchGroupId}]`,
          });
          placed++;
        }
      }
    }
  }

  // Якщо через складну геометрію не вдалося поставити точки - гарантуємо хоча б 1 в центроїді
  if (fixtures.length === 0) {
    fixtures.push({
      id: genId('light', 'ctr'),
      category: 'light',
      type: fixture.type,
      name: `${fixture.name} (Центр)`,
      position: centroid,
      rotation: 0,
      mountingHeightMm: ceilingHeightMm,
      powerWatts: fixture.powerWatts,
      switchGroupId,
      ipRating: room.type === 'bathroom' ? 'IP44' : 'IP20',
      label: `Гр.Осв [${switchGroupId}]`,
    });
  }

  // 2. Встановлення настінного вимикача за ПУЕ §7.1.50 (біля ручки дверей на висоті +900 мм)
  // Шукаємо двері, що належать контуру кімнати
  let targetDoor: WallOpening | undefined;
  let targetWall: Wall | undefined;

  for (const op of allOpenings) {
    if (op.type === 'door') {
      const wall = allWalls.find((w) => w.id === op.wallId);
      if (wall) {
        // Перевіряємо близькість стіни до полігону кімнати
        const midX = (wall.start.x + wall.end.x) / 2;
        const midY = (wall.start.y + wall.end.y) / 2;
        if (minX - 30 <= midX && midX <= maxX + 30 && minY - 30 <= midY && midY <= maxY + 30) {
          targetDoor = op;
          targetWall = wall;
          break;
        }
      }
    }
  }

  let switchElement: ElectricalElement | undefined;
  if (targetWall && targetDoor) {
    // Вектор стіни
    const wx = targetWall.end.x - targetWall.start.x;
    const wy = targetWall.end.y - targetWall.start.y;
    const wLen = Math.sqrt(wx * wx + wy * wy);
    const uX = wx / wLen;
    const uY = wy / wLen;

    // Нормаль стіни всередину кімнати
    let nX = -uY;
    let nY = uX;
    const testInside: Point = {
      x: centroid.x,
      y: centroid.y,
    };
    // Перевіряємо напрямок нормалі в бік центроїда кімнати
    const toCentroidX = centroid.x - targetWall.start.x;
    const toCentroidY = centroid.y - targetWall.start.y;
    if (nX * toCentroidX + nY * toCentroidY < 0) {
      nX = -nX;
      nY = -nY;
    }

    // Відступ 150 мм від укосу дверей (15px)
    const doorCenterDist = targetDoor.positionRatio * wLen;
    const doorHalfWidth = (targetDoor.width / 10) / 2;
    const offsetFromJamb = doorHalfWidth + 15; // 150mm

    let switchDist = doorCenterDist + offsetFromJamb;
    if (switchDist > wLen - 15) {
      switchDist = Math.max(15, doorCenterDist - offsetFromJamb);
    }

    const swPos: Point = {
      x: Math.round(targetWall.start.x + uX * switchDist + nX * 6),
      y: Math.round(targetWall.start.y + uY * switchDist + nY * 6),
    };

    const rotation = getRotationForInwardNormal({ x: nX, y: nY }, true);

    switchElement = {
      id: genId('switch', 'sw'),
      category: 'switch',
      type: fixtures.length > 3 ? 'switch_2g' : 'switch_1g',
      name: `Вимикач світла (${room.name})`,
      position: swPos,
      rotation,
      wallId: targetWall.id,
      mountingHeightMm: 900,
      powerWatts: 0,
      switchGroupId,
      ipRating: room.type === 'bathroom' ? 'IP44' : 'IP20',
      label: `SW [${switchGroupId}]`,
      notes: 'Монтаж 150 мм від укосу дверей за ПУЕ §7.1.50',
    };
  } else {
    // Якщо дверей немає на стіні — ставимо вимикач біля першої стіни
    const defaultWall = allWalls[0];
    if (defaultWall) {
      switchElement = {
        id: genId('switch', 'sw_def'),
        category: 'switch',
        type: 'switch_1g',
        name: `Вимикач світла (${room.name})`,
        position: { x: minX + 20, y: minY + 20 },
        rotation: 0,
        mountingHeightMm: 900,
        powerWatts: 0,
        switchGroupId,
        ipRating: 'IP20',
        label: `SW [${switchGroupId}]`,
      };
    }
  }

  // 3. З'єднувальні траси між вимикачем та світильниками
  const wireRoutes: WireRoute[] = [];
  if (switchElement && fixtures.length > 0) {
    // Траса від вимикача до першого світильника
    wireRoutes.push({
      id: genId('wire_sw', '0'),
      fromId: switchElement.id,
      toId: fixtures[0].id,
      mode: 'ortho',
      conduit: 'ceiling',
      cableType: 'VVGng_3x1.5',
      switchGroupId,
      calculatedLengthM: Math.round(
        (Math.hypot(fixtures[0].position.x - switchElement.position.x, fixtures[0].position.y - switchElement.position.y) * 0.01 +
          (ceilingHeightMm - 900) / 1000) * 10
      ) / 10,
    });

    // Шлейф між послідовними світильниками
    for (let i = 0; i < fixtures.length - 1; i++) {
      const f1 = fixtures[i];
      const f2 = fixtures[i + 1];
      wireRoutes.push({
        id: genId('wire_light', i),
        fromId: f1.id,
        toId: f2.id,
        mode: 'ortho',
        conduit: 'ceiling',
        cableType: 'VVGng_3x1.5',
        switchGroupId,
        calculatedLengthM: Math.round(
          Math.hypot(f2.position.x - f1.position.x, f2.position.y - f1.position.y) * 0.01 * 10
        ) / 10,
      });
    }
  }

  return {
    fixtures,
    switchElement,
    wireRoutes,
  };
}
