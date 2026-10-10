import type { NpcSpot, Portal } from './mapgen';

export type Point = [number, number];

/** Parametric look the town renderer paints from (docs/rework/DESIGN.md §4). Collision never reads it. */
export interface TownBuildingKit {
  shape: 'rect' | 'round';
  wall: 'plaster' | 'stone' | 'timber' | 'planks' | 'brick';
  wallColor: string;
  trimColor: string;
  roof: 'gable' | 'gableFront' | 'hip' | 'cone' | 'dome' | 'awning' | 'flat';
  roofMat: 'tile' | 'slate' | 'thatch' | 'shingle' | 'cloth' | 'glass' | 'copper';
  roofColor: string;
  /** Windows per footprint edge index: positions along the edge (0..1) and storey count (`upper`: skip the ground storey). */
  windows?: { face: number; at: number[]; rows?: number; lit?: boolean; upper?: boolean }[];
  doors?: { face: number; at: number; w?: number; kind?: 'wood' | 'iron' | 'arch' | 'open' | 'double' }[];
  sign?: { face: number; at: number; emblem: 'ember' | 'hammer' | 'gem' | 'key' | 'eye' | 'cube' | 'anchor' | 'fish' | 'wheel' };
  awning?: { face: number; from: number; to: number; colors: [string, string] };
  chimneys?: { at: Point; height: number }[];
  flowerBoxes?: boolean;
  lanterns?: { face: number; at: number }[];
  /** Tower lean in world units at the top (crooked mystic tower). */
  lean?: number;
  /** Open-front forge: draws the glowing hearth inside the front wall. */
  hearth?: { face: number; from: number; to: number };
  /** Interior cutaway: back walls stay, roof and front walls fade while the hero is inside. */
  cutaway?: boolean;
  /** Glass dome / rotunda columns. */
  columns?: number;
  /** Lighthouse lantern room under the roof (the Hearthlight). */
  beacon?: boolean;
  /** Glowing wall glyphs, hanging charms and a violet lantern (the mystic's tower). */
  runes?: boolean;
  /** Open stall front with a counter and goods. */
  goods?: 'fish' | 'oil';
}

export interface TownBuildingLook {
  style: string; eaveHeight: number;
  roof: { vertices: [number, number, number][]; faces: number[][] };
  chimney: { position: Point; height: number };
  dormer?: { position: Point; elevation: number; width: number };
  sign?: { position: Point; height: number; emblem: 'wren' };
  doorFace?: number;
  roofColor?: string;
  ridgeHeight?: number;
  kit?: TownBuildingKit;
}
export interface TownFloor { id: string; kind: 'road' | 'court'; polygon: Point[] }
export interface TownBuilding {
  id: string; label: string; footprint: Point[]; baseline: Point[];
  heightClass: string; doors: { id: string; a: Point; b: Point; approach: Point; inside: Point }[];
  look?: TownBuildingLook;
  interior?: { floors: Point[][]; label: string; target: Point };
}
/** Painted ground material regions, drawn in order (later on top). Purely visual. */
export interface TownGround { id: string; kind: 'cobble' | 'flag' | 'dirt' | 'grass' | 'sand' | 'planks' | 'garden' | 'moss' | 'stone'; polygon?: Point[]; path?: Point[]; width?: number }
export interface TownData {
  version: 1;
  id: string;
  stage: 'blockout' | 'look-slice' | 'complete';
  size: Point;
  entry: { x: number; y: number };
  floors: TownFloor[];
  buildings: TownBuilding[];
  barriers: { id: string; a: Point; b: Point; radius: number; kind?: 'fence' | 'palisade' | 'hedge' | 'wall' | 'rail' }[];
  props: { id: string; x: number; y: number; radius: number; kind?: string; height?: number; variant?: number; scale?: number; flip?: boolean }[];
  npcs: (NpcSpot & { approach: Point; interactionRadius: number; idle: string; look?: 'smith-slice' | 'jeweler' | 'mystic'; bark?: string })[];
  portals: Portal[];
  districts: { id: string; label: string; polygon: Point[] }[];
  routes: { label: string; points: Point[] }[];
  // Filled at the approved look/life milestones, never simulated with reference assets.
  lights: { id: string; position: Point; color: number; radius: number; flicker: number; height?: number; building?: string }[];
  emitters: { id: string; position: Point; kind: string; rate: number }[];
  sounds: { id: string; position: Point; kind: string; radius: number }[];
  lookSlice?: { bounds: [number, number, number, number]; seed: number };
  landscape?: { id: string; kind: 'water' | 'woods' | 'ash' | 'cliff' | 'meadow' | 'deep'; polygon: Point[] }[];
  details?: { id: string; kind: 'banner' | 'puddle' | 'laundry'; position: Point; width: number }[];
  villagers?: { id: string; look: string; path: Point[]; speed: number; pause: number }[];
  lighting?: { ambient: number; shadow: Point; strength: number };
  /** Visual-only scenery with no collision (flowers, reeds, boats on water, nets, string lights...). */
  decor?: { id: string; kind: string; x: number; y: number; scale?: number; variant?: number; flip?: boolean; to?: Point }[];
  /** Visual-only townsfolk standing at their work (look = resident preset key; see client npcLooks.ts). */
  residents?: { id: string; look: string; name: string; x: number; y: number; facing?: number }[];
  ground?: TownGround[];
}
