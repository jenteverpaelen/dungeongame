// Page-side half of the client performance replay (evaluated in the game page over the DevTools protocol; see
// scripts/perf/replay.mjs). Installs window.__perfReplay(base64Recording, options) which feeds a recorded fight
// (scripts/perf/record-fight.mjs) into the running client exactly as the socket would, at the recorded arrival times,
// and returns per-frame measurements: frame times, WebGL work and a display-object census. Live server messages are
// dropped while it runs, so every run renders the same fight.
(() => {
  if (window.__perfReplay) return true;

  /** Visible scene objects and renderables (what Pixi walks and batches each frame). */
  function census() {
    const g = window.__game, stage = (g.scene.app ?? g.app).stage;
    let nodes = 0, visible = 0, renderables = 0, graphics = 0, add = 0;
    const walk = (o, parentVisible) => {
      nodes++;
      const vis = parentVisible && o.visible && o.renderable !== false && o.alpha > 0;
      if (!vis) return;
      visible++;
      if (o.renderPipeId) { renderables++; if (o.renderPipeId === 'graphics') graphics++; if ((o.groupBlendMode ?? o.blendMode) === 'add') add++; }
      if (!o.isCachedAsTexture) for (const ch of o.children ?? []) walk(ch, true);
    };
    walk(stage, true);
    let mobs = 0; for (const e of g.world.entities.values()) if (e.kind === 'mob' && !e.dying) mobs++;
    return { nodes, visible, renderables, graphics, add, mobs };
  }

  /** Wraps the WebGL entry points the renderer uses and counts them until `stop()`. */
  function glCounters() {
    const gl = (window.__game.scene.app ?? window.__game.app).renderer.gl;
    const c = { draw: 0, bindTexture: 0, texImage2D: 0, texSubImage2D: 0, bufferUploads: 0, bufferBytes: 0, useProgram: 0 };
    const orig = {};
    const wrap = (name, f) => { if (!gl[name]) return; const o = gl[name]; orig[name] = o; gl[name] = function (...x) { f(x); return o.apply(gl, x); }; };
    for (const n of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) wrap(n, () => c.draw++);
    wrap('bindTexture', () => c.bindTexture++); wrap('texImage2D', () => c.texImage2D++); wrap('texSubImage2D', () => c.texSubImage2D++);
    wrap('bufferData', (x) => { c.bufferUploads++; c.bufferBytes += (x[1] && x[1].byteLength) || 0; });
    // bufferSubData(target, offset, src, srcOffset, length): only `length` elements of `src` are sent when given
    wrap('bufferSubData', (x) => { c.bufferUploads++; const src = x[2]; if (src) c.bufferBytes += x[4] ? x[4] * (src.BYTES_PER_ELEMENT || 1) : src.byteLength - (x[3] || 0) * (src.BYTES_PER_ELEMENT || 1); });
    wrap('useProgram', () => c.useProgram++);
    return { c, stop() { for (const k in orig) gl[k] = orig[k]; } };
  }

  window.__perfReplay = (b64, opts = {}) => new Promise((resolve, reject) => {
    const { warmupMs = 3000, gl = true, censusEveryMs = 500, census: doCensus = true } = opts;
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dv = new DataView(bytes.buffer), recs = [];
    for (let o = 0; o < bytes.length;) { const t = dv.getUint32(o, true) / 10, n = dv.getUint32(o + 4, true); recs.push([t, bytes.buffer.slice(o + 8, o + 8 + n)]); o += 8 + n; }
    const game = window.__game, ws = game.conn?.ws;
    if (!ws) { reject(new Error('no live connection to replay into')); return; }
    const deliver = ws.__hfDeliver ??= ws.onmessage; // the client's own handler (kept across repeated replays)
    ws.onmessage = () => {}; // drop live traffic; the recording is the only input from here on
    game.world.offsetInit = false; // re-sync the snapshot clock to the recording
    const t0 = performance.now(), end = recs[recs.length - 1][0];
    let i = 0;
    const pump = () => {
      const now = performance.now() - t0;
      try { while (i < recs.length && recs[i][0] <= now) deliver.call(ws, { data: recs[i++][1] }); } catch (e) { reject(e); return; }
      if (i < recs.length) setTimeout(pump, Math.max(0, recs[i][0] - now));
    };
    pump();
    // Measurement window: after the warm-up, until the last message.
    const frames = [], samples = []; let counters = null, started = false, last = 0, lastCensus = 0, allFrames = 0;
    const tick = (t) => {
      const el = t - t0; allFrames++;
      if (el >= warmupMs) {
        if (!started) { started = true; if (gl) counters = glCounters(); last = t; lastCensus = t - censusEveryMs; }
        else frames.push(t - last);
        last = t;
        if (doCensus && t - lastCensus >= censusEveryMs) { samples.push(census()); lastCensus = t; }
      }
      if (el < end) { requestAnimationFrame(tick); return; }
      counters?.stop();
      const n = frames.length || 1, s = [...frames].sort((x, y) => x - y), q = (p) => +(s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0).toFixed(1);
      const avg = (k) => samples.length ? +(samples.reduce((x, y) => x + y[k], 0) / samples.length).toFixed(1) : 0;
      const mx = (k) => samples.length ? Math.max(...samples.map((x) => x[k])) : 0;
      const per = (k) => counters ? +(counters.c[k] / n).toFixed(1) : 0;
      resolve({
        frames: frames.length, allFrames, seconds: +((end - warmupMs) / 1000).toFixed(1), hidden: document.hidden,
        fps: +(1000 / (frames.reduce((x, y) => x + y, 0) / n)).toFixed(1), p50: q(0.5), p95: q(0.95), p99: q(0.99),
        drawCalls: per('draw'), textureBinds: per('bindTexture'), textureUploads: +(counters ? (counters.c.texImage2D + counters.c.texSubImage2D) / n : 0).toFixed(2),
        bufferKB: counters ? +(counters.c.bufferBytes / n / 1024).toFixed(1) : 0, bufferUploads: per('bufferUploads'), programs: per('useProgram'),
        visible: avg('visible'), visibleMax: mx('visible'), renderables: avg('renderables'), renderablesMax: mx('renderables'),
        graphics: avg('graphics'), additive: avg('add'), nodes: avg('nodes'), mobs: avg('mobs'), samples: samples.length,
      });
    };
    requestAnimationFrame(tick);
  });
  return true;
})();
