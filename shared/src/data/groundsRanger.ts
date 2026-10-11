// Ranger data grounds (engine wave 2 framework: shared/src/data/grounds.ts, server/src/sim/groundFx.ts).
// Content: docs/rework/depth/RANGER.md. Sizes the bible does not give are [P] and say where they come from.

import type { GroundDef } from './grounds';

export const RANGER_GROUNDS: GroundDef[] = [
  // Pitch Mortar: "leaves pitch fire for 3 s"; the burn is the skill's second number (1.8 over 3 s, RANGER.md §3 R11),
  // 0.3 per 0.5 s. Class code scales the radius to the shell's impact radius.
  { id: 'pitch_fire', name: 'Burning Pitch', owner: 'pitch_mortar', tags: ['burn'], element: 'fire', radius: 100, durationMs: 3000, tick: { everyMs: 500, coef: 0.3 }, maxPerOwner: 6, visual: 'pitch' },
  // Spring Snare rune Pitch-Soaked: "the snap leaves burning ground for 2 s". Rate [P] = the Mortar's pitch (0.6 per s).
  { id: 'snare_fire', name: 'Burning Ground', owner: 'spring_snare', tags: ['burn'], element: 'fire', radius: 90, durationMs: 2000, tick: { everyMs: 500, coef: 0.3 }, maxPerOwner: 6, visual: 'snare_fire' },
  // Arrowfall rune Flood Plain: wet ground for 3 s after the storm that "chills 30%": a 30 % slow (engine wave 3).
  { id: 'wet_ground', name: 'Wet Ground', owner: 'rain_of_vengeance', tags: ['chill'], radius: 240, durationMs: 3000, tick: { everyMs: 500, status: { kind: 'slow', pct: 30, ms: 600 } }, maxPerOwner: 2, visual: 'wet' },
  // Powder Horn: "a burning powder patch (Ground, 2 s, 100% weapon damage per second as Fire)". Radius [P] 60 = the
  // burst radius of Bolt-Thrower's Arbalest (the bible's other small blast).
  { id: 'powder_patch', name: 'Powder Patch', tags: ['burn'], element: 'fire', radius: 60, durationMs: 2000, tick: { everyMs: 500, coef: 0.5 }, maxPerOwner: 4, visual: 'powder_patch' },
];
