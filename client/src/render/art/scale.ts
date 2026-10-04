// Current on-screen density (camera zoom × renderer resolution), set by the scene through index.ts
// setViewScale(). Baked sheets pick their texel density from it so sprites stay crisp; views re-acquire a
// denser sheet lazily when the window grows.

let current = 2;
const listeners = new Set<() => void>();

export function setScaleValue(s: number): void {
  if (!(s > 0) || s === current) return;
  const grew = bakeResFor(s) > bakeResFor(current);
  current = s;
  if (grew) for (const f of listeners) f();
}

export function viewScaleValue(): number { return current; }

function bakeResFor(s: number, min = 3, max = 6): number {
  return Math.max(min, Math.min(max, Math.ceil(s * 1.15 - 0.05)));
}

/** Integer texels per world unit for baked sheets at the current view scale (≥ min, ≤ max). */
export function bakeRes(min = 3, max = 6): number { return bakeResFor(current, min, max); }

/** Called when the bake density grows (sheets may want to re-bake). */
export function onBakeResGrow(f: () => void): () => void { listeners.add(f); return () => listeners.delete(f); }
