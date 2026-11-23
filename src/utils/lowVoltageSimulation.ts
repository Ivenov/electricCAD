import { CadProject, ElectricalElement, Wall, Point } from '../types/cad';

export interface WifiHeatmapPoint {
  x: number;
  y: number;
  rssiDbm: number; // e.g. -45 dBm
  color: string;
}

export interface CctvFovCone {
  cameraId: string;
  cameraName: string;
  origin: Point;
  points: Point[]; // polygon points of the visible cone
  angleDeg: number;
  rangeM: number;
  rotationDeg: number;
}

/**
 * Перевірка перетину двох відрізків (p1-p2 та p3-p4)
 */
function lineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
  const d2 = (p4.x - p3.x) * (p2.y - p3.y) - (p4.y - p3.y) * (p2.x - p3.x);
  const d3 = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
  const d4 = (p2.x - p1.x) * (p4.y - p1.y) - (p2.y - p1.y) * (p4.x - p1.x);

  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * Мапа кольорів за рівнем сигналу RSSI (дБм)
 */
export function getRssiColor(rssiDbm: number): string {
  if (rssiDbm >= -55) return '#22c55e'; // зелений: відмінний (>300 Мбіт/с)
  if (rssiDbm >= -65) return '#06b6d4'; // блакитний: добрий (>150 Мбіт/с)
  if (rssiDbm >= -75) return '#eab308'; // жовтий: задовільний
  if (rssiDbm >= -82) return '#f97316'; // помаранчевий: слабкий
  return '#ef4444'; // червоний: мертва зона (< -82 дБм)
}

/**
 * Симуляція поширення радіосигналу Wi-Fi (2.4 / 5 ГГц)
 * Модель FSPL + WAF (Wall Attenuation Factor)
 */
export function calculateWifiHeatmap(
  project: CadProject,
  gridStepPx = 25, // 25 px = 250 мм у CAD масштабі 0.1
  frequencyGhz = 2.4
): WifiHeatmapPoint[] {
  // Знаходимо всі точки доступу або Wi-Fi роутери
  const apElements = project.elements.filter(
    (el) =>
      el.type === 'wifi_ap' ||
      el.type === 'socket_rj45' ||
      el.type === 'panel_multimedia' ||
      el.name.toLowerCase().includes('wifi') ||
      el.name.toLowerCase().includes('роутер')
  );

  if (apElements.length === 0) return [];

  // Межі плану приміщення
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  project.walls.forEach((w) => {
    minX = Math.min(minX, w.start.x, w.end.x);
    maxX = Math.max(maxX, w.start.x, w.end.x);
    minY = Math.min(minY, w.start.y, w.end.y);
    maxY = Math.max(maxY, w.start.y, w.end.y);
  });

  if (!isFinite(minX)) {
    minX = 0; maxX = 800; minY = 0; maxY = 600;
  } else {
    minX -= 40; maxX += 40; minY -= 40; maxY += 40;
  }

  const freqMhz = frequencyGhz === 5 ? 5200 : 2400;
  const heatmap: WifiHeatmapPoint[] = [];

  for (let x = minX; x <= maxX; x += gridStepPx) {
    for (let y = minY; y <= maxY; y += gridStepPx) {
      const cellPoint: Point = { x, y };

      // Знаходимо найкращий сигнал від найближчої AP
      let bestRssi = -100;

      for (const ap of apElements) {
        const txPowerDbm = ap.wifiTxPowerDbm || 20; // 20 dBm (100 мВт)
        const distPx = Math.hypot(x - ap.position.x, y - ap.position.y);
        const distM = Math.max(0.5, distPx * 0.01); // 1px = 10mm = 0.01m

        // Вільне затухання FSPL
        const fspl = 20 * Math.log10(distM) + 20 * Math.log10(freqMhz) - 27.55;

        // Затухання у стінах на шляху променя
        let wallLoss = 0;
        for (const wall of project.walls) {
          if (lineSegmentsIntersect(ap.position, cellPoint, wall.start, wall.end)) {
            // Перегородка: -4 дБ, несуча стіна: -12 дБ
            const isBearing = wall.type === 'bearing' || wall.thickness >= 200;
            wallLoss += isBearing ? 14 : 4.5;
          }
        }

        const rssi = Math.round(txPowerDbm - fspl - wallLoss);
        if (rssi > bestRssi) {
          bestRssi = rssi;
        }
      }

      if (bestRssi > -95) {
        heatmap.push({
          x,
          y,
          rssiDbm: bestRssi,
          color: getRssiColor(bestRssi),
        });
      }
    }
  }

  return heatmap;
}

/**
 * Розрахунок конусів огляду відеокамер CCTV (Field of View - FOV)
 */
export function calculateCctvFovCones(project: CadProject): CctvFovCone[] {
  const cameraElements = project.elements.filter(
    (el) =>
      el.type === 'cctv_camera' ||
      el.name.toLowerCase().includes('камера') ||
      el.name.toLowerCase().includes('cctv')
  );

  return cameraElements.map((cam) => {
    const fovAngle = cam.cctvFovAngleDeg || 90;
    const rangeM = cam.cctvRangeM || 10;
    const rangePx = rangeM * 100; // 1m = 100px в CAD
    const rotDeg = cam.rotation || 0;

    const halfAngleRad = ((fovAngle / 2) * Math.PI) / 180;
    const centerRad = (rotDeg * Math.PI) / 180;

    const numRays = 16;
    const polygonPoints: Point[] = [cam.position];

    for (let i = 0; i <= numRays; i++) {
      const rayAngle = centerRad - halfAngleRad + (i / numRays) * (halfAngleRad * 2);
      let targetX = cam.position.x + Math.cos(rayAngle) * rangePx;
      let targetY = cam.position.y + Math.sin(rayAngle) * rangePx;

      // Перевірка перетину зі стінами (окклюзія зору камери)
      let closestDist = rangePx;
      const rayEnd: Point = { x: targetX, y: targetY };

      for (const wall of project.walls) {
        if (lineSegmentsIntersect(cam.position, rayEnd, wall.start, wall.end)) {
          // Наближена відстань до перетину
          const wallMid: Point = {
            x: (wall.start.x + wall.end.x) / 2,
            y: (wall.start.y + wall.end.y) / 2,
          };
          const d = Math.hypot(wallMid.x - cam.position.x, wallMid.y - cam.position.y);
          if (d < closestDist) {
            closestDist = d;
          }
        }
      }

      polygonPoints.push({
        x: Math.round(cam.position.x + Math.cos(rayAngle) * closestDist),
        y: Math.round(cam.position.y + Math.sin(rayAngle) * closestDist),
      });
    }

    return {
      cameraId: cam.id,
      cameraName: cam.name,
      origin: cam.position,
      points: polygonPoints,
      angleDeg: fovAngle,
      rangeM,
      rotationDeg: rotDeg,
    };
  });
}
