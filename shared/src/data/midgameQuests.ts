import type { QuestDef, QuestStep, QuestTarget } from '../questTypes';
import type { QuestMessageKey } from './questMessages';
import { storyXp } from '../storyBudget';

const contact=(zone:string,target:string):QuestTarget=>({zone,target});
const venn=contact('kilnwatch_crown','watchkeeper'),sera=contact('sablefen_causeway','ferrier'),neris=contact('saltwind_pans','briner');
const aven=contact('lockglass_cistern','lockkeeper'),tallis=contact('shiverline_escarpment','lookout'),mera=contact('beaconbreak_ward','quartermaster');
const eris=contact('hollowstar_array','west_reader'),daro=contact('hollowstar_array','east_reader');
type Id='salt_bound'|'broken_toll'|'bitter_measure'|'sealed_brine'|'borrowed_pressure'|'lockglass_heart'|'ridge_trace'|'open_beacon'|'ward_gate'|'false_command'|'first_answer'|'two_voices'|'last_transmission';
type Step=[id:string,kind:QuestStep['kind'],target:string];
function quest(id:Id,from:number,to:number,start:QuestTarget,finish:QuestTarget,requires:string,chapter:string,steps:Step[],unlocks?:string,weapon=false):QuestDef {
  return {id,revision:1,chapter,title:`mid.${id}.title`,offer:`mid.${id}.offer`,complete:`mid.${id}.complete`,
    rewardText:weapon?'quest.reward.weapon':'mid.reward.progress',start,finish,requires:[requires],unlocks,
    reward:{xp:storyXp(from,to),...(weapon?{item:'magic_weapon' as const}:{})},
    steps:steps.map(([step,kind,target])=>({id:step,kind,target,zone:finish.zone,text:`mid.${id}.${step}` as QuestMessageKey}))};
}
export const MIDGAME_QUESTS:readonly QuestDef[]=[
  quest('salt_bound',20,23,venn,sera,'last_draw','salt_road',[['manifest','interact','manifest'],['toll','kill','toll']]),
  quest('broken_toll',23,25,sera,sera,'salt_bound','salt_road',[['writ','interact','false_writ'],['guard','kill','chainwatch'],['chain','interact','chain']],'saltwind_pans',true),
  quest('bitter_measure',25,28,sera,neris,'broken_toll','salt_road',[['inlet','interact','inlet'],['boiler','kill','boiler']]),
  quest('sealed_brine',28,30,neris,neris,'bitter_measure','salt_road',[['spill','interact','spill'],['watch','kill','dispatch_watch'],['dispatch','interact','dispatch']],'lockglass_cistern',true),
  quest('borrowed_pressure',30,33,neris,aven,'sealed_brine','lockglass',[['intake','wave','intake'],['filters','wave','filters']]),
  quest('lockglass_heart',33,35,aven,aven,'borrowed_pressure','lockglass',[['heart','wave','heart'],['archive','interact','archive']],'shiverline_escarpment',true),
  quest('ridge_trace',35,38,aven,tallis,'lockglass_heart','ridge_signals',[['flag','interact','lower_flag'],['intercept','kill','interceptor'],['slate','interact','intercept']]),
  quest('open_beacon',38,40,tallis,tallis,'ridge_trace','ridge_signals',[['code','interact','code'],['watch','kill','beacon_watch'],['light','interact','beacon']],'beaconbreak_ward',true),
  quest('ward_gate',40,43,tallis,mera,'open_beacon','ridge_signals',[['orders','interact','gate_orders'],['guard','kill','gatekeeper']]),
  quest('false_command',43,45,mera,mera,'ward_gate','ridge_signals',[['stores','interact','stores'],['cistern','interact','cistern'],['keeper','kill','relay_keeper'],['book','interact','relay_book']],'hollowstar_array',true),
  quest('first_answer',45,47,mera,eris,'false_command','hollowstar',[['west','wave','west']]),
  quest('two_voices',47,49,eris,daro,'first_answer','hollowstar',[['east','wave','east'],['strip','interact','contradiction']]),
  {...quest('last_transmission',49,50,daro,daro,'two_voices','hollowstar',[['conductor','wave','conductor'],['record','interact','final_record']],undefined,true),grantsFlags:['relay_network_restored']},
];
