import type { Point } from './townTypes';
import type { GroundGeometry } from './townGeometry';
import type { Prop, NpcSpot, Portal } from './mapgen';
import type { Item } from './types';

export interface AdventureData {
  id: string;
  size: [number, number];
  geometry: GroundGeometry;
  paths: { points: Point[]; width: number; bridge?: boolean }[];
  scenery: Prop[];
  npcs: NpcSpot[];
  portals: Portal[];
  interactions: { id: string; name: string; x: number; y: number; radius: number; kind: 'person' | 'cart' | 'ledger' }[];
  encounters: { id: string; x: number; y: number; members: { type: string; dx: number; dy: number; tier?: 0 | 2; name?: string; questTarget?: boolean }[] }[];
  landmarks: { name: string; x: number; y: number }[];
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
