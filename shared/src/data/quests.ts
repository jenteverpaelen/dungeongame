import type { QuestDef } from '../questTypes';

import { storyXp } from '../storyBudget';
import { MIDGAME_QUESTS, MIDGAME_GIFTS } from './midgameQuests';
import { WORKSHOP_QUESTS } from './workshopQuests';
import { CAMP_CONTRACTS } from './campContracts';
import { WORLD_QUESTS } from './worldQuests';
export { storyXp } from '../storyBudget';
const orren = { zone: 'rillwake_crossing', target: 'tender' };
export const QUESTS: readonly QuestDef[] = [
  {
    id:'first_road',tutorial:true,revision:1,title:'quest.firstroad.title',offer:'quest.firstroad.offer',complete:'quest.firstroad.complete',
    rewardText:'quest.firstroad.reward',start:orren,finish:orren,requires:[],reward:{item:'starter_upgrade'},
    steps:[{id:'slime',kind:'kill',zone:orren.zone,target:'road',monsterType:'bog_slime',text:'quest.firstroad.slime'}],
  },
  {
    id:'silent_wheel', chapter:'water_road', grantsFlags:['mill_names_recovered'], revision:1, title:'quest.wheel.title', offer:'quest.wheel.offer', complete:'quest.wheel.complete',
    rewardText:'quest.reward.weapon', start:orren, finish:orren, requires:[], reward:{item:'magic_weapon',xp:storyXp(1,3)},
    steps:[
      {id:'cart',kind:'interact',zone:orren.zone,target:'cart',text:'quest.wheel.cart'},
      {id:'warden',kind:'kill',zone:orren.zone,target:'mill',text:'quest.wheel.warden'},
      {id:'ledger',kind:'interact',zone:orren.zone,target:'ledger',text:'quest.wheel.ledger'},
    ],
  },
  {
    id:'high_water', chapter:'water_road', revision:1, title:'quest.highwater.title', offer:'quest.highwater.offer', complete:'quest.highwater.complete',
    rewardText:'quest.highwater.reward', start:orren, finish:orren, requires:['silent_wheel'], reward:{xp:storyXp(3,4)}, unlocks:'bracken_sluice',
    steps:[
      {id:'ridge',kind:'reach',zone:orren.zone,target:'old_ridge',text:'quest.highwater.ridge'},
      {id:'survey',kind:'interact',zone:orren.zone,target:'survey',text:'quest.highwater.marker'},
    ],
  },
  {
    id:'under_spillway', chapter:'water_road', revision:1, title:'quest.spillway.title', offer:'quest.spillway.offer', complete:'quest.spillway.complete',
    rewardText:'quest.reward.weapon', start:orren, finish:orren, requires:['high_water'], reward:{item:'magic_weapon',xp:storyXp(4,7)}, unlocks:'reedvault_pumpworks',
    steps:[
      {id:'approach',kind:'reach',zone:'bracken_sluice',target:'forecourt',text:'quest.spillway.approach'},
      {id:'keeper',kind:'kill',zone:'bracken_sluice',target:'keeper',text:'quest.spillway.keeper'},
      {id:'gate',kind:'interact',zone:'bracken_sluice',target:'floodgate',text:'quest.spillway.gate'},
    ],
  },
  {
    id:'pressure_below',chapter:'water_road',grantsFlags:['waterworks_repaired'],revision:1,title:'quest.pump.title',offer:'quest.pump.offer',complete:'quest.pump.complete',
    rewardText:'quest.reward.weapon',start:orren,finish:orren,requires:['under_spillway'],reward:{item:'magic_weapon',xp:storyXp(7,9)},unlocks:'cairnspill_terraces',
    steps:[
      {id:'west',kind:'wave',zone:'reedvault_pumpworks',target:'west',text:'quest.pump.west'},
      {id:'east',kind:'wave',zone:'reedvault_pumpworks',target:'east',text:'quest.pump.east'},
      {id:'heart',kind:'wave',zone:'reedvault_pumpworks',target:'heart',text:'quest.pump.heart'},
      {id:'record',kind:'interact',zone:'reedvault_pumpworks',target:'work_record',text:'quest.pump.record'},
    ],
  },
  {
    id:'stone_road',chapter:'upper_road',revision:1,title:'quest.stone.title',offer:'quest.stone.offer',complete:'quest.stone.complete',
    rewardText:'quest.reward.weapon',start:orren,finish:{zone:'cairnspill_terraces',target:'surveyor'},requires:['pressure_below'],
    reward:{item:'magic_weapon',xp:storyXp(9,12)},unlocks:'cinderwash_kilns',grantsFlags:['stone_road_open'],
    steps:[{id:'cutting',kind:'reach',zone:'cairnspill_terraces',target:'cutting',text:'quest.stone.cutting'},
      {id:'foreman',kind:'kill',zone:'cairnspill_terraces',target:'foreman',text:'quest.stone.foreman'},
      {id:'dispatch',kind:'interact',zone:'cairnspill_terraces',target:'dispatch',text:'quest.stone.dispatch'}],
  },
  {
    id:'untended_fires',chapter:'upper_road',revision:1,title:'quest.fires.title',offer:'quest.fires.offer',complete:'quest.fires.complete',
    rewardText:'quest.reward.weapon',start:{zone:'cairnspill_terraces',target:'surveyor'},finish:{zone:'cinderwash_kilns',target:'firekeeper'},requires:['stone_road'],
    reward:{item:'magic_weapon',xp:storyXp(12,16)},unlocks:'kilnwatch_crown',grantsFlags:['kiln_draught_closed'],
    steps:[{id:'tally',kind:'interact',zone:'cinderwash_kilns',target:'tally',text:'quest.fires.tally'},
      {id:'stoker',kind:'kill',zone:'cinderwash_kilns',target:'stoker',text:'quest.fires.stoker'},
      {id:'draught',kind:'interact',zone:'cinderwash_kilns',target:'draught',text:'quest.fires.draught'}],
  },
  {
    id:'last_draw',chapter:'upper_road',revision:1,title:'quest.draw.title',offer:'quest.draw.offer',complete:'quest.draw.complete',
    rewardText:'quest.reward.weapon',start:{zone:'cinderwash_kilns',target:'firekeeper'},finish:{zone:'kilnwatch_crown',target:'watchkeeper'},requires:['untended_fires'],
    reward:{item:'magic_weapon',xp:storyXp(16,20)},grantsFlags:['frontier_reopened'],unlocks:'sablefen_causeway',
    steps:[{id:'watch',kind:'interact',zone:'kilnwatch_crown',target:'watchlog',text:'quest.draw.watch'},
      {id:'heart',kind:'kill',zone:'kilnwatch_crown',target:'heart',text:'quest.draw.heart'},
      {id:'seal',kind:'interact',zone:'kilnwatch_crown',target:'seal',text:'quest.draw.seal'}],
  },
  {
    id:'contract_road',revision:1,title:'quest.contract.road.title',offer:'quest.contract.road.offer',complete:'quest.contract.done',
    rewardText:'quest.contract.gold',start:orren,finish:orren,requires:['silent_wheel'],repeat:'on_return',reward:{gold:54},
    steps:[{id:'slimes',kind:'kill',zone:orren.zone,target:'road',monsterType:'bog_slime',count:3,text:'quest.contract.road.kill'}],
  },
  {
    id:'contract_bank',revision:1,title:'quest.contract.bank.title',offer:'quest.contract.bank.offer',complete:'quest.contract.done',
    rewardText:'quest.contract.gold',start:orren,finish:orren,requires:['under_spillway'],repeat:'on_return',reward:{gold:64},
    steps:[{id:'bats',kind:'kill',zone:'bracken_sluice',target:'bank',monsterType:'grave_bat',count:2,text:'quest.contract.bank.kill'}],
  },
  {
    id:'contract_alarm',revision:1,title:'quest.contract.alarm.title',offer:'quest.contract.alarm.offer',complete:'quest.contract.done',
    rewardText:'quest.contract.gold',start:orren,finish:orren,requires:['high_water'],repeat:'on_return',reward:{gold:108},
    steps:[{id:'alarm',kind:'wave',zone:orren.zone,target:'survey_alarm',text:'quest.contract.alarm.clear'}],
  },
  ...MIDGAME_QUESTS,
  ...MIDGAME_GIFTS,
  ...WORKSHOP_QUESTS,
  ...CAMP_CONTRACTS,
  ...WORLD_QUESTS,
];
export const questById = (id: string) => QUESTS.find(q => q.id === id);
