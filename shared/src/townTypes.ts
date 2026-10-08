import type { NpcSpot, Portal } from './mapgen';

export type Point = [number, number];
export interface TownFloor { id: string; kind: 'road' | 'court'; polygon: Point[] }
export interface TownBuilding {
  id: string; label: string; footprint: Point[]; baseline: Point[];
  heightClass: string; doors: { id: string; a: Point; b: Point; approach: Point; inside: Point }[];
}
export interface TownData {
  version: 1;
  id: string;
  stage: 'blockout';
  size: Point;
  entry: { x: number; y: number };
  floors: TownFloor[];
  buildings: TownBuilding[];
  barriers: { id: string; a: Point; b: Point; radius: number }[];
  props: { id: string; x: number; y: number; radius: number }[];
  npcs: (NpcSpot & { approach: Point; interactionRadius: number; idle: string })[];
  portals: Portal[];
  districts: { id: string; label: string; polygon: Point[] }[];
  routes: { label: string; points: Point[] }[];
  // Filled at the approved look/life milestones, never simulated with reference assets.
  lights: { id: string; position: Point; color: number; radius: number; flicker: number }[];
  emitters: { id: string; position: Point; kind: string; rate: number }[];
  sounds: { id: string; position: Point; kind: string; radius: number }[];
}
