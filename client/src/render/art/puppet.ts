// A light-weight cut-out puppet: a hierarchy of transform nodes, each showing one baked part.
// Shared by players, monsters, summons and NPCs. Handles hit flash (white silhouette textures), elite rim
// glow (parallel tree of dilated silhouettes behind the body), tints, and the shadow.

import { Container, Graphics, Sprite } from 'pixi.js';
import type { Sheet, Version } from './bake';
import { shadowSprite } from './fx';

export class PNode {
  readonly c = new Container();
  obj: Sprite | Graphics | null = null;
  rimC: Container | null = null;
  rimObj: Sprite | Graphics | null = null;
  readonly kids: PNode[] = [];
  constructor(readonly part: string | null, readonly parent: PNode | null) {}

  get x() { return this.c.x; } set x(v: number) { this.c.x = v; }
  get y() { return this.c.y; } set y(v: number) { this.c.y = v; }
  get rot() { return this.c.rotation; } set rot(v: number) { this.c.rotation = v; }
  set(x: number, y: number, rot = 0): this { this.c.position.set(x, y); this.c.rotation = rot; return this; }
  scale(sx: number, sy = sx): this { this.c.scale.set(sx, sy); return this; }
  show(v: boolean): this { this.c.visible = v; return this; }
}

export class Puppet {
  readonly root = new Container();
  readonly under = new Container();
  readonly body = new Container();
  readonly over = new Container();
  readonly shadow: Sprite;
  private rimRoot: Container | null = null;
  private nodes: PNode[] = [];
  private flashing = false;
  private flashUntil = 0;
  facing = 1;

  constructor(readonly sheet: Sheet, shadowW: number, shadowAlpha = 0.85) {
    this.shadow = shadowSprite(shadowW, shadowAlpha);
    this.root.addChild(this.shadow, this.under, this.body, this.over);
  }

  /** Add a node showing `part` (or an empty transform node when part is null). */
  add(part: string | null, parent: PNode | null = null, x = 0, y = 0): PNode {
    const n = new PNode(part, parent);
    n.c.position.set(x, y);
    if (part && this.sheet.has(part)) {
      n.obj = this.sheet.make(part, 'n');
      n.c.addChild(n.obj);
    }
    (parent ? parent.c : this.body).addChild(n.c);
    parent?.kids.push(n);
    this.nodes.push(n);
    return n;
  }

  /** Attach an arbitrary display object (sprites, fx) to a node or the body. */
  attach(obj: Container, parent: PNode | null = null): Container {
    (parent ? parent.c : this.body).addChild(obj);
    return obj;
  }

  /** Re-order a node to draw last among its siblings. */
  toFront(n: PNode): void {
    const p = n.c.parent;
    if (p) p.setChildIndex(n.c, p.children.length - 1);
  }

  // ───────────── flash ─────────────

  flash(now: number, ms: number): void {
    this.flashUntil = Math.max(this.flashUntil, now + ms);
    if (!this.flashing) this.setVersion('f');
  }

  private setVersion(v: Version): void {
    this.flashing = v === 'f';
    for (const n of this.nodes) if (n.obj && n.part) this.sheet.setVersion(n.obj, n.part, v);
  }

  // ───────────── rim glow ─────────────

  /** Elite rim: a dilated silhouette of the whole puppet behind it. color 0 removes it. */
  setRim(color: number, alpha: number): void {
    if (!color) { if (this.rimRoot) { this.rimRoot.destroy({ children: true }); this.rimRoot = null; for (const n of this.nodes) { n.rimC = null; n.rimObj = null; } } return; }
    if (!this.rimRoot) {
      this.rimRoot = new Container();
      this.root.addChildAt(this.rimRoot, this.root.getChildIndex(this.body));
      for (const n of this.nodes) {
        n.rimC = new Container();
        if (n.part && this.sheet.has(n.part)) { n.rimObj = this.sheet.make(n.part, 'r'); n.rimC.addChild(n.rimObj); }
        (n.parent?.rimC ?? this.rimRoot).addChild(n.rimC);
      }
    }
    this.rimRoot.tint = color;
    this.rimRoot.alpha = alpha;
  }

  get rimAlpha(): number { return this.rimRoot?.alpha ?? 0; }
  set rimAlpha(a: number) { if (this.rimRoot) this.rimRoot.alpha = a; }

  /** Call once per frame after posing. */
  sync(now: number): void {
    if (this.flashing && now >= this.flashUntil) this.setVersion('n');
    const r = this.rimRoot;
    if (!r) return;
    const b = this.body;
    r.position.copyFrom(b.position); r.scale.copyFrom(b.scale); r.rotation = b.rotation; r.skew.copyFrom(b.skew); r.pivot.copyFrom(b.pivot);
    r.visible = b.visible && b.alpha > 0.05;
    for (const n of this.nodes) {
      const m = n.rimC!, c = n.c;
      m.position.copyFrom(c.position); m.scale.copyFrom(c.scale); m.rotation = c.rotation; m.skew.copyFrom(c.skew); m.pivot.copyFrom(c.pivot);
      m.visible = c.visible;
      if (n.rimObj && n.obj) { n.rimObj.position.copyFrom(n.obj.position); n.rimObj.scale.copyFrom(n.obj.scale); n.rimObj.rotation = n.obj.rotation; n.rimObj.visible = n.obj.visible; }
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
