# Depth foundation — log (terse)

- 2026-10-11 Baseline (7846e60): `server/test/sim.ts` 380/382 (two perf thresholds, machine load; 382/382 when idle).
  `scripts/audit-item-builds.ts` now times out on **all 81** encounters: Torment X with the ×350 level-70 toughness of
  the 2026-10-10 balance pass (`docs/rework/BALANCE.md` §4) — the P11 numbers are stale. Its rows are still
  deterministic, so they serve as a behaviour fingerprint. Pre-existing failure outside verify:
  `server/test/itemization.test.ts` "Mystic authenticates …" (gear `fx` field in item looks), fails on the baseline too.
- Step 1: skill data split into `shared/src/data/skills/{types,warrior,ranger,mage,index}.ts` (JSON of `SKILLS` and key
  order identical to the old file); server behaviour split into `server/src/sim/skills/{common,warrior,ranger,mage,index}.ts`
  with registries for casts, primaries, channel ticks, summon AI, owner hooks and death hooks (death-hook order kept).
  Proof: sim output identical to baseline except timing lines (`simdiff`), typecheck, shared 54/54, focused server tests.
- Step 2: `RuneDef.unlock` (absolute level, authored per rune; existing runes written as skill+2/+5/+9, verified 0
  mismatches); `MAX_RUNES = 5`; `RUNE_UNLOCK_OFFSETS` removed (UI shows each rune's level). Validation: ≤5 runes, unlock
  integer in [skill unlock, 70]. Skill unlocks were already data (≤70). Sim identical; shared 57/57.
- Step 3: `SkillDef.nodes` (NodeDef: id, name, text, maxRank ≤3, per-rank SkillMods incl. flags/vars, requires, unlock,
  pos), `SkillMods.vars`, `shared/src/specialization.ts` (derived spec points = level−1, 1/rank, buy/refund/reset,
  normalisation), save v15 + fixtures v14/v15, `skillNode` + `skillReset {skill?}` persisted, protocol 23. Shipped data:
  no nodes (placeholder trees only in `shared/test/fixtures/depthContent.ts`). Tests: depthFoundation 10, depth 3,
  foundations with the new fixtures; sim identical.
- Step 4: power templates `shared/src/powers.ts` (skillMods, ownMult, conditional own/hit, stat, elementStacks,
  elementCycle, proc, dashCooldown; builders; generated text + `powerTextIssues`), `powerSources.ts` (canonical order
  sets → legendaries → passives → nodes), server interpreter `powerRuntime.ts` replaces the `extraMods` switch, the
  `skillMult` switch and every `ctx.power('<id>')` read (damage, players, kills, brain, projectiles, class modules).
  Legendaries/sets moved to `shared/src/data/powers/{warrior,ranger,mage,shared}.ts` (registry order kept by
  `compose`). `OWN_BUCKET_CAP = 127` (non-binding). `DerivedStats.dashCdMs` (client prediction reads it).
  Proof: powerTemplates equivalence test (all kits strictly equal), sim identical, item audit rows byte-identical.
  Pre-existing failures (baseline too, not in verify): `server/test/midgame.test.ts` 2 story-XP tests (balance pass).
- Step 5: passives per class in `shared/src/data/passives/*.ts` (18 identical: data, values L1–70, texts); `PassiveDef`
  gains optional `effects` + `text` (stat optional); template passives flow through `passivePowerSources` into the
  same interpreter; validation for passives. Tests: depthFoundation (passives), powerTemplates (passive in ctx).
  Sim identical.
- Lead requests (bible + tags): `skillMore` template; one shared condition predicate (target: stunned/frozen/chilled/
  bleeding/immobilised/inBlackHole, life above, farther than; player: channelling incl. tag query, buff, buff stacks,
  summons, standing still, in own ground, life); tag model (derived kind + element, authored mechanic tags on skills and
  runes; templates and conditions target skills or tag queries, resolved once per stat build); `ITEM_COUNT_CAP` (3/2,
  non-binding, bible wants 2/2); `stat.perLegendary` + `noSetBonus` (Patchwork Signet); economy switch `SPEC_POINTS`
  (shipped separate from L2; bible preset L10 + cap 10; shared mode supported); `skillPrimary` command; `category`.
  Sim identical, item audit rows identical, powerTemplates 12, depthFoundation 16.
- Step 6: Skills window (`client/src/ui/panels/skills.tsx`): paged list + category chips, three detail views (Runes &
  tiers, Specialization tree, Casting), both point pools, primary switch, tags; no scroll region. Evidence:
  `docs/rework/depth/shots` (gallery fixture 12/20 skills + real server), 1080p heights 778–882 px, 0 scrollers.
- Step 7: parity harness `server/test/parity/harness.ts` (KitSpec data, runner, planner), report
  `scripts/audit-parity.ts` → `PARITY.md` / `PARITY-MODEL.json` (15 s), gate `server/test/parity.test.ts` in verify
  stage `depth` (asserts only `parityReady` skills; none yet). Today legendary-only / set = 18.6×–94.6×.
- Final verify: every stage green except the two machine-load perf thresholds of `server/test/sim.ts` (sim tick avg
  3.42 ms / 4.10 ms vs < 3 ms). A/B in the same conditions right after: HEAD 2.21–2.57 ms, baseline 7846e60
  2.59–2.70 ms (sim only) — no regression; the step-4 verify passed all 26 stages on a quieter machine.
- Re-run of `npm run verify` on cc8fb90: **passed**, all stages (server bot 757/0, sim 382/382, sim tick 2.35 ms).

## Engine wave 2 (2026-10-11)

- Merged `claude/town-ui-rework` (39ab451; later f8b3998 with bible v2) into `claude/depth` (fast-forward). Baselines
  captured: sim, item audit rows, parity rows.
- Primitives (FOUNDATION.md §11), all generic data and no-ops for shipped content:
  - **Procs:** 9 triggers; skill / tag / status / big-hit filters; per-proc ICD; strike / summon / ground / status /
    deflect actions; chain-depth rule.
  - **Defensive:** damageTaken (static, conditional on the attacker, per legendary + noSetBonus), firstHit with status
    reset, cheatDeath, controlImmunity, DR / ccImmune / stacking buffs.
  - **Conditions:** all / any, targetElite, targetControlledWithinMs (`Mob.ctrlAgo`), standingStillMs, inDebt, marked /
    weakened.
  - **Sub-strike tags:** `SUB_STRIKES` now carries `{ owner, tags }`.
  - **Data grounds:** `GROUND_DEFS` + `groundFx.ts` (tick, onEnter with re-arm, insideFor, pull, follow, maxPerOwner,
    line shape, origin owner).
  - **Projectiles:** distance bonus, wall bounce, retarget, seekMarked, deflect.
  - **Monster statuses** (`status.ts`): weaken, owner-scoped vulnerability, taunt, freeze build-up, bleed / burn, mark;
    dot rules (stacks, strength, carry-over).
  - **Stacking:** distance / kills, decay all / one, onMax.
  - **Resource debt.**
- Lead request (bible v2):
  - Tag vocabulary v2: 22 mechanic tags; melee → strike alias.
  - Rune addTags / removeTags.
  - `tagGrant` with one fixed resolution order.
  - `rule` changes: charges, channelMove, buffUpkeep, spendRefund, groundsFollow, countsAs.
  - Inscriptions registry with the one-active rule (first in `SLOTS` order); validation for all new kinds, grounds and
    Inscriptions.
  - The owner's economy preset (50 points at L70 from L21, cap 10) verified on the existing switch; the pilot sets it.
- Harness: RunOptions `dash` / `lifePct`, `slotCandidates` / `kitLegal` / `searchKit` (coordinate ascent, pluggable
  score) / `classCoverage`.
- `ITEM_COUNT_CAP` stays 3 / 2; `USE_BIBLE_COUNT_CAP = false` selects `ITEM_COUNT_CAP_BIBLE` 2 / 2 when flipped.
- New entity fields are initialised in the entity literals (Mob, Player, Proj, Ground, LiveMods), so lazily created
  state does not change V8 object shapes in the hot loops.
- Proof:
  - `server/test/sim.ts` identical to the baseline (timing lines excluded).
  - powerTemplates equivalence test green; parity rows identical; item audit rows identical (see the commit).
  - Perf A/B alternating 3 × 3 runs on the same machine: 4 players + 150 monsters, baseline 1.19 / 1.32 / 1.39 ms vs
    new 1.07 / 1.27 / 1.39 ms; T3 rift 0.090 / 0.124 / 0.097 vs 0.094 / 0.116 / 0.107 ms.
  - An earlier single run under heavy machine load showed 3.2 ms (perf threshold), a load artefact.
  - Tests: `server/test/engineWave2.test.ts` (15). Test change: Cleave's tag set now includes `strike` (alias).
## Shared-items wave (2026-10-11)

- Merged claude/town-ui-rework (f3019b1, with engine wave 2 and the quest rework) by fast-forward.
- Commit 624926a (engine only; sim.ts identical to the wave-2 baseline). Added:
  - setReduce;
  - noEnemyWithin and burning;
  - attack trigger with every / repeat;
  - kill-stack filter;
  - cdRecovery;
  - control immunity by kind;
  - markSpread;
  - consumable vulnerability;
  - returning / range-ricochet projectiles;
  - 22 affix stats as templates and gated hooks;
  - non-extractable legendaries.
- Commit b513b69 (content): 13 shared legendaries, Ouroboros 60-80, 38 bases, 22 affixes (weights 3/4 [P], see
  FOUNDATION 12.3), names, off-hand rule as data. Equivalence proof restricted to the 22 converted legendaries;
  loot pity fixture seed 27 to 6. Parity evidence regenerated. Sim 382/382 checks pass with the new RNG.
- Grades: Kindled / Fabled generation, Inscription pool (10), save 16 migration plus golden fixture, Mystic rekindle,
  tooltip grade / ember / Inscription.
- Client: channel-speed prediction (MeState.ms), following ground visuals (aoe.f), charge badges, v2 tag labels.
- Tests: server/test/sharedItems.test.ts (14).
- Known: 2 gearVisual tests fail until claude/gear-v2 widens the legendary field (gear lane).

## Warrior pilot (2026-10-11, branch `claude/warrior`)

- Content: 12 skills, 60 runes, 68 / 72 nodes, 11 passives (5 of 8 new), 5 sets (3 redesigned, 2 new), 32 / 34 warrior
  legendaries, 7 data grounds; NAMES.md renames (Seismic Slam → Quakeline, ids unchanged); `SPEC_POINTS` = separate,
  1 / level from 21, cap 10. Details, blocked list and deviations: `WARRIOR-PILOT.md`.
- Narrow generic additions (tests in `server/test/warrior.test.ts` / `powerTemplates.test.ts`): `RuneDef.effects`,
  `SkillDef.vars`, proc `when`, `Buff.cost`, grounds placed during the grounds update start next tick, exact dot
  carry-over (`effects.ticksAhead`), harness RNG per equipment slot.
- Parity: `WARRIOR-PARITY.md` (D1–D6 measured, with and without the shared legendaries); verify gates D3 / D4 on
  warrior items for the three parity-ready warrior skills (Cleave, Tolling Blow, Quakeline). Fits from measurements:
  Cinder Oath 4 and Red Ledger cost cuts 30 → 15 %, Hearthbanner 6 shockwave 100 → 50 %, Endless Storm 6 wisps 25 % in
  total.
- Merged claude/town-ui-rework d22ee7d (normal merge, 13 conflicts; WARRIOR-PILOT.md §9). Kilnmaw and Cinder Oath 4
  "or Burning" shipped on the new base / target state. Fixed two verify failures the integration branch had on its own
  (originality: two affix labels; save history: v16 entry + golden fixture) and a seed-fragile grades test.
- `server/test/sim.ts`: warrior fixture kit = the audit's best Endless Storm 6 Whirlwind kit (set spike ×25 [M]);
  warrior L70 Torment II rift is a 30 % progress floor until the Torment re-fit (BUDGET.md §9 risk 1; measured 71.9 %).
  Ranger and mage byte-identical against d22ee7d with the warrior out of the class loops (spike, rift, field).

## Mage wave (2026-10-11, branch `claude/mage`)

- Content: 12 skills (6 new: Rime Needles, Thrumming Ray, Cinderkin, Rimefield, Stormglass Orb, Orrery), 60 runes,
  67 / 72 nodes, 14 passives (6 kept + 8 new), 5 sets (Regalia of the Fallen Star redesigned on tags; Glass Concord,
  Lantern Garden, Hoarfrost Vigil, Hollowstar Choir new), 33 / 34 mage legendaries, 5 data grounds; NAMES.md rune
  renames (ids unchanged). Details, blocked list (chosen-strength slow: 5 nodes; Rimewalker Slippers: movement-end
  trigger) and deviations: `MAGE-PILOT.md`.
- Narrow generic additions (tests in `server/test/engineMage.test.ts`): `Proj.hook`, negative `skillMore` ("less"),
  `elementStacks.bucket: 'generic'`, rule `statusLonger`; harness-only `resetIdsForHarness`.
- Parity: `MAGE-PARITY.md` (D1–D6 measured, with and without the shared legendaries); verify gates D3 / D4 on mage
  items for the parity-ready mage skill Rime Needles. Fits from measurements: Hollowstar Choir 4 cost 30 → 10 %,
  Hollowstar Choir 6 refraction 40 → 15 %, Hoarfrost Vigil 2 20/20 → 15/15 %, Spellwright's Circlet once every 0.5 s,
  Stormglass extra orbs half damage. Mage items only, D3 0.49–3.44 → 0.50–1.40 and D6 2.54 → 1.49.
- Client: `render/vfx/mage.ts` + routing, poses, three summon rigs, six icons, buff names, sounds, gallery scenes; no
  filters, no Graphics, pooled particles only. Real-rift fixes: zap load window, orb glow crowding, Conductor tether as
  the light zap (and a chain). Draw calls per frame stay in the base build's band (`MAGE-PILOT.md` §8).
- `server/test/sim.ts`: mage endgame kit = the audit's best Fallen Star 6 Meteor kit (set spike ×13–22 [M]); mage
  L70 Torment II rift is a 30 % progress floor like the warrior's (87.3–93.6 % rift-only, 35.3 % in the full stream).
  Warrior and ranger field / signature / spike sections byte-identical to 343a5d5 with the mage out of the class loops.
