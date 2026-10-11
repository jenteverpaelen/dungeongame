// Inscriptions (docs/rework/depth/ITEMS-SHARED.md §7): the rule change a Fabled item carries (`Item.inscription`).
// Each is plain power-template data (tagGrant / rule / proc / … — never a damage multiplier or a stat) and joins the
// power sources like a legendary power. Only ONE Inscription is active at a time: the first equipped item in SLOTS
// order whose inscription is known (activeInscription). The pool below is the §7 table as data (10 of 12: the
// "summons inherit Bleed and Burn" and "cast your Ground skill where the Movement skill ends" entries need a bible
// definition / a recast engine first, see FOUNDATION.md §12). Ids are permanent (saved on items); display names are
// [P] placeholders for the naming pass. Tests may add fixtures with registerInscriptions.

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

const POOL: InscriptionDef[] = [
  { id: 'shared_tags', name: 'Shared Tags', group: 'weapon', text: 'Your Primary skill also gains the tags of the skill in slot 1.',
    effects: [{ kind: 'tagGrant', tags: { anyOf: ['primary'] }, fromSlot: 0 }] },
  { id: 'returning_shot', name: 'Returning Shot', group: 'weapon', text: 'Your Piercing projectiles return to you once after their last hit.',
    effects: [{ kind: 'projectile', tags: { anyOf: ['piercing'] }, returns: true }] },
  { id: 'sky_and_arrow', name: 'Sky and Arrow', group: 'headShoulders', text: 'Your Aerial skills also count as Projectile skills (and Projectile skills as Aerial).',
    effects: [{ kind: 'tagGrant', tags: { anyOf: ['aerial'] }, add: ['projectile'] }, { kind: 'tagGrant', tags: { anyOf: ['projectile'] }, add: ['aerial'] }] },
  { id: 'spare_charge', name: 'Spare Charge', group: 'headShoulders', text: 'Your Cooldown skills store one extra charge.',
    effects: [{ kind: 'rule', tags: { anyOf: ['cooldown'] }, rule: { id: 'charges', extra: 1 } }] },
  { id: 'steady_channel', name: 'Steady Channel', group: 'chestLegs', text: 'Your Channel skills can be used at full movement speed.',
    effects: [{ kind: 'rule', tags: { anyOf: ['channel'] }, rule: { id: 'channelMove', pct: 100 } }] },
  // [M] 2 s = the engine's chill duration on skill hits (projectiles.ts, warrior cone chill); the bible gives none.
  { id: 'frostbound_stun', name: 'Frostbound Stun', group: 'handsFeet', text: 'Your Stuns also Chill for 2 seconds, and your Chills count as Stuns for item powers.',
    effects: [{ kind: 'proc', on: 'applyStatus', status: ['stun'], applyStatus: { kind: 'chill', ms: 2000 } }, { kind: 'rule', rule: { id: 'countsAs', state: 'chilled', as: 'stunned' } }] },
  { id: 'kept_buffs', name: 'Kept Buffs', group: 'beltBracers', text: 'Your Buff skills do not expire in combat; they cost their resource again every 10 s instead.',
    effects: [{ kind: 'rule', tags: { anyOf: ['buff'] }, rule: { id: 'buffUpkeep', everyMs: 10000 } }] },
  { id: 'spenders_refund', name: "Spender's Refund", group: 'beltBracers', text: 'Your Spender skills refund 30% of their cost when they hit 5 or more enemies.',
    effects: [{ kind: 'rule', tags: { anyOf: ['spender'] }, rule: { id: 'spendRefund', pct: 30, minHits: 5 } }] },
  { id: 'following_ground', name: 'Following Ground', group: 'jewelry', text: 'Your Ground effects follow you at half size.',
    effects: [{ kind: 'rule', rule: { id: 'groundsFollow', scale: 0.5 } }] },
  // [M] 3 s = Hunter's Mark (projectiles.ts); the bible gives no duration.
  { id: 'marking_push', name: 'Marking Push', group: 'jewelry', text: 'Your Displace effects also Mark the enemies they move for 3 seconds.',
    effects: [{ kind: 'proc', on: 'applyStatus', status: ['knockback', 'pull'], applyStatus: { kind: 'mark', ms: 3000 } }] },
];

export const INSCRIPTIONS: Record<string, InscriptionDef> = Object.fromEntries(POOL.map((d) => [d.id, d]));

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
