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
import { gearProfile } from '@shared/gearVisual';
import { SET_STYLE } from '../art/gearStyle';
import { gearEffectLevel } from '../../game/preferences';

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
  if (tier === 1 || tier === 2) return elitePlate(V, desc, tier);
  if (tier === 4) return null; // bosses: the screen-wide boss bar
  return mobBar(V);
}

/** The small life bar over normal monsters, minions and the Hoardling: a dark frame, a damage chip and the red fill. */
const MOB_W = 40, MOB_H = 5;
function mobBar(V: VfxCore): Nameplate {
  const root = new Container({ label: 'mob-bar' });
  const inner = new Container();
  root.addChild(inner);
  const sprite = (tint: number, x: number, y: number, w: number, h: number, alpha = 1) => {
    const s = new Sprite(Texture.WHITE); s.tint = tint; s.alpha = alpha; s.position.set(x, y); s.width = w; s.height = h; inner.addChild(s); return s;
  };
  sprite(0x0c0806, -MOB_W / 2 - 1.5, -MOB_H - 3, MOB_W + 3, MOB_H + 3, 0.92);
  const chip = sprite(0xffe2b0, -MOB_W / 2, -MOB_H - 1.5, MOB_W, MOB_H);
  const fill = sprite(0xb8241a, -MOB_W / 2, -MOB_H - 1.5, MOB_W, MOB_H);
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
      fill.width = Math.max(0.001, MOB_W * f);
      chip.width = Math.max(0.001, MOB_W * chipFrac);
      root.visible = root.visible && (flags & F_DEAD) === 0;
    },
    destroy() { root.destroy({ children: true }); },
  };
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
  // No gear rank on the plate (DESIGN-V2 §6): only a completed Set shows, as its mark and a Set-coloured pill / glow
  const prof = desc.look && Object.values(desc.look.slots).some((l) => typeof l?.fx === 'number') ? gearProfile(desc.look) : null;
  const setId = prof && prof.topSetCount >= 6 ? prof.topSet : undefined;
  const setCol = setId ? SET_STYLE[setId]?.main ?? 0x3cff6e : 0;
  const setMark = setId ? new Graphics().poly([0, -4, 3.4, 0, 0, 4, -3.4, 0]).fill({ color: setCol }).stroke({ width: 1, color: 0x120c08 }) : null;
  const glow = setId ? new Sprite(V.T.glow) : null;
  const pill = setId ? new Graphics() : null;
  if (glow) { glow.anchor.set(0.5); glow.blendMode = 'add'; glow.tint = setCol; inner.addChild(glow); }
  if (pill) inner.addChild(pill);
  if (setId) name.tint = lerpColor(color, 0xffffff, 0.35);
  inner.addChild(badge, lvl, name);
  if (setMark) inner.addChild(setMark);
  if (desc.st === 'dev') {
    const dev = new Container({ label: 'staff-tag' });
    const tag = text('DEV', 12, 0x1b1205);
    const w = tag.width + 25, h = 16;
    const shine = new Sprite(V.T.glow);
    shine.anchor.set(0.5); shine.blendMode = 'add'; shine.tint = 0xffc04a; shine.alpha = 0.55;
    shine.width = w + 30; shine.height = 26; shine.position.set(0, h / 2);
    const bg = new Graphics().roundRect(-w / 2, 0, w, h, 3).fill({ color: 0xf2b94a }).roundRect(-w / 2, 0, w, h, 3).stroke({ width: 1, color: 0x5a3a0a });
    const star = new Graphics().poly([0, -4.5, 1.3, -1.3, 4.5, 0, 1.3, 1.3, 0, 4.5, -1.3, 1.3, -4.5, 0, -1.3, -1.3]).fill({ color: 0x1b1205 });
    star.position.set(-w / 2 + 9, h / 2);
    tag.position.set(-w / 2 + 16, 1);
    dev.addChild(shine, bg, star, tag);
    dev.position.set(0, title ? -49 : -36);
    inner.addChild(dev);
    name.tint = 0xffd36a;
  }
  const layout = (lv: number, pl: number) => {
    lvl.text = pl > 0 ? `P${pl}` : `${lv}`;
    lvl.tint = pl > 0 ? 0x9fb4ff : 0xe8d9a8;
    const pad = 4;
    const lw = lvl.width + pad * 2;
    badge.clear()
      .roundRect(0, 0, lw, 13, 4).fill({ color: 0x120c08, alpha: 0.72 })
      .roundRect(0, 0, lw, 13, 4).stroke({ width: 1, color: pl > 0 ? 0x5a6ab8 : 0x8a7240, alpha: 0.85 });
    const mgap = 0, sgap = setMark ? 10 : 0;
    const total = mgap + lw + 4 + name.width + sgap;
    badge.position.set(-total / 2 + mgap, -14);
    lvl.position.set(-total / 2 + mgap + pad, -14.5);
    name.position.set(-total / 2 + mgap + lw + 4, -16.5);
    if (setMark) setMark.position.set(total / 2 - 4, -7.5);
    if (pill) {
      const x0 = name.x - 5, w = name.width + 10;
      pill.clear().roundRect(x0, -16, w, 15, 7).fill({ color: 0x0b0806, alpha: 0.6 }).roundRect(x0, -16, w, 15, 7).stroke({ width: 1, color: setCol, alpha: 0.75 });
      glow!.position.set(name.x + name.width / 2, -8.5);
      glow!.width = name.width + 34; glow!.height = 26;
    }
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
        // the plate ornaments follow the gear-effect setting: off hides them
        const show = gearEffectLevel(isMe) !== 'off';
        glow.visible = pill!.visible = show;
        glow.alpha = 0.34;
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
