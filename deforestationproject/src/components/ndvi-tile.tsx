// Procedural NDVI heatmap "tile" rendered to SVG. Mimics the kind of
// raster overlay a real Sentinel-2 + GEE pipeline would return.

import { useMemo } from "react";
import { ndviColor } from "@/lib/forest-data";

interface Props {
  seed?: number;
  decline?: number; // 0..1, higher = more deforestation
  size?: number;
  cells?: number;
  label?: string;
}

export function NdviTile({ seed = 1, decline = 0, size = 280, cells = 28, label }: Props) {
  const grid = useMemo(() => {
    const g: number[][] = [];
    for (let y = 0; y < cells; y++) {
      const row: number[] = [];
      for (let x = 0; x < cells; x++) {
        const n =
          Math.sin((x + seed) * 0.45) * 0.5 +
          Math.cos((y + seed * 1.3) * 0.4) * 0.5 +
          Math.sin((x * 0.2 + y * 0.3 + seed) * 1.7) * 0.3;
        let v = 0.55 + n * 0.18;
        // Carve a "deforestation patch" that grows with decline
        const cx = cells * 0.55, cy = cells * 0.45;
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const patch = Math.max(0, 1 - d / (cells * 0.35));
        v -= patch * decline * 0.6;
        // small clearcut lines
        if (decline > 0.3 && (y % 6 === 0) && x > cells * 0.4 && x < cells * 0.85) v -= 0.25 * decline;
        row.push(Math.max(0.05, Math.min(0.95, v)));
      }
      g.push(row);
    }
    return g;
  }, [seed, decline, cells]);

  const s = size / cells;
  return (
    <div className="relative">
      <svg width={size} height={size} className="ring-soft block rounded-lg border border-border bg-card">
        {grid.map((row, y) =>
          row.map((v, x) => (
            <rect key={`${x}-${y}`} x={x * s} y={y * s} width={s + 0.5} height={s + 0.5} fill={ndviColor(v)} />
          ))
        )}
      </svg>
      {label && (
        <div className="absolute left-2 top-2 rounded-md bg-background/85 px-2 py-0.5 text-[11px] font-medium tracking-wide text-foreground shadow-sm">
          {label}
        </div>
      )}
    </div>
  );
}

export function NdviLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span>NDVI</span>
      <div className="ndvi-bar h-2 w-40 rounded-full" />
      <span>−0.2</span>
      <span className="ml-auto">+0.9</span>
    </div>
  );
}
