// Ground effects: Meteor's molten ground, Black Hole, Rain of Vengeance, and hostile molten trails / poison pools.

import { PLAYER_RADIUS } from '../shared';
import { mobWeight } from './brain';
import { damagePlayer, dotStrike, strikeMob } from './damage';
import { dragMob, elIdx, freezeMob } from './effects';
import type { Instance } from './instance';
import type { Ground } from './types';

export function addGround(inst: Instance, g: Ground) {
  inst.grounds.push(g);
}

export function newGround(kind: Ground['kind'], x: number, y: number, r: number, startT: number, durMs: number, tickMs: number): Ground {
  return {
    kind, x, y, r, endT: startT + durMs, tickMs, nextT: startT + tickMs, owner: null, strike: null, dmg: 0, mobLevel: 1,
    waves: 0, follow: false, freeze: false, spellsteal: false, voidPct: 0, caught: null, el: 'physical',
  };
}

export function updateGrounds(inst: Instance, dtMs: number) {
  const list = inst.grounds;
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    if (g.endT <= 0) continue;
    switch (g.kind) {
      case 'molten': molten(inst, g); break;
      case 'blackhole': blackhole(inst, g, dtMs); break;
      case 'rain': rain(inst, g); break;
      case 'trail':
      case 'pool': hostile(inst, g); break;
    }
    if (inst.t >= g.endT) {
      if (g.kind === 'blackhole') collapse(inst, g);
      g.endT = 0;
    }
  }
  let w = 0;
  for (let r = 0; r < list.length; r++) if (list[r].endT > 0) list[w++] = list[r];
  list.length = w;
}

function molten(inst: Instance, g: Ground) {
  if (inst.t < g.nextT) return;
  g.nextT += g.tickMs;
  const p = g.owner;
  if (!p || !g.strike) return;
  for (const m of inst.queryMobs(g.x, g.y, g.r)) {
    if (m.dead) continue;
    dotStrike(inst, p, m, g.dmg, g.el, g.strike.skill);
  }
}

function blackhole(inst: Instance, g: Ground, dtMs: number) {
  const p = g.owner;
  if (!p || !g.strike) return;
  const inside = inst.queryMobs(g.x, g.y, g.r);
  const step = 260 * (dtMs / 1000);
  for (const m of inside) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - g.x, m.y - g.y);
    if (d > 12) dragMob(inst, m, g.x, g.y, Math.min(step, d - 10));
    if (g.voidPct > 0) { m.holeMs = 200; m.holePct = g.voidPct; }
    if (g.caught && g.caught.size < 40) g.caught.add(m.id);
  }
  if (inst.t >= g.nextT) {
    g.nextT += g.tickMs;
    for (const m of inside) if (!m.dead) strikeMob(inst, p, m, g.strike);
  }
}

function collapse(inst: Instance, g: Ground) {
  const p = g.owner;
  if (!p) return;
  if (g.freeze) {
    for (const m of inst.queryMobs(g.x, g.y, g.r)) if (!m.dead) freezeMob(m, 1500);
    inst.emit({ e: 'aoe', v: 'nova', x: Math.round(g.x), y: Math.round(g.y), r: Math.round(g.r), d: 450, el: elIdx('cold'), s: p.id }, g.x, g.y, p.id);
  }
}

function rain(inst: Instance, g: Ground) {
  if (inst.t < g.nextT || g.waves <= 0) return;
  g.nextT += g.tickMs;
  g.waves--;
  const p = g.owner;
  if (!p || !g.strike) return;
  if (g.follow) {
    // recentre on the densest pack within 300
    let best = -1, bx = g.x, by = g.y;
    const cands = inst.queryMobs(g.x, g.y, 300);
    for (let i = 0; i < cands.length; i += Math.max(1, Math.ceil(cands.length / 12))) {
      const c = cands[i];
      let s = 0;
      for (const m of cands) if ((m.x - c.x) ** 2 + (m.y - c.y) ** 2 <= g.r * g.r) s += mobWeight(m);
      if (s > best) { best = s; bx = c.x; by = c.y; }
    }
    if (best > 0) { g.x += (bx - g.x) * 0.6; g.y += (by - g.y) * 0.6; }
  }
  inst.emit({ e: 'aoe', v: 'rain', x: Math.round(g.x), y: Math.round(g.y), r: Math.round(g.r), d: Math.round(g.tickMs + 120), el: elIdx(g.el), s: p.id }, g.x, g.y, p.id);
  for (const m of inst.queryMobs(g.x, g.y, g.r)) if (!m.dead) strikeMob(inst, p, m, g.strike);
}

function hostile(inst: Instance, g: Ground) {
  if (inst.t < g.nextT) return;
  g.nextT += g.tickMs;
  for (const p of inst.players) {
    if (p.deadMs > 0) continue;
    const rr = g.r + PLAYER_RADIUS * 0.5;
    if ((p.x - g.x) ** 2 + (p.y - g.y) ** 2 > rr * rr) continue;
    damagePlayer(inst, p, g.dmg, g.el, null, g.mobLevel);
  }
}

