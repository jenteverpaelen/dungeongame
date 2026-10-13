// Network protocol (WebSocket + MessagePack). Short keys keep snapshots small; positions are
// integers in world units, life is sent as a 0-1000 fraction.

import type { Theme, ZoneKind } from './data/zones';
import type { EliteTier } from './items';
import type { AncientTier, CharacterSave, ClassId, DerivedStats, ItemKind, ItemLook, Materials, Rarity } from './types';

export const PROTOCOL_VERSION = 29; // 29: xp event, chat role, staff desc (owner list 2026-10-13); 28: health potion (in.potion, me.potionCd); 27: build tools (loadouts, build codes, dummy bench), depth classes; 26: merge of 24 (stash tabs stashMove/stashBuyTab, afk fields) and 25 (gear look V2 packed fx); 25: gear look V2
/** Sent when `hello` carries another protocol version. The client reloads itself once on seeing exactly this text. */
export const CLIENT_OUTDATED_MESSAGE = 'Your game is out of date. Please refresh the page.';
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
export const F_SLOW = 1 << 16;     // power-status slow (movement only; chill has its own bit)

/** Visible paper-doll slots. */
export type LookSlot = 'head' | 'shoulders' | 'chest' | 'hands' | 'legs' | 'feet' | 'waist' | 'mainhand' | 'offhand';
export const LOOK_SLOTS: LookSlot[] = ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'waist', 'mainhand', 'offhand'];

export interface PlayerLook {
  title?:string;
  appearance?: import('./appearance').HeroAppearance;
  classId: ClassId;
  /** Paper-doll looks; since protocol 22 each carries `fx` (packed gear visual progression, gearVisual.ts). */
  slots: Partial<Record<LookSlot, ItemLook>>;
  /** Protocol 22: packed progression (gearVisual.ts) of the jewellery and bracers, which are not paper-doll parts:
   *  they feed the floating charms and the gear rank. Numbers only, to keep descriptors small. */
  jw?: Partial<Record<import('./gearVisual').CharmSlot, number>>;
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
  st?: StaffRole;     // players: staff badge over the head
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
  /** Remaining health-potion cooldown (ms), 0 = ready (POTION). */
  potionCd: number;
  /** Movement speed % in effect when it differs from the sheet (channel slows / rules / moveWhileChannel); prediction uses it. */
  ms?: number;
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
  /** Town portal cast (sent only to the caster): ms > 0 starts the bar, 0 ends it (done or interrupted). */
  | { e: 'recall'; t: number; ms: number }
  /** XP a kill gave this player (sent only to them): amount and the monster's position. */
  | { e: 'xp'; t: number; a: number; x: number; y: number }
  | { e: 'die'; t: number; el: number; x: number; y: number; big?: 1 }
  | { e: 'cast'; s: number; sk: string; r?: string; x: number; y: number; tx: number; ty: number; rad?: number }
  | { e: 'proj'; id: number; s: number; v: string; x: number; y: number; vx: number; vy: number; life: number; el: number; h?: number; sz?: number }
  | { e: 'pend'; id: number; x: number; y: number; hit?: 1 }
  | { e: 'aoe'; v: string; x: number; y: number; r: number; d: number; el: number; s?: number; delay?: number; a?: number; /** follows entity `s` */ f?: 1; /** a count (Orrery spheres) */ n?: number }
  | { e: 'tele'; v: string; x: number; y: number; r: number; d: number; a?: number; w?: number; s?: number }
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

export interface DungeonState {
  stage: number;
  phase: 'ready' | 'active' | 'done';
  remaining: number;
  target: string;
  /** Optional for older clients/servers; frozen on final clear. */
  elapsedMs?: number;
  totalStages?: number;
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

export interface FieldEventState { id: string; phase: 'ready'|'active'|'recovering'; remaining: number; joined: boolean }
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
  dungeon?: DungeonState;
  fieldEvents?: FieldEventState[];
}

export type S2C =
  | { t: 'auth'; op: AuthOp; ok: boolean; mode: AccountMode; err?: string; username?: string; token?: string; recoveryCodes?: string[]; characters?: AuthCharacter[];
      info?: AccountInfo; sessions?: AccountSession[]; events?: AccountActivity[]; data?: unknown }
  | { t: 'welcome'; you: number; char: CharacterSave; derived: DerivedStats; zone: ZoneInfo; time: number; world: WorldInfo }
  | { t: 'zone'; you: number; zone: ZoneInfo }
  | Snapshot
  | { t: 'char'; char: CharacterSave; derived: DerivedStats }
  | { t: 'res'; id: number; ok: boolean; err?: string; data?: unknown }
  | { t: 'chat'; ch: import('./social').ChatChannel | 'system'; from?: string; to?:string; cls?: ClassId; text: string;messageId?:string; item?:import('./types').Item; build?: import('./buildCode').BuildCode; role?: StaffRole }
  | { t: 'afk'; ms: number; xp: number; gold: number; kills: number; mats: Partial<Materials>; zone: string; levels: number;
      /** v2 breakdown (F-MET-02): kills/min used, whether it is the hero's own measured rate, the offline share, cap hit. */
      rate?: number; basis?: 'own' | 'assumed'; efficiency?: number; capped?: boolean }
  | { t: 'world'; world: WorldInfo }
  | { t: 'party'; party: import('./party').PartyView }
  | { t: 'social'; social: import('./social').SocialView }
  | { t: 'pong'; c: number; s: number }
  | { t: 'err'; msg: string };

export type CmdOp = 'onboarding'
  | 'party'
  | 'social'
  | 'inspect'
  | 'community'
  | 'collection'
  | 'merchant'
  | 'equip' | 'unequip' | 'swapInv' | 'destroy' | 'itemProtect'
  | 'stashDeposit' | 'stashWithdraw' | 'stashMove' | 'stashBuyTab'
  | 'adventure'
  | 'quest'
  | 'salvage' | 'salvageAll' | 'enchantRoll' | 'enchantPick' | 'rekindle' | 'upgrade' | 'transmute' | 'extract' | 'cubeEquip' | 'reforge' | 'socket'
  | 'insertGem' | 'removeGem' | 'fuseGem'
  | 'skillSlot' | 'skillRune' | 'skillTier' | 'skillReset' | 'skillNode' | 'skillPrimary' | 'skillAutoCast' | 'targetPriority' | 'skillCast' | 'skillAutoRule' | 'passive'
  | 'paragon' | 'paragonReset'
  | 'buildSheet' | 'bench' | 'loadout' | 'applyBuild'
  | 'travel' | 'riftOpen' | 'riftEnter' | 'leave' | 'townPortal' | 'portalBack' | 'channel'
  | 'debug';

/** Account operations, sent before `hello`. `status` is only ever a server notice. */
export type AuthOp = 'status' | 'register' | 'login' | 'resume' | 'logout' | 'recover' | 'password' | 'codes'
  // Devices & activity, personal data (export, deletion with a grace period); all need a logged-in socket before `hello`.
  | 'sessions' | 'revoke' | 'export' | 'deleteAccount' | 'cancelDeletion' | 'deleteCharacter' | 'restoreCharacter';
export type AccountMode = 'off' | 'optional' | 'required';
/** Staff accounts named by the server operator (STAFF_ACCOUNTS): their chat lines and nameplates carry a badge. */
export type StaffRole = 'dev';
/** The refusal for `hello` with `existing` when no hero has that name. */
export const NO_SUCH_HERO_MESSAGE = 'No hero with that name was found. Check the spelling.';
/** `deleteAt`: the hero is scheduled for deletion at this time (epoch ms) and cannot be played until restored. */
/** One hero on the account. `look` and `zone` feed the hero-select scene (docs/rework/ui/CHARACTER_SCREENS.md §2). */
export interface AuthCharacter { name: string; classId: ClassId; level: number; deleteAt?: number; look?: PlayerLook; zone?: string }
/** Account facts the dialog shows: codes left, the grace period and a pending account deletion. */
export interface AccountInfo { recoveryLeft: number; graceDays: number; deletionAt?: number }
export interface AccountSession { id: string; device: string; created: number; lastUsed: number; current: boolean }
export interface AccountActivity { t: number; k: string; d?: string }

export type C2S =
  | { t: 'auth'; op: Exclude<AuthOp, 'status'>; username?: string; password?: string; token?: string; code?: string; newPassword?: string;
      /** revoke: a session id or 'others'. deleteCharacter/restoreCharacter: the hero's name. deleteAccount: the username typed again. */
      session?: string; character?: string; confirm?: string }
  /** `existing`: load a hero that already exists and never create one (Continue a hero, Bring a hero from before accounts). */
  | { t: 'hello'; name: string; classId: ClassId; v: number; appearance?: import('./appearance').HeroAppearance; tutorial?: boolean; existing?: boolean }
  | { t: 'in'; seq: number; mx: number; my: number; dash?: 1; potion?: 1 }
  // IDs are positive safe integers, strictly increasing for new requests on a connection.
  // Reusing an ID means retrying that request, not performing another action.
  | { t: 'cmd'; id: number; op: CmdOp; a?: Record<string, unknown>; r?: import('./commandState').CommandRequest }
  | { t: 'chat'; text: string; ch?:import('./social').ChatChannel; to?:string }
  | { t: 'ping'; c: number };
