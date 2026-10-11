/** World states that are on for the local player in the current zone (docs/rework/quests/DESIGN.md §7). Rotors and wheels
 *  read it every frame; `WorldPhases.refresh` writes it. A tiny module so art code can import it without cycles. */
export const activeWorldStates = new Set<string>();
