// Real game (authoritative server, shipped data): the Skills window with a fresh and a debug-levelled character,
// commands round-trip through the server (tier purchase, refund, primary unchanged). Needs ENABLE_DEBUG=1.
//   node scripts/shoot.mjs scripts/shots/depth-ingame.mjs --base=http://localhost:5241 --out=docs/rework/depth/shots --jpeg
export default async function (api) {
  for (const [w, h] of [[1920, 1080], [1366, 768]]) {
    await api.viewport(w, h);
    await api.open({ name: 'Depth' + w + Math.floor(Math.random() * 1e4), cls: 'warrior' });
    await api.debug('level', { n: 39 });
    await api.settle(600);
    const tier = await api.cmd('skillTier', { skill: 'whirlwind' });
    const node = await api.cmd('skillNode', { skill: 'whirlwind', node: 'x', delta: 1 });
    await api.panel('skills');
    await api.mouseAway();
    const scroll = await api.scrollers();
    const box = await api.eval('(() => { const r = document.querySelector(".pn-root .pn")?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; })()');
    const char = await api.eval('({ level: __ui.get().char.level, sp: __ui.get().char.skillPoints, tiers: __ui.get().char.skills.tiers, nodes: __ui.get().char.skills.nodes })');
    console.log(`ingame ${w}x${h} panel=${JSON.stringify(box)} scrollers=${JSON.stringify(scroll)} tier=${JSON.stringify(tier)} node=${JSON.stringify(node)} char=${JSON.stringify(char)}`);
    await api.shot(`ingame-skills-${w}`);
    const reset = await api.cmd('skillReset', {});
    const after = await api.eval('({ sp: __ui.get().char.skillPoints, tiers: __ui.get().char.skills.tiers })');
    console.log(`ingame reset=${JSON.stringify(reset)} after=${JSON.stringify(after)}`);
    await api.closePanels();
  }
}
