// Hero view: a turntable cut-out rig. The hero has a continuous yaw (0 = facing the camera, +90 = profile
// facing right, 180 = back); turning is a rotation, not a mirror flip:
//   • head  — baked at 24 yaws (heroParts.ts); eyes / brows / mouth are live overlays placed on the same
//             sphere, so they slide round the head, blink and emote. The head leads the body by ~40 ms.
//   • torso — symmetric volume + front / back detail sprites that slide across the body cylinder.
//   • legs  — baked at 7 yaws, swung in the sagittal plane and projected.
//   • arms, hands, weapons, shields, orbs, pads, capes, quivers, hair tails — placed from a body-local 3D
//     pose (choreo.ts) and depth-sorted every frame, so near / far limbs and the weapon swap sides mid-turn.
// Skills are choreographed in choreo.ts; weapon trails are ribbons sampled along the real tip path.

import { Container, Graphics, Matrix, Sprite, Texture } from 'pixi.js';
import { gearEffectLevel, preferences } from '../../game/preferences';
import { gearProfile, type GearProfile } from '@shared/gearVisual';
import { LEGENDARIES } from '@shared/data/items';
import { GEAR_TIER_COLORS } from '@shared/gearVisual';
import { GearFx, dominantColor, profileMotif, type GearQuality } from './gearFx';
import { backPieceFor, drawBackPiece, drawWing, shoulderScale, weaponScale } from './gearDecor';
import { SET_STYLE, itemStyle } from './gearStyle';
import {
  F_CAST, F_CHANNEL, F_CHILL, F_DASH, F_DEAD, F_FROZEN, F_POISON, F_SHIELD, F_STUN, type LookSlot, type PlayerLook,
} from '@shared/protocol';
import type { ItemLook } from '@shared/types';
import { ACTIONS, type ActionDef, type ActionSpec } from '../actions';
import type { PlayerView, ViewState } from '../types';
import { Sheet, bakeSheet, type PartSpec } from './bake';
import {
  ARM, HEAD_Y, LEVEL_UP, SH, SPIN_RATE, actionLife, actionPose, basePose, copyPose, levelUpPose, newPose, reachOf, spinPose,
  type ActCtx, type Kit, type Pose, type V3, type WeaponKind,
} from './choreo';
import { OUT } from './draw';
import { fx, getRenderer, glowSprite, ringSprite, shadowSprite, sparkleSprite } from './fx';
import {
  classBody, drawArm, drawHand, drawNpcOffhand, drawOrb, drawQuiver, drawShield, drawShoulder, drawWeapon, isTwoHandedMelee, type Body,
} from './gear';
import {
  HEAD_FLASH_VIEWS, HEAD_R, HEAD_VIEWS, LEG_VIEWS, drawArrow, drawBeltFront, drawBrow, drawCapeBack, drawEye, drawHairCurtain,
  drawHairTail, drawHeadView, drawLegView, drawMallet, drawMouth, drawNote, drawRune, drawShieldBack, drawTorsoBack, drawTorsoBase,
  drawTorsoFront, sph,
} from './heroParts';
import { GLOW_SET } from './palette';
import { bakeRes } from './scale';
import { Ribbon } from './trail';
import { TAU, clamp, damp, easeOut, easeOut3, lerp, light, mix } from './util';

const D2R = Math.PI / 180;
/** Depth tilt: how far a body-attached point / a limb offset moves down the screen per unit towards the camera. */
const KB = 0.12, KL = 0.34;
const HIP = -12;

// ─────────────────────────── sheet cache ───────────────────────────

/** How a view's sheet is produced:
 *  - 'portable': canvas-backed pages usable from any Pixi renderer (class-select / showcase previews, galleries);
 *  - 'scene':    GPU render-target pages of the main renderer (in-game heroes: no GPU→CPU readback);
 *  - 'npc':      like 'scene' at a lower density without hit-flash versions, baked at once (town residents). */
export type BakeMode = 'portable' | 'scene' | 'npc';

/** One look at one density: its finished sheet (or the live vector fallback) and the remaining bake work. */
interface Entry {
  key: string; look: PlayerLook; mode: BakeMode; res: number; refs: number;
  /** Finished (or live-fallback) sheet; null while a 'scene' look is still baking (views show an interim sheet). */
  sheet: Sheet | null;
  /** Remaining bake work; specs are created when the bake starts (cheap acquire for a crowd walking in). */
  work: { specs: PartSpec[] | null; next: number; acc: Sheet } | null;
}
const entries = new Map<string, Entry>();
const idle: string[] = [];
/** Looks waiting to be baked, front first. */
const queue: Entry[] = [];

/** Townsfolk looks carry their own body (hair, skin, beard, face accessory); heroes derive it from class + appearance. */
export type NpcBodyLook = PlayerLook & { npc?: Omit<Body, 'cls'> };
/** Off-hand props townsfolk hold in the left hand (drawn by drawNpcOffhand, placed like an orb). */
export const NPC_OFFHAND = new Set(['book', 'mug', 'lantern', 'lute', 'flag', 'slate', 'basket', 'gem', 'tin', 'scroll']);
const POLE_TOOLS = new Set(['spear', 'broom', 'rod', 'pole', 'poker', 'rake']);

function bodyOf(look: PlayerLook): Body {
  const npc = (look as NpcBodyLook).npc;
  return npc ? { cls: look.classId, ...npc } : classBody(look.classId, look.appearance);
}

function lookKey(look: PlayerLook): string {
  const parts: string[] = [look.classId,JSON.stringify(look.appearance??null),JSON.stringify((look as NpcBodyLook).npc??null)];
  for (const k of Object.keys(look.slots).sort()) {
    const l = look.slots[k as LookSlot]!;
    parts.push(`${k}:${l.shape}:${l.primary}:${l.secondary}:${l.glow}:${l.variant}:${l.fx ?? ''}`);
  }
  if (look.jw) parts.push(JSON.stringify(look.jw));
  return parts.join('|');
}

/** The back piece a look earns (cloth cape / mantle, or motif wings) and its colours. */
function backOf(look: PlayerLook) {
  const hasFx = Object.values(look.slots).some((l) => typeof l?.fx === 'number');
  const p = hasFx ? gearProfile(look) : null;
  const kind = p ? backPieceFor(p.rank, p.topSetCount, p.primals) : 'none';
  const chest = look.slots.chest;
  const cs = itemStyle(chest);
  const set = p?.topSet && p.topSetCount >= 4 ? SET_STYLE[p.topSet] : undefined;
  const motif = p ? profileMotif(look, p) : null;
  const accent = p ? dominantColor(look, p) : 0xffffff;
  return {
    kind, tier: p?.rank ?? 0, accent, motif: motif === 'primal' ? 'ember' as const : motif,
    primary: chest?.primary ?? 0x6a4a3a, metal: cs?.metal ?? GEAR_TIER_COLORS[p?.rank ?? 0],
    deep: p?.primals ? 0x6a1410 : set?.deep ?? 0x3a2a1c,
    primal: (p?.primals ?? 0) > 0,
    // a full Set keeps its wing silhouette even when Primal (recoloured crimson); Primal without a Set gets flame wings
    wing: (set && p!.topSetCount >= 6 ? set.motif : p?.primals ? 'primal' : motif && motif !== 'primal' && ['wind', 'star', 'ember', 'stone', 'feather', 'rain', 'shard', 'lantern', 'flame', 'cog'].includes(motif) ? motif : 'light') as Parameters<typeof drawWing>[1],
    // Ancient heroes get amber-edged wings (the deep tone of the wing gradient)
    ancient: (p?.ancients ?? 0) >= 2,
    /** Wing drawing scale (span ≥ 2.2× body width at rank 8, ≥ 2.6× with a Primal; measured in LOG.md). */
    wingK: !p ? 1.5 : p.primals ? 1.5 * 1.72 : p.rank >= 8 ? 1.5 * 1.32 : 1.5 * 1.08,
    backK: !p ? 1 : 1 + 0.14 * Math.max(0, p.rank - 6),
  };
}

/** Every part a look needs (names must match the rig below). */
export function playerParts(look: PlayerLook, body: Body = bodyOf(look)): PartSpec[] {
  const sl = look.slots;
  const specs: PartSpec[] = [];
  const add = (name: string, draw: PartSpec['draw'], flash = true) => specs.push({ name, draw, flash });
  for (const deg of HEAD_VIEWS) add(`head@${deg}`, (c) => drawHeadView(c, body, sl.head, deg), HEAD_FLASH_VIEWS.includes(deg));
  for (const deg of LEG_VIEWS) add(`leg@${deg}`, (c) => drawLegView(c, body, sl.legs, sl.feet, deg));
  add('torso', (c) => drawTorsoBase(c, body, sl.chest, sl.waist));
  const neck = look.jw?.neck;
  const neckLeg = neck ? (neck >>> 14) & 31 : 0;
  const neckColor = neckLeg ? Object.values(LEGENDARIES)[neckLeg - 1].colors.glow : GEAR_TIER_COLORS[(neck ?? 0) & 15];
  add('torsoF', (c) => drawTorsoFront(c, body, sl.chest, neck, neckColor));
  add('torsoB', (c) => drawTorsoBack(c, body, sl.chest));
  if (sl.waist) add('belt', (c) => drawBeltFront(c, sl.waist!, sl.chest?.shape === 'robe'));
  add('arm', (c) => drawArm(c, body, sl.chest, false));
  add('hand', (c) => drawHand(c, body, sl.hands, false));
  const back = backOf(look);
  if (sl.shoulders) {
    add('pad', (c) => drawShoulder(c, sl.shoulders!, false));
    if (sl.shoulders.shape === 'mantle' && back.kind !== 'cape' && back.kind !== 'mantle') add('cape', (c) => drawCapeBack(c, sl.shoulders!));
  }
  // presence by rank (spectacle pass): baked at their final size so they stay crisp
  if (back.kind === 'cape' || back.kind === 'mantle') add('back', (c) => drawBackPiece(c, back.kind as 'cape' | 'mantle', back.primary, back.metal, back.accent, back.motif, back.tier, back.backK));
  if (back.kind === 'wings') add('wing', (c) => drawWing(c, back.wing, back.accent, back.primal ? back.deep : back.ancient ? 0xb8661a : back.deep, back.wingK));
  const probe = new Graphics();
  if (drawHairTail(probe.context, body, sl.head)) add('tail', (c) => { drawHairTail(c, body, sl.head); });
  if (drawHairCurtain(probe.context, body, sl.head)) add('curtain', (c) => { drawHairCurtain(c, body, sl.head); });
  probe.destroy();
  if (sl.mainhand) add('weapon', (c) => drawWeapon(c, sl.mainhand!, true));
  const off = sl.offhand;
  if (off) {
    if (off.shape === 'quiver') add('quiver', (c) => drawQuiver(c, off));
    else if (off.shape === 'orb') add('orb', (c) => drawOrb(c, off));
    else if (NPC_OFFHAND.has(off.shape)) add('orb', (c) => drawNpcOffhand(c, off));
    else { add('shield', (c) => drawShield(c, off)); add('shieldBack', (c) => drawShieldBack(c, off)); }
  }
  add('eye', (c) => drawEye(c, body.eyes));
  add('mouthO', (c) => drawMouth(c, 0), false);
  add('mouthR', (c) => drawMouth(c, 1), false);
  add('brow', (c) => drawBrow(c), false);
  return specs;
}

/** Shared glyph sheet (arrows, mallet, notes, runes): baked once. */
let fxSheet: Sheet | null = null;
function heroFx(): Sheet {
  if (fxSheet && !fxSheet.destroyed && !fxSheet.live) return fxSheet;
  const specs: PartSpec[] = [
    { name: 'arrow', draw: (c) => drawArrow(c) },
    { name: 'mallet', draw: (c) => drawMallet(c), flash: true },
    { name: 'note', draw: (c) => drawNote(c) },
  ];
  for (let i = 0; i < 4; i++) specs.push({ name: `rune${i}`, draw: (c) => drawRune(c, i) });
  fxSheet = bakeSheet(specs, 3, 512, 'hero:fx');
  return fxSheet;
}

/** Dev gallery: bake a look's sheet right now (contact sheets render the baked art, not the live fallback). */
export function bakePlayerLook(look: PlayerLook): void {
  const res = bakeRes(3, 6);
  const key = `${lookKey(look)}@${res}`;
  const e = entries.get(key) ?? newEntry(key, look, 'portable', res);
  if (e.sheet && !e.sheet.destroyed && !e.sheet.live && !e.work) return;
  const old = e.sheet;
  e.sheet = bakeSheet(playerParts(look), res, 2048, `player:${look.classId}`);
  dropWork(e);
  if (old && old !== e.sheet) setTimeout(() => old.destroy(), 4000);
}

/** Bake cost counters (dev HUD / perf notes). */
export const bakeStats = { acquireMs: 0, acquires: 0, pumpMs: 0, chunks: 0, maxPumpMs: 0, maxFrameMs: 0, pending: 0 };

/** Dev gallery: no random blinks / glances (contact sheets must be reproducible). */
export const artDebug = { deterministic: false };

const prefixOf = (m: BakeMode) => (m === 'npc' ? 'gpu:' : m === 'scene' ? 'scn:' : '');
const resOf = (m: BakeMode) => bakeRes(m === 'npc' ? 2 : 3, 6);
const weightOf = (s: PartSpec) => (s.name.startsWith('head@') ? (s.flash ? 2 : 1) : 0.25);
/** Per-frame bake budget (ms): a crowd walking into view spreads its bakes over frames instead of stalling. */
export const BAKE_BUDGET_MS = 4;
/** Measured cost per weight unit (EMA), so chunks are sized to fit the budget. */
let msPerWeight = 1.5;
let lastPump = 0;

function newEntry(key: string, look: PlayerLook, mode: BakeMode, res: number): Entry {
  const e: Entry = { key, look, mode, res, refs: 0, sheet: null, work: null };
  entries.set(key, e);
  return e;
}
function dropWork(e: Entry): void {
  if (e.work) { e.work.acc.destroy(); e.work = null; }
  const i = queue.indexOf(e);
  if (i >= 0) queue.splice(i, 1);
}
function specsFor(look: PlayerLook, mode: BakeMode): PartSpec[] {
  const specs = playerParts(look);
  if (mode === 'npc') for (const spec of specs) { spec.flash = false; spec.rim = false; }
  return specs;
}

/** Bake queued looks within BAKE_BUDGET_MS per frame. Chunks are sized from the measured cost per part weight;
 *  every finished look swaps in on the next update of the views that wear it. */
function pumpBakes(): void {
  // once per rendered frame: every view calls this from update(); the frame's timestamp is shared by all of them
  const frame = (typeof document !== 'undefined' ? Number(document.timeline?.currentTime ?? 0) : 0) || performance.now();
  if (frame === lastPump || !getRenderer()) return;
  lastPump = frame;
  let frameMs = 0;
  while (queue.length) {
    const e = queue[0];
    if (!e.work || e.refs <= 0) { queue.shift(); if (e.refs <= 0) { dropWork(e); if (!e.sheet) entries.delete(e.key); } continue; }
    // class placeholders unblock every waiting hero: they get a larger budget (once per class per session)
    const left = (e.key.startsWith('ph:') ? BAKE_BUDGET_MS * 3 : BAKE_BUDGET_MS) - frameMs;
    if (left <= 0.3) break;
    const w = e.work, chunk: PartSpec[] = [];
    const specs = w.specs ??= specsFor(e.look, e.mode);
    let weight = 0;
    while (w.next < specs.length) {
      const sp = specs[w.next], sw = weightOf(sp);
      if (chunk.length && (weight + sw) * msPerWeight > left) break;
      chunk.push(sp); weight += sw; w.next++;
    }
    const t0 = performance.now();
    w.acc.absorb(bakeSheet(chunk, e.res, 2048, `player:${e.look.classId}`, false, e.mode !== 'portable'));
    const dt = performance.now() - t0;
    frameMs += dt;
    // EMA of the cost per weight unit; one-off outliers (first shader compile) are clamped
    msPerWeight = Math.max(0.05, msPerWeight * 0.7 + Math.min(4, dt / Math.max(0.25, weight)) * 0.3);
    bakeStats.pumpMs += dt; bakeStats.chunks++; bakeStats.maxPumpMs = Math.max(bakeStats.maxPumpMs, dt);
    if (w.next >= specs.length) {
      queue.shift();
      const old = e.sheet;
      e.sheet = w.acc; e.work = null;
      if (old && old !== e.sheet) setTimeout(() => old.destroy(), 4000);
    }
  }
  bakeStats.maxFrameMs = Math.max(bakeStats.maxFrameMs, frameMs);
  bakeStats.pending = queue.length;
}

function acquireEntry(look: PlayerLook, mode: BakeMode, urgent = false): Entry {
  const res = resOf(mode);
  const key = `${prefixOf(mode)}${lookKey(look)}@${res}`;
  let e = entries.get(key);
  if (!e || (e.sheet?.destroyed && !e.work)) {
    const t0 = performance.now();
    e = newEntry(key, look, mode, res);
    if (mode === 'npc' || !getRenderer()) {
      // town residents bake at once (town load); without a renderer (tests, early boot) parts are live vectors
      e.sheet = bakeSheet(specsFor(look, mode), res, 2048, `player:${look.classId}`, mode !== 'npc', mode === 'npc');
      if (e.sheet.live) { e.work = { specs: null, next: 0, acc: new Sheet() }; queue.push(e); }
    } else {
      // portable views (previews, galleries) show live vector parts until baked; scene views show an interim sheet
      if (mode === 'portable') e.sheet = bakeSheet(specsFor(look, mode), res, 2048, `player:${look.classId}`, true, false);
      e.work = { specs: null, next: 0, acc: new Sheet() };
      if (urgent) queue.unshift(e); else queue.push(e);
    }
    bakeStats.acquireMs += performance.now() - t0; bakeStats.acquires++;
  } else if (e.work && urgent) { const i = queue.indexOf(e); if (i > 0) { queue.splice(i, 1); queue.unshift(e); } }
  const i = idle.indexOf(key);
  if (i >= 0) idle.splice(i, 1);
  e.refs++;
  return e;
}

function releaseEntry(key: string): void {
  const e = entries.get(key);
  if (!e) return;
  e.refs--;
  if (e.refs > 0) return;
  if (!e.sheet) { dropWork(e); entries.delete(key); return; }   // never finished: nothing worth keeping
  idle.push(key);
  while (idle.length > 10) {
    const k = idle.shift()!;
    const x = entries.get(k);
    if (x && x.refs <= 0) { dropWork(x); x.sheet?.destroy(); entries.delete(k); }
  }
}

/** A class's bare look (no gear, default appearance): what a brand-new scene view shows for the few frames
 *  before its own sheet is baked. Live vector parts shared by every waiting hero, then baked like any look. */
function placeholderSheet(classId: PlayerLook['classId'], mode: BakeMode): Sheet {
  const e = acquirePlaceholder(classId, mode);
  return e.sheet!;
}
const placeholders = new Map<string, Entry>();
function acquirePlaceholder(classId: PlayerLook['classId'], mode: BakeMode): Entry {
  const res = resOf(mode);
  const key = `ph:${mode}:${classId}@${res}`;
  let e = placeholders.get(key);
  if (!e || !e.sheet || e.sheet.destroyed) {
    const look: PlayerLook = { classId, slots: {} };
    e = { key, look, mode, res, refs: 1e9, sheet: bakeSheet(specsFor(look, mode), res, 2048, `player:${classId}`, true, false), work: null };
    e.work = { specs: null, next: 0, acc: new Sheet() };
    queue.unshift(e);
    placeholders.set(key, e);
  }
  return e;
}

// ─────────────────────────── helpers ───────────────────────────

function weaponKind(shape: string | undefined): WeaponKind {
  if (!shape) return 'none';
  if (isTwoHandedMelee(shape)) return '2h';
  if (shape === 'bow') return 'bow';
  if (shape === 'crossbow') return 'xbow';
  if (shape === 'handxbow') return 'hxbow';
  if (shape === 'staff' || POLE_TOOLS.has(shape)) return 'staff';
  if (shape === 'wand') return 'wand';
  return '1h';
}

const wrapDeg = (a: number) => { a = ((a + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };

/** Facing yaw for a screen direction (dx, dy; +dy = towards the camera). Sideways ±65°, down ±20°, up ±158°. */
function facingYaw(dx: number, dy: number, side: number): number {
  const l = Math.hypot(dx, dy);
  if (l < 1e-3) return NaN;
  const ux = dx / l, uy = dy / l;
  const sd = Math.abs(ux) > 0.14 ? Math.sign(ux) : side;
  const base = uy >= 0 ? lerp(65, 20, uy) : lerp(65, 158, -uy);
  return sd * base;
}

/** Critically damped spring step (implicit), returns [x, v]. */
function spring(x: number, v: number, target: number, w: number, dt: number): [number, number] {
  const f = 1 + 2 * dt * w, oo = w * w, hoo = dt * oo, hhoo = dt * hoo;
  const inv = 1 / (f + hhoo);
  return [(f * x + dt * v + hhoo * target) * inv, (v + hoo * (target - x)) * inv];
}

function nearest(list: number[], v: number): number {
  let best = list[0], bd = 1e9;
  for (const x of list) { let d = Math.abs(x - v); if (d > 180) d = 360 - d; if (d < bd) { bd = d; best = x; } }
  return best;
}

interface P2 { x: number; y: number; d: number }
const p2 = (): P2 => ({ x: 0, y: 0, d: 0 });

interface GlowFx { sprite: Sprite; base: number; phase: number; slot: string }
interface Twinkle { s: Sprite; x: number; y: number; r: number; phase: number; speed: number; rise: boolean; color: number }
interface Act { def: ActionDef; skill: string; start: number; cycle: number; alt: boolean; tx: number; ty: number; primary: boolean; shots: number[]; fired: number; notes: number[] }
interface Fly { s: Sprite; streak: Sprite; vx: number; vy: number; t: number; life: number }
interface Note { s: Sprite; t: number; x: number; y: number }

const PRIMARY_POSES = new Set(['swing', 'shoot', 'flick']);
/** Non-directional skills (or their gather phase) turn the hero towards the camera so the whole-body pose
 *  reads: ms the hero presents before turning to the target. */
const PRESENT_MS: Record<string, number> = { roar: 1e9, empower: 1e9, whistle: 1e9, groundBurst: 1e9, callDown: 175 };
const presents = (pose: string, t: number) => t < (PRESENT_MS[pose] ?? -1);
const SPELL_POSES = new Set(['flick', 'callDown', 'thrust', 'groundBurst', 'summon', 'empower']);

// ─────────────────────────── view ───────────────────────────

export class PlayerArt implements PlayerView {
  readonly root = new Container();
  height = 66;

  private look!: PlayerLook;
  private key = '';
  private res = 3;
  private sheet!: Sheet;
  private entry: Entry | null = null;
  private mode: BakeMode;
  private kit: Kit = { wk: 'none', shield: false, orb: false, shape: '' };
  private reach = reachOf(undefined);

  // display
  private rig = new Container();
  private shadow = shadowSprite(34, 0.8);
  private under = new Container();
  private body = new Container();
  private over = new Container();
  /** Additive glows behind the hero (rarity auras, roar aura) and additive fx drawn last inside the body: keeps
   *  every hero at ≤ 3 batches when idle (glows | shadow + parts | fx + twinkles). */
  private glowBack = new Container();
  private fxAdd = new Container();
  private parts: Record<string, Sprite | Graphics> = {};
  private all: { obj: Sprite | Graphics; name: string }[] = [];
  private strings: Sprite[] = [];
  private nockArrow: Sprite | null = null;
  private mallet: Sprite | Graphics | null = null;
  private ribbonF = new Ribbon(22);
  private ribbonB = new Ribbon(22);
  private whirlRing: Sprite | null = null;
  private whirlDisc: Sprite | null = null;
  private glowR: Sprite | null = null;
  private glowL: Sprite | null = null;
  private glowTip: Sprite | null = null;
  private aura: Sprite | null = null;
  private swirl: Container | null = null;
  private runes: Sprite[] = [];
  private flies: Fly[] = [];
  private notes: Note[] = [];
  private muzzle: Sprite | null = null;
  private weaponGlow: Sprite | null = null;
  private tipSpark: Sprite | null = null;
  private glows: GlowFx[] = [];
  private twinkles: Twinkle[] = [];
  private stars: Sprite[] = [];
  private bubble: Sprite | null = null;
  // gear visual progression (gearFx.ts / gearDecor.ts)
  private gear: GearFx | null = null;
  private profile: GearProfile | null = null;
  private gearQ: GearQuality = 'full';
  private isLocal = false;
  private padK = 1;
  private wpnK = 1;
  private wingFlap = 0;
  /** Presence by gear rank (spectacle pass): wing span, cloth back-piece size, weapon-trail brightness. */
  private wingK = 1;
  private backK = 1;
  private trailBoost = 1;
  /** Rank-up celebration start (view time, s; < 0 none) and whether it is the big one (full Set / rank 8+). */
  private celebrateAt = -1;
  private celebrateBig = false;
  /** Seconds of "in combat" left (attacks, casts, hits): gear ground effects step back meanwhile. */
  private combatT = 0;

  // animation state
  private t = 0;
  private yawB = 65; private vB = 0;     // body yaw (deg) + velocity
  private yawH = 65; private vH = 0;     // head yaw
  private yawTarget = 65;
  private bodyTarget = 65;
  private bodyTargetAt = 0;
  private side = 1;
  private lastFacingLeft = false;
  private walk = 0;
  private moveBlend = 0;
  private chan = 0;
  private spinPhase = 0;
  private castB = 0;
  private dashB = 0;
  private stunB = 0;
  private hitK = 0;
  private hitDir = -1;
  private blinkT = 2;
  private glanceT = 3;
  private glance = 0;
  private glanceTarget = 0;
  private act: Act | null = null;
  private lastAct: Act | null = null;
  private lastSeq = -1;
  private lvl = -1;
  private dying = false;
  private deathT = 0;
  private deathDone: (() => void) | null = null;
  private deadPose = 0;
  private destroyed = false;
  private flashUntil = 0;
  private flashing = false;
  private lastHeadView = '';
  private trailColor = 0xfff4dc;
  private trailAdd = false;
  private sx = 0; private sy = 0;      // last state position (for target directions)

  // per-frame scratch
  private P: Pose = newPose();
  private Q: Pose = newPose();
  private baseCache: Pose = newPose();
  private sn = 1; private cs = 0;

  constructor(look: PlayerLook, mode: boolean | BakeMode = 'portable') {
    this.mode = mode === true ? 'npc' : mode === false ? 'portable' : mode;
    this.root.addChild(this.rig);
    this.rig.addChild(this.glowBack, this.shadow, this.under, this.body, this.over);
    this.body.sortableChildren = true;
    this.setLook(look);
  }

  setLook(look: PlayerLook): void {
    const prev = this.entry;
    this.look = look;
    this.entry = acquireEntry(look, this.mode, this.isLocal);
    this.key = this.entry.key;
    this.res = this.entry.res;
    // until the new sheet is baked, keep showing what we had (old gear / lower density), else the class placeholder
    const sheet = this.entry.sheet && !this.entry.sheet.destroyed ? this.entry.sheet
      : this.sheet && !this.sheet.destroyed ? this.sheet : placeholderSheet(look.classId, this.mode);
    this.build(sheet);
    if (prev) releaseEntry(prev.key);
  }

  // ─────────────────────────── build ───────────────────────────

  private build(sheet: Sheet): void {
    this.sheet = sheet;
    for (const c of this.body.removeChildren()) c.destroy({ children: true });
    for (const c of this.under.removeChildren()) c.destroy({ children: true });
    for (const c of this.over.removeChildren()) c.destroy({ children: true });
    for (const c of this.glowBack.removeChildren()) c.destroy({ children: true });
    this.fxAdd = new Container();
    this.fxAdd.zIndex = 1000;
    this.body.addChild(this.fxAdd);
    this.ribbonF = new Ribbon(22); this.ribbonB = new Ribbon(22);
    this.parts = {}; this.all = []; this.strings = []; this.runes = []; this.flies = []; this.notes = [];
    this.glows = []; this.twinkles = []; this.stars = []; this.bubble = null;
    this.flashing = false; this.lastHeadView = '';
    const sl = this.look.slots;
    const wk = weaponKind(sl.mainhand?.shape);
    const npcHeld = !!sl.offhand && NPC_OFFHAND.has(sl.offhand.shape);
    this.kit = { wk, shield: sl.offhand?.shape === 'shield' || (!!sl.offhand && !npcHeld && !['quiver', 'orb'].includes(sl.offhand.shape)), orb: sl.offhand?.shape === 'orb' || npcHeld, shape: sl.mainhand?.shape ?? '' };
    this.padK = shoulderScale(sl.shoulders);
    this.wpnK = weaponScale(sl.mainhand);
    { const r = reachOf(sl.mainhand?.shape); this.reach = { tip: r.tip * this.wpnK, base: r.base * this.wpnK }; }
    const glow = sl.mainhand?.glow ?? 0;
    const wst = itemStyle(sl.mainhand);
    this.trailColor = wst && wst.tier >= 6 ? light(wst.accent, 0.12) : glow ? light(glow, 0.25) : 0xfff4dc;
    this.trailAdd = !!glow || (!!wst && wst.tier >= 6);
    this.trailBoost = !wst ? 1 : wst.tier >= 8 ? 1.6 : wst.tier >= 6 ? 1.35 : 1;
    { const pr = Object.values(sl).some((l) => typeof l?.fx === 'number') ? gearProfile(this.look) : null;
      void pr; this.wingK = 1; this.backK = 1; }

    const mk = (key: string, part: string): Sprite | Graphics => {
      const o = sheet.make(part, 'n');
      this.body.addChild(o);
      this.parts[key] = o;
      this.all.push({ obj: o, name: part });
      return o;
    };
    mk('legR', 'leg@90'); mk('legL', 'leg@90');
    mk('torso', 'torso'); mk('torsoF', 'torsoF'); mk('torsoB', 'torsoB');
    if (sheet.has('belt')) mk('belt', 'belt');
    if (sheet.has('curtain')) mk('curtain', 'curtain');
    if (sheet.has('tail')) mk('tail', 'tail');
    if (sheet.has('cape')) mk('cape', 'cape');
    if (sheet.has('back')) mk('back', 'back');
    if (sheet.has('wing')) { mk('wingR', 'wing'); mk('wingL', 'wing'); }
    if (sheet.has('quiver')) mk('quiver', 'quiver');
    mk('head', 'head@65');
    mk('eyeR', 'eye'); mk('eyeL', 'eye');
    mk('browR', 'brow'); mk('browL', 'brow');
    mk('mouth', 'mouthO');
    mk('armR', 'arm'); mk('armL', 'arm'); mk('handR', 'hand'); mk('handL', 'hand');
    if (sheet.has('pad')) { mk('padR', 'pad'); mk('padL', 'pad'); }
    if (sheet.has('weapon')) mk('weapon', 'weapon');
    if (sheet.has('shield')) mk('shield', 'shield');
    if (sheet.has('orb')) mk('orb', 'orb');
    // bow string (4 stretched white quads) + nocked arrow
    if (wk === 'bow') {
      for (let i = 0; i < 4; i++) {
        const s = new Sprite(Texture.WHITE);
        s.anchor.set(0, 0.5);
        s.tint = i < 2 ? OUT : 0xe8dcc0;
        s.alpha = i < 2 ? 0.6 : 1;
        this.body.addChild(s);
        this.strings.push(s);
      }
    }
    const fxs = heroFx();
    if (wk === 'bow' || wk === 'xbow' || wk === 'hxbow') {
      this.nockArrow = fxs.make('arrow') as Sprite;
      this.body.addChild(this.nockArrow);
      for (let i = 0; i < 5; i++) {
        const s = fxs.make('arrow') as Sprite;
        const st = new Sprite(fx().streak);
        st.anchor.set(1, 0.5); st.blendMode = 'add'; st.tint = 0xfff2d0;
        s.visible = false; st.visible = false;
        this.fxAdd.addChild(st); this.body.addChild(s);
        this.flies.push({ s, streak: st, vx: 0, vy: 0, t: 1, life: 0 });
      }
    } else this.nockArrow = null;
    this.mallet = fxs.make('mallet');
    this.mallet.visible = false;
    this.body.addChild(this.mallet);

    // trails, whirlwind blur, glows
    this.ribbonB.mesh.zIndex = -30; this.ribbonF.mesh.zIndex = 40;
    for (const r of [this.ribbonB, this.ribbonF]) { r.mesh.tint = this.trailColor; r.mesh.blendMode = this.trailAdd ? 'add' : 'normal'; this.body.addChild(r.mesh); }
    this.whirlDisc = ringSprite(this.trailColor, 100, 0, true); this.whirlDisc.zIndex = -42; this.whirlDisc.blendMode = 'normal';
    this.whirlRing = ringSprite(this.trailColor, 100, 0); this.whirlRing.zIndex = -41; this.whirlRing.blendMode = 'normal';
    this.whirlDisc.visible = this.whirlRing.visible = false;
    this.body.addChild(this.whirlDisc, this.whirlRing);
    this.glowR = glowSprite(0xffffff, 22, 0); this.glowL = glowSprite(0xffffff, 22, 0); this.glowTip = glowSprite(0xffffff, 30, 0);
    this.glowR.zIndex = 60; this.glowL.zIndex = 60; this.glowTip.zIndex = 61;
    this.aura = glowSprite(0xff4a2a, 110, 0, true); this.aura.zIndex = -60;
    this.muzzle = sparkleSprite(0xfff4d0, 26, 0); this.muzzle.zIndex = 62;
    this.fxAdd.addChild(this.glowR, this.glowL, this.glowTip, this.muzzle);
    this.glowBack.addChild(this.aura);
    const sw = new Container();
    const swS = new Sprite(fx().swirl); swS.anchor.set(0.5); swS.width = swS.height = 34; swS.blendMode = 'add';
    sw.addChild(swS); sw.scale.y = 0.55; sw.zIndex = 63; sw.visible = false;
    this.swirl = sw; this.fxAdd.addChild(sw);
    for (let i = 0; i < 4; i++) { const r = fxs.make(`rune${i}`) as Sprite; r.blendMode = 'add'; r.visible = false; this.runes.push(r); this.fxAdd.addChild(r); }
    for (let i = 0; i < 3; i++) { const n = fxs.make('note') as Sprite; n.visible = false; n.zIndex = 70; this.notes.push({ s: n, t: 9, x: 0, y: 0 }); this.body.addChild(n); }

    // nameplate height
    const hs = sl.head?.shape;
    this.height = hs === 'wizard_hat' ? 78 : hs === 'helm_horned' ? 76 : wk === 'staff' ? 72 : 68;

    // gear progression: profile-driven live effects replace the old per-look glow rules (looks without `fx` —
    // townsfolk, older servers — keep the original glows below)
    this.gear?.destroy(); this.gear = null;
    const hasFx = Object.values(sl).some((l) => typeof l?.fx === 'number');
    this.profile = hasFx ? gearProfile(this.look) : null;
    if (this.profile) { this.buildGear(); return; }
    // legendary / set glows
    let glowCount = 0;
    const SLOTS: [LookSlot, number, number][] = [['head', 46, 40], ['chest', 36, 36], ['shoulders', 34, 22], ['hands', 22, 18], ['waist', 32, 14], ['legs', 26, 18], ['feet', 26, 12], ['offhand', 30, 30]];
    for (const [slot, w, h] of SLOTS) {
      const l = sl[slot];
      if (!l?.glow) continue;
      glowCount++;
      const g = glowSprite(l.glow, Math.max(w, h) * 1.7, 0.3, true);
      g.scale.y *= h / w;
      this.glowBack.addChild(g);
      this.glows.push({ sprite: g, base: 0.5, phase: Math.random() * TAU, slot });
      if (slot === 'head' || slot === 'chest' || slot === 'shoulders' || slot === 'offhand') this.addTwinkles(l, slot === 'head' ? 12 : w * 0.45);
    }
    const w = sl.mainhand;
    this.weaponGlow = null; this.tipSpark = null;
    if (w?.glow) {
      glowCount++;
      const ws = glowSprite(w.glow, 30, 0.5, true);
      ws.blendMode = 'normal';
      ws.zIndex = 0;
      this.weaponGlow = ws; this.body.addChild(ws);
      const tip = sparkleSprite(light(w.glow, 0.4), 8, 0.8);
      this.tipSpark = tip; this.fxAdd.addChild(tip);
    }
    if (glowCount >= 3) {
      const main = Object.values(sl).find((l) => l?.glow)?.glow ?? GLOW_SET;
      const aura = glowSprite(main, 84, 0.2, true);
      aura.position.set(0, -32); aura.scale.y *= 1.2;
      this.glowBack.addChildAt(aura, 0);
      this.glows.push({ sprite: aura, base: 0.22 + glowCount * 0.03, phase: 1, slot: 'all' });
    }
    const setPieces = Object.values(sl).filter((l) => l?.glow === GLOW_SET).length;
    for (let i = 0; i < Math.min(4, setPieces); i++) {
      const m = sparkleSprite(light(GLOW_SET, 0.35), 7, 0);
      this.over.addChild(m);
      this.twinkles.push({ s: m, x: 0, y: -26, r: 20, phase: (i / 4) * TAU, speed: 1.1, rise: true, color: GLOW_SET });
    }
  }

  /** Per-piece emissive glows (Storied+ pieces) and the live gear effects for the current quality. */
  private buildGear(): void {
    const sl = this.look.slots, p = this.profile!;
    this.gearQ = this.npcLook() ? 'off' : gearEffectLevel(this.isLocal);
    const q = this.gearQ;
    if (q !== 'off') {
      const SLOTS: [LookSlot, number, number][] = [['head', 46, 40], ['chest', 36, 36], ['shoulders', 34, 22], ['hands', 22, 18], ['waist', 32, 14], ['legs', 26, 18], ['feet', 26, 12], ['offhand', 30, 30]];
      for (const [slot, w, h] of SLOTS) {
        const st = itemStyle(sl[slot]);
        if (!st || st.tier < 6) continue;
        const g = glowSprite(st.accent, Math.max(w, h) * (1.5 + (st.tier - 6) * 0.12), 0.3, true);
        g.scale.y *= h / w;
        this.glowBack.addChild(g);
        this.glows.push({ sprite: g, base: q === 'full' ? 0.32 + (st.tier - 6) * 0.06 : 0.3, phase: Math.random() * TAU, slot });
      }
      const w = itemStyle(sl.mainhand);
      this.weaponGlow = null; this.tipSpark = null;
      if (w && w.tier >= 6) {
        const ws = glowSprite(w.accent, 30, 0.5, true);
        ws.blendMode = 'normal'; ws.zIndex = 0;
        this.weaponGlow = ws; this.body.addChild(ws);
        if (q === 'full') { const tip = sparkleSprite(light(w.accent, 0.4), 8, 0.8); this.tipSpark = tip; this.fxAdd.addChild(tip); }
      }
    }
    this.gear = new GearFx(this.look, p, this.glowBack, this.over, this.fxAdd, q, !!this.parts.wingR, this.mode === 'scene');
    if (this.parts.wingR) this.parts.wingR.visible = this.parts.wingL.visible = q !== 'off';
  }

  private npcLook(): boolean { return !!(this.look as NpcBodyLook).npc; }

  /** Rank-up / first full Set moment (~1.5 s): rings, a column of light, a fountain of the hero's motif, wings flare.
   *  Survives the look rebuild that the same equip triggers (the start time lives on the view). */
  celebrateGear(big: boolean): void {
    if (this.destroyed) return;
    this.celebrateAt = this.t; this.celebrateBig = big;
    this.gear?.flare();
  }

  /** The scene tells views which hero is the local player (own vs other players' gear-effect setting). */
  setIsLocal(v: boolean): void {
    if (this.isLocal === v) return;
    this.isLocal = v;
    if (this.profile) this.rebuildGearFx();
  }

  private rebuildGearFx(): void {
    for (const g of this.glows) g.sprite.destroy();
    this.glows = [];
    this.weaponGlow?.destroy(); this.tipSpark?.destroy(); this.weaponGlow = null; this.tipSpark = null;
    this.gear?.destroy(); this.gear = null;
    this.buildGear();
  }

  private addTwinkles(l: ItemLook, r: number): void {
    const s = sparkleSprite(light(l.glow, 0.45), 8, 0);
    this.over.addChild(s);
    this.twinkles.push({ s, x: 0, y: -40, r, phase: Math.random() * TAU, speed: 0.9 + Math.random() * 0.6, rise: l.glow === GLOW_SET, color: l.glow });
  }

  /** Point a part at another baked image (view swaps) honouring the flash state. */
  private show(obj: Sprite | Graphics, name: string, flashName?: string): void {
    if (this.flashing) {
      const fn = flashName ?? name;
      if (this.sheet.hasVersion(fn, 'f')) { this.sheet.setVersion(obj, fn, 'f'); return; }
    }
    this.sheet.setVersion(obj, name, 'n');
  }

  // ─────────────────────────── actions ───────────────────────────

  playAction(a: ActionSpec): void {
    if (this.destroyed || this.dying) return;
    let def = ACTIONS[a.skill];
    if (a.skill === 'level_up') def = LEVEL_UP;
    if (!def) {
      const wk = this.kit.wk;
      def = wk === 'bow' || wk === 'xbow' || wk === 'hxbow' ? ACTIONS.hungering_arrow : wk === 'staff' || wk === 'wand' ? ACTIONS.magic_missile : ACTIONS.cleave;
    }
    if (def.pose === 'spin') return; // whirlwind is driven by F_CHANNEL
    const now = this.t * 1000;
    const primary = PRIMARY_POSES.has(def.pose) && a.skill !== 'level_up';
    const prev = this.act ?? this.lastAct;
    const chained = !!prev && prev.skill === a.skill && now - prev.start < prev.cycle * 1.7;
    const alt = primary && chained ? !prev!.alt : false;
    const shots: number[] = [];
    const notes: number[] = [];
    switch (def.pose) {
      case 'shoot': shots.push(0); break;
      case 'volley': shots.push(0, 45, 90, 135); break;
      case 'lob': shots.push(def.strikeMs); break;
      case 'skyShot': shots.push(def.strikeMs, def.strikeMs + 25, def.strikeMs + 50); break;
      case 'whistle': notes.push(def.strikeMs, def.strikeMs + 110); break;
    }
    if (this.act) this.lastAct = this.act;
    this.act = { def, skill: a.skill, start: now, cycle: Math.max(180, a.cycleMs || 800), alt, tx: a.tx, ty: a.ty, primary, shots, fired: 0, notes };
    if (a.skill === 'level_up') { this.lvl = now; this.gear?.flare(); }
    else this.combatT = 2.5;
    // face the target now (the head snaps first, the body follows)
    const yaw = presents(def.pose, 0) || a.skill === 'level_up' ? this.side * 22 : facingYaw(a.tx - this.sx, a.ty - this.sy, this.side);
    if (!Number.isNaN(yaw)) this.setYawTarget(yaw, true);
  }

  /** Townsfolk: ease back to a resting yaw (degrees) when not performing an action. */
  face(deg: number): void { if (!this.act) this.setYawTarget(wrapDeg(deg)); }

  /** Seconds since the last action finished (0 while one is playing). */
  idleFor(): number {
    if (this.act) return 0;
    const a = this.lastAct;
    return a ? this.t - (a.start + actionLife({ def: a.def, primary: a.primary, cycle: a.cycle })) / 1000 : this.t;
  }

  /** Dev gallery: snap the hero to a yaw (degrees). */
  setYaw(deg: number): void {
    this.yawB = this.yawH = this.yawTarget = this.bodyTarget = wrapDeg(deg);
    this.vB = this.vH = 0;
    this.side = Math.sign(Math.sin(deg * D2R)) || this.side;
  }

  private setYawTarget(yaw: number, urgent = false): void {
    if (Math.abs(wrapDeg(yaw - this.yawTarget)) < 0.5) return;
    this.yawTarget = yaw;
    this.side = Math.sign(Math.sin(yaw * D2R)) || this.side;
    this.bodyTargetAt = this.t + (urgent ? 0.02 : 0.04);
  }

  // ─────────────────────────── per frame ───────────────────────────

  update(dt: number, s: ViewState): void {
    if (this.destroyed) return;
    pumpBakes();
    const cur = this.entry?.sheet;
    if (cur && !cur.destroyed && cur !== this.sheet) this.build(cur);
    else if (this.sheet.destroyed) this.build(cur && !cur.destroyed ? cur : placeholderSheet(this.look.classId, this.mode));
    if (this.res < resOf(this.mode) && !this.dying) { this.setLook(this.look); }
    this.sx = s.x; this.sy = s.y;

    const flags = s.flags;
    const frozen = (flags & F_FROZEN) !== 0;
    const chill = (flags & F_CHILL) !== 0;
    const stunned = (flags & F_STUN) !== 0;
    const k = frozen ? 0 : chill ? 0.6 : 1;
    const adt = dt * k;
    this.t += adt;
    const t = this.t;
    const now = t * 1000;

    // ── state blends
    const moving = s.moving && !frozen;
    const speed = Math.hypot(s.vx, s.vy);
    this.moveBlend += ((moving ? 1 : 0) - this.moveBlend) * damp(12, dt);
    if (moving) this.walk += adt * 8 * clamp(speed / 250, 0.6, 1.5) * Math.PI;
    const chanOn = (flags & F_CHANNEL) !== 0 && !frozen;
    this.chan += ((chanOn ? 1 : 0) - this.chan) * damp(chanOn ? 16 : 10, dt);
    if (chanOn || this.chan > 0.02) this.spinPhase += adt * TAU * SPIN_RATE * Math.max(0.35, this.chan);
    if (!chanOn && this.chan < 0.02 && this.spinPhase !== 0) {
      // fold the spin into the yaw springs so the hero eases back to its facing
      const deg = (this.spinPhase / D2R) % 360;
      this.yawB = wrapDeg(this.yawB + deg); this.yawH = wrapDeg(this.yawH + deg);
      this.spinPhase = 0;
    }
    this.castB += (((flags & F_CAST) && !this.act ? 1 : 0) - this.castB) * damp(14, dt);
    this.dashB += (((flags & F_DASH) ? 1 : 0) - this.dashB) * damp(20, dt);
    this.stunB += ((stunned ? 1 : 0) - this.stunB) * damp(10, dt);
    this.hitK = Math.max(0, this.hitK - dt * 5);
    this.combatT = Math.max(0, this.combatT - dt);

    // fallback swing when the server bumps attackSeq without a cast event reaching us
    if (s.attackSeq !== this.lastSeq) {
      if (this.lastSeq >= 0 && (!this.act || now - this.act.start > 120)) {
        const dir = s.facingLeft ? -1 : 1;
        this.playAction({ skill: '', tx: s.x + dir * 100, ty: s.y, cycleMs: 1000 / Math.max(0.4, s.aps) });
      }
      this.lastSeq = s.attackSeq;
    }

    // ── action lifetime
    let act = this.act;
    if (act) {
      const life = actionLife({ def: act.def, primary: act.primary, cycle: act.cycle });
      if (now - act.start > life) { this.lastAct = act; this.act = act = null; }
    }

    // ── facing target
    if (act && (presents(act.def.pose, now - act.start) || act.skill === 'level_up')) {
      this.setYawTarget(this.side * 22);
    } else if (act) {
      const yaw = facingYaw(act.tx - s.x, act.ty - s.y, this.side);
      if (!Number.isNaN(yaw)) this.setYawTarget(yaw);
    } else if (moving && speed > 25 && !chanOn) {
      const yaw = facingYaw(s.vx, s.vy, this.side);
      if (!Number.isNaN(yaw)) this.setYawTarget(yaw);
    } else if (s.facingLeft !== this.lastFacingLeft && !chanOn) {
      const want = s.facingLeft ? -1 : 1;
      if (Math.sign(this.yawTarget) !== want) this.setYawTarget(-this.yawTarget);
    }
    this.lastFacingLeft = s.facingLeft;
    if (t >= this.bodyTargetAt) this.bodyTarget = this.yawTarget;

    // ── springs (head leads the body), idle glance
    this.glanceT -= adt;
    if (artDebug.deterministic) this.glanceT = 9;
    if (this.glanceT < 0) {
      this.glanceT = 2.6 + Math.random() * 3.5;
      this.glanceTarget = this.glanceTarget !== 0 || moving || act ? 0 : (Math.random() < 0.5 ? -15 : 15);
    }
    if (moving || act || chanOn) this.glanceTarget = 0;
    this.glance += (this.glanceTarget - this.glance) * damp(9, dt);
    {
      const tH = this.yawH + wrapDeg(this.yawTarget + this.glance - this.yawH);
      [this.yawH, this.vH] = spring(this.yawH, this.vH, tH, 38, dt);
      const tB = this.yawB + wrapDeg(this.bodyTarget - this.yawB);
      [this.yawB, this.vB] = spring(this.yawB, this.vB, tB, 31, dt);
      this.yawH = wrapDeg(this.yawH); this.yawB = wrapDeg(this.yawB);
    }
    const turning = clamp(Math.abs(this.vB) / 600) * (1 - this.chan);

    // ── pose
    const P = this.P;
    basePose(P, this.kit, { t, walk: this.walk, move: this.moveBlend, dash: this.dashB, stun: this.stunB, cast: this.castB, turn: turning });
    copyPose(this.baseCache, P);
    let actCtx: ActCtx | null = null;
    if (act) {
      actCtx = this.ctxFor(act, now - act.start, s);
      if (act.skill === 'level_up') levelUpPose(P, actCtx.t);
      else actionPose(P, actCtx);
    }
    spinPose(P, this.kit, this.spinPhase, this.chan);

    // hit flinch: away from the facing side, squash
    const hk = this.hitK;
    if (hk > 0) {
      P.lean -= 0.28 * hk; P.sx *= 1 + 0.08 * hk; P.sy *= 1 - 0.08 * hk; P.headTilt -= 0.2 * hk;
    }

    // ── death
    let finish: (() => void) | null = null;
    const deadFlag = (flags & F_DEAD) !== 0;
    if (this.dying) {
      this.deathT += dt;
      this.deadPose = easeOut3(clamp(this.deathT / 0.45));
      this.body.alpha = 1 - clamp((this.deathT - 0.25) / 0.35);
      if (this.deathT >= 0.6 && this.deathDone) { finish = this.deathDone; this.deathDone = null; }
    } else if (deadFlag) {
      this.deadPose += (1 - this.deadPose) * damp(10, dt);
      this.body.alpha = 0.55;
    } else {
      this.deadPose += (0 - this.deadPose) * damp(12, dt);
      this.body.alpha = 1;
    }

    // flash bookkeeping
    const nowMs = performance.now();
    const wantFlash = !preferences.get().values.reduceFlashes && nowMs < this.flashUntil;
    if (wantFlash !== this.flashing) {
      this.flashing = wantFlash;
      for (const { obj, name } of this.all) if (!name.startsWith('head@') && !name.startsWith('leg@')) this.sheet.setVersion(obj, name, wantFlash ? 'f' : 'n');
      if (this.mallet) heroFx().setVersion(this.mallet, 'mallet', wantFlash ? 'f' : 'n');
      this.lastHeadView = '';
    }

    this.layout(P, s, actCtx, frozen);
    const n0 = this.parts;

    // blink / expressions
    this.blinkT -= adt;
    if (this.blinkT < 0) this.blinkT = 2.2 + Math.random() * 3.2;
    if (artDebug.deterministic) this.blinkT = 9;
    const blink = this.blinkT < 0.12 || stunned || this.deadPose > 0.5;
    const eyeSy = blink ? 0.15 : P.expr === 1 ? 0.62 : P.expr === 3 ? 0.8 : 1;
    this.parts.eyeR.scale.y = eyeSy; this.parts.eyeL.scale.y = eyeSy;

    this.updateGlows(t, P);
    this.updateFx(t, P, act, actCtx, adt);
    if (this.profile) {
      const q = this.npcLook() ? 'off' : gearEffectLevel(this.isLocal);
      if (q !== this.gearQ) this.rebuildGearFx();
      this.gear?.update({
        t, dt: adt, wx: s.x, wy: s.y, moving: this.moveBlend > 0.5, walk: this.walk, idle: this.idleFor(), side: this.side,
        sB: Math.sin(this.yawB * D2R), cB: Math.cos(this.yawB * D2R),
        head: { x: n0.head.x, y: n0.head.y, d: 0 }, chest: { x: 0, y: -24, d: 0 }, hR: this.hR, hL: this.hL, wTip: this.wTip, wBase: this.wBase,
        hasWeapon: !!n0.weapon && this.kit.wk !== 'bow', bow: this.kit.wk === 'bow',
        swing: act ? P.trail : this.chan * 0.6,
        celebrate: this.celebrateAt >= 0 ? t - this.celebrateAt : -1, celebrateBig: this.celebrateBig,
        combat: clamp(this.combatT / 0.6), local: this.isLocal,
      });
    }
    this.updateStatus(t, flags, stunned);

    // tints
    let tint = 0xffffff;
    if (frozen) tint = 0x8fd0ff;
    else if (chill) tint = 0xc4e4ff;
    else if (flags & F_POISON) tint = 0xd2f0b8;
    this.body.tint = tint;
    if (finish) finish();
  }

  private ctxFor(act: Act, t: number, s: { x: number; y: number }): ActCtx {
    const dx = act.tx - s.x, dy = act.ty - s.y;
    // the body yaw is compressed (±65° sideways); aim the upper body the rest of the way
    const tYaw = Math.atan2(dx, dy) / D2R;
    let aimYaw = wrapDeg(this.yawB - tYaw);
    aimYaw = clamp(aimYaw, -55, 55) * D2R;
    // presenting to the camera: no aiming; afterwards the upper body swings onto the target smoothly
    const pe = act.skill === 'level_up' ? 1e9 : PRESENT_MS[act.def.pose];
    if (pe !== undefined) aimYaw *= pe > 1e8 ? 0 : clamp((t - pe) / 90) ** 2 * (3 - 2 * clamp((t - pe) / 90));
    const dist = Math.hypot(dx, dy);
    const aimEl = dist > 1 ? clamp(Math.atan2(-dy * 0.12, dist) * 0.5, -0.3, 0.3) : 0;
    return { kit: this.kit, def: act.def, skill: act.skill, t, cycle: act.cycle, alt: act.alt, primary: act.primary, aimYaw, aimEl };
  }

  // ─────────────────────────── solve & place ───────────────────────────

  private bodyY = 0;

  /** Screen position of a body-local point (hip-space tilt KB). */
  private pt(x: number, y: number, z: number, o: P2): P2 {
    const Z = x * this.cs + z * this.sn;
    o.x = x * this.sn - z * this.cs; o.y = y + Z * KB + this.bodyY; o.d = Z;
    return o;
  }
  /** Screen offset of a body-local vector (limb tilt KL). */
  private dv(x: number, y: number, z: number, o: P2): P2 {
    const Z = x * this.cs + z * this.sn;
    o.x = x * this.sn - z * this.cs; o.y = y + Z * KL; o.d = Z;
    return o;
  }

  private sR = p2(); private sL = p2(); private hR = p2(); private hL = p2(); private tmp = p2(); private tmp2 = p2();
  private wTip = p2(); private wBase = p2(); private wDir = p2();

  /** Upper-body yaw rotation about the vertical axis (towards +z). */
  private rot(v: V3, th: number): V3 {
    const c = Math.cos(th), s = Math.sin(th);
    return { x: v.x * c - v.z * s, y: v.y, z: v.x * s + v.z * c };
  }

  /** Hands + weapon in screen space for a pose at a yaw (used by layout and by trail sampling). */
  private solveArms(P: Pose, yawDeg: number): void {
    this.sn = Math.sin(yawDeg * D2R); this.cs = Math.cos(yawDeg * D2R);
    const th = P.upper;
    const drop = P.crouch * 6 + P.kneel * 5;
    const SRw = this.rot({ x: SH.x, y: SH.y + drop, z: SH.z }, th);
    const SLw = this.rot({ x: SH.x, y: SH.y + drop, z: -SH.z }, th);
    this.pt(SRw.x, SRw.y, SRw.z, this.sR);
    this.pt(SLw.x, SLw.y, SLw.z, this.sL);
    const HR = this.rot({ x: P.hR.x, y: P.hR.y + drop, z: P.hR.z }, th);
    const HL = this.rot({ x: P.hL.x, y: P.hL.y + drop, z: P.hL.z }, th);
    this.dv(HR.x - SRw.x, HR.y - SRw.y, HR.z - SRw.z, this.tmp);
    this.hR.x = this.sR.x + this.tmp.x; this.hR.y = this.sR.y + this.tmp.y; this.hR.d = HR.x * this.cs + HR.z * this.sn;
    this.dv(HL.x - SLw.x, HL.y - SLw.y, HL.z - SLw.z, this.tmp);
    this.hL.x = this.sL.x + this.tmp.x; this.hL.y = this.sL.y + this.tmp.y; this.hL.d = HL.x * this.cs + HL.z * this.sn;
    const W = this.rot(P.w, th);
    this.dv(W.x, W.y, W.z, this.wDir);
    const hand = this.kit.wk === 'bow' ? this.hL : this.hR;
    this.wTip.x = hand.x + this.wDir.x * this.reach.tip; this.wTip.y = hand.y + this.wDir.y * this.reach.tip;
    this.wTip.d = hand.d + this.wDir.d * this.reach.tip;
    this.wBase.x = hand.x + this.wDir.x * this.reach.base; this.wBase.y = hand.y + this.wDir.y * this.reach.base;
    this.wBase.d = hand.d + this.wDir.d * this.reach.base;
  }

  private layout(P: Pose, s: ViewState, c: ActCtx | null, frozen: boolean): void {
    const n = this.parts;
    const yawB = this.yawB + P.spin / D2R;
    const yawH = this.yawH + P.spin / D2R - ((P.upper - P.twist) * 0.3 + P.headYaw) / D2R;
    const yawC = yawB - P.upper * 0.7 / D2R;
    const sB = Math.sin(yawB * D2R), cB = Math.cos(yawB * D2R);
    const side = Math.abs(sB) > 0.05 ? Math.sign(sB) : this.side;
    const t = this.t;
    const breath = Math.sin(t * TAU / 1.6) * (1 - this.moveBlend);

    // ── whole body: hop, lunge, lean, squash
    const drop = P.crouch * 6 + P.kneel * 5;
    this.bodyY = 0;
    this.body.y = -P.hop;
    const shake = P.shake > 0 ? Math.sin(t * 90) * 0.7 * P.shake : 0;
    let lx = 0, ly = 0;
    if (c) {
      const dx = (this.act?.tx ?? 0) - s.x, dy = (this.act?.ty ?? 0) - s.y, dl = Math.hypot(dx, dy) || 1;
      lx = (dx / dl) * P.lunge; ly = (dy / dl) * P.lunge * 0.6;
    }
    lx += -side * 3.2 * this.hitK;
    this.rig.position.set(lx + shake, ly);
    let rotB = P.lean * sB;
    let sx = P.sx, sy = P.sy * (1 - 0.1 * Math.abs(P.lean) * Math.abs(cB));
    if (this.deadPose > 0.001) { rotB = lerp(rotB, -1.45 * side, this.deadPose); sy *= 1 - 0.1 * this.deadPose; }
    this.body.rotation = rotB;
    this.body.scale.set(sx, sy);
    this.shadow.scale.set((34 / 96) * (1 - clamp(P.hop / 30) * 0.4) * (1 + 0.15 * P.spread), (34 * 0.42 / 48) * (1 - clamp(P.hop / 30) * 0.4));
    this.shadow.alpha = 0.8 * this.body.alpha;
    void frozen;

    // ── legs
    this.sn = sB; this.cs = cB;
    const legDeg = nearest(LEG_VIEWS, Math.abs(wrapDeg(yawB)));
    const legName = `leg@${legDeg}`;
    const spread = 1 + P.spread * 0.45;
    const legsY = HIP + drop;
    for (const sideL of [1, -1] as const) {
      const o = sideL === 1 ? n.legR : n.legL;
      let a = sideL === 1 ? P.legR : P.legL;
      if (P.kneel > 0) a = lerp(a, sideL === 1 ? -0.9 : 0.4, P.kneel);
      this.pt(0, legsY, 3.6 * sideL * spread, this.tmp);
      const dx = Math.sin(a) * sB, dy = Math.cos(a) + Math.sin(a) * cB * KL;
      const len = Math.hypot(dx, dy);
      o.position.set(this.tmp.x, this.tmp.y);
      o.rotation = Math.atan2(-dx, dy) * 0.9;
      const fold = sideL === -1 ? P.kneel * 0.35 : P.kneel * 0.12;
      o.scale.set(side * 1, clamp(len, 0.85, 1.15) * (1 - P.crouch * 0.3 - fold));
      o.zIndex = -100 + this.tmp.d;
      this.show(o, legName, `leg@${legDeg}`);
    }

    // ── torso + sliding details
    const torsoY = HIP + drop - breath * 0.45 + Math.sin(this.walk * 2) * -0.6 * this.moveBlend;
    n.torso.position.set(0, torsoY);
    n.torso.scale.set(1, 1 + breath * 0.012);
    n.torso.zIndex = 0;
    const sC = Math.sin(yawC * D2R), cC = Math.cos(yawC * D2R);
    n.torsoF.position.set(9.4 * sC, torsoY);
    n.torsoF.scale.set(Math.max(0.02, cC), 1);
    n.torsoF.alpha = clamp((cC - 0.04) / 0.18);
    n.torsoF.zIndex = 0.1;
    n.torsoB.position.set(-9.4 * sC, torsoY);
    n.torsoB.scale.set(Math.max(0.02, -cC), 1);
    n.torsoB.alpha = clamp((-cC - 0.04) / 0.18);
    n.torsoB.zIndex = 0.1;
    if (n.belt) {
      n.belt.position.set(11.4 * sB, torsoY);
      n.belt.scale.set(Math.max(0.02, cB), 1);
      n.belt.alpha = clamp((cB - 0.04) / 0.18);
      n.belt.zIndex = 0.2;
    }

    // ── head (view-baked) + face overlays
    const headPt = this.pt(1.2, HEAD_Y + drop - breath * 0.6 + Math.sin(this.walk * 2) * -0.8 * this.moveBlend, 0, this.tmp2);
    const hx = headPt.x, hy = headPt.y;
    const hv = nearest(HEAD_VIEWS, wrapDeg(yawH));
    const hvName = `head@${hv}`;
    const hfName = `head@${nearest(HEAD_FLASH_VIEWS, wrapDeg(yawH))}`;
    const viewKey = this.flashing ? hfName : hvName;
    if (viewKey !== this.lastHeadView) { this.show(n.head, hvName, hfName); this.lastHeadView = viewKey; }
    const tilt = P.headTilt + Math.sin(t * TAU / 1.6) * 0.02 * (1 - this.moveBlend) + Math.sin(this.walk * 2) * 0.02 * this.moveBlend;
    n.head.position.set(hx, hy);
    n.head.rotation = tilt;
    n.head.zIndex = 2;
    const hvRad = hv * D2R;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const placeFace = (o: Sprite | Graphics, lon: number, lat: number, z: number, flip = 1) => {
      const q = sph(lon * D2R, lat * D2R, hvRad);
      const vis = clamp((q.d + 0.02) / 0.14);
      o.visible = vis > 0.02;
      if (!o.visible) return;
      o.position.set(hx + q.x * ct - q.y * st, hy + q.x * st + q.y * ct);
      o.rotation = tilt;
      o.scale.x = flip * clamp(0.2 + q.d * 0.95, 0.36, 1);
      o.alpha = vis;
      o.zIndex = z;
    };
    placeFace(n.eyeR, 17, -10, 2.1); placeFace(n.eyeL, -17, -10, 2.1);
    const showBrow = P.expr === 1 || P.expr === 3;
    n.browR.visible = n.browL.visible = false;
    if (showBrow) { placeFace(n.browR, 15, 5, 2.15); placeFace(n.browL, -15, 5, 2.15, -1); }
    if (P.expr === 1 || P.expr === 2) {
      this.sheet.setVersion(n.mouth, P.expr === 1 ? 'mouthR' : 'mouthO', 'n');
      placeFace(n.mouth, 0, -38, 2.15);
    } else n.mouth.visible = false;

    // hair tail / long hair / cape / quiver (back pieces)
    const sH = Math.sin(yawH * D2R), cH = Math.cos(yawH * D2R);
    const sideH = Math.abs(sH) > 0.05 ? Math.sign(sH) : side;
    const fly = P.hairFly;
    if (n.tail) {
      const q = sph(Math.PI, 22 * D2R, yawH * D2R, HEAD_R * 0.92);
      n.tail.position.set(hx + q.x, hy + q.y);
      n.tail.scale.set(sideH * Math.max(0.42, Math.abs(sH)) * (1 + fly * 0.2), 1 - fly * 0.15);
      n.tail.rotation = Math.sin(t * 2.2) * 0.06 + Math.sin(this.walk) * 0.06 * this.moveBlend + sideH * (0.35 * this.moveBlend + 1.1 * fly) * (P.spin ? 1 : 0.6);
      n.tail.zIndex = q.d > 0.25 ? 2.5 : -9;
    }
    if (n.curtain) {
      n.curtain.position.set(hx - sH * 1.5, hy + 1);
      n.curtain.scale.set(1 + fly * 0.25, 1 - fly * 0.1);
      n.curtain.rotation = -sideH * fly * 0.25;
      n.curtain.zIndex = -cH > 0.2 ? 0.8 : -9;
    }
    if (n.cape) {
      this.pt(-4.4, -33 + drop, 0, this.tmp);
      n.cape.position.set(this.tmp.x, this.tmp.y);
      n.cape.scale.set((0.42 + 0.58 * Math.abs(cB)) * (1 + fly * 0.3), 1 - fly * 0.2);
      n.cape.rotation = side * (0.06 * this.moveBlend + 0.5 * fly) * Math.abs(sB) + Math.sin(t * 2) * 0.015;
      n.cape.zIndex = clamp(this.tmp.d, -8, 0.6);
    }
    if (n.back) {
      // cloth back piece: hangs from the nape, sways with movement, narrows in profile (like the mantle cape)
      this.pt(-6, -33 + drop, 0, this.tmp);
      n.back.position.set(this.tmp.x, this.tmp.y);
      const sway = this.gearQ === 'full' ? Math.sin(t * 1.8) * 0.025 + Math.sin(this.walk) * 0.03 * this.moveBlend : 0;
      n.back.scale.set((0.5 + 0.5 * Math.abs(cB)) * (1 + fly * 0.3) * this.backK, (1 - fly * 0.18 - 0.05 * this.moveBlend) * this.backK);
      // in profile the cloth flares out behind the hero so the silhouette shows it
      n.back.rotation = side * (0.2 * Math.abs(sB) + (0.12 * this.moveBlend + 0.5 * fly) * Math.abs(sB)) + sway;
      n.back.zIndex = clamp(this.tmp.d, -8.5, 0.55);
    }
    if (n.wingR) {
      // wings attach between the shoulder blades and sweep outwards + back; their screen spread follows the yaw
      this.pt(-4.2, -36 + drop, 0, this.tmp);
      const ax = this.tmp.x, ay = this.tmp.y, ad = this.tmp.d;
      const animate = this.gearQ === 'full';
      this.wingFlap += (animate ? (1.1 + 1.6 * this.moveBlend) : 0) * TAU * 0.25 * (1 / 60);
      const flap = animate ? Math.sin(t * (1.6 + 2.2 * this.moveBlend)) : 0;
      // Wings read like the top-down ARPG convention: always spread to both sides behind the hero, with a yaw-driven
      // asymmetry (the far wing narrows and the pair drifts to the back side in profile).
      const facing = cB >= 0 ? 1 : -1;
      const cel = this.celebrateAt >= 0 ? clamp(1 - (t - this.celebrateAt) / 1.6) : 0;
      const K = this.wingK * (1 + 0.16 * Math.sin(cel * Math.PI));
      for (const sz of [1, -1] as const) {
        const w = sz === 1 ? n.wingR : n.wingL;
        const X = -sz * facing * (0.8 + 0.2 * Math.abs(cB)) - 0.3 * sB;
        w.position.set(ax - sB * 2, ay);
        w.scale.set(Math.sign(X) * clamp(Math.abs(X), 0.62, 1.05) * K, (1 + flap * 0.05) * K);
        w.rotation = Math.sign(X) * (-0.05 - flap * 0.1 - 0.12 * cel);
        w.zIndex = clamp(ad, -8.6, 0.5) - 0.01;
      }
    }
    if (n.quiver) {
      this.pt(-7.6, -24 + drop, 1.4, this.tmp);
      n.quiver.position.set(this.tmp.x, this.tmp.y);
      n.quiver.rotation = -0.42 * side;
      n.quiver.scale.set(side * (0.75 + 0.25 * Math.abs(sB)), 1);
      n.quiver.zIndex = this.tmp.d > 0 ? 0.7 : -7 + this.tmp.d * 0.1;
    }

    // ── arms, hands, weapon
    this.solveArms(P, yawB);
    const hR = this.hR, hL = this.hL, sR = this.sR, sL = this.sL;
    this.placeArm(n.armR, n.handR, sR, hR);
    this.placeArm(n.armL, n.handL, sL, hL);
    if (n.padR) { this.placePad(n.padR, sR, hR, 1); this.placePad(n.padL, sL, hL, -1); }
    const wk = this.kit.wk;
    const tool = P.tool > 0.5;
    if (this.mallet) {
      this.mallet.visible = tool;
      if (tool) {
        const ax = hR.x - sR.x, ay = hR.y - sR.y, al = Math.hypot(ax, ay) || 1;
        // head perpendicular to the forearm, pointing forward
        const dx = (-ay / al) * side, dy = (ax / al) * side;
        this.mallet.position.set(hR.x, hR.y);
        this.mallet.rotation = Math.atan2(dx, -dy);
        this.mallet.zIndex = n.handR.zIndex - 0.01;
      }
    }
    if (n.weapon) {
      const wpn = n.weapon;
      const hand = wk === 'bow' ? hL : hR;
      const handObj = wk === 'bow' ? n.handL : n.handR;
      wpn.visible = !(tool && wk !== 'bow');
      if (wk === 'bow') this.placeBow(wpn as Sprite, P, hand);
      else {
        const L = Math.hypot(this.wDir.x, this.wDir.y);
        wpn.position.set(hand.x, hand.y);
        wpn.rotation = Math.atan2(this.wDir.x, -this.wDir.y);
        wpn.scale.set(this.wpnK, clamp(L, 0.3, 1.05) * this.wpnK);
        wpn.skew.set(0, 0);
      }
      const mid = (hand.d + (wk === 'bow' ? hand.d : this.wTip.d)) / 2;
      wpn.zIndex = mid + 0.02;
      handObj.zIndex = Math.max(handObj.zIndex, wpn.zIndex + 0.01);
      if (this.weaponGlow && wk !== 'bow') {
        const g = this.weaponGlow;
        const L = Math.hypot(this.wDir.x, this.wDir.y);
        g.position.set((hand.x + this.wTip.x) / 2, (hand.y + this.wTip.y) / 2);
        g.rotation = Math.atan2(this.wDir.x, -this.wDir.y);
        g.width = 13; g.height = Math.max(10, this.reach.tip * 1.05 * clamp(L, 0.3, 1));
        g.zIndex = wpn.zIndex - 0.005;
      } else if (this.weaponGlow) {
        this.weaponGlow.position.set(hand.x, hand.y); this.weaponGlow.width = 16; this.weaponGlow.height = 48; this.weaponGlow.rotation = (wpn as Sprite).rotation;
        this.weaponGlow.zIndex = wpn.zIndex - 0.005;
      }
      if (this.tipSpark) { this.tipSpark.position.set(this.wTip.x, this.wTip.y); }
    }
    // shield / orb on the left hand
    if (n.shield) {
      const sh = n.shield as Sprite;
      const useBack = cB < -0.35;
      this.sheet.setVersion(sh, useBack ? 'shieldBack' : 'shield', this.flashing ? 'f' : 'n');
      const phiN = 0.55 * yawB * D2R;
      const tx = -Math.sin(phiN), tz = Math.cos(phiN);
      this.dv(tx, 0, tz, this.tmp);
      let ux = this.tmp.x, uy = this.tmp.y * 0.6;
      if (ux < 0) { ux = -ux; uy = -uy; }
      const ul = Math.hypot(ux, uy);
      const um = Math.max(0.42, ul) / (ul || 1);
      const cxp = hL.x + 1.2 * side, cyp = hL.y - 1.5;
      sh.setFromMatrix(new Matrix(ux * um * 0.92, uy * um * 0.92, 0, 0.92, cxp, cyp));
      sh.zIndex = hL.d + 0.4;
      n.handL.zIndex = sh.zIndex - 0.02;
      n.armL.zIndex = Math.min(n.armL.zIndex, sh.zIndex - 0.03);
    }
    if (n.orb) {
      if (this.look.slots.offhand && NPC_OFFHAND.has(this.look.slots.offhand.shape)) {
        // A held prop sits in the hand (grip at its origin), swinging slightly with the arm instead of floating.
        n.orb.position.set(hL.x + 1 * side, hL.y + 1);
        n.orb.scale.x = side;
        n.orb.zIndex = hL.d - 0.05;
      } else {
        const bob = Math.sin(t * 2.4) * 1.6;
        n.orb.position.set(hL.x + 3 * side, hL.y - 8 + bob);
        n.orb.zIndex = hL.d + 0.3;
      }
    }

    // ── trails (sampled along the real tip path)
    this.updateTrail(P, c, yawB);
  }

  private placeArm(arm: Sprite | Graphics, hand: Sprite | Graphics, s: P2, h: P2): void {
    const dx = h.x - s.x, dy = h.y - s.y;
    const len = Math.hypot(dx, dy);
    arm.position.set(s.x, s.y);
    arm.rotation = Math.atan2(-dx, dy);
    arm.scale.set(1, clamp(len / ARM, 0.45, 1.45));
    const d = (s.d + h.d) / 2;
    arm.zIndex = d;
    // depth shading: far limbs darker
    const shade = clamp(-d / 9);
    const tint = mix(0xffffff, 0xb6aabc, shade);
    arm.tint = tint; hand.tint = tint;
    hand.position.set(h.x, h.y);
    hand.rotation = arm.rotation;
    hand.zIndex = Math.max(d, h.d) + 0.05;
  }

  private placePad(pad: Sprite | Graphics, s: P2, h: P2, sideZ: number): void {
    // sits on top of the shoulder, nudged outwards; slightly smaller than the profile drawing
    const out = sideZ * 2.4;
    pad.position.set(s.x - out * this.cs, s.y - 1.8 + out * this.sn * KB);
    pad.scale.set(0.84 * this.padK);
    const raise = clamp((s.y - h.y) / ARM);
    pad.rotation = (h.x - s.x) * 0.02 * sideZ + raise * 0.25 * Math.sign(h.x - s.x || 1);
    pad.zIndex = s.d + 0.3;
    pad.tint = mix(0xffffff, 0xb6aabc, clamp(-s.d / 9));
  }

  private bowM = new Matrix();
  private placeBow(bow: Sprite, P: Pose, hand: P2): void {
    const th = P.upper;
    const A = this.rot(P.w, th), U = this.rot(P.up, th);
    this.dv(A.x, A.y, A.z, this.tmp);
    let ax = this.tmp.x, ay = this.tmp.y;
    const al = Math.hypot(ax, ay) || 1;
    if (al < 0.38) { ax *= 0.38 / al; ay *= 0.38 / al; }
    this.dv(-U.x, -U.y, -U.z, this.tmp2);
    const vx = this.tmp2.x, vy = this.tmp2.y;
    const m = this.bowM;
    const k = this.wpnK;
    m.set(ax * k, ay * k, vx * k, vy * k, hand.x - ax * 2.4, hand.y - ay * 2.4);
    bow.setFromMatrix(m);
    // string: limb tips → nock (pulled to the right hand)
    const at = (lx: number, ly: number) => ({ x: m.a * lx + m.c * ly + m.tx, y: m.b * lx + m.d * ly + m.ty });
    const top = at(-2.4, -21), bot = at(-2.4, 21), rest = at(-2.4, 0);
    let nx = lerp(rest.x, this.hR.x, P.pull), ny = lerp(rest.y, this.hR.y, P.pull);
    if (P.vib > 0.01) { const v = Math.sin(this.t * TAU * 38) * 2.4 * P.vib; nx += (ax / (Math.hypot(ax, ay) || 1)) * v; ny += (ay / (Math.hypot(ax, ay) || 1)) * v; }
    const seg = (s: Sprite, x0: number, y0: number, x1: number, y1: number, w: number, z: number) => {
      s.position.set(x0, y0); s.rotation = Math.atan2(y1 - y0, x1 - x0);
      s.width = Math.hypot(x1 - x0, y1 - y0); s.height = w; s.zIndex = z;
    };
    const z = bow.zIndex;
    seg(this.strings[0], top.x, top.y, nx, ny, 2.4, z - 0.004); seg(this.strings[1], bot.x, bot.y, nx, ny, 2.4, z - 0.004);
    seg(this.strings[2], top.x, top.y, nx, ny, 0.95, z - 0.003); seg(this.strings[3], bot.x, bot.y, nx, ny, 0.95, z - 0.003);
    if (this.nockArrow) {
      const vis = P.nock * Math.max(P.pull, 0.3) > 0.12 && !this.flashing;
      this.nockArrow.visible = vis;
      if (vis) {
        const l = Math.hypot(ax, ay) || 1;
        this.nockArrow.position.set(nx, ny);
        this.nockArrow.rotation = Math.atan2(ax / l, -ay / l);
        this.nockArrow.scale.set(1, clamp(l * 1.05, 0.4, 1));
        this.nockArrow.zIndex = Math.max(z, this.hR.d) + 0.03;
      }
    }
  }

  // ─────────────────────────── trails ───────────────────────────

  private updateTrail(P: Pose, c: ActCtx | null, yawB: number): void {
    const act = this.act;
    const spinning = this.chan > 0.05;
    const wantAction = !!(c && act && P.trail > 0.01 && this.kit.wk !== 'bow');
    if (!spinning && !wantAction) { this.ribbonF.hide(); this.ribbonB.hide(); this.whirlRing!.visible = false; this.whirlDisc!.visible = false; return; }
    const col = (act && act.def.trail) || this.trailColor;
    const add = this.trailAdd || !!(act && act.def.trail && SPELL_POSES.has(act.def.pose));
    for (const r of [this.ribbonF, this.ribbonB]) {
      r.mesh.tint = col; r.mesh.blendMode = add ? 'add' : 'normal';
      const parent = add ? this.fxAdd : this.body;
      if (r.mesh.parent !== parent) parent.addChild(r.mesh);
    }
    this.ribbonF.begin(); this.ribbonB.begin();
    const Q = this.Q;
    const N = 20;
    const span = spinning ? 0.45 / SPIN_RATE * 1000 : Math.max(60, Math.min(150, (act?.def.strikeMs ?? 70) * 1.6));
    const baseYaw = this.yawB;
    for (let j = 0; j < N; j++) {
      const back = (j / (N - 1)) * span;
      let a: number;
      if (spinning) {
        copyPose(Q, this.baseCache);
        const ph = this.spinPhase - (back / 1000) * TAU * SPIN_RATE;
        spinPose(Q, this.kit, ph, this.chan);
        this.solveArms(Q, baseYaw + Q.spin / D2R);
        a = Math.min(1, this.chan * Math.pow(1 - j / (N - 1), 1.3) * this.trailBoost);
      } else {
        const tt = c!.t - back;
        if (tt < -5) break;
        copyPose(Q, this.baseCache);
        actionPose(Q, { ...c!, t: tt });
        this.solveArms(Q, yawB);
        a = Math.min(1, Q.trail * Math.pow(1 - j / (N - 1), 1.2) * this.trailBoost);
      }
      const d = this.wTip.d;
      const fa = a * clamp((d + 3) / 6), ba = a * clamp((3 - d) / 6);
      this.ribbonF.push(this.wBase.x, this.wBase.y, this.wTip.x, this.wTip.y, fa);
      this.ribbonB.push(this.wBase.x, this.wBase.y, this.wTip.x, this.wTip.y, ba);
    }
    this.ribbonF.end(); this.ribbonB.end();
    // restore the current solve (sampling overwrote it)
    this.solveArms(P, yawB);
    // whirlwind blur disc + ring at blade height
    const ring = this.whirlRing!, disc = this.whirlDisc!;
    if (spinning) {
      const R = SH.z + ARM * 1.1 + this.reach.tip;
      const y = SH.y + P.crouch * 6 + 2;
      ring.position.set(0, y); disc.position.set(0, y);
      ring.width = R * 2.05; ring.height = R * 2.05 * KL;
      disc.width = R * 2.1; disc.height = R * 2.1 * KL;
      ring.tint = col; disc.tint = col;
      ring.alpha = 0.32 * this.chan; disc.alpha = 0.28 * this.chan;
      ring.visible = disc.visible = true;
      ring.rotation = 0; disc.rotation = 0;
    } else { ring.visible = disc.visible = false; }
  }

  // ─────────────────────────── fx ───────────────────────────

  private updateFx(t: number, P: Pose, act: Act | null, c: ActCtx | null, adt: number): void {
    const col = (act && act.def.trail) || (this.look.slots.mainhand?.glow ? light(this.look.slots.mainhand.glow, 0.3) : this.look.classId === 'mage' ? 0xb388ff : 0xfff0c8);
    const gR = this.glowR!, gL = this.glowL!, gT = this.glowTip!;
    gR.position.set(this.hR.x, this.hR.y); gR.alpha = clamp(P.glowR) * 0.8; gR.tint = col; gR.zIndex = this.parts.handR.zIndex + 0.1;
    gL.position.set(this.hL.x, this.hL.y); gL.alpha = clamp(P.glowL) * 0.8; gL.tint = col; gL.zIndex = this.parts.handL.zIndex + 0.1;
    const wk = this.kit.wk;
    // tip glow: weapon tip (melee / casters), bow: just ahead of the grip; frost nova: the staff butt on the ground
    let tx = this.wTip.x, ty = this.wTip.y;
    if (wk === 'bow') { tx = this.hL.x + this.wDir.x * 8; ty = this.hL.y + this.wDir.y * 8; }
    if (act?.def.pose === 'groundBurst' && wk === 'staff') { tx = this.hR.x - this.wDir.x * 22; ty = this.hR.y - this.wDir.y * 22; }
    gT.position.set(tx, ty);
    gT.alpha = clamp(P.glowTip, 0, 1.4) * 0.85;
    gR.visible = gR.alpha > 0.01; gL.visible = gL.alpha > 0.01; gT.visible = gT.alpha > 0.01;
    gT.tint = col;
    gT.width = gT.height = 22 + 26 * clamp(P.glowTip - 0.5, 0, 1);
    // muzzle sparkle on releases
    const m = this.muzzle!;
    const rel = act && (act.def.pose === 'shoot' || act.def.pose === 'volley' || act.def.pose === 'lob' || act.def.pose === 'skyShot' || act.def.pose === 'flick') ? P.glowTip : 0;
    m.visible = rel > 0.05;
    if (m.visible) { m.position.set(tx, ty); m.alpha = clamp(rel); m.scale.set(0.25 + 0.5 * (1 - clamp(rel))); m.rotation = t * 4; m.tint = act!.def.pose === 'flick' ? col : 0xfff4d0; }
    // aura (roar / level up)
    const au = this.aura!;
    au.alpha = clamp(P.aura) * 0.75;
    au.visible = au.alpha > 0.01;
    au.tint = act?.skill === 'level_up' ? 0xffd36a : 0xff4a2a;
    au.position.set(0, -30); au.width = 70 + 70 * P.aura; au.height = (70 + 70 * P.aura) * 1.15;
    // black hole swirl at the hands
    const sw = this.swirl!;
    sw.visible = P.swirl > 0.02;
    if (sw.visible) {
      sw.position.set((this.hR.x + this.hL.x) / 2, (this.hR.y + this.hL.y) / 2);
      sw.scale.set(0.5 + 0.8 * P.swirl, (0.5 + 0.8 * P.swirl) * 0.6);
      (sw.children[0] as Sprite).rotation = -t * 9;
      (sw.children[0] as Sprite).tint = col; sw.alpha = clamp(P.swirl);
    }
    // runes circling the weapon
    if (this.runes.length) {
      const on = P.runes > 0.02;
      const cx = (this.hR.x + this.wTip.x) / 2, cy = (this.hR.y + this.wTip.y) / 2;
      for (let i = 0; i < this.runes.length; i++) {
        const r = this.runes[i];
        r.visible = on;
        if (!on) continue;
        const a = t * 3.2 + (i / this.runes.length) * TAU;
        r.position.set(cx + Math.cos(a) * 15, cy + Math.sin(a) * 5 - 4 + Math.sin(t * 2 + i) * 1.5);
        r.zIndex = Math.sin(a) > 0 ? 50 : -20;
        r.alpha = P.runes * (Math.sin(a) > 0 ? 1 : 0.55);
        r.scale.set(0.9 * (0.75 + 0.25 * Math.sin(a)), 0.9);
        r.tint = col;
      }
    }
    // releases: arrows leave the bow
    if (act && c && act.fired < act.shots.length && c.t >= act.shots[act.fired]) {
      while (act.fired < act.shots.length && c.t >= act.shots[act.fired]) { this.launch(act); act.fired++; }
    }
    for (const f of this.flies) {
      if (f.t >= f.life) { f.s.visible = false; f.streak.visible = false; continue; }
      f.t += adt;
      const k = f.t / f.life;
      f.s.x += f.vx * adt; f.s.y += f.vy * adt;
      f.s.alpha = 1 - easeOut(k) * 0.9;
      f.streak.position.set(f.s.x, f.s.y);
      f.streak.alpha = 0.8 * (1 - k);
      f.streak.width = 30 + 40 * k;
    }
    // whistle notes
    if (act && c && act.notes.length && c.t >= act.notes[0]) {
      act.notes.shift();
      const nn = this.notes.find((q) => q.t > 0.8);
      if (nn) { nn.t = 0; nn.x = this.parts.mouth.x || this.parts.head.x + 6 * this.side; nn.y = this.parts.head.y + 6; }
    }
    for (const q of this.notes) {
      if (q.t > 0.8) { q.s.visible = false; continue; }
      q.t += adt;
      q.s.visible = true;
      q.s.position.set(q.x + this.side * 12 * q.t + Math.sin(q.t * 14) * 2, q.y - 30 * q.t);
      q.s.alpha = 1 - clamp((q.t - 0.4) / 0.4);
      q.s.scale.set(0.8 + 0.3 * q.t);
    }
  }

  private launch(act: Act): void {
    const f = this.flies.find((q) => q.t >= q.life);
    if (!f) return;
    const wk = this.kit.wk;
    const hand = wk === 'bow' ? this.hL : this.hR;
    let dx = this.wDir.x, dy = this.wDir.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    if (act.def.pose === 'skyShot') { const k = (act.fired - 1) * 0.18; const c = Math.cos(k), s = Math.sin(k); [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; }
    const sp = 1500;
    f.vx = dx * sp; f.vy = dy * sp; f.t = 0; f.life = 0.085;
    f.s.visible = true; f.streak.visible = true;
    f.s.position.set(hand.x + dx * 4, hand.y + dy * 4);
    f.s.rotation = Math.atan2(dx, -dy);
    f.s.scale.set(wk === 'bow' ? 1 : 0.75);
    f.s.zIndex = 65; f.streak.zIndex = 64.5;
    f.streak.rotation = Math.atan2(dy, dx);
    f.streak.height = 5;
    f.streak.tint = this.look.slots.mainhand?.glow ? light(this.look.slots.mainhand.glow, 0.4) : 0xfff2d0;
  }

  private updateGlows(t: number, P: Pose): void {
    const n = this.parts;
    const at = (slot: string): [number, number] => {
      switch (slot) {
        case 'head': return [n.head.x, n.head.y];
        case 'chest': return [0, -24];
        case 'shoulders': return [(this.sR.x + this.sL.x) / 2, this.sR.y];
        case 'hands': return [(this.hR.x + this.hL.x) / 2, (this.hR.y + this.hL.y) / 2];
        case 'waist': return [0, -16];
        case 'legs': return [0, -6];
        case 'feet': return [0, -2];
        case 'offhand': return n.shield ? [n.shield.x, n.shield.y] : n.orb ? [n.orb.x, n.orb.y] : n.quiver ? [n.quiver.x, n.quiver.y] : [0, -22];
        default: return [0, -32];
      }
    };
    for (const g of this.glows) {
      g.sprite.alpha = g.base * (0.8 + 0.25 * Math.sin(t * 2.6 + g.phase));
      if (g.slot !== 'all') { const [x, y] = at(g.slot); g.sprite.position.set(x, y); }
    }
    if (this.weaponGlow) this.weaponGlow.alpha = 0.55 * (0.8 + 0.25 * Math.sin(t * 2.6)) + 0.3 * clamp(P.glowTip);
    if (this.tipSpark) { const k = 0.5 + 0.5 * Math.sin(t * 3.1 * 2); this.tipSpark.alpha = 0.3 + 0.6 * k; this.tipSpark.rotation = t * 0.8; this.tipSpark.scale.set(0.09 + 0.09 * k); }
    for (const w of this.twinkles) {
      const cyc = (t * w.speed * 0.35 + w.phase / TAU) % 1;
      if (cyc < 0.02 || w.s.alpha <= 0.001) {
        const a = w.rise ? (Math.random() < 0.5 ? Math.PI : 0) + (Math.random() - 0.5) * 0.9 : Math.random() * TAU;
        const rr = w.rise ? w.r * (0.8 + Math.random() * 0.3) : w.r * Math.sqrt(Math.random());
        w.s.position.set(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr * 0.8 + (w.rise ? 10 : 0));
      }
      const k = Math.sin(cyc * Math.PI);
      w.s.alpha = k * 0.9;
      w.s.scale.set((w.rise ? 0.1 : 0.13) * (0.5 + k));
      if (w.rise) w.s.y = w.y + 10 + Math.sin(w.phase * 3.1) * w.r * 0.4 - cyc * 30;
    }
  }

  private updateStatus(t: number, flags: number, stunned: boolean): void {
    if (stunned && !this.stars.length) {
      for (let i = 0; i < 3; i++) { const st = new Sprite(fx().star5); st.anchor.set(0.5); st.scale.set(0.42); st.tint = 0xffe066; this.over.addChild(st); this.stars.push(st); }
    }
    for (let i = 0; i < this.stars.length; i++) {
      const st = this.stars[i];
      st.visible = stunned;
      const a = t * 4 + (i * TAU) / 3;
      st.position.set(Math.cos(a) * 11, -this.height + 2 + Math.sin(a) * 3);
      st.rotation = t * 3;
    }
    const sh = (flags & F_SHIELD) !== 0;
    if (sh && !this.bubble) { this.bubble = glowSprite(0x8fd8ff, 90, 0.3, true); this.bubble.position.set(0, -32); this.over.addChild(this.bubble); }
    if (this.bubble) { this.bubble.visible = sh; this.bubble.alpha = 0.22 + 0.06 * Math.sin(t * 4); }
  }

  hit(intensity: number, crit: boolean): void {
    if (this.destroyed) return;
    this.combatT = 2.5;
    if (!preferences.get().values.reduceFlashes) this.flashUntil = Math.max(this.flashUntil, performance.now() + (crit ? 90 : 70));
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
    this.ribbonF.destroy(); this.ribbonB.destroy();
    this.gear?.destroy(); this.gear = null;
    this.root.destroy({ children: true });
    if (this.entry) releaseEntry(this.entry.key);
    this.entry = null;
  }
}

void HIP; void ARM;
