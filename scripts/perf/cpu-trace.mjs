// Thread CPU time from a Chrome trace ('toplevel' category): the sum of top-level task CPU time (`tdur`, thread time,
// so other processes on a shared machine do not inflate it) per thread, for the renderer main thread, the GPU process
// main thread and the display compositor. Used by the client performance gate and the A/B runs (docs/rework/PERF.md).
export async function traceCpu(api, run) {
  const events = [];
  let done = null; const complete = new Promise((r) => { done = r; });
  api.onCdp((m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); if (m.method === 'Tracing.tracingComplete') done?.(); });
  await api.cdp('Tracing.start', { categories: 'toplevel', transferMode: 'ReportEvents' });
  const result = await run();
  await api.cdp('Tracing.end');
  await complete; done = null;
  const threads = new Map();
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') threads.set(`${e.pid}:${e.tid}`, e.args.name);
  const name = { CrRendererMain: 'main', CrGpuMain: 'gpu', VizCompositorThread: 'viz' };
  const slices = events.filter((e) => e.ph === 'X' && e.dur > 0 && name[threads.get(`${e.pid}:${e.tid}`)]).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const cpu = {}, wall = {}, openUntil = new Map();
  for (const e of slices) {
    const k = `${e.pid}:${e.tid}`;
    if (e.ts < (openUntil.get(k) ?? -1)) continue; // nested inside a slice already counted
    openUntil.set(k, e.ts + e.dur);
    const key = name[threads.get(k)];
    cpu[key] = (cpu[key] ?? 0) + (e.tdur ?? e.dur) / 1000;
    wall[key] = (wall[key] ?? 0) + e.dur / 1000;
  }
  return { result, cpuMs: cpu, wallMs: wall };
}
