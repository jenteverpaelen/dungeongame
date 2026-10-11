// Bounty boards (docs/rework/quests/DESIGN.md §5; REFERENCES R9, R15, R18, R22): one board per field zone, three
// bounties at a time drawn per character from the zone's pool, no accepting, paid on completion; a cache for the set.
import type { CharacterSave } from './types';
import { questText, type QuestMessageKey } from './data/questMessages';
import { ADVENTURES } from './adventure';
import type { MonsterDef } from './data/monsters';
import { ZONES } from './data/zones';
import { monsterXp } from './progression';
import { strSeed, h01 } from './zoneKit';
import { questCompleted } from './quests';

export interface BountyDef {
  id: string;
  /** `event`: clear the zone's field event; `rare`: defeat the champion leading that authored pack; `hunt`: defeat
   *  `count` authored monsters of one family anywhere in the zone. */
  kind: 'event' | 'rare' | 'hunt';
  target: string;
  family?: MonsterDef['family'];
  count?: number;
}
export interface BountyBoardState {
  /** Sets finished (caches claimed) on this board; picks are drawn from it. */
  cycle: number;
  picks: string[];
  progress: number[];
  /** Bit i: bounty i of the current set was completed and paid. */
  done: number;
}
type Board = { unlock: string; pool: BountyDef[] };
const ev = (target: string): BountyDef => ({ id: `ev_${target}`, kind: 'event', target });
const rare = (target: string): BountyDef => ({ id: `rare_${target}`, kind: 'rare', target });
const hunt = (family: NonNullable<BountyDef['family']>, count: number): BountyDef => ({ id: `hunt_${family}`, kind: 'hunt', target: '*', family, count });
/** A board opens with the zone's story (the quest that opens the next zone): story first, then a reason to return. */
export const BOUNTY_BOARDS: Readonly<Record<string, Board>> = {
  rillwake_crossing: { unlock: 'high_water', pool: [ev('shallows_swarm'), ev('survey_alarm'), rare('brackjaw'), rare('chapel_rare'), hunt('slime', 12), hunt('mushroom', 10), hunt('bat', 8)] },
  bracken_sluice: { unlock: 'pressure_below', pool: [ev('bursting_weir'), rare('grindle'), hunt('bat', 8), hunt('boar', 5), hunt('crab', 8), hunt('slime', 12)] },
  cairnspill_terraces: { unlock: 'stone_road', pool: [ev('rockfall_warning'), rare('grindstone'), rare('foreman'), hunt('beetle', 8), hunt('moth', 8), hunt('boar', 5)] },
  cinderwash_kilns: { unlock: 'untended_fires', pool: [ev('flare_up'), rare('cinderhusk'), rare('flats_rare'), rare('store'), hunt('imp', 10), hunt('cultist', 6)] },
  kilnwatch_crown: { unlock: 'last_draw', pool: [ev('chimney_collapse'), rare('slagmaw'), rare('watch'), hunt('imp', 10), hunt('skeleton', 8), hunt('beetle', 6)] },
  sablefen_causeway: { unlock: 'broken_toll', pool: [ev('tide_of_skimmers'), rare('mudgullet'), rare('chainwatch'), hunt('shrimp', 10), hunt('boar', 5), hunt('moth', 6)] },
  saltwind_pans: { unlock: 'sealed_brine', pool: [ev('boil_over'), rare('white_clerk'), rare('boiler'), hunt('skeleton', 8), hunt('crab', 6), hunt('shrimp', 8)] },
  shiverline_escarpment: { unlock: 'open_beacon', pool: [ev('gale_harriers'), rare('rimecrown'), rare('interceptor'), hunt('moth', 8), hunt('goat', 6), hunt('cultist', 6)] },
  beaconbreak_ward: { unlock: 'false_command', pool: [ev('granary_riot'), rare('second_seal'), rare('gatekeeper'), hunt('cultist', 8), hunt('skeleton', 8), hunt('moth', 6)] },
};
export const BOUNTIES_PER_BOARD = 3;
export const bountyKey = (zone: string, id: string) => `bounty.${zone}.${id}` as QuestMessageKey;
export const bountyNeed = (b: BountyDef) => b.kind === 'hunt' ? b.count ?? 1 : 1;
export const bountyDef = (zone: string, id: string) => BOUNTY_BOARDS[zone]?.pool.find((b) => b.id === id);
export function boardUnlocked(save: CharacterSave, zone: string): boolean {
  const b = BOUNTY_BOARDS[zone]; return !!b && questCompleted(save, b.unlock);
}
/** Deterministic per character, zone and set: the same three until the set's cache is claimed. At most one event. */
export function drawBounties(saveId: string, zone: string, cycle: number): string[] {
  const pool = BOUNTY_BOARDS[zone]?.pool ?? [], seed = strSeed(`${saveId}/${zone}`);
  const order = pool.map((b, i) => ({ b, k: h01(i + 1, cycle + 1, seed) })).sort((a, b) => a.k - b.k).map((e) => e.b);
  const picks: BountyDef[] = [];
  for (const b of order) { if (picks.length >= BOUNTIES_PER_BOARD) break; if (b.kind === 'event' && picks.some((p) => p.kind === 'event')) continue; picks.push(b); }
  for (const b of order) if (picks.length < BOUNTIES_PER_BOARD && !picks.includes(b)) picks.push(b);
  return picks.map((b) => b.id);
}
/** Current board state (a fresh set when none is saved yet). Never mutates the save. */
export function boardState(save: CharacterSave, zone: string): BountyBoardState {
  const saved = save.bounties?.[zone];
  if (saved && validBoard(zone, saved)) return saved;
  const cycle = saved && Number.isSafeInteger(saved.cycle) && saved.cycle >= 0 ? saved.cycle : 0;
  const picks = drawBounties(save.id, zone, cycle);
  return { cycle, picks, progress: picks.map(() => 0), done: 0 };
}
export function validBoard(zone: string, s: BountyBoardState): boolean {
  return !!s && Number.isSafeInteger(s.cycle) && s.cycle >= 0 && Array.isArray(s.picks) && s.picks.length === BOUNTIES_PER_BOARD
    && new Set(s.picks).size === s.picks.length && s.picks.every((id) => !!bountyDef(zone, id))
    && Array.isArray(s.progress) && s.progress.length === s.picks.length
    && s.progress.every((n, i) => Number.isSafeInteger(n) && n >= 0 && n <= bountyNeed(bountyDef(zone, s.picks[i])!))
    && Number.isInteger(s.done) && s.done >= 0 && s.done < 1 << s.picks.length;
}
export const boardComplete = (s: BountyBoardState) => s.done === (1 << s.picks.length) - 1;
/** Mean ground gold pile at the zone's middle level × units × 1.5: the formula the old event contracts paid. */
const pile = (level: number) => (4 + 2.5 * level) * Math.pow(1.06, level);
export function bountyGold(zone: string, units = 8): number { const [lo, hi] = ZONES[zone].levelBand; return Math.round(units * pile((lo + hi) / 2) * 1.5); }
/** 25 ordinary Normal kills at the player's level per bounty and for the cache (DESIGN.md §5 budget). */
export const BOUNTY_KILLS_XP = 25;
export const bountyXp = (level: number) => monsterXp(level, 0, 0) * BOUNTY_KILLS_XP;
export const CACHE_GOLD_UNITS = 12;
/** Drop the save's board entries for zones that do not exist and repair malformed ones (normalizeSave). */
export function normalizeBounties(save: CharacterSave) {
  if (!save.bounties) return;
  if (typeof save.bounties !== 'object' || Array.isArray(save.bounties)) { delete save.bounties; return; }
  for (const [zone, s] of Object.entries(save.bounties)) {
    if (!BOUNTY_BOARDS[zone]) { delete save.bounties[zone]; continue; }
    if (!validBoard(zone, s)) save.bounties[zone] = boardState({ ...save, bounties: { [zone]: s } } as CharacterSave, zone);
  }
}
/** One-line objective for a bounty, from the zone's own data (event name, champion name, family). */
export function bountyObjective(zone: string, d: BountyDef): string {
  const a = ADVENTURES[zone];
  if (d.kind === 'event') return questText('bounty.do.event').replace('{name}', a?.events?.find((e) => e.id === d.target)?.name ?? d.target);
  if (d.kind === 'rare') return questText('bounty.do.rare').replace('{name}', a?.encounters.find((e) => e.id === d.target)?.members.find((m) => m.tier === 2)?.name ?? d.target);
  return questText('bounty.do.hunt').replace('{count}', String(d.count ?? 1)).replace('{family}', questText(`bounty.family.${d.family}` as QuestMessageKey));
}
