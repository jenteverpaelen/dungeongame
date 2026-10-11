// Skills window evidence for the depth foundation (docs/rework/depth): the dev panels gallery with a presentation
// fixture (no server). Usage (Vite dev server running):
//   node scripts/shoot.mjs scripts/shots/depth-skills.mjs --base=http://localhost:5241 --out=docs/rework/depth/shots --jpeg
// Options via env: DEPTH_SHOTS=baseline (current shipped data only).
export default async function (api) {
  const views = process.env.DEPTH_SHOTS === 'baseline'
    ? [['baseline-skills', 's=skills&still=1']]
    : [
      ['skills-6', 's=skills&still=1'],
      ['skills-12', 's=skills&still=1&depth=12'],
      ['skills-20', 's=skills&still=1&depth=20&page=1'],
      ['tree', 's=skills&still=1&depth=12&tab=tree&sel=whirlwind'],
      ['runes-5', 's=skills&still=1&depth=12&sel=fx_warrior_1'],
      ['passives', 's=skills&still=1&depth=12&passive=0'],
      ['tree-mage', 's=skills&still=1&depth=12&tab=tree&sel=meteor&class=mage'],
      ['primary2-ranger', 's=skills&still=1&depth=12&sel=fx_ranger_primary2&class=ranger'],
      ['passives-18', 's=skills&still=1&depth=20&passive=1&class=mage'],
      ['casting', 's=skills&still=1&depth=12&tab=cast&sel=whirlwind'],
    ];
  for (const [w, h] of [[1920, 1080], [1366, 768]]) {
    await api.viewport(w, h);
    for (const [name, q] of views) {
      await api.goto(`${api.base}/gallery-panels.html?${q}`);
      await api.until(() => api.eval('Boolean(document.querySelector(".pn-root .sk-body"))'), 20000, 'skills panel');
      await api.settle(700);
      const scroll = await api.scrollers();
      const box = await api.eval('(() => { const r = document.querySelector(".pn-root .pn")?.getBoundingClientRect(); return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null; })()');
      console.log(`${name} ${w}x${h} panel=${JSON.stringify(box)} scrollers=${JSON.stringify(scroll)}`);
      await api.shot(`${name}-${w}`);
    }
  }
}
