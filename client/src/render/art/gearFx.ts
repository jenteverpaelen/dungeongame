// Live gear effects (docs/rework/gear/DESIGN.md §2–§5): the animated layer on top of the baked ornaments.
//   • ground layer (drawn BENEATH enemy telegraphs when the scene provides an underlay): rotating sigil with Set
//     sockets, the rank light column (Primal embers), the movement ribbon, footprints, rank-up rings;
//   • body layer: aura, per-piece glows (player.ts), motif particles, orbiting tokens and ring gems, halo, weapon sheen,
//     motif flames, swing sparks, the Primal heartbeat and the full-Set idle flourish.
// Sprites are created once per look and pooled; per frame only positions / alphas change. A shared budget thins
// particles when many heroes are on screen; quality 'reduced' keeps steady glows (no particles, no motion), 'off'
// shows nothing.

import { CanvasSource, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { GearProfile } from '@shared/gearVisual';
import { GEAR_TIER_COLORS } from '@shared/gearVisual';
import type { PlayerLook } from '@shared/protocol';
import { LEGENDARIES } from '@shared/data/items';
import { fx } from './fx';
import { ANCIENT_GOLD, LEGENDARY_MOTIF, PRIMAL_CORE, PRIMAL_RED, SET_STYLE, itemStyle, motifColor, type Motif } from './gearStyle';
import { Ribbon } from './trail';
import { TAU, clamp, light } from './util';

export type GearQuality = 'full' | 'reduced' | 'off';

export interface P3 { x: number; y: number; d: number }
export interface GearAnchors {
  t: number; dt: number;
  /** World position of the hero (ground effects and footprints live in world space). */
  wx: number; wy: number;
  moving: boolean; walk: number; idle: number;
  side: number; sB: number; cB: number;
  head: P3; chest: P3; hR: P3; hL: P3; wTip: P3; wBase: P3;
  hasWeapon: boolean; bow: boolean;
  /** Weapon trail strength of the current swing (0..1): swing sparks. */
  swing: number;
  /** Seconds since a rank-up celebration started (< 0: none), and whether it is the big one (Set / rank 8+). */
  celebrate: number; celebrateBig: boolean;
}

// ─────────────────────────── shared token sheet (canvas, tinted at runtime) ───────────────────────────

interface Tokens {
  sigil: Texture; sigilSet: Texture; sigilPrimal: Texture; node: Texture; shard: Texture; leaf: Texture; feather: Texture; drop: Texture;
  rock: Texture; cog: Texture; petal: Texture; print: Texture; crack: Texture; column: Texture; band: Texture;
}
let tokens: Tokens | null = null;

function tok(): Tokens {
  if (tokens) return tokens;
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d')!;
  const R: Record<keyof Tokens, Rectangle> = {} as Record<keyof Tokens, Rectangle>;
  const ring = (cx: number, cy: number, r: number, w: number, a: number) => { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); };
  // sigil: runic circle (128) at (0,0)
  {
    const cx = 64, cy = 64;
    ring(cx, cy, 58, 3, 0.95); ring(cx, cy, 47, 1.6, 0.7); ring(cx, cy, 30, 1.2, 0.45);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, r0 = 48.5, r1 = i % 2 ? 54 : 57;
      g.save(); g.translate(cx + Math.cos(a) * (r0 + r1) / 2, cy + Math.sin(a) * (r0 + r1) / 2); g.rotate(a);
      if (i % 4 === 0) { g.beginPath(); g.moveTo(-4, 0); g.lineTo(0, -3); g.lineTo(4, 0); g.lineTo(0, 3); g.closePath(); g.fill(); }
      else g.fillRect(-0.8, -3, 1.6, 6);
      g.restore();
    }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.26; g.beginPath(); g.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); g.lineTo(cx + Math.cos(a + 2.1) * 30, cy + Math.sin(a + 2.1) * 30); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2; g.stroke(); }
    R.sigil = new Rectangle(0, 0, 128, 128);
  }
  // set sigil (128) at (128,0): double ring, six sockets (lit nodes are separate sprites), a hexagram
  {
    const cx = 192, cy = 64;
    ring(cx, cy, 58, 2.6, 0.95); ring(cx, cy, 52, 1.2, 0.6);
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i / 6) * TAU; ring(cx + Math.cos(a) * 55, cy + Math.sin(a) * 55, 6, 1.6, 0.9); }
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.2; g.beginPath();
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i * 2 / 6) * TAU; const x = cx + Math.cos(a) * 40, y = cy + Math.sin(a) * 40; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    R.sigilSet = new Rectangle(128, 0, 128, 128);
  }
  // primal sigil (128) at (256,0): spiked crown ring
  {
    const cx = 320, cy = 64;
    ring(cx, cy, 50, 3, 0.95);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.moveTo(cx + Math.cos(a - 0.12) * 50, cy + Math.sin(a - 0.12) * 50); g.lineTo(cx + Math.cos(a) * (i % 2 ? 58 : 62), cy + Math.sin(a) * (i % 2 ? 58 : 62)); g.lineTo(cx + Math.cos(a + 0.12) * 50, cy + Math.sin(a + 0.12) * 50); g.fill(); }
    ring(cx, cy, 36, 1.4, 0.6);
    R.sigilPrimal = new Rectangle(256, 0, 128, 128);
  }
  // light column (32x128) at (384,128): bright soft base, fading up; soft edges
  {
    const x0 = 384, y0 = 128, W = 32, H = 128;
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const v = 1 - y / (H - 1);                       // 0 = bottom, 1 = top
      const along = Math.pow(1 - v, 0.9) * (0.35 + 0.65 * Math.min(1, (1 - v) * 4)) * Math.min(1, v * 14 + 0.25);
      for (let x = 0; x < W; x++) {
        const u = (x - (W - 1) / 2) / ((W - 1) / 2);
        const a = Math.exp(-u * u * 3.2) * along;
        const i = (y * W + x) * 4;
        img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * clamp(a));
      }
    }
    g.putImageData(img, x0, y0);
    R.column = new Rectangle(x0, y0, W, H);
  }
  // movement band (64x32) at (416,128): soft on both edges across v, alpha fades along x (Ribbon encodes age in u)
  {
    const x0 = 416, y0 = 128, W = 64, H = 32;
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1);
      const prof = Math.pow(Math.sin(v * Math.PI), 1.4);
      for (let x = 0; x < W; x++) {
        const a = Math.max(0, 1 - x / (W - 1)) * prof;
        const i = (y * W + x) * 4;
        img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * a);
      }
    }
    g.putImageData(img, x0, y0);
    R.band = new Rectangle(x0, y0, W, H);
  }
  // 32px tokens on the top-right block
  const cell = (i: number) => ({ x: 384 + (i % 4) * 32, y: (i >> 2) * 32 });
  const at = (i: number, draw: (cx: number, cy: number) => void, key: keyof Tokens) => { const p = cell(i); g.save(); draw(p.x + 16, p.y + 16); g.restore(); R[key] = new Rectangle(p.x, p.y, 32, 32); };
  g.fillStyle = '#fff';
  at(0, (x, y) => { const gr = g.createRadialGradient(x, y, 0, x, y, 9); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); }, 'node');
  at(1, (x, y) => { g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(x, y - 13); g.lineTo(x + 5, y - 2); g.lineTo(x + 1, y + 13); g.lineTo(x - 4, y + 1); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 0.5, y - 10, 1.2, 18); }, 'shard');
  at(2, (x, y) => { g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(x, y - 12); g.quadraticCurveTo(x + 10, y - 2, x, y + 12); g.quadraticCurveTo(x - 10, y - 2, x, y - 12); g.fill(); }, 'leaf');
  at(3, (x, y) => { g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(x - 1, y + 13); g.quadraticCurveTo(x - 7, y - 4, x + 2, y - 13); g.quadraticCurveTo(x + 6, y + 2, x - 1, y + 13); g.fill(); }, 'feather');
  at(4, (x, y) => { g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(x, y - 10); g.quadraticCurveTo(x + 6, y + 2, x, y + 7); g.quadraticCurveTo(x - 6, y + 2, x, y - 10); g.fill(); }, 'drop');
  at(5, (x, y) => { g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.moveTo(x - 9, y + 3); g.lineTo(x - 5, y - 7); g.lineTo(x + 6, y - 8); g.lineTo(x + 10, y + 2); g.lineTo(x + 2, y + 8); g.closePath(); g.fill(); }, 'rock');
  at(6, (x, y) => { g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 8 : 11; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x, y, 3.4, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }, 'cog');
  at(7, (x, y) => { g.fillStyle = 'rgba(255,255,255,0.95)'; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; g.beginPath(); g.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 5, 3, a, 0, TAU); g.fill(); } }, 'petal');
  at(8, (x, y) => { const gr = g.createRadialGradient(x, y + 2, 0, x, y + 2, 11); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + 2, 7, 11, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x - 4.5 + i * 3, y - 10 + Math.abs(i - 1.5), 1.5, 0, TAU); g.fill(); } }, 'print');
  at(9, (x, y) => { g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 12, y + 1); g.lineTo(x - 4, y - 2); g.lineTo(x + 2, y + 3); g.lineTo(x + 12, y - 1); g.moveTo(x - 4, y - 2); g.lineTo(x - 6, y - 8); g.moveTo(x + 2, y + 3); g.lineTo(x + 4, y + 9); g.stroke(); }, 'crack');
  const source = new CanvasSource({ resource: cv, scaleMode: 'linear', autoGenerateMipmaps: true });
  const f = (r: Rectangle) => new Texture({ source, frame: r });
  tokens = {
    sigil: f(R.sigil), sigilSet: f(R.sigilSet), sigilPrimal: f(R.sigilPrimal), node: f(R.node), shard: f(R.shard), leaf: f(R.leaf),
    feather: f(R.feather), drop: f(R.drop), rock: f(R.rock), cog: f(R.cog), petal: f(R.petal), print: f(R.print), crack: f(R.crack),
    column: f(R.column), band: f(R.band),
  };
  return tokens;
}

/** Ground sigil textures for other systems (loot beams): runic ring, Set ring, Primal ring. */
export function gearSigilTexture(kind: 'rune' | 'set' | 'primal'): Texture {
  const T = tok();
  return kind === 'primal' ? T.sigilPrimal : kind === 'set' ? T.sigilSet : T.sigil;
}

// ─────────────────────────── the world underlay (beneath enemy telegraphs) ───────────────────────────

let underlay: Container | null = null;
const alive = new Set<GearFx>();
/** The scene hands in a world-space container that sits below the telegraph layer; null in galleries (effects then
 *  stay inside the hero view). */
export function setGearUnderlay(c: Container | null): void { underlay = c; }
/** Once per frame: hide the ground effects of heroes that were not updated (off screen / culled). */
export function sweepGearUnderlay(now = performance.now()): void { for (const g of alive) g.sweep(now); }

// ─────────────────────────── shared budget ───────────────────────────

/** Heroes with full effects updated last frame: particles thin out as the crowd grows (≈ constant total). */
const budget = { stamp: 0, seen: 0, count: 1 };
function crowdFactor(): number {
  const now = performance.now();
  if (now - budget.stamp > 6) { budget.count = Math.max(1, budget.seen); budget.seen = 0; budget.stamp = now; }
  budget.seen++;
  return clamp(8 / budget.count, 0.15, 1);
}
/** Live-effect sprite counter (perf HUD / tests). */
export const gearFxStats = { heroes: 0, sprites: 0 };

// ─────────────────────────── particles ───────────────────────────

type Kind = 'rise' | 'fall' | 'drift' | 'swirl' | 'burst' | 'print' | 'ripple' | 'column' | 'ring';
interface Part { s: Sprite; kind: Kind; life: number; t: number; x: number; y: number; vx: number; vy: number; rot: number; size: number; ground: boolean; a: number }

function motifTexture(m: Motif | 'primal' | 'mote'): Texture {
  const T = tok(), F = fx();
  switch (m) {
    case 'ember': case 'flame': case 'primal': return F.flame;
    case 'star': case 'gold': case 'arcane': case 'shadow': return F.sparkle;
    case 'shard': return T.shard;
    case 'feather': return T.feather;
    case 'leaf': return T.leaf;
    case 'lantern': return T.petal;
    case 'rain': return T.drop;
    case 'stone': return T.rock;
    case 'cog': return F.dot;
    case 'wind': case 'storm': return F.streak;
    case 'blood': return T.drop;
    default: return F.dot;
  }
}

function motifKind(m: Motif | 'primal' | 'mote'): Kind {
  switch (m) {
    case 'rain': case 'blood': return 'fall';
    case 'feather': case 'leaf': case 'lantern': return 'drift';
    case 'wind': case 'storm': return 'swirl';
    default: return 'rise';
  }
}

/** Ground sigil diameter (world units) by rank: ≥ 1.8× the 34-unit shadow from Heroic (rank 7). */
export function sigilSize(rank: number, setN: number): number {
  const byRank = [0, 0, 0, 0, 0, 40, 52, 64, 72, 82][Math.max(0, Math.min(9, rank))];
  return Math.max(byRank, setN >= 2 ? 44 + setN * 3 : 0);
}

export class GearFx {
  private sprites: Sprite[] = [];
  private ground: Container;
  private worldGround: boolean;
  private parts: Part[] = [];
  private sigilWrap: Container | null = null;
  private sigil: Sprite | null = null;
  private sigilRing: Sprite | null = null;
  private nodes: Sprite[] = [];
  private column: Sprite | null = null;
  private columnCore: Sprite | null = null;
  private ribbon: Ribbon | null = null;
  private trailPts: { x: number; y: number; t: number }[] = [];
  private aura: Sprite | null = null;
  private halo: Sprite | null = null;
  private haloGlints: Sprite[] = [];
  private orbiters: { s: Sprite; r: number; speed: number; phase: number; y: number; spin: number; streak: boolean }[] = [];
  private sheen: Sprite | null = null;
  private bladeFx: Sprite[] = [];
  private tipStar: Sprite | null = null;
  private pulse: Sprite | null = null;
  private wingGlow: Sprite | null = null;
  private cloud: Sprite | null = null;
  private burstRings: Sprite[] = [];
  private burstColumn: Sprite | null = null;
  private burstFired = -1;
  private spawnAcc = 0;
  private columnAcc = 0;
  private sparkAcc = 0;
  private stepPhase = 0;
  private idleBurstAt = 7;
  private flareT = 0;
  private pulseT = 0;
  private lastSeen = 0;
  private hidden = false;
  private counted = false;
  private readonly color: number;
  private readonly motif: Motif | 'primal' | 'mote';
  private readonly rate: number;
  private readonly printKind: Motif | 'primal' | 'mote' | null;
  private readonly weaponMotif: Motif | null;
  private readonly weaponTier: number;
  private readonly weaponTemper: number;
  private readonly weaponAccent: number;
  private readonly setMotif: Motif | null;
  private readonly setN: number;

  /** `world`: the view lives in the game scene (its ground effects go to the scene underlay); previews and galleries
   *  keep everything inside the view. */
  constructor(private look: PlayerLook, private p: GearProfile, private back: Container, private front: Container, private bodyFx: Container, private quality: GearQuality, wings: boolean, world = false) {
    const set = p.topSet && p.topSetCount >= 2 ? SET_STYLE[p.topSet] : undefined;
    this.setMotif = set?.motif ?? null;
    this.setN = set ? p.topSetCount : 0;
    const w = itemStyle(look.slots.mainhand);
    this.weaponMotif = w?.motif ?? null;
    this.weaponTier = w?.tier ?? 0;
    this.weaponTemper = w?.fx.temper ?? 0;
    this.weaponAccent = w?.accent || 0xfff0c8;
    this.color = p.primals ? PRIMAL_RED : set ? set.main : p.ancients ? ANCIENT_GOLD : p.rank >= 6 ? (w?.accent || 0xffb347) : GEAR_TIER_COLORS[p.rank];
    this.motif = p.primals ? 'primal' : set ? set.motif : p.ancients ? 'ember' : (this.weaponMotif ?? 'mote');
    this.rate = quality === 'full' ? Math.max(0, p.rank - 5) * 1.3 + (this.setN >= 2 ? 1.2 : 0) + (this.setN >= 6 ? 1.5 : 0) : 0;
    const feet = itemStyle(look.slots.feet);
    this.printKind = quality !== 'full' ? null : this.setN >= 6 ? set!.motif : p.primals ? 'primal' : (feet && feet.tier >= 6) || p.rank >= 7 ? (feet?.motif ?? (p.ancients ? 'ember' : 'mote')) : null;
    const under = world ? underlay : null;
    this.worldGround = !!under;
    this.ground = under ? new Container({ label: 'gear-ground' }) : back;
    if (under) under.addChild(this.ground);
    if (quality === 'off') return;
    this.build(wings);
    alive.add(this);
  }

  private add(parent: Container, tex: Texture, tint: number, alpha: number, add = true): Sprite {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.tint = tint; s.alpha = alpha;
    if (add) s.blendMode = 'add';
    parent.addChild(s);
    this.sprites.push(s);
    return s;
  }

  private build(wings: boolean): void {
    const p = this.p, F = fx(), T = tok(), col = this.color, full = this.quality === 'full';
    // ground sigil: rank 5+, or any Set bonus; Set sigils light one socket per worn piece; turns slowly
    if (p.rank >= 5 || this.setN >= 2) {
      const tex = p.primals ? T.sigilPrimal : this.setN >= 2 ? T.sigilSet : T.sigil;
      const size = sigilSize(p.rank, this.setN);
      const wrap = new Container();
      wrap.scale.y = 0.42;
      this.ground.addChild(wrap);
      this.sigilWrap = wrap;
      this.sigil = this.add(wrap, tex, col, 0);
      this.sigil.width = this.sigil.height = size;
      this.sigilRing = this.add(this.ground, F.ringSoft, col, 0);
      this.sigilRing.width = size * 1.12; this.sigilRing.height = size * 1.12 * 0.42;
      if (this.setN >= 2) for (let i = 0; i < 6; i++) {
        const n = this.add(this.ground, T.node, i < this.setN ? light(col, 0.3) : 0x6a6a6a, 0);
        n.width = n.height = 7 + Math.max(0, p.rank - 6);
        this.nodes.push(n);
      }
    }
    // light column: rank 8+ (spottable at the screen edge); Primal adds rising embers
    if (p.rank >= 8) {
      this.column = this.add(this.ground, T.column, col, 0);
      this.column.anchor.set(0.5, 1);
      this.column.width = p.primals ? 26 : 20; this.column.height = 140;
      this.columnCore = this.add(this.ground, T.column, light(col, 0.55), 0);
      this.columnCore.anchor.set(0.5, 1);
      this.columnCore.width = p.primals ? 9 : 7; this.columnCore.height = 120;
    }
    // movement ribbon (afterimage band) behind a moving hero: Heroic+
    if (p.rank >= 7 && full) {
      this.ribbon = new Ribbon(16, T.band);
      this.ribbon.mesh.blendMode = 'add';
      this.ribbon.mesh.tint = col;
      this.ground.addChild(this.ribbon.mesh);
    }
    // body aura: Storied+
    if (p.rank >= 6) {
      this.aura = this.add(this.back, F.glowSoft, col, 0);
      this.aura.width = 64 + (p.rank - 6) * 10; this.aura.height = this.aura.width * 1.3;
    }
    // wing glow
    if (wings) { this.wingGlow = this.add(this.back, F.glowSoft, col, 0); this.wingGlow.width = 120 + Math.max(0, p.rank - 7) * 24; this.wingGlow.height = 80; }
    // halo: an Ancient / Primal helm or rank 8+
    const head = itemStyle(this.look.slots.head);
    if ((head && head.tier >= 8) || p.rank >= 8) {
      const hc = p.primals ? PRIMAL_RED : head?.fx.ancient ? ANCIENT_GOLD : col;
      this.halo = this.add(this.front, F.ring, light(hc, 0.2), 0);
      this.halo.width = 30; this.halo.height = 9;
      const n = full ? (p.primals ? 5 : 3) : 0;
      for (let i = 0; i < n; i++) { const g = this.add(this.front, p.primals ? F.flame : F.sparkle, p.primals ? (i % 2 ? PRIMAL_CORE : PRIMAL_RED) : light(hc, 0.4), 0); g.width = p.primals ? 6 : 8; g.height = p.primals ? 10 : 8; g.anchor.set(0.5, p.primals ? 0.9 : 0.5); this.haloGlints.push(g); }
    }
    // orbiting charms: Set motif tokens (4+ pieces) and jewellery gems — larger from the spectacle pass
    if (this.setN >= 4) {
      const m = this.setMotif!;
      const tex = m === 'cog' ? T.cog : m === 'stone' ? T.rock : m === 'shard' ? T.shard : m === 'feather' ? T.feather : m === 'lantern' ? F.glow : m === 'rain' ? T.drop : m === 'star' ? F.sparkle : m === 'ember' ? F.flame : F.streak;
      const n = this.setN >= 6 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const s = this.add(this.front, tex, m === 'lantern' ? 0xffd27a : light(col, 0.15), 0.9, true);
        const sz = (m === 'cog' || m === 'stone' ? 15 : m === 'wind' ? 34 : 14) * (this.setN >= 6 ? 1.15 : 1);
        s.width = sz; s.height = m === 'wind' ? 7 : sz;
        this.orbiters.push({ s, r: 27 + (i % 2) * 4, speed: m === 'wind' ? 2.6 : m === 'cog' ? 0.9 : 1.2, phase: (i / n) * TAU, y: -26 - (i % 3) * 8, spin: m === 'cog' ? 1.6 : m === 'shard' || m === 'stone' ? 0.6 : 0, streak: m === 'wind' });
      }
      if (m === 'rain' && this.setN >= 6) { this.cloud = this.add(this.front, F.glowSoft, 0xd8d0ff, 0); this.cloud.width = 60; this.cloud.height = 20; }
    }
    for (const slot of ['ring1', 'ring2'] as const) {
      const n = this.look.jw?.[slot];
      if (n === undefined) continue;
      const tier = n & 15;
      if (tier < 3) continue;
      const legIdx = (n >>> 14) & 31;
      const legId = legIdx ? Object.keys(LEGENDARIES)[legIdx - 1] : undefined;
      const c = legId ? LEGENDARIES[legId].colors.glow : GEAR_TIER_COLORS[tier];
      const s = this.add(this.front, F.sparkle, light(c, 0.2), 0.95);
      s.width = s.height = 8 + Math.min(6, (tier - 3) * 1.1);
      this.orbiters.push({ s, r: 20, speed: slot === 'ring1' ? 1.7 : -1.4, phase: slot === 'ring1' ? 0 : Math.PI, y: -17, spin: 0, streak: false });
    }
    // weapon: sheen sweep (temper or Heroic+), motif flames / sparks, a star on +10
    if (this.look.slots.mainhand && full) {
      if (this.weaponTemper >= 1 || this.weaponTier >= 7) { this.sheen = this.add(this.bodyFx, F.streak, 0xffffff, 0); this.sheen.height = 6; this.sheen.width = 22; }
      if (this.weaponTier >= 6) {
        const m = this.weaponMotif;
        const n = m === 'ember' || m === 'flame' || m === 'blood' || m === 'storm' || m === 'void' || m === 'frost' ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const tex = m === 'ember' || m === 'flame' ? F.flame : m === 'void' ? F.swirl : m === 'storm' ? F.sparkle : m === 'blood' ? T.drop : F.sparkle;
          const s = this.add(this.bodyFx, tex, motifColor(m, this.color), 0);
          s.width = m === 'void' ? 16 : 8; s.height = m === 'void' ? 16 : m === 'ember' || m === 'flame' ? 13 : 8;
          if (m === 'ember' || m === 'flame') s.anchor.set(0.5, 0.9);
          this.bladeFx.push(s);
        }
      }
      if (this.weaponTemper >= 3) { this.tipStar = this.add(this.bodyFx, F.sparkle, 0xfff4d0, 0); this.tipStar.width = this.tipStar.height = 11; }
    }
    // Primal heartbeat ring
    if (p.primals) { this.pulse = this.add(this.ground, F.ringSoft, PRIMAL_RED, 0); }
    this.counted = true;
    gearFxStats.heroes++;
    gearFxStats.sprites += this.sprites.length;
  }

  /** Level-up / paragon: everything flares for a moment. */
  flare(): void { this.flareT = 1; }

  /** Hide the ground effects when the hero has not been updated for a while (culled / off screen). */
  sweep(now: number): void {
    if (!this.worldGround) return;
    const stale = now - this.lastSeen > 250;
    if (stale !== this.hidden) { this.hidden = stale; this.ground.visible = !stale; }
  }

  /** Ground position: world space in the scene underlay, view-local in galleries. */
  private gx(a: GearAnchors, x: number): number { return this.worldGround ? x : x - a.wx; }
  private gy(a: GearAnchors, y: number): number { return this.worldGround ? y : y - a.wy; }

  update(a: GearAnchors): void {
    if (this.quality === 'off') return;
    this.lastSeen = performance.now();
    if (this.hidden) { this.hidden = false; this.ground.visible = true; }
    const t = a.t, dt = a.dt, full = this.quality === 'full';
    const k = full ? crowdFactor() : 0;
    this.flareT = Math.max(0, this.flareT - dt / 1.2);
    const cel = a.celebrate >= 0 && a.celebrate < 1.6 ? 1 - a.celebrate / 1.6 : 0;
    const fl = 1 + this.flareT * 1.6 + cel * 1.4;
    const breath = full ? 0.85 + 0.15 * Math.sin(t * 2.2) : 1;
    const prim = this.p.primals > 0;
    // sigil + set sockets (ground layer, beneath telegraphs)
    if (this.sigil) {
      const base = (0.24 + Math.max(0, this.p.rank - 5) * 0.05) * (prim ? 1.35 : 1) * fl;
      this.sigil.alpha = clamp(base * breath, 0, 0.85);
      if (full) this.sigil.rotation = t * (prim ? 0.32 : 0.22);
      this.sigilWrap!.position.set(this.gx(a, a.wx), this.gy(a, a.wy + 1));
      this.sigilRing!.alpha = clamp(base * 0.65 * (full ? 0.8 + 0.2 * Math.sin(t * 1.3) : 1), 0, 0.65);
      this.sigilRing!.position.set(this.gx(a, a.wx), this.gy(a, a.wy + 1));
      const r = this.sigil.width * 0.43;
      for (let i = 0; i < this.nodes.length; i++) {
        const ang = -Math.PI / 2 + (i / 6) * TAU + (full ? t * 0.22 : 0);
        const n = this.nodes[i];
        n.position.set(this.gx(a, a.wx + Math.cos(ang) * r), this.gy(a, a.wy + 1 + Math.sin(ang) * r * 0.42));
        n.alpha = i < this.setN ? clamp((0.75 + 0.25 * Math.sin(t * 3 + i)) * fl, 0, 1) : 0.25;
      }
    }
    if (this.column) {
      const pulse = full ? 0.85 + 0.15 * Math.sin(t * 1.7) : 1;
      this.column.position.set(this.gx(a, a.wx), this.gy(a, a.wy + 2));
      this.column.alpha = clamp((prim ? 0.24 : 0.18) * pulse * fl, 0, 0.7);
      this.columnCore!.position.set(this.gx(a, a.wx), this.gy(a, a.wy + 2));
      this.columnCore!.alpha = clamp((prim ? 0.3 : 0.22) * pulse * fl, 0, 0.8);
      if (full && prim) {
        this.columnAcc += dt * 7 * k;
        while (this.columnAcc >= 1) { this.columnAcc -= 1; this.spawnColumnEmber(a); }
      }
    }
    if (this.aura) {
      this.aura.position.set(0, -30);
      this.aura.alpha = clamp((0.13 + (this.p.rank - 6) * 0.035) * breath * fl, 0, 0.5);
    }
    if (this.wingGlow) { this.wingGlow.position.set(-a.side * 6 * Math.abs(a.sB), -42); this.wingGlow.alpha = 0.18 * breath * fl; }
    if (this.halo) {
      const hx = a.head.x, hy = a.head.y - 23;
      this.halo.position.set(hx, hy);
      this.halo.alpha = clamp(0.6 * breath * fl, 0, 1);
      this.haloGlints.forEach((g, i) => {
        const ang = t * 1.6 + (i / this.haloGlints.length) * TAU;
        g.position.set(hx + Math.cos(ang) * 14, hy + Math.sin(ang) * 4.2);
        g.alpha = Math.sin(ang) > 0 ? 0.95 : 0.35;
        if (prim) g.height = 10 * (0.8 + 0.3 * Math.sin(t * 9 + i * 2));
      });
    }
    if (this.cloud) { this.cloud.position.set(a.head.x, a.head.y - 38); this.cloud.alpha = 0.34 * breath; }
    // orbiters
    for (const o of this.orbiters) {
      const ang = (full ? t * o.speed : 0) + o.phase;
      const sx = Math.cos(ang) * o.r, sy = Math.sin(ang) * o.r * 0.35;
      o.s.position.set(sx, o.y + sy + (full ? Math.sin(t * 2 + o.phase) * 1.8 : 0));
      o.s.alpha = Math.sin(ang) > 0 ? 0.98 : 0.32;
      if (o.spin) o.s.rotation = t * o.spin;
      else if (o.streak) o.s.rotation = ang + Math.PI / 2;
    }
    // weapon sheen / motif / +10 star / swing sparks
    if (a.hasWeapon) {
      const bx = a.wBase.x, by = a.wBase.y, tx = a.wTip.x, ty = a.wTip.y;
      const ang = Math.atan2(ty - by, tx - bx);
      if (this.sheen) {
        const period = 2.6 - this.weaponTemper * 0.45;
        const u = (t % period) / 0.5;
        this.sheen.visible = u <= 1;
        if (u <= 1) { this.sheen.position.set(bx + (tx - bx) * u, by + (ty - by) * u); this.sheen.rotation = ang; this.sheen.alpha = Math.sin(u * Math.PI) * 0.95; }
      }
      this.bladeFx.forEach((s, i) => {
        const m = this.weaponMotif;
        const ph = (t * (m === 'storm' ? 6 : 1.6) + i * 0.37) % 1;
        const u = m === 'void' ? 1 : 0.35 + ((i * 0.31 + Math.floor(t * (m === 'storm' ? 6 : 1.6) + i * 0.37) * 0.27) % 0.65);
        s.position.set(bx + (tx - bx) * u + (m === 'blood' ? 0 : Math.sin(t * 7 + i) * 1.2), by + (ty - by) * u + (m === 'blood' ? ph * 10 : 0));
        s.alpha = m === 'void' ? 0.75 : Math.sin(ph * Math.PI) * 0.95;
        if (m === 'void') s.rotation = -t * 6;
      });
      if (this.tipStar) { this.tipStar.position.set(tx + Math.cos(t * 3) * 4, ty + Math.sin(t * 3) * 4); this.tipStar.alpha = 0.6 + 0.4 * Math.sin(t * 5); this.tipStar.rotation = t * 2; }
      // brighter swings: sparks shed from the blade tip while a Storied+ weapon swings (visual only)
      if (full && this.weaponTier >= 6 && a.swing > 0.25) {
        this.sparkAcc += dt * 40 * a.swing;
        while (this.sparkAcc >= 1) { this.sparkAcc -= 1; this.spawnSpark(a); }
      }
    }
    // Primal heartbeat
    if (this.pulse) {
      this.pulseT += dt;
      const u = (this.pulseT % 1.3) / 0.7;
      this.pulse.visible = u < 1 && full;
      if (u < 1) { const w = 24 + 66 * u; this.pulse.position.set(this.gx(a, a.wx), this.gy(a, a.wy + 1)); this.pulse.width = w; this.pulse.height = w * 0.42; this.pulse.alpha = 0.6 * (1 - u); }
      if (full && this.pulseT % 1.3 < dt) for (let i = 0; i < 4; i++) this.spawn('primal', 'burst', a, i % 2 ? PRIMAL_CORE : PRIMAL_RED);
    }
    this.updateRibbon(a);
    this.updateCelebration(a, full);
    if (!full) return;
    // ambient particles (+ an amber ember stream for Ancients worn under a Set identity)
    this.spawnAcc += dt * this.rate * k;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const amber = this.p.ancients >= 2 && this.motif !== 'ember' && this.motif !== 'primal' && Math.random() < 0.4;
      if (amber) this.spawn('ember', 'rise', a, ANCIENT_GOLD);
      else this.spawn(this.motif, motifKind(this.motif), a, this.color);
    }
    // footprints on each step
    if (this.printKind && a.moving) {
      const ph = Math.floor(a.walk / Math.PI);
      if (ph !== this.stepPhase) { this.stepPhase = ph; this.footprint(a, ph); }
    }
    // full-Set idle flourish
    if (this.setN >= 6 && a.idle > this.idleBurstAt) {
      this.idleBurstAt = a.idle + 6 + Math.random() * 3;
      for (let i = 0; i < 10; i++) this.spawn(this.motif, 'burst', a, i % 3 ? this.color : light(this.color, 0.5));
      this.flareT = Math.max(this.flareT, 0.5);
    }
    if (a.idle < 0.1) this.idleBurstAt = 7;
    this.stepParticles(a, dt);
  }

  /** Afterimage band: world-space samples of the last ~0.3 s while moving, drawn on the ground layer. */
  private updateRibbon(a: GearAnchors): void {
    const r = this.ribbon;
    if (!r) return;
    const now = a.t;
    const pts = this.trailPts;
    const last = pts[0];
    if (a.moving && (!last || Math.hypot(last.x - a.wx, last.y - a.wy) > 3)) pts.unshift({ x: a.wx, y: a.wy, t: now });
    while (pts.length > 16 || (pts.length && now - pts[pts.length - 1].t > 0.32)) pts.pop();
    if (pts.length < 2) { r.hide(); return; }
    r.begin();
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      const age = clamp((now - q.t) / 0.32);
      const al = (1 - age) * 0.55 * (i === 0 ? 0.6 : 1);
      r.push(this.gx(a, q.x), this.gy(a, q.y - 6), this.gx(a, q.x), this.gy(a, q.y - 54), al);
    }
    r.end();
  }

  /** Rank-up / first full Set: expanding rings, a column of light and a fountain of the hero's motif (~1.5 s). */
  private updateCelebration(a: GearAnchors, full: boolean): void {
    const c = a.celebrate;
    if (c < 0 || c > 1.7) {
      for (const s of this.burstRings) s.visible = false;
      if (this.burstColumn) this.burstColumn.visible = false;
      return;
    }
    const F = fx(), T = tok();
    if (!this.burstRings.length) {
      for (let i = 0; i < 3; i++) this.burstRings.push(this.add(this.ground, F.ringSoft, this.color, 0));
      this.burstColumn = this.add(this.ground, T.column, light(this.color, 0.3), 0);
      this.burstColumn.anchor.set(0.5, 1);
    }
    this.burstRings.forEach((s, i) => {
      const u = clamp((c - i * 0.18) / 1.1);
      s.visible = u > 0 && u < 1;
      const w = 30 + (a.celebrateBig ? 230 : 170) * (1 - Math.pow(1 - u, 2.2));
      s.width = w; s.height = w * 0.42;
      s.position.set(this.gx(a, a.wx), this.gy(a, a.wy + 1));
      s.alpha = 0.75 * (1 - u);
    });
    const col = this.burstColumn!;
    const cu = clamp(c / 1.5);
    col.visible = cu < 1;
    col.position.set(this.gx(a, a.wx), this.gy(a, a.wy + 2));
    col.width = 34 * (1 - cu * 0.5); col.height = (a.celebrateBig ? 220 : 170) * Math.min(1, c * 5);
    col.alpha = 0.6 * (1 - cu);
    // the fountain fires once per celebration
    const id = Math.round(a.t - c);
    if (full && this.burstFired !== id && c < 0.1) {
      this.burstFired = id;
      const n = a.celebrateBig ? 28 : 18;
      for (let i = 0; i < n; i++) this.spawn(this.motif, 'burst', a, i % 3 ? this.color : light(this.color, 0.55));
    }
  }

  private take(ground: boolean): Part | null {
    let p = this.parts.find((q) => q.t >= q.life);
    if (!p) {
      if (this.parts.length >= 22) return null;
      const s = new Sprite(fx().dot);
      s.anchor.set(0.5); s.blendMode = 'add'; s.visible = false;
      this.parts.push(p = { s, kind: 'rise', life: 0, t: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, size: 6, ground, a: 1 });
    }
    const parent = ground ? this.ground : Math.random() < 0.6 ? this.front : this.back;
    if (p.s.parent !== parent) parent.addChild(p.s);
    p.ground = ground;
    return p;
  }

  private spawn(m: Motif | 'primal' | 'mote', kind: Kind, a: GearAnchors, color: number): void {
    const p = this.take(false);
    if (!p) return;
    const r = Math.random;
    p.kind = kind; p.t = 0; p.a = 1;
    p.s.texture = motifTexture(m);
    p.s.anchor.set(0.5, m === 'ember' || m === 'flame' || m === 'primal' ? 0.85 : 0.5);
    p.s.tint = m === 'primal' && r() < 0.4 ? PRIMAL_CORE : color;
    p.s.rotation = 0; p.rot = 0;
    p.size = m === 'ember' || m === 'flame' || m === 'primal' ? 8 : m === 'wind' || m === 'storm' ? 18 : m === 'stone' ? 6 : 7;
    switch (kind) {
      case 'rise': p.x = (r() - 0.5) * 30; p.y = -6 - r() * 48; p.vx = (r() - 0.5) * 8; p.vy = -14 - r() * 18; p.life = 1 + r() * 0.6; break;
      case 'fall': p.x = (r() - 0.5) * 40 + a.head.x * 0.5; p.y = -92 - r() * 10; p.vx = -6; p.vy = 120 + r() * 40; p.life = 0.58; break;
      case 'drift': p.x = (r() - 0.5) * 34; p.y = -50 - r() * 12; p.vx = (r() - 0.5) * 20; p.vy = 10 + r() * 10; p.life = 1.6 + r() * 0.6; p.rot = (r() - 0.5) * 4; break;
      case 'swirl': p.x = 0; p.y = -6 - r() * 22; p.vx = r() * TAU; p.vy = 0; p.life = 0.8; break;
      case 'burst': { const ang = r() * TAU, sp = 36 + r() * 46; p.x = Math.cos(ang) * 6; p.y = -28 + Math.sin(ang) * 6; p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp - 26; p.life = 0.75 + r() * 0.35; break; }
      default: p.life = 0.8;
    }
    if (m === 'lantern' && kind === 'drift') { p.vy = -8 - r() * 6; p.life = 2.2; }
    p.s.visible = true;
  }

  /** Primal: embers rising along the light column (ground layer). */
  private spawnColumnEmber(a: GearAnchors): void {
    const p = this.take(true);
    if (!p) return;
    const r = Math.random;
    p.kind = 'column'; p.t = 0; p.life = 1.4 + r() * 0.6; p.a = 1;
    p.x = a.wx + (r() - 0.5) * 14; p.y = a.wy - r() * 20; p.vx = (r() - 0.5) * 6; p.vy = -70 - r() * 40;
    p.s.texture = fx().flame; p.s.anchor.set(0.5, 0.85); p.s.tint = r() < 0.4 ? PRIMAL_CORE : PRIMAL_RED; p.s.rotation = 0;
    p.size = 6; p.rot = 0;
    p.s.visible = true;
  }

  /** A spark shed from the swinging blade tip (body layer). */
  private spawnSpark(a: GearAnchors): void {
    const p = this.take(false);
    if (!p) return;
    const r = Math.random;
    p.kind = 'burst'; p.t = 0; p.life = 0.32 + r() * 0.2; p.a = 1;
    p.x = a.wTip.x + (r() - 0.5) * 4; p.y = a.wTip.y + (r() - 0.5) * 4;
    const ang = r() * TAU, sp = 30 + r() * 60;
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
    p.s.texture = fx().sparkle; p.s.anchor.set(0.5); p.s.tint = light(this.weaponAccent, 0.35); p.s.rotation = r() * TAU;
    p.size = 7; p.rot = 0;
    if (p.s.parent !== this.front) this.front.addChild(p.s);
    p.s.visible = true;
  }

  private footprint(a: GearAnchors, ph: number): void {
    const p = this.take(true);
    if (!p) return;
    const m = this.printKind!;
    const sideOff = (ph % 2 ? 1 : -1) * 4;
    p.kind = m === 'rain' ? 'ripple' : 'print';
    p.t = 0; p.life = m === 'rain' ? 0.8 : 1.1; p.a = 1;
    p.x = a.wx + sideOff * Math.abs(a.cB); p.y = a.wy + 3 + sideOff * 0.3 * Math.abs(a.sB);
    const T = tok(), F = fx();
    p.s.texture = m === 'rain' ? F.ring : m === 'stone' ? T.crack : m === 'wind' || m === 'storm' ? F.swirl : m === 'star' ? F.sparkle : m === 'lantern' ? T.petal : m === 'ember' || m === 'flame' || m === 'primal' ? F.flame : m === 'shard' ? T.shard : m === 'feather' ? T.feather : m === 'cog' ? F.smoke : T.print;
    p.s.anchor.set(0.5, m === 'ember' || m === 'flame' || m === 'primal' ? 0.85 : 0.5);
    p.s.tint = m === 'primal' ? PRIMAL_RED : this.color;
    p.size = m === 'wind' || m === 'storm' ? 15 : m === 'stone' ? 17 : 10;
    p.rot = m === 'wind' || m === 'storm' ? 5 : 0;
    p.s.rotation = 0;
    p.vx = 0; p.vy = 0;
    p.s.visible = true;
  }

  private stepParticles(a: GearAnchors, dt: number): void {
    const streak = fx().streak, flame = fx().flame;
    for (const p of this.parts) {
      if (p.t >= p.life) { if (p.s.visible) p.s.visible = false; continue; }
      p.t += dt;
      const u = p.t / p.life;
      let x = p.x, y = p.y, alpha = 1, sc = 1;
      switch (p.kind) {
        case 'rise': p.x += p.vx * dt + Math.sin(p.t * 5 + p.y) * 4 * dt; p.y += p.vy * dt; x = p.x; y = p.y; alpha = Math.sin(u * Math.PI); sc = 1 - u * 0.5; break;
        case 'fall': p.x += p.vx * dt; p.y += p.vy * dt; x = p.x; y = p.y; alpha = u < 0.85 ? 0.8 : (1 - u) / 0.15 * 0.8; break;
        case 'drift': p.x += (p.vx + Math.sin(p.t * 3) * 12) * dt; p.y += p.vy * dt; p.s.rotation += p.rot * dt; x = p.x; y = p.y; alpha = Math.sin(u * Math.PI) * 0.9; break;
        case 'swirl': { const ang = p.vx + p.t * 7, r = 16 + u * 12; x = Math.cos(ang) * r; y = p.y + Math.sin(ang) * r * 0.35 - u * 18; p.s.rotation = ang + Math.PI / 2; alpha = Math.sin(u * Math.PI) * 0.7; break; }
        case 'burst': p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; x = p.x; y = p.y; alpha = 1 - u; sc = 1 - u * 0.4; break;
        case 'column': p.x += p.vx * dt; p.y += p.vy * dt; x = this.gx(a, p.x); y = this.gy(a, p.y); alpha = Math.sin(u * Math.PI) * 0.9; sc = 1 - u * 0.4; break;
        case 'print': x = this.gx(a, p.x); y = this.gy(a, p.y); alpha = (1 - u) * 0.8; if (p.rot) p.s.rotation += p.rot * dt; break;
        case 'ripple': x = this.gx(a, p.x); y = this.gy(a, p.y); alpha = (1 - u) * 0.7; sc = 0.3 + u * 1.4; break;
      }
      p.s.position.set(x, y);
      p.s.alpha = clamp(alpha, 0, 1);
      const sz = p.size * sc;
      if (p.kind === 'ripple') { p.s.width = 20 * sc; p.s.height = 20 * sc * 0.42; }
      else if (p.s.texture === streak) { p.s.width = sz * 1.4; p.s.height = sz * 0.3; }
      else if (p.s.texture === flame) { p.s.height = sz * 1.5; p.s.width = sz; }
      else { p.s.width = p.s.height = sz; }
    }
  }

  destroy(): void {
    alive.delete(this);
    if (this.counted) { gearFxStats.heroes--; gearFxStats.sprites -= this.sprites.length; this.counted = false; }
    for (const s of this.sprites) s.destroy();
    for (const p of this.parts) p.s.destroy();
    this.ribbon?.destroy(); this.ribbon = null;
    if (this.worldGround) this.ground.destroy({ children: true });
    this.sigilWrap?.destroy({ children: true });
    this.sprites = []; this.parts = []; this.orbiters = []; this.bladeFx = []; this.nodes = []; this.haloGlints = []; this.burstRings = [];
  }
}

/** The motif a profile reads as (gallery labels, showcase card). */
export function profileMotif(look: PlayerLook, p: GearProfile): Motif | 'primal' | null {
  if (p.primals) return 'primal';
  if (p.topSet && p.topSetCount >= 2) return SET_STYLE[p.topSet]?.motif ?? null;
  const w = look.slots.mainhand && itemStyle(look.slots.mainhand);
  return w?.fx.legendary ? LEGENDARY_MOTIF[w.fx.legendary] ?? null : null;
}

export function dominantColor(look: PlayerLook, p: GearProfile): number {
  if (p.primals) return PRIMAL_RED;
  if (p.topSet && p.topSetCount >= 2) return SET_STYLE[p.topSet]?.main ?? GEAR_TIER_COLORS[p.rank];
  if (p.ancients) return ANCIENT_GOLD;
  return p.rank >= 6 ? (itemStyle(look.slots.mainhand)?.accent || 0xffb347) : GEAR_TIER_COLORS[p.rank];
}
