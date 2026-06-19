// Real Sentinel-2 L2A NDVI analysis via Microsoft Planetary Computer.
// STAC search → lowest-cloud item per epoch → titiler-pc /statistics for histograms
// → hectare-loss estimated from histogram differencing.
//
// References:
//   STAC API:    https://planetarycomputer.microsoft.com/api/stac/v1
//   Data API:    https://planetarycomputer.microsoft.com/api/data/v1
//   Collection:  sentinel-2-l2a (https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a)

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { polygonAreaHa, type Polygon } from "./geo";

const STAC = "https://planetarycomputer.microsoft.com/api/stac/v1";
const DATA = "https://planetarycomputer.microsoft.com/api/data/v1";

const PolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.array(z.number()).length(2))).min(1),
});

const InputSchema = z.object({
  geometry: PolygonSchema,
  beforeStart: z.string().min(8), // YYYY-MM-DD
  beforeEnd: z.string().min(8),
  afterStart: z.string().min(8),
  afterEnd: z.string().min(8),
  maxCloud: z.number().min(0).max(100).default(20),
  forestThreshold: z.number().min(0).max(1).default(0.5),
});

export type AnalysisInput = z.infer<typeof InputSchema>;

interface StacItem {
  id: string;
  properties: {
    datetime: string;
    "eo:cloud_cover"?: number;
    "s2:mgrs_tile"?: string;
    platform?: string;
  };
}

interface TitilerStats {
  min: number; max: number; mean: number; std: number;
  median?: number; majority?: number;
  count?: number;
  valid_pixels?: number; masked_pixels?: number;
  histogram: [number[], number[]]; // [counts, edges]
  percentile_2?: number; percentile_98?: number;
}

async function stacSearch(
  geometry: Polygon,
  start: string,
  end: string,
  maxCloud: number,
): Promise<StacItem> {
  const body = {
    collections: ["sentinel-2-l2a"],
    intersects: geometry,
    datetime: `${start}T00:00:00Z/${end}T23:59:59Z`,
    query: { "eo:cloud_cover": { lt: maxCloud } },
    sortby: [{ field: "eo:cloud_cover", direction: "asc" }],
    limit: 5,
  };
  const res = await fetch(`${STAC}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`STAC search failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  const data = await res.json() as { features?: StacItem[] };
  if (!data.features?.length) {
    throw new Error(
      `No Sentinel-2 L2A scene found ${start}..${end} with cloud cover < ${maxCloud}% intersecting the AOI. Try a wider date window or a higher cloud threshold.`,
    );
  }
  return data.features[0];
}

async function ndviStatistics(itemId: string, geometry: Polygon): Promise<TitilerStats> {
  const url = new URL(`${DATA}/item/statistics`);
  url.searchParams.set("collection", "sentinel-2-l2a");
  url.searchParams.set("item", itemId);
  url.searchParams.append("assets", "B04");
  url.searchParams.append("assets", "B08");
  url.searchParams.set("expression", "(B08-B04)/(B08+B04)");
  url.searchParams.set("asset_as_band", "true");
  url.searchParams.set("max_size", "1024");
  url.searchParams.set("categorical", "false");
  url.searchParams.set("histogram_bins", "20");
  url.searchParams.set("histogram_range", "-1,1");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "Feature", geometry, properties: {} }),
  });
  if (!res.ok) {
    throw new Error(`Statistics call failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
  const json = await res.json() as any;
  // titiler-pc nests stats under properties.statistics; some deployments
  // return the bare {expression: stats} map. Handle both.
  const bag: Record<string, TitilerStats> =
    (json?.properties?.statistics as Record<string, TitilerStats> | undefined)
    ?? (json as Record<string, TitilerStats>);
  const stats = Object.values(bag)[0];
  if (!stats) throw new Error("Titiler returned no statistics body");
  return stats;
}

/** Fraction of valid pixels whose NDVI is >= threshold, from the histogram. */
function forestFraction(stats: TitilerStats, threshold: number): number {
  const [counts, edges] = stats.histogram;
  let total = 0, above = 0;
  for (let i = 0; i < counts.length; i++) {
    total += counts[i];
    // bin covers [edges[i], edges[i+1]); count as "forested" if bin center >= threshold
    const center = (edges[i] + edges[i + 1]) / 2;
    if (center >= threshold) above += counts[i];
  }
  return total > 0 ? above / total : 0;
}

/** 0–1 confidence: more valid pixels & lower cloud cover → higher confidence. */
function confidence(
  before: TitilerStats, after: TitilerStats,
  beforeItem: StacItem, afterItem: StacItem,
): number {
  const validRatio = (s: TitilerStats) => {
    const v = s.valid_pixels ?? s.count ?? 0;
    const m = s.masked_pixels ?? 0;
    const total = v + m;
    return total > 0 ? v / total : 1;
  };
  const cloudPenalty = 1 - Math.max(
    (beforeItem.properties["eo:cloud_cover"] ?? 0),
    (afterItem.properties["eo:cloud_cover"] ?? 0),
  ) / 100;
  const c = 0.4 * validRatio(before) + 0.4 * validRatio(after) + 0.2 * cloudPenalty;
  return Math.max(0, Math.min(1, +c.toFixed(3)));
}

export const runNdviAnalysis = createServerFn({ method: "POST" })
  .inputValidator((d: AnalysisInput) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const [beforeItem, afterItem] = await Promise.all([
      stacSearch(data.geometry, data.beforeStart, data.beforeEnd, data.maxCloud),
      stacSearch(data.geometry, data.afterStart, data.afterEnd, data.maxCloud),
    ]);
    const [beforeStats, afterStats] = await Promise.all([
      ndviStatistics(beforeItem.id, data.geometry),
      ndviStatistics(afterItem.id, data.geometry),
    ]);

    const areaHa = polygonAreaHa(data.geometry);
    const forestBefore = forestFraction(beforeStats, data.forestThreshold);
    const forestAfter = forestFraction(afterStats, data.forestThreshold);
    const lossFraction = Math.max(0, forestBefore - forestAfter);
    const lossHa = +(lossFraction * areaHa).toFixed(1);

    const round3 = (n: number) => +n.toFixed(3);
    const slim = (s: TitilerStats) => ({
      min: round3(s.min), max: round3(s.max),
      mean: round3(s.mean), std: round3(s.std),
      median: s.median != null ? round3(s.median) : undefined,
      validPixels: s.valid_pixels ?? s.count ?? 0,
      maskedPixels: s.masked_pixels ?? 0,
      histogram: { counts: s.histogram[0], edges: s.histogram[1].map(round3) },
    });

    return {
      before: {
        itemId: beforeItem.id,
        datetime: beforeItem.properties.datetime,
        cloudCover: beforeItem.properties["eo:cloud_cover"] ?? null,
        mgrs: beforeItem.properties["s2:mgrs_tile"] ?? null,
        platform: beforeItem.properties.platform ?? "Sentinel-2",
        stats: slim(beforeStats),
        forestFraction: round3(forestBefore),
      },
      after: {
        itemId: afterItem.id,
        datetime: afterItem.properties.datetime,
        cloudCover: afterItem.properties["eo:cloud_cover"] ?? null,
        mgrs: afterItem.properties["s2:mgrs_tile"] ?? null,
        platform: afterItem.properties.platform ?? "Sentinel-2",
        stats: slim(afterStats),
        forestFraction: round3(forestAfter),
      },
      areaHa: +areaHa.toFixed(1),
      lossHa,
      lossFraction: round3(lossFraction),
      deltaNdvi: round3(afterStats.mean - beforeStats.mean),
      confidence: confidence(beforeStats, afterStats, beforeItem, afterItem),
      forestThreshold: data.forestThreshold,
      computedAt: new Date().toISOString(),
    };
  });

export type AnalysisResult = Awaited<ReturnType<typeof runNdviAnalysis>>;
