// Monster death consequences: XP, loot, rift progress, affix and skill death hooks.

import { monsterXp, type Element } from '../shared';
import type { Instance } from '../instance';
import { XP_MULT, XP_SHARE_RANGE } from '../config';
import { addBuff } from './effects';
import { elIdx } from './effects';
import { eliteOnDeath } from './elites';
import { dropFor } from './loot';
import { healPlayer } from './damage';
import { grantXp, touchChar } from './players';
import { riftOnKill } from './rift';
import { skillDeathHooks } from './skills/hooks';
import type { Mob, Player } from './types';

export function killMob(inst: Instance, m: Mob, killer: Player | null, el: Element, skill: string) {
  if (m.dead) return;
  m.dead = true;
  m.hp = 0;
  m.flags = 0;
  inst.removeMob(m);
  inst.emit({ e: 'die', t: m.id, el: elIdx(el), x: Math.round(m.x), y: Math.round(m.y), ...(m.tier !== 0 && m.tier !== 3 ? { big: 1 as const } : {}) }, m.x, m.y, killer?.id ?? 0);
  if (m.suicide) return;

  const witnesses = inst.playersNear(m.x, m.y, XP_SHARE_RANGE).filter((p) => p.deadMs <= 0);
  if (killer && !witnesses.includes(killer) && killer.inst === inst && killer.deadMs <= 0) witnesses.push(killer);
  const eliteKill = m.tier === 1 || m.tier === 2 || m.tier === 4;

  for (const p of witnesses) {
    const xp = monsterXp(m.level, m.tier, inst.difficulty) * (1 + p.ctx.d.xpPct / 100) * XP_MULT;
    p.save.stats.kills++;
    if (eliteKill) p.save.stats.elites++;
    grantXp(inst, p, xp);
    if (m.tier !== 4) dropFor(inst, p, m);
    if (p === killer) {
      if (p.ctx.d.lifePerKill > 0) healPlayer(inst, p, p.ctx.d.lifePerKill, true);
      const hf = p.ctx.power('hellforge_talisman');
      if (hf && eliteKill) addBuff(p, { id: 'hellforge', ms: 30000, dmg: hf });
    }
    touchChar(p);
  }

  eliteOnDeath(inst, m);
  skillDeathHooks(inst, m, killer, skill);
  riftOnKill(inst, m, killer, witnesses);
}
