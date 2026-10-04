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
  const pl = desc.pl ?? 0;
  const lvl = text(pl > 0 ? `P${pl}` : `${desc.lv ?? 1}`, 10.5, pl > 0 ? 0x9fb4ff : 0xe8d9a8);
  const pad = 4;
  const lw = lvl.width + pad * 2;
  const badge = new Graphics()
    .roundRect(0, 0, lw, 13, 4).fill({ color: 0x120c08, alpha: 0.72 })
    .roundRect(0, 0, lw, 13, 4).stroke({ width: 1, color: pl > 0 ? 0x5a6ab8 : 0x8a7240, alpha: 0.85 });
  const total = lw + 4 + name.width;
  badge.position.set(-total / 2, -14);
  lvl.position.set(-total / 2 + pad, -14.5);
  name.position.set(-total / 2 + lw + 4, -16.5);
  inner.addChild(badge, lvl, name);
  const fade = fader(V, root, inner);
  return {
    root,
    update(_hp: number, flags: number, hovered: boolean) {
      fade(hovered);
      if (isMe) root.alpha *= 0.85;
      root.visible = root.visible && (flags & F_DEAD) === 0;
    },
    destroy() { root.destroy({ children: true }); },
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
  const affT = text(aff, 9, 0xb9b0a0);
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
