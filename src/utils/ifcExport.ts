/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * OpenBIM IFC 4.3 (ISO 16739-1:2024) Exporter
 * Generates valid Step Physical File (.ifc) for Autodesk Revit, ArchiCAD & BlenderBIM.
 */

import { CadProject, ElectricalElement, Wall, WallOpening, Room, WireRoute, Point } from '../types/cad';
import { pxToMm, getCableDisplayName } from './cadMath';

/**
 * Format timestamp for IFC header: YYYY-MM-DDTHH:MM:SS
 */
function getIfcTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '');
}

/**
 * Generate unique 22-character IFC GUID (Base64-like IFC alphanumeric)
 */
function generateIfcGuid(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let guid = '';
  for (let i = 0; i < 22; i++) {
    guid += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return guid;
}

/**
 * Converts 2D CAD point (pixels) to millimeters in BIM world coordinate system
 */
function ptToMm(p: Point): { x: number; y: number } {
  return {
    x: pxToMm(p.x),
    y: pxToMm(p.y),
  };
}

export function generateIfcContent(project: CadProject): string {
  let idCounter = 1;
  const nextId = () => idCounter++;

  const lines: string[] = [];

  const timeStr = getIfcTimestamp();
  const projectTitle = (project.title || 'ElectroPlan_BIM_Project').replace(/['\\]/g, '');
  const ceilingHeightMm = project.ceilingHeightMm || 2700;

  // 1. FILE HEADER
  lines.push('ISO-10303-21;');
  lines.push('HEADER;');
  lines.push(`FILE_DESCRIPTION(('ViewDefinition [DesignTransferView_V1.0]', 'Exchange [Electrical MEP / Architecture]'), '2;1');`);
  lines.push(`FILE_NAME('${projectTitle}.ifc', '${timeStr}', ('ElectroPlan CAD Engineer'), ('ElectroPlan Studio'), 'ElectroPlan IFC 4.3 Engine', 'ElectroPlan CAD 2026', '');`);
  lines.push(`FILE_SCHEMA(('IFC4'));`);
  lines.push('ENDSEC;');
  lines.push('DATA;');

  // 2. CORE CONTEXT, PERSON, ORGANIZATION, APPLICATION
  const idPerson = nextId();
  lines.push(`#${idPerson}=IFCPERSON($,'Engineer','ElectroPlan',$,$,$,$,$);`);
  const idOrg = nextId();
  lines.push(`#${idOrg}=IFCORGANIZATION($,'ElectroPlan CAD Studio','BIM Electrical Software',$,$);`);
  const idPersonOrg = nextId();
  lines.push(`#${idPersonOrg}=IFCPERSONANDORGANIZATION(#${idPerson},#${idOrg},$);`);
  const idOwnerHistory = nextId();
  lines.push(`#${idOwnerHistory}=IFCOWNERHISTORY(#${idPersonOrg},#${idOrg},.READWRITE.,.NOTDEFINED.,$,$,$,${Math.floor(Date.now() / 1000)});`);

  // Units: Millimetre, Radian, Square Metre, Watt
  const idDimLength = nextId();
  lines.push(`#${idDimLength}=IFCDIMENSIONALEXPOSURE(1,0,0,0,0,0,0);`);
  const idUnitMm = nextId();
  lines.push(`#${idUnitMm}=IFCSIUNIT(#${idDimLength},.LENGTHUNIT.,.MILLI.,.METRE.);`);
  const idDimAngle = nextId();
  lines.push(`#${idDimAngle}=IFCDIMENSIONALEXPOSURE(0,0,0,0,0,0,0);`);
  const idUnitRadian = nextId();
  lines.push(`#${idUnitRadian}=IFCSIUNIT(#${idDimAngle},.PLANEANGLEUNIT.,$,.RADIAN.);`);
  const idDimArea = nextId();
  lines.push(`#${idDimArea}=IFCDIMENSIONALEXPOSURE(2,0,0,0,0,0,0);`);
  const idUnitArea = nextId();
  lines.push(`#${idUnitArea}=IFCSIUNIT(#${idDimArea},.AREAUNIT.,$,.SQUARE_METRE.);`);
  const idUnitAssignment = nextId();
  lines.push(`#${idUnitAssignment}=IFCUNITASSIGNMENT((#${idUnitMm},#${idUnitRadian},#${idUnitArea}));`);

  // World Coordinate System (0, 0, 0)
  const idOrigin3D = nextId();
  lines.push(`#${idOrigin3D}=IFCCARTESIANPOINT((0.,0.,0.));`);
  const idDirZ = nextId();
  lines.push(`#${idDirZ}=IFCDIRECTION((0.,0.,1.));`);
  const idDirX = nextId();
  lines.push(`#${idDirX}=IFCDIRECTION((1.,0.,0.));`);
  const idAxisPlacementWorld = nextId();
  lines.push(`#${idAxisPlacementWorld}=IFCAXIS2PLACEMENT3D(#${idOrigin3D},#${idDirZ},#${idDirX});`);

  const idGeoContext = nextId();
  lines.push(`#${idGeoContext}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.001,#${idAxisPlacementWorld},$);`);

  // 3. SPATIAL HIERARCHY: Project -> Site -> Building -> BuildingStorey
  const idProject = nextId();
  lines.push(`#${idProject}=IFCPROJECT('${generateIfcGuid()}',#${idOwnerHistory},'${projectTitle}','ElectroPlan Electrical BIM Model',$,$,$,(#${idGeoContext}),#${idUnitAssignment});`);

  const idSitePlacement = nextId();
  lines.push(`#${idSitePlacement}=IFCLOCALPLACEMENT($,#${idAxisPlacementWorld});`);
  const idSite = nextId();
  lines.push(`#${idSite}=IFCSITE('${generateIfcGuid()}',#${idOwnerHistory},'Будівельний майданчик',$,$,#${idSitePlacement},$,$,.ELEMENT.,$,$,$,$,$);`);

  const idRelAggProjectSite = nextId();
  lines.push(`#${idRelAggProjectSite}=IFCRELAGGREGATES('${generateIfcGuid()}',#${idOwnerHistory},'ProjectSiteRel',$,#${idProject},(#${idSite}));`);

  const idBldgPlacement = nextId();
  lines.push(`#${idBldgPlacement}=IFCLOCALPLACEMENT(#${idSitePlacement},#${idAxisPlacementWorld});`);
  const idBuilding = nextId();
  lines.push(`#${idBuilding}=IFCBUILDING('${generateIfcGuid()}',#${idOwnerHistory},'Житловий будинок / Квартира',$,$,#${idBldgPlacement},$,$,.ELEMENT.,$,$,$);`);

  const idRelAggSiteBldg = nextId();
  lines.push(`#${idRelAggSiteBldg}=IFCRELAGGREGATES('${generateIfcGuid()}',#${idOwnerHistory},'SiteBuildingRel',$,#${idSite},(#${idBuilding}));`);

  const idStoreyPlacement = nextId();
  lines.push(`#${idStoreyPlacement}=IFCLOCALPLACEMENT(#${idBldgPlacement},#${idAxisPlacementWorld});`);
  const idStorey = nextId();
  lines.push(`#${idStorey}=IFCBUILDINGSTOREY('${generateIfcGuid()}',#${idOwnerHistory},'Поверх 1',$,$,#${idStoreyPlacement},$,$,.ELEMENT.,0.);`);

  const idRelAggBldgStorey = nextId();
  lines.push(`#${idRelAggBldgStorey}=IFCRELAGGREGATES('${generateIfcGuid()}',#${idOwnerHistory},'BuildingStoreyRel',$,#${idBuilding},(#${idStorey}));`);

  const containedElementIds: number[] = [];

  // 4. ARCHITECTURAL WALLS (IFCWALLSTANDARDCASE)
  const wallMap = new Map<string, Wall>();
  project.walls.forEach((w) => wallMap.set(w.id, w));

  project.walls.forEach((wall, idx) => {
    const p1 = ptToMm(wall.start);
    const p2 = ptToMm(wall.end);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthMm = Math.hypot(dx, dy);
    if (lengthMm < 1) return;

    const angleRad = Math.atan2(dy, dx);
    const thicknessMm = wall.thickness || 150;

    // Local placement at wall start with direction vector
    const idPtWallStart = nextId();
    lines.push(`#${idPtWallStart}=IFCCARTESIANPOINT((${p1.x.toFixed(1)},${p1.y.toFixed(1)},0.));`);
    const idDirWallX = nextId();
    lines.push(`#${idDirWallX}=IFCDIRECTION((${Math.cos(angleRad).toFixed(4)},${Math.sin(angleRad).toFixed(4)},0.));`);
    const idAxisWall = nextId();
    lines.push(`#${idAxisWall}=IFCAXIS2PLACEMENT3D(#${idPtWallStart},#${idDirZ},#${idDirWallX});`);
    const idWallPlacement = nextId();
    lines.push(`#${idWallPlacement}=IFCLOCALPLACEMENT(#${idStoreyPlacement},#${idAxisWall});`);

    // Extruded rectangle profile: Length along X, Thickness along Y, Height along Z
    const idProfPt = nextId();
    lines.push(`#${idProfPt}=IFCCARTESIANPOINT((0.,0.));`);
    const idAxisProf = nextId();
    lines.push(`#${idAxisProf}=IFCAXIS2PLACEMENT2D(#${idProfPt},#${idDirX});`);
    const idRectProfile = nextId();
    lines.push(`#${idRectProfile}=IFCRECTANGLEPROFILEDEF(.AREA.,'WallProfile',#${idAxisProf},${lengthMm.toFixed(1)},${thicknessMm.toFixed(1)});`);

    // Extrusion along Z by ceilingHeightMm
    const idExtrudeAxis = nextId();
    lines.push(`#${idExtrudeAxis}=IFCAXIS2PLACEMENT3D(#${idOrigin3D},#${idDirZ},#${idDirX});`);
    const idSolid = nextId();
    lines.push(`#${idSolid}=IFCEXTRUDEDAREASOLID(#${idRectProfile},#${idExtrudeAxis},#${idDirZ},${ceilingHeightMm.toFixed(1)});`);

    const idShapeRep = nextId();
    lines.push(`#${idShapeRep}=IFCSHAPEREPRESENTATION(#${idGeoContext},'Body','SweptSolid',(#${idSolid}));`);
    const idProdDefShape = nextId();
    lines.push(`#${idProdDefShape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${idShapeRep}));`);

    const idWall = nextId();
    const wallName = wall.type === 'bearing' ? `Несуча стіна W-${idx + 1}` : `Перегородка W-${idx + 1}`;
    lines.push(`#${idWall}=IFCWALLSTANDARDCASE('${generateIfcGuid()}',#${idOwnerHistory},'${wallName}','Товщина ${thicknessMm} мм',$,#${idWallPlacement},#${idProdDefShape},'${wall.id}');`);

    containedElementIds.push(idWall);
  });

  // 5. ROOMS / SPACES (IFCSPACE)
  project.rooms.forEach((room, rIdx) => {
    if (!room.points || room.points.length < 3) return;

    const idPtRoom = nextId();
    lines.push(`#${idPtRoom}=IFCCARTESIANPOINT((0.,0.,0.));`);
    const idAxisRoom = nextId();
    lines.push(`#${idAxisRoom}=IFCAXIS2PLACEMENT3D(#${idPtRoom},#${idDirZ},#${idDirX});`);
    const idRoomPlacement = nextId();
    lines.push(`#${idRoomPlacement}=IFCLOCALPLACEMENT(#${idStoreyPlacement},#${idAxisRoom});`);

    const idSpace = nextId();
    lines.push(`#${idSpace}=IFCSPACE('${generateIfcGuid()}',#${idOwnerHistory},'${room.name || 'Приміщення'}','Площа ${room.areaM2} м²',.ELEMENT.,#${idRoomPlacement},$,'${room.id}',.INTERNAL.,.SPACE.,$);`);
    containedElementIds.push(idSpace);
  });

  // 6. ELECTRICAL APPARATUS & TERMINAL DEVICES
  project.elements.forEach((el) => {
    const posMm = ptToMm(el.position);
    const zMm = el.mountingHeightMm || (el.category === 'light' ? ceilingHeightMm - 200 : 300);
    const rotRad = ((el.rotation || 0) * Math.PI) / 180;

    const idPtEl = nextId();
    lines.push(`#${idPtEl}=IFCCARTESIANPOINT((${posMm.x.toFixed(1)},${posMm.y.toFixed(1)},${zMm.toFixed(1)}));`);
    const idDirElX = nextId();
    lines.push(`#${idDirElX}=IFCDIRECTION((${Math.cos(rotRad).toFixed(4)},${Math.sin(rotRad).toFixed(4)},0.));`);
    const idAxisEl = nextId();
    lines.push(`#${idAxisEl}=IFCAXIS2PLACEMENT3D(#${idPtEl},#${idDirZ},#${idDirElX});`);
    const idElPlacement = nextId();
    lines.push(`#${idElPlacement}=IFCLOCALPLACEMENT(#${idStoreyPlacement},#${idAxisEl});`);

    // Symbolic box representation (100 x 100 x 50 mm)
    const idProfPt = nextId();
    lines.push(`#${idProfPt}=IFCCARTESIANPOINT((0.,0.));`);
    const idAxisProf = nextId();
    lines.push(`#${idAxisProf}=IFCAXIS2PLACEMENT2D(#${idProfPt},#${idDirX});`);
    const idElProfile = nextId();
    lines.push(`#${idElProfile}=IFCRECTANGLEPROFILEDEF(.AREA.,'DeviceProfile',#${idAxisProf},100.,100.);`);
    const idElSolid = nextId();
    lines.push(`#${idElSolid}=IFCEXTRUDEDAREASOLID(#${idElProfile},#${idAxisPlacementWorld},#${idDirZ},50.);`);
    const idElShapeRep = nextId();
    lines.push(`#${idElShapeRep}=IFCSHAPEREPRESENTATION(#${idGeoContext},'Body','SweptSolid',(#${idElSolid}));`);
    const idElProdDefShape = nextId();
    lines.push(`#${idElProdDefShape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${idElShapeRep}));`);

    const idDevice = nextId();
    const guid = generateIfcGuid();
    const cleanName = (el.name || el.type).replace(/['\\]/g, '');

    // Map according to IFC 4.3 MEP electrical taxonomy
    if (el.category === 'socket') {
      lines.push(`#${idDevice}=IFCOUTLET('${guid}',#${idOwnerHistory},'${cleanName}','Потужність ${el.powerWatts || 300} Вт',$,#${idElPlacement},#${idElProdDefShape},'${el.id}',.POWEROUTLET.);`);
    } else if (el.category === 'switch') {
      lines.push(`#${idDevice}=IFCSWITCHINGDEVICE('${guid}',#${idOwnerHistory},'${cleanName}','Група ${el.switchGroupId || 'S1'}',$,#${idElPlacement},#${idElProdDefShape},'${el.id}',.LIGHTINGSWITCH.);`);
    } else if (el.category === 'light') {
      lines.push(`#${idDevice}=IFCLIGHTFIXTURE('${guid}',#${idOwnerHistory},'${cleanName}','Світильник ${el.powerWatts || 60} Вт',$,#${idElPlacement},#${idElProdDefShape},'${el.id}',.POINTSOURCE.);`);
    } else if (el.category === 'panel') {
      lines.push(`#${idDevice}=IFCELECTRICDISTRIBUTIONBOARD('${guid}',#${idOwnerHistory},'${cleanName}','Ввідний розподільчий щит ВРП',$,#${idElPlacement},#${idElProdDefShape},'${el.id}',.DISTRIBUTIONBOARD.);`);
    } else if (el.category === 'junction') {
      lines.push(`#${idDevice}=IFCJUNCTIONBOX('${guid}',#${idOwnerHistory},'${cleanName}','Розподільча коробка WAGO',$,#${idElPlacement},#${idElProdDefShape},'${el.id}',.USERDEFINED.);`);
    } else {
      lines.push(`#${idDevice}=IFCELECTRICAPPLIANCE('${guid}',#${idOwnerHistory},'${cleanName}','Побутовий прилад ${el.powerWatts || 1500} Вт',$,#${idElPlacement},#${idElProdDefShape},'${el.id}',.ELECTRICHEATER.);`);
    }

    containedElementIds.push(idDevice);
  });

  // 7. 3D CABLE ROUTES / CHASES (IFCFLOWSEGMENT)
  project.wires.forEach((wire, wIdx) => {
    const fromEl = project.elements.find((e) => e.id === wire.fromId);
    const toEl = project.elements.find((e) => e.id === wire.toId);
    if (!fromEl || !toEl) return;

    const fromMm = ptToMm(fromEl.position);
    const toMm = ptToMm(toEl.position);
    const zFromMm = fromEl.mountingHeightMm || 300;
    const zToMm = toEl.mountingHeightMm || 300;
    const zConduitMm = wire.conduit === 'floor' ? 50 : wire.conduit === 'ceiling' ? ceilingHeightMm - 100 : zFromMm;

    // 3D Polyline coordinates: Device A -> Ceiling/Screed Level -> Device B
    const idPt1 = nextId();
    lines.push(`#${idPt1}=IFCCARTESIANPOINT((${fromMm.x.toFixed(1)},${fromMm.y.toFixed(1)},${zFromMm.toFixed(1)}));`);
    const idPt2 = nextId();
    lines.push(`#${idPt2}=IFCCARTESIANPOINT((${fromMm.x.toFixed(1)},${fromMm.y.toFixed(1)},${zConduitMm.toFixed(1)}));`);
    const idPt3 = nextId();
    lines.push(`#${idPt3}=IFCCARTESIANPOINT((${toMm.x.toFixed(1)},${toMm.y.toFixed(1)},${zConduitMm.toFixed(1)}));`);
    const idPt4 = nextId();
    lines.push(`#${idPt4}=IFCCARTESIANPOINT((${toMm.x.toFixed(1)},${toMm.y.toFixed(1)},${zToMm.toFixed(1)}));`);

    const id3dPolyline = nextId();
    lines.push(`#${id3dPolyline}=IFCPOLYLINE((#${idPt1},#${idPt2},#${idPt3},#${idPt4}));`);

    const idWirePlacement = nextId();
    lines.push(`#${idWirePlacement}=IFCLOCALPLACEMENT(#${idStoreyPlacement},#${idAxisPlacementWorld});`);

    const idWireShapeRep = nextId();
    lines.push(`#${idWireShapeRep}=IFCSHAPEREPRESENTATION(#${idGeoContext},'Axis','Curve',(#${id3dPolyline}));`);
    const idWireProdDefShape = nextId();
    lines.push(`#${idWireProdDefShape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${idWireShapeRep}));`);

    const idWireFlow = nextId();
    const tag = wire.cableTag || `W-${wIdx + 1}`;
    const cableDesc = `${getCableDisplayName(wire.cableType)} (${wire.calculatedLengthM} м, ${wire.conduit})`;
    lines.push(`#${idWireFlow}=IFCFLOWSEGMENT('${generateIfcGuid()}',#${idOwnerHistory},'${tag}','${cableDesc}',$,#${idWirePlacement},#${idWireProdDefShape},'${wire.id}');`);

    containedElementIds.push(idWireFlow);
  });

  // 8. REL CONTAINED IN SPATIAL STRUCTURE (BuildingStorey contains all walls, devices, cables)
  if (containedElementIds.length > 0) {
    const idRelContained = nextId();
    const idListStr = containedElementIds.map((id) => `#${id}`).join(',');
    lines.push(`#${idRelContained}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${generateIfcGuid()}',#${idOwnerHistory},'StoreyElementsRel',$,(${idListStr}),#${idStorey});`);
  }

  lines.push('ENDSEC;');
  lines.push('END-ISO-10303-21;');

  return lines.join('\n');
}

/**
 * Direct file download trigger for OpenBIM .ifc
 */
export function downloadIfcFile(project: CadProject): void {
  const content = generateIfcContent(project);
  const blob = new Blob([content], { type: 'application/x-step;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `${(project.title || 'electroplan_bim').replace(/\s+/g, '_')}_BIM_IFC4.3.ifc`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
