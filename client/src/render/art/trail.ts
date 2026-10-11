// Weapon trail ribbon: a strip spanning the blade (base → tip) sampled along the weapon's real path.
// One small batched mesh (≤ 100 vertices, so Pixi packs it into the sprite batch); per frame only the
// vertex positions + uvs are rewritten, no geometry is rebuilt. Per-sample alpha is encoded in u
// (the texture fades along x), the blade profile in v (soft near the hilt, bright crescent edge at the tip).

import { CanvasSource, Mesh, MeshGeometry, Texture } from 'pixi.js';

let tex: Texture | null = null;

function ribbonTexture(): Texture {
  if (tex) return tex;
  const W = 64, H = 32;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);                 // 0 = hilt side, 1 = tip edge
    const body = Math.pow(v, 1.25) * 0.9;  // fill grows towards the tip
    const edge = Math.exp(-Math.pow((v - 0.9) / 0.09, 2)); // bright crescent rim just inside the tip
    const prof = Math.min(1, body + edge) * (v > 0.985 ? 0.5 : 1);
    const white = Math.min(1, 0.55 + edge * 0.6);
    for (let x = 0; x < W; x++) {
      const a = Math.max(0, 1 - x / (W - 1));
      const i = (y * W + x) * 4;
      const c = Math.round(255 * white);
      img.data[i] = 255; img.data[i + 1] = c; img.data[i + 2] = c;
      img.data[i + 3] = Math.round(255 * prof * a);
    }
  }
  // pure white body (tint colours it); the slight warm cast above is replaced by tint anyway
  for (let i = 0; i < img.data.length; i += 4) { img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; }
  ctx.putImageData(img, 0, 0);
  tex = new Texture({ source: new CanvasSource({ resource: cv, scaleMode: 'linear' }) });
  return tex;
}

export class Ribbon {
  readonly mesh: Mesh;
  private pos: Float32Array;
  private uv: Float32Array;
  private geom: MeshGeometry;
  private used = 0;

  /** `texture`: a custom strip (gear movement trails use a band that is soft on both edges). */
  constructor(readonly n = 24, texture?: Texture) {
    this.pos = new Float32Array(n * 4);
    this.uv = new Float32Array(n * 4);
    const idx = new Uint32Array((n - 1) * 6);
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.set([a, b, c, b, d, c], i * 6);
    }
    for (let i = 0; i < n; i++) { this.uv[i * 4] = 1; this.uv[i * 4 + 1] = 0; this.uv[i * 4 + 2] = 1; this.uv[i * 4 + 3] = 1; }
    this.geom = new MeshGeometry({ positions: this.pos, uvs: this.uv, indices: idx });
    this.mesh = new Mesh({ geometry: this.geom, texture: texture ?? ribbonTexture() });
    this.mesh.visible = false;
  }

  /** Start writing a new frame of samples (newest first). */
  begin(): void { this.used = 0; }

  /** Add a sample: blade base (bx, by) and tip (tx, ty), alpha 0..1. */
  push(bx: number, by: number, tx: number, ty: number, a: number): void {
    if (this.used >= this.n) return;
    const i = this.used++;
    const p = this.pos, u = this.uv;
    p[i * 4] = bx; p[i * 4 + 1] = by; p[i * 4 + 2] = tx; p[i * 4 + 3] = ty;
    const uu = 1 - Math.max(0, Math.min(1, a));
    u[i * 4] = uu; u[i * 4 + 1] = 0; u[i * 4 + 2] = uu; u[i * 4 + 3] = 1;
  }

  /** Upload; collapses unused samples onto the last one. Hides the mesh when nothing is visible. */
  end(): void {
    const n = this.used;
    if (n < 2) { this.mesh.visible = false; return; }
    const p = this.pos, u = this.uv;
    for (let i = n; i < this.n; i++) {
      p[i * 4] = p[(n - 1) * 4]; p[i * 4 + 1] = p[(n - 1) * 4 + 1]; p[i * 4 + 2] = p[(n - 1) * 4 + 2]; p[i * 4 + 3] = p[(n - 1) * 4 + 3];
      u[i * 4] = 1; u[i * 4 + 2] = 1;
    }
    this.mesh.visible = true;
    this.geom.getBuffer('aPosition').update();
    this.geom.getBuffer('aUV').update();
  }

  hide(): void { this.mesh.visible = false; }

  destroy(): void { this.mesh.destroy(); }
}
