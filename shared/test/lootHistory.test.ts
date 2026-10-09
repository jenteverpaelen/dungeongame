import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Rng } from '../src/math';
import { rollDrops, type DropContext } from '../src/items';

assert.ok(process.env.DATA_DIR, 'Loot history checks require an isolated DATA_DIR');
const context: DropContext = { classId: 'mage', level: 1, difficulty: 0, elite: 4, magicFind: 0, pity: 17, inRift: true };
const rarities = (result: ReturnType<typeof rollDrops>) => result.drops.filter(d => d.type === 'item').map(d => d.item.rarity);

test('a fallback boss Legendary ends the bad-luck streak', () => {
  const result = rollDrops(new Rng(15), context, 0);
  assert.deepEqual(rarities(result), ['normal', 'normal', 'rare', 'magic', 'normal', 'legendary']);
  assert.equal(result.pity, 0, 'The guaranteed last item is a success, not another miss');
});

test('misses after a natural boss success remain counted', () => {
  const result = rollDrops(new Rng(1), context, 0);
  assert.deepEqual(rarities(result), ['legendary', 'set', 'set', 'normal', 'rare', 'normal']);
  assert.equal(result.pity, 3, 'Do not reset every boss batch unconditionally');
});

test('no equipment preserves history and the existing threshold applies to the next item', () => {
  const normal = { ...context, elite: 0 as const, inRift: false, pity: 45 };
  const empty = rollDrops(new Rng(1), normal, 0);
  assert.deepEqual(rarities(empty), []);
  assert.equal(empty.pity, 45);
  const lastMiss = rollDrops(new Rng(7), { ...normal, pity: 44 }, 0);
  assert.deepEqual(rarities(lastMiss), ['rare']);
  assert.equal(lastMiss.pity, 45);
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
      if (output.length > new Rng(seed).int(5, 7)) fallbacks++;
    }
  assert.ok(fallbacks > 0, 'Fixtures must reach the fallback branch');
});
