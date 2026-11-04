import React from 'react';
import { Group, Rect, Circle, Line, Text, Arc, Path } from 'react-konva';
import { FurnitureItem } from '../../types/cad';
import { MM_PER_PX } from '../../utils/cadMath';

interface KonvaFurnitureSymbolProps {
  item: FurnitureItem;
  isSelected?: boolean;
  isHovered?: boolean;
  onSelect?: () => void;
  onDragEnd?: (newPos: { x: number; y: number }) => void;
  isDraggable?: boolean;
}

export const KonvaFurnitureSymbol: React.FC<KonvaFurnitureSymbolProps> = ({
  item,
  isSelected = false,
  isHovered = false,
  onSelect,
  onDragEnd,
  isDraggable = false,
}) => {
  const widthPx = item.width / MM_PER_PX;
  const heightPx = item.height / MM_PER_PX;
  const halfW = widthPx / 2;
  const halfH = heightPx / 2;

  // CAD Architectural Colors
  const cadStroke = isSelected ? '#38bdf8' : isHovered ? '#94a3b8' : '#64748b';
  const cadFill = isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(30, 41, 59, 0.45)';
  const cadDetailStroke = isSelected ? '#7dd3fc' : '#475569';
  const strokeWidth = isSelected ? 2 : 1.2;

  const shapeType = item.cadShape || item.type;

  const renderFurnitureGeometry = () => {
    switch (shapeType) {
      // ------------------------------------------
      // DOUBLE BED (ЛІЖКО ДВОСПАЛЬНЕ)
      // ------------------------------------------
      case 'bed_double':
      case 'bed': {
        const pillowW = halfW * 0.75;
        const pillowH = heightPx * 0.2;
        return (
          <Group>
            {/* Mattress Frame */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={6}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Headboard */}
            <Rect
              x={-halfW - 2}
              y={-halfH - 5}
              width={widthPx + 4}
              height={8}
              cornerRadius={2}
              fill="#334155"
              stroke={cadStroke}
              strokeWidth={1}
            />
            {/* Pillows (Two) */}
            <Rect
              x={-halfW + 6}
              y={-halfH + 8}
              width={pillowW}
              height={pillowH}
              cornerRadius={4}
              fill="#1e293b"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            <Rect
              x={halfW - pillowW - 6}
              y={-halfH + 8}
              width={pillowW}
              height={pillowH}
              cornerRadius={4}
              fill="#1e293b"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            {/* Blanket fold line */}
            <Line
              points={[-halfW + 4, -halfH + pillowH + 18, halfW - 4, -halfH + pillowH + 18]}
              stroke={cadDetailStroke}
              strokeWidth={1.5}
              dash={[6, 3]}
            />
          </Group>
        );
      }

      // ------------------------------------------
      // SINGLE BED (ЛІЖКО ОДНОСПАЛЬНЕ)
      // ------------------------------------------
      case 'bed_single': {
        const pillowW = widthPx * 0.75;
        const pillowH = heightPx * 0.2;
        return (
          <Group>
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={4}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Headboard */}
            <Rect
              x={-halfW - 2}
              y={-halfH - 4}
              width={widthPx + 4}
              height={6}
              cornerRadius={2}
              fill="#334155"
              stroke={cadStroke}
              strokeWidth={1}
            />
            {/* Single Pillow */}
            <Rect
              x={-pillowW / 2}
              y={-halfH + 8}
              width={pillowW}
              height={pillowH}
              cornerRadius={3}
              fill="#1e293b"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            {/* Blanket line */}
            <Line
              points={[-halfW + 4, -halfH + pillowH + 18, halfW - 4, -halfH + pillowH + 18]}
              stroke={cadDetailStroke}
              strokeWidth={1.5}
              dash={[5, 3]}
            />
          </Group>
        );
      }

      // ------------------------------------------
      // STRAIGHT SOFA (ДИВАН ПРЯМИЙ)
      // ------------------------------------------
      case 'sofa_straight':
      case 'sofa': {
        const armW = widthPx * 0.12;
        const backH = heightPx * 0.22;
        return (
          <Group>
            {/* Main base */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={8}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Backrest */}
            <Rect
              x={-halfW + armW}
              y={-halfH}
              width={widthPx - armW * 2}
              height={backH}
              cornerRadius={[0, 0, 4, 4]}
              fill="#0f172a"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            {/* Left Armrest */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={armW}
              height={heightPx}
              cornerRadius={5}
              fill="#0f172a"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            {/* Right Armrest */}
            <Rect
              x={halfW - armW}
              y={-halfH}
              width={armW}
              height={heightPx}
              cornerRadius={5}
              fill="#0f172a"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            {/* Cushion partition lines */}
            <Line
              points={[-halfW + armW + (widthPx - armW * 2) / 3, -halfH + backH, -halfW + armW + (widthPx - armW * 2) / 3, halfH]}
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            <Line
              points={[-halfW + armW + ((widthPx - armW * 2) * 2) / 3, -halfH + backH, -halfW + armW + ((widthPx - armW * 2) * 2) / 3, halfH]}
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
          </Group>
        );
      }

      // ------------------------------------------
      // CORNER SOFA (ДИВАН КУТОВИЙ L-ПОДІБНИЙ)
      // ------------------------------------------
      case 'sofa_corner': {
        const armW = Math.min(22, widthPx * 0.12);
        return (
          <Group>
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={6}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Top Backrest */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={armW}
              fill="#0f172a"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            {/* Right Side Extension Backrest */}
            <Rect
              x={halfW - armW}
              y={-halfH}
              width={armW}
              height={heightPx}
              fill="#0f172a"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            {/* Left Armrest */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={armW}
              height={heightPx * 0.6}
              cornerRadius={4}
              fill="#0f172a"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
          </Group>
        );
      }

      // ------------------------------------------
      // ARMCHAIR (КРІСЛО)
      // ------------------------------------------
      case 'armchair': {
        const armW = widthPx * 0.18;
        const backH = heightPx * 0.22;
        return (
          <Group>
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={8}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Backrest */}
            <Rect
              x={-halfW + armW}
              y={-halfH}
              width={widthPx - armW * 2}
              height={backH}
              cornerRadius={4}
              fill="#0f172a"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            {/* Armrests */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={armW}
              height={heightPx}
              cornerRadius={4}
              fill="#0f172a"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            <Rect
              x={halfW - armW}
              y={-halfH}
              width={armW}
              height={heightPx}
              cornerRadius={4}
              fill="#0f172a"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
          </Group>
        );
      }

      // ------------------------------------------
      // DINING TABLE WITH CHAIRS (ОБІДНІЙ СТІЛ ЗІ СТІЛЬЦЯМИ)
      // ------------------------------------------
      case 'dining_table': {
        const chairW = Math.min(24, widthPx * 0.25);
        const chairH = 14;
        return (
          <Group>
            {/* Surrounding chairs */}
            {/* Top Chairs */}
            <Rect
              x={-halfW * 0.6}
              y={-halfH - chairH - 2}
              width={chairW}
              height={chairH}
              cornerRadius={4}
              stroke={cadDetailStroke}
              fill="#0f172a"
              strokeWidth={1}
            />
            <Rect
              x={halfW * 0.6 - chairW}
              y={-halfH - chairH - 2}
              width={chairW}
              height={chairH}
              cornerRadius={4}
              stroke={cadDetailStroke}
              fill="#0f172a"
              strokeWidth={1}
            />
            {/* Bottom Chairs */}
            <Rect
              x={-halfW * 0.6}
              y={halfH + 2}
              width={chairW}
              height={chairH}
              cornerRadius={4}
              stroke={cadDetailStroke}
              fill="#0f172a"
              strokeWidth={1}
            />
            <Rect
              x={halfW * 0.6 - chairW}
              y={halfH + 2}
              width={chairW}
              height={chairH}
              cornerRadius={4}
              stroke={cadDetailStroke}
              fill="#0f172a"
              strokeWidth={1}
            />

            {/* Table Top */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={5}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Table bevel inlay */}
            <Rect
              x={-halfW + 4}
              y={-halfH + 4}
              width={widthPx - 8}
              height={heightPx - 8}
              cornerRadius={3}
              stroke={cadDetailStroke}
              strokeWidth={0.8}
            />
          </Group>
        );
      }

      // ------------------------------------------
      // TV UNIT / MEDIA CONSOLE (ТВ-ТУМБА)
      // ------------------------------------------
      case 'tv_unit':
      case 'tv_cabinet': {
        const tvW = widthPx * 0.7;
        return (
          <Group>
            {/* Cabinet base */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={3}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* TV Screen Stand & Display */}
            <Rect
              x={-tvW / 2}
              y={-halfH + 6}
              width={tvW}
              height={5}
              cornerRadius={1}
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth={1.2}
            />
            {/* TV base foot */}
            <Rect
              x={-10}
              y={-halfH + 11}
              width={20}
              height={6}
              cornerRadius={1}
              fill="#0f172a"
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            {/* Cabinet sections */}
            <Line points={[-halfW * 0.35, -halfH, -halfW * 0.35, halfH]} stroke={cadDetailStroke} strokeWidth={0.8} />
            <Line points={[halfW * 0.35, -halfH, halfW * 0.35, halfH]} stroke={cadDetailStroke} strokeWidth={0.8} />
          </Group>
        );
      }

      // ------------------------------------------
      // WARDROBE (ШАФА-КУПЕ / ГАРДЕРОБ)
      // ------------------------------------------
      case 'wardrobe': {
        const doorCount = widthPx > 180 ? 3 : 2;
        const doorW = widthPx / doorCount;
        return (
          <Group>
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Sliding Door Overlaps */}
            {Array.from({ length: doorCount }).map((_, i) => (
              <Rect
                key={i}
                x={-halfW + i * doorW}
                y={-halfH + (i % 2 === 0 ? 0 : 3)}
                width={doorW}
                height={heightPx - 3}
                stroke={cadDetailStroke}
                strokeWidth={1}
              />
            ))}
            {/* Diagonal cross hatch (AutoCAD architectural wardrobe symbol) */}
            <Line points={[-halfW, -halfH, halfW, halfH]} stroke="rgba(100, 116, 139, 0.25)" strokeWidth={0.8} />
            <Line points={[-halfW, halfH, halfW, -halfH]} stroke="rgba(100, 116, 139, 0.25)" strokeWidth={0.8} />
          </Group>
        );
      }

      // ------------------------------------------
      // WORK DESK (ПИСЬМОВИЙ СТІЛ)
      // ------------------------------------------
      case 'desk': {
        return (
          <Group>
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={4}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Drawer pedestal box */}
            <Rect
              x={halfW - widthPx * 0.3}
              y={-halfH}
              width={widthPx * 0.3}
              height={heightPx}
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
            {/* Monitor / Laptop area */}
            <Rect
              x={-25}
              y={-halfH + 8}
              width={50}
              height={14}
              cornerRadius={2}
              stroke={cadDetailStroke}
              fill="#0f172a"
              strokeWidth={1}
            />
            {/* Cable grommet circle */}
            <Circle x={-halfW + 15} y={-halfH + 15} radius={3.5} stroke={cadDetailStroke} strokeWidth={1} />
          </Group>
        );
      }

      // ------------------------------------------
      // BATHTUB (ВАННА)
      // ------------------------------------------
      case 'bathtub':
      case 'bath': {
        return (
          <Group>
            {/* Outer Rim */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={4}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Inner Basin with ergonomic curve */}
            <Rect
              x={-halfW + 8}
              y={-halfH + 8}
              width={widthPx - 16}
              height={heightPx - 16}
              cornerRadius={[14, 14, 30, 30]}
              fill="rgba(6, 182, 212, 0.08)"
              stroke="#06b6d4"
              strokeWidth={1.5}
            />
            {/* Drain & Overflow */}
            <Circle x={-halfW + 20} y={0} radius={4} fill="#0f172a" stroke="#06b6d4" strokeWidth={1.5} />
          </Group>
        );
      }

      // ------------------------------------------
      // SHOWER CABIN (ДУШОВА КАБІНА)
      // ------------------------------------------
      case 'shower': {
        return (
          <Group>
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={4}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Glass door curve or sliding corner */}
            <Line
              points={[-halfW, halfH, halfW, -halfH]}
              stroke="rgba(6, 182, 212, 0.3)"
              strokeWidth={1}
              dash={[4, 2]}
            />
            {/* Center floor drain */}
            <Circle x={0} y={0} radius={6} stroke="#06b6d4" strokeWidth={1.5} />
            <Line points={[-4, 0, 4, 0]} stroke="#06b6d4" strokeWidth={1} />
            <Line points={[0, -4, 0, 4]} stroke="#06b6d4" strokeWidth={1} />
          </Group>
        );
      }

      // ------------------------------------------
      // TOILET (УНІТАЗ З ІНСТАЛЯЦІЄЮ)
      // ------------------------------------------
      case 'toilet': {
        const cisternH = heightPx * 0.3;
        return (
          <Group>
            {/* Cistern / In-wall frame */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={cisternH}
              cornerRadius={2}
              fill="#0f172a"
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Flush button */}
            <Rect
              x={-8}
              y={-halfH + 3}
              width={16}
              height={6}
              cornerRadius={1}
              stroke={cadDetailStroke}
              strokeWidth={0.8}
            />
            {/* Oval toilet bowl */}
            <Rect
              x={-halfW + 4}
              y={-halfH + cisternH}
              width={widthPx - 8}
              height={heightPx - cisternH}
              cornerRadius={[2, 2, 22, 22]}
              fill="rgba(148, 163, 184, 0.1)"
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Inner bowl rim */}
            <Rect
              x={-halfW + 9}
              y={-halfH + cisternH + 5}
              width={widthPx - 18}
              height={heightPx - cisternH - 12}
              cornerRadius={[2, 2, 16, 16]}
              stroke={cadDetailStroke}
              strokeWidth={1}
            />
          </Group>
        );
      }

      // ------------------------------------------
      // WASHBASIN (УМИВАЛЬНИК)
      // ------------------------------------------
      case 'washbasin':
      case 'wash_basin': {
        return (
          <Group>
            {/* Vanity Countertop */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={4}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Oval Ceramic Basin */}
            <Rect
              x={-halfW + 6}
              y={-halfH + 6}
              width={widthPx - 12}
              height={heightPx - 12}
              cornerRadius={14}
              fill="rgba(6, 182, 212, 0.08)"
              stroke="#06b6d4"
              strokeWidth={1.4}
            />
            {/* Faucet mixer & drain */}
            <Circle x={0} y={-halfH + 11} radius={3} fill="#0f172a" stroke="#06b6d4" strokeWidth={1.2} />
            <Circle x={0} y={2} radius={3.5} stroke={cadDetailStroke} strokeWidth={1} />
          </Group>
        );
      }

      // ------------------------------------------
      // KITCHEN SINK (КУХОННА МИЙКА З КРИЛОМ)
      // ------------------------------------------
      case 'kitchen_sink': {
        return (
          <Group>
            {/* Outer Rim */}
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={3}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Basin (left 55%) */}
            <Rect
              x={-halfW + 5}
              y={-halfH + 5}
              width={widthPx * 0.52}
              height={heightPx - 10}
              cornerRadius={8}
              fill="rgba(6, 182, 212, 0.08)"
              stroke="#06b6d4"
              strokeWidth={1.4}
            />
            {/* Drain */}
            <Circle x={-halfW + widthPx * 0.26 + 3} y={0} radius={4} stroke="#06b6d4" strokeWidth={1.2} />
            {/* Faucet */}
            <Circle x={-halfW + widthPx * 0.26 + 3} y={-halfH + 10} radius={2.5} fill="#06b6d4" />
            {/* Drainer grooved ribs (right side) */}
            {[-halfH + 12, -halfH + 20, 0, halfH - 20, halfH - 12].map((y, idx) => (
              <Line
                key={idx}
                points={[widthPx * 0.15, y, halfW - 8, y]}
                stroke={cadDetailStroke}
                strokeWidth={1}
              />
            ))}
          </Group>
        );
      }

      // ------------------------------------------
      // COOKTOP (ВАРИЛЬНА ПОВЕРХНЯ 4 КОНФОРКИ)
      // ------------------------------------------
      case 'cooktop':
      case 'stove': {
        return (
          <Group>
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={4}
              fill="#090d16"
              stroke="#ef4444"
              strokeWidth={strokeWidth}
            />
            {/* 4 Burners / Induction Rings */}
            {/* Top Left - Medium */}
            <Circle x={-halfW * 0.48} y={-halfH * 0.45} radius={Math.min(14, halfH * 0.38)} stroke="#f87171" strokeWidth={1.5} />
            {/* Top Right - Large */}
            <Circle x={halfW * 0.48} y={-halfH * 0.45} radius={Math.min(18, halfH * 0.46)} stroke="#f87171" strokeWidth={1.5} />
            <Circle x={halfW * 0.48} y={-halfH * 0.45} radius={Math.min(10, halfH * 0.25)} stroke="#ef4444" strokeWidth={1} />
            {/* Bottom Left - Small */}
            <Circle x={-halfW * 0.48} y={halfH * 0.45} radius={Math.min(11, halfH * 0.28)} stroke="#f87171" strokeWidth={1.5} />
            {/* Bottom Right - Medium */}
            <Circle x={halfW * 0.48} y={halfH * 0.45} radius={Math.min(14, halfH * 0.38)} stroke="#f87171" strokeWidth={1.5} />
            {/* Red power badge */}
            <Text x={-8} y={-4} text="32A" fontSize={7} fill="#ef4444" fontStyle="bold" />
          </Group>
        );
      }

      // ------------------------------------------
      // REFRIGERATOR (ХОЛОДИЛЬНИК)
      // ------------------------------------------
      case 'fridge': {
        return (
          <Group>
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={3}
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth={strokeWidth}
            />
            {/* Door seam */}
            <Line points={[-halfW, -halfH + 8, halfW, -halfH + 8]} stroke="#38bdf8" strokeWidth={1.5} />
            {/* Snowflake glyph */}
            <Text x={-5} y={-5} text="❄" fontSize={11} fill="#38bdf8" />
          </Group>
        );
      }

      // ------------------------------------------
      // WASHING MACHINE (ПРАЛЬНА МАШИНА)
      // ------------------------------------------
      case 'washing_machine': {
        return (
          <Group>
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={3}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Glass Porthole Door */}
            <Circle x={0} y={4} radius={Math.min(halfW * 0.7, halfH * 0.7)} stroke="#06b6d4" strokeWidth={1.5} fill="#0f172a" />
            <Circle x={0} y={4} radius={Math.min(halfW * 0.45, halfH * 0.45)} stroke={cadDetailStroke} strokeWidth={1} />
            {/* Top Control Panel */}
            <Rect x={-halfW + 4} y={-halfH + 4} width={widthPx - 8} height={10} stroke={cadDetailStroke} strokeWidth={0.8} />
            <Circle x={halfW - 12} y={-halfH + 9} radius={2.5} fill="#38bdf8" />
          </Group>
        );
      }

      // ------------------------------------------
      // DEFAULT FALLBACK (GENERIC CAD RECTANGLE)
      // ------------------------------------------
      default: {
        return (
          <Group>
            <Rect
              x={-halfW}
              y={-halfH}
              width={widthPx}
              height={heightPx}
              cornerRadius={4}
              fill={cadFill}
              stroke={cadStroke}
              strokeWidth={strokeWidth}
            />
            {/* Subtle inner offset line */}
            <Rect
              x={-halfW + 3}
              y={-halfH + 3}
              width={widthPx - 6}
              height={heightPx - 6}
              cornerRadius={2}
              stroke={cadDetailStroke}
              strokeWidth={0.7}
              dash={[4, 3]}
            />
          </Group>
        );
      }
    }
  };

  return (
    <Group
      x={item.position.x}
      y={item.position.y}
      rotation={item.rotation}
      draggable={isDraggable}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect?.();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect?.();
      }}
      onDragEnd={(e) => {
        onDragEnd?.({
          x: Math.round(e.target.x()),
          y: Math.round(e.target.y()),
        });
      }}
    >
      {/* Halo outline when selected */}
      {isSelected && (
        <Group listening={false}>
          <Rect
            x={-halfW - 4}
            y={-halfH - 4}
            width={widthPx + 8}
            height={heightPx + 8}
            cornerRadius={6}
            stroke="#38bdf8"
            strokeWidth={1.5}
            dash={[6, 3]}
          />
          {/* Corner anchor handles */}
          <Circle x={-halfW - 4} y={-halfH - 4} radius={3.5} fill="#38bdf8" />
          <Circle x={halfW + 4} y={-halfH - 4} radius={3.5} fill="#38bdf8" />
          <Circle x={-halfW - 4} y={halfH + 4} radius={3.5} fill="#38bdf8" />
          <Circle x={halfW + 4} y={halfH + 4} radius={3.5} fill="#38bdf8" />
        </Group>
      )}

      {/* Main Vector Furniture Geometry */}
      {renderFurnitureGeometry()}

      {/* Furniture Name Label */}
      <Text
        x={-halfW}
        y={-5}
        width={widthPx}
        text={item.name}
        fontSize={Math.max(7.5, Math.min(10, widthPx / 12))}
        fill={isSelected ? '#38bdf8' : '#cbd5e1'}
        align="center"
        fontStyle="bold"
        listening={false}
      />

      {/* Dimension Label (e.g. 1800×2000) */}
      <Text
        x={-halfW}
        y={7}
        width={widthPx}
        text={`${item.width}×${item.height}`}
        fontSize={7}
        fill={isSelected ? '#7dd3fc' : '#64748b'}
        fontFamily="monospace"
        align="center"
        listening={false}
      />
    </Group>
  );
};
