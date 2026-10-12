import type { Point } from '../townTypes';
import { ZoneBuilder, rect } from '../zoneKit';

// Act I upper road (DESIGN.md §2): Cairnspill Terraces (quarry), Cinderwash Kilns and Kilnwatch Crown (kiln country).
// Every contact, encounter, location and portal id of the old plans is kept.

// ─────────── Cairnspill Terraces (L9–12), open-field rebuild 2026-10-12 (docs/rework/worlds/OPEN.md; Act I, §7) ───────────
// An open quarry hillside climbing from the Survey Camp (south-west) to the Dispatch Shed (north-east). Short cliff
// terraces with ramps where the haul road climbs, a gorge in the north, a creek with a ford in the south-east, and green
// highland grass between the cuttings. Plan units: 100 × 80 (S u each).
function cairnspill() {
  const S = 102.4, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('cairnspill_terraces', [160, 128], 'quarry', P(10, 72), { surface: 'masonry' });
  const quarry = ['flint_beetle', 'vault_moth', 'gloomshroom', 'bog_slime'], track = ['vault_moth', 'siltusk', 'grave_bat', 'gloomshroom'];
  const heath = ['siltusk', 'thornling', 'flint_beetle', 'grave_bat'];

  // ── land: terraces (cliff bands with ramps), the gorge, the creek
  z.open({ margin: 300, ground: 'grass' });
  z.ridge([P(26, 57.5), P(33, 55.5), P(40, 53.5), P(46, 52.5)], 1.4 * S, [{ at: P(32.3, 55.7), w: 5 * S }]);           // first terrace, the haul ramp (where the road crosses)
  z.ridge([P(36, 40), P(43, 37.5), P(50, 35.5), P(55, 35)], 1.4 * S, [{ at: P(44.4, 37), w: 4 * S }]);                  // second terrace, the track ramp
  z.ridge([P(56, 28), P(63, 25.5), P(70, 23.5), P(77, 26), P(81, 29)], 1.4 * S, [{ at: P(71, 24), w: 4.5 * S }]);       // third terrace below the head
  z.ridge([P(6, 31), P(16, 27.5), P(24, 24.5)], 1.4 * S, [{ at: P(14, 28.2), w: 3.5 * S }]);                            // the high terrace to the ledge
  z.hole('chasm', [P(34, 2), P(39, 2.5), P(41.5, 9), P(40, 15), P(38.5, 20), P(35.5, 19), P(36.5, 12), P(34.5, 7)]);  // the gorge
  z.river([P(52, 83), P(55, 74), P(53.5, 66)], 2.2 * S, [{ at: P(54.6, 76), w: 2.8 * S, kind: 'ford' }]);              // the creek
  z.lake(...P(56.5, 63.5), 3 * S, 1.8 * S);                                                                          // the creek pool
  z.hole('cliff', [P(90, 58), P(95, 56), P(97, 62), P(93, 66), P(89, 63)]);                                            // an outcrop in the east scree

  // ── ground of the hillside's parts
  z.area('camp', P(10.5, 71.5), [6.4 * S, 5 * S], { role: 'outpost', ground: 'dirt', dress: 0.3 });
  z.area('lower_cut', P(25, 63), [6.4 * S, 4.6 * S], { ground: 'gravel', roster: quarry });
  z.area('haul', P(36, 49), [5.4 * S, 3.6 * S], { ground: 'gravel', roster: quarry });
  z.area('bench', P(47, 43), [7 * S, 4.6 * S], { role: 'yard', ground: 'stone' });
  z.area('upper_cut', P(61, 32), [7 * S, 4.4 * S], { ground: 'gravel', roster: quarry });
  z.area('quarry_head', P(74, 19), [6.6 * S, 4.2 * S], { role: 'arena', ground: 'gravel' });
  z.area('dispatch', P(82, 11.5), [5 * S, 3.4 * S], { role: 'yard', ground: 'planks', poly: rect(77 * S, 8.5 * S, 10 * S, 6.5 * S), dress: 0 });
  z.area('old_track', P(18, 41), [6.4 * S, 5 * S], { ground: 'dirt', roster: track });
  z.area('slide', P(31, 27), [6 * S, 4.6 * S], { ground: 'gravel', roster: track });
  z.area('ledge', P(13, 18), [5 * S, 4 * S], { role: 'secret', ground: 'moss' });
  z.area('creek', P(62, 70), [6.4 * S, 4.6 * S], { ground: 'grass', roster: track });
  z.area('loading', P(88, 28), [4.6 * S, 4 * S], { role: 'yard', ground: 'dirt', roster: quarry });
  z.area('heath_west', P(9, 54), [5 * S, 6 * S], { ground: 'meadow', roster: heath });
  z.area('east_scree', P(86, 46), [7 * S, 7 * S], { ground: 'gravel', roster: quarry });
  z.area('south_heath', P(78, 70), [9 * S, 5 * S], { ground: 'meadow', roster: heath });
  z.area('north_rim', P(56, 12), [8 * S, 5 * S], { roster: heath });
  z.area('midslope', P(24, 47), [5 * S, 4 * S], { ground: 'meadow', roster: heath });

  // ── outcrops and stands of pine on the slope
  for (const [x, y, r, n] of [[18, 60, 2.2, 5], [40, 64, 2.6, 6], [6, 42, 2.2, 5], [28, 34, 2, 5], [24, 12, 2.4, 6], [48, 22, 2.4, 6], [62, 46, 2.6, 6],
    [70, 58, 2.4, 6], [92, 38, 2.2, 5], [66, 8, 2.2, 5], [84, 62, 2, 4], [44, 72, 2.4, 5], [94, 18, 2, 4], [76, 40, 2, 5]] as const) z.grove(...P(x, y), r * S, n);
  for (const [x, y] of [[58, 52], [32, 44], [80, 50], [12, 8]] as const) z.grove(...P(x, y), 1.6 * S, 4, ['boulder', 'crag', 'boulder']);

  // ── roads: the haul road (main, validated) and the old track loop
  z.road([P(10.5, 71.5), P(18, 67), P(25, 62), P(31, 57), P(36, 52), P(41, 47), P(47, 43), P(54, 38), P(61, 33), P(68, 27), P(74, 22), P(79, 16), P(82, 12)], 170, 'gravel');
  z.road([P(25, 62), P(20, 52), P(18, 41), P(24, 33), P(31, 27), P(42, 32), P(47, 43)], 140, 'dirt');
  z.road([P(18, 41), P(14, 30), P(13, 18)], 130, 'moss');
  z.road([P(47, 43), P(54, 53), P(60, 62.5)], 140, 'dirt');
  z.road([P(74, 22), P(82, 25), P(88, 28), P(90, 18)], 150, 'gravel');

  // ── Survey Camp
  z.camp(...P(11, 72.5), { tents: 2 });
  z.contact('surveyor', 'Iven', ...P(12.5, 74.8), 'person');
  z.portal(...P(6.5, 74), 'bracken_sluice', 'Bracken Sluice');
  z.resident('cs_chain', 'worker', 'Chainman', ...P(8, 68.5), 20); z.decor('signalflag', ...P(16.5, 73.5)); z.decor('cairn', ...P(5.5, 69.5));
  z.landmark('Survey Camp', ...P(10.5, 76));
  z.board(...P(16.6, 70.2), 'Survey Camp bounty board');
  z.moveTo('surveyor', 'cs_haul', ...P(79.2, 19.5));
  z.structure('house', ...P(6.5, 66)); z.resident('cs_cook', 'innkeeper', 'Camp cook', ...P(13.8, 73.8), 10);
  z.resident('cs_porter', 'porter', 'Haulier', ...P(16.5, 69.5), -15);
  z.walker('cs_haul', 'carpenter', [P(18, 67), P(25, 62), P(31, 57), P(25, 62)], 45, 5);
  z.structure('watchtower', ...P(4.5, 60));

  // ── the cuttings, the bench and the rockfall
  z.pack('lower_cut', ...P(25.5, 60), ['flint_beetle', 'gloomshroom', 'bog_slime', 'grave_bat', 'flint_beetle', 'bog_slime']);
  z.quarryCut(...P(21, 65.5)); z.landmark('Lower Cutting', ...P(25, 67));
  z.location('cutting', ...P(45.5, 44.5));
  z.pack('bench', ...P(49, 41), ['flint_beetle', 'vault_moth', 'mossback', 'bog_slime', 'vault_moth', 'flint_beetle']);
  z.decor('crates', ...P(51.5, 46)); z.decor('cart', ...P(43, 40.5)); z.decor('pickaxe', ...P(47.5, 47)); z.shrine('shrine_bench', ...P(41, 45.5), 'empowered');
  z.structure('statue', ...P(39.6, 42.2)); z.resident('cs_mason', 'worker', 'Stone dresser', ...P(50.5, 46.5), 10);
  z.landmark('Stone Bench', ...P(47, 48));
  z.contact('warning_bell', 'Rockfall warning bell', ...P(64.5, 30.5), 'mechanism');
  z.pack('rockfall', ...P(60, 35), ['flint_beetle', 'flint_beetle', 'vault_moth', 'flint_beetle', 'siltusk', 'flint_beetle', 'vault_moth']);
  z.event('rockfall_warning', 'Rockfall Warning', 'warning_bell', 'rockfall', 'The warning bell still hangs over the upper cutting. Ring it and everything nesting in the scree comes down at once.', 'Ring the bell');
  z.quarryCut(...P(56, 30.5)); z.landmark('Upper Cutting', ...P(61, 37.5));

  // ── the quarry head, Splintercrown and the dispatch shed
  z.pack('foreman', ...P(74, 19.5), [{ type: 'flint_beetle', dx: 0, dy: 0, tier: 2, name: 'Splintercrown', questTarget: true, affixes: ['fast'] }, 'gloomshroom', 'vault_moth', 'bog_slime']);
  z.landmark('Quarry Head', ...P(72, 15.5));
  z.wall(rect(77 * S, 8.5 * S, 10 * S, 0.5 * S)); z.wall(rect(77 * S, 8.5 * S, 0.5 * S, 6.5 * S)); z.wall(rect(86.5 * S, 8.5 * S, 0.5 * S, 3.2 * S));
  z.contact('dispatch', 'Quarry dispatch', ...P(84, 10.8), 'ledger');
  z.decor('table', ...P(79.5, 10.5)); z.light(...P(82, 10), 0xffc070, 150); z.landmark('Dispatch Shed', ...P(82, 17));
  z.contact('haul_signal', 'Haul-road signal mast', ...P(84.6, 14.3), 'mechanism');
  z.structure('signaltower', ...P(66.5, 14));
  // Haul signal raised (cs_haul): crews back on the bench and the quarry head, lamps along the haul road. Phased props stand
  // against a wall or a terrace (they carry no collision).
  z.phase('cs_haul', true, () => {
    z.decor('banner', ...P(87.25, 11.2)); z.resident('cs_crew1', 'worker', 'Quarryman', ...P(52.6, 40.4), 15); z.resident('cs_crew2', 'porter', 'Haulier', ...P(71.2, 26.6), -20);
    z.resident('cs_crew3', 'carpenter', 'Cart wright', ...P(44.4, 46.6), 30); z.walker('cs_haulcart', 'porter', [P(41, 47), P(47, 43), P(54, 38), P(61, 33), P(54, 38), P(47, 43)], 40, 4);
    for (const [x, y] of [P(35.86, 55.61), P(49.72, 36.52), P(65.42, 25.75)]) { z.decor('lamppost', x, y); z.light(x, y - 70, 0xffc070, 180); }
  });
  z.portal(...P(91, 19), 'cinderwash_kilns', 'Cinderwash Kilns');
  z.decor('logpile', ...P(86, 31)); z.decor('crates', ...P(91, 26)); z.stores(...P(87, 32.5)); z.landmark('Loading Yard', ...P(88, 33));

  // ── the old track, Grindstone, the stakes and the hermit's ledge
  z.pack('old_track', ...P(18.5, 42), ['vault_moth', 'siltusk', 'grave_bat', 'gloomshroom', 'vault_moth']);
  z.wreck(...P(13.5, 45)); z.structure('stonetower', ...P(8.5, 48.5), 1); z.landmark('Old Track', ...P(18, 46.5));
  z.elite('grindstone', ...P(31.5, 25.5), 'siltusk', 'Grindstone', ['fast'], ['flint_beetle', 'vault_moth'], { questTarget: true });
  z.contact('stake_track', 'Crooked survey stake', ...P(22.5, 39.5), 'marker'); z.contact('stake_scar', 'Buried survey stake', ...P(26.5, 28.5), 'marker');
  z.landmark('Slide Scar', ...P(31, 31));
  z.phase('cs_stakes', true, () => { z.decor('stake', ...P(20.6, 37.6)); z.decor('stake', ...P(23.8, 31.4), 1, 1); z.decor('signalflag', ...P(21.4, 37.2), 0.7); });
  z.cache('cache_ledge', ...P(11, 17), 'Hermit’s strongbox'); z.shrine('shrine_ledge', ...P(15.5, 19.5), 'keen'); z.decor('cairn', ...P(13, 15));
  z.landmark('Hermit’s Ledge', ...P(13, 22.5));

  // ── the creek pool
  z.fishery(...P(59, 67)); z.cache('cache_creek', ...P(64.5, 65.5), 'Quarrymen’s cache'); z.landmark('Creek Pool', ...P(60, 69.5));
  z.structure('ruinhouse', ...P(34, 69));

  // ── life, sound
  for (const [x, y] of [P(10, 72), P(61, 33), P(82, 12), P(86, 46)]) z.sound('wind', x, y);
  z.sound('water', ...P(55, 70)); z.mist(...P(55, 72), 420); z.emit('motes', ...P(47, 43), 6); z.emit('birds', ...P(30, 30), 4); z.emit('birds', ...P(78, 70), 4);
  z.critters('hares', ...P(9, 54), 220, 3); z.critters('deer', ...P(78, 70), 260, 2);
  z.fill({ roster: heath, spacing: 700, size: [6, 12], champion: 0.09, rare: 0.05, clear: 1100 });
  return z.build();
}

// ─────────── Cinderwash Kilns (L12–16), open-field rebuild 2026-10-12 (docs/rework/worlds/OPEN.md; Act I, §7) ───────────
// Green highland moor (the Act I look) where the firekeepers' kilns scorch only their own yards: the charcoal road and the
// ash pits in the south-west, the firing yard in the middle, the upper kilns on a crag terrace in the north, a burn and
// a tarn in the east, slag runs glowing below the firing yard. Plan units: 100 × 80 (S u each).
function cinderwash() {
  const S = 102.4, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('cinderwash_kilns', [160, 128], 'highland', P(10, 72), { theme: 'ashen' });
  const fire = ['ember_imp', 'ash_wisp', 'bonewalker', 'cinder_cultist'], yard = ['magma_brute', 'ember_imp', 'cinder_cultist', 'ember_imp'];
  const moor = ['siltusk', 'grave_bat', 'thornling', 'vault_moth'];

  // ── land: crag terraces under the upper kilns, slag runs, the burn and its tarn
  z.open({ margin: 300, ground: 'grass' });
  z.ridge([P(34, 31), P(42, 28), P(50, 26.5), P(55, 27.5)], 1.5 * S, []);                       // the crag terrace west of the upper kilns
  z.ridge([P(74, 31), P(82, 29), P(92, 30)], 1.5 * S, []);                                      // and east of them
  z.hole('lava', [P(44.5, 67.5), P(47, 68), P(48.5, 73), P(47.2, 79), P(45, 78.5), P(45.8, 73)]);   // the slag run below the firing yard
  z.hole('lava', [P(63, 9), P(66, 8.5), P(67, 11), P(64, 12), P(61.5, 11)]);                     // a slag pool behind the upper kilns
  z.river([P(98, 58), P(90, 55), P(82, 52.5), P(76, 47.5)], 1.7 * S, [{ at: P(86, 53.8), w: 2.6 * S, kind: 'ford' }]); // the burn
  z.lake(...P(72.5, 44), 3 * S, 1.9 * S);                                                     // the tarn
  z.hole('cliff', [P(20, 6), P(26, 5), P(28.5, 9), P(24, 12.5), P(19.5, 10)]);                 // a crag knot in the north-west

  // ── ground of the moor's parts (the kiln yards are scorched; the rest stays green)
  z.area('camp', P(10.5, 71.5), [6.4 * S, 5 * S], { role: 'outpost', ground: 'dirt', dress: 0.3 });
  z.area('charcoal', P(25, 64), [6.4 * S, 4.6 * S], { ground: 'cinder', roster: fire });
  z.area('pits', P(38, 57), [6 * S, 4.6 * S], { ground: 'ash', roster: fire });
  z.area('firing', P(57, 62), [7.6 * S, 5.4 * S], { role: 'yard', ground: 'cinder', roster: yard });
  z.area('stores', P(28, 37), [7 * S, 5 * S], { role: 'yard', ground: 'stone', roster: fire });
  z.area('slag', P(48, 40), [6 * S, 4.4 * S], { ground: 'ash', roster: fire });
  z.area('upper', P(66, 21), [9 * S, 6 * S], { role: 'arena', ground: 'stone' });
  z.area('cinder_flats', P(78, 67), [6 * S, 4.6 * S], { ground: 'cinder', roster: yard });
  z.area('ruined_kiln', P(12, 22), [5 * S, 4 * S], { role: 'secret', ground: 'cinder' });
  z.area('ridge_road', P(86, 21), [4.6 * S, 4 * S], { roster: fire });
  z.area('moor_west', P(10, 48), [6 * S, 7 * S], { ground: 'meadow', roster: moor });
  z.area('moor_east', P(90, 40), [6 * S, 6 * S], { ground: 'meadow', roster: moor });
  z.area('heather', P(32, 16), [7 * S, 5 * S], { ground: 'meadow', roster: moor });
  z.area('south_moor', P(28, 76), [8 * S, 3.6 * S], { ground: 'meadow', roster: moor });
  z.area('glen', P(64, 46), [5 * S, 4 * S], { ground: 'moss', roster: moor });

  // ── pine stands and boulder fields
  for (const [x, y, r, n] of [[18, 56, 2.4, 6], [32, 48, 2.2, 5], [6, 36, 2.4, 6], [44, 14, 2.4, 6], [20, 30, 2, 5], [58, 50, 2.2, 5], [80, 40, 2.4, 6],
    [94, 70, 2.4, 6], [68, 74, 2.6, 6], [84, 10, 2.2, 5], [38, 70, 2, 4], [52, 6, 2, 4], [94, 22, 2, 4]] as const) z.grove(...P(x, y), r * S, n);
  for (const [x, y] of [[26, 44], [70, 34], [86, 62], [14, 12]] as const) z.grove(...P(x, y), 1.6 * S, 4, ['boulder', 'crag', 'boulder']);

  // ── roads: the charcoal road (main, validated), the stores loop, side tracks
  z.road([P(10.5, 71.5), P(18, 67.5), P(25, 64), P(32, 60), P(38, 57), P(47, 59), P(57, 62)], 170, 'cinder');
  z.road([P(57, 62), P(58, 52), P(56, 44), P(60, 34), P(66, 27)], 170, 'stone');
  z.road([P(38, 57), P(33, 47), P(28, 37), P(36, 34), P(48, 40), P(56, 44)], 140, 'cinder');
  z.road([P(28, 37), P(18, 29), P(12, 22)], 130, 'cinder');
  z.road([P(57, 62), P(68, 64), P(78, 67)], 140, 'cinder');
  z.road([P(66, 23), P(76, 22), P(86, 22), P(89, 15)], 150, 'stone');

  // ── Firekeepers' Camp
  z.camp(...P(11, 72.5), { tents: 2 });
  z.contact('firekeeper', 'Kessa', ...P(12.5, 74.8), 'person');
  z.portal(...P(6.5, 74), 'cairnspill_terraces', 'Cairnspill Terraces');
  z.resident('cw_stoker', 'worker', 'Off-shift stoker', ...P(8, 68.5), 15); z.decor('barrels', ...P(16, 74.5));
  z.landmark('Firekeepers’ Camp', ...P(10.5, 76));
  z.board(...P(15.4, 70.6), 'Firekeepers’ bounty board');
  z.moveTo('firekeeper', 'cw_quiet', ...P(62.6, 29.4));
  z.structure('house', ...P(6.5, 66), 1); z.resident('cw_cook', 'innkeeper', 'Camp cook', ...P(13.5, 73.8), -15);
  z.resident('cw_carrier', 'porter', 'Coal carrier', ...P(16, 70.5), -10);
  z.structure('watchtower', ...P(4.5, 60));

  // ── the charcoal road, the ash pits and the firing yard
  z.pack('charcoal', ...P(26, 62), ['ember_imp', 'ash_wisp', 'bonewalker', 'cinder_cultist', 'ember_imp', 'ash_wisp']);
  z.kilnYard(...P(21, 66)); z.landmark('Charcoal Road', ...P(25, 68.5));
  z.contact('pit_bellows', 'Abandoned pit bellows', ...P(41, 60), 'mechanism');
  z.pack('flare', ...P(37, 55), ['ember_imp', 'ember_imp', 'ash_wisp', 'ember_imp', 'magma_brute', 'ash_wisp', 'ember_imp']);
  z.event('flare_up', 'Flare-up at the Pits', 'pit_bellows', 'flare', 'The bellows still feed the ash pits. Work them and the fire wakes up everything sleeping in the ash.', 'Work the bellows');
  z.landmark('Ash Pits', ...P(38, 61.5));
  z.contact('ember_niche', 'Firekeepers’ offering niche', ...P(38, 60), 'marker');
  z.phase('cw_niche', true, () => { z.fire(...P(37.6, 59.2), 0.35); z.fire(...P(38.6, 59.4), 0.3); });
  z.location('firing_yard', ...P(55.5, 61));
  z.pack('firing', ...P(59, 63.5), ['magma_brute', 'ash_wisp', 'ember_imp', 'cinder_cultist', 'ember_imp', 'ash_wisp']);
  z.kilnYard(...P(52, 66)); z.kilnYard(...P(62, 58)); z.shrine('shrine_yard', ...P(50.5, 59.5), 'frenzied');
  z.structure('kilnstack', ...P(67.5, 60)); z.stores(...P(60, 67));
  z.resident('cw_raker', 'worker', 'Ash raker', ...P(54.5, 61), 15);
  z.walker('cw_runner', 'worker', [P(32, 60), P(38, 57), P(47, 59), P(38, 57)], 45, 5);
  z.structure('statue', ...P(44.5, 52.5));
  z.landmark('Firing Yard', ...P(57, 67.5));

  // ── the stores, Coalmark, the slag heaps and Cinderhusk
  z.pack('store', ...P(29.5, 38.5), [{ type: 'bonewalker', dx: 0, dy: 0, tier: 2, name: 'Coalmark', affixes: ['electrified', 'fast'] }, 'ember_imp', 'grave_bat', 'cinder_cultist']);
  z.contact('tally', 'Firing tally', ...P(21.5, 38.5), 'ledger');
  z.decor('crates', ...P(32, 34)); z.decor('barrels', ...P(22, 39)); z.decor('coalpile', ...P(34.5, 39.5)); z.light(...P(25, 34), 0xffc070, 150);
  z.structure('ruinhouse', ...P(18.5, 32));
  z.landmark('Stores', ...P(28, 41.5));
  z.elite('cinderhusk', ...P(49, 38.5), 'magma_brute', 'Cinderhusk', ['molten'], ['ember_imp', 'ash_wisp'], { questTarget: true });
  z.landmark('Slag Heaps', ...P(48, 44.5));

  // ── the upper kilns, the Unattended Flame and the draught lever
  z.kilns = [{ x: Math.round(58 * S), y: Math.round(13 * S), w: 300, d: 220, h: 160, cold: 'cw_quiet' }, { x: Math.round(70 * S), y: Math.round(16 * S), w: 230, d: 180, h: 130, cold: 'cw_quiet' }];
  z.pack('stoker', ...P(64, 25.5), [{ type: 'cinder_cultist', dx: 0, dy: 0, tier: 2, name: 'The Unattended Flame', questTarget: true, affixes: ['faulted'] }, 'ember_imp', 'bonewalker', 'grave_bat']);
  z.contact('draught', 'Kiln draught lever', ...P(68.5, 24), 'mechanism');
  // The draught closed (cw_quiet): the kiln mouths go dark, the fire spilling out of them dies and the smoke thins.
  z.phase('cw_quiet', false, () => { z.fire(...P(59.6, 15.7), 0.9); z.fire(...P(71.2, 18.2), 0.75); z.emit('smoke', ...P(60, 12), 8); z.emit('smoke', ...P(72, 15), 6); z.emit('embers', ...P(64, 18), 8); z.light(...P(64, 16), 0xff6a2a, 320, 0.4); });
  z.phase('cw_quiet', true, () => { z.emit('smoke', ...P(60, 12), 2); z.resident('cw_keeper2', 'worker', 'Firekeeper', ...P(57.6, 27.6), 20); });
  z.structure('kilnstack', ...P(78.5, 17), 1);
  z.landmark('Upper Kilns', ...P(66, 29));

  // ── the cinder flats, the ruined kiln, the way to Kilnwatch
  z.elite('flats_rare', ...P(79, 68), 'bonewalker', 'Ashen Tallyman', ['electrified'], ['ember_imp', 'cinder_cultist']);
  z.cache('cache_flats', ...P(82, 64), 'Scorched paybox'); z.landmark('Cinder Flats', ...P(78, 71.5));
  z.cache('cache_kiln', ...P(10, 21), 'Kiln-keeper’s cache'); z.shrine('shrine_kiln', ...P(14.5, 23.5), 'empowered'); z.kilnYard(...P(12, 19));
  z.landmark('Ruined Kiln', ...P(12, 26.5));
  z.portal(...P(89.5, 14.5), 'kilnwatch_crown', 'Kilnwatch Crown');
  z.landmark('Tarn', ...P(72.5, 48.5));

  // ── life, sound
  for (const [x, y] of [P(57, 62), P(64, 18), P(38, 57)]) z.sound('fire', x, y);
  for (const [x, y] of [P(10, 72), P(28, 37), P(90, 40), P(32, 16)]) z.sound('wind', x, y);
  z.sound('water', ...P(84, 53)); z.mist(...P(72.5, 46), 420);
  z.emit('birds', ...P(10, 48), 4); z.emit('birds', ...P(90, 40), 3); z.emit('smoke', ...P(21, 64), 4); z.emit('smoke', ...P(52, 64), 4);
  z.critters('hares', ...P(10, 48), 220, 3); z.critters('crows', ...P(32, 16), 260, 4);
  z.fill({ roster: moor, spacing: 700, size: [6, 12], champion: 0.09, rare: 0.05, clear: 1100 });
  return z.build();
}

// ─────────── Kilnwatch Crown (L16–20), open-field rebuild 2026-10-12 (docs/rework/worlds/OPEN.md; Act I, §7) ───────────
// The top of the Act I highlands: the crown furnace on a plateau ringed by crags (open to the south, where the approach
// climbs), a slag run down its west flank, the abandoned watch in the west, the haulage gantry above the refuge, the
// bellows house in the east and the road east to the Salt Road. Plan units: 100 × 80 (S u each).
function kilnwatch() {
  const S = 102.4, P = (x: number, y: number): Point => [Math.round(x * S), Math.round(y * S)];
  const z = new ZoneBuilder('kilnwatch_crown', [160, 128], 'highland', P(10, 72), { theme: 'ashen' });
  const gantry = ['flint_beetle', 'cinder_cultist', 'bonewalker', 'ember_imp'], watch = ['vault_moth', 'grave_bat', 'bonewalker', 'ember_imp'];
  const moor = ['siltusk', 'vault_moth', 'grave_bat', 'flint_beetle'];

  // ── land: the crag ring of the crown, the slag run, the chasm, a tarn
  z.open({ margin: 300, ground: 'grass' });
  z.ridge([P(44, 6), P(46, 13), P(48, 20), P(51, 26.5)], 1.6 * S, []);                         // the crown's west crags
  z.ridge([P(75, 6), P(76, 13), P(74, 20), P(69, 26.5)], 1.6 * S, []);                         // and its east crags
  z.hole('lava', [P(37, 3), P(40.5, 3.5), P(42, 10), P(41, 17), P(39, 20.5), P(37.5, 17), P(38.6, 10.5)]); // the slag run
  z.hole('chasm', [P(2, 49), P(8, 48.5), P(14, 51), P(13, 55), P(7, 56), P(2.5, 54)]);          // the chasm by the old watch road
  z.lake(...P(64, 60), 3.2 * S, 2 * S);                                                       // a tarn below the shelf
  z.hole('cliff', [P(88, 50), P(93, 48.5), P(96, 53), P(92, 57), P(87.5, 55)]);                // an outcrop east of the bellows

  // ── ground of the crown's parts
  z.area('refuge', P(10.5, 71.5), [6.4 * S, 5 * S], { role: 'outpost', ground: 'dirt', dress: 0.3 });
  z.area('gantry_road', P(22, 63), [5 * S, 3.8 * S], { ground: 'cinder', roster: gantry });
  z.area('gantry', P(33, 56), [7 * S, 5 * S], { role: 'yard', ground: 'planks', roster: gantry });
  z.area('watch', P(17, 35), [7 * S, 5.4 * S], { role: 'ruin', ground: 'stone', roster: watch });
  z.area('shelf', P(47, 45), [6.4 * S, 4.6 * S], { ground: 'gravel', roster: gantry });
  z.area('crown', P(55, 32), [6 * S, 4.4 * S], { ground: 'stone' });
  z.area('furnace', P(60, 15), [10 * S, 7 * S], { role: 'arena', ground: 'ash', dress: 0.3 });
  z.area('bellows', P(78, 44), [6 * S, 4.6 * S], { ground: 'cinder', roster: watch });
  z.area('lookout', P(30, 20), [4.6 * S, 3.6 * S], { role: 'secret', ground: 'stone' });
  z.area('east_road', P(84, 30), [5 * S, 4 * S], { ground: 'cinder' });
  z.area('scree', P(28, 44), [5 * S, 4 * S], { ground: 'gravel', roster: watch });
  z.area('moor_south', P(48, 70), [9 * S, 5 * S], { ground: 'meadow', roster: moor });
  z.area('moor_east', P(88, 64), [6 * S, 6 * S], { ground: 'meadow', roster: moor });
  z.area('high_heath', P(86, 14), [6 * S, 6 * S], { ground: 'meadow', roster: moor });
  z.area('west_heath', P(8, 24), [5 * S, 6 * S], { ground: 'meadow', roster: moor });

  // ── pine stands and boulder fields
  for (const [x, y, r, n] of [[20, 54, 2.2, 5], [8, 40, 2.2, 5], [36, 34, 2, 5], [24, 10, 2.4, 6], [40, 62, 2.4, 6], [58, 48, 2.2, 5], [72, 70, 2.6, 6],
    [94, 36, 2.2, 5], [84, 6, 2, 4], [30, 72, 2.2, 5], [70, 38, 2, 4], [92, 74, 2, 4]] as const) z.grove(...P(x, y), r * S, n);
  for (const [x, y] of [[44, 54], [26, 26], [82, 56], [52, 62]] as const) z.grove(...P(x, y), 1.6 * S, 4, ['boulder', 'crag', 'boulder']);

  // ── roads: the gantry road up to the crown (main, validated), the watch loop, the bellows and east roads
  z.road([P(10.5, 71.5), P(17, 66.5), P(22, 63), P(28, 59), P(33, 56), P(40, 50), P(47, 45), P(52, 38), P(55, 32), P(58, 25), P(61, 20)], 170, 'cinder');
  z.road([P(28, 59), P(22, 47), P(17, 35), P(26, 30), P(38, 33), P(47, 38), P(55, 32)], 140, 'stone');
  z.road([P(26, 30), P(30, 20)], 130, 'stone');
  z.road([P(47, 45), P(62, 44), P(78, 44)], 140, 'cinder');
  z.road([P(55, 32), P(70, 31), P(84, 30)], 150, 'cinder');

  // ── Watchkeepers' Refuge
  z.camp(...P(11, 72.5), { tents: 1 });
  z.contact('watchkeeper', 'Venn', ...P(12.5, 74.8), 'person');
  z.portal(...P(6.5, 74), 'cinderwash_kilns', 'Cinderwash Kilns');
  z.resident('kw_guard', 'guard', 'Watch sentry', ...P(17, 72.5), -10); z.resident('kw_porter', 'porter', 'Refuge porter', ...P(7.5, 68.5), 25);
  z.wardPost(...P(16, 75.5)); z.landmark('Watchkeepers’ Refuge', ...P(10.5, 76.5));
  z.board(...P(15.6, 69.5), 'Refuge bounty board');
  z.moveTo('watchkeeper', 'kw_cold', ...P(52.2, 36.4));
  z.phase('kw_shift', true, () => {
    z.resident('kw_shift1', 'worker', 'Night shift', ...P(7.2, 72.4), 20); z.resident('kw_shift2', 'porter', 'Night shift', ...P(14.6, 69.2), -10);
    z.resident('kw_shift3', 'carpenter', 'Night shift', ...P(9.4, 76.4), 30); z.resident('kw_shift4', 'worker', 'Shift lead', ...P(13.2, 77), -30);
  });
  z.structure('house', ...P(6.5, 66), 2); z.resident('kw_clerk', 'clerk', 'Watch clerk', ...P(8.5, 70), 20);
  z.resident('kw_cook', 'innkeeper', 'Refuge cook', ...P(15.5, 70.5), -10);
  z.walker('kw_watch', 'guard', [P(17, 66.5), P(22, 63), P(28, 59), P(22, 63)], 42, 6); z.stores(...P(5, 70));
  z.structure('watchtower', ...P(4.5, 60));

  // ── the haulage gantry and the chimney collapse
  z.pack('gantry', ...P(34, 57.5), ['flint_beetle', 'cinder_cultist', 'bonewalker', 'ember_imp', 'bonewalker', 'flint_beetle']);
  z.contact('chimney_prop', 'Cracked chimney prop', ...P(29.5, 53), 'mechanism');
  z.pack('collapse', ...P(36, 53), ['ember_imp', 'ember_imp', 'ash_wisp', 'cinder_cultist', 'ember_imp', 'magma_brute', 'ember_imp']);
  z.event('chimney_collapse', 'Chimney Collapse', 'chimney_prop', 'collapse', 'One kick would bring the cracked chimney down — and whatever has been roosting in its flue.', 'Kick the prop');
  z.decor('logpile', ...P(37.5, 59.5)); z.decor('crates', ...P(30, 60)); z.landmark('Haulage Gantry', ...P(33, 61.5));
  z.contact('shift_board', 'Gantry shift board', ...P(37.5, 53.5), 'ledger');
  z.structure('ruinhouse', ...P(25.5, 50.5));

  // ── the abandoned watch, Sootveil and the old lookout
  z.pack('watch', ...P(18, 36.5), [{ type: 'vault_moth', dx: 0, dy: 0, tier: 2, name: 'Sootveil', affixes: ['faulted', 'fast'] }, 'grave_bat', 'bonewalker', 'ember_imp']);
  z.contact('watchlog', 'Watch log', ...P(12.5, 32.5), 'ledger');
  z.ruins(...P(12.5, 37), 380, 260); z.graves(...P(20.5, 40.5), 4); z.landmark('Abandoned Watch', ...P(17, 41));
  z.structure('stonetower', ...P(7, 29), 1);
  z.cache('cache_lookout', ...P(28.5, 19), 'Old watch cache'); z.decor('signalflag', ...P(32, 18)); z.landmark('Old Lookout', ...P(30, 23.5));
  z.structure('statue', ...P(34.5, 16.5));

  // ── the crown approach, the furnace and the Last Ember
  z.location('crown', ...P(54.5, 33));
  z.shrine('shrine_crown', ...P(50.5, 31), 'keen'); z.landmark('Crown Approach', ...P(55, 36.5));
  z.structure('beacontower', ...P(64.5, 29));
  z.kilns = [{ x: Math.round(58 * S), y: Math.round(8 * S), w: 400, d: 240, h: 200, cold: 'kw_cold' }];
  z.pack('heart', ...P(62, 18.5), [{ type: 'kiln_heart', dx: 0, dy: 0, tier: 2, name: 'The Last Ember', questTarget: true, combat: 'furnace' }]);
  z.contact('seal', 'Cold draw seal', ...P(68.5, 14), 'mechanism');
  // The cold draw shut (kw_cold): the furnace mouth goes dark; no more flames, smoke or embers over the crown.
  z.phase('kw_cold', false, () => { z.fire(...P(60.2, 10.9), 1.1); z.emit('smoke', ...P(60, 7), 9); z.emit('embers', ...P(62, 12), 10); z.light(...P(62, 11), 0xff6a2a, 360, 0.4); });
  z.phase('kw_cold', true, () => { z.emit('smoke', ...P(60, 7), 1); });
  z.landmark('Crown Furnace', ...P(62, 22.5));

  // ── the bellows house, Slagmaw, the road east
  z.elite('slagmaw', ...P(79, 45.5), 'magma_brute', 'Slagmaw', ['molten'], ['ember_imp', 'bonewalker', 'ash_wisp'], { questTarget: true });
  z.contact('lost_tin', 'Dented sweet tin', ...P(76, 47), 'cart');
  z.kilnYard(...P(74, 41)); z.cache('cache_bellows', ...P(82, 41), 'Bellows-house strongbox'); z.landmark('Bellows House', ...P(78, 49));
  z.structure('kilnstack', ...P(86, 40));
  z.portal(...P(86, 31), 'sablefen_causeway', 'Sablefen Causeway');

  // ── life, sound
  for (const [x, y] of [P(62, 13), P(33, 56)]) z.sound('fire', x, y);
  for (const [x, y] of [P(10, 72), P(84, 30), P(48, 70), P(86, 14)]) z.sound('wind', x, y);
  z.mist(...P(64, 62), 420); z.emit('birds', ...P(48, 70), 4); z.emit('birds', ...P(88, 64), 3); z.emit('smoke', ...P(74, 39), 4);
  z.critters('crows', ...P(17, 35), 240, 4); z.critters('hares', ...P(48, 70), 220, 3);
  z.fill({ roster: moor, spacing: 700, size: [6, 12], champion: 0.1, rare: 0.06, clear: 1100 });
  return z.build();
}

export const CAIRNSPILL = cairnspill(), CINDERWASH = cinderwash(), KILNWATCH = kilnwatch();
