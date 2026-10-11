// Shared plumbing for the per-class skill behaviour modules (warrior.ts, ranger.ts, mage.ts): strike construction,
// cast events, facing, fan angles, summon trimming, and the behaviour contracts a class module registers.

import type { Instance } from '../instance';
import { skillElement, skillMult, skillPct } from '../playerctx';
import type { ChannelState, Mob, Player, SkillRuntime, Strike, Summon } from '../types';

export const DEG = Math.PI / 180;

/** What a skill id does on the server. A class module exports `Record<skillId, SkillBehaviour>`. */
export interface SkillBehaviour {
  /** Primary (auto-attack) skills: one swing / shot at `tgt`. */
  primary?(inst: Instance, p: Player, rt: SkillRuntime, tgt: Mob): void;
  /** Slot skills: execute; return false when there is nothing to do (no cost or cooldown is paid). */
  cast?(inst: Instance, p: Player, rt: SkillRuntime): boolean;
  /** Channelled skills: the skill-specific part of one channel tick (resource drain and grace are generic). */
  channelTick?(inst: Instance, p: Player, rt: SkillRuntime, ch: ChannelState, dtMs: number): void;
}

/** Called for every monster death, in registration order (index.ts keeps the order explicit). */
export type DeathHook = (inst: Instance, m: Mob, killer: Player | null, skill: string) => void;

/** Per-summon-type AI. `actsWhileOwnerDead`: keeps firing while the owner is dead (stationary turrets). */
export interface SummonBehaviour {
  radius: number;
  flies?: boolean;
  actsWhileOwnerDead?: boolean;
  update(inst: Instance, s: Summon, p: Player, dtMs: number, dtS: number): void;
}

/** Per-owner hooks run after all summons moved: auras and links between summons. */
export interface OwnerSummonHook {
  /** The player has at least one summon (dead ones already compacted away). */
  withSummons?(inst: Instance, p: Player, dtMs: number): void;
  /** The player has no summons at all. */
  withoutSummons?(inst: Instance, p: Player): void;
}

export function strikeOf(p: Player, rt: SkillRuntime, coef = rt.def.coef): Strike {
  return { skill: rt.def.id, coef, el: skillElement(rt), pct: skillPct(p, rt), mult: skillMult(p, rt.def.id) };
}

export function emitCast(inst: Instance, p: Player, rt: SkillRuntime, tx: number, ty: number, rad?: number) {
  const rune = p.save.skills.runes[rt.def.id];
  const ev: { e: 'cast'; s: number; sk: string; r?: string; x: number; y: number; tx: number; ty: number; rad?: number } = {
    e: 'cast', s: p.id, sk: rt.def.id, x: Math.round(p.x), y: Math.round(p.y), tx: Math.round(tx), ty: Math.round(ty),
  };
  if (rune) ev.r = rune;
  if (rad) ev.rad = Math.round(rad);
  inst.emit(ev, p.x, p.y, p.id);
}

export function face(p: Player, x: number) {
  if (Math.abs(x - p.x) > 2) p.faceLeft = x < p.x;
  p.faceLockMs = 260;
}

export function fanAngles(n: number, stepRad: number): number[] {
  const out = [0];
  for (let i = 1; out.length < n; i++) { out.push(i * stepRad); if (out.length < n) out.push(-i * stepRad); }
  return out;
}

/** Keep at most `max` summons of a skill, retiring the ones farthest from the player first. */
export function trimSummons(p: Player, skill: string, max: number) {
  const mine = p.summons.filter((s) => !s.dead && s.skill === skill && s.type !== 'dust_devil');
  if (mine.length <= max) return;
  mine.sort((a, b) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 - ((a.x - p.x) ** 2 + (a.y - p.y) ** 2));
  for (let i = 0; i < mine.length - max; i++) mine[i].dead = true;
}

export function faceTo(s: Summon, x: number) {
  if (Math.abs(x - s.x) > 2) s.faceLeft = x < s.x;
}
