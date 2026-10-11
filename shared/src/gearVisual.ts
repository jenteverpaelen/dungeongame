// Gear visual identity, version 2 (docs/rework/gear/DESIGN-V2.md): the look comes from the item you equip, not from
// an abstract tier ladder. Everything here is derived from item data every save already has, so saves never change:
//   • base shape      → silhouette family (client registry, client/src/render/art/weaponArt.ts and the armour art)
//   • generation 0..6 → item-level band (the item-name ladder Worn → Starforged, plus the level-70 cap): material,
//                       complexity and size of the piece
//   • rarity          → embellishment (inlay, trim, gems, extra silhouette pieces, emissive core)
//   • legendary / set → bespoke signature (legendary visual registry) or the Set's shared motif
//   • top tier 1..2   → the visual slot of the top tier above Legendary (stored today as `item.ancient`; the bible
//                       agent's new tier takes the same slot): a luminous overlay and extra floating pieces
//   • upgrade +N      → enhancement glow in three steps (+4 / +7 / +10)
// Looks gain a packed `fx` number only on the wire (heroes, loot); stored item looks never carry it.

import { GEM_IDS, LEGENDARIES, SETS } from './data/items';
import type { Item, ItemLook, Rarity, Slot } from './types';

/** First item level of each generation: the item-name ladder bands (`baseTierIndex` in items.ts: 1-12, 13-24, …, 61-70,
 *  measured) and the level-70 cap, so a piece's art always agrees with its base name (Short Sword … Starforged Blade). */
export const GEN_START = [1, 13, 25, 37, 49, 61, 70] as const;
export const MAX_GEN = GEN_START.length - 1;
/** Rarity order of the packed form (append-only). */
export const RARITY_ORDER: readonly Rarity[] = ['normal', 'magic', 'rare', 'legendary', 'set'];
/** Cube upgrade thresholds for enhancement-glow steps 1 / 2 / 3 (after the first risky step, past the coin flip, max). */
export const TEMPER_STEPS = [4, 7, 10] as const;

/** Append-only id orders used by the packed form (a reorder would change what other clients see: see the test). */
export const GEAR_SET_ORDER: readonly string[] = Object.keys(SETS);
export const GEAR_LEGENDARY_ORDER: readonly string[] = Object.keys(LEGENDARIES);
export const GEAR_GEM_ORDER: readonly string[] = GEM_IDS;

export interface GearFx {
  /** Item-level generation 0..6 (GEN_START). */
  gen: number;
  rarity: Rarity;
  /** Top-tier step 0..3 (0 = none; 1 and 2 are today's `item.ancient`). */
  top: number;
  upgrade: number;
  /** Enhancement-glow step 0..3 (TEMPER_STEPS). */
  temper: number;
  set?: string;
  legendary?: string;
  /** Filled sockets (0..3), the best socketed gem and its rank (0 = none). */
  gems: number;
  gem?: string;
  gemRank: number;
  enchanted: boolean;
}

/** Generation (0..6) of an item level. */
export function itemGeneration(ilvl: number): number {
  const lv = Math.max(1, Math.min(70, ilvl | 0));
  let g = 0;
  for (let i = 1; i < GEN_START.length; i++) if (lv >= GEN_START[i]) g = i;
  return g;
}

export function temperOf(upgrade: number): number {
  let t = 0;
  for (const s of TEMPER_STEPS) if (upgrade >= s) t++;
  return t;
}

/** Legendary or Set: the rarities that carry a signature / motif. */
export function isSpecial(r: Rarity): boolean { return r === 'legendary' || r === 'set'; }

/** How far a held item's look has come (monotone in generation, rarity and grade): the equip moment fires when the
 *  worn weapon passes the session's best and has light of its own (`litLook`). Not shown to players. */
export function lookStage(fx: Pick<GearFx, 'gen' | 'rarity' | 'top'>): number {
  return fx.top * 100 + fx.gen * 10 + RARITY_ORDER.indexOf(fx.rarity) * 2;
}
/** The look carries light: a legendary / Set piece, a graded piece, or a magic+ piece from the runesteel generation. */
export function litLook(fx: Pick<GearFx, 'gen' | 'rarity' | 'top'>): boolean {
  return isSpecial(fx.rarity) || fx.top > 0 || (fx.gen >= 4 && fx.rarity !== 'normal');
}

// ─────────────────────────── packed form (mixed radix, < 2^35, msgpack uint32/uint64) ───────────────────────────
// Field order puts the rare ids high so plain items stay below 2^32 (5 bytes in msgpack).

const FIELDS = [
  ['gen', 8], ['rarity', 8], ['top', 4], ['upgrade', 16], ['gems', 4], ['gem', 8], ['gemRank', 8], ['enchanted', 2], ['set', 32], ['legendary', 256],
] as const;
type FieldName = typeof FIELDS[number][0];
/** Field capacities (tests pin the content against them). */
export const FX_CAPACITY: Readonly<Record<FieldName, number>> = Object.fromEntries(FIELDS) as Record<FieldName, number>;

const clampField = (v: number, radix: number) => Math.max(0, Math.min(radix - 1, Math.floor(v) || 0));

/** Pack an item's visual identity into one non-negative safe integer. */
export function packGearFx(item: Item): number {
  let filled = 0, best = 0, bestRank = 0;
  for (const s of item.sockets ?? []) {
    if (!s) continue;
    filled++;
    const id = GEAR_GEM_ORDER.indexOf(s.gem) + 1;
    if (id > 0 && s.rank > bestRank) { best = id; bestRank = s.rank; }
  }
  const v: Record<FieldName, number> = {
    gen: itemGeneration(item.ilvl),
    rarity: Math.max(0, RARITY_ORDER.indexOf(item.rarity)),
    top: item.ancient | 0,
    upgrade: item.upgrade | 0,
    gems: filled, gem: best, gemRank: bestRank,
    enchanted: item.enchanted !== undefined ? 1 : 0,
    set: item.set ? GEAR_SET_ORDER.indexOf(item.set) + 1 : 0,
    legendary: item.legendary ? GEAR_LEGENDARY_ORDER.indexOf(item.legendary.power) + 1 : 0,
  };
  let n = 0, mul = 1;
  for (const [name, radix] of FIELDS) { n += clampField(v[name], radix) * mul; mul *= radix; }
  return n;
}

export function unpackGearFx(n: number): GearFx {
  let rest = Math.max(0, Math.floor(Number(n) || 0));
  const v = {} as Record<FieldName, number>;
  for (const [name, radix] of FIELDS) { v[name] = rest % radix; rest = Math.floor(rest / radix); }
  const upgrade = Math.min(10, v.upgrade);
  return {
    gen: Math.min(MAX_GEN, v.gen),
    rarity: RARITY_ORDER[v.rarity] ?? 'normal',
    top: Math.min(3, v.top),
    upgrade,
    temper: temperOf(upgrade),
    set: v.set ? GEAR_SET_ORDER[v.set - 1] : undefined,
    legendary: v.legendary ? GEAR_LEGENDARY_ORDER[v.legendary - 1] : undefined,
    gems: v.gems,
    gem: v.gem ? GEAR_GEM_ORDER[v.gem - 1] : undefined,
    gemRank: v.gemRank,
    enchanted: v.enchanted === 1,
  };
}

/** The item's look with its visual identity attached (a new object: stored looks never carry `fx`). */
export function gearLook(item: Item, look: ItemLook = item.look): ItemLook {
  return { shape: look.shape, primary: look.primary, secondary: look.secondary, glow: look.glow, variant: look.variant, fx: packGearFx(item) };
}

/** Decoded identity of a look, or null for looks without it (townsfolk, older servers). */
export function lookFx(look: ItemLook | undefined): GearFx | null {
  return look && typeof look.fx === 'number' ? unpackGearFx(look.fx) : null;
}

// ─────────────────────────── hero summary (item-driven effects only) ───────────────────────────

/** Jewellery and bracers are not paper-doll slots; they travel beside them for the floating charms. */
export type CharmSlot = 'neck' | 'ring1' | 'ring2' | 'wrists';
export const CHARM_SLOTS: readonly CharmSlot[] = ['neck', 'ring1', 'ring2', 'wrists'];
const ALL_SLOTS: readonly Slot[] = ['head', 'shoulders', 'neck', 'chest', 'hands', 'wrists', 'waist', 'legs', 'feet', 'ring1', 'ring2', 'mainhand', 'offhand'];
const TWO_HANDED_NO_OFFHAND = new Set(['sword2h', 'axe2h', 'staff', 'maul2h', 'polearm', 'censer']);

/** What a hero wears, summarised for the effects that belong to item families (DESIGN-V2.md §5): Set pieces (sigil,
 *  orbiters, wings), legendary jewellery (the shared aura), top-tier pieces and enhancement. No rank, no score. */
export interface GearProfile {
  sets: { id: string; count: number }[];
  topSet?: string;
  topSetCount: number;
  /** Legendary + Set pieces worn. */
  legendaries: number;
  /** Legendary amulet / rings worn (0..3): the jewellery aura escalates with it. */
  jewels: number;
  /** Pieces with a top-tier step (≥ 1) and the highest step worn. */
  tops: number;
  topMax: number;
  /** Highest enhancement step worn (0..3) and the number of slots at +10. */
  temper: number;
  maxed: number;
  /** Per-slot decoded identity (only slots that carry it). */
  slots: Partial<Record<Slot, GearFx>>;
  /** A staff or two-handed melee weapon is worn: the off-hand cannot be filled. */
  noOffhand: boolean;
}

export interface LookLike {
  slots: Partial<Record<string, ItemLook | undefined>>;
  jw?: Partial<Record<CharmSlot, number>>;
}

export function gearProfile(look: LookLike): GearProfile {
  const slots: Partial<Record<Slot, GearFx>> = {};
  for (const [slot, l] of Object.entries(look.slots) as [Slot, ItemLook | undefined][]) {
    const fx = lookFx(l);
    if (fx && ALL_SLOTS.includes(slot)) slots[slot] = fx;
  }
  for (const [slot, n] of Object.entries(look.jw ?? {}) as [CharmSlot, number | undefined][]) {
    if (typeof n === 'number' && ALL_SLOTS.includes(slot)) slots[slot] = unpackGearFx(n);
  }
  const main = look.slots.mainhand;
  const noOffhand = !!main && TWO_HANDED_NO_OFFHAND.has(main.shape) && !look.slots.offhand;
  const setCounts = new Map<string, number>();
  let legendaries = 0, jewels = 0, tops = 0, topMax = 0, temper = 0, maxed = 0;
  for (const slot of ALL_SLOTS) {
    const fx = slots[slot];
    if (!fx) continue;
    if (fx.set) setCounts.set(fx.set, (setCounts.get(fx.set) ?? 0) + 1);
    if (isSpecial(fx.rarity)) {
      legendaries++;
      if (slot === 'neck' || slot === 'ring1' || slot === 'ring2') jewels++;
    }
    if (fx.top > 0) { tops++; topMax = Math.max(topMax, fx.top); }
    temper = Math.max(temper, fx.temper);
    if (fx.temper >= 3) maxed++;
  }
  const sets = [...setCounts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  const top = sets[0];
  return { sets, topSet: top?.id, topSetCount: top?.count ?? 0, legendaries, jewels, tops, topMax, temper, maxed, slots, noOffhand };
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
