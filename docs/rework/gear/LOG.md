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
