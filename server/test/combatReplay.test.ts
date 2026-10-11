// Combat replay / determinism (F-TEL-07): a recorded input stream replayed on the same seed reproduces every snapshot
// byte for byte (event stream, positions, hit points, loot, XP); a single changed input or another seed diverges, and
// the first divergent tick is reported. Each run happens in its own process (see replay/combatReplayRunner.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReplayConfig, ReplayResult } from './replay/combatReplayRunner';

assert.ok(process.env.DATA_DIR, 'Use an isolated DATA_DIR');
const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, 'replay', 'combatReplayRunner.ts');
let n = 0;
function run(cfg: ReplayConfig): ReplayResult {
  const dir = path.join(process.env.DATA_DIR!, 'replay'); fs.mkdirSync(dir, { recursive: true });
  const cfgFile = path.join(dir, `cfg-${process.pid}-${n}.json`), outFile = path.join(dir, `out-${process.pid}-${n++}.json`);
  fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  const r = spawnSync(process.execPath, ['--import', 'tsx', runner, cfgFile, outFile], { cwd: path.resolve(here, '../..'), encoding: 'utf8', env: process.env });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(fs.readFileSync(outFile, 'utf8')) as ReplayResult;
}
const firstDivergence = (a: string[], b: string[]) => { for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i; return -1; };

for (const [cls, level, zone] of [['warrior', 8, 'whispering_glade'], ['ranger', 14, 'ashen_hollow'], ['mage', 12, 'ashen_hollow']] as const) {
  test(`${cls} L${level}: recorded combat replays identically and diverges where the inputs change`, () => {
    const base = { seed: 4242 + level, cls, level, zone, ticks: 20 * 45 } as const;
    const rec = run({ ...base, mode: 'record' });
    assert.ok(rec.summary.dmg > 50 && rec.summary.die > 0, `the run contains real combat (${JSON.stringify(rec.summary)})`);
    assert.ok(rec.inputs.some(i => i.cast), 'skill casts are part of the recording');

    const replay = run({ ...base, mode: 'replay', inputs: rec.inputs });
    assert.equal(firstDivergence(rec.tickHashes, replay.tickHashes), -1, 'every tick matches');
    assert.equal(replay.final, rec.final);
    assert.deepEqual(replay.summary, rec.summary);

    // Changed inputs: for one second from the first moving tick after 10 s the hero walks the other way (movement input
    // is legitimately ignored while dead, rooted or channelling, so the window starts where the hero walks).
    const from = rec.inputs.find(i => i.tick >= 200 && (i.mx || i.my))!.tick;
    const changed = rec.inputs.map(i => (i.tick >= from && i.tick < from + 20 ? { ...i, mx: -i.mx, my: -i.my } : i));
    const diverged = run({ ...base, mode: 'replay', inputs: changed });
    const at = firstDivergence(rec.tickHashes, diverged.tickHashes);
    assert.ok(at >= from && at <= from + 1, `divergence starts at the changed input (tick ${at})`);
    assert.notEqual(diverged.final, rec.final);
    assert.equal(firstDivergence(rec.tickHashes.slice(0, from), diverged.tickHashes.slice(0, from)), -1, 'everything before the change still matches');

    // Same inputs, another seed: the random streams (crits, drops, monster choices) matter, so the test is not vacuous.
    const reseeded = run({ ...base, seed: base.seed + 1, mode: 'replay', inputs: rec.inputs });
    assert.notEqual(reseeded.final, rec.final);
  });
}
