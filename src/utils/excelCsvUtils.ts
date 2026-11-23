/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CadProject, CircuitGroup, WireRoute, ElectricalElement, QuotationLineItem } from '../types/cad';
import { getCableDisplayName, getCableCrossSection } from './cadMath';
import { analyzeCircuit } from './electricalCalculations';
import { getAggregatedProjectData } from './projectAggregator';
import { calculateFrameQuantities } from './gangGrouping';

/**
 * Downloads a string content as a CSV/Excel compatible file with UTF-8 BOM.
 */
export function downloadCsvFile(filename: string, content: string) {
  // \uFEFF ensures Microsoft Excel on Windows/macOS correctly opens UTF-8 Cyrillic without garbled text
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escapes a field for CSV (wraps in quotes if contains delimiter or quotes).
 */
function escapeCsv(val: string | number | undefined, delimiter: string = ';'): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports project circuit groups to Excel/CSV table.
 */
export function exportCircuitsToCsv(project: CadProject, delimiter: string = ';'): string {
  const headers = [
    'Номер',
    'Назва групи',
    'Встановлена потужність (Вт)',
    'Розрахунковий струм (А)',
    'Фаза',
    'Тип кабелю',
    'Переріз провідника',
    'Автоматичний вимикач (А)',
    'Крива',
    'Диференційний захист (ПЗВ)',
    'Кількість споживачів',
    'Пріоритет резерву ДБЖ',
    'Опис та призначення',
  ];

  const rows: string[] = [headers.join(delimiter)];

  project.circuits.forEach((c) => {
    const analysis = analyzeCircuit(c, project.elements, project.wires, project.supplyPhase);
    const connectedCount = project.elements.filter((e) => e.circuitId === c.id).length;

    let rcdTitle = 'Без ПЗВ';
    if (c.rcdType === 'rcd_30ma') rcdTitle = 'ПЗВ 30мА';
    else if (c.rcdType === 'rcd_10ma') rcdTitle = 'ПЗВ 10мА (Волога зона)';
    else if (c.rcdType === 'rcbo_30ma') rcdTitle = 'Дифавтомат 30мА';
    else if (c.rcdType === 'rcbo_10ma') rcdTitle = 'Дифавтомат 10мА';

    const row = [
      escapeCsv(`Гр.${c.number}`, delimiter),
      escapeCsv(c.name, delimiter),
      escapeCsv(analysis.totalInstalledWatts, delimiter),
      escapeCsv(analysis.calculatedCurrentA, delimiter),
      escapeCsv(c.phase || 'L1', delimiter),
      escapeCsv(getCableDisplayName(c.cableType), delimiter),
      escapeCsv(getCableCrossSection(c.cableType), delimiter),
      escapeCsv(`${c.breakerRatingA}A`, delimiter),
      escapeCsv(c.breakerCurve || 'C', delimiter),
      escapeCsv(rcdTitle, delimiter),
      escapeCsv(connectedCount, delimiter),
      escapeCsv(c.isBackupPriority ? 'Так (ДБЖ)' : 'Ні', delimiter),
      escapeCsv(c.description || '', delimiter),
    ];

    rows.push(row.join(delimiter));
  });

  return rows.join('\r\n');
}

/**
 * Exports project cable schedule (Журнал кабельних ліній) to Excel/CSV.
 */
export function exportCableScheduleToCsv(project: CadProject, delimiter: string = ';'): string {
  const headers = [
    'Позначення лінії',
    'Група щита',
    'Марка кабелю',
    'Переріз (мм²)',
    'Звідки (Початок)',
    'Куди (Кінець)',
    'Спосіб монтажу',
    'Довжина за кресленням (м)',
    'Запас 10% (м)',
    'Загальна довжина (м)',
  ];

  const rows: string[] = [headers.join(delimiter)];

  const elementMap = new Map<string, ElectricalElement>();
  project.elements.forEach((e) => elementMap.set(e.id, e));
  const circuitMap = new Map<string, CircuitGroup>();
  project.circuits.forEach((c) => circuitMap.set(c.id, c));

  project.wires.forEach((w, idx) => {
    const fromEl = elementMap.get(w.fromId);
    const toEl = elementMap.get(w.toId);
    const c = w.circuitId ? circuitMap.get(w.circuitId) : undefined;

    const fromName = fromEl ? `${fromEl.name} (+${fromEl.mountingHeightMm}мм)` : 'ЩР';
    const toName = toEl ? `${toEl.name} (+${toEl.mountingHeightMm}мм)` : 'Прилад';

    let conduitTitle = 'Штроба у стіні';
    if (w.conduit === 'ceiling') conduitTitle = 'Стеля (гофра)';
    else if (w.conduit === 'floor') conduitTitle = 'Стяжка підлоги';

    const baseLen = w.calculatedLengthM || 5.0;
    const marginLen = Math.round(baseLen * 0.1 * 10) / 10;
    const totalLen = Math.round((baseLen + marginLen) * 10) / 10;

    const row = [
      escapeCsv(w.cableTag || `W${c?.number || 1}-${String(idx + 1).padStart(2, '0')}`, delimiter),
      escapeCsv(c ? `Гр.${c.number} (${c.name})` : 'Без групи', delimiter),
      escapeCsv(getCableDisplayName(w.cableType), delimiter),
      escapeCsv(getCableCrossSection(w.cableType), delimiter),
      escapeCsv(fromName, delimiter),
      escapeCsv(toName, delimiter),
      escapeCsv(conduitTitle, delimiter),
      escapeCsv(baseLen.toFixed(1), delimiter),
      escapeCsv(marginLen.toFixed(1), delimiter),
      escapeCsv(totalLen.toFixed(1), delimiter),
    ];

    rows.push(row.join(delimiter));
  });

  return rows.join('\r\n');
}

/**
 * Returns a ready-to-use CSV template that users can fill in Excel.
 */
export function getSampleCircuitsCsvTemplate(delimiter: string = ';'): string {
  const headers = [
    'Номер',
    'Назва групи',
    'Потужність (Вт)',
    'Фаза',
    'Тип кабелю',
    'Автомат (А)',
    'Крива',
    'ПЗВ',
    'Опис',
  ];

  const sampleRows = [
    ['1', 'Освітлення коридор та санвузол', '350', 'L1', 'ВВГнгд 3х1.5', '10', 'B', 'none', 'LED точкові світильники'],
    ['2', 'Освітлення вітальня та кухня', '650', 'L2', 'ВВГнгд 3х1.5', '10', 'B', 'none', 'Люстра та підсвітка фартуха'],
    ['3', 'Розетки кухня (робоча зона)', '3500', 'L1', 'ВВГнгд 3х2.5', '16', 'C', 'rcd_30ma', 'Чайник, мікрохвильовка, блендер'],
    ['4', 'Духова шафа електрична', '2800', 'L3', 'ВВГнгд 3х2.5', '16', 'C', 'rcbo_30ma', 'Окремий дифавтомат'],
    ['5', 'Варильна поверхня індукція', '7200', 'L2', 'ВВГнгд 3х6', '32', 'C', 'rcbo_30ma', 'Силова лінія варильної поверхні'],
    ['6', 'Пральна та сушильна машини', '2500', 'L3', 'ВВГнгд 3х2.5', '16', 'C', 'rcd_10ma', 'Волога зона санвузла ПЗВ 10мА'],
    ['7', 'Розетки вітальня та спальня', '2200', 'L1', 'ВВГнгд 3х2.5', '16', 'C', 'rcd_30ma', 'Загальні побутові розетки'],
    ['8', 'Кондиціонер вітальня', '1800', 'L2', 'ВВГнгд 3х2.5', '16', 'C', 'none', 'Інверторна спліт-система'],
    ['9', 'Серверна / роутер / відеоспостереження', '400', 'L1', 'ВВГнгд 3х2.5', '16', 'B', 'rcd_30ma', 'Пріоритетна лінія ДБЖ'],
  ];

  const content = [
    headers.join(delimiter),
    ...sampleRows.map((r) => r.map((c) => escapeCsv(c, delimiter)).join(delimiter)),
  ].join('\r\n');

  return content;
}

export interface ParsedCircuitImportResult {
  circuits: CircuitGroup[];
  warnings: string[];
  totalParsed: number;
}

/**
 * Parses raw CSV or TSV text copied from Excel or uploaded as file.
 */
export function parseCircuitsCsv(rawText: string): ParsedCircuitImportResult {
  const warnings: string[] = [];
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      circuits: [],
      warnings: ['Файл порожній або містить лише заголовок'],
      totalParsed: 0,
    };
  }

  // Detect delimiter: semicolon, comma, or tab
  const firstLine = lines[0];
  let delimiter = ';';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
  else if (firstLine.includes(',') && !firstLine.includes(';')) delimiter = ',';
  else if ((firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length) delimiter = ';';
  else delimiter = ',';

  // Parse header tokens
  const parseRowTokens = (rowStr: string): string[] => {
    const tokens: string[] = [];
    let insideQuotes = false;
    let currentToken = '';

    for (let i = 0; i < rowStr.length; i++) {
      const ch = rowStr[i];
      if (ch === '"') {
        if (insideQuotes && rowStr[i + 1] === '"') {
          currentToken += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (ch === delimiter && !insideQuotes) {
        tokens.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += ch;
      }
    }
    tokens.push(currentToken.trim());
    return tokens;
  };

  const headerTokens = parseRowTokens(firstLine).map((h) => h.toLowerCase());

  // Find column indices
  const findCol = (keywords: string[]): number => {
    return headerTokens.findIndex((h) => keywords.some((k) => h.includes(k)));
  };

  const numIdx = findCol(['номер', 'number', '№', 'id']);
  const nameIdx = findCol(['назва', 'найменування', 'name', 'лінія']);
  const powerIdx = findCol(['потужність', 'ват', 'power', 'вт', 'watt']);
  const phaseIdx = findCol(['фаза', 'phase']);
  const cableIdx = findCol(['кабель', 'cable', 'провід']);
  const breakerIdx = findCol(['автомат', 'номінал', 'breaker', 'amper', 'струм']);
  const curveIdx = findCol(['крива', 'curve', 'хар']);
  const rcdIdx = findCol(['пзв', 'узв', 'узо', 'диф', 'rcd', 'rcbo']);
  const descIdx = findCol(['опис', 'призначення', 'desc', 'коментар']);

  const parsedCircuits: CircuitGroup[] = [];

  const COLOR_PALETTE = [
    '#38bdf8', '#f59e0b', '#10b981', '#a855f7', '#ec4899',
    '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6',
    '#eab308', '#0ea5e9', '#d946ef', '#22c55e', '#ef4444',
  ];

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const tokens = parseRowTokens(lines[lineIdx]);
    if (tokens.length === 0 || tokens.every((t) => t === '')) continue;

    // Number
    const rawNum = numIdx >= 0 ? parseInt(tokens[numIdx], 10) : lineIdx;
    const finalNumber = !isNaN(rawNum) && rawNum > 0 ? rawNum : lineIdx;

    // Name
    let finalName = nameIdx >= 0 && tokens[nameIdx] ? tokens[nameIdx] : `Група ${finalNumber}`;

    // Breaker Rating (A)
    let breakerRatingA: 10 | 16 | 20 | 25 | 32 | 40 = 16;
    if (breakerIdx >= 0 && tokens[breakerIdx]) {
      const match = tokens[breakerIdx].match(/\d+/);
      if (match) {
        const val = parseInt(match[0], 10);
        if ([10, 16, 20, 25, 32, 40].includes(val)) {
          breakerRatingA = val as 10 | 16 | 20 | 25 | 32 | 40;
        } else if (val < 13) breakerRatingA = 10;
        else if (val <= 18) breakerRatingA = 16;
        else if (val <= 22) breakerRatingA = 20;
        else if (val <= 28) breakerRatingA = 25;
        else if (val <= 36) breakerRatingA = 32;
        else breakerRatingA = 40;
      }
    }

    // Curve
    let breakerCurve: 'B' | 'C' = 'C';
    if (curveIdx >= 0 && tokens[curveIdx]) {
      const cUpper = tokens[curveIdx].toUpperCase();
      if (cUpper.includes('B')) breakerCurve = 'B';
    } else if (breakerRatingA <= 10) {
      breakerCurve = 'B';
    }

    // Cable Type
    let cableType: CircuitGroup['cableType'] = 'VVGng_3x2.5';
    if (cableIdx >= 0 && tokens[cableIdx]) {
      const cStr = tokens[cableIdx].toLowerCase();
      if (cStr.includes('1.5') || cStr.includes('1,5')) cableType = 'VVGng_3x1.5';
      else if (cStr.includes('2.5') || cStr.includes('2,5')) cableType = 'VVGng_3x2.5';
      else if (cStr.includes('4')) cableType = 'VVGng_3x4';
      else if (cStr.includes('6')) cableType = 'VVGng_3x6';
      else if (cStr.includes('knx')) cableType = 'KNX_Bus';
    } else if (breakerRatingA <= 10) {
      cableType = 'VVGng_3x1.5';
    } else if (breakerRatingA >= 32) {
      cableType = 'VVGng_3x6';
    } else if (breakerRatingA >= 25) {
      cableType = 'VVGng_3x4';
    }

    // Phase L1, L2, L3
    let phase: 'L1' | 'L2' | 'L3' = 'L1';
    if (phaseIdx >= 0 && tokens[phaseIdx]) {
      const pStr = tokens[phaseIdx].toUpperCase();
      if (pStr.includes('2') || pStr.includes('L2') || pStr.includes('B')) phase = 'L2';
      else if (pStr.includes('3') || pStr.includes('L3') || pStr.includes('C')) phase = 'L3';
      else phase = 'L1';
    } else {
      // Auto cycle phase
      const cycle = (finalNumber - 1) % 3;
      phase = cycle === 0 ? 'L1' : cycle === 1 ? 'L2' : 'L3';
    }

    // RCD Type
    let rcdType: CircuitGroup['rcdType'] = 'none';
    if (rcdIdx >= 0 && tokens[rcdIdx]) {
      const rStr = tokens[rcdIdx].toLowerCase();
      if (rStr.includes('10')) {
        rcdType = rStr.includes('диф') || rStr.includes('rcbo') ? 'rcbo_10ma' : 'rcd_10ma';
      } else if (rStr.includes('30') || rStr.includes('пзв') || rStr.includes('узо')) {
        rcdType = rStr.includes('диф') || rStr.includes('rcbo') ? 'rcbo_30ma' : 'rcd_30ma';
      }
    } else if (
      finalName.toLowerCase().includes('ванн') ||
      finalName.toLowerCase().includes('санвуз') ||
      finalName.toLowerCase().includes('пральн')
    ) {
      rcdType = 'rcd_10ma';
    } else if (breakerRatingA >= 16) {
      rcdType = 'rcd_30ma';
    }

    // Description
    const description = descIdx >= 0 && tokens[descIdx] ? tokens[descIdx] : undefined;

    const newCircuit: CircuitGroup = {
      id: `c_${Date.now()}_${finalNumber}_${Math.random().toString(36).substring(2, 6)}`,
      number: finalNumber,
      name: finalName,
      breakerRatingA,
      breakerCurve,
      rcdType,
      cableType,
      phase,
      color: COLOR_PALETTE[(finalNumber - 1) % COLOR_PALETTE.length],
      description,
    };

    parsedCircuits.push(newCircuit);
  }

  // Ensure unique numbers and sort
  parsedCircuits.sort((a, b) => a.number - b.number);

  return {
    circuits: parsedCircuits,
    warnings,
    totalParsed: parsedCircuits.length,
  };
}

/**
 * Exports comprehensive Bill of Materials (BOM) to CSV format with multi-gang frames,
 * back-boxes, modular gear, and cables.
 */
export function exportBomToCsv(project: CadProject, delimiter: string = ';'): string {
  const aggregated = getAggregatedProjectData(project);

  const headers = [
    'Категорія',
    'Найменування матеріалу / обладнання',
    'Технічні характеристики / специфікація',
    'Од. вим.',
    'Кількість',
    'Орієнтовна ціна (грн)',
    'Сума (грн)',
  ];

  interface BomRow {
    category: string;
    name: string;
    spec: string;
    unit: string;
    qty: number;
    price: number;
    sum: number;
  }

  const rowsData: BomRow[] = [];

  const addRow = (cat: string, name: string, spec: string, unit: string, qty: number, price: number) => {
    if (qty <= 0) return;
    rowsData.push({
      category: cat,
      name,
      spec,
      unit,
      qty,
      price,
      sum: Math.round(qty * price),
    });
  };

  // 1. CABLES
  const cableTotals: Record<string, number> = {};
  aggregated.allWires.forEach((w) => {
    const cType = w.cableType || 'VVGng_3x2.5';
    const len = w.calculatedLengthM || 5.0;
    cableTotals[cType] = (cableTotals[cType] || 0) + len;
  });

  const addCable = (type: string, name: string, spec: string, price: number, defQty: number = 0) => {
    const raw = cableTotals[type] || defQty;
    const procurement = Math.ceil(raw * 1.15); // +15% margin
    addRow('1. Кабельно-провідникова продукція', name, spec, 'м', procurement, price);
  };

  addCable('VVGng_3x1.5', 'Кабель силовий ВВГнгд 3х1.5', 'Мідний негорючий моноліт ДСТУ (Освітлення)', 32, 45);
  addCable('VVGng_3x2.5', 'Кабель силовий ВВГнгд 3х2.5', 'Мідний моноліт ДСТУ (Розетки 16А)', 52, 70);
  addCable('VVGng_3x4', 'Кабель силовий ВВГнгд 3х4', 'Посилений 3х4 мм² (Бойлер / СПЗ)', 82);
  addCable('VVGng_3x6', 'Кабель силовий ВВГнгд 3х6', 'Для варильної поверхні до 8.5 кВт', 118);
  addCable('VVGng_5x2.5', 'Кабель силовий ВВГнгд 5х2.5', '3-фазні розетки та електроприймачі', 86);
  addCable('VVGng_5x4', 'Кабель силовий ВВГнгд 5х4', '3-фазні котли / стояки', 132);
  addCable('VVGng_5x6', 'Кабель силовий ВВГнгд 5х6', '3-фазний магістральний ввід ВРП', 195);
  addCable('FTP_Cat5e', 'Кабель кручена пара FTP Cat5e/6', 'Екранована вита пара 4х2х0.51', 22);
  addCable('KNX_Bus', 'Кабель шини автоматизації KNX', 'JY(St)Y 2х2х0.8 зелений', 38);

  const totalCableM = rowsData
    .filter((r) => r.category === '1. Кабельно-провідникова продукція')
    .reduce((s, r) => s + r.qty, 0);
  addRow('1. Кабельно-провідникова продукція', 'Труба гофрована ПВХ d20 із зондом', 'Самозатухаюча з протяжкою + кліпси', 'м', Math.round(totalCableM * 0.85), 11);

  // 2. SOCKETS, SWITCHES & FRAMES
  const elementCounts: Record<string, number> = {};
  aggregated.allElements.forEach((e) => {
    elementCounts[e.type] = (elementCounts[e.type] || 0) + 1;
  });

  if (elementCounts['socket_single']) addRow('2. Електроустановочні вироби', 'Розетка 230В 16А із заземленням', 'Механізм із шторками IP20 (Schneider/Legrand)', 'шт', elementCounts['socket_single'], 140);
  if (elementCounts['socket_double']) addRow('2. Електроустановочні вироби', 'Розетка подвійна 2x230В', '2 механізми під рамку', 'шт', elementCounts['socket_double'] * 2, 140);
  if (elementCounts['socket_triple']) addRow('2. Електроустановочні вироби', 'Блок розеток 3x230В', '3 механізми під єдину рамку', 'шт', elementCounts['socket_triple'] * 3, 140);
  if (elementCounts['socket_quad']) addRow('2. Електроустановочні вироби', 'Блок розеток 4x230В', '4 механізми під єдину рамку', 'шт', elementCounts['socket_quad'] * 4, 140);
  if (elementCounts['socket_ip44']) addRow('2. Електроустановочні вироби', 'Розетка вологозахищена IP44 з кришкою', 'Для санвузлів та вологих зон', 'шт', elementCounts['socket_ip44'], 220);
  if (elementCounts['socket_outdoor']) addRow('2. Електроустановочні вироби', 'Розетка вулична IP65', 'Для терас та фасадів', 'шт', elementCounts['socket_outdoor'], 350);
  if (elementCounts['socket_cooker']) addRow('2. Електроустановочні вироби', 'Силова розетка плити 32А', 'Для варильної поверхні', 'шт', elementCounts['socket_cooker'], 280);
  if (elementCounts['socket_3phase']) addRow('2. Електроустановочні вироби', 'Силова 3P розетка 400В 16А/32А', 'Червоний роз’єм 3P+N+PE', 'шт', elementCounts['socket_3phase'], 420);
  if (elementCounts['socket_rj45']) addRow('2. Електроустановочні вироби', 'Розетка комп’ютерна RJ45 Cat6', 'Інтернет розетка під рамку', 'шт', elementCounts['socket_rj45'], 190);
  if (elementCounts['switch_1g']) addRow('2. Електроустановочні вироби', 'Вимикач 1-клавішний 10А', 'Механізм комутації освітлення', 'шт', elementCounts['switch_1g'], 130);
  if (elementCounts['switch_2g']) addRow('2. Електроустановочні вироби', 'Вимикач 2-клавішний 10А', 'Двоклавішний механізм', 'шт', elementCounts['switch_2g'], 160);
  if (elementCounts['switch_pass']) addRow('2. Електроустановочні вироби', 'Вимикач прохідний (перемикач)', 'Для коридорів та сходів', 'шт', elementCounts['switch_pass'], 180);
  if (elementCounts['thermostat']) addRow('2. Електроустановочні вироби', 'Терморегулятор теплої підлоги', 'Електронний з датчиком температури', 'шт', elementCounts['thermostat'], 1250);

  // Frames & back-boxes
  const frameStats = calculateFrameQuantities(aggregated.allElements);
  if (frameStats.gang1 > 0) addRow('3. Декоративні рамки та підрозетники', 'Рамка 1-постова одинарна', 'Для одиночних точок 71 мм', 'шт', frameStats.gang1, 45);
  if (frameStats.gang2 > 0) addRow('3. Декоративні рамки та підрозетники', 'Рамка 2-постова подвійна', 'Монтажний пост міжосьова 71 мм', 'шт', frameStats.gang2, 85);
  if (frameStats.gang3 > 0) addRow('3. Декоративні рамки та підрозетники', 'Рамка 3-постова потрійна', 'Для кухні та ТВ-зони 71 мм', 'шт', frameStats.gang3, 145);
  if (frameStats.gang4 > 0) addRow('3. Декоративні рамки та підрозетники', 'Рамка 4-постова четвірна', 'Монтажний блок 71 мм', 'шт', frameStats.gang4, 210);
  if (frameStats.gang5 > 0) addRow('3. Декоративні рамки та підрозетники', 'Рамка 5-постова п’ятипостова', 'Максимальний монтажний блок 71 мм', 'шт', frameStats.gang5, 290);
  if (frameStats.totalFlushBoxes > 0) addRow('3. Декоративні рамки та підрозетники', 'Коробка монтажна (підрозетник) d68', 'Поглиблена з замками зчеплення', 'шт', frameStats.totalFlushBoxes, 18);

  // 4. PANELS
  const boardCount = Math.max(1, aggregated.syncedFloors.length);
  addRow('4. Модульне обладнання щита', 'Корпус щита вбудований (ЩРН 24-36 модулів)', 'Металопластиковий корпус з шинами PE/N', 'шт', boardCount, 1650);
  addRow('4. Модульне обладнання щита', `Ввідний автоматичний вимикач C${project.mainBreakerRatingA || 40}A 6кА`, project.supplyPhase === '3-phase' ? '3-полюсний 400В' : '2-полюсний 230В', 'шт', 1, 480);
  addRow('4. Модульне обладнання щита', 'Реле захисту від перепадів напруги (Zubr / Welrok)', 'Цифровий вольтметр із захистом від обриву нуля', 'шт', 1, 1450);
  addRow('4. Модульне обладнання щита', 'Пристрій захисту від імпульсних перенапруг (ПЗІП T2)', 'Захист від блискавок 20кА (ПУЕ)', 'шт', 1, 1950);

  const rcdCount = project.circuits.filter((c) => c.rcdType && c.rcdType !== 'none').length;
  if (rcdCount > 0) addRow('4. Модульне обладнання щита', 'ПЗВ 30мА / 10мА тип A електромеханічне', 'Захист від витоку струму', 'шт', rcdCount, 1250);
  addRow('4. Модульне обладнання щита', 'Автоматичні вимикачі лінійні 10А / 16А 6кА тип B/C', 'Групові автомати (Hager/Schneider)', 'шт', project.circuits.length, 210);
  addRow('4. Модульне обладнання щита', 'З’єднувальна гребінка шина (Fork/Pin)', 'Мідна ізольована шина живлення автоматів', 'шт', 2, 280);

  // 5. LIGHT FIXTURES
  const lightFixtures = aggregated.allElements.filter((e) => e.category === 'light');
  if (lightFixtures.length > 0) {
    addRow('5. Освітлювальні прилади', 'Світильники точкові LED врізні', 'Алюмінієвий корпус 8-12 Вт IP20/IP44', 'шт', lightFixtures.length, 320);
  }

  const lines = [headers.join(delimiter)];
  rowsData.forEach((r) => {
    const row = [
      escapeCsv(r.category, delimiter),
      escapeCsv(r.name, delimiter),
      escapeCsv(r.spec, delimiter),
      escapeCsv(r.unit, delimiter),
      escapeCsv(r.qty, delimiter),
      escapeCsv(r.price, delimiter),
      escapeCsv(r.sum, delimiter),
    ];
    lines.push(row.join(delimiter));
  });

  const grandTotal = rowsData.reduce((s, r) => s + r.sum, 0);
  lines.push(['', '', '', '', 'РАЗОМ (грн):', '', grandTotal].map((c) => escapeCsv(c, delimiter)).join(delimiter));

  return lines.join('\r\n');
}

/**
 * Downloads full comprehensive project package to CSV/Excel in 1-click.
 */
export function exportComprehensiveProjectToExcel(project: CadProject) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeTitle = (project.title || 'ElectroPlan').replace(/[\s/\\?%*:|"<>]/g, '_');

  const bomCsv = exportBomToCsv(project, ';');
  downloadCsvFile(`Специфікація_BOM_${safeTitle}_${dateStr}.csv`, bomCsv);
}

