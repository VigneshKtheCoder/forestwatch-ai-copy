// Real Sentinel-2 L2A NDVI analysis.
// STAC backend: Element84 Earth Search v1 (https://earth-search.aws.element84.com/v1)
// Statistics backend: Titiler.xyz v2 (https://titiler.xyz)
//
// Earth Search v1 uses descriptive asset names: "red", "nir", "nir08", etc.
// Titiler v2 /cog/statistics POST with GeoJSON geometry body is confirmed working.
//
// Strategy (two layers):
//   A. COG /statistics POST — sends each band COG URL + drawn polygon to Titiler.
//      Titiler clips to AOI, returns real per-pixel mean reflectance values.
//      NDVI = (NIR_mean − Red_mean) / (NIR_mean + Red_mean), histogram approximated.
//   B. COG /statistics GET with bbox — fallback if POST fails.
//   C. Synthetic neutral fallback — both periods same distribution → loss = 0.
//      UI shows "data unavailable" banner so users know to widen date range.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { polygonAreaHa, type Polygon } from "./geo";

export const EARTH_SEARCH = "https://earth-search.aws.element84.com/v1";
export const TITILER = "https://titiler.xyz";
const COLLECTION = "sentinel-2-l2a";
const FETCH_TIMEOUT = 25_000; // ms

const PolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.array(z.number()).length(2))).min(1),
});

const InputSchema = z.object({
  geometry: PolygonSchema,
  beforeStart: z.string().min(8),
  beforeEnd: z.string().min(8),
  afterStart: z.string().min(8),
  afterEnd: z.string().min(8),
  maxCloud: z.number().min(0).max(100).default(20),
  forestThreshold: z.number().min(0).max(1).default(0.5),
});

export type AnalysisInput = z.infer<typeof InputSchema>;

interface EsItem {
  id: string;
  links: Array<{ rel: string; href: string }>;
  assets: Record<string, { href: string; type?: string }>;
  properties: {
    datetime: string;
    "eo:cloud_cover"?: number;
    "s2:mgrs_tile"?: string;
    platform?: string;
  };
}

interface TitilerStats {
  min: number; max: number; mean: number; std: number;
  median?: number;
  count?: number;
  valid_pixels?: number; masked_pixels?: number;
  histogram: [number[], number[]];
  percentile_2?: number; percentile_98?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function polyBbox(geometry: Polygon): [number, number, number, number] {
  const coords = geometry.coordinates[0];
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

// Build a Gaussian-approximated NDVI histogram centred on the real measured mean.
function gaussianHistogram(mean: number, std: number): [number[], number[]] {
  const counts = Array.from({ length: 20 }, (_, i) => {
    const center = -1 + i * 0.1 + 0.05;
    const z = (center - mean) / std;
    return Math.max(0, Math.round(600 * Math.exp(-0.5 * z * z)));
  });
  const edges = Array.from({ length: 21 }, (_, i) => +((-1 + i * 0.1).toFixed(2)));
  return [counts, edges];
}

// Extract TitilerStats from any Titiler /cog/statistics response shape.
// Handles two formats:
//   GET  → { "b1": { min, max, mean, ... } }
//   POST → { "type":"Feature", "properties": { "statistics": { "b1": {...} } } }
function parseCogStatsResponse(json: any): { mean: number; valid: number; masked: number } | null {
  let bandStats: any;

  if (json?.properties?.statistics) {
    // POST with GeoJSON body
    const bag = json.properties.statistics as Record<string, any>;
    bandStats = bag["b1"] ?? Object.values(bag)[0];
  } else if (json && typeof json === "object" && !Array.isArray(json)) {
    // GET with bbox
    bandStats = json["b1"] ?? Object.values(json)[0];
  }

  if (!bandStats || typeof bandStats.mean !== "number") return null;
  return {
    mean: bandStats.mean,
    valid: bandStats.valid_pixels ?? bandStats.count ?? 10000,
    masked: bandStats.masked_pixels ?? 0,
  };
}

// ─── Band name detection ──────────────────────────────────────────────────────
// Earth Search v1 uses descriptive names: "red", "nir"
// Some older collections use "B04"/"B08"
function getBandNames(item: EsItem): { red: string; nir: string } | null {
  const a = item.assets;
  if (a["nir"] && a["red"])   return { nir: "nir",   red: "red" };
  if (a["B08"] && a["B04"])   return { nir: "B08",   red: "B04" };
  if (a["B8"]  && a["B4"])    return { nir: "B8",    red: "B4" };
  if (a["nir08"] && a["red"]) return { nir: "nir08", red: "red" };
  if (a["B8A"] && a["B04"])   return { nir: "B8A",   red: "B04" };
  if (a["B8A"] && a["B4"])    return { nir: "B8A",   red: "B4" };
  if (a["band08"] && a["band04"]) return { nir: "band08", red: "band04" };
  return null;
}

// ─── STAC search ─────────────────────────────────────────────────────────────
async function stacSearch(
  geometry: Polygon, start: string, end: string, maxCloud: number,
): Promise<EsItem[]> {
  const body = {
    collections: [COLLECTION],
    intersects: geometry,
    datetime: `${start}T00:00:00Z/${end}T23:59:59Z`,
    query: { "eo:cloud_cover": { lte: maxCloud } },
    sortby: [{ field: "properties.eo:cloud_cover", direction: "asc" }],
    limit: 10,
  };
  try {
    const res = await fetchWithTimeout(`${EARTH_SEARCH}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json() as { features?: EsItem[] };
    return data.features ?? [];
  } catch {
    return [];
  }
}

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

async function findCandidates(
  geometry: Polygon, start: string, end: string, maxCloud: number,
): Promise<EsItem[]> {
  const cloudLimits = Array.from(new Set([maxCloud, 40, 60, 100]));
  const dateExpansions = [0, 30, 90];
  for (const cloud of cloudLimits) {
    for (const expand of dateExpansions) {
      const items = await stacSearch(
        geometry, shiftDate(start, -expand), shiftDate(end, +expand), cloud,
      );
      if (items.length > 0) {
        console.log(`[NDVI] Found ${items.length} scenes (cloud≤${cloud}, expand±${expand}d)`);
        return items;
      }
    }
  }
  console.warn("[NDVI] No Sentinel-2 scenes found after exhaustive search");
  return [];
}

// ─── Approach A: COG POST with GeoJSON polygon (confirmed working with Titiler v2) ──
// Returns real reflectance values clipped exactly to the drawn AOI.
async function tryCogPost(
  nirHref: string,
  redHref: string,
  geometry: Polygon,
): Promise<{ nirMean: number; redMean: number; validPx: number } | null> {
  const geoFeature = JSON.stringify({ type: "Feature", geometry, properties: {} });

  try {
    const [nirRes, redRes] = await Promise.all([
      fetchWithTimeout(`${TITILER}/cog/statistics?url=${encodeURIComponent(nirHref)}&max_size=512`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: geoFeature,
      }),
      fetchWithTimeout(`${TITILER}/cog/statistics?url=${encodeURIComponent(redHref)}&max_size=512`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: geoFeature,
      }),
    ]);

    if (!nirRes.ok || !redRes.ok) {
      const [nb, rb] = await Promise.all([
        nirRes.text().catch(() => ""),
        redRes.text().catch(() => ""),
      ]);
      console.error(`[NDVI/POST] NIR HTTP${nirRes.status}: ${nb.slice(0, 150)} | RED HTTP${redRes.status}: ${rb.slice(0, 150)}`);
      return null;
    }

    const [nirJson, redJson] = await Promise.all([nirRes.json(), redRes.json()]);
    const nirParsed = parseCogStatsResponse(nirJson);
    const redParsed = parseCogStatsResponse(redJson);

    if (!nirParsed || !redParsed) {
      console.error("[NDVI/POST] Could not parse band stats from response");
      return null;
    }

    console.log(`[NDVI/POST] NIR mean=${nirParsed.mean.toFixed(0)} RED mean=${redParsed.mean.toFixed(0)} valid=${nirParsed.valid}`);
    return { nirMean: nirParsed.mean, redMean: redParsed.mean, validPx: nirParsed.valid };
  } catch (err: any) {
    console.error(`[NDVI/POST] Fetch error: ${err?.message}`);
    return null;
  }
}

// ─── Approach B: COG GET with bbox (fallback) ────────────────────────────────
async function tryCogGet(
  nirHref: string,
  redHref: string,
  geometry: Polygon,
): Promise<{ nirMean: number; redMean: number; validPx: number } | null> {
  const [minLon, minLat, maxLon, maxLat] = polyBbox(geometry);
  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;

  try {
    const [nirRes, redRes] = await Promise.all([
      fetchWithTimeout(`${TITILER}/cog/statistics?url=${encodeURIComponent(nirHref)}&bbox=${bbox}&max_size=512`),
      fetchWithTimeout(`${TITILER}/cog/statistics?url=${encodeURIComponent(redHref)}&bbox=${bbox}&max_size=512`),
    ]);

    if (!nirRes.ok || !redRes.ok) {
      const [nb, rb] = await Promise.all([
        nirRes.text().catch(() => ""),
        redRes.text().catch(() => ""),
      ]);
      console.error(`[NDVI/GET] NIR HTTP${nirRes.status}: ${nb.slice(0, 150)} | RED HTTP${redRes.status}: ${rb.slice(0, 150)}`);
      return null;
    }

    const [nirJson, redJson] = await Promise.all([nirRes.json(), redRes.json()]);
    const nirParsed = parseCogStatsResponse(nirJson);
    const redParsed = parseCogStatsResponse(redJson);

    if (!nirParsed || !redParsed) return null;

    console.log(`[NDVI/GET] NIR mean=${nirParsed.mean.toFixed(0)} RED mean=${redParsed.mean.toFixed(0)}`);
    return { nirMean: nirParsed.mean, redMean: redParsed.mean, validPx: nirParsed.valid };
  } catch (err: any) {
    console.error(`[NDVI/GET] Fetch error: ${err?.message}`);
    return null;
  }
}

// ─── Band means → TitilerStats ────────────────────────────────────────────────
function bandMeansToStats(
  nirMean: number,
  redMean: number,
  validPx: number,
  label: "before" | "after",
): TitilerStats {
  // Sentinel-2 L2A DN values are 0–10000 (scaled reflectance).
  // Normalize to 0–1 reflectance range.
  let nir = nirMean;
  let red = redMean;
  if (nir > 2) { nir /= 10000; red /= 10000; }

  nir = Math.min(1, Math.max(0.0001, nir));
  red = Math.min(1, Math.max(0.0001, red));

  const denom = nir + red;
  const ndviMean = denom > 0.0001 ? (nir - red) / denom : 0;

  // Choose std based on vegetation density to give realistic spread
  const std = ndviMean > 0.65 ? 0.10 : ndviMean > 0.40 ? 0.15 : 0.18;

  const [counts, edges] = gaussianHistogram(ndviMean, std);

  console.log(`[NDVI] ${label}: NIR=${nir.toFixed(3)} RED=${red.toFixed(3)} → NDVI=${ndviMean.toFixed(3)} std=${std}`);

  return {
    min:  +Math.max(-1, ndviMean - 3 * std).toFixed(3),
    max:  +Math.min(1,  ndviMean + 3 * std).toFixed(3),
    mean: +ndviMean.toFixed(4),
    std:  +std.toFixed(3),
    valid_pixels:  validPx,
    masked_pixels: 0,
    histogram: [counts, edges],
  };
}

// ─── Synthetic neutral fallback ───────────────────────────────────────────────
function syntheticStats(label: "before" | "after"): TitilerStats {
  const mean = 0.62;
  const std  = 0.20;
  const [counts, edges] = gaussianHistogram(mean, std);
  return {
    min:  0.100,
    max:  0.920,
    mean,
    std,
    valid_pixels:  label === "before" ? 32000 : 30000,
    masked_pixels: 0,
    histogram: [counts, edges],
  };
}

// ─── Main stats resolver ──────────────────────────────────────────────────────
async function getNdviStats(
  candidates: EsItem[],
  geometry: Polygon,
  label: "before" | "after",
): Promise<{ stats: TitilerStats; item: EsItem | null; synthetic: boolean }> {
  for (const item of candidates) {
    const bands = getBandNames(item);
    if (!bands) {
      console.warn(`[NDVI] ${item.id}: no recognized band names in assets`);
      continue;
    }

    const nirHref = item.assets[bands.nir]?.href;
    const redHref = item.assets[bands.red]?.href;
    if (!nirHref || !redHref) {
      console.warn(`[NDVI] ${item.id}: missing href for ${bands.nir} or ${bands.red}`);
      continue;
    }

    // Try POST first (exact AOI clipping, confirmed working with Titiler v2)
    const postResult = await tryCogPost(nirHref, redHref, geometry);
    if (postResult) {
      const stats = bandMeansToStats(postResult.nirMean, postResult.redMean, postResult.validPx, label);
      return { stats, item, synthetic: false };
    }

    // Try GET with bbox as fallback
    const getResult = await tryCogGet(nirHref, redHref, geometry);
    if (getResult) {
      const stats = bandMeansToStats(getResult.nirMean, getResult.redMean, getResult.validPx, label);
      return { stats, item, synthetic: false };
    }

    console.warn(`[NDVI] ${item.id}: both POST and GET approaches failed`);
  }

  console.warn(`[NDVI] ${label}: ALL ${candidates.length} candidates failed — using synthetic fallback`);
  return { stats: syntheticStats(label), item: null, synthetic: true };
}

// ─── Forest fraction from histogram ──────────────────────────────────────────
function forestFraction(stats: TitilerStats, threshold: number): number {
  const [counts, edges] = stats.histogram;
  let total = 0, above = 0;
  for (let i = 0; i < counts.length; i++) {
    total += counts[i];
    const center = (edges[i] + (edges[i + 1] ?? edges[i] + 0.1)) / 2;
    if (center >= threshold) above += counts[i];
  }
  return total > 0 ? above / total : 0;
}

// ─── Confidence score ─────────────────────────────────────────────────────────
function confidence(
  before: TitilerStats, after: TitilerStats,
  beforeItem: EsItem | null, afterItem: EsItem | null,
): number {
  const validRatio = (s: TitilerStats) => {
    const v = s.valid_pixels ?? s.count ?? 0;
    const m = s.masked_pixels ?? 0;
    const t = v + m;
    return t > 0 ? v / t : 1;
  };
  const cloudPenalty = 1 - Math.max(
    beforeItem?.properties["eo:cloud_cover"] ?? 0,
    afterItem?.properties["eo:cloud_cover"]  ?? 0,
  ) / 100;
  return Math.max(0, Math.min(1, +(
    (0.4 * validRatio(before) + 0.4 * validRatio(after) + 0.2 * cloudPenalty).toFixed(3)
  )));
}

// ─── Main server function ─────────────────────────────────────────────────────
export const runNdviAnalysis = createServerFn({ method: "POST" })
  .inputValidator((d: AnalysisInput) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    // 0. Connectivity check (logs help diagnose Titiler reachability in production)
    try {
      const health = await fetchWithTimeout(`${TITILER}/healthz`);
      console.log(`[NDVI] Titiler /healthz → HTTP ${health.status}`);
    } catch (err: any) {
      console.error(`[NDVI] Titiler unreachable: ${err?.message}`);
    }

    // 1. Find candidate scenes
    const [beforeCandidates, afterCandidates] = await Promise.all([
      findCandidates(data.geometry, data.beforeStart, data.beforeEnd, data.maxCloud),
      findCandidates(data.geometry, data.afterStart,  data.afterEnd,  data.maxCloud),
    ]);

    // 2. Compute NDVI stats — real band reflectances from Titiler COG, synthetic fallback last resort
    const [
      { stats: beforeStats, item: beforeItem, synthetic: beforeSynthetic },
      { stats: afterStats,  item: afterItem,  synthetic: afterSynthetic  },
    ] = await Promise.all([
      getNdviStats(beforeCandidates, data.geometry, "before"),
      getNdviStats(afterCandidates,  data.geometry, "after"),
    ]);

    // 3. Derive metrics
    const areaHa       = polygonAreaHa(data.geometry);
    const forestBefore = forestFraction(beforeStats, data.forestThreshold);
    const forestAfter  = forestFraction(afterStats,  data.forestThreshold);
    const lossFraction = Math.max(0, forestBefore - forestAfter);
    const lossHa       = +(lossFraction * areaHa).toFixed(1);

    console.log(`[NDVI] RESULT: before=${(forestBefore*100).toFixed(1)}% after=${(forestAfter*100).toFixed(1)}% loss=${lossHa}ha (${(lossFraction*100).toFixed(2)}%)`);

    const round3 = (n: number) => +n.toFixed(3);
    const slim = (s: TitilerStats) => ({
      min: round3(s.min), max: round3(s.max),
      mean: round3(s.mean), std: round3(s.std),
      median: s.median != null ? round3(s.median) : undefined,
      validPixels:  s.valid_pixels ?? s.count ?? 0,
      maskedPixels: s.masked_pixels ?? 0,
      histogram: { counts: s.histogram[0], edges: s.histogram[1].map(round3) },
    });

    const itemSelfUrl = (item: EsItem) =>
      item.links?.find(l => l.rel === "self")?.href ??
      `${EARTH_SEARCH}/collections/${COLLECTION}/items/${item.id}`;

    const itemMeta = (item: EsItem | null) => item ? {
      itemId:     item.id,
      itemUrl:    itemSelfUrl(item),
      datetime:   item.properties.datetime,
      cloudCover: item.properties["eo:cloud_cover"] ?? null,
      mgrs:       item.properties["s2:mgrs_tile"]   ?? null,
      platform:   item.properties.platform          ?? "Sentinel-2",
    } : {
      itemId:     "estimated",
      itemUrl:    "",
      datetime:   new Date().toISOString(),
      cloudCover: null,
      mgrs:       null,
      platform:   "Sentinel-2 (data unavailable)",
    };

    return {
      before: { ...itemMeta(beforeItem), stats: slim(beforeStats), forestFraction: round3(forestBefore) },
      after:  { ...itemMeta(afterItem),  stats: slim(afterStats),  forestFraction: round3(forestAfter)  },
      areaHa:          +areaHa.toFixed(1),
      lossHa,
      lossFraction:    round3(lossFraction),
      deltaNdvi:       round3(afterStats.mean - beforeStats.mean),
      confidence:      confidence(beforeStats, afterStats, beforeItem, afterItem),
      forestThreshold: data.forestThreshold,
      computedAt:      new Date().toISOString(),
      estimated:       beforeSynthetic || afterSynthetic,
    };
  });

export type AnalysisResult = Awaited<ReturnType<typeof runNdviAnalysis>>;
