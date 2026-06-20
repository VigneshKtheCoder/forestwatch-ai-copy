// Real Sentinel-2 L2A NDVI analysis.
// STAC backend: Element84 Earth Search (https://earth-search.aws.element84.com/v1)
// Statistics backend: Titiler.xyz (https://titiler.xyz)
// Both services are public, reliable, and access the same sentinel-cogs S3 dataset.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { polygonAreaHa, type Polygon } from "./geo";

export const EARTH_SEARCH = "https://earth-search.aws.element84.com/v1";
export const TITILER = "https://titiler.xyz";
const COLLECTION = "sentinel-2-l2a";

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
  assets: Record<string, { href: string }>;
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

async function stacSearch(
  geometry: Polygon, start: string, end: string, maxCloud: number,
): Promise<EsItem> {
  const body = {
    collections: [COLLECTION],
    intersects: geometry,
    datetime: `${start}T00:00:00Z/${end}T23:59:59Z`,
    query: { "eo:cloud_cover": { lte: maxCloud } },
    sortby: [{ field: "properties.eo:cloud_cover", direction: "asc" }],
    limit: 5,
  };

  const res = await fetch(`${EARTH_SEARCH}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `STAC search failed (HTTP ${res.status}). ` +
      `Check your date range and area of interest. Detail: ${text.slice(0, 300)}`
    );
  }

  const data = await res.json() as { features?: EsItem[] };

  if (!data.features?.length) {
    throw new Error(
      `No Sentinel-2 scene found between ${start} and ${end} ` +
      `with cloud cover ≤ ${maxCloud}% over your AOI. ` +
      `Try widening the date window to 60–90 days, raising the cloud threshold, ` +
      `or drawing a larger area.`
    );
  }

  return data.features[0];
}

function itemSelfUrl(item: EsItem): string {
  return (
    item.links?.find((l) => l.rel === "self")?.href ??
    `${EARTH_SEARCH}/collections/${COLLECTION}/items/${item.id}`
  );
}

async function ndviStatistics(item: EsItem, geometry: Polygon): Promise<TitilerStats> {
  // Determine band asset names (Earth Search uses B04/B08 for sentinel-2-l2a)
  const hasB08 = "B08" in item.assets;
  const redBand = hasB08 ? "B04" : "red";
  const nirBand = hasB08 ? "B08" : "nir";
  const expr = `(${nirBand}-${redBand})/(${nirBand}+${redBand})`;

  const url = new URL(`${TITILER}/stac/statistics`);
  url.searchParams.set("url", itemSelfUrl(item));
  url.searchParams.append("assets", redBand);
  url.searchParams.append("assets", nirBand);
  url.searchParams.set("expression", expr);
  url.searchParams.set("asset_as_band", "true");
  url.searchParams.set("max_size", "512");
  url.searchParams.set("histogram_bins", "20");
  // histogram_range as two separate params (FastAPI list convention)
  url.searchParams.append("histogram_range", "-1");
  url.searchParams.append("histogram_range", "1");

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "Feature", geometry, properties: {} }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text.slice(0, 400);
    try {
      const j = JSON.parse(text);
      if (j?.detail) detail = JSON.stringify(j.detail).slice(0, 400);
    } catch { /* ignore */ }
    throw new Error(
      `NDVI statistics call failed (HTTP ${res.status}) for scene "${item.id}". ` +
      `This may mean the scene does not fully cover your AOI, or the scene has excessive cloud cover. ` +
      `Detail: ${detail}`
    );
  }

  const json = await res.json() as any;

  // Response shape: { "expression_key": { min, max, mean, std, histogram, ... } }
  // or nested under properties.statistics (older titiler versions)
  let bag: Record<string, TitilerStats>;
  if (json?.properties?.statistics) {
    bag = json.properties.statistics as Record<string, TitilerStats>;
  } else if (json && typeof json === "object" && !Array.isArray(json)) {
    bag = json as Record<string, TitilerStats>;
  } else {
    throw new Error(
      `Unexpected statistics response format from Titiler for scene "${item.id}".`
    );
  }

  const stats = Object.values(bag)[0];
  if (!stats || typeof stats.mean !== "number") {
    throw new Error(
      `Empty or invalid statistics for scene "${item.id}". ` +
      `The scene may be outside the AOI or heavily masked by clouds.`
    );
  }

  // Ensure histogram array is present
  if (!Array.isArray(stats.histogram) || stats.histogram.length < 2) {
    stats.histogram = [
      Array(20).fill(0),
      Array.from({ length: 21 }, (_, i) => +((-1 + i * 0.1).toFixed(2))),
    ];
  }

  return stats;
}

function forestFraction(stats: TitilerStats, threshold: number): number {
  const [counts, edges] = stats.histogram;
  let total = 0, above = 0;
  for (let i = 0; i < counts.length; i++) {
    total += counts[i];
    const center = (edges[i] + edges[i + 1]) / 2;
    if (center >= threshold) above += counts[i];
  }
  return total > 0 ? above / total : 0;
}

function confidence(
  before: TitilerStats, after: TitilerStats,
  beforeItem: EsItem, afterItem: EsItem,
): number {
  const validRatio = (s: TitilerStats) => {
    const v = s.valid_pixels ?? s.count ?? 0;
    const m = s.masked_pixels ?? 0;
    const total = v + m;
    return total > 0 ? v / total : 1;
  };
  const cloudPenalty = 1 - Math.max(
    beforeItem.properties["eo:cloud_cover"] ?? 0,
    afterItem.properties["eo:cloud_cover"] ?? 0,
  ) / 100;
  return Math.max(0, Math.min(1, +(
    (0.4 * validRatio(before) + 0.4 * validRatio(after) + 0.2 * cloudPenalty).toFixed(3)
  )));
}

export const runNdviAnalysis = createServerFn({ method: "POST" })
  .inputValidator((d: AnalysisInput) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const [beforeItem, afterItem] = await Promise.all([
      stacSearch(data.geometry, data.beforeStart, data.beforeEnd, data.maxCloud),
      stacSearch(data.geometry, data.afterStart, data.afterEnd, data.maxCloud),
    ]);
    const [beforeStats, afterStats] = await Promise.all([
      ndviStatistics(beforeItem, data.geometry),
      ndviStatistics(afterItem, data.geometry),
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
        itemUrl: itemSelfUrl(beforeItem),
        datetime: beforeItem.properties.datetime,
        cloudCover: beforeItem.properties["eo:cloud_cover"] ?? null,
        mgrs: beforeItem.properties["s2:mgrs_tile"] ?? null,
        platform: beforeItem.properties.platform ?? "Sentinel-2",
        stats: slim(beforeStats),
        forestFraction: round3(forestBefore),
      },
      after: {
        itemId: afterItem.id,
        itemUrl: itemSelfUrl(afterItem),
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
