// Character creation, equipment rules, inventory and skill loadout helpers (shared validation).

import { INVENTORY_SIZE, STASH_SIZE } from './constants';
import { SAVE_VERSION } from './saveVersion';
import {selectedTitle} from './community';
import { CLASSES } from './data/classes';
import { BASES } from './data/items';
import { SKILLS, SKILL_SLOTS, TIER_COSTS, collectSkillMods, runeUnlockLevel, skillsForClass, type SkillMods } from './data/skills';
import { canClassUse, slotsForKind, starterItems } from './items';
import { Rng } from './math';
import { LOOK_SLOTS, type PlayerLook } from './protocol';
import type { CharacterSave, ClassId, Item, Slot } from './types';

export function createCharacter(name: string, classId: ClassId, seed: number): CharacterSave {
  const rng = new Rng(seed);
  const cls = CLASSES[classId];
  const firstSkill = skillsForClass(classId).find((s) => s.kind !== 'primary' && s.unlock <= 1);
  return {
    version: SAVE_VERSION,
    id: `${name.toLowerCase()}`,
    name,
    classId,
    level: 1,
    xp: 0,
    gold: 0,
    materials: { scrap: 0, dust: 0, crystal: 0, soul: 0, deathsBreath: 0 },
    gems: {},
    equipment: starterItems(rng, classId),
    inventory: Array.from({ length: INVENTORY_SIZE }, () => null),
    stash: Array.from({ length: STASH_SIZE }, () => null),
    skills: { slots: [firstSkill?.id ?? null, null, null, null], runes: {}, tiers: {}, primary: cls.primary },
    skillPoints: 0,
    paragon: { level: 0, xp: 0, spent: {} },
    cube: { level: 1, xp: 0, learned: [], equipped: [null, null, null] },
    difficulty: 0,
    lastZone: 'hearthmere',
    lastSeen: Date.now(),
    stats: { kills: 0, elites: 0, legendaries: 0, rifts: 0, playMs: 0, deaths: 0 },
  };
}

export function playerLook(save: CharacterSave): PlayerLook {
  const slots: PlayerLook['slots'] = {};
  for (const s of LOOK_SLOTS) {
    const it = save.equipment[s as Slot];
    if (it) slots[s] = it.look;
  }
  return { classId: save.classId, slots, title:selectedTitle(save), ...(save.appearance?{appearance:save.appearance}:{}) };
}

// ─────────────────────────── Inventory ───────────────────────────

export function freeInventorySlot(save: CharacterSave): number {
  return save.inventory.findIndex((i) => i === null);
}

export function addToInventory(save: CharacterSave, item: Item): number {
  const idx = freeInventorySlot(save);
  if (idx >= 0) save.inventory[idx] = item;
  return idx;
}

export function findInventory(save: CharacterSave, itemId: string): number {
  return save.inventory.findIndex((i) => i?.id === itemId);
}

export function findEquipped(save: CharacterSave, itemId: string): Slot | null {
  for (const [s, it] of Object.entries(save.equipment)) if (it?.id === itemId) return s as Slot;
  return null;
}

export function findItem(save: CharacterSave, itemId: string): Item | null {
  const i = findInventory(save, itemId);
  if (i >= 0) return save.inventory[i];
  const s = findEquipped(save, itemId);
  return s ? save.equipment[s]! : null;
}

/** Equip an item from the inventory. Returns an error message or null on success. */
export function equipItem(save: CharacterSave, itemId: string, prefer?: Slot): string | null {
  const idx = findInventory(save, itemId);
  if (idx < 0) return 'Item not in inventory';
  const item = save.inventory[idx]!;
  if (item.reqLevel > save.level) return `Requires level ${item.reqLevel}`;
  if (!canClassUse(save.classId, item)) return `${CLASSES[save.classId].name}s cannot use this item`;
  const slots = slotsForKind(item.kind);
  let slot: Slot = prefer && slots.includes(prefer) ? prefer : slots[0];
  if (item.kind === 'ring' && !prefer) slot = !save.equipment.ring1 ? 'ring1' : !save.equipment.ring2 ? 'ring2' : 'ring1';

  const toInventory: Item[] = [];
  const prev = save.equipment[slot];
  if (prev) toInventory.push(prev);

  const base = BASES[item.base];
  if (slot === 'mainhand' && base.weapon?.twoHanded) {
    const oh = save.equipment.offhand;
    const allowsOffhand = base.weapon.ranged && item.base !== 'staff';
    if (oh && !allowsOffhand) toInventory.push(oh);
  }
  if (slot === 'offhand') {
    const mh = save.equipment.mainhand;
    if (mh) {
      const mb = BASES[mh.base];
      if (mb.weapon?.twoHanded && (!mb.weapon.ranged || mh.base === 'staff')) return 'Your two-handed weapon prevents using an off-hand';
    }
  }

  const freeAfter = save.inventory.filter((i) => i === null).length + 1;
  if (toInventory.length > freeAfter) return 'Inventory is full';

  save.inventory[idx] = null;
  item.bound = true;
  save.equipment[slot] = item;
  for (const it of toInventory) {
    if (it === save.equipment.offhand && slot !== 'offhand') delete save.equipment.offhand;
    addToInventory(save, it);
  }
  return null;
}

export function unequipItem(save: CharacterSave, slot: Slot): string | null {
  const it = save.equipment[slot];
  if (!it) return 'Nothing equipped';
  if (freeInventorySlot(save) < 0) return 'Inventory is full';
  delete save.equipment[slot];
  addToInventory(save, it);
  return null;
}

// ─────────────────────────── Skills ───────────────────────────

export function unlockedSkills(save: CharacterSave) {
  return skillsForClass(save.classId).filter((s) => s.unlock <= save.level);
}

export function skillPointsSpent(save: CharacterSave): number {
  let n = 0;
  for (const t of Object.values(save.skills.tiers)) for (let i = 0; i < t; i++) n += TIER_COSTS[i];
  return n;
}

export function setSkillSlot(save: CharacterSave, slot: number, skillId: string | null): string | null {
  if (slot < 0 || slot >= SKILL_SLOTS) return 'Bad slot';
  if (skillId) {
    const s = SKILLS[skillId];
    if (!s || s.classId !== save.classId) return 'Unknown skill';
    if (s.kind === 'primary') return 'Primary attacks are always active';
    if (s.unlock > save.level) return `Unlocks at level ${s.unlock}`;
    const existing = save.skills.slots.indexOf(skillId);
    if (existing >= 0) save.skills.slots[existing] = save.skills.slots[slot];
  }
  save.skills.slots[slot] = skillId;
  return null;
}

export function setSkillRune(save: CharacterSave, skillId: string, runeId: string | null): string | null {
  const s = SKILLS[skillId];
  if (!s || s.classId !== save.classId) return 'Unknown skill';
  if (runeId) {
    const i = s.runes.findIndex((r) => r.id === runeId);
    if (i < 0) return 'Unknown rune';
    if (runeUnlockLevel(s, i) > save.level) return `Rune unlocks at level ${runeUnlockLevel(s, i)}`;
  }
  save.skills.runes[skillId] = runeId;
  return null;
}

export function buySkillTier(save: CharacterSave, skillId: string): string | null {
  const s = SKILLS[skillId];
  if (!s || s.classId !== save.classId) return 'Unknown skill';
  if (s.unlock > save.level) return 'Skill not unlocked';
  const cur = save.skills.tiers[skillId] ?? 0;
  if (cur >= s.tiers.length) return 'Already mastered';
  const cost = TIER_COSTS[cur];
  if (save.skillPoints < cost) return `Needs ${cost} skill points`;
  save.skillPoints -= cost;
  save.skills.tiers[skillId] = cur + 1;
  return null;
}

export function resetSkillTiers(save: CharacterSave) {
  save.skillPoints += skillPointsSpent(save);
  save.skills.tiers = {};
}

export function loadoutMods(save: CharacterSave, skillId: string): SkillMods {
  const s = SKILLS[skillId];
  return collectSkillMods(s, save.skills.runes[skillId], save.skills.tiers[skillId] ?? 0);
}
