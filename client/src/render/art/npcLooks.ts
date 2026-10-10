// Townsfolk looks built on the unchanged hero rig (docs/rework/CAST.md): each person gets their own hair, skin,
// facial hair, face accessory, outfit colours, build and a role prop, so nobody reads as a hero clone. Keys are
// `zone/npcId` for named people, then role, then a deterministic fallback for unknown camp people.
import type { PlayerLook } from '@shared/protocol';
import type { ClassId, ItemLook } from '@shared/types';
import type { Body } from './gear';
import type { NpcBodyLook } from './player';

export type NpcIdle = 'hammer' | 'craft' | 'flourish' | 'tally' | 'call' | 'pray' | 'none';
export interface NpcPreset {
  look: NpcBodyLook;
  /** Role line under the name on the plate (CAST "name on plate" stays the data name). */
  title?: string;
  /** Overall size: children ~0.78, broad smiths ~1.08. */
  scale?: number;
  idle?: NpcIdle;
  /** Resting yaw in degrees (0 = facing the camera, +90 = profile to the right). */
  facing?: number;
}

const I = (shape: string, primary: number, secondary: number, variant = 0): ItemLook => ({ shape, primary, secondary, glow: 0, variant } as ItemLook);
type Slots = PlayerLook['slots'];
const SKIN = { fair: 0xf6d6bc, light: 0xefc6a2, warm: 0xe0aa7e, tan: 0xc68c60, brown: 0x9a6342, deep: 0x6c4230 };
const HAIR = { black: 0x26212a, dark: 0x3d2b22, brown: 0x5e3a24, chestnut: 0x7d4a26, auburn: 0xa4492a, ginger: 0xc8682e, blond: 0xd8b56a, sandy: 0xe2c890, ash: 0x9c9384, grey: 0xb5b0a6, white: 0xece6da, silver: 0xc9ced6 };
const EYES = { dark: 0x1a1a1a, brown: 0x3a2414, green: 0x2a4a2a, blue: 0x2b3e6b, grey: 0x46504e };

function person(cls: ClassId, body: Omit<Body, 'cls'>, slots: Slots, extra: Omit<NpcPreset, 'look'> = {}): NpcPreset {
  return { look: { classId: cls, slots, npc: body }, ...extra };
}

/** Named people and the town's service folk. */
export const NPC_PRESETS: Record<string, NpcPreset> = {
  // ── Hearthmere services (plate shows the role name; CAST.md)
  'hearthmere/blacksmith': person('warrior', { skin: SKIN.warm, hair: HAIR.dark, hairStyle: 'none', eyes: EYES.dark, beard: 'braided', beardColor: HAIR.auburn, face: 'goggles' }, {
    chest: I('leather', 0x5c3a22, 0x8a6a3a), legs: I('cloth', 0x3a3a3c, 0x4b4940), feet: I('boots', 0x3a2a1e, 0x6a5a48), hands: I('gloves', 0x6a4a2e, 0x4f3c2b),
    mainhand: I('hammer', 0x8a9296, 0x5a4a3a),
  }, { title: 'Blacksmith', scale: 1.1, idle: 'hammer', facing: -40 }),
  'hearthmere/jeweler': person('ranger', { skin: SKIN.fair, hair: HAIR.silver, hairStyle: 'short', eyes: EYES.blue, face: 'monocle', beard: 'moustache', beardColor: HAIR.silver }, {
    chest: I('tunic', 0x5a2a4a, 0xd8b54a), legs: I('cloth', 0x2e2a36, 0x4a3e52), feet: I('shoes', 0x2a2020, 0xd8b54a), hands: I('gloves', 0xeee8dc, 0xc8c0b0),
    offhand: I('gem', 0x6fe0d0, 0xffffff),
  }, { title: 'Jeweler', scale: 0.9, idle: 'flourish', facing: 25 }),
  'hearthmere/mystic': person('mage', { skin: SKIN.light, hair: HAIR.silver, hairStyle: 'long', eyes: EYES.green }, {
    head: I('hood', 0x4a3a66, 0xc9a85e, 2), chest: I('robe', 0x3e3058, 0xc9a85e, 2), feet: I('shoes', 0x2e2638, 0x8a7aa8), offhand: I('orb', 0xb89cff, 0xe8d8ff, 2),
  }, { title: 'Mystic', idle: 'craft', facing: 20 }),
  // ── Field contacts (CAST.md "Named people")
  'rillwake_crossing/tender': person('warrior', { skin: SKIN.warm, hair: HAIR.brown, hairStyle: 'short', eyes: EYES.brown, beard: 'stubble' }, {
    head: I('cap', 0x4a3a2a, 0xb8402a), chest: I('leather', 0x7a5a3a, 0x5a4030), legs: I('cloth', 0x3a4048, 0x2e3238), feet: I('boots', 0x4a3426, 0x7a6a4a),
  }, { title: 'Mill Tender', scale: 1.05, facing: 20 }),
  'cairnspill_terraces/surveyor': person('ranger', { skin: SKIN.light, hair: HAIR.ash, hairStyle: 'short', eyes: EYES.grey }, {
    head: I('cap', 0x8a8478, 0x5a5448), chest: I('leather', 0x8a8a80, 0x5a5a50), legs: I('cloth', 0x5a5448, 0x3a3630), feet: I('boots', 0x4a4038, 0x7a6a58), mainhand: I('chalk', 0xd8c8a0, 0x8a4a2a),
  }, { title: 'Surveyor', scale: 1.04, facing: 30 }),
  'cinderwash_kilns/firekeeper': person('mage', { skin: SKIN.light, hair: HAIR.auburn, hairStyle: 'braid', eyes: EYES.green, face: 'goggles' }, {
    chest: I('tunic', 0x8a4a2a, 0x3a2a20), legs: I('cloth', 0x3a3430, 0x2a2420), feet: I('boots', 0x2e2622, 0x5a4a3e), hands: I('gauntlets', 0x6a4a2e, 0x4a3426), offhand: I('book', 0x2a2420, 0x8a6a3a),
  }, { title: 'Firekeeper', scale: 0.92, facing: 15 }),
  'kilnwatch_crown/watchkeeper': person('warrior', { skin: SKIN.tan, hair: HAIR.grey, hairStyle: 'balding', eyes: EYES.dark, beard: 'stubble', beardColor: HAIR.grey }, {
    chest: I('leather', 0x3a4a5a, 0xd8b54a), legs: I('cloth', 0x2e3440, 0x5a5040), feet: I('boots', 0x2a2420, 0x6a5a48), mainhand: I('poker', 0x4a4a4e, 0x2a2420), offhand: I('tin', 0xb8402a, 0xd8b54a),
  }, { title: 'Watchkeeper', scale: 1.08, facing: 20 }),
  'sablefen_causeway/ferrier': person('ranger', { skin: SKIN.tan, hair: HAIR.sandy, hairStyle: 'curly', eyes: EYES.blue }, {
    chest: I('leather', 0xe8c03a, 0x8a6a2a), legs: I('cloth', 0x3a5060, 0x2a3a48), waist: I('belt', 0xc8b08a, 0x8a7a5a), mainhand: I('pole', 0x8a6a42, 0xc8b08a),
  }, { title: 'Ferrier', facing: 25 }),
  'saltwind_pans/briner': person('mage', { skin: SKIN.fair, hair: HAIR.grey, hairStyle: 'bun', eyes: EYES.grey, face: 'spectacles' }, {
    chest: I('tunic', 0xece6d6, 0x8a8a80), legs: I('cloth', 0x5a5a60, 0x3a3a40), feet: I('shoes', 0x3a3430, 0x8a8a80), mainhand: I('rake', 0x8a8a90, 0x5a4a3a), offhand: I('slate', 0x2e3436, 0x8a6a42),
  }, { title: 'Brine Keeper', scale: 0.95, facing: 20 }),
  'lockglass_cistern/lockkeeper': person('mage', { skin: SKIN.fair, hair: HAIR.silver, hairStyle: 'cropped', eyes: EYES.blue }, {
    shoulders: I('mantle', 0x1f5a5a, 0x7ab8b0), chest: I('robe', 0x24504e, 0x7ab8b0), feet: I('shoes', 0x1e2a2a, 0x4a6a68),
  }, { title: 'Cistern Keeper', scale: 1.05, facing: 10 }),
  'shiverline_escarpment/lookout': person('ranger', { skin: SKIN.light, hair: HAIR.ginger, hairStyle: 'spiky', eyes: EYES.green }, {
    shoulders: I('mantle', 0x3f6a3a, 0x8a6a3a), chest: I('tunic', 0x5a6a4a, 0x8a6a3a), hands: I('wraps', 0xb84a3a, 0x3a5a8a), feet: I('boots', 0x3a3026, 0x6a5a48), offhand: I('flag', 0xd8a83a, 0xb8402a),
  }, { title: 'Ridge Lookout', scale: 0.96, facing: 25 }),
  'beaconbreak_ward/quartermaster': person('warrior', { skin: SKIN.brown, hair: HAIR.black, hairStyle: 'bun', eyes: EYES.brown }, {
    chest: I('tunic', 0x3a3a48, 0xb8302a), waist: I('sash', 0xb8302a, 0xe0b050), legs: I('cloth', 0x2e2e38, 0x4a4a58), feet: I('boots', 0x2a2420, 0x6a5a48), offhand: I('slate', 0xc8a050, 0x6a4a2a),
  }, { title: 'Quartermaster', scale: 1.02, idle: 'tally', facing: 20 }),
  'hollowstar_array/west_reader': person('mage', { skin: SKIN.fair, hair: HAIR.dark, hairStyle: 'long', eyes: EYES.grey }, {
    head: I('circlet', 0xb87a3a, 0xc88a4a), shoulders: I('mantle', 0xb8a0d8, 0xe8d8ff), chest: I('robe', 0x8a7aa8, 0xd8c8f0),
  }, { title: 'Western Reader', scale: 0.95, facing: 30 }),
  'hollowstar_array/east_reader': person('warrior', { skin: SKIN.tan, hair: HAIR.black, hairStyle: 'cropped', eyes: EYES.dark, beard: 'stubble', beardColor: HAIR.black }, {
    chest: I('tunic', 0x6a6a6a, 0x3a3a3a), legs: I('cloth', 0x3a3a40, 0x2a2a30), feet: I('boots', 0x2a2420, 0x5a4a3e), hands: I('wraps', 0x8a7a6a, 0x5a4a3a),
  }, { title: 'Eastern Reader', scale: 1.06, facing: -20 }),
};

/** Ambient townsfolk (visual only; barks.ts keys). */
export const RESIDENT_PRESETS: Record<string, NpcPreset> = {
  clerk: person('warrior', { skin: SKIN.tan, hair: HAIR.grey, hairStyle: 'balding', eyes: EYES.brown, face: 'spectacles' }, {
    chest: I('tunic', 0x4a5a6a, 0xb8a070), legs: I('cloth', 0x3a3a40, 0x2a2a30), feet: I('shoes', 0x2a2420, 0x6a5a48), offhand: I('book', 0x6a2a2a, 0xd8b54a),
  }, { title: 'Vault Clerk', idle: 'tally', facing: 20 }),
  innkeeper: person('warrior', { skin: SKIN.warm, hair: HAIR.chestnut, hairStyle: 'balding', eyes: EYES.brown, beard: 'moustache', beardColor: HAIR.chestnut }, {
    chest: I('tunic', 0xe6dcc6, 0x8a5a3a), legs: I('cloth', 0x5a4030, 0x3a2a20), feet: I('shoes', 0x3a2a20, 0x6a5040), offhand: I('mug', 0x9a6a3a, 0x6a4a2a),
  }, { title: 'Innkeeper', scale: 1.06, facing: 20 }),
  bard: person('ranger', { skin: SKIN.brown, hair: HAIR.black, hairStyle: 'curly', eyes: EYES.brown }, {
    head: I('cap', 0x8a2a3a, 0xe8d8a0, 1), chest: I('tunic', 0x2a6a5a, 0xd8b54a), legs: I('cloth', 0x5a3a5a, 0x3a2a3a), feet: I('boots', 0x3a2a20, 0x8a6a3a), offhand: I('lute', 0xa8703a, 0xd8b54a),
  }, { title: 'Bard', idle: 'call', facing: 15 }),
  guard: person('warrior', { skin: SKIN.tan, hair: HAIR.dark, hairStyle: 'cropped', eyes: EYES.dark }, {
    head: I('helm', 0x8a9298, 0x6a4a2a, 1), chest: I('mail', 0x7a8288, 0x8a2a2a), legs: I('cloth', 0x3a3a3c, 0x2a2a2c), feet: I('boots', 0x2a2420, 0x6a5a48), mainhand: I('spear', 0x9aa4ac, 0x8a2a2a),
  }, { title: 'Gate Guard', scale: 1.04, facing: 10 }),
  fisher: person('warrior', { skin: SKIN.warm, hair: HAIR.ginger, hairStyle: 'short', eyes: EYES.blue, beard: 'full', beardColor: HAIR.ginger }, {
    head: I('cap', 0x3a4a5a, 0x2a3440), chest: I('leather', 0x4a5a4a, 0x3a4a3a), legs: I('cloth', 0x3a3a40, 0x2a2a30), feet: I('boots', 0x2a2a2a, 0x4a4a4a), mainhand: I('rod', 0x7a5a3a, 0x3a2a20),
  }, { title: 'Fisher', facing: 160 }),
  child: person('ranger', { skin: SKIN.light, hair: HAIR.auburn, hairStyle: 'curly', eyes: EYES.green }, {
    chest: I('tunic', 0x6a8ad8, 0xe8e0c8), legs: I('cloth', 0x5a4a3a, 0x3a2a20), feet: I('shoes', 0x5a3a2a, 0x8a6a4a),
  }, { title: 'Child', scale: 0.78 }),
  porter: person('warrior', { skin: SKIN.deep, hair: HAIR.black, hairStyle: 'short', eyes: EYES.dark, beard: 'goatee', beardColor: HAIR.black }, {
    chest: I('leather', 0x6a5038, 0x827454), legs: I('cloth', 0x4a4038, 0x2a2420), feet: I('boots', 0x3a2a20, 0x6a5a48), offhand: I('basket', 0xb08a52, 0x6a5038),
  }, { title: 'Porter', scale: 1.02 }),
  worker: person('ranger', { skin: SKIN.fair, hair: HAIR.blond, hairStyle: 'braid', eyes: EYES.blue }, {
    chest: I('tunic', 0x5a4a3a, 0xc8a050), legs: I('cloth', 0x3a3430, 0x2a2420), feet: I('boots', 0x3a2a20, 0x6a5a48), offhand: I('lantern', 0x3a3430, 0xc8a050),
  }, { title: 'Lamplighter' }),
  merchant: person('warrior', { skin: SKIN.tan, hair: HAIR.black, hairStyle: 'short', eyes: EYES.brown, beard: 'goatee', beardColor: HAIR.black }, {
    head: I('cap', 0x6a4a2a, 0xc0392b, 1), chest: I('leather', 0x7a5230, 0xd4b13a), legs: I('cloth', 0x4a5a6a, 0x3a3a3a), feet: I('boots', 0x5c3d24, 0x8b6a45), offhand: I('scroll', 0xefe2bf, 0xb8402a),
  }, { title: 'Merchant', facing: 20 }),
  scholar: person('mage', { skin: SKIN.deep, hair: HAIR.grey, hairStyle: 'short', eyes: EYES.brown, face: 'spectacles', beard: 'goatee', beardColor: HAIR.grey }, {
    chest: I('robe', 0x2e3a5a, 0xa89060), feet: I('shoes', 0x2a2420, 0x6a5a48), offhand: I('book', 0x2a4a6a, 0xd8b54a),
  }, { title: 'Scholar', idle: 'tally', facing: 20 }),
  pilgrim: person('mage', { skin: SKIN.warm, hair: HAIR.ash, hairStyle: 'none', eyes: EYES.grey }, {
    head: I('hood', 0xb8a888, 0x8a6a3a), chest: I('robe', 0xc8b898, 0x8a6a3a), feet: I('shoes', 0x5a4a3a, 0x8a6a3a), mainhand: I('staff', 0x8a6a3a, 0xd8c8a0),
  }, { title: 'Pilgrim', idle: 'pray', facing: 160 }),
  keeper: person('mage', { skin: SKIN.brown, hair: HAIR.white, hairStyle: 'bun', eyes: EYES.brown }, {
    chest: I('robe', 0xeae4d8, 0x3f9a7a), feet: I('shoes', 0x5a4a3a, 0x3f9a7a), offhand: I('book', 0x3f6a5a, 0xd8b54a),
  }, { title: 'Shrine Keeper', idle: 'pray', facing: 20 }),
  carpenter: person('warrior', { skin: SKIN.tan, hair: HAIR.chestnut, hairStyle: 'short', eyes: EYES.brown, beard: 'stubble' }, {
    chest: I('tunic', 0x6a6a5a, 0x8a6a3a), legs: I('cloth', 0x4a4038, 0x3a3028), feet: I('boots', 0x3a2a20, 0x6a5a48), mainhand: I('hammer', 0x7a8288, 0x5a4a3a),
  }, { title: 'Carpenter', idle: 'craft', facing: 30 }),
};

const ROLE_FALLBACK: Record<string, string> = { vendor: 'merchant', healer: 'keeper' };
const SKINS = Object.values(SKIN), HAIRS = Object.values(HAIR);
const STYLES = ['short', 'bun', 'curly', 'braid', 'cropped', 'balding', 'ponytail'];
const SHIRTS = [0x6a5038, 0x4a5a4a, 0x5a4a6a, 0x7a4a3a, 0x3a5060, 0x8a7a50, 0x5a6a3a];

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

/** Preset for a named person, a role, or a stable generated look for anyone else (camp people, new contacts). */
export function npcPreset(zone: string | undefined, id: string | undefined, role: string, name: string): NpcPreset {
  const named = zone && id ? NPC_PRESETS[`${zone}/${id}`] : undefined;
  if (named) return named;
  const resident = RESIDENT_PRESETS[role] ?? RESIDENT_PRESETS[ROLE_FALLBACK[role] ?? ''];
  if (resident) return resident;
  const h = hash(`${zone}/${id}/${name}`);
  const pick = <T,>(a: T[], k: number) => a[(h >>> k) % a.length];
  const shirt = pick(SHIRTS, 3);
  return person((['warrior', 'ranger', 'mage'] as const)[h % 3], { skin: pick(SKINS, 5), hair: pick(HAIRS, 8), hairStyle: pick(STYLES, 11), eyes: EYES.dark, beard: h % 5 === 0 ? 'stubble' : h % 7 === 0 ? 'full' : undefined }, {
    chest: I(h % 2 ? 'tunic' : 'leather', shirt, 0x8a6a3a), legs: I('cloth', 0x3a3a40, 0x2a2a30), feet: I('boots', 0x3a2a20, 0x6a5a48),
    ...(h % 3 === 0 ? { head: I('cap', 0x5a4a3a, 0x8a3a2a) } : {}),
  }, { facing: 20 });
}
