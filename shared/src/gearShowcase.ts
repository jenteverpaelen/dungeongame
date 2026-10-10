// Typical equipped loadouts per progress stage, for the gear-ladder gallery and the rank-ladder test.
// INFERRED, not measured: each stage follows the drop rules in shared/src/items.ts (ilvl = monster level; the rare
// weight grows with level; Legendary/Set ≈1.2% of items plus pity) and the reduced drop rates in BALANCE.md, so a
// level-40 hero has mostly rares and one Legendary, a level-70 hero a mix of rares, Legendaries and two Set pieces.
// Endgame stages add the progress only a long-time player has: full 6-piece Sets, Ancients, Cube upgrades, gems.
// Weapon / off-hand pairs are legal (a staff or a two-handed melee weapon leaves the off-hand empty).

import { CLASSES } from './data/classes';
import { BASES, LEGENDARIES, SETS } from './data/items';
import { generateItem } from './items';
import { Rng } from './math';
import type { ClassId, Item, Rarity, Slot } from './types';

export const SHOWCASE_STAGES = ['starter', 'L10', 'L20', 'L30', 'L40', 'L50', 'L60', 'L70', 'set', 'ancient', 'primal'] as const;
export type ShowcaseStage = typeof SHOWCASE_STAGES[number];

/** Class-typical bases per slot (the smart-loot affinity bases in data/items.ts). */
const BASE_OF: Record<ClassId, Partial<Record<Slot, string>>> = {
  warrior: { head: 'head_horned', shoulders: 'shoulders_spiked', chest: 'chest_plate', hands: 'hands_gauntlets', wrists: 'wrists_bracers', waist: 'waist_belt', legs: 'legs_plate', feet: 'feet_greaves', mainhand: 'sword', offhand: 'shield', neck: 'neck_amulet', ring1: 'ring', ring2: 'ring' },
  ranger: { head: 'head_hood', shoulders: 'shoulders_pads', chest: 'chest_leather', hands: 'hands_gloves', wrists: 'wrists_bracers', waist: 'waist_belt', legs: 'legs_leather', feet: 'feet_boots', mainhand: 'bow', offhand: 'quiver', neck: 'neck_amulet', ring1: 'ring', ring2: 'ring' },
  mage: { head: 'head_wizard', shoulders: 'shoulders_mantle', chest: 'chest_robe', hands: 'hands_wraps', wrists: 'wrists_bracers', waist: 'waist_sash', legs: 'legs_cloth', feet: 'feet_shoes', mainhand: 'wand', offhand: 'orb', neck: 'neck_amulet', ring1: 'ring', ring2: 'ring' },
};
/** Late weapons: the warrior's Whirlwind axe (matches the Endless Storm set), the mage's Meteor staff (Fallen Star). */
const LATE_WEAPON: Record<ClassId, { base: string; legendary: string; offhand: boolean }> = {
  warrior: { base: 'axe2h', legendary: 'ninefold_gale', offhand: false },
  ranger: { base: 'bow', legendary: 'thunderhead', offhand: true },
  mage: { base: 'staff', legendary: 'cindervane', offhand: false },
};
const SET_FOR: Record<ClassId, string> = { warrior: 'endless_storm', ranger: 'siegebreaker', mage: 'fallen_star' };
/** Slots in the order a levelling player fills them. */
const ORDER: Slot[] = ['mainhand', 'chest', 'legs', 'feet', 'offhand', 'head', 'shoulders', 'hands', 'waist', 'wrists', 'neck', 'ring1', 'ring2'];
interface StageSpec { ilvl: number; filled: number; late: boolean; plan: Rarity[] }
const LEVELLING: Partial<Record<ShowcaseStage, StageSpec>> = {
  L10: { ilvl: 9, filled: 9, late: false, plan: ['magic', 'normal', 'magic', 'normal', 'normal', 'magic', 'normal', 'magic', 'normal'] },
  L20: { ilvl: 19, filled: 11, late: false, plan: ['rare', 'magic', 'magic', 'magic', 'magic', 'rare', 'magic', 'normal', 'magic', 'normal', 'magic'] },
  L30: { ilvl: 29, filled: 12, late: false, plan: ['rare', 'rare', 'magic', 'rare', 'magic', 'rare', 'magic', 'rare', 'magic', 'magic', 'rare', 'magic'] },
  L40: { ilvl: 40, filled: 13, late: false, plan: ['legendary', 'rare', 'rare', 'magic', 'rare', 'rare', 'magic', 'rare', 'magic', 'rare', 'rare', 'magic', 'rare'] },
  L50: { ilvl: 50, filled: 13, late: true, plan: ['legendary', 'rare', 'rare', 'rare', 'legendary', 'rare', 'rare', 'rare', 'magic', 'rare', 'rare', 'rare', 'magic'] },
  L60: { ilvl: 60, filled: 13, late: true, plan: ['legendary', 'rare', 'legendary', 'rare', 'rare', 'rare', 'legendary', 'rare', 'rare', 'magic', 'rare', 'rare', 'rare'] },
  L70: { ilvl: 70, filled: 13, late: true, plan: ['legendary', 'set', 'rare', 'legendary', 'rare', 'set', 'rare', 'legendary', 'rare', 'rare', 'legendary', 'rare', 'rare'] },
};

function legendaryFor(cls: ClassId, slot: Slot, base: string): string | undefined {
  const kind = slot === 'mainhand' ? null : slot === 'ring1' || slot === 'ring2' ? 'ring' : slot;
  const list = Object.values(LEGENDARIES).filter((l) => (!l.classes || l.classes.includes(cls)) && (kind ? BASES[l.base].kind === kind : !!BASES[l.base].weapon));
  if (slot === 'ring2' && list.length > 1) return list[1].id;
  return (list.find((l) => l.base === base) ?? list[0])?.id;
}

function make(rng: Rng, cls: ClassId, slot: Slot, base: string, rarity: Rarity, ilvl: number, legendary?: string): Item {
  const set = SET_FOR[cls];
  if (rarity === 'set' && SETS[set].pieces.some((p) => p.base === base)) {
    return generateItem(rng, { ilvl, classId: cls, rarity: 'set', set, base, ancientAllowed: false, smartChance: 1 });
  }
  if (rarity === 'legendary' || rarity === 'set') {
    const id = legendary ?? legendaryFor(cls, slot, base);
    if (id) return generateItem(rng, { ilvl, classId: cls, rarity: 'legendary', legendary: id, ancientAllowed: false, smartChance: 1 });
    rarity = 'rare';
  }
  return generateItem(rng, { ilvl, classId: cls, rarity, base, ancientAllowed: false, smartChance: 1 });
}

/** Equipment for a class at a stage (deterministic for a seed). */
export function showcaseEquipment(cls: ClassId, stage: ShowcaseStage, seed = 1): Partial<Record<Slot, Item>> {
  const rng = new Rng(seed * 7919 + SHOWCASE_STAGES.indexOf(stage) * 104729 + cls.length * 31);
  const out: Partial<Record<Slot, Item>> = {};
  if (stage === 'starter') {
    const st = CLASSES[cls].starter;
    for (const [slot, base] of Object.entries(st) as [Slot, string][]) out[slot] = generateItem(rng, { ilvl: 1, classId: cls, rarity: 'normal', base });
    return out;
  }
  const spec = LEVELLING[stage];
  const late = spec ? spec.late : true;
  const weapon = late ? LATE_WEAPON[cls] : { base: BASE_OF[cls].mainhand!, legendary: undefined, offhand: true };
  const slots = ORDER.filter((s) => s !== 'offhand' || weapon.offhand);
  const baseFor = (slot: Slot) => (slot === 'mainhand' ? weapon.base : BASE_OF[cls][slot]!);
  if (spec) {
    slots.slice(0, spec.filled).forEach((slot, i) => {
      const rarity = spec.plan[i % spec.plan.length];
      const ilvl = spec.ilvl >= 70 ? 70 : spec.ilvl - (i % 3);
      out[slot] = make(rng, cls, slot, baseFor(slot), rarity, ilvl, slot === 'mainhand' && (rarity === 'legendary' || rarity === 'set') ? weapon.legendary : undefined);
    });
    return out;
  }
  // Endgame: the class Set on all six armour pieces, Legendaries elsewhere, then Ancients / Primals / upgrades / gems.
  for (const slot of slots) out[slot] = make(rng, cls, slot, baseFor(slot), 'set', 70, slot === 'mainhand' ? weapon.legendary : undefined);
  const upgrade = stage === 'set' ? [3, 5, 4, 6, 2, 4] : stage === 'ancient' ? [10, 8, 7, 9, 10, 7] : [10, 10, 10, 10, 10, 10];
  const ancientSlots: Slot[] = stage === 'ancient' ? ['mainhand', 'chest', 'head', 'shoulders', 'offhand', 'legs'] : stage === 'primal' ? ORDER : [];
  const primalSlots: Slot[] = stage === 'primal' ? ['mainhand', 'chest'] : [];
  slots.forEach((slot, i) => {
    const it = out[slot]!;
    it.upgrade = upgrade[i % upgrade.length];
    if (ancientSlots.includes(slot)) it.ancient = 1;
    if (primalSlots.includes(slot)) it.ancient = 2;
    const gemRank = stage === 'set' ? 4 : 6;
    if (slot === 'head' || slot === 'mainhand' || slot === 'chest') it.sockets = [{ gem: slot === 'head' ? 'diamond' : 'ruby', rank: gemRank }];
  });
  return out;
}
