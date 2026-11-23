import { ElectricalElement, Point, ElectricalElementType } from '../types/cad';

export interface BlockStampItemDef {
  type: ElectricalElementType;
  name: string;
  category: 'socket' | 'switch' | 'light' | 'appliance' | 'custom';
  powerWatts: number;
  ipRating: 'IP20' | 'IP44' | 'IP65';
  label: string;
  offsetPitchIndex: number; // 0, 1, 2, 3 (-1, 0, +1 for centered)
  mountingHeightMm: number;
}

export interface BlockStampTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'multimedia' | 'office' | 'kitchen' | 'entry';
  standardPitchMm: number; // 71 mm між центрами підрозетників
  items: BlockStampItemDef[];
}

export const BLOCK_STAMP_TEMPLATES: BlockStampTemplate[] = [
  {
    id: 'stamp_tv_media',
    name: 'Медіа-пост ТВ',
    description: '3 розетки 230В + 1x RJ45 Cat6 + кабельний вивід HDMI / акустика',
    icon: '📺',
    category: 'multimedia',
    standardPitchMm: 71,
    items: [
      {
        type: 'socket_single',
        name: 'Розетка ТВ 230В #1',
        category: 'socket',
        powerWatts: 300,
        ipRating: 'IP20',
        label: 'ТВ 230В',
        offsetPitchIndex: -2,
        mountingHeightMm: 1100,
      },
      {
        type: 'socket_single',
        name: 'Розетка ТВ 230В #2',
        category: 'socket',
        powerWatts: 300,
        ipRating: 'IP20',
        label: 'ТВ 230В',
        offsetPitchIndex: -1,
        mountingHeightMm: 1100,
      },
      {
        type: 'socket_single',
        name: 'Розетка ТВ 230В #3',
        category: 'socket',
        powerWatts: 300,
        ipRating: 'IP20',
        label: 'ТВ 230В',
        offsetPitchIndex: 0,
        mountingHeightMm: 1100,
      },
      {
        type: 'socket_rj45',
        name: 'Розетка RJ45 Cat6',
        category: 'socket',
        powerWatts: 0,
        ipRating: 'IP20',
        label: 'RJ45 LAN',
        offsetPitchIndex: 1,
        mountingHeightMm: 1100,
      },
      {
        type: 'cable_outlet',
        name: 'Кабель-канал вивід HDMI',
        category: 'socket',
        powerWatts: 0,
        ipRating: 'IP20',
        label: 'HDMI вивід',
        offsetPitchIndex: 2,
        mountingHeightMm: 1100,
      },
    ],
  },
  {
    id: 'stamp_workplace',
    name: 'Робоче місце Home Office',
    description: '3 розетки 230В + 2x RJ45 Ethernet + вимикач локального бра',
    icon: '💻',
    category: 'office',
    standardPitchMm: 71,
    items: [
      {
        type: 'socket_single',
        name: 'Розетка ПК 230В #1',
        category: 'socket',
        powerWatts: 350,
        ipRating: 'IP20',
        label: 'ПК 230В',
        offsetPitchIndex: -2,
        mountingHeightMm: 750,
      },
      {
        type: 'socket_single',
        name: 'Розетка ПК 230В #2',
        category: 'socket',
        powerWatts: 250,
        ipRating: 'IP20',
        label: 'ПК 230В',
        offsetPitchIndex: -1,
        mountingHeightMm: 750,
      },
      {
        type: 'socket_single',
        name: 'Розетка Монітор 230В',
        category: 'socket',
        powerWatts: 150,
        ipRating: 'IP20',
        label: 'Монітор',
        offsetPitchIndex: 0,
        mountingHeightMm: 750,
      },
      {
        type: 'socket_rj45',
        name: 'Подвійна RJ45 Cat6',
        category: 'socket',
        powerWatts: 0,
        ipRating: 'IP20',
        label: '2x RJ45',
        offsetPitchIndex: 1,
        mountingHeightMm: 750,
      },
      {
        type: 'switch_1g',
        name: 'Вимикач бра столу',
        category: 'switch',
        powerWatts: 0,
        ipRating: 'IP20',
        label: 'SW Бра',
        offsetPitchIndex: 2,
        mountingHeightMm: 750,
      },
    ],
  },
  {
    id: 'stamp_kitchen_backsplash',
    name: 'Кухонний пост фартуха',
    description: '3 розетки IP44 + вимикач LED підсвітки робочої поверхні (+1050 мм)',
    icon: '🍳',
    category: 'kitchen',
    standardPitchMm: 71,
    items: [
      {
        type: 'socket_ip44',
        name: 'Розетка фартуха IP44 #1',
        category: 'socket',
        powerWatts: 2000,
        ipRating: 'IP44',
        label: 'Фартух IP44',
        offsetPitchIndex: -1.5,
        mountingHeightMm: 1050,
      },
      {
        type: 'socket_ip44',
        name: 'Розетка фартуха IP44 #2',
        category: 'socket',
        powerWatts: 2000,
        ipRating: 'IP44',
        label: 'Фартух IP44',
        offsetPitchIndex: -0.5,
        mountingHeightMm: 1050,
      },
      {
        type: 'socket_ip44',
        name: 'Розетка фартуха IP44 #3',
        category: 'socket',
        powerWatts: 2000,
        ipRating: 'IP44',
        label: 'Фартух IP44',
        offsetPitchIndex: 0.5,
        mountingHeightMm: 1050,
      },
      {
        type: 'switch_1g',
        name: 'Вимикач LED підсвітки стільниці',
        category: 'switch',
        powerWatts: 0,
        ipRating: 'IP44',
        label: 'SW LED',
        offsetPitchIndex: 1.5,
        mountingHeightMm: 1050,
      },
    ],
  },
  {
    id: 'stamp_entry_hall',
    name: 'Вхідний вузол (Передпокій)',
    description: '2-клавішний вимикач світла + терморегулятор теплої підлоги + домофон',
    icon: '🚪',
    category: 'entry',
    standardPitchMm: 71,
    items: [
      {
        type: 'switch_2g',
        name: '2-клавішний вимикач входу',
        category: 'switch',
        powerWatts: 0,
        ipRating: 'IP20',
        label: 'SW Вхід',
        offsetPitchIndex: -1,
        mountingHeightMm: 900,
      },
      {
        type: 'thermostat',
        name: 'Терморегулятор теплої підлоги',
        category: 'socket',
        powerWatts: 450,
        ipRating: 'IP20',
        label: 'Термостат',
        offsetPitchIndex: 0,
        mountingHeightMm: 900,
      },
      {
        type: 'intercom',
        name: 'Відеодомофон / Аудіотрубка',
        category: 'custom',
        powerWatts: 20,
        ipRating: 'IP20',
        label: 'Домофон',
        offsetPitchIndex: 1,
        mountingHeightMm: 1400,
      },
    ],
  },
];

/**
 * Генерує набір елементів блоку зі стандартним кроком 71 мм
 */
export function generateBlockStampElements(
  stamp: BlockStampTemplate,
  centerPos: Point,
  rotationDeg = 0,
  wallId?: string
): ElectricalElement[] {
  const rad = (rotationDeg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);

  const blockStampId = `stamp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  // Крок між підрозетниками 71 мм в координатах CAD: scale 0.1 -> 7.1 px
  const pitchPx = (stamp.standardPitchMm / 10);

  return stamp.items.map((item, idx) => {
    const offsetPx = item.offsetPitchIndex * pitchPx;
    const posX = Math.round(centerPos.x + ux * offsetPx);
    const posY = Math.round(centerPos.y + uy * offsetPx);

    return {
      id: `elem_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      category: item.category,
      type: item.type,
      name: item.name,
      position: { x: posX, y: posY },
      rotation: rotationDeg,
      wallId,
      mountingHeightMm: item.mountingHeightMm,
      powerWatts: item.powerWatts,
      ipRating: item.ipRating,
      label: item.label,
      blockStampId,
      notes: `Блок «${stamp.name}» (пост ${idx + 1}/${stamp.items.length}, крок 71мм)`,
    };
  });
}
