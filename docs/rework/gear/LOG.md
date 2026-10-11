# Gear visual progression — log (terse: what changed, why, evidence)

Worktree `C:\Users\LaptopJente\hearthfall-gear`, branch `claude/gear`; server :2621, Vite :5221, isolated
`DATA_DIR=.local/gear-data/*`. Shots: `docs/rework/gear/shots/` (JPEG, lead request), produced by
`node scripts/shoot.mjs scripts/gear-shots.mjs --base=http://localhost:5221 --out=docs/rework/gear/shots --jpeg` and
`scripts/gear-ingame.mjs` (prefix `game-`); perf by `scripts/gear-perf.mjs`.

- **G0 — research.** One read-only research pass with verified sources → `REFERENCES.md` (13 observations, 10
  principles; unverifiable claims listed as not used).
- **G1 — tier system (shared, tested).** `shared/src/gearVisual.ts`: item tier 0–9, temper 0–3, 28-bit packing,
  hero profile/rank; `playerLook` adds `fx` per slot + `jw`; loot views add `fx`; `PROTOCOL_VERSION` 22.
  `shared/src/gearShowcase.ts`: inferred typical loadouts per stage. Tests (`shared/test/gearVisual.test.ts`, 6):
  ladder + monotonicity, round-trip/determinism over 400 random items, append-only id orders, purity (stored looks
  untouched, wardrobe keeps worn progression), rank ladder 0,0,2,3,4,5,5,6,7,8,9 for all three classes, descriptor
  bytes: starter 404 → 433 B, L70 684 → 783 B, Primal 697 → 818 B (first try with full jewellery looks was +348 B;
  switched `jw` to numbers).
- **G2 — hero.** `gearDecor.ts` baked ornaments (pauldrons, crests, crowns, side wings, jewels, medallion, studs,
  pendant, charms, knee cops, ankle fins, weapon runes/guards/serrations, shield spikes, starter patches) + weapon and
  pauldron growth; back pieces cape → mantle → 11 wing styles; `gearFx.ts` live layer (sigil with Set sockets, aura,
  per-piece glows, motif particles, orbiters, footprints, weapon sheen / motif flames / +10 star, halo, Primal
  heartbeat, full-Set flourish, level-up flare). Iterated on screenshots: wings first collapsed in profile (3D-correct
  projection) → always spread (D6); capes hidden behind the torso → flare out in profile; hood crests of 7 cogs read as
  clutter → 3/5 elements and a single temple cog for Siegebreaker; flat "light" wings → layered feathered energy;
  Siegebreaker got a brass cog-arm back piece; Ancient wings take amber edges.
- **G3 — UI.** Icon tier frames / Set mark / Ancient & Primal jewels / temper stars painted into icons; tooltip tier
  strip; Heroic+ icons breathe (still under reduced motion); nameplate rank medal + full-Set mark (rebuilt on rank
  change); loot: Runic pillar, taller Heroic beams, Heroic+ sigils, Primal pulses; character panel animated showcase
  (rank, pips, Sets, next step) and inspect showcase; Settings: Gear effects own / others full|reduced|off.
- **G4 — performance** (gallery `perf`, visible page target, 1920×1080, no monsters, every hero a unique look; this
  machine was shared with another agent's build, so absolute numbers are noisy — compare rows):

  | case | fps | hero update (median) | draws/frame |
  |---|---|---|---|
  | 30 heroes, legacy looks (before) | 92–163 | 2.1–3.6 ms | 176 |
  | 30 heroes, all Primal, full | 99–139 | 2.8–3.6 ms | 177 |
  | 30 heroes, mixed stages, full | 139–147 | 2.3–3.1 ms | 150 |
  | 30 heroes, all Primal, reduced | 109–119 | 2.4–3.4 ms | 181 |
  | 100 heroes, legacy looks (before) | 35–57 | 6.9–13.0 ms | 386–398 |
  | 100 heroes, mixed stages, full | 38–46 | 8.8–11.5 ms | 323 |
  | 100 heroes, all Primal, full | 26–37 | 9.3–11.7 ms | 386–392 |
  | 100 heroes, all Primal, reduced | 40–53 | 7.6–9.7 ms | 396 |

  30 visible heroes stay far above 60 fps even when all are Primal; at 100 heroes an all-Primal crowd costs ~25 % vs
  the old looks (the crowd budget already thins particles; "reduced" for others brings it back to parity). Warm-up:
  100 unique looks appearing in one frame stall for several seconds while sheets bake (as before; the in-game
  scene adds heroes gradually and caches crowded-town poses).

## Spectacle pass (lead review 2026-10-11)

- **G5 — integrated base.** Merged `claude/town-ui-rework` (55b8f78, later 8dcde16) into `claude/gear`; the lead's
  resolutions of inspect / settings / index / main kept as they were.
- **G6 — presence at distance.** Wings baked at rank-scaled size (rank 7 1.62×, 8 1.98×, Primal 2.58× the base drawing;
  Sets keep their silhouette when Primal), capes +14 %/rank, sigil 40→82 u by rank, light column 230 u for rank 8+
  (saturated normal-blend outer + additive core so it reads on bright stone; first version was invisible above the wings
  because its strength faded too early — measured with a forced-green probe and a lossless crop, then fixed), afterimage
  ribbon, larger orbiters, brighter swing trails with tip sparks, nameplate glow pill (6+) and animated crown (8+).
  **Measured extents** (`gallery-art.html?view=gear-measure`, px at the default camera, yaw 65; visible = alpha > 0.16,
  includes the column; body = hero without weapon / off-hand / back / effects):

  | stage | before (legacy) visible | after visible | after solid | wing span / body width |
  |---|---|---|---|---|
  | starter (all classes) | 50–65 × 89–101 | same | same | — |
  | L70 (rank 6) | 67–76 × 93–126 | 74–96 × 109–131 | 73–92 × 100–130 | — (cape) |
  | full Set (rank 7) | 68–76 × 93–123 | 126–131 × 146–157 | 120–124 × 145–156 | 1.94–2.31 |
  | Ancient Set (rank 8) | 67–76 × 93–123 | 145–153 × 274 | 143–152 × 233 | 2.40–2.80 (yaw 25: 2.21–2.46) |
  | Primal Set (rank 9) | 67–76 × 93–123 | 187–199 × 280 | 187–197 × 244 | 3.13–3.67 (yaw 25: 2.88–3.17) |

  Targets met: span ≥ 2.2× body width at rank 8 and ≥ 2.6× with a Primal at both measured yaws; sigil ≥ 1.8× the shadow
  from rank 7 (64 u vs 34 u).
- **G7 — readability.** Every ground effect moved to a scene underlay beneath the telegraph layer and dims 45 % while the
  hero fights. Evidence: `shots/field-telegraphs.jpg` (an elite's warning ring stays crisp beside a Primal veteran),
  `shots/field-boss.jpg` (rift guardian fight).
- **G8 — the moment.** Rank-up / first full Set: notice (level banner), procedural chime, 1.5 s burst (rings, column,
  fountain, wing flare) — `shots/duo-rankup.jpg`. Primal drops get their own stinger.
- **G9 — known problems fixed.** Two-handed idle rests the weapon at the side; next-step hints from the worn gear
  (`gearNextSteps`, tested); shoulder icons show pauldron ornaments; budgeted bakes (below).
- **G10 — bakes.** In-game heroes bake on the GPU within 4 ms per frame (placeholder / previous sheet meanwhile).
  Probe with 100 never-seen heroes appearing in one frame: synchronous vector build 1,359 ms in that frame → none (the
  remaining first-frame cost is the town NPCs' existing bake); bake work per frame ≤ 4 ms (single-part outliers ≤ 40 ms)
  instead of 25 ms chunks plus a 2.1 s first chunk; the crowd pops in over ~20–30 s instead of freezing.
- **G11 — evidence with two real clients.** `scripts/gear-duo.mjs` drives a second client in its own headless window
  (`api.newClient()` in `shoot.mjs`): `shots/duo-town.jpg` (level-1 newcomer next to a Primal veteran, default camera),
  `shots/duo-edge.jpg` (veteran at the screen edge), `shots/duo-rankup.jpg`. Debug-only `showcase` op equips the
  ladder stages. Note: a long-running Vite served a stale transform of `gearVisual.ts` to a fresh tab (missing export);
  restarting Vite with a clean cache fixed it.
- **G12 — performance** (perf gallery, visible tab, no monsters, every hero a unique look, after bakes finished):

  | case | before (legacy looks) | after |
  |---|---|---|
  | 30 heroes, all Primal, full | 145–163 fps | 117–125 fps (p95 frame 8.8–12.2 ms) |
  | 30 heroes, mixed stages, full | 145–163 fps | 147–157 fps (p95 frame 12.1 ms) |
  | 100 heroes, mixed stages, full | 54–68 fps | 54–55 fps |
  | 100 heroes, all Primal, full | 54–68 fps | 45–48 fps (20–24 before the 16-hero presence budget) |
  | 100 heroes, all Primal, reduced | 54–68 fps | 37–53 fps |
