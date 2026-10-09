import type { Item } from '@shared/types';
import { invUI } from './cubestate';
import { useLocal } from './state';
import { cls, run } from './util';
import { hideTip, textTipHandlers } from './tooltip';

export function toggleItemProtection(item: Item): void {
  hideTip(); void run('itemProtect', { itemId: item.id, protected: !item.protected });
}
export function ProtectionButton() {
  const on = useLocal(invUI, s => s.protectMode);
  return <button class={cls('btn sm', on && 'on')} aria-pressed={on} aria-label={on ? 'Finish protecting items' : 'Protect items'}
    onClick={() => invUI.set({ protectMode: !on, salvageMenu: false, confirm: null })}
    {...textTipHandlers(() => ({ title: 'Item protection', lines: ['Turn on, then click a bag, worn or stash item to protect or unprotect it.', 'Protected items cannot be destroyed, salvaged, transmuted, extracted, reforged or delivered.', 'Equipping, storage, enchanting, empowering and socket changes still work.'] }), 'item-protection')}>
    {on ? 'Done' : 'Protect'}
  </button>;
}
export function ProtectionBadge({ item }: { item: Item }) {
  if (!item.protected) return null;
  return <span class="item-protected" title="Protected" aria-label="Protected">
    <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true"><path d="M3 5V3a2.5 2.5 0 015 0v2M2 5h7v6H2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg>
  </span>;
}
