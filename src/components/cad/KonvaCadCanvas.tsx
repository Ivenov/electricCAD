import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Stage,
  Layer,
  Line,
  Rect,
  Circle,
  Text,
  Group,
  Arc,
  Transformer,
  Image as KonvaImage,
} from 'react-konva';
import Konva from 'konva';
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
import { KonvaElectricalSymbol } from './KonvaSymbols';
import {
  distance,
  pxToMm,
  mmToPx,
  snapPointToGrid,
  snapToNearestWall,
  calculateCableLengthM,
  MM_PER_PX,
  snapToWallGeometry,
  snapAngleOrtho,
  findWallOpeningPlacement,
  WallSnapResult,
} from '../../utils/cadMath';
import { CatalogItem } from '../../data/electricalCatalog';
import { OpeningCatalogItem } from '../../data/openingsCatalog';

interface KonvaCadCanvasProps {
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
  onUpdateBackgroundImage?: (updates: Partial<NonNullable<CadProject['backgroundImage']>>) => void;
}

export const KonvaCadCanvas: React.FC<KonvaCadCanvasProps> = ({
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
  onUpdateBackgroundImage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Canvas size
  const [stageDimensions, setStageDimensions] = useState({ width: 1200, height: 800 });

  // Pan & Zoom
  const [scale, setScale] = useState(1.05);
  const [stagePos, setStagePos] = useState<Point>({ x: 100, y: 70 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Tool states
  const [wallStartPoint, setWallStartPoint] = useState<Point | null>(null);
  const [wireSourceElementId, setWireSourceElementId] = useState<string | null>(null);
  const [measureStartPoint, setMeasureStartPoint] = useState<Point | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<Point>({ x: 0, y: 0 });

  // Advanced Wall Snapping & Openings states
  const [wallSnapResult, setWallSnapResult] = useState<WallSnapResult | null>(null);
  const [activeOrtho, setActiveOrtho] = useState<{ point: Point; angleDeg: number; isSnapped: boolean } | null>(null);
  const [openingHoverPlacement, setOpeningHoverPlacement] = useState<ReturnType<typeof findWallOpeningPlacement> | null>(null);

  // Background image element
  const [bgHtmlImage, setBgHtmlImage] = useState<HTMLImageElement | null>(null);

  // Resize listener
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setStageDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Load background blueprint image if provided
  useEffect(() => {
    if (project.backgroundImage?.dataUrl) {
      const img = new window.Image();
      img.src = project.backgroundImage.dataUrl;
      img.onload = () => setBgHtmlImage(img);
    } else {
      setBgHtmlImage(null);
    }
  }, [project.backgroundImage?.dataUrl]);

  // Spacebar pan and shortcuts listener
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

  // Attach transformer to selected element
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    if (selectedElementId) {
      const selectedNode = stageRef.current.findOne(`#el_${selectedElementId}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    transformerRef.current.nodes([]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedElementId]);

  // Wheel zoom centered on pointer
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const zoomFactor = e.evt.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.min(Math.max(oldScale * zoomFactor, 0.25), 4.5);

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setScale(newScale);
    setStagePos(newPos);
  };

  // Convert stage pointer to world coordinates
  const getWorldPointerPos = (): Point => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };
    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };
  };

  // Helper to place opening (door/window)
  const handlePlaceOpening = useCallback(() => {
    if (!openingHoverPlacement) return false;
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
    return true;
  }, [openingHoverPlacement, activeTool, selectedOpeningPreset, onAddOpening, onSelectOpening]);

  // Stage pointer move
  const handleStagePointerMove = () => {
    const worldPos = getWorldPointerPos();
    setMouseWorldPos(worldPos);

    if (activeTool === 'wall') {
      // 1. Magnetic geometry snap
      const snap = snapToWallGeometry(worldPos, project.walls, 25);
      setWallSnapResult(snap);

      if (wallStartPoint) {
        if (!snap) {
          // Ortho angle snap (every 45 degrees)
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

  // Stage click (canvas background or placing elements)
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Door / Window placement on stage click near a wall
    if ((activeTool === 'door' || activeTool === 'window') && openingHoverPlacement) {
      handlePlaceOpening();
      return;
    }

    // If clicked on empty space (Stage target)
    if (e.target === stageRef.current) {
      const worldPos = getWorldPointerPos();

      // 1. WALL TOOL (with magnetic snapping and chaining)
      if (activeTool === 'wall') {
        let effectivePos = worldPos;
        if (wallSnapResult) {
          effectivePos = wallSnapResult.snappedPoint;
        } else if (activeOrtho?.isSnapped) {
          effectivePos = activeOrtho.point;
        } else if (gridSnapEnabled) {
          effectivePos = snapPointToGrid(worldPos, 10);
        }

        if (!wallStartPoint) {
          setWallStartPoint(effectivePos);
        } else {
          // Avoid creating walls with negligible length
          if (distance(wallStartPoint, effectivePos) > 4) {
            const newWall: Wall = {
              id: 'wall_' + Date.now(),
              start: wallStartPoint,
              end: effectivePos,
              thickness: 150,
              type: 'partition',
            };
            onAddWall(newWall);
            // Continuous wall chaining: next wall starts where previous ended
            setWallStartPoint(effectivePos);
          }
        }
        return;
      }

      const effectivePos = gridSnapEnabled ? snapPointToGrid(worldPos, 10) : worldPos;

      // 2. MEASURE TOOL
      if (activeTool === 'measure') {
        if (!measureStartPoint) {
          setMeasureStartPoint(effectivePos);
        } else {
          setMeasureStartPoint(null);
        }
        return;
      }

      // 3. PLACING NEW ELECTRICAL ELEMENT
      if (
        ['socket', 'switch', 'light', 'panel', 'junction'].includes(activeTool) &&
        selectedCatalogItem
      ) {
        let finalPos = effectivePos;
        let finalRotation = 0;
        let finalWallId: string | undefined = undefined;

        // Auto snap to nearest wall
        const wallSnap = snapToNearestWall(effectivePos, project.walls, 25);
        if (wallSnap) {
          finalPos = wallSnap.snappedPoint;
          finalRotation = wallSnap.rotation;
          finalWallId = wallSnap.wallId;
        }

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

      // Deselect if clicked on empty canvas in select mode
      if (activeTool === 'select') {
        onSelectElement(null);
        onSelectWall(null);
        onSelectOpening?.(null);
      }
    }
  };

  // Electrical element click / tap handler
  const handleElementClick = (e: Konva.KonvaEventObject<MouseEvent>, el: ElectricalElement) => {
    e.cancelBubble = true;

    // WIRE ROUTING TOOL (jsPlumb / LeaderLine style connection)
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
            'ceiling'
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

    // SELECT TOOL: Select element
    if (activeTool === 'select') {
      onSelectElement(el.id);
      onSelectWall(null);
    }
  };

  // Element Drag End
  const handleElementDragEnd = (e: Konva.KonvaEventObject<DragEvent>, el: ElectricalElement) => {
    let targetPos = { x: e.target.x(), y: e.target.y() };
    if (gridSnapEnabled) {
      targetPos = snapPointToGrid(targetPos, 10);
    }

    const wallSnap = snapToNearestWall(targetPos, project.walls, 25);
    if (wallSnap) {
      onUpdateElementPosition(el.id, wallSnap.snappedPoint, wallSnap.rotation, wallSnap.wallId);
    } else {
      onUpdateElementPosition(el.id, targetPos);
    }
  };

  // Wall map for fast lookup
  const wallMap = useMemo(() => {
    const map = new Map<string, Wall>();
    project.walls.forEach((w) => map.set(w.id, w));
    return map;
  }, [project.walls]);

  // Filter visible elements
  const filteredElements = useMemo(() => {
    return project.elements.filter((el) => {
      if (viewFilter === 'all') return true;
      if (viewFilter === 'sockets') return el.category === 'socket' || el.category === 'panel' || el.category === 'appliance';
      if (viewFilter === 'lighting') return el.category === 'light' || el.category === 'switch' || el.category === 'panel';
      return true;
    });
  }, [project.elements, viewFilter]);

  // Filter visible wires
  const filteredWires = useMemo(() => {
    if (viewFilter === 'sockets') return project.wires.filter((w) => w.cableType !== 'VVGng_3x1.5');
    if (viewFilter === 'lighting') return project.wires.filter((w) => w.cableType === 'VVGng_3x1.5' || w.mode === 'curve');
    return project.wires;
  }, [project.wires, viewFilter]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none cad-grid-dark ${
        isSpacePressed || activeTool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'
      }`}
    >
      <Stage
        ref={stageRef}
        width={stageDimensions.width}
        height={stageDimensions.height}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={activeTool === 'pan' || isSpacePressed}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onMouseMove={handleStagePointerMove}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
      >
        {/* ======================================================== */}
        {/* LAYER 1: GRID & COORDINATE AXES                          */}
        {/* ======================================================== */}
        <Layer id="gridLayer" listening={false}>
          {/* Major Grid Axes (every 1000mm = 100px) */}
          {Array.from({ length: 40 }).map((_, i) => {
            const coord = (i - 10) * 100;
            return (
              <React.Fragment key={`axis_${i}`}>
                <Line
                  points={[coord, -1000, coord, 3000]}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                />
                <Line
                  points={[-1000, coord, 3000, coord]}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                />
                {i % 2 === 0 && (
                  <Text
                    x={coord + 2}
                    y={2}
                    text={`${coord * 10}`}
                    fontSize={7.5}
                    fill="rgba(255,255,255,0.2)"
                    fontFamily="monospace"
                  />
                )}
              </React.Fragment>
            );
          })}
        </Layer>

        {/* ======================================================== */}
        {/* LAYER 2: BACKGROUND BLUEPRINT PLAN (CUSTOM IMAGE)        */}
        {/* ======================================================== */}
        <Layer id="backgroundBlueprintLayer">
          {bgHtmlImage && project.backgroundImage && (
            <KonvaImage
              image={bgHtmlImage}
              x={project.backgroundImage.x}
              y={project.backgroundImage.y}
              scaleX={project.backgroundImage.scaleX ?? project.backgroundImage.scale}
              scaleY={project.backgroundImage.scaleY ?? project.backgroundImage.scale}
              rotation={project.backgroundImage.rotation ?? 0}
              opacity={project.backgroundImage.opacity}
              draggable={!project.backgroundImage.locked}
              onDragEnd={(e) => {
                onUpdateBackgroundImage?.({
                  x: Math.round(e.target.x()),
                  y: Math.round(e.target.y()),
                });
              }}
            />
          )}
        </Layer>

        {/* ======================================================== */}
        {/* LAYER 3: ARCHITECTURAL PLAN (ROOMS, WALLS, DOORS, MEBEL) */}
        {/* ======================================================== */}
        <Layer id="architecturePlanLayer">
          {/* Rooms with areas */}
          {project.rooms.map((room) => {
            const flatPoints = room.points.flatMap((p) => [p.x, p.y]);
            const avgX = room.points.reduce((sum, p) => sum + p.x, 0) / room.points.length;
            const avgY = room.points.reduce((sum, p) => sum + p.y, 0) / room.points.length;

            return (
              <Group key={room.id} listening={false}>
                <Line
                  points={flatPoints}
                  closed
                  fill={
                    room.type === 'bathroom'
                      ? 'rgba(6, 182, 212, 0.05)'
                      : room.type === 'kitchen'
                      ? 'rgba(245, 158, 11, 0.04)'
                      : 'rgba(255, 255, 255, 0.02)'
                  }
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeWidth={1}
                />
                {/* Room label badge */}
                <Group x={avgX} y={avgY}>
                  <Rect
                    x={-55}
                    y={-17}
                    width={110}
                    height={34}
                    cornerRadius={5}
                    fill="#0f172a"
                    stroke="rgba(255, 255, 255, 0.12)"
                    strokeWidth={1}
                  />
                  <Text
                    x={-50}
                    y={-12}
                    width={100}
                    text={room.name}
                    fontSize={11}
                    fontStyle="bold"
                    fill="#e2e8f0"
                    align="center"
                  />
                  <Text
                    x={-50}
                    y={2}
                    width={100}
                    text={`${room.areaM2.toFixed(1)} м²`}
                    fontSize={9.5}
                    fill="#94a3b8"
                    fontFamily="monospace"
                    align="center"
                  />
                </Group>
              </Group>
            );
          })}

          {/* Furniture Blocks */}
          {showFurniture &&
            project.furniture.map((item) => {
              const halfW = item.width / 20;
              const halfH = item.height / 20;

              return (
                <Group
                  key={item.id}
                  x={item.position.x}
                  y={item.position.y}
                  rotation={item.rotation}
                  opacity={0.4}
                  listening={false}
                >
                  <Rect
                    x={-halfW}
                    y={-halfH}
                    width={halfW * 2}
                    height={halfH * 2}
                    cornerRadius={4}
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth={1.5}
                  />
                  <Text
                    x={-halfW}
                    y={-4}
                    width={halfW * 2}
                    text={item.name}
                    fontSize={8}
                    fill="#94a3b8"
                    align="center"
                  />
                </Group>
              );
            })}

          {/* Walls */}
          {project.walls.map((wall) => {
            const isSelected = selectedWallId === wall.id;
            const wallLengthMm = pxToMm(distance(wall.start, wall.end));
            const strokeW = wall.thickness / MM_PER_PX;

            return (
              <Group
                key={wall.id}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if ((activeTool === 'door' || activeTool === 'window') && openingHoverPlacement) {
                    handlePlaceOpening();
                    return;
                  }
                  if (activeTool === 'select') {
                    onSelectWall(wall.id);
                    onSelectElement(null);
                    onSelectOpening?.(null);
                  }
                }}
              >
                {/* Wall core */}
                <Line
                  points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
                  stroke={isSelected ? '#38bdf8' : wall.type === 'bearing' ? '#334155' : '#475569'}
                  strokeWidth={strokeW}
                  lineCap="square"
                />
                {/* Wall hairline boundary */}
                <Line
                  points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
                  stroke={isSelected ? '#7dd3fc' : '#64748b'}
                  strokeWidth={1}
                />

                {/* Wall length dimension tag */}
                {showDimensions && wallLengthMm > 400 && (
                  <Group
                    x={(wall.start.x + wall.end.x) / 2}
                    y={(wall.start.y + wall.end.y) / 2}
                    listening={false}
                  >
                    <Rect
                      x={-24}
                      y={-8}
                      width={48}
                      height={16}
                      cornerRadius={3}
                      fill="#0f172a"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth={0.8}
                    />
                    <Text
                      x={-24}
                      y={-5}
                      width={48}
                      text={`${wallLengthMm}`}
                      fontSize={9}
                      fill="#e2e8f0"
                      fontFamily="monospace"
                      align="center"
                    />
                  </Group>
                )}
              </Group>
            );
          })}

          {/* Openings (Doors & Windows) */}
          {project.openings.map((op) => {
            const wall = wallMap.get(op.wallId);
            if (!wall) return null;

            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const wallLen = Math.hypot(dx, dy);
            if (wallLen === 0) return null;

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
              <Group
                key={op.id}
                x={posX}
                y={posY}
                rotation={angleDeg}
                listening={true}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onSelectOpening?.(op.id);
                  onSelectElement(null);
                  onSelectWall(null);
                }}
              >
                {/* Wall cutout (punches hole through wall) */}
                <Rect
                  x={-halfOpPx}
                  y={-wallThickPx / 2 - 1}
                  width={halfOpPx * 2}
                  height={wallThickPx + 2}
                  fill="#0c0e14"
                />

                {/* Selection highlight aura */}
                {isSelected && (
                  <Rect
                    x={-halfOpPx - 4}
                    y={-wallThickPx / 2 - 8}
                    width={halfOpPx * 2 + 8}
                    height={wallThickPx + 16}
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                    dash={[4, 2]}
                    cornerRadius={2}
                    fill="rgba(56, 189, 248, 0.08)"
                  />
                )}

                {op.type === 'door' ? (
                  <Group scaleX={flipX} scaleY={flipY}>
                    <Circle x={-halfOpPx} y={0} radius={2.5} fill={isSelected ? '#38bdf8' : '#94a3b8'} />
                    <Circle x={halfOpPx} y={0} radius={2.5} fill={isSelected ? '#38bdf8' : '#94a3b8'} />
                    {/* Door jamb stops */}
                    <Line points={[-halfOpPx, -wallThickPx / 2, -halfOpPx, wallThickPx / 2]} stroke="#64748b" strokeWidth={1.5} />
                    <Line points={[halfOpPx, -wallThickPx / 2, halfOpPx, wallThickPx / 2]} stroke="#64748b" strokeWidth={1.5} />
                    {/* 90 deg swing arc */}
                    <Arc
                      x={-halfOpPx}
                      y={0}
                      innerRadius={0}
                      outerRadius={halfOpPx * 2}
                      angle={90}
                      rotation={-90}
                      stroke={isSelected ? '#38bdf8' : '#0284c7'}
                      strokeWidth={1.2}
                      dash={[3, 2]}
                    />
                    {/* Door leaf */}
                    <Line
                      points={[-halfOpPx, 0, halfOpPx, -halfOpPx * 2]}
                      stroke={isSelected ? '#7dd3fc' : '#cbd5e1'}
                      strokeWidth={2.5}
                    />
                  </Group>
                ) : (
                  <Group>
                    {/* Window sill and jambs */}
                    <Line points={[-halfOpPx, -wallThickPx / 2, -halfOpPx, wallThickPx / 2]} stroke="#64748b" strokeWidth={1.5} />
                    <Line points={[halfOpPx, -wallThickPx / 2, halfOpPx, wallThickPx / 2]} stroke="#64748b" strokeWidth={1.5} />
                    {/* Exterior and interior frame lines */}
                    <Line points={[-halfOpPx, -wallThickPx / 3, halfOpPx, -wallThickPx / 3]} stroke={isSelected ? '#38bdf8' : '#60a5fa'} strokeWidth={1.5} />
                    <Line points={[-halfOpPx, wallThickPx / 3, halfOpPx, wallThickPx / 3]} stroke={isSelected ? '#38bdf8' : '#60a5fa'} strokeWidth={1.5} />
                    {/* Center glass pane */}
                    <Line points={[-halfOpPx, 0, halfOpPx, 0]} stroke={isSelected ? '#7dd3fc' : '#93c5fd'} strokeWidth={2.5} />
                  </Group>
                )}

                {/* Dimension badge if selected */}
                {isSelected && (
                  <Group y={-wallThickPx / 2 - 16}>
                    <Rect x={-26} y={-7} width={52} height={14} cornerRadius={3} fill="#0f172a" stroke="#38bdf8" strokeWidth={0.8} />
                    <Text x={-26} y={-5} width={52} text={`${op.width} мм`} fontSize={8.5} fill="#38bdf8" fontFamily="monospace" align="center" />
                  </Group>
                )}
              </Group>
            );
          })}
        </Layer>

        {/* ======================================================== */}
        {/* LAYER 4: WIRING & CONNECTIONS (jsPlumb / LeaderLine)     */}
        {/* ======================================================== */}
        <Layer id="wiresConnectionsLayer">
          {filteredWires.map((wire) => {
            const fromEl = project.elements.find((e) => e.id === wire.fromId);
            const toEl = project.elements.find((e) => e.id === wire.toId);
            if (!fromEl || !toEl) return null;

            const circuit = project.circuits.find((c) => c.id === wire.circuitId);
            const wireColor = circuit?.color || (wire.mode === 'curve' ? '#fbbf24' : '#38bdf8');
            const isLighting = wire.mode === 'curve';

            // Calculate bezier control point or ortho path
            const midX = (fromEl.position.x + toEl.position.x) / 2;
            const midY = (fromEl.position.y + toEl.position.y) / 2;
            const dx = toEl.position.x - fromEl.position.x;
            const dy = toEl.position.y - fromEl.position.y;
            const dist = Math.hypot(dx, dy);
            const nx = -dy / (dist || 1);
            const ny = dx / (dist || 1);
            const ctrlX = midX + nx * dist * 0.22;
            const ctrlY = midY + ny * dist * 0.22;

            return (
              <Group key={wire.id}>
                {/* jsPlumb-style Anchor Dots at terminals */}
                <Circle x={fromEl.position.x} y={fromEl.position.y} radius={3.5} fill={wireColor} />
                <Circle x={toEl.position.x} y={toEl.position.y} radius={3.5} fill={wireColor} />

                {/* Curved leader line / cable trace */}
                {isLighting ? (
                  <Line
                    points={[
                      fromEl.position.x,
                      fromEl.position.y,
                      ctrlX,
                      ctrlY,
                      toEl.position.x,
                      toEl.position.y,
                    ]}
                    bezier
                    stroke={wireColor}
                    strokeWidth={2}
                    dash={[4, 3]}
                    lineCap="round"
                  />
                ) : (
                  <Line
                    points={[
                      fromEl.position.x,
                      fromEl.position.y,
                      midX,
                      fromEl.position.y,
                      midX,
                      toEl.position.y,
                      toEl.position.x,
                      toEl.position.y,
                    ]}
                    stroke={wireColor}
                    strokeWidth={2.8}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}

                {/* Cable length badge */}
                <Group x={midX} y={midY - 10} listening={false}>
                  <Rect
                    x={-28}
                    y={-8}
                    width={56}
                    height={16}
                    cornerRadius={3}
                    fill="#0f172a"
                    stroke={wireColor}
                    strokeWidth={0.8}
                  />
                  <Text
                    x={-28}
                    y={-5}
                    width={56}
                    text={`${wire.calculatedLengthM} м`}
                    fontSize={8.5}
                    fontStyle="bold"
                    fill="#f8fafc"
                    fontFamily="monospace"
                    align="center"
                  />
                </Group>
              </Group>
            );
          })}

          {/* In-progress wire connection to cursor */}
          {wireSourceElementId &&
            (() => {
              const srcEl = project.elements.find((e) => e.id === wireSourceElementId);
              if (!srcEl) return null;
              return (
                <Group listening={false}>
                  <Circle x={srcEl.position.x} y={srcEl.position.y} radius={5} fill="#38bdf8" />
                  <Line
                    points={[
                      srcEl.position.x,
                      srcEl.position.y,
                      (srcEl.position.x + mouseWorldPos.x) / 2,
                      (srcEl.position.y + mouseWorldPos.y) / 2 - 20,
                      mouseWorldPos.x,
                      mouseWorldPos.y,
                    ]}
                    bezier
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dash={[4, 2]}
                  />
                </Group>
              );
            })()}
        </Layer>

        {/* ======================================================== */}
        {/* LAYER 5: INTERACTIVE ELECTRICAL SYMBOLS                  */}
        {/* ======================================================== */}
        <Layer id="elementsLayer">
          {filteredElements.map((el) => {
            const isSelected = selectedElementId === el.id;
            const circuit = project.circuits.find((c) => c.id === el.circuitId);
            const elColor = circuit?.color || (el.category === 'light' ? '#f59e0b' : '#38bdf8');

            return (
              <Group
                key={el.id}
                id={`el_${el.id}`}
                x={el.position.x}
                y={el.position.y}
                rotation={el.rotation}
                draggable={activeTool === 'select'}
                onClick={(e) => handleElementClick(e, el)}
                onDragEnd={(e) => handleElementDragEnd(e, el)}
              >
                <KonvaElectricalSymbol
                  type={el.type}
                  size={26}
                  color={elColor}
                  isSelected={isSelected}
                  label={el.switchGroupId || el.label}
                  mountingHeightMm={el.mountingHeightMm}
                  showHeightTag={showHeights}
                  circuitNumber={circuit?.number}
                  isBackupPriority={Boolean(el.isBackupPriority || circuit?.isBackupPriority)}
                />
              </Group>
            );
          })}
        </Layer>

        {/* ======================================================== */}
        {/* LAYER 6: TRANSFORMER & IN-PROGRESS TOOLS                 */}
        {/* ======================================================== */}
        <Layer id="overlayLayer">
          {/* Konva Transformer for selected element rotation & manipulation */}
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            enabledAnchors={[]} // Only allow rotation handle, no arbitrary resizing
            borderStroke="#38bdf8"
            borderDash={[3, 3]}
            anchorFill="#38bdf8"
            anchorSize={8}
            onTransformEnd={() => {
              if (selectedElementId && stageRef.current) {
                const node = stageRef.current.findOne(`#el_${selectedElementId}`);
                if (node) {
                  onUpdateElementPosition(selectedElementId, { x: node.x(), y: node.y() }, Math.round(node.rotation() / 15) * 15);
                }
              }
            }}
          />

          {/* Magnetic Geometry Snap Marker */}
          {wallSnapResult && activeTool === 'wall' && (
            <Group x={wallSnapResult.snappedPoint.x} y={wallSnapResult.snappedPoint.y} listening={false}>
              <Circle
                radius={8}
                stroke={wallSnapResult.snapType === 'endpoint' ? '#10b981' : wallSnapResult.snapType === 'midpoint' ? '#a855f7' : '#06b6d4'}
                strokeWidth={2}
                fill={wallSnapResult.snapType === 'endpoint' ? 'rgba(16, 185, 129, 0.2)' : wallSnapResult.snapType === 'midpoint' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(6, 182, 212, 0.2)'}
              />
              <Circle
                radius={3}
                fill={wallSnapResult.snapType === 'endpoint' ? '#10b981' : wallSnapResult.snapType === 'midpoint' ? '#a855f7' : '#06b6d4'}
              />
              <Group y={-18}>
                <Rect
                  x={-38}
                  y={-9}
                  width={76}
                  height={18}
                  cornerRadius={4}
                  fill="#0f172a"
                  stroke={wallSnapResult.snapType === 'endpoint' ? '#10b981' : wallSnapResult.snapType === 'midpoint' ? '#a855f7' : '#06b6d4'}
                  strokeWidth={1}
                />
                <Text
                  x={-38}
                  y={-5}
                  width={76}
                  text={
                    wallSnapResult.snapType === 'endpoint'
                      ? 'Кут стіни'
                      : wallSnapResult.snapType === 'midpoint'
                      ? 'Середина'
                      : 'Т-стик'
                  }
                  fontSize={9}
                  fontStyle="bold"
                  fill="#ffffff"
                  align="center"
                />
              </Group>
            </Group>
          )}

          {/* In-progress Door / Window placement preview */}
          {(activeTool === 'door' || activeTool === 'window') && openingHoverPlacement && (
            <Group
              x={openingHoverPlacement.position.x}
              y={openingHoverPlacement.position.y}
              rotation={openingHoverPlacement.rotation}
              listening={false}
            >
              {(() => {
                const halfW = mmToPx(selectedOpeningPreset?.widthMm || (activeTool === 'door' ? 900 : 1200)) / 2;
                const wallThickPx = openingHoverPlacement.wall.thickness / MM_PER_PX;
                return (
                  <Group>
                    {/* Ghost cutout preview */}
                    <Rect
                      x={-halfW}
                      y={-wallThickPx / 2 - 2}
                      width={halfW * 2}
                      height={wallThickPx + 4}
                      fill="rgba(16, 185, 129, 0.25)"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      dash={[3, 2]}
                    />
                    {activeTool === 'door' ? (
                      <Group>
                        <Arc
                          x={-halfW}
                          y={0}
                          innerRadius={0}
                          outerRadius={halfW * 2}
                          angle={90}
                          rotation={-90}
                          stroke="#10b981"
                          strokeWidth={1.5}
                          dash={[3, 2]}
                        />
                        <Line points={[-halfW, 0, halfW, -halfW * 2]} stroke="#10b981" strokeWidth={2} />
                      </Group>
                    ) : (
                      <Group>
                        <Line points={[-halfW, 0, halfW, 0]} stroke="#10b981" strokeWidth={2} />
                      </Group>
                    )}
                    {/* Floating dimension & info tag */}
                    <Group y={-wallThickPx / 2 - 20}>
                      <Rect x={-55} y={-9} width={110} height={18} cornerRadius={4} fill="#0f172a" stroke="#10b981" strokeWidth={1} />
                      <Text
                        x={-55}
                        y={-5}
                        width={110}
                        text={`${activeTool === 'door' ? 'Двері' : 'Вікно'} ${selectedOpeningPreset?.widthMm || (activeTool === 'door' ? 900 : 1200)} мм`}
                        fontSize={9}
                        fontStyle="bold"
                        fill="#10b981"
                        align="center"
                      />
                    </Group>
                  </Group>
                );
              })()}
            </Group>
          )}

          {/* In-progress Wall Drawing preview */}
          {wallStartPoint &&
            (() => {
              let currentP = mouseWorldPos;
              if (wallSnapResult) {
                currentP = wallSnapResult.snappedPoint;
              } else if (activeOrtho?.isSnapped) {
                currentP = activeOrtho.point;
              } else if (gridSnapEnabled) {
                currentP = snapPointToGrid(mouseWorldPos, 10);
              }

              const lenMm = pxToMm(distance(wallStartPoint, currentP));
              const angleDeg = Math.round((Math.atan2(currentP.y - wallStartPoint.y, currentP.x - wallStartPoint.x) * 180) / Math.PI);
              const normAngle = (angleDeg + 360) % 360;

              return (
                <Group listening={false}>
                  {/* Ortho Guide line */}
                  {activeOrtho?.isSnapped && (
                    <Line
                      points={[wallStartPoint.x, wallStartPoint.y, currentP.x, currentP.y]}
                      stroke="#06b6d4"
                      strokeWidth={1}
                      dash={[4, 4]}
                    />
                  )}
                  {/* Wall body preview */}
                  <Line
                    points={[wallStartPoint.x, wallStartPoint.y, currentP.x, currentP.y]}
                    stroke="#38bdf8"
                    strokeWidth={15}
                    dash={[6, 4]}
                    lineCap="square"
                  />
                  {/* Dimension badge */}
                  <Group x={(wallStartPoint.x + currentP.x) / 2} y={(wallStartPoint.y + currentP.y) / 2 - 18}>
                    <Rect x={-45} y={-10} width={90} height={20} cornerRadius={4} fill="#0f172a" stroke="#38bdf8" strokeWidth={1} />
                    <Text
                      x={-45}
                      y={-5}
                      width={90}
                      text={`${lenMm} мм  ${normAngle}°`}
                      fontSize={9.5}
                      fontStyle="bold"
                      fill="#38bdf8"
                      fontFamily="monospace"
                      align="center"
                    />
                  </Group>
                </Group>
              );
            })()}

          {/* In-progress Measure Ruler preview */}
          {measureStartPoint &&
            (() => {
              const distMm = pxToMm(distance(measureStartPoint, mouseWorldPos));
              return (
                <Group listening={false}>
                  <Line
                    points={[measureStartPoint.x, measureStartPoint.y, mouseWorldPos.x, mouseWorldPos.y]}
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    dash={[4, 2]}
                  />
                  <Circle x={measureStartPoint.x} y={measureStartPoint.y} radius={4} fill="#fbbf24" />
                  <Circle x={mouseWorldPos.x} y={mouseWorldPos.y} radius={4} fill="#fbbf24" />
                  <Group x={(measureStartPoint.x + mouseWorldPos.x) / 2} y={(measureStartPoint.y + mouseWorldPos.y) / 2 - 15}>
                    <Rect x={-35} y={-10} width={70} height={20} cornerRadius={4} fill="#0f172a" stroke="#fbbf24" strokeWidth={1} />
                    <Text x={-35} y={-5} width={70} text={`${distMm} мм`} fontSize={10} fontStyle="bold" fill="#fbbf24" fontFamily="monospace" align="center" />
                  </Group>
                </Group>
              );
            })()}
        </Layer>
      </Stage>

      {/* Floating Canvas Quick Controls (Zoom, Reset, Coordinates) */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 text-xs text-neutral-300 shadow-xl z-20">
        <span className="font-mono tabular-nums text-neutral-400">
          X: {pxToMm(mouseWorldPos.x)} мм · Y: {pxToMm(mouseWorldPos.y)} мм
        </span>
        <span className="text-neutral-600">|</span>
        <span className="font-mono tabular-nums text-neutral-300">
          {Math.round(scale * 100)}%
        </span>
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={() => setScale((prev) => Math.min(prev * 1.2, 4))}
            className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
            title="Приблизить (+)"
          >
            +
          </button>
          <button
            onClick={() => setScale((prev) => Math.max(prev * 0.8, 0.3))}
            className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
            title="Отдалить (-)"
          >
            -
          </button>
          <button
            onClick={() => {
              setScale(1.05);
              setStagePos({ x: 100, y: 70 });
            }}
            className="px-2 h-6 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors text-[11px]"
            title="Сбросить масштаб и положение"
          >
            100%
          </button>
        </div>
      </div>
    </div>
  );
};
