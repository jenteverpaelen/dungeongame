// Warrior data grounds (engine wave 2 framework: shared/src/data/grounds.ts, server/src/sim/groundFx.ts).
// Content: docs/rework/depth/WARRIOR.md. Sizes the bible does not give are [P] and copied from the engine's bible
// fixtures (shared/test/fixtures/depthContent.ts) so the first playtest has one consistent scale.

import type { GroundDef } from './grounds';

export const WARRIOR_GROUNDS: GroundDef[] = [
  // Quakeline node Open Crack: "enemies entering it take 40% of the slam once". Class code places it along the fissure,
  // sets its length and the node's duration, and scales coef 1 to 40 % of the slam's own expected damage.
  { id: 'quake_crack', name: 'Crack', owner: 'seismic_slam', shape: 'line', lineLength: 336, radius: 26, durationMs: 2000, onEnter: { coef: 1 }, visual: 'quake_crack' },
  // Deep Earth (passive): "tremor ground for 2 s that slows enemies by 30%" (engine wave 3 slow). Radius [P] fixture 120.
  { id: 'deep_tremor', name: 'Tremor', tags: ['stun'], radius: 120, durationMs: 2000, tick: { everyMs: 500, status: { kind: 'slow', pct: 30, ms: 600 } }, maxPerOwner: 6, visual: 'tremor' },
  // Fault Warden 6: "a fault line under it for 3 s that re-stuns enemies crossing it (once per 3 s each)". Length [P].
  { id: 'fault_line', name: 'Fault Line', tags: ['stun'], shape: 'line', lineLength: 160, radius: 20, durationMs: 3000, onEnter: { status: { kind: 'stun', ms: 1000 }, againAfterMs: 3000 }, maxPerOwner: 4, visual: 'fault_line' },
  // Furrowmark 6: "a 3 s furrow that strikes enemies crossing it for 50% weapon damage and pushes them toward you".
  { id: 'furrow', name: 'Furrow', tags: ['displace'], shape: 'line', lineLength: 160, radius: 22, durationMs: 3000, onEnter: { coef: 0.5, status: { kind: 'pull', dist: 40, origin: 'owner' } }, maxPerOwner: 4, visual: 'furrow' },
  // Muster Standard's footprint as a ground (no effect of its own): "inside your Ground" conditions and Ground-tag
  // effects see the standard. Class code sets radius and lifetime per plant; the carried variant follows you.
  { id: 'muster_ground', name: 'Muster Standard', owner: 'muster_standard', radius: 240, durationMs: 12000 },
  { id: 'muster_ground_carried', name: 'Muster Standard', owner: 'muster_standard', radius: 240, durationMs: 12000, follow: 'owner' },
  // Cinder Oath 6: "a cinder pool (radius 80, 2 s) that applies your strongest damage-over-time at 50%". Placed by the set's
  // kill proc with carryDot; each enemy inside (or entering) gets one copy [P: once per enemy]. maxPerOwner 8 [P] (as
  // Cinder Prints). Visual: the existing lava pool.
  { id: 'cinder_pool', name: 'Cinder Pool', tags: ['burn'], element: 'fire', radius: 80, durationMs: 2000, onEnter: { status: { kind: 'carriedDot', pct: 50 } }, maxPerOwner: 8, visual: 'molten' },
  // Kilnheart node Cinder Prints: footprints for 2 s at 30 % weapon damage per second (rank scale 1 / 5⁄3 / 7⁄3).
  { id: 'cinder_prints', name: 'Cinder Prints', owner: 'kilnheart', tags: ['burn'], element: 'fire', radius: 40, durationMs: 2000, tick: { everyMs: 500, coef: 0.15 }, maxPerOwner: 8, visual: 'ember_trail' },
];
