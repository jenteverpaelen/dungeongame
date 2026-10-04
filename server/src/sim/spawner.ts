// Population: training dummies in town, field packs that keep coming (respawned out of view near the action),
// pre-populated rifts, champion / rare packs, treasure goblins and debug spawns.

import { MONSTERS, RIFT_PROGRESS, type EliteTier, type MonsterDef, type Theme } from '../shared';
import { eliteName, rollEliteAffixes } from './elites';
import type { Instance } from './instance';
import { DUMMY_DEF, createMob, playerDifficulty } from './monsters';
import {
  CHAMPION_CHANCE, FIELD_NEAR_DIST, FIELD_NEAR_PACKS, FIELD_VISIBLE_DIST, FIELD_VISIBLE_PACKS, GOBLIN_FIELD_CHANCE, GOBLIN_RIFT_CHANCE, RARE_CHANCE, RESPAWN_MIN_DIST, RESPAWN_PREF_DIST, RIFT_PACKS,
} from './tuning';
import type { Mob, Pack, Player } from './types';

let packSeq = 1;

export function themeMonsters(theme: Theme): MonsterDef[] {
  const t = theme === 'town' ? 'glade' : theme;
  return Object.values(MONSTERS).filter((d) => d.weight > 0 && d.themes.includes(t));
}

interface Slot { x: number; y: number; pack: Pack | null }

export interface PackOpts {
  kind?: Pack['kind'];
  dormant?: boolean;
  /** Rift progress normalisation is applied by the rift; packs only carry RIFT_PROGRESS[tier]. */
  rift?: boolean;
  difficulty?: number;
}

export class Spawner {
  private slots: Slot[] = [];
  private pending: number[] = [];
  private nextCheck = 0;
  constructor(private inst: Instance) {}

  init() {
    const inst = this.inst;
    if (inst.kind === 'town') { this.spawnDummies(); return; }
    this.slots = inst.map.spawns.map((s) => ({ x: s.x, y: s.y, pack: null }));
    if (inst.kind === 'field') this.initField();
    else this.initRift();
  }

  private spawnDummies() {
    const inst = this.inst;
    for (const n of inst.map.npcs) {
      if (n.role !== 'dummy') continue;
      const elite = /elite/i.test(n.name) || n.id === 'dummy3';
      const m = createMob(inst, { ...DUMMY_DEF, radius: n.r, name: n.name }, 1, n.x, n.y, { tier: elite ? 2 : 0, dummy: true, name: n.name });
      m.faceLeft = true;
    }
  }

  private initField() {
    const inst = this.inst;
    const order = inst.rng.shuffle(this.slots.map((_, i) => i));
    const n = Math.min(inst.def.packTarget, order.length);
    for (let i = 0; i < n; i++) this.populate(order[i], true);
  }

  private initRift() {
    const inst = this.inst;
    const entry = inst.map.entry;
    const order = inst.rng.shuffle(this.slots.map((_, i) => i)).filter((i) => Math.hypot(this.slots[i].x - entry.x, this.slots[i].y - entry.y) > 520);
    const chosen: number[] = [];
    for (const minD of [480, 380, 300]) {
      for (const i of order) {
        if (chosen.length >= RIFT_PACKS) break;
        if (chosen.includes(i)) continue;
        const s = this.slots[i];
        if (chosen.some((j) => Math.hypot(this.slots[j].x - s.x, this.slots[j].y - s.y) < minD)) continue;
        chosen.push(i);
      }
      if (chosen.length >= RIFT_PACKS) break;
    }
    for (const i of chosen) this.populate(i, true);
    if (inst.rng.next() < GOBLIN_RIFT_CHANCE && chosen.length) {
      const far = chosen.slice().sort((a, b) => Math.hypot(this.slots[b].x - entry.x, this.slots[b].y - entry.y) - Math.hypot(this.slots[a].x - entry.x, this.slots[a].y - entry.y));
      const s = this.slots[far[Math.floor(inst.rng.next() * Math.max(1, far.length / 2))]];
      spawnGoblin(inst, s.x + 60, s.y + 40, inst.level, true);
    }
    inst.rift?.finalize();
  }

  /** Level and difficulty for a new pack: the rift's, or (fields) those of the nearest player. */
  private levelFor(x: number, y: number): { level: number; diff: number } {
    const inst = this.inst;
    if (inst.kind === 'rift') return { level: inst.level, diff: inst.difficulty };
    const [lo, hi] = inst.def.levelBand;
    let best: Player | null = null, bd = Infinity;
    for (const p of inst.players) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return { level: Math.max(lo, Math.min(hi, best ? best.save.level : lo)), diff: best ? playerDifficulty(best) : 0 };
  }

  private populate(i: number, dormant: boolean) {
    const inst = this.inst;
    const s = this.slots[i];
    const { level, diff } = this.levelFor(s.x, s.y);
    const pack = spawnPack(inst, s.x, s.y, level, i, { dormant, rift: inst.kind === 'rift', difficulty: diff });
    s.pack = pack;
    if (inst.kind === 'field' && inst.rng.next() < GOBLIN_FIELD_CHANCE) spawnGoblin(inst, s.x + 70, s.y - 50, level, dormant, diff);
  }

  onPackCleared(pack: Pack) {
    if (pack.slot >= 0 && this.slots[pack.slot]?.pack === pack) this.slots[pack.slot].pack = null;
    if (this.inst.kind === 'field' && pack.slot >= 0) this.pending.push(this.inst.t + this.inst.def.respawnSec * 1000);
  }

  tick(_dtMs: number) {
    const inst = this.inst;
    if (inst.kind !== 'field' || inst.t < this.nextCheck) return;
    this.nextCheck = inst.t + 1000;
    this.ensureNearPlayers();
    if (!this.pending.length) return;
    this.pending.sort((a, b) => a - b);
    while (this.pending.length && this.pending[0] <= inst.t) {
      const i = this.pickRespawnSlot();
      if (i < 0) break; // try again next second
      this.pending.shift();
      this.populate(i, true);
    }
  }

  /** A free spawn point out of every player's view, preferably near someone so the action stays dense. */
  private pickRespawnSlot(): number {
    const inst = this.inst;
    const pref: number[] = [], ok: number[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.pack) continue;
      let minD = Infinity;
      for (const p of inst.players) minD = Math.min(minD, Math.hypot(p.x - s.x, p.y - s.y));
      if (minD < RESPAWN_MIN_DIST) continue;
      if (minD <= RESPAWN_PREF_DIST) pref.push(i); else ok.push(i);
    }
    const from = pref.length ? pref : ok;
    return from.length ? from[Math.floor(inst.rng.next() * from.length)] : -1;
  }

  /** Diablo-style density: keep FIELD_NEAR_PACKS live packs within FIELD_NEAR_DIST of every player,
   *  spawned out of view when possible, so a player is never more than a few seconds from a fight. */
  private ensureNearPlayers() {
    const inst = this.inst;
    let live = this.livePacks();
    const cap = inst.def.packTarget + inst.players.length * FIELD_NEAR_PACKS;
    for (const p of inst.players) {
      if (p.deadMs > 0) continue;
      let near = 0, visible = 0;
      for (const sl of this.slots) {
        if (!sl.pack || sl.pack.alive <= 0) continue;
        const d = Math.hypot(sl.x - p.x, sl.y - p.y);
        if (d < FIELD_NEAR_DIST) near++;
        if (d < FIELD_VISIBLE_DIST) visible++;
      }
      // Always something on screen to run at (fresh arrivals, cleared areas)...
      while (visible < FIELD_VISIBLE_PACKS && live < cap) {
        const i = this.pickSlotNear(p, FIELD_VISIBLE_DIST);
        if (i < 0) break;
        this.populate(i, true);
        visible++; near++; live++;
      }
      // ...and a ring of packs just beyond the screen edge.
      while (near < FIELD_NEAR_PACKS && live < cap) {
        const i = this.pickSlotNear(p, FIELD_NEAR_DIST);
        if (i < 0) break;
        this.populate(i, true);
        near++;
        live++;
      }
    }
  }

  private pickSlotNear(p: Player, maxDist: number): number {
    const inst = this.inst;
    const outOfView: number[] = [], inRange: number[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      const sl = this.slots[i];
      if (sl.pack) continue;
      const d = Math.hypot(sl.x - p.x, sl.y - p.y);
      if (d < 650 || d > maxDist) continue;
      let minD = Infinity;
      for (const q of inst.players) minD = Math.min(minD, Math.hypot(q.x - sl.x, q.y - sl.y));
      (minD >= RESPAWN_MIN_DIST ? outOfView : inRange).push(i);
    }
    const from = outOfView.length ? outOfView : inRange;
    return from.length ? from[Math.floor(inst.rng.next() * from.length)] : -1;
  }

  livePacks(): number {
    return this.slots.filter((s) => s.pack && s.pack.alive > 0).length;
  }
}

function freePos(inst: Instance, cx: number, cy: number, spread: number, r: number): { x: number; y: number } {
  for (let k = 0; k < 10; k++) {
    const a = inst.rng.next() * Math.PI * 2, d = Math.sqrt(inst.rng.next()) * spread;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    if (inst.cw.isFree(x, y, r)) return { x, y };
  }
  return { x: cx, y: cy };
}

function playersFor(inst: Instance, x: number, y: number): number {
  if (inst.kind === 'rift') return Math.max(1, Math.min(4, inst.players.length));
  let n = 0;
  for (const p of inst.players) if (Math.hypot(p.x - x, p.y - y) < 2400) n++;
  return Math.max(1, Math.min(4, n));
}

/** D3 pack composition: trash (6-14 of 1-3 types), champion pack (3-4 blue, 2 shared affixes) or rare + minions. */
export function spawnPack(inst: Instance, x: number, y: number, level: number, slot: number, o: PackOpts = {}): Pack {
  const theme = inst.zone.theme;
  const roster = themeMonsters(theme);
  const roll = inst.rng.next();
  const kind: Pack['kind'] = o.kind ?? (roll < CHAMPION_CHANCE ? 'champion' : roll < CHAMPION_CHANCE + RARE_CHANCE ? 'rare' : 'trash');
  const pack: Pack = { id: packSeq++, kind, alive: 0, slot };
  const players = playersFor(inst, x, y);
  const add = (def: MonsterDef, tier: EliteTier, affixes: string[] = [], name?: string) => {
    const pos = freePos(inst, x, y, 60 + pack.alive * 10, def.radius);
    createMob(inst, def, level, pos.x, pos.y, {
      tier, affixes, name, pack, dormant: o.dormant, players, difficulty: o.difficulty,
      progress: o.rift ? RIFT_PROGRESS[tier] ?? 0 : 0,
    });
    pack.alive++;
  };
  const weighted = (list: MonsterDef[]) => inst.rng.weighted(list.map((d) => [d, d.weight] as const));
  if (kind === 'champion') {
    // sturdier families make better champions (no suicide wisps)
    const def = weighted(roster.filter((d) => d.attack.kind !== 'explode'));
    const affixes = rollEliteAffixes(inst.rng, 2);
    const name = eliteName(inst.rng);
    const n = inst.rng.int(3, 4);
    for (let i = 0; i < n; i++) add(def, 1, affixes, name);
  } else if (kind === 'rare') {
    const def = weighted(roster.filter((d) => d.attack.kind !== 'explode'));
    add(def, 2, rollEliteAffixes(inst.rng, inst.rng.int(2, 3) + ((o.difficulty ?? inst.difficulty) >= 4 ? 1 : 0)), eliteName(inst.rng));
    const n = inst.rng.int(4, 6);
    for (let i = 0; i < n; i++) add(def, 3);
  } else {
    const types: MonsterDef[] = [];
    const k = inst.rng.int(1, 3);
    for (let i = 0; i < k * 3 && types.length < k; i++) {
      const d = weighted(roster);
      if (!types.includes(d)) types.push(d);
    }
    const n = inst.rng.int(6, 14);
    for (let i = 0; i < n; i++) add(weighted(types), 0);
  }
  return pack;
}

export function spawnGoblin(inst: Instance, x: number, y: number, level: number, dormant = false, difficulty?: number): Mob {
  const pos = freePos(inst, x, y, 40, MONSTERS.treasure_goblin.radius);
  const pack: Pack = { id: packSeq++, kind: 'goblin', alive: 1, slot: -1 };
  const m = createMob(inst, MONSTERS.treasure_goblin, level, pos.x, pos.y, { tier: 5, pack, dormant, players: playersFor(inst, x, y), difficulty });
  inst.counters.goblins++;
  for (const p of inst.playersNear(x, y, 1600)) inst.emitTo(p.id, { e: 'notice', text: 'A Treasure Goblin appears!', kind: 'info' });
  return m;
}

function nearPlayer(inst: Instance, p: Player, dist: number): { x: number; y: number } {
  for (let k = 0; k < 16; k++) {
    const a = inst.rng.next() * Math.PI * 2;
    const x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
    if (inst.cw.isFree(x, y, 30) && !inst.cw.segmentBlocked(p.x, p.y, x, y)) return { x, y };
  }
  return { x: p.x + 40, y: p.y };
}

function playerZoneLevel(inst: Instance, p: Player): number {
  if (inst.kind === 'rift') return inst.level;
  const [lo, hi] = inst.def.levelBand;
  return Math.max(lo, Math.min(hi, p.save.level));
}

function zoneDifficulty(inst: Instance, p: Player): number {
  return inst.kind === 'rift' ? inst.difficulty : playerDifficulty(p);
}

export function debugSpawnGoblin(inst: Instance, p: Player) {
  const pos = nearPlayer(inst, p, 260);
  spawnGoblin(inst, pos.x, pos.y, playerZoneLevel(inst, p), false, zoneDifficulty(inst, p));
}

export function debugSpawnElite(inst: Instance, p: Player) {
  const pos = nearPlayer(inst, p, 380);
  spawnPack(inst, pos.x, pos.y, playerZoneLevel(inst, p), -1, { kind: inst.rng.next() < 0.5 ? 'rare' : 'champion', rift: inst.kind === 'rift', difficulty: zoneDifficulty(inst, p) });
}

export { nearPlayer, playerZoneLevel, zoneDifficulty };
