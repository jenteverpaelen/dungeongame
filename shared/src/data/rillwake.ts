import type { Point } from '../townTypes';
import { ZoneBuilder, riverPoly, rect } from '../zoneKit';

// Rillwake Crossing (L1–4) — docs/rework/worlds/DESIGN.md §2. Plan units: the map is 100 × 80 plan units (S u each).
// Ids kept: tender, cart, ledger, survey (contacts); road, yard, ridge, overlook, mill (encounters); old_ridge; survey_alarm.
const S = 102.4, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
const z = new ZoneBuilder('rillwake_crossing', [160, 128], 'meadow', P(10, 71.5), { theme: 'glade' });
const slimes = ['bog_slime', 'gloomshroom', 'bog_slime', 'thornling'], wood = ['gloomshroom', 'thornling', 'grave_bat', 'bog_slime'], bank = ['bog_slime', 'reedclaw', 'gloomshroom', 'bog_slime'];

// The Rill runs north–south through the middle; a millrace feeds the mill in the north-east.
const rill = [P(45, -2), P(43, 15), P(46, 30), P(42.5, 44), P(44, 58), P(41, 70), P(43, 82)];
z.land('water', riverPoly(rill, 4.2 * S));
z.land('reeds', riverPoly([P(37.5, 60), P(38.5, 66), P(38, 71)], 2.2 * S));
z.land('water', rect(68 * S, 4.5 * S, 22 * S, 2.6 * S));
z.land('mud', riverPoly([P(48, 60), P(48.5, 66)], 1.5 * S));

// Regions (route order) — outposts have no packs.
z.region('camp', P(12.5, 69.5), [6 * S, 4.6 * S], { role: 'outpost', ground: 'dirt' });
z.region('road_meadow', P(24.5, 63), [4.2 * S, 3 * S], { ground: 'meadow' });
z.region('shallows', P(34, 64), [5.6 * S, 4.6 * S], { roster: bank, packs: 2, ground: 'meadow' });
z.region('charcoal', P(22, 52), [6 * S, 4.4 * S], { roster: slimes, packs: 2 });
z.region('hollow_oak', P(8, 49.5), [3.6 * S, 3 * S], { role: 'secret', ground: 'moss' });
z.region('ridge', P(19.5, 34), [7.2 * S, 5.2 * S], { roster: wood, packs: 2 });
z.region('overlook', P(33, 23.5), [5.2 * S, 4 * S], { ground: 'meadow' });
z.region('north_bank', P(57.5, 24.5), [8.5 * S, 5.6 * S], { roster: wood, packs: 3 });
z.region('yard', P(57.5, 48), [6.2 * S, 4.6 * S], { role: 'yard', ground: 'dirt', roster: slimes, packs: 1 });
z.region('bramble', P(66, 57), [6 * S, 4.4 * S], { roster: slimes, packs: 2 });
z.region('bend', P(50.5, 64), [4.6 * S, 3.8 * S], { role: 'outpost', ground: 'meadow' });
z.region('chapel', P(82, 61), [5.6 * S, 4.6 * S], { role: 'ruin', ground: 'moss', roster: wood, packs: 1 });
z.region('millrace', P(68.5, 35.5), [6.6 * S, 4.8 * S], { roster: wood, packs: 2 });
z.region('mill_yard', P(75, 26), [5.6 * S, 4 * S], { role: 'arena', ground: 'dirt' });
z.region('mill', P(79, 15.5), [5 * S, 3.4 * S], { role: 'room', ground: 'planks', poly: rect(74 * S, 12 * S, 10 * S, 7.5 * S), dress: 0 });
z.region('upstream', P(91, 11), [4 * S, 3.4 * S], { ground: 'grass' });

// Roads: the Timber Road (main), the ridge loop, side tracks. Bridges cross the painted river.
z.road([P(12.5, 69.5), P(20, 67), P(28, 64.6), P(33, 59), P(35, 52), P(34.2, 46.5), P(38.5, 44)], 170, 'dirt');
z.road([P(38.5, 44), P(46.8, 44)], 200, 'planks', { bridge: true });
z.road([P(46.8, 44), P(52, 46), P(57.5, 47.5), P(63, 42), P(66.5, 36.5), P(70.5, 31), P(75, 26.5), P(78.8, 20.5), P(78.8, 17.5)], 170, 'dirt');
z.road([P(34.6, 50.5), P(28, 45), P(22.5, 38.5), P(20, 33.5), P(26, 27.5), P(33, 23.5), P(40.6, 22)], 140, 'dirt');
z.road([P(40.6, 22), P(48.6, 22)], 170, 'planks', { bridge: true });
z.road([P(48.6, 22), P(57.5, 24.5), P(64, 27.5), P(70.5, 31)], 140, 'dirt');
z.road([P(52, 46), P(51, 53), P(50.5, 62)], 140, 'dirt');
z.road([P(57.5, 47.5), P(62, 53), P(66, 57), P(74.5, 59.5), P(82, 61)], 140, 'dirt');
z.road([P(22, 52), P(15, 50.5), P(8.5, 49.5)], 130, 'moss');
z.road([P(27, 64.6), P(24.5, 58), P(22, 52)], 140, 'dirt');
z.road([P(75, 26.5), P(83, 24), P(89, 17), P(91, 11)], 150, 'dirt');

// Camp: Orren, the people who keep the road, and the way home.
z.camp(P(12.5, 70.5)[0], P(12.5, 70.5)[1], { tents: 2 });
z.contact('tender', 'Orren', ...P(14, 68.4), 'person');
z.portal(...P(8, 72), 'hearthmere', 'Return to Hearthmere');
z.resident('rw_porter', 'porter', 'Camp porter', ...P(9.5, 67.5), 20);
z.resident('rw_worker', 'worker', 'Timber hand', ...P(16.5, 72.5), -30);
z.walker('rw_haul', 'carpenter', [P(15, 69), P(20, 66.6), P(22, 56), P(20.5, 53)], 50, 5);
z.light(...P(14, 67.5), 0xffc070, 180);
z.landmark('Tender’s Camp', ...P(12.5, 72));

// The road above camp: the first fight, a short way from Orren.
z.pack('road', ...P(24, 62.6), ['bog_slime', 'bog_slime', 'gloomshroom', 'gloomshroom', 'bog_slime', 'thornling']);
z.contact('reed_nest', 'Trampled reed nest', ...P(35.2, 66.5), 'marker');
z.pack('shallows', ...P(36.5, 62.5), ['bog_slime', 'reedclaw', 'bog_slime', 'reedclaw', 'bog_slime', 'gloomshroom', 'bog_slime']);
z.event('shallows_swarm', 'Swarm at the Shallows', 'reed_nest', 'shallows', 'Something has been nesting in the reeds. Stamp the nest flat and the whole bank will come for you.', 'Disturb the nest');
z.landmark('Reed Shallows', ...P(34, 64));
z.lumber(...P(24, 53.5)); z.resident('rw_burner', 'worker', 'Charcoal burner', ...P(19.5, 50.5), 0);
z.emit('smoke', ...P(21, 50), 6); z.decor('coalpile', ...P(21.5, 51.2)); z.light(...P(21, 50.5), 0xff9a50, 150, 0.3);
z.landmark('Charcoal Clearing', ...P(22, 54));

// Hollow Oak (secret): a shrine and a cache behind the charcoal track.
z.decor('oak', ...P(7, 47.5), 1.5, 2); z.shrine('shrine_oak', ...P(9.5, 48.6), 'keen'); z.cache('cache_oak', ...P(6.5, 51), 'Root-wrapped cache');
z.landmark('Hollow Oak', ...P(8, 52));

// Old Ridge: the high-water survey and the lost party's camp.
z.location('old_ridge', ...P(20, 33));
z.pack('ridge', ...P(23.5, 37), ['grave_bat', 'grave_bat', 'gloomshroom', 'thornling', 'bog_slime', 'gloomshroom']);
z.contact('party_camp', 'Abandoned survey camp', ...P(14, 36.5), 'cart');
z.solid('tent', ...P(12.2, 34.6), 0.9, 2); z.decor('banner', ...P(16, 34)); z.decor('crate', ...P(15.5, 38.2)); z.graves(...P(25, 31.5), 3);
z.shrine('shrine_ridge', ...P(17.5, 30.5), 'empowered');
z.landmark('Old Ridge', ...P(19.5, 36));

// The overlook: survey marker and its alarm.
z.contact('survey', 'Survey marker', ...P(33.5, 21.6), 'marker');
z.pack('overlook', ...P(32, 25), ['mossback', 'thornling', 'bog_slime', 'bog_slime', 'grave_bat', 'gloomshroom']);
z.event('survey_alarm', 'The Overlook Alarm', 'survey', 'overlook', 'Raise the alarm at the survey marker to draw out the creatures nesting around the overlook.', 'Raise the alarm');
z.decor('signpost', ...P(30.5, 22)); z.landmark('The Overlook', ...P(33, 26));

// East bank: the cart, the yard, the bend where Orren's fisher works.
z.contact('cart', 'Abandoned timber cart', ...P(56.5, 45.6), 'cart');
z.wreck(...P(59.5, 45.2));
z.pack('yard', ...P(59.5, 50.5), ['gloomshroom', 'bog_slime', 'bog_slime', 'reedclaw', 'gloomshroom', 'grave_bat']);
z.decor('logpile', ...P(54, 50.2)); z.decor('crate', ...P(61.5, 47.5)); z.decor('crate', ...P(62, 48.3), 0.9, 1);
z.shrine('shrine_yard', ...P(53.4, 51.5), 'frenzied');
z.landmark('Abandoned Yard', ...P(57.5, 51));
z.fishery(...P(51.5, 65.5)); z.resident('rw_fisher', 'fisher', 'Bend fisher', ...P(48.6, 63.6), 40); z.cache('cache_bend', ...P(53.4, 62.2), 'Fisher’s tackle chest');
z.decor('rowboat', ...P(46.4, 66.5), 1, 1); z.landmark('Fisher’s Bend', ...P(50.5, 67));

// Drowned Chapel: ruins, graves, the lost party's journal and an old guardian.
z.ruins(...P(83.5, 59), 420, 300); z.graves(...P(79.5, 63.5), 6);
z.contact('party_journal', 'Waterlogged field journal', ...P(81, 58.5), 'ledger');
z.elite('chapel_rare', ...P(84, 63), 'mossback', 'Hollowbell', ['fast'], ['grave_bat', 'grave_bat', 'gloomshroom']);
z.cache('cache_chapel', ...P(86.5, 57.6), 'Chapel offering box');
z.landmark('Drowned Chapel', ...P(82, 64.5));

// North bank and the millrace wood; Brackjaw hunts here.
z.elite('brackjaw', ...P(60.5, 20.5), 'mossback', 'Brackjaw', ['fast'], ['thornling', 'bog_slime', 'bog_slime'], { questTarget: true });
z.landmark('North Bank', ...P(57.5, 27)); z.landmark('Millrace Wood', ...P(68.5, 38));

// Mill yard, Siltroot, the open mill shell with the ledger and the wheel on the race.
z.pack('mill', ...P(75, 27.2), [{ type: 'mossback', dx: 0, dy: 0, tier: 2, name: 'Siltroot, the Wheelkeeper', questTarget: true }, 'bog_slime', 'bog_slime', 'gloomshroom', 'thornling']);
z.wall(rect(74 * S, 12 * S, 10 * S, 0.4 * S)); z.wall(rect(74 * S, 12 * S, 0.4 * S, 7.5 * S)); z.wall(rect(83.6 * S, 12 * S, 0.4 * S, 7.5 * S));
z.wall(rect(74 * S, 19.1 * S, 3 * S, 0.4 * S)); z.wall(rect(80.6 * S, 19.1 * S, 3.4 * S, 0.4 * S));
z.contact('ledger', 'Mill ledger', ...P(76.5, 14), 'ledger');
z.wheel = { x: Math.round(84.8 * S), y: Math.round(9.6 * S), radius: 38 };
z.decor('barrels', ...P(81.5, 14)); z.decor('crates', ...P(82, 17)); z.light(...P(78.5, 13.5), 0xffc070, 160);
z.landmark('Rillwake Mill', ...P(79, 21.5));
z.portal(...P(93.5, 9.5), 'bracken_sluice', 'Upstream to Bracken Sluice');
z.landmark('Upstream Path', ...P(91, 14));

// Sound and mist.
for (const [x, y] of [P(44, 40), P(43, 60), P(45, 20)]) { z.sound('water', x, y); z.mist(x, y + 120, 420); }
for (const [x, y] of [P(20, 35), P(60, 25), P(80, 60)]) z.sound('wind', x, y);
z.emit('birds', ...P(30, 40), 4); z.emit('leaves', ...P(57, 25), 6); z.emit('fireflies', ...P(9, 49), 10); z.emit('fireflies', ...P(82, 60), 8);

// Second pass (LOG W4): big landmarks seen from afar, more people at work.
z.structure('windmill', ...P(6.5, 60.5)); z.landmark('Old Windmill', ...P(6.5, 57));
z.structure('watchtower', ...P(36.5, 40.5)); z.structure('ruinhouse', ...P(52.6, 44.6)); z.structure('stonetower', ...P(10, 28.5), 1);
z.structure('boatwreck', ...P(46.5, 70.5)); z.structure('statue', ...P(89.5, 62.5));
z.resident('rw_cook', 'innkeeper', 'Camp cook', ...P(15.5, 71.2), -10); z.resident('rw_guard', 'guard', 'Road watch', ...P(19.2, 66.8), 30);
z.walker('rw_fisher2', 'fisher', [P(48.6, 63.6), P(50.5, 60.5), P(52, 53), P(50.5, 60.5)], 40, 6);
z.walker('rw_scout', 'guard', [P(54, 47), P(58, 47), P(61.5, 44), P(58, 49.5)], 45, 4);
z.stores(...P(10.5, 66.5)); z.fence([P(16.5, 74), P(19.5, 73.2), P(21.5, 71.5)]);
z.structure('house', ...P(48.5, 60.6), 2); z.stores(...P(52.8, 66.5)); z.structure('dryingrack', ...P(55, 63.4), 2);
z.resident('rw_net', 'carpenter', 'Net mender', ...P(53.5, 64.8), -20); z.decor('lamppost', ...P(49.5, 66.4)); z.light(...P(49.5, 65.6), 0xffc070, 180);
export const RILLWAKE = z.build();
