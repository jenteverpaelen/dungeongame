// Camp merchant: buy basic class gear, sell from the bag, reclaim sold items. Left rail picks the trade and shows the
// purse, the centre grid lists offers (hover compares with what you wear, a green arrow marks an upgrade) and the right
// pane reviews one exact offer. Server operations, price/sequence checks and release confirmation are unchanged.

import { useMemo, useState } from 'preact/hooks';
import { BUYBACK_CAPACITY, MERCHANTS, merchantStock, salePrice, STOCK_LEVEL_CAP, validMerchant } from '@shared/merchant';
import { ADVENTURES } from '@shared/adventure';
import { canClassUse } from '@shared/items';
import { fmtInt } from '@shared/format';
import { compareItem } from '@shared/stats';
import type { CharacterSave, Item } from '@shared/types';
import { useUI } from '../store';
import { PanelFrame, Paged } from './common';
import { GoldIcon, IconDelta } from './icons';
import { ProtectionBadge } from './itemProtection';
import { ItemCard, ItemVisual, itemHover } from './tooltip';
import { cls, rarityClass, run, targetSlot } from './util';
import { UiIcon, type UiIconName } from '../hud/UiIcons';

type TradeTab = 'buy' | 'sell' | 'buyback';
const TABS: { id: TradeTab; label: string; icon: UiIconName }[] = [
  { id: 'buy', label: 'Buy gear', icon: 'merchant' },
  { id: 'sell', label: 'Sell gear', icon: 'bag' },
  { id: 'buyback', label: 'Buyback', icon: 'hourglass' },
];
const REVIEW: Record<TradeTab, string> = { buy: 'Review your purchase', sell: 'Review your sale', buyback: 'Recover your gear' };

function delta(char: CharacterSave, item: Item) {
  try { const c = compareItem(char, item, targetSlot(char, item)); return { damage: c.damage, toughness: c.toughness, recovery: c.recovery }; } catch { return null; }
}
/** Same rule as the bag's green arrow: raises Damage or Toughness without a large loss in the other. */
export function isGearUpgrade(char: CharacterSave, item: Item): boolean {
  if (item.reqLevel > char.level || !canClassUse(char.classId, item)) return false;
  const c = delta(char, item);
  return !!c && ((c.damage > 0.4 && c.toughness > -3) || (c.toughness > 0.4 && c.damage > -3 && c.damage + c.toughness > 1));
}

export function MerchantPanel() {
  const save = useUI(s => s.char), zone = useUI(s => s.zone), interact = useUI(s => s.interact);
  const [tab, setTab] = useState<TradeTab>('buy'), [selected, setSelected] = useState<{ id: string; sequence: number; price: number | null } | null>(null);
  const [release, setRelease] = useState(false), [busy, setBusy] = useState(false);
  const stock = useMemo(() => (save ? merchantStock(save) : []), [save?.level, save?.classId]);
  if (!save) return null;
  const def = MERCHANTS.find(m => m.zone === zone?.zone), npc = def && ADVENTURES[def.zone]?.npcs.find(n => n.id === def.target);
  const near = !!npc && interact?.name === npc.name, state = validMerchant(save.merchant) ? save.merchant : undefined;
  const offers = tab === 'buy' ? stock : tab === 'sell' ? save.inventory.flatMap(item => (item ? [{ item, price: salePrice(item) }] : [])) : state?.items ?? [];
  const offer = offers.find(e => e.item.id === selected?.id), unsupported = !!save.merchant && !state;
  const stale = selected && (selected.sequence !== (state?.sequence ?? 0) || selected.price !== offer?.price);
  const noRoom = tab !== 'sell' && !save.inventory.includes(null), poor = tab !== 'sell' && !!offer && save.gold < (offer.price ?? Infinity);
  const blocked = busy || !near || unsupported || !offer || offer.price === null || !!stale || (tab === 'sell' && !!offer.item.protected) || poor || noRoom;
  const retained = state?.items.length ?? 0;
  const trade = async (action: TradeTab | 'release') => {
    if (!offer || !def || !selected) return;
    setBusy(true);
    try {
      const result = await run('merchant', { merchant: def.id, action, itemId: offer.item.id, sequence: selected.sequence, price: selected.price, ...(action === 'release' ? { confirm: offer.item.id } : {}) });
      if (result.ok) { setSelected(null); setRelease(false); }
    } finally { setBusy(false); }
  };
  const pick = (tabId: TradeTab) => { setTab(tabId); setSelected(null); setRelease(false); };
  const sub = tab === 'buy' ? `Basic gear for your class · item level ${stock[0]?.item.ilvl ?? 1} (up to ${STOCK_LEVEL_CAP})`
    : tab === 'sell' ? 'Pick an item from your bag to review its offer.' : 'Buyback costs exactly what you received.';
  const empty = tab === 'sell' ? 'Your bag holds no gear to sell.' : 'Nothing is waiting in buyback.';
  const delt = offer && tab === 'buy' ? delta(save, offer.item) : null;
  return <PanelFrame id="merchant" title={def ? `${def.name}’s Gear Exchange` : 'Camp Gear Exchange'} sub="Frontier provisions" width={1060}>
    <div class="mx">
      <nav class="mx-rail" role="tablist" aria-label="Trade">
        {TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} class={cls('co-tab', tab === t.id && 'on')} onClick={() => pick(t.id)}>
          <UiIcon name={t.icon} size={20} /><span>{t.label}</span>{t.id === 'buyback' && <em>{retained}</em>}
        </button>)}
        <div class="mx-purse" aria-label={`${fmtInt(save.gold)} gold`}>
          <GoldIcon size={26} /><div><b>{fmtInt(save.gold)}</b><span>Gold</span></div>
        </div>
        <div class="mx-keep" title="Sold items stay in buyback until you reclaim or release them.">
          <div><span>Buyback holds</span><b>{retained}<small> / {BUYBACK_CAPACITY}</small></b></div>
          <div class="mx-keep-bar"><i style={{ width: `${Math.min(100, (retained / BUYBACK_CAPACITY) * 100)}%` }} /></div>
        </div>
        <p class="co-nav-note">Every purchase matches its preview. Merchant stock cannot be salvaged. Sold items stay in buyback until you reclaim or release them.</p>
      </nav>

      <section class="mx-main">
        <div class="co-bar"><h3>{TABS.find(t => t.id === tab)!.label}</h3><span class="co-sub">{sub}</span></div>
        {!near && <p class="so-warn" role="status">Stand beside a camp merchant to trade.</p>}
        {unsupported && <p class="so-warn" role="status">Your retained records use an unsupported format. They remain unchanged.</p>}
        {stale && <p class="so-warn" role="status">The offer changed. Select the item again to review it.</p>}
        {offers.length ? <Paged key={tab} size={15} class="mx-grid" label="Gear pages">
          {offers.map(e => {
            const on = selected?.id === e.item.id, up = tab === 'buy' && isGearUpgrade(save, e.item);
            return <button key={e.item.id} class={cls('mx-tile', on && 'on')} aria-pressed={on} aria-label={`${e.item.name}${up ? ', an upgrade' : ''}, ${e.item.protected ? 'protected' : `${e.price ?? 'unavailable'} gold`}`}
              onClick={() => { setSelected({ id: e.item.id, sequence: state?.sequence ?? 0, price: e.price }); setRelease(false); }}
              {...itemHover(() => e.item, { compare: tab === 'buy' })}>
              <span class={cls('cell', rarityClass(e.item))}>
                <ItemVisual item={e.item} size={44} />
                <ProtectionBadge item={e.item} />
                {up && <i class="cell-flag"><IconDelta up size={8} /></i>}
              </span>
              <b class={cls('mx-name', rarityClass(e.item))}>{e.item.name}</b>
              <span class="mx-price">{e.item.protected ? 'Protected' : e.price === null ? 'Unavailable' : <><GoldIcon size={14} />{fmtInt(e.price)}</>}</span>
            </button>;
          })}
        </Paged> : <div class="so-empty"><UiIcon name="merchant" size={38} /><b>{empty}</b><span>{tab === 'sell' ? 'Pick up gear in the field, then come back to sell it.' : 'Items you sell appear here until you reclaim them.'}</span></div>}
      </section>

      <aside class="mx-detail" aria-live="polite">
        {offer ? <>
          <div class="co-bar"><h3>{REVIEW[tab]}</h3></div>
          <div class="mx-buy">
            <div class="mx-total"><GoldIcon size={22} /><b class={cls(poor && 'short')}>{offer.price === null ? '—' : fmtInt(offer.price)}</b><span>{tab === 'sell' ? 'you receive' : 'cost'}</span></div>
            <button class="btn primary" disabled={blocked} onClick={() => void trade(tab)}>{tab === 'buy' ? 'Buy' : tab === 'sell' ? 'Sell' : 'Reclaim'}</button>
          </div>
          {poor && <p class="so-warn" role="status">Not enough gold.</p>}
          {noRoom && <p class="so-warn" role="status">Make room in your bag.</p>}
          <p class="co-sub">{tab === 'buy' ? `Resale value: ${fmtInt(salePrice(offer.item) ?? 0)} gold. Buying does not equip the item.` : 'Socketed gems stay with the item. Crafting and rare properties do not increase this offer.'}</p>
          {tab === 'buyback' && !release && <button class="btn sm" disabled={busy || !near || unsupported || !!stale || !!offer.item.protected} onClick={() => setRelease(true)}>Release from buyback…</button>}
          {release && <div class="mx-release" role="alert">
            <p>Permanently give up this item and its socketed gems? This cannot be undone and gives no additional gold.</p>
            <div class="mx-release-row">
              <button class="btn danger" disabled={busy || !near || unsupported || !!stale || !!offer.item.protected} onClick={() => void trade('release')}>Release {offer.item.name}</button>
              <button class="btn" onClick={() => setRelease(false)}>Keep it</button>
            </div>
          </div>}
          <div class="mx-card"><ItemCard item={offer.item} char={save} alt={false} delta={delt} /></div>
        </> : <div class="so-empty mx-pick"><UiIcon name="merchant" size={44} /><b>Choose an item</b><span>Hover an item to compare it with what you wear. Click it to review the exact offer.</span></div>}
      </aside>
    </div>
  </PanelFrame>;
}
