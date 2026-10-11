// Frozen-frame equivalence matrix (docs/rework/PERF.md §4.1): DOM globes (a build before 4.1) vs canvas globes at 1920x1080 and 1366x768,
// starter (no skills) and full skill bar, 4 clock times, life + resource globe. Prints per-channel max/mean inside the
// liquid circle (interior: r - 1.5 px; edge: r + 1 px). node scripts/perf/orb-equivalence.mjs <DOM-orb client url> <canvas-orb client url>   (crops in .local/orbm)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { decode } from './png.mjs';
const [domUrl, cvUrl] = process.argv.slice(2);
const TS = '0,1.7,5.3,12.9';
const cfgs = [
  { name: '1080p-starter', w: 1920, h: 1080, level: '' },
  { name: '1080p-full', w: 1920, h: 1080, level: '30' },
  { name: '1366-starter', w: 1366, h: 768, level: '' },
  { name: '1366-full', w: 1366, h: 768, level: '30' },
];
function shoot(url, tag, c) {
  const p = spawnSync(process.execPath, ['scripts/shoot.mjs', 'scripts/perf/orb-frame.mjs', `--base=${url}`, '--out=.local/orbm', `--w=${c.w}`, `--h=${c.h}`], { encoding: 'utf8', env: { ...process.env, TAG: tag, TS, LEVEL: c.level, HPF: '0.62', RESF: '0.45' }, timeout: 240000 });
  const m = /"globe":([\d.]+)/.exec(p.stdout || ''); if (!m) throw new Error(tag + ' failed: ' + (p.stdout || '').slice(-400) + (p.stderr || '').slice(-400));
  return Number(m[1]);
}
fs.mkdirSync('.local/orbm', { recursive: true });
const rows = [];
for (const c of cfgs) {
  const G = shoot(domUrl, `dom-${c.name}`, c); shoot(cvUrl, `cv-${c.name}`, c);
  for (const kind of ['life', 'res']) for (const T of TS.split(',')) {
    const A = decode(`.local/orbm/dom-${c.name}-${kind}-${T}.png`), B = decode(`.local/orbm/cv-${c.name}-${kind}-${T}.png`);
    const cx = A.width / 2, cy = A.height / 2, r = 0.42 * G;
    const stat = (rad) => { const max = [0, 0, 0], sum = [0, 0, 0]; let n = 0, over4 = 0;
      for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) { if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > rad * rad) continue; n++; let dm = 0;
        for (let k = 0; k < 3; k++) { const d = Math.abs(A.px[(y * A.width + x) * A.bpp + k] - B.px[(y * B.width + x) * B.bpp + k]); max[k] = Math.max(max[k], d); sum[k] += d; dm = Math.max(dm, d); }
        if (dm > 4) over4++; }
      return { max, mean: sum.map((s) => +(s / n).toFixed(2)), over4pct: +(100 * over4 / n).toFixed(2) }; };
    rows.push({ cfg: c.name, G, kind, T, interior: stat(r - 1.5), withEdge: stat(r + 1) });
  }
}
for (const r of rows) console.log(`${r.cfg.padEnd(14)} G=${r.G} ${r.kind.padEnd(4)} T=${String(r.T).padEnd(4)} interior max ${r.interior.max.join('/')} mean ${r.interior.mean.join('/')} >4: ${r.interior.over4pct}% | with edge max ${r.withEdge.max.join('/')} mean ${r.withEdge.mean.join('/')}`);
const agg = (k) => { const all = rows.map((r) => r[k]); return { max: [0, 1, 2].map((i) => Math.max(...all.map((a) => a.max[i]))), mean: [0, 1, 2].map((i) => +(all.reduce((s, a) => s + a.mean[i], 0) / all.length).toFixed(2)), over4pct: +(all.reduce((s, a) => s + a.over4pct, 0) / all.length).toFixed(2) }; };
console.log('SUMMARY interior', JSON.stringify(agg('interior')), 'with edge', JSON.stringify(agg('withEdge')));
fs.writeFileSync('.local/orbm/matrix.json', JSON.stringify(rows, null, 1));
