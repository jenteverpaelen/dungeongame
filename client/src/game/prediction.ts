// Client-side prediction for the local player: the client runs the same shared stepMove() as the
// server for each 50 ms input command, then replays unacknowledged commands on every server state.

import { DASH, PLAYER_RADIUS, TICK_MS } from '@shared/constants';
import type { CollisionWorld, MoveInput, MoveState } from '@shared/movement';
import { stepMove } from '@shared/movement';
import type { C2S, MeState } from '@shared/protocol';

interface Cmd extends MoveInput { seq: number }

export class Predictor {
  private seq = 0;
  private pending: Cmd[] = [];
  private acc = 0;
  private dashQueued = false;
  private s: MoveState = { x: 0, y: 0, dashMs: 0, dashDx: 0, dashDy: 0, dashCdMs: 0, faceX: 1, faceY: 0 };
  private prevX = 0; private prevY = 0;
  private corrX = 0; private corrY = 0;
  ready = false;
  msPct = 0;
  dashCd: number = DASH.cooldownMs;
  frozen = false;
  /** Smoothed render position. */
  x = 0; y = 0;
  vx = 0; vy = 0;
  dashing = false;
  facingLeft = false;

  reset() {
    this.ready = false;
    this.pending = [];
    this.acc = 0;
  }

  queueDash() { this.dashQueued = true; }

  /** Call every frame. Emits input commands at the server tick rate. */
  update(dtMs: number, mx: number, my: number, world: CollisionWorld | null, send: (m: C2S) => void) {
    if (!this.ready || !world) return;
    this.acc += Math.min(dtMs, 250);
    while (this.acc >= TICK_MS) {
      this.acc -= TICK_MS;
      const cmd: Cmd = { seq: ++this.seq, mx: Math.round(mx * 100) / 100, my: Math.round(my * 100) / 100, dash: this.dashQueued };
      this.dashQueued = false;
      send({ t: 'in', seq: cmd.seq, mx: cmd.mx, my: cmd.my, ...(cmd.dash ? { dash: 1 as const } : {}) });
      this.pending.push(cmd);
      if (this.pending.length > 60) this.pending.shift();
      this.prevX = this.s.x; this.prevY = this.s.y;
      stepMove(world, this.s, cmd, this.msPct, this.dashCd, TICK_MS, PLAYER_RADIUS, this.frozen);
    }
    const k = this.acc / TICK_MS;
    // Correction offset decays over ~120 ms so reconciliation never pops visibly.
    const decay = Math.exp(-dtMs / 60);
    this.corrX *= decay; this.corrY *= decay;
    const nx = this.prevX + (this.s.x - this.prevX) * k + this.corrX;
    const ny = this.prevY + (this.s.y - this.prevY) * k + this.corrY;
    if (dtMs > 0) { this.vx = ((nx - this.x) / dtMs) * 1000; this.vy = ((ny - this.y) / dtMs) * 1000; }
    if (Math.abs(this.vx) > 5) this.facingLeft = this.vx < 0;
    this.x = nx; this.y = ny;
    this.dashing = this.s.dashMs > 0;
  }

  /** Reconcile with the authoritative state for the last acknowledged input. */
  reconcile(me: MeState, ack: number, world: CollisionWorld | null) {
    if (!world) return;
    if (!this.ready) {
      Object.assign(this.s, { x: me.x, y: me.y, dashMs: me.dashMs, dashCdMs: me.dashCd });
      this.prevX = this.x = me.x; this.prevY = this.y = me.y;
      this.pending = [];
      this.ready = true;
      return;
    }
    const beforeX = this.s.x, beforeY = this.s.y;
    this.s.x = me.x; this.s.y = me.y; this.s.dashMs = me.dashMs; this.s.dashCdMs = me.dashCd;
    this.pending = this.pending.filter((c) => c.seq > ack);
    for (const c of this.pending) stepMove(world, this.s, c, this.msPct, this.dashCd, TICK_MS, PLAYER_RADIUS, this.frozen);
    const ex = beforeX - this.s.x, ey = beforeY - this.s.y;
    const err = Math.hypot(ex, ey);
    if (err > 300) { this.corrX = this.corrY = 0; this.prevX = this.s.x; this.prevY = this.s.y; } // teleport / respawn
    else if (err > 0.5) { this.corrX += ex; this.corrY += ey; this.prevX -= ex; this.prevY -= ey; }
  }
}
