export interface OpeningCatalogItem {
  id: string;
  type: 'door' | 'window';
  name: string;
  widthMm: number;
  shortDesc: string;
  badge: string;
  defaultSwingDirection?: 'in' | 'out' | 'left' | 'right';
  defaultSwing?: 'in' | 'out' | 'left' | 'right';
}

export const OPENINGS_CATALOG: OpeningCatalogItem[] = [
  // ---------------- ДВЕРІ ----------------
  {
    id: 'door_800',
    type: 'door',
    name: 'Міжкімнатні двері 800 мм',
    widthMm: 800,
    shortDesc: 'Стандартні двері для спальні, дитячої, кабінету або кухні',
    badge: 'Д-800',
    defaultSwingDirection: 'in',
  },
  {
    id: 'door_700',
    type: 'door',
    name: 'Двері санвузла 700 мм',
    widthMm: 700,
    shortDesc: 'Компактні двері для ванної кімнати, туалету або гардеробної',
    badge: 'Д-700',
    defaultSwingDirection: 'in',
  },
  {
    id: 'door_900',
    type: 'door',
    name: 'Вхідні двері 900 мм',
    widthMm: 900,
    shortDesc: 'Посилені вхідні двері в тамбур або парадний вхід',
    badge: 'ДВ-900',
    defaultSwingDirection: 'in',
  },
  {
    id: 'door_1000',
    type: 'door',
    name: 'Вхідні двері 1000 мм',
    widthMm: 1000,
    shortDesc: 'Широкі комфортні вхідні двері',
    badge: 'ДВ-1000',
    defaultSwingDirection: 'in',
  },
  {
    id: 'door_1400',
    type: 'door',
    name: 'Двостулкові двері 1400 мм',
    widthMm: 1400,
    shortDesc: 'Парадні розпашні двері до вітальні або їдальні',
    badge: 'Д-1400',
    defaultSwingDirection: 'in',
  },
  {
    id: 'door_1800_slide',
    type: 'door',
    name: 'Розсувні двері на веранду 1800 мм',
    widthMm: 1800,
    shortDesc: 'Портальні розсувні двері на терасу або веранду',
    badge: 'Д-1800',
    defaultSwingDirection: 'out',
  },
  {
    id: 'door_garage_2800',
    type: 'door',
    name: 'Гаражні ворота 2800 мм',
    widthMm: 2800,
    shortDesc: 'Секційні підйомні ворота для в\'їзду автомобіля в гараж',
    badge: 'ВОР-2.8',
    defaultSwingDirection: 'out',
  },

  // ---------------- ВІКНА ----------------
  {
    id: 'win_1400',
    type: 'window',
    name: 'Вікно 2-стулкове 1400 мм',
    widthMm: 1400,
    shortDesc: 'Стандартне двостулкове вікно з поворотно-відкидною стулкою',
    badge: 'В-1400',
  },
  {
    id: 'win_1800',
    type: 'window',
    name: 'Вікно 3-стулкове 1800 мм',
    widthMm: 1800,
    shortDesc: 'Широке тристулкове вікно вітальні або головної спальні',
    badge: 'В-1800',
  },
  {
    id: 'win_1000',
    type: 'window',
    name: 'Вікно 1000 мм (санвузол/котельня)',
    widthMm: 1000,
    shortDesc: 'Одностулкове кватиркове вікно для ванної кімнати чи котельні',
    badge: 'В-1000',
  },
  {
    id: 'win_1200',
    type: 'window',
    name: 'Вікно 1200 мм (гараж/кухня)',
    widthMm: 1200,
    shortDesc: 'Віконний блок для гаражного крила або робочої зони кухні',
    badge: 'В-1200',
  },
  {
    id: 'win_2400',
    type: 'window',
    name: 'Панорамне вікно 2400 мм',
    widthMm: 2400,
    shortDesc: 'Велике французьке вікно в підлогу для максимального освітлення',
    badge: 'В-2400',
  },
];

export const DOOR_OPENINGS_CATALOG = OPENINGS_CATALOG.filter((i) => i.type === 'door');
export const WINDOW_OPENINGS_CATALOG = OPENINGS_CATALOG.filter((i) => i.type === 'window');

