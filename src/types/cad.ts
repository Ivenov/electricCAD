export type CadTool = 
  | 'select'
  | 'pan'
  | 'wall'
  | 'door'
  | 'window'
  | 'socket'
  | 'switch'
  | 'light'
  | 'panel'
  | 'junction'
  | 'wire'
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
  | 'backup';

export type ElectricalElementType =
  // Sockets
  | 'socket_single'
  | 'socket_double'
  | 'socket_triple'
  | 'socket_quad'
  | 'socket_ip44'
  | 'socket_cooker'
  | 'socket_rj45'
  | 'socket_tv'
  | 'socket_usb'
  | 'socket_floor'
  | 'thermostat'
  // Switches
  | 'switch_1g'
  | 'switch_2g'
  | 'switch_3g'
  | 'switch_pass'
  | 'switch_cross'
  | 'switch_dimmer'
  | 'switch_master'
  // Lighting
  | 'light_pendant'
  | 'light_spot'
  | 'light_sconce'
  | 'light_track'
  | 'light_led_strip'
  | 'light_sensor'
  // Panels & Boxes
  | 'panel_cu'
  | 'junction_box'
  | 'led_driver'
  // Heavy Appliances
  | 'ac_indoor'
  | 'water_heater'
  // Backup Power Systems
  | 'backup_inverter'
  | 'backup_battery'
  | 'backup_station'
  | 'backup_ats'
  | 'backup_generator';

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
  switchGroupId?: string; // e.g. "S1", "S2" for matching switch with lights
  ipRating: 'IP20' | 'IP44' | 'IP65';
  phase?: 'L1' | 'L2' | 'L3';
  label?: string;
  notes?: string;
  isBackupPriority?: boolean; // True if powered during blackout
}

export interface WireRoute {
  id: string;
  fromId: string;
  toId: string;
  points?: Point[]; // custom path vertices if manually routed
  mode: 'ortho' | 'curve' | 'direct';
  conduit: 'ceiling' | 'floor' | 'wall_chase';
  cableType: 'VVGng_3x1.5' | 'VVGng_3x2.5' | 'VVGng_3x4' | 'VVGng_3x6' | 'FTP_Cat5e';
  circuitId?: string;
  switchGroupId?: string;
  calculatedLengthM: number;
}

export interface CircuitGroup {
  id: string;
  number: number;
  name: string;
  breakerRatingA: 10 | 16 | 20 | 25 | 32 | 40;
  breakerCurve: 'B' | 'C';
  rcdType: 'none' | 'rcd_30ma' | 'rcd_10ma' | 'rcbo_30ma' | 'rcbo_10ma';
  cableType: 'VVGng_3x1.5' | 'VVGng_3x2.5' | 'VVGng_3x4' | 'VVGng_3x6';
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

export interface FurnitureItem {
  id: string;
  type: 'bed' | 'sofa' | 'dining_table' | 'kitchen_sink' | 'stove' | 'fridge' | 'desk' | 'wardrobe' | 'bath' | 'shower' | 'toilet' | 'wash_basin' | 'tv_cabinet';
  name: string;
  position: Point;
  width: number; // in mm
  height: number; // in mm
  rotation: number;
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
