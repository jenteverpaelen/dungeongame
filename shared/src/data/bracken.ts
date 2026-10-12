import type { Point } from '../townTypes';
import { ZoneBuilder, rect } from '../zoneKit';

// Bracken Sluice (L4–7), open-field rebuild 2026-10-12 (docs/rework/worlds/OPEN.md; Act I, §7): a wide flood valley the
// hero can cross anywhere. The flood runs north–south (two bridges and a ford), the spillway pours along the north edge
// behind the floodgate, and an embankment with two passes keeps the gate terrace above the flooded basin. Plan units: the
// map is 100 × 80 (S u each). Ids kept: foreman, cog_basin, cog_weir, cog_reeds, weir_valve, floodgate, weir_tally
// (contacts); causeway, basin, weir, keeper, bank, grindle (encounters); forecourt; bursting_weir; cache_orchard,
// cache_hatch; shrine_steps, shrine_orchard; br_drained, br_weir, br_pumping; portals to rillwake, pumpworks, cairnspill.
const S = 102.4, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
const z = new ZoneBuilder('bracken_sluice', [160, 128], 'sluice', P(10, 70), { theme: 'glade' });

// Rosters by part of the valley (2–3 kinds per pack; the field roster where no area claims the ground).
const marsh = ['bog_slime', 'reedclaw', 'thornling', 'gloomshroom'], bats = ['grave_bat', 'grave_bat', 'reedclaw', 'bog_slime'];
const works = ['siltusk', 'gloomshroom', 'thornling', 'bog_slime'], wood = ['grave_bat', 'vault_moth', 'gloomshroom', 'thornling'];

// ─────────── land and water ───────────
z.open({ margin: 300, ground: 'grass' });
const flood: Point[] = [P(41, -3), P(42, 16), P(40.5, 34), P(42, 50), P(39.5, 64), P(41, 83)];
z.river(flood, 5.2 * S, [
  { at: P(41.1, 27), w: 1.8 * S, kind: 'bridge' },    // the north bridge to the far bank
  { at: P(40.9, 56), w: 2.2 * S, kind: 'bridge' },    // Sluice Causeway, the main road
  { at: P(40.1, 72), w: 3.4 * S, kind: 'ford' },      // the ford below the old weir
]);
z.river([P(43, 6), P(52, 5), P(60, 6.5), P(70, 7.5), P(82, 6), P(97, 7)], 3 * S, []); // the spillway behind the gate
z.ridge([P(48, 40), P(56, 38.5), P(64, 37.5), P(72, 37), P(80, 36.5), P(90, 35.5), P(98, 35)], 1.6 * S, [
  { at: P(64.5, 37.5), w: 4.5 * S },                  // the Gatehouse Steps
  { at: P(90, 35.5), w: 4 * S },                      // the east pass to the upper track
]);
z.lake(...P(6.5, 23), 2.8 * S, 1.6 * S);              // the drowned orchard pond
z.hole('reeds', [P(33, 61), P(35.5, 60), P(36.2, 66), P(35, 71), P(32.8, 68)]); // a reed bank west of the causeway
z.hole('cliff', [P(22, 9), P(27, 7.5), P(30, 11), P(26.5, 14), P(21.5, 12.5)]); // a rock knot above the far bank

// Ground of the valley's parts (paint, roster, dressing; walking stays the field's).
z.area('camp', P(10.5, 70), [6.5 * S, 5 * S], { role: 'outpost', ground: 'dirt', dress: 0.3 });
z.area('lower_road', P(22, 63), [6 * S, 4.5 * S], { ground: 'meadow', roster: marsh });
const basin = z.area('basin', P(56, 59), [7.4 * S, 5.6 * S], { ground: 'mud', roster: marsh });
const weir = z.area('weir', P(50, 72), [4.6 * S, 3.4 * S], { ground: 'mud', roster: marsh });
z.area('steps', P(63, 44), [5.6 * S, 4.2 * S], { role: 'yard', ground: 'stone', roster: works });
z.area('forecourt', P(64.5, 30), [6.6 * S, 4.4 * S], { role: 'arena', ground: 'flag', dress: 0.2 });
z.area('floodgate', P(67, 15.5), [7.5 * S, 4.6 * S], { role: 'arena', ground: 'stone', dress: 0 });
z.area('bank_path', P(19, 44), [6 * S, 4.8 * S], { roster: bats });
z.area('orchard', P(10.5, 30), [6.4 * S, 5 * S], { role: 'secret', ground: 'moss', roster: marsh });
z.area('far_bank', P(29, 25), [6 * S, 5 * S], { roster: bats });
z.area('hatch', P(80, 46), [6 * S, 4.6 * S], { role: 'yard', ground: 'dirt', roster: works });
z.area('reedbed', P(76, 62), [6.4 * S, 4.8 * S], { ground: 'meadow', roster: marsh });
z.area('upper_track', P(85, 22), [6 * S, 5 * S], { roster: works });
z.area('east_fields', P(89, 52), [7 * S, 8 * S], { ground: 'meadow', roster: marsh });
z.area('alder_wood', P(68, 74), [8 * S, 4.5 * S], { ground: 'moss', roster: wood });
z.area('west_wood', P(8, 50), [5 * S, 6 * S], { ground: 'moss', roster: wood });
z.area('north_meadow', P(52, 22), [6 * S, 6 * S], { ground: 'meadow', roster: marsh });

// Groves and outcrops: obstacles that make lanes and cover, never walls.
for (const [x, y, r, n] of [[28, 40, 3, 8], [14, 56, 2.4, 6], [30, 70, 2.2, 5], [6, 40, 2.4, 6], [18, 18, 2.6, 7], [33, 33, 2, 5], [52, 30, 2.4, 6],
  [56, 48, 2.2, 5], [70, 54, 2.6, 7], [86, 64, 2.6, 7], [94, 46, 2.4, 6], [74, 26, 2.2, 5], [92, 14, 2.4, 6], [60, 68, 2, 5], [80, 74, 2.6, 6], [48, 13, 2, 5]] as const) z.grove(...P(x, y), r * S, n);
for (const [x, y] of [[57, 24], [86, 30], [24, 32]] as const) z.grove(...P(x, y), 1.6 * S, 4, ['boulder', 'boulder', 'willow']);

// Roads: the causeway road (main, validated), the bank loop, the ford track and side tracks.
z.road([P(10.5, 70), P(18, 66), P(24, 62.5), P(31, 58), P(37.5, 55.4)], 170, 'dirt');
z.road([P(44.4, 56.6), P(52, 58), P(56, 58), P(60.5, 51), P(63, 44), P(64.5, 36), P(64.5, 31), P(66, 24), P(67, 19)], 170, 'flag');
z.road([P(24, 62.5), P(20, 54), P(19, 44), P(21, 35), P(29, 27.5), P(37.6, 26.7)], 140, 'dirt');
z.road([P(44.6, 27.3), P(55, 29), P(64.5, 31)], 140, 'flag');
z.road([P(21, 35), P(14, 31), P(10.5, 30)], 130, 'moss');
z.road([P(63, 44), P(72, 44.5), P(80, 46)], 150, 'dirt');
z.road([P(56, 58), P(50.5, 66), P(50, 72)], 140, 'dirt');
z.road([P(60.5, 51), P(68, 57), P(76, 62)], 140, 'dirt');
z.road([P(66, 24), P(76, 22), P(85, 20), P(89, 13.5)], 150, 'dirt');
z.road([P(18, 66), P(27, 71), P(35.5, 72)], 130, 'dirt', { route: false });
z.road([P(44.7, 72), P(50, 72)], 130, 'dirt', { route: false });

// ─────────── Maintenance Camp: Orren's crew keeps a foothold above the flood ───────────
z.camp(...P(11, 71), { tents: 2 });
z.portal(...P(6.5, 72.5), 'rillwake_crossing', 'Back to Rillwake Crossing');
z.contact('foreman', 'Hollis · Sluice foreman', ...P(14.5, 67.2), 'person');
z.board(...P(17.2, 63.8), 'Maintenance Camp bounty board');
// Hollis walks up to the forecourt once the floodgate opens (br_drained), next to the gate.
z.moveTo('foreman', 'br_drained', ...P(69.3, 33.1));
z.resident('br_guard', 'guard', 'Causeway watch', ...P(17.5, 70.5), 30);
z.decor('noticeboard', ...P(8, 66.5)); z.decor('cart', ...P(5.5, 68.6));
z.landmark('Maintenance Camp', ...P(10.5, 74));
z.structure('house', ...P(6, 64.5), 1); z.resident('br_cook', 'innkeeper', 'Camp cook', ...P(13.5, 73.5), 15);
z.resident('br_porter', 'porter', 'Sluice porter', ...P(7.5, 69), 20);

// ─────────── Sluice Causeway, the flooded basin and the old weir ───────────
z.pack('causeway', ...P(28.5, 60), ['thornling', 'bog_slime', 'gloomshroom', 'grave_bat', 'bog_slime', 'reedclaw', 'bog_slime']);
z.landmark('Sluice Causeway', ...P(41, 60.5));
z.structure('watchtower', ...P(33, 51.5));
z.pack('basin', ...P(57, 61), ['siltusk', 'gloomshroom', 'thornling', 'bog_slime', 'grave_bat', 'bog_slime']);
z.decor('rowboat', ...P(47.6, 63), 1, 2); z.decor('barrels', ...P(60.5, 55)); z.landmark('Flooded Basin', ...P(56, 65));
// The basin and the weir stand under flood water until the floodgate opens (br_drained).
z.phase('br_drained', false, () => { z.overlay('flood', basin); z.overlay('flood', weir); });
z.contact('cog_basin', 'Silted weir cog', ...P(61.6, 57.4), 'marker');
z.contact('cog_weir', 'Silted weir cog', ...P(47.7, 70.1), 'marker');
z.contact('cog_reeds', 'Silted weir cog', ...P(80.6, 64.6), 'marker');
z.contact('weir_valve', 'Jammed weir valve', ...P(47.5, 74), 'mechanism');
z.contact('weir_tally', 'Silted weir tally board', ...P(53, 72), 'ledger');
z.pack('weir', ...P(51.5, 70.5), ['reedclaw', 'bog_slime', 'reedclaw', 'siltusk', 'bog_slime', 'reedclaw', 'bog_slime']);
z.event('bursting_weir', 'The Bursting Weir', 'weir_valve', 'weir', 'The weir valve is jammed with silt and something has made a nest of the overflow. Free it and they come out of the water.', 'Force the valve');
z.structure('waterwheel', ...P(43.8, 77), 0, false, 'br_weir'); // the old weir wheel on the east bank
z.landmark('Old Weir', ...P(50, 76));

// ─────────── Gatehouse Steps, the forecourt, the keeper and the floodgate ───────────
z.shrine('shrine_steps', ...P(59.6, 45), 'frenzied');
z.decor('lamppost', ...P(61, 40.8)); z.decor('lamppost', ...P(68, 40.6)); z.landmark('Gatehouse Steps', ...P(63, 48));
z.resident('br_smith', 'carpenter', 'Gate fitter', ...P(61.8, 47.6), -20);
z.walker('br_patrol', 'guard', [P(56, 58), P(60.5, 51), P(63, 44.5), P(60.5, 51)], 45, 5);
z.location('forecourt', ...P(64.5, 32));
z.pack('keeper', ...P(66, 24.5), [{ type: 'mossback', dx: 0, dy: 0, tier: 2, name: 'The Rootbound Keeper', questTarget: true, combat: 'keeper' }]);
z.wall(rect(58 * S, 11 * S, 3.4 * S, 0.5 * S)); z.wall(rect(73 * S, 11 * S, 3.4 * S, 0.5 * S));
z.contact('floodgate', 'Floodgate mechanism', ...P(65, 14), 'mechanism');
z.wheel = { x: Math.round(71 * S), y: Math.round(13 * S), radius: 38, spin: 'br_drained' };
z.phase('br_drained', true, () => { z.emit('fog', ...P(67, 9), 3); z.light(...P(71, 13), 0x9ad8ff, 170); });
z.decor('pillar', ...P(60, 18.5), 1, 1); z.decor('pillar', ...P(74, 18.5)); z.light(...P(65, 13.5), 0xffc070, 170);
z.landmark('Spillway Forecourt', ...P(64.5, 35)); z.landmark('Floodgate', ...P(67, 19.5));

// ─────────── Bank path (contract bats), the sunken orchard secret, the far bank ───────────
z.pack('bank', ...P(18.5, 45), ['grave_bat', 'grave_bat', 'reedclaw', 'bog_slime', 'grave_bat', 'grave_bat']);
z.landmark('Bank Path', ...P(19, 48.5));
for (const [x, y] of [P(7, 28), P(12, 26.5), P(14.5, 32.5), P(8, 33.5)]) z.decor('deadtree', x, y, 1.1);
z.cache('cache_orchard', ...P(9, 30.5), 'Drowned orchard crate'); z.shrine('shrine_orchard', ...P(13.5, 28.5), 'keen');
z.structure('ruinhouse', ...P(4.5, 34));
z.landmark('Sunken Orchard', ...P(10.5, 35));
z.elite('grindle', ...P(29.5, 23.5), 'siltusk', 'Old Grindle', ['fast'], ['grave_bat', 'reedclaw', 'bog_slime'], { questTarget: true });
z.landmark('Far Bank', ...P(29, 29));

// ─────────── Pumpworks hatch yard, the reed bed, the stair road north to Cairnspill ───────────
z.structure('pumphouse', ...P(76.8, 45.5));
z.portal(...P(83.5, 44), 'reedvault_pumpworks', 'Reedvault Pumpworks · solo dungeon');
z.decor('crates', ...P(81, 49.5)); z.decor('barrels', ...P(86, 48.5)); z.decor('anvil', ...P(79.5, 50)); z.light(...P(83.5, 43), 0x9ad8ff, 160);
z.cache('cache_hatch', ...P(87, 46), 'Maintenance locker'); z.stores(...P(86, 50.5));
z.landmark('Pumpworks Hatch', ...P(80, 51.5));
// The pumps run (br_pumping): the pumphouse breathes, two pump hands at the hatch.
z.phase('br_pumping', true, () => {
  z.emit('smoke', ...P(76.8, 39), 6); z.light(...P(76.8, 45), 0xffc070, 200);
  z.resident('br_pumphand1', 'worker', 'Pump hand', ...P(79.6, 48.6), 20); z.resident('br_pumphand2', 'carpenter', 'Pump fitter', ...P(85.4, 46.2), -20);
});
z.fishery(...P(73, 64)); z.resident('br_fisher', 'fisher', 'Reed cutter', ...P(78.5, 60), 10); z.landmark('Reed Bed', ...P(76, 66.5));
z.structure('dryingrack', ...P(79, 67.6));
z.structure('stonetower', ...P(80.5, 15));
z.portal(...P(89.6, 13), 'cairnspill_terraces', 'Cairnspill Terraces');
z.landmark('Stair Road', ...P(85, 25));

// ─────────── Life, sound, mist ───────────
for (const [x, y] of [P(41, 44), P(41, 28), P(70, 8), P(40, 70)]) { z.sound('water', x, y); z.mist(x, y + 100, 440); }
for (const [x, y] of [P(10, 70), P(63, 40), P(85, 22), P(88, 52)]) z.sound('wind', x, y);
z.emit('birds', ...P(56, 50), 4); z.emit('fireflies', ...P(10, 30), 10); z.emit('fog', ...P(42, 64), 3); z.emit('leaves', ...P(19, 44), 5); z.emit('leaves', ...P(68, 74), 5);
z.critters('frogs', ...P(52, 70), 120, 4); z.critters('birds', ...P(76, 62), 200, 5); z.critters('deer', ...P(89, 52), 260, 2);

// The rest of the valley: packs about every 700 u (REFERENCES W11), larger and mixed (owner 2026-10-12).
z.fill({ roster: marsh, spacing: 700, size: [6, 12], champion: 0.09, rare: 0.05, clear: 1100 });
export const BRACKEN = z.build();
