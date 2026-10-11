// Fast parity gate for `npm run verify` (docs/rework/depth/FOUNDATION.md §8): asserts the 1.25 set-vs-legendary rule
// only for set-backed skills whose data is flagged `parityReady: true`. Unflagged skills are reported, never asserted.
// Full report for every set: scripts/audit-parity.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from '../../shared/src/data/skills';
import { SETS } from '../../shared/src/data/items';
import { PARITY_WINDOW, kitSave, measureProfile, parityProfiles, parityReadySkills, planKit, setSkills } from './parity/harness';
import { WARRIOR_MAIN, warriorDiversity } from './parity/warrior';
import { RANGER_MAIN, rangerDiversity } from './parity/ranger';

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
  for (const id of ['ground_stomp', 'cairnfall', 'tolling_blow']) assert(setSkills(SETS.fault_warden).includes(id), `Fault Warden backs ${id}`);
});

test('parity rule (1.25) holds for every parity-ready set-backed skill (the warrior and the ranger use the D-checks below)', () => {
  const dChecks = new Set(['warrior', 'ranger']);
  const ready = new Set(parityReadySkills().filter((id) => !dChecks.has(SKILLS[id].classId)));
  const profiles = parityProfiles().filter((p) => !dChecks.has(p.classId) && p.skills.some((id) => ready.has(id)));
  const backed = new Set(parityProfiles().flatMap((p) => p.skills));
  console.log(`parity: ${ready.size} parity-ready skill(s); ${backed.size} set-backed skills report-only (scripts/audit-parity.ts)`);
  for (const p of profiles) {
    const r = measureProfile(p);
    console.log(`parity ${p.set}: legendary/set ${r.ratio.toFixed(3)}, hybrid between ${r.hybridBetween}`);
    assert(r.ratio <= PARITY_WINDOW, `${p.set}: legendary-only kit is ${r.ratio.toFixed(2)}× slower than the set kit (limit ${PARITY_WINDOW})`);
    assert(r.hybridBetween, `${p.set}: hybrid kit is not between the set and legendary-only kits`);
  }
});

test('warrior: D3 and D4 (BUDGET.md §6 hard limits) hold for every parity-ready warrior main skill', () => {
  // Deterministic gate: planned kits without the search, one seed (~15 s). The full report with three seeds and the
  // search is scripts/audit-warrior-parity.ts (docs/rework/depth/WARRIOR-PARITY.md).
  // Warrior items only: the shared legendaries belong to the shared-items lane, and with them legendary-only kits beat
  // the sets (D3 1.2-1.46 measured after merging that wave; WARRIOR-PILOT.md §6). The audit reports both.
  const ready = WARRIOR_MAIN.filter((id) => SKILLS[id].parityReady);
  assert(ready.length > 0, 'the warrior pilot flags its passing main skills');
  const d = warriorDiversity({ seeds: [101], mains: ready, excludeShared: true });
  for (const r of d.rows) {
    const leg = r.factor.legendary, set6 = r.factor[r.bestSet6], hyb = r.factor[r.bestHybrid];
    const d3 = leg / set6, lo = Math.min(leg, set6), hi = Math.max(leg, set6);
    console.log(`warrior ${r.main}: legendary ×${leg.toFixed(2)}, best 6-piece ×${set6.toFixed(2)} (${r.bestSet6}), hybrid ×${hyb.toFixed(2)} (${r.bestHybrid}); D3 ${d3.toFixed(2)}`);
    assert(d3 >= 0.8 && d3 <= 1.25, `${r.main}: D3 legendary-only ÷ best 6-piece = ${d3.toFixed(2)} (hard 0.80–1.25)`);
    assert(hyb >= lo * 0.9 && hyb <= hi * 1.1, `${r.main}: D4 best hybrid ×${hyb.toFixed(2)} outside ±10% of [${lo.toFixed(2)}, ${hi.toFixed(2)}]`);
  }
});

test('ranger: D3 and D4 (BUDGET.md §6 hard limits) hold for every parity-ready ranger main skill', () => {
  // Same gate as the warrior: greedy kits, one seed, ranger items only (shared legendaries are the shared-items lane's;
  // scripts/audit-ranger-parity.ts reports both).
  const ready = RANGER_MAIN.filter((id) => SKILLS[id].parityReady);
  assert(ready.length > 0, 'the ranger wave flags its passing main skills');
  const d = rangerDiversity({ seeds: [101], mains: ready, excludeShared: true });
  for (const r of d.rows) {
    const leg = r.factor.legendary, set6 = r.factor[r.bestSet6], hyb = r.factor[r.bestHybrid];
    const d3 = leg / set6, lo = Math.min(leg, set6), hi = Math.max(leg, set6);
    console.log(`ranger ${r.main}: legendary ×${leg.toFixed(2)}, best 6-piece ×${set6.toFixed(2)} (${r.bestSet6}), hybrid ×${hyb.toFixed(2)} (${r.bestHybrid}); D3 ${d3.toFixed(2)}`);
    assert(d3 >= 0.8 && d3 <= 1.25, `${r.main}: D3 legendary-only ÷ best 6-piece = ${d3.toFixed(2)} (hard 0.80–1.25)`);
    assert(hyb >= lo * 0.9 && hyb <= hi * 1.1, `${r.main}: D4 best hybrid ×${hyb.toFixed(2)} outside ±10% of [${lo.toFixed(2)}, ${hi.toFixed(2)}]`);
  }
});
