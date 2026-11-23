/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Генератор векторних креслень SVG безпосередньо з моделі проєкту CadProject.
 * Підтримує фільтрацію за аркушами ДСТУ, відображення отворів (дверей/вікон),
 * меблів, ортогональних трас кабелів, розмірних ліній та неперетинних бірок груп.
 */

import { CadProject, ElectricalElement, FloorLevel, WireRoute } from '../types/cad';
import {
  computeCircuitBadgesLayout,
  distance,
  pxToMm,
  MM_PER_PX,
  checkChaseIntersectsOpening,
} from './cadMath';
import { computeOrthogonalPath } from './autoRouting';
import { formatDimensionValue } from './projectAggregator';

export type SvgSheetMode =
  | 'general'
  | 'lighting'
  | 'sockets'
  | 'power'
  | 'wiring'
  | 'low_voltage';

export interface SvgExportOptions {
  mode?: SvgSheetMode;
  showDimensions?: boolean;
  showFurniture?: boolean;
  showCircuitBadges?: boolean;
  showCableTags?: boolean;
  floor?: FloorLevel;
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function shouldIncludeElement(el: ElectricalElement, mode: SvgSheetMode): boolean {
  if (mode === 'general' || mode === 'wiring') return true;
  if (el.category === 'panel') return true;

  if (mode === 'lighting') {
    return el.category === 'light' || el.category === 'switch' || el.category === 'junction';
  }
  if (mode === 'sockets') {
    return el.category === 'socket' || el.category === 'junction';
  }
  if (mode === 'power') {
    return (
      el.category === 'appliance' ||
      el.type === 'socket_3phase' ||
      el.type === 'socket_cooker' ||
      el.type === 'water_heater' ||
      el.type === 'electric_boiler' ||
      el.powerWatts >= 1500
    );
  }
  if (mode === 'low_voltage') {
    return (
      el.type === 'socket_rj45' ||
      el.type === 'socket_tv' ||
      el.type === 'wifi_ap' ||
      el.type === 'cctv_camera' ||
      el.type === 'intercom' ||
      el.type === 'motion_sensor' ||
      el.type === 'light_sensor' ||
      el.type === 'leak_sensor' ||
      el.type === 'water_leak_valve' ||
      el.type === 'thermostat' ||
      el.type === 'knx_actuator' ||
      el.type === 'knx_power_supply' ||
      el.type === 'panel_multimedia'
    );
  }
  return true;
}

function shouldIncludeWire(wire: WireRoute, elements: ElectricalElement[], mode: SvgSheetMode): boolean {
  if (mode === 'general' || mode === 'wiring') return true;

  const isLowVoltage =
    wire.busType === 'ethernet' ||
    wire.busType === 'knx' ||
    wire.cableType === 'FTP_Cat5e' ||
    wire.cableType === 'KNX_Bus';

  if (mode === 'low_voltage') return isLowVoltage;
  if (isLowVoltage) return false;

  const fromEl = elements.find((e) => e.id === wire.fromId);
  const toEl = elements.find((e) => e.id === wire.toId);
  if (!fromEl || !toEl) return false;

  if (mode === 'lighting') {
    return (
      wire.cableType === 'VVGng_3x1.5' ||
      fromEl.category === 'light' ||
      toEl.category === 'light' ||
      fromEl.category === 'switch' ||
      toEl.category === 'switch'
    );
  }
  if (mode === 'power') {
    return (
      wire.cableType === 'VVGng_3x4' ||
      wire.cableType === 'VVGng_3x6' ||
      wire.cableType.startsWith('VVGng_5x') ||
      fromEl.category === 'appliance' ||
      toEl.category === 'appliance'
    );
  }
  if (mode === 'sockets') {
    return (
      fromEl.category === 'socket' ||
      toEl.category === 'socket' ||
      (wire.cableType === 'VVGng_3x2.5' && fromEl.category !== 'light' && toEl.category !== 'light')
    );
  }
  return true;
}

export function generateCadProjectSvg(
  project: CadProject,
  options: SvgExportOptions = {}
): string {
  const mode: SvgSheetMode = options.mode || 'general';
  const showDimensions = options.showDimensions ?? true;
  const showFurniture = options.showFurniture ?? true;
  const showCircuitBadges = options.showCircuitBadges ?? true;
  const showCableTags = options.showCableTags ?? (mode === 'wiring' || mode === 'general');

  const walls = options.floor ? options.floor.walls : project.walls;
  const openings = options.floor ? options.floor.openings : project.openings;
  const rooms = options.floor ? options.floor.rooms : project.rooms;
  const furniture = options.floor ? options.floor.furniture : project.furniture || [];
  const allElements = options.floor ? options.floor.elements : project.elements;
  const allWires = options.floor ? options.floor.wires : project.wires;

  const elements = allElements.filter((el) => shouldIncludeElement(el, mode));
  const wires = allWires.filter((w) => shouldIncludeWire(w, allElements, mode));
  const unit = project.displayUnit || 'mm';

  // Обчислення габаритів креслення
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  walls.forEach((w) => {
    minX = Math.min(minX, w.start.x, w.end.x);
    maxX = Math.max(maxX, w.start.x, w.end.x);
    minY = Math.min(minY, w.start.y, w.end.y);
    maxY = Math.max(maxY, w.start.y, w.end.y);
  });

  allElements.forEach((e) => {
    minX = Math.min(minX, e.position.x);
    maxX = Math.max(maxX, e.position.x);
    minY = Math.min(minY, e.position.y);
    maxY = Math.max(maxY, e.position.y);
  });

  if (!isFinite(minX)) {
    minX = 0;
    maxX = 1200;
    minY = 0;
    maxY = 800;
  }

  const padding = 75;
  const vbX = Math.floor(minX - padding);
  const vbY = Math.floor(minY - padding);
  const vbW = Math.ceil(maxX - minX + padding * 2);
  const vbH = Math.ceil(maxY - minY + padding * 2);

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  <style>
    .cad-bg { fill: #ffffff; }
    .cad-wall { stroke: #1e293b; stroke-linecap: square; }
    .cad-room-fill { fill: #f8fafc; stroke: #cbd5e1; stroke-width: 1px; }
    .cad-furn { fill: #f1f5f9; fill-opacity: 0.7; stroke: #94a3b8; stroke-width: 1px; stroke-dasharray: 3,2; }
    .cad-wire { fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .cad-text { font-family: 'Segoe UI', Arial, sans-serif; }
    .cad-mono { font-family: 'Consolas', 'Courier New', monospace; }
  </style>
  <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" class="cad-bg" />
`;

  // 1. Rooms layer
  if (rooms && rooms.length > 0) {
    svg += '  <g id="rooms">\n';
    rooms.forEach((r) => {
      if (!r.points || r.points.length < 3) return;
      const pts = r.points.map((p) => `${p.x},${p.y}`).join(' ');
      svg += `    <polygon points="${pts}" class="cad-room-fill" />\n`;
      const avgX = r.points.reduce((s, p) => s + p.x, 0) / r.points.length;
      const avgY = r.points.reduce((s, p) => s + p.y, 0) / r.points.length;
      svg += `    <text x="${avgX}" y="${avgY}" font-size="11" font-weight="bold" fill="#475569" text-anchor="middle" class="cad-text">${escapeXml(r.name)} (${r.areaM2} м²)</text>\n`;
    });
    svg += '  </g>\n';
  }

  // 2. Furniture layer
  if (showFurniture && furniture && furniture.length > 0) {
    svg += '  <g id="furniture">\n';
    furniture.forEach((f) => {
      const wPx = f.width / MM_PER_PX;
      const hPx = f.height / MM_PER_PX;
      const rot = f.rotation || 0;
      svg += `    <g transform="translate(${f.position.x}, ${f.position.y}) rotate(${rot})">\n`;
      svg += `      <rect x="${-wPx / 2}" y="${-hPx / 2}" width="${wPx}" height="${hPx}" rx="2" class="cad-furn" />\n`;
      svg += `      <text x="0" y="3" font-size="7" fill="#64748b" text-anchor="middle" class="cad-text">${escapeXml(f.name)}</text>\n`;
      svg += `    </g>\n`;
    });
    svg += '  </g>\n';
  }

  // 3. Walls layer + Dimension Labels
  svg += '  <g id="walls">\n';
  walls.forEach((w) => {
    const strokeW = Math.max(4, (w.thickness || 150) / MM_PER_PX);
    svg += `    <line x1="${w.start.x}" y1="${w.start.y}" x2="${w.end.x}" y2="${w.end.y}" stroke="${w.type === 'bearing' ? '#0f172a' : '#334155'}" stroke-width="${strokeW}" class="cad-wall" />\n`;
    svg += `    <line x1="${w.start.x}" y1="${w.start.y}" x2="${w.end.x}" y2="${w.end.y}" stroke="#64748b" stroke-width="0.8" />\n`;

    if (showDimensions) {
      const lenMm = pxToMm(distance(w.start, w.end));
      if (lenMm > 300) {
        const mx = (w.start.x + w.end.x) / 2;
        const my = (w.start.y + w.end.y) / 2;
        const label = formatDimensionValue(lenMm, unit, true);
        svg += `    <rect x="${mx - 24}" y="${my - 7}" width="48" height="14" rx="2" fill="#ffffff" fill-opacity="0.92" stroke="#94a3b8" stroke-width="0.7" />\n`;
        svg += `    <text x="${mx}" y="${my + 3}" font-size="7.5" font-weight="bold" fill="#0f172a" text-anchor="middle" class="cad-mono">${escapeXml(label)}</text>\n`;
      }
    }
  });
  svg += '  </g>\n';

  // 4. Openings layer (Doors with swing arc & Windows)
  if (openings && openings.length > 0) {
    svg += '  <g id="openings">\n';
    openings.forEach((op) => {
      const wall = walls.find((w) => w.id === op.wallId);
      if (!wall) return;
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;

      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;
      const opW = op.width / MM_PER_PX;
      const wallT = Math.max(6, (wall.thickness || 150) / MM_PER_PX);

      const cx = wall.start.x + dx * op.positionRatio;
      const cy = wall.start.y + dy * op.positionRatio;
      const sx = cx - (ux * opW) / 2;
      const sy = cy - (uy * opW) / 2;
      const ex = cx + (ux * opW) / 2;
      const ey = cy + (uy * opW) / 2;

      // White cutout on wall
      svg += `    <line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#ffffff" stroke-width="${wallT + 2}" />\n`;

      if (op.type === 'door') {
        const swingSign = op.swingDirection === 'out' ? -1 : 1;
        const leafX = sx + nx * opW * swingSign;
        const leafY = sy + ny * opW * swingSign;
        const sweepFlag = swingSign > 0 ? 0 : 1;
        svg += `    <line x1="${sx}" y1="${sy}" x2="${leafX}" y2="${leafY}" stroke="#0284c7" stroke-width="1.8" />\n`;
        svg += `    <path d="M ${leafX} ${leafY} A ${opW} ${opW} 0 0 ${sweepFlag} ${ex} ${ey}" fill="none" stroke="#38bdf8" stroke-width="1" stroke-dasharray="3,2" />\n`;
      } else {
        const half = wallT * 0.3;
        svg += `    <line x1="${sx + nx * half}" y1="${sy + ny * half}" x2="${ex + nx * half}" y2="${ey + ny * half}" stroke="#0284c7" stroke-width="1.2" />\n`;
        svg += `    <line x1="${sx - nx * half}" y1="${sy - ny * half}" x2="${ex - nx * half}" y2="${ey - ny * half}" stroke="#0284c7" stroke-width="1.2" />\n`;
      }
    });
    svg += '  </g>\n';
  }

  // 5. Wires layer (Orthogonal paths + cable tags)
  svg += '  <g id="wires">\n';
  wires.forEach((wire) => {
    const fromEl = allElements.find((e) => e.id === wire.fromId);
    const toEl = allElements.find((e) => e.id === wire.toId);
    if (!fromEl || !toEl) return;

    const circuit = project.circuits.find((c) => c.id === wire.circuitId);
    const strokeColor =
      wire.busType === 'knx'
        ? '#10b981'
        : wire.busType === 'ethernet'
        ? '#06b6d4'
        : circuit?.color || '#0284c7';
    const isLighting = wire.cableType === 'VVGng_3x1.5';
    const strokeDash =
      wire.conduit === 'ceiling'
        ? 'stroke-dasharray="5,3"'
        : wire.conduit === 'floor'
        ? 'stroke-dasharray="2,2"'
        : '';

    const hasExplicitPoints = Boolean(wire.points && wire.points.length >= 2);
    const explicitPointsColliding = hasExplicitPoints && !wire.isManual && checkChaseIntersectsOpening(wire.points!, walls, openings).hasCollision;

    const fullPoints = (hasExplicitPoints && !explicitPointsColliding)
      ? wire.points!
      : computeOrthogonalPath(fromEl.position, toEl.position, walls, openings);

    const d = fullPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    svg += `    <path d="${d}" stroke="${strokeColor}" stroke-width="${isLighting ? 1.8 : 2.3}" ${strokeDash} class="cad-wire" />\n`;

    if (showCableTags && fullPoints.length >= 2) {
      const midIdx = Math.floor((fullPoints.length - 1) / 2);
      const p1 = fullPoints[midIdx];
      const p2 = fullPoints[midIdx + 1] || p1;
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const tag = wire.cableTag ? `${wire.cableTag} (${wire.calculatedLengthM}м)` : `${wire.calculatedLengthM}м`;
      svg += `    <rect x="${mx - 20}" y="${my - 6}" width="40" height="11" rx="2" fill="#ffffff" fill-opacity="0.9" stroke="${strokeColor}" stroke-width="0.6" />\n`;
      svg += `    <text x="${mx}" y="${my + 2.5}" font-size="6.5" font-weight="bold" fill="${strokeColor}" text-anchor="middle" class="cad-mono">${escapeXml(tag)}</text>\n`;
    }
  });
  svg += '  </g>\n';

  // 6. Electrical Elements layer (Standardized DSTU CAD Symbols)
  svg += '  <g id="elements">\n';
  elements.forEach((el) => {
    const x = el.position.x;
    const y = el.position.y;
    const rot = el.rotation || 0;

    svg += `    <g transform="translate(${x}, ${y}) rotate(${rot})">\n`;

    if (el.category === 'socket') {
      svg += `      <path d="M -7 0 A 7 7 0 0 1 7 0" fill="#ffffff" stroke="#0284c7" stroke-width="1.8" />\n`;
      svg += `      <line x1="-8" y1="0" x2="8" y2="0" stroke="#0284c7" stroke-width="1.6" />\n`;
      svg += `      <line x1="0" y1="-7" x2="0" y2="-11" stroke="#0284c7" stroke-width="1.5" />\n`;
      if (el.type === 'socket_double') {
        svg += `      <line x1="-3" y1="-6" x2="-3" y2="-10" stroke="#0284c7" stroke-width="1.3" />\n`;
        svg += `      <line x1="3" y1="-6" x2="3" y2="-10" stroke="#0284c7" stroke-width="1.3" />\n`;
      }
      if (el.type === 'socket_ip44' || el.ipRating === 'IP44') {
        svg += `      <path d="M -5 -1 A 5 5 0 0 1 5 -1 Z" fill="#0284c7" fill-opacity="0.25" />\n`;
      }
      if (el.type === 'socket_3phase') {
        svg += `      <circle cx="0" cy="-2" r="2.5" fill="#dc2626" />\n`;
      }
    } else if (el.category === 'switch') {
      svg += `      <circle cx="0" cy="0" r="5" fill="#ffffff" stroke="#d97706" stroke-width="1.8" />\n`;
      svg += `      <line x1="3" y1="-4" x2="10" y2="-11" stroke="#d97706" stroke-width="1.8" />\n`;
      svg += `      <line x1="10" y1="-11" x2="13" y2="-8" stroke="#d97706" stroke-width="1.5" />\n`;
    } else if (el.category === 'light') {
      svg += `      <circle cx="0" cy="0" r="7.5" fill="#ffffff" stroke="#dc2626" stroke-width="1.8" />\n`;
      svg += `      <line x1="-5" y1="-5" x2="5" y2="5" stroke="#dc2626" stroke-width="1.6" />\n`;
      svg += `      <line x1="5" y1="-5" x2="-5" y2="5" stroke="#dc2626" stroke-width="1.6" />\n`;
    } else if (el.category === 'panel') {
      svg += `      <rect x="-14" y="-8" width="28" height="16" fill="#0f172a" stroke="#d97706" stroke-width="2" rx="1.5" />\n`;
      svg += `      <polygon points="-14,-8 14,8 -14,8" fill="#f59e0b" fill-opacity="0.55" />\n`;
    } else if (el.category === 'junction') {
      svg += `      <circle cx="0" cy="0" r="5" fill="#ffffff" stroke="#16a34a" stroke-width="1.6" />\n`;
      svg += `      <circle cx="0" cy="0" r="1.8" fill="#16a34a" />\n`;
    } else if (el.category === 'appliance') {
      svg += `      <rect x="-9" y="-9" width="18" height="18" fill="#ffffff" stroke="#b91c1c" stroke-width="1.8" rx="2" />\n`;
      svg += `      <text x="0" y="3" font-size="7" font-weight="bold" fill="#b91c1c" text-anchor="middle" class="cad-mono">M</text>\n`;
    } else if (
      el.type === 'wifi_ap' ||
      el.type === 'cctv_camera' ||
      el.type === 'intercom' ||
      el.type === 'motion_sensor' ||
      el.type === 'leak_sensor' ||
      el.type === 'knx_actuator' ||
      el.type === 'knx_power_supply'
    ) {
      svg += `      <polygon points="0,-8 8,6 -8,6" fill="#ecfeff" stroke="#0891b2" stroke-width="1.6" />\n`;
    } else {
      svg += `      <rect x="-7" y="-7" width="14" height="14" fill="#ffffff" stroke="#475569" stroke-width="1.6" rx="2" />\n`;
    }

    svg += `    </g>\n`;
    svg += `    <text x="${x}" y="${y + 15}" font-size="6.8" font-weight="600" fill="#1e293b" text-anchor="middle" class="cad-text">${escapeXml(el.name)}</text>\n`;
  });
  svg += '  </g>\n';

  // 7. Non-overlapping Circuit Leader Badges
  if (showCircuitBadges && elements.length > 0) {
    const badges = computeCircuitBadgesLayout(elements, project.circuits, true);
    if (badges.length > 0) {
      svg += '  <g id="circuit_badges">\n';
      badges.forEach((b) => {
        if (b.hasLeader && b.leaderPoints.length >= 6) {
          svg += `    <polyline points="${b.leaderPoints[0]},${b.leaderPoints[1]} ${b.leaderPoints[2]},${b.leaderPoints[3]} ${b.leaderPoints[4]},${b.leaderPoints[5]}" fill="none" stroke="${b.circuitColor}" stroke-width="0.9" />\n`;
        }
        const rx = b.badgePos.x - b.badgeWidth / 2;
        const ry = b.badgePos.y - b.badgeHeight / 2;
        svg += `    <rect x="${rx}" y="${ry}" width="${b.badgeWidth}" height="${b.badgeHeight}" rx="3" fill="#ffffff" stroke="${b.circuitColor}" stroke-width="1" />\n`;
        svg += `    <text x="${b.badgePos.x}" y="${b.badgePos.y + 2.5}" font-size="6.8" font-weight="bold" fill="#0f172a" text-anchor="middle" class="cad-mono">${escapeXml(b.badgeText)}</text>\n`;
      });
      svg += '  </g>\n';
    }
  }

  svg += '</svg>';
  return svg;
}
