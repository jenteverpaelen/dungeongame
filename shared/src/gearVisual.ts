// Gear visual progression (docs/rework/gear/DESIGN.md). Everything here is derived from item data that already
// exists in saves (rarity, item level, ancient tier, set / legendary id, Cube upgrade, socketed gems, enchant), so
// no save migration is needed. Two axes, borrowed as principles from the references (REFERENCES.md):
//   • tier   (0..9) — what the item IS: the item-level name ladder (Worn → Starforged) × rarity × Ancient/Primal.
//                     Drives silhouette, ornament count, material finish and the animated effect layer.
//   • temper (0..3) — what the player DID to it: Cube upgrades (+4 / +7 / +10). Drives sheen and star pips.
// A hero's overall gear rank (0..9) is a slot-weighted mean of item tiers + tempers with Set / Primal bonuses;
// it drives the aura, back piece, nameplate medal and the character showcase.

import { GEM_IDS, LEGENDARIES, SETS } from './data/items';
import type { Item, ItemLook, Slot } from './types';

/** Original tier names (index = tier). */
export const GEAR_TIER_NAMES = ['Threadbare', 'Homespun', 'Tempered', 'Fine', 'Masterwork', 'Runic', 'Storied', 'Heroic', 'Ancient', 'Primal'] as const;
export const MAX_GEAR_TIER = 9;
/** Frame / medal colour per tier (iron → bronze → silver → gold → runic → legendary → heroic → amber → crimson). */
export const GEAR_TIER_COLORS = [0x6f665a, 0x9a9183, 0xb7814b, 0xc9d3dd, 0xe8b64a, 0x6fd8c8, 0xe0782f, 0xffb347, 0xff9a30, 0xff3a2a] as const;
/** Cube upgrade thresholds for temper 1 / 2 / 3 (after the first risky step, past the coin flip, the maximum). */
export const TEMPER_STEPS = [4, 7, 10] as const;

/** Append-only id orders used by the packed form (a reorder would change what other clients see: see the test). */
export const GEAR_SET_ORDER: readonly string[] = Object.keys(SETS);
export const GEAR_LEGENDARY_ORDER: readonly string[] = Object.keys(LEGENDARIES);
export const GEAR_GEM_ORDER: readonly string[] = GEM_IDS;

export interface GearFx {
  tier: number;
  ancient: 0 | 1 | 2;
  upgrade: number;
  temper: number;
  set?: string;
  legendary?: string;
  /** Filled sockets (0..3), the best socketed gem and its rank (0 = none). */
  gems: number;
  gem?: string;
  gemRank: number;
  enchanted: boolean;
}

/** Visual tier of an item (0..9). Pure function of rarity, item level and ancient tier. */
export function itemVisualTier(item: Pick<Item, 'rarity' | 'ilvl' | 'ancient'>): number {
  const ilvl = Math.max(1, Math.min(70, item.ilvl | 0));
  switch (item.rarity) {
    case 'legendary':
    case 'set':
      if (item.ancient === 2) return 9;
      if (item.ancient === 1) return 8;
      return ilvl >= 70 ? 7 : 6;
    case 'rare': return ilvl >= 48 ? 5 : ilvl >= 24 ? 4 : 3;
    case 'magic': return ilvl >= 36 ? 3 : ilvl >= 12 ? 2 : 1;
    default: return ilvl >= 36 ? 2 : ilvl >= 12 ? 1 : 0;
  }
}

export function temperOf(upgrade: number): number {
  let t = 0;
  for (const s of TEMPER_STEPS) if (upgrade >= s) t++;
  return t;
}

const bits = (v: number, n: number) => Math.max(0, Math.min((1 << n) - 1, v | 0));

/** Pack an item's visual progression into one small non-negative integer (28 bits; msgpack uint32). */
export function packGearFx(item: Item): number {
  const tier = itemVisualTier(item);
  const set = item.set ? GEAR_SET_ORDER.indexOf(item.set) + 1 : 0;
  const leg = item.legendary ? GEAR_LEGENDARY_ORDER.indexOf(item.legendary.power) + 1 : 0;
  let filled = 0, best = 0, bestRank = 0;
  for (const s of item.sockets ?? []) {
    if (!s) continue;
    filled++;
    const id = GEAR_GEM_ORDER.indexOf(s.gem) + 1;
    if (id > 0 && s.rank > bestRank) { best = id; bestRank = s.rank; }
  }
  return bits(tier, 4)
    | (bits(item.ancient, 2) << 4)
    | (bits(item.upgrade, 4) << 6)
    | (bits(set, 4) << 10)
    | (bits(leg, 5) << 14)
    | (bits(filled, 2) << 19)
    | (bits(best, 3) << 21)
    | (bits(bestRank, 3) << 24)
    | ((item.enchanted !== undefined ? 1 : 0) << 27);
}

export function unpackGearFx(n: number): GearFx {
  const v = Math.max(0, Math.floor(n)) >>> 0;
  const upgrade = (v >>> 6) & 15;
  const set = (v >>> 10) & 15, leg = (v >>> 14) & 31, gem = (v >>> 21) & 7;
  return {
    tier: Math.min(MAX_GEAR_TIER, v & 15),
    ancient: Math.min(2, (v >>> 4) & 3) as 0 | 1 | 2,
    upgrade: Math.min(10, upgrade),
    temper: temperOf(upgrade),
    set: set ? GEAR_SET_ORDER[set - 1] : undefined,
    legendary: leg ? GEAR_LEGENDARY_ORDER[leg - 1] : undefined,
    gems: (v >>> 19) & 3,
    gem: gem ? GEAR_GEM_ORDER[gem - 1] : undefined,
    gemRank: (v >>> 24) & 7,
    enchanted: ((v >>> 27) & 1) === 1,
  };
}

/** The item's look with its visual progression attached (a new object: stored looks never carry `fx`). */
export function gearLook(item: Item, look: ItemLook = item.look): ItemLook {
  return { shape: look.shape, primary: look.primary, secondary: look.secondary, glow: look.glow, variant: look.variant, fx: packGearFx(item) };
}

/** Decoded progression of a look, or null for looks without it (townsfolk, older servers). */
export function lookFx(look: ItemLook | undefined): GearFx | null {
  return look && typeof look.fx === 'number' ? unpackGearFx(look.fx) : null;
}

// ─────────────────────────── hero profile ───────────────────────────

/** Jewellery and bracers are not paper-doll slots; they travel beside them for the floating charms. */
export type CharmSlot = 'neck' | 'ring1' | 'ring2' | 'wrists';
export const CHARM_SLOTS: readonly CharmSlot[] = ['neck', 'ring1', 'ring2', 'wrists'];

/** Slot weights of the hero rank (the weapon is the most visible piece; rings the least). */
export const RANK_WEIGHTS: Readonly<Record<Slot, number>> = {
  mainhand: 2, offhand: 1, head: 1.25, chest: 1.25, shoulders: 1.25, legs: 1, feet: 1, hands: 1, waist: 0.75, wrists: 0.75,
  neck: 0.75, ring1: 0.5, ring2: 0.5,
};
const TWO_HANDED_NO_OFFHAND = new Set(['sword2h', 'axe2h', 'staff']);

export interface GearProfile {
  /** 0..9, same names and colours as item tiers. */
  rank: number;
  /** Slot-weighted mean before bonuses and caps (kept for tuning / tests). */
  score: number;
  sets: { id: string; count: number }[];
  topSet?: string;
  topSetCount: number;
  legendaries: number;
  ancients: number;
  primals: number;
  /** Highest temper worn (0..3) and the number of slots at temper 3 (+10). */
  temper: number;
  maxed: number;
  /** Per-slot decoded progression (only slots that carry it). */
  slots: Partial<Record<Slot, GearFx>>;
  /** A staff or two-handed melee weapon is worn: the off-hand cannot be filled. */
  noOffhand: boolean;
}

export interface LookLike {
  slots: Partial<Record<string, ItemLook | undefined>>;
  jw?: Partial<Record<CharmSlot, number>>;
}

/** Rounding bias of the hero rank: a hero whose slot-weighted mean sits within 0.35 of the next tier reads as that
 *  tier (tuned on the showcase ladder, see docs/rework/gear/DECISIONS.md D4). */
export const RANK_BIAS = 0.35;

export function gearProfile(look: LookLike): GearProfile {
  const slots: Partial<Record<Slot, GearFx>> = {};
  for (const [slot, l] of Object.entries(look.slots) as [Slot, ItemLook | undefined][]) {
    const fx = lookFx(l);
    if (fx && RANK_WEIGHTS[slot] !== undefined) slots[slot] = fx;
  }
  for (const [slot, n] of Object.entries(look.jw ?? {}) as [CharmSlot, number | undefined][]) {
    if (typeof n === 'number' && RANK_WEIGHTS[slot] !== undefined) slots[slot] = unpackGearFx(n);
  }
  const weights: Record<string, number> = { ...RANK_WEIGHTS };
  const main = look.slots.mainhand;
  const noOffhand = !!main && TWO_HANDED_NO_OFFHAND.has(main.shape) && !look.slots.offhand;
  if (noOffhand) { weights.mainhand += weights.offhand; weights.offhand = 0; }
  let sum = 0, total = 0;
  const setCounts = new Map<string, number>();
  let legendaries = 0, ancients = 0, primals = 0, temper = 0, maxed = 0;
  for (const slot of Object.keys(RANK_WEIGHTS) as Slot[]) {
    const w = weights[slot];
    total += w;
    const fx = slots[slot];
    if (!fx) continue;
    sum += w * (fx.tier + fx.temper / 3);
    if (fx.set) setCounts.set(fx.set, (setCounts.get(fx.set) ?? 0) + 1);
    if (fx.tier >= 6) legendaries++;
    if (fx.ancient === 1) ancients++;
    if (fx.ancient === 2) primals++;
    temper = Math.max(temper, fx.temper);
    if (fx.temper >= 3) maxed++;
  }
  const score = total ? sum / total : 0;
  const sets = [...setCounts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  const top = sets[0];
  const setBonus = top && top.count >= 6 ? 0.6 : top && top.count >= 4 ? 0.3 : 0;
  const primalBonus = Math.min(0.6, primals * 0.3);
  let rank = Math.floor(Math.min(MAX_GEAR_TIER, score + RANK_BIAS + setBonus + primalBonus) + 1e-9);
  if (primals === 0) rank = Math.min(rank, 8);
  if (primals + ancients === 0) rank = Math.min(rank, 7);
  return { rank: Math.max(0, rank), score, sets, topSet: top?.id, topSetCount: top?.count ?? 0, legendaries, ancients, primals, temper, maxed, slots, noOffhand };
}

/** Set pieces worn per set id (from a profile). */
export function setCount(p: GearProfile, id: string): number {
  return p.sets.find((s) => s.id === id)?.count ?? 0;
}

/** A hero look straight from an equipment map (inspect snapshots carry items, not looks). */
export function lookFromEquipment(classId: import('./types').ClassId, equipment: Partial<Record<Slot, Item | null>>): import('./protocol').PlayerLook {
  const slots: Partial<Record<import('./protocol').LookSlot, ItemLook>> = {};
  for (const s of ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'waist', 'mainhand', 'offhand'] as const) { const it = equipment[s]; if (it) slots[s] = gearLook(it); }
  const jw: Partial<Record<CharmSlot, number>> = {};
  for (const s of CHARM_SLOTS) { const it = equipment[s]; if (it) jw[s] = packGearFx(it); }
  return { classId, slots, ...(Object.keys(jw).length ? { jw } : {}) };
}

// ─────────────────────────── next steps ───────────────────────────

export type GearHint =
  | { key: 'empty'; slots: Slot[] }
  | { key: 'weakest'; slot: Slot; tier: number }
  | { key: 'rares' | 'legendary' | 'level70' | 'ancient' | 'temper' | 'primal' | 'top' }
  | { key: 'set'; set?: string; count: number };

/** What would raise this hero's gear rank next, judged from what is actually worn (at most two hints, most useful
 *  first): empty slots, a weak slot far below the rank, then the rung above (Legendary → level 70 → full Set →
 *  Ancient → Cube upgrades → Primal). */
export function gearNextSteps(p: GearProfile): GearHint[] {
  const out: GearHint[] = [];
  const order = Object.keys(RANK_WEIGHTS) as Slot[];
  const empty = order.filter((s) => !p.slots[s] && !(s === 'offhand' && p.noOffhand));
  if (p.rank >= MAX_GEAR_TIER) return [{ key: 'top' }];
  if (empty.length) out.push({ key: 'empty', slots: empty });
  let weakest: Slot | null = null;
  for (const s of order) { const f = p.slots[s]; if (f && (!weakest || f.tier < p.slots[weakest]!.tier)) weakest = s; }
  if (weakest && p.slots[weakest]!.tier < p.rank - 1) out.push({ key: 'weakest', slot: weakest, tier: p.slots[weakest]!.tier });
  const rung: GearHint | null = p.rank < 5 ? { key: 'rares' } : p.rank === 5 ? { key: 'legendary' }
    : p.legendaries < 6 && p.rank === 6 ? { key: 'level70' }
    : p.topSetCount < 6 ? { key: 'set', set: p.topSet, count: p.topSetCount }
    : p.ancients + p.primals === 0 ? { key: 'ancient' }
    : p.maxed < 3 ? { key: 'temper' }
    : p.primals === 0 ? { key: 'primal' } : { key: 'temper' };
  if (rung) out.push(rung);
  return out.slice(0, 2);
}
