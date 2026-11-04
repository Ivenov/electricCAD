/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Download, Copy, Check, FileSpreadsheet, RotateCcw, Cable } from 'lucide-react';
import { CadProject, BomItem } from '../../types/cad';
import { getCableDisplayName, getCableCrossSection } from '../../utils/cadMath';

interface BillOfMaterialsModalProps {
  project: CadProject;
  onClose: () => void;
}

const STORAGE_KEY_PRICES = 'ELECTROPLAN_BOM_CUSTOM_PRICES';

export const BillOfMaterialsModal: React.FC<BillOfMaterialsModalProps> = ({ project, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [currency, setCurrency] = useState<'UAH' | 'USD' | 'EUR'>('UAH');
  
  // Custom user-defined unit price overrides
  const [customPrices, setCustomPrices] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PRICES);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Save custom prices to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRICES, JSON.stringify(customPrices));
    } catch (e) {
      console.warn('Failed to save custom prices:', e);
    }
  }, [customPrices]);

  const currencySymbol = currency === 'UAH' ? '₴' : currency === 'USD' ? '$' : '€';

  const handlePriceChange = (itemName: string, newPrice: number) => {
    setCustomPrices((prev) => ({
      ...prev,
      [itemName]: Math.max(0, newPrice),
    }));
  };

  const handleResetPrices = () => {
    setCustomPrices({});
    localStorage.removeItem(STORAGE_KEY_PRICES);
  };

  // Calculate takeoff items dynamically from project
  const bomItems: BomItem[] = useMemo(() => {
    const items: BomItem[] = [];

    // 1. CABLES & CONDUIT (Кабельна продукція)
    const cableLengths: Record<string, number> = {
      'VVGng_3x1.5': 0,
      'VVGng_3x2.5': 0,
      'VVGng_3x4': 0,
      'VVGng_3x6': 0,
      'FTP_Cat5e': 0,
    };

    project.wires.forEach((w) => {
      cableLengths[w.cableType] = (cableLengths[w.cableType] || 0) + (w.calculatedLengthM || 0);
    });

    const lightCount = project.elements.filter((e) => e.category === 'light' || e.category === 'switch').length;
    const socketCount = project.elements.filter((e) => e.category === 'socket').length;

    const projectedLightingCableM = Math.max(cableLengths['VVGng_3x1.5'], Math.round(lightCount * 4.5));
    const projectedSocketCableM = Math.max(cableLengths['VVGng_3x2.5'], Math.round(socketCount * 5.2));

    const addItem = (
      category: string,
      name: string,
      spec: string,
      unit: string,
      quantity: number,
      defaultUnitPrice: number
    ) => {
      if (quantity <= 0) return;
      const unitPrice = customPrices[name] !== undefined ? customPrices[name] : defaultUnitPrice;
      items.push({
        category,
        name,
        spec,
        unit,
        quantity,
        unitPrice,
        totalPrice: Math.round(quantity * unitPrice),
      });
    };

    addItem(
      '1. Кабельна продукція',
      'Кабель силовий ВВГнгд 3x1.5 (Освітлення)',
      'Мідний негорючий із низьким виділенням диму (ДСТУ)',
      'м',
      projectedLightingCableM,
      32
    );

    addItem(
      '1. Кабельна продукція',
      'Кабель силовий ВВГнгд 3x2.5 (Розетки 16А)',
      'Мідний трижильний моноліт (ДСТУ)',
      'м',
      projectedSocketCableM,
      52
    );

    if (cableLengths['VVGng_3x6'] > 0 || project.elements.some((e) => e.type === 'socket_cooker')) {
      const cookerCableM = Math.max(cableLengths['VVGng_3x6'], 18);
      addItem(
        '1. Кабельна продукція',
        'Кабель силовий ВВГнгд 3x6 (Плита 32А)',
        'Для індукційної варильної поверхні 7-8 кВт',
        'м',
        cookerCableM,
        118
      );
    }

    const totalConduitM = Math.round((projectedLightingCableM + projectedSocketCableM) * 0.9);
    addItem(
      '1. Кабельна продукція',
      'Труба гофрована ПВХ d20 із зондом',
      'Самозатухаюча з протяжкою + кліпси кріплення',
      'м',
      totalConduitM,
      11
    );

    // 2. SOCKETS & SWITCHES (Установочні вироби)
    const countByType: Record<string, number> = {};
    project.elements.forEach((el) => {
      countByType[el.type] = (countByType[el.type] || 0) + 1;
    });

    if (countByType['socket_single']) {
      addItem('2. Розетки та вимикачі', 'Розетка 230В 16А із заземленням', 'Механізм із захисними шторками IP20', 'шт', countByType['socket_single'], 140);
    }
    if (countByType['socket_double']) {
      addItem('2. Розетки та вимикачі', 'Розетка подвійна 2x230В', '2 механізми під рамку', 'шт', countByType['socket_double'] * 2, 140);
    }
    if (countByType['socket_triple']) {
      addItem('2. Розетки та вимикачі', 'Блок розеток 3x230В (фартух)', '3 механізми під єдину рамку', 'шт', countByType['socket_triple'] * 3, 140);
    }
    if (countByType['socket_ip44']) {
      addItem('2. Розетки та вимикачі', 'Розетка вологозахищена IP44 з кришкою', 'Для ванних кімнат та санвузлів', 'шт', countByType['socket_ip44'], 220);
    }
    if (countByType['socket_outdoor']) {
      addItem('2. Розетки та вимикачі', 'Розетка вулична вологостійка IP65', 'Для балконів, терас та фасадів', 'шт', countByType['socket_outdoor'], 350);
    }
    if (countByType['socket_cooker']) {
      addItem('2. Розетки та вимикачі', 'Силова розетка / кабельний вивід плити 32А', 'Для варильної поверхні до 8 кВт', 'шт', countByType['socket_cooker'], 280);
    }
    if (countByType['socket_3phase']) {
      addItem('2. Розетки та вимикачі', 'Силова 3-фазна розетка 400В 16А/32А', 'Червоний роз’єм 3P+N+PE', 'шт', countByType['socket_3phase'], 420);
    }
    if (countByType['socket_rj45']) {
      addItem('2. Розетки та вимикачі', 'Розетка комп’ютерна RJ45 Cat5e/6', 'Інтернет розетка під рамку', 'шт', countByType['socket_rj45'], 190);
    }
    if (countByType['switch_1g']) {
      addItem('2. Розетки та вимикачі', 'Вимикач 1-клавішний 10А', 'Механізм комутації освітлення', 'шт', countByType['switch_1g'], 130);
    }
    if (countByType['switch_2g']) {
      addItem('2. Розетки та вимикачі', 'Вимикач 2-клавішний 10А', 'Двоклавішний механізм', 'шт', countByType['switch_2g'], 160);
    }
    if (countByType['switch_pass']) {
      addItem('2. Розетки та вимикачі', 'Вимикач прохідний (перемикач)', 'Для коридорів та сходів', 'шт', countByType['switch_pass'], 180);
    }

    // Підрозетники
    const totalFlushBoxes = Object.entries(countByType).reduce((sum, [type, count]) => {
      if (type.startsWith('socket_') || type.startsWith('switch_') || type === 'thermostat') {
        const mul = type === 'socket_double' ? 2 : type === 'socket_triple' ? 3 : type === 'socket_quad' ? 4 : 1;
        return sum + count * mul;
      }
      return sum;
    }, 0);

    if (totalFlushBoxes > 0) {
      addItem('2. Розетки та вимикачі', 'Коробка монтажна (підрозетник) d68', 'Поглиблена з можливістю набору в блоки', 'шт', totalFlushBoxes, 18);
    }

    // 3. PANELS & AUTOMATION (Щитове обладнання)
    addItem('3. Щитове обладнання', 'Корпус щита вбудований (ЩРН 24-36 модулів)', 'Металевий або негорючий пластик із дверцятами', 'шт', 1, 1650);
    addItem('3. Щитове обладнання', `Ввідний автоматичний вимикач C${project.mainBreakerRatingA || 40}A 6кА`, '2-полюсний або 3-полюсний ввідний автомат', 'шт', 1, 480);
    addItem('3. Щитове обладнання', 'Реле захисту від перепадів напруги (Zubr / Welrok)', 'Цифровий вольтметр із регулюванням відсічки', 'шт', 1, 1450);

    const rcdCount = project.circuits.filter((c) => c.rcdType && c.rcdType !== 'none').length;
    if (rcdCount > 0) {
      addItem('3. Щитове обладнання', 'Пристрій захисного відключення (ПЗВ) 30мА / 10мА тип A', 'Захист людини від ураження струмом за ПУЕ', 'шт', rcdCount, 1250);
    }

    addItem('3. Щитове обладнання', 'Автоматичні вимикачі групові 10А / 16А / 32А (Hager/Schneider)', 'Однополюсні автомати 6кА тип B/C', 'шт', project.circuits.length, 210);

    // 4. CUSTOM & SPECIAL ELECTRICAL EQUIPMENT (Власне та нестандартне обладнання)
    const customElements = project.elements.filter((e) => e.isCustom || e.type === 'custom_element');
    const customMap: Record<string, { count: number; el: typeof project.elements[0] }> = {};
    customElements.forEach((el) => {
      if (!customMap[el.name]) customMap[el.name] = { count: 0, el };
      customMap[el.name].count++;
    });
    Object.entries(customMap).forEach(([name, { count, el }]) => {
      addItem(
        '4. Власне та нестандартне обладнання',
        name,
        `${el.powerWatts ? el.powerWatts + ' Вт, ' : ''}${el.ipRating || 'IP20'}, h=${el.mountingHeightMm || 300}мм`,
        'шт',
        count,
        850
      );
    });

    // 5. ARCHITECTURAL FURNITURE & SANITARY WARE (Меблі та сантехніка для прив'язки)
    if (project.furniture && project.furniture.length > 0) {
      const furnMap: Record<string, { count: number; item: typeof project.furniture[0] }> = {};
      project.furniture.forEach((f) => {
        if (!furnMap[f.name]) furnMap[f.name] = { count: 0, item: f };
        furnMap[f.name].count++;
      });
      Object.entries(furnMap).forEach(([name, { count, item }]) => {
        addItem(
          '5. Меблі та сантехніка (для електроприв\'язки)',
          name,
          `${item.width}×${item.height} мм${item.electricalHints ? ` — ${item.electricalHints.slice(0, 40)}...` : ''}`,
          'шт',
          count,
          0
        );
      });
    }

    return items;
  }, [project, customPrices]);

  const grandTotal = useMemo(() => {
    return bomItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [bomItems]);

  const estimatedLaborCost = useMemo(() => {
    return Math.round(grandTotal * 0.75);
  }, [grandTotal]);

  // Export BOM to CSV (with UTF-8 BOM so Excel opens with proper Ukrainian encoding)
  const handleExportCsv = () => {
    const headers = ['Категорія', 'Найменування', 'Характеристики', 'Одиниця', 'Кількість', `Ціна (${currencySymbol})`, `Сума (${currencySymbol})`];
    const rows = bomItems.map((item) => [
      `"${item.category}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.spec.replace(/"/g, '""')}"`,
      `"${item.unit}"`,
      item.quantity,
      item.unitPrice,
      item.totalPrice,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title.replace(/\s+/g, '_')}_Специфікація_Кошторис.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Export Cable Schedule (Журнал кабельних трас) to CSV
  const handleExportCableScheduleCsv = () => {
    const headers = ['№ кабелю', 'Номер групи', 'Марка кабелю', 'Переріз (мм²)', 'Спосіб прокладання', 'Розрахункова довжина (м)', 'Від точки', 'До точки'];
    const rows = project.wires.map((w, idx) => {
      const fromEl = project.elements.find((e) => e.id === w.fromId);
      const toEl = project.elements.find((e) => e.id === w.toId);
      const circuit = project.circuits.find((c) => c.id === w.circuitId);
      const crossSec = getCableCrossSection(w.cableType);
      return [
        `"${w.cableTag || `W-${idx + 1}`}"`,
        `"${circuit ? `Гр.${circuit.number}` : '—'}"`,
        `"${getCableDisplayName(w.cableType)}"`,
        crossSec,
        `"${w.conduit === 'ceiling' ? 'По стелі в гофрі' : w.conduit === 'floor' ? 'У стяжці підлоги' : 'Штроба у стіні'}"`,
        w.calculatedLengthM,
        `"${fromEl?.name || w.fromId}"`,
        `"${toEl?.name || w.toId}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title.replace(/\s+/g, '_')}_Журнал_кабельних_трас.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyClipboard = () => {
    const text = bomItems
      .map(
        (i) => `${i.name} — ${i.quantity} ${i.unit} x ${i.unitPrice} ${currencySymbol} = ${i.totalPrice} ${currencySymbol}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Специфікація обладнання та кошторис (BOM)
              </h2>
              <p className="text-xs text-neutral-400">
                Автоматичний розрахунок кількості кабелю, підрозетників, автоматів із можливістю редагування цін (§9 ТЗ)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Currency selector */}
            <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5 text-xs">
              {(['UAH', 'USD', 'EUR'] as const).map((curr) => (
                <button
                  key={curr}
                  onClick={() => setCurrency(curr)}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    currency === curr ? 'bg-sky-500 text-neutral-950 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {curr === 'UAH' ? '₴ UAH' : curr === 'USD' ? '$ USD' : '€ EUR'}
                </button>
              ))}
            </div>

            <button
              onClick={handleResetPrices}
              className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 text-xs transition-colors"
              title="Скинути ціни до стандартних"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleExportCableScheduleCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
              title="Експорт кабельного журналу ДСТУ в CSV/Excel"
            >
              <Cable className="w-3.5 h-3.5 text-amber-400" />
              <span>Журнал кабелів (CSV)</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
              title="Експорт кошторису в Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Кошторис (CSV)</span>
            </button>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-100 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/60 text-[11px] text-neutral-400">
                  <th className="py-2.5 px-4 font-medium">Найменування позиції</th>
                  <th className="py-2.5 px-4 font-medium hidden md:table-cell">Характеристики та призначення</th>
                  <th className="py-2.5 px-4 w-16 text-center font-medium">Од.</th>
                  <th className="py-2.5 px-4 w-20 text-right font-medium">Кіл-ть</th>
                  <th className="py-2.5 px-4 w-32 text-right font-medium">Ціна за од. ({currencySymbol})</th>
                  <th className="py-2.5 px-4 w-28 text-right font-medium">Сума ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {bomItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-neutral-900/30 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-neutral-200">
                      <div>{item.name}</div>
                      <div className="text-[10px] text-neutral-500 md:hidden mt-0.5">{item.spec}</div>
                    </td>
                    <td className="py-2.5 px-4 text-neutral-400 hidden md:table-cell text-[11px]">
                      {item.spec}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-neutral-400">
                      {item.unit}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-neutral-100 tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.unitPrice}
                          onChange={(e) => handlePriceChange(item.name, parseFloat(e.target.value) || 0)}
                          className="w-20 px-1.5 py-0.5 text-right font-mono text-xs bg-neutral-900 border border-neutral-700 rounded text-neutral-100 focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-neutral-500">{currencySymbol}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-neutral-100 tabular-nums">
                      {item.totalPrice.toLocaleString()} {currencySymbol}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <span className="text-xs text-neutral-400 block mb-1">Вартість матеріалів (чорнові + чистові):</span>
              <div className="text-xl font-bold font-mono text-neutral-100 tabular-nums">
                {grandTotal.toLocaleString()} {currencySymbol}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <span className="text-xs text-neutral-400 block mb-1">Орієнтовна вартість монтажу (роботи):</span>
              <div className="text-xl font-bold font-mono text-sky-400 tabular-nums">
                ~{estimatedLaborCost.toLocaleString()} {currencySymbol}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-sky-800/50 bg-sky-950/10">
              <span className="text-xs text-sky-300 block mb-1">РАЗОМ БЮДЖЕТ ЕЛЕКТРИКИ:</span>
              <div className="text-2xl font-bold font-mono text-sky-400 tabular-nums">
                {(grandTotal + estimatedLaborCost).toLocaleString()} {currencySymbol}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Всі ціни зберігаються в пам'яті браузера. Файли CSV підготовлені з UTF-8 BOM для бездоганного відкриття в Excel.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold rounded-lg text-xs transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
