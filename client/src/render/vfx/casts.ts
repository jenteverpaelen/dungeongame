// Caster-side flourishes (`cast` per skill id + rune), dash afterimages and level / paragon pillars.

import { SKILLS } from '@shared/data/skills';
import { ELEMENT_INDEX, type GameEvent } from '@shared/protocol';
import { preferences } from '../../game/preferences';
import type { VfxCore } from './core';
import type { AoeFx } from './aoe';
import type { Telegraphs } from './telegraphs';
import { EL_ARCANE, EL_COLD, EL_FIRE, EL_LIGHT, EL_PHYS, TAU, clamp, pal, rand } from './util';

type Cast = Extract<GameEvent, { e: 'cast' }>;
type Dash = Extract<GameEvent, { e: 'dash' }>;

const HAND = 34;

/** Element of a skill after its rune (Gathering Storm → lightning, Comet → cold ...). */
export function skillElement(sk: string, rune?: string): number {
  const def = SKILLS[sk];
  if (!def) return EL_PHYS;
  const r = rune ? def.runes.find((x) => x.id === rune) : undefined;
  const el = r?.mods.element ?? def.element;
  const i = ELEMENT_INDEX.indexOf(el as (typeof ELEMENT_INDEX)[number]);
  return i < 0 ? EL_PHYS : i;
}

function hasFlag(sk: string, rune: string | undefined, flag: string): boolean {
  const r = rune ? SKILLS[sk]?.runes.find((x) => x.id === rune) : undefined;
  return !!r?.mods.flags?.includes(flag);
}

export class Casts {
  constructor(private V: VfxCore, private aoe: AoeFx, private tele: Telegraphs) {}

  cast(ev: Cast): void {
    const V = this.V, s = V.sys, T = s.T;
    const el = skillElement(ev.sk, ev.r);
    const P = pal(el);
    const x = ev.x, y = ev.y;
    const a = Math.atan2(ev.ty - y, ev.tx - x);
    const dir = Math.cos(a) >= 0 ? 1 : -1;
    const hx = x + dir * 14, hz = HAND;
    const mine = V.isMine(ev.s);
    const vol = mine ? 1 : 0.5;
    switch (ev.sk) {
      case 'cleave': {
        const wide = hasFlag('cleave', ev.r, 'wideArc');
        this.aoe.cleave(x, y, ev.rad ?? (wide ? 150 : 120), a, el, wide);
        V.mark('cleave', x, y);
        break;
      }
      case 'whirlwind': {
        for (let i = 0, n = s.n(10); i < n; i++) {
          const aa = (i / 10) * TAU;
          s.dust(x + Math.cos(aa) * 10, y + Math.sin(aa) * 6, 18, 46, 0xc9b597, rand(0.5, 0.7), 0.4, Math.cos(aa) * 200, Math.sin(aa) * 120);
        }
        V.sound('swing', x, y, vol);
        break;
      }
      case 'rend': {
        this.aoe.rend(x, y, ev.rad ?? 110, el);
        V.mark('cast:rend', x, y);
        break;
      }
      case 'ground_stomp': {
        for (let i = 0, n = s.n(6); i < n; i++) s.dust(x + rand(-16, 16), y + rand(-6, 6), 16, 34, 0xc9b597, 0.45, 0.4);
        V.sound('swing', x, y, vol * 0.7);
        break;
      }
      case 'seismic_slam': {
        s.flash(x + dir * 20, y, 18, 60, el === EL_PHYS ? 0xfff2d8 : P.hot, 0.12, 0.5);
        for (let i = 0, n = s.n(5); i < n; i++) s.dust(x + Math.cos(a) * rand(10, 40), y + Math.sin(a) * rand(10, 30), 16, 40, 0xb8a284, 0.5, 0.45, Math.cos(a) * 120, Math.sin(a) * 80);
        break;
      }
      case 'battle_rage': {
        s.flash(x, y, 30, 130, 0xff4a2a, 0.22, 0.85);
        s.ring(s.gAdd, T.ringThick, x, y, 10, 90, 0xff3a1a, 0.45, 0.8);
        for (let i = 0; i < 12; i++) {
          const p = s.aAdd.add(T.streak, x + rand(-18, 18), y + 1, rand(0.35, 0.55));
          p.rotation = -Math.PI / 2 + rand(-0.15, 0.15); p.anchorX = 0.9; p.z = rand(0, 20); p.vz = rand(160, 260);
          p.w0 = rand(30, 50); p.w1 = 10; p.k = 0.5; p.fo = 0.4; p.tintFade(0xffb090, 0xff2a10);
        }
        for (let i = 0, n = s.n(14); i < n; i++) s.ember(x + rand(-20, 20), y, rand(0, 40), 0xff5a2a, rand(0.6, 1), 5, 120);
        V.sound('rage', x, y, vol);
        break;
      }
      case 'magic_weapon': {
        const c = el === EL_ARCANE ? 0xc39bff : P.main;
        s.flash(hx, y, hz, 70, c, 0.2, 0.9);
        for (let i = 0, n = s.n(16); i < n; i++) {
          const p = s.aAdd.add(i % 3 ? T.dot : T.star4, x + rand(-22, 22), y + 1, rand(0.6, 1));
          p.z = rand(0, 50); p.vz = rand(30, 80); p.w0 = rand(5, 10); p.w1 = 1; p.fo = 0.3; p.flick = 0.3; p.vr = 2;
          p.tintFade(0xf0d8ff, c);
        }
        s.ring(s.gAdd, T.runeRing, x, y, 30, 60, c, 0.7, 0.7);
        V.sound('arcane_buff', x, y, vol);
        break;
      }
      case 'hungering_arrow': case 'magic_missile': {
        const c = ev.sk === 'magic_missile' ? (el === EL_ARCANE ? 0xc39bff : P.main) : 0xfff0d0;
        s.flash(hx, y, hz, 30, c, 0.08, 0.8);
        for (let i = 0; i < 3; i++) s.spark(hx, y, hz, a + rand(-0.5, 0.5), rand(120, 220), 10, c, 0.14);
        break;
      }
      case 'multishot': {
        s.flash(hx, y, hz, 70, el === EL_LIGHT ? 0xd6c2ff : 0xffe6b0, 0.12, 0.9);
        for (let i = 0; i < 9; i++) {
          const aa = a + (i / 8 - 0.5) * 1.22;
          const p = s.aAdd.add(T.streak, hx, y, 0.16);
          p.z = hz; p.rotation = aa; p.anchorX = 0.05; p.w0 = 30; p.w1 = 70; p.k = 0.5; p.se = 3; p.fo = 0.2;
          p.tintTo(el === EL_LIGHT ? 0xb9a2ff : 0xfff0d0);
        }
        s.smoke(hx + Math.cos(a) * 16, y, hz, 16, 46, 0x9a948e, 0.6, 0.35, 15);
        V.sound('multishot', x, y, vol);
        break;
      }
      case 'cluster_arrow': {
        s.flash(hx, y, hz, 44, 0xffc070, 0.1, 0.9);
        s.smoke(hx, y, hz, 14, 36, 0x9a948e, 0.6, 0.35, 15);
        break;
      }
      case 'rain_of_vengeance': {
        for (let i = 0; i < 10; i++) {
          const p = s.aAdd.add(T.streak, x + rand(-14, 14), y + 1, rand(0.25, 0.4));
          p.rotation = -Math.PI / 2 + rand(-0.2, 0.2); p.anchorX = 0.9; p.z = hz; p.vz = rand(500, 800); p.w0 = 50; p.w1 = 30; p.k = 0.35; p.fo = 0.3;
          p.tintTo(el === EL_LIGHT ? 0xb9a2ff : el === EL_FIRE ? 0xffa040 : 0xfff0d0);
        }
        s.flash(x, y, hz, 50, 0xfff0d0, 0.1, 0.7);
        break;
      }
      case 'sentry': case 'companion': case 'hydra': {
        const px = ev.tx || x, py = ev.ty || y;
        this.summonPuff(px, py, ev.sk, el);
        V.sound(ev.sk === 'sentry' ? 'sentry' : 'summon', px, py, vol);
        break;
      }
      case 'meteor': {
        if (mine) { this.tele.meteorEl = el === EL_COLD ? EL_COLD : EL_FIRE; this.tele.meteorElAt = V.real; }
        const c = el === EL_COLD ? 0x7fd8ff : 0xff8a2a;
        const rr = s.gAdd.add(T.runeRing, x, y, 0.7);
        rr.w0 = 70; rr.w1 = 110; rr.se = 3; rr.vr = 3; rr.fo = 0.4; rr.a0 = 0.9; rr.tintTo(c);
        s.flash(x, y, 50, 80, c, 0.25, 0.7);
        for (let i = 0, n = s.n(10); i < n; i++) s.ember(x + rand(-16, 16), y, rand(20, 50), c, rand(0.5, 0.9), 5, 140);
        V.sound('cast', x, y, vol);
        break;
      }
      case 'black_hole': {
        const c = el === EL_COLD ? 0x7fd8ff : 0xb070ff;
        s.flash(hx, y, hz, 60, c, 0.18, 0.9);
        const sw = s.aAdd.add(T.swirl, hx, y, 0.35);
        sw.z = hz; sw.w0 = 50; sw.w1 = 6; sw.se = 2; sw.vr = -12; sw.fo = 0.5; sw.tintTo(c);
        V.sound('cast', x, y, vol);
        break;
      }
      case 'frost_nova': {
        s.flash(x, y, hz, 70, 0xbfeaff, 0.12, 0.8);
        break;
      }
      default: {
        s.flash(hx, y, hz, 50, P.main, 0.14, 0.8);
        for (let i = 0; i < 4; i++) s.spark(hx, y, hz, rand(0, TAU), rand(80, 160), 8, P.hot, 0.18);
        V.sound('cast', x, y, vol);
      }
    }
  }

  private summonPuff(x: number, y: number, sk: string, el: number): void {
    const s = this.V.sys, T = s.T;
    if (sk === 'hydra') {
      const P = pal(el === EL_PHYS ? EL_FIRE : el);
      s.flash(x, y, 10, 110, P.hot, 0.16, 0.9);
      s.ring(s.gAdd, T.ringThick, x, y, 10, 70, P.main, 0.4, 0.9);
      for (let i = 0, n = s.n(10); i < n; i++) {
        const a = rand(0, TAU), d = rand(0, 26);
        const f = s.aAdd.add(T.flame, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, rand(0.3, 0.55));
        f.anchorY = 0.85; f.vz = rand(60, 120); f.w0 = rand(16, 26); f.w1 = 4; f.k = 1.5; f.fo = 0.3;
        f.tintFade(P.hot, P.main);
      }
      for (let i = 0, n = s.n(12); i < n; i++) s.ember(x + rand(-24, 24), y, 4, P.main, rand(0.6, 1.1), 5, 100);
      return;
    }
    // Sentry / companion: a dust puff with brass (or magic) sparkles.
    const c = sk === 'sentry' ? 0xffd27a : 0xd8f0c0;
    for (let i = 0, n = s.n(10); i < n; i++) {
      const a = (i / 10) * TAU;
      s.dust(x + Math.cos(a) * 8, y + Math.sin(a) * 5, 16, 40, 0xc9b597, rand(0.5, 0.8), 0.45, Math.cos(a) * 140, Math.sin(a) * 90);
    }
    s.flash(x, y, 18, 60, c, 0.14, 0.7);
    for (let i = 0, n = s.n(8); i < n; i++) s.spark(x, y, 16, rand(-Math.PI, 0), rand(100, 220), 10, c, 0.25, 500);
    for (let i = 0; i < 3; i++) s.glint(x + rand(-16, 16), y, rand(10, 34), 14, c, 0.35);
  }

  dash(ev: Dash): void {
    const V = this.V, s = V.sys, T = s.T;
    const dx = ev.tx - ev.x, dy = ev.ty - ev.y;
    const L = Math.hypot(dx, dy);
    if (L < 4) return;
    const ang = Math.atan2(dy, dx);
    const n = clamp(Math.round(L / 34), 3, 7);
    for (let i = 0; i < n; i++) {
      const f = i / n;
      const g = s.aAdd.add(T.ghost, ev.x + dx * f, ev.y + dy * f, 0.16 + f * 0.22);
      g.anchorY = 0.95; g.w0 = 46; g.w1 = 44; g.a0 = 0.18 + f * 0.3; g.fo = 0; g.tintTo(0x9fd8ff);
    }
    for (let i = 0, k = s.n(7); i < k; i++) {
      const f = rand(0.1, 0.9);
      const p = s.aAdd.add(T.streak, ev.x + dx * f, ev.y + dy * f + 1, rand(0.16, 0.26));
      p.z = rand(8, 56); p.rotation = Math.atan2(dy, dx); p.anchorX = 0.5; p.w0 = rand(40, 70); p.w1 = 20; p.k = 0.4; p.a0 = 0.6; p.fo = 0.2;
      p.vx = Math.cos(ang) * 120; p.vy = Math.sin(ang) * 120;
      p.tintTo(0xe8f6ff);
    }
    for (let i = 0, k = s.n(4); i < k; i++) s.dust(ev.x + rand(-8, 8), ev.y + rand(-4, 4), 16, 40, 0xc9b597, rand(0.4, 0.6), 0.45, -Math.cos(ang) * 90 + rand(-30, 30), -Math.sin(ang) * 60);
    s.dust(ev.tx, ev.ty, 14, 34, 0xc9b597, 0.45, 0.35, Math.cos(ang) * 60, Math.sin(ang) * 40);
    V.sound('dash', ev.x, ev.y, ev.t === V.ctx.myId() ? 1 : 0.5);
  }

  /** Level-up (gold) / paragon (blue-violet) pillar of light on a player. */
  pillar(id: number, paragon: boolean): void {
    const V = this.V, s = V.sys, T = s.T;
    const p = V.ctx.entityPos(id);
    if (!p) return;
    const { x, y } = p;
    const me = id === V.ctx.myId();
    V.sound(paragon ? 'paragon' : 'level', me ? undefined : x, me ? undefined : y, me ? 1 : 0.5);
    if (preferences.get().values.reduceFlashes) return;
    const starts = s.layers.map(layer => layer.count);
    const main = paragon ? 0x7f9bff : 0xffc83d, hot = paragon ? 0xe6ecff : 0xfff2b8;
    const H = 560, W = 92;
    const beam = s.aAdd.add(T.beam, x, y + 2, 1.5);
    beam.anchorY = 1; beam.w0 = W * 0.6; beam.w1 = W; beam.se = 3; beam.k = (H * 64) / (256 * W); beam.fi = 0.06; beam.fo = 0.45; beam.a0 = 0.95;
    beam.tintTo(main);
    const core = s.aAdd.add(T.beamCore, x, y + 2, 1.3);
    core.anchorY = 1; core.w0 = 18; core.w1 = 30; core.se = 3; core.k = (H * 32) / (256 * 30); core.fi = 0.05; core.fo = 0.4;
    core.tintTo(hot);
    s.flash(x, y, 30, 220, hot, 0.25, 1);
    s.ring(s.gAdd, T.ringThick, x, y, 12, 150, main, 0.8, 1);
    s.ring(s.gAdd, T.ringHard, x, y, 20, 120, hot, 0.5, 0.9);
    const rr = s.gAdd.add(T.runeRing, x, y, 1.5);
    rr.w0 = 150; rr.w1 = 190; rr.se = 3; rr.vr = 1.2; rr.fi = 0.1; rr.fo = 0.5; rr.a0 = 0.9; rr.tintTo(main);
    for (let i = 0, n = s.n(30); i < n; i++) {
      const g = s.aAdd.add(i % 3 ? T.dot : T.star4, x + rand(-26, 26), y + 1, rand(0.8, 1.5));
      g.z = rand(0, 40); g.vz = rand(140, 320); g.drag = 0.5; g.w0 = rand(5, 11); g.w1 = 2; g.fo = 0.4; g.flick = 0.3; g.vr = 2;
      g.tintFade(hot, main);
    }
    for (let i = 0, n = s.n(20); i < n; i++) s.spark(x, y, 20, rand(0, TAU), rand(200, 380), 14, i % 2 ? hot : main, 0.4);
    if (paragon) for (let i = 0; i < 6; i++) s.glint(x + rand(-40, 40), y, rand(40, 200), rand(22, 34), hot, rand(0.5, 0.9));
    for (let i = 0; i < s.layers.length; i++) {
      const list = s.layers[i].list;
      for (let j = starts[i]; j < list.length; j++) list[j].celebration = true;
    }
  }
}
