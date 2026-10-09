// Elite affixes (ARCHITECTURE 1.6): fast, extra health, molten, frozen, plagued, electrified, vortex, mortar.

import { ELITE_AFFIXES, ELITE_PREFIX, ELITE_SUFFIX, PLAYER_RADIUS, type Rng } from '../shared';
import { damagePlayer } from './damage';
import { elIdx, freezePlayer, pullPlayer } from './effects';
import { addGround, newGround } from './grounds';
import type { Instance } from './instance';
import { spawnProj } from './projectiles';
import type { Mob, Player } from './types';
import { fractureLine } from './fracture';

// New traits are authored first; adding one must not silently alter old random pools.
export const AFFIX_IDS = Object.keys(ELITE_AFFIXES).filter(id=>id!=='faulted');

export function rollEliteAffixes(rng: Rng, n: number): string[] {
  const pool = [...AFFIX_IDS];
  rng.shuffle(pool);
  return pool.slice(0, Math.min(n, pool.length));
}

export function eliteName(rng: Rng): string {
  return rng.pick(ELITE_PREFIX) + rng.pick(ELITE_SUFFIX);
}

function hurtPlayersIn(inst: Instance, m: Mob, x: number, y: number, r: number, dmg: number, el: 'fire' | 'cold' | 'poison' | 'lightning' | 'arcane', freezeMs = 0) {
  for (const q of inst.players) {
    if (q.deadMs > 0) continue;
    if (Math.hypot(q.x - x, q.y - y) > r + PLAYER_RADIUS) continue;
    const taken = damagePlayer(inst, q, dmg, el, m, m.level);
    if (taken > 0 && freezeMs) freezePlayer(q, freezeMs);
  }
}

/** Affix abilities while the elite is fighting `p`. */
export function eliteTick(inst: Instance, m: Mob, p: Player, dtMs: number) {
  const a = m.aff;
  const dist = Math.hypot(p.x - m.x, p.y - m.y);
  if (dist > 950) return;
  for (const id of m.affixes) {
    switch (id) {
      case 'faulted':
        a.faulted-=dtMs;
        if(a.faulted<=0){a.faulted=3000;fractureLine(inst,m,p.x,p.y,650,m.dmg*.7,'fire');}
        break;
      case 'molten':
        a.molten -= dtMs;
        if (a.molten <= 0) {
          a.molten = 500;
          if (Math.hypot(m.x - m.trailX, m.y - m.trailY) < 24) break;
          m.trailX = m.x; m.trailY = m.y;
          const g = newGround('trail', m.x, m.y, 34, inst.t, 1500, 250);
          g.dmg = m.dmg * 0.1;
          g.mobLevel = m.level;
          g.el = 'fire';
          addGround(inst, g);
          inst.emit({ e: 'aoe', v: 'molten_trail', x: Math.round(m.x), y: Math.round(m.y), r: 34, d: 1500, el: elIdx('fire'), s: m.id }, m.x, m.y);
        }
        break;
      case 'frozen':
        a.frozen -= dtMs;
        if (a.frozen <= 0) {
          a.frozen = 5000;
          const n = 2 + (inst.rng.next() < 0.5 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const ang = inst.rng.next() * Math.PI * 2, d = 40 + inst.rng.next() * 130;
            const x = p.x + Math.cos(ang) * d, y = p.y + Math.sin(ang) * d;
            inst.emit({ e: 'tele', v: 'frozen_orb', x: Math.round(x), y: Math.round(y), r: 85, d: 1500 }, x, y);
            const dmg = m.dmg * 0.9;
            inst.sched.schedule(inst.t + 1500, () => {
              inst.emit({ e: 'aoe', v: 'nova', x: Math.round(x), y: Math.round(y), r: 85, d: 400, el: elIdx('cold'), s: m.id }, x, y);
              hurtPlayersIn(inst, m, x, y, 85, dmg, 'cold', 1000);
            });
          }
        }
        break;
      case 'plagued':
        a.plagued -= dtMs;
        if (a.plagued <= 0) {
          a.plagued = 4000;
          const g = newGround('pool', p.x, p.y, 80, inst.t, 4000, 250);
          g.nextT = inst.t + 500; // a moment to step out
          g.dmg = m.dmg * 0.12;
          g.mobLevel = m.level;
          g.el = 'poison';
          addGround(inst, g);
          inst.emit({ e: 'aoe', v: 'poison_pool', x: Math.round(p.x), y: Math.round(p.y), r: 80, d: 4000, el: elIdx('poison'), s: m.id }, p.x, p.y);
        }
        break;
      case 'vortex':
        a.vortex -= dtMs;
        if (a.vortex <= 0) {
          if (dist > m.r + 90 && dist < 650 && inst.t - p.lastVortexT > 3000 && p.invulnMs <= 0) {
            a.vortex = 8000;
            p.lastVortexT = inst.t;
            inst.emit({ e: 'beam', v: 'vortex', x: Math.round(m.x), y: Math.round(m.y), tx: Math.round(p.x), ty: Math.round(p.y), el: elIdx('arcane'), d: 450 }, p.x, p.y, p.id);
            pullPlayer(inst, p, m.x, m.y, m.r + PLAYER_RADIUS + 18);
            m.atkCdMs = Math.min(m.atkCdMs, 250);
          } else a.vortex = 600;
        }
        break;
      case 'mortar':
        a.mortar -= dtMs;
        if (a.mortar <= 0) {
          if (dist > 140) {
            a.mortar = 3000;
            for (let i = 0; i < 3; i++) {
              const ang = inst.rng.next() * Math.PI * 2, d = inst.rng.next() * 110;
              const x = p.x + Math.cos(ang) * d, y = p.y + Math.sin(ang) * d;
              inst.emit({ e: 'tele', v: 'mortar', x: Math.round(x), y: Math.round(y), r: 75, d: 900 + i * 120 }, x, y);
              const dmg = m.dmg * 0.7;
              inst.sched.schedule(inst.t + 900 + i * 120, () => {
                inst.emit({ e: 'aoe', v: 'explode', x: Math.round(x), y: Math.round(y), r: 75, d: 350, el: elIdx('fire'), s: m.id }, x, y);
                hurtPlayersIn(inst, m, x, y, 75, dmg, 'fire');
              });
            }
          } else a.mortar = 500;
        }
        break;
    }
  }
}

/** Electrified: taking damage may release sparks. */
export function onEliteDamaged(inst: Instance, m: Mob, attacker: Player | null, dot: boolean) {
  if (dot || m.aff.electrified > 0 || !m.affixes.includes('electrified')) return;
  if (inst.rng.next() >= 0.15) return;
  m.aff.electrified = 400;
  const base = inst.rng.next() * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    spawnProj(inst, {
      kind: 'spark', v: 'spark', mob: m, src: m.id, x: m.x, y: m.y - 10, angle: base + (i * Math.PI * 2) / 3, speed: 230, lifeMs: 1800,
      r: 10, el: 'lightning', dmg: m.dmg * 0.45, mobLevel: m.level,
    });
  }
}

/** Molten elites explode 1.2 s after death. */
export function eliteOnDeath(inst: Instance, m: Mob) {
  if (!m.affixes.includes('molten')) return;
  const x = m.x, y = m.y;
  inst.emit({ e: 'tele', v: 'molten_death', x: Math.round(x), y: Math.round(y), r: 120, d: 1200 }, x, y);
  const dmg = m.dmg * 1.6;
  inst.sched.schedule(inst.t + 1200, () => {
    inst.emit({ e: 'aoe', v: 'explode', x: Math.round(x), y: Math.round(y), r: 120, d: 450, el: elIdx('fire'), s: m.id }, x, y);
    for (const q of inst.playersNear(x, y, 450)) inst.emitTo(q.id, { e: 'shake', m: 4, d: 160 });
    hurtPlayersIn(inst, m, x, y, 120, dmg, 'fire');
  });
}
