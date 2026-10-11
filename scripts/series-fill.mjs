// Fill cost of the weapon series against the previous art [M]: on-screen pixel area of the visible sprites (all, and the
// additive ones — the glow and light layers), summed from texture frame × world scale. Deterministic where frame rates
// on a shared machine are not (docs/rework/gear/ART-DIRECTION.md §11).
//   node scripts/shoot.mjs scripts/series-fill.mjs --base=http://localhost:5291 --out=.local/series-perf
const CASES = [
  ['30 heroes Fabled, High', 'players=30&monsters=0&gear=primal&q=full&preset=high'],
  ['30 heroes L70, High', 'players=30&monsters=0&gear=L70&q=full&preset=high'],
  ['30 heroes Fabled, Low', 'players=30&monsters=0&gear=primal&q=full&preset=low'],
];
const AREA = `(() => {
  const app = window.__app; if (!app) return 'no app';
  let all = 0, add = 0, nAdd = 0, nAll = 0;
  const walk = (o, shown) => {
    const on = shown && o.visible && o.alpha > 0;
    if (!on) return;
    const t = o.texture;
    if (t && t.frame && o.worldTransform) {
      const m = o.worldTransform, det = Math.abs(m.a * m.d - m.b * m.c);
      const px = t.frame.width * t.frame.height * det;
      all += px; nAll++;
      if (o.blendMode === 'add' || (o.parent && o.parent.blendMode === 'add')) { add += px; nAdd++; }
    }
    for (const ch of o.children ?? []) walk(ch, on);
  };
  walk(app.stage, true);
  const scr = app.renderer.width * app.renderer.height;
  return 'sprites ' + nAll + ' area ' + (all / scr).toFixed(2) + ' screens; additive ' + nAdd + ' area ' + (add / scr).toFixed(2) + ' screens';
})()`;
export default async function (api) {
  for (const [name, q] of CASES) for (const art of ['current', 'series']) {
    await api.goto(`${api.base}/gallery-art.html?view=perf&${q}&weaponArt=${art}&nohud=1`);
    await api.until(() => api.eval('window.__ready === true'), 30000, 'gallery ready');
    await api.wait(Number(process.env.WAIT ?? 25000));
    const s = [];
    for (let i = 0; i < 3; i++) { s.push(await api.eval(AREA)); await api.wait(1200); }
    console.log(`${name} · ${art}:\n  ${s.join('\n  ')}`);
  }
}
