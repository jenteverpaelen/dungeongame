// Narrow generic engine additions made by the mage wave (docs/rework/depth/MAGE-PILOT.md §3), tested with fixture data
// only: projectile hooks (Proj.hook), "less" multipliers (skillMore with a negative pct), element stacks in the generic
// bucket (elementStacks.bucket), and the statusLonger rule change. Each is a no-op for content that does not use it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { ZONES } from '../../shared/src/data/zones';
import { validateEffects } from '../../shared/src/contentValidation';
import { SKILLS } from '../../shared/src/data/skills';
import { describeEffect, powerTextIssues, type PowerEffect } from '../../shared/src/powers';
import type { PlayerLink } from '../src/contracts';
import { Instance } from '../src/sim/instance';
import { createMob, DUMMY_DEF } from '../src/sim/monsters';
import { buildCtx } from '../src/sim/playerctx';
import { buildPowerRuntime, ownMultiplier, tagIndexFor } from '../src/sim/powerRuntime';
import { chillMob, freezeMob, getBuff, stunMob } from '../src/sim/effects';
import { spawnProj } from '../src/sim/projectiles';
import type { Player } from '../src/sim/types';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');

function world(extra: PowerEffect[] = []) {
  const save = createCharacter('EngineMage', 'warrior', 7);
  save.level = 70; save.skills.slots = ['whirlwind', null, null, null];
  const link: PlayerLink = { save, derived: computeStats(save), sessionId: save.id, send() {}, markDirty() {} };
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'engine-mage', channel: 1, seed: 11, theme: ZONES.whispering_glade.theme });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeMob(m);
  inst.addPlayer(link);
  const p: Player = inst.players[0];
  p.debugInfiniteHp = true;
  p.ctx = buildCtx(save, computeStats(save), extra.length ? [{ kind: 'set', id: 'fx', roll: 1, effects: extra }] : []);
  const post = createMob(inst, { ...DUMMY_DEF, id: 'engine_post', name: 'Post', hp: 40 }, 70, p.x + 220, p.y, { tier: 0 });
  post.hp = post.mhp = 1e12;
  return { inst, p, post };
}

test('projectile hooks: hit replaces the kind rule, tick runs every update, end runs once with the reason; wall bounces carry the hook', () => {
  const { inst, p, post } = world();
  try {
    let hits = 0, ticks = 0; const ends: string[] = [];
    spawnProj(inst, { kind: 'missile', v: 'missile', owner: p, src: p.id, x: p.x, y: p.y, angle: 0, speed: 800, lifeMs: 600, r: 12, el: 'arcane',
      strike: { skill: 'whirlwind', coef: 1, el: 'physical', pct: 0 }, hook: { hit: () => { hits++; }, tick: () => { ticks++; }, end: (_i, _pr, why) => { ends.push(why); } } });
    for (let i = 0; i < 20; i++) inst.tick();
    assert(hits > 0, 'the hook received the hit');
    assert.equal(post.hp, post.mhp, 'the kind rule (strike) did not run: the hook owns the hit');
    assert(ticks >= 5); assert.deepEqual(ends, ['life']);
    // keepLife: no clamp to the skill's reach (whirlwind range 260 at 100 units / s would clamp to ~2.9 s).
    const slow = spawnProj(inst, { kind: 'missile', v: 'missile', owner: p, src: p.id, x: p.x, y: p.y, angle: Math.PI / 2, speed: 100, lifeMs: 5000, r: 12, el: 'arcane',
      strike: { skill: 'whirlwind', coef: 1, el: 'physical', pct: 0 }, keepLife: true, hook: {} });
    assert.equal(slow.lifeMs, 5000);
  } finally { inst.destroy(); }
});

test('skillMore with a negative pct is a "less" multiplier: validated in (−100, cap], generated text says less', () => {
  const less: PowerEffect = { kind: 'skillMore', skills: ['whirlwind'], pct: -10 };
  const errs: string[] = [];
  validateEffects({ skills: SKILLS }, [less], 'fx', ['warrior'], (ok, at, msg) => { if (!ok) errs.push(`${at}: ${msg}`); });
  assert.deepEqual(errs, []);
  const bad: string[] = [];
  validateEffects({ skills: SKILLS }, [{ ...less, pct: -100 }], 'fx', ['warrior'], (ok, at, msg) => { if (!ok) bad.push(`${at}: ${msg}`); });
  assert.equal(bad.length, 1, 'never to zero');
  assert.match(describeEffect(less), /10% less damage/);
  assert.deepEqual(powerTextIssues('Whirlwind deals 10% less damage.', [less], false), []);
  const rt = buildPowerRuntime([{ kind: 'set', id: 'fx', roll: 1, effects: [less] }], tagIndexFor('warrior', {}));
  assert.equal(rt.ownStatic.get('whirlwind'), 0.9);
});

test('elementStacks bucket "generic": no per-hit term; the stacks buff carries +perStack % per element in the generic bucket', () => {
  const fx: PowerEffect = { kind: 'elementStacks', elements: ['physical', 'fire'], windowMs: 4000, perStack: 5, buff: 'fallen_star', bucket: 'generic' };
  const rt = buildPowerRuntime([{ kind: 'set', id: 'fx', roll: 1, effects: [fx] }], tagIndexFor('warrior', {}));
  assert.equal(rt.hitTerms.length, 0); assert.equal(rt.elementStacks?.generic, true);
  const { inst, p, post } = world([fx]);
  try {
    assert.equal(ownMultiplier(p, 'whirlwind'), 1);
    p.lastEle.fire = inst.t; inst.tick();
    assert.equal(getBuff(p, 'fallen_star')?.st, 1);
    assert.equal(p.live.dmg, 5);
    p.lastEle.physical = inst.t; inst.tick();
    assert.equal(p.live.dmg, 10, 'two elements');
    void post;
  } finally { inst.destroy(); }
  assert.match(describeEffect(fx), /grants 5% increased damage for 4 seconds per element/);
});

test('rule statusLonger: your chills / stuns / freezes last pct % longer; others are unchanged', () => {
  const { inst, p, post } = world([{ kind: 'rule', rule: { id: 'statusLonger', status: 'chill', pct: 25 } }, { kind: 'rule', rule: { id: 'statusLonger', status: 'freeze', pct: 50 } }]);
  try {
    chillMob(post, 1000, inst, p); assert.equal(post.chillMs, 1250);
    freezeMob(post, 1000, 0, 0, inst, p); assert.equal(post.freezeMs, 1500);
    stunMob(post, 1000, inst, p); assert.equal(post.stunMs, 1000, 'no stun rule');
    post.chillMs = 0; chillMob(post, 1000); assert.equal(post.chillMs, 1000, 'without the applying player: unchanged');
  } finally { inst.destroy(); }
  assert.match(describeEffect({ kind: 'rule', rule: { id: 'statusLonger', status: 'chill', pct: 25 } }), /Your Chills last 25% longer/);
});
