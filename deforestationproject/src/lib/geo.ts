// Pure-JS geo helpers — no external deps.

export type Polygon = {
  type: "Polygon";
  coordinates: number[][][]; // [ring][vertex][lng,lat]
};

/** Spherical polygon area in m² (signed; we take abs). Ring is [lng,lat][]. */
function ringAreaM2(ring: number[][]): number {
  const R = 6378137;
  const rad = Math.PI / 180;
  let area = 0;
  const n = ring.length;
  if (n < 3) return 0;
  for (let i = 0; i < n; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % n];
    area +=
      (lon2 - lon1) * rad *
      (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((area * R * R) / 2);
}

export function polygonAreaHa(poly: Polygon): number {
  if (!poly?.coordinates?.length) return 0;
  const outer = ringAreaM2(poly.coordinates[0]);
  const holes = poly.coordinates.slice(1).reduce((s, r) => s + ringAreaM2(r), 0);
  return Math.max(0, (outer - holes) / 10_000);
}

/** Build a small rectangular polygon (deg) around a centroid. sizeDeg ~ 0.1 ≈ 11km. */
export function bboxPolygon(lat: number, lng: number, sizeDeg = 0.1): Polygon {
  const h = sizeDeg / 2;
  return {
    type: "Polygon",
    coordinates: [[
      [lng - h, lat - h],
      [lng + h, lat - h],
      [lng + h, lat + h],
      [lng - h, lat + h],
      [lng - h, lat - h],
    ]],
  };
}

export function polygonBounds(poly: Polygon): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const r of poly.coordinates) {
    for (const [lng, lat] of r) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [[minLat, minLng], [maxLat, maxLng]];
}

/** Download arbitrary text content as a file (client-only). */
export function downloadText(filename: string, content: string, mime = "text/plain") {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}
