import type { QuestDef } from '../questTypes';

const orren = { zone: 'rillwake_crossing', target: 'tender' };
export const QUESTS: readonly QuestDef[] = [
  {
    id:'first_road',tutorial:true,revision:1,title:'quest.firstroad.title',offer:'quest.firstroad.offer',complete:'quest.firstroad.complete',
    rewardText:'quest.firstroad.reward',start:orren,finish:orren,requires:[],reward:{item:'starter_upgrade'},
    steps:[{id:'slime',kind:'kill',zone:orren.zone,target:'road',monsterType:'bog_slime',text:'quest.firstroad.slime'}],
  },
  {
    id:'silent_wheel', chapter:'water_road', grantsFlags:['mill_names_recovered'], revision:1, title:'quest.wheel.title', offer:'quest.wheel.offer', complete:'quest.wheel.complete',
    rewardText:'quest.reward.weapon', start:orren, finish:orren, requires:[], reward:'magic_weapon',
    steps:[
      {id:'cart',kind:'interact',zone:orren.zone,target:'cart',text:'quest.wheel.cart'},
      {id:'warden',kind:'kill',zone:orren.zone,target:'mill',text:'quest.wheel.warden'},
      {id:'ledger',kind:'interact',zone:orren.zone,target:'ledger',text:'quest.wheel.ledger'},
    ],
  },
  {
    id:'high_water', chapter:'water_road', revision:1, title:'quest.highwater.title', offer:'quest.highwater.offer', complete:'quest.highwater.complete',
    rewardText:'quest.highwater.reward', start:orren, finish:orren, requires:['silent_wheel'], reward:'passage', unlocks:'bracken_sluice',
    steps:[
      {id:'ridge',kind:'reach',zone:orren.zone,target:'old_ridge',text:'quest.highwater.ridge'},
      {id:'survey',kind:'interact',zone:orren.zone,target:'survey',text:'quest.highwater.marker'},
    ],
  },
  {
    id:'under_spillway', chapter:'water_road', revision:1, title:'quest.spillway.title', offer:'quest.spillway.offer', complete:'quest.spillway.complete',
    rewardText:'quest.reward.weapon', start:orren, finish:orren, requires:['high_water'], reward:'magic_weapon', unlocks:'reedvault_pumpworks',
    steps:[
      {id:'approach',kind:'reach',zone:'bracken_sluice',target:'forecourt',text:'quest.spillway.approach'},
      {id:'keeper',kind:'kill',zone:'bracken_sluice',target:'keeper',text:'quest.spillway.keeper'},
      {id:'gate',kind:'interact',zone:'bracken_sluice',target:'floodgate',text:'quest.spillway.gate'},
    ],
  },
  {
    id:'pressure_below',chapter:'water_road',grantsFlags:['waterworks_repaired'],revision:1,title:'quest.pump.title',offer:'quest.pump.offer',complete:'quest.pump.complete',
    rewardText:'quest.reward.weapon',start:orren,finish:orren,requires:['under_spillway'],reward:'magic_weapon',
    steps:[
      {id:'west',kind:'wave',zone:'reedvault_pumpworks',target:'west',text:'quest.pump.west'},
      {id:'east',kind:'wave',zone:'reedvault_pumpworks',target:'east',text:'quest.pump.east'},
      {id:'heart',kind:'wave',zone:'reedvault_pumpworks',target:'heart',text:'quest.pump.heart'},
      {id:'record',kind:'interact',zone:'reedvault_pumpworks',target:'work_record',text:'quest.pump.record'},
    ],
  },
];
export const questById = (id: string) => QUESTS.find(q => q.id === id);
