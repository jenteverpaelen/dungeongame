// Synthetic definition/runtime audit; no claims about human build quality or measured DPS.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buySkillTier, createCharacter, resetSkillTiers, skillPointsSpent } from '../shared/src/character';
import { SKILLS, TIER_COSTS, describeSkill, runeUnlockLevel, skillsForClass } from '../shared/src/data/skills';
import { MAX_LEVEL } from '../shared/src/constants';
import { skillPointsForLevel } from '../shared/src/progression';
import { computeStats } from '../shared/src/stats';
import { buildCtx, maxSummonsOf, skillCooldownMs, skillCost, skillDurationMs, skillElement, skillRadius } from '../server/src/sim/playerctx';
import type { Player } from '../server/src/sim/types';
import type { ClassId } from '../shared/src/types';

assert.ok(process.env.DATA_DIR, 'Build audit requires a fresh isolated DATA_DIR');
assert.equal((await fs.readdir(process.env.DATA_DIR)).length, 0);
const simFiles = (await fs.readdir('server/src/sim')).filter(n => n.endsWith('.ts')).sort();
const simSources = await Promise.all(simFiles.map(async name => ({ name, lines: (await fs.readFile(path.join('server/src/sim', name), 'utf8')).split(/\r?\n/) })));
const flagOrigins = new Map<string, string[]>();
const definitions = Object.values(SKILLS).map(skill => ({
  id: skill.id, classId: skill.classId, name: skill.name, kind: skill.kind, unlock: skill.unlock,
  auto: skill.auto, description: skill.desc,
  tiers: skill.tiers.map((tier, i) => {
    const cumulativeCost = TIER_COSTS.slice(0, i + 1).reduce((a, b) => a + b, 0);
    let earliestLevel: number | null = null;
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const save = createCharacter('TierAudit', skill.classId, 17); save.level = level; save.skillPoints = skillPointsForLevel(level);
      let allBought = true;
      for (let t = 0; t <= i; t++) if (buySkillTier(save, skill.id) !== null) { allBought = false; break; }
      if (allBought) { earliestLevel = level; break; }
    }
    for (const f of tier.mods.flags ?? []) flagOrigins.set(f, [...(flagOrigins.get(f) ?? []), `${skill.id}:tier${i + 1}`]);
    return { tier: i + 1, ...tier, cumulativeCost, earliestLevelIfNoOtherSpend: earliestLevel };
  }),
  runes: skill.runes.map((rune, i) => {
    for (const f of rune.mods.flags ?? []) flagOrigins.set(f, [...(flagOrigins.get(f) ?? []), `${skill.id}:${rune.id}`]);
    return { ...rune, unlock: runeUnlockLevel(skill, i) };
  }),
}));
const combinations = Object.values(SKILLS).flatMap(skill => [null, ...skill.runes.map(r => r.id)].flatMap(rune => [0, 1, 2, 3].map(tier => {
  const save = createCharacter('BuildAudit', skill.classId, 17); save.level = MAX_LEVEL; save.equipment = {};
  save.skills.runes[skill.id] = rune; save.skills.tiers[skill.id] = tier;
  if (skill.kind !== 'primary') save.skills.slots[0] = skill.id;
  const ctx = buildCtx(save, computeStats(save)), rt = ctx.modsOf(skill.id);
  // These helpers read only ctx. No simulated attacks or full Player fixture implied.
  const helperPlayer = { ctx } as Player;
  return { skill: skill.id, rune, tier, mods: rt.mods, flags: [...rt.flags].sort(),
    cost: skillCost(helperPlayer, rt), cooldownMs: skillCooldownMs(helperPlayer, rt), radius: skillRadius(rt),
    durationMs: skillDurationMs(rt), maxSummons: skill.kind === 'summon' ? maxSummonsOf(rt) : null,
    element: skillElement(rt), description: describeSkill(skill, rt.mods) };
})));
const classes = (['warrior', 'ranger', 'mage'] as ClassId[]).map(classId => {
  const skills = skillsForClass(classId), save = createCharacter('RefundAudit', classId, 17);
  save.level = MAX_LEVEL; save.skillPoints = skillPointsForLevel(MAX_LEVEL);
  const starting = save.skillPoints, purchases: string[] = [];
  for (const skill of skills) while (buySkillTier(save, skill.id) === null) purchases.push(skill.id);
  const spent = skillPointsSpent(save), remaining = save.skillPoints, tiers = { ...save.skills.tiers };
  assert.equal(spent + remaining, starting);
  resetSkillTiers(save); assert.equal(save.skillPoints, starting); assert.equal(skillPointsSpent(save), 0);
  resetSkillTiers(save); assert.equal(save.skillPoints, starting, 'Repeated reset cannot grant points');
  return { classId, pointsAtCap: starting, allTierCost: skills.reduce((sum, s) => sum + TIER_COSTS.slice(0, s.tiers.length).reduce((a, b) => a + b, 0), 0),
    syntheticPurchaseOrder: purchases, tiersBeforeReset: tiers, spent, remaining, afterReset: save.skillPoints };
});
const flags = [...flagOrigins.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([flag, origins]) => ({
  flag, origins,
  lexicalConsumerCandidates: simSources.flatMap(({ name, lines }) => lines.flatMap((line, i) =>
    line.includes(`'${flag}'`) && (line.includes('.has(') || line.includes('.anyFlag(')) ? [{ file: `server/src/sim/${name}`, line: i + 1, text: line.trim() }] : [])),
}));
assert.equal(definitions.length, 18); assert.equal(definitions.flatMap(s => s.tiers).length, 54);
assert.equal(definitions.flatMap(s => s.runes).length, 54); assert.equal(combinations.length, 288);
const counts = { skills: definitions.length, tiers: 54, runes: 54, runtimeCombinations: combinations.length,
  tierModifierFields: Object.fromEntries([...new Set(definitions.flatMap(s => s.tiers.flatMap(t => Object.keys(t.mods))))].sort()
    .map(k => [k, definitions.flatMap(s => s.tiers).filter(t => Object.hasOwn(t.mods, k)).length])),
  distinctFlags: flags.length, flagsWithoutLexicalCandidate: flags.filter(f => !f.lexicalConsumerCandidates.length).map(f => f.flag) };
const result = { node: process.version, scope: 'Actual definitions, purchase/refund rules and runtime helper outputs on unequipped synthetic characters; not combat execution, player timing, balance or coverage proof.', counts, classes, definitions, combinations, flags };
const out = 'docs/phase/P01-research/checks/build-audit.json';
await fs.writeFile(out, JSON.stringify(result, null, 2) + '\n');
assert.equal((await fs.readdir(process.env.DATA_DIR)).length, 0);
console.log(JSON.stringify({ out, counts, classes }, null, 2));
