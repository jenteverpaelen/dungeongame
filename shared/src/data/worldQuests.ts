import type { QuestDef, QuestStep } from '../questTypes';
import type { QuestMessageKey } from './questMessages';
import { ZONES } from './zones';

/**
 * Optional quests of the rebuilt zones (docs/rework/worlds/DESIGN.md §2, LOG W4). Rewards follow the camp-contract gold
 * formula (`campContracts.ts`): required work units × the mean gold pile at the zone's middle level × 1.5 (the hunt
 * premium). Side quests add one bounded item roll on completion (the existing magic class weapon at the claim level, the
 * same reward kind the story uses). No XP anywhere: story XP stays as calibrated in docs/rework/BALANCE.md (D-W03).
 * Event contracts are repeatable: clear the zone's optional field event once, paid like a hunt of eight.
 */
const pile = (level: number) => (4 + 2.5 * level) * Math.pow(1.06, level);
const gold = (zone: string, units: number) => { const [lo, hi] = ZONES[zone].levelBand; return Math.round(units * pile((lo + hi) / 2) * 1.5); };
const rw = 'rillwake_crossing', orren = { zone: rw, target: 'tender' };
type Step = [id: string, kind: QuestStep['kind'], target: string];
const k = (s: string) => s as QuestMessageKey;

function side(id: string, zone: string, giver: string, requires: string, steps: Step[], units = 16): QuestDef {
  const where = { zone, target: giver };
  return {
    id, revision: 1, title: k(`world.${id}.title`), offer: k(`world.${id}.offer`), complete: k(`world.${id}.complete`), rewardText: 'world.reward.side',
    start: where, finish: where, requires: [requires], reward: { gold: gold(zone, units), item: 'magic_weapon' },
    steps: steps.map(([step, kind, target]) => ({ id: step, kind, zone, target, text: k(`world.${id}.${step}`) })),
  };
}
function eventContract(id: string, zone: string, giver: string, requires: string, event: string): QuestDef {
  const where = { zone, target: giver };
  return {
    id, revision: 1, title: k(`world.${id}.title`), offer: k(`world.${id}.offer`), complete: 'quest.contract.done', rewardText: 'quest.contract.gold',
    start: where, finish: where, requires: [requires], repeat: 'on_return', reward: { gold: gold(zone, 8) },
    steps: [{ id: 'clear', kind: 'wave', zone, target: event, text: k(`world.${id}.clear`) }],
  };
}

export const WORLD_QUESTS: readonly QuestDef[] = [
  {
    id: 'lost_survey', revision: 1, title: 'world.lost_survey.title', offer: 'world.lost_survey.offer', complete: 'world.lost_survey.complete',
    rewardText: 'world.reward.gold', start: orren, finish: orren, requires: ['silent_wheel'], reward: { gold: gold(rw, 14) },
    steps: [
      { id: 'camp', kind: 'interact', zone: rw, target: 'party_camp', text: 'world.lost_survey.camp' },
      { id: 'journal', kind: 'interact', zone: rw, target: 'party_journal', text: 'world.lost_survey.journal' },
      { id: 'brackjaw', kind: 'kill', zone: rw, target: 'brackjaw', text: 'world.lost_survey.brackjaw' },
    ],
  },
  side('silt_gears', 'bracken_sluice', 'foreman', 'high_water', [['tally', 'interact', 'weir_tally'], ['weir', 'wave', 'bursting_weir'], ['grindle', 'kill', 'grindle']]),
  side('true_measure', 'cairnspill_terraces', 'surveyor', 'pressure_below', [['track', 'interact', 'stake_track'], ['scar', 'interact', 'stake_scar'], ['grindstone', 'kill', 'grindstone']]),
  side('fire_apology', 'cinderwash_kilns', 'firekeeper', 'stone_road', [['flare', 'wave', 'flare_up'], ['niche', 'interact', 'ember_niche'], ['cinderhusk', 'kill', 'cinderhusk']]),
  side('missing_shift', 'kilnwatch_crown', 'watchkeeper', 'untended_fires', [['board', 'interact', 'shift_board'], ['slagmaw', 'kill', 'slagmaw'], ['tin', 'interact', 'lost_tin']]),
  side('sera_count', 'sablefen_causeway', 'ferrier', 'last_draw', [['float', 'interact', 'cargo_float'], ['tide', 'wave', 'tide_of_skimmers'], ['mudgullet', 'kill', 'mudgullet']]),
  side('neris_tally', 'saltwind_pans', 'briner', 'broken_toll', [['west', 'interact', 'gauge_west'], ['east', 'interact', 'gauge_east'], ['clerk', 'kill', 'white_clerk']]),
  side('tallis_flags', 'shiverline_escarpment', 'lookout', 'lockglass_heart', [['post', 'interact', 'flag_post'], ['gale', 'wave', 'gale_harriers'], ['rimecrown', 'kill', 'rimecrown']]),
  side('mera_ledger', 'beaconbreak_ward', 'quartermaster', 'open_beacon', [['chapel', 'interact', 'ledger_chapel'], ['market', 'interact', 'ledger_market'], ['riot', 'wave', 'granary_riot'], ['seal', 'kill', 'second_seal']], 20),
  eventContract('contract_shallows', rw, 'tender', 'silent_wheel', 'shallows_swarm'),
  eventContract('contract_weir', 'bracken_sluice', 'foreman', 'high_water', 'bursting_weir'),
  eventContract('contract_rockfall', 'cairnspill_terraces', 'surveyor', 'pressure_below', 'rockfall_warning'),
  eventContract('contract_flare', 'cinderwash_kilns', 'firekeeper', 'stone_road', 'flare_up'),
  eventContract('contract_chimney', 'kilnwatch_crown', 'watchkeeper', 'untended_fires', 'chimney_collapse'),
  eventContract('contract_tide', 'sablefen_causeway', 'ferrier', 'last_draw', 'tide_of_skimmers'),
  eventContract('contract_boil', 'saltwind_pans', 'briner', 'broken_toll', 'boil_over'),
  eventContract('contract_gale', 'shiverline_escarpment', 'lookout', 'lockglass_heart', 'gale_harriers'),
  eventContract('contract_riot', 'beaconbreak_ward', 'quartermaster', 'open_beacon', 'granary_riot'),
];
