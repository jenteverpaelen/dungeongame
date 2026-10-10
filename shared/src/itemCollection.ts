import { BASES, LEGENDARIES, SETS } from './data/items';
import { LOOK_SLOTS } from './protocol';
import { slotsForKind } from './items';
import type { CharacterSave, Item, ItemKind, ItemLook, Rarity, Slot } from './types';

export const ORDINARY_RARITIES = ['normal', 'magic', 'rare'] as const;
export type OrdinaryRarity = typeof ORDINARY_RARITIES[number];
export interface LootRules {
  hidden: OrdinaryRarity[];
  leave: OrdinaryRarity[];
  salvage: OrdinaryRarity[];
}
export interface CollectedLook { name: string; base: string; kind: ItemKind; look: ItemLook }
export interface ItemCollection {
  revision: 1;
  looks: Record<string, CollectedLook>;
  wardrobe: Partial<Record<Slot, string>>;
  loot: LootRules;
}
export const defaultLootRules = (): LootRules => ({ hidden: [], leave: [], salvage: [] });
export function validLootRules(v: unknown): v is LootRules {
  if (!v || typeof v !== 'object') return false;
  return ['hidden', 'leave', 'salvage'].every(k => {
    const a = (v as Record<string, unknown>)[k];
    return Array.isArray(a) && a.length <= 3 && new Set(a).size === a.length
      && a.every(x => ORDINARY_RARITIES.includes(x));
  });
}
export function collectionKey(item: Item): string {
  return item.legendary ? `legend:${item.legendary.power}` : item.set ? `set:${item.set}:${item.base}` : `base:${item.base}`;
}
export function collectionKeys(): string[] {
  return [...Object.keys(BASES).map(id => `base:${id}`), ...Object.keys(LEGENDARIES).map(id => `legend:${id}`),
    ...Object.values(SETS).flatMap(s => s.pieces.map(p => `set:${s.id}:${p.base}`))];
}
export function ensureCollection(save: CharacterSave): ItemCollection {
  return save.collection ??= { revision: 1, looks: {}, wardrobe: {}, loot: defaultLootRules() };
}
/** Call only after successful acquisition; one original appearance per catalogue identity. */
export function collectItem(save: CharacterSave, item: Item): void {
  const c = ensureCollection(save), key = collectionKey(item);
  if (!Object.hasOwn(c.looks, key)) c.looks[key] = { name: item.name, base: item.base, kind: item.kind, look: { ...item.look } };
}
export function canWearLook(item: Item, look: CollectedLook, slot: Slot): boolean {
  return LOOK_SLOTS.includes(slot as typeof LOOK_SLOTS[number]) && slotsForKind(item.kind).includes(slot)
    && item.kind === look.kind && (slot !== 'mainhand' || BASES[item.base]?.weapon?.ranged === BASES[look.base]?.weapon?.ranged);
}
export function equippedLook(save: CharacterSave, item: Item, slot: Slot): ItemLook {
  const key = save.collection?.wardrobe[slot], look = key && save.collection?.looks[key];
  return look && canWearLook(item, look, slot) ? look.look : item.look;
}
export function ordinarySelected(list: readonly OrdinaryRarity[] | undefined, rarity: Rarity): boolean {
  return !!list?.includes(rarity as OrdinaryRarity);
}
export function autoSalvageEligible(save: CharacterSave, item: Item, rules=save.collection?.loot): boolean {
  return ordinarySelected(rules?.salvage, item.rarity) && !item.protected && !item.vendorStock
    && item.ancient === 0 && item.upgrade === 0 && item.enchanted === undefined && !item.sockets.some(Boolean)
    && save.commands?.pendingEnchant?.itemId !== item.id;
}
/** Legacy items already in custody unlock looks; never regenerate or replace an owned item. */
export function seedCollection(save: CharacterSave, items: (Item | null | undefined)[]): void {
  const c = ensureCollection(save);
  const keys = new Set(collectionKeys());
  if (c.revision !== 1 || !c.looks || typeof c.looks!=='object' || Array.isArray(c.looks)
    || !c.wardrobe || typeof c.wardrobe!=='object' || Array.isArray(c.wardrobe) || !validLootRules(c.loot)
    || Object.entries(c.looks).some(([key,l])=>!keys.has(key)||!l||!Object.hasOwn(BASES,l.base)||BASES[l.base].kind!==l.kind
      ||typeof l.name!=='string'||l.name.length>150||!l.look||l.look.shape!==BASES[l.base].shape
      ||!['primary','secondary','glow'].every(k=>Number.isInteger(l.look[k as 'primary'])&&l.look[k as 'primary']>=0&&l.look[k as 'primary']<=0xffffff)
      ||!Number.isInteger(l.look.variant)||l.look.variant<0||l.look.variant>3)
    || Object.entries(c.wardrobe).some(([s,key])=>!LOOK_SLOTS.includes(s as typeof LOOK_SLOTS[number])||typeof key!=='string'||!Object.hasOwn(c.looks,key)))
      throw new Error('Unsupported item collection');
  for (const item of items) if (item) collectItem(save, item);
}
