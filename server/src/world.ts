// World manager: owns every simulated instance (town channels, field channels, rifts), places players in them,
// moves them between instances, garbage-collects empty ones and broadcasts world info.
// The gameplay simulation lives behind the InstanceApi contract (server/src/contracts.ts).

import { recordIntro } from '../../shared/src/onboarding';
import { Parties } from './party';
import { Social } from './social';
import { AccountStore } from './accounts';
import { Community } from './community';
import { ACCOUNT_MODE, EMPTY_RIFT_DESTROY_MS } from './config';
import type { CreateInstance, InstanceApi } from './contracts';
import { encode } from './net/codec';
import type { Session } from './net/session';
import { FIELD_CHANNEL_CAP, PARTY_MAX, PLAYER_RADIUS, TOWN_CHANNEL_CAP } from '../../shared/src/constants';
import { FIELD_IDS, ZONES, type Theme, type ZoneKind } from '../../shared/src/data/zones';
import { Rng } from '../../shared/src/math';
import { zoneSeed, type MapData } from '../../shared/src/mapgen';
import { CollisionWorld } from '../../shared/src/movement';
import { DIFFICULTIES } from '../../shared/src/progression';
import type { S2C, WorldInfo } from '../../shared/src/protocol';
import { requireNear } from './townServices';
import { zoneUnlocked, zoneLevelAllowed } from '../../shared/src/quests';

// ─────────────────────────── Command result helpers ───────────────────────────

export interface CmdResult { ok: boolean; err?: string; data?: unknown }
export const ok = (data?: unknown): CmdResult => (data === undefined ? { ok: true } : { ok: true, data });
export const fail = (err: string): CmdResult => ({ ok: false, err });

// ─────────────────────────── Records ───────────────────────────

export interface RiftMeta {
  key: string;
  rec: InstRec;
  ownerId: string;
  ownerName: string;
  /** Key of the town channel that hosts the rift portal. */
  townKey: string;
  portalId: number;
  portalAt: { x: number; y: number };
  portalRemoved: boolean;
  level: number;
  difficulty: number;
  theme: Theme;
  createdAt: number;
  /** Guardian slain: the rift can no longer be entered. */
  completed: boolean;
  /** Replaced by a newer rift of the same opener, or completed: no new entrants. */
  closed: boolean;
}

export interface InstRec {
  key: string;
  zoneId: string;
  kind: ZoneKind;
  channel: number;
  inst: InstanceApi;
  members: Set<Session>;
  /** Timestamp (ms) at which the instance last became empty (or was created). */
  emptySince: number;
  /** Town channels: the rifts opened from this channel. */
  hostedRifts: Set<RiftMeta>;
  /** Rift instances only. */
  rift?: RiftMeta;
}

const TOWN_ID = Object.values(ZONES).find((z) => z.kind === 'town')!.id;
const EMPTY_CHANNEL_DESTROY_MS = 5 * 60_000;
const WORLD_INFO_MS = 5_000;
const MAX_CHANNELS_PER_ZONE = 16;
const MAX_RIFTS = Number(process.env.MAX_RIFTS ?? 64);
const RIFT_THEMES: Theme[] = ['glade', 'ashen'];

const capOf = (kind: ZoneKind) => (kind === 'town' ? TOWN_CHANNEL_CAP : kind === 'field' ? FIELD_CHANNEL_CAP : PARTY_MAX);

/** Loads the gameplay simulation: server/src/sim/instance.ts, or the local test stub with SIM_STUB=1. */
async function loadCreateInstance(): Promise<CreateInstance> {
  if (process.env.SIM_STUB === '1') {
    const spec = '../test/stubInstance';
    const stub = (await import(spec)) as { createInstance?: CreateInstance };
    if (typeof stub.createInstance !== 'function') throw new Error('server/test/stubInstance.ts does not export createInstance');
    return stub.createInstance;
  }
  let sim: typeof import('./sim/instance');
  try {
    sim = await import('./sim/instance');
  } catch (err) {
    console.error('[world] the gameplay simulation (server/src/sim/instance.ts) failed to load. SIM_STUB=1 runs the infrastructure test stub instead.');
    throw err;
  }
  if (typeof sim.createInstance !== 'function') throw new Error('server/src/sim/instance.ts does not export createInstance');
  return sim.createInstance;
}

export class World {
  private create!: CreateInstance;
  private recs = new Map<string, InstRec>();
  /** zoneId -> channel number -> record (town and field channels). */
  private channels = new Map<string, Map<number, InstRec>>();
  private rifts = new Map<string, RiftMeta>();
  private riftByOwner = new Map<string, RiftMeta>();
  /** Character ids that are logged in or logging in. */
  private reserved = new Map<string, Session>();
  /** Sessions that are in the world (have a welcome). */
  private players = new Set<Session>();
  readonly parties:Parties=new Parties(()=>this.players,undefined,(a,b):boolean=>this.social.canInvite(a,b));
  readonly social:Social=new Social(()=>this.players,this.parties);
  /** Username/password accounts; only loaded when ACCOUNTS is `optional` or `required`. */
  readonly accounts = new AccountStore();
  readonly community:Community=new Community(()=>this.players,(a,b)=>this.social.blocked(a,b),s=>this.social.isEnabled(s),undefined,(a,b)=>this.social.presenceVisible(a,b));
  private lastInfoAt = 0;
  private tickErrAt = new Map<string, number>();
  private rng = new Rng((Math.random() * 0xffffffff) >>> 0);

  // ─────────────────────────── Lifecycle ───────────────────────────

  async init(): Promise<void> {
    if (ACCOUNT_MODE !== 'off') await this.accounts.init();
    await this.community.init();
    this.social.community=this.community;
    this.create = await loadCreateInstance();
    this.channelRec(TOWN_ID, 1);
    for (const id of FIELD_IDS) this.channelRec(id, 1);
  }

  /** Advance every instance one 50 ms step. A throwing instance must not take the world down. */
  tick(): void {
    for (const rec of this.recs.values()) {
      try {
        rec.inst.tick();
      } catch (err) {
        const now = Date.now();
        if (now - (this.tickErrAt.get(rec.key) ?? 0) > 5_000) {
          this.tickErrAt.set(rec.key, now);
          console.error(`[world] tick failed in ${rec.key}:`, err);
        }
      }
    }
  }

  /** Once per second: autosave, empty-instance cleanup and the periodic world info broadcast. */
  maintain(now = Date.now()): void {
    this.parties.tick(now);
    this.social.tick();
    void this.community.maintain();
    for (const rec of [...this.recs.values()]) {
      if (rec.members.size > 0) continue;
      const idle = now - rec.emptySince;
      if (rec.rift) {
        if (idle >= EMPTY_RIFT_DESTROY_MS) this.destroyRift(rec.rift);
      } else if (rec.kind === 'dungeon' && idle >= EMPTY_CHANNEL_DESTROY_MS) {
        rec.inst.destroy();this.recs.delete(rec.key);this.tickErrAt.delete(rec.key);
      } else if (rec.channel > 1 && rec.hostedRifts.size === 0 && idle >= EMPTY_CHANNEL_DESTROY_MS) {
        this.destroyChannel(rec);
      }
    }
    for (const s of this.players) s.autosave(now);
    if (now - this.lastInfoAt >= WORLD_INFO_MS) {
      this.lastInfoAt = now;
      this.broadcastInfo();
    }
  }

  async shutdown(): Promise<void> {
    await this.community.shutdown();
    for (const s of [...this.players]) s.shutdown('Server restarting');
    for (const rec of [...this.recs.values()]) {
      try { rec.inst.destroy(); } catch (err) { console.error(`[world] destroy ${rec.key} failed:`, err); }
    }
    this.recs.clear();
    this.channels.clear();
    this.rifts.clear();
    this.riftByOwner.clear();
  }

  // ─────────────────────────── Identity registry ───────────────────────────

  /** Reserve a character id for a session. False when it is already online. */
  reserve(id: string, s: Session): boolean {
    if (this.reserved.has(id)) return false;
    this.reserved.set(id, s);
    return true;
  }

  release(id: string, s: Session): void {
    if (this.reserved.get(id) === s) this.reserved.delete(id);
  }

  get onlineCount(): number { return this.players.size; }

  // ─────────────────────────── Instances ───────────────────────────

  private zoneChannels(zoneId: string): Map<number, InstRec> {
    let m = this.channels.get(zoneId);
    if (!m) this.channels.set(zoneId, (m = new Map()));
    return m;
  }

  private nextChannelNumber(zoneId: string): number {
    const m = this.zoneChannels(zoneId);
    let n = 1;
    while (m.has(n)) n++;
    return n;
  }

  /** Existing channel record, or a new one. */
  private channelRec(zoneId: string, n: number): InstRec {
    const m = this.zoneChannels(zoneId);
    const existing = m.get(n);
    if (existing) return existing;
    const def = ZONES[zoneId];
    const key = `${zoneId}#${n}`;
    const inst = this.create({ zoneId, channel: n, key, seed: zoneSeed(zoneId, n), theme: def.theme });
    const rec: InstRec = { key, zoneId, kind: def.kind, channel: n, inst, members: new Set(), emptySince: Date.now(), hostedRifts: new Set() };
    m.set(n, rec);
    this.recs.set(key, rec);
    return rec;
  }

  /** Town: lowest channel with room. Fields: least-full channel with room. A new channel is opened when all are full. */
  private pickChannel(zoneId: string): InstRec {
    const def = ZONES[zoneId];
    const cap = capOf(def.kind);
    let best: InstRec | null = null;
    for (const rec of [...this.zoneChannels(zoneId).values()].sort((a, b) => a.channel - b.channel)) {
      if (rec.members.size >= cap) continue;
      if (def.kind === 'town') { best = rec; break; }
      if (!best || rec.members.size < best.members.size) best = rec;
    }
    return best ?? this.channelRec(zoneId, this.nextChannelNumber(zoneId));
  }

  private destroyChannel(rec: InstRec): void {
    try { rec.inst.destroy(); } catch (err) { console.error(`[world] destroy ${rec.key} failed:`, err); }
    this.recs.delete(rec.key);
    this.channels.get(rec.zoneId)?.delete(rec.channel);
    this.tickErrAt.delete(rec.key);
  }

  // ─────────────────────────── Moving players ───────────────────────────

  private detach(s: Session, rec: InstRec): void {
    try { rec.inst.removePlayer(s); } catch (err) { console.error(`[world] removePlayer failed in ${rec.key}:`, err); }
    rec.members.delete(s);
    if (rec.members.size === 0) rec.emptySince = Date.now();
  }

  /**
   * Remove the player from its current instance (if any) and add it to `to`. Messages the simulation sends
   * while adding the player are held back until `announce` (the welcome / zone message) has been delivered,
   * so the client always sees the zone message first.
   */
  private enter(s: Session, to: InstRec, at: { x: number; y: number } | undefined, announce: (you: number, rec: InstRec) => S2C): void {
    const from = s.rec;
    if (from) this.detach(s, from);
    const held: S2C[] = [];
    s.hold = held;
    let you: number;
    try {
      you = to.inst.addPlayer(s, at);
    } catch (err) {
      s.hold = null;
      console.error(`[world] addPlayer failed in ${to.key}:`, err);
      s.rec = null;
      this.recover(s, from);
      throw new Error('Could not enter that zone');
    }
    to.members.add(s);
    to.emptySince = Date.now();
    s.rec = to;
    s.entityId = you;
    if(to.zoneId==='rillwake_crossing')recordIntro(s.save,'field');
    if(to.kind==='town'&&s.save.onboarding?.done.includes('elite'))recordIntro(s.save,'return');
    s.save.lastZone = to.kind === 'rift' ? TOWN_ID : to.zoneId;
    s.hold = null;
    s.send(announce(you, to));
    for (const m of held) s.send(m);
    if (to.kind === 'town') s.homeTown = to.key;
  }

  /** Put a player whose transfer failed back where it came from (or disconnect it if that fails too). */
  private recover(s: Session, from: InstRec | null): void {
    const target = from && this.recs.has(from.key) ? from : this.pickChannel(TOWN_ID);
    try {
      const held: S2C[] = [];
      s.hold = held;
      const you = target.inst.addPlayer(s);
      target.members.add(s);
      s.rec = target;
      s.entityId = you;
      s.hold = null;
      s.send({ t: 'zone', you, zone: target.inst.zone });
      for (const m of held) s.send(m);
    } catch (err) {
      s.hold = null;
      console.error('[world] recovery failed:', err);
      s.kick('Server error');
    }
  }

  private zoneAnnounce = (you: number, rec: InstRec): S2C => ({ t: 'zone', you, zone: rec.inst.zone });

  /** First placement after login: always into a town channel. Sends `welcome` (built by the caller). */
  login(s: Session, welcome: (you: number, zone: InstRec['inst']['zone']) => S2C): void {
    const rec = this.pickChannel(TOWN_ID);
    this.players.add(s);
    try {
      this.enter(s, rec, undefined, (you, r) => welcome(you, r.inst.zone));
      this.parties.connected(s);
      this.social.tick();
    } catch (err) {
      this.players.delete(s);
      throw err;
    }
  }

  /** The player disconnects: leave the instance and forget it. The caller persists the save. */
  logout(s: Session): void {
    this.players.delete(s);
    this.parties.disconnected(s);
    this.social.disconnected(s);
    this.community.disconnected(s);
    const rec = s.rec;
    if (rec) {
      s.save.lastZone = rec.kind === 'rift' ? TOWN_ID : rec.zoneId;
      this.detach(s, rec);
      s.rec = null;
    }
  }

  // ─────────────────────────── Commands: travel ───────────────────────────

  /** Explicit channel `n` of a zone: an existing one, or the next free number (opens a new channel). */
  private resolveChannel(zoneId: string, n: number): InstRec | string {
    if (!Number.isInteger(n) || n < 1) return 'Invalid channel';
    const m = this.zoneChannels(zoneId);
    let target = m.get(n);
    if (!target) {
      // Players may open exactly the next channel; arbitrary numbers are refused.
      if (n !== this.nextChannelNumber(zoneId)) return 'That channel does not exist';
      if (m.size >= MAX_CHANNELS_PER_ZONE) return 'Too many channels are open';
      target = this.channelRec(zoneId, n);
    }
    if (target.members.size >= capOf(target.kind)) return 'That channel is full';
    return target;
  }

  /** Back to a town channel: `channel` if given, else the one the player came from if it has room. */
  private goHome(s: Session, channel?: number): CmdResult {
    const cur = s.rec!;
    let target: InstRec;
    if (channel !== undefined) {
      const r = this.resolveChannel(TOWN_ID, channel);
      if (typeof r === 'string') return fail(r);
      target = r;
    } else {
      const home = s.homeTown ? this.recs.get(s.homeTown) : undefined;
      target = home && home.kind === 'town' && home.members.size < TOWN_CHANNEL_CAP ? home : this.pickChannel(TOWN_ID);
    }
    // Returning from a rift: arrive next to where the rift portal was.
    const at = cur.rift && cur.rift.townKey === target.key ? cur.rift.portalAt : undefined;
    this.enter(s, target, at, this.zoneAnnounce);
    s.saveNow();
    return ok({ zone: target.zoneId, channel: target.channel });
  }

  /** Waypoint travel. `channel` is optional; without it fields pick the least-full channel. */
  travel(s: Session, zoneId: string, channel?: number): CmdResult {
    const cur = s.rec;
    if (!cur) return fail('Not in a zone');
    const def = ZONES[zoneId];
    if (!def || def.kind === 'rift') return fail('Unknown destination');
    if (!zoneUnlocked(s.save,zoneId)) return fail('Complete the preceding story quest to open this route');
    if (!zoneLevelAllowed(s.save,zoneId)) return fail(`${def.name} requires level ${def.levelBand[0]}`);
    if (def.kind === 'town') {
      if (cur.kind === 'town') return fail(`You are already in ${def.name}`);
      return this.goHome(s, channel);
    }
    if (cur.kind !== 'town' && !cur.inst.map.adventure) return fail('Return to Hearthmere to use the waypoint');
    const waypoint = cur.inst.map.town?.npcs.find(n => n.role === 'waypoint');
    const nearWaypoint = waypoint && cur.inst.canInteract(s, waypoint.x, waypoint.y, waypoint.interactionRadius);
    const nearExit = cur.inst.map.portals.some(p => p.to === zoneId && cur.inst.canInteract(s, p.x, p.y, 110));
    if(def.kind==='dungeon') {
      if(channel!==undefined)return fail('Private dungeons have no public channels');
      if(!nearExit)return fail('Enter through the physical dungeon entrance');
      const group=this.parties.view(s).id;
      const key=`dungeon#${group??s.save.id}#${zoneId}`;
      let target=this.recs.get(key);
      if(target?.members.size===0&&target.inst.dungeonState?.()?.phase==='done'){
        target.inst.destroy();this.recs.delete(key);this.tickErrAt.delete(key);target=undefined;
      }
      if(!target){
        if([...this.recs.values()].filter(r=>r.kind==='dungeon').length>=MAX_RIFTS)return fail('All dungeon instances are busy; try again shortly');
        const level=Math.max(def.levelBand[0],Math.min(def.levelBand[1],s.save.level));
        // D057: authored story shares the fields' Normal setting, independent of the last rift.
        const inst=this.create({zoneId,key,channel:0,seed:zoneSeed(zoneId,0),theme:def.theme,level,difficulty:0});
        target={key,zoneId,kind:'dungeon',channel:0,inst,members:new Set(),emptySince:Date.now(),hostedRifts:new Set()};
        this.recs.set(key,target);
      }
      if(target.members.size>=(group?PARTY_MAX:1))return fail('That dungeon is full');
      this.enter(s,target,undefined,this.zoneAnnounce);s.saveNow();
      return ok({zone:zoneId,channel:0});
    }
    if (!nearWaypoint && !nearExit) return fail('Stand beside the Waypoint or the exit to that destination');
    let target: InstRec;
    if (channel !== undefined) {
      const r = this.resolveChannel(zoneId, channel);
      if (typeof r === 'string') return fail(r);
      target = r;
    } else {
      target = this.pickChannel(zoneId);
    }
    if(cur.kind==='town')s.homeTown = cur.key;
    let arrival:{x:number;y:number}|undefined;
    if(cur.inst.map.adventure) {
      const back=target.inst.map.portals.find(p=>p.to===cur.zoneId),cw=new CollisionWorld(target.inst.map);
      if(back)for(let i=0;i<16;i++){
        const x=back.x+70*Math.cos(i*Math.PI/8),y=back.y+70*Math.sin(i*Math.PI/8);
        if(cw.isFree(x,y,PLAYER_RADIUS)){arrival={x,y};break;}
      }
    }
    this.enter(s, target, arrival, this.zoneAnnounce);
    s.saveNow();
    return ok({ zone: zoneId, channel: target.channel });
  }

  leave(s: Session): CmdResult {
    const cur = s.rec;
    if (!cur) return fail('Not in a zone');
    if (cur.kind === 'town') return fail('You are already in town');
    return this.goHome(s);
  }

  channel(s: Session, n: number): CmdResult {
    const cur = s.rec;
    if (!cur) return fail('Not in a zone');
    if (cur.kind === 'rift' || cur.kind === 'dungeon') return fail('Private instances have no channels');
    if (!Number.isInteger(n) || n < 1) return fail('Invalid channel');
    if (n === cur.channel) return fail(`You are already in channel ${n}`);
    const target = this.resolveChannel(cur.zoneId, n);
    if (typeof target === 'string') return fail(target);
    this.enter(s, target, undefined, this.zoneAnnounce);
    s.saveNow();
    return ok({ zone: target.zoneId, channel: target.channel });
  }

  // ─────────────────────────── Commands: rifts ───────────────────────────

  private openRiftsOf(town: InstRec): RiftMeta[] {
    return [...town.hostedRifts].filter((r) => !r.closed && !r.completed);
  }

  private hasOpenRift(rec: InstRec | null): boolean {
    return !!rec && rec.kind === 'town' && this.openRiftsOf(rec).length > 0;
  }

  /** A walkable spot around the obelisk that is not already taken by another rift portal. */
  private portalSpot(map: MapData, taken: { x: number; y: number }[]): { x: number; y: number } {
    const ob = map.npcs.find((n) => n.role === 'obelisk');
    const cx = ob?.x ?? map.entry.x, cy = ob?.y ?? map.entry.y;
    const col = new CollisionWorld(map);
    for (let ring = 0; ring < 5; ring++) {
      const r = (ob?.r ?? 36) + 80 + ring * 55;
      for (let i = 0; i < 16; i++) {
        const a = 0.9 + (i / 16) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
        if (!col.isFree(x, y, 34)) continue;
        if (taken.some((p) => Math.hypot(p.x - x, p.y - y) < 100)) continue;
        return { x, y };
      }
    }
    return { x: Math.round(cx), y: Math.round(cy + (ob?.r ?? 36) + 90) };
  }

  private closeRiftPortal(meta: RiftMeta): void {
    meta.closed = true;
    if (meta.portalRemoved) return;
    meta.portalRemoved = true;
    const town = this.recs.get(meta.townKey);
    if (town) {
      try { town.inst.removeEntity(meta.portalId); } catch (err) { console.error('[world] removeEntity failed:', err); }
    }
  }

  private destroyRift(meta: RiftMeta): void {
    this.closeRiftPortal(meta);
    const rec = meta.rec;
    try { rec.inst.destroy(); } catch (err) { console.error(`[world] destroy ${rec.key} failed:`, err); }
    this.recs.delete(rec.key);
    this.rifts.delete(meta.key);
    this.tickErrAt.delete(rec.key);
    if (this.riftByOwner.get(meta.ownerId) === meta) this.riftByOwner.delete(meta.ownerId);
    this.recs.get(meta.townKey)?.hostedRifts.delete(meta);
    this.broadcastInfo();
  }

  riftOpen(s: Session, difficulty: number): CmdResult {
    const town = s.rec;
    if (!town || town.kind !== 'town') return fail('Rifts are opened at the Obelisk in Hearthmere');
    const nearError = requireNear(s, 'obelisk');
    if (nearError) return fail(nearError);
    const diff = DIFFICULTIES[difficulty];
    if (!Number.isInteger(difficulty) || !diff) return fail('Unknown difficulty');
    if (s.save.level < diff.minLevel) return fail(`${diff.name} requires level ${diff.minLevel}`);

    const ownerId = s.save.id;
    const old = this.riftByOwner.get(ownerId);
    if (old) {
      this.riftByOwner.delete(ownerId);
      this.closeRiftPortal(old);
      if (old.rec.members.size === 0) this.destroyRift(old);
    }
    if (this.rifts.size >= MAX_RIFTS) return fail('The Rifts are overcrowded. Try again in a moment');

    let key: string;
    do { key = `rift#${this.rng.int(0x1000, 0xfffff).toString(16)}`; } while (this.recs.has(key));
    const theme = this.rng.pick(RIFT_THEMES);
    const level = s.save.level;
    const meta: RiftMeta = {
      key, rec: null as unknown as InstRec, ownerId, ownerName: s.save.name, townKey: town.key,
      portalId: 0, portalAt: { x: 0, y: 0 }, portalRemoved: false, level, difficulty, theme,
      createdAt: Date.now(), completed: false, closed: false,
    };
    let inst: InstanceApi;
    try {
      inst = this.create({
        zoneId: 'rift', channel: 0, key, seed: this.rng.seed(), theme, level, difficulty, owner: s.save.name,
        onRiftComplete: () => this.onRiftComplete(meta),
      });
    } catch (err) {
      console.error('[world] could not create rift:', err);
      return fail('The rift collapsed before it opened');
    }
    const rec: InstRec = { key, zoneId: 'rift', kind: 'rift', channel: 0, inst, members: new Set(), emptySince: Date.now(), hostedRifts: new Set(), rift: meta };
    meta.rec = rec;

    meta.portalAt = this.portalSpot(town.inst.map, this.openRiftsOf(town).map((r) => r.portalAt));
    try {
      meta.portalId = town.inst.spawnPortal({ kind: 'rift', x: meta.portalAt.x, y: meta.portalAt.y, label: `${s.save.name}'s Rift`, ttlMs: 0 });
    } catch (err) {
      console.error('[world] could not spawn rift portal:', err);
      try { inst.destroy(); } catch { /* ignore */ }
      return fail('The rift collapsed before it opened');
    }

    this.recs.set(key, rec);
    this.rifts.set(key, meta);
    this.riftByOwner.set(ownerId, meta);
    town.hostedRifts.add(meta);
    s.save.difficulty = difficulty;
    s.markDirty();
    try { town.inst.notice(`${s.save.name} opened a ${diff.name} Rift`, 'rift'); } catch { /* ignore */ }
    this.broadcastInfo();
    return ok({ key, difficulty, level, theme });
  }

  riftEnter(s: Session): CmdResult {
    const town = s.rec;
    if (!town || town.kind !== 'town') return fail('Enter the rift from Hearthmere');
    const open = this.openRiftsOf(town);
    if (!open.length) return fail('There is no open rift in this channel');
    // Own rift first, otherwise the most recently opened one with room.
    open.sort((a, b) => (b.ownerId === s.save.id ? 1 : 0) - (a.ownerId === s.save.id ? 1 : 0) || b.createdAt - a.createdAt);
    const obelisk = town.inst.map.town?.npcs.find(n => n.role === 'obelisk');
    const nearObelisk = obelisk && town.inst.canInteract(s, obelisk.x, obelisk.y, obelisk.interactionRadius);
    const accessible = open.filter(r => nearObelisk || town.inst.canInteract(s, r.portalAt.x, r.portalAt.y, 110));
    if (!accessible.length) return fail('Stand beside the Rift Obelisk or an open rift portal');
    const meta = accessible.find((r) => r.rec.members.size < PARTY_MAX);
    if (!meta) return fail('The rift is full');
    s.homeTown = town.key;
    this.enter(s, meta.rec, undefined, this.zoneAnnounce);
    s.saveNow();
    return ok({ key: meta.key, owner: meta.ownerName, difficulty: meta.difficulty });
  }

  private onRiftComplete(meta: RiftMeta): void {
    if (meta.completed) return;
    meta.completed = true;
    this.closeRiftPortal(meta);
    this.broadcastInfo();
  }

  // ─────────────────────────── Chat & info ───────────────────────────

  /** Server determines each channel's audience and enforces personal privacy. */
  chat(s: Session, text: string, ch:unknown='zone',to?:unknown): void {
    const result=this.social.chat(s,text,ch,to);
    if(!result.ok)this.systemMessage(s,result.err??'Message could not be sent');
  }

  /** A system line for one player. */
  systemMessage(s: Session, text: string): void {
    s.send({ t: 'chat', ch: 'system', text });
  }

  private channelList(): WorldInfo['channels'] {
    const out: WorldInfo['channels'] = [];
    for (const [zone, m] of this.channels) {
      for (const rec of [...m.values()].sort((a, b) => a.channel - b.channel)) out.push({ zone, channel: rec.channel, players: rec.members.size });
    }
    return out;
  }

  infoFor(s: Session): WorldInfo {
    return { online: this.players.size, channels: this.channelList(), riftOpen: this.hasOpenRift(s.rec) };
  }

  broadcastInfo(): void {
    const channels = this.channelList();
    const online = this.players.size;
    const yes = encode({ t: 'world', world: { online, channels, riftOpen: true } });
    const no = encode({ t: 'world', world: { online, channels, riftOpen: false } });
    for (const s of this.players) s.sendRaw(this.hasOpenRift(s.rec) ? yes : no);
  }

  // ─────────────────────────── Diagnostics ───────────────────────────

  stats() {
    return {
      online: this.players.size,
      instances: [...this.recs.values()].map((r) => ({ key: r.key, kind: r.kind, players: r.members.size, tick: r.inst.tickStats() })),
    };
  }
}
