// Stash: the vault in town. Items move by dragging between bag and stash or with a click. A filter row dims what you
// are not looking for; nothing is hidden or reordered, so slots stay where you put them.
// Tabs (F-ECO-08): 60-slot pages; the first is free, the next ones are bought with gold in order (shared/src/stash.ts).
// Deposits go to the open tab first; drop an item on another tab to move it there.

import { useState } from 'preact/hooks';
import { INVENTORY_COLS, STASH_SIZE } from '@shared/constants';
import { fmtCompact, fmtInt } from '@shared/format';
import { MAX_STASH_TABS, nextStashTabPrice, stashTabs } from '@shared/stash';
import type { Item } from '@shared/types';
import { ui } from '../store';
import { CostList, PanelFrame } from './common';
import { useLocal, useU } from './state';
import { ItemVisual, itemHover } from './tooltip';
import { cls, rarityClass, run } from './util';
import { invUI, stashUI } from './cubestate';
import { ProtectionBadge, ProtectionButton, toggleItemProtection } from './itemProtection';
import { beginDrag, canDropOn, justDragged, useDrag } from './dnd';
import { UiIcon } from '../hud/UiIcons';
import { RarityMark } from './rarityMark';

type Filter = 'all' | 'weapons' | 'armor' | 'jewelry' | 'legendary';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'weapons', label: 'Weapons' }, { id: 'armor', label: 'Armor' },
  { id: 'jewelry', label: 'Jewelry' }, { id: 'legendary', label: 'Legendary & Set' },
];
/** 170K, 1.1M, 2.4M: the compact number without trailing zeros (prices have two significant figures). */
const price2 = (n: number) => fmtCompact(n).replace(/\.(\d*?)0+(?=[A-Za-z]+$)/, (_m, d: string) => (d ? `.${d}` : ''));
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const ARMOR_KINDS = new Set(['head', 'shoulders', 'chest', 'hands', 'wrists', 'waist', 'legs', 'feet']);
function matches(item: Item, f: Filter): boolean {
  switch (f) {
    case 'all': return true;
    case 'weapons': return item.kind === 'weapon1h' || item.kind === 'weapon2h' || item.kind === 'offhand';
    case 'armor': return ARMOR_KINDS.has(item.kind);
    case 'jewelry': return item.kind === 'neck' || item.kind === 'ring';
    case 'legendary': return item.rarity === 'legendary' || item.rarity === 'set';
  }
}

export function StashPanel() {
  const char = useU(s => s.char), [busy, setBusy] = useState(false), [filter, setFilter] = useState<Filter>('all');
  const protectMode = useLocal(invUI, s => s.protectMode);
  const openTab = useLocal(stashUI, s => s.tab), buying = useLocal(stashUI, s => s.buying);
  const drag = useDrag();
  if (!char) return null;
  const stash = char.stash ?? [];
  const owned = stashTabs(char), capacity = owned * STASH_SIZE;
  // Pages beyond the owned tabs only exist in a damaged save; they stay visible (withdraw only) so nothing is hidden.
  const pages = Math.max(owned, Math.ceil(stash.length / STASH_SIZE));
  const tab = Math.min(openTab, pages - 1), base = tab * STASH_SIZE;
  const usedIn = (t: number) => stash.slice(t * STASH_SIZE, (t + 1) * STASH_SIZE).filter(Boolean).length;
  const used = stash.filter(Boolean).length, tabUsed = usedIn(tab);
  const price = nextStashTabPrice(char);
  const act = async (op: 'stashWithdraw' | 'stashBuyTab', args: Record<string, unknown>) => {
    if (busy) return; setBusy(true);
    try { await run(op, args); } finally { setBusy(false); }
  };
  const buy = async () => {
    if (price === null) return;
    await act('stashBuyTab', { tab: owned + 1, price });
    if (stashTabs(ui.get().char ?? char) > owned) stashUI.set({ tab: owned, buying: false });
  };
  const counts = (f: Filter) => stash.slice(base, base + STASH_SIZE).filter(i => i && matches(i, f)).length;
  const dropOk = canDropOn(drag, 'stash');
  const lockedAfter = Math.max(0, MAX_STASH_TABS - owned - (price !== null ? 1 : 0) - Math.max(0, pages - owned));
  return <PanelFrame id="stash" title="Stash" width={560} sub={<span class="pn-lv">{char.name} · {used}/{capacity}</span>}>
    <div class="st-top">
      <div class="st-cap" title={`${tabUsed} of ${STASH_SIZE} slots used in tab ${ROMAN[tab]}; ${used} of ${capacity} in all tabs`}>
        <UiIcon name="stash" size={26} />
        <div><b>{tabUsed}<small> / {STASH_SIZE}</small></b><span>tab {ROMAN[tab]} · {used}/{capacity} in all</span></div>
        <div class="st-cap-bar"><i style={{ width: `${Math.min(100, (tabUsed / STASH_SIZE) * 100)}%` }} /></div>
      </div>
      <div class="st-actions">
        <ProtectionButton />
      </div>
    </div>
    <div class="st-tabs" role="tablist" aria-label="Stash tabs">
      {Array.from({ length: pages }, (_, t) => {
        const target = `stashtab:${t}`, over = t >= owned;
        return <button key={t} role="tab" aria-selected={t === tab} data-drop={over ? undefined : target}
          class={cls('st-tab', t === tab && 'on', over && 'over', !over && drag && canDropOn(drag, target) && 'drop-ok')}
          title={over ? 'Items outside your owned tabs: take them out' : `Tab ${ROMAN[t]}: ${usedIn(t)} of ${STASH_SIZE} used`}
          onClick={() => stashUI.set({ tab: t, buying: false })}>
          <b>{ROMAN[t] ?? t + 1}</b><small>{usedIn(t)}/{STASH_SIZE}</small>
        </button>;
      })}
      {price !== null && <button class={cls('st-tab', 'st-tab-buy', buying && 'on')} aria-expanded={buying}
        title={`Add tab ${ROMAN[owned]} for ${fmtInt(price)} gold`} onClick={() => stashUI.set({ buying: !buying })}>
        <b><UiIcon name="lock" size={13} />{ROMAN[owned]}</b><small>{price2(price)}</small>
      </button>}
      {Array.from({ length: lockedAfter }, (_, k) =>
        <span key={`l${k}`} class="st-tab locked" aria-hidden="true"><b>{ROMAN[owned + 1 + k]}</b><small>locked</small></span>)}
    </div>
    {buying && price !== null
      ? <div class="st-buy" role="group" aria-label={`Buy stash tab ${ROMAN[owned]}`}>
          <div class="st-buy-t"><b>Tab {ROMAN[owned]}</b><span>{STASH_SIZE} more slots for {char.name}</span></div>
          <CostList cost={{ gold: price, mats: {} }} char={char} />
          <button class="btn primary" disabled={busy || char.gold < price} onClick={() => void buy()}>{char.gold < price ? 'Not enough gold' : `Buy tab ${ROMAN[owned]}`}</button>
          <button class="btn" onClick={() => stashUI.set({ buying: false })}>Cancel</button>
        </div>
      : <div class="st-filters" role="tablist" aria-label="Stash filter">
          {FILTERS.map(f => <button key={f.id} role="tab" aria-selected={filter === f.id} class={cls('st-chip', filter === f.id && 'on')} onClick={() => setFilter(f.id)}>
            {f.label}{f.id !== 'all' && <em>{counts(f.id)}</em>}
          </button>)}
        </div>}
    <div class={cls('st-grid-wrap', dropOk && 'drop-ok', drag && !dropOk && drag.kind !== 'stash' && 'drop-no')} data-drop="stash">
      <div class="bag st-grid" style={{ gridTemplateColumns: `repeat(${INVENTORY_COLS}, 1fr)` }}>
        {Array.from({ length: STASH_SIZE }, (_, k) => {
          const i = base + k, item = stash[i];
          const dim = !!item && filter !== 'all' && !matches(item, filter);
          return <button key={i} class={cls('cell', item ? rarityClass(item) : 'empty', dim && 'st-dim')} disabled={busy || !item}
            aria-label={item ? `${protectMode ? item.protected ? 'Unprotect' : 'Protect' : 'Withdraw'} ${item.name}` : `Empty slot ${k + 1} of tab ${ROMAN[tab]}`}
            onPointerDown={item && !protectMode ? (e) => beginDrag(e as PointerEvent, { kind: 'stash', index: i, item }) : undefined}
            onClick={() => { if (!item || justDragged()) return; if (protectMode) toggleItemProtection(item); else void act('stashWithdraw', { itemId: item.id }); }}
            {...itemHover(() => ui.get().char?.stash?.[i] ?? null)}>
            {item && <ItemVisual item={item} size={32} />}
            {item && <ProtectionBadge item={item} />}
            {item && <RarityMark item={item} />}
          </button>;
        })}
      </div>
      {drag?.kind === 'bag' && <div class="st-drop-hint">Drop to store in tab {ROMAN[tab]}</div>}
    </div>
    <p class="st-hint">{protectMode
      ? 'Click an item to protect or unprotect it.'
      : used === 0 ? 'Empty. Drag items here from your bag, or click them in your bag while the stash is open.'
      : owned > 1 ? 'Items go to the open tab first. Drag an item onto another tab to move it; click to take it out.'
      : 'Drag between bag and stash, or click an item to move it. Equipped gear must be unequipped first.'}</p>
  </PanelFrame>;
}
