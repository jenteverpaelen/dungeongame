import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../../shared/src/character';
import { generateItem } from '../../shared/src/items';
import { Rng } from '../../shared/src/math';
import { computeStats } from '../../shared/src/stats';
import { SERVICE_ROLE } from '../../shared/src/townServices';
import { transferStash } from '../../shared/src/stash';
import { CollisionWorld } from '../../shared/src/movement';
import type { CmdOp } from '../../shared/src/protocol';
import type { CharacterSave } from '../../shared/src/types';
import { World } from '../src/world';
import { runCommand } from '../src/commands';
import type { Session } from '../src/net/session';
import { Instance } from '../src/sim/instance';
import { ensureDataDir, loadCharacter, normalizeSave, saveCharacter } from '../src/persistence';

assert.ok(process.env.DATA_DIR, 'Tests require an explicit isolated DATA_DIR');
let sequence = 0;
async function fixture() {
  const world = new World(); await world.init();
  const save = createCharacter(`Service${++sequence}`, 'warrior', 1);
  save.level = 70; save.cube.level = 8; save.paragon.level = 40; save.gold = 1e9;
  for (const k of Object.keys(save.materials) as (keyof typeof save.materials)[]) save.materials[k] = 10000;
  save.gems['ruby:1'] = 30;
  const s = { save, derived: computeStats(save), sessionId: save.id, rec: null, entityId: 0, homeTown: null, hold: null,
    pendingEnchant: null, send() {}, sendRaw() {}, markDirty() {}, saveNow() {}, autosave() {}, kick() {}, shutdown() {},
    changed() { s.derived = computeStats(save); },
  } as unknown as Session;
  world.login(s, (you, zone) => ({ t: 'welcome', you, char: save, derived: s.derived, zone, time: Date.now(), world: world.infoFor(s) }));
  const at = (x: number, y: number) => { const p = (s.rec!.inst as Instance).players.find(p => p.link === s)!; p.x = p.mv.x = x; p.y = p.mv.y = y; p.hp = p.mhp; p.deadMs = 0; };
  const near = (role: string) => { const n = s.rec!.inst.map.town!.npcs.find(n => n.role === role)!; at(...n.approach); };
  const cmd = (op: CmdOp, a: Record<string, unknown> = {}) => runCommand(s, world, op, a);
  return { world, s, save, at, near, cmd };
}

test('every artisan/stash/shrine op rejects far, wrong NPC, spoofed position and dead players without mutation', async () => {
  const f = await fixture();
  try {
    for (const [op, role] of Object.entries(SERVICE_ROLE)) {
      f.near(role === 'paragon' ? 'cube' : 'paragon'); const before = JSON.stringify(f.save);
      const n = f.s.rec!.inst.map.town!.npcs.find(n => n.role === role)!;
      const r = f.cmd(op as CmdOp, { x: n.x, y: n.y, npcId: n.id, itemId: 'fake' });
      assert.equal(r.ok, false, op); assert.match(r.err!, /Stand beside/, op); assert.equal(JSON.stringify(f.save), before);
      f.near(role); const p = (f.s.rec!.inst as Instance).players[0]; p.deadMs = 500; p.hp = 0;
      assert.match(f.cmd(op as CmdOp).err!, /Stand beside/, `${op}: dead`);
    }
    f.near('waypoint'); assert.equal(f.cmd('travel', { zone: 'whispering_glade' }).ok, true);
    for (const op of Object.keys(SERVICE_ROLE)) assert.match(f.cmd(op as CmdOp).err!, /Stand beside/, `${op}: field`);
    assert.equal(f.cmd('travel', { zone: 'hearthmere' }).ok, true, 'field return preserved');
  } finally { await f.world.shutdown(); }
});

test('near the right service: all existing mutations and unlock gating still work', async () => {
  const f = await fixture(), rng = new Rng(17);
  const item = (rarity: 'normal' | 'rare' | 'legendary' = 'rare') => {
    const i = generateItem(rng, { ilvl: 70, classId: 'warrior', rarity, ...(rarity === 'legendary' ? { legendary: 'ouroboros_loop' } : { base: 'chest_plate' }) });
    const idx = f.save.inventory.findIndex(i => !i); f.save.inventory[idx] = i; return i;
  };
  const ok = (op: CmdOp, args: Record<string, unknown> = {}) => { const r = f.cmd(op, args); assert.equal(r.ok, true, `${op}: ${r.err}`); return r; };
  try {
    f.near('blacksmith'); const scrap = item('normal'); ok('salvage', { itemId: scrap.id });
    item('normal'); ok('salvageAll', { rarities: ['normal'] });
    const gear = item(); ok('upgrade', { itemId: gear.id }); assert.equal(gear.upgrade, 1);
    f.near('jeweler'); ok('fuseGem', { gem: 'ruby', rank: 1 });
    gear.sockets = []; ok('socket', { itemId: gear.id }); ok('insertGem', { itemId: gear.id, gem: 'ruby', rank: 1 }); ok('removeGem', { itemId: gear.id, idx: 0 });
    f.near('mystic'); f.save.cube.level = 1;
    assert.match(f.cmd('enchantRoll', { itemId: gear.id, affix: 0 }).err!, /Cube level 3/);
    f.save.cube.level = 8; ok('enchantRoll', { itemId: gear.id, affix: 0 });
    f.near('cube'); assert.match(f.cmd('enchantPick', { itemId: gear.id, choice: 1 }).err!, /Stand beside/);
    f.near('mystic'); ok('enchantPick', { itemId: gear.id, choice: 1 }); assert.equal(gear.enchanted, 0);
    f.near('cube'); ok('transmute', { itemId: item().id });
    const legendary = item('legendary'); ok('extract', { itemId: legendary.id });
    ok('cubeEquip', { slot: 2, power: 'ouroboros_loop' }); ok('reforge', { itemId: item('legendary').id });
    f.near('paragon'); ok('paragon', { stat: 'p_main', n: 1 }); ok('paragonReset');
    f.near('stash'); const before = structuredClone(gear); ok('stashDeposit', { itemId: gear.id });
    assert.deepEqual(f.save.stash.find(i => i?.id === gear.id), before);
    assert.equal(f.cmd('stashDeposit', { itemId: gear.id }).ok, false, 'retry cannot duplicate');
    ok('stashWithdraw', { itemId: gear.id }); assert.deepEqual(f.save.inventory.find(i => i?.id === gear.id), before);
    f.near('obelisk'); ok('riftOpen', { difficulty: 0 }); ok('riftEnter'); ok('leave');
  } finally { await f.world.shutdown(); }
});

test('solid walls block service access even inside interaction radius; travel checks destination and rift portal', async () => {
  const f = await fixture();
  try {
    const inst = f.s.rec!.inst as Instance, n = inst.map.town!.npcs.find(n => n.role === 'stash')!;
    // The old recess back wall is now an open Inn doorway. Exercise a real remaining solid wall.
    const collision=new CollisionWorld(inst.map),target=inst.map.town!.buildings.find(b=>b.id==='inn')!.interior!.target;
    const wall=collision.town!.edges.find(e=>{
      const x=(e.ax+e.bx)/2,y=(e.ay+e.by)/2;
      return Math.hypot(x-target[0],y-target[1])<300&&collision.isFree(x+e.nx*32,y+e.ny*32,16)&&collision.segmentBlocked(x+e.nx*32,y+e.ny*32,x-e.nx*32,y-e.ny*32);
    });
    assert.ok(wall,'a reachable solid wall is required for this authority check');
    const wx=(wall.ax+wall.bx)/2,wy=(wall.ay+wall.by)/2;
    n.x=wx-wall.nx*32;n.y=wy-wall.ny*32;
    f.at(wx+wall.nx*32,wy+wall.ny*32);
    assert.ok(64<n.interactionRadius,'failure must come from the wall, not distance');
    assert.match(f.cmd('stashDeposit', { itemId: 'fake' }).err!, /Stand beside/);
    f.near('paragon'); assert.match(f.cmd('travel', { zone: 'whispering_glade' }).err!, /Stand beside/);
    const p = inst.map.portals.find(p => p.to === 'whispering_glade')!; f.at(p.x, p.y);
    assert.equal(f.cmd('travel', { zone: 'ashen_hollow' }).ok, false, 'wrong exit rejected');
    assert.equal(f.cmd('travel', { zone: 'whispering_glade' }).ok, true); f.cmd('leave');
    f.near('obelisk'); assert.equal(f.cmd('riftOpen', { difficulty: 0 }).ok, true);
    f.near('paragon'); assert.match(f.cmd('riftEnter').err!, /Stand beside/);
    const town = f.s.rec!.inst as Instance, portal = town.portals.find(p => p.kind === 'portal')!;
    assert.ok(portal); f.at(portal.x, portal.y); assert.equal(f.cmd('riftEnter').ok, true);
  } finally { await f.world.shutdown(); }
});

test('stash migration, capacity, full inventory, retries, duplicates and save/reload preserve items', async () => {
  ensureDataDir(); const save = createCharacter('StashSave', 'warrior', 4);
  const legacy = structuredClone(save) as Partial<CharacterSave>; delete legacy.stash;
  const migrated = normalizeSave(legacy as CharacterSave); assert.equal(migrated.stash.length, 60); assert.deepEqual(migrated.equipment, save.equipment);
  const i = generateItem(new Rng(3), { ilvl: 70, classId: 'warrior', rarity: 'rare' }); save.inventory[0] = i;
  assert.equal(transferStash(save, i.id, true), null); assert.equal(transferStash(save, i.id, true), 'Item not in inventory');
  await saveCharacter(save); const loaded = (await loadCharacter(save.id))!; assert.deepEqual(loaded.stash[0], i); assert.equal(loaded.inventory[0], null);
  loaded.inventory.fill({ ...i, id: 'full' }); assert.equal(transferStash(loaded, i.id, false), 'Your inventory is full'); assert.deepEqual(loaded.stash[0], i);
  loaded.inventory.fill(null); assert.equal(transferStash(loaded, i.id, false), null);
  loaded.stash.fill({ ...i, id: 'occupied' }); assert.equal(transferStash(loaded, i.id, true), 'Your stash is full');
  loaded.stash.fill(null); loaded.stash[0] = i; assert.match(transferStash(loaded, i.id, true)!, /Duplicate/);
  loaded.stash[60] = { ...i, id: 'overflow' }; assert.ok(normalizeSave(loaded).stash[60], 'migration never truncates owned items');
});
