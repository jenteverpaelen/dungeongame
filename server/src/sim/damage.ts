// Damage model (ARCHITECTURE 1.3): Diablo-3 multiplicative buckets, crits, area damage, DoTs, defences.

import {
  DIFFICULTIES, ELEMENT_INDEX, armorReduction, resistReduction, type Element,
} from '../shared';
import type { Instance } from '../instance';
import { addDot, elIdx } from './effects';
import { getBuff } from './effects';
import { killMob } from './kills';
import { killPlayer } from './players';
import { onMobDamaged, wakeMob } from './monsters';
import { skillPct } from './playerctx';
import type { Dot, Mob, Player } from './types';

export interface Strike {
  skill: string;
  /** Weapon-damage coefficient (1.5 = 150%). */
  coef: number;
  el: Element;
  /** Additive skill bucket (rune/tier/legendary dmg% + gear skill damage). */
  pct: number;
  /** Product of own-bucket multipliers (set bonuses, Devouring, ...). */
  mult?: number;
  /** Additional generic-bucket bonus (%). */
  gen?: number;
  /** Entity id reported as the damage source (summons), default the player. */
  src?: number;
  noCrit?: boolean;
  /** Skip on-hit procs (life per hit, area, ignite, electrify, ...). */
  noProc?: boolean;
  noArea?: boolean;
  primary?: boolean;
  /** Extra crit chance (%) for this strike. */
  chc?: number;
}

export interface HitResult { amount: number; crit: boolean; killed: boolean }
const NO_HIT: HitResult = { amount: 0, crit: false, killed: false };

const TAL_ELEMENTS: Element[] = ['arcane', 'cold', 'fire', 'lightning'];
export const isEliteTier = (t: number) => t === 1 || t === 2 || t === 4;

/** Vulnerability multiplier of a monster as seen by player `p` (stun / freeze / mark / black hole). */
function vulnerability(p: Player, m: Mob): number {
  let v = 1;
  if (m.stunMs > 0) v *= p.ctx.stunMult;
  if (m.freezeMs > 0) v *= p.ctx.frozenMult;
  if (m.markMs > 0) v *= 1 + m.markPct / 100;
  if (m.holeMs > 0) v *= 1 + m.holePct / 100;
  return v;
}

/** Roll the final damage of a strike (before applying it). */
export function rollDamage(inst: Instance, p: Player, m: Mob | null, st: Strike): { amount: number; crit: boolean } {
  const c = p.ctx, d = c.d, live = p.live;
  let dmg = (d.weaponMin + (d.weaponMax - d.weaponMin) * inst.rng.next()) * st.coef;
  dmg *= 1 + d.mainStat / 100;
  dmg *= 1 + st.pct / 100;
  dmg *= 1 + d.ele[st.el] / 100;
  dmg *= 1 + (d.dmgPct + live.dmg + (st.gen ?? 0)) / 100;
  if (m && isEliteTier(m.tier)) dmg *= 1 + d.elite / 100;
  if (st.mult) dmg *= st.mult;
  // Tal-style stacking: each distinct element dealt in the last 8 s adds +100% (max 4)
  if (c.setCount('fallen_star') >= 4 && TAL_ELEMENTS.includes(st.el)) {
    p.lastEle[st.el] = inst.t;
    let n = 0;
    for (const e of TAL_ELEMENTS) if (inst.t - (p.lastEle[e] ?? -1e9) <= 8000) n++;
    dmg *= 1 + n;
  }
  const ouro = c.power('ouroboros_loop');
  if (ouro && p.ouro.el === st.el) dmg *= 1 + ouro / 100;
  let crit = false;
  if (!st.noCrit) {
    const chc = Math.min(100, d.chc + live.chc + (st.chc ?? 0));
    if (inst.rng.next() * 100 < chc) { crit = true; dmg *= 1 + (d.chd + live.chd) / 100; }
  }
  if (m) dmg *= vulnerability(p, m);
  return { amount: Math.max(1, Math.round(dmg)), crit };
}

/** Deal a direct hit from a player (or one of their summons) to a monster. */
export function strikeMob(inst: Instance, p: Player, m: Mob, st: Strike): HitResult {
  if (m.dead) return NO_HIT;
  const { amount, crit } = rollDamage(inst, p, m, st);
  const killed = hurtMob(inst, m, amount, st.el, p, { crit, src: st.src ?? p.id, skill: st.skill });
  if (!st.noProc) onHitProcs(inst, p, m, st, amount, crit, killed);
  return { amount, crit, killed };
}

export interface HurtOpts { crit?: boolean; dot?: boolean; src?: number; skill?: string }

/** Apply already-computed damage to a monster: HP, events, aggro, elite reactions, death. Returns true if it died. */
export function hurtMob(inst: Instance, m: Mob, amount: number, el: Element, attacker: Player | null, o: HurtOpts = {}): boolean {
  if (m.dead) return false;
  const a = Math.round(amount);
  if (m.dummy) {
    inst.emit({ e: 'dmg', t: m.id, a, ...(o.crit ? { c: 1 as const } : {}), el: elIdx(el), s: o.src ?? attacker?.id, ...(o.dot ? { dot: 1 as const } : {}) }, m.x, m.y, attacker?.id ?? 0, 0);
    if (attacker) attacker.dealt += a;
    return false;
  }
  m.hp -= a;
  if (attacker) { m.lastHitBy = attacker.id; attacker.dealt += a; attacker.lastCombatMs = 0; }
  const killed = m.hp <= 0;
  const ev: { e: 'dmg'; t: number; a: number; c?: 1; el: number; s?: number; k?: 1; dot?: 1 } = { e: 'dmg', t: m.id, a, el: elIdx(el) };
  if (o.crit) ev.c = 1;
  if (o.src !== undefined) ev.s = o.src; else if (attacker) ev.s = attacker.id;
  if (killed) ev.k = 1;
  if (o.dot) ev.dot = 1;
  inst.emit(ev, m.x, m.y, attacker?.id ?? 0, 0);
  if (!killed) {
    if (!o.dot) wakeMob(inst, m, attacker?.id ?? 0);
    onMobDamaged(inst, m, attacker, o.dot === true);
  } else {
    killMob(inst, m, attacker, el, o.skill ?? '');
  }
  return killed;
}

// ─────────────────────────── On-hit procs ───────────────────────────

function onHitProcs(inst: Instance, p: Player, m: Mob, st: Strike, amount: number, crit: boolean, killed: boolean) {
  const c = p.ctx, d = c.d;
  // Life per hit (capped to one trigger per target per 100 ms)
  if (d.lifePerHit > 0) {
    const last = p.lohSeen.get(m.id) ?? -1e9;
    if (inst.t - last >= 100) {
      p.lohSeen.set(m.id, inst.t);
      if (p.lohSeen.size > 80) for (const [k, t] of p.lohSeen) if (inst.t - t > 1000) p.lohSeen.delete(k);
      healPlayer(inst, p, d.lifePerHit, true);
    }
  }
  if (crit) {
    if (c.anyFlag('critFury')) gainResource(p, 4);
    if (p.channel && p.channel.skill === 'whirlwind' && c.anyFlag('critHeal') && p.channel.critHealMs <= 0) {
      p.channel.critHealMs = 250;
      healPlayer(inst, p, p.mhp * 0.015, false);
    }
  }
  // Area damage: 20% chance to splash `area%` of the hit to everything else within 100
  if (!st.noArea && d.area > 0 && inst.rng.next() < 0.2) {
    const splash = Math.max(1, Math.round(amount * (d.area / 100)));
    for (const o of inst.enemies(m.x, m.y, 100)) {
      if (o === m || o.dead) continue;
      hurtMob(inst, o, splash, st.el, p, { src: st.src ?? p.id, skill: st.skill });
    }
  }
  if (st.primary && !killed) primaryHitProcs(inst, p, m, st);
}

/** Magic Weapon runes: Ignite and Electrify trigger from primary attacks while the buff is up. */
function primaryHitProcs(inst: Instance, p: Player, m: Mob, st: Strike) {
  const c = p.ctx;
  if (!getBuff(p, 'magic_weapon')) return;
  const mw = c.modsOf('magic_weapon');
  if (c.anyFlag('igniteHits')) {
    addDot(m, makeDot(inst, p, m, { skill: 'magic_weapon', coef: 1.0, el: 'fire', pct: skillPct(p, mw) }, 'burn', 3000, 500));
  }
  if (c.anyFlag('electrify') && inst.rng.next() < 0.25) {
    let n = 0;
    for (const o of inst.enemies(m.x, m.y, 260)) {
      if (o === m || o.dead) continue;
      inst.emit({ e: 'beam', v: 'arc', x: m.x, y: m.y, tx: o.x, ty: o.y, el: elIdx('lightning'), d: 200 }, m.x, m.y, p.id);
      strikeMob(inst, p, o, { skill: 'magic_weapon', coef: 1.0, el: 'lightning', pct: skillPct(p, mw), noProc: true });
      if (++n >= 3) break;
    }
  }
}

/** Build a damage-over-time effect whose total equals one (non-crit) strike of `st` spread over the duration. */
export function makeDot(inst: Instance, p: Player, m: Mob, st: Strike, kind: Dot['kind'], durationMs: number, tickMs: number, extra: Partial<Dot> = {}): Dot {
  const { amount } = rollDamage(inst, p, null, { ...st, noCrit: true });
  const ticks = Math.max(1, Math.round(durationMs / tickMs));
  return { kind, owner: p.id, skill: st.skill, perTick: amount / ticks, el: st.el, tickMs, nextMs: tickMs, leftMs: durationMs, ...extra };
}

/** Process one DoT tick on a monster. Vulnerability of the owner is applied live. */
export function tickDot(inst: Instance, m: Mob, d: Dot): boolean {
  const owner = inst.players.get(d.owner) ?? null;
  let amount = d.perTick;
  if (owner) {
    if (m.stunMs > 0) amount *= owner.ctx.stunMult;
    if (m.freezeMs > 0) amount *= owner.ctx.frozenMult;
    if (m.markMs > 0) amount *= 1 + m.markPct / 100;
    if (m.holeMs > 0) amount *= 1 + m.holePct / 100;
    if (d.heal) healPlayer(inst, owner, owner.mhp * 0.0025, true);
  }
  return hurtMob(inst, m, amount, d.el, owner, { dot: true, src: d.owner, skill: d.skill });
}

// ─────────────────────────── Players: healing / resource / incoming damage ───────────────────────────

export function healPlayer(inst: Instance, p: Player, amount: number, quiet: boolean) {
  if (p.deadMs > 0 || amount <= 0) return;
  const before = p.hp;
  p.hp = Math.min(p.mhp, p.hp + amount);
  const gained = Math.round(p.hp - before);
  if (gained > 0 && !quiet) inst.emit({ e: 'heal', t: p.id, a: gained }, p.x, p.y, p.id);
}

export function gainResource(p: Player, amount: number) {
  p.res = Math.min(p.mres, p.res + amount);
}

/**
 * Monster / hazard damage to a player. `src` is the attacking monster (for level scaling, elite DR and thorns).
 * Returns the damage actually taken.
 */
export function damagePlayer(inst: Instance, p: Player, raw: number, el: Element, src: Mob | null, level = 0, melee = false): number {
  if (p.deadMs > 0 || p.invulnMs > 0 || inst.kind === 'town') return 0;
  const d = p.ctx.d;
  const lvl = Math.max(1, src?.level ?? (level || inst.level));
  let mult = (1 - armorReduction(d.armor, lvl)) * (1 - resistReduction(d.allRes, lvl));
  if (src && isEliteTier(src.tier)) mult *= 1 - d.eliteDR / 100;
  mult *= 1 - p.live.dr;
  const amount = Math.max(1, Math.round(raw * mult));
  p.hp -= amount;
  p.lastCombatMs = 0;
  const ev: { e: 'dmg'; t: number; a: number; el: number; s?: number; p?: 1 } = { e: 'dmg', t: p.id, a: amount, el: ELEMENT_INDEX.indexOf(el) };
  if (src) ev.s = src.id;
  if (amount >= p.mhp * 0.1) ev.p = 1;
  inst.emit(ev, p.x, p.y, p.id);
  // Thorns reflect on melee hits
  if (melee && src && !src.dead && d.thorns > 0) {
    hurtMob(inst, src, d.thorns, 'physical', p, { src: p.id, skill: 'thorns' });
  }
  if (p.hp <= 0) killPlayer(inst, p, el);
  return amount;
}

/** Monster damage per hit (ARCHITECTURE 1.3). */
export function mobBaseDamage(level: number, defDmg: number, difficulty: number, monsterDmg: (l: number) => number): number {
  return monsterDmg(level) * defDmg * DIFFICULTIES[difficulty].dmg;
}
