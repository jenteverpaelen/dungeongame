// Paragon (P): Diablo 3 2.0 style four-category point allocation with caps.

import { useState } from 'preact/hooks';
import { fmtInt } from '@shared/format';
import { MAX_LEVEL } from '@shared/constants';
import { PARAGON_CATEGORIES, PARAGON_STATS, paragonPoints, paragonSpent, paragonXpToNext, type ParagonStatDef } from '@shared/progression';
import type { CharacterSave, ParagonCategory } from '@shared/types';
import { useUI } from '../store';
import { Bar, PanelFrame, Tabs } from './common';
import { IconMinus, IconPlus, IconStar4, Medallion } from './icons';
import { textTipHandlers } from './tooltip';
import { cls, run } from './util';

function StatRow({ def, char, avail, color }: { def: ParagonStatDef; char: CharacterSave; avail: number; color: string }) {
  const spent = char.paragon.spent[def.id] ?? 0;
  const capped = def.cap > 0 && spent >= def.cap;
  const room = def.cap > 0 ? def.cap - spent : Infinity;
  const frac = def.cap > 0 ? spent / def.cap : Math.min(1, spent / 100);
  const step = (e: MouseEvent) => (e.shiftKey ? 10 : 1);
  const add = (e: MouseEvent) => { const n = Math.min(step(e), avail, room); if (n > 0) void run('paragon', { stat: def.id, n }); };
  const sub = (e: MouseEvent) => { const n = Math.min(step(e), spent); if (n > 0) void run('paragon', { stat: def.id, n: -n }); };
  return (
    <div class={cls('prow', capped && 'capped', spent === 0 && 'zero')} style={{ '--cc': color }}>
      <div class="prow-main">
        <div class="prow-name">
          <b>{def.label}</b>
          <span>{def.fmt(def.perPoint)} per point</span>
        </div>
        <div class="prow-val" {...textTipHandlers(() => ({ title: def.label, color, lines: [`${def.fmt(def.perPoint)} per point spent.`, def.cap > 0 ? `Capped at ${def.cap} points (${def.fmt(def.cap * def.perPoint)}).` : 'No cap: every point counts.'], note: 'Shift + click changes ten points at a time.' }), `pg-${def.id}`)}>
          <b>{def.fmt(spent * def.perPoint)}</b>
          {capped && <em>MAX</em>}
        </div>
      </div>
      <div class="prow-bar">
        <div class="pbar">
          <div class="pbar-fill" style={{ width: `${Math.min(100, frac * 100)}%` }} />
          <div class="pbar-ticks" />
          {def.cap > 0 && <i class="pbar-cap" />}
        </div>
        <span class="prow-pts"><b>{spent}</b>{def.cap > 0 ? <> / {def.cap}</> : <> / <span class="inf">∞</span></>}</span>
      </div>
      <div class="prow-btns">
        <button class="pbtn" aria-label="Remove point" disabled={spent === 0} onClick={(e) => sub(e as unknown as MouseEvent)}><IconMinus size={11} /></button>
        <button class="pbtn plus" aria-label="Add point" disabled={avail <= 0 || capped} onClick={(e) => add(e as unknown as MouseEvent)}><IconPlus size={11} /></button>
      </div>
    </div>
  );
}

export function ParagonPanel() {
  const char = useUI((s) => s.char);
  const [tab, setTab] = useState<ParagonCategory>('core');
  const [confirm, setConfirm] = useState(false);
  if (!char) return null;
  const level = char.paragon.level;
  const pts = paragonPoints(level);
  const tabs = PARAGON_CATEGORIES.map((c) => ({ id: c.id, label: c.label, color: c.color, badge: Math.max(0, pts[c.id] - paragonSpent(char, c.id)) }));
  const cat = PARAGON_CATEGORIES.find((c) => c.id === tab)!;
  const avail = Math.max(0, pts[tab] - paragonSpent(char, tab));
  const need = paragonXpToNext(level);
  const totalSpent = PARAGON_STATS.reduce((a, d) => a + (char.paragon.spent[d.id] ?? 0), 0);
  const atCap = char.level >= MAX_LEVEL;
  return (
    <PanelFrame id="paragon" title="Paragon" width={640}>
      <div class="pg-head">
        <Medallion size={64} tone="violet"><i>{level}</i></Medallion>
        <div class="pg-xp">
          <div class="pg-xp-t">
            <span>Paragon Level <b>{level}</b></span>
            <em>{atCap ? `${fmtInt(char.paragon.xp)} / ${fmtInt(need)} XP` : `Reach level ${MAX_LEVEL} to earn Paragon experience`}</em>
          </div>
          <Bar tone="violet" frac={atCap ? char.paragon.xp / need : 0} height={14} text={atCap ? `${((char.paragon.xp / need) * 100).toFixed(1)}%` : undefined} />
          <div class="pg-sub">
            <span><IconStar4 size={11} /> {fmtInt(totalSpent)} points spent</span>
            <span>Each level grants one point, rotating Core, Offense, Defense, Utility.</span>
          </div>
        </div>
      </div>
      <Tabs<ParagonCategory> class="pg-tabs" tabs={tabs} value={tab} onChange={setTab} />
      <div class="pg-body" style={{ '--cc': cat.color }}>
        <div class="pg-avail">
          <span class="pa-l">Available points</span>
          <b class={cls(avail === 0 && 'zero')}>{avail}</b>
          <span class="pa-hint">Shift + click: ten at a time</span>
        </div>
        <div class="prows">
          {PARAGON_STATS.filter((d) => d.category === tab).map((d) => <StatRow key={d.id} def={d} char={char} avail={avail} color={cat.color} />)}
        </div>
      </div>
      <div class="pg-foot">
        <span class="pg-foot-n">Caps at 50 points per stat; Primary Stat and Vitality are uncapped.</span>
        <button class={cls('btn sm', confirm && 'primary')} disabled={totalSpent === 0} onBlur={() => setConfirm(false)} onClick={() => { if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3200); } else { setConfirm(false); void run('paragonReset'); } }}>
          {confirm ? `Refund ${fmtInt(totalSpent)} points?` : 'Reset Paragon'}
        </button>
      </div>
    </PanelFrame>
  );
}
