// Every class skill (ARCHITECTURE 1.5): primaries, spenders, channel, cooldowns, buffs and summons, with all
// runes, upgrade-tier flags, legendary powers and set bonuses.

import type { Element } from '../shared';
import { skillBuffBonuses } from '../shared';
import { anyEnemyWithin, bestConeAngle, bestPoint, pickTarget, summonCount } from './brain';
import { expectedDamage, gainResource, makeDot, strikeMob } from './damage';
import {
  addBuff, addDot, chillMob, ccFactor, dragMob, elIdx, freezeMob, getBuff, hasDot, inCone, knockbackMob, stunMob,
} from './effects';
import { addGround, newGround } from './grounds';
import type { Instance } from './instance';
import {
  maxSummonsOf, skillCost, skillDurationMs, skillElement, skillMult, skillPct, skillRadius,
} from './playerctx';
import { spawnProj } from './projectiles';
import { spawnSummon } from './summons';
import {
  PB_BATTERY, PB_DEVOUR, PB_FREEZE, PB_MARK, PB_NOGRENADE, PB_ROCKETS, PB_SPLIT,
  type Mob, type Player, type Proj, type SkillRuntime, type Strike,
} from './types';

const DEG = Math.PI / 180;

export function strikeOf(p: Player, rt: SkillRuntime, coef = rt.def.coef): Strike {
  return { skill: rt.def.id, coef, el: skillElement(rt), pct: skillPct(p, rt), mult: skillMult(p, rt.def.id) };
}

function emitCast(inst: Instance, p: Player, rt: SkillRuntime, tx: number, ty: number, rad?: number) {
  const rune = p.save.skills.runes[rt.def.id];
  const ev: { e: 'cast'; s: number; sk: string; r?: string; x: number; y: number; tx: number; ty: number; rad?: number } = {
    e: 'cast', s: p.id, sk: rt.def.id, x: Math.round(p.x), y: Math.round(p.y), tx: Math.round(tx), ty: Math.round(ty),
  };
  if (rune) ev.r = rune;
  if (rad) ev.rad = Math.round(rad);
  inst.emit(ev, p.x, p.y, p.id);
}

function face(p: Player, x: number) {
  if (Math.abs(x - p.x) > 2) p.faceLeft = x < p.x;
  p.faceLockMs = 260;
}

// ─────────────────────────── Primary attacks ───────────────────────────

export function castPrimary(inst: Instance, p: Player, tgt: Mob) {
  const rt = p.ctx.primary;
  face(p, tgt.x);
  p.attackFlagMs = 250;
  p.attackSeq++;
  switch (rt.def.id) {
    case 'cleave': return cleave(inst, p, rt, tgt);
    case 'hungering_arrow': return hungeringArrow(inst, p, rt, tgt);
    case 'magic_missile': return magicMissile(inst, p, rt, tgt);
  }
}

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

function fanAngles(n: number, stepRad: number): number[] {
  const out = [0];
  for (let i = 1; out.length < n; i++) { out.push(i * stepRad); if (out.length < n) out.push(-i * stepRad); }
  return out;
}

function hungeringArrow(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob) {
  const n = 1 + (rt.mods.projectiles ?? 0);
  const base = Math.atan2(tgt.y - p.y, tgt.x - p.x);
  const st: Strike = { ...strikeOf(p, rt), primary: true };
  const mark = rt.flags.has('huntersMark');
  const pierce = mark ? 1 : Math.min(1, (35 + (rt.mods.pierce ?? 0)) / 100);
  let bits = 0;
  if (rt.flags.has('splitOnPierce')) bits |= PB_SPLIT;
  if (rt.flags.has('devouring')) bits |= PB_DEVOUR;
  if (mark) bits |= PB_MARK;
  for (const off of fanAngles(n, 10 * DEG)) {
    spawnProj(inst, {
      kind: 'arrow', v: 'arrow', owner: p, src: p.id, x: p.x, y: p.y - 4, angle: base + off, speed: 900, lifeMs: 820, r: 12,
      el: st.el, strike: st, pierce, homing: tgt.id, turn: 6, seek: true, bits,
    });
  }
  gainResource(p, rt.def.gen + (rt.mods.gen ?? 0));
  emitCast(inst, p, rt, tgt.x, tgt.y);
}

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

// ─────────────────────────── Whirlwind (channel) ───────────────────────────

export function startChannel(inst: Instance, p: Player, rt: SkillRuntime, manual = false) {
  // First Dust Devil bursts out as the spin starts (D3), then one per second of channelling.
  p.channel = { skill: rt.def.id, graceMs: 600, tickMs: 0, devilMs: 150, spunMs: 0, manual };
  p.castFlagMs = 300;
  p.attackSeq++;
  emitCast(inst, p, rt, p.x, p.y, skillRadius(rt));
}

export function endChannel(inst: Instance, p: Player) {
  if (!p.channel) return;
  p.readyAt.set(p.channel.skill, inst.t + 400);
  p.channel = null;
}

export function channelTick(inst: Instance, p: Player, dtMs: number) {
  const ch = p.channel!;
  const rt = p.ctx.slotted(ch.skill);
  if (!rt) { p.channel = null; return; }
  p.res -= skillCost(p, rt) * (dtMs / 1000);
  if (p.res <= 0) { p.res = 0; endChannel(inst, p); return; }
  const a = rt.def.auto;
  const within = (a.when === 'channel' ? a.within : 240) + 40;
  if (anyEnemyWithin(inst, p.x, p.y, within)) ch.graceMs = 600;
  else {
    ch.graceMs -= dtMs;
    if (ch.graceMs <= 0) { endChannel(inst, p); return; }
  }
  ch.spunMs += dtMs;
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

// ─────────────────────────── Slot skills ───────────────────────────

/** Execute a slotted skill. Returns false if it found nothing to do (no cost / cooldown is paid). */
export function castSkill(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  switch (rt.def.id) {
    case 'rend': return rend(inst, p, rt);
    case 'ground_stomp': return groundStomp(inst, p, rt);
    case 'seismic_slam': return seismicSlam(inst, p, rt);
    case 'battle_rage': return battleRage(inst, p, rt);
    case 'sentry': return sentry(inst, p, rt);
    case 'multishot': return multishot(inst, p, rt);
    case 'cluster_arrow': return clusterArrow(inst, p, rt);
    case 'rain_of_vengeance': return rainOfVengeance(inst, p, rt);
    case 'companion': return companion(inst, p, rt);
    case 'meteor': return meteor(inst, p, rt);
    case 'black_hole': return blackHole(inst, p, rt);
    case 'frost_nova': return frostNova(inst, p, rt);
    case 'hydra': return hydra(inst, p, rt);
    case 'magic_weapon': return magicWeapon(inst, p, rt);
  }
  return false;
}

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

function sentry(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  let x = p.x, y = p.y;
  // keep turrets slightly apart so chains have length
  for (const s of p.summons) {
    if (s.type !== 'sentry' || s.dead) continue;
    if (Math.hypot(s.x - x, s.y - y) < 40) {
      const a = inst.rng.next() * Math.PI * 2;
      const tx = p.x + Math.cos(a) * 46, ty = p.y + Math.sin(a) * 46;
      if (inst.cw.isFree(tx, ty, 12)) { x = tx; y = ty; }
      break;
    }
  }
  spawnSummon(inst, p, 'sentry', 'sentry', x, y, skillDurationMs(rt));
  trimSummons(p, 'sentry', maxSummonsOf(rt));
  emitCast(inst, p, rt, x, y);
  return true;
}

/** Keep at most `max` summons of a skill, retiring the ones farthest from the player first. */
function trimSummons(p: Player, skill: string, max: number) {
  const mine = p.summons.filter((s) => !s.dead && s.skill === skill && s.type !== 'dust_devil');
  if (mine.length <= max) return;
  mine.sort((a, b) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 - ((a.x - p.x) ** 2 + (a.y - p.y) ** 2));
  for (let i = 0; i < mine.length - max; i++) mine[i].dead = true;
}

function multishotTarget(inst: Instance, p: Player, range: number): { ang: number; x: number; y: number } | null {
  const ang = bestConeAngle(inst, p.x, p.y, range, 35 * DEG);
  if (ang === null) return null;
  const t = pickTarget(inst, p.x, p.y, range, false, p.save.skills.targetPriority);
  const d = t ? Math.min(range, Math.hypot(t.x - p.x, t.y - p.y)) : range * 0.7;
  return { ang, x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d };
}

function fireMultishot(inst: Instance, p: Player, rt: SkillRuntime, ox: number, oy: number, ang: number, src: number) {
  const n = 9 + (rt.mods.projectiles ?? 0);
  const spread = 70 * DEG;
  const st: Strike = { ...strikeOf(p, rt), src };
  const hits = new Set<number>();
  for (let i = 0; i < n; i++) {
    const a = ang - spread / 2 + (spread * i) / Math.max(1, n - 1);
    spawnProj(inst, {
      kind: 'multi', v: 'arrow', owner: p, src, x: ox, y: oy - 4, angle: a, speed: 1150, lifeMs: 560, r: 14, el: st.el,
      strike: st, pierce: 1, hits,
    });
  }
  if (rt.flags.has('rockets')) {
    const near = inst.queryMobs(ox, oy, rt.def.range).filter((m) => !m.dead);
    for (let i = 0; i < 3; i++) {
      const t = near.length ? near[Math.floor(inst.rng.next() * near.length)] : null;
      spawnProj(inst, {
        kind: 'rocket', v: 'rocket', owner: p, src, x: ox, y: oy - 10, angle: ang + (i - 1) * 0.5, speed: 680, lifeMs: 1400, r: 12, el: 'fire',
        strike: { ...st, coef: 3.0, el: 'fire' }, homing: t ? t.id : 0, turn: 5, seek: true,
      });
    }
  }
}

function multishot(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const t = multishotTarget(inst, p, rt.def.range);
  if (!t) return false;
  face(p, t.x);
  fireMultishot(inst, p, rt, p.x, p.y, t.ang, p.id);
  if (p.ctx.modsOf('sentry').flags.has('sentryCasts')) {
    for (const s of p.summons) {
      if (s.type !== 'sentry' || s.dead || Math.hypot(t.x - s.x, t.y - s.y) > rt.def.range) continue;
      s.attackSeq++; s.attackFlagMs = 200;
      fireMultishot(inst, p, rt, s.x, s.y, Math.atan2(t.y - s.y, t.x - s.x), s.id);
    }
  }
  emitCast(inst, p, rt, t.x, t.y);
  return true;
}

function lobCluster(inst: Instance, p: Player, rt: SkillRuntime, ox: number, oy: number, tx: number, ty: number, src: number) {
  const d = Math.max(20, Math.hypot(tx - ox, ty - oy));
  let bits = 0;
  if (rt.flags.has('noGrenades')) bits |= PB_NOGRENADE;
  if (rt.flags.has('rockets')) bits |= PB_ROCKETS;
  spawnProj(inst, {
    kind: 'cluster', v: 'cluster', owner: p, src, x: ox, y: oy, angle: Math.atan2(ty - oy, tx - ox), speed: d / 0.45, lifeMs: 450,
    r: 10, el: skillElement(rt), strike: { ...strikeOf(p, rt), src }, tx, ty, bits,
  });
}

/** Cluster Arrow detonation (called when the lobbed arrow lands). */
export function clusterExplode(inst: Instance, pr: Proj) {
  const p = pr.owner;
  if (!p || !pr.strike || !inst.playerById(p.id)) return;
  const rt = p.ctx.modsOf('cluster_arrow');
  const radius = skillRadius(rt);
  const st = pr.strike;
  for (const m of inst.queryMobs(pr.x, pr.y, radius)) if (!m.dead) strikeMob(inst, p, m, st);
  inst.emit({ e: 'aoe', v: 'cluster', x: Math.round(pr.x), y: Math.round(pr.y), r: Math.round(radius), d: 420, el: elIdx(st.el), s: st.src ?? p.id }, pr.x, pr.y, p.id);
  if (pr.bits & PB_NOGRENADE) return;
  if (pr.bits & PB_ROCKETS) {
    const near = inst.queryMobs(pr.x, pr.y, rt.def.range).filter((m) => !m.dead&&Math.hypot(m.x-p.x,m.y-p.y)<=rt.def.range);
    for (let i = 0; i < 3; i++) {
      const t = near.length ? near[Math.floor(inst.rng.next() * near.length)] : null;
      spawnProj(inst, {
        kind: 'rocket', v: 'rocket', owner: p, src: st.src ?? p.id, x: pr.x, y: pr.y - 10, angle: inst.rng.next() * Math.PI * 2, speed: 640,
        lifeMs: 1400, r: 12, el: 'fire', strike: { ...st, coef: 2.1, el: 'fire' }, homing: t ? t.id : 0, turn: 6, seek: true,
      });
    }
    return;
  }
  for (let i = 0; i < 4; i++) {
    const a = inst.rng.next() * Math.PI * 2, d = 60 + inst.rng.next() * 50;
    const gx = pr.x + Math.cos(a) * d, gy = pr.y + Math.sin(a) * d;
    inst.sched.schedule(inst.t + 350, () => {
      if (!inst.playerById(p.id)) return;
      for (const m of inst.queryMobs(gx, gy, 50)) if (!m.dead) strikeMob(inst, p, m, { ...st, coef: 2.1 });
      inst.emit({ e: 'aoe', v: 'grenade', x: Math.round(gx), y: Math.round(gy), r: 50, d: 300, el: elIdx(st.el), s: st.src ?? p.id }, gx, gy, p.id);
    });
  }
}

function clusterArrow(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  face(p, bp.x);
  lobCluster(inst, p, rt, p.x, p.y, bp.x, bp.y, p.id);
  if (p.ctx.modsOf('sentry').flags.has('sentryCasts')) {
    for (const s of p.summons) {
      if (s.type !== 'sentry' || s.dead || Math.hypot(bp.x - s.x, bp.y - s.y) > rt.def.range) continue;
      s.attackSeq++; s.attackFlagMs = 200;
      lobCluster(inst, p, rt, s.x, s.y, bp.x + (inst.rng.next() - 0.5) * 40, bp.y + (inst.rng.next() - 0.5) * 40, s.id);
    }
  }
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

function rainOfVengeance(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const radius = skillRadius(rt);
  const bp = bestPoint(inst, p.x, p.y, rt.def.range, radius);
  if (!bp) return false;
  const dur = skillDurationMs(rt);
  const g = newGround('rain', bp.x, bp.y, radius, inst.t, dur + 100, dur / 10);
  g.nextT = inst.t + 100;
  g.owner = p;
  g.waves = 10;
  g.follow = rt.flags.has('follow');
  g.el = skillElement(rt);
  g.strike = strikeOf(p, rt, rt.def.coef / 10);
  addGround(inst, g);
  emitCast(inst, p, rt, bp.x, bp.y, radius);
  return true;
}

function companion(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const type = rt.flags.has('batCompanion') ? 'bat' : rt.flags.has('ravenCompanion') ? 'raven' : 'wolf';
  // a rune change swaps the animal
  for (const s of p.summons) if (s.skill === 'companion' && s.type !== type) s.dead = true;
  const n = summonCount(p, 'companion');
  const s = spawnSummon(inst, p, type, 'companion', p.x + (n % 2 ? 40 : -40), p.y + 12, Infinity);
  s.aux = n;
  trimSummons(p, 'companion', maxSummonsOf(rt));
  emitCast(inst, p, rt, s.x, s.y);
  return true;
}

// ─────────────────────────── Mage ───────────────────────────

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
    if (comet && !r.killed && !m.dead) freezeMob(m, 1500);
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
  g.voidPct = rt.flags.has('voidHeart') ? p.ctx.power('void_heart') : 0;
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
    freezeMob(m, freezeMs, shatter ? p.id : 0, depth);
    if (ccFactor(m) > 0) frozen++;
    strikeMob(inst, p, m, st);
  }
  inst.emit({ e: 'aoe', v: 'nova', x: Math.round(x), y: Math.round(y), r: Math.round(radius), d: 450, el: elIdx(st.el), s: p.id }, x, y, p.id);
  if (depth === 0 && rt.flags.has('deepFreeze') && frozen >= 5) addBuff(p, { id: 'deep_freeze', ms: 11000, chc: 10 });
}

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

function magicWeapon(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  addBuff(p, { id: 'magic_weapon', ms: skillDurationMs(rt), ...skillBuffBonuses('magic_weapon', rt.flags) });
  emitCast(inst, p, rt, p.x, p.y);
  return true;
}

// ─────────────────────────── Death hooks ───────────────────────────

/** Skill effects that trigger when a monster dies (Rupture, Contagion, Shatter). */
export function skillDeathHooks(inst: Instance, m: Mob, killer: Player | null, skill: string) {
  // Contagion: bleeds spread to up to 3 nearby enemies.
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
  // Shatter: frozen enemies explode into another (smaller) Frost Nova; no chains deeper than one.
  if (m.freezeMs > 0 && m.shatterBy && m.shatterDepth < 1) {
    const owner = inst.playerById(m.shatterBy);
    const rt = owner?.ctx.slotted('frost_nova');
    if (owner && rt) {
      const x = m.x, y = m.y;
      inst.sched.schedule(inst.t + 50, () => castNova(inst, owner, rt, x, y, skillRadius(rt) * 0.6, skillDurationMs(rt) * 0.5, 1, 0.6));
    }
  }
  // Rupture: enemies slain by Cleave explode for 120% weapon damage.
  if (killer && skill === 'cleave' && killer.ctx.primary.flags.has('explodeOnKill')) {
    const rt = killer.ctx.primary;
    const st: Strike = { ...strikeOf(killer, rt, 1.2), skill: 'cleave_rupture', noArea: true };
    for (const o of inst.queryMobs(m.x, m.y, 80)) if (!o.dead && o !== m) strikeMob(inst, killer, o, st);
    inst.emit({ e: 'aoe', v: 'explode', x: Math.round(m.x), y: Math.round(m.y), r: 80, d: 350, el: elIdx(st.el), s: killer.id }, m.x, m.y, killer.id);
  }
}

