// Frozen-frame globe captures for the look-equivalence check (docs/rework/PERF.md §4.1): fixed life / resource levels,
// every globe animation pinned at clock T (DOM globes: all CSS animations paused at currentTime = T; canvas globes:
// window.__orbClock = T), PNG crops of both globes. env: TAG, TS (comma list of seconds), HPF, RESF, LEVEL, NOGRAIN
import fs from 'node:fs';
const TAG = process.env.TAG ?? 'orb', TS = (process.env.TS ?? '0,1.7,5.3,12.9').split(',').map(Number);
const HPF = Number(process.env.HPF ?? 0.62), RESF = Number(process.env.RESF ?? 0.37);
export default async function (a) {
  await a.open({ name: 'Orb' + Math.floor(Math.random() * 90000 + 10000), cls: process.env.CLS ?? 'warrior' });
  if (process.env.LEVEL) { await a.debug('level', { n: Number(process.env.LEVEL) }); await a.wait(1200); }
  await a.mouseAway();
  if (process.env.NOGRAIN) await a.eval("(() => { const st = document.createElement('style'); st.textContent = '.globe-grain { display: none !important; }'; document.head.appendChild(st); return true; })()");
  await a.eval(`(() => { const s = __ui.get(); __ui.set({ me: { ...s.me, hp: s.me.mhp * ${HPF}, res: s.me.mres * ${RESF} } }); window.__uiSet = __ui.set.bind(__ui); __ui.set = () => {}; return true; })()`);
  await a.wait(1500); // level transitions finish
  fs.mkdirSync(a.out, { recursive: true });
  for (const T of TS) {
    await a.eval(`(() => { window.__orbClock = ${T}; for (const an of document.getAnimations()) { an.pause(); an.currentTime = ${T * 1000}; } return true; })()`);
    await a.wait(400);
    for (const kind of ['life', 'res']) {
      const box = await a.eval(`(() => { const r = document.querySelector('.globe-${kind}').getBoundingClientRect(); return { x: Math.floor(r.x) - 2, y: Math.floor(r.y) - 2, width: Math.ceil(r.width) + 4, height: Math.ceil(r.height) + 4, scale: 1 }; })()`);
      const shot = await a.cdp('Page.captureScreenshot', { format: 'png', clip: box });
      fs.writeFileSync(`${a.out}/${TAG}-${kind}-${T}.png`, Buffer.from(shot.data, 'base64'));
    }
  }
  console.log('captured', TS.join(','), await a.eval('JSON.stringify({ w: innerWidth, h: innerHeight, globe: document.querySelector(".globe-life").getBoundingClientRect().width })'));
}
