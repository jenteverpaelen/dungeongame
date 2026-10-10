// Live gear effects (docs/rework/gear/DESIGN.md §2–§5): the animated layer on top of the baked ornaments — ground
// sigil, body aura, per-piece emissive glows, motif particles, orbiting charms, footprints, weapon sheen and motif
// flames, the Ancient / Primal halo, the Primal heartbeat and the full-Set idle flourish. All sprites are pooled and
// created once per look; per frame only positions / alphas change. A shared budget thins particles when many heroes
// are on screen, and quality 'reduced' keeps only steady glows (no particles, no motion), 'off' shows nothing.

import { CanvasSource, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { GearProfile } from '@shared/gearVisual';
import { GEAR_TIER_COLORS } from '@shared/gearVisual';
import type { LookSlot, PlayerLook } from '@shared/protocol';
import { LEGENDARIES } from '@shared/data/items';
import { fx } from './fx';
import { ANCIENT_GOLD, LEGENDARY_MOTIF, PRIMAL_CORE, PRIMAL_RED, SET_STYLE, itemStyle, motifColor, type Motif } from './gearStyle';
import { TAU, clamp, light, mix } from './util';

export type GearQuality = 'full' | 'reduced' | 'off';

export interface P3 { x: number; y: number; d: number }
export interface GearAnchors {
  t: number; dt: number;
  /** World position of the hero (footprints stay where they were left). */
  wx: number; wy: number;
  moving: boolean; walk: number; idle: number;
  side: number; sB: number; cB: number;
  head: P3; chest: P3; hR: P3; hL: P3; wTip: P3; wBase: P3;
  hasWeapon: boolean; bow: boolean;
}

// ─────────────────────────── shared token sheet (canvas, tinted at runtime) ───────────────────────────

interface Tokens { sigil: Texture; sigilSet: Texture; sigilPrimal: Texture; node: Texture; shard: Texture; leaf: Texture; feather: Texture; drop: Texture; rock: Texture; cog: Texture; petal: Texture; print: Texture; crack: Texture }
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
  // set sigil (128) at (128,0): double ring, six node sockets (lit nodes are separate sprites)
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
  // 32px tokens on the row y = 128
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
  };
  return tokens;
}

/** Ground sigil textures for other systems (loot beams): runic ring, Set ring, Primal ring. */
export function gearSigilTexture(kind: 'rune' | 'set' | 'primal'): Texture {
  const T = tok();
  return kind === 'primal' ? T.sigilPrimal : kind === 'set' ? T.sigilSet : T.sigil;
}

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

type Kind = 'rise' | 'fall' | 'drift' | 'swirl' | 'burst' | 'print' | 'ripple';
interface Part { s: Sprite; kind: Kind; life: number; t: number; x: number; y: number; vx: number; vy: number; rot: number; size: number; world: boolean; a: number }

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

export class GearFx {
  private sprites: Sprite[] = [];
  private parts: Part[] = [];
  private sigil: Sprite | null = null;
  private sigilRing: Sprite | null = null;
  private nodes: Sprite[] = [];
  private aura: Sprite | null = null;
  private halo: Sprite | null = null;
  private haloGlints: Sprite[] = [];
  private orbiters: { s: Sprite; r: number; speed: number; phase: number; y: number; scale: number; spin: number }[] = [];
  private sheen: Sprite | null = null;
  private bladeFx: Sprite[] = [];
  private tipStar: Sprite | null = null;
  private pulse: Sprite | null = null;
  private wingGlow: Sprite | null = null;
  private cloud: Sprite | null = null;
  private spawnAcc = 0;
  private stepPhase = 0;
  private idleBurstAt = 7;
  private flareT = 0;
  private pulseT = 0;
  private readonly color: number;
  private readonly motif: Motif | 'primal' | 'mote';
  private readonly rate: number;
  private readonly printKind: Motif | 'primal' | 'mote' | null;
  private readonly weaponMotif: Motif | null;
  private readonly weaponTier: number;
  private readonly weaponTemper: number;
  private readonly setMotif: Motif | null;
  private readonly setN: number;

  constructor(private look: PlayerLook, private p: GearProfile, private back: Container, private front: Container, private bodyFx: Container, private quality: GearQuality, wings: boolean) {
    const set = p.topSet && p.topSetCount >= 2 ? SET_STYLE[p.topSet] : undefined;
    this.setMotif = set?.motif ?? null;
    this.setN = set ? p.topSetCount : 0;
    const w = itemStyle(look.slots.mainhand);
    this.weaponMotif = w?.motif ?? null;
    this.weaponTier = w?.tier ?? 0;
    this.weaponTemper = w?.fx.temper ?? 0;
    this.color = p.primals ? PRIMAL_RED : set ? set.main : p.ancients ? ANCIENT_GOLD : p.rank >= 6 ? (w?.accent || 0xffb347) : GEAR_TIER_COLORS[p.rank];
    this.motif = p.primals ? 'primal' : set ? set.motif : p.ancients ? 'ember' : (this.weaponMotif ?? 'mote');
    this.rate = quality === 'full' ? Math.max(0, p.rank - 5) * 1.3 + (this.setN >= 2 ? 1.2 : 0) + (this.setN >= 6 ? 1.5 : 0) : 0;
    const feet = itemStyle(look.slots.feet);
    this.printKind = quality !== 'full' ? null : this.setN >= 6 ? set!.motif : p.primals ? 'primal' : (feet && feet.tier >= 6) || p.rank >= 7 ? (feet?.motif ?? (p.ancients ? 'ember' : 'mote')) : null;
    if (quality === 'off') return;
    this.build(wings);
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
    const p = this.p, F = fx(), T = tok(), col = this.color;
    // ground sigil: rank 5+, or any Set bonus; Set sigils light one node per worn piece
    if (p.rank >= 5 || this.setN >= 2) {
      const tex = p.primals ? T.sigilPrimal : this.setN >= 2 ? T.sigilSet : T.sigil;
      const size = 30 + Math.max(0, p.rank - 5) * 3.2;
      this.sigil = this.add(this.back, tex, col, 0);
      this.sigil.width = size; this.sigil.height = size * 0.42;
      this.sigilRing = this.add(this.back, F.ringSoft, col, 0);
      this.sigilRing.width = size * 1.15; this.sigilRing.height = size * 1.15 * 0.42;
      if (this.setN >= 2) for (let i = 0; i < 6; i++) {
        const n = this.add(this.back, T.node, i < this.setN ? light(col, 0.3) : 0x6a6a6a, 0);
        n.width = n.height = 6;
        this.nodes.push(n);
      }
    }
    // body aura: Storied+
    if (p.rank >= 6) {
      this.aura = this.add(this.back, F.glowSoft, col, 0);
      this.aura.width = 58 + (p.rank - 6) * 7; this.aura.height = this.aura.width * 1.3;
    }
    // wing glow
    if (wings) { this.wingGlow = this.add(this.back, F.glowSoft, col, 0); this.wingGlow.width = 96; this.wingGlow.height = 64; }
    // halo: an Ancient / Primal helm or rank 8+
    const head = itemStyle(this.look.slots.head);
    if ((head && head.tier >= 8) || p.rank >= 8) {
      const hc = p.primals ? PRIMAL_RED : head?.fx.ancient ? ANCIENT_GOLD : col;
      this.halo = this.add(this.front, F.ring, light(hc, 0.2), 0);
      this.halo.width = 26; this.halo.height = 8;
      const n = this.quality === 'full' ? (p.primals ? 4 : 2) : 0;
      for (let i = 0; i < n; i++) { const g = this.add(this.front, p.primals ? F.flame : F.sparkle, p.primals ? (i % 2 ? PRIMAL_CORE : PRIMAL_RED) : light(hc, 0.4), 0); g.width = p.primals ? 5 : 6; g.height = p.primals ? 8 : 6; g.anchor.set(0.5, p.primals ? 0.9 : 0.5); this.haloGlints.push(g); }
    }
    // orbiting charms: Set motif tokens (4+ pieces) and jewellery gems
    if (this.quality === 'full' || this.quality === 'reduced') {
      if (this.setN >= 4) {
        const m = this.setMotif!;
        const tex = m === 'cog' ? T.cog : m === 'stone' ? T.rock : m === 'shard' ? T.shard : m === 'feather' ? T.feather : m === 'lantern' ? F.glow : m === 'rain' ? T.drop : m === 'star' ? F.sparkle : m === 'ember' ? F.flame : F.streak;
        const n = this.setN >= 6 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const s = this.add(this.front, tex, m === 'lantern' ? 0xffd27a : light(col, 0.15), 0.9, true);
          const sz = m === 'cog' || m === 'stone' ? 9 : m === 'wind' ? 22 : 8;
          s.width = sz; s.height = m === 'wind' ? 5 : sz;
          this.orbiters.push({ s, r: 21 + (i % 2) * 3, speed: m === 'wind' ? 2.6 : m === 'cog' ? 0.9 : 1.2, phase: (i / n) * TAU, y: -24 - (i % 3) * 6, scale: 1, spin: m === 'cog' ? 1.6 : m === 'shard' || m === 'stone' ? 0.6 : 0 });
        }
        if (m === 'rain' && this.setN >= 6) { this.cloud = this.add(this.front, F.glowSoft, 0xd8d0ff, 0); this.cloud.width = 46; this.cloud.height = 16; }
      }
      for (const slot of ['ring1', 'ring2'] as const) {
        const n = this.look.jw?.[slot];
        if (n === undefined) continue;
        const tier = n & 15;
        if (tier < 3) continue;
        const legIdx = (n >>> 14) & 31;
        const legId = legIdx ? Object.keys(LEGENDARIES)[legIdx - 1] : undefined;
        const c = legId ? LEGENDARIES[legId].colors.glow : GEAR_TIER_COLORS[tier];
        const s = this.add(this.front, F.sparkle, light(c, 0.2), 0.9);
        s.width = s.height = 5 + Math.min(4, tier - 3);
        this.orbiters.push({ s, r: 17, speed: slot === 'ring1' ? 1.7 : -1.4, phase: slot === 'ring1' ? 0 : Math.PI, y: -16, scale: 1, spin: 0 });
      }
    }
    // weapon: sheen sweep (temper or Heroic+), motif flames / sparks, a star on +10
    if (this.look.slots.mainhand && this.quality === 'full') {
      if (this.weaponTemper >= 1 || this.weaponTier >= 7) { this.sheen = this.add(this.bodyFx, F.streak, 0xffffff, 0); this.sheen.height = 5; this.sheen.width = 18; }
      if (this.weaponTier >= 6) {
        const m = this.weaponMotif;
        const n = m === 'ember' || m === 'flame' || m === 'blood' || m === 'storm' || m === 'void' || m === 'frost' ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const tex = m === 'ember' || m === 'flame' ? F.flame : m === 'void' ? F.swirl : m === 'storm' ? F.sparkle : m === 'blood' ? T.drop : F.sparkle;
          const s = this.add(this.bodyFx, tex, motifColor(m, this.color), 0);
          s.width = m === 'void' ? 14 : 7; s.height = m === 'void' ? 14 : m === 'ember' || m === 'flame' ? 11 : 7;
          if (m === 'ember' || m === 'flame') s.anchor.set(0.5, 0.9);
          this.bladeFx.push(s);
        }
      }
      if (this.weaponTemper >= 3) { this.tipStar = this.add(this.bodyFx, F.sparkle, 0xfff4d0, 0); this.tipStar.width = this.tipStar.height = 9; }
    }
    // Primal heartbeat ring
    if (p.primals) { this.pulse = this.add(this.back, F.ringSoft, PRIMAL_RED, 0); }
    gearFxStats.heroes++;
    gearFxStats.sprites += this.sprites.length;
  }

  /** Level-up / paragon: everything flares for a moment. */
  flare(): void { this.flareT = 1; }

  update(a: GearAnchors): void {
    if (this.quality === 'off') return;
    const t = a.t, dt = a.dt, full = this.quality === 'full';
    const k = full ? crowdFactor() : 0;
    this.flareT = Math.max(0, this.flareT - dt / 1.2);
    const fl = 1 + this.flareT * 1.6;
    const breath = full ? 0.85 + 0.15 * Math.sin(t * 2.2) : 1;
    // sigil + set nodes
    if (this.sigil) {
      const base = (0.22 + Math.max(0, this.p.rank - 5) * 0.045) * fl;
      this.sigil.alpha = clamp(base * breath, 0, 0.8);
      if (full) this.sigil.rotation = 0; // rotation reads wrong on a squashed ellipse: animate the nodes instead
      this.sigil.position.set(0, 1);
      this.sigilRing!.alpha = clamp(base * 0.6 * (full ? 0.8 + 0.2 * Math.sin(t * 1.3) : 1), 0, 0.6);
      this.sigilRing!.position.set(0, 1);
      const r = this.sigil.width * 0.43;
      for (let i = 0; i < this.nodes.length; i++) {
        const ang = -Math.PI / 2 + (i / 6) * TAU + (full ? t * 0.35 : 0);
        const n = this.nodes[i];
        n.position.set(Math.cos(ang) * r, 1 + Math.sin(ang) * r * 0.42);
        n.alpha = i < this.setN ? clamp((0.75 + 0.25 * Math.sin(t * 3 + i)) * fl, 0, 1) : 0.25;
      }
    }
    if (this.aura) {
      this.aura.position.set(0, -30);
      this.aura.alpha = clamp((0.12 + (this.p.rank - 6) * 0.03) * breath * fl, 0, 0.5);
    }
    if (this.wingGlow) { this.wingGlow.position.set(-a.side * 6 * Math.abs(a.sB), -40); this.wingGlow.alpha = 0.16 * breath * fl; }
    if (this.halo) {
      const hx = a.head.x, hy = a.head.y - 21;
      this.halo.position.set(hx, hy);
      this.halo.alpha = clamp(0.55 * breath * fl, 0, 1);
      this.haloGlints.forEach((g, i) => {
        const ang = t * 1.6 + (i / this.haloGlints.length) * TAU;
        g.position.set(hx + Math.cos(ang) * 12, hy + Math.sin(ang) * 3.6);
        const front = Math.sin(ang) > 0;
        g.alpha = front ? 0.95 : 0.35;
        if (this.p.primals) g.height = 8 * (0.8 + 0.3 * Math.sin(t * 9 + i * 2));
      });
    }
    if (this.cloud) { this.cloud.position.set(a.head.x, a.head.y - 34); this.cloud.alpha = 0.32 * breath; }
    // orbiters
    for (const o of this.orbiters) {
      const ang = (full ? t * o.speed : 0) + o.phase;
      const sx = Math.cos(ang) * o.r, sy = Math.sin(ang) * o.r * 0.35;
      o.s.position.set(sx, o.y + sy + (full ? Math.sin(t * 2 + o.phase) * 1.5 : 0));
      const front = Math.sin(ang) > 0;
      o.s.alpha = front ? 0.95 : 0.3;
      if (o.spin) o.s.rotation = t * o.spin;
      else if (o.s.texture === fx().streak) o.s.rotation = ang + Math.PI / 2;
    }
    // weapon sheen / motif / +10 star
    if (a.hasWeapon) {
      const bx = a.wBase.x, by = a.wBase.y, tx = a.wTip.x, ty = a.wTip.y;
      const ang = Math.atan2(ty - by, tx - bx);
      if (this.sheen) {
        const period = 2.6 - this.weaponTemper * 0.45;
        const u = (t % period) / 0.5;
        this.sheen.visible = u <= 1;
        if (u <= 1) { this.sheen.position.set(bx + (tx - bx) * u, by + (ty - by) * u); this.sheen.rotation = ang; this.sheen.alpha = Math.sin(u * Math.PI) * 0.9; }
      }
      this.bladeFx.forEach((s, i) => {
        const m = this.weaponMotif;
        const ph = (t * (m === 'storm' ? 6 : 1.6) + i * 0.37) % 1;
        const u = m === 'void' ? 1 : 0.35 + ((i * 0.31 + Math.floor(t * (m === 'storm' ? 6 : 1.6) + i * 0.37) * 0.27) % 0.65);
        s.position.set(bx + (tx - bx) * u + (m === 'blood' ? 0 : Math.sin(t * 7 + i) * 1.2), by + (ty - by) * u + (m === 'blood' ? ph * 10 : 0));
        s.alpha = m === 'void' ? 0.7 : Math.sin(ph * Math.PI) * 0.9;
        if (m === 'void') s.rotation = -t * 6;
      });
      if (this.tipStar) { this.tipStar.position.set(tx + Math.cos(t * 3) * 4, ty + Math.sin(t * 3) * 4); this.tipStar.alpha = 0.6 + 0.4 * Math.sin(t * 5); this.tipStar.rotation = t * 2; }
    }
    // Primal heartbeat
    if (this.pulse) {
      this.pulseT += dt;
      const u = (this.pulseT % 1.3) / 0.7;
      this.pulse.visible = u < 1 && full;
      if (u < 1) { const w = 18 + 52 * u; this.pulse.position.set(0, -26); this.pulse.width = w; this.pulse.height = w * 0.55; this.pulse.alpha = 0.55 * (1 - u); }
      if (full && this.pulseT % 1.3 < dt) for (let i = 0; i < 4; i++) this.spawn('primal', 'burst', a, i % 2 ? PRIMAL_CORE : PRIMAL_RED);
    }
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

  private take(world: boolean): Part | null {
    let p = this.parts.find((q) => q.t >= q.life);
    if (!p) {
      if (this.parts.length >= 18) return null;
      const s = new Sprite(fx().dot);
      s.anchor.set(0.5); s.blendMode = 'add'; s.visible = false;
      this.parts.push(p = { s, kind: 'rise', life: 0, t: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, size: 6, world, a: 1 });
    }
    const parent = world ? this.back : Math.random() < 0.6 ? this.front : this.back;
    if (p.s.parent !== parent) parent.addChild(p.s);
    p.world = world;
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
    p.size = m === 'ember' || m === 'flame' || m === 'primal' ? 7 : m === 'wind' || m === 'storm' ? 16 : m === 'stone' ? 5 : 6;
    switch (kind) {
      case 'rise': p.x = (r() - 0.5) * 26; p.y = -6 - r() * 44; p.vx = (r() - 0.5) * 8; p.vy = -14 - r() * 18; p.life = 1 + r() * 0.6; break;
      case 'fall': p.x = (r() - 0.5) * 34 + a.head.x * 0.5; p.y = -86 - r() * 10; p.vx = -6; p.vy = 120 + r() * 40; p.life = 0.55; p.rot = 0; break;
      case 'drift': p.x = (r() - 0.5) * 30; p.y = -48 - r() * 12; p.vx = (r() - 0.5) * 20; p.vy = 10 + r() * 10; p.life = 1.6 + r() * 0.6; p.rot = (r() - 0.5) * 4; break;
      case 'swirl': p.x = 0; p.y = -6 - r() * 20; p.vx = r() * TAU; p.vy = 0; p.life = 0.8; break;
      case 'burst': { const ang = r() * TAU, sp = 30 + r() * 40; p.x = Math.cos(ang) * 6; p.y = -26 + Math.sin(ang) * 6; p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp - 20; p.life = 0.7 + r() * 0.3; break; }
      default: p.life = 0.8;
    }
    if (m === 'lantern' && kind === 'drift') { p.vy = -8 - r() * 6; p.life = 2.2; }
    p.s.visible = true;
  }

  private footprint(a: GearAnchors, ph: number): void {
    const p = this.take(true);
    if (!p) return;
    const m = this.printKind!;
    const sideOff = (ph % 2 ? 1 : -1) * 4;
    p.kind = m === 'rain' ? 'ripple' : 'print';
    p.t = 0; p.life = m === 'rain' ? 0.8 : 1.1; p.a = 1;
    p.x = a.wx + sideOff * Math.abs(a.cB) + 0; p.y = a.wy + 3 + sideOff * 0.3 * Math.abs(a.sB);
    const T = tok(), F = fx();
    p.s.texture = m === 'rain' ? F.ring : m === 'stone' ? T.crack : m === 'wind' || m === 'storm' ? F.swirl : m === 'star' ? F.sparkle : m === 'lantern' ? T.petal : m === 'ember' || m === 'flame' || m === 'primal' ? F.flame : m === 'shard' ? T.shard : m === 'feather' ? T.feather : m === 'cog' ? F.smoke : T.print;
    p.s.anchor.set(0.5, m === 'ember' || m === 'flame' || m === 'primal' ? 0.85 : 0.5);
    p.s.tint = m === 'primal' ? PRIMAL_RED : this.color;
    p.size = m === 'wind' || m === 'storm' ? 14 : m === 'stone' ? 16 : 9;
    p.rot = m === 'wind' || m === 'storm' ? 5 : 0;
    p.s.rotation = 0;
    p.vx = 0; p.vy = 0;
    p.s.visible = true;
  }

  private stepParticles(a: GearAnchors, dt: number): void {
    for (const p of this.parts) {
      if (p.t >= p.life) { if (p.s.visible) p.s.visible = false; continue; }
      p.t += dt;
      const u = p.t / p.life;
      let x = p.x, y = p.y, alpha = 1, sc = 1;
      switch (p.kind) {
        case 'rise': p.x += p.vx * dt + Math.sin(p.t * 5 + p.y) * 4 * dt; p.y += p.vy * dt; x = p.x; y = p.y; alpha = Math.sin(u * Math.PI); sc = 1 - u * 0.5; break;
        case 'fall': p.x += p.vx * dt; p.y += p.vy * dt; x = p.x; y = p.y; alpha = u < 0.85 ? 0.8 : (1 - u) / 0.15 * 0.8; break;
        case 'drift': p.x += (p.vx + Math.sin(p.t * 3) * 12) * dt; p.y += p.vy * dt; p.s.rotation += p.rot * dt; x = p.x; y = p.y; alpha = Math.sin(u * Math.PI) * 0.9; break;
        case 'swirl': { const ang = p.vx + p.t * 7, r = 14 + u * 10; x = Math.cos(ang) * r; y = p.y + Math.sin(ang) * r * 0.35 - u * 18; p.s.rotation = ang + Math.PI / 2; alpha = Math.sin(u * Math.PI) * 0.7; break; }
        case 'burst': p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; x = p.x; y = p.y; alpha = 1 - u; sc = 1 - u * 0.4; break;
        case 'print': x = p.x - a.wx; y = p.y - a.wy; alpha = (1 - u) * 0.75; if (p.rot) p.s.rotation += p.rot * dt; break;
        case 'ripple': x = p.x - a.wx; y = p.y - a.wy; alpha = (1 - u) * 0.7; sc = 0.3 + u * 1.4; break;
      }
      p.s.position.set(x, y);
      p.s.alpha = clamp(alpha, 0, 1);
      const sz = p.size * sc;
      if (p.kind === 'ripple') { p.s.width = 18 * sc; p.s.height = 18 * sc * 0.42; }
      else if (p.s.texture === fx().streak) { p.s.width = sz * 1.4; p.s.height = sz * 0.3; }
      else if (p.s.texture === fx().flame) { p.s.height = sz * 1.5; p.s.width = sz; }
      else { p.s.width = p.s.height = sz; }
    }
  }

  destroy(): void {
    if (this.sprites.length) { gearFxStats.heroes--; gearFxStats.sprites -= this.sprites.length; }
    for (const s of this.sprites) s.destroy();
    for (const p of this.parts) p.s.destroy();
    this.sprites = []; this.parts = []; this.orbiters = []; this.bladeFx = []; this.nodes = []; this.haloGlints = [];
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

void mix; void ({} as LookSlot);
