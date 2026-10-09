import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, computeStats, SKILLS, ZONES, describeSkill } from '../src/shared';
import type { PlayerLink } from '../src/contracts';
import { Instance } from '../src/sim/instance';
import { castSkill } from '../src/sim/skills';
import { getBuff } from '../src/sim/effects';

assert.ok(process.env.DATA_DIR, 'Use an isolated DATA_DIR');

for (const id of ['battle_rage', 'magic_weapon'] as const) {
  test(`${id}: every rune/tier summary matches the actual cast and preserved bonuses`, () => {
    const skill = SKILLS[id];
    for (const rune of [null, ...skill.runes.map(r => r.id)]) for (let tiers = 0; tiers <= 3; tiers++) {
      const save = createCharacter('DescriptionTest', skill.classId, 31);
      save.level = 70; save.equipment = {};
      save.skills.slots = [id, null, null, null]; save.skills.runes[id] = rune; save.skills.tiers[id] = tiers;
      const link: PlayerLink = { save, derived: computeStats(save), sessionId: 'description', send() {}, markDirty() {} };
      const inst = new Instance({ zoneId: 'whispering_glade', key: 'description', channel: 1, seed: 73, theme: ZONES.whispering_glade.theme });
      try {
        inst.addPlayer(link); const p = inst.players[0], rt = p.ctx.slotted(id)!;
        assert.ok(castSkill(inst, p, rt)); const buff = getBuff(p, id)!; assert.ok(buff);
        const expectedBase = rune === 'marauders_rage' ? 25 : rune === 'force_weapon' ? 20 : 10;
        assert.equal(buff.dmg, expectedBase + (tiers === 3 ? 5 : 0));
        assert.equal(buff.ms, tiers ? 90000 : 60000);
        const description = describeSkill(skill, rt.mods);
        assert.ok(description.includes(`damage by ${buff.dmg}%`), description);
        assert.ok(description.includes(`for ${buff.ms / 1000} seconds`), description);
        assert.doesNotMatch(description, /\{[^}]+\}/);
        if (id === 'battle_rage') {
          assert.equal(buff.chc, 3); assert.equal(buff.chd, rune === 'ferocity' ? 25 : 0);
          assert.ok(description.includes(`Critical Hit Chance by ${buff.chc}%`));
          assert.equal(description.includes(`Critical Hit Damage by ${buff.chd}%`), !!buff.chd);
        }
      } finally { inst.destroy(); }
    }
  });
}
