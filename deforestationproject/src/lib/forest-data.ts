import { bboxPolygon, type Polygon } from "./geo";

export type LandCover = "Forested" | "Deforested" | "Water" | "Agriculture" | "Urban" | "Other";
export type EcosystemType = "Tropical Rainforest" | "Tropical Dry Forest" | "Cloud Forest" | "Mangrove" | "Savanna-Forest Mosaic";

export interface Region {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  sizeDeg: number;
  geometry: Polygon;
  status: "stable" | "watch" | "critical";
  ecosystem: EcosystemType;
  areaHa: number;
  ndviBefore: number;
  ndviAfter: number;
  lossHa: number;
}

interface Ref {
  areaHa: number; ndviBefore: number; ndviAfter: number; lossHa: number;
  ecosystem: EcosystemType;
}

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
  r("amz-01", "Rondônia Corridor",      "Brazil",      -10.83,  -63.34, "critical", { areaHa: 142500, ndviBefore: 0.81, ndviAfter: 0.54, lossHa: 18420, ecosystem: "Tropical Rainforest" }),
  r("amz-09", "Eastern Mato Grosso",    "Brazil",      -12.50,  -52.00, "critical", { areaHa:  89500, ndviBefore: 0.79, ndviAfter: 0.52, lossHa: 14500, ecosystem: "Tropical Rainforest" }),
  r("idn-03", "Kalimantan East",         "Indonesia",     0.50,  116.80, "critical", { areaHa:  76200, ndviBefore: 0.77, ndviAfter: 0.49, lossHa: 12880, ecosystem: "Tropical Rainforest" }),
  r("pry-07", "Gran Chaco",              "Paraguay",    -21.00,  -60.50, "critical", { areaHa:  66800, ndviBefore: 0.68, ndviAfter: 0.48, lossHa:  9800, ecosystem: "Savanna-Forest Mosaic" }),
  r("idn-08", "Northern Sumatra",        "Indonesia",     3.20,   98.50, "critical", { areaHa:  48200, ndviBefore: 0.75, ndviAfter: 0.55, lossHa:  6200, ecosystem: "Tropical Rainforest" }),
  r("hnd-10", "Mesoamerican Forests",    "Honduras",     15.00,  -87.50, "watch",    { areaHa:  35100, ndviBefore: 0.77, ndviAfter: 0.70, lossHa:  3400, ecosystem: "Cloud Forest" }),
  r("mdg-06", "Makira Reserve",          "Madagascar",  -15.30,   49.60, "watch",    { areaHa:  38900, ndviBefore: 0.74, ndviAfter: 0.66, lossHa:  2980, ecosystem: "Tropical Rainforest" }),
  r("cog-02", "Salonga Basin",           "DR Congo",     -2.05,   21.10, "watch",    { areaHa:  98800, ndviBefore: 0.79, ndviAfter: 0.72, lossHa:  2140, ecosystem: "Tropical Rainforest" }),
  r("per-04", "Madre de Dios",           "Peru",        -12.59,  -69.18, "watch",    { areaHa:  54300, ndviBefore: 0.83, ndviAfter: 0.76, lossHa:  1620, ecosystem: "Tropical Rainforest" }),
  r("mex-05", "Selva Lacandona",         "Mexico",       16.75,  -91.05, "stable",   { areaHa:  41200, ndviBefore: 0.80, ndviAfter: 0.78, lossHa:   410, ecosystem: "Tropical Dry Forest" }),
];

export const regionsSortedByLoss = [...regions].sort((a, b) => b.lossHa - a.lossHa);

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
  { id: "AL-2418", regionId: "amz-01", region: "Rondônia Corridor",   severity: "critical", deltaNdvi: -0.27, hectares: 1840, date: "2026-06-14" },
  { id: "AL-2417", regionId: "idn-03", region: "Kalimantan East",      severity: "critical", deltaNdvi: -0.21, hectares: 1320, date: "2026-06-15" },
  { id: "AL-2419", regionId: "amz-09", region: "Eastern Mato Grosso",  severity: "critical", deltaNdvi: -0.19, hectares: 1140, date: "2026-06-16" },
  { id: "AL-2416", regionId: "mdg-06", region: "Makira Reserve",       severity: "warning",  deltaNdvi: -0.09, hectares:  410, date: "2026-06-13" },
  { id: "AL-2415", regionId: "cog-02", region: "Salonga Basin",        severity: "warning",  deltaNdvi: -0.07, hectares:  290, date: "2026-06-12" },
  { id: "AL-2420", regionId: "pry-07", region: "Gran Chaco",           severity: "warning",  deltaNdvi: -0.12, hectares:  780, date: "2026-06-11" },
  { id: "AL-2414", regionId: "per-04", region: "Madre de Dios",        severity: "info",     deltaNdvi: -0.04, hectares:  110, date: "2026-06-10" },
];

export const totals = {
  regions: regions.length,
  monitoredHa: regions.reduce((s, x) => s + x.areaHa, 0),
  lossHa: regions.reduce((s, x) => s + x.lossHa, 0),
  scenes: 1284,
};

export const landCoverMix: { class: LandCover; pct: number }[] = [
  { class: "Forested",    pct: 58 },
  { class: "Deforested",  pct: 14 },
  { class: "Agriculture", pct: 12 },
  { class: "Water",       pct:  6 },
  { class: "Urban",       pct:  4 },
  { class: "Other",       pct:  6 },
];

export function ndviColor(v: number) {
  if (v < 0.2) return "#b54a2a";
  if (v < 0.4) return "#d4a14a";
  if (v < 0.6) return "#bcd07a";
  if (v < 0.75) return "#5ea271";
  return "#1B4332";
}

// Tile & preview URL builders — Earth Search STAC + Titiler.xyz
// Earth Search Sentinel-2 L2A items live at:
//   https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/{id}
// Titiler.xyz is a public Titiler instance backed by the same sentinel-cogs S3 bucket.

const EARTH_SEARCH = "https://earth-search.aws.element84.com/v1";
const COLLECTION = "sentinel-2-l2a";
const TITILER = "https://titiler.xyz";
const TILE_PATH = `${TITILER}/stac/tiles/WebMercatorQuad/{z}/{x}/{y}@1x`;

function esItemUrl(itemId: string) {
  return `${EARTH_SEARCH}/collections/${COLLECTION}/items/${itemId}`;
}

export function trueColorTileUrl(itemId: string): string {
  const p = new URLSearchParams();
  p.set("url", esItemUrl(itemId));
  p.append("assets", "B04");
  p.append("assets", "B03");
  p.append("assets", "B02");
  p.set("asset_as_band", "true");
  p.set("rescale", "0,3000");
  return `${TILE_PATH}?${p.toString()}`;
}

export function ndviTileUrl(itemId: string): string {
  const p = new URLSearchParams();
  p.set("url", esItemUrl(itemId));
  p.append("assets", "B04");
  p.append("assets", "B08");
  p.set("expression", "(B08-B04)/(B08+B04)");
  p.set("asset_as_band", "true");
  p.set("rescale", "-1,1");
  p.set("colormap_name", "rdylgn");
  return `${TILE_PATH}?${p.toString()}`;
}

export function ndviPreviewPngUrl(itemId: string): string {
  const p = new URLSearchParams();
  p.set("url", esItemUrl(itemId));
  p.append("assets", "B04");
  p.append("assets", "B08");
  p.set("expression", "(B08-B04)/(B08+B04)");
  p.set("asset_as_band", "true");
  p.set("rescale", "-1,1");
  p.set("colormap_name", "rdylgn");
  p.set("max_size", "1024");
  return `${TITILER}/stac/preview.png?${p.toString()}`;
}

export function trueColorPreviewPngUrl(itemId: string): string {
  const p = new URLSearchParams();
  p.set("url", esItemUrl(itemId));
  p.append("assets", "B04");
  p.append("assets", "B03");
  p.append("assets", "B02");
  p.set("asset_as_band", "true");
  p.set("rescale", "0,3000");
  p.set("max_size", "1024");
  return `${TITILER}/stac/preview.png?${p.toString()}`;
}
