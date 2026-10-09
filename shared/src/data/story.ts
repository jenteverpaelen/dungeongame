import type { QuestMessageKey } from './questMessages';

export interface StoryChapter { id:string; title:QuestMessageKey; act:QuestMessageKey }
export interface LoreEntry { id:string; title:QuestMessageKey; text:QuestMessageKey; quest:string; afterStep:number }
/** Organization and recovered records for the existing original adventure, not new story bulk. */
export const CHAPTERS:readonly StoryChapter[]=[{id:'water_road',title:'story.waterRoad',act:'story.actOne'}];
export const LORE:readonly LoreEntry[]=[
  {id:'cart_tracks',title:'story.cart',text:'quest.dialogue.cart',quest:'silent_wheel',afterStep:1},
  {id:'mill_ledger',title:'story.ledger',text:'quest.dialogue.ledger',quest:'silent_wheel',afterStep:3},
  {id:'ridge_survey',title:'story.survey',text:'quest.dialogue.survey',quest:'high_water',afterStep:2},
  {id:'floodgate',title:'story.floodgate',text:'quest.dialogue.floodgate',quest:'under_spillway',afterStep:3},
  {id:'pump_record',title:'story.pump',text:'story.pump.record',quest:'pressure_below',afterStep:4},
];
