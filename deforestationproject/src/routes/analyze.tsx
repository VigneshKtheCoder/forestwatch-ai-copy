import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { FileText, Image as ImageIcon, Table, Play, Loader2, AlertTriangle, Satellite, ExternalLink } from "lucide-react";

import { SiteHeader, SiteFooter } from "@/components/site-header";
import { AnalysisMap, type LayerKey } from "@/components/analysis-map";
import {
  regions, ndviPreviewPngUrl, trueColorPreviewPngUrl,
} from "@/lib/forest-data";
import { runNdviAnalysis, type AnalysisResult } from "@/lib/analysis.functions";
import { downloadText, toCsv, polygonAreaHa } from "@/lib/geo";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Run an Analysis · ForestWatch AI" },
      { name: "description", content: "Pick a region and two dates. We pull real Sentinel-2 L2A scenes from the Copernicus archive via Microsoft Planetary Computer and compute NDVI loss, in hectares, live." },
    ],
  }),
  component: Analyze,
});

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

function Analyze() {
  const [regionId, setRegionId] = useState(regions[0].id);
  const region = regions.find((r) => r.id === regionId)!;

  // Date windows (30-day windows give the cloud filter room to find a clean scene)
  const [beforeEnd, setBeforeEnd] = useState("2019-09-30");
  const [beforeStart, setBeforeStart] = useState("2019-08-01");
  const [afterEnd, setAfterEnd] = useState(today);
  const [afterStart, setAfterStart] = useState(daysAgo(60));

  const [maxCloud, setMaxCloud] = useState(20);
  const [forestThreshold, setForestThreshold] = useState(0.5);
  const [layer, setLayer] = useState<LayerKey>("tc-after");

  const aoiAreaHa = useMemo(() => polygonAreaHa(region.geometry), [region]);

  const runFn = useServerFn(runNdviAnalysis);
  const m = useMutation({
    mutationFn: (vars: Parameters<typeof runFn>[0]["data"]) => runFn({ data: vars }),
  });

  function run() {
    m.mutate({
      geometry: region.geometry,
      beforeStart, beforeEnd, afterStart, afterEnd,
      maxCloud, forestThreshold,
    });
  }

  const result = m.data;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-xs uppercase tracking-[0.18em] text-moss">New analysis · live data</p>
        <h1 className="mt-2 text-4xl">Detect change between two Sentinel-2 epochs</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Imagery comes from the ESA Copernicus Sentinel-2 Level-2A archive via Microsoft Planetary Computer's
          STAC + Titiler endpoints. Every number below is computed from the actual scene returned.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Controls */}
          <aside className="ring-soft space-y-5 rounded-xl border border-border bg-card p-5">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Region of interest</label>
              <select
                value={regionId}
                onChange={(e) => { setRegionId(e.target.value); m.reset(); }}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {regions.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.country}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {region.lat.toFixed(2)}°, {region.lng.toFixed(2)}° · AOI ≈ {Math.round(aoiAreaHa).toLocaleString()} ha
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Before window</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={beforeStart} onChange={(e) => setBeforeStart(e.target.value)} min="2018-01-01"
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                <input type="date" value={beforeEnd} onChange={(e) => setBeforeEnd(e.target.value)} min="2018-01-01"
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">After window</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={afterStart} onChange={(e) => setAfterStart(e.target.value)} min="2018-01-01" max={today}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
                <input type="date" value={afterEnd} onChange={(e) => setAfterEnd(e.target.value)} min="2018-01-01" max={today}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Max cloud cover</label>
                <span className="font-mono text-sm">{maxCloud}%</span>
              </div>
              <input type="range" min={5} max={80} step={5} value={maxCloud} onChange={(e) => setMaxCloud(+e.target.value)}
                className="mt-2 w-full accent-[--color-forest]" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Forest NDVI threshold</label>
                <span className="font-mono text-sm">{forestThreshold.toFixed(2)}</span>
              </div>
              <input type="range" min={0.2} max={0.8} step={0.05} value={forestThreshold} onChange={(e) => setForestThreshold(+e.target.value)}
                className="mt-2 w-full accent-[--color-forest]" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Pixels with NDVI ≥ this are counted as forested. Loss = fraction that drops below the threshold.
              </p>
            </div>

            <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Source</span><span>Sentinel-2 L2A</span></div>
              <div className="flex justify-between"><span>Bands</span><span>B04 (Red) · B08 (NIR)</span></div>
              <div className="flex justify-between"><span>Resolution</span><span>10 m / pixel</span></div>
              <div className="flex justify-between"><span>Backend</span><span>MS Planetary Computer</span></div>
            </div>

            <button
              onClick={run}
              disabled={m.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-forest-deep px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-forest disabled:opacity-60"
            >
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {m.isPending ? "Querying Sentinel-2…" : "Run analysis"}
            </button>

            {m.isError && (
              <div className="flex gap-2 rounded-md border border-alert/30 bg-alert/10 p-3 text-xs text-alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{(m.error as Error).message}</span>
              </div>
            )}
          </aside>

          {/* Results */}
          <section className="space-y-6">
            {/* Map + layer switch */}
            <div className="ring-soft overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Satellite className="h-3.5 w-3.5" /> Layer
                </div>
                <div className="flex flex-wrap gap-1">
                  {([
                    ["tc-before", "True color · before"],
                    ["tc-after",  "True color · after"],
                    ["ndvi-before","NDVI · before"],
                    ["ndvi-after", "NDVI · after"],
                  ] as [LayerKey, string][]).map(([k, label]) => (
                    <button
                      key={k}
                      disabled={
                        ((k === "tc-before" || k === "ndvi-before") && !result?.before.itemId) ||
                        ((k === "tc-after"  || k === "ndvi-after")  && !result?.after.itemId)
                      }
                      onClick={() => setLayer(k)}
                      className={`rounded-md border px-2.5 py-1 text-[11px] transition ${
                        layer === k
                          ? "border-forest-deep bg-forest-deep text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-moss disabled:opacity-40"
                      }`}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <AnalysisMap
                height={420}
                geometry={region.geometry}
                beforeItemId={result?.before.itemId}
                afterItemId={result?.after.itemId}
                layer={layer}
              />
              {result && (
                <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                  Before scene <span className="font-mono">{result.before.itemId}</span> ·
                  After scene <span className="font-mono">{result.after.itemId}</span>
                </div>
              )}
            </div>

            {!result && !m.isPending && (
              <div className="ring-soft rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Configure dates and press <span className="font-medium text-foreground">Run analysis</span>. The
                request contacts the Planetary Computer STAC API for the lowest-cloud Sentinel-2 L2A scene in each
                window, then computes the NDVI histogram over your AOI server-side.
              </div>
            )}

            {result && <ResultCards r={result} region={region} />}
            {result && <DownloadStrip r={result} regionName={region.name} />}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "alert" | "ok" }) {
  return (
    <div className="ring-soft rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 font-display text-3xl ${tone === "alert" ? "text-alert" : "text-forest-deep"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ResultCards({ r, region }: { r: AnalysisResult; region: { name: string } }) {
  const lossPct = r.areaHa > 0 ? ((r.lossHa / r.areaHa) * 100) : 0;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Detected forest loss"
          value={`${r.lossHa.toLocaleString()} ha`}
          sub={`${lossPct.toFixed(2)}% of AOI`}
          tone={r.lossHa > 0 ? "alert" : "ok"}
        />
        <MetricCard
          label="ΔNDVI (mean)"
          value={r.deltaNdvi > 0 ? `+${r.deltaNdvi.toFixed(3)}` : r.deltaNdvi.toFixed(3)}
          sub={`${r.before.stats.mean.toFixed(2)} → ${r.after.stats.mean.toFixed(2)}`}
          tone={r.deltaNdvi < 0 ? "alert" : "ok"}
        />
        <MetricCard
          label="AOI area"
          value={`${r.areaHa.toLocaleString()} ha`}
          sub={region.name}
        />
        <MetricCard
          label="Confidence"
          value={r.confidence.toFixed(2)}
          sub={`valid-pixel & cloud-weighted`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <EpochCard title="Before" e={r.before} />
        <EpochCard title="After"  e={r.after} />
      </div>

      <div className="ring-soft rounded-xl border border-border bg-card p-5">
        <div className="text-sm font-medium">NDVI histogram (after − before, per bin)</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Forest threshold marked at NDVI = {r.forestThreshold.toFixed(2)}. Bars left of the marker pulling positive
          (more pixels in the "after" scene) indicate vegetation loss within those NDVI bins.
        </p>
        <HistogramDiff r={r} />
      </div>
    </>
  );
}

function EpochCard({ title, e }: { title: string; e: AnalysisResult["before"] }) {
  return (
    <div className="ring-soft rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {e.cloudCover != null ? `${e.cloudCover.toFixed(1)}% cloud` : "cloud n/a"}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {new Date(e.datetime).toISOString().slice(0, 10)} · MGRS {e.mgrs ?? "—"}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Mean NDVI</dt><dd className="text-right font-mono">{e.stats.mean.toFixed(3)}</dd>
        <dt className="text-muted-foreground">Median NDVI</dt><dd className="text-right font-mono">{(e.stats.median ?? NaN).toString()}</dd>
        <dt className="text-muted-foreground">Std</dt><dd className="text-right font-mono">{e.stats.std.toFixed(3)}</dd>
        <dt className="text-muted-foreground">Min / Max</dt><dd className="text-right font-mono">{e.stats.min.toFixed(2)} / {e.stats.max.toFixed(2)}</dd>
        <dt className="text-muted-foreground">Forested fraction</dt><dd className="text-right font-mono">{(e.forestFraction * 100).toFixed(1)}%</dd>
        <dt className="text-muted-foreground">Valid pixels</dt><dd className="text-right font-mono">{e.stats.validPixels.toLocaleString()}</dd>
      </dl>
      <div className="mt-3 text-[11px] text-muted-foreground break-all">
        <span className="font-mono">{e.itemId}</span>
      </div>
    </div>
  );
}

function HistogramDiff({ r }: { r: AnalysisResult }) {
  const b = r.before.stats.histogram;
  const a = r.after.stats.histogram;
  // align by index — both requested with histogram_range -1,1 and 20 bins
  const n = Math.min(b.counts.length, a.counts.length);
  const totalB = b.counts.reduce((s, x) => s + x, 0) || 1;
  const totalA = a.counts.reduce((s, x) => s + x, 0) || 1;
  const diffs = Array.from({ length: n }, (_, i) => {
    const center = (b.edges[i] + b.edges[i + 1]) / 2;
    const dPct = (a.counts[i] / totalA - b.counts[i] / totalB) * 100;
    return { center, dPct };
  });
  const maxAbs = Math.max(0.01, ...diffs.map((d) => Math.abs(d.dPct)));
  return (
    <div className="mt-3 flex h-32 items-end gap-1">
      {diffs.map((d, i) => {
        const h = (Math.abs(d.dPct) / maxAbs) * 100;
        const positive = d.dPct >= 0; // more pixels in "after" at this NDVI
        const isForested = d.center >= r.forestThreshold;
        const color = positive
          ? (isForested ? "#2D6A4F" : "#b54a2a")
          : (isForested ? "#b54a2a" : "#2D6A4F");
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`NDVI ≈ ${d.center.toFixed(2)} · Δ ${d.dPct.toFixed(2)}%`}>
            <div
              style={{ height: `${h}%`, backgroundColor: color, opacity: 0.85 }}
              className="w-full rounded-sm"
            />
            {(i % 5 === 0) && <div className="mt-1 text-[9px] text-muted-foreground">{d.center.toFixed(1)}</div>}
          </div>
        );
      })}
    </div>
  );
}

function DownloadStrip({ r, regionName }: { r: AnalysisResult; regionName: string }) {
  function exportCsv() {
    const meta = [
      { metric: "region", value: regionName },
      { metric: "before_item", value: r.before.itemId },
      { metric: "before_datetime", value: r.before.datetime },
      { metric: "before_cloud_cover", value: r.before.cloudCover ?? "" },
      { metric: "before_mean_ndvi", value: r.before.stats.mean },
      { metric: "before_forest_fraction", value: r.before.forestFraction },
      { metric: "after_item", value: r.after.itemId },
      { metric: "after_datetime", value: r.after.datetime },
      { metric: "after_cloud_cover", value: r.after.cloudCover ?? "" },
      { metric: "after_mean_ndvi", value: r.after.stats.mean },
      { metric: "after_forest_fraction", value: r.after.forestFraction },
      { metric: "delta_ndvi", value: r.deltaNdvi },
      { metric: "aoi_area_ha", value: r.areaHa },
      { metric: "loss_ha", value: r.lossHa },
      { metric: "loss_fraction", value: r.lossFraction },
      { metric: "confidence", value: r.confidence },
      { metric: "forest_threshold", value: r.forestThreshold },
      { metric: "computed_at", value: r.computedAt },
    ];
    const histRows = r.before.stats.histogram.counts.map((c, i) => ({
      bin_low: r.before.stats.histogram.edges[i],
      bin_high: r.before.stats.histogram.edges[i + 1],
      count_before: c,
      count_after: r.after.stats.histogram.counts[i] ?? 0,
    }));
    const csv = "# ForestWatch AI export — Sentinel-2 L2A via MS Planetary Computer\n"
      + toCsv(meta) + "\n\n" + toCsv(histRows);
    downloadText(`forestwatch-${regionName.replace(/\s+/g, "_")}-${r.computedAt.slice(0,10)}.csv`, csv, "text/csv");
  }

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <button onClick={exportCsv}
        className="ring-soft flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm transition hover:border-moss">
        <span className="flex items-center gap-3"><Table className="h-4 w-4 text-moss" /> Download CSV</span>
        <span className="text-xs text-muted-foreground">↓</span>
      </button>
      <a href={ndviPreviewPngUrl(r.before.itemId)} target="_blank" rel="noreferrer" download={`ndvi-before-${r.before.itemId}.png`}
        className="ring-soft flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm transition hover:border-moss">
        <span className="flex items-center gap-3"><ImageIcon className="h-4 w-4 text-moss" /> NDVI PNG · before</span>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
      </a>
      <a href={ndviPreviewPngUrl(r.after.itemId)} target="_blank" rel="noreferrer" download={`ndvi-after-${r.after.itemId}.png`}
        className="ring-soft flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm transition hover:border-moss">
        <span className="flex items-center gap-3"><ImageIcon className="h-4 w-4 text-moss" /> NDVI PNG · after</span>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
      </a>
      <a href={trueColorPreviewPngUrl(r.after.itemId)} target="_blank" rel="noreferrer" download={`truecolor-after-${r.after.itemId}.png`}
        className="ring-soft flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-sm transition hover:border-moss">
        <span className="flex items-center gap-3"><FileText className="h-4 w-4 text-moss" /> True-color PNG</span>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
      </a>
    </div>
  );
}
