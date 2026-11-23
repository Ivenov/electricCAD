import React, { useState } from 'react';
import {
  MousePointer,
  Hand,
  Square,
  Zap,
  ToggleLeft,
  Lightbulb,
  Box,
  Boxes,
  Cpu,
  GitBranch,
  Ruler,
  Grid,
  Undo2,
  Redo2,
  Tag,
  Maximize2,
  Sofa,
  DoorOpen,
  AppWindow,
  Shapes,
  FileText,
  Layers,
  Sparkles,
  Plus,
  Split,
  Crosshair,
  MessageSquarePlus,
} from 'lucide-react';
import { CadTool, ViewFilterMode, ElectricalCategory, Room, FurnitureCategory, CustomLibraryItem } from '../../types/cad';
import { CatalogItem, ELECTRICAL_CATALOG } from '../../data/electricalCatalog';
import { OpeningCatalogItem, OPENINGS_CATALOG } from '../../data/openingsCatalog';
import { FurnitureCatalogItem, FURNITURE_CATALOG, FURNITURE_CATEGORIES } from '../../data/furnitureCatalog';

export interface RoomPreset {
  type: Room['type'];
  name: string;
  desc: string;
  badge: string;
}

export const ROOM_PRESETS: RoomPreset[] = [
  { type: 'living', name: 'Вітальня / Зала', desc: 'Основна житлова зона', badge: 'Житлова' },
  { type: 'bedroom', name: 'Спальня', desc: 'Зона відпочинку', badge: 'Житлова' },
  { type: 'kitchen', name: 'Кухня', desc: 'Силова зона (плита, духовка, фартух)', badge: 'Силова' },
  { type: 'bathroom', name: 'Санвузол / Ванна', desc: 'Волога зона (IP44 + ПЗВ 10/30мА)', badge: 'Волога зона' },
  { type: 'hallway', name: 'Коридор / Хол', desc: 'Вхідна група та щит ВРП', badge: 'Прохідна' },
  { type: 'balcony', name: 'Балкон / Лоджія', desc: 'Вулична зона', badge: 'Холодна' },
  { type: 'office', name: 'Кабінет', desc: 'Робоча комп’ютерна зона', badge: 'Робоча' },
  { type: 'utility', name: 'Гардероб / Комора', desc: 'Підсобне приміщення', badge: 'Підсобна' },
];

interface CadToolsProps {
  activeTool: CadTool;
  onSelectTool: (tool: CadTool) => void;
  selectedCatalogItem: CatalogItem | null;
  onSelectCatalogItem: (item: CatalogItem) => void;
  selectedOpeningItem?: OpeningCatalogItem | null;
  onSelectOpeningItem?: (item: OpeningCatalogItem) => void;
  selectedRoomType?: Room['type'];
  onSelectRoomType?: (type: Room['type']) => void;
  onAutoDetectRooms?: () => void;
  selectedFurnitureItem?: FurnitureCatalogItem | null;
  onSelectFurnitureItem?: (item: FurnitureCatalogItem) => void;
  onOpenCustomLibraryModal?: () => void;
  customLibraryItems?: CustomLibraryItem[];
  viewFilter: ViewFilterMode;
  onChangeViewFilter: (filter: ViewFilterMode) => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  showHeights: boolean;
  showHeightsToggle?: () => void;
  onToggleHeights: () => void;
  showFurniture: boolean;
  onToggleFurniture: () => void;
  showAnnotations?: boolean;
  onToggleAnnotations?: () => void;
  gridSnapEnabled: boolean;
  onToggleGridSnap: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoRoute?: () => void;
  autoRoutingEnabled?: boolean;
  onToggleAutoRouting?: () => void;
  onOpenLayersModal?: () => void;
  onOptimizeParallelWires?: () => void;
  wallPresetThickness?: number;
  onChangeWallPresetThickness?: (thickness: number) => void;
  onOpenAutoSocketsModal?: () => void;
  onOpenAutoLightingModal?: () => void;
  onOpenWallElevationModal?: () => void;
  onOpenCableScheduleModal?: () => void;
  onOpenPanelLabelsModal?: () => void;
  onOpenBlockStampsModal?: () => void;
}

export const CadTools: React.FC<CadToolsProps> = ({
  activeTool,
  onSelectTool,
  selectedCatalogItem,
  onSelectCatalogItem,
  selectedOpeningItem,
  onSelectOpeningItem,
  selectedRoomType = 'living',
  onSelectRoomType,
  onAutoDetectRooms,
  selectedFurnitureItem,
  onSelectFurnitureItem,
  onOpenCustomLibraryModal,
  customLibraryItems = [],
  viewFilter,
  onChangeViewFilter,
  showDimensions,
  onToggleDimensions,
  showHeights,
  onToggleHeights,
  showFurniture,
  onToggleFurniture,
  showAnnotations = true,
  onToggleAnnotations,
  onOpenLayersModal,
  gridSnapEnabled,
  onToggleGridSnap,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoRoute,
  autoRoutingEnabled = true,
  onToggleAutoRouting,
  onOptimizeParallelWires,
  wallPresetThickness = 150,
  onChangeWallPresetThickness,
  onOpenAutoSocketsModal,
  onOpenAutoLightingModal,
  onOpenWallElevationModal,
  onOpenCableScheduleModal,
  onOpenPanelLabelsModal,
  onOpenBlockStampsModal,
}) => {
  const [selectedFurnitureCategory, setSelectedFurnitureCategory] = useState<FurnitureCategory | 'all'>('all');

  const getCatalogItemsByCategory = (category: ElectricalCategory) => {
    if (category === 'panel') {
      return ELECTRICAL_CATALOG.filter((item) => item.category === 'panel' || item.category === 'backup');
    }
    if (category === 'junction') {
      return ELECTRICAL_CATALOG.filter((item) => item.category === 'junction');
    }
    return ELECTRICAL_CATALOG.filter((item) => item.category === category);
  };

  const isDrawerOpen = ['socket', 'switch', 'light', 'panel', 'junction', 'door', 'window', 'room', 'furniture', 'wire', 'wall'].includes(activeTool);

  return (
    <div className="flex h-full select-none z-20">
      {/* Primary vertical tool strip */}
      <div className="w-14 bg-neutral-900 border-r border-neutral-800 flex flex-col items-center py-3 justify-between shrink-0">
        <div className="flex flex-col items-center gap-1.5 w-full px-2">
          {/* Select Tool */}
          <button
            onClick={() => onSelectTool('select')}
            title="Вибір та переміщення (V)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'select'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <MousePointer className="w-4 h-4" />
          </button>

          {/* Pan Tool */}
          <button
            onClick={() => onSelectTool('pan')}
            title="Переміщення полотна (H / Пробіл+Drag)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'pan'
                ? 'bg-sky-500 text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Hand className="w-4 h-4" />
          </button>

          <div className="w-6 h-px bg-neutral-800 my-1" />

          {/* Wall drawing tool */}
          <button
            onClick={() => onSelectTool('wall')}
            title="Креслити стіни (W) — автоприв'язка до кутів, середини та Т-з'єднань"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'wall'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Square className="w-4 h-4" />
          </button>

          {/* Room Tool */}
          <button
            onClick={() => onSelectTool('room')}
            title="Створити приміщення / кімнату (R)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'room'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Shapes className="w-4 h-4" />
          </button>

          {/* Door Tool */}
          <button
            onClick={() => {
              onSelectTool('door');
              const firstDoor = OPENINGS_CATALOG.find((i) => i.type === 'door');
              if (firstDoor && selectedOpeningItem?.type !== 'door') {
                onSelectOpeningItem?.(firstDoor);
              }
            }}
            title="Вставити двері у стіну (D)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'door'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <DoorOpen className="w-4 h-4" />
          </button>

          {/* Window Tool */}
          <button
            onClick={() => {
              onSelectTool('window');
              const firstWin = OPENINGS_CATALOG.find((i) => i.type === 'window');
              if (firstWin && selectedOpeningItem?.type !== 'window') {
                onSelectOpeningItem?.(firstWin);
              }
            }}
            title="Вставити вікно у стіну (O)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'window'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <AppWindow className="w-4 h-4" />
          </button>

          {/* Furniture & Plumbing Tool */}
          <button
            onClick={() => {
              onSelectTool('furniture');
              if (onSelectFurnitureItem && !selectedFurnitureItem) {
                onSelectFurnitureItem(FURNITURE_CATALOG[0]);
              }
            }}
            title="Розміщення меблів та сантехніки (F)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'furniture'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Sofa className="w-4 h-4" />
          </button>

          <div className="w-6 h-px bg-neutral-800 my-1" />

          {/* Sockets Tool */}
          <button
            onClick={() => {
              onSelectTool('socket');
              const items = getCatalogItemsByCategory('socket');
              if (items.length > 0 && selectedCatalogItem?.category !== 'socket') {
                onSelectCatalogItem(items[0]);
              }
            }}
            title="Розетки та виводи 220В/380В (S)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative ${
              activeTool === 'socket'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* Switches Tool */}
          <button
            onClick={() => {
              onSelectTool('switch');
              const items = getCatalogItemsByCategory('switch');
              if (items.length > 0 && selectedCatalogItem?.category !== 'switch') {
                onSelectCatalogItem(items[0]);
              }
            }}
            title="Вимикачі та перемикачі (K)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'switch'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <ToggleLeft className="w-4 h-4" />
          </button>

          {/* Lighting Tool */}
          <button
            onClick={() => {
              onSelectTool('light');
              const items = getCatalogItemsByCategory('light');
              if (items.length > 0 && selectedCatalogItem?.category !== 'light') {
                onSelectCatalogItem(items[0]);
              }
            }}
            title="Світильники, споти, люстри (L)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'light'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          {/* Panels and Distribution Tool */}
          <button
            onClick={() => {
              onSelectTool('panel');
              const items = getCatalogItemsByCategory('panel');
              if (items.length > 0 && selectedCatalogItem?.category !== 'panel') {
                onSelectCatalogItem(items[0]);
              }
            }}
            title="Електрощити (ВРП / ЩРН / ЩС / Резерв)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'panel'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Box className="w-4 h-4" />
          </button>

          {/* Junction Boxes Tool */}
          <button
            onClick={() => {
              onSelectTool('junction');
              const items = getCatalogItemsByCategory('junction');
              if (items.length > 0 && selectedCatalogItem?.category !== 'junction') {
                onSelectCatalogItem(items[0]);
              }
            }}
            title="Розподільчі коробки РК (освітлення, розеточні, IP65, ГЗШ) (J)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'junction'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
          </button>

          {/* Wire Routing Tool */}
          <button
            onClick={() => onSelectTool('wire')}
            title="Трасування кабелів та зв'язки (C)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'wire'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <GitBranch className="w-4 h-4" />
          </button>

          {/* Auto-routing Action & State Toggle */}
          <div className="flex flex-col items-center gap-1">
            {onAutoRoute && (
              <button
                onClick={onAutoRoute}
                title="Автотрасування кабелів за нормами ПУЕ (Ортогонально 90°)"
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 border border-amber-500/40 bg-amber-950/20"
              >
                <Zap className="w-4 h-4 text-amber-400" />
              </button>
            )}
            {onToggleAutoRouting && (
              <button
                onClick={onToggleAutoRouting}
                title={
                  autoRoutingEnabled
                    ? 'Автотрасування: УВІМКНЕНО (клікніть, щоб вимкнути)'
                    : 'Автотрасування: ВИМКНЕНО (ручне трасування вузлів)'
                }
                className={`w-10 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors ${
                  autoRoutingEnabled
                    ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/40'
                    : 'text-neutral-500 bg-neutral-900 border border-neutral-700/60'
                }`}
              >
                {autoRoutingEnabled ? 'AUTO' : 'MAN'}
              </button>
            )}
          </div>

          {/* Measure / Ruler */}
          <button
            onClick={() => onSelectTool('measure')}
            title="Лінійка / Вимірювання відстані (M)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'measure'
                ? 'bg-sky-500 text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Ruler className="w-4 h-4" />
          </button>

          {/* Scale Calibration Tool */}
          <button
            onClick={() => onSelectTool('calibrate')}
            title="Калібрування масштабу за підкладкою БТІ (клікніть 2 точки з відомою відстанню)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'calibrate'
                ? 'bg-sky-500 text-neutral-950 font-bold ring-2 ring-sky-400/50'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Crosshair className="w-4 h-4" />
          </button>

          {/* Client Note Pin Tool */}
          <button
            onClick={() => onSelectTool('client_note')}
            title="Додати зауваження / коментар клієнта на план (клікніть у будь-яке місце)"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'client_note'
                ? 'bg-amber-400 text-neutral-950 font-bold ring-2 ring-amber-400/50'
                : 'text-amber-400/80 hover:text-amber-300 hover:bg-neutral-800'
            }`}
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>

          {/* Custom Library Creator Tool */}
          {onOpenCustomLibraryModal && (
            <button
              onClick={onOpenCustomLibraryModal}
              title="Власна бібліотека CAD (+ Створити символ)"
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 border border-amber-500/30 bg-amber-950/20 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
            </button>
          )}
        </div>

        {/* Bottom utility toggles */}
        <div className="flex flex-col items-center gap-1.5 w-full px-2">
          {/* Grid Snap Toggle */}
          <button
            onClick={onToggleGridSnap}
            title={gridSnapEnabled ? 'Прив\'язка до сітки: УВІМК' : 'Прив\'язка до сітки: ВИМК'}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              gridSnapEnabled ? 'text-sky-400 bg-sky-950/40 border border-sky-800/50' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Dimensions Toggle */}
          <button
            onClick={onToggleDimensions}
            title={showDimensions ? 'Розміри стін: УВІМК' : 'Розміри стін: ВИМК'}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              showDimensions ? 'text-sky-400 bg-sky-950/40 border border-sky-800/50' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Height tags Toggle */}
          <button
            onClick={onToggleHeights}
            title={showHeights ? 'Висотні позначки (+300): УВІМК' : 'Висотні позначки: ВИМК'}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              showHeights ? 'text-sky-400 bg-sky-950/40 border border-sky-800/50' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Tag className="w-4 h-4" />
          </button>

          {/* Furniture layer Toggle */}
          <button
            onClick={onToggleFurniture}
            title={showFurniture ? 'Шар меблів: УВІМК' : 'Шар меблів: ВИМК'}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              showFurniture ? 'text-sky-400 bg-sky-950/40 border border-sky-800/50' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Sofa className="w-4 h-4" />
          </button>

          {/* Annotations & Callouts Toggle (Примітки та виноски) */}
          {onToggleAnnotations && (
            <button
              onClick={onToggleAnnotations}
              title={showAnnotations ? 'Примітки та виноски: УВІМК (клікніть, щоб вимкнути)' : 'Примітки та виноски: ВИМК (клікніть, щоб увімкнути)'}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                showAnnotations ? 'text-amber-400 bg-amber-950/40 border border-amber-800/50' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <FileText className="w-4 h-4" />
            </button>
          )}

          {/* Layer Visibility Manager Modal Trigger */}
          {onOpenLayersModal && (
            <button
              onClick={onOpenLayersModal}
              title="Диспетчер видимості шарів (CAD Layer Manager)"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sky-400 bg-sky-950/40 border border-sky-800/50 hover:bg-sky-900/60 transition-colors"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}

          <div className="w-6 h-px bg-neutral-800 my-0.5" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Скасувати дію (Ctrl+Z)"
              className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:pointer-events-none hover:bg-neutral-800"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Повторити дію (Ctrl+Y)"
              className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:pointer-events-none hover:bg-neutral-800"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Drawer: Items catalog when socket/switch/light/door/window is selected */}
      {isDrawerOpen && (
        <div className="w-64 bg-neutral-900/95 backdrop-blur-md border-r border-neutral-800 flex flex-col p-3 overflow-y-auto shrink-0 animate-in slide-in-from-left duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800">
            <span className="text-xs font-semibold text-neutral-200 tracking-wide uppercase">
              {activeTool === 'socket' && 'Каталог розеток'}
              {activeTool === 'switch' && 'Каталог вимикачів'}
              {activeTool === 'light' && 'Каталог освітлення'}
              {activeTool === 'panel' && 'Щити та обладнання'}
              {activeTool === 'junction' && 'Розподільчі коробки (РК)'}
              {activeTool === 'door' && 'Каталог дверей'}
              {activeTool === 'window' && 'Каталог вікон'}
              {activeTool === 'room' && 'Створення кімнати'}
              {activeTool === 'furniture' && 'Меблі та сантехніка'}
              {activeTool === 'wall' && 'Креслення та розміри стін'}
              {activeTool === 'wire' && 'Трасування кабельних ліній'}
            </span>
            <span className="text-[11px] text-neutral-500">
              {activeTool === 'door' || activeTool === 'window'
                ? 'Клік на стіну'
                : activeTool === 'room'
                ? 'Клікніть кути полігону'
                : activeTool === 'wall'
                ? 'Введення мм + Enter'
                : activeTool === 'wire'
                ? 'Оптимальні 90° траси'
                : 'Клікніть на план'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {/* 1. WALL PARAMETERS & DIMENSIONS DRAWER */}
            {activeTool === 'wall' ? (
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/50 text-xs text-sky-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-sky-300">
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Задання точних розмірів стін</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-snug">
                    Клікніть першу точку. Під час ведення курсору введіть довжину на клавіатурі (наприклад, <strong>3500</strong>) і натисніть <strong>Enter</strong> для побудови стіни точного розміру.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 font-medium block mb-1">Товщина стін для нових ліній:</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { th: 100, label: '100 мм (ГКЛ)' },
                      { th: 150, label: '150 мм (Блок)' },
                      { th: 200, label: '200 мм (Кв.)' },
                      { th: 250, label: '250 мм (Цегла)' },
                    ].map((item) => (
                      <button
                        key={item.th}
                        onClick={() => onChangeWallPresetThickness?.(item.th)}
                        className={`py-1.5 px-2 rounded text-[11px] font-mono border transition-colors ${
                          wallPresetThickness === item.th
                            ? 'bg-sky-950/70 border-sky-500 text-sky-300 font-bold'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-[10.5px] text-neutral-400 space-y-1">
                  <div className="text-neutral-300 font-medium">Швидкі довжини стін (мм):</div>
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    {[1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000].map((len) => (
                      <div
                        key={len}
                        className="py-1 text-center bg-neutral-900 border border-neutral-800/80 rounded font-mono text-neutral-300 text-[10px]"
                      >
                        {len}
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-neutral-500 leading-tight">
                  Виберіть будь-яку побудовану стіну, щоб змінити її точний розмір у мм або перетягувати круглі маркери на кінцях.
                </p>

                {/* Wall Elevation & Chasing button */}
                {onOpenWallElevationModal && (
                  <button
                    onClick={onOpenWallElevationModal}
                    className="w-full p-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-950/30"
                  >
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span>📐 Розгортка стіни & Штроби (ПУЕ)</span>
                  </button>
                )}
              </div>
            ) : activeTool === 'wire' ? (
              /* 2. WIRE ROUTING & PARALLEL BUNDLE DRAWER */
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/50 text-xs text-sky-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-sky-300">
                    <Split className="w-3.5 h-3.5" />
                    <span>Ортогональні паралельні траси</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-snug">
                    Кабелі одного напрямку прокладаються паралельними коліями з відступом 80 мм за ПУЕ §2.1.43, уникаючи накладання ліній одна на одну.
                  </p>
                </div>

                {/* Parallel optimization action */}
                {onOptimizeParallelWires && (
                  <button
                    onClick={onOptimizeParallelWires}
                    className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    <Split className="w-3.5 h-3.5" />
                    <span>⚡ Оптимізувати всі паралельні траси</span>
                  </button>
                )}

                {/* Auto-route button */}
                {onAutoRoute && (
                  <button
                    onClick={onAutoRoute}
                    className="w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Автотрасування ПУЕ (Всі групи)</span>
                  </button>
                )}

                {/* Auto-routing toggle */}
                {onToggleAutoRouting && (
                  <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between">
                    <span className="text-[11px] text-neutral-300 font-medium">Автотрасування:</span>
                    <button
                      onClick={onToggleAutoRouting}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        autoRoutingEnabled
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                      }`}
                    >
                      {autoRoutingEnabled ? 'УВІМКНЕНО' : 'ВИМКНЕНО'}
                    </button>
                  </div>
                )}

                <div className="text-[10px] text-neutral-500 leading-tight space-y-1 pt-1">
                  <div>• <strong>Клік по приладу:</strong> початок траси (або розподільчої коробки).</div>
                  <div>• <strong>Клік по полотну:</strong> точка повороту під прямим кутом (90°).</div>
                  <div>• <strong>Enter / Подвійний клік:</strong> завершення лінії.</div>
                  <div>• <strong>Захист прорізів:</strong> штроби не перетинають дверні та віконні отвори за ПУЕ §2.1.52.</div>
                </div>

                {/* Cable Schedule button */}
                {onOpenCableScheduleModal && (
                  <button
                    onClick={onOpenCableScheduleModal}
                    className="w-full p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/30"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>📋 Кабельний журнал ДСТУ</span>
                  </button>
                )}
              </div>
            ) : activeTool === 'furniture' ? (
              <div className="space-y-2">
                {/* Furniture Category Filters */}
                <div className="flex flex-wrap gap-1 pb-1 border-b border-neutral-800">
                  <button
                    onClick={() => setSelectedFurnitureCategory('all')}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                      selectedFurnitureCategory === 'all'
                        ? 'bg-sky-500 text-neutral-950'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    Всі
                  </button>
                  {FURNITURE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedFurnitureCategory(cat.id)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                        selectedFurnitureCategory === cat.id
                          ? 'bg-sky-500 text-neutral-950'
                          : 'bg-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>

                {/* Create Custom Furniture Button */}
                {onOpenCustomLibraryModal && (
                  <button
                    onClick={onOpenCustomLibraryModal}
                    className="w-full p-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Створити власні меблі</span>
                  </button>
                )}

                {/* Furniture Catalog Items */}
                {FURNITURE_CATALOG.filter((item) =>
                  selectedFurnitureCategory === 'all' ? true : item.category === selectedFurnitureCategory
                ).map((item) => {
                  const isSelected = selectedFurnitureItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectFurnitureItem?.(item)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-neutral-800 border-sky-500/60 shadow-sm'
                          : 'border-neutral-800/60 hover:bg-neutral-800/40 hover:border-neutral-700'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          isSelected ? 'bg-sky-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        🛋️
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-medium text-neutral-100 truncate">{item.name}</span>
                        <span className="text-[11px] text-neutral-400 line-clamp-1">{item.shortDesc}</span>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-sky-400 font-mono">
                          <span>{item.defaultWidthMm}×{item.defaultHeightMm} мм</span>
                          <span>·</span>
                          <span className="text-neutral-400 font-normal">{item.badge}</span>
                        </div>
                        {item.electricalHints && item.electricalHints.length > 0 && (
                          <div className="mt-1 text-[9.5px] text-amber-400 flex items-center gap-1">
                            <span>⚡</span>
                            <span className="truncate">{item.electricalHints[0]}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* Custom Furniture from customLibrary */}
                {customLibraryItems.filter((i) => i.kind === 'furniture').length > 0 && (
                  <div className="pt-2 border-t border-neutral-800">
                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Власні меблі ({customLibraryItems.filter((i) => i.kind === 'furniture').length})</span>
                    </div>
                    {customLibraryItems
                      .filter((i) => i.kind === 'furniture')
                      .map((cItem) => {
                        const fakePreset: FurnitureCatalogItem = {
                          id: cItem.id,
                          name: cItem.name,
                          category: (cItem.category as any) || 'custom',
                          type: (cItem.furnitureType as any) || 'desk',
                          defaultWidthMm: cItem.widthMm || 1200,
                          defaultHeightMm: cItem.heightMm || 600,
                          cadShape: cItem.cadShape || 'generic',
                          shortDesc: cItem.shortDesc || 'Власний блок',
                          badge: `${cItem.widthMm}×${cItem.heightMm}`,
                          electricalHints: cItem.electricalHints || [],
                        };
                        const isSelected = selectedFurnitureItem?.id === fakePreset.id;
                        return (
                          <button
                            key={cItem.id}
                            onClick={() => onSelectFurnitureItem?.(fakePreset)}
                            className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 mb-1.5 ${
                              isSelected
                                ? 'bg-neutral-800 border-amber-500/60 shadow-sm'
                                : 'border-neutral-800/60 hover:bg-neutral-800/40 hover:border-neutral-700'
                            }`}
                          >
                            <div className="w-8 h-8 rounded bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border border-amber-500/30">
                              ⭐
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-medium text-white truncate">{cItem.name}</span>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-amber-300 font-mono">
                                <span>{cItem.widthMm}×{cItem.heightMm} мм</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : activeTool === 'room' ? (
              <div className="space-y-2">
                {onAutoDetectRooms && (
                  <button
                    onClick={onAutoDetectRooms}
                    className="w-full p-2.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors mb-2"
                  >
                    <Shapes className="w-3.5 h-3.5" />
                    <span>Визначити кімнати за стінами</span>
                  </button>
                )}
                {ROOM_PRESETS.map((rp) => {
                  const isSelected = selectedRoomType === rp.type;
                  return (
                    <button
                      key={rp.type}
                      onClick={() => onSelectRoomType?.(rp.type)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-neutral-800 border-sky-500/60 shadow-sm'
                          : 'border-neutral-800/60 hover:bg-neutral-800/40 hover:border-neutral-700'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          isSelected ? 'bg-sky-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {rp.type === 'bathroom' ? '🚿' : rp.type === 'kitchen' ? '🍳' : rp.type === 'bedroom' ? '🛏️' : '🛋️'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-neutral-100 truncate">{rp.name}</span>
                        <span className="text-[11px] text-neutral-400 line-clamp-1">{rp.desc}</span>
                        <span className="text-[10px] text-sky-400 font-mono mt-0.5">{rp.badge}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : activeTool === 'door' || activeTool === 'window' ? (
              OPENINGS_CATALOG.filter((item) => item.type === activeTool).map((item) => {
                const isSelected = selectedOpeningItem?.id === item.id || (!selectedOpeningItem && item.type === activeTool);
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectOpeningItem?.(item)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-neutral-800 border-sky-500/60 shadow-sm'
                        : 'border-neutral-800/60 hover:bg-neutral-800/40 hover:border-neutral-700'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                        isSelected ? 'bg-sky-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {activeTool === 'door' ? <DoorOpen className="w-4 h-4" /> : <AppWindow className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-neutral-100 truncate">{item.name}</span>
                      </div>
                      <span className="text-[11px] text-neutral-400 line-clamp-1">{item.shortDesc}</span>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-sky-400 font-mono font-semibold">
                        <span>Ширина: {item.widthMm} мм</span>
                        <span>·</span>
                        <span className="text-neutral-400 font-normal">{item.badge}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <>
                {/* Auto socket placement action button */}
                {activeTool === 'socket' && onOpenAutoSocketsModal && (
                  <button
                    onClick={onOpenAutoSocketsModal}
                    className="w-full p-2.5 mb-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-sky-500/20 hover:from-amber-500/30 hover:to-sky-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-950/30"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>⚡ Авторозстановка розеток (ДБН)</span>
                  </button>
                )}

                {/* Block stamps quick trigger button */}
                {(activeTool === 'socket' || activeTool === 'switch') && onOpenBlockStampsModal && (
                  <button
                    onClick={onOpenBlockStampsModal}
                    className="w-full p-2.5 mb-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-950/30"
                  >
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>🔲 Штампи блоків постів (71мм)</span>
                  </button>
                )}

                {/* Auto lighting placement action button */}
                {activeTool === 'light' && onOpenAutoLightingModal && (
                  <button
                    onClick={onOpenAutoLightingModal}
                    className="w-full p-2.5 mb-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-950/30"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>💡 Авторозстановка світла (ДБН)</span>
                  </button>
                )}

                {/* Panel Label Maker button */}
                {activeTool === 'panel' && onOpenPanelLabelsModal && (
                  <button
                    onClick={onOpenPanelLabelsModal}
                    className="w-full p-2.5 mb-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-950/30"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>🏷️ Наліпки на пластрон щита</span>
                  </button>
                )}

                {/* Custom Library quick trigger button */}
                {onOpenCustomLibraryModal && (
                  <button
                    onClick={onOpenCustomLibraryModal}
                    className="w-full p-2 mb-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Створити власний символ</span>
                  </button>
                )}

                {/* Custom items matching electrical */}
                {customLibraryItems.filter((i) => i.kind === 'electrical').length > 0 && (
                  <div className="mb-2 pb-2 border-b border-neutral-800">
                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Власні символи ({customLibraryItems.filter((i) => i.kind === 'electrical').length})</span>
                    </div>
                    {customLibraryItems
                      .filter((i) => i.kind === 'electrical')
                      .map((cItem) => {
                        const fakeCatItem: CatalogItem = {
                          type: 'custom_element',
                          category: (cItem.category as any) || 'custom',
                          name: cItem.name,
                          shortDesc: cItem.shortDesc || 'Власний елемент',
                          defaultHeightMm: cItem.mountingHeightMm || 300,
                          defaultPowerWatts: cItem.powerWatts || 500,
                          defaultIpRating: cItem.ipRating || 'IP20',
                          recommendedBreakerA: (cItem.recommendedBreakerA as any) || 16,
                          recommendedCable: (cItem.recommendedCable as any) || 'VVGng_3x2.5',
                          badge: cItem.phase === '3-phase' ? '3Ф' : '1Ф',
                        };
                        const isSelected = selectedCatalogItem?.name === cItem.name;
                        return (
                          <button
                            key={cItem.id}
                            onClick={() => onSelectCatalogItem(fakeCatItem)}
                            className={`w-full text-left p-2 rounded-lg border transition-all flex items-start gap-2 mb-1 ${
                              isSelected
                                ? 'bg-neutral-800 border-amber-500/60 shadow-sm'
                                : 'border-neutral-800/60 hover:bg-neutral-800/40 hover:border-neutral-700'
                            }`}
                          >
                            <div
                              className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border"
                              style={{
                                backgroundColor: `${cItem.symbolColor || '#f59e0b'}20`,
                                borderColor: cItem.symbolColor || '#f59e0b',
                                color: cItem.symbolColor || '#f59e0b',
                              }}
                            >
                              ⚡
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-white truncate">{cItem.name}</span>
                              <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-mono">
                                <span>{cItem.powerWatts || 0} Вт</span>
                                <span>·</span>
                                <span>+{cItem.mountingHeightMm || 300} мм</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}

                {/* Standard Catalog Items */}
                {getCatalogItemsByCategory(activeTool as ElectricalCategory).map((item) => {
                  const isSelected = selectedCatalogItem?.type === item.type;
                  return (
                    <button
                      key={item.type}
                      onClick={() => onSelectCatalogItem(item)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-neutral-800 border-sky-500/60 shadow-sm'
                          : 'border-neutral-800/60 hover:bg-neutral-800/40 hover:border-neutral-700'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                          isSelected ? 'bg-sky-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {item.badge}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-neutral-100 truncate">{item.name}</span>
                        <span className="text-[11px] text-neutral-400 line-clamp-1">{item.shortDesc}</span>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-500 font-mono">
                          <span>+{item.defaultHeightMm} мм</span>
                          <span>·</span>
                          <span>{item.defaultIpRating}</span>
                          {item.defaultPowerWatts > 0 && (
                            <>
                              <span>·</span>
                              <span>{item.defaultPowerWatts} Вт</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>

          <div className="mt-4 p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 text-[11px] text-neutral-400 space-y-1">
            <div className="text-neutral-300 font-medium">💡 Підказка:</div>
            {activeTool === 'door' || activeTool === 'window' ? (
              <div>
                Наведіть курсор на будь-яку стіну: отвір автоматично примагнічується по осі стіни з урахуванням товщини. Клікніть лівою кнопкою для врізки.
              </div>
            ) : (
              <div>
                При наближенні до стіни елемент автоматично примагнічується та вирівнюється перпендикулярно площині.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
