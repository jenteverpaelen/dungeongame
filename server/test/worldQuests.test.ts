import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { QUESTS } from '../../shared/src/data/quests';
import { WORLD_QUESTS } from '../../shared/src/data/worldQuests';
import { ZONES } from '../../shared/src/data/zones';
import { contactSpot, questCategory, questState, writeQuestState } from '../../shared/src/quests';
import { questRewardError } from '../../shared/src/questRewards';
import { validateAdventures, validateQuests } from '../../shared/src/questValidation';
import { sideXpFor } from '../../shared/src/storyBudget';
import { BOUNTY_BOARDS } from '../../shared/src/bounties';
import { xpToNext } from '../../shared/src/progression';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import type { Session } from '../src/net/session';
import { runCommand } from '../src/commands';
import { killMob } from '../src/sim/kills';
import { ensureDataDir } from '../src/persistence';

assert(process.env.DATA_DIR, 'fresh isolated DATA_DIR required'); ensureDataDir();

const world = WORLD_QUESTS.map((q) => q.id);
const total = (s: { level: number; xp: number }) => { let t = s.xp; for (let l = 1; l < s.level; l++) t += xpToNext(l); return t; };

test('every rebuilt field zone has one side story with XP, gold and the reward pick, and a bounty board instead of contracts', () => {
  assert.deepEqual(validateAdventures(), []); assert.deepEqual(validateQuests(), []);
  assert.equal(WORLD_QUESTS.length, 9);
  assert.equal(new Set(WORLD_QUESTS.map((q) => q.start.zone)).size, 9, 'one side story per rebuilt field zone');
  assert(!QUESTS.some((q) => q.repeat), 'repeatable contracts are gone (docs/rework/quests/DESIGN.md §5)');
  for (const q of WORLD_QUESTS) {
    assert.equal(questCategory(q), 'side', q.id);
    assert.equal(questRewardError(q), undefined, q.id);
    const r = q.reward as { gold?: number; item?: string; xp?: number; pick?: boolean };
    assert.equal(r.xp, sideXpFor(q.start.zone), q.id + ' pays the zone side share of story XP');
    assert(r.gold && r.gold > 0, q.id + ' pays gold'); assert.equal(r.item, 'magic_weapon'); assert.equal(r.pick, true);
    assert(BOUNTY_BOARDS[q.start.zone], q.id + ' zone has a bounty board');
  }
});

test('real command path finishes every side story with physical contacts, gathers, repairs and pays once', async () => {
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
  const qc = (q: (typeof WORLD_QUESTS)[number], action: string, target: string, extra: Record<string, unknown> = {}) => {
    const st = questState(save, q.id), step = st && q.steps[st.step];
    return cmd('quest', { action, quest: q.id, target, revision: q.revision, ...(step ? { step: step.id } : {}), ...extra });
  };
  const contact = (zone: string, target: string) => { go(zone); const c = contactSpot(inst().map.adventure, target, save)!; assert(c.present, target + ' present'); near(c); };
  const run = (q: (typeof WORLD_QUESTS)[number]) => {
    contact(q.start.zone, q.start.target);
    const accepted = qc(q, 'accept', q.start.target); assert(accepted.ok, q.id + ' accept ' + JSON.stringify(accepted));
    for (const step of q.steps) {
      go(step.zone);
      if (step.kind === 'interact') {
        for (const target of step.targets ?? [step.target]) {
          contact(step.zone, target);
          if (step.hold) { assert(qc(q, 'holdStart', target).ok, q.id + ' hold'); inst().t += step.hold; }
          const r = qc(q, 'inspect', target); assert(r.ok, q.id + ' ' + target + ' ' + JSON.stringify(r));
        }
      } else if (step.kind === 'talk') {
        contact(step.zone, step.target); const r = qc(q, 'objectiveTalk', step.target); assert(r.ok, q.id + ' talk ' + JSON.stringify(r));
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
    assert(questState(save, q.id)?.reward && questState(save, q.id)?.rewardAlt, q.id + ' both choices reserved');
    const gold = save.gold, xp = total(save), alt = questState(save, q.id)!.rewardAlt!;
    contact(q.finish.zone, q.finish.target);
    const claim = qc(q, 'claim', q.finish.target, { pick: 'alt' }); assert(claim.ok, q.id + ' claim ' + JSON.stringify(claim));
    const r = q.reward as { gold: number; xp: number };
    assert.equal(save.gold - gold, r.gold, q.id + ' gold paid exactly once'); assert.equal(total(save) - xp, r.xp, q.id + ' side XP paid exactly once');
    assert(save.inventory.some((i) => i?.id === alt.id), q.id + ' the picked armour piece is in the bag');
    assert(!qc(q, 'claim', q.finish.target).ok, q.id + ' no replay reward');
  };
  try {
    for (const q of WORLD_QUESTS) { save.level = ZONES[q.start.zone].levelBand[1]; save.xp = 0; save.inventory = save.inventory.map(() => null); s.changed(false); run(q); }
  } finally { await server.shutdown(); }
});

test('an ordered gather resets on a wrong flag and says where to start', async () => {
  const server = new World(); await server.init();
  const save = createCharacter('FlagOrder', 'mage', 98);
  for (const q of QUESTS) if (!q.repeat && q.id !== 'tallis_flags') writeQuestState(save, q.id, { revision: q.revision, step: q.steps.length, claimed: true });
  const q = WORLD_QUESTS.find((x) => x.id === 'tallis_flags')!;
  writeQuestState(save, q.id, { revision: q.revision, step: 1, claimed: false });
  const s = { save, derived: computeStats(save), sessionId: save.id, rec: null, entityId: 0, homeTown: null, hold: null,
    send() {}, sendRaw() {}, markDirty() {}, saveNow() {}, autosave() {}, kick() {}, shutdown() {}, changed() { s.derived = computeStats(save); },
  } as unknown as Session;
  server.login(s, (you, zone) => ({ t: 'welcome', you, char: save, derived: s.derived, zone, time: Date.now(), world: server.infoFor(s) }));
  const inst = () => s.rec!.inst as Instance, p = () => inst().playerById(s.entityId)!;
  const at = (x: number, y: number) => { Object.assign(p(), { x, y, hp: p().mhp, deadMs: 0 }); Object.assign(p().mv, { x, y }); };
  const touch = (target: string) => { const c = contactSpot(inst().map.adventure, target, save)!;
    const pt = Array.from({ length: 16 }, (_, i) => ({ x: c.x + 70 * Math.cos(i * Math.PI / 8), y: c.y + 70 * Math.sin(i * Math.PI / 8) })).find((v) => inst().cw.isFree(v.x, v.y, 18) && !inst().cw.segmentBlocked(v.x, v.y, c.x, c.y))!;
    at(pt.x, pt.y); return runCommand(s, server, 'quest', { action: 'inspect', quest: q.id, target, revision: q.revision, step: 'flags' }); };
  try {
    at(...inst().map.town!.npcs.find((n) => n.role === 'waypoint')!.approach); assert(runCommand(s, server, 'travel', { zone: 'shiverline_escarpment' }).ok);
    assert(touch('flag_red').ok); assert.equal(questState(save, q.id)!.parts, 1);
    const wrong = touch('flag_yellow'); assert(!wrong.ok); assert.match(wrong.err ?? '', /Red signal flag/); assert.equal(questState(save, q.id)!.parts, 0, 'a wrong flag resets the order');
    for (const f of ['flag_red', 'flag_blue', 'flag_yellow']) assert(touch(f).ok, f);
    assert.equal(questState(save, q.id)!.step, 2); assert.equal(questState(save, q.id)!.parts, undefined);
  } finally { await server.shutdown(); }
});
