/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Офіційний реєстр нормативних правил проектування електромереж (§12 ТЗ)
 * за ПУЕ України (вид. 2017), ДБН В.2.5-23:2010 та ДСТУ Б В.2.5-82:2016.
 */

import { CadProject, AuditIssue, ElectricalElement, CircuitGroup, WireRoute } from '../types/cad';
import { isPointInPolygon } from './roomGeometry';
import {
  CABLE_SPECS,
  analyzeCircuit,
  autoBalancePhases,
  calculateProjectElectricalSummary,
} from './electricalCalculations';
import { getAggregatedProjectData } from './projectAggregator';
import { distance, pxToMm, checkChaseIntersectsOpening } from './cadMath';

export interface NormativeRuleDefinition {
  code: string; // e.g. "ПУЕ-2017:7.1.48"
  source: 'ПУЕ-2017' | 'ДБН В.2.5-23:2010' | 'ДСТУ Б В.2.5-82:2016';
  clause: string;
  nameUk: string;
  category: 'safety' | 'cable_sizing' | 'overload' | 'automation' | 'geometry';
  severity: 'error' | 'warning' | 'info';
  description: string;
}

export const NORMATIVE_RULES_REGISTRY: NormativeRuleDefinition[] = [
  {
    code: 'PUE_7_1_48',
    source: 'ПУЕ-2017',
    clause: 'п. 7.1.48, ДБН В.2.5-23:2010 п. 4.35',
    nameUk: 'Захист розеток у вологих зонах (санвузол)',
    category: 'safety',
    severity: 'error',
    description: 'У ванних кімнатах та санвузлах дозволено встановлення тільки розеток зі ступенем захисту не нижче IP44 із захисними шторками.',
  },
  {
    code: 'PUE_7_1_82',
    source: 'ПУЕ-2017',
    clause: 'п. 7.1.82, ДСТУ Б В.2.5-82:2016 п. 4.1',
    nameUk: 'Диференційний захист (ПЗВ) вологих приміщень',
    category: 'safety',
    severity: 'error',
    description: 'Для кіл ванних кімнат обов’язкове застосування ПЗВ зі струмом витоку IΔn ≤ 10-30 мА.',
  },
  {
    code: 'PUE_7_1_72',
    source: 'ПУЕ-2017',
    clause: 'п. 7.1.72',
    nameUk: 'Обов’язковий дифзахист побутових розеток',
    category: 'safety',
    severity: 'warning',
    description: 'Всі загальні штепсельні розетки на струм до 32 А у житлових будинках повинні захищатися ПЗВ з IΔn ≤ 30 мА.',
  },
  {
    code: 'PUE_1_3_4',
    source: 'ПУЕ-2017',
    clause: 'Табл. 1.3.4, п. 3.1.9',
    nameUk: 'Координація «автомат ↔ кабель» (In ≤ Idd)',
    category: 'cable_sizing',
    severity: 'error',
    description: 'Номінальний струм автомата In не повинен перевищувати допустимий тривалий струм кабелю Idd.',
  },
  {
    code: 'DBN_4_28',
    source: 'ДБН В.2.5-23:2010',
    clause: 'п. 4.28, ПУЕ Табл. 1.3.4',
    nameUk: 'Підключення варильної поверхні / плити (32А / 6мм²)',
    category: 'cable_sizing',
    severity: 'error',
    description: 'Однофазне підключення індукційної або електричної варильної поверхні 7-8 кВт вимагає автомата 32 А та кабелю ВВГнгд 3х6 мм².',
  },
  {
    code: 'PUE_6_1_14',
    source: 'ПУЕ-2017',
    clause: 'п. 6.1.14',
    nameUk: 'Захист кіл освітлення (макс. 16А, рекоменд. 10А)',
    category: 'safety',
    severity: 'warning',
    description: 'Лінії освітлення повинні захищатися автоматичними вимикачами з номіналом не більше 16 А (стандартно 10 А) з мідним кабелем перерізом не менше 1.5 мм².',
  },
  {
    code: 'PUE_3_1_9',
    source: 'ПУЕ-2017',
    clause: 'п. 3.1.9, ДБН В.2.5-23:2010',
    nameUk: 'Захист лінії від перевантаження (Ib ≤ In)',
    category: 'overload',
    severity: 'error',
    description: 'Розрахунковий струм навантаження лінії Ib не повинен перевищувати номінальний струм автоматичного вимикача In.',
  },
  {
    code: 'DBN_2_18',
    source: 'ДБН В.2.5-23:2010',
    clause: 'п. 2.18, ДСТУ Б В.2.5-82:2016',
    nameUk: 'Допустиме падіння напруги в кабелі (ΔU ≤ 4%)',
    category: 'cable_sizing',
    severity: 'warning',
    description: 'Падіння напруги в лінії від ввідно-розподільчого щита до найбільш віддаленого електроприймача не повинно перевищувати 4%.',
  },
  {
    code: 'DBN_3_18',
    source: 'ДБН В.2.5-23:2010',
    clause: 'п. 3.18',
    nameUk: 'Прив’язка світильників до вимикачів',
    category: 'automation',
    severity: 'warning',
    description: 'Кожен світильник повинен мати комутаційну лінію або маркування групи вимикача (S1, S2 тощо).',
  },
  {
    code: 'DBN_3_1',
    source: 'ДБН В.2.5-23:2010',
    clause: 'п. 3.1',
    nameUk: 'Номінал ввідного автоматичного вимикача',
    category: 'overload',
    severity: 'error',
    description: 'Розрахунковий сумарний струм об’єкта з урахуванням коефіцієнта попиту не повинен перевищувати номінал ввідного автомата.',
  },
  {
    code: 'DBN_3_7',
    source: 'ДБН В.2.5-23:2010',
    clause: 'п. 3.7',
    nameUk: 'Нерівномірність завантаження фаз (≤ 15%)',
    category: 'overload',
    severity: 'warning',
    description: 'У трифазних мережах різниця навантаження між найбільш і найменш завантаженою фазами не повинна перевищувати 15%.',
  },
  {
    code: 'PUE_7_1_47',
    source: 'ПУЕ-2017',
    clause: 'п. 7.1.47',
    nameUk: 'Захисні зони ванної кімнати (Зона 0 та Зона 1)',
    category: 'geometry',
    severity: 'error',
    description: 'Розетки та вимикачі заборонено розташовувати безпосередньо в зоні 0 (ванна/піддон) та зоні 1 (над ванною до висоти 2.25 м).',
  },
  {
    code: 'PUE_2_1_52',
    source: 'ПУЕ-2017',
    clause: 'п. 2.1.52, ДБН В.2.5-23:2010',
    nameUk: 'Заборона штроблення через дверні та віконні отвори',
    category: 'geometry',
    severity: 'error',
    description: 'Штроблення (прокладання у стіні) заборонено крізь дверні та віконні отвори. Траса повинна проходити по стелі у гофрі або в стяжці підлоги.',
  },
  {
    code: 'PUE_7_1_50',
    source: 'ПУЕ-2017',
    clause: 'п. 7.1.50, ДБН В.2.5-23:2010',
    nameUk: 'Розділення розеточних кіл та освітлення (заборона шлейфу через вимикачі)',
    category: 'safety',
    severity: 'error',
    description: 'Розеточні лінії (16А, 2.5 мм²) та лінії освітлення (10А, 1.5 мм²) повинні живитися від окремих апаратів захисту. Заборонено підключати розетки до вимикачів освітлення або пропускати силовий розеточний струм через ланцюг вимикача.',
  },
  {
    code: 'PUE_1_7_79',
    source: 'ПУЕ-2017',
    clause: 'п. 1.7.79',
    nameUk: 'Чутливість захисту при однофазному КЗ (Ikz ≥ 1.1·Iinst, t ≤ 0.4 с)',
    category: 'safety',
    severity: 'warning',
    description: 'Струм однофазного КЗ повинен перевищувати струм миттєвого спрацювання розчіплювача щонайменше в 1.1 раза для гарантованого автоматичного відключення за час не більше 0.4 с.',
  },
  {
    code: 'KNX_BUS_TOPOLOGY',
    source: 'ДСТУ Б В.2.5-82:2016',
    clause: 'KNX Standard ISO/IEC 14543-3',
    nameUk: 'Топологія шини автоматизації KNX (заборона замкнених кілець)',
    category: 'automation',
    severity: 'error',
    description: 'У шині автоматизації KNX (кабель JY(St)Y 2x2x0.8) дозволені топології лінія, дерево та зірка. Утворення замкнених петель (кілець) суворо заборонено через колізії телеграм зв’язку.',
  },
];

/**
 * Повний аудит проекту за всіма 12 критеріями
 */
export function runPueAudit(project: CadProject): {
  issues: AuditIssue[];
  checkedRulesCount: number;
  errorCount: number;
  warningCount: number;
} {
  const issues: AuditIssue[] = [];
  const agg = getAggregatedProjectData(project);
  const multiFloor = agg.syncedFloors.length > 1;
  const grounding = project.groundingSystem || 'TN-C-S';

  // Floor-scoped spatial geometry checks (Bathrooms, Wet Zones, Wall Chases, Orphaned Lights, Switch/Socket connections)
  agg.syncedFloors.forEach((floor) => {
    const floorPrefix = multiFloor ? `[${floor.name}] ` : '';
    const floorRooms = floor.rooms || [];
    const floorElements = floor.elements || [];
    const floorWires = floor.wires || [];
    const floorFurniture = floor.furniture || [];
    const floorWalls = floor.walls || [];
    const floorOpenings = floor.openings || [];

    const bathroomRooms = floorRooms.filter((r) => r.type === 'bathroom');

    // Rule 1 & 2: Bathrooms IP rating and RCD (True Point-in-Polygon check)
    floorElements.forEach((el) => {
      if (el.category === 'socket') {
        const inBath = bathroomRooms.some((room) => isPointInPolygon(el.position, room.points));

        if (inBath) {
          if (el.ipRating !== 'IP44' && el.ipRating !== 'IP65') {
            issues.push({
              id: `fix_ip_${el.id}`,
              severity: 'error',
              title: `[ПУЕ 7.1.48] ${floorPrefix}Розетка без IP44 у ванній: «${el.name}»`,
              description: `Розетка розташована у межах полігону санвузла, проте має ступінь захисту ${el.ipRating}. Потрібно встановити вологозахищену розетку IP44 з кришкою.`,
              elementId: el.id,
              autoFixAvailable: true,
            });
          }

          const circuit = project.circuits.find((c) => c.id === el.circuitId);
          if (circuit && circuit.rcdType === 'none') {
            if (!issues.some((i) => i.id === `fix_rcd_bath_${circuit.id}`)) {
              issues.push({
                id: `fix_rcd_bath_${circuit.id}`,
                severity: 'error',
                title: `[ПУЕ 7.1.82] ${floorPrefix}Лінія санвузла «${circuit.name}» без ПЗВ`,
                description: 'Кола ванних кімнат вимагають обов’язкового диференційного захисту IΔn ≤ 10-30 мА для захисту людини від ураження струмом.',
                circuitId: circuit.id,
                autoFixAvailable: true,
              });
            }
          }
        }
      }
    });

    // Rule 9: Orphaned luminaires (no switch or switch group on floor)
    const switches = floorElements.filter((e) => e.category === 'switch');
    const switchGroups = new Set(switches.map((s) => s.switchGroupId).filter(Boolean));
    const wiredTargetIds = new Set(floorWires.map((w) => w.toId));

    floorElements.forEach((el) => {
      if (el.category === 'light') {
        const hasSwitchGroup = el.switchGroupId && switchGroups.has(el.switchGroupId);
        const hasWire = wiredTargetIds.has(el.id);

        if (!hasSwitchGroup && !hasWire) {
          issues.push({
            id: `fix_orphan_light_${el.id}`,
            severity: 'warning',
            title: `[ДБН 3.18] ${floorPrefix}Світильник без прив’язки до вимикача: «${el.name}»`,
            description: 'У світильника не призначено групу вмикання (S1, S2 тощо) і відсутня сполучна лінія до вимикача.',
            elementId: el.id,
            autoFixAvailable: true,
          });
        }
      }
    });

    // Rule 12: Zone 0 & Zone 1 bathtub proximity check
    const wetSanitaryItems = floorFurniture.filter((f) => f.type === 'bath' || f.type === 'shower');
    wetSanitaryItems.forEach((bath) => {
      floorElements.forEach((el) => {
        if (el.category === 'socket' || el.category === 'switch') {
          const distMm = pxToMm(distance(el.position, bath.position));
          if (distMm < 600) {
            issues.push({
              id: `fix_wet_zone_dist_${el.id}`,
              severity: 'error',
              title: `[ПУЕ 7.1.47] ${floorPrefix}Електроточка «${el.name}» у небезпечній Зоні 1 ванни (${distMm} мм < 600 мм)`,
              description: 'Встановлення розеток та вимикачів ближче ніж 600 мм від краю ванни або душового піддону суворо заборонено правилами безпеки.',
              elementId: el.id,
            });
          }
        }
      });
    });

    // 13. Штроблення через дверні або віконні отвори (ПУЕ 2.1.52, ДБН В.2.5-23:2010)
    if (floorOpenings.length > 0) {
      floorWires.forEach((wire) => {
        if (wire.conduit === 'wall_chase') {
          const fromEl = floorElements.find((e) => e.id === wire.fromId);
          const toEl = floorElements.find((e) => e.id === wire.toId);
          const pts = wire.points && wire.points.length >= 2
            ? wire.points
            : fromEl && toEl
            ? [fromEl.position, toEl.position]
            : [];

          if (pts.length >= 2) {
            const collision = checkChaseIntersectsOpening(pts, floorWalls, floorOpenings);
            if (collision.hasCollision) {
              const opType = collision.opening?.type === 'door' ? 'дверний' : 'віконний';
              issues.push({
                id: `fix_chase_opening_${wire.id}`,
                severity: 'error',
                title: `[ПУЕ 2.1.52] ${floorPrefix}Штроба через ${opType} отвір (${wire.cableTag || 'кабель'})`,
                description: `Кабельна лінія у штробі [${wire.cableTag || wire.id}] перетинає ${opType} отвір у стіні. За ДБН та ПУЕ §2.1.52 руйнування отворів заборонено. Рекомендується перевести трасу на стелю у гофротрубі.`,
                autoFixAvailable: true,
              });
            }
          }
        }
      });
    }

    // 14. Заборона з'єднання розеток та вимикачів (ПУЕ 7.1.50)
    floorWires.forEach((wire) => {
      const fromEl = floorElements.find((e) => e.id === wire.fromId);
      const toEl = floorElements.find((e) => e.id === wire.toId);
      if (fromEl && toEl) {
        const isSocketToSwitch =
          (fromEl.category === 'socket' && toEl.category === 'switch') ||
          (fromEl.category === 'switch' && toEl.category === 'socket');
        if (isSocketToSwitch) {
          issues.push({
            id: `fix_socket_switch_${wire.id}`,
            severity: 'error',
            title: `[ПУЕ 7.1.50] ${floorPrefix}Неприпустиме з'єднання розетки та вимикача (${wire.cableTag || wire.id})`,
            description: `Кабель з'єднує розетку «${fromEl.name}» та вимикач «${toEl.name}». За ПУЕ розеточні групи 16А (2.5мм²) та лінії освітлення 10А (1.5мм²) повинні бути суворо розділені.`,
            elementId: fromEl.id,
            autoFixAvailable: true,
          });
        }
      }
    });

    // Перевірка: чи не призначено вимикач на 16А силову лінію розеток
    floorElements.forEach((el) => {
      if (el.category === 'switch') {
        const c = project.circuits.find((item) => item.id === el.circuitId);
        if (c && (c.breakerRatingA >= 16 || c.cableType === 'VVGng_3x2.5')) {
          issues.push({
            id: `fix_switch_circuit_${el.id}`,
            severity: 'error',
            title: `[ПУЕ 7.1.50] ${floorPrefix}Вимикач «${el.name}» призначено на силову розеточну групу (${c.name}, ${c.breakerRatingA}А)`,
            description: `Вимикач освітлення призначено на розеточну групу ${c.breakerRatingA}А з кабелем ${c.cableType}. За ПУЕ комутаційні апарати освітлення мають захищатися автоматом 10А з кабелем 1.5мм².`,
            elementId: el.id,
            autoFixAvailable: true,
          });
        }
      }
    });

    // 15. Перевірка шини KNX на замкнені кільця
    const knxWires = floorWires.filter((w) => w.cableType === 'KNX_Bus' || w.busType === 'knx');
    if (knxWires.length >= 3) {
      const adj = new Map<string, string[]>();
      knxWires.forEach((w) => {
        if (!adj.has(w.fromId)) adj.set(w.fromId, []);
        if (!adj.has(w.toId)) adj.set(w.toId, []);
        adj.get(w.fromId)!.push(w.toId);
        adj.get(w.toId)!.push(w.fromId);
      });

      const visited = new Set<string>();
      let hasCycle = false;

      const dfs = (node: string, parent: string | null): boolean => {
        visited.add(node);
        const neighbors = adj.get(node) || [];
        for (const n of neighbors) {
          if (n === parent) continue;
          if (visited.has(n)) return true;
          if (dfs(n, node)) return true;
        }
        return false;
      };

      for (const node of adj.keys()) {
        if (!visited.has(node)) {
          if (dfs(node, null)) {
            hasCycle = true;
            break;
          }
        }
      }

      if (hasCycle) {
        issues.push({
          id: `fix_knx_loop_${floor.id}`,
          severity: 'error',
          title: `[KNX ISO 14543] ${floorPrefix}Виявлено замкнене кільце в шині автоматизації KNX`,
          description: 'У шині KNX категорично заборонено утворювати замкнені петлі/кільця. Дозволена виключно топологія дерево, лінія або зірка.',
        });
      }
    }
  });

  // Circuit-wide & multi-floor aggregated checks (Rules 3..8 + TT grounding)
  project.circuits.forEach((c) => {
    const analysis = analyzeCircuit(c, agg.allElements, agg.allWires, project.supplyPhase, grounding);
    const spec = CABLE_SPECS[c.cableType] || CABLE_SPECS['VVGng_3x2.5'];

    // Rule 3: Breaker rating vs effective derated cable ampacity (In <= Idd_eff)
    if (!analysis.isCableProtectedByBreaker) {
      issues.push({
        id: `fix_breaker_cable_${c.id}`,
        severity: 'error',
        title: `[ПУЕ 1.3.4] Автомат ${c.breakerRatingA}А перевищує допустимий струм кабелю ${analysis.cableAmpacityA}А (${c.cableType})`,
        description: `З урахуванням поправкових коефіцієнтів (K=${analysis.deratingFactorTotal}) допустимий струм кабелю становить ${analysis.cableAmpacityA}А. Знизьте номінал автомата або збільште переріз.`,
        circuitId: c.id,
        autoFixAvailable: true,
      });
    }

    // Rule 5: Lighting protection (max 16A, recommended 10A)
    const connected = analysis.connectedElements;
    const hasOnlyLights = connected.length > 0 && connected.every((e) => e.category === 'light');
    if (hasOnlyLights && c.breakerRatingA > 16) {
      issues.push({
        id: `fix_light_breaker_${c.id}`,
        severity: 'warning',
        title: `[ПУЕ 6.1.14] Завищений номінал автомата освітлення: ${c.breakerRatingA}А для «${c.name}»`,
        description: 'Для кіл освітлення з кабелем 1.5 мм² рекомендовано використовувати автомат B10A або C10A.',
        circuitId: c.id,
        autoFixAvailable: true,
      });
    }

    // Rule 6 & TT grounding RCD requirement
    if (analysis.isGroundingProtectionMissing) {
      issues.push({
        id: `fix_socket_rcd_${c.id}`,
        severity: 'error',
        title: `[ПУЕ 1.7.59] Система TT вимагає ПЗВ для лінії «${c.name}»`,
        description: 'У системі заземлення TT кожна відхідна лінія обов’язково повинна мати диференційний захист ≤ 30 мА (ПЗВ або дифавтомат).',
        circuitId: c.id,
        autoFixAvailable: true,
      });
    } else {
      const hasSockets = connected.some((e) => e.category === 'socket');
      if (hasSockets && c.rcdType === 'none') {
        issues.push({
          id: `fix_socket_rcd_${c.id}`,
          severity: 'warning',
          title: `[ПУЕ 7.1.72] Відсутній диференційний захист (ПЗВ) на групі розеток: «${c.name}»`,
          description: 'За нормами ПУЕ всі загальні розеткові групи житлових приміщень повинні мати захист ПЗВ 30 мА.',
          circuitId: c.id,
          autoFixAvailable: true,
        });
      }
    }

    // Rule 7 & 8: Overload current (Ib <= In) & Voltage drop (ΔU <= 4%)
    if (analysis.isBreakerOverloaded) {
      issues.push({
        id: `fix_overload_${c.id}`,
        severity: 'error',
        title: `[ПУЕ 3.1.9] Перевантаження лінії «${c.name}»: ${analysis.calculatedCurrentA}А > ${c.breakerRatingA}А (${(analysis.totalInstalledWatts / 1000).toFixed(2)} кВт)`,
        description: `Струм навантаження (${analysis.isThreePhaseLine ? '3Ф 400В' : '1Ф 230В'}) перевищує номінал автомата. Рекомендовано розподілити точки на дві окремі групи або знизити потужність.`,
        circuitId: c.id,
      });
    }

    if (analysis.isVoltageDropExceeded) {
      issues.push({
        id: `fix_vdrop_${c.id}`,
        severity: 'warning',
        title: `[ДБН 2.18] Падіння напруги ${analysis.voltageDrop.deltaPercent}% у лінії «${c.name}» перевищує норму 4%`,
        description: `При довжині траси ${analysis.totalCableLengthM} м падіння напруги становить ${analysis.voltageDrop.deltaVolts} В. Рекомендовано збільшити переріз кабелю до наступного номіналу.`,
        circuitId: c.id,
        autoFixAvailable: true,
      });
    }

    if (analysis.isShortCircuitTrippingUnsafe) {
      issues.push({
        id: `fix_ikz_curve_${c.id}`,
        severity: 'warning',
        title: `[ПУЕ 1.7.79] Чутливість захисту лінії «${c.name}» (Ikz = ${analysis.shortCircuit.ikzCurrentA} А < ${analysis.shortCircuit.requiredIkzA} А)`,
        description: `Струм КЗ наприкінці лінії (${analysis.shortCircuit.ikzCurrentA} А) менший за 1.1·Iinst автомата ${c.breakerCurve || 'C'}${c.breakerRatingA}А (${analysis.shortCircuit.requiredIkzA} А). ${analysis.shortCircuit.recommendation || ''}`,
        circuitId: c.id,
        autoFixAvailable: true,
      });
    }
  });

  // Rule 4: Cooker / Hob high-power sizing (across all floors)
  const cookerSockets = agg.allElements.filter(
    (e) => e.type === 'socket_cooker' || e.type === 'hob_induction'
  );
  cookerSockets.forEach((sk) => {
    const circuit = project.circuits.find((c) => c.id === sk.circuitId);
    if (circuit) {
      const is3PhLine = circuit.phase === '3P' || circuit.cableType.startsWith('VVGng_5x');
      if (!is3PhLine && circuit.breakerRatingA < 32 && project.supplyPhase !== '3-phase') {
        issues.push({
          id: `fix_cooker_breaker_${circuit.id}`,
          severity: 'error',
          title: `[ДБН 4.28] Занижений автомат варильної поверхні: ${circuit.breakerRatingA}А (потрібно 32А)`,
          description: `Для варильної поверхні 7-7.4 кВт (однофазне живлення) автомат повинен бути 32 А.`,
          circuitId: circuit.id,
          autoFixAvailable: true,
        });
      }
      if (!is3PhLine && circuit.cableType !== 'VVGng_3x6' && project.supplyPhase !== '3-phase') {
        issues.push({
          id: `fix_cooker_cable_${circuit.id}`,
          severity: 'error',
          title: `[ПУЕ 1.3.4] Недостатній переріз кабелю плити: ${circuit.cableType} (потрібно ВВГнгд 3х6)`,
          description: `Струм варильної поверхні досягає 31.3 А. Переріз 3х6 мм² (мідь) є обов’язковим згідно з ПУЕ.`,
          circuitId: circuit.id,
          autoFixAvailable: true,
        });
      }
    }
  });

  // Rule 10: Main breaker rating vs total design load (all floors)
  const summary = calculateProjectElectricalSummary(project);
  if (summary.isMainBreakerOverloaded) {
    issues.push({
      id: 'fix_main_breaker',
      severity: 'error',
      title: `[ДБН 3.1] Ввідний автомат ${project.mainBreakerRatingA}А перевантажений: розрахунковий струм ${summary.mainCurrentA}А`,
      description: `Розрахункова потужність об’єкта (${summary.designPowerKw} кВт з Kп=${summary.demandFactor}) вимагає ввідного автомата не менше ${Math.ceil(summary.mainCurrentA / 5) * 5} А.`,
      autoFixAvailable: true,
    });
  }

  // Rule 11: Phase balance in 3-phase systems (all floors)
  if (project.supplyPhase === '3-phase' && summary.phaseBalance) {
    if (!summary.phaseBalance.isBalanced && summary.phaseBalance.unbalancePercent > 15) {
      issues.push({
        id: 'fix_phase_unbalance',
        severity: 'warning',
        title: `[ДБН 3.7] Асиметрія фаз: ${summary.phaseBalance.unbalancePercent}% (норма ≤ 15%)`,
        description: `Розподіл навантажень: L1=${(summary.phaseBalance.l1Watts / 1000).toFixed(1)} кВт, L2=${(summary.phaseBalance.l2Watts / 1000).toFixed(1)} кВт, L3=${(summary.phaseBalance.l3Watts / 1000).toFixed(1)} кВт.`,
        autoFixAvailable: true,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    issues,
    checkedRulesCount: NORMATIVE_RULES_REGISTRY.length,
    errorCount,
    warningCount,
  };
}

/**
 * Виконання автоматичного виправлення конкретного порушення
 */
export function applyAutoFix(project: CadProject, issueId: string): { updatedProject: CadProject; message: string } {
  let updated = JSON.parse(JSON.stringify(project)) as CadProject;
  let message = 'Виправлення виконано';

  const syncElementAcrossFloors = (fn: (el: ElectricalElement) => ElectricalElement) => {
    updated.elements = updated.elements.map(fn);
    if (updated.floors) {
      updated.floors = updated.floors.map((fl) => ({
        ...fl,
        elements: (fl.elements || []).map(fn),
      }));
    }
  };

  const syncWiresAcrossFloors = (fn: (wires: WireRoute[]) => WireRoute[]) => {
    updated.wires = fn(updated.wires);
    if (updated.floors) {
      updated.floors = updated.floors.map((fl) => ({
        ...fl,
        wires: fn(fl.wires || []),
      }));
    }
  };

  // Fix 1: Bathroom IP rating
  if (issueId.startsWith('fix_ip_')) {
    const elId = issueId.replace('fix_ip_', '');
    syncElementAcrossFloors((el) =>
      el.id === elId ? { ...el, ipRating: 'IP44', name: el.name.replace(/IP\d+/, 'IP44') } : el
    );
    message = 'Ступінь захисту розетки успішно підвищено до IP44';
  }

  // Fix 2: Bathroom RCD
  else if (issueId.startsWith('fix_rcd_bath_')) {
    const cId = issueId.replace('fix_rcd_bath_', '');
    updated.circuits = updated.circuits.map((c) => {
      if (c.id === cId) {
        return { ...c, rcdType: 'rcbo_10ma', description: `${c.description || ''} (ПЗВ 10мА ванна)`.trim() };
      }
      return c;
    });
    message = 'До лінії додано диференційний захист ПЗВ 10 мА';
  }

  // Fix 3: Breaker rating exceeds cable capacity
  else if (issueId.startsWith('fix_breaker_cable_')) {
    const cId = issueId.replace('fix_breaker_cable_', '');
    updated.circuits = updated.circuits.map((c) => {
      if (c.id === cId) {
        const spec = CABLE_SPECS[c.cableType] || CABLE_SPECS['VVGng_3x2.5'];
        return { ...c, breakerRatingA: spec.recommendedBreakerA as any };
      }
      return c;
    });
    message = 'Номінал автомата скориговано відповідно до допустимого струму кабелю';
  }

  // Fix 4: Cooker breaker
  else if (issueId.startsWith('fix_cooker_breaker_')) {
    const cId = issueId.replace('fix_cooker_breaker_', '');
    updated.circuits = updated.circuits.map((c) => {
      if (c.id === cId) {
        return { ...c, breakerRatingA: 32, cableType: 'VVGng_3x6' };
      }
      return c;
    });
    message = 'Встановлено автомат 32А та кабель ВВГнгд 3х6 мм² для варильної поверхні';
  }

  // Fix 4b: Cooker cable
  else if (issueId.startsWith('fix_cooker_cable_')) {
    const cId = issueId.replace('fix_cooker_cable_', '');
    updated.circuits = updated.circuits.map((c) => {
      if (c.id === cId) {
        return { ...c, cableType: 'VVGng_3x6' };
      }
      return c;
    });
    message = 'Кабель варильної поверхні оновлено до ВВГнгд 3х6 мм²';
  }

  // Fix 5: Lighting breaker rating
  else if (issueId.startsWith('fix_light_breaker_')) {
    const cId = issueId.replace('fix_light_breaker_', '');
    updated.circuits = updated.circuits.map((c) => {
      if (c.id === cId) {
        return { ...c, breakerRatingA: 10, breakerCurve: 'B' };
      }
      return c;
    });
    message = 'Автомат лінії освітлення знижено до стандартного B10A';
  }

  // Fix 6: General socket RCD
  else if (issueId.startsWith('fix_socket_rcd_')) {
    const cId = issueId.replace('fix_socket_rcd_', '');
    updated.circuits = updated.circuits.map((c) => {
      if (c.id === cId) {
        return { ...c, rcdType: 'rcd_30ma' };
      }
      return c;
    });
    message = 'До розеткової групи підключено ПЗВ 30 мА';
  }

  // Fix 8: Voltage drop cable upgrade
  else if (issueId.startsWith('fix_vdrop_')) {
    const cId = issueId.replace('fix_vdrop_', '');
    updated.circuits = updated.circuits.map((c) => {
      if (c.id === cId) {
        let upgradedCable = c.cableType;
        if (c.cableType === 'VVGng_3x1.5') upgradedCable = 'VVGng_3x2.5';
        else if (c.cableType === 'VVGng_3x2.5') upgradedCable = 'VVGng_3x4';
        else if (c.cableType === 'VVGng_3x4') upgradedCable = 'VVGng_3x6';
        return { ...c, cableType: upgradedCable };
      }
      return c;
    });
    message = 'Переріз кабелю збільшено для зниження падіння напруги';
  }

  // Fix 9: Orphaned light auto-linking
  else if (issueId.startsWith('fix_orphan_light_')) {
    const lightId = issueId.replace('fix_orphan_light_', '');
    const allEls = getAggregatedProjectData(updated).allElements;
    const light = allEls.find((e) => e.id === lightId);
    if (light) {
      const floorSwitches = allEls.filter((e) => e.category === 'switch' && e.floorId === light.floorId);
      const switches = floorSwitches.length > 0 ? floorSwitches : allEls.filter((e) => e.category === 'switch');
      let nearestSw: ElectricalElement | null = null;
      let minDist = Infinity;
      switches.forEach((sw) => {
        const d = distance(light.position, sw.position);
        if (d < minDist) {
          minDist = d;
          nearestSw = sw;
        }
      });

      if (nearestSw) {
        const targetGroup = (nearestSw as ElectricalElement).switchGroupId || 'S1';
        syncElementAcrossFloors((e) => (e.id === lightId ? { ...e, switchGroupId: targetGroup } : e));
        message = `Світильник успішно прив’язано до вимикача (${targetGroup})`;
      }
    }
  }

  // Fix 10: Main breaker upgrade
  else if (issueId === 'fix_main_breaker') {
    const summary = calculateProjectElectricalSummary(updated);
    const neededA = Math.ceil(summary.mainCurrentA / 5) * 5;
    const standardRatings = [25, 32, 40, 50, 63, 80];
    const newRating = standardRatings.find((r) => r >= neededA) || 63;
    updated.mainBreakerRatingA = newRating;
    message = `Номінал ввідного автомата збільшено до ${newRating} А`;
  }

  // Fix 11: Phase rebalancing
  else if (issueId === 'fix_phase_unbalance') {
    const allEls = getAggregatedProjectData(updated).allElements;
    const balanceRes = autoBalancePhases(updated.circuits, allEls);
    updated.circuits = balanceRes.balancedCircuits;
    message = `Лінії збалансовано: несиметрію фаз знижено з ${balanceRes.initialUnbalancePercent}% до ${balanceRes.finalUnbalancePercent}%`;
  }

  // Fix 12: Short-circuit breaker curve sensitivity (C -> B)
  else if (issueId.startsWith('fix_ikz_curve_')) {
    const cId = issueId.replace('fix_ikz_curve_', '');
    updated.circuits = updated.circuits.map((c) => {
      if (c.id === cId) {
        return { ...c, breakerCurve: 'B' };
      }
      return c;
    });
    message = 'Характеристику розчіплювача автомата змінено на криву "B" (миттєве відключення при 5·In) за ПУЕ §1.7.79';
  }

  // Fix 13: Wall chase crossing door or window opening
  else if (issueId.startsWith('fix_chase_opening_')) {
    const wireId = issueId.replace('fix_chase_opening_', '');
    syncWiresAcrossFloors((wires) =>
      wires.map((w) => (w.id === wireId ? { ...w, conduit: 'ceiling' } : w))
    );
    message = 'Спосіб прокладання траси змінено зі штроби на безпечний стельовий у гофротрубі';
  }

  // Fix 14a: Remove illegal socket-to-switch wire
  else if (issueId.startsWith('fix_socket_switch_')) {
    const wireId = issueId.replace('fix_socket_switch_', '');
    syncWiresAcrossFloors((wires) => wires.filter((w) => w.id !== wireId));
    message = 'Неприпустимий кабель між розеткою та вимикачем успішно видалено';
  }

  // Fix 14b: Move switch to lighting circuit
  else if (issueId.startsWith('fix_switch_circuit_')) {
    const elId = issueId.replace('fix_switch_circuit_', '');
    let lightCirc = updated.circuits.find(
      (c) =>
        c.cableType === 'VVGng_3x1.5' ||
        c.breakerRatingA <= 10 ||
        c.name.toLowerCase().includes('освіт') ||
        c.name.toLowerCase().includes('світл') ||
        c.name.toLowerCase().includes('освещ') ||
        c.name.toLowerCase().includes('свет')
    );
    if (!lightCirc) {
      lightCirc = {
        id: `c_auto_light_${Date.now()}`,
        number: updated.circuits.length + 1,
        name: 'Освітлення (10А, ВВГнгд 3х1.5)',
        breakerRatingA: 10,
        breakerCurve: 'C',
        rcdType: 'none',
        cableType: 'VVGng_3x1.5',
        phase: 'L1',
        color: '#f59e0b',
        description: 'Виділена група освітлення за ПУЕ',
      };
      updated.circuits.push(lightCirc);
    }
    syncElementAcrossFloors((el) => (el.id === elId ? { ...el, circuitId: lightCirc!.id } : el));
    message = `Вимикач успішно переведено на групу освітлення «${lightCirc.name}»`;
  }

  return { updatedProject: updated, message };
}

/**
 * Застосування всіх можливих автовиправлень однією дією
 */
export function applyAllAutoFixes(project: CadProject): { updatedProject: CadProject; fixedCount: number } {
  let current = JSON.parse(JSON.stringify(project)) as CadProject;
  let fixedCount = 0;

  const { issues } = runPueAudit(current);
  const fixable = issues.filter((i) => i.autoFixAvailable);

  fixable.forEach((issue) => {
    const res = applyAutoFix(current, issue.id);
    current = res.updatedProject;
    fixedCount++;
  });

  return { updatedProject: current, fixedCount };
}
