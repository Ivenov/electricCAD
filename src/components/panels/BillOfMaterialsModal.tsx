import React, { useState, useMemo } from 'react';
import { Download, Copy, Check, FileSpreadsheet } from 'lucide-react';
import { CadProject, BomItem } from '../../types/cad';

interface BillOfMaterialsModalProps {
  project: CadProject;
  onClose: () => void;
}

export const BillOfMaterialsModal: React.FC<BillOfMaterialsModalProps> = ({ project, onClose }) => {
  const [copied, setCopied] = useState(false);

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
      cableLengths[w.cableType] = (cableLengths[w.cableType] || 0) + w.calculatedLengthM;
    });

    const lightCount = project.elements.filter((e) => e.category === 'light' || e.category === 'switch').length;
    const socketCount = project.elements.filter((e) => e.category === 'socket').length;

    const projectedLightingCableM = Math.max(cableLengths['VVGng_3x1.5'], Math.round(lightCount * 4.5));
    const projectedSocketCableM = Math.max(cableLengths['VVGng_3x2.5'], Math.round(socketCount * 5.2));

    items.push({
      category: '1. Кабельна продукція',
      name: 'Кабель силовий ВВГнгд 3x1.5 (Освітлення)',
      spec: 'Мідний негорючий із низьким виділенням диму (ДСТУ)',
      unit: 'м',
      quantity: projectedLightingCableM,
      unitPrice: 32,
      totalPrice: projectedLightingCableM * 32,
    });

    items.push({
      category: '1. Кабельна продукція',
      name: 'Кабель силовий ВВГнгд 3x2.5 (Розетки 16А)',
      spec: 'Мідний трижильний моноліт (ДСТУ)',
      unit: 'м',
      quantity: projectedSocketCableM,
      unitPrice: 52,
      totalPrice: projectedSocketCableM * 52,
    });

    if (cableLengths['VVGng_3x6'] > 0 || project.elements.some((e) => e.type === 'socket_cooker')) {
      const cookerCableM = Math.max(cableLengths['VVGng_3x6'], 18);
      items.push({
        category: '1. Кабельна продукція',
        name: 'Кабель силовий ВВГнгд 3x6 (Плита 32А)',
        spec: 'Для індукційної варильної поверхні 7-8 кВт',
        unit: 'м',
        quantity: cookerCableM,
        unitPrice: 118,
        totalPrice: cookerCableM * 118,
      });
    }

    const totalConduitM = Math.round((projectedLightingCableM + projectedSocketCableM) * 0.9);
    items.push({
      category: '1. Кабельна продукція',
      name: 'Труба гофрована ПВХ d20 із зондом',
      spec: 'Самозатухаюча з протяжкою + кліпси кріплення',
      unit: 'м',
      quantity: totalConduitM,
      unitPrice: 11,
      totalPrice: totalConduitM * 11,
    });

    // 2. SOCKETS & SWITCHES (Установочні вироби)
    const countByType: Record<string, number> = {};
    project.elements.forEach((el) => {
      countByType[el.type] = (countByType[el.type] || 0) + 1;
    });

    if (countByType['socket_single']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Розетка із заземленням 220В 16А',
        spec: 'Вбудований механізм із захисними шторками',
        unit: 'шт',
        quantity: countByType['socket_single'],
        unitPrice: 140,
        totalPrice: countByType['socket_single'] * 140,
      });
    }

    if (countByType['socket_double']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Розетка подвійна (блок 2х)',
        spec: '2 механізми під спільну рамку',
        unit: 'шт',
        quantity: countByType['socket_double'] * 2,
        unitPrice: 140,
        totalPrice: countByType['socket_double'] * 2 * 140,
      });
    }

    if (countByType['socket_triple']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Блок розеток 3x220В (3 механізми)',
        spec: 'Механізми розеток для фартуха кухні/кабінету',
        unit: 'шт',
        quantity: countByType['socket_triple'] * 3,
        unitPrice: 140,
        totalPrice: countByType['socket_triple'] * 3 * 140,
      });
    }

    if (countByType['socket_quad']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Блок розеток 4x220В (4 механізми)',
        spec: 'Механізми розеток для ТВ-зони',
        unit: 'шт',
        quantity: countByType['socket_quad'] * 4,
        unitPrice: 140,
        totalPrice: countByType['socket_quad'] * 4 * 140,
      });
    }

    if (countByType['socket_ip44']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Розетка вологозахисна IP44 із кришкою',
        spec: 'Для санвузлів та вологих зон',
        unit: 'шт',
        quantity: countByType['socket_ip44'],
        unitPrice: 230,
        totalPrice: countByType['socket_ip44'] * 230,
      });
    }

    if (countByType['socket_cooker']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Силовий кабельний вивід / Розетка 32A',
        spec: 'Клемна колодка прямого підключення індукції',
        unit: 'шт',
        quantity: countByType['socket_cooker'],
        unitPrice: 420,
        totalPrice: countByType['socket_cooker'] * 420,
      });
    }

    if (countByType['socket_rj45']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Розетка комп\'ютерна RJ-45 Cat5e/6',
        spec: 'Інформаційний модуль для роутера / SmartTV',
        unit: 'шт',
        quantity: countByType['socket_rj45'],
        unitPrice: 210,
        totalPrice: countByType['socket_rj45'] * 210,
      });
    }

    if (countByType['switch_1g']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Вимикач 1-клавішний 10А',
        spec: 'Однополюсний механізм освітлення',
        unit: 'шт',
        quantity: countByType['switch_1g'],
        unitPrice: 145,
        totalPrice: countByType['switch_1g'] * 145,
      });
    }

    if (countByType['switch_2g']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Вимикач 2-клавішний 10А',
        spec: 'Двоклавішний механізм для 2 груп світла',
        unit: 'шт',
        quantity: countByType['switch_2g'],
        unitPrice: 170,
        totalPrice: countByType['switch_2g'] * 170,
      });
    }

    if (countByType['switch_pass']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Перемикач прохідний (2-way)',
        spec: 'Керування світлом із двох точок',
        unit: 'шт',
        quantity: countByType['switch_pass'],
        unitPrice: 195,
        totalPrice: countByType['switch_pass'] * 195,
      });
    }

    if (countByType['thermostat']) {
      items.push({
        category: '2. Розетки та механізми',
        name: 'Терморегулятор для теплої підлоги',
        spec: 'Електронний програмований 16А з виносним датчиком',
        unit: 'шт',
        quantity: countByType['thermostat'],
        unitPrice: 1400,
        totalPrice: countByType['thermostat'] * 1400,
      });
    }

    // Підрозетники
    const totalBackboxes = project.elements.filter(
      (e) => e.category === 'socket' || e.category === 'switch'
    ).length * 1.5;
    const roundedBackboxes = Math.max(Math.round(totalBackboxes), 15);
    items.push({
      category: '2. Розетки та механізми',
      name: 'Підрозетники поглиблені 68х60мм',
      spec: 'Для бетону/цегли із замками стикування в блок',
      unit: 'шт',
      quantity: roundedBackboxes,
      unitPrice: 18,
      totalPrice: roundedBackboxes * 18,
    });

    // 3. ELECTRICAL PANEL HARDWARE (Щитове обладнання)
    items.push({
      category: '3. Щитове обладнання',
      name: `Щит розподільчий вбудований на ${project.circuits.length > 8 ? 24 : 12} мод.`,
      spec: 'Металевий/пластиковий із білими дверцятами (IP40)',
      unit: 'шт',
      quantity: 1,
      unitPrice: 1900,
      totalPrice: 1900,
    });

    items.push({
      category: '3. Щитове обладнання',
      name: `Ввідний автоматичний вимикач 2P ${project.mainBreakerRatingA}A`,
      spec: 'Вимикальна здатність 6кА, характеристика C',
      unit: 'шт',
      quantity: 1,
      unitPrice: 380,
      totalPrice: 380,
    });

    items.push({
      category: '3. Щитове обладнання',
      name: 'Реле контролю напруги (РКН 63A Zubr / Welrok)',
      spec: 'Захист від перепадів 230В та обриву нуля',
      unit: 'шт',
      quantity: 1,
      unitPrice: 1600,
      totalPrice: 1600,
    });

    const circuitBreakersCount = project.circuits.length;
    items.push({
      category: '3. Щитове обладнання',
      name: 'Автоматичні вимикачі 1P C10A / C16A / C32A',
      spec: 'Модульні автомати на DIN-рейку 6кА',
      unit: 'шт',
      quantity: circuitBreakersCount,
      unitPrice: 160,
      totalPrice: circuitBreakersCount * 160,
    });

    const rcdCount = project.circuits.filter((c) => c.rcdType !== 'none').length;
    if (rcdCount > 0) {
      items.push({
        category: '3. Щитове обладнання',
        name: 'ПЗВ / Диференційні автомати 30мА та 10мА (Тип А)',
        spec: 'Електромеханічний захист від струмів витоку',
        unit: 'шт',
        quantity: Math.min(rcdCount, 4),
        unitPrice: 1200,
        totalPrice: Math.min(rcdCount, 4) * 1200,
      });
    }

    return items;
  }, [project]);

  const grandTotal = useMemo(() => {
    return bomItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [bomItems]);

  const estimatedLaborCost = Math.round(grandTotal * 0.85);

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Категорія', 'Найменування', 'Характеристики', 'Од.вим.', 'Кількість', 'Ціна (грн)', 'Сума (грн)'];
    const rows = bomItems.map((item) => [
      `"${item.category}"`,
      `"${item.name}"`,
      `"${item.spec}"`,
      `"${item.unit}"`,
      item.quantity,
      item.unitPrice,
      item.totalPrice,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Специфікація_${project.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyClipboard = () => {
    const text = bomItems
      .map((item) => `${item.name} — ${item.quantity} ${item.unit} x ${item.unitPrice} грн = ${item.totalPrice} грн`)
      .join('\n');
    navigator.clipboard.writeText(`Специфікація проекту: ${project.title}\n\n${text}\n\nРазом матеріали: ${grandTotal.toLocaleString()} грн.`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Відомість матеріалів та Кошторис проекту
              </h2>
              <p className="text-xs text-neutral-400">
                Автоматичний підрахунок кабелів, механізмів, щитового обладнання та кошторис у гривнях (₴)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопійовано!' : 'Копіювати'}</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Експорт у CSV</span>
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
                  <th className="py-2.5 px-4 w-24 text-right font-medium">Ціна, ₴</th>
                  <th className="py-2.5 px-4 w-28 text-right font-medium">Сума, ₴</th>
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
                    <td className="py-2.5 px-4 text-right font-mono text-neutral-400 tabular-nums">
                      {item.unitPrice.toLocaleString()} ₴
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-neutral-100 tabular-nums">
                      {item.totalPrice.toLocaleString()} ₴
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
                {grandTotal.toLocaleString()} ₴
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <span className="text-xs text-neutral-400 block mb-1">Орієнтовна вартість монтажу (роботи):</span>
              <div className="text-xl font-bold font-mono text-sky-400 tabular-nums">
                ~{estimatedLaborCost.toLocaleString()} ₴
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-sky-800/50 bg-sky-950/10">
              <span className="text-xs text-sky-300 block mb-1">РАЗОМ БЮДЖЕТ ЕЛЕКТРИКИ:</span>
              <div className="text-2xl font-bold font-mono text-sky-400 tabular-nums">
                {(grandTotal + estimatedLaborCost).toLocaleString()} ₴
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Довжини кабелів розраховані з урахуванням спусків/підйомів та запасу 15% на оброблення кінців.
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
