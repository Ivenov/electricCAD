import React from 'react';
import {
  MousePointer,
  Hand,
  Square,
  Zap,
  ToggleLeft,
  Lightbulb,
  Box,
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
} from 'lucide-react';
import { CadTool, ViewFilterMode, ElectricalCategory } from '../../types/cad';
import { CatalogItem, ELECTRICAL_CATALOG } from '../../data/electricalCatalog';
import { OpeningCatalogItem, OPENINGS_CATALOG } from '../../data/openingsCatalog';

interface CadToolsProps {
  activeTool: CadTool;
  onSelectTool: (tool: CadTool) => void;
  selectedCatalogItem: CatalogItem | null;
  onSelectCatalogItem: (item: CatalogItem) => void;
  selectedOpeningItem?: OpeningCatalogItem | null;
  onSelectOpeningItem?: (item: OpeningCatalogItem) => void;
  viewFilter: ViewFilterMode;
  onChangeViewFilter: (filter: ViewFilterMode) => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  showHeights: boolean;
  onToggleHeights: () => void;
  showFurniture: boolean;
  onToggleFurniture: () => void;
  gridSnapEnabled: boolean;
  onToggleGridSnap: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoRoute?: () => void;
}

export const CadTools: React.FC<CadToolsProps> = ({
  activeTool,
  onSelectTool,
  selectedCatalogItem,
  onSelectCatalogItem,
  selectedOpeningItem,
  onSelectOpeningItem,
  viewFilter,
  onChangeViewFilter,
  showDimensions,
  onToggleDimensions,
  showHeights,
  onToggleHeights,
  showFurniture,
  onToggleFurniture,
  gridSnapEnabled,
  onToggleGridSnap,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoRoute,
}) => {
  const getCatalogItemsByCategory = (category: ElectricalCategory) => {
    if (category === 'panel') {
      return ELECTRICAL_CATALOG.filter((item) => item.category === 'panel' || item.category === 'backup');
    }
    return ELECTRICAL_CATALOG.filter((item) => item.category === category);
  };

  const isDrawerOpen = ['socket', 'switch', 'light', 'panel', 'door', 'window'].includes(activeTool);

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
            title="Електрощити та розподільчі коробки"
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === 'panel'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-md shadow-sky-500/20'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Box className="w-4 h-4" />
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

          {/* Auto-routing Action */}
          {onAutoRoute && (
            <button
              onClick={onAutoRoute}
              title="Автотрасування кабелів за нормами ПУЕ (Ортогонально 90°)"
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 border border-amber-500/40 bg-amber-950/20"
            >
              <Zap className="w-4 h-4 text-amber-400" />
            </button>
          )}

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
              {activeTool === 'door' && 'Каталог дверей'}
              {activeTool === 'window' && 'Каталог вікон'}
            </span>
            <span className="text-[11px] text-neutral-500">
              {activeTool === 'door' || activeTool === 'window' ? 'Клік на стіну' : 'Клікніть на план'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {activeTool === 'door' || activeTool === 'window' ? (
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
              getCatalogItemsByCategory(activeTool as ElectricalCategory).map((item) => {
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
              })
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
