// Monster roster. Families map to code-drawn art (client/src/render/monsterArt.ts).
// Elite structure follows Diablo 3: Champion packs (blue), Rare + minions (yellow), Rift Guardians, Treasure Goblins.

import type { Element } from '../types';
import { DASH } from '../constants';

export type MonsterAttackKind = 'melee' | 'ranged' | 'fan' | 'fracture' | 'lob' | 'charge' | 'explode' | 'none';

export interface MonsterDef {
  id: string;
  name: string;
  family: 'slime' | 'mushroom' | 'bat' | 'moth' | 'beetle' | 'sprout' | 'crab' | 'boar' | 'shrimp' | 'goat' | 'golem' | 'imp' | 'skeleton' | 'cultist' | 'brute' | 'wisp' | 'goblin' | 'boss_slime' | 'boss_imp';
  hp: number;      // multiplier on base level HP
  dmg: number;     // multiplier on base level damage
  speed: number;   // units / second
  radius: number;
  attack: { kind: MonsterAttackKind; range: number; windupMs: number; cooldownMs: number; element: Element; projSpeed?: number; aoe?: number; flightMs?: number; chargeMs?: number };
  flying?: boolean;
  weight: number;  // spawn weight within its theme
  themes: string[];
  colors: { body: number; accent: number; eye: number };
  scale: number;
}

export const MONSTERS: Record<string, MonsterDef> = {
  // Glade (forest) theme
  bog_slime: { id: 'bog_slime', name: 'Bog Slime', family: 'slime', hp: 0.8, dmg: 0.8, speed: 105, radius: 18, attack: { kind: 'melee', range: 30, windupMs: 280, cooldownMs: 1100, element: 'poison' }, weight: 10, themes: ['glade'], colors: { body: 0x6fbf4a, accent: 0x3e7a2a, eye: 0x1a1a1a }, scale: 1 },
  gloomshroom: { id: 'gloomshroom', name: 'Gloomshroom', family: 'mushroom', hp: 1, dmg: 1, speed: 92, radius: 18, attack: { kind: 'melee', range: 32, windupMs: 320, cooldownMs: 1200, element: 'physical' }, weight: 9, themes: ['glade'], colors: { body: 0xf3e3c3, accent: 0x8e3fb0, eye: 0x1a1a1a }, scale: 1 },
  grave_bat: { id: 'grave_bat', name: 'Grave Bat', family: 'bat', hp: 0.5, dmg: 0.6, speed: 178, radius: 14, attack: { kind: 'melee', range: 26, windupMs: 200, cooldownMs: 900, element: 'physical' }, flying: true, weight: 6, themes: ['glade', 'ashen'], colors: { body: 0x4a3b5c, accent: 0xc0392b, eye: 0xffd23f }, scale: 1 },
  thornling: { id: 'thornling', name: 'Thornling', family: 'sprout', hp: 0.9, dmg: 0.9, speed: 70, radius: 16, attack: { kind: 'ranged', range: 380, windupMs: 450, cooldownMs: 2200, element: 'poison', projSpeed: 330 }, weight: 4, themes: ['glade'], colors: { body: 0x4f9a3a, accent: 0xe84a5f, eye: 0x1a1a1a }, scale: 1 },
  mossback: { id: 'mossback', name: 'Mossback Golem', family: 'golem', hp: 3.6, dmg: 2.2, speed: 72, radius: 32, attack: { kind: 'melee', range: 52, windupMs: 650, cooldownMs: 1800, element: 'physical', aoe: 70 }, weight: 2, themes: ['glade'], colors: { body: 0x7b8c6a, accent: 0x4f7a3a, eye: 0xffe066 }, scale: 1.5 },
  // Ashen (volcanic ruins) theme
  ember_imp: { id: 'ember_imp', name: 'Ember Imp', family: 'imp', hp: 0.7, dmg: 0.9, speed: 150, radius: 15, attack: { kind: 'melee', range: 28, windupMs: 220, cooldownMs: 950, element: 'fire' }, weight: 10, themes: ['ashen'], colors: { body: 0xd9482b, accent: 0x5a1a10, eye: 0xffe066 }, scale: 1 },
  bonewalker: { id: 'bonewalker', name: 'Bonewalker', family: 'skeleton', hp: 1, dmg: 1, speed: 96, radius: 17, attack: { kind: 'melee', range: 34, windupMs: 340, cooldownMs: 1200, element: 'physical' }, weight: 9, themes: ['ashen'], colors: { body: 0xe8e2d0, accent: 0x6b5a48, eye: 0xff5a36 }, scale: 1 },
  cinder_cultist: { id: 'cinder_cultist', name: 'Cinder Cultist', family: 'cultist', hp: 0.9, dmg: 1, speed: 80, radius: 16, attack: { kind: 'ranged', range: 400, windupMs: 500, cooldownMs: 2400, element: 'fire', projSpeed: 360 }, weight: 4, themes: ['ashen'], colors: { body: 0x5a1f2e, accent: 0xff7a1a, eye: 0xffe066 }, scale: 1 },
  magma_brute: { id: 'magma_brute', name: 'Magma Brute', family: 'brute', hp: 4, dmg: 2.5, speed: 68, radius: 34, attack: { kind: 'melee', range: 56, windupMs: 700, cooldownMs: 1900, element: 'fire', aoe: 80 }, weight: 2, themes: ['ashen'], colors: { body: 0x4a3a35, accent: 0xff7a1a, eye: 0xffe066 }, scale: 1.55 },
  ash_wisp: { id: 'ash_wisp', name: 'Ash Wisp', family: 'wisp', hp: 0.55, dmg: 1.6, speed: 140, radius: 13, attack: { kind: 'explode', range: 26, windupMs: 450, cooldownMs: 0, element: 'fire', aoe: 70 }, flying: true, weight: 4, themes: ['ashen', 'glade'], colors: { body: 0xd8d0ff, accent: 0x8e7bff, eye: 0x2a1a4a }, scale: 1 },
  // Specials
  treasure_goblin: { id: 'treasure_goblin', name: 'Treasure Goblin', family: 'goblin', hp: 7, dmg: 0, speed: 215, radius: 18, attack: { kind: 'none', range: 0, windupMs: 0, cooldownMs: 0, element: 'physical' }, weight: 0, themes: [], colors: { body: 0x7fae4a, accent: 0xd4af37, eye: 0xffe066 }, scale: 1.1 },
  gorgemaw: { id: 'gorgemaw', name: 'Gorgemaw, the Swelling', family: 'boss_slime', hp: 1, dmg: 3, speed: 85, radius: 60, attack: { kind: 'melee', range: 90, windupMs: 800, cooldownMs: 2200, element: 'poison', aoe: 140 }, weight: 0, themes: ['glade'], colors: { body: 0x5fae3a, accent: 0x2e5a1a, eye: 0xff3b3b }, scale: 1 },
  vexis: { id: 'vexis', name: 'Vexis the Ashen', family: 'boss_imp', hp: 1, dmg: 3, speed: 110, radius: 50, attack: { kind: 'melee', range: 80, windupMs: 700, cooldownMs: 2000, element: 'fire', aoe: 130 }, weight: 0, themes: ['ashen'], colors: { body: 0xb22d1a, accent: 0x2a0d08, eye: 0xffe066 }, scale: 1 },
};

// L90/D031: retain the existing ranged budget; only authored encounters opt in.
MONSTERS.reedclaw = {
  ...MONSTERS.thornling, id:'reedclaw', name:'Reedclaw', family:'crab', weight:0,
  colors:{...MONSTERS.mossback.colors},
  attack:{kind:'lob',range:MONSTERS.thornling.attack.range,windupMs:MONSTERS.thornling.attack.windupMs,
    cooldownMs:MONSTERS.thornling.attack.cooldownMs,element:'physical',aoe:75,flightMs:900},
};

// L97/D038: one authored replacement, inherited Mossback budget and bounded dash template.
MONSTERS.siltusk = {
  ...MONSTERS.mossback, id: 'siltusk', name: 'Siltusk', family: 'boar', weight: 0,
  attack: { kind: 'charge', range: DASH.distance, windupMs: MONSTERS.mossback.attack.windupMs,
    cooldownMs: MONSTERS.mossback.attack.cooldownMs, element: 'physical', chargeMs: DASH.durationMs },
};

export const RIFT_GUARDIANS: Record<string, string> = { glade: 'gorgemaw', ashen: 'vexis' };

// L109: authored-only variants. No changes to procedural spawn weights or old budgets.
MONSTERS.vault_moth={...MONSTERS.thornling,id:'vault_moth',name:'Vault Moth',family:'moth',weight:0,flying:true,
  colors:{...MONSTERS.grave_bat.colors},attack:{...MONSTERS.thornling.attack,kind:'fan',element:'arcane'}};
MONSTERS.flint_beetle={...MONSTERS.thornling,id:'flint_beetle',name:'Flint Beetle',family:'beetle',weight:0,
  colors:{...MONSTERS.mossback.colors},attack:{...MONSTERS.reedclaw.attack,kind:'fracture'}};
MONSTERS.kiln_heart={...MONSTERS.magma_brute,id:'kiln_heart',name:'Kiln Heart',weight:0};

// L117: authored-only combinations inherit existing body/attack budgets and palettes.
MONSTERS.brine_crab={...MONSTERS.reedclaw,id:'brine_crab',name:'Brineclaw',colors:{...MONSTERS.bonewalker.colors},attack:{...MONSTERS.reedclaw.attack,element:'cold'}};
MONSTERS.salt_guard={...MONSTERS.bonewalker,id:'salt_guard',name:'Saltbound Guard',weight:0,attack:{...MONSTERS.bonewalker.attack,element:'cold'}};
MONSTERS.ridge_harrier={...MONSTERS.vault_moth,id:'ridge_harrier',name:'Ridge Harrier',colors:{...MONSTERS.ash_wisp.colors},attack:{...MONSTERS.vault_moth.attack,element:'cold'}};
MONSTERS.signal_adept={...MONSTERS.cinder_cultist,id:'signal_adept',name:'Signal Adept',weight:0,colors:{...MONSTERS.ash_wisp.colors},attack:{...MONSTERS.cinder_cultist.attack,kind:'fracture',element:'lightning'}};
MONSTERS.cistern_heart={...MONSTERS.kiln_heart,id:'cistern_heart',name:'Cistern Heart',colors:{...MONSTERS.bonewalker.colors},attack:{...MONSTERS.kiln_heart.attack,element:'cold'}};
MONSTERS.signal_heart={...MONSTERS.kiln_heart,id:'signal_heart',name:'Signal Heart',colors:{...MONSTERS.ash_wisp.colors},attack:{...MONSTERS.kiln_heart.attack,element:'lightning'}};

// L120/D058: original regional bodies, inherited combat/footprint budgets; authored sites only.
MONSTERS.saltglass_skimmer={...MONSTERS.brine_crab,id:'saltglass_skimmer',name:'Saltglass Skimmer',family:'shrimp',weight:0};
MONSTERS.rimehorn={...MONSTERS.siltusk,id:'rimehorn',name:'Rimehorn',family:'goat',weight:0,colors:{...MONSTERS.bonewalker.colors}};

// Elite affixes (Diablo 3 names where generic; behaviour implemented in server/src/sim/elites.ts).
export interface EliteAffixDef { id: string; name: string; color: number; desc: string }
export const ELITE_AFFIXES: Record<string, EliteAffixDef> = {
  fast: { id: 'fast', name: 'Fast', color: 0xffffff, desc: 'Moves and attacks faster.' },
  extra_health: { id: 'extra_health', name: 'Extra Health', color: 0xffffff, desc: 'Has much more life.' },
  molten: { id: 'molten', name: 'Molten', color: 0xff7a1a, desc: 'Leaves a burning trail and explodes on death.' },
  frozen: { id: 'frozen', name: 'Frozen', color: 0x7fd3ff, desc: 'Summons ice orbs that explode and freeze.' },
  plagued: { id: 'plagued', name: 'Plagued', color: 0x8fd16a, desc: 'Creates pools of poison beneath you.' },
  electrified: { id: 'electrified', name: 'Electrified', color: 0xd6c2ff, desc: 'Releases sparks when hit.' },
  vortex: { id: 'vortex', name: 'Vortex', color: 0xc39bff, desc: 'Pulls you towards them.' },
  mortar: { id: 'mortar', name: 'Mortar', color: 0xff9a3c, desc: 'Lobs explosive shells at range.' },
  faulted: { id:'faulted',name:'Faulted',color:0xff9a3c,desc:'Marks three ground fractures in a fixed line. Step sideways before they erupt; solid cover blocks the line.' },
};

export const ELITE_PREFIX = ['Grim', 'Rot', 'Vile', 'Dread', 'Ashen', 'Blight', 'Gore', 'Hollow', 'Plague', 'Sorrow', 'Rage', 'Bone', 'Cinder', 'Gloom'];
export const ELITE_SUFFIX = ['heart', 'maw', 'claw', 'spawn', 'fang', 'shade', 'gut', 'thorn', 'hide', 'skull', 'bane', 'wing'];
