import { describe, it, expect, beforeEach } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  migrateProjectSchema,
  sanitizeProject,
  validateAndParseProjectJson,
  saveProjectToLocalStorage,
  loadProjectFromLocalStorage,
  saveProjectSnapshot,
  listProjectSnapshots,
  restoreProjectSnapshot,
  deleteProjectSnapshot,
} from '../storage';
import { CadProject } from '../../types/cad';

function installMemoryStorage() {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
  return mockStorage;
}

describe('storage schema migration, sanitization, and snapshots', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('migrates legacy v1/v2 flat projects and legacy "3-phase" circuit phase to v3 schema', () => {
    const legacyRaw = {
      id: 'legacy_1',
      title: 'Старий проект v1',
      supplyPhase: '3-phase',
      walls: [{ id: 'w1', start: { x: 0, y: 0 }, end: { x: 300, y: 0 }, thickness: 150 }],
      elements: [
        {
          id: 'el_1',
          category: 'socket',
          type: 'socket_3phase',
          name: 'Силова 3P',
          position: { x: 100, y: 100 },
          rotation: 0,
          mountingHeightMm: 300,
          powerWatts: 6000,
          circuitId: 'c_legacy',
          ipRating: 'IP44',
        },
      ],
      circuits: [
        {
          id: 'c_legacy',
          number: 1,
          name: 'Сила 3Ф',
          breakerRatingA: 25,
          breakerCurve: 'C',
          rcdType: 'rcd_30ma',
          cableType: 'VVGng_5x4',
          phase: '3-phase', // legacy phase string
          color: '#ef4444',
        },
      ],
    };

    const migrated = migrateProjectSchema(legacyRaw);
    expect(migrated.circuits[0].phase).toBe('3P');
    expect(migrated.groundingSystem).toBe('TN-C-S');
    expect(migrated.displayUnit).toBe('mm');
    expect(migrated.floors?.length).toBe(1);
    expect(migrated.activeFloorId).toBe('floor_1');
  });

  it('sanitizes duplicate element/wire IDs and removes dangling opening/wire/circuit references', () => {
    const dirtyProject: CadProject = {
      id: 'p_dirty',
      title: 'Тест очищення',
      author: 'QA',
      date: '2026',
      scale: 0.1,
      ceilingHeightMm: 2700,
      gridStepMm: 100,
      supplyPhase: '1-phase',
      mainBreakerRatingA: 40,
      walls: [{ id: 'w1', start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, thickness: 150 }],
      openings: [
        { id: 'op_valid', wallId: 'w1', type: 'door', positionRatio: 0.5, width: 800 },
        { id: 'op_orphan', wallId: 'w_missing', type: 'window', positionRatio: 0.5, width: 1000 },
      ],
      rooms: [],
      circuits: [
        {
          id: 'c1',
          number: 1,
          name: 'Гр 1',
          breakerRatingA: 16,
          breakerCurve: 'C',
          rcdType: 'rcd_30ma',
          cableType: 'VVGng_3x2.5',
          phase: 'L1',
          color: '#38bdf8',
        },
      ],
      elements: [
        {
          id: 'dup_el',
          category: 'socket',
          type: 'socket_single',
          name: 'Розетка 1',
          position: { x: 50, y: 50 },
          rotation: 0,
          mountingHeightMm: 300,
          powerWatts: 500,
          circuitId: 'c1',
          ipRating: 'IP20',
        },
        {
          id: 'dup_el',
          category: 'socket',
          type: 'socket_single',
          name: 'Розетка 2',
          position: { x: 100, y: 50 },
          rotation: 0,
          mountingHeightMm: 300,
          powerWatts: 500,
          circuitId: 'c_deleted',
          ipRating: 'IP20',
        },
      ],
      wires: [
        {
          id: 'w_orphan',
          fromId: 'dup_el',
          toId: 'non_existent',
          mode: 'ortho',
          conduit: 'ceiling',
          cableType: 'VVGng_3x2.5',
          calculatedLengthM: 5,
        },
      ],
      furniture: [],
    };

    const cleaned = sanitizeProject(dirtyProject);
    expect(cleaned.openings.map((o) => o.id)).toEqual(['op_valid']);
    expect(new Set(cleaned.elements.map((e) => e.id)).size).toBe(2);
    expect(cleaned.elements[1].circuitId).toBeUndefined();
    expect(cleaned.wires.length).toBe(0);
  });

  it('validates imported JSON envelopes and rejects malformed JSON', () => {
    const invalid = validateAndParseProjectJson('{ bad json');
    expect(invalid.valid).toBe(false);

    const envelope = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      project: {
        title: 'Імпорт',
        walls: [],
        elements: [{ id: 'e1', category: 'panel', type: 'panel_cu', name: 'ЩР', position: { x: 10, y: 10 }, rotation: 0, mountingHeightMm: 1500, powerWatts: 0, ipRating: 'IP44' }],
        circuits: [],
      },
    });
    const valid = validateAndParseProjectJson(envelope);
    expect(valid.valid).toBe(true);
    expect(valid.project?.floors?.length).toBe(1);
  });

  it('saves/loads projects and manages versioned snapshots', () => {
    const project = migrateProjectSchema({
      id: 'proj_snap',
      title: 'Снапшот тест',
      walls: [],
      elements: [
        {
          id: 's1',
          category: 'socket',
          type: 'socket_double',
          name: 'Розетка',
          position: { x: 100, y: 100 },
          rotation: 0,
          mountingHeightMm: 300,
          powerWatts: 800,
          ipRating: 'IP20',
        },
      ],
      circuits: [],
    });

    const saveRes = saveProjectToLocalStorage(project);
    expect(saveRes.success).toBe(true);
    const loaded = loadProjectFromLocalStorage();
    expect(loaded.project?.title).toBe('Снапшот тест');

    const snap1 = saveProjectSnapshot(project, 'Етап 1');
    expect(snap1.success).toBe(true);
    expect(listProjectSnapshots().length).toBe(1);

    const modified = { ...project, title: 'Змінений' };
    saveProjectSnapshot(modified, 'Етап 2');
    expect(listProjectSnapshots().length).toBe(2);

    const restored = restoreProjectSnapshot(snap1.snapshot!.id);
    expect(restored?.title).toBe('Снапшот тест');

    const remaining = deleteProjectSnapshot(snap1.snapshot!.id);
    expect(remaining.length).toBe(1);
  });
});
