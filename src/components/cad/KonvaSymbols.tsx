import React from 'react';
import { Group, Circle, Line, Rect, Text, Path, Arc } from 'react-konva';
import { ElectricalElementType, CustomSymbolShape } from '../../types/cad';

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
  customSymbolShape?: CustomSymbolShape;
  customSymbolColor?: string;
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
  customSymbolShape,
  customSymbolColor,
}) => {
  const activeColor = customSymbolColor || color;
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

      case 'socket_3phase':
        return (
          <Group>
            <Circle radius={half * 0.75} fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth={2.2} />
            <Line points={[-half * 0.45, -half * 0.25, half * 0.45, -half * 0.25]} stroke="#ef4444" strokeWidth={1.8} />
            <Line points={[-half * 0.45, 0, half * 0.45, 0]} stroke="#ef4444" strokeWidth={1.8} />
            <Line points={[-half * 0.45, half * 0.25, half * 0.45, half * 0.25]} stroke="#ef4444" strokeWidth={1.8} />
            <Text x={-11} y={half * 0.4} text="380V" fontSize={6.5} fill="#ef4444" fontStyle="bold" />
          </Group>
        );

      case 'socket_outdoor':
        return (
          <Group>
            <Arc
              innerRadius={0}
              outerRadius={half * 0.75}
              angle={180}
              rotation={180}
              fill="#059669"
              stroke="#10b981"
              strokeWidth={2}
            />
            <Line points={[0, 0, 0, -half * 0.95]} stroke="#10b981" strokeWidth={2.5} />
            <Rect x={-half * 0.4} y={-half * 1.05} width={half * 0.8} height={half * 0.2} fill="#10b981" rx={1} />
            <Text x={-10} y={3} text="IP65" fontSize={6.5} fill="#34d399" fontStyle="bold" />
          </Group>
        );

      case 'cable_outlet':
        return (
          <Group>
            <Circle radius={half * 0.5} stroke={color} strokeWidth={2} fill="transparent" />
            <Line points={[-half * 0.35, 0, half * 0.35, 0]} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.35, 0, half * 0.35]} stroke={color} strokeWidth={2} />
            <Line points={[0, half * 0.5, 0, half * 0.9]} stroke={color} strokeWidth={2} />
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

      case 'switch_3g':
        return (
          <Group>
            <Circle radius={half * 0.45} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.45, 0, -half * 0.9]} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.9, half * 0.4, -half * 0.9]} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.7, half * 0.4, -half * 0.7]} stroke={color} strokeWidth={2} />
            <Line points={[0, -half * 0.5, half * 0.4, -half * 0.5]} stroke={color} strokeWidth={2} />
          </Group>
        );

      case 'switch_impulse':
        return (
          <Group>
            <Circle radius={half * 0.45} stroke={color} strokeWidth={2} />
            <Circle radius={half * 0.2} fill={color} />
            <Line points={[0, -half * 0.45, 0, -half * 0.9]} stroke={color} strokeWidth={2} />
          </Group>
        );

      case 'switch_smart':
        return (
          <Group>
            <Rect
              x={-half * 0.5}
              y={-half * 0.5}
              width={size * 0.5}
              height={size * 0.5}
              cornerRadius={2}
              stroke="#38bdf8"
              strokeWidth={1.8}
              fill="rgba(56, 189, 248, 0.2)"
            />
            <Circle radius={half * 0.15} fill="#38bdf8" />
            <Text x={-6} y={-half * 0.4} text="Wi" fontSize={6} fill="#38bdf8" fontStyle="bold" />
          </Group>
        );

      case 'motion_sensor':
        return (
          <Group>
            <Circle radius={half * 0.5} stroke="#a855f7" strokeWidth={2} fill="rgba(168, 85, 247, 0.2)" />
            {/* Radar wave arcs */}
            <Arc innerRadius={0} outerRadius={half * 0.35} angle={120} rotation={-60} stroke="#c084fc" strokeWidth={1.5} />
            <Circle radius={half * 0.12} fill="#a855f7" />
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

      case 'light_outdoor':
        return (
          <Group>
            <Circle radius={half * 0.6} stroke="#10b981" strokeWidth={2} fill="rgba(16, 185, 129, 0.2)" />
            <Line points={[-half * 0.4, 0, half * 0.4, 0]} stroke="#10b981" strokeWidth={2} />
            <Line points={[0, -half * 0.4, 0, half * 0.4]} stroke="#10b981" strokeWidth={2} />
            <Text x={-8} y={-3} text="IP" fontSize={6.5} fill="#10b981" fontStyle="bold" />
          </Group>
        );

      case 'light_emergency':
        return (
          <Group>
            <Rect
              x={-half * 0.75}
              y={-half * 0.45}
              width={size * 0.75}
              height={size * 0.45}
              cornerRadius={2}
              stroke="#22c55e"
              strokeWidth={2}
              fill="rgba(34, 197, 94, 0.25)"
            />
            <Text x={-11} y={-3} text="EXIT" fontSize={6.5} fill="#22c55e" fontStyle="bold" />
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

      case 'panel_multimedia':
        return (
          <Group>
            <Rect
              x={-half * 0.8}
              y={-half * 0.8}
              width={size * 0.8}
              height={size * 0.8}
              fill="#0f172a"
              stroke="#a855f7"
              strokeWidth={2.5}
            />
            <Text x={-8} y={-4} text="ЩС" fontSize={8} fill="#c084fc" fontStyle="bold" />
          </Group>
        );

      case 'junction_box':
      case 'junction_box_light':
      case 'junction_box_power':
      case 'junction_box_waterproof':
        return (
          <Group>
            <Circle
              radius={half * 0.48}
              fill={type === 'junction_box_waterproof' ? 'rgba(16, 185, 129, 0.3)' : '#1e293b'}
              stroke={
                type === 'junction_box_light'
                  ? '#eab308'
                  : type === 'junction_box_power'
                  ? '#38bdf8'
                  : type === 'junction_box_waterproof'
                  ? '#10b981'
                  : color
              }
              strokeWidth={2.2}
            />
            <Line
              points={[-half * 0.32, 0, half * 0.32, 0]}
              stroke={
                type === 'junction_box_light'
                  ? '#eab308'
                  : type === 'junction_box_power'
                  ? '#38bdf8'
                  : type === 'junction_box_waterproof'
                  ? '#10b981'
                  : color
              }
              strokeWidth={1.8}
            />
            <Line
              points={[0, -half * 0.32, 0, half * 0.32]}
              stroke={
                type === 'junction_box_light'
                  ? '#eab308'
                  : type === 'junction_box_power'
                  ? '#38bdf8'
                  : type === 'junction_box_waterproof'
                  ? '#10b981'
                  : color
              }
              strokeWidth={1.8}
            />
          </Group>
        );

      case 'grounding_bus':
        return (
          <Group>
            <Line points={[-half * 0.6, -half * 0.2, half * 0.6, -half * 0.2]} stroke="#eab308" strokeWidth={3} />
            <Line points={[-half * 0.4, 0, half * 0.4, 0]} stroke="#eab308" strokeWidth={2.5} />
            <Line points={[-half * 0.2, half * 0.2, half * 0.2, half * 0.2]} stroke="#eab308" strokeWidth={2} />
            <Line points={[0, -half * 0.6, 0, -half * 0.2]} stroke="#eab308" strokeWidth={2} />
            <Text x={-8} y={half * 0.3} text="PE" fontSize={6.5} fill="#eab308" fontStyle="bold" />
          </Group>
        );

      // ------------------------------------------------
      // HEAVY APPLIANCES / ПОБУТОВА ТЕХНІКА
      // ------------------------------------------------
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

      case 'water_heater':
        return (
          <Group>
            <Circle radius={half * 0.65} fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth={2} />
            <Text x={-10} y={-4} text="БОЙЛЕР" fontSize={5.5} fill="#38bdf8" fontStyle="bold" />
          </Group>
        );

      case 'hob_induction':
        return (
          <Group>
            <Rect
              x={-half * 0.85}
              y={-half * 0.85}
              width={size * 0.85}
              height={size * 0.85}
              cornerRadius={3}
              fill="rgba(239, 68, 68, 0.2)"
              stroke="#ef4444"
              strokeWidth={2}
            />
            <Circle x={-half * 0.35} y={-half * 0.35} radius={half * 0.25} stroke="#ef4444" strokeWidth={1.5} />
            <Circle x={half * 0.35} y={-half * 0.35} radius={half * 0.2} stroke="#ef4444" strokeWidth={1.5} />
            <Circle x={-half * 0.35} y={half * 0.35} radius={half * 0.2} stroke="#ef4444" strokeWidth={1.5} />
            <Circle x={half * 0.35} y={half * 0.35} radius={half * 0.25} stroke="#ef4444" strokeWidth={1.5} />
          </Group>
        );

      case 'oven_electric':
        return (
          <Group>
            <Rect
              x={-half * 0.8}
              y={-half * 0.7}
              width={size * 0.8}
              height={size * 0.7}
              cornerRadius={2}
              fill="rgba(249, 115, 22, 0.2)"
              stroke="#f97316"
              strokeWidth={2}
            />
            <Line points={[-half * 0.6, -half * 0.3, half * 0.6, -half * 0.3]} stroke="#f97316" strokeWidth={1.5} />
            <Text x={-8} y={0} text="ДУХ" fontSize={7} fill="#f97316" fontStyle="bold" />
          </Group>
        );

      case 'washing_machine':
        return (
          <Group>
            <Rect
              x={-half * 0.75}
              y={-half * 0.75}
              width={size * 0.75}
              height={size * 0.75}
              cornerRadius={2}
              fill="rgba(56, 189, 248, 0.15)"
              stroke="#38bdf8"
              strokeWidth={2}
            />
            <Circle radius={half * 0.35} stroke="#38bdf8" strokeWidth={1.8} fill="rgba(56, 189, 248, 0.3)" />
            <Circle radius={half * 0.12} fill="#38bdf8" />
          </Group>
        );

      case 'dryer_machine':
        return (
          <Group>
            <Rect
              x={-half * 0.75}
              y={-half * 0.75}
              width={size * 0.75}
              height={size * 0.75}
              cornerRadius={2}
              fill="rgba(168, 85, 247, 0.15)"
              stroke="#c084fc"
              strokeWidth={2}
            />
            <Circle radius={half * 0.35} stroke="#c084fc" strokeWidth={1.8} />
            <Text x={-7} y={-3} text="СУШ" fontSize={6} fill="#c084fc" fontStyle="bold" />
          </Group>
        );

      case 'dishwasher':
        return (
          <Group>
            <Rect
              x={-half * 0.75}
              y={-half * 0.75}
              width={size * 0.75}
              height={size * 0.75}
              cornerRadius={2}
              fill="rgba(20, 184, 166, 0.15)"
              stroke="#14b8a6"
              strokeWidth={2}
            />
            <Text x={-7} y={-4} text="ПММ" fontSize={6.5} fill="#14b8a6" fontStyle="bold" />
          </Group>
        );

      case 'vent_exhaust':
        return (
          <Group>
            <Circle radius={half * 0.55} stroke="#06b6d4" strokeWidth={2} fill="rgba(6, 182, 212, 0.15)" />
            {/* 4 propeller blades */}
            <Line points={[-half * 0.35, -half * 0.35, half * 0.35, half * 0.35]} stroke="#06b6d4" strokeWidth={2} />
            <Line points={[-half * 0.35, half * 0.35, half * 0.35, -half * 0.35]} stroke="#06b6d4" strokeWidth={2} />
          </Group>
        );

      case 'electric_boiler':
        return (
          <Group>
            <Rect
              x={-half * 0.65}
              y={-half * 0.9}
              width={size * 0.65}
              height={size * 0.9}
              cornerRadius={2}
              fill="rgba(239, 68, 68, 0.2)"
              stroke="#ef4444"
              strokeWidth={2}
            />
            <Text x={-10} y={-4} text="КОТЕЛ" fontSize={6} fill="#ef4444" fontStyle="bold" />
          </Group>
        );

      case 'water_leak_valve':
        return (
          <Group>
            <Circle radius={half * 0.5} stroke="#0284c7" strokeWidth={2} fill="rgba(2, 132, 199, 0.2)" />
            <Line points={[-half * 0.35, 0, half * 0.35, 0]} stroke="#0284c7" strokeWidth={2.5} />
            <Line points={[0, -half * 0.35, 0, half * 0.35]} stroke="#0284c7" strokeWidth={2.5} />
            <Text x={-6} y={-half * 0.65} text="CRANE" fontSize={5} fill="#38bdf8" fontStyle="bold" />
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

      case 'knx_actuator':
        return (
          <Group>
            <Rect
              x={-half * 0.9}
              y={-half * 0.75}
              width={size * 0.9}
              height={size * 0.75}
              cornerRadius={2}
              fill="rgba(16, 185, 129, 0.15)"
              stroke="#10b981"
              strokeWidth={1.8}
            />
            <Rect x={-half * 0.7} y={-half * 0.6} width={size * 0.7} height={size * 0.25} fill="#064e3b" />
            <Text x={-11} y={-half * 0.55} text="KNX-ACT" fontSize={6} fill="#6ee7b7" fontStyle="bold" />
            <Circle x={-half * 0.4} y={half * 0.15} radius={2} fill="#10b981" />
            <Circle x={0} y={half * 0.15} radius={2} fill="#10b981" />
            <Circle x={half * 0.4} y={half * 0.15} radius={2} fill="#10b981" />
          </Group>
        );

      case 'knx_power_supply':
        return (
          <Group>
            <Rect
              x={-half * 0.8}
              y={-half * 0.8}
              width={size * 0.8}
              height={size * 0.8}
              cornerRadius={2}
              fill="rgba(16, 185, 129, 0.2)"
              stroke="#10b981"
              strokeWidth={2}
            />
            <Text x={-10} y={-half * 0.4} text="30V" fontSize={7} fill="#10b981" fontStyle="bold" />
            <Text x={-12} y={half * 0.1} text="KNX" fontSize={6.5} fill="#a7f3d0" />
          </Group>
        );

      case 'leak_sensor':
        return (
          <Group>
            <Circle radius={half * 0.7} fill="rgba(14, 165, 233, 0.2)" stroke="#0ea5e9" strokeWidth={1.5} />
            <Circle radius={half * 0.35} fill="#0ea5e9" />
            <Arc innerRadius={half * 0.45} outerRadius={half * 0.55} angle={120} rotation={-60} fill="#38bdf8" />
          </Group>
        );

      case 'custom_element': {
        const c = activeColor || '#f59e0b';
        switch (customSymbolShape) {
          case 'ev_charger':
            return (
              <Group>
                <Rect
                  x={-half * 0.75}
                  y={-half * 0.85}
                  width={half * 1.5}
                  height={half * 1.7}
                  cornerRadius={4}
                  fill="rgba(16, 185, 129, 0.2)"
                  stroke={c}
                  strokeWidth={2}
                />
                <Text x={-8} y={-half * 0.6} text="EV" fontSize={8} fill={c} fontStyle="bold" />
                <Path data="M 0,-2 L -2,4 L 2,4 L 0,8" stroke={c} strokeWidth={1.5} fill={c} />
              </Group>
            );
          case 'rack':
            return (
              <Group>
                <Rect
                  x={-half * 0.85}
                  y={-half * 0.85}
                  width={half * 1.7}
                  height={half * 1.7}
                  fill="rgba(2, 132, 199, 0.2)"
                  stroke={c}
                  strokeWidth={2}
                />
                <Line points={[-half * 0.6, -half * 0.3, half * 0.6, -half * 0.3]} stroke={c} strokeWidth={1.5} />
                <Line points={[-half * 0.6, 0, half * 0.6, 0]} stroke={c} strokeWidth={1.5} />
                <Line points={[-half * 0.6, half * 0.3, half * 0.6, half * 0.3]} stroke={c} strokeWidth={1.5} />
                <Circle x={-half * 0.5} y={-half * 0.6} r={1.5} fill={c} />
                <Circle x={half * 0.5} y={-half * 0.6} r={1.5} fill={c} />
              </Group>
            );
          case 'speaker':
            return (
              <Group>
                <Circle radius={half * 0.8} fill="rgba(168, 85, 247, 0.15)" stroke={c} strokeWidth={1.8} />
                <Circle radius={half * 0.45} stroke={c} strokeWidth={1.5} />
                <Circle radius={half * 0.18} fill={c} />
              </Group>
            );
          case 'motor':
            return (
              <Group>
                <Circle radius={half * 0.75} fill="rgba(236, 72, 153, 0.15)" stroke={c} strokeWidth={2} />
                <Text x={-5} y={-5} text="M" fontSize={10} fill={c} fontStyle="bold" />
              </Group>
            );
          case 'square':
            return (
              <Group>
                <Rect
                  x={-half * 0.7}
                  y={-half * 0.7}
                  width={half * 1.4}
                  height={half * 1.4}
                  fill="rgba(249, 115, 22, 0.2)"
                  stroke={c}
                  strokeWidth={2}
                />
                <Line points={[-half * 0.7, -half * 0.7, half * 0.7, half * 0.7]} stroke={c} strokeWidth={1.5} />
              </Group>
            );
          case 'triangle':
            return (
              <Group>
                <Line
                  points={[0, -half * 0.8, -half * 0.75, half * 0.7, half * 0.75, half * 0.7]}
                  closed
                  fill="rgba(245, 158, 11, 0.2)"
                  stroke={c}
                  strokeWidth={2}
                />
                <Text x={-3} y={-1} text="!" fontSize={8} fill={c} fontStyle="bold" />
              </Group>
            );
          case 'cross':
            return (
              <Group>
                <Circle radius={half * 0.75} fill="rgba(239, 68, 68, 0.15)" stroke={c} strokeWidth={1.5} />
                <Line points={[-half * 0.45, 0, half * 0.45, 0]} stroke={c} strokeWidth={2.5} />
                <Line points={[0, -half * 0.45, 0, half * 0.45]} stroke={c} strokeWidth={2.5} />
              </Group>
            );
          case 'diamond':
            return (
              <Group>
                <Line
                  points={[0, -half * 0.85, half * 0.85, 0, 0, half * 0.85, -half * 0.85, 0]}
                  closed
                  fill="rgba(16, 185, 129, 0.2)"
                  stroke={c}
                  strokeWidth={2}
                />
              </Group>
            );
          case 'star':
            return (
              <Group>
                <Circle radius={half * 0.8} fill="rgba(234, 179, 8, 0.2)" stroke={c} strokeWidth={1.5} />
                <Text x={-6} y={-7} text="★" fontSize={13} fill={c} />
              </Group>
            );
          case 'sensor':
            return (
              <Group>
                <Circle radius={half * 0.75} fill="rgba(6, 182, 212, 0.2)" stroke={c} strokeWidth={1.5} />
                <Arc innerRadius={half * 0.3} outerRadius={half * 0.6} angle={90} rotation={-45} fill={c} />
              </Group>
            );
          default:
            return (
              <Group>
                <Circle radius={half * 0.7} fill="rgba(56, 189, 248, 0.2)" stroke={c} strokeWidth={2} />
                <Circle radius={half * 0.3} fill={c} />
              </Group>
            );
        }
      }

      default:
        return <Circle radius={half * 0.4} fill={activeColor || color} />;
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
