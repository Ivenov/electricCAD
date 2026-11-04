export type CadTool = 
  | 'select'
  | 'pan'
  | 'wall'
  | 'room'
  | 'door'
  | 'window'
  | 'socket'
  | 'switch'
  | 'light'
  | 'panel'
  | 'junction'
  | 'wire'
  | 'furniture'
  | 'measure';

export type ViewFilterMode = 
  | 'all' 
  | 'sockets' 
  | 'lighting' 
  | 'wiring' 
  | 'mounting_plan';

export type ElectricalCategory = 
  | 'socket' 
  | 'switch' 
  | 'light' 
  | 'panel' 
  | 'junction' 
  | 'appliance'
  | 'backup'
  | 'custom';

export type ElectricalElementType =
  // Sockets
  | 'socket_single'
  | 'socket_double'
  | 'socket_triple'
  | 'socket_quad'
  | 'socket_ip44'
  | 'socket_outdoor'
  | 'socket_cooker'
  | 'socket_3phase'
  | 'socket_rj45'
  | 'socket_tv'
  | 'socket_usb'
  | 'socket_floor'
  | 'cable_outlet'
  | 'thermostat'
  // Switches
  | 'switch_1g'
  | 'switch_2g'
  | 'switch_3g'
  | 'switch_pass'
  | 'switch_cross'
  | 'switch_dimmer'
  | 'switch_impulse'
  | 'switch_smart'
  | 'switch_master'
  | 'motion_sensor'
  // Lighting
  | 'light_pendant'
  | 'light_spot'
  | 'light_sconce'
  | 'light_track'
  | 'light_led_strip'
  | 'light_outdoor'
  | 'light_emergency'
  | 'light_sensor'
  // Panels & Boxes
  | 'panel_cu'
  | 'panel_multimedia'
  | 'junction_box'
  | 'junction_box_light'
  | 'junction_box_power'
  | 'junction_box_waterproof'
  | 'grounding_bus'
  | 'led_driver'
  // Heavy Appliances
  | 'ac_indoor'
  | 'water_heater'
  | 'hob_induction'
  | 'oven_electric'
  | 'washing_machine'
  | 'dryer_machine'
  | 'dishwasher'
  | 'vent_exhaust'
  | 'electric_boiler'
  | 'water_leak_valve'
  // Backup Power Systems
  | 'backup_inverter'
  | 'backup_battery'
  | 'backup_station'
  | 'backup_ats'
  | 'backup_generator'
  // Smart Home & KNX Automation
  | 'knx_actuator'
  | 'knx_power_supply'
  | 'leak_sensor'
  // Custom Library Elements
  | 'custom_element';

export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number; // in mm, standard 150mm or 100mm
  type?: 'bearing' | 'partition';
}

export interface WallOpening {
  id: string;
  wallId: string;
  type: 'door' | 'window';
  positionRatio: number; // 0 to 1 along wall
  width: number; // in mm (e.g. 800 or 1200)
  height?: number; // in mm (e.g. 2100 for door, 1400 for window)
  elevation?: number; // mounting height from floor in mm (e.g. 0 for door, 900 for window)
  swingDirection?: 'left' | 'right' | 'in' | 'out';
}

export interface Room {
  id: string;
  name: string;
  points: Point[]; // boundary polygon
  areaM2: number;
  type: 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'hallway' | 'balcony' | 'office' | 'utility' | 'outdoor' | 'other';
}

export interface ElectricalElement {
  id: string;
  category: ElectricalCategory;
  type: ElectricalElementType;
  name: string;
  position: Point;
  rotation: number; // degrees: 0, 90, 180, 270 or arbitrary
  wallId?: string;
  mountingHeightMm: number; // e.g. 300, 900, 1050, 2200, 2700
  powerWatts: number;
  circuitId?: string; // id of CircuitGroup
  switchGroupId?: string; // e.g. "a", "b", "S1", "S2" for matching switch with lights
  switchGangs?: { gangId: string; label: string; switchGroupId: string }[]; // for 2-gang and 3-gang switches
  ipRating: 'IP20' | 'IP44' | 'IP65';
  phase?: 'L1' | 'L2' | 'L3';
  label?: string;
  notes?: string;
  isBackupPriority?: boolean; // True if powered during blackout
  isCustom?: boolean;
  customSymbolShape?: CustomSymbolShape;
  customSymbolColor?: string;
  customLibraryId?: string;
}

export interface WireRoute {
  id: string;
  fromId: string;
  toId: string;
  points?: Point[]; // custom path vertices if manually routed
  mode: 'ortho' | 'curve' | 'direct';
  conduit: 'ceiling' | 'floor' | 'wall_chase';
  cableType: 'VVGng_3x1.5' | 'VVGng_3x2.5' | 'VVGng_3x4' | 'VVGng_3x6' | 'FTP_Cat5e' | 'KNX_Bus';
  busType?: 'power' | 'knx' | 'ethernet';
  circuitId?: string;
  switchGroupId?: string;
  cableTag?: string; // e.g. "W1-01", "W2-03"
  calculatedLengthM: number;
  isManual?: boolean; // If true, preserved during automatic routing
  routingMethod?: 'trunk' | 'branch' | 'daisy' | 'radial' | 'manual';
}

export interface CircuitGroup {
  id: string;
  number: number;
  name: string;
  breakerRatingA: 10 | 16 | 20 | 25 | 32 | 40;
  breakerCurve: 'B' | 'C';
  rcdType: 'none' | 'rcd_30ma' | 'rcd_10ma' | 'rcbo_30ma' | 'rcbo_10ma';
  cableType: 'VVGng_3x1.5' | 'VVGng_3x2.5' | 'VVGng_3x4' | 'VVGng_3x6' | 'KNX_Bus';
  phase: 'L1' | 'L2' | 'L3';
  color: string;
  description?: string;
  isBackupPriority?: boolean; // Marked as non-interruptible emergency line
}

export interface BackupSystemConfig {
  enabled: boolean;
  type: 'hybrid_inverter' | 'power_station' | 'ats_generator' | 'manual_switch';
  inverterPowerW: number; // e.g. 5000 W
  batteryCapacityWh: number; // e.g. 5120 Wh (5.12 kWh)
  batteryChemistry: 'lifepo4' | 'li_ion' | 'agm_gel';
  batteryVoltageV: 12 | 24 | 48 | 51.2;
  depthOfDischargePercent: number; // e.g. 90% for LiFePO4, 50% for AGM
  inverterEfficiencyPercent: number; // e.g. 92%
  atsTransferTimeMs: number; // e.g. 10ms UPS, 15000ms ATS generator
  generatorPowerW?: number; // e.g. 5500 W
  mode: 'standard' | 'economy' | 'night_saver';
}

export type FurnitureCategory = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'office' | 'custom';

export type CustomSymbolShape =
  | 'circle'
  | 'socket'
  | 'switch'
  | 'light'
  | 'motor'
  | 'triangle'
  | 'square'
  | 'cross'
  | 'rack'
  | 'star'
  | 'diamond'
  | 'ev_charger'
  | 'speaker'
  | 'sensor';

export interface FurnitureItem {
  id: string;
  type: 'bed' | 'sofa' | 'dining_table' | 'kitchen_sink' | 'stove' | 'fridge' | 'desk' | 'wardrobe' | 'bath' | 'shower' | 'toilet' | 'wash_basin' | 'tv_cabinet' | string;
  name: string;
  position: Point;
  width: number; // in mm
  height: number; // in mm (depth)
  rotation: number;
  category?: FurnitureCategory;
  cadShape?: string;
  electricalHints?: string[];
  notes?: string;
  customItemId?: string;
}

export interface CustomLibraryItem {
  id: string;
  name: string;
  kind: 'electrical' | 'furniture';
  category: ElectricalCategory | 'furniture';
  // Electrical properties
  electricalType?: string;
  powerWatts?: number;
  mountingHeightMm?: number;
  ipRating?: 'IP20' | 'IP44' | 'IP65';
  phase?: 'L1' | 'L2' | 'L3' | '3-phase';
  recommendedBreakerA?: 10 | 16 | 20 | 25 | 32 | 40 | 50 | 63;
  recommendedCable?: 'VVGng_3x1.5' | 'VVGng_3x2.5' | 'VVGng_3x4' | 'VVGng_3x6' | 'FTP_Cat5e' | 'KNX_Bus';
  symbolShape?: CustomSymbolShape;
  symbolColor?: string;
  // Furniture properties
  furnitureType?: FurnitureItem['type'] | string;
  widthMm?: number;
  heightMm?: number;
  cadShape?: string;
  // Metadata & hints
  shortDesc?: string;
  notes?: string;
  electricalHints?: string[];
  createdAt?: string;
  isFavorite?: boolean;
}

export interface BackgroundBlueprint {
  dataUrl: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity: number;
  locked: boolean;
}

export interface CadProject {
  id: string;
  title: string;
  author: string;
  date: string;
  scale: number; // e.g. 1px = 10mm (0.1 scale)
  ceilingHeightMm: number; // standard 2700mm
  gridStepMm: number; // snap grid 100mm
  supplyPhase: '1-phase' | '3-phase';
  mainBreakerRatingA: number;
  backupSystem?: BackupSystemConfig;
  backgroundImage?: BackgroundBlueprint;
  rooms: Room[];
  walls: Wall[];
  openings: WallOpening[];
  elements: ElectricalElement[];
  wires: WireRoute[];
  circuits: CircuitGroup[];
  furniture: FurnitureItem[];
  customLibrary?: CustomLibraryItem[];
  autoRoutingEnabled?: boolean;
}

export interface BomItem {
  category: string;
  name: string;
  spec: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface AuditIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  elementId?: string;
  circuitId?: string;
  autoFixAvailable?: boolean;
}

export interface LayerVisibilityConfig {
  walls: boolean;            // Стіни та перегородки (A-WALL)
  openings: boolean;         // Вікна та двері (A-DOOR-WIND)
  rooms: boolean;            // Приміщення та площі (A-AREA)
  sockets: boolean;          // Розетки та прилади (E-POWR-SOCK)
  switches: boolean;         // Вимикачі світла (E-LITE-SWIT)
  lights: boolean;           // Світильники та люстри (E-LITE-FIXT)
  wiresPower: boolean;       // Силові кабельні траси (E-POWR-CABL)
  wiresLighting: boolean;    // Траси освітлення (E-LITE-CABL)
  conduitChase: boolean;     // Штроби у стінах (E-CHASE)
  conduitCeiling: boolean;   // Траси по стелі у гофрі (E-CEIL)
  conduitFloor: boolean;     // Траси у стяжці підлоги (E-FLOR)
  wiresKnx?: boolean;        // Шина автоматизації KNX / Smart Home (E-KNX-BUS)
  annotations: boolean;      // Виноски, бірки та примітки (E-ANNO)
  dimensions: boolean;       // Розміри стін (A-DIMS)
  heights: boolean;          // Висотні позначки (E-HGHT)
  furniture: boolean;        // Меблі та сантехніка (A-FURN)
  blueprint: boolean;        // Підкладка креслення БТІ (A-BLPR)
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibilityConfig = {
  walls: true,
  openings: true,
  rooms: true,
  sockets: true,
  switches: true,
  lights: true,
  wiresPower: true,
  wiresLighting: true,
  conduitChase: true,
  conduitCeiling: true,
  conduitFloor: true,
  wiresKnx: true,
  annotations: true,
  dimensions: true,
  heights: true,
  furniture: true,
  blueprint: true,
};

/**
 * Модульна компоновка електрощита на DIN-рейку (Enclosure & DIN-Rail Builder)
 */
export interface DinModuleItem {
  id: string;
  type:
    | 'main_mcb'
    | 'spd'
    | 'voltage_relay'
    | 'rcd'
    | 'mcb'
    | 'rcbo'
    | 'contactor'
    | 'knx_actuator'
    | 'knx_psu'
    | 'terminal_block'
    | 'blank';
  name: string;
  subtitle?: string;
  widthTe: number; // ширина в модулях 18мм (TE)
  phase?: 'L1' | 'L2' | 'L3' | '3P' | '1P+N';
  ratingA?: number;
  curve?: 'B' | 'C' | 'D';
  rcdCurrentMa?: 10 | 30 | 100 | 300;
  circuitId?: string;
  busbarConnection?: 'L1' | 'L2' | 'L3' | 'N' | 'none';
  color?: string;
}

export interface DinRailRow {
  id: string;
  index: number;
  name: string;
  capacityTe: number; // зазвичай 12 або 18 TE
  modules: DinModuleItem[];
  hasBusbar?: boolean;
  busbarType?: '1P' | '3P' | 'none';
}

export interface EnclosureConfig {
  brand: 'Hager' | 'Schneider' | 'ABB' | 'General';
  model: string; // e.g. "Hager Volta VU36NE", "Schneider Resi9 36M"
  totalRows: number;
  rowCapacityTe: number;
  totalTe: number;
  mounting: 'flush' | 'surface';
  rows: DinRailRow[];
}
