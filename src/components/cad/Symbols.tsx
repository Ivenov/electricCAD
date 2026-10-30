import React from 'react';
import { ElectricalElementType } from '../../types/cad';

interface SymbolProps {
  type: ElectricalElementType;
  size?: number;
  isGost?: boolean;
  color?: string;
  isSelected?: boolean;
  label?: string;
  mountingHeightMm?: number;
  showHeightTag?: boolean;
}

export const ElectricalSymbol: React.FC<SymbolProps> = ({
  type,
  size = 28,
  isGost = true,
  color = '#38bdf8',
  isSelected = false,
  label,
  mountingHeightMm,
  showHeightTag = true,
}) => {
  const half = size / 2;

  const renderContent = () => {
    switch (type) {
      // ------------------------------------------------
      // SOCKETS / РОЗЕТКИ
      // ------------------------------------------------
      case 'socket_single':
        return (
          <g>
            {/* Semicircle */}
            <path
              d={`M ${-half * 0.75} 0 A ${half * 0.75} ${half * 0.75} 0 0 1 ${half * 0.75} 0 Z`}
              fill={isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)'}
              stroke="currentColor"
              strokeWidth="2"
            />
            {/* Single pin indicator line */}
            <line x1="0" y1="0" x2="0" y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
          </g>
        );

      case 'socket_double':
        return (
          <g>
            <path
              d={`M ${-half * 0.75} 0 A ${half * 0.75} ${half * 0.75} 0 0 1 ${half * 0.75} 0 Z`}
              fill={isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)'}
              stroke="currentColor"
              strokeWidth="2"
            />
            {/* 2 lines for double */}
            <line x1={-half * 0.3} y1="0" x2={-half * 0.3} y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
            <line x1={half * 0.3} y1="0" x2={half * 0.3} y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
          </g>
        );

      case 'socket_triple':
      case 'socket_quad':
        return (
          <g>
            <path
              d={`M ${-half * 0.85} 0 A ${half * 0.85} ${half * 0.85} 0 0 1 ${half * 0.85} 0 Z`}
              fill={isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)'}
              stroke="currentColor"
              strokeWidth="2"
            />
            <line x1={-half * 0.45} y1="0" x2={-half * 0.45} y2={-half * 0.95} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1="0" x2="0" y2={-half * 0.95} stroke="currentColor" strokeWidth="2" />
            <line x1={half * 0.45} y1="0" x2={half * 0.45} y2={-half * 0.95} stroke="currentColor" strokeWidth="2" />
            {type === 'socket_quad' && (
              <text x="0" y={half * 0.5} fontSize="8" fill="currentColor" textAnchor="middle" fontWeight="bold">
                x4
              </text>
            )}
          </g>
        );

      case 'socket_ip44':
        return (
          <g>
            {/* Solid filled waterproof semicircle */}
            <path
              d={`M ${-half * 0.75} 0 A ${half * 0.75} ${half * 0.75} 0 0 1 ${half * 0.75} 0 Z`}
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line x1="0" y1="0" x2="0" y2={-half * 0.95} stroke="currentColor" strokeWidth="2.5" />
            <line x1={-half * 0.3} y1={-half * 0.95} x2={half * 0.3} y2={-half * 0.95} stroke="currentColor" strokeWidth="2.5" />
            <text x="0" y={half * 0.6} fontSize="7" fill="#38bdf8" textAnchor="middle" fontWeight="bold">
              IP44
            </text>
          </g>
        );

      case 'socket_cooker':
        return (
          <g>
            <polygon
              points={`0,${-half * 0.9} ${half * 0.8},${half * 0.6} ${-half * 0.8},${half * 0.6}`}
              fill="rgba(239, 68, 68, 0.25)"
              stroke="#ef4444"
              strokeWidth="2"
            />
            <circle cx="0" cy="0" r={half * 0.25} fill="#ef4444" />
            <text x="0" y={half * 0.45} fontSize="7" fill="#ef4444" textAnchor="middle" fontWeight="bold">
              32A
            </text>
          </g>
        );

      case 'socket_rj45':
        return (
          <g>
            <rect
              x={-half * 0.6}
              y={-half * 0.6}
              width={size * 0.6}
              height={size * 0.6}
              fill="rgba(168, 85, 247, 0.2)"
              stroke="#c084fc"
              strokeWidth="2"
            />
            <text x="0" y="3" fontSize="8" fill="#c084fc" textAnchor="middle" fontWeight="bold">
              RJ
            </text>
          </g>
        );

      case 'socket_tv':
        return (
          <g>
            <rect
              x={-half * 0.6}
              y={-half * 0.6}
              width={size * 0.6}
              height={size * 0.6}
              fill="rgba(168, 85, 247, 0.2)"
              stroke="#c084fc"
              strokeWidth="2"
            />
            <text x="0" y="3" fontSize="8" fill="#c084fc" textAnchor="middle" fontWeight="bold">
              TV
            </text>
          </g>
        );

      case 'socket_usb':
        return (
          <g>
            <path
              d={`M ${-half * 0.7} 0 A ${half * 0.7} ${half * 0.7} 0 0 1 ${half * 0.7} 0 Z`}
              fill="rgba(56, 189, 248, 0.2)"
              stroke="currentColor"
              strokeWidth="2"
            />
            <text x="0" y={-half * 0.2} fontSize="7" fill="currentColor" textAnchor="middle" fontWeight="bold">
              USB
            </text>
          </g>
        );

      case 'socket_floor':
        return (
          <g>
            <rect
              x={-half * 0.7}
              y={-half * 0.7}
              width={size * 0.7}
              height={size * 0.7}
              fill="rgba(245, 158, 11, 0.2)"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            <circle cx="0" cy="0" r={half * 0.3} fill="#f59e0b" />
          </g>
        );

      case 'thermostat':
        return (
          <g>
            <rect
              x={-half * 0.7}
              y={-half * 0.7}
              width={size * 0.7}
              height={size * 0.7}
              fill="rgba(249, 115, 22, 0.25)"
              stroke="#f97316"
              strokeWidth="2"
            />
            <circle cx="0" cy="0" r={half * 0.4} fill="none" stroke="#f97316" strokeWidth="1.5" />
            <text x="0" y="3" fontSize="8" fill="#f97316" textAnchor="middle" fontWeight="bold">
              °C
            </text>
          </g>
        );

      // ------------------------------------------------
      // SWITCHES / ВЫКЛЮЧАТЕЛИ
      // ------------------------------------------------
      case 'switch_1g':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.45} fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.45} x2="0" y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.9} x2={half * 0.4} y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
          </g>
        );

      case 'switch_2g':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.45} fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.45} x2="0" y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
            {/* 2 flags */}
            <line x1="0" y1={-half * 0.9} x2={half * 0.4} y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.7} x2={half * 0.4} y2={-half * 0.7} stroke="currentColor" strokeWidth="2" />
          </g>
        );

      case 'switch_3g':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.45} fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.45} x2="0" y2={-half * 0.95} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.95} x2={half * 0.4} y2={-half * 0.95} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.75} x2={half * 0.4} y2={-half * 0.75} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.55} x2={half * 0.4} y2={-half * 0.55} stroke="currentColor" strokeWidth="2" />
          </g>
        );

      case 'switch_pass':
        return (
          <g>
            {/* Two-way pass switch has flags in opposite directions */}
            <circle cx="0" cy="0" r={half * 0.45} fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.45} x2="0" y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.9} x2={half * 0.4} y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={half * 0.45} x2="0" y2={half * 0.9} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={half * 0.9} x2={-half * 0.4} y2={half * 0.9} stroke="currentColor" strokeWidth="2" />
          </g>
        );

      case 'switch_cross':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.45} fill="currentColor" stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.45} x2="0" y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={-half * 0.9} x2={half * 0.4} y2={-half * 0.9} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={half * 0.45} x2="0" y2={half * 0.9} stroke="currentColor" strokeWidth="2" />
            <line x1="0" y1={half * 0.9} x2={-half * 0.4} y2={half * 0.9} stroke="currentColor" strokeWidth="2" />
          </g>
        );

      case 'switch_dimmer':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.45} fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1={-half * 0.5} y1={half * 0.5} x2={half * 0.5} y2={-half * 0.5} stroke="currentColor" strokeWidth="2" />
            {/* Dimmer arrow */}
            <polygon
              points={`${half * 0.5},${-half * 0.5} ${half * 0.3},${-half * 0.6} ${half * 0.4},${-half * 0.3}`}
              fill="currentColor"
            />
          </g>
        );

      case 'switch_master':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.55} fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="2" />
            <text x="0" y="3.5" fontSize="9" fill="#ef4444" textAnchor="middle" fontWeight="bold">
              OFF
            </text>
          </g>
        );

      // ------------------------------------------------
      // LIGHTING / ОСВЕЩЕНИЕ
      // ------------------------------------------------
      case 'light_pendant':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.75} fill="rgba(250, 204, 21, 0.15)" stroke="#eab308" strokeWidth="2" />
            {/* Cross inside circle according to GOST */}
            <line x1={-half * 0.53} y1={-half * 0.53} x2={half * 0.53} y2={half * 0.53} stroke="#eab308" strokeWidth="2" />
            <line x1={-half * 0.53} y1={half * 0.53} x2={half * 0.53} y2={-half * 0.53} stroke="#eab308" strokeWidth="2" />
          </g>
        );

      case 'light_spot':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.5} fill="none" stroke="#eab308" strokeWidth="2" />
            <circle cx="0" cy="0" r={half * 0.2} fill="#eab308" />
          </g>
        );

      case 'light_sconce':
        return (
          <g>
            {/* Wall sconce / бра */}
            <path
              d={`M ${-half * 0.6} 0 A ${half * 0.6} ${half * 0.6} 0 0 1 ${half * 0.6} 0 Z`}
              fill="#eab308"
              stroke="#eab308"
              strokeWidth="2"
            />
            <line x1={-half * 0.7} y1="0" x2={half * 0.7} y2="0" stroke="currentColor" strokeWidth="2" />
          </g>
        );

      case 'light_track':
        return (
          <g>
            <line x1={-half * 0.9} y1="0" x2={half * 0.9} y2="0" stroke="#eab308" strokeWidth="3" />
            <circle cx={-half * 0.5} cy="0" r={half * 0.2} fill="#eab308" />
            <circle cx="0" cy="0" r={half * 0.2} fill="#eab308" />
            <circle cx={half * 0.5} cy="0" r={half * 0.2} fill="#eab308" />
          </g>
        );

      case 'light_led_strip':
        return (
          <g>
            <path
              d={`M ${-half * 0.8} ${-half * 0.2} Q 0 ${half * 0.5}, ${half * 0.8} ${-half * 0.2}`}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.5"
              strokeDasharray="3 2"
            />
            <circle cx="0" cy="0" r={half * 0.15} fill="#fbbf24" />
          </g>
        );

      case 'light_sensor':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.6} fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" strokeWidth="2" />
            <path d={`M ${-half * 0.4} 0 Q 0 ${-half * 0.4}, ${half * 0.4} 0`} fill="none" stroke="#22c55e" strokeWidth="1.5" />
            <circle cx="0" cy="0" r={half * 0.15} fill="#22c55e" />
          </g>
        );

      // ------------------------------------------------
      // PANELS & DISTRIBUTION / ЩИТЫ И БЛОКИ
      // ------------------------------------------------
      case 'panel_cu':
        return (
          <g>
            {/* GOST Electrical Cabinet Symbol: rectangle split diagonally */}
            <rect
              x={-half * 0.8}
              y={-half * 0.8}
              width={size * 0.8}
              height={size * 0.8}
              fill="rgba(15, 23, 42, 0.9)"
              stroke="#f59e0b"
              strokeWidth="2.5"
            />
            <polygon
              points={`${-half * 0.8},${-half * 0.8} ${half * 0.8},${-half * 0.8} ${half * 0.8},${half * 0.8}`}
              fill="#f59e0b"
            />
            <line x1={-half * 0.8} y1={-half * 0.8} x2={half * 0.8} y2={half * 0.8} stroke="#0f172a" strokeWidth="1.5" />
          </g>
        );

      case 'junction_box':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.45} fill="#1e293b" stroke="currentColor" strokeWidth="2" />
            <line x1={-half * 0.3} y1="0" x2={half * 0.3} y2="0" stroke="currentColor" strokeWidth="1.5" />
            <line x1="0" y1={-half * 0.3} x2="0" y2={half * 0.3} stroke="currentColor" strokeWidth="1.5" />
          </g>
        );

      case 'led_driver':
        return (
          <g>
            <rect
              x={-half * 0.8}
              y={-half * 0.4}
              width={size * 0.8}
              height={size * 0.4}
              fill="#334155"
              stroke="#fbbf24"
              strokeWidth="1.5"
            />
            <text x="0" y="2" fontSize="6.5" fill="#fbbf24" textAnchor="middle" fontWeight="bold">
              12/24V
            </text>
          </g>
        );

      case 'ac_indoor':
        return (
          <g>
            <rect
              x={-half * 0.9}
              y={-half * 0.45}
              width={size * 0.9}
              height={size * 0.45}
              rx="2"
              fill="rgba(56, 189, 248, 0.2)"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            <line x1={-half * 0.7} y1="0" x2={half * 0.7} y2="0" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 1" />
            <text x="0" y="2.5" fontSize="7" fill="#38bdf8" textAnchor="middle" fontWeight="bold">
              AC
            </text>
          </g>
        );

      case 'water_heater':
        return (
          <g>
            <circle cx="0" cy="0" r={half * 0.65} fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="2" />
            <text x="0" y="3" fontSize="8" fill="#ef4444" textAnchor="middle" fontWeight="bold">
              БОЙЛ
            </text>
          </g>
        );

      // ------------------------------------------------
      // BACKUP & AUTONOMY / РЕЗЕРВНЕ ЖИВЛЕННЯ
      // ------------------------------------------------
      case 'backup_inverter':
        return (
          <g>
            <rect
              x={-half * 0.85}
              y={-half * 0.85}
              width={size * 0.85}
              height={size * 0.85}
              rx="3"
              fill="rgba(16, 185, 129, 0.2)"
              stroke="#10b981"
              strokeWidth="2"
            />
            <path d={`M ${-half * 0.5} 0 Q ${-half * 0.25} ${-half * 0.4}, 0 0 T ${half * 0.5} 0`} fill="none" stroke="#10b981" strokeWidth="1.5" />
            <text x="0" y={half * 0.45} fontSize="6.5" fill="#10b981" textAnchor="middle" fontWeight="bold">
              5kW
            </text>
          </g>
        );

      case 'backup_battery':
        return (
          <g>
            <rect
              x={-half * 0.8}
              y={-half * 0.6}
              width={size * 0.8}
              height={size * 0.6}
              rx="2"
              fill="rgba(52, 211, 153, 0.25)"
              stroke="#34d399"
              strokeWidth="2"
            />
            <rect x={-half * 0.4} y={-half * 0.75} width={half * 0.25} height={half * 0.2} fill="#34d399" />
            <rect x={half * 0.15} y={-half * 0.75} width={half * 0.25} height={half * 0.2} fill="#34d399" />
            <text x="0" y={half * 0.15} fontSize="7" fill="#34d399" textAnchor="middle" fontWeight="bold">
              LiFe
            </text>
          </g>
        );

      case 'backup_station':
        return (
          <g>
            <rect
              x={-half * 0.8}
              y={-half * 0.55}
              width={size * 0.8}
              height={size * 0.55}
              rx="3"
              fill="rgba(245, 158, 11, 0.25)"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            <path d={`M ${-half * 0.35} ${-half * 0.55} L ${-half * 0.35} ${-half * 0.75} L ${half * 0.35} ${-half * 0.75} L ${half * 0.35} ${-half * 0.55}`} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="0" y={half * 0.15} fontSize="7" fill="#f59e0b" textAnchor="middle" fontWeight="bold">
              ECO
            </text>
          </g>
        );

      case 'backup_ats':
        return (
          <g>
            <rect
              x={-half * 0.8}
              y={-half * 0.8}
              width={size * 0.8}
              height={size * 0.8}
              rx="2"
              fill="rgba(217, 70, 239, 0.2)"
              stroke="#d946ef"
              strokeWidth="2"
            />
            <text x="0" y="2.5" fontSize="7" fill="#d946ef" textAnchor="middle" fontWeight="bold">
              I-0-II
            </text>
          </g>
        );

      case 'backup_generator':
        return (
          <g>
            <rect
              x={-half * 0.95}
              y={-half * 0.75}
              width={size * 0.95}
              height={size * 0.75}
              rx="4"
              fill="rgba(239, 68, 68, 0.2)"
              stroke="#ef4444"
              strokeWidth="2"
            />
            <rect
              x={-half * 0.7}
              y={-half * 0.7}
              width={size * 0.7}
              height={size * 0.22}
              rx="2"
              fill="rgba(239, 68, 68, 0.4)"
              stroke="#ef4444"
              strokeWidth="1"
            />
            <text x="0" y={half * 0.25} fontSize="6" fill="#ef4444" textAnchor="middle" fontWeight="bold">
              ГЕН 6.5кВт
            </text>
          </g>
        );

      default:
        return <circle cx="0" cy="0" r={half * 0.5} fill="currentColor" />;
    }
  };

  return (
    <g className="cursor-pointer select-none transition-transform duration-100 hover:scale-110" style={{ color }}>
      {/* Selection halo */}
      {isSelected && (
        <circle
          cx="0"
          cy="0"
          r={half * 1.3}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeDasharray="3 2"
          className="animate-pulse"
        />
      )}

      {renderContent()}

      {/* Label or Switch Group ID */}
      {label && (
        <text
          x={half * 0.8}
          y={-half * 0.6}
          fontSize="9"
          fill="currentColor"
          fontWeight="600"
          className="pointer-events-none drop-shadow"
        >
          {label}
        </text>
      )}

      {/* Height tag (+300, +900, +1050) */}
      {showHeightTag && mountingHeightMm !== undefined && (
        <text
          x="0"
          y={half + 9}
          fontSize="7.5"
          fill="#94a3b8"
          textAnchor="middle"
          fontWeight="500"
          className="pointer-events-none font-mono tracking-tight"
        >
          +{mountingHeightMm}
        </text>
      )}
    </g>
  );
};
