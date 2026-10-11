// Mage data grounds (engine wave 2 framework: shared/src/data/grounds.ts, server/src/sim/groundFx.ts).
// Content: docs/rework/depth/MAGE.md. Sizes the bible does not give are [P] (MAGE-PILOT.md §4 lists them).

import type { GroundDef } from './grounds';

export const MAGE_GROUNDS: GroundDef[] = [
  // Rimefield's footprint (no effect of its own): "inside your Ground" conditions and Ground-tag effects see the field.
  // Class code (server/src/sim/skills/mageM1.ts) sets radius and lifetime per cast; Wandering Rime follows you.
  { id: 'rime_ground', name: 'Rimefield', owner: 'rimefield', radius: 200, durationMs: 6000 },
  { id: 'rime_ground_follow', name: 'Rimefield', owner: 'rimefield', radius: 140, durationMs: 6000, follow: 'owner' },
  // Lantern Garden 4: "a lantern (4 s, radius 200) in which your Summons attack 30% faster". The speed-up is class code
  // (summon AIs ask whether they stand in a lantern). [P] at most 6 at once (Lantern Garden 6's sprite cap).
  { id: 'summon_lantern', name: 'Lantern', radius: 200, durationMs: 4000, maxPerOwner: 6, visual: 'lantern' },
  // Cinderkin node Sparkstep: sparks for 1.5 s [P] at 20 % weapon damage per second at scale 1 (rank scale 1 / 1.75 / 2.5).
  { id: 'kin_sparks', name: 'Sparks', owner: 'cinderkin', tags: ['burn'], element: 'fire', radius: 30, durationMs: 1500, tick: { everyMs: 500, coef: 0.1 }, maxPerOwner: 12, visual: 'ember_trail' },
  // Stormglass Orb node Shattered Charge: shards that zap an enemy stepping on them for 100 % weapon damage, once each
  // [P] 4 s, radius 24 (Sawtooth splinter size [M]).
  { id: 'glass_shard', name: 'Glass Shard', owner: 'stormglass_orb', element: 'lightning', radius: 24, durationMs: 4000, onEnter: { coef: 1 }, maxPerOwner: 10, visual: 'glass_shard' },
];
