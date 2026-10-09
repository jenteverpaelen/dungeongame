import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PathLike } from 'node:fs';
import { createCharacter } from '../../shared/src/character';
import { DATA_DIR, AUTOSAVE_MS } from '../src/config';
import { ensureDataDir, saveCharacter, loadCharacter, flushSaves, SaveWriteError } from '../src/persistence';
import { Session } from '../src/net/session';
import type { S2C } from '../../shared/src/protocol';

assert.ok(process.env.DATA_DIR, 'Save-failure tests require an isolated DATA_DIR');
ensureDataDir();
const fault = () => Object.assign(new Error('Synthetic storage outage'), { code: 'EACCES' });

test('failed writes reject, preserve disk/items, block stale reload, and recover the captured snapshot', async t => {
  const c = createCharacter('FailRecover', 'mage', 7);
  c.gold = 11; await saveCharacter(c);
  const file = path.join(DATA_DIR, c.id + '.json');
  const original = await fs.readFile(file, 'utf8');
  const owned = structuredClone([c.equipment, c.inventory, c.stash]);
  const rename = fs.rename;
  const mock = t.mock.method(fs, 'rename', async (src: PathLike, dest: PathLike) => {
    if (dest === file) throw fault();
    return rename(src, dest);
  });
  try {
    c.gold = 99;
    await assert.rejects(saveCharacter(c), SaveWriteError);
    c.gold = 1000; // A retry must use the captured JSON, not this mutable object.
    await assert.rejects(loadCharacter(c.id), SaveWriteError);
    await assert.rejects(flushSaves(), AggregateError);
    assert.equal(await fs.readFile(file, 'utf8'), original);
    assert.equal((await fs.readdir(DATA_DIR)).filter(f => f.endsWith('.tmp')).length, 0);
  } finally { mock.mock.restore(); }
  const recovered = await loadCharacter(c.id);
  assert.equal(recovered!.gold, 99);
  assert.deepEqual([recovered!.equipment, recovered!.inventory, recovered!.stash], owned);
  await flushSaves();
});

test('one failed queued write cannot poison its successor or another character', async t => {
  const c = createCharacter('QueueRecovery', 'warrior', 8);
  const other = createCharacter('OtherSave', 'ranger', 9);
  const file = path.join(DATA_DIR, c.id + '.json');
  const rename = fs.rename;
  let first = true;
  const mock = t.mock.method(fs, 'rename', async (src: PathLike, dest: PathLike) => {
    if (dest === file && first) { first = false; throw fault(); }
    return rename(src, dest);
  });
  try {
    c.gold = 1; const failed = saveCharacter(c);
    const rejection = assert.rejects(failed, SaveWriteError);
    c.gold = 2; const later = saveCharacter(c);
    other.gold = 3;
    await Promise.all([rejection, later, saveCharacter(other)]);
    await flushSaves();
    assert.equal((await loadCharacter(c.id))!.gold, 2);
    assert.equal((await loadCharacter(other.id))!.gold, 3);
  } finally { mock.mock.restore(); }
});

test('flush retries a transient outage once and still reports a persistent failure', async t => {
  const c = createCharacter('FlushRecovery', 'mage', 10);
  const rename = fs.rename;
  let attempts = 0;
  const mock = t.mock.method(fs, 'rename', async () => {
    attempts++; throw fault();
  });
  await assert.rejects(saveCharacter(c), SaveWriteError);
  await assert.rejects(flushSaves(), AggregateError);
  assert.equal(attempts, 2, 'one original write plus one bounded flush retry');
  mock.mock.restore();
  await flushSaves();
  assert.equal((await loadCharacter(c.id))!.id, c.id);
  assert.equal(fs.rename, rename);
});

test('failed initial creation cannot become a missing character and partial temp output is cleaned', async t => {
  const c = createCharacter('InitialFailure', 'warrior', 12);
  const writeFile = fs.writeFile;
  const mock = t.mock.method(fs, 'writeFile', async (...args: Parameters<typeof fs.writeFile>) => {
    await writeFile(args[0], '{partial');
    throw fault();
  });
  try {
    await assert.rejects(saveCharacter(c), SaveWriteError);
    await assert.rejects(loadCharacter(c.id), SaveWriteError);
    assert.equal((await fs.readdir(DATA_DIR)).filter(f => f.startsWith(c.id)).length, 0);
  } finally { mock.mock.restore(); }
  await flushSaves();
  assert.equal((await loadCharacter(c.id))!.name, c.name);
});

test('live session retries at the existing autosave interval and reports outage/recovery once', async t => {
  const messages: S2C[] = [];
  // Exercise actual Session methods without a network connection or world tick.
  const session = Object.assign(Object.create(Session.prototype), {
    save: createCharacter('SessionRetry', 'ranger', 11), state: 'ready',
    send: (m: S2C) => messages.push(m),
  }) as Session;
  const mock = t.mock.method(fs, 'rename', async () => { throw fault(); });
  try {
    session.saveNow(); await assert.rejects(flushSaves(), AggregateError);
    session.autosave(Date.now() + AUTOSAVE_MS + 1);
    await assert.rejects(flushSaves(), AggregateError);
    assert.equal(messages.filter(m => m.t === 'chat' && m.text.includes('could not be saved')).length, 1);
  } finally { mock.mock.restore(); }
  session.save.gold = 77;
  session.autosave(Date.now() + AUTOSAVE_MS + 1);
  await flushSaves();
  assert.equal((await loadCharacter(session.save.id))!.gold, 77);
  assert.equal(messages.filter(m => m.t === 'chat' && m.text === 'Saving is working again.').length, 1);
});
