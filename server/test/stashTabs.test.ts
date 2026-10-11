// Stash tabs (F-ECO-08): bought in order at the shown price, never twice; deposits fill the open tab first; moves stay
// inside owned tabs; the optional save field survives loading and never costs an item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { computeStats } from '../../shared/src/stats';
import { STASH_SIZE } from '../../shared/src/constants';
import { MAX_STASH_TABS, STASH_TAB_PRICES, buyStashTab, moveStashItem, nextStashTabPrice, stashCapacity, stashTabs, transferStash } from '../../shared/src/stash';
import { SERVICE_ROLE } from '../../shared/src/townServices';
import type { CmdOp } from '../../shared/src/protocol';
import type { CharacterSave } from '../../shared/src/types';
import { World } from '../src/world';
import { runCommand } from '../src/commands';
import type { Session } from '../src/net/session';
import type { Instance } from '../src/sim/instance';
import { normalizeSave } from '../src/persistence';
import { custodySummary } from '../src/saveIntegrity';

assert.ok(process.env.DATA_DIR, 'Tests require an explicit isolated DATA_DIR');
const rng = new Rng(808);
const loot = () => generateItem(rng, { ilvl: 20, classId: 'warrior', rarity: 'rare', base: 'chest_plate' });
function hero(gold = 0): CharacterSave { const s = createCharacter(`Vault${Math.floor(rng.next() * 1e6)}`, 'warrior', 3); s.gold = gold; return s; }
function bagged(save: CharacterSave) { const it = loot(); save.inventory[save.inventory.findIndex(i => !i)] = it; return it; }

test('legacy saves own one tab; prices escalate and stop at the maximum', () => {
  const s = hero();
  assert.equal(stashTabs(s), 1); assert.equal(stashCapacity(s), STASH_SIZE); assert.equal(nextStashTabPrice(s), 170_000);
  assert.equal(STASH_TAB_PRICES.length, MAX_STASH_TABS);
  for (let i = 2; i < STASH_TAB_PRICES.length; i++) assert.ok(STASH_TAB_PRICES[i] > STASH_TAB_PRICES[i - 1], 'each tab costs more than the last');
  assert.equal(nextStashTabPrice({ stashTabs: MAX_STASH_TABS }), null);
  for (const bad of [0, -1, 1.5, Number.NaN, '3' as unknown as number]) assert.equal(stashTabs({ stashTabs: bad }), 1, String(bad));
  assert.equal(stashTabs({ stashTabs: 99 }), MAX_STASH_TABS);
});

test('a tab is bought once, in order, at the shown price, and only with enough gold', () => {
  const s = hero(169_999);
  const unchanged = () => JSON.stringify(s);
  let before = unchanged();
  assert.equal(buyStashTab(s, 2, 170_000), 'Not enough gold'); assert.equal(unchanged(), before);
  s.gold = 2_000_000; before = unchanged();
  assert.equal(buyStashTab(s, 3, 630_000), 'Buy the tabs in order'); assert.equal(unchanged(), before);
  assert.equal(buyStashTab(s, 2, 1), 'The price changed; check it and try again'); assert.equal(unchanged(), before);
  assert.equal(buyStashTab(s, 2, 170_000), null);
  assert.equal(s.gold, 2_000_000 - 170_000); assert.equal(stashTabs(s), 2); assert.equal(s.stash.length, 2 * STASH_SIZE);
  // A retried request (same tab number and price) can never charge twice.
  assert.equal(buyStashTab(s, 2, 170_000), 'You already own that tab'); assert.equal(s.gold, 1_830_000);
  s.gold = 1e9; for (let t = 3; t <= MAX_STASH_TABS; t++) assert.equal(buyStashTab(s, t, STASH_TAB_PRICES[t - 1]), null);
  assert.equal(buyStashTab(s, MAX_STASH_TABS + 1, 0), 'Your stash has every tab');
  assert.equal(s.stash.length, MAX_STASH_TABS * STASH_SIZE);
});

test('deposits fill the open tab, then the next ones; moves stay inside owned tabs', () => {
  const s = hero(1e9); buyStashTab(s, 2, 170_000); buyStashTab(s, 3, 630_000);
  const a = bagged(s);
  assert.equal(transferStash(s, a.id, true, 1), null);
  assert.equal(s.stash.findIndex(i => i?.id === a.id), STASH_SIZE, 'first slot of tab II');
  for (let i = 2 * STASH_SIZE; i < 3 * STASH_SIZE; i++) s.stash[i] = loot();
  const b = bagged(s);
  assert.equal(transferStash(s, b.id, true, 2), null);
  assert.equal(s.stash.findIndex(i => i?.id === b.id), 0, 'tab III full → wraps to tab I');
  const c = bagged(s);
  assert.equal(transferStash(s, c.id, true, 7), null, 'an unknown tab falls back to tab I');
  assert.equal(moveStashItem(s, a.id, 3), 'You do not own that stash tab');
  assert.equal(moveStashItem(s, a.id, 1), 'The item is already in that tab');
  assert.equal(moveStashItem(s, a.id, 2), 'That tab is full');
  assert.equal(moveStashItem(s, a.id, 0), null);
  assert.ok(Math.floor(s.stash.findIndex(i => i?.id === a.id) / STASH_SIZE) === 0);
  assert.equal(moveStashItem(s, 'missing', 0), 'Item not in stash');
  // A full stash still refuses (every owned slot taken).
  for (let i = 0; i < stashCapacity(s); i++) s.stash[i] ??= loot();
  const d = bagged(s); assert.equal(transferStash(s, d.id, true, 0), 'Your stash is full');
});

test('loading keeps bought tabs and every stored item; malformed counts never lose items', () => {
  const s = hero(1e9); buyStashTab(s, 2, 170_000);
  const deep = loot(); s.stash[STASH_SIZE + 33] = deep;
  const before = custodySummary(s);
  const loaded = normalizeSave(structuredClone(s));
  assert.equal(loaded.stashTabs, 2); assert.equal(loaded.stash[STASH_SIZE + 33]?.id, deep.id);
  assert.deepEqual(custodySummary(loaded), before);
  const legacy = normalizeSave(structuredClone(hero()));
  assert.equal(legacy.stashTabs, undefined, 'legacy saves are not rewritten'); assert.equal(legacy.stash.length, STASH_SIZE);
  const broken = structuredClone(s) as CharacterSave; (broken as { stashTabs: unknown }).stashTabs = 'many';
  const fixed = normalizeSave(broken);
  assert.equal(fixed.stashTabs, undefined); assert.equal(fixed.stash[STASH_SIZE + 33]?.id, deep.id, 'items past the owned tabs stay (withdraw only)');
  assert.deepEqual(custodySummary(fixed), before);
});

test('through the server: stash proximity, persisted ops, the gold sink is recorded as an economy action', async () => {
  assert.equal(SERVICE_ROLE.stashBuyTab, 'stash'); assert.equal(SERVICE_ROLE.stashMove, 'stash');
  const world = new World(); await world.init();
  const save = createCharacter('VaultKeeper', 'warrior', 9); save.gold = 500_000;
  const s = { save, derived: computeStats(save), sessionId: save.id, rec: null, entityId: 0, homeTown: null, hold: null,
    pendingEnchant: null, send() {}, sendRaw() {}, markDirty() {}, saveNow() {}, autosave() {}, kick() {}, shutdown() {},
    changed() { s.derived = computeStats(save); } } as unknown as Session;
  try {
    world.login(s, (you, zone) => ({ t: 'welcome', you, char: save, derived: s.derived, zone, time: Date.now(), world: world.infoFor(s) }));
    const cmd = (op: CmdOp, a: Record<string, unknown> = {}) => runCommand(s, world, op, a);
    const p = (s.rec!.inst as Instance).players[0], npc = s.rec!.inst.map.town!.npcs.find(n => n.role === 'stash')!;
    assert.match(cmd('stashBuyTab', { tab: 2, price: 170_000 }).err!, /Stand beside/);
    p.x = p.mv.x = npc.approach[0]; p.y = p.mv.y = npc.approach[1];
    assert.match(cmd('stashBuyTab', { tab: 2, price: 'cheap' }).err!, /Invalid "price"/);
    const r = cmd('stashBuyTab', { tab: 2, price: 170_000 });
    assert.equal(r.ok, true, r.err ?? ''); assert.equal(save.gold, 330_000); assert.equal(stashTabs(save), 2);
    assert.equal(save.economy?.activities.stashBuyTab?.spent.gold, 170_000);
    const it = bagged(save);
    assert.equal(cmd('stashDeposit', { itemId: it.id, tab: 1 }).ok, true);
    assert.equal(save.stash.findIndex(i => i?.id === it.id), STASH_SIZE);
    assert.equal(cmd('stashMove', { itemId: it.id, tab: 0 }).ok, true);
    assert.equal(save.stash.findIndex(i => i?.id === it.id), 0);
    assert.match(cmd('stashMove', { itemId: it.id, tab: 9 }).err!, /Invalid "tab"/);
  } finally { await world.shutdown(); }
});
