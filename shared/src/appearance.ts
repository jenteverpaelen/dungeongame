import { CLASSES, CLASS_IDS, isClassId } from './data/classes';
import type { ClassId } from './types';

// Hero appearance (docs/rework/ui/CHARACTER_SCREENS.md §3). Choices only reuse what the hero art draws; absence keeps the
// class look exactly. Palette values are [P] placeholders judged by eye at 1920×1080.

/** v1 (2026-10-10): copy another class's skin, hair colour or hairstyle. Old heroes keep it; it still loads. */
export interface HeroAppearanceV1 { skin:ClassId; hair:ClassId; style:ClassId }
/** v2 (2026-10-12): indices into the palettes below, a hairstyle, facial hair and a face accessory. */
export interface HeroAppearanceV2 { v:2; skin:number; hairStyle:HairStyle; hair:number; eyes:number; beard:BeardStyle; face:FaceAccessory }
export type HeroAppearance = HeroAppearanceV1 | HeroAppearanceV2;

/** Skin tones, pale to deep; the three class defaults are kept (C3 "dozens", C5 four). */
export const SKIN_TONES = [0xf6d2b3, 0xf2c9a0, 0xe8b98c, 0xd9a376, 0xc68a5c, 0xa8704a, 0x8a5636, 0x6e4128, 0xf0d8c8, 0xd8b090] as const;
/** Hair colours; the class defaults (chestnut, ink, silver) are kept. */
export const HAIR_COLORS = [0x2b2b35, 0x3e2a1c, 0x6b3a1f, 0x8a3b22, 0xb4532a, 0xd9893a, 0xe2c27a, 0xcfc4a2, 0x8c8c8c, 0xe9e4d8, 0x2e4a7a, 0x8a1f2e] as const;
/** Eye colours: dark, brown, hazel, green, blue, grey, amber, violet. */
export const EYE_COLORS = [0x1a1a1a, 0x4a2e1c, 0x6a5a2a, 0x2a3b2a, 0x2b3a6b, 0x5a6470, 0x8a5a14, 0x4e3070] as const;
/** Every hairstyle the head art draws (`client/src/render/art/heroParts.ts`); `none` reads as shaved. */
export const HAIR_STYLES = ['spiky', 'short', 'cropped', 'ponytail', 'braid', 'bun', 'long', 'curly', 'balding', 'none'] as const;
export type HairStyle = typeof HAIR_STYLES[number];
/** Facial hair from the townsfolk kit (`client/src/render/art/gear.ts`). */
export const BEARD_STYLES = ['none', 'stubble', 'moustache', 'goatee', 'full', 'braided'] as const;
export type BeardStyle = typeof BEARD_STYLES[number];
/** Face accessories from the townsfolk kit, the stand-in for D4's jewellery (C3). */
export const FACE_ACCESSORIES = ['none', 'eyepatch', 'spectacles', 'monocle', 'goggles'] as const;
export type FaceAccessory = typeof FACE_ACCESSORIES[number];

const KEYS_V2 = ['v', 'skin', 'hairStyle', 'hair', 'eyes', 'beard', 'face'];
const index = (n: unknown, len: number) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < len;

export function isHeroAppearance(v:unknown):v is HeroAppearance {
  if(!v||typeof v!=='object'||Array.isArray(v))return false;
  const keys=Object.keys(v);
  if((v as {v?:unknown}).v===2) {
    const a=v as HeroAppearanceV2;
    return keys.length===KEYS_V2.length&&keys.every(k=>KEYS_V2.includes(k))&&index(a.skin,SKIN_TONES.length)&&index(a.hair,HAIR_COLORS.length)&&index(a.eyes,EYE_COLORS.length)
      &&(HAIR_STYLES as readonly string[]).includes(a.hairStyle)&&(BEARD_STYLES as readonly string[]).includes(a.beard)&&(FACE_ACCESSORIES as readonly string[]).includes(a.face);
  }
  const a=v as HeroAppearanceV1;
  return keys.length===3&&isClassId(a.skin)&&isClassId(a.hair)&&isClassId(a.style);
}

export interface ResolvedAppearance { skin:number; hair:number; hairStyle:string; eyes:number; beard?:Exclude<BeardStyle,'none'>; face?:Exclude<FaceAccessory,'none'> }
export function appearanceFor(cls:ClassId,choice?:HeroAppearance):ResolvedAppearance {
  const base=CLASSES[cls].appearance;
  if(!isHeroAppearance(choice))return base;
  if('v' in choice) return {
    skin:SKIN_TONES[choice.skin], hair:HAIR_COLORS[choice.hair], hairStyle:choice.hairStyle, eyes:EYE_COLORS[choice.eyes],
    ...(choice.beard!=='none'?{beard:choice.beard}:{}), ...(choice.face!=='none'?{face:choice.face}:{}),
  };
  return {...base,skin:CLASSES[choice.skin].appearance.skin,hair:CLASSES[choice.hair].appearance.hair,hairStyle:CLASSES[choice.style].appearance.hairStyle};
}

/** The class look expressed as a v2 choice (the creator starts here; "Class look" returns here). */
export function classAppearance(cls:ClassId):HeroAppearanceV2 {
  const base=CLASSES[cls].appearance, near=(list:readonly number[],c:number)=>list.reduce((b,x,i)=>Math.abs(x-c)<Math.abs(list[b]-c)?i:b,0);
  return { v:2, skin:near(SKIN_TONES,base.skin), hairStyle:(HAIR_STYLES as readonly string[]).includes(base.hairStyle)?base.hairStyle as HairStyle:'short', hair:near(HAIR_COLORS,base.hair), eyes:near(EYE_COLORS,base.eyes), beard:'none', face:'none' };
}

/** A complete random hero (C8: randomise never leaves a part unfinished). Facial hair and accessories stay rarer. */
export function randomAppearance(rand:()=>number=Math.random):HeroAppearanceV2 {
  const pick=<T,>(list:readonly T[])=>list[Math.floor(rand()*list.length)];
  return { v:2, skin:Math.floor(rand()*SKIN_TONES.length), hairStyle:pick(HAIR_STYLES), hair:Math.floor(rand()*HAIR_COLORS.length), eyes:Math.floor(rand()*EYE_COLORS.length),
    beard:rand()<0.35?pick(BEARD_STYLES.slice(1)):'none', face:rand()<0.2?pick(FACE_ACCESSORIES.slice(1)):'none' };
}
export {CLASS_IDS as APPEARANCE_CHOICES};
