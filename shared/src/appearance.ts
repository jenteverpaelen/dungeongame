import { CLASSES, CLASS_IDS, isClassId } from './data/classes';
import type { ClassId } from './types';

/** Choices reuse original class art; absence preserves the original hero exactly. */
export interface HeroAppearance { skin:ClassId; hair:ClassId; style:ClassId }
export function isHeroAppearance(v:unknown):v is HeroAppearance {
  if(!v||typeof v!=='object'||Array.isArray(v))return false;
  const a=v as HeroAppearance;
  return Object.keys(a).length===3&&isClassId(a.skin)&&isClassId(a.hair)&&isClassId(a.style);
}
export function appearanceFor(cls:ClassId,choice?:HeroAppearance) {
  const base=CLASSES[cls].appearance;
  return isHeroAppearance(choice)?{...base,skin:CLASSES[choice.skin].appearance.skin,hair:CLASSES[choice.hair].appearance.hair,hairStyle:CLASSES[choice.style].appearance.hairStyle}:base;
}
export {CLASS_IDS as APPEARANCE_CHOICES};
