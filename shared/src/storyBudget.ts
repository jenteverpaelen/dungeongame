import { xpToNext } from './progression';
/** Share of a quest's level span that the quest itself pays out; the rest is earned by fighting.
 *  Quests used to pay whole levels (7 quests = level 1 to 20), which with kill XP on top is how a player reached
 *  level 13 "after a few quests". See docs/rework/BALANCE.md. */
export const STORY_XP_SHARE = 0.5;

/** Story awards sum the level curve over the quest's span, times `STORY_XP_SHARE`. Combat XP is additional. */
export function storyXp(from:number,to:number):number {
  let xp=0;for(let level=from;level<to;level++)xp+=xpToNext(level);return Math.round(xp*STORY_XP_SHARE);
}
