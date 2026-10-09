// Personal loot (ARCHITECTURE 1.8): drops are rolled per eligible player with rollDrops(), scattered in a
// D3-style fountain around the corpse, visible to and collectable by their owner only.

import { recordIntro } from '../../../shared/src/onboarding';
import {
  DIFFICULTIES, ITEM_PICKUP_RADIUS, MAGNET_RADIUS, addToInventory, gemName, goldAmount, rollDrops, type Drop, type EliteTier,
  type LootView,
} from '../shared';
import { LOOT_TTL_MS } from '../config';
import { healPlayer } from './damage';
import { nextId } from './ids';
import type { Instance } from './instance';
import { touchChar } from './players';
import { GLOBE_HEAL, GLOBE_RADIUS } from './tuning';
import type { Loot, LootPayload, Mob, Player } from './types';
import { creditQuestPickup } from '../quests';

function viewOf(pl: LootPayload): LootView {
  switch (pl.type) {
    case 'item': {
      const it = pl.item;
      return { lk: 'item', name: it.name, rarity: it.rarity, ancient: it.ancient, look: it.look, kind: it.kind };
    }
    case 'gold': return { lk: 'gold', name: 'Gold', amount: pl.amount };
    case 'gem': return { lk: 'gem', name: gemName(pl.gem, pl.rank), gem: `${pl.gem}:${pl.rank}`, amount: pl.rank };
    case 'mat': return { lk: 'mat', name: "Death's Breath", amount: pl.amount };
    case 'globe': return { lk: 'globe', name: 'Health Globe' };
  }
}

/** Create one ground-loot entity owned by `p`, scattered 30-90 units around (x, y) (D3 loot fountain). */
export function spawnLoot(inst: Instance, p: Player, payload: LootPayload, x: number, y: number, scatter = true): Loot {
  let lx = x, ly = y;
  if (scatter) {
    for (let i = 0; i < 8; i++) {
      const a = inst.rng.next() * Math.PI * 2, d = 30 + inst.rng.next() * 60;
      const tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d;
      if (inst.cw.isFree(tx, ty, 8)) { lx = tx; ly = ty; break; }
    }
  }
  const loot: Loot = {
    kind: 'loot', id: nextId(), owner: p, payload, view: viewOf(payload), x: lx, y: ly, ttlMs: LOOT_TTL_MS,
    armMs: payload.type === 'item' ? 500 : 450, dead: false,
  };
  p.loot.add(loot);
  inst.counters.lootSpawned++;
  return loot;
}

function payloadOf(d: Drop, difficulty: number): LootPayload {
  switch (d.type) {
    case 'item': return { type: 'item', item: d.item };
    case 'gold': return { type: 'gold', amount: Math.round(d.amount * (1 + DIFFICULTIES[difficulty].goldBonus / 100)) };
    case 'gem': return { type: 'gem', gem: d.gem, rank: d.rank };
    case 'mat': return { type: 'mat', mat: d.mat, amount: d.amount };
    case 'globe': return { type: 'globe' };
  }
}

/** Roll and spawn the drops of one monster for one player. */
export function dropFor(inst: Instance, p: Player, x: number, y: number, level: number, tier: EliteTier, difficulty = inst.difficulty) {
  const { drops, pity } = rollDrops(inst.lootRng, {
    level, difficulty, elite: tier, classId: p.save.classId,
    magicFind: 0, pity: p.save.lootPity ?? 0, inRift: inst.kind === 'rift',
  }, p.ctx.d.goldFind);
  p.save.lootPity = pity;
  for (const d of drops) {
    spawnLoot(inst, p, payloadOf(d, difficulty), x, y);
    if (d.type === 'item' && (d.item.rarity === 'legendary' || d.item.rarity === 'set')) {
      const prefix = d.item.ancient === 2 ? 'Primal Ancient ' : d.item.ancient === 1 ? 'Ancient ' : '';
      inst.emitTo(p.id, { e: 'notice', text: `${prefix}${d.item.name}`, kind: 'legendary' });
    }
  }
}

export function dropForMob(inst: Instance, p: Player, m: Mob) {
  dropFor(inst, p, m.x, m.y, m.level, m.tier, m.diff);
}

/** Gold pile spilled by a treasure goblin while being hit. */
export function dropGoldPile(inst: Instance, p: Player, m: Mob) {
  const amount = Math.round(goldAmount(inst.lootRng, m.level, p.ctx.d.goldFind) * 0.6 * (1 + DIFFICULTIES[m.diff].goldBonus / 100));
  spawnLoot(inst, p, { type: 'gold', amount: Math.max(1, amount) }, m.x, m.y);
}

export function clearPlayerLoot(p: Player) {
  p.loot.clear();
}

/** Per tick: lifetime, magnet pickup (gold / gems / materials / globes) and walk-over item pickup. */
export function updateLoot(inst: Instance, p: Player, dtMs: number) {
  if (p.loot.size === 0) return;
  const magnet = MAGNET_RADIUS + p.ctx.d.pickup;
  for (const l of p.loot) {
    l.ttlMs -= dtMs;
    if (l.ttlMs <= 0) { p.loot.delete(l); continue; }
    if (l.armMs > 0) { l.armMs -= dtMs; continue; }
    if (p.deadMs > 0) continue;
    const dx = l.x - p.x, dy = l.y - p.y;
    const d2 = dx * dx + dy * dy;
    const pl = l.payload;
    if (pl.type === 'item') {
      const rr = ITEM_PICKUP_RADIUS + p.r;
      if (d2 > rr * rr) continue;
      if (addToInventory(p.save, pl.item) < 0) {
        if (inst.t - p.noticeFullAt > 4000) { p.noticeFullAt = inst.t; inst.emitTo(p.id, { e: 'notice', text: 'Inventory is full', kind: 'warn' }); }
        continue;
      }
      if (pl.item.rarity === 'legendary' || pl.item.rarity === 'set') p.save.stats.legendaries++;
      creditQuestPickup(inst,p,pl.item);
      recordIntro(p.save,'loot');
      touchChar(p);
      inst.emit({ e: 'pickup', t: p.id, l: l.id, lk: 'item', name: pl.item.name, rarity: pl.item.rarity }, l.x, l.y, p.id);
      p.loot.delete(l);
      inst.counters.lootPicked++;
      continue;
    }
    if (d2 > magnet * magnet) continue;
    switch (pl.type) {
      case 'gold':
        p.save.gold += pl.amount;
        inst.emit({ e: 'pickup', t: p.id, l: l.id, lk: 'gold', name: 'Gold', amount: pl.amount }, l.x, l.y, p.id);
        break;
      case 'gem': {
        const key = `${pl.gem}:${pl.rank}`;
        p.save.gems[key] = (p.save.gems[key] ?? 0) + 1;
        inst.emit({ e: 'pickup', t: p.id, l: l.id, lk: 'gem', name: l.view.name, amount: 1 }, l.x, l.y, p.id);
        break;
      }
      case 'mat':
        p.save.materials[pl.mat] += pl.amount;
        inst.emit({ e: 'pickup', t: p.id, l: l.id, lk: 'mat', name: l.view.name, amount: pl.amount }, l.x, l.y, p.id);
        break;
      case 'globe':
        for (const o of inst.playersNear(l.x, l.y, GLOBE_RADIUS)) healPlayer(inst, o, o.mhp * GLOBE_HEAL, false);
        if (Math.hypot(l.x - p.x, l.y - p.y) > GLOBE_RADIUS) healPlayer(inst, p, p.mhp * GLOBE_HEAL, false);
        inst.emit({ e: 'pickup', t: p.id, l: l.id, lk: 'globe', name: 'Health Globe' }, l.x, l.y, p.id);
        break;
    }
    touchChar(p);
    p.loot.delete(l);
    inst.counters.lootPicked++;
  }
}
