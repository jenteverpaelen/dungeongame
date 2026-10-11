// Gear visual language V2 (docs/rework/gear/DESIGN-V2.md §3): the per-item style every piece of gear art reads.
// Derived from the packed identity of a look (shared/src/gearVisual.ts) and the registry (gearVisuals.ts):
//   generation → material ladder (crude iron … zenith pearl) and size;  rarity → the colour and amount of light;
//   legendary / Set → signature + motif;  top tier → luminous edge + extra floating pieces;  +N → glow steps.
// Pure data + tiny helpers shared by the weapon generator, the baked ornaments, the live effects, icons and loot.

import { isSpecial, lookFx, type GearFx } from '@shared/gearVisual';
import { GEMS, LEGENDARIES } from '@shared/data/items';
import { RARITY_COLORS } from '@shared/items';
import type { ItemLook, Rarity } from '@shared/types';
import { ARMOUR_FAMILY, LEGENDARY_VISUAL, MOTIF_SIGNATURE, SET_STYLE, SHAPE_FAMILY, type Motif, type SetStyle, type Signature } from './gearVisuals';
import { mix } from './util';

export { SET_STYLE, type Motif, type SetStyle } from './gearVisuals';

/** Legendary id → motif (registry view kept for the effect code). */
export const LEGENDARY_MOTIF: Record<string, Motif> = Object.fromEntries(Object.entries(LEGENDARY_VISUAL).map(([k, v]) => [k, v.motif]));

// ─────────────────────────── generations: the material ladder ───────────────────────────

export interface GenMaterial {
  /** Short original name of the generation's material (design docs / gallery labels only, never UI). */
  name: string;
  metal: number; edge: number; dark: number;
  /** Fittings (guard, bands, rivets). */
  trim: number;
  wood: number;
  /** Grip wrap / cloth. */
  wrap: number;
  /** Colour of the generation's own light where its silhouette has light channels (0 = none). */
  rune: number;
}

/** Seven generations = the item-name bands (Worn … Starforged) + the level-70 cap. Model changes at G0 / G2 / G4 / G6,
 *  material + light steps in between (REFERENCES-V2 V1/V2). Colours are original proposals [P]. */
export const GEN_MATERIAL: readonly GenMaterial[] = [
  { name: 'scrap iron', metal: 0x8a8379, edge: 0xb2a998, dark: 0x57504a, trim: 0x6d6457, wood: 0x80603e, wrap: 0xa8946c, rune: 0 },
  { name: 'iron', metal: 0x9ba1a8, edge: 0xcdd1d5, dark: 0x5f656d, trim: 0x8b8274, wood: 0x6e4a2c, wrap: 0x5c3d24, rune: 0 },
  { name: 'steel and bronze', metal: 0xb6bec8, edge: 0xe6ebf0, dark: 0x6c7581, trim: 0xb98149, wood: 0x5c3a22, wrap: 0x4a3426, rune: 0 },
  { name: 'bright steel and gilt', metal: 0xc8d2dc, edge: 0xf6f9fc, dark: 0x6a7686, trim: 0xe2b448, wood: 0x4a2c1a, wrap: 0x7a2420, rune: 0 },
  { name: 'runesteel', metal: 0x58688a, edge: 0xa9c4e2, dark: 0x2c3448, trim: 0xd2dae2, wood: 0x2e2430, wrap: 0x23345a, rune: 0x62e6dc },
  { name: 'starmetal', metal: 0xd6d2ee, edge: 0xffffff, dark: 0x6a6490, trim: 0xf2c24e, wood: 0x3a2a4a, wrap: 0x48286a, rune: 0xc4b4ff },
  { name: 'zenith pearl', metal: 0xf1e9d6, edge: 0xffffff, dark: 0x8a7856, trim: 0xffd56a, wood: 0x2a1e30, wrap: 0x6a1a2a, rune: 0xfff0c2 },
];

/** World / rig size of held items per generation, by size class (icons fill by their own ladder, icons.ts). Small
 *  one-handers climb the most (they are the hardest to read on a ~95 px hero); big two-handers climb least because
 *  their drawings already grow heads and edges per generation. Proposal [P]; owner decision how big endgame may get. */
export const GEN_SCALE = {
  // pass 2.1: one-handers climb hardest at G5–G6 (the lead's hero-scale review); proposed cap ×1.8 before legendary /
  // grade (×2.06 for a Fabled legendary). Owner decision 1 is open: the gallery shows ×1.5 / ×1.8 / ×2.1 (?cap=).
  small: [0.9, 0.98, 1.08, 1.2, 1.36, 1.56, 1.8],
  mid: [0.9, 0.96, 1.05, 1.16, 1.3, 1.46, 1.62],
  large: [0.88, 0.94, 1, 1.07, 1.15, 1.24, 1.34],
} as const;
export type SizeClass = keyof typeof GEN_SCALE;

/** Dev galleries only: show another one-hander cap (G6 small = cap; the other classes and generations scale along). */
let sizeCap: number | null = null;
export function setSizeCap(cap: number | null): void { sizeCap = cap; cache.clear(); }
function genScale(cls: SizeClass, gen: number): number {
  const v = GEN_SCALE[cls][gen];
  if (sizeCap === null) return v;
  const lo = GEN_SCALE[cls][0], hi = GEN_SCALE[cls][6], k = (sizeCap - 0.9) / (GEN_SCALE.small[6] - 0.9);
  return lo + (v - lo) * (1 + (k - 1) * (hi - lo) / Math.max(1e-6, GEN_SCALE.small[6] - 0.9));
}
function sizeClassOf(shape: string): SizeClass {
  const rig = SHAPE_FAMILY[shape]?.rig;
  return rig === '1h' || rig === 'wand' || rig === 'hxbow' ? 'small' : rig === '2h' || rig === 'staff' ? 'large' : 'mid';
}

/** Item grades above Legendary (stored `item.ancient` 1 / 2; docs/rework/depth/ITEMS-SHARED.md §7): grade 1 **Kindled**
 *  carries an ember accent (ember-orange edge light, an ember set into the piece, drifting embers); grade 2 **Fabled**
 *  takes "a unique look": white-gold starlight replaces the core light (the item's own colour moves to its rim), an
 *  Inscription ring of glyphs orbits held items, starlight glints. Index 3 is spare. */
export const TOP_COLORS = [0, 0xff8a3c, 0xbcd6ff, 0xbcd6ff] as const;
/** Fabled core light (white-gold starlight) and the white core of every grade light. */
export const FABLED_LIGHT = 0xfff0c4;
export const TOP_CORE = 0xffffff;

const hexOf = (css: string) => parseInt(css.replace('#', ''), 16);
/** Rarity light colours, from the shared rarity tokens (RARITY_COLORS) lifted towards white so they read as light. */
export const RARITY_LIGHT: Record<Rarity, number> = {
  normal: 0,
  magic: mix(hexOf(RARITY_COLORS.magic), 0xffffff, 0.18),
  rare: mix(hexOf(RARITY_COLORS.rare), 0xffffff, 0.22),
  legendary: mix(hexOf(RARITY_COLORS.legendary), 0xffffff, 0.12),
  set: mix(hexOf(RARITY_COLORS.set), 0xffffff, 0.15),
};

export interface ItemStyle {
  fx: GearFx;
  gen: number;
  /** Rarity index 0..4 (normal, magic, rare, legendary, set). */
  rar: number;
  special: boolean;
  top: number;
  temper: number;
  mat: GenMaterial;
  /** Final material colours (the stored look's own colour tints the metal a little, legendaries keep their palette). */
  metal: number; edge: number; dark: number; trim: number; wood: number; wrap: number;
  /** The colour of this item's light (0 = dormant: normal items show empty channels). */
  light: number;
  /** Light strength 0..~1.6: rarity, generation, enhancement and top tier. */
  lightK: number;
  /** Top-tier edge light (0 below the top tier). */
  edgeLight: number;
  /** Ornament accent (light colour, else the trim). */
  accent: number;
  motif: Motif | null;
  set?: SetStyle;
  sig: Signature | null;
  bespoke?: string;
  legendary?: string;
  /** Socketed gem colour (0 = none) and whether it glows (rank 5+). */
  gem: number;
  gemGlow: boolean;
  /** Rig / world size factor of held items. */
  scale: number;
  /** Floating pieces around held items (generation + rarity + top tier). */
  floats: number;
  /** Armour ornament complexity 0..9 (gearDecor.ts): structure from the generation, embellishment from the rarity,
   *  filigree from the grade. Internal only, never shown as a tier. */
  orn: number;
  /** Ornament metal of armour pieces (fittings; the grade colour on Kindled / Fabled pieces). */
  orMetal: number;
  /** Fabled: the item's own identity colour, moved to the rim (0 otherwise). */
  idLight: number;
}

/** Armour ornament complexity from generation, rarity and grade (see ItemStyle.orn). */
export function ornOf(gen: number, rar: number, top: number): number {
  const structure = [0, 1, 3, 4, 5, 5, 6][gen] ?? 0;
  let o = rar >= 3 ? (gen >= 6 ? 7 : 6) : rar === 2 ? Math.min(5, structure + 1) : structure;
  if (top >= 1) o = Math.max(o, 8);
  if (top >= 2) o = 9;
  return o;
}

const cache = new Map<string, ItemStyle>();

/** Style of a look, or null for looks without identity (townsfolk, older servers: drawn exactly as before). */
export function itemStyle(look: ItemLook | undefined): ItemStyle | null {
  if (!look || typeof look.fx !== 'number') return null;
  const key = `${look.fx}|${look.primary}|${look.secondary}|${look.glow}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const fx = lookFx(look)!;
  const gen = fx.gen, rar = ['normal', 'magic', 'rare', 'legendary', 'set'].indexOf(fx.rarity), special = isSpecial(fx.rarity);
  const set = fx.set ? SET_STYLE[fx.set] : undefined;
  const lv = fx.legendary ? LEGENDARY_VISUAL[fx.legendary] : undefined;
  const motif = set?.motif ?? lv?.motif ?? null;
  const mat = GEN_MATERIAL[gen];
  // metal keeps a hint of the stored colour (variety inside a generation); legendaries tint more towards their palette
  const tint = special ? 0.32 : 0.14;
  const metal = mix(mat.metal, look.primary, tint), edge = mix(mat.edge, look.primary, tint * 0.4), dark = mix(mat.dark, look.primary, tint);
  const trim = special ? mix(mat.trim, look.secondary, 0.55) : mat.trim;
  const defGlow = fx.legendary && LEGENDARIES[fx.legendary] ? LEGENDARIES[fx.legendary].colors.glow : look.glow || RARITY_LIGHT.legendary;
  // the core light keeps the item's identity (rarity / legendary / Set colour); the top tier adds its own edge light
  const idLight = set ? set.main : fx.rarity === 'legendary' ? defGlow : RARITY_LIGHT[fx.rarity];
  // Fabled: starlight takes the core, the identity colour moves to the rim
  const light = fx.top >= 2 ? FABLED_LIGHT : idLight;
  const lightK = !light ? 0 : (special ? 0.8 : rar === 2 ? 0.55 : 0.4) + gen * 0.05 + fx.temper * 0.14 + fx.top * 0.18;
  const gemDef = fx.gem ? GEMS[fx.gem] : undefined;
  const scale = genScale(sizeClassOf(look.shape), gen) * (special ? 1.06 : 1) * (1 + 0.04 * fx.top);
  const floats = (gen >= 6 ? (rar >= 2 ? 2 : 1) : gen >= 5 && rar >= 2 ? 1 : 0) + (special && gen >= 4 ? 1 : 0) + fx.top;
  const s: ItemStyle = {
    fx, gen, rar, special, top: fx.top, temper: fx.temper, mat,
    metal, edge, dark, trim, wood: mat.wood, wrap: special ? mix(mat.wrap, look.primary, 0.5) : mat.wrap,
    light, lightK, edgeLight: TOP_COLORS[Math.min(3, fx.top)] ?? 0, accent: light || trim, motif, set, sig: lv?.sig ?? (lv ? MOTIF_SIGNATURE[lv.motif] : set ? MOTIF_SIGNATURE[set.motif] : null),
    bespoke: lv?.bespoke, legendary: fx.legendary, gem: gemDef?.color ?? 0, gemGlow: fx.gemRank >= 5, scale, floats,
    orn: ornOf(gen, rar, fx.top), orMetal: fx.top >= 2 ? FABLED_LIGHT : fx.top ? TOP_COLORS[1] : special ? mix(trim, light || trim, 0.3) : trim,
    idLight: fx.top >= 2 ? idLight : 0,
  };
  if (cache.size > 2000) cache.clear();
  cache.set(key, s);
  return s;
}

/** Armour shapes that are worked metal (they take the generation's metal; cloth and leather keep their dye). */
const METAL_ARMOUR = new Set(['helm', 'helm_horned', 'plate', 'spiked', 'gauntlets', 'greaves', 'mail', 'coif', 'tassets', 'girdle', 'vambraces', 'clogs']);
/** Early cloth / leather is dull, later dyes are kept as made (generation finish). */
const DULL = [0.42, 0.26, 0.12, 0, 0, 0, 0];

/** The colours armour is drawn with (DESIGN-V2 §2.7): metal pieces take the generation's metal (scrap iron → runesteel →
 *  starmetal → zenith pearl), every piece takes the generation's fittings as its trim, magic / rare trims carry their
 *  light, legendary / Set pieces keep their own palette with the generation's finish. Held items and looks without
 *  identity (townsfolk) are returned unchanged. */
export function artLook(l: ItemLook | undefined): ItemLook | undefined {
  if (!l || SHAPE_FAMILY[l.shape]) return l;
  // depth-wave armour bases draw on their family's silhouette and keep their own key for their own parts (artKey)
  const fam = ARMOUR_FAMILY[l.shape];
  const base: ArtLook = fam ? { ...l, shape: fam, art: l.shape } : l;
  const s = itemStyle(l);
  if (!s) return base;
  const metal = METAL_ARMOUR.has(l.shape) || METAL_ARMOUR.has(base.shape);
  if (armourSeriesHook) return armourSeriesHook(base, s, metal);
  const primary = s.special ? (metal ? mix(l.primary, s.mat.metal, 0.25) : l.primary)
    : metal ? mix(s.mat.metal, l.primary, 0.22) : mix(l.primary, 0x6a5e50, DULL[s.gen]);
  const secondary = s.special ? mix(l.secondary, s.mat.trim, 0.3)
    : s.rar === 1 ? mix(s.mat.trim, s.light, 0.6) : s.rar === 2 ? mix(s.mat.trim, s.light, 0.45) : s.mat.trim;
  if (primary === l.primary && secondary === l.secondary) return base;
  return { ...base, primary, secondary };
}

/** An armour look prepared for drawing: `shape` is the slot silhouette, `art` the depth base's own shape (if any). */
export type ArtLook = ItemLook & { art?: string };
/** The base's own art shape of a prepared armour look (its family shape when it has none). */
export function artKey(l: ItemLook | undefined): string | undefined { return (l as ArtLook | undefined)?.art ?? l?.shape; }

/** The armour art switch (Settings -> Display -> Armour art; docs/rework/gear/ART-DIRECTION.md section 6): when set,
 *  armour is coloured and fitted by the maker series (series/armour.ts) instead of the generation ladder. Set once at
 *  start, before anything is baked. */
let armourSeriesHook: ((l: ArtLook, s: ItemStyle, metal: boolean) => ArtLook) | null = null;
export function setArmourSeries(hook: ((l: ArtLook, s: ItemStyle, metal: boolean) => ArtLook) | null): void { armourSeriesHook = hook; }
export function armourSeriesOn(): boolean { return armourSeriesHook !== null; }

/** Ornament level 0..6 of a look (its generation; 0 for looks without identity). */
export function ornament(look: ItemLook | undefined): number {
  return itemStyle(look)?.gen ?? 0;
}

export function motifColor(m: Motif | null, fallback: number): number {
  switch (m) {
    case 'wind': return 0xbff2ff;
    case 'cog': return 0xffc94a;
    case 'star': return 0xffd27a;
    case 'ember': case 'flame': return 0xff8a3a;
    case 'stone': return 0xffc47a;
    case 'feather': return 0x9fe8ff;
    case 'rain': return 0xc9d8ff;
    case 'shard': return 0xd8f2ff;
    case 'lantern': return 0xffd27a;
    case 'blood': return 0xff3b3b;
    case 'holy': return 0xfff3b0;
    case 'void': return 0xc39bff;
    case 'arcane': return 0xd6c2ff;
    case 'storm': return 0x9fe3ff;
    case 'frost': return 0xbdf6ff;
    case 'leaf': return 0xb6ff8f;
    case 'shadow': return 0xffd27f;
    case 'gold': return 0xffe08a;
    default: return fallback;
  }
}
