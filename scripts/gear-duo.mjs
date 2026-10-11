// Two real clients in one frame (docs/rework/gear/LOG.md): a newcomer and a veteran in Hearthmere at the default camera,
// then the rank-up moment, then (GEAR_FIELD=1) the veteran in a rift with monsters and telegraphs.
// Needs the dev server with ENABLE_DEBUG=1 and WS_ALLOWED_ORIGINS for the client origin:
//   node scripts/shoot.mjs scripts/gear-duo.mjs --base=http://localhost:5221 --out=docs/rework/gear/shots --jpeg
// VET / NEWBIE choose classes, STAGE the veteran's showcase stage (default primal).
export default async function (api) {
  const vet = process.env.VET ?? 'mage', newbie = process.env.NEWBIE ?? 'ranger', stage = process.env.STAGE ?? 'primal';
  const tag = String(Math.floor(Math.random() * 1e4));
  const two = await api.newClient();
  await two.open({ name: 'Fresh' + tag, cls: newbie });
  await api.open({ name: 'Elder' + tag, cls: vet });
  const ch = await api.eval('__ui.get().zone?.channel');
  if (ch !== await two.eval('__ui.get().zone?.channel')) await two.cmd('channel', { n: ch });
  for (let i = 0; i < 7; i++) await api.debug('level', { n: 10 });
  await api.debug('showcase', { stage });
  await api.settle(300);
  const equip = async (filter) => {
    const ids = await api.eval(`(__ui.get().char.inventory || []).filter(i => i && (${filter})).map(i => i.id)`);
    for (const id of ids) await api.cmd('equip', { itemId: id });
  };
  // everything but the weapon first, so the weapon is the equip that lifts the rank (the moment below)
  await equip("i.kind !== 'weapon1h' && i.kind !== 'weapon2h' && i.kind !== 'ring'");
  const rings = await api.eval("(__ui.get().char.inventory || []).filter(i => i && i.kind === 'ring').map(i => i.id)");
  if (rings[0]) await api.cmd('equip', { itemId: rings[0], slot: 'ring1' });
  if (rings[1]) await api.cmd('equip', { itemId: rings[1], slot: 'ring2' });
  await api.settle(1200);
  // both step off the waypoint onto the open cobbles south of it, the newcomer ending beside the veteran
  await api.walk(0.25, 1, 430);
  await two.walk(-0.45, 1, 470);
  await api.settle(1800);
  await api.mouseAway();
  await equip("i.kind === 'weapon1h' || i.kind === 'weapon2h'");
  await api.wait(330);
  await api.shot('duo-rankup');
  await api.wait(3200);
  await api.shot('duo-town');
  // the veteran near the left edge of the screen: still spottable (column, wings, sigil, crown)
  const me = await api.eval('(() => { const m = __ui.get().me; return { x: m.x, y: m.y }; })()');
  await api.camera(me.x + 600, me.y + 20);
  await api.wait(800);
  await api.shot('duo-edge');
  await api.camera(null);
  if (process.env.GEAR_FIELD) {
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
    // keep moving (a moving hero does not auto-attack), so the guardian and the elites wind up their telegraphed
    // attacks on the veteran: the shots show the gear effects among real enemy warnings
    const dirs = [[1, 0.3], [-0.2, 1], [-1, -0.2], [0.3, -1], [1, 0.6], [-1, 0.4], [0.5, 1], [-0.6, -1], [1, -0.2], [-1, 0]];
    for (let i = 0; i < dirs.length; i++) {
      await api.eval(`__shoot.move = { x: ${dirs[i][0]}, y: ${dirs[i][1]} }; true`);
      await api.wait(650);
      await api.shot(`field-${i}`);
      await api.eval('__shoot.move = null; true');
      await api.wait(250);
    }
  }
  await two.close();
}
