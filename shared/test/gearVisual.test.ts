import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Packr } from 'msgpackr';
import { createCharacter, playerLook } from '../src/character';
import { CLASS_IDS } from '../src/data/classes';
import { BASES } from '../src/data/items';
import { seedCollection } from '../src/itemCollection';
import { baseTierIndex, generateItem } from '../src/items';
import { Rng } from '../src/math';
import {
  FX_CAPACITY, GEAR_GEM_ORDER, GEAR_LEGENDARY_ORDER, GEAR_SET_ORDER, GEN_START, MAX_GEN, RARITY_ORDER, gearLook, gearProfile,
  itemGeneration, litLook, lookFromEquipment, lookFx, lookStage, packGearFx, temperOf, unpackGearFx,
} from '../src/gearVisual';
import { SHOWCASE_STAGES, showcaseEquipment } from '../src/gearShowcase';
import type { Item, Rarity } from '../src/types';

test('generation follows the item-name bands plus the level-70 cap', () => {
  assert.deepEqual([...GEN_START], [1, 13, 25, 37, 49, 61, 70]);
  assert.equal(MAX_GEN, 6);
  assert.deepEqual([1, 12, 13, 24, 25, 36, 37, 48, 49, 60, 61, 69, 70].map(itemGeneration), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
  // the first six generations are exactly the base-name ladder (Worn … Starforged), so art and names agree
  for (let lv = 1; lv < 70; lv++) assert.equal(itemGeneration(lv), baseTierIndex(lv), `ilvl ${lv}`);
  assert.equal(itemGeneration(0), 0);
  assert.equal(itemGeneration(99), 6);
  for (let lv = 2; lv <= 70; lv++) assert.ok(itemGeneration(lv) >= itemGeneration(lv - 1), 'never goes down');
  assert.deepEqual([0, 3, 4, 6, 7, 9, 10].map(temperOf), [0, 0, 1, 1, 2, 2, 3]);
});

test('packed identity round-trips every field and stays a safe integer', () => {
  const rng = new Rng(7);
  let maxN = 0;
  for (let i = 0; i < 600; i++) {
    const rarity = RARITY_ORDER[i % 5];
    const it = generateItem(rng, { ilvl: 1 + (i * 7) % 70, classId: CLASS_IDS[i % 3], rarity, primalAllowed: true });
    it.upgrade = i % 11;
    it.ancient = (i % 3) as 0 | 1 | 2;
    if (it.sockets.length) it.sockets[0] = { gem: GEAR_GEM_ORDER[i % GEAR_GEM_ORDER.length], rank: 1 + (i % 6) };
    if (i % 4 === 0 && it.affixes.length) it.enchanted = 0;
    const n = packGearFx(it);
    maxN = Math.max(maxN, n);
    assert.ok(Number.isSafeInteger(n) && n >= 0, `safe: ${n}`);
    assert.equal(packGearFx(structuredClone(it)), n, 'deterministic');
    const fx = unpackGearFx(n);
    assert.equal(fx.gen, itemGeneration(it.ilvl));
    assert.equal(fx.rarity, it.rarity);
    assert.equal(fx.top, it.ancient);
    assert.equal(fx.upgrade, it.upgrade);
    assert.equal(fx.temper, temperOf(it.upgrade));
    assert.equal(fx.set, it.set);
    assert.equal(fx.legendary, it.legendary?.power);
    assert.equal(fx.gems, it.sockets.filter(Boolean).length);
    assert.equal(fx.gem, it.sockets[0]?.gem);
    assert.equal(fx.enchanted, it.enchanted !== undefined);
  }
  assert.ok(maxN < 2 ** 35, `largest packed value ${maxN}`);
});

test('plain items pack below 2^32 (5 msgpack bytes); ids have room for the planned content', () => {
  const it = generateItem(new Rng(4), { ilvl: 70, classId: 'warrior', rarity: 'rare' });
  it.upgrade = 10; it.ancient = 2;
  it.sockets = [{ gem: GEAR_GEM_ORDER[GEAR_GEM_ORDER.length - 1], rank: 6 }]; it.enchanted = 0;
  assert.ok(packGearFx(it) < 2 ** 32);
  // planned content (docs/rework/depth/ITEMS-SHARED.md): 15 Sets, ~120 legendaries, the 6 gems
  assert.ok(FX_CAPACITY.set - 1 >= Math.max(15, GEAR_SET_ORDER.length));
  assert.ok(FX_CAPACITY.legendary - 1 >= Math.max(160, GEAR_LEGENDARY_ORDER.length));
  assert.ok(FX_CAPACITY.gem - 1 >= GEAR_GEM_ORDER.length);
  assert.ok(FX_CAPACITY.gen > MAX_GEN && FX_CAPACITY.rarity >= RARITY_ORDER.length && FX_CAPACITY.top >= 3 && FX_CAPACITY.upgrade > 10);
});

test('packed id orders are append-only (other clients decode the same set / legendary / gem / rarity)', () => {
  assert.deepEqual(RARITY_ORDER, ['normal', 'magic', 'rare', 'legendary', 'set']);
  assert.deepEqual(GEAR_SET_ORDER.slice(0, 9), ['endless_storm', 'siegebreaker', 'fallen_star', 'cinder_oath', 'fault_warden', 'farwatch', 'rainkeeper', 'glass_concord', 'lantern_garden']);
  assert.deepEqual(GEAR_LEGENDARY_ORDER.slice(0, 6), ['faultcleaver', 'rainspindle', 'lanternroot', 'ninefold_gale', 'bloodwake', 'eternal_gyre']);
  assert.deepEqual(GEAR_GEM_ORDER, ['pearlglass', 'ruby', 'emerald', 'topaz', 'amethyst', 'diamond']);
});

test('the look comes from the item: same base, generation by item level, light by rarity, grade on top', () => {
  const mk = (ilvl: number, rarity: Rarity, ancient: 0 | 1 | 2 = 0) => {
    const it = generateItem(new Rng(ilvl * 13 + rarity.length), { ilvl, classId: 'warrior', rarity: rarity === 'legendary' ? 'rare' : rarity, base: 'sword', ancientAllowed: false });
    it.rarity = rarity; it.ancient = ancient;
    return it;
  };
  const early = lookFx(gearLook(mk(1, 'normal')))!, late = lookFx(gearLook(mk(70, 'rare')))!;
  assert.equal(gearLook(mk(1, 'normal')).shape, gearLook(mk(70, 'rare')).shape, 'the base sets the silhouette family');
  assert.equal(early.gen, 0); assert.equal(late.gen, 6);
  // light only where it belongs: none on early plain gear, from runesteel on magic+, always on legendary / graded
  assert.equal(litLook(early), false);
  assert.equal(litLook(lookFx(gearLook(mk(30, 'rare')))!), false);
  assert.equal(litLook(lookFx(gearLook(mk(50, 'magic')))!), true);
  assert.equal(litLook(lookFx(gearLook(mk(70, 'normal')))!), false, 'a plain level-70 piece has the late silhouette but dormant light');
  assert.equal(litLook(lookFx(gearLook(mk(20, 'legendary')))!), true);
  // the look stage is monotone in generation, rarity and grade (equip moments compare it)
  const st = (ilvl: number, r: Rarity, a: 0 | 1 | 2 = 0) => lookStage(lookFx(gearLook(mk(ilvl, r, a)))!);
  assert.ok(st(70, 'normal') > st(60, 'legendary'), 'a new generation outranks a rarer piece of the previous one');
  assert.ok(st(70, 'rare') > st(70, 'magic') && st(70, 'legendary') > st(70, 'rare'));
  assert.ok(st(70, 'legendary', 1) > st(70, 'legendary') && st(70, 'legendary', 2) > st(70, 'legendary', 1));
});

test('player looks carry identity without touching stored items or the collection', () => {
  const save = createCharacter('Gx', 'warrior', 3);
  const eq = showcaseEquipment('warrior', 'ancient', 2);
  save.equipment = eq;
  const before = JSON.stringify(save);
  const look = playerLook(save);
  assert.equal(JSON.stringify(save), before, 'playerLook is pure');
  for (const it of Object.values(save.equipment)) assert.equal((it as Item).look.fx, undefined, 'stored looks stay unchanged');
  const main = lookFx(look.slots.mainhand)!;
  assert.equal(main.gen, 6);
  assert.equal(main.top, 1, 'the showcase "ancient" stage wears grade-1 (Kindled) weapons');
  assert.ok(look.jw?.neck && look.jw.ring1 && look.jw.ring2, 'jewellery travels for the charms');
  // wardrobe looks keep the worn item's identity
  seedCollection(save, Object.values(save.equipment));
  assert.doesNotThrow(() => seedCollection(save, []));
  assert.equal(gearLook(eq.head!, { ...eq.head!.look, primary: 0x123456 }).fx, packGearFx(eq.head!));
  // inspect builds the same look from items
  assert.deepEqual(lookFromEquipment('warrior', eq).slots.mainhand, look.slots.mainhand);
});

test('the hero summary counts item families only (no rank): Sets, legendary jewellery, grades, enhancement', () => {
  const prof = (stage: typeof SHOWCASE_STAGES[number], cls: 'warrior' | 'ranger' | 'mage' = 'mage') => {
    const save = createCharacter('Gp', cls, 5);
    save.equipment = showcaseEquipment(cls, stage, 3);
    return gearProfile(playerLook(save));
  };
  const starter = prof('starter');
  assert.equal(starter.legendaries, 0); assert.equal(starter.topSetCount, 0); assert.equal(starter.tops, 0); assert.equal(starter.jewels, 0);
  assert.ok(!('rank' in starter), 'no abstract rank');
  const set = prof('set');
  assert.equal(set.topSet, 'fallen_star'); assert.equal(set.topSetCount, 6);
  assert.ok(set.legendaries >= 10, 'set + legendary pieces');
  assert.equal(set.jewels, 3, 'legendary amulet and two rings');
  assert.equal(set.topMax, 0);
  const primal = prof('primal', 'warrior');
  assert.equal(primal.topMax, 2); assert.ok(primal.tops >= 10);
  assert.ok(primal.maxed >= 6 && primal.temper === 3);
});

test('every weapon / off-hand base shape has a silhouette family in the client registry', () => {
  // keeps the client registry honest when content agents add bases (client/src/render/art/gearVisuals.ts SHAPE_FAMILY)
  const src = readFileSync(new URL('../../client/src/render/art/gearVisuals.ts', import.meta.url), 'utf8');
  for (const b of Object.values(BASES)) {
    if (!b.weapon && b.kind !== 'offhand') continue;
    assert.ok(new RegExp(`\\b${b.shape}: F\\(`).test(src), `${b.id} (${b.shape}) has a family in SHAPE_FAMILY`);
  }
});

test('descriptor bytes stay small (sent on enter / change, never per tick)', () => {
  const packr = new Packr({ useRecords: false });
  const size = (o: unknown) => packr.pack(o).length;
  const out: string[] = [];
  for (const stage of ['starter', 'L70', 'primal'] as const) {
    const save = createCharacter('Bytes', 'ranger', 9);
    save.equipment = showcaseEquipment('ranger', stage, 4);
    const look = playerLook(save);
    const legacy = { ...look, jw: undefined, slots: Object.fromEntries(Object.entries(look.slots).map(([k, l]) => [k, { ...l!, fx: undefined }])) };
    const desc = (l: unknown) => ({ id: 123, k: 'player', t: 'ranger', n: 'Bytes', lv: 70, r: 16, look: l, pl: 812 });
    const now = size(desc(look)), before = size(desc(JSON.parse(JSON.stringify(legacy))));
    out.push(`${stage}: ${before} → ${now} bytes (+${now - before})`);
    assert.ok(now < 1150, `${stage} descriptor ${now} bytes`);
  }
  console.log(out.join('\n'));
  const loot = generateItem(new Rng(3), { ilvl: 70, classId: 'mage', rarity: 'legendary' });
  assert.ok(size({ lk: 'item', name: loot.name, rarity: loot.rarity, ancient: 0, look: gearLook(loot), kind: loot.kind }) < 170);
});
