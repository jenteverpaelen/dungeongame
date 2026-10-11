import { xpToNext } from './progression';
/** Share of a quest's level span that the quest itself pays out; the rest is earned by fighting.
 *  Quests used to pay whole levels (7 quests = level 1 to 20), which with kill XP on top is how a player reached
 *  level 13 "after a few quests". See docs/rework/BALANCE.md. */
export const STORY_XP_SHARE = 0.5;
/** In a zone with a side story, the side story takes this share of the zone's quest XP and the story quests the rest, so
 *  the total stays `storyXp(1, 50)` (docs/rework/quests/DESIGN.md §9). */
export const SIDE_XP_SHARE = 0.2;

function spanXp(from: number, to: number): number { let xp = 0; for (let level = from; level < to; level++) xp += xpToNext(level); return xp * STORY_XP_SHARE; }
/** Story awards sum the level curve over the quest's span, times `STORY_XP_SHARE`. Combat XP is additional. */
export function storyXp(from: number, to: number): number { return Math.round(spanXp(from, to)); }
/** A story quest in a zone that also has a side story. */
export function storyMainXp(from: number, to: number): number { return Math.round(spanXp(from, to) * (1 - SIDE_XP_SHARE)); }
/** The zone's side story: `SIDE_XP_SHARE` of the whole zone span. */
export function sideXp(zoneFrom: number, zoneTo: number): number { return Math.round(spanXp(zoneFrom, zoneTo) * SIDE_XP_SHARE); }
/** Zones with a side story and their level span (the side story's XP is `sideXp` of the span). */
export const SIDE_SPANS: Readonly<Record<string, [number, number]>> = {
  rillwake_crossing: [1, 4], bracken_sluice: [4, 7], cairnspill_terraces: [9, 12], cinderwash_kilns: [12, 16], kilnwatch_crown: [16, 20],
  sablefen_causeway: [20, 25], saltwind_pans: [25, 30], shiverline_escarpment: [35, 40], beaconbreak_ward: [40, 45],
};
export const sideXpFor = (zone: string): number => { const s = SIDE_SPANS[zone]; return s ? sideXp(s[0], s[1]) : 0; };
