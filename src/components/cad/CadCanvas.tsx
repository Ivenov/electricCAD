import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  CadProject,
  ElectricalElement,
  Wall,
  WallOpening,
  Room,
  FurnitureItem,
  WireRoute,
  CadTool,
  ViewFilterMode,
  Point,
} from '../../types/cad';
import { ElectricalSymbol } from './Symbols';
import {
  distance,
  pxToMm,
  mmToPx,
  snapPointToGrid,
  snapToNearestWall,
  generateCurvedWirePath,
  generateOrthoWirePath,
  calculateCableLengthM,
  MM_PER_PX,
  snapToWallGeometry,
  snapAngleOrtho,
  findWallOpeningPlacement,
  WallSnapResult,
} from '../../utils/cadMath';
import { CatalogItem } from '../../data/electricalCatalog';
import { OpeningCatalogItem } from '../../data/openingsCatalog';

interface CadCanvasProps {
  project: CadProject;
  activeTool: CadTool;
  selectedCatalogItem: CatalogItem | null;
  selectedElementId: string | null;
  selectedWallId: string | null;
  selectedOpeningId?: string | null;
  selectedOpeningPreset?: OpeningCatalogItem | null;
  viewFilter: ViewFilterMode;
  showDimensions: boolean;
  showHeights: boolean;
  showFurniture: boolean;
  gridSnapEnabled: boolean;
  onSelectElement: (id: string | null) => void;
  onSelectWall: (id: string | null) => void;
  onSelectOpening?: (id: string | null) => void;
  onUpdateElementPosition: (id: string, newPos: Point, newRotation?: number, wallId?: string) => void;
  onAddElement: (element: ElectricalElement) => void;
  onAddWall: (wall: Wall) => void;
  onAddOpening?: (opening: WallOpening) => void;
  onDeleteOpening?: (id: string) => void;
  onAddWire: (wire: WireRoute) => void;
  onDeleteElement: (id: string) => void;
}

export const CadCanvas: React.FC<CadCanvasProps> = ({
  project,
  activeTool,
  selectedCatalogItem,
  selectedElementId,
  selectedWallId,
  selectedOpeningId,
  selectedOpeningPreset,
  viewFilter,
  showDimensions,
  showHeights,
  showFurniture,
  gridSnapEnabled,
  onSelectElement,
  onSelectWall,
  onSelectOpening,
  onUpdateElementPosition,
  onAddElement,
  onAddWall,
  onAddOpening,
  onDeleteOpening,
  onAddWire,
  onDeleteElement,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Pan & Zoom transform state
  const [transform, setTransform] = useState<{ x: number; y: number; k: number }>({
    x: 120,
    y: 80,
    k: 1.1,
  });

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging existing element state
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tool specific in-progress states
  const [wallStartPoint, setWallStartPoint] = useState<Point | null>(null);
  const [wireSourceElementId, setWireSourceElementId] = useState<string | null>(null);
  const [measureStartPoint, setMeasureStartPoint] = useState<Point | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<Point>({ x: 0, y: 0 });

  // Advanced snapping & openings states
  const [wallSnapResult, setWallSnapResult] = useState<WallSnapResult | null>(null);
  const [activeOrtho, setActiveOrtho] = useState<{ point: Point; angleDeg: number; isSnapped: boolean } | null>(null);
  const [openingHoverPlacement, setOpeningHoverPlacement] = useState<ReturnType<typeof findWallOpeningPlacement> | null>(null);

  // Convert screen client coords to SVG world coordinates
  const clientToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      const worldX = (screenX - transform.x) / transform.k;
      const worldY = (screenY - transform.y) / transform.k;
      return { x: worldX, y: worldY };
    },
    [transform]
  );

  // Mouse wheel zoom towards pointer
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newK = Math.min(Math.max(transform.k * zoomFactor, 0.25), 4.5);

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - ((mouseX - transform.x) * newK) / transform.k;
    const newY = mouseY - ((mouseY - transform.y) * newK) / transform.k;

    setTransform({ x: newX, y: newY, k: newK });
  };

  // Spacebar pan state
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Keyboard shortcuts: Spacebar pan, Escape cancel, Delete element
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setIsSpacePressed(true);
      } else if (e.key === 'Escape') {
        setWallStartPoint(null);
        setWireSourceElementId(null);
        setMeasureStartPoint(null);
        onSelectElement(null);
        onSelectWall(null);
        onSelectOpening?.(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          if (selectedElementId) {
            onDeleteElement(selectedElementId);
          } else if (selectedOpeningId && onDeleteOpening) {
            onDeleteOpening(selectedOpeningId);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedElementId, selectedOpeningId, onDeleteElement, onDeleteOpening, onSelectElement, onSelectWall, onSelectOpening]);

  // Pointer move handler
  const handlePointerMove = (e: React.PointerEvent) => {
    const worldPos = clientToWorld(e.clientX, e.clientY);
    setMouseWorldPos(worldPos);

    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: prev.x + (e.clientX - panStart.x),
        y: prev.y + (e.clientY - panStart.y),
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (draggingElementId) {
      let targetPos = {
        x: worldPos.x - dragOffset.x,
        y: worldPos.y - dragOffset.y,
      };

      if (gridSnapEnabled) {
        targetPos = snapPointToGrid(targetPos, 10);
      }

      // Check wall snapping
      const wallSnap = snapToNearestWall(targetPos, project.walls, 20);
      if (wallSnap) {
        onUpdateElementPosition(draggingElementId, wallSnap.snappedPoint, wallSnap.rotation, wallSnap.wallId);
      } else {
        onUpdateElementPosition(draggingElementId, targetPos);
      }
      return;
    }

    if (activeTool === 'wall') {
      const snap = snapToWallGeometry(worldPos, project.walls, 25);
      setWallSnapResult(snap);
      if (wallStartPoint) {
        if (!snap) {
          const ortho = snapAngleOrtho(wallStartPoint, worldPos, 45, 6);
          setActiveOrtho(ortho);
        } else {
          setActiveOrtho(null);
        }
      } else {
        setActiveOrtho(null);
      }
      setOpeningHoverPlacement(null);
    } else if (activeTool === 'door' || activeTool === 'window') {
      setWallSnapResult(null);
      setActiveOrtho(null);
      const opWidthMm = selectedOpeningPreset?.widthMm || (activeTool === 'door' ? 900 : 1200);
      const placement = findWallOpeningPlacement(worldPos, project.walls, opWidthMm, 35);
      setOpeningHoverPlacement(placement);
    } else {
      setWallSnapResult(null);
      setActiveOrtho(null);
      setOpeningHoverPlacement(null);
    }
  };

  // Pointer down handler
  const handlePointerDown = (e: React.PointerEvent) => {
    // Middle click or Pan tool initiates pan
    if (e.button === 1 || activeTool === 'pan' || isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button !== 0) return; // Only primary mouse button

    // Door / Window placement
    if ((activeTool === 'door' || activeTool === 'window') && openingHoverPlacement) {
      const opType = activeTool === 'door' ? 'door' : 'window';
      const widthMm = selectedOpeningPreset?.widthMm || (opType === 'door' ? 900 : 1200);
      const newOpening: WallOpening = {
        id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        wallId: openingHoverPlacement.wallId,
        type: opType,
        positionRatio: openingHoverPlacement.positionRatio,
        width: widthMm,
        height: opType === 'door' ? 2100 : 1400,
        elevation: opType === 'door' ? 0 : 900,
        swingDirection: selectedOpeningPreset?.defaultSwing || 'right',
      };
      onAddOpening?.(newOpening);
      onSelectOpening?.(newOpening.id);
      return;
    }

    const world = clientToWorld(e.clientX, e.clientY);

    // WALL TOOL: Start or finish a wall
    if (activeTool === 'wall') {
      let effectiveWallPos = world;
      if (wallSnapResult) {
        effectiveWallPos = wallSnapResult.snappedPoint;
      } else if (activeOrtho?.isSnapped) {
        effectiveWallPos = activeOrtho.point;
      } else if (gridSnapEnabled) {
        effectiveWallPos = snapPointToGrid(world, 10);
      }

      if (!wallStartPoint) {
        setWallStartPoint(effectiveWallPos);
      } else {
        if (distance(wallStartPoint, effectiveWallPos) > 4) {
          const newWall: Wall = {
            id: 'wall_' + Date.now(),
            start: wallStartPoint,
            end: effectiveWallPos,
            thickness: 150,
            type: 'partition',
          };
          onAddWall(newWall);
          setWallStartPoint(effectiveWallPos);
        }
      }
      return;
    }

    const effectivePos = gridSnapEnabled ? snapPointToGrid(world, 10) : world;

    // MEASURE TOOL:
    if (activeTool === 'measure') {
      if (!measureStartPoint) {
        setMeasureStartPoint(effectivePos);
      } else {
        setMeasureStartPoint(null);
      }
      return;
    }

    // PLACING ELECTRICAL ELEMENT (SOCKET / SWITCH / LIGHT / PANEL):
    if (
      ['socket', 'switch', 'light', 'panel', 'junction'].includes(activeTool) &&
      selectedCatalogItem
    ) {
      let finalPos = effectivePos;
      let finalRotation = 0;
      let finalWallId: string | undefined = undefined;

      // Snap to wall automatically
      const wallSnap = snapToNearestWall(effectivePos, project.walls, 25);
      if (wallSnap) {
        finalPos = wallSnap.snappedPoint;
        finalRotation = wallSnap.rotation;
        finalWallId = wallSnap.wallId;
      }

      // Find appropriate default circuit
      const matchedCircuit = project.circuits.find((c) =>
        selectedCatalogItem.category === 'light' ? c.cableType === 'VVGng_3x1.5' : c.breakerRatingA >= 16
      );

      const newElement: ElectricalElement = {
        id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        category: selectedCatalogItem.category,
        type: selectedCatalogItem.type,
        name: selectedCatalogItem.name,
        position: finalPos,
        rotation: finalRotation,
        wallId: finalWallId,
        mountingHeightMm: selectedCatalogItem.defaultHeightMm,
        powerWatts: selectedCatalogItem.defaultPowerWatts,
        ipRating: selectedCatalogItem.defaultIpRating,
        circuitId: matchedCircuit?.id,
        label: selectedCatalogItem.badge,
      };

      onAddElement(newElement);
      return;
    }

    // Clicking on empty canvas deselects
    if (activeTool === 'select') {
      onSelectElement(null);
      onSelectWall(null);
    }
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    setDraggingElementId(null);
  };

  // Element interaction (click, drag start, wire connect)
  const handleElementPointerDown = (e: React.PointerEvent, el: ElectricalElement) => {
    e.stopPropagation();

    // WIRE ROUTING TOOL:
    if (activeTool === 'wire') {
      if (!wireSourceElementId) {
        setWireSourceElementId(el.id);
      } else if (wireSourceElementId !== el.id) {
        const fromEl = project.elements.find((item) => item.id === wireSourceElementId);
        if (fromEl) {
          const isLightingControl =
            (fromEl.category === 'switch' && el.category === 'light') ||
            (fromEl.category === 'light' && el.category === 'switch') ||
            (fromEl.category === 'light' && el.category === 'light');

          const wireLength = calculateCableLengthM(
            fromEl,
            el,
            project.ceilingHeightMm,
            isLightingControl ? 'ceiling' : 'ceiling'
          );

          const newWire: WireRoute = {
            id: 'wire_' + Date.now(),
            fromId: fromEl.id,
            toId: el.id,
            mode: isLightingControl ? 'curve' : 'ortho',
            conduit: 'ceiling',
            cableType: isLightingControl ? 'VVGng_3x1.5' : 'VVGng_3x2.5',
            circuitId: el.circuitId || fromEl.circuitId,
            switchGroupId: fromEl.switchGroupId || el.switchGroupId,
            calculatedLengthM: wireLength,
          };

          // Link switch group if connecting switch to light
          if (fromEl.category === 'switch' && el.category === 'light') {
            const swGroup = fromEl.switchGroupId || `S_${fromEl.id.slice(-3)}`;
            fromEl.switchGroupId = swGroup;
            el.switchGroupId = swGroup;
          }

          onAddWire(newWire);
        }
        setWireSourceElementId(null);
      }
      return;
    }

    // SELECT TOOL: Select and begin drag
    if (activeTool === 'select') {
      onSelectElement(el.id);
      onSelectWall(null);
      const worldPos = clientToWorld(e.clientX, e.clientY);
      setDragOffset({
        x: worldPos.x - el.position.x,
        y: worldPos.y - el.position.y,
      });
      setDraggingElementId(el.id);
    }
  };

  // Filter visible elements based on active view mode
  const filteredElements = useMemo(() => {
    return project.elements.filter((el) => {
      if (viewFilter === 'all') return true;
      if (viewFilter === 'sockets') return el.category === 'socket' || el.category === 'panel' || el.category === 'appliance';
      if (viewFilter === 'lighting') return el.category === 'light' || el.category === 'switch' || el.category === 'panel';
      if (viewFilter === 'wiring') return true;
      if (viewFilter === 'mounting_plan') return true;
      return true;
    });
  }, [project.elements, viewFilter]);

  // Filter visible wires based on active view mode
  const filteredWires = useMemo(() => {
    if (viewFilter === 'sockets') {
      return project.wires.filter((w) => w.cableType !== 'VVGng_3x1.5');
    }
    if (viewFilter === 'lighting') {
      return project.wires.filter((w) => w.cableType === 'VVGng_3x1.5' || w.mode === 'curve');
    }
    return project.wires;
  }, [project.wires, viewFilter]);

  // Wall dictionary for quick lookup
  const wallMap = useMemo(() => {
    const map = new Map<string, Wall>();
    project.walls.forEach((w) => map.set(w.id, w));
    return map;
  }, [project.walls]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none cad-grid-dark ${
        isPanning ? 'cursor-grabbing' : activeTool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'
      }`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg
        ref={svgRef}
        className="w-full h-full pointer-events-auto"
        style={{
          transformOrigin: '0 0',
        }}
      >
        <defs>
          {/* Subtle grid pattern */}
          <pattern id="minorGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="0.6" fill="rgba(255,255,255,0.12)" />
          </pattern>
          <pattern id="majorGrid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          </pattern>

          {/* Door swing arc fill pattern */}
          <pattern id="doorHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(56, 189, 248, 0.15)" strokeWidth="1" />
          </pattern>

          {/* Glow filters for high-voltage power runs and active selections */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Background Grid */}
          <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#minorGrid)" className="pointer-events-none" />
          <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#majorGrid)" className="pointer-events-none" />

          {/* ----------------- BACKGROUND BLUEPRINT LAYER ----------------- */}
          {project.backgroundImage && (
            <g
              transform={`translate(${project.backgroundImage.x}, ${project.backgroundImage.y}) scale(${
                project.backgroundImage.scaleX ?? project.backgroundImage.scale
              }, ${project.backgroundImage.scaleY ?? project.backgroundImage.scale}) rotate(${
                project.backgroundImage.rotation ?? 0
              })`}
              className="pointer-events-none"
            >
              <image
                href={project.backgroundImage.dataUrl}
                x="0"
                y="0"
                opacity={project.backgroundImage.opacity}
              />
            </g>
          )}

          {/* ----------------- ROOMS LAYER ----------------- */}
          {project.rooms.map((room) => {
            const pathData =
              room.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

            // Center of room for label
            const avgX = room.points.reduce((sum, p) => sum + p.x, 0) / room.points.length;
            const avgY = room.points.reduce((sum, p) => sum + p.y, 0) / room.points.length;

            return (
              <g key={room.id} className="pointer-events-none">
                <path
                  d={pathData}
                  fill={
                    room.type === 'bathroom'
                      ? 'rgba(6, 182, 212, 0.04)'
                      : room.type === 'kitchen'
                      ? 'rgba(245, 158, 11, 0.03)'
                      : 'rgba(255, 255, 255, 0.02)'
                  }
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="1"
                />
                {/* Room Title & Area Badge */}
                <g transform={`translate(${avgX}, ${avgY})`}>
                  <rect
                    x="-60"
                    y="-18"
                    width="120"
                    height="36"
                    rx="6"
                    fill="rgba(15, 23, 42, 0.85)"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="-2"
                    fontSize="11"
                    fontWeight="600"
                    fill="#e2e8f0"
                    textAnchor="middle"
                  >
                    {room.name}
                  </text>
                  <text
                    x="0"
                    y="12"
                    fontSize="9.5"
                    fontWeight="500"
                    fill="#94a3b8"
                    textAnchor="middle"
                    className="font-mono tabular-nums"
                  >
                    {room.areaM2.toFixed(1)} м²
                  </text>
                </g>
              </g>
            );
          })}

          {/* ----------------- FURNITURE LAYER ----------------- */}
          {showFurniture &&
            project.furniture.map((item) => {
              const halfW = item.width / 20; // scaled down to coordinates
              const halfH = item.height / 20;

              return (
                <g
                  key={item.id}
                  transform={`translate(${item.position.x}, ${item.position.y}) rotate(${item.rotation})`}
                  className="pointer-events-none opacity-40 hover:opacity-75 transition-opacity"
                >
                  <rect
                    x={-halfW}
                    y={-halfH}
                    width={halfW * 2}
                    height={halfH * 2}
                    rx="4"
                    fill="rgba(30, 41, 59, 0.6)"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                  {item.type === 'bed' && (
                    <g stroke="#475569" strokeWidth="1" fill="none">
                      <rect x={-halfW + 4} y={-halfH + 4} width={halfW * 2 - 8} height="20" rx="2" fill="rgba(255,255,255,0.05)" />
                      <line x1="0" y1={-halfH + 24} x2="0" y2={halfH - 4} strokeDasharray="3 3" />
                    </g>
                  )}
                  {item.type === 'kitchen_sink' && (
                    <circle cx="0" cy="0" r={halfW * 0.5} fill="none" stroke="#0ea5e9" strokeWidth="1.5" />
                  )}
                  {item.type === 'stove' && (
                    <g fill="#ef4444" opacity="0.6">
                      <circle cx={-halfW * 0.4} cy={-halfH * 0.4} r="4" />
                      <circle cx={halfW * 0.4} cy={-halfH * 0.4} r="4" />
                      <circle cx={-halfW * 0.4} cy={halfH * 0.4} r="4" />
                      <circle cx={halfW * 0.4} cy={halfH * 0.4} r="4" />
                    </g>
                  )}
                  <text
                    x="0"
                    y="3"
                    fontSize="8"
                    fill="#94a3b8"
                    textAnchor="middle"
                    className="select-none tracking-tight"
                  >
                    {item.name}
                  </text>
                </g>
              );
            })}

          {/* ----------------- WALLS LAYER ----------------- */}
          {project.walls.map((wall) => {
            const isSelected = selectedWallId === wall.id;
            const wallLengthMm = pxToMm(distance(wall.start, wall.end));
            const strokeW = wall.thickness / MM_PER_PX; // e.g. 150mm -> 15px

            return (
              <g
                key={wall.id}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectWall(wall.id);
                  onSelectElement(null);
                }}
              >
                {/* Main wall body */}
                <line
                  x1={wall.start.x}
                  y1={wall.start.y}
                  x2={wall.end.x}
                  y2={wall.end.y}
                  stroke={isSelected ? '#38bdf8' : wall.type === 'bearing' ? '#334155' : '#475569'}
                  strokeWidth={strokeW}
                  strokeLinecap="square"
                />
                {/* Architectural outline */}
                <line
                  x1={wall.start.x}
                  y1={wall.start.y}
                  x2={wall.end.x}
                  y2={wall.end.y}
                  stroke={isSelected ? '#7dd3fc' : '#64748b'}
                  strokeWidth={1}
                />

                {/* Dimension label along wall */}
                {showDimensions && wallLengthMm > 400 && (
                  <g
                    transform={`translate(${(wall.start.x + wall.end.x) / 2}, ${(wall.start.y + wall.end.y) / 2})`}
                    className="pointer-events-none"
                  >
                    <rect
                      x="-24"
                      y="-8"
                      width="48"
                      height="16"
                      rx="3"
                      fill="rgba(15, 23, 42, 0.9)"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="0.8"
                    />
                    <text
                      x="0"
                      y="3.5"
                      fontSize="9"
                      fill="#e2e8f0"
                      textAnchor="middle"
                      fontWeight="500"
                      className="font-mono tabular-nums"
                    >
                      {wallLengthMm}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ----------------- OPENINGS (DOORS & WINDOWS) ----------------- */}
          {project.openings.map((op) => {
            const wall = wallMap.get(op.wallId);
            if (!wall) return null;

            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const wallLen = Math.hypot(dx, dy);
            if (wallLen === 0) return null;

            // Opening center position
            const posX = wall.start.x + dx * op.positionRatio;
            const posY = wall.start.y + dy * op.positionRatio;
            const angleRad = Math.atan2(dy, dx);
            const angleDeg = (angleRad * 180) / Math.PI;

            const halfOpPx = mmToPx(op.width) / 2;
            const isSelected = selectedOpeningId === op.id;
            const wallThickPx = wall.thickness / MM_PER_PX;

            const swing = op.swingDirection || 'right';
            const flipX = swing === 'left' ? -1 : 1;
            const flipY = swing === 'out' ? -1 : 1;

            return (
              <g
                key={op.id}
                transform={`translate(${posX}, ${posY}) rotate(${angleDeg})`}
                className="cursor-pointer pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectOpening?.(op.id);
                  onSelectElement(null);
                  onSelectWall(null);
                }}
              >
                {/* Cutout background matching floor */}
                <rect
                  x={-halfOpPx}
                  y={-wallThickPx / 2 - 1}
                  width={halfOpPx * 2}
                  height={wallThickPx + 2}
                  fill="#0c0e14"
                />

                {/* Selection Highlight */}
                {isSelected && (
                  <rect
                    x={-halfOpPx - 4}
                    y={-wallThickPx / 2 - 8}
                    width={halfOpPx * 2 + 8}
                    height={wallThickPx + 16}
                    fill="rgba(56, 189, 248, 0.1)"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    rx="3"
                  />
                )}

                {op.type === 'door' ? (
                  <g transform={`scale(${flipX}, ${flipY})`}>
                    {/* Door jamb points */}
                    <circle cx={-halfOpPx} cy="0" r="2.5" fill={isSelected ? '#38bdf8' : '#94a3b8'} />
                    <circle cx={halfOpPx} cy="0" r="2.5" fill={isSelected ? '#38bdf8' : '#94a3b8'} />
                    {/* Architectural 90 degree door swing arc */}
                    <path
                      d={`M ${-halfOpPx} 0 A ${halfOpPx * 2} ${halfOpPx * 2} 0 0 1 ${halfOpPx} ${-halfOpPx * 2}`}
                      fill="none"
                      stroke={isSelected ? '#38bdf8' : '#0284c7'}
                      strokeWidth="1.2"
                      strokeDasharray="3 2"
                    />
                    {/* Door leaf line */}
                    <line
                      x1={-halfOpPx}
                      y1="0"
                      x2={halfOpPx}
                      y2={-halfOpPx * 2}
                      stroke={isSelected ? '#7dd3fc' : '#cbd5e1'}
                      strokeWidth="2.5"
                    />
                  </g>
                ) : (
                  <g>
                    {/* Architectural Window with frame & double glass pane */}
                    <line x1={-halfOpPx} y1={-wallThickPx / 2} x2={-halfOpPx} y2={wallThickPx / 2} stroke="#64748b" strokeWidth="1.5" />
                    <line x1={halfOpPx} y1={-wallThickPx / 2} x2={halfOpPx} y2={wallThickPx / 2} stroke="#64748b" strokeWidth="1.5" />
                    <line x1={-halfOpPx} y1={-wallThickPx / 3} x2={halfOpPx} y2={-wallThickPx / 3} stroke={isSelected ? '#38bdf8' : '#60a5fa'} strokeWidth="1.5" />
                    <line x1={-halfOpPx} y1={wallThickPx / 3} x2={halfOpPx} y2={wallThickPx / 3} stroke={isSelected ? '#38bdf8' : '#60a5fa'} strokeWidth="1.5" />
                    <line x1={-halfOpPx} y1="0" x2={halfOpPx} y2="0" stroke={isSelected ? '#7dd3fc' : '#93c5fd'} strokeWidth="2.5" />
                  </g>
                )}

                {/* Selected dimension badge */}
                {isSelected && (
                  <g transform={`translate(0, ${-wallThickPx / 2 - 14})`} className="pointer-events-none">
                    <rect x="-24" y="-7" width="48" height="14" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.8" />
                    <text x="0" y="3.5" fontSize="8.5" fill="#38bdf8" textAnchor="middle" className="font-mono">
                      {op.width} мм
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* ----------------- WIRES & TRACES LAYER ----------------- */}
          {filteredWires.map((wire) => {
            const fromEl = project.elements.find((e) => e.id === wire.fromId);
            const toEl = project.elements.find((e) => e.id === wire.toId);
            if (!fromEl || !toEl) return null;

            const circuit = project.circuits.find((c) => c.id === wire.circuitId);
            const wireColor = circuit?.color || (wire.mode === 'curve' ? '#fbbf24' : '#38bdf8');
            const isLighting = wire.mode === 'curve';

            const pathD = isLighting
              ? generateCurvedWirePath(fromEl.position, toEl.position, 0.22)
              : generateOrthoWirePath(fromEl.position, toEl.position);

            return (
              <g key={wire.id} className="group cursor-pointer">
                {/* Thick invisible hit area */}
                <path d={pathD} fill="none" stroke="transparent" strokeWidth="14" />
                {/* Main wire path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={wireColor}
                  strokeWidth={isLighting ? 1.8 : 2.5}
                  strokeDasharray={isLighting ? '4 3' : 'none'}
                  strokeLinecap="round"
                  className="transition-all duration-150 group-hover:stroke-white group-hover:stroke-[3.5px]"
                />

                {/* Length marker on wire center */}
                <g
                  transform={`translate(${(fromEl.position.x + toEl.position.x) / 2}, ${(fromEl.position.y + toEl.position.y) / 2})`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                >
                  <rect
                    x="-28"
                    y="-9"
                    width="56"
                    height="18"
                    rx="4"
                    fill="rgba(15, 23, 42, 0.95)"
                    stroke={wireColor}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3"
                    fontSize="8.5"
                    fill="#f8fafc"
                    textAnchor="middle"
                    fontWeight="600"
                    className="font-mono tabular-nums"
                  >
                    {wire.calculatedLengthM} м
                  </text>
                </g>
              </g>
            );
          })}

          {/* ----------------- IN-PROGRESS WIRE CONNECTION ----------------- */}
          {wireSourceElementId && (
            (() => {
              const srcEl = project.elements.find((e) => e.id === wireSourceElementId);
              if (!srcEl) return null;
              return (
                <path
                  d={generateCurvedWirePath(srcEl.position, mouseWorldPos, 0.2)}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  className="pointer-events-none animate-pulse"
                />
              );
            })()
          )}

          {/* ----------------- IN-PROGRESS WALL DRAWING ----------------- */}
          {wallStartPoint && (
            (() => {
              const currentP = gridSnapEnabled ? snapPointToGrid(mouseWorldPos, 10) : mouseWorldPos;
              const lenMm = pxToMm(distance(wallStartPoint, currentP));
              return (
                <g className="pointer-events-none">
                  <line
                    x1={wallStartPoint.x}
                    y1={wallStartPoint.y}
                    x2={currentP.x}
                    y2={currentP.y}
                    stroke="#38bdf8"
                    strokeWidth="15"
                    strokeDasharray="6 4"
                    strokeLinecap="square"
                  />
                  <g transform={`translate(${(wallStartPoint.x + currentP.x) / 2}, ${(wallStartPoint.y + currentP.y) / 2})`}>
                    <rect x="-30" y="-10" width="60" height="20" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                    <text x="0" y="4" fontSize="10" fill="#38bdf8" textAnchor="middle" fontWeight="bold" className="font-mono tabular-nums">
                      {lenMm} мм
                    </text>
                  </g>
                </g>
              );
            })()
          )}

          {/* ----------------- IN-PROGRESS MEASURE TOOL ----------------- */}
          {measureStartPoint && (
            (() => {
              const distMm = pxToMm(distance(measureStartPoint, mouseWorldPos));
              return (
                <g className="pointer-events-none">
                  <line
                    x1={measureStartPoint.x}
                    y1={measureStartPoint.y}
                    x2={mouseWorldPos.x}
                    y2={mouseWorldPos.y}
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />
                  <circle cx={measureStartPoint.x} cy={measureStartPoint.y} r="4" fill="#fbbf24" />
                  <circle cx={mouseWorldPos.x} cy={mouseWorldPos.y} r="4" fill="#fbbf24" />
                  <g transform={`translate(${(measureStartPoint.x + mouseWorldPos.x) / 2}, ${(measureStartPoint.y + mouseWorldPos.y) / 2 - 12})`}>
                    <rect x="-35" y="-10" width="70" height="20" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#fbbf24" strokeWidth="1" />
                    <text x="0" y="4" fontSize="10" fill="#fbbf24" textAnchor="middle" fontWeight="600" className="font-mono tabular-nums">
                      {(distMm / 1000).toFixed(2)} м ({distMm} мм)
                    </text>
                  </g>
                </g>
              );
            })()
          )}

          {/* ----------------- ELECTRICAL ELEMENTS LAYER ----------------- */}
          {filteredElements.map((el) => {
            const isSelected = selectedElementId === el.id;
            const circuit = project.circuits.find((c) => c.id === el.circuitId);
            const elColor = circuit?.color || (el.category === 'light' ? '#f59e0b' : '#38bdf8');

            return (
              <g
                key={el.id}
                transform={`translate(${el.position.x}, ${el.position.y}) rotate(${el.rotation})`}
                onPointerDown={(e) => handleElementPointerDown(e, el)}
              >
                <ElectricalSymbol
                  type={el.type}
                  size={26}
                  isGost={true}
                  color={elColor}
                  isSelected={isSelected}
                  label={el.switchGroupId || el.label}
                  mountingHeightMm={el.mountingHeightMm}
                  showHeightTag={showHeights}
                />

                {/* Circuit badge (e.g. Гр.3) */}
                {circuit && (
                  <text
                    x="0"
                    y="-16"
                    fontSize="7"
                    fill={circuit.color}
                    fontWeight="700"
                    textAnchor="middle"
                    className="pointer-events-none font-mono drop-shadow"
                  >
                    Гр.{circuit.number}
                  </text>
                )}
              </g>
            );
          })}

          {/* ----------------- HOVER PREVIEW FOR NEW ELEMENT PLACEMENT ----------------- */}
          {['socket', 'switch', 'light', 'panel', 'junction'].includes(activeTool) &&
            selectedCatalogItem && (
              (() => {
                const effectivePos = gridSnapEnabled ? snapPointToGrid(mouseWorldPos, 10) : mouseWorldPos;
                const wallSnap = snapToNearestWall(effectivePos, project.walls, 25);
                const previewPos = wallSnap ? wallSnap.snappedPoint : effectivePos;
                const previewRot = wallSnap ? wallSnap.rotation : 0;

                return (
                  <g
                    transform={`translate(${previewPos.x}, ${previewPos.y}) rotate(${previewRot})`}
                    className="pointer-events-none opacity-80"
                  >
                    <ElectricalSymbol
                      type={selectedCatalogItem.type}
                      size={26}
                      isGost={true}
                      color="#38bdf8"
                      isSelected={false}
                      mountingHeightMm={selectedCatalogItem.defaultHeightMm}
                      showHeightTag={true}
                    />
                    {wallSnap && (
                      <circle cx="0" cy="0" r="18" fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="3 2" />
                    )}
                  </g>
                );
              })()
          )}
        </g>
      </svg>

      {/* Floating Canvas Quick Controls (Zoom, Reset, Coordinates) */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 text-xs text-neutral-300 shadow-xl">
        <span className="font-mono tabular-nums text-neutral-400">
          X: {pxToMm(mouseWorldPos.x)} мм · Y: {pxToMm(mouseWorldPos.y)} мм
        </span>
        <span className="text-neutral-600">|</span>
        <span className="font-mono tabular-nums text-neutral-300">
          {Math.round(transform.k * 100)}%
        </span>
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={() => setTransform((prev) => ({ ...prev, k: Math.min(prev.k * 1.2, 4) }))}
            className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
            title="Збільшити (+)"
          >
            +
          </button>
          <button
            onClick={() => setTransform((prev) => ({ ...prev, k: Math.max(prev.k * 0.8, 0.3) }))}
            className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
            title="Зменшити (-)"
          >
            -
          </button>
          <button
            onClick={() => setTransform({ x: 120, y: 80, k: 1.1 })}
            className="px-2 h-6 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors text-[11px]"
            title="Скинути масштаб і положення"
          >
            100%
          </button>
        </div>
      </div>
    </div>
  );
};
