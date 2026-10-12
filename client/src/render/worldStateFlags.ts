/** World states that are on for the local player in the current zone (docs/rework/quests/DESIGN.md §7). Rotors and wheels
 *  read it every frame; `WorldPhases.refresh` writes it. A tiny module so art code can import it without cycles. */
export const activeWorldStates = new Set<string>();
/** When a state that turned on during play takes effect (performance.now() ms; Infinity while the reveal waits for the
 *  camera). States that were already on at zone entry have no entry. */
export const worldStateSince = new Map<string, number>();
/** 0 → 1 as a state that just turned on takes effect over `ms` (a wheel spins up, a kiln cools); 1 for a state that was
 *  already on, 0 while off. */
export function stateRamp(key: string, now: number, ms = 1800): number {
  if (!activeWorldStates.has(key)) return 0;
  const since = worldStateSince.get(key);
  if (since === undefined) return 1;
  const t = (now - since) / ms;
  if (t >= 1) { worldStateSince.delete(key); return 1; }
  return t <= 0 ? 0 : t * t * (3 - 2 * t);
}
