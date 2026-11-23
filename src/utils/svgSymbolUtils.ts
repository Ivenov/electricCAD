import { CustomLibraryItem } from '../types/cad';

/**
 * Extracts combined SVG path data or converts basic vector shapes (rect, circle, polygon, path)
 * from an uploaded SVG text into a normalized SVG path 'd' string centered at (0, 0) with radius ~14px (28x28px box).
 */
export function parseAndNormalizeSvg(svgRaw: string): {
  pathData: string;
  viewBox?: string;
  originalSvg: string;
  metadata?: {
    name?: string;
    powerWatts?: number;
    mountingHeightMm?: number;
    symbolColor?: string;
    ipRating?: string;
  };
} {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgRaw, 'image/svg+xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Невалідний синтаксис файлу SVG');
    }

    const svgElement = doc.querySelector('svg');
    if (!svgElement) {
      throw new Error('Тег <svg> не знайдено');
    }

    // Look for embedded ElectroPlan metadata
    const metaItem = doc.querySelector('metadata item, metadata electroplan\\:item, item');
    let metadata: {
      name?: string;
      powerWatts?: number;
      mountingHeightMm?: number;
      symbolColor?: string;
      ipRating?: string;
    } | undefined = undefined;

    if (metaItem) {
      const pw = metaItem.getAttribute('powerWatts');
      const mh = metaItem.getAttribute('mountingHeightMm');
      metadata = {
        name: metaItem.getAttribute('name') || undefined,
        powerWatts: pw ? parseFloat(pw) : undefined,
        mountingHeightMm: mh ? parseFloat(mh) : undefined,
        symbolColor: metaItem.getAttribute('symbolColor') || undefined,
        ipRating: metaItem.getAttribute('ipRating') || undefined,
      };
    }

    const viewBoxAttr = svgElement.getAttribute('viewBox');
    let minX = 0;
    let minY = 0;
    let width = 28;
    let height = 28;

    if (viewBoxAttr) {
      const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && !isNaN(parts[2]) && !isNaN(parts[3])) {
        minX = parts[0];
        minY = parts[1];
        width = parts[2] || 28;
        height = parts[3] || 28;
      }
    } else {
      const wAttr = parseFloat(svgElement.getAttribute('width') || '28');
      const hAttr = parseFloat(svgElement.getAttribute('height') || '28');
      if (!isNaN(wAttr)) width = wAttr;
      if (!isNaN(hAttr)) height = hAttr;
    }

    // Collect all paths or convert common elements to path commands
    const pathSegments: string[] = [];
    const elements = svgElement.querySelectorAll('path, rect, circle, ellipse, line, polygon, polyline');

    elements.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'path') {
        const d = el.getAttribute('d');
        if (d) pathSegments.push(d);
      } else if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const w = parseFloat(el.getAttribute('width') || '0');
        const h = parseFloat(el.getAttribute('height') || '0');
        if (w > 0 && h > 0) {
          pathSegments.push(`M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`);
        }
      } else if (tag === 'circle') {
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const r = parseFloat(el.getAttribute('r') || '0');
        if (r > 0) {
          pathSegments.push(`M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 -${r * 2} 0`);
        }
      } else if (tag === 'line') {
        const x1 = parseFloat(el.getAttribute('x1') || '0');
        const y1 = parseFloat(el.getAttribute('y1') || '0');
        const x2 = parseFloat(el.getAttribute('x2') || '0');
        const y2 = parseFloat(el.getAttribute('y2') || '0');
        pathSegments.push(`M ${x1} ${y1} L ${x2} ${y2}`);
      } else if (tag === 'polygon' || tag === 'polyline') {
        const pts = el.getAttribute('points') || '';
        const coords = pts.trim().split(/[\s,]+/).map(Number);
        if (coords.length >= 4) {
          let d = `M ${coords[0]} ${coords[1]}`;
          for (let i = 2; i < coords.length; i += 2) {
            d += ` L ${coords[i]} ${coords[i + 1]}`;
          }
          if (tag === 'polygon') d += ' Z';
          pathSegments.push(d);
        }
      }
    });

    const combinedPath = pathSegments.join(' ');

    return {
      pathData: combinedPath || 'M -10 -10 H 10 V 10 H -10 Z',
      viewBox: viewBoxAttr || `0 0 ${width} ${height}`,
      originalSvg: svgRaw,
      metadata,
    };
  } catch (err: any) {
    throw new Error(`Помилка аналізу SVG: ${err.message || 'Некоректний файл'}`);
  }
}

/**
 * Generates a clean, standalone, downloadable SVG file from a CustomLibraryItem
 */
export function exportCustomSymbolToSvgFile(item: CustomLibraryItem): string {
  const size = 64;
  const color = item.symbolColor || '#38bdf8';
  const name = item.name.replace(/"/g, '&quot;');

  let innerSvg = '';

  if (item.customSvgData && item.customSvgData.includes('<svg')) {
    // If we have raw SVG source, return it directly or clean it
    return item.customSvgData;
  }

  if (item.customSvgPath) {
    innerSvg = `
  <!-- Custom user imported vector path -->
  <path d="${item.customSvgPath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="32" cy="32" r="3" fill="${color}" />
`;
  } else {
    // Render standardized CAD symbol based on shape
    switch (item.symbolShape) {
      case 'ev_charger':
        innerSvg = `
  <rect x="18" y="14" width="28" height="36" rx="6" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2.5" />
  <path d="M 33 22 L 27 34 L 32 34 L 30 43 L 38 31 L 33 31 Z" fill="${color}" />
  <path d="M 46 24 C 52 24, 52 38, 46 38" fill="none" stroke="${color}" stroke-width="2" />
`;
        break;
      case 'rack':
        innerSvg = `
  <rect x="14" y="14" width="36" height="36" rx="2" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2.5" />
  <line x1="14" y1="23" x2="50" y2="23" stroke="${color}" stroke-width="1.5" />
  <line x1="14" y1="32" x2="50" y2="32" stroke="${color}" stroke-width="1.5" />
  <line x1="14" y1="41" x2="50" y2="41" stroke="${color}" stroke-width="1.5" />
  <circle cx="18" cy="18.5" r="1.5" fill="${color}" />
  <circle cx="18" cy="27.5" r="1.5" fill="${color}" />
  <circle cx="18" cy="36.5" r="1.5" fill="${color}" />
  <circle cx="18" cy="45.5" r="1.5" fill="${color}" />
`;
        break;
      case 'speaker':
        innerSvg = `
  <circle cx="32" cy="32" r="20" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" />
  <circle cx="32" cy="32" r="11" fill="none" stroke="${color}" stroke-width="2" />
  <circle cx="32" cy="32" r="4" fill="${color}" />
`;
        break;
      case 'sensor':
        innerSvg = `
  <circle cx="32" cy="32" r="18" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" />
  <path d="M 32 20 A 12 12 0 0 1 44 32" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
  <path d="M 32 26 A 6 6 0 0 1 38 32" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
  <circle cx="32" cy="32" r="2.5" fill="${color}" />
`;
        break;
      case 'triangle':
        innerSvg = `
  <polygon points="32,14 49,45 15,45" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" />
  <circle cx="32" cy="34" r="3" fill="${color}" />
`;
        break;
      case 'star':
        innerSvg = `
  <circle cx="32" cy="32" r="19" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" />
  <polygon points="32,19 35.5,27 44,28 37.5,33.5 39.5,42 32,37.5 24.5,42 26.5,33.5 20,28 28.5,27" fill="${color}" />
`;
        break;
      default:
        innerSvg = `
  <circle cx="32" cy="32" r="18" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2.5" />
  <circle cx="32" cy="32" r="6" fill="${color}" />
`;
        break;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <metadata>
    <electroplan:item
      name="${name}"
      category="${item.category}"
      powerWatts="${item.powerWatts || 0}"
      mountingHeightMm="${item.mountingHeightMm || 300}"
      ipRating="${item.ipRating || 'IP20'}"
      phase="${item.phase || 'L1'}"
      recommendedBreakerA="${item.recommendedBreakerA || 16}"
      recommendedCable="${item.recommendedCable || 'VVGng_3x2.5'}"
      symbolShape="${item.symbolShape || 'circle'}"
      symbolColor="${color}"
    />
  </metadata>
  <style>
    .electro-symbol { transform-origin: center; }
  </style>
  <g id="symbol_root" class="electro-symbol">
    ${innerSvg}
  </g>
</svg>`;
}

/**
 * Downloads single custom symbol as .svg
 */
export function downloadCustomSymbolSvg(item: CustomLibraryItem): void {
  const svgText = exportCustomSymbolToSvgFile(item);
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = item.name.replace(/[^a-zA-Z0-9а-яА-ЯіІїЇєЄґҐ_-]/g, '_');
  a.download = `${safeName}_symbol.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses SVG file with metadata or path shapes into a CustomLibraryItem
 */
export function importCustomSymbolFromSvg(svgContent: string, fileName?: string): CustomLibraryItem {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');

  if (doc.querySelector('parsererror')) {
    throw new Error('Невалідний XML/SVG файл');
  }

  // Look for embedded ElectroPlan metadata
  const metaItem = doc.querySelector('metadata item, metadata electroplan\\:item, item');
  const normalized = parseAndNormalizeSvg(svgContent);

  const defaultName = fileName ? fileName.replace(/\.svg$/i, '') : 'Імпортований SVG символ';
  const name = metaItem?.getAttribute('name') || defaultName;
  const powerWatts = parseFloat(metaItem?.getAttribute('powerWatts') || '400');
  const mountingHeightMm = parseFloat(metaItem?.getAttribute('mountingHeightMm') || '300');
  const ipRating = (metaItem?.getAttribute('ipRating') as any) || 'IP20';
  const phase = (metaItem?.getAttribute('phase') as any) || 'L1';
  const recommendedBreakerA = (parseFloat(metaItem?.getAttribute('recommendedBreakerA') || '16') as any);
  const recommendedCable = (metaItem?.getAttribute('recommendedCable') as any) || 'VVGng_3x2.5';
  const symbolColor = metaItem?.getAttribute('symbolColor') || '#38bdf8';
  const symbolShape = (metaItem?.getAttribute('symbolShape') as any) || 'custom';

  return {
    id: `custom_svg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    kind: 'electrical',
    category: 'custom',
    electricalType: 'custom_element',
    powerWatts: isNaN(powerWatts) ? 400 : powerWatts,
    mountingHeightMm: isNaN(mountingHeightMm) ? 300 : mountingHeightMm,
    ipRating,
    phase,
    recommendedBreakerA: [10, 16, 20, 25, 32, 40, 50, 63].includes(recommendedBreakerA) ? recommendedBreakerA : 16,
    recommendedCable,
    symbolShape: symbolShape || 'circle',
    symbolColor,
    customSvgPath: normalized.pathData,
    customSvgData: svgContent,
    shortDesc: `Імпортовано з SVG (${fileName || 'користувацький вектор'})`,
    notes: 'Користувацький графічний символ з призначеними електротехнічними властивостями',
    createdAt: new Date().toISOString(),
    isFavorite: true,
  };
}
