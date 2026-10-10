import type { DialogueDef, DialogueNode } from './dialogues';
import type { QuestMessageKey } from './questMessages';

/**
 * Conversations for the people of the frontier (Orren's lives in dialogues.ts). Topics marked `when` open once the
 * player has earned that story flag, so the people react to what the player has actually done.
 */
interface Topic { id: string; when?: string[] }
const key = (s: string) => s as QuestMessageKey;

function person(name: string, topics: Topic[]): DialogueDef {
  const nodes: Record<string, DialogueNode> = {
    greeting: {
      text: key(`cast.${name}.greeting`),
      choices: [
        ...topics.map((t) => ({ label: key(`cast.${name}.${t.id}.ask`), to: t.id, ...(t.when ? { when: t.when } : {}) })),
        { label: key('cast.end'), to: 'done' },
      ],
    },
    done: { text: key(`cast.${name}.done`), choices: [] },
  };
  for (const t of topics) nodes[t.id] = { text: key(`cast.${name}.${t.id}`), choices: [{ label: key('cast.back'), to: 'greeting' }] };
  return { start: 'greeting', nodes };
}

export const CAST_DIALOGUES: Readonly<Record<string, DialogueDef>> = {
  'cairnspill_terraces/surveyor': person('iven', [{ id: 'quarry' }, { id: 'seal' }, { id: 'orren', when: ['mill_names_recovered'] }, { id: 'open', when: ['stone_road_open'] }]),
  'cinderwash_kilns/firekeeper': person('kessa', [{ id: 'kilns' }, { id: 'tally' }, { id: 'pumps', when: ['waterworks_repaired'] }, { id: 'quiet', when: ['kiln_draught_closed'] }]),
  'kilnwatch_crown/watchkeeper': person('venn', [{ id: 'watch' }, { id: 'furnace' }, { id: 'orders' }, { id: 'home', when: ['frontier_reopened'] }]),
  'sablefen_causeway/ferrier': person('sera', [{ id: 'ferries' }, { id: 'toll' }, { id: 'venn', when: ['frontier_reopened'] }, { id: 'quiet', when: ['relay_network_restored'] }]),
  'saltwind_pans/briner': person('neris', [{ id: 'tally' }, { id: 'crews' }, { id: 'ledger' }, { id: 'sera', when: ['frontier_reopened'] }]),
  'lockglass_cistern/lockkeeper': person('aven', [{ id: 'water' }, { id: 'governor' }, { id: 'orders' }, { id: 'pumps', when: ['waterworks_repaired'] }]),
  'shiverline_escarpment/lookout': person('tallis', [{ id: 'wind' }, { id: 'flags' }, { id: 'beacon' }, { id: 'quiet', when: ['relay_network_restored'] }]),
  'beaconbreak_ward/quartermaster': person('mera', [{ id: 'stores' }, { id: 'orders' }, { id: 'crews' }, { id: 'right', when: ['relay_network_restored'] }]),
  'hollowstar_array/west_reader': person('eris', [{ id: 'music' }, { id: 'daro' }, { id: 'verse', when: ['relay_network_restored'] }]),
  'hollowstar_array/east_reader': person('daro', [{ id: 'east' }, { id: 'eris' }, { id: 'over', when: ['relay_network_restored'] }]),
};
