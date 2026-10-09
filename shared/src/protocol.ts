// Network protocol (WebSocket + MessagePack). Short keys keep snapshots small; positions are
// integers in world units, life is sent as a 0-1000 fraction.

import type { Theme, ZoneKind } from './data/zones';
import type { EliteTier } from './items';
import type { AncientTier, CharacterSave, ClassId, DerivedStats, ItemKind, ItemLook, Materials, Rarity } from './types';

export const PROTOCOL_VERSION = 1;
// Existing transport budgets, shared with the connection-local receipt window.
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const MAX_MESSAGES_PER_SECOND = 60;
export const COMMAND_TIMEOUT_MS = 8000;

export type EntKind = 'player' | 'mob' | 'summon' | 'loot' | 'npc' | 'portal';

// Entity state flags
export const F_LEFT = 1 << 0;      // facing left
export const F_MOVING = 1 << 1;
export const F_ATTACK = 1 << 2;    // attack animation window
export const F_CAST = 1 << 3;
export const F_CHANNEL = 1 << 4;   // whirlwind etc.
export const F_STUN = 1 << 5;
export const F_FROZEN = 1 << 6;
export const F_DEAD = 1 << 7;
export const F_DASH = 1 << 8;
export const F_SHIELD = 1 << 9;
export const F_CHILL = 1 << 10;
export const F_BURN = 1 << 11;
export const F_BLEED = 1 << 12;
export const F_POISON = 1 << 13;
export const F_INVULN = 1 << 14;
export const F_WINDUP = 1 << 15;   // monster telegraphing an attack

/** Visible paper-doll slots. */
export type LookSlot = 'head' | 'shoulders' | 'chest' | 'hands' | 'legs' | 'feet' | 'waist' | 'mainhand' | 'offhand';
export const LOOK_SLOTS: LookSlot[] = ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'waist', 'mainhand', 'offhand'];

export interface PlayerLook {
  classId: ClassId;
  slots: Partial<Record<LookSlot, ItemLook>>;
}

export interface LootView {
  lk: 'item' | 'gold' | 'gem' | 'mat' | 'globe';
  name: string;
  rarity?: Rarity;
  ancient?: AncientTier;
  amount?: number;
  look?: ItemLook;
  kind?: ItemKind;
  gem?: string;
}

/** Sent once when an entity enters a client's area of interest (and again if its look changes). */
export interface EntDesc {
  id: number;
  k: EntKind;
  t: string;          // class id, monster id, summon type, loot kind, npc role
  n?: string;         // display name
  lv?: number;
  el?: EliteTier;     // monsters: 0 normal, 1 champion, 2 rare, 3 minion, 4 boss, 5 goblin
  af?: string[];      // elite affixes
  mh?: number;        // max life
  r: number;          // radius
  sc?: number;        // scale
  look?: PlayerLook;
  owner?: number;     // summons / loot owner
  loot?: LootView;
  pl?: number;        // paragon level (players)
}

/** Compact per-tick state: [id, x, y, hp(0..1000), flags, attackSeq] repeated. */
export const STATE_STRIDE = 6;

export interface BuffView { id: string; ms: number; st?: number }

/** Authoritative state of the receiving player (sent every tick). */
export interface MeState {
  x: number;
  y: number;
  dashMs: number;
  dashCd: number;
  hp: number;
  mhp: number;
  res: number;
  mres: number;
  /** Remaining cooldown (ms) for each of the 4 skill slots. */
  cds: number[];
  /** Charges / active summons per slot (Sentry etc.). */
  ch: number[];
  buffs: BuffView[];
  xp: number;
  lv: number;
  pxp: number;
  pl: number;
  gold: number;
  dead: number; // ms until respawn, 0 if alive
}

export type GameEvent =
  | { e: 'dmg'; t: number; a: number; c?: 1; el: number; s?: number; k?: 1; p?: 1; dot?: 1 }
  | { e: 'heal'; t: number; a: number }
  | { e: 'die'; t: number; el: number; x: number; y: number; big?: 1 }
  | { e: 'cast'; s: number; sk: string; r?: string; x: number; y: number; tx: number; ty: number; rad?: number }
  | { e: 'proj'; id: number; s: number; v: string; x: number; y: number; vx: number; vy: number; life: number; el: number; h?: number; sz?: number }
  | { e: 'pend'; id: number; x: number; y: number; hit?: 1 }
  | { e: 'aoe'; v: string; x: number; y: number; r: number; d: number; el: number; s?: number; delay?: number; a?: number }
  | { e: 'tele'; v: string; x: number; y: number; r: number; d: number; a?: number; w?: number }
  | { e: 'beam'; v: string; x: number; y: number; tx: number; ty: number; el: number; d: number }
  | { e: 'level'; t: number; lv: number }
  | { e: 'paragon'; t: number; lv: number }
  | { e: 'pickup'; t: number; l: number; lk: LootView['lk']; name: string; rarity?: Rarity; amount?: number }
  | { e: 'notice'; text: string; kind: 'rift' | 'boss' | 'info' | 'legendary' | 'warn' }
  | { e: 'shake'; m: number; d: number }
  | { e: 'dash'; t: number; x: number; y: number; tx: number; ty: number };

export const ELEMENT_INDEX = ['physical', 'fire', 'cold', 'lightning', 'poison', 'arcane', 'holy'] as const;

export interface RiftState {
  progress: number;           // 0..100
  phase: 'hunt' | 'guardian' | 'done';
  level: number;
  difficulty: number;
  elapsedMs: number;
  guardian?: number;          // entity id
  owner: string;
}

export interface ZoneInfo {
  zone: string;
  name: string;
  kind: ZoneKind;
  theme: Theme;
  seed: number;
  channel: number;
  instance: string;
  difficulty: number;
}

export interface WorldInfo {
  online: number;
  channels: { zone: string; channel: number; players: number }[];
  riftOpen: boolean;
}

export interface Snapshot {
  t: 's';
  tick: number;
  time: number;
  ack: number;
  me: MeState;
  add?: EntDesc[];
  upd: number[];
  rem?: number[];
  ev?: GameEvent[];
  rift?: RiftState;
}

export type S2C =
  | { t: 'welcome'; you: number; char: CharacterSave; derived: DerivedStats; zone: ZoneInfo; time: number; world: WorldInfo }
  | { t: 'zone'; you: number; zone: ZoneInfo }
  | Snapshot
  | { t: 'char'; char: CharacterSave; derived: DerivedStats }
  | { t: 'res'; id: number; ok: boolean; err?: string; data?: unknown }
  | { t: 'chat'; ch: 'zone' | 'world' | 'system'; from?: string; cls?: ClassId; text: string }
  | { t: 'afk'; ms: number; xp: number; gold: number; kills: number; mats: Partial<Materials>; zone: string; levels: number }
  | { t: 'world'; world: WorldInfo }
  | { t: 'pong'; c: number; s: number }
  | { t: 'err'; msg: string };

export type CmdOp =
  | 'equip' | 'unequip' | 'swapInv' | 'destroy'
  | 'stashDeposit' | 'stashWithdraw'
  | 'adventure'
  | 'quest'
  | 'salvage' | 'salvageAll' | 'enchantRoll' | 'enchantPick' | 'upgrade' | 'transmute' | 'extract' | 'cubeEquip' | 'reforge' | 'socket'
  | 'insertGem' | 'removeGem' | 'fuseGem'
  | 'skillSlot' | 'skillRune' | 'skillTier' | 'skillReset'
  | 'paragon' | 'paragonReset'
  | 'travel' | 'riftOpen' | 'riftEnter' | 'leave' | 'channel'
  | 'debug';

export type C2S =
  | { t: 'hello'; name: string; classId: ClassId; v: number }
  | { t: 'in'; seq: number; mx: number; my: number; dash?: 1 }
  // IDs are positive safe integers, strictly increasing for new requests on a connection.
  // Reusing an ID means retrying that request, not performing another action.
  | { t: 'cmd'; id: number; op: CmdOp; a?: Record<string, unknown> }
  | { t: 'chat'; text: string }
  | { t: 'ping'; c: number };
