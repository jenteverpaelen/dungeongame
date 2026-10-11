import type { QuestMessageKey } from './questMessages';
import { CAST_DIALOGUES } from './castDialogues';
import { READING_MESSAGES } from './readingMessages';

export interface DialogueNode { text:QuestMessageKey; choices:{label:QuestMessageKey;to:string;when?:string[]}[] }
export interface DialogueDef { start:string; nodes:Record<string,DialogueNode> }
/** Reading a branch has no quest or reward side effects. Commands remain separate. */
export const DIALOGUES:Readonly<Record<string,DialogueDef>>={
  'rillwake_crossing/tender':{start:'greeting',nodes:{
    greeting:{text:'quest.dialogue.orren',choices:[{label:'quest.dialogue.workers.ask',to:'workers'},{label:'quest.dialogue.ridge.ask',to:'ridge'},{label:'quest.dialogue.wheel.ask',to:'wheel',when:['mill_names_recovered']},
      {label:'quest.dialogue.repaired.ask',to:'repaired',when:['waterworks_repaired']},{label:'quest.dialogue.end',to:'done'}]},
    workers:{text:'quest.dialogue.workers',choices:[{label:'quest.dialogue.back',to:'greeting'}]},
    ridge:{text:'quest.dialogue.ridge',choices:[{label:'quest.dialogue.back',to:'greeting'}]},
    wheel:{text:'quest.dialogue.wheel',choices:[{label:'quest.dialogue.back',to:'greeting'}]},
    repaired:{text:'quest.dialogue.repaired',choices:[{label:'quest.dialogue.back',to:'greeting'}]},
    done:{text:'quest.dialogue.done',choices:[]},
  }},
  // Objects read with their reading text (docs/rework/quests/DESIGN.md §8); people keep their conversations.
  ...Object.fromEntries(Object.keys(READING_MESSAGES).filter(k=>k.startsWith('read.')).map(k=>{const [,zone,id]=k.split('.');return [`${zone}/${id}`,{start:'read',nodes:{read:{text:k as QuestMessageKey,choices:[]}}}];})),
  ...CAST_DIALOGUES,
};
