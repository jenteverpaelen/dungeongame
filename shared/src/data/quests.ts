import type { QuestDef } from '../questTypes';

const orren = { zone: 'rillwake_crossing', target: 'tender' };
export const QUESTS: readonly QuestDef[] = [
  {
    id:'silent_wheel', revision:1, title:'quest.wheel.title', offer:'quest.wheel.offer', complete:'quest.wheel.complete',
    rewardText:'quest.reward.weapon', start:orren, finish:orren, requires:[], reward:'magic_weapon',
    steps:[
      {id:'cart',kind:'interact',zone:orren.zone,target:'cart',text:'quest.wheel.cart'},
      {id:'warden',kind:'kill',zone:orren.zone,target:'mill',text:'quest.wheel.warden'},
      {id:'ledger',kind:'interact',zone:orren.zone,target:'ledger',text:'quest.wheel.ledger'},
    ],
  },
  {
    id:'high_water', revision:1, title:'quest.highwater.title', offer:'quest.highwater.offer', complete:'quest.highwater.complete',
    rewardText:'quest.highwater.reward', start:orren, finish:orren, requires:['silent_wheel'], reward:'passage', unlocks:'bracken_sluice',
    steps:[
      {id:'ridge',kind:'reach',zone:orren.zone,target:'old_ridge',text:'quest.highwater.ridge'},
      {id:'survey',kind:'interact',zone:orren.zone,target:'survey',text:'quest.highwater.marker'},
    ],
  },
  {
    id:'under_spillway', revision:1, title:'quest.spillway.title', offer:'quest.spillway.offer', complete:'quest.spillway.complete',
    rewardText:'quest.reward.weapon', start:orren, finish:orren, requires:['high_water'], reward:'magic_weapon',
    steps:[
      {id:'approach',kind:'reach',zone:'bracken_sluice',target:'forecourt',text:'quest.spillway.approach'},
      {id:'keeper',kind:'kill',zone:'bracken_sluice',target:'keeper',text:'quest.spillway.keeper'},
      {id:'gate',kind:'interact',zone:'bracken_sluice',target:'floodgate',text:'quest.spillway.gate'},
    ],
  },
];
export const questById = (id: string) => QUESTS.find(q => q.id === id);
