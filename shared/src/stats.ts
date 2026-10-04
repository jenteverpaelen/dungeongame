// Character sheet computation (Diablo 3 formulas, simplified where noted).

import { CLASSES } from './data/classes';
import { BASES, GEMS, LEGENDARIES, SETS } from './data/items';
import { upgradeMult } from './items';
import { PARAGON_STATS } from './progression';
import type { CharacterSave, DerivedStats, Element, Item, Slot, StatId } from './types';
import { ELEMENTS } from './types';

/** Life per point of Vitality: 10 until level 35, then rising to ~97 at 70 (D3 curve shape). */
export function lifePerVit(level: number): number {
  return 10 + Math.max(0, level - 35) * 2.5;
}

export function armorReduction(armor: number, monsterLevel: number): number {
  return armor / (armor + 50 * monsterLevel);
}

export function resistReduction(res: number, monsterLevel: number): number {
  return res / (res + 5 * monsterLevel);
}

type Acc = Record<string, number>;

function add(acc: Acc, k: string, v: number) {
  acc[k] = (acc[k] ?? 0) + v;
}

export function gemSlotRole(slot: Slot): 'weapon' | 'head' | 'armor' {
  if (slot === 'mainhand') return 'weapon';
  if (slot === 'head') return 'head';
  return 'armor';
}

/** Sum item contributions for one equipped item. CDR/RCR are collected as lists (multiplicative). */
function accumulateItem(acc: Acc, mults: Record<'cdr' | 'rcr', number[]>, item: Item, slot: Slot) {
  const um = upgradeMult(item);
  for (const a of item.affixes) {
    const v = a.value * um;
    if (a.stat === 'cdr' || a.stat === 'rcr') mults[a.stat].push(v);
    else if (a.stat === 'skillDmg') add(acc, `skill:${a.param}`, v);
    else if (a.stat === 'flatMin') { add(acc, 'flatMin', v); add(acc, 'flatMax', v * 2); }
    else add(acc, a.stat, v);
  }
  if (item.armor) add(acc, 'armorItems', item.armor * um);
  for (const s of item.sockets) {
    if (!s) continue;
    const gem = GEMS[s.gem];
    const role = gem[gemSlotRole(slot)];
    const v = role.values[Math.min(role.values.length - 1, s.rank - 1)];
    if (role.stat === 'cdr' || role.stat === 'rcr') mults[role.stat].push(v);
    else add(acc, role.stat, v);
  }
}

export interface StatsOptions {
  /** Treat this item as equipped in `slot` (for tooltip comparisons). */
  swap?: { slot: Slot; item: Item | null };
}

export function computeStats(save: CharacterSave, opts: StatsOptions = {}): DerivedStats {
  const cls = CLASSES[save.classId];
  const level = save.level;
  const acc: Acc = {};
  const mults: Record<'cdr' | 'rcr', number[]> = { cdr: [], rcr: [] };
  const equipment: Partial<Record<Slot, Item>> = { ...save.equipment };
  if (opts.swap) {
    if (opts.swap.item) equipment[opts.swap.slot] = opts.swap.item;
    else delete equipment[opts.swap.slot];
    // A two-handed weapon (other than bows/crossbows with quivers) clears the off-hand.
    const mh = equipment.mainhand;
    if (mh && BASES[mh.base].weapon?.twoHanded && !BASES[mh.base].weapon?.ranged && opts.swap.slot === 'mainhand') delete equipment.offhand;
    if (mh && mh.base === 'staff' && opts.swap.slot === 'mainhand') delete equipment.offhand;
  }

  const powers: Record<string, number> = {};
  const sets: Record<string, number> = {};
  for (const [slot, item] of Object.entries(equipment) as [Slot, Item][]) {
    if (!item) continue;
    accumulateItem(acc, mults, item, slot);
    if (item.legendary) powers[item.legendary.power] = Math.max(powers[item.legendary.power] ?? 0, item.legendary.value);
    if (item.set) sets[item.set] = (sets[item.set] ?? 0) + 1;
  }
  // Cube-extracted powers use the maximum roll (D3 Kanai's Cube rule).
  for (const p of save.cube.equipped) {
    if (p && LEGENDARIES[p] && powers[p] === undefined) powers[p] = LEGENDARIES[p].range[1];
  }

  // Paragon
  let paragonMain = 0;
  const paragonPct: Acc = {};
  for (const d of PARAGON_STATS) {
    const pts = save.paragon.spent[d.id] ?? 0;
    if (!pts) continue;
    const v = pts * d.perPoint;
    if (d.stat === 'main') paragonMain += v;
    else if (d.stat === 'cdr' || d.stat === 'rcr') mults[d.stat].push(v);
    else if (d.stat === 'armor' || d.stat === 'lifeRegen' || d.stat === 'lifePerHit') add(paragonPct, d.stat, v);
    else add(acc, d.stat, v);
  }

  // Legendary stat-style powers
  if (powers.witching_cord) { add(acc, 'chd', powers.witching_cord); add(acc, 'ias', 7); }
  if (powers.mountain_fists) { add(acc, 'area', powers.mountain_fists); add(acc, 'ias', 15); }

  const mainStatId = cls.mainStat;
  const attr = (k: 'str' | 'dex' | 'int' | 'vit') => cls.base[k] + cls.perLevel[k] * (level - 1) + (acc[k] ?? 0);
  const str = attr('str'), dex = attr('dex'), int = attr('int');
  const vit = attr('vit');
  const mainStat = (mainStatId === 'str' ? str : mainStatId === 'dex' ? dex : int) + paragonMain;

  const lifePct = acc.lifePct ?? 0;
  const life = Math.round((40 + 4 * level + vit * lifePerVit(level)) * (1 + lifePct / 100));

  // D3 2.x: every class gains 1 Armor per Strength and 1 All Resistance per 10 Intelligence.
  const armor = Math.round(((acc.armorItems ?? 0) + (acc.armor ?? 0) + str) * (1 + (paragonPct.armor ?? 0) / 100));
  const allRes = Math.round((acc.allRes ?? 0) + int / 10);

  const mh = equipment.mainhand;
  let weaponMin = 2, weaponMax = 3, baseAps = 1.2;
  let weaponElement: Element = 'physical';
  if (mh?.weapon) {
    const um = upgradeMult(mh);
    weaponMin = mh.weapon.min * um;
    weaponMax = mh.weapon.max * um;
    baseAps = mh.weapon.aps;
    weaponElement = mh.weapon.element;
  }
  const wdp = acc.weaponDmgPct ?? 0;
  weaponMin = (weaponMin + (acc.flatMin ?? 0)) * (1 + wdp / 100);
  weaponMax = (weaponMax + (acc.flatMax ?? 0)) * (1 + wdp / 100);

  const ias = acc.ias ?? 0;
  const aps = baseAps * (1 + ias / 100);
  const chc = Math.min(100, 5 + (acc.chc ?? 0));
  const chd = 50 + (acc.chd ?? 0);
  const multStack = (arr: number[]) => (1 - arr.reduce((p, v) => p * (1 - v / 100), 1)) * 100;
  const cdr = multStack(mults.cdr);
  const rcr = multStack(mults.rcr);

  const ele = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  ele.fire = acc.eleFire ?? 0;
  ele.cold = acc.eleCold ?? 0;
  ele.lightning = acc.eleLightning ?? 0;
  ele.physical = acc.elePhysical ?? 0;
  ele.arcane = acc.eleArcane ?? 0;

  const skillDmg: Record<string, number> = {};
  for (const [k, v] of Object.entries(acc)) if (k.startsWith('skill:')) skillDmg[k.slice(6)] = v;

  const avg = (weaponMin + weaponMax) / 2;
  const sheetDps = avg * aps * (1 + mainStat / 100) * (1 + (chc / 100) * (chd / 100)) * (1 + (acc.dmgPct ?? 0) / 100);

  const armorDR = armorReduction(armor, level);
  const resDR = resistReduction(allRes, level);
  const toughness = life / ((1 - armorDR) * (1 - resDR));
  const lifeRegen = (acc.lifeRegen ?? 0) + life * ((paragonPct.lifeRegen ?? 0) / 100);
  const lifePerHit = (acc.lifePerHit ?? 0) + life * ((paragonPct.lifePerHit ?? 0) / 100);

  return {
    mainStat, mainStatId, vit, life, armor, allRes, chc, chd, aps, ias, cdr, rcr,
    area: acc.area ?? 0,
    ele, skillDmg,
    elite: acc.elite ?? 0,
    eliteDR: acc.eliteDR ?? 0,
    lifePerHit, lifeRegen,
    lifePerKill: acc.lifePerKill ?? 0,
    ms: Math.min(25, acc.ms ?? 0),
    pickup: acc.pickup ?? 0,
    goldFind: acc.goldFind ?? 0,
    xpPct: acc.xpPct ?? 0,
    thorns: acc.thorns ?? 0,
    maxResource: cls.resource.max + (acc.maxResource ?? 0),
    resourceRegen: cls.resource.regenPerSec + (acc.resourceRegen ?? 0),
    dmgPct: acc.dmgPct ?? 0,
    weaponMin, weaponMax, weaponElement,
    sheetDps,
    toughness,
    recovery: lifeRegen + lifePerHit * aps,
    armorDR, resDR,
    powers, sets,
  };
}

/** Stat delta summary used by tooltips ("+12.4% Damage, -3.0% Toughness"), like D3's compare header. */
export function compareItem(save: CharacterSave, item: Item, slot: Slot) {
  const cur = computeStats(save);
  const next = computeStats(save, { swap: { slot, item } });
  const pctDelta = (a: number, b: number) => (a > 0 ? ((b - a) / a) * 100 : 0);
  return {
    damage: pctDelta(cur.sheetDps, next.sheetDps),
    toughness: pctDelta(cur.toughness, next.toughness),
    recovery: pctDelta(cur.recovery || 1, next.recovery || 1),
    cur, next,
  };
}

export function setBonusesActive(setId: string, count: number) {
  return SETS[setId].bonuses.filter((b) => b.count <= count);
}

export const STAT_LABELS: Partial<Record<StatId, string>> = {
  str: 'Strength', dex: 'Dexterity', int: 'Intelligence', vit: 'Vitality', chc: 'Critical Hit Chance', chd: 'Critical Hit Damage',
  ias: 'Attack Speed', cdr: 'Cooldown Reduction', rcr: 'Resource Cost Reduction', area: 'Area Damage', armor: 'Armor',
  allRes: 'All Resistance', lifePct: 'Life', ms: 'Movement Speed', goldFind: 'Gold Find', xpPct: 'Bonus Experience',
};
