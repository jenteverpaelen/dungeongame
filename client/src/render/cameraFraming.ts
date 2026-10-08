import { SKILLS } from '@shared/data/skills';
import type { GameEvent } from '@shared/protocol';

export const REST_VIEW_HEIGHT = 800;
export const CAMERA_INSETS = { left: .06, right: .06, top: .12, bottom: .23 };
type Region = { x0: number; y0: number; x1: number; y1: number; until: number };

/** Cosmetic framing only: target selection, range, collision and simulation remain authoritative. */
export class SpellFraming {
  private regions: Region[] = [];
  clear(): void { this.regions.length = 0; }

  record(ev: GameEvent, owned: boolean, now: number): void {
    if (!owned || (ev.e !== 'cast' && ev.e !== 'aoe')) return;
    let x: number, y: number, r: number, ms: number;
    if (ev.e === 'cast') {
      const def = SKILLS[ev.sk];
      if (!def || def.kind === 'buff') return;
      x = ev.tx; y = ev.ty;
      r = def.kind === 'summon' ? 56 : Math.max(48, ev.rad ?? 0);
      ms = ev.sk === 'meteor' ? 2600 : Math.max(1000, Math.min(6000, def.duration * 1000));
      if (ev.sk === 'meteor') {
        const scatter = ev.r === 'meteor_shower' ? r * 1.6 : 0;
        const rock = 30 + r * .32;
        this.add({ x0: x - scatter - 250 - rock * 1.6, y0: y - scatter - 560 - rock * 1.8,
          x1: x + scatter + r * 1.4, y1: y + scatter + r * 1.4, until: now + ms });
        return;
      }
    } else {
      x = ev.x; y = ev.y; r = Math.max(32, ev.r);
      ms = Math.min(6500, Math.max(900, ev.d + (ev.delay ?? 0) + 350));
    }
    // Includes the ground ring, motes and initial impact flare, not just the damage radius.
    r = r * 1.4 + 24;
    this.add({ x0: x - r, y0: y - r, x1: x + r, y1: y + r, until: now + ms });
  }

  private add(region: Region): void {
    if (![region.x0, region.y0, region.x1, region.y1, region.until].every(Number.isFinite)) return;
    this.regions.push(region);
    if (this.regions.length > 64) this.regions.shift();
  }

  target(now: number, x: number, y: number, aspect: number) {
    let x0 = x - 70, x1 = x + 70, y0 = y - 90, y1 = y + 32, count = 0;
    // Compact in place; no per-frame region array allocation.
    for (const r of this.regions) {
      if (r.until <= now) continue;
      this.regions[count++] = r;
      x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x1);
      y0 = Math.min(y0, r.y0); y1 = Math.max(y1, r.y1);
    }
    this.regions.length = count;
    if (!count) return { x, y, height: REST_VIEW_HEIGHT, active: false };
    const p = CAMERA_INSETS;
    const height = Math.max(REST_VIEW_HEIGHT, (y1 - y0) / (1 - p.top - p.bottom),
      (x1 - x0) / (Math.max(.25, aspect) * (1 - p.left - p.right)));
    const width = height * aspect;
    const cx = Math.max(x1 - width * (.5 - p.right), Math.min(x0 + width * (.5 - p.left), x));
    const cy = Math.max(y1 - height * (.5 - p.bottom), Math.min(y0 + height * (.5 - p.top), y));
    return { x: cx, y: cy, height, active: true };
  }
}
