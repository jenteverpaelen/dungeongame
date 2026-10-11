// Bounty boards, server side (docs/rework/quests/DESIGN.md §5): actual authored deaths and actual event clears advance a
// character's board; a finished bounty pays gold and XP on the spot; the board cache spills loot at the board.
import { BOUNTY_BOARDS, CACHE_GOLD_UNITS, boardComplete, boardState, boardUnlocked, bountyDef, bountyGold, bountyKey, bountyNeed, bountyXp, drawBounties } from '../../shared/src/bounties';
import { questText } from '../../shared/src/data/questMessages';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import type { CharacterSave } from '../../shared/src/types';
import { XP_SHARE_RANGE } from './config';
import type { Session } from './net/session';
import type { Instance } from './sim/instance';
import { spawnLoot } from './sim/loot';
import { grantXp } from './sim/players';
import type { Mob, Player } from './sim/types';

function credit(inst: Instance, p: Player, match: (kind: string, target: string, family?: string) => boolean) {
  const zone = inst.map.zone;
  if (!BOUNTY_BOARDS[zone] || !boardUnlocked(p.save, zone)) return;
  const board = structuredClone(boardState(p.save, zone));
  let changed = false;
  board.picks.forEach((id, i) => {
    const def = bountyDef(zone, id);
    if (!def || board.done & (1 << i) || !match(def.kind, def.target, def.family)) return;
    board.progress[i] = Math.min(bountyNeed(def), board.progress[i] + 1); changed = true;
    if (board.progress[i] < bountyNeed(def)) return;
    board.done |= 1 << i;
    const gold = bountyGold(zone), xp = bountyXp(p.save.level);
    if (Number.isSafeInteger(p.save.gold + gold)) p.save.gold += gold;
    grantXp(inst, p, xp);
    inst.emitTo(p.id, { e: 'notice', kind: 'info', text: `${questText('bounty.tracker')}: ${questText(bountyKey(zone, id))} complete (+${gold.toLocaleString()} gold, +${xp.toLocaleString()} XP)` });
  });
  if (!changed) return;
  (p.save.bounties ??= {})[zone] = board;
  p.link.markDirty();
}

/** Same witness rule as quest kills: living, in this instance, within XP sharing range. */
export function creditBountyKill(inst: Instance, mob: Mob, witnesses: Player[]) {
  if (!mob.adventureSite || mob.noReward || mob.dummy || inst.kind !== 'field') return;
  for (const p of witnesses) {
    if (p.deadMs > 0 || p.hp <= 0 || inst.playerById(p.id) !== p || Math.hypot(p.x - mob.x, p.y - mob.y) > XP_SHARE_RANGE) continue;
    credit(inst, p, (kind, target, family) => kind === 'rare' ? mob.adventureSite === target && mob.tier === 2
      : kind === 'hunt' ? !mob.adventureTarget && mob.def.family === family : false);
  }
}
/** Called after an authoritative field event clear for its enrolled, living, nearby participants. */
export function creditBountyWave(inst: Instance, p: Player, event: string) {
  credit(inst, p, (kind, target) => kind === 'event' && target === event);
}

/** Board cache (R15, R18): gold, XP and a rare + a magic item spilled at the board; then a new set of three. */
export function bountyClaim(s: Session, inst: Instance): { ok: true; data?: Record<string, unknown> } | { ok: false; err: string } {
  const zone = inst.map.zone, save: CharacterSave = s.save;
  if (!BOUNTY_BOARDS[zone]) return { ok: false, err: 'No bounty board here' };
  if (!boardUnlocked(save, zone)) return { ok: false, err: questText('bounty.board.locked') };
  const board = boardState(save, zone);
  if (!boardComplete(board)) return { ok: false, err: 'Finish all three bounties first' };
  const p = inst.players.find((x) => x.link === s), spot = inst.map.adventure?.interactions.find((i) => i.id === 'bounty_board');
  if (!p || !spot) return { ok: false, err: 'Stand beside the bounty board' };
  const gold = bountyGold(zone, CACHE_GOLD_UNITS);
  if (!Number.isSafeInteger(save.gold + gold)) return { ok: false, err: 'This reward would exceed your gold capacity' };
  const [lo, hi] = inst.def.levelBand, ilvl = Math.max(lo, Math.min(hi, save.level)), rng = new Rng((Math.random() * 0xffffffff) >>> 0);
  for (const rarity of ['rare', 'magic'] as const) spawnLoot(inst, p, { type: 'item', item: generateItem(rng, { ilvl, classId: save.classId, rarity, smartChance: 1 }) }, spot.x, spot.y + 50);
  save.gold += gold;
  const cycle = board.cycle + 1, picks = drawBounties(save.id, zone, cycle);
  (save.bounties ??= {})[zone] = { cycle, picks, progress: picks.map(() => 0), done: 0 };
  grantXp(inst, p, bountyXp(save.level));
  s.changed(false);
  return { ok: true, data: { text: `${questText('bounty.board.cache')}: +${gold.toLocaleString()} gold`, cycle } };
}
