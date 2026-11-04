/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  CadProject,
  CadTool,
  ViewFilterMode,
  ElectricalElement,
  Wall,
  WallOpening,
  WireRoute,
  CircuitGroup,
  Point,
  Room,
  FurnitureItem,
  CustomLibraryItem,
  LayerVisibilityConfig,
  DEFAULT_LAYER_VISIBILITY,
} from './types/cad';
import { TEMPLATES } from './data/templates';
import { CatalogItem, ELECTRICAL_CATALOG } from './data/electricalCatalog';
import { OpeningCatalogItem, DOOR_OPENINGS_CATALOG, WINDOW_OPENINGS_CATALOG } from './data/openingsCatalog';
import { FurnitureCatalogItem, FURNITURE_CATALOG } from './data/furnitureCatalog';
import { CadHeader } from './components/toolbar/CadHeader';
import { CadTools } from './components/toolbar/CadTools';
import { CadCanvas } from './components/cad/CadCanvas';
import { KonvaCadCanvas } from './components/cad/KonvaCadCanvas';
import { PropertyInspector } from './components/panels/PropertyInspector';
import { CircuitScheduleModal } from './components/panels/CircuitScheduleModal';
import { BillOfMaterialsModal } from './components/panels/BillOfMaterialsModal';
import { ElectricalAuditModal } from './components/panels/ElectricalAuditModal';
import { TemplatesModal } from './components/panels/TemplatesModal';
import { ExportModal } from './components/panels/ExportModal';
import { JsonStorageModal } from './components/panels/JsonStorageModal';
import { BlueprintUploadModal } from './components/panels/BlueprintUploadModal';
import { BackupPowerModal } from './components/panels/BackupPowerModal';
import { DstuDrawingAlbumModal } from './components/panels/DstuDrawingAlbumModal';
import { ThreeDViewModal } from './components/panels/ThreeDViewModal';
import { DxfImportModal } from './components/panels/DxfImportModal';
import { SwitchWiringDiagramModal } from './components/panels/SwitchWiringDiagramModal';
import { LayersVisibilityModal } from './components/panels/LayersVisibilityModal';
import { CustomLibraryModal } from './components/panels/CustomLibraryModal';
import { getStoredCustomLibrary, saveStoredCustomLibrary } from './utils/customLibraryStorage';
import {
  autoRouteProjectCables,
  autoNumberCircuitsAndCables,
  autoAssignProjectCircuitsAndCables,
  linkSwitchToLuminaires,
} from './utils/autoRouting';
import { BackupSystemConfig } from './types/cad';
import { Code2, Image as ImageIcon, Zap, CheckCircle2, FileCode } from 'lucide-react';
import { loadProjectFromLocalStorage, saveProjectToLocalStorage } from './utils/storage';
import { runPueAudit, applyAutoFix, applyAllAutoFixes } from './utils/pueRulesRegistry';
import { detectRoomsFromWalls } from './utils/roomGeometry';

export default function App() {
  // Main Project State initialized from LocalStorage autosave or standard template
  const [project, setProject] = useState<CadProject>(() => {
    const loaded = loadProjectFromLocalStorage();
    if (loaded.project) {
      return loaded.project;
    }
    return JSON.parse(JSON.stringify(TEMPLATES[0].project));
  });

  // Autosave status state
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    const loaded = loadProjectFromLocalStorage();
    if (loaded.savedAt) {
      try {
        const d = new Date(loaded.savedAt);
        return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      } catch {
        return null;
      }
    }
    return null;
  });

  // History for Undo / Redo
  const [history, setHistory] = useState<CadProject[]>([]);
  const [redoStack, setRedoStack] = useState<CadProject[]>([]);

  // Active Tool and Selection
  const [activeTool, setActiveTool] = useState<CadTool>('select');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(() => ELECTRICAL_CATALOG[0]);
  const [selectedOpeningPreset, setSelectedOpeningPreset] = useState<OpeningCatalogItem | null>(() => DOOR_OPENINGS_CATALOG[0]);
  const [selectedRoomType, setSelectedRoomType] = useState<Room['type']>('living');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedFurniturePreset, setSelectedFurniturePreset] = useState<FurnitureCatalogItem | null>(() => FURNITURE_CATALOG[0]);
  const [customLibraryModalOpen, setCustomLibraryModalOpen] = useState(false);
  const [customLibraryItems, setCustomLibraryItems] = useState<CustomLibraryItem[]>(() => {
    const stored = getStoredCustomLibrary();
    if (project.customLibrary && project.customLibrary.length > 0) {
      const existingIds = new Set(stored.map((i) => i.id));
      const merged = [...stored];
      project.customLibrary.forEach((pi) => {
        if (!existingIds.has(pi.id)) merged.push(pi);
      });
      return merged;
    }
    return stored;
  });
  const [linkingSwitchId, setLinkingSwitchId] = useState<string | null>(null);

  // View Filter Mode
  const [viewFilter, setViewFilter] = useState<ViewFilterMode>('all');

  // Layer Toggles & CAD Layer Manager state
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityConfig>(DEFAULT_LAYER_VISIBILITY);
  const [layersModalOpen, setLayersModalOpen] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showHeights, setShowHeights] = useState(true);
  const [showFurniture, setShowFurniture] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [cadStyle, setCadStyle] = useState<'autocad' | 'modern'>('autocad');
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  // Canvas engine: Konva.js (hardware accelerated layers) or SVG
  const [engineMode, setEngineMode] = useState<'konva' | 'svg'>('konva');

  // Switch wiring schematic dialog state
  const [switchWiringModalOpen, setSwitchWiringModalOpen] = useState(false);
  const [wiringSwitch, setWiringSwitch] = useState<ElectricalElement | null>(null);

  // Toast feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Overlay Modal
  const [activeModal, setActiveModal] = useState<
    'none' | 'circuits' | 'bom' | 'audit' | 'templates' | 'export' | 'json' | 'blueprint' | 'backup' | 'dstu' | '3d' | 'dxf_import'
  >('none');

  // Autosave effect (debounced 600ms)
  useEffect(() => {
    setAutosaveStatus('saving');
    const timer = setTimeout(() => {
      const res = saveProjectToLocalStorage(project);
      if (res.success) {
        setAutosaveStatus('saved');
        const now = new Date();
        setLastSavedTime(now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }));
      } else {
        setAutosaveStatus('unsaved');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [project]);

  // Helper to commit changes to history stack
  const updateProjectWithHistory = useCallback((newProject: CadProject) => {
    setHistory((prev) => [...prev.slice(-25), project]);
    setRedoStack([]);
    setProject(newProject);
  }, [project]);

  // Update background blueprint image
  const handleUpdateBackgroundImage = useCallback((updates: Partial<NonNullable<CadProject['backgroundImage']>> | undefined) => {
    if (!updates) {
      updateProjectWithHistory({ ...project, backgroundImage: undefined });
      return;
    }
    const current = project.backgroundImage || {
      dataUrl: '',
      name: 'blueprint',
      x: 0,
      y: 0,
      scale: 1,
      opacity: 0.5,
      locked: true,
    };
    updateProjectWithHistory({
      ...project,
      backgroundImage: { ...current, ...updates },
    });
  }, [project, updateProjectWithHistory]);

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack((prev) => [project, ...prev]);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setProject(previous);
  }, [history, project]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((prev) => [...prev, project]);
    setRedoStack((prev) => prev.slice(1));
    setProject(next);
  }, [redoStack, project]);

  // Keyboard shortcut listener (Ctrl+Z, Ctrl+Y, S, K, L, W, V, C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'v' || e.key === 'V') {
        setActiveTool('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('pan');
      } else if (e.key === 'w' || e.key === 'W') {
        setActiveTool('wall');
      } else if (e.key === 's' || e.key === 'S') {
        setActiveTool('socket');
        const first = ELECTRICAL_CATALOG.find((i) => i.category === 'socket');
        if (first) setSelectedCatalogItem(first);
      } else if (e.key === 'k' || e.key === 'K') {
        setActiveTool('switch');
        const first = ELECTRICAL_CATALOG.find((i) => i.category === 'switch');
        if (first) setSelectedCatalogItem(first);
      } else if (e.key === 'l' || e.key === 'L') {
        setActiveTool('light');
        const first = ELECTRICAL_CATALOG.find((i) => i.category === 'light');
        if (first) setSelectedCatalogItem(first);
      } else if (e.key === 'c' || e.key === 'C') {
        setActiveTool('wire');
      } else if (e.key === 'd' || e.key === 'D') {
        setActiveTool('door');
        setSelectedOpeningPreset(DOOR_OPENINGS_CATALOG[0]);
      } else if (e.key === 'o' || e.key === 'O') {
        setActiveTool('window');
        setSelectedOpeningPreset(WINDOW_OPENINGS_CATALOG[0]);
      } else if (e.key === 'r' || e.key === 'R') {
        setActiveTool('room');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Element actions
  const handleAddElement = useCallback((element: ElectricalElement) => {
    updateProjectWithHistory({
      ...project,
      elements: [...project.elements, element],
    });
    setSelectedElementId(element.id);
  }, [project, updateProjectWithHistory]);

  const handleUpdateElement = useCallback((updated: ElectricalElement) => {
    updateProjectWithHistory({
      ...project,
      elements: project.elements.map((el) => (el.id === updated.id ? updated : el)),
    });
  }, [project, updateProjectWithHistory]);

  const handleUpdateElementPosition = useCallback((id: string, newPos: Point, newRotation?: number, wallId?: string) => {
    setProject((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        if (el.id === id) {
          return {
            ...el,
            position: newPos,
            ...(newRotation !== undefined ? { rotation: newRotation } : {}),
            ...(wallId !== undefined ? { wallId } : {}),
          };
        }
        return el;
      }),
    }));
  }, []);

  const handleOpenSwitchWiringDiagram = useCallback((sw?: ElectricalElement) => {
    const targetSwitch = sw || project.elements.find((e) => e.category === 'switch') || null;
    setWiringSwitch(targetSwitch);
    setSwitchWiringModalOpen(true);
  }, [project.elements]);

  const handleDeleteElement = useCallback((id: string) => {
    updateProjectWithHistory({
      ...project,
      elements: project.elements.filter((el) => el.id !== id),
      wires: project.wires.filter((w) => w.fromId !== id && w.toId !== id),
    });
    setSelectedElementId(null);
  }, [project, updateProjectWithHistory]);

  const handleDuplicateElement = useCallback((id: string) => {
    const existing = project.elements.find((el) => el.id === id);
    if (!existing) return;

    const duplicated: ElectricalElement = {
      ...existing,
      id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${existing.name} (Копия)`,
      position: { x: existing.position.x + 25, y: existing.position.y + 25 },
    };

    updateProjectWithHistory({
      ...project,
      elements: [...project.elements, duplicated],
    });
    setSelectedElementId(duplicated.id);
  }, [project, updateProjectWithHistory]);

  // Wall actions
  const handleAddWall = useCallback((wall: Wall) => {
    updateProjectWithHistory({
      ...project,
      walls: [...project.walls, wall],
    });
    setSelectedWallId(wall.id);
  }, [project, updateProjectWithHistory]);

  const handleUpdateWall = useCallback((updated: Wall) => {
    updateProjectWithHistory({
      ...project,
      walls: project.walls.map((w) => (w.id === updated.id ? updated : w)),
    });
  }, [project, updateProjectWithHistory]);

  const handleDeleteWall = useCallback((id: string) => {
    updateProjectWithHistory({
      ...project,
      walls: project.walls.filter((w) => w.id !== id),
      openings: project.openings.filter((op) => op.wallId !== id),
    });
    setSelectedWallId(null);
  }, [project, updateProjectWithHistory]);

  // Opening actions (doors and windows)
  const handleAddOpening = useCallback((opening: WallOpening) => {
    updateProjectWithHistory({
      ...project,
      openings: [...project.openings, opening],
    });
    setSelectedOpeningId(opening.id);
  }, [project, updateProjectWithHistory]);

  const handleUpdateOpening = useCallback((updated: WallOpening) => {
    updateProjectWithHistory({
      ...project,
      openings: project.openings.map((op) => (op.id === updated.id ? updated : op)),
    });
  }, [project, updateProjectWithHistory]);

  const handleDeleteOpening = useCallback((id: string) => {
    updateProjectWithHistory({
      ...project,
      openings: project.openings.filter((op) => op.id !== id),
    });
    setSelectedOpeningId(null);
  }, [project, updateProjectWithHistory]);

  // Furniture actions
  const handleAddFurniture = useCallback((item: FurnitureItem) => {
    updateProjectWithHistory({
      ...project,
      furniture: [...(project.furniture || []), item],
    });
    setSelectedFurnitureId(item.id);
    setToastMessage(`🛋️ Розміщено: «${item.name}» (${item.width}×${item.height} мм)`);
    setTimeout(() => setToastMessage(null), 3000);
  }, [project, updateProjectWithHistory]);

  const handleUpdateFurniture = useCallback((updated: FurnitureItem) => {
    updateProjectWithHistory({
      ...project,
      furniture: (project.furniture || []).map((f) => (f.id === updated.id ? updated : f)),
    });
  }, [project, updateProjectWithHistory]);

  const handleUpdateFurniturePosition = useCallback((id: string, newPos: Point, newRotation?: number) => {
    setProject((prev) => ({
      ...prev,
      furniture: (prev.furniture || []).map((f) => {
        if (f.id === id) {
          return {
            ...f,
            position: newPos,
            ...(newRotation !== undefined ? { rotation: newRotation } : {}),
          };
        }
        return f;
      }),
    }));
  }, []);

  const handleDeleteFurniture = useCallback((id: string) => {
    updateProjectWithHistory({
      ...project,
      furniture: (project.furniture || []).filter((f) => f.id !== id),
    });
    setSelectedFurnitureId(null);
    setToastMessage('Меблі видалено');
    setTimeout(() => setToastMessage(null), 2500);
  }, [project, updateProjectWithHistory]);

  const handleDuplicateFurniture = useCallback((id: string) => {
    const existing = (project.furniture || []).find((f) => f.id === id);
    if (!existing) return;
    const duplicated: FurnitureItem = {
      ...existing,
      id: `furn_${Date.now()}_copy`,
      name: `${existing.name} (Копія)`,
      position: { x: existing.position.x + 30, y: existing.position.y + 30 },
    };
    updateProjectWithHistory({
      ...project,
      furniture: [...(project.furniture || []), duplicated],
    });
    setSelectedFurnitureId(duplicated.id);
    setToastMessage(`Створено дублікат: ${duplicated.name}`);
    setTimeout(() => setToastMessage(null), 2500);
  }, [project, updateProjectWithHistory]);

  const handleSelectCustomItemForPlacement = useCallback((item: CustomLibraryItem) => {
    if (item.kind === 'electrical') {
      const newEl: ElectricalElement = {
        id: `el_${Date.now()}_custom`,
        name: item.name,
        category: (item.category as any) || 'custom',
        type: 'custom_element',
        position: { x: 300, y: 300 },
        rotation: 0,
        mountingHeightMm: item.mountingHeightMm || 300,
        powerWatts: item.powerWatts || 500,
        ipRating: item.ipRating || 'IP20',
        phase: item.phase === '3-phase' ? undefined : (item.phase as any) || 'L1',
        isCustom: true,
        customSymbolShape: item.symbolShape,
        customSymbolColor: item.symbolColor,
        customLibraryId: item.id,
        notes: item.notes,
      };
      handleAddElement(newEl);
      setSelectedElementId(newEl.id);
      setSelectedFurnitureId(null);
      setToastMessage(`⚡ Вставлено власний елемент: «${item.name}»`);
    } else {
      const newFurn: FurnitureItem = {
        id: `furn_${Date.now()}_custom`,
        name: item.name,
        type: 'desk',
        category: 'custom',
        position: { x: 300, y: 300 },
        rotation: 0,
        width: item.widthMm || 1200,
        height: item.heightMm || 600,
        cadShape: item.cadShape || 'generic',
        electricalHints: item.electricalHints,
        notes: item.notes,
      };
      handleAddFurniture(newFurn);
      setSelectedFurnitureId(newFurn.id);
      setSelectedElementId(null);
      setToastMessage(`🛋️ Вставлено власні меблі: «${item.name}»`);
    }
    setTimeout(() => setToastMessage(null), 3500);
  }, [handleAddElement, handleAddFurniture]);

  const handleCustomLibraryUpdated = useCallback((items: CustomLibraryItem[]) => {
    setCustomLibraryItems(items);
    setProject((prev) => ({
      ...prev,
      customLibrary: items,
    }));
  }, []);

  // DXF Architectural Import handler
  const handleImportDxfWalls = useCallback((newWalls: Wall[], newOpenings: WallOpening[], replace: boolean) => {
    if (replace) {
      updateProjectWithHistory({
        ...project,
        walls: newWalls,
        openings: newOpenings,
      });
      setToastMessage(`Імпортовано ${newWalls.length} стін та ${newOpenings.length} отворів із DXF (заміна)`);
    } else {
      updateProjectWithHistory({
        ...project,
        walls: [...project.walls, ...newWalls],
        openings: [...project.openings, ...newOpenings],
      });
      setToastMessage(`Додано ${newWalls.length} стін та ${newOpenings.length} отворів із DXF`);
    }
    setTimeout(() => setToastMessage(null), 4000);
  }, [project, updateProjectWithHistory]);

  // Wire actions
  const handleAddWire = useCallback((wire: WireRoute) => {
    updateProjectWithHistory({
      ...project,
      wires: [...project.wires, wire],
    });
    setSelectedWireId(wire.id);
  }, [project, updateProjectWithHistory]);

  const handleUpdateWire = useCallback((updated: WireRoute) => {
    updateProjectWithHistory({
      ...project,
      wires: project.wires.map((w) => (w.id === updated.id ? updated : w)),
    });
  }, [project, updateProjectWithHistory]);

  const handleDeleteWire = useCallback((id: string) => {
    updateProjectWithHistory({
      ...project,
      wires: project.wires.filter((w) => w.id !== id),
    });
    setSelectedWireId((curr) => (curr === id ? null : curr));
  }, [project, updateProjectWithHistory]);

  const handleSelectWire = useCallback((id: string | null) => {
    setSelectedWireId(id);
    if (id) {
      setSelectedElementId(null);
      setSelectedWallId(null);
      setSelectedOpeningId(null);
    }
  }, []);

  // Switch Linking action
  const handleLinkSwitchToLuminaires = useCallback((switchId: string, lightIds: string[]) => {
    const updatedProj = linkSwitchToLuminaires(project, switchId, lightIds);
    updateProjectWithHistory(updatedProj);
    setLinkingSwitchId(null);
    setToastMessage("Вимикач успішно зв'язано зі світильниками та створено групу керування");
    setTimeout(() => setToastMessage(null), 3500);
  }, [project, updateProjectWithHistory]);

  // Project bulk electrical actions
  const handleAutoAssignCircuits = useCallback(() => {
    const res = autoAssignProjectCircuitsAndCables(project);
    updateProjectWithHistory(res.project);
    setToastMessage(`⚡ ${res.message}`);
    setTimeout(() => setToastMessage(null), 4000);
  }, [project, updateProjectWithHistory]);

  const handleAutoNumberCables = useCallback(() => {
    const updatedProj = autoNumberCircuitsAndCables(project);
    updateProjectWithHistory(updatedProj);
    setToastMessage(`🔢 Автонумерація ДСТУ: присвоєно номери групам щита (Гр.1..N) та маркування кабелів (W1-01)`);
    setTimeout(() => setToastMessage(null), 4000);
  }, [project, updateProjectWithHistory]);

  // Circuit actions
  const handleUpdateCircuits = useCallback((circuits: CircuitGroup[]) => {
    updateProjectWithHistory({
      ...project,
      circuits,
    });
  }, [project, updateProjectWithHistory]);

  // Project replacement (templates or JSON import)
  const handleSelectTemplate = useCallback((newProj: CadProject) => {
    setHistory((prev) => [...prev, project]);
    setRedoStack([]);
    setProject(newProj);
    setSelectedElementId(null);
    setSelectedWallId(null);
  }, [project]);

  // Room actions
  const handleAddRoom = useCallback((room: Room) => {
    updateProjectWithHistory({
      ...project,
      rooms: [...project.rooms, room],
    });
    setToastMessage(`🏠 Створено приміщення: «${room.name}» (${room.areaM2} м²)`);
    setTimeout(() => setToastMessage(null), 3000);
  }, [project, updateProjectWithHistory]);

  const handleAutoDetectRooms = useCallback(() => {
    const detected = detectRoomsFromWalls(project.walls, project.rooms);
    updateProjectWithHistory({
      ...project,
      rooms: detected,
    });
    setToastMessage(`🏠 Знайдено ${detected.length} приміщень за стінами проекту`);
    setTimeout(() => setToastMessage(null), 3000);
  }, [project, updateProjectWithHistory]);

  const handleNewProject = useCallback(() => {
    const blankProject: CadProject = {
      id: `proj_${Date.now()}`,
      title: 'Новий проект квартири',
      author: 'Інженер',
      date: new Date().getFullYear().toString(),
      scale: 0.1,
      ceilingHeightMm: 2700,
      gridStepMm: 100,
      supplyPhase: '1-phase',
      mainBreakerRatingA: 40,
      rooms: [],
      walls: [],
      openings: [],
      elements: [],
      wires: [],
      furniture: [],
      circuits: [
        { id: 'c_light_1', number: 1, name: 'Гр.1 Освітлення', breakerRatingA: 10, breakerCurve: 'B', rcdType: 'none', cableType: 'VVGng_3x1.5', phase: 'L1', color: '#ef4444' },
        { id: 'c_socket_1', number: 2, name: 'Гр.2 Розетки побутові', breakerRatingA: 16, breakerCurve: 'C', rcdType: 'rcd_30ma', cableType: 'VVGng_3x2.5', phase: 'L1', color: '#38bdf8' },
        { id: 'c_kitchen_1', number: 3, name: 'Гр.3 Кухня (плита 32А)', breakerRatingA: 32, breakerCurve: 'C', rcdType: 'rcd_30ma', cableType: 'VVGng_3x6', phase: 'L1', color: '#dc2626' },
        { id: 'c_bath_1', number: 4, name: 'Гр.4 Санвузол (10мА ПЗВ)', breakerRatingA: 16, breakerCurve: 'C', rcdType: 'rcbo_10ma', cableType: 'VVGng_3x2.5', phase: 'L1', color: '#10b981' },
      ],
      autoRoutingEnabled: true,
    };
    updateProjectWithHistory(blankProject);
    setSelectedElementId(null);
    setSelectedWallId(null);
    setSelectedWireId(null);
    setSelectedOpeningId(null);
    setToastMessage('Створено новий чистий план');
    setTimeout(() => setToastMessage(null), 3000);
  }, [updateProjectWithHistory]);

  // DRC / PUE Auto-fix handlers
  const handleAutoFixIssue = useCallback((issueId: string) => {
    const { updatedProject, message } = applyAutoFix(project, issueId);
    updateProjectWithHistory(updatedProject);
    setToastMessage(`🔧 ${message}`);
    setTimeout(() => setToastMessage(null), 4000);
  }, [project, updateProjectWithHistory]);

  const handleAutoFixAllIssues = useCallback(() => {
    const { updatedProject, fixedCount } = applyAllAutoFixes(project);
    updateProjectWithHistory(updatedProject);
    setToastMessage(`✨ Автоматично виправлено ${fixedCount} зауважень ПУЕ`);
    setTimeout(() => setToastMessage(null), 4000);
  }, [project, updateProjectWithHistory]);

  // Accurate DRC issue counter based on full 12-rule registry with ray-casting polygon checks
  const auditIssueCount = useMemo(() => {
    const { errorCount, warningCount } = runPueAudit(project);
    return errorCount + warningCount;
  }, [project]);

  // Auto-routing PUE cables toggle and run handlers
  const handleToggleAutoRouting = useCallback(() => {
    const nextVal = !(project.autoRoutingEnabled ?? true);
    updateProjectWithHistory({
      ...project,
      autoRoutingEnabled: nextVal,
    });
    setToastMessage(
      nextVal
        ? '⚡ Автотрасування УВІМКНЕНО: кабелі автоматично прокладаються за ПУЕ'
        : '🔒 Автотрасування ВИМКНЕНО: ручний режим редагування вузлів та трас (захист від перезапису)'
    );
    setTimeout(() => setToastMessage(null), 3500);
  }, [project, updateProjectWithHistory]);

  const handleAutoRoute = useCallback(() => {
    if (project.autoRoutingEnabled === false) {
      setToastMessage('⚠️ Автотрасування вимкнено в налаштуваннях. Увімкніть «Автотрасування», щоб прокласти лінії.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    const result = autoRouteProjectCables(project);
    if (result.routedElementsCount > 0) {
      updateProjectWithHistory({
        ...project,
        wires: result.newWires,
        ...(result.newElements ? { elements: result.newElements } : {}),
      });
      setToastMessage(`Автотрасування ПУЕ успішно виконано: прокладено ${result.routedElementsCount} ліній (довжина ${result.totalLengthM} м)`);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage('Всі електроточки вже з\'єднані або захищені в ручному режимі');
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, [project, updateProjectWithHistory]);

  const handleUpdateBackupConfig = useCallback((config: BackupSystemConfig) => {
    updateProjectWithHistory({
      ...project,
      backupSystem: config,
    });
  }, [project, updateProjectWithHistory]);

  const handleUpdateBackupElements = useCallback((elements: ElectricalElement[], circuits: CircuitGroup[]) => {
    updateProjectWithHistory({
      ...project,
      elements,
      circuits,
    });
  }, [project, updateProjectWithHistory]);

  const totalAreaM2 = useMemo(() => {
    return project.rooms.reduce((sum, r) => sum + r.areaM2, 0).toFixed(1);
  }, [project.rooms]);

  const totalPowerKw = useMemo(() => {
    const watts = project.elements.reduce((sum, e) => sum + e.powerWatts, 0);
    return (watts / 1000).toFixed(2);
  }, [project.elements]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans">
      {/* 1. Header adhering strictly to Top Bar Contract */}
      <CadHeader
        currentTab={activeModal === 'none' ? 'canvas' : (activeModal as any)}
        onChangeTab={(tab) => {
          if (tab === 'canvas') setActiveModal('none');
          else setActiveModal(tab);
        }}
        onOpenTemplates={() => setActiveModal('templates')}
        onOpenExportModal={() => setActiveModal('export')}
        onOpenBackupModal={() => setActiveModal('backup')}
        onOpenDstuAlbum={() => setActiveModal('dstu')}
        onOpen3DView={() => setActiveModal('3d')}
        onOpenDxfImport={() => setActiveModal('dxf_import')}
        onOpenLayersModal={() => setLayersModalOpen(true)}
        onOpenCustomLibrary={() => setCustomLibraryModalOpen(true)}
        onNewProject={handleNewProject}
        auditIssueCount={auditIssueCount}
        autosaveStatus={autosaveStatus}
        lastSavedTime={lastSavedTime}
      />

      {/* 2. Secondary Contextual Sub-bar */}
      <div className="h-10 border-b border-neutral-800 bg-neutral-900/80 px-4 flex items-center justify-between text-xs shrink-0 z-20">
        {/* Layer View Filters */}
        <div className="flex items-center gap-1 p-0.5 bg-neutral-950 rounded-lg border border-neutral-800">
          <button
            onClick={() => setViewFilter('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              viewFilter === 'all'
                ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Всі шари
          </button>
          <button
            onClick={() => setViewFilter('sockets')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              viewFilter === 'sockets'
                ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            План розеток
          </button>
          <button
            onClick={() => setViewFilter('lighting')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              viewFilter === 'lighting'
                ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Освітлення та вимикачі
          </button>
          <button
            onClick={() => setViewFilter('mounting_plan')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              viewFilter === 'mounting_plan'
                ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Монтажний план із висотами
          </button>
          <button
            onClick={() => setLayersModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold text-sky-300 hover:text-white bg-sky-950/60 hover:bg-sky-900 border border-sky-600/50 transition-colors whitespace-nowrap shadow-sm"
            title="Диспетчер властивостей шарів креслення (AutoCAD Layer Manager, пресети)"
          >
            <span>Шари креслення</span>
          </button>
        </div>

        {/* Quick Database, Auto-route, DXF & Blueprint Tools */}
        <div className="flex items-center gap-2">
          {/* Dual Auto-routing Toggle & Run Controls */}
          <div className="flex items-center gap-1 p-0.5 bg-neutral-950 rounded-lg border border-neutral-800">
            <button
              onClick={handleToggleAutoRouting}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all shadow-sm ${
                (project.autoRoutingEnabled ?? true)
                  ? 'bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200'
              }`}
              title={
                (project.autoRoutingEnabled ?? true)
                  ? 'Автотрасування: УВІМКНЕНО (клікніть, щоб вимкнути для всього проекту та перейти в ручний режим)'
                  : 'Автотрасування: ВИМКНЕНО (ручний режим — автотрасування не чіпатиме ваші вузли)'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  (project.autoRoutingEnabled ?? true) ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                }`}
              />
              <span>{(project.autoRoutingEnabled ?? true) ? 'Автотраса: УВІМК' : 'Автотраса: ВИМК'}</span>
            </button>

            <button
              onClick={handleAutoRoute}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                (project.autoRoutingEnabled ?? true)
                  ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-950/40'
                  : 'text-neutral-500 hover:text-neutral-400 hover:bg-neutral-900'
              }`}
              title="Запустити автоматичне прокладання кабелів під прямими кутами 90° за нормами ПУЕ"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Трасувати</span>
            </button>
          </div>

          <button
            onClick={() => setActiveModal('dxf_import')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50 hover:border-emerald-400 transition-colors shadow-sm"
            title="Імпорт архітектурного креслення DXF (AutoCAD, ArchiCAD, Revit)"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Імпорт DXF</span>
          </button>

          <button
            onClick={() => setActiveModal('blueprint')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              project.backgroundImage
                ? 'bg-sky-950/40 border-sky-600 text-sky-400 font-semibold'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
            }`}
            title="Завантажити креслення приміщення (підкладку БТІ)"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Підкладка БТІ</span>
          </button>

          <button
            onClick={() => setActiveModal('json')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition-colors"
            title="База координат і параметрів обладнання (JSON)"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">База JSON</span>
          </button>

          {/* Engine Selector */}
          <div className="hidden lg:flex items-center gap-1 p-0.5 bg-neutral-950 rounded-lg border border-neutral-800 text-[11px]">
            <button
              onClick={() => setEngineMode('konva')}
              className={`px-2 py-0.5 rounded transition-colors ${
                engineMode === 'konva'
                  ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Апаратне прискорення шарів Konva.js"
            >
              Konva.js
            </button>
            <button
              onClick={() => setEngineMode('svg')}
              className={`px-2 py-0.5 rounded transition-colors ${
                engineMode === 'svg'
                  ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Векторний режим SVG"
            >
              SVG
            </button>
          </div>
        </div>

        {/* Project Metadata Summary */}
        <div className="hidden sm:flex items-center gap-3 text-neutral-400 text-xs">
          <span>{project.title}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{totalAreaM2} м²</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{project.elements.length} точек</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-sky-400">{totalPowerKw} кВт</span>
        </div>
      </div>

      {/* 3. Main Workspace: Left Tool strip + CAD Canvas + Right Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        <CadTools
          activeTool={activeTool}
          onSelectTool={(tool) => {
            setActiveTool(tool);
          }}
          selectedCatalogItem={selectedCatalogItem}
          onSelectCatalogItem={(item) => {
            setSelectedCatalogItem(item);
            setActiveTool(item.category as CadTool);
          }}
          selectedOpeningItem={selectedOpeningPreset}
          onSelectOpeningItem={(item) => {
            setSelectedOpeningPreset(item);
            setActiveTool(item.type as CadTool);
          }}
          selectedRoomType={selectedRoomType}
          onSelectRoomType={setSelectedRoomType}
          onAutoDetectRooms={handleAutoDetectRooms}
          selectedFurnitureItem={selectedFurniturePreset}
          onSelectFurnitureItem={(item) => {
            setSelectedFurniturePreset(item);
            setActiveTool('furniture');
          }}
          onOpenCustomLibraryModal={() => setCustomLibraryModalOpen(true)}
          customLibraryItems={customLibraryItems}
          viewFilter={viewFilter}
          onChangeViewFilter={setViewFilter}
          showDimensions={showDimensions}
          onToggleDimensions={() => setShowDimensions(!showDimensions)}
          showHeights={showHeights}
          onToggleHeights={() => setShowHeights(!showHeights)}
          showFurniture={showFurniture}
          onToggleFurniture={() => setShowFurniture(!showFurniture)}
          showAnnotations={showAnnotations}
          onToggleAnnotations={() => {
            setShowAnnotations((prev) => {
              const next = !prev;
              setLayerVisibility((cfg) => ({ ...cfg, annotations: next }));
              return next;
            });
          }}
          onOpenLayersModal={() => setLayersModalOpen(true)}
          gridSnapEnabled={gridSnapEnabled}
          onToggleGridSnap={() => setGridSnapEnabled(!gridSnapEnabled)}
          canUndo={history.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onAutoRoute={handleAutoRoute}
          autoRoutingEnabled={project.autoRoutingEnabled ?? true}
          onToggleAutoRouting={handleToggleAutoRouting}
        />

        {/* CAD Canvas Viewport: Konva.js Hardware Accelerated or SVG */}
        <main className="flex-1 relative overflow-hidden bg-neutral-950">
          {engineMode === 'konva' ? (
            <KonvaCadCanvas
              project={project}
              activeTool={activeTool}
              selectedCatalogItem={selectedCatalogItem}
              selectedElementId={selectedElementId}
              selectedWallId={selectedWallId}
              selectedOpeningId={selectedOpeningId}
              selectedOpeningPreset={selectedOpeningPreset}
              selectedRoomType={selectedRoomType}
              viewFilter={viewFilter}
              showDimensions={showDimensions}
              showHeights={showHeights}
              showFurniture={showFurniture}
              showAnnotations={showAnnotations}
              cadStyle={cadStyle}
              layerVisibility={layerVisibility}
              onToggleAnnotations={() => {
                setShowAnnotations((prev) => {
                  const next = !prev;
                  setLayerVisibility((cfg) => ({ ...cfg, annotations: next }));
                  return next;
                });
              }}
              onToggleCadStyle={() => setCadStyle((prev) => prev === 'autocad' ? 'modern' : 'autocad')}
              onOpenSwitchWiringDiagram={handleOpenSwitchWiringDiagram}
              onOpenLayersModal={() => setLayersModalOpen(true)}
              gridSnapEnabled={gridSnapEnabled}
              selectedFurnitureId={selectedFurnitureId}
              onSelectFurniture={(id) => {
                setSelectedFurnitureId(id);
                if (id) {
                  setSelectedElementId(null);
                  setSelectedWallId(null);
                  setSelectedOpeningId(null);
                  setSelectedWireId(null);
                }
              }}
              selectedFurniturePreset={selectedFurniturePreset}
              onAddFurniture={handleAddFurniture}
              onUpdateFurniturePosition={handleUpdateFurniturePosition}
              onDeleteFurniture={handleDeleteFurniture}
              onSelectElement={(id) => {
                setSelectedElementId(id);
                if (id) {
                  setSelectedWallId(null);
                  setSelectedOpeningId(null);
                  setSelectedWireId(null);
                  setSelectedFurnitureId(null);
                }
              }}
              onSelectWall={(id) => {
                setSelectedWallId(id);
                if (id) {
                  setSelectedElementId(null);
                  setSelectedOpeningId(null);
                  setSelectedWireId(null);
                  setSelectedFurnitureId(null);
                }
              }}
              onSelectOpening={(id) => {
                setSelectedOpeningId(id);
                if (id) {
                  setSelectedElementId(null);
                  setSelectedWallId(null);
                  setSelectedWireId(null);
                  setSelectedFurnitureId(null);
                }
              }}
              selectedWireId={selectedWireId}
              onSelectWire={handleSelectWire}
              onUpdateWire={handleUpdateWire}
              onDeleteWire={handleDeleteWire}
              linkingSwitchId={linkingSwitchId}
              onLinkSwitchToLuminaires={handleLinkSwitchToLuminaires}
              onUpdateElementPosition={handleUpdateElementPosition}
              onAddElement={handleAddElement}
              onAddWall={handleAddWall}
              onAddOpening={handleAddOpening}
              onDeleteOpening={handleDeleteOpening}
              onAddRoom={handleAddRoom}
              onAddWire={handleAddWire}
              onDeleteElement={handleDeleteElement}
              onUpdateBackgroundImage={handleUpdateBackgroundImage}
            />
          ) : (
            <CadCanvas
              project={project}
              activeTool={activeTool}
              selectedCatalogItem={selectedCatalogItem}
              selectedElementId={selectedElementId}
              selectedWallId={selectedWallId}
              selectedOpeningId={selectedOpeningId}
              selectedOpeningPreset={selectedOpeningPreset}
              viewFilter={viewFilter}
              showDimensions={showDimensions}
              showHeights={showHeights}
              showFurniture={showFurniture}
              layerVisibility={layerVisibility}
              gridSnapEnabled={gridSnapEnabled}
              onSelectElement={(id) => {
                setSelectedElementId(id);
                if (id) {
                  setSelectedWallId(null);
                  setSelectedOpeningId(null);
                  setSelectedWireId(null);
                  setSelectedFurnitureId(null);
                }
              }}
              onSelectWall={(id) => {
                setSelectedWallId(id);
                if (id) {
                  setSelectedElementId(null);
                  setSelectedOpeningId(null);
                  setSelectedWireId(null);
                  setSelectedFurnitureId(null);
                }
              }}
              onSelectOpening={(id) => {
                setSelectedOpeningId(id);
                if (id) {
                  setSelectedElementId(null);
                  setSelectedWallId(null);
                  setSelectedWireId(null);
                  setSelectedFurnitureId(null);
                }
              }}
              onUpdateElementPosition={handleUpdateElementPosition}
              onAddElement={handleAddElement}
              onAddWall={handleAddWall}
              onAddOpening={handleAddOpening}
              onDeleteOpening={handleDeleteOpening}
              onAddWire={handleAddWire}
              onDeleteElement={handleDeleteElement}
            />
          )}
        </main>

        {/* Property Inspector */}
        <PropertyInspector
          project={project}
          selectedElementId={selectedElementId}
          selectedWallId={selectedWallId}
          selectedOpeningId={selectedOpeningId}
          selectedWireId={selectedWireId}
          selectedFurnitureId={selectedFurnitureId}
          onUpdateElement={handleUpdateElement}
          onDeleteElement={handleDeleteElement}
          onDuplicateElement={handleDuplicateElement}
          onUpdateFurniture={handleUpdateFurniture}
          onDeleteFurniture={handleDeleteFurniture}
          onDuplicateFurniture={handleDuplicateFurniture}
          onUpdateWall={handleUpdateWall}
          onDeleteWall={handleDeleteWall}
          onUpdateOpening={handleUpdateOpening}
          onDeleteOpening={handleDeleteOpening}
          onSelectWire={handleSelectWire}
          onUpdateWire={handleUpdateWire}
          onDeleteWire={handleDeleteWire}
          onOpenSwitchWiringDiagram={handleOpenSwitchWiringDiagram}
          linkingSwitchId={linkingSwitchId}
          onStartSwitchLinking={(swId) => setLinkingSwitchId(swId)}
          onCancelSwitchLinking={() => setLinkingSwitchId(null)}
          onAutoAssignCircuits={handleAutoAssignCircuits}
          onAutoNumberCables={handleAutoNumberCables}
          autoRoutingEnabled={project.autoRoutingEnabled ?? true}
          onToggleAutoRouting={handleToggleAutoRouting}
        />
      </div>

      {/* 4. Modals */}
      {activeModal === 'circuits' && (
        <CircuitScheduleModal
          project={project}
          onUpdateCircuits={handleUpdateCircuits}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'bom' && (
        <BillOfMaterialsModal
          project={project}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'audit' && (
        <ElectricalAuditModal
          project={project}
          onAutoFix={handleAutoFixIssue}
          onAutoFixAll={handleAutoFixAllIssues}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'templates' && (
        <TemplatesModal
          onSelectTemplate={handleSelectTemplate}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'export' && (
        <ExportModal
          project={project}
          onImportProject={handleSelectTemplate}
          onOpenDstuAlbum={() => setActiveModal('dstu')}
          onOpen3DView={() => setActiveModal('3d')}
          onOpenDxfImport={() => setActiveModal('dxf_import')}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'backup' && (
        <BackupPowerModal
          project={project}
          onUpdateBackupConfig={handleUpdateBackupConfig}
          onUpdateProjectElements={handleUpdateBackupElements}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'dstu' && (
        <DstuDrawingAlbumModal
          project={project}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'json' && (
        <JsonStorageModal
          project={project}
          onApplyJson={handleSelectTemplate}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'blueprint' && (
        <BlueprintUploadModal
          project={project}
          onUpdateBlueprint={handleUpdateBackgroundImage}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === '3d' && (
        <ThreeDViewModal
          project={project}
          onClose={() => setActiveModal('none')}
        />
      )}

      {activeModal === 'dxf_import' && (
        <DxfImportModal
          project={project}
          onImportWalls={handleImportDxfWalls}
          onClose={() => setActiveModal('none')}
        />
      )}

      {/* Switch Connection Flow & Installation Schematic Modal (ПУЕ §6.1.14 & §7.1.50) */}
      {switchWiringModalOpen && (
        <SwitchWiringDiagramModal
          project={project}
          selectedSwitch={wiringSwitch || undefined}
          onClose={() => setSwitchWiringModalOpen(false)}
        />
      )}

      {/* CAD Layer Visibility Manager Modal (Вкладка видимості шарів креслення) */}
      <LayersVisibilityModal
        isOpen={layersModalOpen}
        onClose={() => setLayersModalOpen(false)}
        config={layerVisibility}
        onChange={(newConfig) => {
          setLayerVisibility(newConfig);
          setShowDimensions(newConfig.dimensions);
          setShowHeights(newConfig.heights);
          setShowFurniture(newConfig.furniture);
          setShowAnnotations(newConfig.annotations);
        }}
        project={project}
      />

      {/* Custom Element & Furniture Library Modal (Власна бібліотека та бібліотека меблів) */}
      <CustomLibraryModal
        isOpen={customLibraryModalOpen}
        onClose={() => setCustomLibraryModalOpen(false)}
        onSelectItemForPlacement={handleSelectCustomItemForPlacement}
        onLibraryUpdated={handleCustomLibraryUpdated}
      />

      {/* 5. Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 border border-amber-500/50 shadow-2xl rounded-xl px-4 py-3 flex items-center gap-3 text-neutral-100 text-xs animate-in slide-in-from-bottom duration-200">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* 5. Print Layout (Штамп креслення за ДСТУ при виведенні на друк) */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 pointer-events-none">
        <div className="w-full h-full border-2 border-black flex flex-col justify-between p-4">
          <div className="text-center font-bold text-lg uppercase tracking-wider">
            {project.title} — План розташування електрообладнання та кабельних трас
          </div>

          <div className="border border-black p-2 mt-auto text-xs grid grid-cols-4 gap-2">
            <div><strong>Об'єкт:</strong> Квартира {totalAreaM2} м²</div>
            <div><strong>Стадія:</strong> Робочий проект (Р)</div>
            <div><strong>Масштаб:</strong> 1:100 (1см = 1м)</div>
            <div><strong>Дата:</strong> {project.date}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
