// Inscriptions (docs/rework/depth/ITEMS-SHARED.md §7): the rule change a Fabled item carries (`Item.inscription`).
// Each is plain power-template data (tagGrant / rule / proc / … — never a damage multiplier or a stat) and joins the
// power sources like a legendary power. Only ONE Inscription is active at a time: the first equipped item in SLOTS
// order whose inscription is known (activeInscription). Shipped data is empty on purpose; content authors entries,
// tests install fixtures with registerInscriptions.

import type { PowerEffect } from '../powers';
import type { Item, Slot } from '../types';
import { SLOTS } from '../types';

/** Slot groups of the Inscription pool (§7 table). */
export type InscriptionGroup = 'weapon' | 'headShoulders' | 'chestLegs' | 'handsFeet' | 'beltBracers' | 'jewelry';

export interface InscriptionDef {
  id: string;
  name: string;
  /** Player text; validated against the effects like legendary texts. */
  text: string;
  group: InscriptionGroup;
  effects: PowerEffect[];
}

export const INSCRIPTIONS: Record<string, InscriptionDef> = {};

export function registerInscriptions(defs: readonly InscriptionDef[]): () => void {
  for (const d of defs) INSCRIPTIONS[d.id] = d;
  return () => { for (const d of defs) if (INSCRIPTIONS[d.id] === d) delete INSCRIPTIONS[d.id]; };
}

/** The one active Inscription of an equipment set (first known one in SLOTS order), with the slot it sits in. */
export function activeInscription(equipment: Partial<Record<Slot, Item | null>>): { def: InscriptionDef; slot: Slot } | null {
  for (const slot of SLOTS) {
    const id = equipment[slot]?.inscription;
    if (id && Object.hasOwn(INSCRIPTIONS, id)) return { def: INSCRIPTIONS[id], slot };
  }
  return null;
}
