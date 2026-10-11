// World states before/after in later zones (docs/rework/quests/DESIGN.md §7). The character is unlocked with the debug
// `story` op (every story quest claimed → every state on), so "after" is real; the "before" frame is a client-only
// preview that rewinds one quest in the local copy of the save so the renderer shows the earlier phase (no command).
//   node scripts/shoot.mjs scripts/quest-states.mjs --base=http://localhost:5251 --out=docs/rework/quests/shots --jpeg=80
export default async function (a) {
  await a.open({ name: 'QuestStates' + Math.floor(Math.random() * 1e4), cls: 'mage' });
  await a.cmd('debug', { op: 'infhp' });
  await a.cmd('debug', { op: 'story', level: 50 }); await a.settle(800);
  const wp = await a.eval('(() => { const n = __game.world.map.town.npcs.find(n => n.role === "waypoint"); return { x: n.approach[0], y: n.approach[1] }; })()');
  const travel = async (zone) => {
    if (await a.eval('__game.world.map?.zone !== "hearthmere"')) { await a.cmd('travel', { zone: 'hearthmere' }); await a.until(() => a.eval('__game.world.map?.zone === "hearthmere" && !!__ui.get().me'), 30000, 'town'); await a.settle(1500); }
    await a.cmd('debug', { op: 'warp', x: Math.round(wp.x), y: Math.round(wp.y) }); await a.settle(500);
    const r = await a.cmd('travel', { zone }); if (!r?.ok) throw Error(zone + ' ' + JSON.stringify(r));
    await a.until(() => a.eval(`__game.world.map?.zone === ${JSON.stringify(zone)} && !!__ui.get().me`), 30000, zone); await a.settle(2500);
  };
  /** Client-only rewind of one quest in the local save copy (visual preview of the earlier phase). */
  const rewind = (quest, step) => a.eval(`(() => { const c = structuredClone(__ui.get().char); c.quests[${JSON.stringify(quest)}] = { ...c.quests[${JSON.stringify(quest)}], step: ${step}, claimed: false }; __ui.set({ char: c }); return true; })()`);
  const restore = (save) => a.eval(`(() => { __ui.set({ char: ${save} }); return true; })()`);
  const shotAt = async (x, y, name) => { await a.camera(x, y); await a.settle(900); await a.shot(name); };
  // [zone, quest, step that is rewound to, world state, shot name]; the camera uses the same point as the reveal pan.
  const pairs = [
    ['rillwake_crossing', 'high_water', 2, 'rw_signal', 'rillwake-signal-fire'],
    ['bracken_sluice', 'under_spillway', 3, 'br_drained', 'bracken-basin'],
    ['cinderwash_kilns', 'untended_fires', 3, 'cw_quiet', 'cinderwash-upper-kilns'],
    ['kilnwatch_crown', 'last_draw', 3, 'kw_cold', 'kilnwatch-crown-furnace'],
    ['sablefen_causeway', 'broken_toll', 2, 'sf_chain', 'sablefen-chain-winch'],
    ['shiverline_escarpment', 'open_beacon', 2, 'sl_beacon', 'shiverline-beacon'],
    ['beaconbreak_ward', 'ward_gate', 2, 'bw_open', 'beaconbreak-west-gate'],
  ];
  // ONLY=<comma-separated shot names> limits the run.
  const only = process.env.ONLY?.split(',');
  for (const [zone, quest, step, key, name] of pairs) {
    if (only && !only.includes(name)) continue;
    await travel(zone);
    const p = await a.eval(`__game.scene.phases.revealPoint(${JSON.stringify(key)})`);
    if (!p) throw Error('no reveal point for ' + key);
    const saved = await a.eval('JSON.stringify(__ui.get().char)');
    await shotAt(p.x, p.y, `state-${name}-after`);
    await rewind(quest, step); await a.settle(600); await shotAt(p.x, p.y, `state-${name}-before-preview`);
    await restore(saved); await a.camera(null);
  }
}
