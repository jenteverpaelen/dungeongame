// Gear effects performance (visible page target, so requestAnimationFrame runs; hidden tabs would pause it):
//   node scripts/shoot.mjs scripts/gear-perf.mjs --base=http://localhost:5221 --out=.local/gear-shots
// Simulated heroes in the perf gallery (no monsters, every hero a unique look, 'scene' bake mode): old looks vs gear
// stages and quality levels. Waits until the budgeted bakes are done (100 unique looks take ~30-40 s), then samples.
const CASES = [
  ['30 heroes, legacy looks (before)', 'players=30&gear=L70&legacy=1&q=full', 15000],
  ['30 heroes, all Primal, full', 'players=30&gear=primal&q=full', 15000],
  ['30 heroes, mixed stages, full', 'players=30&gear=mix&q=full', 15000],
  ['100 heroes, legacy looks (before)', 'players=100&gear=L70&legacy=1&q=full', 45000],
  ['100 heroes, mixed stages, full', 'players=100&gear=mix&q=full', 45000],
  ['100 heroes, all Primal, full', 'players=100&gear=primal&q=full', 45000],
  ['100 heroes, all Primal, reduced', 'players=100&gear=primal&q=reduced', 45000],
];
export default async function (api) {
  const only = process.env.PERF_ONLY ? new RegExp(process.env.PERF_ONLY) : null;
  for (const [name, q, waitMs] of CASES) {
    if (only && !only.test(name)) continue;
    await api.goto(`${api.base}/gallery-art.html?view=perf&monsters=0&${q}`);
    await api.until(() => api.eval('window.__ready === true'), 30000, 'gallery ready');
    await api.wait(Number(process.env.GEAR_PERF_WAIT ?? waitMs));
    const samples = [];
    for (let i = 0; i < 3; i++) { samples.push(await api.eval('window.__info + " hidden=" + document.hidden')); await api.wait(1500); }
    console.log(`${name}:\n  ${samples.join('\n  ')}`);
  }
}
