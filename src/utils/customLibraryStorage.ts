import { CustomLibraryItem } from '../types/cad';

const STORAGE_KEY = 'electroplan_custom_library';

export const DEFAULT_CUSTOM_ITEMS: CustomLibraryItem[] = [
  {
    id: 'custom_ev_wallbox_22kw',
    name: 'Зарядна станція електромобіля (Wallbox 22 кВт)',
    kind: 'electrical',
    category: 'custom',
    electricalType: 'custom_element',
    powerWatts: 22000,
    mountingHeightMm: 1300,
    ipRating: 'IP65',
    phase: '3-phase',
    recommendedBreakerA: 32,
    recommendedCable: 'VVGng_3x6',
    symbolShape: 'ev_charger',
    symbolColor: '#10b981',
    shortDesc: 'Трифазна швидкісна зарядка електромобіля Type 2',
    notes: 'ПУЕ: вимагає диференційного захисту ПЗВ Тип B або EV (DC 6mA) та окремої лінії',
    electricalHints: ['Окрема трифазна лінія від ВРП', 'Кабель мідний не менше 5×6 мм²', 'ПЗВ 40А 30мА Тип В / A-EV'],
    createdAt: new Date().toISOString(),
    isFavorite: true,
  },
  {
    id: 'custom_server_rack_19',
    name: 'Серверна комутаційна шафа 19" 12U',
    kind: 'electrical',
    category: 'custom',
    electricalType: 'custom_element',
    powerWatts: 1500,
    mountingHeightMm: 1600,
    ipRating: 'IP20',
    phase: 'L1',
    recommendedBreakerA: 16,
    recommendedCable: 'VVGng_3x2.5',
    symbolShape: 'rack',
    symbolColor: '#0284c7',
    shortDesc: 'Шафа слабкострумових мереж, патч-панелі, PoE світча та NVR',
    notes: 'Підведення витої пари Cat6 з усіх приміщень + резервне живлення від ДБЖ (UPS)',
    electricalHints: ['Окрема група живлення 16А від секції ДБЖ', 'Шина вирівнювання потенціалів 4 мм² до ГЗШ'],
    createdAt: new Date().toISOString(),
    isFavorite: true,
  },
  {
    id: 'custom_floor_heating_wifi',
    name: 'Тепла підлога з WiFi терморегулятором',
    kind: 'electrical',
    category: 'custom',
    electricalType: 'custom_element',
    powerWatts: 850,
    mountingHeightMm: 900,
    ipRating: 'IP20',
    phase: 'L1',
    recommendedBreakerA: 16,
    recommendedCable: 'VVGng_3x2.5',
    symbolShape: 'square',
    symbolColor: '#f97316',
    shortDesc: 'Електричний нагрівальний мат або кабель з датчиком температури',
    notes: 'ПУЕ: захист ПЗВ 10мА / 30мА обов’язковий. Трубка гофрована 16мм для датчика в підлогу',
    electricalHints: ['Монтажна коробка глибиною 60мм для термостата', 'Окремий датчик NTC у підлогу між витками кабелю'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'custom_ceiling_speaker',
    name: 'Акустична колонка стельова (Multiroom Hi-Fi)',
    kind: 'electrical',
    category: 'custom',
    electricalType: 'custom_element',
    powerWatts: 60,
    mountingHeightMm: 2700,
    ipRating: 'IP20',
    phase: 'L1',
    recommendedBreakerA: 10,
    recommendedCable: 'FTP_Cat5e',
    symbolShape: 'speaker',
    symbolColor: '#a855f7',
    shortDesc: 'Вбудована безрамкова акустика 8 Ом у гіпсокартонну стелю',
    notes: 'Акустичний мідний кабель OFC 2×1.5 мм² або Cat6 до підсилювача у стійці',
    electricalHints: ['Прокладка разом зі слабострумовими трасами на відстані від 230V'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'custom_wine_cooler',
    name: 'Винна шафа вбудована',
    kind: 'electrical',
    category: 'custom',
    electricalType: 'custom_element',
    powerWatts: 350,
    mountingHeightMm: 300,
    ipRating: 'IP20',
    phase: 'L1',
    recommendedBreakerA: 16,
    recommendedCable: 'VVGng_3x2.5',
    symbolShape: 'motor',
    symbolColor: '#ec4899',
    shortDesc: 'Двозонний винний холодильник із компресором',
    notes: 'Підключення до пріоритетної лінії резервного живлення',
    electricalHints: ['Розетка +300 мм у сусідній базі кухні'],
    createdAt: new Date().toISOString(),
  },
];

export function getStoredCustomLibrary(): CustomLibraryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Initialize with default custom items
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CUSTOM_ITEMS));
      return DEFAULT_CUSTOM_ITEMS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_CUSTOM_ITEMS;
  } catch {
    return DEFAULT_CUSTOM_ITEMS;
  }
}

export function saveStoredCustomLibrary(items: CustomLibraryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save custom library to localStorage', err);
  }
}

export function downloadCustomLibraryJson(items: CustomLibraryItem[], fileName = 'ElectroPlan_Custom_Library.json'): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(items, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function parseCustomLibraryJson(jsonText: string): CustomLibraryItem[] {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    throw new Error('Файл не містить валідного масиву елементів бібліотеки');
  }
  return parsed.filter((item) => item && typeof item.name === 'string' && item.id);
}
