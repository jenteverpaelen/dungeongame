// Load-time rescale of legendary rolls whose range a content wave changed (owner decision via the lead, 2026-10-11:
// "rescale old item rolls when a save loads"). Idempotent and unversioned (no SAVE_VERSION bump): a roll is moved only
// while its item still records a retired range, and moving it records the current one.
import { LEGENDARIES } from './data/items';
import type { Item } from './types';

/**
 * Retired roll ranges: legendary power id → the range its rolls had before the change. Add a row when a range changes.
 * - Rainspindle: cooldown cut 30–40 % became a damage roll 150–200 % (ranger wave, BUDGET.md §4 lever).
 * - Weathervane Ring, Bandolier Belt: 60–90 became 75–105 (ranger wave, BUDGET.md §4 lever).
 */
export const RETIRED_ROLL_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  rainspindle: [30, 40],
  weathervane_ring: [60, 90],
  bandolier_belt: [60, 90],
};

/**
 * Moves an owned legendary's roll from a retired range to the same position in the current range (rounded like a new
 * roll). The item's stored min / max say which range it was rolled in; an item without them is rescaled only when its
 * value lies outside the current range (inside it, it reads as a current roll). Overlapping ranges (60–90 → 75–105) are
 * why the stored range decides, not the value alone: an old 80 becomes 95 like every other old roll keeps its place.
 * Returns true when the item changed.
 */
export function rescaleLegendaryRoll(item: Item | null | undefined): boolean {
  const l = item?.legendary;
  if (!l) return false;
  const old = RETIRED_ROLL_RANGES[l.power], def = LEGENDARIES[l.power];
  if (!old || !def) return false;
  const [mn, mx] = def.range;
  const storedOld = l.min === old[0] && l.max === old[1];
  const hasRange = typeof l.min === 'number' && typeof l.max === 'number';
  const outside = l.value < mn || l.value > mx;
  if (!(storedOld || (!hasRange && outside))) return false;
  if (storedOld && old[0] === mn && old[1] === mx) return false; // not actually retired
  const t = Math.min(1, Math.max(0, (l.value - old[0]) / (old[1] - old[0])));
  const raw = mn + (mx - mn) * t;
  l.value = mx <= 2 ? Math.round(raw * 100) / 100 : Math.round(raw);
  l.min = mn;
  l.max = mx;
  return true;
}
