/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Генератор векторних креслень SVG безпосередньо з моделі проекту CadProject.
 * Гарантує бездоганний експорт незалежно від того, чи активний Konva-канвас чи SVG-полотні.
 */

import { CadProject } from '../types/cad';
import { getCableDisplayName } from './cadMath';

export function generateCadProjectSvg(project: CadProject): string {
  // Обчислення габаритів креслення
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  project.walls.forEach((w) => {
    minX = Math.min(minX, w.start.x, w.end.x);
    maxX = Math.max(maxX, w.start.x, w.end.x);
    minY = Math.min(minY, w.start.y, w.end.y);
    maxY = Math.max(maxY, w.start.y, w.end.y);
  });

  project.elements.forEach((e) => {
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

  const padding = 60;
  const vbX = Math.floor(minX - padding);
  const vbY = Math.floor(minY - padding);
  const vbW = Math.ceil(maxX - minX + padding * 2);
  const vbH = Math.ceil(maxY - minY + padding * 2);

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  <style>
    .cad-bg { fill: #ffffff; }
    .cad-wall { stroke: #1e293b; stroke-linecap: round; }
    .cad-wall-bearing { stroke-width: 14px; }
    .cad-wall-part { stroke-width: 8px; }
    .cad-room-fill { fill: #f8fafc; stroke: #e2e8f0; stroke-width: 1px; }
    .cad-wire { fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .cad-text { font-family: 'JetBrains Mono', 'Segoe UI', Arial, sans-serif; }
  </style>
  <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" class="cad-bg" />
`;

  // 1. Rooms layer
  if (project.rooms && project.rooms.length > 0) {
    svg += '  <g id="rooms">\n';
    project.rooms.forEach((r) => {
      const pts = r.points.map((p) => `${p.x},${p.y}`).join(' ');
      svg += `    <polygon points="${pts}" class="cad-room-fill" />\n`;
      // Room label
      const avgX = r.points.reduce((s, p) => s + p.x, 0) / r.points.length;
      const avgY = r.points.reduce((s, p) => s + p.y, 0) / r.points.length;
      svg += `    <text x="${avgX}" y="${avgY}" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle" class="cad-text">${r.name} (${r.areaM2} м²)</text>\n`;
    });
    svg += '  </g>\n';
  }

  // 2. Walls layer
  svg += '  <g id="walls">\n';
  project.walls.forEach((w) => {
    const cls = w.type === 'bearing' ? 'cad-wall cad-wall-bearing' : 'cad-wall cad-wall-part';
    svg += `    <line x1="${w.start.x}" y1="${w.start.y}" x2="${w.end.x}" y2="${w.end.y}" class="${cls}" />\n`;
  });
  svg += '  </g>\n';

  // 3. Wires layer
  svg += '  <g id="wires">\n';
  project.wires.forEach((wire) => {
    const fromEl = project.elements.find((e) => e.id === wire.fromId);
    const toEl = project.elements.find((e) => e.id === wire.toId);
    if (!fromEl || !toEl) return;

    const circuit = project.circuits.find((c) => c.id === wire.circuitId);
    const strokeColor = circuit?.color || '#0284c7';
    const isLighting = wire.cableType === 'VVGng_3x1.5';
    const strokeDash = wire.conduit === 'ceiling' ? 'stroke-dasharray="4,2"' : '';

    if (wire.points && wire.points.length > 0) {
      const fullPoints = [fromEl.position, ...wire.points, toEl.position];
      const d = fullPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      svg += `    <path d="${d}" stroke="${strokeColor}" stroke-width="${isLighting ? 2 : 2.5}" ${strokeDash} class="cad-wire" />\n`;
    } else {
      svg += `    <line x1="${fromEl.position.x}" y1="${fromEl.position.y}" x2="${toEl.position.x}" y2="${toEl.position.y}" stroke="${strokeColor}" stroke-width="${isLighting ? 2 : 2.5}" ${strokeDash} class="cad-wire" />\n`;
    }
  });
  svg += '  </g>\n';

  // 4. Electrical Elements layer
  svg += '  <g id="elements">\n';
  project.elements.forEach((el) => {
    const x = el.position.x;
    const y = el.position.y;
    const rot = el.rotation || 0;

    svg += `    <g transform="translate(${x}, ${y}) rotate(${rot})">\n`;

    if (el.category === 'socket') {
      svg += `      <circle cx="0" cy="0" r="7" fill="#ffffff" stroke="#0284c7" stroke-width="1.8" />\n`;
      svg += `      <line x1="-7" y1="0" x2="7" y2="0" stroke="#0284c7" stroke-width="1.5" />\n`;
      if (el.type === 'socket_ip44') {
        svg += `      <rect x="-4" y="-9" width="8" height="3" fill="#0284c7" rx="1" />\n`;
      }
    } else if (el.category === 'switch') {
      svg += `      <circle cx="0" cy="0" r="6" fill="#ffffff" stroke="#f59e0b" stroke-width="1.8" />\n`;
      svg += `      <line x1="0" y1="-6" x2="4" y2="-12" stroke="#f59e0b" stroke-width="1.8" />\n`;
    } else if (el.category === 'light') {
      svg += `      <circle cx="0" cy="0" r="8" fill="#ffffff" stroke="#ef4444" stroke-width="1.8" />\n`;
      svg += `      <line x1="-6" y1="-6" x2="6" y2="6" stroke="#ef4444" stroke-width="1.6" />\n`;
      svg += `      <line x1="6" y1="-6" x2="-6" y2="6" stroke="#ef4444" stroke-width="1.6" />\n`;
    } else if (el.category === 'panel') {
      svg += `      <rect x="-14" y="-8" width="28" height="16" fill="#0f172a" stroke="#f59e0b" stroke-width="2" rx="2" />\n`;
      svg += `      <line x1="-14" y1="8" x2="14" y2="-8" stroke="#ffffff" stroke-width="1.5" />\n`;
    } else {
      svg += `      <rect x="-8" y="-8" width="16" height="16" fill="#ffffff" stroke="#64748b" stroke-width="1.6" rx="2" />\n`;
    }

    svg += `    </g>\n`;

    // Label
    svg += `    <text x="${x}" y="${y + 16}" font-size="7.5" font-weight="600" fill="#1e293b" text-anchor="middle" class="cad-text">${el.name}</text>\n`;
  });
  svg += '  </g>\n';

  svg += '</svg>';
  return svg;
}
