import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, zoneSeed, isBlockedTile } from '../src/mapgen';
import { CollisionWorld } from '../src/movement';
import { generateItem, rollDrops, affixLabel } from '../src/items';
import { Rng } from '../src/math';
import { createCharacter, equipItem, addToInventory } from '../src/character';
import { computeStats } from '../src/stats';
import { addXp, xpToNext, monsterHp, DIFFICULTIES } from '../src/progression';
import { fmtCompact } from '../src/format';

test('maps generate deterministically with valid entries', () => {
  for (const z of ['hearthmere', 'whispering_glade', 'ashen_hollow', 'rift']) {
    const t0 = performance.now();
    const a = generateMap(z, zoneSeed(z, 1), z === 'rift' ? 'ashen' : undefined);
    const b = generateMap(z, zoneSeed(z, 1), z === 'rift' ? 'ashen' : undefined);
    const ms = performance.now() - t0;
    assert.deepEqual(a.tiles, b.tiles);
    const w = new CollisionWorld(a);
    assert.ok(w.isFree(a.entry.x, a.entry.y, 16), `${z} entry free`);
    const floor = a.tiles.filter((t) => !isBlockedTile(t)).length;
    console.log(z, `${a.w}x${a.h}`, 'floor', floor, 'props', a.props.length, 'spawns', a.spawns.length, `${ms.toFixed(0)}ms (x2)`);
  }
});

test('items and stats', () => {
  const rng = new Rng(42);
  const save = createCharacter('Tester', 'warrior', 1);
  const s1 = computeStats(save);
  console.log('L1 warrior', { life: s1.life, dps: s1.sheetDps.toFixed(1), armor: s1.armor, wmin: s1.weaponMin, wmax: s1.weaponMax });
  addXp(save, 1e12);
  assert.equal(save.level, 70);
  for (const rarity of ['magic', 'rare', 'legendary', 'set'] as const) {
    const it = generateItem(rng, { ilvl: 70, classId: 'warrior', rarity });
    console.log(rarity, it.name, it.affixes.map(affixLabel).join(' | '), it.legendary?.power ?? '');
    const idx = addToInventory(save, it);
    assert.ok(idx >= 0);
  }
  for (let i = 0; i < 40; i++) {
    const it = generateItem(rng, { ilvl: 70, classId: 'warrior', rarity: 'rare' });
    addToInventory(save, it);
    equipItem(save, it.id);
  }
  const s = computeStats(save);
  console.log('L70 warrior w/ rares', { life: Math.round(s.life), dps: fmtCompact(s.sheetDps), main: Math.round(s.mainStat), armorDR: s.armorDR.toFixed(2), chc: s.chc.toFixed(1), chd: s.chd.toFixed(0) });
  console.log('trash hp L70 normal', fmtCompact(monsterHp(70)), 'T X', fmtCompact(monsterHp(70) * DIFFICULTIES[13].hp), 'xp 1->2', xpToNext(1), '69->70', fmtCompact(xpToNext(69)));
  const d = rollDrops(rng, { level: 70, difficulty: 4, elite: 4, classId: 'mage', magicFind: 0, pity: 0, inRift: true }, 0);
  assert.ok(d.drops.some((x) => x.type === 'item' && (x.item.rarity === 'legendary' || x.item.rarity === 'set')));
});
