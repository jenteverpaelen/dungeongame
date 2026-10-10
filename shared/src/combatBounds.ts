/** Technical ceiling of exact integer combat quantities; not an economy or progression cap. */
export const MAX_COMBAT_AMOUNT = Number.MAX_SAFE_INTEGER;
export function boundedCombat(value:number):number {
  return Number.isNaN(value) ? 0 : Math.max(0,Math.min(MAX_COMBAT_AMOUNT,value));
}
export function combatInteger(value:number,minimum=1):number {
  return Math.max(minimum,Math.round(boundedCombat(value)));
}
