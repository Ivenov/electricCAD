import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  Sparkles,
  Zap,
  Sofa,
  Layers,
  Check,
  Search,
  Sliders,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { CustomLibraryItem, CustomSymbolShape, ElectricalCategory, FurnitureCategory } from '../../types/cad';
import {
  getStoredCustomLibrary,
  saveStoredCustomLibrary,
  downloadCustomLibraryJson,
  parseCustomLibraryJson,
  DEFAULT_CUSTOM_ITEMS,
} from '../../utils/customLibraryStorage';

interface CustomLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItemForPlacement?: (item: CustomLibraryItem) => void;
  onLibraryUpdated?: (items: CustomLibraryItem[]) => void;
}

export const CustomLibraryModal: React.FC<CustomLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectItemForPlacement,
  onLibraryUpdated,
}) => {
  const [items, setItems] = useState<CustomLibraryItem[]>(() => getStoredCustomLibrary());
  const [activeTab, setActiveTab] = useState<'all' | 'electrical' | 'furniture' | 'create'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Form State for creating / editing an item
  const [formKind, setFormKind] = useState<'electrical' | 'furniture'>('electrical');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<string>('custom');
  const [formPower, setFormPower] = useState<number>(500);
  const [formHeight, setFormHeight] = useState<number>(300);
  const [formIp, setFormIp] = useState<'IP20' | 'IP44' | 'IP65'>('IP20');
  const [formPhase, setFormPhase] = useState<'L1' | 'L2' | 'L3' | '3-phase'>('L1');
  const [formBreaker, setFormBreaker] = useState<10 | 16 | 20 | 25 | 32 | 40 | 50 | 63>(16);
  const [formCable, setFormCable] = useState<'VVGng_3x1.5' | 'VVGng_3x2.5' | 'VVGng_3x4' | 'VVGng_3x6' | 'FTP_Cat5e' | 'KNX_Bus'>('VVGng_3x2.5');
  const [formShape, setFormShape] = useState<CustomSymbolShape>('circle');
  const [formColor, setFormColor] = useState<string>('#38bdf8');
  // Furniture specific
  const [formWidthMm, setFormWidthMm] = useState<number>(1200);
  const [formDepthMm, setFormDepthMm] = useState<number>(800);
  const [formCadShape, setFormCadShape] = useState<string>('generic');
  // Text notes
  const [formShortDesc, setFormShortDesc] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formHints, setFormHints] = useState('');

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const persistItems = (newItems: CustomLibraryItem[]) => {
    setItems(newItems);
    saveStoredCustomLibrary(newItems);
    onLibraryUpdated?.(newItems);
  };

  // Filtered Items
  const filteredItems = items.filter((it) => {
    if (activeTab === 'electrical' && it.kind !== 'electrical') return false;
    if (activeTab === 'furniture' && it.kind !== 'furniture') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        it.name.toLowerCase().includes(q) ||
        (it.shortDesc && it.shortDesc.toLowerCase().includes(q)) ||
        (it.notes && it.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showNotification('Помилка: введіть назву елемента');
      return;
    }

    const hintsArray = formHints
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newItem: CustomLibraryItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: formName.trim(),
      kind: formKind,
      category: formCategory as any,
      shortDesc: formShortDesc.trim() || undefined,
      notes: formNotes.trim() || undefined,
      electricalHints: hintsArray.length > 0 ? hintsArray : undefined,
      createdAt: new Date().toISOString(),
      ...(formKind === 'electrical'
        ? {
            electricalType: 'custom_element',
            powerWatts: Number(formPower) || 0,
            mountingHeightMm: Number(formHeight) || 300,
            ipRating: formIp,
            phase: formPhase,
            recommendedBreakerA: formBreaker,
            recommendedCable: formCable,
            symbolShape: formShape,
            symbolColor: formColor,
          }
        : {
            furnitureType: 'desk',
            widthMm: Number(formWidthMm) || 1000,
            heightMm: Number(formDepthMm) || 600,
            cadShape: formCadShape,
          }),
    };

    const updated = [newItem, ...items];
    persistItems(updated);
    showNotification(`Елемент «${newItem.name}» успішно додано до бібліотеки!`);
    setActiveTab('all');

    // Reset Form
    setFormName('');
    setFormShortDesc('');
    setFormNotes('');
    setFormHints('');
  };

  const handleDeleteItem = (id: string, name: string) => {
    if (confirm(`Видалити «${name}» з бібліотеки?`)) {
      const updated = items.filter((it) => it.id !== id);
      persistItems(updated);
      showNotification(`Елемент «${name}» видалено`);
    }
  };

  const handleDuplicateItem = (item: CustomLibraryItem) => {
    const duplicated: CustomLibraryItem = {
      ...item,
      id: `custom_${Date.now()}_copy`,
      name: `${item.name} (Копія)`,
      createdAt: new Date().toISOString(),
    };
    const updated = [duplicated, ...items];
    persistItems(updated);
    showNotification(`Створено копію: ${duplicated.name}`);
  };

  const handleExportJson = () => {
    downloadCustomLibraryJson(items);
    showNotification('Бібліотеку експортовано у файл JSON');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = parseCustomLibraryJson(text);
        if (imported.length === 0) {
          showNotification('У файлі не знайдено елементів');
          return;
        }

        // Merge: avoid duplicates by id, or append
        const existingIds = new Set(items.map((i) => i.id));
        const merged = [...items];
        imported.forEach((it) => {
          if (existingIds.has(it.id)) {
            it.id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          }
          merged.unshift(it);
        });

        persistItems(merged);
        showNotification(`Успішно імпортовано ${imported.length} елементів!`);
      } catch (err: any) {
        showNotification(`Помилка імпорту JSON: ${err.message || 'Некоректний файл'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDefaults = () => {
    if (confirm('Скинути бібліотеку до стандартного інженерного набору?')) {
      persistItems(DEFAULT_CUSTOM_ITEMS);
      showNotification('Бібліотеку відновлено до заводських налаштувань');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Власна бібліотека CAD
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-normal border border-amber-500/30">
                  {items.length} елементів
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Створення, налаштування та імпорт користувацьких символів, приладів та меблів
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-colors"
              title="Експортувати бібліотеку у файл .JSON"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Експорт JSON</span>
            </button>

            <label className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Імпорт JSON</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback alert banner */}
        {feedbackMsg && (
          <div className="bg-sky-500/15 border-b border-sky-500/30 px-6 py-2 text-xs font-medium text-sky-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Tabs and Search Bar */}
        <div className="px-6 py-3 border-b border-neutral-800 bg-neutral-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Всі ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('electrical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'electrical'
                  ? 'bg-neutral-800 text-amber-300 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Електрика ({items.filter((i) => i.kind === 'electrical').length})</span>
            </button>
            <button
              onClick={() => setActiveTab('furniture')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === 'furniture'
                  ? 'bg-neutral-800 text-sky-300 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sofa className="w-3.5 h-3.5 text-sky-400" />
              <span>Меблі ({items.filter((i) => i.kind === 'furniture').length})</span>
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                activeTab === 'create'
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-neutral-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Створити елемент</span>
            </button>
          </div>

          {activeTab !== 'create' && (
            <div className="relative w-64">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Пошук у бібліотеці..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'create' ? (
            /* CREATE FORM */
            <form onSubmit={handleCreateSubmit} className="max-w-2xl mx-auto space-y-6">
              <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                    Тип об'єкта бібліотеки
                  </div>
                  <div className="text-xs text-neutral-400">Оберіть категорію для правильного розрахунку та відображення</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormKind('electrical');
                      setFormShape('circle');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                      formKind === 'electrical'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>⚡ Електрообладнання</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormKind('furniture');
                      setFormCategory('living');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                      formKind === 'furniture'
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Sofa className="w-4 h-4 text-sky-400" />
                    <span>🛋️ Меблі / Сантехніка</span>
                  </button>
                </div>
              </div>

              {/* General Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Назва елемента *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      formKind === 'electrical'
                        ? 'напр. Зарядка EVSE 22kW, Серверна шафа 19", Тепла підлога...'
                        : 'напр. Барна стійка острівна, М’який пуф, Шафа 1200...'
                    }
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Короткий опис / маркування
                  </label>
                  <input
                    type="text"
                    placeholder="напр. Настінне виконання, 3P+N, захист IP65"
                    value={formShortDesc}
                    onChange={(e) => setFormShortDesc(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {formKind === 'electrical' ? (
                  /* ELECTRICAL SPECIFIC FIELDS */
                  <div className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800 space-y-4">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Електричні та монтажні параметри</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Потужність (Вт)</label>
                        <input
                          type="number"
                          min="0"
                          max="100000"
                          step="50"
                          value={formPower}
                          onChange={(e) => setFormPower(Number(e.target.value))}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Висота монтажу (мм)</label>
                        <input
                          type="number"
                          min="0"
                          max="3500"
                          step="50"
                          value={formHeight}
                          onChange={(e) => setFormHeight(Number(e.target.value))}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Клас захисту IP</label>
                        <select
                          value={formIp}
                          onChange={(e) => setFormIp(e.target.value as any)}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                        >
                          <option value="IP20">IP20 (Сухі приміщення)</option>
                          <option value="IP44">IP44 (Санвузли, фартух)</option>
                          <option value="IP65">IP65 (Вулиця, волога)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Живлення / Фаза</label>
                        <select
                          value={formPhase}
                          onChange={(e) => setFormPhase(e.target.value as any)}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                        >
                          <option value="L1">1-фазне 230В (Фаза L1)</option>
                          <option value="L2">1-фазне 230В (Фаза L2)</option>
                          <option value="L3">1-фазне 230В (Фаза L3)</option>
                          <option value="3-phase">3-фазне 400В (L1+L2+L3)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Автомат захисту</label>
                        <select
                          value={formBreaker}
                          onChange={(e) => setFormBreaker(Number(e.target.value) as any)}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                        >
                          <option value="10">10А (Освітлення / До 2.2кВт)</option>
                          <option value="16">16А (Розетки / До 3.5кВт)</option>
                          <option value="20">20А (До 4.4кВт)</option>
                          <option value="25">25А (Кондиціонери / До 5.5кВт)</option>
                          <option value="32">32А (Плита / До 7.2кВт)</option>
                          <option value="40">40А (Ввід / До 9кВт)</option>
                          <option value="50">50А</option>
                          <option value="63">63А</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Рекомендований кабель</label>
                        <select
                          value={formCable}
                          onChange={(e) => setFormCable(e.target.value as any)}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                        >
                          <option value="VVGng_3x1.5">ВВГнгд 3×1.5 мм²</option>
                          <option value="VVGng_3x2.5">ВВГнгд 3×2.5 мм²</option>
                          <option value="VVGng_3x4">ВВГнгд 3×4 мм²</option>
                          <option value="VVGng_3x6">ВВГнгд 3×6 мм²</option>
                          <option value="KNX_Bus">KNX Bus JY(St)Y 2×2×0.8</option>
                          <option value="FTP_Cat5e">Вита пара FTP Cat5e/6</option>
                        </select>
                      </div>
                    </div>

                    {/* Vector Symbol Selector */}
                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1.5">
                        Умовне графічне позначення (Векторний символ CAD)
                      </label>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        {[
                          { shape: 'ev_charger', label: 'EV Зарядка' },
                          { shape: 'rack', label: 'Стійка 19"' },
                          { shape: 'speaker', label: 'Акустика' },
                          { shape: 'motor', label: 'Двигун M' },
                          { shape: 'square', label: 'Термостат' },
                          { shape: 'sensor', label: 'Датчик' },
                          { shape: 'circle', label: 'Коло' },
                          { shape: 'socket', label: 'Розетка' },
                          { shape: 'switch', label: 'Вимикач' },
                          { shape: 'light', label: 'Світильник' },
                          { shape: 'triangle', label: 'Увага !' },
                          { shape: 'cross', label: 'Хрест ✕' },
                          { shape: 'diamond', label: 'Ромб ◇' },
                          { shape: 'star', label: 'Зірка ★' },
                        ].map(({ shape, label }) => (
                          <button
                            key={shape}
                            type="button"
                            onClick={() => setFormShape(shape as any)}
                            className={`p-2 rounded-lg border text-center flex flex-col items-center gap-1 transition-all ${
                              formShape === shape
                                ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                            }`}
                          >
                            <span className="text-sm">
                              {shape === 'ev_charger' && '🔌'}
                              {shape === 'rack' && '🗄️'}
                              {shape === 'speaker' && '🔊'}
                              {shape === 'motor' && '⚙️'}
                              {shape === 'square' && '⏹️'}
                              {shape === 'sensor' && '📡'}
                              {shape === 'circle' && '⚪'}
                              {shape === 'socket' && '⚡'}
                              {shape === 'switch' && '🎛️'}
                              {shape === 'light' && '💡'}
                              {shape === 'triangle' && '⚠️'}
                              {shape === 'cross' && '✖️'}
                              {shape === 'diamond' && '💎'}
                              {shape === 'star' && '⭐'}
                            </span>
                            <span className="text-[10px] leading-tight truncate w-full">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Symbol Color Picker */}
                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1.5">Колір символу на плані</label>
                      <div className="flex items-center gap-2">
                        {[
                          '#38bdf8', // Sky
                          '#10b981', // Emerald
                          '#f59e0b', // Amber
                          '#ef4444', // Red
                          '#a855f7', // Purple
                          '#ec4899', // Pink
                          '#06b6d4', // Cyan
                          '#f97316', // Orange
                        ].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setFormColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${
                              formColor === c ? 'scale-110 border-white' : 'border-transparent opacity-80'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* FURNITURE SPECIFIC FIELDS */
                  <div className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800 space-y-4">
                    <div className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sofa className="w-3.5 h-3.5" />
                      <span>Архітектурні розміри та форма меблів</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Ширина (мм)</label>
                        <input
                          type="number"
                          min="200"
                          max="6000"
                          step="50"
                          value={formWidthMm}
                          onChange={(e) => setFormWidthMm(Number(e.target.value))}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Глибина / Довжина (мм)</label>
                        <input
                          type="number"
                          min="200"
                          max="6000"
                          step="50"
                          value={formDepthMm}
                          onChange={(e) => setFormDepthMm(Number(e.target.value))}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Базова CAD форма</label>
                        <select
                          value={formCadShape}
                          onChange={(e) => setFormCadShape(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                        >
                          <option value="generic">Універсальний блок (Контур з фаскою)</option>
                          <option value="desk">Письмовий / комп'ютерний стіл</option>
                          <option value="dining_table">Обідній стіл зі стільцями</option>
                          <option value="sofa_straight">Диван з підлокітниками</option>
                          <option value="wardrobe">Шафа з розсувними дверима</option>
                          <option value="kitchen_counter">Кухонний модуль стільниці</option>
                          <option value="bathtub">Ванна з ергономічним контуром</option>
                          <option value="shower">Душовий куточок з трапом</option>
                          <option value="washbasin">Умивальник з чашею</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Technical notes & electrical proximity recommendations */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Технічні примітки та рекомендації ПУЕ / ДБН
                  </label>
                  <textarea
                    rows={2}
                    placeholder="напр. ПУЕ §1.7.79: потрібен диференційний захист ПЗВ 30мА або окрема лінія"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Електротехнічні підказки прив'язки (по одній на рядок)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Розетка 220В на висоті +1100 мм&#10;Окрема лінія від щита"
                    value={formHints}
                    onChange={(e) => setFormHints(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Зберегти в бібліотеку</span>
                </button>
              </div>
            </form>
          ) : (
            /* ITEMS LIST GRID */
            <div className="space-y-4">
              {filteredItems.length === 0 ? (
                <div className="py-16 text-center text-neutral-500">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Елементів не знайдено</p>
                  <p className="text-xs text-neutral-600 mt-1">
                    Створіть свій перший елемент або змініть критерії пошуку
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="mt-4 px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400 transition-colors"
                  >
                    + Створити елемент
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        {/* Top info badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                                item.kind === 'electrical'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              }`}
                            >
                              {item.kind === 'electrical' ? '⚡' : '🛋️'}
                            </span>
                            <div>
                              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                                {item.name}
                              </h3>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                {item.kind === 'electrical'
                                  ? `${item.powerWatts || 0} Вт · ${item.recommendedBreakerA || 16}A · +${item.mountingHeightMm || 300} мм`
                                  : `${item.widthMm}×${item.heightMm} мм`}
                              </span>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDuplicateItem(item)}
                              title="Дублювати елемент"
                              className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              title="Видалити"
                              className="w-7 h-7 rounded flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-neutral-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        {item.shortDesc && (
                          <p className="text-xs text-neutral-300 mb-2">{item.shortDesc}</p>
                        )}

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {item.kind === 'electrical' ? (
                            <>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                                {item.phase === '3-phase' ? '380В (3Ф)' : '220В (1Ф)'}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                                {item.ipRating || 'IP20'}
                              </span>
                              {item.recommendedCable && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-amber-400">
                                  {item.recommendedCable}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-sky-400">
                              Форма: {item.cadShape || 'стандарт'}
                            </span>
                          )}
                        </div>

                        {/* Electrical Proximity Hints */}
                        {item.electricalHints && item.electricalHints.length > 0 && (
                          <div className="text-[11px] text-neutral-400 bg-neutral-900/50 p-2 rounded-lg border border-neutral-800/80 mb-3 space-y-0.5">
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wide mb-1">
                              Рекомендації розміщення розеток:
                            </div>
                            {item.electricalHints.map((hint, idx) => (
                              <div key={idx} className="flex items-start gap-1.5">
                                <span className="text-amber-500">•</span>
                                <span>{hint}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Insertion button */}
                      {onSelectItemForPlacement && (
                        <button
                          onClick={() => {
                            onSelectItemForPlacement(item);
                            onClose();
                          }}
                          className="w-full py-2 rounded-lg text-xs font-bold bg-neutral-900 hover:bg-sky-500 hover:text-neutral-950 text-sky-400 border border-neutral-800 hover:border-sky-400 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Вставити на план</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-900/80 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span>Збережено локально та у файлі проєкту</span>
            <span className="text-neutral-600">·</span>
            <button
              onClick={handleResetDefaults}
              className="text-neutral-500 hover:text-neutral-300 transition-colors underline"
            >
              Скинути до стандартних
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
