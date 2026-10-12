// Act atmosphere (docs/rework/worlds/OPEN.md §7; REFERENCES W12–W14): every act tints its field zones and has its own
// weather. Act I keeps the approved Rillwake daylight; Act II is warm with wind-blown dust and salt; Act III is cold with
// falling snow. Dungeons keep their own dark look in every act. One world-space layer around the camera with a fixed
// sprite count, thinned by Graphics → ambient life and off for reduced motion (low-end rule). All values are [P]
// placeholders judged by eye at 1920×1080.
import { Container, type Sprite } from 'pixi.js';
import { ZONES } from '@shared/data/zones';
import { glowSprite, sparkleSprite } from './art/fx';
import { ambientShare } from '../game/quality';

export type Weather = 'dust' | 'snow';
export interface ActLook { tint: number; weather?: Weather; count: number }
export const ACT_LOOK: Record<1 | 2 | 3, ActLook> = {
  1: { tint: 0xffffff, count: 0 },
  2: { tint: 0xfff1dc, weather: 'dust', count: 90 },
  3: { tint: 0xe0e9f5, weather: 'snow', count: 170 },
};
/** The look of a zone's act, or null (towns, rifts, dungeons and the old fields keep their own). */
export function actLook(zone: string | undefined): ActLook | null {
  const z = zone ? ZONES[zone] : undefined;
  return z?.act && z.kind === 'field' ? ACT_LOOK[z.act] : null;
}

interface Mote { s: Sprite; x: number; y: number; vx: number; vy: number; ph: number }
const PAD_X = 140, PAD_Y = 180;

export class WeatherLayer extends Container {
  private motes: Mote[] = [];
  private share = -1;
  constructor(private kind: Weather, private count: number) { super(); this.eventMode = 'none'; }
  private rebuild(n: number, cx: number, cy: number, halfW: number, halfH: number) {
    for (const m of this.motes) m.s.destroy();
    this.motes = [];
    const w = (halfW + PAD_X) * 2, h = (halfH + PAD_Y) * 2, snow = this.kind === 'snow';
    for (let i = 0; i < n; i++) {
      const r = (k: number) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
      const near = r(1) < 0.25; // a few large, fast near flakes give depth
      const s = snow ? sparkleSprite(0xffffff, near ? 9 : 5, near ? 0.85 : 0.6) : glowSprite(r(2) > 0.5 ? 0xf4e2b8 : 0xe8dcc8, near ? 7 : 4, near ? 0.5 : 0.35);
      if (snow) s.blendMode = 'normal';
      const m: Mote = {
        s, x: cx - halfW - PAD_X + r(3) * w, y: cy - halfH - PAD_Y + r(4) * h, ph: r(5) * 6.28,
        vx: snow ? -12 + r(6) * 24 : 70 + r(6) * 60, vy: snow ? (near ? 95 : 55) + r(7) * 30 : -6 + r(7) * 12,
      };
      s.position.set(m.x, m.y); this.addChild(s); this.motes.push(m);
    }
  }
  update(dt: number, time: number, cx: number, cy: number, halfW: number, halfH: number) {
    const share = ambientShare();
    if (share !== this.share) { this.share = share; this.rebuild(Math.round(this.count * share), cx, cy, halfW, halfH); }
    if (!this.motes.length) return;
    const x0 = cx - halfW - PAD_X, y0 = cy - halfH - PAD_Y, w = (halfW + PAD_X) * 2, h = (halfH + PAD_Y) * 2, sway = this.kind === 'snow' ? 16 : 8;
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(time * 0.8 + m.ph) * sway) * dt; m.y += m.vy * dt;
      // wrap into the box around the camera, so the layer never runs out and never grows
      m.x = x0 + ((((m.x - x0) % w) + w) % w); m.y = y0 + ((((m.y - y0) % h) + h) % h);
      m.s.position.set(m.x, m.y);
    }
  }
}
