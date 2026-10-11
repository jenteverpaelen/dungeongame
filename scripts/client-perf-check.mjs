// Client performance gate (verify stage `client-perf`, docs/rework/PERF.md §Gate). The BUILT client (dist/client), served
// by the real game server, in headless Chrome at 1920×1080:
//   1. idle in town: no running CSS animation may animate a property that repaints (compositor properties only), and the
//      HUD must not repaint per frame (DOM Paint events per frame);
//   2. two recorded references are replayed into the client exactly as the socket delivered them, so every run renders
//      the same scene: the Torment Faultline fight (scripts/perf/rift-fight.rec.gz: L70 full-set Warrior, ~27 monsters)
//      and the town crowd (scripts/perf/town-crowd.rec.gz: 25 L70 heroes in full Set and Legendary gear). Their
//      deterministic per-frame work — draw calls, texture binds and uploads, buffer upload KB, visible display objects,
//      renderables, DOM paints — must stay inside scripts/perf/budgets.json.
// Frame rate and thread CPU time are reported but never gated (the machine may be shared; hidden tabs pause rAF).
//
//   DATA_DIR=<isolated dir> node scripts/client-perf-check.mjs        (after `npm run build`)
//   re-record (protocol change): node scripts/shoot.mjs scripts/perf/record-fight.mjs | record-town.mjs --base=<dev client>
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { startChrome, startServer, runningAnimations, until, wait } from './perf/harness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.DATA_DIR) throw new Error('Set an isolated DATA_DIR');
await fs.access(path.join(root, 'dist/client/index.html')).catch(() => { throw new Error('dist/client is missing: run `npm run build` first'); });
const budgets = JSON.parse(await fs.readFile(path.join(root, 'scripts/perf/budgets.json'), 'utf8'));
const replayPage = await fs.readFile(path.join(root, 'scripts/perf/replay-page.js'), 'utf8');
const load = async (f) => zlib.gunzipSync(await fs.readFile(path.join(root, 'scripts/perf', f))).toString('base64');
const SCENES = [
  { key: 'rift', label: 'reference fight', file: 'rift-fight.rec.gz', warmupMs: 3000, expect: (r) => r.mobs > 20 ? null : `${r.mobs} monsters on average (expected ~27)` },
  { key: 'town', label: 'town crowd', file: 'town-crowd.rec.gz', warmupMs: 3000, expect: (r) => r.heroes > 20 ? null : `${r.heroes} heroes on average (expected 25)` },
];
const COMPOSITED = new Set(budgets.compositedProperties);

const problems = [];
const report = { budgets: budgets.note };
let server, chrome;

/** Trace over `run()`: DOM Paint events, frames and top-level task CPU time per thread (renderer main, GPU process). */
async function traced(page, run) {
  const events = [];
  let collecting = true, done = () => {};
  const complete = new Promise((r) => { done = r; });
  page.onCdp((m) => { if (!collecting) return; if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); if (m.method === 'Tracing.tracingComplete') { collecting = false; done(); } });
  await page.eval('(() => { window.__hfFc = 0; const f = () => { window.__hfFc++; if (window.__hfFcOn) requestAnimationFrame(f); }; window.__hfFcOn = true; requestAnimationFrame(f); return 0; })()');
  await page.cdp('Tracing.start', { categories: 'toplevel,devtools.timeline', transferMode: 'ReportEvents' });
  const result = await run();
  await page.cdp('Tracing.end');
  await complete;
  const frames = await page.eval('(() => { window.__hfFcOn = false; return window.__hfFc; })()');
  const threads = new Map();
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') threads.set(`${e.pid}:${e.tid}`, e.args.name);
  const names = { CrRendererMain: 'main', CrGpuMain: 'gpu' };
  const tasks = events.filter((e) => e.ph === 'X' && e.dur > 0 && names[threads.get(`${e.pid}:${e.tid}`)] && /RunTask$/.test(e.name)).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const cpu = {}, openUntil = new Map();
  for (const e of tasks) {
    const k = `${e.pid}:${e.tid}`;
    if (e.ts < (openUntil.get(k) ?? -1)) continue; // nested in a task already counted
    openUntil.set(k, e.ts + e.dur);
    cpu[names[threads.get(k)]] = (cpu[names[threads.get(k)]] ?? 0) + (e.tdur ?? e.dur) / 1000;
  }
  const paints = events.filter((e) => e.ph === 'X' && e.name === 'Paint').length;
  const per = (v) => +(v / Math.max(1, frames)).toFixed(3);
  return { result, frames, paints, paintsPerFrame: per(paints), cpuMsPerFrame: { main: +per(cpu.main ?? 0).toFixed(2), gpu: +per(cpu.gpu ?? 0).toFixed(2) } };
}

/** Keyframe animations must animate compositor properties only; transitions are listed (they run briefly on changes). */
function checkAnimations(where, list) {
  for (const a of list) {
    const bad = a.props.filter((p) => !COMPOSITED.has(p));
    if (bad.length && a.kind === 'animation') problems.push(`${where}: CSS animation "${a.name}" on ${a.target} animates ${bad.join(', ')}, which repaints every frame (animate only ${[...COMPOSITED].join(' / ')})`);
  }
  return list.filter((a) => a.kind === 'transition' && a.props.some((p) => !COMPOSITED.has(p))).map((a) => `${a.target}: ${a.name}`);
}

function checkBudget(where, measured, limits) {
  for (const [k, max] of Object.entries(limits)) {
    const v = measured[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) { problems.push(`${where}: ${k} was not measured`); continue; }
    if (v > max) problems.push(`${where}: ${k} ${v} > budget ${max} (docs/rework/PERF.md §Budgets)`);
  }
}

try {
  server = await startServer(root, path.join(process.env.DATA_DIR, 'client-perf'));
  chrome = await startChrome();
  const { page } = chrome;
  await page.goto(`${server.base}/?autostart=Perfgate&class=warrior`);
  await until(() => page.eval('Boolean(window.__game?.world?.map && window.__ui?.get().screen === "game" && __ui.get().me && __game.conn?.ws)'), 60_000, 'the game screen');
  await page.eval('document.activeElement?.blur?.(); true');
  await page.mouse(960, 300);
  await wait(3000); // first frames, font swaps and the welcome notices settle

  // 1. Idle town: the HUD must sit still.
  const townAnims = await runningAnimations(page);
  checkAnimations('idle town', townAnims);
  const idle = await traced(page, () => wait(3000));
  report.idleTown = { animations: townAnims.length, frames: idle.frames, domPaintsPerFrame: idle.paintsPerFrame, cpuMsPerFrame: idle.cpuMsPerFrame, hidden: await page.eval('document.hidden') };
  if (report.idleTown.hidden) problems.push('the page was hidden: requestAnimationFrame paused, numbers are meaningless');
  checkBudget('idle town', report.idleTown, budgets.idleTown);

  // 2. Recorded references.
  await page.eval(replayPage);
  for (const scene of SCENES) {
    await page.eval(`window.__hfRec = ${JSON.stringify(await load(scene.file))}; true`);
    let anims = [];
    const t = await traced(page, async () => {
      // new looks are baked time-sliced (how long depends on the machine): measure from when the queue is empty
      const run = page.eval(`__perfReplay(window.__hfRec, { warmupMs: ${scene.warmupMs}, waitBakes: true, census: true, censusEveryMs: 500 })`);
      await wait(scene.warmupMs + 5000);
      anims = await runningAnimations(page);
      return run;
    });
    const transitions = checkAnimations(scene.label, anims);
    const r = t.result;
    const m = report[scene.key] = {
      drawCalls: r.drawCalls, textureBinds: r.textureBinds, textureUploads: r.textureUploads, bufferKB: r.bufferKB,
      visible: r.visible, renderables: r.renderables, graphics: r.graphics, domPaintsPerFrame: t.paintsPerFrame,
      mobs: r.mobs, heroes: await page.eval('(() => { let n = 0; for (const e of __game.world.entities.values()) if (e.kind === "player") n++; return n; })()'),
      frames: r.frames, measuredFromMs: r.measuredFromMs, fps: r.fps, p95: r.p95, cpuMsPerFrame: t.cpuMsPerFrame, transitionsSeen: transitions, hidden: r.hidden,
    };
    if (r.hidden) problems.push(`${scene.label}: the page was hidden; requestAnimationFrame paused, numbers are meaningless`);
    if (!(r.frames >= 200)) problems.push(`${scene.label}: only ${r.frames} frames measured (bakes still running at ${r.measuredFromMs} ms of the recording?)`);
    const wrong = scene.expect(m);
    if (wrong) problems.push(`${scene.label}: ${wrong}: replay broken? re-record (see the header of this file)`);
    checkBudget(scene.label, m, budgets[scene.key]);
  }
  for (const e of [...new Set(page.errors)]) problems.push(`page error: ${e.split('\n')[0]}`);
} catch (e) {
  problems.push(String(e?.stack ?? e));
} finally {
  await chrome?.stop();
  await server?.stop();
}

await fs.writeFile(path.join(process.env.DATA_DIR, 'client-perf.json'), JSON.stringify(report, null, 2) + '\n').catch(() => {});
const t = report.idleTown;
if (t) console.log(`idle town: ${t.domPaintsPerFrame} DOM paints/frame over ${t.frames} frames, ${t.animations} running animations`);
for (const s of SCENES) {
  const f = report[s.key]; if (!f) continue;
  console.log(`${s.label} (${f.mobs} monsters, ${f.heroes} heroes; measured from ${(f.measuredFromMs / 1000).toFixed(1)} s): ${f.drawCalls} draw calls, ${f.textureBinds} texture binds, ${f.textureUploads} texture uploads, ${f.bufferKB} KB buffer uploads, ${f.visible} visible objects, ${f.renderables} renderables, ${f.domPaintsPerFrame} DOM paints per frame`);
  console.log(`  informative (not gated): ${f.fps} fps, p95 ${f.p95} ms, CPU ${f.cpuMsPerFrame.main} ms main thread + ${f.cpuMsPerFrame.gpu} ms GPU process per frame${f.transitionsSeen.length ? `; transitions running: ${f.transitionsSeen.join(', ')}` : ''}`);
}
if (problems.length) { console.error(`CLIENT PERF CHECK FAILED:\n  ${problems.join('\n  ')}`); process.exitCode = 1; }
else console.log('client perf budgets passed');
