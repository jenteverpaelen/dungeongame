// In-game evidence for the weapon series preview (docs/rework/gear/ART-DIRECTION.md §7–§8). Needs the dev server with
// ENABLE_DEBUG=1 and WS_ALLOWED_ORIGINS for the client origin:
//   node scripts/shoot.mjs scripts/series-ingame.mjs --base=http://localhost:5291 --out=docs/rework/gear/shots-art --prefix=game- --jpeg
// ART=series|current (the ?weaponArt= switch), VET / NEWBIE classes, STAGE the veteran's showcase stage (primal = Fabled
// main hand), WEAPON=rare swaps the veteran's weapon for an item-level-70 rare of a sampled family, LEG=<id> equips that
// class legendary, FIGHT=0 skips the Faultline part.
export default async function (api) {
  const art = process.env.ART ?? 'series', q = `&weaponArt=${art}`;
  const vet = process.env.VET ?? 'mage', newbie = process.env.NEWBIE ?? 'warrior', stage = process.env.STAGE ?? 'primal';
  const tag = `${art}-${vet}-${process.env.WEAPON ?? process.env.LEG ?? stage}`;
  const two = await api.newClient();
  await two.open({ name: 'Fresh' + Math.floor(Math.random() * 1e5), cls: newbie, query: q });
  await api.open({ name: 'Elder' + Math.floor(Math.random() * 1e5), cls: vet, query: q });
  const ch = await api.eval('__ui.get().zone?.channel');
  if (ch !== await two.eval('__ui.get().zone?.channel')) await two.cmd('channel', { n: ch });
  for (let i = 0; i < 7; i++) await api.debug('level', { n: 10 });
  await api.debug('showcase', { stage });
  await api.settle(300);
  const equip = async (filter) => {
    const ids = await api.eval(`(__ui.get().char.inventory || []).filter(i => i && (${filter})).map(i => i.id)`);
    for (const id of ids) await api.cmd('equip', { itemId: id });
  };
  await equip("i.kind !== 'ring'");
  const rings = await api.eval("(__ui.get().char.inventory || []).filter(i => i && i.kind === 'ring').map(i => i.id)");
  if (rings[0]) await api.cmd('equip', { itemId: rings[0], slot: 'ring1' });
  if (rings[1]) await api.cmd('equip', { itemId: rings[1], slot: 'ring2' });
  if (process.env.WEAPON === 'rare') {
    await api.debug('rares', { n: 40 });
    await api.settle(300);
    await equip("['sword', 'axe', 'bow', 'staff', 'wand'].includes(i.base) && i.rarity === 'rare' && !globalThis.__eq && (globalThis.__eq = 1)");
  }
  if (process.env.LEG) {
    await api.debug('legendaries');
    await api.settle(300);
    await equip(`i.legendary && i.legendary.power === ${JSON.stringify(process.env.LEG)}`);
  }
  await api.settle(1200);
  const weapon = await api.eval("(() => { const w = __ui.get().char.equipment?.mainhand; return w && { base: w.base, rarity: w.rarity, ilvl: w.ilvl, ancient: w.ancient, upgrade: w.upgrade, legendary: w.legendary?.power }; })()");
  console.log('veteran weapon', JSON.stringify(weapon));
  // both step off the waypoint onto the open cobbles south of it, the newcomer beside the veteran
  await api.walk(0.25, 1, 430);
  await two.walk(-0.45, 1, 470);
  await api.settle(2200);
  await api.mouseAway();
  await api.shot(`${tag}-town`);
  // the bag and the item card
  await api.panel('inventory'); await api.settle(700);
  await api.hover('.eq-mainhand'); await api.settle(600);
  await api.shot(`${tag}-card`);
  await api.mouseAway(); await api.settle(300); await api.closePanels(); // leave the slot first, so its tooltip closes
  if (process.env.SETTINGS) { await api.panel('settings'); await api.settle(400); await api.clickText('button, [role=tab], .so-nav *', 'Display').catch(() => {}); await api.settle(500); await api.shot(`${tag}-settings`); await api.closePanels(); }
  if (process.env.FIGHT === '0') { await two.close(); return; }
  // a fight: the Faultline from the obelisk, the guardian and elites, the veteran standing still so it attacks
  const ob = await api.eval("(() => { const n = __game.world.map.town.npcs.find(n => n.role === 'obelisk'); return n && { x: n.x, y: n.y }; })()");
  await api.walkTo(ob.x, ob.y + 60, 70, 40000);
  const open = await api.cmd('riftOpen', { difficulty: 0 });
  if (!open?.ok) console.warn('riftOpen', open?.err);
  const enter = await api.cmd('riftEnter', {});
  if (!enter?.ok) console.warn('riftEnter', enter?.err);
  await api.until(() => api.eval("__ui.get().zone?.kind === 'rift' && Boolean(__game.world.map)"), 30000, 'rift');
  await api.settle(2500);
  await api.debug('infhp');
  await api.debug('boss');
  await api.debug('elite');
  await api.debug('elite');
  // let the pack come in range: a hero that stands still attacks what is near
  await api.wait(4500);
  for (let i = 0; i < 8; i++) { await api.wait(260); await api.shot(`${tag}-fight-${i}`); }
  // the same fight closer (camera zoom 1.6 of the player setting; the default camera is 0.75)
  await api.eval('__prefs.set({ cameraZoom: 1.6 }); true'); await api.settle(700);
  for (let i = 0; i < 6; i++) { await api.wait(230); await api.shot(`${tag}-fight-zoom-${i}`); }
  await api.eval('__prefs.set({ cameraZoom: 0.75 }); true'); await api.settle(400);
  // ground loot after the kills
  await api.wait(2500);
  await api.shot(`${tag}-loot`);
  await two.close();
}
