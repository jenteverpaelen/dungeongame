# Mage wave — what shipped, what is still blocked, deviations (branch `claude/mage`)

Implements `MAGE.md` (bible v2) on the depth foundation, engine wave 2 and the warrior pilot's patterns. Labels:
**[M]** measured in this repo, **[P]** proposal (a number chosen here, to be re-fitted by playtests), **[B]** from the bible.

## 1. Shipped

| What | Count | Notes |
|---|---|---|
| Skills | 12 / 12 | 6 existing + Rime Needles (16), Thrumming Ray (20), Cinderkin (26), Rimefield (32), Stormglass Orb (40), Orrery (50) |
| Runes | 60 / 60 | runes 4–5 of the existing skills at skill + 14 / + 20 [B]; the new skills' runes at + 2 / 5 / 9 / 14 / 20 [B] |
| Specialization nodes | 72 / 72 | the five wave-3 nodes shipped in phase 2 (§2); every tree holds 18 ranks for a cap of 10 |
| Passives | 14 (6 kept + 8 new) | Chill Margin, Astral Debt, Conjurer's Hearth, Resonance, Ley Anchor, Missile Choir, Unbroken Ward, Starborn |
| Sets | 5 / 5 | Regalia of the Fallen Star redesigned on tags; Glass Concord, Lantern Garden (the Summon set, approved), Hoarfrost Vigil (approved), Hollowstar Choir new |
| Mage legendaries | 34 / 34 | 5 existing + 29 new (Rimewalker Slippers in phase 2, §2) |
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

## 2. Phase 2 (after the merge of engine wave 3, 7faa331): the blocked content, shipped

Nothing is blocked any more. Built on the wave-3 primitives, no engine change (tests: `mage.test.ts` "phase 2"):

| Content | Built with | Notes |
|---|---|---|
| Black Hole N4 Lingering Pull | `slow` 20 / 35 / 50 % for 2 s on every enemy within the hole when it collapses | position (0, 1), needs Event Rim |
| Rimefield N3 Cold Snap Edge | the rim = the outer quarter of the radius [P] moves at 50 % × (1 − 20 / 35 / 50 %) | "a further" = on top of the field's 50 % chill |
| Rimefield N6 Absolute Field | `vulnerable` 10 / 20 / 30 % scoped to Rimefield and Rime Needles, refreshed every 0.25 s on frozen enemies inside | needs Cold Snap Edge |
| Orrery N2 Tidal Lock | `slow` 10 / 20 / 30 % for 1 s from each sphere pass | |
| Orrery N5 Clockwinding | each spell cast while it turns adds 0.2 / 0.35 / 0.5 s (max +10 s) | "spell cast" = the cast counter (`attackSeq`): bar skills, primary attacks, channel starts; client event `aoe orrery_extend` |
| Rimewalker Slippers | `skillMore` Ground 25–35 % + proc `dashEnd` (8 s) | marker buff `rimewalker` (8 s, HUD "Rimewalker (recharging)"); the mage tick drops a half-size copy of the most recent molten ground / Black Hole / Rimefield at the landing point (copies never become "most recent") |
| Chill 50 % (Rimefield) and 60 % (Deep Chill) | the engine chill (40 %, also slows attacks) + a `slow` that brings movement to 50 % / 40 % (`mageKit.mChillAt`: slow = 1 − movement / 0.6) | the extra slow lasts as long as the chill (Chill Margin's longer chills keep it) |
| Chill 30 % (Rime Needles) | stays the engine's 40 % chill | the chilled state is what Chill items read; a 30 % slow alone would drop it |

Also in phase 2: **Stormglass Orb is paced by the attack rate** (one cast per attack interval, as every D3 cast takes an
attack's time). The 0-cooldown Spender was paced only by resource, and Static Charge on an elite pack refunds more than an
orb costs: measured 184 casts and 78 orbs in flight in 10 s without debug resources; now 14 casts, at most 6 orbs (test).
Meteor cannot loop (cost 40, at most 15 + 8 back per cast).

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
| Rime Needles | each needle chills 30 % | the engine's 40 % chill | the chilled state is what Chill items read (§2) |
| Cold Snap Edge | "enemies at the rim" | the outer quarter of the radius [P] | the bible gives no width |
| Clockwinding | "each spell cast" | every bar cast, primary attack and channel start | the cast counter; the +10 s cap is the bible's |
| Stormglass Orb | — | one cast per attack interval | an AP-positive loop cast it every tick (§2) |
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
`aoe orrery_extend` (Clockwinding: `d` = ms still to turn, `s` = owner; the client extends that owner's orrery and sun); `beam zap` (orb zaps and the Conductor tether); `proj` `needle`, `needle_spine`, `stormglass`, `kinbolt`; summons
`cinderkin`, `frostkin`, `ember_sprite` (`EntDesc.r` sizes the rig: a Bonfire Kin draws 2.1×). Known gaps: no client
event on freeze, so the bible's crystalline ping and frost crust on needle freezes are not shown (frozen enemies keep
the rig's frozen tint); Forked Signal relies on the server emitting the two beams in the same order each tick.

## 6. Parity

Full report: `MAGE-PARITY.md` / `.json` (3 seeds, 25-evaluation search per kit, with and without the 19 shared
legendaries). Gate in `npm run verify`: D3 and D4 hard limits on mage items for the parity-ready mains, planned kits,
seed 101 (`server/test/parity.test.ts`), as the pilot. **Only Rime Needles is flagged**: it passes the planned gate
(phase 2: 1.19 · 1.00) and the searched 3-seed audit (0.95 · 1.06). Every other main fails one of the two: in phase 2 the
planned gate passes Thrumming Ray, Black Hole, Frost Nova, Rimefield, Cinderkin and Orrery, but their searched hybrids
measure D4 1.13–1.21 (Ray: D3 0.52); Magic Missile and Stormglass Orb pass the audit but not the gate (1.31 / 0.64).
Table and checks below: after phase 2 (merged engine wave 3).

| Main skill | Mage items only: legendary / best 6 / best hybrid | D3 · D4 | With shared legendaries: legendary / best 6 / hybrid | D3 · D4 |
|---|---|---|---|---|
| Magic Missile | ×13.8 / ×12.5 GC6 / ×14.8 HV4 | 1.10 · 1.08 | ×31.2 / ×16.2 GC6 / ×26.2 GC4 | 1.92 · 1.00 |
| Rime Needles | ×10.4 / ×11.0 HV6 / ×11.7 HV4 | 0.95 · 1.06 | ×25.6 / ×12.3 HV6 / ×20.1 HV4 | 2.08 · 1.00 |
| Meteor | ×22.8 / ×31.1 HC6 / ×34.4 FS4 | 0.73 · 1.11 | ×43.3 / ×41.9 HC6 / ×47.0 FS4 | 1.03 · 1.09 |
| Stormglass Orb | ×15.0 / ×15.4 GC6 / ×14.2 GC4 | 0.97 · 0.95 | ×28.8 / ×27.3 GC6 / ×21.9 GC4 | 1.05 · 0.80 |
| Thrumming Ray | ×4.7 / ×9.1 HC6 / ×8.1 HC4 | 0.52 · 1.00 | ×8.6 / ×8.3 HC6 / ×7.9 HC4 | 1.04 · 0.95 |
| Black Hole | ×13.3 / ×12.4 GC6 / ×16.1 HV4 | 1.07 · 1.21 | ×27.0 / ×15.5 GC6 / ×16.4 HC4 | 1.75 · 1.00 |
| Frost Nova | ×13.5 / ×13.5 GC6 / ×15.2 HV4 | 1.00 · 1.13 | ×34.2 / ×17.9 GC6 / ×20.6 GC4 | 1.91 · 1.00 |
| Rimefield | ×21.2 / ×21.3 HV6 / ×25.2 HV4 | 1.00 · 1.18 | ×35.1 / ×24.7 HV6 / ×28.0 HV4 | 1.42 · 1.00 |
| Hydra | ×19.5 / ×30.9 GC6 / ×30.7 GC4 | 0.63 · 1.00 | ×40.3 / ×43.8 GC6 / ×44.0 GC4 | 0.92 · 1.00 |
| Cinderkin | ×18.8 / ×17.0 GC6 / ×22.0 HV4 | 1.11 · 1.17 | ×40.3 / ×23.6 HV6 / ×30.8 HV4 | 1.71 · 1.00 |
| Orrery | ×23.5 / ×16.6 HV6 / ×19.5 HV4 | 1.42 · 1.00 | ×37.0 / ×16.9 GC6 / ×26.7 GC4 | 2.19 · 1.00 |

FS Regalia of the Fallen Star, GC Glass Concord, HV Hoarfrost Vigil, HC Hollowstar Choir (Lantern Garden is nobody's
best). Checks, mage items only: D1 2/11, D2 Snowglobe Pendant 11/11, D3 0.52–1.42, D4 0.95–1.21, D5 4/5, D6 2.14. With
the shared legendaries: D1 3/11, D2 Spindle of a Thousand Missiles 10/11, D3 0.92–2.19, D4 0.80–1.09, D5 4/5 (hard
pass), D6 1.37 (hard pass). Phase 1 (before the merge) measured, mage items only, D3 0.50–1.40, D4 1.00–1.20, D6 1.49;
before the fits (§4) D3 0.49–3.44 and D6 2.54. Phase 2 moved them through three measured causes:

* **Rimewalker Slippers** fill the mage's empty feet slot with a Ground bonus that every fixture's Black Hole / Rimefield
  carries: legendary-only rises for most mains (planned gate without it: D3 back to phase 1 ±0.07).
* **Stormglass Orb pacing**: Glass Concord 6 on the Orb ×25.2 → ×15.4 (the harness cast orbs faster than the attack rate
  before); D3 0.50 → 0.97, but its lower best lift moves the class median, hence D6 2.14 (Meteor ×34.4 ÷ median ×16.1).
* **Fixture trees**: the 10-rank fixture (`fixtureNodes`) now buys Cold Snap Edge (Rimefield) and Tidal Lock +
  Clockwinding (Orrery) where the grid had gaps, instead of Shard Burst / Eclipse damage. Thrumming Ray's legendary-only
  ×6.1 → ×4.7 is search noise (it picked Hornlistener Circlet and Signal Coil over the previous kit's Horizon Cowl and
  Clockmaker's Ring).

The structural causes, measured in phase 1 and unchanged:

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

**Levelling pace (verify stage `pace-targets`, `bot-metrics.ts check 120`), phase 2.** A/B against the merged base
claude/town-ui-rework 7faa331 (same seed, 120 simulated minutes per class): the one miss, "L25+ champion TTK median 6.65 s
> 6.4 s", is identical in both (the median is the ranger's 6.65 s; warrior 7.10 s), so the mage does not cause it. The
warrior and ranger rows are identical. The mage's own rows, base → branch: L1–5 kills/min 71.9 → 77.1, champion TTK
3.25 → 1.95 s; L5–10 63.0 → 94.5, 8.70 → 4.35 s; L10–15 48.4 → 48.8, 5.30 → 6.00 s; L15–20 100.8 → 96.9, 5.10 → 5.40 s;
L20–25 82.2 → 88.4, 5.30 → 5.90 s; L25+ 92.3 → 93.9, 4.60 → 5.25 s; XP/h at L25+ 4.47 M → 4.85 M; reaches level 28 instead
of 27; no deaths in either. The baseline was not re-recorded.

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
heavy chain arc (now the light zap, and a chain instead of every pair). Finding: a slotted Spender with no cooldown
casts every server tick when resource is unlimited (debug, 90 orbs in flight) — and, measured in phase 2, also without
debug resources through Static Charge on elites; Stormglass Orb is now paced by the attack rate (§2).

## 9. Evidence (1920×1080 JPEG, real server, `shots/mage/`)

Skills window `m-skills-page1.jpg` / `m-skills-page2.jpg` (12 / 12 unlocked), trees `m-tree-rime-needles.jpg`,
`m-tree-thrumming-ray.jpg`, `m-tree-orrery.jpg`, runes `m-runes-cinderkin.jpg`, passives `m-passives.jpg` (0 scroll
regions); item cards `m-item-glass-concord-chest.jpg` (5 / 6), `m-item-armillary-staff.jpg`,
`m-item-spellwrights-circlet.jpg`, `m-item-snowglobe-pendant.jpg`, `m-item-lanternkeepers-sash.jpg`,
`m-item-runeweaver-cuffs.jpg`, `m-item-echoing-bead.jpg`, `m-item-hoarneedle-wand.jpg`, `m-item-stormglass-prism.jpg`;
combat in a Torment I rift `m-combat-rime-needles.jpg`, `m-combat-thrumming-ray.jpg`, `m-combat-cinderkin.jpg`,
`m-combat-rimefield.jpg`, `m-combat-stormglass-orb.jpg`, `m-combat-stormglass-orb-pack.jpg`, `m-combat-orrery.jpg`;
VFX gallery `vfx-*.jpg` (every variant, icons `vfx-icons-*.jpg`). Phase 2: `p2-tree-orrery.jpg`, `p2-tree-rimefield.jpg`,
`p2-tree-black-hole.jpg` (six nodes each), `p2-item-rimewalker-slippers.jpg`, `p2-combat-orrery-18s.jpg` (Clockwinding: still
turning past its 15 s), `p2-combat-rimefield.jpg` and `p2-combat-rimewalker-copy.jpg` (the half-size copy where the dash
ended; the hero walked on after landing). Known look issue: in a crowd the Cinderkin rigs
are hard to see under the monsters and their death puffs (they read clearly in `vfx-cinderkin-*.jpg`).

## 10. Findings for other lanes

* Tag-keyed set / legendary powers have no class filter: a mage set's Spender cost cut applied to a warrior save in
  the equivalence test (mage sets are excluded from that kit). Engine lane.
* Monster separation by entity id (pre-existing) makes pulled packs order-dependent; harnesses reset ids.
* Spenders without a cooldown are paced only by resource in the generic brain; any AP-positive loop casts them every
  tick (fixed for Stormglass Orb in class code, §2). A general cast-time rule is an engine decision.
