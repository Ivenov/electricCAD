/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Векторна принципова однолінійна електрична схема щита (ВРП / ЩРН)
 * за стандартами ДСТУ Б А.2.4-4:2009 та ГОСТ 2.702 / 2.709.
 */

import React, { useMemo } from 'react';
import { CadProject, CircuitGroup } from '../../types/cad';
import {
  VOLTAGE_1PH,
  VOLTAGE_3PH,
  analyzeCircuit,
  calculateProjectElectricalSummary,
  CircuitAnalysis,
} from '../../utils/electricalCalculations';

interface SingleLineSchematicSvgProps {
  project: CadProject;
  width?: number;
  height?: number;
  demandFactor?: number;
}

export const SingleLineSchematicSvg: React.FC<SingleLineSchematicSvgProps> = ({
  project,
  width = 1100,
  height = 580,
  demandFactor,
}) => {
  const is3Ph = project.supplyPhase === '3-phase';
  const summary = useMemo(
    () => calculateProjectElectricalSummary(project, demandFactor),
    [project, demandFactor]
  );

  const circuitAnalyses: CircuitAnalysis[] = useMemo(() => {
    return project.circuits.map((c) =>
      analyzeCircuit(c, project.elements, project.wires, project.supplyPhase)
    );
  }, [project]);

  const numCircuits = Math.max(1, project.circuits.length);
  // Геометрична сітка схеми
  const colWidth = Math.max(90, Math.floor((width - 240) / numCircuits));
  const svgWidth = Math.max(width, 240 + numCircuits * colWidth + 40);
  const svgHeight = height;

  const headerY = 50;
  const mainBreakerY = 110;
  const relayY = 160;
  const busbarY = 220;
  const circuitBreakerY = 280;
  const rcdY = 340;
  const terminalY = 400;
  const tableY = 430;

  return (
    <div className="w-full overflow-x-auto bg-white p-4 border border-neutral-300 rounded-lg shadow-sm">
      <svg
        id="single-line-diagram-svg"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto min-w-[900px] select-none font-sans text-neutral-900"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background Grid Accent */}
        <defs>
          <pattern id="dstu_grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={svgWidth} height={svgHeight} fill="url(#dstu_grid)" />

        {/* Title Header */}
        <text x="30" y="30" fontSize="13" fontWeight="bold" fill="#0f172a" fontFamily="sans-serif">
          ПРИНЦИПОВА ОДНОЛІНІЙНА РОЗРАХУНКОВА СХЕМА ЩИТА ({project.title || 'ВРП-1'})
        </text>
        <text x="30" y="45" fontSize="10" fill="#475569" fontFamily="monospace">
          Система заземлення: TN-C-S | Напруга: {is3Ph ? '3~ 400 В / 50 Гц' : '1~ 230 В / 50 Гц'} | Рвст: {summary.installedPowerKw} кВт | Ррозр: {summary.designPowerKw} кВт (Kп={summary.demandFactor})
        </text>

        {/* INPUT FEED (Ввідна лінія) */}
        <g id="input_feed">
          {/* Main Feed Arrow and Cable */}
          <line x1="80" y1={headerY + 15} x2="80" y2={mainBreakerY - 15} stroke="#0f172a" strokeWidth="2.5" />
          <polygon points="76,65 80,50 84,65" fill="#0f172a" />
          
          <text x="95" y={headerY + 22} fontSize="9" fontWeight="bold" fill="#1e293b">
            ВВІД ВІД ЕЛЕКТРОМЕРЕЖІ
          </text>
          <text x="95" y={headerY + 34} fontSize="8.5" fill="#475569" fontFamily="monospace">
            {is3Ph ? 'Кабель ВВГнгд 5х10 (мідь)' : 'Кабель ВВГнгд 3х10 (мідь)'}
          </text>

          {/* Main Circuit Breaker QF1 */}
          <rect x="68" y={mainBreakerY - 15} width="24" height="30" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />
          <line x1="68" y1={mainBreakerY} x2="92" y2={mainBreakerY - 10} stroke="#dc2626" strokeWidth="2" />
          <text x="100" y={mainBreakerY - 2} fontSize="9" fontWeight="bold" fill="#dc2626">
            QF1: C{project.mainBreakerRatingA}A (Ввідний автомат)
          </text>
          <text x="100" y={mainBreakerY + 10} fontSize="8" fill="#64748b">
            Iном = {project.mainBreakerRatingA}A, Iрозр = {summary.mainCurrentA}A, 6кА
          </text>

          {/* Feed wire from Main Breaker to Voltage Relay */}
          <line x1="80" y1={mainBreakerY + 15} x2="80" y2={relayY - 15} stroke="#0f172a" strokeWidth="2.5" />

          {/* Voltage Protection Relay KV1 */}
          <rect x="65" y={relayY - 15} width="30" height="30" fill="#f8fafc" stroke="#0284c7" strokeWidth="1.8" />
          <text x="80" y={relayY + 4} fontSize="10" fontWeight="bold" fill="#0284c7" textAnchor="middle">
            U&gt;&lt;
          </text>
          <text x="105" y={relayY - 2} fontSize="9" fontWeight="bold" fill="#0284c7">
            KV1: Реле захисту напруги (Zubr {is3Ph ? '3F' : 'D63'})
          </text>
          <text x="105" y={relayY + 10} fontSize="8" fill="#64748b">
            Захист побутової техніки від стрибків 160-280В
          </text>

          {/* Wire to Main Busbar */}
          <line x1="80" y1={relayY + 15} x2="80" y2={busbarY} stroke="#0f172a" strokeWidth="2.5" />
          <circle cx="80" cy={busbarY} r="3.5" fill="#0f172a" />
        </g>

        {/* MAIN COPPER DISTRIBUTION BUSBAR (Фазна шина L) */}
        <g id="busbars">
          <line
            x1="70"
            y1={busbarY}
            x2={180 + numCircuits * colWidth - 20}
            y2={busbarY}
            stroke="#b45309"
            strokeWidth="4"
          />
          <text x="35" y={busbarY + 4} fontSize="9" fontWeight="bold" fill="#b45309">
            Шина L
          </text>

          {/* Neutral N busbar */}
          <line
            x1="70"
            y1={busbarY + 12}
            x2={180 + numCircuits * colWidth - 20}
            y2={busbarY + 12}
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeDasharray="4 2"
          />
          <text x="35" y={busbarY + 15} fontSize="9" fontWeight="bold" fill="#0284c7">
            Шина N
          </text>

          {/* PE protective earth busbar */}
          <line
            x1="70"
            y1={busbarY + 22}
            x2={180 + numCircuits * colWidth - 20}
            y2={busbarY + 22}
            stroke="#16a34a"
            strokeWidth="3"
            strokeDasharray="6 3"
          />
          <text x="35" y={busbarY + 26} fontSize="9" fontWeight="bold" fill="#16a34a">
            Шина PE
          </text>
        </g>

        {/* OUTGOING CIRCUITS (Групові лінії) */}
        {circuitAnalyses.map((analysis, index) => {
          const colX = 180 + index * colWidth;
          const { circuit, totalInstalledWatts, calculatedCurrentA, voltageDrop, isBreakerOverloaded } = analysis;
          const hasRcd = circuit.rcdType && circuit.rcdType !== 'none';
          const rcdLabel = circuit.rcdType.includes('10ma') ? '10 мА' : '30 мА';

          return (
            <g key={circuit.id} id={`circuit_col_${circuit.id}`}>
              {/* Branch Connection Node on Busbar */}
              <circle cx={colX} cy={busbarY} r="3" fill="#b45309" />
              <line x1={colX} y1={busbarY} x2={colX} y2={circuitBreakerY - 15} stroke="#0f172a" strokeWidth="1.8" />

              {/* Circuit Phase label tag */}
              <rect x={colX - 12} y={busbarY + 30} width="24" height="12" fill="#f8fafc" stroke="#cbd5e1" rx="2" />
              <text x={colX} y={busbarY + 39} fontSize="8" fontWeight="bold" fill="#475569" textAnchor="middle">
                {circuit.phase || 'L1'}
              </text>

              {/* Circuit Breaker QF Symbol */}
              <rect
                x={colX - 12}
                y={circuitBreakerY - 15}
                width="24"
                height="26"
                fill="#ffffff"
                stroke={isBreakerOverloaded ? '#ef4444' : '#0f172a'}
                strokeWidth="1.8"
              />
              <line
                x1={colX - 12}
                y1={circuitBreakerY - 2}
                x2={colX + 12}
                y2={circuitBreakerY - 10}
                stroke={isBreakerOverloaded ? '#ef4444' : '#0f172a'}
                strokeWidth="1.8"
              />
              {/* Breaker Rating Text */}
              <text
                x={colX + 15}
                y={circuitBreakerY - 2}
                fontSize="8.5"
                fontWeight="bold"
                fill={isBreakerOverloaded ? '#ef4444' : '#0f172a'}
                fontFamily="monospace"
              >
                {circuit.breakerCurve}{circuit.breakerRatingA}A
              </text>

              {/* Line from Breaker to RCD or Terminal */}
              <line x1={colX} y1={circuitBreakerY + 11} x2={colX} y2={rcdY - 15} stroke="#0f172a" strokeWidth="1.8" />

              {/* Differential Protection (RCD / RCBO) if present */}
              {hasRcd ? (
                <g>
                  <circle
                    cx={colX}
                    cy={rcdY}
                    r="12"
                    fill="#ffffff"
                    stroke="#0284c7"
                    strokeWidth="1.6"
                  />
                  <path
                    d={`M ${colX - 6} ${rcdY} Q ${colX} ${rcdY - 6} ${colX + 6} ${rcdY}`}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="1.4"
                  />
                  <text
                    x={colX + 15}
                    y={rcdY + 3}
                    fontSize="8"
                    fontWeight="semibold"
                    fill="#0284c7"
                    fontFamily="monospace"
                  >
                    IΔn={rcdLabel}
                  </text>
                  <line x1={colX} y1={rcdY + 12} x2={colX} y2={terminalY} stroke="#0f172a" strokeWidth="1.8" />
                </g>
              ) : (
                <line x1={colX} y1={rcdY - 15} x2={colX} y2={terminalY} stroke="#0f172a" strokeWidth="1.8" />
              )}

              {/* Outgoing Cable Terminal Symbol */}
              <circle cx={colX} cy={terminalY} r="2.5" fill="#0f172a" />
              <line x1={colX} y1={terminalY} x2={colX} y2={terminalY + 15} stroke="#0f172a" strokeWidth="1.8" />
              <polygon points={`${colX - 3},${terminalY + 15} ${colX},${terminalY + 20} ${colX + 3},${terminalY + 15}`} fill="#0f172a" />

              {/* Vertical Divider Line for Schedule Table */}
              <line
                x1={colX - colWidth / 2}
                y1={tableY}
                x2={colX - colWidth / 2}
                y2={tableY + 140}
                stroke="#cbd5e1"
                strokeWidth="1"
              />

              {/* Table Data for This Circuit Column */}
              <g transform={`translate(${colX}, ${tableY})`}>
                {/* Circuit Number & Name */}
                <text x="0" y="14" fontSize="9" fontWeight="bold" fill="#0f172a" textAnchor="middle">
                  Гр. {circuit.number}
                </text>
                
                {/* Truncated Name */}
                <text
                  x="0"
                  y="28"
                  fontSize="7.5"
                  fill="#334155"
                  textAnchor="middle"
                  className="font-medium"
                >
                  {circuit.name.length > 14 ? circuit.name.slice(0, 13) + '…' : circuit.name}
                </text>

                {/* Cable mark */}
                <text x="0" y="44" fontSize="7.5" fill="#0f172a" textAnchor="middle" fontFamily="monospace">
                  {circuit.cableType.replace('VVGng_', 'ВВГнгд ')}
                </text>

                {/* Installed Power (Pвст) */}
                <text x="0" y="60" fontSize="8" fill="#475569" textAnchor="middle" fontFamily="monospace">
                  Pвст = {totalInstalledWatts} Вт
                </text>

                {/* Design Current (Iрозр) */}
                <text
                  x="0"
                  y="76"
                  fontSize="8"
                  fontWeight="bold"
                  fill={isBreakerOverloaded ? '#ef4444' : '#0f172a'}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  Iрозр = {calculatedCurrentA} А
                </text>

                {/* Voltage Drop (ΔU) */}
                <text
                  x="0"
                  y="92"
                  fontSize="7.5"
                  fill={voltageDrop.isAcceptable ? '#16a34a' : '#d97706'}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  ΔU = {voltageDrop.deltaPercent}% ({voltageDrop.cableLengthM.toFixed(1)}м)
                </text>

                {/* Backup Badge */}
                {circuit.isBackupPriority && (
                  <g>
                    <rect x="-24" y="102" width="48" height="14" rx="3" fill="#ecfdf5" stroke="#10b981" />
                    <text x="0" y="112" fontSize="7" fontWeight="bold" fill="#047857" textAnchor="middle">
                      ⚡ ДБЖ
                    </text>
                  </g>
                )}
              </g>
            </g>
          );
        })}

        {/* Schedule Table Header Row & Labels */}
        <g id="table_headers" transform={`translate(20, ${tableY})`}>
          <rect x="0" y="0" width={svgWidth - 40} height="140" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.2" rx="4" />
          <line x1="0" y1="18" x2={svgWidth - 40} y2="18" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="34" x2={svgWidth - 40} y2="34" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="50" x2={svgWidth - 40} y2="50" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="66" x2={svgWidth - 40} y2="66" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="82" x2={svgWidth - 40} y2="82" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="0" y1="98" x2={svgWidth - 40} y2="98" stroke="#cbd5e1" strokeWidth="1" />

          {/* Left Title Column Labels */}
          <text x="10" y="13" fontSize="8" fontWeight="bold" fill="#475569">
            Номер групи
          </text>
          <text x="10" y="27" fontSize="8" fontWeight="bold" fill="#475569">
            Призначення лінії
          </text>
          <text x="10" y="43" fontSize="8" fontWeight="bold" fill="#475569">
            Марка та переріз кабелю
          </text>
          <text x="10" y="59" fontSize="8" fontWeight="bold" fill="#475569">
            Встановлена потужність Руст
          </text>
          <text x="10" y="75" fontSize="8" fontWeight="bold" fill="#475569">
            Розрахунковий струм Ib
          </text>
          <text x="10" y="91" fontSize="8" fontWeight="bold" fill="#475569">
            Падіння напруги ΔU% (довжина)
          </text>
          <text x="10" y="112" fontSize="8" fontWeight="bold" fill="#475569">
            Резервне живлення (ДБЖ)
          </text>
        </g>
      </svg>
    </div>
  );
};
