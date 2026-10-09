import { useState } from 'preact/hooks';
import { INVENTORY_COLS, STASH_SIZE } from '@shared/constants';
import { ui } from '../store';
import { PanelFrame } from './common';
import { useLocal, useU } from './state';
import { ItemVisual, itemHover } from './tooltip';
import { cls, rarityClass, run } from './util';
import { invUI } from './cubestate';
import { ProtectionBadge, ProtectionButton, toggleItemProtection } from './itemProtection';

export function StashPanel() {
  const char = useU(s => s.char), [busy, setBusy] = useState(false);
  const protectMode = useLocal(invUI, s => s.protectMode);
  if (!char) return null;
  const stash = char.stash ?? [];
  const withdraw = async (itemId: string) => {
    if (busy) return; setBusy(true);
    try { await run('stashWithdraw', { itemId }); } finally { setBusy(false); }
  };
  return <PanelFrame id="stash" title="Stash" width={466} sub={<span class="pn-lv">{char.name} · {stash.filter(Boolean).length}/{STASH_SIZE}</span>}>
    <div class="cw-note">Click an item in your bag to store it. Click a stored item to withdraw it. Equipment must be unequipped first.</div>
    <div class="bag-bar"><span>{protectMode ? 'Click an item to protect or unprotect it.' : 'Protected items can still be stored and withdrawn.'}</span><ProtectionButton /></div>
    <div class="bag-wrap"><div class="bag" style={{ gridTemplateColumns: `repeat(${INVENTORY_COLS}, 1fr)` }}>
      {Array.from({ length: Math.max(STASH_SIZE, stash.length) }, (_, i) => {
        const item = stash[i];
        return <button key={i} class={cls('cell', item ? rarityClass(item) : 'empty')} disabled={busy || !item}
          aria-label={item ? `${protectMode ? item.protected ? 'Unprotect' : 'Protect' : 'Withdraw'} ${item.name}` : `Empty stash slot ${i + 1}`}
          onClick={() => { if (item) { if (protectMode) toggleItemProtection(item); else void withdraw(item.id); } }} {...itemHover(() => ui.get().char?.stash?.[i] ?? null)}>
          {item && <ItemVisual item={item} size={32} />}
          {item && <ProtectionBadge item={item} />}
        </button>;
      })}
    </div></div>
  </PanelFrame>;
}
