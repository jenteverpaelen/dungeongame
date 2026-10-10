// Gear visual progression screenshots (docs/rework/gear/shots). Gallery pages only (no server needed):
//   node scripts/shoot.mjs scripts/gear-shots.mjs --base=http://localhost:5221 --out=docs/rework/gear/shots
// GEAR_SHOTS=ladder,vs limits the set; GEAR_WAIT=ms changes the settle time (effects need a moment to fill in).
const SHOTS = [
  ['ladder', 'gallery-art.html?view=gear-ladder&nohud=1'],
  ['ladder-walk', 'gallery-art.html?view=gear-ladder&anim=walk&nohud=1'],
  ['vs-warrior', 'gallery-art.html?view=gear-vs&cls=warrior&nohud=1'],
  ['vs-all', 'gallery-art.html?view=gear-vs&all=1&dx=70&dy=-90&nohud=1'],
  ['vs-closeup', 'gallery-art.html?view=gear-vs&all=1&zoom=2.3&yaw=24&dx=70&dy=-90&labels=1&nohud=1'],
  ['vs-walk', 'gallery-art.html?view=gear-vs&all=1&walk=1&nohud=1'],
  ['sets', 'gallery-art.html?view=gear-sets&nohud=1'],
  ['icons', 'gallery-art.html?view=icons&nohud=1'],
];

export default async function (api) {
  const only = (process.env.GEAR_SHOTS ?? '').split(',').filter(Boolean);
  const settle = Number(process.env.GEAR_WAIT ?? 2600);
  // ad-hoc: GEAR_URL="gallery-art.html?..." GEAR_NAME=foo
  const list = process.env.GEAR_URL ? [[process.env.GEAR_NAME ?? 'adhoc', process.env.GEAR_URL]] : SHOTS;
  for (const [name, q] of list) {
    if (only.length && !only.includes(name)) continue;
    await api.goto(`${api.base}/${q}`);
    await api.until(() => api.eval('window.__ready === true'), 30000, 'gallery ready');
    await api.wait(settle);
    await api.shot(name);
  }
}
