// Paragon (P): four categories side by side, every stat visible at once, spend with + / Shift+click for ten.
// Diablo 3 2.0 rules (rotation Core -> Offense -> Defense -> Utility, caps at 50) are unchanged; only the surface is new.

import { useState } from 'preact/hooks';
import { fmtInt } from '@shared/format';
import { MAX_LEVEL } from '@shared/constants';
import { PARAGON_CATEGORIES, PARAGON_STATS, paragonPoints, paragonSpent, paragonXpToNext, type ParagonStatDef } from '@shared/progression';
import type { CharacterSave, ParagonCategory } from '@shared/types';
import { Bar, PanelFrame } from './common';
import { IconMinus, IconPlus, IconStar4, Medallion } from './icons';
import { StatIcon } from './statIcons';
import { textTipHandlers } from './tooltip';
import { useU } from './state';
import { cls, run } from './util';

const CATEGORY_NOTE: Record<ParagonCategory, string> = {
  core: 'Main stat, Vitality, speed and resource',
  offense: 'Haste, crits and cooldowns',
  defense: 'Life, armor and resistance',
  utility: 'Area, costs, sustain and gold',
};

function StatCard({ def, char, avail, color }: { def: ParagonStatDef; char: CharacterSave; avail: number; color: string }) {
  const spent = char.paragon.spent[def.id] ?? 0;
  const capped = def.cap > 0 && spent >= def.cap;
  const room = def.cap > 0 ? def.cap - spent : Infinity;
  const frac = def.cap > 0 ? spent / def.cap : Math.min(1, spent / 100);
  const step = (e: MouseEvent) => (e.shiftKey ? 10 : 1);
  const add = (e: MouseEvent) => { const n = Math.min(step(e), avail, room); if (n > 0) void run('paragon', { stat: def.id, n }); };
  const sub = (e: MouseEvent) => { const n = Math.min(step(e), spent); if (n > 0) void run('paragon', { stat: def.id, n: -n }); };
  const tip = () => ({
    title: def.label, color,
    lines: [`${def.fmt(def.perPoint)} per point spent.`, def.cap > 0 ? `Capped at ${def.cap} points (${def.fmt(def.cap * def.perPoint)}).` : 'No cap: every point counts.'],
    note: 'Shift + click changes ten points at a time',
  });
  return (
    <div class={cls('pg-stat', capped && 'capped', spent === 0 && 'zero')} {...textTipHandlers(tip, def.id)}>
      <span class="pg-ico"><StatIcon id={def.id} size={30} /></span>
      <div class="pg-stat-main">
        <b class="pg-stat-name">{def.label}</b>
        <div class="pg-stat-bar">
          <div class="pbar"><div class="pbar-fill" style={{ width: `${Math.min(100, frac * 100)}%` }} /><div class="pbar-ticks" />{def.cap > 0 && <i class="pbar-cap" />}</div>
          <span class="pg-stat-pts"><b>{spent}</b>{def.cap > 0 ? <> / {def.cap}</> : <> / <span class="inf">∞</span></>}</span>
        </div>
        <div class="pg-stat-line">
          <span class="pg-stat-val">{def.fmt(spent * def.perPoint)}{capped && <em>MAX</em>}</span>
          <span class="pg-stat-per">{def.fmt(def.perPoint)} per point</span>
        </div>
      </div>
      <div class="pg-stat-btns">
        <button class="pbtn plus" aria-label={`Add a point to ${def.label}`} disabled={avail <= 0 || capped} onClick={(e) => add(e as unknown as MouseEvent)}><IconPlus size={12} /></button>
        <button class="pbtn" aria-label={`Remove a point from ${def.label}`} disabled={spent === 0} onClick={(e) => sub(e as unknown as MouseEvent)}><IconMinus size={12} /></button>
      </div>
    </div>
  );
}

export function ParagonPanel() {
  const char = useU((s) => s.char);
  const [confirm, setConfirm] = useState(false);
  if (!char) return null;
  const level = char.paragon.level;
  const pts = paragonPoints(level);
  const need = paragonXpToNext(level);
  const totalSpent = PARAGON_STATS.reduce((a, d) => a + (char.paragon.spent[d.id] ?? 0), 0);
  const atCap = char.level >= MAX_LEVEL;
  const totalAvail = PARAGON_CATEGORIES.reduce((a, c) => a + Math.max(0, pts[c.id] - paragonSpent(char, c.id)), 0);
  return (
    <PanelFrame id="paragon" title="Paragon" width={1120}
      sub={totalAvail > 0 ? <span class="pn-lv">{totalAvail} unspent point{totalAvail === 1 ? '' : 's'}</span> : <span class="pn-lv">{fmtInt(totalSpent)} points spent</span>}>
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
      <div class="pg-cols">
        {PARAGON_CATEGORIES.map((c) => {
          const avail = Math.max(0, pts[c.id] - paragonSpent(char, c.id));
          return (
            <section class="pg-col" key={c.id} style={{ '--cc': c.color }}>
              <header class="pg-col-h">
                <div><h3>{c.label}</h3><span>{CATEGORY_NOTE[c.id]}</span></div>
                <div class={cls('pg-avail-n', avail === 0 && 'zero')} title="Points available in this category"><b>{avail}</b><small>to spend</small></div>
              </header>
              <div class="pg-col-body">
                {PARAGON_STATS.filter((d) => d.category === c.id).map((d) => <StatCard key={d.id} def={d} char={char} avail={avail} color={c.color} />)}
              </div>
            </section>
          );
        })}
      </div>
      <div class="pg-foot">
        <span class="pg-foot-n">Shift + click spends or refunds ten at a time. Caps at 50 points per stat; Primary Stat and Vitality are uncapped.</span>
        <button class={cls('btn sm', confirm && 'primary')} disabled={totalSpent === 0} onBlur={() => setConfirm(false)} onClick={() => {
          if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3200); } else { setConfirm(false); void run('paragonReset'); }
        }}>
          {confirm ? `Refund ${fmtInt(totalSpent)} points?` : 'Reset Paragon'}
        </button>
      </div>
    </PanelFrame>
  );
}
