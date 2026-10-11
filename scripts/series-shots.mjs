// Weapon series sample sheets (docs/rework/gear/ART-DIRECTION.md, shots in docs/rework/gear/shots-art). Gallery only:
//   node scripts/shoot.mjs scripts/series-shots.mjs --base=http://localhost:5291 --out=docs/rework/gear/shots-art --jpeg
// SERIES_SHOTS=sheet,hero limits the set; SERIES_URL="gallery-series.html?..." SERIES_NAME=foo shoots one page.
const SHOTS = [
  // the checkpoint sheet: CURRENT vs NEW at 64 px, NEW at 40 px and as a silhouette, per family x series
  ['sheet-levelling', 'gallery-series.html?view=sheet'],
  ['sheet-rare', 'gallery-series.html?view=sheet&rar=rare'],
  // the drawings large enough to judge
  ['zoom-levelling', 'gallery-series.html?view=zoom&px=150'],
  ['zoom-rare', 'gallery-series.html?view=zoom&rar=rare&px=150'],
  // rarity inside one series, the bespoke legendaries by stage, the grade accents
  ['rarity-kilnfolk', 'gallery-series.html?view=rarity&s=1&lpx=150'],
  ['rarity-warden', 'gallery-series.html?view=rarity&s=3&lpx=150&gf=axe'],
  // hero scale (default game camera): CURRENT vs NEW side by side (gallery overlay on the rig's weapon transform)
  ['hero-levelling', 'gallery-series.html?view=hero'],
  ['hero-rare', 'gallery-series.html?view=hero&rar=rare'],
  // through the real gear rig (series registered with weaponDrawing.ts in this page only)
  ['rig-icons-rare', 'gallery-series.html?view=rig&rar=rare'],
  ['rig-hero-rare', 'gallery-series.html?view=rig-hero&rar=rare'],
  ['rig-hero-levelling', 'gallery-series.html?view=rig-hero'],
  // measurements
  ['metrics', 'gallery-series.html?view=metrics'],
  ['extents', 'gallery-series.html?view=extents'],
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
