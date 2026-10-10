// Stash: the vault in town. Items move by dragging between bag and stash or with a click. A filter row dims what you
// are not looking for; nothing is hidden or reordered, so slots stay where you put them.

import { useState } from 'preact/hooks';
import { INVENTORY_COLS, STASH_SIZE } from '@shared/constants';
import type { Item } from '@shared/types';
import { ui } from '../store';
import { PanelFrame } from './common';
import { useLocal, useU } from './state';
import { ItemVisual, itemHover } from './tooltip';
import { cls, rarityClass, run } from './util';
import { invUI } from './cubestate';
import { ProtectionBadge, ProtectionButton, toggleItemProtection } from './itemProtection';
import { beginDrag, canDropOn, justDragged, useDrag } from './dnd';
import { UiIcon } from '../hud/UiIcons';

type Filter = 'all' | 'weapons' | 'armor' | 'jewelry' | 'legendary';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'weapons', label: 'Weapons' }, { id: 'armor', label: 'Armor' },
  { id: 'jewelry', label: 'Jewelry' }, { id: 'legendary', label: 'Legendary & Set' },
];
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
  const drag = useDrag();
  if (!char) return null;
  const stash = char.stash ?? [];
  const used = stash.filter(Boolean).length;
  const slots = Math.max(STASH_SIZE, stash.length);
  const withdraw = async (itemId: string) => {
    if (busy) return; setBusy(true);
    try { await run('stashWithdraw', { itemId }); } finally { setBusy(false); }
  };
  const counts = (f: Filter) => stash.filter(i => i && matches(i, f)).length;
  const dropOk = canDropOn(drag, 'stash');
  return <PanelFrame id="stash" title="Stash" width={560} sub={<span class="pn-lv">{char.name} · {used}/{STASH_SIZE}</span>}>
    <div class="st-top">
      <div class="st-cap" title={`${used} of ${STASH_SIZE} slots used`}>
        <UiIcon name="stash" size={26} />
        <div><b>{used}<small> / {STASH_SIZE}</small></b><span>slots used</span></div>
        <div class="st-cap-bar"><i style={{ width: `${Math.min(100, (used / STASH_SIZE) * 100)}%` }} /></div>
      </div>
      <div class="st-actions">
        <ProtectionButton />
      </div>
    </div>
    <div class="st-filters" role="tablist" aria-label="Stash filter">
      {FILTERS.map(f => <button key={f.id} role="tab" aria-selected={filter === f.id} class={cls('st-chip', filter === f.id && 'on')} onClick={() => setFilter(f.id)}>
        {f.label}{f.id !== 'all' && <em>{counts(f.id)}</em>}
      </button>)}
    </div>
    <div class={cls('st-grid-wrap', dropOk && 'drop-ok', drag && !dropOk && drag.kind !== 'stash' && 'drop-no')} data-drop="stash">
      <div class="bag st-grid" style={{ gridTemplateColumns: `repeat(${INVENTORY_COLS}, 1fr)` }}>
        {Array.from({ length: slots }, (_, i) => {
          const item = stash[i];
          const dim = !!item && filter !== 'all' && !matches(item, filter);
          return <button key={i} class={cls('cell', item ? rarityClass(item) : 'empty', dim && 'st-dim')} disabled={busy || !item}
            aria-label={item ? `${protectMode ? item.protected ? 'Unprotect' : 'Protect' : 'Withdraw'} ${item.name}` : `Empty stash slot ${i + 1}`}
            onPointerDown={item && !protectMode ? (e) => beginDrag(e as PointerEvent, { kind: 'stash', index: i, item }) : undefined}
            onClick={() => { if (!item || justDragged()) return; if (protectMode) toggleItemProtection(item); else void withdraw(item.id); }}
            {...itemHover(() => ui.get().char?.stash?.[i] ?? null)}>
            {item && <ItemVisual item={item} size={32} />}
            {item && <ProtectionBadge item={item} />}
          </button>;
        })}
      </div>
      {drag?.kind === 'bag' && <div class="st-drop-hint">Drop to store</div>}
    </div>
    <p class="st-hint">{protectMode
      ? 'Click an item to protect or unprotect it.'
      : used === 0 ? 'Empty. Drag items here from your bag, or click them in your bag while the stash is open.' : 'Drag between bag and stash, or click an item to move it. Equipped gear must be unequipped first.'}</p>
  </PanelFrame>;
}
