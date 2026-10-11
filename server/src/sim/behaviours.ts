// Monster behaviour toolkit (F-MON-02): data-driven abilities on top of a monster's basic attack (MonsterDef.behaviours,
// shared/src/data/monsters.ts). The Rift Guardian's enrage and adds run through the same two runners with their
// original numbers (BOSS_ENRAGE / BOSS_ADDS), so the toolkit is exercised by existing content and changes nothing there.
//
// Already in the toolkit elsewhere: telegraphed windups (monsters.ts beginAttack, F_WINDUP), bounded physical charge,
// lob / fan / fracture / explode attacks, elite traits (elites.ts), taunt (status.ts → monsters.ts chase).
// Not here: a damage-absorbing shield needs a hook in the monster damage path (hurtMob in damage.ts, engine lane) —
// recorded as a dependency in docs/rework/partials/LOG.md.

import { MONSTERS, type MonsterBehaviour } from '../shared';
import { elIdx } from './effects';
import type { Instance } from './instance';
import { createMob } from './monsters';
import { themeMonsters } from './spawner';
import { BOSS_ADDS_MS } from './tuning';
import type { BehaviourState, Mob, Player } from './types';

type Enrage = Extract<MonsterBehaviour, { kind: 'enrage' }>;
type Summon = Extract<MonsterBehaviour, { kind: 'summon' }>;

/** Rift Guardian enrage (unchanged numbers: below 30 % life, ×1.3 speed, attacks every ×0.8, announced). */
export const BOSS_ENRAGE: Enrage = { kind: 'enrage', belowPct: 30, speedMul: 1.3, cooldownMul: 0.8, announce: true };
/** Rift Guardian adds (unchanged: first after 7 s, then every BOSS_ADDS_MS, six spots around it, no warning, rewarded). */
export const BOSS_ADDS: Summon = { kind: 'summon', firstMs: 7000, everyMs: BOSS_ADDS_MS, count: 6, maxAlive: Infinity, telegraphMs: 0, ring: 70, reward: true };

/** Has this monster's enrage condition been met? */
export function enrageDue(m: Mob, b: Enrage, fightMs: number): boolean {
  return (b.belowPct !== undefined && m.hp < m.mhp * (b.belowPct / 100)) || (b.afterMs !== undefined && fightMs >= b.afterMs);
}

/** Trigger an enrage once; `holder.enraged` is the boss state for guardians and BehaviourState for everything else. */
export function enrage(inst: Instance, m: Mob, b: Enrage, holder: { enraged: boolean }, fightMs = 0): boolean {
  if (holder.enraged || !enrageDue(m, b, fightMs)) return false;
  holder.enraged = true;
  m.speed *= b.speedMul;
  if (b.announce) inst.notice(`${m.name} is enraged!`, 'boss');
  else inst.emit({ e: 'aoe', v: 'nova', x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.r + 50), d: 400, el: elIdx('fire'), s: m.id }, m.x, m.y);
  return true;
}

/** Attack cooldown multiplier after an enrage (1 when calm). */
export function attackCooldownMul(m: Mob): number {
  if (m.boss) return m.boss.enraged ? BOSS_ENRAGE.cooldownMul : 1;
  return m.bh?.enraged ? m.bh.cooldownMul : 1;
}

/** Live monsters this summoner called up (the list is pruned as they die). */
function liveMinions(inst: Instance, ids: number[]): number {
  let keep = 0;
  for (const id of ids) { const q = inst.mob(id); if (q && !q.dead) ids[keep++] = id; }
  ids.length = keep;
  return keep;
}

/**
 * Call up monsters around `m`, aimed at `p`. Spots are fixed when the call starts; with a warning time each spot shows
 * a ground telegraph first and nothing appears if the summoner died meanwhile or the spot was taken.
 */
export function summon(inst: Instance, m: Mob, p: Player, b: Summon, minions: number[]): number {
  const room = Math.min(b.count, b.maxAlive - liveMinions(inst, minions));
  if (room <= 0) return 0;
  const roster = b.roster?.length
    ? b.roster.map((id) => MONSTERS[id]).filter((d) => !!d)
    : themeMonsters(inst.zone.theme).filter((d) => d.attack.kind !== 'explode');
  if (!roster.length) return 0;
  m.attackSeq++;
  m.attackFlagMs = 400;
  inst.emit({ e: 'aoe', v: 'nova', x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.r + 90), d: 500, el: elIdx('arcane'), s: m.id }, m.x, m.y);
  const spots: { x: number; y: number }[] = [];
  for (let i = 0; i < b.count && spots.length < room; i++) {
    const a = (i / b.count) * Math.PI * 2;
    const x = m.x + Math.cos(a) * (m.r + b.ring), y = m.y + Math.sin(a) * (m.r + b.ring);
    if (inst.cw.isFree(x, y, 18)) spots.push({ x, y });
  }
  const call = (x: number, y: number) => {
    const def = roster[Math.floor(inst.rng.next() * roster.length)];
    const add = createMob(inst, def, m.level, x, y, { players: Math.max(1, Math.min(4, inst.players.length)), difficulty: m.diff });
    add.state = 'chase';
    add.target = p.id;
    add.summonedBy = m.id;
    if (b.reward === false || (b.reward === undefined && !m.boss)) add.noReward = true;
    minions.push(add.id);
    inst.emit({ e: 'aoe', v: 'explode', x: Math.round(x), y: Math.round(y), r: 40, d: 400, el: elIdx('arcane'), s: m.id }, x, y);
  };
  if (b.telegraphMs <= 0) { for (const s of spots) call(s.x, s.y); return spots.length; }
  for (const s of spots) inst.emit({ e: 'tele', v: 'slam', x: Math.round(s.x), y: Math.round(s.y), r: 40, d: Math.round(b.telegraphMs) }, s.x, s.y);
  inst.sched.schedule(inst.t + b.telegraphMs, () => {
    if (m.dead) return;
    for (const s of spots) if (liveMinions(inst, minions) < b.maxAlive && inst.cw.isFree(s.x, s.y, 18)) call(s.x, s.y);
  });
  return spots.length;
}

/** The monster's behaviour runtime (also gives guardians a minion list). */
export function stateOf(m: Mob, list: readonly MonsterBehaviour[] = []): BehaviourState {
  return (m.bh ??= {
    enraged: false, speedMul: 1, cooldownMul: 1, fightMs: 0, startT: -1, minions: [],
    timers: list.map((b) => (b.kind === 'summon' ? b.firstMs ?? b.everyMs : 0)),
  });
}

/** Per chase tick for monsters whose definition lists behaviours (guardians use bossTick in rift.ts). */
export function tickBehaviours(inst: Instance, m: Mob, p: Player, dtMs: number) {
  const list = m.def.behaviours;
  if (!list?.length) return;
  const s = stateOf(m, list);
  if (s.startT < 0) s.startT = inst.t - dtMs;
  s.fightMs = inst.t - s.startT; // windups and recoveries count as fighting too
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.kind === 'enrage') {
      if (enrage(inst, m, b, s, s.fightMs)) { s.speedMul = b.speedMul; s.cooldownMul = b.cooldownMul; }
    } else if (b.kind === 'summon') {
      s.timers[i] -= dtMs;
      if (s.timers[i] <= 0) { s.timers[i] = b.everyMs; summon(inst, m, p, b, s.minions); }
    }
  }
}
