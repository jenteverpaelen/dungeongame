import type { Point } from '../townTypes';
import { ZoneBuilder, rect, riverPoly, room } from '../zoneKit';

// Acts II–III (DESIGN.md §2): Sablefen, Saltwind, Lockglass, Shiverline, Beaconbreak, Hollowstar — rebuilt with the zone
// kit. Every contact, encounter, location, stage and portal id of the old plans is kept.
const F = 92.16, P = (x: number, y: number): Point => [Math.round(x * F), Math.round(y * F)];
type Z = ZoneBuilder;
const boss = (type: string, name: string, affixes: string[], questTarget = true) => ({ type, dx: 0, dy: 0, tier: 2 as const, name, affixes, ...(questTarget ? { questTarget: true } : {}) });

// ─────────── Sablefen Causeway (L20–25), open-field rebuild 2026-10-12 (docs/rework/worlds/OPEN.md; Act II, §7) ───────────
// Sun-bleached salt marsh: pale blonde flats crossed by brackish channels. The west channel carries the Toll Bridge (and a
// ford upstream), the lagoon the Refuge Bridge up to the Ferriers' Refuge, the tidal channel in the north-east the North
// Chain bridge (and a ford by the Salt Stair); reed beds break the flats into lanes. Plan units: 100 × 80 (S u each).
function sablefen() {
  const S = 102.4, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('sablefen_causeway', [160, 128], 'fen', P(10, 72), { theme: 'glade' });
  const fen = ['saltglass_skimmer', 'bog_slime', 'grave_bat', 'siltusk'], bank = ['saltglass_skimmer', 'vault_moth', 'siltusk', 'reedclaw'];
  const flats = ['saltglass_skimmer', 'brine_crab', 'siltusk', 'vault_moth'];

  // ── land and water
  z.open({ margin: 300, ground: 'drygrass' });
  z.river([P(31, 40), P(34, 52), P(36, 64), P(33, 76), P(35, 84)], 4 * S, [
    { at: P(35.6, 62), w: 2.2 * S, kind: 'bridge' },   // the Toll Bridge on the cargo road
    { at: P(33.3, 47), w: 3 * S, kind: 'ford' },        // the willow ford
  ]);
  z.river([P(35, 53), P(44, 52), P(54, 54), P(62, 59), P(68, 66)], 4.6 * S, [{ at: P(44.5, 52.1), w: 2.2 * S, kind: 'bridge' }]); // the lagoon and the Refuge Bridge
  z.river([P(62, -3), P(57, 10), P(59, 24), P(70, 31), P(84, 33), P(98, 32)], 5 * S, [
    { at: P(57.2, 12), w: 2 * S, kind: 'bridge' },     // the North Chain bridge
    { at: P(88, 32.8), w: 3.4 * S, kind: 'ford' },      // the salt ford below the stair
  ]);
  z.hole('reeds', [P(16, 47), P(21, 45.5), P(24, 49), P(21, 53), P(16.5, 52)]);
  z.hole('reeds', [P(86, 44), P(90, 43), P(92, 46.5), P(88.5, 49), P(85.5, 47.5)]);
  z.hole('reeds', [P(22, 18), P(26, 17), P(28, 21), P(24.5, 23.5), P(21, 21.5)]);
  z.lake(...P(89, 58), 2.4 * S, 1.5 * S);
  z.lake(...P(60, 76), 2.6 * S, 1.4 * S);

  // ── the marsh's parts
  z.area('cargo_road', P(12, 70), [6 * S, 4.6 * S], { ground: 'mud', roster: fen });
  z.area('wagons', P(22, 62), [5.6 * S, 4.4 * S], { ground: 'mud', roster: fen });
  z.area('toll', P(44, 64), [6 * S, 5 * S], { role: 'arena', ground: 'planks', amp: 0.08 });
  z.area('refuge', P(39, 38), [6.4 * S, 4.8 * S], { role: 'outpost', ground: 'planks', dress: 0.3 });
  z.area('upper_bank', P(70, 46), [7 * S, 5 * S], { ground: 'sand', roster: bank });
  z.area('willows', P(14, 30), [6 * S, 5 * S], { roster: fen });
  z.area('east_fen', P(82, 68), [6.4 * S, 5 * S], { ground: 'mud', roster: bank });
  z.area('chain', P(46, 13), [7 * S, 5 * S], { role: 'arena', ground: 'stone' });
  z.area('drowned_chapel', P(18, 11), [4.8 * S, 3.8 * S], { role: 'secret', ground: 'moss' });
  z.area('salt_stair', P(85, 16), [5 * S, 4 * S], { ground: 'salt' });
  z.area('blonde_flats', P(56, 70), [7 * S, 5 * S], { roster: flats });
  z.area('dunes', P(90, 46), [5 * S, 6 * S], { ground: 'sand', roster: flats });
  z.area('west_marsh', P(8, 46), [4.5 * S, 6 * S], { ground: 'mud', roster: fen });
  z.area('high_flats', P(30, 6), [6 * S, 3.6 * S], { ground: 'sand', roster: flats });
  z.area('east_shore', P(78, 22), [6 * S, 5 * S], { ground: 'sand', roster: bank });

  // ── dead-tree stands and salt boulders
  for (const [x, y, r, n] of [[10, 58, 2.2, 5], [26, 40, 2, 4], [6, 32, 2.2, 5], [36, 22, 2.4, 6], [52, 38, 2.2, 5], [62, 46, 2, 4], [70, 74, 2.4, 6],
    [94, 70, 2.2, 5], [82, 40, 2.2, 5], [66, 18, 2, 4], [92, 8, 2, 4], [46, 74, 2, 4], [12, 18, 2, 4]] as const) z.grove(...P(x, y), r * S, n);
  for (const [x, y] of [[50, 26], [84, 52], [20, 34], [24, 75]] as const) z.grove(...P(x, y), 1.6 * S, 4, ['saltboulder', 'deadtree', 'saltboulder']);

  // ── causeways: the cargo road over the Toll Bridge and up to the refuge (main, validated), the chain and east roads
  z.road([P(6, 74), P(12, 70), P(22, 62), P(32.8, 62.5)], 170, 'mud');
  z.road([P(38.5, 61.5), P(44, 64), P(43.9, 55.2)], 160, 'planks');
  z.road([P(45.1, 49), P(44, 45), P(39, 38), P(46, 33.5), P(58, 40), P(70, 46)], 160, 'planks');
  z.road([P(39, 38), P(26, 32), P(14, 30), P(16, 20), P(18, 12)], 140, 'mud');
  z.road([P(46, 33.5), P(46, 13), P(53.9, 12.5)], 170, 'stone');
  z.road([P(60.6, 11.5), P(72, 12), P(84, 14), P(87, 20)], 150, 'gravel');
  z.road([P(70, 46), P(78, 60), P(82, 68)], 140, 'mud');

  // ── the sunken cargo road and the drowned wagons
  z.portal(...P(6.4, 74), 'kilnwatch_crown', 'Kilnwatch Crown');
  z.contact('manifest', 'Waterlogged manifest', ...P(19, 65.5), 'ledger');
  z.pack('cargo', ...P(24, 60), ['saltglass_skimmer', 'bog_slime', 'grave_bat', 'siltusk', 'saltglass_skimmer', 'bog_slime']);
  z.wreck(...P(25.5, 65)); z.wreck(...P(17, 59)); z.landmark('Sunken Cargo Road', ...P(12, 75.5)); z.landmark('Drowned Wagons', ...P(22, 66.5));
  z.structure('boatwreck', ...P(31.2, 73));

  // ── the Toll Bridge and the Tollkeeper
  z.pack('toll', ...P(44.5, 65.5), [boss('salt_guard', 'The Tollkeeper', ['plagued', 'fast']), 'reedclaw', 'grave_bat', 'bog_slime']);
  z.decor('lamppost', ...P(40.5, 60.2)); z.decor('barrels', ...P(48, 61.5)); z.landmark('Toll Crossing', ...P(44, 70));
  z.contact('toll_gate', 'Toll gate', ...P(40, 63.4), 'mechanism');
  // The toll gate thrown open (sf_toll): the toll banner and barrier are gone. Phased props stand against the water.
  z.phase('sf_toll', false, () => { z.decor('banner', ...P(37.86, 60.68)); z.decor('fence', ...P(39.68, 63.6)); z.decor('fence', ...P(38.22, 64.5), 1, 1); z.decor('barrels', ...P(37.79, 60.28)); });
  z.phase('sf_toll', true, () => { z.decor('fence', ...P(38.15, 65.05), 1, 2); z.resident('sf_tollfree', 'porter', 'Carter', ...P(41.6, 64.4), 10); });
  z.structure('watchtower', ...P(50, 70.5));

  // ── the Ferriers' Refuge on the lagoon's north shore
  z.camp(...P(37, 39.5), { tents: 2 });
  z.contact('ferrier', 'Sera', ...P(41.5, 40.2), 'person');
  z.resident('sf_poler', 'fisher', 'Ferry poler', ...P(42.6, 46.2), 20); z.resident('sf_mender', 'carpenter', 'Net mender', ...P(33.5, 41.5), -20);
  z.decor('rowboat', ...P(40, 50.8), 1, 1); z.decor('rowboat', ...P(50, 51.6), 1, 2); z.fishery(...P(48, 46.5));
  z.landmark('Ferriers’ Refuge', ...P(38, 43));
  z.board(...P(33.4, 37.4), 'Ferriers’ bounty board');
  z.structure('house', ...P(45.5, 32), 1); z.structure('dryingrack', ...P(34.5, 44));
  z.resident('sf_cook', 'innkeeper', 'Refuge cook', ...P(35.5, 40.8), 15);
  z.walker('sf_ferry', 'fisher', [P(45.1, 49), P(44.5, 52.1), P(43.9, 55.2), P(44.5, 52.1)], 38, 7);
  z.phase('sf_drivers', true, () => {
    z.resident('sf_driver1', 'porter', 'Convoy driver', ...P(41, 35.2), 20); z.resident('sf_driver2', 'worker', 'Convoy driver', ...P(48.6, 35.5), -15);
    z.resident('sf_driver3', 'merchant', 'Convoy master', ...P(37.4, 35.8), 30); z.decor('crates', ...P(43.75, 31.2)); z.decor('cart', ...P(47.59, 31.99));
  });

  // ── the upper bank and the unsigned writ
  z.pack('upper_bank', ...P(70, 47), ['saltglass_skimmer', 'vault_moth', 'siltusk', 'grave_bat', 'saltglass_skimmer']);
  z.contact('false_writ', 'Unsigned toll writ', ...P(73, 44.5), 'ledger');
  z.decor('noticeboard', ...P(76.5, 43)); z.landmark('Upper Bank', ...P(70, 51.5));

  // ── the east fen: the tide bell, Mudgullet, the drifting float
  z.contact('tide_bell', 'Drowned tide bell', ...P(86, 71), 'marker');
  z.pack('tide', ...P(82, 66), ['saltglass_skimmer', 'saltglass_skimmer', 'brine_crab', 'saltglass_skimmer', 'siltusk', 'saltglass_skimmer', 'brine_crab']);
  z.event('tide_of_skimmers', 'Tide of Skimmers', 'tide_bell', 'tide', 'The old tide bell still swings on its post. Ring it and every skimmer in the fen answers.', 'Ring the bell');
  z.elite('mudgullet', ...P(80, 70.5), 'siltusk', 'Mudgullet', ['plagued', 'fast'], ['saltglass_skimmer', 'reedclaw'], { questTarget: true });
  z.contact('cargo_float', 'Drifting cargo float', ...P(79.5, 66), 'cart');
  z.cache('cache_fen', ...P(88, 64), 'Smuggler’s float'); z.landmark('East Fen', ...P(82, 74));

  // ── Willow Hollow and the Drowned Chapel
  z.shrine('shrine_willow', ...P(10, 28), 'keen'); z.landmark('Willow Hollow', ...P(14, 35)); z.structure('stonetower', ...P(6.5, 24), 1);
  z.ruins(...P(18, 10), 360, 220); z.cache('cache_chapel', ...P(20.5, 13), 'Chapel reliquary'); z.shrine('shrine_chapel', ...P(14.5, 13), 'empowered'); z.landmark('Drowned Chapel', ...P(18, 15.5));
  z.structure('statue', ...P(37.5, 10.5));

  // ── the North Chain: Chainwatch, the winch and the waiting drovers
  z.pack('chainwatch', ...P(46, 14.5), [boss('salt_guard', 'Chainwatch', ['frozen', 'mortar']), 'vault_moth', 'brine_crab', 'bonewalker']);
  z.contact('chain', 'North chain winch', ...P(50.5, 15.5), 'mechanism');
  z.wheel = { x: Math.round(52.6 * S), y: Math.round(9.6 * S), radius: 38, spin: 'sf_chain' };
  // Chain still up (sf_chain off): drovers and their cargo wait at the bridge head; lowered, they cross and the lamp is lit.
  z.phase('sf_chain', false, () => { z.resident('sf_wait1', 'porter', 'Waiting drover', ...P(52, 14), -20); z.resident('sf_wait2', 'worker', 'Waiting drover', ...P(51.2, 12.4), 15); z.decor('crates', ...P(54.49, 10.9)); z.decor('barrels', ...P(54.69, 14.2)); });
  z.phase('sf_chain', true, () => { z.walker('sf_ferry2', 'fisher', [P(53.9, 12.5), P(57.2, 12), P(60.5, 11.5), P(57.2, 12)], 40, 6); z.light(...P(52.6, 9.6), 0xffc070, 160); });
  z.decor('pillar', ...P(40, 9), 1, 1); z.decor('lamppost', ...P(50, 18)); z.landmark('North Chain', ...P(46, 18.5));

  // ── the Salt Stair to Saltwind
  z.portal(...P(87, 21), 'saltwind_pans', 'Saltwind Pans'); z.landmark('Salt Stair', ...P(84, 18));

  // ── life, sound (warm Act II light and dust come from the act look, render/actWeather.ts)
  for (const [x, y] of [P(36, 60), P(58, 26), P(48, 54), P(86, 33)]) { z.sound('water', x, y); z.mist(x, y, 420); }
  for (const [x, y] of [P(12, 70), P(56, 70), P(90, 46), P(30, 6)]) z.sound('wind', x, y);
  z.emit('fog', ...P(48, 56), 3); z.emit('fireflies', ...P(14, 30), 8); z.emit('birds', ...P(56, 70), 4); z.emit('birds', ...P(80, 22), 4);
  z.critters('gulls', ...P(56, 70), 280, 5); z.critters('gulls', ...P(78, 22), 260, 4); z.critters('frogs', ...P(82, 68), 140, 4);
  z.fill({ roster: flats, spacing: 700, size: [6, 12], champion: 0.1, rare: 0.06, clear: 1100 });
  return z.build();
}

// ─────────── Saltwind Pans (L25–30), open-field rebuild 2026-10-12 (docs/rework/worlds/OPEN.md; Act II, §7) ───────────
// Salt country by the sea: the coast along the south, white salt flats and evaporation pans inland, blue brine pools and a
// dark-rock ridge on pale grass (REFERENCES W13 Dry Steppes: pale grasses on dark rocks, blue alkaline lakes, salt flats).
// The station stands in the middle, the dispatch house in the north, the stairs down to the cistern in the north-west.
// Plan units: 100 × 80 (S u each).
function saltwind() {
  const S = 102.4, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('saltwind_pans', [160, 128], 'salt', P(10, 70), { theme: 'glade', surface: 'salt' });
  const pans = ['saltglass_skimmer', 'salt_guard', 'vault_moth', 'bog_slime'], works = ['salt_guard', 'brine_crab', 'bonewalker', 'vault_moth'];
  const steppe = ['saltglass_skimmer', 'brine_crab', 'salt_guard', 'vault_moth'];

  // ── land and water: the coast, brine pools, the dark ridge
  z.open({ margin: 300, ground: 'drygrass' });
  z.hole('water', [P(-2, 77.5), P(14, 76), P(26, 77), P(40, 75.5), P(54, 76.5), P(68, 75), P(82, 76.5), P(102, 75.5), P(102, 84), P(-2, 84)]); // the sea
  z.lake(...P(47, 51), 3.4 * S, 2 * S);
  z.lake(...P(80, 31), 2.8 * S, 1.8 * S);
  z.lake(...P(15, 49), 2.2 * S, 1.4 * S);
  z.lake(...P(92, 66), 2 * S, 1.3 * S);
  z.ridge([P(56, 30.5), P(64, 27.5), P(72, 26)], 1.6 * S, [{ at: P(61.6, 28.6), w: 4.6 * S }]); // the dark ridge, the dispatch road's cut
  z.hole('cliff', [P(26, 26), P(31, 24.5), P(33, 28.5), P(29, 31.5), P(25, 30)]);
  z.hole('cliff', [P(86, 44), P(90, 42.5), P(93, 46), P(89, 49.5), P(85, 48)]);

  // ── the flats' parts
  z.area('salt_road', P(12, 70), [6 * S, 4.6 * S], { ground: 'gravel' });
  z.area('pan_lanes', P(30, 62), [8 * S, 5.4 * S], { role: 'yard', ground: 'salt', roster: pans });
  z.area('firing_lane', P(58, 64), [7.4 * S, 5 * S], { role: 'yard', ground: 'cinder', roster: works });
  z.area('station', P(40, 40), [6.4 * S, 4.8 * S], { role: 'outpost', ground: 'planks', dress: 0.3 });
  z.area('inlet', P(22, 38), [5.4 * S, 4.4 * S], { ground: 'salt', roster: pans });
  const overflow = z.area('overflow', P(68, 40), [7 * S, 5 * S], { ground: 'salt', roster: works });
  z.area('dispatch', P(54, 17), [7 * S, 5 * S], { role: 'arena', ground: 'stone' });
  z.area('crust_flats', P(84, 58), [6 * S, 4.6 * S], { ground: 'salt', roster: pans });
  z.area('cistern_stair', P(34, 12), [4.6 * S, 3.8 * S], { ground: 'stone' });
  z.area('ridge_road', P(78, 13), [5 * S, 4 * S], { ground: 'gravel', roster: works });
  z.area('collapsed_store', P(10, 24), [4.6 * S, 3.8 * S], { role: 'secret', ground: 'planks' });
  z.area('white_flats', P(50, 59), [6 * S, 4 * S], { ground: 'salt', roster: pans });
  z.area('north_steppe', P(18, 10), [7 * S, 4 * S], { roster: steppe });
  z.area('east_steppe', P(92, 30), [5 * S, 6 * S], { roster: steppe });
  z.area('shore', P(72, 71), [9 * S, 3.4 * S], { ground: 'sand', roster: pans });
  z.area('mid_steppe', P(56, 44), [4 * S, 3.6 * S], { roster: steppe });

  // ── salt stacks, dark boulders, dead trees
  for (const [x, y, r, n] of [[20, 56, 2, 4], [8, 40, 2.2, 5], [32, 30, 2, 4], [44, 26, 2.2, 5], [62, 52, 2, 4], [76, 48, 2.2, 5], [92, 16, 2, 4],
    [70, 18, 2, 4], [40, 70, 2, 4], [86, 72, 2, 4], [6, 56, 2, 4]] as const) z.grove(...P(x, y), r * S, n);
  for (const [x, y] of [[26, 46], [62, 36], [84, 22], [48, 33]] as const) z.grove(...P(x, y), 1.6 * S, 4, ['saltboulder', 'deadtree', 'saltboulder']);

  // ── roads: the salt road through the pans to the firing lane (main, validated), the station, overflow and dispatch roads
  z.road([P(6, 72), P(12, 70), P(21, 65), P(30, 62), P(40, 62), P(50, 64), P(58, 64)], 170, 'gravel');
  z.road([P(30, 62), P(34, 52), P(40, 40)], 160, 'planks');
  z.road([P(40, 40), P(31, 39), P(22, 38)], 140, 'gravel');
  z.road([P(40, 40), P(52, 39), P(68, 40)], 160, 'gravel');
  z.road([P(58, 64), P(66, 52), P(68, 40), P(61.6, 28.6), P(54, 18)], 160, 'stone');
  z.road([P(54, 18), P(44, 15), P(34, 12)], 150, 'stone');
  z.road([P(54, 18), P(66, 15), P(78, 13), P(81, 19)], 150, 'gravel');
  z.road([P(58, 64), P(72, 61), P(84, 58)], 140, 'salt');
  z.road([P(22, 38), P(14, 31), P(10, 24)], 130, 'gravel');

  // ── the salt road and the pan lanes
  z.portal(...P(6.4, 72.5), 'sablefen_causeway', 'Sablefen Causeway');
  z.works = [{ kind: 'pan', x: Math.round(24 * S), y: Math.round(57 * S), w: 170, d: 100, h: 28 }, { kind: 'pan', x: Math.round(33 * S), y: Math.round(66 * S), w: 150, d: 100, h: 28 }, { kind: 'pan', x: Math.round(84 * S), y: Math.round(53 * S), w: 140, d: 80, h: 28 },
    { kind: 'pan', x: Math.round(46 * S), y: Math.round(58 * S), w: 160, d: 90, h: 28 }, { kind: 'pan', x: Math.round(53 * S), y: Math.round(56.5 * S), w: 130, d: 80, h: 28 }];
  z.saltWorks(...P(18, 66)); z.landmark('Salt Road', ...P(12, 74.5)); z.landmark('Pan Lanes', ...P(30, 67.5));
  z.pack('pan_lane', ...P(32, 61), ['saltglass_skimmer', 'salt_guard', 'vault_moth', 'bog_slime', 'saltglass_skimmer']);
  z.structure('dryingrack', ...P(21, 54.5), 1); z.structure('dryingrack', ...P(39.5, 70.5), 1);
  z.resident('sw_pan1', 'worker', 'Pan raker', ...P(27.5, 60), 10); z.resident('sw_pan2', 'porter', 'Salt porter', ...P(36, 63.5), -10);
  z.walker('sw_carry', 'porter', [P(21, 65), P(30, 62), P(40, 62), P(30, 62)], 40, 5);

  // ── the firing lane: the Dry Boil and the boiler damper
  z.pack('boiler', ...P(58.5, 65.5), [boss('salt_guard', 'The Dry Boil', ['molten', 'mortar']), 'brine_crab', 'cinder_cultist', 'bonewalker']);
  z.kilnYard(...P(53, 69)); z.kilnYard(...P(64, 60)); z.landmark('Firing Lane', ...P(58, 70));
  z.contact('boiler_damper', 'Boiler damper', ...P(52.6, 60.6), 'mechanism');
  z.phase('sw_banked', false, () => { z.emit('smoke', ...P(58, 62), 8); z.emit('embers', ...P(60, 64), 6); z.light(...P(58, 64), 0xff6a2a, 300, 0.4); });
  z.structure('kilnstack', ...P(66.5, 68.5));

  // ── the Brine Keepers' Station
  z.camp(...P(40, 42), { tents: 1 });
  z.contact('briner', 'Neris', ...P(36, 36.5), 'person');
  z.resident('sw_raker', 'worker', 'Salt raker', ...P(45, 37), 0); z.resident('sw_clerk', 'clerk', 'Tally clerk', ...P(34.5, 42.5), 30);
  z.saltWorks(...P(46, 44)); z.landmark('Brine Keepers’ Station', ...P(40, 46));
  z.board(...P(44.6, 40.6), 'Station bounty board');
  z.structure('house', ...P(32.5, 45.5), 1); z.resident('sw_cook', 'innkeeper', 'Station cook', ...P(43.5, 44), -10);
  z.structure('windmill', ...P(47.5, 35));

  // ── the brine inlet and the collapsed store
  z.contact('inlet', 'Brine inlet tally', ...P(20.5, 40.6), 'ledger');
  z.shrine('shrine_inlet', ...P(25.5, 41.5), 'frenzied'); z.landmark('Brine Inlet', ...P(22, 43));
  z.structure('wellhouse', ...P(15.5, 34.5));
  z.cache('cache_store', ...P(9, 23), 'Collapsed store'); z.shrine('shrine_store', ...P(13, 26.5), 'empowered'); z.landmark('Collapsed Store', ...P(10, 28.5));

  // ── the overflow and the boil-over
  z.pack('overflow', ...P(69, 41.5), ['reedclaw', 'vault_moth', 'saltglass_skimmer', 'bonewalker', 'saltglass_skimmer']);
  z.contact('spill', 'Overflow spindle', ...P(73.5, 38.2), 'mechanism');
  z.contact('boil_valve', 'Overheated boil valve', ...P(62, 37.5), 'mechanism');
  z.pack('boilover', ...P(66, 45), ['brine_crab', 'salt_guard', 'cinder_cultist', 'brine_crab', 'salt_guard', 'bonewalker', 'brine_crab']);
  z.event('boil_over', 'Boil-over', 'boil_valve', 'boilover', 'The overflow valve is red hot. Open it and the brine boils over — along with everything living in the tanks.', 'Open the valve');
  z.landmark('Overflow', ...P(68, 46));
  z.phase('sw_spill', false, () => { z.overlay('flood', overflow); });

  // ── the dispatch house and White Ledger
  z.pack('dispatch_watch', ...P(53.5, 18.5), [boss('salt_guard', 'White Ledger', ['frozen', 'electrified']), 'vault_moth', 'bonewalker', 'brine_crab']);
  z.wall(rect(48 * S, 11 * S, 12 * S, 0.5 * S)); z.wall(rect(48 * S, 11 * S, 0.5 * S, 2.4 * S)); z.wall(rect(59.5 * S, 11 * S, 0.5 * S, 2.4 * S));
  z.contact('dispatch', 'Salt dispatch', ...P(57, 13.5), 'ledger');
  z.decor('table', ...P(51, 13.2)); z.light(...P(54, 13), 0xffc070, 160); z.landmark('Dispatch House', ...P(54, 22.5));
  z.structure('house', ...P(64, 10.5), 2);

  // ── the crust flats and the White Clerk
  z.elite('white_clerk', ...P(85, 60), 'bonewalker', 'The White Clerk', ['frozen'], ['salt_guard', 'vault_moth'], { questTarget: true });
  z.contact('gauge_west', 'West pan gauge', ...P(27, 58.5), 'mechanism'); z.contact('gauge_east', 'East pan gauge', ...P(80.5, 56.5), 'mechanism');
  z.cache('cache_flats', ...P(88.5, 55.5), 'Salt-crusted chest'); z.landmark('Crust Flats', ...P(84, 63.5));
  z.structure('stonetower', ...P(90.5, 52), 1);

  // ── the ways on: the cistern stair and the ridge road
  z.portal(...P(34, 10), 'lockglass_cistern', 'Lockglass Cistern'); z.landmark('Cistern Stair', ...P(34, 16));
  z.portal(...P(81, 19.5), 'shiverline_escarpment', 'Shiverline Escarpment'); z.landmark('Ridge Road', ...P(78, 17));

  // ── life, sound
  for (const [x, y] of [P(12, 70), P(68, 40), P(54, 18), P(92, 30), P(18, 10)]) z.sound('wind', x, y);
  for (const [x, y] of [P(34, 76), P(70, 76)]) z.sound('water', x, y);
  z.sound('fire', ...P(58, 64)); z.emit('birds', ...P(30, 60), 5); z.critters('gulls', ...P(70, 72), 300, 6); z.critters('gulls', ...P(30, 72), 260, 4); z.critters('crows', ...P(92, 30), 240, 3);
  z.fill({ roster: steppe, spacing: 700, size: [6, 12], champion: 0.1, rare: 0.06, clear: 1100 });
  return z.build();
}

// ─────────── Lockglass Cistern (L30–35, private dungeon) ───────────
function lockglass() {
  const S = 56.32, Q = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('lockglass_cistern', [88, 88], 'cistern', Q(20, 92), { theme: 'glade', surface: 'masonry' });
  const drown = ['saltglass_skimmer', 'vault_moth', 'bog_slime', 'salt_guard'];
  const R = (id: string, cx: number, cy: number, w: number, h: number, o: Parameters<Z['region']>[3] = {}) => z.region(id, Q(cx, cy), [w * S / 2, h * S / 2], { role: 'room', ground: 'tile', poly: room(cx * S, cy * S, w * S, h * S, 2.4 * S), dress: 1.1, ...o });
  R('stairs', 20, 90, 20, 10);
  const intake = R('intake', 20, 66, 28, 24, { dress: 0.6 });
  R('overflow', 52, 70, 26, 18, { roster: drown, packs: 2 });
  const filters = R('filters', 82, 64, 28, 24, { dress: 0.6 });
  R('gallery', 82, 36, 24, 18, { ground: 'planks' });
  R('drain', 18, 34, 22, 18, { roster: drown, packs: 1 });
  const heart = R('heart', 50, 24, 34, 26, { dress: 0 });
  R('archive', 50, 5.5, 22, 9, { ground: 'planks', dress: 0 });
  z.land('water', rect(42 * S, 60 * S, 20 * S, 3 * S));
  z.road([Q(20, 90), Q(20, 66)], 190, 'tile'); z.road([Q(20, 66), Q(36, 69), Q(52, 70), Q(68, 67), Q(82, 64)], 190, 'tile');
  z.road([Q(82, 64), Q(82, 36)], 180, 'tile'); z.road([Q(82, 36), Q(66, 28), Q(50, 24)], 180, 'tile');
  z.road([Q(20, 66), Q(18, 34)], 180, 'tile'); z.road([Q(18, 34), Q(34, 28), Q(50, 24)], 180, 'tile'); z.road([Q(50, 24), Q(50, 5.5)], 170, 'tile');
  z.portal(...Q(20, 93.5), 'saltwind_pans', 'Return to Saltwind Pans'); z.shrine('shrine_stairs', ...Q(12, 88), 'frenzied'); z.landmark('Inspection Stairs', ...Q(20, 95));
  z.contact('intake_wheel', 'Intake wheel', ...Q(10, 62), 'mechanism');
  z.pack('intake_pack', ...Q(22, 67), ['saltglass_skimmer', 'vault_moth', 'bog_slime', 'salt_guard', 'saltglass_skimmer']);
  z.decor('pillar', ...Q(9, 74)); z.decor('pillar', ...Q(31, 74), 1, 1); z.landmark('Intake Vault', ...Q(20, 72));
  z.decor('crates', ...Q(44, 76)); z.decor('barrels', ...Q(60, 76)); z.landmark('Overflow Hall', ...Q(52, 75));
  z.contact('filter_wheel', 'Filter wheel', ...Q(92, 70), 'mechanism');
  z.pack('filter_pack', ...Q(80, 63), [boss('salt_guard', 'The Calcified Hand', ['frozen', 'plagued'], false), 'brine_crab', 'vault_moth', 'grave_bat', 'bonewalker']);
  z.landmark('Filter Vault', ...Q(82, 70));
  z.contact('lockkeeper', 'Aven', ...Q(86, 33), 'person'); z.decor('table', ...Q(77, 33)); z.light(...Q(82, 33), 0x9ad8ff, 170); z.landmark('Keeper’s Gallery', ...Q(82, 40));
  z.cache('cache_drain', ...Q(12, 30), 'Drain-gate locker'); z.landmark('Drain Gallery', ...Q(18, 39));
  z.contact('heart_wheel', 'Heart governor', ...Q(58, 31), 'mechanism');
  z.pack('lock_heart', ...Q(48, 22), [{ type: 'cistern_heart', dx: 0, dy: 0, tier: 2, name: 'The Borrowed Heart', combat: 'cistern' }]);
  z.works = [{ kind: 'pan', x: Math.round(36 * S), y: Math.round(14 * S), w: 120, d: 80, h: 28 }];
  z.decor('pillar', ...Q(36, 33)); z.decor('pillar', ...Q(64, 17)); z.landmark('Governor Chamber', ...Q(50, 31));
  z.contact('archive', 'Water-order archive', ...Q(55, 4.5), 'ledger'); z.landmark('Archive', ...Q(50, 9));
  z.dungeon = { requireStory: true, endTarget: 'archive', stages: [
    { id: 'intake', trigger: 'intake_wheel', encounter: 'intake_pack', area: intake },
    { id: 'filters', trigger: 'filter_wheel', encounter: 'filter_pack', area: filters },
    { id: 'heart', trigger: 'heart_wheel', encounter: 'lock_heart', area: heart },
  ] };
  for (const [x, y] of [Q(20, 66), Q(82, 64), Q(50, 24)]) z.sound('water', x, y);
  z.emit('fog', ...Q(52, 66), 3); z.emit('motes', ...Q(50, 24), 6);
  // Second pass (LOG W4): tanks and pipes in the halls.
  z.structure('tank', ...Q(61, 66)); z.structure('tank', ...Q(91.5, 56.5)); z.structure('tank', ...Q(9.5, 30));
  z.decor('pipe', ...Q(44, 61.5), 1.2, 0); z.decor('pipe', ...Q(26, 46), 1, 2); z.decor('pipe', ...Q(76, 44), 1, 1); z.stores(...Q(88, 39));
  return z.build();
}

// ─────────── Shiverline Escarpment (L35–40), open-field rebuild 2026-10-12 (docs/rework/worlds/OPEN.md; Act III, §7) ───────────
// A snowbound escarpment climbed in three steps: the lower switchback along the bottom, cliff bands with passes where the
// roads climb (the windward relay pass, the intercept pass, the gale pass), snowfields on the upper slopes and the upper
// beacon at the top. Slate with snow patches, dark pines; warm firelight only at the shelter and the beacon.
// Plan units: 100 × 90 (S u each).
function shiverline() {
  const S = 102.4, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('shiverline_escarpment', [160, 144], 'ridge', P(10, 79), { theme: 'glade', surface: 'slate' });
  const ridge = ['ridge_harrier', 'bonewalker', 'rimehorn', 'vault_moth'], signal = ['signal_adept', 'ridge_harrier', 'salt_guard', 'rimehorn'];
  const heights = ['ridge_harrier', 'rimehorn', 'vault_moth', 'bonewalker'];

  // ── land: the escarpment steps (cliff bands with passes), a chasm, an ice tarn
  z.open({ margin: 300, ground: 'slate' });
  z.ridge([P(4, 68), P(20, 70), P(36, 67), P(52, 66), P(70, 68), P(86, 64), P(98, 62)], 1.8 * S, [
    { at: P(77.6, 66.3), w: 5 * S },                   // the windward pass
    { at: P(12, 69.2), w: 4 * S },                     // the west pass
  ]);
  z.ridge([P(2, 46), P(14, 47), P(28, 42), P(48, 45), P(64, 41), P(80, 46), P(98, 44)], 1.8 * S, [
    { at: P(15.5, 46.6), w: 4.5 * S },                 // the intercept pass
    { at: P(71.9, 43.5), w: 5 * S },                   // the gale pass
    { at: P(40, 43.8), w: 4 * S },                     // the cairn pass
  ]);
  z.ridge([P(24, 14), P(36, 12.5), P(46, 15)], 1.6 * S, []);   // the crags under the eyrie
  z.hole('chasm', [P(26, 33), P(32, 32), P(36, 34.5), P(31, 37.5), P(25.5, 36)]);
  z.lake(...P(88, 28), 3 * S, 1.8 * S);                        // an ice tarn (dark water under the snow line)

  // ── the escarpment's parts
  z.area('lower', P(12, 78), [6 * S, 4.6 * S], { ground: 'slate' });
  z.area('switch_a', P(36, 79), [7 * S, 4 * S], { roster: ridge });
  z.area('windward', P(64, 76), [7 * S, 5 * S], { role: 'yard', ground: 'stone' });
  z.area('switch_b', P(82, 58), [6 * S, 4.6 * S], { ground: 'snow', roster: ridge });
  z.area('ledge', P(20, 56), [7 * S, 5 * S], { roster: signal });
  z.area('shelter', P(52, 52), [6.4 * S, 4.6 * S], { role: 'outpost', ground: 'planks', dress: 0.3 });
  z.area('scree', P(80, 38), [6.4 * S, 4.8 * S], { ground: 'gravel', roster: ridge });
  z.area('code_watch', P(16, 26), [7 * S, 5 * S], { role: 'ruin', ground: 'stone', roster: signal });
  z.area('beacon', P(66, 16), [8 * S, 5.6 * S], { role: 'arena', ground: 'stone' });
  z.area('cairn_field', P(40, 28), [5.6 * S, 4.2 * S], { ground: 'snow', roster: ridge });
  z.area('eyrie', P(10, 6.5), [4.4 * S, 3.4 * S], { role: 'secret', ground: 'snow' });
  z.area('ward_road', P(88, 12), [4.6 * S, 4 * S], { ground: 'gravel' });
  z.area('snowfield_n', P(44, 6), [8 * S, 3.6 * S], { ground: 'snow', roster: heights });
  z.area('snowfield_e', P(90, 50), [5 * S, 6 * S], { ground: 'snow', roster: heights });
  z.area('mid_slope', P(32, 58), [5 * S, 4 * S], { ground: 'snow', roster: heights });
  z.area('high_slope', P(56, 32), [6 * S, 5 * S], { ground: 'snow', roster: heights });
  z.area('foot', P(88, 78), [6 * S, 5 * S], { roster: heights });

  // ── pine stands and crag fields
  for (const [x, y, r, n] of [[24, 74, 2.2, 5], [48, 72, 2.2, 5], [92, 70, 2, 4], [8, 58, 2.2, 5], [44, 54, 2, 4], [66, 54, 2.2, 5], [92, 40, 2, 4],
    [28, 22, 2, 4], [54, 26, 2.2, 5], [80, 22, 2, 4], [6, 34, 2.2, 5], [72, 6, 2, 4], [60, 86, 2.2, 5]] as const) z.grove(...P(x, y), r * S, n);
  for (const [x, y] of [[36, 50], [62, 30], [86, 84], [20, 38]] as const) z.grove(...P(x, y), 1.6 * S, 4, ['crag', 'boulder', 'pine']);

  // ── roads: the switchbacks up to the beacon (main, validated), the ledge and code-watch loop
  z.road([P(6, 81), P(12, 78), P(24, 80), P(36, 79), P(50, 78), P(64, 76)], 170, 'slate');
  z.road([P(64, 76), P(76, 70), P(80, 60), P(70, 56), P(52, 52)], 160, 'slate');
  z.road([P(52, 52), P(36, 56), P(20, 56)], 150, 'slate');
  z.road([P(52, 52), P(66, 46), P(80, 40), P(72, 30), P(66, 16)], 160, 'stone');
  z.road([P(20, 56), P(14, 42), P(16, 26), P(28, 26), P(40, 28), P(52, 22), P(66, 16)], 150, 'slate');
  z.road([P(16, 26), P(12, 16), P(10, 6.5)], 130, 'slate');
  z.road([P(66, 16), P(78, 13), P(88, 12), P(90, 20)], 150, 'gravel');

  // ── the lower switchback and the windward relay
  z.portal(...P(6.3, 81), 'saltwind_pans', 'Saltwind Pans'); z.decor('signpost', ...P(15, 75.5)); z.landmark('Lower Switchback', ...P(12, 83));
  z.structure('house', ...P(4.5, 73), 2);
  z.works = [{ kind: 'relay', x: Math.round(68 * S), y: Math.round(72 * S), w: 110, d: 90, h: 160 }, { kind: 'relay', x: Math.round(71 * S), y: Math.round(9 * S), w: 110, d: 90, h: 160 }];
  z.contact('lower_flag', 'Lower relay pennant', ...P(60, 73), 'marker');
  z.pack('lower_ridge', ...P(63, 78), ['ridge_harrier', 'bonewalker', 'rimehorn', 'vault_moth', 'ridge_harrier']);
  z.signalPost(...P(58, 79)); z.landmark('Windward Relay', ...P(64, 82));
  z.structure('signaltower', ...P(73, 82)); z.resident('sl_signaller', 'guard', 'Signaller', ...P(61, 79.5), 10);

  // ── the intercept ledge
  z.pack('interceptor', ...P(21, 57.5), [boss('signal_adept', 'The Interceptor', ['vortex', 'electrified']), 'ridge_harrier', 'bonewalker', 'grave_bat']);
  z.contact('intercept', 'Intercepted signal slate', ...P(15.5, 55.5), 'ledger');
  z.decor('signalflag', ...P(25, 52)); z.landmark('Intercept Ledge', ...P(20, 61));

  // ── the lookout shelter
  z.camp(...P(52, 54), { tents: 1 });
  z.contact('lookout', 'Tallis', ...P(48, 49.5), 'person');
  z.resident('sl_runner', 'guard', 'Flag runner', ...P(57, 50), -15); z.decor('signalflag', ...P(55, 47.5), 1, 2);
  z.landmark('Lookout Shelter', ...P(52, 58));
  z.board(...P(56, 54.7), 'Shelter bounty board');
  z.structure('house', ...P(45.5, 48), 2); z.resident('sl_cook', 'innkeeper', 'Shelter cook', ...P(55.5, 55.5), 10);
  z.structure('watchtower', ...P(60, 48.5));
  z.walker('sl_runner2', 'guard', [P(36, 56), P(44, 54.5), P(52, 52), P(44, 54.5)], 46, 5);

  // ── the scree fields: the gale horn, Rimecrown and the signal flags
  z.contact('gale_horn', 'Cracked gale horn', ...P(85, 37), 'marker');
  z.pack('gale', ...P(79, 41), ['ridge_harrier', 'ridge_harrier', 'rimehorn', 'ridge_harrier', 'signal_adept', 'ridge_harrier', 'rimehorn']);
  z.event('gale_harriers', 'Gale Harriers', 'gale_horn', 'gale', 'Blow the cracked horn and the harriers riding the gale will dive for you.', 'Sound the horn');
  z.elite('rimecrown', ...P(82, 42.5), 'rimehorn', 'Rimecrown', ['frozen', 'fast'], ['ridge_harrier', 'rimehorn'], { questTarget: true });
  z.contact('flag_post', 'Torn signal post', ...P(76.5, 37.5), 'marker');
  z.contact('flag_red', 'Red signal flag', ...P(75, 38.3), 'marker'); z.contact('flag_blue', 'Blue signal flag', ...P(74.6, 40.2), 'marker'); z.contact('flag_yellow', 'Yellow signal flag', ...P(78.4, 35.9), 'marker');
  z.phase('sl_flags', true, () => { z.decor('signalflag', ...P(76, 36.2)); z.decor('signalflag', ...P(77.2, 36.4), 1, 1); z.decor('signalflag', ...P(76.6, 35.6), 1, 2); });
  z.landmark('Scree Fields', ...P(80, 33.5));

  // ── the code watch and the cairn field
  z.pack('code_watch', ...P(17, 27), ['ridge_harrier', 'signal_adept', 'salt_guard', 'rimehorn', 'ridge_harrier']);
  z.contact('code', 'Ridge code wheel', ...P(10, 23.5), 'ledger');
  z.ruins(...P(21, 22), 360, 230); z.landmark('Code Watch', ...P(16, 31));
  z.structure('stonetower', ...P(7, 18.5), 1);
  z.shrine('shrine_cairns', ...P(36, 30), 'keen'); for (const [x, y] of [P(42, 25), P(44, 31), P(38, 24.5)]) z.decor('cairn', x, y); z.landmark('Cairn Field', ...P(40, 32.5));
  z.structure('statue', ...P(47, 34));

  // ── the upper beacon and Mute Flame
  z.pack('beacon_watch', ...P(65, 18), [boss('signal_adept', 'Mute Flame', ['faulted', 'mortar']), 'ridge_harrier', 'bonewalker', 'salt_guard']);
  z.contact('beacon', 'Upper beacon control', ...P(62, 12), 'mechanism');
  z.light(...P(72, 8), 0xffd070, 220); z.landmark('Upper Beacon', ...P(66, 21.5));
  z.structure('beacontower', ...P(57, 9.5));
  // The beacon lit (sl_beacon): a big honest fire on the ridge, visible from far below.
  z.phase('sl_beacon', true, () => { z.fire(...P(62.4, 10.6), 1.6); z.emit('smoke', ...P(62.4, 9), 7); z.emit('embers', ...P(62.4, 10), 6); z.light(...P(62.4, 10), 0xffd070, 520, 0.25); });

  // ── the eyrie, the ward road
  z.cache('cache_eyrie', ...P(8.5, 5.5), 'Eyrie cache'); z.shrine('shrine_eyrie', ...P(12.5, 7.5), 'empowered'); z.landmark('Eyrie', ...P(10, 10));
  z.portal(...P(89.5, 19.5), 'beaconbreak_ward', 'Beaconbreak Ward'); z.landmark('Ward Road', ...P(88, 16));

  // ── life, sound (cold Act III light and snowfall come from the act look, render/actWeather.ts)
  for (const [x, y] of [P(12, 78), P(52, 52), P(66, 16), P(80, 40), P(44, 6), P(90, 50)]) z.sound('wind', x, y);
  z.critters('crows', ...P(40, 28), 200, 5); z.critters('crows', ...P(88, 78), 220, 4); z.critters('deer', ...P(90, 50), 240, 2);
  z.fill({ roster: heights, spacing: 700, size: [6, 12], champion: 0.1, rare: 0.06, clear: 1100 });
  return z.build();
}

// ─────────── Beaconbreak Ward (L40–45), open-field rebuild 2026-10-12 (docs/rework/worlds/OPEN.md; Act III, §7) ───────────
// A fortified ward under siege in a snowbound valley (REFERENCES W12: military structures): the south gate in an inner
// curtain wall with two posterns, paved districts around the crossroads (west and east streets, the raised granary, the
// ward cistern, the chapel yard, the old market), the main street lined with houses up to the relay gate, the broken
// bastion in the north-east, snowfields along the edges. Plan units: 100 × 85 (S u each).
function beaconbreak() {
  const S = 102.4, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('beaconbreak_ward', [160, 136], 'ward', P(50, 79), { theme: 'glade', surface: 'slate' });
  const street = ['salt_guard', 'ridge_harrier', 'bonewalker', 'signal_adept'], yard = ['bonewalker', 'signal_adept', 'ridge_harrier', 'rimehorn'];
  const siege = ['ridge_harrier', 'signal_adept', 'bonewalker', 'rimehorn'];

  // ── land: the inner curtain wall (south gate and two posterns), the west street gate, rubble from the siege
  z.open({ margin: 300, ground: 'slate' });
  for (const [x0, x1] of [[6, 17], [23, 44], [56, 77], [83, 94]] as const) z.wall(rect(x0 * S, 64 * S, (x1 - x0) * S, 0.6 * S));
  z.wall(rect(33 * S, 49 * S, 0.6 * S, 5.2 * S)); z.wall(rect(33 * S, 57.8 * S, 0.6 * S, 5 * S)); // the west street gate (the road runs through the gap)
  z.hole('cliff', [P(6, 40), P(10, 38.5), P(12, 42), P(9, 45), P(5.5, 43.5)]);      // a fallen tower's rubble
  z.hole('cliff', [P(92, 44), P(95, 42.5), P(97, 46.5), P(94, 49), P(91, 47.5)]);
  z.lake(...P(18, 72), 3 * S, 1.8 * S);                                             // the frozen moat pond west of the gate

  // ── the ward's districts (paved) and the snowfields around them
  z.area('south_gate', P(50, 76), [6 * S, 4.4 * S], { role: 'yard', ground: 'cobble' });
  z.area('crossroads', P(50, 55), [7.4 * S, 5.4 * S], { role: 'outpost', ground: 'cobble', dress: 0.3 });
  z.area('west_street', P(24, 56), [7.4 * S, 4.6 * S], { role: 'yard', ground: 'cobble', roster: street });
  z.area('east_street', P(74, 58), [7 * S, 4.6 * S], { role: 'yard', ground: 'cobble', roster: street });
  z.area('granary', P(18, 30), [7.4 * S, 5.4 * S], { role: 'yard', ground: 'planks', roster: yard });
  z.area('cistern', P(82, 30), [7.4 * S, 5.4 * S], { role: 'yard', ground: 'flag', roster: street });
  z.area('relay_gate', P(50, 18), [8 * S, 5.6 * S], { role: 'arena', ground: 'flag' });
  z.area('chapel_yard', P(34, 39), [5 * S, 3.8 * S], { role: 'ruin', ground: 'snow', roster: yard });
  z.area('market', P(66, 40), [5.4 * S, 4 * S], { role: 'yard', ground: 'cobble', roster: street });
  z.area('bastion', P(88, 8), [4.4 * S, 3.4 * S], { role: 'secret', ground: 'stone' });
  z.area('north_lane', P(50, 5), [4.6 * S, 3 * S], { ground: 'flag' });
  z.area('main_street', P(50, 36), [3.6 * S, 12 * S], { ground: 'cobble' });
  z.area('west_snow', P(10, 54), [5 * S, 7 * S], { ground: 'snow', roster: siege });
  z.area('east_snow', P(92, 60), [5 * S, 7 * S], { ground: 'snow', roster: siege });
  z.area('north_snow', P(26, 10), [10 * S, 4 * S], { ground: 'snow', roster: siege });
  z.area('outer_field', P(76, 76), [10 * S, 4 * S], { ground: 'snow', roster: siege });
  z.area('siege_lines', P(24, 78), [9 * S, 3.6 * S], { ground: 'snow', roster: siege });

  // ── pines in the snowfields, rubble piles in the ward
  for (const [x, y, r, n] of [[8, 66, 2, 4], [92, 70, 2.2, 5], [30, 78, 2, 4], [72, 80, 2, 4], [6, 20, 2.2, 5], [94, 18, 2, 4], [36, 6, 2, 4], [70, 6, 2, 4]] as const) z.grove(...P(x, y), r * S, n);
  for (const [x, y] of [[40, 46], [62, 46], [28, 44], [74, 34], [30, 20], [70, 20]] as const) z.grove(...P(x, y), 1.4 * S, 3, ['barrels', 'crates', 'boulder']);

  // ── streets: the main street north through the crossroads (main, validated), the ring and side lanes
  z.road([P(50, 81), P(50, 77), P(50, 55), P(50, 32), P(50, 18), P(50, 5)], 180, 'cobble');
  z.road([P(50, 55), P(38, 56), P(26, 56), P(20, 44), P(18, 30)], 160, 'cobble');
  z.road([P(50, 55), P(62, 57), P(74, 58), P(80, 44), P(82, 30)], 160, 'cobble');
  z.road([P(18, 30), P(28, 22), P(40, 19), P(50, 18)], 150, 'flag');
  z.road([P(82, 30), P(72, 22), P(60, 19), P(50, 18)], 150, 'flag');
  z.road([P(26, 56), P(34, 39)], 130, 'cobble'); z.road([P(74, 58), P(66, 40)], 130, 'cobble');
  z.road([P(82, 30), P(88, 18), P(88, 8)], 130, 'stone');
  z.road([P(20, 66), P(20, 62), P(24, 57)], 120, 'cobble', { route: false }); z.road([P(80, 66), P(80, 62), P(76, 59)], 120, 'cobble', { route: false });

  // ── the south gate and the crossroads (Mera's quarter)
  z.portal(...P(48, 81.5), 'shiverline_escarpment', 'Shiverline Escarpment'); z.wardPost(...P(54.5, 75)); z.landmark('South Gate', ...P(50, 82.5));
  z.structure('stonetower', ...P(42, 76.5)); z.structure('stonetower', ...P(58.5, 76.5));
  z.contact('gate_orders', 'Gatehouse orders', ...P(53, 77.6), 'ledger');
  z.contact('quartermaster', 'Mera', ...P(55, 52), 'person');
  z.resident('bw_clerk', 'clerk', 'Ward clerk', ...P(44, 51.5), 20); z.resident('bw_guard', 'guard', 'Ward guard', ...P(45, 59.5), -10); z.resident('bw_porter', 'porter', 'Granary porter', ...P(57.5, 59), 10);
  z.walker('bw_patrol', 'guard', [P(46, 62.5), P(46, 70), P(54, 70), P(54, 62.5)], 45, 4);
  z.decor('well', ...P(50, 50)); z.decor('noticeboard', ...P(42, 55)); z.decor('banner', ...P(58, 49)); z.decor('banner', ...P(42, 49)); z.light(...P(50, 54), 0xffc070, 240);
  z.landmark('Ward Crossroads', ...P(50, 60.5));
  z.board(...P(44.2, 57.6), 'Ward bounty board');
  z.structure('house', ...P(40.5, 50.5)); z.structure('house', ...P(60, 50.5), 2);

  // ── the west gate street and the Closed Hand
  z.pack('gatekeeper', ...P(26, 57.5), [boss('salt_guard', 'The Closed Hand', ['vortex', 'frozen']), 'ridge_harrier', 'bonewalker', 'signal_adept']);
  z.decor('barrels', ...P(20, 53)); z.decor('crates', ...P(30, 60)); z.landmark('West Gate Street', ...P(26, 61.5));
  z.contact('west_bar', 'West street gate bar', ...P(31.8, 53.9), 'mechanism');
  // The west gate barred (bw_open off): the barrier stands in the gate between the wall stubs; opened, the crew comes back.
  z.phase('bw_open', false, () => { z.decor('barrels', ...P(33.2, 54.43)); z.decor('crates', ...P(33.4, 57.57), 0.9); z.decor('banner', ...P(32.79, 48.9)); });
  z.phase('bw_open', true, () => {
    z.resident('bw_back1', 'porter', 'Returning crew', ...P(30.4, 53.4), 20); z.resident('bw_back2', 'worker', 'Returning crew', ...P(22.4, 53.6), -10);
    z.resident('bw_back3', 'merchant', 'Carter', ...P(29.6, 59.6), 15); z.decor('cart', ...P(32.12, 61.68));
  });
  z.structure('house', ...P(24, 50.5)); z.resident('bw_baker', 'innkeeper', 'Ward baker', ...P(28, 59), 0);
  z.walker('bw_patrol2', 'guard', [P(26, 56), P(38, 56), P(50, 55), P(38, 56)], 45, 4);

  // ── the raised granary and the riot bell
  z.pack('stores_watch', ...P(19, 32), ['bonewalker', 'signal_adept', 'ridge_harrier', 'rimehorn', 'bonewalker']);
  z.contact('stores', 'Granary dispatch board', ...P(13.5, 29.5), 'ledger');
  z.decor('hay', ...P(23, 26)); z.decor('crates', ...P(25, 34)); z.decor('cart', ...P(13, 34)); z.landmark('Raised Granary', ...P(18, 36));
  z.structure('granary', ...P(9, 24));
  z.contact('riot_bell', 'Granary riot bell', ...P(22.5, 31.5), 'marker');
  z.pack('riot', ...P(18, 28), ['bonewalker', 'signal_adept', 'bonewalker', 'salt_guard', 'signal_adept', 'bonewalker', 'signal_adept']);
  z.event('granary_riot', 'Riot at the Granary', 'riot_bell', 'riot', 'The riot bell was rung once already. Ring it again and the false-command patrols come running.', 'Ring the bell');

  // ── the ward cistern
  z.pack('cistern_watch', ...P(81, 32), ['saltglass_skimmer', 'salt_guard', 'signal_adept', 'vault_moth']);
  z.contact('cistern', 'Ward cistern stopcock', ...P(86.5, 29.5), 'mechanism');
  z.decor('well', ...P(77, 26)); z.landmark('Ward Cistern', ...P(82, 36));
  z.phase('bw_water', true, () => { z.overlay('pool', [P(75.6, 26.6), P(77, 25.8), P(78.4, 26.6), P(78.4, 27.6), P(77, 28.2), P(75.6, 27.6)]); z.resident('bw_water1', 'innkeeper', 'Water carrier', ...P(79.6, 27.2), -20); });
  z.structure('wellhouse', ...P(90.5, 26));
  z.structure('house', ...P(76, 52.5), 1); z.resident('bw_smith', 'carpenter', 'Ward joiner', ...P(70, 61), 10);
  z.walker('bw_patrol3', 'guard', [P(62, 57), P(74, 58), P(80, 44), P(74, 58)], 45, 4);

  // ── the relay gate and the Countermand
  z.works = [{ kind: 'relay', x: Math.round(54 * S), y: Math.round(10 * S), w: 100, d: 100, h: 160 }];
  z.pack('relay_keeper', ...P(49, 19.5), [boss('signal_adept', 'The Countermand', ['electrified', 'faulted']), 'ridge_harrier', 'salt_guard', 'bonewalker']);
  z.contact('relay_book', 'Relay duty book', ...P(45, 15.8), 'ledger');
  z.decor('pillar', ...P(40, 23)); z.decor('pillar', ...P(60, 23), 1, 1); z.landmark('Relay Gate', ...P(50, 24));
  z.structure('beacontower', ...P(61.5, 12));

  // ── the old market, the chapel yard, the broken bastion, the array lane
  z.elite('second_seal', ...P(66, 41.5), 'salt_guard', 'The Second Seal', ['mortar'], ['signal_adept', 'bonewalker'], { questTarget: true });
  z.contact('ledger_chapel', 'Ledger page in the chapel yard', ...P(36, 40.5), 'ledger'); z.contact('ledger_market', 'Ledger page at the old market', ...P(69.5, 38.5), 'ledger');
  z.shrine('shrine_market', ...P(61, 37.5), 'empowered'); z.landmark('Old Market', ...P(66, 44.5));
  z.graves(...P(31, 39), 5); z.shrine('shrine_chapel', ...P(37.5, 35.5), 'keen'); z.landmark('Chapel Yard', ...P(34, 42.5));
  z.cache('cache_bastion', ...P(90, 6.5), 'Bastion strongroom'); z.landmark('Broken Bastion', ...P(88, 11.5));
  z.portal(...P(50, 4.5), 'hollowstar_array', 'Hollowstar Array'); z.landmark('Array Lane', ...P(50, 8.5));

  // ── the main street: houses and stalls line it north of the crossroads (each slides clear of the road)
  for (const [i, y] of [44, 38, 32, 26].entries()) { z.structure('house', ...P(45, y), i % 3); z.structure('house', ...P(55, y + 3), (i + 1) % 3, true); }
  z.stores(...P(46.5, 47)); z.stores(...P(53.5, 41)); z.decor('banner', ...P(47.5, 35)); z.decor('banner', ...P(52.5, 29)); z.decor('noticeboard', ...P(52.6, 46));
  z.resident('bw_vendor', 'merchant', 'Ward vendor', ...P(47.6, 41.5), 30); z.resident('bw_crier', 'bard', 'Street crier', ...P(52.4, 35.5), -20);

  // ── life, sound (cold Act III light and snowfall come from the act look)
  for (const [x, y] of [P(50, 55), P(18, 30), P(82, 30), P(50, 18), P(76, 76), P(10, 54)]) z.sound('wind', x, y);
  z.sound('fire', ...P(50, 54)); z.critters('crows', ...P(18, 30), 200, 5); z.critters('rats', ...P(66, 40), 120, 3); z.critters('crows', ...P(76, 76), 220, 4);
  z.fill({ roster: siege, spacing: 720, size: [6, 12], champion: 0.1, rare: 0.06, clear: 1100 });
  return z.build();
}

// ─────────── Hollowstar Array (L45–50, private dungeon) ───────────
function hollowstar() {
  const S = 61.44, Q = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('hollowstar_array', [96, 88], 'array', Q(50, 87), { theme: 'glade', surface: 'slate' });
  const signal = ['signal_adept', 'ridge_harrier', 'vault_moth', 'salt_guard'];
  const R = (id: string, cx: number, cy: number, w: number, h: number, o: Parameters<Z['region']>[3] = {}) => z.region(id, Q(cx, cy), [w * S / 2, h * S / 2], { role: 'room', ground: 'slate', poly: room(cx * S, cy * S, w * S, h * S, 2.4 * S), dress: 1.1, ...o });
  R('approach', 50, 85, 22, 10);
  R('gallery', 50, 62, 30, 16, { roster: signal, packs: 2 });
  const west = R('west', 16, 50, 26, 22, { dress: 0.6 }), east = R('east', 84, 50, 26, 22, { dress: 0.6 });
  R('west_reading', 22, 74, 18, 12, { ground: 'planks' }); R('east_reading', 78, 74, 18, 12, { ground: 'planks' });
  R('north_hall', 50, 40, 22, 12, { roster: signal, packs: 1 });
  const array = R('array', 50, 20, 36, 22, { dress: 0 });
  R('spool', 50, 4.5, 20, 7, { ground: 'planks', dress: 0 });
  z.road([Q(50, 85), Q(50, 62)], 190, 'slate'); z.road([Q(50, 62), Q(32, 58), Q(16, 50)], 190, 'slate'); z.road([Q(50, 62), Q(68, 58), Q(84, 50)], 190, 'slate');
  z.road([Q(50, 85), Q(36, 80), Q(22, 74)], 170, 'slate'); z.road([Q(50, 85), Q(64, 80), Q(78, 74)], 170, 'slate');
  z.road([Q(50, 62), Q(50, 40), Q(50, 20)], 190, 'slate'); z.road([Q(16, 50), Q(28, 30), Q(50, 20)], 170, 'slate'); z.road([Q(84, 50), Q(72, 30), Q(50, 20)], 170, 'slate'); z.road([Q(50, 20), Q(50, 4.5)], 160, 'slate');
  z.portal(...Q(50, 89), 'beaconbreak_ward', 'Return to Beaconbreak Ward'); z.shrine('shrine_approach', ...Q(42, 86), 'keen'); z.landmark('Signal Approach', ...Q(50, 90));
  z.contact('west_reader', 'Eris', ...Q(18, 72), 'person'); z.decor('table', ...Q(26, 72)); z.light(...Q(22, 72), 0xc8a0ff, 150); z.landmark('Western Reading Room', ...Q(22, 79));
  z.contact('east_reader', 'Daro', ...Q(82, 72), 'person'); z.decor('table', ...Q(74, 72)); z.light(...Q(78, 72), 0x9ad8ff, 150); z.landmark('Eastern Reading Room', ...Q(78, 79));
  z.contact('west_lens', 'Western signal shutter', ...Q(7, 55), 'mechanism');
  z.pack('west_signal', ...Q(17, 49), [{ type: 'signal_adept', dx: 0, dy: 0, tier: 2, name: 'First Voice', affixes: ['frozen', 'mortar'] }, 'ridge_harrier', 'vault_moth', 'salt_guard']);
  z.landmark('Western Receiver', ...Q(16, 56));
  z.contact('east_lens', 'Eastern signal shutter', ...Q(93, 55), 'mechanism');
  z.contact('contradiction', 'Conflicting transmission strip', ...Q(90, 43), 'ledger');
  z.pack('east_signal', ...Q(83, 49), [{ type: 'signal_adept', dx: 0, dy: 0, tier: 2, name: 'Second Voice', affixes: ['electrified', 'vortex'] }, 'vault_moth', 'ridge_harrier', 'bonewalker', 'salt_guard']);
  z.landmark('Eastern Receiver', ...Q(84, 56));
  z.decor('relaymast', ...Q(40, 64)); z.decor('crates', ...Q(60, 66)); z.landmark('Relay Gallery', ...Q(50, 67));
  z.cache('cache_hall', ...Q(42, 42), 'Signal-store locker'); z.landmark('North Hall', ...Q(50, 45));
  z.works = [{ kind: 'relay', x: Math.round(36 * S), y: Math.round(12 * S), w: 100, d: 90, h: 160 }, { kind: 'relay', x: Math.round(60 * S), y: Math.round(12 * S), w: 100, d: 90, h: 160 }];
  z.contact('array_control', 'Array isolator', ...Q(58, 27), 'mechanism');
  z.pack('array_heart', ...Q(48, 19), [{ type: 'signal_heart', dx: 0, dy: 0, tier: 2, name: 'The Hollow Conductor', combat: 'relay' }]);
  z.light(...Q(50, 18), 0xc8a0ff, 260); z.landmark('Isolated Array', ...Q(50, 28));
  z.contact('final_record', 'Original command spool', ...Q(55, 4), 'ledger'); z.landmark('Spool Vault', ...Q(50, 8));
  z.dungeon = { requireStory: true, endTarget: 'final_record', stages: [
    { id: 'west', trigger: 'west_lens', encounter: 'west_signal', area: west },
    { id: 'east', trigger: 'east_lens', encounter: 'east_signal', area: east },
    { id: 'conductor', trigger: 'array_control', encounter: 'array_heart', area: array },
  ] };
  for (const [x, y] of [Q(50, 62), Q(16, 50), Q(84, 50), Q(50, 20)]) z.sound('wind', x, y);
  z.emit('motes', ...Q(50, 20), 10); z.emit('motes', ...Q(16, 50), 6); z.emit('motes', ...Q(84, 50), 6);
  // Second pass (LOG W4): relay racks in the halls.
  z.structure('relayrack', ...Q(40, 58)); z.structure('relayrack', ...Q(60, 58)); z.structure('relayrack', ...Q(43, 37));
  z.decor('crystal', ...Q(30, 28), 1.2); z.decor('crystal', ...Q(70, 28), 1.1, 1);
  return z.build();
}

export const SABLEFEN = sablefen(), SALTWIND = saltwind(), LOCKGLASS = lockglass(), SHIVERLINE = shiverline(), BEACONBREAK = beaconbreak(), HOLLOWSTAR = hollowstar();
export const MIDGAME_ADVENTURES = [SABLEFEN, SALTWIND, LOCKGLASS, SHIVERLINE, BEACONBREAK, HOLLOWSTAR] as const;
