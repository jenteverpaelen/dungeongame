// Item bases, affix pool, legendaries, sets and gems.
// Affix values are Diablo 3 Reaper of Souls level-70 ranges (non-ancient) unless noted.

import type { ClassId, Element, ItemKind, StatId } from '../types';
import type { SkillMods } from './skills';

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

// ─────────────────────────── Legendary powers ───────────────────────────

export type CubeSlot = 'weapon' | 'armor' | 'jewelry';

export interface LegendaryDef {
  id: string;
  name: string;
  base: string;
  classes?: ClassId[];
  /** Power text; {v} is replaced with the rolled value. */
  power: string;
  range: [number, number];
  cubeSlot: CubeSlot;
  flavor: string;
  colors: { primary: number; secondary: number; glow: number };
  skillEffect?: { skill: string; rolled: 'dmg' | 'cooldown'; mods?: SkillMods };
}

export const LEGENDARIES: Record<string, LegendaryDef> = {
  faultcleaver: {id:'faultcleaver',name:'Faultcleaver',base:'axe2h',classes:['warrior'],power:'Seismic Slam deals {v}% increased damage and costs 40% less Fury.',range:[150,200],cubeSlot:'weapon',flavor:'Its edge follows the seams beneath the earth.',colors:{primary:0x5b5045,secondary:0xdb9860,glow:0xffb369},skillEffect:{skill:'seismic_slam',rolled:'dmg',mods:{cost:-40}}},
  rainspindle: {id:'rainspindle',name:'Rainspindle',base:'bow',classes:['ranger'],power:'Rain of Vengeance cooldown is reduced by {v}% and its radius grows by 40%.',range:[30,40],cubeSlot:'weapon',flavor:'The string remembers every arrow still in the sky.',colors:{primary:0x384c59,secondary:0xaacacb,glow:0xb8e7f0},skillEffect:{skill:'rain_of_vengeance',rolled:'cooldown',mods:{radius:40}}},
  lanternroot: {id:'lanternroot',name:'Lanternroot',base:'staff',classes:['mage'],power:'Hydras deal {v}% increased damage. You may summon one additional Hydra.',range:[150,200],cubeSlot:'weapon',flavor:'A branch that taught its flames to keep watch.',colors:{primary:0x404a31,secondary:0xe6b45f,glow:0xf6cd7d},skillEffect:{skill:'hydra',rolled:'dmg',mods:{maxSummons:1}}},
  // Warrior
  ninefold_gale: { id: 'ninefold_gale', name: 'The Ninefold Gale', base: 'axe2h', classes: ['warrior'], power: 'Whirlwind always spawns Dust Devils, and Dust Devils deal {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: '"Nine storms bound in one edge. It hungers to spin."', colors: { primary: 0xb8c4cc, secondary: 0x6b8fa3, glow: 0x9fe3ff } },
  bloodwake: { id: 'bloodwake', name: 'Bloodwake', base: 'sword', classes: ['warrior'], power: "Rend's bleed deals {v}% increased damage.", range: [150, 200], cubeSlot: 'weapon', flavor: 'The blade weeps for every wound it opens.', colors: { primary: 0x9e1b1b, secondary: 0x3a0d0d, glow: 0xff3b3b } },
  eternal_gyre: { id: 'eternal_gyre', name: 'Girdle of the Eternal Gyre', base: 'waist_belt', classes: ['warrior'], power: 'Whirlwind costs {v}% less Fury, and you take 20% less damage while whirlwinding.', range: [40, 50], cubeSlot: 'armor', flavor: 'Buckled once, never unbuckled.', colors: { primary: 0x6d4c2f, secondary: 0xd4af37, glow: 0xffb347 } },
  anvil_vambraces: { id: 'anvil_vambraces', name: 'Vambraces of the Anvil', base: 'wrists_bracers', classes: ['warrior'], power: 'Stunned enemies take {v}% increased damage from you.', range: [25, 30], cubeSlot: 'armor', flavor: 'Struck a thousand times, they ring like bells.', colors: { primary: 0x5a5a66, secondary: 0xc9a227, glow: 0xffd27f } },
  last_light: { id: 'last_light', name: 'Bulwark of the Last Light', base: 'shield', classes: ['warrior'], power: 'Ground Stomp pulls in distant enemies and deals {v}% increased damage.', range: [200, 250], cubeSlot: 'armor', flavor: 'It held the gate when the gate itself fell.', colors: { primary: 0xd9c27a, secondary: 0xf5f0e0, glow: 0xfff3b0 } },
  // Ranger
  sappers_pack: { id: 'sappers_pack', name: "Sapper's Pack", base: 'quiver', classes: ['ranger'], power: 'You may have 2 additional Sentries, and Sentries deal {v}% increased damage.', range: [30, 40], cubeSlot: 'armor', flavor: 'Mostly gunpowder. Some arrows.', colors: { primary: 0x7a5230, secondary: 0xc9a227, glow: 0xffb347 } },
  gearwright_heart: { id: 'gearwright_heart', name: "Gearwright's Heart", base: 'chest_leather', classes: ['ranger'], power: 'Sentry cooldown is reduced by {v}%, and Sentries fire 50% faster.', range: [30, 40], cubeSlot: 'armor', flavor: 'Tick. Tick. Tick. Then everything is quiet.', colors: { primary: 0x6b4a2b, secondary: 0xb87333, glow: 0xffc06b } },
  thunderhead: { id: 'thunderhead', name: 'Thunderhead', base: 'bow', classes: ['ranger'], power: 'Multishot deals Lightning damage and {v}% increased damage.', range: [150, 200], cubeSlot: 'weapon', flavor: 'Its string hums before the storm breaks.', colors: { primary: 0x2c3e50, secondary: 0x7fd3ff, glow: 0x9fe3ff } },
  hunters_mark: { id: 'hunters_mark', name: "Hunter's Mark", base: 'handxbow', classes: ['ranger'], power: 'Hungering Arrow always pierces, and pierced enemies take {v}% increased damage for 3 seconds.', range: [15, 20], cubeSlot: 'weapon', flavor: 'Once marked, nothing hides.', colors: { primary: 0x3d2b1f, secondary: 0x8fd16a, glow: 0xb6ff8f } },
  // Mage
  cindervane: { id: 'cindervane', name: 'Cindervane', base: 'staff', classes: ['mage'], power: 'Meteor deals {v}% increased damage and its molten ground lasts twice as long.', range: [150, 200], cubeSlot: 'weapon', flavor: 'A splinter of a falling star, still burning.', colors: { primary: 0x4a2a1a, secondary: 0xff7a1a, glow: 0xff9a3c } },
  void_heart: { id: 'void_heart', name: 'Heart of the Void', base: 'orb', classes: ['mage'], power: 'Black Hole radius is increased by 30%, and enemies inside take {v}% increased damage.', range: [20, 25], cubeSlot: 'armor', flavor: 'Hold it close and hear nothing at all.', colors: { primary: 0x1b0f2e, secondary: 0x8e44ad, glow: 0xc39bff } },
  starfall_mantle: { id: 'starfall_mantle', name: 'Starfall Mantle', base: 'shoulders_mantle', classes: ['mage'], power: 'Meteor costs {v}% less Arcane Power and falls 50% faster.', range: [30, 40], cubeSlot: 'armor', flavor: 'Embroidered with constellations that no longer exist.', colors: { primary: 0x1f2a5a, secondary: 0xf5d76e, glow: 0xffe08a } },
  thousand_missiles: { id: 'thousand_missiles', name: 'Spindle of a Thousand Missiles', base: 'wand', classes: ['mage'], power: 'Magic Missile fires 2 additional missiles and deals {v}% increased damage.', range: [100, 150], cubeSlot: 'weapon', flavor: 'Point. Wish. Repeat.', colors: { primary: 0xe8e0ff, secondary: 0xb388ff, glow: 0xd6c2ff } },
  // Any class
  ouroboros_loop: { id: 'ouroboros_loop', name: 'Ouroboros Loop', base: 'ring', power: 'Gain a {v}% damage bonus to a single element that rotates every 4 seconds.', range: [150, 200], cubeSlot: 'jewelry', flavor: 'Fire becomes frost becomes storm becomes fire.', colors: { primary: 0xd4af37, secondary: 0x9fe3ff, glow: 0xffe08a } },
  patient_thief: { id: 'patient_thief', name: 'Seal of the Patient Thief', base: 'ring', power: 'Each resource-spending skill reduces your active cooldowns by {v} seconds.', range: [0.75, 1], cubeSlot: 'jewelry', flavor: 'Time is the only thing worth stealing.', colors: { primary: 0x1a1a1a, secondary: 0xc9a227, glow: 0xffd27f } },
  hellforge_talisman: { id: 'hellforge_talisman', name: 'Hellforge Talisman', base: 'neck_amulet', power: 'Killing an elite grants {v}% increased damage for 30 seconds.', range: [30, 40], cubeSlot: 'jewelry', flavor: 'Quenched in the blood of something that should not have died.', colors: { primary: 0x8b1e1e, secondary: 0xff7a1a, glow: 0xff5a36 } },
  witching_cord: { id: 'witching_cord', name: 'Witching Cord', base: 'waist_sash', power: 'Increases Critical Hit Damage by {v}% and attack speed by 7%.', range: [45, 50], cubeSlot: 'armor', flavor: 'Tied at midnight, untied at dawn.', colors: { primary: 0x2e1a3d, secondary: 0xb388ff, glow: 0xd6c2ff } },
  stridewind: { id: 'stridewind', name: 'Stridewind Greaves', base: 'feet_boots', power: 'Dash cooldown is reduced by 50%, and dashing grants {v}% increased damage for 3 seconds.', range: [40, 50], cubeSlot: 'armor', flavor: 'They have never once stood still.', colors: { primary: 0x2f4f4f, secondary: 0x9fe3ff, glow: 0xbdf6ff } },
  mountain_fists: { id: 'mountain_fists', name: 'Fists of the Mountain', base: 'hands_gauntlets', power: 'Area damage is increased by {v}% and attack speed by 15%.', range: [40, 50], cubeSlot: 'armor', flavor: 'Every blow is an avalanche.', colors: { primary: 0x6e5a48, secondary: 0xc9a227, glow: 0xffc06b } },
};

// ─────────────────────────── Sets ───────────────────────────

export interface SetDef {
  id: string;
  name: string;
  classId: ClassId;
  pieces: { base: string; name: string }[];
  bonuses: { count: number; text: string }[];
  colors: { primary: number; secondary: number; glow: number };
  effects?: {count:number; skills:string[]; mods?:SkillMods; multiplier?:number}[];
}

export const SETS: Record<string, SetDef> = {
  endless_storm: {
    id: 'endless_storm', name: 'Raiment of the Endless Storm', classId: 'warrior',
    pieces: [
      { base: 'head_horned', name: 'Stormcrown' }, { base: 'shoulders_spiked', name: 'Storm-Torn Mantle' },
      { base: 'chest_plate', name: 'Heart of the Gale' }, { base: 'hands_gauntlets', name: 'Gyrefists' },
      { base: 'legs_plate', name: 'Legplates of the Spiral' }, { base: 'feet_greaves', name: 'Eyewall Sabatons' },
    ],
    bonuses: [
      { count: 2, text: 'Whirlwind gains the effect of the Dust Devils rune.' },
      { count: 4, text: "You take 50% less damage while whirlwinding, and Whirlwind applies Rend's bleed, which deals 200% increased damage." },
      { count: 6, text: "Whirlwind, Dust Devils and Whirlwind's bleeds deal 5,000% increased damage." },
    ],
    colors: { primary: 0x4a5a6a, secondary: 0x9fe3ff, glow: 0x3cff6e },
  },
  siegebreaker: {
    id: 'siegebreaker', name: "Siegebreaker's Arsenal", classId: 'ranger',
    pieces: [
      { base: 'head_hood', name: "Siegebreaker's Cowl" }, { base: 'shoulders_pads', name: "Siegebreaker's Spaulders" },
      { base: 'chest_leather', name: "Siegebreaker's Brigandine" }, { base: 'hands_gloves', name: "Siegebreaker's Grips" },
      { base: 'legs_leather', name: "Siegebreaker's Breeches" }, { base: 'feet_boots', name: "Siegebreaker's Treads" },
    ],
    bonuses: [
      { count: 2, text: '+1 maximum Sentry, and Sentry cooldown is reduced by 30%.' },
      { count: 4, text: 'Your Sentries also cast your Multishot and Cluster Arrow.' },
      { count: 6, text: 'Sentries, Multishot and Cluster Arrow deal 250% increased damage for each active Sentry (max 4).' },
    ],
    colors: { primary: 0x3d4a2f, secondary: 0xc9a227, glow: 0x3cff6e },
  },
  fallen_star: {
    id: 'fallen_star', name: 'Regalia of the Fallen Star', classId: 'mage',
    pieces: [
      { base: 'head_wizard', name: 'Crown of the Fallen Star' }, { base: 'shoulders_mantle', name: 'Mantle of Burning Skies' },
      { base: 'chest_robe', name: 'Robes of the Comet' }, { base: 'hands_wraps', name: 'Starcaller Wraps' },
      { base: 'legs_cloth', name: 'Leggings of the Long Night' }, { base: 'feet_shoes', name: 'Ashwalker Slippers' },
    ],
    bonuses: [
      { count: 2, text: 'Meteor calls down a second meteor on a nearby enemy.' },
      { count: 4, text: 'Dealing Arcane, Cold, Fire or Lightning damage increases your damage by 50% for 8 seconds per element (max 4).' },
      { count: 6, text: 'Meteor deals 700% increased damage.' },
    ],
    colors: { primary: 0x23154a, secondary: 0xff9a3c, glow: 0x3cff6e },
  },
};

/** Authored alternative identities; inherited base geometry is original Hearthfall art. */
function alternativeSet(id:string,name:string,classId:ClassId,bases:string[],color:number,skills:string[],
  first:SkillMods,firstText:string,second:SkillMods,secondText:string,multiplier:number):SetDef {
  const parts=['Crown','Mantle','Vest','Grips','Legwraps','Treads'];
  return {id,name,classId,pieces:bases.map((base,i)=>({base,name:`${name} ${parts[i]}`})),
    colors:{primary:color,secondary:0xc6b88c,glow:0x3cff6e},
    bonuses:[{count:2,text:firstText},{count:4,text:secondText},{count:6,text:`${skills.map(s=>s.replaceAll('_',' ')).join(' and ')} deal ${(multiplier-1)*100}% increased damage.`}],
    effects:[{count:2,skills,mods:first},{count:4,skills,mods:second},{count:6,skills,multiplier}]};
}
const warriorBases=['head_horned','shoulders_spiked','chest_plate','hands_gauntlets','legs_plate','feet_greaves'];
const rangerBases=['head_hood','shoulders_pads','chest_leather','hands_gloves','legs_leather','feet_boots'];
const mageBases=['head_wizard','shoulders_mantle','chest_robe','hands_wraps','legs_cloth','feet_shoes'];
SETS.cinder_oath=alternativeSet('cinder_oath','Cinder Oath','warrior',warriorBases,0x773e35,['cleave','rend'],
  {radius:40},'Cleave and Rend reach 40% further.',{cost:-40},'Rend costs 40% less Fury.',127);
SETS.fault_warden=alternativeSet('fault_warden','Fault Warden','warrior',warriorBases,0x726549,['seismic_slam','ground_stomp'],
  {radius:40},'Seismic Slam and Ground Stomp have 40% increased radius.',{cooldown:-30},'Ground Stomp cooldown is reduced by 30%.',22);
SETS.farwatch=alternativeSet('farwatch','Farwatch','ranger',rangerBases,0x3a6170,['hungering_arrow','multishot'],
  {pierce:50},'Hungering Arrow gains 50% pierce chance.',{cost:-40},'Multishot costs 40% less Hatred.',30);
SETS.rainkeeper=alternativeSet('rainkeeper','Rainkeeper','ranger',rangerBases,0x64546c,['rain_of_vengeance','cluster_arrow'],
  {radius:40},'Rain of Vengeance and Cluster Arrow have 40% increased radius.',{cooldown:-30},'Rain of Vengeance cooldown is reduced by 30%.',30);
SETS.glass_concord=alternativeSet('glass_concord','Glass Concord','mage',mageBases,0x667996,['magic_missile','black_hole'],
  {dmg:40},'Magic Missile and Black Hole deal 40% increased damage.',{cooldown:-30},'Black Hole cooldown is reduced by 30%.',24);
SETS.lantern_garden=alternativeSet('lantern_garden','Lantern Garden','mage',mageBases,0x536745,['hydra','frost_nova'],
  {duration:40},'Hydras last 40% longer and Frost Nova freezes last 40% longer.',{cooldown:-30},'Frost Nova cooldown is reduced by 30%.',24);

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
