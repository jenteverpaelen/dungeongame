// PUBLIC API of the effects module: projectiles, area effects, telegraphs, particles, death effects,
// floating combat text, ground loot views, nameplates and screen feedback.
// Implementation lives in sibling files:
//   atlas.ts       baked texture atlases (fx sprites + number glyphs)
//   particles.ts   pooled particle layers (one draw call each)
//   core.ts        shared clock / timers / effects / entity registry / feedback throttles
//   text.ts        floating combat numbers (merge rule, constant screen size)
//   combat.ts      dmg / heal feedback, element-styled deaths
//   projectiles.ts proj / pend simulation
//   aoe.ts         area effects        telegraphs.ts  tele markers + payoffs
//   beams.ts       beam effects        casts.ts       cast flourishes, dash, level / paragon
//   slash.ts       perspective weapon arcs
//   loot.ts        ground loot views   nameplates.ts  player / elite nameplates

import { Container } from 'pixi.js';
import type { EntDesc, GameEvent } from '@shared/protocol';
import type { EntityView, Nameplate } from '../types';
import { AoeFx } from './aoe';
import { Beams } from './beams';
import { Casts } from './casts';
import { Combat } from './combat';
import { VfxCore } from './core';
import { LootManager } from './loot';
import { createNameplate } from './nameplates';
import { Projectiles } from './projectiles';
import { Slashes } from './slash';
import { Telegraphs } from './telegraphs';
import { CombatText } from './text';

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

export interface VfxStats {
  /** CPU time of the last update() in ms. */
  ms: number;
  particles: number;
  numbers: number;
  projectiles: number;
  effects: number;
  budget: number;
}

export class Vfx {
  private core: VfxCore;
  private text: CombatText;
  private combat: Combat;
  private projs: Projectiles;
  private aoe: AoeFx;
  private tele: Telegraphs;
  private beams: Beams;
  private casts: Casts;
  private loot: LootManager;
  private slashes: Slashes;
  private warned = new Set<string>();
  /** Live counters for dev overlays / profiling. */
  readonly stats: VfxStats = { ms: 0, particles: 0, numbers: 0, projectiles: 0, effects: 0, budget: 1 };

  constructor(public layers: VfxLayers, public ctx: VfxContext) {
    this.core = new VfxCore(layers, ctx);
    this.slashes = new Slashes(this.core, layers.aboveFx);
    this.loot = new LootManager(this.core, layers.text);
    this.text = new CombatText(layers.text, () => ctx.zoom());
    this.combat = new Combat(this.core, this.text);
    this.projs = new Projectiles(this.core, this.combat);
    this.aoe = new AoeFx(this.core, this.combat, this.slashes);
    this.tele = new Telegraphs(this.core, this.aoe);
    this.aoe.onMeteorImpact = (x, y) => this.tele.landMeteor(x, y);
    this.beams = new Beams(this.core);
    this.casts = new Casts(this.core, this.aoe, this.tele);
  }

  /** Handle one server event (damage numbers, projectiles, AoEs, deaths, sounds...). */
  handle(ev: GameEvent): void {
    try {
      this.dispatch(ev);
    } catch (err) {
      // One malformed event must never break the snapshot loop that delivers it.
      const k = ev.e + ('v' in ev ? ':' + ev.v : '');
      if (!this.warned.has(k)) { this.warned.add(k); console.warn('[vfx] event failed', k, err); }
    }
  }

  private dispatch(ev: GameEvent): void {
    const V = this.core;
    switch (ev.e) {
      case 'dmg': this.combat.dmg(ev); break;
      case 'heal': this.combat.heal(ev); break;
      case 'die': this.combat.die(ev); break;
      case 'proj': this.projs.spawn(ev); break;
      case 'pend': this.projs.end(ev); break;
      case 'aoe': this.aoe.handle(ev); break;
      case 'tele': this.tele.handle(ev); break;
      case 'beam': this.beams.handle(ev); break;
      case 'cast': this.casts.cast(ev); break;
      case 'dash': this.casts.dash(ev); break;
      case 'level': this.casts.pillar(ev.t, false); break;
      case 'paragon': this.casts.pillar(ev.t, true); break;
      case 'pickup': {
        this.loot.pickups.set(ev.l, ev.t);
        if (ev.t !== this.ctx.myId()) break;
        switch (ev.lk) {
          case 'gold': V.sound('gold'); break;
          case 'gem': V.sound('gem'); break;
          case 'mat': V.sound('gem', undefined, undefined, 0.6); break;
          case 'globe': {
            V.sound('globe');
            const b = V.body(ev.t);
            if (b) {
              const s = V.sys;
              s.flash(b.x, b.y, b.h * 0.5, 90, 0xff5a4a, 0.2, 0.6);
              s.ring(s.gAdd, s.T.ring, b.x, b.y, 10, 60, 0xff6a5a, 0.4, 0.8);
              for (let i = 0; i < 8; i++) {
                const p = s.aAdd.add(s.T.plus, b.x + (Math.random() - 0.5) * 36, b.y + 1, 0.8);
                p.z = Math.random() * b.h; p.vz = 50; p.w0 = 9; p.w1 = 5; p.fo = 0.5; p.tintTo(0xff7a6a);
              }
            }
            break;
          }
          default: V.sound('item', undefined, undefined, ev.rarity === 'legendary' || ev.rarity === 'set' ? 1 : 0.8);
        }
        break;
      }
      case 'notice':
        if (ev.kind === 'boss') V.sound('roar');
        else if (ev.kind === 'rift') V.sound('rift');
        break;
      case 'shake':
        // Handled by the game controller (scene.shake); nothing to add here.
        break;
    }
  }

  /** Advance all effects. dtMs is real frame time (not affected by hit-stop). */
  update(dtMs: number): void {
    const t0 = performance.now();
    const real = Math.min(Math.max(dtMs, 0), 100) / 1000;
    const V = this.core;
    // World effects freeze during our own hit-stops; text, labels and UI keep moving.
    const frozen = V.real + real < V.hitStopUntil;
    const dt = frozen ? 0 : real;
    this.projs.update(dt);
    V.update(dt, real);
    this.text.update(real);
    this.loot.update(real);
    // Keep the numbers above nameplates the scene appends to the text layer.
    const tl = this.layers.text;
    if (tl.children[tl.children.length - 1] !== this.text.container) tl.addChild(this.text.container);
    const st = this.stats;
    st.ms = performance.now() - t0;
    st.particles = V.sys.live;
    st.numbers = this.text.count;
    st.projectiles = this.projs.count;
    st.effects = V.effectCount;
    st.budget = V.sys.budget;
  }

  /** View for a loot entity on the ground (icon/pile, rarity label, legendary beam). */
  createLootView(desc: EntDesc): EntityView {
    return this.loot.create(desc);
  }

  /** Nameplate for players (name, level) and elites/bosses (name, affixes, health bar). Null = none. */
  createNameplate(desc: EntDesc, isMe: boolean): Nameplate | null {
    return createNameplate(this.core, desc, isMe);
  }

  /** Remove everything (zone change). */
  clear(): void {
    this.projs.clear();
    this.tele.clear();
    this.core.clear();
    this.text.clear();
    this.loot.clear();
  }
}
