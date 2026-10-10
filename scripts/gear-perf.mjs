// Gear effects performance (visible page target, so requestAnimationFrame runs; hidden tabs would pause it):
//   node scripts/shoot.mjs scripts/gear-perf.mjs --base=http://localhost:5221 --out=.local/gear-shots
// 100 simulated heroes in the perf gallery (no monsters): old looks vs gear stages; reports fps / update ms / sprites.
const CASES = [
  ['100 heroes, legacy looks (before)', 'gallery-art.html?view=perf&players=100&monsters=0&gear=L70&legacy=1&q=full'],
  ['100 heroes, mixed stages, full', 'gallery-art.html?view=perf&players=100&monsters=0&gear=mix&q=full'],
  ['100 heroes, all Primal, full', 'gallery-art.html?view=perf&players=100&monsters=0&gear=primal&q=full'],
  ['100 heroes, all Primal, reduced', 'gallery-art.html?view=perf&players=100&monsters=0&gear=primal&q=reduced'],
  ['30 heroes, all Primal, full', 'gallery-art.html?view=perf&players=30&monsters=0&gear=primal&q=full'],
  ['30 heroes, legacy looks (before)', 'gallery-art.html?view=perf&players=30&monsters=0&gear=L70&legacy=1&q=full'],
];
export default async function (api) {
  for (const [name, q] of CASES) {
    await api.goto(`${api.base}/${q}`);
    await api.until(() => api.eval('window.__ready === true'), 30000, 'gallery ready');
    await api.wait(Number(process.env.GEAR_PERF_WAIT ?? 16000));
    const samples = [];
    for (let i = 0; i < 3; i++) { samples.push(await api.eval('window.__info + " hidden=" + document.hidden')); await api.wait(1200); }
    console.log(`${name}:\n  ${samples.join('\n  ')}`);
  }
}
