import type { Point } from './townTypes';
import type { GroundGeometry } from './townGeometry';
import type { Prop, NpcSpot, Portal } from './mapgen';
import type { Item } from './types';

/** Zone biomes of the painted zone kit (docs/rework/worlds/DESIGN.md §1). */
export type Biome = 'meadow' | 'sluice' | 'quarry' | 'kiln' | 'fen' | 'salt' | 'ridge' | 'ward' | 'pump' | 'cistern' | 'array';
export type ZoneGroundKind = 'grass' | 'meadow' | 'dirt' | 'mud' | 'flag' | 'cobble' | 'planks' | 'stone' | 'moss' | 'sand' | 'ash' | 'cinder' | 'salt' | 'slate' | 'gravel' | 'garden' | 'tile';
export type CritterKind = 'birds' | 'crows' | 'gulls' | 'butterflies' | 'fish' | 'bats' | 'rats' | 'hares' | 'deer' | 'moths' | 'frogs';
/** Visual-only description of a painted zone. Collision never reads it; the server never sends it (both sides import it). */
export interface ZonePaint {
  biome: Biome;
  /** Painted, never walkable: water, cliffs, reed beds, lava, chasms. Beyond these the biome's own rule paints the void. */
  landscape: { kind: 'water' | 'deep' | 'cliff' | 'reeds' | 'lava' | 'chasm' | 'mud'; polygon: Point[] }[];
  /** Surfaces of walkable ground, drawn in order (later on top). */
  ground: { kind: ZoneGroundKind; polygon?: Point[]; path?: Point[]; width?: number }[];
  /** Non-solid dressing: tall kinds are y-sorted sprites, flat kinds are painted into the ground chunks. */
  decor: { kind: string; x: number; y: number; s?: number; v?: number; flip?: boolean }[];
  lights: { x: number; y: number; color: number; radius: number; flicker?: number }[];
  emitters: { kind: 'smoke' | 'fog' | 'embers' | 'motes' | 'fireflies' | 'birds' | 'leaves'; x: number; y: number; rate: number }[];
  /** Visual-only people at their work (look = resident preset key) and walkers on fixed loops. */
  residents: { id: string; look: string; name: string; x: number; y: number; facing?: number }[];
  walkers: { id: string; look: string; path: Point[]; speed: number; pause: number }[];
  critters: { kind: CritterKind; x: number; y: number; r: number; n: number }[];
}
/** Optional world objects used in person and validated by the server (docs/rework/worlds/DESIGN.md §1). */
export interface ZonePoi { id: string; kind: 'shrine' | 'cache'; name: string; x: number; y: number; radius: number; shrine?: 'empowered' | 'frenzied' | 'keen' }

export interface AdventureData {
  id: string;
  theme?: 'glade' | 'ashen';
  paint?: ZonePaint;
  pois?: ZonePoi[];
  /** Solid footprint and render dimensions are one authored source. */
  kilns?: {x:number;y:number;w:number;d:number;h:number}[];
  /** Original production trays and signal pedestals; render and collision share footprints. */
  works?: {kind:'pan'|'relay';x:number;y:number;w:number;d:number;h:number}[];
  /** Decorative only: fixed sites, no collision or gameplay state. */
  ambience?: {
    motion: { id: string; kind: 'ripples' | 'reeds' | 'mist' | 'drips'; position: Point; width: number }[];
    sounds: { id: string; kind: 'water' | 'wind' | 'fire'; position: Point; radius: number }[];
  };
  surface?: 'masonry' | 'ash' | 'salt' | 'slate';
  /** Ordered, explicitly activated encounters in a private dungeon. */
  dungeon?: { endTarget?: string; requireStory?: boolean; stages: { id: string; trigger: string; encounter: string; area: Point[] }[] };
  /** Optional channel-shared packs armed by physical interaction. */
  events?: { id: string; name: string; trigger: string; encounter: string; blurb?: string; action?: string }[];
  size: [number, number];
  geometry: GroundGeometry;
  paths: { points: Point[]; width: number; bridge?: boolean }[];
  scenery: Prop[];
  npcs: NpcSpot[];
  portals: Portal[];
  interactions: { id: string; name: string; x: number; y: number; radius: number; kind: 'person' | 'cart' | 'ledger' | 'marker' | 'mechanism' }[];
  encounters: { id: string; x: number; y: number; members: { type: string; dx: number; dy: number; tier?: 0 | 2; name?: string; questTarget?: boolean; combat?: 'keeper' | 'furnace' | 'cistern' | 'relay'; affixes?: string[] }[] }[];
  landmarks: { name: string; x: number; y: number }[];
  locations: { id: string; x: number; y: number; radius: number }[];
  wheel?: { x: number; y: number; radius: number };
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
