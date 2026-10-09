import type { CharacterSave, Item } from './types';
import type { QuestStep } from './questTypes';
import { INVENTORY_SIZE } from './constants';
import { itemProtectionReason } from './itemProtection';

export function deliveryItemReason(item: Item, step: QuestStep): string | null {
  return itemProtectionReason(item, 'deliver')
    ?? (item.base !== step.itemBase || item.rarity !== step.itemRarity ? 'This item does not match the requested base and rarity.' : null);
}

/** Pure preflight: never mutate an owned item or a gem balance while validating a batch. */
export function planQuestDelivery(save: CharacterSave, step: QuestStep, ids: unknown, pendingItemId?: string):
  { slots: number[]; gems: CharacterSave['gems']; error?: undefined } | { error: string } {
  const need = step.count ?? 1;
  if (step.kind !== 'deliver' || !Number.isSafeInteger(need) || need < 1 || need > INVENTORY_SIZE) return { error: 'Invalid delivery requirement' };
  if (!Array.isArray(ids) || ids.length !== need || ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length)
    return { error: `Select exactly ${need} different bag items for this delivery` };
  const owned = [...save.inventory, ...save.stash, ...Object.values(save.equipment)], slots: number[] = [], gems = { ...save.gems };
  for (const id of ids) {
    const slot = save.inventory.findIndex(item => item?.id === id), item = save.inventory[slot];
    if (!item || owned.filter(item => item?.id === id).length !== 1) return { error: 'Every selected item must be uniquely owned in your bag' };
    const reason = deliveryItemReason(item, step);
    if (reason) return { error: reason };
    if (id === pendingItemId) return { error: 'Choose your pending enchantment at the Mystic before delivering this item' };
    for (const gem of item.sockets) if (gem) {
      const key = `${gem.gem}:${gem.rank}`, value = (gems[key] ?? 0) + 1;
      if (!Number.isSafeInteger(value) || value < 1) return { error: 'Your returned gem balance cannot be represented safely' };
      gems[key] = value;
    }
    slots.push(slot);
  }
  return { slots, gems };
}
