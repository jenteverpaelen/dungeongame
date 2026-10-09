// Deterministic observations of existing rules; not balance targets or active-play rates.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCharacter } from '../shared/src/character';
import { Rng } from '../shared/src/math';
import { generateItem } from '../shared/src/items';
import { computeStats } from '../shared/src/stats';
import { DIFFICULTIES, skillPointsForLevel } from '../shared/src/progression';
import { AFK_EFFICIENCY, AFK_MAX_HOURS } from '../shared/src/constants';
import { CUBE_FUNCTIONS, CUBE_XP, FORTUNE_PER_FAIL, UPGRADE_CHANCE, enchantCost, extractCost, fuseCost,
  gemRemoveCost, reforgeCost, salvageXp, salvageYield, socketCost, transmuteCost, upgradeCost } from '../shared/src/cube';
import type { CharacterSave, ClassId, Rarity } from '../shared/src/types';

assert.ok(process.env.DATA_DIR, 'Economy audit requires a fresh isolated DATA_DIR');
assert.equal((await fs.readdir(process.env.DATA_DIR)).length, 0, 'Use an empty fixture directory');
process.env.XP_MULT = '3';
process.env.BACKUP_DIR = '';
const { applyAfkGains, AFK_MIN_AWAY_MS } = await import('../server/src/afk');
const now = 2_000_000_000_000;
function fixture(cls: ClassId, level: number, difficulty: number, awayMs: number, zone = 'whispering_glade') {
  const save = createCharacter('EconomyFixture', cls, 73);
  save.level = level; save.skillPoints = skillPointsForLevel(level); save.difficulty = difficulty;
  save.equipment = {}; // Deliberately unequipped: isolates level/class from reward affixes.
  save.lastSeen = now - awayMs; save.lastZone = zone;
  return save;
}
function observe(save: CharacterSave) {
  const stats = computeStats(save);
  const report = applyAfkGains(save, now);
  assert.equal(save.inventory.filter(Boolean).length, 0);
  assert.deepEqual(save.gems, {});
  assert.equal(save.materials.soul, 0); assert.equal(save.materials.deathsBreath, 0);
  return { report, after: { level: save.level, xp: save.xp, paragon: save.paragon, skillPoints: save.skillPoints,
    gold: save.gold, materials: save.materials, kills: save.stats.kills }, beforeStats: {
    sheetDps: stats.sheetDps, xpPct: stats.xpPct, goldFind: stats.goldFind,
  } };
}

const afk = [];
for (const cls of ['warrior', 'ranger', 'mage'] as const) for (const level of [1, 10, 30, 70]) {
  for (const awayMs of [AFK_MIN_AWAY_MS, AFK_MIN_AWAY_MS + 1, 3_600_000, 43_200_000, 86_400_000]) {
    const difficulty = level < 60 ? 3 : DIFFICULTIES.length - 1;
    const normal = observe(fixture(cls, level, 0, awayMs));
    const harder = observe(fixture(cls, level, difficulty, awayMs));
    assert.deepEqual(harder, normal, 'Current offline result ignores selected difficulty');
    const repeat = observe(fixture(cls, level, 0, awayMs));
    assert.deepEqual(repeat, normal);
    if (awayMs <= AFK_MIN_AWAY_MS) assert.equal(normal.report, null);
    else assert.equal(normal.report!.kills, Math.floor(Math.min(awayMs, AFK_MAX_HOURS * 3_600_000) / 60_000 * 60 * AFK_EFFICIENCY));
    if (awayMs > 43_200_000) assert.deepEqual(normal, observe(fixture(cls, level, 0, 43_200_000)));
    afk.push({ cls, initialLevel: level, comparedDifficulties: [0, difficulty], awayMs, ...normal });
  }
}
const zoneExclusions = ['hearthmere', 'rift', 'missing'].map(zone => {
  const result = observe(fixture('mage', 30, 0, 3_600_000, zone));
  assert.equal(result.report, null); return { zone, result };
});
const equipped = fixture('mage', 30, 0, 3_600_000);
equipped.equipment.mainhand = generateItem(new Rng(73), { classId: 'mage', ilvl: 30, rarity: 'normal', base: 'wand' });
const noWeapon = observe(fixture('mage', 30, 0, 3_600_000)), withWeapon = observe(equipped);
assert.notEqual(noWeapon.beforeStats.sheetDps, withWeapon.beforeStats.sheetDps);
assert.deepEqual(noWeapon.report, withWeapon.report, 'A pure weapon-DPS change does not alter offline rewards');

const itemCosts = [];
for (const ilvl of [1, 20, 70]) for (const rarity of ['normal', 'magic', 'rare', 'legendary', 'set'] as Rarity[]) {
  // Helper-input fixture; not a claim that every generated kind can perform every recipe.
  const item = generateItem(new Rng(73), { classId: 'mage', ilvl, rarity: 'rare', base: 'wand' });
  item.rarity = rarity;
  itemCosts.push({ ilvl, rarity, fixture: 'non-ancient wand; no sockets; tier/enchant count zero',
    salvage: { mats: salvageYield(item), cubeXp: salvageXp(item) }, socket: socketCost(item),
    enchant: [0, 1, 5].map(count => ({ completedPicks: count, cost: enchantCost({ ...item, enchantCount: count }) })),
    upgrade: [0, 6, 9].map(tier => ({ tier, cost: upgradeCost({ ...item, upgrade: tier }) })) });
}
const upgradeModel = UPGRADE_CHANCE.map((chance, tier) => {
  let survive = 1, expectedAttempts = 0, failures = 0;
  for (;;) {
    expectedAttempts += survive;
    const success = Math.min(100, chance + failures * FORTUNE_PER_FAIL) / 100;
    if (success === 1) break;
    survive *= 1 - success; failures++;
  }
  const item = generateItem(new Rng(73), { classId: 'mage', ilvl: 70, rarity: 'rare', base: 'wand' });
  item.rarity = 'legendary'; item.upgrade = tier;
  const cost = upgradeCost(item);
  assert.ok(expectedAttempts >= 1 && expectedAttempts <= failures + 1);
  return { tierFrom: tier, chancePercent: chance, fortuneStart: 0, maxAttempts: failures + 1, expectedAttempts,
    costPerAttempt: cost, expectedGold: expectedAttempts * cost.gold };
});
const result = {
  schema: 1, node: process.version, xpMult: 3,
  scope: 'Computed synthetic fixtures from current functions. No actual saves, world runtime, elapsed farming time or balance target.',
  fixtures: 'Fixed clock and seed; AFK starts unequipped with no reward affixes; high-level setup is synthetic, not a played character.',
  afk, zoneExclusions, weaponComparison: { noWeapon, withWeapon }, itemCosts,
  fixedCosts: { transmute: transmuteCost(), extract: extractCost(), reforge: reforgeCost(),
    gems: [1, 2, 3, 4, 5].map(rank => ({ rank, fuse: fuseCost(rank), remove: gemRemoveCost(rank) })) },
  cubeFunctions: CUBE_FUNCTIONS.map(({ op, unlock }) => ({ op, unlock, listedXp: CUBE_XP[op], note: op === 'salvage' ? 'Actual handler uses rarity-dependent salvageXp instead' : '' })),
  upgradeModel,
  modelLimits: 'Expected attempts assume independent uniform success draws and exact current Fortune rules; no observed distribution or player spending behavior.',
};
const out = path.resolve('docs/phase/P01-research/checks/economy-audit.json');
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify(result, null, 2) + '\n');
assert.equal((await fs.readdir(process.env.DATA_DIR)).length, 0, 'Audit should not write character files');
console.log(JSON.stringify({ out, afkCases: afk.length, itemCostFixtures: itemCosts.length,
  levelOneHour: afk.find(r => r.cls === 'mage' && r.initialLevel === 1 && r.awayMs === 3_600_000),
  levelSeventyCap: afk.find(r => r.cls === 'mage' && r.initialLevel === 70 && r.awayMs === 43_200_000),
  weaponComparison: result.weaponComparison, upgradeModel: upgradeModel.map(r => ({ tier: r.tierFrom, expectedAttempts: r.expectedAttempts, expectedGold: r.expectedGold })) }, null, 2));
