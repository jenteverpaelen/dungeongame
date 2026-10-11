// Armour in the maker series: the morning checkpoint sheets (docs/rework/gear/ART-DIRECTION.md §6, shots-art/armour-*.jpg).
//   node scripts/shoot.mjs scripts/armour-shots.mjs --base=http://localhost:5291 --out=docs/rework/gear/shots-art --jpeg
// ARMOUR_SHOTS=board-warrior,icons-mage limits the set. Every sheet with "-previous" is the same page with the previous art.
const B = 'gallery-art.html?view=armour-board&k=1.45&colw=104&rowh=124';
const SHOTS = [
  // per-series armour boards: the seven series (columns) per class at normal / magic / rare
  ['armour-board-warrior', `${B}&classes=warrior&armourArt=series`],
  ['armour-board-ranger', `${B}&classes=ranger&armourArt=series`],
  ['armour-board-mage', `${B}&classes=mage&armourArt=series`],
  ['armour-board-warrior-previous', `${B}&classes=warrior&armourArt=current`],
  ['armour-board-mage-previous', `${B}&classes=mage&armourArt=current`],
  // the grade ladder on a series board (rare, Kindled, Fabled +10)
  ['armour-board-grades', `${B}&classes=warrior&crafts=rare,kindled,fabled&armourArt=series`],
  // the depth-wave armour and held bases on the heroes (rare)
  ['armour-board-newbases', `${B}&alt=1&crafts=rare&armourArt=series`],
  ['armour-board-newbases-previous', `${B}&alt=1&crafts=rare&armourArt=current`],
  // icons before / after (64 px), at 40 px, and the new bases
  ['armour-icons-warrior', 'gallery-art.html?view=armour-icons&cls=warrior&rar=rare&armourArt=series'],
  ['armour-icons-warrior-previous', 'gallery-art.html?view=armour-icons&cls=warrior&rar=rare&armourArt=current'],
  ['armour-icons-mage', 'gallery-art.html?view=armour-icons&cls=mage&rar=rare&armourArt=series'],
  ['armour-icons-mage-previous', 'gallery-art.html?view=armour-icons&cls=mage&rar=rare&armourArt=current'],
  ['armour-icons-ranger-40px', 'gallery-art.html?view=armour-icons&cls=ranger&rar=rare&px=40&armourArt=series'],
  ['armour-icons-newbases', 'gallery-art.html?view=armour-icons&cls=ranger&rar=rare&alt=1&armourArt=series'],
  ['armour-icons-newbases-mage', 'gallery-art.html?view=armour-icons&cls=mage&rar=rare&alt=1&armourArt=series'],
  ['armour-icons-newbases-previous', 'gallery-art.html?view=armour-icons&cls=ranger&rar=rare&alt=1&armourArt=current'],
  // a newcomer beside a veteran at the game camera (gallery), the Sets, a crowd
  ['armour-vs', 'gallery-art.html?view=gear-vs&all=1&vet=L60&newbie=L10&armourArt=series'],
  ['armour-vs-previous', 'gallery-art.html?view=gear-vs&all=1&vet=L60&newbie=L10&armourArt=current'],
  ['armour-sets', 'gallery-art.html?view=gear-sets&k=0.5&armourArt=series'],
  ['armour-crowd', 'gallery-art.html?view=perf&players=30&monsters=0&gear=mix&q=full&preset=high&armourArt=series'],
  ['armour-crowd-previous', 'gallery-art.html?view=perf&players=30&monsters=0&gear=mix&q=full&preset=high&armourArt=current'],
  // the depth-wave held bases in every series (own silhouettes)
  ['bases-held-rare', 'gallery-series.html?view=bases&rar=rare&px=84'],
  ['bases-held-normal', 'gallery-series.html?view=bases&rar=normal&px=84'],
];

export default async function (api) {
  const only = (process.env.ARMOUR_SHOTS ?? '').split(',').filter(Boolean);
  for (const [name, q] of SHOTS) {
    if (only.length && !only.some((o) => name === o || name.startsWith(o))) continue;
    await api.goto(`${api.base}/${q}`);
    await api.until(() => api.eval('window.__ready === true'), 60000, 'gallery ready');
    await api.wait(Number(process.env.ARMOUR_WAIT ?? (q.includes('view=perf') ? 14000 : 5000)));
    await api.shot(name);
  }
}
