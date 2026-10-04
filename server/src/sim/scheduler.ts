// Tiny binary-heap scheduler for delayed / repeating simulation callbacks (telegraph -> impact, DoT pools, ...).

interface Task { at: number; seq: number; fn: () => void }

export class Scheduler {
  private heap: Task[] = [];
  private seq = 0;

  get size() { return this.heap.length; }

  /** Run `fn` when simulation time reaches `at` (ms). */
  schedule(at: number, fn: () => void) {
    const h = this.heap;
    const t: Task = { at, seq: this.seq++, fn };
    let i = h.length;
    h.push(t);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.less(h[p], t)) break;
      h[i] = h[p];
      i = p;
    }
    h[i] = t;
  }

  private less(a: Task, b: Task) { return a.at < b.at || (a.at === b.at && a.seq < b.seq); }

  /** Run everything due at or before `now`. Callbacks may schedule more tasks. */
  run(now: number) {
    const h = this.heap;
    while (h.length && h[0].at <= now) {
      const top = h[0];
      const last = h.pop()!;
      if (h.length) {
        let i = 0;
        for (;;) {
          let c = 2 * i + 1;
          if (c >= h.length) break;
          if (c + 1 < h.length && this.less(h[c + 1], h[c])) c++;
          if (this.less(last, h[c])) break;
          h[i] = h[c];
          i = c;
        }
        h[i] = last;
      }
      try { top.fn(); } catch (err) { console.error('[sched]', err); }
    }
  }

  clear() { this.heap.length = 0; }
}
