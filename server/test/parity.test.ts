// Fast parity gate for `npm run verify` (docs/rework/depth/FOUNDATION.md §8): asserts the 1.25 set-vs-legendary rule
// only for set-backed skills whose data is flagged `parityReady: true`. Unflagged skills are reported, never asserted.
// Full report for every set: scripts/audit-parity.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from '../../shared/src/data/skills';
import { SETS } from '../../shared/src/data/items';
import { PARITY_WINDOW, kitSave, measureProfile, parityProfiles, parityReadySkills, planKit, setSkills } from './parity/harness';

assert(process.env.DATA_DIR, 'isolated DATA_DIR required');

test('every set names set-backed skills of its class; every planned kit is plain data the runner can build', () => {
  for (const p of parityProfiles()) {
    assert(p.skills.length > 0, `${p.set} names no skill in its top bonus`);
    for (const id of [...p.skills, ...p.slots]) assert.equal(SKILLS[id]?.classId, p.classId, `${p.set}: ${id}`);
    for (const kind of ['set', 'hybrid', 'legendary'] as const) {
      const spec = planKit(p, kind);
      assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec, 'KitSpec round-trips through JSON');
      const pieces = Object.values(spec.equipment).filter((x) => x && 'set' in x).length;
      assert.equal(pieces, kind === 'set' ? 6 : kind === 'hybrid' ? 4 : 0, `${spec.id} set pieces`);
      assert.equal(spec.cube.length, 3);
      const save = kitSave(spec, 101);
      assert.equal(Object.values(save.equipment).filter((it) => it?.set === p.set).length, pieces);
    }
  }
  assert.deepEqual(setSkills(SETS.endless_storm), ['whirlwind', 'ironplough'], 'Endless Storm keys off Channel');
  assert.deepEqual(setSkills(SETS.fault_warden).sort(), ['cairnfall', 'ground_stomp', 'ironplough', 'rend', 'sawtooth_hatchet', 'seismic_slam', 'tolling_blow', 'whirlwind'], 'a 6-piece on every skill falls back to the 4-piece targets (Spender and Stun skills)');
});

test('parity rule (1.25) holds for every parity-ready set-backed skill', () => {
  const ready = new Set(parityReadySkills());
  const profiles = parityProfiles().filter((p) => p.skills.some((id) => ready.has(id)));
  const backed = new Set(parityProfiles().flatMap((p) => p.skills));
  console.log(`parity: ${ready.size} parity-ready skill(s); ${backed.size} set-backed skills report-only (scripts/audit-parity.ts)`);
  for (const p of profiles) {
    const r = measureProfile(p);
    console.log(`parity ${p.set}: legendary/set ${r.ratio.toFixed(3)}, hybrid between ${r.hybridBetween}`);
    assert(r.ratio <= PARITY_WINDOW, `${p.set}: legendary-only kit is ${r.ratio.toFixed(2)}× slower than the set kit (limit ${PARITY_WINDOW})`);
    assert(r.hybridBetween, `${p.set}: hybrid kit is not between the set and legendary-only kits`);
  }
});
