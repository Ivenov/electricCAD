import { FurnitureCategory, FurnitureItem } from '../types/cad';

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  type: FurnitureItem['type'];
  defaultWidthMm: number;
  defaultHeightMm: number; // depth
  cadShape: string;
  shortDesc: string;
  badge: string;
  electricalHints: string[];
}

export const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  // ==========================================
  // ВІТАЛЬНЯ (LIVING ROOM)
  // ==========================================
  {
    id: 'sofa_3seater',
    name: 'Диван прямий 3-місний',
    category: 'living',
    type: 'sofa',
    defaultWidthMm: 2200,
    defaultHeightMm: 950,
    cadShape: 'sofa_straight',
    shortDesc: 'Комфортний м’який диван з підлокітниками та подушками',
    badge: '2200×950',
    electricalHints: [
      'Розетки з боків дивана на висоті +300 мм для торшера чи зарядки телефонів',
      'Можливе розміщення підлогової лючкової розетки, якщо диван стоїть посередині зали',
    ],
  },
  {
    id: 'sofa_corner_l',
    name: 'Диван кутовий L-подібний',
    category: 'living',
    type: 'sofa',
    defaultWidthMm: 2600,
    defaultHeightMm: 1800,
    cadShape: 'sofa_corner',
    shortDesc: 'Кутовий диван для зони відпочинку та домашнього кінотеатру',
    badge: '2600×1800',
    electricalHints: [
      'Розетки по периметру за спинкою дивана на висоті +750 мм або в кутку на +300 мм',
    ],
  },
  {
    id: 'armchair_soft',
    name: 'Крісло відпочинку',
    category: 'living',
    type: 'sofa',
    defaultWidthMm: 900,
    defaultHeightMm: 850,
    cadShape: 'armchair',
    shortDesc: 'М’яке індивідуальне крісло',
    badge: '900×850',
    electricalHints: [
      'Розетка на +300 мм поруч для лампи читання або торшера',
    ],
  },
  {
    id: 'coffee_table_rect',
    name: 'Журнальний столик',
    category: 'living',
    type: 'dining_table',
    defaultWidthMm: 1000,
    defaultHeightMm: 600,
    cadShape: 'coffee_table',
    shortDesc: 'Низький столик перед диваном',
    badge: '1000×600',
    electricalHints: [],
  },
  {
    id: 'tv_unit_modern',
    name: 'ТВ-консоль / медіа-тумба',
    category: 'living',
    type: 'tv_cabinet',
    defaultWidthMm: 2000,
    defaultHeightMm: 450,
    cadShape: 'tv_unit',
    shortDesc: 'Консоль під телевізор, ресивер та приставки',
    badge: '2000×450',
    electricalHints: [
      'Рекомендовано блок 4×220В + 2×RJ45 + кабель-канал HDMI на висоті +1100 мм за панеллю ТВ',
      'Нижній блок розеток на +300 мм (3×220В) для роутера, ТВ-приставки та саундбара',
    ],
  },

  // ==========================================
  // СПАЛЬНЯ (BEDROOM)
  // ==========================================
  {
    id: 'bed_double_180',
    name: 'Ліжко двоспальне King Size',
    category: 'bedroom',
    type: 'bed',
    defaultWidthMm: 1800,
    defaultHeightMm: 2000,
    cadShape: 'bed_double',
    shortDesc: 'Двоспальне ліжко 180×200 см з узголів’ям та подушками',
    badge: '1800×2000',
    electricalHints: [
      'Блоки розеток 2×220В + USB над приліжковими тумбами на висоті +650 мм з обох боків',
      'Прохідні або перехресні вимикачі основного світла та окремі вимикачі бра на висоті +650..750 мм',
    ],
  },
  {
    id: 'bed_double_160',
    name: 'Ліжко двоспальне Queen Size',
    category: 'bedroom',
    type: 'bed',
    defaultWidthMm: 1600,
    defaultHeightMm: 2000,
    cadShape: 'bed_double',
    shortDesc: 'Стандартне двоспальне ліжко 160×200 см',
    badge: '1600×2000',
    electricalHints: [
      'Блоки розеток 2×220В + USB на висоті +650 мм ліворуч та праворуч від узголів’я',
    ],
  },
  {
    id: 'bed_single_90',
    name: 'Ліжко односпальне',
    category: 'bedroom',
    type: 'bed',
    defaultWidthMm: 900,
    defaultHeightMm: 2000,
    cadShape: 'bed_single',
    shortDesc: 'Дитяче або гостьове односпальне ліжко 90×200 см',
    badge: '900×2000',
    electricalHints: [
      'Розетка 2×220В + USB біля узголів’я на висоті +650 мм',
    ],
  },
  {
    id: 'wardrobe_200',
    name: 'Шафа-купе / Гардероб 2.0м',
    category: 'bedroom',
    type: 'wardrobe',
    defaultWidthMm: 2000,
    defaultHeightMm: 600,
    cadShape: 'wardrobe',
    shortDesc: 'Тридверна містка шафа глибиною 600 мм',
    badge: '2000×600',
    electricalHints: [
      'Вивід 220В на висоті +2400..2600 мм під стелею для LED-підсвітки штанги з кінцевим вимикачем',
    ],
  },
  {
    id: 'vanity_table',
    name: 'Туалетний столик з дзеркалом',
    category: 'bedroom',
    type: 'desk',
    defaultWidthMm: 1100,
    defaultHeightMm: 450,
    cadShape: 'vanity_table',
    shortDesc: 'Столик для макіяжу з місцем під пуф',
    badge: '1100×450',
    electricalHints: [
      'Розетки 2×220В на висоті +750..800 мм для фена та плойки',
      'Вивід кабелю на висоті +1600 мм для дзеркала з круговою LED-підсвіткою',
    ],
  },

  // ==========================================
  // КУХНЯ (KITCHEN)
  // ==========================================
  {
    id: 'kitchen_counter_linear',
    name: 'Кухонний фронт (стільниця)',
    category: 'kitchen',
    type: 'kitchen_sink',
    defaultWidthMm: 2400,
    defaultHeightMm: 600,
    cadShape: 'kitchen_counter',
    shortDesc: 'Робоча кухонна поверхня глибиною 600 мм',
    badge: '2400×600',
    electricalHints: [
      'Блоки розеток фартуха кухні на висоті +1050 мм (по 2-3 пости в зоні нарізки та приготування)',
      'Вивід 220В для витяжки на висоті +2000..2100 мм по осі варильної поверхні',
      'Вивід на +2400 мм для підсвітки робочої зони під верхніми шафами',
    ],
  },
  {
    id: 'kitchen_island_modern',
    name: 'Кухонний острів',
    category: 'kitchen',
    type: 'dining_table',
    defaultWidthMm: 1800,
    defaultHeightMm: 900,
    cadShape: 'kitchen_island',
    shortDesc: 'Острів для приготування та барної посадки',
    badge: '1800×900',
    electricalHints: [
      'Підведення кабелю через стяжку підлоги (труба в підлозі)',
      'Висувні врізні розетки (Pop-up socket) в стільниці острова',
    ],
  },
  {
    id: 'dining_table_chairs',
    name: 'Обідній стіл зі стільцями',
    category: 'kitchen',
    type: 'dining_table',
    defaultWidthMm: 1400,
    defaultHeightMm: 850,
    cadShape: 'dining_table',
    shortDesc: 'Стіл на 4-6 персон для їдальні або кухні',
    badge: '1400×850',
    electricalHints: [
      'Підвісна люстра суворо по центру стола на висоті 1500 мм від чистої підлоги',
    ],
  },
  {
    id: 'kitchen_sink_basin',
    name: 'Кухонна мийка з крилом',
    category: 'kitchen',
    type: 'kitchen_sink',
    defaultWidthMm: 800,
    defaultHeightMm: 500,
    cadShape: 'kitchen_sink',
    shortDesc: 'Врізна мийка з чашею та змішувачем',
    badge: '800×500',
    electricalHints: [
      'Розетка для подрібнювача відходів (диспоузера) на висоті +450 мм під мийкою (IP44)',
      'Заборонено встановлення розеток 220В над крилом мийки ближче 500 мм (ПУЕ §7.1.48)',
    ],
  },
  {
    id: 'cooktop_induction_4',
    name: 'Варильна поверхня 4 конфорки',
    category: 'kitchen',
    type: 'stove',
    defaultWidthMm: 600,
    defaultHeightMm: 520,
    cadShape: 'cooktop',
    shortDesc: 'Індукційна / електрична варильна поверхня',
    badge: '600×520',
    electricalHints: [
      'Окремий силовий кабель ВВГнгд 3×6 мм² (1 фаза 32А) або 5×2.5 мм² (3 фази 16А)',
      'Силовий клемник або вивід на висоті +600..700 мм від підлоги',
    ],
  },
  {
    id: 'refrigerator_standard',
    name: 'Холодильник двокамерний',
    category: 'kitchen',
    type: 'fridge',
    defaultWidthMm: 600,
    defaultHeightMm: 650,
    cadShape: 'fridge',
    shortDesc: 'Окремостоячий холодильник No-Frost',
    badge: '600×650',
    electricalHints: [
      'Розетка на висоті +300 мм поруч у сусідній кухонній базі (або на висоті +100 мм в цоколі)',
      'Рекомендовано виділену лінію «Невідключаєма група» (для роботи під час відпустки/блекауту)',
    ],
  },
  {
    id: 'dishwasher_builtin',
    name: 'Посудомийна машина 60 см',
    category: 'kitchen',
    type: 'kitchen_sink',
    defaultWidthMm: 600,
    defaultHeightMm: 600,
    cadShape: 'dishwasher',
    shortDesc: 'Вбудована посудомийна машина',
    badge: '600×600',
    electricalHints: [
      'Розетка на висоті +100..150 мм у сусідній секції під мийкою або шафою (заборонено прямо за ПММ)',
      'Окрема розеточна лінія 16А з ПЗВ 10мА / 30мА',
    ],
  },

  // ==========================================
  // САНВУЗОЛ ТА САНТЕХНІКА (BATHROOM)
  // ==========================================
  {
    id: 'bathtub_standard_170',
    name: 'Ванна акрилова 170×75 см',
    category: 'bathroom',
    type: 'bath',
    defaultWidthMm: 1700,
    defaultHeightMm: 750,
    cadShape: 'bathtub',
    shortDesc: 'Прямокутна ванна з переливом',
    badge: '1700×750',
    electricalHints: [
      'Зона 1 за ДБН В.2.5-23:2010: встановлення розеток 230В категорично заборонено!',
      'Обов’язкове підключення металевих частин до коробки зрівнювання потенціалів (КУП / ДСЗП)',
    ],
  },
  {
    id: 'shower_cabin_corner',
    name: 'Душова кабіна / куточок 90×90',
    category: 'bathroom',
    type: 'shower',
    defaultWidthMm: 900,
    defaultHeightMm: 900,
    cadShape: 'shower',
    shortDesc: 'Скляна душова кабіна з піддоном чи трапом',
    badge: '900×900',
    electricalHints: [
      'Зона 1: заборона будь-яких комутаційних апаратів та розеток на відстані менше 60 см від краю',
    ],
  },
  {
    id: 'toilet_wall_hung',
    name: 'Унітаз підвісний з інсталяцією',
    category: 'bathroom',
    type: 'toilet',
    defaultWidthMm: 400,
    defaultHeightMm: 550,
    cadShape: 'toilet',
    shortDesc: 'Підвісний унітаз з клавішею змиву інсталяції',
    badge: '400×550',
    electricalHints: [
      'Розетка IP44 на висоті +300 мм праворуч для електробіде або розумної кришки унітазу',
    ],
  },
  {
    id: 'washbasin_vanity_80',
    name: 'Умивальник з тумбою 80 см',
    category: 'bathroom',
    type: 'wash_basin',
    defaultWidthMm: 800,
    defaultHeightMm: 500,
    cadShape: 'washbasin',
    shortDesc: 'Керамічний умивальник зі змішувачем та дзеркалом',
    badge: '800×500',
    electricalHints: [
      'Розетка IP44 з кришкою на висоті +1000..1050 мм (відстань від зрізу води ≥ 600 мм)',
      'Вивід кабелю 220В на висоті +1600 мм для дзеркала з LED-підсвіткою та підігрівом від запотівання',
    ],
  },
  {
    id: 'washing_machine_std',
    name: 'Пральна машина',
    category: 'bathroom',
    type: 'bath',
    defaultWidthMm: 600,
    defaultHeightMm: 600,
    cadShape: 'washing_machine',
    shortDesc: 'Фронтальне завантаження 6-8 кг',
    badge: '600×600',
    electricalHints: [
      'Розетка IP44 на висоті +1000 мм (або +300 мм у вологозахищеному виконанні)',
      'Окремий захисний апарат: автомат 16А + ПЗВ 10мА (або дифавтомат RCBO 16A 10mA)',
    ],
  },

  // ==========================================
  // ОФІС ТА РОБОЧЕ МІСЦЕ (OFFICE)
  // ==========================================
  {
    id: 'desk_office_140',
    name: 'Робочий комп’ютерний стіл',
    category: 'office',
    type: 'desk',
    defaultWidthMm: 1400,
    defaultHeightMm: 750,
    cadShape: 'desk',
    shortDesc: 'Стіл для ноутбука / ПК, моніторів та периферії',
    badge: '1400×750',
    electricalHints: [
      'Блок розеток 3-4×220В + RJ45 над стільницею на висоті +750 мм (або під столом +300 мм)',
      'Вимикач або розетка для настільної лампи',
    ],
  },
  {
    id: 'office_chair_ergo',
    name: 'Офісне ергономічне крісло',
    category: 'office',
    type: 'desk',
    defaultWidthMm: 650,
    defaultHeightMm: 650,
    cadShape: 'office_chair',
    shortDesc: 'Поворотне крісло на хрестовині з колесами',
    badge: '650×650',
    electricalHints: [],
  },
  {
    id: 'bookshelf_unit',
    name: 'Стелаж для книг та документів',
    category: 'office',
    type: 'wardrobe',
    defaultWidthMm: 1000,
    defaultHeightMm: 350,
    cadShape: 'bookshelf',
    shortDesc: 'Відкритий стелаж глибиною 350 мм',
    badge: '1000×350',
    electricalHints: [],
  },
];

export const FURNITURE_CATEGORIES: { id: FurnitureCategory; label: string; icon: string }[] = [
  { id: 'living', label: 'Вітальня', icon: '🛋️' },
  { id: 'bedroom', label: 'Спальня', icon: '🛏️' },
  { id: 'kitchen', label: 'Кухня', icon: '🍳' },
  { id: 'bathroom', label: 'Санвузол', icon: '🚿' },
  { id: 'office', label: 'Офіс / Кабінет', icon: '💻' },
  { id: 'custom', label: 'Власні меблі', icon: '⭐' },
];
