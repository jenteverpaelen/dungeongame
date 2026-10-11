// Paired, concurrent A/B of two client builds on a recorded reference (docs/rework/PERF.md §2): each round both builds
// replay the same recording at the same time, so load from other processes hits both alike; the per-round ratio B/A
// is the result (round-to-round spread was ≤ 2 % on a shared machine, against ±40 % for single runs).
//
//   node scripts/perf/ab.mjs <rounds> A=<client url> B=<client url>[|PRE:<preset>]
//   e.g. node scripts/perf/ab.mjs 3 A=http://localhost:5331 B=http://localhost:5336
//   env passes through to scripts/perf/replay-sample.mjs (REC, SKIP4, NOCENSUS)
import { spawn } from 'node:child_process';

const [rounds, a, b] = process.argv.slice(2);
if (!rounds || !a || !b) { console.error('usage: node scripts/perf/ab.mjs <rounds> A=<url> B=<url>[|PRE:<preset>]'); process.exit(2); }
const parse = (v) => { const i = v.indexOf('='); const [url, ...envs] = v.slice(i + 1).split('|'); return { name: v.slice(0, i), url, env: Object.fromEntries(envs.map((e) => e.split(':'))) }; };
const A = parse(a), B = parse(b);
const run = (v, r) => new Promise((resolve) => {
  const p = spawn(process.execPath, ['scripts/shoot.mjs', 'scripts/perf/replay-sample.mjs', `--base=${v.url}`, '--out=.local/shots', '--jpeg'], { env: { ...process.env, ...v.env, TAG: `${v.name}-${r}` } });
  let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
  p.on('close', () => { const line = out.split('\n').find((l) => l.startsWith('RESULT ')); if (!line) console.log(v.name, 'FAILED', out.slice(-600)); resolve(line ? JSON.parse(line.slice(7)) : null); });
});
const pick = (x) => ({ fps: x.r1.fps, p95: x.r1.p95, main: x.r1.cpu.main, gpu: x.r1.cpu.gpu, draw: x.r1.drawCalls, kb: x.r1.bufferKB, visible: x.r1.visible, fps4: x.r4?.fps, main4: x.r4?.cpu.main });
const rows = [];
for (let r = 0; r < Number(rounds); r++) {
  const [ra, rb] = await Promise.all([run(A, r), run(B, r)]);
  if (!ra || !rb) continue;
  const ma = pick(ra), mb = pick(rb);
  rows.push({ ma, mb });
  console.log(`round ${r}\n  ${A.name}: ${JSON.stringify(ma)}\n  ${B.name}: ${JSON.stringify(mb)}`);
}
const med = (arr) => { const s = arr.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
for (const k of ['main', 'gpu', 'fps', 'fps4', 'main4']) {
  const ratio = med(rows.map((x) => x.mb[k] / x.ma[k]));
  if (Number.isFinite(ratio)) console.log(`median ratio ${k} ${B.name}/${A.name} = ${ratio.toFixed(3)}`);
}
