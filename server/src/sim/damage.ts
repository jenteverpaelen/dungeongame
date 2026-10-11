// Damage model (ARCHITECTURE 1.3): Diablo-3 multiplicative buckets, crits, area damage, DoTs, defences.
import { boundedCombat, combatInteger } from '../../../shared/src/combatBounds';

import { ELEMENT_INDEX, armorReduction, modVar, resistReduction, type Element } from '../shared';
import { addOwnedDot, chillMob, elIdx, getBuff } from './effects';
import { onEliteDamaged } from './elites';
import type { Instance } from './instance';
import { killMob } from './kills';
import { onMobHit, wakeMob } from './monsters';
import { skillPct } from './playerctx';
import { countCastHit, onPlayerDamaged, powerDefense, tryCheatDeath } from './powerActions';
import { applyHitTerms, elementStacks, firePowerProcs, vulnTermsFactor } from './powerRuntime';
import { consumeVulns, scopedVulnerability, weakenFactor } from './status';
import { mFreeze } from './skills/mageKit';
import { killPlayer } from './players';
import type { Dot, DotKind, Mob, Player, SkillRuntime, Strike } from './types';

export interface HitResult { amount: number; crit: boolean; killed: boolean }
const NO_HIT: HitResult = { amount: 0, crit: false, killed: false };

export const isEliteTier = (t: number) => t === 1 || t === 2 || t === 4;

/** Vulnerability multiplier of a monster as seen by player `p` (stun / freeze / mark / black hole / power conditions). */
export function vulnerability(p: Player, m: Mob, skill?: string): number {
  let v = 1;
  if (m.stunMs > 0) v *= p.ctx.stunMult;
  if (m.freezeMs > 0) v *= p.ctx.frozenMult;
  if (m.markMs > 0) v *= 1 + m.markPct / 100;
  if (m.holeMs > 0) v *= 1 + m.holePct / 100;
  if (p.ctx.powers.vulnTerms.length) v *= vulnTermsFactor(p, m, skill);
  if (m.ps && m.ps.vulns.length) v *= scopedVulnerability(m, p, skill);
  return v;
}

/** Everything except the weapon roll, crit and target-dependent factors. */
function baseMult(inst: Instance, p: Player, st: Strike): number {
  const d = p.ctx.d;
  let m = st.coef;
  m *= 1 + d.mainStat / 100;
  m *= 1 + st.pct / 100;
  m *= 1 + (d.ele[st.el] ?? 0) / 100;
  m *= 1 + (d.dmgPct + p.live.dmg + (st.gen ?? 0)) / 100;
  if (st.mult) m *= st.mult;
  // Power templates per hit, in canonical order (Fallen Star element stacks, Ouroboros cycle, conditionals).
  if (p.ctx.powers.hitTerms.length) m = applyHitTerms(inst, p, m, st.skill, st.el);
  return m;
}

/** Roll the final damage of a strike against `m` (null = target-independent). */
export function rollDamage(inst: Instance, p: Player, m: Mob | null, st: Strike): { amount: number; crit: boolean } {
  const d = p.ctx.d;
  let dmg = (d.weaponMin + (d.weaponMax - d.weaponMin) * inst.rng.next()) * baseMult(inst, p, st);
  if (m && isEliteTier(m.tier)) dmg *= 1 + d.elite / 100;
  let crit = false;
  if (!st.noCrit) {
    const chc = Math.min(100, d.chc + p.live.chc + (st.chc ?? 0));
    if (inst.rng.next() * 100 < chc) { crit = true; dmg *= 1 + (d.chd + p.live.chd) / 100; }
  }
  if (m) dmg *= vulnerability(p, m, st.skill);
  return { amount: combatInteger(dmg), crit };
}

/** Expected (average, crit-weighted) damage of a strike, used for DoTs and ground effects. */
export function expectedDamage(inst: Instance, p: Player, st: Strike): number {
  const d = p.ctx.d;
  const avg = (d.weaponMin + d.weaponMax) / 2;
  const chc = Math.min(100, d.chc + p.live.chc) / 100;
  return boundedCombat(avg * baseMult(inst, p, st) * (1 + chc * (d.chd + p.live.chd) / 100));
}

/** Deal a direct hit from a player (or one of their summons) to a monster. */
export function strikeMob(inst: Instance, p: Player, m: Mob, st: Strike): HitResult {
  if (m.dead) return NO_HIT;
  const { amount, crit } = rollDamage(inst, p, m, st);
  if (p.ctx.powers.elementStacks?.generic) elementStacks(inst, p, st.el); // generic-bucket stacks record dealt elements here
  const prevActing = p.acting;
  p.acting = st.skill;
  const killed = hurtMob(inst, m, amount, st.el, p, crit, false, st.src ?? p.id, st.skill);
  if (p.pw?.cast) countCastHit(inst, p, m, st.skill);
  if (m.ps && m.ps.vulns.length) consumeVulns(m, p, st.skill);
  if (!st.noProc) onHitProcs(inst, p, m, st, amount, crit, killed);
  p.acting = prevActing;
  return { amount, crit, killed };
}

/** Apply already-computed damage to a monster: HP, events, aggro, elite reactions, death. Returns true if it died. */
export function hurtMob(inst: Instance, m: Mob, amount: number, el: Element, attacker: Player | null, crit: boolean, dot: boolean, src: number, skill: string): boolean {
  if (m.dead) return false;
  const a = combatInteger(amount);
  m.lastDamagedT = inst.t;
  if (attacker) { attacker.dealt = boundedCombat(attacker.dealt+a); attacker.sinceHitMs = 0; }
  if (inst.dmgBySkill) inst.dmgBySkill.set(skill, boundedCombat((inst.dmgBySkill.get(skill) ?? 0) + a));
  if (m.dummy) {
    m.hp = Math.max(1, m.hp - a);
    emitDmg(inst, m, a, el, crit, dot, src, false, attacker);
    return false;
  }
  m.hp -= a;
  if (attacker) m.lastHitBy = attacker.id;
  const killed = m.hp <= 0;
  emitDmg(inst, m, a, el, crit, dot, src, killed, attacker);
  if (!killed) {
    wakeMob(inst, m, attacker);
    onMobHit(inst, m, attacker, dot);
    if (m.affixes.length) onEliteDamaged(inst, m, attacker, dot);
  } else {
    killMob(inst, m, attacker, el, skill);
  }
  return killed;
}

function emitDmg(inst: Instance, m: Mob, a: number, el: Element, crit: boolean, dot: boolean, src: number, killed: boolean, attacker: Player | null) {
  inst.addDmg(m, attacker?.id ?? 0, src, a, crit, dot, elIdx(el), killed);
}

// ─────────────────────────── On-hit procs ───────────────────────────

function onHitProcs(inst: Instance, p: Player, m: Mob, st: Strike, amount: number, crit: boolean, killed: boolean) {
  const c = p.ctx, d = c.d;
  // Life per hit (one trigger per target per 100 ms)
  if (d.lifePerHit > 0) {
    const last = p.lohSeen.get(m.id) ?? -1e9;
    if (inst.t - last >= 100) {
      p.lohSeen.set(m.id, inst.t);
      healPlayer(inst, p, d.lifePerHit, true);
    }
  }
  if (crit) {
    if (getBuff(p, 'battle_rage') && c.anyFlag('critFury')) gainResource(p, 4);
    if (p.channel && st.skill === 'whirlwind' && c.modsOf('whirlwind').flags.has('critHeal')) {
      if (p.critHealMs <= 0) { p.critHealMs = 1000; p.critHealCount = 0; }
      if (p.critHealCount < 4) { p.critHealCount++; healPlayer(inst, p, p.mhp * 0.015, true); }
    }
    firePowerProcs(inst, p, 'crit', { skill: st.skill, mob: m, el: st.el, amount });
  }
  if (c.powers.procs.hit) firePowerProcs(inst, p, 'hit', { skill: st.skill, mob: m, el: st.el, amount });
  // Affix: chance on hit to chill for 1 s (RNG only with the affix).
  if (d.chillOnHit > 0 && !m.dead && inst.rng.next() * 100 < d.chillOnHit) chillMob(m, 1000, inst, p);
  // Area damage (D3): 20% chance to splash area% of the hit to all other enemies within 100. No area-of-area.
  if (!st.noArea && d.area > 0 && inst.rng.next() < 0.2) {
    const splash = Math.max(1, Math.round(amount * (d.area / 100)));
    const near = inst.queryMobs(m.x, m.y, 100);
    for (let i = 0; i < near.length; i++) {
      const o = near[i];
      if (o === m || o.dead) continue;
      hurtMob(inst, o, splash, st.el, p, false, false, st.src ?? p.id, st.skill);
    }
  }
  if (!killed && !m.dead) {
    if (st.primary) primaryHitProcs(inst, p, m, amount, 1);
    else if (st.src !== undefined && st.src !== p.id && getBuff(p, 'magic_weapon')) {
      // Bound Glyph (Magic Weapon node): Summon hits trigger its rune effect at a share of the normal rate.
      const share = modVar(p.ctx.modsOf('magic_weapon').mods, 'weaponSummonProc');
      if (share > 0) primaryHitProcs(inst, p, m, amount, share / 100);
    }
  }
}

/**
 * Magic Weapon runes: Ignite, Electrify and Chilling Edge trigger from primary attacks while the buff is up. `rate` scales
 * how often (Bound Glyph: summon hits); Rune Echo (node) and Glyphstone Orb make them trigger more often
 * (`vars.weaponProc` %). A 100 % effect stays exact at rate 1, so no RNG draw is added for it. Splash Glyph (node):
 * a chance to splash 50 % of a primary hit onto enemies within 60 units.
 */
function primaryHitProcs(inst: Instance, p: Player, m: Mob, amount: number, share: number) {
  if (!getBuff(p, 'magic_weapon')) return;
  const mw = p.ctx.modsOf('magic_weapon');
  const rate = share * (1 + modVar(mw.mods, 'weaponProc') / 100);
  if (mw.flags.has('igniteHits') && (rate >= 1 || inst.rng.next() < rate)) {
    addOwnedDot(p, m, makeDot(inst, p, { skill: 'magic_weapon', coef: 1.0, el: 'fire', pct: skillPct(p, mw) }, 'burn', 3000, 500));
  }
  if (mw.flags.has('weaponFrost') && !m.dead && inst.rng.next() < Math.min(1, 0.15 * rate)) mFreeze(inst, p, m, 500, null);
  const splash = share === 1 ? modVar(mw.mods, 'weaponSplash') : 0;
  if (splash > 0 && amount > 0 && inst.rng.next() * 100 < splash) {
    const part = Math.max(1, Math.round(amount * 0.5));
    for (const o of inst.queryMobs(m.x, m.y, 60)) if (o !== m && !o.dead) hurtMob(inst, o, part, 'arcane', p, false, false, p.id, 'magic_weapon');
  }
  if (mw.flags.has('electrify') && inst.rng.next() < Math.min(1, 0.25 * rate)) {
    let n = 0;
    let fx = m.x, fy = m.y;
    const near = inst.queryMobs(m.x, m.y, 280);
    for (let i = 0; i < near.length && n < 3; i++) {
      const o = near[i];
      if (o === m || o.dead) continue;
      inst.emit({ e: 'beam', v: 'arc', x: Math.round(fx), y: Math.round(fy), tx: Math.round(o.x), ty: Math.round(o.y), el: elIdx('lightning'), d: 220 }, o.x, o.y, p.id);
      fx = o.x; fy = o.y;
      strikeMob(inst, p, o, { skill: 'magic_weapon', coef: 1.0, el: 'lightning', pct: skillPct(p, mw), noProc: true });
      n++;
    }
  }
}

/** Build a damage-over-time effect whose total equals the expected damage of `st`, spread over the duration. */
export function makeDot(inst: Instance, p: Player, st: Strike, kind: DotKind, durationMs: number, tickMs: number, extra: Partial<Dot> = {}): Dot {
  const total = expectedDamage(inst, p, st);
  const ticks = Math.max(1, Math.round(durationMs / tickMs));
  return { kind, owner: p.id, skill: st.skill, perTick: total / ticks, el: st.el, tickMs, nextMs: tickMs, leftMs: durationMs, durMs: durationMs, ...extra };
}

/** Apply pre-computed DoT / ground damage from player `p` (vulnerability and elite bonus applied live). */
export function dotStrike(inst: Instance, p: Player, m: Mob, amount: number, el: Element, skill: string): boolean {
  let a = amount * vulnerability(p, m, skill);
  if (isEliteTier(m.tier)) a *= 1 + p.ctx.d.elite / 100;
  elementStacks(inst, p, el);
  return hurtMob(inst, m, a, el, p, false, true, p.id, skill);
}

/** Process one DoT tick on a monster. */
export function tickDot(inst: Instance, m: Mob, d: Dot): boolean {
  const owner = inst.playerById(d.owner);
  if (!owner) return hurtMob(inst, m, d.perTick, d.el, null, false, true, d.owner, d.skill);
  if (d.heal) healPlayer(inst, owner, owner.mhp * 0.0025, true); // Bloodlust: 0.5%/s per bleeding enemy at 2 ticks/s
  return dotStrike(inst, owner, m, d.perTick, d.el, d.skill);
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
  if (amount > 0) p.res = Math.min(p.mres, p.res + amount);
}

/**
 * Resource a skill generates: `amount` scaled by the skill's vars.genPct (additive %, e.g. Iron Discipline −15 on
 * Primary skills). Without the var it is exactly gainResource (no float change).
 */
export function skillGain(p: Player, rt: SkillRuntime, amount: number) {
  const pct = modVar(rt.mods, 'genPct');
  gainResource(p, pct ? amount * Math.max(0, 1 + pct / 100) : amount);
}

/** Damage-taken multiplier of a player vs a monster of `level` (armor, resists, elite DR, whirlwind DR). */
export function defenseMult(p: Player, level: number, elite: boolean): number {
  const d = p.ctx.d;
  let mult = (1 - armorReduction(d.armor, level)) * (1 - resistReduction(d.allRes, level));
  if (elite) mult *= 1 - Math.min(75, d.eliteDR) / 100;
  if (p.channel && p.channel.skill === 'whirlwind') {
    const ww = p.ctx.modsOf('whirlwind');
    if (ww.flags.has('stormDR')) mult *= 0.5;
    if (ww.flags.has('gyre')) mult *= 0.8;
  }
  return mult;
}

/**
 * Monster / hazard damage to a player. `src` is the attacking monster (level scaling, elite DR and thorns).
 * Returns the damage actually taken.
 */
export function damagePlayer(inst: Instance, p: Player, raw: number, el: Element, src: Mob | null, level: number, melee = false): number {
  if (p.debugInfiniteHp || p.deadMs > 0 || p.invulnMs > 0 || inst.kind === 'town' || raw <= 0) return 0;
  const lvl = Math.max(1, src?.level ?? level);
  if (src?.ps && src.ps.weakenMs > 0) raw *= weakenFactor(src); // power status: weakened attacker
  let mult = defenseMult(p, lvl, !!src && isEliteTier(src.tier));
  // Affixes: less damage from melee / ranged monster attacks (hazards without a source are neither).
  if (src) { const dr = melee ? p.ctx.d.meleeDR : p.ctx.d.rangedDR; if (dr > 0) mult *= 1 - Math.min(75, dr) / 100; }
  if (p.ctx.powers.defense || (p.live.dr !== undefined && p.live.dr !== 1)) mult *= powerDefense(inst, p, src);
  const amount = combatInteger(raw * mult);
  const hpBefore = p.hp;
  p.hp -= amount;
  p.taken += amount;
  p.sinceHurtMs = 0;
  const ev: { e: 'dmg'; t: number; a: number; el: number; s?: number; p?: 1 } = { e: 'dmg', t: p.id, a: amount, el: ELEMENT_INDEX.indexOf(el) };
  if (src) ev.s = src.id;
  if (amount >= p.mhp * 0.1) ev.p = 1; // big hit on a player (camera shake / heavy hurt sound)
  inst.emit(ev, p.x, p.y, p.id);
  // Thorns reflect on melee hits (scaled by the main stat like D3 2.x)
  if (melee && src && !src.dead && p.ctx.d.thorns > 0) {
    const th = p.ctx.d.thorns * (1 + p.ctx.d.mainStat / 100);
    hurtMob(inst, src, th, 'physical', p, false, false, p.id, 'thorns');
  }
  if (p.hp <= 0 && p.ctx.powers.defense?.cheat.length) tryCheatDeath(inst, p, src);
  if (p.hp > 0 && p.ctx.powers.procs.takeDamage) onPlayerDamaged(inst, p, amount, src);
  if (p.hp > 0 && p.ctx.powers.procs.lifeBelow) firePowerProcs(inst, p, 'lifeBelow', { amount, mob: src, hpBefore });
  if (p.hp <= 0) killPlayer(inst, p, el);
  return amount;
}
