/**
 * World states (docs/rework/quests/DESIGN.md §7): quest milestones that change what one player sees and where people
 * stand, like phasing (docs/rework/quests/REFERENCES.md R7, R8). `step: n` = the first n objectives are done (or the
 * quest is complete); `done` = turned in; `until: 'done'` = only until the turn-in. Zone plans tag visuals with these
 * keys (`ZoneBuilder.phase / appear / moveTo`, structure and wheel `spin`); `worldStateOn` in quests.ts evaluates them.
 */
export interface WorldStateCond { quest: string; step?: number; done?: boolean; until?: 'done' }
export const WORLD_STATES: Readonly<Record<string, WorldStateCond>> = {
  // Rillwake Crossing
  rw_wheel: { quest: 'silent_wheel', step: 4 },          // the mill wheel turns, the millhands return, Orren moves to the mill
  rw_signal: { quest: 'high_water', step: 3 },           // signal fire on the overlook
  rw_wenna: { quest: 'lost_survey', step: 2, until: 'done' }, // the survey party waits on the upstream path
  rw_survey_home: { quest: 'lost_survey', done: true },  // the four surveyors are back at the mill
  // Bracken Sluice and the Pumpworks
  br_drained: { quest: 'under_spillway', step: 4 },      // floodgate open: the basin drains, the gate wheel turns, Hollis moves up
  br_weir: { quest: 'silt_gears', step: 3 },             // the old weir wheel turns again
  br_pumping: { quest: 'pressure_below', done: true },   // the pumphouse breathes (smoke, lamps, crew)
  // Cairnspill, Cinderwash, Kilnwatch
  cs_haul: { quest: 'stone_road', step: 5 },             // haul signal raised: quarry crews return, Iven at the dispatch shed
  cs_stakes: { quest: 'true_measure', done: true },      // Iven's new stakes along the Old Track
  cw_quiet: { quest: 'untended_fires', step: 4 },        // the upper kilns stop raging, Kessa at the upper kilns
  cw_niche: { quest: 'fire_apology', step: 2 },          // candles at the offering niche
  kw_cold: { quest: 'last_draw', step: 4 },              // the crown furnace goes cold, Venn at the crown approach
  kw_shift: { quest: 'missing_shift', done: true },      // the night shift is home at the refuge
  // Act II
  sf_toll: { quest: 'salt_bound', step: 3 },             // the toll gate stands open
  sf_chain: { quest: 'broken_toll', step: 3 },           // chain down, winch turning, ferries running
  sf_drivers: { quest: 'broken_toll', done: true },      // the stranded drivers are at the refuge
  sw_banked: { quest: 'bitter_measure', step: 3 },       // the firing lane boilers banked
  sw_spill: { quest: 'sealed_brine', step: 1 },          // the overflow drained
  // Act III
  sl_flags: { quest: 'tallis_flags', step: 2 },          // honest flags on the scree post
  sl_beacon: { quest: 'open_beacon', step: 3 },          // the upper beacon burns
  bw_open: { quest: 'ward_gate', step: 3 },              // the west street gate unbarred, people back in the street
  bw_water: { quest: 'false_command', step: 2 },         // the ward cistern flows
};
