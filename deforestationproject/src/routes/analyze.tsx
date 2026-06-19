import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  FileText, Image as ImageIcon, Table, Play, Loader2, AlertTriangle,
  Satellite, ExternalLink, Search, Upload, MapPin, ChevronDown, ChevronUp,
  CheckCircle2, X, Layers, BarChart3, Download, Info,
} from "lucide-react";

import { SiteHeader, SiteFooter } from "@/components/site-header";
import { DrawAnalysisMap } from "@/components/draw-analysis-map";
import { regions, ndviPreviewPngUrl, trueColorPreviewPngUrl } from "@/lib/forest-data";
import { runNdviAnalysis, type AnalysisResult } from "@/lib/analysis.functions";
import { downloadText, toCsv, polygonAreaHa, type Polygon } from "@/lib/geo";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Run an Analysis · ForestWatch AI" },
      { name: "description", content: "Draw your area of interest on the map, choose two date windows, and run a live Sentinel-2 NDVI forest-change analysis." },
    ],
  }),
  component: Analyze,
});

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

type AoiTab = "draw" | "upload" | "preset";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
}

type LayerKey = "tc-before" | "tc-after" | "ndvi-before" | "ndvi-after";

// ─── Main component ───────────────────────────────────────────────────────────

function Analyze() {
  // AOI state
  const [aoi, setAoi] = useState<Polygon | null>(null);
  const [aoiSource, setAoiSource] = useState<string>("");
  const [aoiTab, setAoiTab] = useState<AoiTab>("draw");
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Upload state
  const [uploadError, setUploadError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Date state
  const [beforeStart, setBeforeStart] = useState("2019-08-01");
  const [beforeEnd, setBeforeEnd] = useState("2019-09-30");
  const [afterStart, setAfterStart] = useState(daysAgo(60));
  const [afterEnd, setAfterEnd] = useState(today);

  // Settings
  const [maxCloud, setMaxCloud] = useState(20);
  const [forestThreshold, setForestThreshold] = useState(0.5);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Results / map layer
  const [layer, setLayer] = useState<LayerKey>("tc-after");

  const aoiAreaHa = useMemo(() => (aoi ? polygonAreaHa(aoi) : 0), [aoi]);

  // ── Server fn + mutation ────────────────────────────────────────────────────
  const runFn = useServerFn(runNdviAnalysis);
  const m = useMutation({
    mutationFn: (vars: Parameters<typeof runFn>[0]["data"]) => runFn({ data: vars }),
    onSuccess: () => setLayer("tc-after"),
  });

  const result = m.data;

  function run() {
    if (!aoi) return;
    m.mutate({ geometry: aoi, beforeStart, beforeEnd, afterStart, afterEnd, maxCloud, forestThreshold });
  }

  // ── Location search (Nominatim) ─────────────────────────────────────────────
  function handleSearchInput(q: string) {
    setSearchQuery(q);
    setSearchOpen(true);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 400);
  }

  function selectSearchResult(r: NominatimResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setFlyTarget({ lat, lng, zoom: 10 });
    setSearchQuery(r.display_name.split(",").slice(0, 2).join(","));
    setSearchResults([]);
    setSearchOpen(false);
  }

  // ── GeoJSON upload ──────────────────────────────────────────────────────────
  function handleFileUpload(file: File) {
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const json = JSON.parse(raw);
        const poly = extractPolygonFromGeoJSON(json);
        if (!poly) throw new Error("No Polygon or MultiPolygon geometry found in file.");
        setAoi(poly);
        setAoiSource(file.name);
        const bounds = getPolyBounds(poly);
        setFlyTarget({ lat: bounds.lat, lng: bounds.lng, zoom: 9 });
        m.reset();
      } catch (err: any) {
        setUploadError(err.message ?? "Could not parse file.");
      }
    };
    reader.readAsText(file);
  }

  // ── Preset region select ────────────────────────────────────────────────────
  function selectPreset(id: string) {
    const region = regions.find((r) => r.id === id);
    if (!region) return;
    setAoi(region.geometry);
    setAoiSource(region.name);
    setFlyTarget({ lat: region.lat, lng: region.lng, zoom: 9 });
    m.reset();
  }

  // ── Geometry change from drawing ────────────────────────────────────────────
  const handleGeometryChange = useCallback((poly: Polygon | null) => {
    setAoi(poly);
    setAoiSource(poly ? "Custom drawn polygon" : "");
    m.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Date quick-select ───────────────────────────────────────────────────────
  function setDatePreset(preset: "1yr" | "3yr" | "5yr") {
    const yearsAgo = preset === "1yr" ? 1 : preset === "3yr" ? 3 : 5;
    const refYear = new Date().getFullYear() - yearsAgo;
    setBeforeStart(`${refYear}-07-01`);
    setBeforeEnd(`${refYear}-09-30`);
    setAfterStart(daysAgo(60));
    setAfterEnd(today);
  }

  // ── Derived overlay params ──────────────────────────────────────────────────
  const overlayItemId =
    (layer === "tc-before" || layer === "ndvi-before") ? result?.before.itemId :
    (layer === "tc-after"  || layer === "ndvi-after")  ? result?.after.itemId  : undefined;
  const overlayType = (layer === "tc-before" || layer === "tc-after") ? "tc" : "ndvi";

  // ── Validation ──────────────────────────────────────────────────────────────
  const canRun = !!aoi && !!beforeStart && !!beforeEnd && !!afterStart && !!afterEnd;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
        {/* Page header */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-moss">Sentinel-2 L2A · Live Analysis</p>
          <h1 className="mt-1 text-3xl">Forest Change Analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Draw your area of interest, pick two date windows, and run a live NDVI change analysis powered by
            Microsoft Planetary Computer.
          </p>
        </div>

        {/* ── Main two-column layout ── */}
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          {/* ── Left panel: Controls ── */}
          <aside className="flex flex-col gap-4">

            {/* ── Step 1: AOI ── */}
            <div className="ring-soft rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <StepBadge n={1} done={!!aoi} />
                  <span className="text-sm font-medium">Area of Interest</span>
                </div>
                {aoi && (
                  <span className="text-xs text-moss font-mono">
                    {Math.round(aoiAreaHa).toLocaleString()} ha
                  </span>
                )}
              </div>

              <div className="p-4 space-y-4">
                {/* Search */}
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search any location…"
                      value={searchQuery}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      onFocus={() => setSearchOpen(true)}
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                    {isSearching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    {searchQuery && !isSearching && (
                      <button onClick={() => { setSearchQuery(""); setSearchResults([]); setSearchOpen(false); }}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                  {searchOpen && searchResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                      {searchResults.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => selectSearchResult(r)}
                          className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/60 first:rounded-t-md last:rounded-b-md"
                        >
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" />
                          <span className="line-clamp-2 text-xs">{r.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* AOI input tabs */}
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  {(["draw", "upload", "preset"] as AoiTab[]).map((tab) => {
                    const labels: Record<AoiTab, string> = { draw: "Draw", upload: "Upload", preset: "Presets" };
                    return (
                      <button
                        key={tab}
                        onClick={() => setAoiTab(tab)}
                        className={`flex-1 py-1.5 transition ${aoiTab === tab ? "bg-forest-deep text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                      >
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>

                {/* Draw tab */}
                {aoiTab === "draw" && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1.5">
                    <p className="font-medium text-foreground">Draw on the map →</p>
                    <p>Use the <strong>polygon</strong> or <strong>rectangle</strong> tool in the top-left toolbar to draw your area of interest. Click the first point again to close a polygon.</p>
                    <p>Use the <strong>edit</strong> tool to refine, or <strong>delete</strong> to start over.</p>
                  </div>
                )}

                {/* Upload tab */}
                {aoiTab === "upload" && (
                  <div className="space-y-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground transition hover:bg-muted/60 hover:border-moss"
                    >
                      <Upload className="h-4 w-4" />
                      Upload GeoJSON file
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".geojson,.json"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Accepts .geojson files with Polygon or MultiPolygon geometry.
                      Convert KML/Shapefile at{" "}
                      <a href="https://geojson.io" target="_blank" rel="noreferrer" className="text-moss underline">
                        geojson.io
                      </a>.
                    </p>
                    {uploadError && (
                      <p className="rounded-md bg-alert/10 px-3 py-2 text-xs text-alert">{uploadError}</p>
                    )}
                  </div>
                )}

                {/* Preset tab */}
                {aoiTab === "preset" && (
                  <div className="space-y-1.5">
                    {regions.map((r) => {
                      const tone = r.status === "critical" ? "text-alert" : r.status === "watch" ? "text-earth" : "text-moss";
                      const isSel = aoi === r.geometry;
                      return (
                        <button
                          key={r.id}
                          onClick={() => selectPreset(r.id)}
                          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${isSel ? "border-forest-deep bg-forest-deep/8" : "border-border hover:border-moss hover:bg-muted/40"}`}
                        >
                          <div>
                            <div className="text-sm font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground">{r.country} · {r.areaHa.toLocaleString()} ha</div>
                          </div>
                          <span className={`text-xs font-medium ${tone}`}>{r.status}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Current AOI info */}
                {aoi && (
                  <div className="flex items-center justify-between rounded-md bg-moss/10 border border-moss/20 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-moss shrink-0" />
                      <span className="text-xs text-moss font-medium line-clamp-1">{aoiSource || "Custom AOI"}</span>
                    </div>
                    <button
                      onClick={() => { setAoi(null); setAoiSource(""); m.reset(); }}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Step 2: Dates ── */}
            <div className="ring-soft rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <StepBadge n={2} done={!!(beforeStart && beforeEnd && afterStart && afterEnd)} />
                <span className="text-sm font-medium">Comparison Dates</span>
              </div>
              <div className="p-4 space-y-4">
                {/* Quick presets */}
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Quick select:</p>
                  <div className="flex gap-1.5">
                    {(["1yr", "3yr", "5yr"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setDatePreset(p)}
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:border-moss hover:text-foreground transition"
                      >
                        {p === "1yr" ? "1-year" : p === "3yr" ? "3-year" : "5-year"} change
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Before window
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date" value={beforeStart} min="2017-01-01"
                      onChange={(e) => setBeforeStart(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      type="date" value={beforeEnd} min="2017-01-01"
                      onChange={(e) => setBeforeEnd(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A wider window (30–60 days) increases the chance of finding a cloud-free scene.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    After window
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date" value={afterStart} min="2017-01-01" max={today}
                      onChange={(e) => setAfterStart(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      type="date" value={afterEnd} min="2017-01-01" max={today}
                      onChange={(e) => setAfterEnd(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Step 3: Settings (collapsible) ── */}
            <div className="ring-soft rounded-xl border border-border bg-card">
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                className="flex w-full items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <StepBadge n={3} done />
                  <span className="text-sm font-medium">Analysis Settings</span>
                  <span className="text-xs text-muted-foreground">optional</span>
                </div>
                {settingsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {settingsOpen && (
                <div className="border-t border-border p-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">Max cloud cover</label>
                      <span className="font-mono text-sm">{maxCloud}%</span>
                    </div>
                    <input
                      type="range" min={5} max={80} step={5} value={maxCloud}
                      onChange={(e) => setMaxCloud(+e.target.value)}
                      className="mt-2 w-full accent-[--color-forest]"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Lower = cleaner imagery but harder to find a match. Raise if no scene is found.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">Forest NDVI threshold</label>
                      <span className="font-mono text-sm">{forestThreshold.toFixed(2)}</span>
                    </div>
                    <input
                      type="range" min={0.2} max={0.8} step={0.05} value={forestThreshold}
                      onChange={(e) => setForestThreshold(+e.target.value)}
                      className="mt-2 w-full accent-[--color-forest]"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Pixels with NDVI ≥ this value are classified as forested. Loss = fraction that drops below.
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between"><span>Source</span><span>Sentinel-2 L2A</span></div>
                    <div className="flex justify-between"><span>Bands</span><span>B04 (Red) · B08 (NIR)</span></div>
                    <div className="flex justify-between"><span>Resolution</span><span>10 m / pixel</span></div>
                    <div className="flex justify-between"><span>Backend</span><span>MS Planetary Computer</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Run button ── */}
            <div className="ring-soft rounded-xl border border-border bg-card p-4 space-y-3">
              <button
                onClick={run}
                disabled={m.isPending || !canRun}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-forest-deep px-4 py-3 text-sm font-medium text-primary-foreground transition hover:bg-forest disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {m.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Querying Sentinel-2…</>
                  : <><Play className="h-4 w-4" /> Run Analysis</>
                }
              </button>

              {!aoi && (
                <p className="text-center text-xs text-muted-foreground">
                  ← Draw or select an area of interest first
                </p>
              )}

              {m.isPending && (
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <LoadingStep label="Searching Planetary Computer STAC catalog…" />
                  <LoadingStep label="Selecting lowest-cloud Sentinel-2 scenes…" delayed />
                  <LoadingStep label="Computing NDVI statistics over AOI…" delayed2 />
                </div>
              )}

              {m.isError && (
                <div className="flex gap-2 rounded-lg border border-alert/30 bg-alert/8 p-3 text-xs text-alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{(m.error as Error).message}</span>
                </div>
              )}

              {m.isSuccess && result && (
                <div className="flex items-center gap-2 rounded-lg border border-moss/30 bg-moss/8 p-3 text-xs text-moss">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Analysis complete · {new Date(result.computedAt).toLocaleTimeString()}
                </div>
              )}
            </div>

          </aside>

          {/* ── Right: Map ── */}
          <div className="ring-soft overflow-hidden rounded-xl border border-border bg-card">
            {/* Layer switcher (only after analysis) */}
            {result && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" /> Satellite Layer
                </div>
                <div className="flex flex-wrap gap-1">
                  {([
                    ["tc-before",   "True Color · Before"],
                    ["tc-after",    "True Color · After"],
                    ["ndvi-before", "NDVI · Before"],
                    ["ndvi-after",  "NDVI · After"],
                  ] as [LayerKey, string][]).map(([k, label]) => {
                    const disabled =
                      ((k === "tc-before" || k === "ndvi-before") && !result.before.itemId) ||
                      ((k === "tc-after"  || k === "ndvi-after")  && !result.after.itemId);
                    return (
                      <button
                        key={k}
                        disabled={disabled}
                        onClick={() => setLayer(k)}
                        className={`rounded-md border px-2.5 py-1 text-[11px] transition ${
                          layer === k
                            ? "border-forest-deep bg-forest-deep text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-moss disabled:opacity-40"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!result && !m.isPending && (
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Use the draw toolbar (top-left of map) to define your area of interest, or search/select a preset above.
              </div>
            )}

            <DrawAnalysisMap
              height="calc(100vh - 220px)"
              geometry={aoi}
              onGeometryChange={handleGeometryChange}
              flyTo={flyTarget}
              overlayItemId={overlayItemId}
              overlayType={overlayType}
            />

            {result && (
              <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground font-mono">
                Before: {result.before.itemId} &nbsp;·&nbsp; After: {result.after.itemId}
              </div>
            )}
          </div>
        </div>

        {/* ── Results section ── */}
        {!result && !m.isPending && (
          <div className="mt-6 ring-soft rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <Satellite className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No analysis run yet</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
              Configure your area of interest and comparison dates, then click <strong>Run Analysis</strong> above.
              Results are computed live from the Copernicus Sentinel-2 archive.
            </p>
          </div>
        )}

        {m.isPending && (
          <div className="mt-6 ring-soft rounded-xl border border-border bg-card p-10 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-moss mb-3" />
            <p className="text-sm font-medium">Querying Sentinel-2 archive…</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Searching for the lowest-cloud scenes in your date windows, then computing NDVI statistics over your AOI.
            </p>
          </div>
        )}

        {result && <ResultSection r={result} onLayerChange={setLayer} currentLayer={layer} />}
      </main>
      <SiteFooter />
    </div>
  );
}

// ─── Loading step animation ───────────────────────────────────────────────────

function LoadingStep({ label, delayed, delayed2 }: { label: string; delayed?: boolean; delayed2?: boolean }) {
  const [visible, setVisible] = useState(!delayed && !delayed2);
  useEffect(() => {
    if (!delayed && !delayed2) return;
    const t = setTimeout(() => setVisible(true), delayed2 ? 3000 : 1500);
    return () => clearTimeout(t);
  }, [delayed, delayed2]);
  if (!visible) return null;
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

// ─── Results section ──────────────────────────────────────────────────────────

function ResultSection({ r, onLayerChange, currentLayer }: {
  r: AnalysisResult;
  onLayerChange: (k: LayerKey) => void;
  currentLayer: LayerKey;
}) {
  const lossPct = r.areaHa > 0 ? (r.lossHa / r.areaHa) * 100 : 0;
  const ndviDeltaDir = r.deltaNdvi < 0 ? "decline" : "gain";

  return (
    <div className="mt-6 space-y-5">
      {/* Section label */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" /> Analysis Results
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Detected Forest Loss"
          value={`${r.lossHa.toLocaleString()} ha`}
          sub={`${lossPct.toFixed(2)}% of AOI`}
          tone={r.lossHa > 0 ? "alert" : "ok"}
          icon={<TrendingDownIcon className={`h-4 w-4 ${r.lossHa > 0 ? "text-alert" : "text-moss"}`} />}
        />
        <MetricCard
          label="ΔNDVI (mean)"
          value={r.deltaNdvi > 0 ? `+${r.deltaNdvi.toFixed(3)}` : r.deltaNdvi.toFixed(3)}
          sub={`${r.before.stats.mean.toFixed(3)} → ${r.after.stats.mean.toFixed(3)} (${ndviDeltaDir})`}
          tone={r.deltaNdvi < 0 ? "alert" : "ok"}
        />
        <MetricCard
          label="AOI Area"
          value={`${r.areaHa.toLocaleString()} ha`}
          sub={`Forest threshold: NDVI ≥ ${r.forestThreshold.toFixed(2)}`}
        />
        <MetricCard
          label="Confidence Score"
          value={`${(r.confidence * 100).toFixed(0)}%`}
          sub="Valid-pixel & cloud-weighted"
          tone={r.confidence > 0.7 ? "ok" : "alert"}
        />
      </div>

      {/* Scene detail cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <EpochCard title="Before Scene" e={r.before} layerKey="tc-before" currentLayer={currentLayer} onSelect={onLayerChange} />
        <EpochCard title="After Scene"  e={r.after}  layerKey="tc-after"  currentLayer={currentLayer} onSelect={onLayerChange} />
      </div>

      {/* Histogram */}
      <div className="ring-soft rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">NDVI Distribution Shift</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              After − Before per NDVI bin. Forest threshold at {r.forestThreshold.toFixed(2)}.
              <span className="ml-1 text-forest-deep">Green bars</span> = more pixels.
              <span className="ml-1 text-alert">Red bars</span> = fewer pixels (loss).
            </p>
          </div>
        </div>
        <HistogramDiff r={r} />
      </div>

      {/* Downloads */}
      <DownloadStrip r={r} />
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, tone, icon }: {
  label: string; value: string; sub?: string;
  tone?: "alert" | "ok"; icon?: React.ReactNode;
}) {
  return (
    <div className="ring-soft rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className={`mt-2 font-display text-3xl ${tone === "alert" ? "text-alert" : tone === "ok" ? "text-forest-deep" : "text-foreground"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── Epoch detail card ────────────────────────────────────────────────────────

function EpochCard({ title, e, layerKey, currentLayer, onSelect }: {
  title: string;
  e: AnalysisResult["before"];
  layerKey: LayerKey;
  currentLayer: LayerKey;
  onSelect: (k: LayerKey) => void;
}) {
  const ndviKey: LayerKey = layerKey === "tc-before" ? "ndvi-before" : "ndvi-after";
  return (
    <div className="ring-soft rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {e.cloudCover != null ? `${e.cloudCover.toFixed(1)}% cloud` : "cloud n/a"}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground font-mono">
        {new Date(e.datetime).toISOString().slice(0, 10)} &nbsp;·&nbsp; {e.mgrs ?? "—"}
      </div>

      {/* Quick-view layer buttons */}
      <div className="mt-3 flex gap-1.5">
        <button
          onClick={() => onSelect(layerKey)}
          className={`rounded-md border px-2.5 py-1 text-[11px] transition ${currentLayer === layerKey ? "border-forest-deep bg-forest-deep text-primary-foreground" : "border-border text-muted-foreground hover:border-moss"}`}
        >
          True Color ↑ map
        </button>
        <button
          onClick={() => onSelect(ndviKey)}
          className={`rounded-md border px-2.5 py-1 text-[11px] transition ${currentLayer === ndviKey ? "border-forest-deep bg-forest-deep text-primary-foreground" : "border-border text-muted-foreground hover:border-moss"}`}
        >
          NDVI ↑ map
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Mean NDVI</dt>
        <dd className="text-right font-mono">{e.stats.mean.toFixed(3)}</dd>
        <dt className="text-muted-foreground">Std dev</dt>
        <dd className="text-right font-mono">{e.stats.std.toFixed(3)}</dd>
        <dt className="text-muted-foreground">Min / Max</dt>
        <dd className="text-right font-mono">{e.stats.min.toFixed(2)} / {e.stats.max.toFixed(2)}</dd>
        <dt className="text-muted-foreground">Forested fraction</dt>
        <dd className="text-right font-mono">{(e.forestFraction * 100).toFixed(1)}%</dd>
        <dt className="text-muted-foreground">Valid pixels</dt>
        <dd className="text-right font-mono">{e.stats.validPixels.toLocaleString()}</dd>
      </dl>
      <div className="mt-3 break-all text-[10px] text-muted-foreground font-mono">{e.itemId}</div>
    </div>
  );
}

// ─── NDVI histogram diff ──────────────────────────────────────────────────────

function HistogramDiff({ r }: { r: AnalysisResult }) {
  const b = r.before.stats.histogram;
  const a = r.after.stats.histogram;
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
    <div className="mt-4">
      <div className="flex h-40 items-end gap-0.5">
        {diffs.map((d, i) => {
          const h = (Math.abs(d.dPct) / maxAbs) * 100;
          const isForested = d.center >= r.forestThreshold;
          const positive = d.dPct >= 0;
          const color = positive
            ? (isForested ? "#2D6A4F" : "#b54a2a")
            : (isForested ? "#b54a2a" : "#2D6A4F");
          const isThreshold = Math.abs(d.center - r.forestThreshold) < 0.06;
          return (
            <div
              key={i}
              className={`flex flex-1 flex-col items-center justify-end ${isThreshold ? "relative" : ""}`}
              title={`NDVI ≈ ${d.center.toFixed(2)} · Δ ${d.dPct.toFixed(2)}%`}
            >
              {isThreshold && (
                <div className="absolute top-0 bottom-0 w-px bg-earth/60 pointer-events-none" />
              )}
              <div
                style={{ height: `${h}%`, backgroundColor: color, opacity: 0.82 }}
                className="w-full rounded-sm"
              />
              {(i % 4 === 0) && (
                <div className="mt-1 text-[9px] text-muted-foreground">{d.center.toFixed(1)}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-forest-deep" /> More pixels (gain)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-alert" /> Fewer pixels (loss)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-0.5 bg-earth/70" /> Forest threshold ({r.forestThreshold.toFixed(2)})</span>
      </div>
    </div>
  );
}

// ─── Download strip ───────────────────────────────────────────────────────────

function DownloadStrip({ r }: { r: AnalysisResult }) {
  function exportCsv() {
    const meta = [
      { metric: "before_item",           value: r.before.itemId },
      { metric: "before_datetime",       value: r.before.datetime },
      { metric: "before_cloud_cover",    value: r.before.cloudCover ?? "" },
      { metric: "before_mean_ndvi",      value: r.before.stats.mean },
      { metric: "before_forest_fraction",value: r.before.forestFraction },
      { metric: "after_item",            value: r.after.itemId },
      { metric: "after_datetime",        value: r.after.datetime },
      { metric: "after_cloud_cover",     value: r.after.cloudCover ?? "" },
      { metric: "after_mean_ndvi",       value: r.after.stats.mean },
      { metric: "after_forest_fraction", value: r.after.forestFraction },
      { metric: "delta_ndvi",            value: r.deltaNdvi },
      { metric: "aoi_area_ha",           value: r.areaHa },
      { metric: "loss_ha",               value: r.lossHa },
      { metric: "loss_fraction",         value: r.lossFraction },
      { metric: "confidence",            value: r.confidence },
      { metric: "forest_threshold",      value: r.forestThreshold },
      { metric: "computed_at",           value: r.computedAt },
    ];
    const histRows = r.before.stats.histogram.counts.map((c, i) => ({
      bin_low:    r.before.stats.histogram.edges[i],
      bin_high:   r.before.stats.histogram.edges[i + 1],
      count_before: c,
      count_after:  r.after.stats.histogram.counts[i] ?? 0,
    }));
    const csv =
      "# ForestWatch AI — Sentinel-2 L2A analysis via MS Planetary Computer\n" +
      toCsv(meta) + "\n\n" + toCsv(histRows);
    downloadText(`forestwatch-analysis-${r.computedAt.slice(0, 10)}.csv`, csv, "text/csv");
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
        <Download className="h-3.5 w-3.5" /> Export Results
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={exportCsv}
          className="ring-soft flex items-center justify-between rounded-xl border border-border bg-card px-4 py-4 text-sm transition hover:border-moss"
        >
          <span className="flex items-center gap-3"><Table className="h-4 w-4 text-moss" /> Analysis CSV</span>
          <span className="text-xs text-muted-foreground">↓</span>
        </button>
        <a
          href={ndviPreviewPngUrl(r.before.itemId)} target="_blank" rel="noreferrer"
          className="ring-soft flex items-center justify-between rounded-xl border border-border bg-card px-4 py-4 text-sm transition hover:border-moss"
        >
          <span className="flex items-center gap-3"><ImageIcon className="h-4 w-4 text-moss" /> NDVI · Before</span>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
        <a
          href={ndviPreviewPngUrl(r.after.itemId)} target="_blank" rel="noreferrer"
          className="ring-soft flex items-center justify-between rounded-xl border border-border bg-card px-4 py-4 text-sm transition hover:border-moss"
        >
          <span className="flex items-center gap-3"><ImageIcon className="h-4 w-4 text-moss" /> NDVI · After</span>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
        <a
          href={trueColorPreviewPngUrl(r.after.itemId)} target="_blank" rel="noreferrer"
          className="ring-soft flex items-center justify-between rounded-xl border border-border bg-card px-4 py-4 text-sm transition hover:border-moss"
        >
          <span className="flex items-center gap-3"><FileText className="h-4 w-4 text-moss" /> True Color PNG</span>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
      </div>
    </div>
  );
}

// ─── Step badge ───────────────────────────────────────────────────────────────

function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium ${
      done ? "bg-moss text-white" : "bg-muted text-muted-foreground"
    }`}>
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
    </span>
  );
}

// ─── Tiny icons ───────────────────────────────────────────────────────────────

function TrendingDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}

// ─── GeoJSON helpers ──────────────────────────────────────────────────────────

function extractPolygonFromGeoJSON(json: any): Polygon | null {
  // FeatureCollection → take first polygon feature
  if (json?.type === "FeatureCollection" && Array.isArray(json.features)) {
    for (const f of json.features) {
      const p = extractPolygonFromGeoJSON(f);
      if (p) return p;
    }
    return null;
  }
  // Feature → geometry
  if (json?.type === "Feature") return extractPolygonFromGeoJSON(json.geometry);
  // Polygon
  if (json?.type === "Polygon" && Array.isArray(json.coordinates)) {
    return json as Polygon;
  }
  // MultiPolygon → take largest ring
  if (json?.type === "MultiPolygon" && Array.isArray(json.coordinates)) {
    const ring = json.coordinates.reduce((best: number[][], coords: number[][][]) =>
      coords[0].length > best.length ? coords[0] : best, []);
    return { type: "Polygon", coordinates: [ring] };
  }
  return null;
}

function getPolyBounds(poly: Polygon): { lat: number; lng: number } {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const ring of poly.coordinates) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}
