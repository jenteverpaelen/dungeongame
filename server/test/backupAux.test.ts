import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AUX_NAME, createAuxBackup, restoreAuxBackup, rotateAuxBackups, verifyAuxBackup } from '../src/backupAux';

assert.ok(process.env.DATA_DIR, 'Aux backup checks require an isolated DATA_DIR');

async function fixture() {
  const base = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'aux-'));
  const data = path.join(base, 'data');
  const root = path.join(base, 'backups');
  await fs.mkdir(path.join(data, 'accounts'), { recursive: true });
  await fs.mkdir(path.join(data, 'social'), { recursive: true });
  await fs.writeFile(path.join(data, 'accounts', 'alice.json'), JSON.stringify({ username: 'alice', hash: 'x' }));
  await fs.writeFile(path.join(data, 'accounts', 'bob_b.json'), JSON.stringify({ username: 'bob_b', hash: 'y' }));
  await fs.writeFile(path.join(data, 'social', 'ledger.json'), JSON.stringify({ guilds: [] }));
  // things that must never be copied
  await fs.writeFile(path.join(data, 'accounts', 'alice.json.deadbeef.tmp'), 'half written');
  await fs.writeFile(path.join(data, 'accounts', 'Not Valid.json'), 'nope');
  await fs.writeFile(path.join(data, 'social', 'other.json'), 'nope');
  return { data, root };
}

test('a snapshot copies accounts and the ledger, verifies, and restores byte for byte into a new directory', async () => {
  const { data, root } = await fixture();
  const made = await createAuxBackup(root, data);
  assert.ok(made && made.files === 3);
  assert.match(path.basename(made.directory), AUX_NAME);
  assert.deepEqual(await verifyAuxBackup(made.directory), { files: 3, createdAt: (await verifyAuxBackup(made.directory)).createdAt });
  const dest = path.join(root, 'restored');
  const restored = await restoreAuxBackup(made.directory, dest);
  assert.equal(restored.files, 3);
  for (const rel of ['accounts/alice.json', 'accounts/bob_b.json', 'social/ledger.json']) {
    assert.deepEqual(await fs.readFile(path.join(dest, ...rel.split('/'))), await fs.readFile(path.join(data, ...rel.split('/'))));
  }
  await assert.rejects(restoreAuxBackup(made.directory, dest), 'an existing destination is refused');
});

test('with no accounts and no ledger nothing is created', async () => {
  const base = await fs.mkdtemp(path.join(process.env.DATA_DIR!, 'aux-empty-'));
  assert.equal(await createAuxBackup(path.join(base, 'backups'), path.join(base, 'data')), null);
});

test('a tampered, truncated or extended snapshot fails verification and cannot be restored', async () => {
  const { data, root } = await fixture();
  const made = (await createAuxBackup(root, data))!;
  const file = path.join(made.directory, 'files', 'accounts', 'alice.json');
  const good = await fs.readFile(file);
  await fs.writeFile(file, 'tampered');
  await assert.rejects(verifyAuxBackup(made.directory), /checksum/);
  await assert.rejects(restoreAuxBackup(made.directory, path.join(root, 'r1')));
  await fs.writeFile(file, good);
  await verifyAuxBackup(made.directory);
  await fs.writeFile(path.join(made.directory, 'files', 'accounts', 'mallory.json'), '{}');
  await assert.rejects(verifyAuxBackup(made.directory), /does not match manifest/);
});

test('rotation keeps the newest N verified snapshots and never removes anything it cannot verify', async () => {
  const { data, root } = await fixture();
  const dirs: string[] = [];
  for (let i = 0; i < 4; i++) {
    dirs.push((await createAuxBackup(root, data))!.directory);
    await new Promise((r) => setTimeout(r, 15));
  }
  // an unrelated directory and a damaged snapshot are left alone
  await fs.mkdir(path.join(root, 'notes'));
  await fs.writeFile(path.join(root, 'notes', 'keep.txt'), 'mine');
  await fs.writeFile(path.join(dirs[0], 'files', 'accounts', 'alice.json'), 'damaged');
  const rotated = await rotateAuxBackups(root, 2);
  assert.equal(rotated.kept.length, 2);
  assert.deepEqual(new Set(rotated.kept), new Set([dirs[3], dirs[2]]));
  assert.deepEqual(rotated.removed, [dirs[1]]);
  assert.deepEqual(rotated.excluded, [dirs[0]]);
  await fs.stat(dirs[0]); // damaged snapshot preserved for inspection
  await assert.rejects(fs.stat(dirs[1]));
  assert.equal(await fs.readFile(path.join(root, 'notes', 'keep.txt'), 'utf8'), 'mine');
});
