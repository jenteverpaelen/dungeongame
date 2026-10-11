// Owner analytics (F-TEL-05): funnel and session views computed from the local event log, rendered as one
// self-contained HTML file (no scripts from anywhere else, no network, nothing leaves the machine). Pure functions;
// scripts/analyze-telemetry.ts reads the files. Field meanings: docs/rework/partials/TELEMETRY-SCHEMA.md.

import type { StoredEvent } from './telemetry';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
export const median = (values: number[]) => {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b), mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

export interface FunnelStep { id: string; label: string; reached: number }
export interface Analytics {
  from: number; to: number; events: number; characters: number; fresh: number;
  /** New characters reaching each milestone (only characters whose creation is in the log). */
  funnel: FunnelStep[];
  sessions: { count: number; medianMin: number; buckets: { label: string; count: number }[]; perCharacterMedian: number };
  returning: { secondSession: number; laterDay: number; of: number };
  activeByDay: { day: string; characters: number }[];
  levelPace: { level: number; medianMin: number; n: number }[];
  deathsByZone: { zone: string; deaths: number }[];
}

const SESSION_BUCKETS: [string, number][] = [['under 5 min', 5], ['5–15 min', 15], ['15–30 min', 30], ['30–60 min', 60], ['1–2 h', 120], ['over 2 h', Infinity]];
const PACE_LEVELS = [2, 5, 10, 15, 20, 30, 40, 50, 60, 70];

export function analytics(input: StoredEvent[]): Analytics {
  const events = [...input].filter(e => e && typeof e.t === 'number' && typeof e.c === 'string').sort((a, b) => a.t - b.t);
  type Hero = { fresh: boolean; logins: number[]; sessions: number[]; open?: number; levelAt: Map<number, number>; questClaimed: boolean; days: Set<string> };
  const heroes = new Map<string, Hero>();
  const deaths = new Map<string, number>();
  for (const ev of events) {
    let h = heroes.get(ev.c);
    if (!h) heroes.set(ev.c, h = { fresh: false, logins: [], sessions: [], levelAt: new Map(), questClaimed: false, days: new Set() });
    h.days.add(day(ev.t));
    switch (ev.e) {
      case 'login': h.logins.push(ev.t); h.fresh ||= ev.fresh === true; h.open = ev.t; break;
      case 'logout': if (h.open !== undefined) { h.sessions.push(ev.t - h.open); h.open = undefined; } break;
      case 'level': if (!h.levelAt.has(num(ev.lvl))) h.levelAt.set(num(ev.lvl), num(ev.playMs)); break;
      case 'quest': if (str(ev.a) === 'claim') h.questClaimed = true; break;
      case 'death': deaths.set(str(ev.zone) || '?', (deaths.get(str(ev.zone) || '?') ?? 0) + Math.max(1, num(ev.n))); break;
      default:
    }
  }
  const list = [...heroes.values()], fresh = list.filter(h => h.fresh);
  const reached = (l: number) => fresh.filter(h => [...h.levelAt.keys()].some(x => x >= l)).length;
  const funnel: FunnelStep[] = [
    { id: 'created', label: 'Created a hero', reached: fresh.length },
    { id: 'l2', label: 'Reached level 2', reached: reached(2) },
    { id: 'l5', label: 'Reached level 5', reached: reached(5) },
    { id: 'quest', label: 'Finished a quest', reached: fresh.filter(h => h.questClaimed).length },
    { id: 'l10', label: 'Reached level 10', reached: reached(10) },
    { id: 'return', label: 'Came back for a 2nd session', reached: fresh.filter(h => h.logins.length >= 2).length },
    { id: 'l20', label: 'Reached level 20', reached: reached(20) },
  ];
  const all = list.flatMap(h => h.sessions);
  const buckets = SESSION_BUCKETS.map(([label]) => ({ label, count: 0 }));
  for (const ms of all) { const m = ms / 60_000; buckets[SESSION_BUCKETS.findIndex(([, max]) => m < max)].count++; }
  const days = new Map<string, Set<string>>();
  for (const [id, h] of heroes) for (const d of h.days) { const s = days.get(d) ?? new Set(); s.add(id); days.set(d, s); }
  return {
    from: events[0]?.t ?? 0, to: events.at(-1)?.t ?? 0, events: events.length, characters: list.length, fresh: fresh.length, funnel,
    sessions: { count: all.length, medianMin: median(all) / 60_000, buckets, perCharacterMedian: median(list.map(h => h.logins.length)) },
    returning: { secondSession: list.filter(h => h.logins.length >= 2).length, laterDay: list.filter(h => new Set(h.logins.map(day)).size >= 2).length, of: list.length },
    activeByDay: [...days].sort((a, b) => a[0].localeCompare(b[0])).map(([d, s]) => ({ day: d, characters: s.size })),
    levelPace: PACE_LEVELS.map(level => { const v = list.filter(h => h.levelAt.has(level)).map(h => h.levelAt.get(level)! / 60_000); return { level, medianMin: median(v), n: v.length }; }).filter(r => r.n > 0),
    deathsByZone: [...deaths].sort((a, b) => b[1] - a[1]).map(([zone, d]) => ({ zone, deaths: d })),
  };
}

// ─────────────────────────── HTML ───────────────────────────

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number, d = 1) => (Number.isNaN(n) ? '–' : n >= 100 ? Math.round(n).toLocaleString('en') : n.toFixed(d));
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');

/** Horizontal bars, one series: ≤24 px bars, 4 px rounded data end, value at the tip, a hover/focus tooltip per bar. */
function bars(rows: { label: string; value: number; tip: string; text: string }[], unit: string): string {
  if (!rows.length) return '<p class="empty">No data in this log yet.</p>';
  const max = Math.max(1, ...rows.map(r => r.value)), rowH = 30, labelW = 210, plotW = 520, h = rows.length * rowH + 8;
  const marks = rows.map((r, i) => {
    const w = Math.max(r.value > 0 ? 4 : 0, (r.value / max) * plotW), y = i * rowH + 6, bh = 20;
    const path = w <= 4 ? `M${labelW},${y}h${w}v${bh}h${-w}z`
      : `M${labelW},${y}h${w - 4}a4,4 0 0 1 4,4v${bh - 8}a4,4 0 0 1 -4,4h${-(w - 4)}z`;
    return `<g class="bar" tabindex="0" data-tip="${esc(r.tip)}"><rect class="hit" x="0" y="${i * rowH}" width="${labelW + plotW + 90}" height="${rowH}"/>`
      + `<text class="lab" x="${labelW - 10}" y="${y + 15}" text-anchor="end">${esc(r.label)}</text><path class="mark" d="${path}"/>`
      + `<text class="val" x="${labelW + w + 8}" y="${y + 15}">${esc(r.text)}</text></g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${labelW + plotW + 110} ${h}" role="img" aria-label="${esc(unit)}"><line class="axis" x1="${labelW}" x2="${labelW}" y1="0" y2="${h}"/>${marks}</svg>`;
}
function table(head: string[], rows: (string | number)[][]): string {
  return `<details><summary>Table</summary><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
}

export function renderAnalyticsHtml(a: Analytics, title = 'Hearthfall playtest analytics'): string {
  const first = a.funnel[0]?.reached ?? 0;
  const tiles = [
    ['Characters in the log', String(a.characters)], ['New heroes', String(a.fresh)],
    ['Sessions', String(a.sessions.count)], ['Median session', `${fmt(a.sessions.medianMin)} min`],
    ['Came back (2+ sessions)', pct(a.returning.secondSession, a.returning.of)], ['Played on 2+ days', pct(a.returning.laterDay, a.returning.of)],
  ].map(([k, v]) => `<div class="tile"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  const range = a.events ? `${new Date(a.from).toISOString().slice(0, 16).replace('T', ' ')} – ${new Date(a.to).toISOString().slice(0, 16).replace('T', ' ')} UTC · ${a.events} events` : 'No events';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Playtest analytics</title>
<style>
.viz-root,:root{color-scheme:light;--surface-0:#f4f3ef;--surface-1:#fcfcfb;--line:#e4e2dc;--text-primary:#0b0b0b;--text-secondary:#52514e;--series-1:#2a78d6;--series-1-hi:#4b8fe0}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])),:root:where(:not([data-theme="light"])) .viz-root{color-scheme:dark;--surface-0:#121211;--surface-1:#1a1a19;--line:#2e2e2b;--text-primary:#ffffff;--text-secondary:#c3c2b7;--series-1:#3987e5;--series-1-hi:#5a9ded}}
:root[data-theme="dark"],:root[data-theme="dark"] .viz-root{color-scheme:dark;--surface-0:#121211;--surface-1:#1a1a19;--line:#2e2e2b;--text-primary:#ffffff;--text-secondary:#c3c2b7;--series-1:#3987e5;--series-1-hi:#5a9ded}
html,body{margin:0;background:var(--surface-0)}
.viz-root{font:15px/1.45 system-ui,"Segoe UI",sans-serif;color:var(--text-primary);background:var(--surface-0);padding:24px 16px 48px;max-width:980px;margin:0 auto}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:0 0 4px}p.sub{margin:0 0 18px;color:var(--text-secondary)}
.card{background:var(--surface-1);border:1px solid var(--line);border-radius:8px;padding:16px 18px;margin:0 0 16px}
.card p.note{margin:0 0 10px;color:var(--text-secondary);font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:0 0 16px}
.tile{background:var(--surface-1);border:1px solid var(--line);border-radius:8px;padding:10px 12px}.tile span{display:block;font-size:12px;color:var(--text-secondary)}.tile b{font-size:24px}
svg.chart{width:100%;height:auto;display:block}.axis{stroke:var(--line);stroke-width:1}
.lab{fill:var(--text-secondary);font-size:13px}.val{fill:var(--text-primary);font-size:13px;font-weight:600}.mark{fill:var(--series-1)}
.hit{fill:transparent}.bar:hover .mark,.bar:focus .mark{fill:var(--series-1-hi)}.bar:focus{outline:none}.bar:focus .lab{text-decoration:underline}
details{margin-top:8px}summary{cursor:pointer;color:var(--text-secondary);font-size:13px}
table{border-collapse:collapse;margin-top:6px;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:4px 10px;text-align:left}td:not(:first-child){text-align:right}
.empty{color:var(--text-secondary);margin:0}
#tip{position:fixed;pointer-events:none;background:var(--surface-1);color:var(--text-primary);border:1px solid var(--line);border-radius:6px;padding:6px 9px;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.18);display:none;max-width:280px}
footer{color:var(--text-secondary);font-size:12px}
</style></head><body><main class="viz-root">
<h1>${esc(title)}</h1><p class="sub">${esc(range)}. Local file only: built from this server's event log, nothing is uploaded.</p>
<div class="tiles">${tiles}</div>
<section class="card"><h2>New-hero funnel</h2><p class="note">Of the heroes created inside this log, how many reached each step (share of all new heroes).</p>
${bars(a.funnel.map(s => ({ label: s.label, value: s.reached, text: `${s.reached} · ${pct(s.reached, first)}`, tip: `${s.label}: ${s.reached} of ${first} (${pct(s.reached, first)})` })), 'New-hero funnel')}
${table(['Step', 'Heroes', 'Share'], a.funnel.map(s => [s.label, s.reached, pct(s.reached, first)]))}</section>
<section class="card"><h2>Session length</h2><p class="note">Wall-clock time from entering the world to leaving it.</p>
${bars(a.sessions.buckets.map(b => ({ label: b.label, value: b.count, text: String(b.count), tip: `${b.label}: ${b.count} session(s)` })), 'Session length')}
${table(['Length', 'Sessions'], a.sessions.buckets.map(b => [b.label, b.count]))}</section>
<section class="card"><h2>Play time to reach a level</h2><p class="note">Median active play minutes (all heroes that reached the level in this log).</p>
${bars(a.levelPace.map(r => ({ label: `Level ${r.level}`, value: r.medianMin, text: `${fmt(r.medianMin)} min`, tip: `Level ${r.level}: median ${fmt(r.medianMin)} min over ${r.n} hero(es)` })), 'Play time to level')}
${table(['Level', 'Median minutes', 'Heroes'], a.levelPace.map(r => [r.level, fmt(r.medianMin), r.n]))}</section>
<section class="card"><h2>Active heroes per day</h2><p class="note">Distinct heroes with any event on that UTC day.</p>
${bars(a.activeByDay.map(d => ({ label: d.day, value: d.characters, text: String(d.characters), tip: `${d.day}: ${d.characters} hero(es)` })), 'Active heroes per day')}
${table(['Day', 'Heroes'], a.activeByDay.map(d => [d.day, d.characters]))}</section>
<section class="card"><h2>Deaths by zone</h2>
${bars(a.deathsByZone.slice(0, 12).map(d => ({ label: d.zone, value: d.deaths, text: String(d.deaths), tip: `${d.zone}: ${d.deaths} death(s)` })), 'Deaths by zone')}
${table(['Zone', 'Deaths'], a.deathsByZone.map(d => [d.zone, d.deaths]))}</section>
<footer>Generated ${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))} UTC by scripts/analyze-telemetry.ts. Character ids are pseudonymous, not anonymous — share this file only with people who may see them.</footer>
<div id="tip" role="status"></div>
<script>
(function(){var tip=document.getElementById('tip');function show(g,x,y){tip.textContent=g.getAttribute('data-tip');tip.style.display='block';tip.style.left=Math.min(innerWidth-300,x+14)+'px';tip.style.top=(y+14)+'px';}
document.querySelectorAll('.bar').forEach(function(g){g.addEventListener('pointermove',function(e){show(g,e.clientX,e.clientY);});g.addEventListener('pointerleave',function(){tip.style.display='none';});
g.addEventListener('focus',function(){var r=g.getBoundingClientRect();show(g,r.left+40,r.top+10);});g.addEventListener('blur',function(){tip.style.display='none';});});})();
</script></main></body></html>`;
}
