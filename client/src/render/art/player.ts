// Player paper doll: per-look baked part sheet + a cut-out rig animated procedurally from ViewState.

import { Container, Graphics, Sprite } from 'pixi.js';
import {
  F_CAST, F_CHANNEL, F_CHILL, F_DASH, F_DEAD, F_FROZEN, F_POISON, F_SHIELD, F_STUN,
  type LookSlot, type PlayerLook,
} from '@shared/protocol';
import type { ItemLook } from '@shared/types';
import type { PlayerView, ViewState } from '../types';
import { bakeSheet, type PartSpec, type Sheet } from './bake';
import { OUT } from './draw';
import { fx, glowSprite, sparkleSprite, swooshSprite } from './fx';
import {
  HEAD, classBody, drawArm, drawEyes, drawHairBack, drawHand, drawHead, drawLeg, drawMantleCape, drawOrb, drawQuiver,
  drawShield, drawShoulder, drawTorso, drawWeapon, isCasterShape, isRangedShape, isTwoHandedMelee, type Body,
} from './gear';
import { GLOW_SET } from './palette';
import { PNode, Puppet } from './puppet';
import { TAU, clamp, damp, easeIn, easeInOut, easeOut, easeOut3, lerp, light } from './util';

// ─────────────────────────── sheet cache ───────────────────────────

const sheets = new Map<string, Sheet>();
const idle: string[] = [];

function lookKey(look: PlayerLook): string {
  const parts: string[] = [look.classId];
  for (const k of Object.keys(look.slots).sort()) {
    const l = look.slots[k as LookSlot]!;
    parts.push(`${k}:${l.shape}:${l.primary}:${l.secondary}:${l.glow}:${l.variant}`);
  }
  return parts.join('|');
}

/** Parts used by a look (names must match the rig in PlayerArt). */
export function playerParts(look: PlayerLook, body: Body = classBody(look.classId)): PartSpec[] {
  const sl = look.slots;
  const specs: PartSpec[] = [];
  const add = (name: string, draw: PartSpec['draw']) => specs.push({ name, draw, flash: true });
  add('legB', (c) => drawLeg(c, body, sl.legs, sl.feet, true));
  add('legF', (c) => drawLeg(c, body, sl.legs, sl.feet, false));
  add('torso', (c) => drawTorso(c, body, sl.chest, sl.waist));
  add('head', (c) => drawHead(c, body, sl.head));
  add('eyes', (c) => drawEyes(c, body, sl.head?.shape === 'hood'));
  add('armB', (c) => drawArm(c, body, sl.chest, true));
  add('armF', (c) => drawArm(c, body, sl.chest, false));
  add('handB', (c) => drawHand(c, body, sl.hands, true));
  add('handF', (c) => drawHand(c, body, sl.hands, false));
  // optional parts
  const probe = new Graphics();
  if (drawHairBack(probe.context, body, sl.head)) add('hairB', (c) => { drawHairBack(c, body, sl.head); });
  probe.destroy();
  if (sl.shoulders) {
    add('shB', (c) => drawShoulder(c, sl.shoulders!, true));
    add('shF', (c) => drawShoulder(c, sl.shoulders!, false));
    if (sl.shoulders.shape === 'mantle') add('cape', (c) => drawMantleCape(c, sl.shoulders!));
  }
  if (sl.mainhand) add('weapon', (c) => drawWeapon(c, sl.mainhand!));
  const off = sl.offhand;
  if (off) {
    if (off.shape === 'quiver') add('quiver', (c) => drawQuiver(c, off));
    else if (off.shape === 'orb') add('offhand', (c) => drawOrb(c, off));
    else add('offhand', (c) => drawShield(c, off));
  }
  return specs;
}

const pendingBakes = new Map<string, PlayerLook>();
let lastPump = 0;

/** Bake at most one queued look per ~frame; views swap from live vector parts to the baked sheet. */
function pumpBakes(): void {
  const now = performance.now();
  if (now - lastPump < 14 || !pendingBakes.size) return;
  lastPump = now;
  const [key, look] = pendingBakes.entries().next().value as [string, PlayerLook];
  pendingBakes.delete(key);
  const cur = sheets.get(key);
  if (!cur || cur.destroyed || !cur.live) return;
  const baked = bakeSheet(playerParts(look), 3, 1024, `player:${look.classId}`);
  baked.refs = cur.refs;
  sheets.set(key, baked);
  // views swap on their next update; free the live geometry once they surely have
  setTimeout(() => cur.destroy(), 4000);
}

function acquireSheet(look: PlayerLook): { key: string; sheet: Sheet } {
  const key = lookKey(look);
  let sheet = sheets.get(key);
  if (!sheet || sheet.destroyed) {
    // instant live parts now, baked texture sheet on a later frame
    sheet = bakeSheet(playerParts(look), 3, 1024, `player:${look.classId}`, true);
    sheets.set(key, sheet);
    pendingBakes.set(key, look);
  }
  const i = idle.indexOf(key);
  if (i >= 0) idle.splice(i, 1);
  sheet.refs++;
  return { key, sheet };
}

function releaseSheet(key: string): void {
  const sheet = sheets.get(key);
  if (!sheet) return;
  sheet.refs--;
  if (sheet.refs > 0) return;
  idle.push(key);
  while (idle.length > 12) {
    const k = idle.shift()!;
    const s = sheets.get(k);
    if (s && s.refs <= 0) { s.destroy(); sheets.delete(k); pendingBakes.delete(k); }
  }
}

// ─────────────────────────── rig constants ───────────────────────────

const HIP_Y = -12;
const NECK = { x: 1, y: -20 };
const SH_B = { x: -1.6, y: -16 };
const SH_F = { x: 2.6, y: -16 };
const ARM_LEN = 10.5;

type WeaponKind = 'none' | '1h' | '2h' | 'bow' | 'xbow' | 'hxbow' | 'staff' | 'wand';

function weaponKind(shape: string | undefined): WeaponKind {
  if (!shape) return 'none';
  if (isTwoHandedMelee(shape)) return '2h';
  if (shape === 'bow') return 'bow';
  if (shape === 'crossbow') return 'xbow';
  if (shape === 'handxbow') return 'hxbow';
  if (shape === 'staff') return 'staff';
  if (shape === 'wand') return 'wand';
  return '1h';
}

/** Rest pose per weapon: [front arm, weapon, back arm]. */
const REST: Record<WeaponKind, [number, number, number]> = {
  none: [-0.1, 0, 0.16],
  '1h': [-0.18, 0.62, 0.2],
  '2h': [-0.62, -0.42, 0.24],
  bow: [0.02, 1.2, 0.22],
  xbow: [-0.5, 2.05, 0.18],
  hxbow: [-0.55, 1.95, 0.2],
  staff: [-0.78, 1.08, 0.2],
  wand: [-0.5, 1.75, 0.2],
};

interface GlowFx { sprite: Sprite; base: number; phase: number }
interface Twinkle { s: Sprite; x: number; y: number; r: number; phase: number; speed: number; rise: boolean; color: number }

const rot = (x: number, y: number, a: number) => {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
};

// ─────────────────────────── view ───────────────────────────

export class PlayerArt implements PlayerView {
  /** Placeholder until the skill choreography lands (render/actions.ts). */
  playAction(_a: import('../actions').ActionSpec): void {}
  readonly root = new Container();
  height = 66;

  private look!: PlayerLook;
  private key = '';
  private p!: Puppet;
  private n: Record<string, PNode | undefined> = {};
  private wk: WeaponKind = 'none';
  private glows: GlowFx[] = [];
  private twinkles: Twinkle[] = [];
  private fxBack = new Container();
  private fxFront = new Container();
  private string: Graphics | null = null;
  private trail: Sprite | null = null;
  private whirl: Sprite[] = [];
  private stars: Sprite[] = [];
  private bubble: Sprite | null = null;

  // animation state
  private face = 1;
  private walk = 0;
  private moveBlend = 0;
  private lastSeq = -1;
  private atkT = 9;
  private atkDur = 0.5;
  private chan = 0;
  private spin = 0;
  private castB = 0;
  private dashB = 0;
  private hitK = 0;
  private blinkT = 2;
  private t = 0;
  private dying = false;
  private deathT = 0;
  private deathDone: (() => void) | null = null;
  private deadPose = 0;
  private destroyed = false;

  constructor(look: PlayerLook) {
    this.setLook(look);
  }

  setLook(look: PlayerLook): void {
    const prevKey = this.key;
    this.look = look;
    const acq = acquireSheet(look);
    this.key = acq.key;
    if (prevKey) releaseSheet(prevKey);
    this.rebuild(acq.sheet);
  }

  private sheet!: Sheet;
  private rebuild(sheet: Sheet): void {
    if (this.p) { this.root.removeChild(this.p.root); this.p.destroy(); }
    this.sheet = sheet;
    this.build(sheet);
  }

  private build(sheet: Sheet): void {
    const look = this.look, sl = look.slots;
    const p = new Puppet(sheet, 34, 0.8);
    this.p = p;
    this.root.addChild(p.root);
    this.glows = []; this.twinkles = []; this.whirl = []; this.stars = [];
    this.string = null; this.trail = null; this.bubble = null;
    this.fxBack = new Container();
    this.fxFront = new Container();
    p.attach(this.fxBack);
    const n: Record<string, PNode | undefined> = {};
    this.n = n;
    this.wk = weaponKind(sl.mainhand?.shape);

    n.legB = p.add('legB', null, -2.6, HIP_Y);
    n.legF = p.add('legF', null, 2.6, HIP_Y);
    n.chest = p.add(null, null, 0, HIP_Y);
    const chest = n.chest;
    if (sheet.has('cape')) n.cape = p.add('cape', chest);
    if (sheet.has('hairB')) n.hairB = p.add('hairB', chest, NECK.x, NECK.y);
    if (sheet.has('quiver')) { n.quiver = p.add('quiver', chest, -8.4, -13); n.quiver.rot = -0.42; }
    n.armB = p.add('armB', chest, SH_B.x, SH_B.y);
    const farWeapon = false;
    if (farWeapon && sheet.has('weapon')) n.weapon = p.add('weapon', n.armB, 0, ARM_LEN);
    n.handB = p.add('handB', n.armB, 0, ARM_LEN);
    if (sheet.has('shB')) n.shB = p.add('shB', chest, SH_B.x - 0.6, SH_B.y - 0.6);
    n.torso = p.add('torso', chest);
    if (sheet.has('offhand')) n.off = p.add('offhand', chest);
    n.head = p.add('head', chest, NECK.x, NECK.y);
    n.eyes = p.add('eyes', n.head);
    n.armF = p.add('armF', chest, SH_F.x, SH_F.y);
    if (!farWeapon && sheet.has('weapon')) n.weapon = p.add('weapon', n.armF, 0, ARM_LEN);
    n.handF = p.add('handF', n.armF, 0, ARM_LEN);
    if (sheet.has('shF')) n.shF = p.add('shF', chest, SH_F.x, SH_F.y - 0.4);
    p.attach(this.fxFront);

    if (this.wk === 'bow' && n.weapon) {
      this.string = new Graphics();
      n.weapon.c.addChildAt(this.string, 0);
    }

    // height for nameplates
    const hs = sl.head?.shape;
    this.height = hs === 'wizard_hat' ? 76 : hs === 'helm_horned' ? 74 : this.wk === 'staff' ? 70 : 66;

    // glows for legendary / set pieces
    const area: Partial<Record<LookSlot, [number, number, number, number, PNode | null]>> = {
      head: [NECK.x + HEAD.x, HIP_Y + NECK.y + HEAD.y, 46, 40, null],
      chest: [0.5, HIP_Y - 10, 36, 36, null],
      shoulders: [1, HIP_Y - 17, 34, 22, null],
      hands: [2, HIP_Y - 6, 22, 18, null],
      waist: [0.5, HIP_Y - 4, 32, 14, null],
      legs: [0, -6, 26, 18, null],
      feet: [1, -2, 26, 12, null],
      offhand: [-6, HIP_Y - 6, 30, 30, null],
    };
    const glowLayer = new Container();
    p.body.addChildAt(glowLayer, 0);
    let glowCount = 0;
    for (const [slot, a] of Object.entries(area) as [LookSlot, [number, number, number, number, PNode | null]][]) {
      const l = sl[slot];
      if (!l?.glow) continue;
      glowCount++;
      const g = glowSprite(l.glow, Math.max(a[2], a[3]) * 1.7, 0.3, true);
      g.position.set(a[0], a[1]);
      g.scale.y *= a[3] / a[2];
      glowLayer.addChild(g);
      this.glows.push({ sprite: g, base: 0.5, phase: Math.random() * TAU });
      if (slot === 'head') this.addTwinkles(l, a[0] - 6, a[1] - 12, 12, 1);
      else if (slot === 'chest' || slot === 'shoulders' || slot === 'offhand') this.addTwinkles(l, a[0] - 4, a[1], a[2] * 0.45, 1);
    }
    const w = sl.mainhand;
    if (w?.glow && n.weapon) {
      glowCount++;
      const len = this.wk === '2h' ? 46 : this.wk === 'staff' ? 50 : this.wk === 'bow' ? 48 : this.wk === 'wand' ? 18 : this.wk === 'xbow' ? 30 : 26;
      const ws = glowSprite(w.glow, len * 1.05, 0.5, true);
      ws.blendMode = 'normal';
      ws.scale.x = ws.scale.y * 0.42;
      ws.position.set(0, this.wk === 'bow' ? 0 : -len * 0.55);
      n.weapon.c.addChildAt(ws, 0);
      this.glows.push({ sprite: ws, base: 0.62, phase: 0 });
      const tip = sparkleSprite(light(w.glow, 0.4), 8, 0.8);
      tip.blendMode = 'normal';
      tip.position.set(0, this.wk === 'bow' ? -22 : -len * 0.95);
      n.weapon.c.addChild(tip);
      this.twinkles.push({ s: tip, x: tip.x, y: tip.y, r: 0, phase: 0, speed: 3.1, rise: false, color: w.glow });
    }
    if (glowCount >= 3) {
      // a full legendary / set kit: the hero shimmers
      const main = Object.values(sl).find((l) => l?.glow)?.glow ?? GLOW_SET;
      const aura = glowSprite(main, 84, 0.2, true);
      aura.position.set(0, -32);
      aura.scale.y *= 1.2;
      glowLayer.addChildAt(aura, 0);
      this.glows.push({ sprite: aura, base: 0.22 + glowCount * 0.03, phase: 1 });
    }
    // set pieces: a gentle stream of motes rising around the hero
    const setPieces = Object.values(sl).filter((l) => l?.glow === GLOW_SET).length;
    for (let i = 0; i < Math.min(4, setPieces); i++) {
      const m = sparkleSprite(light(GLOW_SET, 0.35), 7, 0);
      this.fxFront.addChild(m);
      this.twinkles.push({ s: m, x: 0, y: -26, r: 20, phase: (i / 4) * TAU, speed: 1.1, rise: true, color: GLOW_SET });
    }

    // weapon trail
    this.trail = swooshSprite(w?.glow ? light(w.glow, 0.2) : 0xfff2d8, this.wk === '2h' ? 50 : 36, 0);
    this.trail.position.set(SH_F.x, HIP_Y + SH_F.y);
    this.fxFront.addChild(this.trail);
    // whirlwind arcs: live outside the body flip, projected onto the ground plane (behind + in front)
    for (let i = 0; i < 2; i++) {
      const plane = new Container();
      plane.position.set(0, -22);
      plane.scale.y = 0.38;
      const s = swooshSprite(w?.glow ? light(w.glow, 0.3) : 0xf4ecd8, this.wk === '2h' ? 44 : 36, 0);
      plane.addChild(s);
      (i === 0 ? p.under : p.over).addChild(plane);
      this.whirl.push(s);
    }
  }

  private addTwinkles(l: ItemLook, cx: number, cy: number, r: number, count: number): void {
    const set = l.glow === GLOW_SET;
    for (let i = 0; i < count; i++) {
      const s = sparkleSprite(light(l.glow, 0.45), 8, 0);
      this.fxFront.addChild(s);
      this.twinkles.push({ s, x: cx, y: cy, r, phase: Math.random() * TAU, speed: 0.9 + Math.random() * 0.6, rise: set, color: l.glow });
    }
  }

  // ─────────────────────────── per frame ───────────────────────────

  update(dt: number, s: ViewState): void {
    if (this.destroyed) return;
    pumpBakes();
    if (this.sheet.destroyed || this.sheet !== sheets.get(this.key)) { const cur = sheets.get(this.key); if (cur && !cur.destroyed) this.rebuild(cur); }
    const flags = s.flags;
    const frozen = (flags & F_FROZEN) !== 0;
    const chill = (flags & F_CHILL) !== 0;
    const k = frozen ? 0 : chill ? 0.6 : 1;
    const adt = dt * k;
    this.t += adt;
    const t = this.t;
    const n = this.n;
    const p = this.p;
    const rest = REST[this.wk];

    // facing flip (quick paper turn)
    const tf = s.facingLeft ? -1 : 1;
    this.face += (tf - this.face) * damp(28, dt);
    if (Math.abs(tf - this.face) < 0.02) this.face = tf;

    // attack trigger
    if (s.attackSeq !== this.lastSeq) {
      if (this.lastSeq >= 0) { this.atkT = 0; this.atkDur = clamp(0.95 / Math.max(0.4, s.aps), 0.22, 0.85); }
      this.lastSeq = s.attackSeq;
    }
    this.atkT += adt;

    const moving = s.moving && !frozen;
    const speed = Math.hypot(s.vx, s.vy);
    this.moveBlend += ((moving ? 1 : 0) - this.moveBlend) * damp(12, dt);
    const stepRate = 8 * clamp(speed / 250, 0.6, 1.5);
    if (moving) this.walk += adt * stepRate * Math.PI;
    const chanOn = (flags & F_CHANNEL) !== 0;
    this.chan += ((chanOn ? 1 : 0) - this.chan) * damp(chanOn ? 14 : 8, dt);
    if (this.chan > 0.01) this.spin += adt * TAU * 2.4 * Math.max(0.3, this.chan);
    this.castB += (((flags & F_CAST) ? 1 : 0) - this.castB) * damp(14, dt);
    this.dashB += (((flags & F_DASH) ? 1 : 0) - this.dashB) * damp(20, dt);
    this.hitK = Math.max(0, this.hitK - dt * 6);

    const m = this.moveBlend;
    const breath = Math.sin(t * TAU / 1.6);
    const sw = Math.sin(this.walk);
    const bob = Math.abs(Math.sin(this.walk)) * 2 * m;

    // ── base pose: idle + walk
    let armF = rest[0] + breath * 0.035 - sw * 0.3 * m;
    let armB = rest[2] - breath * 0.035 + sw * 0.38 * m;
    let wpn = rest[1];
    let legF = sw * 0.44 * m;
    let legB = -sw * 0.44 * m;
    let chestRot = 0.05 * m;
    let chestY = HIP_Y - bob + breath * -0.45 * (1 - m);
    let headRot = breath * 0.025 + Math.sin(this.walk * 2) * 0.02 * m;
    let bodyRot = 0;
    let sx = 1, sy = 1 + breath * 0.012 * (1 - m);
    let trailA = 0;
    let pull = 0;

    // ── attack overlay
    const u = this.atkT / this.atkDur;
    if (u < 1) {
      const wk = this.wk;
      if (wk === '1h' || wk === '2h' || wk === 'none') {
        const big = wk === '2h';
        const wind = big ? -3.95 : -3.55;
        const strike = big ? -0.25 : -0.55;
        let a: number, wr: number;
        // blade world angle = arm + weapon: rest ≈ up-forward, wind-up ≈ back-down behind the head,
        // strike end ≈ forward-down, so the blade sweeps up and over in one arc
        const wW = big ? 1.75 : 1.65, wS = big ? 2.65 : 2.75;
        if (u < 0.35) { const e = easeOut(u / 0.35); a = lerp(rest[0], wind, e); wr = lerp(rest[1], wW, e); chestRot = lerp(chestRot, -0.12, e); }
        else if (u < 0.55) { const e = easeIn((u - 0.35) / 0.2); a = lerp(wind, strike, e); wr = lerp(wW, wS, e); chestRot = lerp(-0.12, 0.2, e); trailA = 1; }
        else { const e = easeInOut((u - 0.55) / 0.45); a = lerp(strike, rest[0], e); wr = lerp(wS, rest[1], e); chestRot = lerp(0.2, chestRot, e); trailA = 1 - e * 1.6; }
        armF = a; wpn = wr;
        armB = lerp(armB, 0.5, Math.sin(u * Math.PI));
        legF = lerp(legF, -0.25, Math.sin(u * Math.PI) * (1 - m));
        legB = lerp(legB, 0.22, Math.sin(u * Math.PI) * (1 - m));
      } else if (wk === 'bow') {
        if (u < 0.55) { const e = easeOut3(u / 0.55); armF = lerp(rest[0], -1.52, e); wpn = lerp(rest[1], 1.52, e); armB = lerp(rest[2], -1.25, e); pull = e; chestRot = lerp(chestRot, -0.05, e); }
        else { const e = easeOut((u - 0.55) / 0.45); armF = lerp(-1.52, rest[0], easeInOut(e)); wpn = lerp(1.52, rest[1], easeInOut(e)); armB = lerp(-0.6, rest[2], e); pull = 0; chestRot = lerp(0.04, chestRot, e); }
      } else if (wk === 'xbow' || wk === 'hxbow') {
        const aim = -1.5, aw = Math.PI / 2 + 1.5;
        if (u < 0.4) { const e = easeOut3(u / 0.4); armF = lerp(rest[0], aim, e); wpn = lerp(rest[1], aw, e); armB = lerp(rest[2], -1.2, e); }
        else { const e = (u - 0.4) / 0.6; const kick = Math.exp(-e * 7) * Math.sin(e * 12) * 0.35; armF = lerp(aim, rest[0], easeInOut(e)) - kick; wpn = lerp(aw, rest[1], easeInOut(e)) - kick * 0.6; armB = lerp(-1.2, rest[2], e); chestRot -= kick * 0.3; }
      } else if (wk === 'staff') {
        if (u < 0.4) { const e = easeOut(u / 0.4); armF = lerp(rest[0], -2.6, e); wpn = lerp(rest[1], 2.6, e); sy += 0.03 * e; armB = lerp(rest[2], -0.9, e); }
        else if (u < 0.6) { const e = easeIn((u - 0.4) / 0.2); armF = lerp(-2.6, -1.3, e); wpn = lerp(2.6, 1.95, e); chestRot = lerp(chestRot, 0.16, e); armB = lerp(-0.9, 0.5, e); }
        else { const e = easeInOut((u - 0.6) / 0.4); armF = lerp(-1.3, rest[0], e); wpn = lerp(1.95, rest[1], e); chestRot = lerp(0.16, chestRot, e); armB = lerp(0.5, rest[2], e); }
      } else if (wk === 'wand') {
        if (u < 0.35) { const e = easeOut(u / 0.35); armF = lerp(rest[0], -2.5, e); wpn = lerp(rest[1], 1.6, e); }
        else if (u < 0.55) { const e = easeIn((u - 0.35) / 0.2); armF = lerp(-2.5, -1.35, e); wpn = lerp(1.6, 1.0, e); chestRot = lerp(chestRot, 0.1, e); }
        else { const e = easeInOut((u - 0.55) / 0.45); armF = lerp(-1.35, rest[0], e); wpn = lerp(1.0, rest[1], e); }
        armB = lerp(armB, -0.4, Math.sin(clamp(u) * Math.PI));
      }
    }

    // ── cast: arms up
    if (this.castB > 0.01) {
      const c = this.castB;
      armF = lerp(armF, -2.75, c); armB = lerp(armB, -2.55, c);
      wpn = lerp(wpn, 2.7, c);
      sy += 0.04 * c; chestY -= 1.2 * c;
    }

    // ── whirlwind
    if (this.chan > 0.01) {
      const c = this.chan;
      armF = lerp(armF, -1.62, c); armB = lerp(armB, 1.5, c);
      wpn = lerp(wpn, Math.PI * 0.92, c);
      legF = lerp(legF, -0.3, c); legB = lerp(legB, 0.3, c);
      chestRot = lerp(chestRot, 0, c);
      sx = lerp(1, Math.cos(this.spin) >= 0 ? Math.max(0.12, Math.cos(this.spin)) : Math.min(-0.12, Math.cos(this.spin)), c);
      chestY -= 1.5 * c;
    }

    // ── dash lean
    if (this.dashB > 0.01) {
      const c = this.dashB;
      bodyRot = lerp(bodyRot, 0.26, c);
      legF = lerp(legF, -0.7, c); legB = lerp(legB, 0.8, c);
      armF = lerp(armF, 0.9, c * 0.6); armB = lerp(armB, 1.1, c);
      sx *= 1 + 0.08 * c;
    }

    // ── stun / frozen
    const stunned = (flags & F_STUN) !== 0;
    if (stunned) { headRot += Math.sin(t * 7) * 0.12; armF = lerp(armF, 0.2, 0.6); armB = lerp(armB, 0.3, 0.6); chestRot += 0.1; }

    // ── hit squash
    const hk = this.hitK;
    sx *= 1 + 0.08 * hk;
    const bsy = (1 - 0.08 * hk) * (1 - 0.06 * this.dashB);

    // ── dead / dying
    const deadFlag = (flags & F_DEAD) !== 0;
    // done() may destroy this view synchronously, so it is only ever called as the very last statement
    let finish: (() => void) | null = null;
    if (this.dying) {
      this.deathT += dt;
      const e = easeOut3(clamp(this.deathT / 0.45));
      this.deadPose = e;
      p.body.alpha = 1 - clamp((this.deathT - 0.25) / 0.35);
      if (this.deathT >= 0.6 && this.deathDone) { finish = this.deathDone; this.deathDone = null; }
    } else if (deadFlag) {
      this.deadPose += (1 - this.deadPose) * damp(10, dt);
      p.body.alpha = 0.55;
    } else {
      this.deadPose += (0 - this.deadPose) * damp(12, dt);
      p.body.alpha = 1;
    }
    if (this.deadPose > 0.001) {
      const d = this.deadPose;
      bodyRot = lerp(bodyRot, -1.45, d);
      armF = lerp(armF, -2.4, d); armB = lerp(armB, -2.2, d); legF = lerp(legF, -0.3, d); legB = lerp(legB, -0.1, d);
    }

    // ── apply
    n.legF!.rot = legF; n.legB!.rot = legB;
    n.chest!.set(0, chestY, chestRot);
    n.chest!.c.scale.set(1, sy);
    n.head!.rot = headRot;
    if (n.hairB) n.hairB.rot = headRot + Math.sin(t * 2.2) * 0.03 + sw * 0.04 * m;
    if (n.cape) n.cape.rot = Math.max(-0.1, sw * 0.03 * m - this.dashB * 0.2 + Math.sin(t * 2) * 0.01);
    n.armF!.rot = armF; n.armB!.rot = armB;
    if (n.weapon) n.weapon.rot = wpn;
    // off-hand follows the back hand but draws in front of the torso
    if (n.off) {
      const h = rot(0, ARM_LEN, armB);
      const orb = this.look.slots.offhand?.shape === 'orb';
      if (orb) n.off.set(SH_B.x + h.x - 5.5, SH_B.y + h.y - 7 + Math.sin(t * 2.4) * 1.6, 0);
      else { n.off.set(SH_B.x + h.x - 7.4, SH_B.y + h.y - 4.2, armB * 0.25); n.off.c.scale.set(0.9); }
    }
    p.body.rotation = bodyRot;
    p.body.y = 0;
    const flip = Math.abs(this.face) < 0.15 ? Math.sign(this.face || 1) * 0.15 : this.face;
    p.body.scale.set(flip * sx, bsy);

    // blink
    this.blinkT -= adt;
    if (this.blinkT < 0) this.blinkT = 2.2 + Math.random() * 3.2;
    const blink = this.blinkT < 0.12 || stunned;
    n.eyes!.c.scale.y = blink ? 0.15 : 1;
    n.eyes!.c.pivot.y = blink ? HEAD.y + 2.4 : 0;
    n.eyes!.c.y = blink ? HEAD.y + 2.4 : 0;

    // bow string
    if (this.string && n.weapon) {
      const g = this.string;
      g.clear();
      let px = -2.4, py = 0;
      if (pull > 0) {
        // back hand position in weapon space
        const hb = rot(0, ARM_LEN, armB);
        const P = { x: SH_B.x + hb.x - SH_F.x, y: SH_B.y + hb.y - SH_F.y };
        const a1 = rot(P.x, P.y, -armF);
        const w = rot(a1.x, a1.y - ARM_LEN, -wpn);
        px = lerp(-2.4, w.x, pull); py = lerp(0, w.y, pull);
      }
      g.moveTo(-2.4, -21).lineTo(px, py).lineTo(-2.4, 21).stroke({ width: 2.2, color: OUT, alpha: 0.55, cap: 'round', join: 'round' });
      g.moveTo(-2.4, -21).lineTo(px, py).lineTo(-2.4, 21).stroke({ width: 0.9, color: 0xd9ccae, cap: 'round', join: 'round' });
      if (pull > 0.2) {
        // nocked arrow pointing along the bow's forward axis (+x in weapon space)
        g.moveTo(px, py).lineTo(px + 26, py).stroke({ width: 3, color: OUT, cap: 'round' });
        g.moveTo(px, py).lineTo(px + 26, py).stroke({ width: 1.4, color: 0xb08856, cap: 'round' });
        g.poly([px + 25, py - 2.2, px + 30, py, px + 25, py + 2.2], true).fill(0xd8dde2).stroke({ width: 1, color: OUT });
        g.poly([px - 1, py, px + 4, py - 2.6, px + 5, py], true).fill(0xd8463a);
      }
    }

    // trail / whirl / fx
    if (this.trail) {
      this.trail.alpha = clamp(trailA) * 0.8;
      if (trailA > 0) { const b = armF + wpn; this.trail.rotation = Math.atan2(-Math.cos(b), Math.sin(b)) - Math.PI / 3 + chestRot; }
      this.trail.y = chestY + SH_F.y;
    }
    for (let i = 0; i < this.whirl.length; i++) {
      const s = this.whirl[i];
      // back arc sweeps the far half (top of the ellipse), front arc the near half
      const a = this.spin * 1.0 * Math.sign(this.face || 1);
      s.rotation = i === 0 ? a : a + Math.PI;
      const near = Math.sin(s.rotation + Math.PI / 6) > 0;
      s.alpha = this.chan * (i === 0 ? (near ? 0.25 : 0.6) : (near ? 0.8 : 0.3));
    }
    this.updateGlows(t, s);
    this.updateStatus(t, flags, stunned);

    // tints
    let tint = 0xffffff;
    if (frozen) tint = 0x8fd0ff;
    else if (chill) tint = 0xc4e4ff;
    else if (flags & F_POISON) tint = 0xd2f0b8;
    p.body.tint = tint;
    p.sync(performance.now());
    if (finish) finish();
  }

  private updateGlows(t: number, s: ViewState): void {
    for (const g of this.glows) g.sprite.alpha = g.base * (0.8 + 0.25 * Math.sin(t * 2.6 + g.phase));
    for (const w of this.twinkles) {
      if (w.r === 0) { const k = 0.5 + 0.5 * Math.sin(t * w.speed * 2); w.s.alpha = 0.3 + 0.6 * k; w.s.rotation = t * 0.8; w.s.scale.set(0.09 + 0.09 * k); continue; }
      const cyc = (t * w.speed * 0.35 + w.phase / TAU) % 1;
      if (cyc < 0.02 || w.s.alpha <= 0.001) {
        // respawn at a new spot (rising motes start on the silhouette edge, never over the face)
        const a = w.rise ? (Math.random() < 0.5 ? Math.PI : 0) + (Math.random() - 0.5) * 0.9 : Math.random() * TAU;
        const rr = w.rise ? w.r * (0.8 + Math.random() * 0.3) : w.r * Math.sqrt(Math.random());
        w.s.position.set(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr * 0.8 + (w.rise ? 10 : 0));
      }
      const k = Math.sin(cyc * Math.PI);
      w.s.alpha = k * 0.9;
      w.s.scale.set((w.rise ? 0.1 : 0.13) * (0.5 + k));
      if (w.rise) w.s.y -= 0.35;
    }
    void s;
  }

  private updateStatus(t: number, flags: number, stunned: boolean): void {
    if (stunned && !this.stars.length) {
      for (let i = 0; i < 3; i++) { const st = new Sprite(fx().star5); st.anchor.set(0.5); st.scale.set(0.42); st.tint = 0xffe066; this.p.over.addChild(st); this.stars.push(st); }
    }
    if (this.stars.length) {
      for (let i = 0; i < this.stars.length; i++) {
        const st = this.stars[i];
        st.visible = stunned;
        const a = t * 4 + (i * TAU) / 3;
        st.position.set(Math.cos(a) * 11, -this.height + 2 + Math.sin(a) * 3);
        st.rotation = t * 3;
      }
    }
    const sh = (flags & F_SHIELD) !== 0;
    if (sh && !this.bubble) { this.bubble = glowSprite(0x8fd8ff, 90, 0.3, true); this.bubble.position.set(0, -32); this.p.over.addChild(this.bubble); }
    if (this.bubble) { this.bubble.visible = sh; this.bubble.alpha = 0.22 + 0.06 * Math.sin(t * 4); }
  }

  hit(intensity: number, crit: boolean): void {
    if (this.destroyed) return;
    this.p.flash(performance.now(), crit ? 90 : 70);
    this.hitK = Math.max(this.hitK, 0.6 + 0.4 * clamp(intensity));
  }

  die(_element: number, done: () => void): void {
    if (this.dying || this.destroyed) return;
    this.dying = true;
    this.deathT = 0;
    this.deathDone = done;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.deathDone = null;
    this.p.destroy();
    this.root.destroy({ children: true });
    releaseSheet(this.key);
  }
}
