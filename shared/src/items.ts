// Item generation (Diablo 3 Loot 2.0 rules: smart loot, primary/secondary affixes, ancients).

import { CLASSES } from './data/classes';
import { skillsForClass } from './data/skills';
import {
  AFFIXES, AFFIX_BY_STAT, BASES, GEM_IDS, LEGENDARIES, MAGIC_PREFIX, MAGIC_SUFFIX, RARE_PREFIX, RARE_SUFFIX, SETS,
  affixScale, type AffixDef, type BaseItem,
} from './data/items';
import { Rng } from './math';
import type { AffixRoll, AncientTier, ClassId, Element, Item, ItemKind, ItemLook, Rarity, Slot, StatId } from './types';

export const RARITY_COLORS: Record<Rarity, string> = {
  normal: '#ffffff',
  magic: '#6969ff',
  rare: '#ffff00',
  legendary: '#bf642f',
  set: '#00ff00',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  normal: '', magic: 'Magic', rare: 'Rare', legendary: 'Legendary', set: 'Set',
};

export const KIND_LABEL: Record<ItemKind, string> = {
  head: 'Helm', shoulders: 'Shoulders', chest: 'Chest Armor', hands: 'Gloves', wrists: 'Bracers', waist: 'Belt',
  legs: 'Pants', feet: 'Boots', weapon1h: 'One-Handed Weapon', weapon2h: 'Two-Handed Weapon', offhand: 'Off-Hand',
  neck: 'Amulet', ring: 'Ring',
};

export const ANCIENT_MULT = 1.3;
export const UPGRADE_STEP = 0.06; // +6% per Cube upgrade tier (+10 = +60%)

export function upgradeMult(item: Item): number {
  return 1 + UPGRADE_STEP * item.upgrade;
}

export function slotsForKind(kind: ItemKind): Slot[] {
  switch (kind) {
    case 'ring': return ['ring1', 'ring2'];
    case 'weapon1h': case 'weapon2h': return ['mainhand'];
    case 'offhand': return ['offhand'];
    default: return [kind as Slot];
  }
}

export function canClassUse(classId: ClassId, item: Item): boolean {
  const base = BASES[item.base];
  return !base.classes || base.classes.includes(classId);
}

export function baseTierIndex(ilvl: number): number {
  return Math.min(5, Math.floor((Math.max(1, ilvl) - 1) / 12));
}

/** Average base weapon damage for a one-handed weapon at item level (D3: ~1,800 avg at 70). */
export function weaponAvgDamage(ilvl: number, base: BaseItem): number {
  return 3.2 * Math.pow(1.1, Math.max(0, ilvl - 1)) * (base.weapon?.dmgMult ?? 1);
}

export function baseArmor(ilvl: number, base: BaseItem): number {
  return Math.round((6 + 4.2 * ilvl + 0.065 * ilvl * ilvl * ilvl / 10) * (base.armorMult ?? 0));
}

let idCounter = 0;
export function newItemId(rng: Rng): string {
  idCounter = (idCounter + 1) % 1679616;
  return rng.seed().toString(36) + idCounter.toString(36);
}

// ─────────────────────────── Looks ───────────────────────────

const MATERIAL_PALETTE: Record<BaseItem['material'], number[]> = {
  cloth: [0x6b4f8a, 0x3a5a8c, 0x8c3a3a, 0x4f6b3a, 0xb8a07a, 0x34344a, 0x2f5f5f],
  leather: [0x7a5230, 0x5c3d24, 0x8b6a45, 0x4a3426, 0x6b5a3a],
  mail: [0x8a9099, 0x6f7680, 0xa0a6ad],
  plate: [0x9aa3ad, 0x7d8791, 0xb5bcc4, 0x7a6248, 0xa98552],
  metal: [0xc9ced4, 0xa7aeb5, 0x8c949c, 0xb8a37a],
  wood: [0x7a5230, 0x5c3d24, 0x9c7346, 0x4a3426],
  jewel: [0xd4af37, 0xc0c0c0, 0xb87333],
  arcane: [0x6c5ce7, 0x00a8a8, 0xc0398b, 0x3d6dff],
};

function darken(c: number, f: number): number {
  const r = ((c >> 16) & 255) * f, g = ((c >> 8) & 255) * f, b = (c & 255) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function makeLook(rng: Rng, base: BaseItem, rarity: Rarity, ancient: AncientTier, legendaryId?: string, setId?: string): ItemLook {
  const pal = MATERIAL_PALETTE[base.material];
  let primary = rng.pick(pal);
  let secondary = darken(primary, 0.6);
  let glow = 0;
  if (rarity === 'magic') secondary = 0x5a7dff;
  if (rarity === 'rare') secondary = 0xd4b13a;
  if (legendaryId) {
    const c = LEGENDARIES[legendaryId].colors;
    primary = c.primary; secondary = c.secondary; glow = c.glow;
  }
  if (setId) {
    const c = SETS[setId].colors;
    primary = c.primary; secondary = c.secondary; glow = c.glow;
  }
  if (ancient && !glow) glow = 0xffb347;
  return { shape: base.shape, primary, secondary, glow, variant: rng.int(0, 3) };
}

// ─────────────────────────── Affixes ───────────────────────────

function rollAffixValue(rng: Rng, def: AffixDef, kind: ItemKind, ilvl: number, ancient: AncientTier): { value: number; min: number; max: number } {
  const range = def.ranges[kind]!;
  const s = affixScale(def.scale, ilvl);
  const am = ancient ? ANCIENT_MULT : 1;
  let min = range[0] * s * am, max = range[1] * s * am;
  if (def.scale !== 'pct') { min = Math.max(1, Math.round(min)); max = Math.max(min, Math.round(max)); }
  else { min = Math.round(min * 10) / 10; max = Math.round(max * 10) / 10; }
  const v = ancient === 2 ? max : min + (max - min) * rng.next();
  const value = def.scale === 'pct' ? Math.round(v * 10) / 10 : Math.round(v);
  return { value, min, max };
}

function pickAffix(rng: Rng, kind: ItemKind, primary: boolean, taken: Set<string>, takenGroups: Set<string>): AffixDef | null {
  const pool = AFFIXES.filter((a) =>
    a.primary === primary && a.weight > 0 && a.ranges[kind] && !taken.has(a.stat) && !(a.group && takenGroups.has(a.group)));
  if (!pool.length) return null;
  return rng.weighted(pool.map((a) => [a, a.weight] as const));
}

export function mainStatFor(rng: Rng, classId: ClassId, smart: boolean): StatId {
  if (smart) return CLASSES[classId].mainStat;
  return rng.pick(['str', 'dex', 'int'] as const);
}

function makeAffix(rng: Rng, def: AffixDef, kind: ItemKind, ilvl: number, ancient: AncientTier, classId: ClassId): AffixRoll {
  const { value, min, max } = rollAffixValue(rng, def, kind, ilvl, ancient);
  const roll: AffixRoll = { stat: def.stat, value, min, max, primary: def.primary };
  if (def.stat === 'skillDmg') {
    const skills = skillsForClass(classId).filter((s) => s.kind !== 'primary');
    roll.param = rng.pick(skills).id;
  }
  return roll;
}

export function affixLabel(a: AffixRoll): string {
  const def = AFFIX_BY_STAT[a.stat];
  if (!def) return `${a.stat} ${a.value}`;
  if (a.stat === 'skillDmg' && a.param) {
    return def.label(a.value, skillNameOf(a.param));
  }
  return def.label(a.value, a.param);
}

let skillNameCache: Record<string, string> | null = null;
function skillNameOf(id: string): string {
  if (!skillNameCache) {
    skillNameCache = {};
    for (const c of ['warrior', 'ranger', 'mage'] as ClassId[]) for (const s of skillsForClass(c)) skillNameCache[s.id] = s.name;
  }
  return skillNameCache[id] ?? id;
}

// ─────────────────────────── Generation ───────────────────────────

export interface GenOptions {
  ilvl: number;
  classId: ClassId;
  rarity: Rarity;
  base?: string;
  legendary?: string;
  set?: string;
  ancientAllowed?: boolean;
  primalAllowed?: boolean;
  smartChance?: number; // probability the item is tailored to the class (D3: 85%)
}

const KIND_WEIGHTS: [ItemKind, number][] = [
  ['head', 8], ['shoulders', 7], ['chest', 8], ['hands', 8], ['wrists', 6], ['waist', 6], ['legs', 8], ['feet', 8],
  ['neck', 5], ['ring', 9], ['weapon1h', 7], ['weapon2h', 6], ['offhand', 6],
];

export function pickBase(rng: Rng, classId: ClassId, smart: boolean): BaseItem {
  for (let tries = 0; tries < 20; tries++) {
    const kind = rng.weighted(KIND_WEIGHTS);
    const candidates = Object.values(BASES).filter((b) => b.kind === kind && (!smart || !b.classes || b.classes.includes(classId)));
    if (!candidates.length) continue;
    const weighted = candidates.map((b) => [b, smart && b.affinity?.includes(classId) ? 4 : 1] as const);
    return rng.weighted(weighted);
  }
  return BASES.ring;
}

export function generateItem(rng: Rng, o: GenOptions): Item {
  const smart = rng.next() < (o.smartChance ?? 0.85);
  let classId = o.classId;
  let legendaryId = o.legendary;
  let setId = o.set;
  let base: BaseItem;

  if (o.rarity === 'legendary' && !legendaryId) {
    const pool = Object.values(LEGENDARIES).filter((l) => !smart || !l.classes || l.classes.includes(o.classId));
    legendaryId = rng.pick(pool).id;
  }
  if (o.rarity === 'set' && !setId) {
    const pool = Object.values(SETS).filter((s) => !smart || s.classId === o.classId);
    setId = rng.pick(pool).id;
  }
  if (legendaryId) {
    const def = LEGENDARIES[legendaryId];
    base = BASES[def.base];
    if (def.classes && !def.classes.includes(classId)) classId = def.classes[0];
  } else if (setId) {
    const set = SETS[setId];
    const piece = o.base ? set.pieces.find((p) => p.base === o.base) ?? rng.pick(set.pieces) : rng.pick(set.pieces);
    base = BASES[piece.base];
    classId = set.classId;
  } else {
    base = o.base ? BASES[o.base] : pickBase(rng, o.classId, smart);
    if (base.classes && !base.classes.includes(classId)) classId = base.classes[0];
  }

  const ilvl = Math.max(1, Math.min(70, Math.round(o.ilvl)));
  const isLegend = o.rarity === 'legendary' || o.rarity === 'set';
  let ancient: AncientTier = 0;
  if (isLegend && o.ancientAllowed !== false && ilvl >= 70) {
    if (o.primalAllowed && rng.chance(1 / 400)) ancient = 2;
    else if (rng.chance(0.1)) ancient = 1;
  }

  const kind = base.kind;
  const affixes: AffixRoll[] = [];
  const taken = new Set<string>();
  const takenGroups = new Set<string>();
  let sockets = 0;

  const addAffix = (def: AffixDef | null) => {
    if (!def) return;
    affixes.push(makeAffix(rng, def, kind, ilvl, ancient, classId));
    taken.add(def.stat);
    if (def.group) takenGroups.add(def.group);
  };

  let nPrimary = 0, nSecondary = 0;
  switch (o.rarity) {
    case 'normal': break;
    case 'magic': nPrimary = 1; nSecondary = rng.chance(0.5) ? 1 : 0; break;
    case 'rare': nPrimary = rng.int(3, 4); nSecondary = rng.int(1, 2); break;
    default: nPrimary = 4; nSecondary = 2;
  }

  if (nPrimary > 0) {
    const wantMain = isLegend || (o.rarity === 'rare' ? rng.chance(0.75) : rng.chance(0.4));
    if (wantMain) {
      const ms = smart || isLegend ? CLASSES[classId].mainStat : mainStatFor(rng, classId, false);
      addAffix(AFFIX_BY_STAT[ms]);
      nPrimary--;
    }
    if (nPrimary > 0 && base.maxSockets > 0 && (o.rarity === 'rare' || isLegend) && rng.chance(isLegend ? 0.45 : 0.25)) {
      sockets = rng.int(1, base.maxSockets);
      nPrimary--;
    }
    if (nPrimary > 0 && base.weapon && (isLegend ? rng.chance(0.7) : rng.chance(0.4))) {
      addAffix(AFFIX_BY_STAT.weaponDmgPct);
      nPrimary--;
    }
    for (let i = 0; i < nPrimary; i++) addAffix(pickAffix(rng, kind, true, taken, takenGroups));
  }
  for (let i = 0; i < nSecondary; i++) addAffix(pickAffix(rng, kind, false, taken, takenGroups));

  const tier = baseTierIndex(ilvl);
  let name = base.names[tier];
  if (o.rarity === 'magic' && affixes.length) {
    const pre = MAGIC_PREFIX[affixes[0].stat];
    const suf = affixes[1] ? MAGIC_SUFFIX[affixes[1].stat] ?? MAGIC_SUFFIX[affixes[0].stat] : MAGIC_SUFFIX[affixes[0].stat];
    if (pre) name = `${pre} ${name}`;
    if (suf && (!pre || affixes[1])) name = `${name} ${suf}`;
  } else if (o.rarity === 'rare') {
    name = `${rng.pick(RARE_PREFIX)} ${rng.pick(RARE_SUFFIX[kind] ?? ['Relic'])}`;
  } else if (legendaryId) {
    name = LEGENDARIES[legendaryId].name;
  } else if (setId) {
    name = SETS[setId].pieces.find((p) => p.base === base.id)?.name ?? SETS[setId].name;
  }

  const item: Item = {
    id: newItemId(rng),
    base: base.id,
    kind,
    name,
    rarity: o.rarity,
    ancient,
    ilvl,
    reqLevel: ilvl,
    affixes,
    sockets: Array.from({ length: sockets }, () => null),
    upgrade: 0,
    upgradeFortune: 0,
    enchantCount: 0,
    bound: false,
    look: makeLook(rng, base, o.rarity, ancient, legendaryId, setId),
  };

  if (base.weapon) {
    const avg = weaponAvgDamage(ilvl, base) * (ancient ? ANCIENT_MULT : 1) * (isLegend ? 1.1 : o.rarity === 'rare' ? 1.05 : 1);
    const spread = 0.35;
    const element: Element = 'physical';
    item.weapon = {
      min: Math.max(1, Math.round(avg * (1 - spread) * rng.range(0.95, 1.05))),
      max: Math.max(2, Math.round(avg * (1 + spread) * rng.range(0.95, 1.05))),
      aps: base.weapon.aps,
      element,
    };
  }
  if (base.armorMult) {
    item.armor = Math.round(baseArmor(ilvl, base) * rng.range(0.9, 1.1) * (ancient ? ANCIENT_MULT : 1));
  }
  if (legendaryId) {
    const def = LEGENDARIES[legendaryId];
    const [mn, mx] = def.range;
    const raw = ancient === 2 ? mx : mn + (mx - mn) * rng.next();
    const value = mx <= 2 ? Math.round(raw * 100) / 100 : Math.round(raw);
    item.legendary = { power: legendaryId, value, min: mn, max: mx };
    item.flavor = def.flavor;
  }
  if (setId) item.set = setId;
  return item;
}

// ─────────────────────────── Drops ───────────────────────────

export type EliteTier = 0 | 1 | 2 | 3 | 4 | 5; // normal, champion, rare, minion, boss, goblin

export interface DropContext {
  level: number;
  difficulty: number;
  elite: EliteTier;
  classId: ClassId;
  magicFind: number;
  /** Equipment misses since the last generated Legendary or Set (bad-luck protection). */
  pity: number;
  inRift: boolean;
}

export type Drop =
  | { type: 'item'; item: Item }
  | { type: 'gold'; amount: number }
  | { type: 'gem'; gem: string; rank: number }
  | { type: 'mat'; mat: 'deathsBreath'; amount: number }
  | { type: 'globe' };

export const PITY_THRESHOLD = 45;

export function rollRarity(rng: Rng, ctx: DropContext): Rarity {
  const lvl = ctx.level;
  const diff = ctx.difficulty;
  let legendary = 0.012 * (1 + 0.3 * diff) * (ctx.inRift ? 1.4 : 1) * (1 + ctx.magicFind / 100);
  // Guardians always end up with a Legendary (see rollDrops); goblins are a jackpot, not a loot machine.
  if (ctx.elite === 4) legendary = 0.2;
  if (ctx.elite === 5) legendary = 0.12;
  if (ctx.pity >= PITY_THRESHOLD) legendary = 1;
  if (rng.chance(legendary)) return rng.chance(0.25) ? 'set' : 'legendary';
  const normalW = Math.max(8, 48 - lvl * 0.6 - diff * 4);
  const magicW = 36;
  const rareW = 10 + lvl * 0.25 + diff * 3 + (ctx.elite ? 12 : 0);
  return rng.weighted([['normal', normalW], ['magic', magicW], ['rare', rareW]] as const);
}

export const NORMAL_GOLD_DROP_CHANCE = 0.22;
/** Owner requested fewer all-equipment drops; non-equipment budgets are unchanged. */
export const EQUIPMENT_DROP_SCALE = 2 / 3;
/** Further factor for ordinary, champion, rare and minion kills only ("too many drops", owner 2026-10-10). Boss and
 *  treasure-goblin batches are rewards for effort and keep `EQUIPMENT_DROP_SCALE`. Calibrated against items per hour
 *  of a levelling bot (docs/rework/BALANCE.md): 2/3 × 1/6 = 1/9 of the original per-kill rate. */
export const FIELD_DROP_FACTOR = 1 / 6;
/** Gems and Death's Breath from ordinary, champion, rare and minion kills. They fed gear power (sockets, upgrades) at
 *  ~200 per hour each; they had only fallen with the kill rate while equipment fell ×8, so they get the same treatment
 *  in a gentler form. Boss and goblin batches are untouched. */
export const FIELD_RESOURCE_FACTOR = 1 / 3;
export const baseGoldAmount = (level:number) => (4 + level * 2.5) * Math.pow(1.06, level);
export function goldAmount(rng: Rng, level: number, goldFind: number): number {
  return Math.max(1, Math.round(baseGoldAmount(level) * rng.range(0.6, 1.4) * (1 + goldFind / 100)));
}

/** Roll everything a monster drops for one player (personal loot). */
export function rollDrops(rng: Rng, ctx: DropContext, goldFind: number, equipmentScale = EQUIPMENT_DROP_SCALE): { drops: Drop[]; pity: number } {
  const drops: Drop[] = [];
  let pity = ctx.pity;
  const originalCount = (() => {
    switch (ctx.elite) {
      case 0: return rng.chance(0.075 * (1 + ctx.difficulty * 0.08)) ? 1 : 0;
      case 1: return rng.int(1, 2);
      case 2: return rng.int(2, 3);
      case 3: return rng.chance(0.15) ? 1 : 0;
      case 4: return rng.int(5, 7);
      case 5: return rng.int(3, 5);
    }
  })();
  const scaledCount = originalCount * Math.max(0, Math.min(1, equipmentScale * (ctx.elite >= 4 ? 1 : FIELD_DROP_FACTOR)));
  const itemCount = Math.floor(scaledCount) + (scaledCount % 1 > 0 && rng.chance(scaledCount % 1) ? 1 : 0);
  for (let i = 0; i < itemCount; i++) {
    const rarity = rollRarity(rng, { ...ctx, pity });
    const item = generateItem(rng, {
      ilvl: ctx.level, classId: ctx.classId, rarity,
      ancientAllowed: true, primalAllowed: ctx.difficulty >= 6,
    });
    if (rarity === 'legendary' || rarity === 'set') pity = 0; else pity++;
    drops.push({ type: 'item', item });
  }
  if (ctx.elite === 4) {
    // Boss batches include at least one Legendary or Set.
    if (!drops.some((d) => d.type === 'item' && (d.item.rarity === 'legendary' || d.item.rarity === 'set'))) {
      drops.push({ type: 'item', item: generateItem(rng, { ilvl: ctx.level, classId: ctx.classId, rarity: 'legendary', primalAllowed: ctx.difficulty >= 6 }) });
      pity = 0;
    }
  }
  const goldPiles = ctx.elite === 5 ? 18 : ctx.elite === 4 ? 8 : ctx.elite === 2 ? 3 : ctx.elite === 1 ? 2 : rng.chance(NORMAL_GOLD_DROP_CHANCE) ? 1 : 0;
  for (let i = 0; i < goldPiles; i++) drops.push({ type: 'gold', amount: goldAmount(rng, ctx.level, goldFind) * (ctx.elite ? 2 : 1) });
  const resource = ctx.elite >= 4 ? 1 : FIELD_RESOURCE_FACTOR;
  if (rng.chance((ctx.elite ? 0.25 : 0.012) * resource)) {
    const rank = Math.min(5, Math.max(1, 1 + Math.floor(ctx.level / 15) + (ctx.difficulty >= 4 ? 1 : 0)));
    drops.push({ type: 'gem', gem: rng.pick(GEM_IDS), rank });
  }
  if (ctx.elite === 1 || ctx.elite === 2 || ctx.elite === 4) {
    if (rng.chance(ctx.elite === 4 ? 1 : 0.6 * resource)) drops.push({ type: 'mat', mat: 'deathsBreath', amount: ctx.elite === 4 ? rng.int(2, 4) : 1 });
  }
  if (rng.chance(ctx.elite ? 0.5 : 0.035)) drops.push({ type: 'globe' });
  return { drops, pity };
}

/** One-time tutorial reward. Upper legal normal starter damage + one legal positive main affix. */
export function starterUpgrade(rng:Rng,classId:ClassId):Item {
  const base=BASES[CLASSES[classId].starter.mainhand];
  const item=generateItem(rng,{ilvl:1,classId,base:base.id,rarity:'normal'});
  const avg=weaponAvgDamage(1,base);
  item.weapon={min:Math.max(1,Math.round(avg*(1-0.35)*1.05)),max:Math.max(2,Math.round(avg*(1+0.35)*1.05)),aps:base.weapon!.aps,element:'physical'};
  item.rarity='magic';
  item.affixes=[makeAffix(rng,AFFIX_BY_STAT[CLASSES[classId].mainStat],base.kind,1,0,classId)];
  item.name=`${MAGIC_PREFIX[CLASSES[classId].mainStat]} ${base.names[0]}`;
  item.look=makeLook(rng,base,'magic',0);
  return item;
}

/** Starter equipment for a fresh character. */
export function starterItems(rng: Rng, classId: ClassId): Partial<Record<Slot, Item>> {
  const st = CLASSES[classId].starter;
  const out: Partial<Record<Slot, Item>> = {};
  const mk = (base: string) => generateItem(rng, { ilvl: 1, classId, rarity: 'normal', base });
  out.mainhand = mk(st.mainhand);
  if (st.offhand) out.offhand = mk(st.offhand);
  out.chest = mk(st.chest);
  out.legs = mk(st.legs);
  out.feet = mk(st.feet);
  return out;
}
