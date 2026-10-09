import type { Point } from './townTypes';
import type { GroundGeometry } from './townGeometry';
import type { Prop, NpcSpot, Portal } from './mapgen';
import type { Item } from './types';

export interface AdventureData {
  id: string;
  surface?: 'masonry';
  /** Ordered, explicitly activated encounters in a private dungeon. */
  dungeon?: { stages: { id: string; trigger: string; encounter: string; area: Point[] }[] };
  size: [number, number];
  geometry: GroundGeometry;
  paths: { points: Point[]; width: number; bridge?: boolean }[];
  scenery: Prop[];
  npcs: NpcSpot[];
  portals: Portal[];
  interactions: { id: string; name: string; x: number; y: number; radius: number; kind: 'person' | 'cart' | 'ledger' | 'marker' | 'mechanism' }[];
  encounters: { id: string; x: number; y: number; members: { type: string; dx: number; dy: number; tier?: 0 | 2; name?: string; questTarget?: boolean; combat?: 'keeper' }[] }[];
  landmarks: { name: string; x: number; y: number }[];
  locations: { id: string; x: number; y: number; radius: number }[];
  wheel: { x: number; y: number; radius: number };
  routes: Point[][];
}

/** Revision-pinned, optional per-character state. Absent means never accepted. */
export interface RillwakeQuest {
  revision: 1;
  cart: boolean;
  warden: boolean;
  ledger: boolean;
  claimed: boolean;
  /** Generated once on successful ledger recovery, then fixed through claim/retry. */
  reward?: Item;
}
