// PUBLIC API of the art module (code-drawn, Legends of Idleon-inspired paper-doll art).
// The scene and UI depend ONLY on the exports declared here. Implementation lives in sibling files:
//   draw.ts / util.ts / palette.ts / fx.ts / bake.ts / puppet.ts — shared drawing + baking + rig
//   gear.ts + player.ts — paper doll       monsters.ts — monster families      summons.ts — summons
//   npcs.ts — NPC objects + portals        props.ts + ground.ts + map.ts — world   icons.ts — item icons
// Art direction: docs/ART_DIRECTION.md.

import { Container, type Renderer, type Texture } from 'pixi.js';
import type { EliteTier } from '@shared/items';
import type { MapData, NpcRole } from '@shared/mapgen';
import type { PlayerLook } from '@shared/protocol';
import type { ItemKind, ItemLook } from '@shared/types';
import type { EntityView, PlayerView } from '../types';
import { setRenderer } from './fx';
import { iconTexture, iconUrl } from './icons';
import { buildLayers } from './map';
import { MonsterArt } from './monsters';
import { NpcArt, PortalArt } from './npcs';
import { PlayerArt } from './player';
import { SummonArt } from './summons';

/** Camera zoom × renderer resolution. Art bakes textures at this scale so sprites stay crisp when zoomed in.
 *  Called by the scene whenever the window size changes. */
export function setViewScale(scale: number): void {
  viewScale = scale;
}
export let viewScale = 2;

/** Must be called once after the Pixi renderer exists (art may bake textures). */
export function initArt(renderer: Renderer): void {
  setRenderer(renderer);
}

export function createPlayerView(look: PlayerLook): PlayerView {
  return new PlayerArt(look);
}

export function createMonsterView(defId: string, elite: EliteTier, affixes: string[], scale: number): EntityView {
  return new MonsterArt(defId, elite, affixes, scale);
}

/** Summons: 'sentry' | 'hydra' | 'wolf' | 'bat' | 'raven' | 'dust_devil' | 'molten_pool' etc. */
export function createSummonView(type: string): EntityView {
  return new SummonArt(type);
}

export function createNpcView(role: NpcRole, name: string): EntityView {
  return new NpcArt(role, name);
}

export function createPortalView(label: string, kind: 'town' | 'rift'): EntityView {
  return new PortalArt(label, kind);
}

export interface MapLayers {
  /** Ground (tiles baked into chunk textures) — static, drawn below everything. */
  ground: Container;
  /** Props that must be y-sorted with entities (trees, rocks, buildings): place in the entity layer. */
  sorted: { view: Container; y: number }[];
  /** Flat decoration drawn on the ground layer above tiles (grass, cracks, pebbles). */
  decals: Container;
}

export function buildMapLayers(map: MapData): MapLayers {
  return buildLayers(map);
}

/** Square item icon as a data URL (cached) for the DOM UI (inventory, tooltips, paperdoll). */
export function itemIconUrl(look: ItemLook, kind: ItemKind, size = 64): string {
  return iconUrl(look, kind, size);
}

/** Same icon as a Pixi texture (ground loot). */
export function itemIconTexture(look: ItemLook, kind: ItemKind): Texture | null {
  return iconTexture(look, kind);
}
