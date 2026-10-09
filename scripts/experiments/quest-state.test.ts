/** Synthetic C065 state/transaction tests. Never start a game server or read player saves. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { backup } from 'node:sqlite';
import { before, test } from 'node:test';
import { QuestStateProbe, type ActorState, type ProbeCommand, type QualifiedEvent, type CutPoint } from './quest-state';
import type { Quest, Objective } from './quest-authoring';

const root = process.env.DATA_DIR!;
const marker = 'Synthetic quest-state experiment only.\n';
const filename = fileURLToPath(import.meta.url);
const owned = new Set<ReturnType<typeof spawn>>();
let counter = 0;
function actor(id = 'actor-a', capacity = 3, itemTypes: string[] = []): ActorState {
  const inventory = itemTypes.map((type, i) => ({ id: `${id}-seed-${i}`, type }));
  return { id, capacity, inventory, acquiredIds: inventory.map(i => i.id), xp: 0, gold: 0, unlocks: [], runs: [] };
}
function quest(id: string, objectives: Objective[]): Quest {
  return { id, title: 'synthetic.title', requires: [], objectives,
    reward: { xp: 7, gold: 11, items: [{ item: 'fixture-reward', count: 1 }], unlocks: ['fixture-unlock'] } };
}
const killQuest = quest('kill-quest', [{ id: 'kill', text: 'synthetic.kill', kind: 'kill', zone: 'field', monster: 'fixture-monster', count: 1 }]);
const deliveryQuest = quest('delivery-quest', [{ id: 'deliver', text: 'synthetic.deliver', kind: 'deliver', npc: 'fixture-npc', item: 'cargo', count: 1 }]);
const allQuest = quest('all-quest', [
  { id: 'kill', text: 'synthetic.kill', kind: 'kill', zone: 'field', monster: 'fixture-monster', count: 2 },
  { id: 'collect', text: 'synthetic.collect', kind: 'collect', item: 'cargo', count: 1 },
  { id: 'reach', text: 'synthetic.reach', kind: 'reach', location: 'fixture-place' },
  { id: 'talk', text: 'synthetic.talk', kind: 'talk', npc: 'fixture-npc', dialogue: 'fixture-dialogue' },
  { id: 'service', text: 'synthetic.service', kind: 'service', npc: 'fixture-npc', operation: 'fixture-service' },
  { id: 'rift', text: 'synthetic.rift', kind: 'rift', minDifficulty: 2 },
  { id: 'deliver', text: 'synthetic.deliver', kind: 'deliver', npc: 'fixture-npc', item: 'cargo', count: 1 },
  { id: 'wave', text: 'synthetic.wave', kind: 'wave', encounter: 'fixture-wave', count: 2 },
]);
const events: QualifiedEvent[] = [
  { actor: 'actor-a', quest: 'all-quest', objective: 'kill', kind: 'kill', zone: 'field', monster: 'fixture-monster' },
  { actor: 'actor-a', quest: 'all-quest', objective: 'collect', kind: 'collect', item: { id: 'acquired-cargo', type: 'cargo' } },
  { actor: 'actor-a', quest: 'all-quest', objective: 'reach', kind: 'reach', location: 'fixture-place' },
  { actor: 'actor-a', quest: 'all-quest', objective: 'talk', kind: 'talk', npc: 'fixture-npc', dialogue: 'fixture-dialogue' },
  { actor: 'actor-a', quest: 'all-quest', objective: 'service', kind: 'service', npc: 'fixture-npc', operation: 'fixture-service' },
  { actor: 'actor-a', quest: 'all-quest', objective: 'rift', kind: 'rift', difficulty: 2 },
  { actor: 'actor-a', quest: 'all-quest', objective: 'deliver', kind: 'deliver', npc: 'fixture-npc', item: 'cargo' },
  { actor: 'actor-a', quest: 'all-quest', objective: 'wave', kind: 'wave', encounter: 'fixture-wave' },
];
const accept = (definition: Quest): ProbeCommand => ({ kind: 'accept', definition, revision: 'fixture-v1' });
const credit = (event: QualifiedEvent): ProbeCommand => ({ kind: 'credit', event });
const killEvent: QualifiedEvent = { ...events[0], quest: 'kill-quest' };
const deliveryEvent: QualifiedEvent = { ...events[6], quest: 'delivery-quest' };
async function fresh(initial = actor()) {
  const directory = path.join(root, `case-${++counter}`); await fs.mkdir(directory);
  const dbPath = path.join(directory, 'probe.db');
  const store = new QuestStateProbe(dbPath); store.seed(initial);
  return { store, dbPath, directory };
}
async function ready(store: QuestStateProbe) {
  assert.deepEqual(await store.execute('actor-a', 'accept', accept(killQuest)), { ok: true, state: 'accepted' });
  assert.deepEqual(await store.execute('actor-a', 'kill', credit(killEvent)), { ok: true, state: 'credited' });
}
function state(store: QuestStateProbe) { return store.actor('actor-a'); }

if (process.env.HF_QUEST_STATE_CHILD === 'yes') {
  assert.ok(root && path.basename(root).startsWith('hf-quest-state-'));
  assert.equal(await fs.readFile(path.join(root, 'synthetic-only.txt'), 'utf8'), marker);
  const dbPath = process.env.HF_QUEST_STATE_DB!;
  const relative = path.relative(root, dbPath);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  const store = new QuestStateProbe(dbPath);
  const command = JSON.parse(process.env.HF_QUEST_STATE_COMMAND!) as ProbeCommand;
  await store.execute('actor-a', 'crash-operation', command, async point => {
    if (point !== process.env.HF_QUEST_STATE_CUT) return;
    process.send!({ checkpoint: point });
    await new Promise<void>(() => {}); // Parent terminates this owned child at the declared boundary.
  });
  throw Error('Expected a selected crash boundary');
} else {
  before(async () => {
    assert.ok(root && path.basename(root).startsWith('hf-quest-state-'), 'Fresh isolated DATA_DIR required');
    const realRoot = await fs.realpath(root), realTemp = await fs.realpath(os.tmpdir());
    const relative = path.relative(realTemp, realRoot);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'DATA_DIR must be inside temporary storage');
    assert.equal(process.env.BACKUP_DIR ?? '', '');
    assert.equal(process.env.BACKUP_KEEP ?? '0', '0');
    await fs.writeFile(path.join(root, 'synthetic-only.txt'), marker, { flag: 'wx' });
  });

  test('all eight kinds retain progress across reopen; delivery consumes ownership but not collection history', async () => {
    const f = await fresh(); let store = f.store;
    try {
      await store.execute('actor-a', 'accept-all', accept(allQuest));
      for (const [i, event] of events.entries()) {
        assert.deepEqual(await store.execute('actor-a', `event-${i}`, credit(event)), { ok: true, state: 'credited' });
        store.close(); store = new QuestStateProbe(f.dbPath);
        assert.equal(state(store).runs[0].progress[i].count, 1);
      }
      assert.equal(state(store).runs[0].status, 'active');
      await store.execute('actor-a', 'kill-again', credit(events[0]));
      await store.execute('actor-a', 'wave-again', credit(events[7]));
      assert.equal(state(store).runs[0].status, 'ready');
      assert.deepEqual(state(store).inventory, []);
      assert.deepEqual(state(store).acquiredIds, ['acquired-cargo']);
      assert.equal(state(store).runs[0].progress.find(p => p.id === 'collect')!.count, 1);
      const snapshot = store.snapshot();
      assert.deepEqual(await store.execute('actor-a', 'event-6', credit(events[6])), { ok: true, state: 'credited' });
      assert.deepEqual(store.snapshot(), snapshot);
      assert.deepEqual(await store.execute('actor-a', 'claim', { kind: 'claim', quest: 'all-quest' }), { ok: true, state: 'claimed' });
      assert.equal(state(store).xp, 7); assert.equal(state(store).gold, 11);
      assert.equal(state(store).inventory.length, 1); assert.deepEqual(state(store).unlocks, ['fixture-unlock']);
      const final = store.snapshot();
      await store.execute('actor-a', 'claim', { kind: 'claim', quest: 'all-quest' });
      assert.deepEqual(store.snapshot(), final);
      assert.deepEqual(await store.execute('actor-a', 'new-claim-id', { kind: 'claim', quest: 'all-quest' }), { ok: true, state: 'already-claimed' });
      assert.equal(state(store).xp, 7); assert.equal(state(store).inventory.length, 1);
    } finally { store.close(); }
  });

  test('wrong fields for all eight kinds and wrong kind earn no credit', async () => {
    const { store } = await fresh();
    try {
      await store.execute('actor-a', 'accept', accept(allQuest));
      const wrong: QualifiedEvent[] = [
        { ...events[0], kind: 'kill', zone: 'other', monster: 'fixture-monster' },
        { ...events[1], kind: 'collect', item: { id: 'wrong', type: 'other' } },
        { ...events[2], kind: 'reach', location: 'other' },
        { ...events[3], kind: 'talk', npc: 'fixture-npc', dialogue: 'other' },
        { ...events[4], kind: 'service', npc: 'other', operation: 'fixture-service' },
        { ...events[5], kind: 'rift', difficulty: 1 },
        { ...events[6], kind: 'deliver', npc: 'other', item: 'cargo' },
        { ...events[7], kind: 'wave', encounter: 'other' },
        { ...events[2], objective: 'kill' },
      ];
      for (const [i, event] of wrong.entries()) assert.deepEqual(await store.execute('actor-a', `wrong-${i}`, credit(event)), { ok: true, state: 'ignored' });
      assert.ok(state(store).runs[0].progress.every(p => p.count === 0));
      assert.deepEqual(state(store).inventory, []);
      assert.deepEqual(await store.execute('actor-a', 'early-claim', { kind: 'claim', quest: 'all-quest' }), { ok: false, reason: 'not ready' });
    } finally { store.close(); }
  });

  test('pre-accept credit stays ignored on retry; receipts reject changed intent and are actor-scoped', async () => {
    const { store } = await fresh();
    try {
      store.seed(actor('actor-b'));
      assert.deepEqual(await store.execute('actor-a', 'early', credit(killEvent)), { ok: true, state: 'ignored' });
      await store.execute('actor-a', 'accept', accept(killQuest));
      assert.deepEqual(await store.execute('actor-a', 'early', credit(killEvent)), { ok: true, state: 'ignored' });
      assert.equal(state(store).runs[0].progress[0].count, 0);
      const snapshot = store.snapshot();
      assert.deepEqual(await store.execute('actor-a', 'early', { kind: 'claim', quest: 'kill-quest' }), { ok: false, reason: 'changed intent' });
      assert.deepEqual(await store.execute('actor-b', 'early', credit(killEvent)), { ok: false, reason: 'wrong actor' });
      assert.deepEqual(store.snapshot(), snapshot);
      await store.execute('actor-b', 'accept', accept(killQuest));
      await store.execute('actor-b', 'early', credit({ ...killEvent, actor: 'actor-b' }));
      assert.equal(store.actor('actor-b').runs[0].status, 'ready');
      assert.equal(state(store).runs[0].status, 'active');
    } finally { store.close(); }
  });

  test('full-bag acquisition and missing delivery leave no partial progress; same acquisition retries after delivery', async () => {
    const { store } = await fresh(actor('actor-a', 1));
    const collection = quest('collect-quest', [{ id: 'collect', text: 'synthetic.collect', kind: 'collect', item: 'cargo', count: 2 }]);
    const item1 = { ...events[1], quest: collection.id } as QualifiedEvent;
    const item2: QualifiedEvent = { actor: 'actor-a', quest: collection.id, objective: 'collect', kind: 'collect', item: { id: 'second-cargo', type: 'cargo' } };
    try {
      await store.execute('actor-a', 'accept-collect', accept(collection));
      await store.execute('actor-a', 'accept-deliver', accept(deliveryQuest));
      const initial = store.snapshot();
      assert.deepEqual(await store.execute('actor-a', 'delivery', credit(deliveryEvent)), { ok: false, reason: 'missing delivery items' });
      assert.deepEqual(store.snapshot(), initial);
      await store.execute('actor-a', 'item1', credit(item1));
      const first = store.snapshot();
      assert.deepEqual(await store.execute('actor-a', 'same-item-new-event', credit(item1)), { ok: false, reason: 'already acquired' });
      assert.deepEqual(await store.execute('actor-a', 'item2', credit(item2)), { ok: false, reason: 'inventory full' });
      assert.deepEqual(store.snapshot(), first);
      await store.execute('actor-a', 'delivery', credit(deliveryEvent));
      assert.deepEqual(await store.execute('actor-a', 'item2', credit(item2)), { ok: true, state: 'credited' });
      assert.equal(state(store).runs[0].status, 'ready');
      assert.deepEqual(state(store).inventory.map(i => i.id), ['second-cargo']);
      assert.deepEqual(state(store).acquiredIds, ['acquired-cargo', 'second-cargo']);
    } finally { store.close(); }
  });

  test('reward capacity failure is atomic and retries after another quest frees space', async () => {
    const { store } = await fresh(actor('actor-a', 1, ['cargo']));
    try {
      await ready(store); const before = store.snapshot();
      const claim: ProbeCommand = { kind: 'claim', quest: 'kill-quest' };
      assert.deepEqual(await store.execute('actor-a', 'claim', claim), { ok: false, reason: 'inventory full' });
      assert.deepEqual(store.snapshot(), before);
      await store.execute('actor-a', 'accept-delivery', accept(deliveryQuest));
      await store.execute('actor-a', 'delivery', credit(deliveryEvent));
      assert.deepEqual(await store.execute('actor-a', 'claim', claim), { ok: true, state: 'claimed' });
      assert.equal(state(store).gold, 11); assert.equal(state(store).inventory.length, 1);
    } finally { store.close(); }
  });

  test('accepted definition is pinned; prerequisite requires claim; integer overflow refuses all reward effects', async () => {
    const { store } = await fresh({ ...actor(), xp: Number.MAX_SAFE_INTEGER });
    try {
      await ready(store); const before = store.snapshot();
      const altered = structuredClone(killQuest); altered.reward.gold++;
      assert.deepEqual(await store.execute('actor-a', 'changed-definition', accept(altered)), { ok: false, reason: 'definition changed' });
      const next = { ...deliveryQuest, requires: ['kill-quest'] };
      assert.deepEqual(await store.execute('actor-a', 'next', accept(next)), { ok: false, reason: 'prerequisite' });
      assert.deepEqual(await store.execute('actor-a', 'claim', { kind: 'claim', quest: 'kill-quest' }), { ok: false, reason: 'invalid integer' });
      assert.deepEqual(store.snapshot(), before);
      assert.equal(state(store).runs[0].definition.reward.gold, 11);
    } finally { store.close(); }
  });

  async function interruptAt(dbPath: string, command: ProbeCommand, point: CutPoint) {
    const child = spawn(process.execPath, ['--import', 'tsx', filename], { windowsHide: true,
      env: { ...process.env, BACKUP_DIR: '', BACKUP_KEEP: '0', HF_QUEST_STATE_CHILD: 'yes', HF_QUEST_STATE_DB: dbPath,
        HF_QUEST_STATE_COMMAND: JSON.stringify(command), HF_QUEST_STATE_CUT: point }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    owned.add(child);
    let output = '';
    child.stdout!.on('data', bytes => { output += String(bytes); }); child.stderr!.on('data', bytes => { output += String(bytes); });
    const closed = new Promise<void>(resolve => child.once('close', () => { owned.delete(child); resolve(); }));
    try {
      const reached = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('Owned child checkpoint timeout: ' + output)), 10000);
        child.on('message', (message: { checkpoint?: string }) => { if (message.checkpoint) { clearTimeout(timer); resolve(message.checkpoint); } });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('close', () => { clearTimeout(timer); reject(Error('Owned child closed: ' + output)); });
      });
      assert.equal(reached, point);
    } finally {
      if (owned.has(child)) child.kill('SIGKILL');
      await closed;
    }
    assert.ok((await fs.readdir(path.dirname(dbPath))).includes('probe.db-wal'));
  }

  for (const operation of ['delivery', 'claim'] as const) for (const point of ['after-actor', 'before-commit', 'after-commit'] as const) {
    test(`${operation}: crash at ${point} reopens consistently and retries once`, async () => {
      const f = await fresh(actor('actor-a', 3, operation === 'delivery' ? ['cargo'] : []));
      let store = f.store;
      try {
        if (operation === 'delivery') await store.execute('actor-a', 'accept', accept(deliveryQuest)); else await ready(store);
        const before = store.snapshot();
        const command: ProbeCommand = operation === 'delivery' ? credit(deliveryEvent) : { kind: 'claim', quest: 'kill-quest' };
        store.close();
        await interruptAt(f.dbPath, command, point);
        store = new QuestStateProbe(f.dbPath);
        if (point !== 'after-commit') assert.deepEqual(store.snapshot(), before);
        else {
          assert.equal(state(store).runs[0].status, operation === 'delivery' ? 'ready' : 'claimed');
          assert.equal(state(store).inventory.length, operation === 'delivery' ? 0 : 1);
          assert.equal(state(store).xp, operation === 'delivery' ? 0 : 7);
          assert.equal(state(store).gold, operation === 'delivery' ? 0 : 11);
          assert.equal(store.snapshot().receipts.length, before.receipts.length + 1);
        }
        assert.deepEqual(await store.execute('actor-a', 'crash-operation', command), { ok: true, state: operation === 'delivery' ? 'credited' : 'claimed' });
        const after = store.snapshot();
        await store.execute('actor-a', 'crash-operation', command); assert.deepEqual(store.snapshot(), after);
        assert.equal(state(store).runs[0].status, operation === 'delivery' ? 'ready' : 'claimed');
        assert.equal(state(store).inventory.length, operation === 'delivery' ? 0 : 1);
        assert.equal(state(store).xp, operation === 'delivery' ? 0 : 7);
      } finally { store.close(); }
    });
  }

  test('online backup preserves combined state; old restore reinstates old claim eligibility', async () => {
    const f = await fresh(); const store = f.store;
    try {
      await ready(store); const pre = store.snapshot();
      const oldPath = path.join(f.directory, 'before.db'); await backup(store.db, oldPath);
      await store.execute('actor-a', 'claim', { kind: 'claim', quest: 'kill-quest' });
      const post = store.snapshot(); const newPath = path.join(f.directory, 'after.db'); await backup(store.db, newPath);
      const old = new QuestStateProbe(oldPath), restored = new QuestStateProbe(newPath);
      try {
        assert.deepEqual(old.snapshot(), pre); assert.deepEqual(restored.snapshot(), post);
        assert.equal(old.actor('actor-a').runs[0].status, 'ready');
        assert.deepEqual(await old.execute('actor-a', 'claim', { kind: 'claim', quest: 'kill-quest' }), { ok: true, state: 'claimed' });
        assert.deepEqual(old.snapshot(), post);
      } finally { old.close(); restored.close(); }
    } finally { store.close(); }
  });
}
