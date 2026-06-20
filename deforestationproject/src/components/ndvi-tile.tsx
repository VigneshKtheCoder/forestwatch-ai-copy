// Procedural NDVI/satellite heatmap — smooth enough to look like a real analysis output.
// Uses SVG feGaussianBlur + dense grid to avoid pixelated look.

import { useMemo } from "react";
import { ndviColor } from "@/lib/forest-data";

interface Props {
  seed?: number;
  decline?: number; // 0..1, higher = more deforestation
  size?: number;
  cells?: number;
  label?: string;
}

export function NdviTile({ seed = 1, decline = 0, size = 280, cells = 52, label }: Props) {
  const grid = useMemo(() => {
    const g: number[][] = [];
    for (let y = 0; y < cells; y++) {
      const row: number[] = [];
      for (let x = 0; x < cells; x++) {
        // Multi-octave procedural noise for realistic forest texture
        const n1 = Math.sin((x + seed) * 0.31) * Math.cos((y + seed * 1.7) * 0.28);
        const n2 = Math.sin((x * 0.18 + y * 0.22 + seed * 0.6) * 2.1) * 0.4;
        const n3 = Math.cos((x * 0.08 - y * 0.11 + seed) * 3.4) * 0.2;
        let v = 0.68 + n1 * 0.12 + n2 * 0.08 + n3 * 0.04;

        if (decline > 0.05) {
          // Irregular deforestation polygon (not a simple circle)
          const cx = cells * 0.58, cy = cells * 0.44;
          const distort = Math.sin(Math.atan2(y - cy, x - cx) * 3.5 + seed) * 0.18;
          const d = Math.sqrt((x - cx) ** 2 * 1.2 + (y - cy) ** 2 * 0.8) / (cells * 0.32);
          const patch = Math.max(0, 1 - (d + distort));
          v -= patch * decline * 0.72;

          // Linear clearcut roads/tracks
          const trackA = Math.abs(((x / cells) - 0.55)) < 0.025 && y > cells * 0.32 && y < cells * 0.72;
          const trackB = Math.abs(((y / cells) - 0.44)) < 0.018 && x > cells * 0.38 && x < cells * 0.82;
          if (decline > 0.25 && (trackA || trackB)) v -= 0.32 * decline;

          // Secondary small clearing
          const cx2 = cells * 0.72, cy2 = cells * 0.30;
          const d2 = Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2) / (cells * 0.12);
          if (d2 < 1) v -= Math.max(0, 1 - d2) * decline * 0.5;
        }

        row.push(Math.max(0.04, Math.min(0.95, v)));
      }
      g.push(row);
    }
    return g;
  }, [seed, decline, cells]);

  const s = size / cells;
  const filterId = `blur-${seed}-${Math.round(decline * 100)}`;

  return (
    <div className="relative">
      <svg
        width={size}
        height={size}
        className="ring-soft block overflow-hidden rounded-lg border border-border bg-card"
      >
        <defs>
          <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.85" />
          </filter>
        </defs>
        {/* Blurred NDVI layer */}
        <g filter={`url(#${filterId})`}>
          {grid.map((row, y) =>
            row.map((v, x) => (
              <rect
                key={`${x}-${y}`}
                x={x * s - 0.5}
                y={y * s - 0.5}
                width={s + 1}
                height={s + 1}
                fill={ndviColor(v)}
              />
            ))
          )}
        </g>
        {/* Faint scan-line overlay for satellite aesthetic */}
        {Array.from({ length: Math.floor(size / 6) }, (_, i) => (
          <line
            key={i}
            x1={0}
            y1={i * 6}
            x2={size}
            y2={i * 6}
            stroke="rgba(0,0,0,0.04)"
            strokeWidth={1}
          />
        ))}
        {/* Crosshair tick marks at corners */}
        {[[0, 0], [size, 0], [0, size], [size, size]].map(([cx, cy], i) => (
          <g key={i}>
            <line x1={cx === 0 ? 0 : size - 8} y1={cy === 0 ? 4 : size - 4} x2={cx === 0 ? 8 : size} y2={cy === 0 ? 4 : size - 4} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
            <line x1={cx === 0 ? 4 : size - 4} y1={cy === 0 ? 0 : size - 8} x2={cx === 0 ? 4 : size - 4} y2={cy === 0 ? 8 : size} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
          </g>
        ))}
        {/* Deforestation outline indicator */}
        {decline > 0.3 && (
          <ellipse
            cx={size * 0.57}
            cy={size * 0.45}
            rx={size * 0.21}
            ry={size * 0.18}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
        )}
      </svg>
      {label && (
        <div className="absolute left-2 top-2 rounded-md bg-background/85 px-2 py-0.5 text-[11px] font-medium tracking-wide text-foreground shadow-sm">
          {label}
        </div>
      )}
      {/* Coordinates overlay */}
      <div className="absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-mono text-white/70">
        EPSG:32720
      </div>
    </div>
  );
}

export function NdviLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="font-mono">NDVI</span>
      <div className="ndvi-bar h-2 w-36 rounded-full" />
      <span className="font-mono text-[10px]">−1.0</span>
      <span className="ml-auto font-mono text-[10px]">+1.0</span>
    </div>
  );
}
