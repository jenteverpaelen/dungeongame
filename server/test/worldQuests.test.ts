import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { QUESTS } from '../../shared/src/data/quests';
import { WORLD_QUESTS } from '../../shared/src/data/worldQuests';
import { ZONES } from '../../shared/src/data/zones';
import { questState, writeQuestState } from '../../shared/src/quests';
import { questRewardError } from '../../shared/src/questRewards';
import { validateAdventures, validateQuests } from '../../shared/src/questValidation';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import type { Session } from '../src/net/session';
import { runCommand } from '../src/commands';
import { killMob } from '../src/sim/kills';
import { ensureDataDir } from '../src/persistence';

assert(process.env.DATA_DIR, 'fresh isolated DATA_DIR required'); ensureDataDir();

const world = WORLD_QUESTS.map((q) => q.id), sides = WORLD_QUESTS.filter((q) => !q.repeat), contracts = WORLD_QUESTS.filter((q) => q.repeat);

test('the rebuilt zones carry a side quest and a repeatable event contract each, with bounded rewards and no XP', () => {
  assert.deepEqual(validateAdventures(), []); assert.deepEqual(validateQuests(), []);
  assert.equal(sides.length, 9); assert.equal(contracts.length, 9);
  assert.equal(new Set(sides.map((q) => q.start.zone)).size, 9, 'one side quest per rebuilt field zone');
  for (const q of WORLD_QUESTS) {
    assert(QUESTS.some((x) => x.id === q.id), q.id + ' registered');
    assert.equal(questRewardError(q), undefined, q.id);
    const r = q.reward as { gold?: number; item?: string; xp?: number };
    assert(!r.xp, q.id + ' pays no XP (docs/rework/worlds/DECISIONS.md D-W03)');
    assert(r.gold && r.gold > 0, q.id + ' pays gold');
    assert.equal(r.item, q.repeat || q.id === 'lost_survey' ? undefined : 'magic_weapon', q.id + ' item roll only on one-time side quests');
  }
});

test('real command path finishes every world quest with physical contacts, pays once, and contracts can be taken again', async () => {
  const server = new World(); await server.init();
  const save = createCharacter('WorldRoute', 'warrior', 97);
  for (const q of QUESTS) if (!q.repeat && !world.includes(q.id)) writeQuestState(save, q.id, { revision: q.revision, step: q.steps.length, claimed: true });
  const s = { save, derived: computeStats(save), sessionId: save.id, rec: null, entityId: 0, homeTown: null, hold: null,
    send() {}, sendRaw() {}, markDirty() {}, saveNow() {}, autosave() {}, kick() {}, shutdown() {}, changed() { s.derived = computeStats(save); },
  } as unknown as Session;
  server.login(s, (you, zone) => ({ t: 'welcome', you, char: save, derived: s.derived, zone, time: Date.now(), world: server.infoFor(s) }));
  const inst = () => s.rec!.inst as Instance, p = () => inst().playerById(s.entityId)!;
  const at = (x: number, y: number) => { Object.assign(p(), { x, y, hp: p().mhp, deadMs: 0, invulnMs: 1e9 }); Object.assign(p().mv, { x, y }); };
  const near = (spot: { x: number; y: number }) => {
    const point = Array.from({ length: 16 }, (_, i) => ({ x: spot.x + 70 * Math.cos(i * Math.PI / 8), y: spot.y + 70 * Math.sin(i * Math.PI / 8) }))
      .find((pt) => inst().cw.isFree(pt.x, pt.y, 18) && !inst().cw.segmentBlocked(pt.x, pt.y, spot.x, spot.y));
    assert(point, 'free physical approach'); at(point.x, point.y);
  };
  const cmd = (op: Parameters<typeof runCommand>[2], args: Record<string, unknown>) => runCommand(s, server, op, args);
  const go = (zone: string) => {
    if (inst().map.zone === zone) return;
    if (inst().map.zone !== 'hearthmere') assert(cmd('travel', { zone: 'hearthmere' }).ok);
    at(...inst().map.town!.npcs.find((n) => n.role === 'waypoint')!.approach);
    const r = cmd('travel', { zone }); assert(r.ok, zone + ' ' + JSON.stringify(r));
  };
  // Repeatable quests carry the journal's cycle on every command (server/src/quests.ts questCommand).
  const qc = (q: (typeof WORLD_QUESTS)[number], action: string, target: string) => {
    const st = questState(save, q.id);
    return cmd('quest', { action, quest: q.id, target, ...(q.repeat ? { cycle: (st?.cycle ?? 0) + (action === 'accept' && st?.claimed ? 1 : 0) } : {}) });
  };
  const contact = (zone: string, target: string) => { go(zone); near(inst().map.adventure!.interactions.find((i) => i.id === target)!); };
  const run = (q: (typeof WORLD_QUESTS)[number]) => {
    contact(q.start.zone, q.start.target);
    const accepted = qc(q, 'accept', q.start.target); assert(accepted.ok, q.id + ' accept ' + JSON.stringify(accepted));
    for (const step of q.steps) {
      go(step.zone);
      if (step.kind === 'interact') {
        contact(step.zone, step.target); const r = qc(q, 'inspect', step.target); assert(r.ok, q.id + ' ' + JSON.stringify(r));
      } else if (step.kind === 'kill') {
        const mob = inst().mobs.find((m) => !m.dead && m.adventureTarget === step.target)!; assert(mob, q.id + ' named target ' + step.target);
        near(mob); killMob(inst(), mob, p(), 'physical', 'world-quest-fixture');
      } else {
        assert.equal(step.kind, 'wave', q.id + ' step kind');
        const a = inst().map.adventure!, event = a.events!.find((e) => e.id === step.target)!, slot = a.encounters.findIndex((e) => e.id === event.encounter);
        contact(step.zone, event.trigger); const r = cmd('quest', { action: 'activateField', target: event.trigger }); assert(r.ok, q.id + ' ' + JSON.stringify(r));
        const pack = inst().mobs.filter((m) => !m.dead && m.pack?.slot === slot); assert(pack.length > 0, q.id + ' event spawned');
        for (const mob of pack) { near(mob); killMob(inst(), mob, p(), 'physical', 'world-quest-fixture'); }
      }
      if (q.steps.indexOf(step) < q.steps.length - 1) assert.equal(questState(save, q.id)?.step, q.steps.indexOf(step) + 1, q.id + ' advanced past ' + step.id);
    }
    assert.equal(questState(save, q.id)?.step, q.steps.length, q.id + ' objectives');
    const gold = save.gold, xp = save.xp, level = save.level;
    contact(q.finish.zone, q.finish.target);
    const claim = qc(q, 'claim', q.finish.target); assert(claim.ok, q.id + ' claim ' + JSON.stringify(claim));
    assert.equal(save.gold - gold, (q.reward as { gold: number }).gold, q.id + ' gold paid exactly once');
    assert.equal(save.xp, xp, q.id + ' no XP'); assert.equal(save.level, level, q.id + ' no level');
    assert(!qc(q, 'claim', q.finish.target).ok, q.id + ' no replay reward');
  };
  try {
    for (const q of sides) { save.level = ZONES[q.start.zone].levelBand[1]; s.changed(false); run(q); }
    for (const q of contracts) {
      save.level = ZONES[q.start.zone].levelBand[1]; s.changed(false);
      // The side quest may have cleared the same event: let the existing recovery rule run (respawnSec, nobody nearby).
      go(q.start.zone); const i = inst(); i.t += i.def.respawnSec * 1000 + 2000; i.spawner.tick(50);
      run(q);
      contact(q.start.zone, q.start.target);
      assert(qc(q, 'accept', q.start.target).ok, q.id + ' can be taken again in person');
      assert(!qc(q, 'claim', q.finish.target).ok, q.id + ' a new run must be earned');
    }
  } finally { await server.shutdown(); }
});
