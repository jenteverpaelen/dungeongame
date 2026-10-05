// Player entities: creation, input & movement (shared stepMove), timers, regeneration, resources,
// death & respawn, XP / level-ups and stat refreshes.

import type { PlayerLink } from '../contracts';
import {
  CLASSES, DASH, PLAYER_RADIUS, TICK_MS, addXp, computeStats, setSkillSlot, skillsForClass, stepMove, type Element,
} from '../shared';
import { OURO_CYCLE, healPlayer, talStacks } from './damage';
import { addBuff, elIdx, getBuff, refreshLive, removeBuff, tickBuffs } from './effects';
import { nextId } from './ids';
import type { Instance } from './instance';
import { updateLoot } from './loot';
import { buildCtx } from './playerctx';
import { FURY_DECAY_DELAY_MS, OOC_REGEN_DELAY_MS, OOC_REGEN_PCT, RESPAWN_MS } from './tuning';
import type { Player, SaveX } from './types';

export function touchChar(p: Player) {
  p.link.markDirty();
}

function freeSpot(inst: Instance, x: number, y: number): { x: number; y: number } {
  if (inst.cw.isFree(x, y, PLAYER_RADIUS)) return { x, y };
  for (let ring = 1; ring <= 6; ring++) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const tx = x + Math.cos(a) * ring * 24, ty = y + Math.sin(a) * ring * 24;
      if (inst.cw.isFree(tx, ty, PLAYER_RADIUS)) return { x: tx, y: ty };
    }
  }
  return { x: inst.map.entry.x, y: inst.map.entry.y };
}

export function addPlayerEntity(inst: Instance, link: PlayerLink, at: { x: number; y: number }): Player {
  const save = link.save as SaveX;
  const d = computeStats(save);
  link.derived = d;
  const ctx = buildCtx(save, d);
  const pos = freeSpot(inst, at.x, at.y);
  const isFury = CLASSES[save.classId].resource.id === 'fury';
  const p: Player = {
    kind: 'player', id: nextId(), link, save, name: save.name, ctx,
    x: pos.x, y: pos.y, r: PLAYER_RADIUS, hCell: -1, hIdx: -1,
    mv: { x: pos.x, y: pos.y, dashMs: 0, dashDx: 0, dashDy: 0, dashCdMs: 0, faceX: 1, faceY: 0 },
    hp: d.life, mhp: d.life, res: isFury ? 0 : d.maxResource, mres: d.maxResource,
    flags: 0, attackSeq: 0, descVer: 1,
    inQ: [], lastIn: { mx: 0, my: 0 }, ack: 0,
    faceLeft: false, moving: false, faceLockMs: 0,
    atkCdMs: 0, readyAt: new Map(), attackFlagMs: 0, castFlagMs: 0,
    buffs: [], live: { dmg: 0, chc: 0, chd: 0, ias: 0 },
    summons: [], channel: null,
    deadMs: 0, stunMs: 0, frozenMs: 0, invulnMs: 1500,
    sinceHitMs: 1e9, sinceHurtMs: 1e9,
    loot: new Set(), known: new Map(), lohSeen: new Map(),
    lastEle: {}, ouroIdx: 0, ouroMs: 4000, noticeFullAt: -1e9,
    critHealMs: 0, critHealCount: 0, dealt: 0, kills: 0,
    ffTile: -1, ffT: -1e9, ff: null, ffX0: 0, ffY0: 0,
    lastVortexT: -1e9, respawnTick: -1, taken: 0,
  };
  return p;
}

export function removePlayerEntity(inst: Instance, p: Player) {
  for (const s of p.summons) s.dead = true;
  p.summons.length = 0;
  for (const pr of inst.projs) if (pr.owner === p) pr.dead = true;
  for (const g of inst.grounds) if (g.owner === p) g.endT = 0;
}

/** Rebuild derived stats + skill config after any save change. */
export function refreshPlayerStats(inst: Instance, p: Player, keepFraction: boolean) {
  const save = p.save;
  const frac = p.mhp > 0 ? p.hp / p.mhp : 1;
  const d = computeStats(save);
  p.link.derived = d;
  p.ctx = buildCtx(save, d);
  p.mhp = d.life;
  if (p.deadMs <= 0) p.hp = keepFraction ? Math.max(1, frac * p.mhp) : p.mhp;
  p.mres = d.maxResource;
  p.res = Math.min(p.res, p.mres);
  p.descVer++;
  // Drop state belonging to skills that are no longer slotted.
  const has = (id: string) => !!p.ctx.slotted(id);
  for (const s of p.summons) {
    if (s.type === 'dust_devil') continue;
    if (!has(s.skill)) s.dead = true;
  }
  if (p.channel && !has(p.channel.skill)) p.channel = null;
  for (const b of ['battle_rage', 'magic_weapon']) if (!has(b) && getBuff(p, b)) removeBuff(p, b);
  if (!p.ctx.power('ouroboros_loop')) for (const b of [...p.buffs]) if (b.id.startsWith('ouroboros_')) removeBuff(p, b.id);
  if (!p.ctx.power('hellforge_talisman')) removeBuff(p, 'hellforge');
  refreshLive(p);
}

// ─────────────────────────── Movement ───────────────────────────

export function processInputs(inst: Instance, p: Player) {
  const blocked = p.deadMs > 0 || p.frozenMs > 0 || p.stunMs > 0;
  const msPct = p.ctx.d.ms;
  const dashCd = p.ctx.dashCdMs;
  const x0 = p.mv.x, y0 = p.mv.y;
  let steps = 0;
  if (p.inQ.length) {
    while (steps < 2 && p.inQ.length) {
      const inp = p.inQ.shift()!;
      p.lastIn.mx = inp.mx; p.lastIn.my = inp.my;
      const sx = p.mv.x, sy = p.mv.y;
      const dashed = stepMove(inst.cw, p.mv, inp, msPct, dashCd, TICK_MS, PLAYER_RADIUS, blocked);
      if (dashed) onDash(inst, p, sx, sy);
      p.ack = inp.seq;
      steps++;
    }
  } else {
    stepMove(inst.cw, p.mv, { mx: p.lastIn.mx, my: p.lastIn.my, dash: false }, msPct, dashCd, TICK_MS, PLAYER_RADIUS, blocked);
  }
  p.x = p.mv.x; p.y = p.mv.y;
  const moved = Math.abs(p.x - x0) + Math.abs(p.y - y0);
  p.moving = moved > 0.5;
  if (p.faceLockMs <= 0 && Math.abs(p.lastIn.mx) > 0.05 && !blocked) p.faceLeft = p.lastIn.mx < 0;
}

function onDash(inst: Instance, p: Player, sx: number, sy: number) {
  p.invulnMs = Math.max(p.invulnMs, DASH.invulnMs);
  const tx = sx + p.mv.dashDx * DASH.distance, ty = sy + p.mv.dashDy * DASH.distance;
  inst.emit({ e: 'dash', t: p.id, x: Math.round(sx), y: Math.round(sy), tx: Math.round(tx), ty: Math.round(ty) }, sx, sy, p.id);
  const sw = p.ctx.power('stridewind');
  if (sw) addBuff(p, { id: 'stridewind', ms: 3000, dmg: sw });
  if (Math.abs(p.mv.dashDx) > 0.1) p.faceLeft = p.mv.dashDx < 0;
}

// ─────────────────────────── Per-tick timers / regeneration ───────────────────────────

export function playerTick(inst: Instance, p: Player, dtMs: number) {
  if (p.deadMs > 0) {
    p.deadMs -= dtMs;
    if (p.deadMs <= 0) respawn(inst, p);
    updateLoot(inst, p, dtMs);
    return;
  }
  const dt = dtMs / 1000;
  if (p.invulnMs > 0) p.invulnMs -= dtMs;
  if (p.stunMs > 0) p.stunMs -= dtMs;
  if (p.frozenMs > 0) p.frozenMs -= dtMs;
  if (p.attackFlagMs > 0) p.attackFlagMs -= dtMs;
  if (p.castFlagMs > 0) p.castFlagMs -= dtMs;
  if (p.faceLockMs > 0) p.faceLockMs -= dtMs;
  if (p.critHealMs > 0) p.critHealMs -= dtMs;
  p.sinceHitMs += dtMs;
  p.sinceHurtMs += dtMs;
  tickBuffs(p, dtMs);

  // Ouroboros Loop: element rotates every 4 s.
  const ouro = p.ctx.power('ouroboros_loop');
  if (ouro) {
    p.ouroMs -= dtMs;
    if (p.ouroMs <= 0) {
      removeBuff(p, `ouroboros_${OURO_CYCLE[p.ouroIdx]}`);
      p.ouroIdx = (p.ouroIdx + 1) % OURO_CYCLE.length;
      p.ouroMs += 4000;
    }
    const id = `ouroboros_${OURO_CYCLE[p.ouroIdx]}`;
    const b = getBuff(p, id);
    if (b) b.ms = p.ouroMs; else addBuff(p, { id, ms: p.ouroMs });
  }
  // Fallen Star 4pc: show the element stacks as a buff.
  if (p.ctx.setCount('fallen_star') >= 4) {
    const n = talStacks(inst, p, null);
    const b = getBuff(p, 'fallen_star');
    if (n > 0) {
      let oldest = Infinity;
      for (const e of ['arcane', 'cold', 'fire', 'lightning']) {
        const at = p.lastEle[e];
        if (at !== undefined && inst.t - at <= 8000) oldest = Math.min(oldest, at);
      }
      const ms = Math.max(0, 8000 - (inst.t - oldest));
      if (b) { b.st = n; b.ms = ms; } else addBuff(p, { id: 'fallen_star', ms, st: n });
    } else if (b) removeBuff(p, 'fallen_star');
  }

  // Life: regeneration affixes + out-of-combat regeneration.
  let regen = p.ctx.d.lifeRegen;
  if (p.sinceHurtMs >= OOC_REGEN_DELAY_MS) regen += p.mhp * OOC_REGEN_PCT;
  if (regen > 0 && p.hp < p.mhp) p.hp = Math.min(p.mhp, p.hp + regen * dt);

  // Resource
  const cls = CLASSES[p.save.classId].resource;
  let rr = p.ctx.d.resourceRegen;
  for (const s of p.summons) if (s.type === 'bat' && !s.dead) rr += 1;
  if (rr > 0) p.res = Math.min(p.mres, p.res + rr * dt);
  if (cls.decayPerSec > 0 && p.sinceHitMs > FURY_DECAY_DELAY_MS && !p.channel) p.res = Math.max(0, p.res - cls.decayPerSec * dt);
  if ((p.save as { debugInfRes?: boolean }).debugInfRes) p.res = p.mres; // F2 prototype toggle

  updateLoot(inst, p, dtMs);
  if (p.lohSeen.size > 64) for (const [k, t] of p.lohSeen) if (inst.t - t > 1000) p.lohSeen.delete(k);
}

export function killPlayer(inst: Instance, p: Player, el: Element) {
  if (p.deadMs > 0) return;
  p.hp = 0;
  p.deadMs = RESPAWN_MS;
  p.channel = null;
  p.stunMs = 0;
  p.frozenMs = 0;
  p.inQ.length = 0;
  for (let i = p.buffs.length - 1; i >= 0; i--) if (p.buffs[i].ms !== Infinity) p.buffs.splice(i, 1);
  refreshLive(p);
  inst.emit({ e: 'die', t: p.id, el: elIdx(el), x: Math.round(p.x), y: Math.round(p.y) }, p.x, p.y, p.id);
  inst.counters.playerDeaths++;
  p.save.stats.deaths++;
  touchChar(p);
  for (const m of inst.mobs) if (m.target === p.id) m.target = 0;
}

function respawn(inst: Instance, p: Player) {
  p.deadMs = 0;
  const pos = freeSpot(inst, inst.map.entry.x, inst.map.entry.y);
  p.mv.x = p.x = pos.x;
  p.mv.y = p.y = pos.y;
  p.mv.dashMs = 0;
  p.hp = p.mhp;
  if (CLASSES[p.save.classId].resource.id !== 'fury') p.res = p.mres;
  p.invulnMs = 2000;
  p.sinceHurtMs = 1e9;
  p.respawnTick = inst.tickNo; // clients drop the corpse view and get a fresh entity next tick
}

export function debugHeal(inst: Instance, p: Player) {
  if (p.deadMs > 0) respawnInPlace(inst, p);
  p.hp = p.mhp;
  p.res = p.mres;
  p.readyAt.clear();
  healPlayer(inst, p, 0, true);
}

function respawnInPlace(inst: Instance, p: Player) {
  p.deadMs = 0;
  p.hp = p.mhp;
  p.respawnTick = inst.tickNo;
}

// ─────────────────────────── Experience ───────────────────────────

/** Grant XP (already multiplied), handle level-ups / paragon levels, events, stat refresh. */
export function grantXp(inst: Instance, p: Player, xp: number) {
  const save = p.save;
  const before = save.level;
  const r = addXp(save, Math.max(1, Math.round(xp)));
  if (r.levels > 0) {
    autoSlotSkills(save, before);
    refreshPlayerStats(inst, p, false);
    p.res = CLASSES[save.classId].resource.id === 'fury' ? p.res : p.mres;
    inst.emit({ e: 'level', t: p.id, lv: save.level }, p.x, p.y, p.id);
  }
  if (r.paragons > 0) {
    p.descVer++;
    inst.emit({ e: 'paragon', t: p.id, lv: save.paragon.level }, p.x, p.y, p.id);
  }
}

/** New skills unlocked by a level-up go into empty slots (D3 non-elective mode). */
function autoSlotSkills(save: SaveX, oldLevel: number) {
  for (const s of skillsForClass(save.classId)) {
    if (s.kind === 'primary' || s.unlock <= oldLevel || s.unlock > save.level) continue;
    if (save.skills.slots.includes(s.id)) continue;
    const empty = save.skills.slots.indexOf(null);
    if (empty < 0) break;
    setSkillSlot(save, empty, s.id);
  }
}
