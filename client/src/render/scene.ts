// Scene graph, camera and entity-view lifecycle. Layers (bottom → top):
// ground tiles → decals → groundFx → entities (y-sorted, incl. tall props) → aboveFx → text.

import { Application, Container } from 'pixi.js';
import { MONSTERS } from '@shared/data/monsters';
import type { EliteTier } from '@shared/items';
import type { MapData, NpcRole } from '@shared/mapgen';
import { F_LEFT, F_MOVING, type EntDesc } from '@shared/protocol';
import {
  buildMapLayers, createMonsterView, createNpcView, createPlayerView, createPortalView, createSummonView, setViewScale,
} from './art';
import type { EntityView, PlayerView, ViewState } from './types';
import { Vfx } from './vfx';
import type { ClientEntity, ClientWorld } from '../game/world';
import { townCollisionOverlay } from './art/townBlockout';

/** World units visible vertically; heroes (~64 u) end up ~110 px tall at 1080p, close to Diablo 3's on-screen size. */
const VIEW_HEIGHT = 620;

interface StaticView { view: EntityView; x: number; y: number; role?: NpcRole; name: string; r: number; portalTo?: string }

export interface LocalPlayerState { x: number; y: number; vx: number; vy: number; facingLeft: boolean; moving: boolean; dashing: boolean }

export class Scene {
  readonly root = new Container();
  readonly ground = new Container();
  readonly decals = new Container();
  readonly groundFx = new Container();
  readonly entities = new Container();
  readonly aboveFx = new Container();
  readonly text = new Container();
  readonly vfx: Vfx;

  cam = { x: 0, y: 0, zoom: 1 };
  private shakeMag = 0;
  private shakeEnd = 0;
  private shakeDur = 1;
  private hitStopEnd = 0;
  private time = 0;
  private props: { view: Container; x: number; y: number }[] = [];
  statics: StaticView[] = [];
  private active = new Set<ClientEntity>();
  private looks = new Map<number, string>();
  map: MapData | null = null;
  myAps = 1.2;
  hoverId = 0;
  private collisionOverlay: Container | null = null;
  private showCollision = false;

  toggleCollision() {
    this.showCollision = !this.showCollision;
    if (this.collisionOverlay) this.collisionOverlay.visible = this.showCollision;
  }

  constructor(private app: Application, private world: ClientWorld) {
    this.entities.sortableChildren = true;
    this.root.addChild(this.ground, this.decals, this.groundFx, this.entities, this.aboveFx, this.text);
    app.stage.addChild(this.root);
    this.vfx = new Vfx({ groundFx: this.groundFx, aboveFx: this.aboveFx, text: this.text }, {
      myId: () => this.world.myId,
      entityPos: (id) => {
        const e = this.world.entities.get(id);
        if (e) return { x: e.x, y: e.y };
        const d = [...this.active].find((a) => a.id === id);
        return d ? { x: d.x, y: d.y } : null;
      },
      entityView: (id) => this.world.entities.get(id)?.view ?? null,
      entityRadius: (id) => this.world.entities.get(id)?.desc.r ?? 16,
      shake: (m, ms) => this.shake(m, ms),
      hitStop: (ms) => { this.hitStopEnd = Math.max(this.hitStopEnd, performance.now() + Math.min(ms, 90)); },
      zoom: () => this.cam.zoom,
    });
  }

  // ─────────────────────────── Map ───────────────────────────

  setMap(map: MapData) {
    for (const c of [this.ground, this.decals]) for (const ch of c.removeChildren()) ch.destroy({ children: true });
    for (const p of this.props) p.view.destroy({ children: true });
    for (const s of this.statics) s.view.destroy();
    this.props = [];
    this.statics = [];
    this.vfx.clear();
    this.map = map;
    this.collisionOverlay?.destroy({ children: true });
    this.collisionOverlay = map.town ? townCollisionOverlay(map.town) : null;
    if (this.collisionOverlay) { this.collisionOverlay.visible = this.showCollision; this.aboveFx.addChild(this.collisionOverlay); }
    const layers = buildMapLayers(map);
    this.ground.addChild(layers.ground);
    this.decals.addChild(layers.decals);
    for (const p of layers.sorted) {
      p.view.zIndex = p.y;
      this.entities.addChild(p.view);
      this.props.push({ view: p.view, x: p.view.x, y: p.y });
    }
    for (const n of map.npcs) {
      if (n.role === 'dummy') continue; // dummies are server-side monsters so they can be hit
      const view = createNpcView(n.role, n.name);
      view.root.position.set(n.x, n.y);
      view.root.zIndex = n.y;
      this.entities.addChild(view.root);
      this.statics.push({ view, x: n.x, y: n.y, role: n.role, name: n.name, r: n.r });
    }
    for (const p of map.portals) {
      const view = createPortalView(p.label, 'town');
      view.root.position.set(p.x, p.y);
      view.root.zIndex = p.y;
      this.entities.addChild(view.root);
      this.statics.push({ view, x: p.x, y: p.y, name: p.label, r: 40, portalTo: p.to });
    }
    this.cam.x = map.entry.x;
    this.cam.y = map.entry.y;
  }

  // ─────────────────────────── Entities ───────────────────────────

  private createView(d: EntDesc): EntityView {
    switch (d.k) {
      case 'player': return createPlayerView(d.look ?? { classId: 'warrior', slots: {} });
      case 'mob': {
        const def = MONSTERS[d.t];
        if (!def) return createNpcView('dummy', d.n ?? 'Training Dummy');
        return createMonsterView(d.t, (d.el ?? 0) as EliteTier, d.af ?? [], d.sc ?? def.scale);
      }
      case 'summon': return createSummonView(d.t);
      case 'loot': return this.vfx.createLootView(d);
      case 'npc': return createNpcView(d.t as NpcRole, d.n ?? '');
      case 'portal': return createPortalView(d.n ?? 'Portal', d.t === 'rift' ? 'rift' : 'town');
    }
  }

  onAdd(e: ClientEntity) {
    if (e.view) {
      // Re-described (e.g. equipment changed): update looks in place.
      if (e.kind === 'player' && e.desc.look) {
        const key = JSON.stringify(e.desc.look);
        if (this.looks.get(e.id) !== key) { (e.view as PlayerView).setLook(e.desc.look); this.looks.set(e.id, key); }
      }
      return;
    }
    e.view = this.createView(e.desc);
    if (e.kind === 'player' && e.desc.look) this.looks.set(e.id, JSON.stringify(e.desc.look));
    this.entities.addChild(e.view.root);
    if (e.kind === 'player' || e.kind === 'mob') {
      e.nameplate = this.vfx.createNameplate(e.desc, e.id === this.world.myId);
      if (e.nameplate) this.text.addChild(e.nameplate.root);
    }
    this.active.add(e);
  }

  onRemove(e: ClientEntity) {
    if (e.dying && !(e as ClientEntity & { deathDone?: boolean }).deathDone) return; // destroyed when the death animation ends
    this.destroyView(e);
  }

  private destroyView(e: ClientEntity) {
    e.nameplate?.destroy();
    e.nameplate = null;
    if (e.view) { e.view.root.parent?.removeChild(e.view.root); e.view.destroy(); }
    e.view = null;
    this.active.delete(e);
    this.looks.delete(e.id);
  }

  startDeath(e: ClientEntity, element: number) {
    if (e.dying || !e.view) return;
    e.dying = true;
    e.deathEl = element;
    e.nameplate?.destroy();
    e.nameplate = null;
    e.view.die(element, () => {
      (e as ClientEntity & { deathDone?: boolean }).deathDone = true;
      if (e.removed || !this.world.entities.has(e.id)) this.destroyView(e);
    });
  }

  clearEntities() {
    for (const e of [...this.active]) this.destroyView(e);
    this.active.clear();
  }

  // ─────────────────────────── Camera & feedback ───────────────────────────

  shake(magnitude: number, ms: number) {
    const now = performance.now();
    if (magnitude >= this.shakeMag * Math.max(0, (this.shakeEnd - now) / this.shakeDur)) {
      this.shakeMag = magnitude;
      this.shakeDur = ms;
      this.shakeEnd = now + ms;
    }
  }

  screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.root.x) / this.cam.zoom, y: (sy - this.root.y) / this.cam.zoom };
  }

  // ─────────────────────────── Frame ───────────────────────────

  update(dtMs: number, me: LocalPlayerState | null, mouse: { x: number; y: number }) {
    const now = performance.now();
    this.time += dtMs / 1000;
    const viewDt = now < this.hitStopEnd ? 0 : dtMs / 1000;
    const scr = this.app.screen;
    const zoom = scr.height / VIEW_HEIGHT;
    if (zoom !== this.cam.zoom) { this.cam.zoom = zoom; setViewScale(zoom * this.app.renderer.resolution); }

    // Camera follows the predicted player with a small movement lead.
    if (me) {
      const lead = 0.14;
      const tx = me.x + Math.max(-70, Math.min(70, me.vx * lead));
      const ty = me.y + Math.max(-50, Math.min(50, me.vy * lead));
      const k = 1 - Math.exp(-dtMs / 90);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
    const halfW = scr.width / 2 / this.cam.zoom, halfH = scr.height / 2 / this.cam.zoom;
    if (this.map) {
      const mw = this.map.w * 64, mh = this.map.h * 64;
      this.cam.x = mw > halfW * 2 ? Math.max(halfW, Math.min(mw - halfW, this.cam.x)) : mw / 2;
      this.cam.y = mh > halfH * 2 ? Math.max(halfH, Math.min(mh - halfH, this.cam.y)) : mh / 2;
    }
    let sx = 0, sy = 0;
    if (now < this.shakeEnd) {
      const f = (this.shakeEnd - now) / this.shakeDur;
      const m = this.shakeMag * f * f;
      sx = (Math.random() * 2 - 1) * m;
      sy = (Math.random() * 2 - 1) * m;
    }
    this.root.scale.set(this.cam.zoom);
    this.root.x = Math.round(scr.width / 2 - (this.cam.x + sx) * this.cam.zoom);
    this.root.y = Math.round(scr.height / 2 - (this.cam.y + sy) * this.cam.zoom);

    const x0 = this.cam.x - halfW - 220, x1 = this.cam.x + halfW + 220;
    const y0 = this.cam.y - halfH - 160, y1 = this.cam.y + halfH + 320;
    for (const p of this.props) p.view.visible = p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1;
    for (const s of this.statics) {
      const vis = s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1;
      s.view.root.visible = vis;
      if (vis) s.view.update(viewDt, { x: s.x, y: s.y, vx: 0, vy: 0, moving: false, facingLeft: false, flags: 0, attackSeq: 0, hpFrac: 1, time: this.time, aps: 1 });
    }

    const mw = this.screenToWorld(mouse.x, mouse.y);
    let hover = 0, hoverD = 1e9;
    for (const e of this.active) {
      const v = e.view;
      if (!v) continue;
      // Death animation finished but the server hasn't removed the entity yet: keep it hidden, never update it.
      if ((e as ClientEntity & { deathDone?: boolean }).deathDone) { v.root.visible = false; continue; }
      const isMe = e.id === this.world.myId;
      let x = e.x, y = e.y, flags = e.flags, vx = e.vx, vy = e.vy;
      let moving = (flags & F_MOVING) !== 0;
      let facingLeft = (flags & F_LEFT) !== 0;
      if (isMe && me) {
        x = me.x; y = me.y; vx = me.vx; vy = me.vy;
        moving = me.moving;
        if (!(flags & 4)) facingLeft = me.facingLeft; // keep server facing while attacking (F_ATTACK)
        flags = me.dashing ? flags | 256 : flags;
        e.x = x; e.y = y;
      }
      const vis = x > x0 && x < x1 && y > y0 && y < y1;
      v.root.visible = vis;
      if (e.nameplate) e.nameplate.root.visible = vis && !e.dying;
      if (!vis && !e.dying) continue;
      v.root.position.set(x, y);
      v.root.zIndex = y;
      const st: ViewState = { x, y, vx, vy, moving, facingLeft, flags, attackSeq: e.aseq, hpFrac: e.hp, time: this.time, aps: isMe ? this.myAps : 1.25 };
      v.update(viewDt, st);
      if (e.kind === 'mob' && !e.dying) {
        const d = Math.hypot(mw.x - x, mw.y - (y - v.height * 0.5));
        if (d < Math.max(34, e.desc.r + 14) && d < hoverD) { hoverD = d; hover = e.id; }
      }
      if (e.nameplate) {
        e.nameplate.root.position.set(x, y - v.height - 8);
        e.nameplate.update(e.hp, flags, hover === e.id);
      }
    }
    this.hoverId = hover;
    this.vfx.update(dtMs);
  }

  /** Nearest static NPC / map portal within interaction range of (x, y). */
  nearestInteractable(x: number, y: number): StaticView | null {
    let best: StaticView | null = null, bd = 1e9;
    for (const s of this.statics) {
      const d = Math.hypot(s.x - x, s.y - y) - s.r;
      if (d < 70 && d < bd) { bd = d; best = s; }
    }
    return best;
  }
}
