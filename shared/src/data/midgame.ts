import type { Point } from '../townTypes';
import { ZoneBuilder, rect, riverPoly, room } from '../zoneKit';

// Acts II–III (DESIGN.md §2): Sablefen, Saltwind, Lockglass, Shiverline, Beaconbreak, Hollowstar — rebuilt with the zone
// kit. Every contact, encounter, location, stage and portal id of the old plans is kept.
const F = 92.16, P = (x: number, y: number): Point => [Math.round(x * F), Math.round(y * F)];
type Z = ZoneBuilder;
const boss = (type: string, name: string, affixes: string[], questTarget = true) => ({ type, dx: 0, dy: 0, tier: 2 as const, name, affixes, ...(questTarget ? { questTarget: true } : {}) });

// ─────────── Sablefen Causeway (L20–25) ───────────
function sablefen() {
  const z = new ZoneBuilder('sablefen_causeway', [144, 120], 'fen', P(10, 72), { theme: 'glade' });
  const fen = ['saltglass_skimmer', 'bog_slime', 'grave_bat', 'siltusk'], bank = ['saltglass_skimmer', 'vault_moth', 'siltusk', 'reedclaw'];
  z.land('water', [P(28, 52), P(40, 48), P(56, 52), P(60, 66), P(52, 80), P(32, 82), P(26, 70)].map(([x, y]) => [x, y] as Point));
  z.land('water', riverPoly([P(62, 2), P(56, 20), P(60, 32), P(76, 36), P(98, 34)], 6 * F));
  z.land('reeds', riverPoly([P(20, 56), P(24, 46), P(30, 40)], 2.4 * F));
  z.region('cargo_road', P(12, 70), [6 * F, 4.6 * F], { roster: fen, packs: 0, ground: 'mud' });
  z.region('wagons', P(22, 62), [5.6 * F, 4.4 * F], { roster: fen, packs: 1, ground: 'mud' });
  z.region('toll', P(44, 64), [6 * F, 5 * F], { role: 'arena', ground: 'planks', amp: 0.08 });
  z.region('refuge', P(37, 36), [6.4 * F, 4.8 * F], { role: 'outpost', ground: 'planks' });
  z.region('upper_bank', P(70, 50), [7 * F, 5.4 * F], { roster: bank, packs: 2 });
  z.region('willows', P(14, 30), [6 * F, 5 * F], { roster: fen, packs: 2 });
  z.region('east_fen', P(82, 68), [6.4 * F, 5 * F], { roster: bank, packs: 2 });
  z.region('chain', P(46, 13), [7 * F, 5 * F], { role: 'arena', ground: 'stone' });
  z.region('drowned_chapel', P(18, 12), [4.8 * F, 3.8 * F], { role: 'secret', ground: 'moss' });
  z.region('salt_stair', P(84, 14), [5 * F, 4 * F], { ground: 'gravel' });
  z.road([P(6, 74), P(12, 70), P(22, 62), P(27, 64)], 170, 'mud');
  z.road([P(27, 64), P(38, 64)], 200, 'planks', { bridge: true });
  z.road([P(44, 64), P(50, 64)], 160, 'planks', { route: false });
  z.road([P(44, 62), P(44, 45)], 190, 'planks', { bridge: true });
  z.road([P(44, 45), P(37, 36), P(46, 32), P(58, 40), P(70, 50)], 160, 'planks');
  z.road([P(37, 36), P(26, 32), P(14, 30), P(16, 20), P(18, 12)], 140, 'mud');
  z.road([P(46, 32), P(46, 13)], 170, 'stone');
  z.road([P(70, 50), P(78, 60), P(82, 68)], 140, 'mud');
  z.road([P(46, 13), P(58, 12)], 160, 'stone');
  z.road([P(58, 12), P(72, 12)], 190, 'planks', { bridge: true });
  z.road([P(72, 12), P(84, 14), P(87, 22)], 150, 'gravel');
  z.portal(...P(6.4, 74), 'kilnwatch_crown', 'Kilnwatch Crown');
  z.contact('manifest', 'Waterlogged manifest', ...P(19, 65.5), 'ledger');
  z.pack('cargo', ...P(24, 60), ['saltglass_skimmer', 'bog_slime', 'grave_bat', 'siltusk']);
  z.wreck(...P(25.5, 65)); z.wreck(...P(17, 59)); z.landmark('Sunken Cargo Road', ...P(12, 75)); z.landmark('Drowned Wagons', ...P(22, 66));
  z.pack('toll', ...P(44.5, 65.5), [boss('salt_guard', 'The Tollkeeper', ['plagued', 'fast']), 'reedclaw', 'grave_bat', 'bog_slime']);
  z.decor('lamppost', ...P(40, 61)); z.decor('barrels', ...P(48, 61)); z.decor('banner', ...P(41, 68)); z.landmark('Toll Island', ...P(44, 69.5));
  z.camp(...P(36, 38), { tents: 2 });
  z.contact('ferrier', 'Sera', ...P(40.5, 38.8), 'person');
  z.resident('sf_poler', 'fisher', 'Ferry poler', ...P(41.5, 40), 20); z.resident('sf_mender', 'carpenter', 'Net mender', ...P(30, 39.5), -20);
  z.decor('rowboat', ...P(36, 46.8), 1, 1); z.decor('rowboat', ...P(50, 44.5), 1, 2); z.fishery(...P(42, 33));
  z.landmark('Ferriers’ Refuge', ...P(37, 41));
  z.pack('upper_bank', ...P(68, 51), ['saltglass_skimmer', 'vault_moth', 'siltusk', 'grave_bat']);
  z.contact('false_writ', 'Unsigned toll writ', ...P(72.5, 48), 'ledger');
  z.decor('noticeboard', ...P(76, 44.5)); z.landmark('Upper Bank', ...P(70, 55));
  z.contact('tide_bell', 'Drowned tide bell', ...P(86, 71), 'marker');
  z.pack('tide', ...P(82, 66), ['saltglass_skimmer', 'saltglass_skimmer', 'brine_crab', 'saltglass_skimmer', 'siltusk', 'saltglass_skimmer']);
  z.event('tide_of_skimmers', 'Tide of Skimmers', 'tide_bell', 'tide', 'The old tide bell still swings on its post. Ring it and every skimmer in the fen answers.', 'Ring the bell');
  z.elite('mudgullet', ...P(80, 70.5), 'siltusk', 'Mudgullet', ['plagued', 'fast'], ['saltglass_skimmer', 'reedclaw']);
  z.cache('cache_fen', ...P(88, 64), 'Smuggler’s float'); z.landmark('East Fen', ...P(82, 73));
  z.shrine('shrine_willow', ...P(10, 28), 'keen'); z.landmark('Willow Hollow', ...P(14, 35));
  z.pack('chainwatch', ...P(46, 14.5), [boss('salt_guard', 'Chainwatch', ['frozen', 'mortar']), 'vault_moth', 'brine_crab', 'bonewalker']);
  z.contact('chain', 'North chain winch', ...P(50.5, 15.5), 'mechanism');
  z.wheel = { x: Math.round(55.5 * F), y: Math.round(9 * F), radius: 38 };
  z.decor('pillar', ...P(40, 9), 1, 1); z.decor('lamppost', ...P(50, 18)); z.landmark('North Chain', ...P(46, 18));
  z.ruins(...P(18, 10.5), 360, 220); z.cache('cache_chapel', ...P(20.5, 13.5), 'Chapel reliquary'); z.shrine('shrine_chapel', ...P(14.5, 13.5), 'empowered'); z.landmark('Drowned Chapel', ...P(18, 16));
  z.portal(...P(87, 21), 'saltwind_pans', 'Saltwind Pans'); z.landmark('Salt Stair', ...P(84, 18));
  for (const [x, y] of [P(40, 60), P(60, 30), P(44, 50)]) { z.sound('water', x, y); z.mist(x, y, 420); }
  z.sound('wind', ...P(12, 70)); z.emit('fog', ...P(44, 55), 4); z.emit('fireflies', ...P(14, 30), 10);
  return z.build();
}

// ─────────── Saltwind Pans (L25–30) ───────────
function saltwind() {
  const z = new ZoneBuilder('saltwind_pans', [144, 120], 'salt', P(10, 72), { theme: 'glade', surface: 'salt' });
  const pans = ['saltglass_skimmer', 'salt_guard', 'vault_moth', 'bog_slime'], works = ['salt_guard', 'brine_crab', 'bonewalker', 'vault_moth'];
  z.land('water', rect(24 * F, 74 * F, 22 * F, 4 * F)); z.land('water', rect(60 * F, 76 * F, 26 * F, 3.5 * F));
  z.region('salt_road', P(12, 70), [6 * F, 4.6 * F], { ground: 'gravel' });
  z.region('pan_lanes', P(30, 62), [8 * F, 5.4 * F], { role: 'yard', ground: 'salt', roster: pans, packs: 2 });
  z.region('firing_lane', P(58, 64), [7.4 * F, 5 * F], { role: 'yard', ground: 'cinder', roster: works, packs: 1 });
  z.region('station', P(40, 40), [6.4 * F, 4.8 * F], { role: 'outpost', ground: 'planks' });
  z.region('inlet', P(22, 38), [5.4 * F, 4.4 * F], { roster: pans, packs: 1 });
  z.region('overflow', P(68, 40), [7 * F, 5 * F], { roster: works, packs: 2 });
  z.region('dispatch', P(54, 18), [7 * F, 5 * F], { role: 'arena', ground: 'stone' });
  z.region('crust_flats', P(84, 58), [6 * F, 4.6 * F], { roster: pans, packs: 2 });
  z.region('cistern_stair', P(34, 12), [4.6 * F, 3.8 * F], { ground: 'stone' });
  z.region('ridge_road', P(78, 13), [5 * F, 4 * F], { ground: 'gravel', roster: works, packs: 1 });
  z.region('collapsed_store', P(10, 24), [4.6 * F, 3.8 * F], { role: 'secret', ground: 'planks' });
  z.road([P(6, 74), P(12, 70), P(21, 65), P(30, 62), P(40, 62), P(50, 64), P(58, 64)], 170, 'gravel');
  z.road([P(30, 62), P(33, 52), P(40, 40)], 160, 'planks');
  z.road([P(40, 40), P(31, 39), P(22, 38)], 140, 'gravel');
  z.road([P(40, 40), P(52, 39), P(68, 40)], 160, 'gravel');
  z.road([P(58, 64), P(66, 52), P(68, 40), P(60, 28), P(54, 18)], 160, 'stone');
  z.road([P(54, 18), P(44, 15), P(34, 12)], 150, 'stone');
  z.road([P(54, 18), P(66, 15), P(78, 13), P(81, 20)], 150, 'gravel');
  z.road([P(58, 64), P(72, 61), P(84, 58)], 140, 'salt');
  z.road([P(22, 38), P(14, 31), P(10, 24)], 130, 'gravel');
  z.portal(...P(6.4, 74), 'sablefen_causeway', 'Sablefen Causeway');
  z.works = [{ kind: 'pan', x: Math.round(24 * F), y: Math.round(57 * F), w: 170, d: 100, h: 28 }, { kind: 'pan', x: Math.round(33 * F), y: Math.round(66 * F), w: 150, d: 100, h: 28 }, { kind: 'pan', x: Math.round(84 * F), y: Math.round(53 * F), w: 140, d: 80, h: 28 }];
  z.saltWorks(...P(18, 66)); z.landmark('Salt Road', ...P(12, 75)); z.landmark('Pan Lanes', ...P(30, 67));
  z.pack('pan_lane', ...P(32, 61), ['saltglass_skimmer', 'salt_guard', 'vault_moth', 'bog_slime']);
  z.pack('boiler', ...P(58.5, 65.5), [boss('salt_guard', 'The Dry Boil', ['molten', 'mortar']), 'brine_crab', 'cinder_cultist', 'bonewalker']);
  z.kilnYard(...P(53, 69)); z.kilnYard(...P(64, 60)); z.landmark('Firing Lane', ...P(58, 69.5));
  z.camp(...P(40, 42), { tents: 1 });
  z.contact('briner', 'Neris', ...P(36, 36.5), 'person');
  z.resident('sw_raker', 'worker', 'Salt raker', ...P(45, 37), 0); z.resident('sw_clerk', 'clerk', 'Tally clerk', ...P(34.5, 42.5), 30);
  z.saltWorks(...P(46, 44)); z.landmark('Brine Keepers’ Station', ...P(40, 45.5));
  z.contact('inlet', 'Brine inlet tally', ...P(20.5, 40.6), 'ledger');
  z.shrine('shrine_inlet', ...P(25.5, 41.5), 'frenzied'); z.landmark('Brine Inlet', ...P(22, 42.5));
  z.pack('overflow', ...P(69, 41.5), ['reedclaw', 'vault_moth', 'saltglass_skimmer', 'bonewalker']);
  z.contact('spill', 'Overflow spindle', ...P(73.5, 38.2), 'mechanism');
  z.contact('boil_valve', 'Overheated boil valve', ...P(62, 37.5), 'mechanism');
  z.pack('boilover', ...P(66, 45), ['brine_crab', 'salt_guard', 'cinder_cultist', 'brine_crab', 'salt_guard', 'bonewalker']);
  z.event('boil_over', 'Boil-over', 'boil_valve', 'boilover', 'The overflow valve is red hot. Open it and the brine boils over — along with everything living in the tanks.', 'Open the valve');
  z.landmark('Overflow', ...P(68, 45.5));
  z.pack('dispatch_watch', ...P(53.5, 19.5), [boss('salt_guard', 'White Ledger', ['frozen', 'electrified']), 'vault_moth', 'bonewalker', 'brine_crab']);
  z.wall(rect(48 * F, 12 * F, 12 * F, 0.5 * F)); z.wall(rect(48 * F, 12 * F, 0.5 * F, 2.4 * F)); z.wall(rect(59.5 * F, 12 * F, 0.5 * F, 2.4 * F));
  z.contact('dispatch', 'Salt dispatch', ...P(57, 14.5), 'ledger');
  z.decor('table', ...P(51, 14.2)); z.light(...P(54, 14), 0xffc070, 160); z.landmark('Dispatch House', ...P(54, 23));
  z.elite('white_clerk', ...P(85, 60), 'bonewalker', 'The White Clerk', ['frozen'], ['salt_guard', 'vault_moth']);
  z.cache('cache_flats', ...P(88.5, 55.5), 'Salt-crusted chest'); z.landmark('Crust Flats', ...P(84, 63));
  z.cache('cache_store', ...P(9, 23), 'Collapsed store'); z.shrine('shrine_store', ...P(13, 26.5), 'empowered'); z.landmark('Collapsed Store', ...P(10, 28));
  z.portal(...P(34, 10), 'lockglass_cistern', 'Lockglass Cistern'); z.landmark('Cistern Stair', ...P(34, 16));
  z.portal(...P(81, 19.5), 'shiverline_escarpment', 'Shiverline Escarpment'); z.landmark('Ridge Road', ...P(78, 17));
  for (const [x, y] of [P(12, 70), P(68, 40), P(54, 18)]) z.sound('wind', x, y);
  z.sound('water', ...P(34, 78)); z.sound('fire', ...P(58, 64)); z.emit('birds', ...P(30, 60), 5); z.critters('gulls', ...P(70, 72), 300, 6);
  return z.build();
}

// ─────────── Lockglass Cistern (L30–35, private dungeon) ───────────
function lockglass() {
  const S = 56.32, Q = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('lockglass_cistern', [88, 88], 'cistern', Q(20, 92), { theme: 'glade', surface: 'masonry' });
  const drown = ['saltglass_skimmer', 'vault_moth', 'bog_slime', 'salt_guard'];
  const R = (id: string, cx: number, cy: number, w: number, h: number, o: Parameters<Z['region']>[3] = {}) => z.region(id, Q(cx, cy), [w * S / 2, h * S / 2], { role: 'room', ground: 'tile', poly: room(cx * S, cy * S, w * S, h * S, 2.4 * S), dress: 0.5, ...o });
  R('stairs', 20, 90, 20, 10);
  const intake = R('intake', 20, 66, 28, 24, { dress: 0.3 });
  R('overflow', 52, 70, 26, 18, { roster: drown, packs: 2 });
  const filters = R('filters', 82, 64, 28, 24, { dress: 0.3 });
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
  return z.build();
}

// ─────────── Shiverline Escarpment (L35–40) ───────────
function shiverline() {
  const z = new ZoneBuilder('shiverline_escarpment', [144, 128], 'ridge', P(10, 79), { theme: 'glade', surface: 'slate' });
  const ridge = ['ridge_harrier', 'bonewalker', 'rimehorn', 'vault_moth'], signal = ['signal_adept', 'ridge_harrier', 'salt_guard', 'rimehorn'];
  z.land('chasm', riverPoly([P(30, 70), P(48, 66), P(70, 68)], 3 * F)); z.land('chasm', riverPoly([P(28, 40), P(48, 44), P(64, 40)], 2.6 * F));
  z.region('lower', P(12, 78), [6 * F, 4.6 * F], { ground: 'slate' });
  z.region('switch_a', P(36, 79), [7 * F, 4 * F], { roster: ridge, packs: 2 });
  z.region('windward', P(64, 76), [7 * F, 5 * F], { role: 'yard', ground: 'stone' });
  z.region('switch_b', P(80, 60), [6 * F, 4.6 * F], { roster: ridge, packs: 1 });
  z.region('ledge', P(20, 56), [7 * F, 5 * F], { roster: signal, packs: 1 });
  z.region('shelter', P(52, 52), [6.4 * F, 4.6 * F], { role: 'outpost', ground: 'planks' });
  z.region('scree', P(80, 40), [6.4 * F, 4.8 * F], { roster: ridge, packs: 2 });
  z.region('code_watch', P(16, 26), [7 * F, 5 * F], { role: 'ruin', ground: 'stone', roster: signal, packs: 1 });
  z.region('beacon', P(66, 16), [8 * F, 5.6 * F], { role: 'arena', ground: 'stone' });
  z.region('cairn_field', P(40, 28), [5.6 * F, 4.2 * F], { roster: ridge, packs: 1 });
  z.region('eyrie', P(10, 6.5), [4.4 * F, 3.4 * F], { role: 'secret', ground: 'slate' });
  z.region('ward_road', P(88, 12), [4.6 * F, 4 * F], { ground: 'gravel' });
  z.road([P(6, 81), P(12, 78), P(24, 80), P(36, 79), P(50, 78), P(64, 76)], 170, 'slate');
  z.road([P(64, 76), P(76, 70), P(80, 60), P(70, 56), P(52, 52)], 160, 'slate');
  z.road([P(52, 52), P(36, 56), P(20, 56)], 150, 'slate');
  z.road([P(52, 52), P(66, 46), P(80, 40), P(72, 30), P(66, 16)], 160, 'stone');
  z.road([P(20, 56), P(14, 42), P(16, 26), P(28, 26), P(40, 28), P(52, 22), P(66, 16)], 150, 'slate');
  z.road([P(16, 26), P(12, 16), P(10, 6.5)], 130, 'slate');
  z.road([P(66, 16), P(78, 13), P(88, 12), P(90, 20)], 150, 'gravel');
  z.portal(...P(6.3, 81), 'saltwind_pans', 'Saltwind Pans'); z.decor('signpost', ...P(15, 75.5)); z.landmark('Lower Switchback', ...P(12, 83));
  z.works = [{ kind: 'relay', x: Math.round(68 * F), y: Math.round(71 * F), w: 110, d: 90, h: 160 }, { kind: 'relay', x: Math.round(71 * F), y: Math.round(9 * F), w: 110, d: 90, h: 160 }];
  z.contact('lower_flag', 'Lower relay pennant', ...P(60, 73), 'marker');
  z.pack('lower_ridge', ...P(63, 78), ['ridge_harrier', 'bonewalker', 'rimehorn', 'vault_moth']);
  z.signalPost(...P(58, 79)); z.landmark('Windward Relay', ...P(64, 81));
  z.pack('interceptor', ...P(21, 57.5), [boss('signal_adept', 'The Interceptor', ['vortex', 'electrified']), 'ridge_harrier', 'bonewalker', 'grave_bat']);
  z.contact('intercept', 'Intercepted signal slate', ...P(15.5, 55.5), 'ledger');
  z.decor('signalflag', ...P(25, 52)); z.landmark('Intercept Ledge', ...P(20, 61));
  z.camp(...P(52, 54), { tents: 1 });
  z.contact('lookout', 'Tallis', ...P(48, 49), 'person');
  z.resident('sl_runner', 'guard', 'Flag runner', ...P(57, 50), -15); z.decor('signalflag', ...P(55, 47.5), 1, 2);
  z.landmark('Lookout Shelter', ...P(52, 57.5));
  z.contact('gale_horn', 'Cracked gale horn', ...P(85, 37), 'marker');
  z.pack('gale', ...P(79, 42), ['ridge_harrier', 'ridge_harrier', 'rimehorn', 'ridge_harrier', 'signal_adept', 'ridge_harrier']);
  z.event('gale_harriers', 'Gale Harriers', 'gale_horn', 'gale', 'Blow the cracked horn and the harriers riding the gale will dive for you.', 'Sound the horn');
  z.elite('rimecrown', ...P(82, 43.5), 'rimehorn', 'Rimecrown', ['frozen', 'fast'], ['ridge_harrier', 'rimehorn']);
  z.landmark('Scree Fields', ...P(80, 45));
  z.pack('code_watch', ...P(17, 27), ['ridge_harrier', 'signal_adept', 'salt_guard', 'rimehorn']);
  z.contact('code', 'Ridge code wheel', ...P(10, 23.5), 'ledger');
  z.ruins(...P(21, 22.5), 360, 230); z.landmark('Code Watch', ...P(16, 31));
  z.shrine('shrine_cairns', ...P(36, 30), 'keen'); for (const [x, y] of [P(42, 25), P(44, 31), P(38, 24.5)]) z.decor('cairn', x, y); z.landmark('Cairn Field', ...P(40, 32));
  z.pack('beacon_watch', ...P(65, 18), [boss('signal_adept', 'Mute Flame', ['faulted', 'mortar']), 'ridge_harrier', 'bonewalker', 'salt_guard']);
  z.contact('beacon', 'Upper beacon control', ...P(62, 12), 'mechanism');
  z.light(...P(72, 8), 0xffd070, 220); z.landmark('Upper Beacon', ...P(66, 21));
  z.cache('cache_eyrie', ...P(8.5, 5.5), 'Eyrie cache'); z.shrine('shrine_eyrie', ...P(12.5, 7.5), 'empowered'); z.landmark('Eyrie', ...P(10, 10));
  z.portal(...P(89.5, 19.5), 'beaconbreak_ward', 'Beaconbreak Ward'); z.landmark('Ward Road', ...P(88, 16));
  for (const [x, y] of [P(12, 78), P(52, 52), P(66, 16), P(80, 40)]) z.sound('wind', x, y);
  z.emit('leaves', ...P(36, 79), 4); z.critters('crows', ...P(40, 28), 200, 5);
  return z.build();
}

// ─────────── Beaconbreak Ward (L40–45) ───────────
function beaconbreak() {
  const z = new ZoneBuilder('beaconbreak_ward', [144, 120], 'ward', P(50, 79), { theme: 'glade', surface: 'slate' });
  const street = ['salt_guard', 'ridge_harrier', 'bonewalker', 'signal_adept'], yard = ['bonewalker', 'signal_adept', 'ridge_harrier', 'rimehorn'];
  z.region('south_gate', P(50, 77), [6 * F, 4.4 * F], { role: 'yard', ground: 'cobble' });
  z.region('crossroads', P(50, 55), [7.4 * F, 5.4 * F], { role: 'outpost', ground: 'cobble' });
  z.region('west_street', P(26, 56), [7.4 * F, 4.6 * F], { role: 'yard', ground: 'cobble', roster: street, packs: 1 });
  z.region('east_street', P(74, 58), [7 * F, 4.6 * F], { role: 'yard', ground: 'cobble', roster: street, packs: 2 });
  z.region('granary', P(18, 30), [7.4 * F, 5.4 * F], { role: 'yard', ground: 'planks', roster: yard, packs: 1 });
  z.region('cistern', P(82, 30), [7.4 * F, 5.4 * F], { role: 'yard', ground: 'flag', roster: street, packs: 1 });
  z.region('relay_gate', P(50, 18), [8 * F, 5.6 * F], { role: 'arena', ground: 'flag' });
  z.region('chapel_yard', P(34, 38), [5 * F, 3.8 * F], { role: 'ruin', ground: 'moss', roster: yard, packs: 1 });
  z.region('market', P(66, 40), [5.4 * F, 4 * F], { role: 'yard', ground: 'cobble', roster: street, packs: 1 });
  z.region('bastion', P(88, 8), [4.4 * F, 3.4 * F], { role: 'secret', ground: 'stone' });
  z.region('north_lane', P(50, 5), [4.6 * F, 3 * F], { ground: 'flag' });
  z.road([P(50, 81), P(50, 77), P(50, 55), P(50, 32), P(50, 18), P(50, 5)], 180, 'cobble');
  z.road([P(50, 55), P(38, 56), P(26, 56), P(20, 44), P(18, 30)], 160, 'cobble');
  z.road([P(50, 55), P(62, 57), P(74, 58), P(80, 44), P(82, 30)], 160, 'cobble');
  z.road([P(18, 30), P(28, 22), P(40, 19), P(50, 18)], 150, 'flag');
  z.road([P(82, 30), P(72, 22), P(60, 19), P(50, 18)], 150, 'flag');
  z.road([P(26, 56), P(34, 38)], 130, 'cobble'); z.road([P(74, 58), P(66, 40)], 130, 'cobble');
  z.road([P(82, 30), P(88, 18), P(88, 8)], 130, 'stone');
  for (const [x0, x1, y] of [[30, 44, 64], [56, 70, 64]] as const) z.wall(rect(x0 * F, y * F, (x1 - x0) * F, 0.6 * F));
  z.portal(...P(48, 81.5), 'shiverline_escarpment', 'Shiverline Escarpment'); z.wardPost(...P(54.5, 75)); z.landmark('South Gate', ...P(50, 82));
  z.contact('gate_orders', 'Gatehouse orders', ...P(53, 77.6), 'ledger');
  z.contact('quartermaster', 'Mera', ...P(55, 52), 'person');
  z.resident('bw_clerk', 'clerk', 'Ward clerk', ...P(44, 51.5), 20); z.resident('bw_guard', 'guard', 'Ward guard', ...P(45, 59.5), -10); z.resident('bw_porter', 'porter', 'Granary porter', ...P(57.5, 59), 10);
  z.walker('bw_patrol', 'guard', [P(46, 62), P(46, 70), P(54, 70), P(54, 62)], 45, 4);
  z.decor('well', ...P(50, 50)); z.decor('noticeboard', ...P(42, 55)); z.decor('banner', ...P(58, 49)); z.decor('banner', ...P(42, 49)); z.light(...P(50, 54), 0xffc070, 240);
  z.landmark('Ward Crossroads', ...P(50, 60.5));
  z.pack('gatekeeper', ...P(26, 57.5), [boss('salt_guard', 'The Closed Hand', ['vortex', 'frozen']), 'ridge_harrier', 'bonewalker', 'signal_adept']);
  z.decor('barrels', ...P(20, 53)); z.decor('crates', ...P(32, 60)); z.landmark('West Gate Street', ...P(26, 61));
  z.pack('stores_watch', ...P(19, 32), ['bonewalker', 'signal_adept', 'ridge_harrier', 'rimehorn']);
  z.contact('stores', 'Granary dispatch board', ...P(13.5, 29.5), 'ledger');
  z.decor('hay', ...P(23, 26)); z.decor('crates', ...P(25, 34)); z.decor('cart', ...P(13, 34)); z.landmark('Raised Granary', ...P(18, 36));
  z.contact('riot_bell', 'Granary riot bell', ...P(22.5, 31.5), 'marker');
  z.pack('riot', ...P(18, 28), ['bonewalker', 'signal_adept', 'bonewalker', 'salt_guard', 'signal_adept', 'bonewalker']);
  z.event('granary_riot', 'Riot at the Granary', 'riot_bell', 'riot', 'The riot bell was rung once already. Ring it again and the false-command patrols come running.', 'Ring the bell');
  z.pack('cistern_watch', ...P(81, 32), ['saltglass_skimmer', 'salt_guard', 'signal_adept', 'vault_moth']);
  z.contact('cistern', 'Ward cistern stopcock', ...P(86.5, 29.5), 'mechanism');
  z.decor('well', ...P(77, 26)); z.landmark('Ward Cistern', ...P(82, 36));
  z.works = [{ kind: 'relay', x: Math.round(54 * F), y: Math.round(10 * F), w: 100, d: 100, h: 160 }];
  z.pack('relay_keeper', ...P(49, 19.5), [boss('signal_adept', 'The Countermand', ['electrified', 'faulted']), 'ridge_harrier', 'salt_guard', 'bonewalker']);
  z.contact('relay_book', 'Relay duty book', ...P(45, 15.8), 'ledger');
  z.decor('pillar', ...P(40, 23)); z.decor('pillar', ...P(60, 23), 1, 1); z.landmark('Relay Gate', ...P(50, 24));
  z.elite('second_seal', ...P(66, 41.5), 'salt_guard', 'The Second Seal', ['mortar'], ['signal_adept', 'bonewalker'], { questTarget: false });
  z.shrine('shrine_market', ...P(61, 37.5), 'empowered'); z.landmark('Old Market', ...P(66, 44.5));
  z.graves(...P(31, 39), 5); z.shrine('shrine_chapel', ...P(37.5, 35.5), 'keen'); z.landmark('Chapel Yard', ...P(34, 42));
  z.cache('cache_bastion', ...P(90, 6.5), 'Bastion strongroom'); z.landmark('Broken Bastion', ...P(88, 11.5));
  z.portal(...P(50, 4.5), 'hollowstar_array', 'Hollowstar Array'); z.landmark('Array Lane', ...P(50, 8.5));
  for (const [x, y] of [P(50, 55), P(18, 30), P(82, 30), P(50, 18)]) z.sound('wind', x, y);
  z.critters('crows', ...P(18, 30), 200, 5); z.critters('rats', ...P(66, 40), 120, 3);
  return z.build();
}

// ─────────── Hollowstar Array (L45–50, private dungeon) ───────────
function hollowstar() {
  const S = 61.44, Q = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('hollowstar_array', [96, 88], 'array', Q(50, 87), { theme: 'glade', surface: 'slate' });
  const signal = ['signal_adept', 'ridge_harrier', 'vault_moth', 'salt_guard'];
  const R = (id: string, cx: number, cy: number, w: number, h: number, o: Parameters<Z['region']>[3] = {}) => z.region(id, Q(cx, cy), [w * S / 2, h * S / 2], { role: 'room', ground: 'slate', poly: room(cx * S, cy * S, w * S, h * S, 2.4 * S), dress: 0.5, ...o });
  R('approach', 50, 85, 22, 10);
  R('gallery', 50, 62, 30, 16, { roster: signal, packs: 2 });
  const west = R('west', 16, 50, 26, 22, { dress: 0.3 }), east = R('east', 84, 50, 26, 22, { dress: 0.3 });
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
  return z.build();
}

export const SABLEFEN = sablefen(), SALTWIND = saltwind(), LOCKGLASS = lockglass(), SHIVERLINE = shiverline(), BEACONBREAK = beaconbreak(), HOLLOWSTAR = hollowstar();
export const MIDGAME_ADVENTURES = [SABLEFEN, SALTWIND, LOCKGLASS, SHIVERLINE, BEACONBREAK, HOLLOWSTAR] as const;
