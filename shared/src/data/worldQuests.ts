import type { QuestDef } from '../questTypes';
import { ZONES } from './zones';
import { sideXpFor } from '../storyBudget';
import { contact, quest, type StepSpec } from './questKit';

/**
 * Side stories of the rebuilt field zones (docs/rework/quests/DESIGN.md §2, §9). One per zone, offered at the hub with the
 * zone's story step so both fit one outing. Rewards: the zone's side share of quest XP (20 % of the zone span, so the total
 * story budget is unchanged), gold by the camp-contract formula × 1.5, and the weapon-or-armour pick.
 * Repeatable contracts are gone: bounty boards replace them (shared/src/bounties.ts).
 */
const pile = (level: number) => (4 + 2.5 * level) * Math.pow(1.06, level);
const gold = (zone: string, units: number) => { const [lo, hi] = ZONES[zone].levelBand; return Math.round(units * pile((lo + hi) / 2) * 1.5); };
function side(id: string, zone: string, giver: string, requires: string[], steps: StepSpec[], o: { units?: number; revision?: number } = {}): QuestDef {
  const where = contact(zone, giver);
  return quest({ id, revision: o.revision ?? 1, category: 'side', zone, start: where, finish: where, requires, steps, rewardText: 'world.reward.side',
    reward: { xp: sideXpFor(zone), gold: gold(zone, o.units ?? 16), item: 'magic_weapon', pick: true } });
}

export const WORLD_QUESTS: readonly QuestDef[] = [
  side('lost_survey', 'rillwake_crossing', 'tender', [], [['records', 'interact', 'party_camp', { targets: ['party_camp', 'party_journal'] }], ['brackjaw', 'kill', 'brackjaw'], ['wenna', 'talk', 'wenna']], { units: 14, revision: 2 }),
  side('silt_gears', 'bracken_sluice', 'foreman', ['high_water'], [['tally', 'interact', 'weir_tally'], ['cogs', 'interact', 'cog_basin', { targets: ['cog_basin', 'cog_weir', 'cog_reeds'] }], ['weir', 'wave', 'bursting_weir'], ['grindle', 'kill', 'grindle']], { revision: 2 }),
  side('true_measure', 'cairnspill_terraces', 'surveyor', ['pressure_below'], [['stakes', 'interact', 'stake_track', { targets: ['stake_track', 'stake_scar'] }], ['grindstone', 'kill', 'grindstone']], { revision: 2 }),
  side('fire_apology', 'cinderwash_kilns', 'firekeeper', ['stone_road'], [['flare', 'wave', 'flare_up'], ['niche', 'interact', 'ember_niche', { hold: 1500 }], ['cinderhusk', 'kill', 'cinderhusk']]),
  side('missing_shift', 'kilnwatch_crown', 'watchkeeper', ['untended_fires'], [['board', 'interact', 'shift_board'], ['slagmaw', 'kill', 'slagmaw'], ['tin', 'interact', 'lost_tin']]),
  side('sera_count', 'sablefen_causeway', 'ferrier', ['last_draw'], [['float', 'interact', 'cargo_float'], ['tide', 'wave', 'tide_of_skimmers'], ['mudgullet', 'kill', 'mudgullet']]),
  side('neris_tally', 'saltwind_pans', 'briner', ['broken_toll'], [['gauges', 'interact', 'gauge_west', { targets: ['gauge_west', 'gauge_east'] }], ['clerk', 'kill', 'white_clerk']], { revision: 2 }),
  side('tallis_flags', 'shiverline_escarpment', 'lookout', ['lockglass_heart'], [['post', 'interact', 'flag_post'], ['flags', 'interact', 'flag_red', { targets: ['flag_red', 'flag_blue', 'flag_yellow'], ordered: true }], ['gale', 'wave', 'gale_harriers'], ['rimecrown', 'kill', 'rimecrown']], { revision: 2 }),
  side('mera_ledger', 'beaconbreak_ward', 'quartermaster', ['open_beacon'], [['pages', 'interact', 'ledger_chapel', { targets: ['ledger_chapel', 'ledger_market'] }], ['riot', 'wave', 'granary_riot'], ['seal', 'kill', 'second_seal']], { units: 20, revision: 2 }),
];
