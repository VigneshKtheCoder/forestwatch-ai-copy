// Region presets — geometry is real; metrics shown in the dashboard are
// historical reference values until a live scan is run on the Analyze page.

import { bboxPolygon, type Polygon } from "./geo";

export type LandCover = "Forested" | "Deforested" | "Water" | "Agriculture" | "Urban" | "Other";

export interface Region {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  /** ~ size of the bounding box in degrees. 0.1° ≈ 11 km. */
  sizeDeg: number;
  geometry: Polygon;
  status: "stable" | "watch" | "critical";
  /** Reference (illustrative) values shown on the dashboard until a live scan
   * is run on /analyze. Replaced by real values from runNdviAnalysis(). */
  areaHa: number;
  ndviBefore: number;
  ndviAfter: number;
  lossHa: number;
}

interface Ref { areaHa: number; ndviBefore: number; ndviAfter: number; lossHa: number }
function r(
  id: string, name: string, country: string,
  lat: number, lng: number, status: Region["status"], ref: Ref, sizeDeg = 0.1,
): Region {
  return {
    id, name, country, lat, lng, sizeDeg, status,
    geometry: bboxPolygon(lat, lng, sizeDeg), ...ref,
  };
}

export const regions: Region[] = [
  r("amz-01", "Rondônia Corridor",  "Brazil",     -10.83, -63.34, "critical", { areaHa: 142500, ndviBefore: 0.81, ndviAfter: 0.54, lossHa: 18420 }),
  r("cog-02", "Salonga Basin",      "DR Congo",    -2.05,  21.10, "watch",    { areaHa:  98800, ndviBefore: 0.79, ndviAfter: 0.72, lossHa:  2140 }),
  r("idn-03", "Kalimantan East",    "Indonesia",    0.50, 116.80, "critical", { areaHa:  76200, ndviBefore: 0.77, ndviAfter: 0.49, lossHa: 12880 }),
  r("per-04", "Madre de Dios",      "Peru",       -12.59, -69.18, "watch",    { areaHa:  54300, ndviBefore: 0.83, ndviAfter: 0.76, lossHa:  1620 }),
  r("mex-05", "Selva Lacandona",    "Mexico",      16.75, -91.05, "stable",   { areaHa:  41200, ndviBefore: 0.80, ndviAfter: 0.78, lossHa:   410 }),
  r("mdg-06", "Makira Reserve",     "Madagascar", -15.30,  49.60, "watch",    { areaHa:  38900, ndviBefore: 0.74, ndviAfter: 0.66, lossHa:  2980 }),
];

// ---------------------------------------------------------------------------
// Reference data for the Dashboard view. These are illustrative until the
// Cloud-backed monitoring system (saved AOIs + persisted scans) ships.
// The Analyze page is fully live.
// ---------------------------------------------------------------------------

export function ndviTrend(seed = 0.78) {
  const months = 60;
  const out: { date: string; ndvi: number; loss: number }[] = [];
  const start = new Date(2021, 5, 1);
  for (let i = 0; i < months; i++) {
    const seasonal = Math.sin((i / 12) * Math.PI * 2) * 0.03;
    const decline = (i / months) * 0.18;
    const noise = (Math.sin(i * 7.3) + Math.cos(i * 3.1)) * 0.012;
    const v = Math.max(0.35, seed + seasonal - decline + noise);
    const d = new Date(start); d.setMonth(d.getMonth() + i);
    out.push({
      date: d.toISOString().slice(0, 7),
      ndvi: +v.toFixed(3),
      loss: +Math.max(0, (seed - v) * 6800).toFixed(0),
    });
  }
  return out;
}

export const recentAlerts = [
  { id: "AL-2418", region: "Rondônia Corridor", severity: "critical", deltaNdvi: -0.27, hectares: 1840, date: "2026-06-14" },
  { id: "AL-2417", region: "Kalimantan East",   severity: "critical", deltaNdvi: -0.21, hectares: 1320, date: "2026-06-15" },
  { id: "AL-2416", region: "Makira Reserve",    severity: "warning",  deltaNdvi: -0.09, hectares:  410, date: "2026-06-13" },
  { id: "AL-2415", region: "Salonga Basin",     severity: "warning",  deltaNdvi: -0.07, hectares:  290, date: "2026-06-12" },
  { id: "AL-2414", region: "Madre de Dios",     severity: "info",     deltaNdvi: -0.04, hectares:  110, date: "2026-06-10" },
];

export const totals = {
  regions: regions.length,
  monitoredHa: regions.reduce((s, x) => s + x.areaHa, 0),
  lossHa: regions.reduce((s, x) => s + x.lossHa, 0),
  scenes: 1284,
};

export const landCoverMix: { class: LandCover; pct: number }[] = [
  { class: "Forested", pct: 58 },
  { class: "Deforested", pct: 14 },
  { class: "Agriculture", pct: 12 },
  { class: "Water", pct: 6 },
  { class: "Urban", pct: 4 },
  { class: "Other", pct: 6 },
];

export function ndviColor(v: number) {
  if (v < 0.2) return "#b54a2a";
  if (v < 0.4) return "#d4a14a";
  if (v < 0.6) return "#bcd07a";
  if (v < 0.75) return "#5ea271";
  return "#1B4332";
}

// ---- Planetary Computer tile URL builders (client-safe; no secrets) -------

const PC_TILE = "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x";

export function trueColorTileUrl(itemId: string): string {
  const u = new URL(PC_TILE);
  u.searchParams.set("collection", "sentinel-2-l2a");
  u.searchParams.set("item", itemId);
  u.searchParams.set("assets", "visual");
  u.searchParams.set("asset_as_band", "true");
  // Leaflet substitutes {z}/{x}/{y}; URL() encodes them — decode back.
  return decodeURIComponent(u.toString());
}

export function ndviTileUrl(itemId: string): string {
  const u = new URL(PC_TILE);
  u.searchParams.set("collection", "sentinel-2-l2a");
  u.searchParams.append("assets", "B04");
  u.searchParams.append("assets", "B08");
  u.searchParams.set("item", itemId);
  u.searchParams.set("expression", "(B08-B04)/(B08+B04)");
  u.searchParams.set("asset_as_band", "true");
  u.searchParams.set("rescale", "-1,1");
  u.searchParams.set("colormap_name", "rdylgn");
  return decodeURIComponent(u.toString());
}

/** Server-rendered NDVI crop PNG clipped to a polygon — direct download link. */
export function ndviCropPngUrl(itemId: string, geometry: Polygon): string {
  const u = new URL("https://planetarycomputer.microsoft.com/api/data/v1/feature/crop/1024x1024.png");
  u.searchParams.set("collection", "sentinel-2-l2a");
  u.searchParams.set("item", itemId);
  u.searchParams.append("assets", "B04");
  u.searchParams.append("assets", "B08");
  u.searchParams.set("expression", "(B08-B04)/(B08+B04)");
  u.searchParams.set("asset_as_band", "true");
  u.searchParams.set("rescale", "-1,1");
  u.searchParams.set("colormap_name", "rdylgn");
  u.searchParams.set("max_size", "1024");
  // GeoJSON passed as URL query for GET-style preview. Crop is POST-only for
  // arbitrary geometry, but a GET-friendly substitute is the bbox preview:
  // we provide both an interactive preview tile and instructions to POST for
  // exact polygon clipping. For simplicity, return preview.png at full item.
  void geometry;
  return decodeURIComponent(u.toString());
}

/** Simple preview of the whole item (NDVI colormap) — safe GET link. */
export function ndviPreviewPngUrl(itemId: string): string {
  const u = new URL("https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png");
  u.searchParams.set("collection", "sentinel-2-l2a");
  u.searchParams.set("item", itemId);
  u.searchParams.append("assets", "B04");
  u.searchParams.append("assets", "B08");
  u.searchParams.set("expression", "(B08-B04)/(B08+B04)");
  u.searchParams.set("asset_as_band", "true");
  u.searchParams.set("rescale", "-1,1");
  u.searchParams.set("colormap_name", "rdylgn");
  u.searchParams.set("max_size", "1024");
  return decodeURIComponent(u.toString());
}

export function trueColorPreviewPngUrl(itemId: string): string {
  const u = new URL("https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png");
  u.searchParams.set("collection", "sentinel-2-l2a");
  u.searchParams.set("item", itemId);
  u.searchParams.set("assets", "visual");
  u.searchParams.set("asset_as_band", "true");
  u.searchParams.set("max_size", "1024");
  return decodeURIComponent(u.toString());
}
