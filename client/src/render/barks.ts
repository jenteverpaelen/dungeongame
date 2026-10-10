// Speech bubbles for townsfolk lines (shared/src/data/barks.ts): services speak when used, ambient people now and then
// when the hero is close. One bubble per speaker, a cooldown per speaker, at most two ambient bubbles on screen.
import { Container, Graphics, Text } from 'pixi.js';

export interface Speaker { key: string; x: number; y: number; height: number; lines: readonly string[] }
interface Live { c: Container; sp: Speaker; born: number; until: number }

const AMBIENT_COOLDOWN = 32000, AMBIENT_EVERY = 6500, NEAR = 620;

export class BarkBubbles {
  readonly root = new Container();
  private live: Live[] = [];
  private last = new Map<string, number>();
  private nextAmbient = performance.now() + 4000;

  /** A service line on interaction (force) or an ambient remark. Returns false when on cooldown. */
  say(sp: Speaker, now: number, force = false): boolean {
    const prev = this.last.get(sp.key) ?? -1e9;
    if (now - prev < (force ? 1800 : AMBIENT_COOLDOWN) || !sp.lines.length) return false;
    this.last.set(sp.key, now);
    for (const l of this.live.filter((l) => l.sp.key === sp.key)) this.drop(l);
    const text = sp.lines[Math.floor(Math.random() * sp.lines.length)];
    const c = new Container();
    const t = new Text({ text, style: { fontFamily: 'Alegreya Sans, sans-serif', fontWeight: '500', fontSize: 13, fill: 0x2a1d12, wordWrap: true, wordWrapWidth: 190, lineHeight: 15.5 }, resolution: 2 });
    t.anchor.set(0.5, 1);
    const w = Math.max(60, t.width + 18), h = t.height + 11;
    const g = new Graphics()
      .roundRect(-w / 2, -h - 7, w, h, 7).fill({ color: 0xf6ecd4 }).stroke({ color: 0x2a1d12, width: 2 })
      .poly([-6, -8.5, 6, -8.5, 0, 0]).fill({ color: 0xf6ecd4 })
      .moveTo(-6, -7.2).lineTo(0, 0).lineTo(6, -7.2).stroke({ color: 0x2a1d12, width: 2 });
    t.y = -12.5;
    c.addChild(g, t);
    c.alpha = 0;
    this.root.addChild(c);
    this.live.push({ c, sp, born: now, until: now + 2600 + text.length * 32 });
    return true;
  }

  update(now: number, me: { x: number; y: number } | null, speakers: readonly Speaker[]): void {
    if (me && now >= this.nextAmbient) {
      this.nextAmbient = now + AMBIENT_EVERY * (0.7 + Math.random() * 0.6);
      if (this.live.length < 2) {
        const near = speakers.filter((s) => Math.hypot(s.x - me.x, s.y - me.y) < NEAR && now - (this.last.get(s.key) ?? -1e9) > AMBIENT_COOLDOWN);
        if (near.length) this.say(near[Math.floor(Math.random() * near.length)], now);
      }
    }
    for (const l of [...this.live]) {
      const age = now - l.born, left = l.until - now;
      l.c.alpha = Math.min(1, age / 160, Math.max(0, left / 260));
      // Clear of a two-line name plate (name + role line sit just above the head).
      l.c.position.set(l.sp.x, l.sp.y - l.sp.height - 44 - Math.min(1, age / 200) * 4);
      if (left <= 0) this.drop(l);
    }
  }

  private drop(l: Live): void {
    const i = this.live.indexOf(l);
    if (i >= 0) this.live.splice(i, 1);
    l.c.destroy({ children: true });
  }

  clear(): void { for (const l of [...this.live]) this.drop(l); this.last.clear(); }
}
