import React from 'react';
import {
  X,
  Eye,
  EyeOff,
  Layers,
  CheckSquare,
  Square,
  RefreshCw,
  Lightbulb,
  Plug,
  Home,
  Route,
  Sparkles,
} from 'lucide-react';
import { LayerVisibilityConfig, CadProject } from '../../types/cad';

interface LayersVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LayerVisibilityConfig;
  onChange: (config: LayerVisibilityConfig) => void;
  project?: CadProject | null;
}

interface LayerDefinition {
  key: keyof LayerVisibilityConfig;
  cadCode: string;
  name: string;
  description: string;
  color: string;
  category: 'arch' | 'elec' | 'route' | 'anno';
}

const LAYER_DEFINITIONS: LayerDefinition[] = [
  // Architectural Layers (A-*)
  {
    key: 'walls',
    cadCode: 'A-WALL',
    name: 'Стіни та перегородки',
    description: 'Капітальні несучі стіни (300мм) та міжкімнатні перегородки (120–150мм)',
    color: '#94a3b8',
    category: 'arch',
  },
  {
    key: 'openings',
    cadCode: 'A-DOOR-WIND',
    name: 'Вікна та дверні отвори',
    description: 'Віконні блоки, вхідні та міжкімнатні двері з радіусами відкривання',
    color: '#38bdf8',
    category: 'arch',
  },
  {
    key: 'rooms',
    cadCode: 'A-AREA',
    name: 'Приміщення та експлікація',
    description: 'Межі кімнат, назви зон та розрахункова площа приміщень (м²)',
    color: '#818cf8',
    category: 'arch',
  },
  {
    key: 'furniture',
    cadCode: 'A-FURN',
    name: 'Меблі та сантехніка',
    description: 'Планування меблів, кухонний гарнітур, ванна, унітаз, ліжка, шафи',
    color: '#64748b',
    category: 'arch',
  },
  {
    key: 'blueprint',
    cadCode: 'A-BLPR',
    name: 'Підкладка БТІ / Архітектура',
    description: 'Фонове растрове зображення або скан вихідного плану будинку',
    color: '#a855f7',
    category: 'arch',
  },

  // Electrical Equipment Layers (E-*)
  {
    key: 'sockets',
    cadCode: 'E-POWR-SOCK',
    name: 'Розетки та силові споживачі',
    description: 'Розетки 230В, блоки розеток, силова лінія варильної панелі 32А, ДБЖ',
    color: '#06b6d4',
    category: 'elec',
  },
  {
    key: 'switches',
    cadCode: 'E-LITE-SWIT',
    name: 'Вимикачі світла',
    description: 'Одноклавішні, двоклавішні, прохідні та перехресні вимикачі',
    color: '#eab308',
    category: 'elec',
  },
  {
    key: 'lights',
    cadCode: 'E-LITE-FIXT',
    name: 'Світильники та люстри',
    description: 'Люстри, точкові споти, LED-панелі, настінні бра та фасадне світло',
    color: '#fbbf24',
    category: 'elec',
  },

  // Routing and Conduit Layers (E-*)
  {
    key: 'wiresPower',
    cadCode: 'E-POWR-CABL',
    name: 'Силові кабельні лінії',
    description: 'Траси живлення розеток ВВГнгд 3х2.5, варильної поверхні 3х6, кондиціонерів',
    color: '#38bdf8',
    category: 'route',
  },
  {
    key: 'wiresLighting',
    cadCode: 'E-LITE-CABL',
    name: 'Лінії освітлення & комутації',
    description: 'Магістральні траси освітлення ВВГнгд 3х1.5 та опусти до вимикачів',
    color: '#ef4444',
    category: 'route',
  },
  {
    key: 'conduitChase',
    cadCode: 'E-CHASE',
    name: 'Штроби у стінах (Штроблення)',
    description: 'Вертикальні штроби опусків до підрозетників за нормами ПУЕ',
    color: '#f97316',
    category: 'route',
  },
  {
    key: 'conduitCeiling',
    cadCode: 'E-CEIL',
    name: 'Траси по стелі у гофрі',
    description: 'Магістральна розводка кабелів у негорючій гофротрубі за підвісною стелею',
    color: '#a855f7',
    category: 'route',
  },
  {
    key: 'conduitFloor',
    cadCode: 'E-FLOR',
    name: 'Траси у стяжці підлоги',
    description: 'Силові кабелі в трубах підвищеної міцності у бетонній стяжці підлоги',
    color: '#10b981',
    category: 'route',
  },

  // Dimensions & Annotations Layers (A-*/E-*)
  {
    key: 'annotations',
    cadCode: 'E-ANNO',
    name: 'Виноски, бірки та примітки',
    description: 'Кабельні бірки, стрілки виносок, маркування фаз (L ➔ SW, L ➔ Світло)',
    color: '#f43f5e',
    category: 'anno',
  },
  {
    key: 'dimensions',
    cadCode: 'A-DIMS',
    name: 'Розміри та довжини стін',
    description: 'Автоматичні лінійні розміри стін та отворів у міліметрах (мм)',
    color: '#94a3b8',
    category: 'anno',
  },
  {
    key: 'heights',
    cadCode: 'E-HGHT',
    name: 'Висотні позначки монтажу',
    description: 'Висоти установки обладнання від чистової підлоги (h=300, h=900, h=2500)',
    color: '#2dd4bf',
    category: 'anno',
  },
];

export const LayersVisibilityModal: React.FC<LayersVisibilityModalProps> = ({
  isOpen,
  onClose,
  config,
  onChange,
  project,
}) => {
  if (!isOpen) return null;

  const handleToggle = (key: keyof LayerVisibilityConfig) => {
    onChange({
      ...config,
      [key]: !config[key],
    });
  };

  const handleEnableAll = () => {
    const next = { ...config };
    LAYER_DEFINITIONS.forEach((l) => {
      next[l.key] = true;
    });
    onChange(next);
  };

  const handleDisableAll = () => {
    const next = { ...config };
    LAYER_DEFINITIONS.forEach((l) => {
      // Keep walls visible so canvas is never blank
      next[l.key] = l.key === 'walls';
    });
    onChange(next);
  };

  const handleInvert = () => {
    const next = { ...config };
    LAYER_DEFINITIONS.forEach((l) => {
      next[l.key] = !config[l.key];
    });
    // Ensure walls remain visible
    next.walls = true;
    onChange(next);
  };

  // Preset: Lighting Plan
  const applyLightingPreset = () => {
    onChange({
      walls: true,
      openings: true,
      rooms: true,
      sockets: false,
      switches: true,
      lights: true,
      wiresPower: false,
      wiresLighting: true,
      conduitChase: true,
      conduitCeiling: true,
      conduitFloor: false,
      annotations: true,
      dimensions: false,
      heights: true,
      furniture: false,
      blueprint: false,
    });
  };

  // Preset: Sockets and Power
  const applyPowerPreset = () => {
    onChange({
      walls: true,
      openings: true,
      rooms: true,
      sockets: true,
      switches: false,
      lights: false,
      wiresPower: true,
      wiresLighting: false,
      conduitChase: true,
      conduitCeiling: true,
      conduitFloor: true,
      annotations: true,
      dimensions: false,
      heights: true,
      furniture: true,
      blueprint: false,
    });
  };

  // Preset: Architectural Plan
  const applyArchPreset = () => {
    onChange({
      walls: true,
      openings: true,
      rooms: true,
      sockets: false,
      switches: false,
      lights: false,
      wiresPower: false,
      wiresLighting: false,
      conduitChase: false,
      conduitCeiling: false,
      conduitFloor: false,
      annotations: false,
      dimensions: true,
      heights: false,
      furniture: true,
      blueprint: true,
    });
  };

  // Preset: Chases and Wire Routes
  const applyRoutesPreset = () => {
    onChange({
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
      annotations: true,
      dimensions: false,
      heights: false,
      furniture: false,
      blueprint: false,
    });
  };

  // Count items for each layer
  const getItemCount = (key: keyof LayerVisibilityConfig): number => {
    if (!project) return 0;
    switch (key) {
      case 'walls':
        return project.walls.length;
      case 'openings':
        return project.openings.length;
      case 'rooms':
        return project.rooms.length;
      case 'furniture':
        return project.furniture?.length || 0;
      case 'blueprint':
        return project.backgroundImage ? 1 : 0;
      case 'sockets':
        return project.elements.filter(
          (e) => e.category === 'socket' || e.category === 'appliance' || e.category === 'backup'
        ).length;
      case 'switches':
        return project.elements.filter((e) => e.category === 'switch').length;
      case 'lights':
        return project.elements.filter((e) => e.category === 'light').length;
      case 'wiresPower':
        return project.wires.filter((w) => w.mode !== 'curve').length;
      case 'wiresLighting':
        return project.wires.filter((w) => w.mode === 'curve').length;
      case 'conduitChase':
        return project.wires.filter((w) => w.conduit === 'wall_chase').length;
      case 'conduitCeiling':
        return project.wires.filter((w) => w.conduit === 'ceiling').length;
      case 'conduitFloor':
        return project.wires.filter((w) => w.conduit === 'floor').length;
      case 'annotations':
        return project.wires.filter((w) => w.cableTag).length;
      case 'dimensions':
        return project.walls.length;
      case 'heights':
        return project.elements.filter((e) => e.mountingHeightMm > 0).length;
      default:
        return 0;
    }
  };

  const activeCount = Object.values(config).filter(Boolean).length;
  const totalCount = LAYER_DEFINITIONS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#121318] border border-neutral-700/80 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-[#16171f]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Видимість шарів (CAD Layer Manager)
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800/60">
                  {activeCount} з {totalCount} увімкнено
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Керування видимістю архітектурних та інженерних шарів креслення за стандартами AutoCAD & ПУЕ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-6 py-3 bg-[#0e0f14] border-b border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-neutral-400 mr-1">Швидкі пресети:</span>
            <button
              onClick={handleEnableAll}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
              <span>Всі шари</span>
            </button>
            <button
              onClick={applyLightingPreset}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-950/40 hover:bg-amber-900/60 border border-amber-600/40 text-amber-300 transition-colors"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>План освітлення</span>
            </button>
            <button
              onClick={applyPowerPreset}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-600/40 text-cyan-300 transition-colors"
            >
              <Plug className="w-3.5 h-3.5 text-cyan-400" />
              <span>План розеток</span>
            </button>
            <button
              onClick={applyArchPreset}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-600/40 text-indigo-300 transition-colors"
            >
              <Home className="w-3.5 h-3.5 text-indigo-400" />
              <span>Архітектурний</span>
            </button>
            <button
              onClick={applyRoutesPreset}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-950/40 hover:bg-rose-900/60 border border-rose-600/40 text-rose-300 transition-colors"
            >
              <Route className="w-3.5 h-3.5 text-rose-400" />
              <span>Траси & Штроби</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInvert}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 transition-colors"
              title="Інвертувати стан видимих та прихованих шарів"
            >
              <RefreshCw className="w-3 h-3 text-neutral-400" />
              <span>Інверсія</span>
            </button>
            <button
              onClick={handleDisableAll}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 transition-colors"
              title="Вимкнути всі шари крім стін"
            >
              <Square className="w-3 h-3 text-neutral-400" />
              <span>Вимкнути все</span>
            </button>
          </div>
        </div>

        {/* Layer Table */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-neutral-800/70">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-700 text-neutral-400 uppercase tracking-wider text-[10px] font-mono">
                <th className="py-2.5 px-3 w-12 text-center">Стан</th>
                <th className="py-2.5 px-3 w-10 text-center">Колір</th>
                <th className="py-2.5 px-3 w-32">Код AutoCAD</th>
                <th className="py-2.5 px-3">Назва шару & Призначення</th>
                <th className="py-2.5 px-3 w-28 text-right">Об'єктів</th>
                <th className="py-2.5 px-3 w-24 text-center">Дія</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-sans">
              {LAYER_DEFINITIONS.map((layer) => {
                const isVisible = config[layer.key];
                const count = getItemCount(layer.key);

                return (
                  <tr
                    key={layer.key}
                    onClick={() => handleToggle(layer.key)}
                    className={`cursor-pointer transition-colors ${
                      isVisible
                        ? 'hover:bg-neutral-800/40'
                        : 'opacity-50 bg-neutral-900/30 hover:bg-neutral-800/20'
                    }`}
                  >
                    {/* Visibility icon */}
                    <td className="py-2.5 px-3 text-center">
                      {isVisible ? (
                        <Eye className="w-4 h-4 text-sky-400 mx-auto" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-neutral-500 mx-auto" />
                      )}
                    </td>

                    {/* Color swatch */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className="inline-block w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm"
                        style={{ backgroundColor: layer.color }}
                      />
                    </td>

                    {/* CAD Layer Code */}
                    <td className="py-2.5 px-3 font-mono font-semibold text-neutral-300">
                      {layer.cadCode}
                    </td>

                    {/* Layer Name & Description */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{layer.name}</span>
                        {layer.key === 'walls' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-normal">
                            Базовий
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 leading-snug">
                        {layer.description}
                      </div>
                    </td>

                    {/* Count */}
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-300">
                      {count > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-neutral-800/80 text-[11px]">
                          {count}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>

                    {/* Toggle button */}
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleToggle(layer.key)}
                        className={`w-11 h-6 rounded-full p-1 transition-colors relative inline-flex items-center ${
                          isVisible ? 'bg-sky-500' : 'bg-neutral-700'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${
                            isVisible ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#16171f] border-t border-neutral-800 flex items-center justify-between">
          <div className="text-xs text-neutral-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Зміни видимості застосовуються миттєво до робочого полотна креслення</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-400 text-neutral-950 transition-colors shadow-sm shadow-sky-500/20"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
