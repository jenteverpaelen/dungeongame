import type { QuestMessageKey } from './questMessages';

export interface StoryChapter { id:string; title:QuestMessageKey; act:QuestMessageKey }
export interface LoreEntry { id:string; title:QuestMessageKey; text:QuestMessageKey; quest:string; afterStep:number }
/** Organization and recovered records for the existing original adventure, not new story bulk. */
export const CHAPTERS:readonly StoryChapter[]=[{id:'water_road',title:'story.waterRoad',act:'story.actOne'},{id:'upper_road',title:'story.upperRoad',act:'story.actOne'},
  {id:'salt_road',title:'story.saltRoad',act:'story.actTwo'},{id:'lockglass',title:'story.lockglass',act:'story.actTwo'},
  {id:'ridge_signals',title:'story.ridgeSignals',act:'story.actThree'},{id:'hollowstar',title:'story.hollowstar',act:'story.actThree'}];
export const LORE:readonly LoreEntry[]=[
  {id:'survey_journal',title:'world.lost_survey.lore.title',text:'world.lost_survey.lore',quest:'lost_survey',afterStep:1},
  {id:'stake_notes',title:'world.true_measure.lore.title',text:'world.true_measure.lore',quest:'true_measure',afterStep:1},
  {id:'shift_board',title:'world.missing_shift.lore.title',text:'world.missing_shift.lore',quest:'missing_shift',afterStep:1},
  {id:'ledger_pages',title:'world.mera_ledger.lore.title',text:'world.mera_ledger.lore',quest:'mera_ledger',afterStep:1},
  {id:'convoy_manifest',title:'q.salt_bound.manifest',text:'mid.lore.manifest',quest:'salt_bound',afterStep:1},
  {id:'salt_dispatch',title:'q.sealed_brine.dispatch',text:'mid.lore.dispatch',quest:'sealed_brine',afterStep:3},
  {id:'water_archive',title:'q.lockglass_heart.archive',text:'mid.lore.archive',quest:'lockglass_heart',afterStep:2},
  {id:'signal_slate',title:'q.ridge_trace.slate',text:'mid.lore.slate',quest:'ridge_trace',afterStep:3},
  {id:'relay_duty',title:'q.false_command.book',text:'mid.lore.duty',quest:'false_command',afterStep:4},
  {id:'command_spool',title:'q.last_transmission.record',text:'mid.lore.spool',quest:'last_transmission',afterStep:2},
  {id:'quarry_dispatch',title:'q.stone_road.dispatch',text:'story.stone.record',quest:'stone_road',afterStep:4},
  {id:'firing_tally',title:'q.untended_fires.tally',text:'story.fires.record',quest:'untended_fires',afterStep:2},
  {id:'last_watch',title:'q.last_draw.watch',text:'story.draw.record',quest:'last_draw',afterStep:2},
  {id:'cart_tracks',title:'story.cart',text:'quest.dialogue.cart',quest:'silent_wheel',afterStep:1},
  {id:'mill_ledger',title:'story.ledger',text:'quest.dialogue.ledger',quest:'silent_wheel',afterStep:3},
  {id:'ridge_survey',title:'story.survey',text:'quest.dialogue.survey',quest:'high_water',afterStep:1},
  {id:'floodgate',title:'story.floodgate',text:'quest.dialogue.floodgate',quest:'under_spillway',afterStep:4},
  {id:'pump_record',title:'story.pump',text:'story.pump.record',quest:'pressure_below',afterStep:4},
];
