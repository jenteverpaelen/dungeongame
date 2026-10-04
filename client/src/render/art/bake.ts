// Part baking: draw vector parts once, pack them into sheet textures and hand out Sprites.
//
// Sheets are rendered with MSAA through the main renderer, read back once and kept as canvas-backed,
// mip-mapped textures. That makes them (a) cheap to draw thousands of times (sprites batch), (b) smooth at
// any zoom (trilinear), and (c) usable from any Pixi renderer (the class-select previews run their own).
// Without a renderer (tests, early calls) parts fall back to live Graphics with the same API.

import { CanvasSource, Container, Graphics, GraphicsContext, Rectangle, Sprite, Texture } from 'pixi.js';
import { paint, type Ctx } from './draw';
import { getRenderer } from './fx';

export type Version = 'n' | 'f' | 'r';

export interface PartSpec {
  name: string;
  draw: (c: Ctx) => void;
  /** Also bake a white silhouette (hit flash). */
  flash?: boolean;
  /** Also bake a dilated white silhouette (elite rim glow). */
  rim?: boolean;
}

interface Baked { tex?: Texture; ctx?: GraphicsContext }

/** What a Puppet needs from a sheet (a whole sheet, or a named slice of a shared atlas). */
export interface SheetLike {
  readonly destroyed: boolean;
  has(name: string): boolean;
  make(name: string, v?: Version): Sprite | Graphics;
  setVersion(obj: Sprite | Graphics, name: string, v: Version): void;
  texture(name: string, v?: Version): Texture | null;
}

/** A prefix view into a shared atlas sheet. */
export class SheetSlice implements SheetLike {
  constructor(readonly base: Sheet, readonly prefix: string) {}
  get destroyed(): boolean { return this.base.destroyed; }
  has(name: string): boolean { return this.base.has(this.prefix + name); }
  make(name: string, v: Version = 'n'): Sprite | Graphics { return this.base.make(this.prefix + name, v); }
  setVersion(obj: Sprite | Graphics, name: string, v: Version): void { this.base.setVersion(obj, this.prefix + name, v); }
  texture(name: string, v: Version = 'n'): Texture | null { return this.base.texture(this.prefix + name, v); }
}

export class Sheet implements SheetLike {
  readonly parts = new Map<string, Partial<Record<Version, Baked>>>();
  readonly sources: CanvasSource[] = [];
  refs = 0;
  destroyed = false;
  /** True when parts are live Graphics (no renderer yet, or a bake still pending). */
  get live(): boolean { return this.sources.length === 0; }

  has(name: string): boolean { return this.parts.has(name); }

  /** A display object for a part version (Sprite on baked sheets, Graphics on the live fallback). */
  make(name: string, v: Version = 'n'): Sprite | Graphics {
    const p = this.parts.get(name)?.[v] ?? this.parts.get(name)?.n;
    if (!p) return new Sprite(Texture.EMPTY);
    if (p.tex) return new Sprite(p.tex);
    return new Graphics(p.ctx!);
  }

  /** Swap a part object between its normal and flash version. */
  setVersion(obj: Sprite | Graphics, name: string, v: Version): void {
    const p = this.parts.get(name)?.[v];
    if (!p) return;
    if (obj instanceof Sprite) {
      if (p.tex && obj.texture !== p.tex) {
        obj.texture = p.tex;
        // parts of different sizes (view-baked heads / legs) carry their own origin
        const da = p.tex.defaultAnchor;
        if (da) obj.anchor.set(da.x, da.y);
      }
    }
    else if (p.ctx) obj.context = p.ctx;
  }

  texture(name: string, v: Version = 'n'): Texture | null {
    return this.parts.get(name)?.[v]?.tex ?? null;
  }

  /** Has this part a baked / live version v? */
  hasVersion(name: string, v: Version): boolean { return !!this.parts.get(name)?.[v]; }

  /** Move another sheet's parts and pages into this one (incremental bakes, one chunk per frame). */
  absorb(other: Sheet): void {
    for (const [k, v] of other.parts) this.parts.set(k, v);
    this.sources.push(...other.sources);
    other.parts.clear();
    other.sources.length = 0;
    other.destroyed = true;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const p of this.parts.values()) for (const b of Object.values(p)) { b?.tex?.destroy(false); b?.ctx?.destroy(); }
    for (const s of this.sources) s.destroy();
    this.parts.clear();
  }
}

interface Item { spec: PartSpec; v: Version; g: Graphics; x: number; y: number; w: number; h: number; bx: number; by: number; page: number }

const PAD = 3;

/** Baked pages, recorded only when the dev gallery sets `globalThis.__artDebug` (keeps them alive otherwise). */
export const bakedPages: { label: string; source: CanvasSource }[] = [];
const debugPages = () => !!(globalThis as { __artDebug?: boolean }).__artDebug;

function build(spec: PartSpec, v: Version): Graphics {
  const ctx = new GraphicsContext();
  const prev = paint.mode;
  paint.mode = v === 'n' ? 0 : v === 'f' ? 1 : 2;
  try { spec.draw(ctx); } finally { paint.mode = prev; }
  return new Graphics(ctx);
}

/**
 * Bake parts into one or more sheet pages.
 * @param res texels per world unit
 * @param maxPage maximum page edge in texels
 */
export function bakeSheet(specs: PartSpec[], res = 3, maxPage = 2048, label = 'sheet', live = false): Sheet {
  // Integer texel density: fractional resolutions make Pixi's extract read back an empty frame on some sizes.
  res = Math.max(1, Math.round(res));
  const sheet = new Sheet();
  const renderer = live ? null : getRenderer();
  const items: Item[] = [];
  for (const spec of specs) {
    const versions: Version[] = ['n'];
    if (spec.flash) versions.push('f');
    if (spec.rim) versions.push('r');
    for (const v of versions) {
      const g = build(spec, v);
      const b = g.getLocalBounds();
      const bw = Math.max(1, b.maxX - b.minX), bh = Math.max(1, b.maxY - b.minY);
      items.push({ spec, v, g, x: 0, y: 0, w: Math.ceil(bw + PAD * 2), h: Math.ceil(bh + PAD * 2), bx: b.minX, by: b.minY, page: 0 });
    }
  }

  if (!renderer) {
    for (const it of items) {
      const entry = sheet.parts.get(it.spec.name) ?? {};
      entry[it.v] = { ctx: it.g.context };
      sheet.parts.set(it.spec.name, entry);
    }
    return sheet;
  }

  // Shelf packing (tallest first) into pages of at most maxPage texels.
  const maxW = Math.floor(maxPage / res);
  const order = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  const area = order.reduce((s, it) => s + it.w * it.h, 0);
  const pageW = Math.min(maxW, Math.max(Math.ceil(Math.sqrt(area) * 1.12), ...order.map((it) => it.w)));
  const pages: { w: number; h: number }[] = [];
  let page = 0, cx = 0, cy = 0, shelf = 0;
  for (const it of order) {
    if (cx + it.w > pageW) { cx = 0; cy += shelf; shelf = 0; }
    if (cy + it.h > maxW) { pages[page] = { w: pageW, h: cy }; page++; cx = 0; cy = 0; shelf = 0; }
    it.x = cx; it.y = cy; it.page = page;
    cx += it.w; shelf = Math.max(shelf, it.h);
    pages[page] = { w: pageW, h: cy + shelf };
  }

  for (let p = 0; p < pages.length; p++) {
    const pg = pages[p];
    const holder = new Container();
    const onPage = items.filter((it) => it.page === p);
    for (const it of onPage) {
      it.g.position.set(it.x + PAD - it.bx, it.y + PAD - it.by);
      holder.addChild(it.g);
    }
    const W = Math.max(1, Math.ceil(pg.w)), H = Math.max(1, Math.ceil(pg.h));
    const canvas = renderer.extract.canvas({ target: holder, frame: new Rectangle(0, 0, W, H), resolution: res, antialias: true, clearColor: [0, 0, 0, 0] }) as HTMLCanvasElement;
    const source = new CanvasSource({ resource: canvas, resolution: res, autoGenerateMipmaps: true, scaleMode: 'linear', label: `${label}#${p}` });
    sheet.sources.push(source);
    if (debugPages()) bakedPages.push({ label: `${label}#${p}`, source });
    for (const it of onPage) {
      const frame = new Rectangle(it.x, it.y, it.w, it.h);
      const ax = (PAD - it.bx) / it.w, ay = (PAD - it.by) / it.h;
      const tex = new Texture({ source, frame, defaultAnchor: { x: ax, y: ay } });
      const entry = sheet.parts.get(it.spec.name) ?? {};
      entry[it.v] = { tex };
      sheet.parts.set(it.spec.name, entry);
    }
    holder.destroy({ children: true });
  }
  return sheet;
}

/** Bake a single drawing into a standalone texture (anchor at the drawing origin). */
export function bakeOne(draw: (c: Ctx) => void, res = 2): Texture | null {
  const s = bakeSheet([{ name: 'x', draw }], res, 4096, 'one');
  return s.texture('x');
}
