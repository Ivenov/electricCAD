import { CadProject } from '../types/cad';
import { pxToMm } from './cadMath';

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
  addCode(70, 7);

  const layers = [
    { name: '0', color: 7 }, // White/black
    { name: 'A-WALLS', color: 7 }, // Architectural walls (white)
    { name: 'A-OPENINGS', color: 4 }, // Cyan
    { name: 'E-PANELS', color: 1 }, // Red
    { name: 'E-SOCKETS', color: 5 }, // Blue
    { name: 'E-LIGHTING', color: 2 }, // Yellow
    { name: 'E-BACKUP', color: 3 }, // Green (Emergency / Backup)
    { name: 'E-WIRING', color: 6 }, // Magenta
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

    // Element Label Text
    addCode(0, 'TEXT');
    addCode(8, layer);
    addCode(10, cx + 180.0);
    addCode(20, cy - 80.0);
    addCode(30, 0.0);
    addCode(40, 90.0); // 90mm text height
    addCode(1, `${el.name} [h=+${el.mountingHeightMm}]`);

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

  // Draw Cable Traces (E-WIRING)
  project.wires.forEach((wire) => {
    const fromEl = project.elements.find((e) => e.id === wire.fromId);
    const toEl = project.elements.find((e) => e.id === wire.toId);
    if (!fromEl || !toEl) return;

    if (wire.points && wire.points.length >= 2) {
      for (let i = 0; i < wire.points.length - 1; i++) {
        const p1 = wire.points[i];
        const p2 = wire.points[i + 1];

        addCode(0, 'LINE');
        addCode(8, 'E-WIRING');
        addCode(10, pxToMm(p1.x));
        addCode(20, -pxToMm(p1.y));
        addCode(30, 0.0);
        addCode(11, pxToMm(p2.x));
        addCode(21, -pxToMm(p2.y));
        addCode(31, 0.0);
      }
    } else {
      // Orthogonal Manhattan line between fromEl and toEl
      const x1 = pxToMm(fromEl.position.x);
      const y1 = -pxToMm(fromEl.position.y);
      const x2 = pxToMm(toEl.position.x);
      const y2 = -pxToMm(toEl.position.y);

      // Corner bend
      addCode(0, 'LINE');
      addCode(8, 'E-WIRING');
      addCode(10, x1);
      addCode(20, y1);
      addCode(30, 0.0);
      addCode(11, x2);
      addCode(21, y1);
      addCode(31, 0.0);

      addCode(0, 'LINE');
      addCode(8, 'E-WIRING');
      addCode(10, x2);
      addCode(20, y1);
      addCode(30, 0.0);
      addCode(11, x2);
      addCode(21, y2);
      addCode(31, 0.0);
    }
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
  addCode(1, `Розробив: ${project.author || 'Інженер-електрик'} | Масштаб 1:50 | ДСТУ Б А.2.4-4:2009`);

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
