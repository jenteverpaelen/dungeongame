// Monster death consequences: XP (shared within range), personal loot, rift progress, Hellforge, life per kill,
// elite / skill death hooks, goblin and guardian specials.

import { monsterXp, type Element } from '../shared';
import { XP_MULT, XP_SHARE_RANGE } from '../config';
import { healPlayer, isEliteTier } from './damage';
import { addBuff, elIdx } from './effects';
import { eliteOnDeath } from './elites';
import type { Instance } from './instance';
import { dropForMob } from './loot';
import { grantXp, touchChar } from './players';
import { skillDeathHooks } from './skills';
import type { Mob, Player } from './types';

/** A pack member left the world (killed, escaped, despawned). */
export function packMemberGone(inst: Instance, m: Mob) {
  if (!m.pack) return;
  m.pack.alive--;
  if (m.pack.alive <= 0) inst.spawner.onPackCleared(m.pack);
  m.pack = null;
}

export function killMob(inst: Instance, m: Mob, killer: Player | null, el: Element, skill: string) {
  if (m.dead || m.dummy) return;
  inst.removeMob(m);
  inst.flushDmg(m.id);
  m.hp = 0;
  const big = m.tier === 1 || m.tier === 2 || m.tier === 4 || m.tier === 5;
  inst.emit({ e: 'die', t: m.id, el: elIdx(el), x: Math.round(m.x), y: Math.round(m.y), ...(big ? { big: 1 as const } : {}) }, m.x, m.y, killer?.id ?? 0);
  inst.counters.kills++;
  if (isEliteTier(m.tier)) inst.counters.eliteKills++;
  packMemberGone(inst, m);

  skillDeathHooks(inst, m, killer, skill);
  eliteOnDeath(inst, m);

  const witnesses = inst.playersNear(m.x, m.y, XP_SHARE_RANGE);
  if (killer && killer.deadMs <= 0 && inst.playerById(killer.id) && !witnesses.includes(killer)) witnesses.push(killer);
  const eliteKill = isEliteTier(m.tier);
  const riftGuardian = m.tier === 4 && inst.rift && inst.rift.guardian === m.id;
  for (const p of witnesses) {
    const xp = monsterXp(m.level, m.tier, m.diff) * (1 + p.ctx.d.xpPct / 100) * XP_MULT;
    p.save.stats.kills++;
    p.kills++;
    if (eliteKill) p.save.stats.elites++;
    grantXp(inst, p, xp);
    if (!m.noReward && !riftGuardian) dropForMob(inst, p, m);
    if (p === killer) {
      if (p.ctx.d.lifePerKill > 0) healPlayer(inst, p, p.ctx.d.lifePerKill, true);
      const hf = p.ctx.power('hellforge_talisman');
      if (hf && eliteKill) addBuff(p, { id: 'hellforge', ms: 30000, dmg: hf });
    }
    touchChar(p);
  }
  if (m.tier === 5) for (const p of inst.playersNear(m.x, m.y, 1600)) inst.emitTo(p.id, { e: 'notice', text: 'Treasure Goblin slain!', kind: 'info' });
  if (inst.rift) inst.rift.onKill(m, killer);
}
