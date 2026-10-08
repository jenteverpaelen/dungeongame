import { INVENTORY_SIZE, STASH_SIZE } from './constants';
import type { CharacterSave } from './types';

/** Atomic, id-based transfer; retries cannot duplicate an item or act on a changed slot. */
export function transferStash(save: CharacterSave, itemId: string, deposit: boolean): string | null {
  const source = deposit ? save.inventory : save.stash, dest = deposit ? save.stash : save.inventory;
  const index = source.findIndex(i => i?.id === itemId);
  if (index < 0) return deposit ? 'Item not in inventory' : 'Item not in stash';
  const matches = [...save.inventory, ...save.stash, ...Object.values(save.equipment)].filter(i => i?.id === itemId).length;
  if (matches !== 1) return 'Duplicate item id; transfer refused';
  const size = deposit ? STASH_SIZE : INVENTORY_SIZE;
  let free = -1; for (let i = 0; i < size; i++) if (!dest[i]) { free = i; break; }
  if (free < 0) return deposit ? 'Your stash is full' : 'Your inventory is full';
  dest[free] = source[index]; source[index] = null;
  return null;
}
