import type { QuestDef, QuestStep } from '../questTypes';
import type { QuestMessageKey } from './questMessages';
import { ZONES } from './zones';

/**
 * Repeatable hunting contracts at the camps whose fields respawn their authored packs. Every contact offers two:
 * a *sweep* (defeat any authored creature in the zone: the easy, steady one) and a *hunt* (one monster family: it
 * needs hunting, so it pays more per kill). Gold only, like the three contracts at Orren; kills before acceptance
 * never count and a finished contract can be accepted again in person.
 *
 * Gold per required kill is the mean ground pile at the zone's middle level, `(4 + 2.5L)·1.06^L` (the mean of
 * `goldAmount`), times 1.0 for sweeps and 1.5 for hunts — the same 1.5 that Orren's road contract already pays.
 */
const pile = (level: number) => (4 + 2.5 * level) * Math.pow(1.06, level);
const gold = (zone: string, count: number, premium: number) => {
  const [lo, hi] = ZONES[zone].levelBand;
  return Math.round(count * pile((lo + hi) / 2) * premium);
};
type Spec = { id: string; zone: string; giver: string; requires: string; sweep: number; family: NonNullable<QuestStep['monsterFamily']>; hunt: number };
const key = (id: string, part: string) => `contract.${id}.${part}` as QuestMessageKey;

function contract(spec: Spec, kind: 'sweep' | 'hunt'): QuestDef {
  const id = `${spec.id}_${kind}`, count = kind === 'sweep' ? spec.sweep : spec.hunt;
  const where = { zone: spec.zone, target: spec.giver };
  return {
    id: `contract_${id}`, revision: 1, title: key(id, 'title'), offer: key(id, 'offer'), complete: key(id, 'done'),
    rewardText: 'quest.contract.gold', start: where, finish: where, requires: [spec.requires], repeat: 'on_return',
    reward: { gold: gold(spec.zone, count, kind === 'sweep' ? 1 : 1.5) },
    steps: [{ id: kind, kind: 'kill', zone: spec.zone, target: '*', count, ...(kind === 'hunt' ? { monsterFamily: spec.family } : {}), text: key(id, 'kill') }],
  };
}

const CAMPS: Spec[] = [
  { id: 'iven', zone: 'cairnspill_terraces', giver: 'surveyor', requires: 'stone_road', sweep: 12, family: 'moth', hunt: 4 },
  { id: 'kessa', zone: 'cinderwash_kilns', giver: 'firekeeper', requires: 'untended_fires', sweep: 12, family: 'imp', hunt: 5 },
  { id: 'venn', zone: 'kilnwatch_crown', giver: 'watchkeeper', requires: 'last_draw', sweep: 10, family: 'imp', hunt: 4 },
  { id: 'sera', zone: 'sablefen_causeway', giver: 'ferrier', requires: 'salt_bound', sweep: 10, family: 'shrimp', hunt: 4 },
  { id: 'neris', zone: 'saltwind_pans', giver: 'briner', requires: 'bitter_measure', sweep: 10, family: 'skeleton', hunt: 4 },
  { id: 'tallis', zone: 'shiverline_escarpment', giver: 'lookout', requires: 'ridge_trace', sweep: 10, family: 'goat', hunt: 4 },
  { id: 'mera', zone: 'beaconbreak_ward', giver: 'quartermaster', requires: 'ward_gate', sweep: 10, family: 'cultist', hunt: 4 },
];

export const CAMP_CONTRACTS: QuestDef[] = CAMPS.flatMap((c) => [contract(c, 'sweep'), contract(c, 'hunt')]);
