// Depth foundation, server side: specialization commands (persisted custody), save migration v14 → v15 and the
// runtime path (nodes reach the authoritative simulation exactly like runes and tiers). Fixture nodes only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { isPersistedCommand } from '../../shared/src/commandState';
import { SAVE_VERSION } from '../../shared/src/saveVersion';
import { specPointsAvailable } from '../../shared/src/specialization';
import type { CharacterSave } from '../../shared/src/types';
import { runCommand } from '../src/commands';
import { ensureDataDir, flushSaves, loadCharacter, normalizeSave, saveCharacter } from '../src/persistence';
import { buildCtx, skillCost, skillPct } from '../src/sim/playerctx';
import type { Player } from '../src/sim/types';
import type { Session } from '../src/net/session';
import type { World } from '../src/world';
import { installFixtureNodes } from '../../shared/test/fixtures/depthContent';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required'); ensureDataDir();
const fixture = async (name: string): Promise<CharacterSave> => JSON.parse(await fs.readFile(new URL(`./fixtures/saves/${name}.json`, import.meta.url), 'utf8'));

function session(save: CharacterSave) {
  const calls: boolean[] = [];
  const s = { save, changed(refresh: boolean) { calls.push(refresh); } } as unknown as Session;
  return { s, calls, cmd: (op: 'skillNode' | 'skillReset', a: Record<string, unknown>) => runCommand(s, {} as World, op, a) };
}

test('skillNode and skillReset are persisted commands; forged or illegal requests change nothing', () => {
  assert(isPersistedCommand('skillNode')); assert(isPersistedCommand('skillReset'));
  const undo = installFixtureNodes();
  try {
    const save = createCharacter('NodeCommand', 'warrior', 4); save.level = 31; // 11 specialization points (one per level from 21)
    const { cmd, calls } = session(save);
    for (const a of [{ skill: 'whirlwind', node: 'fx_reach', delta: 1 }, { skill: 'meteor', node: 'fx_mass', delta: 1 }, { skill: 'whirlwind', node: 'fx_gale', delta: 0 },
      { skill: 'whirlwind', node: 'fx_gale', delta: 2 }, { skill: 'whirlwind', node: 'fx_gale', delta: -1 }, { skill: 'whirlwind', node: 'fx_gale' }, { skill: 'whirlwind', delta: 1 },
      { skill: 'whirlwind', node: 'x'.repeat(65), delta: 1 }]) {
      const before = structuredClone(save);
      assert.equal(cmd('skillNode', a).ok, false, JSON.stringify(a));
      assert.deepEqual(save, before);
    }
    assert.equal(calls.length, 0);
    const r = cmd('skillNode', { skill: 'whirlwind', node: 'fx_gale', delta: 1 });
    assert(r.ok); assert.deepEqual(r.data, { skill: 'whirlwind', node: 'fx_gale', rank: 1 }); assert.deepEqual(calls, [true]);
    assert(cmd('skillNode', { skill: 'whirlwind', node: 'fx_gale', delta: -1 }).ok);
    assert.deepEqual(save.skills.nodes, {});
    const custody = [save.gold, save.skillPoints, save.inventory, save.equipment, save.materials];
    for (let i = 0; i < 3; i++) assert(cmd('skillNode', { skill: 'whirlwind', node: 'fx_gale', delta: 1 }).ok);
    assert.equal(specPointsAvailable(save), 11 - 3);
    assert.deepEqual([save.gold, save.skillPoints, save.inventory, save.equipment, save.materials], custody, 'nodes spend no gold, items or skill points');
    assert.equal(cmd('skillReset', { skill: 'meteor' }).ok, false, 'other-class skill');
    assert.equal(cmd('skillReset', { skill: 'rend' }).ok, false, 'nothing to refund on that skill');
    const reset = cmd('skillReset', { skill: 'whirlwind' });
    assert(reset.ok); assert.deepEqual(reset.data, { tierPoints: 0, nodePoints: 3 }); assert.deepEqual(save.skills.nodes, {});
    assert.equal(cmd('skillReset', {}).ok, false, 'nothing left to refund');
  } finally { undo(); }
});

test('v14 saves migrate to v15 with empty specialization; v15 ranks survive save/reload when legal, reset when not', async () => {
  const v14 = normalizeSave(await fixture('v14-collection'));
  assert.equal(v14.version, SAVE_VERSION); assert.deepEqual(v14.skills.nodes, {});
  const undo = installFixtureNodes();
  try {
    // The golden save is level 22; its three ranks are legal from level 23 under the shipped economy (points from 21).
    const v15 = normalizeSave({ ...(await fixture('v15-nodes')), level: 23 });
    assert.deepEqual(v15.skills.nodes, { meteor: { fx_mass: 2, fx_focus: 1 } });
    await saveCharacter(v15); await flushSaves();
    const loaded = await loadCharacter(v15.id);
    assert.deepEqual(loaded!.skills.nodes, v15.skills.nodes);
    assert.deepEqual(computeStats(loaded!), computeStats(v15));
  } finally { undo(); }
  // Without the (fixture) tree the allocation is illegal: it is cleared; points are derived, so nothing is lost.
  const cleared = normalizeSave(await fixture('v15-nodes'));
  assert.deepEqual(cleared.skills.nodes, {});
  assert.equal(cleared.skillPoints, (await fixture('v15-nodes')).skillPoints);
});

test('bought ranks reach the authoritative skill runtime (damage bucket, cost, flags, vars)', () => {
  const undo = installFixtureNodes();
  try {
    const save = createCharacter('NodeRuntime', 'warrior', 4); save.level = 40; save.equipment = {};
    save.skills.slots = ['whirlwind', null, null, null];
    const p = (ctx: ReturnType<typeof buildCtx>) => ({ ctx }) as Player;
    const before = buildCtx(save).modsOf('whirlwind');
    const { cmd } = session(save);
    for (const n of ['fx_gale', 'fx_gale', 'fx_gale', 'fx_reach', 'fx_reach', 'fx_devils', 'fx_thrift', 'fx_edge']) assert(cmd('skillNode', { skill: 'whirlwind', node: n, delta: 1 }).ok, n);
    const ctx = buildCtx(save), after = ctx.modsOf('whirlwind');
    assert.equal(skillPct(p(ctx), after) - skillPct(p(buildCtx({ ...save, skills: { ...save.skills, nodes: {} } })), before), 30);
    assert(skillCost(p(ctx), after) < skillCost(p(ctx), before));
    assert(after.flags.has('dustDevils'), 'behaviour flag from a node');
    assert.equal(after.mods.vars?.fxEdge, 1);
  } finally { undo(); }
});
