// One Session per WebSocket connection. Implements PlayerLink (the simulation's view of a connected player)
// and routes client messages: hello, in, cmd, chat, ping.

import { isHeroAppearance } from '../../../shared/src/appearance';
import { startIntro } from '../../../shared/src/onboarding';
import {CHAT_MAX_LEN,CHAT_BURST,CHAT_REFILL_MS} from '../../../shared/src/social';
import {EMOTES} from '../../../shared/src/community';
export {CHAT_MAX_LEN} from '../../../shared/src/social';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import { applyAfkGains } from '../afk';
import { ACCOUNT_MODE, ALLOW_LEGACY_LOGIN, AUTOSAVE_MS } from '../config';
import { runCommand } from '../commands';
import type { PlayerLink } from '../contracts';
import { CorruptCharacterError, SaveWriteError, UnsupportedSaveVersionError, NAME_RE, characterId, loadCharacter, saveCharacter } from '../persistence';
import { fail, type CmdResult, type InstRec, type World } from '../world';
import { isClassId } from '../../../shared/src/data/classes';
import { createCharacter } from '../../../shared/src/character';
import { clamp } from '../../../shared/src/math';
import { CLIENT_OUTDATED_MESSAGE, MAX_MESSAGES_PER_SECOND, PROTOCOL_VERSION, type AuthCharacter, type AuthOp, type C2S, type CmdOp, type S2C } from '../../../shared/src/protocol';
import { AccountsBusyError, MAX_CHARACTERS_PER_ACCOUNT } from '../accounts';
import { diffEvents, observe, type Observed } from '../telemetry';
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
const ACCOUNT_IDLE_MS = 5 * 60_000;

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
  /** Username once `auth` succeeded on this connection (before `hello`). */
  private account: string | null = null;
  private authBusy = false;
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
  private commandQueue:Promise<void>=Promise.resolve();
  private seen: Observed | null = null;
  private queuedCommands=0;

  constructor(readonly ws: WebSocket, readonly world: World, readonly ip = '') {
    // With accounts there is a login screen to fill in before `hello`, so the idle allowance is longer.
    this.helloTimer = setTimeout(() => { if (this.state === 'new') this.kick('Login timed out'); }, ACCOUNT_MODE === 'off' ? HELLO_TIMEOUT_MS : ACCOUNT_IDLE_MS);
    ws.on('message', (data, isBinary) => this.onData(data, isBinary));
    ws.on('pong', () => { this.alive = true; });
    ws.on('close', () => this.cleanup());
    ws.on('error', () => { /* the close event follows */ });
    if (ACCOUNT_MODE !== 'off') this.send({ t: 'auth', op: 'status', ok: true, mode: ACCOUNT_MODE });
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
    this.observe(now);
  }

  /** Playtest telemetry: compare this second's character with the last one and log what changed. */
  private observe(now: number): void {
    const telemetry = this.world?.telemetry;
    if (!telemetry?.enabled || this.state !== 'ready') return;
    const playMs = this.save.stats.playMs + (this.playMark ? now - this.playMark : 0);
    const next = observe(this.save, this.rec?.inst.map.zone ?? '', playMs);
    telemetry.logAll(diffEvents(this.seen, next, this.charId));
    this.seen = next;
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
      case 'auth':
        void this.onAuth(msg);
        return;
      case 'hello':
        void this.onHello(msg);
        return;
    }
    if (this.state !== 'ready') return;
    switch (msg.t) {
      case 'in': this.onInput(msg); return;
      case 'cmd': this.onCmd(msg); return;
      case 'chat': this.onChat(msg.text,msg.ch,msg.to); return;
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
    if(this.queuedCommands>=60){this.send({t:'res',id:msg.id,ok:false,err:'Too many queued commands'});return;}
    this.queuedCommands++;
    this.commandQueue=this.commandQueue.then(()=>this.handleCmd(msg)).catch(e=>console.error('[session] command queue failed',e)).finally(()=>{this.queuedCommands--;});
  }
  private async handleCmd(msg:Extract<C2S,{t:'cmd'}>):Promise<void>{
    if(this.state!=='ready')return;
    const id = msg.id;
    if (typeof id !== 'number' || !Number.isFinite(id)) return;
    const args = msg.a === undefined ? {} : msg.a;
    let commit:Promise<void>|null=null;
    const res = await this.commandReceipts.executeAsync(id, msg.op, {args,request:msg.r??null}, async () => {
      let r: CmdResult;
      if (typeof msg.op !== 'string' || !isRecord(args)) {
        r = fail('Bad command');
      } else {
        try {
          const execute=()=>runCommand(this,this.world,msg.op as CmdOp,args);
          if(msg.op==='community')r=await this.world.community.command(this,args);
          else if(isPersistedCommand(msg.op)){
            const result=persistedCommand(this,msg.r,msg.op,args,execute,()=>!this.commandSave);
            r=result.result;
            if(result.fresh){
              this.markDirty();
              const saving=this.captureSave();this.commandSave=saving;commit=saving;
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
    const saving=commit??this.commandSave;
    if(saving){
      await saving.then(publish,()=>{
        if(this.state!=='ready')return;
        this.send({t:'res',id,ok:false,err:'The result could not be confirmed on disk. Reconnect to recover the saved state before trying again.'});
        this.kick('Saving failed; reconnect to recover your character.');
      });
    }else publish();
  }

  private onChat(raw: unknown,ch:unknown='zone',to?:unknown): void {
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
    this.world.chat(this, text,ch,to);
  }

  private slash(text: string): void {
    const cmd = text.slice(1).split(' ')[0].toLowerCase();
    if(Object.hasOwn(EMOTES,cmd)){this.world.chat(this,EMOTES[cmd as keyof typeof EMOTES]);return;}
    switch (cmd) {
      case 'who': this.world.systemMessage(this, `${this.world.onlineCount} player${this.world.onlineCount === 1 ? '' : 's'} online.`); break;
      case 'help': this.world.systemMessage(this, 'Chat: /w Name message, /p, /g, /world, /trade, /lfg. Emotes: /wave, /thanks, /cheer, /ready. Contacts, titles, guilds and reports are in Social. /who lists players.'); break;
      case 'w': case 'whisper': {const [,name,...words]=text.split(' ');this.world.chat(this,words.join(' '),'whisper',name);break;}
      case 'p': case 'party': this.world.chat(this,text.slice(cmd.length+2),'party');break;
      case 'world': case 'trade': case 'lfg': this.world.chat(this,text.slice(cmd.length+2),cmd);break;
      case 'g': case 'guild':this.world.chat(this,text.slice(cmd.length+2),'guild');break;
      default: this.world.systemMessage(this, 'Unknown command. Try /help.');
    }
  }

  // ─────────────────────────── Accounts ───────────────────────────

  private async onAuth(msg: Extract<C2S, { t: 'auth' }>): Promise<void> {
    const op = msg.op as AuthOp;
    const reply = (ok: boolean, extra: Partial<Extract<S2C, { t: 'auth' }>> = {}) => this.send({ t: 'auth', op, ok, mode: ACCOUNT_MODE, ...extra });
    if (ACCOUNT_MODE === 'off') { reply(false, { err: 'Accounts are not enabled on this server.' }); return; }
    if (this.state !== 'new') { reply(false, { err: 'Finish this login before changing accounts.' }); return; }
    if (this.authBusy) { reply(false, { err: 'One moment, still working on your last request.' }); return; }
    this.authBusy = true;
    const store = this.world.accounts;
    try {
      switch (op) {
        case 'register': {
          const r = await store.register(msg.username, msg.password, this.ip);
          if (!r.ok) { reply(false, { err: r.err }); break; }
          this.account = r.username;
          reply(true, { username: r.username, token: store.issueToken(r.username), recoveryCodes: r.recoveryCodes, characters: [] });
          break;
        }
        case 'login': {
          const r = await store.login(msg.username, msg.password, this.ip);
          if (!r.ok) { reply(false, { err: r.err }); break; }
          this.account = r.username;
          reply(true, { username: r.username, token: store.issueToken(r.username), characters: await this.accountCharacters(r.username) });
          break;
        }
        case 'resume': {
          const username = store.resume(msg.token);
          if (!username) { reply(false, { err: 'Your session expired. Please log in again.' }); break; }
          this.account = username;
          reply(true, { username, characters: await this.accountCharacters(username) });
          break;
        }
        case 'logout':
          store.revoke(msg.token);
          this.account = null;
          reply(true);
          break;
        case 'recover': {
          const r = await store.recover(msg.username, msg.code, msg.newPassword, this.ip);
          if (!r.ok) { reply(false, { err: r.err }); break; }
          this.account = r.username;
          reply(true, { username: r.username, token: store.issueToken(r.username), characters: await this.accountCharacters(r.username) });
          break;
        }
        case 'password': {
          if (!this.account) { reply(false, { err: 'Log in first.' }); break; }
          const r = await store.changePassword(this.account, msg.password, msg.newPassword);
          if (!r.ok) { reply(false, { err: r.err }); break; }
          reply(true, { username: this.account, token: store.issueToken(this.account) });
          break;
        }
        case 'codes': {
          if (!this.account) { reply(false, { err: 'Log in first.' }); break; }
          const r = await store.newRecoveryCodes(this.account, msg.password);
          reply(r.ok, r.ok ? { username: this.account, recoveryCodes: r.recoveryCodes } : { err: r.err });
          break;
        }
        default:
          reply(false, { err: 'Unknown account request.' });
      }
    } catch (err) {
      if (err instanceof AccountsBusyError) { reply(false, { err: err.message }); }
      else {
        console.error('[session] account request failed:', err);
        reply(false, { err: 'The account service had a problem. Please try again.' });
      }
    } finally {
      this.authBusy = false;
    }
  }

  private async accountCharacters(username: string): Promise<AuthCharacter[]> {
    const out: AuthCharacter[] = [];
    for (const id of this.world.accounts.charactersOf(username)) {
      try {
        const c = await loadCharacter(id);
        if (c) out.push({ name: c.name, classId: c.classId, level: c.level });
      } catch { /* an unreadable character is simply not listed */ }
    }
    return out;
  }

  // ─────────────────────────── Login ───────────────────────────

  private async onHello(msg: Extract<C2S, { t: 'hello' }>): Promise<void> {
    if (this.state !== 'new') return;
    const name = typeof msg.name === 'string' ? msg.name.trim() : '';
    if (!NAME_RE.test(name)) { this.kick('Names are 2-16 letters or numbers.'); return; }
    if (!isClassId(msg.classId)) { this.kick('Unknown class.'); return; }
    if (msg.v !== PROTOCOL_VERSION) { this.kick(CLIENT_OUTDATED_MESSAGE); return; }

    if(msg.appearance!==undefined&&!isHeroAppearance(msg.appearance)){this.kick('Invalid appearance');return;}
    if(msg.tutorial!==undefined&&typeof msg.tutorial!=='boolean'){this.kick('Invalid introduction choice');return;}
    const id = characterId(name);
    if(this.world.community.banned(id)){this.kick('This character is suspended. Contact the owner.');return;}
    const accounts = this.world.accounts, owner = ACCOUNT_MODE === 'off' ? undefined : accounts.ownerOf(id);
    if (ACCOUNT_MODE === 'required' && !this.account) { this.kick('Log in to your account first.'); return; }
    if (owner && owner !== this.account) { this.kick(this.account ? 'That name is taken.' : 'This character belongs to an account. Log in first.'); return; }
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

    // Account rules once we know whether the character already exists. A character nobody owns can be taken by the
    // logged-in account when it is brand new, or when the owner has opened the legacy migration window.
    if (ACCOUNT_MODE !== 'off' && this.account && !owner) {
      if (save !== null && !ALLOW_LEGACY_LOGIN) { this.kick('This character is not linked to an account. Ask the server owner to link it.'); return; }
      const linked = await accounts.link(this.account, id, MAX_CHARACTERS_PER_ACCOUNT);
      if (!linked.ok) { this.kick(linked.err); return; }
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
    this.world.telemetry.log({ e: 'login', c: this.charId, fresh: isNew, cls: save.classId, lvl: save.level, playMs: save.stats.playMs,
      ...(afk ? { afkMs: afk.ms, afkKills: afk.kills, afkLevels: afk.levels } : {}) });
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
      this.world.telemetry.log({ e: 'logout', c: this.charId, lvl: this.save.level, playMs: this.save.stats.playMs + (this.playMark ? Date.now() - this.playMark : 0),
        kills: this.save.stats.kills, deaths: this.save.stats.deaths });
      console.log(`[session] ${this.save.name} logged out`);
    }
    if (this.charId) this.world.release(this.charId, this);
  }
}
