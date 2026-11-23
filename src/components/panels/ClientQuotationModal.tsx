import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  Building2,
  User,
  Calculator,
  Percent,
  Coins,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  Save,
  Layers,
  Wrench,
  Boxes,
  Zap,
  Loader2,
} from 'lucide-react';
import { CadProject, ContractorProfile, ClientQuotationConfig, QuotationLineItem } from '../../types/cad';
import { downloadCsvFile } from '../../utils/excelCsvUtils';
import { getAggregatedProjectData } from '../../utils/projectAggregator';
import { generateCableSchedule } from '../../utils/cableSchedule';
import { exportQuotationToPdf } from '../../utils/pdfExport';

interface ClientQuotationModalProps {
  project: CadProject;
  onUpdateProject?: (updated: CadProject) => void;
  onClose: () => void;
}

const STORAGE_KEY_CONTRACTOR = 'electroplan_contractor_profile_v1';

const DEFAULT_CONTRACTOR: ContractorProfile = {
  companyName: 'ФОП Електромонтаж Профі',
  contractorName: 'Олександр Коваленко',
  taxId: '2938401928',
  phone: '+380 (67) 555-24-32',
  email: 'profi.electro.ua@gmail.com',
  iban: 'UA123052990000026001234567890',
  bankName: 'АТ КБ «ПриватБанк»',
  address: 'м. Київ, вул. Електриків, 14',
  logoUrl: ''
};

const DEFAULT_QUOTATION_CONFIG: ClientQuotationConfig = {
  materialMarkupPercent: 15, // 15% націнка на чорнові матеріали
  clientDiscountPercent: 0,
  taxPercent: 5, // 5% єдиний податок 3 група
  difficultyMultiplier: 1.15, // моноліт/бетон
  currency: 'UAH',
  validUntilDays: 14,
  notes: 'Вартість робіт та матеріалів розрахована згідно з наданим кресленням електропроводки. Термін дії пропозиції 14 календарних днів. Гарантія на виконані електромонтажні роботи — 36 місяців.'
};

export const ClientQuotationModal: React.FC<ClientQuotationModalProps> = ({
  project,
  onUpdateProject,
  onClose
}) => {
  // Load saved contractor or fallback
  const [contractor, setContractor] = useState<ContractorProfile>(() => {
    if (project.contractorProfile?.companyName) {
      return project.contractorProfile;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONTRACTOR);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return DEFAULT_CONTRACTOR;
  });

  const [config, setConfig] = useState<ClientQuotationConfig>(() => {
    return project.quotationConfig || DEFAULT_QUOTATION_CONFIG;
  });

  const [clientName, setClientName] = useState<string>(project.quotationConfig?.clientName || 'Петренко Іван Олексійович');
  const [objectAddress, setObjectAddress] = useState<string>(project.quotationConfig?.projectAddress || 'м. Київ, ЖК «Новопечерські Липки», секція 3, кв. 78');
  const [activeTab, setActiveTab] = useState<'quotation' | 'settings'>('quotation');
  const [isSavedNotice, setIsSavedNotice] = useState<boolean>(false);

  // Save profile changes to local storage & project
  const handleSaveProfile = () => {
    try {
      localStorage.setItem(STORAGE_KEY_CONTRACTOR, JSON.stringify(contractor));
    } catch (e) {}

    const updatedConfig: ClientQuotationConfig = {
      ...config,
      clientName,
      projectAddress: objectAddress,
    };

    if (onUpdateProject) {
      onUpdateProject({
        ...project,
        contractorProfile: contractor,
        quotationConfig: updatedConfig
      });
    }

    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  // Image logo upload (base64)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setContractor(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const aggregated = useMemo(() => getAggregatedProjectData(project), [project]);
  const cableSchedule = useMemo(() => generateCableSchedule(project), [project]);

  // 1. Calculate Cable Lengths grouped by spec across ALL floors + riser feeders (using exact meter schedule)
  const cableTotals = useMemo(() => {
    return cableSchedule.byCableType.map((item) => ({
      spec: item.spec,
      rawLength: item.totalLengthM,
      finalLength: Math.ceil(item.totalLengthM),
    }));
  }, [cableSchedule]);

  // 2. Count Electrical Elements by category across ALL floors
  const elementCounts = useMemo(() => {
    const counts = {
      sockets: 0,
      switches: 0,
      lights: 0,
      junctionBoxes: 0,
      panels: Math.max(1, aggregated.syncedFloors.length),
      lowCurrent: 0,
      appliances: 0
    };

    aggregated.allElements.forEach(el => {
      const t = el.type;
      if (t.includes('socket')) counts.sockets++;
      else if (t.includes('switch')) counts.switches++;
      else if (t.includes('light') || t.includes('chandelier') || t.includes('strip')) counts.lights++;
      else if (t.includes('box')) counts.junctionBoxes++;
      else if (t.includes('panel')) { /* tracked per floor board */ }
      else if (t.includes('lan') || t.includes('tv') || t.includes('sensor')) counts.lowCurrent++;
      else counts.appliances++;
    });

    return counts;
  }, [aggregated]);

  // 3. Count Modular breaker/rcd units from circuits
  const panelUnitsCount = useMemo(() => {
    let breakers = project.circuits.length;
    let rcds = 0;
    project.circuits.forEach(c => {
      if (c.rcdType && c.rcdType !== 'none') rcds++;
    });
    // Add incoming main breaker + surge protector + voltage relay
    return {
      breakers: Math.max(breakers, 1),
      rcds,
      mainBreaker: 1,
      voltageRelay: 1, // Зубр / ZUBR
      totalModules: Math.max(breakers, 1) + (rcds * 2) + 2 + 2
    };
  }, [project.circuits]);

  // 4. Build standard items for 4 sections
  const quotationSections = useMemo(() => {
    const markupRate = 1 + (config.materialMarkupPercent / 100);
    const difficultyRate = config.difficultyMultiplier || 1.0;

    // --- РОЗДІЛ 1: Чорнові матеріали ---
    const roughItems: QuotationLineItem[] = [];
    let rIdx = 1;

    cableTotals.forEach(c => {
      let unitBasePrice = 48; // avg ВВГнгд 3х2.5
      if (c.spec.includes('1.5')) unitBasePrice = 32;
      else if (c.spec.includes('4')) unitBasePrice = 78;
      else if (c.spec.includes('6')) unitBasePrice = 115;
      else if (c.spec.includes('UTP') || c.spec.includes('FTP')) unitBasePrice = 22;

      const finalPrice = Math.round(unitBasePrice * markupRate);
      roughItems.push({
        id: `rough-c-${rIdx++}`,
        section: 'rough_materials',
        name: `Кабель силовий негорючий ${c.spec} (ГОСТ/ДСТУ)`,
        unit: 'м',
        quantity: c.finalLength,
        baseUnitPrice: unitBasePrice,
        unitPrice: finalPrice,
        totalPrice: c.finalLength * finalPrice
      });

      // Corrugated pipe / гофра
      const corrugationPrice = Math.round(12 * markupRate);
      roughItems.push({
        id: `rough-g-${rIdx++}`,
        section: 'rough_materials',
        name: `Труба гофрована ПВХ/ПНД Ø20 з протяжкою (самозатухаюча)`,
        unit: 'м',
        quantity: c.finalLength,
        baseUnitPrice: 12,
        unitPrice: corrugationPrice,
        totalPrice: c.finalLength * corrugationPrice
      });
    });

    const totalBackBoxes = elementCounts.sockets + elementCounts.switches + elementCounts.lowCurrent;
    if (totalBackBoxes > 0) {
      const pboxPrice = Math.round(25 * markupRate);
      roughItems.push({
        id: `rough-pb-${rIdx++}`,
        section: 'rough_materials',
        name: 'Коробка установча підрозетник поглиблена (Schneider/Kopos)',
        unit: 'шт',
        quantity: totalBackBoxes,
        baseUnitPrice: 25,
        unitPrice: pboxPrice,
        totalPrice: totalBackBoxes * pboxPrice
      });
    }

    if (elementCounts.junctionBoxes > 0) {
      const jboxPrice = Math.round(65 * markupRate);
      roughItems.push({
        id: `rough-jb-${rIdx++}`,
        section: 'rough_materials',
        name: 'Коробка розподільча герметична IP44 / монтажні клемники WAGO 221',
        unit: 'компл',
        quantity: elementCounts.junctionBoxes,
        baseUnitPrice: 65,
        unitPrice: jboxPrice,
        totalPrice: elementCounts.junctionBoxes * jboxPrice
      });
    }

    // Кріплення, кліпси, гіпс, дюбель-ялинка
    const consumablesPrice = Math.round(1200 * markupRate);
    roughItems.push({
      id: `rough-cons-${rIdx++}`,
      section: 'rough_materials',
      name: 'Витратні матеріали (дюбель-ялинка, кліпси, алебастр, бури, ізострічка)',
      unit: 'компл',
      quantity: 1,
      baseUnitPrice: 1200,
      unitPrice: consumablesPrice,
      totalPrice: consumablesPrice
    });

    // --- РОЗДІЛ 2: Чистова фурнітура ---
    const finishItems: QuotationLineItem[] = [];
    let fIdx = 1;

    if (elementCounts.sockets > 0) {
      finishItems.push({
        id: `finish-s-${fIdx++}`,
        section: 'finish_materials',
        name: 'Розетка із заземлюючим контактом 16A 230V з шторками',
        unit: 'шт',
        quantity: elementCounts.sockets,
        baseUnitPrice: 165,
        unitPrice: 165,
        totalPrice: elementCounts.sockets * 165
      });
    }

    if (elementCounts.switches > 0) {
      finishItems.push({
        id: `finish-sw-${fIdx++}`,
        section: 'finish_materials',
        name: 'Вимикач 1/2-клавішний або прохідний (серія Sedna / Unica / Asfora)',
        unit: 'шт',
        quantity: elementCounts.switches,
        baseUnitPrice: 180,
        unitPrice: 180,
        totalPrice: elementCounts.switches * 180
      });
    }

    if (elementCounts.lowCurrent > 0) {
      finishItems.push({
        id: `finish-lc-${fIdx++}`,
        section: 'finish_materials',
        name: 'Розетка інформаційна RJ-45 Cat.6 / TV супутникова',
        unit: 'шт',
        quantity: elementCounts.lowCurrent,
        baseUnitPrice: 240,
        unitPrice: 240,
        totalPrice: elementCounts.lowCurrent * 240
      });
    }

    // Рамки декоративні (орієнтовно 70% від суми точок)
    const framesCount = Math.ceil((elementCounts.sockets + elementCounts.switches) * 0.7);
    if (framesCount > 0) {
      finishItems.push({
        id: `finish-fr-${fIdx++}`,
        section: 'finish_materials',
        name: 'Рамки декоративні 1-2-3-4-кратні для розеток і вимикачів',
        unit: 'шт',
        quantity: framesCount,
        baseUnitPrice: 95,
        unitPrice: 95,
        totalPrice: framesCount * 95
      });
    }

    // --- РОЗДІЛ 3: Модульне захисне обладнання та щити ---
    const modularItems: QuotationLineItem[] = [];
    let mIdx = 1;

    // Щит вбудований / навісний (по всіх поверхах)
    const panelModules = Math.max(panelUnitsCount.totalModules, 18);
    const panelBoxPrice = panelModules <= 24 ? 1450 : 2650;
    const panelsCount = Math.max(1, elementCounts.panels);
    modularItems.push({
      id: `mod-box-${mIdx++}`,
      section: 'modular_gear',
      name: `Щит розподільчий внутрішній металопластиковий на ${panelModules} мод. (Hager / Schneider)`,
      unit: 'шт',
      quantity: panelsCount,
      baseUnitPrice: panelBoxPrice,
      unitPrice: panelBoxPrice,
      totalPrice: panelBoxPrice * panelsCount
    });

    // Ввідний автомат
    modularItems.push({
      id: `mod-main-${mIdx++}`,
      section: 'modular_gear',
      name: 'Автоматичний вимикач ввідний 2P/3P 40A/50A 6kA (Крива C)',
      unit: 'шт',
      quantity: 1,
      baseUnitPrice: 420,
      unitPrice: 420,
      totalPrice: 420
    });

    // Реле напруги Зубр
    modularItems.push({
      id: `mod-relay-${mIdx++}`,
      section: 'modular_gear',
      name: 'Реле контролю напруги з термозахистом ZUBR D2-40/63A',
      unit: 'шт',
      quantity: 1,
      baseUnitPrice: 1850,
      unitPrice: 1850,
      totalPrice: 1850
    });

    // Групові автомати
    modularItems.push({
      id: `mod-ab-${mIdx++}`,
      section: 'modular_gear',
      name: 'Автоматичні вимикачі модульні 1P 10A/16A/20A 6kA (Крива B/C)',
      unit: 'шт',
      quantity: panelUnitsCount.breakers,
      baseUnitPrice: 195,
      unitPrice: 195,
      totalPrice: panelUnitsCount.breakers * 195
    });

    // ПЗВ / УЗО
    if (panelUnitsCount.rcds > 0) {
      modularItems.push({
        id: `mod-rcd-${mIdx++}`,
        section: 'modular_gear',
        name: 'Пристрій захисного відключення (ПЗВ) 2P 40A 30mA тип А',
        unit: 'шт',
        quantity: panelUnitsCount.rcds,
        baseUnitPrice: 1250,
        unitPrice: 1250,
        totalPrice: panelUnitsCount.rcds * 1250
      });
    }

    // Гребінка, шини N/PE, маркування
    modularItems.push({
      id: `mod-acc-${mIdx++}`,
      section: 'modular_gear',
      name: "З'єднувальні шини PIN (гребінка), клемні колодки N/PE, набір наліпок",
      unit: 'компл',
      quantity: 1,
      baseUnitPrice: 580,
      unitPrice: 580,
      totalPrice: 580
    });

    // --- РОЗДІЛ 4: Електромонтажні та пусконалагоджувальні роботи ---
    const laborItems: QuotationLineItem[] = [];
    let lIdx = 1;

    // Прокладання кабелю
    const totalMeters = cableTotals.reduce((acc, c) => acc + c.finalLength, 0);
    if (totalMeters > 0) {
      const cableWorkRate = Math.round(35 * difficultyRate);
      laborItems.push({
        id: `labor-c-${lIdx++}`,
        section: 'labor_works',
        name: 'Прокладання силового/слабкострумового кабелю в гофрі по стелі/підлозі',
        unit: 'м',
        quantity: totalMeters,
        baseUnitPrice: 35,
        unitPrice: cableWorkRate,
        totalPrice: totalMeters * cableWorkRate
      });
    }

    // Штроблення стін під кабель (орієнтовно 30% довжини трас це вертикальні штроби)
    const shtrobaMeters = Math.max(Math.ceil(totalBackBoxes * 1.5), 15);
    const shtrobaRate = Math.round(110 * difficultyRate);
    laborItems.push({
      id: `labor-sht-${lIdx++}`,
      section: 'labor_works',
      name: 'Штроблення стін безпиловим штроборізом із будівельним пилососом',
      unit: 'м.п.',
      quantity: shtrobaMeters,
      baseUnitPrice: 110,
      unitPrice: shtrobaRate,
      totalPrice: shtrobaMeters * shtrobaRate
    });

    // Висвердлювання отворів під підрозетники (алмазна коронка)
    if (totalBackBoxes > 0) {
      const holeRate = Math.round(130 * difficultyRate);
      laborItems.push({
        id: `labor-h-${lIdx++}`,
        section: 'labor_works',
        name: 'Висвердлювання посадкових місць та вмазування підрозетників',
        unit: 'шт',
        quantity: totalBackBoxes,
        baseUnitPrice: 130,
        unitPrice: holeRate,
        totalPrice: totalBackBoxes * holeRate
      });
    }

    // Монтаж та збирання щита
    const panelWorkRate = Math.round(panelUnitsCount.totalModules * 140 * difficultyRate);
    laborItems.push({
      id: `labor-p-${lIdx++}`,
      section: 'labor_works',
      name: `Монтаж корпусу щита, комутація модульної автоматики (${panelUnitsCount.totalModules} мод.), маркування`,
      unit: 'компл',
      quantity: 1,
      baseUnitPrice: panelUnitsCount.totalModules * 140,
      unitPrice: panelWorkRate,
      totalPrice: panelWorkRate
    });

    // Монтаж чистової фурнітури (розетки, вимикачі)
    if (totalBackBoxes > 0) {
      const installRate = Math.round(65 * difficultyRate);
      laborItems.push({
        id: `labor-inst-${lIdx++}`,
        section: 'labor_works',
        name: 'Встановлення та підключення механізмів розеток і вимикачів, встановлення рамок',
        unit: 'шт',
        quantity: totalBackBoxes,
        baseUnitPrice: 65,
        unitPrice: installRate,
        totalPrice: totalBackBoxes * installRate
      });
    }

    // Монтаж світильників / люстр
    if (elementCounts.lights > 0) {
      const lightRate = Math.round(250 * difficultyRate);
      laborItems.push({
        id: `labor-l-${lIdx++}`,
        section: 'labor_works',
        name: 'Монтаж та підключення освітлювальних приладів (люстри, точкові світильники)',
        unit: 'шт',
        quantity: elementCounts.lights,
        baseUnitPrice: 250,
        unitPrice: lightRate,
        totalPrice: elementCounts.lights * lightRate
      });
    }

    // Пусконалагоджувальні роботи, продзвонка та тест ПЗВ
    laborItems.push({
      id: `labor-t-${lIdx++}`,
      section: 'labor_works',
      name: 'Комплексна перевірка кабельних ліній, вимірювання опору ізоляції та тестування спрацювання ПЗВ',
      unit: 'послуга',
      quantity: 1,
      baseUnitPrice: 1500,
      unitPrice: 1500,
      totalPrice: 1500
    });

    return {
      roughItems,
      finishItems,
      modularItems,
      laborItems
    };
  }, [cableTotals, elementCounts, panelUnitsCount, config]);

  // Section subtotals
  const sumRough = quotationSections.roughItems.reduce((acc, i) => acc + (i.totalPrice || 0), 0);
  const sumFinish = quotationSections.finishItems.reduce((acc, i) => acc + (i.totalPrice || 0), 0);
  const sumModular = quotationSections.modularItems.reduce((acc, i) => acc + (i.totalPrice || 0), 0);
  const sumLabor = quotationSections.laborItems.reduce((acc, i) => acc + (i.totalPrice || 0), 0);

  const totalMaterials = sumRough + sumFinish + sumModular;
  const subtotalBeforeDiscount = totalMaterials + sumLabor;

  // Discount
  const discountAmount = Math.round(subtotalBeforeDiscount * ((config.clientDiscountPercent || 0) / 100));
  const subtotalAfterDiscount = subtotalBeforeDiscount - discountAmount;

  // Tax
  const taxAmount = Math.round(subtotalAfterDiscount * ((config.taxPercent || 0) / 100));
  const grandTotal = subtotalAfterDiscount + taxAmount;

  // Validity Date
  const validUntilDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (config.validUntilDays || 14));
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [config.validUntilDays]);

  const currentDateStr = useMemo(() => {
    return new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, []);

  // Export to CSV
  const handleExportQuotationCsv = () => {
    const rows: string[] = [];
    rows.push('КОМЕРЦІЙНА ПРОПОЗИЦІЯ ТА КОШТОРИС');
    rows.push(`Підрядник;${contractor.companyName} (${contractor.contractorName})`);
    rows.push(`Телефон;${contractor.phone};IBAN;${contractor.iban}`);
    rows.push(`Замовник;${clientName};Об'єкт;${objectAddress}`);
    rows.push(`Дата складання;${currentDateStr};Дійсна до;${validUntilDateStr}`);
    rows.push('');
    rows.push('№;Найменування робіт або матеріалів;Од. вим.;К-сть;Ціна за од. (грн);Сума (грн)');

    let itemCounter = 1;
    const addSection = (title: string, items: QuotationLineItem[], subtotal: number) => {
      rows.push(`;--- ${title} ---;;;;`);
      items.forEach(it => {
        rows.push(`${itemCounter++};"${it.name}";${it.unit};${it.quantity};${it.unitPrice};${it.totalPrice}`);
      });
      rows.push(`;Разом по розділу "${title}";;;;${subtotal}`);
      rows.push('');
    };

    addSection('1. Чорнові електромонтажні матеріали', quotationSections.roughItems, sumRough);
    addSection('2. Чистова електрофурнітура', quotationSections.finishItems, sumFinish);
    addSection('3. Модульне захисне обладнання та щити', quotationSections.modularItems, sumModular);
    addSection('4. Електромонтажні та пусконалагоджувальні роботи', quotationSections.laborItems, sumLabor);

    rows.push(`;Разом матеріали (Розділи 1+2+3);;;;${totalMaterials}`);
    rows.push(`;Разом роботи (Розділ 4);;;;${sumLabor}`);
    if (config.clientDiscountPercent > 0) {
      rows.push(`;Знижка для замовника (${config.clientDiscountPercent}%);;;;-${discountAmount}`);
    }
    if (config.taxPercent && config.taxPercent > 0) {
      rows.push(`;Податок (${config.taxPercent}%);;;;+${taxAmount}`);
    }
    rows.push(`;ЗАГАЛЬНА СУМА КОШТОРИСУ ДО ОПЛАТИ;;;;${grandTotal} грн`);

    downloadCsvFile(`Kopiyka_Koshtorys_${project.title || 'ElectroPlan'}.csv`, rows.join('\r\n'));
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportQuotationToPdf({
        project,
        contractor,
        clientName,
        objectAddress,
        quotationNumber: `КП-${Math.floor(Date.now() / 100000).toString().slice(-4)}`,
        currentDateStr,
        validUntilDateStr,
        sections: quotationSections,
        totals: {
          sumRough,
          sumFinish,
          sumModular,
          sumLabor,
          totalMaterials,
          discountPercent: config.clientDiscountPercent || 0,
          discountAmount,
          taxPercent: config.taxPercent || 0,
          taxAmount,
          grandTotal,
        },
        notes: config.notes || '',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-hidden">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-100">
                  Комерційна пропозиція та кошторис
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-950 border border-sky-800 text-sky-300">
                  Client Quotation Builder
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Автоматичний розрахунок вартості матеріалів і монтажу за кресленням ({aggregated.allWires.length} ліній, {aggregated.allElements.length} приладів{aggregated.syncedFloors.length > 1 ? `, ${aggregated.syncedFloors.length} поверхів` : ''})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="bg-neutral-800/80 p-0.5 rounded-lg flex items-center text-xs">
              <button
                onClick={() => setActiveTab('quotation')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'quotation'
                    ? 'bg-neutral-700 text-neutral-100 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Документ КП
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-neutral-700 text-neutral-100 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Реквізити та націнки
              </button>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-neutral-950 rounded-lg text-xs font-bold transition-colors"
              title="Завантажити комерційну пропозицію у форматі А4 .PDF"
            >
              {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isExportingPdf ? 'Формування PDF...' : 'Завантажити .PDF'}</span>
            </button>

            <button
              onClick={handleExportQuotationCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 rounded-lg text-xs font-medium transition-colors"
              title="Експорт кошторису в Excel / CSV з формулами та розділами"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Експорт .csv</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {activeTab === 'settings' ? (
            /* TAB 2: Contractor & Quotation Settings */
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Profile Card */}
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-sky-400" />
                    <h3 className="text-sm font-semibold text-neutral-200">
                      Реквізити підрядника / компанії (ФОП)
                    </h3>
                  </div>
                  {isSavedNotice && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Збережено!
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-neutral-400 mb-1 block">Назва компанії / ФОП</label>
                    <input
                      type="text"
                      value={contractor.companyName}
                      onChange={e => setContractor({ ...contractor, companyName: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-neutral-400 mb-1 block">Контактна особа (ПІБ)</label>
                    <input
                      type="text"
                      value={contractor.contractorName}
                      onChange={e => setContractor({ ...contractor, contractorName: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-neutral-400 mb-1 block">ЄДРПОУ / ІПН</label>
                    <input
                      type="text"
                      value={contractor.taxId || ''}
                      onChange={e => setContractor({ ...contractor, taxId: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-neutral-400 mb-1 block">Телефон</label>
                    <input
                      type="text"
                      value={contractor.phone || ''}
                      onChange={e => setContractor({ ...contractor, phone: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-neutral-400 mb-1 block">Email</label>
                    <input
                      type="email"
                      value={contractor.email || ''}
                      onChange={e => setContractor({ ...contractor, email: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-neutral-400 mb-1 block">Банківський рахунок (IBAN)</label>
                    <input
                      type="text"
                      value={contractor.iban || ''}
                      onChange={e => setContractor({ ...contractor, iban: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-neutral-400 mb-1 block">Юридична адреса / офіс</label>
                    <input
                      type="text"
                      value={contractor.address || ''}
                      onChange={e => setContractor({ ...contractor, address: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-neutral-400 mb-1 block">Логотип компанії (зображення)</label>
                    <div className="flex items-center gap-3">
                      {contractor.logoUrl ? (
                        <div className="w-12 h-12 rounded border border-neutral-700 overflow-hidden bg-white p-1">
                          <img src={contractor.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded border border-neutral-800 bg-neutral-900 flex items-center justify-center text-neutral-600 text-[10px]">
                          Немає
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="text-xs text-neutral-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-700 cursor-pointer"
                      />
                      {contractor.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setContractor(prev => ({ ...prev, logoUrl: '' }))}
                          className="text-red-400 hover:text-red-300 text-xs underline"
                        >
                          Видалити
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Multipliers & Taxes Card */}
              <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                  <Percent className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-neutral-200">
                    Коефіцієнти розрахунку вартості та податки
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-neutral-400 mb-1 block">Націнка на матеріали (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config.materialMarkupPercent}
                      onChange={e => setConfig({ ...config, materialMarkupPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-[10px] text-neutral-500 mt-1 block">
                      Враховує доставку, розвантаження та логістику (за замовчуванням 15%)
                    </span>
                  </div>

                  <div>
                    <label className="text-neutral-400 mb-1 block">Знижка клієнту (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={config.clientDiscountPercent}
                      onChange={e => setConfig({ ...config, clientDiscountPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-[10px] text-neutral-500 mt-1 block">
                      Програма лояльності або акційна знижка
                    </span>
                  </div>

                  <div>
                    <label className="text-neutral-400 mb-1 block">Ставка податку (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={config.taxPercent}
                      onChange={e => setConfig({ ...config, taxPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-[10px] text-neutral-500 mt-1 block">
                      5% (Єдиний податок ФОП 3 група) або 20% (ПДВ)
                    </span>
                  </div>

                  <div>
                    <label className="text-neutral-400 mb-1 block">Складність робіт (коефіцієнт)</label>
                    <select
                      value={config.difficultyMultiplier}
                      onChange={e => setConfig({ ...config, difficultyMultiplier: parseFloat(e.target.value) || 1.0 })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value={1.0}>1.00 — Гіпсокартон / газобетон (стандарт)</option>
                      <option value={1.15}>1.15 — Цегла / моноліт (середня)</option>
                      <option value={1.35}>1.35 — Армований залізобетон високої міцності</option>
                    </select>
                    <span className="text-[10px] text-neutral-500 mt-1 block">
                      Коригує трудомісткість штроблення та алмазного буріння
                    </span>
                  </div>

                  <div>
                    <label className="text-neutral-400 mb-1 block">Термін дії пропозиції (днів)</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={config.validUntilDays}
                      onChange={e => setConfig({ ...config, validUntilDays: parseInt(e.target.value) || 14 })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="text-neutral-400 mb-1 block text-xs">Гарантійні умови та примітки</label>
                  <textarea
                    rows={3}
                    value={config.notes || ''}
                    onChange={e => setConfig({ ...config, notes: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-sky-500 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Зберегти налаштування</span>
                </button>
              </div>
            </div>
          ) : (
            /* TAB 1: Quotation Document Preview (Printable) */
            <div className="bg-white text-neutral-900 rounded-xl p-6 md:p-10 shadow-lg border border-neutral-300 max-w-4xl mx-auto print:p-0 print:border-none print:shadow-none print:max-w-none">
              
              {/* Document Header */}
              <div className="border-b-2 border-neutral-900 pb-6 mb-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    {contractor.logoUrl && (
                      <img src={contractor.logoUrl} alt="Logo" className="h-12 w-auto mb-2 object-contain" />
                    )}
                    <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-neutral-900">
                      КОМЕРЦІЙНА ПРОПОЗИЦІЯ ТА КОШТОРИС
                    </h1>
                    <p className="text-xs text-neutral-600 font-medium">
                      Комплексний монтаж системи електропостачання та автоматики
                    </p>
                  </div>

                  <div className="text-right text-xs space-y-1">
                    <div className="inline-block px-2.5 py-1 bg-neutral-100 border border-neutral-300 rounded font-mono font-bold text-neutral-800">
                      № КП-{Math.floor(Date.now() / 100000).toString().slice(-4)}
                    </div>
                    <div className="text-neutral-500">
                      Дата: <span className="font-semibold text-neutral-800">{currentDateStr}</span>
                    </div>
                    <div className="text-neutral-500">
                      Дійсна до: <span className="font-semibold text-neutral-800">{validUntilDateStr}</span>
                    </div>
                  </div>
                </div>

                {/* Parties Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-neutral-200 text-xs">
                  <div className="space-y-1.5 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                    <div className="font-bold uppercase tracking-wider text-neutral-500 text-[10px] flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-neutral-700" />
                      Виконавець / Підрядник
                    </div>
                    <div className="font-bold text-sm text-neutral-900">{contractor.companyName}</div>
                    <div className="text-neutral-700">Відповідальний: {contractor.contractorName}</div>
                    {contractor.taxId && <div className="text-neutral-600">ЄДРПОУ/ІПН: {contractor.taxId}</div>}
                    <div className="text-neutral-600">Тел: {contractor.phone} | {contractor.email}</div>
                    {contractor.iban && <div className="font-mono text-[11px] text-neutral-800">IBAN: {contractor.iban}</div>}
                  </div>

                  <div className="space-y-1.5 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                    <div className="font-bold uppercase tracking-wider text-neutral-500 text-[10px] flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-neutral-700" />
                      Замовник та об'єкт
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500 w-16">Клієнт:</span>
                      <input
                        type="text"
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        placeholder="ПІБ Замовника"
                        className="font-bold text-sm text-neutral-900 bg-transparent border-b border-neutral-300 focus:border-sky-600 focus:outline-none flex-1 py-0.5"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500 w-16">Адреса:</span>
                      <input
                        type="text"
                        value={objectAddress}
                        onChange={e => setObjectAddress(e.target.value)}
                        placeholder="Адреса об'єкта"
                        className="text-neutral-800 bg-transparent border-b border-neutral-300 focus:border-sky-600 focus:outline-none flex-1 py-0.5"
                      />
                    </div>
                    <div className="text-neutral-600 pt-1 text-[11px]">
                      Проєкт: <span className="font-semibold text-neutral-800">{project.title || 'ElectroPlan'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Tables */}
              <div className="space-y-6 text-xs">
                
                {/* 1. Rough Materials */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-neutral-100 px-3 py-1.5 rounded font-bold text-neutral-800 border-l-4 border-amber-600">
                    <span>1. ЧОРНОВІ ЕЛЕКТРОМОНТАЖНІ МАТЕРІАЛИ</span>
                    <span>{sumRough.toLocaleString()} грн</span>
                  </div>
                  <table className="w-full text-left border-collapse border border-neutral-200">
                    <thead className="bg-neutral-50 text-[11px] text-neutral-600 font-medium">
                      <tr>
                        <th className="py-1.5 px-2 border border-neutral-200 w-8 text-center">№</th>
                        <th className="py-1.5 px-2 border border-neutral-200">Найменування матеріалу</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-16 text-center">Од.</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-16 text-center">К-сть</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-24 text-right">Ціна (грн)</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-24 text-right">Сума (грн)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationSections.roughItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-neutral-50/50">
                          <td className="py-1 px-2 border border-neutral-200 text-center text-neutral-500">{idx + 1}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-neutral-900">{item.name}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-center text-neutral-600">{item.unit}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-center font-medium">{item.quantity}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-right text-neutral-600">{item.unitPrice}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-right font-semibold text-neutral-900">
                            {(item.totalPrice || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 2. Finish Materials */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-neutral-100 px-3 py-1.5 rounded font-bold text-neutral-800 border-l-4 border-blue-600">
                    <span>2. ЧИСТОВА ЕЛЕКТРОФУРНІТУРА (РОЗЕТКИ, ВИМИКАЧІ, РАМКИ)</span>
                    <span>{sumFinish.toLocaleString()} грн</span>
                  </div>
                  <table className="w-full text-left border-collapse border border-neutral-200">
                    <thead className="bg-neutral-50 text-[11px] text-neutral-600 font-medium">
                      <tr>
                        <th className="py-1.5 px-2 border border-neutral-200 w-8 text-center">№</th>
                        <th className="py-1.5 px-2 border border-neutral-200">Найменування фурнітури</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-16 text-center">Од.</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-16 text-center">К-сть</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-24 text-right">Ціна (грн)</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-24 text-right">Сума (грн)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationSections.finishItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-neutral-50/50">
                          <td className="py-1 px-2 border border-neutral-200 text-center text-neutral-500">{idx + 1}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-neutral-900">{item.name}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-center text-neutral-600">{item.unit}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-center font-medium">{item.quantity}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-right text-neutral-600">{item.unitPrice}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-right font-semibold text-neutral-900">
                            {(item.totalPrice || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 3. Modular Gear */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-neutral-100 px-3 py-1.5 rounded font-bold text-neutral-800 border-l-4 border-emerald-600">
                    <span>3. МОДУЛЬНЕ ЗАХИСНЕ ОБЛАДНАННЯ ТА ЩИТИ</span>
                    <span>{sumModular.toLocaleString()} грн</span>
                  </div>
                  <table className="w-full text-left border-collapse border border-neutral-200">
                    <thead className="bg-neutral-50 text-[11px] text-neutral-600 font-medium">
                      <tr>
                        <th className="py-1.5 px-2 border border-neutral-200 w-8 text-center">№</th>
                        <th className="py-1.5 px-2 border border-neutral-200">Найменування апаратів захисту</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-16 text-center">Од.</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-16 text-center">К-сть</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-24 text-right">Ціна (грн)</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-24 text-right">Сума (грн)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationSections.modularItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-neutral-50/50">
                          <td className="py-1 px-2 border border-neutral-200 text-center text-neutral-500">{idx + 1}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-neutral-900">{item.name}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-center text-neutral-600">{item.unit}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-center font-medium">{item.quantity}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-right text-neutral-600">{item.unitPrice}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-right font-semibold text-neutral-900">
                            {(item.totalPrice || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 4. Labor Works */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-neutral-100 px-3 py-1.5 rounded font-bold text-neutral-800 border-l-4 border-sky-600">
                    <span>4. ЕЛЕКТРОМОНТАЖНІ ТА ПУСКОНАЛАГОДЖУВАЛЬНІ РОБОТИ</span>
                    <span>{sumLabor.toLocaleString()} грн</span>
                  </div>
                  <table className="w-full text-left border-collapse border border-neutral-200">
                    <thead className="bg-neutral-50 text-[11px] text-neutral-600 font-medium">
                      <tr>
                        <th className="py-1.5 px-2 border border-neutral-200 w-8 text-center">№</th>
                        <th className="py-1.5 px-2 border border-neutral-200">Вид електромонтажних робіт</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-16 text-center">Од.</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-16 text-center">Обсяг</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-24 text-right">Тариф (грн)</th>
                        <th className="py-1.5 px-2 border border-neutral-200 w-24 text-right">Вартість (грн)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationSections.laborItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-neutral-50/50">
                          <td className="py-1 px-2 border border-neutral-200 text-center text-neutral-500">{idx + 1}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-neutral-900">{item.name}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-center text-neutral-600">{item.unit}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-center font-medium">{item.quantity}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-right text-neutral-600">{item.unitPrice}</td>
                          <td className="py-1 px-2 border border-neutral-200 text-right font-semibold text-neutral-900">
                            {(item.totalPrice || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Quotation Summary Totals */}
              <div className="mt-8 border-t-2 border-neutral-900 pt-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 text-xs">
                <div className="space-y-2 max-w-md">
                  <div className="font-bold text-neutral-800 uppercase tracking-wider text-[11px]">
                    Примітки та гарантійні зобов'язання:
                  </div>
                  <p className="text-neutral-600 text-[11px] leading-relaxed">
                    {config.notes}
                  </p>
                </div>

                <div className="w-full md:w-80 space-y-1.5 bg-neutral-50 p-4 rounded-xl border border-neutral-300">
                  <div className="flex justify-between text-neutral-600">
                    <span>Разом матеріали (1+2+3):</span>
                    <span className="font-semibold text-neutral-900">{totalMaterials.toLocaleString()} грн</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Разом монтажні роботи (4):</span>
                    <span className="font-semibold text-neutral-900">{sumLabor.toLocaleString()} грн</span>
                  </div>
                  {config.clientDiscountPercent > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Знижка ({config.clientDiscountPercent}%):</span>
                      <span>-{discountAmount.toLocaleString()} грн</span>
                    </div>
                  )}
                  {config.taxPercent !== undefined && config.taxPercent > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>Податок ({config.taxPercent}%):</span>
                      <span>+{taxAmount.toLocaleString()} грн</span>
                    </div>
                  )}
                  <div className="border-t border-neutral-300 pt-2 flex justify-between text-sm md:text-base font-black text-neutral-900">
                    <span>ДО СПЛАТИ:</span>
                    <span className="text-sky-700">{grandTotal.toLocaleString()} грн</span>
                  </div>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="mt-12 pt-8 border-t border-neutral-300 grid grid-cols-2 gap-12 text-xs">
                <div>
                  <div className="font-bold text-neutral-800 mb-8">Підрядник:</div>
                  <div className="border-b border-neutral-800 pb-1 flex justify-between text-neutral-500">
                    <span>/ {contractor.contractorName} /</span>
                    <span>(підпис, печатка)</span>
                  </div>
                </div>
                <div>
                  <div className="font-bold text-neutral-800 mb-8">Замовник:</div>
                  <div className="border-b border-neutral-800 pb-1 flex justify-between text-neutral-500">
                    <span>/ {clientName || '_______________'} /</span>
                    <span>(підпис)</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between shrink-0">
          <div className="text-xs text-neutral-400">
            Загальний кошторис: <span className="font-bold text-amber-400">{grandTotal.toLocaleString()} грн</span> (Матеріали: {totalMaterials.toLocaleString()} грн | Роботи: {sumLabor.toLocaleString()} грн)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Закрити
          </button>
        </div>

      </div>
    </div>
  );
};
