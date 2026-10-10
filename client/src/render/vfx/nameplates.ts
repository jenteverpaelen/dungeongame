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
  inner.addChild(badge, lvl, name, medal);
  if (setMark) inner.addChild(setMark);
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
