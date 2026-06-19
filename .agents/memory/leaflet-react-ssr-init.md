---
name: Leaflet + leaflet-draw safe init pattern (TanStack Start / SSR + Strict Mode)
description: The initialization pattern that avoids double-init, SSR crashes, and HMR stale-map issues.
---

## Pattern

```ts
useEffect(() => {
  let cancelled = false;
  let localMap: any = null;

  (async () => {
    const L = (await import("leaflet")).default;
    await import("leaflet/dist/leaflet.css");

    if (cancelled || !containerRef.current) return;
    // Guard against double-init (e.g. HMR without full unmount)
    if ((containerRef.current as any)._leaflet_id) return;

    localMap = L.map(containerRef.current, { ... });
    if (cancelled) { localMap.remove(); return; }

    // … set up tiles, controls …

    (window as any).L = L;            // leaflet-draw needs window.L
    await import("leaflet-draw/dist/leaflet.draw.css");
    await import("leaflet-draw");
    // PATCH readableArea here (see leaflet-draw-vite-bugs.md)

    if (!cancelled) mapRef.current = localMap;
    else            localMap.remove();
  })();

  return () => {
    cancelled = true;
    if (mapRef.current)   { mapRef.current.remove(); mapRef.current = null; }
    else if (localMap)    { localMap.remove(); }
    drawnItemsRef.current = null;
  };
}, []);
```

## Why this works

- `cancelled` flag: if React Strict Mode unmounts before the async chain finishes, the flag prevents `L.map()` from being called on an already-removed container.
- `_leaflet_id` guard: prevents re-init when HMR does a fast-refresh without a true unmount/remount cycle.
- Cleanup always removes the map, clearing `_leaflet_id` so the next real mount starts fresh.
- `mapRef.current` is set only if not cancelled, so sync-effect code that checks `mapRef.current` is safe.

## Key constraint

`(window as any).L = L` must be set BEFORE `await import("leaflet-draw")`, otherwise leaflet-draw cannot find the L global and silently fails to attach its draw handlers.
