// Synthetic authoring fault probe; never a player-pacing or balance measurement.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CONTENT_DATA, validateContent, type ContentData } from '../shared/src/contentValidation';
import { createCharacter, computeStats, MONSTERS, ZONES, type ClassId } from '../server/src/shared';
import type { PlayerLink } from '../server/src/contracts';
import { Instance } from '../server/src/sim/instance';
import { createMob } from '../server/src/sim/monsters';
import { playerBrain } from '../server/src/sim/brain';

const mode = process.argv[2];
assert.ok(mode === 'before' || mode === 'after', 'Choose before or after explicitly');
assert.ok(process.env.DATA_DIR, 'Set an isolated DATA_DIR');
const dataDir = await fs.realpath(process.env.DATA_DIR);
const tempDir = await fs.realpath(os.tmpdir());
assert.equal(path.dirname(dataDir).toLowerCase(), tempDir.toLowerCase());
assert.ok(path.basename(dataDir).startsWith('hf-auto-validation-'));
assert.deepEqual(await fs.readdir(dataDir), [], 'Use a fresh empty directory');
assert.equal(process.env.BACKUP_DIR, '');
assert.equal(process.env.BACKUP_KEEP, '0');

const hash = () => createHash('sha256').update(JSON.stringify(CONTENT_DATA)).digest('hex');
const originalHash = hash();
assert.deepEqual(validateContent(), []);
function contentFixture(): ContentData {
  const { affixes, ...plain } = CONTENT_DATA;
  return { ...structuredClone(plain), affixes: affixes.map(a => ({ ...a, ranges: structuredClone(a.ranges) })) };
}
const invalidValues = [['NaN', NaN], ['positive infinity', Infinity], ['negative infinity', -Infinity], ['negative', -1]] as const;
const validation = [];
for (const field of ['nearCount', 'nearDistance', 'channelResource', 'channelDistance'] as const) {
  for (const [label, value] of invalidValues) {
    const data = contentFixture();
    const near = data.skills.meteor.auto, channel = data.skills.whirlwind.auto;
    assert.equal(near.when, 'enemiesNear'); assert.equal(channel.when, 'channel');
    if (near.when !== 'enemiesNear' || channel.when !== 'channel') throw new Error('Fixture definitions changed');
    if (field === 'nearCount') near.count = value;
    if (field === 'nearDistance') near.within = value;
    if (field === 'channelResource') channel.startAt = value;
    if (field === 'channelDistance') channel.within = value;
    const errors = validateContent(data);
    assert.equal(errors.length, mode === 'before' ? 0 : 1, `${field}/${label}: ${errors}`);
    validation.push({ field, value: label, errors });
  }
}

function brainCase(classId: ClassId, skillId: 'meteor' | 'whirlwind', invalid: boolean) {
  const save = createCharacter('SyntheticAutoRule', classId, 31);
  save.level = 70; save.equipment = {};
  save.skills.slots = [skillId, null, null, null];
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: 'auto-rule-probe', send() {}, markDirty() {} };
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'auto-rule-probe', channel: 1, seed: 73, theme: ZONES.whispering_glade.theme });
  try {
    for (const mob of [...inst.mobs]) inst.removeEntity(mob.id);
    const spot = inst.map.spawns.find(s => {
      for (let dx = -64; dx <= 256; dx += 32) for (let dy = -64; dy <= 64; dy += 32) {
        if (!inst.cw.isFree(s.x + dx, s.y + dy, 22)) return false;
      }
      return true;
    });
    assert.ok(spot, 'Fixture requires a clear generated field patch');
    inst.addPlayer(link, spot);
    const p = inst.players[0];
    p.atkCdMs = 10_000; // Suppress the unrelated primary attack during this single brain tick.
    p.res = skillId === 'whirlwind' ? 10 : p.mres;
    const initialResource = p.res;
    const rt = p.ctx.slots[0]; assert.ok(rt);
    rt.def = structuredClone(rt.def); // Never mutate a global authored definition.
    if (skillId === 'meteor') {
      assert.equal(rt.def.auto.when, 'enemiesNear');
      if (rt.def.auto.when === 'enemiesNear' && invalid) rt.def.auto.count = NaN;
    } else {
      assert.equal(rt.def.auto.when, 'channel');
      if (rt.def.auto.when === 'channel' && invalid) rt.def.auto.startAt = NaN;
    }
    const m = createMob(inst, MONSTERS.bog_slime, 70, spot.x + 160, spot.y);
    m.hp = m.mhp = 1e9; m.noReward = true;
    playerBrain(inst, p, 50);
    // Meteor has zero cooldown, so readyAt is not a cast receipt. The primary is suppressed above.
    const castStarted = skillId === 'meteor' ? p.attackSeq > 0 : p.channel?.skill === skillId;
    assert.equal(castStarted, skillId === 'meteor' ? !invalid : invalid);
    return { classId, skillId, threshold: invalid ? 'NaN synthetic fault' : 'unchanged authored value', initialResource, castStarted, resourceAfter: p.res };
  } finally { inst.destroy(); }
}
const brain = [brainCase('mage', 'meteor', false), brainCase('mage', 'meteor', true), brainCase('warrior', 'whirlwind', false), brainCase('warrior', 'whirlwind', true)];
assert.equal(hash(), originalHash, 'Global content must remain unchanged');
assert.deepEqual(await fs.readdir(dataDir), [], 'Probe must not persist characters');
const report = {
  checkpoint: 'C069', mode, node: process.version, platform: process.platform,
  isolatedDataDir: path.basename(dataDir), authoredContentSha256: originalHash,
  currentAuthoredContentValid: true, invalidFixtures: validation.length,
  invalidFixturesRejected: validation.filter(x => x.errors.length > 0).length,
  validation, brain, liveDataRead: false, gameDataChanged: false, serverStarted: false,
  limits: 'Synthetic faults exercise real single-tick brain behavior; not a current-content defect, player pacing, load, browser or full combat test.',
};
await fs.writeFile(path.join(dataDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
