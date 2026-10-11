// Item bases, affix pool, legendaries, sets and gems.
// Affix values are Diablo 3 Reaper of Souls level-70 ranges (non-ancient) unless noted.

import type { ClassId, Element, ItemKind, StatId } from '../types';
import type { PowerEffect } from '../powers';
import { WARRIOR_LEGENDARIES, WARRIOR_SETS } from './powers/warrior';
import { RANGER_LEGENDARIES, RANGER_SETS } from './powers/ranger';
import { MAGE_LEGENDARIES, MAGE_SETS } from './powers/mage';
import { SHARED_LEGENDARIES } from './powers/shared';

// ─────────────────────────── Bases ───────────────────────────

export interface WeaponBase {
  aps: number; dmgMult: number; twoHanded: boolean; ranged: boolean;
  /** A two-handed ranged weapon that still takes no off-hand (staff, censer). */
  noOffhand?: boolean;
}

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
  // Tiers 1 and 2 were "Band" and "Signet"; those are now nouns of their own bases (ITEMS-SHARED.md §3.2).
  ring: { id: 'ring', kind: 'ring', noun: 'Ring', names: tiers(['Ring', 'Loop', 'Circle', 'Loop', 'Runic Ring', 'Starforged Ring']), shape: 'ring', maxSockets: 1, material: 'jewel' },
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
  staff: { id: 'staff', kind: 'weapon2h', noun: 'Staff', names: tiers(['Quarterstaff', 'Long Staff', 'War Staff', 'Elder Staff', 'Runic Staff', 'Starforged Staff']), shape: 'staff', weapon: { aps: 1.0, dmgMult: 1.75, twoHanded: true, ranged: true, noOffhand: true }, classes: ['mage'], maxSockets: 1, material: 'wood' },
  wand: { id: 'wand', kind: 'weapon1h', noun: 'Wand', names: tiers(['Wand', 'Bone Wand', 'Battle Wand', 'Grim Wand', 'Runic Wand', 'Starforged Wand']), shape: 'wand', weapon: { aps: 1.4, dmgMult: 1, twoHanded: false, ranged: true }, classes: ['mage'], maxSockets: 1, material: 'wood' },
  // Off-hands
  shield: { id: 'shield', kind: 'offhand', noun: 'Shield', names: tiers(['Buckler', 'Kite Shield', 'Tower Shield', 'Heater Shield', 'Runic Shield', 'Starforged Bulwark']), shape: 'shield', armorMult: 1.0, classes: ['warrior'], maxSockets: 0, material: 'metal' },
  quiver: { id: 'quiver', kind: 'offhand', noun: 'Quiver', names: tiers(['Quiver', 'Hunting Quiver', 'Battle Quiver', 'Bolt Case', 'Runic Quiver', 'Starforged Quiver']), shape: 'quiver', armorMult: 0.3, classes: ['ranger'], maxSockets: 0, material: 'leather' },
  orb: { id: 'orb', kind: 'offhand', noun: 'Orb', names: tiers(['Orb', 'Glass Orb', 'Arcane Sphere', 'Prism', 'Runic Orb', 'Starforged Orb']), shape: 'orb', armorMult: 0.3, classes: ['mage'], maxSockets: 0, material: 'arcane' },
  // ── Shared-items wave bases (ITEMS-SHARED.md §3), appended; `shape` is an existing look until gear-visuals v2 draws them ──
  legs_waders: { id: 'legs_waders', kind: 'legs', noun: 'Waders', names: armorNames('Waders'), shape: 'leather', armorMult: 0.78, affinity: ['ranger', 'mage'], maxSockets: 2, material: 'leather' },
  head_coif: { id: 'head_coif', kind: 'head', noun: "Coif", names: armorNames("Coif"), shape: 'hood', armorMult: 0.7, affinity: ['warrior', 'ranger'], maxSockets: 1, material: 'mail' },
  head_mask: { id: 'head_mask', kind: 'head', noun: "Mask", names: armorNames("Mask"), shape: 'cap', armorMult: 0.55, affinity: ['ranger'], maxSockets: 1, material: 'leather' },
  head_widebrim: { id: 'head_widebrim', kind: 'head', noun: "Wide-Brim Hat", names: armorNames("Wide-Brim Hat"), shape: 'cap', armorMult: 0.5, affinity: ['ranger', 'mage'], maxSockets: 1, material: 'cloth' },
  shoulders_furmantle: { id: 'shoulders_furmantle', kind: 'shoulders', noun: "Fur Mantle", names: armorNames("Fur Mantle"), shape: 'pads', armorMult: 0.6, affinity: ['ranger', 'warrior'], maxSockets: 0, material: 'leather' },
  shoulders_capelet: { id: 'shoulders_capelet', kind: 'shoulders', noun: "Capelet", names: armorNames("Capelet"), shape: 'mantle', armorMult: 0.5, affinity: ['mage'], maxSockets: 0, material: 'cloth' },
  chest_brigandine: { id: 'chest_brigandine', kind: 'chest', noun: "Brigandine", names: armorNames("Brigandine"), shape: 'leather', armorMult: 0.95, affinity: ['ranger', 'warrior'], maxSockets: 3, material: 'leather' },
  chest_vestment: { id: 'chest_vestment', kind: 'chest', noun: "Vestment", names: armorNames("Vestment"), shape: 'robe', armorMult: 0.72, affinity: ['mage'], maxSockets: 3, material: 'cloth' },
  chest_apron: { id: 'chest_apron', kind: 'chest', noun: "Smith's Apron", names: armorNames("Smith's Apron"), shape: 'leather', armorMult: 0.85, affinity: ['warrior'], maxSockets: 3, material: 'leather' },
  hands_mitts: { id: 'hands_mitts', kind: 'hands', noun: "Mitts", names: armorNames("Mitts"), shape: 'wraps', armorMult: 0.45, affinity: ['mage'], maxSockets: 0, material: 'cloth' },
  hands_fingerless: { id: 'hands_fingerless', kind: 'hands', noun: "Fingerless Gloves", names: armorNames("Fingerless Gloves"), shape: 'gloves', armorMult: 0.5, affinity: ['ranger'], maxSockets: 0, material: 'leather' },
  wrists_cuffs: { id: 'wrists_cuffs', kind: 'wrists', noun: "Cuffs", names: armorNames("Cuffs"), shape: 'bracers', armorMult: 0.4, affinity: ['mage'], maxSockets: 0, material: 'cloth' },
  wrists_vambraces: { id: 'wrists_vambraces', kind: 'wrists', noun: "Vambraces", names: armorNames("Vambraces"), shape: 'bracers', armorMult: 0.55, affinity: ['warrior'], maxSockets: 0, material: 'plate' },
  wrists_wraps: { id: 'wrists_wraps', kind: 'wrists', noun: "Arm Wraps", names: armorNames("Arm Wraps"), shape: 'bracers', armorMult: 0.42, affinity: ['ranger'], maxSockets: 0, material: 'leather' },
  waist_girdle: { id: 'waist_girdle', kind: 'waist', noun: "Girdle", names: armorNames("Girdle"), shape: 'belt', armorMult: 0.55, affinity: ['warrior'], maxSockets: 0, material: 'plate' },
  waist_cord: { id: 'waist_cord', kind: 'waist', noun: "Charm Cord", names: armorNames("Charm Cord"), shape: 'sash', armorMult: 0.38, affinity: ['mage', 'ranger'], maxSockets: 0, material: 'cloth' },
  legs_chaps: { id: 'legs_chaps', kind: 'legs', noun: "Chaps", names: armorNames("Chaps"), shape: 'leather', armorMult: 0.8, affinity: ['ranger'], maxSockets: 2, material: 'leather' },
  legs_tassets: { id: 'legs_tassets', kind: 'legs', noun: "Tassets", names: armorNames("Tassets"), shape: 'plate', armorMult: 0.95, affinity: ['warrior'], maxSockets: 2, material: 'mail' },
  feet_wraps: { id: 'feet_wraps', kind: 'feet', noun: "Foot Wraps", names: armorNames("Foot Wraps"), shape: 'shoes', armorMult: 0.4, affinity: ['mage'], maxSockets: 0, material: 'cloth' },
  feet_sandals: { id: 'feet_sandals', kind: 'feet', noun: "Sandals", names: armorNames("Sandals"), shape: 'shoes', armorMult: 0.42, affinity: ['ranger', 'mage'], maxSockets: 0, material: 'leather' },
  feet_clogs: { id: 'feet_clogs', kind: 'feet', noun: "Iron-Shod Clogs", names: armorNames("Iron-Shod Clogs"), shape: 'boots', armorMult: 0.6, affinity: ['warrior'], maxSockets: 0, material: 'metal' },
  neck_torc: { id: 'neck_torc', kind: 'neck', noun: 'Torc', names: tiers(["Torc","Twisted Torc","Banded Torc","Gilded Torc","Runic Torc","Starforged Torc"]), shape: 'amulet', maxSockets: 1, material: 'jewel' },
  neck_charm: { id: 'neck_charm', kind: 'neck', noun: 'Charm', names: tiers(["Charm","Carved Charm","Bone Charm","Warding Charm","Runic Charm","Starforged Charm"]), shape: 'amulet', maxSockets: 1, material: 'jewel' },
  neck_locket: { id: 'neck_locket', kind: 'neck', noun: 'Locket', names: tiers(["Locket","Brass Locket","Silver Locket","Engraved Locket","Runic Locket","Starforged Locket"]), shape: 'amulet', maxSockets: 1, material: 'jewel' },
  ring_band: { id: 'ring_band', kind: 'ring', noun: 'Band', names: tiers(["Plain Band","Wide Band","Banded Ring","Etched Band","Runic Band","Starforged Band"]), shape: 'ring', maxSockets: 1, material: 'jewel' },
  ring_signet: { id: 'ring_signet', kind: 'ring', noun: 'Signet', names: tiers(["Seal","Signet","Crest Ring","House Signet","Runic Signet","Starforged Signet"]), shape: 'ring', maxSockets: 1, material: 'jewel' },
  ring_coil: { id: 'ring_coil', kind: 'ring', noun: 'Coil', names: tiers(["Wire Coil","Copper Coil","Spiral","Double Coil","Runic Coil","Starforged Coil"]), shape: 'ring', maxSockets: 1, material: 'jewel' },
  cleaver: { id: 'cleaver', kind: 'weapon1h', noun: "Cleaver", names: tiers(["Chopper","Cleaver","Butcher's Blade","Broad Cleaver","Runic Cleaver","Starforged Cleaver"]), shape: 'axe', weapon: { aps: 1.25, dmgMult: 1.1, twoHanded: false, ranged: false }, classes: ['warrior'], maxSockets: 1, material: 'metal' },
  maul2h: { id: 'maul2h', kind: 'weapon2h', noun: "Maul", names: tiers(["Mallet","Maul","Great Maul","Kiln Hammer","Runic Maul","Starforged Maul"]), shape: 'axe2h', weapon: { aps: 1, dmgMult: 1.8, twoHanded: true, ranged: false }, classes: ['warrior'], maxSockets: 1, material: 'metal' },
  polearm: { id: 'polearm', kind: 'weapon2h', noun: "Polearm", names: tiers(["Pike","Bill","Glaive","Halberd","Runic Glaive","Starforged Halberd"]), shape: 'axe2h', weapon: { aps: 1.1, dmgMult: 1.65, twoHanded: true, ranged: false }, classes: ['warrior'], maxSockets: 1, material: 'metal' },
  sling: { id: 'sling', kind: 'weapon1h', noun: "Sling", names: tiers(["Sling","Leather Sling","Shot Sling","Staff-Sling","Runic Sling","Starforged Sling"]), shape: 'handxbow', weapon: { aps: 1.5, dmgMult: 0.85, twoHanded: false, ranged: true }, classes: ['ranger'], maxSockets: 1, material: 'leather' },
  longbow: { id: 'longbow', kind: 'weapon2h', noun: "Longbow", names: tiers(["Self Bow","Long Bow","War Bow","Yew Longbow","Runic Longbow","Starforged Longbow"]), shape: 'bow', weapon: { aps: 1.2, dmgMult: 1.45, twoHanded: true, ranged: true }, classes: ['ranger'], maxSockets: 1, material: 'wood' },
  rod: { id: 'rod', kind: 'weapon1h', noun: "Rod", names: tiers(["Rod","Iron Rod","Etched Rod","Lodestone Rod","Runic Rod","Starforged Rod"]), shape: 'wand', weapon: { aps: 1.2, dmgMult: 1.15, twoHanded: false, ranged: true }, classes: ['mage'], maxSockets: 1, material: 'metal' },
  sceptre: { id: 'sceptre', kind: 'weapon1h', noun: "Sceptre", names: tiers(["Baton","Sceptre","Crowned Sceptre","Orb Sceptre","Runic Sceptre","Starforged Sceptre"]), shape: 'wand', weapon: { aps: 1.3, dmgMult: 1.08, twoHanded: false, ranged: true }, classes: ['mage'], maxSockets: 1, material: 'metal' },
  censer: { id: 'censer', kind: 'weapon2h', noun: "Censer", names: tiers(["Censer","Chain Censer","Ember Censer","Lantern Censer","Runic Censer","Starforged Censer"]), shape: 'staff', weapon: { aps: 1.1, dmgMult: 1.65, twoHanded: true, ranged: true, noOffhand: true }, classes: ['mage'], maxSockets: 1, material: 'metal' },
  warhorn: { id: 'warhorn', kind: 'offhand', noun: "Warhorn", names: tiers(["Horn","Cow Horn","War Horn","Brass Horn","Runic Horn","Starforged Horn"]), shape: 'quiver', armorMult: 0.4, classes: ['warrior'], maxSockets: 0, material: 'metal' },
  trap_kit: { id: 'trap_kit', kind: 'offhand', noun: "Trap Kit", names: tiers(["Snare Bag","Trap Kit","Hook Pouch","Trapper's Kit","Runic Kit","Starforged Kit"]), shape: 'quiver', armorMult: 0.3, classes: ['ranger'], maxSockets: 0, material: 'leather' },
  tome: { id: 'tome', kind: 'offhand', noun: "Tome", names: tiers(["Notebook","Tome","Ledger of Stars","Grimoire","Runic Tome","Starforged Tome"]), shape: 'orb', armorMult: 0.3, classes: ['mage'], maxSockets: 0, material: 'leather' },
};

/** A two-handed weapon blocks the off-hand unless it is ranged (bows and crossbows take a quiver); staff and censer block. */
export const blocksOffhand = (b: BaseItem | undefined): boolean => !!b?.weapon?.twoHanded && (!b.weapon.ranged || !!b.weapon.noOffhand);

export const ARMOR_KINDS: ItemKind[] = ['head', 'shoulders', 'chest', 'hands', 'wrists', 'waist', 'legs', 'feet'];

// ─────────────────────────── Affixes ───────────────────────────

/** fixed: the same range at every item level (flat resource per kill). */
export type AffixScale = 'stat' | 'pct' | 'flat' | 'res' | 'fixed';

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
  /** Weapons and off-hands: only ranged weapons and the quiver (projectile affixes). */
  ranged?: true;
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
  { stat: 'chc', primary: true, ranges: { head: [4.5, 6], hands: [8, 10], neck: [8, 10], ring: [4.5, 6], wrists: [4.5, 6], offhand: [8, 10] }, weight: 10, scale: 'pct', label: (v) => `+${pctFmt(v)}% Critical Chance` },
  { stat: 'chd', primary: true, ranges: { hands: [45, 50], ring: [45, 50], neck: [80, 100], weapon1h: [45, 50] }, weight: 10, scale: 'pct', label: (v) => `+${pctFmt(v)}% Critical Damage` },
  { stat: 'ias', primary: true, ranges: { hands: [5, 7], ring: [5, 7], neck: [5, 7], weapon1h: [5, 7], weapon2h: [5, 7], offhand: [15, 20] }, weight: 9, scale: 'pct', label: (v) => `+${pctFmt(v)}% Attack Speed` },
  { stat: 'cdr', primary: true, ranges: { head: [5.5, 8], shoulders: [5.5, 8], hands: [5.5, 8], ring: [5, 8], neck: [5, 8], weapon1h: [5, 10], weapon2h: [5, 10], offhand: [5.5, 8] }, weight: 8, scale: 'pct', label: (v) => `−${pctFmt(v)}% Skill Cooldowns` },
  { stat: 'rcr', primary: true, ranges: { head: [4, 8], shoulders: [4, 8], hands: [4, 8], ring: [4, 8], neck: [4, 8], weapon1h: [4, 8], weapon2h: [4, 8], offhand: [4, 8] }, weight: 6, scale: 'pct', label: (v) => `−${pctFmt(v)}% Resource Costs` },
  { stat: 'area', primary: true, ranges: { hands: [16, 20], ring: [16, 20], neck: [16, 20], weapon1h: [16, 20], weapon2h: [16, 20], shoulders: [16, 20] }, weight: 8, scale: 'pct', label: (v) => `Hits splash ${pctFmt(v)}% damage around the target` },
  { stat: 'eleFire', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'ele', label: (v) => `+${pctFmt(v)}% Fire Damage` },
  { stat: 'eleCold', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'ele', label: (v) => `+${pctFmt(v)}% Cold Damage` },
  { stat: 'eleLightning', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'ele', label: (v) => `+${pctFmt(v)}% Lightning Damage` },
  { stat: 'elePhysical', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'ele', label: (v) => `+${pctFmt(v)}% Physical Damage` },
  { stat: 'eleArcane', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'ele', label: (v) => `+${pctFmt(v)}% Arcane Damage` },
  { stat: 'skillDmg', primary: true, ranges: { head: [10, 15], shoulders: [10, 15], chest: [10, 15], legs: [10, 15], feet: [10, 15], offhand: [10, 15] }, weight: 9, scale: 'pct', label: (v, p) => `Increases ${p ?? 'skill'} damage by ${pctFmt(v)}%` },
  { stat: 'weaponDmgPct', primary: true, ranges: { weapon1h: [7, 10], weapon2h: [7, 10] }, weight: 12, scale: 'pct', label: (v) => `+${pctFmt(v)}% Damage` },
  { stat: 'flatMin', primary: true, ranges: { ring: [84, 100], neck: [140, 168], offhand: [100, 140], weapon1h:[84,100], weapon2h:[140,168] }, weight: 8, scale: 'flat', group: 'flat', label: (v) => `+${intFmt(v)}-${intFmt(v * 2)} Damage` },
  { stat: 'lifePct', primary: true, ranges: { head: [10, 15], shoulders: [10, 15], chest: [10, 15], legs: [10, 15], neck: [14, 18], ring: [10, 15], offhand: [10, 15] }, weight: 7, scale: 'pct', label: (v) => `+${pctFmt(v)}% Life` },
  { stat: 'armor', primary: true, ranges: ALL_ARMOR([397, 465]), weight: 7, scale: 'res', label: (v) => `+${intFmt(v)} Armor` },
  { stat: 'allRes', primary: true, ranges: { ...ALL_ARMOR([91, 100]), neck: [91, 100], ring: [91, 100] }, weight: 7, scale: 'res', label: (v) => `+${intFmt(v)} All Resistance` },
  { stat: 'lifePerHit', primary: true, ranges: { weapon1h: [4000, 6000], weapon2h: [6000, 8000], hands: [3000, 4500], ring: [3000, 4500], neck: [3000, 4500], wrists: [3000, 4500], offhand: [3000, 4500] }, weight: 5, scale: 'flat', label: (v) => `Heal ${intFmt(v)} on Hit` },
  { stat: 'lifeRegen', primary: true, ranges: { chest: [2000, 4000], legs: [2000, 4000], ring: [2000, 4000], shoulders: [2000, 4000] }, weight: 4, scale: 'flat', label: (v) => `+${intFmt(v)} Life Regeneration` },
  { stat: 'ms', primary: true, ranges: { feet: [10, 12] }, weight: 14, scale: 'pct', label: (v) => `+${pctFmt(v)}% Movement Speed` },
  { stat: 'elite', primary: true, ranges: { weapon1h: [5, 8], weapon2h: [5, 8], neck: [5, 8], offhand: [5, 8] }, weight: 4, scale: 'pct', label: (v) => `+${pctFmt(v)}% Damage to Elites` },
  { stat: 'eliteDR', primary: true, ranges: { chest: [5, 7], shoulders: [5, 7], neck: [5, 7], offhand: [5, 7] }, weight: 3, scale: 'pct', label: (v) => `−${pctFmt(v)}% Damage from Elites` },
  // Secondary
  { stat: 'pickup', primary: false, ranges: { ...ALL_ARMOR([20, 40]), neck: [20, 40], ring: [20, 40] }, weight: 6, scale: 'flat', label: (v) => `+${intFmt(v)} Pickup Reach` },
  { stat: 'goldFind', primary: false, ranges: { ...ALL_ARMOR([15, 25]), neck: [15, 25], ring: [15, 25], weapon1h: [15, 25], weapon2h: [15, 25] }, weight: 6, scale: 'pct', label: (v) => `+${pctFmt(v)}% Gold from Enemies` },
  { stat: 'xpPct', primary: false, ranges: { ...ALL_ARMOR([4, 8]), neck: [4, 8], ring: [4, 8] }, weight: 5, scale: 'pct', label: (v) => `+${pctFmt(v)}% Experience from Kills` },
  { stat: 'thorns', primary: false, ranges: { ...ALL_ARMOR([1500, 2500]), offhand: [1500, 2500] }, weight: 5, scale: 'flat', label: (v) => `Strike back for ${intFmt(v)} when hit in melee` },
  { stat: 'lifePerKill', primary: false, ranges: { weapon1h: [5000, 8000], weapon2h: [6000, 10000], ...ALL_ARMOR([3000, 5000]) }, weight: 5, scale: 'flat', label: (v) => `Heal ${intFmt(v)} on Kill` },
  { stat: 'resourceRegen', primary: false, ranges: { head: [1, 2], neck: [1, 2], ring: [1, 2], offhand: [1, 2] }, weight: 4, scale: 'pct', label: (v) => `+${pctFmt(v)} Resource Regeneration per Second` },
  // ── Shared-items wave (ITEMS-SHARED.md §5): ranges and labels from the bible; weights [P] = the existing specialist
  //    band: 3 for primaries (element damage, eliteDR) and 4 for secondaries (resourceRegen), FOUNDATION.md §12. Appended: AFFIXES order is part of the RNG contract.
  { stat: 'dotDmg', primary: true, ranges: { neck: [15, 20], wrists: [15, 20], offhand: [15, 20] }, weight: 3, scale: 'pct', group: 'dot', label: (v) => `Damage-over-time effects you apply deal ${pctFmt(v)}% more damage` },
  { stat: 'summonDmg', primary: true, ranges: { head: [10, 15], shoulders: [10, 15], neck: [10, 15], offhand: [10, 15] }, weight: 3, scale: 'pct', label: (v) => `Your summons deal ${pctFmt(v)}% increased damage` },
  { stat: 'primaryDmg', primary: true, ranges: { weapon1h: [15, 20], weapon2h: [15, 20], hands: [15, 20], ring: [15, 20] }, weight: 3, scale: 'pct', label: (v) => `Your primary attack deals ${pctFmt(v)}% increased damage` },
  { stat: 'spenderDmg', primary: true, ranges: { chest: [8, 12], legs: [8, 12], ring: [8, 12] }, weight: 3, scale: 'pct', label: (v) => `Resource-spending skills deal ${pctFmt(v)}% increased damage` },
  { stat: 'cooldownDmg', primary: true, ranges: { head: [8, 12], shoulders: [8, 12], neck: [8, 12] }, weight: 3, scale: 'pct', label: (v) => `Skills with a cooldown deal ${pctFmt(v)}% increased damage` },
  { stat: 'vsControlled', primary: true, ranges: { weapon1h: [5, 8], weapon2h: [5, 8], neck: [5, 8] }, weight: 3, scale: 'pct', label: (v) => `Damage against stunned, frozen or immobilised enemies increased by ${pctFmt(v)}%` },
  { stat: 'areaRadius', primary: true, ranges: { head: [6, 10], shoulders: [6, 10], offhand: [6, 10] }, weight: 3, scale: 'pct', label: (v) => `Area skills have ${pctFmt(v)}% larger radius` },
  { stat: 'channelCost', primary: true, ranges: { hands: [10, 15], waist: [10, 15], offhand: [10, 15] }, weight: 3, scale: 'pct', label: (v) => `Channelled skills cost ${pctFmt(v)}% less` },
  { stat: 'ccDuration', primary: true, ranges: { hands: [8, 12], wrists: [8, 12], offhand: [8, 12] }, weight: 3, scale: 'pct', label: (v) => `Your stuns, freezes and immobilises last ${pctFmt(v)}% longer` },
  { stat: 'summonDuration', primary: true, ranges: { waist: [10, 15], feet: [10, 15] }, weight: 3, scale: 'pct', label: (v) => `Your summons last ${pctFmt(v)}% longer` },
  { stat: 'buffDuration', primary: true, ranges: { head: [10, 15], neck: [10, 15] }, weight: 3, scale: 'pct', label: (v) => `Your buffs last ${pctFmt(v)}% longer` },
  { stat: 'resourceOnKill', primary: true, ranges: { weapon1h: [2, 4], weapon2h: [2, 4], head: [2, 4], ring: [2, 4] }, weight: 3, scale: 'fixed', label: (v) => `+${intFmt(v)} resource per kill` },
  { stat: 'pierceChance', primary: true, ranges: { weapon1h: [8, 12], weapon2h: [8, 12], offhand: [8, 12], hands: [8, 12] }, weight: 3, scale: 'pct', ranged: true, label: (v) => `Projectiles have ${pctFmt(v)}% more chance to pierce` },
  { stat: 'meleeDR', primary: true, ranges: { shoulders: [4, 6], chest: [4, 6], offhand: [4, 6] }, weight: 3, scale: 'pct', group: 'dr', label: (v) => `Reduces damage from melee attacks by ${pctFmt(v)}%` },
  { stat: 'rangedDR', primary: true, ranges: { shoulders: [4, 6], chest: [4, 6], offhand: [4, 6] }, weight: 3, scale: 'pct', group: 'dr', label: (v) => `Reduces damage from ranged attacks by ${pctFmt(v)}%` },
  { stat: 'dashCdr', primary: true, ranges: { feet: [8, 12] }, weight: 3, scale: 'pct', label: (v) => `Dash cooldown reduced by ${pctFmt(v)}%` },
  { stat: 'ccReduction', primary: false, ranges: { head: [10, 20], shoulders: [10, 20], neck: [10, 20] }, weight: 4, scale: 'pct', label: (v) => `Reduces the duration of control effects on you by ${pctFmt(v)}%` },
  { stat: 'globeHeal', primary: false, ranges: { waist: [15, 25], legs: [15, 25], ring: [15, 25] }, weight: 4, scale: 'pct', label: (v) => `Mending orbs restore ${pctFmt(v)}% more Life` },
  { stat: 'globeChance', primary: false, ranges: { chest: [10, 20], legs: [10, 20], feet: [10, 20] }, weight: 4, scale: 'pct', label: (v) => `Elites have ${pctFmt(v)}% more chance to drop a mending orb` },
  { stat: 'moveWhileChannel', primary: false, ranges: { legs: [10, 15], feet: [10, 15] }, weight: 4, scale: 'pct', label: (v) => `+${pctFmt(v)}% movement speed while channeling` },
  { stat: 'lifeOnControl', primary: false, ranges: { hands: [2000, 3000], wrists: [2000, 3000] }, weight: 4, scale: 'flat', label: (v) => `Stunning, freezing or immobilising an enemy heals ${intFmt(v)} Life` },
  { stat: 'chillOnHit', primary: false, ranges: { weapon1h: [5, 10], weapon2h: [5, 10], hands: [5, 10] }, weight: 4, scale: 'pct', label: (v) => `${pctFmt(v)}% chance on hit to chill enemies for 1 s` },
];

/** Can this affix roll on this base? (kind range + the ranged-only rule). */
export const affixFits = (a: AffixDef, base: BaseItem): boolean =>
  !!a.ranges[base.kind] && (!a.ranged || (base.weapon ? base.weapon.ranged : base.kind !== 'offhand' || base.id === 'quiver'));

export const AFFIX_BY_STAT: Record<string, AffixDef> = Object.fromEntries(AFFIXES.map((a) => [a.stat, a]));

/** Main stat values grow quadratically with item level; percentage stats grow gently. */
export function affixScale(scale: AffixScale, ilvl: number): number {
  const t = Math.max(1, Math.min(70, ilvl)) / 70;
  switch (scale) {
    case 'stat': return Math.max(0.004, t * t);
    case 'flat': return Math.max(0.003, Math.pow(t, 2.4));
    case 'res': return Math.max(0.02, Math.pow(t, 1.6));
    case 'pct': return 0.35 + 0.65 * t;
    case 'fixed': return 1;
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
  /** false: Kanai's Cube cannot extract it (its cost is the slot it occupies, ITEMS-SHARED.md §1.3). */
  extractable?: false;
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
  /** Loadout the parity harness plays for this set (server/test/parity); default: the skills its top bonus names. */
  parityLoadout?: string[];
}

/** Historical registry order (loot rolls pick from `Object.values`, so this order is part of the RNG contract). */
export const LEGACY_LEGENDARY_ORDER = [
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

export const GEM_RANKS = ['Rough', 'Cut', 'Faceted', 'Polished', 'Brilliant', 'Sovereign']; // display names (NAME-REGISTER C); ranks are numbers in saves

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
  dotDmg: 'Festering', summonDmg: 'Shepherd’s', primaryDmg: 'Striking', spenderDmg: 'Spendthrift', cooldownDmg: 'Patient', vsControlled: 'Pinning',
  areaRadius: 'Broad', channelCost: 'Humming', ccDuration: 'Binding', summonDuration: 'Lingering', buffDuration: 'Lingering', resourceOnKill: 'Reaping',
  pierceChance: 'Piercing', meleeDR: 'Braced', rangedDR: 'Sheltered', dashCdr: 'Quick-footed',
};
export const MAGIC_SUFFIX: Partial<Record<StatId, string>> = {
  lifePerHit: 'of the Leech', lifeRegen: 'of Mending', goldFind: 'of Greed', xpPct: 'of Learning', pickup: 'of the Magpie',
  thorns: 'of Thorns', lifePerKill: 'of Feasting', rcr: 'of Thrift', eleFire: 'of Embers', eleCold: 'of Frost',
  eleLightning: 'of Storms', elePhysical: 'of Force', eleArcane: 'of the Arcane', skillDmg: 'of Mastery',
  ccReduction: 'of Composure', globeHeal: 'of Plenty', globeChance: 'of the Larder', moveWhileChannel: 'of Drifting', lifeOnControl: 'of Mercy', chillOnHit: 'of Rime',
};

export const ELEMENT_STAT: Record<Element, StatId | null> = {
  physical: 'elePhysical', fire: 'eleFire', cold: 'eleCold', lightning: 'eleLightning', poison: null, arcane: 'eleArcane', holy: null,
};
