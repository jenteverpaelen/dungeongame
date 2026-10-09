// Research-only calibration. Fixture/navigation adapted from server/test/sim.ts at 0eb7a1a.
// Retains all items; no test-side healing, equipment changes or inventory clearing during play.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { xpToNext, paragonXpToNext, TICK_MS } from '../server/src/shared';
import { XP_MULT } from '../server/src/config';
import type { Loot } from '../server/src/sim/types';
import type { PlayerLink } from '../server/src/contracts';
import {
  CollisionWorld, Rng, SKILLS, TILE, ZONES, computeStats,
  createCharacter, generateItem, isBlockedTile, slotsForKind,
  F_CHANNEL, F_DEAD, STATE_STRIDE, type CharacterSave, type ClassId, type DerivedStats, type EntDesc, type GameEvent,
  type Item, type S2C, type Slot, type Snapshot,
} from '../server/src/shared';
import { Instance } from '../server/src/sim/instance';
import type { Mob } from '../server/src/sim/types';


assert.ok(process.env.DATA_DIR, 'Explicit isolated DATA_DIR required');
assert.equal((await fs.readdir(process.env.DATA_DIR)).length, 0);
assert.equal(XP_MULT, 3, 'Calibration pins the existing prototype XP multiplier to3');
let seedCounter = 1000;
let gearRng = new Rng(4242);
interface CEnt { desc: EntDesc; x: number; y: number; hp: number; flags: number; aseq: number }

let linkMs = 0;
class FakeLink implements PlayerLink {
  recentEvents: GameEvent[] = [];
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
    this.recentEvents.push(ev);
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

const BUILDS: Record<ClassId, { slots: string[]; runes: Record<string, string> }> = {
  warrior: { slots: ['whirlwind', 'rend', 'ground_stomp', 'battle_rage'], runes: { cleave: 'broad_sweep', whirlwind: 'dust_devils', rend: 'bloodlust', ground_stomp: 'wrenching_smash', battle_rage: 'into_the_fray' } },
  ranger: { slots: ['sentry', 'multishot', 'cluster_arrow', 'companion'], runes: { hungering_arrow: 'puncturing', sentry: 'spitfire', multishot: 'arsenal', cluster_arrow: 'maelstrom', companion: 'wolf_howl' } },
  mage: { slots: ['meteor', 'black_hole', 'frost_nova', 'magic_weapon'], runes: { magic_missile: 'seeker', meteor: 'star_pact', black_hole: 'spellsteal', frost_nova: 'bone_chill', magic_weapon: 'force_weapon' } },
};

function makeChar(cls: ClassId, level: number): CharacterSave {
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
    gearRares(save, level);
  }
  return save;
}

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
    const hasRoom = this.link.save.inventory.some(item => item === null);
    if (me && me.dead <= 0) {
      const px = me.x, py = me.y;
      // pick up own items when nothing is close
      let lootT: CEnt | null = null, ld = 650;
      let closeMob = Infinity;
      for (const e of this.link.ents.values()) {
        if (e.desc.k === 'mob' && e.desc.t !== 'training_dummy') closeMob = Math.min(closeMob, Math.hypot(e.x - px, e.y - py));
        if (hasRoom && e.desc.k === 'loot' && e.desc.loot?.lk === 'item') {
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

function totalXp(save: CharacterSave): number {
  let total = save.xp + save.paragon.xp;
  for (let l = 1; l < save.level; l++) total += xpToNext(l);
  for (let p = 0; p < save.paragon.level; p++) total += paragonXpToNext(p);
  return total;
}
function distribution(values: number[]) {
  if (!values.length) return { n: 0 };
  const v = [...values].sort((a, b) => a - b);
  const quantile = (q: number) => v[Math.max(0, Math.ceil(q * v.length) - 1)];
  return { n: v.length, zeroSamples: v.filter(n => n === 0).length,
    minMs: v[0], medianMs: quantile(0.5), p90Ms: quantile(0.9), maxMs: v[v.length - 1] };
}
function lootTotals(loots: Iterable<Loot>) {
  const out = { entities: 0, gold: 0, gems: {} as Record<string, number>, deathsBreath: 0, globes: 0, items: {} as Record<string, number> };
  for (const l of loots) {
    out.entities++; const p = l.payload;
    if (p.type === 'item') out.items[p.item.rarity] = (out.items[p.item.rarity] ?? 0) + 1;
    else if (p.type === 'gold') out.gold += p.amount;
    else if (p.type === 'mat') out.deathsBreath += p.amount;
    else if (p.type === 'globe') out.globes++;
    else { const k = `${p.gem}:${p.rank}`; out.gems[k] = (out.gems[k] ?? 0) + 1; }
  }
  return out;
}
const outputIndex = process.argv.indexOf('--output');
const output = path.resolve(outputIndex < 0 ? 'docs/phase/P01-research/checks/field-calibration.json' : process.argv[outputIndex + 1]);
const cases: unknown[] = [], execution: unknown[] = [];
const originalRandom = Math.random;
try {
  for (const seed of [47, 73, 101]) for (const level of [1, 20, 70]) for (const cls of ['warrior', 'ranger', 'mage'] as ClassId[]) {
    // Isolate random consumption between cases; these are scenario IDs, not balance targets.
    const random = new Rng(seed); Math.random = () => random.next(); gearRng = new Rng(4242); seedCounter = 1000;
    const zoneId = level === 1 ? 'whispering_glade' : 'ashen_hollow';
    const save = makeChar(cls, level), initialXp = totalXp(save);
    const initial = { level, paragon: save.paragon.level, stats: computeStats(save), skills: structuredClone(save.skills), skillPoints: save.skillPoints,
      gear: Object.fromEntries(Object.entries(save.equipment).map(([slot, it]) => [slot, { base: it!.base, rarity: it!.rarity, ilvl: it!.ilvl, affixes: it!.affixes }])) };
    const link = new FakeLink(save);
    const inst = new Instance({ zoneId, key: 'calibration', seed, channel: 1, theme: ZONES[zoneId].theme });
    const startClock = performance.now(), callbackStart = linkMs;
    try {
      link.myId = inst.addPlayer(link); const player = inst.players[0], bot = new Bot(inst, link, cls === 'warrior');
      const spawned = new Map<number, Loot>(), picked = new Set<number>();
      const first: Record<string, number | null> = { killMs: null, levelMs: null, itemMs: null, legendaryOrSetMs: null, bagFullMs: null };
      const windows: unknown[] = [];
      let last = { kills: 0, deaths: 0, xp: 0, gold: 0, items: 0 }, deadMs = 0, movingMs = 0, travelUnits = 0;
      let px = player.x, py = player.y;
      for (let t = 0; t < 6000; t++) {
        bot.step(); inst.tick();
        if (player.deadMs > 0) deadMs += TICK_MS;
        if (player.moving && player.deadMs <= 0) movingMs += TICK_MS;
        // Exclude respawn relocation from walked distance.
        if (player.respawnTick !== inst.tickNo) travelUnits += Math.hypot(player.x - px, player.y - py);
        px = player.x; py = player.y;
        for (const loot of player.loot) if (!spawned.has(loot.id)) spawned.set(loot.id, loot);
        for (const ev of link.recentEvents) if (ev.e === 'pickup' && ev.t === player.id) {
          assert.ok(spawned.has(ev.l), 'Arming delay must make each reward observable before pickup');
          assert.ok(!picked.has(ev.l), 'No duplicate pickup event'); picked.add(ev.l);
          if (ev.lk === 'item') {
            first.itemMs ??= inst.t;
            if (ev.rarity === 'legendary' || ev.rarity === 'set') first.legendaryOrSetMs ??= inst.t;
          }
        }
        link.recentEvents.length = 0;
        if (player.kills) first.killMs ??= inst.t;
        if (save.level > level || save.paragon.level > initial.paragon) first.levelMs ??= inst.t;
        if (!save.inventory.includes(null)) first.bagFullMs ??= inst.t;
        if ((t + 1) % 1200 === 0) {
          const current = { kills: player.kills, deaths: save.stats.deaths, xp: totalXp(save) - initialXp,
            gold: save.gold, items: save.inventory.filter(Boolean).length };
          windows.push({ endMs: inst.t, level: save.level, paragon: save.paragon.level,
            ...Object.fromEntries(Object.keys(current).map(k => [k, current[k as keyof typeof current] - last[k as keyof typeof last]])) });
          last = current;
        }
      }
      const remaining = new Set([...player.loot].map(l => l.id));
      const dropped = lootTotals(spawned.values()), acquired = lootTotals([...picked].map(id => spawned.get(id)!));
      const ground = lootTotals(player.loot), expired = lootTotals([...spawned.values()].filter(l => !picked.has(l.id) && !remaining.has(l.id)));
      assert.equal(dropped.entities, inst.counters.lootSpawned);
      assert.equal(acquired.entities, inst.counters.lootPicked);
      assert.equal(dropped.entities, acquired.entities + ground.entities + expired.entities);
      assert.equal(save.gold, acquired.gold);
      assert.deepEqual(save.gems, acquired.gems);
      assert.equal(save.materials.deathsBreath, acquired.deathsBreath);
      const inventoryCounts: Record<string, number> = {};
      for (const it of save.inventory) if (it) inventoryCounts[it.rarity] = (inventoryCounts[it.rarity] ?? 0) + 1;
      assert.deepEqual(inventoryCounts, acquired.items);
      assert.equal(save.stats.kills, player.kills);
      assert.ok(player.kills <= inst.counters.kills, 'Credited kills cannot exceed world deaths');
      assert.equal(save.stats.deaths, inst.counters.playerDeaths);
      const xp = totalXp(save) - initialXp;
      assert.ok(Number.isSafeInteger(xp) && xp >= 0);
      const ttk = Object.fromEntries(Object.entries(link.ttk).map(([tier, values]) => [tier, distribution(values)]));
      const censored = inst.mobs.filter(m => !m.dead && link.firstHit.has(m.id)).length;
      cases.push({ seed, class: cls, initial, zoneId, difficulty: 'Normal', durationMs: inst.t,
        final: { level: save.level, paragon: save.paragon.level, creditedKills: player.kills, worldMonsterDeaths: inst.counters.kills,
          uncreditedMonsterDeaths: inst.counters.kills - player.kills, deaths: save.stats.deaths, xp, gold: save.gold, inventoryCount: save.inventory.filter(Boolean).length },
        rates: { killsPerMinute: player.kills / 5, xpPerHourEquivalent: xp * 12, goldPerHourEquivalent: save.gold * 12, deathsPerHourEquivalent: save.stats.deaths * 12 },
        first, deadMs, movingMs, travelUnits: Math.round(travelUnits), windows, dropped, acquired, ground, expired, ttk, censoredLiveTtkTargets: censored });
      execution.push({ seed, class: cls, level, elapsedMs: performance.now() - startClock, snapshotCallbackMs: linkMs - callbackStart });
      console.log(`${seed}/${cls}/L${level}: ${player.kills} kills; L${save.level}; ${xp} XP; ${save.gold} gold; ${save.inventory.filter(Boolean).length} kept items`);
    } finally { inst.destroy(); }
  }
} finally { Math.random = originalRandom; }
assert.equal(cases.length, 27);
assert.equal((await fs.readdir(process.env.DATA_DIR)).length, 0);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify({ node: process.version, xpMultiplier: XP_MULT, scope: 'Bot-assisted five-minute field visits, full-map navigation, retained inventory, no mid-run upgrades; simulated time is not human playtime. TTK is snapshot-observed first-hit to death at50ms resolution. Hour equivalents are arithmetic only.', cases, execution }, null, 2) + '\n');
console.log(output);

