import { xpToNext } from './progression';
/** Fixed story awards sum the unchanged curve. Combat XP is additional (L108/L117). */
export function storyXp(from:number,to:number):number {
  let xp=0;for(let level=from;level<to;level++)xp+=xpToNext(level);return xp;
}
