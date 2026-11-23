/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Багатосторінковий генератор PDF-документації (ДСТУ Б А.2.4-4:2009 А3 та Комерційна пропозиція А4).
 * Використовує високої роздільності рендеринг SVG/Canvas -> jsPDF, що гарантує
 * 100% коректне відображення української кирилиці, умовних позначень та таблиць без викривлень.
 */

import { jsPDF } from 'jspdf';
import { CadProject, ContractorProfile, QuotationLineItem } from '../types/cad';
import { generateCadProjectSvg, SvgSheetMode } from './svgExport';
import { getAggregatedProjectData } from './projectAggregator';
import { generateCableSchedule } from './cableSchedule';
import { analyzeCircuit, calculateProjectElectricalSummary } from './electricalCalculations';
import { getCableDisplayName } from './cadMath';

export interface DstuSheetMeta {
  num: number;
  shortTitle: string;
  fullTitle: string;
  normRef: string;
}

export const DSTU_ALBUM_SHEETS: DstuSheetMeta[] = [
  { num: 1, shortTitle: 'Загальні дані', fullTitle: 'Загальні дані. Пояснювальна записка та легенда', normRef: 'ПУЕ:2017' },
  { num: 2, shortTitle: 'Загальний план', fullTitle: 'Загальний план приміщень та меблювання (М 1:100)', normRef: 'ДБН В.2.5-23' },
  { num: 3, shortTitle: 'Освітлення', fullTitle: 'План мережі освітлення та груп вимикачів (М 1:100)', normRef: 'ДБН В.2.5-28' },
  { num: 4, shortTitle: 'Розетки 230В', fullTitle: 'План розміщення розеток 230 В та висот монтажу (М 1:100)', normRef: 'ДБН В.2.5-23' },
  { num: 5, shortTitle: 'Силове обл.', fullTitle: 'План силового та трифазного обладнання (М 1:100)', normRef: 'ПУЕ §7.1' },
  { num: 6, shortTitle: 'Кабельні траси', fullTitle: 'План магістральних кабельних трас і штроб (М 1:100)', normRef: 'ПУЕ §2.1' },
  { num: 7, shortTitle: 'Слабкострумові', fullTitle: 'План слабкострумових мереж, безпеки та автоматики (М 1:100)', normRef: 'ДСТУ' },
  { num: 8, shortTitle: 'Однолінійна схема', fullTitle: 'Принципова однолінійна розрахункова схема щита (ВРП)', normRef: 'ГОСТ 2.702' },
  { num: 9, shortTitle: 'Групи та кабелі', fullTitle: 'Таблиця електричних груп і кабельний журнал', normRef: 'ДСТУ 21.608' },
  { num: 10, shortTitle: 'Специфікація БОМ', fullTitle: 'Зведена специфікація обладнання та матеріалів', normRef: 'ДСТУ Б А.2.4' },
];

async function svgMarkupToImage(svgMarkup: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = '';
  let currY = y;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currY);
      line = words[i];
      currY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currY);
    currY += lineHeight;
  }
  return currY;
}

function drawDstuFrameAndStamp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sheetNum: number,
  sheetTitle: string,
  project: CadProject
) {
  // 5 px per mm on A3 Landscape (420mm x 297mm => 2100 x 1485 px)
  const scale = w / 420;
  const leftM = 20 * scale;
  const topM = 5 * scale;
  const rightM = w - 5 * scale;
  const bottomM = h - 5 * scale;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Outer Frame
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.strokeRect(leftM, topM, rightM - leftM, bottomM - topM);

  // Title Block Stamp (185mm x 55mm bottom right)
  const stampW = 185 * scale;
  const stampH = 44 * scale;
  const sx = rightM - stampW;
  const sy = bottomM - stampH;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx, sy, stampW, stampH);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(sx, sy, stampW, stampH);

  // Columns inside Stamp
  const sigW = 65 * scale;
  const midW = 75 * scale;
  const rightW = stampW - sigW - midW;

  ctx.beginPath();
  ctx.moveTo(sx + sigW, sy);
  ctx.lineTo(sx + sigW, sy + stampH);
  ctx.moveTo(sx + sigW + midW, sy);
  ctx.lineTo(sx + sigW + midW, sy + stampH);
  ctx.stroke();

  // Signature rows
  const rowH = stampH / 4;
  ctx.lineWidth = 1.2;
  for (let r = 1; r <= 3; r++) {
    ctx.beginPath();
    ctx.moveTo(sx, sy + r * rowH);
    ctx.lineTo(sx + sigW, sy + r * rowH);
    ctx.stroke();
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${Math.round(13)}px "Segoe UI", Arial, sans-serif`;
  const roles = [
    ['Посада', 'Прізвище', 'Дата'],
    ['Розробив', (project.author || 'Інженер').slice(0, 14), project.date || '2026'],
    ['Перевірив', (project.contractorProfile?.expertEngineer || 'Гол. спец.').slice(0, 14), project.date || '2026'],
    ['ГІП', (project.contractorProfile?.contractorName || project.author || 'Інженер').slice(0, 14), project.date || '2026'],
  ];

  roles.forEach((row, idx) => {
    const ry = sy + idx * rowH + rowH * 0.68;
    ctx.font = idx === 0 ? 'bold 12px "Segoe UI", Arial, sans-serif' : '12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(row[0], sx + 8, ry);
    ctx.fillText(row[1], sx + 95, ry);
    ctx.fillText(row[2], sx + 225, ry);
  });

  // Middle Title Section
  ctx.beginPath();
  ctx.moveTo(sx + sigW, sy + stampH * 0.5);
  ctx.lineTo(sx + sigW + midW, sy + stampH * 0.5);
  ctx.stroke();

  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillText((project.title || 'ElectroPlan CAD').slice(0, 40), sx + sigW + 12, sy + 32);
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Система: ${project.supplyPhase === '3-phase' ? '3N~400В' : '1N~230В'} · ${project.groundingSystem || 'TN-C-S'}`, sx + sigW + 12, sy + 56);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  drawWrappedText(ctx, sheetTitle, sx + sigW + 12, sy + stampH * 0.5 + 32, midW - 24, 18);

  // Right Sheet Info Section
  const rightX = sx + sigW + midW;
  ctx.beginPath();
  ctx.moveTo(rightX, sy + stampH * 0.45);
  ctx.lineTo(rightM, sy + stampH * 0.45);
  ctx.stroke();

  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('Стадія', rightX + 12, sy + 20);
  ctx.fillText('Аркуш', rightX + 75, sy + 20);
  ctx.fillText('Аркушів', rightX + 145, sy + 20);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Р', rightX + 22, sy + 50);
  ctx.fillText(String(sheetNum), rightX + 88, sy + 50);
  ctx.fillText(String(DSTU_ALBUM_SHEETS.length), rightX + 165, sy + 50);

  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  const org = (project.contractorProfile?.companyName || 'ElectroPlan CAD UA').slice(0, 24);
  ctx.fillText(org, rightX + 12, sy + stampH * 0.45 + 48);
}

function drawCanvasTable(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colWidths: number[],
  headers: string[],
  rows: string[][],
  rowHeight = 28,
  maxRows = 28
): number {
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  // Header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(x, y, totalW, rowHeight);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, totalW, rowHeight);

  let cx = x;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  headers.forEach((h, idx) => {
    ctx.fillText(h, cx + 8, y + rowHeight * 0.65);
    cx += colWidths[idx];
    if (idx < headers.length - 1) {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + rowHeight);
      ctx.stroke();
    }
  });

  let currY = y + rowHeight;
  const visibleRows = rows.slice(0, maxRows);
  visibleRows.forEach((row, rIdx) => {
    ctx.fillStyle = rIdx % 2 === 1 ? '#f8fafc' : '#ffffff';
    ctx.fillRect(x, currY, totalW, rowHeight);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x, currY, totalW, rowHeight);

    let rcx = x;
    ctx.fillStyle = '#1e293b';
    ctx.font = '12.5px "Segoe UI", Arial, sans-serif';
    row.forEach((cell, idx) => {
      const maxChars = Math.max(4, Math.floor(colWidths[idx] / 7.5));
      const truncated = cell.length > maxChars ? `${cell.slice(0, maxChars - 1)}…` : cell;
      ctx.fillText(truncated, rcx + 8, currY + rowHeight * 0.65);
      rcx += colWidths[idx];
      if (idx < row.length - 1) {
        ctx.beginPath();
        ctx.moveTo(rcx, currY);
        ctx.lineTo(rcx, currY + rowHeight);
        ctx.stroke();
      }
    });
    currY += rowHeight;
  });

  if (rows.length > maxRows) {
    ctx.fillStyle = '#475569';
    ctx.font = 'italic 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`... та ще ${rows.length - maxRows} позицій`, x + 8, currY + 20);
    currY += 24;
  }

  return currY;
}

/**
 * Генерує та завантажує повний 10-аркушевий альбом креслень ДСТУ у форматі PDF (А3 альбомна).
 */
export async function exportDstuAlbumToPdf(
  project: CadProject,
  onProgress?: (sheet: number, total: number) => void
): Promise<void> {
  const W = 2100; // A3 Landscape at 5px/mm
  const H = 1485;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });

  const agg = getAggregatedProjectData(project);
  const summary = calculateProjectElectricalSummary(project);
  const schedule = generateCableSchedule(project).entries;
  const unitLabel = project.displayUnit === 'm' ? 'м' : project.displayUnit === 'cm' ? 'см' : 'мм';

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не вдалося створити 2D-контекст для генерації PDF.');

  const planModeMap: Record<number, SvgSheetMode> = {
    2: 'general',
    3: 'lighting',
    4: 'sockets',
    5: 'power',
    6: 'wiring',
    7: 'low_voltage',
  };

  for (let i = 0; i < DSTU_ALBUM_SHEETS.length; i++) {
    const sheet = DSTU_ALBUM_SHEETS[i];
    onProgress?.(sheet.num, DSTU_ALBUM_SHEETS.length);

    if (i > 0) pdf.addPage('a3', 'landscape');

    drawDstuFrameAndStamp(ctx, W, H, sheet.num, sheet.fullTitle, project);

    const contentX = 125;
    const contentY = 55;
    const contentW = W - 165;
    const contentMaxY = H - 255;

    // Sheet Header Banner
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Аркуш ${sheet.num}: ${sheet.fullTitle}`, contentX, contentY + 26);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(contentX, contentY + 42);
    ctx.lineTo(contentX + contentW, contentY + 42);
    ctx.stroke();

    const bodyY = contentY + 65;

    if (sheet.num === 1) {
      // Sheet 1: General Data + Sheet Index + Technical Indicators + Legend
      const indexRows = DSTU_ALBUM_SHEETS.map((s) => [String(s.num), s.fullTitle, s.normRef]);
      const nextY = drawCanvasTable(
        ctx,
        contentX,
        bodyY,
        [80, 760, 180],
        ['Арк.', 'Найменування аркуша комплекту ЕОМ', 'Норматив'],
        indexRows,
        30,
        10
      );

      // Right Side: Key Electrical Summary
      const rightColX = contentX + 1060;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(rightColX, bodyY, contentW - 1060, 320);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(rightColX, bodyY, contentW - 1060, 320);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
      ctx.fillText('ТЕХНІЧНІ ПОКАЗНИКИ ОБ’ЄКТА', rightColX + 18, bodyY + 30);
      ctx.font = '15px "Segoe UI", Arial, sans-serif';
      const stats = [
        `• Напруга та фазність: ${project.supplyPhase === '3-phase' ? '3N~ 400 В, 50 Гц' : '1N~ 230 В, 50 Гц'}`,
        `• Система заземлення: ${project.groundingSystem || 'TN-C-S'}`,
        `• Ввідний автомат: C${project.mainBreakerRatingA || 40} А`,
        `• Поверхи проєкту: ${agg.syncedFloors.length} | Площа: ${agg.totalAreaM2} м²`,
        `• Встановлена потужність (Pвст): ${summary.installedPowerKw} кВт`,
        `• Розрахункова потужність (Pрозр, Kп=${summary.demandFactor}): ${summary.designPowerKw} кВт`,
        `• Розрахунковий струм: ${summary.mainCurrentA} А | Одиниці: ${unitLabel}`,
        `• Кабельних ліній: ${agg.allWires.length} | Електроточок: ${agg.allElements.length}`,
      ];
      stats.forEach((line, idx) => {
        ctx.fillText(line, rightColX + 18, bodyY + 68 + idx * 30);
      });

      // Legend & Technical Notes below
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText('ВКАЗІВКИ З МОНТАЖУ ТА БЕЗПЕКИ (ПУЕ:2017 / ДБН В.2.5-23:2010):', contentX, nextY + 45);
      ctx.font = '14px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#334155';
      drawWrappedText(
        ctx,
        '1. Електромонтажні роботи виконати кабелем ВВГнгд із мідними жилами. Траси по стелі прокладати у самозгасаючій гофротрубі, по стінах — вертикальними або горизонтальними штробами під 90°. ' +
          '2. Розеточні групи захистити ПЗВ/дифавтоматами з диференційним струмом IΔn ≤ 30 мА (вологі приміщення ≤ 10 мА). ' +
          '3. Остаточне приймання схем перевіряється кваліфікованим інженером-проєктувальником на об’єкті.',
        contentX,
        nextY + 75,
        contentW,
        24
      );
    } else if (planModeMap[sheet.num]) {
      // Sheets 2..7: Vector SVG floor plan + Side table
      const mode = planModeMap[sheet.num];
      const svgMarkup = generateCadProjectSvg(project, {
        mode,
        showDimensions: sheet.num === 2 || sheet.num === 4 || sheet.num === 6,
        showFurniture: sheet.num === 2 || sheet.num === 4 || sheet.num === 3,
        showCircuitBadges: sheet.num !== 2,
        showCableTags: sheet.num === 6,
      });
      const img = await svgMarkupToImage(svgMarkup);

      const planAreaW = 1220;
      const planAreaH = contentMaxY - bodyY - 20;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(contentX, bodyY, planAreaW, planAreaH);

      if (img && img.width > 0 && img.height > 0) {
        const fitScale = Math.min((planAreaW - 24) / img.width, (planAreaH - 24) / img.height);
        const drawW = img.width * fitScale;
        const drawH = img.height * fitScale;
        const dx = contentX + (planAreaW - drawW) / 2;
        const dy = bodyY + (planAreaH - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      }

      // Side Schedule Table
      const sideX = contentX + planAreaW + 25;
      const sideW = contentW - planAreaW - 25;

      if (sheet.num === 2) {
        const rows = agg.allRooms.map((r, idx) => [String(idx + 1), r.name, `${r.areaM2} м²`, r.floorName]);
        drawCanvasTable(ctx, sideX, bodyY, [45, 290, 95, sideW - 430], ['№', 'Приміщення', 'Площа', 'Поверх'], rows, 28, 30);
      } else if (sheet.num === 3) {
        const rows = agg.allElements
          .filter((e) => e.category === 'light' || e.category === 'switch')
          .map((e) => [e.name, e.switchGroupId || '—', `+${e.mountingHeightMm} мм`, `${e.powerWatts} Вт`]);
        drawCanvasTable(ctx, sideX, bodyY, [270, 85, 110, sideW - 465], ['Елемент освітлення', 'Група', 'Висота', 'Потужн.'], rows, 26, 32);
      } else if (sheet.num === 4) {
        const rows = agg.allElements
          .filter((e) => e.category === 'socket')
          .map((e) => {
            const c = project.circuits.find((cr) => cr.id === e.circuitId);
            return [e.name, c ? `Гр.${c.number}` : '—', `+${e.mountingHeightMm} мм`, e.ipRating];
          });
        drawCanvasTable(ctx, sideX, bodyY, [270, 85, 115, sideW - 470], ['Розетка', 'Група', 'Висота', 'IP'], rows, 26, 32);
      } else if (sheet.num === 5) {
        const rows = agg.allElements
          .filter((e) => e.category === 'appliance' || e.powerWatts >= 1500 || e.type === 'socket_3phase')
          .map((e) => {
            const c = project.circuits.find((cr) => cr.id === e.circuitId);
            return [e.name, `${e.powerWatts} Вт`, c ? `C${c.breakerRatingA}А` : '—', c ? getCableDisplayName(c.cableType) : '—'];
          });
        drawCanvasTable(ctx, sideX, bodyY, [230, 95, 85, sideW - 410], ['Силовий споживач', 'Потужн.', 'Авт.', 'Кабель'], rows, 28, 28);
      } else if (sheet.num === 6) {
        const rows = schedule.map((r) => [r.cableTag, r.cableSpec, `${r.procurementLengthM} м`, r.conduitType]);
        drawCanvasTable(ctx, sideX, bodyY, [95, 145, 95, sideW - 335], ['Маркер', 'Марка кабелю', 'Довжина', 'Спосіб прокл.'], rows, 26, 32);
      } else if (sheet.num === 7) {
        const rows = agg.allElements
          .filter(
            (e) =>
              e.type === 'socket_rj45' ||
              e.type === 'socket_tv' ||
              e.type === 'wifi_ap' ||
              e.type === 'cctv_camera' ||
              e.type === 'intercom' ||
              e.type === 'motion_sensor' ||
              e.type === 'light_sensor' ||
              e.type === 'leak_sensor' ||
              e.type === 'knx_actuator' ||
              e.type === 'knx_power_supply'
          )
          .map((e) => [e.name, e.type, `+${e.mountingHeightMm} мм`, e.floorName]);
        drawCanvasTable(ctx, sideX, bodyY, [250, 140, 110, sideW - 500], ['Пристрій СКС / СБ', 'Тип', 'Висота', 'Поверх'], rows, 28, 28);
      }
    } else if (sheet.num === 8) {
      // Sheet 8: Single-Line Schematic
      const svgEl = document.getElementById('single-line-diagram-svg');
      let renderedSvg = false;
      if (svgEl) {
        const serializer = new XMLSerializer();
        const raw = serializer.serializeToString(svgEl);
        const img = await svgMarkupToImage(raw);
        if (img && img.width > 0) {
          const fitScale = Math.min(contentW / img.width, (contentMaxY - bodyY - 80) / img.height);
          ctx.drawImage(img, contentX, bodyY, img.width * fitScale, img.height * fitScale);
          renderedSvg = true;
        }
      }
      if (!renderedSvg) {
        // Programmatic fallback crisp Single-Line Summary Table
        const rows = project.circuits.map((c) => {
          const an = analyzeCircuit(c, agg.allElements, agg.allWires, project.supplyPhase, project.groundingSystem || 'TN-C-S');
          return [
            `Гр.${c.number}`,
            c.name,
            `${c.breakerCurve}${c.breakerRatingA}А (${c.phase})`,
            c.rcdType === 'none' ? '—' : c.rcdType,
            getCableDisplayName(c.cableType),
            an.overallStatus === 'uncalculated' ? 'Не розрах.' : `${an.calculatedCurrentA} А / ΔU ${an.voltageDrop.deltaPercent}%`,
          ];
        });
        drawCanvasTable(
          ctx,
          contentX,
          bodyY,
          [90, 420, 210, 180, 290, contentW - 1190],
          ['Група', 'Споживачі / Найменування лінії', 'Авт. вимикач', 'Диф. захист', 'Кабель', 'Розрах. струм / ΔU'],
          rows,
          32,
          28
        );
      }
    } else if (sheet.num === 9) {
      // Sheet 9: Circuit Schedule & Full Multi-floor Cable Journal
      const circuitRows = project.circuits.map((c) => {
        const an = analyzeCircuit(c, agg.allElements, agg.allWires, project.supplyPhase, project.groundingSystem || 'TN-C-S');
        return [
          `Гр.${c.number}`,
          c.name,
          c.phase,
          `${c.breakerCurve}${c.breakerRatingA}А`,
          getCableDisplayName(c.cableType),
          an.overallStatus === 'uncalculated' ? 'Не розрах.' : `${an.totalInstalledWatts} Вт / ${an.calculatedCurrentA} А`,
          an.overallStatus === 'uncalculated' ? 'Не розрах.' : `${an.cableAmpacityA} А (ΔU ${an.voltageDrop.deltaPercent}%)`,
        ];
      });
      const afterCircuitsY = drawCanvasTable(
        ctx,
        contentX,
        bodyY,
        [80, 430, 75, 130, 260, 290, contentW - 1265],
        ['№', 'Група щита', 'Фаза', 'Автомат', 'Кабель', 'Pрозр / Iрозр', 'Iдд.еф / ΔU%'],
        circuitRows,
        28,
        14
      );

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText('КАБЕЛЬНИЙ ЖУРНАЛ (ДСТУ 21.608):', contentX, afterCircuitsY + 32);

      const cableRows = schedule.map((s) => [
        s.cableTag,
        s.sourceName,
        s.destinationName,
        s.cableSpec,
        `${s.horizontalLengthM} м`,
        `${s.verticalDropsM} м`,
        `${s.procurementLengthM} м`,
      ]);
      drawCanvasTable(
        ctx,
        contentX,
        afterCircuitsY + 46,
        [100, 320, 320, 250, 140, 140, contentW - 1270],
        ['Маркер', 'Початок', 'Кінець', 'Марка кабелю', 'Гориз.', 'Вертик.', 'З запасом'],
        cableRows,
        26,
        16
      );
    } else if (sheet.num === 10) {
      // Sheet 10: Bill of Materials (BOM)
      const cableByMark = new Map<string, { calc: number; proc: number }>();
      schedule.forEach((s) => {
        const prev = cableByMark.get(s.cableSpec) || { calc: 0, proc: 0 };
        cableByMark.set(s.cableSpec, {
          calc: prev.calc + s.totalDesignLengthM,
          proc: prev.proc + s.procurementLengthM,
        });
      });

      const bomRows: string[][] = [];
      let pos = 1;
      cableByMark.forEach((len, mark) => {
        bomRows.push([
          String(pos++),
          `Кабель ${mark}`,
          'ДСТУ 31565',
          'м',
          len.calc.toFixed(1),
          String(Math.ceil(len.proc)),
        ]);
      });

      const counts: Array<[string, number, string]> = [
        ['Розетки 230В та силові (всі види)', agg.allElements.filter((e) => e.category === 'socket').length, 'шт'],
        ['Вимикачі одно-/дво-/прохідні', agg.allElements.filter((e) => e.category === 'switch').length, 'шт'],
        ['Світильники / люстри / споти', agg.allElements.filter((e) => e.category === 'light').length, 'шт'],
        ['Підрозетники (коробки установочні Ø68)', agg.allElements.filter((e) => e.category === 'socket' || e.category === 'switch').length, 'шт'],
        ['Розподільчі коробки', agg.allElements.filter((e) => e.category === 'junction' || e.type.startsWith('junction_box')).length, 'шт'],
        [
          'Слабкострумові / датчики / СКС',
          agg.allElements.filter(
            (e) =>
              e.type === 'socket_rj45' ||
              e.type === 'socket_tv' ||
              e.type === 'wifi_ap' ||
              e.type === 'cctv_camera' ||
              e.type === 'intercom' ||
              e.type === 'motion_sensor' ||
              e.type === 'leak_sensor' ||
              e.type === 'knx_actuator'
          ).length,
          'шт',
        ],
        ['Щити розподільчі (поверхові + ВРП)', Math.max(1, agg.syncedFloors.length), 'шт'],
        ['Модульні захисні апарати щита', project.circuits.length + 2, 'шт'],
      ];
      counts.forEach(([title, qty, u]) => {
        if (qty > 0) {
          bomRows.push([String(pos++), title, 'ПУЕ / ДБН', u, String(qty), String(qty)]);
        }
      });

      drawCanvasTable(
        ctx,
        contentX,
        bodyY,
        [70, 760, 260, 120, 260, contentW - 1470],
        ['Поз.', 'Найменування обладнання та матеріалів', 'Стандарт', 'Од.', 'Розрахунково', 'До закупівлі'],
        bomRows,
        32,
        28
      );
    }

    const pageImg = canvas.toDataURL('image/png');
    pdf.addImage(pageImg, 'PNG', 0, 0, 420, 297, undefined, 'FAST');
  }

  const safeFile = (project.title || 'ElectroPlan').replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄґҐ_-]+/g, '_');
  pdf.save(`${safeFile}_DSTU_Album_10sheets.pdf`);
}

export interface QuotationPdfParams {
  project: CadProject;
  contractor: ContractorProfile;
  clientName: string;
  objectAddress: string;
  quotationNumber: string;
  currentDateStr: string;
  validUntilDateStr: string;
  sections: {
    roughItems: QuotationLineItem[];
    finishItems: QuotationLineItem[];
    modularItems: QuotationLineItem[];
    laborItems: QuotationLineItem[];
  };
  totals: {
    sumRough: number;
    sumFinish: number;
    sumModular: number;
    sumLabor: number;
    totalMaterials: number;
    discountPercent: number;
    discountAmount: number;
    taxPercent: number;
    taxAmount: number;
    grandTotal: number;
  };
  notes: string;
}

/**
 * Експорт Комерційної Пропозиції (КП) у багатосторінковий А4 PDF через jsPDF.
 */
export async function exportQuotationToPdf(params: QuotationPdfParams): Promise<void> {
  const W = 1240; // A4 Portrait 150 DPI approx (210 x 297 mm)
  const H = 1754;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const pages: HTMLCanvasElement[] = [];
  let canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  let ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не вдалося створити контекст для генерації PDF.');

  const resetPage = () => {
    ctx!.fillStyle = '#ffffff';
    ctx!.fillRect(0, 0, W, H);
  };
  const nextPage = () => {
    pages.push(canvas);
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d')!;
    resetPage();
    return 80;
  };

  resetPage();
  let y = 75;
  const marginX = 70;
  const contentW = W - marginX * 2;

  // Header
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
  ctx.fillText('КОМЕРЦІЙНА ПРОПОЗИЦІЯ ТА КОШТОРИС', marginX, y);
  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#0284c7';
  ctx.fillText(`№ ${params.quotationNumber}`, W - marginX - 180, y);

  y += 28;
  ctx.fillStyle = '#475569';
  ctx.font = '15px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`Дата: ${params.currentDateStr}   |   Дійсна до: ${params.validUntilDateStr}`, marginX, y);

  y += 18;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();

  y += 25;
  // Parties box
  const boxW = (contentW - 24) / 2;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(marginX, y, boxW, 130);
  ctx.fillRect(marginX + boxW + 24, y, boxW, 130);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(marginX, y, boxW, 130);
  ctx.strokeRect(marginX + boxW + 24, y, boxW, 130);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText('ВИКОНАВЕЦЬ:', marginX + 16, y + 24);
  ctx.fillText('ЗАМОВНИК ТА ОБ’ЄКТ:', marginX + boxW + 40, y + 24);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.fillText((params.contractor.companyName || '').slice(0, 34), marginX + 16, y + 50);
  ctx.fillText((params.clientName || 'Приватний замовник').slice(0, 34), marginX + boxW + 40, y + 50);

  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`Тел: ${params.contractor.phone || '—'}`, marginX + 16, y + 76);
  ctx.fillText(`IBAN: ${(params.contractor.iban || '—').slice(0, 32)}`, marginX + 16, y + 100);
  ctx.fillText(`Адреса: ${(params.objectAddress || '—').slice(0, 34)}`, marginX + boxW + 40, y + 76);
  ctx.fillText(`Проєкт: ${(params.project.title || 'ElectroPlan').slice(0, 34)}`, marginX + boxW + 40, y + 100);

  y += 160;

  const renderSection = (title: string, items: QuotationLineItem[], subtotal: number) => {
    if (y > H - 220) y = nextPage();

    ctx!.fillStyle = '#e2e8f0';
    ctx!.fillRect(marginX, y, contentW, 32);
    ctx!.fillStyle = '#0f172a';
    ctx!.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx!.fillText(title, marginX + 12, y + 22);
    ctx!.fillText(`${subtotal.toLocaleString()} грн`, W - marginX - 150, y + 22);
    y += 38;

    const cols = [45, 580, 75, 95, 145, contentW - 940];
    const headers = ['№', 'Найменування', 'Од.', 'К-сть', 'Ціна', 'Сума (грн)'];

    // Draw table header
    ctx!.fillStyle = '#f8fafc';
    ctx!.fillRect(marginX, y, contentW, 28);
    ctx!.strokeStyle = '#94a3b8';
    ctx!.strokeRect(marginX, y, contentW, 28);
    let hx = marginX;
    ctx!.fillStyle = '#334155';
    ctx!.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    headers.forEach((h, idx) => {
      ctx!.fillText(h, hx + 8, y + 19);
      hx += cols[idx];
    });
    y += 28;

    items.forEach((it, idx) => {
      if (y > H - 140) y = nextPage();
      ctx!.fillStyle = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
      ctx!.fillRect(marginX, y, contentW, 26);
      ctx!.strokeStyle = '#cbd5e1';
      ctx!.strokeRect(marginX, y, contentW, 26);

      const vals = [
        String(idx + 1),
        (it.name || '').slice(0, 58),
        it.unit,
        String(it.quantity || 0),
        String(it.unitPrice || 0),
        (it.totalPrice || 0).toLocaleString(),
      ];
      let rx = marginX;
      ctx!.fillStyle = '#0f172a';
      ctx!.font = '13px "Segoe UI", Arial, sans-serif';
      vals.forEach((v, cIdx) => {
        ctx!.fillText(v, rx + 8, y + 18);
        rx += cols[cIdx];
      });
      y += 26;
    });

    y += 20;
  };

  renderSection('1. ЧОРНОВІ ЕЛЕКТРОМОНТАЖНІ МАТЕРІАЛИ', params.sections.roughItems, params.totals.sumRough);
  renderSection('2. ЧИСТОВА ЕЛЕКТРОФУРНІТУРА', params.sections.finishItems, params.totals.sumFinish);
  renderSection('3. МОДУЛЬНЕ ЗАХИСНЕ ОБЛАДНАННЯ ТА ЩИТИ', params.sections.modularItems, params.totals.sumModular);
  renderSection('4. ЕЛЕКТРОМОНТАЖНІ ТА ПУСКОНАЛАГОДЖУВАЛЬНІ РОБОТИ', params.sections.laborItems, params.totals.sumLabor);

  if (y > H - 250) y = nextPage();

  // Summary Block
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(W - marginX - 420, y, 420, 150);
  ctx.strokeStyle = '#0f172a';
  ctx.strokeRect(W - marginX - 420, y, 420, 150);

  ctx.fillStyle = '#0f172a';
  ctx.font = '15px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`Матеріали (1+2+3): ${params.totals.totalMaterials.toLocaleString()} грн`, W - marginX - 400, y + 32);
  ctx.fillText(`Монтажні роботи (4): ${params.totals.sumLabor.toLocaleString()} грн`, W - marginX - 400, y + 58);
  if (params.totals.discountPercent > 0) {
    ctx.fillStyle = '#059669';
    ctx.fillText(`Знижка (${params.totals.discountPercent}%): -${params.totals.discountAmount.toLocaleString()} грн`, W - marginX - 400, y + 84);
  }
  ctx.fillStyle = '#0284c7';
  ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`ДО СПЛАТИ: ${params.totals.grandTotal.toLocaleString()} грн`, W - marginX - 400, y + 126);

  // Notes on left
  ctx.fillStyle = '#334155';
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  drawWrappedText(ctx, params.notes || '', marginX, y + 24, contentW - 460, 20);

  pages.push(canvas);

  pages.forEach((pCanvas, idx) => {
    if (idx > 0) pdf.addPage('a4', 'portrait');
    const dataUrl = pCanvas.toDataURL('image/png');
    pdf.addImage(dataUrl, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  });

  const safeTitle = (params.project.title || 'ElectroPlan').replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄґҐ_-]+/g, '_');
  pdf.save(`Koshtorys_${safeTitle}.pdf`);
}
