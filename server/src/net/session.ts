// One Session per WebSocket connection. Implements PlayerLink (the simulation's view of a connected player)
// and routes client messages: hello, in, cmd, chat, ping.

import { isHeroAppearance } from '../../../shared/src/appearance';
import { startIntro } from '../../../shared/src/onboarding';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import { applyAfkGains } from '../afk';
import { AUTOSAVE_MS } from '../config';
import { runCommand } from '../commands';
import type { PlayerLink } from '../contracts';
import { CorruptCharacterError, SaveWriteError, UnsupportedSaveVersionError, NAME_RE, characterId, loadCharacter, saveCharacter } from '../persistence';
import { fail, type CmdResult, type InstRec, type World } from '../world';
import { isClassId } from '../../../shared/src/data/classes';
import { createCharacter } from '../../../shared/src/character';
import { clamp } from '../../../shared/src/math';
import { MAX_MESSAGES_PER_SECOND, PROTOCOL_VERSION, type C2S, type CmdOp, type S2C } from '../../../shared/src/protocol';
import { computeStats } from '../../../shared/src/stats';
import type { AffixRoll, CharacterSave, DerivedStats } from '../../../shared/src/types';
import { decode, encode } from './codec';
import { CommandReceipts } from './commandReceipts';
import { isPersistedCommand, validCommandState } from '../../../shared/src/commandState';
import { initializeCommandState, persistedCommand } from './persistedCommands';

/** Messages accepted per second per connection; the rest are dropped. */
export const MAX_MSGS_PER_SEC = MAX_MESSAGES_PER_SECOND;
/** A client that keeps flooding past this many dropped messages per second is disconnected. */
const FLOOD_KICK_DROPS = 600;
/** Minimum spacing between `char` updates triggered by markDirty (ms). */
const CHAR_THROTTLE_MS = 1000; // XP, gold and level also ride in every snapshot's `me` block
/** Close connections whose send buffer grows beyond this (the client cannot keep up). */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;
const HELLO_TIMEOUT_MS = 10_000;
export const CHAT_MAX_LEN = 200;
const CHAT_BURST = 5;
const CHAT_REFILL_MS = 1_000;

export type SessionState = 'new' | 'loading' | 'ready' | 'closed';

/** Result of the last enchantRoll, kept until the player picks (or rolls again). */
export interface PendingEnchant { itemId: string; affix: number; options: AffixRoll[] }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export class Session implements PlayerLink {
  readonly sessionId = randomUUID().slice(0, 8);
  /** Live save, set once the character is loaded. */
  save!: CharacterSave;
  derived!: DerivedStats;
  state: SessionState = 'new';

  // Placement, maintained by the World.
  rec: InstRec | null = null;
  entityId = 0;
  homeTown: string | null = null;
  /** While set, outgoing messages are buffered (used by World.enter so `welcome`/`zone` come first). */
  hold: S2C[] | null = null;

  pendingEnchant: PendingEnchant | null = null;

  private charId = '';
  private alive = true;
  private winStart = 0;
  private winCount = 0;
  private winDropped = 0;
  private chatTokens = CHAT_BURST;
  private chatAt = Date.now();
  private persistDirty = false;
  private saveWarning = false;
  private lastSaveAt = 0;
  private charDirty = false;
  private lastCharAt = 0;
  private charTimer: NodeJS.Timeout | null = null;
  private helloTimer: NodeJS.Timeout | null;
  private derivedLevel = 0;
  private playMark = 0;
  private kicking = false;
  private commandReceipts = new CommandReceipts();
  private commandSave:Promise<void>|null=null;

  constructor(readonly ws: WebSocket, readonly world: World, readonly ip = '') {
    this.helloTimer = setTimeout(() => { if (this.state === 'new') this.kick('Login timed out'); }, HELLO_TIMEOUT_MS);
    ws.on('message', (data, isBinary) => this.onData(data, isBinary));
    ws.on('pong', () => { this.alive = true; });
    ws.on('close', () => this.cleanup());
    ws.on('error', () => { /* the close event follows */ });
  }

  get name(): string { return this.save?.name ?? ''; }

  /** True once the connection is gone (read through a getter: state changes across awaits). */
  get isClosed(): boolean { return this.state === 'closed'; }

  // ─────────────────────────── Outgoing ───────────────────────────

  send(msg: S2C): void {
    if (this.hold) { this.hold.push(msg); return; }
    if (this.state === 'closed') return;
    this.sendRaw(encode(msg));
  }

  /** Send an already encoded frame (used to fan one message out to many sessions). */
  sendRaw(buf: Uint8Array): void {
    const ws = this.ws;
    if (ws.readyState !== WebSocket.OPEN || this.kicking) return;
    if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
      // May be called from inside an instance tick: disconnect outside of it.
      this.kicking = true;
      setImmediate(() => { this.kicking = false; this.kick('Connection too slow'); });
      return;
    }
    ws.send(buf, { binary: true }, (err) => { if (err) ws.terminate(); });
  }

  // ─────────────────────────── PlayerLink: persistence & char updates ───────────────────────────

  /** The save changed: persist it (autosave) and send a throttled `char` update. */
  markDirty(): void {
    this.persistDirty = true;
    this.charDirty = true;
    this.scheduleChar();
  }

  private scheduleChar(): void {
    if (this.charTimer || this.commandSave || this.state !== 'ready') return;
    const wait = Math.max(0, CHAR_THROTTLE_MS - (Date.now() - this.lastCharAt));
    this.charTimer = setTimeout(() => { this.charTimer = null; this.flushChar(); }, wait);
  }

  /** Send the pending `char` message now (commands do this before their `res`). */
  flushChar(): void {
    if (!this.charDirty || this.commandSave || this.state !== 'ready') return;
    if (this.hold) { this.scheduleChar(); return; }
    if (this.save.level !== this.derivedLevel) this.recompute();
    this.charDirty = false;
    this.lastCharAt = Date.now();
    if (this.charTimer) { clearTimeout(this.charTimer); this.charTimer = null; }
    this.send({ t: 'char', char: this.save, derived: this.derived });
  }

  /** Recompute derived stats from the save. */
  recompute(): void {
    this.derived = computeStats(this.save);
    this.derivedLevel = this.save.level;
  }

  /** A command changed the save: recompute stats, tell the simulation if combat config changed, persist and notify. */
  changed(refreshSim: boolean): void {
    this.recompute();
    if (refreshSim && this.rec) {
      try { this.rec.inst.refreshPlayer(this); } catch (err) { console.error(`[session] refreshPlayer failed for ${this.name}:`, err); }
    }
    this.markDirty();
  }

  /** Write the character to disk (asynchronously, in order). */
  saveNow(): void {
    if (!this.save) return;
    void this.captureSave().then(() => {
      if (this.saveWarning && this.state === 'ready') this.send({ t: 'chat', ch: 'system', text: 'Saving is working again.' });
      this.saveWarning = false;
    }, () => {
      this.persistDirty = true;
      if (!this.saveWarning && this.state === 'ready') {
        this.send({ t: 'chat', ch: 'system', text: 'Your progress could not be saved. The server will retry. Please stay connected.' });
      }
      this.saveWarning = true;
    });
  }

  private async captureSave():Promise<void> {
    const now = Date.now();
    if (this.playMark) this.save.stats.playMs += now - this.playMark;
    this.playMark = now;
    this.persistDirty = false;
    this.lastSaveAt = now;
    await saveCharacter(this.save);
  }

  /** Called once per second by the world: save at most every AUTOSAVE_MS while dirty. */
  autosave(now: number): void {
    if (!this.commandSave && this.persistDirty && now - this.lastSaveAt >= AUTOSAVE_MS) this.saveNow();
  }

  /** Ping the client; terminate when it did not answer the previous ping. */
  heartbeat(): void {
    if (!this.alive) { this.ws.terminate(); return; }
    this.alive = false;
    try { this.ws.ping(); } catch { /* socket already closing */ }
  }

  // ─────────────────────────── Incoming ───────────────────────────

  private onData(data: RawData, isBinary: boolean): void {
    if (this.state === 'closed') return;
    this.alive = true;
    const now = Date.now();
    if (now - this.winStart >= 1000) { this.winStart = now; this.winCount = 0; this.winDropped = 0; }
    const over = ++this.winCount > MAX_MSGS_PER_SEC;
    if (over && ++this.winDropped > FLOOD_KICK_DROPS) { this.kick('Too many messages'); return; }
    // Unsupported text still costs connection capacity; only binary frames are decoded.
    if (!isBinary) return;
    const msg = decode(data);
    if (!msg) return;
    if (over) {
      // Drop it, but do not leave a command waiting for a reply.
      if (msg.t === 'cmd' && Number.isFinite(msg.id)) this.send({ t: 'res', id: msg.id, ok: false, err: 'Too many requests' });
      return;
    }
    try {
      this.handle(msg);
    } catch (err) {
      console.error(`[session] error handling ${msg.t} from ${this.name || this.ip}:`, err);
    }
  }

  private handle(msg: C2S): void {
    switch (msg.t) {
      case 'ping':
        if (typeof msg.c === 'number') this.send({ t: 'pong', c: msg.c, s: Date.now() });
        return;
      case 'hello':
        void this.onHello(msg);
        return;
    }
    if (this.state !== 'ready') return;
    switch (msg.t) {
      case 'in': this.onInput(msg); return;
      case 'cmd': this.onCmd(msg); return;
      case 'chat': this.onChat(msg.text); return;
    }
  }

  private onInput(msg: Extract<C2S, { t: 'in' }>): void {
    const rec = this.rec;
    if (!rec) return;
    const { seq, mx, my } = msg;
    if (typeof seq !== 'number' || typeof mx !== 'number' || typeof my !== 'number') return;
    if (!Number.isFinite(seq) || !Number.isFinite(mx) || !Number.isFinite(my)) return;
    const input: Extract<C2S, { t: 'in' }> = { t: 'in', seq: Math.trunc(seq), mx: clamp(mx, -1, 1), my: clamp(my, -1, 1) };
    if (msg.dash) input.dash = 1;
    rec.inst.queueInput(this, input);
  }

  private onCmd(msg: Extract<C2S, { t: 'cmd' }>): void {
    const id = msg.id;
    if (typeof id !== 'number' || !Number.isFinite(id)) return;
    const args = msg.a === undefined ? {} : msg.a;
    const res = this.commandReceipts.execute(id, msg.op, {args,request:msg.r??null}, () => {
      let r: CmdResult;
      if (typeof msg.op !== 'string' || !isRecord(args)) {
        r = fail('Bad command');
      } else {
        try {
          const execute=()=>runCommand(this,this.world,msg.op as CmdOp,args);
          if(isPersistedCommand(msg.op)){
            const result=persistedCommand(this,msg.r,msg.op,args,execute,()=>!this.commandSave);
            r=result.result;
            if(result.fresh){
              this.markDirty();
              const saving=this.captureSave();this.commandSave=saving;
              void saving.then(()=>{if(this.commandSave===saving)this.commandSave=null;this.saveWarning=false;},
                ()=>{if(this.commandSave===saving)this.commandSave=null;this.persistDirty=true;this.saveWarning=true;});
            }
          }else r=execute();
        } catch (err) {
          console.error(`[session] command ${msg.op} failed for ${this.name}:`, err);
          r = fail('Server error');
        }
      }
      const reply: Extract<S2C, { t: 'res' }> = { t: 'res', id, ok: r.ok };
      if (r.err !== undefined) reply.err = r.err;
      if (r.data !== undefined) reply.data = r.data;
      return reply;
    });
    const publish=()=>{if(this.state==='ready'){this.flushChar();this.send(res);}};
    const saving=this.commandSave;
    if(saving){
      void saving.then(publish,()=>{
        if(this.state!=='ready')return;
        this.send({t:'res',id,ok:false,err:'The result could not be confirmed on disk. Reconnect to recover the saved state before trying again.'});
        this.kick('Saving failed; reconnect to recover your character.');
      });
    }else publish();
  }

  private onChat(raw: unknown): void {
    if (typeof raw !== 'string') return;
    // eslint-disable-next-line no-control-regex
    let text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (text.length > CHAT_MAX_LEN) text = text.slice(0, CHAT_MAX_LEN);
    const now = Date.now();
    this.chatTokens = Math.min(CHAT_BURST, this.chatTokens + (now - this.chatAt) / CHAT_REFILL_MS);
    this.chatAt = now;
    if (this.chatTokens < 1) { this.world.systemMessage(this, 'You are chatting too quickly.'); return; }
    this.chatTokens -= 1;
    if (text.startsWith('/')) { this.slash(text); return; }
    this.world.chat(this, text);
  }

  private slash(text: string): void {
    const cmd = text.slice(1).split(' ')[0].toLowerCase();
    switch (cmd) {
      case 'who': this.world.systemMessage(this, `${this.world.onlineCount} player${this.world.onlineCount === 1 ? '' : 's'} online.`); break;
      case 'help': this.world.systemMessage(this, 'Commands: /who, /help. Everything else is sent to your zone.'); break;
      default: this.world.systemMessage(this, 'Unknown command. Try /help.');
    }
  }

  // ─────────────────────────── Login ───────────────────────────

  private async onHello(msg: Extract<C2S, { t: 'hello' }>): Promise<void> {
    if (this.state !== 'new') return;
    const name = typeof msg.name === 'string' ? msg.name.trim() : '';
    if (!NAME_RE.test(name)) { this.kick('Names are 2-16 letters or numbers.'); return; }
    if (!isClassId(msg.classId)) { this.kick('Unknown class.'); return; }
    if (msg.v !== PROTOCOL_VERSION) { this.kick('Your game is out of date. Please refresh the page.'); return; }

    if(msg.appearance!==undefined&&!isHeroAppearance(msg.appearance)){this.kick('Invalid appearance');return;}
    if(msg.tutorial!==undefined&&typeof msg.tutorial!=='boolean'){this.kick('Invalid introduction choice');return;}
    const id = characterId(name);
    if (!this.world.reserve(id, this)) { this.kick('That character is already online.'); return; }
    this.charId = id;
    this.state = 'loading';
    if (this.helloTimer) { clearTimeout(this.helloTimer); this.helloTimer = null; }

    let save: CharacterSave | null;
    try {
      save = await loadCharacter(id);
    } catch (err) {
      console.error(`[session] loading ${id} failed:`, err);
      this.kick(err instanceof UnsupportedSaveVersionError ? 'This character needs a newer server version.'
        : err instanceof CorruptCharacterError ? 'Your character data is damaged. Please contact the server admin.'
        : err instanceof SaveWriteError ? 'Your latest progress could not be saved. Please try again after the server storage recovers.' : 'Could not load your character.');
      return;
    }
    if (this.isClosed) return;

    const now = Date.now();
    const isNew = save === null;
    if (!save) save = createCharacter(name, msg.classId, (Math.random() * 0xffffffff) >>> 0);
    if(isNew){if(msg.appearance)save.appearance={...msg.appearance};if(msg.tutorial!==false)startIntro(save);}
    const afk = isNew ? null : applyAfkGains(save, now);

    this.save = save;
    initializeCommandState(save);
    if(validCommandState(save.commands))this.pendingEnchant=save.commands.pendingEnchant?structuredClone(save.commands.pendingEnchant):null;
    try{await saveCharacter(save);}catch{
      this.kick('Your character could not be saved. Login rewards have not been confirmed; please retry when saving is available.');return;
    }
    if(this.isClosed)return;
    this.recompute();
    this.playMark = now;
    this.state = 'ready';
    try {
      this.world.login(this, (you, zone) => ({
        t: 'welcome', you, char: this.save, derived: this.derived, zone, time: Date.now(), world: this.world.infoFor(this),
      }));
    } catch (err) {
      console.error(`[session] login of ${id} failed:`, err);
      this.kick('Could not enter the world.');
      return;
    }
    this.saveNow();
    if (afk) this.send({ t: 'afk', ...afk });
    this.world.systemMessage(this, `Welcome to Hearthfall, ${save.name}.`);
    if (isNew) {
      this.world.systemMessage(this, 'Attacks and slotted skills are automatic.');
      this.world.systemMessage(this, 'F1 shows your controls. Change key bindings in Settings.');
    }
    console.log(`[session] ${save.name} (${save.classId} L${save.level}) logged in${isNew ? ' (new)' : ''}${afk ? `, AFK ${Math.round(afk.ms / 60000)} min` : ''} from ${this.ip || '?'}`);
  }

  // ─────────────────────────── Closing ───────────────────────────

  /** Tell the client why and disconnect. */
  kick(reason: string): void {
    if (this.state === 'closed') return;
    this.send({ t: 'err', msg: reason });
    this.cleanup();
    this.closeSocket(4000, reason);
  }

  /** Server shutdown: say goodbye, save and disconnect. */
  shutdown(reason: string): void {
    if (this.state === 'closed') return;
    this.send({ t: 'chat', ch: 'system', text: reason });
    this.cleanup();
    this.closeSocket(1001, reason);
  }

  private closeSocket(code: number, reason: string): void {
    const ws = this.ws;
    try { ws.close(code, Buffer.from(reason).subarray(0, 120).toString()); } catch { /* ignore */ }
    setTimeout(() => { if (ws.readyState !== WebSocket.CLOSED) ws.terminate(); }, 2000).unref();
  }

  /** Leave the world, persist the character and free the name. Safe to call more than once. */
  private cleanup(): void {
    if (this.state === 'closed') return;
    const wasReady = this.state === 'ready';
    this.state = 'closed';
    if (this.helloTimer) { clearTimeout(this.helloTimer); this.helloTimer = null; }
    if (this.charTimer) { clearTimeout(this.charTimer); this.charTimer = null; }
    if (wasReady) {
      try { this.world.logout(this); } catch (err) { console.error(`[session] logout of ${this.name} failed:`, err); }
      this.saveNow();
      console.log(`[session] ${this.save.name} logged out`);
    }
    if (this.charId) this.world.release(this.charId, this);
  }
}
