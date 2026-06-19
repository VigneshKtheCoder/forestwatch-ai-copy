import { useEffect, useState } from "react";
import { regions } from "@/lib/forest-data";

interface Props {
  height?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function ForestMap({ height = 420, selectedId, onSelect }: Props) {
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
      <div className="flex items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground" style={{ height }}>
        Loading satellite basemap…
      </div>
    );
  }

  const { MapContainer, TileLayer, CircleMarker, Tooltip } = Mod;

  return (
    <div className="ring-soft overflow-hidden rounded-xl border border-border" style={{ height }}>
      <MapContainer center={[-5, -20]} zoom={2} scrollWheelZoom={false} worldCopyJump>
        <TileLayer
          attribution='Tiles © Esri — Source: Esri, Earthstar Geographics'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {regions.map((r) => {
          const color = r.status === "critical" ? "#b54a2a" : r.status === "watch" ? "#d4a14a" : "#40916C";
          const isSel = selectedId === r.id;
          return (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lng]}
              radius={isSel ? 12 : 8}
              pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: isSel ? 0.85 : 0.55 }}
              eventHandlers={{ click: () => onSelect?.(r.id) }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                <div className="text-xs">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-muted-foreground">{r.country} · {r.lossHa.toLocaleString()} ha lost</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
