// Compare current output history with its documented counter; no game server or live saves.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Rng } from '../shared/src/math';
import { rollDrops, type DropContext } from '../shared/src/items';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-loot-counter-'));
process.env.DATA_DIR = path.join(root, 'data');
delete process.env.BACKUP_DIR;
await fs.mkdir(process.env.DATA_DIR);
const args = process.argv.slice(2);
assert.equal(args.length, 1, 'Pass an evidence output path');
const payloadHash = createHash('sha256'), observationHash = createHash('sha256');
const groups = new Map<string, { batches: number; floors: number; mismatches: number; empty: number; naturalTails: number }>();
const examples: object[] = [];
const seen = new Set<string>();
let batches = 0, mismatches = 0;

function probe(ctx: DropContext, seed: number) {
  const rng = new Rng(seed);
  const result = rollDrops(rng, ctx, 0);
  const items = result.drops.filter(d => d.type === 'item').map(d => d.item);
  const floor = ctx.elite === 4 && items.length > new Rng(seed).int(5, 7);
  const lastSuccess = items.findLastIndex(i => i.rarity === 'legendary' || i.rarity === 'set');
  const expected = lastSuccess < 0 ? ctx.pity + items.length : items.length - lastSuccess - 1;
  const mismatch = result.pity !== expected;
  // IDs contain a process counter unrelated to item stats. Preserve every other payload field.
  const drops = result.drops.map(d => d.type === 'item' ? { ...d, item: { ...d.item, id: '<generated-id>' } } : d);
  const payload = { ctx, seed, drops, rngNext: rng.next() };
  payloadHash.update(JSON.stringify(payload));
  observationHash.update(JSON.stringify({ ...payload, pity: result.pity }));
  const groupKey = `${ctx.classId}/L${ctx.level}/D${ctx.difficulty}/T${ctx.elite}`;
  const group = groups.get(groupKey) ?? { batches: 0, floors: 0, mismatches: 0, empty: 0, naturalTails: 0 };
  group.batches++; group.floors += +floor; group.mismatches += +mismatch;
  group.empty += +(items.length === 0); group.naturalTails += +(!floor && lastSuccess >= 0 && expected > 0);
  groups.set(groupKey, group);
  if (mismatch) { assert.ok(floor, 'Unexpected mismatch outside boss floor'); mismatches++; }
  const exampleKey = `${groupKey}/${floor ? 'floor' : items.length === 0 ? 'empty' : lastSuccess >= 0 && expected > 0 ? 'tail' : 'ordinary'}`;
  if (!seen.has(exampleKey)) {
    seen.add(exampleKey);
    examples.push({ ctx, seed, rarities: items.map(i => i.rarity), floor, returned: result.pity, expected, mismatch });
  }
  batches++;
}
for (const classId of ['warrior', 'ranger', 'mage'] as const) for (const level of [1, 70]) for (const difficulty of [0, 6]) {
  for (let seed = 1; seed <= 64; seed++) probe({ classId, level, difficulty, elite: 4, magicFind: 0, pity: 17, inRift: true }, seed);
  for (const elite of [0, 1, 2, 3, 5] as const) for (const pity of [0, 44, 45]) for (let seed = 1; seed <= 32; seed++)
    probe({ classId, level, difficulty, elite, magicFind: 0, pity, inRift: false }, seed);
}
assert.equal(batches, 6528);
assert.ok([...groups.values()].some(g => g.floors > 0));
assert.ok([...groups.values()].some(g => g.naturalTails > 0));
assert.deepEqual(await fs.readdir(process.env.DATA_DIR), []);
const report = { date: '2026-10-09', node: process.version, platform: process.platform, root,
  scope: 'Synthetic generated batches; no kill/pickup/time-to-upgrade or performance claim',
  batches, mismatches, payloadSha256: payloadHash.digest('hex'), observationSha256: observationHash.digest('hex'),
  groups: Object.fromEntries(groups), examples };
await fs.mkdir(path.dirname(path.resolve(args[0])), { recursive: true });
await fs.writeFile(args[0], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ root, batches, mismatches, payloadSha256: report.payloadSha256, observationSha256: report.observationSha256 }));
