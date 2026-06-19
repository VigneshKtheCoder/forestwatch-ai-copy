---
name: leaflet-draw v1.0.4 Vite bugs
description: Three runtime crashes when using leaflet-draw in a Vite ES-module build, and the fixes applied in ForestWatch AI.
---

## Bug 1 — `ReferenceError: type is not defined` in `readableArea`

**When:** Any time the user moves the mouse while drawing a polygon or rectangle.

**Root cause:** `L.GeometryUtil.readableArea` in leaflet-draw v1.0.4 uses an undeclared `type` variable (`type = typeof isMetric`) which is valid in sloppy script mode but throws in strict ES modules.

**Fix:** Monkey-patch `L.GeometryUtil.readableArea` right after `await import("leaflet-draw")`:
```ts
if ((L as any).GeometryUtil) {
  (L as any).GeometryUtil.readableArea = function (area: number, isMetric: boolean) {
    if (isMetric) {
      if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`;
      if (area >= 10_000)    return `${(area / 10_000).toFixed(2)} ha`;
      return `${area.toFixed(0)} m²`;
    } else {
      const acres = area / 4046.86;
      if (acres >= 640) return `${(acres / 640).toFixed(2)} mi²`;
      return `${acres.toFixed(2)} ac`;
    }
  };
}
```

**Why:** The patch must run AFTER leaflet-draw loads (leaflet-draw overwrites `L.GeometryUtil.readableArea`), and it must be in the same async block as the draw-control setup so the `L` reference is the same global object that leaflet-draw patched.

---

## Bug 2 — `TypeError: Cannot read properties of undefined (reading 'enable'/'disable')` in Edit/Draw toolbar

**When:** User clicks the Edit button on the draw toolbar when the `drawnItems` FeatureGroup contains layers that were created with `L.geoJSON()`.

**Root cause:** `L.geoJSON()` returns an `L.GeoJSON` FeatureGroup. When leaflet-draw's edit handler iterates the drawnItems group it calls `layer.editing.enable()`, but `L.GeoJSON` itself has no `.editing` property — only its child `L.Polygon` instances do.

**Fix:** Use `L.polygon(rings, style)` directly instead of `L.geoJSON()` when adding programmatic AOI layers to the `drawnItems` group. Convert GeoJSON ring coordinates `[lng, lat]` → `[lat, lng]` for Leaflet.

**How to apply:** Any time geometry from props/presets/GeoJSON-upload is rendered into the `drawnItems` FeatureGroup, construct the layer with `L.polygon` not `L.geoJSON`.

---

## Bug 3 — `showArea: true` does NOT suppress `readableArea` calls

**When:** Even with `polygon: { showArea: false }` in the drawControl options, leaflet-draw still calls `_getMeasurementString → readableArea` on every mousemove during drawing.

**Root cause:** `showArea` only controls whether the final tooltip shows the area after the shape is closed; it does NOT prevent the tooltip update path from calling `readableArea` during active drawing.

**Fix:** The monkey-patch from Bug 1 is the correct and only reliable fix. `showArea: false` alone is insufficient.
