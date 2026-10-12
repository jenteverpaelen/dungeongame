import type { Point } from '../townTypes';
import { ZoneBuilder } from '../zoneKit';

// Rillwake Crossing (L1–4), open-field rebuild 2026-10-12 (docs/rework/worlds/OPEN.md): one meadow valley the hero can
// cross anywhere, the Rill running north–south through it (two bridges and a ford), a mill race in the north-east, a
// cliff ridge with one pass in the north-west, a chapel pond in the south-east and groves that break the open ground into
// lanes. Plan units: the map is 100 × 80 (S u each). Quest ids are kept: tender, reed_nest, party_camp, survey,
// overlook_fire, cart, party_journal, ledger, mill_brake, wenna (contacts); road, shallows, ridge, overlook, yard, mill,
// chapel_rare, brackjaw (encounters); old_ridge; shallows_swarm, survey_alarm; rw_signal, rw_wheel, rw_wenna, rw_survey_home.
const S = 102.4, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
const z = new ZoneBuilder('rillwake_crossing', [160, 128], 'meadow', P(13, 70), { theme: 'glade' });

// Rosters by part of the valley (2–3 kinds per pack; the field roster where no area claims the ground).
const meadow = ['bog_slime', 'gloomshroom', 'thornling', 'flint_beetle'];
const wood = ['gloomshroom', 'thornling', 'grave_bat', 'vault_moth'];
const bank = ['bog_slime', 'reedclaw', 'gloomshroom', 'reedclaw'];
const ridge = ['grave_bat', 'thornling', 'flint_beetle', 'siltusk'];
const chapel = ['grave_bat', 'gloomshroom', 'vault_moth', 'thornling'];

// ─────────── land and water ───────────
z.open({ margin: 300, ground: 'grass' });
const rill: Point[] = [P(47, -3), P(45.5, 10), P(48, 22), P(44, 34), P(46.5, 46), P(42.5, 58), P(44.5, 68), P(43, 83)];
z.river(rill, 3.4 * S, [
  { at: P(47.2, 19), w: 1.8 * S, kind: 'bridge' },   // north bridge: the overlook path to the north bank
  { at: P(45.6, 44), w: 2 * S, kind: 'bridge' },      // Timber Bridge on the main road
  { at: P(44, 66.5), w: 3.6 * S, kind: 'ford' },      // the ford below Fisher's Bend
]);
const race: Point[] = [P(47.6, 24), P(56, 21.5), P(64, 19.5), P(72, 17.5), P(79, 16.5)];
z.river(race, 1.5 * S, [{ at: P(64, 19.5), w: 1.6 * S, kind: 'bridge' }]);
z.lake(...P(82.5, 15.6), 3.6 * S, 2 * S);                       // mill pond at the end of the race
z.lake(...P(87, 65), 4.4 * S, 2.8 * S);                         // the chapel pond
z.ridge([P(6, 26), P(14, 23.5), P(22, 25.5), P(30, 21.5), P(37, 23)], 1.7 * S, [{ at: P(25, 24), w: 5 * S }]); // the pass where the overlook road crosses
z.hole('cliff', [P(58, 70), P(63, 68.5), P(66, 71.5), P(62, 75), P(57.5, 73.5)]); // a rock knot east of the bend

// Ground of the valley's parts (paint, roster, dressing; walking stays the field's).
z.area('camp', P(13, 69), [7 * S, 5.4 * S], { role: 'outpost', ground: 'dirt', dress: 0.3 });
z.area('road_meadow', P(26, 62), [9 * S, 7 * S], { ground: 'meadow', roster: meadow });
z.area('shallows', P(37, 62), [5.5 * S, 6 * S], { ground: 'mud', roster: bank });
z.area('charcoal', P(21, 49), [7 * S, 5 * S], { ground: 'dirt', roster: meadow });
z.area('hollow_oak', P(8.5, 46), [4 * S, 4 * S], { role: 'secret', ground: 'moss' });
z.area('old_ridge', P(19, 33), [10 * S, 6 * S], { roster: ridge });
z.area('overlook', P(30, 13), [8 * S, 6 * S], { ground: 'meadow', roster: ridge });
z.area('north_bank', P(60, 10.5), [9 * S, 5 * S], { roster: wood });
z.area('millrace_wood', P(66, 32), [9 * S, 7 * S], { ground: 'moss', roster: wood });
z.area('yard', P(57.5, 45), [6.5 * S, 5 * S], { role: 'yard', ground: 'dirt', roster: meadow });
z.area('bramble', P(68, 52), [8 * S, 6 * S], { roster: meadow });
z.area('bend', P(52, 63), [5.5 * S, 4.5 * S], { role: 'outpost', ground: 'meadow', dress: 0.3 });
z.area('chapel', P(80, 58), [7 * S, 6 * S], { role: 'ruin', ground: 'moss', roster: chapel });
z.area('mill_yard', P(77, 25), [6 * S, 4.4 * S], { role: 'yard', ground: 'dirt' });
z.area('upstream', P(90, 11), [5 * S, 5 * S], { ground: 'grass', roster: wood });
z.area('east_meadow', P(84, 38), [8 * S, 9 * S], { ground: 'meadow', roster: meadow });

// Groves and outcrops: obstacles that make lanes and cover, never walls.
for (const [x, y, r, n] of [[30, 40, 3.2, 9], [12, 58, 2.6, 7], [36, 50, 2, 5], [8, 40, 2.4, 6], [25, 7.5, 2.4, 6], [55, 30, 2.6, 7], [70, 42, 3, 8], [61, 57, 2.4, 6],
  [74, 66, 2.6, 7], [92, 50, 3, 8], [88, 28, 2.6, 7], [52, 72, 2.2, 5], [33, 72, 2.4, 6], [66, 8, 2.4, 6], [78, 46, 2, 5], [17, 15, 2.4, 6]] as const) z.grove(...P(x, y), r * S, n);
for (const [x, y] of [[20, 29], [33, 27], [10, 31]] as const) z.grove(...P(x, y), 1.6 * S, 4, ['boulder', 'boulder', 'pine']);

// Roads: the Timber Road (main, validated), the ridge loop and side tracks (painted; the field is walkable anyway).
z.road([P(13, 69), P(21, 65.5), P(30, 60), P(37, 52.5), P(42.4, 45.6)], 170, 'dirt');
z.road([P(48.8, 44.4), P(53, 45), P(57.5, 45), P(62.5, 39), P(67, 32), P(71.5, 27.5), P(76.5, 25.5)], 170, 'dirt');
z.road([P(76.5, 25.5), P(84.5, 24.5), P(89, 19), P(91.5, 12)], 150, 'dirt');
z.road([P(30, 60), P(24, 50.5), P(19.5, 40), P(24, 26), P(28.5, 17), P(36, 16.5), P(44, 18.5)], 140, 'dirt');
z.road([P(50.4, 19.5), P(57, 15), P(62.5, 16.5), P(63.6, 17.9), P(64.4, 21.1), P(66, 24), P(69, 27)], 140, 'dirt'); // over the race bridge along its deck
z.road([P(53, 45), P(52.5, 54), P(52, 62)], 140, 'dirt');
z.road([P(57.5, 45), P(63, 51), P(70, 55.5), P(78, 57.5)], 140, 'dirt');
z.road([P(21, 49), P(13, 47), P(9, 46)], 120, 'moss', { route: false });

// ─────────── Tender's Camp: Orren, the porters, the way home ───────────
z.camp(...P(13, 70.5), { tents: 2 });
z.contact('tender', 'Orren', ...P(15, 68.2), 'person');
z.portal(...P(8.5, 72.5), 'hearthmere', 'Return to Hearthmere');
z.resident('rw_porter', 'porter', 'Camp porter', ...P(10, 67.4), 20);
z.resident('rw_worker', 'worker', 'Timber hand', ...P(17.5, 72.4), -30);
z.resident('rw_cook', 'innkeeper', 'Camp cook', ...P(16, 71.4), -10);
z.resident('rw_guard', 'guard', 'Road watch', ...P(20.5, 66.6), 30);
z.walker('rw_haul', 'carpenter', [P(16, 69), P(21, 65.5), P(23, 57), P(21, 51)], 50, 5);
z.light(...P(15, 67.5), 0xffc070, 190);
z.landmark('Tender’s Camp', ...P(13, 74));
z.board(...P(17, 66.8), 'Tender’s Camp bounty board');
z.stores(...P(10.5, 66)); z.fence([P(17.5, 74.5), P(20.5, 73.6), P(22.5, 71.8)]);
z.moveTo('tender', 'rw_wheel', ...P(80.5, 27.2)); // once the wheel turns, Orren waits in the mill yard

// The first fight, a short walk up the Timber Road.
z.pack('road', ...P(26, 61.6), ['bog_slime', 'bog_slime', 'gloomshroom', 'gloomshroom', 'bog_slime', 'thornling', 'flint_beetle']);
z.structure('windmill', ...P(6.5, 61)); z.landmark('Old Windmill', ...P(6.5, 63.5));

// ─────────── Reed Shallows: the nest and the swarm ───────────
z.contact('reed_nest', 'Trampled reed nest', ...P(37.4, 64.2), 'marker');
z.pack('shallows', ...P(38.5, 60), ['bog_slime', 'reedclaw', 'bog_slime', 'reedclaw', 'bog_slime', 'gloomshroom', 'reedclaw', 'bog_slime']);
z.event('shallows_swarm', 'Swarm at the Shallows', 'reed_nest', 'shallows', 'Something has been nesting in the reeds. Stamp the nest flat and the whole bank will come for you.', 'Disturb the nest');
z.landmark('Reed Shallows', ...P(36, 66));
for (const [x, y] of [[39.5, 62], [40.4, 57], [39.8, 66.5]] as const) z.decor('reedclump', ...P(x, y), 1.1);

// ─────────── Charcoal Clearing and Hollow Oak ───────────
z.lumber(...P(23.5, 51.5)); z.resident('rw_burner', 'worker', 'Charcoal burner', ...P(19, 48.5), 0);
z.emit('smoke', ...P(20.5, 48), 6); z.decor('coalpile', ...P(21.2, 49.4)); z.light(...P(20.6, 48.6), 0xff9a50, 160, 0.3);
z.landmark('Charcoal Clearing', ...P(21, 53));
z.decor('oak', ...P(7, 44), 1.6, 2); z.shrine('shrine_oak', ...P(9.8, 45.6), 'keen'); z.cache('cache_oak', ...P(6.8, 48.4), 'Root-wrapped cache');
z.landmark('Hollow Oak', ...P(8.5, 50.5)); z.emit('fireflies', ...P(8.5, 46), 10);

// ─────────── Old Ridge: the high-water survey and the lost party's camp ───────────
z.location('old_ridge', ...P(19, 31.5));
z.pack('ridge', ...P(23, 35), ['grave_bat', 'grave_bat', 'gloomshroom', 'thornling', 'flint_beetle', 'gloomshroom', 'grave_bat']);
z.contact('party_camp', 'Abandoned survey camp', ...P(13.5, 35), 'cart');
z.solid('tent', ...P(11.6, 33.2), 0.9, 2); z.decor('banner', ...P(15.4, 32.6)); z.decor('crate', ...P(15.8, 36.8)); z.graves(...P(25.5, 30.5), 3);
z.shrine('shrine_ridge', ...P(28.5, 29.5), 'empowered');
z.structure('stonetower', ...P(9.5, 29), 1);
z.landmark('Old Ridge', ...P(19, 37.5)); z.landmark('Ridge Pass', ...P(24, 27.5));

// ─────────── The Overlook beyond the pass: survey marker and its alarm ───────────
z.contact('survey', 'Survey marker', ...P(33, 12.6), 'marker');
z.contact('overlook_fire', 'Signal fire', ...P(36.6, 15.1), 'pyre'); // beside the road, not on it
z.phase('rw_signal', true, () => { z.fire(...P(36.6, 15.16), 1.6); z.emit('smoke', ...P(36.6, 13.7), 8); z.emit('embers', ...P(36.6, 14.5), 5); z.light(...P(36.6, 14.1), 0xff9a50, 260, 0.3); });
z.pack('overlook', ...P(29.5, 16), ['mossback', 'thornling', 'bog_slime', 'bog_slime', 'grave_bat', 'gloomshroom', 'flint_beetle']);
z.event('survey_alarm', 'The Overlook Alarm', 'survey', 'overlook', 'Raise the alarm at the survey marker to draw out the creatures nesting around the overlook.', 'Raise the alarm');
z.decor('signpost', ...P(30, 12)); z.structure('watchtower', ...P(26, 10.5)); z.landmark('The Overlook', ...P(32, 19));

// ─────────── East bank: the cart, the yard, Fisher's Bend ───────────
z.contact('cart', 'Abandoned timber cart', ...P(56, 42.6), 'cart');
z.wreck(...P(59.5, 42.2));
z.pack('yard', ...P(60, 48), ['gloomshroom', 'bog_slime', 'bog_slime', 'reedclaw', 'gloomshroom', 'grave_bat', 'flint_beetle']);
z.decor('logpile', ...P(53.8, 48)); z.decor('crate', ...P(61.5, 44.5)); z.decor('crate', ...P(62, 45.3), 0.9, 1);
z.shrine('shrine_yard', ...P(54, 49.5), 'frenzied');
z.structure('ruinhouse', ...P(53, 41.5)); z.landmark('Abandoned Yard', ...P(57.5, 51));
z.walker('rw_scout', 'guard', [P(54, 44), P(58, 44), P(61.5, 41), P(58, 47)], 45, 4);
z.fishery(...P(50.5, 64.5)); z.resident('rw_fisher', 'fisher', 'Bend fisher', ...P(48.2, 62.4), 40); z.cache('cache_bend', ...P(54, 61.2), 'Fisher’s tackle chest');
z.decor('rowboat', ...P(46.2, 63.5), 1, 1); z.structure('house', ...P(52.5, 59.5), 2); z.structure('dryingrack', ...P(55.5, 66), 2);
z.resident('rw_net', 'carpenter', 'Net mender', ...P(53.2, 64.6), -20); z.decor('lamppost', ...P(49.5, 66)); z.light(...P(49.5, 65.2), 0xffc070, 180);
z.walker('rw_fisher2', 'fisher', [P(48.2, 62.4), P(50, 58.5), P(52, 52), P(50, 58.5)], 40, 6);
z.structure('boatwreck', ...P(41, 74)); z.landmark('Fisher’s Bend', ...P(51.5, 68.5));

// ─────────── Drowned Chapel: ruins by the pond, the journal and an old guardian ───────────
z.ruins(...P(80.5, 57), 460, 320); z.graves(...P(76, 61.5), 6);
z.contact('party_journal', 'Waterlogged field journal', ...P(78.6, 56.2), 'ledger');
z.elite('chapel_rare', ...P(82.5, 60.5), 'mossback', 'Hollowbell', ['fast'], ['grave_bat', 'grave_bat', 'gloomshroom', 'vault_moth']);
z.cache('cache_chapel', ...P(84.5, 54.5), 'Chapel offering box');
z.structure('statue', ...P(76, 53)); z.landmark('Drowned Chapel', ...P(80, 63.5));
z.emit('fireflies', ...P(82, 60), 8);

// ─────────── North Bank and the Millrace Wood: Brackjaw ───────────
z.elite('brackjaw', ...P(60, 12), 'mossback', 'Brackjaw', ['fast'], ['thornling', 'bog_slime', 'bog_slime', 'grave_bat'], { questTarget: true });
z.landmark('North Bank', ...P(57, 8.5)); z.landmark('Millrace Wood', ...P(66, 36));

// ─────────── Rillwake Mill: a house on the race, its wheel in the pond, Siltroot in the yard ───────────
z.structure('house', ...P(77.5, 19.6), 1);
z.structure('waterwheel', ...P(79.6, 17.6), 0, false, 'rw_wheel'); // on the house's east wall, its foot in the race mouth
z.pack('mill', ...P(75, 27.6), [{ type: 'mossback', dx: 0, dy: 0, tier: 2, name: 'Siltroot, the Wheelkeeper', questTarget: true }, 'bog_slime', 'bog_slime', 'gloomshroom', 'thornling', 'flint_beetle']);
z.contact('ledger', 'Mill ledger', ...P(78.8, 22.6), 'ledger');
z.contact('mill_brake', 'Wheel brake', ...P(80.9, 18.8), 'mechanism');
z.decor('barrels', ...P(82.5, 23.8)); z.decor('crates', ...P(74.5, 23.2)); z.light(...P(78, 23.4), 0xffc070, 170);
// The wheel turns (rw_wheel): spray and light at the wheel, the millhands back in the yard and its lamps lit.
z.phase('rw_wheel', true, () => {
  z.emit('fog', ...P(79.6, 16.6), 3); z.light(...P(79.6, 16.4), 0x9ad8ff, 200);
  z.resident('rw_millhand1', 'worker', 'Millhand', ...P(74, 26), 20); z.resident('rw_millhand2', 'carpenter', 'Millwright', ...P(80.8, 26.8), -30);
  z.decor('lamppost', ...P(73.2, 24)); z.light(...P(73.2, 23.3), 0xffc070, 180); z.decor('crates', ...P(71.5, 26.5), 0.9);
});
z.landmark('Rillwake Mill', ...P(79, 28.6));

// ─────────── The upstream path: Wenna, then the way on ───────────
z.portal(...P(92, 9.5), 'bracken_sluice', 'Upstream to Bracken Sluice');
z.landmark('Upstream Path', ...P(89.5, 14.5));
z.contact('wenna', 'Wenna · Survey lead', ...P(88.5, 13.4), 'person'); z.appear('wenna', 'rw_wenna');
z.phase('rw_wenna', true, () => { z.decor('tent', ...P(92.5, 13.6), 0.8, 1); z.decor('crate', ...P(89, 16.2), 0.8); });
z.phase('rw_survey_home', true, () => {
  z.resident('rw_wenna', 'scholar', 'Wenna · Survey lead', ...P(83.5, 26.6), -20); z.resident('rw_surveyor1', 'worker', 'Surveyor', ...P(85.2, 28.2), 10);
  z.resident('rw_surveyor2', 'pilgrim', 'Surveyor', ...P(70.5, 30.5), 30); z.resident('rw_surveyor3', 'porter', 'Surveyor', ...P(69, 28.8), -10);
});

// ─────────── Life, sound, mist ───────────
for (const [x, y] of [P(46, 40), P(43.5, 60), P(47, 14), P(63, 20)]) { z.sound('water', x, y); z.mist(x, y + 120, 460); }
for (const [x, y] of [P(20, 33), P(60, 10), P(82, 58), P(85, 38)]) z.sound('wind', x, y);
z.emit('birds', ...P(30, 40), 4); z.emit('leaves', ...P(66, 32), 6); z.emit('birds', ...P(85, 40), 3);
z.critters('deer', ...P(86, 40), 260, 2); z.critters('hares', ...P(27, 60), 220, 3);

// Packs everywhere else: about one every 860 u, smaller near the camp (first zone, levels 1–4).
z.fill({ roster: meadow, spacing: 720, size: [5, 9], champion: 0.08, rare: 0.05, clear: 1100 });
export const RILLWAKE = z.build();
