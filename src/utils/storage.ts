/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Надійне автозбереження та валідація проектів ElectroPlan CAD:
 * - Версіонування схеми (SCHEMA_VERSION = 2)
 * - Захист від QuotaExceededError (окреме сховище або стиснення підкладки БТІ)
 * - Санітизація та міграція застарілих форматів
 * - Валідація посилань (видалення "битих" зв’язків)
 */

import { CadProject, ElectricalElement, Wall, WallOpening, WireRoute, CircuitGroup, Room } from '../types/cad';
import { TEMPLATES } from '../data/templates';

export const CURRENT_SCHEMA_VERSION = 2;
export const STORAGE_KEY_PROJECT = 'ELECTROPLAN_AUTOSAVE_V2';
export const STORAGE_KEY_UNDERLAY = 'ELECTROPLAN_UNDERLAY_IMAGE_V2';
export const STORAGE_KEY_LAST_SAVED = 'ELECTROPLAN_LAST_SAVED_TIME';

export interface StorageProjectEnvelope {
  schemaVersion: number;
  savedAt: string;
  hasExternalUnderlay: boolean;
  project: CadProject;
}

/**
 * Санітизація проекту: видалення битих посилань (dangling references)
 */
export function sanitizeProject(project: CadProject): CadProject {
  const elementIdSet = new Set(project.elements.map((e) => e.id));
  const wallIdSet = new Set(project.walls.map((w) => w.id));
  const circuitIdSet = new Set(project.circuits.map((c) => c.id));

  // Очищення отворів без стін
  const validOpenings = (project.openings || []).filter((op) => wallIdSet.has(op.wallId));

  // Очищення кабелів без існуючих точок підключення
  const validWires = (project.wires || []).filter(
    (w) => elementIdSet.has(w.fromId) && elementIdSet.has(w.toId)
  );

  // Очищення прив'язок до неіснуючих кіл
  const validElements = (project.elements || []).map((el) => {
    if (el.circuitId && !circuitIdSet.has(el.circuitId)) {
      return { ...el, circuitId: undefined };
    }
    return el;
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
  try {
    const sanitized = sanitizeProject(project);

    // Якщо підкладка велика, відокремлюємо її
    let hasExternalUnderlay = false;
    let projToStore = { ...sanitized };

    if (sanitized.backgroundImage && sanitized.backgroundImage.dataUrl) {
      const dataUrlLen = sanitized.backgroundImage.dataUrl.length;
      if (dataUrlLen > 100000) {
        // Більше 100 КБ - пробуємо зберегти підкладку окремо
        try {
          localStorage.setItem(STORAGE_KEY_UNDERLAY, sanitized.backgroundImage.dataUrl);
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

    localStorage.setItem(STORAGE_KEY_PROJECT, JSON.stringify(envelope));
    localStorage.setItem(STORAGE_KEY_LAST_SAVED, envelope.savedAt);
    return { success: true };
  } catch (err: any) {
    console.error('Помилка збереження в LocalStorage:', err);
    // Якщо переповнена квота навіть без картинки, очищуємо кеш підкладки і пробуємо ще раз
    try {
      localStorage.removeItem(STORAGE_KEY_UNDERLAY);
      const stripped = { ...project, backgroundImage: undefined };
      const envelope: StorageProjectEnvelope = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        hasExternalUnderlay: false,
        project: sanitizeProject(stripped),
      };
      localStorage.setItem(STORAGE_KEY_PROJECT, JSON.stringify(envelope));
      return { success: true };
    } catch (retryErr: any) {
      return { success: false, error: 'Перевищено квоту пам’яті браузера (QuotaExceededError)' };
    }
  }
}

/**
 * Завантаження проекту з LocalStorage
 */
export function loadProjectFromLocalStorage(): {
  project: CadProject | null;
  savedAt: string | null;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECT);
    if (!raw) return { project: null, savedAt: null };

    const parsed = JSON.parse(raw);
    let proj: CadProject;
    let savedAt: string | null = null;

    if (parsed.schemaVersion && parsed.project) {
      proj = parsed.project;
      savedAt = parsed.savedAt;
      if (parsed.hasExternalUnderlay && proj.backgroundImage?.dataUrl === '__EXTERNAL_STORAGE__') {
        const storedImg = localStorage.getItem(STORAGE_KEY_UNDERLAY);
        if (storedImg) {
          proj.backgroundImage.dataUrl = storedImg;
        }
      }
    } else {
      // Legacy v1 raw project
      proj = parsed as CadProject;
      savedAt = localStorage.getItem(STORAGE_KEY_LAST_SAVED) || 'нещодавно';
    }

    return {
      project: sanitizeProject(proj),
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
  localStorage.removeItem(STORAGE_KEY_PROJECT);
  localStorage.removeItem(STORAGE_KEY_UNDERLAY);
  localStorage.removeItem(STORAGE_KEY_LAST_SAVED);
}

/**
 * Повна валідація JSON структури при імпорті файлу проекту
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
    if (data.schemaVersion && data.project) {
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

    // Перевірка унікальності ID
    if (Array.isArray(rawProject.elements)) {
      const ids = new Set<string>();
      rawProject.elements.forEach((el: any, index: number) => {
        if (!el.id) {
          el.id = `el_imported_${index}_${Math.random().toString(36).substring(2, 6)}`;
        }
        if (ids.has(el.id)) {
          el.id = `${el.id}_dup_${Math.random().toString(36).substring(2, 5)}`;
        }
        ids.add(el.id);

        if (!el.position || typeof el.position.x !== 'number' || typeof el.position.y !== 'number') {
          errors.push(`Точка "${el.name || index}" має некоректні координати`);
        }
      });
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const sanitized = sanitizeProject(rawProject as CadProject);
    return { valid: true, project: sanitized, errors: [] };
  } catch (err: any) {
    return { valid: false, errors: [`Синтаксична помилка JSON: ${err.message}`] };
  }
}
