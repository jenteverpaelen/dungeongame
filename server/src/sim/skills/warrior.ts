// Warrior skill behaviour (server authority). Data: shared/src/data/skills/warrior.ts.
// Cleave, Whirlwind (channel + Dust Devils), Rend, Ground Stomp, Seismic Slam, Battle Rage.

import { modVar, skillBuffBonuses } from '../../shared';
import { bestConeAngle, pickTarget } from '../brain';
import { gainResource, makeDot, strikeMob } from '../damage';
import { addBuff, addDot, chillMob, dragMob, elIdx, getBuff, hasDot, inCone, knockbackMob, stunMob } from '../effects';
import type { Instance } from '../instance';
import { skillDurationMs, skillElement, skillMult, skillPct, skillRadius } from '../playerctx';
import { moveSummon, spawnSummon } from '../summons';
import type { ChannelState, Mob, Player, SkillRuntime, Strike, Summon } from '../types';
import { DEG, emitCast, face, strikeOf, type DeathHook, type SkillBehaviour, type SummonBehaviour } from './common';

// ─────────────────────────── Cleave (primary) ───────────────────────────

function cleave(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) {
  const ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  const half = (rt.flags.has('wideArc') ? 90 : 60) * DEG;
  const radius = skillRadius(rt);
  const st: Strike = { ...strikeOf(p, rt), primary: true };
  let hit = 0;
  for (const m of inst.queryMobs(p.x, p.y, radius)) {
    if (m.dead || !inCone(m.x, m.y, m.r, p.x, p.y, ang, half, radius)) continue;
    strikeMob(inst, p, m, st);
    hit++;
  }
  if (hit) gainResource(p, rt.def.gen + (rt.mods.gen ?? 0));
  if (rt.flags.has('momentum')) {
    const b = getBuff(p, 'momentum');
    addBuff(p, { id: 'momentum', ms: 3000, ias: 3, st: Math.min(5, (b?.st ?? 0) + 1) });
  }
  const tx = p.x + Math.cos(ang) * radius, ty = p.y + Math.sin(ang) * radius;
  emitCast(inst, p, rt, tx, ty, radius);
  inst.emit({ e: 'aoe', v: 'cleave', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), d: 220, el: elIdx(st.el), s: p.id, a: +ang.toFixed(3) }, p.x, p.y, p.id);
}

// ─────────────────────────── Whirlwind (channel) ───────────────────────────

function whirlwindTick(inst: Instance, p: Player, rt: SkillRuntime, ch: ChannelState, dtMs: number) {
  ch.tickMs -= dtMs;
  if (ch.tickMs <= 0) {
    ch.tickMs += 250;
    const radius = skillRadius(rt);
    const st = strikeOf(p, rt, rt.def.coef / 4);
    const rend = rt.flags.has('whirlRend') ? p.ctx.modsOf('rend') : null;
    for (const m of inst.queryMobs(p.x, p.y, radius)) {
      if (m.dead) continue;
      const r = strikeMob(inst, p, m, st);
      // 4pc: the bleed Whirlwind applies is Whirlwind damage, so the 6pc multiplier applies to it too
      if (rend && !r.killed && !m.dead) applyRend(inst, p, rend, m, skillMult(p, 'whirlwind') * 3); // 4pc: bleed +200%
    }
    inst.emit({ e: 'aoe', v: 'whirl', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), d: 260, el: elIdx(st.el), s: p.id }, p.x, p.y, p.id);
  }
  if (rt.flags.has('dustDevils')) {
    ch.devilMs -= dtMs;
    if (ch.devilMs <= 0) {
      ch.devilMs += 1000;
      const a2 = inst.rng.next() * Math.PI * 2;
      spawnSummon(inst, p, 'dust_devil', 'whirlwind', p.x + Math.cos(a2) * 30, p.y + Math.sin(a2) * 30, 3000);
    }
  }
}

function applyRend(inst: Instance, p: Player, rt: SkillRuntime, m: Mob, mult = 1) {
  const dur = skillDurationMs(rt);
  const st = strikeOf(p, rt);
  st.mult = (st.mult ?? 1) * mult;
  addDot(m, makeDot(inst, p, st, 'bleed', dur, 500, { heal: rt.flags.has('bleedHeal'), spread: rt.flags.has('bleedSpread') }));
}

/** Dust Devil: wanders through nearby enemies for its life, ticking every 0.25 s. */
function dustDevil(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number) {
  s.wanderMs -= dtMs;
  if (s.wanderMs <= 0) {
    s.wanderMs = 600;
    const near = inst.queryMobs(s.x, s.y, 280);
    const alive = near.filter((m) => !m.dead);
    if (alive.length) {
      const m = alive[Math.floor(inst.rng.next() * alive.length)];
      s.tx = m.x + (inst.rng.next() - 0.5) * 60;
      s.ty = m.y + (inst.rng.next() - 0.5) * 60;
    } else {
      const a = inst.rng.next() * Math.PI * 2;
      s.tx = s.x + Math.cos(a) * 140;
      s.ty = s.y + Math.sin(a) * 140;
    }
  }
  moveSummon(inst, s, s.tx, s.ty, 250, dtS, 4);
  s.tickMs -= dtMs;
  if (s.tickMs > 0) return;
  s.tickMs += 250;
  const ww = p.ctx.modsOf('whirlwind');
  const pct = skillPct(p, ww) + modVar(ww.mods, 'dustDevilPct'); // The Ninefold Gale
  const st: Strike = { skill: 'dust_devil', coef: 1.2 * 0.25, el: skillElement(ww), pct, mult: skillMult(p, 'dust_devil'), src: s.id };
  for (const m of inst.queryMobs(s.x, s.y, 45)) if (!m.dead) strikeMob(inst, p, m, st);
}

// ─────────────────────────── Slot skills ───────────────────────────

function rend(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  let n = 0;
  for (const m of inst.queryMobs(p.x, p.y, radius)) {
    if (m.dead) continue;
    applyRend(inst, p, rt, m);
    n++;
  }
  if (!n) return false;
  emitCast(inst, p, rt, p.x, p.y, radius);
  inst.emit({ e: 'aoe', v: 'rend', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), d: 420, el: elIdx('physical'), s: p.id }, p.x, p.y, p.id);
  return true;
}

function groundStomp(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  if (rt.flags.has('pull')) {
    for (const m of inst.queryMobs(p.x, p.y, 320)) {
      if (m.dead) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > 60 + m.r) dragMob(inst, m, p.x, p.y, d - 50 - m.r);
    }
  }
  const st = strikeOf(p, rt);
  const stunMs = skillDurationMs(rt);
  for (const m of inst.queryMobs(p.x, p.y, radius)) {
    if (m.dead) continue;
    stunMob(m, stunMs); // stun first so Jarring Slam / Anvil vulnerability applies to the stomp itself
    strikeMob(inst, p, m, st);
  }
  gainResource(p, rt.def.gen + (rt.mods.gen ?? 0));
  emitCast(inst, p, rt, p.x, p.y, radius);
  inst.emit({ e: 'aoe', v: 'stomp', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), d: 500, el: elIdx(st.el), s: p.id }, p.x, p.y, p.id);
  inst.emitTo(p.id, { e: 'shake', m: 3, d: 140 });
  return true;
}

function seismicSlam(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const mul = Math.max(1, skillRadius(rt) / rt.def.radius);
  const len = rt.def.range * Math.min(1.6, mul);
  const half = 30 * DEG * mul;
  let ang = bestConeAngle(inst, p.x, p.y, len, half);
  if (ang === null) {
    const t = pickTarget(inst, p.x, p.y, len, false, p.save.skills.targetPriority);
    if (!t) return false;
    ang = Math.atan2(t.y - p.y, t.x - p.x);
  }
  face(p, p.x + Math.cos(ang) * 10);
  const st = strikeOf(p, rt);
  const ox = p.x, oy = p.y;
  const kb = rt.flags.has('knockback') ? 90 : 22;
  const chill = rt.flags.has('chill');
  const hitCone = (s: Strike, push: boolean) => {
    for (const m of inst.queryMobs(ox, oy, len)) {
      if (m.dead || !inCone(m.x, m.y, m.r, ox, oy, ang!, half, len)) continue;
      const r = strikeMob(inst, p, m, s);
      if (r.killed || m.dead) continue;
      if (push) knockbackMob(m, m.x - ox, m.y - oy, kb);
      if (chill) chillMob(m, 2000);
    }
  };
  hitCone(st, true);
  if (rt.flags.has('aftershock')) {
    for (let i = 1; i <= 4; i++) inst.sched.schedule(inst.t + i * 250, () => hitCone({ ...st, coef: st.coef * 0.25, noArea: true }, false));
  }
  emitCast(inst, p, rt, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len, len);
  inst.emit({ e: 'aoe', v: 'fissure', x: Math.round(ox), y: Math.round(oy), r: Math.round(len), d: rt.flags.has('aftershock') ? 1100 : 650, el: elIdx(st.el), s: p.id, a: +ang.toFixed(3) }, ox + Math.cos(ang) * len / 2, oy + Math.sin(ang) * len / 2, p.id);
  return true;
}

function battleRage(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  addBuff(p, { id: 'battle_rage', ms: skillDurationMs(rt), ...skillBuffBonuses('battle_rage', rt.flags) });
  emitCast(inst, p, rt, p.x, p.y);
  return true;
}

// ─────────────────────────── Death hooks ───────────────────────────

/** Contagion: bleeds spread to up to 3 nearby enemies. */
export const contagionHook: DeathHook = (inst, m) => {
  for (const d of m.dots) {
    if (d.kind !== 'bleed' || !d.spread) continue;
    const owner = inst.playerById(d.owner);
    if (!owner) continue;
    let n = 0;
    for (const o of inst.queryMobs(m.x, m.y, 150)) {
      if (o.dead || o === m || hasDot(o, 'bleed', d.owner)) continue;
      addDot(o, { ...d, leftMs: d.durMs, nextMs: d.tickMs });
      if (++n >= 3) break;
    }
  }
};

/** Rupture: enemies slain by Cleave explode for 120% weapon damage. */
export const ruptureHook: DeathHook = (inst, m, killer, skill) => {
  if (killer && skill === 'cleave' && killer.ctx.primary.flags.has('explodeOnKill')) {
    const rt = killer.ctx.primary;
    const st: Strike = { ...strikeOf(killer, rt, 1.2), skill: 'cleave_rupture', noArea: true };
    for (const o of inst.queryMobs(m.x, m.y, 80)) if (!o.dead && o !== m) strikeMob(inst, killer, o, st);
    inst.emit({ e: 'aoe', v: 'explode', x: Math.round(m.x), y: Math.round(m.y), r: 80, d: 350, el: elIdx(st.el), s: killer.id }, m.x, m.y, killer.id);
  }
};

// ─────────────────────────── Registration ───────────────────────────

export const WARRIOR_BEHAVIOURS: Record<string, SkillBehaviour> = {
  cleave: { primary: cleave },
  whirlwind: { channelTick: whirlwindTick },
  rend: { cast: rend },
  ground_stomp: { cast: groundStomp },
  seismic_slam: { cast: seismicSlam },
  battle_rage: { cast: battleRage },
};

export const WARRIOR_SUMMONS: Record<string, SummonBehaviour> = {
  dust_devil: { radius: 20, flies: true, update: dustDevil },
};
