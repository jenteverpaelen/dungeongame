// Every `cmd` op from ARCHITECTURE §1.9, with full validation. Handlers mutate the session's live save through the
// shared helpers (equipItem, setSkillSlot, cube costs, generateItem...), then call session.changed() which
// recomputes derived stats, tells the simulation (refreshPlayer) when combat config changed, and marks the save dirty.

import type { Session } from './net/session';
import { SERVICE_ROLE } from '../../shared/src/townServices';
import { transferStash } from '../../shared/src/stash';
import { requireNear } from './townServices';
import { fail, ok, type CmdResult, type World } from './world';
import { INVENTORY_SIZE, MAX_LEVEL } from '../../shared/src/constants';
import { CLASSES } from '../../shared/src/data/classes';
import { BASES, GEMS, GEM_RANKS, LEGENDARIES, SETS, affixScale, type AffixDef } from '../../shared/src/data/items';
import { skillsForClass } from '../../shared/src/data/skills';
import { Rng } from '../../shared/src/math';
import {
  addToInventory, buySkillTier, equipItem, findEquipped, findInventory, resetSkillTiers, setSkillRune, setSkillSlot, unequipItem,
} from '../../shared/src/character';
import {
  CUBE_FUNCTIONS, CUBE_XP, FORTUNE_PER_FAIL, addCubeXp, canAfford, canEnchantAffix, cubeSlotOf, cubeUnlocked, enchantCost, enchantPool,
  extractCost, fuseCost, gemRemoveCost, maxSockets, pay, reforgeCost, salvageXp, salvageYield, socketCost, transmuteCost, upgradeChance,
  upgradeCost, type Cost, type CubeOp,
} from '../../shared/src/cube';
import { ANCIENT_MULT, generateItem } from '../../shared/src/items';
import {
  DIFFICULTIES, PARAGON_CATEGORIES, PARAGON_STATS, addXp, paragonPoints, paragonSpent, xpToNext,
} from '../../shared/src/progression';
import type { CmdOp } from '../../shared/src/protocol';
import {
  SLOTS, type AffixRoll, type CharacterSave, type ClassId, type Item, type MaterialId, type Materials, type Rarity, type Slot,
} from '../../shared/src/types';

type Args = Record<string, unknown>;
type Handler = (s: Session, a: Args, world: World) => CmdResult;

// ─────────────────────────── Argument parsing ───────────────────────────

class ArgError extends Error {}

const str = (a: Args, k: string): string => {
  const v = a[k];
  if (typeof v !== 'string' || v.length === 0 || v.length > 64) throw new ArgError(`Missing or invalid "${k}"`);
  return v;
};
const optStr = (a: Args, k: string): string | null => {
  const v = a[k];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' || v.length > 64) throw new ArgError(`Invalid "${k}"`);
  return v;
};
const int = (a: Args, k: string, lo: number, hi: number, fallback?: number): number => {
  const v = a[k];
  if (v === undefined || v === null) {
    if (fallback !== undefined) return fallback;
    throw new ArgError(`Missing "${k}"`);
  }
  if (typeof v !== 'number' || !Number.isInteger(v) || v < lo || v > hi) throw new ArgError(`Invalid "${k}"`);
  return v;
};
const slotArg = (a: Args, k: string): Slot => {
  const v = str(a, k);
  if (!SLOTS.includes(v as Slot)) throw new ArgError(`Invalid "${k}"`);
  return v as Slot;
};

const RARITIES: Rarity[] = ['normal', 'magic', 'rare', 'legendary', 'set'];
const MAT_NAME: Record<MaterialId, string> = { scrap: 'Scrap', dust: 'Arcane Dust', crystal: 'Veiled Crystals', soul: 'Forgotten Souls', deathsBreath: "Death's Breath" };
const MAT_IDS = Object.keys(MAT_NAME) as MaterialId[];
const CUBE_SLOT_NAMES = ['weapon', 'armor', 'jewelry'] as const;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const newRng = () => new Rng((Math.random() * 0xffffffff) >>> 0);

// ─────────────────────────── Shared helpers ───────────────────────────

interface Loc { item: Item; slot: Slot | null; index: number }

/** Find an item by id in the inventory (slot null) or among the equipment. */
function locate(save: CharacterSave, itemId: string): Loc | null {
  const index = findInventory(save, itemId);
  if (index >= 0) return { item: save.inventory[index]!, slot: null, index };
  const slot = findEquipped(save, itemId);
  return slot ? { item: save.equipment[slot]!, slot, index: -1 } : null;
}

/** Inventory-only lookup. */
function inInventory(save: CharacterSave, itemId: string): Loc | null {
  const loc = locate(save, itemId);
  return loc && loc.slot === null ? loc : null;
}

function requireCube(save: CharacterSave, op: CubeOp): string | null {
  if (cubeUnlocked(save, op)) return null;
  const f = CUBE_FUNCTIONS.find((c) => c.op === op)!;
  return `${f.name} unlocks at Cube level ${f.unlock}`;
}

/** Why the player cannot pay, or null. */
function lacking(save: CharacterSave, cost: Cost): string | null {
  if (canAfford(save, cost)) return null;
  if (save.gold < cost.gold) return `Not enough gold (need ${fmt(cost.gold)})`;
  for (const [k, v] of Object.entries(cost.mats)) {
    if ((save.materials[k as MaterialId] ?? 0) < (v ?? 0)) return `Not enough ${MAT_NAME[k as MaterialId] ?? k} (need ${v})`;
  }
  return 'You cannot afford that';
}

const gemKey = (gem: string, rank: number) => `${gem}:${rank}`;

function addGem(save: CharacterSave, gem: string, rank: number, n = 1): void {
  const k = gemKey(gem, rank);
  save.gems[k] = (save.gems[k] ?? 0) + n;
}

function takeGem(save: CharacterSave, gem: string, rank: number, n = 1): boolean {
  const k = gemKey(gem, rank);
  const have = save.gems[k] ?? 0;
  if (have < n) return false;
  if (have === n) delete save.gems[k];
  else save.gems[k] = have - n;
  return true;
}

/** Give back every gem socketed in an item that is leaving the player's hands. */
function returnGems(save: CharacterSave, item: Item): void {
  for (const g of item.sockets) if (g) addGem(save, g.gem, g.rank);
}

/** Apply a command's effect: refresh derived stats, notify the simulation if combat config changed, persist. */
function done(s: Session, refreshSim: boolean, data?: unknown): CmdResult {
  s.changed(refreshSim);
  return ok(data);
}

function addMats(save: CharacterSave, mats: Partial<Materials>): void {
  for (const [k, v] of Object.entries(mats)) save.materials[k as MaterialId] += v ?? 0;
}

function sumMats(into: Partial<Materials>, mats: Partial<Materials>): void {
  for (const [k, v] of Object.entries(mats)) into[k as MaterialId] = (into[k as MaterialId] ?? 0) + (v ?? 0);
}

// ─────────────────────────── Inventory & equipment ───────────────────────────

const equip: Handler = (s, a) => {
  const slot = optStr(a, 'slot');
  if (slot !== null && !SLOTS.includes(slot as Slot)) return fail('Invalid slot');
  const err = equipItem(s.save, str(a, 'itemId'), (slot as Slot | null) ?? undefined);
  if (err) return fail(err);
  return done(s, true);
};

const unequip: Handler = (s, a) => {
  const err = unequipItem(s.save, slotArg(a, 'slot'));
  if (err) return fail(err);
  return done(s, true);
};

const swapInv: Handler = (s, a) => {
  const from = int(a, 'from', 0, INVENTORY_SIZE - 1);
  const to = int(a, 'to', 0, INVENTORY_SIZE - 1);
  const inv = s.save.inventory;
  if (!inv[from]) return fail('Nothing in that slot');
  if (from === to) return ok();
  [inv[from], inv[to]] = [inv[to], inv[from]];
  return done(s, false);
};

const destroy: Handler = (s, a) => {
  const loc = inInventory(s.save, str(a, 'itemId'));
  if (!loc) return fail('Item not in inventory');
  returnGems(s.save, loc.item);
  s.save.inventory[loc.index] = null;
  return done(s, false);
};

const stashDeposit: Handler = (s, a) => {
  const err = transferStash(s.save, str(a, 'itemId'), true);
  return err ? fail(err) : done(s, false);
};
const stashWithdraw: Handler = (s, a) => {
  const err = transferStash(s.save, str(a, 'itemId'), false);
  return err ? fail(err) : done(s, false);
};

// ─────────────────────────── Cube: salvage ───────────────────────────

const salvage: Handler = (s, a) => {
  const save = s.save;
  const cubeErr = requireCube(save, 'salvage');
  if (cubeErr) return fail(cubeErr);
  const loc = inInventory(save, str(a, 'itemId'));
  if (!loc) return fail('Item not in inventory');
  const mats = salvageYield(loc.item);
  const xp = salvageXp(loc.item);
  returnGems(save, loc.item);
  save.inventory[loc.index] = null;
  addMats(save, mats);
  const levels = addCubeXp(save, xp);
  return done(s, false, { mats, xp, cubeLevels: levels });
};

const salvageAll: Handler = (s, a) => {
  const save = s.save;
  const cubeErr = requireCube(save, 'salvage');
  if (cubeErr) return fail(cubeErr);
  const list = a.rarities;
  if (!Array.isArray(list) || list.length === 0 || list.length > RARITIES.length) return fail('Choose which rarities to salvage');
  const wanted = new Set<Rarity>();
  for (const r of list) {
    if (typeof r !== 'string' || !RARITIES.includes(r as Rarity)) return fail('Unknown rarity');
    wanted.add(r as Rarity);
  }
  const mats: Partial<Materials> = {};
  let count = 0, xp = 0;
  for (let i = 0; i < save.inventory.length; i++) {
    const item = save.inventory[i];
    if (!item || !wanted.has(item.rarity)) continue;
    sumMats(mats, salvageYield(item));
    xp += salvageXp(item);
    returnGems(save, item);
    save.inventory[i] = null;
    count++;
  }
  if (!count) return fail('Nothing to salvage');
  addMats(save, mats);
  const levels = addCubeXp(save, xp);
  return done(s, false, { count, mats, xp, cubeLevels: levels });
};

// ─────────────────────────── Cube: enchant (Mystic) ───────────────────────────

/** Roll one affix of `def` for an item, at the item's level and ancient scaling (mirrors shared items.ts). */
function rollEnchantAffix(rng: Rng, def: AffixDef, item: Item, classId: ClassId): AffixRoll {
  const range = def.ranges[item.kind]!;
  const sc = affixScale(def.scale, item.ilvl);
  const am = item.ancient ? ANCIENT_MULT : 1;
  let min = range[0] * sc * am, max = range[1] * sc * am;
  if (def.scale !== 'pct') {
    min = Math.max(1, Math.round(min));
    max = Math.max(min, Math.round(max));
  } else {
    min = Math.round(min * 10) / 10;
    max = Math.round(max * 10) / 10;
  }
  const v = item.ancient === 2 ? max : min + (max - min) * rng.next();
  const roll: AffixRoll = { stat: def.stat, value: def.scale === 'pct' ? Math.round(v * 10) / 10 : Math.round(v), min, max, primary: def.primary };
  if (def.stat === 'skillDmg') roll.param = rng.pick(skillsForClass(classId).filter((k) => k.kind !== 'primary')).id;
  return roll;
}

const enchantRoll: Handler = (s, a) => {
  const save = s.save;
  const cubeErr = requireCube(save, 'enchant');
  if (cubeErr) return fail(cubeErr);
  const loc = locate(save, str(a, 'itemId'));
  if (!loc) return fail('Item not found');
  const item = loc.item;
  const affix = int(a, 'affix', 0, 15);
  if (!canEnchantAffix(item, affix)) {
    return fail(item.enchanted !== undefined && item.enchanted !== affix ? 'Only one property of an item can ever be enchanted' : 'That property cannot be enchanted');
  }
  const mainStat = CLASSES[save.classId].mainStat;
  const target = item.affixes[affix];
  let pool = enchantPool(item, affix).filter((d) => d.group !== 'main' || d.stat === mainStat);
  const different = pool.filter((d) => d.stat !== target.stat);
  if (different.length >= 2) pool = different;
  if (pool.length < 2) return fail('There are no other properties this item can roll');
  const cost = enchantCost(item);
  const why = lacking(save, cost);
  if (why) return fail(why);

  const rng = newRng();
  const options: AffixRoll[] = [];
  const bag = pool.map((d) => [d, d.weight > 0 ? d.weight : 10] as const);
  for (let i = 0; i < 2; i++) {
    const def = rng.weighted(bag.filter(([d]) => !options.some((o) => o.stat === d.stat)));
    options.push(rollEnchantAffix(rng, def, item, save.classId));
  }
  pay(save, cost);
  const cubeLevels = addCubeXp(save, CUBE_XP.enchant);
  s.pendingEnchant = { itemId: item.id, affix, options };
  return done(s, false, { options, affix, original: target, cubeLevels });
};

const enchantPick: Handler = (s, a) => {
  const save = s.save;
  const cubeErr = requireCube(save, 'enchant');
  if (cubeErr) return fail(cubeErr);
  const itemId = str(a, 'itemId');
  const choice = int(a, 'choice', 0, 2);
  const pending = s.pendingEnchant;
  if (!pending || pending.itemId !== itemId) return fail('Roll the enchantment first');
  const loc = locate(save, itemId);
  if (!loc || !canEnchantAffix(loc.item, pending.affix)) { s.pendingEnchant = null; return fail('That item has changed'); }
  const item = loc.item;
  if (choice > 0) item.affixes[pending.affix] = { ...pending.options[choice - 1] };
  item.enchanted = pending.affix;
  item.enchantCount++;
  item.bound = true;
  s.pendingEnchant = null;
  return done(s, loc.slot !== null, { choice, affix: item.affixes[pending.affix] });
};

// ─────────────────────────── Cube: upgrade (Empower) ───────────────────────────

const upgrade: Handler = (s, a) => {
  const save = s.save;
  const cubeErr = requireCube(save, 'upgrade');
  if (cubeErr) return fail(cubeErr);
  const loc = locate(save, str(a, 'itemId'));
  if (!loc) return fail('Item not found');
  const item = loc.item;
  if (item.upgrade >= 10) return fail('This item is already at its maximum tier');
  const cost = upgradeCost(item);
  const why = lacking(save, cost);
  if (why) return fail(why);
  const chance = upgradeChance(item);
  pay(save, cost);
  const success = newRng().next() * 100 < chance;
  if (success) {
    item.upgrade++;
    item.upgradeFortune = 0;
  } else {
    item.upgradeFortune += FORTUNE_PER_FAIL;
  }
  item.bound = true;
  const cubeLevels = addCubeXp(save, CUBE_XP.upgrade);
  return done(s, loc.slot !== null, { success, chance, tier: item.upgrade, fortune: item.upgradeFortune, cubeLevels });
};

// ─────────────────────────── Cube: Kanai (transmute / extract / reforge) ───────────────────────────

const transmute: Handler = (s, a) => {
  const save = s.save;
  const cubeErr = requireCube(save, 'transmute');
  if (cubeErr) return fail(cubeErr);
  const loc = inInventory(save, str(a, 'itemId'));
  if (!loc) return fail('Item not in inventory');
  const item = loc.item;
  if (item.rarity !== 'rare') return fail('Only Rare items can be transmuted');
  const cost = transmuteCost();
  const why = lacking(save, cost);
  if (why) return fail(why);

  const rng = newRng();
  const legends = Object.values(LEGENDARIES).filter((l) => BASES[l.base].kind === item.kind && (!l.classes || l.classes.includes(save.classId)));
  let fresh: Item;
  if (legends.length) {
    fresh = generateItem(rng, { ilvl: item.ilvl, classId: save.classId, rarity: 'legendary', legendary: rng.pick(legends).id, smartChance: 1 });
  } else {
    // No legendary exists for this kind (head, legs): fall back to the matching piece of the class set.
    const set = Object.values(SETS).find((x) => x.classId === save.classId);
    const piece = set?.pieces.find((p) => BASES[p.base].kind === item.kind);
    if (!set || !piece) return fail('No Legendary exists for this type of item');
    fresh = generateItem(rng, { ilvl: item.ilvl, classId: save.classId, rarity: 'set', set: set.id, base: piece.base, smartChance: 1 });
  }
  pay(save, cost);
  returnGems(save, item);
  save.inventory[loc.index] = fresh;
  const cubeLevels = addCubeXp(save, CUBE_XP.transmute);
  return done(s, false, { item: fresh, cubeLevels });
};

const extract: Handler = (s, a) => {
  const save = s.save;
  const cubeErr = requireCube(save, 'extract');
  if (cubeErr) return fail(cubeErr);
  const loc = inInventory(save, str(a, 'itemId'));
  if (!loc) return fail('Item not in inventory');
  const item = loc.item;
  if (item.rarity !== 'legendary' || !item.legendary) return fail('Only Legendary items hold a power to extract');
  const power = item.legendary.power;
  if (save.cube.learned.includes(power)) return fail('You already know this power');
  const cost = extractCost();
  const why = lacking(save, cost);
  if (why) return fail(why);
  pay(save, cost);
  returnGems(save, item);
  save.inventory[loc.index] = null;
  save.cube.learned.push(power);
  const cubeLevels = addCubeXp(save, CUBE_XP.extract);
  return done(s, false, { power, cubeLevels });
};

const cubeEquip: Handler = (s, a) => {
  const save = s.save;
  const slot = int(a, 'slot', 0, 2);
  const power = optStr(a, 'power');
  if (power === null) {
    save.cube.equipped[slot] = null;
    return done(s, true);
  }
  if (!Object.hasOwn(LEGENDARIES, power)) return fail('Unknown power');
  if (!save.cube.learned.includes(power)) return fail('You have not learned that power');
  if (cubeSlotOf(power) !== CUBE_SLOT_NAMES[slot]) return fail(`That power belongs in a ${cubeSlotOf(power)} slot`);
  save.cube.equipped[slot] = power;
  return done(s, true);
};

const reforge: Handler = (s, a) => {
  const save = s.save;
  const cubeErr = requireCube(save, 'reforge');
  if (cubeErr) return fail(cubeErr);
  const loc = locate(save, str(a, 'itemId'));
  if (!loc) return fail('Item not found');
  const item = loc.item;
  if (item.rarity !== 'legendary' && item.rarity !== 'set') return fail('Only Legendary and Set items can be reforged');
  if (s.pendingEnchant?.itemId === item.id) return fail('Choose your pending enchantment at the Mystic before reforging this item.');
  const cost = reforgeCost();
  const why = lacking(save, cost);
  if (why) return fail(why);

  const fresh = generateItem(newRng(), {
    ilvl: item.ilvl, classId: save.classId, rarity: item.rarity,
    legendary: item.legendary?.power, set: item.set, base: item.base, smartChance: 1,
  });
  fresh.id = item.id;
  fresh.bound = item.bound;
  // Keep socketed gems: into the new sockets first, the rest back to the gem stash.
  const gems = item.sockets.filter((g): g is NonNullable<typeof g> => !!g);
  let gi = 0;
  for (let i = 0; i < fresh.sockets.length && gi < gems.length; i++) fresh.sockets[i] = gems[gi++];
  for (; gi < gems.length; gi++) addGem(save, gems[gi].gem, gems[gi].rank);

  pay(save, cost);
  if (loc.slot) save.equipment[loc.slot] = fresh;
  else save.inventory[loc.index] = fresh;
  const cubeLevels = addCubeXp(save, CUBE_XP.reforge);
  return done(s, loc.slot !== null, { item: fresh, cubeLevels });
};

// ─────────────────────────── Cube: sockets & gems ───────────────────────────

const socket: Handler = (s, a) => {
  const save = s.save;
  const cubeErr = requireCube(save, 'socket');
  if (cubeErr) return fail(cubeErr);
  const loc = locate(save, str(a, 'itemId'));
  if (!loc) return fail('Item not found');
  const item = loc.item;
  const max = maxSockets(item);
  if (max <= 0) return fail('This item cannot be socketed');
  if (item.sockets.length >= max) return fail('This item already has the maximum number of sockets');
  const cost = socketCost(item);
  const why = lacking(save, cost);
  if (why) return fail(why);
  pay(save, cost);
  item.sockets.push(null);
  const cubeLevels = addCubeXp(save, CUBE_XP.socket);
  return done(s, loc.slot !== null, { sockets: item.sockets.length, cubeLevels });
};

const gemArgs = (a: Args): { gem: string; rank: number } => {
  const gem = str(a, 'gem');
  if (!Object.hasOwn(GEMS, gem)) throw new ArgError('Unknown gem');
  return { gem, rank: int(a, 'rank', 1, GEM_RANKS.length) };
};

const insertGem: Handler = (s, a) => {
  const save = s.save;
  const { gem, rank } = gemArgs(a);
  const loc = locate(save, str(a, 'itemId'));
  if (!loc) return fail('Item not found');
  const idx = loc.item.sockets.findIndex((g) => g === null);
  if (idx < 0) return fail(loc.item.sockets.length ? 'No empty socket' : 'This item has no sockets');
  if (!takeGem(save, gem, rank)) return fail('You do not have that gem');
  loc.item.sockets[idx] = { gem, rank };
  return done(s, loc.slot !== null, { socket: idx });
};

const removeGem: Handler = (s, a) => {
  const save = s.save;
  const loc = locate(save, str(a, 'itemId'));
  if (!loc) return fail('Item not found');
  const idx = int(a, 'idx', 0, 15);
  const g = loc.item.sockets[idx];
  if (!g) return fail('That socket is empty');
  const price = gemRemoveCost(g.rank);
  if (save.gold < price) return fail(`Not enough gold (need ${fmt(price)})`);
  save.gold -= price;
  loc.item.sockets[idx] = null;
  addGem(save, g.gem, g.rank);
  return done(s, loc.slot !== null, { gem: g.gem, rank: g.rank });
};

const fuseGem: Handler = (s, a) => {
  const save = s.save;
  const cubeErr = requireCube(save, 'fuse');
  if (cubeErr) return fail(cubeErr);
  const { gem, rank } = gemArgs(a);
  if (rank >= GEM_RANKS.length) return fail('That gem is already at the highest rank');
  if ((save.gems[gemKey(gem, rank)] ?? 0) < 3) return fail('You need three gems of the same type and rank');
  const cost = fuseCost(rank);
  const why = lacking(save, cost);
  if (why) return fail(why);
  pay(save, cost);
  takeGem(save, gem, rank, 3);
  addGem(save, gem, rank + 1);
  const cubeLevels = addCubeXp(save, CUBE_XP.fuse);
  return done(s, false, { gem, rank: rank + 1, cubeLevels });
};

// ─────────────────────────── Skills ───────────────────────────

const skillSlot: Handler = (s, a) => {
  const err = setSkillSlot(s.save, int(a, 'slot', 0, 3), optStr(a, 'skill'));
  if (err) return fail(err);
  return done(s, true);
};

const skillRune: Handler = (s, a) => {
  const err = setSkillRune(s.save, str(a, 'skill'), optStr(a, 'rune'));
  if (err) return fail(err);
  return done(s, true);
};

const skillTier: Handler = (s, a) => {
  const err = buySkillTier(s.save, str(a, 'skill'));
  if (err) return fail(err);
  return done(s, true);
};

const skillReset: Handler = (s) => {
  if (!Object.keys(s.save.skills.tiers).length) return fail('No upgrade tiers to reset');
  resetSkillTiers(s.save);
  return done(s, true);
};

// ─────────────────────────── Paragon ───────────────────────────

const paragon: Handler = (s, a) => {
  const save = s.save;
  const id = str(a, 'stat');
  const def = PARAGON_STATS.find((d) => d.id === id);
  if (!def) return fail('Unknown paragon stat');
  const n = int(a, 'n', -1_000_000, 1_000_000);
  if (n === 0) return fail('Invalid amount');
  const cur = save.paragon.spent[id] ?? 0;
  if (n > 0) {
    const catLabel = PARAGON_CATEGORIES.find((c) => c.id === def.category)!.label;
    const budget = paragonPoints(save.paragon.level)[def.category] - paragonSpent(save, def.category);
    if (budget <= 0) return fail(`No ${catLabel} paragon points available`);
    const room = def.cap > 0 ? def.cap - cur : Infinity;
    if (room <= 0) return fail(`${def.label} is at its cap`);
    save.paragon.spent[id] = cur + Math.min(n, budget, room);
  } else {
    if (cur <= 0) return fail('No points to remove');
    const left = cur - Math.min(-n, cur);
    if (left > 0) save.paragon.spent[id] = left;
    else delete save.paragon.spent[id];
  }
  return done(s, true, { stat: id, points: save.paragon.spent[id] ?? 0 });
};

const paragonReset: Handler = (s) => {
  if (!Object.keys(s.save.paragon.spent).length) return fail('No points to reset');
  s.save.paragon.spent = {};
  return done(s, true);
};

// ─────────────────────────── Travel & rifts ───────────────────────────

const travel: Handler = (s, a, world) => {
  const channel = a.channel === undefined || a.channel === null ? undefined : int(a, 'channel', 1, 999);
  return world.travel(s, str(a, 'zone'), channel);
};
const channel: Handler = (s, a, world) => world.channel(s, int(a, 'n', 1, 999));
const riftOpen: Handler = (s, a, world) => world.riftOpen(s, int(a, 'difficulty', 0, DIFFICULTIES.length - 1, s.save.difficulty));
const riftEnter: Handler = (s, _a, world) => world.riftEnter(s);
const leave: Handler = (s, _a, world) => world.leave(s);

// ─────────────────────────── Debug (prototype tools) ───────────────────────────

const SIM_DEBUG_OPS = new Set(['goblin', 'elite', 'heal', 'boss', 'infres']);

/** Add items to free inventory slots; returns how many fit. */
function giveItems(save: CharacterSave, items: Item[]): number {
  let added = 0;
  for (const it of items) {
    if (addToInventory(save, it) < 0) break;
    added++;
  }
  return added;
}

function classLegendaries(save: CharacterSave, rng: Rng, onlyClassSpecific: boolean): Item[] {
  return Object.values(LEGENDARIES)
    .filter((l) => (onlyClassSpecific ? !!l.classes?.includes(save.classId) : !l.classes || l.classes.includes(save.classId)))
    .map((l) => generateItem(rng, { ilvl: 70, classId: save.classId, rarity: 'legendary', legendary: l.id, smartChance: 1 }));
}

function classSet(save: CharacterSave, rng: Rng): Item[] {
  const set = Object.values(SETS).find((x) => x.classId === save.classId);
  if (!set) return [];
  return set.pieces.map((p) => generateItem(rng, { ilvl: 70, classId: save.classId, rarity: 'set', set: set.id, base: p.base, smartChance: 1 }));
}

const debug: Handler = (s, a) => {
  if (process.env.ENABLE_DEBUG !== '1' || process.env.DISABLE_DEBUG === '1') return fail('Debug commands are disabled on this server');
  const save = s.save;
  const op = str(a, 'op');

  if (SIM_DEBUG_OPS.has(op)) {
    if (!s.rec) return fail('Not in a zone');
    const err = s.rec.inst.debug(s, op);
    return err ? fail(err) : ok();
  }

  switch (op) {
    case 'level': {
      const n = int(a, 'n', 1, MAX_LEVEL, 10);
      if (save.level >= MAX_LEVEL) return fail('Already at the maximum level');
      let gained = 0;
      while (gained < n && save.level < MAX_LEVEL) {
        addXp(save, xpToNext(save.level) - save.xp);
        gained++;
      }
      return done(s, true, { level: save.level, gained });
    }
    case 'paragon': {
      const n = int(a, 'n', 1, 10_000, 10);
      save.paragon.level += n;
      return done(s, true, { paragon: save.paragon.level });
    }
    case 'gold': {
      const n = int(a, 'n', 1, 1_000_000_000_000, 10_000_000);
      save.gold += n;
      return done(s, false, { gold: save.gold });
    }
    case 'mats': {
      const n = int(a, 'n', 1, 1_000_000_000, 100);
      for (const k of MAT_IDS) save.materials[k] += n;
      // Gems too, so the gem recipes can be tried without waiting for drops.
      for (const g of Object.keys(GEMS)) { addGem(save, g, 1, 9); addGem(save, g, 2, 3); }
      return done(s, false);
    }
    case 'gems': {
      const rank = int(a, 'rank', 1, GEM_RANKS.length, 1);
      const n = int(a, 'n', 1, 999, 9);
      for (const g of Object.keys(GEMS)) addGem(save, g, rank, n);
      return done(s, false);
    }
    case 'legendaries': {
      const items = classLegendaries(save, newRng(), false);
      const added = giveItems(save, items);
      if (!added) return fail('Your inventory is full');
      return done(s, false, { added, skipped: items.length - added });
    }
    case 'rares': {
      // Rare items at ilvl 70 (fuel for the Cube's transmute / enchant recipes).
      const rng = newRng();
      const n = int(a, 'n', 1, 60, 8);
      const items = Array.from({ length: n }, () => generateItem(rng, { ilvl: 70, classId: save.classId, rarity: 'rare', smartChance: 1 }));
      const added = giveItems(save, items);
      if (!added) return fail('Your inventory is full');
      return done(s, false, { added, skipped: items.length - added });
    }
    case 'set': {
      const rng = newRng();
      const items = [...classSet(save, rng), ...classLegendaries(save, rng, true)];
      const added = giveItems(save, items);
      if (!added) return fail('Your inventory is full');
      return done(s, false, { added, skipped: items.length - added });
    }
    default:
      return fail('Unknown debug op');
  }
};

// ─────────────────────────── Dispatch ───────────────────────────

const HANDLERS: Record<CmdOp, Handler> = {
  equip, unequip, swapInv, destroy, stashDeposit, stashWithdraw,
  salvage, salvageAll, enchantRoll, enchantPick, upgrade, transmute, extract, cubeEquip, reforge, socket,
  insertGem, removeGem, fuseGem,
  skillSlot, skillRune, skillTier, skillReset,
  paragon, paragonReset,
  travel, riftOpen, riftEnter, leave, channel,
  debug,
};

/** Validate and execute one client command. Never throws for bad input; programming errors propagate to the caller. */
export function runCommand(s: Session, world: World, op: CmdOp, a: Args): CmdResult {
  if (!Object.hasOwn(HANDLERS, op)) return fail('Unknown command');
  try {
    const role = SERVICE_ROLE[op];
    if (role) { const err = requireNear(s, role); if (err) return fail(err); }
    return HANDLERS[op](s, a, world);
  } catch (err) {
    if (err instanceof ArgError) return fail(err.message);
    throw err;
  }
}
