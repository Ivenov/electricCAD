/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  CadProject 
} from '../../types/cad';
import { 
  ThreeElectricalSceneBuilder, 
  ViewRenderMode, 
  CircuitFilterMode, 
  Scene3DStats, 
  SelectedObjectInfo 
} from '../../utils/threeElectricalScene';
import { 
  X, 
  Camera, 
  Eye, 
  Layers, 
  Zap, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  ChevronUp, 
  ChevronDown, 
  Info, 
  Check, 
  ShieldCheck, 
  Box, 
  Flame, 
  Activity,
  BatteryCharging
} from 'lucide-react';

interface ThreeDViewModalProps {
  project: CadProject;
  onClose: () => void;
}

export const ThreeDViewModal: React.FC<ThreeDViewModalProps> = ({ project, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 3D Scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const builderRef = useRef<ThreeElectricalSceneBuilder | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<ViewRenderMode>('realistic');
  const [circuitFilter, setCircuitFilter] = useState<CircuitFilterMode>('all');
  const [showChases, setShowChases] = useState(true);
  const [showConduits, setShowConduits] = useState(true);
  const [showCeiling, setShowCeiling] = useState(false); // Default to no ceiling so interior is visible immediately
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Inspector card state
  const [selectedInfo, setSelectedInfo] = useState<SelectedObjectInfo | null>(null);
  const [isDockExpanded, setIsDockExpanded] = useState(true);

  // Live scene statistics
  const [stats, setStats] = useState<Scene3DStats>({
    totalChaseLengthM: 0,
    ceilingConduitLengthM: 0,
    floorConduitLengthM: 0,
    socketBoxesCount: 0,
    switchBoxesCount: 0,
    lightsCount: 0,
    panelCount: 0,
    backupDevicesCount: 0,
  });

  // Software WebGL Detection Guard
  const isSoftwareGl = useMemo(() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16); // Deep slate CAD background
    sceneRef.current = scene;

    // Subtle atmospheric fog for spatial depth
    scene.fog = new THREE.FogExp2(0x090d16, 0.035);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Initial isometric vantage point
    camera.position.set(6, 7.5, 8);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Needed for screenshot capture
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't flip below ground
    controls.minDistance = 1.5;
    controls.maxDistance = 30;
    controls.target.set(0, 1.2, 0);
    controlsRef.current = controls;

    // 5. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xfff8ed, 1.4);
    dirLight1.position.set(8, 14, 7);
    dirLight1.castShadow = !isSoftwareGl;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 35;
    dirLight1.shadow.camera.left = -10;
    dirLight1.shadow.camera.right = 10;
    dirLight1.shadow.camera.top = 10;
    dirLight1.shadow.camera.bottom = -10;
    dirLight1.shadow.bias = -0.0005;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.45);
    dirLight2.position.set(-8, 9, -7);
    scene.add(dirLight2);

    const floorBounce = new THREE.DirectionalLight(0x0284c7, 0.2);
    floorBounce.position.set(0, -5, 0);
    scene.add(floorBounce);

    // 6. Scene Builder
    const builder = new ThreeElectricalSceneBuilder(project, scene);
    builderRef.current = builder;

    const initialStats = builder.buildScene({
      viewMode,
      circuitFilter,
      showChases,
      showConduits,
      showCeiling,
    });
    setStats(initialStats);

    // 7. Raycaster for clicking elements / wall chases
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current || !builderRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(builderRef.current.interactiveObjects, true);

      if (intersects.length > 0) {
        // Find topmost object with userData
        let target: THREE.Object3D | null = intersects[0].object;
        while (target && (!target.userData || !target.userData.id)) {
          target = target.parent;
        }

        if (target && target.userData) {
          const data = target.userData as SelectedObjectInfo;
          setSelectedInfo(data);
          return;
        }
      }
      setSelectedInfo(null);
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('pointerdown', handlePointerDown);

    // 8. Animation loop
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // Cleanup on unmount
    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      resizeObserver.disconnect();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      controls.dispose();
      renderer.dispose();
      scene.clear();
    };
  }, [project, isSoftwareGl]);

  // Re-build scene geometry when options change
  useEffect(() => {
    if (!builderRef.current) return;
    const newStats = builderRef.current.buildScene({
      viewMode,
      circuitFilter,
      showChases,
      showConduits,
      showCeiling,
    });
    setStats(newStats);
  }, [viewMode, circuitFilter, showChases, showConduits, showCeiling]);

  // Preset Camera Positions
  const setCameraView = useCallback((preset: 'perspective' | 'top' | 'panel' | 'isometric') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    switch (preset) {
      case 'perspective':
        camera.position.set(5.5, 6, 7.5);
        controls.target.set(0, 1.2, 0);
        break;
      case 'top':
        camera.position.set(0, 11, 0.01);
        controls.target.set(0, 0, 0);
        break;
      case 'isometric':
        camera.position.set(7, 7, 7);
        controls.target.set(0, 1.0, 0);
        break;
      case 'panel': {
        // Find panel in project and position camera right in front of it
        const panelEl = project.elements.find(e => e.category === 'panel');
        if (panelEl && builderRef.current) {
          const p = builderRef.current.to3DCoord(panelEl.position.x, panelEl.position.y, (panelEl.mountingHeightMm || 1600) / 1000);
          camera.position.set(p.x, p.y + 0.1, p.z + 1.2);
          controls.target.set(p.x, p.y, p.z);
        } else {
          camera.position.set(0, 1.6, 2.5);
          controls.target.set(0, 1.6, 0);
        }
        break;
      }
    }
    controls.update();
  }, [project]);

  // Take High-Res PNG Screenshot
  const handleTakeScreenshot = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${project.title || 'electroplan'}_3D_штроби_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }, [project]);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 md:p-6 animate-in fade-in duration-200`}>
      <div 
        className={`relative w-full h-full bg-neutral-950 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col ${
          isFullscreen ? 'fixed inset-0 rounded-none border-none' : 'max-w-7xl max-h-[95vh]'
        }`}
      >
        {/* Top CAD Header Bar */}
        <div className="h-14 bg-neutral-900/90 border-b border-neutral-800 px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-sky-400 font-mono shadow-sm">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  3D-Візуалізація штроблення та розведення
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950/80 text-sky-300 border border-sky-800/60">
                  WebGL / Three.js
                </span>
                {isSoftwareGl && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Software WebGL
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                {project.title} • Опуск по штробах, розведення по стелі у гофрі, стяжка підлоги
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTakeScreenshot}
              title="Зберегти 3D-знімок у високій якості"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors border border-neutral-700"
            >
              <Camera className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Знімок 3D</span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              title={isFullscreen ? 'Згорнути' : 'На весь екран'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors ml-1"
              title="Закрити вікно"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3D Viewport Area */}
        <div ref={containerRef} className="relative flex-1 w-full h-full bg-[#090d16] overflow-hidden select-none">
          <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

          {/* Top Floating Glassmorphic Control Bar */}
          <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-neutral-900/85 backdrop-blur-md p-1 rounded-xl border border-neutral-800 shadow-xl pointer-events-auto">
              <button
                onClick={() => setViewMode('realistic')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  viewMode === 'realistic'
                    ? 'bg-sky-500 text-neutral-950 font-semibold shadow-sm'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
                }`}
              >
                Реалістичний
              </button>
              <button
                onClick={() => setViewMode('xray')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  viewMode === 'xray'
                    ? 'bg-sky-500 text-neutral-950 font-semibold shadow-sm'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
                }`}
                title="Напівпрозорі стіни: видно всі внутрішні штроби та канали"
              >
                X-Ray (Прозорий)
              </button>
              <button
                onClick={() => setViewMode('chases_only')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  viewMode === 'chases_only'
                    ? 'bg-sky-500 text-neutral-950 font-semibold shadow-sm'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
                }`}
                title="Акцент суто на штробах і трасах кабелів"
              >
                Тільки траси
              </button>
              <button
                onClick={() => setViewMode('no_ceiling')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  viewMode === 'no_ceiling'
                    ? 'bg-sky-500 text-neutral-950 font-semibold shadow-sm'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/60'
                }`}
              >
                Без стелі
              </button>
            </div>

            {/* Quick Camera Views */}
            <div className="flex items-center gap-1 bg-neutral-900/85 backdrop-blur-md p-1 rounded-xl border border-neutral-800 shadow-xl pointer-events-auto">
              <button
                onClick={() => setCameraView('perspective')}
                className="px-2 py-1 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/70 rounded-lg transition-colors"
                title="3D Перспектива"
              >
                3D
              </button>
              <button
                onClick={() => setCameraView('top')}
                className="px-2 py-1 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/70 rounded-lg transition-colors"
                title="Вигляд зверху"
              >
                План
              </button>
              <button
                onClick={() => setCameraView('isometric')}
                className="px-2 py-1 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/70 rounded-lg transition-colors"
                title="Ізометричний вигляд"
              >
                Ізометрія
              </button>
              <button
                onClick={() => setCameraView('panel')}
                className="px-2 py-1 text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-950/40 rounded-lg transition-colors border border-amber-500/20"
                title="Фокус на головному щиті ВРП"
              >
                Щит ВРП
              </button>
            </div>

            {/* Circuit Filters */}
            <div className="flex items-center gap-1 bg-neutral-900/85 backdrop-blur-md p-1 rounded-xl border border-neutral-800 shadow-xl pointer-events-auto">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 px-1.5">Фільтр:</span>
              <button
                onClick={() => setCircuitFilter('all')}
                className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                  circuitFilter === 'all' ? 'bg-neutral-700 text-white font-medium' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Всі
              </button>
              <button
                onClick={() => setCircuitFilter('sockets')}
                className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                  circuitFilter === 'sockets' ? 'bg-neutral-700 text-white font-medium' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Розетки (3x2.5)
              </button>
              <button
                onClick={() => setCircuitFilter('lighting')}
                className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                  circuitFilter === 'lighting' ? 'bg-neutral-700 text-white font-medium' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Освітлення (3x1.5)
              </button>
              <button
                onClick={() => setCircuitFilter('backup')}
                className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-md transition-colors ${
                  circuitFilter === 'backup' ? 'bg-emerald-800/80 text-emerald-200 font-medium' : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <BatteryCharging className="w-3 h-3" />
                <span>ДБЖ Резерв</span>
              </button>
            </div>
          </div>

          {/* Interactive Inspector Card (when object clicked) */}
          {selectedInfo && (
            <div className="absolute top-20 right-4 w-72 bg-neutral-900/90 backdrop-blur-lg border border-sky-500/30 rounded-xl p-4 shadow-2xl text-neutral-200 animate-in fade-in slide-in-from-right duration-150 z-20">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {selectedInfo.categoryName}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedInfo(null)}
                  className="text-neutral-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <h3 className="text-sm font-semibold text-white mb-2">
                {selectedInfo.name}
              </h3>

              <div className="space-y-1.5 text-xs">
                {selectedInfo.heightMm !== undefined && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Висота монтажу:</span>
                    <span className="font-mono text-neutral-200">{selectedInfo.heightMm} мм від підлоги</span>
                  </div>
                )}
                {selectedInfo.lengthM !== undefined && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Довжина траси/штроби:</span>
                    <span className="font-mono text-sky-400 font-semibold">{selectedInfo.lengthM} пог. м</span>
                  </div>
                )}
                {selectedInfo.cableType && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Марка кабелю:</span>
                    <span className="font-mono text-neutral-200">{selectedInfo.cableType}</span>
                  </div>
                )}
                {selectedInfo.powerWatts !== undefined && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Розрахункова потужність:</span>
                    <span className="font-mono text-amber-400">{selectedInfo.powerWatts} Вт</span>
                  </div>
                )}
                {selectedInfo.conduitType && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Тип прокладки:</span>
                    <span className="text-neutral-300">{selectedInfo.conduitType}</span>
                  </div>
                )}
                {selectedInfo.isBackupPriority && (
                  <div className="mt-2 py-1 px-2 rounded bg-emerald-950/60 border border-emerald-500/40 text-[11px] text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Лінія гарантованого живлення (ДБЖ / АКБ)</span>
                  </div>
                )}
                {selectedInfo.notes && (
                  <div className="text-[11px] text-neutral-400 mt-2 bg-neutral-950/60 p-2 rounded border border-neutral-800">
                    {selectedInfo.notes}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Left Layer Visibility Badges */}
          <div className="absolute top-20 left-4 flex flex-col gap-1.5 bg-neutral-900/80 backdrop-blur-md p-2 rounded-xl border border-neutral-800 shadow-xl z-10">
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-1">
              Шари креслення
            </span>
            <label className="flex items-center gap-2 text-xs text-neutral-300 hover:text-white cursor-pointer px-1 py-0.5">
              <input
                type="checkbox"
                checked={showChases}
                onChange={(e) => setShowChases(e.target.checked)}
                className="rounded border-neutral-700 text-sky-500 focus:ring-0"
              />
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-neutral-600 inline-block border border-neutral-400" />
                Штроби у стінах
              </span>
            </label>
            <label className="flex items-center gap-2 text-xs text-neutral-300 hover:text-white cursor-pointer px-1 py-0.5">
              <input
                type="checkbox"
                checked={showConduits}
                onChange={(e) => setShowConduits(e.target.checked)}
                className="rounded border-neutral-700 text-sky-500 focus:ring-0"
              />
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                Гофра по стелі / в підлозі
              </span>
            </label>
            <label className="flex items-center gap-2 text-xs text-neutral-300 hover:text-white cursor-pointer px-1 py-0.5">
              <input
                type="checkbox"
                checked={showCeiling}
                onChange={(e) => setShowCeiling(e.target.checked)}
                className="rounded border-neutral-700 text-sky-500 focus:ring-0"
              />
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-neutral-700 inline-block" />
                Плита перекриття стелі
              </span>
            </label>
          </div>

          {/* Navigation Hints */}
          <div className="absolute bottom-4 left-4 hidden md:flex items-center gap-3 text-[11px] text-neutral-400 bg-neutral-900/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 pointer-events-none z-10">
            <span>🖱️ <strong>Ліва кнопка:</strong> Обертання</span>
            <span>•</span>
            <span>🖱️ <strong>Права кнопка:</strong> Панорамування</span>
            <span>•</span>
            <span>⚙️ <strong>Колесо:</strong> Масштаб</span>
            <span>•</span>
            <span>🎯 <strong>Клік:</strong> Інспекція елемента</span>
          </div>

          {/* Bottom Collapsible Engineering Dock */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-4xl pointer-events-auto">
            <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300">
              {/* Dock Header & Toggle */}
              <div 
                onClick={() => setIsDockExpanded(!isDockExpanded)}
                className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-neutral-800/40 transition-colors border-b border-neutral-800/60"
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Інженерний кошторис штроблення та кабельних ліній
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-neutral-800 text-neutral-300">
                    ПУЕ / ДБН В.2.5-23:2010
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-400">
                    {isDockExpanded ? 'Згорнути' : 'Розгорнути показники'}
                  </span>
                  {isDockExpanded ? <ChevronDown className="w-4 h-4 text-neutral-400" /> : <ChevronUp className="w-4 h-4 text-neutral-400" />}
                </div>
              </div>

              {/* Dock Body Content */}
              {isDockExpanded && (
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 animate-in fade-in duration-200">
                  {/* Card 1: Wall Chasing */}
                  <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800">
                    <div className="text-[10px] text-neutral-400 font-medium flex items-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Штроби у стінах</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-white">
                      {stats.totalChaseLengthM.toFixed(1)} <span className="text-xs font-normal text-neutral-400">м</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      вертикальні опуски 25×25мм
                    </div>
                  </div>

                  {/* Card 2: Ceiling Conduits */}
                  <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800">
                    <div className="text-[10px] text-neutral-400 font-medium flex items-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <span>Гофра по стелі</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-sky-400">
                      {stats.ceilingConduitLengthM.toFixed(1)} <span className="text-xs font-normal text-neutral-400">м</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      ПВХ $\varnothing 20$ з кліпсами
                    </div>
                  </div>

                  {/* Card 3: Floor Screed Conduits */}
                  <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800">
                    <div className="text-[10px] text-neutral-400 font-medium flex items-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      <span>Гофра у стяжці</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-orange-300">
                      {stats.floorConduitLengthM.toFixed(1)} <span className="text-xs font-normal text-neutral-400">м</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      ПНД важка в підлозі
                    </div>
                  </div>

                  {/* Card 4: Socket Boxes */}
                  <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800">
                    <div className="text-[10px] text-neutral-400 font-medium flex items-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Підрозетники</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-white">
                      {stats.socketBoxesCount + stats.switchBoxesCount} <span className="text-xs font-normal text-neutral-400">шт</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      коронка $\varnothing 68$ мм
                    </div>
                  </div>

                  {/* Card 5: Luminaires */}
                  <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800">
                    <div className="text-[10px] text-neutral-400 font-medium flex items-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span>Точки освітлення</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-white">
                      {stats.lightsCount} <span className="text-xs font-normal text-neutral-400">шт</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      люстри, споти, LED
                    </div>
                  </div>

                  {/* Card 6: Backup Equipment */}
                  <div className="bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800">
                    <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mb-1">
                      <BatteryCharging className="w-3 h-3 text-emerald-400" />
                      <span>ДБЖ та щит</span>
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-400">
                      {stats.panelCount + stats.backupDevicesCount} <span className="text-xs font-normal text-neutral-400">вузли</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">
                      ВРП + Інвертор + АКБ
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
