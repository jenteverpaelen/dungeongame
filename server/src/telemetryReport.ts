// Turns the telemetry event log into a plain-language playtest report: how long levels took, where characters died,
// which quests dragged. Pure functions; scripts/analyze-telemetry.ts does the file reading.

import type { StoredEvent } from './telemetry';

const minutes = (ms: number) => ms / 60_000;
const fmt = (m: number) => (m >= 100 ? m.toFixed(0) : m.toFixed(1));
const median = (values: number[]) => {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b), mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

interface Hero {
  id: string; cls: string; fresh: boolean; logins: number; firstT: number; lastT: number;
  playMs: number; level: number; kills: number; deaths: number;
  levelAt: Map<number, number>;                 // level -> play ms when reached
  deathsByZone: Map<string, number>;
  quests: Map<string, { accepted?: number; claimed?: number; steps: number }>;
  sessions: number[];                            // wall-clock ms per login..logout
  openLogin?: number;
  afk: { reports: number; kills: number; levels: number };
}

export function summarize(events: StoredEvent[]): string {
  const heroes = new Map<string, Hero>();
  const hero = (id: string, t: number): Hero => {
    let h = heroes.get(id);
    if (!h) heroes.set(id, h = { id, cls: '?', fresh: false, logins: 0, firstT: t, lastT: t, playMs: 0, level: 1, kills: 0, deaths: 0,
      levelAt: new Map(), deathsByZone: new Map(), quests: new Map(), sessions: [], afk: { reports: 0, kills: 0, levels: 0 } });
    return h;
  };
  for (const ev of [...events].sort((a, b) => a.t - b.t)) {
    const h = hero(ev.c, ev.t);
    h.lastT = ev.t;
    h.playMs = Math.max(h.playMs, num(ev.playMs));
    h.level = Math.max(h.level, num(ev.lvl));
    switch (ev.e) {
      case 'login':
        h.logins++; h.cls = str(ev.cls) || h.cls; h.fresh ||= ev.fresh === true; h.openLogin = ev.t;
        if (num(ev.afkMs)) { h.afk.reports++; h.afk.kills += num(ev.afkKills); h.afk.levels += num(ev.afkLevels); }
        break;
      case 'logout':
        if (h.openLogin !== undefined) { h.sessions.push(ev.t - h.openLogin); h.openLogin = undefined; }
        h.kills = Math.max(h.kills, num(ev.kills)); h.deaths = Math.max(h.deaths, num(ev.deaths));
        break;
      case 'level':
        if (!h.levelAt.has(num(ev.lvl))) h.levelAt.set(num(ev.lvl), num(ev.playMs));
        h.kills = Math.max(h.kills, num(ev.kills)); h.deaths = Math.max(h.deaths, num(ev.deaths));
        break;
      case 'death': {
        const zone = str(ev.zone) || '?';
        h.deathsByZone.set(zone, (h.deathsByZone.get(zone) ?? 0) + Math.max(1, num(ev.n)));
        break;
      }
      case 'quest': {
        const q = h.quests.get(str(ev.q)) ?? { steps: 0 };
        const action = str(ev.a);
        if (action === 'accept') { q.accepted = num(ev.playMs); q.claimed = undefined; q.steps = 0; }
        else if (action === 'step') q.steps++;
        else if (action === 'claim') q.claimed = num(ev.playMs);
        h.quests.set(str(ev.q), q);
        break;
      }
      default:
    }
  }
  const list = [...heroes.values()];
  if (!list.length) return '# Playtest report\n\nNo telemetry events found. Start the server with `TELEMETRY=1`.\n';

  const out: string[] = ['# Playtest report', ''];
  const first = Math.min(...list.map(h => h.firstT)), last = Math.max(...list.map(h => h.lastT));
  out.push(`Events from ${new Date(first).toISOString()} to ${new Date(last).toISOString()}: ${events.length} events, ${list.length} character(s).`, '');

  out.push('## Characters', '', '| Character | Class | Level | Play time (min) | Kills | Deaths | Sessions | Avg session (min) | Offline reports |', '|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const h of list.sort((a, b) => b.playMs - a.playMs)) {
    out.push(`| ${h.id} | ${h.cls} | ${h.level} | ${fmt(minutes(h.playMs))} | ${h.kills} | ${h.deaths} | ${h.logins} | ${h.sessions.length ? fmt(minutes(median(h.sessions))) : '-'} | ${h.afk.reports} |`);
  }

  const marks = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
  const reached = marks.filter(l => list.some(h => h.levelAt.has(l)));
  if (reached.length) {
    out.push('', '## Play minutes to reach each level', '', `| Character | ${reached.map(l => `L${l}`).join(' | ')} |`, `|---|${reached.map(() => '---:').join('|')}|`);
    for (const h of list) out.push(`| ${h.id} | ${reached.map(l => (h.levelAt.has(l) ? fmt(minutes(h.levelAt.get(l)!)) : '-')).join(' | ')} |`);
    out.push('', `Median across characters: ${reached.map(l => {
      const m = median(list.filter(h => h.levelAt.has(l)).map(h => minutes(h.levelAt.get(l)!)));
      return `L${l} ${fmt(m)}`;
    }).join(', ')}.`);
  }

  const deaths = new Map<string, number>();
  for (const h of list) for (const [z, n] of h.deathsByZone) deaths.set(z, (deaths.get(z) ?? 0) + n);
  if (deaths.size) {
    out.push('', '## Deaths by zone', '', '| Zone | Deaths |', '|---|---:|');
    for (const [z, n] of [...deaths].sort((a, b) => b[1] - a[1])) out.push(`| ${z} | ${n} |`);
  }

  const quests = new Map<string, { durations: number[]; started: number; open: number; steps: number[] }>();
  for (const h of list) for (const [id, q] of h.quests) {
    const row = quests.get(id) ?? { durations: [], started: 0, open: 0, steps: [] };
    if (q.accepted !== undefined) row.started++;
    if (q.accepted !== undefined && q.claimed !== undefined) { row.durations.push(minutes(q.claimed - q.accepted)); row.steps.push(q.steps); }
    else if (q.accepted !== undefined) row.open++;
    quests.set(id, row);
  }
  if (quests.size) {
    out.push('', '## Quests (play minutes from accept to claim)', '', '| Quest | Started | Finished | Open | Median min | Slowest min | Median steps |', '|---|---:|---:|---:|---:|---:|---:|');
    for (const [id, r] of [...quests].sort((a, b) => median(b[1].durations) - median(a[1].durations) || b[1].open - a[1].open)) {
      out.push(`| ${id} | ${r.started} | ${r.durations.length} | ${r.open} | ${r.durations.length ? fmt(median(r.durations)) : '-'} | ${r.durations.length ? fmt(Math.max(...r.durations)) : '-'} | ${r.steps.length ? median(r.steps) : '-'} |`);
    }
  }
  out.push('');
  return out.join('\n');
}
