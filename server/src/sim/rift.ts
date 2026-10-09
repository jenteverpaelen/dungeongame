// Nephalem Rifts (ARCHITECTURE 1.7): progress per kill, Rift Guardian (slam, projectile ring, adds, enrage),
// completion (loot shower, town portal, stats, notices, onRiftComplete).

import { MONSTERS, RIFT_GUARDIANS, type RiftState } from '../shared';
import { elIdx } from './effects';
import type { Instance } from './instance';
import { dropFor } from './loot';
import { createMob } from './monsters';
import { touchChar } from './players';
import { spawnProj } from './projectiles';
import { nearPlayer, playerZoneLevel, themeMonsters, zoneDifficulty } from './spawner';
import { BOSS_ADDS_MS, BOSS_RING_COUNT, BOSS_RING_MS, RIFT_KILL_FRACTION } from './tuning';
import type { Mob, Pack, Player } from './types';
import { creditQuestRift } from '../quests';

export class RiftRuntime {
  progress = 0;
  phase: RiftState['phase'] = 'hunt';
  guardian = 0;
  private startT = -1;
  private endT = -1;
  private scale = 1;
  private summonAt = -1;
  private lastKiller: Player | null = null;

  constructor(private inst: Instance, readonly owner: string) {}

  /** Normalise progress so 100% needs ~85% of the monsters placed in the rift. */
  finalize() {
    let total = 0;
    for (const m of this.inst.mobs) total += m.progress;
    this.scale = total > 0 ? 100 / (total * RIFT_KILL_FRACTION) : 1;
  }

  onPlayerJoin(_p: Player) {
    if (this.startT < 0) this.startT = this.inst.t;
  }

  onKill(m: Mob, killer: Player | null) {
    if (this.phase === 'hunt' && m.progress > 0) {
      this.progress = Math.min(100, this.progress + m.progress * this.scale);
      if (killer) this.lastKiller = killer;
    }
    if (this.phase === 'guardian' && m.id === this.guardian) this.complete(m);
  }

  setFull(by: Player) {
    this.progress = 100;
    this.lastKiller = by;
  }

  state(): RiftState {
    const inst = this.inst;
    const s: RiftState = {
      progress: Math.round(this.progress * 10) / 10,
      phase: this.phase,
      level: inst.level,
      difficulty: inst.difficulty,
      elapsedMs: this.startT < 0 ? 0 : (this.endT >= 0 ? this.endT : inst.t) - this.startT,
      owner: this.owner,
    };
    if (this.guardian) s.guardian = this.guardian;
    return s;
  }

  tick() {
    if (this.phase !== 'hunt' || this.progress < 100) return;
    if (this.summonAt < 0) {
      this.summonAt = this.inst.t + 600;
      return;
    }
    if (this.inst.t >= this.summonAt) this.spawnGuardian();
  }

  private spawnGuardian() {
    const inst = this.inst;
    const near = this.lastKiller && inst.playerById(this.lastKiller.id) ? this.lastKiller : inst.players[0];
    let x = inst.map.entry.x, y = inst.map.entry.y;
    if (near) ({ x, y } = nearPlayer(inst, near, 280));
    const def = MONSTERS[RIFT_GUARDIANS[inst.zone.theme] ?? 'gorgemaw'];
    const pack: Pack = { id: -1, kind: 'boss', alive: 1, slot: -1 };
    const m = createMob(inst, def, inst.level, x, y, { tier: 4, pack, players: Math.max(1, Math.min(4, inst.players.length)) });
    m.state = 'chase';
    if (near) m.target = near.id;
    this.guardian = m.id;
    this.phase = 'guardian';
    inst.emit({ e: 'aoe', v: 'explode', x: Math.round(x), y: Math.round(y), r: 160, d: 800, el: elIdx('arcane'), s: m.id }, x, y);
    for (const p of inst.players) inst.emitTo(p.id, { e: 'shake', m: 5, d: 300 });
    inst.notice('The Rift Guardian has appeared!', 'boss');
  }

  private complete(m: Mob) {
    const inst = this.inst;
    this.phase = 'done';
    this.endT = inst.t;
    for (const p of inst.players) {
      dropFor(inst, p, m.x, m.y, m.level, 4);
      dropFor(inst, p, m.x, m.y, m.level, 2); // completion bonus per player
      p.save.stats.rifts++;
      creditQuestRift(inst,p);
      touchChar(p);
    }
    inst.spawnPortal({ kind: 'town', x: m.x, y: m.y + 40, label: 'To Hearthmere', ttlMs: 0 });
    const secs = Math.round((this.endT - Math.max(0, this.startT)) / 1000);
    inst.notice(`Rift completed in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}!`, 'rift');
    for (const p of inst.players) inst.emitTo(p.id, { e: 'shake', m: 6, d: 260 });
    try { inst.opts.onRiftComplete?.(); } catch (err) { console.error('[rift] onRiftComplete', err); }
  }
}

export function riftTick(r: RiftRuntime, _dtMs: number) {
  r.tick();
}

/** Rift Guardian abilities on top of its slam: projectile ring, adds, enrage. */
export function bossTick(inst: Instance, m: Mob, p: Player, dtMs: number) {
  const b = m.boss!;
  if (!b.enraged && m.hp < m.mhp * 0.3) {
    b.enraged = true;
    m.speed *= 1.3;
    inst.notice(`${m.name} is enraged!`, 'boss');
  }
  const dist = Math.hypot(p.x - m.x, p.y - m.y);
  b.ringMs -= dtMs;
  if (b.ringMs <= 0 && dist < 900) {
    b.ringMs = BOSS_RING_MS * (b.enraged ? 0.75 : 1);
    inst.emit({ e: 'tele', v: 'boss_ring', x: Math.round(m.x), y: Math.round(m.y), r: 360, d: 800 }, m.x, m.y);
    inst.sched.schedule(inst.t + 800, () => {
      if (m.dead) return;
      const off = inst.rng.next() * Math.PI * 2;
      for (let i = 0; i < BOSS_RING_COUNT; i++) {
        spawnProj(inst, {
          kind: 'ring', v: 'orb', mob: m, src: m.id, x: m.x, y: m.y - 20, angle: off + (i / BOSS_RING_COUNT) * Math.PI * 2, speed: 300,
          lifeMs: 2600, r: 14, el: m.def.attack.element, dmg: m.dmg * 0.55, mobLevel: m.level,
        });
      }
    });
  }
  b.addsMs -= dtMs;
  if (b.addsMs <= 0) {
    b.addsMs = BOSS_ADDS_MS;
    const roster = themeMonsters(inst.zone.theme).filter((d) => d.attack.kind !== 'explode');
    m.attackSeq++;
    m.attackFlagMs = 400;
    inst.emit({ e: 'aoe', v: 'nova', x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.r + 90), d: 500, el: elIdx('arcane'), s: m.id }, m.x, m.y);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = m.x + Math.cos(a) * (m.r + 70), y = m.y + Math.sin(a) * (m.r + 70);
      if (!inst.cw.isFree(x, y, 18)) continue;
      const def = roster[Math.floor(inst.rng.next() * roster.length)];
      const add = createMob(inst, def, m.level, x, y, { players: Math.max(1, Math.min(4, inst.players.length)), difficulty: m.diff });
      add.state = 'chase';
      add.target = p.id;
      inst.emit({ e: 'aoe', v: 'explode', x: Math.round(x), y: Math.round(y), r: 40, d: 400, el: elIdx('arcane'), s: m.id }, x, y);
    }
  }
}

/** debug 'boss': rifts summon their Guardian now; elsewhere spawn a Guardian next to the player. */
export function debugBoss(inst: Instance, p: Player): string | null {
  if (inst.rift) {
    if (inst.rift.phase !== 'hunt') return 'The Rift Guardian has already been summoned';
    inst.rift.setFull(p);
    return null;
  }
  const pos = nearPlayer(inst, p, 360);
  const def = MONSTERS[RIFT_GUARDIANS[inst.zone.theme === 'ashen' ? 'ashen' : 'glade']];
  const pack: Pack = { id: -1, kind: 'boss', alive: 1, slot: -1 };
  const m = createMob(inst, def, playerZoneLevel(inst, p), pos.x, pos.y, { tier: 4, pack, difficulty: zoneDifficulty(inst, p) });
  m.state = 'chase';
  m.target = p.id;
  inst.notice(`${def.name} has appeared!`, 'boss');
  return null;
}
