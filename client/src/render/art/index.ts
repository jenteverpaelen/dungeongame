// PUBLIC API of the art module (code-drawn, Legends of Idleon-inspired paper-doll art).
// The scene and UI depend ONLY on the exports declared here. Implementation lives in sibling files.
// NOTE: this file currently contains placeholder implementations; the art build replaces them.

import { Container, Graphics, type Renderer, type Texture } from 'pixi.js';
import type { EliteTier } from '@shared/items';
import type { MapData, NpcRole, Prop } from '@shared/mapgen';
import type { PlayerLook } from '@shared/protocol';
import type { ItemKind, ItemLook } from '@shared/types';
import type { EntityView, PlayerView, ViewState } from '../types';

let rendererRef: Renderer | null = null;

/** Must be called once after the Pixi renderer exists (art may bake textures). */
export function initArt(renderer: Renderer): void {
  rendererRef = renderer;
}

function placeholder(color: number, h: number): EntityView {
  const root = new Container();
  const g = new Graphics().circle(0, -h / 2, h / 2).fill(color).stroke({ color: 0x000000, width: 2 });
  root.addChild(g);
  return {
    root, height: h,
    update(_dt: number, s: ViewState) { g.scale.x = s.facingLeft ? -1 : 1; },
    hit() {}, die(_e, done) { done(); }, destroy() { root.destroy({ children: true }); },
  };
}

export function createPlayerView(look: PlayerLook): PlayerView {
  const v = placeholder(0xf2c9a0, 64) as PlayerView;
  v.setLook = () => {};
  void look;
  return v;
}

export function createMonsterView(defId: string, elite: EliteTier, affixes: string[], scale: number): EntityView {
  void defId; void elite; void affixes;
  return placeholder(0x6fbf4a, 40 * scale);
}

/** Summons: 'sentry' | 'hydra' | 'wolf' | 'bat' | 'raven' | 'dust_devil' | 'molten_pool' etc. */
export function createSummonView(type: string): EntityView {
  void type;
  return placeholder(0xc9a227, 36);
}

export function createNpcView(role: NpcRole, name: string): EntityView {
  void role; void name;
  return placeholder(0x8c6a38, 70);
}

export function createPortalView(label: string, kind: 'town' | 'rift'): EntityView {
  void label; void kind;
  return placeholder(0x3d6dff, 80);
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
  void rendererRef;
  const ground = new Container();
  return { ground, sorted: map.props.filter((p: Prop) => p.r > 0).map((p) => ({ view: new Graphics().circle(0, 0, p.r).fill(0x444444), y: p.y })), decals: new Container() };
}

/** Square item icon as a data URL (cached) for the DOM UI (inventory, tooltips, paperdoll). */
export function itemIconUrl(look: ItemLook, kind: ItemKind, size = 64): string {
  void look; void kind; void size;
  return '';
}

/** Same icon as a Pixi texture (ground loot). */
export function itemIconTexture(look: ItemLook, kind: ItemKind): Texture | null {
  void look; void kind;
  return null;
}
