// Training-dummy bench (build tools T3, docs/rework/depth/BUILD-TOOLS.md): pick a length, start, hit the town's
// dummies, read the per-skill result. The server measures everything (op `bench`, server/src/sim/bench.ts); this
// window and the HUD readout only show it. Nothing scrolls: the split shows the largest eight strikes, the rest in a
// "+N more" line with its tooltip.

import { useEffect, useState } from 'preact/hooks';
import { SKILLS } from '@shared/data/skills';
import { GROUND_DEFS } from '@shared/data/grounds';
import { SUB_STRIKES } from '@shared/powers';
import { LEGENDARIES } from '@shared/data/items';
import type { BenchView } from '@shared/buildSheet';
import { fmtInt } from '@shared/format';
import { cmd } from '../../net/api';
import { PanelFrame } from './common';
import { Local, useLocal, useU } from './state';
import { fmtHit } from './sheet';
import { textTipHandlers } from './tooltip';
import { cls, run } from './util';

export const benchStore = new Local<{ view: BenchView | null; length: number }>({ view: null, length: 60 });

let polling: ReturnType<typeof setInterval> | null = null;
/** Poll the server twice a second while a test is armed or running (and once more when it ends). */
export function pollBench() {
  if (polling) return;
  const tick = async () => {
    const r = await cmd<BenchView | null>('bench', { action: 'status' });
    const view = r.ok ? r.data ?? null : null;
    benchStore.set({ view });
    if (!view || view.state === 'done') { if (polling) clearInterval(polling); polling = null; }
  };
  polling = setInterval(() => void tick(), 500);
  void tick();
}

const pretty = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
/** Display name of a strike id: a skill, a sub-strike of one, a data ground, a legendary's proc, else the id. */
export function strikeName(id: string): string {
  if (SKILLS[id]) return SKILLS[id].name;
  if (Object.hasOwn(SUB_STRIKES, id)) return `${SKILLS[SUB_STRIKES[id].owner]?.name ?? ''}: ${pretty(id)}`;
  if (GROUND_DEFS[id]) return GROUND_DEFS[id].name;
  const leg = Object.values(LEGENDARIES).find((l) => l.effects.some((e) => e.kind === 'proc' && e.strike?.id === id));
  return leg ? `${leg.name} (proc)` : pretty(id);
}

/** Plain-text result for chat or notes (the build code joins it when build codes exist). */
export function benchText(v: BenchView): string {
  const rows = v.skills.slice(0, 6).map((s) => `${strikeName(s.id)} ${fmtHit(s.dps)}/s`).join(', ');
  return `Dummy test ${v.elapsedS}s: ${fmtHit(v.dps)} dps (${fmtHit(v.total)} total, crit ${v.critRate}%, dots ${v.dotShare}%). ${rows}`;
}

export function BenchPanel() {
  const { view, length } = useLocal(benchStore, (s) => s);
  const char = useU((s) => s.char);
  const [busy, setBusy] = useState(false);
  useEffect(() => { pollBench(); }, []);
  if (!char) return null;
  const act = async (action: 'start' | 'stop' | 'reset') => {
    setBusy(true);
    try { const r = await run<BenchView | null>('bench', { action, seconds: length }); if (r.ok) { benchStore.set({ view: r.data ?? null }); if (action === 'start') pollBench(); } }
    finally { setBusy(false); }
  };
  const live = view && view.state !== 'done';
  const shown = view?.skills.slice(0, 8) ?? [], more = (view?.skills.length ?? 0) - shown.length;
  return (
    <PanelFrame id="bench" title="Training dummies" width={640} sub="Measure what your build really deals — per skill, over a fixed time">
      <div class="bn-controls">
        <div class="co-seg" role="radiogroup" aria-label="Test length">
          {[30, 60, 120].map((s) => <button key={s} role="radio" aria-checked={length === s} class={cls(length === s && 'on')} disabled={!!live} onClick={() => benchStore.set({ length: s })}>{s} s</button>)}
        </div>
        <button class="btn primary sm" disabled={busy || !!live} onClick={() => void act('start')}>Start test</button>
        <button class="btn sm" disabled={busy || !live} onClick={() => void act('stop')}>Stop</button>
        <button class="btn sm" disabled={busy || !view} onClick={() => void act('reset')}>Clear</button>
        {view?.state === 'done' && <button class="btn sm" onClick={() => void navigator.clipboard?.writeText(benchText(view))} {...textTipHandlers(() => ({ title: 'Copy result', lines: [benchText(view)] }), 'bn-copy')}>Copy result</button>}
      </div>
      {!view && <p class="pn-note">Stand beside a dummy, pick a length and start. The clock starts with your first hit on any dummy; everything you deal to the dummies counts — skills, their parts, procs, ground effects and damage over time. The elite dummy takes your bonus damage against elites.</p>}
      {view && <div class="bn-sum" role="status">
        <div class="bn-big"><span>{view.state === 'armed' ? 'Waiting for your first hit' : view.state === 'running' ? 'Testing' : 'Result'}</span><b>{view.state === 'armed' ? '—' : `${fmtHit(view.dps)}/s`}</b></div>
        <div class="bn-facts">
          <span>Time <b>{view.elapsedS} / {view.lengthS} s</b></span>
          <span>Total <b>{fmtHit(view.total)}</b></span>
          <span>Hits <b>{fmtInt(view.hits)}</b></span>
          <span>Crit rate <b>{view.critRate}%</b></span>
          <span>Damage over time <b>{view.dotShare}%</b></span>
          <span {...textTipHandlers(() => ({ title: 'Resource starved', lines: ['Share of the test you had less resource than your cheapest bar skill costs.'] }), 'bn-starve')}>Starved <b>{view.starvedPct}%</b></span>
        </div>
      </div>}
      {view && shown.length > 0 && <table class="bn-split">
        <thead><tr><th>Strike</th><th>Damage</th><th>Per second</th><th>Share</th></tr></thead>
        <tbody>{shown.map((s) => <tr key={s.id}><td>{strikeName(s.id)}</td><td>{fmtHit(s.total)}</td><td>{fmtHit(s.dps)}</td><td>
          <span class="bn-bar"><i style={{ width: `${view.total ? Math.round(s.total / view.total * 100) : 0}%` }} /></span>{view.total ? Math.round(s.total / view.total * 1000) / 10 : 0}%</td></tr>)}
          {more > 0 && <tr class="more"><td colSpan={4} {...textTipHandlers(() => ({ title: 'More strikes', lines: view.skills.slice(8).map((s) => `${strikeName(s.id)}: ${fmtHit(s.total)}`) }), 'bn-more')}>+{more} more strikes</td></tr>}
        </tbody>
      </table>}
      {view && view.buffs.length > 0 && <p class="bn-buffs"><span>Uptime</span>{view.buffs.map((b) => <em key={b.id}>{pretty(b.id)} {b.uptimePct}%</em>)}</p>}
    </PanelFrame>
  );
}

/** HUD readout while a test runs and the window is closed: text only, updated with each poll (no animation). */
export function BenchReadout() {
  const view = useLocal(benchStore, (s) => s.view);
  const open = useU((s) => s.panels.bench);
  if (!view || open || view.state === 'done') return null;
  return <div class="bn-readout" role="status">{view.state === 'armed' ? 'Dummy test armed — hit a dummy' : `Dummy test ${view.elapsedS}/${view.lengthS} s · ${fmtHit(view.dps)}/s`}</div>;
}
