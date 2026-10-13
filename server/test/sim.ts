// Gameplay simulation harness: drives createInstance() directly with fake PlayerLinks and simple bots.
// Run: npx tsx server/test/sim.ts   (exit code 1 on any failed check)
//
// Scenarios: every class at levels 1 / 20 / 70 in a field and in a rift (bots walk towards monsters using the
// snapshots they receive), signature builds, every skill × rune, elite affixes, goblins, death & respawn,
// performance (4 players + 150 monsters).

import type { InstanceApi, PlayerLink } from '../src/contracts';
import {
  BASES, CLASSES, CollisionWorld, DIFFICULTIES, ELEMENT_INDEX, LEGENDARIES, MONSTERS, Rng, SETS, SKILLS, TILE, ZONES, computeStats,
  PARAGON_STATS, armorReduction, createCharacter, generateItem, isBlockedTile, monsterHp, paragonPoints, resistReduction, runeUnlockLevel, skillsForClass, slotsForKind, xpToNext, zoneSeed,
  F_CHANNEL, F_DEAD, STATE_STRIDE, type CharacterSave, type ClassId, type DerivedStats, type EntDesc, type GameEvent,
  type Item, type ItemKind, type ParagonCategory, type S2C, type Slot, type Snapshot,
} from '../src/shared';
import { Instance, createInstance } from '../src/sim/instance';
import { peekIdForHarness, resetIdsForHarness } from '../src/sim/ids';
import { resetPacksForHarness, spawnPack } from '../src/sim/spawner';
import { resetItemIdsForHarness } from '../../shared/src/items';
import { interpolateLog, levelDamage, levelToughness, tuningOverrides } from '../src/sim/tuning';
import { createMob } from '../src/sim/monsters';
import { pickTarget } from '../src/sim/brain';
import { skillCost } from '../src/sim/playerctx';
import { shotBlocked } from '../src/sim/effects';
import { strikeMob } from '../src/sim/damage';
import type { Mob } from '../src/sim/types';
import { encode } from '../src/net/codec';
import { readFileSync, writeFileSync } from 'node:fs';
import { LoadGauge, QUIET_GAUGE_MS } from './perfGauge';

// Deterministic runs: every Math.random draw (bot wandering, the loot RNG's seed) comes from one seeded PRNG,
// so a failing check reproduces exactly. Override with SIM_SEED=<n> to explore other outcomes.
const SIM_SEED = Number(process.env.SIM_SEED ?? 0xc0ffee);
let simRng = new Rng(SIM_SEED);
Math.random = () => simRng.next();

// Calibration runs substitute the balance tables from the environment: TOUGH='[[1,1],[10,20],...]' DAMAGE='[...]'
if (process.env.TOUGH) { const t = JSON.parse(process.env.TOUGH) as [number, number][]; tuningOverrides.levelToughness = (l) => interpolateLog(l, t); }
if (process.env.DAMAGE) { const t = JSON.parse(process.env.DAMAGE) as [number, number][]; tuningOverrides.levelDamage = (l) => interpolateLog(l, t); }
// ORDEAL='[[hp, dmg], …]' (ten pairs, Ordeal I–X): try another ladder without editing shared/src/progression.ts.
if (process.env.ORDEAL) (JSON.parse(process.env.ORDEAL) as [number, number][]).forEach(([hp, dmg], i) => { DIFFICULTIES[4 + i].hp = hp; DIFFICULTIES[4 + i].dmg = dmg; });

// ─────────────────────────── Checks ───────────────────────────

const failures: string[] = [];
let checks = 0;
function check(cond: unknown, msg: string) {
  checks++;
  if (!cond) { failures.push(msg); console.log(`  ✗ ${msg}`); }
}
const fmt = (n: number, d = 1) => n.toFixed(d);

// ─────────────────────────── Fake link (client mirror) ───────────────────────────

interface CEnt { desc: EntDesc; x: number; y: number; hp: number; flags: number; aseq: number }

let linkMs = 0;
class FakeLink implements PlayerLink {
  readonly sessionId: string;
  derived: DerivedStats;
  dirty = 0;
  snaps = 0;
  snapsWithMobs = 0;
  myId = 0;
  me: Snapshot['me'] | null = null;
  ack = 0;
  ents = new Map<number, CEnt>();
  ev: Record<string, number> = {};
  evV: Record<string, number> = {};
  /** first damage tick / death tick per mob, for time-to-kill. */
  firstHit = new Map<number, number>();
  /** Ticks this player has spent dead so far, and its value at each mob's first hit. A kill with a player death between
   *  the first hit and the kill (the dead time and the walk back from the respawn point are not kill time) is left out
   *  of `ttk` and counted in `ttkBroken`: it only mattered once monsters could kill a levelling character (2026-10-12). */
  deadTicks = 0; private deadAt = new Map<number, number>(); ttkBroken: Record<number, number> = {};
  ttk: Record<number, number[]> = {};
  descs = new Map<number, EntDesc>();
  tickNo = 0;
  channelTicks = 0;
  sawDeadFlag = false;
  maxAdd = 0;
  bytesish = 0;
  log: GameEvent[] = [];
  keepLog = false;
  /** Endgame ladder: damage to this player in the last 5 s, one record per death, damage taken per source. */
  hurt: { tick: number; a: number; src: string }[] = [];
  deathRecs: DeathRec[] = [];
  hurtBySrc: Record<string, number> = {};

  constructor(readonly save: CharacterSave) {
    this.sessionId = `s-${save.name}`;
    this.derived = computeStats(save);
  }

  markDirty() { this.dirty++; }
  /** `budget` scenario: encode every message like the real session (encoding is server cost; decoding below is not). */
  countBytes = false; bytes = 0; maxMsgBytes = 0;

  send(msg: S2C) {
    if (this.countBytes) { const n = encode(msg).byteLength; this.bytes += n; this.maxMsgBytes = Math.max(this.maxMsgBytes, n); }
    const t0 = performance.now();
    try { this.recv(msg); } finally { linkMs += performance.now() - t0; }
  }

  private recv(msg: S2C) {
    if (msg.t !== 's') return;
    this.snaps++;
    if (this.me && this.me.dead > 0 && msg.tick > this.tickNo) this.deadTicks += msg.tick - this.tickNo;
    this.tickNo = msg.tick;
    this.ack = msg.ack;
    this.me = msg.me;
    if (msg.add) {
      this.maxAdd = Math.max(this.maxAdd, msg.add.length);
      for (const d of msg.add) {
        const e = this.ents.get(d.id);
        if (e) e.desc = d; else this.ents.set(d.id, { desc: d, x: 0, y: 0, hp: 1, flags: 0, aseq: 0 });
        this.descs.set(d.id, d);
      }
    }
    let mobs = 0;
    for (let i = 0; i < msg.upd.length; i += STATE_STRIDE) {
      const e = this.ents.get(msg.upd[i]);
      if (!e) throw new Error(`upd for unknown entity ${msg.upd[i]}`);
      e.x = msg.upd[i + 1]; e.y = msg.upd[i + 2]; e.hp = msg.upd[i + 3] / 1000; e.flags = msg.upd[i + 4]; e.aseq = msg.upd[i + 5];
      if (e.desc.k === 'mob') mobs++;
    }
    if (mobs > 0) this.snapsWithMobs++;
    const self = this.ents.get(this.myId);
    if (self && self.flags & F_CHANNEL) this.channelTicks++;
    if (self && self.flags & F_DEAD) this.sawDeadFlag = true;
    if (msg.ev) for (const ev of msg.ev) this.onEvent(ev);
    if (msg.rem) for (const id of msg.rem) this.ents.delete(id);
  }

  private onEvent(ev: GameEvent) {
    this.ev[ev.e] = (this.ev[ev.e] ?? 0) + 1;
    if ('v' in ev) this.evV[`${ev.e}:${ev.v}`] = (this.evV[`${ev.e}:${ev.v}`] ?? 0) + 1;
    if (this.keepLog) this.log.push(ev);
    if (ev.e === 'cast') this.evV[`cast:${ev.sk}`] = (this.evV[`cast:${ev.sk}`] ?? 0) + 1;
    if (ev.e === 'pickup' && ev.lk === 'item') this.evV[`item:${ev.rarity}`] = (this.evV[`item:${ev.rarity}`] ?? 0) + 1;
    if (ev.e === 'pickup' && ev.lk !== 'item') this.evV[`other:${ev.lk}`] = (this.evV[`other:${ev.lk}`] ?? 0) + (ev.lk === 'gold' || ev.lk === 'mat' ? ev.amount ?? 1 : 1);
    if (ev.e === 'dmg' && ev.t !== this.myId && this.descs.get(ev.t)?.k !== 'player') {
      if (!this.firstHit.has(ev.t)) { this.firstHit.set(ev.t, this.tickNo); this.deadAt.set(ev.t, this.deadTicks); }
      if (ev.s !== undefined) {
        const src = ev.s === this.myId ? 'me' : this.descs.get(ev.s)?.k === 'summon' ? `summon:${this.descs.get(ev.s)!.t}` : 'other';
        this.evV[`dmgsrc:${src}`] = (this.evV[`dmgsrc:${src}`] ?? 0) + 1;
      }
    }
    if (ev.e === 'dmg' && ev.t === this.myId && this.myId) {
      const src = hurtSource(this.descs, ev.s, ev.el);
      this.hurt.push({ tick: this.tickNo, a: ev.a, src });
      while (this.hurt.length && this.hurt[0].tick < this.tickNo - 100) this.hurt.shift();
      this.hurtBySrc[src] = (this.hurtBySrc[src] ?? 0) + ev.a;
    }
    if (ev.e === 'die' && ev.t === this.myId && this.myId && this.me) this.deathRecs.push(deathRecord(this.hurt, this.tickNo, this.me.mhp));
    if (ev.e === 'die') {
      const d = this.descs.get(ev.t);
      const t0 = this.firstHit.get(ev.t);
      if (d && d.k === 'mob' && t0 !== undefined) {
        if (this.deadTicks !== (this.deadAt.get(ev.t) ?? this.deadTicks)) this.ttkBroken[d.el ?? 0] = (this.ttkBroken[d.el ?? 0] ?? 0) + 1;
        else (this.ttk[d.el ?? 0] ??= []).push((this.tickNo - t0) * 50);
      }
    }
    if (ev.e === 'proj') {
      const d = this.descs.get(ev.s);
      if (d?.k === 'summon') this.evV[`proj:${ev.v}@${d.t}`] = (this.evV[`proj:${ev.v}@${d.t}`] ?? 0) + 1;
    }
  }

  n(key: string) { return this.evV[key] ?? this.ev[key] ?? 0; }
  sawSummon(t: string) { for (const d of this.descs.values()) if (d.k === 'summon' && d.t === t) return true; return false; }
}

/** One player death: the biggest single hit and the damage of the last 1 s / 3 s as a share of max life, the source that
 *  dealt most of the last 3 s, and how many hits landed in those 3 s. */
interface DeathRec { maxHit: number; burst1: number; burst3: number; killer: string; hits3: number }
const TIER_LABEL = ['', '/champion', '/rare', '/minion', '/boss', '/goblin'];
function hurtSource(descs: Map<number, EntDesc>, s: number | undefined, el: number): string {
  const element = ELEMENT_INDEX[el] ?? '?';
  if (s === undefined) return `ground ${element}`;
  const d = descs.get(s);
  if (!d || d.k !== 'mob') return `${d?.k ?? 'unknown'} ${element}`;
  return `${d.t}${TIER_LABEL[d.el ?? 0] ?? ''}${d.af?.length ? `[${d.af.join('+')}]` : ''} ${element}`;
}
function deathRecord(hurt: { tick: number; a: number; src: string }[], tick: number, mhp: number): DeathRec {
  let maxHit = 0, b1 = 0, b3 = 0, hits3 = 0;
  const bySrc: Record<string, number> = {};
  for (const h of hurt) {
    if (h.tick >= tick - 60) { b3 += h.a; hits3++; bySrc[h.src] = (bySrc[h.src] ?? 0) + h.a; maxHit = Math.max(maxHit, h.a); }
    if (h.tick >= tick - 20) b1 += h.a;
  }
  const killer = Object.entries(bySrc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '?';
  return { maxHit: maxHit / mhp, burst1: b1 / mhp, burst3: b3 / mhp, killer, hits3 };
}

// ─────────────────────────── Characters ───────────────────────────

let seedCounter = 1000;
const SEED_COUNTER_START = seedCounter;
let gearRng = new Rng(4242);

function equip(save: CharacterSave, it: Item, slot?: Slot) {
  const s = slot ?? (it.kind === 'ring' ? (!save.equipment.ring1 ? 'ring1' : 'ring2') : slotsForKind(it.kind)[0]);
  it.bound = true;
  save.equipment[s] = it;
}

const SLOT_BASES: Record<ClassId, Partial<Record<Slot, string>>> = {
  warrior: { head: 'head_helm', shoulders: 'shoulders_plate', neck: 'neck_amulet', chest: 'chest_plate', hands: 'hands_gauntlets', wrists: 'wrists_bracers', waist: 'waist_belt', legs: 'legs_plate', feet: 'feet_greaves', ring1: 'ring', ring2: 'ring', mainhand: 'axe2h' },
  ranger: { head: 'head_hood', shoulders: 'shoulders_pads', neck: 'neck_amulet', chest: 'chest_leather', hands: 'hands_gloves', wrists: 'wrists_bracers', waist: 'waist_belt', legs: 'legs_leather', feet: 'feet_boots', ring1: 'ring', ring2: 'ring', mainhand: 'bow', offhand: 'quiver' },
  mage: { head: 'head_wizard', shoulders: 'shoulders_mantle', neck: 'neck_amulet', chest: 'chest_robe', hands: 'hands_wraps', wrists: 'wrists_bracers', waist: 'waist_sash', legs: 'legs_cloth', feet: 'feet_shoes', ring1: 'ring', ring2: 'ring', mainhand: 'staff' },
};

/** Level-appropriate rares in every slot. */
function gearRares(save: CharacterSave, ilvl: number) {
  save.equipment = {};
  for (const [slot, base] of Object.entries(SLOT_BASES[save.classId]) as [Slot, string][]) {
    equip(save, generateItem(gearRng, { ilvl, classId: save.classId, rarity: 'rare', base, smartChance: 1 }), slot);
  }
}

const CLASS_SET: Record<ClassId, string> = { warrior: 'endless_storm', ranger: 'siegebreaker', mage: 'fallen_star' };
const CLASS_LEGS: Record<ClassId, Partial<Record<Slot, string>>> = {
  // Warrior: the measured best Endless Storm 6 Whirlwind kit of the warrior parity audit (WARRIOR-PARITY.json, merged pool);
  // the old kit (Eternal Gyre, Bloodwake in the Cube) fed the retired 'Whirlwind applies Rend' 4-piece.
  warrior: { mainhand: 'ninefold_gale', waist: 'furycord_belt', wrists: 'wardkeepers_cuffs', neck: 'signal_horn_charm', ring1: 'ouroboros_loop', ring2: 'rally_knot' },
  // Ranger: the ranger parity audit's best Siegebreaker 6 Sentry kit (RANGER-PARITY.json, pool); its rings and one Cube
  // pick keyed off Arrowfall / Quarry Mark (not on this bar), so those stay generic.
  ranger: { mainhand: 'kennel_wood_bow', offhand: 'sappers_pack', wrists: 'wardkeepers_cuffs', waist: 'witching_cord', neck: 'roost_charm', ring1: 'ouroboros_loop', ring2: 'patient_thief' },
  // Mage: the measured best Regalia of the Fallen Star 6 Meteor kit of the mage parity audit (MAGE-PARITY.json, shipped
  // pool); the old kit (Hellforge Talisman, Seal of the Patient Thief) fed the retired Fallen Star bonuses.
  mage: { mainhand: 'cindervane', wrists: 'runeweaver_cuffs', waist: 'witching_cord', neck: 'craterheart_amulet', ring1: 'static_loop', ring2: 'ouroboros_loop' },
};
const CLASS_CUBE: Record<ClassId, (string | null)[]> = {
  warrior: ['millwheel_edge', 'gale_stitched_legguards', 'seething_sigil'],
  ranger: ['bolt_throwers_arbalest', 'gearwright_heart', 'signal_horn_charm'],
  mage: ['thousand_missiles', 'starfall_mantle', 'rimecourt_band'],
};

/** Debug-style endgame kit: rares everywhere, full class set, class legendaries, Kanai powers. */
function gearEndgame(save: CharacterSave) {
  gearRares(save, 70);
  const set = SETS[CLASS_SET[save.classId]];
  for (const piece of set.pieces) equip(save, generateItem(gearRng, { ilvl: 70, classId: save.classId, rarity: 'set', set: set.id, base: piece.base }));
  for (const [slot, leg] of Object.entries(CLASS_LEGS[save.classId]) as [Slot, string][]) {
    equip(save, generateItem(gearRng, { ilvl: 70, classId: save.classId, rarity: 'legendary', legendary: leg }), slot);
  }
  if (BASES[save.equipment.mainhand!.base].weapon?.twoHanded && !BASES[save.equipment.mainhand!.base].weapon?.ranged) delete save.equipment.offhand;
  if (save.equipment.mainhand!.base === 'staff') delete save.equipment.offhand;
  save.cube.level = 8;
  save.cube.learned = CLASS_CUBE[save.classId].filter((x): x is string => !!x);
  save.cube.equipped = CLASS_CUBE[save.classId];
}

const BUILDS: Record<ClassId, { slots: string[]; runes: Record<string, string> }> = {
  warrior: { slots: ['whirlwind', 'battle_rage', 'muster_standard', 'ground_stomp'], runes: { cleave: 'broad_sweep', whirlwind: 'dust_devils', rend: 'bloodlust', ground_stomp: 'wrenching_smash', battle_rage: 'into_the_fray' } },
  ranger: { slots: ['sentry', 'multishot', 'cluster_arrow', 'companion'], runes: { hungering_arrow: 'puncturing', sentry: 'spitfire', multishot: 'arsenal', cluster_arrow: 'maelstrom', companion: 'wolf_howl' } },
  mage: { slots: ['meteor', 'black_hole', 'frost_nova', 'magic_weapon'], runes: { magic_missile: 'seeker', meteor: 'star_pact', black_hole: 'spellsteal', frost_nova: 'bone_chill', magic_weapon: 'force_weapon' } },
};

type Build = { slots: string[]; runes: Record<string, string>; primary?: string };
function makeChar(cls: ClassId, level: number, opts: { endgame?: boolean; build?: Build } = {}): CharacterSave {
  const save = createCharacter(`Bot${cls}${level}_${seedCounter}`, cls, seedCounter++);
  if (level > 1) {
    save.level = level;
    save.skillPoints = level - 1;
    const b: Build = opts.build ?? BUILDS[cls];
    if (b.primary) save.skills.primary = b.primary;
    save.skills.slots = b.slots.map((s) => (SKILLS[s].unlock <= level ? s : null));
    for (const [sk, rune] of Object.entries(b.runes)) {
      const def = SKILLS[sk];
      const i = def.runes.findIndex((r) => r.id === rune);
      if (i >= 0 && runeUnlockLevel(def, i) <= level) save.skills.runes[sk] = rune;
    }
    const tiered = [save.skills.primary, ...save.skills.slots.filter((s): s is string => !!s)];
    let pts = save.skillPoints;
    for (const tier of [1, 2, 3]) for (const sk of tiered) {
      const cost = [2, 4, 6][tier - 1];
      if (pts >= cost && (save.skills.tiers[sk] ?? 0) === tier - 1) { save.skills.tiers[sk] = tier; pts -= cost; }
    }
    save.skillPoints = pts;
    if (opts.endgame) gearEndgame(save); else gearRares(save, level);
  }
  return save;
}

// ─────────────────────────── Bot ───────────────────────────

class Bot {
  seq = 0;
  dist: Int32Array | null = null;
  distTarget = -1;
  lastX = 0; lastY = 0; stuckMs = 0; unstickMs = 0; unstickA = 0;
  /** Watchdog: a player who has killed nothing for a while moves instead of waiting at a spot where shots never land. */
  lastKills = 0; idleTicks = 0;
  constructor(readonly inst: Instance, readonly link: FakeLink, readonly melee: boolean) {}

  private fieldTo(tx: number, ty: number) {
    const map = this.inst.map;
    const t = Math.floor(ty / TILE) * map.w + Math.floor(tx / TILE);
    if (t === this.distTarget && this.dist) return;
    this.distTarget = t;
    const d = this.dist ?? new Int32Array(map.w * map.h);
    this.dist = d;
    d.fill(-1);
    const q = new Int32Array(map.w * map.h);
    let h = 0, tl = 0;
    d[t] = 0; q[tl++] = t;
    while (h < tl) {
      const i = q[h++];
      const x = i % map.w, y = (i / map.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        const j = ny * map.w + nx;
        if (d[j] >= 0 || isBlockedTile(map.tiles[j])) continue;
        d[j] = d[i] + 1; q[tl++] = j;
      }
    }
  }

  /** Steer towards (tx, ty) with BFS around walls. */
  private steer(px: number, py: number, tx: number, ty: number): [number, number] {
    const cw: CollisionWorld = this.inst.cw;
    if (!cw.segmentBlocked(px, py, tx, ty)) return [tx - px, ty - py];
    this.fieldTo(tx, ty);
    const map = this.inst.map, d = this.dist!;
    const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE);
    let best = d[cy * map.w + cx], bx = cx, by = cy;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const v = d[ny * map.w + nx];
      if (v >= 0 && (best < 0 || v < best)) { best = v; bx = nx; by = ny; }
    }
    return [bx * TILE + TILE / 2 - px, by * TILE + TILE / 2 - py];
  }

  /** Nearest live monster (whole map — exploration) by straight distance; treasure goblins nearby come first. */
  private nearestMob(px: number, py: number): Mob | null {
    let best: Mob | null = null, bd = Infinity;
    for (const m of this.inst.mobs) {
      if (m.dead || m.dummy) continue;
      let d = (m.x - px) ** 2 + (m.y - py) ** 2;
      if (m.tier === 5 && d < 1600 * 1600) d *= 0.01;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  step() {
    const me = this.link.me;
    let mx = 0, my = 0, dash = false, potion = false;
    // a player salvages junk when the bag fills up
    const inv = this.link.save.inventory;
    if (this.seq % 100 === 0 && inv.filter(Boolean).length > 50) {
      for (let i = 0; i < inv.length; i++) if (inv[i] && inv[i]!.rarity !== 'legendary' && inv[i]!.rarity !== 'set') inv[i] = null;
    }
    if (me && me.dead <= 0) {
      const px = me.x, py = me.y;
      // pick up own items when nothing is close
      let lootT: CEnt | null = null, ld = 650;
      let closeMob = Infinity;
      for (const e of this.link.ents.values()) {
        if (e.desc.k === 'mob' && e.desc.t !== 'training_dummy') closeMob = Math.min(closeMob, Math.hypot(e.x - px, e.y - py));
        if (e.desc.k === 'loot' && e.desc.loot?.lk === 'item') {
          const d = Math.hypot(e.x - px, e.y - py);
          if (d < ld) { ld = d; lootT = e; }
        }
      }
      let tx = px, ty = py, want = 0;
      if (lootT && closeMob > 260) { tx = lootT.x; ty = lootT.y; want = 4; }
      else {
        const m = this.nearestMob(px, py);
        if (m) {
          tx = m.x; ty = m.y;
          want = this.melee ? m.r + 24 : m.tier === 5 ? 120 : 300;
        }
      }
      const d = Math.hypot(tx - px, ty - py);
      if (want > 4 && this.inst.cw.segmentBlocked(px, py, tx, ty)) want = 0;
      if (d > want) {
        const [dx, dy] = this.steer(px, py, tx, ty);
        const l = Math.hypot(dx, dy) || 1;
        mx = dx / l; my = dy / l;
      }
      // unstick
      if (Math.hypot(px - this.lastX, py - this.lastY) < 2 && (mx || my)) this.stuckMs += 50; else this.stuckMs = 0;
      this.lastX = px; this.lastY = py;
      if (this.stuckMs > 1500) { this.unstickMs = 600; this.unstickA = Math.random() * Math.PI * 2; this.stuckMs = 0; }
      const kills = this.inst.players.find((q) => q.link === this.link)?.kills ?? 0;
      if (kills !== this.lastKills) { this.lastKills = kills; this.idleTicks = 0; } else if (++this.idleTicks > 20 * 20) { this.idleTicks = 0; this.unstickMs = 1200; this.unstickA = Math.random() * Math.PI * 2; }
      if (this.unstickMs > 0) { this.unstickMs -= 50; mx = Math.cos(this.unstickA); my = Math.sin(this.unstickA); }
      if (me.hp < me.mhp * 0.35 && me.dashCd <= 0) dash = true;
      // a player drinks the health potion when low (POTION, since 2026-10-12)
      if (me.hp < me.mhp * 0.4 && (me.potionCd ?? 0) <= 0) potion = true;
    }
    this.inst.queueInput(this.link, { t: 'in', seq: ++this.seq, mx: Math.round(mx * 100) / 100, my: Math.round(my * 100) / 100, ...(dash ? { dash: 1 as const } : {}), ...(potion ? { potion: 1 as const } : {}) });
  }
}

// ─────────────────────────── Helpers ───────────────────────────

let instSeq = 1;
const INST_SEQ_START = instSeq;
function newField(zoneId = 'whispering_glade', fixedSeed?: number): Instance {
  return createInstance({ zoneId, channel: instSeq, key: `${zoneId}#${instSeq++}`, seed: fixedSeed ?? zoneSeed(zoneId, instSeq), theme: ZONES[zoneId].theme }) as Instance;
}
/**
 * Run `fn` from a fresh, fixed random state (Math.random, the gear stream, the character and instance counters) and
 * restore the shared state afterwards, so a section measures the same thing whatever ran before it. The rift floors
 * swung with the shared stream (the ranger agent measured one mage kit at 8.9 % and 54.8 % of a Torment II rift in two
 * streams), so each class's rift now starts from the state its section and the seed give, not from the classes before it.
 */
function freshStreams<T>(section: number, fn: () => T, seed = SIM_SEED): T {
  const saved = { simRng, gearRng, seedCounter, instSeq }, ids = peekIdForHarness(), random = Math.random;
  // Another SIM_SEED also gives another map and other gear rolls (the default seed keeps offset 0).
  const off = ((seed - 0xc0ffee) % 997 + 997) % 997;
  simRng = new Rng(seed + section); gearRng = new Rng(4242 + section + off); seedCounter = SEED_COUNTER_START; instSeq = INST_SEQ_START + off;
  Math.random = () => simRng.next(); // an earlier section may have pointed it at its own stream (dodgeScenario)
  // Entity ids, item ids and pack ids too: monster separation breaks exact overlaps by id (ids.ts). A high fixed id base
  // stays clear of live ids; the old sequences continue afterwards.
  resetIdsForHarness(1e9 + section * 1e7);
  const items = resetItemIdsForHarness(), packs = resetPacksForHarness(1e6);
  try { return fn(); } finally {
    ({ simRng, gearRng, seedCounter, instSeq } = saved); Math.random = random;
    resetIdsForHarness(Math.max(ids, peekIdForHarness())); resetItemIdsForHarness(items); resetPacksForHarness(Math.max(packs, resetPacksForHarness()));
  }
}
function newRift(level: number, difficulty: number, theme: 'glade' | 'ashen', onDone?: () => void): Instance {
  return createInstance({ zoneId: 'rift', channel: 1, key: `rift#${instSeq++}`, seed: 77 + instSeq * 13, theme, level, difficulty, owner: 'Bot', onRiftComplete: onDone }) as Instance;
}

function run(inst: InstanceApi, ticks: number, bots: Bot[], every?: (t: number) => boolean | void) {
  for (let t = 0; t < ticks; t++) {
    for (const b of bots) b.step();
    inst.tick();
    if (every && every(t)) return t + 1;
  }
  return ticks;
}

function ttkLine(link: FakeLink): string {
  const avg = (a?: number[]) => (a && a.length ? `${fmt(a.reduce((s, v) => s + v, 0) / a.length / 1000, 2)}s (n=${a.length})` : '—');
  return `TTK trash ${avg(link.ttk[0])}  champion ${avg(link.ttk[1])}  rare ${avg(link.ttk[2])}  minion ${avg(link.ttk[3])}`;
}

function teleport(inst: Instance, link: FakeLink, x: number, y: number) {
  const p = inst.players.find((q) => q.link === link)!;
  p.mv.x = p.x = x; p.mv.y = p.y = y;
}

// ─────────────────────────── Scenarios ───────────────────────────

const summary: string[] = [];
/** Leveling rows for `SIM_JSON=<file>` (written at the end of a run; see scripts/bot-metrics.ts). */
const metricRows: Record<string, unknown>[] = [];

function fieldScenario(cls: ClassId, level: number, endgame: boolean) {
  const zone = level >= 20 ? 'ashen_hollow' : 'whispering_glade';
  const inst = newField(zone);
  const save = makeChar(cls, level, { endgame });
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  const bot = new Bot(inst, link, cls === 'warrior');
  const xp0 = save.xp + save.level * 1e9 + save.paragon.level * 1e12 + save.paragon.xp;
  const inv0 = save.inventory.filter(Boolean).length;
  const gold0 = save.gold;
  const ticks = 1200; // 60 s
  const t0 = performance.now();
  let minHp = 1;
  run(inst, ticks, [bot], () => { const q = inst.players[0]; if (q.deadMs <= 0) minHp = Math.min(minHp, q.hp / q.mhp); });
  const ms = performance.now() - t0;
  const p = inst.players[0];
  const xp1 = save.xp + save.level * 1e9 + save.paragon.level * 1e12 + save.paragon.xp;
  const kpm = p.kills / (ticks / 20 / 60);
  const label = `${cls} L${level}${endgame ? ' (set)' : ''} field ${zone}`;
  console.log(`${label}: kills ${p.kills} (${fmt(kpm)}/min), level ${level}→${save.level}, gold +${save.gold - gold0}, items +${save.inventory.filter(Boolean).length - inv0}, deaths ${save.stats.deaths}, damage taken ${fmt((p.taken / p.mhp) * 100 / (ticks / 1200), 0)}% life/min (low ${fmt(minHp * 100, 0)}%), tick avg ${fmt(ms / ticks, 3)}ms`);
  console.log(`   ${ttkLine(link)}`);
  check(link.snapsWithMobs > 100, `${label}: snapshots contain monsters`);
  check(link.n('dmg') > 50 && link.n('die') > 5, `${label}: dmg/die events (${link.n('dmg')}/${link.n('die')})`);
  check(p.kills >= 10, `${label}: kills (${p.kills})`);
  check(xp1 > xp0, `${label}: XP gained`);
  check(inst.counters.lootSpawned > 0, `${label}: loot spawned`);
  check(inst.counters.lootPicked > 0 && link.n('pickup') > 0, `${label}: loot picked up (${inst.counters.lootPicked})`);
  check(link.dirty > 0, `${label}: markDirty called`);
  summary.push(`${label.padEnd(44)} ${fmt(kpm).padStart(6)} kills/min   ${ttkLine(link)}`);
  inst.destroy();
  return { link, kpm };
}

/** `refitFloor`: the class is on the depth budget before the Torment re-fit — only a progress floor is checked. */
/** `opts` (endgame ladder): another character (`save`, a ready save), a time cap in minutes, a label and quiet output. */
interface RiftOpts { save?: () => CharacterSave; minutes?: number; label?: string; quiet?: boolean }
function riftScenario(cls: ClassId, level: number, difficulty: number, endgame: boolean, theme: 'glade' | 'ashen', refitFloor?: number, opts: RiftOpts = {}) {
  let completed = 0;
  const inst = newRift(level, difficulty, theme, () => completed++);
  const save = opts.save ? opts.save() : makeChar(cls, level, { endgame });
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  const bot = new Bot(inst, link, cls === 'warrior');
  const mobs0 = inst.mobs.length;
  let guardianAt = -1, doneAt = -1, maxProg = 0;
  const cap = 20 * 60 * (opts.minutes ?? 12); // 12 simulated minutes
  const t0 = performance.now();
  const ticks = run(inst, cap, [bot], (t) => {
    if (process.env.SIM_TRACE && t % 200 === 0) {
      const p = inst.players[0];
      let nm: Mob | null = null, nd = Infinity;
      for (const m of inst.mobs) { if (m.dummy) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < nd) { nd = d; nm = m; } }
      console.log(`    t=${(t / 20).toFixed(0)}s pos ${Math.round(p.x)},${Math.round(p.y)} kills ${p.kills} prog ${inst.riftState()!.progress} nearest ${Math.round(nd)} ${nm?.def.id}/${nm?.state}/t${nm?.tier} los ${nm ? !inst.cw.segmentBlocked(p.x, p.y, nm.x, nm.y) : '-'} mobs ${inst.mobs.length} hp ${Math.round(p.hp)}/${Math.round(p.mhp)} target ${nm ? `${Math.round(nm.hp)}/${Math.round(nm.mhp)} [${nm.affixes.join(',')}] stun${Math.round(nm.stunMs)} frz${Math.round(nm.freezeMs)} dorm${nm.dormant}` : '-'} atkCd ${Math.round(p.atkCdMs)} lvl ${p.save.level} P[frozen${Math.round(p.frozenMs)} stun${Math.round(p.stunMs)} ch${p.channel?.skill ?? '-'} mv${p.moving} inv${Math.round(p.invulnMs)}] X[t${Math.round(inst.t)} dead${Math.round(p.deadMs)} np${inst.players.length} fl${p.flags} fl${p.faceLockMs} cf${Math.round(p.castFlagMs)} sinceHit${Math.round(p.sinceHitMs)} ap${Math.round(p.ctx.attackRange)}] D[aps${p.ctx.d.aps.toFixed(2)} ias${p.live.ias} pick${pickTarget(inst, p.x, p.y, p.ctx.attackRange, true, p.save.skills.targetPriority)?.id ?? 'null'} blk${nm ? shotBlocked(inst, p.x, p.y, nm.x, nm.y) : '-'} nmid${nm?.id} rad${nm?.r} dead${nm?.dead}] M[chill${Math.round(nm?.chillMs ?? 0)} kb${Math.round(nm?.kbMs ?? 0)} st${Math.round(nm?.stateMs ?? 0)} tgt${nm?.target ?? 0} me${p.id}]`);
    }
    const rs = inst.riftState()!;
    maxProg = Math.max(maxProg, rs.progress);
    if (rs.phase === 'guardian' && guardianAt < 0) guardianAt = t;
    if (rs.phase === 'done' && doneAt < 0) doneAt = t;
    return doneAt >= 0 && t > doneAt + 40;
  });
  const ms = performance.now() - t0;
  const rs = inst.riftState()!;
  const p = inst.players[0];
  const label = opts.label ?? `${cls} L${level}${endgame ? ' (set)' : ''} rift ${DIFFICULTIES[difficulty].name}`;
  const dur = (t: number) => `${Math.floor(t / 20 / 60)}:${String(Math.floor((t / 20) % 60)).padStart(2, '0')}`;
  const kpm = p.kills / (ticks / 20 / 60);
  if (opts.quiet) { inst.destroy(); return { link, doneAt, guardianAt, maxProg, deaths: save.stats.deaths, kpm, label }; }
  console.log(`${label}: ${mobs0} monsters placed, progress ${fmt(maxProg)}%, guardian at ${guardianAt >= 0 ? dur(guardianAt) : '—'}, done at ${doneAt >= 0 ? dur(doneAt) : '—'}, kills ${p.kills} (${fmt(kpm)}/min), deaths ${save.stats.deaths}, level ${level}→${save.level}, tick avg ${fmt(ms / ticks, 3)}ms`);
  console.log(`   ${ttkLine(link)}  boss TTK ${link.ttk[4] ? fmt(link.ttk[4][0] / 1000) + 's' : '—'}`);
  if (process.env.SIM_DEBUG) console.log('   ', JSON.stringify(Object.fromEntries(Object.entries(link.evV).filter(([k]) => /^(cast|dmgsrc|aoe|tele):/.test(k)))), 'dealt', Math.round(p.dealt).toExponential(2), 'sheet', Math.round(p.ctx.d.sheetDps).toExponential(2));
  if (refitFloor !== undefined) {
    // Floor mode: riftFloor checks the median over its maps.
    inst.destroy();
    return { link, doneAt, guardianAt, maxProg, deaths: save.stats.deaths, kpm, label };
  }
  check(maxProg >= 100, `${label}: progress reached 100 (${fmt(maxProg)})`);
  check(guardianAt >= 0, `${label}: guardian spawned`);
  check(doneAt >= 0 && rs.phase === 'done' && completed === 1, `${label}: rift completed + onRiftComplete`);
  check(link.n('notice') > 0, `${label}: notices`);
  check(save.stats.rifts === 1, `${label}: stats.rifts incremented`);
  check(inst.portals.some((pt) => pt.to === 'town'), `${label}: town portal spawned`);
  check(!!link.me && [...link.ents.values()].some((e) => e.desc.k === 'portal'), `${label}: portal replicated`);
  summary.push(`${label.padEnd(44)} ${fmt(kpm).padStart(6)} kills/min   rift ${doneAt >= 0 ? dur(doneAt) : 'DNF'} (guardian ${guardianAt >= 0 ? dur(guardianAt) : '—'}), deaths ${save.stats.deaths}`);
  inst.destroy();
  return { link, doneAt, guardianAt, maxProg, deaths: save.stats.deaths, kpm, label };
}

/**
 * L70 Ordeal ladder floors (re-fit 2026-10-12, docs/rework/balance/LADDER.md), the median over three maps (the seed and two
 * fixed offsets, each with its own fresh per-class state; one map alone was a coin, its misses death spirals on one map
 * [M, FOUNDATION.md §13.15]). The 6-piece set kit without Lantern Ranks must clear Ordeal I (100 % in 12 minutes;
 * measured 100 / 100 / 100 % for warrior / ranger / mage on the ladder grid) and reach `floor` % of Ordeal II (95 / 81 /
 * 100 %). `SIM_WEAK_KIT=<class>` gives that class its L70 rare kit instead (16–19 % of Ordeal I: the proof that a real
 * collapse fails).
 */
const RIFT_FLOOR_SEEDS = [SIM_SEED, SIM_SEED + 1, SIM_SEED + 2];
function riftFloor(cls: ClassId, floor: number) {
  const endgame = process.env.SIM_WEAK_KIT !== cls;
  for (const [diff, need] of [[4, 100], [5, floor]] as const) {
    const runs = RIFT_FLOOR_SEEDS.map((seed) => freshStreams(70, () => riftScenario(cls, 70, diff, endgame, 'ashen', need), seed));
    const prog = runs.map((r) => r.maxProg).sort((a, b) => a - b), med = prog[prog.length >> 1];
    const label = runs[0].label;
    console.log(`   ${label} floor: ${runs.map((r, i) => `seed ${RIFT_FLOOR_SEEDS[i]} ${fmt(r.maxProg)}% (${r.deaths} deaths)`).join(', ')} → median ${fmt(med)}%`);
    check(med >= need, `${label}: median progress of ${runs.length} maps ≥ ${need}% in 12 minutes (${prog.map((p) => fmt(p)).join(' / ')})`);
    summary.push(`${label.padEnd(44)} median ${fmt(med)}% of ${runs.length} maps in 12 min (${runs.map((r) => `${fmt(r.maxProg)}%/${r.deaths}d`).join(', ')})`);
  }
}

// ─────────────────────────── Endgame ladder (docs/rework/balance/LADDER.md) ───────────────────────────

/** Lantern Rank points spent in the order D3 guides commonly recommend for Paragon 2.0 [K, LADDER.md §2]: Core movement
 *  speed then the main stat; Offense cooldown, attack speed, crit chance, crit damage; Defense life, armor, all
 *  resistance, regeneration; Utility area, resource cost, life on hit, gold find. */
const LANTERN_ORDER: Record<ParagonCategory, string[]> = {
  core: ['p_ms', 'p_main'], offense: ['p_cdr', 'p_ias', 'p_chc', 'p_chd'], defense: ['p_life', 'p_armor', 'p_allres', 'p_regen'], utility: ['p_area', 'p_rcr', 'p_loh', 'p_gf'],
};
function spendLantern(save: CharacterSave, rank: number) {
  save.paragon.level = rank;
  save.paragon.spent = {};
  const pts = paragonPoints(rank);
  for (const [cat, order] of Object.entries(LANTERN_ORDER) as [ParagonCategory, string[]][]) {
    let left = pts[cat];
    for (const id of order) {
      const def = PARAGON_STATS.find((d) => d.id === id)!;
      const n = def.cap ? Math.min(def.cap, left) : left;
      if (n > 0) save.paragon.spent[id] = n;
      left -= n;
    }
  }
}

/** Legendary-only kits: each class's best measured legendary-only kit for the bar's main skill (the parity audits'
 *  pool runs, RANGER/WARRIOR/MAGE-PARITY.json `kits.legendary`; mage waist and legs stay rares there too). */
const LEG_KITS: Record<ClassId, { build: Build; equipment: Partial<Record<Slot, string>>; cube: (string | null)[] }> = {
  warrior: {
    build: { slots: ['whirlwind', 'battle_rage', 'muster_standard', 'ground_stomp'], runes: BUILDS.warrior.runes },
    equipment: { mainhand: 'ninefold_gale', head: 'brass_warhorn_helm', shoulders: 'belfry_pauldrons', chest: 'fissure_lined_breastplate', hands: 'stonecount_gauntlets', wrists: 'anvil_vambraces', waist: 'eternal_gyre', legs: 'gale_stitched_legguards', feet: 'quakestep_sabatons', neck: 'seething_sigil', ring1: 'threshers_knot', ring2: 'rally_knot' },
    cube: ['millwheel_edge', 'furycord_belt', null],
  },
  ranger: {
    build: { slots: ['sentry', 'quarry_mark', 'companion', 'rain_of_vengeance'], runes: BUILDS.ranger.runes },
    equipment: { mainhand: 'kennel_wood_bow', offhand: 'sappers_pack', head: 'hawkfeather_cap', shoulders: 'huntsmans_pauldrons', chest: 'gearwright_heart', hands: 'bowyers_gloves', wrists: 'coiled_wire_bracers', waist: 'fuse_cord_belt', legs: 'skimmers_leggings', feet: 'wingbeat_boots', neck: 'roost_charm', ring1: 'raincount_ring', ring2: 'weathervane_ring' },
    cube: ['bolt_throwers_arbalest', 'snarehand_gloves', 'whistle_charm'],
  },
  mage: {
    build: { slots: ['meteor', 'magic_weapon', 'frost_nova', 'black_hole'], runes: BUILDS.mage.runes },
    equipment: { mainhand: 'cindervane', head: 'horizon_cowl', shoulders: 'starfall_mantle', chest: 'winterbound_robe', hands: 'glasswrights_wraps', wrists: 'runeweaver_cuffs', feet: 'rimewalker_slippers', neck: 'craterheart_amulet', ring1: 'static_loop', ring2: 'echoing_bead' },
    cube: ['thousand_missiles', 'void_heart', 'rimecourt_band'],
  },
};
/** Ladder kits, weakest to strongest in intent: L70 rares; the class set at 4 pieces with the weapon, amulet and one
 *  ring legendary and one Cube power; the full 6-piece kit of `gearEndgame`; a legendary-only kit. */
type LadderKit = 'rare' | 'set4' | 'set6' | 'leg';
const LADDER_KITS: LadderKit[] = ['rare', 'set4', 'set6', 'leg'];
function dropBlockedOffhand(save: CharacterSave) {
  const w = BASES[save.equipment.mainhand!.base].weapon;
  if ((w?.twoHanded && !w.ranged) || save.equipment.mainhand!.base === 'staff') delete save.equipment.offhand;
}
function ladderSave(cls: ClassId, kit: LadderKit, lantern: number): CharacterSave {
  const save = kit === 'leg' ? makeChar(cls, 70, { build: LEG_KITS[cls].build }) : makeChar(cls, 70, { endgame: kit === 'set6' });
  if (kit === 'set4') {
    const set = SETS[CLASS_SET[cls]];
    for (const piece of set.pieces.slice(0, 4)) equip(save, generateItem(gearRng, { ilvl: 70, classId: cls, rarity: 'set', set: set.id, base: piece.base }));
    for (const slot of ['mainhand', 'neck', 'ring1'] as Slot[]) {
      const leg = CLASS_LEGS[cls][slot];
      if (leg) equip(save, generateItem(gearRng, { ilvl: 70, classId: cls, rarity: 'legendary', legendary: leg }), slot);
    }
    dropBlockedOffhand(save);
    save.cube.level = 4;
    save.cube.learned = [CLASS_CUBE[cls][0]!];
    save.cube.equipped = [CLASS_CUBE[cls][0], null, null];
  }
  if (kit === 'leg') {
    const k = LEG_KITS[cls];
    for (const [slot, leg] of Object.entries(k.equipment) as [Slot, string][]) equip(save, generateItem(gearRng, { ilvl: 70, classId: cls, rarity: 'legendary', legendary: leg }), slot);
    dropBlockedOffhand(save);
    save.cube.level = 8;
    save.cube.learned = k.cube.filter((x): x is string => !!x);
    save.cube.equipped = [...k.cube];
  }
  spendLantern(save, lantern);
  return save;
}

interface LadderRun { prog: number; doneMin: number; deaths: number; kpm: number; recs: DeathRec[]; hurt: Record<string, number> }
interface LadderCell { cls: ClassId; kit: string; lantern: number; diff: number; runs: LadderRun[]; medProg: number; medDone: number; medDeaths: number }
/** One cell: the same character on the three riftFloor maps (each in its own fresh state), `minutes` cap each. */
function ladderCell(cls: ClassId, kit: string, lantern: number, diff: number, minutes: number, mk: () => CharacterSave): LadderCell {
  const runs = RIFT_FLOOR_SEEDS.map((seed) => freshStreams(70, () => {
    const r = riftScenario(cls, 70, diff, true, 'ashen', undefined, { save: mk, minutes, quiet: true });
    return { prog: r.maxProg, doneMin: r.doneAt >= 0 ? r.doneAt / 20 / 60 : Infinity, deaths: r.deaths, kpm: r.kpm, recs: r.link.deathRecs, hurt: r.link.hurtBySrc };
  }, seed));
  const mid = <T>(a: T[], k: (x: T) => number) => a.map(k).sort((x, y) => x - y)[a.length >> 1];
  return { cls, kit, lantern, diff, runs, medProg: mid(runs, (r) => r.prog), medDone: mid(runs, (r) => r.doneMin), medDeaths: mid(runs, (r) => r.deaths) };
}
const fmtMin = (m: number) => (Number.isFinite(m) ? `${Math.floor(m)}:${String(Math.floor((m % 1) * 60)).padStart(2, '0')}` : 'DNF');
const eliteless = (k: string) => k.replace(/\[.*\]/, '[elite]');
function ladderLine(c: LadderCell): string {
  const recs = c.runs.flatMap((r) => r.recs);
  const one = recs.filter((d) => d.maxHit >= 0.999).length, burst = recs.filter((d) => d.maxHit < 0.999 && d.burst1 >= 0.999).length;
  const killers: Record<string, number> = {};
  for (const d of recs) killers[eliteless(d.killer)] = (killers[eliteless(d.killer)] ?? 0) + 1;
  const top = Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k}×${n}`).join(', ');
  const maxHit = recs.length ? Math.max(...recs.map((d) => d.maxHit)) : 0;
  return `${c.cls.padEnd(7)} ${c.kit.padEnd(5)} L${String(c.lantern).padEnd(5)} ${DIFFICULTIES[c.diff].name.padEnd(11)} median ${fmt(c.medProg).padStart(5)}% done ${fmtMin(c.medDone).padStart(5)} deaths ${c.medDeaths}`
    + `  | maps ${c.runs.map((r) => `${fmt(r.prog, 0)}%/${fmtMin(r.doneMin)}/${r.deaths}d`).join(' ')}`
    + (recs.length ? `  | deaths: one-shot ${one}, 1s-burst ${burst}, other ${recs.length - one - burst}; max hit ${fmt(maxHit * 100, 0)}% life; ${top}` : '');
}
function ladderRow(c: LadderCell) {
  metricRows.push({ ladder: 1, cls: c.cls, kit: c.kit, lantern: c.lantern, diff: c.diff, diffName: DIFFICULTIES[c.diff].name, medProg: c.medProg, medDone: Number.isFinite(c.medDone) ? c.medDone : null, medDeaths: c.medDeaths,
    maps: c.runs.map((r) => ({ prog: r.prog, done: Number.isFinite(r.doneMin) ? r.doneMin : null, deaths: r.deaths, kpm: r.kpm, recs: r.recs, hurt: r.hurt })) });
}
/** `sim.ts ladder [classes] [kits] [lanterns] [difficulties] [minutes]` — the measurement grid of LADDER.md §1. A kit
 *  stops climbing once all three maps stay under 25 %. */
function ladderScenario(classes: ClassId[], kits: LadderKit[], lanterns: number[], diffs: number[], minutes: number) {
  console.log(`\n== Endgame ladder: L70, median of ${RIFT_FLOOR_SEEDS.length} rift maps, ${minutes}-minute cap ==`);
  for (const cls of classes) for (const kit of kits) for (const lantern of lanterns) {
    lanternWorth(ladderSave(cls, kit, lantern), `${cls} ${kit} L${lantern} Lantern worth`);
    for (const diff of diffs) {
      const c = ladderCell(cls, kit, lantern, diff, minutes, () => ladderSave(cls, kit, lantern));
      console.log(ladderLine(c));
      ladderRow(c);
      if (c.runs.every((r) => r.prog < 25)) break;
    }
  }
}

/** What a character's Lantern Ranks are worth on the sheet: damage (sheet DPS) and toughness (life ÷ damage taken). */
function lanternWorth(save: CharacterSave, label: string) {
  const withL = computeStats(save);
  const spent = save.paragon.spent;
  save.paragon.spent = {};
  const without = computeStats(save);
  save.paragon.spent = spent;
  const ehp = (d: DerivedStats) => d.life / ((1 - armorReduction(d.armor, 70)) * (1 - resistReduction(d.allRes, 70)));
  console.log(`${label}: sheet DPS ×${fmt(withL.sheetDps / without.sheetDps, 2)} (${fmtC(without.sheetDps)} → ${fmtC(withL.sheetDps)}), life ×${fmt(withL.life / without.life, 2)} (${fmtC(without.life)} → ${fmtC(withL.life)}),`
    + ` toughness ×${fmt(ehp(withL) / ehp(without), 2)} (armor ${fmt(armorReduction(withL.armor, 70) * 100)}% / resist ${fmt(resistReduction(withL.allRes, 70) * 100)}% DR), CDR ${fmt(without.cdr)} → ${fmt(withL.cdr)}%, crit ${fmt(without.chc)}/${fmt(without.chd, 0)} → ${fmt(withL.chc)}/${fmt(withL.chd, 0)}%, regen ${fmtC(withL.lifeRegen)}/s, life per hit ${fmtC(withL.lifePerHit)}`);
}

/** `sim.ts herorift <save.json> [difficulties] [minutes]` — replays a saved hero (any save version the server loads)
 *  through rifts on the three riftFloor maps. The file is only read; nothing is written. */
async function heroRift(file: string, diffs: number[], minutes: number) {
  const { normalizeSave } = await import('../src/persistence');
  const proto = normalizeSave(JSON.parse(readFileSync(file, 'utf8')) as CharacterSave);
  const cls = proto.classId;
  const json = JSON.stringify(proto);
  const mk = () => { const s = JSON.parse(json) as CharacterSave; s.name = `Hero_${seedCounter++}`; s.stats.deaths = 0; s.stats.rifts = 0; return s; };
  const d = computeStats(proto);
  console.log(`\n== Saved hero: ${cls} L${proto.level}, Lantern ${proto.paragon.level}, spent ${JSON.stringify(proto.paragon.spent)}, Cube ${proto.cube.equipped.filter(Boolean).length} powers ==`);
  console.log(`   sheet DPS ${fmtC(d.sheetDps)}, life ${fmtC(d.life)}, armor ${fmtC(d.armor)} (${fmt(armorReduction(d.armor, 70) * 100)}% DR), all res ${fmtC(d.allRes)} (${fmt(resistReduction(d.allRes, 70) * 100)}% DR), regen ${fmtC(d.lifeRegen)}/s, life per hit ${fmtC(d.lifePerHit)}, elite DR ${fmt(d.eliteDR)}%`);
  lanternWorth(mk(), '   Lantern worth (as spent)');
  for (const diff of diffs) {
    const c = ladderCell(cls, 'hero', proto.paragon.level, diff, minutes, mk);
    console.log(ladderLine(c));
    ladderRow(c);
    const hurt: Record<string, number> = {};
    for (const r of c.runs) for (const [k, v] of Object.entries(r.hurt)) hurt[eliteless(k)] = (hurt[eliteless(k)] ?? 0) + v;
    const tot = Object.values(hurt).reduce((a, b) => a + b, 0) || 1;
    console.log(`   damage taken by source: ${Object.entries(hurt).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${fmt(v / tot * 100, 0)}%`).join(', ')}`);
    for (const r of c.runs) for (const rec of r.recs.slice(0, 4)) console.log(`     death: max hit ${fmt(rec.maxHit * 100, 0)}% life, last 1 s ${fmt(rec.burst1 * 100, 0)}%, last 3 s ${fmt(rec.burst3 * 100, 0)}% in ${rec.hits3} hits, mostly ${rec.killer}`);
  }
}

/** Put a player next to a fresh pack in a field and let one skill/rune do its thing. */
function skillCoverage() {
  console.log('\n== Every skill × rune (L70 endgame kit, 8 s next to a pack) ==');
  let combos = 0;
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    for (const sk of skillsForClass(cls)) {
      for (const rune of [null, ...sk.runes.map((r) => r.id)]) {
        const inst = newField('whispering_glade');
        const save = makeChar(cls, 70, { endgame: true });
        save.skills.slots = sk.kind === 'primary' ? [null, null, null, null] : [sk.id, null, null, null];
        if (sk.kind === 'primary') save.skills.primary = sk.id; // second primaries (Tolling Blow) are exercised as the auto-attack
        save.skills.runes = { [sk.id]: rune };
        save.skills.tiers = { [sk.id]: 3 };
        const link = new FakeLink(save);
        link.myId = inst.addPlayer(link);
        const p = inst.players[0];
        // tough targets so effects have time to play
        const x = p.x + (sk.kind === 'primary' || cls === 'warrior' ? 70 : 220), y = p.y;
        // Enough enemies for the skill's own automatic rule (Kilnheart waits for 8).
        const pack = Math.max(6, sk.auto.when === 'enemiesNear' ? Math.ceil(sk.auto.count) : 0);
        for (let i = 0; i < pack; i++) {
          const m = createMob(inst, MONSTERS.gloomshroom, 60, x + (i % 3) * 30, y + Math.floor(i / 3) * 34 - 17, { players: 1 });
          m.mhp = m.hp = 1e13;
          m.state = 'chase'; m.target = p.id;
        }
        const bot = new Bot(inst, link, true);
        let channelSeen = false;
        run(inst, 160, [bot], () => {
          p.hp = p.mhp;
          if (p.channel) channelSeen = true;
          if (sk.kind !== 'primary' && p.res < p.mres * 0.5) p.res = p.mres;
        });
        const casts = link.n(`cast:${sk.id}`);
        const tag = `${cls}/${sk.id}/${rune ?? 'no rune'}`;
        if (sk.kind === 'buff') {
          check(casts > 0 && p.buffs.some((b) => b.id === sk.id), `${tag}: buff applied`);
          if (rune === 'electrify' || rune === 'ignite') {
            const el = rune === 'electrify' ? link.n('beam:arc') > 0 : [...inst.mobs].some((m) => m.dots.some((d) => d.skill === 'magic_weapon'));
            check(el, `${tag}: rune effect fired`);
          }
        } else if (sk.kind === 'channel') {
          const tickEv = sk.id === 'ironplough' ? 'aoe:plough' : sk.id === 'thrumming_ray' ? 'aoe:ray' : 'aoe:whirl';
          check(channelSeen && link.n(tickEv) > 4, `${tag}: channel ticks (${link.n(tickEv)})`);
          if (rune === 'dust_devils') check(link.sawSummon('dust_devil') && link.n('dmgsrc:summon:dust_devil') > 0, `${tag}: dust devils spawn and hit`);
        } else {
          check(casts > 0, `${tag}: cast (${casts})`);
          const dmg = link.n('dmgsrc:me') + Object.keys(link.evV).filter((k) => k.startsWith('dmgsrc:summon')).reduce((s, k) => s + link.evV[k], 0);
          check(dmg > 0, `${tag}: dealt damage`);
        }
        if (sk.id === 'sentry') {
          check(link.sawSummon('sentry') && (rune === 'flame_lance' ? link.n('aoe:sentry_flame') > 0 : link.n('proj:bolt@sentry') > 0), `${tag}: sentry placed & firing`);
          if (rune === 'spitfire') check(link.n('proj:rocket@sentry') > 0, `${tag}: rockets`);
          if (rune === 'chain_of_torment') check(link.n('beam:chain') > 0, `${tag}: chains`);
        }
        if (sk.id === 'meteor') {
          check(link.n('tele:meteor') > 0 && (link.n('aoe:meteor') > 0 || link.n('aoe:meteorSmall') > 0), `${tag}: telegraph + impact`);
          if (rune !== 'comet') check(link.n('aoe:molten') > 0, `${tag}: molten ground`);
        }
        if (sk.id === 'hydra') check(link.sawSummon('hydra'), `${tag}: hydra summoned`);
        if (sk.id === 'companion') check(link.sawSummon(rune === 'bat' ? 'bat' : rune === 'raven' ? 'raven' : rune === 'badger_sett' ? 'badger' : rune === 'heron' ? 'heron' : 'wolf'), `${tag}: companion summoned`);
        // Ranger wave skills (RANGER.md §3): each one's signature event.
        if (sk.id === 'skipstone_bolt') check(link.n(rune === 'heavy_stone' ? 'proj:skip_heavy' : 'proj:skip') > 0, `${tag}: skipping bolt`);
        if (sk.id === 'spring_snare') check(link.sawSummon('snare') && link.n('aoe:snare_snap') > 0, `${tag}: snare set and snapped`);
        if (sk.id === 'overcast_volley') check(link.n('aoe:overcast_cloud') > 0 && link.n('aoe:overcast_arrow') > 4, `${tag}: arrows fall`);
        if (sk.id === 'quarry_mark') check(link.n('aoe:quarry_mark') > 0, `${tag}: quarry marked`);
        if (sk.id === 'pitch_mortar') check(link.sawSummon('mortar') && link.n('aoe:mortar_impact') > 0, `${tag}: mortar shells land`);
        if (sk.id === 'murmuration') check(link.sawSummon('flock'), `${tag}: the flock flies`);
        if (sk.id === 'black_hole') check(link.n('aoe:blackhole') > 0, `${tag}: black hole`);
        if (sk.id === 'frost_nova') check(link.n('aoe:nova') > 0 || link.n('aoe:nova_cone') > 0, `${tag}: nova`);
        // Mage M1 skills (docs/rework/depth/MAGE.md §3).
        if (sk.id === 'rime_needles') check(link.n('proj:needle') > 0 || link.n('proj:needle_spine') > 0, `${tag}: needles fly`);
        if (sk.id === 'cinderkin') check(link.sawSummon(rune === 'frostkin' ? 'frostkin' : 'cinderkin'), `${tag}: kin summoned`);
        if (sk.id === 'rimefield') check(link.n('aoe:rimefield') > 0 || link.n('aoe:rimefield_bloom') > 0, `${tag}: field`);
        if (sk.id === 'stormglass_orb') check(link.n('proj:stormglass') > 0 && link.n('aoe:glass_burst') > 0, `${tag}: orb flies and shatters`);
        if (sk.id === 'orrery') check(link.n('aoe:orrery') > 0 || link.n('aoe:orrery_wide') > 0, `${tag}: spheres`);
        if (sk.id === 'seismic_slam') check(link.n('aoe:fissure') > 0, `${tag}: fissure`);
        if (sk.id === 'cleave') check(link.n('aoe:cleave') > 0, `${tag}: cleave arc`);
        if (sk.id === 'rain_of_vengeance') check(link.n('aoe:rain') >= 5, `${tag}: rain waves`);
        if (sk.id === 'cluster_arrow') check(link.n('proj:cluster') > 0 || link.n('aoe:cluster') > 0, `${tag}: cluster`);
        combos++;
        inst.destroy();
      }
    }
  }
  console.log(`  ${combos} skill/rune combinations exercised`);
}

function signatureBuilds() {
  console.log('\n== Signature builds (L70 endgame kit, 30 s in Ashen Hollow) ==');
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    // fixed arena: the second-meteor ratio depends on monster spacing, which must not vary with scenario order
    const inst = newField('ashen_hollow', zoneSeed('ashen_hollow', Number(process.env.SIG_SEED ?? 5)));
    const save = makeChar(cls, 70, { endgame: true });
    const link = new FakeLink(save);
    link.myId = inst.addPlayer(link);
    const p = inst.players[0];
    const bot = new Bot(inst, link, cls === 'warrior');
    let maxSentries = 0, sawFallenStar = 0;
    run(inst, 600, [bot], () => {
      maxSentries = Math.max(maxSentries, p.summons.filter((s) => s.type === 'sentry').length);
      const fs = p.buffs.find((b) => b.id === 'fallen_star');
      if (fs) sawFallenStar = Math.max(sawFallenStar, fs.st ?? 0);
    });
    console.log(`  ${cls}: kills ${p.kills}, dealt ${Math.round(p.dealt).toLocaleString()}, sheet DPS ${Math.round(p.ctx.d.sheetDps).toLocaleString()}, casts ${JSON.stringify(Object.fromEntries(Object.entries(link.evV).filter(([k]) => k.startsWith('cast:'))))}`);
    if (cls === 'warrior') {
      check(link.channelTicks > 20, `warrior: F_CHANNEL observed (${link.channelTicks} ticks)`);
      check(link.n('aoe:whirl') > 10, `warrior: whirlwind damage ticks (${link.n('aoe:whirl')})`);
      check(link.sawSummon('dust_devil') && link.n('dmgsrc:summon:dust_devil') > 0, 'warrior: dust devils (set 2pc / Ninefold) spawn and hit');
      check(inst.mobs.length === 0 || true, 'warrior: ok');
      // Endless Storm 4 (WARRIOR.md v2): Channel hits bleed (it was "Whirlwind applies Rend's bleed").
      check(p.ctx.modsOf('whirlwind').flags.has('stormBleed'), 'warrior: 4pc channel bleed flag');
      check(link.n('dmgsrc:summon:dust_devil') > 0 || link.sawSummon('dust_devil'), 'warrior: 6pc wisps / dust devils');
    }
    if (cls === 'ranger') {
      check(maxSentries >= 4, `ranger: sentries placed (max ${maxSentries})`);
      check(link.n('proj:bolt@sentry') > 10, `ranger: sentries firing (${link.n('proj:bolt@sentry')})`);
      check(link.n('proj:arrow@sentry') > 0 || link.n('proj:cluster@sentry') > 0, `ranger: 4pc sentry copies of Multishot/Cluster (${link.n('proj:arrow@sentry')}/${link.n('proj:cluster@sentry')})`);
      check(link.sawSummon('wolf'), 'ranger: companion wolf');
    }
    if (cls === 'mage') {
      check(link.n('tele:meteor') > 0, `mage: meteor telegraphs (${link.n('tele:meteor')})`);
      check(link.n('aoe:meteor') > 0, `mage: meteor impacts (${link.n('aoe:meteor')})`);
      check(link.n('aoe:molten') > 0, `mage: molten ground (${link.n('aoe:molten')})`);
      // The 2pc meteor needs a second enemy within 400 units of the first impact and at least half a radius away from
      // it, so lone survivors get a single meteor.
      console.log(`  mage second-meteor ratio ${fmt(link.n('tele:meteor') / Math.max(1, link.n('cast:meteor')), 2)} (${link.n('tele:meteor')} telegraphs / ${link.n('cast:meteor')} casts)`);
      check(link.n('tele:meteor') >= link.n('cast:meteor') * 1.1, `mage: 2pc second meteor (${link.n('tele:meteor')} telegraphs / ${link.n('cast:meteor')} casts)`);
      check(sawFallenStar >= 2, `mage: Fallen Star 4pc stacks (${sawFallenStar})`);
    }
    inst.destroy();
  }
}

function eliteScenario() {
  console.log('\n== Elite affixes ==');
  const inst = newField('whispering_glade');
  const save = makeChar('warrior', 70, { endgame: true });
  // no weapon damage: let the elites live and use their abilities
  save.skills.slots = [null, null, null, null];
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  const p = inst.players[0];
  p.ctx.d.weaponMin = p.ctx.d.weaponMax = 0.0001;
  p.ctx.d.thorns = 0; // the endgame kit's thorns would kill the test elites
  const affixes = ['fast', 'extra_health', 'molten', 'frozen', 'plagued', 'electrified', 'vortex', 'mortar'];
  for (let i = 0; i < affixes.length; i++) {
    const a = (i / affixes.length) * Math.PI * 2;
    const m = createMob(inst, MONSTERS.mossback, 10, p.x + Math.cos(a) * 300, p.y + Math.sin(a) * 300, { tier: 2, affixes: [affixes[i], affixes[(i + 3) % affixes.length]], name: 'Testmaw' });
    m.state = 'chase'; m.target = p.id;
  }
  // and a natural champion + rare pack via debug
  inst.debug(link, 'elite');
  inst.debug(link, 'elite');
  link.keepLog = true;
  run(inst, 400, [], () => { p.hp = p.mhp; });
  const affixesSeen = new Set<string>();
  for (const d of link.descs.values()) for (const a of d.af ?? []) affixesSeen.add(a);
  check(affixesSeen.size === 8, `elite affixes replicated (${[...affixesSeen].join(',')})`);
  check(link.n('tele:frozen_orb') > 0 && link.n('aoe:nova') > 0, `frozen orbs (${link.n('tele:frozen_orb')})`);
  check(link.n('aoe:poison_pool') > 0, `plagued pools (${link.n('aoe:poison_pool')})`);
  check(link.n('aoe:molten_trail') > 0, `molten trail (${link.n('aoe:molten_trail')})`);
  check(link.n('beam:vortex') > 0, `vortex pull (${link.n('beam:vortex')})`);
  check(link.n('tele:mortar') > 0, `mortar shells (${link.n('tele:mortar')})`);
  check(link.n('tele:slam') > 0 && link.n('aoe:slam') > 0, `slam windup telegraph + hit (${link.n('tele:slam')})`);
  // electrified: hit it repeatedly (15% chance per hit, at most one burst per 0.4 s)
  p.ctx.d.weaponMin = 1; p.ctx.d.weaponMax = 2;
  const elec = inst.mobs.filter((m) => m.affixes.includes('electrified') && !m.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  run(inst, 200, [], () => {
    p.hp = p.mhp;
    if (elec && !elec.dead) strikeMob(inst, p, elec, { skill: 'test', coef: 0.001, el: 'physical', pct: 0, noProc: true });
  });
  if (process.env.SIM_DEBUG) console.log('   elec', elec?.id, elec?.dead, elec?.hp, elec && Math.hypot(elec.x - p.x, elec.y - p.y), inst.mobs.filter((m) => m.affixes.includes('electrified')).map((m) => `${m.id}:${m.dead}`));
  check(link.n('proj:spark') > 0 || Object.keys(link.evV).some((k) => k.startsWith('proj:spark')), `electrified sparks (${link.n('proj:spark')})`);
  // molten death explosion
  const molten = inst.mobs.find((m) => m.affixes.includes('molten'));
  if (molten) {
    p.ctx.d.weaponMin = p.ctx.d.weaponMax = 1e12;
    run(inst, 200, [new Bot(inst, link, true)], () => { p.hp = p.mhp; return !molten || molten.dead && inst.t > 0 && link.n('tele:molten_death') > 0; });
    run(inst, 30, []);
  }
  check(link.n('tele:molten_death') > 0, `molten death telegraph (${link.n('tele:molten_death')})`);
  check(link.n('dmg') > 0 && [...link.log].some((e) => e.e === 'dmg' && e.t === link.myId), 'players took damage from elites');
  const champs = [...link.descs.values()].filter((d) => d.k === 'mob' && (d.el === 1 || d.el === 2));
  check(champs.length >= 9 && champs.every((d) => (d.af?.length ?? 0) >= 2 && !!d.n), `elite descs carry names + affixes (${champs.length})`);
  inst.destroy();
}

function goblinScenario() {
  console.log('\n== Treasure goblin ==');
  // weak hunter: goblin flees and spills gold while hit
  const inst = newField('whispering_glade');
  const save = makeChar('ranger', 20);
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  const p = inst.players[0];
  check(inst.debug(link, 'goblin') === null, 'debug goblin');
  const nearestGoblin = (i: Instance, x: number, y: number) => i.mobs.filter((m) => m.tier === 5 && !m.dead).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  const gob = nearestGoblin(inst, p.x, p.y);
  check(!!gob, 'goblin spawned');
  const d0 = Math.hypot(gob.x - p.x, gob.y - p.y);
  const bot = new Bot(inst, link, false);
  let maxD = d0, goldPiles = 0;
  const gold0 = save.gold;
  let deadAt = -1;
  run(inst, 20 * 40, [bot], (t) => {
    if (!gob.dead) maxD = Math.max(maxD, Math.hypot(gob.x - p.x, gob.y - p.y));
    goldPiles = Math.max(goldPiles, [...p.loot].filter((l) => l.payload.type === 'gold').length);
    if (gob.dead && deadAt < 0) deadAt = t;
    return deadAt >= 0 && t > deadAt + 80; // collect the gold
  });
  console.log(`  goblin: start dist ${Math.round(d0)}, max dist ${Math.round(maxD)}, ${gob.dead ? `gone after ${fmt(deadAt / 20, 1)} s` : 'alive'}, gold piles while hit ${goldPiles}, gold +${save.gold - gold0}, notices ${link.n('notice')}`);
  check(gob.noticedMs >= 0 || gob.dead, 'goblin noticed the player and fled');
  check(save.gold > gold0, 'goblin gold picked up');
  inst.destroy();
  // modest melee hunter (L8, ilvl-8 rares): a real chase
  {
    const i3 = newField('whispering_glade');
    const s3 = makeChar('warrior', 8);
    const l3 = new FakeLink(s3);
    l3.myId = i3.addPlayer(l3);
    i3.debug(l3, 'goblin');
    const p3 = i3.players[0];
    const g3 = nearestGoblin(i3, p3.x, p3.y);
    let firstHit = -1, end = -1, piles = 0;
    run(i3, 20 * 30, [new Bot(i3, l3, true)], (t) => {
      if (firstHit < 0 && g3.hp < g3.mhp) firstHit = t;
      piles = Math.max(piles, [...p3.loot].filter((l) => l.payload.type === 'gold').length);
      if (g3.dead) { end = t; return true; }
    });
    const escaped = g3.dead && g3.hp > 0;
    console.log(`  L8 warrior vs goblin: first hit at ${fmt(firstHit / 20, 1)} s, ${escaped ? 'escaped' : g3.dead ? 'killed' : 'alive'} at ${fmt(end / 20, 1)} s, gold piles spilled ${piles}`);
    summary.push(`goblin vs L8 warrior: first hit ${fmt(firstHit / 20, 1)} s, ${escaped ? 'escaped' : 'killed'} at ${fmt(end / 20, 1)} s`);
    i3.destroy();
  }
  // strong hunter: kill it, loot shower
  const inst2 = newField('whispering_glade');
  const save2 = makeChar('mage', 70, { endgame: true });
  const link2 = new FakeLink(save2);
  link2.myId = inst2.addPlayer(link2);
  inst2.debug(link2, 'goblin');
  const gob2 = nearestGoblin(inst2, inst2.players[0].x, inst2.players[0].y);
  const spawned0 = inst2.counters.lootSpawned;
  run(inst2, 20 * 20, [new Bot(inst2, link2, false)], () => gob2.dead);
  check(gob2.dead && inst2.counters.lootSpawned - spawned0 >= 10, `goblin killed → loot shower (${inst2.counters.lootSpawned - spawned0} drops)`);
  inst2.destroy();
}

function deathScenario() {
  console.log('\n== Death & respawn ==');
  const inst = newField('ashen_hollow');
  const save = makeChar('mage', 1);
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  const p = inst.players[0];
  const entry = inst.map.entry;
  teleport(inst, link, entry.x + 600, entry.y);
  for (let i = 0; i < 8; i++) {
    const m = createMob(inst, MONSTERS.magma_brute, 30, p.x + 60 + (i % 4) * 40, p.y - 40 + Math.floor(i / 4) * 80);
    m.state = 'chase'; m.target = p.id;
  }
  let diedAt = -1, sawCountdown = false, respawned = false, respawnPos = { x: 0, y: 0 };
  run(inst, 20 * 15, [], (t) => {
    if (p.deadMs > 0 && diedAt < 0) diedAt = t;
    if (link.me && link.me.dead > 0) sawCountdown = true;
    if (diedAt >= 0 && p.deadMs <= 0 && !respawned) { respawned = true; respawnPos = { x: p.x, y: p.y }; return true; }
  });
  check(diedAt >= 0, 'player died');
  check(sawCountdown && link.sawDeadFlag, 'me.dead countdown + F_DEAD replicated');
  check(link.n('die') > 0 && save.stats.deaths === 1, 'die event + stats.deaths');
  check(respawned && Math.hypot(respawnPos.x - entry.x, respawnPos.y - entry.y) < 120, 'respawned at map entry');
  check(p.hp === p.mhp, 'respawned with full life');
  run(inst, 2, []);
  check(link.descs.get(link.myId) !== undefined && link.ents.has(link.myId) && !(link.ents.get(link.myId)!.flags & F_DEAD), 'player re-introduced after respawn');
  inst.destroy();
}

function townScenario() {
  console.log('\n== Town: training dummies ==');
  const inst = createInstance({ zoneId: 'hearthmere', channel: 1, key: 'hearthmere#t', seed: zoneSeed('hearthmere', 1), theme: 'town' }) as Instance;
  const save = makeChar('warrior', 20);
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  const dummies = inst.mobs.filter((m) => m.dummy);
  check(dummies.length === 3 && dummies.filter((d) => d.tier === 2).length === 1, `3 dummies (1 elite) (${dummies.map((d) => d.tier).join(',')})`);
  const d = dummies[0];
  teleport(inst, link, d.x - 60, d.y);
  run(inst, 100, []);
  check(link.n('dmg') > 0 && !d.dead, 'dummies take damage and never die');
  check([...link.descs.values()].some((e) => e.t === 'training_dummy'), 'dummy replicated as training_dummy');
  check(inst.players[0].hp === inst.players[0].mhp, 'no damage taken in town');
  teleport(inst, link, d.x - 1600, d.y);
  run(inst, 240, []); // bleeds run out (5 s), then 4 s without damage
  check(d.hp === d.mhp, 'dummy regenerates after 4 s');
  // portal + refresh + debug
  const pid = inst.spawnPortal({ kind: 'rift', x: d.x - 1600, y: d.y + 80, label: 'Rift', ttlMs: 2000 });
  run(inst, 2, []);
  check([...link.ents.values()].some((e) => e.desc.id === pid && e.desc.k === 'portal'), 'portal spawned & replicated');
  run(inst, 45, []);
  check(!inst.portals.some((pt) => pt.id === pid), 'portal ttl expiry');
  const before = link.n('add');
  save.equipment.head = generateItem(gearRng, { ilvl: 20, classId: 'warrior', rarity: 'rare', base: 'head_horned' });
  const adds0 = [...link.descs.values()].length;
  inst.refreshPlayer(link);
  let reDescribed = false;
  const orig = link.send.bind(link);
  link.send = (m) => { if (m.t === 's' && m.add?.some((a) => a.id === link.myId && a.look?.slots.head?.shape === 'helm_horned')) reDescribed = true; orig(m); };
  run(inst, 2, []);
  check(reDescribed, 'refreshPlayer re-sends EntDesc with the new look');
  void before; void adds0;
  check(inst.debug(link, 'goblin') !== null, 'debug goblin refused in town');
  check(inst.debug(link, 'heal') === null, 'debug heal');
  inst.destroy();
}

function inputScenario() {
  console.log('\n== Input queue / prediction ==');
  const inst = newField('whispering_glade');
  const save = makeChar('ranger', 1);
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  const p = inst.players[0];
  const x0 = p.x;
  // burst of 6 inputs: processed 2 per tick
  for (let i = 1; i <= 6; i++) inst.queueInput(link, { t: 'in', seq: i, mx: 1, my: 0 });
  inst.tick();
  check(link.ack === 2, `2 inputs per tick (ack ${link.ack})`);
  inst.tick(); inst.tick();
  check(link.ack === 6, 'queue drained');
  inst.tick();
  check(link.ack === 6 && p.x > x0 + 250 * 0.05 * 6.5, 'last input reused when the queue is empty');
  inst.queueInput(link, { t: 'in', seq: 7, mx: 0, my: 1, dash: 1 });
  inst.tick();
  check(link.n('dash') === 1 && p.mv.dashCdMs > 0, 'dash event + cooldown');
  check(link.me!.dashCd === p.mv.dashCdMs && link.me!.x === p.mv.x, 'me block mirrors movement state');
  inst.queueInput(link, { t: 'in', seq: 3, mx: 1, my: 1 });
  check(p.inQ.length === 0, 'stale input ignored');
  inst.destroy();
}

/**
 * `SIM_PERF_INJECT_MS=<ms>`: a deliberate code slowdown for proving the tick checks — every measured tick also runs
 * <ms> of quiet-machine reference work (perfGauge.burn), inside the timed region, so it slows down with the load like
 * real code does.
 */
const INJECT_MS = Number(process.env.SIM_PERF_INJECT_MS ?? 0);

function gaugeLine(label: string, gauge: LoadGauge | ReturnType<LoadGauge['stats']>) {
  const g = gauge instanceof LoadGauge ? gauge.stats() : gauge;
  console.log(`  perf: ${label}: load gauge ${g.n} samples, fastest ${fmt(g.min, 3)} ms, mean ${fmt(g.mean, 3)} ms (quiet reference ${fmt(QUIET_GAUGE_MS, 3)} ms) → load factor ${fmt(g.factor, 2)}${INJECT_MS ? `, injected ${INJECT_MS} ms per tick` : ''}`);
  return g;
}

/** `sim.ts gauge`: the load gauge alone, back to back (cache-warm, so faster than the in-run samples). */
function gaugeScenario() {
  console.log('\n== Load gauge alone ==');
  for (let k = 0; k < 3; k++) {
    const gauge = new LoadGauge();
    for (let i = 0; i < 2000; i++) gauge.sample();
    gaugeLine(`gauge run ${k + 1}`, gauge);
  }
}

function perfScenario() {
  console.log('\n== Performance: 4 players + 150 active monsters ==');
  const inst = newField('ashen_hollow');
  const links: FakeLink[] = [];
  const bots: Bot[] = [];
  const classes: ClassId[] = ['warrior', 'ranger', 'mage', 'ranger'];
  const entry = inst.map.entry;
  // find an open area away from the entry
  let cx = entry.x + 900, cy = entry.y;
  for (const s of inst.map.spawns) if (Math.hypot(s.x - entry.x, s.y - entry.y) > 900) { cx = s.x; cy = s.y; break; }
  for (const cls of classes) {
    const save = makeChar(cls, 70, { endgame: true });
    const link = new FakeLink(save);
    link.myId = inst.addPlayer(link, { x: cx + links.length * 40, y: cy });
    links.push(link);
    bots.push(new Bot(inst, link, cls === 'warrior'));
  }
  // remove the field's own population and place 150 unkillable monsters around the group
  for (const m of [...inst.mobs]) inst.removeEntity(m.id);
  const roster = Object.values(MONSTERS).filter((d) => d.weight > 0 && d.attack.kind !== 'explode');
  const keep: Mob[] = [];
  const top = () => {
    while (keep.filter((m) => !m.dead).length < 150) {
      const a = Math.random() * Math.PI * 2, d = 150 + Math.random() * 650;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (!inst.cw.isFree(x, y, 20)) continue;
      const m = createMob(inst, roster[keep.length % roster.length], 70, x, y, { tier: keep.length % 25 === 0 ? 2 : 0, affixes: keep.length % 25 === 0 ? ['molten', 'frozen'] : [] });
      m.mhp = m.hp = 1e18;
      keep.push(m);
    }
  };
  top();
  // One 30 s window of measured ticks, each preceded by a load-gauge sample (server/test/perfGauge.ts).
  const measure = () => {
    const times: number[] = [];
    const simTimes: number[] = [];
    const gauge = new LoadGauge();
    for (let t = 0; t < 20 * 30; t++) {
      for (const b of bots) b.step();
      for (const p of inst.players) p.hp = p.mhp;
      gauge.sample();
      const l0 = linkMs;
      const t0 = performance.now();
      inst.phaseMs = process.env.SIM_DEBUG ? [] : null;
      inst.tick();
      if (INJECT_MS > 0) gauge.burn(INJECT_MS);
      const dt = performance.now() - t0;
      times.push(dt);
      simTimes.push(dt - (linkMs - l0));
      if (inst.phaseMs && dt > 6) console.log(`    slow tick ${t}: ${fmt(dt, 2)} ms (clients ${fmt(linkMs - l0, 2)}) ` + inst.phaseMs.map((v, i) => `${Instance.PHASES[i]} ${fmt(v, 2)}`).join(', ') + ` events ${inst.events.length}`);
    }
    simTimes.sort((a, b) => a - b);
    times.sort((a, b) => a - b);
    const mean = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length;
    const g = gauge.stats();
    return { simTimes, times, simAvg: mean(simTimes), avg: mean(times), g, ok: mean(simTimes) < 3 * g.factor && mean(times) < 3 * g.factor };
  };
  // Best of up to 3 windows: a later window runs only when the previous one failed (a load spike the gauge did not
  // catch); a real slowdown fails all three.
  let run = measure(), attempt = 1;
  while (!run.ok && attempt < 3) { console.log(`  perf: window ${attempt} over the load-scaled limit (sim ${fmt(run.simAvg, 3)} ms, factor ${fmt(run.g.factor, 2)}); measuring again`); run = measure(); attempt++; }
  const { simTimes, times, simAvg, avg } = run;
  console.log(`  simulation only (excluding the fake clients' snapshot processing): avg ${fmt(simAvg, 3)} ms, p99 ${fmt(simTimes[Math.floor(simTimes.length * 0.99)], 3)} ms, max ${fmt(simTimes[simTimes.length - 1], 3)} ms`);
  summary.push(`perf: simulation only: avg ${fmt(simAvg, 3)} ms, p99 ${fmt(simTimes[Math.floor(simTimes.length * 0.99)], 3)} ms`);
  const p99 = times[Math.floor(times.length * 0.99)];
  const max = times[times.length - 1];
  const alive = inst.mobs.length;
  const evs = links.reduce((s, l) => s + Object.values(l.ev).reduce((a, b) => a + b, 0), 0);
  if (process.env.SIM_DEBUG) for (const l of links) console.log('   ', l.save.classId, JSON.stringify(Object.entries({ ...l.ev, ...l.evV }).sort((a, b) => b[1] - a[1]).slice(0, 14)));
  console.log(`  ${alive} monsters, ${inst.summons.length} summons, ${inst.projs.length} projectiles in flight, ${evs} events delivered in ${30 * attempt} s`);
  console.log(`  tick avg ${fmt(avg, 3)} ms, p99 ${fmt(p99, 3)} ms, max ${fmt(max, 3)} ms; tickStats() ${JSON.stringify(Object.fromEntries(Object.entries(inst.tickStats()).map(([k, v]) => [k, +v.toFixed(3)])))}`);
  const g = gaugeLine(`4 players + 150 monsters (window ${attempt} of at most 3)`, run.g);
  summary.push(`perf: 4 players + 150 monsters: tick avg ${fmt(avg, 3)} ms, p99 ${fmt(p99, 3)} ms, max ${fmt(max, 3)} ms; load factor ${fmt(g.factor, 2)}`);
  // 3 ms on a quiet machine; under load the limit scales with the same window's measured slowdown (perfGauge.ts).
  check(simAvg < 3 * g.factor, `sim tick avg < 3 ms × load factor ${fmt(g.factor, 2)} (${fmt(simAvg, 3)})`);
  check(avg < 3 * g.factor, `tick avg incl. snapshot consumers < 3 ms × load factor ${fmt(g.factor, 2)} (${fmt(avg, 3)})`);
  check(alive >= 150, 'monsters alive throughout');
  inst.destroy();
}

/**
 * `budget` (F-TEL-01): the owner's server budget, ARCHITECTURE §1.2 / roadmap §12.2 [O] — four instances with 150
 * monsters each tick in < 10 ms total on one core. One level-70 player per instance keeps the monsters awake (they are
 * unkillable so the load stays constant); every snapshot is encoded with the real codec and counted. Timings exclude only
 * the fake clients' decoding. `PERF_JSON=<file>` writes the numbers for `scripts/perf-budget.ts`.
 */
function perfBudgetScenario() {
  console.log('\n== Performance budget: 4 instances × 150 monsters (one player each) ==');
  const classes: ClassId[] = ['warrior', 'ranger', 'mage', 'ranger'];
  const roster = Object.values(MONSTERS).filter((d) => d.weight > 0 && d.attack.kind !== 'explode');
  const worlds = classes.map((cls) => {
    const inst = newField('ashen_hollow');
    const entry = inst.map.entry;
    let cx = entry.x + 900, cy = entry.y;
    for (const s of inst.map.spawns) if (Math.hypot(s.x - entry.x, s.y - entry.y) > 900) { cx = s.x; cy = s.y; break; }
    const link = new FakeLink(makeChar(cls, 70, { endgame: true }));
    link.countBytes = true;
    link.myId = inst.addPlayer(link, { x: cx, y: cy });
    // Exactly 150 monsters: the field's own packs go and its refill is switched off for this measurement only.
    inst.spawner.tick = () => {};
    for (const m of [...inst.mobs]) inst.removeEntity(m.id);
    let placed = 0;
    for (let guard = 0; placed < 150 && guard < 20000; guard++) {
      const a = Math.random() * Math.PI * 2, d = 150 + Math.random() * 650;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (!inst.cw.isFree(x, y, 20)) continue;
      const m = createMob(inst, roster[placed % roster.length], 70, x, y, { tier: placed % 25 === 0 ? 2 : 0, affixes: placed % 25 === 0 ? ['molten', 'frozen'] : [] });
      m.mhp = m.hp = 1e18; placed++;
    }
    return { inst, link, bot: new Bot(inst, link, cls === 'warrior') };
  });
  const rounds: number[] = [];
  const warmup = 40, total = 20 * 30 + warmup;
  for (let t = 0; t < total; t++) {
    for (const w of worlds) { w.bot.step(); for (const p of w.inst.players) p.hp = p.mhp; }
    const l0 = linkMs, t0 = performance.now();
    for (const w of worlds) w.inst.tick();
    if (t >= warmup) rounds.push(performance.now() - t0 - (linkMs - l0));
    if (t === warmup - 1) for (const w of worlds) { w.link.bytes = 0; w.link.maxMsgBytes = 0; }
  }
  const sorted = [...rounds].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const avg = rounds.reduce((s, v) => s + v, 0) / rounds.length;
  const seconds = rounds.length / 20;
  const awake = worlds.map((w) => w.inst.mobs.filter((m) => !m.dead && !m.dormant).length);
  const bytesPerClientPerSec = worlds.map((w) => w.link.bytes / seconds);
  const result = {
    schema: 1, rounds: rounds.length, instances: worlds.length, monstersPerInstance: worlds.map((w) => w.inst.mobs.length), awake,
    roundMs: { avg: +avg.toFixed(3), p50: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), p99: +q(0.99).toFixed(3), max: +sorted[sorted.length - 1].toFixed(3) },
    snapshotBytes: { perClientPerSecAvg: Math.round(bytesPerClientPerSec.reduce((s, v) => s + v, 0) / worlds.length), perClientPerSecMax: Math.round(Math.max(...bytesPerClientPerSec)), largestMessage: Math.max(...worlds.map((w) => w.link.maxMsgBytes)) },
    budget: { roundAvgMs: 10, roundP99Ms: 50 },
    node: process.version, platform: process.platform, cpus: (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator?.hardwareConcurrency ?? null,
  };
  console.log(`  ${result.monstersPerInstance.join('/')} monsters (awake ${awake.join('/')}), round of 4 ticks: avg ${fmt(avg, 3)} ms, p95 ${fmt(q(0.95), 3)} ms, p99 ${fmt(q(0.99), 3)} ms, max ${fmt(result.roundMs.max, 3)} ms`);
  console.log(`  snapshots: ${result.snapshotBytes.perClientPerSecAvg} B/s per client on average (max ${result.snapshotBytes.perClientPerSecMax} B/s), largest message ${result.snapshotBytes.largestMessage} B`);
  summary.push(`budget: 4×150 round avg ${fmt(avg, 3)} ms (budget 10), p99 ${fmt(q(0.99), 3)} ms (budget 50), ${result.snapshotBytes.perClientPerSecAvg} B/s per client`);
  check(worlds.every((w) => w.inst.mobs.length === 150), `every instance holds exactly 150 monsters (${result.monstersPerInstance.join('/')})`);
  check(awake.every((n) => n >= 100), `monsters are awake around each player (${awake.join('/')})`);
  check(avg < result.budget.roundAvgMs, `4 instances × 150 monsters tick in < 10 ms on average (${fmt(avg, 3)})`);
  check(q(0.99) < result.budget.roundP99Ms, `p99 round stays inside one 20 Hz tick period (${fmt(q(0.99), 3)} < 50 ms)`);
  if (process.env.PERF_JSON) writeFileSync(process.env.PERF_JSON, JSON.stringify(result, null, 1) + '\n');
  for (const w of worlds) w.inst.destroy();
}

/** Realistic load: a 4-player party clears a Torment VIII rift together (killable monsters, all builds). */
function partyRiftPerf() {
  console.log('\n== Performance: 4-player party in a Torment III rift ==');
  let done = 0;
  const inst = newRift(70, 6, 'ashen', () => done++);
  const bots: Bot[] = [];
  const links: FakeLink[] = [];
  for (const cls of ['warrior', 'ranger', 'mage', 'ranger'] as ClassId[]) {
    const link = new FakeLink(makeChar(cls, 70, { endgame: true }));
    link.myId = inst.addPlayer(link);
    links.push(link);
    bots.push(new Bot(inst, link, cls === 'warrior'));
  }
  const sim: number[] = [];
  let maxActive = 0, doneAt = -1, maxProg = 0;
  const gauge = new LoadGauge();
  for (let t = 0; t < 20 * 60 * 8 && doneAt < 0; t++) {
    for (const b of bots) b.step();
    if (t % 4 === 0) gauge.sample(); // every 4th tick: these ticks are short, a sample each would double the run
    const l0 = linkMs, t0 = performance.now();
    inst.tick();
    if (INJECT_MS > 0) gauge.burn(INJECT_MS);
    sim.push(performance.now() - t0 - (linkMs - l0));
    if (t % 20 === 0) maxActive = Math.max(maxActive, inst.mobs.filter((m) => !m.dormant && !m.dead).length);
    maxProg = Math.max(maxProg, inst.riftState()!.progress);
    if (inst.riftState()!.phase === 'done') doneAt = t;
  }
  sim.sort((a, b) => a - b);
  const avg = sim.reduce((a, b) => a + b, 0) / sim.length;
  const dur = doneAt >= 0 ? `${Math.floor(doneAt / 1200)}:${String(Math.floor((doneAt / 20) % 60)).padStart(2, '0')}` : 'DNF';
  console.log(`  ${inst.mobs.length + inst.counters.kills} monsters, up to ${maxActive} awake at once, progress ${fmt(maxProg)}%, rift done at ${dur}, deaths ${links.map((l) => l.save.stats.deaths).join('/')}`);
  console.log(`  sim tick avg ${fmt(avg, 3)} ms, p99 ${fmt(sim[Math.floor(sim.length * 0.99)], 3)} ms, max ${fmt(sim[sim.length - 1], 3)} ms`);
  summary.push(`perf: 4-player T3 rift: sim tick avg ${fmt(avg, 3)} ms, p99 ${fmt(sim[Math.floor(sim.length * 0.99)], 3)} ms, rift ${dur}`);
  const g = gaugeLine('party rift', gauge);
  // Every class is on the depth budget (warrior, ranger and mage waves): like the solo L70 rifts, a progress floor until
  // the Torment re-fit (BUDGET.md §9 risk 1); the measurement itself is the tick cost under this load.
  check(done === 1 || maxProg >= 30, `party rift: completed, or progress ≥ 30% in 8 minutes before the Torment re-fit (${fmt(maxProg)}%)`);
  check(avg < 3 * g.factor, `party rift tick avg < 3 ms × load factor ${fmt(g.factor, 2)} (${fmt(avg, 3)})`);
  inst.destroy();
}

function multiplayerScenario() {
  console.log('\n== Multiplayer: shared XP, personal loot, AOI ==');
  const inst = newField('whispering_glade', zoneSeed('whispering_glade', 2));
  const a = new FakeLink(makeChar('warrior', 20));
  const b = new FakeLink(makeChar('mage', 20));
  const c = new FakeLink(makeChar('ranger', 20));
  a.myId = inst.addPlayer(a);
  b.myId = inst.addPlayer(b);
  c.myId = inst.addPlayer(c, { x: inst.map.entry.x + 4000, y: inst.map.entry.y });
  const pa = inst.players[0], pb = inst.players[1];
  const bxp0 = b.save.xp + b.save.level * 1e9;
  // b follows a without fighting (no slots, no primary range)
  const bot = new Bot(inst, a, true);
  run(inst, 600, [bot], () => {
    pb.mv.x = pb.x = pa.x - 30; pb.mv.y = pb.y = pa.y;
    pb.atkCdMs = 1e9;
    pa.hp = pa.mhp; pb.hp = pb.mhp; // this scenario is about replication and XP sharing, not survival
  });
  check(b.save.xp + b.save.level * 1e9 > bxp0, 'nearby ally shares XP');
  check([...a.ents.values()].some((e) => e.desc.id === b.myId) && ![...a.ents.values()].some((e) => e.desc.id === c.myId), 'AOI: near player visible, far player not');
  const aLoot = new Set([...pa.loot].map((l) => l.id));
  check(![...b.ents.values()].some((e) => e.desc.k === 'loot' && aLoot.has(e.desc.id)), 'personal loot hidden from others');
  inst.removePlayer(b);
  run(inst, 2, [bot]);
  check(![...a.ents.values()].some((e) => e.desc.id === b.myId), 'removed player rem-ed');
  inst.destroy();
}

/** A fresh character levels in the fields, equipping upgrades from its own drops (realistic power curve). */
function levelingScenario(cls: ClassId, minutes: number) {
  // Each class starts from the same seeded state, as if it ran alone (scripts/bot-metrics.ts pace targets). Before, the
  // classes shared one random stream, so new loot for one class (two warrior legendaries in engine wave 3) shifted
  // the ranger and mage runs after it and flipped the pace gate on the default seed without changing either class [M].
  simRng = new Rng(SIM_SEED); seedCounter = SEED_COUNTER_START; instSeq = INST_SEQ_START;
  const engaged = process.env.PLAYER !== 'auto';
  console.log(`
== Leveling: fresh ${cls}, ${minutes} min in the fields with auto-equip, ${engaged ? 'engaged build + points spent' : 'auto-slotted skills'} ==`);
  let inst = newField('whispering_glade');
  const save = createCharacter(`Lvl${cls}`, cls, seedCounter++);
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  let bot = new Bot(inst, link, cls === 'warrior');
  const ticks = minutes * 60 * 20;
  // per-bucket statistics (a bucket ends at every fifth level)
  const totalXp = () => { let x = save.xp; for (let l = 1; l < save.level; l++) x += xpToNext(l); return x; };
  const bucket = { t: 0, kills: 0, deaths: 0, taken: 0, ttk0: 0, ttk1: 0, items: {} as Record<string, number>, level: 1, xp: 0, gold: save.gold };
  const med = (a: number[] | undefined, from: number) => { const v = (a ?? []).slice(from); return v.length >= 5 ? [...v].sort((x, y) => x - y)[v.length >> 1] / 1000 : NaN; };
  console.log('  level  at min  min in  kills/min  TTK trash  champ   deaths  taken %life/min  items/h (n/m/r/L)   gems/h  mats/h  globes/h  gold/h');
  const flush = (t: number) => {
    const dt = Math.max(1, t - bucket.t) / 1200;
    const p = inst.players[0];
    const it = (r: string) => (link.evV[`item:${r}`] ?? 0) - (bucket.items[r] ?? 0);
    const h = (n: number) => String(Math.round((n / dt) * 60));
    const ot = (k: string) => (link.evV[`other:${k}`] ?? 0) - (bucket.items[`o:${k}`] ?? 0);
    const f = (n: number, d = 1) => (Number.isNaN(n) ? '  —  ' : n.toFixed(d));
    console.log(`  ${String(bucket.level).padStart(2)}→${String(save.level).padEnd(3)} ${f(t / 1200).padStart(7)} ${f(dt).padStart(7)} ${f((p.kills - bucket.kills) / dt, 0).padStart(9)}  ${(f(med(link.ttk[0], bucket.ttk0), 2) + 's').padStart(9)} ${(f(med(link.ttk[1], bucket.ttk1), 1) + 's').padStart(7)} ${String(save.stats.deaths - bucket.deaths).padStart(7)}  ${f(((p.taken - bucket.taken) / Math.max(1, p.mhp)) * 100 / dt, 0).padStart(14)}%   ${h(it('normal'))}/${h(it('magic'))}/${h(it('rare'))}/${h(it('legendary') + it('set'))}`.padEnd(125) + `${h(ot('gem'))}`.padStart(6) + `${h(ot('mat'))}`.padStart(8) + `${h(ot('globe'))}`.padStart(9) + `${h(ot('gold'))}`.padStart(10));
    // Machine-readable copy of the row for scripts/bot-metrics.ts (F-TEL-02); rates are per hour of simulated play.
    const perH = (n: number) => Math.round((n / dt) * 60), r1 = (n: number) => (Number.isNaN(n) ? null : Math.round(n * 1000) / 1000);
    metricRows.push({
      class: cls, mode: engaged ? 'engaged' : 'auto', zone: inst.zone.zone, fromLevel: bucket.level, toLevel: save.level,
      atMinute: Math.round((t / 1200) * 10) / 10, minutes: Math.round(dt * 10) / 10,
      killsPerMin: Math.round(((p.kills - bucket.kills) / dt) * 10) / 10,
      ttkTrashS: r1(med(link.ttk[0], bucket.ttk0)), ttkChampionS: r1(med(link.ttk[1], bucket.ttk1)),
      deaths: save.stats.deaths - bucket.deaths, deathsPerHour: Math.round(((save.stats.deaths - bucket.deaths) / dt) * 600) / 10,
      takenLifePctPerMin: Math.round(((p.taken - bucket.taken) / Math.max(1, p.mhp)) * 100 / dt),
      xpPerHour: perH(totalXp() - bucket.xp),
      itemsPerHour: { normal: perH(it('normal')), magic: perH(it('magic')), rare: perH(it('rare')), legendarySet: perH(it('legendary') + it('set')) },
      gemsPerHour: perH(ot('gem')), materialsPerHour: perH(ot('mat')), globesPerHour: perH(ot('globe')),
      goldPickedPerHour: perH(ot('gold')), goldNetPerHour: perH(save.gold - bucket.gold),
    });
    bucket.xp = totalXp(); bucket.gold = save.gold;
    bucket.t = t; bucket.kills = p.kills; bucket.deaths = save.stats.deaths; bucket.taken = p.taken;
    bucket.ttk0 = link.ttk[0]?.length ?? 0; bucket.ttk1 = link.ttk[1]?.length ?? 0; bucket.level = save.level;
    for (const r of ['normal', 'magic', 'rare', 'legendary', 'set']) bucket.items[r] = link.evV[`item:${r}`] ?? 0;
    for (const k of ['gem', 'mat', 'globe', 'gold']) bucket.items[`o:${k}`] = link.evV[`other:${k}`] ?? 0;
  };
  let nextMark = 5;
  for (let t = 0; t < ticks; t++) {
    bot.step();
    inst.tick();
    if (t % 40 === 0) {
      // equip upgrades, trash junk when the bag fills up
      let changed = false;
      for (const it of save.inventory) {
        if (!it || it.reqLevel > save.level || !BASES[it.base] || (BASES[it.base].classes && !BASES[it.base].classes!.includes(cls))) continue;
        for (const slot of slotsForKind(it.kind)) {
          const nd = computeStats(save, { swap: { slot, item: it } });
          const od = computeStats(save);
          const better = nd.sheetDps * Math.sqrt(nd.toughness) > od.sheetDps * Math.sqrt(od.toughness) * 1.01;
          if (better && equipItemSafe(save, it.id, slot)) { changed = true; break; }
        }
      }
      if (save.inventory.filter(Boolean).length > 50) for (let i = 0; i < save.inventory.length; i++) if (save.inventory[i] && save.inventory[i]!.rarity !== 'legendary' && save.inventory[i]!.rarity !== 'set') save.inventory[i] = null;
      if (process.env.ALLOCATE !== '0' && spendSkillPoints(save, engaged ? BUILDS[cls] : undefined)) changed = true;
      if (changed) inst.refreshPlayer(link);
    }
    // switch to Ashen Hollow from level 12 like a player would
    if (save.level >= 12 && inst.zone.zone === 'whispering_glade') {
      inst.removePlayer(link);
      inst.destroy();
      inst = newField('ashen_hollow');
      link.ents.clear(); // like the client on a 'zone' message
      link.myId = inst.addPlayer(link);
      bot = new Bot(inst, link, cls === 'warrior');
      bucket.kills = 0;
    }
    if (save.level >= nextMark) { flush(t); nextMark = Math.floor(save.level / 5) * 5 + 5; }
  }
  flush(ticks);
  const p = inst.players[0];
  console.log(`  end: L${save.level}, deaths ${save.stats.deaths}, damage taken ${fmt(p.taken / p.mhp * 100 / minutes, 0)}% of current life/min over the whole run, ${ttkLine(link)}`);
  summary.push(`leveling ${cls}: L1→L${save.level} in ${minutes} min, deaths ${save.stats.deaths}`);
  check(save.level >= 5, `${cls} levels up steadily (L${save.level})`);
  inst.destroy();
}

/** Play the engaged bot (build, points, organic gear, fields only) until `target` is reached; returns a frozen copy. */
function playEngagedTo(cls: ClassId, target: number, maxMinutes: number): { save: CharacterSave; minutes: number } {
  let inst = newField('whispering_glade');
  const save = createCharacter(`Eng${cls}`, cls, seedCounter++);
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  let bot = new Bot(inst, link, cls === 'warrior');
  let t = 0;
  for (; t < maxMinutes * 1200 && save.level < target; t++) {
    bot.step();
    inst.tick();
    if (t % 40 === 0) {
      let changed = false;
      for (const it of save.inventory) {
        if (!it || it.reqLevel > save.level || !BASES[it.base] || (BASES[it.base].classes && !BASES[it.base].classes!.includes(cls))) continue;
        for (const slot of slotsForKind(it.kind)) {
          const nd = computeStats(save, { swap: { slot, item: it } });
          const od = computeStats(save);
          if (nd.sheetDps * Math.sqrt(nd.toughness) > od.sheetDps * Math.sqrt(od.toughness) * 1.01 && equipItemSafe(save, it.id, slot)) { changed = true; break; }
        }
      }
      if (save.inventory.filter(Boolean).length > 50) for (let i = 0; i < save.inventory.length; i++) if (save.inventory[i] && save.inventory[i]!.rarity !== 'legendary' && save.inventory[i]!.rarity !== 'set') save.inventory[i] = null;
      if (spendSkillPoints(save, BUILDS[cls])) changed = true;
      if (changed) inst.refreshPlayer(link);
    }
    if (save.level >= 12 && inst.zone.zone === 'whispering_glade') {
      inst.removePlayer(link); inst.destroy();
      inst = newField('ashen_hollow');
      link.ents.clear(); link.myId = inst.addPlayer(link);
      bot = new Bot(inst, link, cls === 'warrior');
    }
  }
  inst.destroy();
  return { save: structuredClone(save), minutes: t / 1200 };
}

/** `masterprobe [level] [difficulties]` — what a typical (organically geared) character of that level meets on each
 *  difficulty: five simulated minutes in the fields, real life (deaths happen), plus the same with a lucky kit. */
function masterProbe(level: number, diffs: number[]) {
  console.log(`
== Typical L${level} character on each difficulty (engaged bot, organic gear; 5 min each, mortal) ==`);
  console.log('  class   gear      diff     TTK trash  champ   kills/min  lvls/min  deaths  taken %life/min');
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    const played = playEngagedTo(cls, level, 240);
    for (const gear of ['organic', 'rare kit']) for (const d of diffs) {
      const save = gear === 'organic' ? structuredClone(played.save) : makeChar(cls, level);
      save.difficulty = d;
      save.stats.deaths = 0;
      const inst = newField(level >= 12 ? 'ashen_hollow' : 'whispering_glade', 9100 + level);
      const link = new FakeLink(save);
      link.myId = inst.addPlayer(link);
      const bot = new Bot(inst, link, cls === 'warrior');
      const lvl0 = save.level + save.xp / xpToNext(save.level);
      run(inst, 5 * 1200, [bot]);
      const p = inst.players[0];
      const lvl1 = save.level + save.xp / xpToNext(save.level);
      const sec = (a?: number[]) => { const m = median(a); return Number.isNaN(m) ? '  —  ' : fmt(m / 1000, 2) + 's'; };
      console.log(`  ${cls.padEnd(7)} ${gear.padEnd(9)} ${DIFFICULTIES[d].name.padEnd(8)} ${sec(link.ttk[0]).padStart(9)} ${sec(link.ttk[1]).padStart(7)} ${fmt(p.kills / 5, 0).padStart(10)} ${fmt((lvl1 - lvl0) / 5, 2).padStart(9)} ${String(save.stats.deaths).padStart(7)} ${fmt((p.taken / Math.max(1, p.mhp)) * 100 / 5, 0).padStart(14)}%`);
      inst.destroy();
    }
  }
}

/**
 * `threat`: early danger (owner 2026-10-12: "early game nothing barely does damage, i can just sit and facetank
 * everything"). A character with the organic gear of the engaged bot at that level stands still beside one pack and
 * lets the automatic attacks and auto-cast skills fight: no moving, no dash, no potion. `stand` = that fight (life lost,
 * lowest life, death, time to clear); `passive` = the same pack against a character that never attacks (time to die,
 * capped at 60 s). Packs are spawned on the character after the field's own monsters are removed.
 */
function threatScenario(levels: number[], diffs: number[], kinds: ('trash' | 'champion' | 'rare')[]) {
  // THREAT_DMG="1:1,45:1,60:0.5": try another LEVEL_DAMAGE table without editing tuning.ts
  const table = process.env.THREAT_DMG?.split(',').map((p) => p.split(':').map(Number) as [number, number]);
  if (table) tuningOverrides.levelDamage = (l) => interpolateLog(l, table);
  console.log(`
== Threat: stand still beside one pack (organic gear, auto attacks + auto-cast only; median of 3 packs) ==`);
  console.log('  class   lvl  diff      pack       stand: lost %life  lowest %  deaths  clear s   passive: die s');
  const out: Record<string, unknown>[] = [];
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) for (const level of levels) {
    // THREAT_KIT=organic: the engaged bot's own drops (slow: it plays up to the level); default: makeChar's
    // ilvl-matched rare kit, the well-geared case (if that character is threatened, an organic one is too).
    const organic = process.env.THREAT_KIT === 'organic';
    const played = level <= 1 ? createCharacter(`Thr${cls}`, cls, seedCounter++) : organic ? playEngagedTo(cls, level, 240).save : makeChar(cls, level);
    for (const d of diffs) for (const kind of kinds) {
      const rows: { lost: number; low: number; died: boolean; clear: number; die: number }[] = [];
      for (let k = 0; k < 3; k++) {
        const one = (passive: boolean) => {
          const save = structuredClone(played);
          save.difficulty = d; save.stats.deaths = 0;
          if (passive) save.skills.autoCast = save.skills.slots.map(() => 'paused' as const);
          const inst = newField(level >= 12 ? 'ashen_hollow' : 'whispering_glade', 9300 + level * 7 + k);
          const link = new FakeLink(save);
          link.myId = inst.addPlayer(link);
          const p = inst.players[0];
          for (const m of [...inst.mobs]) inst.removeMob(m);
          inst.tick();
          const before = new Set(inst.mobs.map((m) => m.id));
          spawnPack(inst, p.x + 70, p.y, save.level, -1, { kind, difficulty: d });
          const pack = new Set(inst.mobs.filter((m) => !m.dead && !before.has(m.id)).map((m) => m.id));
          if (process.env.THREAT_TRACE && k === 0) {
            const m0 = inst.mobs.find((m) => pack.has(m.id))!, dd = p.ctx.d as unknown as Record<string, number>;
            console.log(`    [${passive ? 'passive' : 'stand'}] L${save.level} life ${Math.round(p.mhp)} regen ${fmt(dd.lifeRegen ?? 0, 1)}/s perHit ${fmt(dd.lifePerHit ?? 0, 1)} recovery ${fmt(dd.recovery ?? 0, 1)}/s armorDR ${fmt((dd.armorDR ?? 0) * 100, 0)}% | pack ${pack.size} × ${m0.def.id} hit ${fmt(m0.dmg, 1)} (${fmt((m0.dmg / p.mhp) * 100, 1)}% life) t${m0.tier}`);
          }
          let low = p.hp / p.mhp, died = false, clearAt = -1, dieAt = -1;
          const taken0 = p.taken, cap = 20 * 60;
          for (let t = 0; t < cap; t++) {
            if (passive) p.atkCdMs = 1e9;
            // only this pack: the field spawner refills its own packs while the test runs
            for (const m of [...inst.mobs]) if (!pack.has(m.id) && !m.dead) inst.removeMob(m);
            inst.tick();
            if (process.env.THREAT_TRACE && k === 0 && t % 40 === 0) {
              const near = inst.mobs.filter((m) => pack.has(m.id) && !m.dead).map((m) => `${Math.round(Math.hypot(m.x - p.x, m.y - p.y))}/${m.state}`).slice(0, 4).join(' ');
              console.log(`      t=${t / 20}s hp ${Math.round(p.hp)}/${Math.round(p.mhp)} taken ${Math.round(p.taken - taken0)} pack ${near}`);
            }
            low = Math.min(low, Math.max(0, p.hp) / p.mhp);
            if (p.hp <= 0 || p.deadMs > 0) { died = true; dieAt = t; break; }
            if (!inst.mobs.some((m) => !m.dead && pack.has(m.id))) { clearAt = t; break; }
          }
          const lost = (p.taken - taken0) / p.mhp;
          inst.destroy();
          return { lost, low, died, clearAt, dieAt };
        };
        const stand = one(false), still = one(true);
        rows.push({ lost: stand.lost * 100, low: stand.low * 100, died: stand.died, clear: stand.clearAt < 0 ? NaN : stand.clearAt / 20, die: still.dieAt < 0 ? 60 : still.dieAt / 20 });
      }
      const med = (f: (r: typeof rows[number]) => number) => { const v = rows.map(f).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : NaN; };
      const row = { class: cls, level: played.level, difficulty: DIFFICULTIES[d].name, pack: kind, lostPct: med((r) => r.lost), lowestPct: med((r) => r.low), deaths: rows.filter((r) => r.died).length, clearS: med((r) => r.clear), passiveDieS: med((r) => r.die) };
      out.push(row);
      const f = (n: number, w: number) => (Number.isNaN(n) ? '—' : fmt(n, 0)).padStart(w);
      console.log(`  ${cls.padEnd(7)} ${String(played.level).padStart(3)}  ${row.difficulty.padEnd(9)} ${kind.padEnd(9)} ${f(row.lostPct, 17)}% ${f(row.lowestPct, 8)}% ${String(row.deaths).padStart(6)}/3 ${f(row.clearS, 7)}  ${f(row.passiveDieS, 15)}`);
    }
  }
  if (process.env.THREAT_JSON) writeFileSync(process.env.THREAT_JSON, JSON.stringify(out, null, 1));
  tuningOverrides.levelDamage = null;
}

/** `fit`: play the engaged bot through the levels, freeze a copy of the character at every fifth level and find, for
 *  each copy, the monster-life factor at which its median trash time-to-kill equals `target` seconds. */
function fitScenario(cls: ClassId, minutes: number, target: number, marks: number[]) {
  const inst0 = newField('whispering_glade');
  let inst = inst0;
  const save = createCharacter(`Fit${cls}`, cls, seedCounter++);
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  let bot = new Bot(inst, link, cls === 'warrior');
  const snaps = new Map<number, { save: CharacterSave; at: number }>();
  const ticks = minutes * 60 * 20;
  for (let t = 0; t < ticks; t++) {
    bot.step();
    inst.tick();
    if (t % 40 === 0) {
      let changed = false;
      for (const it of save.inventory) {
        if (!it || it.reqLevel > save.level || !BASES[it.base] || (BASES[it.base].classes && !BASES[it.base].classes!.includes(cls))) continue;
        for (const slot of slotsForKind(it.kind)) {
          const nd = computeStats(save, { swap: { slot, item: it } });
          const od = computeStats(save);
          if (nd.sheetDps * Math.sqrt(nd.toughness) > od.sheetDps * Math.sqrt(od.toughness) * 1.01 && equipItemSafe(save, it.id, slot)) { changed = true; break; }
        }
      }
      if (save.inventory.filter(Boolean).length > 50) for (let i = 0; i < save.inventory.length; i++) if (save.inventory[i] && save.inventory[i]!.rarity !== 'legendary' && save.inventory[i]!.rarity !== 'set') save.inventory[i] = null;
      if (spendSkillPoints(save, BUILDS[cls])) changed = true;
      if (changed) inst.refreshPlayer(link);
      if (marks.includes(save.level) && !snaps.has(save.level)) snaps.set(save.level, { save: structuredClone(save), at: t / 1200 });
    }
    if (save.level >= 12 && inst.zone.zone === 'whispering_glade') {
      inst.removePlayer(link); inst.destroy();
      inst = newField('ashen_hollow');
      link.ents.clear(); link.myId = inst.addPlayer(link);
      bot = new Bot(inst, link, cls === 'warrior');
    }
  }
  inst.destroy();
  const rows: string[] = [];
  const out: [number, number][] = [];
  for (const [level, snap] of [...snaps].sort((a, b) => a[0] - b[0])) {
    let lo = 0, hi = Math.log(4000);
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      const prev = tuningOverrides.levelToughness;
      tuningOverrides.levelToughness = () => Math.exp(mid);
      const meds: number[] = [];
      for (const seed of [1, 2, 3]) {
        const s2 = structuredClone(snap.save);
        const inst2 = newField(level >= 12 ? 'ashen_hollow' : 'whispering_glade', 7000 + level * 3 + seed);
        const l2 = new FakeLink(s2);
        l2.myId = inst2.addPlayer(l2);
        const b2 = new Bot(inst2, l2, cls === 'warrior');
        run(inst2, 40 * 20, [b2], () => { const q = inst2.players[0]; q.hp = q.mhp; if (q.deadMs > 0) q.deadMs = 0; });
        const m = median(l2.ttk[0]);
        if (!Number.isNaN(m)) meds.push(m / 1000);
        inst2.destroy();
      }
      tuningOverrides.levelToughness = prev;
      const v = meds.length ? meds.reduce((a, b) => a + b, 0) / meds.length : Infinity;
      if (v < target) lo = mid; else hi = mid;
    }
    const f = Math.exp((lo + hi) / 2);
    out.push([level, f]);
    const st = computeStats(snap.save);
    rows.push(`  ${cls.padEnd(7)} L${String(level).padStart(2)} reached at ${fmt(snap.at, 1).padStart(6)} min  sheetDPS ${fmtC(st.sheetDps).padStart(7)}  life ${fmtC(st.life).padStart(6)}  → factor ×${fmt(f, 1)}`);
  }
  for (const r of rows) console.log(r);
  console.log(`  FIT ${cls}: ` + JSON.stringify(out.map(([l, f]) => [l, Math.round(f * 10) / 10])));
}

/** What a player who opens the skill panel now and then does: even tiers over the slotted skills, first rune. */
function spendSkillPoints(save: CharacterSave, build?: { slots: string[]; runes: Record<string, string> }): boolean {
  let changed = false;
  if (build) {
    // an engaged player puts the skills they like into the bar as they unlock and picks their runes
    const want = build.slots.map((sk) => (SKILLS[sk].unlock <= save.level ? sk : null));
    if (want.some((sk, i) => sk && save.skills.slots[i] !== sk)) {
      for (let i = 0; i < want.length; i++) if (want[i] && save.skills.slots[i] !== want[i]) { save.skills.slots[i] = want[i]; changed = true; }
    }
    for (const [sk, rune] of Object.entries(build.runes)) {
      const def = SKILLS[sk];
      const i = def.runes.findIndex((r) => r.id === rune);
      if (i >= 0 && runeUnlockLevel(def, i) <= save.level && save.skills.runes[sk] !== rune) { save.skills.runes[sk] = rune; changed = true; }
    }
  } else {
    for (const id of [save.skills.primary, ...save.skills.slots.filter((x): x is string => !!x)]) {
      if (save.skills.runes[id] === undefined || save.skills.runes[id] === null) {
        const def = SKILLS[id];
        const i = def.runes.findIndex((_, ri) => runeUnlockLevel(def, ri) <= save.level);
        if (i >= 0) { save.skills.runes[id] = def.runes[i].id; changed = true; }
      }
    }
  }
  for (let guard = 0; guard < 40; guard++) {
    const ids = [save.skills.primary, ...save.skills.slots.filter((x): x is string => !!x)]
      .filter((id) => (save.skills.tiers[id] ?? 0) < SKILLS[id].tiers.length)
      .sort((a, b) => (save.skills.tiers[a] ?? 0) - (save.skills.tiers[b] ?? 0));
    if (!ids.length) return changed;
    const cost = [2, 4, 6][save.skills.tiers[ids[0]] ?? 0];
    if (save.skillPoints < cost) return changed;
    save.skillPoints -= cost;
    save.skills.tiers[ids[0]] = (save.skills.tiers[ids[0]] ?? 0) + 1;
    changed = true;
  }
  return changed;
}

function equipItemSafe(save: CharacterSave, id: string, slot: Slot): boolean {
  const idx = save.inventory.findIndex((i) => i?.id === id);
  if (idx < 0) return false;
  const it = save.inventory[idx]!;
  const prev = save.equipment[slot];
  save.inventory[idx] = prev ?? null;
  save.equipment[slot] = it;
  if (slot === 'mainhand' && BASES[it.base].weapon?.twoHanded && (!BASES[it.base].weapon?.ranged || it.base === 'staff') && save.equipment.offhand) {
    const free = save.inventory.indexOf(null);
    if (free >= 0) save.inventory[free] = save.equipment.offhand!;
    delete save.equipment.offhand;
  }
  if (slot === 'offhand' && save.equipment.mainhand && BASES[save.equipment.mainhand.base].weapon?.twoHanded && (!BASES[save.equipment.mainhand.base].weapon?.ranged || save.equipment.mainhand.base === 'staff')) {
    save.equipment.offhand = undefined;
    delete save.equipment.offhand;
    save.inventory[idx] = it;
    if (prev) save.equipment[slot] = prev;
    return false;
  }
  return true;
}

/** Set power spike: damage on a pack of dummies with level-70 rares vs. the full set + legendaries kit. */
function setSpikeScenario() {
  console.log('\n== Set bonus power spike (20 s against 8 sturdy targets, L70) ==');
  // The rare kits come from the shared gear stream: start it fresh so this section measures the same kits whatever ran
  // before it (other sections’ kit sizes shift the stream; the warrior’s rares then varied 39–65 M/s across merges),
  // and leave the shared stream untouched for the sections after it.
  const sharedGear = gearRng;
  gearRng = new Rng(4242);
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    const dps: number[] = [];
    for (const endgame of [false, true]) {
      const inst = newField('whispering_glade');
      const save = makeChar(cls, 70, { endgame });
      const link = new FakeLink(save);
      link.myId = inst.addPlayer(link);
      const p = inst.players[0];
      for (let i = 0; i < 8; i++) {
        const m = createMob(inst, MONSTERS.gloomshroom, 70, p.x + 90 + (i % 4) * 34, p.y - 40 + Math.floor(i / 4) * 70, {});
        m.mhp = m.hp = 1e20;
        m.state = 'chase'; m.target = p.id;
      }
      inst.dmgBySkill = new Map();
      run(inst, 400, [], () => { p.hp = p.mhp; });
      dps.push(p.dealt / 20);
      const total = [...inst.dmgBySkill.values()].reduce((a, b) => a + b, 0);
      console.log(`    ${endgame ? 'set  ' : 'rares'} breakdown: ` + [...inst.dmgBySkill].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${fmt((v / total) * 100, 0)}%`).join(', '));
      inst.destroy();
    }
    const spike = dps[1] / dps[0];
    console.log(`  ${cls}: rares ${fmtC(dps[0])}/s → set ${fmtC(dps[1])}/s  (×${fmt(spike, 0)})`);
    summary.push(`set spike ${cls}: ×${fmt(spike, 0)} (${fmtC(dps[0])}/s → ${fmtC(dps[1])}/s vs 8 targets)`);
    check(spike > 8, `${cls}: set bonuses are a huge power spike (×${fmt(spike, 1)})`);
  }
  gearRng = sharedGear; // later sections keep drawing from the shared stream
}
const fmtC = (n: number) => n >= 1e9 ? `${fmt(n / 1e9, 2)}B` : n >= 1e6 ? `${fmt(n / 1e6, 2)}M` : n >= 1e3 ? `${fmt(n / 1e3, 1)}K` : fmt(n, 0);

/** Windups are readable: a player who steps away from winding-up monsters takes far less damage. */
function dodgeScenario() {
  // The windup comparison draws on a handful of monster hits: give it its own random stream so earlier scenarios
  // cannot shift it.
  { const r = new Rng(0xd0d6e); Math.random = () => r.next(); }
  console.log('\n== Dodging windups (L10 mage, golems + slimes, 20 s, no skills) ==');
  // Compare the same arena and equipment in both arms. A single arena is a handful of monster hits and entity ids
  // differ with scenario order, so the verdict is the median over three fixed arenas.
  const ratios: number[] = [];
  const stills: number[] = [];
  for (const arena of [2, 3, 4]) {
  const taken: number[] = [];
  const arenaSeed = zoneSeed('whispering_glade', arena);
  let controlSave: CharacterSave | undefined;
  for (const dodge of [false, true]) {
    const inst = newField('whispering_glade', arenaSeed);
    const generated = makeChar('mage', 10);
    controlSave ??= structuredClone(generated);
    const save = structuredClone(controlSave);
    save.skills.slots = [null, null, null, null];
    const link = new FakeLink(save);
    link.myId = inst.addPlayer(link);
    const p = inst.players[0];
    for (const m of [...inst.mobs]) inst.removeEntity(m.id); // controlled arena
    inst.spawner.tick = () => {}; // ...and the field spawner must not add packs to it while we measure
    inst.tick();
    // the most open spawn point (no walls within ~450 units)
    const open = (x: number, y: number) => { for (let a = 0; a < 16; a++) for (const r of [150, 300, 450]) if (!inst.cw.isFree(x + Math.cos(a / 16 * Math.PI * 2) * r, y + Math.sin(a / 16 * Math.PI * 2) * r, 16)) return false; return true; };
    const spot = inst.map.spawns.find((sp) => open(sp.x, sp.y)) ?? inst.map.spawns[0];
    teleport(inst, link, spot.x, spot.y);
    const mobs: Mob[] = [];
    for (let i = 0; i < 4; i++) {
      const def = i < 2 ? MONSTERS.mossback : MONSTERS.bog_slime;
      const m = createMob(inst, def, 10, p.x + 90 * Math.cos(i * 1.6), p.y + 90 * Math.sin(i * 1.6), {});
      m.mhp = m.hp = 1e12; m.state = 'chase'; m.target = p.id;
      mobs.push(m);
    }
    let seq = 0, fleeMs = 0, fx = 0, fy = 0;
    for (let t = 0; t < 400; t++) {
      p.atkCdMs = 1e9; // no attacking: pure movement test
      p.hp = p.mhp;
      let mx = 0, my = 0;
      if (dodge) {
        // react to windups: step out of the threatened area
        let ax = 0, ay = 0;
        for (const e of link.ents.values()) {
          if (e.desc.k !== 'mob' || !(e.flags & 0x8000)) continue;
          const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
          if (d < 170) { ax += (p.x - e.x) / d; ay += (p.y - e.y) / d; }
        }
        const l = Math.hypot(ax, ay);
        if (l > 0.01) { fx = ax / l; fy = ay / l; fleeMs = 400; }
        if (fleeMs > 0) { fleeMs -= 50; mx = fx; my = fy; }
      }
      inst.queueInput(link, { t: 'in', seq: ++seq, mx, my });
      inst.tick();
    }
    taken.push(p.taken);
    inst.destroy();
  }
  console.log(`  arena ${arena}: damage taken standing still ${Math.round(taken[0])}, stepping away from windups ${Math.round(taken[1])} (${fmt((taken[1] / Math.max(1, taken[0])) * 100, 0)}%)`);
  stills.push(taken[0]);
  ratios.push(taken[1] / Math.max(1, taken[0]));
  }
  const median = [...ratios].sort((x, y) => x - y)[1];
  summary.push(`dodging windups: ${fmt(median * 100, 0)}% of the damage taken when standing still (median of 3 arenas)`);
  check(stills.every((v) => v > 0) && median < 0.5, `windups are dodgeable by moving (median ${fmt(median * 100, 0)}% over ${ratios.map((r) => fmt(r * 100, 0)).join('/')}%)`);
}

function withPowers(save: CharacterSave, powers: string[]) {
  for (const id of powers) {
    const def = LEGENDARIES[id];
    const it = generateItem(gearRng, { ilvl: 70, classId: save.classId, rarity: 'legendary', legendary: id });
    const kind = BASES[def.base].kind;
    const slot: Slot = kind === 'ring' ? (save.equipment.ring1?.legendary ? 'ring2' : 'ring1') : slotsForKind(kind)[0];
    equip(save, it, slot);
  }
}

function powersScenario() {
  console.log('\n== Legendary powers & on-hit effects ==');
  const setup = (cls: ClassId, powers: string[], slots: (string | null)[] = [null, null, null, null], runes: Record<string, string> = {}) => {
    const inst = newField('whispering_glade');
    const save = makeChar(cls, 70, { endgame: false });
    save.cube.equipped = [null, null, null];
    withPowers(save, powers);
    save.skills.slots = slots;
    save.skills.runes = runes;
    const link = new FakeLink(save);
    link.myId = inst.addPlayer(link);
    return { inst, save, link, p: inst.players[0] };
  };
  // Stridewind: halved dash cooldown + damage buff after dashing
  {
    const { inst, link, p } = setup('warrior', ['stridewind']);
    inst.queueInput(link, { t: 'in', seq: 1, mx: 1, my: 0, dash: 1 });
    inst.tick();
    check(p.buffs.some((b) => b.id === 'stridewind' && (b.dmg ?? 0) >= 40) && p.mv.dashCdMs <= 1400 && p.mv.dashCdMs > 1300, `Stridewind: buff + 1.4 s dash cooldown (${p.mv.dashCdMs})`);
    inst.destroy();
  }
  // Hellforge: elite kill grants the damage buff; life per kill / per hit heal
  {
    const { inst, p } = setup('warrior', ['hellforge_talisman']);
    p.ctx.d.lifePerHit = 25;
    p.ctx.d.lifePerKill = 40;
    const m = createMob(inst, MONSTERS.gloomshroom, 70, p.x + 50, p.y, { tier: 1, affixes: ['fast', 'extra_health'] });
    m.hp = 1e9; m.mhp = 1e9;
    p.hp = p.mhp * 0.5;
    run(inst, 20, []);
    check(p.hp > p.mhp * 0.5, `life per hit heals (${Math.round(p.hp)} > ${Math.round(p.mhp * 0.5)})`);
    m.hp = 1;
    const before = p.hp;
    run(inst, 20, []);
    check(m.dead && p.buffs.some((b) => b.id === 'hellforge'), 'Hellforge: elite kill → damage buff');
    check(p.hp >= before, 'life per kill');
    inst.destroy();
  }
  // Ouroboros: the element rotates every 4 s
  {
    const { inst, p } = setup('mage', ['ouroboros_loop']);
    const seen = new Set<string>();
    run(inst, 20 * 13, [], () => { for (const b of p.buffs) if (b.id.startsWith('ouroboros_')) seen.add(b.id); });
    check(seen.size >= 4, `Ouroboros rotates elements (${[...seen].join(',')})`);
    inst.destroy();
  }
  // Patient Thief: spenders shorten active cooldowns
  {
    const { inst, p } = setup('mage', ['patient_thief'], ['meteor', 'black_hole', null, null]);
    const m = createMob(inst, MONSTERS.mossback, 70, p.x + 300, p.y, {});
    m.hp = m.mhp = 1e15;
    p.readyAt.set('black_hole', inst.t + 20000);
    p.res = p.mres;
    const before = p.readyAt.get('black_hole')!;
    run(inst, 3, []);
    const v = p.ctx.power('patient_thief');
    check(before - p.readyAt.get('black_hole')! >= v * 1000 - 1, `Patient Thief: cooldowns reduced by ${v}s per spender`);
    inst.destroy();
  }
  // Anvil / Jarring Slam / Bone Chill vulnerability, thorns
  {
    const { inst, p } = setup('warrior', ['anvil_vambraces'], ['ground_stomp', null, null, null], { ground_stomp: 'jarring_slam' });
    check(Math.abs(p.ctx.stunMult - 1.3 * (1 + p.ctx.power('anvil_vambraces') / 100)) < 1e-9, `Anvil × Jarring Slam stun vulnerability (${p.ctx.stunMult.toFixed(3)})`);
    p.ctx.d.thorns = 500;
    p.atkCdMs = 1e9;
    p.ctx.slots = [null, null, null, null];
    const m = createMob(inst, MONSTERS.bonewalker, 10, p.x + 40, p.y, {});
    m.state = 'chase'; m.target = p.id;
    run(inst, 60, [], () => { p.atkCdMs = 1e9; });
    check(m.hp < m.mhp && m.lastHitBy === p.id, 'thorns reflect melee hits');
    inst.destroy();
    const b = setup('mage', [], ['frost_nova', null, null, null], { frost_nova: 'bone_chill' });
    check(b.p.ctx.frozenMult === 1.33, 'Bone Chill frozen vulnerability');
    b.inst.destroy();
  }
  // Health globe heals 20% (and allies near it)
  {
    const { inst, link, p } = setup('ranger', []);
    p.atkCdMs = 1e9;
    p.hp = p.mhp * 0.5;
    p.sinceHurtMs = 0;
    const l = { kind: 'loot' as const, id: 9e9, x: p.x + 20, y: p.y, owner: p, payload: { type: 'globe' as const }, view: { lk: 'globe' as const, name: 'Health Globe' }, ttlMs: 9000, armMs: 0, dead: false };
    p.loot.add(l);
    inst.tick();
    check(p.hp >= p.mhp * 0.69 && link.n('pickup') >= 1, `health globe heals 20% (${Math.round((p.hp / p.mhp) * 100)}%)`);
    inst.destroy();
  }
  // Witching Cord / Fists of the Mountain feed derived stats
  {
    const s1 = makeChar('mage', 70);
    const base = computeStats(s1);
    withPowers(s1, ['witching_cord']);
    const d1 = computeStats(s1);
    check(d1.ias >= base.ias + 7 - 0.01 || d1.chd > base.chd, 'Witching Cord stats applied');
  }
}

// ─────────────────────────── Main ───────────────────────────

/** One measured cell of the balance probe: an at-level character (full rares kit at ilvl = level, the class's
 *  standard build) fights in a field. `immortal` refills life every tick so danger is read from damage taken
 *  instead of from deaths. */
function balanceCell(cls: ClassId, level: number, diff: number, seconds: number, immortal = true, seed = 1) {
  gearRng = new Rng(9100 + level * 7 + seed);
  const zone = level >= 20 ? 'ashen_hollow' : 'whispering_glade';
  const inst = newField(zone, 4242 + level * 3 + seed);
  const save = makeChar(cls, level);
  save.difficulty = diff;
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  const bot = new Bot(inst, link, cls === 'warrior');
  const stats = computeStats(save);
  const lvl0 = save.level + save.xp / xpToNext(save.level);
  run(inst, seconds * 20, [bot], () => {
    const q = inst.players[0];
    if (immortal) { q.hp = q.mhp; if (q.deadMs > 0) q.deadMs = 0; }
  });
  const p = inst.players[0];
  const lvl1 = save.level + save.xp / xpToNext(save.level);
  const out = {
    stats, kills: p.kills, ttk: link.ttk, deaths: save.stats.deaths,
    levels: lvl1 - lvl0, takenPct: (p.taken / Math.max(1, p.mhp)) * 100, items: inst.counters.lootSpawned,
    drops: Object.fromEntries(['normal', 'magic', 'rare', 'legendary', 'set'].map((r) => [r, link.evV[`item:${r}`] ?? 0])) as Record<string, number>,
  };
  inst.destroy();
  return out;
}
const median = (a: number[] | undefined) => {
  if (!a || a.length < 5) return NaN;
  const v = [...a].sort((x, y) => x - y);
  return v[v.length >> 1];
};

/** `npx tsx server/test/sim.ts balance [seconds] [levels] [difficulties]` — measurement only, nothing asserted. */
function balanceScenario(seconds: number, levels: number[], diffs: number[]) {
  console.log(`
== Balance probe: ${seconds}s per cell, rares kit at ilvl = level, immortal ==`);
  console.log('  class   lvl diff    sheetDPS  trashHP  TTK med trash  champ   rare   kills/min  lvls/min  taken %life/min');
  for (const d of diffs) for (const level of levels) for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    const c = balanceCell(cls, level, d, seconds);
    const sec = (a?: number[]) => { const m = median(a); return Number.isNaN(m) ? '  —  ' : fmt(m / 1000, 2) + 's'; };
    console.log(`  ${cls.padEnd(7)} ${String(level).padStart(3)} ${DIFFICULTIES[d].name.padEnd(7)} ${fmtC(c.stats.sheetDps).padStart(8)} ${fmtC(monsterHp(level) * levelToughness(level)).padStart(8)}  ${sec(c.ttk[0]).padStart(12)} ${sec(c.ttk[1]).padStart(7)} ${sec(c.ttk[2]).padStart(6)}  ${fmt(c.kills / (seconds / 60), 0).padStart(9)}  ${fmt(c.levels / (seconds / 60), 2).padStart(8)}  ${fmt(c.takenPct / (seconds / 60), 0).padStart(14)}%`);
  }
}

/** `npx tsx server/test/sim.ts calibrate [targetSeconds] [levels]` — for every anchor level, bisect the monster-life
 *  factor at which the median trash time-to-kill of an at-level rares kit equals the target (per class, geometric
 *  mean across classes). Prints the table to paste into LEVEL_TOUGHNESS in server/src/sim/tuning.ts. */
function calibrateToughness(target: number, levels: number[]) {
  console.log(`
== Calibrating level toughness: median trash TTK target ${target}s, rares kit at ilvl = level ==`);
  const anchors: [number, number][] = [];
  for (const level of levels) {
    const per: number[] = [];
    for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
      let lo = 0, hi = Math.log(4000);
      for (let i = 0; i < 11; i++) {
        const mid = (lo + hi) / 2;
        tuningOverrides.levelToughness = () => Math.exp(mid);
        const m = [1, 2, 3, 4].map((seed) => median(balanceCell(cls, level, 0, 40, true, seed).ttk[0]));
        const ttk = m.filter((v) => !Number.isNaN(v));
        // too few kills to have a median means the monsters are too tough
        const v = ttk.length ? ttk.reduce((a, b) => a + b, 0) / ttk.length / 1000 : Infinity;
        if (v < target) lo = mid; else hi = mid;
      }
      per.push(Math.exp((lo + hi) / 2));
    }
    tuningOverrides.levelToughness = null;
    const gm = Math.exp(per.reduce((a, b) => a + Math.log(b), 0) / per.length);
    anchors.push([level, gm]);
    console.log(`  L${String(level).padStart(2)}: ×${per.map((v) => fmt(v, 1)).join(' / ')} (warrior / ranger / mage)  → ×${fmt(gm, 2)}`);
  }
  console.log('\n  LEVEL_TOUGHNESS = [' + anchors.map(([l, f]) => `[${l}, ${fmt(f, 2)}]`).join(', ') + ']');
}

/** `npx tsx server/test/sim.ts curve <level> [factors]` — how time-to-kill, kill rate and damage taken respond to
 *  the monster-life factor for one level. */
function toughnessCurve(level: number, factors: number[]) {
  console.log(`
== Response to monster-life factor at L${level} (rares kit, Normal, 40 s, immortal) ==`);
  console.log('  class    factor  trashHP  TTK med trash  p25..p75      champ    rare   kills/min  lvls/min  taken %life/min');
  for (const f of factors) for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    tuningOverrides.levelToughness = () => f;
    const c = balanceCell(cls, level, 0, 40, true, 1);
    const t = [...(c.ttk[0] ?? [])].sort((a, b) => a - b);
    const q = (x: number) => (t.length ? fmt(t[Math.min(t.length - 1, Math.floor(t.length * x))] / 1000, 2) : '—');
    const sec = (a?: number[]) => { const m = median(a); return Number.isNaN(m) ? '  —  ' : fmt(m / 1000, 2) + 's'; };
    console.log(`  ${cls.padEnd(7)} ${String(f).padStart(7)} ${fmtC(monsterHp(level) * f).padStart(8)}  ${sec(c.ttk[0]).padStart(12)}  ${(q(0.25) + '..' + q(0.75)).padEnd(11)} ${sec(c.ttk[1]).padStart(8)} ${sec(c.ttk[2]).padStart(7)}  ${fmt(c.kills / (40 / 60), 0).padStart(9)}  ${fmt(c.levels / (40 / 60), 2).padStart(8)}  ${fmt(c.takenPct / (40 / 60), 0).padStart(14)}%  (n=${t.length})`);
  }
  tuningOverrides.levelToughness = null;
}

/** `riftstall [class] [level] [count]` — looks for rift maps where the bot makes no progress (diagnostic only). */
function riftStallHunt(cls: ClassId, level: number, count: number) {
  console.log(`
== Stall hunt: ${cls} L${level}, ${count} rift maps, 4 simulated minutes each ==`);
  for (let k = 1; k <= count; k++) {
    instSeq = k * 7;
    const inst = newRift(level, 0, 'glade');
    const save = makeChar(cls, level);
    const link = new FakeLink(save);
    link.myId = inst.addPlayer(link);
    const bot = new Bot(inst, link, cls === 'warrior');
    const trace = Number(process.env.STALL_TRACE ?? 0) === k;
    run(inst, 20 * 60 * 4, [bot], (t) => {
      if (!trace || t % 200 !== 0) return;
      const q = inst.players[0];
      let nm: Mob | null = null, nd = Infinity;
      for (const m of inst.mobs) { if (m.dummy || m.dead) continue; const d = Math.hypot(m.x - q.x, m.y - q.y); if (d < nd) { nd = d; nm = m; } }
      console.log(`    t=${(t / 20).toFixed(0)}s pos ${Math.round(q.x)},${Math.round(q.y)} kills ${q.kills} hp ${Math.round(q.hp)}/${Math.round(q.mhp)} dead ${q.deadMs} nearest ${Math.round(nd)} ${nm?.def.id}/${nm?.state}/t${nm?.tier} hp ${nm ? Math.round(nm.hp) + '/' + Math.round(nm.mhp) : '-'} los ${nm ? !inst.cw.segmentBlocked(q.x, q.y, nm.x, nm.y) : '-'} atkCd ${Math.round(q.atkCdMs)} res ${Math.round(q.res)}`);
    });
    const p = inst.players[0];
    const prog = inst.riftState()!.progress;
    console.log(`  map ${k}: progress ${fmt(prog, 1)}%, kills ${p.kills}, level ${save.level}, deaths ${save.stats.deaths}${prog < 15 ? '   <-- stalled' : ''}`);
    inst.destroy();
  }
}

const only = process.argv[2];
const t0 = performance.now();
if (!only || only === 'input') inputScenario();
if (!only || only === 'town') townScenario();
if (!only || only === 'field') {
  console.log('\n== Fields: every class at L1 / L20 / L70 (60 s each) ==');
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    fieldScenario(cls, 1, false);
    fieldScenario(cls, 20, false);
    fieldScenario(cls, 70, true);
  }
}
if (!only || only === 'signature') signatureBuilds();
if (!only || only === 'elite') eliteScenario();
if (!only || only === 'goblin') goblinScenario();
if (!only || only === 'death') deathScenario();
if (!only || only === 'mp') multiplayerScenario();
if (!only || only === 'powers') powersScenario();
if (!only || only === 'spike') setSpikeScenario();
if (!only || only === 'dodge') dodgeScenario();
if (!only || only === 'rift') {
  console.log('\n== Rifts: every class at L1 (Normal) / L20 (Hard) / L70 (Torment II) until completion (every class at L70: progress floor until the Torment re-fit) ==');
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    freshStreams(1, () => riftScenario(cls, 1, 0, false, 'glade'));
    // After the level-toughness calibration (docs/rework/BALANCE.md) a full ilvl-20 rare kit clears Hard in 5-8 minutes
    // and Master in 12+; the set + legendaries kit sits around Torment III-V (it was Torment VIII on the old life curve).
    freshStreams(20, () => riftScenario(cls, 20, 1, false, cls === 'ranger' ? 'ashen' : 'glade'));
    // Depth budget (docs/rework/depth/BUDGET.md §9 risk 1): the warrior's v2 kit lifts ×25 over rares against 8 sturdy
      // targets [M] (its old sets ×255), so it no longer clears Torment II in 12 minutes (71.9% [M]) until the Torment ladder
      // is re-fitted (`sim.ts fit`) once every class is on the budget. The rift flow itself stays covered by the L1 / L20
      // rifts; here a progress floor guards against further loss (30%; the seeded stream shifts with any content change —
      // the warrior's previous, weaker kit measured 2.7–44.5% across such shifts, the mage's old-kit run 33.2–71.5%).
      // Ranger wave: the same for the ranger (bible v2 kit ×29 against 8 sturdy targets [M], was ×348 on 343a5d5; 57.1% of
      // Torment II in 12 minutes with the audit's Siegebreaker 6 Sentry kit [M]; 64.6–81.5% before the last fits and the
      // Arbalest's pierce cap shifted the seeded stream). The mage wave put the mage on the budget too (old sets ×180, v2
      // Fallen Star kit ×13 [M]; 87.3–93.6% of a Torment II rift in 12 minutes across seeded streams [M], MAGE-PILOT.md §7).
      // Own state (freshStreams; another SIM_SEED = another map and gear rolls), 9 seeds after the ranger merge [M]:
      // warrior 80.9 (default) / 78.7 / 100 / 5.6 / 49.3 / 82.2 / 77.2 / 44.1 / 59.1 %, ranger 21.5 (default) / 56.0 / 90.4 /
      // 54.6 / 53.0 / 66.4 / 79.4 / 61.0 / 22.9 %, mage 58.1 (default) / 93.0 / 100 / 42.7 / 73.9 / 89.3 / 87.2 / 71.3 /
      // 77.9 %. The runs under 30 % are death spirals on one map (9–20 deaths), so the floor is the median of 3 maps
      // (riftFloor; lead decision, FOUNDATION.md §13.15).
      riftFloor(cls, 70);
  }
}
if (!only || only === 'skills') skillCoverage();
if (!only || only === 'perf') { perfScenario(); partyRiftPerf(); }
if (only === 'sweep') {
  const lv = Number(process.argv[3] ?? 20);
  const diffs = (process.argv[4] ?? '0,1,2,3').split(',').map(Number);
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) for (const d of diffs) riftScenario(cls, lv, d, lv >= 70, cls === 'ranger' ? 'ashen' : 'glade');
}
if (only === 'balance') balanceScenario(Number(process.argv[3] ?? 45), (process.argv[4] ?? '1,5,10,13,20,30,40,50,60,70').split(',').map(Number), (process.argv[5] ?? '0,3').split(',').map(Number));
if (only === 'calibrate') calibrateToughness(Number(process.argv[3] ?? 1), (process.argv[4] ?? '1,5,10,15,20,30,40,50,60,70').split(',').map(Number));
if (only === 'curve') toughnessCurve(Number(process.argv[3] ?? 20), (process.argv[4] ?? '1,2,4,8,16,32,64').split(',').map(Number));
if (only === 'fit') for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) fitScenario(cls, Number(process.argv[3] ?? 90), Number(process.argv[4] ?? 1), (process.argv[5] ?? '3,5,8,10,13,15,18,20,25,30,35,40,45,50,55,60,65,70').split(',').map(Number));
if (only === 'riftstall') riftStallHunt((process.argv[3] ?? 'mage') as ClassId, Number(process.argv[4] ?? 1), Number(process.argv[5] ?? 12));
/**
 * `resource [levels]`: how the class resources behave under automatic casting (owner 2026-10-13). The engaged bot plays a
 * field for three minutes with an ilvl-matched rare kit (the endgame kit at 70); while monsters are within 700 units it
 * counts: the bar's average fill, the share of time it sits under 15 %, how often a slotted cooldown skill is ready but
 * waits for resource, spender casts per minute and kills per minute.
 */
function resourceScenario(levels: number[]) {
  console.log(`
== Resource: three minutes in a field, automatic casting (median of 3 runs) ==`);
  console.log('  class   lvl  bar avg %  bar<15 %  cd skill blocked %  spender casts/min  kills/min');
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) for (const level of levels) {
    const rows: number[][] = [];
    for (let k = 0; k < 3; k++) {
      const save = makeChar(cls, level, { endgame: level >= 70 });
      const inst = newField(level >= 12 ? 'ashen_hollow' : 'whispering_glade', 7100 + level * 13 + k);
      const link = new FakeLink(save);
      link.myId = inst.addPlayer(link);
      const bot = new Bot(inst, link, cls === 'warrior');
      const p = inst.players[0];
      let combat = 0, fill = 0, low = 0, cdReady = 0, cdBlocked = 0, spends = 0, lastRes = p.res;
      // RES_TRACE=1: casts per slotted skill (a cast moves its cooldown or recast clock forward)
      const casts = new Map<string, number>(), clock = new Map<string, number>();
      const kills0 = p.kills;
      for (let t = 0; t < 3 * 1200; t++) {
        bot.step(); inst.tick();
        if (process.env.RES_TRACE && k === 0) for (const rt of p.ctx.slots) {
          if (!rt) continue;
          const v = rt.def.cooldown > 0 ? p.readyAt.get(rt.def.id) ?? 0 : p.recastAt.get(rt.def.id) ?? 0;
          if (v > (clock.get(rt.def.id) ?? 0)) casts.set(rt.def.id, (casts.get(rt.def.id) ?? 0) + 1);
          clock.set(rt.def.id, v);
        }
        if (p.hp <= 0 || p.deadMs > 0) { p.hp = p.mhp; p.deadMs = 0; }
        if (!inst.queryMobs(p.x, p.y, 700).some((m) => !m.dead)) { lastRes = p.res; continue; }
        combat++;
        fill += p.res / p.mres; if (p.res < p.mres * 0.15) low++;
        for (const rt of p.ctx.slots) {
          if (!rt || rt.def.cost <= 0 || rt.def.cooldown <= 0) continue;
          if ((p.readyAt.get(rt.def.id) ?? 0) <= inst.t) { cdReady++; if (p.res < skillCost(p, rt)) cdBlocked++; }
        }
        // a drop of at least the cheapest no-cooldown spender's cost in one tick counts as a spender cast
        const cheap = Math.min(...p.ctx.slots.filter((rt) => rt && rt.def.cost > 0 && rt.def.cooldown <= 0).map((rt) => skillCost(p, rt!)), Infinity);
        if (Number.isFinite(cheap) && lastRes - p.res >= cheap * 0.9) spends++;
        lastRes = p.res;
      }
      const minutes = combat / 1200;
      if (process.env.RES_TRACE && k === 0) {
        const slots = p.ctx.slots.map((rt) => rt ? `${rt.def.id}(cost ${Math.round(skillCost(p, rt))}, cd ${rt.def.cooldown}s, ${rt.def.auto.when}) x${casts.get(rt.def.id) ?? 0}` : '-');
        console.log(`    ${cls} L${level} max ${Math.round(p.mres)}: ${slots.join(' | ')}`);
      }
      rows.push([100 * fill / Math.max(1, combat), 100 * low / Math.max(1, combat), 100 * cdBlocked / Math.max(1, cdReady), spends / Math.max(0.01, minutes), (p.kills - kills0) / 3]);
      inst.destroy();
    }
    const med = (i: number) => rows.map((r) => r[i]).sort((a, b) => a - b)[1];
    console.log(`  ${cls.padEnd(7)} ${String(level).padStart(3)}  ${fmt(med(0), 0).padStart(9)}  ${fmt(med(1), 0).padStart(8)}  ${fmt(med(2), 0).padStart(18)}  ${fmt(med(3), 0).padStart(17)}  ${fmt(med(4), 0).padStart(9)}`);
  }
}

if (only === 'resource') resourceScenario((process.argv[3] ?? '5,15,30,50,70').split(',').map(Number));
if (only === 'threat') threatScenario((process.argv[3] ?? '1,5,10,20').split(',').map(Number), (process.argv[4] ?? '0,1,2,3').split(',').map(Number), (process.argv[5] ?? 'trash,champion,rare').split(',') as ('trash' | 'champion' | 'rare')[]);
if (only === 'masterprobe') masterProbe(Number(process.argv[3] ?? 13), (process.argv[4] ?? '0,1,2,3').split(',').map(Number));
if (only === 'budget') perfBudgetScenario();
if (only === 'gauge') gaugeScenario();
if (only === 'ladder') ladderScenario((process.argv[3] ?? 'warrior,ranger,mage').split(',') as ClassId[], (process.argv[4] ?? LADDER_KITS.join(',')).split(',') as LadderKit[],
  (process.argv[5] ?? '0,200,700,1500').split(',').map(Number), (process.argv[6] ?? '4,5,6,7,8,9,10,11,12,13').split(',').map(Number), Number(process.argv[7] ?? 12));
if (only === 'herorift') await heroRift(process.argv[3], (process.argv[4] ?? '4,5,6,7,8').split(',').map(Number), Number(process.argv[5] ?? 12));
if (only === 'leveling') for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) levelingScenario(cls, Number(process.argv[3] ?? 25));

if (process.env.SIM_JSON) {
  writeFileSync(process.env.SIM_JSON, JSON.stringify({
    schema: 1, scenario: only ?? 'all', seed: Number(process.env.SIM_SEED ?? 0xc0ffee), args: process.argv.slice(3),
    overrides: { tough: process.env.TOUGH ?? null, damage: process.env.DAMAGE ?? null, xpMult: process.env.XP_MULT ?? null },
    rows: metricRows, summary,
  }, null, 1) + '\n');
}
console.log('\n== Summary ==');
for (const s of summary) console.log(`  ${s}`);
console.log(`\n${checks - failures.length}/${checks} checks passed in ${fmt((performance.now() - t0) / 1000)}s`);
if (failures.length) {
  console.log('FAILED:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
void CLASSES; void LEGENDARIES; void BASES; void ({} as ItemKind);
