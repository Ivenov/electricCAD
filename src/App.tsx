/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { CadProject, CadTool, ViewFilterMode, ElectricalElement, Wall, WallOpening, WireRoute, CircuitGroup, Point } from './types/cad';
import { TEMPLATES } from './data/templates';
import { CatalogItem, ELECTRICAL_CATALOG } from './data/electricalCatalog';
import { OpeningCatalogItem, DOOR_OPENINGS_CATALOG, WINDOW_OPENINGS_CATALOG } from './data/openingsCatalog';
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
import {
  autoRouteProjectCables,
  autoNumberCircuitsAndCables,
  autoAssignProjectCircuitsAndCables,
  linkSwitchToLuminaires,
} from './utils/autoRouting';
import { BackupSystemConfig } from './types/cad';
import { Code2, Image as ImageIcon, Zap, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Main Project State initialized with the rich Euro 2-Room apartment template
  const [project, setProject] = useState<CadProject>(() => {
    return JSON.parse(JSON.stringify(TEMPLATES[0].project));
  });

  // History for Undo / Redo
  const [history, setHistory] = useState<CadProject[]>([]);
  const [redoStack, setRedoStack] = useState<CadProject[]>([]);

  // Active Tool and Selection
  const [activeTool, setActiveTool] = useState<CadTool>('select');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(() => ELECTRICAL_CATALOG[0]);
  const [selectedOpeningPreset, setSelectedOpeningPreset] = useState<OpeningCatalogItem | null>(() => DOOR_OPENINGS_CATALOG[0]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [linkingSwitchId, setLinkingSwitchId] = useState<string | null>(null);

  // View Filter Mode
  const [viewFilter, setViewFilter] = useState<ViewFilterMode>('all');

  // Layer Toggles
  const [showDimensions, setShowDimensions] = useState(true);
  const [showHeights, setShowHeights] = useState(true);
  const [showFurniture, setShowFurniture] = useState(true);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  // Canvas engine: Konva.js (hardware accelerated layers) or SVG
  const [engineMode, setEngineMode] = useState<'konva' | 'svg'>('konva');

  // Toast feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Overlay Modal
  const [activeModal, setActiveModal] = useState<
    'none' | 'circuits' | 'bom' | 'audit' | 'templates' | 'export' | 'json' | 'blueprint' | 'backup' | 'dstu' | '3d'
  >('none');

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

  // Simple DRC issue counter for header badge
  const auditIssueCount = useMemo(() => {
    let count = 0;
    const bathRooms = project.rooms.filter((r) => r.type === 'bathroom');
    project.elements.forEach((el) => {
      if (el.category === 'socket') {
        const inBath = bathRooms.some((room) => {
          const minX = Math.min(...room.points.map((p) => p.x));
          const maxX = Math.max(...room.points.map((p) => p.x));
          const minY = Math.min(...room.points.map((p) => p.y));
          const maxY = Math.max(...room.points.map((p) => p.y));
          return el.position.x >= minX - 10 && el.position.x <= maxX + 10 && el.position.y >= minY - 10 && el.position.y <= maxY + 10;
        });
        if (inBath && el.ipRating !== 'IP44' && el.ipRating !== 'IP65') count++;
      }
    });
    return count;
  }, [project]);

  // Auto-routing PUE cables
  const handleAutoRoute = useCallback(() => {
    const result = autoRouteProjectCables(project);
    if (result.routedElementsCount > 0) {
      updateProjectWithHistory({
        ...project,
        wires: result.newWires,
      });
      setToastMessage(`Автотрасування ПУЕ успішно виконано: прокладено ${result.routedElementsCount} ліній (довжина ${result.totalLengthM} м)`);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage('Всі електроточки вже з\'єднані або не призначені до груп щита');
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
        auditIssueCount={auditIssueCount}
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
        </div>

        {/* Quick Database, Auto-route & Blueprint Tools */}
        <div className="flex items-center gap-2">
          {/* Auto-routing Action Button */}
          <button
            onClick={handleAutoRoute}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-amber-500/40 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50 hover:border-amber-400 transition-colors shadow-sm"
            title="Автоматичне прокладання кабелів під прямими кутами 90° за нормами ПУЕ"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Автотрасування ПУЕ</span>
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
          viewFilter={viewFilter}
          onChangeViewFilter={setViewFilter}
          showDimensions={showDimensions}
          onToggleDimensions={() => setShowDimensions(!showDimensions)}
          showHeights={showHeights}
          onToggleHeights={() => setShowHeights(!showHeights)}
          showFurniture={showFurniture}
          onToggleFurniture={() => setShowFurniture(!showFurniture)}
          gridSnapEnabled={gridSnapEnabled}
          onToggleGridSnap={() => setGridSnapEnabled(!gridSnapEnabled)}
          canUndo={history.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onAutoRoute={handleAutoRoute}
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
              viewFilter={viewFilter}
              showDimensions={showDimensions}
              showHeights={showHeights}
              showFurniture={showFurniture}
              gridSnapEnabled={gridSnapEnabled}
              onSelectElement={(id) => {
                setSelectedElementId(id);
                if (id) {
                  setSelectedWallId(null);
                  setSelectedOpeningId(null);
                  setSelectedWireId(null);
                }
              }}
              onSelectWall={(id) => {
                setSelectedWallId(id);
                if (id) {
                  setSelectedElementId(null);
                  setSelectedOpeningId(null);
                  setSelectedWireId(null);
                }
              }}
              onSelectOpening={(id) => {
                setSelectedOpeningId(id);
                if (id) {
                  setSelectedElementId(null);
                  setSelectedWallId(null);
                  setSelectedWireId(null);
                }
              }}
              selectedWireId={selectedWireId}
              onSelectWire={handleSelectWire}
              onDeleteWire={handleDeleteWire}
              linkingSwitchId={linkingSwitchId}
              onLinkSwitchToLuminaires={handleLinkSwitchToLuminaires}
              onUpdateElementPosition={handleUpdateElementPosition}
              onAddElement={handleAddElement}
              onAddWall={handleAddWall}
              onAddOpening={handleAddOpening}
              onDeleteOpening={handleDeleteOpening}
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
              gridSnapEnabled={gridSnapEnabled}
              onSelectElement={(id) => {
                setSelectedElementId(id);
                if (id) {
                  setSelectedWallId(null);
                  setSelectedOpeningId(null);
                  setSelectedWireId(null);
                }
              }}
              onSelectWall={(id) => {
                setSelectedWallId(id);
                if (id) {
                  setSelectedElementId(null);
                  setSelectedOpeningId(null);
                  setSelectedWireId(null);
                }
              }}
              onSelectOpening={(id) => {
                setSelectedOpeningId(id);
                if (id) {
                  setSelectedElementId(null);
                  setSelectedWallId(null);
                  setSelectedWireId(null);
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
          onUpdateElement={handleUpdateElement}
          onDeleteElement={handleDeleteElement}
          onDuplicateElement={handleDuplicateElement}
          onUpdateWall={handleUpdateWall}
          onDeleteWall={handleDeleteWall}
          onUpdateOpening={handleUpdateOpening}
          onDeleteOpening={handleDeleteOpening}
          onSelectWire={handleSelectWire}
          onUpdateWire={handleUpdateWire}
          onDeleteWire={handleDeleteWire}
          linkingSwitchId={linkingSwitchId}
          onStartSwitchLinking={(swId) => setLinkingSwitchId(swId)}
          onCancelSwitchLinking={() => setLinkingSwitchId(null)}
          onAutoAssignCircuits={handleAutoAssignCircuits}
          onAutoNumberCables={handleAutoNumberCables}
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
