// Server-side entity model. Entities are plain objects (no class hierarchy) manipulated by the sim/* modules.

import type { Element, EliteTier, GameEvent, Item, LootView, MonsterDef, MoveState, CharacterSave, SkillDef, SkillMods, DerivedStats } from '../shared';
import type { Hashed } from './spatial';
import type { Instance } from '../instance';
import type { Session } from '../net/session';

export interface SaveX extends CharacterSave {
  /** Non-legendary item rolls since the last legendary (bad-luck protection), see rollDrops(). */
  lootPity?: number;
}

// ─────────────────────────── Buffs / statuses ───────────────────────────

export interface Buff {
  id: string;
  /** Remaining duration (ms). */
  ms: number;
  /** Stack count (display + scaling). */
  st?: number;
  /** Generic damage bucket bonus (%). */
  dmg?: number;
  chc?: number;
  chd?: number;
  ias?: number;
  /** Movement speed bonus (%). */
  move?: number;
  /** Damage-taken reduction (0..1, multiplicative). */
  dr?: number;
}

export interface LiveMods { dmg: number; chc: number; chd: number; ias: number; move: number; dr: number }

export interface Dot {
  kind: 'bleed' | 'burn' | 'poison' | 'molten';
  owner: number;
  skill: string;
  /** Damage per tick (already includes the owner's multipliers at application time). */
  perTick: number;
  el: Element;
  tickMs: number;
  nextMs: number;
  leftMs: number;
  /** Rune / tier flags carried by the bleed. */
  heal?: boolean;
  spread?: boolean;
}

// ─────────────────────────── Monsters ───────────────────────────

export type MobState = 'idle' | 'chase' | 'windup' | 'flee' | 'return';

export interface Pack {
  id: number;
  kind: 'trash' | 'champion' | 'rare' | 'goblin' | 'boss' | 'custom';
  members: Mob[];
  alive: number;
  x: number;
  y: number;
  /** Index of the map spawn point this pack came from (-1 = ad-hoc). */
  slot: number;
}

export interface Mob extends Hashed {
  kind: 'mob';
  id: number;
  def: MonsterDef;
  tier: EliteTier;
  level: number;
  name: string;
  affixes: string[];
  hp: number;
  mhp: number;
  speed: number;
  dmg: number;
  windupMul: number;
  cdMul: number;
  flags: number;
  attackSeq: number;
  state: MobState;
  target: number;
  homeX: number;
  homeY: number;
  pack: Pack | null;
  windupMs: number;
  atkCdMs: number;
  stunMs: number;
  freezeMs: number;
  chillMs: number;
  markMs: number;
  markPct: number;
  holeMs: number;
  holePct: number;
  kbX: number;
  kbY: number;
  kbMs: number;
  dots: Dot[];
  dead: boolean;
  dummy: boolean;
  suicide: boolean;
  lastHitBy: number;
  /** Where the current windup attack lands (slam centre / projectile aim). */
  atkX: number;
  atkY: number;
  /** Countdown timers (ms) for elite affix abilities. */
  aff: { molten: number; frozen: number; plagued: number; vortex: number; mortar: number };
  /** Treasure goblin: ms since first noticed (-1 = not yet). Boss: phase timers. */
  noticedMs: number;
  bossTimers: { ring: number; adds: number; enraged: boolean } | null;
  retargetMs: number;
  /** Frozen-by-owner bookkeeping for Shatter. */
  frozenBy: number;
  born: number;
}

// ─────────────────────────── Summons ───────────────────────────

export type SummonType = 'sentry' | 'hydra' | 'wolf' | 'bat' | 'raven' | 'dust_devil';

export interface Summon extends Hashed {
  kind: 'summon';
  id: number;
  type: SummonType;
  owner: Player;
  /** Skill that spawned it (for mods lookup). */
  skill: string;
  flags: number;
  attackSeq: number;
  hp: number;
  mhp: number;
  /** Remaining life (ms); Infinity for permanent companions. */
  lifeMs: number;
  /** Generic countdown timers. */
  fireMs: number;
  rocketMs: number;
  chainMs: number;
  tickMs: number;
  wanderMs: number;
  targetId: number;
  vx: number;
  vy: number;
  /** Extra data: hydra head index, etc. */
  aux: number;
  dead: boolean;
}

// ─────────────────────────── Loot / statics ───────────────────────────

export type LootPayload =
  | { type: 'item'; item: Item }
  | { type: 'gold'; amount: number }
  | { type: 'gem'; gem: string; rank: number }
  | { type: 'mat'; mat: 'deathsBreath'; amount: number }
  | { type: 'globe' };

export interface Loot extends Hashed {
  kind: 'loot';
  id: number;
  owner: Player;
  payload: LootPayload;
  view: LootView;
  ttlMs: number;
  /** Ms before it may be picked up (lets the fountain animation play). */
  armMs: number;
}

export interface Npc extends Hashed {
  kind: 'npc';
  id: number;
  role: string;
  name: string;
  flags: number;
}

export interface PortalEnt extends Hashed {
  kind: 'portal';
  id: number;
  /** 'town' leads back to Hearthmere; 'rift' leads into the open rift. */
  to: 'town' | 'rift' | 'zone';
  name: string;
  flags: number;
  /** Remaining life (ms); Infinity = permanent. */
  lifeMs: number;
  riftId?: string;
}

// ─────────────────────────── Players ───────────────────────────

export interface InputMsg { seq: number; mx: number; my: number; dash: boolean }

export interface ChannelState { skill: string; graceMs: number; tickMs: number; devilMs: number; critHealMs: number; rendMs: number }

export interface SkillRuntime {
  def: SkillDef;
  mods: SkillMods;
  flags: Set<string>;
}

/** Cached, derived combat data for one player (rebuilt whenever the save changes). */
export interface PlayerCtx {
  d: DerivedStats;
  /** Slot skills (null = empty) with merged rune/tier/legendary/set mods. */
  slots: (SkillRuntime | null)[];
  primary: SkillRuntime;
  /** Mods for any skill id (lazily computed; used for Rend via Whirlwind 4pc etc.). */
  modsOf(skillId: string): SkillRuntime;
  /** Union of all behaviour flags across slotted skills + primary (cheap global checks). */
  anyFlag(flag: string): boolean;
  setCount(setId: string): number;
  power(id: string): number;
  /** Stunned-enemy vulnerability multiplier from Jarring Slam / Anvil Vambraces. */
  stunMult: number;
  /** Frozen-enemy vulnerability multiplier (Bone Chill). */
  frozenMult: number;
  attackRange: number;
}

export interface Player extends Hashed {
  kind: 'player';
  id: number;
  session: Session;
  save: SaveX;
  ctx: PlayerCtx;
  inst: Instance;
  mv: MoveState;
  hp: number;
  mhp: number;
  res: number;
  mres: number;
  flags: number;
  attackSeq: number;
  inQ: InputMsg[];
  lastIn: { mx: number; my: number };
  ack: number;
  facingLeft: boolean;
  moving: boolean;
  atkCd: number;
  cds: number[];
  attackFlagMs: number;
  castFlagMs: number;
  buffs: Buff[];
  live: LiveMods;
  summons: Summon[];
  channel: ChannelState | null;
  deadMs: number;
  stunMs: number;
  frozenMs: number;
  invulnMs: number;
  /** ms since the last primary attack landed (Fury decay). */
  idleHitMs: number;
  /** Fury/other resource accumulators. */
  regenAcc: number;
  hpRegenAcc: number;
  loot: Set<Loot>;
  /** AOI: entity id -> last tick seen / description version. */
  known: Map<number, number>;
  knownVer: Map<number, number>;
  descVer: number;
  lohSeen: Map<number, number>;
  lastEle: Record<string, number>;
  ouro: { el: Element; ms: number };
  portalGrace: number;
  lastCombatMs: number;
  noticeFullAt: number;
  /** DPS bookkeeping for tests/debug. */
  dealt: number;
  townChannel: number;
  /** Cooldown of events that must not spam. */
  critHealMs: number;
  deepFreezeMs: number;
  resTrickle: number;
  /** Debug god-ish helpers. */
  name: string;
  classId: string;
}

export type Ent = Player | Mob | Summon | Loot | Npc | PortalEnt;

// ─────────────────────────── Events ───────────────────────────

export interface EvRec {
  ev: GameEvent;
  x: number;
  y: number;
  /** Players for whom the event is always relevant (attacker / target), 0 = none. */
  a: number;
  b: number;
  /** If set, only this player receives the event. */
  only: number;
}
