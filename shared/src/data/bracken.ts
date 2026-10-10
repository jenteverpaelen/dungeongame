import type { Point } from '../townTypes';
import { ZoneBuilder, riverPoly, rect } from '../zoneKit';

// Bracken Sluice (L4–7) — docs/rework/worlds/DESIGN.md §2. Plan units: 100 wide (S u each).
// Ids kept: floodgate; causeway, basin, bank, keeper; forecourt; portals to rillwake, pumpworks, cairnspill.
const S = 92.16, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
const z = new ZoneBuilder('bracken_sluice', [144, 120], 'sluice', P(10, 70), { theme: 'glade' });
const marsh = ['bog_slime', 'reedclaw', 'thornling', 'gloomshroom'], bats = ['grave_bat', 'grave_bat', 'reedclaw', 'bog_slime'], works = ['siltusk', 'gloomshroom', 'thornling', 'bog_slime'];

// The flood runs north–south; the spillway pours in from the north-east.
z.land('water', riverPoly([P(41, -2), P(42, 18), P(40.5, 38), P(42, 56), P(39, 70), P(41, 86)], 6.2 * S));
z.land('water', riverPoly([P(56, 3), P(66, 6), P(78, 5), P(92, 7)], 3.2 * S));
z.land('reeds', riverPoly([P(35, 62), P(34.5, 70), P(35.5, 78)], 2 * S));
z.land('mud', riverPoly([P(48, 66), P(52, 71), P(56, 70)], 2.4 * S));

z.region('camp', P(10.5, 70), [6 * S, 4.6 * S], { role: 'outpost', ground: 'dirt' });
z.region('lower_road', P(22, 63), [5.2 * S, 3.6 * S], { roster: marsh, packs: 1, ground: 'meadow' });
z.region('basin', P(56, 59), [7.4 * S, 5.6 * S], { roster: marsh, packs: 2, ground: 'mud' });
z.region('weir', P(50, 72), [4.6 * S, 3.4 * S], { roster: marsh, packs: 1, ground: 'mud' });
z.region('steps', P(63, 44), [5.6 * S, 4.2 * S], { role: 'yard', ground: 'stone', roster: works, packs: 1 });
z.region('forecourt', P(64.5, 31), [6.6 * S, 4.4 * S], { role: 'arena', ground: 'flag' });
z.region('floodgate', P(67, 15.5), [7.5 * S, 4.6 * S], { role: 'arena', ground: 'stone', dress: 0 });
z.region('bank_path', P(19, 44), [6 * S, 4.8 * S], { roster: bats, packs: 1 });
z.region('orchard', P(10.5, 30), [6.4 * S, 5 * S], { role: 'secret', ground: 'moss', roster: marsh, packs: 1 });
z.region('far_bank', P(29, 25), [5 * S, 4 * S], { roster: bats, packs: 1 });
z.region('hatch', P(80, 42), [6 * S, 4.6 * S], { role: 'yard', ground: 'dirt', roster: works, packs: 1 });
z.region('reedbed', P(76, 62), [6.4 * S, 4.8 * S], { roster: marsh, packs: 2, ground: 'meadow' });
z.region('upper_track', P(85, 20), [5 * S, 4 * S], { roster: works, packs: 1 });

z.road([P(10.5, 70), P(18, 66), P(24, 62.5), P(31, 58), P(35.5, 56)], 170, 'dirt');
z.road([P(35.5, 56), P(48, 56)], 210, 'planks', { bridge: true });
z.road([P(48, 56), P(56, 58), P(60.5, 51), P(63, 44), P(64.5, 36), P(64.5, 31), P(66, 24), P(67, 19)], 170, 'flag');
z.road([P(24, 62.5), P(20, 54), P(19, 44), P(21, 35), P(29, 27), P(35.5, 27)], 140, 'dirt');
z.road([P(35.5, 27), P(47, 27)], 170, 'planks', { bridge: true });
z.road([P(47, 27), P(55, 29), P(64.5, 31)], 140, 'flag');
z.road([P(21, 35), P(14, 31), P(10.5, 30)], 130, 'moss');
z.road([P(63, 44), P(72, 43), P(80, 42)], 150, 'dirt');
z.road([P(56, 58), P(50.5, 66), P(50, 72)], 140, 'dirt');
z.road([P(60.5, 51), P(68, 57), P(76, 62)], 140, 'dirt');
z.road([P(66, 24), P(76, 22), P(85, 20), P(89, 12)], 150, 'dirt');

// Maintenance camp: Orren's crew keeps a foothold above the flood.
z.camp(...P(11, 71), { tents: 2 });
z.portal(...P(6.5, 72.5), 'rillwake_crossing', 'Back to Rillwake Crossing');
z.resident('br_foreman', 'worker', 'Sluice foreman', ...P(14.5, 67.5), -20);
z.resident('br_guard', 'guard', 'Causeway watch', ...P(17.5, 70.5), 30);
z.decor('noticeboard', ...P(8, 66.5)); z.decor('cart', ...P(5.5, 68.6));
z.landmark('Maintenance Camp', ...P(10.5, 74));

z.pack('causeway', ...P(28.5, 60), ['thornling', 'bog_slime', 'gloomshroom', 'grave_bat', 'bog_slime']);
z.landmark('Sluice Causeway', ...P(41.5, 58.5));
z.pack('basin', ...P(57, 61), ['siltusk', 'gloomshroom', 'thornling', 'bog_slime', 'grave_bat']);
z.decor('rowboat', ...P(46.4, 63), 1, 2); z.decor('barrels', ...P(60.5, 55)); z.landmark('Flooded Basin', ...P(56, 64));
z.contact('weir_valve', 'Jammed weir valve', ...P(47.5, 74), 'mechanism');
z.pack('weir', ...P(51.5, 70.5), ['reedclaw', 'bog_slime', 'reedclaw', 'siltusk', 'bog_slime', 'reedclaw']);
z.event('bursting_weir', 'The Bursting Weir', 'weir_valve', 'weir', 'The weir valve is jammed with silt and something has made a nest of the overflow. Free it and they come out of the water.', 'Force the valve');
z.landmark('Old Weir', ...P(50, 75.5));
z.shrine('shrine_steps', ...P(59.6, 45), 'frenzied');
z.decor('lamppost', ...P(61, 40.5)); z.decor('lamppost', ...P(67, 40.5)); z.landmark('Gatehouse Steps', ...P(63, 47.5));

// The forecourt (reach), the keeper, and the floodgate with its wheel against the spillway wall.
z.location('forecourt', ...P(64.5, 32));
z.pack('keeper', ...P(66, 24.5), [{ type: 'mossback', dx: 0, dy: 0, tier: 2, name: 'The Rootbound Keeper', questTarget: true, combat: 'keeper' }]);
z.wall(rect(58 * S, 11 * S, 3.4 * S, 0.5 * S)); z.wall(rect(73 * S, 11 * S, 3.4 * S, 0.5 * S));
z.contact('floodgate', 'Floodgate mechanism', ...P(65, 14), 'mechanism');
z.wheel = { x: Math.round(71 * S), y: Math.round(13 * S), radius: 38 };
z.decor('pillar', ...P(60, 18.5), 1, 1); z.decor('pillar', ...P(74, 18.5)); z.light(...P(65, 13.5), 0xffc070, 170);
z.landmark('Spillway Forecourt', ...P(64.5, 35)); z.landmark('Floodgate', ...P(67, 19.5));

// Bank path (contract bats), the sunken orchard secret, the far bank.
z.pack('bank', ...P(18.5, 45), ['grave_bat', 'grave_bat', 'reedclaw', 'bog_slime', 'grave_bat']);
z.landmark('Bank Path', ...P(19, 48));
for (const [x, y] of [P(7, 28), P(12, 26.5), P(14.5, 32.5), P(8, 33.5)]) z.decor('deadtree', x, y, 1.1);
z.cache('cache_orchard', ...P(9, 30.5), 'Drowned orchard crate'); z.shrine('shrine_orchard', ...P(13.5, 28.5), 'keen');
z.landmark('Sunken Orchard', ...P(10.5, 34.5));
z.elite('grindle', ...P(29.5, 23.5), 'siltusk', 'Old Grindle', ['fast'], ['grave_bat', 'reedclaw', 'bog_slime']);
z.landmark('Far Bank', ...P(29, 28.5));

// Pumpworks hatch yard and the reed bed; the stair road north to Cairnspill.
z.portal(...P(82.5, 39.5), 'reedvault_pumpworks', 'Reedvault Pumpworks · solo dungeon');
z.decor('crates', ...P(77, 39.5)); z.decor('barrels', ...P(84.5, 45)); z.decor('anvil', ...P(78, 45.5)); z.light(...P(82.5, 38.5), 0x9ad8ff, 160);
z.cache('cache_hatch', ...P(85.5, 43), 'Maintenance locker');
z.landmark('Pumpworks Hatch', ...P(80, 46));
z.fishery(...P(73, 64)); z.resident('br_fisher', 'fisher', 'Reed cutter', ...P(78.5, 60), 10); z.landmark('Reed Bed', ...P(76, 66));
z.portal(...P(88.6, 12.8), 'cairnspill_terraces', 'Cairnspill Terraces');
z.landmark('Stair Road', ...P(85, 23.5));

for (const [x, y] of [P(41, 50), P(41, 30), P(70, 6)]) { z.sound('water', x, y); z.mist(x, y + 100, 420); }
for (const [x, y] of [P(10, 70), P(63, 40), P(85, 20)]) z.sound('wind', x, y);
z.emit('birds', ...P(56, 50), 4); z.emit('fireflies', ...P(10, 30), 10); z.emit('fog', ...P(42, 64), 3); z.emit('leaves', ...P(19, 44), 5);
z.critters('frogs', ...P(52, 70), 120, 4); z.critters('birds', ...P(76, 62), 200, 5);

export const BRACKEN = z.build();
