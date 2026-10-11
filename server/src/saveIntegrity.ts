// Custody signature of a character: what a migration, a backup restore or an export must never lose. Item ids with
// their rarity/base, loose gems, gold and materials, in canonical order, hashed. Used by the save-migration tests
// (zero-loss check, roadmap P3 acceptance 3) and the scheduled restore drill (server/src/backupDrill.ts).

import { createHash } from 'node:crypto';
import { ownedItems } from '../../shared/src/merchant';
import type { CharacterSave } from '../../shared/src/types';

export interface CustodySummary { items: number; gems: number; gold: number; materials: number; sha256: string }

export function custodySummary(save: CharacterSave): CustodySummary {
  const items = ownedItems(save).filter((i): i is NonNullable<typeof i> => !!i && typeof i === 'object')
    .map(i => `${String(i.id)}:${String(i.base)}:${String(i.rarity)}:${(i.sockets ?? []).map(s => s ?? '-').join('/')}`).sort();
  const gems = Object.entries(save.gems ?? {}).filter(([, n]) => typeof n === 'number' && n > 0).map(([k, n]) => `${k}=${n}`).sort();
  const mats = Object.entries(save.materials ?? {}).map(([k, n]) => `${k}=${n}`).sort();
  const canonical = JSON.stringify({ items, gems, gold: save.gold ?? 0, mats });
  return {
    items: items.length,
    gems: Object.values(save.gems ?? {}).reduce((a, n) => a + (typeof n === 'number' && n > 0 ? n : 0), 0),
    gold: typeof save.gold === 'number' ? save.gold : 0,
    materials: Object.values(save.materials ?? {}).reduce((a, n) => a + (typeof n === 'number' ? n : 0), 0),
    sha256: createHash('sha256').update(canonical).digest('hex'),
  };
}
