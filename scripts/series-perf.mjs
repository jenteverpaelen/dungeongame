// A/B cost of the weapon series art against the previous art (interleaved, same minutes, visible page target):
//   node scripts/shoot.mjs scripts/series-perf.mjs --base=http://localhost:5291 --out=.local/series-perf
// The perf gallery: simulated heroes, every hero a unique look ('scene' bake mode). PERF_SET=crowd30 (default) runs the
// 30-endgame-hero crowd the performance gate asks for; PERF_SET=crowd100 the earlier 100-hero runs.
// Per sample: fps / frame p95 / draw calls (gallery counter) plus display objects counted on the live stage
// (all / visible / visible Graphics / visible additive sprites / distinct texture sources among visible sprites).
const SETS = {
  crowd30: [
    ['30 heroes Fabled, High', 'players=30&monsters=0&gear=primal&q=full&preset=high'],
    ['30 heroes L70, High', 'players=30&monsters=0&gear=L70&q=full&preset=high'],
    ['30 heroes Fabled + 150 monsters, High', 'players=30&monsters=150&gear=primal&q=full&preset=high'],
    ['30 heroes Fabled, Low', 'players=30&monsters=0&gear=primal&q=full&preset=low'],
  ],
  crowd100: [
    ['100 heroes, mixed stages', 'players=100&monsters=0&gear=mix&q=full&preset=high'],
    ['100 heroes, Fabled stage', 'players=100&monsters=0&gear=primal&q=full&preset=high'],
  ],
};

const COUNT = `(() => {
  const app = window.__app; if (!app) return 'no app';
  let all = 0, vis = 0, gfx = 0, add = 0; const tex = new Set();
  const walk = (o, shown) => {
    all++;
    const on = shown && o.visible && o.alpha > 0;
    if (on) {
      vis++;
      if (o.constructor && o.constructor.name === 'Graphics') gfx++;
      if (o.texture && o.texture.source) tex.add(o.texture.source.uid);
      if (o.blendMode === 'add') add++;
    }
    for (const ch of o.children ?? []) walk(ch, on);
  };
  walk(app.stage, true);
  return 'objects ' + all + ' visible ' + vis + ' gfx ' + gfx + ' add ' + add + ' textures ' + tex.size;
})()`;

export default async function (api) {
  const cases = SETS[process.env.PERF_SET ?? 'crowd30'];
  const rounds = Number(process.env.ROUNDS ?? 2), waitMs = Number(process.env.WAIT ?? 20000);
  for (let r = 0; r < rounds; r++) for (const [name, q] of cases) for (const art of r % 2 ? ['series', 'current'] : ['current', 'series']) {
    await api.goto(`${api.base}/gallery-art.html?view=perf&${q}&weaponArt=${art}&nohud=1`);
    await api.until(() => api.eval('window.__ready === true'), 30000, 'gallery ready');
    await api.wait(waitMs);
    const samples = [];
    for (let i = 0; i < 4; i++) { samples.push(await api.eval('window.__info + " hidden=" + document.hidden')); await api.wait(1500); }
    const counts = await api.eval(COUNT);
    console.log(`round ${r + 1} · ${name} · ${art}:\n  ${samples.join('\n  ')}\n  ${counts}`);
  }
}
