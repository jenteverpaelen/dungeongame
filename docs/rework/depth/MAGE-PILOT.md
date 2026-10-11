# Mage wave — what shipped, what is still blocked, deviations (branch `claude/mage`)

Implements `MAGE.md` (bible v2) on the depth foundation, engine wave 2 and the warrior pilot's patterns. Labels:
**[M]** measured in this repo, **[P]** proposal (a number chosen here, to be re-fitted by playtests), **[B]** from the bible.

## 1. Shipped

| What | Count | Notes |
|---|---|---|
| Skills | 12 / 12 | 6 existing + Rime Needles (16), Thrumming Ray (20), Cinderkin (26), Rimefield (32), Stormglass Orb (40), Orrery (50) |
| Runes | 60 / 60 | runes 4–5 of the existing skills at skill + 14 / + 20 [B]; the new skills' runes at + 2 / 5 / 9 / 14 / 20 [B] |
| Specialization nodes | 67 / 72 | five nodes are blocked (§2); every tree still holds 12–18 ranks for a cap of 10 |
| Passives | 14 (6 kept + 8 new) | Chill Margin, Astral Debt, Conjurer's Hearth, Resonance, Ley Anchor, Missile Choir, Unbroken Ward, Starborn |
| Sets | 5 / 5 | Regalia of the Fallen Star redesigned on tags; Glass Concord, Lantern Garden (the Summon set, approved), Hoarfrost Vigil (approved), Hollowstar Choir new |
| Mage legendaries | 33 / 34 | 5 existing + 28 new; Rimewalker Slippers blocked (§2) |
| Data grounds | 5 | `shared/src/data/groundsMage.ts` (Rimefield footprint + follow, lantern, kin sparks, glass shard) |
| Point economy | the shared `SPEC_POINTS` | separate pool, 1 per level from 21, cap 10 per tree: 50 points at 70 |
| Names | `NAMES.md` | rune renames (Frost Spike, Heavy Sky, Starve the Light, Marrow Cold, Arcane Spit, Frost Spit, Elder Hydra, Deep Glyph); ids unchanged |
| Tags | every mage skill and rune per `ITEMS-SHARED.md` §1.2 | Magic Weapon lost its `aura` tag (the bible gives it none) |

Code: data `shared/src/data/skills/mage.ts`, `shared/src/data/powers/mage.ts`, `shared/src/data/passives/mage.ts`,
`shared/src/data/groundsMage.ts`; behaviour `server/src/sim/skills/mage.ts` (the existing six), `mageM1.ts` (the six new),
`mageKit.ts` (per-player / per-monster mage state, the mage hit wrapper, freeze build-up, bolt rules, summon hooks,
the death hook); client `client/src/render/vfx/mage.ts` (+ routing in `aoe.ts`, `projectiles.ts`, `beams.ts`,
`casts.ts`, `telegraphs.ts`), poses `render/actions.ts`, `art/choreo.ts`, `art/player.ts`, summon rigs `art/summons.ts`,
icons `ui/panels/skillicons.tsx` + `ui/hud/Glyphs.tsx`, buff names `ui/hud/SkillBar.tsx`, sounds `audio/bank.ts`, gallery
scenes `mage` / `mage2`. Tests `server/test/mage.test.ts` (15), `server/test/engineMage.test.ts` (4), the parity gate in
`server/test/parity.test.ts`, harness `server/test/parity/mage.ts`, report `scripts/audit-mage-parity.ts` →
`MAGE-PARITY.md` / `.json`.

New legendaries and set pieces drop through normal loot (class pools are data); debug `legendaries` grants every class
legendary, debug `set` every set (`{ id }` one set).

## 2. Still blocked (phase 2: needs an engine wave-3 primitive)

| Content | Missing primitive |
|---|---|
| Black Hole N4 Lingering Pull, Rimefield N3 Cold Snap Edge and N6 Absolute Field, Orrery N2 Tidal Lock and N5 Clockwinding | slow of a chosen strength |
| Rimewalker Slippers | a Movement-end trigger (the dash proc fires at the start) |
| Chill strengths of 30 / 50 / 60 % (Rime Needles, Deep Chill, Rimefield) | same primitive; these use the engine's fixed 40 % chill [M] |

## 3. Narrow generic additions (each with tests; `engineMage.test.ts`)

* Commit 388e770: `Proj.hook` (hit / tick / end callbacks with the end reason; a hook owns the hit, bounces carry it;
  `keepLife` skips the reach clamp) — Stormglass Orb; `skillMore` with a negative pct = a "less" multiplier, validated
  in (−100, cap] with "less" text — Conjurer's Hearth, Runeweaver Cuffs; `elementStacks.bucket: 'generic'` (stacks
  feed the generic damage bucket instead of a per-hit term) — Fallen Star 4; rule `statusLonger` (your chills / stuns /
  freezes last pct % longer) — Chill Margin; `aoe` events may carry `n`.
* Commit dfa4b47 (harness only): `resetIdsForHarness` — monster separation breaks exact overlaps by entity id and
  Black Hole stacks monsters exactly, so a kit's time depended on what ran before it in the process (pre-existing at
  343a5d5).
* Class code instead of primitives: freeze build-up, Brittle / Deep Frost, ray ramp, kin AI, the orrery's spheres and
  the summon-disappearance hooks live in `mageKit.ts` / `mageM1.ts`, through the existing owner tick hook and death hook.

## 4. Deviations from the bible (and why)

| Where | Bible | Shipped | Why |
|---|---|---|---|
| Hollowstar Choir 4 | Spender cost 30 % less | 10 % | cost cuts add up (cost × (1 + Σ)); measured Meteor ×106 at 30 % [M] |
| Hollowstar Choir 6 | refraction 40 % of the beam | 15 % | the transform alone measured ×1.2–1.3 at 40 % [M] |
| Hoarfrost Vigil 2 | chill / ground cooldown −20 %, radius +20 % | 15 / 15 % | measured ×1.56 alone on Rimefield [M]; ×1.46 at 15 / 15 |
| Spellwright's Circlet | 0.1–0.2 s per crit, no limit | once every 0.5 s | per crit it measured ×1.6–3.2 alone (Orrery ×3.17) and sat in nearly every top kit; gated like D3's Obsidian Ring of the Zodiac (once per cast); now ×1.03–1.28 [M] |
| Stormglass Orb extra orbs | full damage | half damage, 25° fan | Glass Concord on the Orb measured ×3.06, ×2.1 from Glass Concord 2's extra orb alone [M] |
| Hydra extra spit (Projectile counts) | — | fans 10° without homing | homing extras all hit the same target (like extra missiles) |
| Conductor | arcs between your orbs | each orb arcs to its nearest newer orb (a chain) | every pair is quadratic: 13 orbs in flight = 78 arcs every 0.25 s [M]; the chain is n − 1 |
| Glacier Spine | text "twice the damage of a needle trio", mods `{projectiles: −2, dmg: +100}` | twice a needle's damage | the bible's own mods; the text follows them |
| Deep Chill | 60 % chill | the engine's 40 % chill | §2 |
| Retort of Frost | "when hit in melee" | when hit while an enemy is within 140 | the takeDamage trigger does not know melee from ranged |
| Firekeeper's Gloves | "Burn effects deal more" | damage-over-time (`dotDmg`) | the mage's dots are all Burns; the stat covers every dot |
| Spellwright's Circlet | "while a Buff skill is active" | while Magic Weapon is active (the mage's one Buff) | the condition names a buff id |
| Static Loop | at most 8 per cast | a channel counts as one cast | channel ticks are not casts |
| Snowglobe Pendant | no radius / chill | radius 100, chill 2 s [P] | Frost Nova's ring is 190, Frost Spit's chill 2 s [M] |
| Runeweaver Cuffs | "costs nothing" | "costs 100 % less" | the generated cost text |
| Lanternkin | "a firebolt (0.8 per second, range 300)" | a firebolt every second for 80 % weapon damage | "0.8" read as the coefficient; one bolt per second [P] |
| Tiers of the six new skills | none authored | 3 tiers each, patterned on the class's existing tiers [M] | every skill has three tiers (ITEMS-SHARED §0); names original |
| Black Hole description | "Pairs perfectly with Meteor." | removed | owner principle: nothing may imply a pre-made build |
| Orrery description | — | adds "at 50 % damage" for sphere missiles | the number the code uses |

## 5. Events (client contract)

`aoe` variants: `ray` (`d` = resonance %), `ray_refract`, `ray_pulse`, `rimefield` / `rimefield_bloom` /
`rimefield_extend`, `rime_burst`, `glass_burst`, `glass_shard`, `kin_burst`, `kin_taunt`, `orrery` / `orrery_wide` (`a`
phase, `n` spheres, `f` follow), `orrery_sun`, `eclipse`, `nova_cone`, `lodestone`, `blackhole_at` (drift), `star_crater`,
`lantern`, `hydra_breath`; `tele meteor` with `a` (Ember Tail streaks in low along it; the marker stays a circle);
`beam zap` (orb zaps and the Conductor tether); `proj` `needle`, `needle_spine`, `stormglass`, `kinbolt`; summons
`cinderkin`, `frostkin`, `ember_sprite` (`EntDesc.r` sizes the rig: a Bonfire Kin draws 2.1×). Known gaps: no client
event on freeze, so the bible's crystalline ping and frost crust on needle freezes are not shown (frozen enemies keep
the rig's frozen tint); Forked Signal relies on the server emitting the two beams in the same order each tick.

## 6. Parity

Full report: `MAGE-PARITY.md` / `.json` (3 seeds, 25-evaluation search per kit, with and without the 19 shared
legendaries). Gate in `npm run verify`: D3 and D4 hard limits on mage items for the parity-ready mains, planned kits,
seed 101 (`server/test/parity.test.ts`), as the pilot. **Only Rime Needles is flagged**: Magic Missile (planned 1.06 ·
1.09) and Frost Nova (0.86 · 1.00) pass the planned gate, but their searched 3-seed hybrid (Hoarfrost Vigil 4 + two
legendaries) measured 1.20× / 1.16× the better pure kit (hard limit 1.10), so they stay unflagged.

| Main skill | Mage items only: legendary / best 6 / best hybrid | D3 · D4 | With shared legendaries: legendary / best 6 / hybrid | D3 · D4 |
|---|---|---|---|---|
| Magic Missile | ×12.9 / ×13.2 GC6 / ×15.8 HV4 | 0.98 · 1.20 | ×30.8 / ×15.8 GC6 / ×28.6 GC4 | 1.95 · 1.00 |
| Rime Needles | ×8.3 / ×10.2 HV6 / ×11.0 HV4 | 0.81 · 1.07 | ×22.1 / ×11.6 HV6 / ×18.8 HV4 | 1.91 · 1.00 |
| Meteor | ×20.1 / ×32.8 FS6 / ×29.1 FS4 | 0.61 · 1.00 | ×32.9 / ×41.6 FS6 / ×41.0 FS4 | 0.79 · 1.00 |
| Stormglass Orb | ×12.6 / ×25.2 GC6 / ×22.2 GC4 | 0.50 · 1.00 | ×23.6 / ×31.4 GC6 / ×26.5 GC4 | 0.75 · 1.00 |
| Thrumming Ray | ×6.1 / ×7.7 HC6 / ×8.3 HC4 | 0.80 · 1.08 | ×9.4 / ×8.3 HC6 / ×7.9 HC4 | 1.14 · 0.95 |
| Black Hole | ×13.1 / ×14.6 GC6 / ×16.0 HV4 | 0.90 · 1.10 | ×25.4 / ×17.3 GC6 / ×19.4 HV4 | 1.47 · 1.00 |
| Frost Nova | ×14.5 / ×14.8 GC6 / ×17.2 HV4 | 0.98 · 1.16 | ×35.8 / ×19.7 GC6 / ×24.5 GC4 | 1.82 · 1.00 |
| Rimefield | ×21.0 / ×22.9 HV6 / ×24.8 HV4 | 0.92 · 1.08 | ×37.2 / ×25.1 HV6 / ×31.9 HV4 | 1.48 · 1.00 |
| Hydra | ×17.6 / ×30.9 GC6 / ×30.7 GC4 | 0.57 · 1.00 | ×40.1 / ×43.8 GC6 / ×44.0 GC4 | 0.92 · 1.00 |
| Cinderkin | ×19.2 / ×17.0 GC6 / ×22.0 HV4 | 1.13 · 1.14 | ×36.9 / ×23.6 HV6 / ×30.8 HV4 | 1.56 · 1.00 |
| Orrery | ×26.8 / ×19.2 GC6 / ×21.9 HV4 | 1.40 · 1.00 | ×36.9 / ×21.2 GC6 / ×28.9 GC4 | 1.74 · 1.00 |

FS Regalia of the Fallen Star, GC Glass Concord, HV Hoarfrost Vigil, HC Hollowstar Choir (Lantern Garden is nobody's
best). Checks, mage items only: D1 3/11, D2 Snowglobe Pendant 11/11, D3 0.50–1.40, D4 1.00–1.20, D5 4/5, D6 1.49 (hard
pass). With the shared legendaries: D1 6/11, D2 Spindle of a Thousand Missiles 10/11, D3 0.75–1.95, D4 0.95–1.00 (hard
pass), D5 4/5 (hard pass), D6 1.23 (hard pass). Before the fits (§4) the same audit measured, mage items only, D3
0.49–3.44 and D6 2.54. The causes, measured:

* **Shared legendaries favour legendary-only kits** (as for the warrior): they lift legendary-only to D3 1.47–1.95 for
  six mains; they sit in the armour slots a 6-piece gives up. That is the shared-items lane's balance (hand-off).
* **Hoarfrost Vigil 4 hybrids** win seven of eleven mains on mage items: Hoarfrost Vigil 2's cooldown / radius bonus
  reaches Frost Nova, Black Hole and Rimefield, which every fixture carries, plus two legendaries beat any 6-piece
  (D4 up to 1.20, the pilot's Fault Warden / Furrowmark pattern). Raising the 6-pieces is a design call; not changed.
* **Spender mains with their set** (Meteor, Stormglass Orb, Hydra) lift ×25–33 with the set while the mage legendary
  pool has few pieces for them (D3 0.50–0.61). **Lantern Garden 6** loses to Glass Concord even on Hydra and Cinderkin.
* **D2** counts frequency, not power: Snowglobe Pendant is the only mage neck legendary that helps every fixture
  (ablation ×1.14 on Orrery).
* **Search depth**: a 25-evaluation search can miss Cube powers (before the Circlet fit, the Glass Concord 6 Orrery kit
  measured ×81 with the Circlet in the Cube against the audited ×19), so searched kits are a floor, not the optimum.

## 7. Endgame power and the simulation

`server/test/sim.ts`: the mage endgame kit is now the audit's best Regalia of the Fallen Star 6 Meteor kit (shipped
pool). Set spike ×13–22 against 8 sturdy targets [M] (old sets ×180 [M]); `BUDGET.md` §9 risk 1 expects this drop.
L70 Torment II rift in 12 minutes: 87.3–93.6 % in rift-only streams, 35.3 % in the full run's stream, no deaths (old
kit after the wave: 33.2–71.5 %; on the old sets at 343a5d5 it completed in 6:02). The sim checks a 30 % progress floor
for that run, as for the warrior, until the Torment re-fit; signature checks hold (second-meteor ratio 1.33, Fallen
Star 4 stacks). Full sim 575 / 577: the two failures are the known tick-time checks (machine load; they fail at the
baseline too). With the mage left out of the class loops, the field, signature and spike sections are byte-identical
to 343a5d5; rift runs diverge after the first legendary drop (the drop pool holds the new mage legendaries).

## 8. Performance (owner rule for skill VFX)

No Pixi filters; no `Graphics` in game code (the meteor telegraph's base / fill rings are the pre-existing telegraph
system); no display objects per event: every effect uses pooled FxSystem particles from the shared fx atlas (4 new
sprites, atlas still 2048×1024); optional counts go through the budget and the graphics preset; summon rigs are baked
RigArt with their sprites created once per view. Measured with a copy of `hearthfall-rework/.local/scn/rift-gl.mjs`
(`.local/scn/rift-gl-mage.mjs`: L70, debug set + legendaries, Torment I rift, 4 s of WebGL counters, 8 scene samples),
visible page, 1920×1080:

| Build · loadout | Draw calls / frame | Visible objects | Monsters on screen |
|---|---|---|---|
| 343a5d5 (before the wave) · Magic Missile, Meteor, Black Hole, Frost Nova, Hydra | 124.9 – 138.1 | 493 – 601 | 12 – 14 |
| this branch · same old loadout | 92.2 – 155.1 | 422 – 894 | 8 – 42 |
| this branch · Rime Needles, Thrumming Ray, Cinderkin, Rimefield, Orrery | 109.4 – 162.3 | 659 – 856 | 21 – 27 |
| this branch · Magic Missile, Stormglass Orb, Orrery, Cinderkin, Hydra | 115.0 – 154.1 | 430 – 804 | 11 – 21 |

Draw calls stay in the same band before and after (they vary ±25 % with the scene); visible objects follow the
monsters on screen (22–53 per monster in every run, base included; 2–3 runs per row, each 8 samples). No texture uploads during fights. Frame rates are
not reported: the first runs shared the machine with the parity audit. Two real-rift look problems were fixed after
these captures (`m-combat-stormglass-orb-unlimited-resource.jpg` shows the debug-only extreme): zap flashes summed to
a white-out (a zap load window now thins re-strikes and flashes above 4 in flight) and the Conductor tether used the
heavy chain arc (now the light zap, and a chain instead of every pair). Finding (engine, not changed): a slotted
Spender with no cooldown casts every server tick when resource is unlimited (debug), 90 orbs in flight.

## 9. Evidence (1920×1080 JPEG, real server, `shots/mage/`)

Skills window `m-skills-page1.jpg` / `m-skills-page2.jpg` (12 / 12 unlocked), trees `m-tree-rime-needles.jpg`,
`m-tree-thrumming-ray.jpg`, `m-tree-orrery.jpg`, runes `m-runes-cinderkin.jpg`, passives `m-passives.jpg` (0 scroll
regions); item cards `m-item-glass-concord-chest.jpg` (5 / 6), `m-item-armillary-staff.jpg`,
`m-item-spellwrights-circlet.jpg`, `m-item-snowglobe-pendant.jpg`, `m-item-lanternkeepers-sash.jpg`,
`m-item-runeweaver-cuffs.jpg`, `m-item-echoing-bead.jpg`, `m-item-hoarneedle-wand.jpg`, `m-item-stormglass-prism.jpg`;
combat in a Torment I rift `m-combat-rime-needles.jpg`, `m-combat-thrumming-ray.jpg`, `m-combat-cinderkin.jpg`,
`m-combat-rimefield.jpg`, `m-combat-stormglass-orb.jpg`, `m-combat-stormglass-orb-pack.jpg`, `m-combat-orrery.jpg`;
VFX gallery `vfx-*.jpg` (every variant, icons `vfx-icons-*.jpg`). Known look issue: in a crowd the Cinderkin rigs
are hard to see under the monsters and their death puffs (they read clearly in `vfx-cinderkin-*.jpg`).

## 10. Findings for other lanes

* Tag-keyed set / legendary powers have no class filter: a mage set's Spender cost cut applied to a warrior save in
  the equivalence test (mage sets are excluded from that kit). Engine lane.
* Monster separation by entity id (pre-existing) makes pulled packs order-dependent; harnesses reset ids.
* Spenders without a cooldown are paced only by resource (see §8).
