let counter = 1;
/** Globally unique entity / projectile id (fits comfortably in a double for the lifetime of a server). */
export const nextId = () => counter++;
/**
 * Harnesses only (never the game server): restart the sequence before a fresh Instance so repeated runs in one process
 * see the same ids. Monster separation breaks exact overlaps by id (monsters.ts), and pulls (Black Hole) stack monsters
 * exactly, so without this a kit's clear time depended on what ran before it in the process.
 */
export function resetIdsForHarness(next = 1) { counter = next; }
/** Harnesses only: the next id (to restore the sequence after a fresh section). */
export const peekIdForHarness = () => counter;
