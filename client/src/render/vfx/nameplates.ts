// Nameplates: players (class-coloured name + level / paragon badge), champions (blue) and rares
// (yellow) with an affix line and a slim life bar with a lagging damage chip. Constant screen size;
// fade in when the entity (re)appears on screen. Minions, bosses (HUD boss bar), goblins and trash: none.

import { Container, Graphics, Sprite, Texture, BitmapText } from 'pixi.js';
import { CLASSES } from '@shared/data/classes';
import { ELITE_AFFIXES } from '@shared/data/monsters';
import { F_DEAD, type EntDesc } from '@shared/protocol';
import type { ClassId } from '@shared/types';
import type { Nameplate } from '../types';
import type { VfxCore } from './core';
import { PLATE_FONT, ensureFonts } from './fonts';
import { clamp, lerpColor } from './util';
import { GEAR_TIER_COLORS, gearProfile } from '@shared/gearVisual';
import { SET_STYLE } from '../art/gearStyle';

/** Gear-rank medal left of the level badge (rank 2+), escalating in shape: disc → shield → winged shield → Ancient
 *  jewels → Primal flame tips (docs/rework/gear/DESIGN.md §5; D3 portrait frames / MapleStory medals as principle). */
function drawMedal(g: Graphics, rank: number): number {
  if (rank < 2) return 0;
  const col = GEAR_TIER_COLORS[rank], hi = lerpColor(col, 0xffffff, 0.45), ink = 0x120c08;
  const cx = 0, cy = 0;
  if (rank >= 6) {
    // wings
    for (const k of [-1, 1]) {
      g.poly([cx + k * 4, cy - 3, cx + k * 11, cy - 7, cx + k * 9.5, cy - 2, cx + k * 12, cy, cx + k * 8, cy + 2, cx + k * 4, cy + 2]).fill({ color: rank >= 8 ? hi : col, alpha: 0.95 }).stroke({ width: 1, color: ink, alpha: 0.9 });
    }
  }
  if (rank >= 9) for (const k of [-1, 0, 1]) g.poly([cx + k * 3.4 - 1.6, cy - 6, cx + k * 3.4, cy - 11 - (k ? 0 : 2), cx + k * 3.4 + 1.6, cy - 6]).fill({ color: 0xffe0c8 });
  if (rank >= 4) g.poly([cx - 5, cy - 6, cx + 5, cy - 6, cx + 5, cy + 1, cx, cy + 6.5, cx - 5, cy + 1]).fill({ color: col }).stroke({ width: 1.2, color: ink });
  else g.circle(cx, cy, 5).fill({ color: col }).stroke({ width: 1.2, color: ink });
  g.circle(cx, cy - 0.5, rank >= 4 ? 2 : 1.8).fill({ color: hi });
  if (rank >= 8) for (const k of [-1, 1]) g.circle(cx + k * 3.2, cy - 4.2, 0.9).fill({ color: 0xfff0c8 });
  return rank >= 6 ? 25 : 11;
}

/** Crown above a rank 8+ name (Primal: crimson with flame licks). Drawn once; animated by transform only. */
function drawCrown(g: Graphics, col: number, primal: boolean): void {
  const hi = lerpColor(col, 0xffffff, 0.5), ink = 0x120c08;
  g.poly([-9, 3, -9, -3, -5, 0, -2.5, -6.5, 0, -1.5, 2.5, -6.5, 5, 0, 9, -3, 9, 3]).fill({ color: col }).stroke({ width: 1.2, color: ink });
  g.rect(-9, 1.2, 18, 1.8).fill({ color: hi, alpha: 0.9 });
  for (const x of [-5.5, 0, 5.5]) g.circle(x, 2.1, 1.1).fill({ color: primal ? 0xfff0e0 : 0xffffff });
  for (const [x, y] of [[-9, -3], [-2.5, -6.5], [2.5, -6.5], [9, -3]]) g.circle(x, y, 1).fill({ color: hi });
}

const CHAMPION = 0x7f9bff;
const RARE = 0xffe14a;
const BAR_W = 66, BAR_H = 5;

export function createNameplate(V: VfxCore, desc: EntDesc, isMe: boolean): Nameplate | null {
  if (desc.k === 'player') {
    V.register(desc.id, 'player', desc.t, 0);
    return playerPlate(V, desc, isMe);
  }
  if (desc.k !== 'mob') return null;
  const tier = desc.el ?? 0;
  V.register(desc.id, 'mob', desc.t, tier);
  if (tier !== 1 && tier !== 2) return null;
  return elitePlate(V, desc, tier);
}

function text(str: string, size: number, tint: number): BitmapText {
  const t = new BitmapText({ text: str, style: { fontFamily: PLATE_FONT, fontSize: size } });
  t.tint = tint;
  return t;
}

function fader(V: VfxCore, root: Container, inner: Container) {
  let lastSeen = -10;
  let shownAt = 0;
  return (hovered: boolean) => {
    const now = V.real;
    if (now - lastSeen > 0.25) shownAt = now;
    lastSeen = now;
    const z = V.ctx.zoom() || 1;
    const hs = hovered ? 1.08 : 1;
    inner.scale.set(hs / z);
    root.alpha = clamp((now - shownAt) / 0.25, 0, 1) * (hovered ? 1 : 0.92);
  };
}

function playerPlate(V: VfxCore, desc: EntDesc, isMe: boolean): Nameplate {
  ensureFonts();
  const root = new Container({ label: 'nameplate' });
  const inner = new Container();
  root.addChild(inner);
  const cls = CLASSES[desc.t as ClassId];
  const color = lerpColor(cls?.themeColor ?? 0xd8cfc0, 0xffffff, 0.38);
  const name = text(desc.n ?? 'Hero', 13, color);
  const title=desc.look?.title?text(desc.look.title,10.5,0xbca777):null;
  if(title){title.position.set(-title.width/2,-30);inner.addChild(title);}
  const lvl = text('', 10.5, 0xe8d9a8);
  const badge = new Graphics();
  const prof = desc.look && Object.values(desc.look.slots).some((l) => typeof l?.fx === 'number') ? gearProfile(desc.look) : null;
  const medal = new Graphics();
  const mw = prof ? drawMedal(medal, prof.rank) : 0;
  const setMark = prof && prof.topSetCount >= 6 && prof.topSet ? new Graphics().poly([0, -4, 3.4, 0, 0, 4, -3.4, 0]).fill({ color: SET_STYLE[prof.topSet]?.main ?? 0x3cff6e }).stroke({ width: 1, color: 0x120c08 }) : null;
  // rank 6+: the name sits on a dark pill with a rank / Set coloured glow (legible on busy ground); rank 8+: a crown
  const rankCol = prof ? (prof.primals ? 0xff3a2a : prof.topSetCount >= 4 && prof.topSet ? SET_STYLE[prof.topSet]?.main ?? GEAR_TIER_COLORS[prof.rank] : GEAR_TIER_COLORS[prof.rank]) : 0;
  const glow = prof && prof.rank >= 6 ? new Sprite(V.T.glow) : null;
  const pill = prof && prof.rank >= 6 ? new Graphics() : null;
  if (glow) { glow.anchor.set(0.5); glow.blendMode = 'add'; glow.tint = rankCol; inner.addChild(glow); }
  if (pill) inner.addChild(pill);
  if (prof && prof.rank >= 6) name.tint = lerpColor(color, 0xffffff, 0.35);
  const crown = prof && prof.rank >= 8 ? new Graphics() : null;
  if (crown) drawCrown(crown, prof!.primals ? 0xff5a3a : rankCol, !!prof!.primals);
  const licks: Sprite[] = [];
  const twinkle = crown ? new Sprite(V.T.star4) : null;
  if (crown && prof!.primals) for (let i = 0; i < 3; i++) { const f = new Sprite(V.T.flame); f.anchor.set(0.5, 1); f.blendMode = 'add'; f.tint = i === 1 ? 0xfff0e0 : 0xff4a2a; licks.push(f); }
  if (twinkle) { twinkle.anchor.set(0.5); twinkle.blendMode = 'add'; twinkle.tint = 0xffffff; twinkle.width = twinkle.height = 9; }
  inner.addChild(badge, lvl, name, medal);
  if (setMark) inner.addChild(setMark);
  if (crown) { inner.addChild(crown); for (const f of licks) inner.addChild(f); inner.addChild(twinkle!); }
  const layout = (lv: number, pl: number) => {
    lvl.text = pl > 0 ? `P${pl}` : `${lv}`;
    lvl.tint = pl > 0 ? 0x9fb4ff : 0xe8d9a8;
    const pad = 4;
    const lw = lvl.width + pad * 2;
    badge.clear()
      .roundRect(0, 0, lw, 13, 4).fill({ color: 0x120c08, alpha: 0.72 })
      .roundRect(0, 0, lw, 13, 4).stroke({ width: 1, color: pl > 0 ? 0x5a6ab8 : 0x8a7240, alpha: 0.85 });
    const mgap = mw ? mw + 3 : 0, sgap = setMark ? 10 : 0;
    const total = mgap + lw + 4 + name.width + sgap;
    medal.position.set(-total / 2 + mw / 2, -7.5);
    badge.position.set(-total / 2 + mgap, -14);
    lvl.position.set(-total / 2 + mgap + pad, -14.5);
    name.position.set(-total / 2 + mgap + lw + 4, -16.5);
    if (setMark) setMark.position.set(total / 2 - 4, -7.5);
    if (pill) {
      const x0 = name.x - 5, w = name.width + 10;
      pill.clear().roundRect(x0, -16, w, 15, 7).fill({ color: 0x0b0806, alpha: 0.6 }).roundRect(x0, -16, w, 15, 7).stroke({ width: 1, color: rankCol, alpha: 0.75 });
      glow!.position.set(name.x + name.width / 2, -8.5);
      glow!.width = name.width + 34; glow!.height = 26;
    }
    if (crown) crown.position.set(name.x + name.width / 2, title ? -38 : -24);
  };
  let curLv = desc.lv ?? 1, curPl = desc.pl ?? 0;
  layout(curLv, curPl);
  V.levelHooks.set(desc.id, (lv, paragon) => {
    if (paragon) curPl = lv; else curLv = lv;
    layout(curLv, curPl);
  });
  const fade = fader(V, root, inner);
  return {
    root,
    update(_hp: number, flags: number, hovered: boolean) {
      fade(hovered);
      if (isMe) root.alpha *= 0.85;
      if (glow) {
        const t = V.real;
        glow.alpha = prof!.rank >= 8 ? 0.42 + 0.14 * Math.sin(t * 2.2) : 0.34;
        if (crown) {
          const cx = crown.x, cy = crown.y;
          crown.y = (title ? -38 : -24) + Math.sin(t * 2.4) * 0.8;
          licks.forEach((f, i) => { f.position.set(cx + (i - 1) * 5.5, cy - 4); f.height = 7 + 3 * Math.sin(t * 9 + i * 2.1); f.width = 4.5; f.alpha = 0.9; });
          const u = (t * 0.45) % 1;
          twinkle!.position.set(cx - 9 + 18 * u, cy - 3 + Math.sin(u * Math.PI) * -4);
          twinkle!.alpha = Math.sin(u * Math.PI) * 0.9;
          twinkle!.rotation = t * 3;
          void cx; void cy;
        }
      }
      root.visible = root.visible && (flags & F_DEAD) === 0;
    },
    destroy() { V.levelHooks.delete(desc.id); root.destroy({ children: true }); },
  };
}

function elitePlate(V: VfxCore, desc: EntDesc, tier: number): Nameplate {
  ensureFonts();
  const root = new Container({ label: 'nameplate-elite' });
  const inner = new Container();
  root.addChild(inner);
  const col = tier === 1 ? CHAMPION : RARE;
  const name = text(desc.n ?? 'Elite', 14, col);
  name.position.set(-name.width / 2, -40);
  const aff = (desc.af ?? []).map((a) => (ELITE_AFFIXES[a]?.name ?? a).toUpperCase()).join('  ·  ');
  const affT = text(aff, 10, 0xc4bba8);
  affT.position.set(-affT.width / 2, -24);
  // Life bar: dark frame, lagging damage chip, red fill with a highlight.
  const frame = new Graphics()
    .roundRect(-BAR_W / 2 - 2, -9, BAR_W + 4, BAR_H + 4, 2).fill({ color: 0x0c0806, alpha: 0.88 })
    .roundRect(-BAR_W / 2 - 2, -9, BAR_W + 4, BAR_H + 4, 2).stroke({ width: 1, color: tier === 1 ? 0x3a4a8a : 0x7a6420, alpha: 0.9 });
  const chip = new Sprite(Texture.WHITE);
  chip.tint = 0xffe2b0;
  chip.position.set(-BAR_W / 2, -7);
  chip.height = BAR_H;
  const fill = new Sprite(Texture.WHITE);
  fill.tint = 0xc8281e;
  fill.position.set(-BAR_W / 2, -7);
  fill.height = BAR_H;
  const shine = new Sprite(Texture.WHITE);
  shine.tint = 0xff8a70;
  shine.alpha = 0.55;
  shine.position.set(-BAR_W / 2, -7);
  shine.height = 1.5;
  inner.addChild(frame, chip, fill, shine, affT, name);
  if (!aff) name.position.y = -26;
  const fade = fader(V, root, inner);
  let chipFrac = 1, lastHp = 1, chipHold = 0, last = V.real;
  return {
    root,
    update(hp: number, flags: number, hovered: boolean) {
      fade(hovered);
      const f = clamp(hp, 0, 1);
      if (f < lastHp) chipHold = 0.25;
      lastHp = f;
      const dt = clamp(V.real - last, 0, 0.1);
      last = V.real;
      if (chipHold > 0) chipHold -= dt;
      else chipFrac += (f - chipFrac) * Math.min(1, dt * 6);
      if (chipFrac < f) chipFrac = f;
      fill.width = Math.max(0.001, BAR_W * f);
      shine.width = fill.width;
      chip.width = Math.max(0.001, BAR_W * chipFrac);
      root.visible = root.visible && (flags & F_DEAD) === 0;
    },
    destroy() { root.destroy({ children: true }); },
  };
}
