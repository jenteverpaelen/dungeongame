import type { QuestDef, QuestStep } from '../questTypes';
import { storyMainXp, storyXp } from '../storyBudget';
import { contact, quest } from './questKit';

// Acts II–III (docs/rework/quests/DESIGN.md; LOG.md "Quest list"). Same ids, contacts, bosses and story beats; reworked
// objectives (repairs that change the world, hand-overs, gathers) and shorter text.
const SF = 'sablefen_causeway', SW = 'saltwind_pans', LG = 'lockglass_cistern', SL = 'shiverline_escarpment', BW = 'beaconbreak_ward', HS = 'hollowstar_array';
const venn = contact('kilnwatch_crown', 'watchkeeper'), sera = contact(SF, 'ferrier'), neris = contact(SW, 'briner');
const aven = contact(LG, 'lockkeeper'), tallis = contact(SL, 'lookout'), mera = contact(BW, 'quartermaster');
const eris = contact(HS, 'west_reader'), daro = contact(HS, 'east_reader');
const hold = (ms: number): Partial<QuestStep> => ({ hold: ms });

export const MIDGAME_QUESTS: readonly QuestDef[] = [
  // Act II · The Salt Road
  quest({ id: 'salt_bound', revision: 2, chapter: 'salt_road', zone: SF, start: venn, finish: sera, requires: ['last_draw'], reward: { xp: storyMainXp(20, 23) },
    steps: [['manifest', 'interact', 'manifest'], ['toll', 'kill', 'toll'], ['gate', 'interact', 'toll_gate', hold(2000)]] }),
  quest({ id: 'broken_toll', chapter: 'salt_road', zone: SF, start: sera, finish: sera, requires: ['salt_bound'], unlocks: SW, reward: { item: 'magic_weapon', pick: true, xp: storyMainXp(23, 25) },
    steps: [['writ', 'interact', 'false_writ'], ['guard', 'kill', 'chainwatch'], ['chain', 'interact', 'chain', hold(3000)]] }),
  quest({ id: 'bitter_measure', revision: 2, chapter: 'salt_road', zone: SW, start: sera, finish: neris, requires: ['broken_toll'], reward: { xp: storyMainXp(25, 28) },
    steps: [['inlet', 'interact', 'inlet'], ['boiler', 'kill', 'boiler'], ['damper', 'interact', 'boiler_damper', hold(2000)]] }),
  quest({ id: 'sealed_brine', chapter: 'salt_road', zone: SW, start: neris, finish: neris, requires: ['bitter_measure'], unlocks: LG, reward: { item: 'magic_weapon', pick: true, xp: storyMainXp(28, 30) },
    steps: [['spill', 'interact', 'spill', hold(2500)], ['watch', 'kill', 'dispatch_watch'], ['dispatch', 'interact', 'dispatch']] }),
  // Act II · Borrowed Water (private dungeon)
  quest({ id: 'borrowed_pressure', chapter: 'lockglass', zone: LG, start: neris, finish: aven, requires: ['sealed_brine'], reward: { xp: storyXp(30, 33) },
    steps: [['intake', 'wave', 'intake'], ['filters', 'wave', 'filters']] }),
  quest({ id: 'lockglass_heart', chapter: 'lockglass', zone: LG, start: aven, finish: aven, requires: ['borrowed_pressure'], unlocks: SL, reward: { item: 'magic_weapon', pick: true, xp: storyXp(33, 35) },
    steps: [['heart', 'wave', 'heart'], ['archive', 'interact', 'archive']] }),
  // Act III · The Ridge Signals
  quest({ id: 'ridge_trace', chapter: 'ridge_signals', zone: SL, start: aven, finish: tallis, requires: ['lockglass_heart'], reward: { xp: storyMainXp(35, 38) },
    steps: [['flag', 'interact', 'lower_flag'], ['intercept', 'kill', 'interceptor'], ['slate', 'interact', 'intercept']] }),
  quest({ id: 'open_beacon', chapter: 'ridge_signals', zone: SL, start: tallis, finish: tallis, requires: ['ridge_trace'], unlocks: BW, reward: { item: 'magic_weapon', pick: true, xp: storyMainXp(38, 40) },
    steps: [['code', 'interact', 'code'], ['watch', 'kill', 'beacon_watch'], ['light', 'interact', 'beacon', hold(3000)]] }),
  quest({ id: 'ward_gate', revision: 2, chapter: 'ridge_signals', zone: BW, start: tallis, finish: mera, requires: ['open_beacon'], reward: { xp: storyMainXp(40, 43) },
    steps: [['orders', 'interact', 'gate_orders'], ['guard', 'kill', 'gatekeeper'], ['bar', 'interact', 'west_bar', hold(2000)]] }),
  quest({ id: 'false_command', chapter: 'ridge_signals', zone: BW, start: mera, finish: mera, requires: ['ward_gate'], unlocks: HS, reward: { item: 'magic_weapon', pick: true, xp: storyMainXp(43, 45) },
    steps: [['stores', 'interact', 'stores'], ['cistern', 'interact', 'cistern', hold(2500)], ['keeper', 'kill', 'relay_keeper'], ['book', 'interact', 'relay_book']] }),
  // Act III · The Last Transmission (private dungeon)
  quest({ id: 'first_answer', chapter: 'hollowstar', zone: HS, start: mera, finish: eris, requires: ['false_command'], reward: { xp: storyXp(45, 47) },
    steps: [['west', 'wave', 'west']] }),
  quest({ id: 'two_voices', chapter: 'hollowstar', zone: HS, start: eris, finish: daro, requires: ['first_answer'], reward: { xp: storyXp(47, 49) },
    steps: [['east', 'wave', 'east'], ['strip', 'interact', 'contradiction']] }),
  quest({ id: 'last_transmission', chapter: 'hollowstar', zone: HS, start: daro, finish: daro, requires: ['two_voices'], grantsFlags: ['relay_network_restored'],
    reward: { item: 'magic_weapon', pick: true, xp: storyXp(49, 50) },
    steps: [['conductor', 'wave', 'conductor'], ['record', 'interact', 'final_record']] }),
];

/** Optional gifts preserve all mandatory story XP/weapon rewards and old claimed histories. Lessons category: a gift. */
export const MIDGAME_GIFTS: readonly QuestDef[] = [
  { id: 'keepers_mantle', revision: 1, category: 'lesson', title: 'mid.giftShoulders.title', offer: 'mid.giftShoulders.offer', complete: 'mid.giftShoulders.complete', rewardText: 'mid.giftShoulders.reward',
    start: neris, finish: neris, requires: ['sealed_brine'], reward: { item: 'class_set_shoulders' },
    steps: [{ id: 'kit', kind: 'talk', ...neris, text: 'mid.giftShoulders.talk' }] },
  { id: 'ridgeward_treads', revision: 1, category: 'lesson', title: 'mid.giftFeet.title', offer: 'mid.giftFeet.offer', complete: 'mid.giftFeet.complete', rewardText: 'mid.giftFeet.reward',
    start: aven, finish: aven, requires: ['lockglass_heart'], reward: { item: 'class_set_feet' },
    steps: [{ id: 'kit', kind: 'talk', ...aven, text: 'mid.giftFeet.talk' }] },
];
