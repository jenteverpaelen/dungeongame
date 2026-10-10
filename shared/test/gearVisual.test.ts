import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Packr } from 'msgpackr';
import { createCharacter, playerLook } from '../src/character';
import { CLASS_IDS } from '../src/data/classes';
import { seedCollection } from '../src/itemCollection';
import { generateItem } from '../src/items';
import { Rng } from '../src/math';
import {
  GEAR_GEM_ORDER, GEAR_LEGENDARY_ORDER, GEAR_SET_ORDER, GEAR_TIER_NAMES, gearLook, gearProfile, itemVisualTier, lookFx, packGearFx,
  temperOf, unpackGearFx,
} from '../src/gearVisual';
import { SHOWCASE_STAGES, showcaseEquipment } from '../src/gearShowcase';
import type { Item, Rarity, Slot } from '../src/types';

test('visual tier ladder follows rarity, item-level bands and Ancient / Primal', () => {
  const t = (rarity: Rarity, ilvl: number, ancient: 0 | 1 | 2 = 0) => itemVisualTier({ rarity, ilvl, ancient });
  assert.deepEqual([t('normal', 1), t('normal', 12), t('normal', 36)], [0, 1, 2]);
  assert.deepEqual([t('magic', 5), t('magic', 20), t('magic', 40)], [1, 2, 3]);
  assert.deepEqual([t('rare', 10), t('rare', 30), t('rare', 60)], [3, 4, 5]);
  assert.deepEqual([t('legendary', 40), t('set', 69), t('legendary', 70), t('set', 70, 1), t('legendary', 70, 2)], [6, 6, 7, 8, 9]);
  assert.equal(GEAR_TIER_NAMES.length, 10);
  // Never goes down when item level or rarity goes up.
  const rarities: Rarity[] = ['normal', 'magic', 'rare', 'legendary'];
  for (let i = 0; i < rarities.length; i++) for (let lv = 1; lv <= 70; lv++) {
    assert.ok(t(rarities[i], lv) >= t(rarities[i], Math.max(1, lv - 1)));
    if (i) assert.ok(t(rarities[i], lv) >= t(rarities[i - 1], lv));
  }
  assert.deepEqual([0, 3, 4, 6, 7, 9, 10].map(temperOf), [0, 0, 1, 1, 2, 2, 3]);
});

test('packed progression round-trips, fits 28 bits and is deterministic', () => {
  const rng = new Rng(7);
  for (let i = 0; i < 400; i++) {
    const rarity = (['normal', 'magic', 'rare', 'legendary', 'set'] as const)[i % 5];
    const it = generateItem(rng, { ilvl: 1 + (i * 7) % 70, classId: CLASS_IDS[i % 3], rarity, primalAllowed: true });
    it.upgrade = i % 11;
    if (it.sockets.length) it.sockets[0] = { gem: GEAR_GEM_ORDER[i % GEAR_GEM_ORDER.length], rank: 1 + (i % 6) };
    if (i % 4 === 0 && it.affixes.length) it.enchanted = 0;
    const n = packGearFx(it);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 2 ** 28, `fits: ${n}`);
    assert.equal(packGearFx(structuredClone(it)), n);
    const fx = unpackGearFx(n);
    assert.equal(fx.tier, itemVisualTier(it));
    assert.equal(fx.ancient, it.ancient);
    assert.equal(fx.upgrade, it.upgrade);
    assert.equal(fx.set, it.set);
    assert.equal(fx.legendary, it.legendary?.power);
    assert.equal(fx.gems, it.sockets.filter(Boolean).length);
    assert.equal(fx.gem, it.sockets[0]?.gem);
    assert.equal(fx.enchanted, it.enchanted !== undefined);
  }
});

test('packed id orders are append-only (other clients decode the same set / legendary / gem)', () => {
  assert.deepEqual(GEAR_SET_ORDER, ['endless_storm', 'siegebreaker', 'fallen_star', 'cinder_oath', 'fault_warden', 'farwatch', 'rainkeeper', 'glass_concord', 'lantern_garden']);
  assert.deepEqual(GEAR_LEGENDARY_ORDER.slice(0, 6), ['faultcleaver', 'rainspindle', 'lanternroot', 'ninefold_gale', 'bloodwake', 'eternal_gyre']);
  assert.equal(GEAR_LEGENDARY_ORDER.length, 22);
  assert.deepEqual(GEAR_GEM_ORDER, ['pearlglass', 'ruby', 'emerald', 'topaz', 'amethyst', 'diamond']);
  assert.ok(GEAR_SET_ORDER.length <= 15 && GEAR_LEGENDARY_ORDER.length <= 31 && GEAR_GEM_ORDER.length <= 7, 'packed field widths');
});

test('player looks carry progression without touching stored items or the collection', () => {
  const save = createCharacter('Gx', 'warrior', 3);
  const eq = showcaseEquipment('warrior', 'ancient', 2);
  save.equipment = eq;
  const before = JSON.stringify(save);
  const look = playerLook(save);
  assert.equal(JSON.stringify(save), before, 'playerLook is pure');
  for (const it of Object.values(save.equipment)) assert.equal((it as Item).look.fx, undefined, 'stored looks stay unchanged');
  assert.equal(lookFx(look.slots.mainhand)!.tier, 8);
  assert.ok(look.jw?.neck && look.jw.ring1 && look.jw.ring2, 'jewellery travels for the charms');
  // Wardrobe looks keep the worn item's progression.
  seedCollection(save, Object.values(save.equipment));
  assert.doesNotThrow(() => seedCollection(save, []));
  assert.equal(gearLook(eq.head!, { ...eq.head!.look, primary: 0x123456 }).fx, packGearFx(eq.head!));
});

test('gear rank climbs the showcase ladder for every class: newcomer 0 → Primal 9', () => {
  const rows: string[] = [];
  for (const cls of CLASS_IDS) {
    let prev = -1;
    const ranks: number[] = [];
    for (const stage of SHOWCASE_STAGES) {
      const save = createCharacter('Gr', cls, 5);
      save.equipment = showcaseEquipment(cls, stage, 3);
      const p = gearProfile(playerLook(save));
      ranks.push(p.rank);
      assert.ok(p.rank >= prev, `${cls} ${stage} rank ${p.rank} after ${prev}`);
      prev = p.rank;
    }
    rows.push(`${cls.padEnd(8)} ${SHOWCASE_STAGES.map((s, i) => `${s}:${ranks[i]}`).join(' ')}`);
    assert.equal(ranks[0], 0, 'starter');
    assert.ok(ranks[SHOWCASE_STAGES.indexOf('L20')] >= 2, 'L20 has left the starter rags behind');
    assert.ok(ranks[SHOWCASE_STAGES.indexOf('L40')] >= 4, 'L40 reads as an experienced hero');
    assert.equal(ranks[SHOWCASE_STAGES.indexOf('L70')], 6, 'L70 mixed Legendaries: Storied');
    assert.equal(ranks[SHOWCASE_STAGES.indexOf('set')], 7);
    assert.equal(ranks[SHOWCASE_STAGES.indexOf('ancient')], 8);
    assert.equal(ranks[SHOWCASE_STAGES.indexOf('primal')], 9);
  }
  console.log(rows.join('\n'));
  const endgame = createCharacter('Gs', 'mage', 1);
  endgame.equipment = showcaseEquipment('mage', 'set', 1);
  const p = gearProfile(playerLook(endgame));
  assert.equal(p.topSet, 'fallen_star');
  assert.equal(p.topSetCount, 6);
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
    assert.ok(now < 1100, `${stage} descriptor ${now} bytes`);
  }
  console.log(out.join('\n'));
  const loot = generateItem(new Rng(3), { ilvl: 70, classId: 'mage', rarity: 'legendary' });
  assert.ok(size({ lk: 'item', name: loot.name, rarity: loot.rarity, ancient: 0, look: gearLook(loot), kind: loot.kind }) < 160);
  void ({} as Slot);
});
