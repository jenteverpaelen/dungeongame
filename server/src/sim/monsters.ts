// Monster creation and AI (ARCHITECTURE 1.6): aggro, chase with separation steering + flow-field pathing,
// telegraphed windups, melee / slam / ranged / suicide attacks, leash, treasure goblins and the Rift Guardian.

import {
  DIFFICULTIES, ELITE_HP_MULT, F_ATTACK, F_LEFT, F_MOVING, F_WINDUP, PLAYER_RADIUS, monsterDmg, monsterHp,
  type EliteTier, type MonsterDef,
} from '../shared';
import { damagePlayer, tickDot } from './damage';
import { eliteTick } from './elites';
import { elIdx, mobStatusFlags, shotBlocked } from './effects';
import { flowDir } from './flowfield';
import { nextId } from './ids';
import type { Instance } from './instance';
import { killMob, packMemberGone } from './kills';
import { dropGoldPile } from './loot';
import { spawnProj } from './projectiles';
import { bossTick } from './rift';
import { fractureLine } from './fracture';
import {
  AGGRO_RANGE, DORMANT_RANGE, GOBLIN_ESCAPE_MS, eliteToughness, levelDamage, levelToughness, GOBLIN_HP_MULT, HP_PER_EXTRA_PLAYER, LEASH_RANGE, MELEE_SLACK, MIN_WINDUP_MS,
  PACK_ALERT_RANGE, WINDUP_MULT,
} from './tuning';
import type { Mob, Pack, Player } from './types';

export const DUMMY_DEF: MonsterDef = {
  id: 'training_dummy', name: 'Training Dummy', family: 'golem', hp: 1, dmg: 0, speed: 0, radius: 22,
  attack: { kind: 'none', range: 0, windupMs: 0, cooldownMs: 0, element: 'physical' },
  weight: 0, themes: [], colors: { body: 0xb08850, accent: 0x6b4f2a, eye: 0x1a1a1a }, scale: 1,
};

export interface MobOpts {
  /** Authored field encounter: existing ring/enrage, no reward-bearing summons. */
  combat?: 'keeper' | 'furnace' | 'cistern' | 'relay';
  tier?: EliteTier;
  affixes?: string[];
  name?: string;
  pack?: Pack | null;
  dormant?: boolean;
  progress?: number;
  dummy?: boolean;
  /** Number of players the monster's life is scaled for (D3 +50% per extra player). */
  players?: number;
  difficulty?: number;
}

function lifeFor(def: MonsterDef, tier: EliteTier, level: number, diff: number, affixes: string[], players: number): number {
  const typeMult = tier === 5 ? GOBLIN_HP_MULT : def.hp;
  let hp = monsterHp(level) * levelToughness(level) * typeMult * ELITE_HP_MULT[tier] * DIFFICULTIES[diff].hp;
  if (tier === 1 || tier === 2) hp *= eliteToughness(level);
  hp *= 1 + HP_PER_EXTRA_PLAYER * Math.max(0, Math.min(3, players - 1));
  if (affixes.includes('extra_health')) hp *= 1.5;
  return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER,Math.round(hp)));
}

export function createMob(inst: Instance, def: MonsterDef, level: number, x: number, y: number, o: MobOpts = {}): Mob {
  const tier = o.tier ?? 0;
  const affixes = o.affixes ?? [];
  const fast = affixes.includes('fast');
  const players = o.players ?? 1;
  const diff = o.difficulty ?? inst.difficulty;
  const hp = o.dummy ? 1e9 : lifeFor(def, tier, level, diff, affixes, players);
  const m: Mob = {
    kind: 'mob', id: nextId(), def, type: o.dummy ? 'training_dummy' : def.id, tier, level, diff,
    name: o.name ?? def.name, affixes, hp, mhp: hp,
    speed: def.speed * (fast ? 1.4 : 1),
    dmg: monsterDmg(level) * levelDamage(level) * def.dmg * DIFFICULTIES[diff].dmg,
    windupMs: Math.max(MIN_WINDUP_MS, def.attack.windupMs * WINDUP_MULT) * (fast ? 0.75 : 1),
    cooldownMs: def.attack.cooldownMs * (fast ? 0.85 : 1),
    flags: 0, attackSeq: 0, state: 'idle', target: 0,
    x, y, r: def.radius, hCell: -1, hIdx: -1, homeX: x, homeY: y, pack: o.pack ?? null,
    stateMs: 0, atkCdMs: inst.rng.next() * 600, attackFlagMs: 0,
    stunMs: 0, freezeMs: 0, chillMs: 0, markMs: 0, markPct: 0, holeMs: 0, holePct: 0, kbX: 0, kbY: 0, kbMs: 0,
    dots: [], dead: false, dummy: !!o.dummy, dormant: o.dormant ?? false, lastHitBy: 0, lastDamagedT: -1e9,
    atkX: x, atkY: y,
    aff: {
      molten: 500, frozen: 1500 + inst.rng.next() * 3000, plagued: 1000 + inst.rng.next() * 3000,
      vortex: 2500 + inst.rng.next() * 5000, mortar: 1000 + inst.rng.next() * 2000, electrified: 0, faulted: 1500,
    },
    noticedMs: -1, goldPileMs: 0, fleeX: x, fleeY: y, fleeMs: 0,
    boss: tier === 4 || o.combat ? { ringMs: 3500, addsMs: o.combat?Infinity:7000, enraged: false, slamCount: 0, ...(o.combat==='furnace'?{furnace:true}:{}),
      ...(o.combat==='cistern'||o.combat==='relay'?{pattern:o.combat}:{}) } : null,
    losMs: 0, los: true, shotLos: true, shatterBy: 0, shatterDepth: 0,
    progress: o.progress ?? 0, noReward: false,
    faceLeft: inst.rng.next() < 0.5, moving: false, descVer: 1, sepX: 0, sepY: 0, trailX: x, trailY: y,
  };
  inst.addMob(m);
  return m;
}

/** Re-scale an untouched monster (fields: packs adopt the level and difficulty of the player who finds them). */
export function relevel(m: Mob, level: number, diff: number, players: number) {
  if (m.dummy || m.lastDamagedT > 0) return;
  m.level = level;
  m.diff = diff;
  m.mhp = m.hp = lifeFor(m.def, m.tier, level, diff, m.affixes, players);
  m.dmg = monsterDmg(level) * levelDamage(level) * m.def.dmg * DIFFICULTIES[diff].dmg;
  m.descVer++;
}

/** The difficulty a player plays fields at: their chosen difficulty if their level allows it (D3 Adventure Mode). */
export function playerDifficulty(p: Player): number {
  let d = Math.max(0, Math.min(DIFFICULTIES.length - 1, Math.floor(p.save.difficulty || 0)));
  while (d > 0 && DIFFICULTIES[d].minLevel > p.save.level) d--;
  return d;
}

/** D057: story fields are Normal; private instances keep their creation setting. */
export function encounterDifficulty(inst:Instance,p:Player):number {
  if(inst.kind==='rift'||inst.kind==='dungeon')return inst.difficulty;
  return inst.map.adventure?0:playerDifficulty(p);
}

function playersAround(inst: Instance, x: number, y: number): number {
  let n = 0;
  for (const p of inst.players) if (Math.hypot(p.x - x, p.y - y) < 2400) n++;
  return Math.max(1, n);
}

// ─────────────────────────── Aggro ───────────────────────────

function aggro(inst: Instance, m: Mob, p: Player) {
  m.state = 'chase';
  m.target = p.id;
  m.los = true;
  m.shotLos = true;
  m.losMs = 0;
}

/** A monster was hit or noticed a player: chase, and alert its pack. */
export function wakeMob(inst: Instance, m: Mob, attacker: Player | null) {
  if (m.dummy) return;
  if (m.dormant) wakeFromDormant(inst, m, attacker);
  if (m.tier === 5) { if (m.noticedMs < 0) noticeGoblin(inst, m); return; }
  if (m.state !== 'idle' && m.state !== 'return') return;
  const p = attacker && attacker.deadMs <= 0 ? attacker : inst.nearestPlayer(m.x, m.y, 2000);
  if (!p) return;
  aggro(inst, m, p);
  for (const o of inst.queryMobs(m.x, m.y, PACK_ALERT_RANGE)) {
    if (o === m || o.dead || o.dummy || o.tier === 5) continue;
    if (o.dormant) wakeFromDormant(inst, o, p);
    if (o.state === 'idle') aggro(inst, o, p);
  }
}

function wakeFromDormant(inst: Instance, m: Mob, by: Player | null) {
  m.dormant = false;
  if (inst.kind === 'field' && m.lastDamagedT < 0) {
    const p = by ?? inst.nearestPlayer(m.x, m.y, 1e9);
    if (p) {
      const [lo, hi] = inst.def.levelBand;
      const lvl = Math.max(lo, Math.min(hi, p.save.level));
      const diff = encounterDifficulty(inst,p);
      relevel(m, lvl, diff, playersAround(inst, m.x, m.y));
    }
  }
}

function noticeGoblin(inst: Instance, m: Mob) {
  m.noticedMs = 0;
  m.state = 'flee';
  m.fleeMs = 0;
}

/** Reactions to being hit (treasure goblins spill gold). */
export function onMobHit(inst: Instance, m: Mob, attacker: Player | null, dot: boolean) {
  if (m.tier === 5 && attacker && !dot && m.goldPileMs <= 0 && inst.rng.next() < 0.35) {
    m.goldPileMs = 300;
    dropGoldPile(inst, attacker, m);
  }
}

// ─────────────────────────── Update ───────────────────────────

export function updateMonsters(inst: Instance, dtMs: number) {
  const list = inst.mobs;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const m = list[i];
    if (m.dead) continue;
    if (m.dummy) { dummyTick(inst, m); continue; }
    if (m.dormant) {
      if ((inst.tickNo + m.id) % 10 === 0 && inst.nearestPlayer(m.x, m.y, DORMANT_RANGE)) wakeFromDormant(inst, m, null);
      else continue;
    }
    timers(m, dtMs);
    if (m.dots.length && dots(inst, m, dtMs)) continue;
    if (m.dead) continue;
    m.moving = false;
    if (m.kbMs > 0) {
      m.kbMs -= dtMs;
      const q = inst.cw.moveCircle(m.x, m.y, m.r, m.kbX * (dtMs / 1000), m.kbY * (dtMs / 1000), !!m.def.flying);
      m.x = q.x; m.y = q.y;
      inst.mobHash.update(m);
    }
    if (m.stunMs <= 0 && m.freezeMs <= 0 && !(m.def.attack.kind === 'charge' && m.kbMs > 0)) think(inst, m, dtMs);
    if (m.dead) continue;
    let f = mobStatusFlags(m);
    if (m.faceLeft) f |= F_LEFT;
    if (m.moving) f |= F_MOVING;
    if (m.attackFlagMs > 0) f |= F_ATTACK;
    if (m.state === 'windup') f |= F_WINDUP;
    m.flags = f;
  }
}

function dummyTick(inst: Instance, m: Mob) {
  if (m.hp < m.mhp && inst.t - m.lastDamagedT > 4000) m.hp = m.mhp;
  m.flags = m.faceLeft ? F_LEFT : 0;
}

function timers(m: Mob, dtMs: number) {
  if (m.attackFlagMs > 0) m.attackFlagMs -= dtMs;
  if (m.stunMs > 0) m.stunMs -= dtMs;
  if (m.freezeMs > 0) { m.freezeMs -= dtMs; if (m.freezeMs <= 0) m.shatterBy = 0; }
  if (m.chillMs > 0) m.chillMs -= dtMs;
  if (m.markMs > 0) m.markMs -= dtMs;
  if (m.holeMs > 0) m.holeMs -= dtMs;
  if (m.goldPileMs > 0) m.goldPileMs -= dtMs;
  if (m.aff.electrified > 0) m.aff.electrified -= dtMs;
  const slow = m.chillMs > 0 ? 0.6 : 1;
  if (m.atkCdMs > 0 && m.stunMs <= 0 && m.freezeMs <= 0) m.atkCdMs -= dtMs * slow;
}

/** Tick DoTs; returns true if the monster died. */
function dots(inst: Instance, m: Mob, dtMs: number): boolean {
  for (let i = m.dots.length - 1; i >= 0; i--) {
    const d = m.dots[i];
    d.nextMs -= dtMs;
    d.leftMs -= dtMs;
    while (d.nextMs <= 0 && d.leftMs > -d.tickMs) {
      d.nextMs += d.tickMs;
      if (tickDot(inst, m, d)) return true;
    }
    if (d.leftMs <= 0) {
      const j = m.dots.indexOf(d);
      if (j >= 0) m.dots.splice(j, 1);
    }
  }
  return false;
}

function targetOf(inst: Instance, m: Mob): Player | null {
  const p = m.target ? inst.playerById(m.target) : null;
  if (p && p.deadMs <= 0) return p;
  return null;
}

function think(inst: Instance, m: Mob, dtMs: number) {
  const dtS = dtMs / 1000;
  const slow = m.chillMs > 0 ? 0.6 : 1;
  if (m.tier === 5) { goblin(inst, m, dtMs); return; }
  switch (m.state) {
    case 'idle': {
      if ((inst.tickNo + m.id) % 4 !== 0) return;
      const p = inst.nearestPlayer(m.x, m.y, AGGRO_RANGE + m.r);
      if (p && !shotBlocked(inst, m.x, m.y, p.x, p.y)) wakeMob(inst, m, p);
      else if (inst.kind !== 'town' && !inst.nearestPlayer(m.x, m.y, DORMANT_RANGE)) m.dormant = true;
      return;
    }
    case 'return': {
      const d = Math.hypot(m.homeX - m.x, m.homeY - m.y);
      if (d < 24) { m.state = 'idle'; m.hp = m.mhp; m.dots.length = 0; return; } // leashed: reset like D3
      step(inst, m, m.homeX, m.homeY, m.speed * 1.4, dtS, null);
      return;
    }
    case 'windup': {
      const p = targetOf(inst, m);
      if (p && m.def.attack.kind !== 'explode' && m.def.attack.kind !== 'charge') m.faceLeft = p.x < m.x;
      m.stateMs -= dtMs * slow;
      if (m.stateMs <= 0) {
        resolveAttack(inst, m);
        if (!m.dead && !m.charge) { m.state = 'recover'; m.stateMs = 220; }
      }
      return;
    }
    case 'charge':
      chargeStep(inst, m, dtMs * slow);
      return;
    case 'recover':
      m.stateMs -= dtMs;
      if (m.stateMs <= 0) m.state = 'chase';
      return;
    case 'chase':
    case 'flee': {
      let p = targetOf(inst, m);
      if (!p) {
        p = inst.nearestPlayer(m.x, m.y, 900);
        if (!p) { m.target = 0; m.state = m.tier === 4 ? 'idle' : 'return'; return; }
        m.target = p.id;
      }
      if (m.tier !== 4 && Math.hypot(m.x - m.homeX, m.y - m.homeY) > LEASH_RANGE) { m.state = 'return'; m.target = 0; return; }
      if (m.affixes.length) eliteTick(inst, m, p, dtMs);
      if (m.boss) bossTick(inst, m, p, dtMs);
      if (m.dead || m.state !== 'chase') return;
      const dx = p.x - m.x, dy = p.y - m.y;
      const d = Math.hypot(dx, dy);
      const atk = m.def.attack;
      const reach = atk.range + m.r + PLAYER_RADIUS;
      m.losMs -= dtMs;
      if (m.losMs <= 0) {
        m.losMs = 300 + (m.id % 7) * 30;
        m.los = !inst.cw.segmentBlocked(m.x, m.y, p.x, p.y);
        m.shotLos = m.los || !shotBlocked(inst, m.x, m.y, p.x, p.y);
      }
      const ranged = ['ranged','fan','fracture','lob','charge'].includes(atk.kind);
      const clearShot = atk.kind === 'lob' || atk.kind === 'charge' || atk.kind==='fracture' ? m.los : m.shotLos;
      if (d <= reach && m.atkCdMs <= 0 && (!ranged || clearShot)) { beginAttack(inst, m, p); return; }
      if (d > reach * (ranged ? 0.9 : 0.8) || (ranged && !clearShot)) {
        step(inst, m, p.x, p.y, m.speed * slow, dtS, p);
      } else {
        m.faceLeft = dx < 0;
        separateOnly(inst, m);
      }
      return;
    }
  }
}

/** Move towards (tx, ty) with separation steering; uses the flow field when the straight line is blocked. */
function step(inst: Instance, m: Mob, tx: number, ty: number, speed: number, dtS: number, p: Player | null) {
  let dx = tx - m.x, dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  dx /= d; dy /= d;
  if (p && !m.los) {
    const f = flowDir(inst, p, m.x, m.y);
    if (f) { dx = f.x; dy = f.y; }
  }
  const sp = Math.min(speed * dtS, d);
  let sx = dx * sp, sy = dy * sp;
  separation(inst, m);
  sx += m.sepX; sy += m.sepY;
  const q = inst.cw.moveCircle(m.x, m.y, m.r, sx, sy, !!m.def.flying);
  m.x = q.x; m.y = q.y;
  inst.mobHash.update(m);
  m.moving = true;
  if (Math.abs(dx) > 0.15) m.faceLeft = dx < 0;
}

function separateOnly(inst: Instance, m: Mob) {
  separation(inst, m);
  if (Math.abs(m.sepX) + Math.abs(m.sepY) < 0.3) return;
  const q = inst.cw.moveCircle(m.x, m.y, m.r, m.sepX, m.sepY, !!m.def.flying);
  m.x = q.x; m.y = q.y;
  inst.mobHash.update(m);
}

const sepBuf: Mob[] = [];
/** Push apart from overlapping neighbours so packs spread into a crowd instead of a single stack. */
function separation(inst: Instance, m: Mob) {
  sepBuf.length = 0;
  inst.mobHash.query(m.x, m.y, m.r + 4, sepBuf);
  let px = 0, py = 0;
  for (let i = 0; i < sepBuf.length; i++) {
    const o = sepBuf[i];
    if (o === m || o.dead) continue;
    let dx = m.x - o.x, dy = m.y - o.y;
    let d = Math.hypot(dx, dy);
    const want = m.r + o.r + 2;
    if (d >= want) continue;
    if (d < 0.01) { dx = ((m.id * 7919) % 13) - 6; dy = ((m.id * 104729) % 11) - 5; d = Math.hypot(dx, dy) || 1; }
    const push = (want - d) * (o.r >= m.r ? 0.35 : 0.2);
    px += (dx / d) * push;
    py += (dy / d) * push;
  }
  const l = Math.hypot(px, py);
  const cap = 6;
  if (l > cap) { px = (px / l) * cap; py = (py / l) * cap; }
  m.sepX = px; m.sepY = py;
}

// ─────────────────────────── Attacks ───────────────────────────

function beginAttack(inst: Instance, m: Mob, p: Player) {
  const atk = m.def.attack;
  if (atk.kind === 'none') return;
  m.state = 'windup';
  m.stateMs = m.windupMs;
  m.faceLeft = p.x < m.x;
  // A lob's ground warning starts on launch, after the interruptible windup.
  if(atk.kind==='lob')return;
  if(atk.kind==='fan'||atk.kind==='fracture') {m.atkX=p.x;m.atkY=p.y;return;}
  if (atk.kind === 'charge') {
    const distance = Math.hypot(p.x - m.x, p.y - m.y), length = Math.min(distance, atk.range);
    const angle = Math.atan2(p.y - m.y, p.x - m.x);
    m.atkX = m.x + Math.cos(angle) * length; m.atkY = m.y + Math.sin(angle) * length;
    inst.emit({ e: 'tele', v: 'charge', s: m.id, x: m.x, y: m.y, r: length, w: m.r * 2, a: angle, d: m.windupMs }, m.x, m.y);
    return;
  }
  if (atk.kind === 'explode') {
    m.atkX = m.x; m.atkY = m.y;
    inst.emit({ e: 'tele', v: 'slam', x: Math.round(m.x), y: Math.round(m.y), r: atk.aoe ?? 60, d: Math.round(m.windupMs) }, m.x, m.y);
    return;
  }
  if (atk.aoe) {
    // slam lands where the player stood when the windup began (step out of the circle to dodge)
    const d = Math.hypot(p.x - m.x, p.y - m.y);
    const reach = Math.min(d, atk.range + m.r);
    m.atkX = m.x + ((p.x - m.x) / (d || 1)) * reach;
    m.atkY = m.y + ((p.y - m.y) / (d || 1)) * reach;
    inst.emit({ e: 'tele', v: 'slam', x: Math.round(m.atkX), y: Math.round(m.atkY), r: atk.aoe, d: Math.round(m.windupMs) }, m.atkX, m.atkY);
    return;
  }
  m.atkX = p.x; m.atkY = p.y;
}

function resolveAttack(inst: Instance, m: Mob) {
  const atk = m.def.attack;
  m.attackFlagMs = 260;
  m.attackSeq++;
  m.atkCdMs = m.cooldownMs * (m.boss?.enraged ? 0.8 : 1);
  const p = targetOf(inst, m);
  switch (atk.kind) {
    case 'fracture':
      fractureLine(inst,m,m.atkX,m.atkY,atk.range,m.dmg/3,atk.element);
      return;
    case 'fan': {
      const angle=Math.atan2(m.atkY-m.y,m.atkX-m.x),speed=atk.projSpeed??330;
      // Same 70-degree spread as the ranger fan; total raw damage is one inherited hit.
      for(let i=0;i<3;i++)spawnProj(inst,{kind:'mob',v:'orb',mob:m,src:m.id,x:m.x,y:m.y-10,
        angle:angle+(i-1)*35*Math.PI/180,speed,lifeMs:(atk.range+220)/speed*1000,r:11,el:atk.element,dmg:m.dmg/3,mobLevel:m.level});
      return;
    }
    case 'charge': {
      const dx = m.atkX - m.x, dy = m.atkY - m.y, distance = Math.hypot(dx, dy);
      if (distance <= 0) return;
      m.charge = { dx: dx / distance, dy: dy / distance, left: Math.min(distance, atk.range), hit: new Set() };
      m.state = 'charge';
      return;
    }
    case 'lob': {
      if(!p||inst.cw.segmentBlocked(m.x,m.y,p.x,p.y))return;
      // Lock the landing point and damage at launch. Movement cannot redirect it;
      // killing the caster after release does not erase an airborne stone.
      const x=Math.round(p.x),y=Math.round(p.y),r=atk.aoe!,flight=atk.flightMs!,dmg=m.dmg,level=m.level;
      inst.emit({e:'tele',v:'lob',x,y,r,d:flight},x,y);
      inst.sched.schedule(inst.t+flight,()=>{
        inst.emit({e:'aoe',v:'slam',x,y,r,d:320,el:elIdx(atk.element),s:m.id},x,y);
        for(const q of inst.players) {
          if(q.deadMs>0||Math.hypot(q.x-x,q.y-y)>r+PLAYER_RADIUS||inst.cw.segmentBlocked(x,y,q.x,q.y))continue;
          damagePlayer(inst,q,dmg,atk.element,m,level,false);
        }
      });
      return;
    }
    case 'melee': {
      if (atk.aoe) {
        const r = atk.aoe;
        inst.emit({ e: 'aoe', v: 'slam', x: Math.round(m.atkX), y: Math.round(m.atkY), r, d: 320, el: elIdx(atk.element), s: m.id }, m.atkX, m.atkY);
        for (const q of inst.players) {
          if (q.deadMs > 0) continue;
          if (Math.hypot(q.x - m.atkX, q.y - m.atkY) > r + PLAYER_RADIUS) continue;
          const taken = damagePlayer(inst, q, m.dmg, atk.element, m, m.level, true);
          if (taken > 0 && m.tier === 4) inst.emitTo(q.id, { e: 'shake', m: 8, d: 220 });
        }
        if (m.tier === 4) for (const q of inst.playersNear(m.atkX, m.atkY, 700)) if (Math.hypot(q.x - m.atkX, q.y - m.atkY) > r + PLAYER_RADIUS) inst.emitTo(q.id, { e: 'shake', m: 3, d: 160 });
        return;
      }
      if (!p) return;
      if (Math.hypot(p.x - m.x, p.y - m.y) <= atk.range + m.r + PLAYER_RADIUS + MELEE_SLACK) damagePlayer(inst, p, m.dmg, atk.element, m, m.level, true);
      return;
    }
    case 'ranged': {
      if (!p) return;
      const a = Math.atan2(p.y - m.y, p.x - m.x);
      const speed = atk.projSpeed ?? 340;
      spawnProj(inst, {
        kind: 'mob', v: atk.element === 'poison' ? 'seed' : 'firebolt', mob: m, src: m.id, x: m.x, y: m.y - 10, angle: a, speed,
        lifeMs: ((atk.range + 220) / speed) * 1000, r: 11, el: atk.element, dmg: m.dmg, mobLevel: m.level,
      });
      return;
    }
    case 'explode': {
      const r = atk.aoe ?? 60;
      inst.emit({ e: 'aoe', v: 'explode', x: Math.round(m.x), y: Math.round(m.y), r, d: 400, el: elIdx(atk.element), s: m.id }, m.x, m.y);
      for (const q of inst.players) {
        if (q.deadMs > 0 || Math.hypot(q.x - m.x, q.y - m.y) > r + PLAYER_RADIUS) continue;
        damagePlayer(inst, q, m.dmg, atk.element, m, m.level, false);
      }
      m.noReward = true; // blew itself up: XP but no loot
      killMob(inst, m, null, atk.element, 'explode');
      return;
    }
  }
}

/** Radius-bounded substeps stop at solids; unlike ordinary pursuit, a charge never slides or turns. */
function chargeStep(inst: Instance, m: Mob, dtMs: number) {
  const c = m.charge;
  if (!c) { m.state = 'recover'; m.stateMs = 220; return; }
  const distance = Math.min(c.left, m.def.attack.range * dtMs / m.def.attack.chargeMs!);
  const steps = Math.max(1, Math.ceil(distance / (m.r / 2))), stride = distance / steps;
  for (let i = 0; i < steps && !m.dead; i++) {
    const x0 = m.x, y0 = m.y, x1 = x0 + c.dx * stride, y1 = y0 + c.dy * stride;
    if (inst.cw.town?.circlePathBlocked(x0, y0, m.r, c.dx * stride, c.dy * stride) || !inst.cw.isFree(x1, y1, m.r)) { c.left = 0; break; }
    m.x = x1; m.y = y1; c.left -= stride; m.moving = true;
    for (const p of inst.players) {
      if (p.deadMs > 0 || c.hit.has(p.id)) continue;
      const along = Math.max(0, Math.min(stride, (p.x - x0) * c.dx + (p.y - y0) * c.dy));
      const hx = x0 + c.dx * along, hy = y0 + c.dy * along;
      if (Math.hypot(p.x - hx, p.y - hy) > m.r + PLAYER_RADIUS || inst.cw.segmentBlocked(hx, hy, p.x, p.y)) continue;
      c.hit.add(p.id);
      damagePlayer(inst, p, m.dmg, m.def.attack.element, m, m.level, true);
      if (m.dead) break; // Thorns can kill the charging attacker on contact.
    }
  }
  if (!m.dead) inst.mobHash.update(m);
  if (m.dead || c.left <= 1e-6) { m.charge = undefined; m.state = 'recover'; m.stateMs = 220; }
}

// ─────────────────────────── Treasure goblin ───────────────────────────

function goblin(inst: Instance, m: Mob, dtMs: number) {
  if (m.noticedMs < 0) {
    if ((inst.tickNo + m.id) % 4 === 0) {
      const p = inst.nearestPlayer(m.x, m.y, 600);
      if (p) noticeGoblin(inst, m);
    }
    return;
  }
  m.noticedMs += dtMs;
  if (m.noticedMs >= GOBLIN_ESCAPE_MS) { goblinEscape(inst, m); return; }
  const threat = inst.nearestPlayer(m.x, m.y, 1100);
  if (!threat) return; // nobody chasing: catch its breath
  m.fleeMs -= dtMs;
  const reached = Math.hypot(m.fleeX - m.x, m.fleeY - m.y) < 30;
  if (m.fleeMs <= 0 || reached) {
    m.fleeMs = 650;
    let best = -1e9, bx = m.x, by = m.y;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + inst.rng.next() * 0.2;
      const px = m.x + Math.cos(a) * 220, py = m.y + Math.sin(a) * 220;
      if (!inst.cw.isFree(px, py, m.r) || inst.cw.segmentBlocked(m.x, m.y, px, py)) continue;
      let score = 0;
      for (const p of inst.players) if (p.deadMs <= 0) score += Math.min(900, Math.hypot(px - p.x, py - p.y));
      score += inst.rng.next() * 80;
      if (score > best) { best = score; bx = px; by = py; }
    }
    m.fleeX = bx; m.fleeY = by;
  }
  const slow = m.chillMs > 0 ? 0.6 : 1;
  step(inst, m, m.fleeX, m.fleeY, m.speed * slow, dtMs / 1000, null);
}

function goblinEscape(inst: Instance, m: Mob) {
  inst.emit({ e: 'aoe', v: 'explode', x: Math.round(m.x), y: Math.round(m.y), r: 70, d: 600, el: elIdx('arcane'), s: m.id }, m.x, m.y);
  for (const p of inst.playersNear(m.x, m.y, 1600)) inst.emitTo(p.id, { e: 'notice', text: 'The Treasure Goblin escaped!', kind: 'warn' });
  inst.removeMob(m);
  packMemberGone(inst, m);
}
