// Ground loot views: the D3 loot fountain (items arc out of the corpse and bounce), rarity labels on a
// dark backdrop (constant screen size, de-overlapped), legendary / set light beams with the chime,
// coin piles that glint, gems, pulsing health globes, and a fly-to-player tween on pickup.

import { BitmapText, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { GEMS } from '@shared/data/items';
import { RARITY_COLORS } from '@shared/items';
import type { EntDesc, LootView } from '@shared/protocol';
import type { EntityView, ViewState } from '../types';
import { itemIconTexture } from '../art';
import type { VfxCore } from './core';
import { LABEL_FONT, ensureFonts } from './fonts';
import { TAU, clamp, cssToInt, easeOut, hash01, lerpColor, rand } from './util';

const SHAPE_ICON: Record<string, string> = {
  sword: 'sword', sword2h: 'sword', axe: 'axe', axe2h: 'axe', mace: 'mace', bow: 'bow', crossbow: 'crossbow',
  handxbow: 'crossbow', staff: 'staff', wand: 'wand', shield: 'shield', quiver: 'quiver', orb: 'orb',
};
const KIND_ICON: Record<string, string> = {
  head: 'head', shoulders: 'shoulders', chest: 'chest', hands: 'hands', wrists: 'wrists', waist: 'waist', legs: 'legs',
  feet: 'feet', weapon1h: 'sword', weapon2h: 'axe', offhand: 'shield', neck: 'neck', ring: 'ring',
};

interface BeamStyle { outer: number; core: number; width: number; height: number; glow: number }

function beamStyle(l: LootView): BeamStyle | null {
  if (l.lk !== 'item') return null;
  if (l.rarity === 'legendary') {
    if (l.ancient === 2) return { outer: 0xff4630, core: 0xffd890, width: 70, height: 520, glow: 0xff5a30 };
    if (l.ancient === 1) return { outer: 0xff8a2a, core: 0xffe6a0, width: 66, height: 500, glow: 0xff9a40 };
    return { outer: 0xd8702f, core: 0xffd27a, width: 54, height: 450, glow: 0xe07a30 };
  }
  if (l.rarity === 'set') {
    if (l.ancient) return { outer: 0x3cff5a, core: 0xd8ffd8, width: 66, height: 500, glow: 0x40ff60 };
    return { outer: 0x2fd84a, core: 0xbaffc0, width: 54, height: 450, glow: 0x30e050 };
  }
  return null;
}

export function labelColor(l: LootView): number {
  switch (l.lk) {
    case 'item': {
      const c = cssToInt(RARITY_COLORS[l.rarity ?? 'normal']);
      return l.rarity === 'legendary' ? lerpColor(c, 0xffffff, 0.18) : l.rarity === 'magic' ? lerpColor(c, 0xffffff, 0.2) : c;
    }
    case 'gem': return 0xffffff;
    case 'mat': return 0x9fe8ff;
    default: return 0xffd65a;
  }
}

export class LootManager {
  readonly labelLayer = new Container({ label: 'vfx-loot-labels' });
  private views = new Set<LootItemView>();
  /** loot id → id of the player who picked it up (from `pickup` events). */
  readonly pickups = new Map<number, number>();
  private flyers = new Set<{ spr: Sprite; t: number; x0: number; y0: number; to: number }>();

  constructor(private V: VfxCore, textLayer: Container) {
    textLayer.addChildAt(this.labelLayer, 0);
  }

  create(desc: EntDesc): EntityView {
    const v = new LootItemView(this.V, this, desc);
    this.views.add(v);
    return v;
  }

  remove(v: LootItemView): void {
    this.views.delete(v);
  }

  /** Fly a sprite from its world position into the picking player. */
  fly(spr: Sprite, x: number, y: number, to: number): void {
    this.V.layers.aboveFx.addChild(spr);
    spr.position.set(x, y);
    this.flyers.add({ spr, t: 0, x0: x, y0: y, to });
  }

  update(dt: number): void {
    const V = this.V;
    for (const f of this.flyers) {
      f.t += dt / 0.26;
      const p = V.ctx.entityPos(f.to);
      const tx = p ? p.x : f.x0, ty = p ? p.y - 30 : f.y0 - 40;
      const e = easeOut(Math.min(1, f.t));
      const arc = Math.sin(Math.min(1, f.t) * Math.PI) * 26;
      f.spr.position.set(f.x0 + (tx - f.x0) * e, f.y0 + (ty - f.y0) * e - arc);
      f.spr.scale.set(f.spr.scale.x * (1 - dt * 2.2));
      f.spr.alpha = 1 - Math.max(0, f.t - 0.7) / 0.3;
      if (f.t >= 1) {
        V.sys.glint(tx, ty + 30, 30, 22, 0xfff2c0, 0.25);
        f.spr.destroy();
        this.flyers.delete(f);
      }
    }
    this.layoutLabels();
  }

  /** Keep labels readable: stack overlapping labels upwards (D3 style). */
  private layoutLabels(): void {
    const z = this.V.ctx.zoom() || 1;
    const list: LootItemView[] = [];
    for (const v of this.views) {
      const on = v.labelReady();
      v.label.visible = on;
      if (on) list.push(v);
    }
    list.sort((a, b) => b.root.y - a.root.y);
    const placed: number[] = [];
    for (const v of list) {
      const w = v.labelW / z, h = (v.labelH + 2) / z;
      const x = v.root.x - w / 2;
      let y = v.root.y - v.labelLift - h;
      for (let it = 0; it < 10; it++) {
        let hit = false;
        for (let i = 0; i < placed.length; i += 4) {
          if (x < placed[i] + placed[i + 2] && x + w > placed[i] && y < placed[i + 1] + placed[i + 3] && y + h > placed[i + 1]) {
            y = placed[i + 1] - h;
            hit = true;
          }
        }
        if (!hit) break;
      }
      placed.push(x, y, w, h);
      v.label.position.set(v.root.x, y + h);
      v.label.scale.set(1 / z);
    }
  }

  clear(): void {
    for (const f of this.flyers) f.spr.destroy();
    this.flyers.clear();
    this.pickups.clear();
  }
}

type Phase = 'wait' | 'fly' | 'rest';

class LootItemView implements EntityView {
  readonly root = new Container({ label: 'loot' });
  readonly height = 14;
  readonly label = new Container();
  labelW = 0;
  labelH = 0;
  /** World units between the item's feet and the bottom of its label. */
  labelLift = 26;
  private body = new Container();
  private shadow: Sprite;
  private art: Sprite[] = [];
  private beam: Container | null = null;
  private beamParts: Sprite[] = [];
  private glow: Sprite | null = null;
  private phase: Phase = 'wait';
  private started = false;
  private t = 0;
  private delay = 0;
  private ox = 0;
  private oy = 0;
  private H = 50;
  private tilt = 0;
  private time = 0;
  private nextGlint = rand(0.5, 1.5);
  private nextMote = 0;
  private x = 0;
  private y = 0;
  private hasLabel: boolean;
  private beamStyle: BeamStyle | null;
  private labelAlpha = 0;
  private landed = false;

  constructor(private V: VfxCore, private M: LootManager, private desc: EntDesc) {
    const T = V.T;
    const l: LootView = desc.loot ?? { lk: 'item', name: 'Item' };
    this.shadow = new Sprite(T.shadow);
    this.shadow.anchor.set(0.5);
    this.shadow.tint = 0x000000;
    this.root.addChild(this.shadow, this.body);
    this.beamStyle = beamStyle(l);
    this.hasLabel = l.lk === 'item' || l.lk === 'gem' || l.lk === 'mat';
    const seed = hash01(desc.id);
    this.tilt = (seed - 0.5) * 0.8;

    switch (l.lk) {
      case 'gold': {
        const n = clamp(Math.round(1 + Math.log10((l.amount ?? 1) + 1) * 1.3), 1, 7);
        for (let i = 0; i < n; i++) {
          const c = new Sprite(T.coin);
          c.anchor.set(0.5);
          const a = hash01(desc.id * 7 + i) * TAU, d = i === 0 ? 0 : 4 + hash01(desc.id * 13 + i) * 7;
          c.position.set(Math.cos(a) * d, -5 + Math.sin(a) * d * 0.5 - (i > 3 ? 4 : 0));
          c.scale.set((13 + hash01(desc.id + i) * 3) / 28);
          c.scale.y *= 0.82;
          this.art.push(c);
        }
        this.art.sort((a, b) => a.y - b.y);
        this.shadowW = 26;
        break;
      }
      case 'gem': {
        const gid = (l.gem ?? 'ruby').split(':')[0];
        const g = new Sprite(T.gem);
        g.anchor.set(0.5, 0.8);
        g.scale.set(20 / 36);
        g.tint = GEMS[gid]?.color ?? 0xe0115f;
        this.art.push(g);
        this.shadowW = 18;
        this.addGlow(g.tint as number, 34, 0.35);
        break;
      }
      case 'globe': {
        const g = new Sprite(T.globe);
        g.anchor.set(0.5, 0.75);
        g.scale.set(28 / 48);
        this.art.push(g);
        this.shadowW = 20;
        this.addGlow(0xff3a2a, 44, 0.4);
        break;
      }
      case 'mat': {
        const g = new Sprite(T.wisp);
        g.anchor.set(0.5, 0.8);
        g.scale.set(20 / 24);
        g.tint = 0x9fe8ff;
        this.art.push(g);
        this.shadowW = 16;
        this.addGlow(0x7fd8ff, 40, 0.45);
        break;
      }
      default: {
        let tex: Texture | null = null;
        if (l.look && l.kind) {
          try { tex = itemIconTexture(l.look, l.kind); } catch { tex = null; }
        }
        const icon = new Sprite(tex ?? T.icons[SHAPE_ICON[l.look?.shape ?? ''] ?? KIND_ICON[l.kind ?? ''] ?? 'chest'] ?? T.icons.chest);
        icon.anchor.set(0.5, 0.7);
        const size = 30;
        icon.scale.set(size / Math.max(icon.texture.orig.width, icon.texture.orig.height));
        if (!tex) icon.tint = l.look ? lerpColor(l.look.primary, 0xffffff, 0.25) : 0xd8cfc0;
        this.art.push(icon);
        this.shadowW = 28;
        const r = l.rarity ?? 'normal';
        if (r === 'rare') this.addGlow(0xffe040, 46, 0.22);
        else if (r === 'magic') this.addGlow(0x6969ff, 42, 0.2);
        if (this.beamStyle) this.addGlow(this.beamStyle.glow, 70, 0.55);
      }
    }
    for (const a of this.art) this.body.addChild(a);
    if (this.hasLabel) this.buildLabel(l);
    M.labelLayer.addChild(this.label);
    this.label.visible = false;
    this.root.visible = true;
  }

  private shadowW = 24;

  private addGlow(color: number, w: number, a: number): void {
    const g = new Sprite(this.V.T.glow);
    g.anchor.set(0.5);
    g.blendMode = 'add';
    g.tint = color;
    g.alpha = a;
    g.scale.set(w / 128, (w * 0.55) / 128);
    this.glow = g;
    this.root.addChildAt(g, 1);
  }

  private buildLabel(l: LootView): void {
    ensureFonts();
    const col = labelColor(l);
    const txt = new BitmapText({ text: l.name, style: { fontFamily: LABEL_FONT, fontSize: 13 } });
    txt.tint = col;
    const padX = 7, padY = 3;
    const w = Math.ceil(txt.width + padX * 2), h = Math.ceil(txt.height + padY * 2) - 2;
    const special = l.rarity === 'legendary' || l.rarity === 'set';
    const border = l.ancient === 2 ? 0xff3a2a : l.ancient === 1 ? 0xff9a30 : special ? lerpColor(col, 0x000000, 0.25) : lerpColor(col, 0x000000, 0.55);
    const bg = new Graphics()
      .roundRect(-w / 2, -h, w, h, 3).fill({ color: 0x0b0806, alpha: 0.82 })
      .roundRect(-w / 2, -h, w, h, 3).stroke({ width: special || l.ancient ? 1.5 : 1, color: border, alpha: special ? 0.95 : 0.6 });
    txt.position.set(-txt.width / 2, -h + padY - 2.5);
    this.label.addChild(bg, txt);
    this.labelW = w;
    this.labelH = h;
  }

  /** True when the label should be shown this frame (item landed and on screen). */
  labelReady(): boolean {
    return this.hasLabel && this.landed && this.root.visible && !!this.root.parent && this.labelAlpha > 0;
  }

  private start(x: number, y: number): void {
    this.started = true;
    const V = this.V;
    const death = V.zoneAge > 1 ? V.deathNear(x, y, 130) : null;
    const l = this.desc.loot;
    if (death) {
      this.ox = death.x - x;
      this.oy = death.y - y;
      this.delay = Math.min(0.5, death.n * 0.045);
      death.n++;
      this.H = 40 + rand(0, 20) + Math.hypot(this.ox, this.oy) * 0.12;
      this.phase = 'wait';
    } else if (V.zoneAge > 1) {
      this.ox = 0; this.oy = 0; this.delay = 0; this.H = 34;
      this.phase = 'wait';
    } else {
      this.phase = 'rest';
      this.land(false);
    }
    if (this.phase === 'wait' && l?.lk === 'item' && (l.rarity === 'legendary' || l.rarity === 'set')) {
      V.after(this.delay, () => V.sound(l.rarity === 'set' ? 'set' : 'legendary'));
    }
  }

  private land(fx: boolean): void {
    this.landed = true;
    this.phase = 'rest';
    const l = this.desc.loot;
    if (this.beamStyle) this.buildBeam(fx);
    if (!fx) { this.labelAlpha = 1; return; }
    const V = this.V;
    if (l?.lk === 'gold') V.sound('gold', this.x, this.y, 0.35);
    else if (l?.lk === 'item' && (l.rarity === 'rare' || l.rarity === 'legendary' || l.rarity === 'set')) V.sound('drop', this.x, this.y, 0.8);
    V.sys.dust(this.x, this.y, 10, 26, 0xc9b597, 0.4, 0.3);
  }

  private buildBeam(burst: boolean): void {
    const st = this.beamStyle!;
    const T = this.V.T;
    const beam = new Container();
    const mk = (tex: Texture, w: number, h: number, color: number, alpha: number) => {
      const s = new Sprite(tex);
      s.anchor.set(0.5, 1);
      s.blendMode = 'add';
      s.tint = color;
      s.alpha = alpha;
      s.scale.set(w / tex.orig.width, h / tex.orig.height);
      beam.addChild(s);
      this.beamParts.push(s);
      return s;
    };
    mk(T.beam, st.width * 1.9, st.height * 0.75, st.outer, 0.35);
    mk(T.beam, st.width, st.height, st.outer, 0.95);
    mk(T.beamCore, st.width * 0.32, st.height * 0.92, st.core, 1);
    beam.position.set(0, 2);
    this.beam = beam;
    this.root.addChildAt(beam, 1);
    if (burst) {
      const s = this.V.sys;
      s.flash(this.x, this.y, 20, 140, st.core, 0.22, 1);
      s.ring(s.gAdd, T.ringThick, this.x, this.y, 8, 80, st.outer, 0.6, 1);
      for (let i = 0; i < 18; i++) s.spark(this.x, this.y, 12, rand(0, TAU), rand(160, 320), 14, i % 2 ? st.core : st.outer, 0.45, 300);
      this.beam.scale.y = 0.05;
    }
  }

  update(dt: number, s: ViewState): void {
    this.x = s.x;
    this.y = s.y;
    if (!this.started) this.start(s.x, s.y);
    const rdt = dt > 0 ? dt : 0;
    this.time += rdt;
    let z = 0, ox = 0, oy = 0, rot = this.tilt;
    if (this.phase === 'wait') {
      this.t += rdt;
      this.body.visible = false;
      this.shadow.visible = false;
      if (this.glow) this.glow.visible = false;
      if (this.t >= this.delay) { this.phase = 'fly'; this.t = 0; this.body.visible = true; this.shadow.visible = true; }
    }
    if (this.phase === 'fly') {
      this.t += rdt;
      const FLY = 0.45, BOUNCE = 0.15;
      if (this.t < FLY) {
        const u = this.t / FLY;
        ox = this.ox * (1 - u); oy = this.oy * (1 - u);
        z = 4 * this.H * u * (1 - u);
        rot = this.tilt + (1 - u) * TAU * 1.5 * (this.ox >= 0 ? -1 : 1);
      } else if (this.t < FLY + BOUNCE) {
        const u = (this.t - FLY) / BOUNCE;
        z = 4 * 7 * u * (1 - u);
        if (!this.landed) this.land(true);
      } else {
        if (!this.landed) this.land(true);
        this.phase = 'rest';
      }
    }
    const l = this.desc.loot;
    if (l?.lk === 'globe' || l?.lk === 'mat') z += 3 + Math.sin(this.time * 3 + this.desc.id) * 2.5;
    this.body.position.set(ox, oy - z);
    this.body.rotation = l?.lk === 'item' ? rot : 0;
    const sk = 1 - clamp(z / 120, 0, 0.5);
    this.shadow.position.set(ox, oy);
    this.shadow.scale.set((this.shadowW * sk) / 64, (this.shadowW * 0.5 * sk) / 32);
    this.shadow.alpha = 0.3 * sk;
    if (this.glow) {
      this.glow.visible = this.phase !== 'wait';
      this.glow.position.set(ox, oy);
      if (l?.lk === 'globe') this.glow.alpha = 0.3 + 0.2 * Math.sin(this.time * 4);
    }
    if (l?.lk === 'globe') { const p = 1 + 0.06 * Math.sin(this.time * 4); this.art[0].scale.set((28 / 48) * p); }
    if (this.landed && this.hasLabel) {
      this.labelAlpha = Math.min(1, this.labelAlpha + rdt * 6);
      this.label.alpha = this.labelAlpha;
    }
    // Beam: grow in, then breathe; motes drift up the column.
    if (this.beam) {
      if (this.beam.scale.y < 1) this.beam.scale.y = Math.min(1, this.beam.scale.y + rdt * 5);
      const pulse = 0.82 + 0.18 * Math.sin(this.time * 2.2 + this.desc.id);
      this.beamParts[1].alpha = 0.95 * pulse;
      this.beamParts[2].alpha = 0.75 + 0.25 * pulse;
      this.nextMote -= rdt;
      if (this.nextMote <= 0 && this.root.visible) {
        this.nextMote = 0.14 / Math.max(0.3, this.V.sys.budget);
        const st = this.beamStyle!;
        const p = this.V.sys.aAdd.add(this.V.T.dot, this.x + rand(-st.width * 0.25, st.width * 0.25), this.y + 1, rand(1.2, 2));
        p.z = rand(0, 40); p.vz = rand(60, 120); p.w0 = rand(4, 7); p.w1 = 1; p.fi = 0.1; p.fo = 0.6; p.flick = 0.3;
        p.tintFade(st.core, st.outer);
      }
    }
    // Occasional glint on coins / gems / rare+ items.
    this.nextGlint -= rdt;
    if (this.nextGlint <= 0 && this.landed && this.root.visible) {
      this.nextGlint = rand(1.2, 2.6);
      const sparkly = l?.lk === 'gold' || l?.lk === 'gem' || (l?.lk === 'item' && l.rarity !== 'normal' && l.rarity !== 'magic');
      if (sparkly) this.V.sys.glint(this.x + rand(-8, 8), this.y + 2, rand(4, 12), rand(12, 18), 0xfff6d0, 0.35);
    }
  }

  hit(): void { /* loot doesn't react to hits */ }

  die(_el: number, done: () => void): void { done(); }

  destroy(): void {
    const V = this.V;
    this.M.remove(this);
    const to = this.M.pickups.get(this.desc.id);
    this.M.pickups.delete(this.desc.id);
    const me = V.ctx.myId();
    const mp = V.ctx.entityPos(me);
    const near = mp && Math.hypot(mp.x - this.x, mp.y - this.y) < 180;
    if ((to !== undefined || near) && this.art.length && this.landed) {
      // Fly a copy of the main sprite into the player.
      const src = this.art[0];
      const spr = new Sprite(src.texture);
      spr.anchor.copyFrom(src.anchor);
      spr.tint = src.tint;
      spr.scale.copyFrom(src.scale);
      this.M.fly(spr, this.x, this.y - 6, to ?? me);
    }
    this.label.destroy({ children: true });
    this.root.destroy({ children: true });
  }
}
