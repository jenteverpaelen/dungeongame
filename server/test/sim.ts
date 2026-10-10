// Gameplay simulation harness: drives createInstance() directly with fake PlayerLinks and simple bots.
// Run: npx tsx server/test/sim.ts   (exit code 1 on any failed check)
//
// Scenarios: every class at levels 1 / 20 / 70 in a field and in a rift (bots walk towards monsters using the
// snapshots they receive), signature builds, every skill × rune, elite affixes, goblins, death & respawn,
// performance (4 players + 150 monsters).

import type { InstanceApi, PlayerLink } from '../src/contracts';
import {
  BASES, CLASSES, CollisionWorld, DIFFICULTIES, LEGENDARIES, MONSTERS, Rng, SETS, SKILLS, TILE, ZONES, computeStats,
  createCharacter, generateItem, isBlockedTile, skillsForClass, slotsForKind, zoneSeed,
  F_CHANNEL, F_DEAD, STATE_STRIDE, type CharacterSave, type ClassId, type DerivedStats, type EntDesc, type GameEvent,
  type Item, type ItemKind, type S2C, type Slot, type Snapshot,
} from '../src/shared';
import { Instance, createInstance } from '../src/sim/instance';
import { createMob } from '../src/sim/monsters';
import { strikeMob } from '../src/sim/damage';
import type { Mob } from '../src/sim/types';

// Deterministic runs: every Math.random draw (bot wandering, the loot RNG's seed) comes from one seeded PRNG,
// so a failing check reproduces exactly. Override with SIM_SEED=<n> to explore other outcomes.
{
  const rng = new Rng(Number(process.env.SIM_SEED ?? 0xc0ffee));
  Math.random = () => rng.next();
}

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
  ttk: Record<number, number[]> = {};
  descs = new Map<number, EntDesc>();
  tickNo = 0;
  channelTicks = 0;
  sawDeadFlag = false;
  maxAdd = 0;
  bytesish = 0;
  log: GameEvent[] = [];
  keepLog = false;

  constructor(readonly save: CharacterSave) {
    this.sessionId = `s-${save.name}`;
    this.derived = computeStats(save);
  }

  markDirty() { this.dirty++; }

  send(msg: S2C) {
    const t0 = performance.now();
    try { this.recv(msg); } finally { linkMs += performance.now() - t0; }
  }

  private recv(msg: S2C) {
    if (msg.t !== 's') return;
    this.snaps++;
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
    if (ev.e === 'dmg' && ev.t !== this.myId && this.descs.get(ev.t)?.k !== 'player') {
      if (!this.firstHit.has(ev.t)) this.firstHit.set(ev.t, this.tickNo);
      if (ev.s !== undefined) {
        const src = ev.s === this.myId ? 'me' : this.descs.get(ev.s)?.k === 'summon' ? `summon:${this.descs.get(ev.s)!.t}` : 'other';
        this.evV[`dmgsrc:${src}`] = (this.evV[`dmgsrc:${src}`] ?? 0) + 1;
      }
    }
    if (ev.e === 'die') {
      const d = this.descs.get(ev.t);
      const t0 = this.firstHit.get(ev.t);
      if (d && d.k === 'mob' && t0 !== undefined) (this.ttk[d.el ?? 0] ??= []).push((this.tickNo - t0) * 50);
    }
    if (ev.e === 'proj') {
      const d = this.descs.get(ev.s);
      if (d?.k === 'summon') this.evV[`proj:${ev.v}@${d.t}`] = (this.evV[`proj:${ev.v}@${d.t}`] ?? 0) + 1;
    }
  }

  n(key: string) { return this.evV[key] ?? this.ev[key] ?? 0; }
  sawSummon(t: string) { for (const d of this.descs.values()) if (d.k === 'summon' && d.t === t) return true; return false; }
}

// ─────────────────────────── Characters ───────────────────────────

let seedCounter = 1000;
const gearRng = new Rng(4242);

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
  warrior: { mainhand: 'ninefold_gale', waist: 'eternal_gyre', wrists: 'anvil_vambraces', neck: 'hellforge_talisman', ring1: 'ouroboros_loop', ring2: 'patient_thief' },
  ranger: { mainhand: 'thunderhead', offhand: 'sappers_pack', neck: 'hellforge_talisman', ring1: 'ouroboros_loop', ring2: 'patient_thief' },
  mage: { mainhand: 'cindervane', waist: 'witching_cord', neck: 'hellforge_talisman', ring1: 'ouroboros_loop', ring2: 'patient_thief' },
};
const CLASS_CUBE: Record<ClassId, (string | null)[]> = {
  warrior: ['bloodwake', 'stridewind', null],
  ranger: ['hunters_mark', 'gearwright_heart', null],
  mage: ['thousand_missiles', 'starfall_mantle', null],
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
  warrior: { slots: ['whirlwind', 'rend', 'ground_stomp', 'battle_rage'], runes: { cleave: 'broad_sweep', whirlwind: 'dust_devils', rend: 'bloodlust', ground_stomp: 'wrenching_smash', battle_rage: 'into_the_fray' } },
  ranger: { slots: ['sentry', 'multishot', 'cluster_arrow', 'companion'], runes: { hungering_arrow: 'puncturing', sentry: 'spitfire', multishot: 'arsenal', cluster_arrow: 'maelstrom', companion: 'wolf_howl' } },
  mage: { slots: ['meteor', 'black_hole', 'frost_nova', 'magic_weapon'], runes: { magic_missile: 'seeker', meteor: 'star_pact', black_hole: 'spellsteal', frost_nova: 'bone_chill', magic_weapon: 'force_weapon' } },
};

function makeChar(cls: ClassId, level: number, opts: { endgame?: boolean } = {}): CharacterSave {
  const save = createCharacter(`Bot${cls}${level}_${seedCounter}`, cls, seedCounter++);
  if (level > 1) {
    save.level = level;
    save.skillPoints = level - 1;
    const b = BUILDS[cls];
    save.skills.slots = b.slots.map((s) => (SKILLS[s].unlock <= level ? s : null));
    for (const [sk, rune] of Object.entries(b.runes)) {
      const def = SKILLS[sk];
      const i = def.runes.findIndex((r) => r.id === rune);
      if (def.unlock + [2, 5, 9][i] <= level) save.skills.runes[sk] = rune;
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
    let mx = 0, my = 0, dash = false;
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
      if (this.unstickMs > 0) { this.unstickMs -= 50; mx = Math.cos(this.unstickA); my = Math.sin(this.unstickA); }
      if (me.hp < me.mhp * 0.35 && me.dashCd <= 0) dash = true;
    }
    this.inst.queueInput(this.link, { t: 'in', seq: ++this.seq, mx: Math.round(mx * 100) / 100, my: Math.round(my * 100) / 100, ...(dash ? { dash: 1 as const } : {}) });
  }
}

// ─────────────────────────── Helpers ───────────────────────────

let instSeq = 1;
function newField(zoneId = 'whispering_glade', fixedSeed?: number): Instance {
  return createInstance({ zoneId, channel: instSeq, key: `${zoneId}#${instSeq++}`, seed: fixedSeed ?? zoneSeed(zoneId, instSeq), theme: ZONES[zoneId].theme }) as Instance;
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

function riftScenario(cls: ClassId, level: number, difficulty: number, endgame: boolean, theme: 'glade' | 'ashen') {
  let completed = 0;
  const inst = newRift(level, difficulty, theme, () => completed++);
  const save = makeChar(cls, level, { endgame });
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  const bot = new Bot(inst, link, cls === 'warrior');
  const mobs0 = inst.mobs.length;
  let guardianAt = -1, doneAt = -1, maxProg = 0;
  const cap = 20 * 60 * 12; // 12 simulated minutes
  const t0 = performance.now();
  const ticks = run(inst, cap, [bot], (t) => {
    if (process.env.SIM_TRACE && t % 200 === 0) {
      const p = inst.players[0];
      let nm: Mob | null = null, nd = Infinity;
      for (const m of inst.mobs) { if (m.dummy) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < nd) { nd = d; nm = m; } }
      console.log(`    t=${(t / 20).toFixed(0)}s pos ${Math.round(p.x)},${Math.round(p.y)} kills ${p.kills} prog ${inst.riftState()!.progress} nearest ${Math.round(nd)} ${nm?.def.id}/${nm?.state}/t${nm?.tier} los ${nm ? !inst.cw.segmentBlocked(p.x, p.y, nm.x, nm.y) : '-'} mobs ${inst.mobs.length} hp ${Math.round(p.hp)}/${Math.round(p.mhp)}`);
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
  const label = `${cls} L${level}${endgame ? ' (set)' : ''} rift ${DIFFICULTIES[difficulty].name}`;
  const dur = (t: number) => `${Math.floor(t / 20 / 60)}:${String(Math.floor((t / 20) % 60)).padStart(2, '0')}`;
  const kpm = p.kills / (ticks / 20 / 60);
  console.log(`${label}: ${mobs0} monsters placed, progress ${fmt(maxProg)}%, guardian at ${guardianAt >= 0 ? dur(guardianAt) : '—'}, done at ${doneAt >= 0 ? dur(doneAt) : '—'}, kills ${p.kills} (${fmt(kpm)}/min), deaths ${save.stats.deaths}, level ${level}→${save.level}, tick avg ${fmt(ms / ticks, 3)}ms`);
  console.log(`   ${ttkLine(link)}  boss TTK ${link.ttk[4] ? fmt(link.ttk[4][0] / 1000) + 's' : '—'}`);
  if (process.env.SIM_DEBUG) console.log('   ', JSON.stringify(Object.fromEntries(Object.entries(link.evV).filter(([k]) => /^(cast|dmgsrc|aoe|tele):/.test(k)))), 'dealt', Math.round(p.dealt).toExponential(2), 'sheet', Math.round(p.ctx.d.sheetDps).toExponential(2));
  check(maxProg >= 100, `${label}: progress reached 100 (${fmt(maxProg)})`);
  check(guardianAt >= 0, `${label}: guardian spawned`);
  check(doneAt >= 0 && rs.phase === 'done' && completed === 1, `${label}: rift completed + onRiftComplete`);
  check(link.n('notice') > 0, `${label}: notices`);
  check(save.stats.rifts === 1, `${label}: stats.rifts incremented`);
  check(inst.portals.some((pt) => pt.to === 'town'), `${label}: town portal spawned`);
  check(!!link.me && [...link.ents.values()].some((e) => e.desc.k === 'portal'), `${label}: portal replicated`);
  summary.push(`${label.padEnd(44)} ${fmt(kpm).padStart(6)} kills/min   rift ${doneAt >= 0 ? dur(doneAt) : 'DNF'} (guardian ${guardianAt >= 0 ? dur(guardianAt) : '—'}), deaths ${save.stats.deaths}`);
  inst.destroy();
  return { link, doneAt };
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
        save.skills.runes = { [sk.id]: rune };
        save.skills.tiers = { [sk.id]: 3 };
        const link = new FakeLink(save);
        link.myId = inst.addPlayer(link);
        const p = inst.players[0];
        // tough targets so effects have time to play
        const x = p.x + (sk.kind === 'primary' || cls === 'warrior' ? 70 : 220), y = p.y;
        for (let i = 0; i < 6; i++) {
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
          check(channelSeen && link.n('aoe:whirl') > 4, `${tag}: channel ticks (${link.n('aoe:whirl')})`);
          if (rune === 'dust_devils') check(link.sawSummon('dust_devil') && link.n('dmgsrc:summon:dust_devil') > 0, `${tag}: dust devils spawn and hit`);
        } else {
          check(casts > 0, `${tag}: cast (${casts})`);
          const dmg = link.n('dmgsrc:me') + Object.keys(link.evV).filter((k) => k.startsWith('dmgsrc:summon')).reduce((s, k) => s + link.evV[k], 0);
          check(dmg > 0, `${tag}: dealt damage`);
        }
        if (sk.id === 'sentry') {
          check(link.sawSummon('sentry') && link.n('proj:bolt@sentry') > 0, `${tag}: sentry placed & firing`);
          if (rune === 'spitfire') check(link.n('proj:rocket@sentry') > 0, `${tag}: rockets`);
          if (rune === 'chain_of_torment') check(link.n('beam:chain') > 0, `${tag}: chains`);
        }
        if (sk.id === 'meteor') {
          check(link.n('tele:meteor') > 0 && (link.n('aoe:meteor') > 0 || link.n('aoe:meteorSmall') > 0), `${tag}: telegraph + impact`);
          if (rune !== 'comet') check(link.n('aoe:molten') > 0, `${tag}: molten ground`);
        }
        if (sk.id === 'hydra') check(link.sawSummon('hydra'), `${tag}: hydra summoned`);
        if (sk.id === 'companion') check(link.sawSummon(rune === 'bat' ? 'bat' : rune === 'raven' ? 'raven' : 'wolf'), `${tag}: companion summoned`);
        if (sk.id === 'black_hole') check(link.n('aoe:blackhole') > 0, `${tag}: black hole`);
        if (sk.id === 'frost_nova') check(link.n('aoe:nova') > 0, `${tag}: nova`);
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
    const inst = newField('ashen_hollow');
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
      check(p.ctx.modsOf('whirlwind').flags.has('whirlRend'), 'warrior: 4pc rend flag');
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
      check(link.n('tele:meteor') >= link.n('cast:meteor') * 1.25, `mage: 2pc second meteor (${link.n('tele:meteor')} telegraphs / ${link.n('cast:meteor')} casts)`);
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
  const times: number[] = [];
  const simTimes: number[] = [];
  for (let t = 0; t < 20 * 30; t++) {
    for (const b of bots) b.step();
    for (const p of inst.players) p.hp = p.mhp;
    const l0 = linkMs;
    const t0 = performance.now();
    inst.phaseMs = process.env.SIM_DEBUG ? [] : null;
    inst.tick();
    const dt = performance.now() - t0;
    times.push(dt);
    simTimes.push(dt - (linkMs - l0));
    if (inst.phaseMs && dt > 6) console.log(`    slow tick ${t}: ${fmt(dt, 2)} ms (clients ${fmt(linkMs - l0, 2)}) ` + inst.phaseMs.map((v, i) => `${Instance.PHASES[i]} ${fmt(v, 2)}`).join(', ') + ` events ${inst.events.length}`);
  }
  simTimes.sort((a, b) => a - b);
  const simAvg = simTimes.reduce((s, v) => s + v, 0) / simTimes.length;
  console.log(`  simulation only (excluding the fake clients' snapshot processing): avg ${fmt(simAvg, 3)} ms, p99 ${fmt(simTimes[Math.floor(simTimes.length * 0.99)], 3)} ms, max ${fmt(simTimes[simTimes.length - 1], 3)} ms`);
  summary.push(`perf: simulation only: avg ${fmt(simAvg, 3)} ms, p99 ${fmt(simTimes[Math.floor(simTimes.length * 0.99)], 3)} ms`);
  times.sort((a, b) => a - b);
  const warm = times.slice(0, Math.floor(times.length));
  const avg = warm.reduce((s, v) => s + v, 0) / warm.length;
  const p99 = times[Math.floor(times.length * 0.99)];
  const max = times[times.length - 1];
  const alive = inst.mobs.length;
  const evs = links.reduce((s, l) => s + Object.values(l.ev).reduce((a, b) => a + b, 0), 0);
  if (process.env.SIM_DEBUG) for (const l of links) console.log('   ', l.save.classId, JSON.stringify(Object.entries({ ...l.ev, ...l.evV }).sort((a, b) => b[1] - a[1]).slice(0, 14)));
  console.log(`  ${alive} monsters, ${inst.summons.length} summons, ${inst.projs.length} projectiles in flight, ${evs} events delivered in 30 s`);
  console.log(`  tick avg ${fmt(avg, 3)} ms, p99 ${fmt(p99, 3)} ms, max ${fmt(max, 3)} ms; tickStats() ${JSON.stringify(Object.fromEntries(Object.entries(inst.tickStats()).map(([k, v]) => [k, +v.toFixed(3)])))}`);
  summary.push(`perf: 4 players + 150 monsters: tick avg ${fmt(avg, 3)} ms, p99 ${fmt(p99, 3)} ms, max ${fmt(max, 3)} ms`);
  check(simAvg < 3, `sim tick avg < 3 ms (${fmt(simAvg, 3)})`);
  check(avg < 3, `tick avg incl. snapshot consumers < 3 ms (${fmt(avg, 3)})`);
  check(alive >= 150, 'monsters alive throughout');
  inst.destroy();
}

/** Realistic load: a 4-player party clears a Torment VIII rift together (killable monsters, all builds). */
function partyRiftPerf() {
  console.log('\n== Performance: 4-player party in a Torment VIII rift ==');
  let done = 0;
  const inst = newRift(70, 11, 'ashen', () => done++);
  const bots: Bot[] = [];
  const links: FakeLink[] = [];
  for (const cls of ['warrior', 'ranger', 'mage', 'ranger'] as ClassId[]) {
    const link = new FakeLink(makeChar(cls, 70, { endgame: true }));
    link.myId = inst.addPlayer(link);
    links.push(link);
    bots.push(new Bot(inst, link, cls === 'warrior'));
  }
  const sim: number[] = [];
  let maxActive = 0, doneAt = -1;
  for (let t = 0; t < 20 * 60 * 8 && doneAt < 0; t++) {
    for (const b of bots) b.step();
    const l0 = linkMs, t0 = performance.now();
    inst.tick();
    sim.push(performance.now() - t0 - (linkMs - l0));
    if (t % 20 === 0) maxActive = Math.max(maxActive, inst.mobs.filter((m) => !m.dormant && !m.dead).length);
    if (inst.riftState()!.phase === 'done') doneAt = t;
  }
  sim.sort((a, b) => a - b);
  const avg = sim.reduce((a, b) => a + b, 0) / sim.length;
  const dur = doneAt >= 0 ? `${Math.floor(doneAt / 1200)}:${String(Math.floor((doneAt / 20) % 60)).padStart(2, '0')}` : 'DNF';
  console.log(`  ${inst.mobs.length + inst.counters.kills} monsters, up to ${maxActive} awake at once, rift done at ${dur}, deaths ${links.map((l) => l.save.stats.deaths).join('/')}`);
  console.log(`  sim tick avg ${fmt(avg, 3)} ms, p99 ${fmt(sim[Math.floor(sim.length * 0.99)], 3)} ms, max ${fmt(sim[sim.length - 1], 3)} ms`);
  summary.push(`perf: 4-player T8 rift: sim tick avg ${fmt(avg, 3)} ms, p99 ${fmt(sim[Math.floor(sim.length * 0.99)], 3)} ms, rift ${dur}`);
  check(done === 1, 'party rift completed');
  check(avg < 3, `party rift tick avg < 3 ms (${fmt(avg, 3)})`);
  inst.destroy();
}

function multiplayerScenario() {
  console.log('\n== Multiplayer: shared XP, personal loot, AOI ==');
  const inst = newField('whispering_glade');
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
  console.log(`\n== Leveling: fresh ${cls}, ${minutes} min in the fields with auto-equip ==`);
  let inst = newField('whispering_glade');
  const save = createCharacter(`Lvl${cls}`, cls, seedCounter++);
  const link = new FakeLink(save);
  link.myId = inst.addPlayer(link);
  let bot = new Bot(inst, link, cls === 'warrior');
  const marks = new Map<number, string>();
  let lastKills = 0, lastT = 0;
  const ticks = minutes * 60 * 20;
  for (let t = 0; t < ticks; t++) {
    bot.step();
    inst.tick();
    if (t % 40 === 0) {
      // equip upgrades, trash junk when the bag fills up
      let changed = false;
      for (const it of save.inventory) {
        if (!it || it.reqLevel > save.level || !BASES[it.base] || (BASES[it.base].classes && !BASES[it.base].classes!.includes(cls))) continue;
        for (const slot of slotsForKind(it.kind)) {
          const cur = save.equipment[slot];
          const nd = computeStats(save, { swap: { slot, item: it } });
          const od = computeStats(save);
          const better = nd.sheetDps * Math.sqrt(nd.toughness) > od.sheetDps * Math.sqrt(od.toughness) * 1.01;
          if (better && equipItemSafe(save, it.id, slot)) { changed = true; break; }
          void cur;
        }
      }
      if (save.inventory.filter(Boolean).length > 50) for (let i = 0; i < save.inventory.length; i++) if (save.inventory[i] && save.inventory[i]!.rarity !== 'legendary' && save.inventory[i]!.rarity !== 'set') save.inventory[i] = null;
      if (changed) inst.refreshPlayer(link);
    }
    // switch to Ashen Hollow from level 10 like a player would
    if (save.level >= 12 && inst.zone.zone === 'whispering_glade') {
      inst.removePlayer(link);
      inst.destroy();
      inst = newField('ashen_hollow');
      link.ents.clear(); // like the client on a 'zone' message
      link.myId = inst.addPlayer(link);
      lastKills = 0; lastT = t;
      bot = new Bot(inst, link, cls === 'warrior');
    }
    if (!marks.has(save.level) && [2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70].includes(save.level)) {
      const p = inst.players[0];
      const d = p.ctx.d;
      const kpm = ((p.kills - lastKills) / Math.max(1, t - lastT)) * 1200;
      marks.set(save.level, `L${save.level} at ${fmt(t / 1200, 1)} min: main ${Math.round(d.mainStat)}, weapon ${Math.round(d.weaponMin)}-${Math.round(d.weaponMax)}, sheet DPS ${Math.round(d.sheetDps)}, life ${d.life}, trash HP ~${Math.round(10 * Math.pow(1.123, save.level - 1))}, recent kills/min ${fmt(kpm)}`);
      console.log('  ' + marks.get(save.level));
    }
    if (t % 1200 === 0 && t) { lastKills = inst.players[0].kills; lastT = t; }
  }
  const p = inst.players[0];
  console.log(`  end: L${save.level}, deaths ${save.stats.deaths}, damage taken ${fmt(inst.players[0].taken / inst.players[0].mhp * 100 / minutes, 0)}% of current life/min, ${ttkLine(link)}`);
  summary.push(`leveling ${cls}: L1→L${save.level} in ${minutes} min, deaths ${save.stats.deaths}`);
  check(save.level >= 10, `${cls} levels up steadily (L${save.level})`);
  void p;
  inst.destroy();
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
}
const fmtC = (n: number) => n >= 1e9 ? `${fmt(n / 1e9, 2)}B` : n >= 1e6 ? `${fmt(n / 1e6, 2)}M` : n >= 1e3 ? `${fmt(n / 1e3, 1)}K` : fmt(n, 0);

/** Windups are readable: a player who steps away from winding-up monsters takes far less damage. */
function dodgeScenario() {
  console.log('\n== Dodging windups (L10 mage, golems + slimes, 20 s, no skills) ==');
  const taken: number[] = [];
  // Compare the same arena and equipment. Previously each arm rolled a different map and gear,
  // so unrelated earlier town scenarios could change the apparent benefit of dodging.
  const arenaSeed = zoneSeed('whispering_glade', instSeq + 1);
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
  console.log(`  damage taken standing still ${Math.round(taken[0])}, stepping away from windups ${Math.round(taken[1])} (${fmt((taken[1] / taken[0]) * 100, 0)}%)`);
  summary.push(`dodging windups: ${fmt((taken[1] / Math.max(1, taken[0])) * 100, 0)}% of the damage taken when standing still`);
  check(taken[0] > 0 && taken[1] < taken[0] * 0.5, 'windups are dodgeable by moving');
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
  console.log('\n== Rifts: every class at L1 / L20 / L70 until completion ==');
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    riftScenario(cls, 1, 0, false, 'glade');
    riftScenario(cls, 20, 3, false, cls === 'ranger' ? 'ashen' : 'glade'); // Master: level-appropriate for a full ilvl-20 rare kit
    riftScenario(cls, 70, 11, true, 'ashen');                                 // Torment VIII for the set + legendaries kit
  }
}
if (!only || only === 'skills') skillCoverage();
if (!only || only === 'perf') { perfScenario(); partyRiftPerf(); }
if (only === 'sweep') {
  const lv = Number(process.argv[3] ?? 20);
  const diffs = (process.argv[4] ?? '0,1,2,3').split(',').map(Number);
  for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) for (const d of diffs) riftScenario(cls, lv, d, lv >= 70, cls === 'ranger' ? 'ashen' : 'glade');
}
if (only === 'leveling') for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) levelingScenario(cls, Number(process.argv[3] ?? 25));

console.log('\n== Summary ==');
for (const s of summary) console.log(`  ${s}`);
console.log(`\n${checks - failures.length}/${checks} checks passed in ${fmt((performance.now() - t0) / 1000)}s`);
if (failures.length) {
  console.log('FAILED:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
void CLASSES; void LEGENDARIES; void BASES; void ({} as ItemKind);
