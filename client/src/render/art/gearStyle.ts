// Gear visual language (docs/rework/gear/DESIGN.md §3–§4): per-item style from the packed progression, the nine Set
// identities and the motif of each Legendary. Pure data + tiny helpers shared by the baked ornaments (gearDecor.ts),
// the live effects (gearFx.ts), icons and nameplates. Every motif, shape and colour here is original.

import { GEAR_TIER_COLORS, lookFx, type GearFx } from '@shared/gearVisual';
import { GEMS, LEGENDARIES } from '@shared/data/items';
import type { ItemLook } from '@shared/types';
import { mix } from './util';

export type Motif = 'wind' | 'cog' | 'star' | 'ember' | 'stone' | 'feather' | 'rain' | 'shard' | 'lantern'
  | 'blood' | 'holy' | 'void' | 'arcane' | 'storm' | 'frost' | 'leaf' | 'shadow' | 'flame' | 'gold';

/** Back pieces from cloth to wings (rank / Set driven). */
export type BackKind = 'none' | 'cape' | 'mantle' | 'wings';

export interface SetStyle {
  motif: Motif;
  /** Emissive accent and the deep tone it sits on. */
  main: number;
  deep: number;
  /** Original name of the Set's signature (shown in the showcase card). */
  signature: string;
}

/** The nine Sets: one silhouette language each (crest, back piece, orbit token, particles, footprints, idle burst). */
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

/** Legendary signature motifs (parameterised generators, not 22 one-off sprites). */
export const LEGENDARY_MOTIF: Record<string, Motif> = {
  faultcleaver: 'stone', rainspindle: 'rain', lanternroot: 'lantern', ninefold_gale: 'wind', bloodwake: 'blood', eternal_gyre: 'wind',
  anvil_vambraces: 'gold', last_light: 'holy', sappers_pack: 'cog', gearwright_heart: 'cog', thunderhead: 'storm', hunters_mark: 'leaf',
  cindervane: 'flame', void_heart: 'void', starfall_mantle: 'star', thousand_missiles: 'arcane', ouroboros_loop: 'gold', patient_thief: 'shadow',
  hellforge_talisman: 'flame', witching_cord: 'arcane', stridewind: 'wind', mountain_fists: 'stone',
};

export const ANCIENT_GOLD = 0xffb04a;
export const PRIMAL_RED = 0xff3a2a;
export const PRIMAL_CORE = 0xfff0e0;

export interface ItemStyle {
  fx: GearFx;
  tier: number;
  /** Emissive accent (legendary glow / Set main / rarity trim colour). */
  accent: number;
  /** Filigree / ornament metal (tier metal, Ancient amber, Primal crimson). */
  metal: number;
  motif: Motif | null;
  set?: SetStyle;
  /** Socketed gem colour (0 = none) and whether it glows (rank 5+). */
  gem: number;
  gemGlow: boolean;
}

const cache = new Map<number, ItemStyle>();

/** Style of a look, or null for looks without progression (townsfolk, older servers: drawn exactly as before). */
export function itemStyle(look: ItemLook | undefined): ItemStyle | null {
  if (!look || typeof look.fx !== 'number') return null;
  const key = look.fx * 16 + (look.glow ? 1 : 0);
  const hit = cache.get(key);
  if (hit && hit.accent === (accentOf(look, hit.fx))) return hit;
  const fx = lookFx(look)!;
  const set = fx.set ? SET_STYLE[fx.set] : undefined;
  const motif = set?.motif ?? (fx.legendary ? LEGENDARY_MOTIF[fx.legendary] ?? null : null);
  const metal = fx.ancient === 2 ? PRIMAL_RED : fx.ancient === 1 ? ANCIENT_GOLD : GEAR_TIER_COLORS[fx.tier];
  const gemDef = fx.gem ? GEMS[fx.gem] : undefined;
  const s: ItemStyle = { fx, tier: fx.tier, accent: accentOf(look, fx), metal, motif, set, gem: gemDef?.color ?? 0, gemGlow: fx.gemRank >= 5 };
  if (cache.size > 2000) cache.clear();
  cache.set(key, s);
  return s;
}

function accentOf(look: ItemLook, fx: GearFx): number {
  if (fx.ancient === 2) return PRIMAL_RED;
  if (fx.set && SET_STYLE[fx.set]) return SET_STYLE[fx.set].main;
  if (fx.legendary && LEGENDARIES[fx.legendary]) return LEGENDARIES[fx.legendary].colors.glow;
  if (fx.tier >= 6) return look.glow || 0xffb347;
  if (fx.tier >= 5) return 0x7fe8d8;
  if (fx.tier >= 3) return 0xffd65a;
  if (fx.tier >= 1) return 0x9fb4ff;
  return 0;
}

/** Ornament level 0..9 of a look (0 for looks without progression). */
export function ornament(look: ItemLook | undefined): number {
  return itemStyle(look)?.tier ?? 0;
}

/** Colour of a tier blended for light UI text. */
export function tierText(tier: number): number {
  return mix(GEAR_TIER_COLORS[Math.max(0, Math.min(9, tier))], 0xffffff, 0.25);
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
