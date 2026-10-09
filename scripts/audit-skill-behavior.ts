// Focused actual-handler probe: stationary synthetic arena, not an active-play DPS test.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCharacter, computeStats, SKILLS, MONSTERS, ZONES, describeSkill, type ClassId } from '../server/src/shared';
import type { PlayerLink } from '../server/src/contracts';
import { Instance } from '../server/src/sim/instance';
import { createMob } from '../server/src/sim/monsters';
import { spawnSummon, updateSummons } from '../server/src/sim/summons';
import { updateProjectiles } from '../server/src/sim/projectiles';
import { castSkill } from '../server/src/sim/skills';
import { getBuff } from '../server/src/sim/effects';

assert.ok(process.env.DATA_DIR, 'Use an explicit empty isolated DATA_DIR');
assert.equal((await fs.readdir(process.env.DATA_DIR)).length, 0);
function fixture(cls: ClassId, skill: string, rune: string | null, tiers: number) {
  const save = createCharacter('SkillBehavior', cls, 31); save.level = 70;
  save.equipment = {};
  save.skills.slots = [skill, null, null, null]; save.skills.runes[skill] = rune; save.skills.tiers[skill] = tiers;
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: 'skill-probe', send() {}, markDirty() {} };
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'skill-probe', channel: 1, seed: 73, theme: ZONES.whispering_glade.theme });
  for (const mob of [...inst.mobs]) inst.removeEntity(mob.id);
  inst.addPlayer(link); const p = inst.players[0];
  return { inst, p, save };
}
const hydras: unknown[] = [];
for (const rune of [null, 'arcane_hydra', 'frost_hydra']) {
  const { inst, p } = fixture('mage', 'hydra', rune, 0);
  try {
    const spot = inst.map.spawns.find(s => {
      for (let dx = -64; dx <= 320; dx += 32) for (let dy = -64; dy <= 128; dy += 32) if (!inst.cw.isFree(s.x + dx, s.y + dy, 22)) return false;
      return true;
    });
    assert.ok(spot, 'Fixture needs a real clear patch');
    p.x = p.mv.x = spot.x - 40; p.y = p.mv.y = spot.y;
    const a = createMob(inst, MONSTERS.bog_slime, 70, spot.x + 220, spot.y);
    const b = createMob(inst, MONSTERS.bog_slime, 70, spot.x + 220, spot.y + 50 + a.r);
    for (const m of [a, b]) { m.hp = m.mhp = 1e9; m.noReward = true; }
    const summon = spawnSummon(inst, p, 'hydra', 'hydra', spot.x, spot.y, 9000);
    updateSummons(inst, 400);
    assert.equal(inst.projs.length, 1, 'Observe exactly one actual Hydra shot');
    const shot = inst.projs[0];
    const projectile = { kind: shot.kind, visual: shot.v, element: shot.el, splash: shot.splash, radius: shot.r, bits: shot.bits, coef: shot.strike?.coef };
    let elapsedMs = 0;
    while (inst.projs.length && elapsedMs < 1000) { elapsedMs += 50; inst.t += 50; updateProjectiles(inst, 50); }
    assert.equal(inst.projs.length, 0); assert.ok(a.hp < a.mhp, 'Shot must hit the direct target');
    assert.equal(b.hp < b.mhp, rune === 'arcane_hydra', 'Only the larger Arcane splash reaches this off-path target');
    assert.equal(a.chillMs, rune === 'frost_hydra' ? 2000 : 0); assert.equal(b.chillMs, 0);
    hydras.push({ rune, origin: spot, targets: [a, b].map(m => ({ x: m.x, y: m.y, radius: m.r, damage: m.mhp - m.hp, chillMs: m.chillMs })),
      projectile, elapsedMs, attackSeq: summon.attackSeq, currentRuneText: SKILLS.hydra.runes.find(r => r.id === rune)?.desc ?? null });
  } finally { inst.destroy(); }
}
const buffs: unknown[] = [];
for (const id of ['battle_rage', 'magic_weapon']) {
  const skill = SKILLS[id];
  for (const rune of [null, ...skill.runes.map(r => r.id)]) for (let tiers = 0; tiers <= 3; tiers++) {
    const { inst, p } = fixture(skill.classId, id, rune, tiers);
    try {
      const rt = p.ctx.slotted(id)!; assert.ok(castSkill(inst, p, rt));
      const buff = getBuff(p, id)!; assert.ok(buff);
      const damage = (id === 'battle_rage' ? (rune === 'marauders_rage' ? 25 : 10) : (rune === 'force_weapon' ? 20 : 10)) + (tiers === 3 ? 5 : 0);
      assert.equal(buff.dmg, damage); assert.equal(buff.ms, tiers > 0 ? 90000 : 60000);
      buffs.push({ skill: id, rune, tiers, flags: [...rt.flags], buff: structuredClone(buff), description: describeSkill(skill, rt.mods) });
    } finally { inst.destroy(); }
  }
}
const outputArg = process.argv.indexOf('--output');
const out = path.resolve(outputArg >= 0 ? process.argv[outputArg + 1] : 'docs/phase/P01-research/checks/skill-behavior-before.json');
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify({ node: process.version,
  scope: 'Actual summon/projectile/cast handlers with stationary synthetic targets, unequipped L70 characters; one shot and 32 buff variants, not DPS or active AI.', hydras, buffs }, null, 2) + '\n');
assert.equal((await fs.readdir(process.env.DATA_DIR)).length, 0);
console.log(JSON.stringify({ out, hydraCases: hydras.length, buffCases: buffs.length }));
