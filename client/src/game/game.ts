// Client game controller: connection, message handling, prediction, interpolation and the frame loop.

import { funnel } from './funnel';
import type { Application } from 'pixi.js';
import { DASH } from '@shared/constants';
import { ZONES } from '@shared/data/zones';
import { ARTISAN_FUNCTIONS, type Artisan } from '@shared/townServices';
import { cubeUI } from '../ui/panels/cubestate';
import { F_CHANNEL, F_FROZEN, F_STUN, PROTOCOL_VERSION, type AuthOp, type GameEvent, type S2C, type Snapshot, type ZoneInfo } from '@shared/protocol';
import type { CharacterSave, ClassId, DerivedStats } from '@shared/types';
import { playerLook } from '@shared/character';
import { SETS } from '@shared/data/items';
import { GEAR_TIER_NAMES, gearProfile } from '@shared/gearVisual';
import { text } from '../i18n/messages';
import { sfx } from '../audio/sfx';
import { TownSound } from '../audio/town';
import { AdventureSound } from '../audio/adventure';
import { installApi, session } from '../net/api';
import { Connection } from '../net/connection';
import { clearToken, fetchAccountMode, loadToken, rememberUsername, saveToken } from '../net/account';
import { Scene } from '../render/scene';
import type { ActingView, PlayerView } from '../render/types';
import { closeAllPanels, pushChat, pushNotice, togglePanel, ui, worldReader, type PanelId } from '../ui/store';
import { questAtTarget, questMarker } from '@shared/quests';
import { openJournal } from '../ui/panels/adventure';
import { Input } from './input';
import { preferences } from './preferences';
import { Predictor } from './prediction';
import { ClientWorld } from './world';
import { completedRunSummary } from './runSummary';

export class Game {
  readonly audio = sfx;
  readonly world: ClientWorld;
  readonly scene: Scene;
  readonly predictor = new Predictor();
  readonly input: Input;
  private conn: Connection | null = null;
  /** True once the live socket is logged in to an account (accounts mode). Reset whenever a new socket opens. */
  private connAuthed = false;
  private authWaiter: { op: AuthOp; resolve: (m: Extract<S2C, { t: 'auth' }>) => void } | null = null;
  private snapCount = 0;
  private dmgLog: { t: number; a: number }[] = [];
  private lastUi = 0;
  private fpsFrames = 0;
  private fpsT = 0;
  private lastRiftKey = '';
  private lastDungeonKey = '';
  private lastFieldEventKey = '';
  private whirl = false;
  private observationPosition?:{x:number;y:number;dead:number};

  constructor(private app: Application) {
    session.interact = () => this.interact();
    this.world = new ClientWorld({ onAdd: (e) => this.scene.onAdd(e), onRemove: (e) => this.scene.onRemove(e) });
    this.scene = new Scene(app, this.world);
    this.input = new Input({
      onDash: () => { sfx.unlock(); this.predictor.queueDash(); },
      onHotkey: (k, e) => this.hotkey(k, e),
      onSkill: slot => this.manualSkill(slot),
    });
    worldReader.current = {
      map: () => this.world.map,
      entities: () => this.minimapEntities(),
      myPos: () => (this.predictor.ready ? { x: this.predictor.x, y: this.predictor.y } : null),
    };
    app.ticker.add((t) => this.frame(t.deltaMS));
    document.addEventListener('visibilitychange',()=>funnel.clock(performance.now(),!document.hidden&&ui.get().screen==='game'));
    window.addEventListener('pagehide',()=>funnel.stop());
  }

  /** One socket serves the select screen, the account screens and then the game itself. */
  private async openConnection(): Promise<Connection | null> {
    if (this.conn?.open) return this.conn;
    const conn = new Connection((m) => this.onMessage(m), (reason) => {
      if (this.conn === conn) { this.conn = null; this.connAuthed = false; }
      if (ui.get().screen === 'select') {
        // An idle login socket ended (server timeout or restart). The next action reconnects and resumes quietly.
        ui.set((s) => ({ connected: false, account: { ...s.account, busy: false } }));
        return;
      }
      funnel.stop();
      ui.set({ connected: false, error: reason, screen: 'select', enchant: null,party:null,social:null,inspectionName:'',reportContext:null,chat:[],chatOpen:false,chatTarget:'' });
      this.stopChannelAudio();
      this.townSound?.destroy();this.townSound=null;
      this.adventureSound?.destroy();this.adventureSound=null;
      this.scene.clearEntities();
    });
    try {
      await conn.connect();
    } catch {
      return null;
    }
    this.conn = conn;
    this.connAuthed = false;
    installApi((op, a) => conn.cmd(op, a), (text,ch,to) => conn.send({ t: 'chat', text,ch,to }));
    ui.set({ connected: true });
    return conn;
  }

  async start(name: string, classId: ClassId, options?:{appearance?:import('@shared/appearance').HeroAppearance;tutorial?:boolean}) {
    sfx.unlock();
    ui.set({ screen: 'connecting', error: null, enchant: null, lastRun:null,party:null,social:null,inspectionName:'',reportContext:null,chat:[],chatOpen:false,chatChannel:'zone',chatTarget:'' });
    const conn = await this.openConnection();
    if (!conn) {
      ui.set({ screen: 'select', error: 'Could not reach the game server' });
      return;
    }
    // Accounts: a socket must be logged in before `hello` (the login just done, or the session kept from last time).
    const mode = ui.get().account.mode;
    if (mode !== 'off' && !this.connAuthed && loadToken()) await this.authRequest(conn, 'resume');
    if (mode === 'required' && !this.connAuthed) {
      ui.set((s) => ({ screen: 'select', error: 'Log in to your account first.', account: { ...s.account, username: null, characters: [], open: true } }));
      return;
    }
    conn.send({ t: 'hello', name, classId, v: PROTOCOL_VERSION, ...options });
  }

  // ─────────────────────────── Accounts (before `hello`) ───────────────────────────

  private authRequest(conn: Connection, op: Exclude<AuthOp, 'status'>, fields: { username?: string; password?: string; newPassword?: string; code?: string } = {}): Promise<Extract<S2C, { t: 'auth' }> | null> {
    return new Promise((resolve) => {
      const done = (m: Extract<S2C, { t: 'auth' }>) => { window.clearTimeout(timer); resolve(m); };
      const timer = window.setTimeout(() => { if (this.authWaiter?.resolve === done) this.authWaiter = null; resolve(null); }, 15_000);
      this.authWaiter = { op, resolve: done };
      conn.send({ t: 'auth', op, ...fields, ...(op === 'resume' || op === 'logout' ? { token: loadToken() ?? undefined } : {}) });
    });
  }

  /** Account request from the select screen. The reply also updates `ui.account` (see the `auth` message case). */
  async auth(op: Exclude<AuthOp, 'status'>, fields: { username?: string; password?: string; newPassword?: string; code?: string } = {}): Promise<{ ok: boolean; err?: string }> {
    if (ui.get().account.busy) return { ok: false, err: 'One moment, still working on your last request.' };
    const fail = (err: string) => { ui.set((s) => ({ account: { ...s.account, busy: false, error: err } })); return { ok: false, err }; };
    ui.set((s) => ({ account: { ...s.account, busy: true, error: null } }));
    const conn = await this.openConnection();
    if (!conn) return fail('Could not reach the game server');
    // Changing a password or asking for codes needs a session on this very socket; a server restart or the login
    // timeout may have ended it, so pick it up again from the stored token first.
    if ((op === 'password' || op === 'codes') && !this.connAuthed) {
      await this.authRequest(conn, 'resume');
      if (!this.connAuthed) return fail('Your session ended. Please log in again.');
    }
    const reply = await this.authRequest(conn, op, fields);
    ui.set((s) => ({ account: { ...s.account, busy: false } }));
    if (!reply) return fail('The server did not answer. Please try again.');
    return { ok: reply.ok, err: reply.err };
  }

  /** At startup: read the server's mode and, when accounts exist and a session token is stored, resume it. */
  async initAccount(): Promise<void> {
    const mode = await fetchAccountMode();
    ui.set((s) => ({ account: { ...s.account, mode, open: mode === 'required' && !s.account.username } }));
    if (mode === 'off' || ui.get().account.username || !loadToken()) return;
    await this.auth('resume');
    ui.set((s) => ({ account: { ...s.account, open: s.account.mode === 'required' && !s.account.username } }));
  }

  // ─────────────────────────── Messages ───────────────────────────

  private onMessage(m: S2C) {
    switch (m.t) {
      case 'auth': {
        if (m.ok && (m.op === 'register' || m.op === 'login' || m.op === 'resume' || m.op === 'recover')) this.connAuthed = true;
        if (m.ok && m.op === 'logout') this.connAuthed = false;
        if (m.token) saveToken(m.token);
        if ((m.ok && m.op === 'logout') || (!m.ok && m.op === 'resume')) clearToken();
        if (m.ok && m.username) rememberUsername(m.username);
        ui.set((s) => {
          const a = s.account;
          if (m.op === 'status') return { account: { ...a, mode: m.mode, open: a.open || (m.mode === 'required' && !a.username) } };
          // A refused resume means the stored session is gone (server restart, expiry): drop the signed-in view with it.
          if (!m.ok) return { account: { ...a, mode: m.mode, error: m.op === 'resume' ? null : m.err ?? 'That did not work. Please try again.',
            ...(m.op === 'resume' ? { username: null, characters: [] as typeof a.characters } : {}) } };
          const codes = m.recoveryCodes ?? a.codes;
          return { account: { ...a, mode: m.mode, error: null, codes,
            username: m.op === 'logout' ? null : m.username ?? a.username,
            characters: m.op === 'logout' ? [] : m.characters ?? a.characters,
            // The dialog stays open while recovery codes wait to be acknowledged; otherwise a login closes it.
            open: m.op === 'logout' ? m.mode === 'required' : codes ? true : (m.op === 'password' || m.op === 'codes') ? a.open : false } };
        });
        const w = this.authWaiter;
        if (w && m.op !== 'status' && w.op === m.op) { this.authWaiter = null; w.resolve(m); }
        break;
      }
      case 'welcome':
        funnel.observe(m.char);
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
      case 'char': {
        const prev = ui.get().char;
        funnel.observe(m.char);
        this.applyDerived(m.derived);
        ui.set({ char: m.char, derived: m.derived });
        this.gearMoment(prev, m.char);
        break;
      }
      case 'chat':
        pushChat({ ch: m.ch, from: m.from, to:m.to, cls: m.cls, text: m.text,messageId:m.messageId, item:m.item });
        break;
      case 'afk':
        ui.set({ afk: m });
        break;
      case 'world':
        ui.set({ world: m.world });
        break;
      case 'party':
        ui.set({party:m.party});
        break;
      case 'social':
        ui.set({social:m.social});
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
    this.observationPosition=undefined;
    if(zone.zone==='rillwake_crossing')funnel.event('field');
    if(zone.kind==='town'&&funnel.get().records.at(-1)?.first.elite!==undefined)funnel.event('return');
    this.stopChannelAudio();
    this.townSound?.destroy();this.townSound=null;
    this.adventureSound?.destroy();this.adventureSound=null;
    this.scene.clearEntities();
    this.world.setZone(zone, you);
    this.scene.setMap(this.world.map!);
    if(this.world.map?.town)this.townSound=new TownSound(this.world.map.town);
    if(this.world.map?.adventure)this.adventureSound=new AdventureSound(this.world.map.adventure,sfx);
    this.predictor.reset();
    this.dmgLog = [];
    this.lastDungeonKey='';
    this.lastFieldEventKey='';ui.set({fieldEvents:[]});
    this.lastRiftKey='';
    ui.set({ zone, myId: you, rift: null, dungeon:null, target: null, interact: null, panels: {} });
    const def = ZONES[zone.zone];
    if (def) pushNotice(zone.kind === 'rift' ? 'Nephalem Rift' : def.name, 'info');
  }

  private applyDerived(d: DerivedStats) {
    this.predictor.msPct = d.ms;
    this.predictor.dashCd = d.powers.stridewind ? DASH.cooldownMs / 2 : DASH.cooldownMs;
    this.scene.myAps = d.aps;
  }

  private onSnapshot(s: Snapshot) {
    const prev=this.observationPosition;
    if(prev&&!prev.dead&&!s.me.dead&&Math.hypot(s.me.x-prev.x,s.me.y-prev.y)>0.5)funnel.event('move');
    this.observationPosition={x:s.me.x,y:s.me.y,dead:s.me.dead};
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
    const dungeonKey=s.dungeon?`${s.dungeon.stage}|${s.dungeon.phase}|${s.dungeon.remaining}`:'';
    if(dungeonKey!==this.lastDungeonKey){this.lastDungeonKey=dungeonKey;ui.set({dungeon:s.dungeon??null});}
    const fieldKey=JSON.stringify(s.fieldEvents??[]);
    if(fieldKey!==this.lastFieldEventKey){this.lastFieldEventKey=fieldKey;ui.set({fieldEvents:s.fieldEvents??[]});}
    const zone=ui.get().zone;
    if(zone&&ui.get().lastRun?.instance!==zone.instance) {
      const summary=completedRunSummary(zone,s.rift,s.dungeon);
      if(summary)ui.set({lastRun:summary});
    }
  }

  private onEvent(ev: GameEvent) {
    const myId = this.world.myId;
    switch (ev.e) {
      case 'dash':
        if(ev.t===myId)funnel.event('dash');
        break;
      case 'die': {
        const e = this.world.entities.get(ev.t);
        if (e) this.scene.startDeath(e, ev.el);
        break;
      }
      case 'dmg': {
        if (!ev.p && (ev.s === myId || this.isMine(ev.s))) this.dmgLog.push({ t: performance.now(), a: ev.a });
        break;
      }
      case 'level': {
        if (ev.t === myId) pushNotice(`Level ${ev.lv}`, 'level');
        const lv = this.world.entities.get(ev.t);
        (lv?.view as ActingView | null | undefined)?.playAction?.({ skill: 'level_up', tx: lv!.x, ty: lv!.y + 1, cycleMs: 1000 });
        break;
      }
      case 'paragon':
        if (ev.t === myId) pushNotice(`Paragon ${ev.lv}`, 'level');
        break;
      case 'notice':
        pushNotice(ev.text, ev.kind);
        break;
      case 'pickup':
        if(ev.t===myId&&ev.lk==='item')funnel.event('loot');
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

  /** Highest gear rank and the Sets completed this session, per character (celebrate the first time only). */
  private gearBest = new Map<string, { rank: number; sets: Set<string> }>();

  /** An equip that raises the gear rank (or completes a Set for the first time) gets its moment: a notice, a chime
   *  and a burst on the hero (docs/rework/gear/DESIGN.md §2). */
  private gearMoment(prev: CharacterSave | null, next: CharacterSave) {
    const now = gearProfile(playerLook(next));
    let best = this.gearBest.get(next.id);
    if (!best || !prev || prev.id !== next.id) {
      if (!best) { best = { rank: now.rank, sets: new Set(now.topSetCount >= 6 && now.topSet ? [now.topSet] : []) }; this.gearBest.set(next.id, best); }
      return;
    }
    const setDone = now.topSetCount >= 6 && !!now.topSet && !best.sets.has(now.topSet);
    const rankUp = now.rank > best.rank;
    if (!rankUp && !setDone) return;
    if (rankUp) best.rank = now.rank;
    if (setDone) best.sets.add(now.topSet!);
    const big = setDone || now.rank >= 8;
    if (rankUp) pushNotice(text('gear.rankUp', { rank: GEAR_TIER_NAMES[now.rank] }), 'level');
    if (setDone) pushNotice(text('gear.setComplete', { set: SETS[now.topSet!]?.name ?? now.topSet! }), 'level');
    sfx.play(big ? 'gear_rank_big' : 'gear_rank');
    const view = this.world.entities.get(this.world.myId)?.view as (PlayerView & { celebrateGear?(big: boolean): void }) | null | undefined;
    view?.celebrateGear?.(big);
  }

  private isMine(id: number | undefined) {
    if (!id) return false;
    const e = this.world.entities.get(id);
    return !!e && e.desc.owner === this.world.myId;
  }

  // ─────────────────────────── Input ───────────────────────────

  private manualSkill(slot: number) {
    const st = ui.get();
    if (!preferences.get().values.manualSkills || st.screen !== 'game' || !st.connected || st.chatOpen || Object.values(st.panels).some(Boolean)) return;
    const skill = st.char?.skills.slots[slot];
    if (!skill) return;
    sfx.unlock();
    void this.conn?.cmd('skillCast', { slot, skill }).then(r => { if (!r.ok && r.err) pushNotice(r.err, 'warn'); });
  }

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
    if (k === 'F3') { e.preventDefault(); this.scene.toggleCollision(); return; }
    if (k === 'Enter') { ui.set({ chatOpen: true }); this.input.clear(); return; }
    if (k === 'j') { if(st.panels.adventure)togglePanel('adventure',false);else openJournal();return; }
    if (k === 'm') { togglePanel('worldmap'); return; }
    if (k === 'u') {
      const n = this.world.map?.town?.npcs.find(n => n.role === 'cube');
      if (n && Math.hypot(n.x - this.predictor.x, n.y - this.predictor.y) <= n.interactionRadius && !this.world.collision?.segmentBlocked(this.predictor.x, this.predictor.y, n.x, n.y)) this.openArtisan('cube');
      else pushNotice("Stand beside the Ancients' Cube to use it", 'info');
      return;
    }
    const panels: Record<string, PanelId> = { i: 'inventory', b: 'inventory', k: 'skills', p: 'paragon', o: 'settings', F1: 'help', F2: 'debug' };
    if (panels[k]) { togglePanel(panels[k]); return; }
    if (k === 'e') this.interact();
    void e;
  }

  private interact() {
    if (!this.predictor.ready) return;
    const { x, y } = this.predictor;
    const s = this.scene.nearestInteractable(x, y);
    const zone = this.world.zone;
    if (s?.poiId) {
      // Shrines and caches: the server checks distance, line of sight and the per-character cooldown.
      const view = s.view as unknown as { setUsed?(ms: number): void };
      void this.conn?.cmd('quest', { action: 'poi', target: s.poiId }).then((r) => {
        const data = r.data as { text?: string; readyIn?: number } | undefined;
        if (r.ok) { view.setUsed?.(data?.readyIn ?? 0); if (data?.text) pushNotice(data.text, 'info'); } else if (r.err) pushNotice(r.err, 'warn');
      });
      return;
    }
    if (s?.role) {
      if(this.world.map?.adventure?.dungeon?.stages.some(stage=>stage.trigger===s.npcId)){
        void this.conn?.cmd('quest',{action:'activate',target:s.npcId}).then(r=>{if(!r.ok&&r.err)pushNotice(r.err,'warn');});return;
      }
      if(s.role==='quest' || s.role==='clue') {
        if(s.role==='clue')this.scene.pulseStatic(s);
        void this.conn?.cmd('quest',{action:'talk',target:s.npcId}).then(r=>{
          const save=ui.get().char,zoneId=zone?.zone;
          if(r.ok && save && zoneId){
            ui.set({adventureTarget:s.npcId??null,adventureZone:zoneId,journalQuest:questAtTarget(save,zoneId,s.npcId??'')?.id??null,
              dialogue:{zone:zoneId,target:s.npcId??'',name:s.name,role:s.role??'quest'}});
            togglePanel('dialogue',true);
          }
        });
        return;
      }
      // Service people speak a short line in a bubble above their head (never a screen banner).
      this.scene.bark(s, true);
      if (Object.hasOwn(ARTISAN_FUNCTIONS, s.role)) {
        const save=ui.get().char,zoneId=zone?.zone;
        // An artisan with business for this hero (offer or turn-in) opens the conversation first; it links to the workshop.
        if(save&&zoneId&&s.npcId&&questMarker(save,zoneId,s.npcId)){ui.set({dialogue:{zone:zoneId,target:s.npcId,name:s.name,role:s.role}});togglePanel('dialogue',true);return;}
        this.openArtisan(s.role as Artisan); return;
      }
      const map: Partial<Record<string, PanelId>> = { waypoint: 'waypoint', obelisk: 'obelisk', paragon: 'paragon', stash: 'stash' };
      const p = map[s.role];
      if (p) togglePanel(p, true);
      return;
    }
    if (s?.portalTo) { void this.conn?.cmd(zone?.kind === 'rift' ? 'leave' : 'travel', { zone: s.portalTo }); return; }
    const portal = this.nearestPortalEntity(x, y);
    if (portal) void this.conn?.cmd(zone?.kind === 'town' ? 'riftEnter' : 'leave');
  }

  private openArtisan(role: Artisan) {
    if (role === 'blacksmith' && ui.get().char?.collection?.loot.salvage.length) {
      void this.conn?.cmd('collection', {action:'autoSalvage'}).then(r => {
        if (!r.ok) { if(r.err)pushNotice(r.err,'warn'); return; }
        const count = (r.data as {count?:number}|undefined)?.count;
        if (count) pushNotice(`Blacksmith auto-salvaged ${count} ordinary items`, 'info');
      });
    }
    ui.set({ artisan: role });
    if (!ARTISAN_FUNCTIONS[role].includes(cubeUI.get().fn)) cubeUI.set({ fn: ARTISAN_FUNCTIONS[role][0], affix: null, result: null });
    togglePanel('cube', true);
  }

  private nearestPortalEntity(x: number, y: number) {
    for (const e of this.world.entities.values()) if (e.kind === 'portal' && Math.hypot(e.x - x, e.y - y) < 110) return e;
    return null;
  }

  // ─────────────────────────── Frame ───────────────────────────
  private townSound:TownSound|null=null;
  private adventureSound:AdventureSound|null=null;

  private stopChannelAudio() {
    sfx.stopLoops();
    this.whirl = false;
  }

  private frame(dtMs: number) {
    funnel.clock(performance.now(),!document.hidden&&ui.get().screen==='game');
    const st = ui.get();
    if (st.screen === 'game' && this.world.map) {
      const mv = st.chatOpen ? { x: 0, y: 0 } : this.input.move();
      if (this.conn) this.predictor.update(dtMs, mv.x, mv.y, this.world.collision, (m) => this.conn!.send(m));
      this.world.interpolate();
      const me = this.predictor.ready
        ? { x: this.predictor.x, y: this.predictor.y, vx: this.predictor.vx, vy: this.predictor.vy, facingLeft: this.predictor.facingLeft, moving: Math.hypot(mv.x, mv.y) > 0, dashing: this.predictor.dashing }
        : null;
      this.scene.update(dtMs, me, { x: this.input.mouseX, y: this.input.mouseY });
      if (me) {sfx.setListener(me.x, me.y);const t=this.world.serverNow()/1000;this.townSound?.update(t,me.x,me.y);this.adventureSound?.update(t);}
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
      if (s?.poiId) interact = { role: 'clue', name: s.name };
      else if (s?.role) interact = { role: s.role, name: s.name };
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
