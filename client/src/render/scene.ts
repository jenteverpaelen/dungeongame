// Scene graph, camera and entity-view lifecycle. Layers (bottom → top):
// ground tiles → decals → groundFx → entities (y-sorted, incl. tall props) → aboveFx → text.

import { Application, Container, type Text } from 'pixi.js';
import type { CharacterSave } from '@shared/types';
import { questMarker } from '@shared/quests';
import { ui } from '../ui/store';
import { ordinarySelected } from '@shared/itemCollection';
import { nameLabel } from './art/npcs';
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
import { TownLife } from './art/townLife';
import { AdventureLife } from './art/adventureLife';
import { inPolygon } from '@shared/townGeometry';
import { preferences } from '../game/preferences';
import { QuestGuide } from './questGuide';
import { BarkBubbles, type Speaker } from './barks';
import { BARKS } from '@shared/data/barks';

/** Reference world height at 100% camera scale; owner default is now 75%. */
const VIEW_HEIGHT = 620;

interface StaticView { view: EntityView; x: number; y: number; role?: NpcRole; name: string; r: number; portalTo?: string; npcId?: string; questLabel?:Text }

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
  private props: { view: Container; x: number; y: number; building?: string; bounds?: { x0: number; y0: number; x1: number; y1: number } }[] = [];
  statics: StaticView[] = [];
  private active = new Set<ClientEntity>();
  private looks = new Map<number, string>();
  map: MapData | null = null;
  myAps = 1.2;
  hoverId = 0;
  private collisionOverlay: Container | null = null;
  private showCollision = false;
  private townLife: TownLife | null = null;
  private adventureLife: AdventureLife | null = null;
  private crowdPoses=new Map<number,{elapsed:number;slot:number}>();
  private roofAlpha=new Map<string,number>();
  private questStamp:CharacterSave|null=null;
  private questGuide=new QuestGuide();
  private barks=new BarkBubbles();
  /** Ambient speakers: statics with lines plus visual-only residents (filled by setMap / TownLife). */
  private speakers:Speaker[]=[];
  toggleCollision() {
    this.showCollision = !this.showCollision;
    if (this.collisionOverlay) this.collisionOverlay.visible = this.showCollision;
  }

  constructor(private app: Application, private world: ClientWorld) {
    window.addEventListener('wheel', this.onWheel, { passive: false, capture: true });
    this.entities.sortableChildren = true;
    this.root.addChild(this.ground, this.decals, this.groundFx, this.entities, this.aboveFx, this.text);
    this.text.addChild(this.barks.root);
    app.stage.addChild(this.root);
    this.groundFx.addChild(this.questGuide.root);
    this.vfx = new Vfx({ groundFx: this.groundFx, aboveFx: this.aboveFx, text: this.text }, {
      myId: () => this.world.myId,
      entityPos: (id) => {
        const e = this.world.entities.get(id);
        if (e) return { x: e.x, y: e.y };
        const d = [...this.active].find((a) => a.id === id);
        return d ? { x: d.x, y: d.y } : null;
      },
      entityView: (id) => this.world.entities.get(id)?.view ?? null,
      entityFlags: (id) => this.world.entities.get(id)?.flags ?? null,
      entityRadius: (id) => this.world.entities.get(id)?.desc.r ?? 16,
      shake: (m, ms) => this.shake(m, ms),
      hitStop: (ms) => { this.hitStopEnd = Math.max(this.hitStopEnd, performance.now() + Math.min(ms, 90)); },
      zoom: () => this.cam.zoom,
    });
  }

  // ─────────────────────────── Map ───────────────────────────

  private onWheel = (e: WheelEvent) => {
    // Trackpad pinches arrive as ctrlKey wheel events. Cancel browser page zoom here.
    if (ui.get().screen !== 'game' || e.defaultPrevented || e.altKey || !Number.isFinite(e.deltaY) || e.deltaY === 0) return;
    if(e.target!==this.app.canvas){if(e.ctrlKey)e.preventDefault();return;}
    e.preventDefault();
    const units = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.app.screen.height : 1;
    const pixels = Math.max(-100, Math.min(100, e.deltaY * units));
    preferences.set({ cameraZoom: preferences.get().values.cameraZoom * Math.exp(-pixels * 0.001) });
  };

  setMap(map: MapData) {
    this.cam.zoom=this.app.screen.height/VIEW_HEIGHT*preferences.get().values.cameraZoom;
    setViewScale(this.cam.zoom*this.app.renderer.resolution);
    this.roofAlpha.clear();
    this.townLife?.destroy();this.townLife=null;
    this.adventureLife?.destroy();this.adventureLife=null;
    this.root.tint=map.town?.lighting?.ambient??0xffffff;
    for (const c of [this.ground, this.decals]) for (const ch of c.removeChildren()) ch.destroy({ children: true });
    for (const p of this.props) p.view.destroy({ children: true });
    for (const s of this.statics) s.view.destroy();
    this.props = [];
    this.statics = [];
    this.questStamp=null;
    this.vfx.clear();
    this.barks.clear();
    this.speakers=[];
    this.map = map;
    this.questGuide.refresh(map,ui.get().char,this.world.collision);
    this.collisionOverlay?.destroy({ children: true });
    this.collisionOverlay = map.town ? townCollisionOverlay(map.town) : null;
    if (this.collisionOverlay) { this.collisionOverlay.visible = this.showCollision; this.aboveFx.addChild(this.collisionOverlay); }
    const layers = buildMapLayers(map);
    this.ground.addChild(layers.ground);
    this.decals.addChild(layers.decals);
    for (const p of layers.sorted) {
      p.view.zIndex = p.y;
      this.entities.addChild(p.view);
      this.props.push({ view: p.view, x: p.view.x, y: p.y, bounds: p.bounds, building:p.building });
    }
    for (const n of map.npcs) {
      if (n.role === 'dummy') continue; // dummies are server-side monsters so they can be hit
      const view = createNpcView(n.role, n.name, map.town?.npcs.find(a => a.id === n.id)?.look, map.town?n.r:undefined, map.adventure?.interactions.find(i=>i.id===n.id)?.kind, { zone: map.zone, id: n.id });
      view.root.position.set(n.x, n.y);
      view.root.zIndex = n.y;
      this.entities.addChild(view.root);
      const questLabel=nameLabel('',-view.height-40,0xffdb83);questLabel.style.fontSize=24;questLabel.style.stroke={color:0x140e0a,width:5,join:'round'};questLabel.visible=false;view.root.addChild(questLabel);
      this.statics.push({ view, x: n.x, y: n.y, role: n.role, name: n.name, r: n.r, npcId:n.id,questLabel });
    }
    for (const p of map.portals) {
      const view = createPortalView(p.label, 'town');
      view.root.position.set(p.x, p.y);
      view.root.zIndex = p.y;
      this.entities.addChild(view.root);
      this.statics.push({ view, x: p.x, y: p.y, name: p.label, r: 40, portalTo: p.to });
    }
    for(const s of this.statics){const lines=s.role?BARKS[s.role]:undefined;if(lines)this.speakers.push({key:s.npcId??s.name,x:s.x,y:s.y,height:s.view.height,lines});}
    if(map.town?.stage==='complete') {
      this.townLife=new TownLife(map.town,this.entities);
      this.groundFx.addChild(this.townLife.ground);this.aboveFx.addChild(this.townLife.above);
      this.speakers.push(...this.townLife.speakers);
    }
    if(map.adventure?.ambience) {
      this.adventureLife=new AdventureLife(map.adventure);
      this.groundFx.addChildAt(this.adventureLife.ground,0);
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
        const previous=this.looks.get(e.id);
        if (previous !== key) {
          (e.view as PlayerView).setLook(e.desc.look);this.looks.set(e.id,key);
          if((previous?JSON.parse(previous).title:undefined)!==e.desc.look.title){
            e.nameplate?.destroy();
            e.nameplate=this.vfx.createNameplate(e.desc,e.id===this.world.myId);
            if(e.nameplate)this.text.addChild(e.nameplate.root);
          }
        }
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
    if(e.kind==='player')this.crowdPoses.set(e.id,{elapsed:0,slot:-1});
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
    this.crowdPoses.delete(e.id);
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
    this.questGuide.root.visible=false;
    for (const e of [...this.active]) this.destroyView(e);
    this.active.clear();
  }

  // ─────────────────────────── Camera & feedback ───────────────────────────

  shake(magnitude: number, ms: number) {
    if (!preferences.get().values.cameraShake) return;
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
    const targetZoom = scr.height / VIEW_HEIGHT * preferences.get().values.cameraZoom;
    const zoom = Math.abs(targetZoom - this.cam.zoom) < 0.0001 ? targetZoom
      : this.cam.zoom + (targetZoom - this.cam.zoom) * (1 - Math.exp(-dtMs / 90));
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
    const townTime=this.world.serverNow()/1000;
    this.townLife?.update(viewDt,townTime,this.cam.x,this.cam.y,halfW,halfH);
    this.adventureLife?.update(townTime,this.cam.x,this.cam.y,halfW,halfH);
    if (this.map) {
      const mw = this.map.w * 64, mh = this.map.h * 64;
      this.cam.x = mw > halfW * 2 ? Math.max(halfW, Math.min(mw - halfW, this.cam.x)) : mw / 2;
      this.cam.y = mh > halfH * 2 ? Math.max(halfH, Math.min(mh - halfH, this.cam.y)) : mh / 2;
    }
    let sx = 0, sy = 0;
    if (preferences.get().values.cameraShake && now < this.shakeEnd) {
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
    for(const b of this.map?.town?.buildings??[])if(b.interior&&me){
      const target=b.interior.floors.some(p=>inPolygon(me.x,me.y,p))?.08:1;
      const a=this.roofAlpha.get(b.id)??1;this.roofAlpha.set(b.id,a+(target-a)*Math.min(1,dtMs/100));
    }
    for (const p of this.props) {
      p.view.visible = p.bounds
        ? p.bounds.x1 > x0 && p.bounds.x0 < x1 && p.bounds.y1 > y0 && p.bounds.y0 < y1
        : p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1;
      if(p.building)p.view.alpha=this.roofAlpha.get(p.building)??1;
    }
    const questSave=ui.get().char;
    if(questSave!==this.questStamp) {
      this.questGuide.refresh(this.map,questSave,this.world.collision);
      for(const s of this.statics)if(s.questLabel&&s.npcId&&this.map) {
        const marker=questSave&&questMarker(questSave,this.map.zone,s.npcId);
        s.questLabel.text=marker??'';s.questLabel.visible=!!marker;
      }
      this.questStamp=questSave;
    }
    this.questGuide.update(me,ui.get().screen==='game');
    for (const s of this.statics) {
      const vis = s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1;
      s.view.root.visible = vis;
      if (vis) s.view.update(viewDt, { x: s.x, y: s.y, vx: 0, vy: 0, moving: false, facingLeft: false, flags: 0, attackSeq: 0, hpFrac: 1, time: this.map?.town ? townTime : this.time, aps: 1 });
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
      const hiddenLoot = e.desc.loot?.lk === 'item' && !!e.desc.loot.rarity
        && ordinarySelected(ui.get().char?.collection?.loot.hidden, e.desc.loot.rarity);
      const vis = !hiddenLoot && x > x0 && x < x1 && y > y0 && y < y1;
      v.root.visible = vis;
      if (e.nameplate) e.nameplate.root.visible = vis && !e.dying;
      if (!vis && !e.dying) continue;
      v.root.position.set(x, y);
      v.root.zIndex = y;
      const st: ViewState = { x, y, vx, vy, moving, facingLeft, flags, attackSeq: e.aseq, hpFrac: e.hp, time: this.time, aps: isMe ? this.myAps : 1.25 };
      // Only crowded-town remote idle/walk poses are sampled. Position/depth interpolation above
      // remains full-rate; local heroes, attacks, channels, dashes, deaths and every field are untouched.
      const cachePose=!!this.map?.town&&this.active.size>40&&e.kind==='player'&&!isMe&&!e.dying&&(flags&(4|8|16|256))===0;
      const pose=this.crowdPoses.get(e.id);
      if(cachePose&&pose) {
        if(!v.root.isCachedAsTexture)v.root.cacheAsTexture({resolution:2,antialias:true});
        pose.elapsed+=viewDt;const slot=Math.floor((now+e.id*13)/(1000/24));
        if(slot!==pose.slot){v.update(pose.elapsed,st);pose.elapsed=0;pose.slot=slot;v.root.updateCacheTexture();}
      } else {
        if(v.root.isCachedAsTexture)v.root.cacheAsTexture(false);
        v.update(viewDt+(pose?.elapsed??0),st);if(pose)pose.elapsed=0;
      }
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
    this.barks.update(now, me, this.speakers);
    this.vfx.update(dtMs);
  }

  /** A service person's short line in a bubble above their head (force = on interaction). */
  bark(s: StaticView, force = false): void {
    const lines = s.role ? BARKS[s.role] : undefined;
    if (lines) this.barks.say({ key: s.npcId ?? s.name, x: s.x, y: s.y, height: s.view.height, lines }, performance.now(), force);
  }

  /** Nearest static NPC / map portal within interaction range of (x, y). */
  nearestInteractable(x: number, y: number): StaticView | null {
    let best: StaticView | null = null, bd = 1e9;
    for (const s of this.statics) {
      const d = Math.hypot(s.x - x, s.y - y) - s.r;
      const n = this.map?.town?.npcs.find(n => n.role === s.role);
      const a=this.map?.adventure?.interactions.find(i=>i.id===s.npcId);
      const margin = n ? n.interactionRadius - s.r : a ? a.radius-s.r : 70;
      if (d <= margin && d < bd && (!(this.map?.town || this.map?.adventure) || !this.world.collision?.segmentBlocked(x, y, s.x, s.y))) { bd = d; best = s; }
    }
    return best;
  }
}
