// The Hearthfall palette. Every colour the art module uses that is not data-driven (item looks, monster
// colours) lives here, so the whole world can be tuned from one file. See docs/ART_DIRECTION.md.

import type { ClassId } from '@shared/types';

/** The single outline colour of the game: a warm near-black that sits well next to the bronze UI. */
export const INK = 0x1b1410;
/** Warm cream used for highlights (light comes from the upper left, slightly warm). */
export const LIGHT = 0xfff4d6;
/** Cool plum the shade side is mixed towards (warm light / cool shadow keeps it painterly). */
export const SHADOW = 0x2a1830;

export const BLUSH = 0xff8f7e;
export const GOLD = 0xe8b64a;
export const GOLD_DARK = 0x9a6a24;
export const STEEL = 0xb9c2cc;
export const WOOD = 0x8a5a34;
export const WOOD_DARK = 0x5c3a22;
export const LEATHER = 0x7a5230;
export const BONE = 0xeee6d2;

/** Glow / rim colours. */
export const GLOW_SET = 0x3cff6e;
export const RIM_CHAMPION = 0x4f9dff;
export const RIM_RARE = 0xffc93c;
export const RIM_BOSS = 0xff4a2a;

/** Class underclothes (drawn when a slot is empty) and the class accent used for small trims. */
export interface ClassOutfit { shirt: number; pants: number; shoes: number; trim: number; band: number }
export const OUTFIT: Record<ClassId, ClassOutfit> = {
  warrior: { shirt: 0xa5503a, pants: 0x5a4636, shoes: 0x4a3426, trim: 0xd9a35a, band: 0xc0392b },
  ranger: { shirt: 0x5d8240, pants: 0x6b5a3a, shoes: 0x4a3426, trim: 0xc9a46a, band: 0x3f8f4f },
  mage: { shirt: 0x4462ad, pants: 0x3a3552, shoes: 0x3b2f4c, trim: 0xe8c66a, band: 0x6c4fc4 },
};

// ─────────────────────────── World themes ───────────────────────────

export type ThemeKey = 'town' | 'glade' | 'ashen' | 'riftGlade' | 'riftAshen';

export interface GroundPalette {
  /** Walkable ground: base, darker and lighter noise tones, and a speckle colour. */
  floor: number; floorDark: number; floorLight: number; speck: number;
  /** Paths (dirt road / flagstones) and their rim. */
  path: number; pathDark: number; pathLight: number; pathEdge: number;
  /** Plaza stones and grout. */
  stone: number; stoneLight: number; grout: number;
  /** Wall mass top (forest floor / rock plateau) and its south-facing face. */
  wallTop: number; wallTopLight: number; face: number; faceDark: number; faceLight: number;
  /** Liquid (water or lava): shallow, deep, foam/crust edge. */
  liquid: number; liquidDeep: number; liquidEdge: number; liquidGlow: boolean;
  /** Tint of the ambient-occlusion band along walls. */
  ao: number;
  /** Decal outline tone (ground decals never use the full ink outline). */
  decalInk: number;
}

export const GROUND: Record<ThemeKey, GroundPalette> = {
  town: {
    floor: 0x86ad5c, floorDark: 0x6f9a4e, floorLight: 0x9fc06a, speck: 0xb6cf78,
    path: 0xc2a476, pathDark: 0xa98c60, pathLight: 0xd4b98a, pathEdge: 0x7d6a46,
    stone: 0xb8ad97, stoneLight: 0xcfc5ae, grout: 0x6c6150,
    wallTop: 0x3c5a34, wallTopLight: 0x4b6b3e, face: 0x5a4632, faceDark: 0x3c2e22, faceLight: 0x74603f,
    liquid: 0x5aa8c4, liquidDeep: 0x3a7fa6, liquidEdge: 0xe2f4ee, liquidGlow: false,
    ao: 0x1e2a14, decalInk: 0x3e5a2c,
  },
  glade: {
    floor: 0x6ea14f, floorDark: 0x588b42, floorLight: 0x86b65c, speck: 0x9ccb6a,
    path: 0xa98d5f, pathDark: 0x8f744c, pathLight: 0xbfa274, pathEdge: 0x6a5634,
    stone: 0x9a9888, stoneLight: 0xb4b2a0, grout: 0x5a5a4a,
    wallTop: 0x2c4628, wallTopLight: 0x3a5a32, face: 0x4c3c2a, faceDark: 0x30261c, faceLight: 0x66533a,
    liquid: 0x4a9eaa, liquidDeep: 0x2f7488, liquidEdge: 0xd6f0e0, liquidGlow: false,
    ao: 0x14200f, decalInk: 0x34552a,
  },
  ashen: {
    floor: 0x57504b, floorDark: 0x46403c, floorLight: 0x6a625b, speck: 0x7c7268,
    path: 0x6e655c, pathDark: 0x5a524b, pathLight: 0x837a70, pathEdge: 0x3a3430,
    stone: 0x7a7068, stoneLight: 0x8e847a, grout: 0x342e2b,
    wallTop: 0x2c2628, wallTopLight: 0x3a3234, face: 0x231d1f, faceDark: 0x161214, faceLight: 0x3e3436,
    liquid: 0xff7a22, liquidDeep: 0xd63e12, liquidEdge: 0x3a1c14, liquidGlow: true,
    ao: 0x0e0a0a, decalInk: 0x2c2624,
  },
  riftGlade: {
    floor: 0x3c6b66, floorDark: 0x2f5855, floorLight: 0x4a7e76, speck: 0x5c968a,
    path: 0x45736c, pathDark: 0x37605a, pathLight: 0x568a80, pathEdge: 0x22403e,
    stone: 0x52807a, stoneLight: 0x64948c, grout: 0x22403e,
    wallTop: 0x1c3236, wallTopLight: 0x264248, face: 0x142428, faceDark: 0x0c1719, faceLight: 0x2a4a4e,
    liquid: 0x3fc0c8, liquidDeep: 0x1f8a9a, liquidEdge: 0xbff6f0, liquidGlow: true,
    ao: 0x061012, decalInk: 0x1e3a38,
  },
  riftAshen: {
    floor: 0x5e3330, floorDark: 0x4b2826, floorLight: 0x713f38, speck: 0x84503f,
    path: 0x6a3c36, pathDark: 0x55302b, pathLight: 0x7c4a40, pathEdge: 0x301818,
    stone: 0x744642, stoneLight: 0x885650, grout: 0x301818,
    wallTop: 0x2a1416, wallTopLight: 0x381c1e, face: 0x1e0d0f, faceDark: 0x120708, faceLight: 0x40201f,
    liquid: 0xff6a22, liquidDeep: 0xc8321a, liquidEdge: 0x2a1010, liquidGlow: true,
    ao: 0x0a0405, decalInk: 0x301a18,
  },
};

/** Foliage / prop colours per theme. */
export interface FoliagePalette {
  leaf: number; leafDark: number; leafLight: number; trunk: number; trunkDark: number;
  rock: number; rockDark: number; rockLight: number; moss: number; accent: number; glow: number;
}
export const FOLIAGE: Record<ThemeKey, FoliagePalette> = {
  town: { leaf: 0x5f9a45, leafDark: 0x3f7434, leafLight: 0x8cc35e, trunk: 0x7a5232, trunkDark: 0x553820, rock: 0x9c9888, rockDark: 0x77736a, rockLight: 0xbab5a2, moss: 0x6fa04a, accent: 0xf0a8c0, glow: 0xffc46a },
  glade: { leaf: 0x4f9040, leafDark: 0x336a30, leafLight: 0x7cba55, trunk: 0x6e4a2e, trunkDark: 0x4a301c, rock: 0x8d8e80, rockDark: 0x6a6b60, rockLight: 0xaaab9a, moss: 0x5f9a42, accent: 0xf2d35e, glow: 0xffd27a },
  ashen: { leaf: 0x5a4e46, leafDark: 0x3c332e, leafLight: 0x766860, trunk: 0x3a302c, trunkDark: 0x241d1b, rock: 0x5c5450, rockDark: 0x3e3836, rockLight: 0x7a706a, moss: 0x6a5a4a, accent: 0xff7a22, glow: 0xff8a2a },
  riftGlade: { leaf: 0x3a8a80, leafDark: 0x24605a, leafLight: 0x5cb8a6, trunk: 0x3a4a4a, trunkDark: 0x243030, rock: 0x3e6066, rockDark: 0x28444a, rockLight: 0x5a8088, moss: 0x5ad0b0, accent: 0x7ff0ff, glow: 0x6ff2ff },
  riftAshen: { leaf: 0x6a3030, leafDark: 0x4a1e1e, leafLight: 0x8a4040, trunk: 0x3a2020, trunkDark: 0x241212, rock: 0x5e3432, rockDark: 0x3e2020, rockLight: 0x7c4842, moss: 0x8a3a2a, accent: 0xff5a2a, glow: 0xff6a2a },
};

/** Element colours (index = ELEMENT_INDEX) for death styling and tints. */
export const ELEMENT_COLORS = [0xe8e0d0, 0xff8a3d, 0x7fd3ff, 0xd6c2ff, 0x8fd16a, 0xc39bff, 0xfff0a0];
