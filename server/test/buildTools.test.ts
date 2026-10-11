// Build tools M1 (docs/rework/depth/BUILD-TOOLS.md): the damage sheet's numbers are the combat code's own, the
// bench measures per skill, loadouts and build codes apply only what the character may use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { skillsForClass } from '../../shared/src/data/skills';
import { computeStats } from '../../shared/src/stats';
import { powerSourceName } from '../../shared/src/powerSourceNames';
import type { ClassId } from '../../shared/src/types';
import type { PowerEffect } from '../../shared/src/powers';
import type { PowerSource } from '../../shared/src/powerSources';
import { buildSheet, skillSheet } from '../src/sim/breakdown';
import { expectedDamage } from '../src/sim/damage';
import { addBuff } from '../src/sim/effects';
import { Instance } from '../src/sim/instance';
import { buildCtx, skillCooldownMs, skillCost, skillRadius } from '../src/sim/playerctx';
import { strikeOf } from '../src/sim/skills/common';
import type { Session } from '../src/net/session';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');
const skillsForClassIds = (c: ClassId) => skillsForClass(c).map((s) => s.id);

function world(classId: ClassId, effects: PowerEffect[] = [], o: { slots?: (string | null)[]; level?: number; runes?: Record<string, string>; tiers?: Record<string, number>; nodes?: Record<string, Record<string, number>> } = {}) {
  const inst = new Instance({ zoneId: 'whispering_glade', key: 'bt', channel: 0, seed: 47, theme: 'glade', level: 70, difficulty: 5 });
  inst.spawner.tick = () => {};
  for (const m of [...inst.mobs]) inst.removeEntity(m.id);
  const save = createCharacter('Builder', classId, 9); save.level = o.level ?? 70;
  if (o.slots) save.skills.slots = o.slots;
  if (o.runes) save.skills.runes = o.runes;
  if (o.tiers) save.skills.tiers = o.tiers;
  if (o.nodes) save.skills.nodes = o.nodes;
  const s = { save, derived: computeStats(save), sessionId: save.id, send() {}, sendRaw() {}, markDirty() {}, changed() {}, rec: { inst } } as unknown as Session;
  s.entityId = inst.addPlayer(s);
  const p = inst.playerById(s.entityId)!;
  const extra: PowerSource[] = effects.length ? [{ kind: 'legendary', id: 'faultcleaver', roll: 1, effects }] : [];
  p.ctx = buildCtx(save, computeStats(save), extra);
  return { inst, p, save, s };
}

test('sheet: the factors multiply back to expectedDamage, final cost / cooldown / radius are the playerctx values', () => {
  const { inst, p } = world('warrior', [
    { kind: 'skillMods', skills: ['whirlwind'], mods: { dmg: 40 } },
    { kind: 'ownMult', skills: ['whirlwind'], mult: 1.5 },
    { kind: 'conditional', when: { channeling: true }, bucket: 'own', pct: 20, skills: ['whirlwind'] },
    { kind: 'conditional', when: { targetState: 'stunned' }, bucket: 'hit', pct: 30 },
  ], { slots: ['whirlwind', 'ground_stomp', 'ironplough', null], runes: { whirlwind: 'dust_devils' }, tiers: { whirlwind: 2, ironplough: 1 } });
  try {
    addBuff(p, { id: 'fx_bt_rage', ms: 5000, dmg: 15 });
    const sheet = buildSheet(inst, p);
    assert.deepEqual(sheet.skills.map((x) => x.id), [p.ctx.primary.def.id, 'whirlwind', 'ground_stomp', 'ironplough']);
    for (const sk of sheet.skills) {
      const rt = p.ctx.modsOf(sk.id);
      const f = sk.factors;
      const product = sk.weaponAvg * f.coef * f.mainStat * f.skill * f.element * f.generic * f.own * f.hit * f.crit;
      assert(Math.abs(product - sk.perHit) <= Math.max(1, sk.perHit * 1e-3), `${sk.id}: factors ${product} vs perHit ${sk.perHit}`);
      assert.equal(sk.perHit, Math.round(expectedDamage(inst, p, strikeOf(p, rt))), `${sk.id}: the real expectedDamage`);
      assert.equal(sk.cost, +skillCost(p, rt).toFixed(2));
      assert.equal(sk.cooldownMs, Math.round(skillCooldownMs(p, rt)));
      assert.equal(sk.radius, Math.round(skillRadius(rt)));
    }
    const ww = sheet.skills.find((x) => x.id === 'whirlwind')!;
    const skillParts = ww.parts.skill.reduce((n, x) => n + x.value, 0);
    assert(Math.abs((ww.factors.skill - 1) * 100 - skillParts) < 1e-6, `skill bucket parts add up (${skillParts} vs ${(ww.factors.skill - 1) * 100})`);
    assert(ww.parts.skill.some((x) => x.src === 'legendary:faultcleaver' && x.value === 40), 'the power template is named');
    const plough = sheet.skills.find((x) => x.id === 'ironplough')!;
    assert(plough.parts.skill.some((x) => x.src === 'tier:1' && x.value === 25), 'a bought tier with damage is listed (Sharpened Share +25%)');
    assert.equal(ww.factors.own, 1.5, 'own bucket: the static ×1.5 (not channelling now)');
    const own = ww.conds.find((c) => c.bucket === 'own');
    assert(own && !own.holds && own.pct === 20, 'the conditional own term is listed and does not hold now');
    assert(ww.parts.generic.some((x) => x.src === 'buff:fx_bt_rage' && x.value === 15), 'buff damage listed');
    assert.equal(ww.vs.stunned, +p.ctx.stunMult.toFixed(4), 'stunned enemies: the folded factor');
    assert(ww.vs.parts.some((x) => x.src === 'legendary:faultcleaver'), 'with its source');
    assert(ww.tags.includes('channel') && ww.tags.includes('area'), 'final tags');
    assert.equal(powerSourceName('legendary:faultcleaver'), 'Faultcleaver');
    assert.equal(powerSourceName('set:set:cinder_oath:6'), 'Cinder Oath (6)');
    assert.equal(powerSourceName('node:ironplough:brace'), 'Ironplough: Brace');
    assert.equal(skillSheet(inst, p, 'meteor'), null, 'another class’s skill');
  } finally { inst.destroy(); }
});

test('sheet: reading it changes nothing (no element-stack bookkeeping, no RNG draw)', () => {
  const { inst, p } = world('mage', [{ kind: 'elementStacks', elements: ['fire', 'cold', 'lightning'], windowMs: 6000, perStack: 10 }], { slots: ['meteor', null, null, null] });
  try {
    const rngBefore = JSON.stringify(inst.rng), ele = JSON.stringify(p.lastEle);
    buildSheet(inst, p);
    assert.equal(JSON.stringify(p.lastEle), ele, 'element stacks only read');
    assert.equal(JSON.stringify(inst.rng), rngBefore, 'no random draw');
  } finally { inst.destroy(); }
});

test('sheet: every skill of every class — perHit is the combat code’s expectedDamage, factors multiply back', () => {
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    const { inst, p } = world(cls);
    try {
      for (const sk of skillsForClassIds(cls)) {
        const s = skillSheet(inst, p, sk)!;
        assert(s, `${cls} ${sk}`);
        assert.equal(s.perHit, Math.round(expectedDamage(inst, p, strikeOf(p, p.ctx.modsOf(sk)))), `${sk} perHit`);
        const f = s.factors, product = s.weaponAvg * f.coef * f.mainStat * f.skill * f.element * f.generic * f.own * f.hit * f.crit;
        assert(Math.abs(product - s.perHit) <= Math.max(1, s.perHit * 1e-3), `${sk}: ${product} vs ${s.perHit}`);
      }
    } finally { inst.destroy(); }
  }
});
