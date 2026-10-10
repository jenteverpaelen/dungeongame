// The Cube: Task Bar Hero's levelling Hero-dric Cube (functions unlock with Cube level, every
// operation grants Cube XP) carrying Diablo 3's Kanai's Cube / Mystic / Blacksmith / Jeweler recipes.
// Pure validation + cost logic; the server applies results authoritatively.

import { AFFIXES, AFFIX_BY_STAT, BASES, GEMS, GEM_RANKS, LEGENDARIES } from './data/items';
import type { CubeSlot } from './data/items';
import type { CharacterSave, Item, Materials, Rarity } from './types';

/** Bulk salvage must match the inventory menu's promise; valuable gear is targeted individually. */
export const BULK_SALVAGE_RARITIES: readonly Rarity[] = ['normal', 'magic', 'rare'];

export type CubeOp =
  | 'salvage' | 'enchant' | 'upgrade' | 'transmute' | 'extract' | 'reforge' | 'socket' | 'fuse';

export interface CubeFunction {
  op: CubeOp;
  name: string;
  unlock: number;
  desc: string;
  source: string; // which reference game inspired it
}

export const CUBE_FUNCTIONS: CubeFunction[] = [
  { op: 'salvage', name: 'Salvage', unlock: 1, desc: 'Break items down into crafting materials.', source: 'D3 Blacksmith salvage' },
  { op: 'fuse', name: 'Gem Fusion', unlock: 2, desc: 'Fuse three gems into one of the next rank.', source: 'D3 Jeweler' },
  { op: 'enchant', name: 'Enchant', unlock: 3, desc: 'Reroll one property. Choose between two new rolls or keep the original. Only one property per item may ever be enchanted.', source: 'D3 Mystic' },
  { op: 'upgrade', name: 'Empower', unlock: 4, desc: 'Raise an item\'s upgrade tier (+1 to +10). Each tier adds 6% to all its stats. Higher tiers may fail; failures add Fortune to the next attempt.', source: 'TBH Cube tiers' },
  { op: 'transmute', name: 'Transmute Rare', unlock: 5, desc: 'Transform a Rare item into a random Legendary of the same type.', source: "Kanai's Cube: Upgrade Rare Item" },
  { op: 'extract', name: 'Extract Power', unlock: 6, desc: 'Destroy a Legendary to permanently learn its power, then equip up to three learned powers.', source: "Kanai's Cube: Extract Legendary Power" },
  { op: 'reforge', name: 'Reforge', unlock: 7, desc: 'Reroll every property of a Legendary as if newly found — it may become Ancient.', source: "Kanai's Cube: Rite of Rebirth / Reforge" },
  { op: 'socket', name: 'Add Socket', unlock: 8, desc: 'Add a socket to an item that can hold one.', source: "D3 Ramaladni's Gift" },
];

/** Cube XP needed to reach the next Cube level. */
export function cubeXpToNext(level: number): number {
  return Math.round(60 * Math.pow(level, 1.55));
}

export const CUBE_XP: Record<CubeOp, number> = {
  salvage: 3, fuse: 8, enchant: 12, upgrade: 18, transmute: 60, extract: 60, reforge: 45, socket: 30,
};

export function salvageYield(item: Item): Partial<Materials> {
  if(item.vendorStock)return {};
  switch (item.rarity) {
    case 'normal': return { scrap: 1 + Math.floor(item.ilvl / 25) };
    case 'magic': return { dust: 1 + Math.floor(item.ilvl / 25) };
    case 'rare': return { crystal: 1 + Math.floor(item.ilvl / 30), dust: 1 };
    default: return { soul: 1 + (item.ancient ? 1 : 0), crystal: 2 };
  }
}

export function salvageXp(item: Item): number {
  if(item.vendorStock)return 0;
  return { normal: 2, magic: 4, rare: 9, legendary: 30, set: 30 }[item.rarity];
}

export interface Cost { gold: number; mats: Partial<Materials>; gems?: { gem: string; rank: number; n: number } }

export function enchantCost(item: Item): Cost {
  const n = item.enchantCount;
  const base = 100 + item.ilvl * item.ilvl * 4;
  return {
    gold: Math.round(base * Math.pow(1.35, n)),
    mats: item.rarity === 'normal' || item.rarity === 'magic' ? { dust: 1 + Math.floor(n / 4) } : item.rarity === 'rare' ? { crystal: 1 + Math.floor(n / 4) } : { soul: 1, crystal: 1 + Math.floor(n / 4) },
  };
}

/** Success chance (%) of raising an item from tier `t` to `t+1`, before Fortune. */
export const UPGRADE_CHANCE = [100, 100, 100, 95, 85, 70, 55, 42, 30, 20];
export const FORTUNE_PER_FAIL = 6;

export function upgradeChance(item: Item): number {
  return Math.min(100, UPGRADE_CHANCE[item.upgrade] + item.upgradeFortune);
}

export function upgradeCost(item: Item): Cost {
  const t = item.upgrade;
  const rar = { normal: 1, magic: 1.5, rare: 2.5, legendary: 5, set: 5 }[item.rarity];
  const gold = Math.round((200 + item.ilvl * item.ilvl * 6) * rar * Math.pow(1.6, t));
  const mats: Partial<Materials> = item.rarity === 'normal' ? { scrap: 2 + t * 2 } : item.rarity === 'magic' ? { dust: 2 + t * 2 } : item.rarity === 'rare' ? { crystal: 2 + t * 2 } : { soul: 1 + Math.floor(t / 2), crystal: 3 + t * 2 };
  if (t >= 6) mats.deathsBreath = t - 5;
  return { gold, mats };
}

export function transmuteCost(): Cost {
  return { gold: 25000, mats: { deathsBreath: 3, crystal: 10, dust: 20 } };
}

export function extractCost(): Cost {
  return { gold: 10000, mats: { deathsBreath: 1, crystal: 5, dust: 5, scrap: 5 } };
}

export function reforgeCost(): Cost {
  return { gold: 50000, mats: { soul: 5, crystal: 15 } };
}

export function socketCost(item: Item): Cost {
  return { gold: 20000 + item.ilvl * 500, mats: { soul: 2, crystal: 10 } };
}

export function fuseCost(rank: number): Cost {
  return { gold: Math.round(500 * Math.pow(3, rank)), mats: {}, gems: undefined };
}

export function gemRemoveCost(rank: number): number {
  return Math.round(200 * Math.pow(2.5, rank));
}

export function canAfford(save: CharacterSave, cost: Cost): boolean {
  if (save.gold < cost.gold) return false;
  for (const [k, v] of Object.entries(cost.mats)) if ((save.materials[k as keyof Materials] ?? 0) < (v ?? 0)) return false;
  return true;
}

export function pay(save: CharacterSave, cost: Cost) {
  save.gold -= cost.gold;
  for (const [k, v] of Object.entries(cost.mats)) save.materials[k as keyof Materials] -= v ?? 0;
}

export function cubeUnlocked(save: CharacterSave, op: CubeOp): boolean {
  const f = CUBE_FUNCTIONS.find((c) => c.op === op)!;
  return save.cube.level >= f.unlock;
}

export function addCubeXp(save: CharacterSave, xp: number): number {
  let gained = 0;
  save.cube.xp += xp;
  while (save.cube.xp >= cubeXpToNext(save.cube.level)) {
    save.cube.xp -= cubeXpToNext(save.cube.level);
    save.cube.level++;
    gained++;
  }
  return gained;
}

export function canEnchantAffix(item: Item, idx: number): boolean {
  if (item.enchanted !== undefined && item.enchanted !== idx) return false;
  return idx >= 0 && idx < item.affixes.length && (item.rarity === 'rare' || item.rarity === 'legendary' || item.rarity === 'set' || item.rarity === 'magic');
}

/** Affix stats an enchant may roll for this item (excludes stats already present elsewhere on the item). */
export function enchantPool(item: Item, idx: number) {
  const target = item.affixes[idx];
  const others = new Set(item.affixes.filter((_, i) => i !== idx).map((a) => a.stat));
  const othersGroups = new Set(item.affixes.filter((_, i) => i !== idx).map((a) => AFFIX_BY_STAT[a.stat]?.group).filter(Boolean));
  return AFFIXES.filter((a) => a.primary === target.primary && a.ranges[item.kind] && !others.has(a.stat) && !(a.group && othersGroups.has(a.group)) && (a.weight > 0 || a.group === 'main'));
}

export function cubeSlotOf(powerId: string): CubeSlot {
  return LEGENDARIES[powerId].cubeSlot;
}

export function gemName(gem: string, rank: number): string {
  return `${GEM_RANKS[Math.min(GEM_RANKS.length - 1, rank - 1)]} ${GEMS[gem].name}`;
}

export function maxSockets(item: Item): number {
  return BASES[item.base].maxSockets;
}
