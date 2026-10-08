// Boundary between server infrastructure (sockets, sessions, persistence, commands, world/channel
// management) and the gameplay simulation (server/src/sim). Both sides code against this file only.

import type { Theme } from '../../shared/src/data/zones';
import type { MapData } from '../../shared/src/mapgen';
import type { C2S, RiftState, S2C, ZoneInfo } from '../../shared/src/protocol';
import type { CharacterSave, DerivedStats } from '../../shared/src/types';

/** A connected player as seen by the simulation. Implemented by the infrastructure's Session. */
export interface PlayerLink {
  readonly sessionId: string;
  /** Live, mutable save. The sim mutates xp/level/paragon/gold/materials/gems/inventory/stats directly
   *  (use shared helpers: addXp, addToInventory) and then calls markDirty(). */
  readonly save: CharacterSave;
  /** Current derived stats. The sim may recompute after level-ups (computeStats from shared/stats). */
  derived: DerivedStats;
  /** Send a message to this client (snapshots, notices...). */
  send(msg: S2C): void;
  /** The save changed: infrastructure persists it and sends a throttled `char` update. */
  markDirty(): void;
}

export interface InstanceOptions {
  zoneId: string;          // key of ZONES
  channel: number;
  /** Unique instance key, e.g. "hearthmere#1", "whispering_glade#2", "rift#a8f3". */
  key: string;
  seed: number;
  theme: Theme;
  /** Rifts: monster level and difficulty fixed at creation. Fields/town: ignored. */
  level?: number;
  difficulty?: number;
  /** Rifts: display name of the player who opened it. */
  owner?: string;
  /** Rifts: called once when the Rift Guardian dies. */
  onRiftComplete?: () => void;
}

export interface PortalSpec {
  kind: 'rift' | 'town';
  x: number;
  y: number;
  label: string;
  /** Auto-despawn after this many ms (0 = never). */
  ttlMs: number;
}

/** A simulated map instance. Implemented by server/src/sim (export `createInstance`). */
export interface InstanceApi {
  readonly key: string;
  readonly zone: ZoneInfo;
  readonly map: MapData;
  /** Add a player; returns its entity id. `at` defaults to the map entry. The sim sends snapshots to link.send(). */
  addPlayer(link: PlayerLink, at?: { x: number; y: number }): number;
  removePlayer(link: PlayerLink): void;
  /** Queue a movement input (`in` message) for the player. */
  queueInput(link: PlayerLink, input: Extract<C2S, { t: 'in' }>): void;
  /** Equipment / skills / paragon / cube powers changed: refresh combat config and re-describe the player's look to viewers. */
  refreshPlayer(link: PlayerLink): void;
  /** Advance one 50 ms tick and send snapshots. Called by the infrastructure's world loop at 20 Hz. */
  tick(): void;
  playerCount(): number;
  /** Live authoritative position + line of sight. Caller supplies a server-owned NPC/portal location. */
  canInteract(link: PlayerLink, x: number, y: number, radius: number): boolean;
  spawnPortal(spec: PortalSpec): number;
  removeEntity(id: number): void;
  /** World-side debug helpers: 'goblin' | 'elite' | 'heal' | 'boss'. Returns an error string or null. */
  debug(link: PlayerLink, op: string): string | null;
  riftState(): RiftState | null;
  /** Broadcast an event/notice to every player in the instance. */
  notice(text: string, kind: 'rift' | 'boss' | 'info' | 'legendary' | 'warn'): void;
  /** Average and max tick time in ms over the last ~5 s (for diagnostics). */
  tickStats(): { avg: number; max: number };
  destroy(): void;
}

export type CreateInstance = (opts: InstanceOptions) => InstanceApi;
