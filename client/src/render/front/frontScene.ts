// Front-end scene (docs/rework/ui/CHARACTER_SCREENS.md §2): the camp at dusk behind the title, hero select, class choice
// and appearance screens. One stage in the game's own renderer (no second WebGL context, low-end rule), drawn with the
// game's art: zone props, the hero rig, the fire sprites. The heroes stand around the campfire like the Diablo II / IV
// lineup (C1); the camera moves per step. Reads `ui.front` and `ui.account` every frame; writes nothing.
import { Application, CanvasSource, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { createCharacter, playerLook } from '@shared/character';
import { F_CHANNEL, type PlayerLook } from '@shared/protocol';
import { CLASS_IDS } from '@shared/data/classes';
import type { ClassId } from '@shared/types';
import { createPlayerView } from '../art';
import { place } from '../art/zoneBuild';
import { flameSprite, glowSprite, sparkleSprite } from '../art/fx';
import type { PlayerView } from '../types';
import { ui } from '../../ui/store';
import { motionReduced } from '../../game/preferences';

const W = 1920, H = 1080, FIRE = { x: 960, y: 792 };
/** Where heroes stand around the fire: left, right, behind (class order warrior, ranger, mage). */
export const SPOTS = [{ x: 640, y: 826, face: 34 }, { x: 1286, y: 826, face: -34 }, { x: 960, y: 636, face: 0 }];
/** The creator stands beside the fire, lit from the side. */
export const CREATOR = { x: 690, y: 912 };
export const HERO_SCALE = 2.6;
/** Camera targets per step (stage units; s on top of the cover fit). The DOM click areas use the same numbers. */
export const CAMS = { title: { x: 960, y: 600, s: 1 }, heroes: { x: 960, y: 690, s: 1.12 }, class: { x: 960, y: 690, s: 1.12 }, look: { x: 700, y: 752, s: 1.85 } };
export const focusCam = (spot: { x: number; y: number }) => ({ x: spot.x + 160, y: spot.y - 150, s: 1.6 });
/** A stage point on screen for a camera at rest. */
export function toScreen(x: number, y: number, cam: { x: number; y: number; s: number }, sw: number, sh: number) {
  const k = Math.max(sw / W, sh / H) * cam.s; return { x: sw / 2 + (x - cam.x) * k, y: sh / 2 + (y - cam.y) * k, k };
}

type Turnable = PlayerView & { face?(deg: number): void; setYaw?(deg: number): void };
interface Actor { key: string; look: string; view: Turnable; ring: Sprite; seq: number; lastSwing: number }

const starters = new Map<ClassId, PlayerLook>();
/** The class-select starter look (the same one the old previews drew), built once per class. */
function starterLook(cls: ClassId): PlayerLook { let l = starters.get(cls); if (!l) { l = playerLook(createCharacter('Preview', cls, 1)); starters.set(cls, l); } return l; }
type Wanted = { key: string; look: PlayerLook; x: number; y: number; face: number; lit: boolean; act: boolean };

/** The far land behind the camp, painted once: dusk sky, stars, hills, Hearthmere's lit roofs, the treeline, the ground. */
function backdrop(): Texture {
  // taller than the stage: the camera looks below y 1080 on the title and while zoomed
  const BH = 1500, c = document.createElement('canvas'); c.width = W; c.height = BH; const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 640);
  sky.addColorStop(0, '#0b1120'); sky.addColorStop(0.55, '#24223a'); sky.addColorStop(0.85, '#5a3a3c'); sky.addColorStop(1, '#8a5238');
  g.fillStyle = sky; g.fillRect(0, 0, W, 660);
  for (let i = 0; i < 140; i++) { const x = (i * 977) % W, y = (i * 571) % 360, r = (i % 7 === 0 ? 1.6 : 0.9); g.globalAlpha = 0.25 + ((i * 37) % 60) / 100; g.fillStyle = '#e8e4ff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const ridge = (base: number, amp: number, step: number, seed: number, color: string) => {
    g.fillStyle = color; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + step; x += step) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.0031 + seed) * Math.cos(x * 0.0013 + seed * 2)));
    g.lineTo(W, H); g.closePath(); g.fill();
  };
  ridge(560, 120, 24, 1.3, '#1b2030'); ridge(600, 80, 20, 4.1, '#18201f');
  // Hearthmere on the far hill: roofs, a tower, warm windows
  g.fillStyle = '#121616';
  for (let i = 0; i < 9; i++) { const x = 1380 + i * 46, w = 38, h = 26 + (i * 13) % 22, y = 588 - (i % 3) * 6; g.fillRect(x, y - h, w, h); g.beginPath(); g.moveTo(x - 4, y - h); g.lineTo(x + w / 2, y - h - 22); g.lineTo(x + w + 4, y - h); g.fill(); }
  g.fillRect(1560, 470, 26, 120); g.beginPath(); g.moveTo(1554, 470); g.lineTo(1573, 440); g.lineTo(1592, 470); g.fill();
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 4 === 0 ? '#ffcf7a' : '#e59a48'; g.globalAlpha = 0.85; g.fillRect(1390 + ((i * 53) % 400), 560 - ((i * 17) % 34), 4, 5); }
  g.globalAlpha = 1;
  // treeline
  g.fillStyle = '#0f1512';
  for (let x = -20; x < W + 40; x += 34) { const h = 46 + ((x * 7919) % 50), y = 632 + ((x * 31) % 14); g.beginPath(); g.moveTo(x - 20, y); g.lineTo(x, y - h); g.lineTo(x + 20, y); g.fill(); }
  // the camp's ground: dark meadow, lighter towards the fire
  const ground = g.createLinearGradient(0, 630, 0, BH);
  ground.addColorStop(0, '#1a2318'); ground.addColorStop(1, '#0c100a');
  g.fillStyle = ground; g.fillRect(0, 630, W, BH - 630);
  for (let i = 0; i < 1300; i++) { const x = (i * 7121) % W, y = 640 + ((i * 3191) % (BH - 640)); g.fillStyle = i % 3 ? 'rgba(70,90,50,0.35)' : 'rgba(20,28,16,0.5)'; g.fillRect(x, y, 2, 3 + (i % 3)); }
  return new Texture({ source: new CanvasSource({ resource: c }) });
}

export class FrontScene {
  readonly root = new Container();
  private cam = new Container();
  private props = new Container();
  private actors = new Map<string, Actor>();
  private fire: { flames: Sprite[]; glow: Sprite; pool: Sprite; embers: { s: Sprite; t: number; x: number; v: number }[] } | null = null;
  private time = 0;
  private camNow = { x: 960, y: 640, s: 1 };
  private active = false;
  private drag: { x: number; yaw: number } | null = null;

  constructor(private app: Application) {
    this.root.visible = false;
    this.root.addChild(this.cam);
    this.app.ticker.add((t) => this.tick(t.deltaMS));
    window.addEventListener('pointerdown', (e) => { if (this.active && ui.get().front.step === 'look' && (e.target as HTMLElement)?.closest?.('.fr-turn')) this.drag = { x: e.clientX, yaw: ui.get().front.yaw }; });
    window.addEventListener('pointermove', (e) => { if (this.drag) ui.set((s) => ({ front: { ...s.front, yaw: ((this.drag!.yaw - (e.clientX - this.drag!.x) * 0.6) % 360 + 360) % 360 } })); });
    window.addEventListener('pointerup', () => { this.drag = null; });
  }

  private build() {
    const bg = new Sprite(backdrop()); this.cam.addChild(bg, this.props);
    this.props.sortableChildren = true;
    // the camp: tent, log seats, stores, pines framing it, a lamp on the path to the gate
    const add = (kind: string, s: number, v: number, x: number, y: number, flip = false, tint = 0xb8aaa0) => {
      const made = place(kind, s, v, x, y, flip); if (!made) return; made.root.zIndex = y; made.root.tint = tint; this.props.addChild(made.root);
    };
    for (const [x, y, s, v] of [[120, 780, 2.4, 0], [300, 700, 2, 1], [1660, 720, 2.2, 2], [1830, 820, 2.6, 0], [470, 660, 1.6, 2], [1500, 660, 1.6, 1]] as const) add('pine', s, v, x, y, false, 0x8a8a90);
    add('tent', 1.7, 1, 560, 700, false, 0xc0a890); add('tent', 1.5, 0, 1420, 690, true, 0xb09a88);
    add('log', 1.5, 0, 820, 880, false, 0xffd4b0); add('log', 1.5, 1, 1110, 884, true, 0xffd4b0);
    add('crates', 1.4, 0, 1500, 820, false, 0xd8c0a8); add('barrels', 1.4, 1, 1560, 860, false, 0xd8c0a8);
    add('rock', 1.6, 0, 360, 900, false, 0x9a9490); add('rock', 1.4, 2, 1700, 960, true, 0x9a9490); add('bush', 1.4, 1, 240, 960, false, 0x7a8a70);
    add('banner', 1.5, 0, 700, 640, false, 0xd0b8a0); add('lamppost', 1.4, 0, 1240, 650, false, 0xffe0b8);
    // the fire
    const pool = glowSprite(0xff9a48, 1100, 0.32, true); pool.position.set(FIRE.x, FIRE.y - 10); pool.scale.y *= 0.55;
    const glow = glowSprite(0xffb060, 300, 0.5, true); glow.position.set(FIRE.x, FIRE.y - 40);
    const logs = new Graphics().ellipse(0, 4, 70, 20).fill(0x1a120a).rect(-58, -10, 116, 16).fill(0x5a3a22).rect(-44, -22, 88, 14).fill(0x6a4528);
    logs.position.set(FIRE.x, FIRE.y); logs.zIndex = FIRE.y;
    const flames = [0, 1, 2, 3].map((i) => { const f = flameSprite(i % 2 ? 0xffda83 : 0xef9b4c, i === 1 ? 120 : 92); f.position.set(FIRE.x + (i - 1.5) * 22, FIRE.y - 8); f.zIndex = FIRE.y + 1; return f; });
    const embers = Array.from({ length: motionReduced() ? 0 : 36 }, (_, i) => { const s = sparkleSprite(0xffc070, 6, 0.9); s.zIndex = FIRE.y + 2; return { s, t: (i * 0.137) % 1, x: (i * 37 % 60) - 30, v: 0.35 + (i % 5) * 0.08 }; });
    this.props.addChild(pool, glow, logs, ...flames, ...embers.map((e) => e.s));
    this.fire = { flames, glow, pool, embers };
  }

  /** Who stands in the scene for the current step, keyed so a hero is reused while it stays. */
  private wanted(): Wanted[] {
    const s = ui.get(), f = s.front;
    if (f.step === 'heroes') {
      const heroes = s.account.characters.filter((c) => c.deleteAt === undefined).slice(0, 3);
      return heroes.map((c, i) => ({ key: `hero:${c.name}`, look: c.look ?? starterLook(c.classId), ...SPOTS[i], lit: (f.hero ?? heroes[0]?.name) === c.name, act: false }));
    }
    if (f.step === 'class') return CLASS_IDS.map((cls, i) => ({ key: `class:${cls}`, look: starterLook(cls), ...SPOTS[i], lit: f.focus ? f.focus === cls : f.hover === cls, act: f.focus === cls }));
    if (f.step === 'look') {
      const base = starterLook(f.cls), look: PlayerLook = { ...base, ...(f.gear ? {} : { slots: {} }), appearance: f.appearance };
      return [{ key: 'creator', look, x: CREATOR.x, y: CREATOR.y, face: 0, lit: true, act: false }];
    }
    return [];
  }

  private sync(want: Wanted[]) {
    const keys = new Set(want.map((w) => w.key));
    for (const [k, a] of this.actors) if (!keys.has(k)) { a.view.destroy(); a.ring.destroy(); this.actors.delete(k); }
    for (const w of want) {
      const lookKey = JSON.stringify(w.look);
      let a = this.actors.get(w.key);
      if (!a) {
        const view = createPlayerView(w.look) as Turnable, ring = glowSprite(0xffd890, 220, 0, true);
        view.root.scale.set(HERO_SCALE); ring.scale.y *= 0.4;
        this.props.addChild(ring, view.root);
        a = { key: w.key, look: lookKey, view, ring, seq: 0, lastSwing: 0 }; this.actors.set(w.key, a);
        view.setYaw?.(w.face);
      } else if (a.look !== lookKey) { a.look = lookKey; a.view.setLook(w.look); }
      a.view.root.position.set(w.x, w.y); a.view.root.zIndex = w.y; a.ring.position.set(w.x, w.y + 6); a.ring.zIndex = w.y - 1;
    }
  }

  private tick(dtMs: number) {
    const s = ui.get(), on = s.screen === 'select' || s.screen === 'connecting';
    if (on !== this.active) {
      this.active = on; this.root.visible = on;
      if (on && !this.fire) { this.build(); this.app.stage.addChildAt(this.root, 0); }
    }
    if (!on) return;
    const dt = Math.min(0.05, dtMs / 1000); this.time += dt;
    // fit the 1920×1080 stage to the window (cover), then move the camera per step
    const sw = this.app.screen.width, sh = this.app.screen.height, fit = Math.max(sw / W, sh / H);
    const f = s.front, focusSpot = f.step === 'class' && f.focus ? SPOTS[CLASS_IDS.indexOf(f.focus)] : null;
    const target = focusSpot ? focusCam(focusSpot) : CAMS[f.step];
    const k = motionReduced() ? 1 : 1 - Math.exp(-dtMs / 320);
    this.camNow.x += (target.x - this.camNow.x) * k; this.camNow.y += (target.y - this.camNow.y) * k; this.camNow.s += (target.s - this.camNow.s) * k;
    const drift = motionReduced() || f.step !== 'title' ? 0 : Math.sin(this.time * 0.12) * 18;
    this.cam.pivot.set(this.camNow.x + drift, this.camNow.y); this.cam.scale.set(fit * this.camNow.s); this.cam.position.set(sw / 2, sh / 2);
    const want = this.wanted(), byKey = new Map(want.map((w) => [w.key, w]));
    this.sync(want);
    // the fire breathes; embers rise and fade
    if (this.fire) {
      this.fire.flames.forEach((fl, i) => { fl.scale.y = fl.scale.x * (1 + Math.sin(this.time * 9 + i * 1.9) * 0.08); });
      this.fire.glow.alpha = 0.46 + Math.sin(this.time * 7.1) * 0.05; this.fire.pool.alpha = 0.3 + Math.sin(this.time * 5.3) * 0.025;
      for (const e of this.fire.embers) { e.t = (e.t + dt * e.v * 0.5) % 1; e.s.position.set(FIRE.x + e.x + Math.sin(this.time * 2 + e.x) * 14 * e.t, FIRE.y - 30 - e.t * 340); e.s.alpha = Math.sin(e.t * Math.PI) * 0.9; }
    }
    // the heroes: lit ones face the camera, the rest look into the fire; a focused class loops its signature move
    for (const [, a] of this.actors) {
      const w = byKey.get(a.key); if (!w) continue;
      const lit = w.lit;
      a.view.root.tint = lit || f.step === 'look' ? 0xffffff : 0x9a9088;
      a.ring.alpha += ((lit ? 0.55 : 0) - a.ring.alpha) * Math.min(1, dt * 6);
      const yaw = f.step === 'look' ? f.yaw : lit ? 0 : w.face;
      if (f.step === 'look') a.view.setYaw?.(yaw); else a.view.face?.(yaw);
      let flags = 0;
      if (w.act && !motionReduced()) {
        const phase = this.time % 6;
        if (this.time - a.lastSwing > 1.8 && phase < 3) { a.seq++; a.lastSwing = this.time; }
        if (a.key === 'class:warrior' && phase > 3 && phase < 4.4) flags |= F_CHANNEL;
      }
      a.view.update(dt, { x: 0, y: 0, vx: 0, vy: 0, moving: false, facingLeft: false, flags, attackSeq: a.seq, hpFrac: 1, time: this.time, aps: 1.2 });
    }
  }
}
