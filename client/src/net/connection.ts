// WebSocket transport with MessagePack framing, request/response commands and RTT measurement.

import { Packr } from 'msgpackr';
import type { C2S, CmdOp, S2C } from '@shared/protocol';
import type { CmdResult } from './api';

const packr = new Packr({ useRecords: false });

export class Connection {
  private ws: WebSocket | null = null;
  private nextCmd = 1;
  private pending = new Map<number, { resolve: (r: CmdResult) => void; timer: number }>();
  private pingTimer = 0;
  rtt = 0;

  constructor(private onMessage: (msg: S2C) => void, private onClose: (reason: string) => void) {}

  connect(url = Connection.defaultUrl()): Promise<void> {
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
        window.clearInterval(this.pingTimer);
        for (const p of this.pending.values()) { window.clearTimeout(p.timer); p.resolve({ ok: false, err: 'Disconnected' }); }
        this.pending.clear();
        this.onClose(e.reason || 'Connection closed');
      };
      ws.onmessage = (e) => {
        const msg = packr.unpack(new Uint8Array(e.data as ArrayBuffer)) as S2C;
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
    return new Promise((resolve) => {
      if (!this.open) { resolve({ ok: false, err: 'Not connected' }); return; }
      const id = this.nextCmd++;
      const timer = window.setTimeout(() => { this.pending.delete(id); resolve({ ok: false, err: 'Server did not respond' }); }, 8000);
      this.pending.set(id, { resolve, timer });
      this.send({ t: 'cmd', id, op, a });
    });
  }

  close() { this.ws?.close(); }
}
