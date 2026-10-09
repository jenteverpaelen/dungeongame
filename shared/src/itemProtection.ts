import type { Item } from './types';

/** Audit new item consumers here before introducing them. Ordinary targeted improvements remain allowed. */
export const PROTECTED_ITEM_OPS: ReadonlySet<string> = new Set(['destroy', 'salvage', 'transmute', 'extract', 'reforge']);
export const ITEM_PROTECTION_REASON = 'This item is protected. Remove protection in Inventory before destroying, salvaging, transmuting, extracting or reforging it.';
export function itemProtectionReason(item: Item | null | undefined, operation: string): string | null {
  return item?.protected && PROTECTED_ITEM_OPS.has(operation) ? ITEM_PROTECTION_REASON : null;
}
