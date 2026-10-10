import { autoSalvageEligible, canWearLook, ensureCollection, validLootRules } from '../../shared/src/itemCollection';
import { addCubeXp, salvageXp, salvageYield } from '../../shared/src/cube';
import { economySnapshot, recordEconomy } from '../../shared/src/economy';
import { LOOK_SLOTS } from '../../shared/src/protocol';
import type { MaterialId, Slot } from '../../shared/src/types';
import type { Session } from './net/session';
import { requireNear } from './townServices';
import { fail, ok } from './world';
import { recipeCommand } from './itemRecipes';

export function collectionCommand(s: Session, a: Record<string, unknown>) {
  if(a.action==='recipe')return recipeCommand(s,a);
  if (a.action === 'rules') {
    if (!validLootRules(a.rules)) return fail('Choose valid loot rules');
    ensureCollection(s.save).loot = structuredClone(a.rules);
    s.changed(false); return ok();
  }
  if (a.action === 'look') {
    const near = requireNear(s, 'mystic'); if (near) return fail(near);
    if (!LOOK_SLOTS.includes(a.slot as typeof LOOK_SLOTS[number])) return fail('Choose an appearance slot');
    const slot = a.slot as Slot, c = ensureCollection(s.save);
    if (a.key === null) delete c.wardrobe[slot];
    else {
      if (typeof a.key !== 'string' || !Object.hasOwn(c.looks, a.key)) return fail('Acquire this appearance first');
      const item = s.save.equipment[slot], look = c.looks[a.key];
      if (!item || !canWearLook(item, look, slot)) return fail('Equip a compatible item in that slot');
      c.wardrobe[slot] = a.key;
    }
    s.changed(true); return ok();
  }
  if (a.action === 'autoSalvage') {
    const near = requireNear(s, 'blacksmith'); if (near) return fail(near);
    const before = economySnapshot(s.save);
    let count = 0, xp = 0;
    for (let i = 0; i < s.save.inventory.length; i++) {
      const item = s.save.inventory[i];
      if (!item || !autoSalvageEligible(s.save, item)) continue;
      for (const [key, amount] of Object.entries(salvageYield(item))) s.save.materials[key as MaterialId] += amount!;
      xp += salvageXp(item); s.save.inventory[i] = null; count++;
    }
    if (count) {
      addCubeXp(s.save, xp); recordEconomy(s.save, 'salvageAll', before); s.changed(false);
    }
    return ok({ count, xp });
  }
  return fail('Unknown collection action');
}
