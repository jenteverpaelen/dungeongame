// PUBLIC API of the effects module: projectiles, area effects, telegraphs, particles, death effects,
// floating combat text, ground loot views, nameplates and screen feedback.
// NOTE: placeholder implementation; the vfx build replaces the internals but must keep these exports.

import { Container } from 'pixi.js';
import type { EntDesc, GameEvent } from '@shared/protocol';
import type { EntityView, Nameplate } from '../types';

export interface VfxLayers {
  /** World-space, below entities: decals, ground AoEs, telegraph circles, loot beams' base. */
  groundFx: Container;
  /** World-space, above entities: projectiles, particles, explosions, beams. */
  aboveFx: Container;
  /** World-space, topmost: floating combat text, loot labels, nameplates. */
  text: Container;
}

export interface VfxContext {
  /** Id of the local player's entity. */
  myId(): number;
  entityPos(id: number): { x: number; y: number } | null;
  entityView(id: number): EntityView | null;
  entityRadius(id: number): number;
  /** Camera shake in world units for ms. */
  shake(magnitude: number, ms: number): void;
  /** Freeze-frame the world for ms (hit-stop). */
  hitStop(ms: number): void;
  /** Current camera zoom (for constant-size text). */
  zoom(): number;
}

export class Vfx {
  constructor(public layers: VfxLayers, public ctx: VfxContext) {}

  /** Handle one server event (damage numbers, projectiles, AoEs, deaths, sounds...). */
  handle(ev: GameEvent): void { void ev; }

  /** Advance all effects. dtMs is real frame time (not affected by hit-stop). */
  update(dtMs: number): void { void dtMs; }

  /** View for a loot entity on the ground (icon/pile, rarity label, legendary beam). */
  createLootView(desc: EntDesc): EntityView {
    const root = new Container();
    return { root, height: 10, update() {}, hit() {}, die(_e, done) { done(); }, destroy() { root.destroy(); } };
  }

  /** Nameplate for players (name, level) and elites/bosses (name, affixes, health bar). Null = none. */
  createNameplate(desc: EntDesc, isMe: boolean): Nameplate | null { void desc; void isMe; return null; }

  /** Remove everything (zone change). */
  clear(): void {}
}
