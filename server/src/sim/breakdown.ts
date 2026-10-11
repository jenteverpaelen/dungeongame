// Build tools T1 / T2 (docs/rework/depth/BUILD-TOOLS.md): the exact numbers of a player's skills, read from the live
// player with the combat code itself — the playerctx skill functions (cost, cooldown, radius, duration), the strike the
// skill module builds (strikeOf), damage.expectedDamage with a BaseTerms sink (every factor in the order baseMult applies
// it) and the power runtime's terms with their sources (powerRuntime TermSource / trace). Nothing here re-implements a
// formula; a test checks that the factors multiply back to expectedDamage.

import { describeEffect, OWN_BUCKET_CAP, type PowerEffect } from '../../../shared/src/powers';
import type { BuildSheet, SheetCond, SheetPart, SkillSheet } from '../../../shared/src/buildSheet';
import { SKILLS, modVar, skillModParts } from '../shared';
import { savedNodeRanks } from '../../../shared/src/specialization';
import { eliteFactor, expectedDamage, type BaseTerms } from './damage';
import type { Instance } from './instance';
import { maxSummonsOf, skillCooldownMs, skillCost, skillDurationMs, skillElement, skillRadius } from './playerctx';
import { conditionCount, type TermSource } from './powerRuntime';
import { strikeOf } from './skills/common';
import type { Player } from './types';

const round = (n: number, d = 4) => +n.toFixed(d);

function effectOf(p: Player, t: TermSource): PowerEffect | undefined {
  const src = p.ctx.powers.sources.find((s) => `${s.kind}:${s.id}` === t.src);
  return src?.effects[t.i];
}
const textOf = (p: Player, t: TermSource) => { const e = effectOf(p, t); return e ? describeEffect(e) : ''; };

/** The sheet of one skill the player has (bar or not), or null for an unknown / other-class skill. */
export function skillSheet(inst: Instance, p: Player, id: string): SkillSheet | null {
  const def = SKILLS[id];
  if (!def || def.classId !== p.save.classId) return null;
  const rt = p.ctx.modsOf(id), pw = p.ctx.powers, d = p.ctx.d;
  const st = strikeOf(p, rt);
  const sink: BaseTerms = { coef: 0, mainStat: 1, skill: 1, element: 1, generic: 1, own: 1, hit: [] };
  const perHit = expectedDamage(inst, p, st, sink);
  const chc = Math.min(100, d.chc + p.live.chc), chd = d.chd + p.live.chd;

  // Skill bucket: the skill's own contributors (rune, tiers, nodes), power templates, the character sheet.
  const skill: SheetPart[] = [];
  for (const part of skillModParts(def, p.save.skills.runes[id], p.save.skills.tiers[id] ?? 0, savedNodeRanks(p.save, id))) {
    const v = part.mods.reduce((n, m) => n + (m.dmg ?? 0), 0);
    if (v) skill.push({ src: `${part.kind}:${part.id}`, name: part.name, value: v });
  }
  for (const t of pw.trace.mods.get(id) ?? []) skill.push({ src: t.src, value: t.value, text: textOf(p, t) });
  if (d.skillDmg[id]) skill.push({ src: 'gear:skillDmg', name: 'Equipment, Lantern Ranks and passives', value: d.skillDmg[id] });

  const generic: SheetPart[] = [];
  if (d.dmgPct) generic.push({ src: 'gear:dmgPct', name: 'Damage bonus (character sheet)', value: d.dmgPct });
  // Buff parts as effects.refreshLive sums them (dmg once, stacking sdmg per stack); the factor itself is the real one.
  for (const b of p.buffs) { const v = (b.dmg ?? 0) + (b.sdmg ? b.sdmg * (b.st ?? 1) : 0); if (v) generic.push({ src: `buff:${b.id}`, name: b.id, value: v }); }
  if (st.gen) generic.push({ src: 'strike:gen', name: 'Strike bonus', value: st.gen });

  const own: SheetPart[] = (pw.trace.own.get(id) ?? []).map((t) => ({ src: t.src, value: t.value, text: textOf(p, t) }));
  const conds: SheetCond[] = [];
  for (const t of pw.ownTerms) {
    if (t.skills && !t.skills.has(id)) continue;
    const n = conditionCount(p, t.when, undefined, null);
    conds.push({ src: t.src, text: textOf(p, t), bucket: 'own', pct: t.pct, holds: n > 0 });
    if (n) own.push({ src: t.src, value: 1 + t.pct / 100 * n, text: textOf(p, t) });
  }
  if (sink.own < own.reduce((m, x) => m * x.value, 1) - 1e-9) own.push({ src: 'cap:own', name: `Own-bucket cap ×${OWN_BUCKET_CAP}`, value: sink.own });

  const hit: SheetPart[] = sink.hit.map((h) => ({ src: h.term.src, value: h.factor, text: textOf(p, h.term) }));
  for (const t of pw.hitTerms) {
    if (t.kind === 'cond' && t.skills && !t.skills.has(id)) continue;
    conds.push({ src: t.src, text: textOf(p, t), bucket: 'hit', pct: t.pct, holds: sink.hit.some((h) => h.term === t) });
  }
  for (const t of pw.vulnTerms) {
    if (t.skills && !t.skills.has(id)) continue;
    conds.push({ src: t.src, text: textOf(p, t), bucket: 'target', pct: t.pct, holds: false });
  }

  const vsParts: SheetPart[] = pw.trace.folded.map((t) => ({ src: t.src, value: 1 + t.value / 100, text: `${t.state === 'stunned' ? 'Stunned' : 'Frozen'} enemies: ${textOf(p, t)}` }));
  const hitFactor = sink.hit.reduce((m, h) => m * h.factor, 1);
  const genPct = modVar(rt.mods, 'genPct');
  const gen = (def.gen + (rt.mods.gen ?? 0)) * (genPct ? Math.max(0, 1 + genPct / 100) : 1);
  return {
    id, tags: [...(pw.index.get(id) ?? [])], element: skillElement(rt),
    coef: round(st.coef), cost: round(skillCost(p, rt), 2), costPerSecond: def.kind === 'channel', gen: round(gen, 2),
    cooldownMs: Math.round(skillCooldownMs(p, rt)), durationMs: Math.round(skillDurationMs(rt)), radius: Math.round(skillRadius(rt)),
    maxSummons: def.maxSummons > 0 ? maxSummonsOf(rt) : 0, extraProjectiles: rt.mods.projectiles ?? 0,
    charges: (pw.rules.charges.get(id) ?? 0) + (pw.rules.charges.get('*') ?? 0),
    weaponAvg: round((d.weaponMin + d.weaponMax) / 2, 2),
    factors: {
      coef: round(sink.coef), mainStat: round(sink.mainStat), skill: round(sink.skill), element: round(sink.element),
      generic: round(sink.generic), own: round(sink.own), hit: round(hitFactor), crit: round(1 + chc / 100 * chd / 100),
    },
    parts: { skill, generic, own, hit },
    crit: { chance: round(chc, 2), damage: round(chd, 2) },
    perHit: Math.round(perHit), eliteFactor: round(eliteFactor(p)),
    vs: { stunned: round(p.ctx.stunMult), frozen: round(p.ctx.frozenMult), parts: vsParts },
    conds,
  };
}

/** Sheets for the requested skills (default: the primary and the four bar slots), with the live state they read. */
export function buildSheet(inst: Instance, p: Player, ids?: readonly string[]): BuildSheet {
  const want = ids?.length ? ids : [p.ctx.primary.def.id, ...p.ctx.slots.map((s) => s?.def.id ?? null).filter((x): x is string => !!x)];
  const skills = [...new Set(want)].map((id) => skillSheet(inst, p, id)).filter((s): s is SkillSheet => !!s);
  return {
    skills, at: inst.t,
    state: { inTown: inst.kind === 'town', channeling: p.channel?.skill ?? null, buffs: p.buffs.map((b) => b.id), lifePct: Math.round(p.hp / p.mhp * 100), resourcePct: Math.round(p.res / Math.max(1, p.mres) * 100) },
  };
}
