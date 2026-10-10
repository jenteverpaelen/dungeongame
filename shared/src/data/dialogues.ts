import type { QuestMessageKey } from './questMessages';
import { CAST_DIALOGUES } from './castDialogues';

export interface DialogueNode { text:QuestMessageKey; choices:{label:QuestMessageKey;to:string;when?:string[]}[] }
export interface DialogueDef { start:string; nodes:Record<string,DialogueNode> }
/** Reading a branch has no quest or reward side effects. Commands remain separate. */
export const DIALOGUES:Readonly<Record<string,DialogueDef>>={
  'rillwake_crossing/tender':{start:'greeting',nodes:{
    greeting:{text:'quest.dialogue.orren',choices:[{label:'quest.dialogue.workers.ask',to:'workers'},{label:'quest.dialogue.ridge.ask',to:'ridge'},
      {label:'quest.dialogue.repaired.ask',to:'repaired',when:['waterworks_repaired']},{label:'quest.dialogue.end',to:'done'}]},
    workers:{text:'quest.dialogue.workers',choices:[{label:'quest.dialogue.back',to:'greeting'}]},
    ridge:{text:'quest.dialogue.ridge',choices:[{label:'quest.dialogue.back',to:'greeting'}]},
    repaired:{text:'quest.dialogue.repaired',choices:[{label:'quest.dialogue.back',to:'greeting'}]},
    done:{text:'quest.dialogue.done',choices:[]},
  }},
  'rillwake_crossing/cart':{start:'read',nodes:{read:{text:'quest.dialogue.cart',choices:[]}}},
  'rillwake_crossing/ledger':{start:'read',nodes:{read:{text:'quest.dialogue.ledger',choices:[]}}},
  'rillwake_crossing/survey':{start:'read',nodes:{read:{text:'quest.dialogue.survey',choices:[]}}},
  'bracken_sluice/floodgate':{start:'read',nodes:{read:{text:'quest.dialogue.floodgate',choices:[]}}},
  ...CAST_DIALOGUES,
};
