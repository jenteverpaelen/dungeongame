// Client game controller: connection, message handling, prediction, interpolation and the frame loop.

import type { Application } from 'pixi.js';
import { DASH } from '@shared/constants';
import { ZONES } from '@shared/data/zones';
import { F_CHANNEL, F_FROZEN, F_STUN, PROTOCOL_VERSION, type GameEvent, type S2C, type Snapshot, type ZoneInfo } from '@shared/protocol';
import type { ClassId, DerivedStats } from '@shared/types';
import { sfx } from '../audio/sfx';
import { installApi } from '../net/api';
import { Connection } from '../net/connection';
import { Scene } from '../render/scene';
import type { ActingView, PlayerView } from '../render/types';
import { closeAllPanels, pushChat, pushNotice, togglePanel, ui, worldReader, type PanelId } from '../ui/store';
import { Input } from './input';
import { Predictor } from './prediction';
import { ClientWorld } from './world';

export class Game {
  readonly world: ClientWorld;
  readonly scene: Scene;
  readonly predictor = new Predictor();
  readonly input: Input;
  private conn: Connection | null = null;
  private snapCount = 0;
  private dmgLog: { t: number; a: number }[] = [];
  private lastUi = 0;
  private fpsFrames = 0;
  private fpsT = 0;
  private lastRiftKey = '';
  private whirl = false;

  constructor(private app: Application) {
    this.world = new ClientWorld({ onAdd: (e) => this.scene.onAdd(e), onRemove: (e) => this.scene.onRemove(e) });
    this.scene = new Scene(app, this.world);
    this.input = new Input({
      onDash: () => { sfx.unlock(); this.predictor.queueDash(); },
      onHotkey: (k, e) => this.hotkey(k, e),
    });
    worldReader.current = {
      map: () => this.world.map,
      entities: () => this.minimapEntities(),
      myPos: () => (this.predictor.ready ? { x: this.predictor.x, y: this.predictor.y } : null),
    };
    app.ticker.add((t) => this.frame(t.deltaMS));
  }

  async start(name: string, classId: ClassId) {
    sfx.unlock();
    ui.set({ screen: 'connecting', error: null });
    const conn = new Connection((m) => this.onMessage(m), (reason) => {
      ui.set({ connected: false, error: reason, screen: 'select' });
      this.scene.clearEntities();
    });
    try {
      await conn.connect();
    } catch (err) {
      ui.set({ screen: 'select', error: (err as Error).message });
      return;
    }
    this.conn = conn;
    installApi((op, a) => conn.cmd(op, a), (text) => conn.send({ t: 'chat', text }));
    ui.set({ connected: true });
    conn.send({ t: 'hello', name, classId, v: PROTOCOL_VERSION });
  }

  // ─────────────────────────── Messages ───────────────────────────

  private onMessage(m: S2C) {
    switch (m.t) {
      case 'welcome':
        this.enterZone(m.zone, m.you);
        this.applyDerived(m.derived);
        ui.set({ screen: 'game', char: m.char, derived: m.derived, world: m.world });
        break;
      case 'zone':
        this.enterZone(m.zone, m.you);
        break;
      case 's':
        this.onSnapshot(m);
        break;
      case 'char':
        this.applyDerived(m.derived);
        ui.set({ char: m.char, derived: m.derived });
        break;
      case 'chat':
        pushChat({ ch: m.ch, from: m.from, cls: m.cls, text: m.text });
        break;
      case 'afk':
        ui.set({ afk: m });
        break;
      case 'world':
        ui.set({ world: m.world });
        break;
      case 'pong':
        ui.set({ ping: Math.round(this.conn?.rtt ?? 0) });
        break;
      case 'err':
        ui.set({ error: m.msg });
        pushNotice(m.msg, 'warn');
        break;
    }
  }

  private enterZone(zone: ZoneInfo, you: number) {
    this.scene.clearEntities();
    this.world.setZone(zone, you);
    this.scene.setMap(this.world.map!);
    this.predictor.reset();
    this.dmgLog = [];
    ui.set({ zone, myId: you, rift: null, target: null, interact: null, panels: {} });
    const def = ZONES[zone.zone];
    if (def) pushNotice(zone.kind === 'rift' ? 'Nephalem Rift' : def.name, 'info');
  }

  private applyDerived(d: DerivedStats) {
    this.predictor.msPct = d.ms;
    this.predictor.dashCd = d.powers.stridewind ? DASH.cooldownMs / 2 : DASH.cooldownMs;
    this.scene.myAps = d.aps;
  }

  private onSnapshot(s: Snapshot) {
    this.world.applySnapshot(s);
    const me = this.world.me;
    this.predictor.frozen = s.me.dead > 0 || (!!me && (me.flags & (F_FROZEN | F_STUN)) !== 0);
    this.predictor.reconcile(s.me, s.ack, this.world.collision);
    if (s.ev) for (const ev of s.ev) this.onEvent(ev);
    this.world.applyRemovals(s.rem);
    this.snapCount++;
    if (this.snapCount % 2 === 0) ui.set({ me: s.me });
    if (s.rift) {
      const key = `${Math.floor(s.rift.progress)}|${s.rift.phase}|${s.rift.guardian ?? 0}`;
      if (key !== this.lastRiftKey) { this.lastRiftKey = key; ui.set({ rift: s.rift }); }
    } else if (this.lastRiftKey) { this.lastRiftKey = ''; ui.set({ rift: null }); }
  }

  private onEvent(ev: GameEvent) {
    const myId = this.world.myId;
    switch (ev.e) {
      case 'die': {
        const e = this.world.entities.get(ev.t);
        if (e) this.scene.startDeath(e, ev.el);
        break;
      }
      case 'dmg': {
        if (!ev.p && (ev.s === myId || this.isMine(ev.s))) this.dmgLog.push({ t: performance.now(), a: ev.a });
        break;
      }
      case 'level':
        if (ev.t === myId) pushNotice(`Level ${ev.lv}`, 'level');
        break;
      case 'paragon':
        if (ev.t === myId) pushNotice(`Paragon ${ev.lv}`, 'level');
        break;
      case 'notice':
        pushNotice(ev.text, ev.kind);
        break;
      case 'pickup':
        if (ev.t === myId) ui.set((st) => ({ pickups: [...st.pickups.slice(-7), { id: Math.random(), lk: ev.lk, name: ev.name, rarity: ev.rarity, amount: ev.amount, at: performance.now() }] }));
        break;
      case 'shake':
        this.scene.shake(ev.m, ev.d);
        break;
      case 'cast': {
        const v = this.world.entities.get(ev.s)?.view as (ActingView & Partial<PlayerView>) | null | undefined;
        const aps = ev.s === myId ? this.scene.myAps : 1.25;
        v?.playAction?.({ skill: ev.sk, rune: ev.r, tx: ev.tx, ty: ev.ty, cycleMs: 1000 / Math.max(0.3, aps) });
        break;
      }
      case 'proj': {
        // Summons (sentries, hydras) and monsters animate their own shots.
        const e = this.world.entities.get(ev.s);
        if (e && e.kind !== 'player') (e.view as ActingView | null)?.playAction?.({ skill: 'shot', tx: ev.x + ev.vx, ty: ev.y + ev.vy, cycleMs: 1000 });
        break;
      }
    }
    this.scene.vfx.handle(ev);
  }

  private isMine(id: number | undefined) {
    if (!id) return false;
    const e = this.world.entities.get(id);
    return !!e && e.desc.owner === this.world.myId;
  }

  // ─────────────────────────── Input ───────────────────────────

  private hotkey(k: string, e: KeyboardEvent) {
    const st = ui.get();
    const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
    if (k === 'Escape') {
      if (st.chatOpen) ui.set({ chatOpen: false });
      else closeAllPanels();
      (document.activeElement as HTMLElement | null)?.blur?.();
      return;
    }
    if (typing || st.screen !== 'game') return;
    if (k === 'Enter') { ui.set({ chatOpen: true }); this.input.clear(); return; }
    const panels: Record<string, PanelId> = { i: 'inventory', b: 'inventory', k: 'skills', p: 'paragon', u: 'cube', F1: 'help', F2: 'debug' };
    if (panels[k]) { togglePanel(panels[k]); return; }
    if (k === 'e') this.interact();
    void e;
  }

  private interact() {
    if (!this.predictor.ready) return;
    const { x, y } = this.predictor;
    const s = this.scene.nearestInteractable(x, y);
    const zone = this.world.zone;
    if (s?.role) {
      const map: Partial<Record<string, PanelId>> = { cube: 'cube', waypoint: 'waypoint', obelisk: 'obelisk', paragon: 'paragon', stash: 'inventory' };
      const p = map[s.role];
      if (p) togglePanel(p, true);
      return;
    }
    if (s?.portalTo) { void this.conn?.cmd(zone?.kind === 'rift' ? 'leave' : 'travel', { zone: s.portalTo }); return; }
    const portal = this.nearestPortalEntity(x, y);
    if (portal) void this.conn?.cmd(zone?.kind === 'town' ? 'riftEnter' : 'leave');
  }

  private nearestPortalEntity(x: number, y: number) {
    for (const e of this.world.entities.values()) if (e.kind === 'portal' && Math.hypot(e.x - x, e.y - y) < 110) return e;
    return null;
  }

  // ─────────────────────────── Frame ───────────────────────────

  private frame(dtMs: number) {
    const st = ui.get();
    if (st.screen === 'game' && this.world.map) {
      const mv = st.chatOpen ? { x: 0, y: 0 } : this.input.move();
      if (this.conn) this.predictor.update(dtMs, mv.x, mv.y, this.world.collision, (m) => this.conn!.send(m));
      this.world.interpolate();
      const me = this.predictor.ready
        ? { x: this.predictor.x, y: this.predictor.y, vx: this.predictor.vx, vy: this.predictor.vy, facingLeft: this.predictor.facingLeft, moving: Math.hypot(mv.x, mv.y) > 0, dashing: this.predictor.dashing }
        : null;
      this.scene.update(dtMs, me, { x: this.input.mouseX, y: this.input.mouseY });
      if (me) sfx.setListener(me.x, me.y);
      const myEnt = this.world.me;
      const whirl = !!myEnt && (myEnt.flags & F_CHANNEL) !== 0;
      if (whirl !== this.whirl) { this.whirl = whirl; sfx.loop('whirlwind', whirl); }
      this.uiTick(st);
    }
    this.fpsFrames++;
    this.fpsT += dtMs;
    if (this.fpsT >= 1000) { ui.set({ fps: Math.round((this.fpsFrames * 1000) / this.fpsT) }); this.fpsFrames = 0; this.fpsT = 0; }
  }

  /** 10 Hz UI updates: target frame, interact prompt, DPS meter. */
  private uiTick(st: ReturnType<typeof ui.get>) {
    const now = performance.now();
    if (now - this.lastUi < 100) return;
    this.lastUi = now;
    this.dmgLog = this.dmgLog.filter((d) => now - d.t < 5000);
    const dps = this.dmgLog.length ? this.dmgLog.reduce((s, d) => s + d.a, 0) / 5 : 0;

    let target = null as typeof st.target;
    let best: { id: number; score: number } | null = null;
    const px = this.predictor.x, py = this.predictor.y;
    for (const e of this.world.entities.values()) {
      if (e.kind !== 'mob' || e.dying) continue;
      const el = e.desc.el ?? 0;
      const d = Math.hypot(e.x - px, e.y - py);
      let score = -1;
      if (e.id === this.scene.hoverId) score = 1e6;
      else if (el === 4 && d < 1200) score = 1e5;
      else if ((el === 1 || el === 2 || el === 5) && d < 520) score = 1e4 - d;
      if (score > 0 && (!best || score > best.score)) best = { id: e.id, score };
    }
    if (best) {
      const e = this.world.entities.get(best.id)!;
      target = { id: e.id, name: e.desc.n ?? '', level: e.desc.lv ?? 1, elite: e.desc.el ?? 0, affixes: e.desc.af ?? [], hpFrac: e.hp };
    }

    let interact = null as typeof st.interact;
    if (this.predictor.ready) {
      const s = this.scene.nearestInteractable(px, py);
      if (s?.role) interact = { role: s.role, name: s.name };
      else if (s?.portalTo) interact = { role: 'waypoint', name: s.name };
      else if (this.nearestPortalEntity(px, py)) interact = { role: 'obelisk', name: this.world.zone?.kind === 'town' ? 'Enter the Rift' : 'Return to Hearthmere' };
    }
    const sameTarget = st.target && target && st.target.id === target.id && Math.abs(st.target.hpFrac - target.hpFrac) < 0.005;
    const patch: Partial<ReturnType<typeof ui.get>> = { dps };
    if (!sameTarget) patch.target = target;
    if (st.interact?.name !== interact?.name) patch.interact = interact;
    ui.set(patch);
  }

  private *minimapEntities() {
    const myId = this.world.myId;
    for (const e of this.world.entities.values()) {
      if (e.kind === 'loot' && !(e.desc.loot?.rarity === 'legendary' || e.desc.loot?.rarity === 'set')) continue;
      if (e.kind === 'summon') continue;
      const el = e.kind === 'loot' ? (e.desc.loot?.rarity === 'set' ? 4 : 3) : e.desc.el;
      yield { id: e.id, k: e.kind, x: e.id === myId ? this.predictor.x : e.x, y: e.id === myId ? this.predictor.y : e.y, el, me: e.id === myId };
    }
  }

  closePanels() { closeAllPanels(); }
}
