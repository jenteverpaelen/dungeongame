// In-game gear progression shots (needs the dev server with ENABLE_DEBUG=1 and WS_ALLOWED_ORIGINS for the client):
//   node scripts/shoot.mjs scripts/gear-ingame.mjs --base=http://localhost:5221 --out=docs/rework/gear/shots --prefix=game-
// A fresh hero is shot as a newcomer, then levelled with debug ops, given the class Set + Legendaries and equipped.
export default async function (api) {
  const cls = process.env.GEAR_CLASS ?? 'mage';
  await api.open({ name: 'Gear' + Math.floor(Math.random() * 1e5), cls });
  await api.mouseAway();
  await api.shot(`${cls}-newcomer`);
  for (let i = 0; i < 7; i++) await api.debug('level', { n: 10 });
  await api.debug('set');
  await api.settle(400);
  const equipAll = async (filter = 'true') => {
    const ids = await api.eval(`(__ui.get().char.inventory || []).filter(i => i && (${filter})).map(i => i.id)`);
    for (const id of ids) await api.cmd('equip', { itemId: id });
  };
  await equipAll();
  await equipAll("i.kind === 'offhand' || i.set");          // the orb once the wand is in hand; any displaced Set piece
  await api.debug('rares', { n: 30 });                     // jewellery, belt and bracers a level-70 hero would wear
  await api.settle(300);
  for (const kind of ['neck', 'waist', 'wrists']) await equipAll(`i.kind === '${kind}'`);
  const rings = await api.eval("(__ui.get().char.inventory || []).filter(i => i && i.kind === 'ring').map(i => i.id)");
  if (rings[0]) await api.cmd('equip', { itemId: rings[0], slot: 'ring1' });
  if (rings[1]) await api.cmd('equip', { itemId: rings[1], slot: 'ring2' });
  await api.settle(1500);
  await api.mouseAway();
  await api.shot(`${cls}-veteran`);
  await api.panel('character'); await api.settle(1800);
  await api.shot(`${cls}-showcase`);
  await api.closePanels();
  await api.panel('inventory'); await api.settle(600);
  await api.hover('.eq-mainhand'); await api.settle(500);
  await api.shot(`${cls}-tooltip`);
  await api.closePanels();
  await api.panel('settings'); await api.settle(500);
  await api.shot(`${cls}-settings`);
  await api.closePanels();
}
