// Item bases, affix pool, legendaries, sets and gems.
// Affix values are Diablo 3 Reaper of Souls level-70 ranges (non-ancient) unless noted.

import type { ClassId, Element, ItemKind, StatId } from '../types';
import type { PowerEffect } from '../powers';
import { WARRIOR_LEGENDARIES, WARRIOR_SETS } from './powers/warrior';
import { RANGER_LEGENDARIES, RANGER_SETS } from './powers/ranger';
import { MAGE_LEGENDARIES, MAGE_SETS } from './powers/mage';
import { SHARED_LEGENDARIES } from './powers/shared';

// ─────────────────────────── Bases ───────────────────────────

export interface WeaponBase { aps: number; dmgMult: number; twoHanded: boolean; ranged: boolean }

export interface BaseItem {
  id: string;
  kind: ItemKind;
  noun: string;
  /** Base names by item-level tier (0: 1-11, 1: 12-23, 2: 24-35, 3: 36-47, 4: 48-59, 5: 60-70). */
  names: string[];
  shape: string;
  weapon?: WeaponBase;
  armorMult?: number;
  classes?: ClassId[];
  /** Which classes favour this look when smart-loot picks a base. */
  affinity?: ClassId[];
  maxSockets: number;
  material: 'cloth' | 'leather' | 'mail' | 'plate' | 'metal' | 'wood' | 'jewel' | 'arcane';
}

const tiers = (a: string[]) => a;
const ARMOR_TIER = ['Worn', 'Sturdy', 'Reinforced', 'Masterwork', 'Runic', 'Starforged'];
const armorNames = (noun: string) => ARMOR_TIER.map((t) => `${t} ${noun}`);

export const BASES: Record<string, BaseItem> = {
  // Head
  head_cap: { id: 'head_cap', kind: 'head', noun: 'Cap', names: armorNames('Cap'), shape: 'cap', armorMult: 0.6, affinity: ['ranger'], maxSockets: 1, material: 'leather' },
  head_hood: { id: 'head_hood', kind: 'head', noun: 'Hood', names: armorNames('Hood'), shape: 'hood', armorMult: 0.6, affinity: ['ranger', 'mage'], maxSockets: 1, material: 'cloth' },
  head_helm: { id: 'head_helm', kind: 'head', noun: 'Helm', names: armorNames('Helm'), shape: 'helm', armorMult: 0.75, affinity: ['warrior'], maxSockets: 1, material: 'plate' },
  head_horned: { id: 'head_horned', kind: 'head', noun: 'Horned Helm', names: armorNames('Horned Helm'), shape: 'helm_horned', armorMult: 0.8, affinity: ['warrior'], maxSockets: 1, material: 'plate' },
  head_wizard: { id: 'head_wizard', kind: 'head', noun: 'Wizard Hat', names: armorNames('Pointed Hat'), shape: 'wizard_hat', armorMult: 0.55, affinity: ['mage'], maxSockets: 1, material: 'cloth' },
  head_circlet: { id: 'head_circlet', kind: 'head', noun: 'Circlet', names: armorNames('Circlet'), shape: 'circlet', armorMult: 0.5, affinity: ['mage', 'ranger'], maxSockets: 1, material: 'jewel' },
  // Shoulders
  shoulders_pads: { id: 'shoulders_pads', kind: 'shoulders', noun: 'Pauldrons', names: armorNames('Pauldrons'), shape: 'pads', armorMult: 0.6, affinity: ['ranger'], maxSockets: 0, material: 'leather' },
  shoulders_plate: { id: 'shoulders_plate', kind: 'shoulders', noun: 'Spaulders', names: armorNames('Spaulders'), shape: 'plate', armorMult: 0.7, affinity: ['warrior'], maxSockets: 0, material: 'plate' },
  shoulders_spiked: { id: 'shoulders_spiked', kind: 'shoulders', noun: 'Spiked Mantle', names: armorNames('Spiked Mantle'), shape: 'spiked', armorMult: 0.72, affinity: ['warrior'], maxSockets: 0, material: 'metal' },
  shoulders_mantle: { id: 'shoulders_mantle', kind: 'shoulders', noun: 'Mantle', names: armorNames('Mantle'), shape: 'mantle', armorMult: 0.55, affinity: ['mage'], maxSockets: 0, material: 'cloth' },
  // Chest
  chest_tunic: { id: 'chest_tunic', kind: 'chest', noun: 'Tunic', names: armorNames('Tunic'), shape: 'tunic', armorMult: 0.8, affinity: ['ranger', 'mage'], maxSockets: 3, material: 'cloth' },
  chest_leather: { id: 'chest_leather', kind: 'chest', noun: 'Jerkin', names: armorNames('Jerkin'), shape: 'leather', armorMult: 0.9, affinity: ['ranger'], maxSockets: 3, material: 'leather' },
  chest_mail: { id: 'chest_mail', kind: 'chest', noun: 'Hauberk', names: armorNames('Hauberk'), shape: 'mail', armorMult: 1.0, affinity: ['warrior', 'ranger'], maxSockets: 3, material: 'mail' },
  chest_plate: { id: 'chest_plate', kind: 'chest', noun: 'Breastplate', names: armorNames('Breastplate'), shape: 'plate', armorMult: 1.1, affinity: ['warrior'], maxSockets: 3, material: 'plate' },
  chest_robe: { id: 'chest_robe', kind: 'chest', noun: 'Robe', names: armorNames('Robe'), shape: 'robe', armorMult: 0.75, affinity: ['mage'], maxSockets: 3, material: 'cloth' },
  // Hands
  hands_gloves: { id: 'hands_gloves', kind: 'hands', noun: 'Gloves', names: armorNames('Gloves'), shape: 'gloves', armorMult: 0.5, affinity: ['ranger', 'mage'], maxSockets: 0, material: 'leather' },
  hands_gauntlets: { id: 'hands_gauntlets', kind: 'hands', noun: 'Gauntlets', names: armorNames('Gauntlets'), shape: 'gauntlets', armorMult: 0.6, affinity: ['warrior'], maxSockets: 0, material: 'plate' },
  hands_wraps: { id: 'hands_wraps', kind: 'hands', noun: 'Wraps', names: armorNames('Wraps'), shape: 'wraps', armorMult: 0.45, affinity: ['mage'], maxSockets: 0, material: 'cloth' },
  // Wrists / waist
  wrists_bracers: { id: 'wrists_bracers', kind: 'wrists', noun: 'Bracers', names: armorNames('Bracers'), shape: 'bracers', armorMult: 0.45, maxSockets: 0, material: 'leather' },
  waist_belt: { id: 'waist_belt', kind: 'waist', noun: 'Belt', names: armorNames('Belt'), shape: 'belt', armorMult: 0.45, affinity: ['warrior', 'ranger'], maxSockets: 0, material: 'leather' },
  waist_sash: { id: 'waist_sash', kind: 'waist', noun: 'Sash', names: armorNames('Sash'), shape: 'sash', armorMult: 0.4, affinity: ['mage'], maxSockets: 0, material: 'cloth' },
  // Legs
  legs_cloth: { id: 'legs_cloth', kind: 'legs', noun: 'Leggings', names: armorNames('Leggings'), shape: 'cloth', armorMult: 0.75, affinity: ['mage'], maxSockets: 2, material: 'cloth' },
  legs_leather: { id: 'legs_leather', kind: 'legs', noun: 'Breeches', names: armorNames('Breeches'), shape: 'leather', armorMult: 0.85, affinity: ['ranger'], maxSockets: 2, material: 'leather' },
  legs_plate: { id: 'legs_plate', kind: 'legs', noun: 'Greaves', names: armorNames('Legplates'), shape: 'plate', armorMult: 1.0, affinity: ['warrior'], maxSockets: 2, material: 'plate' },
  // Feet
  feet_shoes: { id: 'feet_shoes', kind: 'feet', noun: 'Shoes', names: armorNames('Slippers'), shape: 'shoes', armorMult: 0.45, affinity: ['mage'], maxSockets: 0, material: 'cloth' },
  feet_boots: { id: 'feet_boots', kind: 'feet', noun: 'Boots', names: armorNames('Boots'), shape: 'boots', armorMult: 0.55, affinity: ['ranger', 'warrior'], maxSockets: 0, material: 'leather' },
  feet_greaves: { id: 'feet_greaves', kind: 'feet', noun: 'Sabatons', names: armorNames('Sabatons'), shape: 'greaves', armorMult: 0.65, affinity: ['warrior'], maxSockets: 0, material: 'plate' },
  // Jewelry
  neck_amulet: { id: 'neck_amulet', kind: 'neck', noun: 'Amulet', names: tiers(['Amulet', 'Pendant', 'Talisman', 'Periapt', 'Runic Amulet', 'Starforged Amulet']), shape: 'amulet', maxSockets: 1, material: 'jewel' },
  ring: { id: 'ring', kind: 'ring', noun: 'Ring', names: tiers(['Ring', 'Band', 'Signet', 'Loop', 'Runic Ring', 'Starforged Ring']), shape: 'ring', maxSockets: 1, material: 'jewel' },
  // Warrior weapons
  sword: { id: 'sword', kind: 'weapon1h', noun: 'Sword', names: tiers(['Short Sword', 'Broad Sword', 'Long Sword', 'Falchion', 'Runic Blade', 'Starforged Blade']), shape: 'sword', weapon: { aps: 1.4, dmgMult: 1, twoHanded: false, ranged: false }, classes: ['warrior'], maxSockets: 1, material: 'metal' },
  axe: { id: 'axe', kind: 'weapon1h', noun: 'Axe', names: tiers(['Hand Axe', 'Hatchet', 'War Axe', 'Bearded Axe', 'Runic Axe', 'Starforged Axe']), shape: 'axe', weapon: { aps: 1.3, dmgMult: 1.06, twoHanded: false, ranged: false }, classes: ['warrior'], maxSockets: 1, material: 'metal' },
  mace: { id: 'mace', kind: 'weapon1h', noun: 'Mace', names: tiers(['Club', 'Spiked Club', 'Mace', 'Flanged Mace', 'Runic Mace', 'Starforged Mace']), shape: 'mace', weapon: { aps: 1.2, dmgMult: 1.14, twoHanded: false, ranged: false }, classes: ['warrior'], maxSockets: 1, material: 'metal' },
  sword2h: { id: 'sword2h', kind: 'weapon2h', noun: 'Greatsword', names: tiers(['Great Sword', 'Claymore', 'Zweihander', 'Executioner', 'Runic Greatsword', 'Starforged Greatsword']), shape: 'sword2h', weapon: { aps: 1.15, dmgMult: 1.6, twoHanded: true, ranged: false }, classes: ['warrior'], maxSockets: 1, material: 'metal' },
  axe2h: { id: 'axe2h', kind: 'weapon2h', noun: 'Great Axe', names: tiers(['Large Axe', 'Great Axe', 'Double Axe', 'Reaver', 'Runic Waraxe', 'Starforged Cleaver']), shape: 'axe2h', weapon: { aps: 1.1, dmgMult: 1.7, twoHanded: true, ranged: false }, classes: ['warrior'], maxSockets: 1, material: 'metal' },
  // Ranger weapons (ranged weapons accept a quiver)
  bow: { id: 'bow', kind: 'weapon2h', noun: 'Bow', names: tiers(['Short Bow', 'Hunting Bow', 'Long Bow', 'Composite Bow', 'Runic Bow', 'Starforged Bow']), shape: 'bow', weapon: { aps: 1.4, dmgMult: 1.25, twoHanded: true, ranged: true }, classes: ['ranger'], maxSockets: 1, material: 'wood' },
  crossbow: { id: 'crossbow', kind: 'weapon2h', noun: 'Crossbow', names: tiers(['Light Crossbow', 'Crossbow', 'Heavy Crossbow', 'Arbalest', 'Runic Crossbow', 'Starforged Arbalest']), shape: 'crossbow', weapon: { aps: 1.1, dmgMult: 1.6, twoHanded: true, ranged: true }, classes: ['ranger'], maxSockets: 1, material: 'wood' },
  handxbow: { id: 'handxbow', kind: 'weapon1h', noun: 'Hand Crossbow', names: tiers(['Hand Crossbow', 'Blade Crossbow', 'Bolt Pistol', 'Dart Thrower', 'Runic Repeater', 'Starforged Repeater']), shape: 'handxbow', weapon: { aps: 1.6, dmgMult: 0.9, twoHanded: false, ranged: true }, classes: ['ranger'], maxSockets: 1, material: 'wood' },
  // Mage weapons
  staff: { id: 'staff', kind: 'weapon2h', noun: 'Staff', names: tiers(['Quarterstaff', 'Long Staff', 'War Staff', 'Elder Staff', 'Runic Staff', 'Starforged Staff']), shape: 'staff', weapon: { aps: 1.0, dmgMult: 1.75, twoHanded: true, ranged: true }, classes: ['mage'], maxSockets: 1, material: 'wood' },
  wand: { id: 'wand', kind: 'weapon1h', noun: 'Wand', names: tiers(['Wand', 'Bone Wand', 'Battle Wand', 'Grim Wand', 'Runic Wand', 'Starforged Wand']), shape: 'wand', weapon: { aps: 1.4, dmgMult: 1, twoHanded: false, ranged: true }, classes: ['mage'], maxSockets: 1, material: 'wood' },
  // Off-hands
  shield: { id: 'shield', kind: 'offhand', noun: 'Shield', names: tiers(['Buckler', 'Kite Shield', 'Tower Shield', 'Heater Shield', 'Runic Shield', 'Starforged Bulwark']), shape: 'shield', armorMult: 1.0, classes: ['warrior'], maxSockets: 0, material: 'metal' },
  quiver: { id: 'quiver', kind: 'offhand', noun: 'Quiver', names: tiers(['Quiver', 'Hunting Quiver', 'Battle Quiver', 'Bolt Case', 'Runic Quiver', 'Starforged Quiver']), shape: 'quiver', armorMult: 0.3, classes: ['ranger'], maxSockets: 0, material: 'leather' },
  orb: { id: 'orb', kind: 'offhand', noun: 'Orb', names: tiers(['Orb', 'Glass Orb', 'Arcane Sphere', 'Prism', 'Runic Orb', 'Starforged Orb']), shape: 'orb', armorMult: 0.3, classes: ['mage'], maxSockets: 0, material: 'arcane' },
};

export const ARMOR_KINDS: ItemKind[] = ['head', 'shoulders', 'chest', 'hands', 'wrists', 'waist', 'legs', 'feet'];

// ─────────────────────────── Affixes ───────────────────────────

export type AffixScale = 'stat' | 'pct' | 'flat' | 'res';

export interface AffixDef {
  stat: StatId;
  primary: boolean;
  /** Item kinds this affix may roll on, with the level-70 [min, max] range for that kind. */
  ranges: Partial<Record<ItemKind, [number, number]>>;
  weight: number;
  scale: AffixScale;
  label: (v: number, param?: string) => string;
  /** Exclusive group: an item can roll only one affix per group. */
  group?: string;
}

const ALL_ARMOR = (r: [number, number]) => Object.fromEntries(ARMOR_KINDS.map((k) => [k, r])) as Partial<Record<ItemKind, [number, number]>>;
const MAIN_RANGES: Partial<Record<ItemKind, [number, number]>> = {
  ...ALL_ARMOR([626, 750]), neck: [626, 750], ring: [626, 750], weapon1h: [626, 750], weapon2h: [939, 1125], offhand: [626, 750],
};
const pctFmt = (v: number) => (Math.round(v * 10) / 10).toFixed(v < 10 && v % 1 ? 1 : v % 1 ? 1 : 0);
const intFmt = (v: number) => Math.round(v).toLocaleString('en-US');

export const AFFIXES: AffixDef[] = [
  // Primary
  { stat: 'str', primary: true, ranges: MAIN_RANGES, weight: 0, scale: 'stat', group: 'main', label: (v) => `+${intFmt(v)} Strength` },
  { stat: 'dex', primary: true, ranges: MAIN_RANGES, weight: 0, scale: 'stat', group: 'main', label: (v) => `+${intFmt(v)} Dexterity` },
  { stat: 'int', primary: true, ranges: MAIN_RANGES, weight: 0, scale: 'stat', group: 'main', label: (v) => `+${intFmt(v)} Intelligence` },
  { stat: 'vit', primary: true, ranges: MAIN_RANGES, weight: 10, scale: 'stat', label: (v) => `+${intFmt(v)} Vitality` },
  { stat: 'maxResource', primary: true, ranges: {head:[8,12],waist:[8,12],offhand:[8,12]}, weight:6, scale:'pct', label:v=>`+${pctFmt(v)} Maximum Resource` },
  { stat: 'chc', primary: true, ranges: { head: [4.5, 6], hands: [8, 10], neck: [8, 10], ring: [4.5, 6], wrists: [4.5, 6], offhand: [8, 10] }, weight: 10, scale: 'pct', label: (v) => `Critical Hit Chance Increased by ${pctFmt(v)}%` },
  { stat: 'chd', primary: true, ranges: { hands: [45, 50], ring: [45, 50], neck: [80, 100], weapon1h: [45, 50] }, weight: 10, scale: 'pct', label: (v) => `Critical Hit Damage Increased by ${pctFmt(v)}%` },
  { stat: 'ias', primary: true, ranges: { hands: [5, 7], ring: [5, 7], neck: [5, 7], weapon1h: [5, 7], weapon2h: [5, 7], offhand: [15, 20] }, weight: 9, scale: 'pct', label: (v) => `Attack Speed Increased by ${pctFmt(v)}%` },
  { stat: 'cdr', primary: true, ranges: { head: [5.5, 8], shoulders: [5.5, 8], hands: [5.5, 8], ring: [5, 8], neck: [5, 8], weapon1h: [5, 10], weapon2h: [5, 10], offhand: [5.5, 8] }, weight: 8, scale: 'pct', label: (v) => `Reduces cooldown of all skills by ${pctFmt(v)}%` },
  { stat: 'rcr', primary: true, ranges: { head: [4, 8], shoulders: [4, 8], hands: [4, 8], ring: [4, 8], neck: [4, 8], weapon1h: [4, 8], weapon2h: [4, 8], offhand: [4, 8] }, weight: 6, scale: 'pct', label: (v) => `Reduces all resource costs by ${pctFmt(v)}%` },
  { stat: 'area', primary: true, ranges: { hands: [16, 20], ring: [16, 20], neck: [16, 20], weapon1h: [16, 20], weapon2h: [16, 20], shoulders: [16, 20] }, weight: 8, scale: 'pct', label: (v) => `Chance to deal ${pctFmt(v)}% area damage on hit` },
  { stat: 'eleFire', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'ele', label: (v) => `Fire skills deal ${pctFmt(v)}% more damage` },
  { stat: 'eleCold', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'ele', label: (v) => `Cold skills deal ${pctFmt(v)}% more damage` },
  { stat: 'eleLightning', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'ele', label: (v) => `Lightning skills deal ${pctFmt(v)}% more damage` },
  { stat: 'elePhysical', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'ele', label: (v) => `Physical skills deal ${pctFmt(v)}% more damage` },
  { stat: 'eleArcane', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'ele', label: (v) => `Arcane skills deal ${pctFmt(v)}% more damage` },
  { stat: 'skillDmg', primary: true, ranges: { head: [10, 15], shoulders: [10, 15], chest: [10, 15], legs: [10, 15], feet: [10, 15], offhand: [10, 15] }, weight: 9, scale: 'pct', label: (v, p) => `Increases ${p ?? 'skill'} damage by ${pctFmt(v)}%` },
  { stat: 'weaponDmgPct', primary: true, ranges: { weapon1h: [7, 10], weapon2h: [7, 10] }, weight: 12, scale: 'pct', label: (v) => `+${pctFmt(v)}% Damage` },
  { stat: 'flatMin', primary: true, ranges: { ring: [84, 100], neck: [140, 168], offhand: [100, 140], weapon1h:[84,100], weapon2h:[140,168] }, weight: 8, scale: 'flat', group: 'flat', label: (v) => `+${intFmt(v)}-${intFmt(v * 2)} Damage` },
  { stat: 'lifePct', primary: true, ranges: { head: [10, 15], shoulders: [10, 15], chest: [10, 15], legs: [10, 15], neck: [14, 18], ring: [10, 15], offhand: [10, 15] }, weight: 7, scale: 'pct', label: (v) => `+${pctFmt(v)}% Life` },
  { stat: 'armor', primary: true, ranges: ALL_ARMOR([397, 465]), weight: 7, scale: 'res', label: (v) => `+${intFmt(v)} Armor` },
  { stat: 'allRes', primary: true, ranges: { ...ALL_ARMOR([91, 100]), neck: [91, 100], ring: [91, 100] }, weight: 7, scale: 'res', label: (v) => `+${intFmt(v)} Resistance to All Elements` },
  { stat: 'lifePerHit', primary: true, ranges: { weapon1h: [4000, 6000], weapon2h: [6000, 8000], hands: [3000, 4500], ring: [3000, 4500], neck: [3000, 4500], wrists: [3000, 4500], offhand: [3000, 4500] }, weight: 5, scale: 'flat', label: (v) => `+${intFmt(v)} Life per Hit` },
  { stat: 'lifeRegen', primary: true, ranges: { chest: [2000, 4000], legs: [2000, 4000], ring: [2000, 4000], shoulders: [2000, 4000] }, weight: 4, scale: 'flat', label: (v) => `Regenerates ${intFmt(v)} Life per Second` },
  { stat: 'ms', primary: true, ranges: { feet: [10, 12] }, weight: 14, scale: 'pct', label: (v) => `+${pctFmt(v)}% Movement Speed` },
  { stat: 'elite', primary: true, ranges: { weapon1h: [5, 8], weapon2h: [5, 8], neck: [5, 8], offhand: [5, 8] }, weight: 4, scale: 'pct', label: (v) => `Increases damage against elites by ${pctFmt(v)}%` },
  { stat: 'eliteDR', primary: true, ranges: { chest: [5, 7], shoulders: [5, 7], neck: [5, 7], offhand: [5, 7] }, weight: 3, scale: 'pct', label: (v) => `Reduces damage from elites by ${pctFmt(v)}%` },
  // Secondary
  { stat: 'pickup', primary: false, ranges: { ...ALL_ARMOR([20, 40]), neck: [20, 40], ring: [20, 40] }, weight: 6, scale: 'flat', label: (v) => `Increases Gold and Health pickup by ${intFmt(v)} units` },
  { stat: 'goldFind', primary: false, ranges: { ...ALL_ARMOR([15, 25]), neck: [15, 25], ring: [15, 25], weapon1h: [15, 25], weapon2h: [15, 25] }, weight: 6, scale: 'pct', label: (v) => `+${pctFmt(v)}% Extra Gold from Monsters` },
  { stat: 'xpPct', primary: false, ranges: { ...ALL_ARMOR([4, 8]), neck: [4, 8], ring: [4, 8] }, weight: 5, scale: 'pct', label: (v) => `Monster kills grant ${pctFmt(v)}% more experience` },
  { stat: 'thorns', primary: false, ranges: { ...ALL_ARMOR([1500, 2500]), offhand: [1500, 2500] }, weight: 5, scale: 'flat', label: (v) => `Melee attackers take ${intFmt(v)} damage per hit` },
  { stat: 'lifePerKill', primary: false, ranges: { weapon1h: [5000, 8000], weapon2h: [6000, 10000], ...ALL_ARMOR([3000, 5000]) }, weight: 5, scale: 'flat', label: (v) => `+${intFmt(v)} Life after each Kill` },
  { stat: 'resourceRegen', primary: false, ranges: { head: [1, 2], neck: [1, 2], ring: [1, 2], offhand: [1, 2] }, weight: 4, scale: 'pct', label: (v) => `+${pctFmt(v)} Resource Regeneration per Second` },
];

export const AFFIX_BY_STAT: Record<string, AffixDef> = Object.fromEntries(AFFIXES.map((a) => [a.stat, a]));

/** Main stat values grow quadratically with item level; percentage stats grow gently. */
export function affixScale(scale: AffixScale, ilvl: number): number {
  const t = Math.max(1, Math.min(70, ilvl)) / 70;
  switch (scale) {
    case 'stat': return Math.max(0.004, t * t);
    case 'flat': return Math.max(0.003, Math.pow(t, 2.4));
    case 'res': return Math.max(0.02, Math.pow(t, 1.6));
    case 'pct': return 0.35 + 0.65 * t;
  }
}

// ─────────────────────────── Legendary powers and sets ───────────────────────────
// Data lives per class in shared/src/data/powers/{warrior,ranger,mage,shared}.ts as power templates
// (shared/src/powers.ts); this file composes the registries in their historical order.

export type CubeSlot = 'weapon' | 'armor' | 'jewelry';

export interface LegendaryDef {
  id: string;
  name: string;
  base: string;
  classes?: ClassId[];
  /** Power text; {v} is replaced with the rolled value. Validated against `effects` (powerTextIssues). */
  power: string;
  range: [number, number];
  cubeSlot: CubeSlot;
  flavor: string;
  colors: { primary: number; secondary: number; glow: number };
  /** What the power does (power templates). `{ roll }` amounts use the rolled value (Cube: the maximum). */
  effects: PowerEffect[];
}

export interface SetDef {
  id: string;
  name: string;
  classId: ClassId;
  pieces: { base: string; name: string }[];
  /** Bonus thresholds: player text plus the power templates active from `count` equipped pieces. */
  bonuses: { count: number; text: string; effects?: PowerEffect[] }[];
  colors: { primary: number; secondary: number; glow: number };
}

/** Historical registry order (loot rolls pick from `Object.values`, so this order is part of the RNG contract). */
const LEGACY_LEGENDARY_ORDER = [
  'faultcleaver', 'rainspindle', 'lanternroot', 'ninefold_gale', 'bloodwake', 'eternal_gyre', 'anvil_vambraces', 'last_light',
  'sappers_pack', 'gearwright_heart', 'thunderhead', 'hunters_mark', 'cindervane', 'void_heart', 'starfall_mantle', 'thousand_missiles',
  'ouroboros_loop', 'patient_thief', 'hellforge_talisman', 'witching_cord', 'stridewind', 'mountain_fists',
];
const LEGACY_SET_ORDER = ['endless_storm', 'siegebreaker', 'fallen_star', 'cinder_oath', 'fault_warden', 'farwatch', 'rainkeeper', 'glass_concord', 'lantern_garden'];

/** Legacy ids first in their historical order, then every new id in class-file order (warrior, ranger, mage, shared). */
function compose<T extends { id: string }>(legacy: string[], lists: T[][]): Record<string, T> {
  const all = lists.flat();
  const byId = new Map(all.map((x) => [x.id, x]));
  const out: Record<string, T> = {};
  for (const id of legacy) { const x = byId.get(id); if (x) out[id] = x; }
  for (const x of all) if (!Object.hasOwn(out, x.id)) out[x.id] = x;
  return out;
}

export const LEGENDARIES: Record<string, LegendaryDef> = compose(LEGACY_LEGENDARY_ORDER, [WARRIOR_LEGENDARIES, RANGER_LEGENDARIES, MAGE_LEGENDARIES, SHARED_LEGENDARIES]);
export const SETS: Record<string, SetDef> = compose(LEGACY_SET_ORDER, [WARRIOR_SETS, RANGER_SETS, MAGE_SETS]);

// ─────────────────────────── Gems ───────────────────────────

export interface GemDef {
  id: string;
  name: string;
  color: number;
  weapon: { stat: StatId; values: number[] };
  head: { stat: StatId; values: number[] };
  armor: { stat: StatId; values: number[] };
}

export const GEM_RANKS = ['Chipped', 'Flawed', 'Regular', 'Flawless', 'Perfect', 'Royal'];

export const GEMS: Record<string, GemDef> = {
  pearlglass: {id:'pearlglass',name:'Pearlglass',color:0xabc6ce,weapon:{stat:'ias',values:[2,4,6,8,11,15]},head:{stat:'maxResource',values:[2,4,6,8,11,15]},armor:{stat:'resourceRegen',values:[0.2,0.4,0.6,0.8,1.1,1.5]}},
  ruby: { id: 'ruby', name: 'Ruby', color: 0xe0115f, weapon: { stat: 'weaponDmgPct', values: [2, 4, 6, 8, 11, 15] }, head: { stat: 'xpPct', values: [5, 10, 15, 20, 25, 31] }, armor: { stat: 'str', values: [3, 12, 35, 80, 160, 280] } },
  emerald: { id: 'emerald', name: 'Emerald', color: 0x2ecc71, weapon: { stat: 'chd', values: [10, 20, 35, 55, 85, 130] }, head: { stat: 'goldFind', values: [8, 14, 20, 26, 32, 41] }, armor: { stat: 'dex', values: [3, 12, 35, 80, 160, 280] } },
  topaz: { id: 'topaz', name: 'Topaz', color: 0xf1c40f, weapon: { stat: 'thorns', values: [10, 60, 300, 1200, 3000, 6000] }, head: { stat: 'pickup', values: [10, 15, 20, 25, 30, 40] }, armor: { stat: 'int', values: [3, 12, 35, 80, 160, 280] } },
  amethyst: { id: 'amethyst', name: 'Amethyst', color: 0x9b59b6, weapon: { stat: 'lifePerHit', values: [5, 50, 400, 1500, 4000, 10000] }, head: { stat: 'lifePct', values: [5, 7, 9, 11, 13, 15] }, armor: { stat: 'vit', values: [3, 12, 35, 80, 160, 280] } },
  diamond: { id: 'diamond', name: 'Diamond', color: 0xdff6ff, weapon: { stat: 'elite', values: [2, 4, 6, 8, 11, 15] }, head: { stat: 'cdr', values: [3, 4.5, 6, 8, 10, 12.5] }, armor: { stat: 'allRes', values: [3, 8, 18, 30, 60, 100] } },
};

export const GEM_IDS = Object.keys(GEMS);

// ─────────────────────────── Name parts ───────────────────────────

export const RARE_PREFIX = ['Grim', 'Doom', 'Storm', 'Blood', 'Ghoul', 'Bone', 'Dread', 'Rune', 'Wraith', 'Ash', 'Hollow', 'Sun', 'Night', 'Ember', 'Frost', 'Soul', 'Rot', 'Iron', 'Raven', 'Gale'];
export const RARE_SUFFIX: Record<string, string[]> = {
  head: ['Visage', 'Crown', 'Mask', 'Cowl', 'Brow', 'Casque'],
  shoulders: ['Mantle', 'Shoulders', 'Carapace', 'Burden'],
  chest: ['Shell', 'Heart', 'Hide', 'Coat', 'Bastion', 'Husk'],
  hands: ['Grip', 'Grasp', 'Fist', 'Touch', 'Claw'],
  wrists: ['Guard', 'Shackles', 'Cuffs', 'Wards'],
  waist: ['Cord', 'Clasp', 'Lash', 'Coil'],
  legs: ['Stride', 'Pillars', 'Legs', 'Tassets'],
  feet: ['Trek', 'Path', 'Stalkers', 'Strider', 'March'],
  neck: ['Charm', 'Eye', 'Heart', 'Collar', 'Torc'],
  ring: ['Loop', 'Coil', 'Spiral', 'Band', 'Circle', 'Knot'],
  weapon1h: ['Fang', 'Edge', 'Bite', 'Song', 'Thorn', 'Spike'],
  weapon2h: ['Reaver', 'Ruin', 'Breaker', 'Wrath', 'Toll', 'Howl'],
  offhand: ['Ward', 'Aegis', 'Mind', 'Focus', 'Bastion'],
};
export const MAGIC_PREFIX: Partial<Record<StatId, string>> = {
  str: 'Mighty', dex: 'Nimble', int: 'Wise', vit: 'Hale', chc: 'Keen', chd: 'Brutal', ias: 'Swift', cdr: 'Timeless',
  armor: 'Sturdy', allRes: 'Warded', lifePct: 'Stout', area: 'Sweeping', weaponDmgPct: 'Vicious', ms: 'Fleet', elite: 'Slayer’s',
};
export const MAGIC_SUFFIX: Partial<Record<StatId, string>> = {
  lifePerHit: 'of the Leech', lifeRegen: 'of Mending', goldFind: 'of Greed', xpPct: 'of Learning', pickup: 'of the Magpie',
  thorns: 'of Thorns', lifePerKill: 'of Feasting', rcr: 'of Thrift', eleFire: 'of Embers', eleCold: 'of Frost',
  eleLightning: 'of Storms', elePhysical: 'of Force', eleArcane: 'of the Arcane', skillDmg: 'of Mastery',
};

export const ELEMENT_STAT: Record<Element, StatId | null> = {
  physical: 'elePhysical', fire: 'eleFire', cold: 'eleCold', lightning: 'eleLightning', poison: null, arcane: 'eleArcane', holy: null,
};
