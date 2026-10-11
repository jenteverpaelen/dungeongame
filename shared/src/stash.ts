import { INVENTORY_SIZE, STASH_SIZE } from './constants';
import type { CharacterSave } from './types';

/**
 * Stash tabs (F-ECO-08). The stash stays per character (D-24, the approved exception); each tab is the approved 60-slot
 * page and tabs after the first are optional purchases with gold, bought in order.
 *
 * MAX_STASH_TABS = 5 [K, not re-checked]: Diablo III in the Reaper of Souls era sold stash tabs for gold up to five per
 * account, and Diablo IV also sells extra tabs for gold; the exact count is an owner pick (LOG.md, F-ECO-08).
 *
 * Prices [M → P]: tab k costs one hour of the measured engaged-bot gold income (median of the three classes, gold
 * picked up per hour, docs/rework/partials/bot-metrics/baseline.json) in the level band where the roadmap expects that
 * much storage to matter, rounded to two significant figures:
 *   tab 2 — L10→15 median 168,497/h → 170,000   (the Frontier, where the roadmap introduces the stash)
 *   tab 3 — L20→25 median 1,054,784/h → 1,100,000
 *   tab 4 — L30→35 median 2,363,195/h → 2,400,000
 *   tab 5 — L35→40 median 4,616,796/h → 4,600,000
 * "One hour" is the proposal; escalating gold prices follow Diablo III / Last Epoch [K].
 */
export const MAX_STASH_TABS = 5;
export const STASH_TAB_PRICES: readonly number[] = [0, 170_000, 1_100_000, 2_400_000, 4_600_000];

/** Tabs this character owns (1 … MAX_STASH_TABS). Legacy saves own one. */
export function stashTabs(save: Pick<CharacterSave, 'stashTabs'>): number {
  const n = save.stashTabs;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 ? Math.min(MAX_STASH_TABS, n) : 1;
}
export const stashCapacity = (save: Pick<CharacterSave, 'stashTabs'>) => stashTabs(save) * STASH_SIZE;
/** Price of the next tab, or null at the maximum. */
export function nextStashTabPrice(save: Pick<CharacterSave, 'stashTabs'>): number | null {
  const owned = stashTabs(save);
  return owned >= MAX_STASH_TABS ? null : STASH_TAB_PRICES[owned];
}

function freeSlotInTab(save: CharacterSave, tab: number): number {
  for (let i = tab * STASH_SIZE; i < (tab + 1) * STASH_SIZE; i++) if (!save.stash[i]) return i;
  return -1;
}
/** First free slot: the preferred tab, then the following tabs in order (wrapping). */
function freeStashSlot(save: CharacterSave, preferred: number): number {
  const tabs = stashTabs(save);
  const start = Number.isSafeInteger(preferred) && preferred >= 0 && preferred < tabs ? preferred : 0;
  for (let k = 0; k < tabs; k++) { const i = freeSlotInTab(save, (start + k) % tabs); if (i >= 0) return i; }
  return -1;
}

/** Atomic, id-based transfer; retries cannot duplicate an item or act on a changed slot. */
export function transferStash(save: CharacterSave, itemId: string, deposit: boolean, tab = 0): string | null {
  const source = deposit ? save.inventory : save.stash, dest = deposit ? save.stash : save.inventory;
  const index = source.findIndex(i => i?.id === itemId);
  if (index < 0) return deposit ? 'Item not in inventory' : 'Item not in stash';
  const matches = ownedItems(save).filter(i => i?.id === itemId).length;
  if (matches !== 1) return 'Duplicate item id; transfer refused';
  let free = -1;
  if (deposit) free = freeStashSlot(save, tab);
  else for (let i = 0; i < INVENTORY_SIZE; i++) if (!dest[i]) { free = i; break; }
  if (free < 0) return deposit ? 'Your stash is full' : 'Your inventory is full';
  dest[free] = source[index]; source[index] = null;
  return null;
}

/** Move a stored item to the first free slot of another owned tab. */
export function moveStashItem(save: CharacterSave, itemId: string, tab: number): string | null {
  if (!Number.isSafeInteger(tab) || tab < 0 || tab >= stashTabs(save)) return 'You do not own that stash tab';
  const index = save.stash.findIndex(i => i?.id === itemId);
  if (index < 0) return 'Item not in stash';
  if (Math.floor(index / STASH_SIZE) === tab) return 'The item is already in that tab';
  if (ownedItems(save).filter(i => i?.id === itemId).length !== 1) return 'Duplicate item id; transfer refused';
  const free = freeSlotInTab(save, tab);
  if (free < 0) return 'That tab is full';
  save.stash[free] = save.stash[index]; save.stash[index] = null;
  return null;
}

/**
 * Buy the next tab. `tab` (1-based number of the tab being bought) and `price` must match what the client showed, so a
 * retried or stale request can never buy twice or pay a different price.
 */
export function buyStashTab(save: CharacterSave, tab: number, price: number): string | null {
  const owned = stashTabs(save), cost = nextStashTabPrice(save);
  if (cost === null) return 'Your stash has every tab';
  if (tab !== owned + 1) return tab <= owned ? 'You already own that tab' : 'Buy the tabs in order';
  if (price !== cost) return 'The price changed; check it and try again';
  if (save.gold < cost) return 'Not enough gold';
  save.gold -= cost;
  save.stashTabs = owned + 1;
  while (save.stash.length < stashCapacity(save)) save.stash.push(null);
  return null;
}
import { ownedItems } from './merchant';
