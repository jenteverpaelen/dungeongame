// A/B frame rate of the weapon series preview against the current art (interleaved, same minutes, visible page target):
//   node scripts/shoot.mjs scripts/series-perf.mjs --base=http://localhost:5291 --out=.local/series-perf
// The perf gallery: 100 simulated heroes, no monsters, every hero a unique look ('scene' bake mode), full gear effects.
const CASES = [
  ['100 heroes, mixed stages', 'players=100&gear=mix&q=full'],
  ['100 heroes, Fabled stage', 'players=100&gear=primal&q=full'],
];
export default async function (api) {
  const rounds = Number(process.env.ROUNDS ?? 2), waitMs = Number(process.env.WAIT ?? 40000);
  for (let r = 0; r < rounds; r++) for (const [name, q] of CASES) for (const art of r % 2 ? ['series', 'current'] : ['current', 'series']) {
    await api.goto(`${api.base}/gallery-art.html?view=perf&monsters=0&${q}&weaponArt=${art}&nohud=1`);
    await api.until(() => api.eval('window.__ready === true'), 30000, 'gallery ready');
    await api.wait(waitMs);
    const samples = [];
    for (let i = 0; i < 4; i++) { samples.push(await api.eval('window.__info + " hidden=" + document.hidden')); await api.wait(1500); }
    console.log(`round ${r + 1} · ${name} · ${art}:\n  ${samples.join('\n  ')}`);
  }
}
