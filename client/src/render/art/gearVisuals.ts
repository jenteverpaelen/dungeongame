// Gear visual registry (docs/rework/gear/DESIGN-V2.md §4). DATA ONLY: content agents append a line here when they add
// a base shape, a legendary or a Set, and the parametric art (weaponArt.ts, gearDecor.ts, gearFx.ts) composes the look:
//   silhouette family (by base shape) × generation (item level) × rarity embellishment × signature / motif × effects.
// Nothing here is required: an unknown shape draws as the nearest family of its slot, an unlisted legendary gets the
// generic legendary treatment in its own colours, an unlisted Set gets a plain motif-less style.
// Every motif, signature, shape and colour is original to Hearthfall.

/** Ornament / particle languages shared by Sets, legendaries and their effects. */
export type Motif = 'wind' | 'cog' | 'star' | 'ember' | 'stone' | 'feather' | 'rain' | 'shard' | 'lantern'
  | 'blood' | 'holy' | 'void' | 'arcane' | 'storm' | 'frost' | 'leaf' | 'shadow' | 'flame' | 'gold'
  // planned by docs/rework/depth/ITEMS-SHARED.md §6 (draw as their nearest motif until they get generators)
  | 'banner' | 'furrow' | 'antler' | 'knot' | 'chime';

/** Silhouette families of held items. Each has one parametric drawing in weaponArt.ts that evolves over the seven
 *  generations; `rig` tells the animation which grip to use. */
export type WeaponFamily = 'blade' | 'greatblade' | 'axe' | 'greataxe' | 'mace' | 'bow' | 'crossbow' | 'handxbow' | 'staff' | 'wand'
  | 'shield' | 'quiver' | 'orb';

export interface FamilyInfo {
  family: WeaponFamily;
  /** Animation grip (player.ts weaponKind). */
  rig: '1h' | '2h' | 'bow' | 'xbow' | 'hxbow' | 'staff' | 'wand' | 'off';
  /** Drawn reach along the weapon (hand-local units, tip and the base of the striking part). */
  reach: { tip: number; base: number };
}

const F = (family: WeaponFamily, rig: FamilyInfo['rig'], tip: number, base: number): FamilyInfo => ({ family, rig, reach: { tip, base } });

/** Base shape → family. Existing shapes first; then the shapes planned in ITEMS-SHARED.md §3.3, mapped to the nearest
 *  family so a new base shows full progression on day one (give it its own family later if it needs one). */
export const SHAPE_FAMILY: Record<string, FamilyInfo> = {
  sword: F('blade', '1h', 31, 8), sword2h: F('greatblade', '2h', 48, 10), axe: F('axe', '1h', 27, 13), axe2h: F('greataxe', '2h', 50, 26),
  mace: F('mace', '1h', 27, 13), bow: F('bow', 'bow', 22, 14), crossbow: F('crossbow', 'xbow', 30, 20), handxbow: F('handxbow', 'hxbow', 17, 10),
  staff: F('staff', 'staff', 50, 38), wand: F('wand', 'wand', 20, 12), shield: F('shield', 'off', 0, 0), quiver: F('quiver', 'off', 0, 0), orb: F('orb', 'off', 0, 0),
  // The shared-items wave (claude/depth) gives its new bases EXISTING shapes (cleaver → 'axe', maul2h / polearm →
  // 'axe2h', longbow → 'bow', sling → 'handxbow', rod / sceptre → 'wand', censer → 'staff', warhorn / trap_kit →
  // 'quiver', tome → 'orb'; armour likewise), so they already draw through the families above. The keys below are
  // ready for when a base gets its own shape (a one-line content change in data/items.ts).
  cleaver: F('axe', '1h', 27, 13), maul2h: F('greataxe', '2h', 50, 26), polearm: F('greataxe', '2h', 50, 26), longbow: F('bow', 'bow', 22, 14),
  sling: F('handxbow', 'hxbow', 17, 10), sceptre: F('wand', 'wand', 20, 12), censer: F('staff', 'staff', 50, 38),
  warhorn: F('quiver', 'off', 0, 0), trap_kit: F('quiver', 'off', 0, 0), tome: F('orb', 'off', 0, 0),
};

/** Bespoke treatments a legendary can carry on top of its family (weaponArt.ts SIGNATURES). Each changes the
 *  silhouette (extra parts), the emissive layer, the floating pieces and the particle / trail language. */
export type Signature = 'gale' | 'fault' | 'flame' | 'storm' | 'blood' | 'rain' | 'lantern' | 'leaf' | 'void' | 'arcane' | 'holy' | 'cog' | 'frost' | 'star' | 'shadow' | 'gold';

/** Motif → the signature a legendary of that motif gets when it lists none. */
export const MOTIF_SIGNATURE: Record<Motif, Signature> = {
  wind: 'gale', stone: 'fault', ember: 'flame', flame: 'flame', storm: 'storm', blood: 'blood', rain: 'rain', lantern: 'lantern',
  leaf: 'leaf', void: 'void', arcane: 'arcane', holy: 'holy', cog: 'cog', frost: 'frost', star: 'star', shadow: 'shadow', gold: 'gold',
  feather: 'gale', shard: 'frost', banner: 'gold', furrow: 'fault', antler: 'leaf', knot: 'shadow', chime: 'arcane',
};

export interface LegendaryVisual {
  /** Particle / ornament language (also used on armour pieces). */
  motif: Motif;
  /** Weapon / off-hand treatment; defaults to MOTIF_SIGNATURE[motif]. */
  sig?: Signature;
  /** Fully bespoke weapon drawing in weaponArt.ts (`BESPOKE`), replacing the family drawing. */
  bespoke?: string;
}

/** Legendary id → visual. Append-only by convention; ids missing here draw as a generic legendary in their own colours. */
export const LEGENDARY_VISUAL: Record<string, LegendaryVisual> = {
  faultcleaver: { motif: 'stone' }, rainspindle: { motif: 'rain' }, lanternroot: { motif: 'lantern' },
  ninefold_gale: { motif: 'wind', bespoke: 'ninefold_gale' }, bloodwake: { motif: 'blood', bespoke: 'bloodwake' },
  eternal_gyre: { motif: 'wind' }, anvil_vambraces: { motif: 'gold' }, last_light: { motif: 'holy' }, sappers_pack: { motif: 'cog' },
  gearwright_heart: { motif: 'cog' }, thunderhead: { motif: 'storm' }, hunters_mark: { motif: 'leaf' },
  cindervane: { motif: 'flame', bespoke: 'cindervane' }, void_heart: { motif: 'void' }, starfall_mantle: { motif: 'star' },
  thousand_missiles: { motif: 'arcane' }, ouroboros_loop: { motif: 'gold' }, patient_thief: { motif: 'shadow' },
  hellforge_talisman: { motif: 'flame' }, witching_cord: { motif: 'arcane' }, stridewind: { motif: 'wind' }, mountain_fists: { motif: 'stone' },
  // shared-items wave (claude/depth, shared/src/data/powers/shared.ts): motifs from ITEMS-SHARED.md §6; Journeyman's
  // Ring is not in that table, 'gold' is a placeholder [P]
  patchwork_signet: { motif: 'gold' }, journeymans_ring: { motif: 'gold' }, watchkeepers_hood: { motif: 'shadow' },
  kilnwatch_spaulders: { motif: 'ember' }, hearthguard_coat: { motif: 'holy' }, ink_stained_gloves: { motif: 'shadow' },
  causeway_waders: { motif: 'shadow' }, ridgewalker_boots: { motif: 'wind' }, surveyors_plumb: { motif: 'shadow' },
  brine_tally: { motif: 'gold' }, signal_horn_charm: { motif: 'chime' }, lockglass_cincture: { motif: 'knot' },
  wardkeepers_cuffs: { motif: 'shadow' },
};

export interface SetStyle {
  motif: Motif;
  /** Emissive accent and the deep tone it sits on. */
  main: number;
  deep: number;
  /** Original description of the Set's signature (showcase card). */
  signature: string;
}

/** Set id → identity: one silhouette language each (crest, back piece at 6 pieces, orbit token, particles, footprints). */
export const SET_STYLE: Record<string, SetStyle> = {
  endless_storm: { motif: 'wind', main: 0x9fe3ff, deep: 0x2f5f7a, signature: 'Eyewall: cyclone wings, gale ribbons, dust-devil steps' },
  siegebreaker: { motif: 'cog', main: 0xffc94a, deep: 0x5a4a22, signature: 'Siege engine: brass cog halo, spark plumes, piston steps' },
  fallen_star: { motif: 'star', main: 0xffa14a, deep: 0x2a1858, signature: 'Comet: constellation wings, orbiting stars, stardust steps' },
  cinder_oath: { motif: 'ember', main: 0xff7a3a, deep: 0x4a1a12, signature: 'Oathfire: ember mantle, rising ash, burning steps' },
  fault_warden: { motif: 'stone', main: 0xffc47a, deep: 0x4a3a28, signature: 'Fault line: floating rock plates, orbiting shards, cracked steps' },
  farwatch: { motif: 'feather', main: 0x8fe0ff, deep: 0x1f4656, signature: 'Watchtower: hawk-feather wings, drifting plumes, feather steps' },
  rainkeeper: { motif: 'rain', main: 0xc9b8ff, deep: 0x3a2f4e, signature: 'Stormcloud: mist wings, a personal rain, ripple steps' },
  glass_concord: { motif: 'shard', main: 0xbfe6ff, deep: 0x34485e, signature: 'Prism: crystal wings, orbiting glass, refracting steps' },
  lantern_garden: { motif: 'lantern', main: 0xffd27a, deep: 0x2c4224, signature: 'Night garden: leaf wings, floating lanterns, blooming steps' },
};
