// One A/B sample (a scripts/shoot.mjs scenario): replay a recorded reference into the client at 1× (frames, WebGL work,
// display-object census, thread CPU per frame), then at 4× CPU throttle (frames, thread CPU). Prints `RESULT {json}`.
//   env: REC (recording, default scripts/perf/rift-fight.rec.gz), SKIP4=1 (no 4× pass), NOCENSUS=1, SHOT=1, TAG
//        PRE=<preset,...> experiments before the replay: hidehud | noglobes | low | medium (see PRESETS)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { traceCpu } from './cpu-trace.mjs';

const rec = zlib.gunzipSync(fs.readFileSync(process.env.REC ?? 'scripts/perf/rift-fight.rec.gz')).toString('base64');
const page = fs.readFileSync('scripts/perf/replay-page.js', 'utf8');
const hide = (sel) => `(() => { const st = document.createElement('style'); st.textContent = ${JSON.stringify(`${sel} { visibility: hidden !important; }`)}; document.head.appendChild(st); return true; })()`;
const PRESETS = {
  hidehud: "document.getElementById('ui').style.display = 'none'; true",
  noglobes: hide('.globe, .globe *'),
  medium: "__prefs.set({ graphicsPreset: 'medium' }); true",
  low: "__prefs.set({ graphicsPreset: 'low' }); true",
};
const perFrame = (t) => { const f = t.result.allFrames || 1; const o = {}; for (const k in t.cpuMs) o[k] = +(t.cpuMs[k] / f).toFixed(2); return o; };

export default async function (a) {
  await a.open({ name: 'Replay' + Math.floor(Math.random() * 90000 + 10000), cls: 'warrior' });
  await a.eval(page);
  for (const p of (process.env.PRE ?? '').split(',').filter(Boolean)) {
    if (!PRESETS[p]) throw new Error(`unknown PRE preset ${p}`);
    await a.eval(PRESETS[p]);
  }
  await a.eval(`window.__rec64 = ${JSON.stringify(rec)}; true`);
  const t1 = await traceCpu(a, () => a.eval(`__perfReplay(window.__rec64, { census: ${process.env.NOCENSUS ? 'false' : 'true'} })`));
  if (process.env.SHOT) await a.shot(process.env.TAG ?? 'replay');
  let r4 = null;
  if (!process.env.SKIP4) {
    await a.cdp('Emulation.setCPUThrottlingRate', { rate: 4 });
    const t4 = await traceCpu(a, () => a.eval('__perfReplay(window.__rec64, { census: false, gl: false })'));
    await a.cdp('Emulation.setCPUThrottlingRate', { rate: 1 });
    r4 = { ...t4.result, cpu: perFrame(t4) };
  }
  console.log('RESULT ' + JSON.stringify({ r1: { ...t1.result, cpu: perFrame(t1) }, r4 }));
}
