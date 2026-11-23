/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Надійне автозбереження, міграція версій та валідація проектів ElectroPlan CAD:
 * - Версіонування схеми (CURRENT_SCHEMA_VERSION = 3)
 * - Міграція зі старих схем v1/v2 без втрати даних
 * - Захист від QuotaExceededError (окреме сховище або стиснення підкладки БТІ)
 * - Санітизація та валідація посилань (видалення "битих" зв’язків)
 * - Локальні знімки версій (Project Snapshots)
 */

import {
  CadProject,
  CircuitGroup,
  FloorLevel,
  ProjectSnapshot,
} from '../types/cad';

export const CURRENT_SCHEMA_VERSION = 3;
export const STORAGE_KEY_PROJECT = 'ELECTROPLAN_AUTOSAVE_V2';
export const STORAGE_KEY_UNDERLAY = 'ELECTROPLAN_UNDERLAY_IMAGE_V2';
export const STORAGE_KEY_LAST_SAVED = 'ELECTROPLAN_LAST_SAVED_TIME';
export const STORAGE_KEY_SNAPSHOTS = 'ELECTROPLAN_SNAPSHOTS_V1';
const MAX_SNAPSHOTS = 15;

export interface StorageProjectEnvelope {
  schemaVersion: number;
  savedAt: string;
  hasExternalUnderlay: boolean;
  project: CadProject;
}

/**
 * Безпечний доступ до localStorage (для підтримки як браузера, так і тестового середовища)
 */
function getStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Міграція застарілих форматів проекту (v1/v2 -> v3) без втрати даних
 */
export function migrateProjectSchema(raw: any): CadProject {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Некоректний об’єкт проекту для міграції');
  }

  const ceilingHeightMm = typeof raw.ceilingHeightMm === 'number' && raw.ceilingHeightMm > 0
    ? raw.ceilingHeightMm
    : 2700;

  // Нормалізація кіл живлення (у т.ч. застарілого значення фази '3-phase' -> '3P')
  const migratedCircuits: CircuitGroup[] = Array.isArray(raw.circuits)
    ? raw.circuits.map((c: any, idx: number) => ({
        ...c,
        id: c.id || `c_migrated_${idx + 1}`,
        number: typeof c.number === 'number' ? c.number : idx + 1,
        name: c.name || `Гр.${idx + 1}`,
        breakerRatingA: c.breakerRatingA || 16,
        breakerCurve: c.breakerCurve || 'C',
        rcdType: c.rcdType || 'none',
        cableType: c.cableType || 'VVGng_3x2.5',
        phase: c.phase === '3-phase' ? '3P' : (c.phase || 'L1'),
        color: c.color || '#38bdf8',
      }))
    : [];

  const rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
  const walls = Array.isArray(raw.walls) ? raw.walls : [];
  const openings = Array.isArray(raw.openings) ? raw.openings : [];
  const elements = Array.isArray(raw.elements) ? raw.elements : [];
  const wires = Array.isArray(raw.wires) ? raw.wires : [];
  const furniture = Array.isArray(raw.furniture) ? raw.furniture : [];

  // Міграція багатоповерхової структури (v1/v2 могли не мати floors або activeFloorId)
  let migratedFloors: FloorLevel[] | undefined = Array.isArray(raw.floors) && raw.floors.length > 0
    ? raw.floors.map((fl: any, idx: number) => ({
        id: fl.id || `floor_${idx + 1}`,
        name: fl.name || `Поверх ${idx + 1}`,
        levelNumber: typeof fl.levelNumber === 'number' ? fl.levelNumber : idx + 1,
        elevationMm: typeof fl.elevationMm === 'number' ? fl.elevationMm : idx * 3000,
        ceilingHeightMm: typeof fl.ceilingHeightMm === 'number' ? fl.ceilingHeightMm : ceilingHeightMm,
        distributionBoardName: fl.distributionBoardName || `ЩР-${idx + 1}`,
        backgroundImage: fl.backgroundImage,
        rooms: Array.isArray(fl.rooms) ? fl.rooms : [],
        walls: Array.isArray(fl.walls) ? fl.walls : [],
        openings: Array.isArray(fl.openings) ? fl.openings : [],
        elements: Array.isArray(fl.elements) ? fl.elements : [],
        wires: Array.isArray(fl.wires) ? fl.wires : [],
        furniture: Array.isArray(fl.furniture) ? fl.furniture : [],
      }))
    : undefined;

  let activeFloorId: string | undefined = raw.activeFloorId;
  if (!migratedFloors) {
    activeFloorId = 'floor_1';
    migratedFloors = [
      {
        id: 'floor_1',
        name: 'Поверх 1',
        levelNumber: 1,
        elevationMm: 0,
        ceilingHeightMm,
        distributionBoardName: 'ЩР-1',
        backgroundImage: raw.backgroundImage,
        rooms,
        walls,
        openings,
        elements,
        wires,
        furniture,
      },
    ];
  } else if (!activeFloorId || !migratedFloors.some((f) => f.id === activeFloorId)) {
    activeFloorId = migratedFloors[0].id;
  }

  const migrated: CadProject = {
    ...raw,
    id: raw.id || `proj_${Date.now()}`,
    title: raw.title || 'Проект електропостачання',
    author: raw.author || 'Інженер',
    date: raw.date || new Date().getFullYear().toString(),
    scale: typeof raw.scale === 'number' && raw.scale > 0 ? raw.scale : 0.1,
    displayUnit: raw.displayUnit === 'cm' || raw.displayUnit === 'm' ? raw.displayUnit : 'mm',
    ceilingHeightMm,
    gridStepMm: typeof raw.gridStepMm === 'number' && raw.gridStepMm > 0 ? raw.gridStepMm : 100,
    supplyPhase: raw.supplyPhase === '3-phase' ? '3-phase' : '1-phase',
    groundingSystem:
      raw.groundingSystem === 'TN-S' || raw.groundingSystem === 'TT'
        ? raw.groundingSystem
        : 'TN-C-S',
    mainBreakerRatingA: typeof raw.mainBreakerRatingA === 'number' ? raw.mainBreakerRatingA : 40,
    rooms,
    walls,
    openings,
    elements,
    wires,
    circuits: migratedCircuits,
    furniture,
    enclosureConfigs:
      raw.enclosureConfigs && typeof raw.enclosureConfigs === 'object'
        ? raw.enclosureConfigs
        : {},
    floors: migratedFloors,
    activeFloorId,
    riserFeeders: Array.isArray(raw.riserFeeders) ? raw.riserFeeders : [],
    autoRoutingEnabled: raw.autoRoutingEnabled !== undefined ? Boolean(raw.autoRoutingEnabled) : true,
  };

  return migrated;
}

/**
 * Санітизація проекту: видалення битих посилань (dangling references) та дедуплікація ID
 */
export function sanitizeProject(project: CadProject): CadProject {
  const wallIdSet = new Set((project.walls || []).map((w) => w.id));
  const circuitIdSet = new Set((project.circuits || []).map((c) => c.id));

  // Очищення отворів без стін
  const validOpenings = (project.openings || []).filter((op) => wallIdSet.has(op.wallId));

  // Очищення прив'язок до неіснуючих кіл та гарантування унікальності ID елементів
  const seenElIds = new Set<string>();
  const validElements = (project.elements || []).map((el, idx) => {
    let cleanEl = el;
    if (el.circuitId && !circuitIdSet.has(el.circuitId)) {
      cleanEl = { ...el, circuitId: undefined };
    }
    if (seenElIds.has(cleanEl.id)) {
      cleanEl = {
        ...cleanEl,
        id: `${cleanEl.id}_dup_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      };
    }
    seenElIds.add(cleanEl.id);
    return cleanEl;
  });

  // Оновлюємо множину валідних ID елементів після дедуплікації
  const uniqueElIdSet = new Set(validElements.map((e) => e.id));

  // Очищення кабелів без існуючих точок підключення та гарантування унікальності ID кабелів
  const seenWireIds = new Set<string>();
  const validWires = (project.wires || [])
    .filter((w) => uniqueElIdSet.has(w.fromId) && uniqueElIdSet.has(w.toId))
    .map((w, idx) => {
      let cleanWire = w;
      if (seenWireIds.has(cleanWire.id)) {
        cleanWire = {
          ...cleanWire,
          id: `${cleanWire.id}_dup_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        };
      }
      seenWireIds.add(cleanWire.id);
      return cleanWire;
    });

  return {
    ...project,
    elements: validElements,
    wires: validWires,
    openings: validOpenings,
    rooms: project.rooms || [],
    walls: project.walls || [],
    circuits: project.circuits || [],
    furniture: project.furniture || [],
    supplyPhase: project.supplyPhase || '1-phase',
    groundingSystem: project.groundingSystem || 'TN-C-S',
    displayUnit: project.displayUnit || 'mm',
    mainBreakerRatingA: project.mainBreakerRatingA || 40,
    ceilingHeightMm: project.ceilingHeightMm || 2700,
    scale: project.scale || 0.1,
    gridStepMm: project.gridStepMm || 100,
  };
}

/**
 * Збереження проекту в LocalStorage із захистом від переповнення квоти
 */
export function saveProjectToLocalStorage(project: CadProject): { success: boolean; error?: string } {
  const storage = getStorage();
  if (!storage) return { success: false, error: 'LocalStorage недоступний' };

  try {
    const sanitized = sanitizeProject(project);

    // Якщо підкладка велика, відокремлюємо її
    let hasExternalUnderlay = false;
    let projToStore = { ...sanitized };

    if (sanitized.backgroundImage && sanitized.backgroundImage.dataUrl) {
      const dataUrlLen = sanitized.backgroundImage.dataUrl.length;
      if (dataUrlLen > 100000) {
        try {
          storage.setItem(STORAGE_KEY_UNDERLAY, sanitized.backgroundImage.dataUrl);
          hasExternalUnderlay = true;
          projToStore = {
            ...projToStore,
            backgroundImage: {
              ...sanitized.backgroundImage,
              dataUrl: '__EXTERNAL_STORAGE__',
            },
          };
        } catch (e) {
          console.warn('Неможливо зберегти велику підкладку в localStorage, пропускаємо зображення', e);
          projToStore = {
            ...projToStore,
            backgroundImage: undefined,
          };
        }
      }
    }

    const envelope: StorageProjectEnvelope = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      hasExternalUnderlay,
      project: projToStore,
    };

    storage.setItem(STORAGE_KEY_PROJECT, JSON.stringify(envelope));
    storage.setItem(STORAGE_KEY_LAST_SAVED, envelope.savedAt);
    return { success: true };
  } catch (err: any) {
    console.error('Помилка збереження в LocalStorage:', err);
    try {
      storage.removeItem(STORAGE_KEY_UNDERLAY);
      const stripped = { ...project, backgroundImage: undefined };
      const envelope: StorageProjectEnvelope = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        hasExternalUnderlay: false,
        project: sanitizeProject(stripped),
      };
      storage.setItem(STORAGE_KEY_PROJECT, JSON.stringify(envelope));
      return { success: true };
    } catch {
      return { success: false, error: 'Перевищено квоту пам’яті браузера (QuotaExceededError)' };
    }
  }
}

/**
 * Завантаження проекту з LocalStorage з автоматичною міграцією схеми
 */
export function loadProjectFromLocalStorage(): {
  project: CadProject | null;
  savedAt: string | null;
} {
  const storage = getStorage();
  if (!storage) return { project: null, savedAt: null };

  try {
    const raw = storage.getItem(STORAGE_KEY_PROJECT);
    if (!raw) return { project: null, savedAt: null };

    const parsed = JSON.parse(raw);
    let rawProj: any;
    let savedAt: string | null = null;

    if (parsed.schemaVersion && parsed.project) {
      rawProj = parsed.project;
      savedAt = parsed.savedAt;
      if (parsed.hasExternalUnderlay && rawProj.backgroundImage?.dataUrl === '__EXTERNAL_STORAGE__') {
        const storedImg = storage.getItem(STORAGE_KEY_UNDERLAY);
        if (storedImg) {
          rawProj.backgroundImage.dataUrl = storedImg;
        }
      }
    } else {
      rawProj = parsed;
      savedAt = storage.getItem(STORAGE_KEY_LAST_SAVED) || 'нещодавно';
    }

    const migrated = migrateProjectSchema(rawProj);
    return {
      project: sanitizeProject(migrated),
      savedAt,
    };
  } catch (err) {
    console.error('Помилка зчитування автозбереження:', err);
    return { project: null, savedAt: null };
  }
}

/**
 * Очищення автозбереження
 */
export function clearProjectLocalStorage(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(STORAGE_KEY_PROJECT);
  storage.removeItem(STORAGE_KEY_UNDERLAY);
  storage.removeItem(STORAGE_KEY_LAST_SAVED);
}

/**
 * Повна валідація JSON структури при імпорті файлу проекту та міграція версій
 */
export function validateAndParseProjectJson(jsonStr: string): {
  valid: boolean;
  project?: CadProject;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const data = JSON.parse(jsonStr);

    let rawProject: any = data;
    if (data && data.schemaVersion && data.project) {
      rawProject = data.project;
    }

    if (!rawProject || typeof rawProject !== 'object') {
      return { valid: false, errors: ['Файл не містить валідного об’єкта JSON'] };
    }

    // Обов’язкові масиви
    if (!Array.isArray(rawProject.walls)) {
      errors.push('Відсутній або некоректний масив стін (walls)');
    }
    if (!Array.isArray(rawProject.elements)) {
      errors.push('Відсутній або некоректний масив електроточок (elements)');
    }
    if (!Array.isArray(rawProject.circuits)) {
      errors.push('Відсутній або некоректний масив ліній щита (circuits)');
    }

    if (Array.isArray(rawProject.elements)) {
      rawProject.elements.forEach((el: any, index: number) => {
        if (!el || typeof el !== 'object') {
          errors.push(`Елемент #${index} має некоректну структуру`);
          return;
        }
        if (!el.position || typeof el.position.x !== 'number' || typeof el.position.y !== 'number') {
          errors.push(`Точка "${el.name || index}" має некоректні координати`);
        }
      });
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const cloned = JSON.parse(JSON.stringify(rawProject));
    if (Array.isArray(cloned.elements)) {
      cloned.elements = cloned.elements.map((el: any, index: number) => ({
        ...el,
        id: el.id || `el_imported_${index}_${Math.random().toString(36).substring(2, 6)}`,
      }));
    }

    const migrated = migrateProjectSchema(cloned);
    const sanitized = sanitizeProject(migrated);
    return { valid: true, project: sanitized, errors: [] };
  } catch (err: any) {
    return { valid: false, errors: [`Синтаксична помилка JSON: ${err.message}`] };
  }
}

// ============================================================================
// ВЕРСІОНУВАННЯ ТА ЛОКАЛЬНІ ЗНІМКИ (PROJECT SNAPSHOTS)
// ============================================================================

/**
 * Повертає список збережених точок відновлення (від найновішої до найстарішої)
 */
export function listProjectSnapshots(): ProjectSnapshot[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY_SNAPSHOTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => s && typeof s.id === 'string' && s.data)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

/**
 * Зберігає нову точку відновлення проекту (до MAX_SNAPSHOTS = 15)
 */
export function saveProjectSnapshot(
  project: CadProject,
  label?: string
): { success: boolean; snapshot?: ProjectSnapshot; error?: string } {
  const storage = getStorage();
  if (!storage) return { success: false, error: 'LocalStorage недоступний' };

  const sanitized = sanitizeProject(migrateProjectSchema(project));
  // Для економії місця у знімках прибираємо важку растрову підкладку > 100КБ
  const dataForSnapshot: CadProject =
    sanitized.backgroundImage?.dataUrl && sanitized.backgroundImage.dataUrl.length > 100000
      ? { ...sanitized, backgroundImage: undefined }
      : JSON.parse(JSON.stringify(sanitized));

  const createdAt = new Date().toISOString();
  const snapshot: ProjectSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt,
    label: (label && label.trim()) || `Версія від ${new Date(createdAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`,
    elementCount: dataForSnapshot.elements.length,
    wireCount: dataForSnapshot.wires.length,
    circuitCount: dataForSnapshot.circuits.length,
    data: dataForSnapshot,
  };

  const existing = listProjectSnapshots();
  let updatedList = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS);

  // Зберігаємо зі зменшенням кількості старих знімків при перевищенні квоти
  while (updatedList.length > 0) {
    try {
      storage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(updatedList));
      return { success: true, snapshot };
    } catch {
      if (updatedList.length === 1) {
        return { success: false, error: 'Недостатньо пам’яті браузера для збереження версії' };
      }
      updatedList = updatedList.slice(0, updatedList.length - 1);
    }
  }

  return { success: false, error: 'Помилка збереження версії' };
}

/**
 * Відновлює проект із збереженого знімка за його ID (з міграцією та санітизацією)
 */
export function restoreProjectSnapshot(id: string): CadProject | null {
  const snapshots = listProjectSnapshots();
  const found = snapshots.find((s) => s.id === id);
  if (!found || !found.data) return null;
  try {
    const migrated = migrateProjectSchema(found.data);
    return sanitizeProject(migrated);
  } catch {
    return null;
  }
}

/**
 * Видаляє знімок версії за ID та повертає оновлений список
 */
export function deleteProjectSnapshot(id: string): ProjectSnapshot[] {
  const storage = getStorage();
  const updated = listProjectSnapshots().filter((s) => s.id !== id);
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(updated));
    } catch {
      // ignore quota error on shrink
    }
  }
  return updated;
}
