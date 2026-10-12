import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/math';
import { rollDrops, EQUIPMENT_DROP_SCALE, pityThreshold, type DropContext } from '../src/items';

assert.ok(process.env.DATA_DIR, 'Loot history checks require an isolated DATA_DIR');
const context: DropContext = { classId: 'mage', level: 1, difficulty: 0, elite: 4, magicFind: 0, pity: 17, inRift: true };
const rarities = (result: ReturnType<typeof rollDrops>) => result.drops.filter(d => d.type === 'item').map(d => d.item.rarity);
/** Items a boss batch plans before the Legendary fallback: the same first draws rollDrops makes (count, then stochastic rounding). */
const plannedItems = (seed: number) => { const r = new Rng(seed); const scaled = r.int(5, 7) * EQUIPMENT_DROP_SCALE; return Math.floor(scaled) + (scaled % 1 > 0 && r.chance(scaled % 1) ? 1 : 0); };

// Seeds are RNG fixtures (the early-game drop pass of 2026-10-12 changed the rarity weights: 15 → 4, 6 → 9).
test('a fallback boss Legendary ends the bad-luck streak', () => {
  const result = rollDrops(new Rng(4), context, 0);
  assert.deepEqual(rarities(result), ['normal', 'magic', 'magic', 'magic', 'normal', 'legendary']);
  assert.equal(rarities(result).length, plannedItems(4) + 1, 'the last item is the appended fallback, not a natural roll');
  assert.equal(result.pity, 0, 'The guaranteed last item is a success, not another miss');
});

// Seeds are RNG fixtures: the shared-items wave grew the base and affix pools (generation draws), so 27 → 6.
test('misses after a natural boss success remain counted', () => {
  const result = rollDrops(new Rng(9), context, 0);
  assert.deepEqual(rarities(result), ['legendary', 'magic', 'magic']);
  assert.equal(rarities(result).length, plannedItems(9), 'a natural success: no fallback was appended');
  assert.equal(result.pity, 2, 'Do not reset every boss batch unconditionally');
});

test('no equipment preserves history and the existing threshold applies to the next item', () => {
  // The threshold scales with level while levelling (250 at level 1, 45 from level 60).
  const threshold = pityThreshold(context.level);
  const normal = { ...context, elite: 0 as const, inRift: false, pity: threshold };
  const empty = rollDrops(new Rng(1), normal, 0);
  assert.deepEqual(rarities(empty), []);
  assert.equal(empty.pity, threshold);
  const lastMiss = rollDrops(new Rng(7), { ...normal, pity: threshold - 1 }, 0);
  assert.deepEqual(rarities(lastMiss), ['rare']);
  assert.equal(lastMiss.pity, threshold);
  const protectedDrop = rollDrops(new Rng(7), normal, 0);
  assert.equal(rarities(protectedDrop).length, 1);
  assert.ok(['legendary', 'set'].includes(rarities(protectedDrop)[0]));
  assert.equal(protectedDrop.pity, 0);
});

test('all-class boss histories agree with the generated item sequence', () => {
  let fallbacks = 0;
  for (const classId of ['warrior', 'ranger', 'mage'] as const) for (const level of [1, 70])
    for (const difficulty of [0, 6]) for (let seed = 1; seed <= 64; seed++) {
      const result = rollDrops(new Rng(seed), { ...context, classId, level, difficulty }, 0);
      const output = rarities(result);
      const trailingMisses = [...output].reverse().findIndex(r => r === 'legendary' || r === 'set');
      assert.ok(trailingMisses >= 0, 'Every boss batch must contain a success');
      assert.equal(result.pity, trailingMisses, `${classId}/L${level}/D${difficulty}/seed${seed}`);
      if (output.length > plannedItems(seed)) fallbacks++;
    }
  assert.ok(fallbacks > 0, 'Fixtures must reach the fallback branch');
});
