// AOI replication (ARCHITECTURE 1.2 step 7): per player, entities inside the AOI rectangle are described once
// (`add`), updated every tick in compact form (`upd`), and removed when they leave or die (`rem`); events are
// filtered by position / relevance. The `me` block is authoritative state for prediction and the HUD.

import {
  AOI_HALF_H, AOI_HALF_W, F_ATTACK, F_CAST, F_CHANNEL, F_DASH, F_DEAD, F_FROZEN, F_INVULN, F_LEFT, F_MOVING, F_STUN,
  playerLook, type BuffView, type EntDesc, type GameEvent, type MeState, type Snapshot,
} from '../shared';
import { summonCount } from './brain';
import type { Instance } from './instance';
import type { Loot, Mob, Player, PortalEnt, Summon } from './types';

const EV_MARGIN = 260;
/** Per viewer and tick: other players' plain (non-crit, non-kill) damage numbers beyond this are dropped. */
const OTHERS_DMG_BUDGET = 40;

function playerFlags(p: Player): number {
  let f = 0;
  if (p.faceLeft) f |= F_LEFT;
  if (p.moving && p.deadMs <= 0) f |= F_MOVING;
  if (p.attackFlagMs > 0) f |= F_ATTACK;
  if (p.castFlagMs > 0) f |= F_CAST;
  if (p.channel) f |= F_CHANNEL;
  if (p.stunMs > 0) f |= F_STUN;
  if (p.frozenMs > 0) f |= F_FROZEN;
  if (p.deadMs > 0) f |= F_DEAD;
  if (p.mv.dashMs > 0) f |= F_DASH;
  if (p.invulnMs > 0) f |= F_INVULN;
  return f;
}

function descPlayer(p: Player): EntDesc {
  return { id: p.id, k: 'player', t: p.save.classId, n: p.name, lv: p.save.level, r: p.r, look: playerLook(p.save), pl: p.save.paragon.level };
}

function descMob(m: Mob): EntDesc {
  const d: EntDesc = { id: m.id, k: 'mob', t: m.type, n: m.name, lv: m.level, el: m.tier, mh: Math.round(m.mhp), r: m.r };
  if (m.affixes.length) d.af = m.affixes;
  return d;
}

function descSummon(s: Summon): EntDesc {
  const d: EntDesc = { id: s.id, k: 'summon', t: s.type, owner: s.owner.id, r: s.r };
  if (s.big) d.sc = 1.6;
  return d;
}

function descLoot(l: Loot): EntDesc {
  return { id: l.id, k: 'loot', t: l.view.lk, n: l.view.name, owner: l.owner.id, loot: l.view, r: 12 };
}

function descPortal(pt: PortalEnt): EntDesc {
  return { id: pt.id, k: 'portal', t: pt.to, n: pt.name, r: 40 };
}

const mobBuf: Mob[] = [];

export function replicate(inst: Instance) {
  if (!inst.players.length) return;
  const now = Date.now();
  const rift = inst.rift ? inst.rift.state() : undefined;
  for (const p of inst.players) {
    try {
      p.link.send(buildSnapshot(inst, p, now, rift));
    } catch (err) {
      console.error('[sim] snapshot send failed', err);
    }
  }
}

type Visible = Player | Mob | Summon | Loot | PortalEnt;

function describe(e: Visible): EntDesc {
  switch (e.kind) {
    case 'player': return descPlayer(e);
    case 'mob': return descMob(e);
    case 'summon': return descSummon(e);
    case 'loot': return descLoot(e);
    case 'portal': return descPortal(e);
  }
}

// Per-snapshot scratch state (snapshots are built one at a time).
let curKnown: Map<number, { ver: number; seen: number }> = new Map();
let curStamp = 0;
let curAdd: EntDesc[] = [];
let curUpd: number[] = [];

function visit(e: Visible, ver: number, hp: number, flags: number, aseq: number) {
  const k = curKnown.get(e.id);
  if (!k) { curKnown.set(e.id, { ver, seen: curStamp }); curAdd.push(describe(e)); }
  else {
    if (k.ver !== ver) { k.ver = ver; curAdd.push(describe(e)); }
    k.seen = curStamp;
  }
  curUpd.push(e.id, e.x | 0, e.y | 0, hp, flags, aseq);
}

function buildSnapshot(inst: Instance, p: Player, now: number, rift: Snapshot['rift']): Snapshot {
  const x0 = p.x - AOI_HALF_W, x1 = p.x + AOI_HALF_W, y0 = p.y - AOI_HALF_H, y1 = p.y + AOI_HALF_H;
  const stamp = inst.tickNo;
  const add: EntDesc[] = [];
  const upd: number[] = [];
  const known = p.known;
  curKnown = known; curStamp = stamp; curAdd = add; curUpd = upd;

  for (const q of inst.players) {
    if (q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1 || q.respawnTick === stamp) continue;
    visit(q, q.descVer, q.mhp > 0 ? Math.max(0, Math.min(1000, (q.hp / q.mhp) * 1000)) | 0 : 0, playerFlags(q), q.attackSeq);
  }
  mobBuf.length = 0;
  inst.mobHash.queryRect(x0, y0, x1, y1, mobBuf);
  for (let i = 0; i < mobBuf.length; i++) {
    const m = mobBuf[i];
    if (m.dead) continue;
    visit(m, m.descVer, Math.max(1, Math.min(1000, (m.hp / m.mhp) * 1000)) | 0, m.flags, m.attackSeq);
  }
  for (const s of inst.summons) {
    if (s.dead || s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
    visit(s, s.descVer, 1000, s.flags, s.attackSeq);
  }
  for (const l of p.loot) {
    if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
    visit(l, 1, 1000, 0, 0);
  }
  for (const pt of inst.portals) {
    if (pt.x < x0 || pt.x > x1 || pt.y < y0 || pt.y > y1) continue;
    visit(pt, 1, 1000, 0, 0);
  }
  let rem: number[] | undefined;
  for (const [id, k] of known) {
    if (k.seen === stamp) continue;
    known.delete(id);
    (rem ??= []).push(id);
  }

  let ev: GameEvent[] | undefined;
  const ex0 = x0 - EV_MARGIN, ex1 = x1 + EV_MARGIN, ey0 = y0 - EV_MARGIN, ey1 = y1 + EV_MARGIN;
  let othersDmg = 0;
  for (const r of inst.events) {
    if (r.only) { if (r.only !== p.id) continue; }
    else if (r.a === -1 || r.a === p.id || r.b === p.id) { /* always relevant */ }
    else if (r.x < ex0 || r.x > ex1 || r.y < ey0 || r.y > ey1) continue;
    else if (r.ev.e === 'dmg' && !r.ev.p && !r.ev.c && !r.ev.k && ++othersDmg > OTHERS_DMG_BUDGET) continue;
    (ev ??= []).push(r.ev);
  }

  const snap: Snapshot = { t: 's', tick: inst.tickNo, time: now, ack: p.ack, me: meState(inst, p), upd };
  if (add.length) snap.add = add;
  if (rem) snap.rem = rem;
  if (ev) snap.ev = ev;
  if (rift) snap.rift = rift;
  if (inst.dungeon) snap.dungeon = inst.dungeon.state();
  return snap;
}

function meState(inst: Instance, p: Player): MeState {
  const cds: number[] = [0, 0, 0, 0];
  const ch: number[] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const rt = p.ctx.slots[i];
    if (!rt) continue;
    cds[i] = Math.max(0, Math.round((p.readyAt.get(rt.def.id) ?? 0) - inst.t));
    if (rt.def.kind === 'summon') ch[i] = summonCount(p, rt.def.id);
  }
  const buffs: BuffView[] = [];
  for (const b of p.buffs) {
    if (b.hidden) continue;
    const v: BuffView = { id: b.id, ms: b.ms === Infinity ? 0 : Math.max(0, Math.round(b.ms)) };
    if (b.st) v.st = b.st;
    buffs.push(v);
  }
  const s = p.save;
  return {
    x: p.mv.x, y: p.mv.y, dashMs: p.mv.dashMs, dashCd: p.mv.dashCdMs,
    hp: Math.max(0, Math.round(p.hp)), mhp: Math.round(p.mhp), res: Math.floor(p.res), mres: Math.round(p.mres),
    cds, ch, buffs, xp: s.xp, lv: s.level, pxp: s.paragon.xp, pl: s.paragon.level, gold: s.gold,
    dead: p.deadMs > 0 ? Math.ceil(p.deadMs) : 0,
  };
}
