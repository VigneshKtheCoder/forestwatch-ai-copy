import { Fragment, useEffect, useRef, useState } from "react";
import { regionsSortedByLoss } from "@/lib/forest-data";

interface Props {
  height?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

/** Radius of a circle (meters) with area equal to ha hectares */
function haToRadius(ha: number) {
  return Math.sqrt((ha * 10_000) / Math.PI);
}

/**
 * Child component placed inside MapContainer.
 * Receives `useMap` as a prop (the hook from react-leaflet's module)
 * so it can call it at the top level of this function component.
 */
function FlyController({
  useMapFn,
  selectedId,
}: {
  useMapFn: () => any;
  selectedId?: string;
}) {
  const map = useMapFn();
  const prevId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!map || !selectedId || selectedId === prevId.current) return;
    prevId.current = selectedId;
    const region = regionsSortedByLoss.find((r) => r.id === selectedId);
    if (region) {
      map.flyTo([region.lat, region.lng], 5, { duration: 1.1, easeLinearity: 0.5 });
    }
  }, [selectedId, map]);

  return null;
}

export function ForestMap({ height = 440, selectedId, onSelect }: Props) {
  const [Mod, setMod] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      const rl = await import("react-leaflet");
      if (!cancelled) setMod({ L, ...rl });
    })();
    return () => { cancelled = true; };
  }, []);

  if (!Mod) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground"
        style={{ height }}
      >
        Loading satellite basemap…
      </div>
    );
  }

  const { MapContainer, TileLayer, Circle, Tooltip, useMap } = Mod;

  return (
    <div className="overflow-hidden rounded-xl border border-border ring-soft" style={{ height }}>
      <MapContainer
        center={[2, 10]}
        zoom={2}
        scrollWheelZoom={false}
        worldCopyJump
        style={{ height: "100%", width: "100%" }}
      >
        {/* Fly-to controller — must be inside MapContainer to access map context */}
        <FlyController useMapFn={useMap} selectedId={selectedId} />

        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Source: Esri, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        {regionsSortedByLoss.map((r) => {
          const isSel = selectedId === r.id;
          const areaColor = r.status === "critical" ? "#b54a2a" : r.status === "watch" ? "#d4a14a" : "#40916C";
          const lossColor = r.status === "critical" ? "#e05a30" : r.status === "watch" ? "#e8b860" : "#52aa80";
          const areaRadius = haToRadius(r.areaHa);
          const lossRadius = haToRadius(r.lossHa);
          const lossPct = ((r.lossHa / r.areaHa) * 100).toFixed(1);

          return (
            <Fragment key={r.id}>
              {/* Outer dashed ring: total monitored area */}
              <Circle
                center={[r.lat, r.lng]}
                radius={areaRadius}
                pathOptions={{
                  color: areaColor,
                  weight: isSel ? 2.5 : 1,
                  fillColor: areaColor,
                  fillOpacity: isSel ? 0.16 : 0.06,
                  dashArray: isSel ? undefined : "6 4",
                }}
                eventHandlers={{ click: () => onSelect?.(r.id) }}
              />
              {/* Inner filled circle: deforestation loss area */}
              <Circle
                center={[r.lat, r.lng]}
                radius={lossRadius}
                pathOptions={{
                  color: lossColor,
                  weight: isSel ? 3 : 1.5,
                  fillColor: lossColor,
                  fillOpacity: isSel ? 0.82 : 0.5,
                }}
                eventHandlers={{ click: () => onSelect?.(r.id) }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={1} sticky={false}>
                  <div style={{ minWidth: 200, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{r.name}</div>
                    <div style={{ color: "#6b7568", fontSize: 11, marginBottom: 6 }}>
                      {r.country} · {r.ecosystem}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ color: "#6b7568" }}>Monitored area</span>
                      <strong>{r.areaHa.toLocaleString()} ha</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, color: "#b54a2a" }}>
                      <span>Forest loss (12 mo)</span>
                      <strong>{r.lossHa.toLocaleString()} ha ({lossPct}%)</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#6b7568" }}>NDVI change</span>
                      <strong style={{ color: "#b54a2a" }}>
                        {r.ndviBefore.toFixed(2)} → {r.ndviAfter.toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ marginTop: 5, paddingTop: 4, borderTop: "1px solid #e5e7df", fontSize: 10, color: "#9ba698", textAlign: "center" }}>
                      Outer ring = monitored area · Inner = loss area · Click to focus
                    </div>
                  </div>
                </Tooltip>
              </Circle>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
