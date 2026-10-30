/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { CadProject, ElectricalElement, Wall, WireRoute, WallOpening } from '../types/cad';

export interface Scene3DStats {
  totalChaseLengthM: number;
  ceilingConduitLengthM: number;
  floorConduitLengthM: number;
  socketBoxesCount: number;
  switchBoxesCount: number;
  lightsCount: number;
  panelCount: number;
  backupDevicesCount: number;
}

export interface SelectedObjectInfo {
  id: string;
  type: 'element' | 'wire' | 'chase' | 'wall';
  name: string;
  categoryName: string;
  heightMm?: number;
  lengthM?: number;
  cableType?: string;
  circuitName?: string;
  circuitColor?: string;
  conduitType?: string;
  powerWatts?: number;
  isBackupPriority?: boolean;
  notes?: string;
}

export type ViewRenderMode = 'realistic' | 'xray' | 'chases_only' | 'no_ceiling';
export type CircuitFilterMode = 'all' | 'sockets' | 'lighting' | 'backup';

export class ThreeElectricalSceneBuilder {
  private project: CadProject;
  private scene: THREE.Scene;
  private centerX: number;
  private centerY: number;
  private scaleM: number = 0.01; // 100px = 1m -> 1px = 0.01m
  private ceilingHeightM: number;
  
  // Groups for easy toggling
  public wallsGroup = new THREE.Group();
  public floorGroup = new THREE.Group();
  public ceilingGroup = new THREE.Group();
  public chasesGroup = new THREE.Group();
  public conduitsGroup = new THREE.Group();
  public elementsGroup = new THREE.Group();
  public backupGroup = new THREE.Group();

  // Interactive meshes mapped for raycasting
  public interactiveObjects: THREE.Object3D[] = [];

  constructor(project: CadProject, scene: THREE.Scene) {
    this.project = project;
    this.scene = scene;
    this.ceilingHeightM = (project.ceilingHeightMm || 2700) / 1000;

    // Calculate bounding center of the floor plan
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    if (project.walls.length > 0) {
      project.walls.forEach(w => {
        minX = Math.min(minX, w.start.x, w.end.x);
        maxX = Math.max(maxX, w.start.x, w.end.x);
        minY = Math.min(minY, w.start.y, w.end.y);
        maxY = Math.max(maxY, w.start.y, w.end.y);
      });
    } else {
      minX = 0; maxX = 800; minY = 0; maxY = 600;
    }
    this.centerX = (minX + maxX) / 2;
    this.centerY = (minY + maxY) / 2;
  }

  public to3DCoord(x: number, y: number, heightM: number = 0): THREE.Vector3 {
    return new THREE.Vector3(
      (x - this.centerX) * this.scaleM,
      heightM,
      (y - this.centerY) * this.scaleM
    );
  }

  public buildScene(options: {
    viewMode: ViewRenderMode;
    circuitFilter: CircuitFilterMode;
    showChases: boolean;
    showConduits: boolean;
    showCeiling: boolean;
  }): Scene3DStats {
    // Clear previous children
    this.wallsGroup.clear();
    this.floorGroup.clear();
    this.ceilingGroup.clear();
    this.chasesGroup.clear();
    this.conduitsGroup.clear();
    this.elementsGroup.clear();
    this.backupGroup.clear();
    this.interactiveObjects = [];

    const stats: Scene3DStats = {
      totalChaseLengthM: 0,
      ceilingConduitLengthM: 0,
      floorConduitLengthM: 0,
      socketBoxesCount: 0,
      switchBoxesCount: 0,
      lightsCount: 0,
      panelCount: 0,
      backupDevicesCount: 0,
    };

    // 1. Floor & Grid Slab
    this.buildFloorAndCeiling(options.viewMode, options.showCeiling);

    // 2. Walls with Openings
    this.buildWalls(options.viewMode);

    // 3. Electrical Equipment (Sockets, Switches, Panels, Lights, UPS)
    this.buildElements(options.circuitFilter, stats);

    // 4. Wall Chases (Штроби)
    if (options.showChases) {
      this.buildWallChases(options.viewMode, options.circuitFilter, stats);
    }

    // 5. Cable Conduits (Гофра по стелі та в стяжці)
    if (options.showConduits) {
      this.buildConduits(options.viewMode, options.circuitFilter, stats);
    }

    // Add root groups to scene
    this.scene.add(this.floorGroup);
    this.scene.add(this.ceilingGroup);
    this.scene.add(this.wallsGroup);
    this.scene.add(this.chasesGroup);
    this.scene.add(this.conduitsGroup);
    this.scene.add(this.elementsGroup);
    this.scene.add(this.backupGroup);

    return stats;
  }

  private buildFloorAndCeiling(viewMode: ViewRenderMode, showCeiling: boolean) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    this.project.walls.forEach(w => {
      minX = Math.min(minX, w.start.x, w.end.x);
      maxX = Math.max(maxX, w.start.x, w.end.x);
      minY = Math.min(minY, w.start.y, w.end.y);
      maxY = Math.max(maxY, w.start.y, w.end.y);
    });

    const pad = 60;
    const widthM = (maxX - minX + pad * 2) * this.scaleM;
    const depthM = (maxY - minY + pad * 2) * this.scaleM;
    const slabThickness = 0.15; // 150mm concrete slab

    // Floor Slab (Rough screed / стяжка підлоги)
    const floorGeo = new THREE.BoxGeometry(widthM, slabThickness, depthM);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x242830,
      roughness: 0.85,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -slabThickness / 2, 0);
    floorMesh.receiveShadow = true;
    this.floorGroup.add(floorMesh);

    // Subtle floor grid to feel like a high-precision engineering CAD model
    const gridHelper = new THREE.GridHelper(Math.max(widthM, depthM), Math.round(Math.max(widthM, depthM) * 2), 0x0284c7, 0x1e293b);
    gridHelper.position.set(0, 0.001, 0);
    this.floorGroup.add(gridHelper);

    // Room name floor plaques
    if (this.project.rooms && this.project.rooms.length > 0) {
      this.project.rooms.forEach(room => {
        let rx = 0, ry = 0;
        room.points.forEach(p => { rx += p.x; ry += p.y; });
        rx /= room.points.length;
        ry /= room.points.length;
        const pos = this.to3DCoord(rx, ry, 0.005);

        // Marker disc
        const discGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.002, 16);
        const discMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.25 });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.position.copy(pos);
        this.floorGroup.add(disc);
      });
    }

    // Ceiling Slab (Rough ceiling concrete with anchor tracks)
    if (showCeiling && viewMode !== 'no_ceiling') {
      const ceilingGeo = new THREE.BoxGeometry(widthM, slabThickness, depthM);
      const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0x1e2229,
        roughness: 0.9,
        metalness: 0.05,
        transparent: viewMode === 'xray' || viewMode === 'chases_only',
        opacity: viewMode === 'xray' ? 0.2 : (viewMode === 'chases_only' ? 0.08 : 0.85),
      });
      const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
      ceilingMesh.position.set(0, this.ceilingHeightM + slabThickness / 2, 0);
      ceilingMesh.receiveShadow = true;
      this.ceilingGroup.add(ceilingMesh);
    }
  }

  private buildWalls(viewMode: ViewRenderMode) {
    const isGhostMode = viewMode === 'chases_only';
    const isXray = viewMode === 'xray';

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: isGhostMode ? 0x0f172a : 0x334155,
      roughness: 0.7,
      metalness: 0.1,
      transparent: isGhostMode || isXray,
      opacity: isGhostMode ? 0.12 : (isXray ? 0.25 : 0.92),
      wireframe: false,
      depthWrite: !isGhostMode && !isXray,
    });

    this.project.walls.forEach(wall => {
      const p1 = this.to3DCoord(wall.start.x, wall.start.y, 0);
      const p2 = this.to3DCoord(wall.end.x, wall.end.y, 0);

      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length < 0.05) return;

      const angle = Math.atan2(dz, dx);
      const thickness = (wall.thickness || 150) / 1000;
      const height = this.ceilingHeightM;

      // Find openings belonging to this wall
      const wallOpenings = (this.project.openings || []).filter(o => o.wallId === wall.id);

      if (wallOpenings.length === 0) {
        // Solid wall segment
        const geo = new THREE.BoxGeometry(length, height, thickness);
        const mesh = new THREE.Mesh(geo, wallMaterial);
        mesh.position.set((p1.x + p2.x) / 2, height / 2, (p1.z + p2.z) / 2);
        mesh.rotation.y = -angle;
        mesh.castShadow = !isGhostMode && !isXray;
        mesh.receiveShadow = true;
        this.wallsGroup.add(mesh);
      } else {
        // Wall with door/window openings
        // Subdivide along wall length
        const sortedOpenings = [...wallOpenings].sort((a, b) => a.positionRatio - b.positionRatio);
        let currentU = 0; // ratio 0 to 1

        sortedOpenings.forEach(op => {
          const opWidthM = (op.width || 800) / 1000;
          const opRatioWidth = opWidthM / length;
          const opStartU = Math.max(0, op.positionRatio - opRatioWidth / 2);
          const opEndU = Math.min(1, op.positionRatio + opRatioWidth / 2);

          // 1. Left solid section before opening
          if (opStartU > currentU + 0.01) {
            const segLen = (opStartU - currentU) * length;
            const segMidRatio = (currentU + opStartU) / 2;
            const geo = new THREE.BoxGeometry(segLen, height, thickness);
            const mesh = new THREE.Mesh(geo, wallMaterial);
            mesh.position.set(
              p1.x + dx * segMidRatio,
              height / 2,
              p1.z + dz * segMidRatio
            );
            mesh.rotation.y = -angle;
            this.wallsGroup.add(mesh);
          }

          // 2. Opening lintel (перемичка над отвором)
          const openingMidRatio = (opStartU + opEndU) / 2;
          const openingActualLen = (opEndU - opStartU) * length;
          const doorTopM = op.type === 'door' ? 2.1 : 2.2;
          const lintelHeight = Math.max(0.1, height - doorTopM);

          const lintelGeo = new THREE.BoxGeometry(openingActualLen, lintelHeight, thickness);
          const lintelMesh = new THREE.Mesh(lintelGeo, wallMaterial);
          lintelMesh.position.set(
            p1.x + dx * openingMidRatio,
            doorTopM + lintelHeight / 2,
            p1.z + dz * openingMidRatio
          );
          lintelMesh.rotation.y = -angle;
          this.wallsGroup.add(lintelMesh);

          // 3. For window: sill (підвіконна частина)
          if (op.type === 'window') {
            const sillHeight = 0.85; // 850mm
            const sillGeo = new THREE.BoxGeometry(openingActualLen, sillHeight, thickness);
            const sillMesh = new THREE.Mesh(sillGeo, wallMaterial);
            sillMesh.position.set(
              p1.x + dx * openingMidRatio,
              sillHeight / 2,
              p1.z + dz * openingMidRatio
            );
            sillMesh.rotation.y = -angle;
            this.wallsGroup.add(sillMesh);
          }

          currentU = opEndU;
        });

        // Right solid section after last opening
        if (currentU < 0.99) {
          const segLen = (1 - currentU) * length;
          const segMidRatio = (currentU + 1) / 2;
          const geo = new THREE.BoxGeometry(segLen, height, thickness);
          const mesh = new THREE.Mesh(geo, wallMaterial);
          mesh.position.set(
            p1.x + dx * segMidRatio,
            height / 2,
            p1.z + dz * segMidRatio
          );
          mesh.rotation.y = -angle;
          this.wallsGroup.add(mesh);
        }
      }
    });
  }

  private buildElements(filter: CircuitFilterMode, stats: Scene3DStats) {
    this.project.elements.forEach(el => {
      // Filter out if not matching circuit selection
      if (filter === 'sockets' && el.category !== 'socket' && el.category !== 'panel') return;
      if (filter === 'lighting' && el.category !== 'light' && el.category !== 'switch' && el.category !== 'panel') return;
      if (filter === 'backup' && !el.isBackupPriority && el.category !== 'backup') return;

      const pos = this.to3DCoord(el.position.x, el.position.y, (el.mountingHeightMm || 300) / 1000);
      const rotY = (-(el.rotation || 0) * Math.PI) / 180;

      switch (el.category) {
        case 'socket':
          this.buildSocket3D(el, pos, rotY);
          stats.socketBoxesCount++;
          break;
        case 'switch':
          this.buildSwitch3D(el, pos, rotY);
          stats.switchBoxesCount++;
          break;
        case 'light':
          this.buildLight3D(el, pos, rotY);
          stats.lightsCount++;
          break;
        case 'panel':
          this.buildPanel3D(el, pos, rotY);
          stats.panelCount++;
          break;
        case 'backup':
          this.buildBackupDevice3D(el, pos, rotY);
          stats.backupDevicesCount++;
          break;
        default:
          this.buildGenericDevice3D(el, pos, rotY);
      }
    });
  }

  // Socket 3D model (Підрозетник $\varnothing 68$ мм + рамка + контактна група + заземлення)
  private buildSocket3D(el: ElectricalElement, pos: THREE.Vector3, rotY: number) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    // Flush backbox (Підрозетник $\varnothing 68$ мм втоплений у стіну)
    const boxGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.045, 18);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Electrical blue installation plastic
      roughness: 0.5,
      metalness: 0.1,
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.rotation.x = Math.PI / 2;
    boxMesh.position.z = -0.02;
    group.add(boxMesh);

    // Decorative frame (Рамка)
    const frameGeo = new THREE.BoxGeometry(0.082, 0.082, 0.009);
    const frameMat = new THREE.MeshStandardMaterial({
      color: el.isBackupPriority ? 0x059669 : 0xf8fafc,
      roughness: 0.25,
      metalness: 0.05,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = 0.005;
    group.add(frameMesh);

    // Pin inserts / sockets
    const pinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const hole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.008, 8), pinMat);
    hole1.rotation.x = Math.PI / 2;
    hole1.position.set(-0.01, 0, 0.01);
    const hole2 = hole1.clone();
    hole2.position.set(0.01, 0, 0.01);
    group.add(hole1);
    group.add(hole2);

    // Earth pin bracket (Schuko вусики заземлення)
    const earthMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.8 });
    const earthPin = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.008, 0.002), earthMat);
    earthPin.position.set(0, 0.014, 0.009);
    group.add(earthPin);

    // Multi-gang sockets (2x, 3x, 4x)
    if (el.type.includes('double')) {
      const frame2 = frameMesh.clone();
      frame2.position.x += 0.071;
      group.add(frame2);
      const h1 = hole1.clone(); h1.position.x += 0.071; group.add(h1);
      const h2 = hole2.clone(); h2.position.x += 0.071; group.add(h2);
    } else if (el.type.includes('triple')) {
      for (let i = 1; i <= 2; i++) {
        const frameN = frameMesh.clone();
        frameN.position.x += 0.071 * i;
        group.add(frameN);
        const h1 = hole1.clone(); h1.position.x += 0.071 * i; group.add(h1);
        const h2 = hole2.clone(); h2.position.x += 0.071 * i; group.add(h2);
      }
    }

    // Attach metadata for raycaster inspection
    frameMesh.userData = {
      id: el.id,
      type: 'element',
      name: el.name || 'Розетка 230В',
      categoryName: 'Силова розетка 230В',
      heightMm: el.mountingHeightMm,
      circuitId: el.circuitId,
      powerWatts: el.powerWatts,
      isBackupPriority: el.isBackupPriority,
      notes: el.isBackupPriority ? 'Підключено до лінії гарантованого живлення ДБЖ' : 'Стандартна лінія 230В',
    };
    this.interactiveObjects.push(frameMesh);
    this.elementsGroup.add(group);
  }

  // Switch 3D model (Клавішний вимикач 900 мм)
  private buildSwitch3D(el: ElectricalElement, pos: THREE.Vector3, rotY: number) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    // Backbox
    const boxGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.045, 18);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.rotation.x = Math.PI / 2;
    boxMesh.position.z = -0.02;
    group.add(boxMesh);

    // Frame
    const frameGeo = new THREE.BoxGeometry(0.082, 0.082, 0.008);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.z = 0.004;
    group.add(frameMesh);

    // Rocker key (Клавіша)
    const isDouble = el.type === 'switch_2g';
    if (isDouble) {
      const keyGeo = new THREE.BoxGeometry(0.034, 0.07, 0.005);
      const keyMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 });
      const key1 = new THREE.Mesh(keyGeo, keyMat);
      key1.position.set(-0.019, 0, 0.008);
      const key2 = new THREE.Mesh(keyGeo, keyMat);
      key2.position.set(0.019, 0, 0.008);
      group.add(key1);
      group.add(key2);
    } else {
      const keyGeo = new THREE.BoxGeometry(0.07, 0.07, 0.005);
      const keyMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 });
      const key = new THREE.Mesh(keyGeo, keyMat);
      key.position.set(0, 0, 0.008);
      group.add(key);
    }

    // Micro LED indicator
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 0.002), ledMat);
    led.position.set(0, -0.025, 0.011);
    group.add(led);

    frameMesh.userData = {
      id: el.id,
      type: 'element',
      name: el.name || 'Вимикач освітлення',
      categoryName: 'Вимикач освітлення',
      heightMm: el.mountingHeightMm,
      circuitId: el.circuitId,
      notes: `Група комутації: ${el.switchGroupId || 'L1'}`,
    };
    this.interactiveObjects.push(frameMesh);
    this.elementsGroup.add(group);
  }

  // Ceiling or Wall Luminaire 3D model (Світильник / спот / люстра / трек)
  private buildLight3D(el: ElectricalElement, pos: THREE.Vector3, rotY: number) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    if (el.type === 'light_spot') {
      // Recessed ceiling spotlight (Точковий спот $\varnothing 85$ мм)
      const ringGeo = new THREE.TorusGeometry(0.045, 0.008, 12, 24);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.8 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      const glassGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.01, 16);
      const glassMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.y = 0.005;
      group.add(glass);
    } else if (el.type === 'light_sconce') {
      // Wall sconce (Бра настінне)
      const baseGeo = new THREE.BoxGeometry(0.06, 0.12, 0.03);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      group.add(base);

      const tubeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.22, 16);
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.z = 0.05;
      group.add(tube);
    } else {
      // Chandelier / pendant lamp (Люстра підвісна)
      const canopy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 })
      );
      canopy.position.y = 0;
      group.add(canopy);

      // Suspension cable
      const cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.002, 0.002, 0.45, 8),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      cord.position.y = -0.225;
      group.add(cord);

      // Modern geometric lampshade
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.25, 0.16, 24),
        new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.3,
          metalness: 0.7,
        })
      );
      shade.position.y = -0.45;
      group.add(shade);

      // Glowing bulb
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffedd5 })
      );
      bulb.position.y = -0.45;
      group.add(bulb);
    }

    // Interactive hit box
    const hitBox = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.userData = {
      id: el.id,
      type: 'element',
      name: el.name || 'Світильник',
      categoryName: 'Точка освітлення',
      heightMm: el.mountingHeightMm,
      circuitId: el.circuitId,
      powerWatts: el.powerWatts,
      notes: `Потужність: ${el.powerWatts} Вт`,
    };
    this.interactiveObjects.push(hitBox);
    group.add(hitBox);

    this.elementsGroup.add(group);
  }

  // Distribution Board / Panel 3D Model (ВРП / ЩРН металевий щит)
  // Distribution Board / Panel 3D Model (Schneider Electric Resi9 / Prisma or Hager Volta/Golf)
  private buildPanel3D(el: ElectricalElement, pos: THREE.Vector3, rotY: number) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    const lowerName = (el.name || '').toLowerCase();
    const isHager = lowerName.includes('hager') || lowerName.includes('volta') || lowerName.includes('golf');

    if (isHager) {
      // ----------------- HAGER VOLTA / GOLF ENCLOSURE -----------------
      // White powder-coated sheet metal cabinet (480mm x 630mm x 95mm flush)
      const bodyGeo = new THREE.BoxGeometry(0.48, 0.63, 0.11);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9, // Hager Signal White RAL9016
        roughness: 0.35,
        metalness: 0.2,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      group.add(body);

      // Hager sheet steel door with recessed ergonomic handle
      const doorGeo = new THREE.BoxGeometry(0.46, 0.61, 0.015);
      const doorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.1 });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.z = 0.06;
      group.add(door);

      // Recessed ergonomic handle pocket
      const handlePocket = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.09, 0.008),
        new THREE.MeshStandardMaterial({ color: 0x005ca9, roughness: 0.3 }) // Hager blue accent
      );
      handlePocket.position.set(0.19, 0, 0.068);
      group.add(handlePocket);

      // Hager Blue Brand Logo Badge
      const logoBadge = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.022, 0.003),
        new THREE.MeshStandardMaterial({ color: 0x005ca9, roughness: 0.2 })
      );
      logoBadge.position.set(-0.16, 0.26, 0.069);
      group.add(logoBadge);

      // Hager circuit schedule transparent window pocket
      const cardSlot = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.045, 0.002),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 })
      );
      cardSlot.position.set(0, -0.22, 0.068);
      group.add(cardSlot);

      // Hager QuickConnect N / PE terminal blocks at top
      const nTerm = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.02, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x0284c7 }) // Blue N
      );
      nTerm.position.set(-0.10, 0.27, 0.02);
      group.add(nTerm);

      const peTerm = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.02, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x65a30d }) // Yellow/Green PE
      );
      peTerm.position.set(0.10, 0.27, 0.02);
      group.add(peTerm);

      // 3 DIN rails with Hager modular circuit breakers (Blue / Black toggles)
      for (let row = -1; row <= 1; row++) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.40, 0.015, 0.005),
          new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9 })
        );
        rail.position.set(0, row * 0.15, 0.01);
        group.add(rail);

        for (let m = -6; m <= 6; m++) {
          const mcb = new THREE.Mesh(
            new THREE.BoxGeometry(0.0175, 0.078, 0.05),
            new THREE.MeshStandardMaterial({
              color: m === 0 ? 0x005ca9 : m === -6 ? 0xdc2626 : 0xf8fafc,
              roughness: 0.35,
            })
          );
          mcb.position.set(m * 0.021, row * 0.15, 0.035);
          group.add(mcb);
        }
      }

      body.userData = {
        id: el.id,
        type: 'element',
        name: el.name || 'Розподільчий щит Hager Volta 36M',
        categoryName: 'Електрощит Hager Volta (Німеччина)',
        heightMm: el.mountingHeightMm,
        notes: 'Металеві дверцята, самозатискні клеми QuickConnect N/PE, захист IP30/IP40',
      };
      this.interactiveObjects.push(body);
    } else {
      // ----------------- SCHNEIDER ELECTRIC RESI9 / PRISMA -----------------
      // White industrial enclosure with signature Schneider Emerald Green stripe
      const bodyGeo = new THREE.BoxGeometry(0.46, 0.62, 0.13);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc, // Pure white RAL9003
        roughness: 0.3,
        metalness: 0.15,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      group.add(body);

      // Signature Schneider Emerald Green Horizontal Line Accent
      const greenStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.462, 0.012, 0.003),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.2 }) // Schneider Green
      );
      greenStripe.position.set(0, 0.28, 0.066);
      group.add(greenStripe);

      // Smoked transparent acrylic swing door (Resi9 style)
      const doorGeo = new THREE.BoxGeometry(0.42, 0.54, 0.01);
      const doorMat = new THREE.MeshPhysicalMaterial({
        color: 0x0f172a,
        roughness: 0.08,
        metalness: 0.1,
        transparent: true,
        opacity: 0.65,
        transmission: 0.6,
      });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, -0.01, 0.07);
      group.add(door);

      // Chrome Keylock / latch cylinder
      const lockMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.008, 16),
        new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.95, roughness: 0.1 })
      );
      lockMesh.rotation.x = Math.PI / 2;
      lockMesh.position.set(0.18, -0.01, 0.076);
      group.add(lockMesh);

      // Schneider Electric Brand badge
      const schneiderBadge = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.018, 0.002),
        new THREE.MeshStandardMaterial({ color: 0x16a34a })
      );
      schneiderBadge.position.set(-0.13, 0.24, 0.067);
      group.add(schneiderBadge);

      // Internal DIN rails with Schneider Acti9 / Resi9 modular circuit breakers
      for (let row = -1; row <= 1; row++) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.38, 0.015, 0.005),
          new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9 })
        );
        rail.position.set(0, row * 0.15 - 0.01, 0.01);
        group.add(rail);

        // Schneider Breakers with bright orange Acti9/Resi9 toggle levers
        for (let m = -5; m <= 5; m++) {
          const mcbBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.018, 0.08, 0.05),
            new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 })
          );
          mcbBody.position.set(m * 0.022, row * 0.15 - 0.01, 0.035);
          group.add(mcbBody);

          // Orange Acti9 toggle lever
          const toggle = new THREE.Mesh(
            new THREE.BoxGeometry(0.008, 0.018, 0.01),
            new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.2 }) // Schneider Orange
          );
          toggle.position.set(m * 0.022, row * 0.15 - 0.01, 0.062);
          group.add(toggle);
        }
      }

      // Digital Voltage Relay (ZUBR D2-63 red LED 7-segment 232V display)
      const ledDisp = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.025, 0.01),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      ledDisp.position.set(-0.12, 0.14, 0.062);
      group.add(ledDisp);

      body.userData = {
        id: el.id,
        type: 'element',
        name: el.name || 'Щит Schneider Electric Resi9 36M',
        categoryName: 'Електрощит Schneider Electric (Франція)',
        heightMm: el.mountingHeightMm,
        notes: `Ввідний автомат: ${this.project.mainBreakerRatingA || 40}A, реле напруги ZUBR, ПЗВ 30мА`,
      };
      this.interactiveObjects.push(body);
    }

    this.elementsGroup.add(group);
  }

  // Backup Device 3D (Deye Hybrid Inverter, Victron MultiPlus-II, LiFePO4 Rack, Generator)
  private buildBackupDevice3D(el: ElectricalElement, pos: THREE.Vector3, rotY: number) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;

    const lowerName = (el.name || '').toLowerCase();
    const isVictron = lowerName.includes('victron') || lowerName.includes('multiplus');

    if (el.type === 'backup_inverter') {
      if (isVictron) {
        // ----------------- VICTRON ENERGY MULTIPLUS-II 5kVA / 48V -----------------
        // Iconic Victron Blue powder coated chassis (0.42m x 0.65m x 0.22m)
        const victronBlue = 0x004795;
        const mainBodyGeo = new THREE.BoxGeometry(0.40, 0.62, 0.21);
        const mainBodyMat = new THREE.MeshStandardMaterial({
          color: victronBlue,
          roughness: 0.35,
          metalness: 0.45,
        });
        const mainBody = new THREE.Mesh(mainBodyGeo, mainBodyMat);
        group.add(mainBody);

        // Lower detachable black terminal cover
        const lowerCoverGeo = new THREE.BoxGeometry(0.395, 0.16, 0.215);
        const lowerCoverMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.3 });
        const lowerCover = new THREE.Mesh(lowerCoverGeo, lowerCoverMat);
        lowerCover.position.set(0, -0.22, 0.003);
        group.add(lowerCover);

        // Victron logo plate
        const logoPlate = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.045, 0.003),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
        );
        logoPlate.position.set(0, 0.20, 0.107);
        group.add(logoPlate);

        // 8-LED Vertical Status Bank (Mains On, Bulk, Absorption, Float, Inverter, Overload, Low Bat, Temp)
        const ledBankX = -0.12;
        const ledStartY = 0.10;
        for (let i = 0; i < 8; i++) {
          const led = new THREE.Mesh(
            new THREE.CylinderGeometry(0.004, 0.004, 0.004, 12),
            new THREE.MeshBasicMaterial({ color: i === 0 || i === 4 ? 0x10b981 : (i >= 5 ? 0xef4444 : 0xf59e0b) })
          );
          led.rotation.x = Math.PI / 2;
          led.position.set(ledBankX, ledStartY - i * 0.022, 0.107);
          group.add(led);
        }

        // Top ventilation louver slots
        for (let v = 0; v < 4; v++) {
          const louver = new THREE.Mesh(
            new THREE.BoxGeometry(0.26, 0.006, 0.003),
            new THREE.MeshStandardMaterial({ color: 0x0f172a })
          );
          louver.position.set(0, 0.28 - v * 0.014, 0.106);
          group.add(louver);
        }

        // Bottom heavy-duty battery connection gland studs (M8)
        const glandMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
        for (let g = -1; g <= 1; g++) {
          const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.035, 12), glandMat);
          gland.position.set(g * 0.10, -0.32, 0);
          group.add(gland);
        }

        mainBody.userData = {
          id: el.id,
          type: 'element',
          name: el.name || 'Інвертор Victron MultiPlus-II 48/5000',
          categoryName: 'Гібридний інвертор Victron Energy (Нідерланди)',
          heightMm: el.mountingHeightMm,
          isBackupPriority: true,
          notes: 'Чистий синус 5 кВА, вбудований зарядний пристрій 70А, швидкість перемикання < 20 мс',
        };
        this.interactiveObjects.push(mainBody);
      } else {
        // ----------------- DEYE SUN-5K/8K/12K-SG04LP3 HYBRID INVERTER -----------------
        // High-grade white/light grey chassis (0.42m x 0.65m x 0.22m)
        const invGeo = new THREE.BoxGeometry(0.42, 0.66, 0.22);
        const invMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.25,
          metalness: 0.2,
        });
        const inv = new THREE.Mesh(invGeo, invMat);
        group.add(inv);

        // Extruded dark aluminum heat-sink cooling fins on both left & right sides
        const finMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
        for (const side of [-1, 1]) {
          const finBlock = new THREE.Mesh(
            new THREE.BoxGeometry(0.025, 0.62, 0.19),
            finMat
          );
          finBlock.position.set(side * 0.22, 0, -0.01);
          group.add(finBlock);
        }

        // Circular Touchscreen LCD (Deye's signature circular display)
        const bezelGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.008, 32);
        const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.7 });
        const bezel = new THREE.Mesh(bezelGeo, bezelMat);
        bezel.rotation.x = Math.PI / 2;
        bezel.position.set(0, 0.10, 0.114);
        group.add(bezel);

        // LCD animated energy flow screen (emerald green glow)
        const screenGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.009, 32);
        const screenMat = new THREE.MeshBasicMaterial({ color: 0x059669 }); // Emerald display
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.rotation.x = Math.PI / 2;
        screen.position.set(0, 0.10, 0.116);
        group.add(screen);

        // Center animated power flow ring
        const ringGeo = new THREE.TorusGeometry(0.045, 0.004, 12, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(0, 0.10, 0.122);
        group.add(ring);

        // Left Side DC Isolator Rotary Switch (Red & Yellow)
        const swBase = new THREE.Mesh(
          new THREE.BoxGeometry(0.012, 0.07, 0.07),
          new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3 }) // Yellow plate
        );
        swBase.position.set(-0.218, 0.18, 0.04);
        group.add(swBase);

        const swKnob = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.02, 0.05),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.2 }) // Red knob
        );
        swKnob.position.set(-0.23, 0.18, 0.04);
        group.add(swKnob);

        // Bottom connection manifold: Dual MC4 solar inputs, Battery studs, AC Grid & EPS Backup glands
        const glandMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
        for (let g = -3; g <= 3; g++) {
          const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.035, 12), glandMat);
          gland.position.set(g * 0.045, -0.34, 0.02);
          group.add(gland);
        }

        // Wi-Fi / 4G Datalogger stick on bottom
        const wifiDongle = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.08, 0.025),
          new THREE.MeshStandardMaterial({ color: 0x0284c7 }) // Blue dongle
        );
        wifiDongle.position.set(0.16, -0.36, -0.04);
        group.add(wifiDongle);

        const wifiLed = new THREE.Mesh(
          new THREE.BoxGeometry(0.006, 0.006, 0.002),
          new THREE.MeshBasicMaterial({ color: 0x22c55e })
        );
        wifiLed.position.set(0.16, -0.34, -0.026);
        group.add(wifiLed);

        inv.userData = {
          id: el.id,
          type: 'element',
          name: el.name || 'Гібридний інвертор Deye SUN-8K-SG04LP3',
          categoryName: 'Гібридний інвертор Deye (Низьковольтний 48В)',
          heightMm: el.mountingHeightMm,
          isBackupPriority: true,
          notes: 'Круглий сенсорний LCD екран, 2 MPPT контролери СЕС, резервне перемикання < 4 мс',
        };
        this.interactiveObjects.push(inv);
      }
    } else if (el.type === 'backup_battery') {
      // ----------------- PYLONTECH US5000 / DYNESS LiFePO4 RACK BATTERY -----------------
      // Standard 19" 3U rack module (0.48m x 0.22m x 0.44m)
      const batGeo = new THREE.BoxGeometry(0.48, 0.22, 0.44);
      const batMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.8 });
      const bat = new THREE.Mesh(batGeo, batMat);
      group.add(bat);

      // Front fascia panel with side rack-mount handles
      const frontPanel = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.20, 0.01),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 })
      );
      frontPanel.position.z = 0.225;
      group.add(frontPanel);

      // Dual metal grab handles on left and right
      for (const side of [-1, 1]) {
        const handle = new THREE.Mesh(
          new THREE.TorusGeometry(0.035, 0.006, 8, 16, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9 })
        );
        handle.position.set(side * 0.19, 0, 0.24);
        group.add(handle);
      }

      // High-Current Amphenol SurLok Terminals (+ Red / - Black)
      const posTerm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.025, 16),
        new THREE.MeshStandardMaterial({ color: 0xe11d48 }) // Orange/Red +
      );
      posTerm.rotation.x = Math.PI / 2;
      posTerm.position.set(0.12, 0.03, 0.238);
      group.add(posTerm);

      const negTerm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.025, 16),
        new THREE.MeshStandardMaterial({ color: 0x020617 }) // Black -
      );
      negTerm.rotation.x = Math.PI / 2;
      negTerm.position.set(0.12, -0.04, 0.238);
      group.add(negTerm);

      // 6-Segment Green LED SoC State of Charge Display Bar
      for (let i = 0; i < 6; i++) {
        const socLed = new THREE.Mesh(
          new THREE.BoxGeometry(0.012, 0.006, 0.002),
          new THREE.MeshBasicMaterial({ color: 0x10b981 })
        );
        socLed.position.set(-0.11 + i * 0.016, 0.03, 0.232);
        group.add(socLed);
      }

      // CAN / RS485 Dual RJ45 ports
      const rj45 = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.015, 0.005),
        new THREE.MeshStandardMaterial({ color: 0x64748b })
      );
      rj45.position.set(-0.06, -0.04, 0.232);
      group.add(rj45);

      bat.userData = {
        id: el.id,
        type: 'element',
        name: el.name || 'АКБ Pylontech US5000 LiFePO4',
        categoryName: 'Акумуляторний блок LiFePO4 48В',
        heightMm: el.mountingHeightMm,
        isBackupPriority: true,
        notes: 'Ємність 4.8 кВт·год (100А·год, 48В). BMS з CAN-шиною зв\'язку з інвертором',
      };
      this.interactiveObjects.push(bat);
    } else if (el.type === 'backup_generator') {
      // 3D Realistic Fuel Generator (Бензиновий генератор 6.5 кВт з рамою та АВР)
      const genPadGeo = new THREE.BoxGeometry(0.85, 0.08, 0.65);
      const genPadMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
      const pad = new THREE.Mesh(genPadGeo, genPadMat);
      pad.position.y = -0.04;
      group.add(pad);

      // Red tubular protective roll-cage frame
      const cageMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.3 });
      const cageGeo = new THREE.BoxGeometry(0.72, 0.52, 0.52);
      const cageWire = new THREE.Mesh(cageGeo, cageMat);
      cageWire.position.y = 0.26;
      group.add(cageWire);

      // Inner engine / alternator block
      const engGeo = new THREE.BoxGeometry(0.58, 0.36, 0.42);
      const engMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
      const eng = new THREE.Mesh(engGeo, engMat);
      eng.position.y = 0.22;
      group.add(eng);

      // Top fuel tank (Червоний бензобак з горловиною)
      const tankGeo = new THREE.BoxGeometry(0.54, 0.12, 0.38);
      const tankMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4, roughness: 0.3 });
      const tank = new THREE.Mesh(tankGeo, tankMat);
      tank.position.set(0, 0.46, 0);
      group.add(tank);

      const capGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16);
      const capMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(0.12, 0.53, 0);
      group.add(cap);

      // Front control panel with ATS socket & voltmeter
      const panelFace = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.18, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
      );
      panelFace.position.set(-0.12, 0.26, 0.22);
      group.add(panelFace);

      // Status indicator / voltmeter display
      const meter = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.03, 0.005),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      meter.position.set(-0.18, 0.28, 0.235);
      group.add(meter);

      cageWire.userData = {
        id: el.id,
        type: 'element',
        name: el.name || 'Бензиновий генератор 6.5 кВт з АВР',
        categoryName: 'Резервна електростанція (ДЕС)',
        heightMm: el.mountingHeightMm,
        isBackupPriority: true,
        notes: 'Номінальна потужність: 6.5 кВт, бак 25л (до 10 год роботи). Автозапуск АВР',
      };
      this.interactiveObjects.push(cageWire);
    } else {
      // Power station / EcoFlow style
      const stGeo = new THREE.BoxGeometry(0.40, 0.28, 0.24);
      const stMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35 });
      const station = new THREE.Mesh(stGeo, stMat);
      group.add(station);

      // Accent orange handle
      const hGeo = new THREE.TorusGeometry(0.08, 0.015, 8, 16, Math.PI);
      const hMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
      const handle = new THREE.Mesh(hGeo, hMat);
      handle.position.set(0, 0.14, 0);
      group.add(handle);

      station.userData = {
        id: el.id,
        type: 'element',
        name: el.name || 'Зарядна станція 2 кВт·год',
        categoryName: 'Портативна зарядна станція',
        heightMm: el.mountingHeightMm,
        isBackupPriority: true,
        notes: 'Ємність 2048 Вт·год, чистий синус 2400 Вт',
      };
      this.interactiveObjects.push(station);
    }

    this.backupGroup.add(group);
  }

  private buildGenericDevice3D(el: ElectricalElement, pos: THREE.Vector3, rotY: number) {
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.06);
    const mat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.rotation.y = rotY;
    mesh.userData = {
      id: el.id,
      type: 'element',
      name: el.name || el.type,
      categoryName: el.category,
      heightMm: el.mountingHeightMm,
      powerWatts: el.powerWatts,
    };
    this.interactiveObjects.push(mesh);
    this.elementsGroup.add(mesh);
  }

  // 4. Wall Chases (Штроби у стінах):
  // According to PUE & DBN, wall chasing must be strictly vertical from the ceiling down to sockets/switches
  private buildWallChases(viewMode: ViewRenderMode, filter: CircuitFilterMode, stats: Scene3DStats) {
    const chaseWidth = 0.025;  // 25mm chase width in concrete/brick
    const chaseDepth = 0.025;  // 25mm depth

    // Chase channel groove material (dark recessed concrete channel)
    const grooveMat = new THREE.MeshStandardMaterial({
      color: 0x1e1e24,
      roughness: 0.95,
      metalness: 0.05,
    });

    // Cable inside the chase (VVGng grey flame-retardant outer sheath)
    const cableMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // Charcoal VVGng sheath
      roughness: 0.6,
      metalness: 0.1,
    });

    // Green emergency backup cable material
    const backupCableMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.4,
      emissive: 0x064e3b,
      emissiveIntensity: 0.4,
    });

    this.project.elements.forEach(el => {
      // Only wall-mounted devices need vertical chases (sockets, switches, panels, thermostats)
      if (el.category === 'light' && el.type !== 'light_sconce') return;
      if (filter === 'sockets' && el.category !== 'socket' && el.category !== 'panel') return;
      if (filter === 'lighting' && el.category !== 'switch' && el.type !== 'light_sconce' && el.category !== 'panel') return;
      if (filter === 'backup' && !el.isBackupPriority && el.category !== 'backup') return;

      const mountHeightM = (el.mountingHeightMm || 300) / 1000;
      const topHeightM = this.ceilingHeightM - 0.04; // 40mm ceiling margin for corrugated pipe entry
      const chaseLen = Math.max(0.1, topHeightM - mountHeightM);
      stats.totalChaseLengthM += chaseLen;

      const pos = this.to3DCoord(el.position.x, el.position.y, (topHeightM + mountHeightM) / 2);
      const rotY = (-(el.rotation || 0) * Math.PI) / 180;

      const group = new THREE.Group();
      group.position.set(pos.x, pos.y, pos.z);
      group.rotation.y = rotY;

      // 1. Recessed groove mesh (Штроба у штукатурці / бетоні)
      const grooveGeo = new THREE.BoxGeometry(chaseWidth, chaseLen, chaseDepth);
      const grooveMesh = new THREE.Mesh(grooveGeo, grooveMat);
      grooveMesh.position.z = -chaseDepth / 2; // slightly recessed into the wall
      group.add(grooveMesh);

      // 2. Visible cable inside the vertical chase
      const cableGeo = new THREE.CylinderGeometry(0.005, 0.005, chaseLen, 8);
      const cableMesh = new THREE.Mesh(cableGeo, el.isBackupPriority ? backupCableMat : cableMat);
      cableMesh.position.z = -chaseDepth / 2;
      group.add(cableMesh);

      // 3. Fastening dowel clamps along the chase (дюбель-хомути кожні 30-40 см за ПУЕ)
      const clampCount = Math.floor(chaseLen / 0.35);
      const clampMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 });
      for (let c = 0; c < clampCount; c++) {
        const clampY = -chaseLen / 2 + (c + 1) * 0.35;
        const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.006, 0.006), clampMat);
        clamp.position.set(0, clampY, -chaseDepth / 2 + 0.004);
        group.add(clamp);
      }

      // Metadata for raycaster
      grooveMesh.userData = {
        id: `chase_${el.id}`,
        type: 'chase',
        name: `Вертикальна штроба: ${el.name || el.type}`,
        categoryName: 'Штроблення стіни (бетон/цегла)',
        lengthM: Number(chaseLen.toFixed(2)),
        heightMm: el.mountingHeightMm,
        cableType: el.category === 'socket' ? 'ВВГнг-LS 3х2.5' : (el.category === 'panel' ? 'ВВГнг-LS 3х6/3х10' : 'ВВГнг-LS 3х1.5'),
        isBackupPriority: el.isBackupPriority,
        notes: `Відступ від стелі: ${(this.ceilingHeightM * 1000 - el.mountingHeightMm).toFixed(0)} мм`,
      };
      this.interactiveObjects.push(grooveMesh);

      this.chasesGroup.add(group);
    });
  }

  // 5. Cable Conduits (Гофровані труби по чорновій стелі та в стяжці підлоги):
  private buildConduits(viewMode: ViewRenderMode, filter: CircuitFilterMode, stats: Scene3DStats) {
    const ceilingLevelM = this.ceilingHeightM - 0.04;
    const floorLevelM = 0.04; // inside floor screed

    // Corrugated pipe diameter: 20mm (0.02m)
    const conduitRadius = 0.01;

    // Conduits by circuit type colors:
    // Power (Sockets 3x2.5): Grey PVC / Halogen Free
    // Lighting (3x1.5): Sky Blue
    // Heavy Appliances (3x4/3x6): Fire-resistant Orange / Amber
    // Backup Power Line (АКБ / ДБЖ): Emerald Green
    const greyConduitMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.45, metalness: 0.1 });
    const blueConduitMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45, metalness: 0.1 });
    const orangeConduitMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45, metalness: 0.1 });
    const greenConduitMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.35,
      emissive: 0x064e3b,
      emissiveIntensity: 0.35,
    });

    const clipMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });

    this.project.wires.forEach(wire => {
      const fromEl = this.project.elements.find(e => e.id === wire.fromId);
      const toEl = this.project.elements.find(e => e.id === wire.toId);
      if (!fromEl || !toEl) return;

      const isBackup = fromEl.isBackupPriority || toEl.isBackupPriority;
      if (filter === 'backup' && !isBackup) return;
      if (filter === 'sockets' && fromEl.category !== 'socket' && toEl.category !== 'socket') return;
      if (filter === 'lighting' && fromEl.category !== 'light' && toEl.category !== 'light' && fromEl.category !== 'switch' && toEl.category !== 'switch') return;

      const isFloor = wire.conduit === 'floor';
      const runLevelM = isFloor ? floorLevelM : ceilingLevelM;

      // Extract path vertices
      const pathPoints: THREE.Vector3[] = [];
      if (wire.points && wire.points.length >= 2) {
        wire.points.forEach(pt => {
          pathPoints.push(this.to3DCoord(pt.x, pt.y, runLevelM));
        });
      } else {
        pathPoints.push(this.to3DCoord(fromEl.position.x, fromEl.position.y, runLevelM));
        // Add 90-degree orthogonal corner if needed
        if (Math.abs(fromEl.position.x - toEl.position.x) > 5 && Math.abs(fromEl.position.y - toEl.position.y) > 5) {
          pathPoints.push(this.to3DCoord(toEl.position.x, fromEl.position.y, runLevelM));
        }
        pathPoints.push(this.to3DCoord(toEl.position.x, toEl.position.y, runLevelM));
      }

      if (pathPoints.length < 2) return;

      // Choose material based on wire specification
      let conduitMat = greyConduitMat;
      if (isBackup) {
        conduitMat = greenConduitMat;
      } else if (wire.cableType === 'VVGng_3x1.5') {
        conduitMat = blueConduitMat;
      } else if (wire.cableType === 'VVGng_3x4' || wire.cableType === 'VVGng_3x6') {
        conduitMat = orangeConduitMat;
      }

      // Build 3D continuous tube along the route
      const curve = new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal', 0.05);
      const tubeGeo = new THREE.TubeGeometry(curve, Math.max(16, pathPoints.length * 8), conduitRadius, 10, false);
      const tubeMesh = new THREE.Mesh(tubeGeo, conduitMat);
      tubeMesh.castShadow = true;

      // Calculate path length
      let routeLen = 0;
      for (let i = 0; i < pathPoints.length - 1; i++) {
        routeLen += pathPoints[i].distanceTo(pathPoints[i + 1]);
      }
      if (isFloor) {
        stats.floorConduitLengthM += routeLen;
      } else {
        stats.ceilingConduitLengthM += routeLen;
      }

      // Add mounting clips (кліпси для гофри з кроком 40 см)
      const clipIntervalM = 0.45;
      const numClips = Math.floor(routeLen / clipIntervalM);
      for (let c = 1; c <= numClips; c++) {
        const u = (c * clipIntervalM) / routeLen;
        if (u < 0.95) {
          const pt = curve.getPointAt(u);
          const clip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.015, 0.024), clipMat);
          clip.position.set(pt.x, isFloor ? pt.y - 0.005 : pt.y + 0.005, pt.z);
          this.conduitsGroup.add(clip);
        }
      }

      // Metadata for raycasting
      tubeMesh.userData = {
        id: wire.id,
        type: 'wire',
        name: `Траса ${wire.cableType.replace('_', ' ')}`,
        categoryName: isFloor ? 'Гофротруба у стяжці підлоги' : 'Гофротруба по чорновій стелі',
        lengthM: Number((wire.calculatedLengthM || routeLen).toFixed(2)),
        cableType: wire.cableType.replace('_', ' '),
        conduitType: isFloor ? 'ПНД важка у стяжці' : 'ПВХ негорюча $\\varnothing 20$ мм з кліпсами',
        isBackupPriority: isBackup,
        notes: `Від "${fromEl.name || fromEl.type}" до "${toEl.name || toEl.type}"`,
      };
      this.interactiveObjects.push(tubeMesh);

      this.conduitsGroup.add(tubeMesh);
    });
  }
}
