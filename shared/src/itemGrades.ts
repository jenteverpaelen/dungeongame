// Item grades: Kindled and Fabled (docs/rework/depth/ITEMS-SHARED.md §7), replacing D3's Ancient / Primal ladder.
// The stored field stays `ancient: 0 | 1 | 2` (saves, protocol and the 2-bit gear descriptor are unchanged); only the
// meaning and the names change:
//   1 Kindled — one extra primary affix (the kindled affix, normal ranges, `kindledAffix` = its index);
//   2 Fabled  — every affix at maximum plus one Inscription for the slot (`inscription`), only one active at a time.
// No grade multiplies affixes, weapon damage, armour or powers any more; ANCIENT_MULT survives for legacy items only.
// Save revision 16 marks pre-grade items `legacyGrade` (stored values kept exactly) and gives old grade-2 items a
// deterministic Inscription; the Mystic offers legacy grade-1 items one free rekindle into the new form.

import { INSCRIPTIONS, type InscriptionDef, type InscriptionGroup } from './data/inscriptions';
import type { AncientTier, Item, ItemKind } from './types';

export type ItemGrade = AncientTier;
export const GRADE_LABEL: Record<ItemGrade, string> = { 0: '', 1: 'Kindled', 2: 'Fabled' };
/** The save revision that introduced grades. */
export const GRADE_SAVE_VERSION = 16;

/** Inscription pool group of an item kind (§7 table). */
export function inscriptionGroup(kind: ItemKind): InscriptionGroup {
  switch (kind) {
    case 'head': case 'shoulders': return 'headShoulders';
    case 'chest': case 'legs': return 'chestLegs';
    case 'hands': case 'feet': return 'handsFeet';
    case 'waist': case 'wrists': return 'beltBracers';
    case 'neck': case 'ring': return 'jewelry';
    default: return 'weapon';
  }
}

/** The Inscriptions a kind can carry, in registry order. */
export const inscriptionPool = (kind: ItemKind): InscriptionDef[] => Object.values(INSCRIPTIONS).filter((d) => d.group === inscriptionGroup(kind));

/** FNV-1a 32-bit hash: the deterministic Inscription of a migrated legacy Fabled item. */
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** Deterministic Inscription for an item (hash of its id within its slot group); null when the pool is empty. */
export function deterministicInscription(item: Pick<Item, 'id' | 'kind'>): string | null {
  const pool = inscriptionPool(item.kind);
  return pool.length ? pool[stableHash(item.id) % pool.length].id : null;
}

/**
 * Save revision 16 for one item: graded items from before grades keep their stored values and get `legacyGrade`;
 * old grade-2 items also get their deterministic Inscription. Returns true when the item changed.
 */
export function migrateItemGrade(item: Item | null): boolean {
  if (!item || typeof item !== 'object' || !item.ancient || item.legacyGrade || item.kindledAffix !== undefined) return false;
  item.legacyGrade = true;
  if (item.ancient === 2 && !item.inscription) { const id = deterministicInscription(item); if (id) item.inscription = id; }
  return true;
}

/** A legacy Kindled (old Ancient) item the Mystic can rekindle once, free. */
export const canRekindle = (item: Item | null | undefined): boolean => !!item && item.ancient === 1 && !!item.legacyGrade;
