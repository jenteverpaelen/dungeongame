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
  sling: F('handxbow', 'hxbow', 17, 10), rod: F('wand', 'wand', 20, 12), sceptre: F('wand', 'wand', 20, 12), censer: F('staff', 'staff', 50, 38),
  warhorn: F('quiver', 'off', 0, 0), trap_kit: F('quiver', 'off', 0, 0), tome: F('orb', 'off', 0, 0),
};

/** Each family's own (legacy) shape: the rig's poses, reach, off-hand placement and the previous drawings branch on these. */
export const FAMILY_SHAPE: Readonly<Record<WeaponFamily, string>> = {
  blade: 'sword', greatblade: 'sword2h', axe: 'axe', greataxe: 'axe2h', mace: 'mace', bow: 'bow', crossbow: 'crossbow',
  handxbow: 'handxbow', staff: 'staff', wand: 'wand', shield: 'shield', quiver: 'quiver', orb: 'orb',
};
/** The rig shape of a held look: the depth bases' art shapes (shared ART_SHAPE: cleaver, maul2h, ...) become their
 *  family's shape, so the rig never branches on a base it does not know. Non-held shapes pass through. */
export function heldShape(shape: string | undefined): string | undefined {
  const f = shape ? SHAPE_FAMILY[shape] : undefined;
  return f ? FAMILY_SHAPE[f.family] : shape;
}

/** Armour art shapes of the depth bases -> the slot silhouette they extend (the shape their base stores). The armour code
 *  draws the family silhouette and adds the base's own parts on top (`artKey`). */
export const ARMOUR_FAMILY: Readonly<Record<string, string>> = {
  coif: 'hood', mask: 'cap', widebrim: 'cap', furmantle: 'pads', capelet: 'mantle', brigandine: 'leather', vestment: 'robe',
  apron: 'leather', mitts: 'wraps', fingerless: 'gloves', cuffs: 'bracers', vambraces: 'bracers', armwraps: 'bracers',
  girdle: 'belt', cord: 'sash', chaps: 'leather', tassets: 'plate', waders: 'leather', footwraps: 'shoes', sandals: 'shoes',
  clogs: 'boots', torc: 'amulet', charm: 'amulet', locket: 'amulet', band: 'ring', signet: 'ring', coil: 'ring',
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
  // class waves (warrior / ranger / mage legendaries): motifs from ITEMS-SHARED.md section 6, 'Legendary -> motif' [S]
  gale_stitched_legguards: { motif: 'wind' }, wingbeat_boots: { motif: 'wind' },
  quakestep_sabatons: { motif: 'stone' }, fissure_lined_breastplate: { motif: 'stone' },
  tremor_signet: { motif: 'stone' }, cairnwrights_hammer: { motif: 'stone' },
  stonecount_gauntlets: { motif: 'stone' },
  ashgrip_gauntlets: { motif: 'ember' }, kilnmaw: { motif: 'ember' }, slagforged_helm: { motif: 'ember' },
  coalheart_locket: { motif: 'ember' }, powderkeg_crossbow: { motif: 'ember' }, fuse_burnt_boots: { motif: 'ember' },
  powder_horn: { motif: 'ember' }, tar_stained_jerkin: { motif: 'ember' }, mortarmans_pack: { motif: 'ember' },
  fuse_cord_belt: { motif: 'ember' }, kindling_rod: { motif: 'ember' }, firekeepers_gloves: { motif: 'ember' },
  tanners_pauldrons: { motif: 'blood' }, red_ledger: { motif: 'blood' }, grinning_saw: { motif: 'blood' },
  woodcutters_grips: { motif: 'blood' }, sawyers_ring: { motif: 'blood' },
  bellwrights_maul: { motif: 'gold' }, belfry_pauldrons: { motif: 'gold' }, brass_warhorn_helm: { motif: 'gold' },
  furycord_belt: { motif: 'gold' }, seething_sigil: { motif: 'gold' }, threshers_knot: { motif: 'gold' },
  ward_pennant_shield: { motif: 'holy' }, quartermasters_cuirass: { motif: 'holy' }, rally_knot: { motif: 'holy' },
  coulter_blade: { motif: 'furrow' }, yoke_greaves: { motif: 'furrow' }, ox_harness_belt: { motif: 'furrow' },
  millwheel_edge: { motif: 'furrow' },
  featherguard_cuffs: { motif: 'feather' }, hawkfeather_cap: { motif: 'feather' },
  huntsmans_pauldrons: { motif: 'feather' }, starling_longbow: { motif: 'feather' },
  roost_charm: { motif: 'feather' },
  bolt_throwers_arbalest: { motif: 'cog' }, bowyers_gloves: { motif: 'cog' }, bandolier_belt: { motif: 'cog' },
  tripline_crossbow: { motif: 'cog' },
  squallcatcher_pauldrons: { motif: 'rain' }, raincount_ring: { motif: 'rain' },
  highcloud_longbow: { motif: 'rain' }, overcast_hood: { motif: 'rain' }, weathervane_ring: { motif: 'rain' },
  stormglass_prism: { motif: 'rain' }, conductors_legwraps: { motif: 'rain' }, static_loop: { motif: 'rain' },
  kennel_wood_bow: { motif: 'leaf' }, trailhide_breeches: { motif: 'leaf' }, whistle_charm: { motif: 'leaf' },
  spotters_repeater: { motif: 'leaf' },
  snarehand_gloves: { motif: 'knot' }, coiled_wire_bracers: { motif: 'knot' },
  skipping_stone_quiver: { motif: 'knot' },
  riverstone_repeater: { motif: 'frost' }, skimmers_leggings: { motif: 'frost' },
  frostlocked_wand: { motif: 'frost' }, winterbound_robe: { motif: 'frost' }, rimecourt_band: { motif: 'frost' },
  hoarneedle_wand: { motif: 'frost' }, frostthread_gloves: { motif: 'frost' }, snowglobe_pendant: { motif: 'frost' },
  cistern_staff: { motif: 'frost' }, rimewalker_slippers: { motif: 'frost' },
  craterheart_amulet: { motif: 'star' }, armillary_staff: { motif: 'star' }, starchart_robe: { motif: 'star' },
  clockmakers_ring: { motif: 'star' },
  undertow_staff: { motif: 'void' }, horizon_cowl: { motif: 'void' },
  glasswrights_wraps: { motif: 'shard' }, echoing_bead: { motif: 'shard' },
  coiled_pauldrons: { motif: 'lantern' }, lanternkeepers_sash: { motif: 'lantern' },
  glyphstone_orb: { motif: 'arcane' }, spellwrights_circlet: { motif: 'arcane' },
  runeweaver_cuffs: { motif: 'arcane' },
  resonant_staff: { motif: 'chime' }, hornlistener_circlet: { motif: 'chime' }, signal_coil: { motif: 'chime' },
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
  // class-wave sets: motif, main / deep and signature from ITEMS-SHARED.md section 6 [S]
  hearthbanner: { motif: 'banner', main: 0xd8b45a, deep: 0x5a1e18, signature: 'Muster: twin war-banners, pennant orbit, drumbeat steps' },
  furrowmark: { motif: 'furrow', main: 0x9aa1a6, deep: 0x3d2f20, signature: 'Ploughline: mouldboard wings, clod orbit, furrowed steps' },
  thicket_kin: { motif: 'antler', main: 0xb59a6a, deep: 0x2a3320, signature: 'Thicket: antler wings, leaf orbit, paw steps' },
  snarewright: { motif: 'knot', main: 0x8f9a9e, deep: 0x3b3020, signature: 'Snare: rope-net wings, jaw orbit, coil steps' },
  hoarfrost_vigil: { motif: 'frost', main: 0xdff6ff, deep: 0x2c4458, signature: 'Vigil: icicle wings, crystal orbit, frost steps' },
  hollowstar_choir: { motif: 'chime', main: 0xc8b6ff, deep: 0x231d3d, signature: 'Choir: ripple wings, chime orbit, ringing steps' },
};
