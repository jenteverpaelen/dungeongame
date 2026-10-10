import type { ClassId } from '../types';

export interface ResourceDef {
  id: string;
  name: string;
  max: number;
  regenPerSec: number;
  /** Fury-style decay when out of combat. */
  decayPerSec: number;
  color: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  title: string;
  mainStat: 'str' | 'dex' | 'int';
  resource: ResourceDef;
  /** Weapon base ids this class can wield (see data/items.ts). */
  weapons: string[];
  offhands: string[];
  primary: string;
  /** Auto-attack engagement range in world units. */
  attackRange: number;
  /** Starting base stats at level 1 (Diablo 3: main 10, vit 9, others 8). */
  base: { str: number; dex: number; int: number; vit: number };
  /** Per-level gains (Diablo 3: +3 main, +2 vit, +1 others). */
  perLevel: { str: number; dex: number; int: number; vit: number };
  /** Skin / hair defaults for the paper-doll renderer. */
  appearance: { skin: number; hair: number; hairStyle: string; eyes: number };
  /** Starter gear base ids. */
  starter: { mainhand: string; offhand?: string; chest: string; legs: string; feet: string };
  blurb: string;
  playstyle: string;
  signature: string;
  /** Stable skill identity for the signature glyph; independent of display wording. */
  signatureSkill: string;
  themeColor: number;
}

/** Untrusted wire/save values must not coerce to a key or name an inherited property. */
export function isClassId(value: unknown): value is ClassId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CLASSES, value);
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    title: 'Storm of Steel',
    mainStat: 'str',
    resource: { id: 'fury', name: 'Fury', max: 100, regenPerSec: 0, decayPerSec: 3, color: 0xd23a22 },
    weapons: ['sword', 'axe', 'mace', 'sword2h', 'axe2h'],
    offhands: ['shield'],
    primary: 'cleave',
    attackRange: 86,
    base: { str: 10, dex: 8, int: 8, vit: 9 },
    perLevel: { str: 3, dex: 1, int: 1, vit: 2 },
    appearance: { skin: 0xf2c9a0, hair: 0x6b3a1f, hairStyle: 'spiky', eyes: 0x1a1a1a },
    starter: { mainhand: 'sword', offhand: 'shield', chest: 'chest_plate', legs: 'legs_plate', feet: 'feet_boots' },
    blurb: 'A melee juggernaut who wades into the thickest packs. Hits build Fury; Fury fuels a spinning storm of steel.',
    playstyle: 'Melee · Fury builder/spender · Whirlwind & bleeds',
    signature: 'Whirlwind',
    signatureSkill: 'whirlwind',
    themeColor: 0xc0392b,
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    title: 'Siege Engineer',
    mainStat: 'dex',
    resource: { id: 'hatred', name: 'Hatred', max: 125, regenPerSec: 5, decayPerSec: 0, color: 0xb0204a },
    weapons: ['bow', 'crossbow', 'handxbow'],
    offhands: ['quiver'],
    primary: 'hungering_arrow',
    attackRange: 380,
    base: { str: 8, dex: 10, int: 8, vit: 9 },
    perLevel: { str: 1, dex: 3, int: 1, vit: 2 },
    appearance: { skin: 0xe8b98c, hair: 0x2b2b35, hairStyle: 'ponytail', eyes: 0x2a3b2a },
    starter: { mainhand: 'bow', offhand: 'quiver', chest: 'chest_leather', legs: 'legs_leather', feet: 'feet_boots' },
    blurb: 'A ranged tactician who fights alongside auto-firing sentries. Turrets do the killing while you reposition.',
    playstyle: 'Ranged · Sentries & projectiles · Hatred spender',
    signature: 'Sentry Turrets',
    signatureSkill: 'sentry',
    themeColor: 0x27ae60,
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    title: 'Fallen Star',
    mainStat: 'int',
    resource: { id: 'arcane', name: 'Arcane Power', max: 100, regenPerSec: 10, decayPerSec: 0, color: 0x3d6dff },
    weapons: ['staff', 'wand'],
    offhands: ['orb'],
    primary: 'magic_missile',
    attackRange: 380,
    base: { str: 8, dex: 8, int: 10, vit: 9 },
    perLevel: { str: 1, dex: 1, int: 3, vit: 2 },
    appearance: { skin: 0xf6d2b3, hair: 0xe9e4d8, hairStyle: 'long', eyes: 0x2b3a6b },
    starter: { mainhand: 'wand', offhand: 'orb', chest: 'chest_robe', legs: 'legs_cloth', feet: 'feet_shoes' },
    blurb: 'A glass-cannon caster who calls meteors down on packs gathered by black holes. Elements stack into devastation.',
    playstyle: 'Ranged caster · Meteor & control · Arcane Power',
    signature: 'Meteor',
    signatureSkill: 'meteor',
    themeColor: 0x2e86de,
  },
};

export const CLASS_IDS: ClassId[] = ['warrior', 'ranger', 'mage'];
