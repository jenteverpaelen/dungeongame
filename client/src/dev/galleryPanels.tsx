// Dev gallery for the panels: mock level-70 character, a stubbed command API and a few static sheets.
//   /gallery-panels.html?s=inventory            panels to open (comma separated): inventory,skills,paragon,cube,waypoint,obelisk,debug
//   /gallery-panels.html?s=tips                 tooltip variants sheet
//   /gallery-panels.html?s=icons                glyph / material / gem sheet
//   &cube=upgrade&cubelevel=4&item=<n>          cube function, cube level, bag index placed in the cube
//   &pin=<bag index>                            pin a floating tooltip (with comparison) at the cursor spot
//   &class=mage|ranger                          other class (default warrior)

import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/400-italic.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/lilita-one/400.css';
import '../ui/styles/tokens.css';

import { render } from 'preact';
import { AFFIXES, AFFIX_BY_STAT, GEMS, GEM_IDS, LEGENDARIES, SETS, affixScale } from '@shared/data/items';
import { addToInventory, buySkillTier, createCharacter, equipItem, resetSkillTiers, setSkillRune, setSkillSlot, skillPointsSpent, unequipItem } from '@shared/character';
import { addCubeXp, canAfford, enchantCost, enchantPool, extractCost, fuseCost, gemRemoveCost, pay, reforgeCost, salvageXp, salvageYield, socketCost, transmuteCost, upgradeChance, upgradeCost, FORTUNE_PER_FAIL } from '@shared/cube';
import { generateItem, type GenOptions } from '@shared/items';
import { Rng } from '@shared/math';
import { PARAGON_STATS, addXp, paragonPoints, paragonSpent, paragonXpToNext, xpToNext } from '@shared/progression';
import { computeStats } from '@shared/stats';
import { INVENTORY_SIZE } from '@shared/constants';
import type { CmdOp } from '@shared/protocol';
import type { AffixRoll, CharacterSave, ClassId, Item, Rarity } from '@shared/types';
import { installApi, type CmdResult } from '../net/api';
import { togglePanel, ui, type PanelId } from '../ui/store';
import { ItemTooltip, PanelsRoot, showItemTooltip } from '../ui/panels';
import { cubeUI } from '../ui/panels/cubestate';
import { MatIcon, GemIcon, GoldIcon, CubeEmblem, EmptySocketIcon, MATERIAL_ORDER } from '../ui/panels/icons';
import { ItemGlyph, SlotGlyph } from '../ui/panels/glyphs';
import { SkillGlyph, CubeFnIcon } from '../ui/panels/skillicons';
import { SKILLS } from '@shared/data/skills';
import { CUBE_FUNCTIONS } from '@shared/cube';
import { BASES } from '@shared/data/items';

const qs = new URLSearchParams(location.search);
const classId = (qs.get('class') as ClassId) || 'warrior';
const rng = new Rng(20260);

// ───────────────────────────── mock data ─────────────────────────────

type G = Partial<GenOptions> & { rarity: Rarity };
const gen = (o: G): Item => generateItem(rng, { ilvl: 70, classId, ...o } as GenOptions);

function findItem(o: G, pred: (i: Item) => boolean, tries = 6000): Item {
  let last = gen(o);
  for (let i = 0; i < tries; i++) { last = gen(o); if (pred(last)) return last; }
  return last;
}

function makeCharacter(): CharacterSave {
  const c = createCharacter('Aldric', classId, 11);
  // level 70 + Paragon 38
  while (c.level < 70) addXp(c, xpToNext(c.level) - c.xp);
  let guard = 0;
  while (c.paragon.level < 38 && guard++ < 200) addXp(c, paragonXpToNext(c.paragon.level) - c.paragon.xp);
  addXp(c, 3_100_000);
  c.gold = 18_452_310;
  c.materials = { scrap: 1240, dust: 856, crystal: 312, soul: 47, deathsBreath: 23 };
  c.gems = { 'ruby:3': 4, 'ruby:6': 1, 'emerald:2': 7, 'emerald:5': 1, 'topaz:4': 3, 'topaz:1': 5, 'amethyst:1': 9, 'amethyst:6': 1, 'diamond:3': 3, 'diamond:5': 2 };
  c.cube = { level: Number(qs.get('cubelevel') ?? 9), xp: 142, learned: ['bloodwake', 'eternal_gyre', 'ouroboros_loop', 'anvil_vambraces', 'hellforge_talisman', 'stridewind'], equipped: ['bloodwake', 'eternal_gyre', 'ouroboros_loop'] };
  c.difficulty = 5;
  c.stats = { kills: 48210, elites: 3120, legendaries: 142, rifts: 61, playMs: 1e8, deaths: 31 };

  const set = (base: string, extra?: Partial<Item>) => Object.assign(gen({ rarity: 'set', set: 'endless_storm', base }), extra);
  const ench = (it: Item, idx: number) => { it.enchanted = idx; it.enchantCount = 1; return it; };

  const weapon = ench(findItem({ rarity: 'legendary', legendary: 'ninefold_gale' }, (i) => i.ancient === 1), 3);
  weapon.upgrade = 7; weapon.upgradeFortune = 12; weapon.bound = true; weapon.sockets = [{ gem: 'ruby', rank: 6 }, null];
  const eq = c.equipment;
  eq.mainhand = weapon;
  eq.offhand = undefined;
  delete eq.offhand;
  eq.head = set('head_horned', { bound: true, upgrade: 3 });
  eq.chest = set('chest_plate', { bound: true, sockets: [{ gem: 'amethyst', rank: 4 }, null] });
  eq.hands = set('hands_gauntlets', { bound: true });
  eq.shoulders = gen({ rarity: 'rare', base: 'shoulders_spiked' }); eq.shoulders.bound = true;
  eq.legs = gen({ rarity: 'rare', base: 'legs_plate' }); eq.legs.bound = true; eq.legs.upgrade = 2;
  eq.feet = gen({ rarity: 'legendary', legendary: 'stridewind' }); eq.feet.bound = true;
  eq.waist = gen({ rarity: 'legendary', legendary: 'eternal_gyre' }); eq.waist.bound = true;
  eq.wrists = gen({ rarity: 'legendary', legendary: 'anvil_vambraces' }); eq.wrists.bound = true;
  eq.neck = gen({ rarity: 'rare', base: 'neck_amulet' }); eq.neck.bound = true; eq.neck.sockets = [{ gem: 'diamond', rank: 3 }];
  eq.ring1 = gen({ rarity: 'legendary', legendary: 'ouroboros_loop' }); eq.ring1.bound = true;
  eq.ring2 = gen({ rarity: 'rare', base: 'ring' }); eq.ring2.bound = true;

  const bag: (Item | null)[] = Array.from({ length: INVENTORY_SIZE }, () => null);
  const put = (i: number, it: Item) => { bag[i] = it; };
  const primal = findItem({ rarity: 'legendary', legendary: 'ninefold_gale', primalAllowed: true }, (i) => i.ancient === 2, 40000);
  primal.upgrade = 0; put(0, primal);
  put(1, gen({ rarity: 'legendary', legendary: 'bloodwake' }));
  put(2, findItem({ rarity: 'legendary', legendary: 'last_light' }, (i) => i.ancient === 1));
  put(3, set('shoulders_spiked'));
  put(4, set('legs_plate', { upgrade: 4, bound: true }));
  put(5, set('feet_greaves'));
  put(6, gen({ rarity: 'rare', base: 'sword' }));
  put(7, gen({ rarity: 'rare', base: 'head_helm' }));
  put(8, gen({ rarity: 'magic', base: 'chest_mail' }));
  put(9, gen({ rarity: 'normal', base: 'axe' }));
  put(10, gen({ rarity: 'legendary', legendary: 'hellforge_talisman' }));
  put(11, gen({ rarity: 'magic', base: 'hands_gloves' }));
  put(12, gen({ rarity: 'rare', base: 'wrists_bracers' }));
  put(13, gen({ rarity: 'legendary', legendary: 'thunderhead' }));
  put(14, gen({ rarity: 'normal', base: 'feet_boots' }));
  put(15, gen({ rarity: 'rare', base: 'ring' }));
  put(16, gen({ rarity: 'magic', base: 'waist_belt' }));
  put(17, gen({ rarity: 'rare', base: 'mace' }));
  put(18, gen({ rarity: 'legendary', legendary: 'mountain_fists' }));
  put(19, gen({ rarity: 'normal', base: 'shield' }));
  put(20, gen({ rarity: 'magic', base: 'legs_plate' }));
  put(21, gen({ rarity: 'rare', base: 'shoulders_plate' }));
  put(22, gen({ rarity: 'magic', base: 'neck_amulet' }));
  put(23, gen({ rarity: 'legendary', legendary: 'witching_cord' }));
  put(24, gen({ rarity: 'rare', base: 'axe2h' }));
  put(25, gen({ rarity: 'normal', base: 'head_helm', ilvl: 30 }));
  put(26, gen({ rarity: 'magic', base: 'sword2h' }));
  put(27, gen({ rarity: 'rare', base: 'feet_greaves' }));
  put(28, gen({ rarity: 'legendary', legendary: 'patient_thief' }));
  put(29, gen({ rarity: 'normal', base: 'chest_plate', ilvl: 20 }));
  put(33, gen({ rarity: 'magic', base: 'axe' }));
  put(34, gen({ rarity: 'rare', base: 'head_horned' }));
  put(35, gen({ rarity: 'normal', base: 'ring', ilvl: 12 }));
  put(36, gen({ rarity: 'magic', base: 'feet_boots' }));
  put(41, gen({ rarity: 'rare', base: 'hands_gauntlets' }));
  put(42, gen({ rarity: 'magic', base: 'wrists_bracers' }));
  put(47, gen({ rarity: 'normal', base: 'mace', ilvl: 40 }));
  c.inventory = bag;

  c.skills.slots = ['whirlwind', 'rend', 'ground_stomp', 'battle_rage'];
  c.skills.runes = { cleave: 'broad_sweep', whirlwind: 'dust_devils', rend: 'lacerate', ground_stomp: 'jarring_slam' };
  c.skills.tiers = { cleave: 2, whirlwind: 3, rend: 1 };
  c.skillPoints = Math.max(0, c.level - 1 - skillPointsSpent(c) - 6);
  c.paragon.spent = { p_main: 22, p_vit: 14, p_ms: 8, p_res: 3, p_ias: 20, p_cdr: 11, p_chc: 9, p_chd: 31, p_life: 16, p_armor: 6, p_allres: 4 };
  return c;
}

let char = makeCharacter();

function enchantOptions(item: Item, idx: number): AffixRoll[] {
  const pool = enchantPool(item, idx);
  const target = item.affixes[idx];
  const picks = [...pool].sort(() => rng.next() - 0.5).filter((d) => d.stat !== target.stat).slice(0, 2);
  return picks.map((def) => {
    const r = def.ranges[item.kind]!;
    const s = affixScale(def.scale, item.ilvl);
    const am = item.ancient ? 1.3 : 1;
    let min = r[0] * s * am, max = r[1] * s * am;
    if (def.scale !== 'pct') { min = Math.max(1, Math.round(min)); max = Math.max(min, Math.round(max)); } else { min = Math.round(min * 10) / 10; max = Math.round(max * 10) / 10; }
    const v = min + (max - min) * rng.next();
    const roll: AffixRoll = { stat: def.stat, value: def.scale === 'pct' ? Math.round(v * 10) / 10 : Math.round(v), min, max, primary: def.primary };
    if (def.stat === 'skillDmg') roll.param = 'whirlwind';
    return roll;
  });
}

function sync() {
  char = { ...char };
  ui.set({ char, derived: computeStats(char) });
}

const find = (id: string): Item | null => char.inventory.find((i) => i?.id === id) ?? Object.values(char.equipment).find((i) => i?.id === id) ?? null;
const fail = (err: string): CmdResult => ({ ok: false, err });

async function mock(op: CmdOp, a: Record<string, unknown> = {}): Promise<CmdResult> {
  await new Promise((r) => setTimeout(r, 120));
  const id = a.itemId as string;
  const item = id ? find(id) : null;
  switch (op) {
    case 'equip': { const e = equipItem(char, id, a.slot as never); if (e) return fail(e); sync(); return { ok: true }; }
    case 'unequip': { const e = unequipItem(char, a.slot as never); if (e) return fail(e); sync(); return { ok: true }; }
    case 'swapInv': { const f = a.from as number, t = a.to as number; [char.inventory[f], char.inventory[t]] = [char.inventory[t], char.inventory[f]]; sync(); return { ok: true }; }
    case 'destroy': { const i = char.inventory.findIndex((x) => x?.id === id); if (i >= 0) char.inventory[i] = null; sync(); return { ok: true }; }
    case 'salvage': {
      if (!item) return fail('Item not found');
      const y = salvageYield(item);
      for (const [k, v] of Object.entries(y)) (char.materials as unknown as Record<string, number>)[k] += v ?? 0;
      addCubeXp(char, salvageXp(item));
      const i = char.inventory.findIndex((x) => x?.id === id); if (i >= 0) char.inventory[i] = null;
      sync(); return { ok: true, data: { yield: y } };
    }
    case 'salvageAll': {
      const rs = a.rarities as Rarity[];
      char.inventory = char.inventory.map((it) => {
        if (!it || !rs.includes(it.rarity)) return it;
        for (const [k, v] of Object.entries(salvageYield(it))) (char.materials as unknown as Record<string, number>)[k] += v ?? 0;
        return null;
      });
      sync(); return { ok: true };
    }
    case 'upgrade': {
      if (!item) return fail('Item not found');
      const cost = upgradeCost(item);
      if (!canAfford(char, cost)) return fail('Not enough materials');
      const chance = upgradeChance(item);
      pay(char, cost);
      const success = rng.next() * 100 < chance;
      if (success) { item.upgrade++; item.upgradeFortune = 0; item.bound = true; } else item.upgradeFortune += FORTUNE_PER_FAIL;
      addCubeXp(char, 18);
      sync(); return { ok: true, data: { success } };
    }
    case 'enchantRoll': {
      if (!item) return fail('Item not found');
      const cost = enchantCost(item);
      if (!canAfford(char, cost)) return fail('Not enough materials');
      pay(char, cost);
      sync();
      return { ok: true, data: { options: enchantOptions(item, a.affix as number) } };
    }
    case 'enchantPick': {
      const en = ui.get().enchant;
      if (item && en && (a.choice as number) > 0) { item.affixes[en.affix] = en.options[(a.choice as number) - 1]; item.enchanted = en.affix; item.enchantCount++; item.bound = true; }
      addCubeXp(char, 12); sync(); return { ok: true };
    }
    case 'transmute': {
      if (!item || item.rarity !== 'rare') return fail('Only Rare items can be transmuted');
      pay(char, transmuteCost());
      const n = gen({ rarity: 'legendary' });
      const i = char.inventory.findIndex((x) => x?.id === id); if (i >= 0) char.inventory[i] = n;
      sync(); return { ok: true, data: { item: n } };
    }
    case 'extract': {
      if (!item?.legendary) return fail('Only Legendary items can be extracted');
      pay(char, extractCost());
      if (!char.cube.learned.includes(item.legendary.power)) char.cube.learned.push(item.legendary.power);
      const i = char.inventory.findIndex((x) => x?.id === id); if (i >= 0) char.inventory[i] = null;
      sync(); return { ok: true, data: { power: item.legendary.power } };
    }
    case 'cubeEquip': { char.cube.equipped[a.slot as number] = (a.power as string | null) ?? null; sync(); return { ok: true }; }
    case 'reforge': {
      if (!item) return fail('Item not found');
      pay(char, reforgeCost());
      const n = gen({ rarity: item.rarity, legendary: item.legendary?.power, set: item.set, base: item.base });
      n.id = item.id;
      const i = char.inventory.findIndex((x) => x?.id === id); if (i >= 0) char.inventory[i] = n;
      sync(); return { ok: true };
    }
    case 'socket': {
      if (!item) return fail('Item not found');
      pay(char, socketCost(item)); item.sockets = [...item.sockets, null]; addCubeXp(char, 30); sync(); return { ok: true };
    }
    case 'insertGem': {
      if (!item) return fail('Item not found');
      const key = `${a.gem}:${a.rank}`;
      const idx = item.sockets.findIndex((s) => !s);
      if (idx < 0) return fail('No empty socket');
      if (!(char.gems[key] > 0)) return fail('You do not own that gem');
      char.gems[key]--; if (!char.gems[key]) delete char.gems[key];
      item.sockets[idx] = { gem: a.gem as string, rank: a.rank as number }; sync(); return { ok: true };
    }
    case 'removeGem': {
      if (!item) return fail('Item not found');
      const s = item.sockets[a.idx as number]; if (!s) return fail('Socket is empty');
      const cost = gemRemoveCost(s.rank); if (char.gold < cost) return fail('Not enough gold');
      char.gold -= cost; const key = `${s.gem}:${s.rank}`; char.gems[key] = (char.gems[key] ?? 0) + 1; item.sockets[a.idx as number] = null; sync(); return { ok: true };
    }
    case 'fuseGem': {
      const key = `${a.gem}:${a.rank}`;
      if ((char.gems[key] ?? 0) < 3) return fail('Need 3 gems');
      const cost = fuseCost(a.rank as number); if (char.gold < cost.gold) return fail('Not enough gold');
      char.gold -= cost.gold; char.gems[key] -= 3; if (!char.gems[key]) delete char.gems[key];
      const nk = `${a.gem}:${(a.rank as number) + 1}`; char.gems[nk] = (char.gems[nk] ?? 0) + 1; addCubeXp(char, 8); sync(); return { ok: true };
    }
    case 'skillSlot': { const e = setSkillSlot(char, a.slot as number, (a.skill as string | null) ?? null); if (e) return fail(e); sync(); return { ok: true }; }
    case 'skillRune': { const e = setSkillRune(char, a.skill as string, (a.rune as string | null) ?? null); if (e) return fail(e); sync(); return { ok: true }; }
    case 'skillTier': { const e = buySkillTier(char, a.skill as string); if (e) return fail(e); sync(); return { ok: true }; }
    case 'skillReset': { resetSkillTiers(char); sync(); return { ok: true }; }
    case 'paragon': {
      const def = PARAGON_STATS.find((d) => d.id === a.stat); if (!def) return fail('Unknown stat');
      const cur = char.paragon.spent[def.id] ?? 0; const n = a.n as number;
      const avail = paragonPoints(char.paragon.level)[def.category] - paragonSpent(char, def.category);
      const next = Math.max(0, Math.min(def.cap || 1e9, cur + Math.min(n, avail)));
      char.paragon.spent[def.id] = n < 0 ? Math.max(0, cur + n) : next; sync(); return { ok: true };
    }
    case 'paragonReset': { char.paragon.spent = {}; sync(); return { ok: true }; }
    case 'debug': {
      if (a.op === 'gold') char.gold += 1_000_000;
      if (a.op === 'level') addXp(char, 1e9);
      sync(); return { ok: true };
    }
    default: return { ok: true };
  }
}

installApi(mock as never, () => {});

function setupUI() {
  ui.set({
    screen: 'game', connected: true, char, derived: computeStats(char), myId: 1,
    zone: { zone: 'hearthmere', name: 'Hearthmere', kind: 'town', theme: 'town', seed: 1, channel: 1, instance: 'town:1', difficulty: 0 },
    world: {
      online: 214, riftOpen: true,
      channels: [
        { zone: 'hearthmere', channel: 1, players: 87 }, { zone: 'hearthmere', channel: 2, players: 41 },
        { zone: 'whispering_glade', channel: 1, players: 30 }, { zone: 'whispering_glade', channel: 2, players: 14 },
        { zone: 'ashen_hollow', channel: 1, players: 9 },
      ],
    },
  });
}

// ───────────────────────────── sheets ─────────────────────────────

function TipsSheet() {
  const c = ui.get().char!;
  const items: Item[] = [
    c.inventory[9]!, c.inventory[8]!, c.inventory[6]!, c.equipment.mainhand!, c.inventory[0]!, c.equipment.chest!, c.inventory[3]!, c.equipment.neck!, c.equipment.ring1!,
  ].filter(Boolean);
  return (
    <div class="gal-sheet interactive scroll">
      <div class="gal-grid">
        {items.map((it) => <ItemTooltip item={it} key={it.id} />)}
        <ItemTooltip item={c.inventory[24]!} compare />
        <ItemTooltip item={c.inventory[0]!} compare />
      </div>
    </div>
  );
}

function IconsSheet() {
  const kinds = Object.values(BASES);
  return (
    <div class="gal-sheet interactive scroll">
      <div class="gal-grid" style={{ marginBottom: 20 }}>
        {MATERIAL_ORDER.map((m) => <MatIcon id={m} size={64} key={m} />)}
        <GoldIcon size={64} />
        {GEM_IDS.map((g) => <GemIcon gem={g} size={64} key={g} />)}
        <EmptySocketIcon size={64} />
        <CubeEmblem size={96} />
      </div>
      <div class="gal-grid" style={{ marginBottom: 20 }}>
        {kinds.map((b) => (
          <div style={{ width: 96, textAlign: 'center', color: '#8f8270', font: '11px sans-serif' }} key={b.id}>
            <div class="icon-cell" style={{ width: 96, height: 96, background: '#120d09', border: '1px solid #3a2c1b', display: 'grid', placeItems: 'center' }}>
              <ItemGlyph kind={b.kind} look={{ shape: b.shape, primary: 0x8a9099, secondary: 0xc9a227, glow: 0, variant: 0 }} size={84} />
            </div>
            {b.id}
          </div>
        ))}
      </div>
      <div class="gal-grid" style={{ marginBottom: 20 }}>
        {Object.values(SKILLS).map((s) => (
          <div style={{ width: 64, textAlign: 'center', background: '#120d09', border: '1px solid #3a2c1b', padding: 4 }} key={s.id}>
            <SkillGlyph glyph={s.icon.glyph} color={s.icon.color} size={56} />
          </div>
        ))}
        {CUBE_FUNCTIONS.map((f) => <div style={{ color: '#c9a45c', background: '#120d09', border: '1px solid #3a2c1b', padding: 8 }} key={f.op}><CubeFnIcon op={f.op} size={40} /></div>)}
      </div>
      <div class="gal-grid">
        {(['head', 'shoulders', 'chest', 'hands', 'wrists', 'waist', 'legs', 'feet', 'neck', 'ring1', 'mainhand', 'offhand'] as const).map((s) => (
          <div style={{ background: '#120d09', border: '1px solid #3a2c1b', padding: 8 }} key={s}><SlotGlyph slot={s} size={56} /></div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── boot ─────────────────────────────

function Gallery() {
  const s = qs.get('s') ?? 'inventory';
  return (
    <>
      {s === 'tips' && <TipsSheet />}
      {s === 'icons' && <IconsSheet />}
      <PanelsRoot />
    </>
  );
}

setupUI();

const scene = (qs.get('s') ?? 'inventory').split(',');
const panelIds: PanelId[] = ['inventory', 'skills', 'paragon', 'cube', 'waypoint', 'obelisk', 'debug'];
for (const p of scene) if ((panelIds as string[]).includes(p)) togglePanel(p as PanelId, true);

const cubeFn = qs.get('cube');
if (cubeFn) cubeUI.set({ fn: cubeFn as never });
const itemIdx = qs.get('item');
if (itemIdx !== null) cubeUI.set({ itemId: ui.get().char!.inventory[Number(itemIdx)]?.id ?? null });

render(<Gallery />, document.getElementById('ui')!);

const pin = qs.get('pin');
if (pin !== null) {
  const it = ui.get().char!.inventory[Number(pin)];
  if (it) setTimeout(() => showItemTooltip(it, Number(qs.get('px') ?? 1300), Number(qs.get('py') ?? 240), { compare: true }), 400);
}

Object.assign(window as object, { __ui: ui, __cubeUI: cubeUI });
void LEGENDARIES; void SETS; void AFFIX_BY_STAT; void AFFIXES; void GEMS; void addToInventory;
