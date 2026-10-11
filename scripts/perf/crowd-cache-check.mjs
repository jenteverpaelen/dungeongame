// Crowd pose-cache check (a scripts/shoot.mjs scenario, docs/rework/PERF.md §4): replays the town crowd with the >40-entity
// pose cache forced on and reports Graphics drawn from a destroyed context (the pre-fix crash) and page errors.
//   node scripts/shoot.mjs scripts/perf/crowd-cache-check.mjs --base=<client url>    (before the fix: ~60 % of runs failed)
import fs from 'node:fs'; import zlib from 'node:zlib';
const rec = zlib.gunzipSync(fs.readFileSync('scripts/perf/town-crowd.rec.gz')).toString('base64');
const HOOKS = String.raw`(() => {
  const pipe = __game.scene.app.renderer.renderPipes.graphics; const orig = pipe.validateRenderable.bind(pipe);
  pipe.validateRenderable = (g) => {
    if (!g.context || !g.context.instructions) {
      const chain = []; let p = g; for (let i = 0; i < 8 && p; i++, p = p.parent) chain.push((p.label || p.constructor.name) + (p.destroyed ? '(destroyed)' : '') + (p.isRenderGroup ? '[RG]' : '') + (p.isCachedAsTexture ? '[cached]' : '') + (p.visible ? '' : '(hidden)'));
      (window.__bad ||= []).push({ chain: chain.join(' < '), destroyStack: g.context && g.context.__ds });
    }
    return orig(g);
  };
  let g = null; const walk = (o) => { if (g) return; if (o.context && o.context.constructor) g = o; for (const c of o.children || []) walk(c); }; walk(__game.scene.app.stage);
  if (g) { const P = Object.getPrototypeOf(g.context); const d = P.destroy; P.destroy = function (...x) { this.__ds = new Error().stack.split('\n').slice(1, 9).map(s => s.trim()).join(' | '); return d.apply(this, x); }; }
  return !!g;
})()`;
export default async function (a) {
  await a.open({ name: 'Cache' + Math.floor(Math.random() * 90000), cls: 'warrior' });
  await a.eval(fs.readFileSync('scripts/perf/replay-page.js', 'utf8'));
  await a.eval(`window.__r = ${JSON.stringify(rec)}; true`);
  if (!process.env.NOFORCE) await a.eval("(() => { const s = __game.scene.active; Object.defineProperty(s, 'size', { get: () => 100 }); return true; })()");
  console.log('hooks', await a.eval(HOOKS));
  const run = a.eval('__perfReplay(window.__r, { warmupMs: 8000 })');
  await a.wait(13000);
  const tick = await a.eval('new Promise((res) => { let n = 0; const t = __game.scene.app.ticker; const f = () => n++; t.add(f); setTimeout(() => { t.remove(f); res({ ticks: n, started: t.started }); }, 1000); })');
  console.log('ticker during 1 s', JSON.stringify(tick));
  console.log('bad', JSON.stringify(await a.eval('window.__bad ?? null')));
  const r = await run;
  console.log(JSON.stringify({ fps: r.fps, draw: r.drawCalls, vis: r.visible }), 'errors', a.errors.length);
}
