import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { computeStats } from '../../shared/src/stats';
import { QUESTS } from '../../shared/src/data/quests';
import { MONSTERS } from '../../shared/src/data/monsters';
import { ZONE_WIDE, type QuestDef } from '../../shared/src/questTypes';
import { questPoint, questState } from '../../shared/src/quests';
import { validateQuests } from '../../shared/src/questValidation';
import { generateMap } from '../../shared/src/mapgen';
import { World } from '../src/world';
import { Instance } from '../src/sim/instance';
import { createMob } from '../src/sim/monsters';
import type { Session } from '../src/net/session';
import { runCommand } from '../src/commands';
import { killMob } from '../src/sim/kills';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');
const catalogue = QUESTS as QuestDef[];

async function fixture() {
  const world = new World(); await world.init();
  const save = createCharacter('ZoneWide1', 'warrior', 1);
  const s = {
    save, derived: computeStats(save), sessionId: save.id, rec: null, entityId: 0, homeTown: null, hold: null, pendingEnchant: null,
    send() {}, sendRaw() {}, markDirty() {}, saveNow() {}, autosave() {}, kick() {}, shutdown() {}, changed() { s.derived = computeStats(save); },
  } as unknown as Session;
  world.login(s, (you, zone) => ({ t: 'welcome', you, char: save, derived: s.derived, zone, time: Date.now(), world: world.infoFor(s) }));
  const inst = () => s.rec!.inst as Instance, player = () => inst().playerById(s.entityId)!;
  const at = (x: number, y: number) => { const p = player(); p.x = p.mv.x = x; p.y = p.mv.y = y; p.hp = p.mhp; p.deadMs = 0; };
  const near = (id: string) => {
    const a = inst().map.adventure?.interactions.find(n => n.id === id), n = inst().map.town?.npcs.find(n => n.id === id);
    if (n) at(...n.approach); else if (a) at(a.x, a.y + 65); else throw Error('Unknown contact');
  };
  const cmd = (op: Parameters<typeof runCommand>[2], args: Record<string, unknown> = {}) => runCommand(s, world, op, args);
  const quest = (q: QuestDef, action: string) => cmd('quest', { quest: q.id, action, target: q.start.target, cycle: questState(save, q.id)?.cycle ?? 0 });
  const toField = () => {
    const wp = inst().map.town!.npcs.find(n => n.role === 'waypoint')!; near(wp.id);
    assert(cmd('travel', { zone: 'rillwake_crossing' }).ok); near('tender');
  };
  return { world, save, inst, player, at, near, quest, toField };
}

function hunt(id: string, step: Partial<QuestDef['steps'][number]>): QuestDef {
  return {
    ...structuredClone(QUESTS.find(q => q.id === 'high_water')!), id, requires: [], unlocks: undefined, chapter: undefined, repeat: 'on_return',
    reward: { gold: 40 }, steps: [{ id: 'hunt', kind: 'kill', zone: 'rillwake_crossing', target: ZONE_WIDE, count: 3, text: 'quest.wheel.warden', ...step }],
  };
}

test('a zone-wide step validates, points at a hunting ground, and rejects filters that match nothing in the zone', () => {
  const sweep = hunt('zw_valid', {});
  assert.deepEqual(validateQuests([sweep]), []);
  assert.deepEqual(validateQuests([hunt('zw_family', { monsterFamily: 'slime' })]), []);
  assert(validateQuests([hunt('zw_none', { monsterFamily: 'goat' })]).some(e => e.includes('unknown kill target')), 'no goat in Rillwake');
  assert(validateQuests([hunt('zw_type', { monsterType: 'rimehorn' })]).some(e => e.includes('unknown kill target')));
  const map = generateMap('rillwake_crossing', 1);
  const p = questPoint(map, { zone: 'rillwake_crossing', target: ZONE_WIDE });
  assert(p && map.adventure!.encounters.some(e => e.x === p.x && e.y === p.y), 'guidance uses an authored encounter');
});

test('a zone-wide sweep counts authored creatures from any site, never story targets or random spawns', async () => {
  const f = await fixture(), q = hunt('zw_sweep', {});
  catalogue.push(q);
  try {
    f.toField(); assert(f.quest(q, 'accept').ok);
    const authored = f.inst().mobs.filter(m => m.adventureSite && !m.adventureTarget && !m.dead);
    const sites = new Set(authored.map(m => m.adventureSite));
    assert(sites.size >= 2, 'fixture needs at least two sites');
    const kill = (m: (typeof authored)[number]) => { f.at(m.x, m.y + 80); killMob(f.inst(), m, f.player(), 'physical', 'zone-wide'); };

    kill(authored.find(m => m.adventureSite === 'road')!);
    kill(authored.find(m => m.adventureSite === 'yard')!);
    assert.equal(questState(f.save, q.id)!.progress, 2, 'two different sites both counted');

    // A story target (the mill keeper) is reserved for story steps.
    const boss = f.inst().mobs.find(m => m.adventureTarget === 'mill' && !m.dead)!;
    kill(boss);
    assert.equal(questState(f.save, q.id)!.progress, 2, 'story target does not count');

    // A mob that was never part of an authored site (random spawn) does not count either.
    const stray = createMob(f.inst(), MONSTERS.bog_slime, 1, f.player().x + 50, f.player().y, { players: 1 });
    killMob(f.inst(), stray, f.player(), 'physical', 'stray');
    assert.equal(questState(f.save, q.id)!.progress, 2, 'non-authored spawn does not count');

    kill(authored.find(m => m.adventureSite === 'ridge' && !m.dead) ?? authored.find(m => !m.dead && m.adventureSite !== 'mill')!);
    assert.equal(questState(f.save, q.id)!.step, 1, 'third authored kill completes the objective');
    f.near('tender'); const gold = f.save.gold; assert(f.quest(q, 'claim').ok); assert.equal(f.save.gold, gold + 40);
  } finally { catalogue.splice(catalogue.indexOf(q), 1); await f.world.shutdown(); }
});

test('a zone-wide family hunt counts only that family, across sites', async () => {
  const f = await fixture(), q = hunt('zw_family_hunt', { monsterFamily: 'slime', count: 2 });
  catalogue.push(q);
  try {
    f.toField(); assert(f.quest(q, 'accept').ok);
    const mobs = f.inst().mobs.filter(m => m.adventureSite && !m.adventureTarget && !m.dead);
    const slimes = mobs.filter(m => m.def.family === 'slime'), other = mobs.find(m => m.def.family !== 'slime')!;
    const kill = (m: (typeof mobs)[number]) => { f.at(m.x, m.y + 80); killMob(f.inst(), m, f.player(), 'physical', 'family'); };
    kill(other);
    assert.equal(questState(f.save, q.id)!.progress ?? 0, 0, 'a different family does not count');
    const a = slimes.find(m => m.adventureSite === 'road')!, b = slimes.find(m => m.adventureSite === 'yard')!;
    kill(a); kill(b);
    assert.equal(questState(f.save, q.id)!.step, 1);
  } finally { catalogue.splice(catalogue.indexOf(q), 1); await f.world.shutdown(); }
});
