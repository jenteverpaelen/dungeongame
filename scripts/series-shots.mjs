// Weapon series sample sheets (docs/rework/gear/ART-DIRECTION.md, shots in docs/rework/gear/shots-art). Gallery only:
//   node scripts/shoot.mjs scripts/series-shots.mjs --base=http://localhost:5291 --out=docs/rework/gear/shots-art --jpeg
// SERIES_SHOTS=sheet,hero limits the set; SERIES_URL="gallery-series.html?..." SERIES_NAME=foo shoots one page.
const SHOTS = [
  ['sheet-levelling', 'gallery-series.html?view=sheet'],
  ['sheet-rare', 'gallery-series.html?view=sheet&rar=rare'],
  ['zoom-levelling', 'gallery-series.html?view=zoom'],
  ['zoom-rare', 'gallery-series.html?view=zoom&rar=rare'],
  ['rarity-kilnfolk', 'gallery-series.html?view=rarity&s=1'],
  ['rarity-millwright', 'gallery-series.html?view=rarity&s=0&gf=axe'],
  ['hero-levelling', 'gallery-series.html?view=hero'],
  ['hero-rare', 'gallery-series.html?view=hero&rar=rare'],
  ['metrics', 'gallery-series.html?view=metrics'],
];

export default async function (api) {
  const only = (process.env.SERIES_SHOTS ?? '').split(',').filter(Boolean);
  const settle = Number(process.env.SERIES_WAIT ?? 1800);
  const list = process.env.SERIES_URL ? [[process.env.SERIES_NAME ?? 'adhoc', process.env.SERIES_URL]] : SHOTS;
  for (const [name, q] of list) {
    if (only.length && !only.includes(name)) continue;
    await api.goto(`${api.base}/${q}`);
    await api.until(() => api.eval('window.__ready === true'), 60000, 'gallery ready');
    await api.wait(settle);
    await api.shot(name);
  }
}
