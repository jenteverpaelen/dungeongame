// First hour of the reworked quests in a real browser (docs/rework/quests/LOG.md "Evidence"): a fresh character walks,
// talks, accepts several quests at once, finishes them in one outing, sees the world change and turns in.
//   node scripts/shoot.mjs scripts/quest-hour.mjs --base=http://localhost:5251 --out=docs/rework/quests/shots --jpeg=80
// Debug helpers used (ENABLE_DEBUG=1 test server only): infinite HP so fights cannot end the walk-through, and `warp`
// for a few long empty walks after the same road was walked for real once. Every quest action is the real command path:
// E on people and objects, buttons in the dialogue window, the server deciding.
export default async function (a) {
  const PART = process.env.PART ?? 'all';
  const log = (...m) => console.log('[hour]', ...m);
  const spot = (id) => a.eval(`(() => { const s = __game.scene.statics.find(s => s.npcId === ${JSON.stringify(id)}); return s && !s.hidden ? { x: s.x, y: s.y } : null; })()`);
  const q = (id) => a.eval(`(() => { const c = __ui.get().char; return c.quests?.[${JSON.stringify(id)}] ?? null; })()`);
  const go = async (id, near = 70) => { const p = await spot(id); if (!p) throw Error('no contact ' + id); const r = await a.walkTo(p.x, p.y + 30, near, 60000); log('walked to', id, Math.round(r.d)); return p; };
  const warpTo = async (x, y) => { const free = await a.eval(`(() => { const cw = __game.world.collision; for (let r = 0; r < 400; r += 20) for (let k = 0; k < 16; k++) { const px = ${x} + Math.cos(k * Math.PI / 8) * r, py = ${y} + Math.sin(k * Math.PI / 8) * r; if (cw.isFree(px, py, 22)) return { x: Math.round(px), y: Math.round(py) }; } return null; })()`); await a.cmd('debug', { op: 'warp', x: free.x, y: free.y }); await a.settle(900); };
  const warpNear = async (id) => { const p = await spot(id); await warpTo(p.x, p.y + 140); };
  const e = async () => { await a.settle(500); await a.key('KeyE'); await a.wait(1200); await a.settle(300); };
  /** E on a person must open the conversation; one retry covers a key landing in the same frame as the arrival. */
  const talk = async () => { await e(); if (!(await a.eval('!!__ui.get().panels.dialogue'))) await e(); };
  /** E on a hold-to-repair object: retry once if no hold bar appeared, then wait for it to finish. */
  const repair = async (shotName) => {
    await e(); if (!(await a.eval('!!__ui.get().hold'))) await e();
    await a.wait(700); if (shotName) await a.shot(shotName);
    await a.until(() => a.eval('!__ui.get().hold'), 8000, 'hold done'); await a.wait(600);
  };
  // Fight like a player: walk up to the nearest living monster around (x, y) and let the auto-attack work.
  const nearestMob = (x, y, name = '') => a.eval(`(() => { let best = null, bd = 1e9; for (const e of __game.world.entities.values()) { if (e.kind !== 'mob' || e.dying) continue; if (${JSON.stringify(name)} && !(e.desc.n ?? '').includes(${JSON.stringify(name)})) continue; const d = Math.hypot(e.x - ${x}, e.y - ${y}); if (d < bd && d < 1000) { bd = d; best = { x: e.x, y: e.y }; } } return best; })()`);
  const fightAt = async (x, y, check, ms = 120000, name = '') => {
    await a.walkTo(x, y, 90, 30000); const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await check()) return true; const m = (name && await nearestMob(x, y, name)) || await nearestMob(x, y); if (m) await a.walkTo(m.x, m.y, 55, 2500); else await a.wait(500); await a.wait(200); }
    return false;
  };
  const press = (title, label = '') => a.eval(`(() => { const row = [...document.querySelectorAll(".dlg-quest")].find(e => e.textContent.includes(${JSON.stringify(title)})); const b = row && [...row.querySelectorAll(".btn")].find(b => b.textContent.includes(${JSON.stringify(label)}) && !b.disabled); b?.click(); return !!b; })()`);
  const enc = (id) => a.eval(`(() => { const e = __game.world.map.adventure.encounters.find(e => e.id === ${JSON.stringify(id)}); return { x: e.x, y: e.y }; })()`);

  // NAME=<existing character> START=<section> resumes a saved character (1 town→Orren, 2 outing, 3 turn-in, 4 second outing, 5 journal/board, 6 Bracken).
  const START = Number(process.env.START ?? 1), at = (n) => START <= n;
  await a.open({ name: process.env.NAME ?? 'QuestHour' + Math.floor(Math.random() * 1e4), cls: 'warrior' });
  await a.cmd('debug', { op: 'infhp' });
  // A resumed character first gets the offline report: claim it so it does not cover the world.
  if (await a.eval('[...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Claim")')) { await a.clickText('button', 'Claim'); await a.settle(600); }
  await a.mouseAway();
  if (START === 1) await a.shot('01-town-next-story-step');
  if (START > 1 && await a.eval('__game.world.map.zone === "hearthmere"')) {
    const w = await a.eval('(() => { const n = __game.world.map.town.npcs.find(n => n.role === "waypoint"); return { x: n.approach[0], y: n.approach[1] }; })()');
    await a.cmd('debug', { op: 'warp', x: Math.round(w.x), y: Math.round(w.y) }); await a.settle(400);
    await a.cmd('travel', { zone: START >= 6 ? 'rillwake_crossing' : 'rillwake_crossing' }); await a.until(() => a.eval('__game.world.map?.zone === "rillwake_crossing" && !!__ui.get().me'), 30000, 'rillwake'); await a.settle(2000); await a.cmd('debug', { op: 'infhp' });
  }

if (at(1)) {
    // To Rillwake by the waypoint, like a player.
  const wp = await a.eval('(() => { const n = __game.world.map.town.npcs.find(n => n.role === "waypoint"); return { x: n.approach[0], y: n.approach[1] }; })()');
  await a.walkTo(wp.x, wp.y, 40, 40000);
  log('travel', JSON.stringify(await a.cmd('travel', { zone: 'rillwake_crossing' })));
  await a.until(() => a.eval('__game.world.map?.zone === "rillwake_crossing" && !!__ui.get().me'), 30000, 'rillwake');
  await a.settle(2500); await a.cmd('debug', { op: 'infhp' }); // the test toggle resets on travel
  await a.shot('02-camp-orren-story-crest');

  // Orren: the tutorial first, then two quests at once from the same hub.
  await go('tender'); await talk();
  await a.mouseAway(); await a.shot('03-orren-dialogue-offers');
  if (await press('A Foot on the Road', 'Accept')) {
    await a.settle(600); await a.closePanels();
    const road = await enc('road');
    await fightAt(road.x, road.y, async () => (await q('first_road'))?.step === 1, 90000);
    await go('tender'); await talk(); await press('A Foot on the Road', 'Report back'); await a.settle(900);
    log('first_road', JSON.stringify(await q('first_road')));
    if (!(await a.eval('!!__ui.get().panels.dialogue'))) { await go('tender'); await talk(); }
  }
  await a.mouseAway(); await a.shot('04-orren-two-offers');
  await press('The Silent Wheel', 'Accept'); await a.settle(700);
  log('dialogue open after the first accept (another offer left):', await a.eval('!!__ui.get().panels.dialogue'));
  await press('The Lost Survey Party', 'Accept'); await a.settle(700);
  log('dialogue open after the last accept:', await a.eval('!!__ui.get().panels.dialogue'));
  log('accepted', JSON.stringify(await q('silent_wheel')), JSON.stringify(await q('lost_survey')));
  await a.closePanels(); await a.mouseAway();
  await a.shot('05-tracker-two-quests');
}
    if (PART === '1') return;

if (at(2)) {
    // One outing: the cart (E acts at once, reading card, no window).
  await go('cart'); await e();
  log('cart', JSON.stringify(await q('silent_wheel')), 'dialogue open:', await a.eval('!!__ui.get().panels.dialogue'));
  await a.shot('06-cart-reading-card-no-window');
  // The chapel journal on the way (one of the two survey records).
  await warpNear('party_journal'); await go('party_journal'); await e();
  log('journal', JSON.stringify(await q('lost_survey')));
  await a.shot('07-chapel-journal-record');
  // Siltroot in the mill yard.
  const mill = await enc('mill');
  await warpNear('cart');
  await fightAt(mill.x, mill.y + 120, async () => (await q('silent_wheel'))?.step >= 2, 240000, 'Siltroot');
  log('siltroot', JSON.stringify(await q('silent_wheel')));
  await go('ledger'); await e(); log('ledger', JSON.stringify(await q('silent_wheel')));
  await go('mill_brake'); await repair('08-brake-hold-bar');
  await a.shot('09-wheel-turns-reveal');
  await a.wait(2600);
  log('brake', JSON.stringify(await q('silent_wheel')));
}
    if (PART === '2') return;

if (at(3)) {
    // Orren walked up to the mill: turn in with the reward pick.
  await go('tender'); await talk();
  await a.mouseAway(); await a.shot('10-orren-at-mill-reward-pick');
  await a.eval('(() => { const r = [...document.querySelectorAll(".dlg-pick input")][1]; r?.click(); return true; })()'); await a.settle(300);
  await press('The Silent Wheel', 'Report back'); await a.settle(1000);
  log('claimed', JSON.stringify(await q('silent_wheel')), 'dialogue open (follow-up here):', await a.eval('!!__ui.get().panels.dialogue'));
  if (!(await a.eval('!!__ui.get().panels.dialogue'))) { await go('tender'); await talk(); }
  await press('High Water', 'Accept'); await a.settle(700);
  log('high_water', JSON.stringify(await q('high_water')));
  await a.closePanels(); await a.mouseAway(); await a.shot('11-mill-hub-tracker');
}
    if (PART === '3') return;

if (at(4)) {
    // Second outing from the mill: overlook (marker, alarm, fire), the survey camp, Brackjaw, Wenna, back to Orren.
  await warpNear('survey'); await go('survey'); await e(); log('survey', JSON.stringify(await q('high_water')));
  await e(); // the alarm starts straight from the marker because the quest wants it
  const look = await enc('overlook');
  await fightAt(look.x, look.y, async () => (await q('high_water'))?.step >= 2, 180000);
  log('alarm', JSON.stringify(await q('high_water')));
  await go('overlook_fire'); await repair('12-signal-fire-hold');
  await a.shot('13-signal-fire-burning');
  log('fire', JSON.stringify(await q('high_water')));
  await warpNear('party_camp'); await go('party_camp'); await e(); log('camp', JSON.stringify(await q('lost_survey')));
  const brack = await enc('brackjaw');
  await warpTo(brack.x + 300, brack.y + 200);
  await fightAt(brack.x, brack.y, async () => (await q('lost_survey'))?.step >= 2, 240000, 'Brackjaw');
  log('brackjaw', JSON.stringify(await q('lost_survey')));
  await warpNear('wenna'); await go('wenna'); await a.shot('14-wenna-appears'); await talk();
  await press('The Lost Survey Party', 'Discuss'); await a.settle(800); await a.closePanels();
  log('wenna', JSON.stringify(await q('lost_survey')));
  await go('tender'); await talk(); await a.mouseAway(); await a.shot('15-orren-two-turn-ins');
  await press('High Water', 'Report back'); await a.settle(900);
  if (!(await a.eval('!!__ui.get().panels.dialogue'))) { await go('tender'); await talk(); }
  await press('The Lost Survey Party', 'Report back'); await a.settle(900);
  log('turned in', JSON.stringify(await q('high_water')), JSON.stringify(await q('lost_survey')));
  if (!(await a.eval('!!__ui.get().panels.dialogue'))) { await go('tender'); await talk(); }
  await press('Under the Spillway', 'Accept'); await a.settle(700); await a.closePanels();
  await a.mouseAway(); await a.shot('16-survey-party-home-at-mill');
}
    if (PART === '4') return;

if (at(5)) {
    // Journal and the bounty board that opened with the zone's story.
  await a.key('KeyJ'); await a.settle(800); await a.mouseAway(); await a.shot('17-journal-story');
  await a.clickText('.tab, button', 'Side stories'); await a.settle(500); await a.shot('18-journal-side');
  await a.clickText('.tab, button', 'Recovered records'); await a.settle(500); await a.shot('19-journal-records');
  await a.closePanels();
  await warpNear('bounty_board'); await go('bounty_board'); await e(); await a.mouseAway(); await a.shot('20-bounty-board');
  await a.closePanels();
}
    if (PART === '5') return;

  // Bracken: the hand-over to Hollis, the flooded basin, Hollis's side story offered at the same time.
  const up = await a.eval('(() => { const p = __game.world.map.portals.find(p => p.to === "bracken_sluice"); return { x: p.x, y: p.y }; })()');
  await warpTo(up.x - 120, up.y + 80); await a.walkTo(up.x, up.y, 40, 10000);
  log('travel bracken', JSON.stringify(await a.cmd('travel', { zone: 'bracken_sluice' })));
  await a.until(() => a.eval('__game.world.map?.zone === "bracken_sluice" && !!__ui.get().me'), 30000, 'bracken');
  await a.settle(2500); await a.cmd('debug', { op: 'infhp' }); // the test toggle resets on travel
  await go('foreman'); await talk(); await a.mouseAway(); await a.shot('21-hollis-handover');
  await press('Under the Spillway', 'Discuss'); await a.settle(800);
  if (!(await a.eval('!!__ui.get().panels.dialogue'))) { await go('foreman'); await talk(); }
  await press('Silt in the Gears', 'Accept'); await a.settle(700); await a.closePanels();
  log('bracken', JSON.stringify(await q('under_spillway')), JSON.stringify(await q('silt_gears')));
  const basin = await a.eval('(() => { const a = __game.world.map.adventure.paint.areas.find(r => r.id === "basin"); return { x: a.x, y: a.y }; })()');
  await warpTo(basin.x, basin.y + 300); await a.mouseAway(); await a.shot('22-flooded-basin');
  // The floodgate: forecourt, keeper, open it — the basin drains, Hollis walks up.
  const fc = await a.eval('(() => { const l = __game.world.map.adventure.locations.find(l => l.id === "forecourt"); return { x: l.x, y: l.y }; })()');
  await warpTo(fc.x, fc.y + 200); await a.walkTo(fc.x, fc.y, 60, 10000); await a.wait(800);
  const keeper = await enc('keeper');
  // Debug help for the walk-through only: three levels so a level-3 warrior is not stuck on the zone boss for minutes.
  await a.cmd('debug', { op: 'level', n: 3 });
  await fightAt(keeper.x, keeper.y, async () => (await q('under_spillway'))?.step >= 3, 480000, 'Rootbound');
  log('keeper', JSON.stringify(await q('under_spillway')));
  await go('floodgate'); await repair('23-floodgate-hold');
  await a.shot('24-floodgate-open-reveal');
  await warpTo(basin.x, basin.y + 300); await a.mouseAway(); await a.shot('25-basin-drained');
  await go('foreman'); await talk(); await a.mouseAway(); await a.shot('26-hollis-at-forecourt-turn-in');
  log('end', JSON.stringify(await q('under_spillway')));
}
