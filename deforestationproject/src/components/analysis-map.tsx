import { useEffect, useRef, useState } from "react";
import type { Polygon } from "@/lib/geo";
import { polygonBounds } from "@/lib/geo";
import { trueColorTileUrl, ndviTileUrl } from "@/lib/forest-data";

export type LayerKey =
  | "tc-before" | "tc-after"
  | "ndvi-before" | "ndvi-after";

interface Props {
  height?: number;
  geometry: Polygon;
  beforeItemId?: string;
  afterItemId?: string;
  layer: LayerKey;
}

export function AnalysisMap({ height = 460, geometry, beforeItemId, afterItemId, layer }: Props) {
  const [Mod, setMod] = useState<any>(null);
  const overlayRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (!cancelled) setMod({ L });
    })();
    return () => { cancelled = true; };
  }, []);

  // init map once Mod is ready
  useEffect(() => {
    if (!Mod) return;
    const L = Mod.L;
    if (mapRef.current) return;
    const bounds = polygonBounds(geometry);
    const map = L.map("analysis-map", { scrollWheelZoom: true, worldCopyJump: true });
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles © Esri", maxZoom: 18 },
    ).addTo(map);
    L.geoJSON({ type: "Feature", geometry, properties: {} } as any, {
      style: { color: "#1B4332", weight: 2, fillOpacity: 0.05, dashArray: "4 4" },
    }).addTo(map);
    map.fitBounds(bounds as any, { padding: [20, 20] });
    mapRef.current = map;
  }, [Mod, geometry]);

  // refit when geometry changes
  useEffect(() => {
    if (!mapRef.current || !Mod) return;
    mapRef.current.fitBounds(polygonBounds(geometry) as any, { padding: [20, 20] });
  }, [geometry, Mod]);

  // update overlay tile layer when layer/item changes
  useEffect(() => {
    if (!mapRef.current || !Mod) return;
    const L = Mod.L;
    if (overlayRef.current) {
      mapRef.current.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }
    const id =
      layer === "tc-before" || layer === "ndvi-before" ? beforeItemId :
      layer === "tc-after"  || layer === "ndvi-after"  ? afterItemId  : undefined;
    if (!id) return;
    const url =
      layer === "tc-before" || layer === "tc-after" ? trueColorTileUrl(id) : ndviTileUrl(id);
    overlayRef.current = L.tileLayer(url, { opacity: 0.9, maxZoom: 18, attribution: "Imagery: ESA Sentinel-2 · MS Planetary Computer" }).addTo(mapRef.current);
  }, [layer, beforeItemId, afterItemId, Mod]);

  if (!Mod) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground" style={{ height }}>
        Loading satellite basemap…
      </div>
    );
  }
  return <div id="analysis-map" style={{ height }} className="rounded-xl" />;
}
