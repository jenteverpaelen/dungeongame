// Contracts between the scene (client/src/render/scene.ts), the art module (render/art) and the
// effects module (render/vfx). Coordinates are world units; 1 unit = 1 px at zoom 1.

import type { Container } from 'pixi.js';
import type { PlayerLook } from '@shared/protocol';

/** Interpolated per-frame state handed to every entity view. */
export interface ViewState {
  x: number;
  y: number;
  /** Velocity in units/s (interpolated). */
  vx: number;
  vy: number;
  moving: boolean;
  facingLeft: boolean;
  /** Entity flags (F_* constants in @shared/protocol). */
  flags: number;
  /** Increments every time the entity starts an attack/cast; trigger swing animations on change. */
  attackSeq: number;
  hpFrac: number;
  /** Seconds since the client started (for idle bobbing etc.). */
  time: number;
  /** Attacks per second (players) so swing animations can match attack speed. */
  aps: number;
}

export interface EntityView {
  /** Positioned by the scene at the entity's feet (x, y). Children are drawn upwards (negative y). */
  readonly root: Container;
  /** Pixel height of the sprite above the feet, for nameplates and health bars. */
  readonly height: number;
  update(dt: number, s: ViewState): void;
  /** Hit reaction: white flash + squash. intensity 0..1. */
  hit(intensity: number, crit: boolean): void;
  /** Play a death animation styled by element index (ELEMENT_INDEX), then call done(). */
  die(element: number, done: () => void): void;
  destroy(): void;
}

export interface PlayerView extends EntityView {
  setLook(look: PlayerLook): void;
}

/** Overlay above an entity: player name + level, elite name + affixes + health bar. */
export interface Nameplate {
  readonly root: Container;
  update(hpFrac: number, flags: number, hovered: boolean): void;
  destroy(): void;
}
