// Shared building blocks: the ornate panel frame, bars, cost rows, tabs, checkbox.

import type { ComponentChildren } from 'preact';
import { toChildArray } from 'preact';
import { useState } from 'preact/hooks';
import { fmtInt } from '@shared/format';
import type { Cost } from '@shared/cube';
import type { CharacterSave, Materials, MaterialId } from '@shared/types';
import { panelIntro, togglePanel, useUI, type PanelId } from '../store';
import { GoldIcon, IconCheck, IconClose, MatIcon, MATERIAL_INFO, MATERIAL_ORDER } from './icons';
import { hideTip, textTipHandlers } from './tooltip';
import { cls } from './util';
import { useLocal } from './state';
import { bindings, type Action } from '../../game/bindings';
import { UiIcon, type UiIconName } from '../hud/UiIcons';

/** Bounded visible lists. All entries stay reachable without a scrolling menu. */
export function Paged({children,size=6,initial=0,label='Pages',class:c}:{children:ComponentChildren;size?:number;initial?:number;label?:string;class?:string}) {
  const entries=toChildArray(children),pages=Math.max(1,Math.ceil(entries.length/size));
  const [requested,setPage]=useState(initial),page=Math.max(0,Math.min(requested,pages-1));
  return <div class={cls('paged',c)}>
    <div class="page-items">{entries.slice(page*size,(page+1)*size)}</div>
    {pages>1&&<nav class="page-nav" aria-label={label}>
      <button class="btn sm" disabled={page===0} onClick={()=>setPage(page-1)}>Previous</button>
      <span role="status">{page+1} / {pages}</span>
      <button class="btn sm" disabled={page===pages-1} onClick={()=>setPage(page+1)}>Next</button>
    </nav>}
  </div>;
}

/** Default title medallion per panel (original icon set). */
const PANEL_ICON: Partial<Record<PanelId, UiIconName>> = {
  inventory: 'bag', skills: 'skills', paragon: 'paragon', cube: 'cube', waypoint: 'waypoint', obelisk: 'obelisk', help: 'help',
  debug: 'wrench', stash: 'stash', settings: 'settings', adventure: 'journal', worldmap: 'map', runSummary: 'hourglass',
  character: 'character', merchant: 'merchant', party: 'party', social: 'social', inspect: 'inspect', community: 'shield',
  collection: 'collection', dialogue: 'chat',
};
/** Panels with a keyboard shortcut show it in the title bar (labels follow the player's bindings). */
const PANEL_KEY: Partial<Record<PanelId, Action>> = { inventory: 'inventory', skills: 'skills', paragon: 'paragon', settings: 'settings', adventure: 'journal', worldmap: 'map', cube: 'cube' };

export function PanelFrame(p: {
  id: PanelId;
  title: string;
  children: ComponentChildren;
  width?: number;
  icon?: ComponentChildren;
  sub?: ComponentChildren;
  class?: string;
  footer?: ComponentChildren;
  onClose?: () => void;
}) {
  const action = PANEL_KEY[p.id];
  const key = useLocal(bindings, () => (action ? bindings.label(action) : ''));
  const iconName = PANEL_ICON[p.id];
  useUI((s) => s.char);
  const intro = panelIntro(p.id);
  const [hideIntro, setHideIntro] = useState(false);
  return (
    <section class={cls('pn frame interactive', `pn-${p.id}`, p.class)} style={p.width ? { width: p.width } : undefined} data-panel={p.id} role="dialog" aria-label={p.title} onPointerDown={hideTip} onContextMenu={(e) => e.preventDefault()}>
      <header class="pn-head">
        <span class="pn-icon">{p.icon ?? (iconName ? <UiIcon name={iconName} size={22} /> : null)}</span>
        <div class="pn-titles">
          <h2 class="title-plate">{p.title}</h2>
          {p.sub && <span class="pn-sub">{p.sub}</span>}
        </div>
        {key && <kbd class="pn-key" title={`Shortcut: ${key}`}>{key}</kbd>}
        <button class="pn-close" aria-label="Close" title="Close (Esc)" onClick={() => { p.onClose?.(); togglePanel(p.id, false); }}>
          <IconClose size={12} />
        </button>
      </header>
      <div class="pn-body">
        {intro && !hideIntro && <div class="pn-intro" role="note"><UiIcon name="help" size={16} /><p>{intro}</p><button class="btn sm quiet" onClick={() => setHideIntro(true)}>Got it</button></div>}
        {p.children}
      </div>
      {p.footer && <footer class="pn-foot">{p.footer}</footer>}
    </section>
  );
}

/** Inset section with a caps header and optional right-aligned meta. */
export function Card({ title, meta, children, class: c }: { title?: ComponentChildren; meta?: ComponentChildren; children: ComponentChildren; class?: string }) {
  return (
    <section class={cls('card', c)}>
      {(title || meta) && <header class="card-h"><span>{title}</span>{meta && <em>{meta}</em>}</header>}
      {children}
    </section>
  );
}

/** Section heading with flanking hairlines. */
export function SecHead({ children, right }: { children: ComponentChildren; right?: ComponentChildren }) {
  return (
    <div class="sec-h">
      <span>{children}</span>
      {right && <em>{right}</em>}
    </div>
  );
}

export function Bar({ frac, text, tone = 'xp', height = 16 }: { frac: number; text?: ComponentChildren; tone?: 'xp' | 'violet' | 'life'; height?: number }) {
  const f = Math.max(0, Math.min(1, frac));
  return (
    <div class={cls('bar', `bar-${tone}`)} style={{ height }}>
      <div class="bar-fill" style={{ width: `${(f * 100).toFixed(2)}%` }} />
      <div class="bar-ticks" />
      {text !== undefined && <span class="bar-text">{text}</span>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, class: c }: {
  tabs: { id: T; label: ComponentChildren; badge?: ComponentChildren; locked?: string; color?: string }[];
  value: T;
  onChange: (id: T) => void;
  class?: string;
}) {
  return (
    <div class={cls('tabs', c)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === value}
          class={cls('tab', t.id === value && 'on', t.locked && 'locked')}
          style={t.color ? { '--tab-c': t.color } : undefined}
          onClick={() => !t.locked && onChange(t.id)}
        >
          <span class="tab-l">{t.label}</span>
          {t.badge !== undefined && <span class="tab-b">{t.badge}</span>}
          {t.locked && <span class="tab-lock">{t.locked}</span>}
        </button>
      ))}
    </div>
  );
}

export function Check({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ComponentChildren }) {
  return (
    <label class={cls('chk', on && 'on')} onClick={(e) => { e.preventDefault(); onChange(!on); }}>
      <span class="chk-box">{on && <IconCheck size={11} />}</span>
      <span class="chk-l">{children}</span>
    </label>
  );
}

/** Gold + material costs. Short ones are red (the player cannot afford them). */
export function CostList({ cost, char, size = 20 }: { cost: Cost; char: CharacterSave; size?: number }) {
  const mats = (Object.entries(cost.mats) as [MaterialId, number][]).filter(([, v]) => v > 0);
  return (
    <div class="costs">
      {cost.gold > 0 && (
        <span class={cls('cost', char.gold < cost.gold && 'short')}>
          <GoldIcon size={size} />
          <b>{fmtInt(cost.gold)}</b>
        </span>
      )}
      {mats.map(([k, v]) => {
        const have = char.materials[k] ?? 0;
        return (
          <span class={cls('cost', have < v && 'short')} key={k} {...textTipHandlers(() => ({ title: MATERIAL_INFO[k].name, color: MATERIAL_INFO[k].color, icon: <MatIcon id={k} size={34} />, sub: `You have ${fmtInt(have)}` }), `cost-${k}`)}>
            <MatIcon id={k} size={size} />
            <b>{fmtInt(v)}</b>
            {have < v && <small>you have {fmtInt(have)}</small>}
          </span>
        );
      })}
      {cost.gold === 0 && mats.length === 0 && <span class="cost free">No cost</span>}
    </div>
  );
}

export function Wealth({ char, compact }: { char: CharacterSave; compact?: boolean }) {
  return (
    <div class={cls('wealth', compact && 'compact')}>
      <div class="gold-chip" {...textTipHandlers(() => ({ title: 'Gold', color: '#f2d58c', icon: <GoldIcon size={30} />, sub: fmtInt(char.gold) }), 'gold')}>
        <GoldIcon size={20} />
        <b>{fmtInt(char.gold)}</b>
      </div>
      <div class="mats">
        {MATERIAL_ORDER.map((m) => {
          const info = MATERIAL_INFO[m];
          const n = (char.materials as Materials)[m] ?? 0;
          return (
            <div class={cls('mat', n === 0 && 'zero')} key={m} {...textTipHandlers(() => ({ title: info.name, color: info.color, icon: <MatIcon id={m} size={34} />, sub: `You have ${fmtInt(n)}`, lines: [info.desc], note: info.source }), `mat-${m}`)}>
              <MatIcon id={m} size={20} />
              <b>{n >= 100000 ? `${(n / 1000).toFixed(0)}K` : fmtInt(n)}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}
