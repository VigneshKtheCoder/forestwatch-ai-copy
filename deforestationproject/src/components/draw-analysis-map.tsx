import { useEffect, useRef } from "react";
import type { Polygon } from "@/lib/geo";
import { polygonBounds } from "@/lib/geo";
import { trueColorTileUrl, ndviTileUrl } from "@/lib/forest-data";

export type OverlayType = "tc" | "ndvi";

interface FlyTarget {
  lat: number;
  lng: number;
  zoom?: number;
}

interface Props {
  height?: number | string;
  geometry?: Polygon | null;
  onGeometryChange?: (poly: Polygon | null) => void;
  flyTo?: FlyTarget | null;
  overlayItemId?: string;
  overlayType?: OverlayType;
}

export function DrawAnalysisMap({
  height = 520,
  geometry,
  onGeometryChange,
  flyTo,
  overlayItemId,
  overlayType = "tc",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);

  // Keep latest callbacks/props in refs to avoid stale closures
  const onGeometryChangeRef = useRef(onGeometryChange);
  onGeometryChangeRef.current = onGeometryChange;

  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  // ── Init map once ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let localMap: any = null;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current) return;

      // Bail if container already has a Leaflet map (e.g. HMR)
      if ((containerRef.current as any)._leaflet_id) return;

      localMap = L.map(containerRef.current, {
        center: [5, 20],
        zoom: 2,
        scrollWheelZoom: true,
        worldCopyJump: true,
        zoomControl: false,
      });

      if (cancelled) { localMap.remove(); return; }

      // ── Basemaps ──
      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles © Esri — Earthstar Geographics", maxZoom: 19 }
      );
      const streets = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap contributors", maxZoom: 19 }
      );
      satellite.addTo(localMap);

      L.control.layers(
        { "🛰 Satellite": satellite, "🗺 Streets": streets },
        {},
        { position: "bottomright" }
      ).addTo(localMap);

      L.control.zoom({ position: "bottomright" }).addTo(localMap);

      // ── Drawn items feature group ──
      const drawnItems = new L.FeatureGroup();
      localMap.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;

      // ── Show initial geometry ──
      const initGeom = geometryRef.current;
      if (initGeom) {
        renderAoi(L, drawnItems, initGeom);
        const bounds = polygonBounds(initGeom);
        localMap.fitBounds(bounds as any, { padding: [40, 40] });
      }

      // ── Leaflet Draw ──
      if (!cancelled) {
        (window as any).L = L;
        await import("leaflet-draw/dist/leaflet.draw.css");
        await import("leaflet-draw");

        // leaflet-draw v1.0.4 has a bug: `readableArea` uses undeclared `type`
        // variable which throws in strict ES module mode. Patch it.
        if ((L as any).GeometryUtil) {
          (L as any).GeometryUtil.readableArea = function (area: number, isMetric: boolean) {
            if (isMetric) {
              if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`;
              if (area >= 10_000) return `${(area / 10_000).toFixed(2)} ha`;
              return `${area.toFixed(0)} m²`;
            } else {
              const acres = area / 4046.86;
              if (acres >= 640) return `${(acres / 640).toFixed(2)} mi²`;
              return `${acres.toFixed(2)} ac`;
            }
          };
        }

        if (!cancelled) {
          const drawStyle = {
            color: "#1B4332",
            weight: 2,
            fillOpacity: 0.08,
            dashArray: "5 5",
          };

          const drawControl = new (L as any).Control.Draw({
            position: "topleft",
            draw: {
              polygon: {
                allowIntersection: false,
                drawError: { color: "#b54a2a", message: "Lines cannot cross" },
                shapeOptions: drawStyle,
                showArea: false,
              },
              rectangle: { shapeOptions: drawStyle },
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
            },
            edit: {
              featureGroup: drawnItems,
              remove: true,
            },
          });
          localMap.addControl(drawControl);

          localMap.on((L as any).Draw.Event.CREATED, (e: any) => {
            drawnItems.clearLayers();
            drawnItems.addLayer(e.layer);
            const gj = e.layer.toGeoJSON();
            onGeometryChangeRef.current?.(gj.geometry as Polygon);
          });

          localMap.on((L as any).Draw.Event.EDITED, () => {
            const layers = drawnItems.getLayers();
            if (!layers.length) { onGeometryChangeRef.current?.(null); return; }
            const gj = (layers[0] as any).toGeoJSON();
            onGeometryChangeRef.current?.(gj.geometry as Polygon);
          });

          localMap.on((L as any).Draw.Event.DELETED, () => {
            onGeometryChangeRef.current?.(null);
          });
        }
      }

      if (!cancelled) {
        mapRef.current = localMap;
      } else {
        localMap.remove();
      }
    })();

    return () => {
      cancelled = true;
      // Tear down whatever was created
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      } else if (localMap) {
        localMap.remove();
      }
      drawnItemsRef.current = null;
      overlayRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync geometry prop → map ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const drawnItems = drawnItemsRef.current;
    if (!map || !drawnItems) return;

    import("leaflet").then(({ default: L }) => {
      drawnItems.clearLayers();
      if (!geometry) return;
      renderAoi(L, drawnItems, geometry);
      const bounds = polygonBounds(geometry);
      map.fitBounds(bounds as any, { padding: [40, 40] });
    });
  }, [geometry]);

  // ── FlyTo ────────────────────────────────────────────────────
  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? 10, { duration: 1.2 });
  }, [flyTo]);

  // ── Satellite overlay ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import("leaflet").then(({ default: L }) => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }
      if (!overlayItemId) return;
      const url = overlayType === "ndvi" ? ndviTileUrl(overlayItemId) : trueColorTileUrl(overlayItemId);
      overlayRef.current = L.tileLayer(url, {
        opacity: 0.92,
        maxZoom: 18,
        attribution: "Imagery: ESA Sentinel-2 via MS Planetary Computer",
      }).addTo(map);
    });
  }, [overlayItemId, overlayType]);

  return (
    <div ref={containerRef} style={{ height }} className="w-full bg-muted" />
  );
}

function renderAoi(L: any, featureGroup: any, geometry: Polygon) {
  // Use L.polygon (not L.geoJSON) so leaflet-draw's edit handler
  // finds a proper L.Polygon with a .editing property on it.
  const rings = geometry.coordinates.map((ring: number[][]) =>
    ring.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number])
  );
  const layer = L.polygon(rings, {
    color: "#1B4332",
    weight: 2.5,
    fillOpacity: 0.06,
    dashArray: "5 5",
  });
  featureGroup.addLayer(layer);
}
