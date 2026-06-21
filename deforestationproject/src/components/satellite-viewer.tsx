// Real satellite imagery viewer for the landing page hero.
//
// Image source: ESRI World Imagery MapServer static export (ArcGIS Living Atlas).
// Free, no API key, CDN-backed — returns a JPEG for any given bbox in EPSG:4326.
//
// Fix: images are preloaded via new Image() in useEffect so they start fetching
// immediately on mount rather than waiting for React's onLoad event chain.
// The background div always renders; opacity fades in when the Image() promise resolves.

import { useEffect, useRef, useState } from "react";

const ESRI =
  "https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export" +
  "?bboxSR=4326&size=660,440&imageSR=4326&f=image&format=jpg";

// Central Amazonas — dense primary forest, minimal clearings
const BEFORE_URL = `${ESRI}&bbox=-65.6,-9.2,-63.2,-7.2`;

// Rondônia frontier — fishbone deforestation pattern clearly visible from orbit
const AFTER_URL = `${ESRI}&bbox=-63.6,-12.3,-61.4,-10.3`;

// Preload both images as soon as this module executes (client only).
// Wrapping in try/catch prevents SSR errors where Image is undefined.
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const img = new (window as any).Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = src;
      // If already complete (browser cache), resolve immediately
      if (img.complete) resolve();
    } catch {
      resolve();
    }
  });
}

interface PanelProps {
  url: string;
  loaded: boolean;
  label: string;
  labelClass: string;
  ndvi: string;
  ndviDot: string;
  ndviLabel: string;
  deltaLabel?: string;
  borderRight?: boolean;
}

function Panel({
  url, loaded, label, labelClass, ndvi, ndviDot, ndviLabel, deltaLabel, borderRight,
}: PanelProps) {
  return (
    <div
      className={`relative overflow-hidden${borderRight ? " border-r border-white/10" : ""}`}
      style={{ height: 272 }}
    >
      {/* Dark base — visible while image loads */}
      <div className="absolute inset-0 bg-[#0a1a0d]" />

      {/* Loading shimmer — only when not yet loaded */}
      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/55" />
          <span className="text-[11px] text-white/35">Loading imagery…</span>
        </div>
      )}

      {/* Satellite image as background-div */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${JSON.stringify(url)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.6s ease",
        }}
      />

      {/* Date / state label */}
      <div className="pointer-events-none absolute left-0 right-0 top-2 z-20 flex justify-center">
        <div className={`rounded-md px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${labelClass}`}>
          {label}
        </div>
      </div>

      {/* NDVI badge */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-[10px] font-mono text-white/85 backdrop-blur-sm">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: ndviDot }} />
        {ndvi} · {ndviLabel}
      </div>

      {/* ΔNDVI badge */}
      {deltaLabel && (
        <div className="absolute bottom-2 right-2 z-20 rounded bg-red-950/80 px-2 py-1 text-[10px] font-mono text-red-300 backdrop-blur-sm">
          {deltaLabel}
        </div>
      )}

      {/* Data credit */}
      <div className="absolute bottom-1 right-1.5 z-20 text-[8px] text-white/25">
        © Esri, Maxar, USGS
      </div>
    </div>
  );
}

export function SatelliteViewer() {
  const [beforeLoaded, setBeforeLoaded] = useState(false);
  const [afterLoaded, setAfterLoaded] = useState(false);
  const initiated = useRef(false);

  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;

    preloadImage(BEFORE_URL).then(() => setBeforeLoaded(true));
    preloadImage(AFTER_URL).then(() => setAfterLoaded(true));
  }, []);

  return (
    <div className="ring-soft overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-white/70">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sage" />
          <span className="font-medium">Amazon Basin · Brazil</span>
          <span className="text-white/40">— ESRI World Imagery · high-resolution</span>
        </div>
        <span className="font-mono text-[10px] text-white/35">Rondônia corridor</span>
      </div>

      {/* Image panels */}
      <div className="grid grid-cols-2">
        <Panel
          url={BEFORE_URL}
          loaded={beforeLoaded}
          label="Intact Forest · Reference baseline"
          labelClass="bg-black/65 text-emerald-300"
          ndvi="NDVI 0.81"
          ndviDot="#22c55e"
          ndviLabel="Dense canopy"
          borderRight
        />
        <Panel
          url={AFTER_URL}
          loaded={afterLoaded}
          label="Deforestation Frontier · Active clearcuts"
          labelClass="bg-black/65 text-red-300"
          ndvi="NDVI 0.54"
          ndviDot="#ef4444"
          ndviLabel="−33% cover"
          deltaLabel="−0.27 ΔNDVI"
        />
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-4 divide-x divide-white/10 border-t border-white/10 text-xs">
        {[
          { label: "Area monitored",     value: "142,500 ha" },
          { label: "Forest loss (22yr)", value: "18,420 ha",  alert: true },
          { label: "ΔNDVI",              value: "−0.27",      alert: true },
          { label: "Confidence",         value: "91%" },
        ].map(({ label, value, alert }) => (
          <div key={label} className="px-3 py-2.5 text-center">
            <div className="text-[10px] text-white/40">{label}</div>
            <div className={`mt-0.5 font-mono font-semibold ${alert ? "text-[#f4a261]" : "text-white/80"}`}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Alert strip */}
      <div className="flex items-center gap-2 border-t border-white/8 bg-[#e5561e]/10 px-4 py-2 text-[11px] text-white/65">
        <span className="shrink-0 text-[#f4a261]">⚠</span>
        <span>
          <strong className="text-white/85">Critical alert generated</strong>
          {" "}· Clearcut expansion detected across 8 sites · Consistent with cattle ranching encroachment
        </span>
        <span className="ml-auto shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/50">
          AL-2418
        </span>
      </div>
    </div>
  );
}
