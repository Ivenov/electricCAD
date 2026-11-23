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
  Path as KonvaPath,
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
  LayerVisibilityConfig,
  ClientNote,
} from '../../types/cad';
import { detectGangBlocks, snapToGangPitch } from '../../utils/gangGrouping';
import { KonvaElectricalSymbol } from './KonvaSymbols';
import { KonvaFurnitureSymbol } from './KonvaFurnitureSymbols';
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
  getCableDisplayName,
  getCableCrossSection,
  computeParallelBundleOffsets,
  getLongestSegmentMidpoint,
  closestPointOnSegment,
  calculateWallLengthMm,
  setWallLengthMm,
  snapElementToDoorJambPue,
  JambSnapResult,
  analyzeElementWallDatum,
  computeCircuitBadgesLayout,
  alignWallOrtho,
  reverseWall,
  checkChaseIntersectsOpening,
} from '../../utils/cadMath';
import { computeOrthogonalPath } from '../../utils/autoRouting';
import { calculateWifiHeatmap, calculateCctvFovCones } from '../../utils/lowVoltageSimulation';
import { CatalogItem } from '../../data/electricalCatalog';
import { OpeningCatalogItem } from '../../data/openingsCatalog';
import { FurnitureCatalogItem } from '../../data/furnitureCatalog';
import { calculatePolygonAreaM2 } from '../../utils/roomGeometry';
import { formatDimensionValue, getUnitLabel } from '../../utils/projectAggregator';
import { ROOM_PRESETS } from '../toolbar/CadTools';
import { CadRuler } from './CadRuler';

interface KonvaCadCanvasProps {
  project: CadProject;
  activeTool: CadTool;
  selectedCatalogItem: CatalogItem | null;
  selectedElementId: string | null;
  selectedWallId: string | null;
  selectedOpeningId?: string | null;
  selectedOpeningPreset?: OpeningCatalogItem | null;
  selectedRoomType?: Room['type'];
  selectedWireId?: string | null;
  selectedFurnitureId?: string | null;
  onSelectFurniture?: (id: string | null) => void;
  selectedFurniturePreset?: FurnitureCatalogItem | null;
  onAddFurniture?: (item: FurnitureItem) => void;
  onUpdateFurniturePosition?: (id: string, newPos: Point, newRotation?: number) => void;
  onDeleteFurniture?: (id: string) => void;
  viewFilter: ViewFilterMode;
  showDimensions: boolean;
  showHeights: boolean;
  showFurniture: boolean;
  showAnnotations?: boolean;
  showCircuitBadges?: boolean;
  cadStyle?: 'autocad' | 'modern';
  layerVisibility?: LayerVisibilityConfig;
  onToggleAnnotations?: () => void;
  onToggleCircuitBadges?: () => void;
  onToggleCadStyle?: () => void;
  onOpenSwitchWiringDiagram?: (sw?: ElectricalElement) => void;
  onOpenLayersModal?: () => void;
  gridSnapEnabled: boolean;
  onSelectElement: (id: string | null) => void;
  onSelectWall: (id: string | null) => void;
  onSelectOpening?: (id: string | null) => void;
  onSelectWire?: (id: string | null) => void;
  onUpdateElementPosition: (id: string, newPos: Point, newRotation?: number, wallId?: string) => void;
  onAddElement: (element: ElectricalElement) => void;
  onAddWall: (wall: Wall) => void;
  onUpdateWall?: (wall: Wall) => void;
  onAddOpening?: (opening: WallOpening) => void;
  onDeleteOpening?: (id: string) => void;
  onAddRoom?: (room: Room) => void;
  onAddWire: (wire: WireRoute) => void;
  onUpdateWire?: (wire: WireRoute) => void;
  onDeleteWire?: (id: string) => void;
  onDeleteElement: (id: string) => void;
  onUpdateBackgroundImage?: (updates: Partial<NonNullable<CadProject['backgroundImage']>>) => void;
  linkingSwitchId?: string | null;
  onLinkSwitchToLuminaires?: (switchId: string, lightIds: string[]) => void;
  onChangeDisplayUnit?: (unit: 'mm' | 'cm' | 'm') => void;
  multiSelectedElementIds?: string[];
  onChangeMultiSelection?: (ids: string[]) => void;
  onMoveElementsBatch?: (updates: Array<{ id: string; position: Point; rotation?: number; wallId?: string }>) => void;
  onDeleteElementsBatch?: (ids: string[]) => void;
  onAlignElements?: (ids: string[], mode: 'align_x' | 'align_y' | 'pitch_71_h' | 'pitch_71_v') => void;
  onDuplicateElement?: (id: string) => void;
  onCopySelection?: () => void;
  onPasteClipboard?: () => void;
  canPaste?: boolean;
  onDeleteWall?: (id: string) => void;
  onOpenWallElevation?: (wallId?: string) => void;
  focusRequest?: { elementId: string; ts: number } | null;
  onStartCalibration?: (pointA: Point, pointB: Point, pixelDistance: number) => void;
  onAddClientNote?: (position: Point) => void;
  onSelectClientNote?: (noteId: string) => void;
}

export const KonvaCadCanvas: React.FC<KonvaCadCanvasProps> = ({
  project,
  activeTool,
  selectedCatalogItem,
  selectedElementId,
  selectedWallId,
  selectedOpeningId,
  selectedOpeningPreset,
  selectedRoomType = 'living',
  selectedWireId,
  selectedFurnitureId,
  onSelectFurniture,
  selectedFurniturePreset,
  onAddFurniture,
  onUpdateFurniturePosition,
  onDeleteFurniture,
  viewFilter,
  showDimensions,
  showHeights,
  showFurniture,
  showAnnotations = true,
  showCircuitBadges = true,
  cadStyle = 'autocad',
  layerVisibility,
  onToggleAnnotations,
  onToggleCircuitBadges,
  onToggleCadStyle,
  onOpenSwitchWiringDiagram,
  onOpenLayersModal,
  gridSnapEnabled,
  onSelectElement,
  onSelectWall,
  onSelectOpening,
  onSelectWire,
  onUpdateElementPosition,
  onAddElement,
  onAddWall,
  onUpdateWall,
  onAddOpening,
  onDeleteOpening,
  onAddRoom,
  onAddWire,
  onUpdateWire,
  onDeleteWire,
  onDeleteElement,
  onUpdateBackgroundImage,
  linkingSwitchId,
  onLinkSwitchToLuminaires,
  onChangeDisplayUnit,
  multiSelectedElementIds: externalMultiIds,
  onChangeMultiSelection,
  onMoveElementsBatch,
  onDeleteElementsBatch,
  onAlignElements,
  onDuplicateElement,
  onCopySelection,
  onPasteClipboard,
  onDeleteWall,
  onOpenWallElevation,
  focusRequest,
  onStartCalibration,
  onAddClientNote,
  onSelectClientNote,
}) => {
  const displayUnit = project.displayUnit || 'mm';
  const unitLabel = getUnitLabel(displayUnit);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Canvas size
  const [stageDimensions, setStageDimensions] = useState({ width: 1200, height: 800 });

  // Rulers state
  const [showRulers, setShowRulers] = useState(true);

  // Compute parallel bundle offsets so overlapping cables separate into parallel traces
  const bundleOffsetMap = useMemo(() => {
    return computeParallelBundleOffsets(
      project.wires,
      project.elements,
      project.walls,
      project.openings
    );
  }, [project.wires, project.elements, project.walls, project.openings]);

  // Non-overlapping Circuit Badges & Leader Lines for on-site installers
  const circuitBadgeLayouts = useMemo(() => {
    return computeCircuitBadgesLayout(project.elements, project.circuits, false);
  }, [project.elements, project.circuits]);

  // Pan & Zoom
  const [scale, setScale] = useState(1.05);
  const [stagePos, setStagePos] = useState<Point>({ x: 100, y: 70 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Tool states
  const [wallStartPoint, setWallStartPoint] = useState<Point | null>(null);
  const [wallDraftLengthInput, setWallDraftLengthInput] = useState<string>('');
  const [roomDraftPoints, setRoomDraftPoints] = useState<Point[]>([]);
  const [wireSourceElementId, setWireSourceElementId] = useState<string | null>(null);
  const [wireDraftPoints, setWireDraftPoints] = useState<Point[]>([]);
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);
  const [measureStartPoint, setMeasureStartPoint] = useState<Point | null>(null);
  const [calibrateStartPoint, setCalibrateStartPoint] = useState<Point | null>(null);
  const [mouseWorldPos, setMouseWorldPos] = useState<Point>({ x: 0, y: 0 });
  const [mouseScreenPos, setMouseScreenPos] = useState<Point>({ x: -100, y: -100 });
  const [isCursorInside, setIsCursorInside] = useState(false);

  // Smart Gang Grouping blocks
  const detectedGangBlocks = useMemo(() => detectGangBlocks(project.elements), [project.elements]);

  // Advanced Wall Snapping & Openings states
  const [wallSnapResult, setWallSnapResult] = useState<WallSnapResult | null>(null);
  const [activeOrtho, setActiveOrtho] = useState<{ point: Point; angleDeg: number; isSnapped: boolean } | null>(null);
  const [openingHoverPlacement, setOpeningHoverPlacement] = useState<ReturnType<typeof findWallOpeningPlacement> | null>(null);
  const [activeJambSnap, setActiveJambSnap] = useState<JambSnapResult | null>(null);

  // Wi-Fi Heatmap & CCTV FOV Simulations
  const wifiHeatmapPoints = useMemo(() => {
    if (!layerVisibility?.wifiHeatmap) return [];
    return calculateWifiHeatmap(project, 30);
  }, [project, layerVisibility?.wifiHeatmap]);

  const cctvFovCones = useMemo(() => {
    if (layerVisibility?.cctvFov === false) return [];
    return calculateCctvFovCones(project);
  }, [project, layerVisibility?.cctvFov]);

  // Rubberband Box Marquee Selection (synced with App if provided)
  const [boxSelectionStart, setBoxSelectionStart] = useState<Point | null>(null);
  const [boxSelectionEnd, setBoxSelectionEnd] = useState<Point | null>(null);
  const [localMultiIds, setLocalMultiIds] = useState<string[]>([]);
  const multiSelectedElementIds = externalMultiIds ?? localMultiIds;
  const setMultiSelectedElementIds = useCallback(
    (next: string[]) => {
      if (onChangeMultiSelection) onChangeMultiSelection(next);
      else setLocalMultiIds(next);
    },
    [onChangeMultiSelection]
  );

  // Group Drag origin tracking
  const dragGroupRef = useRef<{
    anchorId: string;
    anchorStartPos: Point;
    initialPositions: Map<string, Point>;
  } | null>(null);

  // Right-click Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetType: 'element' | 'wire' | 'wall' | 'multi' | 'canvas';
    targetId?: string;
  } | null>(null);

  // Focus viewport on element when triggered by quick search
  useEffect(() => {
    if (!focusRequest) return;
    const target = project.elements.find((e) => e.id === focusRequest.elementId);
    if (!target) return;
    const targetScale = Math.max(scale, 1.15);
    setScale(targetScale);
    setStagePos({
      x: Math.round(stageDimensions.width / 2 - target.position.x * targetScale),
      y: Math.round(stageDimensions.height / 2 - target.position.y * targetScale),
    });
  }, [focusRequest?.elementId, focusRequest?.ts]);

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

  // Helper to complete a wire connection between two elements with custom waypoints
  const completeWireConnection = useCallback(
    (fromEl: ElectricalElement, toEl: ElectricalElement, customWaypoints?: Point[]) => {
      // PUE Rule: Sockets and Switches / Luminaires must NEVER be connected together
      const isSocketFrom = fromEl.category === 'socket';
      const isSocketTo = toEl.category === 'socket';
      const isSwitchOrLightFrom = fromEl.category === 'switch' || fromEl.category === 'light';
      const isSwitchOrLightTo = toEl.category === 'switch' || toEl.category === 'light';

      if ((isSocketFrom && isSwitchOrLightTo) || (isSwitchOrLightFrom && isSocketTo)) {
        console.warn('PUE Violation: Sockets cannot be directly wired to switches or luminaires.');
        setWireSourceElementId(null);
        setWireDraftPoints([]);
        return;
      }

      const isLightingControl =
        (fromEl.category === 'switch' && toEl.category === 'light') ||
        (fromEl.category === 'light' && toEl.category === 'switch') ||
        (fromEl.category === 'light' && toEl.category === 'light');

      const waypoints =
        customWaypoints && customWaypoints.length > 1
          ? [...customWaypoints, toEl.position]
          : computeOrthogonalPath(fromEl.position, toEl.position, project.walls, project.openings);

      const wireLength = calculateCableLengthM(
        fromEl,
        toEl,
        project.ceilingHeightMm,
        'ceiling',
        isLightingControl ? undefined : waypoints
      );

      const matchedCircuit = project.circuits.find(
        (c) => c.id === (toEl.circuitId || fromEl.circuitId)
      );

      const circuitWiresCount =
        project.wires.filter((w) => w.circuitId === matchedCircuit?.id).length + 1;

      const cableTag = matchedCircuit
        ? `W${matchedCircuit.number}-${circuitWiresCount < 10 ? '0' : ''}${circuitWiresCount}`
        : `W0-${project.wires.length + 1}`;

      const newWire: WireRoute = {
        id: 'wire_' + Date.now(),
        fromId: fromEl.id,
        toId: toEl.id,
        points: isLightingControl ? undefined : waypoints,
        mode: isLightingControl ? 'curve' : 'ortho',
        conduit:
          (fromEl.category === 'junction' && toEl.category === 'switch') ||
          (fromEl.category === 'switch' && toEl.category === 'junction')
            ? 'wall_chase'
            : 'ceiling',
        cableType:
          fromEl.type === 'knx_actuator' ||
          toEl.type === 'knx_actuator' ||
          fromEl.type === 'knx_power_supply' ||
          toEl.type === 'knx_power_supply' ||
          fromEl.type === 'leak_sensor' ||
          toEl.type === 'leak_sensor'
            ? 'KNX_Bus'
            : isLightingControl
            ? 'VVGng_3x1.5'
            : matchedCircuit?.cableType || 'VVGng_3x2.5',
        busType:
          fromEl.type === 'knx_actuator' ||
          toEl.type === 'knx_actuator' ||
          fromEl.type === 'knx_power_supply' ||
          toEl.type === 'knx_power_supply' ||
          fromEl.type === 'leak_sensor' ||
          toEl.type === 'leak_sensor'
            ? 'knx'
            : 'power',
        circuitId: toEl.circuitId || fromEl.circuitId,
        switchGroupId: fromEl.switchGroupId || toEl.switchGroupId,
        cableTag,
        calculatedLengthM: wireLength,
        isManual: true, // Marked as manual so user waypoint edits are never overwritten by auto-routing!
      };

      if (fromEl.category === 'switch' && toEl.category === 'light') {
        const swGroup = fromEl.switchGroupId || `S_${fromEl.id.slice(-3)}`;
        fromEl.switchGroupId = swGroup;
        toEl.switchGroupId = swGroup;
      }

      onAddWire(newWire);
      setWireSourceElementId(null);
      setWireDraftPoints([]);
    },
    [project.walls, project.openings, project.ceilingHeightMm, project.circuits, project.wires, onAddWire]
  );

  // Finishes wire drafting to the nearest element or auto-created terminal junction box
  const handleFinishDraftWire = useCallback(() => {
    if (!wireSourceElementId) return;
    const fromEl = project.elements.find((item) => item.id === wireSourceElementId);
    if (!fromEl) {
      setWireSourceElementId(null);
      setWireDraftPoints([]);
      return;
    }

    const lastPoint = wireDraftPoints[wireDraftPoints.length - 1] || mouseWorldPos;

    // 1. Look for nearest existing electrical element (other than fromEl)
    let candidateEl: ElectricalElement | null = null;
    let minDistance = Infinity;

    for (const el of project.elements) {
      if (el.id === fromEl.id) continue;
      // Prohibit matching incompatible element types (e.g. Socket to Switch/Light)
      const isSocketFrom = fromEl.category === 'socket';
      const isSocketTo = el.category === 'socket';
      const isSwitchOrLightFrom = fromEl.category === 'switch' || fromEl.category === 'light';
      const isSwitchOrLightTo = el.category === 'switch' || el.category === 'light';
      if ((isSocketFrom && isSwitchOrLightTo) || (isSwitchOrLightFrom && isSocketTo)) {
        continue;
      }

      const d = distance(el.position, lastPoint);
      if (d < minDistance) {
        minDistance = d;
        candidateEl = el;
      }
    }

    // If within reasonable proximity (e.g. 50px), connect to it!
    if (candidateEl && minDistance < 50) {
      completeWireConnection(fromEl, candidateEl, wireDraftPoints);
      return;
    }

    // 2. Otherwise create a terminal junction box at lastPoint so the trace has a valid, renderable destination
    const isLightingEl = fromEl.category === 'switch' || fromEl.category === 'light';
    const termBox: ElectricalElement = {
      id: `el_jb_term_${Date.now()}`,
      category: 'junction',
      type: isLightingEl ? 'junction_box_light' : 'junction_box',
      name: isLightingEl ? 'Розподільча коробка освітлення (РК-L)' : 'Розподільчий вузол (РК)',
      position: gridSnapEnabled ? snapPointToGrid(lastPoint, 10) : lastPoint,
      rotation: 0,
      mountingHeightMm: 2500,
      powerWatts: 0,
      ipRating: 'IP20',
      circuitId: fromEl.circuitId,
      label: isLightingEl ? 'РК-L' : 'РК',
    };

    onAddElement(termBox);
    completeWireConnection(fromEl, termBox, wireDraftPoints);
  }, [
    wireSourceElementId,
    wireDraftPoints,
    mouseWorldPos,
    project.elements,
    gridSnapEnabled,
    onAddElement,
    completeWireConnection,
  ]);

  // Commit Wall with exact millimeter length (AutoCAD / Revit style dimension input)
  const commitWallWithLength = useCallback(
    (explicitMm?: number) => {
      if (!wallStartPoint) return;
      const targetMm = explicitMm ?? Number(wallDraftLengthInput);
      if (!isNaN(targetMm) && targetMm >= 50) {
        let currentP = mouseWorldPos;
        if (wallSnapResult) {
          currentP = wallSnapResult.snappedPoint;
        } else if (activeOrtho?.isSnapped) {
          currentP = activeOrtho.point;
        } else if (gridSnapEnabled) {
          currentP = snapPointToGrid(mouseWorldPos, 10);
        }
        let dx = currentP.x - wallStartPoint.x;
        let dy = currentP.y - wallStartPoint.y;
        if (Math.hypot(dx, dy) < 0.001) {
          dx = 1;
          dy = 0;
        }
        const curDist = Math.hypot(dx, dy) || 1;
        const ux = dx / curDist;
        const uy = dy / curDist;
        const targetPx = mmToPx(targetMm);
        const targetEnd: Point = {
          x: Math.round((wallStartPoint.x + ux * targetPx) * 10) / 10,
          y: Math.round((wallStartPoint.y + uy * targetPx) * 10) / 10,
        };
        const newWall: Wall = {
          id: 'wall_' + Date.now(),
          start: wallStartPoint,
          end: targetEnd,
          thickness: 150,
          type: 'partition',
        };
        onAddWall(newWall);
        setWallStartPoint(targetEnd);
        setWallDraftLengthInput('');
      }
    },
    [wallStartPoint, wallDraftLengthInput, mouseWorldPos, wallSnapResult, activeOrtho, gridSnapEnabled, onAddWall]
  );

  // Spacebar pan and shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setIsSpacePressed(true);
      } else if (e.key === 'Escape') {
        setContextMenu(null);
        setWallStartPoint(null);
        setWallDraftLengthInput('');
        setRoomDraftPoints([]);
        setWireSourceElementId(null);
        setWireDraftPoints([]);
        setMeasureStartPoint(null);
        setMultiSelectedElementIds([]);
        onSelectElement(null);
        onSelectWall(null);
        onSelectOpening?.(null);
        onSelectWire?.(null);
      } else if (e.key === 'Enter') {
        // Exact wall dimension creation via keyboard input
        if (activeTool === 'wall' && wallStartPoint && wallDraftLengthInput.length > 0) {
          commitWallWithLength();
          return;
        }
        if (activeTool === 'room' && roomDraftPoints.length >= 3) {
          const area = calculatePolygonAreaM2(roomDraftPoints);
          const preset = ROOM_PRESETS.find((r) => r.type === selectedRoomType) || ROOM_PRESETS[0];
          const newRoom: Room = {
            id: 'room_' + Date.now(),
            name: preset.name.split('/')[0].trim(),
            type: selectedRoomType || 'living',
            points: roomDraftPoints,
            areaM2: area,
          };
          onAddRoom?.(newRoom);
          setRoomDraftPoints([]);
        } else if (activeTool === 'wire' && wireSourceElementId) {
          handleFinishDraftWire();
        }
      } else if (
        activeTool === 'wall' &&
        wallStartPoint &&
        e.key >= '0' &&
        e.key <= '9' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        setWallDraftLengthInput((prev) => prev + e.key);
      } else if (
        activeTool === 'wall' &&
        wallStartPoint &&
        e.key === 'Backspace' &&
        wallDraftLengthInput.length > 0 &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        setWallDraftLengthInput((prev) => prev.slice(0, -1));
      } else if (e.key === 'Backspace' && wireSourceElementId) {
        // Step back intermediate waypoint
        setWireDraftPoints((prev) => {
          if (prev.length > 1) return prev.slice(0, prev.length - 1);
          setWireSourceElementId(null);
          return [];
        });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          if (multiSelectedElementIds.length > 0) {
            if (onDeleteElementsBatch) {
              onDeleteElementsBatch(multiSelectedElementIds);
            } else {
              multiSelectedElementIds.forEach((id) => onDeleteElement(id));
            }
            setMultiSelectedElementIds([]);
            onSelectElement(null);
          } else if (selectedElementId) {
            onDeleteElement(selectedElementId);
          } else if (selectedOpeningId && onDeleteOpening) {
            onDeleteOpening(selectedOpeningId);
          } else if (selectedWireId && onDeleteWire) {
            onDeleteWire(selectedWireId);
            onSelectWire?.(null);
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
  }, [
    activeTool,
    wallStartPoint,
    wallDraftLengthInput,
    mouseWorldPos,
    wallSnapResult,
    activeOrtho,
    gridSnapEnabled,
    onAddWall,
    roomDraftPoints,
    selectedRoomType,
    onAddRoom,
    selectedElementId,
    selectedOpeningId,
    selectedWireId,
    wireSourceElementId,
    multiSelectedElementIds,
    onDeleteElementsBatch,
    setMultiSelectedElementIds,
    onDeleteElement,
    onDeleteOpening,
    onDeleteWire,
    onSelectElement,
    onSelectWall,
    onSelectOpening,
    onSelectWire,
    handleFinishDraftWire,
  ]);

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
    const screenPtr = stageRef.current?.getPointerPosition();
    if (screenPtr) {
      setMouseScreenPos(screenPtr);
      if (!isCursorInside) setIsCursorInside(true);
    }

    if (boxSelectionStart) {
      setBoxSelectionEnd(worldPos);
    }

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
    } else if (activeTool === 'door' || activeTool === 'window') {
      setWallSnapResult(null);
      setActiveOrtho(null);
      setActiveJambSnap(null);
      const opWidthMm = selectedOpeningPreset?.widthMm || (activeTool === 'door' ? 900 : 1200);
      const placement = findWallOpeningPlacement(worldPos, project.walls, opWidthMm, 35);
      setOpeningHoverPlacement(placement);
    } else if (['socket', 'switch', 'light', 'panel', 'junction'].includes(activeTool)) {
      setWallSnapResult(null);
      setActiveOrtho(null);
      setOpeningHoverPlacement(null);
      const jambSnap = snapElementToDoorJambPue(worldPos, project.walls, project.openings || [], 32, project.rooms);
      setActiveJambSnap(jambSnap);
    } else {
      setWallSnapResult(null);
      setActiveOrtho(null);
      setOpeningHoverPlacement(null);
      setActiveJambSnap(null);
    }
  };

  // Stage click (canvas background or placing elements)
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    setContextMenu(null);
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

      // 1.5. ROOM TOOL (drawing room polygon vertices)
      if (activeTool === 'room') {
        const effectivePos = gridSnapEnabled ? snapPointToGrid(worldPos, 10) : worldPos;
        if (roomDraftPoints.length >= 3 && distance(roomDraftPoints[0], effectivePos) < 25) {
          // Close room!
          const area = calculatePolygonAreaM2(roomDraftPoints);
          const preset = ROOM_PRESETS.find((r) => r.type === selectedRoomType) || ROOM_PRESETS[0];
          const newRoom: Room = {
            id: 'room_' + Date.now(),
            name: preset.name.split('/')[0].trim(),
            type: selectedRoomType || 'living',
            points: roomDraftPoints,
            areaM2: area,
          };
          onAddRoom?.(newRoom);
          setRoomDraftPoints([]);
        } else {
          setRoomDraftPoints((prev) => [...prev, effectivePos]);
        }
        return;
      }

      // 2. WIRE ROUTING: Clicking empty canvas adds an intermediate waypoint, or connects if near element
      if (activeTool === 'wire') {
        const effectivePos = gridSnapEnabled ? snapPointToGrid(worldPos, 10) : worldPos;

        // If no source element yet, check if clicked near an element (within 40px)
        if (!wireSourceElementId) {
          const nearEl = project.elements.find((e) => distance(e.position, effectivePos) < 40);
          if (nearEl) {
            setWireSourceElementId(nearEl.id);
            setWireDraftPoints([nearEl.position]);
            return;
          }
          return;
        }

        // If source element exists, check if user clicked near another target element (within 35px)
        const targetEl = project.elements.find(
          (e) => e.id !== wireSourceElementId && distance(e.position, effectivePos) < 35
        );
        if (targetEl) {
          const fromEl = project.elements.find((e) => e.id === wireSourceElementId);
          if (fromEl) {
            completeWireConnection(fromEl, targetEl, wireDraftPoints);
          }
          return;
        }

        // Otherwise add intermediate waypoint corner
        setWireDraftPoints((prev) => [...prev, effectivePos]);
        return;
      }

      const effectivePos = gridSnapEnabled ? snapPointToGrid(worldPos, 10) : worldPos;

      // 3. MEASURE TOOL
      if (activeTool === 'measure') {
        if (!measureStartPoint) {
          setMeasureStartPoint(effectivePos);
        } else {
          setMeasureStartPoint(null);
        }
        return;
      }

      // 4. PLACING NEW ELECTRICAL ELEMENT
      if (
        ['socket', 'switch', 'light', 'panel', 'junction'].includes(activeTool) &&
        selectedCatalogItem
      ) {
        let finalPos = effectivePos;
        let finalRotation = 0;
        let finalWallId: string | undefined = undefined;

        // 1. First priority: Intelligent Door Jamb PUE Snap (100mm / 150mm from door opening)
        if (activeJambSnap) {
          finalPos = activeJambSnap.snappedPoint;
          finalRotation = activeJambSnap.rotation;
          finalWallId = activeJambSnap.wallId;
        } else {
          // 2. Second priority: Nearest wall snap
          const wallSnap = snapToNearestWall(effectivePos, project.walls, 25, project.rooms);
          if (wallSnap) {
            finalPos = wallSnap.snappedPoint;
            finalRotation = wallSnap.rotation;
            finalWallId = wallSnap.wallId;
          }
        }

        const isLightingCategory =
          selectedCatalogItem.category === 'light' ||
          selectedCatalogItem.category === 'switch' ||
          selectedCatalogItem.category === 'junction' ||
          selectedCatalogItem.type.startsWith('junction_box') ||
          selectedCatalogItem.type.startsWith('switch_') ||
          selectedCatalogItem.type.startsWith('light_');

        const isLightCircuit = (c: { cableType: string; breakerRatingA: number; name: string }) => {
          const cName = c.name.toLowerCase();
          return (
            c.cableType === 'VVGng_3x1.5' ||
            c.breakerRatingA <= 10 ||
            cName.includes('освіт') ||
            cName.includes('світл') ||
            cName.includes('освещ') ||
            cName.includes('свет') ||
            cName.includes('light')
          );
        };

        const matchedCircuit = project.circuits.find((c) =>
          isLightingCategory ? isLightCircuit(c) : (!isLightCircuit(c) && c.breakerRatingA >= 16)
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

      // 5. PLACING NEW FURNITURE
      if (activeTool === 'furniture' && selectedFurniturePreset) {
        const newFurniture: FurnitureItem = {
          id: `furn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: selectedFurniturePreset.type,
          name: selectedFurniturePreset.name,
          category: selectedFurniturePreset.category,
          position: effectivePos,
          width: selectedFurniturePreset.defaultWidthMm,
          height: selectedFurniturePreset.defaultHeightMm,
          rotation: 0,
          cadShape: selectedFurniturePreset.cadShape,
          electricalHints: selectedFurniturePreset.electricalHints,
        };
        onAddFurniture?.(newFurniture);
        onSelectFurniture?.(newFurniture.id);
        return;
      }

      // Deselect if clicked on empty canvas in select mode
      if (activeTool === 'select') {
        onSelectElement(null);
        onSelectWall(null);
        onSelectOpening?.(null);
        onSelectWire?.(null);
        onSelectFurniture?.(null);
      }
    }
  };

  // Electrical element click / tap handler (with Shift+Click multi-select)
  const handleElementClick = (e: Konva.KonvaEventObject<MouseEvent>, el: ElectricalElement) => {
    e.cancelBubble = true;
    setContextMenu(null);

    // 0. LINKING SWITCH TO LUMINAIRE (from Inspector)
    if (linkingSwitchId) {
      if (el.category === 'light') {
        onLinkSwitchToLuminaires?.(linkingSwitchId, [el.id]);
      }
      return;
    }

    // 1. WIRE ROUTING TOOL (supports multi-waypoint turns)
    if (activeTool === 'wire') {
      if (!wireSourceElementId) {
        setWireSourceElementId(el.id);
        setWireDraftPoints([el.position]);
      } else if (wireSourceElementId !== el.id) {
        const fromEl = project.elements.find((item) => item.id === wireSourceElementId);
        if (fromEl) {
          completeWireConnection(fromEl, el, wireDraftPoints);
        }
      }
      return;
    }

    // SELECT TOOL: Select single or toggle Shift+Click multi-select
    if (activeTool === 'select') {
      if (e.evt.shiftKey) {
        const baseIds = multiSelectedElementIds.length > 0
          ? multiSelectedElementIds
          : selectedElementId
          ? [selectedElementId]
          : [];
        const exists = baseIds.includes(el.id);
        const updated = exists ? baseIds.filter((id) => id !== el.id) : [...baseIds, el.id];
        setMultiSelectedElementIds(updated);
        onSelectElement(updated.length > 0 ? updated[0] : null);
      } else {
        setMultiSelectedElementIds([]);
        onSelectElement(el.id);
      }
      onSelectWall(null);
      onSelectOpening?.(null);
      onSelectWire?.(null);
    }
  };

  // Element Drag Start (tracks multi-selection group offsets)
  const handleElementDragStart = (el: ElectricalElement) => {
    setContextMenu(null);
    if (multiSelectedElementIds.length > 1 && multiSelectedElementIds.includes(el.id)) {
      const initialPositions = new Map<string, Point>();
      project.elements.forEach((item) => {
        if (multiSelectedElementIds.includes(item.id)) {
          initialPositions.set(item.id, { ...item.position });
        }
      });
      dragGroupRef.current = {
        anchorId: el.id,
        anchorStartPos: { ...el.position },
        initialPositions,
      };
    } else {
      dragGroupRef.current = null;
    }
  };

  // Element Drag Move (Group move or Intelligent Door Jamb Snap with PUE guides)
  const handleElementDragMove = (e: Konva.KonvaEventObject<DragEvent>, el: ElectricalElement) => {
    const targetPos = { x: e.target.x(), y: e.target.y() };

    if (dragGroupRef.current && dragGroupRef.current.anchorId === el.id) {
      const dx = targetPos.x - dragGroupRef.current.anchorStartPos.x;
      const dy = targetPos.y - dragGroupRef.current.anchorStartPos.y;
      const stage = stageRef.current;
      if (stage) {
        dragGroupRef.current.initialPositions.forEach((initPos, id) => {
          if (id === el.id) return;
          const node = stage.findOne(`#el_${id}`);
          if (node) {
            node.x(initPos.x + dx);
            node.y(initPos.y + dy);
          }
        });
      }
      return;
    }

    const jambSnap = snapElementToDoorJambPue(targetPos, project.walls, project.openings || [], 32, project.rooms);
    if (jambSnap) {
      setActiveJambSnap(jambSnap);
      e.target.x(jambSnap.snappedPoint.x);
      e.target.y(jambSnap.snappedPoint.y);
      return;
    }
    if (activeJambSnap) {
      setActiveJambSnap(null);
    }
  };

  // Element Drag End
  const handleElementDragEnd = (e: Konva.KonvaEventObject<DragEvent>, el: ElectricalElement) => {
    let targetPos = { x: e.target.x(), y: e.target.y() };

    if (dragGroupRef.current && dragGroupRef.current.anchorId === el.id) {
      const groupState = dragGroupRef.current;
      dragGroupRef.current = null;
      if (gridSnapEnabled) {
        targetPos = snapPointToGrid(targetPos, 10);
      }
      const dx = targetPos.x - groupState.anchorStartPos.x;
      const dy = targetPos.y - groupState.anchorStartPos.y;
      const updates: Array<{ id: string; position: Point }> = [];
      groupState.initialPositions.forEach((initPos, id) => {
        updates.push({
          id,
          position: {
            x: Math.round((initPos.x + dx) * 10) / 10,
            y: Math.round((initPos.y + dy) * 10) / 10,
          },
        });
      });
      if (onMoveElementsBatch) {
        onMoveElementsBatch(updates);
      } else {
        updates.forEach((u) => onUpdateElementPosition(u.id, u.position));
      }
      return;
    }

    const jambSnap = snapElementToDoorJambPue(targetPos, project.walls, project.openings || [], 32, project.rooms);
    setActiveJambSnap(null);

    if (jambSnap) {
      onUpdateElementPosition(el.id, jambSnap.snappedPoint, jambSnap.rotation, jambSnap.wallId);
      return;
    }

    if (gridSnapEnabled) {
      targetPos = snapPointToGrid(targetPos, 10);
    }

    const wallSnap = snapToNearestWall(targetPos, project.walls, 25, project.rooms);
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
      // Granular Layer Visibility filter
      if (layerVisibility) {
        if (el.category === 'socket' || el.category === 'appliance' || el.category === 'backup') {
          if (!layerVisibility.sockets) return false;
        } else if (el.category === 'switch') {
          if (!layerVisibility.switches) return false;
        } else if (el.category === 'light') {
          if (!layerVisibility.lights) return false;
        }
      }

      if (viewFilter === 'all') return true;
      if (viewFilter === 'sockets') return el.category === 'socket' || el.category === 'panel' || el.category === 'appliance';
      if (viewFilter === 'lighting') return el.category === 'light' || el.category === 'switch' || el.category === 'panel';
      return true;
    });
  }, [project.elements, viewFilter, layerVisibility]);

  // Filter visible wires
  const filteredWires = useMemo(() => {
    return project.wires.filter((w) => {
      // Granular Layer Visibility filter
      if (layerVisibility) {
        const isLighting = w.mode === 'curve';
        if (isLighting && !layerVisibility.wiresLighting) return false;
        if (!isLighting && !layerVisibility.wiresPower) return false;
        if (w.conduit === 'wall_chase' && !layerVisibility.conduitChase) return false;
        if (w.conduit === 'ceiling' && !layerVisibility.conduitCeiling) return false;
        if (w.conduit === 'floor' && !layerVisibility.conduitFloor) return false;
      }

      if (viewFilter === 'sockets') return w.cableType !== 'VVGng_3x1.5';
      if (viewFilter === 'lighting') return w.cableType === 'VVGng_3x1.5' || w.mode === 'curve';
      return true;
    });
  }, [project.wires, viewFilter, layerVisibility]);

  // Stage Double Click (finish manual wire routing to nearest element or create terminal node)
  const handleStageDblClick = () => {
    if (activeTool === 'wire' && wireSourceElementId) {
      handleFinishDraftWire();
    }
  };

  const openCanvasContextMenuAt = (clientX: number, clientY: number, targetType: 'element' | 'wire' | 'wall' | 'multi' | 'canvas', targetId?: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const relX = rect ? clientX - rect.left : clientX;
    const relY = rect ? clientY - rect.top : clientY;
    const clampedX = Math.max(8, Math.min(relX, Math.max(8, stageDimensions.width - 230)));
    const clampedY = Math.max(8, Math.min(relY, Math.max(8, stageDimensions.height - 230)));
    setContextMenu({ x: clampedX, y: clampedY, targetType, targetId });
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsCursorInside(true)}
      onMouseLeave={() => setIsCursorInside(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (multiSelectedElementIds.length > 1) {
          openCanvasContextMenuAt(e.clientX, e.clientY, 'multi');
        } else {
          openCanvasContextMenuAt(e.clientX, e.clientY, 'canvas');
        }
      }}
      className={`relative w-full h-full overflow-hidden select-none ${
        cadStyle === 'autocad' ? 'bg-[#0c0d10]' : 'cad-grid-dark'
      } ${isSpacePressed || activeTool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'}`}
    >
      {/* AutoCAD Full-screen Crosshair Cursor & Center Pickbox Overlay */}
      {cadStyle === 'autocad' && isCursorInside && !isSpacePressed && activeTool !== 'pan' && (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {/* Horizontal Hairline */}
          <div
            className="absolute left-0 right-0 h-px bg-slate-200/40"
            style={{ top: `${mouseScreenPos.y}px` }}
          />
          {/* Vertical Hairline */}
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-200/40"
            style={{ left: `${mouseScreenPos.x}px` }}
          />
          {/* Center Pickbox */}
          <div
            className="absolute w-2.5 h-2.5 border border-slate-100 bg-transparent -translate-x-1/2 -translate-y-1/2 shadow-sm"
            style={{ left: `${mouseScreenPos.x}px`, top: `${mouseScreenPos.y}px` }}
          />
        </div>
      )}

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
        onDblClick={handleStageDblClick}
        onMouseMove={handleStagePointerMove}
        onMouseDown={(e) => {
          if (activeTool === 'select' && e.target === stageRef.current && !isSpacePressed) {
            const worldPos = getWorldPointerPos();
            setBoxSelectionStart(worldPos);
            setBoxSelectionEnd(worldPos);
            setMultiSelectedElementIds([]);
            onSelectElement(null);
            onSelectWall(null);
            onSelectOpening?.(null);
            onSelectWire?.(null);
            onSelectFurniture?.(null);
          }
        }}
        onMouseUp={() => {
          if (boxSelectionStart && boxSelectionEnd) {
            const minX = Math.min(boxSelectionStart.x, boxSelectionEnd.x);
            const maxX = Math.max(boxSelectionStart.x, boxSelectionEnd.x);
            const minY = Math.min(boxSelectionStart.y, boxSelectionEnd.y);
            const maxY = Math.max(boxSelectionStart.y, boxSelectionEnd.y);

            if (maxX - minX > 5 && maxY - minY > 5) {
              const enclosed = project.elements.filter(
                (el) =>
                  el.position.x >= minX &&
                  el.position.x <= maxX &&
                  el.position.y >= minY &&
                  el.position.y <= maxY
              );
              if (enclosed.length > 0) {
                setMultiSelectedElementIds(enclosed.map((el) => el.id));
                onSelectElement(enclosed[0].id);
              }
            }
            setBoxSelectionStart(null);
            setBoxSelectionEnd(null);
          }
        }}
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
          {(layerVisibility?.blueprint ?? true) && bgHtmlImage && project.backgroundImage && (
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
          {(layerVisibility?.rooms ?? true) && project.rooms.map((room) => {
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

          {/* Wi-Fi 2.4/5GHz Signal Heatmap Coverage Simulation */}
          {(layerVisibility?.wifiHeatmap ?? false) && wifiHeatmapPoints.length > 0 && (
            <Group listening={false} opacity={0.65}>
              {wifiHeatmapPoints.map((pt, idx) => (
                <Circle
                  key={`wifi_pt_${idx}`}
                  x={pt.x}
                  y={pt.y}
                  radius={18}
                  fill={pt.color}
                />
              ))}
            </Group>
          )}

          {/* CCTV Video Surveillance Field of View (FOV) Cones with Wall Occlusion */}
          {(layerVisibility?.cctvFov ?? true) && cctvFovCones.length > 0 && (
            <Group listening={false}>
              {cctvFovCones.map((cone) => {
                const flatPoints = cone.points.flatMap((p) => [p.x, p.y]);
                return (
                  <Group key={`cctv_cone_${cone.cameraId}`} opacity={0.55}>
                    <Line
                      points={flatPoints}
                      closed
                      fill="rgba(59, 130, 246, 0.22)"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      dash={[4, 2]}
                    />
                    {cone.points.length > 2 && (
                      <Line
                        points={[
                          cone.origin.x,
                          cone.origin.y,
                          cone.points[Math.floor(cone.points.length / 2)].x,
                          cone.points[Math.floor(cone.points.length / 2)].y,
                        ]}
                        stroke="#60a5fa"
                        strokeWidth={1}
                        dash={[2, 2]}
                      />
                    )}
                  </Group>
                );
              })}
            </Group>
          )}

          {/* Active room polygon drawing draft */}
          {roomDraftPoints.length > 0 && (
            <Group listening={false}>
              <Line
                points={[...roomDraftPoints.flatMap((p) => [p.x, p.y]), mouseWorldPos.x, mouseWorldPos.y]}
                stroke="#38bdf8"
                strokeWidth={2}
                dash={[6, 3]}
                fill="rgba(56, 189, 248, 0.12)"
              />
              {roomDraftPoints.map((pt, i) => (
                <Circle
                  key={i}
                  x={pt.x}
                  y={pt.y}
                  r={i === 0 ? 6 : 4}
                  fill={i === 0 ? '#38bdf8' : '#ffffff'}
                  stroke="#0284c7"
                  strokeWidth={2}
                />
              ))}
            </Group>
          )}

          {/* Furniture & Plumbing CAD Blocks */}
          {(layerVisibility ? layerVisibility.furniture : showFurniture) &&
            project.furniture &&
            project.furniture.map((item) => (
              <KonvaFurnitureSymbol
                key={item.id}
                item={item}
                isSelected={selectedFurnitureId === item.id}
                isDraggable={activeTool === 'select'}
                onSelect={() => {
                  if (activeTool === 'select') {
                    onSelectFurniture?.(item.id);
                    onSelectElement(null);
                    onSelectWall(null);
                    onSelectOpening?.(null);
                    onSelectWire?.(null);
                  }
                }}
                onDragEnd={(newPos) => {
                  onUpdateFurniturePosition?.(item.id, newPos);
                }}
              />
            ))}

          {/* Walls */}
          {(layerVisibility?.walls ?? true) && project.walls.map((wall) => {
            const isSelected = selectedWallId === wall.id;
            const wallLengthMm = pxToMm(distance(wall.start, wall.end));
            const strokeW = wall.thickness / MM_PER_PX;

            return (
              <Group
                key={wall.id}
                onClick={(e) => {
                  e.cancelBubble = true;
                  setContextMenu(null);
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
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  onSelectWall(wall.id);
                  onSelectElement(null);
                  onSelectOpening?.(null);
                  openCanvasContextMenuAt(e.evt.clientX, e.evt.clientY, 'wall', wall.id);
                }}
              >
                {/* Wall selection halo */}
                {isSelected && (
                  <Line
                    points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
                    stroke="#38bdf8"
                    strokeWidth={strokeW + 6}
                    opacity={0.35}
                    lineCap="square"
                  />
                )}
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
                {(layerVisibility ? layerVisibility.dimensions : showDimensions) && wallLengthMm > 300 && (
                  <Group
                    x={(wall.start.x + wall.end.x) / 2}
                    y={(wall.start.y + wall.end.y) / 2}
                    listening={false}
                  >
                    <Rect
                      x={isSelected ? -34 : -24}
                      y={isSelected ? -10 : -8}
                      width={isSelected ? 68 : 48}
                      height={isSelected ? 20 : 16}
                      cornerRadius={3}
                      fill={isSelected ? '#0284c7' : '#0f172a'}
                      stroke={isSelected ? '#e0f2fe' : 'rgba(255,255,255,0.15)'}
                      strokeWidth={isSelected ? 1.2 : 0.8}
                    />
                    <Text
                      x={isSelected ? -34 : -24}
                      y={isSelected ? -5 : -5}
                      width={isSelected ? 68 : 48}
                      text={
                        isSelected
                          ? formatDimensionValue(wallLengthMm, displayUnit, true)
                          : formatDimensionValue(wallLengthMm, displayUnit, false)
                      }
                      fontSize={isSelected ? 10 : 9}
                      fontStyle={isSelected ? 'bold' : 'normal'}
                      fill={isSelected ? '#ffffff' : '#e2e8f0'}
                      fontFamily="monospace"
                      align="center"
                    />
                  </Group>
                )}

                {/* Draggable endpoint handles when wall is selected */}
                {isSelected && onUpdateWall && (
                  <Group>
                    {/* Start handle P1 */}
                    <Circle
                      x={wall.start.x}
                      y={wall.start.y}
                      radius={6}
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth={2}
                      draggable={activeTool === 'select'}
                      onDragMove={(e) => {
                        let p = { x: e.target.x(), y: e.target.y() };
                        if (gridSnapEnabled) p = snapPointToGrid(p, 10);
                        onUpdateWall({ ...wall, start: p });
                      }}
                      onDragEnd={(e) => {
                        let p = { x: e.target.x(), y: e.target.y() };
                        if (gridSnapEnabled) p = snapPointToGrid(p, 10);
                        onUpdateWall({ ...wall, start: p });
                      }}
                    />
                    {/* End handle P2 */}
                    <Circle
                      x={wall.end.x}
                      y={wall.end.y}
                      radius={6}
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth={2}
                      draggable={activeTool === 'select'}
                      onDragMove={(e) => {
                        let p = { x: e.target.x(), y: e.target.y() };
                        if (gridSnapEnabled) p = snapPointToGrid(p, 10);
                        onUpdateWall({ ...wall, end: p });
                      }}
                      onDragEnd={(e) => {
                        let p = { x: e.target.x(), y: e.target.y() };
                        if (gridSnapEnabled) p = snapPointToGrid(p, 10);
                        onUpdateWall({ ...wall, end: p });
                      }}
                    />
                  </Group>
                )}
              </Group>
            );
          })}

          {/* Openings (Doors & Windows) */}
          {(layerVisibility?.openings ?? true) && project.openings.map((op) => {
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
        {/* LAYER 4: WIRING & CONNECTIONS (Bundle Offsets, Draggable Handles, Badges) */}
        {/* ======================================================== */}
        <Layer id="wiresConnectionsLayer">
          {filteredWires.map((wire, wireIdx) => {
            const fromEl = project.elements.find((e) => e.id === wire.fromId);
            const toEl = project.elements.find((e) => e.id === wire.toId);
            if (!fromEl || !toEl) return null;

            const circuit = project.circuits.find((c) => c.id === wire.circuitId);
            const isLighting = wire.mode === 'curve';
            const isSelected = selectedWireId === wire.id;
            const isHovered = hoveredWireId === wire.id;

            // Calculate bezier control point for curved lighting wire
            const midX = (fromEl.position.x + toEl.position.x) / 2;
            const midY = (fromEl.position.y + toEl.position.y) / 2;
            const dx = toEl.position.x - fromEl.position.x;
            const dy = toEl.position.y - fromEl.position.y;
            const dist = Math.hypot(dx, dy);
            const nx = -dy / (dist || 1);
            const ny = dx / (dist || 1);
            // Stagger curved lines if multiple lights are connected to the same switch
            const curveOffsetFactor = 0.22 + (wireIdx % 3) * 0.05;
            const ctrlX = midX + nx * dist * curveOffsetFactor;
            const ctrlY = midY + ny * dist * curveOffsetFactor;
            const curvedPathData = `M ${fromEl.position.x} ${fromEl.position.y} Q ${ctrlX} ${ctrlY} ${toEl.position.x} ${toEl.position.y}`;

            // Orthogonal polyline with bundle separation offsets
            const hasExplicitPoints = Boolean(wire.points && wire.points.length >= 2);
            const explicitPointsColliding = hasExplicitPoints && !wire.isManual && checkChaseIntersectsOpening(wire.points!, project.walls, project.openings).hasCollision;

            const rawPoints = (hasExplicitPoints && !explicitPointsColliding)
              ? wire.points!
              : computeOrthogonalPath(fromEl.position, toEl.position, project.walls, project.openings);

            const isSwitchFrom = fromEl.category === 'switch';
            const isSwitchTo = toEl.category === 'switch';
            const isLightFrom = fromEl.category === 'light';
            const isLightTo = toEl.category === 'light';
            const isJunctionOrPanelFrom = fromEl.category === 'junction' || fromEl.category === 'panel';
            const isJunctionOrPanelTo = toEl.category === 'junction' || toEl.category === 'panel';

            // Switch connection phase flow (ПУЕ §6.1.14 & §7.1.50):
            // 1. Phase line L from Panel or Junction Box to Switch
            const isPhaseFeedToSwitch = (isSwitchTo && isJunctionOrPanelFrom) || (isSwitchFrom && isJunctionOrPanelTo);
            // 2. Switched phase line L' from Switch to Luminaire (or through Junction box to Luminaire)
            const isSwitchedPhaseToLight = (isSwitchFrom && isLightTo) || (isLightFrom && isSwitchTo) || (isJunctionOrPanelFrom && isLightTo && Boolean(wire.switchGroupId));

            // Use bundled offset path to prevent cables from overlapping on top of each other!
            // Strictly verify that the bundled trace never penetrates door or window openings
            const bundledPoints = bundleOffsetMap.get(wire.id);
            const safeBundledPoints = bundledPoints && !checkChaseIntersectsOpening(bundledPoints, project.walls, project.openings).hasCollision
              ? bundledPoints
              : undefined;

            const effectivePoints = isSelected && wire.points && wire.points.length >= 2
              ? wire.points
              : (safeBundledPoints || rawPoints);

            const orthoFlatPoints = effectivePoints.flatMap((p) => [p.x, p.y]);

            const isKnxBus = wire.cableType === 'KNX_Bus' || wire.busType === 'knx';

            // Highlight color: vibrant amber/gold if selected, otherwise phase-coded, KNX green, or circuit color
            const activeColor = isSelected
              ? '#f59e0b'
              : isKnxBus
              ? '#10b981' // KNX signature Green (JY(St)Y 2x2x0.8)
              : isPhaseFeedToSwitch
              ? '#ef4444' // Phase L (red/brown feed)
              : isSwitchedPhaseToLight
              ? '#eab308' // Switched phase L' (yellow control line)
              : (circuit?.color || (isLighting ? '#fbbf24' : '#38bdf8'));

            // Legible callout badge location: center of the longest segment
            const longestSeg = getLongestSegmentMidpoint(effectivePoints);
            const badgeX = isLighting ? ctrlX : longestSeg.midpoint.x;
            const badgeY = isLighting ? ctrlY : longestSeg.midpoint.y;

            const cableSpec = getCableCrossSection(wire.cableType);
            const tagPrefix = wire.cableTag ? `[${wire.cableTag}] ` : '';
            const conduitLabel = wire.conduit === 'wall_chase' ? 'Штроба' : wire.conduit === 'floor' ? 'Підлога' : 'Стеля';
            
            // Phase indicator label
            const phaseBadge = isKnxBus
              ? '🟢 KNX Bus 30V'
              : isPhaseFeedToSwitch
              ? '⚡ L ➔ SW (Фаза)'
              : isSwitchedPhaseToLight
              ? "⚡ L' ➔ Світло (Ком.)"
              : null;

            const badgeLine1 = phaseBadge ? `${phaseBadge} · ${cableSpec}` : `${tagPrefix}${cableSpec}`;
            const badgeLine2 = `${wire.calculatedLengthM} м · ${conduitLabel}`;
            const badgeW = Math.max(90, Math.max(badgeLine1.length, badgeLine2.length) * 6.5 + 16);
            const badgeH = 26;

            return (
              <Group
                key={wire.id}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  onSelectWire?.(wire.id);
                  onSelectElement(null);
                  onSelectWall(null);
                  onSelectOpening?.(null);
                  openCanvasContextMenuAt(e.evt.clientX, e.evt.clientY, 'wire', wire.id);
                }}
              >
                {/* 1. SELECTION & HOVER GLOW AURA */}
                {(isSelected || isHovered) && (
                  isLighting ? (
                    <KonvaPath
                      data={curvedPathData}
                      stroke={isSelected ? '#f59e0b' : '#38bdf8'}
                      strokeWidth={isSelected ? 10 : 7}
                      opacity={isSelected ? 0.45 : 0.25}
                      lineCap="round"
                      lineJoin="round"
                    />
                  ) : (
                    <Line
                      points={orthoFlatPoints}
                      stroke={isSelected ? '#f59e0b' : '#38bdf8'}
                      strokeWidth={isSelected ? 10 : 8}
                      opacity={isSelected ? 0.45 : 0.25}
                      lineCap="round"
                      lineJoin="round"
                    />
                  )
                )}

                {/* 2. VISIBLE CABLE LINE */}
                {isLighting ? (
                  <KonvaPath
                    data={curvedPathData}
                    stroke={activeColor}
                    strokeWidth={isSelected ? 3.5 : 2.2}
                    dash={isSelected ? [6, 3] : [5, 4]}
                    lineCap="round"
                    lineJoin="round"
                  />
                ) : (
                  <Line
                    points={orthoFlatPoints}
                    stroke={activeColor}
                    strokeWidth={isSelected ? 3.8 : 2.5}
                    dash={isKnxBus ? [5, 4] : (wire.conduit === 'wall_chase' ? [6, 2] : undefined)}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}

                {/* 2b. PHASE DIRECTIONAL FLOW CHEVRONS (L ➔ SW and L' ➔ Lamp) */}
                {(isPhaseFeedToSwitch || isSwitchedPhaseToLight) && (
                  <Group listening={false}>
                    {/* Small directional chevron indicator at 40% along line */}
                    <Circle
                      x={badgeX - 14}
                      y={badgeY}
                      radius={3}
                      fill={isPhaseFeedToSwitch ? '#ef4444' : '#eab308'}
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                    <Text
                      x={badgeX - 10}
                      y={badgeY - 5}
                      text="▶"
                      fontSize={8}
                      fill={isPhaseFeedToSwitch ? '#ef4444' : '#eab308'}
                    />
                  </Group>
                )}

                {/* 3. INVISIBLE WIDE HIT AREA FOR CLICKING, HOVERING, & INSERTING POINTS */}
                {isLighting ? (
                  <KonvaPath
                    data={curvedPathData}
                    stroke="transparent"
                    strokeWidth={22}
                    lineCap="round"
                    lineJoin="round"
                    onClick={(e) => {
                      e.cancelBubble = true;
                      onSelectWire?.(wire.id);
                      onSelectElement(null);
                      onSelectWall(null);
                      onSelectOpening?.(null);
                    }}
                    onMouseEnter={() => setHoveredWireId(wire.id)}
                    onMouseLeave={() => setHoveredWireId(null)}
                  />
                ) : (
                  <Line
                    points={orthoFlatPoints}
                    stroke="transparent"
                    strokeWidth={22}
                    lineCap="round"
                    lineJoin="round"
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (!isSelected) {
                        onSelectWire?.(wire.id);
                        onSelectElement(null);
                        onSelectWall(null);
                        onSelectOpening?.(null);
                      } else if (onUpdateWire && effectivePoints.length >= 2) {
                        // Click on already-selected wire inserts a new point at click location!
                        const worldPos = getWorldPointerPos();
                        let bestIdx = 0;
                        let minD = Infinity;
                        let bestPt = worldPos;
                        for (let i = 0; i < effectivePoints.length - 1; i++) {
                          const cp = closestPointOnSegment(worldPos, effectivePoints[i], effectivePoints[i + 1]);
                          if (cp.dist < minD) {
                            minD = cp.dist;
                            bestIdx = i;
                            bestPt = cp.point;
                          }
                        }
                        const updated = [
                          ...effectivePoints.slice(0, bestIdx + 1),
                          bestPt,
                          ...effectivePoints.slice(bestIdx + 1),
                        ];
                        const newLen = calculateCableLengthM(
                          fromEl,
                          toEl,
                          project.ceilingHeightMm,
                          wire.conduit,
                          updated
                        );
                        onUpdateWire({
                          ...wire,
                          points: updated,
                          isManual: true,
                          calculatedLengthM: newLen,
                        });
                      }
                    }}
                    onMouseEnter={() => setHoveredWireId(wire.id)}
                    onMouseLeave={() => setHoveredWireId(null)}
                  />
                )}

                {/* 4. TERMINAL ANCHOR DOTS */}
                <Circle
                  x={fromEl.position.x}
                  y={fromEl.position.y}
                  radius={isSelected ? 6 : 4}
                  fill={activeColor}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 2 : 1}
                />
                <Circle
                  x={toEl.position.x}
                  y={toEl.position.y}
                  radius={isSelected ? 6 : 4}
                  fill={activeColor}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 2 : 1}
                />

                {/* 5. INTERACTIVE DRAGGABLE WAYPOINT HANDLES (WHEN SELECTED) */}
                {isSelected && !isLighting && effectivePoints.map((pt, pIdx) => {
                  const isEnd = pIdx === 0 || pIdx === effectivePoints.length - 1;
                  return (
                    <Group key={`wp_${pIdx}`}>
                      {/* Draggable Circle Handle */}
                      <Circle
                        x={pt.x}
                        y={pt.y}
                        radius={isEnd ? 5 : 7}
                        fill={isEnd ? activeColor : '#ffffff'}
                        stroke={activeColor}
                        strokeWidth={2.5}
                        draggable={!isEnd}
                        hitStrokeWidth={16}
                        shadowColor="black"
                        shadowBlur={4}
                        onDragMove={(e) => {
                          const newPos = gridSnapEnabled
                            ? snapPointToGrid({ x: e.target.x(), y: e.target.y() }, 10)
                            : { x: e.target.x(), y: e.target.y() };
                          e.target.x(newPos.x);
                          e.target.y(newPos.y);
                        }}
                        onDragEnd={(e) => {
                          const newPos = gridSnapEnabled
                            ? snapPointToGrid({ x: e.target.x(), y: e.target.y() }, 10)
                            : { x: e.target.x(), y: e.target.y() };
                          const updated = [...effectivePoints];
                          updated[pIdx] = newPos;
                          const newLen = calculateCableLengthM(
                            fromEl,
                            toEl,
                            project.ceilingHeightMm,
                            wire.conduit,
                            updated
                          );
                          onUpdateWire?.({
                            ...wire,
                            points: updated,
                            isManual: true,
                            calculatedLengthM: newLen,
                          });
                        }}
                        onContextMenu={(e) => {
                          e.evt.preventDefault();
                          // Delete waypoint on right-click if > 2 points
                          if (effectivePoints.length > 2 && !isEnd) {
                            const updated = effectivePoints.filter((_, idx) => idx !== pIdx);
                            const newLen = calculateCableLengthM(
                              fromEl,
                              toEl,
                              project.ceilingHeightMm,
                              wire.conduit,
                              updated
                            );
                            onUpdateWire?.({
                              ...wire,
                              points: updated,
                              isManual: true,
                              calculatedLengthM: newLen,
                            });
                          }
                        }}
                      />

                      {/* "+" Split Handle between waypoints to insert a new corner */}
                      {pIdx < effectivePoints.length - 1 && (() => {
                        const nextPt = effectivePoints[pIdx + 1];
                        const segDist = distance(pt, nextPt);
                        if (segDist < 30) return null;
                        const mx = (pt.x + nextPt.x) / 2;
                        const my = (pt.y + nextPt.y) / 2;
                        return (
                          <Group
                            x={mx}
                            y={my}
                            onClick={(e) => {
                              e.cancelBubble = true;
                              const updated = [
                                ...effectivePoints.slice(0, pIdx + 1),
                                { x: mx, y: my },
                                ...effectivePoints.slice(pIdx + 1),
                              ];
                              const newLen = calculateCableLengthM(
                                fromEl,
                                toEl,
                                project.ceilingHeightMm,
                                wire.conduit,
                                updated
                              );
                              onUpdateWire?.({
                                ...wire,
                                points: updated,
                                isManual: true,
                                calculatedLengthM: newLen,
                              });
                            }}
                          >
                            <Circle radius={5.5} fill="#0284c7" stroke="#ffffff" strokeWidth={1.5} />
                            <Text x={-3} y={-4.5} text="+" fontSize={9} fontStyle="bold" fill="#ffffff" />
                          </Group>
                        );
                      })()}
                    </Group>
                  );
                })}

                {/* 6. STATIC TURN MARKERS (WHEN NOT SELECTED) */}
                {!isSelected && !isLighting && effectivePoints.length > 2 &&
                  effectivePoints.slice(1, -1).map((pt, pIdx) => (
                    <Circle
                      key={`static_turn_${pIdx}`}
                      x={pt.x}
                      y={pt.y}
                      radius={2.5}
                      fill={activeColor}
                      opacity={0.8}
                    />
                  ))}

                {/* 7. AUTOCAD LEADER LINE (ВИНОСКА ЗА ДСТУ) & CALLOUT BADGE */}
                {(layerVisibility ? layerVisibility.annotations : showAnnotations) && (
                  <Group>
                    {/* AutoCAD Leader line: dot at wire, 45 degree angle leg, horizontal shelf line */}
                    <Line
                      points={[
                        badgeX, badgeY,
                        badgeX + 18, badgeY - 18,
                        badgeX + 18 + badgeW * 0.7, badgeY - 18
                      ]}
                      stroke={isSelected ? '#f59e0b' : '#64748b'}
                      strokeWidth={1}
                      dash={[3, 2]}
                      listening={false}
                    />
                    <Circle
                      x={badgeX}
                      y={badgeY}
                      radius={2}
                      fill={isSelected ? '#f59e0b' : '#64748b'}
                      listening={false}
                    />

                    {/* High-contrast callout badge on shelf */}
                    <Group
                      x={badgeX + 18 + (badgeW * 0.35)}
                      y={badgeY - 28}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        onSelectWire?.(wire.id);
                        onSelectElement(null);
                        onSelectWall(null);
                        onSelectOpening?.(null);
                      }}
                      onMouseEnter={() => setHoveredWireId(wire.id)}
                      onMouseLeave={() => setHoveredWireId(null)}
                    >
                      <Rect
                        x={-badgeW / 2}
                        y={-badgeH / 2}
                        width={badgeW}
                        height={badgeH}
                        cornerRadius={4}
                        fill={isSelected ? '#0f172a' : '#020617'}
                        stroke={isSelected ? '#f59e0b' : activeColor}
                        strokeWidth={isSelected ? 2 : 1.2}
                        shadowColor="black"
                        shadowBlur={6}
                        shadowOpacity={0.8}
                      />
                      <Text
                        x={-badgeW / 2}
                        y={-badgeH / 2 + 3}
                        width={badgeW}
                        text={badgeLine1}
                        fontSize={8.5}
                        fontStyle="bold"
                        fill={isPhaseFeedToSwitch ? '#fca5a5' : isSwitchedPhaseToLight ? '#fef08a' : isSelected ? '#fbbf24' : '#ffffff'}
                        fontFamily="monospace"
                        align="center"
                      />
                      <Text
                        x={-badgeW / 2}
                        y={-badgeH / 2 + 14}
                        width={badgeW}
                        text={badgeLine2}
                        fontSize={7.5}
                        fill={isSelected ? '#ffffff' : '#94a3b8'}
                        fontFamily="monospace"
                        align="center"
                      />
                    </Group>
                  </Group>
                )}

                {/* 8. FLOATING WIRE OPERATIONS TOOLBAR (WHEN SELECTED) */}
                {isSelected && (
                  <Group x={badgeX} y={badgeY - 56}>
                    {/* Background capsule */}
                    <Rect
                      x={-100}
                      y={-12}
                      width={200}
                      height={24}
                      cornerRadius={12}
                      fill="#0f172a"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      shadowColor="black"
                      shadowBlur={8}
                    />

                    {/* "+ Точка" button */}
                    <Group
                      x={-68}
                      y={0}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        if (!onUpdateWire || isLighting || effectivePoints.length < 2) return;
                        // Insert point at midpoint of longest segment
                        const seg = getLongestSegmentMidpoint(effectivePoints);
                        const updated = [
                          ...effectivePoints.slice(0, seg.segmentIndex + 1),
                          seg.midpoint,
                          ...effectivePoints.slice(seg.segmentIndex + 1),
                        ];
                        const newLen = calculateCableLengthM(
                          fromEl,
                          toEl,
                          project.ceilingHeightMm,
                          wire.conduit,
                          updated
                        );
                        onUpdateWire({
                          ...wire,
                          points: updated,
                          isManual: true,
                          calculatedLengthM: newLen,
                        });
                      }}
                    >
                      <Rect x={-26} y={-9} width={52} height={18} cornerRadius={4} fill="#1e293b" />
                      <Text x={-26} y={-5} width={52} text="+ Точка" fontSize={8.5} fontStyle="bold" fill="#38bdf8" align="center" />
                    </Group>

                    {/* "🗑 Видалити" button */}
                    <Group
                      x={-8}
                      y={0}
                      onClick={(e) => {
                        e.cancelBubble = true;
                        onDeleteWire?.(wire.id);
                        onSelectWire?.(null);
                      }}
                    >
                      <Rect x={-26} y={-9} width={52} height={18} cornerRadius={4} fill="#450a0a" />
                      <Text x={-26} y={-5} width={52} text="🗑 Видалити" fontSize={8.5} fontStyle="bold" fill="#fca5a5" align="center" />
                    </Group>

                    {/* "⚡ Схема L➔L'" button (if lighting/switch) */}
                    {(isPhaseFeedToSwitch || isSwitchedPhaseToLight || isLighting) && (
                      <Group
                        x={56}
                        y={0}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          const sw = isSwitchFrom ? fromEl : isSwitchTo ? toEl : project.elements.find(el => el.category === 'switch');
                          onOpenSwitchWiringDiagram?.(sw || undefined);
                        }}
                      >
                        <Rect x={-32} y={-9} width={64} height={18} cornerRadius={4} fill="#451a03" />
                        <Text x={-32} y={-5} width={64} text="⚡ Схема L➔L'" fontSize={8} fontStyle="bold" fill="#fde047" align="center" />
                      </Group>
                    )}
                  </Group>
                )}
              </Group>
            );
          })}
        </Layer>

        {/* ======================================================== */}
        {/* LAYER 5: INTERACTIVE ELECTRICAL SYMBOLS & LIGHTING GLOWS */}
        {/* ======================================================== */}
        <Layer id="elementsLayer">
          {/* A. Soft Warm Luminaire Illumination Halos */}
          {filteredElements.map((el) => {
            if (el.category !== 'light') return null;
            return (
              <Group key={`glow_${el.id}`} x={el.position.x} y={el.position.y} listening={false}>
                {el.type === 'light_sconce' ? (
                  <Arc
                    innerRadius={0}
                    outerRadius={46}
                    angle={120}
                    rotation={el.rotation - 60}
                    fill="rgba(251, 191, 36, 0.2)"
                    stroke="rgba(251, 191, 36, 0.35)"
                    strokeWidth={1}
                  />
                ) : (
                  <>
                    <Circle
                      radius={viewFilter === 'lighting' ? 44 : 34}
                      fill="rgba(251, 191, 36, 0.16)"
                    />
                    <Circle
                      radius={viewFilter === 'lighting' ? 44 : 34}
                      stroke="rgba(251, 191, 36, 0.3)"
                      strokeWidth={1}
                      dash={[3, 3]}
                    />
                  </>
                )}
              </Group>
            );
          })}

          {/* B. Electrical Symbols */}
          {filteredElements.map((el) => {
            const isSelected = selectedElementId === el.id || multiSelectedElementIds.includes(el.id);
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
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if (multiSelectedElementIds.length > 1 && multiSelectedElementIds.includes(el.id)) {
                    openCanvasContextMenuAt(e.evt.clientX, e.evt.clientY, 'multi');
                  } else {
                    setMultiSelectedElementIds([]);
                    onSelectElement(el.id);
                    onSelectWall(null);
                    onSelectOpening?.(null);
                    onSelectWire?.(null);
                    openCanvasContextMenuAt(e.evt.clientX, e.evt.clientY, 'element', el.id);
                  }
                }}
                onDragStart={() => handleElementDragStart(el)}
                onDragMove={(e) => handleElementDragMove(e, el)}
                onDragEnd={(e) => handleElementDragEnd(e, el)}
              >
                <KonvaElectricalSymbol
                  type={el.type}
                  size={26}
                  color={el.customSymbolColor || elColor}
                  isSelected={isSelected}
                  label={el.switchGroupId || el.label}
                  mountingHeightMm={el.mountingHeightMm}
                  showHeightTag={layerVisibility ? layerVisibility.heights : showHeights}
                  circuitNumber={circuit?.number}
                  isBackupPriority={Boolean(el.isBackupPriority || circuit?.isBackupPriority)}
                  customSymbolShape={el.customSymbolShape}
                  customSymbolColor={el.customSymbolColor}
                  customSvgPath={el.customSvgPath}
                />

                {/* Switch group indicator tag for lighting circuits */}
                {(layerVisibility ? layerVisibility.annotations : showAnnotations) && (el.category === 'switch' || el.category === 'light') && el.switchGroupId && (
                  <Group x={16} y={-14} listening={false}>
                    <Rect
                      x={-10}
                      y={-7}
                      width={20}
                      height={14}
                      cornerRadius={3}
                      fill="#0f172a"
                      stroke="#fbbf24"
                      strokeWidth={1}
                    />
                    <Text
                      x={-10}
                      y={-5}
                      width={20}
                      text={el.switchGroupId}
                      fontSize={8}
                      fontStyle="bold"
                      fill="#fbbf24"
                      align="center"
                    />
                  </Group>
                )}

                {/* Switch Phase L incoming power feed indicator (ПУЕ §6.1.14: Фазний провід L тільки через вимикач) */}
                {(layerVisibility ? layerVisibility.annotations : showAnnotations) && el.category === 'switch' && (
                  <Group
                    x={-24}
                    y={-14}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      onOpenSwitchWiringDiagram?.(el);
                    }}
                    title="Клацніть для перегляду повної монтажної схеми підключення вимикача за ПУЕ (L ➔ SW ➔ L')"
                  >
                    <Rect
                      x={-22}
                      y={-7}
                      width={44}
                      height={14}
                      cornerRadius={3}
                      fill="#451a03"
                      stroke="#f59e0b"
                      strokeWidth={1}
                      shadowColor="black"
                      shadowBlur={4}
                    />
                    <Text
                      x={-22}
                      y={-5}
                      width={44}
                      text="⚡ L ➔ L'"
                      fontSize={7.5}
                      fontStyle="bold"
                      fill="#fde047"
                      align="center"
                    />
                  </Group>
                )}
              </Group>
            );
          })}

          {/* CIRCUIT BADGES & LEADERS (ANTI-COLLISION FOR INSTALLERS) */}
          {(layerVisibility ? layerVisibility.circuitBadges !== false : true) && showCircuitBadges && showAnnotations && (
            <Group listening={false}>
              {circuitBadgeLayouts.map((b) => (
                <Group key={`badge_${b.elementId}`}>
                  {/* Leader Line with anchor dot */}
                  {b.hasLeader && (
                    <Group>
                      <Line
                        points={b.leaderPoints}
                        stroke={b.circuitColor}
                        strokeWidth={1.2}
                        dash={[3, 2]}
                        opacity={0.85}
                      />
                      <Circle
                        x={b.elementPos.x}
                        y={b.elementPos.y}
                        radius={2.5}
                        fill={b.circuitColor}
                      />
                    </Group>
                  )}
                  {/* Badge Pill */}
                  <Rect
                    x={b.badgePos.x - b.badgeWidth / 2}
                    y={b.badgePos.y - b.badgeHeight / 2}
                    width={b.badgeWidth}
                    height={b.badgeHeight}
                    cornerRadius={3}
                    fill="#090d16"
                    stroke={b.circuitColor}
                    strokeWidth={1.2}
                    shadowColor="black"
                    shadowBlur={4}
                    shadowOpacity={0.8}
                  />
                  {/* Badge Text */}
                  <Text
                    x={b.badgePos.x - b.badgeWidth / 2}
                    y={b.badgePos.y - 4}
                    width={b.badgeWidth}
                    text={b.badgeText}
                    fontSize={8.5}
                    fontStyle="bold"
                    fontFamily="monospace"
                    fill={b.circuitColor}
                    align="center"
                  />
                </Group>
              ))}
            </Group>
          )}
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

          {/* Active Door Jamb PUE Snap Guide Preview (during drag or placement) */}
          {activeJambSnap && (
            <Group listening={false}>
              {/* Leader guide line from door jamb to element */}
              <Line
                points={activeJambSnap.guideLine}
                stroke="#10b981"
                strokeWidth={2}
                dash={[4, 2]}
              />
              {/* Jamb Anchor indicator */}
              <Circle
                x={activeJambSnap.guideLine[0]}
                y={activeJambSnap.guideLine[1]}
                radius={4.5}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
              {/* Snapped Target Point */}
              <Circle
                x={activeJambSnap.snappedPoint.x}
                y={activeJambSnap.snappedPoint.y}
                radius={5.5}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={2}
              />
              {/* Floating Dimension Tag */}
              <Group
                x={(activeJambSnap.guideLine[0] + activeJambSnap.snappedPoint.x) / 2}
                y={(activeJambSnap.guideLine[1] + activeJambSnap.snappedPoint.y) / 2 - 18}
              >
                <Rect
                  x={-95}
                  y={-10}
                  width={190}
                  height={20}
                  cornerRadius={4}
                  fill="#0f172a"
                  stroke="#10b981"
                  strokeWidth={1.5}
                />
                <Text
                  x={-95}
                  y={-5}
                  width={190}
                  text={`🚪 ${activeJambSnap.distanceFromJambMm} мм (Норматив ПУЕ/ДБН)`}
                  fontSize={9.5}
                  fontStyle="bold"
                  fill="#10b981"
                  align="center"
                />
              </Group>
            </Group>
          )}

          {/* Selected Element Door Jamb & Wall Face Dimension Leader */}
          {selectedElementId && !activeJambSnap && (() => {
            const el = project.elements.find((e) => e.id === selectedElementId);
            if (!el) return null;
            const datum = analyzeElementWallDatum(el.position, project.walls, project.openings || []);
            if (!datum || !datum.closestOpening) return null;

            const op = datum.closestOpening.opening;
            const wall = datum.wall;
            const dx = wall.end.x - wall.start.x;
            const dy = wall.end.y - wall.start.y;
            const wallLenPx = Math.hypot(dx, dy) || 1;
            const ux = dx / wallLenPx;
            const uy = dy / wallLenPx;
            const opCenterPx = {
              x: wall.start.x + op.positionRatio * dx,
              y: wall.start.y + op.positionRatio * dy,
            };
            const halfW = mmToPx(op.width || 900) / 2;
            const jambPt =
              datum.closestOpening.closestJamb === 'left'
                ? { x: opCenterPx.x - ux * halfW, y: opCenterPx.y - uy * halfW }
                : { x: opCenterPx.x + ux * halfW, y: opCenterPx.y + uy * halfW };

            return (
              <Group listening={false}>
                <Line
                  points={[jambPt.x, jambPt.y, el.position.x, el.position.y]}
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  dash={[3, 3]}
                />
                <Circle x={jambPt.x} y={jambPt.y} radius={3.5} fill="#38bdf8" stroke="#ffffff" strokeWidth={1} />
                <Group
                  x={(jambPt.x + el.position.x) / 2}
                  y={(jambPt.y + el.position.y) / 2 - 14}
                >
                  <Rect x={-60} y={-8} width={120} height={16} cornerRadius={3} fill="#0f172a" stroke="#38bdf8" strokeWidth={1} />
                  <Text
                    x={-60}
                    y={-4}
                    width={120}
                    text={`🚪 ${datum.closestOpening.distanceFromClosestJambMm} мм від укосу`}
                    fontSize={9}
                    fontStyle="bold"
                    fill="#38bdf8"
                    align="center"
                  />
                </Group>
              </Group>
            );
          })()}

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

              // Check if user typed numeric dimension via keyboard
              const typedVal = parseFloat(wallDraftLengthInput);
              const isTyped = !isNaN(typedVal) && typedVal > 0;
              let effectiveP = currentP;
              let lenMm = pxToMm(distance(wallStartPoint, currentP));
              const angleDeg = Math.round((Math.atan2(currentP.y - wallStartPoint.y, currentP.x - wallStartPoint.x) * 180) / Math.PI);
              const normAngle = (angleDeg + 360) % 360;

              if (isTyped) {
                lenMm = Math.round(typedVal);
                const angleRad = (normAngle * Math.PI) / 180;
                const lenPx = mmToPx(typedVal);
                effectiveP = {
                  x: Math.round(wallStartPoint.x + Math.cos(angleRad) * lenPx),
                  y: Math.round(wallStartPoint.y + Math.sin(angleRad) * lenPx),
                };
              }

              return (
                <Group listening={false}>
                  {/* Ortho Guide line */}
                  {activeOrtho?.isSnapped && (
                    <Line
                      points={[wallStartPoint.x, wallStartPoint.y, effectiveP.x, effectiveP.y]}
                      stroke="#06b6d4"
                      strokeWidth={1}
                      dash={[4, 4]}
                    />
                  )}
                  {/* Wall body preview */}
                  <Line
                    points={[wallStartPoint.x, wallStartPoint.y, effectiveP.x, effectiveP.y]}
                    stroke={isTyped ? '#10b981' : '#38bdf8'}
                    strokeWidth={15}
                    dash={isTyped ? [8, 2] : [6, 4]}
                    lineCap="square"
                  />
                  {/* Dimension badge */}
                  <Group x={(wallStartPoint.x + effectiveP.x) / 2} y={(wallStartPoint.y + effectiveP.y) / 2 - 18}>
                    <Rect
                      x={-60}
                      y={-10}
                      width={120}
                      height={20}
                      cornerRadius={4}
                      fill="#0f172a"
                      stroke={isTyped ? '#10b981' : '#38bdf8'}
                      strokeWidth={1}
                    />
                    <Text
                      x={-60}
                      y={-5}
                      width={120}
                      text={
                        isTyped
                          ? `📏 ${formatDimensionValue(lenMm, displayUnit, true)} [Enter]`
                          : `${formatDimensionValue(lenMm, displayUnit, true)}  ${normAngle}°`
                      }
                      fontSize={9.5}
                      fontStyle="bold"
                      fill={isTyped ? '#10b981' : '#38bdf8'}
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
                    <Rect x={-42} y={-10} width={84} height={20} cornerRadius={4} fill="#0f172a" stroke="#fbbf24" strokeWidth={1} />
                    <Text
                      x={-42}
                      y={-5}
                      width={84}
                      text={formatDimensionValue(distMm, displayUnit, true)}
                      fontSize={10}
                      fontStyle="bold"
                      fill="#fbbf24"
                      fontFamily="monospace"
                      align="center"
                    />
                  </Group>
                </Group>
              );
            })()}

          {/* In-progress Wire Drawing with Waypoint Turns */}
          {wireSourceElementId &&
            (() => {
              const srcEl = project.elements.find((e) => e.id === wireSourceElementId);
              if (!srcEl) return null;

              const pointsList = wireDraftPoints.length > 0 ? wireDraftPoints : [srcEl.position];
              const lastPoint = pointsList[pointsList.length - 1];

              // 90 deg orthogonal step from last point to mouse
              const stepPoint = { x: mouseWorldPos.x, y: lastPoint.y };
              const currentPath = [...pointsList, stepPoint, mouseWorldPos];
              const currentFlat = currentPath.flatMap((p) => [p.x, p.y]);

              const legDistMm = pxToMm(distance(lastPoint, mouseWorldPos));

              return (
                <Group listening={false}>
                  {/* Starting anchor */}
                  <Circle x={srcEl.position.x} y={srcEl.position.y} radius={6} fill="#38bdf8" stroke="#ffffff" strokeWidth={2} />

                  {/* Intermediate waypoint markers */}
                  {pointsList.slice(1).map((pt, idx) => (
                    <Group key={`wp_${idx}`} x={pt.x} y={pt.y}>
                      <Circle radius={5} fill="#0ea5e9" stroke="#ffffff" strokeWidth={1.5} />
                      <Text x={-12} y={-14} text={`#${idx + 1}`} fontSize={8.5} fill="#38bdf8" fontStyle="bold" />
                    </Group>
                  ))}

                  {/* Orthogonal wire path */}
                  <Line
                    points={currentFlat}
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dash={[5, 3]}
                    lineCap="round"
                    lineJoin="round"
                  />

                  {/* Live length badge */}
                  <Group x={(lastPoint.x + mouseWorldPos.x) / 2} y={(lastPoint.y + mouseWorldPos.y) / 2 - 16}>
                    <Rect x={-50} y={-9} width={100} height={18} cornerRadius={4} fill="#0f172a" stroke="#38bdf8" strokeWidth={1} />
                    <Text x={-50} y={-5} width={100} text={`${legDistMm} мм (кут 90°)`} fontSize={9} fontStyle="bold" fill="#38bdf8" fontFamily="monospace" align="center" />
                  </Group>

                  {/* Guidance banner near cursor */}
                  <Group x={mouseWorldPos.x + 15} y={mouseWorldPos.y + 15}>
                    <Rect x={0} y={0} width={255} height={24} cornerRadius={4} fill="rgba(15, 23, 42, 0.95)" stroke="#38bdf8" strokeWidth={1} />
                    <Text x={8} y={6} text="Клік: поворот 90° | Клік по приладу: з'єднати | BS: назад" fontSize={8.5} fill="#7dd3fc" />
                  </Group>
                </Group>
              );
            })()}

          {/* Hovered Wire Inspection Tooltip */}
          {hoveredWireId && !wireSourceElementId &&
            (() => {
              const hWire = project.wires.find((w) => w.id === hoveredWireId);
              if (!hWire) return null;
              const circuit = project.circuits.find((c) => c.id === hWire.circuitId);
              const fromEl = project.elements.find((e) => e.id === hWire.fromId);
              const toEl = project.elements.find((e) => e.id === hWire.toId);
              if (!fromEl || !toEl) return null;

              return (
                <Group x={mouseWorldPos.x + 18} y={mouseWorldPos.y - 45} listening={false}>
                  <Rect
                    x={0}
                    y={0}
                    width={220}
                    height={72}
                    cornerRadius={6}
                    fill="#0f172a"
                    stroke={circuit?.color || '#38bdf8'}
                    strokeWidth={1.5}
                    shadowColor="black"
                    shadowBlur={10}
                    shadowOpacity={0.6}
                  />
                  <Text x={8} y={8} text={`Траса ${hWire.cableTag || 'W'} [${circuit?.name || 'Група'}]`} fontSize={9.5} fontStyle="bold" fill="#ffffff" />
                  <Text x={8} y={23} text={`Кабель: ${getCableDisplayName(hWire.cableType)} (${getCableCrossSection(hWire.cableType)})`} fontSize={8.5} fill="#7dd3fc" />
                  <Text x={8} y={37} text={`Довжина: ${hWire.calculatedLengthM} м (${hWire.conduit === 'ceiling' ? 'Стеля в гофрі' : hWire.conduit === 'floor' ? 'У стяжці' : 'У штробі'})`} fontSize={8.5} fill="#cbd5e1" />
                  <Text x={8} y={51} text={`${fromEl.name} ➔ ${toEl.name}`} fontSize={8} fill="#94a3b8" />
                </Group>
              );
            })()}

          {/* Rubberband Box Marquee Selection Rect */}
          {boxSelectionStart && boxSelectionEnd && (() => {
            const minX = Math.min(boxSelectionStart.x, boxSelectionEnd.x);
            const minY = Math.min(boxSelectionStart.y, boxSelectionEnd.y);
            const width = Math.abs(boxSelectionEnd.x - boxSelectionStart.x);
            const height = Math.abs(boxSelectionEnd.y - boxSelectionStart.y);
            return (
              <Group listening={false}>
                <Rect
                  x={minX}
                  y={minY}
                  width={width}
                  height={height}
                  fill="rgba(56, 189, 248, 0.12)"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  dash={[4, 3]}
                />
                {multiSelectedElementIds.length > 0 && (
                  <Group x={minX + width / 2} y={minY - 18}>
                    <Rect
                      x={-55}
                      y={-9}
                      width={110}
                      height={18}
                      cornerRadius={4}
                      fill="#0f172a"
                      stroke="#38bdf8"
                      strokeWidth={1}
                    />
                    <Text
                      x={-55}
                      y={-5}
                      width={110}
                      text={`Обрано: ${multiSelectedElementIds.length} об'єктів`}
                      fontSize={9}
                      fontStyle="bold"
                      fill="#38bdf8"
                      align="center"
                    />
                  </Group>
                )}
              </Group>
            );
          })()}
        </Layer>
      </Stage>

      {/* CAD Metric Dynamic Rulers (Top & Left) */}
      <CadRuler
        width={stageDimensions.width}
        height={stageDimensions.height}
        scale={scale}
        stagePos={stagePos}
        mouseWorldPos={mouseWorldPos}
        showRulers={showRulers}
        onToggleRulers={() => setShowRulers(!showRulers)}
        onResetView={() => {
          setScale(1.05);
          setStagePos({ x: 100, y: 70 });
        }}
      />

      {/* AutoCAD Professional Model Space Status Bar (X, Y, Z, Snap, Annotation, Style, Switch Diagram) */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-neutral-950/95 border-t border-neutral-800 text-[11px] font-mono flex items-center justify-between px-3 z-30 select-none backdrop-blur-sm">
        {/* Left: Real-time Millimeter Coordinates */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-neutral-300">
            <span className="text-neutral-500">X:</span>
            <span className="tabular-nums font-semibold text-sky-400">
              {formatDimensionValue(pxToMm(mouseWorldPos.x), displayUnit, false)}
            </span>
            <span className="text-neutral-600">{unitLabel}</span>
            <span className="text-neutral-500 ml-1">Y:</span>
            <span className="tabular-nums font-semibold text-sky-400">
              {formatDimensionValue(pxToMm(mouseWorldPos.y), displayUnit, false)}
            </span>
            <span className="text-neutral-600">{unitLabel}</span>
            <span className="text-neutral-500 ml-1">Z:</span>
            <span className="tabular-nums text-neutral-400">0</span>
            <span className="text-neutral-600">{unitLabel}</span>
          </div>
          <div className="h-3 w-px bg-neutral-800" />
          <span className="text-[10px] text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
            М 1:100
          </span>
          {onChangeDisplayUnit && (
            <div className="flex items-center bg-neutral-900 rounded border border-neutral-800 overflow-hidden">
              {(['mm', 'cm', 'm'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => onChangeDisplayUnit(u)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
                    displayUnit === u
                      ? 'bg-sky-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title={`Одиниці вимірювання: ${getUnitLabel(u)}`}
                >
                  {getUnitLabel(u)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center/Right: AutoCAD Status Controls & Toggles */}
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-700/60">
            MODEL
          </span>

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              gridSnapEnabled
                ? 'bg-sky-950/80 text-sky-300 border border-sky-600/60'
                : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
            }`}
            title="Прив'язка до сітки"
          >
            GRID {gridSnapEnabled ? 'ON' : 'OFF'}
          </span>

          {onToggleAnnotations && (
            <button
              onClick={onToggleAnnotations}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                showAnnotations
                  ? 'bg-amber-950/70 text-amber-300 border border-amber-600/70'
                  : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:text-neutral-300'
              }`}
              title="Показати або приховати примітки, виноски та бірки кабелів на кресленні"
            >
              ПРИМІТКИ {showAnnotations ? 'ON' : 'OFF'}
            </button>
          )}

          {onToggleCircuitBadges && (
            <button
              onClick={onToggleCircuitBadges}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                showCircuitBadges
                  ? 'bg-sky-950/80 text-sky-300 border border-sky-500/80'
                  : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:text-neutral-300'
              }`}
              title="Показати або приховати мітки та номери електричних груп (ЩР/Гр.) біля приладів на кресленні"
            >
              МІТКИ ГРУП {showCircuitBadges ? 'ON' : 'OFF'}
            </button>
          )}

          {onToggleCadStyle && (
            <button
              onClick={onToggleCadStyle}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                cadStyle === 'autocad'
                  ? 'bg-slate-900 text-slate-200 border border-slate-600'
                  : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
              }`}
              title="Перемкнути стиль вигляду між AutoCAD та Modern"
            >
              СТИЛЬ: {cadStyle === 'autocad' ? 'AutoCAD' : 'Modern'}
            </button>
          )}

          <button
            onClick={() => onOpenSwitchWiringDiagram?.()}
            className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-500/60 flex items-center gap-1 transition-colors"
            title="Переглянути схему комутації вимикача за нормами ПУЕ: L ➔ Вимикач ➔ L' ➔ Світильник"
          >
            <span>⚡ СХЕМА L➔L'</span>
          </button>

          {onOpenLayersModal && (
            <button
              onClick={onOpenLayersModal}
              className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950/70 hover:bg-sky-900/80 text-sky-300 border border-sky-500/60 flex items-center gap-1 transition-colors"
              title="Відкрити диспетчер видимості шарів (AutoCAD Layer Manager)"
            >
              <span>ШАРИ (LAYERS)</span>
            </button>
          )}

          <div className="h-3.5 w-px bg-neutral-800 mx-1" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setScale((prev) => Math.max(prev * 0.8, 0.3))}
              className="w-5 h-5 flex items-center justify-center rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs transition-colors"
              title="Зменшити (-)"
            >
              -
            </button>
            <span className="text-[10px] text-neutral-400 tabular-nums px-1">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((prev) => Math.min(prev * 1.2, 4))}
              className="w-5 h-5 flex items-center justify-center rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs transition-colors"
              title="Збільшити (+)"
            >
              +
            </button>
            <button
              onClick={() => {
                setScale(1.05);
                setStagePos({ x: 100, y: 70 });
              }}
              className="px-1.5 h-5 flex items-center justify-center rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[10px] transition-colors"
              title="Скинути зум"
            >
              100%
            </button>
            <button
              onClick={() => setShowRulers(!showRulers)}
              className={`px-1.5 h-5 flex items-center justify-center rounded text-[10px] font-semibold transition-colors ${
                showRulers
                  ? 'bg-sky-950 text-sky-400 border border-sky-800'
                  : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300'
              }`}
              title="Увімкнути/вимкнути лінійку CAD"
            >
              Лінійка
            </button>
          </div>
        </div>
      </div>

      {/* Floating Interactive Wire Drafting HUD */}
      {activeTool === 'wire' && wireSourceElementId && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/95 border border-sky-500/60 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-semibold text-neutral-100">
              Трасування кабелю: <span className="text-sky-400 font-mono font-bold">{wireDraftPoints.length}</span>{' '}
              {wireDraftPoints.length === 1 ? 'точка' : 'точок'}
            </span>
          </div>
          <div className="h-4 w-px bg-neutral-700" />
          <button
            onClick={handleFinishDraftWire}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            title="Завершити трасу до найближчого приладу або створити вузол (Enter або подвійний клік на полотні)"
          >
            <span>✓ Завершити трасу (Enter)</span>
          </button>
          <button
            onClick={() => {
              setWireDraftPoints((prev) => {
                if (prev.length > 1) return prev.slice(0, prev.length - 1);
                setWireSourceElementId(null);
                return [];
              });
            }}
            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
            title="Видалити останній вузол (Backspace)"
          >
            <span>⌫ Назад</span>
          </button>
          <button
            onClick={() => {
              setWireSourceElementId(null);
              setWireDraftPoints([]);
            }}
            className="px-2.5 py-1 bg-neutral-800 hover:bg-red-950/60 hover:text-red-300 text-neutral-400 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
            title="Скасувати трасування (Esc)"
          >
            <span>✕ Скасувати (Esc)</span>
          </button>
        </div>
      )}

      {/* Floating Interactive Wall Drafting HUD */}
      {activeTool === 'wall' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/95 border border-sky-500/60 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${wallStartPoint ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'}`} />
            <span className="font-semibold text-neutral-100">
              {wallStartPoint ? 'Креслення стіни:' : 'Клікніть для початку стіни (кут 90°)'}
            </span>
          </div>

          {wallStartPoint && (
            <>
              <div className="h-4 w-px bg-neutral-700" />
              <div className="flex items-center gap-1.5 bg-neutral-950 px-2 py-1 rounded-lg border border-neutral-700">
                <span className="text-[11px] text-neutral-400 font-medium">Довжина:</span>
                <input
                  type="number"
                  min={100}
                  max={50000}
                  step={50}
                  value={wallDraftLengthInput}
                  onChange={(e) => setWallDraftLengthInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitWallWithLength();
                    }
                  }}
                  placeholder="напр. 3500"
                  className="w-24 bg-transparent text-emerald-400 font-mono text-xs font-bold focus:outline-none"
                  autoFocus
                />
                <span className="text-[11px] text-neutral-500 font-mono">мм</span>
              </div>

              {/* Quick preset lengths */}
              <div className="hidden sm:flex items-center gap-1">
                {[1500, 2500, 3000, 4000, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setWallDraftLengthInput(String(preset));
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      wallDraftLengthInput === String(preset)
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => commitWallWithLength()}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-md transition-all active:scale-95"
                title="Створити стіну заданої довжини (Enter)"
              >
                <span>✓ Задати (Enter)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWallStartPoint(null);
                  setWallDraftLengthInput('');
                }}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-red-950/60 hover:text-red-300 text-neutral-400 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                title="Скасувати (Esc)"
              >
                <span>✕ Скасувати (Esc)</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Right-Click Floating CAD Context Menu */}
      {contextMenu && (
        <div
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 w-56 bg-neutral-900/95 backdrop-blur-md border border-neutral-700 rounded-xl shadow-2xl py-1.5 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100"
        >
          {contextMenu.targetType === 'multi' && (
            <>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-400 border-b border-neutral-800 mb-1">
                Група ({multiSelectedElementIds.length} об'єктів)
              </div>
              {onAlignElements && (
                <>
                  <button
                    onClick={() => {
                      onAlignElements(multiSelectedElementIds, 'align_x');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors"
                  >
                    Вирівняти по осі X
                  </button>
                  <button
                    onClick={() => {
                      onAlignElements(multiSelectedElementIds, 'align_y');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors"
                  >
                    Вирівняти по осі Y
                  </button>
                  <button
                    onClick={() => {
                      onAlignElements(multiSelectedElementIds, 'pitch_71_h');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-sky-300 transition-colors"
                  >
                    Блок крок 71 мм (Горизонтально)
                  </button>
                  <button
                    onClick={() => {
                      onAlignElements(multiSelectedElementIds, 'pitch_71_v');
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-sky-300 transition-colors"
                  >
                    Блок крок 71 мм (Вертикально)
                  </button>
                </>
              )}
              {onCopySelection && (
                <button
                  onClick={() => {
                    onCopySelection();
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 border-t border-neutral-800 mt-1 pt-1.5 transition-colors"
                >
                  Копіювати групу (Ctrl+C)
                </button>
              )}
              <button
                onClick={() => {
                  if (onDeleteElementsBatch) {
                    onDeleteElementsBatch(multiSelectedElementIds);
                  } else {
                    multiSelectedElementIds.forEach((id) => onDeleteElement(id));
                  }
                  setMultiSelectedElementIds([]);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 text-rose-400 font-semibold transition-colors"
              >
                Видалити виділені (Del)
              </button>
            </>
          )}

          {contextMenu.targetType === 'element' && contextMenu.targetId && (() => {
            const el = project.elements.find((item) => item.id === contextMenu.targetId);
            if (!el) return null;
            return (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 mb-1 truncate">
                  {el.name}
                </div>
                <button
                  onClick={() => {
                    onUpdateElementPosition(el.id, el.position, (el.rotation + 90) % 360, el.wallId);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors"
                >
                  Повернути +90°
                </button>
                {onDuplicateElement && (
                  <button
                    onClick={() => {
                      onDuplicateElement(el.id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors"
                  >
                    Дублювати (Ctrl+D)
                  </button>
                )}
                {onCopySelection && (
                  <button
                    onClick={() => {
                      onCopySelection();
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors"
                  >
                    Копіювати (Ctrl+C)
                  </button>
                )}
                <button
                  onClick={() => {
                    onDeleteElement(el.id);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 text-rose-400 font-semibold border-t border-neutral-800 mt-1 pt-1.5 transition-colors"
                >
                  Видалити елемент (Del)
                </button>
              </>
            );
          })()}

          {contextMenu.targetType === 'wire' && contextMenu.targetId && (
            <>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-400 border-b border-neutral-800 mb-1">
                Кабельна траса
              </div>
              <button
                onClick={() => {
                  onOpenSwitchWiringDiagram?.();
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-amber-300 transition-colors"
              >
                Схема підключення L ➔ L'
              </button>
              <button
                onClick={() => {
                  onDeleteWire?.(contextMenu.targetId!);
                  onSelectWire?.(null);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 text-rose-400 font-semibold border-t border-neutral-800 mt-1 pt-1.5 transition-colors"
              >
                Видалити трасу (Del)
              </button>
            </>
          )}

          {contextMenu.targetType === 'wall' && contextMenu.targetId && (() => {
            const w = project.walls.find((item) => item.id === contextMenu.targetId);
            if (!w) return null;
            return (
              <>
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 mb-1">
                  Стіна ({w.thickness} мм)
                </div>
                {onUpdateWall && (
                  <>
                    <button
                      onClick={() => {
                        onUpdateWall(alignWallOrtho(w));
                        setContextMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors"
                    >
                      Вирівняти 90° (Орто)
                    </button>
                    <button
                      onClick={() => {
                        onUpdateWall(reverseWall(w));
                        setContextMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors"
                    >
                      Розвернути напрямок (⇄)
                    </button>
                  </>
                )}
                {onOpenWallElevation && (
                  <button
                    onClick={() => {
                      onOpenWallElevation(w.id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 text-sky-300 transition-colors"
                  >
                    Розгортка стіни та штроби
                  </button>
                )}
                {onDeleteWall && (
                  <button
                    onClick={() => {
                      onDeleteWall(w.id);
                      setContextMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 text-rose-400 font-semibold border-t border-neutral-800 mt-1 pt-1.5 transition-colors"
                  >
                    Видалити стіну
                  </button>
                )}
              </>
            );
          })()}

          {contextMenu.targetType === 'canvas' && (
            <>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 mb-1">
                Робоче поле CAD
              </div>
              {onPasteClipboard && (
                <button
                  disabled={!canPaste}
                  onClick={() => {
                    onPasteClipboard();
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 disabled:opacity-40 transition-colors"
                >
                  Вставити з буфера (Ctrl+V)
                </button>
              )}
              <button
                onClick={() => {
                  setScale(1.05);
                  setStagePos({ x: 100, y: 70 });
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors"
              >
                Скинути масштаб (100%)
              </button>
              <button
                onClick={() => {
                  setShowRulers(!showRulers);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors"
              >
                {showRulers ? 'Приховати лінійки CAD' : 'Показати лінійки CAD'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
