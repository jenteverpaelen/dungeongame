// Skill dispatch (ARCHITECTURE 1.5): primaries, slot casts, channels, death hooks and summon AI, routed by skill id /
// summon type to the per-class behaviour modules. To add a skill: data in shared/src/data/skills/<class>.ts, behaviour
// in ./<class>.ts registered in its <CLASS>_BEHAVIOURS map (docs/rework/depth/FOUNDATION.md has the full recipe).

import { debtFloor } from '../powerActions';
import { anyEnemyWithin } from '../brain';
import type { Instance } from '../instance';
import { skillCost, skillRadius } from '../playerctx';
import type { Mob, Player, SkillRuntime } from '../types';
import { emitCast, face, type DeathHook, type OwnerSummonHook, type SkillBehaviour, type SummonBehaviour } from './common';
import { MAGE_BEHAVIOURS, MAGE_SUMMONS, shatterHook } from './mage';
import { RANGER_BEHAVIOURS, RANGER_OWNER_HOOKS, RANGER_SUMMONS } from './ranger';
import { WARRIOR_BEHAVIOURS, WARRIOR_SUMMONS, contagionHook, ruptureHook, warriorDepthHook } from './warrior';
import { WARRIOR_M1_BEHAVIOURS } from './warriorM1';

export { strikeOf } from './common';
export type { DeathHook, OwnerSummonHook, SkillBehaviour, SummonBehaviour } from './common';
export { clusterExplode } from './ranger';

// Built on first use so module cycles (projectiles ↔ skills) never observe a half-initialised registry.
let behaviours: Record<string, SkillBehaviour> | null = null;
let summonKinds: Record<string, SummonBehaviour> | null = null;

export function skillBehaviour(id: string): SkillBehaviour | undefined {
  behaviours ??= { ...WARRIOR_BEHAVIOURS, ...WARRIOR_M1_BEHAVIOURS, ...RANGER_BEHAVIOURS, ...MAGE_BEHAVIOURS };
  return Object.hasOwn(behaviours, id) ? behaviours[id] : undefined;
}

export function summonBehaviour(type: string): SummonBehaviour | undefined {
  summonKinds ??= { ...WARRIOR_SUMMONS, ...RANGER_SUMMONS, ...MAGE_SUMMONS };
  return Object.hasOwn(summonKinds, type) ? summonKinds[type] : undefined;
}

/** Owner hooks after summon movement, in registration order. */
export function ownerSummonHooks(): readonly OwnerSummonHook[] {
  return RANGER_OWNER_HOOKS;
}

/** Death hooks in a fixed order (the order is observable through RNG use, so append new hooks at the end). */
function deathHooks(): readonly DeathHook[] {
  return [contagionHook, shatterHook, ruptureHook, warriorDepthHook];
}

// ─────────────────────────── Primary attacks ───────────────────────────

export function castPrimary(inst: Instance, p: Player, tgt: Mob) {
  const rt = p.ctx.primary;
  face(p, tgt.x);
  p.attackFlagMs = 250;
  p.attackSeq++;
  skillBehaviour(rt.def.id)?.primary?.(inst, p, rt, tgt);
}

// ─────────────────────────── Channels ───────────────────────────

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

/** Generic channel upkeep (resource drain, grace without enemies), then the skill's own tick. */
export function channelTick(inst: Instance, p: Player, dtMs: number) {
  const ch = p.channel!;
  p.acting = ch.skill; // statuses the channel applies report it (applyStatus procs filtered by skill)
  const rt = p.ctx.slotted(ch.skill);
  if (!rt) { p.channel = null; return; }
  p.res -= skillCost(p, rt) * (dtMs / 1000);
  const floor = p.ctx.powers.debt.length ? debtFloor(p, ch.skill) : 0; // resource debt (engine wave 2)
  if (p.res <= floor) { p.res = floor; endChannel(inst, p); return; }
  const a = rt.def.auto;
  const within = (a.when === 'channel' ? a.within : 240) + 40;
  if (anyEnemyWithin(inst, p.x, p.y, within)) ch.graceMs = 600;
  else {
    ch.graceMs -= dtMs;
    if (ch.graceMs <= 0) { endChannel(inst, p); return; }
  }
  ch.spunMs += dtMs;
  skillBehaviour(rt.def.id)?.channelTick?.(inst, p, rt, ch, dtMs);
}

// ─────────────────────────── Slot skills ───────────────────────────

/** Execute a slotted skill. Returns false if it found nothing to do (no cost / cooldown is paid). */
export function castSkill(inst: Instance, p: Player, rt: SkillRuntime): boolean {
  const cast = skillBehaviour(rt.def.id)?.cast;
  return cast ? cast(inst, p, rt) : false;
}

// ─────────────────────────── Death hooks ───────────────────────────

/** Skill effects that trigger when a monster dies (Rupture, Contagion, Shatter, ...). */
export function skillDeathHooks(inst: Instance, m: Mob, killer: Player | null, skill: string) {
  for (const hook of deathHooks()) hook(inst, m, killer, skill);
}
