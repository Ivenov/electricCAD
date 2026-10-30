import React from 'react';
import { Group, Circle, Line, Rect, Text, Path, Arc } from 'react-konva';
import { ElectricalElementType } from '../../types/cad';

interface KonvaSymbolProps {
  type: ElectricalElementType;
  size?: number;
  color?: string;
  isSelected?: boolean;
  label?: string;
  mountingHeightMm?: number;
  showHeightTag?: boolean;
  circuitNumber?: number;
  isBackupPriority?: boolean;
}

export const KonvaElectricalSymbol: React.FC<KonvaSymbolProps> = ({
  type,
  size = 28,
  color = '#38bdf8',
  isSelected = false,
  label,
  mountingHeightMm,
  showHeightTag = true,
  circuitNumber,
  isBackupPriority = false,
}) => {
  const half = size / 2;

  const renderContent = () => {
    switch (type) {
      // ------------------------------------------------
      // SOCKETS / РОЗЕТКИ
      // ------------------------------------------------
      case 'socket_single':
        return (
          <Group>
            {/* Semicircle using Arc */}
            <Arc
              innerRadius={0}
              outerRadius={half * 0.75}
              angle={180}
              rotation={180}
              fill={isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)'}
              stroke={color}
              strokeWidth={2}
            />
            {/* Single pin indicator line */}
            <Line points={[0, 0, 0, -half * 0.9]} stroke={color} strokeWidth={2} />
          </Group>
        );

      case 'socket_double':
        return (
          <Group>
            <Arc
              innerRadius={0}
              outerRadius={half * 0.75}
              angle={180}
              rotation={180}
              fill={isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)'}
              stroke={color}
              strokeWidth={2}
            />
            <Line points={[-half * 0.3, 0, -half * 0.3, -half * 0.9]} stroke={color} strokeWidth={2} />
            <Line points={[half * 0.3, 0, half * 0.3, -half * 0.9]} stroke={color} strokeWidth={2} />
          </Group>
        );

      case 'socket_triple':
      case 'socket_quad':
        return (
          <Group>
            <Arc
              innerRadius={0}
              outerRadius={half * 0.85}
              angle={180}
              rotation={180}
              fill={isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)'}
              stroke={color}
              strokeWidth={2}
            />
            <Line points={[-half * 0.45, 0, -half * 0.45, -half * 0.95]} stroke={color} strokeWidth={2} />
            <Line points={[0, 0, 0, -half * 0.95]} stroke={color} strokeWidth={2} />
            <Line points={[half * 0.45, 0, half * 0.45, -half * 0.95]} stroke={color} strokeWidth={2} />
            {type === 'socket_quad' && (
              <Text x={-8} y={2} text="x4" fontSize={8} fill={color} fontStyle="bold" align="center" />
            )}
          </Group>
        );

      case 'socket_ip44':
        return (
          <Group>
            <Arc
              innerRadius={0}
              outerRadius={half * 0.75}
              angle={180}
              rotation={180}
              fill={color}
              stroke={color}
              strokeWidth={2}
            />
            <Line points={[0, 0, 0, -half * 0.95]} stroke={color} strokeWidth={2.5} />
            <Line points={[-half * 0.3, -half * 0.95, half * 0.3, -half * 0.95]} stroke={color} strokeWidth={2.5} />
            <Text x={-12} y={3} text="IP44" fontSize={7} fill="#38bdf8" fontStyle="bold" />
          </Group>
        );

      case 'socket_cooker':
        return (
          <Group>
            <Line
              points={[0, -half * 0.9, half * 0.8, half * 0.6, -half * 0.8, half * 0.6]}
              closed
              fill="rgba(239, 68, 68, 0.25)"
              stroke="#ef4444"
              strokeWidth={2}
            />
            <Circle radius={half * 0.25} fill="#ef4444" />
            <Text x={-9} y={half * 0.2} text="32A" fontSize={7} fill="#ef4444" fontStyle="bold" />
          </Group>
        );

      case 'socket_rj45':
      case 'socket_tv':
        return (
          <Group>
            <Rect
              x={-half * 0.6}
              y={-half * 0.6}
              width={size * 0.6}
              height={size * 0.6}
              fill="rgba(168, 85, 247, 0.2)"
              stroke="#c084fc"
              strokeWidth={2}
            />
            <Text
              x={-8}
              y={-4}
              text={type === 'socket_rj45' ? 'RJ' : 'TV'}
              fontSize={8}
              fill="#c084fc"
              fontStyle="bold"
            />
          </Group>
        );

      case 'socket_usb':
        return (
          <Group>
            <Arc
              innerRadius={0}
              outerRadius={half * 0.7}
              angle={180}
              rotation={180}
              fill="rgba(56, 189, 248, 0.2)"
              stroke={color}
              strokeWidth={2}
            />
            <Text x={-10} y={-6} text="USB" fontSize={7} fill={color} fontStyle="bold" />
          </Group>
        );

      case 'thermostat':
        return (
          <Group>
            <Rect
              x={-half * 0.7}
              y={-half * 0.7}
              width={size * 0.7}
              height={size * 0.7}
              fill="rgba(249, 115, 22, 0.25)"
              stroke="#f97316"
              strokeWidth={2}
            />
            <Circle radius={half * 0.4} stroke="#f97316" strokeWidth={1.5} />
            <Text x={-6} y={-4} text="°C" fontSize={8} fill="#f97316" fontStyle="bold" />
          </Group>
        );

      // ------------------------------------------------
      // SWITCHES / ВЫКЛЮЧАТЕЛИ
      // ------------------------------------------------
      case 'switch_1g':
        return (
          <Group>
            <Circle radius={half * 0.45} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.45, 0, -half * 0.9]} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.9, half * 0.4, -half * 0.9]} stroke={color} strokeWidth={2} />
          </Group>
        );

      case 'switch_2g':
        return (
          <Group>
            <Circle radius={half * 0.45} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.45, 0, -half * 0.9]} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.9, half * 0.4, -half * 0.9]} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.7, half * 0.4, -half * 0.7]} stroke={color} strokeWidth={2} />
          </Group>
        );

      case 'switch_pass':
        return (
          <Group>
            <Circle radius={half * 0.45} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.45, 0, -half * 0.9]} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.9, half * 0.4, -half * 0.9]} stroke={color} strokeWidth={2} />
            <Line points={[0, half * 0.45, 0, half * 0.9]} stroke={color} strokeWidth={2} />
            <Line points={[0, half * 0.9, -half * 0.4, half * 0.9]} stroke={color} strokeWidth={2} />
          </Group>
        );

      case 'switch_master':
        return (
          <Group>
            <Circle radius={half * 0.55} fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth={2} />
            <Text x={-10} y={-4} text="OFF" fontSize={8} fill="#ef4444" fontStyle="bold" />
          </Group>
        );

      case 'switch_dimmer':
        return (
          <Group>
            <Circle radius={half * 0.45} stroke={color} strokeWidth={2} />
            <Line points={[-half * 0.5, half * 0.5, half * 0.5, -half * 0.5]} stroke={color} strokeWidth={2} />
            <Line
              points={[half * 0.5, -half * 0.5, half * 0.3, -half * 0.6, half * 0.4, -half * 0.3]}
              closed
              fill={color}
            />
          </Group>
        );

      // ------------------------------------------------
      // LIGHTING / ОСВЕЩЕНИЕ
      // ------------------------------------------------
      case 'light_pendant':
        return (
          <Group>
            <Circle radius={half * 0.75} fill="rgba(250, 204, 21, 0.15)" stroke="#eab308" strokeWidth={2} />
            <Line points={[-half * 0.53, -half * 0.53, half * 0.53, half * 0.53]} stroke="#eab308" strokeWidth={2} />
            <Line points={[-half * 0.53, half * 0.53, half * 0.53, -half * 0.53]} stroke="#eab308" strokeWidth={2} />
          </Group>
        );

      case 'light_spot':
        return (
          <Group>
            <Circle radius={half * 0.5} stroke="#eab308" strokeWidth={2} />
            <Circle radius={half * 0.2} fill="#eab308" />
          </Group>
        );

      case 'light_sconce':
        return (
          <Group>
            <Arc innerRadius={0} outerRadius={half * 0.6} angle={180} rotation={180} fill="#eab308" stroke="#eab308" strokeWidth={2} />
            <Line points={[-half * 0.7, 0, half * 0.7, 0]} stroke={color} strokeWidth={2} />
          </Group>
        );

      case 'light_track':
        return (
          <Group>
            <Line points={[-half * 0.9, 0, half * 0.9, 0]} stroke="#eab308" strokeWidth={3} />
            <Circle x={-half * 0.5} y={0} radius={half * 0.2} fill="#eab308" />
            <Circle x={0} y={0} radius={half * 0.2} fill="#eab308" />
            <Circle x={half * 0.5} y={0} radius={half * 0.2} fill="#eab308" />
          </Group>
        );

      case 'light_led_strip':
        return (
          <Group>
            <Line
              points={[-half * 0.8, -half * 0.2, 0, half * 0.4, half * 0.8, -half * 0.2]}
              stroke="#fbbf24"
              strokeWidth={2.5}
              dash={[3, 2]}
            />
          </Group>
        );

      // ------------------------------------------------
      // PANELS & DISTRIBUTION / ЩИТЫ
      // ------------------------------------------------
      case 'panel_cu':
        return (
          <Group>
            <Rect
              x={-half * 0.8}
              y={-half * 0.8}
              width={size * 0.8}
              height={size * 0.8}
              fill="#0f172a"
              stroke="#f59e0b"
              strokeWidth={2.5}
            />
            <Line
              points={[-half * 0.8, -half * 0.8, half * 0.8, -half * 0.8, half * 0.8, half * 0.8]}
              closed
              fill="#f59e0b"
            />
            <Line points={[-half * 0.8, -half * 0.8, half * 0.8, half * 0.8]} stroke="#0f172a" strokeWidth={1.5} />
          </Group>
        );

      case 'junction_box':
        return (
          <Group>
            <Circle radius={half * 0.45} fill="#1e293b" stroke={color} strokeWidth={2} />
            <Line points={[-half * 0.3, 0, half * 0.3, 0]} stroke={color} strokeWidth={1.5} />
            <Line points={[0, -half * 0.3, 0, half * 0.3]} stroke={color} strokeWidth={1.5} />
          </Group>
        );

      case 'ac_indoor':
        return (
          <Group>
            <Rect
              x={-half * 0.9}
              y={-half * 0.45}
              width={size * 0.9}
              height={size * 0.45}
              cornerRadius={2}
              fill="rgba(56, 189, 248, 0.2)"
              stroke="#38bdf8"
              strokeWidth={2}
            />
            <Text x={-6} y={-3} text="AC" fontSize={7} fill="#38bdf8" fontStyle="bold" />
          </Group>
        );

      // ------------------------------------------------
      // BACKUP POWER / РЕЗЕРВНЕ ЖИВЛЕННЯ
      // ------------------------------------------------
      case 'backup_inverter':
        return (
          <Group>
            <Rect
              x={-half * 0.85}
              y={-half * 0.85}
              width={size * 0.85}
              height={size * 0.85}
              cornerRadius={3}
              fill="rgba(16, 185, 129, 0.2)"
              stroke="#10b981"
              strokeWidth={2}
            />
            {/* Inverter wave / sine symbol */}
            <Line points={[-half * 0.5, 0, -half * 0.2, -half * 0.35, half * 0.2, half * 0.35, half * 0.5, 0]} stroke="#10b981" strokeWidth={1.5} />
            <Text x={-10} y={half * 0.15} text="5kW" fontSize={7} fill="#10b981" fontStyle="bold" />
          </Group>
        );

      case 'backup_battery':
        return (
          <Group>
            <Rect
              x={-half * 0.8}
              y={-half * 0.6}
              width={size * 0.8}
              height={size * 0.6}
              cornerRadius={2}
              fill="rgba(52, 211, 153, 0.25)"
              stroke="#34d399"
              strokeWidth={2}
            />
            {/* Battery terminals */}
            <Rect x={-half * 0.4} y={-half * 0.75} width={half * 0.25} height={half * 0.2} fill="#34d399" />
            <Rect x={half * 0.15} y={-half * 0.75} width={half * 0.25} height={half * 0.2} fill="#34d399" />
            <Text x={-12} y={-3} text="LiFe" fontSize={7} fill="#34d399" fontStyle="bold" />
          </Group>
        );

      case 'backup_station':
        return (
          <Group>
            <Rect
              x={-half * 0.8}
              y={-half * 0.55}
              width={size * 0.8}
              height={size * 0.55}
              cornerRadius={3}
              fill="rgba(245, 158, 11, 0.25)"
              stroke="#f59e0b"
              strokeWidth={2}
            />
            {/* Carry handle */}
            <Line points={[-half * 0.35, -half * 0.55, -half * 0.35, -half * 0.75, half * 0.35, -half * 0.75, half * 0.35, -half * 0.55]} stroke="#f59e0b" strokeWidth={1.5} />
            <Text x={-11} y={-3} text="ECO" fontSize={7} fill="#f59e0b" fontStyle="bold" />
          </Group>
        );

      case 'backup_ats':
        return (
          <Group>
            <Rect
              x={-half * 0.8}
              y={-half * 0.8}
              width={size * 0.8}
              height={size * 0.8}
              cornerRadius={2}
              fill="rgba(217, 70, 239, 0.2)"
              stroke="#d946ef"
              strokeWidth={2}
            />
            <Text x={-14} y={-5} text="I-0-II" fontSize={7} fill="#d946ef" fontStyle="bold" />
          </Group>
        );

      case 'backup_generator':
        return (
          <Group>
            <Rect
              x={-half * 0.95}
              y={-half * 0.75}
              width={size * 0.95}
              height={size * 0.75}
              cornerRadius={4}
              fill="rgba(239, 68, 68, 0.2)"
              stroke="#ef4444"
              strokeWidth={2}
            />
            <Rect
              x={-half * 0.7}
              y={-half * 0.7}
              width={size * 0.7}
              height={size * 0.22}
              cornerRadius={2}
              fill="rgba(239, 68, 68, 0.4)"
              stroke="#ef4444"
              strokeWidth={1}
            />
            <Text x={-15} y={0} text="ГЕНЕРАТОР" fontSize={6} fill="#ef4444" fontStyle="bold" />
          </Group>
        );

      default:
        return <Circle radius={half * 0.4} fill={color} />;
    }
  };

  return (
    <Group>
      {/* Backup priority halo (emerald ring indicating backed-up emergency circuit) */}
      {isBackupPriority && (
        <Group>
          <Circle
            radius={half * 1.15}
            stroke="#10b981"
            strokeWidth={1.5}
            dash={[3, 2]}
          />
          <Rect
            x={half * 0.5}
            y={-half * 1.1}
            width={12}
            height={10}
            cornerRadius={2}
            fill="#10b981"
          />
          <Text
            x={half * 0.5 + 2}
            y={-half * 1.1 + 1}
            text="⚡"
            fontSize={7}
            fill="#022c22"
          />
        </Group>
      )}

      {/* Halo highlight when selected */}
      {isSelected && (
        <Circle
          radius={half * 1.35}
          stroke="#38bdf8"
          strokeWidth={2}
          dash={[4, 2]}
        />
      )}

      {renderContent()}

      {/* Label or Switch Group ID */}
      {label && (
        <Text
          x={half * 0.8}
          y={-half * 0.6}
          text={label}
          fontSize={9}
          fill={color}
          fontStyle="bold"
        />
      )}

      {/* Circuit number tag (e.g. Гр.1) */}
      {circuitNumber !== undefined && (
        <Text
          x={-12}
          y={-17}
          text={`Гр.${circuitNumber}`}
          fontSize={7.5}
          fill={color}
          fontStyle="bold"
        />
      )}

      {/* Mounting height tag (+300, +900) */}
      {showHeightTag && mountingHeightMm !== undefined && (
        <Text
          x={-15}
          y={half + 3}
          text={`+${mountingHeightMm}`}
          fontSize={8}
          fill="#94a3b8"
          fontFamily="monospace"
        />
      )}
    </Group>
  );
};
