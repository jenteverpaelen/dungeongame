// Mage skill behaviour (server authority). Data: shared/src/data/skills/mage.ts.
// Magic Missile, Meteor, Black Hole, Frost Nova (+ Shatter), Hydra (+ hydra AI), Magic Weapon.

import type { Element } from '../../shared';
import { modVar, skillBuffBonuses } from '../../shared';
import { bestPoint, pickTarget } from '../brain';
import { expectedDamage, strikeMob } from '../damage';
import { addBuff, ccFactor, elIdx, freezeMob } from '../effects';
import { addGround, newGround } from '../grounds';
import type { Instance } from '../instance';
import { maxSummonsOf, skillDurationMs, skillElement, skillMult, skillPct, skillRadius } from '../playerctx';
import { spawnProj } from '../projectiles';
import { spawnSummon } from '../summons';
import { PB_BATTERY, PB_CHILL, PB_FREEZE, type Mob, type Player, type SkillRuntime, type Strike, type Summon } from '../types';
import {
  DEG, emitCast, face, faceTo, fanAngles, strikeOf, trimSummons,
  type DeathHook, type SkillBehaviour, type SummonBehaviour,
} from './common';

// ─────────────────────────── Magic Missile (primary) ───────────────────────────

function magicMissile(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) {
  const n = 1 + (rt.mods.projectiles ?? 0);
  const base = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  const st: Strike = { ...strikeOf(p, rt), primary: true };
  const homing = rt.flags.has('homing');
  let bits = 0;
  if (rt.flags.has('freezeChance')) bits |= PB_FREEZE;
  if ((rt.mods.gen ?? 0) > 0) bits |= PB_BATTERY;
  for (const off of fanAngles(n, 8 * DEG)) {
    spawnProj(inst, {
      kind: 'missile', v: 'missile', owner: p, src: p.id, x: p.x, y: p.y - 6, angle: base + off, speed: 800, lifeMs: 760, r: 12,
      el: st.el, strike: st, homing: homing ? tgt.id : 0, turn: homing ? 5 : 0, seek: homing, bits,
    });
  }
  emitCast(inst, p, rt, tgt.x, tgt.y);
}

// ─────────────────────────── Meteor ───────────────────────────

function meteor(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  face(p, bp.x);
  dropMeteor(inst, p, rt, bp.x, bp.y, radius);
  if (rt.flags.has('secondMeteor')) {
    let best: Mob | null = null, bd = Infinity;
    for (const m of inst.queryMobs(bp.x, bp.y, 400)) {
      if (m.dead) continue;
      if (Math.hypot(m.x-p.x,m.y-p.y)>rt.def.range)continue;
      const d = Math.hypot(m.x - bp.x, m.y - bp.y);
      // Spread the second impact (never exactly on the first) but stay reliable: after the C107 reach cuts packs close
      // into one blob, and a 0.9x exclusion left the set bonus firing in 0 of 14 casts in the simulation.
      if (d < radius * 0.5) continue;
      if (d < bd) { bd = d; best = m; }
    }
    if (best) dropMeteor(inst, p, rt, best.x, best.y, radius);
  }
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

function dropMeteor(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, radius: number) {
  const fall = rt.flags.has('fastMeteor') ? 500 : 1000;
  const el = skillElement(rt);
  const comet = rt.flags.has('freeze');
  if (rt.flags.has('shower')) {
    for (let i = 0; i < 7; i++) {
      const a = inst.rng.next() * Math.PI * 2, d = Math.sqrt(inst.rng.next()) * radius * 1.6;
      const mx = x + Math.cos(a) * d, my = y + Math.sin(a) * d;
      const r = radius * 0.55;
      const delay = i * 170;
      inst.sched.schedule(inst.t + delay, () => {
        if (!inst.playerById(p.id)) return;
        inst.emit({ e: 'tele', v: 'meteor', x: Math.round(mx), y: Math.round(my), r: Math.round(r), d: fall }, mx, my, p.id);
        inst.sched.schedule(inst.t + fall, () => meteorImpact(inst, p, rt, mx, my, r, 0.37, el, comet, true));
      });
    }
    return;
  }
  inst.emit({ e: 'tele', v: 'meteor', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: fall }, x, y, p.id);
  inst.sched.schedule(inst.t + fall, () => meteorImpact(inst, p, rt, x, y, radius, 1, el, comet, false));
}

function meteorImpact(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, radius: number, scale: number, el: Element, comet: boolean, small: boolean) {
  if (!inst.playerById(p.id)) return;
  const st: Strike = { ...strikeOf(p, rt, rt.def.coef * scale), el };
  for (const m of inst.queryMobs(x, y, radius)) {
    if (m.dead) continue;
    const r = strikeMob(inst, p, m, st);
    if (comet && !r.killed && !m.dead) freezeMob(m, 1500, 0, 0, inst, p);
  }
  inst.emit({ e: 'aoe', v: small ? 'meteorSmall' : 'meteor', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: 600, el: elIdx(el), s: p.id }, x, y, p.id);
  if (!small) for (const q of inst.playersNear(x, y, 700)) inst.emitTo(q.id, { e: 'shake', m: q === p ? 4 : 2, d: 160 });
  if (comet) return;
  // Molten ground: 235% weapon damage over 3 s (Cindervane: lasts twice as long).
  const dur = 3000 * (rt.flags.has('moltenDouble') ? 2 : 1);
  const ms: Strike = { ...strikeOf(p, rt, 2.35 * scale), el: 'fire' };
  const g = newGround('molten', x, y, radius * 0.9, inst.t, dur, 500);
  g.owner = p;
  g.strike = ms;
  g.el = 'fire';
  g.dmg = expectedDamage(inst, p, ms) / 6;
  addGround(inst, g);
  inst.emit({ e: 'aoe', v: 'molten', x: Math.round(x), y: Math.round(y), r: Math.round(radius * 0.9), d: dur, el: elIdx('fire'), s: p.id }, x, y, p.id);
}

// ─────────────────────────── Black Hole ───────────────────────────

function blackHole(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  face(p, bp.x);
  const dur = skillDurationMs(rt);
  const ticks = Math.max(1, Math.round((rt.def.duration * 1000) / 250));
  const g = newGround('blackhole', bp.x, bp.y, radius, inst.t, dur, 250);
  g.owner = p;
  g.el = skillElement(rt);
  g.strike = strikeOf(p, rt, rt.def.coef / ticks);
  g.freeze = rt.flags.has('freeze');
  g.voidPct = rt.flags.has('voidHeart') ? modVar(rt.mods, 'voidPct') : 0; // Heart of the Void
  g.caught = new Set();
  addGround(inst, g);
  if (rt.flags.has('spellsteal')) {
    let n = 0;
    for (const m of inst.queryMobs(bp.x, bp.y, radius)) if (!m.dead) n++;
    if (n > 0) addBuff(p, { id: 'spellsteal', ms: 10000, dmg: 3 * Math.min(10, n), st: Math.min(10, n) });
  }
  inst.emit({ e: 'aoe', v: 'blackhole', x: Math.round(bp.x), y: Math.round(bp.y), r: Math.round(radius), d: Math.round(dur), el: elIdx(g.el), s: p.id }, bp.x, bp.y, p.id);
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

// ─────────────────────────── Frost Nova ───────────────────────────

function frostNova(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  castNova(inst, p, rt, p.x, p.y, radius, skillDurationMs(rt), 0, 1);
  emitCast(inst, p, rt, p.x, p.y, radius);
  return true;
}

function castNova(inst: Instance, p: Player, rt: SkillRuntime, x: number, y: number, radius: number, freezeMs: number, depth: number, scale: number) {
  const st = strikeOf(p, rt, rt.def.coef * scale);
  const shatter = rt.flags.has('shatterNova');
  let frozen = 0;
  for (const m of inst.queryMobs(x, y, radius)) {
    if (m.dead) continue;
    freezeMob(m, freezeMs, shatter ? p.id : 0, depth, inst, p);
    if (ccFactor(m) > 0) frozen++;
    strikeMob(inst, p, m, st);
  }
  inst.emit({ e: 'aoe', v: 'nova', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: 450, el: elIdx(st.el), s: p.id }, x, y, p.id);
  if (depth === 0 && rt.flags.has('deepFreeze') && frozen >= 5) addBuff(p, { id: 'deep_freeze', ms: 11000, chc: 10 });
}

/** Shatter: frozen enemies explode into another (smaller) Frost Nova; no chains deeper than one. */
export const shatterHook: DeathHook = (inst, m) => {
  if (m.freezeMs > 0 && m.shatterBy && m.shatterDepth < 1) {
    const owner = inst.playerById(m.shatterBy);
    const rt = owner?.ctx.slotted('frost_nova');
    if (owner && rt) {
      const x = m.x, y = m.y;
      inst.sched.schedule(inst.t + 50, () => castNova(inst, owner, rt, x, y, skillRadius(rt) * 0.6, skillDurationMs(rt) * 0.5, 1, 0.6));
    }
  }
};

// ─────────────────────────── Hydra ───────────────────────────

function hydra(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const t = pickTarget(inst, p.x, p.y, rt.def.range, false, p.save.skills.targetPriority);
  if (!t) return false;
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  let x = p.x + Math.cos(a) * 60, y = p.y + Math.sin(a) * 60;
  if (!inst.cw.isFree(x, y, 16)) { x = p.x; y = p.y; }
  const mammoth = rt.flags.has('mammoth');
  spawnSummon(inst, p, 'hydra', 'hydra', x, y, skillDurationMs(rt), mammoth);
  trimSummons(p, 'hydra', mammoth ? 1 : maxSummonsOf(rt));
  emitCast(inst, p, rt, x, y);
  return true;
}

function hydraAi(inst: Instance, s: Summon, p: Player, dtMs: number) {
  const rt = p.ctx.modsOf('hydra');
  const el = skillElement(rt);
  const base: Strike = { skill: 'hydra', coef: rt.def.coef, el, pct: skillPct(p, rt), mult: skillMult(p, 'hydra'), src: s.id };
  s.fireMs -= dtMs;
  if (s.fireMs > 0) return;
  const tgt = pickTarget(inst, s.x, s.y, rt.def.radius, true, p.save.skills.targetPriority);
  if (!tgt) { s.fireMs = 150; return; }
  faceTo(s, tgt.x);
  s.attackSeq++;
  s.attackFlagMs = 220;
  const a = Math.atan2(tgt.y - s.y, tgt.x - s.x);
  if (s.big) {
    // Mammoth Hydra: a river of fire that burns everything along its path.
    s.fireMs += 900;
    spawnProj(inst, {
      kind: 'river', v: 'fireball', sz: 2, owner: p, src: s.id, x: s.x, y: s.y - 30, angle: a, speed: 720, lifeMs: 700, r: 34, el,
      pierce: 1, hits: new Set(), strike: { ...base, coef: base.coef * 0.9 },
    });
    return;
  }
  // Three heads fire in turn: one shot every 0.3 s, each 30% of the per-second coefficient.
  s.fireMs += 300;
  s.aux = (s.aux + 1) % 3;
  const splash = rt.flags.has('splash');
  const frost = rt.flags.has('chill');
  spawnProj(inst, {
    kind: 'fireball', v: splash ? 'orb' : frost ? 'shard' : 'fireball', owner: p, src: s.id, x: s.x + (s.aux - 1) * 10, y: s.y - 28,
    angle: a, speed: 600, lifeMs: 950, r: 12, el, splash: splash ? 60 : frost ? 0 : 40, homing: tgt.id, turn: 2.5,
    strike: { ...base, coef: base.coef * 0.3 }, bits: frost ? PB_CHILL : 0,
  });
}

// ─────────────────────────── Magic Weapon ───────────────────────────

function magicWeapon(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  addBuff(p, { id: 'magic_weapon', ms: skillDurationMs(rt), ...skillBuffBonuses('magic_weapon', rt.flags) });
  emitCast(inst, p, rt, p.x, p.y);
  return true;
}

// ─────────────────────────── Registration ───────────────────────────

export const MAGE_BEHAVIOURS: Record<string, SkillBehaviour> = {
  magic_missile: { primary: magicMissile },
  meteor: { cast: meteor },
  black_hole: { cast: blackHole },
  frost_nova: { cast: frostNova },
  hydra: { cast: hydra },
  magic_weapon: { cast: magicWeapon },
};

export const MAGE_SUMMONS: Record<string, SummonBehaviour> = {
  hydra: { radius: 24, actsWhileOwnerDead: true, update: hydraAi },
};
