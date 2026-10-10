// WebSocket transport with MessagePack framing, request/response commands and RTT measurement.

import { Packr } from 'msgpackr';
import { COMMAND_TIMEOUT_MS, MAX_MESSAGES_PER_SECOND, type C2S, type CmdOp, type S2C } from '@shared/protocol';
import type { CmdResult } from './api';
import { isPersistedCommand, validCommandState, type CommandState } from '@shared/commandState';

const packr = new Packr({ useRecords: false });

export class Connection {
  private ws: WebSocket | null = null;
  private nextCmd = 1;
  private pending = new Map<number, { resolve: (r: CmdResult) => void; timer: number }>();
  private pingTimer = 0;
  private commands:CommandState|undefined;
  private commandQueue:Promise<unknown>=Promise.resolve();
  private queuedCommands=0;
  private generation=0;
  rtt = 0;

  constructor(private onMessage: (msg: S2C) => void, private onClose: (reason: string) => void) {}

  connect(url = Connection.defaultUrl()): Promise<void> {
    this.generation++;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      ws.onopen = () => {
        this.pingTimer = window.setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
        resolve();
      };
      ws.onerror = () => reject(new Error('Could not reach the game server'));
      ws.onclose = (e) => {
        this.generation++;
        window.clearInterval(this.pingTimer);
        for (const p of this.pending.values()) { window.clearTimeout(p.timer); p.resolve({ ok: false, err: 'Disconnected' }); }
        this.pending.clear();
        this.onClose(e.reason || 'Connection closed');
      };
      ws.onmessage = (e) => {
        const msg = packr.unpack(new Uint8Array(e.data as ArrayBuffer)) as S2C;
        if(msg.t==='char'||msg.t==='welcome')this.commands=msg.char.commands;
        if (msg.t === 'res') {
          const p = this.pending.get(msg.id);
          if (p) { window.clearTimeout(p.timer); this.pending.delete(msg.id); p.resolve({ ok: msg.ok, err: msg.err, data: msg.data }); }
          return;
        }
        if (msg.t === 'pong') { this.rtt = performance.now() - msg.c; }
        this.onMessage(msg);
      };
    });
  }

  static defaultUrl(): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  get open() { return this.ws?.readyState === WebSocket.OPEN; }

  send(msg: C2S) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(packr.pack(msg));
  }

  cmd(op: CmdOp, a?: Record<string, unknown>): Promise<CmdResult> {
    if(!isPersistedCommand(op))return this.sendCommand(op,a);
    if(this.queuedCommands>=MAX_MESSAGES_PER_SECOND)return Promise.resolve({ok:false,err:'Too many queued actions. Wait for the current action to finish.'});
    const generation=this.generation,args=a===undefined?undefined:structuredClone(a);
    this.queuedCommands++;
    const request=this.commandQueue.then(()=>generation===this.generation?this.sendCommand(op,args):{ok:false,err:'Connection changed; review your character before trying again.'})
      .finally(()=>{this.queuedCommands--;});
    this.commandQueue=request.then(()=>undefined,()=>undefined);
    return request;
  }

  private sendCommand(op:CmdOp,a?:Record<string,unknown>):Promise<CmdResult> {
    return new Promise((resolve) => {
      if (!this.open) { resolve({ ok: false, err: 'Not connected' }); return; }
      const id = this.nextCmd++;
      const timer = window.setTimeout(() => { this.pending.delete(id); resolve({ ok: false, err: 'Result not confirmed. Check your character before trying again.' }); }, COMMAND_TIMEOUT_MS);
      this.pending.set(id, { resolve, timer });
      const state=this.commands;
      const r=isPersistedCommand(op)&&validCommandState(state)?{epoch:state.epoch,sequence:state.sequence,
        token:Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('')}:undefined;
      this.send({ t: 'cmd', id, op, a, r });
    });
  }

  close() { this.ws?.close(); }
}
