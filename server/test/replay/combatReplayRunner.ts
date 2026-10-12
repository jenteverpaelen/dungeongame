// One recorded or replayed combat run in a fresh process (entity ids come from a process-wide counter, so every run
// starts from the same id). Used by server/test/combatReplay.test.ts (F-TEL-07).
//
//   node --import tsx server/test/replay/combatReplayRunner.ts <config.json> <out.json>
//
// config: { seed, cls, level, zone, ticks, mode: 'record' | 'replay', inputs?: RecordedInput[] }
// out:    { inputs, tickHashes, final, summary }
//
// "record" drives the hero with a small deterministic policy (walk at the nearest live monster, dash when hurt, cast the
// slotted skills on a fixed rhythm) and writes down every input; "replay" feeds exactly those inputs back on the same
// ticks. Every snapshot is hashed except its wall-clock `time` field (interpolation only, never game state).
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Rng, autoSlotSkills, computeStats, createCharacter, ZONES, type S2C, type ClassId } from '../../src/shared';
import { createInstance, type Instance } from '../../src/sim/instance';
import type { PlayerLink } from '../../src/contracts';

/** `free`: when recorded, the hero was alive and not channelling, so a movement input takes effect that tick. */
export interface RecordedInput { tick: number; mx: number; my: number; dash?: 1; cast?: { slot: number; skill: string }; free?: 1 }
export interface ReplayConfig { seed: number; cls: ClassId; level: number; zone: string; ticks: number; mode: 'record' | 'replay'; inputs?: RecordedInput[] }
export interface ReplayResult { inputs: RecordedInput[]; tickHashes: string[]; final: string; summary: Record<string, number> }

export function runReplay(cfg: ReplayConfig): ReplayResult {
  const rng = new Rng(cfg.seed);
  Math.random = () => rng.next();
  const save = createCharacter('Replay', cfg.cls, cfg.seed);
  save.level = cfg.level;
  autoSlotSkills(save); // the skills a hero of this level has unlocked, as the game slots them on level-up
  const tickHashes: string[] = [];
  let chain = createHash('sha256');
  const counts: Record<string, number> = { snapshots: 0, events: 0, dmg: 0, die: 0, cast: 0 };
  let pending = createHash('sha256');
  const link: PlayerLink = {
    sessionId: 'replay', save, derived: computeStats(save), markDirty() {},
    send(msg: S2C) {
      if (msg.t !== 's') { pending.update(JSON.stringify(msg)); return; }
      counts.snapshots++;
      for (const ev of msg.ev ?? []) { counts.events++; if (ev.e in counts) counts[ev.e]++; }
      pending.update(JSON.stringify({ ...msg, time: 0 }));
    },
  };
  const inst = createInstance({ zoneId: cfg.zone, channel: 1, key: `${cfg.zone}#replay`, seed: cfg.seed, theme: ZONES[cfg.zone].theme }) as Instance;
  const inputs: RecordedInput[] = [];
  try {
    inst.addPlayer(link);
    const p = inst.players[0];
    const byTick = new Map<number, RecordedInput[]>();
    for (const i of cfg.inputs ?? []) { const l = byTick.get(i.tick) ?? []; l.push(i); byTick.set(i.tick, l); }
    let seq = 0;
    for (let t = 0; t < cfg.ticks; t++) {
      let now: RecordedInput[];
      if (cfg.mode === 'record') {
        let best = Infinity, tx = p.x, ty = p.y;
        for (const m of inst.mobs) { if (m.dead || m.dummy) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < best) { best = d; tx = m.x; ty = m.y; } }
        const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy);
        const near = l < 90;
        const input: RecordedInput = { tick: t, mx: near || l < 1 ? 0 : Math.round((dx / l) * 100) / 100, my: near || l < 1 ? 0 : Math.round((dy / l) * 100) / 100 };
        if (p.hp < p.mhp * 0.35 && p.mv.dashCdMs <= 0) input.dash = 1;
        if (p.deadMs <= 0 && !p.channel) input.free = 1;
        const slot = Math.floor(t / 40) % 4, skill = save.skills.slots[slot];
        if (t % 40 === 20 && skill) input.cast = { slot, skill };
        now = [input];
        inputs.push(input);
      } else now = byTick.get(t) ?? [];
      for (const i of now) {
        inst.queueInput(link, { t: 'in', seq: ++seq, mx: i.mx, my: i.my, ...(i.dash ? { dash: 1 as const } : {}) });
        if (i.cast) inst.requestSkillCast?.(link, i.cast.slot, i.cast.skill);
      }
      inst.tick();
      const h = pending.digest('hex');
      tickHashes.push(h); chain.update(h);
      pending = createHash('sha256');
    }
    const summary = { ...counts, kills: p.kills, level: save.level, xp: save.xp, gold: save.gold, hp: Math.round(p.hp), x: Math.round(p.x), y: Math.round(p.y) };
    return { inputs: cfg.mode === 'record' ? inputs : cfg.inputs ?? [], tickHashes, final: chain.digest('hex'), summary };
  } finally { inst.destroy(); }
}

if (process.argv[2] && process.argv[3]) {
  const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) as ReplayConfig;
  fs.writeFileSync(process.argv[3], JSON.stringify(runReplay(cfg)));
}
