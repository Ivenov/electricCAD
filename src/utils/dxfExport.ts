import { CadProject } from '../types/cad';
import { computeCircuitBadgesLayout, MM_PER_PX, pxToMm } from './cadMath';
import { computeOrthogonalPath } from './autoRouting';

/**
 * Pure TypeScript AutoCAD ASCII DXF (Release 12 / 2000) generator.
 * Produces valid CAD files compatible with AutoCAD, LibreCAD, NanoCAD, DWG FastView, DraftSight.
 * Coordinates are converted to real millimeters (1:1 CAD scale).
 */
export function generateProjectDxf(project: CadProject): string {
  const lines: string[] = [];

  // DXF Section Helper
  const addCode = (code: number, value: string | number) => {
    lines.push(code.toString());
    lines.push(value.toString());
  };

  // 1. HEADER SECTION
  addCode(0, 'SECTION');
  addCode(2, 'HEADER');
  addCode(9, '$ACADVER');
  addCode(1, 'AC1009'); // AutoCAD R12 standard ASCII
  addCode(9, '$INSUNITS');
  addCode(70, 4); // Millimeters
  addCode(0, 'ENDSEC');

  // 2. TABLES SECTION (LAYERS)
  addCode(0, 'SECTION');
  addCode(2, 'TABLES');
  addCode(0, 'TABLE');
  addCode(2, 'LAYER');
  addCode(70, 12);

  const layers = [
    { name: '0', color: 7 }, // White/black
    { name: 'A-WALLS', color: 7 }, // Architectural walls (white)
    { name: 'A-OPENINGS', color: 4 }, // Cyan
    { name: 'A-ROOMS', color: 8 }, // Gray room boundaries
    { name: 'A-FURNITURE', color: 9 }, // Light gray furniture
    { name: 'E-PANELS', color: 1 }, // Red
    { name: 'E-SOCKETS', color: 5 }, // Blue
    { name: 'E-LIGHTING', color: 2 }, // Yellow
    { name: 'E-BACKUP', color: 3 }, // Green (Emergency / Backup)
    { name: 'E-WIRING', color: 6 }, // Magenta
    { name: 'E-CIRC-TAGS', color: 4 }, // Cyan circuit leader tags
    { name: 'TITLE-BLOCK', color: 7 }, // DSTU border
  ];

  layers.forEach((l) => {
    addCode(0, 'LAYER');
    addCode(2, l.name);
    addCode(70, 0);
    addCode(62, l.color);
    addCode(6, 'CONTINUOUS');
  });

  addCode(0, 'ENDTAB');
  addCode(0, 'ENDSEC');

  // 3. ENTITIES SECTION
  addCode(0, 'SECTION');
  addCode(2, 'ENTITIES');

  // Draw Rooms (Closed LWPOLYLINE on A-ROOMS)
  (project.rooms || []).forEach((room) => {
    if (!room.points || room.points.length < 3) return;
    addCode(0, 'LWPOLYLINE');
    addCode(8, 'A-ROOMS');
    addCode(90, room.points.length);
    addCode(70, 1); // Closed polyline
    room.points.forEach((pt) => {
      addCode(10, pxToMm(pt.x));
      addCode(20, -pxToMm(pt.y));
    });

    const avgX = pxToMm(room.points.reduce((s, p) => s + p.x, 0) / room.points.length);
    const avgY = -pxToMm(room.points.reduce((s, p) => s + p.y, 0) / room.points.length);
    addCode(0, 'TEXT');
    addCode(8, 'A-ROOMS');
    addCode(10, avgX);
    addCode(20, avgY);
    addCode(30, 0.0);
    addCode(40, 120.0);
    addCode(1, `${room.name} (${room.areaM2} м2)`);
  });

  // Draw Furniture (Closed LWPOLYLINE on A-FURNITURE)
  (project.furniture || []).forEach((furn) => {
    const cx = pxToMm(furn.position.x);
    const cy = -pxToMm(furn.position.y);
    const hw = furn.width / 2;
    const hh = furn.height / 2;
    const rad = ((furn.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(-rad); // Inverted Y

    const corners = [
      { dx: -hw, dy: -hh },
      { dx: hw, dy: -hh },
      { dx: hw, dy: hh },
      { dx: -hw, dy: hh },
    ];

    addCode(0, 'LWPOLYLINE');
    addCode(8, 'A-FURNITURE');
    addCode(90, 4);
    addCode(70, 1);
    corners.forEach((c) => {
      addCode(10, Math.round(cx + c.dx * cos - c.dy * sin));
      addCode(20, Math.round(cy + c.dx * sin + c.dy * cos));
    });

    addCode(0, 'TEXT');
    addCode(8, 'A-FURNITURE');
    addCode(10, cx - hw * 0.4);
    addCode(20, cy);
    addCode(30, 0.0);
    addCode(40, 65.0);
    addCode(1, furn.name);
  });

  // Draw Walls (A-WALLS)
  project.walls.forEach((wall) => {
    const x1 = pxToMm(wall.start.x);
    const y1 = -pxToMm(wall.start.y); // DXF Y is inverted relative to web canvas
    const x2 = pxToMm(wall.end.x);
    const y2 = -pxToMm(wall.end.y);

    addCode(0, 'LINE');
    addCode(8, 'A-WALLS');
    addCode(10, x1);
    addCode(20, y1);
    addCode(30, 0.0);
    addCode(11, x2);
    addCode(21, y2);
    addCode(31, 0.0);
  });

  // Draw Openings (Doors & Windows in A-OPENINGS)
  project.openings.forEach((op) => {
    const wall = project.walls.find((w) => w.id === op.wallId);
    if (!wall) return;

    const w1x = pxToMm(wall.start.x);
    const w1y = -pxToMm(wall.start.y);
    const w2x = pxToMm(wall.end.x);
    const w2y = -pxToMm(wall.end.y);

    const dx = w2x - w1x;
    const dy = w2y - w1y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const opWidthMm = op.width;
    const centerX = w1x + dx * op.positionRatio;
    const centerY = w1y + dy * op.positionRatio;

    const startX = centerX - (ux * opWidthMm) / 2;
    const startY = centerY - (uy * opWidthMm) / 2;
    const endX = centerX + (ux * opWidthMm) / 2;
    const endY = centerY + (uy * opWidthMm) / 2;

    if (op.type === 'door') {
      // Door opening jamb marks
      const swingLen = opWidthMm * 0.9;
      const leafX = startX + nx * swingLen;
      const leafY = startY + ny * swingLen;

      // Door leaf line
      addCode(0, 'LINE');
      addCode(8, 'A-OPENINGS');
      addCode(10, startX);
      addCode(20, startY);
      addCode(30, 0.0);
      addCode(11, leafX);
      addCode(21, leafY);
      addCode(31, 0.0);

      // Swing chord line
      addCode(0, 'LINE');
      addCode(8, 'A-OPENINGS');
      addCode(10, leafX);
      addCode(20, leafY);
      addCode(30, 0.0);
      addCode(11, endX);
      addCode(21, endY);
      addCode(31, 0.0);

      // Door tag
      addCode(0, 'TEXT');
      addCode(8, 'A-OPENINGS');
      addCode(10, centerX + nx * 150);
      addCode(20, centerY + ny * 150);
      addCode(30, 0.0);
      addCode(40, 75.0);
      addCode(1, `Двері ${opWidthMm} мм`);
    } else {
      // Window: 2 parallel lines for sill / glass
      const offset = (wall.thickness || 150) * 0.25;
      for (const sign of [-1, 1]) {
        addCode(0, 'LINE');
        addCode(8, 'A-OPENINGS');
        addCode(10, startX + nx * offset * sign);
        addCode(20, startY + ny * offset * sign);
        addCode(30, 0.0);
        addCode(11, endX + nx * offset * sign);
        addCode(21, endY + ny * offset * sign);
        addCode(31, 0.0);
      }

      // Window tag
      addCode(0, 'TEXT');
      addCode(8, 'A-OPENINGS');
      addCode(10, centerX + nx * 120);
      addCode(20, centerY + ny * 120);
      addCode(30, 0.0);
      addCode(40, 70.0);
      addCode(1, `Вікно ${opWidthMm} мм`);
    }
  });

  // Draw Electrical Elements
  project.elements.forEach((el) => {
    const cx = pxToMm(el.position.x);
    const cy = -pxToMm(el.position.y);
    const isBackup = Boolean(el.isBackupPriority);

    let layer = 'E-SOCKETS';
    if (el.category === 'panel') layer = 'E-PANELS';
    else if (el.category === 'light' || el.category === 'switch') layer = 'E-LIGHTING';
    else if (el.category === 'backup' || isBackup) layer = 'E-BACKUP';

    // Symbol Circle / Box
    addCode(0, 'CIRCLE');
    addCode(8, layer);
    addCode(10, cx);
    addCode(20, cy);
    addCode(30, 0.0);
    addCode(40, 150.0); // 150mm symbol radius

    // Switch group identifier if bound (a, b, S1, S2)
    const switchTag = el.switchGroupId ? ` [${el.switchGroupId}]` : '';

    // Circuit badge tag for electricians
    const circuit = project.circuits.find((c) => c.id === el.circuitId);
    const circuitTag = circuit
      ? ` [ЩР/Гр.${circuit.number || 1}${el.switchGroupId ? `-${el.switchGroupId}` : ''}]`
      : '';

    // Element Label Text
    addCode(0, 'TEXT');
    addCode(8, layer);
    addCode(10, cx + 180.0);
    addCode(20, cy - 80.0);
    addCode(30, 0.0);
    addCode(40, 90.0); // 90mm text height
    addCode(1, `${el.name}${switchTag}${circuitTag} [h=+${el.mountingHeightMm}]`);

    // Backup Indicator Text
    if (isBackup) {
      addCode(0, 'TEXT');
      addCode(8, 'E-BACKUP');
      addCode(10, cx + 180.0);
      addCode(20, cy - 180.0);
      addCode(30, 0.0);
      addCode(40, 75.0);
      addCode(1, '⚡ [ГАРАНТОВАНЕ ЖИВЛЕННЯ ДБЖ]');
    }
  });

  // Draw Cable Traces (E-WIRING) using orthogonal bypass routing
  project.wires.forEach((wire) => {
    const fromEl = project.elements.find((e) => e.id === wire.fromId);
    const toEl = project.elements.find((e) => e.id === wire.toId);
    if (!fromEl || !toEl) return;

    const tracePoints =
      wire.points && wire.points.length >= 2
        ? wire.points
        : computeOrthogonalPath(fromEl.position, toEl.position, project.walls, project.openings);

    for (let i = 0; i < tracePoints.length - 1; i++) {
      const p1 = tracePoints[i];
      const p2 = tracePoints[i + 1];

      addCode(0, 'LINE');
      addCode(8, 'E-WIRING');
      addCode(10, pxToMm(p1.x));
      addCode(20, -pxToMm(p1.y));
      addCode(30, 0.0);
      addCode(11, pxToMm(p2.x));
      addCode(21, -pxToMm(p2.y));
      addCode(31, 0.0);
    }

    const midIdx = Math.floor(tracePoints.length / 2);
    const midPointX = pxToMm(tracePoints[midIdx].x);
    const midPointY = -pxToMm(tracePoints[midIdx].y);

    // Add cable tag annotation in CAD
    const wireTagText = `${wire.cableTag ? `[${wire.cableTag}] ` : ''}${wire.calculatedLengthM}m`;
    addCode(0, 'TEXT');
    addCode(8, 'E-WIRING');
    addCode(10, midPointX + 50);
    addCode(20, midPointY + 50);
    addCode(30, 0.0);
    addCode(40, 70.0);
    addCode(1, wireTagText);
  });

  // Draw Circuit Leader Badges (E-CIRC-TAGS)
  const badges = computeCircuitBadgesLayout(project.elements, project.circuits, false);
  badges.forEach((badge) => {
    if (badge.hasLeader && badge.leaderPoints.length >= 6) {
      addCode(0, 'LINE');
      addCode(8, 'E-CIRC-TAGS');
      addCode(10, pxToMm(badge.leaderPoints[0]));
      addCode(20, -pxToMm(badge.leaderPoints[1]));
      addCode(30, 0.0);
      addCode(11, pxToMm(badge.leaderPoints[2]));
      addCode(21, -pxToMm(badge.leaderPoints[3]));
      addCode(31, 0.0);

      addCode(0, 'LINE');
      addCode(8, 'E-CIRC-TAGS');
      addCode(10, pxToMm(badge.leaderPoints[2]));
      addCode(20, -pxToMm(badge.leaderPoints[3]));
      addCode(30, 0.0);
      addCode(11, pxToMm(badge.leaderPoints[4]));
      addCode(21, -pxToMm(badge.leaderPoints[5]));
      addCode(31, 0.0);
    }

    addCode(0, 'TEXT');
    addCode(8, 'E-CIRC-TAGS');
    addCode(10, pxToMm(badge.badgePos.x) - (badge.badgeWidth * MM_PER_PX) / 2);
    addCode(20, -pxToMm(badge.badgePos.y));
    addCode(30, 0.0);
    addCode(40, 75.0);
    addCode(1, badge.badgeText);
  });

  // Draw DSTU Title Block Frame (Border)
  // Standard A3 landscape frame in mm: 420mm x 297mm (scaled 1:50 = 21000mm x 14850mm)
  const frameWidth = 21000;
  const frameHeight = 14850;
  const stampX = frameWidth - 9250;
  const stampY = -frameHeight + 2750;

  addCode(0, 'LINE');
  addCode(8, 'TITLE-BLOCK');
  addCode(10, 0);
  addCode(20, 0);
  addCode(30, 0);
  addCode(11, frameWidth);
  addCode(21, 0);
  addCode(31, 0);

  addCode(0, 'LINE');
  addCode(8, 'TITLE-BLOCK');
  addCode(10, frameWidth);
  addCode(20, 0);
  addCode(30, 0);
  addCode(11, frameWidth);
  addCode(21, -frameHeight);
  addCode(31, 0);

  addCode(0, 'LINE');
  addCode(8, 'TITLE-BLOCK');
  addCode(10, frameWidth);
  addCode(20, -frameHeight);
  addCode(30, 0);
  addCode(11, 0);
  addCode(21, -frameHeight);
  addCode(31, 0);

  addCode(0, 'LINE');
  addCode(8, 'TITLE-BLOCK');
  addCode(10, 0);
  addCode(20, -frameHeight);
  addCode(30, 0);
  addCode(11, 0);
  addCode(21, 0);
  addCode(31, 0);

  // DSTU Stamp Text in DXF
  addCode(0, 'TEXT');
  addCode(8, 'TITLE-BLOCK');
  addCode(10, stampX + 300);
  addCode(20, stampY - 500);
  addCode(30, 0);
  addCode(40, 250);
  addCode(1, project.title);

  addCode(0, 'TEXT');
  addCode(8, 'TITLE-BLOCK');
  addCode(10, stampX + 300);
  addCode(20, stampY - 1100);
  addCode(30, 0);
  addCode(40, 180);
  addCode(
    1,
    `Розробив: ${project.author || 'Інженер-електрик'} | ${project.groundingSystem || 'TN-C-S'} | Масштаб 1:50 | ДСТУ Б А.2.4-4:2009`
  );

  addCode(0, 'ENDSEC');
  addCode(0, 'EOF');

  return lines.join('\n');
}

/**
 * Initiates download of the generated .dxf file in the user's browser.
 */
export function downloadDxfFile(project: CadProject) {
  const dxfContent = generateProjectDxf(project);
  const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${project.title.replace(/\s+/g, '_')}_AutoCAD_R12.dxf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
