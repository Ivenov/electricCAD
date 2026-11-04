import React, { useMemo } from 'react';
import { Point } from '../../types/cad';
import { pxToMm } from '../../utils/cadMath';

interface CadRulerProps {
  width: number;
  height: number;
  scale: number;
  stagePos: Point;
  mouseWorldPos: Point;
  showRulers?: boolean;
  onToggleRulers?: () => void;
  onResetView?: () => void;
}

export const CadRuler: React.FC<CadRulerProps> = ({
  width,
  height,
  scale,
  stagePos,
  mouseWorldPos,
  showRulers = true,
  onToggleRulers,
  onResetView,
}) => {
  if (!showRulers) return null;

  const RULER_THICKNESS_TOP = 22;
  const RULER_THICKNESS_LEFT = 28;

  // Determine tick step in world pixels (1px = 10mm, so 100px = 1000mm = 1m)
  const majorStepPx = useMemo(() => {
    if (scale >= 2.5) return 50; // 500mm major at high zoom
    if (scale >= 0.7) return 100; // 1000mm (1m) standard
    if (scale >= 0.3) return 200; // 2000mm (2m)
    return 500; // 5000mm (5m) at deep zoom out
  }, [scale]);

  const minorStepPx = majorStepPx / 5; // e.g. 20px (200mm) or 10px (100mm)

  // Top Ruler Marks calculation
  const topTicks = useMemo(() => {
    const ticks: { screenX: number; isMajor: boolean; isMedium: boolean; label?: string }[] = [];
    const minWorldX = -stagePos.x / scale;
    const maxWorldX = (width - stagePos.x) / scale;

    const startTick = Math.floor(minWorldX / minorStepPx) * minorStepPx;
    const endTick = Math.ceil(maxWorldX / minorStepPx) * minorStepPx;

    for (let worldX = startTick; worldX <= endTick; worldX += minorStepPx) {
      const screenX = worldX * scale + stagePos.x;
      if (screenX < RULER_THICKNESS_LEFT || screenX > width) continue;

      const isMajor = Math.abs(worldX % majorStepPx) < 0.1;
      const isMedium = !isMajor && Math.abs(worldX % (majorStepPx / 2)) < 0.1;

      let label: string | undefined = undefined;
      if (isMajor) {
        const mm = pxToMm(worldX);
        if (Math.abs(mm) < 1) {
          label = '0';
        } else if (Math.abs(mm) >= 1000) {
          label = `${(mm / 1000).toFixed(0)}м`;
        } else {
          label = `${mm}`;
        }
      }

      ticks.push({ screenX, isMajor, isMedium, label });
    }

    return ticks;
  }, [stagePos.x, scale, width, minorStepPx, majorStepPx]);

  // Left Ruler Marks calculation
  const leftTicks = useMemo(() => {
    const ticks: { screenY: number; isMajor: boolean; isMedium: boolean; label?: string }[] = [];
    const minWorldY = -stagePos.y / scale;
    const maxWorldY = (height - stagePos.y) / scale;

    const startTick = Math.floor(minWorldY / minorStepPx) * minorStepPx;
    const endTick = Math.ceil(maxWorldY / minorStepPx) * minorStepPx;

    for (let worldY = startTick; worldY <= endTick; worldY += minorStepPx) {
      const screenY = worldY * scale + stagePos.y;
      if (screenY < RULER_THICKNESS_TOP || screenY > height) continue;

      const isMajor = Math.abs(worldY % majorStepPx) < 0.1;
      const isMedium = !isMajor && Math.abs(worldY % (majorStepPx / 2)) < 0.1;

      let label: string | undefined = undefined;
      if (isMajor) {
        const mm = pxToMm(worldY);
        if (Math.abs(mm) < 1) {
          label = '0';
        } else if (Math.abs(mm) >= 1000) {
          label = `${(mm / 1000).toFixed(0)}м`;
        } else {
          label = `${mm}`;
        }
      }

      ticks.push({ screenY, isMajor, isMedium, label });
    }

    return ticks;
  }, [stagePos.y, scale, height, minorStepPx, majorStepPx]);

  // Screen positions for cursor hairlines on rulers
  const cursorScreenX = mouseWorldPos.x * scale + stagePos.x;
  const cursorScreenY = mouseWorldPos.y * scale + stagePos.y;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden font-mono select-none">
      {/* Top-Left Corner Box */}
      <button
        onClick={onResetView}
        className="pointer-events-auto absolute top-0 left-0 flex items-center justify-center bg-neutral-900 border-r border-b border-neutral-800 text-[10px] font-bold text-sky-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors z-20 cursor-pointer"
        style={{ width: RULER_THICKNESS_LEFT, height: RULER_THICKNESS_TOP }}
        title="Скинути початок координат (100%)"
      >
        мм
      </button>

      {/* TOP HORIZONTAL RULER */}
      <div
        className="absolute top-0 right-0 bg-neutral-950/95 backdrop-blur-sm border-b border-neutral-800"
        style={{ left: RULER_THICKNESS_LEFT, height: RULER_THICKNESS_TOP }}
      >
        <svg className="w-full h-full block">
          {topTicks.map((t, idx) => (
            <React.Fragment key={`tt_${idx}`}>
              <line
                x1={t.screenX - RULER_THICKNESS_LEFT}
                y1={RULER_THICKNESS_TOP - (t.isMajor ? 12 : t.isMedium ? 7 : 4)}
                x2={t.screenX - RULER_THICKNESS_LEFT}
                y2={RULER_THICKNESS_TOP}
                stroke={t.isMajor ? '#94a3b8' : t.isMedium ? '#64748b' : '#334155'}
                strokeWidth={t.isMajor ? 1 : 0.8}
              />
              {t.label && (
                <text
                  x={t.screenX - RULER_THICKNESS_LEFT + 3}
                  y={8}
                  fill="#94a3b8"
                  fontSize={8.5}
                  textAnchor="start"
                  className="font-mono tabular-nums"
                >
                  {t.label}
                </text>
              )}
            </React.Fragment>
          ))}

          {/* Current cursor X tracking hairline on top ruler */}
          {cursorScreenX >= RULER_THICKNESS_LEFT && cursorScreenX <= width && (
            <line
              x1={cursorScreenX - RULER_THICKNESS_LEFT}
              y1={0}
              x2={cursorScreenX - RULER_THICKNESS_LEFT}
              y2={RULER_THICKNESS_TOP}
              stroke="#06b6d4"
              strokeWidth={1.5}
            />
          )}
        </svg>
      </div>

      {/* LEFT VERTICAL RULER */}
      <div
        className="absolute left-0 bottom-0 bg-neutral-950/95 backdrop-blur-sm border-r border-neutral-800"
        style={{ top: RULER_THICKNESS_TOP, width: RULER_THICKNESS_LEFT }}
      >
        <svg className="w-full h-full block">
          {leftTicks.map((t, idx) => (
            <React.Fragment key={`lt_${idx}`}>
              <line
                x1={RULER_THICKNESS_LEFT - (t.isMajor ? 12 : t.isMedium ? 7 : 4)}
                y1={t.screenY - RULER_THICKNESS_TOP}
                x2={RULER_THICKNESS_LEFT}
                y2={t.screenY - RULER_THICKNESS_TOP}
                stroke={t.isMajor ? '#94a3b8' : t.isMedium ? '#64748b' : '#334155'}
                strokeWidth={t.isMajor ? 1 : 0.8}
              />
              {t.label && (
                <text
                  x={2}
                  y={t.screenY - RULER_THICKNESS_TOP - 2}
                  fill="#94a3b8"
                  fontSize={8}
                  textAnchor="start"
                  className="font-mono tabular-nums"
                >
                  {t.label}
                </text>
              )}
            </React.Fragment>
          ))}

          {/* Current cursor Y tracking hairline on left ruler */}
          {cursorScreenY >= RULER_THICKNESS_TOP && cursorScreenY <= height && (
            <line
              x1={0}
              y1={cursorScreenY - RULER_THICKNESS_TOP}
              x2={RULER_THICKNESS_LEFT}
              y2={cursorScreenY - RULER_THICKNESS_TOP}
              stroke="#06b6d4"
              strokeWidth={1.5}
            />
          )}
        </svg>
      </div>
    </div>
  );
};
