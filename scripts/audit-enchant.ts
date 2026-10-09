// Handler-level synthetic transition probe. Never a real player's save or account.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCharacter } from '../shared/src/character';
import { generateItem } from '../shared/src/items';
import { Rng } from '../shared/src/math';
import { computeStats } from '../shared/src/stats';
import { SERVICE_ROLE } from '../shared/src/townServices';
import type { CmdOp } from '../shared/src/protocol';
import { World } from '../server/src/world';
import { runCommand } from '../server/src/commands';
import type { Session } from '../server/src/net/session';
import { Instance } from '../server/src/sim/instance';

assert.ok(process.env.DATA_DIR, 'Enchant audit requires a fresh isolated DATA_DIR');
assert.equal((await fs.readdir(process.env.DATA_DIR)).length, 0);
const world = new World(); await world.init();
const save = createCharacter('EnchantAudit', 'warrior', 73);
save.level = 70; save.cube.level = 8; save.gold = 1e9;
for (const k of Object.keys(save.materials) as (keyof typeof save.materials)[]) save.materials[k] = 10000;
const item = generateItem(new Rng(17), { ilvl: 70, classId: 'warrior', rarity: 'legendary', legendary: 'ouroboros_loop' });
save.inventory[0] = item;
const s = { save, derived: computeStats(save), sessionId: save.id, rec: null, entityId: 0, homeTown: null, hold: null,
  pendingEnchant: null, send() {}, sendRaw() {}, markDirty() {}, saveNow() {}, autosave() {}, kick() {}, shutdown() {},
  changed() { s.derived = computeStats(save); },
} as unknown as Session;
const steps: unknown[] = [];
try {
  world.login(s, (you, zone) => ({ t: 'welcome', you, char: save, derived: s.derived, zone, time: Date.now(), world: world.infoFor(s) }));
  const cmd = (op: CmdOp, args: Record<string, unknown>) => {
    const npc = s.rec!.inst.map.town!.npcs.find(n => n.role === SERVICE_ROLE[op])!;
    const p = (s.rec!.inst as Instance).players.find(p => p.link === s)!;
    p.x = p.mv.x = npc.approach[0]; p.y = p.mv.y = npc.approach[1];
    const goldBefore = save.gold, matsBefore = { ...save.materials }, xpBefore = save.cube.xp;
    const result = runCommand(s, world, op, args);
    steps.push({ op, args, result: structuredClone(result), spentGold: goldBefore - save.gold,
      spentMats: Object.fromEntries(Object.keys(matsBefore).map(k => [k, matsBefore[k as keyof typeof matsBefore] - save.materials[k as keyof typeof matsBefore]])),
      cubeXpDelta: save.cube.xp - xpBefore, enchantCount: save.inventory[0]?.enchantCount,
      pending: Boolean(s.pendingEnchant) });
    return result;
  };
  assert.ok(cmd('enchantRoll', { itemId: item.id, affix: 0 }).ok);
  assert.ok(cmd('enchantRoll', { itemId: item.id, affix: 0 }).ok);
  assert.ok(cmd('enchantPick', { itemId: item.id, choice: 0 }).ok);
  assert.ok(cmd('enchantRoll', { itemId: item.id, affix: 0 }).ok);
  const offeredBeforeReforge = structuredClone(s.pendingEnchant!.options[0]);
  const beforeBlockedReforge = structuredClone(save), pendingBefore = structuredClone(s.pendingEnchant);
  const blockedReforge = cmd('reforge', { itemId: item.id });
  assert.equal(blockedReforge.ok, false);
  assert.match(blockedReforge.err!, /choose.*enchant/i);
  assert.deepEqual(save, beforeBlockedReforge);
  assert.deepEqual(s.pendingEnchant, pendingBefore);
  const pickOriginalItem = cmd('enchantPick', { itemId: item.id, choice: 1 });
  assert.ok(pickOriginalItem.ok);
  assert.equal(s.pendingEnchant, null);
  assert.deepEqual(item.affixes[0], offeredBeforeReforge, 'Paid offer still applies to its original item state');
  assert.ok(cmd('reforge', { itemId: item.id }).ok, 'Resolved choice permits reforge');
  assert.notEqual(save.inventory[0], item);
  assert.equal(save.inventory[0]!.id, item.id);
  const stalePick = cmd('enchantPick', { itemId: item.id, choice: 1 });
  assert.equal(stalePick.ok, false);
  const result = { node: process.version,
    scope: 'Synthetic handler-level calls beside each required NPC. Random offers/reforge rolls; no WebSocket or player-time measurement.',
    steps, offeredBeforeReforge, beforeBlockedReforge, finalItem: save.inventory[0],
    blockedReforge: !blockedReforge.ok, paidChoicePreserved: pickOriginalItem.ok, staleOfferAccepted: stalePick.ok };
  const outputArg = process.argv.indexOf('--output');
  const out = path.resolve(outputArg >= 0 ? process.argv[outputArg + 1] : 'docs/phase/P01-research/checks/enchant-current.json');
  await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ out, blockedReforge: result.blockedReforge, paidChoicePreserved: result.paidChoicePreserved, staleOfferAccepted: result.staleOfferAccepted }, null, 2));
} finally { await world.shutdown(); }
assert.equal((await fs.readdir(process.env.DATA_DIR)).length, 0, 'Probe must not persist fixture characters');
