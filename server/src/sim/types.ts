// Server-side entity model. Entities are plain objects (no class hierarchy) manipulated by the sim/* modules.

import type { PlayerLink } from '../contracts';
import type {
  CharacterSave, DerivedStats, Element, EliteTier, GameEvent, Item, LootView, MonsterDef, MoveState, SkillDef, SkillMods,
} from '../shared';
import type { Hashed } from './spatial';

export interface SaveX extends CharacterSave {
  /** Equipment misses since the last generated Legendary or Set, see rollDrops(). Persisted with the save. */
  lootPity?: number;
}

// ─────────────────────────── Buffs / statuses ───────────────────────────

export interface Buff {
  id: string;
  /** Remaining duration (ms). Infinity = while a condition holds (removed explicitly). */
  ms: number;
  /** Stack count (display + scaling). */
  st?: number;
  /** Generic damage bucket bonus (%). */
  dmg?: number;
  chc?: number;
  chd?: number;
  ias?: number;
  /** Hidden buffs are not shown in the HUD buff row. */
  hidden?: boolean;
}

export interface LiveMods { dmg: number; chc: number; chd: number; ias: number }

export type DotKind = 'bleed' | 'burn' | 'poison';

export interface Dot {
  kind: DotKind;
  owner: number;
  skill: string;
  /** Damage per tick (already includes the owner's multipliers at application time). */
  perTick: number;
  el: Element;
  tickMs: number;
  nextMs: number;
  leftMs: number;
  /** Bloodlust: heal the owner per tick. */
  heal?: boolean;
  /** Contagion: spread to nearby enemies on death. */
  spread?: boolean;
  /** Original duration and per-tick damage, for re-applying (spread). */
  durMs: number;
}

// ─────────────────────────── Monsters ───────────────────────────

export type MobState = 'idle' | 'chase' | 'windup' | 'charge' | 'recover' | 'flee' | 'return';

export interface Pack {
  id: number;
  kind: 'trash' | 'champion' | 'rare' | 'goblin' | 'boss' | 'custom';
  alive: number;
  /** Index of the map spawn point this pack came from (-1 = ad-hoc). */
  slot: number;
}

export interface BossState {
  ringMs: number;
  addsMs: number;
  enraged: boolean;
  slamCount: number;
}

export interface Mob extends Hashed {
  kind: 'mob';
  id: number;
  def: MonsterDef;
  /** Monster type id sent to clients (def.id, or 'training_dummy'). */
  type: string;
  /** Set only by an authored encounter; never accepted from a client/debug spawn. */
  adventureTarget?: string;
  adventureSite?: string;
  tier: EliteTier;
  level: number;
  /** Difficulty index (rifts: the rift's; fields: adopted from the player who found the pack). */
  diff: number;
  name: string;
  affixes: string[];
  hp: number;
  mhp: number;
  speed: number;
  /** Raw damage per hit before the player's defences. */
  dmg: number;
  windupMs: number;
  cooldownMs: number;
  flags: number;
  attackSeq: number;
  state: MobState;
  /** Target player id (0 = none). */
  target: number;
  homeX: number;
  homeY: number;
  pack: Pack | null;
  /** Remaining windup / recovery (ms). */
  stateMs: number;
  atkCdMs: number;
  attackFlagMs: number;
  stunMs: number;
  freezeMs: number;
  chillMs: number;
  /** Hunter's Mark (pierced enemies take +markPct% from the marking player's team). */
  markMs: number;
  markPct: number;
  /** Heart of the Void: inside a black hole. */
  holeMs: number;
  holePct: number;
  kbX: number;
  kbY: number;
  kbMs: number;
  dots: Dot[];
  dead: boolean;
  dummy: boolean;
  /** Idle and far from every player: AI skipped except periodic wake checks. */
  dormant: boolean;
  lastHitBy: number;
  lastDamagedT: number;
  /** Where the current windup attack lands (slam centre / projectile aim). */
  atkX: number;
  atkY: number;
  /** Fixed path and per-player contact history for one physical charge. */
  charge?: { dx: number; dy: number; left: number; hit: Set<number> };
  /** Countdown timers (ms) for elite affix abilities. */
  aff: { molten: number; frozen: number; plagued: number; vortex: number; mortar: number; electrified: number };
  /** Treasure goblin: ms since first noticed (-1 = not yet). */
  noticedMs: number;
  goldPileMs: number;
  fleeX: number;
  fleeY: number;
  fleeMs: number;
  boss: BossState | null;
  /** Cached line-of-sight to the target (re-evaluated periodically). */
  losMs: number;
  /** Straight walkable line to the target / clear line of fire (water does not block shots). */
  los: boolean;
  shotLos: boolean;
  /** Frost Nova Shatter: player id that froze it with the shatter rune, and nova depth. */
  shatterBy: number;
  shatterDepth: number;
  /** Rift progress awarded when it dies. */
  progress: number;
  /** Gives no XP / loot (boss adds, suicide explosions are handled separately). */
  noReward: boolean;
  faceLeft: boolean;
  moving: boolean;
  descVer: number;
  sepX: number;
  sepY: number;
  /** Molten affix: where the last trail patch was dropped. */
  trailX: number;
  trailY: number;
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
  /** Remaining life (ms); Infinity for permanent companions. */
  lifeMs: number;
  fireMs: number;
  rocketMs: number;
  chainMs: number;
  tickMs: number;
  wanderMs: number;
  targetId: number;
  tx: number;
  ty: number;
  /** Hydra head index / variant. */
  aux: number;
  attackFlagMs: number;
  faceLeft: boolean;
  moving: boolean;
  dead: boolean;
  descVer: number;
  /** Mammoth hydra (single big hydra). */
  big: boolean;
}

// ─────────────────────────── Projectiles / ground effects ───────────────────────────

/** Behaviour of a player projectile on hit. */
export type ProjKind =
  | 'arrow' | 'shard' | 'bolt' | 'rocket' | 'missile' | 'fireball' | 'river' | 'multi' | 'cluster'
  | 'mob' | 'spark' | 'ring';

export interface Strike {
  skill: string;
  /** Weapon-damage coefficient (1.5 = 150%). */
  coef: number;
  el: Element;
  /** Additive skill bucket (rune/tier/legendary dmg% + gear skill damage). */
  pct: number;
  /** Product of own-bucket multipliers (set bonuses, Devouring, ...). */
  mult?: number;
  /** Additional generic-bucket bonus (%). */
  gen?: number;
  /** Entity id reported as the damage source (summons), default the player. */
  src?: number;
  noCrit?: boolean;
  /** Skip on-hit procs (life per hit, area, ignite, electrify, ...). */
  noProc?: boolean;
  noArea?: boolean;
  primary?: boolean;
  /** Extra crit chance (%) for this strike. */
  chc?: number;
}

export interface Proj {
  id: number;
  kind: ProjKind;
  /** Visual id sent to clients. */
  v: string;
  /** Player that owns a friendly projectile (null for monster projectiles). */
  owner: Player | null;
  /** Monster that fired a hostile projectile. */
  mob: Mob | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  lifeMs: number;
  r: number;
  el: Element;
  strike: Strike | null;
  /** Hostile damage (raw, before player defences). */
  dmg: number;
  mobLevel: number;
  /** Pierce chance per hit (0..1); 1 = pierce everything. */
  pierce: number;
  /** Enemies already hit (shared across a Multishot volley). */
  hits: Set<number> | null;
  homing: number;
  turn: number;
  /** Hungering Arrow seeks the nearest enemy instead of a fixed target. */
  seek: boolean;
  splash: number;
  pierced: number;
  /** Behaviour flags copied from the skill (split, devour, mark, freeze, chill, battery). */
  bits: number;
  /** Lobbed projectiles (cluster arrow, mortar): explode at (tx, ty) when life ends. */
  tx: number;
  ty: number;
  dead: boolean;
}

export const PB_SPLIT = 1, PB_DEVOUR = 2, PB_MARK = 4, PB_FREEZE = 8, PB_CHILL = 16, PB_BATTERY = 32, PB_SENTRY4 = 64, PB_NOGRENADE = 128, PB_ROCKETS = 256;

export type GroundKind = 'molten' | 'blackhole' | 'rain' | 'trail' | 'pool';

export interface Ground {
  kind: GroundKind;
  x: number;
  y: number;
  r: number;
  endT: number;
  tickMs: number;
  nextT: number;
  owner: Player | null;
  strike: Strike | null;
  /** Hostile damage per tick. */
  dmg: number;
  mobLevel: number;
  /** Rain: waves left; black hole: caught enemy ids. */
  waves: number;
  follow: boolean;
  freeze: boolean;
  spellsteal: boolean;
  voidPct: number;
  caught: Set<number> | null;
  el: Element;
}

// ─────────────────────────── Loot / statics ───────────────────────────

export type LootPayload =
  | { type: 'item'; item: Item }
  | { type: 'gold'; amount: number }
  | { type: 'gem'; gem: string; rank: number }
  | { type: 'mat'; mat: 'deathsBreath'; amount: number }
  | { type: 'globe' };

export interface Loot {
  kind: 'loot';
  id: number;
  x: number;
  y: number;
  owner: Player;
  payload: LootPayload;
  view: LootView;
  ttlMs: number;
  /** Ms before it may be picked up (lets the fountain animation play). */
  armMs: number;
  dead: boolean;
}

export interface PortalEnt {
  kind: 'portal';
  id: number;
  x: number;
  y: number;
  to: 'town' | 'rift';
  name: string;
  /** Remaining life (ms); Infinity = permanent. */
  lifeMs: number;
}

// ─────────────────────────── Players ───────────────────────────

export interface InputMsg { seq: number; mx: number; my: number; dash: boolean }

export interface ChannelState { skill: string; graceMs: number; tickMs: number; devilMs: number; spunMs: number }

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
  /** Is this skill in one of the 4 slots? */
  slotted(skillId: string): SkillRuntime | null;
  setCount(setId: string): number;
  power(id: string): number;
  /** Stunned-enemy vulnerability multiplier from Jarring Slam / Anvil Vambraces. */
  stunMult: number;
  /** Frozen-enemy vulnerability multiplier (Bone Chill). */
  frozenMult: number;
  attackRange: number;
  dashCdMs: number;
}

export interface Known { ver: number; seen: number }

export interface Player extends Hashed {
  /** Debug-only, instance-local; never written to a character save. */
  debugInfiniteHp?: boolean;
  kind: 'player';
  id: number;
  link: PlayerLink;
  save: SaveX;
  name: string;
  ctx: PlayerCtx;
  mv: MoveState;
  hp: number;
  mhp: number;
  res: number;
  mres: number;
  flags: number;
  attackSeq: number;
  descVer: number;
  inQ: InputMsg[];
  lastIn: { mx: number; my: number };
  ack: number;
  faceLeft: boolean;
  moving: boolean;
  /** Facing locked towards the attack target for this long (ms). */
  faceLockMs: number;
  atkCdMs: number;
  /** Simulation time at which each skill is off cooldown. */
  readyAt: Map<string, number>;
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
  /** ms since the last primary/skill hit landed (Fury decay). */
  sinceHitMs: number;
  /** ms since the player last took damage (out-of-combat regeneration). */
  sinceHurtMs: number;
  loot: Set<Loot>;
  known: Map<number, Known>;
  lohSeen: Map<number, number>;
  /** Fallen Star 4pc: last time each element was dealt. */
  lastEle: Record<string, number>;
  ouroIdx: number;
  ouroMs: number;
  noticeFullAt: number;
  critHealMs: number;
  critHealCount: number;
  dealt: number;
  kills: number;
  /** Flow field for monster pathing towards this player. */
  ffTile: number;
  ffT: number;
  ff: Uint16Array | null;
  ffX0: number;
  ffY0: number;
  /** Hellforge / misc: last time an elite affix touched this player (spam limiters). */
  lastVortexT: number;
  /** Tick of the last respawn: the entity is re-introduced to clients (rem, then a fresh add). */
  respawnTick: number;
  /** Damage taken (diagnostics). */
  taken: number;
}

export type Ent = Player | Mob | Summon;

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
