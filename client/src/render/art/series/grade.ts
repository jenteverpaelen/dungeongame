// Grade accents above Legendary (DESIGN-V2 §2.4): small, at the drawing's anchor, never a takeover (ART-DIRECTION §4).
//   Kindled — an ember held in a three-bar iron cage beside the anchor (the only light it adds).
//   Fabled  — the Inscription made visible: a thin ring of glyph ticks turning round the anchor, plus one starlight glint
//             (the sparkle cap of the whole item, rule A6).

import { OUT } from '../draw';
import { disc, float, glowSpot, pole, type K } from './kit';
import { light } from '../util';

export const KINDLED_EMBER = 0xff7a2a;
export const FABLED_STAR = 0xfff1c8;
const CAGE = 0x4a4446;

export function gradeAccent(k: K, grade: 0 | 1 | 2): void {
  if (!grade) return;
  const { x, y, r } = k.anchor;
  if (grade === 1) {
    const cx = x - r - 2.6, cy = y + 0.6;
    disc(k, cx, cy, 2.1, 2.1, 0x5a2a1a, { hi: false });
    glowSpot(k, cx, cy, 1.5, KINDLED_EMBER, true);
    for (const dx of [-1.2, 0, 1.2]) pole(k, [cx + dx, cy - 2.4, cx + dx * 0.8, cy + 2.4], 0.55, CAGE, { flat: true, inner: true });
    pole(k, [cx - 2, cy - 2.3, cx + 2, cy - 2.3], 0.7, CAGE, { flat: true });
    return;
  }
  // Fabled
  float(k, x, y, (kk) => {
    if (kk.pass !== 'paint') return;
    const R = r + 4.2, n = 12;
    kk.c.ellipse(0, 0, R, R * 0.42).stroke({ width: 0.7, color: light(FABLED_STAR, 0.2), alpha: 0.9 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, cx = Math.cos(a) * R, cy = Math.sin(a) * R * 0.42;
      const g = i % 3;
      kk.c.moveTo(cx - 0.6, cy - (g ? 0.9 : 0.5)).lineTo(cx + 0.6, cy + (g === 2 ? -0.9 : 0.5));
      kk.c.stroke({ width: 0.75, color: FABLED_STAR, alpha: 0.95, cap: 'round' });
    }
  }, { bob: 0.4, spin: 0.6, glow: FABLED_STAR, glowR: 5 });
  glowSpot(k, x + r * 0.4, y - r * 0.5, 0.9, FABLED_STAR, true);
  void OUT;
}
